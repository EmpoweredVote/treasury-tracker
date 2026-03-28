#!/usr/bin/env node
/**
 * Bulk Transaction Loader for Treasury Tracker
 *
 * Downloads CSV data from Socrata APIs and bulk-inserts into Supabase
 * via the treasury_sync_transactions RPC. Much faster than paginated
 * Edge Function calls for large/historical datasets.
 *
 * Usage:
 *   node scripts/bulkLoadTransactions.js                    # Load all configured sources
 *   node scripts/bulkLoadTransactions.js --source "LA City Checkbook" --fy 2025
 *   node scripts/bulkLoadTransactions.js --source "LA City Checkbook" --fy 2024 --fy 2025
 *
 * Env vars (from .env.local or exported):
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key (sb_secret_ or JWT format)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

// ── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Socrata CSV/JSON fetcher ────────────────────────────────────────────
async function fetchSocrataCount(baseUrl, datasetId, where) {
  const url = `${baseUrl}/resource/${datasetId}.json?$select=count(*)&$where=${encodeURIComponent(where)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
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

// ── Amount parser ───────────────────────────────────────────────────────
function amt(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Build compact transaction batch for RPC ─────────────────────────────
function buildBatch(rows, cm) {
  const vendors = new Set();
  const ridCol = cm.source_row_id_column; // e.g. "transaction_id" for LA, "demand" for WeHo
  const txns = rows.map(r => {
    const vn = r[cm.vendor_column] || 'Unknown';
    vendors.add(vn);
    return {
      a: amt(r[cm.amount_column]), d: r[cm.description_column] || null,
      dt: r[cm.date_column] || null, pm: r[cm.payment_method_column] || null,
      inv: r[cm.invoice_number_column] || null, f: r[cm.fund_column] || null,
      ec: r[cm.expense_category_column] || null, dept: r[cm.department_column] || null,
      prog: r[cm.program_column] || null, vn,
      lk: [r[cm.department_column], r[cm.fund_column], r[cm.expense_category_column]]
        .filter(Boolean).join('|') || null,
      rid: ridCol ? r[ridCol] || null : null, // source unique row ID for dedup
    };
  });
  return { vendors: [...vendors].map(n => ({ n })), transactions: txns };
}

// ── Main sync logic ─────────────────────────────────────────────────────
async function syncSource(ds, fiscalYear) {
  const cm = ds.column_mapping;
  const fyCol = cm.fiscal_year_column || 'fiscal_year';
  const where = `${fyCol}='${fiscalYear}'`;

  // Get total count
  const totalCount = await fetchSocrataCount(ds.base_url, ds.dataset_id, where);
  console.log(`\n📊 ${ds.name} FY${fiscalYear}: ${totalCount.toLocaleString()} total rows`);

  if (totalCount === 0) {
    console.log('  ⏭️  No data for this fiscal year');
    return { rows_fetched: 0, rows_inserted: 0, status: 'empty' };
  }

  const PAGE_SIZE = 5000;
  const RPC_BATCH = 5000; // Send to RPC in 5K chunks
  let offset = 0;
  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  while (offset < totalCount) {
    // Fetch a page
    const rows = await fetchSocrataPage(ds.base_url, ds.dataset_id, offset, PAGE_SIZE, where, cm.date_column);
    totalFetched += rows.length;

    if (rows.length === 0) break;

    // Build compact batch and send to RPC
    const { vendors, transactions } = buildBatch(rows, cm);

    const { data, error } = await supabase.rpc('treasury_sync_transactions', {
      p_data_source_id: ds.id,
      p_fiscal_year: fiscalYear,
      p_vendors: vendors,
      p_transactions: transactions,
      p_row_count: rows.length,
      p_triggered_by: 'bulk_load',
    });

    if (error) {
      console.error(`  ❌ RPC error at offset ${offset}: ${error.message}`);
      // Continue to next page instead of aborting
    } else {
      totalInserted += data?.rows_inserted || 0;
      totalSkipped += data?.rows_skipped || 0;
    }

    offset += rows.length;
    const pct = Math.round((offset / totalCount) * 100);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(totalFetched / (elapsed / 60));
    process.stdout.write(`\r  📥 ${offset.toLocaleString()}/${totalCount.toLocaleString()} (${pct}%) | +${totalInserted.toLocaleString()} new, ${totalSkipped.toLocaleString()} skipped | ${elapsed}s | ${rate.toLocaleString()}/min`);

    if (rows.length < PAGE_SIZE) break;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  ✅ Done in ${elapsed}s: ${totalFetched.toLocaleString()} fetched, ${totalInserted.toLocaleString()} inserted, ${totalSkipped.toLocaleString()} skipped`);

  return { rows_fetched: totalFetched, rows_inserted: totalInserted, rows_skipped: totalSkipped, duration_s: elapsed };
}

// ── CLI ─────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: 'string', short: 's' },
      fy: { type: 'string', short: 'y', multiple: true },
      'list': { type: 'boolean', short: 'l' },
      'all-types': { type: 'boolean' }, // Include salary/budget too, not just transactions
    },
    strict: false,
  });

  // Get all data sources
  const { data: sources, error } = await supabase.rpc('treasury_list_source_ids');
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  const socraSources = sources.filter(s => s.api_type === 'socrata');

  if (values.list) {
    console.log('\n📋 Available Socrata data sources:\n');
    for (const s of socraSources) {
      console.log(`  ${s.name} (${s.dataset_type}) — FYs: ${s.fiscal_years?.join(', ') || 'current'}`);
    }
    return;
  }

  // Filter to target sources
  let targets = socraSources;
  if (values.source) {
    targets = targets.filter(s => s.name.toLowerCase().includes(values.source.toLowerCase()));
  }
  if (!values['all-types']) {
    // Default to just transaction sources (the big ones that benefit from bulk load)
    targets = targets.filter(s => s.dataset_type === 'transactions');
  }

  if (targets.length === 0) {
    console.log('No matching sources found. Use --list to see available sources.');
    return;
  }

  console.log(`\n🚀 Bulk loading ${targets.length} source(s)...\n`);

  for (const src of targets) {
    // Get full config
    const { data: ds } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: src.id });
    if (!ds) { console.error(`  ❌ Config not found for ${src.name}`); continue; }

    // Determine fiscal years
    const fiscalYears = values.fy
      ? values.fy.map(Number)
      : (ds.fiscal_years || [new Date().getFullYear()]);

    for (const fy of fiscalYears) {
      await syncSource(ds, fy);
    }
  }

  console.log('\n🎉 Bulk load complete!\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
