#!/usr/bin/env node
/**
 * Kentucky General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Kentucky Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the KY state node → pure insert keyed (muni,fy,'revenue'); FY2023 intentionally absent (see HONEST HOLE below).
 *   KY state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): KY ACFR GF ~1.09x NASBO GF ($15,456,606K FY2024 vs $14,188,000K
 *   NASBO FY2024) -- near-parity, second-smallest divergence in the tranche after IN's
 *   ~0.99x. Kentucky reports Federal funds through a SEPARATE major fund column
 *   ($20,593,582K FY2024), keeping the General column's scope close to NASBO's budgetary
 *   GF concept. Recorded honestly at load (ACFR-31 near-parity finding).
 *
 * HONEST HOLE (FY2023): the FY2023 ACFR PDF's embedded fonts are subsetted TrueType/
 *   Identity-H CID fonts with NO ToUnicode CMap (confirmed via `pdffonts`, uni=no on
 *   every embedded font) -- `pdftotext` (all of -table/-layout/-raw) produces a
 *   consistently-garbled text layer for the ENTIRE document (not just the financial
 *   statement pages), unlike the FY2002 OCR case where the numeric table still extracted
 *   cleanly. No tesseract/OCR tooling was available in this environment as a fallback,
 *   and the Wayback Machine's cached copy is byte-identical to the live file (same
 *   font-encoding defect). FY2023 is OMITTED as a genuine, documented extraction failure
 *   -- never force-transcribed from a garbled source. FY2022 and FY2024 bracket the gap.
 *
 * WRAPPED-LABEL FIX (shared extract_gf.py fix, not KY-specific but discovered here):
 *   KY's narrow label column wraps several category names across two physical
 *   `pdftotext -table` lines with no numbers on the first line (e.g. "Interest and
 *   other" / "investment income", "Increase (decrease) in fair" / "value of
 *   investments", "Natural resources and" / "environmental protection"). extract_gf.py
 *   was silently dropping the first-line fragment, truncating category names (numbers
 *   were always correct -- only display names were wrong). Fixed generically in
 *   extract_gf.py's extract() with a `pending`-prefix accumulator: a text-only line
 *   with no digits is held and prepended onto the next data row's label. Reusable for
 *   any future state with the same narrow-column wrapping.
 *
 * FY2002 OCR TYPO (one-off, hand-corrected in ky_all.json): the 73MB scanned FY2002
 *   PDF's OCR text layer misread "Fines and forfeits" as "Rnes and forfeits" (F -> R)
 *   on the one row that carries the number -- confirmed against the identical row
 *   position/value pattern in every other loaded year. Corrected directly in the
 *   extracted JSON; the numeric value (44,760 thousand) was never affected (OCR only
 *   garbled the label glyph, not the digits).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Interest and other investment income" and "Increase (decrease) in fair value of investments" go negative in most years (e.g. FY2012 -681K / -15,574K; FY2020 -3,863K) -- both real GAAP fair-value-of-investments lines, not extraction artifacts. Clamp is the render path; no year shows a negative GF Total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ky/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processKYRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Kentucky'; const STATE_ABBR = 'KY'; const POPULATION = 4_505_836;
const EXPECTED_MUNI_ID = '6d9dfe88-f908-466c-95d5-66dce0777ee0';
const UNITS = 1_000; // KY ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2002%20CAFR.pdf', date: '2002-06-30' },
  2003: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2003CAFR.pdf', date: '2003-06-30' },
  2004: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2004CAFR.pdf', date: '2004-06-30' },
  2005: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2005CAFR.pdf', date: '2005-06-30' },
  2006: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2006CAFR.pdf', date: '2006-06-30' },
  2007: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2007PDFCAFR.pdf', date: '2007-06-30' },
  2008: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2008PDFCAFR.pdf', date: '2008-06-30' },
  2009: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2009CAFRFINAL.pdf', date: '2009-06-30' },
  2010: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2010CAFR.pdf', date: '2010-06-30' },
  2011: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2011CAFRFINALBOOK.pdf', date: '2011-06-30' },
  2012: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2012%20CAFR.pdf', date: '2012-06-30' },
  2013: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2013%20CAFR%20FOR%20WEB.pdf', date: '2013-06-30' },
  2014: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2014%20CAFR%20FINAL.pdf', date: '2014-06-30' },
  2015: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2015CAFR.pdf', date: '2015-06-30' },
  2016: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2016%20CAFR.pdf', date: '2016-06-30' },
  2017: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2017%20CAFR.pdf', date: '2017-06-30' },
  2018: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2018%20CAFR.pdf', date: '2018-06-30' },
  2019: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2019%20CAFR.pdf', date: '2019-06-30' },
  2020: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2020%20CAFR%20Report%20FINAL.pdf', date: '2020-06-30' },
  2021: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/FY%202021%20Kentucky%20Annual%20Comprehensive%20Financial%20Report.pdf', date: '2021-06-30' },
  2022: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2022%20Commonwealth%20of%20Kentucky,%20Annual%20Comprehensive%20Financial%20Report.pdf', date: '2022-06-30' },
  2024: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2024%20Kentucky%20Annual%20Comprehensive%20Financial%20Report.pdf', date: '2024-06-30' },
  2025: { url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2025%20Commonwealth%20of%20Kentucky%20Annual%20Comprehensive%20Financial%20Report.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Kentucky State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — KY ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 6_510_474, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    6_271_045 },
    { name: 'Licenses, fees, and permits',                      total:       25_197 },
    { name: 'Intergovernmental',                                total:        9_370 },
    { name: 'Charges for services',                             total:        6_662 },
    { name: 'Fines and forfeits',                               total:       44_760 },
    { name: 'Interest and other investment income',             total:       33_848 },
    { name: 'Increase (decrease) in fair value of investments', total:          674 },
    { name: 'Other revenues',                                   total:      118_918 },
  ]},
  2003: { total: 6_914_984, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    6_541_629 },
    { name: 'Licenses, fees, and permits',                      total:       25_459 },
    { name: 'Intergovernmental',                                total:      136_694 },
    { name: 'Charges for services',                             total:        7_452 },
    { name: 'Fines and forfeits',                               total:       49_567 },
    { name: 'Interest and other investment income',             total:       10_030 },
    { name: 'Increase (decrease) in fair value of investments', total:          -83 },
    { name: 'Other revenues',                                   total:      144_236 },
  ]},
  2004: { total: 6_984_268, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    6_684_572 },
    { name: 'Licenses, fees, and permits',                      total:       22_318 },
    { name: 'Intergovernmental',                                total:       16_406 },
    { name: 'Charges for services',                             total:       23_369 },
    { name: 'Fines and forfeits',                               total:       54_444 },
    { name: 'Interest and other investment income',             total:        7_154 },
    { name: 'Securities lending income',                        total:       15_549 },
    { name: 'Increase (decrease) in fair value of investments', total:         -106 },
    { name: 'Other revenues',                                   total:      160_562 },
  ]},
  2005: { total: 7_737_391, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    7_383_936 },
    { name: 'Licenses, fees, and permits',                      total:       30_507 },
    { name: 'Intergovernmental',                                total:       16_416 },
    { name: 'Charges for services',                             total:       56_843 },
    { name: 'Fines and forfeits',                               total:       49_260 },
    { name: 'Interest and other investment income',             total:       26_783 },
    { name: 'Increase (decrease) in fair value of investments', total:          171 },
    { name: 'Securities lending income',                        total:        5_701 },
    { name: 'Other revenues',                                   total:      167_774 },
  ]},
  2006: { total: 8_374_025, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    8_006_399 },
    { name: 'Licenses, fees, and permits',                      total:       27_040 },
    { name: 'Intergovernmental',                                total:        9_842 },
    { name: 'Charges for services',                             total:       87_740 },
    { name: 'Fines and forfeits',                               total:       50_450 },
    { name: 'Interest and other investment income',             total:       41_207 },
    { name: 'Increase (decrease) in fair value of investments', total:          350 },
    { name: 'Securities lending income',                        total:       15_463 },
    { name: 'Other revenues',                                   total:      135_534 },
  ]},
  2007: { total: 8_449_576, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    8_142_849 },
    { name: 'Licenses, fees, and permits',                      total:       33_687 },
    { name: 'Intergovernmental',                                total:       16_238 },
    { name: 'Charges for services',                             total:        9_773 },
    { name: 'Fines and forfeits',                               total:       50_879 },
    { name: 'Interest and other investment income',             total:       36_251 },
    { name: 'Increase (decrease) in fair value of investments', total:          407 },
    { name: 'Securities lending income',                        total:       14_503 },
    { name: 'Other revenues',                                   total:      144_989 },
  ]},
  2008: { total: 8_684_116, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    8_315_737 },
    { name: 'Licenses, fees, and permits',                      total:       35_266 },
    { name: 'Intergovernmental',                                total:       80_041 },
    { name: 'Charges for services',                             total:       17_278 },
    { name: 'Fines and forfeits',                               total:       52_654 },
    { name: 'Interest and other investment income',             total:       20_882 },
    { name: 'Increase (decrease) in fair value of investments', total:         -738 },
    { name: 'Securities lending income',                        total:        6_084 },
    { name: 'Other revenues',                                   total:      156_912 },
  ]},
  2009: { total: 8_464_775, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    8_099_138 },
    { name: 'Licenses, fees, and permits',                      total:       35_100 },
    { name: 'Intergovernmental',                                total:       81_909 },
    { name: 'Charges for services',                             total:       35_381 },
    { name: 'Fines and forfeits',                               total:       52_061 },
    { name: 'Interest and other investment income',             total:        2_311 },
    { name: 'Increase (decrease) in fair value of investments', total:         -412 },
    { name: 'Securities lending income',                        total:          579 },
    { name: 'Other revenues',                                   total:      158_708 },
  ]},
  2010: { total: 8_113_287, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    7_862_887 },
    { name: 'Licenses, fees, and permits',                      total:       43_360 },
    { name: 'Intergovernmental',                                total:       14_500 },
    { name: 'Charges for services',                             total:       10_082 },
    { name: 'Fines and forfeits',                               total:       49_367 },
    { name: 'Interest and other investment income',             total:        7_427 },
    { name: 'Increase (decrease) in fair value of investments', total:       -2_454 },
    { name: 'Securities lending income',                        total:          198 },
    { name: 'Other revenues',                                   total:      127_920 },
  ]},
  2011: { total: 8_560_421, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    8_426_994 },
    { name: 'Licenses, fees, and permits',                      total:       33_617 },
    { name: 'Intergovernmental',                                total:       14_398 },
    { name: 'Charges for services',                             total:       10_596 },
    { name: 'Fines and forfeits',                               total:       44_723 },
    { name: 'Interest and other investment income',             total:        1_369 },
    { name: 'Increase (decrease) in fair value of investments', total:        2_908 },
    { name: 'Securities lending income',                        total:          345 },
    { name: 'Other revenues',                                   total:       25_471 },
  ]},
  2012: { total: 8_945_590, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    8_612_780 },
    { name: 'Licenses, fees, and permits',                      total:       26_154 },
    { name: 'Intergovernmental',                                total:       13_958 },
    { name: 'Charges for services',                             total:      220_831 },
    { name: 'Fines and forfeits',                               total:       44_574 },
    { name: 'Interest and other investment income',             total:         -681 },
    { name: 'Increase (decrease) in fair value of investments', total:      -15_574 },
    { name: 'Securities lending income',                        total:          439 },
    { name: 'Other revenues',                                   total:       43_109 },
  ]},
  2013: { total: 9_408_751, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    9_018_088 },
    { name: 'Licenses, fees, and permits',                      total:       27_639 },
    { name: 'Intergovernmental',                                total:       15_543 },
    { name: 'Charges for services',                             total:      231_349 },
    { name: 'Fines and forfeits',                               total:       46_431 },
    { name: 'Interest and other investment income',             total:        1_637 },
    { name: 'Increase (decrease) in fair value of investments', total:         -218 },
    { name: 'Securities lending income',                        total:          722 },
    { name: 'Other revenues',                                   total:       67_560 },
  ]},
  2014: { total: 9_430_486, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    9_059_166 },
    { name: 'Licenses, fees, and permits',                      total:       33_673 },
    { name: 'Intergovernmental',                                total:       12_541 },
    { name: 'Charges for services',                             total:      238_974 },
    { name: 'Fines and forfeits',                               total:       39_964 },
    { name: 'Interest and other investment income',             total:          805 },
    { name: 'Increase (decrease) in fair value of investments', total:       -1_049 },
    { name: 'Securities lending income',                        total:          204 },
    { name: 'Other revenues',                                   total:       46_208 },
  ]},
  2015: { total: 10_010_544, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    9_626_220 },
    { name: 'Licenses, fees, and permits',                      total:       47_898 },
    { name: 'Intergovernmental',                                total:       10_321 },
    { name: 'Charges for services',                             total:      248_409 },
    { name: 'Fines and forfeits',                               total:       36_463 },
    { name: 'Interest and other investment income',             total:        4_326 },
    { name: 'Increase (decrease) in fair value of investments', total:         -581 },
    { name: 'Securities lending income',                        total:          530 },
    { name: 'Other revenues',                                   total:       36_958 },
  ]},
  2016: { total: 10_356_874, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:    9_976_752 },
    { name: 'Licenses, fees, and permits',                      total:       32_243 },
    { name: 'Intergovernmental',                                total:       10_627 },
    { name: 'Charges for services',                             total:      254_814 },
    { name: 'Fines and forfeits',                               total:       34_541 },
    { name: 'Interest and other investment income',             total:          799 },
    { name: 'Increase (decrease) in fair value of investments', total:         -354 },
    { name: 'Securities lending income',                        total:        1_194 },
    { name: 'Other revenues',                                   total:       46_258 },
  ]},
  2017: { total: 10_454_680, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   10_072_827 },
    { name: 'Licenses, fees, and permits',                      total:       32_340 },
    { name: 'Intergovernmental',                                total:       11_444 },
    { name: 'Charges for services',                             total:      249_034 },
    { name: 'Fines and forfeits',                               total:       31_556 },
    { name: 'Interest and other investment income',             total:          896 },
    { name: 'Increase (decrease) in fair value of investments', total:         -634 },
    { name: 'Securities lending income',                        total:        1_038 },
    { name: 'Other revenues',                                   total:       56_179 },
  ]},
  2018: { total: 10_772_696, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   10_416_040 },
    { name: 'Licenses, fees, and permits',                      total:       19_020 },
    { name: 'Intergovernmental',                                total:       10_414 },
    { name: 'Charges for services',                             total:      260_503 },
    { name: 'Fines and forfeits',                               total:       28_941 },
    { name: 'Interest and other investment income',             total:        1_777 },
    { name: 'Increase (decrease) in fair value of investments', total:       -7_838 },
    { name: 'Securities lending income',                        total:        1_042 },
    { name: 'Other revenues',                                   total:       42_797 },
  ]},
  2019: { total: 11_534_740, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   11_082_363 },
    { name: 'Licenses, fees, and permits',                      total:       44_749 },
    { name: 'Intergovernmental',                                total:        9_698 },
    { name: 'Charges for services',                             total:      273_127 },
    { name: 'Fines and forfeits',                               total:       31_453 },
    { name: 'Interest and other investment income',             total:        1_298 },
    { name: 'Increase (decrease) in fair value of investments', total:      -11_003 },
    { name: 'Securities lending income',                        total:        1_962 },
    { name: 'Other revenues',                                   total:      101_093 },
  ]},
  2020: { total: 11_708_933, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   11_293_996 },
    { name: 'Licenses, fees, and permits',                      total:       27_382 },
    { name: 'Intergovernmental',                                total:          304 },
    { name: 'Charges for services',                             total:      279_690 },
    { name: 'Fines and forfeits',                               total:       25_504 },
    { name: 'Interest and other investment income',             total:       -3_863 },
    { name: 'Increase (decrease) in fair value of investments', total:       -1_364 },
    { name: 'Securities lending income',                        total:          428 },
    { name: 'Other revenues',                                   total:       86_856 },
  ]},
  2021: { total: 12_903_095, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   12_483_348 },
    { name: 'Licenses, fees, and permits',                      total:       37_478 },
    { name: 'Intergovernmental',                                total:        9_159 },
    { name: 'Charges for services',                             total:      295_258 },
    { name: 'Fines and forfeits',                               total:       20_907 },
    { name: 'Interest and other investment income',             total:        2_393 },
    { name: 'Increase (decrease) in fair value of investments', total:       -1_694 },
    { name: 'Other revenues',                                   total:       56_246 },
  ]},
  2022: { total: 14_741_962, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   14_112_358 },
    { name: 'Licenses, fees, and permits',                      total:       23_374 },
    { name: 'Intergovernmental',                                total:        3_392 },
    { name: 'Charges for services',                             total:      303_860 },
    { name: 'Fines and forfeits',                               total:       29_451 },
    { name: 'Interest and other investment income',             total:        6_255 },
    { name: 'Increase (decrease) in fair value of investments', total:       -3_624 },
    { name: 'Other revenues',                                   total:      266_896 },
  ]},
  2024: { total: 15_456_606, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   14_700_108 },
    { name: 'Licenses, fees, and permits',                      total:       16_625 },
    { name: 'Intergovernmental',                                total:        5_932 },
    { name: 'Charges for services',                             total:      349_738 },
    { name: 'Fines and forfeits',                               total:       33_141 },
    { name: 'Interest and other investment income',             total:      112_450 },
    { name: 'Increase (decrease) in fair value of investments', total:      180_693 },
    { name: 'Other revenues',                                   total:       57_919 },
  ]},
  2025: { total: 15_541_675, confidence: 'actual', categories: [
    { name: 'Taxes',                                            total:   14_732_339 },
    { name: 'Licenses, fees, and permits',                      total:       26_864 },
    { name: 'Intergovernmental',                                total:        7_131 },
    { name: 'Charges for services',                             total:      357_453 },
    { name: 'Fines and forfeits',                               total:       31_186 },
    { name: 'Interest and other investment income',             total:      147_501 },
    { name: 'Increase (decrease) in fair value of investments', total:      185_073 },
    { name: 'Other revenues',                                   total:       54_128 },
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
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Kentucky General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2024, 2025];
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
    const srcPayload = { name: 'Kentucky General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ky-acfr-gf-revenue', base_url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/Pages/annual-comprehensive-financial-reports.aspx', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2024,2025], municipality_id: muniId };
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
      const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
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
