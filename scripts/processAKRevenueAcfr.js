#!/usr/bin/env node
/**
 * Alaska General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Alaska Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the AK state node → pure insert keyed (muni,fy,'revenue').
 *   AK state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-33): AK ACFR GF ~1.32x NASBO GF (FY2025 $8,378,945K vs FY2024 NASBO $6,339,000K).
 *   Federal Grants in Aid ($4,833,918K FY2025) consolidated into the GAAP General Fund column;
 *   NASBO's narrower budgetary GF concept excludes most of it. Accepted-and-relabelled honestly (TX precedent).
 *
 * NAMING: FY2020-2025 = {YYYY}acfr.pdf; FY2010-2019 = {YYYY}cafr.pdf; FY2006-2009 = {YY}cafr.pdf (2-digit).
 *   FY1998-2005 not durably linked on the DOF reports page (FY1998/99 present but pre-GASB-34 / no clean tie;
 *   FY2000-2005 absent) -> honest holes. Durable clean window = FY2006-FY2025 (20 contiguous years).
 *
 * PRE-LOAD CLEANUP (WR-05/LOAD-01): 2 orphaned data_sources rows (ak-ugf-revenue, ak-ugf-operating,
 *   from an abandoned HTML loader, 0 referencing budgets rows) deleted before this load (see 118-01-AK-LOADLOG.md).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Interest and Investment Income (Loss) positive at both bookends (FY2025 +$350,330K, FY2020 +$273,988K); every loaded year scanned - clamp is the render path if any interior year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ak/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processAKRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Alaska'; const STATE_ABBR = 'AK'; const POPULATION = 733_391;
const EXPECTED_MUNI_ID = 'b268c415-0058-4fea-8ba1-24f49fb434b4';
const UNITS = 1_000; // AK ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2006: { url: 'https://doa.alaska.gov/dof/reports/resource/06cafr.pdf', date: '2006-06-30' },
  2007: { url: 'https://doa.alaska.gov/dof/reports/resource/07cafr.pdf', date: '2007-06-30' },
  2008: { url: 'https://doa.alaska.gov/dof/reports/resource/08cafr.pdf', date: '2008-06-30' },
  2009: { url: 'https://doa.alaska.gov/dof/reports/resource/09cafr.pdf', date: '2009-06-30' },
  2010: { url: 'https://doa.alaska.gov/dof/reports/resource/2010cafr.pdf', date: '2010-06-30' },
  2011: { url: 'https://doa.alaska.gov/dof/reports/resource/2011cafr.pdf', date: '2011-06-30' },
  2012: { url: 'https://doa.alaska.gov/dof/reports/resource/2012cafr.pdf', date: '2012-06-30' },
  2013: { url: 'https://doa.alaska.gov/dof/reports/resource/2013cafr.pdf', date: '2013-06-30' },
  2014: { url: 'https://doa.alaska.gov/dof/reports/resource/2014cafr.pdf', date: '2014-06-30' },
  2015: { url: 'https://doa.alaska.gov/dof/reports/resource/2015cafr.pdf', date: '2015-06-30' },
  2016: { url: 'https://doa.alaska.gov/dof/reports/resource/2016cafr.pdf', date: '2016-06-30' },
  2017: { url: 'https://doa.alaska.gov/dof/reports/resource/2017cafr.pdf', date: '2017-06-30' },
  2018: { url: 'https://doa.alaska.gov/dof/reports/resource/2018cafr.pdf', date: '2018-06-30' },
  2019: { url: 'https://doa.alaska.gov/dof/reports/resource/2019cafr.pdf', date: '2019-06-30' },
  2020: { url: 'https://doa.alaska.gov/dof/reports/resource/2020acfr.pdf', date: '2020-06-30' },
  2021: { url: 'https://doa.alaska.gov/dof/reports/resource/2021acfr.pdf', date: '2021-06-30' },
  2022: { url: 'https://doa.alaska.gov/dof/reports/resource/2022acfr.pdf', date: '2022-06-30' },
  2023: { url: 'https://doa.alaska.gov/dof/reports/resource/2023acfr.pdf', date: '2023-06-30' },
  2024: { url: 'https://doa.alaska.gov/dof/reports/resource/2024acfr.pdf', date: '2024-06-30' },
  2025: { url: 'https://doa.alaska.gov/dof/reports/resource/2025acfr.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Alaska State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — AK ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2006: { total: 6_729_788, confidence: 'actual', categories: [
    { name: 'Taxes',                            total:    2_333_869 },
    { name: 'Licenses and Permits',             total:      102_094 },
    { name: 'Charges for Services',             total:      158_204 },
    { name: 'Fines and Forfeitures',            total:       10_368 },
    { name: 'Rents and Royalties',              total:    1_802_250 },
    { name: 'Premiums and Contributions',       total:       11_567 },
    { name: 'Interest and Investment Income',   total:      179_024 },
    { name: 'Federal Grants in Aid',            total:    1_970_439 },
    { name: 'Payments In from Component Units', total:      104_555 },
    { name: 'Other Revenues',                   total:       57_418 },
  ]},
  2007: { total: 7_913_903, confidence: 'actual', categories: [
    { name: 'Taxes',                            total:    3_435_465 },
    { name: 'Licenses and Permits',             total:      108_660 },
    { name: 'Charges for Services',             total:      180_292 },
    { name: 'Fines and Forfeitures',            total:       32_047 },
    { name: 'Rents and Royalties',              total:    1_606_758 },
    { name: 'Premiums and Contributions',       total:       11_988 },
    { name: 'Interest and Investment Income',   total:      431_222 },
    { name: 'Federal Grants in Aid',            total:    1_993_028 },
    { name: 'Payments In from Component Units', total:       99_806 },
    { name: 'Other Revenues',                   total:       14_637 },
  ]},
  2008: { total: 13_546_006, confidence: 'actual', categories: [
    { name: 'Taxes',                            total:    8_257_149 },
    { name: 'Licenses and Permits',             total:      114_669 },
    { name: 'Charges for Services',             total:      178_835 },
    { name: 'Fines and Forfeitures',            total:       18_503 },
    { name: 'Rents and Royalties',              total:    2_489_036 },
    { name: 'Premiums and Contributions',       total:       12_625 },
    { name: 'Interest and Investment Income',   total:      446_107 },
    { name: 'Federal Grants in Aid',            total:    1_897_299 },
    { name: 'Payments In from Component Units', total:      115_635 },
    { name: 'Other Revenues',                   total:       16_148 },
  ]},
  2009: { total: 8_184_978, confidence: 'actual', categories: [
    { name: 'Taxes',                            total:    4_311_323 },
    { name: 'Licenses and Permits',             total:      113_988 },
    { name: 'Charges for Services',             total:      175_723 },
    { name: 'Fines and Forfeitures',            total:       13_678 },
    { name: 'Rents and Royalties',              total:    1_559_849 },
    { name: 'Premiums and Contributions',       total:       16_595 },
    { name: 'Interest and Investment Income',   total:     -145_218 },
    { name: 'Federal Grants in Aid',            total:    2_088_385 },
    { name: 'Payments In from Component Units', total:       26_392 },
    { name: 'Other Revenues',                   total:       24_263 },
  ]},
  2010: { total: 8_802_752, confidence: 'actual', categories: [
    { name: 'Taxes',                            total:    3_578_905 },
    { name: 'Licenses and Permits',             total:      113_995 },
    { name: 'Charges for Services',             total:      163_896 },
    { name: 'Fines and Forfeitures',            total:       14_637 },
    { name: 'Rents and Royalties',              total:    1_548_026 },
    { name: 'Premiums and Contributions',       total:       16_348 },
    { name: 'Interest and Investment Income',   total:      925_117 },
    { name: 'Federal Grants in Aid',            total:    2_394_054 },
    { name: 'Payments In from Component Units', total:       40_538 },
    { name: 'Other Revenues',                   total:        7_236 },
  ]},
  2011: { total: 11_186_572, confidence: 'actual', categories: [
    { name: 'Taxes',                            total:    5_358_324 },
    { name: 'Licenses and Permits',             total:      117_310 },
    { name: 'Charges for Services',             total:      179_309 },
    { name: 'Fines and Forfeitures',            total:       11_574 },
    { name: 'Rents and Royalties',              total:    1_875_836 },
    { name: 'Premiums and Contributions',       total:       17_787 },
    { name: 'Interest and Investment Income',   total:    1_158_989 },
    { name: 'Federal Grants in Aid',            total:    2_407_903 },
    { name: 'Payments In from Component Units', total:       42_866 },
    { name: 'Other Revenues',                   total:       16_674 },
  ]},
  2012: { total: 12_411_317, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    7_163_646 },
    { name: 'Licenses and Permits',                  total:      117_873 },
    { name: 'Charges for Services',                  total:      197_080 },
    { name: 'Fines and Forfeitures',                 total:       13_333 },
    { name: 'Rents and Royalties',                   total:    2_062_103 },
    { name: 'Premiums and Contributions',            total:       19_017 },
    { name: 'Interest and Investment Income (Loss)', total:      309_468 },
    { name: 'Federal Grants in Aid',                 total:    2_464_928 },
    { name: 'Payments In from Component Units',      total:       39_463 },
    { name: 'Other Revenues',                        total:       24_406 },
  ]},
  2013: { total: 10_345_865, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    4_765_743 },
    { name: 'Licenses and Permits',                  total:      119_401 },
    { name: 'Charges for Services',                  total:      193_421 },
    { name: 'Fines and Forfeitures',                 total:       30_113 },
    { name: 'Rents and Royalties',                   total:    1_949_548 },
    { name: 'Premiums and Contributions',            total:       19_858 },
    { name: 'Interest and Investment Income (Loss)', total:      766_717 },
    { name: 'Federal Grants in Aid',                 total:    2_392_390 },
    { name: 'Payments In from Component Units',      total:       31_336 },
    { name: 'Other Revenues',                        total:       77_338 },
  ]},
  2014: { total: 8_810_997, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    2_954_303 },
    { name: 'Licenses and Permits',                  total:      124_275 },
    { name: 'Charges for Services',                  total:      184_031 },
    { name: 'Fines and Forfeitures',                 total:       16_672 },
    { name: 'Rents and Royalties',                   total:    1_764_480 },
    { name: 'Premiums and Contributions',            total:       19_555 },
    { name: 'Interest and Investment Income (Loss)', total:    1_279_567 },
    { name: 'Federal Grants in Aid',                 total:    2_410_524 },
    { name: 'Payments In from Component Units',      total:       22_578 },
    { name: 'Other Revenues',                        total:       35_012 },
  ]},
  2015: { total: 4_853_356, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:      491_736 },
    { name: 'Licenses and Permits',                  total:      130_090 },
    { name: 'Charges for Services',                  total:      199_316 },
    { name: 'Fines and Forfeitures',                 total:       15_269 },
    { name: 'Rents and Royalties',                   total:    1_106_060 },
    { name: 'Premiums and Contributions',            total:       20_638 },
    { name: 'Interest and Investment Income (Loss)', total:      336_928 },
    { name: 'Federal Grants in Aid',                 total:    2_512_735 },
    { name: 'Payments In from Component Units',      total:       14_106 },
    { name: 'Other Revenues',                        total:       26_478 },
  ]},
  2016: { total: 4_237_804, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:      107_074 },
    { name: 'Licenses and Permits',                  total:      131_428 },
    { name: 'Charges for Services',                  total:      183_424 },
    { name: 'Fines and Forfeitures',                 total:       32_357 },
    { name: 'Rents and Royalties',                   total:      640_843 },
    { name: 'Premiums and Contributions',            total:       21_286 },
    { name: 'Interest and Investment Income (Loss)', total:      195_405 },
    { name: 'Federal Grants in Aid',                 total:    2_705_575 },
    { name: 'Payments In from Component Units',      total:      174_720 },
    { name: 'Other Revenues',                        total:       45_692 },
  ]},
  2017: { total: 5_357_956, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:      658_248 },
    { name: 'Licenses and Permits',                  total:      110_701 },
    { name: 'Charges for Services',                  total:      214_073 },
    { name: 'Fines and Forfeitures',                 total:       40_172 },
    { name: 'Rents and Royalties',                   total:      790_810 },
    { name: 'Premiums and Contributions',            total:       21_955 },
    { name: 'Interest and Investment Income (Loss)', total:      243_845 },
    { name: 'Federal Grants in Aid',                 total:    3_198_234 },
    { name: 'Payments In from Component Units',      total:       31_180 },
    { name: 'Other Revenues',                        total:       48_738 },
  ]},
  2018: { total: 6_100_336, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    1_315_920 },
    { name: 'Licenses and Permits',                  total:      127_311 },
    { name: 'Charges for Services',                  total:      173_194 },
    { name: 'Fines and Forfeitures',                 total:       18_935 },
    { name: 'Rents and Royalties',                   total:    1_093_966 },
    { name: 'Premiums and Contributions',            total:       19_229 },
    { name: 'Interest and Investment Income (Loss)', total:      145_736 },
    { name: 'Federal Grants in Aid',                 total:    3_124_624 },
    { name: 'Payments In from Component Units',      total:       12_765 },
    { name: 'Other Revenues',                        total:       68_656 },
  ]},
  2019: { total: 7_966_417, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    1_556_683 },
    { name: 'Licenses and Permits',                  total:      135_212 },
    { name: 'Charges for Services',                  total:      178_994 },
    { name: 'Fines and Forfeitures',                 total:       31_964 },
    { name: 'Rents and Royalties',                   total:    1_136_886 },
    { name: 'Premiums and Contributions',            total:       21_103 },
    { name: 'Interest and Investment Income (Loss)', total:      300_555 },
    { name: 'Federal Grants in Aid',                 total:    3_445_839 },
    { name: 'Payments In from Component Units',      total:    1_101_223 },
    { name: 'Other Revenues',                        total:       57_958 },
  ]},
  2020: { total: 6_063_851, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    1_010_045 },
    { name: 'Licenses and Permits',                  total:      128_506 },
    { name: 'Charges for Services',                  total:      152_784 },
    { name: 'Fines and Forfeitures',                 total:       20_698 },
    { name: 'Rents and Royalties',                   total:      721_720 },
    { name: 'Premiums and Contributions',            total:       29_751 },
    { name: 'Interest and Investment Income (Loss)', total:      273_988 },
    { name: 'Federal Grants in Aid',                 total:    3_615_881 },
    { name: 'Payments In from Component Units',      total:       66_687 },
    { name: 'Other Revenues',                        total:       43_791 },
  ]},
  2021: { total: 7_186_707, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:      963_261 },
    { name: 'Licenses and Permits',                  total:      134_710 },
    { name: 'Charges for Services',                  total:      149_556 },
    { name: 'Fines and Forfeitures',                 total:       23_292 },
    { name: 'Rents and Royalties',                   total:      751_872 },
    { name: 'Premiums and Contributions',            total:       20_313 },
    { name: 'Interest and Investment Income (Loss)', total:      124_764 },
    { name: 'Federal Grants in Aid',                 total:    4_893_566 },
    { name: 'Payments In from Component Units',      total:       43_328 },
    { name: 'Other Revenues',                        total:       82_045 },
  ]},
  2022: { total: 9_805_910, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    2_851_892 },
    { name: 'Licenses and Permits',                  total:      133_157 },
    { name: 'Charges for Services',                  total:      154_148 },
    { name: 'Fines and Forfeitures',                 total:       17_202 },
    { name: 'Rents and Royalties',                   total:    1_325_552 },
    { name: 'Premiums and Contributions',            total:       22_950 },
    { name: 'Interest and Investment Income (Loss)', total:     -133_629 },
    { name: 'Federal Grants in Aid',                 total:    5_359_097 },
    { name: 'Payments In from Component Units',      total:       30_543 },
    { name: 'Other Revenues',                        total:       44_998 },
  ]},
  2023: { total: 9_839_066, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    2_764_821 },
    { name: 'Licenses and Permits',                  total:      139_925 },
    { name: 'Charges for Services',                  total:      178_347 },
    { name: 'Fines and Forfeitures',                 total:       30_060 },
    { name: 'Rents and Royalties',                   total:    1_221_703 },
    { name: 'Premiums and Contributions',            total:       25_469 },
    { name: 'Interest and Investment Income (Loss)', total:      279_449 },
    { name: 'Federal Grants in Aid',                 total:    5_109_390 },
    { name: 'Payments In from Component Units',      total:       44_516 },
    { name: 'Other Revenues',                        total:       45_386 },
  ]},
  2024: { total: 8_744_722, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    1_915_270 },
    { name: 'Licenses and Permits',                  total:      140_461 },
    { name: 'Charges for Services',                  total:      190_160 },
    { name: 'Fines and Forfeitures',                 total:       57_217 },
    { name: 'Rents and Royalties',                   total:    1_197_703 },
    { name: 'Premiums and Contributions',            total:       29_280 },
    { name: 'Interest and Investment Income (Loss)', total:      368_502 },
    { name: 'Federal Grants in Aid',                 total:    4_775_541 },
    { name: 'Payments In from Component Units',      total:       16_300 },
    { name: 'Other Revenues',                        total:       54_288 },
  ]},
  2025: { total: 8_378_945, confidence: 'actual', categories: [
    { name: 'Taxes',                                 total:    1_600_605 },
    { name: 'Licenses and Permits',                  total:      145_208 },
    { name: 'Charges for Services',                  total:      182_882 },
    { name: 'Fines and Forfeitures',                 total:       59_341 },
    { name: 'Rents and Royalties',                   total:    1_059_348 },
    { name: 'Premiums and Contributions',            total:       38_327 },
    { name: 'Interest and Investment Income (Loss)', total:      350_330 },
    { name: 'Federal Grants in Aid',                 total:    4_833_918 },
    { name: 'Payments In from Component Units',      total:       51_038 },
    { name: 'Other Revenues',                        total:       57_948 },
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
  return { jsonTree: [{ n: 'Alaska General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Alaska General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ak-acfr-gf-revenue', base_url: 'https://doa.alaska.gov/dof/reports/annualreport.html', fiscal_years: [2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
