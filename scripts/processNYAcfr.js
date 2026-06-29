#!/usr/bin/env node
/**
 * New York General Fund Operating (Expenditure) Loader — FY2015-FY2024 ACTUAL
 * Source: State of New York Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL column
 *   (GAAP basis, Amounts in MILLIONS). Published by the Office of the State Comptroller (OSC).
 *   Per-FY source URL below (osc.ny.gov finance/reports ACFR — NOT the NYSLRS pension ACFR).
 *
 * Phase 100 (ACFR-03). Replaces the NASBO operating rows on the NY state node in place
 *   (same (muni,fy,'operating') RPC key). NY state node id (D-01):
 *   1a7f871c-7f2e-4786-9c55-5ab3409716f4.
 *   NOTE: filename is processNYAcfr.js (NOT processNY.js) — the legacy v1.7 openbudget.ny.gov
 *   operating loader still lives at scripts/processNY.js (dead/superseded); this ACFR loader
 *   is the Phase-100 replacement and does not clobber it.
 *
 * UNITS = MILLIONS (D-03): the ACFR prints figures in millions → multiply by UNITS
 *   (1,000,000) to store dollars. This is the extra ×1000 vs the thousands-based CA/FL/TX
 *   template. Raw printed millions are kept in EXPENDITURES below for faithful audit;
 *   buildTree/validate apply UNITS.
 *
 * Control = printed General-column "Total expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total (in millions) or the loader
 *   refuses to write (process.exit(2)). Bookend (recon-confirmed): FY2024 Total revenues
 *   93,894 (millions) = $93,894,000,000.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/ny/ (NOT -layout).
 *   The GENERAL column is the 1st numeric column. All 10 years tie to 0 diff vs. the
 *   printed General-column Total expenditures. NY has NO negative GF expenditure categories.
 *
 * Usage:
 *   node scripts/processNYAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NODE_ID = '1a7f871c-7f2e-4786-9c55-5ab3409716f4'; // D-01: upgrade this node in place
const UNITS = 1_000_000; // NY ACFR is in MILLIONS → ×1,000,000 to store dollars (D-03)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published State of New York ACFR (source_date = Mar 31 FYE).
// URL naming flips at FY2022: ≤2021 comprehensive-annual-…; ≥2022 annual-comprehensive-… (D-02).
const NY_BASE = 'https://www.osc.ny.gov/files/reports/finance/pdf';
function nyUrl(fy) {
  return fy >= 2022
    ? `${NY_BASE}/annual-comprehensive-financial-report-${fy}.pdf`
    : `${NY_BASE}/comprehensive-annual-financial-report-${fy}.pdf`;
}
const SOURCES = Object.fromEntries(
  [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024].map(fy => [fy, { url: nyUrl(fy), date: `${fy}-03-31` }])
);
const dataSource = (fy) => `New York State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — NY ACFR, GENERAL column (raw MILLIONS; ×UNITS → dollars).
// Verbatim ACFR function names, grouped (Local assistance / State operations) into a flat
// leaf list. total = printed General-column "Total expenditures" (millions). 0-diff verified.
const EXPENDITURES = {
  2015: { total: 60_612, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 22_405 },
    { name: 'Local assistance — Public health',              total: 15_812 },
    { name: 'Local assistance — Public welfare',             total:  2_782 },
    { name: 'Local assistance — Public safety',              total:    207 },
    { name: 'Local assistance — Transportation',             total:     97 },
    { name: 'Local assistance — Environment and recreation', total:     10 },
    { name: 'Local assistance — Support and regulate business', total:  362 },
    { name: 'Local assistance — General government',         total:  1_076 },
    { name: 'State operations — Personal service',           total:  8_959 },
    { name: 'State operations — Non-personal service',       total:  3_286 },
    { name: 'State operations — Pension contributions',      total:  1_859 },
    { name: 'State operations — Other fringe benefits',      total:  3_757 },
  ]},
  2016: { total: 62_756, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 24_053 },
    { name: 'Local assistance — Public health',              total: 16_062 },
    { name: 'Local assistance — Public welfare',             total:  2_950 },
    { name: 'Local assistance — Public safety',              total:    200 },
    { name: 'Local assistance — Transportation',             total:    109 },
    { name: 'Local assistance — Environment and recreation', total:     12 },
    { name: 'Local assistance — Support and regulate business', total:  212 },
    { name: 'Local assistance — General government',         total:  1_092 },
    { name: 'State operations — Personal service',           total:  9_116 },
    { name: 'State operations — Non-personal service',       total:  3_163 },
    { name: 'State operations — Pension contributions',      total:  1_924 },
    { name: 'State operations — Other fringe benefits',      total:  3_863 },
  ]},
  2017: { total: 64_454, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 24_746 },
    { name: 'Local assistance — Public health',              total: 16_399 },
    { name: 'Local assistance — Public welfare',             total:  3_013 },
    { name: 'Local assistance — Public safety',              total:    258 },
    { name: 'Local assistance — Transportation',             total:    106 },
    { name: 'Local assistance — Environment and recreation', total:      9 },
    { name: 'Local assistance — Support and regulate business', total:  266 },
    { name: 'Local assistance — General government',         total:  1_076 },
    { name: 'State operations — Personal service',           total:  9_083 },
    { name: 'State operations — Non-personal service',       total:  3_141 },
    { name: 'State operations — Pension contributions',      total:  2_137 },
    { name: 'State operations — Other fringe benefits',      total:  4_220 },
  ]},
  2018: { total: 66_475, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 25_686 },
    { name: 'Local assistance — Public health',              total: 17_869 },
    { name: 'Local assistance — Public welfare',             total:  2_814 },
    { name: 'Local assistance — Public safety',              total:    222 },
    { name: 'Local assistance — Transportation',             total:    116 },
    { name: 'Local assistance — Environment and recreation', total:      8 },
    { name: 'Local assistance — Support and regulate business', total:  257 },
    { name: 'Local assistance — General government',         total:  1_024 },
    { name: 'State operations — Personal service',           total:  9_305 },
    { name: 'State operations — Non-personal service',       total:  2_921 },
    { name: 'State operations — Pension contributions',      total:  2_111 },
    { name: 'State operations — Other fringe benefits',      total:  4_142 },
  ]},
  2019: { total: 69_553, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 26_986 },
    { name: 'Local assistance — Public health',              total: 20_073 },
    { name: 'Local assistance — Public welfare',             total:  2_510 },
    { name: 'Local assistance — Public safety',              total:    416 },
    { name: 'Local assistance — Transportation',             total:    304 },
    { name: 'Local assistance — Environment and recreation', total:      8 },
    { name: 'Local assistance — Support and regulate business', total:  242 },
    { name: 'Local assistance — General government',         total:  1_038 },
    { name: 'State operations — Personal service',           total:  9_680 },
    { name: 'State operations — Non-personal service',       total:  2_863 },
    { name: 'State operations — Pension contributions',      total:  2_215 },
    { name: 'State operations — Other fringe benefits',      total:  3_218 },
  ]},
  2020: { total: 70_322, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 27_455 },
    { name: 'Local assistance — Public health',              total: 20_423 },
    { name: 'Local assistance — Public welfare',             total:  2_445 },
    { name: 'Local assistance — Public safety',              total:    118 },
    { name: 'Local assistance — Transportation',             total:    110 },
    { name: 'Local assistance — Environment and recreation', total:      8 },
    { name: 'Local assistance — Support and regulate business', total:  246 },
    { name: 'Local assistance — General government',         total:  1_173 },
    { name: 'State operations — Personal service',           total:  9_805 },
    { name: 'State operations — Non-personal service',       total:  2_974 },
    { name: 'State operations — Pension contributions',      total:  2_187 },
    { name: 'State operations — Other fringe benefits',      total:  3_378 },
  ]},
  2021: { total: 83_878, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 26_276 },
    { name: 'Local assistance — Public health',              total: 23_157 },
    { name: 'Local assistance — Public welfare',             total:  2_764 },
    { name: 'Local assistance — Public safety',              total:    215 },
    { name: 'Local assistance — Transportation',             total:    110 },
    { name: 'Local assistance — Environment and recreation', total:     18 },
    { name: 'Local assistance — Support and regulate business', total:  144 },
    { name: 'Local assistance — General government',         total:  1_616 },
    { name: 'State operations — Personal service',           total:  7_594 },
    { name: 'State operations — Non-personal service',       total: 16_252 },
    { name: 'State operations — Pension contributions',      total:  2_603 },
    { name: 'State operations — Other fringe benefits',      total:  3_129 },
  ]},
  2022: { total: 101_018, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 28_344 },
    { name: 'Local assistance — Public health',              total: 26_479 },
    { name: 'Local assistance — Public welfare',             total:  5_274 },
    { name: 'Local assistance — Public safety',              total:    287 },
    { name: 'Local assistance — Transportation',             total:    120 },
    { name: 'Local assistance — Environment and recreation', total:      5 },
    { name: 'Local assistance — Support and regulate business', total:  852 },
    { name: 'Local assistance — General government',         total:  3_191 },
    { name: 'State operations — Personal service',           total:  9_345 },
    { name: 'State operations — Non-personal service',       total: 20_539 },
    { name: 'State operations — Pension contributions',      total:  2_024 },
    { name: 'State operations — Other fringe benefits',      total:  4_558 },
  ]},
  2023: { total: 109_474, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 28_831 },
    { name: 'Local assistance — Public health',              total: 31_257 },
    { name: 'Local assistance — Public welfare',             total:  5_118 },
    { name: 'Local assistance — Public safety',              total:    350 },
    { name: 'Local assistance — Transportation',             total:    151 },
    { name: 'Local assistance — Environment and recreation', total:      6 },
    { name: 'Local assistance — Support and regulate business', total:  883 },
    { name: 'Local assistance — General government',         total:  1_659 },
    { name: 'State operations — Personal service',           total: 10_489 },
    { name: 'State operations — Non-personal service',       total: 23_971 },
    { name: 'State operations — Pension contributions',      total:  1_723 },
    { name: 'State operations — Other fringe benefits',      total:  5_036 },
  ]},
  2024: { total: 115_828, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 32_790 },
    { name: 'Local assistance — Public health',              total: 36_092 },
    { name: 'Local assistance — Public welfare',             total:  4_490 },
    { name: 'Local assistance — Public safety',              total:    413 },
    { name: 'Local assistance — Transportation',             total:    534 },
    { name: 'Local assistance — Environment and recreation', total:      9 },
    { name: 'Local assistance — Support and regulate business', total:  498 },
    { name: 'Local assistance — General government',         total:  1_332 },
    { name: 'State operations — Personal service',           total: 10_997 },
    { name: 'State operations — Non-personal service',       total: 22_454 },
    { name: 'State operations — Pension contributions',      total:  1_509 },
    { name: 'State operations — Other fringe benefits',      total:  4_710 },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  // tolerance 10 (millions) ≈ $10M, mirroring the CA loader's $10M dollar tolerance.
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [millions]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total * UNITS, i: [] }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'New York General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, MILLIONS×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'New York General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ny-acfr-gf-operating', base_url: 'https://www.osc.ny.gov/reports/finance', fiscal_years: [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('dataset_id', srcPayload.dataset_id).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
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
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
