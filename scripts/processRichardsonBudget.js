#!/usr/bin/env node
/**
 * Richardson TX Operating Budget Extractor
 *
 * Loads General Fund operating expenditures from Richardson's downloadable XLSX
 * budget files for FY2018–FY2026 (no FY2023 — file not available).
 *
 * Two XLSX layouts are handled:
 *
 * "Old" format (FY2018–FY2022):
 *   Columns (1-indexed): Fund | Fund Description | Dept | Div | Dept/Div Name | Account | Account Desc | Budget
 *   General Fund = Fund 11
 *   Department totals found via "Total DEPTNAME" rows in the Fund Description column.
 *
 * "New24" format (FY2024):
 *   Columns: Account | Account Description | Org Description | CharCode | Actual | Budget22-23 | Est | Budget23-24
 *   GF accounts start with "0110-"; Org Description = "01100110 - CITY SECRETARY" style.
 *   Budget column = col 8 (FY 2023-24 Budget)
 *
 * "New25" format (FY2025):
 *   Columns: Account | Account Description | Org Description | Actual | Budget23-24 | Est | Budget24-25
 *   Budget column = col 7 (FY 2024-25 Budget)
 *
 * "FY26" format:
 *   Columns: Fund | Account | Account Description | Org/Division | Org/Division Name | Actuals | Budget24-25 | Est | Budget25-26
 *   GF = Fund "0110"; Budget column = col 9 (FY 2025-2026 Budget)
 *
 * Usage:
 *   node scripts/processRichardsonBudget.js                  # load all FYs to DB
 *   node scripts/processRichardsonBudget.js --dry-run        # parse + print, no DB write
 *   node scripts/processRichardsonBudget.js --verbose        # log parse decisions
 *   node scripts/processRichardsonBudget.js --fy 2026        # single FY
 *   node scripts/processRichardsonBudget.js --dry-run --fy 2026 --verbose
 */

import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Per-FY configuration ───────────────────────────────────────────────────────
// format: 'old' = FY2018-2022, 'new24' = FY2024, 'new25' = FY2025, 'fy26' = FY2026
const FY_CONFIG = {
  2018: {
    file: 'docs/Richardson/FY 2018 Downloadable Budget.xlsx',
    expenseSheet: 'Expenses',
    format: 'old',
    budgetCol: '2017-2018 Approved Budget',
    actualsCol: null,
    existingDsId: null,
  },
  2019: {
    file: 'docs/Richardson/2019 Approved Budget FINAL.xlsx',
    expenseSheet: 'Expenses',
    format: 'old',
    budgetCol: '2018-2019 Approved Budget',
    actualsCol: null,
    existingDsId: null,
  },
  2020: {
    file: 'docs/Richardson/2020 Approved Budget FINAL.xlsx',
    expenseSheet: 'Expenses',
    format: 'old',
    budgetCol: '2019-20 Approved  Budget',
    actualsCol: null,
    existingDsId: null,
  },
  2021: {
    file: 'docs/Richardson/2021 Approved Budget Final.xlsx',
    expenseSheet: 'Expenses',
    format: 'old',
    budgetCol: '2020-21 Approved Budget',
    actualsCol: null,
    existingDsId: null,
  },
  2022: {
    file: 'docs/Richardson/2021-2022 Downloadable Budget.xlsx',
    expenseSheet: 'Expenses',
    format: 'old',
    budgetCol: '2021-2022 City Manager Proposed',
    actualsCol: null,
    existingDsId: null,
  },
  // FY2023: no file available — skipped
  2024: {
    file: 'docs/Richardson/FY24 Downloadable Budget Updated.xlsx',
    expenseSheet: 'Expenses',
    format: 'new24',
    budgetCol: 'FY 2023-24 Budget',    // col 8 (1-indexed via getCell)
    actualsCol: 'FY 2021-22 Actual',   // col 5
    existingDsId: null,                // new insert
  },
  2025: {
    file: 'docs/Richardson/FY25 Downloadable Budget.xlsx',
    expenseSheet: 'Expenditures',
    format: 'new25',
    budgetCol: 'FY 2024-25 Budget',    // col 7
    actualsCol: 'FY 2022-23 Actual',   // col 4
    existingDsId: '56c689b1-3249-4f76-a368-af7bd5cd9c3f',  // existing placeholder
  },
  2026: {
    file: 'docs/Richardson/Richardson FY25-26 Budget (Downloadable).xlsx',
    expenseSheet: 'FY25-26 Budget - Expenses',
    format: 'fy26',
    budgetCol: 'FY 2025-2026 Budget',  // col 9
    actualsCol: 'FY 2023-2024 Actuals', // col 6
    existingDsId: '31622969-ec82-4a53-9c49-4eef328f86a8',  // existing placeholder
  },
};

// Sub-category total prefixes to skip in old format
// (these appear in Fund Description column as "Total Personal Services" etc.)
const SUBCATEGORY_PREFIXES = [
  'Total Personal',
  'Total Purch. Prof.',
  'Total Other Purch',
  'Total Supplies',
  'Total Property',
  'Total Capital',
  'Total TRANSFERS',
  'Total Other Fin',
  'Total Purch. Prop',
  'Total DEBT',
];

// ── Parse money value ──────────────────────────────────────────────────────────
function parseMoney(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const s = String(v).replace(/[$,\s]/g, '');
  if (!s || s === '-') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── Title-case a dept name for display ────────────────────────────────────────
function titleCase(s) {
  return s.trim()
    .toLowerCase()
    .replace(/(?:^|\s|[-\/])\S/g, c => c.toUpperCase())
    .replace(/\bTv\b/g, 'TV')
    .replace(/\bVs\b/g, 'vs.')
    .replace(/\bOr\b/g, 'or')
    .replace(/\bAnd\b/g, 'and')
    .replace(/\bOf\b/g, 'of')
    .replace(/\b&\b/g, '&');
}

// ── Resolve ExcelJS cell value (handles formula objects) ─────────────────────
function cellVal(cell) {
  const v = cell.value;
  if (v && typeof v === 'object' && 'formula' in v) return v.result ?? null;
  return v ?? null;
}

// ── Parse "old" format sheets (FY2018–FY2022) ─────────────────────────────────
// Row structure (.values array, 0=null, 1=Fund, 2=FundDesc, 3=Dept, 4=Div, 5=DeptName, 6=Account, 7=AccountDesc, 8=Budget):
//   - GF detail rows: v[1]=11, v[2]='GENERAL FUND', v[6]=<account_number>, v[8]=<amount>
//   - Dept total rows: v[1]=11, v[2]='Total DEPTNAME', v[5]=<deptName>, v[8]=<dept_total>
//
// Strategy: use "Total DEPTNAME" rows (pre-aggregated) — avoids double-counting sub-dept rows.
function parseOldFormat(ws, fy, config, verbose) {
  const deptData = new Map(); // rawName -> { adopted, actual }

  for (let i = 2; i <= ws.rowCount; i++) {
    const v = ws.getRow(i).values; // 0-indexed from null
    const fund = v[1];
    const fundDesc = typeof v[2] === 'string' ? v[2].trim() : '';
    const budget = parseMoney(v[8]);

    // Only GF rows
    if (fund !== 11) continue;

    // Look for "Total DEPTNAME" rows
    if (!fundDesc.startsWith('Total ')) continue;

    // Skip sub-category totals
    const isSubCat = SUBCATEGORY_PREFIXES.some(p => fundDesc.startsWith(p));
    if (isSubCat) continue;

    // Skip the overall "Total GENERAL FUND" row
    if (fundDesc === 'Total GENERAL FUND') continue;

    // Skip zero-total rows
    if (budget === null || budget === 0) {
      if (verbose) console.error(`[skip-zero] FY${fy} "${fundDesc}" budget=0`);
      continue;
    }

    // Extract dept name from "Total DEPTNAME"
    const rawName = fundDesc.replace(/^Total /, '').trim();

    // Handle duplicate dept total rows (e.g., TRAFFIC & TRANSPORTATION appears twice — keep larger)
    if (deptData.has(rawName)) {
      const existing = deptData.get(rawName).adopted;
      if (budget > existing) {
        if (verbose) console.error(`[dup-replace] FY${fy} "${rawName}": ${existing.toLocaleString()} -> ${budget.toLocaleString()}`);
        deptData.set(rawName, { adopted: budget, actual: null });
      }
      continue;
    }

    deptData.set(rawName, { adopted: budget, actual: null });
    if (verbose) console.error(`[dept] FY${fy} "${rawName}": $${Math.round(budget).toLocaleString()}`);
  }

  return deptData;
}

// ── Parse "new24" format (FY2024) ─────────────────────────────────────────────
// Columns (1-indexed via getCell):
//   1=Account, 2=AccountDesc, 3=OrgDesc(formula), 4=CharCode,
//   5=FY2021-22 Actual, 6=FY2022-23 Budget, 7=FY2022-23 Estimate, 8=FY2023-24 Budget
function parseNew24Format(ws, fy, config, verbose) {
  const orgTotals = new Map(); // orgName -> { adopted, actual }

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const account = cellVal(row.getCell(1));
    if (typeof account !== 'string' || !account.startsWith('0110-')) continue;
    if (account.includes('-767-')) continue; // skip transfers out

    const orgDesc = cellVal(row.getCell(3));
    const budget = parseMoney(cellVal(row.getCell(8)));   // FY 2023-24 Budget
    const actual = parseMoney(cellVal(row.getCell(5)));   // FY 2021-22 Actual

    if (typeof budget !== 'number') continue;

    // Extract org name from "01100110 - CITY SECRETARY"
    const match = String(orgDesc || '').match(/^\d+ - (.+)$/);
    const orgName = match ? match[1].trim() : String(orgDesc || '').trim();
    if (!orgName) continue;

    if (!orgTotals.has(orgName)) orgTotals.set(orgName, { adopted: 0, actual: 0 });
    const rec = orgTotals.get(orgName);
    rec.adopted += budget;
    rec.actual += (actual ?? 0);
  }

  return filterZeroOrgs(orgTotals, fy, verbose);
}

// ── Parse "new25" format (FY2025) ─────────────────────────────────────────────
// Columns (1-indexed):
//   1=Account, 2=AccountDesc, 3=OrgDesc, 4=FY2022-23 Actual,
//   5=FY2023-24 Budget, 6=FY2023-24 Estimate, 7=FY2024-25 Budget
function parseNew25Format(ws, fy, config, verbose) {
  const orgTotals = new Map();

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const account = cellVal(row.getCell(1));
    if (typeof account !== 'string' || !account.startsWith('0110-')) continue;
    if (account.includes('-767-')) continue;

    const orgDesc = cellVal(row.getCell(3));
    const budget = parseMoney(cellVal(row.getCell(7)));   // FY 2024-25 Budget
    const actual = parseMoney(cellVal(row.getCell(4)));   // FY 2022-23 Actual

    if (typeof budget !== 'number') continue;

    const match = String(orgDesc || '').match(/^\d+ - (.+)$/);
    const orgName = match ? match[1].trim() : String(orgDesc || '').trim();
    if (!orgName) continue;

    if (!orgTotals.has(orgName)) orgTotals.set(orgName, { adopted: 0, actual: 0 });
    const rec = orgTotals.get(orgName);
    rec.adopted += budget;
    rec.actual += (actual ?? 0);
  }

  return filterZeroOrgs(orgTotals, fy, verbose);
}

// ── Parse FY2026 format ────────────────────────────────────────────────────────
// Columns (1-indexed):
//   1=Fund, 2=Account, 3=AccountDesc, 4=OrgCode, 5=OrgName,
//   6=FY2023-2024 Actuals, 7=FY2024-2025 Budget, 8=FY2024-2025 Estimate, 9=FY2025-2026 Budget
function parseFY26Format(ws, fy, config, verbose) {
  const orgTotals = new Map();

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const fund = cellVal(row.getCell(1));
    if (fund !== '0110') continue;

    const account = cellVal(row.getCell(2));
    if (typeof account !== 'string' || account.includes('-767-')) continue;

    const orgName = String(cellVal(row.getCell(5)) || '').trim();
    if (!orgName) continue;

    const budget = parseMoney(cellVal(row.getCell(9)));   // FY 2025-2026 Budget
    const actual = parseMoney(cellVal(row.getCell(6)));   // FY 2023-2024 Actuals

    if (typeof budget !== 'number') continue;

    if (!orgTotals.has(orgName)) orgTotals.set(orgName, { adopted: 0, actual: 0 });
    const rec = orgTotals.get(orgName);
    rec.adopted += budget;
    rec.actual += (actual ?? 0);
  }

  return filterZeroOrgs(orgTotals, fy, verbose);
}

// ── Filter out zero-budget orgs and log them ──────────────────────────────────
function filterZeroOrgs(orgTotals, fy, verbose) {
  const result = new Map();
  for (const [name, { adopted, actual }] of orgTotals) {
    if (adopted === 0) {
      if (verbose) console.error(`[skip-zero] FY${fy} "${name}" budget=0`);
      continue;
    }
    result.set(name, { adopted, actual: actual || null });
    if (verbose) console.error(`[dept] FY${fy} "${name}": $${Math.round(adopted).toLocaleString()}`);
  }
  return result;
}

// ── Route to correct parser ───────────────────────────────────────────────────
function parseSheet(ws, fy, config, verbose) {
  switch (config.format) {
    case 'old':   return parseOldFormat(ws, fy, config, verbose);
    case 'new24': return parseNew24Format(ws, fy, config, verbose);
    case 'new25': return parseNew25Format(ws, fy, config, verbose);
    case 'fy26':  return parseFY26Format(ws, fy, config, verbose);
    default: throw new Error(`Unknown format "${config.format}" for FY${fy}`);
  }
}

// ── Build JSON tree for treasury_sync_budget_tree RPC ─────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  for (const [deptName, { adopted, actual }] of deptData) {
    if (!adopted || adopted === 0) continue;

    const displayName = titleCase(deptName);

    jsonTree.push({
      n: displayName,
      a: adopted,
      c: [{
        n: displayName,
        a: adopted,
        i: [{
          d: displayName,
          // ⚠ aa -> approved_amount, a -> actual_amount in _treasury_insert_tree.
          // NOTE the trap: the NODE key `a` above is the rollup amount (correctly the
          // adopted figure), but the ITEM key `a` is actual_amount. Same letter, two
          // meanings. This emitted `a: adopted, aa: actual` and so filed the adopted
          // budget as an actual — "Budgeted $0 / Actual $X" (PRs #85, #91, #92).
          a: (actual && actual !== 0) ? actual : null,
          aa: adopted,
          f: 'General Fund',
          e: null,
        }],
      }],
    });

    total += adopted;
  }

  // Sort by budget descending
  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total };
}

// ── Process a single fiscal year ──────────────────────────────────────────────
async function processFY(supabase, muniId, fiscalYear, dryRun, verbose) {
  const config = FY_CONFIG[fiscalYear];
  if (!config) throw new Error(`No config for FY${fiscalYear}`);

  const filePath = path.resolve(ROOT, config.file);
  console.log(`\nFY${fiscalYear}: ${config.file}`);

  // Read XLSX
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.worksheets.find(s => s.name === config.expenseSheet);
  if (!ws) {
    const sheetNames = wb.worksheets.map(s => s.name).join(', ');
    throw new Error(`Sheet "${config.expenseSheet}" not found. Available: ${sheetNames}`);
  }

  // Parse dept data
  const deptData = parseSheet(ws, fiscalYear, config, verbose);

  if (deptData.size === 0) {
    throw new Error(`No departments parsed — check sheet format`);
  }

  const { jsonTree, total } = buildTree(deptData);

  // Sanity check: Richardson GF should be $100M–$250M
  const SANITY_MIN = 100_000_000;
  const SANITY_MAX = 250_000_000;
  if (total < SANITY_MIN || total > SANITY_MAX) {
    throw new Error(`Sanity check failed: $${Math.round(total).toLocaleString()} outside $100M–$250M range`);
  }

  // Print summary line
  console.log(`  Departments: ${deptData.size}  |  GF Total: $${Math.round(total).toLocaleString()}`);

  // Verbose: print dept table
  if (verbose) {
    console.log('  ' + 'Department'.padEnd(48) + 'Adopted ($)'.padStart(16) + '  Actual ($)'.padStart(16));
    console.log('  ' + '─'.repeat(82));
    for (const node of jsonTree) {
      const aStr = Math.round(node.a).toLocaleString();
      // ⚠ ITEM `a` is the actual (aa is approved) — see the emission above. This read
      // `.aa` while labelling the column "Actual ($)", so the verbose table printed
      // the adopted budget twice and would have masked the swap being wrong.
      const actVal = node.c[0]?.i[0]?.a;
      const actStr = (actVal && actVal !== 0) ? Math.round(actVal).toLocaleString() : '—';
      console.log('  ' + node.n.padEnd(48) + aStr.padStart(16) + '  ' + actStr.padStart(16));
    }
    console.log('  ' + '─'.repeat(82));
    console.log('  ' + 'TOTAL'.padEnd(48) + Math.round(total).toLocaleString().padStart(16));
  }

  if (dryRun) {
    console.log(`  (dry-run — no DB writes)`);
    return { fy: fiscalYear, total, depts: deptData.size, status: 'DRY_RUN' };
  }

  // ── Upsert data_source ──────────────────────────────────────────────────────
  let dsId;

  if (config.existingDsId) {
    // FY2025/FY2026: update existing placeholder row (wrong api_type)
    const { error: upErr } = await supabase.schema('treasury').from('data_sources')
      .update({
        api_type: 'xlsx_download',
        base_url: 'local:' + config.file,
        fiscal_years: [fiscalYear],
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', config.existingDsId);
    if (upErr) throw new Error(`data_sources update failed: ${upErr.message}`);
    dsId = config.existingDsId;
    console.log(`  data_source updated: ${dsId}`);
  } else {
    // FY2018–FY2024: upsert by composite key (muni + dataset_id + dataset_type)
    const { data: existing } = await supabase.schema('treasury').from('data_sources')
      .select('id')
      .eq('municipality_id', muniId)
      .eq('dataset_id', 'fy' + fiscalYear)
      .eq('dataset_type', 'operating')
      .maybeSingle();

    if (existing?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('data_sources')
        .update({
          api_type: 'xlsx_download',
          base_url: 'local:' + config.file,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (upErr) throw new Error(`data_sources update failed: ${upErr.message}`);
      dsId = existing.id;
      console.log(`  data_source updated: ${dsId}`);
    } else {
      const { data: created, error: insErr } = await supabase.schema('treasury').from('data_sources')
        .insert({
          municipality_id: muniId,
          name: `Richardson Operating Budget FY${fiscalYear}`,
          api_type: 'xlsx_download',
          dataset_id: 'fy' + fiscalYear,
          dataset_type: 'operating',
          fiscal_years: [fiscalYear],
          base_url: 'local:' + config.file,
          last_synced_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insErr) throw new Error(`data_sources insert failed: ${insErr.message}`);
      dsId = created.id;
      console.log(`  data_source created: ${dsId}`);
    }
  }

  // ── Delete prior budget rows ────────────────────────────────────────────────
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('data_source_id', dsId)
    .eq('fiscal_year', fiscalYear);
  if (delErr) throw new Error(`Delete (by data_source_id) failed: ${delErr.message}`);

  // Also clear any orphaned rows for this muni+FY+type
  await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muniId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);

  // ── Call treasury_sync_budget_tree RPC ─────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId,
    p_fiscal_year: fiscalYear,
    p_dataset_type: 'operating',
    p_total: total,
    p_tree: jsonTree,
    p_row_count: deptData.size,
    p_triggered_by: 'bulk_load',
  });

  if (rpcErr) throw new Error(`RPC error: ${rpcErr.message}`);
  if (rpcResult?.error) throw new Error(`RPC returned error: ${rpcResult.error}`);

  const inserted = rpcResult?.rows_inserted ?? deptData.size;
  console.log(`  Loaded ${inserted} budget_categories rows`);

  return { fy: fiscalYear, total, depts: deptData.size, status: 'OK', dsId };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'verbose': { type: 'boolean', default: false },
      'fy':      { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const verbose = opts['verbose'];
  const fyArg = opts['fy'] ? parseInt(opts['fy'], 10) : null;

  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Municipality lookup
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Richardson').single();
  if (muniErr || !muni) {
    console.error('Could not find Richardson municipality:', muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'PRODUCTION'}\n`);

  // Determine which FYs to process
  const allFYs = Object.keys(FY_CONFIG).map(Number).sort((a, b) => a - b);
  const fys = fyArg ? [fyArg] : allFYs;

  if (fyArg && !FY_CONFIG[fyArg]) {
    console.error(`No config for FY${fyArg}. Available: ${allFYs.join(', ')}`);
    process.exit(2);
  }

  // Process each FY
  const results = [];
  for (const fy of fys) {
    try {
      const result = await processFY(supabase, muni.id, fy, dryRun, verbose);
      results.push(result);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ fy, total: 0, depts: 0, status: 'ERROR', error: err.message });
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  const POP = 120_000;
  console.log('\n' + '═'.repeat(72));
  console.log('Richardson Operating Budget — Load Summary');
  console.log('═'.repeat(72));
  console.log('FY    Status      Depts  Total GF Budget ($)   Per Capita (~120k pop)');
  console.log('─'.repeat(72));
  for (const r of results) {
    const totalStr = r.total ? Math.round(r.total).toLocaleString() : '—';
    const perCapStr = r.total ? '$' + Math.round(r.total / POP).toLocaleString() : '—';
    console.log(
      String(r.fy).padEnd(6) +
      r.status.padEnd(12) +
      String(r.depts).padStart(5) + '  ' +
      totalStr.padStart(22) + '  ' +
      perCapStr.padStart(8)
    );
  }
  console.log('─'.repeat(72));

  const failed = results.filter(r => r.status === 'ERROR' || r.status === 'SANITY_FAIL');
  if (failed.length > 0) {
    console.error(`\n${failed.length} FY(s) failed: ${failed.map(r => r.fy).join(', ')}`);
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
