#!/usr/bin/env node
/**
 * Idaho General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Idaho Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the ID state node → pure insert keyed (muni,fy,'revenue').
 *   ID state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-37): ID ACFR GF ~1.33x NASBO GF (FY2025 $6,658,024K vs FY2024 NASBO
 *   $5,020,000K). Health and Welfare (most Medicaid federal match, $4.36B FY2025) is a SEPARATE major
 *   fund column, so the ratio reflects ID broader own-source tax GF, not federal consolidation.
 *   Accepted-and-relabelled honestly. GENERAL is 1st of 3-4 (General | Health and Welfare |
 *   Transportation | [Public School Endowment]).
 *
 * MIXED UNITS (the ID trap) -- RESOLVED at JSON-assembly time: FY2004 statement is in WHOLE DOLLARS
 *   (rev $2,314,491,978), FY2005-FY2025 are in THOUSANDS. build_state.py units_by_year={2004:1}
 *   normalizes FY2004 to thousands (div 1000) so ALL years are uniform thousands and this loader keeps a
 *   single UNITS=1000 (the reusable per-year units override lives in the assembler, not per generated
 *   loader). FY2004 ties within tolerance (rounding diff 1 thousand). Transition is FY2004->FY2005 only.
 *
 * NAMING (3-way): {YYYY} Annual Comprehensive Financial Report.pdf (FY2024-2025);
 *   {YYYY} Annual Comprehensive Financial Review.pdf (FY2021-2023, "Review"); {YYYY} Comprehensive
 *   Annual Financial Report.pdf (FY2004-2020). Host www.sco.idaho.gov/CAFRDocuments/, %20 spaces.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment Income (Loss)" is positive at both bookends (FY2025 +$200,696K); the (Loss) label flags a plausible negative interior year -- clamp is the render path (ACFR-32).
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/id/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processIDRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Idaho'; const STATE_ABBR = 'ID'; const POPULATION = 1_839_106;
const EXPECTED_MUNI_ID = '247ca2d0-44bc-4ef0-bc0d-4875758bae5e';
const UNITS = 1_000; // ID ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2004: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2004%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2004-06-30' },
  2005: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2005%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2005-06-30' },
  2006: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2006%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2006-06-30' },
  2007: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2007%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2007-06-30' },
  2008: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2008%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2009%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2010%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2011%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2012%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2013%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2014%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2015%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2016%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2017%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2018%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2019%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2020%20Comprehensive%20Annual%20Financial%20Report.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2021%20Annual%20Comprehensive%20Financial%20Review.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2022%20Annual%20Comprehensive%20Financial%20Review.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2023%20Annual%20Comprehensive%20Financial%20Review.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2024%20Annual%20Comprehensive%20Financial%20Report.pdf', date: '2024-06-30' },
  2025: { url: 'https://www.sco.idaho.gov/CAFRDocuments/2025%20Annual%20Comprehensive%20Financial%20Report.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Idaho State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — ID ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2004: { total: 2_314_492, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_035_648 },
    { name: 'Individual and Corporate Taxes', total:      997_454 },
    { name: 'Other Taxes',                    total:       62_735 },
    { name: 'Licenses, Permits, and Fees',    total:       29_846 },
    { name: 'Sale of Goods and Services',     total:       69_043 },
    { name: 'Grants and Contributions',       total:       58_221 },
    { name: 'Investment Income',              total:       13_191 },
    { name: 'Tobacco Settlement',             total:       22_848 },
    { name: 'Other Income',                   total:       25_505 },
  ]},
  2005: { total: 2_534_075, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_132_338 },
    { name: 'Individual and Corporate Taxes', total:    1_176_903 },
    { name: 'Other Taxes',                    total:       63_058 },
    { name: 'Licenses, Permits, and Fees',    total:       18_217 },
    { name: 'Sale of Goods and Services',     total:       76_549 },
    { name: 'Grants and Contributions',       total:        2_035 },
    { name: 'Investment Income',              total:       19_030 },
    { name: 'Tobacco Settlement',             total:       23_151 },
    { name: 'Other Income',                   total:       22_794 },
  ]},
  2006: { total: 2_719_702, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_055_812 },
    { name: 'Individual and Corporate Taxes', total:    1_436_168 },
    { name: 'Other Taxes',                    total:       62_993 },
    { name: 'Licenses, Permits, and Fees',    total:       16_813 },
    { name: 'Sale of Goods and Services',     total:       64_287 },
    { name: 'Grants and Contributions',       total:        2_818 },
    { name: 'Investment Income',              total:       36_655 },
    { name: 'Tobacco Settlement',             total:       21_253 },
    { name: 'Other Income',                   total:       22_903 },
  ]},
  2007: { total: 3_134_419, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_295_616 },
    { name: 'Individual and Corporate Taxes', total:    1_598_702 },
    { name: 'Other Taxes',                    total:       61_940 },
    { name: 'Licenses, Permits, and Fees',    total:       16_748 },
    { name: 'Sale of Goods and Services',     total:       61_675 },
    { name: 'Grants and Contributions',       total:        3_484 },
    { name: 'Investment Income',              total:       41_445 },
    { name: 'Tobacco Settlement',             total:       23_712 },
    { name: 'Other Income',                   total:       31_097 },
  ]},
  2008: { total: 3_151_399, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_328_218 },
    { name: 'Individual and Corporate Taxes', total:    1_587_694 },
    { name: 'Other Taxes',                    total:       65_757 },
    { name: 'Licenses, Permits, and Fees',    total:       20_225 },
    { name: 'Sale of Goods and Services',     total:       20_877 },
    { name: 'Grants and Contributions',       total:        4_805 },
    { name: 'Investment Income',              total:       60_758 },
    { name: 'Tobacco Settlement',             total:       28_504 },
    { name: 'Other Income',                   total:       34_561 },
  ]},
  2009: { total: 2_678_305, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_170_002 },
    { name: 'Individual and Corporate Taxes', total:    1_325_996 },
    { name: 'Other Taxes',                    total:       57_379 },
    { name: 'Licenses, Permits, and Fees',    total:       18_619 },
    { name: 'Sale of Goods and Services',     total:        8_470 },
    { name: 'Grants and Contributions',       total:        5_303 },
    { name: 'Investment Income',              total:       32_805 },
    { name: 'Tobacco Settlement',             total:       30_965 },
    { name: 'Other Income',                   total:       28_766 },
  ]},
  2010: { total: 2_511_307, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_117_584 },
    { name: 'Individual and Corporate Taxes', total:    1_228_463 },
    { name: 'Other Taxes',                    total:       53_068 },
    { name: 'Licenses, Permits, and Fees',    total:       19_019 },
    { name: 'Sale of Goods and Services',     total:        8_695 },
    { name: 'Grants and Contributions',       total:        3_300 },
    { name: 'Investment Income',              total:       24_017 },
    { name: 'Tobacco Settlement',             total:       25_990 },
    { name: 'Other Income',                   total:       31_171 },
  ]},
  2011: { total: 2_677_830, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_158_726 },
    { name: 'Individual and Corporate Taxes', total:    1_288_869 },
    { name: 'Other Taxes',                    total:       58_741 },
    { name: 'Licenses, Permits, and Fees',    total:       25_054 },
    { name: 'Sale of Goods and Services',     total:       27_057 },
    { name: 'Grants and Contributions',       total:       12_806 },
    { name: 'Investment Income',              total:       36_640 },
    { name: 'Tobacco Settlement',             total:       24_445 },
    { name: 'Other Income',                   total:       45_492 },
  ]},
  2012: { total: 2_818_616, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_209_691 },
    { name: 'Individual and Corporate Taxes', total:    1_389_291 },
    { name: 'Other Taxes',                    total:       60_096 },
    { name: 'Licenses, Permits, and Fees',    total:       21_018 },
    { name: 'Sale of Goods and Services',     total:       26_957 },
    { name: 'Grants and Contributions',       total:       16_010 },
    { name: 'Investment Income',              total:       14_173 },
    { name: 'Tobacco Settlement',             total:       24_922 },
    { name: 'Other Income',                   total:       56_458 },
  ]},
  2013: { total: 3_088_773, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_313_583 },
    { name: 'Individual and Corporate Taxes', total:    1_531_975 },
    { name: 'Other Taxes',                    total:       62_276 },
    { name: 'Licenses, Permits, and Fees',    total:       19_448 },
    { name: 'Sale of Goods and Services',     total:       28_056 },
    { name: 'Grants and Contributions',       total:       23_872 },
    { name: 'Investment Income',              total:       34_358 },
    { name: 'Tobacco Settlement',             total:       24_912 },
    { name: 'Other Income',                   total:       50_293 },
  ]},
  2014: { total: 3_110_675, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_373_750 },
    { name: 'Individual and Corporate Taxes', total:    1_497_935 },
    { name: 'Other Taxes',                    total:       63_184 },
    { name: 'Licenses, Permits, and Fees',    total:       18_614 },
    { name: 'Sale of Goods and Services',     total:       29_451 },
    { name: 'Grants and Contributions',       total:       15_627 },
    { name: 'Investment Income',              total:       44_083 },
    { name: 'Tobacco Settlement',             total:       27_450 },
    { name: 'Other Income',                   total:       40_581 },
  ]},
  2015: { total: 3_363_385, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_455_678 },
    { name: 'Individual and Corporate Taxes', total:    1_684_680 },
    { name: 'Other Taxes',                    total:       57_864 },
    { name: 'Licenses, Permits, and Fees',    total:       21_038 },
    { name: 'Sale of Goods and Services',     total:       30_793 },
    { name: 'Grants and Contributions',       total:       12_756 },
    { name: 'Investment Income',              total:       13_722 },
    { name: 'Tobacco Settlement',             total:       24_183 },
    { name: 'Other Income',                   total:       62_671 },
  ]},
  2016: { total: 3_479_632, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_572_965 },
    { name: 'Individual and Corporate Taxes', total:    1_696_814 },
    { name: 'Other Taxes',                    total:       58_274 },
    { name: 'Licenses, Permits, and Fees',    total:       23_001 },
    { name: 'Sale of Goods and Services',     total:       30_598 },
    { name: 'Grants and Contributions',       total:       12_327 },
    { name: 'Investment Income',              total:       16_318 },
    { name: 'Tobacco Settlement',             total:       25_297 },
    { name: 'Other Income',                   total:       44_038 },
  ]},
  2017: { total: 3_721_225, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_631_295 },
    { name: 'Individual and Corporate Taxes', total:    1_854_351 },
    { name: 'Other Taxes',                    total:       59_845 },
    { name: 'Licenses, Permits, and Fees',    total:       25_421 },
    { name: 'Sale of Goods and Services',     total:       26_549 },
    { name: 'Grants and Contributions',       total:       16_262 },
    { name: 'Investment Income',              total:       47_915 },
    { name: 'Tobacco Settlement',             total:       22_964 },
    { name: 'Other Income',                   total:       36_623 },
  ]},
  2018: { total: 4_122_658, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_783_456 },
    { name: 'Individual and Corporate Taxes', total:    2_086_103 },
    { name: 'Other Taxes',                    total:       58_167 },
    { name: 'Licenses, Permits, and Fees',    total:       24_743 },
    { name: 'Sale of Goods and Services',     total:       28_155 },
    { name: 'Grants and Contributions',       total:       17_637 },
    { name: 'Investment Income',              total:       55_865 },
    { name: 'Tobacco Settlement',             total:       23_639 },
    { name: 'Other Income',                   total:       44_893 },
  ]},
  2019: { total: 4_175_241, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    1_875_892 },
    { name: 'Individual and Corporate Taxes', total:    2_001_914 },
    { name: 'Other Taxes',                    total:       62_670 },
    { name: 'Licenses, Permits, and Fees',    total:       33_615 },
    { name: 'Sale of Goods and Services',     total:       27_546 },
    { name: 'Grants and Contributions',       total:       23_405 },
    { name: 'Investment Income',              total:       72_419 },
    { name: 'Tobacco Settlement',             total:       21_014 },
    { name: 'Other Income',                   total:       56_766 },
  ]},
  2020: { total: 4_508_489, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    2_082_100 },
    { name: 'Individual and Corporate Taxes', total:    2_136_040 },
    { name: 'Other Taxes',                    total:       60_977 },
    { name: 'Licenses, Permits, and Fees',    total:       32_900 },
    { name: 'Sale of Goods and Services',     total:       32_536 },
    { name: 'Grants and Contributions',       total:       24_381 },
    { name: 'Investment Income',              total:       51_548 },
    { name: 'Tobacco Settlement',             total:       20_643 },
    { name: 'Other Income',                   total:       67_364 },
  ]},
  2021: { total: 5_657_401, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    2_466_395 },
    { name: 'Individual and Corporate Taxes', total:    2_736_064 },
    { name: 'Other Taxes',                    total:       63_210 },
    { name: 'Licenses, Permits, and Fees',    total:       31_725 },
    { name: 'Sale of Goods and Services',     total:       32_454 },
    { name: 'Grants and Contributions',       total:       23_432 },
    { name: 'Investment Income',              total:      108_284 },
    { name: 'Tobacco Settlement',             total:       22_100 },
    { name: 'Other Income',                   total:      173_737 },
  ]},
  2022: { total: 6_682_274, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    2_798_863 },
    { name: 'Individual and Corporate Taxes', total:    3_572_980 },
    { name: 'Other Taxes',                    total:       62_942 },
    { name: 'Licenses, Permits, and Fees',    total:       33_397 },
    { name: 'Sale of Goods and Services',     total:       32_839 },
    { name: 'Grants and Contributions',       total:      127_753 },
    { name: 'Investment Income (Loss)',       total:      -86_246 },
    { name: 'Tobacco Settlement',             total:       22_215 },
    { name: 'Other Income',                   total:      117_531 },
  ]},
  2023: { total: 6_513_059, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    2_942_587 },
    { name: 'Individual and Corporate Taxes', total:    3_158_651 },
    { name: 'Other Taxes',                    total:       55_417 },
    { name: 'Licenses, Permits, and Fees',    total:       36_345 },
    { name: 'Sale of Goods and Services',     total:       54_529 },
    { name: 'Grants and Contributions',       total:       44_038 },
    { name: 'Investment Income (Loss)',       total:      118_297 },
    { name: 'Tobacco Settlement',             total:       23_095 },
    { name: 'Other Income',                   total:       80_100 },
  ]},
  2024: { total: 7_130_418, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    3_099_493 },
    { name: 'Individual and Corporate Taxes', total:    3_262_211 },
    { name: 'Other Taxes',                    total:       37_648 },
    { name: 'Licenses, Permits, and Fees',    total:       36_831 },
    { name: 'Sale of Goods and Services',     total:       26_442 },
    { name: 'Grants and Contributions',       total:       50_011 },
    { name: 'Investment Income (Loss)',       total:      491_621 },
    { name: 'Tobacco Settlement',             total:       74_215 },
    { name: 'Other Income',                   total:       51_946 },
  ]},
  2025: { total: 6_658_024, confidence: 'actual', categories: [
    { name: 'Sales Tax',                      total:    3_032_148 },
    { name: 'Individual and Corporate Taxes', total:    3_189_337 },
    { name: 'Other Taxes',                    total:       56_224 },
    { name: 'Licenses, Permits, and Fees',    total:       52_900 },
    { name: 'Sale of Goods and Services',     total:       47_176 },
    { name: 'Grants and Contributions',       total:       22_668 },
    { name: 'Investment Income (Loss)',       total:      200_696 },
    { name: 'Tobacco Settlement',             total:       19_246 },
    { name: 'Other Income',                   total:       37_629 },
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
  return { jsonTree: [{ n: 'Idaho General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Idaho General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'id-acfr-gf-revenue', base_url: 'https://www.sco.idaho.gov/LivePages/acfr-financial-report-archive.aspx', fiscal_years: [2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
