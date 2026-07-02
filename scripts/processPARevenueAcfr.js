#!/usr/bin/env node
/**
 * Pennsylvania General Fund Revenue (by source) Loader — FY2016-FY2025 ACTUAL
 * Source: Commonwealth of Pennsylvania Annual Comprehensive Financial Report (ACFR),
 *   Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances,
 *   GENERAL FUND column (GAAP basis, in thousands). Published by the Governor's Office
 *   of the Budget. Per-FY source URL below (pa.gov annualfinancialreport).
 *
 * Phase 105-01 (ACFR-06, ACFR-08, RECON-05). Revenue is NEW on the PA state node
 *   (NASBO had no revenue-by-source) → insert keyed (muni,fy,'revenue').
 *   PA state node resolved by name+state+entity_type='state'.
 *
 * SCOPE vs NASBO (TX-trap, D-04): PA ACFR GF ~2.0× NASBO GF because federal/
 *   intergovernmental (~$42.3B) sits inside the GAAP General Fund. NASBO's budgetary
 *   "general fund" concept reports federal/intergovernmental separately (not inside).
 *   The per-node GAAP basis label + source chip make this honest — ACCEPTED and
 *   RELABELLED via the dataSource() label (TX precedent). Do NOT silently double the
 *   node. Confirmed at Phase 105-03 live load.
 *
 * URL SPECIAL-CASE: FY2016-FY2023 use hyphen filename (june-30-{YYYY}-acfr.pdf);
 *   FY2024-FY2025 use LITERAL SPACE (%20) filename (june-30-{YYYY}%20acfr.pdf).
 *
 * UNITS CONVENTION: FL ×UNITS=1000 thousands model (store thousands in REVENUE map,
 *   ×1000 at buildTree to store dollars). PA is in thousands — do NOT store raw
 *   dollars like TX.
 *
 * Bookends (recon-confirmed, GENERAL FUND column, 103-PA-IL-SOURCES.md):
 *   FY2024 Total revenues = 91,293,027 (thousands) → 91,293,027,000 (dollars)
 *   FY2023 Total revenues = 95,231,042 (thousands) → 95,231,042,000 (dollars)
 *
 * P2 clamp (ACFR-08): if any FY shows a negative GF revenue category, clamp to 0
 *   for render with the signed magnitude in the label; root total carries the signed
 *   net. No negative revenue categories found in PA FY2016-FY2025 (investment
 *   earnings all positive). Older FY TBD — clamp path wired for safety.
 *
 * Control = printed General-Fund-column "Total revenues". Each FY's transcribed
 *   rev-by-source categories must tie to the printed Total (in thousands) or the
 *   loader refuses to write (process.exit(2)). Tolerance = 10,000 thousands.
 *   All FY2016-FY2025 transcriptions verified to tie at 0 diff vs printed totals.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-work/pa/ (NOT -layout).
 *   GF column = 1st of (General Fund | Motor License Fund | Nonmajor | Total).
 *
 * IDEMPOTENCY (RECON-05): treasury_sync_budget_tree RPC is keyed (muni,fy,dataset_type).
 *
 * Usage:
 *   node scripts/processPARevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Pennsylvania'; const STATE_ABBR = 'PA'; const POPULATION = 13_002_700;
const UNITS = 1_000; // PA ACFR is in thousands → ×1,000 to store dollars (FL convention)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PA_BASE_HYPHEN = 'https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport';
// FY2016-FY2023: hyphen filename; FY2024-FY2025: LITERAL SPACE (%20) — special-case!
const SOURCES = {
  2016: { url: `${PA_BASE_HYPHEN}/june-30-2016-acfr.pdf`, date: '2016-06-30' },
  2017: { url: `${PA_BASE_HYPHEN}/june-30-2017-acfr.pdf`, date: '2017-06-30' },
  2018: { url: `${PA_BASE_HYPHEN}/june-30-2018-acfr.pdf`, date: '2018-06-30' },
  2019: { url: `${PA_BASE_HYPHEN}/june-30-2019-acfr.pdf`, date: '2019-06-30' },
  2020: { url: `${PA_BASE_HYPHEN}/june-30-2020-acfr.pdf`, date: '2020-06-30' },
  2021: { url: `${PA_BASE_HYPHEN}/june-30-2021-acfr.pdf`, date: '2021-06-30' },
  2022: { url: `${PA_BASE_HYPHEN}/june-30-2022-acfr.pdf`, date: '2022-06-30' },
  2023: { url: `${PA_BASE_HYPHEN}/june-30-2023-acfr.pdf`, date: '2023-06-30' },
  2024: { url: `${PA_BASE_HYPHEN}/june-30-2024%20acfr.pdf`, date: '2024-06-30' }, // %20 special-case
  2025: { url: `${PA_BASE_HYPHEN}/june-30-2025%20acfr.pdf`, date: '2025-06-30' }, // %20 special-case
};
const dataSource = (fy) => `Pennsylvania State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund revenues by source — PA ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim ACFR revenue source names from the Governmental Funds Statement of Revenues,
// Expenditures and Changes in Fund Balances. total = printed General-Fund "Total revenues"
// (thousands). Transcribed from pdftotext -table extraction; all FY tie at 0 diff vs printed totals.
//
// Bookend checks (recon 103-PA-IL-SOURCES.md):
//   FY2024 total = 91,293,027 (thousands) → 91,293,027,000 (dollars stored)
//   FY2023 total = 95,231,042 (thousands) → 95,231,042,000 (dollars stored)
//
// Note: FY2022 "Investment earnings" in the General Fund column = 21,541 (positive).
// No negative revenue categories found across all PA GF FY2016-FY2025.
const REVENUE = {
  2016: { total: 56_741_506, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 29_629_553 },
    { name: 'Licenses and fees',              total:    551_565 },
    { name: 'Intergovernmental',              total: 24_405_051 },
    { name: 'Charges for sales and services', total:  1_807_964 },
    { name: 'Investment income',              total:     18_416 },
    { name: 'Interest on notes and loans',   total:      1_221 },
    { name: 'Other',                          total:    327_736 },
  ]},
  2017: { total: 60_738_926, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 30_072_951 },
    { name: 'Licenses and fees',              total:    586_815 },
    { name: 'Intergovernmental',              total: 26_964_688 },
    { name: 'Charges for sales and services', total:  2_749_478 },
    { name: 'Investment income',              total:     29_702 },
    { name: 'Interest on notes and loans',   total:      1_132 },
    { name: 'Other',                          total:    334_160 },
  ]},
  2018: { total: 61_695_790, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 31_131_530 },
    { name: 'Licenses and fees',              total:    812_100 },
    { name: 'Intergovernmental',              total: 26_476_775 },
    { name: 'Charges for sales and services', total:  2_991_557 },
    { name: 'Investment income',              total:     37_499 },
    { name: 'Interest on notes and loans',   total:      2_620 },
    { name: 'Other',                          total:    243_709 },
  ]},
  2019: { total: 65_803_730, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 33_074_546 },
    { name: 'Licenses and fees',              total:    854_757 },
    { name: 'Intergovernmental',              total: 28_215_760 },
    { name: 'Charges for sales and services', total:  3_356_759 },
    { name: 'Investment income',              total:     64_106 },
    { name: 'Interest on notes and loans',   total:        916 },
    { name: 'Other',                          total:    236_886 },
  ]},
  2020: { total: 70_717_513, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 32_687_322 },
    { name: 'Licenses and fees',              total:    613_793 },
    { name: 'Intergovernmental',              total: 33_325_865 },
    { name: 'Charges for sales and services', total:  3_703_708 },
    { name: 'Investment income',              total:     43_759 },
    { name: 'Interest on notes and loans',   total:        781 },
    { name: 'Other',                          total:    342_285 },
  ]},
  2021: { total: 81_825_525, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 37_181_965 },
    { name: 'Licenses and fees',              total:    702_093 },
    { name: 'Intergovernmental',              total: 39_636_245 },
    { name: 'Charges for sales and services', total:  3_957_922 },
    { name: 'Investment income',              total:     21_636 },
    { name: 'Interest on notes and loans',   total:        843 },
    { name: 'Other',                          total:    324_821 },
  ]},
  2022: { total: 98_210_961, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 42_501_943 },
    { name: 'Licenses and fees',              total:    700_574 },
    { name: 'Intergovernmental',              total: 50_428_297 },
    { name: 'Charges for sales and services', total:  4_137_369 },
    { name: 'Investment earnings',            total:     21_541 },
    { name: 'Interest on notes and loans',   total:        607 },
    { name: 'Other',                          total:    420_630 },
  ]},
  2023: { total: 95_231_042, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 42_968_507 },
    { name: 'Licenses and fees',              total:    684_754 },
    { name: 'Intergovernmental',              total: 46_171_351 },
    { name: 'Charges for sales and services', total:  4_250_671 },
    { name: 'Investment earnings',            total:    705_778 },
    { name: 'Interest on notes and loans',   total:        509 },
    { name: 'Other',                          total:    449_472 },
  ]},
  2024: { total: 91_293_027, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 42_179_317 },
    { name: 'Licenses and fees',              total:    760_083 },
    { name: 'Intergovernmental',              total: 42_315_745 },
    { name: 'Charges for sales and services', total:  4_388_038 },
    { name: 'Investment earnings',            total:  1_165_471 },
    { name: 'Interest on notes and loans',   total:        418 },
    { name: 'Other',                          total:    483_955 },
  ]},
  2025: { total: 92_414_817, confidence: 'actual', categories: [
    { name: 'Taxes, net of refunds',          total: 43_170_272 },
    { name: 'Licenses and fees',              total:    708_274 },
    { name: 'Intergovernmental',              total: 42_122_117 },
    { name: 'Charges for sales and services', total:  4_814_096 },
    { name: 'Investment earnings',            total:    986_709 },
    { name: 'Interest on notes and loans',   total:        345 },
    { name: 'Other',                          total:    613_004 },
  ]},
};

// P2 clamp (ACFR-08): clamp negative rendered area to 0; preserve signed value in label.
// Root total carries the signed net (ACFR-08 compliance).
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Pennsylvania General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Pennsylvania General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'pa-acfr-gf-revenue', base_url: 'https://www.pa.gov/agencies/budget/publications-and-reports/annual-financial-report', fiscal_years: [2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
    for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${c.total.toLocaleString()} (net loss — shown at 0)]`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
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
