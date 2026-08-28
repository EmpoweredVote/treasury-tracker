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
import { buildSocrataWhere, skipFyFilterMultiYearProblem } from './lib/socrataFilter.mjs';
import { resolveYearColumns } from './lib/yearColumnMapping.mjs';

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
  // Wide-format sources (one column per year, no fiscal_year column) bind a
  // different amount column and a different basis for each year. Everything else
  // resolves to itself, so this is a no-op for every long-format source.
  const { cm, basis: yearBasis } = resolveYearColumns(ds.column_mapping || {}, fiscalYear, ds.name);
  // A source may declare its basis once in column_mapping ("basis": "adopted"). A
  // wide-format source's per-year basis wins, because there the kind of money genuinely
  // differs column by column. Absent, this stays null and the RPC leaves basis alone.
  const basis = yearBasis ?? (ds.column_mapping?.basis ?? null);

  // ⚠ The WHERE clause now comes from scripts/lib/socrataFilter.mjs, shared with the
  // treasury-sync edge function. The two used to be separate implementations
  // supporting different subsets of the same column_mapping extensions — this side
  // had where_extra and fiscal_year_type, the edge side had skip_fy_filter and the
  // date-field note, and neither had the other's. San Francisco depends on
  // where_extra, so it loaded here and was structurally unsyncable by cron.
  //
  // Note this loader gains skip_fy_filter and date-field support as a side effect,
  // which it previously lacked. Defaults the year column to 'bfy' as before.
  const where = buildSocrataWhere(
    { fiscal_year_column: 'bfy', ...cm }, fiscalYear, ds.default_filters);

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

  // Zero-total guard: refuse to persist an all-zero budget. A $0 computed total
  // (or every row dropped as zero) almost always means a column_mapping mistake —
  // typically `approved_amount_column` pointing at an empty/non-existent column, as
  // happened with LA City revenue (Socrata vvm4-a2zu had no actual-amount column and
  // silently wrote ~1,500 zeroed fund rows). Fail LOUD here, BEFORE the destructive
  // delete below, so a misconfigured sync can neither wipe good data nor persist zeros.
  if (total <= 0 || kept === 0) {
    console.error(
      `  ✗ ABORT: ${ds.name} FY${fiscalYear} computed total is $0 ` +
      `(kept=${kept}, droppedZero=${droppedZero}). Refusing to write an all-zero budget — ` +
      `check column_mapping.approved_amount_column (and actual_amount_column) for this source. ` +
      `No rows were deleted or written.`,
    );
    return { rows_fetched: allRows.length, rows_inserted: 0, status: 'zero_total_abort' };
  }

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
    p_basis: basis,
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

  // ⚠ Filter SERVER-side via treasury_list_sources, NOT client-side over
  // treasury_list_source_ids. The latter returns all 1,811 enabled sources, and
  // PostgREST truncates the response at db-max-rows = 1000 — ordered by
  // `priority DESC, name`, so the cut is ALPHABETICAL, landing at "Norwell — MA
  // General Fund Expenditures". San Francisco, Sacramento, San Diego, Seattle,
  // Portland, Oakland and West Hollywood all sort after it and were simply
  // absent from this list: `--list` showed 5 budget sources where 11 exist, and
  // the sync orchestrator never enumerated them, so they never synced at all.
  const { data: sources, error } = await supabase.rpc('treasury_list_sources', {
    p_api_type: 'socrata',
    p_dataset_types: ['operating', 'revenue'],
  });
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  // A result sitting exactly on the cap is truncation until proven otherwise.
  if ((sources || []).length === 1000) {
    console.error('Refusing to proceed: source listing returned exactly 1000 rows, ' +
                  'which is PostgREST db-max-rows. Narrow the filter or paginate.');
    process.exit(1);
  }

  const budgetSources = sources || [];

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
