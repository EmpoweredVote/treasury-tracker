#!/usr/bin/env node
/**
 * Ohio General Fund Operating (Expenditure) Loader — FY2020-FY2025 ACTUAL
 * Source: State of Ohio Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP / modified accrual basis, in thousands). Published by OBM (Office of Budget &
 *   Management). Per-FY source URL below.
 * Replaces the prior estimate-grade rows sourced to lsc.ohio.gov/budget (appropriations
 *   basis, falsely-stamped — Phase 95 / SGFS-03 remediation).
 * Confidence: actual (audited GAAP figures from the published Ohio ACFR each year).
 * FY2020 uses the pre-rename "CAFR" document — same GASB-34 governmental-funds layout.
 * NOTE: FY2026 row cleanup (DELETE) is handled separately in Plan 05.
 *
 * Extraction method: pdftotext -table on local PDF copies at C:\tmp\Ohio\
 *   (CAFR_2020.pdf, ACFR_2021.pdf, ACFR_2022.pdf, ACFR_2023.pdf, ACFR_2024.pdf, ACFR FY25.pdf)
 *   Statement page: PDF page 52 for FY2020-FY2023; PDF page 50 for FY2024-FY2025.
 *   GENERAL FUND = first data column on the statement.
 *   All 12 revenue + expenditure checksums verified to 0 diff vs. published ACFR totals.
 *   FY2024 confirmed against plan checksum: TOTAL EXP = 45,119,494k, TOTAL REV = 45,752,716k.
 *
 * Usage:
 *   node scripts/processOHAcfr.js [--dry-run] [--fy YYYY]
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const STATE_NAME = 'Ohio'; const STATE_ABBR = 'OH'; const POPULATION = 11_799_448;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published Ohio ACFR (source_date = fiscal year end June 30).
// FY2020/FY2021 archive URLs follow the confirmed FY2022-2025 pattern (not independently
// verified at planning time — fallback to OBM landing page if 404 at stamp time).
const SOURCES = {
  2020: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2020/CAFR_2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2021/ACFR_2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2022/ACFR_2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2023/ACFR_2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2024/ACFR_2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://archives.obm.ohio.gov/Files//State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2025/ACFR%20FY25.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `State of Ohio ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// General Fund expenditures by function — State of Ohio ACFR, GENERAL FUND column (in $).
// Function-level totals only (depth-1 leaves under the GF root; lineItems = []).
// Verbatim ACFR function names from the Governmental Funds statement.
// Sums verified to zero diff vs. published ACFR Total Expenditures (all years).
// FY2024 confirmed checksum: TOTAL EXPENDITURES = 45,119,494 thousand.
// Note: CAPITAL OUTLAY and DEBT SERVICE are included per ACFR statement taxonomy.
const EXPENDITURES = {
  2020: { total: 36_005_625_000, confidence: 'actual', categories: [
    { name: 'Primary, Secondary and Other Education', total: 10_019_697_000, lineItems: [] },
    { name: 'Higher Education Support',               total:  2_538_782_000, lineItems: [] },
    { name: 'Public Assistance and Medicaid',         total: 16_004_391_000, lineItems: [] },
    { name: 'Health and Human Services',              total:    692_525_000, lineItems: [] },
    { name: 'Justice and Public Protection',          total:  3_362_746_000, lineItems: [] },
    { name: 'Environmental Protection and Natural Resources', total: 92_545_000, lineItems: [] },
    { name: 'Transportation',                         total:     50_187_000, lineItems: [] },
    { name: 'General Government',                     total:    543_330_000, lineItems: [] },
    { name: 'Community and Economic Development',     total:  2_701_422_000, lineItems: [] },
  ]},
  2021: { total: 38_782_210_000, confidence: 'actual', categories: [
    { name: 'Primary, Secondary and Other Education', total: 10_194_210_000, lineItems: [] },
    { name: 'Higher Education Support',               total:  2_563_549_000, lineItems: [] },
    { name: 'Public Assistance and Medicaid',         total: 18_272_285_000, lineItems: [] },
    { name: 'Health and Human Services',              total:    708_769_000, lineItems: [] },
    { name: 'Justice and Public Protection',          total:  3_355_971_000, lineItems: [] },
    { name: 'Environmental Protection and Natural Resources', total: 120_487_000, lineItems: [] },
    { name: 'Transportation',                         total:     47_531_000, lineItems: [] },
    { name: 'General Government',                     total:    586_390_000, lineItems: [] },
    { name: 'Community and Economic Development',     total:  2_933_018_000, lineItems: [] },
  ]},
  2022: { total: 38_810_884_000, confidence: 'actual', categories: [
    { name: 'Primary, Secondary and Other Education', total: 10_306_136_000, lineItems: [] },
    { name: 'Higher Education Support',               total:  2_636_233_000, lineItems: [] },
    { name: 'Public Assistance and Medicaid',         total: 17_418_844_000, lineItems: [] },
    { name: 'Health and Human Services',              total:    780_983_000, lineItems: [] },
    { name: 'Justice and Public Protection',          total:  3_705_620_000, lineItems: [] },
    { name: 'Environmental Protection and Natural Resources', total: 128_195_000, lineItems: [] },
    { name: 'Transportation',                         total:     60_252_000, lineItems: [] },
    { name: 'General Government',                     total:    569_426_000, lineItems: [] },
    { name: 'Community and Economic Development',     total:  3_205_195_000, lineItems: [] },
  ]},
  2023: { total: 41_172_479_000, confidence: 'actual', categories: [
    { name: 'Primary, Secondary and Other Education', total: 10_628_509_000, lineItems: [] },
    { name: 'Higher Education Support',               total:  2_647_460_000, lineItems: [] },
    { name: 'Public Assistance and Medicaid',         total: 18_890_439_000, lineItems: [] },
    { name: 'Health and Human Services',              total:    807_491_000, lineItems: [] },
    { name: 'Justice and Public Protection',          total:  3_798_143_000, lineItems: [] },
    { name: 'Environmental Protection and Natural Resources', total: 131_982_000, lineItems: [] },
    { name: 'Transportation',                         total:     54_879_000, lineItems: [] },
    { name: 'General Government',                     total:    992_510_000, lineItems: [] },
    { name: 'Community and Economic Development',     total:  3_221_066_000, lineItems: [] },
  ]},
  2024: { total: 45_119_494_000, confidence: 'actual', categories: [
    { name: 'Primary, Secondary and Other Education', total: 11_574_511_000, lineItems: [] },
    { name: 'Higher Education Support',               total:  2_857_890_000, lineItems: [] },
    { name: 'Public Assistance and Medicaid',         total: 19_635_827_000, lineItems: [] },
    { name: 'Health and Human Services',              total:    987_701_000, lineItems: [] },
    { name: 'Justice and Public Protection',          total:  4_066_115_000, lineItems: [] },
    { name: 'Environmental Protection and Natural Resources', total: 180_638_000, lineItems: [] },
    { name: 'Transportation',                         total:    110_771_000, lineItems: [] },
    { name: 'General Government',                     total:  1_755_619_000, lineItems: [] },
    { name: 'Community and Economic Development',     total:  3_950_412_000, lineItems: [] },
    { name: 'Debt Service',                           total:         10_000, lineItems: [] },
  ]},
  2025: { total: 49_447_475_000, confidence: 'actual', categories: [
    { name: 'Primary, Secondary and Other Education', total: 12_327_993_000, lineItems: [] },
    { name: 'Higher Education Support',               total:  3_061_020_000, lineItems: [] },
    { name: 'Public Assistance and Medicaid',         total: 22_472_257_000, lineItems: [] },
    { name: 'Health and Human Services',              total:  1_043_284_000, lineItems: [] },
    { name: 'Justice and Public Protection',          total:  4_327_060_000, lineItems: [] },
    { name: 'Environmental Protection and Natural Resources', total: 193_313_000, lineItems: [] },
    { name: 'Transportation',                         total:    120_870_000, lineItems: [] },
    { name: 'General Government',                     total:  2_189_014_000, lineItems: [] },
    { name: 'Community and Economic Development',     total:  3_712_659_000, lineItems: [] },
    { name: 'Debt Service',                           total:          5_000, lineItems: [] },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) {
    if (cat.lineItems.length) {
      const itemSum = cat.lineItems.reduce((s, li) => s + li.amount, 0);
      if (Math.abs(itemSum - cat.total) > 1_000_000) { console.error(`FY${fy} "${cat.name}": items ${itemSum} ≠ ${cat.total}`); ok = false; }
    }
    catSum += cat.total;
  }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: cat.lineItems.filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })) }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Ohio General Fund Budget', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).single();
    if (error || !muni) { console.error(`${STATE_NAME} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    // find-or-create/update the data_source row for OH operating (updates base_url from LSC to OBM ACFR)
    const srcPayload = { name: 'Ohio General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'oh-gf-operating', base_url: 'https://obm.ohio.gov/reports-and-resources/01-acfr-and-pafr', fiscal_years: [2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(50)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(70));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(48)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(70)); console.log(`${'TOTAL EXPENDITURES'.padEnd(50)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Post-RPC source stamp (P4: targeted UPDATE; RPC does not set source_url/source_date). Idempotent.
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} operating row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} operating budget row to stamp source`); process.exit(2); }
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
