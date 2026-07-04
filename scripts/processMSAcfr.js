#!/usr/bin/env node
/**
 * Mississippi General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Mississippi Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the MS state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   MS state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-41): MS ACFR GF ~3.42x NASBO GF (FY2024 $22,709,403K vs FY2024 NASBO
 *   $6,635,000K) -- the WIDEST divergence in Batch 2, TX/AR-style near-single-fund
 *   consolidation. Mississippi's General Fund is effectively the state's ONLY major
 *   governmental fund of consequence (the "Permanent" fund is negligible, ~$3.7M FY2024) --
 *   Federal government revenue ($10,966,392K FY2024, ~48% of GF total revenues) flows
 *   directly through the General column rather than being diverted to a separate
 *   special-revenue fund (unlike IA/ME/MT in this batch). Accepted-and-relabelled honestly
 *   (TX/AR precedent) with this prominent basis note.
 *
 * P2 CLAMP REQUIRED (ACFR-32, the tranche's live clamp exercise for MS): "Investment income"
 *   went NEGATIVE in FY2022 (-267,988K), FY2023's "Rentals" went NEGATIVE (-957K), and
 *   FY2024 has TWO negative lines simultaneously -- "Investment income" (-434,060K, material)
 *   and "Rentals" (-338K, immaterial). All transcribed SIGNED; validate() ties on signed
 *   category sums vs the printed total; buildTree()'s clampForRender renders each negative
 *   slice at 0 with the signed magnitude in the label while the parent total stays the
 *   printed GF total (22,709,403K for FY2024) -- confirmed the FY2024 dry-run exercises the
 *   clamp on BOTH negative lines and still ties exactly.
 *
 * NEAR-SINGLE-FUND LAYOUT: General is the 1st column of a small 2-5-column layout
 *   (General | Permanent | Totals in FY2024; General | Health Care | Capital Projects |
 *   Nonmajor | Totals in FY2003) -- extract_gf.py's position-anchor (right-edge of the FIRST
 *   numeric token on the 'Total revenues' row) isolates General regardless of the total
 *   column count. Confirmed at both bookends (FY2024 $22,709,403K / FY2003 $9,707,864K,
 *   exact $0 diff on BOTH revenues and expenditures) and on all 22 loaded years.
 *
 * SINGLE "TAXES:" HEADER (SC precedent, MS's own instance): MS's printed statement puts one
 *   "Taxes:" subsection header ahead of ALL revenue line items (confirmed across all 22
 *   loaded years FY2003-FY2024) -- there is no second header before the non-tax lines
 *   ("Licenses, fees and permits", "Federal government", "Investment income", "Charges for
 *   sales and services", "Rentals", "Court assessments and settlements", "Lottery proceeds"
 *   [FY2020+ only], catch-all "Other") that follow. Naively suffixing every item under that
 *   header with " taxes" would mislabel "Federal government" as "Federal government taxes".
 *   gen_state.py's rev_boundary='Licenses, fees and permits' clears the sub-heading at that
 *   line (the first genuinely non-tax item, confirmed present and in the same position in
 *   every loaded year) so only the true tax lines (Sales and use, Gasoline and other motor
 *   fuel, Individual income, Corporate income and franchise, Insurance, catch-all "Other")
 *   get the " taxes" suffix.
 *
 * OPAQUE/VARYING FILENAMES: dfa.ms.gov/publications lists every year's ACFR/CAFR at a
 *   non-derivable, varying-naming filename (2003-cafr.pdf, 2014cafr.pdf [no hyphen],
 *   2015_cafr.pdf [underscore], 2016-comprehensive-annual-financial-report-1.pdf,
 *   2018-state-of-ms-cafr.pdf, 2021-annual-comprehensifinancial-report.pdf [typo in the
 *   source filename, preserved verbatim], FY22%20ACFR.pdf, 2023%20ACFR%20Final.pdf,
 *   FY24%20%20ACFR%20Final.pdf [double space]) -- every URL below was read directly off the
 *   dfa.ms.gov/publications page and verified individually (%PDF magic + size >1.4MB, all 22
 *   years), never guessed from the FY.
 *
 * HONEST HOLE (FY2025): re-checked dfa.ms.gov/publications at load time (2026-07-04) -- no
 *   FY2025 ACFR/CAFR filing found (only FY2024's "FY24  ACFR Final.pdf" is the latest). Not a
 *   true gap -- normal reporting lag, matches the 117 recon's finding exactly. Window ends
 *   FY2024; re-check on a future touch.
 *
 * CLEAN EXTRACTION: all 22 years FY2003-FY2024 tied to $0 diff on BOTH the revenue and
 *   expenditure printed General Fund totals on the FIRST extraction pass -- zero honest
 *   holes, no wrapped labels, no OCR/font defects, no dual-subsection collisions. Bookends:
 *   FY2024 rev 22,709,403 / exp 23,549,305; FY2003 rev 9,707,864 / exp 9,958,757 (all four
 *   $0 diff).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment income" went NEGATIVE in FY2022 (-267,988K) and FY2024 (-434,060K, material); "Rentals" went NEGATIVE in FY2023 (-957K) and FY2024 (-338K, immaterial) -- real GAAP fair-value-of-investments losses / rental-expense-exceeds-income facts, not extraction artifacts. Every other loaded year is positive (FY2024 Investment income aside, the bookends themselves: FY2003 Investment income +42,290K, Rentals +10,809K). The P2 clamp is the render path for FY2022/2023/2024 -- FY2024 exercises BOTH negative lines simultaneously and still ties to the printed $22,709,403K total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ms/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMSAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Mississippi'; const STATE_ABBR = 'MS'; const POPULATION = 2_961_279;
const EXPECTED_MUNI_ID = 'ebec9e07-a79e-44b0-b5d5-2551625d4b8e';
const UNITS = 1_000; // MS ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2003: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2003-cafr.pdf', date: '2003-06-30' },
  2004: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2004-cafr.pdf', date: '2004-06-30' },
  2005: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2005-cafr.pdf', date: '2005-06-30' },
  2006: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2006-cafr.pdf', date: '2006-06-30' },
  2007: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2007-cafr.pdf', date: '2007-06-30' },
  2008: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2008-cafr.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2009-cafr.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2010-cafr.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2011-cafr.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2012-cafr.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2013-cafr.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2014cafr.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2015_cafr.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2016-comprehensive-annual-financial-report-1.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2017-comprehensive-annual-financial-report.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2018-state-of-ms-cafr.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2019-state-of-ms-cafr-final.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2020-state-of-ms-cafr.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2021-annual-comprehensifinancial-report.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/FY22%20ACFR.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2023%20ACFR%20Final.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/FY24%20%20ACFR%20Final.pdf', date: '2024-06-30' },
};
const dataSource = (fy) => `Mississippi State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — MS ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2003: { total: 9_958_757, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_191_877 },
    { name: 'Education',                                        total:    2_929_937 },
    { name: 'Health and social services',                       total:    4_021_280 },
    { name: 'Law, justice and public safety',                   total:      417_466 },
    { name: 'Recreation and resources development',             total:      296_511 },
    { name: 'Transportation',                                   total:      876_269 },
    { name: 'Debt service — Principal',                         total:      124_303 },
    { name: 'Debt service — Interest and other fiscal charges', total:      101_114 },
  ]},
  2004: { total: 10_830_656, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_219_944 },
    { name: 'Education',                                        total:    3_122_085 },
    { name: 'Health and social services',                       total:    4_569_253 },
    { name: 'Law, justice and public safety',                   total:      442_766 },
    { name: 'Recreation and resources development',             total:      304_057 },
    { name: 'Transportation',                                   total:      925_757 },
    { name: 'Debt service — Principal',                         total:      136_260 },
    { name: 'Debt service — Interest and other fiscal charges', total:      110_534 },
  ]},
  2005: { total: 11_148_538, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_227_277 },
    { name: 'Education',                                        total:    3_245_812 },
    { name: 'Health and social services',                       total:    4_811_369 },
    { name: 'Law, justice and public safety',                   total:      442_043 },
    { name: 'Recreation and resources development',             total:      250_579 },
    { name: 'Transportation',                                   total:      911_974 },
    { name: 'Debt service — Principal',                         total:      149_350 },
    { name: 'Debt service — Interest and other fiscal charges', total:      110_134 },
  ]},
  2006: { total: 11_969_383, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_375_916 },
    { name: 'Education',                                        total:    3_589_969 },
    { name: 'Health and social services',                       total:    4_713_842 },
    { name: 'Law, justice and public safety',                   total:      490_798 },
    { name: 'Recreation and resources development',             total:      217_540 },
    { name: 'Transportation',                                   total:    1_284_905 },
    { name: 'Debt service — Principal',                         total:      167_382 },
    { name: 'Debt service — Interest and other fiscal charges', total:      129_031 },
  ]},
  2007: { total: 12_875_331, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_344_192 },
    { name: 'Education',                                        total:    3_823_389 },
    { name: 'Health and social services',                       total:    4_974_073 },
    { name: 'Law, justice and public safety',                   total:      547_410 },
    { name: 'Recreation and resources development',             total:      336_317 },
    { name: 'Transportation',                                   total:    1_390_677 },
    { name: 'Debt service — Principal',                         total:      275_621 },
    { name: 'Debt service — Interest and other fiscal charges', total:      183_652 },
  ]},
  2008: { total: 13_452_244, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_430_623 },
    { name: 'Education',                                        total:    4_068_537 },
    { name: 'Health and social services',                       total:    5_248_780 },
    { name: 'Law, justice and public safety',                   total:      660_529 },
    { name: 'Recreation and resources development',             total:      361_387 },
    { name: 'Transportation',                                   total:    1_178_966 },
    { name: 'Debt service — Principal',                         total:      293_738 },
    { name: 'Debt service — Interest and other fiscal charges', total:      209_684 },
  ]},
  2009: { total: 13_967_239, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_392_656 },
    { name: 'Education',                                        total:    4_008_182 },
    { name: 'Health and social services',                       total:    5_816_821 },
    { name: 'Law, justice and public safety',                   total:      617_108 },
    { name: 'Recreation and resources development',             total:      367_949 },
    { name: 'Transportation',                                   total:    1_134_357 },
    { name: 'Debt service — Principal',                         total:      419_820 },
    { name: 'Debt service — Interest and other fiscal charges', total:      210_346 },
  ]},
  2010: { total: 14_484_348, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_377_855 },
    { name: 'Education',                                        total:    3_996_423 },
    { name: 'Health and social services',                       total:    6_396_201 },
    { name: 'Law, justice and public safety',                   total:      575_590 },
    { name: 'Recreation and resources development',             total:      471_551 },
    { name: 'Transportation',                                   total:    1_180_908 },
    { name: 'Debt service — Principal',                         total:      321_050 },
    { name: 'Debt service — Interest and other fiscal charges', total:      162_265 },
    { name: 'Defeasance of debt',                               total:        2_505 },
  ]},
  2011: { total: 15_144_068, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_301_010 },
    { name: 'Education',                                        total:    4_047_006 },
    { name: 'Health and social services',                       total:    6_507_991 },
    { name: 'Law, justice and public safety',                   total:      663_285 },
    { name: 'Recreation and resources development',             total:      914_819 },
    { name: 'Transportation',                                   total:    1_168_090 },
    { name: 'Debt service — Principal',                         total:      316_103 },
    { name: 'Debt service — Interest and other fiscal charges', total:      225_764 },
  ]},
  2012: { total: 15_355_017, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_414_395 },
    { name: 'Education',                                        total:    4_028_786 },
    { name: 'Health and social services',                       total:    6_818_119 },
    { name: 'Law, justice and public safety',                   total:      689_041 },
    { name: 'Recreation and resources development',             total:      669_354 },
    { name: 'Transportation',                                   total:    1_204_625 },
    { name: 'Debt service — Principal',                         total:      290_870 },
    { name: 'Debt service — Interest and other fiscal charges', total:      239_827 },
  ]},
  2013: { total: 16_058_315, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_495_665 },
    { name: 'Education',                                        total:    3_909_581 },
    { name: 'Health and social services',                       total:    7_373_548 },
    { name: 'Law, justice and public safety',                   total:      985_149 },
    { name: 'Recreation and resources development',             total:      590_795 },
    { name: 'Regulation of business and professions',           total:       39_654 },
    { name: 'Transportation',                                   total:    1_109_584 },
    { name: 'Debt service — Principal',                         total:      307_377 },
    { name: 'Debt service — Interest and other fiscal charges', total:      246_962 },
  ]},
  2014: { total: 16_209_784, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_493_951 },
    { name: 'Education',                                        total:    3_994_215 },
    { name: 'Health and social services',                       total:    7_404_608 },
    { name: 'Law, justice and public safety',                   total:      930_805 },
    { name: 'Recreation and resources development',             total:      639_569 },
    { name: 'Regulation of business and professions',           total:       39_444 },
    { name: 'Transportation',                                   total:    1_143_230 },
    { name: 'Debt service — Principal',                         total:      319_798 },
    { name: 'Debt service — Interest and other fiscal charges', total:      244_164 },
  ]},
  2015: { total: 16_691_742, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_475_434 },
    { name: 'Education',                                        total:    3_381_828 },
    { name: 'Health and social services',                       total:    7_685_805 },
    { name: 'Law, justice and public safety',                   total:      959_927 },
    { name: 'Recreation and resources development',             total:      555_793 },
    { name: 'Regulation of business and professions',           total:       41_284 },
    { name: 'Transportation',                                   total:    1_047_355 },
    { name: 'Debt service — Principal',                         total:      319_916 },
    { name: 'Debt service — Interest and other fiscal charges', total:      224_400 },
  ]},
  2016: { total: 16_706_987, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_228_370 },
    { name: 'Education',                                        total:    3_643_091 },
    { name: 'Health and social services',                       total:    7_806_591 },
    { name: 'Law, justice and public safety',                   total:      861_793 },
    { name: 'Recreation and resources development',             total:      458_957 },
    { name: 'Regulation of business and professions',           total:       42_123 },
    { name: 'Transportation',                                   total:    1_062_860 },
    { name: 'Debt service — Principal',                         total:      358_206 },
    { name: 'Debt service — Interest and other fiscal charges', total:      244_996 },
  ]},
  2017: { total: 16_946_457, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_269_629 },
    { name: 'Education',                                        total:    3_656_646 },
    { name: 'Health and social services',                       total:    7_823_462 },
    { name: 'Law, justice and public safety',                   total:      866_469 },
    { name: 'Recreation and resources development',             total:      487_526 },
    { name: 'Regulation of business and professions',           total:       42_704 },
    { name: 'Transportation',                                   total:    1_157_251 },
    { name: 'Debt service — Principal',                         total:      399_019 },
    { name: 'Debt service — Interest and other fiscal charges', total:      243_751 },
  ]},
  2018: { total: 16_562_378, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_186_733 },
    { name: 'Education',                                        total:    3_603_244 },
    { name: 'Health and social services',                       total:    7_782_448 },
    { name: 'Law, justice and public safety',                   total:      823_278 },
    { name: 'Recreation and resources development',             total:      460_451 },
    { name: 'Regulation of business and professions',           total:       42_942 },
    { name: 'Transportation',                                   total:    1_104_440 },
    { name: 'Debt service — Principal',                         total:      323_203 },
    { name: 'Debt service — Interest and other fiscal charges', total:      235_639 },
  ]},
  2019: { total: 16_835_766, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_356_261 },
    { name: 'Education',                                        total:    3_614_617 },
    { name: 'Health and social services',                       total:    7_757_625 },
    { name: 'Law, justice and public safety',                   total:      835_203 },
    { name: 'Recreation and resources development',             total:      514_218 },
    { name: 'Regulation of business and professions',           total:       45_536 },
    { name: 'Transportation',                                   total:    1_126_873 },
    { name: 'Debt service — Principal',                         total:      354_249 },
    { name: 'Debt service — Interest and other fiscal charges', total:      231_184 },
  ]},
  2020: { total: 17_561_668, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_466_328 },
    { name: 'Education',                                        total:    3_761_148 },
    { name: 'Health and social services',                       total:    8_246_255 },
    { name: 'Law, justice and public safety',                   total:      908_341 },
    { name: 'Recreation and resources development',             total:      404_305 },
    { name: 'Regulation of business and professions',           total:       45_477 },
    { name: 'Transportation',                                   total:    1_147_155 },
    { name: 'Debt service — Principal',                         total:      336_004 },
    { name: 'Debt service — Interest and other fiscal charges', total:      246_655 },
  ]},
  2021: { total: 19_080_712, confidence: 'actual', categories: [
    { name: 'General government',                               total:    3_036_298 },
    { name: 'Education',                                        total:    3_991_562 },
    { name: 'Health and social services',                       total:    8_582_332 },
    { name: 'Law, justice and public safety',                   total:    1_007_913 },
    { name: 'Recreation and resources development',             total:      595_038 },
    { name: 'Regulation of business and professions',           total:       44_629 },
    { name: 'Transportation',                                   total:    1_196_051 },
    { name: 'Debt service — Principal',                         total:      361_732 },
    { name: 'Debt service — Interest and other fiscal charges', total:      265_157 },
  ]},
  2022: { total: 19_875_335, confidence: 'actual', categories: [
    { name: 'General government',                               total:    3_012_845 },
    { name: 'Education',                                        total:    4_309_615 },
    { name: 'Health and social services',                       total:    9_341_117 },
    { name: 'Law, justice and public safety',                   total:    1_011_237 },
    { name: 'Recreation and resources development',             total:      423_757 },
    { name: 'Regulation of business and professions',           total:       44_802 },
    { name: 'Transportation',                                   total:    1_142_267 },
    { name: 'Debt service — Principal',                         total:      369_065 },
    { name: 'Debt service — Interest and other fiscal charges', total:      220_630 },
  ]},
  2023: { total: 21_849_049, confidence: 'actual', categories: [
    { name: 'General government',                               total:    4_091_625 },
    { name: 'Education',                                        total:    4_891_328 },
    { name: 'Health and social services',                       total:    9_717_656 },
    { name: 'Law, justice and public safety',                   total:    1_091_916 },
    { name: 'Recreation and resources development',             total:      540_710 },
    { name: 'Regulation of business and professions',           total:       48_079 },
    { name: 'Transportation',                                   total:      847_598 },
    { name: 'Debt service — Principal',                         total:      418_246 },
    { name: 'Debt service — Interest and other fiscal charges', total:      201_891 },
  ]},
  2024: { total: 23_549_305, confidence: 'actual', categories: [
    { name: 'General government',                               total:    4_534_533 },
    { name: 'Education',                                        total:    5_038_644 },
    { name: 'Health and social services',                       total:   10_470_940 },
    { name: 'Law, justice and public safety',                   total:    1_053_536 },
    { name: 'Recreation and resources development',             total:      326_252 },
    { name: 'Regulation of business and professions',           total:       58_723 },
    { name: 'Transportation',                                   total:    1_426_797 },
    { name: 'Debt service — Principal',                         total:      448_284 },
    { name: 'Debt service — Interest and other fiscal charges', total:      191_596 },
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
  return { jsonTree: [{ n: 'Mississippi General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'Mississippi General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ms-acfr-gf-operating', base_url: 'https://www.dfa.ms.gov/publications', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
