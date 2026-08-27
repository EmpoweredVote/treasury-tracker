#!/usr/bin/env node
/**
 * San Diego CSV Budget Loader
 *
 * Loads operating expense and revenue budget data from San Diego's static CSV
 * endpoint at seshat.datasd.org into treasury.budgets + treasury.budget_categories
 * via the treasury_sync_budget_tree RPC.
 *
 * Source CSV: https://seshat.datasd.org/operating_budget/budget_operating_datasd.csv
 * (single file; revenue + expense rows distinguished by account_number prefix:
 *  4xxxxx = revenue, 5xxxxx = expense / operating)
 *
 * Data-driven: the loader reads field positions and which dataset_type to emit
 * entirely from the treasury.data_sources row for the named source. Adding a new
 * city with the same CSV shape would only require a new data_sources row.
 *
 * Usage:
 *   node scripts/loadSanDiegoCSV.js --list
 *   node scripts/loadSanDiegoCSV.js --source "San Diego Operating" --fy 2025
 *   node scripts/loadSanDiegoCSV.js --source "San Diego" --fy 2025 --fy 2026
 *   node scripts/loadSanDiegoCSV.js --source "San Diego" --dry-run --fy 2025
 *
 * Env vars:
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CSV fetch helper ─────────────────────────────────────────────────────────
const SD_CSV_URL = 'https://seshat.datasd.org/operating_budget/budget_operating_datasd.csv';

async function fetchSanDiegoCSV() {
  const resp = await fetch(SD_CSV_URL, { headers: { Accept: 'text/csv' } });
  if (!resp.ok) throw new Error(`San Diego CSV ${resp.status}: ${resp.statusText}`);
  return await resp.text();
}

// ── CSV parser ───────────────────────────────────────────────────────────────
// Parse a CSV string into an array of row objects keyed by header name.
// Handles quoted fields containing commas and escaped quotes ("").
function parseCSV(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return rows;

  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cur += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else { cur += c; }
      }
    }
    out.push(cur);
    return out;
  };

  const header = parseLine(lines[0]).map(h => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = cols[j] ?? '';
    rows.push(obj);
  }
  return rows;
}

// ── Amount parser ────────────────────────────────────────────────────────────
function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Tree builder ─────────────────────────────────────────────────────────────
function buildBudgetTree(rows, cm) {
  const catCol = cm.category_column;
  const subCol = cm.subcategory_column;
  const approvedCol = cm.approved_amount_column;
  const actualCol = cm.actual_amount_column || null;
  const fundCol = cm.fund_column || null;

  if (!catCol || !approvedCol) {
    throw new Error('column_mapping must define category_column and approved_amount_column');
  }

  const tree = new Map();
  let total = 0;
  let kept = 0;
  let droppedZero = 0;

  for (const row of rows) {
    const approved = parseAmount(row[approvedCol]);
    const actual = actualCol ? parseAmount(row[actualCol]) : null;

    // Drop rows where both approved AND actual are 0
    if (approved === 0 && (actual === null || actual === 0)) {
      droppedZero++;
      continue;
    }

    const cat = row[catCol] || 'Unknown';
    const sub = subCol ? (row[subCol] || 'General') : 'General';

    if (!tree.has(cat)) tree.set(cat, new Map());
    if (!tree.get(cat).has(sub)) tree.get(cat).set(sub, []);

    tree.get(cat).get(sub).push({
      d: sub,
      // ⚠ aa -> approved_amount, a -> actual_amount in _treasury_insert_tree.
      // See the contract note in scripts/buildBudgetTree.mjs; these were swapped
      // until 2026-08-27, which stored the budget in actual_amount.
      a: actual,
      aa: approved,
      f: fundCol ? (row[fundCol] || null) : null,
      e: null,
    });

    total += approved;
    kept++;
  }

  // Convert Maps to compact JSON tree
  const jsonTree = [];
  for (const [catName, subs] of tree) {
    let catTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.aa, 0);
      catTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  return { jsonTree, total, kept, droppedZero };
}

// ── SD-specific row filter ───────────────────────────────────────────────────
// Filter the parsed CSV to the rows that belong to this load:
//   - budget_cycle === 'adopted' (skip 'proposed', etc.)
//   - report_fy matches the 2-digit slice of fiscalYear (2025 -> "25", 2026 -> "26")
//   - account_number prefix matches the dataset_type:
//       operating -> '5xxxxx' (expense)
//       revenue   -> '4xxxxx'
function filterSanDiegoRows(rows, cm, fiscalYear, datasetType) {
  const fy2 = String(fiscalYear).slice(-2);             // 2025 -> "25"
  const accountPrefix = datasetType === 'revenue' ? '4' : '5';
  const cycleCol = cm.budget_cycle_column || 'budget_cycle';
  const fyCol = cm.fiscal_year_column || 'report_fy';
  const acctCol = cm.account_number_column || 'account_number';
  const cycleValue = (cm.budget_cycle_value || 'adopted').toLowerCase();

  return rows.filter(r => {
    if ((r[cycleCol] || '').trim().toLowerCase() !== cycleValue) return false;
    if (String(r[fyCol] || '').trim() !== fy2) return false;
    const acct = String(r[acctCol] || '').trim();
    return acct.length > 0 && acct[0] === accountPrefix;
  });
}

// ── Per-source sync ──────────────────────────────────────────────────────────
async function syncSanDiegoSource(ds, fiscalYear, opts, allRowsCache) {
  const cm = ds.column_mapping || {};

  // Use the shared CSV cache so we don't re-download the whole CSV per source/year.
  const rows = allRowsCache.rows;

  const matched = filterSanDiegoRows(rows, cm, fiscalYear, ds.dataset_type);
  console.log(`\n${ds.name} FY${fiscalYear}: ${matched.length.toLocaleString()} rows after filter (adopted, fy=${String(fiscalYear).slice(-2)}, account ${ds.dataset_type === 'revenue' ? '4xxxxx' : '5xxxxx'})`);

  if (matched.length === 0) {
    console.log('  (no data for this fiscal year)');
    return { rows_fetched: 0, rows_inserted: 0, status: 'empty' };
  }

  const { jsonTree, total, kept, droppedZero } = buildBudgetTree(matched, cm);
  console.log(`  built tree: ${kept} kept, ${droppedZero} zero-amount rows dropped, total $${Math.round(total).toLocaleString()}`);
  console.log(`  top-level categories: ${jsonTree.length}`);

  if (opts.dryRun) {
    console.log('  (dry run — skipping RPC call)');
    for (const c of jsonTree.slice(0, 3)) {
      console.log(`    ${c.n}: $${Math.round(c.a).toLocaleString()} (${c.c.length} subcategories)`);
    }
    return { rows_fetched: matched.length, rows_inserted: 0, status: 'dry_run' };
  }

  const { data, error } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: fiscalYear,
    p_dataset_type: ds.dataset_type,
    p_total: total,
    p_tree: jsonTree,
    p_row_count: matched.length,
    p_triggered_by: 'bulk_load',
  });

  if (error) {
    console.error(`  RPC error: ${error.message}`);
    return { rows_fetched: matched.length, rows_inserted: 0, status: 'error', error: error.message };
  }
  console.log(`  inserted ${data?.rows_inserted || 0} line items`);
  return { rows_fetched: matched.length, rows_inserted: data?.rows_inserted || 0, status: 'ok' };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
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

  const sdSources = (sources || []).filter(
    s => s.api_type === 'csv_download' && ['operating', 'revenue'].includes(s.dataset_type)
  );

  if (values.list) {
    console.log('\nAvailable San Diego CSV budget data sources:\n');
    for (const s of sdSources) console.log(`  ${s.name} (${s.dataset_type}) — FYs: ${(s.fiscal_years || []).join(', ') || 'current'}`);
    return;
  }

  let targets = sdSources;
  if (values.source) {
    const needle = values.source.toLowerCase();
    targets = targets.filter(s => s.name.toLowerCase().includes(needle));
  }
  if (targets.length === 0) {
    console.log('No matching San Diego CSV budget sources found. Use --list to see available sources.');
    return;
  }

  console.log(`\nDownloading San Diego CSV from ${SD_CSV_URL} ...`);
  const csvText = await fetchSanDiegoCSV();
  console.log(`  ${csvText.length.toLocaleString()} bytes`);

  console.log('Parsing CSV ...');
  const allRows = parseCSV(csvText);
  console.log(`  ${allRows.length.toLocaleString()} rows`);
  const cache = { rows: allRows };

  console.log(`\nLoading ${targets.length} San Diego CSV budget source(s)...\n`);
  const results = [];
  for (const src of targets) {
    const { data: ds } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: src.id });
    if (!ds) { console.error(`  Config not found for ${src.name}`); continue; }
    const fiscalYears = values.fy ? values.fy.map(Number) : (ds.fiscal_years || [new Date().getFullYear()]);
    for (const fy of fiscalYears) {
      const r = await syncSanDiegoSource(ds, fy, { dryRun: values['dry-run'] }, cache);
      results.push({ source: ds.name, fy, ...r });
    }
  }

  console.log('\n--- Summary ---');
  for (const r of results) console.log(`  ${r.source} FY${r.fy}: ${r.status} — ${r.rows_fetched} rows fetched, ${r.rows_inserted} inserted`);
  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
