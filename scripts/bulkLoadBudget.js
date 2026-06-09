#!/usr/bin/env node
/**
 * Generic Socrata Budget Loader
 *
 * Loads operating and revenue budget data from any Socrata SODA API into
 * treasury.budgets + treasury.budget_categories via the
 * treasury_sync_budget_tree RPC.
 *
 * The loader is data-driven: it reads field names entirely from
 * data_sources.column_mapping. Adding a new city requires no code change —
 * only a new treasury.data_sources row.
 *
 * Usage:
 *   node scripts/bulkLoadBudget.js --list
 *   node scripts/bulkLoadBudget.js --source "Dallas" --fy 2025
 *   node scripts/bulkLoadBudget.js --source "Dallas Operating" --fy 2025 --fy 2026
 *   node scripts/bulkLoadBudget.js --source "Dallas" --dry-run --fy 2025
 *
 * Env vars:
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { buildBudgetTree, parseAmount } from './buildBudgetTree.mjs';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL env var');
  process.exit(1);
}
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Socrata fetch helpers ───────────────────────────────────────────────
async function fetchSocrataCount(baseUrl, datasetId, where) {
  const url = `${baseUrl}/resource/${datasetId}.json?$select=count(*)&$where=${encodeURIComponent(where)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata count ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return parseInt(data[0]?.count || '0');
}

async function fetchSocrataPage(baseUrl, datasetId, offset, limit, where, order) {
  const params = new URLSearchParams({
    $limit: String(limit),
    $offset: String(offset),
    $where: where,
  });
  if (order) params.set('$order', order);
  const url = `${baseUrl}/resource/${datasetId}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

// ── Per-source sync ─────────────────────────────────────────────────────
async function syncBudgetSource(ds, fiscalYear, opts = {}) {
  const cm = ds.column_mapping || {};
  const fyCol = cm.fiscal_year_column || 'bfy';
  const fyType = cm.fiscal_year_type || 'string';
  const whereExtra = cm.where_extra || '';

  // column_mapping extensions (both optional):
  //   fiscal_year_type: 'integer' -> WHERE fiscal_year=2025 (no quotes; for LA revenue vvm4-a2zu)
  //                     anything else / absent -> WHERE bfy='2025' (default, matches TX cities)
  //   where_extra:      additional WHERE clause fragment appended after the year filter.
  //                     Caller supplies the leading 'AND' (e.g., "AND revenue_or_spending='Spending'").
  //                     Used by SF Budget (xdgd-c79v) to filter combined spending/revenue dataset.

  // Build base WHERE — integer columns must NOT be quoted (e.g., LA Revenue vvm4-a2zu)
  // String columns (default) match the prior behavior exactly
  const baseWhere =
    fyType === 'integer'
      ? `${fyCol}=${fiscalYear}`
      : `${fyCol}='${fiscalYear}'`;

  // Append where_extra verbatim if provided (e.g., SF xdgd-c79v needs
  // "AND revenue_or_spending='Spending'"). Caller supplies the leading AND.
  const where = whereExtra ? `${baseWhere} ${whereExtra}` : baseWhere;

  const totalCount = await fetchSocrataCount(ds.base_url, ds.dataset_id, where);
  console.log(`\n${ds.name} FY${fiscalYear}: ${totalCount.toLocaleString()} total rows`);

  if (totalCount === 0) {
    console.log('  (no data for this fiscal year)');
    return { rows_fetched: 0, rows_inserted: 0, status: 'empty' };
  }

  const PAGE_SIZE = 5000;
  const allRows = [];
  let offset = 0;

  while (offset < totalCount) {
    const rows = await fetchSocrataPage(ds.base_url, ds.dataset_id, offset, PAGE_SIZE, where, null);
    if (rows.length === 0) break;
    allRows.push(...rows);
    offset += rows.length;
    process.stdout.write(`\r  fetched ${offset.toLocaleString()}/${totalCount.toLocaleString()}`);
    if (rows.length < PAGE_SIZE) break;
  }
  console.log('');

  const { jsonTree, total, kept, droppedZero } = buildBudgetTree(allRows, cm);
  console.log(`  built tree: ${kept} kept, ${droppedZero} zero-amount rows dropped, total $${Math.round(total).toLocaleString()}`);
  console.log(`  top-level categories: ${jsonTree.length}`);

  if (opts.dryRun) {
    console.log('  (dry run — skipping RPC call)');
    const deptCol = cm.department_column || null;
    const childLabel = deptCol ? 'services' : 'subcategories';
    for (const c of jsonTree.slice(0, 3)) {
      const childCount = c.c ? c.c.length : 0;
      console.log(`    ${c.n}: $${Math.round(c.a).toLocaleString()} (${childCount} ${childLabel})`);
    }
    return { rows_fetched: allRows.length, rows_inserted: 0, status: 'dry_run' };
  }

  // Clear existing rows for idempotency (mirrors processPortland.js pattern)
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  if (delErr) {
    console.error(`  Pre-load delete failed: ${delErr.message}`);
    return { rows_fetched: allRows.length, rows_inserted: 0, status: 'error' };
  }

  // Use treasury_sync_budget_tree (NOT treasury_sync_budget — does not exist)
  const { data, error } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: fiscalYear,
    p_dataset_type: ds.dataset_type,
    p_total: total,
    p_tree: jsonTree,
    p_row_count: allRows.length,
    p_triggered_by: 'bulk_load',
  });

  if (error) {
    console.error(`  RPC error: ${error.message}`);
    return { rows_fetched: allRows.length, rows_inserted: 0, status: 'error', error: error.message };
  }

  console.log(`  inserted ${data?.rows_inserted || 0} line items`);
  return { rows_fetched: allRows.length, rows_inserted: data?.rows_inserted || 0, status: 'ok' };
}

// ── CLI ─────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      fy: { type: 'string', short: 'y', multiple: true },
      list: { type: 'boolean', short: 'l' },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  const { data: sources, error } = await supabase.rpc('treasury_list_source_ids');
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  // Default filter to budget types (NOT 'transactions')
  const budgetSources = (sources || []).filter(
    s => s.api_type === 'socrata' && ['operating', 'revenue'].includes(s.dataset_type)
  );

  if (values.list) {
    console.log('\nAvailable Socrata budget data sources:\n');
    for (const s of budgetSources) {
      console.log(`  ${s.name} (${s.dataset_type}) — FYs: ${(s.fiscal_years || []).join(', ') || 'current'}`);
    }
    return;
  }

  let targets = budgetSources;
  if (values.source) {
    const needle = values.source.toLowerCase();
    targets = targets.filter(s => s.name.toLowerCase().includes(needle));
  }

  if (targets.length === 0) {
    console.log('No matching Socrata budget sources found. Use --list to see available sources.');
    return;
  }

  console.log(`\nLoading ${targets.length} Socrata budget source(s)...\n`);

  const results = [];
  for (const src of targets) {
    const { data: ds } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: src.id });
    if (!ds) { console.error(`  Config not found for ${src.name}`); continue; }

    const fiscalYears = values.fy
      ? values.fy.map(Number)
      : (ds.fiscal_years || [new Date().getFullYear()]);

    for (const fy of fiscalYears) {
      const r = await syncBudgetSource(ds, fy, { dryRun: values['dry-run'] });
      results.push({ source: ds.name, fy, ...r });
    }
  }

  console.log('\n--- Summary ---');
  for (const r of results) {
    console.log(`  ${r.source} FY${r.fy}: ${r.status} — ${r.rows_fetched} rows fetched, ${r.rows_inserted} inserted`);
  }
  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
