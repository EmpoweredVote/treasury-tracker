#!/usr/bin/env node
/**
 * Hawaii General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Hawaii Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the HI state node → pure insert keyed (muni,fy,'revenue').
 *   HI state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE DECISION (ACFR-36 -- narrower-than-NASBO, UT precedent): HI ACFR GF ~0.95x NASBO GF
 *   (FY2025 $10,607,306K vs FY2024 NASBO $11,222,000K). Hawaii GAAP General Fund EXCLUDES the
 *   Med-Quest (Medicaid) Special Revenue Fund ($2.45B FY2025), reported as its own major-fund column.
 *   DECISION: load the printed GENERAL FUND column ALONE (option a, UT precedent) -- NOT a
 *   GF+Med-Quest composite. The node total is honestly narrower than NASBO; relabelled, not carved.
 *   FLAGGED FOR CHRIS UAT at Phase 124 (surface the GF-alone call).
 *
 * COLUMN GROWTH: GENERAL FUND is always the 1st column, but total column count grows 4 (FY2005) -> 8
 *   (FY2025) as special-revenue funds (Med-Quest etc.) are broken out. extract_gf.py position-anchor
 *   on the 1st data column handles it without per-year column config.
 *
 * URLS: WordPress upload-date folders, NOT derivable from FY -- enumerated off the archive page and
 *   pinned per year (durable). HOLE: FY2000-2004 are scanned image-only PDFs (zero embedded fonts,
 *   no text layer) -> not loadable via pdftotext. Window = FY2005-FY2025 (21 yr).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Net increase in fair value of investments positive at both bookends (FY2025 +$12,735K, FY2005 +$25,170K); 2008-09 crisis-era interior years scanned - clamp is the render path if any goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/hi/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processHIRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Hawaii'; const STATE_ABBR = 'HI'; const POPULATION = 1_455_271;
const EXPECTED_MUNI_ID = 'bf5b7221-9c8e-4df7-961d-e9c020ca733e';
const UNITS = 1_000; // HI ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2005: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2005.pdf', date: '2005-06-30' },
  2006: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://ags.hawaii.gov/wp-content/uploads/2018/01/acfr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://ags.hawaii.gov/wp-content/uploads/2018/12/acfr2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://ags.hawaii.gov/wp-content/uploads/2020/01/acfr2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://ags.hawaii.gov/wp-content/uploads/2021/01/acfr2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://ags.hawaii.gov/wp-content/uploads/2022/02/acfr2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://ags.hawaii.gov/wp-content/uploads/2023/02/acfr2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://ags.hawaii.gov/wp-content/uploads/2024/04/acfr2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://ags.hawaii.gov/wp-content/uploads/2025/02/acfr2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://ags.hawaii.gov/wp-content/uploads/2026/02/acfr2025.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Hawaii State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — HI ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2005: { total: 4_198_123, confidence: 'actual', categories: [
    { name: 'General excise taxes',                              total:    2_139_798 },
    { name: 'Net income tax corporations and individuals taxes', total:    1_484_664 },
    { name: 'Public service companies taxes',                    total:      108_686 },
    { name: 'Transient accommodations taxes',                    total:       12_689 },
    { name: 'Tobacco and liquor taxes',                          total:      127_805 },
    { name: 'Tax on premiums of insurance companies taxes',      total:       83_077 },
    { name: 'Franchise taxes',                                   total:       36_520 },
    { name: 'Others taxes',                                      total:       25_297 },
    { name: 'Interest and investment income',                    total:       25_170 },
    { name: 'Charges for current services',                      total:       69_215 },
    { name: 'Intergovernmental',                                 total:       10_729 },
    { name: 'Rentals',                                           total:        5_852 },
    { name: 'Fines, forfeitures, and penalties',                 total:       21_316 },
    { name: 'Licenses and fees',                                 total:        1_209 },
    { name: 'Revenues from private sources',                     total:        3_274 },
    { name: 'Other',                                             total:       42_822 },
  ]},
  2006: { total: 4_641_395, confidence: 'actual', categories: [
    { name: 'General excise taxes',                              total:    2_359_316 },
    { name: 'Net income tax corporations and individuals taxes', total:    1_664_331 },
    { name: 'Public service companies taxes',                    total:      120_678 },
    { name: 'Transient accommodations taxes',                    total:       16_129 },
    { name: 'Tobacco and liquor taxes',                          total:      132_782 },
    { name: 'Tax on premiums of insurance companies taxes',      total:       88_068 },
    { name: 'Franchise taxes',                                   total:       16_324 },
    { name: 'Other taxes',                                       total:       24_177 },
    { name: 'Interest and investment income',                    total:       41_865 },
    { name: 'Charges for current services',                      total:       95_841 },
    { name: 'Intergovernmental',                                 total:        7_952 },
    { name: 'Rentals',                                           total:           80 },
    { name: 'Fines, forfeitures, and penalties',                 total:       19_677 },
    { name: 'Licenses and fees',                                 total:        1_284 },
    { name: 'Revenues from private sources',                     total:        4_130 },
    { name: 'Other',                                             total:       48_761 },
  ]},
  2007: { total: 4_853_012, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_632_485 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_618_570 },
    { name: 'Public service companies taxes',                       total:      124_017 },
    { name: 'Transient accommodations taxes',                       total:        6_382 },
    { name: 'Tobacco and liquor taxes',                             total:      130_281 },
    { name: 'Tax on premiums of insurance companies taxes',         total:       94_377 },
    { name: 'Other taxes',                                          total:       24_923 },
    { name: 'Interest and investment income',                       total:       71_748 },
    { name: 'Charges for current services',                         total:       87_329 },
    { name: 'Intergovernmental',                                    total:       15_293 },
    { name: 'Rentals',                                              total:          564 },
    { name: 'Fines, forfeitures, and penalties',                    total:       20_712 },
    { name: 'Licenses and fees',                                    total:        1_245 },
    { name: 'Revenues from private sources',                        total:        1_831 },
    { name: 'Other',                                                total:       23_255 },
  ]},
  2008: { total: 4_845_895, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_597_121 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_637_265 },
    { name: 'Public service companies taxes',                       total:      127_481 },
    { name: 'Transient accommodations taxes',                       total:       15_756 },
    { name: 'Tobacco and liquor taxes',                             total:      129_063 },
    { name: 'Tax on premiums of insurance companies taxes',         total:       94_587 },
    { name: 'Franchise taxes',                                      total:       18_213 },
    { name: 'Other taxes',                                          total:        6_320 },
    { name: 'Interest and investment income',                       total:       27_639 },
    { name: 'Charges for current services',                         total:      112_644 },
    { name: 'Intergovernmental',                                    total:        4_634 },
    { name: 'Rentals',                                              total:          462 },
    { name: 'Fines, forfeitures, and penalties',                    total:       23_508 },
    { name: 'Licenses and fees',                                    total:        1_510 },
    { name: 'Revenues from private sources',                        total:        2_317 },
    { name: 'Other',                                                total:       47_375 },
  ]},
  2009: { total: 4_376_108, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_410_756 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_373_893 },
    { name: 'Public service companies taxes',                       total:      126_069 },
    { name: 'Transient accommodations taxes',                       total:       13_408 },
    { name: 'Tobacco and liquor taxes',                             total:      124_198 },
    { name: 'Tax on premiums of insurance companies taxes',         total:       93_720 },
    { name: 'Franchise taxes',                                      total:       26_075 },
    { name: 'Other taxes',                                          total:        9_042 },
    { name: 'Interest and investment (loss) income',                total:      -24_166 },
    { name: 'Charges for current services',                         total:      107_117 },
    { name: 'Intergovernmental',                                    total:        3_884 },
    { name: 'Rentals',                                              total:          461 },
    { name: 'Fines, forfeitures, and penalties',                    total:       23_787 },
    { name: 'Licenses and fees',                                    total:          738 },
    { name: 'Revenues from private sources',                        total:        1_607 },
    { name: 'Other',                                                total:       85_519 },
  ]},
  2010: { total: 4_436_799, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_279_310 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_408_965 },
    { name: 'Public service companies taxes',                       total:      157_661 },
    { name: 'Transient accommodations taxes',                       total:       31_635 },
    { name: 'Tobacco and liquor taxes',                             total:      129_576 },
    { name: 'Tax on premiums of insurance companies taxes',         total:      104_667 },
    { name: 'Franchise taxes',                                      total:       18_666 },
    { name: 'Other taxes',                                          total:       17_918 },
    { name: 'Interest and investment income',                       total:       61_251 },
    { name: 'Charges for current services',                         total:      111_089 },
    { name: 'Intergovernmental',                                    total:        5_852 },
    { name: 'Rentals',                                              total:          392 },
    { name: 'Fines, forfeitures, and penalties',                    total:       23_304 },
    { name: 'Licenses and fees',                                    total:        1_430 },
    { name: 'Revenues from private sources',                        total:       15_195 },
    { name: 'Other',                                                total:       69_888 },
  ]},
  2011: { total: 4_928_104, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_507_980 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_473_188 },
    { name: 'Public service companies taxes',                       total:      117_940 },
    { name: 'Transient accommodations taxes',                       total:       59_839 },
    { name: 'Tobacco and liquor taxes',                             total:      154_190 },
    { name: 'Tax on premiums of insurance companies taxes',         total:      139_090 },
    { name: 'Franchise taxes',                                      total:       31_682 },
    { name: 'Other taxes',                                          total:       43_601 },
    { name: 'Interest and investment income',                       total:       24_485 },
    { name: 'Charges for current services',                         total:      109_048 },
    { name: 'Intergovernmental',                                    total:       13_096 },
    { name: 'Rentals',                                              total:          462 },
    { name: 'Fines, forfeitures, and penalties',                    total:       23_944 },
    { name: 'Licenses and fees',                                    total:        7_179 },
    { name: 'Revenues from private sources',                        total:       14_172 },
    { name: 'Other',                                                total:      208_208 },
  ]},
  2012: { total: 5_303_611, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_774_636 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_633_412 },
    { name: 'Public service companies taxes',                       total:      150_528 },
    { name: 'Transient accommodations taxes',                       total:      137_529 },
    { name: 'Tobacco and liquor taxes',                             total:      151_707 },
    { name: 'Tax on premiums of insurance companies taxes',         total:      117_617 },
    { name: 'Rental motor/tour vehicle surcharge taxes',            total:       61_430 },
    { name: 'Franchise taxes',                                      total:        5_229 },
    { name: 'Other taxes',                                          total:       47_799 },
    { name: 'Interest and investment income (loss)',                total:       -1_691 },
    { name: 'Charges for current services',                         total:      121_362 },
    { name: 'Intergovernmental',                                    total:       13_520 },
    { name: 'Rentals',                                              total:          360 },
    { name: 'Fines, forfeitures, and penalties',                    total:       23_409 },
    { name: 'Licenses and fees',                                    total:        6_003 },
    { name: 'Revenues from private sources',                        total:       25_297 },
    { name: 'Other',                                                total:       35_464 },
  ]},
  2013: { total: 5_784_004, confidence: 'actual', categories: [
    { name: 'General excise taxes',                                 total:    2_991_792 },
    { name: 'Net income tax -- corporations and individuals taxes', total:    1_804_409 },
    { name: 'Public service companies taxes',                       total:      163_930 },
    { name: 'Transient accommodations taxes',                       total:      185_377 },
    { name: 'Tobacco and liquor taxes',                             total:      143_141 },
    { name: 'Tax on premiums of insurance companies taxes',         total:      131_906 },
    { name: 'Rental motor/tour vehicle surcharge taxes',            total:        4_519 },
    { name: 'Franchise taxes',                                      total:       20_673 },
    { name: 'Other taxes',                                          total:       51_571 },
    { name: 'Interest and investment income',                       total:       12_424 },
    { name: 'Charges for current services',                         total:      122_252 },
    { name: 'Intergovernmental',                                    total:       13_708 },
    { name: 'Rentals',                                              total:          276 },
    { name: 'Fines, forfeitures, and penalties',                    total:       22_343 },
    { name: 'Licenses and fees',                                    total:        6_465 },
    { name: 'Revenues from private sources',                        total:        2_423 },
    { name: 'Other',                                                total:      106_795 },
  ]},
  2014: { total: 5_619_145, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    2_816_346 },
    { name: 'Net income tax corporations and individuals', total:    1_840_963 },
    { name: 'Public service companies tax',                total:      166_179 },
    { name: 'Transient accommodations tax',                total:      188_721 },
    { name: 'Tobacco and liquor tax',                      total:      125_964 },
    { name: 'Tax on premiums of insurance companies',      total:      137_179 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            1 },
    { name: 'Franchise tax',                               total:       36_983 },
    { name: 'Other',                                       total:       59_737 },
    { name: 'Interest and investment income',              total:        5_012 },
    { name: 'Charges for current services',                total:      130_601 },
    { name: 'Intergovernmental',                           total:       12_924 },
    { name: 'Rentals',                                     total:           26 },
    { name: 'Fines, forfeitures and penalties',            total:       22_624 },
    { name: 'Licenses and fees',                           total:        6_443 },
    { name: 'Revenues from private sources',               total:        3_257 },
    { name: 'Other',                                       total:       66_185 },
  ]},
  2015: { total: 6_000_204, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_021_418 },
    { name: 'Net income tax corporations and individuals', total:    2_047_327 },
    { name: 'Public service companies tax',                total:      163_481 },
    { name: 'Transient accommodations tax',                total:      202_345 },
    { name: 'Tobacco and liquor tax',                      total:      133_110 },
    { name: 'Tax on premiums of insurance companies',      total:      145_672 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            1 },
    { name: 'Franchise tax',                               total:       17_930 },
    { name: 'Other',                                       total:       38_539 },
    { name: 'Interest and investment income',              total:        7_531 },
    { name: 'Charges for current services',                total:      135_168 },
    { name: 'Intergovernmental',                           total:       14_192 },
    { name: 'Rentals',                                     total:          176 },
    { name: 'Fines, forfeitures and penalties',            total:       22_874 },
    { name: 'Licenses and fees',                           total:        1_091 },
    { name: 'Revenues from private sources',               total:        3_389 },
    { name: 'Other',                                       total:       45_960 },
  ]},
  2016: { total: 6_401_885, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_192_469 },
    { name: 'Net income tax corporations and individuals', total:    2_157_879 },
    { name: 'Public service companies tax',                total:      152_760 },
    { name: 'Transient accommodations tax',                total:      233_082 },
    { name: 'Tobacco and liquor tax',                      total:      134_275 },
    { name: 'Tax on premiums of insurance companies',      total:      152_622 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            1 },
    { name: 'Franchise tax',                               total:       12_691 },
    { name: 'Other',                                       total:       92_005 },
    { name: 'Interest and investment income',              total:       10_407 },
    { name: 'Charges for current services',                total:      152_820 },
    { name: 'Intergovernmental',                           total:       16_852 },
    { name: 'Rentals',                                     total:          557 },
    { name: 'Fines, forfeitures and penalties',            total:       22_528 },
    { name: 'Licenses and fees',                           total:          989 },
    { name: 'Revenues from private sources',               total:        4_665 },
    { name: 'Other',                                       total:       65_283 },
  ]},
  2017: { total: 6_652_418, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_189_599 },
    { name: 'Net income tax corporations and individuals', total:    2_286_017 },
    { name: 'Public service companies tax',                total:      122_159 },
    { name: 'Transient accommodations tax',                total:      299_712 },
    { name: 'Tobacco and liquor tax',                      total:      133_959 },
    { name: 'Tax on premiums of insurance companies',      total:      164_688 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            2 },
    { name: 'Franchise tax',                               total:        9_174 },
    { name: 'Other',                                       total:       83_795 },
    { name: 'Interest and investment income',              total:       14_402 },
    { name: 'Charges for current services',                total:      195_331 },
    { name: 'Intergovernmental',                           total:        8_619 },
    { name: 'Rentals',                                     total:          323 },
    { name: 'Fines, forfeitures and penalties',            total:       22_450 },
    { name: 'Licenses and fees',                           total:        1_070 },
    { name: 'Revenues from private sources',               total:        2_922 },
    { name: 'Other',                                       total:      118_196 },
  ]},
  2018: { total: 7_067_502, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_420_476 },
    { name: 'Net income tax corporations and individuals', total:    2_456_674 },
    { name: 'Public service companies tax',                total:      117_641 },
    { name: 'Transient accommodations tax',                total:      304_521 },
    { name: 'Tobacco and liquor tax',                      total:      131_296 },
    { name: 'Tax on premiums of insurance companies',      total:      159_814 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            2 },
    { name: 'Franchise tax',                               total:       13_712 },
    { name: 'Other',                                       total:      100_529 },
    { name: 'Interest and investment income',              total:       13_870 },
    { name: 'Charges for current services',                total:      200_240 },
    { name: 'Intergovernmental',                           total:       13_018 },
    { name: 'Rentals',                                     total:           20 },
    { name: 'Fines, forfeitures and penalties',            total:       23_353 },
    { name: 'Licenses and fees',                           total:        1_074 },
    { name: 'Revenues from private sources',               total:        2_882 },
    { name: 'Other',                                       total:      108_380 },
  ]},
  2019: { total: 7_487_440, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_527_256 },
    { name: 'Net income tax corporations and individuals', total:    2_718_654 },
    { name: 'Public service companies tax',                total:      126_691 },
    { name: 'Transient accommodations tax',                total:      356_670 },
    { name: 'Tobacco and liquor tax',                      total:      126_439 },
    { name: 'Tax on premiums of insurance companies',      total:      173_844 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            3 },
    { name: 'Franchise tax',                               total:       24_808 },
    { name: 'Other',                                       total:       75_629 },
    { name: 'Interest and investment income',              total:       18_950 },
    { name: 'Charges for current services',                total:      224_570 },
    { name: 'Intergovernmental',                           total:       14_075 },
    { name: 'Rentals',                                     total:          339 },
    { name: 'Fines, forfeitures and penalties',            total:       22_815 },
    { name: 'Licenses and fees',                           total:        1_784 },
    { name: 'Revenues from private sources',               total:        4_620 },
    { name: 'Other',                                       total:       70_293 },
  ]},
  2020: { total: 7_300_610, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_364_897 },
    { name: 'Net income tax corporations and individuals', total:    2_657_551 },
    { name: 'Public service companies tax',                total:      134_639 },
    { name: 'Transient accommodations tax',                total:      303_176 },
    { name: 'Tobacco and liquor tax',                      total:      125_532 },
    { name: 'Tax on premiums of insurance companies',      total:      180_753 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            2 },
    { name: 'Franchise tax',                               total:       33_271 },
    { name: 'Other',                                       total:       85_441 },
    { name: 'Interest and investment income',              total:       91_740 },
    { name: 'Charges for current services',                total:      218_697 },
    { name: 'Intergovernmental',                           total:       14_169 },
    { name: 'Rentals',                                     total:          408 },
    { name: 'Fines, forfeitures and penalties',            total:       18_670 },
    { name: 'Licenses and fees',                           total:          877 },
    { name: 'Revenues from private sources',               total:        5_571 },
    { name: 'Other',                                       total:       65_216 },
  ]},
  2021: { total: 7_366_965, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_195_843 },
    { name: 'Net income tax corporations and individuals', total:    3_233_174 },
    { name: 'Public service companies tax',                total:      125_201 },
    { name: 'Transient accommodations tax',                total:      194_095 },
    { name: 'Tobacco and liquor tax',                      total:      117_925 },
    { name: 'Tax on premiums of insurance companies',      total:      185_570 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            5 },
    { name: 'Franchise tax',                               total:        3_079 },
    { name: 'Other',                                       total:       72_973 },
    { name: 'Interest and investment income',              total:       14_035 },
    { name: 'Charges for current services',                total:      128_101 },
    { name: 'Intergovernmental',                           total:        9_711 },
    { name: 'Rentals',                                     total:          292 },
    { name: 'Fines, forfeitures and penalties',            total:       19_329 },
    { name: 'Licenses and fees',                           total:          741 },
    { name: 'Revenues from private sources',               total:        8_876 },
    { name: 'Other',                                       total:       58_015 },
  ]},
  2022: { total: 9_009_521, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    3_603_931 },
    { name: 'Net income tax corporations and individuals', total:    3_758_447 },
    { name: 'Public service companies tax',                total:      122_068 },
    { name: 'Transient accommodations tax',                total:      661_330 },
    { name: 'Tobacco and liquor tax',                      total:      119_641 },
    { name: 'Tax on premiums of insurance companies',      total:      195_607 },
    { name: 'Rental motor/vehicle surcharge tax',          total:           14 },
    { name: 'Franchise tax',                               total:       57_252 },
    { name: 'Other',                                       total:      223_601 },
    { name: 'Interest and dividend income',                total:       26_009 },
    { name: 'Charges for current services',                total:      134_132 },
    { name: 'Intergovernmental',                           total:       15_041 },
    { name: 'Rentals',                                     total:          325 },
    { name: 'Fines, forfeitures and penalties',            total:       17_789 },
    { name: 'Licenses and fees',                           total:        2_437 },
    { name: 'Revenues from private sources',               total:        5_878 },
    { name: 'Other',                                       total:       66_019 },
  ]},
  2023: { total: 10_701_443, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                             total:    4_425_593 },
    { name: 'Net income tax corporations and individuals',          total:    3_631_310 },
    { name: 'Public service companies tax',                         total:      142_195 },
    { name: 'Transient accommodations tax',                         total:      755_022 },
    { name: 'Tobacco and liquor tax',                               total:      113_583 },
    { name: 'Tax on premiums of insurance companies',               total:      203_791 },
    { name: 'Rental motor/vehicle surcharge tax',                   total:            8 },
    { name: 'Franchise tax',                                        total:       28_969 },
    { name: 'Other',                                                total:      992_387 },
    { name: 'Interest and dividend income',                         total:       91_353 },
    { name: 'Net increase (decrease) in fair value of investments', total:      -26_846 },
    { name: 'Charges for current services',                         total:      124_420 },
    { name: 'Intergovernmental',                                    total:       16_764 },
    { name: 'Rentals',                                              total:          196 },
    { name: 'Fines, forfeitures and penalties',                     total:       15_978 },
    { name: 'Licenses and fees',                                    total:          912 },
    { name: 'Revenues from private sources',                        total:        6_918 },
    { name: 'Other',                                                total:      178_890 },
  ]},
  2024: { total: 10_053_608, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    4_458_592 },
    { name: 'Net income tax corporations and individuals', total:    3_795_123 },
    { name: 'Public service companies tax',                total:      159_222 },
    { name: 'Transient accommodations tax',                total:      727_247 },
    { name: 'Tobacco and liquor tax',                      total:      110_391 },
    { name: 'Tax on premiums of insurance companies',      total:      211_352 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            3 },
    { name: 'Franchise tax',                               total:       28_912 },
    { name: 'Other',                                       total:      132_073 },
    { name: 'Interest and dividend income',                total:      150_446 },
    { name: 'Net decrease in fair value of investments',   total:       -8_243 },
    { name: 'Charges for current services',                total:      152_803 },
    { name: 'Intergovernmental',                           total:        8_390 },
    { name: 'Rentals',                                     total:          220 },
    { name: 'Fines, forfeitures and penalties',            total:       13_129 },
    { name: 'Licenses and fees',                           total:        1_107 },
    { name: 'Revenues from private sources',               total:       13_866 },
    { name: 'Other',                                       total:       98_975 },
  ]},
  2025: { total: 10_607_306, confidence: 'actual', categories: [
    { name: 'Taxes General excise tax',                    total:    4_600_173 },
    { name: 'Net income tax corporations and individuals', total:    3_677_474 },
    { name: 'Public service companies tax',                total:      154_478 },
    { name: 'Transient accommodations tax',                total:      717_246 },
    { name: 'Tobacco and liquor tax',                      total:      107_071 },
    { name: 'Tax on premiums of insurance companies',      total:      218_833 },
    { name: 'Rental motor/vehicle surcharge tax',          total:            3 },
    { name: 'Franchise tax',                               total:        8_296 },
    { name: 'Other',                                       total:      480_531 },
    { name: 'Interest and dividend income',                total:      167_213 },
    { name: 'Net increase in fair value of investments',   total:       12_735 },
    { name: 'Charges for current services',                total:      263_131 },
    { name: 'Intergovernmental',                           total:       11_743 },
    { name: 'Rentals',                                     total:           77 },
    { name: 'Fines, forfeitures and penalties',            total:       13_704 },
    { name: 'Licenses and fees',                           total:          847 },
    { name: 'Revenues from private sources',               total:       13_805 },
    { name: 'Other',                                       total:      159_946 },
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
  return { jsonTree: [{ n: 'Hawaii General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Hawaii General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'hi-acfr-gf-revenue', base_url: 'https://ags.hawaii.gov/accounting/annual-financial-reports/', fiscal_years: [2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
