#!/usr/bin/env node
/**
 * Mississippi General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Mississippi Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the MS state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ms/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processMSRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Mississippi State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — MS ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2003: { total: 9_707_864, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    2_377_996 },
    { name: 'Gasoline and other motor fuel taxes',  total:      409_249 },
    { name: 'Individual income taxes',              total:    1_021_967 },
    { name: 'Corporate income and franchise taxes', total:      287_335 },
    { name: 'Insurance taxes',                      total:      149_458 },
    { name: 'Other taxes',                          total:      344_435 },
    { name: 'Licenses, fees and permits',           total:      349_795 },
    { name: 'Federal government',                   total:    4_190_940 },
    { name: 'Interest and other investment income', total:       42_290 },
    { name: 'Charges for sales and services',       total:      234_015 },
    { name: 'Rentals',                              total:       10_809 },
    { name: 'Court assessments and settlements',    total:       22_494 },
    { name: 'Other',                                total:      267_081 },
  ]},
  2004: { total: 10_378_839, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    2_488_055 },
    { name: 'Gasoline and other motor fuel taxes',  total:      424_266 },
    { name: 'Individual income taxes',              total:    1_054_479 },
    { name: 'Corporate income and franchise taxes', total:      320_848 },
    { name: 'Insurance taxes',                      total:      160_757 },
    { name: 'Other taxes',                          total:      348_278 },
    { name: 'Licenses, fees and permits',           total:      359_603 },
    { name: 'Federal government',                   total:    4_655_497 },
    { name: 'Interest and other investment income', total:       27_855 },
    { name: 'Charges for sales and services',       total:      249_359 },
    { name: 'Rentals',                              total:       10_936 },
    { name: 'Court assessments and settlements',    total:       17_310 },
    { name: 'Other',                                total:      261_596 },
  ]},
  2005: { total: 11_002_737, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    2_609_936 },
    { name: 'Gasoline and other motor fuel taxes',  total:      423_249 },
    { name: 'Individual income taxes',              total:    1_224_403 },
    { name: 'Corporate income and franchise taxes', total:      363_361 },
    { name: 'Insurance taxes',                      total:      165_945 },
    { name: 'Other taxes',                          total:      357_819 },
    { name: 'Licenses, fees and permits',           total:      375_413 },
    { name: 'Federal government',                   total:    4_755_184 },
    { name: 'Interest and other investment income', total:       38_399 },
    { name: 'Charges for sales and services',       total:      254_509 },
    { name: 'Rentals',                              total:       13_450 },
    { name: 'Court assessments and settlements',    total:      112_592 },
    { name: 'Other',                                total:      308_477 },
  ]},
  2006: { total: 12_335_532, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_074_831 },
    { name: 'Gasoline and other motor fuel taxes',  total:      434_350 },
    { name: 'Individual income taxes',              total:    1_213_733 },
    { name: 'Corporate income and franchise taxes', total:      412_839 },
    { name: 'Insurance taxes',                      total:      169_727 },
    { name: 'Other taxes',                          total:      380_680 },
    { name: 'Licenses, fees and permits',           total:      341_478 },
    { name: 'Federal government',                   total:    5_721_869 },
    { name: 'Interest and other investment income', total:       64_839 },
    { name: 'Charges for sales and services',       total:      270_276 },
    { name: 'Rentals',                              total:        5_144 },
    { name: 'Court assessments and settlements',    total:       12_666 },
    { name: 'Other',                                total:      233_100 },
  ]},
  2007: { total: 12_933_037, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_136_554 },
    { name: 'Gasoline and other motor fuel taxes',  total:      437_076 },
    { name: 'Individual income taxes',              total:    1_486_074 },
    { name: 'Corporate income and franchise taxes', total:      477_166 },
    { name: 'Insurance taxes',                      total:      192_861 },
    { name: 'Other taxes',                          total:      392_074 },
    { name: 'Licenses, fees and permits',           total:      402_366 },
    { name: 'Federal government',                   total:    5_716_664 },
    { name: 'Investment income',                    total:      108_385 },
    { name: 'Charges for sales and services',       total:      290_681 },
    { name: 'Rentals',                              total:       15_981 },
    { name: 'Court assessments and settlements',    total:       14_211 },
    { name: 'Other',                                total:      262_944 },
  ]},
  2008: { total: 13_026_136, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_146_711 },
    { name: 'Gasoline and other motor fuel taxes',  total:      429_010 },
    { name: 'Individual income taxes',              total:    1_523_231 },
    { name: 'Corporate income and franchise taxes', total:      503_165 },
    { name: 'Insurance taxes',                      total:      194_129 },
    { name: 'Other taxes',                          total:      453_754 },
    { name: 'Licenses, fees and permits',           total:      439_073 },
    { name: 'Federal government',                   total:    5_557_130 },
    { name: 'Investment income (loss)',             total:      148_527 },
    { name: 'Charges for sales and services',       total:      300_858 },
    { name: 'Rentals',                              total:       20_590 },
    { name: 'Court assessments and settlements',    total:       15_294 },
    { name: 'Other',                                total:      294_664 },
  ]},
  2009: { total: 13_141_858, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_008_042 },
    { name: 'Gasoline and other motor fuel taxes',  total:      403_406 },
    { name: 'Individual income taxes',              total:    1_441_141 },
    { name: 'Corporate income and franchise taxes', total:      420_482 },
    { name: 'Insurance taxes',                      total:      187_050 },
    { name: 'Other taxes',                          total:      455_034 },
    { name: 'Licenses, fees and permits',           total:      435_881 },
    { name: 'Federal government',                   total:    6_002_035 },
    { name: 'Investment income (loss)',             total:       93_577 },
    { name: 'Charges for sales and services',       total:      325_357 },
    { name: 'Rentals',                              total:       15_966 },
    { name: 'Court assessments and settlements',    total:       10_052 },
    { name: 'Other',                                total:      343_835 },
  ]},
  2010: { total: 14_013_862, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    2_848_169 },
    { name: 'Gasoline and other motor fuel taxes',  total:      398_037 },
    { name: 'Individual income taxes',              total:    1_337_000 },
    { name: 'Corporate income and franchise taxes', total:      413_930 },
    { name: 'Insurance taxes',                      total:      197_970 },
    { name: 'Other taxes',                          total:      505_368 },
    { name: 'Licenses, fees and permits',           total:      434_358 },
    { name: 'Federal government',                   total:    7_042_444 },
    { name: 'Investment income',                    total:       53_907 },
    { name: 'Charges for sales and services',       total:      287_209 },
    { name: 'Rentals',                              total:       18_395 },
    { name: 'Court assessments and settlements',    total:       75_614 },
    { name: 'Other',                                total:      401_461 },
  ]},
  2011: { total: 15_345_509, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    2_916_298 },
    { name: 'Gasoline and other motor fuel taxes',  total:      412_150 },
    { name: 'Individual income taxes',              total:    1_409_473 },
    { name: 'Corporate income and franchise taxes', total:      447_322 },
    { name: 'Insurance taxes',                      total:      192_146 },
    { name: 'Other taxes',                          total:      520_660 },
    { name: 'Licenses, fees and permits',           total:      455_932 },
    { name: 'Federal government',                   total:    8_090_940 },
    { name: 'Investment income',                    total:       35_898 },
    { name: 'Charges for sales and services',       total:      366_417 },
    { name: 'Rentals',                              total:       21_353 },
    { name: 'Court assessments and settlements',    total:       32_301 },
    { name: 'Other',                                total:      444_619 },
  ]},
  2012: { total: 14_979_645, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_037_136 },
    { name: 'Gasoline and other motor fuel taxes',  total:      412_458 },
    { name: 'Individual income taxes',              total:    1_551_576 },
    { name: 'Corporate income and franchise taxes', total:      497_879 },
    { name: 'Insurance taxes',                      total:      209_937 },
    { name: 'Other taxes',                          total:      551_086 },
    { name: 'Licenses, fees and permits',           total:      470_979 },
    { name: 'Federal government',                   total:    7_313_545 },
    { name: 'Investment income',                    total:       48_250 },
    { name: 'Charges for sales and services',       total:      328_387 },
    { name: 'Rentals',                              total:       17_842 },
    { name: 'Court assessments and settlements',    total:       45_248 },
    { name: 'Other',                                total:      495_322 },
  ]},
  2013: { total: 15_661_275, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_122_591 },
    { name: 'Gasoline and other motor fuel taxes',  total:      409_730 },
    { name: 'Individual income taxes',              total:    1_680_470 },
    { name: 'Corporate income and franchise taxes', total:      539_174 },
    { name: 'Insurance taxes',                      total:      216_173 },
    { name: 'Other taxes',                          total:      531_494 },
    { name: 'Licenses, fees and permits',           total:      533_549 },
    { name: 'Federal government',                   total:    7_495_005 },
    { name: 'Investment income',                    total:       10_936 },
    { name: 'Charges for sales and services',       total:      346_611 },
    { name: 'Rentals',                              total:       27_698 },
    { name: 'Court assessments and settlements',    total:      141_008 },
    { name: 'Other',                                total:      606_836 },
  ]},
  2014: { total: 15_895_859, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_264_343 },
    { name: 'Gasoline and other motor fuel taxes',  total:      406_647 },
    { name: 'Individual income taxes',              total:    1_676_064 },
    { name: 'Corporate income and franchise taxes', total:      677_501 },
    { name: 'Insurance taxes',                      total:      267_971 },
    { name: 'Other taxes',                          total:      541_496 },
    { name: 'Licenses, fees and permits',           total:      522_588 },
    { name: 'Federal government',                   total:    7_343_489 },
    { name: 'Investment income',                    total:       67_807 },
    { name: 'Charges for sales and services',       total:      363_976 },
    { name: 'Rentals',                              total:       32_662 },
    { name: 'Court assessments and settlements',    total:      169_497 },
    { name: 'Other',                                total:      561_818 },
  ]},
  2015: { total: 16_288_346, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_324_776 },
    { name: 'Gasoline and other motor fuel taxes',  total:      419_622 },
    { name: 'Individual income taxes',              total:    1_747_961 },
    { name: 'Corporate income and franchise taxes', total:      691_769 },
    { name: 'Insurance taxes',                      total:      273_710 },
    { name: 'Other taxes',                          total:      515_596 },
    { name: 'Licenses, fees and permits',           total:      563_901 },
    { name: 'Federal government',                   total:    7_500_282 },
    { name: 'Investment income',                    total:       55_873 },
    { name: 'Charges for sales and services',       total:      361_793 },
    { name: 'Rentals',                              total:       15_553 },
    { name: 'Court assessments and settlements',    total:      163_915 },
    { name: 'Other',                                total:      653_595 },
  ]},
  2016: { total: 16_436_047, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_375_755 },
    { name: 'Gasoline and other motor fuel taxes',  total:      424_615 },
    { name: 'Individual income taxes',              total:    1_733_198 },
    { name: 'Corporate income and franchise taxes', total:      573_873 },
    { name: 'Insurance taxes',                      total:      314_756 },
    { name: 'Other taxes',                          total:      474_045 },
    { name: 'Licenses, fees and permits',           total:      569_717 },
    { name: 'Federal government',                   total:    7_494_821 },
    { name: 'Investment income',                    total:       66_516 },
    { name: 'Charges for sales and services',       total:      382_441 },
    { name: 'Rentals',                              total:       25_409 },
    { name: 'Court assessments and settlements',    total:      384_080 },
    { name: 'Other',                                total:      616_821 },
  ]},
  2017: { total: 16_123_218, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_399_477 },
    { name: 'Gasoline and other motor fuel taxes',  total:      430_162 },
    { name: 'Individual income taxes',              total:    1_728_682 },
    { name: 'Corporate income and franchise taxes', total:      567_316 },
    { name: 'Insurance taxes',                      total:      328_109 },
    { name: 'Other taxes',                          total:      498_986 },
    { name: 'Licenses, fees and permits',           total:      545_891 },
    { name: 'Federal government',                   total:    7_499_244 },
    { name: 'Investment income',                    total:       28_690 },
    { name: 'Charges for sales and services',       total:      353_640 },
    { name: 'Rentals',                              total:        1_312 },
    { name: 'Court assessments and settlements',    total:      204_378 },
    { name: 'Other',                                total:      537_331 },
  ]},
  2018: { total: 16_517_601, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_466_388 },
    { name: 'Gasoline and other motor fuel taxes',  total:      414_770 },
    { name: 'Individual income taxes',              total:    1_829_073 },
    { name: 'Corporate income and franchise taxes', total:      592_988 },
    { name: 'Insurance taxes',                      total:      340_743 },
    { name: 'Other taxes',                          total:      505_642 },
    { name: 'Licenses, fees and permits',           total:      528_467 },
    { name: 'Federal government',                   total:    7_671_041 },
    { name: 'Investment income',                    total:       41_879 },
    { name: 'Charges for sales and services',       total:      388_290 },
    { name: 'Rentals',                              total:        1_277 },
    { name: 'Court assessments and settlements',    total:      202_735 },
    { name: 'Other',                                total:      534_308 },
  ]},
  2019: { total: 16_881_667, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_626_296 },
    { name: 'Gasoline and other motor fuel taxes',  total:      430_910 },
    { name: 'Individual income taxes',              total:    1_908_011 },
    { name: 'Corporate income and franchise taxes', total:      650_618 },
    { name: 'Insurance taxes',                      total:      360_047 },
    { name: 'Other taxes',                          total:      513_111 },
    { name: 'Licenses, fees and permits',           total:      550_943 },
    { name: 'Federal government',                   total:    7_575_374 },
    { name: 'Investment income',                    total:      109_286 },
    { name: 'Charges for sales and services',       total:      423_232 },
    { name: 'Rentals',                              total:        1_545 },
    { name: 'Court assessments and settlements',    total:      239_531 },
    { name: 'Other',                                total:      492_763 },
  ]},
  2020: { total: 17_711_877, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    3_753_113 },
    { name: 'Gasoline and other motor fuel taxes',  total:      417_306 },
    { name: 'Individual income taxes',              total:    1_959_893 },
    { name: 'Corporate income and franchise taxes', total:      643_954 },
    { name: 'Insurance taxes',                      total:      359_957 },
    { name: 'Other taxes',                          total:      520_296 },
    { name: 'Licenses, fees and permits',           total:      503_359 },
    { name: 'Federal government',                   total:    8_201_641 },
    { name: 'Investment income',                    total:      103_933 },
    { name: 'Charges for sales and services',       total:      464_522 },
    { name: 'Rentals',                              total:          971 },
    { name: 'Court assessments and settlements',    total:      246_024 },
    { name: 'Lottery proceeds',                     total:       70_703 },
    { name: 'Other',                                total:      466_205 },
  ]},
  2021: { total: 20_825_008, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    4_294_532 },
    { name: 'Gasoline and other motor fuel taxes',  total:      439_581 },
    { name: 'Individual income taxes',              total:    2_170_810 },
    { name: 'Corporate income and franchise taxes', total:      744_188 },
    { name: 'Insurance taxes',                      total:      398_038 },
    { name: 'Other taxes',                          total:      542_906 },
    { name: 'Licenses, fees and permits',           total:      598_663 },
    { name: 'Federal government',                   total:   10_314_533 },
    { name: 'Investment income',                    total:       24_486 },
    { name: 'Charges for sales and services',       total:      500_856 },
    { name: 'Rentals',                              total:        1_309 },
    { name: 'Court assessments and settlements',    total:      218_936 },
    { name: 'Lottery proceeds',                     total:      137_718 },
    { name: 'Other',                                total:      438_452 },
  ]},
  2022: { total: 21_557_270, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    4_667_415 },
    { name: 'Gasoline and other motor fuel taxes',  total:      449_289 },
    { name: 'Individual income taxes',              total:    2_506_048 },
    { name: 'Corporate income and franchise taxes', total:      961_647 },
    { name: 'Insurance taxes',                      total:      404_553 },
    { name: 'Other taxes',                          total:      562_536 },
    { name: 'Licenses, fees and permits',           total:      601_325 },
    { name: 'Federal government',                   total:   10_310_293 },
    { name: 'Investment income',                    total:     -267_988 },
    { name: 'Charges for sales and services',       total:      522_466 },
    { name: 'Rentals',                              total:          828 },
    { name: 'Court assessments and settlements',    total:      235_872 },
    { name: 'Lottery proceeds',                     total:      122_883 },
    { name: 'Other',                                total:      480_103 },
  ]},
  2023: { total: 23_606_317, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    4_941_666 },
    { name: 'Gasoline and other motor fuel taxes',  total:      442_791 },
    { name: 'Individual income taxes',              total:    2_408_247 },
    { name: 'Corporate income and franchise taxes', total:    1_086_565 },
    { name: 'Insurance taxes',                      total:      434_094 },
    { name: 'Other taxes',                          total:      564_080 },
    { name: 'Licenses, fees and permits',           total:      600_229 },
    { name: 'Federal government',                   total:   10_620_766 },
    { name: 'Investment income',                    total:    1_055_607 },
    { name: 'Charges for sales and services',       total:      509_263 },
    { name: 'Rentals',                              total:         -957 },
    { name: 'Court assessments and settlements',    total:      215_785 },
    { name: 'Lottery proceeds',                     total:      122_376 },
    { name: 'Other',                                total:      605_805 },
  ]},
  2024: { total: 22_709_403, confidence: 'actual', categories: [
    { name: 'Sales and use taxes',                  total:    5_069_172 },
    { name: 'Gasoline and other motor fuel taxes',  total:      437_177 },
    { name: 'Individual income taxes',              total:    2_204_678 },
    { name: 'Corporate income and franchise taxes', total:      895_428 },
    { name: 'Insurance taxes',                      total:      510_090 },
    { name: 'Other taxes',                          total:      565_786 },
    { name: 'Licenses, fees and permits',           total:      605_935 },
    { name: 'Federal government',                   total:   10_966_392 },
    { name: 'Investment income',                    total:     -434_060 },
    { name: 'Charges for sales and services',       total:      524_150 },
    { name: 'Rentals',                              total:         -338 },
    { name: 'Court assessments and settlements',    total:      253_676 },
    { name: 'Lottery proceeds',                     total:      125_102 },
    { name: 'Other',                                total:      986_215 },
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
  return { jsonTree: [{ n: 'Mississippi General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'Mississippi General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ms-acfr-gf-revenue', base_url: 'https://www.dfa.ms.gov/publications', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
