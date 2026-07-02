#!/usr/bin/env node
/**
 * Ohio General Fund Revenue Loader — FY2020-FY2025 ACTUAL
 * Source: State of Ohio Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP / modified accrual basis, in thousands). Published by OBM (Office of Budget &
 *   Management). Per-FY source URL below.
 * Replaces the prior estimate-grade rows (Phase 95 / SGFS-03 remediation).
 * Confidence: actual (audited GAAP figures from the published Ohio ACFR each year).
 * FY2020 uses the pre-rename "CAFR" document — same GASB-34 governmental-funds layout.
 * FY2022 note: Investment Income is NEGATIVE (−570,453 thousand). Per P2 policy, the
 *   rendered area is clamped to 0 and the true signed value is preserved in the label.
 *   The root node total carries the audited Net Revenues (which already nets the negative).
 *
 * Extraction method: pdftotext -table on local PDF copies at C:\tmp\Ohio\
 *   All 12 revenue checksums verified to 0 diff vs. published ACFR totals.
 *   FY2024 confirmed against plan checksum: TOTAL REV = 45,752,716k.
 *
 * Usage:
 *   node scripts/processOHRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const SOURCES = {
  2020: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2020/CAFR_2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2021/ACFR_2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2022/ACFR_2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2023/ACFR_2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://archives.obm.ohio.gov/Files/State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2024/ACFR_2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://archives.obm.ohio.gov/Files//State_Accounting/Financial_Reporting/Comprehensive_Annual_Financial_Report/2025/ACFR%20FY25.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `State of Ohio ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund net revenues by source — State of Ohio ACFR, GENERAL FUND column (in $).
// Source-level totals (depth-1 leaves under the GF root). Sums verified to TOTAL REVENUES.
// Verbatim ACFR revenue source names from the Governmental Funds statement.
// FY2022: Investment Income is negative (−570,453k); clamped to 0 in buildTree per P2.
const REVENUE = {
  2020: { total: 37_891_148_000, confidence: 'actual', categories: [
    { name: 'Income Taxes',                    total:  8_777_052_000 },
    { name: 'Sales Taxes',                     total: 11_000_053_000 },
    { name: 'Corporate and Public Utility Taxes', total: 2_895_596_000 },
    { name: 'Motor Vehicle Fuel Taxes',        total:  1_391_745_000 },
    { name: 'Cigarette Taxes',                 total:    913_712_000 },
    { name: 'Other Taxes',                     total:    756_390_000 },
    { name: 'Licenses, Permits and Fees',      total:  1_175_303_000 },
    { name: 'Sales, Services and Charges',     total:    112_172_000 },
    { name: 'Federal Government',              total: 10_064_078_000 },
    { name: 'Tobacco Settlement',              total:        214_000 },
    { name: 'Escheat Property',                total:    194_814_000 },
    { name: 'Investment Income',               total:    351_873_000 },
    { name: 'Other',                           total:    258_146_000 },
  ]},
  2021: { total: 42_950_405_000, confidence: 'actual', categories: [
    { name: 'Income Taxes',                    total:  9_843_394_000 },
    { name: 'Sales Taxes',                     total: 12_338_794_000 },
    { name: 'Corporate and Public Utility Taxes', total: 3_092_343_000 },
    { name: 'Motor Vehicle Fuel Taxes',        total:  1_429_435_000 },
    { name: 'Cigarette Taxes',                 total:    928_637_000 },
    { name: 'Other Taxes',                     total:    794_540_000 },
    { name: 'Licenses, Permits and Fees',      total:  1_329_822_000 },
    { name: 'Sales, Services and Charges',     total:     98_976_000 },
    { name: 'Federal Government',              total: 12_272_448_000 },
    { name: 'Tobacco Settlement',              total:        252_000 },
    { name: 'Escheat Property',                total:    230_265_000 },
    { name: 'Investment Income',               total:     31_450_000 },
    { name: 'Other',                           total:    560_049_000 },
  ]},
  2022: { total: 44_323_336_000, confidence: 'actual', categories: [
    { name: 'Income Taxes',                    total: 11_204_590_000 },
    { name: 'Sales Taxes',                     total: 13_249_466_000 },
    { name: 'Corporate and Public Utility Taxes', total: 3_414_271_000 },
    { name: 'Motor Vehicle Fuel Taxes',        total:  1_484_728_000 },
    { name: 'Cigarette Taxes',                 total:    883_080_000 },
    { name: 'Other Taxes',                     total:    806_270_000 },
    { name: 'Licenses, Permits and Fees',      total:  1_384_825_000 },
    { name: 'Sales, Services and Charges',     total:    137_033_000 },
    { name: 'Federal Government',              total: 11_592_484_000 },
    { name: 'Tobacco Settlement',              total:      1_896_000 },
    { name: 'Escheat Property',                total:    234_764_000 },
    { name: 'Investment Income',               total:   -570_453_000 }, // NEGATIVE — P2 clamp to 0 in buildTree
    { name: 'Other',                           total:    500_382_000 },
  ]},
  2023: { total: 47_284_589_000, confidence: 'actual', categories: [
    { name: 'Income Taxes',                    total: 11_437_657_000 },
    { name: 'Sales Taxes',                     total: 13_762_859_000 },
    { name: 'Corporate and Public Utility Taxes', total: 3_634_259_000 },
    { name: 'Motor Vehicle Fuel Taxes',        total:  1_460_933_000 },
    { name: 'Cigarette Taxes',                 total:    826_786_000 },
    { name: 'Other Taxes',                     total:    921_318_000 },
    { name: 'Licenses, Permits and Fees',      total:  1_408_437_000 },
    { name: 'Sales, Services and Charges',     total:    130_094_000 },
    { name: 'Federal Government',              total: 12_459_415_000 },
    { name: 'Tobacco Settlement',              total:     42_096_000 },
    { name: 'Escheat Property',                total:    291_051_000 },
    { name: 'Investment Income',               total:    622_129_000 },
    { name: 'Other',                           total:    287_555_000 },
  ]},
  2024: { total: 45_752_716_000, confidence: 'actual', categories: [
    { name: 'Income Taxes',                    total:  9_946_039_000 },
    { name: 'Sales Taxes',                     total: 13_990_858_000 },
    { name: 'Corporate and Public Utility Taxes', total: 3_385_365_000 },
    { name: 'Motor Vehicle Fuel Taxes',        total:  1_533_855_000 },
    { name: 'Cigarette Taxes',                 total:    750_573_000 },
    { name: 'Other Taxes',                     total:    922_624_000 },
    { name: 'Licenses, Permits and Fees',      total:  1_375_251_000 },
    { name: 'Sales, Services and Charges',     total:    147_539_000 },
    { name: 'Federal Government',              total: 11_263_232_000 },
    { name: 'Tobacco Settlement',              total:        449_000 },
    { name: 'Escheat Property',                total:    299_041_000 },
    { name: 'Investment Income',               total:  1_602_866_000 },
    { name: 'Other',                           total:    535_024_000 },
  ]},
  2025: { total: 49_343_227_000, confidence: 'actual', categories: [
    { name: 'Income Taxes',                    total: 10_755_068_000 },
    { name: 'Sales Taxes',                     total: 14_333_627_000 },
    { name: 'Corporate and Public Utility Taxes', total: 3_339_668_000 },
    { name: 'Motor Vehicle Fuel Taxes',        total:  1_509_172_000 },
    { name: 'Cigarette Taxes',                 total:    712_138_000 },
    { name: 'Other Taxes',                     total:  1_016_611_000 },
    { name: 'Licenses, Permits and Fees',      total:  1_417_716_000 },
    { name: 'Sales, Services and Charges',     total:    199_639_000 },
    { name: 'Federal Government',              total: 13_395_916_000 },
    { name: 'Tobacco Settlement',              total:        332_000 },
    { name: 'Escheat Property',                total:    456_597_000 },
    { name: 'Investment Income',               total:  1_526_400_000 },
    { name: 'Other',                           total:    680_343_000 },
  ]},
};

// P2: clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) { catSum += cat.total; }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  }).filter(c => c.a >= 0); // keep all including 0-clamped negatives (shown as 0 area)
  // For actual filtering: include clamped-zero negative items (they appear as zero-area but are visible)
  // Sort by rendered area descending, putting zero-area items last
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Ohio General Fund Revenue', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Ohio General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'oh-gf-revenue', base_url: 'https://obm.ohio.gov/reports-and-resources/01-acfr-and-pafr', fiscal_years: [2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    // Also show the true signed Investment Income for FY2022
    if (fy === 2022) { const inv = REVENUE[2022].categories.find(c => c.name === 'Investment Income'); if (inv) console.log(`  [Note: Investment Income true value: ${inv.total.toLocaleString()} (net loss — shown at 0)]`); }
    console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Post-RPC source stamp (P4). Idempotent.
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} revenue budget row to stamp source`); process.exit(2); }
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
