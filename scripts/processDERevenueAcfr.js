#!/usr/bin/env node
/**
 * Delaware General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Delaware Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the DE state node → pure insert keyed (muni,fy,'revenue').
 *   DE state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-35): DE ACFR GF ~1.20x NASBO GF (FY2025 $7,475,243K vs FY2024 NASBO
 *   $6,232,000K) -- smallest divergence in Batch 1. Delaware reports Federal grants in their OWN
 *   major-fund column (General | Federal | Local School Districts | Capital Projects | Total), so the
 *   GENERAL column stays close to NASBO's own-source concept. Accepted-and-relabelled honestly.
 *
 * ACCESS (Referer WAF): accountingfiles.delaware.gov returns a 245-byte "Request Rejected" HTML
 *   soft-404 at HTTP 200 without a Referer header. All PDFs fetched with
 *   Referer: https://accounting.delaware.gov/...; %PDF-magic + size guards independently reject the
 *   soft-404. Naming: {YYYY}acfr.pdf FY2021-2025, {YYYY}cafr.pdf FY2004-2020.
 *
 * HOLE: FY2005 (404 - not published in the archive). Durable window = FY2004 + FY2006-FY2025 (21 yr).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Interest and Other Investment Income positive at both bookends (FY2025 +$238,663K, FY2004 +$30,713K); every loaded year scanned - clamp is the render path if any interior year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/de/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processDERevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Delaware'; const STATE_ABBR = 'DE'; const POPULATION = 989_948;
const EXPECTED_MUNI_ID = 'a7854fa3-8e68-4a0e-b92a-415bad6bccd2';
const UNITS = 1_000; // DE ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2004: { url: 'https://accountingfiles.delaware.gov/docs/2004cafr.pdf', date: '2004-06-30' },
  2006: { url: 'https://accountingfiles.delaware.gov/docs/2006cafr.pdf', date: '2006-06-30' },
  2007: { url: 'https://accountingfiles.delaware.gov/docs/2007cafr.pdf', date: '2007-06-30' },
  2008: { url: 'https://accountingfiles.delaware.gov/docs/2008cafr.pdf', date: '2008-06-30' },
  2009: { url: 'https://accountingfiles.delaware.gov/docs/2009cafr.pdf', date: '2009-06-30' },
  2010: { url: 'https://accountingfiles.delaware.gov/docs/2010cafr.pdf', date: '2010-06-30' },
  2011: { url: 'https://accountingfiles.delaware.gov/docs/2011cafr.pdf', date: '2011-06-30' },
  2012: { url: 'https://accountingfiles.delaware.gov/docs/2012cafr.pdf', date: '2012-06-30' },
  2013: { url: 'https://accountingfiles.delaware.gov/docs/2013cafr.pdf', date: '2013-06-30' },
  2014: { url: 'https://accountingfiles.delaware.gov/docs/2014cafr.pdf', date: '2014-06-30' },
  2015: { url: 'https://accountingfiles.delaware.gov/docs/2015cafr.pdf', date: '2015-06-30' },
  2016: { url: 'https://accountingfiles.delaware.gov/docs/2016cafr.pdf', date: '2016-06-30' },
  2017: { url: 'https://accountingfiles.delaware.gov/docs/2017cafr.pdf', date: '2017-06-30' },
  2018: { url: 'https://accountingfiles.delaware.gov/docs/2018cafr.pdf', date: '2018-06-30' },
  2019: { url: 'https://accountingfiles.delaware.gov/docs/2019cafr.pdf', date: '2019-06-30' },
  2020: { url: 'https://accountingfiles.delaware.gov/docs/2020cafr.pdf', date: '2020-06-30' },
  2021: { url: 'https://accountingfiles.delaware.gov/docs/2021acfr.pdf', date: '2021-06-30' },
  2022: { url: 'https://accountingfiles.delaware.gov/docs/2022acfr.pdf', date: '2022-06-30' },
  2023: { url: 'https://accountingfiles.delaware.gov/docs/2023acfr.pdf', date: '2023-06-30' },
  2024: { url: 'https://accountingfiles.delaware.gov/docs/2024acfr.pdf', date: '2024-06-30' },
  2025: { url: 'https://accountingfiles.delaware.gov/docs/2025acfr.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Delaware State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — DE ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2004: { total: 3_055_310, confidence: 'actual', categories: [
    { name: 'Personal taxes',                     total:      782_369 },
    { name: 'Business taxes',                     total:    1_359_569 },
    { name: 'Other tax revenue',                  total:      240_939 },
    { name: 'Licenses, fees, permits and fines',  total:      295_379 },
    { name: 'Rentals and sales',                  total:       22_347 },
    { name: 'Federal government',                 total:       70_735 },
    { name: 'Interest & other investment income', total:       30_713 },
    { name: 'Other',                              total:      253_259 },
  ]},
  2006: { total: 3_552_457, confidence: 'actual', categories: [
    { name: 'Personal taxes',                     total:    1_013_151 },
    { name: 'Business taxes',                     total:    1_537_344 },
    { name: 'Other tax revenue',                  total:      287_506 },
    { name: 'Licenses, fees, permits and fines',  total:      319_046 },
    { name: 'Rentals and sales',                  total:       21_037 },
    { name: 'Federal government',                 total:       32_744 },
    { name: 'Interest & other investment income', total:       39_912 },
    { name: 'Other',                              total:      301_717 },
  ]},
  2007: { total: 3_680_628, confidence: 'actual', categories: [
    { name: 'Personal taxes',                       total:    1_012_824 },
    { name: 'Business taxes',                       total:    1_668_434 },
    { name: 'Other tax revenue',                    total:      254_846 },
    { name: 'Licenses, fees, permits and fines',    total:      338_496 },
    { name: 'Rentals and sales',                    total:       22_927 },
    { name: 'Federal government',                   total:       33_154 },
    { name: 'Interest and other investment income', total:       66_541 },
    { name: 'Other',                                total:      283_406 },
  ]},
  2008: { total: 3_513_679, confidence: 'actual', categories: [
    { name: 'Personal taxes',                       total:    1_008_734 },
    { name: 'Business taxes',                       total:    1_663_611 },
    { name: 'Other tax revenue',                    total:      277_151 },
    { name: 'Licenses, fees, permits and fines',    total:      353_523 },
    { name: 'Rentals and sales',                    total:       25_510 },
    { name: 'Federal government',                   total:       34_293 },
    { name: 'Interest and other investment income', total:       68_239 },
    { name: 'Other',                                total:       82_618 },
  ]},
  2009: { total: 3_381_380, confidence: 'actual', categories: [
    { name: 'Personal taxes',                       total:      914_460 },
    { name: 'Business taxes',                       total:    1_655_938 },
    { name: 'Other tax revenue',                    total:      238_786 },
    { name: 'Licenses, fees, permits and fines',    total:      353_669 },
    { name: 'Rentals and sales',                    total:       27_567 },
    { name: 'Federal government',                   total:       44_818 },
    { name: 'Interest and other investment income', total:       33_012 },
    { name: 'Other',                                total:      113_130 },
  ]},
  2010: { total: 3_457_800, confidence: 'actual', categories: [
    { name: 'Personal taxes',                       total:      743_774 },
    { name: 'Business taxes',                       total:    1_820_023 },
    { name: 'Other tax revenue',                    total:      250_630 },
    { name: 'Licenses, fees, permits and fines',    total:      390_386 },
    { name: 'Rentals and sales',                    total:       24_511 },
    { name: 'Federal government',                   total:       36_352 },
    { name: 'Interest and other investment income', total:       15_346 },
    { name: 'Other',                                total:      176_778 },
  ]},
  2011: { total: 3_735_337, confidence: 'actual', categories: [
    { name: 'Personal taxes',                       total:      986_002 },
    { name: 'Business taxes',                       total:    1_926_473 },
    { name: 'Other tax revenue',                    total:      246_268 },
    { name: 'Licenses, fees, permits and fines',    total:      325_320 },
    { name: 'Rentals and sales',                    total:      110_193 },
    { name: 'Grants',                               total:       39_005 },
    { name: 'Interest and other investment income', total:       25_184 },
    { name: 'Other',                                total:       76_892 },
  ]},
  2012: { total: 3_834_771, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_095_477 },
    { name: 'Business Taxes',                       total:    1_811_522 },
    { name: 'Other Tax Revenue',                    total:      241_276 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      330_081 },
    { name: 'Rentals and Sales',                    total:      108_131 },
    { name: 'Grants',                               total:       32_590 },
    { name: 'Interest and Other Investment Income', total:       30_039 },
    { name: 'Other',                                total:      185_655 },
  ]},
  2013: { total: 4_093_235, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_130_501 },
    { name: 'Business Taxes',                       total:    2_051_071 },
    { name: 'Other Tax Revenue',                    total:      217_880 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      335_566 },
    { name: 'Rentals and Sales',                    total:      125_033 },
    { name: 'Grants',                               total:       36_882 },
    { name: 'Interest and Other Investment Income', total:        9_425 },
    { name: 'Other',                                total:      186_877 },
  ]},
  2014: { total: 3_994_433, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_040_341 },
    { name: 'Business Taxes',                       total:    2_061_007 },
    { name: 'Other Tax Revenue',                    total:      232_017 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      351_227 },
    { name: 'Rentals and Sales',                    total:       77_653 },
    { name: 'Grants',                               total:       42_785 },
    { name: 'Interest and Other Investment Income', total:       12_533 },
    { name: 'Other',                                total:      176_870 },
  ]},
  2015: { total: 4_343_966, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_140_248 },
    { name: 'Business Taxes',                       total:    2_290_097 },
    { name: 'Other Tax Revenue',                    total:      224_841 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      373_797 },
    { name: 'Rentals and Sales',                    total:      111_840 },
    { name: 'Grants',                               total:       49_747 },
    { name: 'Interest and Other Investment Income', total:        8_534 },
    { name: 'Other',                                total:      144_862 },
  ]},
  2016: { total: 4_367_923, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_112_368 },
    { name: 'Business Taxes',                       total:    2_293_182 },
    { name: 'Other Tax Revenue',                    total:      244_524 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      374_282 },
    { name: 'Rentals and Sales',                    total:      120_006 },
    { name: 'Grants',                               total:       51_129 },
    { name: 'Interest and Other Investment Income', total:        9_608 },
    { name: 'Other',                                total:      162_824 },
  ]},
  2017: { total: 4_557_880, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_180_975 },
    { name: 'Business Taxes',                       total:    2_280_255 },
    { name: 'Other Tax Revenue',                    total:      256_995 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      411_840 },
    { name: 'Rentals and Sales',                    total:      115_869 },
    { name: 'Grants',                               total:       34_057 },
    { name: 'Interest and Other Investment Income', total:       13_400 },
    { name: 'Other',                                total:      264_489 },
  ]},
  2018: { total: 4_873_533, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_309_214 },
    { name: 'Business Taxes',                       total:    2_489_979 },
    { name: 'Other Tax Revenue',                    total:      309_191 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      417_492 },
    { name: 'Rentals and Sales',                    total:      108_211 },
    { name: 'Grants',                               total:       50_656 },
    { name: 'Interest and Other Investment Income', total:       20_914 },
    { name: 'Other',                                total:      167_876 },
  ]},
  2019: { total: 5_115_632, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_349_476 },
    { name: 'Business Taxes',                       total:    2_594_360 },
    { name: 'Other Tax Revenue',                    total:      355_347 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      453_947 },
    { name: 'Rentals and Sales',                    total:      105_895 },
    { name: 'Grants',                               total:       54_790 },
    { name: 'Interest and Other Investment Income', total:       38_404 },
    { name: 'Other',                                total:      163_413 },
  ]},
  2020: { total: 5_109_350, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_292_933 },
    { name: 'Business Taxes',                       total:    2_660_040 },
    { name: 'Other Tax Revenue',                    total:      350_942 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      439_238 },
    { name: 'Rentals and Sales',                    total:       96_397 },
    { name: 'Grants',                               total:       54_906 },
    { name: 'Interest and Other Investment Income', total:       68_127 },
    { name: 'Other',                                total:      146_767 },
  ]},
  2021: { total: 6_074_174, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_710_881 },
    { name: 'Business Taxes',                       total:    2_996_453 },
    { name: 'Other Tax Revenue',                    total:      425_325 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      516_986 },
    { name: 'Rentals and Sales',                    total:      101_289 },
    { name: 'Grants',                               total:       34_048 },
    { name: 'Interest and Other Investment Income', total:       78_245 },
    { name: 'Other',                                total:      210_947 },
  ]},
  2022: { total: 6_630_050, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    1_945_182 },
    { name: 'Business Taxes',                       total:    3_314_726 },
    { name: 'Other Tax Revenue',                    total:      502_224 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      561_696 },
    { name: 'Rentals and Sales',                    total:       91_298 },
    { name: 'Grants',                               total:       27_723 },
    { name: 'Interest and Other Investment Income', total:       24_397 },
    { name: 'Other',                                total:      162_804 },
  ]},
  2023: { total: 7_014_739, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    2_164_548 },
    { name: 'Business Taxes',                       total:    4_031_260 },
    { name: 'Other Tax Revenue',                    total:           89 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      541_387 },
    { name: 'Rentals and Sales',                    total:       81_752 },
    { name: 'Grants',                               total:       30_048 },
    { name: 'Interest and Other Investment Income', total:       50_748 },
    { name: 'Other',                                total:      114_907 },
  ]},
  2024: { total: 7_145_545, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    2_237_948 },
    { name: 'Business Taxes',                       total:    3_911_560 },
    { name: 'Other Tax Revenue',                    total:          119 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      549_084 },
    { name: 'Rentals and Sales',                    total:       83_125 },
    { name: 'Grants',                               total:       29_286 },
    { name: 'Interest and Other Investment Income', total:      181_355 },
    { name: 'Other',                                total:      153_068 },
  ]},
  2025: { total: 7_475_243, confidence: 'actual', categories: [
    { name: 'Personal Taxes',                       total:    2_372_854 },
    { name: 'Business Taxes',                       total:    3_938_979 },
    { name: 'Other Tax Revenue',                    total:          111 },
    { name: 'Licenses, Fees, Permits and Fines',    total:      523_113 },
    { name: 'Rentals and Sales',                    total:       94_377 },
    { name: 'Grants',                               total:       30_410 },
    { name: 'Interest and Other Investment Income', total:      238_663 },
    { name: 'Other',                                total:      276_736 },
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
  return { jsonTree: [{ n: 'Delaware General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2004, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Delaware General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'de-acfr-gf-revenue', base_url: 'https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/', fiscal_years: [2004,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
