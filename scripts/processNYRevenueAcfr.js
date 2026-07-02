#!/usr/bin/env node
/**
 * New York General Fund Revenue (by source) Loader — FY2003-FY2024 ACTUAL
 * Source: State of New York Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL column
 *   (GAAP basis, Amounts in MILLIONS). Published by the Office of the State Comptroller (OSC).
 *
 * Phase 100 (ACFR-03 + ACFR-05). Revenue is NEW on the NY state node (NASBO had no
 *   revenue-by-source) → pure insert keyed (muni,fy,'revenue'). NY state node id (D-01):
 *   1a7f871c-7f2e-4786-9c55-5ab3409716f4.
 *
 * UNITS = MILLIONS (D-03): printed in millions → ×1,000,000 to store dollars. Raw printed
 *   millions kept below for audit; buildTree/validate apply UNITS.
 *
 * Control = printed General-column "Total revenues". Each FY's transcribed rev-by-source
 *   categories must tie to the printed Total (millions) or the loader refuses to write
 *   (process.exit(2)). Bookend (recon-confirmed): FY2024 93,894 (millions) = $93,894,000,000.
 *
 * P2 clamp (ACFR-05): any negative GF revenue category renders at 0 area with the true
 *   signed value preserved in the label; the root total carries the net. NOTE: NY's GENERAL
 *   column has NO negative revenue categories in FY2015-2024 (its investment income sits
 *   inside positive "Miscellaneous"), but the clamp is wired and fires if a year shows one.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/ny/ (NOT -layout). The
 *   GENERAL column is the 1st numeric column. All 22 years tie to 0 diff vs. Total revenues.
 *
 * Phase 104 deepening (DEEP-01/RECON-05/ACFR-08): added FY2003-FY2014 (12 years). All 12
 *   added years tie to 0 diff. FY2003 bookend confirmed: Total revenues 29,250M = $29,250,000,000.
 *   No negative revenue categories in any added year (FY2003-FY2014 all positive).
 *
 * Usage:
 *   node scripts/processNYRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New York'; const STATE_ABBR = 'NY'; const POPULATION = 20_201_249;
const STATE_NODE_ID = '1a7f871c-7f2e-4786-9c55-5ab3409716f4'; // D-01
const UNITS = 1_000_000; // MILLIONS → dollars (D-03)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const NY_BASE = 'https://www.osc.ny.gov/files/reports/finance/pdf';
function nyUrl(fy) {
  return fy >= 2022
    ? `${NY_BASE}/annual-comprehensive-financial-report-${fy}.pdf`
    : `${NY_BASE}/comprehensive-annual-financial-report-${fy}.pdf`;
}
const SOURCES = Object.fromEntries(
  [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024].map(fy => [fy, { url: nyUrl(fy), date: `${fy}-03-31` }])
);
const dataSource = (fy) => `New York State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF net revenues by source — NY ACFR, GENERAL column (raw MILLIONS; ×UNITS → dollars).
// Verbatim ACFR source names (Taxes sub-lines prefixed). total = printed "Total revenues".
// 0-diff verified. Zero-value lines (Public health/patient fees, Tobacco settlement) omitted.
// FY2003-FY2014 added by Phase 104 deepening. FY2003 bookend: 29,250M = $29,250,000,000.
const REVENUE = {
  2003: { total: 29_250, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 15_036 },
    { name: 'Taxes — Consumption and use',  total:  6_874 },
    { name: 'Taxes — Business',             total:  3_448 },
    { name: 'Taxes — Other',                total:    743 },
    { name: 'Miscellaneous',                total:  3_149 },
  ]},
  2004: { total: 32_489, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 16_337 },
    { name: 'Taxes — Consumption and use',  total:  7_869 },
    { name: 'Taxes — Business',             total:  3_294 },
    { name: 'Taxes — Other',                total:    691 },
    { name: 'Federal grants',               total:    645 },
    { name: 'Miscellaneous',                total:  3_653 },
  ]},
  2005: { total: 35_929, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 18_429 },
    { name: 'Taxes — Consumption and use',  total:  8_688 },
    { name: 'Taxes — Business',             total:  3_972 },
    { name: 'Taxes — Other',                total:  1_035 },
    { name: 'Federal grants',               total:      2 },
    { name: 'Miscellaneous',                total:  3_803 },
  ]},
  2006: { total: 41_091, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 21_060 },
    { name: 'Taxes — Consumption and use',  total:  8_454 },
    { name: 'Taxes — Business',             total:  4_970 },
    { name: 'Taxes — Other',                total:  1_028 },
    { name: 'Miscellaneous',                total:  5_579 },
  ]},
  2007: { total: 44_259, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 22_496 },
    { name: 'Taxes — Consumption and use',  total:  8_131 },
    { name: 'Taxes — Business',             total:  6_330 },
    { name: 'Taxes — Other',                total:  1_011 },
    { name: 'Federal grants',               total:     67 },
    { name: 'Miscellaneous',                total:  6_224 },
  ]},
  2008: { total: 45_423, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 23_948 },
    { name: 'Taxes — Consumption and use',  total:  8_252 },
    { name: 'Taxes — Business',             total:  5_950 },
    { name: 'Taxes — Other',                total:  1_271 },
    { name: 'Federal grants',               total:     52 },
    { name: 'Miscellaneous',                total:  5_950 },
  ]},
  2009: { total: 40_228, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 19_262 },
    { name: 'Taxes — Consumption and use',  total:  8_183 },
    { name: 'Taxes — Business',             total:  5_670 },
    { name: 'Taxes — Other',                total:  1_088 },
    { name: 'Federal grants',               total:     45 },
    { name: 'Miscellaneous',                total:  5_980 },
  ]},
  2010: { total: 44_883, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 22_330 },
    { name: 'Taxes — Consumption and use',  total:  8_059 },
    { name: 'Taxes — Business',             total:  5_490 },
    { name: 'Taxes — Other',                total:    873 },
    { name: 'Federal grants',               total:     71 },
    { name: 'Miscellaneous',                total:  8_060 },
  ]},
  2011: { total: 47_069, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 24_895 },
    { name: 'Taxes — Consumption and use',  total:  8_578 },
    { name: 'Taxes — Business',             total:  5_129 },
    { name: 'Taxes — Other',                total:  1_268 },
    { name: 'Federal grants',               total:     55 },
    { name: 'Miscellaneous',                total:  7_144 },
  ]},
  2012: { total: 48_344, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 25_024 },
    { name: 'Taxes — Consumption and use',  total:  8_875 },
    { name: 'Taxes — Business',             total:  5_644 },
    { name: 'Taxes — Other',                total:  1_091 },
    { name: 'Federal grants',               total:     60 },
    { name: 'Miscellaneous',                total:  7_650 },
  ]},
  2013: { total: 50_798, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 27_807 },
    { name: 'Taxes — Consumption and use',  total:  8_795 },
    { name: 'Taxes — Business',             total:  6_072 },
    { name: 'Taxes — Other',                total:  1_021 },
    { name: 'Federal grants',               total:     61 },
    { name: 'Miscellaneous',                total:  7_042 },
  ]},
  2014: { total: 48_459, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 26_811 },
    { name: 'Taxes — Consumption and use',  total:  6_264 },
    { name: 'Taxes — Business',             total:  6_200 },
    { name: 'Taxes — Other',                total:  1_246 },
    { name: 'Miscellaneous',                total:  7_938 },
  ]},
  2015: { total: 55_139, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 30_380 },
    { name: 'Taxes — Consumption and use',  total:  6_362 },
    { name: 'Taxes — Business',             total:  6_091 },
    { name: 'Taxes — Other',                total:  1_202 },
    { name: 'Federal grants',               total:      2 },
    { name: 'Miscellaneous',                total: 11_102 },
  ]},
  2016: { total: 50_674, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 30_431 },
    { name: 'Taxes — Consumption and use',  total:  6_551 },
    { name: 'Taxes — Business',             total:  5_348 },
    { name: 'Taxes — Other',                total:  1_480 },
    { name: 'Miscellaneous',                total:  6_864 },
  ]},
  2017: { total: 50_793, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 30_821 },
    { name: 'Taxes — Consumption and use',  total:  6_770 },
    { name: 'Taxes — Business',             total:  5_079 },
    { name: 'Taxes — Other',                total:  1_063 },
    { name: 'Miscellaneous',                total:  7_060 },
  ]},
  2018: { total: 56_638, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 36_327 },
    { name: 'Taxes — Consumption and use',  total:  7_156 },
    { name: 'Taxes — Business',             total:  5_023 },
    { name: 'Taxes — Other',                total:  1_255 },
    { name: 'Miscellaneous',                total:  6_877 },
  ]},
  2019: { total: 42_185, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 22_454 },
    { name: 'Taxes — Consumption and use',  total:  7_280 },
    { name: 'Taxes — Business',             total:  5_549 },
    { name: 'Taxes — Other',                total:    959 },
    { name: 'Miscellaneous',                total:  5_943 },
  ]},
  2020: { total: 41_469, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 21_988 },
    { name: 'Taxes — Consumption and use',  total:  7_599 },
    { name: 'Taxes — Business',             total:  5_104 },
    { name: 'Taxes — Other',                total:  1_031 },
    { name: 'Miscellaneous',                total:  5_747 },
  ]},
  2021: { total: 68_121, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 26_540 },
    { name: 'Taxes — Consumption and use',  total:  7_219 },
    { name: 'Taxes — Business',             total:  7_186 },
    { name: 'Taxes — Other',                total:  1_642 },
    { name: 'Miscellaneous',                total: 25_534 },
  ]},
  2022: { total: 68_634, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 14_532 },
    { name: 'Taxes — Consumption and use',  total:  4_161 },
    { name: 'Taxes — Business',             total: 16_682 },
    { name: 'Taxes — Other',                total:  1_403 },
    { name: 'Federal grants',               total:  4_528 },
    { name: 'Miscellaneous',                total: 27_328 },
  ]},
  2023: { total: 92_791, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 39_107 },
    { name: 'Taxes — Consumption and use',  total:  6_785 },
    { name: 'Taxes — Business',             total: 10_042 },
    { name: 'Taxes — Other',                total:  2_690 },
    { name: 'Federal grants',               total:  2_351 },
    { name: 'Miscellaneous',                total: 31_816 },
  ]},
  2024: { total: 93_894, confidence: 'actual', categories: [
    { name: 'Taxes — Personal income',     total: 32_681 },
    { name: 'Taxes — Consumption and use',  total:  9_407 },
    { name: 'Taxes — Business',             total: 10_980 },
    { name: 'Taxes — Other',                total:  1_679 },
    { name: 'Federal grants',               total:  2_249 },
    { name: 'Miscellaneous',                total: 36_898 },
  ]},
};

// P2: clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [millions]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'New York General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, MILLIONS×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId = STATE_NODE_ID;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('id', STATE_NODE_ID).single();
    if (error || !muni) { console.error(`${STATE_NAME} state node ${STATE_NODE_ID} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'New York General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ny-acfr-gf-revenue', base_url: 'https://www.osc.ny.gov/reports/finance', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total*UNITS).toLocaleString()} (net loss — shown at 0)]`);
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
