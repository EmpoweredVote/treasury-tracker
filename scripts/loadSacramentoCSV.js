#!/usr/bin/env node
/**
 * Sacramento CSV Budget Loader
 *
 * Loads operating expense and revenue budget data from Open Budget Sacramento's
 * GitHub repository into treasury.budgets + treasury.budget_categories via the
 * treasury_sync_budget_tree RPC.
 *
 * Source CSVs: https://raw.githubusercontent.com/opensacorg/openbudgetsac.org/main/_src/data/flow/FY{YY}.csv
 * (one file per fiscal year; expense and revenue rows in the same file,
 *  distinguished by ExpenseRevenue: "E" = expense/operating, "R" = revenue)
 *
 * Attribution: Open Budget Sacramento (https://openbudgetsac.org), MIT license
 *
 * CSV columns:
 *   Fiscal_Year, Department, Fund, CATEGORY, Amount, ExpenseRevenue, Fund_Category, ObjectId
 *
 * Usage:
 *   node scripts/loadSacramentoCSV.js --list
 *   node scripts/loadSacramentoCSV.js --fy 2025
 *   node scripts/loadSacramentoCSV.js --fy 2013 --fy 2014 --fy 2025 --fy 2026
 *   node scripts/loadSacramentoCSV.js --dry-run --fy 2025
 *
 * Env vars:
 *   SUPABASE_URL         - Supabase project URL
 *   SUPABASE_SERVICE_KEY - Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ──────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();

// ── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// FY2013 is "FY13" in the GitHub filenames; 4-digit year → 2-digit suffix
const GITHUB_BASE = 'https://raw.githubusercontent.com/opensacorg/openbudgetsac.org/main/_src/data/flow';

function flowCsvUrl(fiscalYear) {
  const yy = String(fiscalYear).slice(-2);
  return `${GITHUB_BASE}/FY${yy}.csv`;
}

// Fiscal years available in the Open Budget Sacramento repo
const ALL_FISCAL_YEARS = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

// ── CSV fetch ────────────────────────────────────────────────────────────────
async function fetchFlowCSV(fiscalYear) {
  const url = flowCsvUrl(fiscalYear);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`FY${fiscalYear} CSV fetch failed: ${resp.status} ${resp.statusText} — ${url}`);
  return { text: await resp.text(), url };
}

// ── CSV parser ───────────────────────────────────────────────────────────────
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
    if (cols.every(c => !c.trim())) continue; // skip blank lines
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = (cols[j] ?? '').trim();
    rows.push(obj);
  }
  return rows;
}

// ── Amount parser ─────────────────────────────────────────────────────────────
function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Tree builder ──────────────────────────────────────────────────────────────
// Sacramento flow CSV schema:
//   Department  → top-level category
//   CATEGORY    → subcategory
//   Amount      → approved budget amount
//   Fund        → fund (stored as fund field)
function buildBudgetTree(rows) {
  const tree = new Map();
  let total = 0;
  let kept = 0;
  let droppedZero = 0;

  for (const row of rows) {
    const approved = parseAmount(row['Amount']);
    if (approved === 0) { droppedZero++; continue; }

    const cat = (row['Department'] || 'Unknown').trim();
    const sub = (row['CATEGORY'] || 'General').trim();
    const fund = (row['Fund'] || null);

    if (!tree.has(cat)) tree.set(cat, new Map());
    if (!tree.get(cat).has(sub)) tree.get(cat).set(sub, []);

    // ⚠ aa -> approved_amount, a -> actual_amount in _treasury_insert_tree. See the
    // contract note in scripts/buildBudgetTree.mjs. Sacramento publishes no actuals,
    // so `a` is null and the budget belongs in `aa`.
    tree.get(cat).get(sub).push({ d: sub, a: null, aa: approved, f: fund, e: null });
    total += approved;
    kept++;
  }

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

// ── Sacramento data_source + source_registry lookup ──────────────────────────
let _dsCache = null;
async function getDataSources() {
  if (_dsCache) return _dsCache;

  // ⚠ NOT treasury_list_source_ids. That RPC returns every enabled source, and
  // PostgREST truncates the response at db-max-rows = 1000 ordered by name, so the
  // cut is ALPHABETICAL — it currently lands at "Norwood — MA DLS General Fund
  // Revenue by Source". Both Sacramento sources sort after it and were simply absent
  // from the list, so this loader exited with "run seedSacramentoCA.js first" against
  // rows that already existed. Verified over HTTP: the call returns exactly 1000 rows
  // and contains neither Sacramento source.
  const { data: sources, error } = await supabase.rpc('treasury_list_sources', {
    p_api_type: 'csv_download',
    p_dataset_types: ['operating', 'revenue'],
  });
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }

  // A result sitting exactly on the cap is truncation until proven otherwise.
  if ((sources || []).length === 1000) {
    console.error('Refusing to proceed: source listing returned exactly 1000 rows, ' +
                  'which is PostgREST db-max-rows. Narrow the filter or paginate.');
    process.exit(1);
  }

  const operating = (sources || []).find(s => s.name === 'Sacramento Operating Budget');
  const revenue   = (sources || []).find(s => s.name === 'Sacramento Revenue Budget');
  if (!operating || !revenue) {
    console.error('Sacramento data_sources rows not found — run scripts/seedSacramentoCA.js first');
    process.exit(1);
  }

  // Also get the source_registry id for attribution backfill
  const { data: sr } = await supabase
    .schema('treasury')
    .from('source_registry')
    .select('id')
    .eq('name', 'open-budget-sacramento')
    .maybeSingle();

  _dsCache = { operating, revenue, sourceRegistryId: sr?.id ?? null };
  return _dsCache;
}

// ── Per-year sync ─────────────────────────────────────────────────────────────
async function syncYear(fiscalYear, datasetType, dryRun) {
  const { operating, revenue, sourceRegistryId } = await getDataSources();
  const ds = datasetType === 'revenue' ? revenue : operating;

  let csvText, csvUrl;
  try {
    ({ text: csvText, url: csvUrl } = await fetchFlowCSV(fiscalYear));
  } catch (err) {
    console.log(`  (skipped — ${err.message})`);
    return { status: 'skipped', rows_fetched: 0, rows_inserted: 0 };
  }

  const allRows = parseCSV(csvText);
  if (allRows.length === 0) {
    console.log('  (no data)');
    return { status: 'empty', rows_fetched: 0, rows_inserted: 0 };
  }

  // Detect schema: newer files (FY2019+) use ExpenseRevenue col with "E"/"Expenses"/"R"/"Revenues"
  // Older files (FY2013-FY2018) use account_type col with "Expenses"/"Revenues"
  const firstRow = allRows[0];
  let rows;
  if ('ExpenseRevenue' in firstRow) {
    // Newer schema — values are "E"/"R" (FY2024) or "Expenses"/"Revenues" (FY2025+)
    const expVal = datasetType === 'revenue' ? ['r', 'revenues'] : ['e', 'expenses'];
    rows = allRows.filter(r => expVal.includes((r['ExpenseRevenue'] || '').trim().toLowerCase()));
  } else if ('account_type' in firstRow) {
    // Older schema (FY2013-FY2018) — remap columns to match buildBudgetTree expectations
    const typeMatch = datasetType === 'revenue' ? 'revenues' : 'expenses';
    const matched = allRows.filter(r => (r['account_type'] || '').trim().toLowerCase() === typeMatch);
    // Remap: department → Department, account_category → CATEGORY, amount → Amount, fund → Fund
    rows = matched.map(r => ({
      Department: r['department'] || 'Unknown',
      CATEGORY:   r['account_category'] || r['account_description'] || 'General',
      Amount:     r['amount'] || '0',
      Fund:       r['fund'] || null,
    }));
  } else {
    console.log('  (unrecognized CSV schema — skipping)');
    return { status: 'skipped', rows_fetched: allRows.length, rows_inserted: 0 };
  }

  console.log(`\nSacramento ${datasetType} FY${fiscalYear}: ${rows.length.toLocaleString()} rows from ${allRows.length.toLocaleString()} total`);

  if (rows.length === 0) {
    console.log('  (no data)');
    return { status: 'empty', rows_fetched: 0, rows_inserted: 0 };
  }

  const { jsonTree, total, kept, droppedZero } = buildBudgetTree(rows);
  console.log(`  built tree: ${kept} kept, ${droppedZero} zero-amount rows dropped, total $${Math.round(total).toLocaleString()}`);
  console.log(`  top-level categories: ${jsonTree.length}`);

  if (dryRun) {
    console.log('  (dry run — skipping RPC)');
    for (const c of jsonTree.slice(0, 3)) {
      console.log(`    ${c.n}: $${Math.round(c.a).toLocaleString()} (${c.c.length} subcategories)`);
    }
    return { status: 'dry_run', rows_fetched: rows.length, rows_inserted: 0 };
  }

  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: fiscalYear,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: jsonTree,
    p_row_count: rows.length,
    p_triggered_by: 'bulk_load',
  });

  if (rpcErr) {
    console.error(`  RPC error: ${rpcErr.message}`);
    return { status: 'error', rows_fetched: rows.length, rows_inserted: 0, error: rpcErr.message };
  }

  // Backfill source_registry on the budget row for UI attribution ("Data sourced from Open Budget Sacramento")
  if (sourceRegistryId) {
    await supabase
      .schema('treasury')
      .from('budgets')
      .update({ data_source_id: sourceRegistryId })
      .eq('municipality_id', ds.municipality_id)
      .eq('fiscal_year', fiscalYear)
      .eq('dataset_type', datasetType);
  }

  console.log(`  inserted ${rpcResult?.rows_inserted ?? 0} line items`);
  return { status: 'ok', rows_fetched: rows.length, rows_inserted: rpcResult?.rows_inserted ?? 0 };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      fy:         { type: 'string', short: 'y', multiple: true },
      list:       { type: 'boolean', short: 'l' },
      'dry-run':  { type: 'boolean' },
      operating:  { type: 'boolean' },
      revenue:    { type: 'boolean' },
    },
    strict: false,
  });

  if (values.list) {
    console.log('\nAvailable Sacramento fiscal years:');
    console.log(' ', ALL_FISCAL_YEARS.join(', '));
    console.log('\nData sourced from Open Budget Sacramento (https://openbudgetsac.org), MIT license');
    console.log('GitHub: https://github.com/opensacorg/openbudgetsac.org\n');
    return;
  }

  const fiscalYears = values.fy ? values.fy.map(Number) : ALL_FISCAL_YEARS;
  const types = values.operating ? ['operating'] : values.revenue ? ['revenue'] : ['operating', 'revenue'];
  const dryRun = values['dry-run'] ?? false;

  console.log(`\nLoading Sacramento budget data (Open Budget Sacramento)`);
  console.log(`  Fiscal years: ${fiscalYears.join(', ')}`);
  console.log(`  Dataset types: ${types.join(', ')}`);
  if (dryRun) console.log('  DRY RUN — no data will be written\n');

  const results = [];
  for (const fy of fiscalYears) {
    for (const type of types) {
      const r = await syncYear(fy, type, dryRun);
      results.push({ fy, type, ...r });
    }
  }

  console.log('\n--- Summary ---');
  for (const r of results) {
    console.log(`  Sacramento ${r.type} FY${r.fy}: ${r.status} — ${r.rows_fetched} rows fetched, ${r.rows_inserted} inserted`);
  }
  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
