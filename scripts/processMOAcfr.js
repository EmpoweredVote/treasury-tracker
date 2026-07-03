#!/usr/bin/env node
/**
 * Missouri General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Missouri Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the MO state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   MO state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): MO ACFR GF ~2.25× NASBO GF — "Contributions and Intergovernmental"
 *   (federal passthrough, $18,773,418K FY2024) is consolidated into the GAAP GF, excluded from
 *   NASBO's budgetary concept. Accepted-and-relabelled honestly (TX precedent).
 *
 * URL NOTE: per-year node pages acct.oa.mo.gov/media/report/...june-30-{YYYY} resolve to
 *   non-derivable PDF filenames (scraped from each node page's data-src embed).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Net Increase (Decrease) in the Fair Value of Investments" CAN go negative (was negative in the FY2024 Road Fund column) — clamp is the render path if a GF year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/mo/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMOAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Missouri'; const STATE_ABBR = 'MO'; const POPULATION = 6_154_913;
const EXPECTED_MUNI_ID = '21892bb7-1a1d-4038-8665-51c256ab5875';
const UNITS = 1_000; // MO ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2012: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302012.pdf', date: '2012-06-30' },
  2013: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302013.pdf', date: '2013-06-30' },
  2014: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302014.pdf', date: '2014-06-30' },
  2015: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302015.pdf', date: '2015-06-30' },
  2016: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302016.pdf', date: '2016-06-30' },
  2017: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302017.pdf', date: '2017-06-30' },
  2018: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302018.pdf', date: '2018-06-30' },
  2019: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302019.pdf', date: '2019-06-30' },
  2020: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302020.pdf', date: '2020-06-30' },
  2021: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302021.pdf', date: '2021-06-30' },
  2022: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2023-03/ACFR_2022_Final.pdf', date: '2022-06-30' },
  2023: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2024-03/2023%20ACFR.pdf', date: '2023-06-30' },
  2024: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2025-04/2024%20ACFR%20-%20Final%20for%20Internet.pdf', date: '2024-06-30' },
  2025: { url: 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2026-02/2025%20ACFR%20Final.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Missouri State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — MO ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2012: { total: 15_462_049, confidence: 'actual', categories: [
    { name: 'General Government',             total:      658_228 },
    { name: 'Education',                      total:    2_055_025 },
    { name: 'Natural and Economic Resources', total:      445_843 },
    { name: 'Enforcement',                    total:      486_049 },
    { name: 'Human Services',                 total:   11_765_756 },
    { name: 'Debt service — Principal',       total:       17_389 },
    { name: 'Debt service — Interest',        total:       31_260 },
    { name: 'Bond Issuance Costs',            total:          425 },
    { name: 'Underwriter\'s Discount',        total:        2_074 },
  ]},
  2013: { total: 14_869_440, confidence: 'actual', categories: [
    { name: 'General Government',             total:      660_324 },
    { name: 'Education',                      total:    1_917_923 },
    { name: 'Natural and Economic Resources', total:      345_141 },
    { name: 'Enforcement',                    total:      370_833 },
    { name: 'Human Services',                 total:   11_526_089 },
    { name: 'Debt service — Principal',       total:       21_550 },
    { name: 'Debt service — Interest',        total:       24_946 },
    { name: 'Bond Issuance Costs',            total:          391 },
    { name: 'Underwriter\'s Discount',        total:        2_243 },
  ]},
  2014: { total: 15_052_941, confidence: 'actual', categories: [
    { name: 'General Government',             total:      611_082 },
    { name: 'Education',                      total:    1_959_138 },
    { name: 'Natural and Economic Resources', total:      298_605 },
    { name: 'Enforcement',                    total:      306_060 },
    { name: 'Human Services',                 total:   11_811_609 },
    { name: 'Debt service — Principal',       total:       38_151 },
    { name: 'Debt service — Interest',        total:       27_349 },
    { name: 'Bond Issuance Costs',            total:          429 },
    { name: 'Underwriter\'s Discount',        total:          518 },
  ]},
  2015: { total: 15_533_009, confidence: 'actual', categories: [
    { name: 'General Government',             total:      628_905 },
    { name: 'Education',                      total:    2_051_977 },
    { name: 'Natural and Economic Resources', total:      302_832 },
    { name: 'Enforcement',                    total:      390_260 },
    { name: 'Human Services',                 total:   12_075_740 },
    { name: 'Debt service — Principal',       total:       57_577 },
    { name: 'Debt service — Interest',        total:       24_172 },
    { name: 'Bond Issuance Costs',            total:          406 },
    { name: 'Underwriter\'s Discount',        total:        1_140 },
  ]},
  2016: { total: 17_918_015, confidence: 'actual', categories: [
    { name: 'General Government',             total:      641_314 },
    { name: 'Education',                      total:    4_203_875 },
    { name: 'Natural and Economic Resources', total:      300_865 },
    { name: 'Enforcement',                    total:      335_054 },
    { name: 'Human Services',                 total:   12_346_056 },
    { name: 'Debt service — Principal',       total:       63_735 },
    { name: 'Debt service — Interest',        total:       26_624 },
    { name: 'Bond Issuance Costs',            total:          492 },
  ]},
  2017: { total: 18_545_466, confidence: 'actual', categories: [
    { name: 'General Government',             total:      644_887 },
    { name: 'Education',                      total:    4_259_063 },
    { name: 'Natural and Economic Resources', total:      286_541 },
    { name: 'Enforcement',                    total:      337_828 },
    { name: 'Human Services',                 total:   12_916_307 },
    { name: 'Debt service — Principal',       total:       70_891 },
    { name: 'Debt service — Interest',        total:       29_949 },
  ]},
  2018: { total: 18_886_235, confidence: 'actual', categories: [
    { name: 'General Government',             total:      654_849 },
    { name: 'Education',                      total:    4_262_676 },
    { name: 'Natural and Economic Resources', total:      268_990 },
    { name: 'Enforcement',                    total:      298_995 },
    { name: 'Human Services',                 total:   13_293_352 },
    { name: 'Debt service — Principal',       total:       77_610 },
    { name: 'Debt service — Interest',        total:       29_407 },
    { name: 'Bond Issuance Costs',            total:          356 },
  ]},
  2019: { total: 19_109_588, confidence: 'actual', categories: [
    { name: 'General Government',             total:      686_943 },
    { name: 'Education',                      total:    4_378_190 },
    { name: 'Natural and Economic Resources', total:      256_048 },
    { name: 'Enforcement',                    total:      299_866 },
    { name: 'Human Services',                 total:   13_378_001 },
    { name: 'Debt service — Principal',       total:       80_395 },
    { name: 'Debt service — Interest',        total:       30_145 },
  ]},
  2020: { total: 20_080_069, confidence: 'actual', categories: [
    { name: 'General Government',             total:      781_884 },
    { name: 'Education',                      total:    4_342_968 },
    { name: 'Natural and Economic Resources', total:      179_795 },
    { name: 'Enforcement',                    total:      522_827 },
    { name: 'Human Services',                 total:   14_155_905 },
    { name: 'Debt service — Principal',       total:       70_021 },
    { name: 'Debt service — Interest',        total:       26_502 },
    { name: 'Bond Issuance Costs',            total:          155 },
    { name: 'Underwriter\'s Discount',        total:           12 },
  ]},
  2021: { total: 23_575_639, confidence: 'actual', categories: [
    { name: 'General Government',             total:    1_168_436 },
    { name: 'Education',                      total:    4_810_289 },
    { name: 'Natural and Economic Resources', total:      544_949 },
    { name: 'Enforcement',                    total:    1_391_702 },
    { name: 'Human Services',                 total:   15_591_989 },
    { name: 'Debt service — Principal',       total:       47_798 },
    { name: 'Debt service — Interest',        total:       20_090 },
    { name: 'Bond Issuance Costs',            total:          339 },
    { name: 'Underwriter\'s Discount',        total:           47 },
  ]},
  2022: { total: 24_733_303, confidence: 'actual', categories: [
    { name: 'General Government',             total:      791_146 },
    { name: 'Education',                      total:    6_154_773 },
    { name: 'Natural and Economic Resources', total:      632_386 },
    { name: 'Enforcement',                    total:      484_604 },
    { name: 'Human Services',                 total:   16_566_480 },
    { name: 'Debt service — Principal',       total:       79_452 },
    { name: 'Debt service — Interest',        total:       24_462 },
  ]},
  2023: { total: 29_784_903, confidence: 'actual', categories: [
    { name: 'General Government',             total:    1_479_923 },
    { name: 'Education',                      total:    6_658_466 },
    { name: 'Natural and Economic Resources', total:      407_177 },
    { name: 'Enforcement',                    total:      587_537 },
    { name: 'Human Services',                 total:   20_419_857 },
    { name: 'Debt service — Principal',       total:      209_129 },
    { name: 'Debt service — Interest',        total:       22_814 },
  ]},
  2024: { total: 30_900_541, confidence: 'actual', categories: [
    { name: 'General Government',             total:    1_138_625 },
    { name: 'Education',                      total:    6_982_131 },
    { name: 'Natural and Economic Resources', total:      656_828 },
    { name: 'Enforcement',                    total:      681_799 },
    { name: 'Human Services',                 total:   21_292_003 },
    { name: 'Debt service — Principal',       total:      127_305 },
    { name: 'Debt service — Interest',        total:       21_850 },
  ]},
  2025: { total: 31_848_774, confidence: 'actual', categories: [
    { name: 'General Government',             total:    1_129_034 },
    { name: 'Education',                      total:    6_535_913 },
    { name: 'Natural and Economic Resources', total:      761_878 },
    { name: 'Enforcement',                    total:      906_078 },
    { name: 'Human Services',                 total:   22_381_542 },
    { name: 'Debt service — Principal',       total:      118_046 },
    { name: 'Debt service — Interest',        total:       16_283 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Missouri General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    if (muni.id !== EXPECTED_MUNI_ID) { console.error(`Resolved node ${muni.id} ≠ expected ${EXPECTED_MUNI_ID} — refusing to write`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Missouri General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'mo-acfr-gf-operating', base_url: 'https://oa.mo.gov/accounting/reports/annual-reports/annual-comprehensive-financial-reports', fiscal_years: [2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = EXPENDITURES[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL EXPENDITURES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
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
