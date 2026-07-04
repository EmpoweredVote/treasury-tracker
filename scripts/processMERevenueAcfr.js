#!/usr/bin/env node
/**
 * Maine General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Maine Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the ME state node → pure insert keyed (muni,fy,'revenue').
 *   ME state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-40): ME ACFR GF ~1.24x NASBO GF (FY2025 $6,194,288K vs FY2024 NASBO
 *   $4,980,000K) -- modest divergence, the same mechanism as KS/KY. Maine books essentially
 *   all Federal Grants & Reimbursements to a SEPARATE "Federal" major fund column
 *   ($5,972,037K FY2025), not the General column (General's own Federal line is only $27K
 *   FY2025) -- keeps the GAAP General Fund close to NASBO's own-source budgetary scope.
 *   Accepted-and-relabelled honestly.
 *
 * DERIVABLE URL WITH ONE EXCEPTION (the cleanest URL pattern in the entire cohort):
 *   https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr{YYYY}.pdf for
 *   FY2002-FY2025 EXCEPT FY2020 = acfr2020v2_0.pdf (special-cased above). Landing:
 *   https://www.maine.gov/osc/financial-reporting/annual-comprehensive-financial-report.
 *
 * JUNE-30 FY-END CONFIRMED (the pre-recon "non-June to watch" flag is RESOLVED): every one
 *   of the 26 downloaded PDFs' cover page reads "FOR THE FISCAL YEAR ENDED JUNE 30, {YYYY}"
 *   (or the equivalent title-case form) for its own stated FY -- verified directly (not just
 *   the two recon bookends) at load time; no year needed a shift.
 *
 * HONEST HOLE (FY2000-FY2001, pre-GASB-34 boundary): both files download cleanly (real PDFs,
 *   June-30 FY-end confirmed on their own covers) but their Governmental Funds statement is
 *   titled "COMBINED STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES" (the
 *   pre-GASB-34 combined-fund-type layout), not the modern "Statement of Revenues,
 *   Expenditures and Changes in Fund Balances -- Governmental Funds" with a distinct General
 *   column that extract_gf.py's find_statement() anchors on (same SC/AL FY2002 pre-GASB-34
 *   boundary precedent) -- extract_gf.py correctly reports "statement not found" for both
 *   years rather than mis-transcribing a different statement shape. OMITTED; the durable
 *   clean window is FY2002-FY2025 (24 years, not the recon's aspirational 26yr FY2000 floor --
 *   the recon itself only bookend-tied FY2002 and FY2025, never FY2000/FY2001 directly).
 *
 * 6-COLUMN LAYOUT: General is the 1st of 6 (General | Highway | Federal | Other Special
 *   Revenue | Other Governmental Funds | Total Governmental). extract_gf.py's position-anchor
 *   isolates General regardless of the total column count -- confirmed at both bookends
 *   (FY2025 $6,194,288K / FY2002 $2,302,006K, exact $0 diff on BOTH revenues and
 *   expenditures) and on all 24 loaded years (zero honest holes within the window, zero
 *   rev_boundary sub-heading complications -- ME's revenue lines carry no sub-heading at all,
 *   sub=None throughout). One real GAAP quirk: "Capital Outlay" prints under the "Debt
 *   service:" subsection heading on the expenditure side (confirmed in the source PDF, not a
 *   parsing artifact) -- default_exp_name()'s Debt-service disambiguation only renames
 *   principal/interest lines, so "Capital Outlay" passes through unchanged with no collision.
 *
 * CLEAN EXTRACTION: no wrapped labels, no ALL-CAPS source text, no dual-subsection name
 *   collisions -- every one of the 24 in-window years tied exactly on the first extraction
 *   pass on both the revenue and expenditure sides.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment Income (Loss)" went NEGATIVE in FY2011 only: -54 (thousands, immaterial) -- a real GAAP fair-value-of-investments loss, not an extraction artifact. Every other loaded year is positive (FY2025 +113,749K / FY2002 +3,830K, the recon-confirmed bookends). The P2 clamp is the render path for FY2011; no year shows a negative GF Total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/me/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMERevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Maine'; const STATE_ABBR = 'ME'; const POPULATION = 1_362_359;
const EXPECTED_MUNI_ID = '53f26018-1d20-4f6a-9c0e-400bfb91199a';
const UNITS = 1_000; // ME ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2002.pdf', date: '2002-06-30' },
  2003: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2003.pdf', date: '2003-06-30' },
  2004: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2004.pdf', date: '2004-06-30' },
  2005: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2005.pdf', date: '2005-06-30' },
  2006: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2020v2_0.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2025.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Maine State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — ME ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 2_302_006, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_173_345 },
    { name: 'Assessments and Other Revenues',    total:       61_685 },
    { name: 'Federal Grants and Reimbursements', total:       21_578 },
    { name: 'Service Charges',                   total:       41_111 },
    { name: 'Investment Income (Loss)',          total:        3_830 },
    { name: 'Miscellaneous Revenues',            total:          457 },
  ]},
  2003: { total: 2_438_391, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_307_439 },
    { name: 'Assessments and Other Revenue',     total:       62_010 },
    { name: 'Federal Grants and Reimbursements', total:       25_580 },
    { name: 'Service Charges',                   total:       35_356 },
    { name: 'Investment Income',                 total:        2_346 },
    { name: 'Miscellaneous Revenue',             total:        5_660 },
  ]},
  2004: { total: 2_655_776, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_453_800 },
    { name: 'Assessments and Other Revenue',     total:       81_852 },
    { name: 'Federal Grants and Reimbursements', total:       25_230 },
    { name: 'Service Charges',                   total:       44_049 },
    { name: 'Investment Income',                 total:        5_837 },
    { name: 'Miscellaneous Revenue',             total:       45_008 },
  ]},
  2005: { total: 2_828_701, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_653_628 },
    { name: 'Assessments and Other Revenue',     total:       88_514 },
    { name: 'Federal Grants and Reimbursements', total:       28_894 },
    { name: 'Service Charges',                   total:       38_351 },
    { name: 'Investment Income',                 total:        6_877 },
    { name: 'Miscellaneous Revenue',             total:       12_437 },
  ]},
  2006: { total: 3_118_227, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_926_835 },
    { name: 'Assessments and Other Revenue',     total:      105_371 },
    { name: 'Federal Grants and Reimbursements', total:       17_334 },
    { name: 'Service Charges',                   total:       41_395 },
    { name: 'Investment Income',                 total:       12_299 },
    { name: 'Miscellaneous Revenue',             total:       14_993 },
  ]},
  2007: { total: 3_200_949, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    3_003_382 },
    { name: 'Assessments and Other Revenue',     total:      109_336 },
    { name: 'Federal Grants and Reimbursements', total:       16_762 },
    { name: 'Service Charges',                   total:       36_717 },
    { name: 'Investment Income',                 total:        9_653 },
    { name: 'Miscellaneous Revenue',             total:       25_099 },
  ]},
  2008: { total: 3_265_185, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    3_079_706 },
    { name: 'Assessments and Other Revenue',     total:      116_742 },
    { name: 'Federal Grants and Reimbursements', total:       11_041 },
    { name: 'Service Charges',                   total:       47_262 },
    { name: 'Investment Income (Loss)',          total:        2_562 },
    { name: 'Miscellaneous Revenue',             total:        7_872 },
  ]},
  2009: { total: 3_007_051, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_808_997 },
    { name: 'Assessments and Other Revenue',     total:      120_682 },
    { name: 'Federal Grants and Reimbursements', total:       14_844 },
    { name: 'Service Charges',                   total:       44_211 },
    { name: 'Investment Income',                 total:        8_425 },
    { name: 'Miscellaneous Revenue',             total:        9_892 },
  ]},
  2010: { total: 2_948_304, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_756_435 },
    { name: 'Assessments and Other Revenue',     total:      117_119 },
    { name: 'Federal Grants and Reimbursements', total:       11_047 },
    { name: 'Service Charges',                   total:       50_852 },
    { name: 'Investment Income',                 total:          567 },
    { name: 'Miscellaneous Revenue',             total:       12_284 },
  ]},
  2011: { total: 3_108_639, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_926_972 },
    { name: 'Assessments and Other Revenue',     total:      107_878 },
    { name: 'Federal Grants and Reimbursements', total:       11_832 },
    { name: 'Service Charges',                   total:       46_206 },
    { name: 'Investment Income',                 total:          -54 },
    { name: 'Miscellaneous Revenue',             total:       15_805 },
  ]},
  2012: { total: 3_164_490, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    2_990_353 },
    { name: 'Assessments and Other Revenue',     total:      103_292 },
    { name: 'Federal Grants and Reimbursements', total:        3_377 },
    { name: 'Service Charges',                   total:       49_008 },
    { name: 'Investment Income (Loss)',          total:        1_413 },
    { name: 'Miscellaneous Revenue',             total:       17_047 },
  ]},
  2013: { total: 3_242_237, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    3_077_321 },
    { name: 'Assessments and Other Revenue',     total:      106_086 },
    { name: 'Federal Grants and Reimbursements', total:        1_726 },
    { name: 'Service Charges',                   total:       46_281 },
    { name: 'Investment Income',                 total:          356 },
    { name: 'Miscellaneous Revenue',             total:       10_467 },
  ]},
  2014: { total: 3_201_700, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    3_027_088 },
    { name: 'Assessments and Other Revenue',     total:       97_622 },
    { name: 'Federal Grants and Reimbursements', total:        1_988 },
    { name: 'Service Charges',                   total:       50_580 },
    { name: 'Investment Income',                 total:          716 },
    { name: 'Miscellaneous Revenue',             total:       23_706 },
  ]},
  2015: { total: 3_403_829, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    3_237_598 },
    { name: 'Assessments and Other Revenue',     total:      104_795 },
    { name: 'Federal Grants and Reimbursements', total:        2_064 },
    { name: 'Service Charges',                   total:       46_466 },
    { name: 'Investment Income',                 total:        1_170 },
    { name: 'Miscellaneous Revenue',             total:       11_736 },
  ]},
  2016: { total: 3_468_671, confidence: 'actual', categories: [
    { name: 'Taxes',                             total:    3_305_720 },
    { name: 'Assessments and Other Revenue',     total:      105_216 },
    { name: 'Federal Grants and Reimbursements', total:        1_952 },
    { name: 'Service Charges',                   total:       38_984 },
    { name: 'Investment Income',                 total:        2_439 },
    { name: 'Miscellaneous Revenue',             total:       14_360 },
  ]},
  2017: { total: 3_582_553, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    3_411_497 },
    { name: 'Assessments',                     total:      106_085 },
    { name: 'Federal Grants & Reimbursements', total:        1_771 },
    { name: 'Charges for Services',            total:       45_229 },
    { name: 'Investment Income',               total:        5_424 },
    { name: 'Miscellaneous Revenues',          total:       12_547 },
  ]},
  2018: { total: 3_689_456, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    3_529_960 },
    { name: 'Assessments',                     total:      102_271 },
    { name: 'Federal Grants & Reimbursements', total:        1_638 },
    { name: 'Charges for Services',            total:       44_055 },
    { name: 'Investment Income',               total:       10_048 },
    { name: 'Miscellaneous Revenues',          total:        1_484 },
  ]},
  2019: { total: 3_965_998, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    3_794_729 },
    { name: 'Assessments',                     total:       99_859 },
    { name: 'Federal Grants & Reimbursements', total:        1_626 },
    { name: 'Charges for Services',            total:       45_517 },
    { name: 'Investment Income',               total:       20_051 },
    { name: 'Miscellaneous Revenues',          total:        4_216 },
  ]},
  2020: { total: 3_847_642, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    3_683_195 },
    { name: 'Assessments',                     total:       89_132 },
    { name: 'Federal Grants & Reimbursements', total:        1_903 },
    { name: 'Charges for Services',            total:       52_069 },
    { name: 'Investment Income',               total:       18_986 },
    { name: 'Miscellaneous Revenues',          total:        2_357 },
  ]},
  2021: { total: 4_940_123, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    4_765_942 },
    { name: 'Assessments',                     total:       94_909 },
    { name: 'Federal Grants & Reimbursements', total:          103 },
    { name: 'Charges for Services',            total:       57_120 },
    { name: 'Investment Income',               total:        9_556 },
    { name: 'Miscellaneous Revenues',          total:       12_493 },
  ]},
  2022: { total: 5_665_521, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    5_467_668 },
    { name: 'Assessments',                     total:       94_175 },
    { name: 'Federal Grants & Reimbursements', total:           94 },
    { name: 'Charges for Services',            total:       60_520 },
    { name: 'Investment Income (Loss)',        total:       12_008 },
    { name: 'Miscellaneous Revenues',          total:       31_056 },
  ]},
  2023: { total: 5_744_711, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    5_473_723 },
    { name: 'Assessments',                     total:       92_345 },
    { name: 'Federal Grants & Reimbursements', total:           53 },
    { name: 'Charges for Services',            total:       47_802 },
    { name: 'Investment Income (Loss)',        total:       56_315 },
    { name: 'Miscellaneous Revenues',          total:       74_473 },
  ]},
  2024: { total: 5_715_448, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    5_437_602 },
    { name: 'Assessments',                     total:      104_527 },
    { name: 'Federal Grants & Reimbursements', total:          186 },
    { name: 'Charges for Services',            total:       47_740 },
    { name: 'Investment Income (Loss)',        total:      105_200 },
    { name: 'Miscellaneous Revenues',          total:       20_193 },
  ]},
  2025: { total: 6_194_288, confidence: 'actual', categories: [
    { name: 'Taxes',                           total:    5_910_772 },
    { name: 'Assessments',                     total:      101_221 },
    { name: 'Federal Grants & Reimbursements', total:           27 },
    { name: 'Charges for Services',            total:       50_741 },
    { name: 'Investment Income (Loss)',        total:      113_749 },
    { name: 'Miscellaneous Revenues',          total:       17_778 },
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
  return { jsonTree: [{ n: 'Maine General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Maine General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'me-acfr-gf-revenue', base_url: 'https://www.maine.gov/osc/financial-reporting/annual-comprehensive-financial-report', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
