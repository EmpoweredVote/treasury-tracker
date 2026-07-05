#!/usr/bin/env node
/**
 * Rhode Island General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Rhode Island Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the RI state node → pure insert keyed (muni,fy,'revenue').
 *   RI state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-49): RI ACFR GF ~1.93x NASBO GF (FY2025 $10,095,792K vs FY2024 NASBO
 *   $5,236,000K). Rhode Island's General Fund consolidates a large Federal grants line
 *   ($4,551,647K FY2025, ~45% of GF total revenues) into a single fund, whereas NASBO's
 *   narrower budgetary concept excludes most federal-passthrough activity. Same mechanism as
 *   MD/GA (~1.8-2.0x). Accepted-and-relabelled honestly (TX precedent).
 *
 * 4-COLUMN LAYOUT: GENERAL is the 1st of 4 (General | Intermodal Surface Transportation |
 *   Rhode Island Capital Plan | Other Governmental Funds | Total). extract_gf.py's
 *   position-anchor isolates General regardless of the total column count -- confirmed at
 *   both bookends (FY2025 rev $10,095,792K / FY2006 rev $4,585,920K, exact $0 diff on BOTH
 *   revenues and expenditures, byte-identical to the 117 recon) and on all 20 loaded years.
 *
 * OPAQUE PER-YEAR URLS (NC/GA/OK precedent -- no derivable pattern): every year's ACFR/CAFR
 *   lives under a date-stamped Drupal directory on controller.admin.ri.gov with no per-FY
 *   naming rule -- FY2006-FY2016 are bare "{YYYY}.pdf" filenames under a single 2025-01/
 *   re-publish directory, FY2017-FY2020 use "CAFR%2006-30-{YYYY}.pdf" under a 2022-04/
 *   directory, FY2021 "ACFR%206-30-2021.pdf" (same 2022-04/ directory), and FY2022-FY2025
 *   each live under their own individually-dated directory with a unique filename. All 20
 *   URLs enumerated directly from the financial-reports page and re-verified live at load
 *   (%PDF magic + size >500KB, all 20 years; largest FY2025 file is 102MB).
 *
 * FY2022 LITERAL TRAILING SPACE (the RI filename trap, confirmed live): the FY2022 filename
 *   is "ACFR 6-30-2022 .pdf" -- a literal space character between "2022" and ".pdf",
 *   URL-encoded as "%20" immediately before the extension. Verified byte-for-byte against the
 *   financial-reports page link and re-confirmed by a successful download (not a typo in this
 *   loader -- the space is genuinely present in RI's published filename).
 *
 * CLEAN EXTRACTION: no wrapped labels, no ALL-CAPS source text, no rev_boundary sub-heading
 *   complications (RI's "Taxes" line prints as a single un-broken-out revenue item, not a
 *   subsection header over several tax lines -- sub=None throughout every loaded year on the
 *   revenue side) -- all 20 years FY2006-FY2025 tied exactly on the first extraction pass on
 *   both the revenue and expenditure sides. Minor category-label drift across years is cohort-
 *   normal (e.g. "Human services" -> "Health and human services" from FY2020, "Licenses, fines,
 *   sales, and services" -> "Licenses, fines, tolls, sales, and services" from FY2018,
 *   "Income from investments" -> "Income (loss) from investments" from FY2025) -- default_rev_name/
 *   default_exp_name normalize via norm(), no manual patch needed.
 *
 * WINDOW: FY2006-FY2025 (20 years) is the full durable window per the 117 recon -- pre-FY2006
 *   files are discoverable on the financial-reports page but were not individually
 *   tie-confirmed within the recon budget; not chased further this pass.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Full-cohort negative scan (all 20 loaded years, both revenue and expenditure sections): ZERO negative GF line items found anywhere -- "Income from investments"/"Income (loss) from investments" is positive throughout (FY2025 +$47,546K / FY2006 +$2,000K, the recon-confirmed bookends). The column header itself flags a "(loss)" possibility (confirmed present from FY2025 onward) but no interior year triggers it. Clamp path (clampForRender / P2) stays wired per ACFR-32 as the tranche-standard safety net, unexercised for RI.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ri/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processRIRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Rhode Island'; const STATE_ABBR = 'RI'; const POPULATION = 1_097_379;
const EXPECTED_MUNI_ID = '483f02b4-2167-4e3d-9f5c-0f3ed83be2e6';
const UNITS = 1_000; // RI ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2006: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/ACFR%206-30-2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2023-01/ACFR%206-30-2022%20.pdf', date: '2022-06-30' },
  2023: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2024-02/ACFR%206-30-2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-03/2024%20State%20of%20Rhode%20Island%20ACFR%206.30.24%20-%20Final.pdf', date: '2024-06-30' },
  2025: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Rhode Island State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — RI ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2006: { total: 4_585_920, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_479_554 },
    { name: 'Licenses, fines, sales, and services', total:      253_768 },
    { name: 'Departmental restricted revenue',      total:      105_765 },
    { name: 'Federal grants',                       total:    1_713_287 },
    { name: 'Income from investments',              total:        2_000 },
    { name: 'Other revenues',                       total:       31_546 },
  ]},
  2007: { total: 4_546_037, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_529_241 },
    { name: 'Licenses, fines, sales, and services', total:      242_560 },
    { name: 'Departmental restricted revenue',      total:      109_184 },
    { name: 'Federal grants',                       total:    1_629_715 },
    { name: 'Income from investments',              total:        2_611 },
    { name: 'Other revenues',                       total:       32_726 },
  ]},
  2008: { total: 4_746_838, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_516_401 },
    { name: 'Licenses, fines, sales, and services', total:      322_864 },
    { name: 'Departmental restricted revenue',      total:      126_090 },
    { name: 'Federal grants',                       total:    1_740_283 },
    { name: 'Income from investments',              total:        2_779 },
    { name: 'Other revenues',                       total:       38_421 },
  ]},
  2009: { total: 4_739_822, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_278_969 },
    { name: 'Licenses, fines, sales, and services', total:      295_069 },
    { name: 'Departmental restricted revenue',      total:      133_872 },
    { name: 'Federal grants',                       total:    2_001_605 },
    { name: 'Income from investments',              total:          313 },
    { name: 'Other revenues',                       total:       29_994 },
  ]},
  2010: { total: 5_037_547, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_274_447 },
    { name: 'Licenses, fines, sales, and services', total:      310_505 },
    { name: 'Departmental restricted revenue',      total:      149_638 },
    { name: 'Federal grants',                       total:    2_275_606 },
    { name: 'Income from investments',              total:          285 },
    { name: 'Other revenues',                       total:       27_066 },
  ]},
  2011: { total: 5_195_822, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_363_192 },
    { name: 'Licenses, fines, sales, and services', total:      309_687 },
    { name: 'Departmental restricted revenue',      total:      174_192 },
    { name: 'Federal grants',                       total:    2_314_100 },
    { name: 'Income from investments',              total:           57 },
    { name: 'Other revenues',                       total:       34_594 },
  ]},
  2012: { total: 5_208_523, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_511_891 },
    { name: 'Licenses, fines, sales, and services', total:      313_455 },
    { name: 'Departmental restricted revenue',      total:      192_642 },
    { name: 'Federal grants',                       total:    2_119_476 },
    { name: 'Income from investments',              total:          101 },
    { name: 'Other revenues',                       total:       70_958 },
  ]},
  2013: { total: 5_300_188, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_568_513 },
    { name: 'Licenses, fines, sales, and services', total:      323_308 },
    { name: 'Departmental restricted revenue',      total:      220_983 },
    { name: 'Federal grants',                       total:    2_129_847 },
    { name: 'Income from investments',              total:          693 },
    { name: 'Other revenues',                       total:       56_844 },
  ]},
  2014: { total: 5_619_630, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_666_523 },
    { name: 'Licenses, fines, sales, and services', total:      330_565 },
    { name: 'Departmental restricted revenue',      total:      216_142 },
    { name: 'Federal grants',                       total:    2_345_942 },
    { name: 'Income from investments',              total:          650 },
    { name: 'Other revenues',                       total:       59_808 },
  ]},
  2015: { total: 6_106_844, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_874_434 },
    { name: 'Licenses, fines, sales, and services', total:      326_003 },
    { name: 'Departmental restricted revenue',      total:      227_631 },
    { name: 'Federal grants',                       total:    2_619_412 },
    { name: 'Income from investments',              total:          809 },
    { name: 'Other revenues',                       total:       58_555 },
  ]},
  2016: { total: 6_156_579, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_895_540 },
    { name: 'Licenses, fines, sales, and services', total:      355_731 },
    { name: 'Departmental restricted revenue',      total:      241_872 },
    { name: 'Federal grants',                       total:    2_610_735 },
    { name: 'Income from investments',              total:        1_516 },
    { name: 'Other revenues',                       total:       51_185 },
  ]},
  2017: { total: 6_267_339, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    2_918_068 },
    { name: 'Licenses, fines, sales, and services', total:      348_934 },
    { name: 'Departmental restricted revenue',      total:      217_258 },
    { name: 'Federal grants',                       total:    2_726_644 },
    { name: 'Income from investments',              total:        1_885 },
    { name: 'Other revenues',                       total:       54_550 },
  ]},
  2018: { total: 6_516_117, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total:    3_076_712 },
    { name: 'Licenses, fines, tolls, sales, and services', total:      383_325 },
    { name: 'Departmental restricted revenue',             total:      230_156 },
    { name: 'Federal grants',                              total:    2_744_485 },
    { name: 'Income from investments',                     total:        2_098 },
    { name: 'Other revenues',                              total:       79_341 },
  ]},
  2019: { total: 6_736_596, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total:    3_173_291 },
    { name: 'Licenses, fines, tolls, sales, and services', total:      398_221 },
    { name: 'Departmental restricted revenue',             total:      281_236 },
    { name: 'Federal grants',                              total:    2_826_622 },
    { name: 'Income from investments',                     total:        3_678 },
    { name: 'Other revenues',                              total:       53_548 },
  ]},
  2020: { total: 7_248_375, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total:    3_258_093 },
    { name: 'Licenses, fines, tolls, sales, and services', total:      406_489 },
    { name: 'Departmental restricted revenue',             total:      349_753 },
    { name: 'Federal grants',                              total:    3_128_124 },
    { name: 'Income from investments',                     total:        2_360 },
    { name: 'Other revenues',                              total:      103_556 },
  ]},
  2021: { total: 9_088_056, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total:    3_688_078 },
    { name: 'Licenses, fines, tolls, sales, and services', total:      378_662 },
    { name: 'Departmental restricted revenue',             total:      305_523 },
    { name: 'Federal grants',                              total:    4_649_167 },
    { name: 'Income from investments',                     total:        1_976 },
    { name: 'Other revenues',                              total:       64_650 },
  ]},
  2022: { total: 9_968_782, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total:    4_349_512 },
    { name: 'Licenses, fines, tolls, sales, and services', total:      407_799 },
    { name: 'Departmental restricted revenue',             total:      398_431 },
    { name: 'Federal grants',                              total:    4_744_086 },
    { name: 'Income from investments',                     total:        4_625 },
    { name: 'Other revenues',                              total:       64_329 },
  ]},
  2023: { total: 10_114_548, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total:    4_232_037 },
    { name: 'Licenses, fines, tolls, sales, and services', total:      413_645 },
    { name: 'Departmental restricted revenue',             total:      327_533 },
    { name: 'Federal grants',                              total:    5_023_852 },
    { name: 'Income from investments',                     total:       59_650 },
    { name: 'Other revenues',                              total:       57_831 },
  ]},
  2024: { total: 9_877_471, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    4_368_246 },
    { name: 'Licenses, fines, sales, and services', total:      454_190 },
    { name: 'Departmental restricted revenue',      total:      391_363 },
    { name: 'Federal grants',                       total:    4_513_493 },
    { name: 'Income from investments',              total:       69_494 },
    { name: 'Other revenues',                       total:       80_685 },
  ]},
  2025: { total: 10_095_792, confidence: 'actual', categories: [
    { name: 'Taxes',                                total:    4_554_628 },
    { name: 'Licenses, fines, sales, and services', total:      480_530 },
    { name: 'Departmental restricted revenue',      total:      387_011 },
    { name: 'Federal grants',                       total:    4_551_647 },
    { name: 'Income (loss) from investments',       total:       47_546 },
    { name: 'Other revenues',                       total:       74_430 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name.trim()} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name.trim(); // WR-01: trim so a stray-space transcription can never fork a category name across years
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Rhode Island General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06: validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (REVENUE[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
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
    const srcPayload = { name: 'Rhode Island General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ri-acfr-gf-revenue', base_url: 'https://controller.admin.ri.gov/financial-reporting-and-accounting/financial-reports', fiscal_years: [2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
      console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
      const { jsonTree, total, rowCount } = buildTree(fy);
      const cats = jsonTree[0].c;
      console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
      for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
      const neg = REVENUE[fy].categories.filter(c => c.total < 0);
      for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
      console.log('─'.repeat(72)); console.log(`${'TOTAL REVENUES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
      console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
      if (dryRun) { console.log(`(dry-run)\n`); continue; }
      const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
      if (rpcErr) throw new Error(`FY${fy} RPC error: ${rpcErr.message}`);
      if (r?.error) throw new Error(`FY${fy} RPC error: ${r.error}`);
      console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
      if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`); // WR-07: surface select errors — do not misreport as a missing row
      if (bud?.id) {
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
        if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`);
        console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
      } else { throw new Error(`Could not find FY${fy} revenue budget row to stamp source`); }
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
