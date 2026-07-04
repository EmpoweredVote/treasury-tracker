#!/usr/bin/env node
/**
 * Idaho General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Idaho Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the ID state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/id/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processIDAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Idaho State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — ID ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2004: { total: 1_670_288, confidence: 'actual', categories: [
    { name: 'General Government',                total:       87_253 },
    { name: 'Public Safety and Correction',      total:      175_895 },
    { name: 'Health and Human Services',         total:       18_495 },
    { name: 'Education',                         total:    1_094_458 },
    { name: 'Economic Development',              total:       17_334 },
    { name: 'Natural Resources',                 total:       31_462 },
    { name: 'Capital Outlay',                    total:       86_260 },
    { name: 'Debt Service',                      total:        7_875 },
    { name: 'Intergovernmental Revenue Sharing', total:      151_257 },
  ]},
  2005: { total: 1_739_575, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      110_464 },
    { name: 'Public Safety and Correction',              total:      186_764 },
    { name: 'Health and Human Services',                 total:       22_093 },
    { name: 'Education',                                 total:    1_114_798 },
    { name: 'Economic Development',                      total:       18_108 },
    { name: 'Natural Resources',                         total:       25_368 },
    { name: 'Capital Outlay',                            total:       91_028 },
    { name: 'Intergovernmental Revenue Sharing',         total:      162_709 },
    { name: 'Debt service — Principal Retirement',       total:          152 },
    { name: 'Debt service — Interest and Other Charges', total:        8_091 },
  ]},
  2006: { total: 1_841_927, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      101_259 },
    { name: 'Public Safety and Correction',              total:      204_196 },
    { name: 'Health and Human Services',                 total:       28_669 },
    { name: 'Education',                                 total:    1_164_499 },
    { name: 'Economic Development',                      total:       19_093 },
    { name: 'Natural Resources',                         total:       36_543 },
    { name: 'Capital Outlay',                            total:       78_311 },
    { name: 'Intergovernmental Revenue Sharing',         total:      198_446 },
    { name: 'Debt service — Principal Retirement',       total:          226 },
    { name: 'Debt service — Interest and Other Charges', total:       10_685 },
  ]},
  2007: { total: 2_198_918, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      107_474 },
    { name: 'Public Safety and Correction',              total:      218_437 },
    { name: 'Health and Human Services',                 total:       27_422 },
    { name: 'Education',                                 total:    1_466_115 },
    { name: 'Economic Development',                      total:       25_029 },
    { name: 'Natural Resources',                         total:       34_297 },
    { name: 'Capital Outlay',                            total:      107_650 },
    { name: 'Intergovernmental Revenue Sharing',         total:      207_654 },
    { name: 'Debt service — Principal Retirement',       total:          131 },
    { name: 'Debt service — Interest and Other Charges', total:        4_709 },
  ]},
  2008: { total: 2_341_608, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      135_470 },
    { name: 'Public Safety and Correction',              total:      239_977 },
    { name: 'Health and Human Services',                 total:       29_319 },
    { name: 'Education',                                 total:    1_552_952 },
    { name: 'Economic Development',                      total:       29_279 },
    { name: 'Natural Resources',                         total:       50_654 },
    { name: 'Capital Outlay',                            total:       79_261 },
    { name: 'Intergovernmental Revenue Sharing',         total:      205_937 },
    { name: 'Debt service — Principal Retirement',       total:          353 },
    { name: 'Debt service — Interest and Other Charges', total:       18_406 },
  ]},
  2009: { total: 2_437_982, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      140_117 },
    { name: 'Public Safety and Correction',              total:      249_475 },
    { name: 'Health and Human Services',                 total:       30_537 },
    { name: 'Education',                                 total:    1_609_137 },
    { name: 'Economic Development',                      total:       24_699 },
    { name: 'Natural Resources',                         total:       41_250 },
    { name: 'Capital Outlay',                            total:      126_102 },
    { name: 'Intergovernmental Revenue Sharing',         total:      192_106 },
    { name: 'Debt service — Principal Retirement',       total:          319 },
    { name: 'Debt service — Interest and Other Charges', total:       24_240 },
  ]},
  2010: { total: 2_120_536, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      159_031 },
    { name: 'Public Safety and Correction',              total:      222_120 },
    { name: 'Health and Human Services',                 total:       41_112 },
    { name: 'Education',                                 total:    1_357_863 },
    { name: 'Economic Development',                      total:       25_914 },
    { name: 'Natural Resources',                         total:       28_174 },
    { name: 'Capital Outlay',                            total:       92_251 },
    { name: 'Intergovernmental Revenue Sharing',         total:      178_774 },
    { name: 'Debt service — Principal Retirement',       total:          918 },
    { name: 'Debt service — Interest and Other Charges', total:       14_379 },
  ]},
  2011: { total: 2_149_928, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      123_260 },
    { name: 'Public Safety and Correction',              total:      222_589 },
    { name: 'Health and Human Services',                 total:       41_486 },
    { name: 'Education',                                 total:    1_472_723 },
    { name: 'Economic Development',                      total:       39_666 },
    { name: 'Natural Resources',                         total:       27_242 },
    { name: 'Capital Outlay',                            total:       27_443 },
    { name: 'Intergovernmental Revenue Sharing',         total:      181_244 },
    { name: 'Debt service — Principal Retirement',       total:          942 },
    { name: 'Debt service — Interest and Other Charges', total:       13_333 },
  ]},
  2012: { total: 2_094_986, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      108_025 },
    { name: 'Public Safety and Correction',              total:      241_561 },
    { name: 'Health and Human Services',                 total:       37_356 },
    { name: 'Education',                                 total:    1_403_893 },
    { name: 'Economic Development',                      total:       38_046 },
    { name: 'Natural Resources',                         total:       27_914 },
    { name: 'Capital Outlay',                            total:       25_199 },
    { name: 'Intergovernmental Revenue Sharing',         total:      199_769 },
    { name: 'Debt service — Principal Retirement',       total:        1_013 },
    { name: 'Debt service — Interest and Other Charges', total:       12_210 },
  ]},
  2013: { total: 2_218_220, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      130_422 },
    { name: 'Public Safety and Correction',              total:      258_387 },
    { name: 'Health and Human Services',                 total:       37_044 },
    { name: 'Education',                                 total:    1_447_955 },
    { name: 'Economic Development',                      total:       37_898 },
    { name: 'Natural Resources',                         total:       34_401 },
    { name: 'Capital Outlay',                            total:       38_098 },
    { name: 'Intergovernmental Revenue Sharing',         total:      221_142 },
    { name: 'Debt service — Principal Retirement',       total:        1_029 },
    { name: 'Debt service — Interest and Other Charges', total:       11_844 },
  ]},
  2014: { total: 2_321_300, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      140_422 },
    { name: 'Public Safety and Correction',              total:      270_372 },
    { name: 'Health and Human Services',                 total:       34_999 },
    { name: 'Education',                                 total:    1_483_353 },
    { name: 'Economic Development',                      total:       41_230 },
    { name: 'Natural Resources',                         total:       41_938 },
    { name: 'Capital Outlay',                            total:       41_174 },
    { name: 'Intergovernmental Revenue Sharing',         total:      254_714 },
    { name: 'Debt service — Principal Retirement',       total:        1_086 },
    { name: 'Debt service — Interest and Other Charges', total:       12_012 },
  ]},
  2015: { total: 2_433_752, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      127_099 },
    { name: 'Public Safety and Correction',              total:      290_580 },
    { name: 'Health and Human Services',                 total:       24_839 },
    { name: 'Education',                                 total:    1_582_400 },
    { name: 'Economic Development',                      total:       41_703 },
    { name: 'Natural Resources',                         total:       44_352 },
    { name: 'Capital Outlay',                            total:       56_386 },
    { name: 'Intergovernmental Revenue Sharing',         total:      254_890 },
    { name: 'Debt service — Principal Retirement',       total:        1_151 },
    { name: 'Debt service — Interest and Other Charges', total:       10_352 },
  ]},
  2016: { total: 2_575_745, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      133_860 },
    { name: 'Public Safety and Correction',              total:      300_189 },
    { name: 'Health and Human Services',                 total:       26_445 },
    { name: 'Education',                                 total:    1_690_567 },
    { name: 'Economic Development',                      total:       47_789 },
    { name: 'Natural Resources',                         total:       62_562 },
    { name: 'Capital Outlay',                            total:       49_300 },
    { name: 'Intergovernmental Revenue Sharing',         total:      252_426 },
    { name: 'Debt service — Principal Retirement',       total:          987 },
    { name: 'Debt service — Interest and Other Charges', total:       11_620 },
  ]},
  2017: { total: 2_782_390, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      139_844 },
    { name: 'Public Safety and Correction',              total:      316_286 },
    { name: 'Health and Human Services',                 total:       24_696 },
    { name: 'Education',                                 total:    1_817_866 },
    { name: 'Economic Development',                      total:       48_163 },
    { name: 'Natural Resources',                         total:       55_636 },
    { name: 'Capital Outlay',                            total:       99_907 },
    { name: 'Intergovernmental Revenue Sharing',         total:      267_921 },
    { name: 'Debt service — Principal Retirement',       total:        1_036 },
    { name: 'Debt service — Interest and Other Charges', total:       11_035 },
  ]},
  2018: { total: 2_999_015, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      150_410 },
    { name: 'Public Safety and Correction',              total:      337_503 },
    { name: 'Health and Human Services',                 total:       30_787 },
    { name: 'Education',                                 total:    1_954_413 },
    { name: 'Economic Development',                      total:       66_094 },
    { name: 'Natural Resources',                         total:       68_588 },
    { name: 'Capital Outlay',                            total:       64_527 },
    { name: 'Intergovernmental Revenue Sharing',         total:      305_467 },
    { name: 'Debt service — Principal Retirement',       total:        1_095 },
    { name: 'Debt service — Interest and Other Charges', total:       20_131 },
  ]},
  2019: { total: 3_177_232, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      148_830 },
    { name: 'Public Safety and Correction',              total:      362_500 },
    { name: 'Health and Human Services',                 total:       38_716 },
    { name: 'Education',                                 total:    2_058_359 },
    { name: 'Economic Development',                      total:       51_687 },
    { name: 'Natural Resources',                         total:       68_358 },
    { name: 'Capital Outlay',                            total:       77_504 },
    { name: 'Intergovernmental Revenue Sharing',         total:      347_501 },
    { name: 'Debt service — Principal Retirement',       total:        1_442 },
    { name: 'Debt service — Interest and Other Charges', total:       22_335 },
  ]},
  2020: { total: 3_401_163, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      144_344 },
    { name: 'Public Safety and Correction',              total:      396_658 },
    { name: 'Health and Human Services',                 total:       53_618 },
    { name: 'Education',                                 total:    2_198_586 },
    { name: 'Economic Development',                      total:       51_599 },
    { name: 'Natural Resources',                         total:       70_797 },
    { name: 'Capital Outlay',                            total:      119_336 },
    { name: 'Intergovernmental Revenue Sharing',         total:      347_432 },
    { name: 'Debt service — Principal Retirement',       total:        1_508 },
    { name: 'Debt service — Interest and Other Charges', total:       17_285 },
  ]},
  2021: { total: 3_517_193, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      272_133 },
    { name: 'Public Safety and Correction',              total:      381_970 },
    { name: 'Health and Human Services',                 total:       45_091 },
    { name: 'Education',                                 total:    2_217_980 },
    { name: 'Economic Development',                      total:       75_303 },
    { name: 'Natural Resources',                         total:       61_906 },
    { name: 'Capital Outlay',                            total:       82_246 },
    { name: 'Intergovernmental Revenue Sharing',         total:      375_990 },
    { name: 'Debt service — Principal Retirement',       total:        1_583 },
    { name: 'Debt service — Interest and Other Charges', total:        2_991 },
  ]},
  2022: { total: 4_162_154, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      193_445 },
    { name: 'Public Safety and Correction',              total:      401_312 },
    { name: 'Health and Human Services',                 total:       36_410 },
    { name: 'Education',                                 total:    2_403_253 },
    { name: 'Economic Development',                      total:       50_690 },
    { name: 'Natural Resources',                         total:       98_379 },
    { name: 'Capital Outlay',                            total:      115_800 },
    { name: 'Intergovernmental Revenue Sharing',         total:      850_294 },
    { name: 'Debt service — Principal Retirement',       total:        3_584 },
    { name: 'Debt service — Interest and Other Charges', total:        8_987 },
  ]},
  2023: { total: 4_947_639, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      291_702 },
    { name: 'Public Safety and Correction',              total:      456_047 },
    { name: 'Health and Human Services',                 total:       31_330 },
    { name: 'Education',                                 total:    2_622_708 },
    { name: 'Economic Development',                      total:      150_548 },
    { name: 'Natural Resources',                         total:       71_096 },
    { name: 'Capital Outlay',                            total:      218_874 },
    { name: 'Intergovernmental Revenue Sharing',         total:    1_091_903 },
    { name: 'Debt service — Principal Retirement',       total:       12_332 },
    { name: 'Debt service — Interest and Other Charges', total:        1_099 },
  ]},
  2024: { total: 5_132_563, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      200_405 },
    { name: 'Public Safety and Correction',              total:      493_998 },
    { name: 'Health and Human Services',                 total:       28_917 },
    { name: 'Education',                                 total:    2_991_616 },
    { name: 'Economic Development',                      total:       69_374 },
    { name: 'Natural Resources',                         total:       86_857 },
    { name: 'Capital Outlay',                            total:      314_444 },
    { name: 'Intergovernmental Revenue Sharing',         total:      935_264 },
    { name: 'Debt service — Principal Retirement',       total:       10_626 },
    { name: 'Debt service — Interest and Other Charges', total:        1_062 },
  ]},
  2025: { total: 5_196_087, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      187_583 },
    { name: 'Public Safety and Correction',              total:      497_853 },
    { name: 'Health and Human Services',                 total:       25_730 },
    { name: 'Education',                                 total:    3_075_656 },
    { name: 'Economic Development',                      total:      110_710 },
    { name: 'Natural Resources',                         total:      124_874 },
    { name: 'Capital Outlay',                            total:      443_855 },
    { name: 'Intergovernmental Revenue Sharing',         total:      717_160 },
    { name: 'Debt service — Principal Retirement',       total:       10_976 },
    { name: 'Debt service — Interest and Other Charges', total:        1_690 },
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
    const label = cat.total < 0 ? `${cat.name.trim()} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name.trim(); // WR-01: trim so a stray-space transcription can never fork a category name across years
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Idaho General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06: validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (EXPENDITURES[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
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
    const srcPayload = { name: 'Idaho General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'id-acfr-gf-operating', base_url: 'https://www.sco.idaho.gov/LivePages/acfr-financial-report-archive.aspx', fiscal_years: [2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
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
      if (rpcErr) throw new Error(`FY${fy} RPC error: ${rpcErr.message}`);
      if (r?.error) throw new Error(`FY${fy} RPC error: ${r.error}`);
      console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
      if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`); // WR-07: surface select errors — do not misreport as a missing row
      if (bud?.id) {
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
        if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`);
        console.log(`Stamped source on FY${fy} operating row (GAAP basis)\n`);
      } else { throw new Error(`Could not find FY${fy} operating budget row to stamp source`); }
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
