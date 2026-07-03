#!/usr/bin/env node
/**
 * Kentucky General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Kentucky Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating row on the KY state node in place (same (muni,fy,'operating') RPC key) for FY2024 only; FY2023 NASBO row intentionally retained (see HONEST HOLE below); other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ky/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processKYAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Kentucky State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — KY ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 6_650_623, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_482_785 },
    { name: 'Legislative and judicial',                       total:      229_408 },
    { name: 'Commerce',                                       total:       21_732 },
    { name: 'Education and humanities',                       total:    2_910_511 },
    { name: 'Human resources',                                total:    1_417_171 },
    { name: 'Justice',                                        total:      463_093 },
    { name: 'Natural resources and environmental protection', total:       65_473 },
    { name: 'Public protection and regulation',               total:       52_702 },
    { name: 'Transportation',                                 total:        7_748 },
  ]},
  2003: { total: 6_665_596, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_529_206 },
    { name: 'Legislative and judicial',                       total:      232_057 },
    { name: 'Commerce',                                       total:       19_115 },
    { name: 'Education and humanities',                       total:    2_972_632 },
    { name: 'Human resources',                                total:    1_341_749 },
    { name: 'Justice',                                        total:      458_980 },
    { name: 'Natural resources and environmental protection', total:       58_019 },
    { name: 'Public protection and regulation',               total:       47_427 },
    { name: 'Transportation',                                 total:        6_411 },
  ]},
  2004: { total: 6_824_064, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_551_367 },
    { name: 'Legislative and judicial',                       total:      251_957 },
    { name: 'Commerce',                                       total:       22_429 },
    { name: 'Education and humanities',                       total:    3_017_676 },
    { name: 'Human resources',                                total:    1_388_001 },
    { name: 'Justice',                                        total:      467_151 },
    { name: 'Natural resources and environmental protection', total:       58_937 },
    { name: 'Public protection and regulation',               total:       48_739 },
    { name: 'Transportation',                                 total:        4_684 },
    { name: 'Securities lending expense',                     total:       13_123 },
  ]},
  2005: { total: 7_232_441, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_722_219 },
    { name: 'Legislative and judicial',                       total:      262_385 },
    { name: 'Commerce',                                       total:       25_082 },
    { name: 'Education and humanities',                       total:    3_128_735 },
    { name: 'Human resources',                                total:    1_472_137 },
    { name: 'Justice',                                        total:      525_855 },
    { name: 'Natural resources and environmental protection', total:       70_802 },
    { name: 'Public protection and regulation',               total:       16_040 },
    { name: 'Transportation',                                 total:        3_896 },
    { name: 'Securities lending expense',                     total:        5_290 },
  ]},
  2006: { total: 8_042_030, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_869_053 },
    { name: 'Legislative and judicial',                       total:      283_151 },
    { name: 'Commerce',                                       total:       33_785 },
    { name: 'Education and humanities',                       total:    3_458_041 },
    { name: 'Human resources',                                total:    1_716_312 },
    { name: 'Justice',                                        total:      576_036 },
    { name: 'Natural resources and environmental protection', total:       69_646 },
    { name: 'Public protection and regulation',               total:       16_244 },
    { name: 'Transportation',                                 total:        4_987 },
    { name: 'Securities lending expense',                     total:       14_775 },
  ]},
  2007: { total: 8_297_979, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_929_110 },
    { name: 'Legislative and judicial',                       total:      283_551 },
    { name: 'Commerce',                                       total:       42_724 },
    { name: 'Education and humanities',                       total:    3_588_308 },
    { name: 'Human resources',                                total:    1_741_835 },
    { name: 'Justice',                                        total:      587_449 },
    { name: 'Natural resources and environmental protection', total:       71_331 },
    { name: 'Public protection and regulation',               total:       32_154 },
    { name: 'Transportation',                                 total:        7_550 },
    { name: 'Securities lending expense',                     total:       13_967 },
  ]},
  2008: { total: 8_992_548, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_990_222 },
    { name: 'Legislative and judicial',                       total:      312_739 },
    { name: 'Commerce',                                       total:       36_772 },
    { name: 'Education and humanities',                       total:    3_846_451 },
    { name: 'Human resources',                                total:    2_066_657 },
    { name: 'Justice',                                        total:      634_835 },
    { name: 'Natural resources and environmental protection', total:       76_251 },
    { name: 'Public protection and regulation',               total:       17_338 },
    { name: 'Transportation',                                 total:        6_124 },
    { name: 'Securities lending expense',                     total:        5_159 },
  ]},
  2009: { total: 8_696_721, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_922_640 },
    { name: 'Legislative and judicial',                       total:      315_424 },
    { name: 'Commerce',                                       total:       36_635 },
    { name: 'Education and humanities',                       total:    3_885_285 },
    { name: 'Human resources',                                total:    1_838_349 },
    { name: 'Justice',                                        total:      611_413 },
    { name: 'Natural resources and environmental protection', total:       66_477 },
    { name: 'Public protection and regulation',               total:       15_130 },
    { name: 'Transportation',                                 total:        5_050 },
    { name: 'Securities lending expense',                     total:          318 },
  ]},
  2010: { total: 7_942_849, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_775_026 },
    { name: 'Legislative and judicial',                       total:      318_064 },
    { name: 'Commerce',                                       total:       30_905 },
    { name: 'Education and humanities',                       total:    3_624_631 },
    { name: 'Human resources',                                total:    1_549_310 },
    { name: 'Justice',                                        total:      554_593 },
    { name: 'Natural resources and environmental protection', total:       68_049 },
    { name: 'Public protection and regulation',               total:       17_764 },
    { name: 'Transportation',                                 total:        4_399 },
    { name: 'Securities lending expense',                     total:          108 },
  ]},
  2011: { total: 9_010_611, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_595_819 },
    { name: 'Legislative and judicial',                       total:      357_175 },
    { name: 'Commerce',                                       total:       29_128 },
    { name: 'Education and humanities',                       total:    4_652_950 },
    { name: 'Human resources',                                total:    1_662_146 },
    { name: 'Justice',                                        total:      618_748 },
    { name: 'Natural resources and environmental protection', total:       69_526 },
    { name: 'Public protection and regulation',               total:       17_467 },
    { name: 'Transportation',                                 total:        7_448 },
    { name: 'Securities lending expense',                     total:          204 },
  ]},
  2012: { total: 8_907_430, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_604_368 },
    { name: 'Legislative and judicial',                       total:      367_433 },
    { name: 'Commerce',                                       total:       45_419 },
    { name: 'Education and humanities',                       total:    4_106_964 },
    { name: 'Human resources',                                total:    2_037_681 },
    { name: 'Justice',                                        total:      657_535 },
    { name: 'Natural resources and environmental protection', total:       69_126 },
    { name: 'Public protection and regulation',               total:       17_305 },
    { name: 'Transportation',                                 total:        1_394 },
    { name: 'Securities lending expense',                     total:          205 },
  ]},
  2013: { total: 8_829_409, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_539_956 },
    { name: 'Legislative and judicial',                       total:      355_981 },
    { name: 'Commerce',                                       total:       27_874 },
    { name: 'Education and humanities',                       total:    4_110_659 },
    { name: 'Human resources',                                total:    2_027_936 },
    { name: 'Justice',                                        total:      674_530 },
    { name: 'Natural resources and environmental protection', total:       69_480 },
    { name: 'Public protection and regulation',               total:       17_074 },
    { name: 'Transportation',                                 total:        5_513 },
    { name: 'Securities lending expense',                     total:          406 },
  ]},
  2014: { total: 9_287_871, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_564_140 },
    { name: 'Legislative and judicial',                       total:      370_701 },
    { name: 'Commerce',                                       total:       35_265 },
    { name: 'Education and humanities',                       total:    4_164_686 },
    { name: 'Human resources',                                total:    2_383_840 },
    { name: 'Justice',                                        total:      673_585 },
    { name: 'Natural resources and environmental protection', total:       69_986 },
    { name: 'Public protection and regulation',               total:       16_710 },
    { name: 'Transportation',                                 total:        5_828 },
    { name: 'Debt service — Principal retirement',            total:        3_050 },
    { name: 'Securities lending expense',                     total:           80 },
  ]},
  2015: { total: 9_260_605, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_531_764 },
    { name: 'Legislative and judicial',                       total:      390_942 },
    { name: 'Commerce',                                       total:       30_797 },
    { name: 'Education and humanities',                       total:    4_246_743 },
    { name: 'Human resources',                                total:    2_258_739 },
    { name: 'Justice',                                        total:      703_576 },
    { name: 'Natural resources and environmental protection', total:       66_248 },
    { name: 'Public protection and regulation',               total:       15_531 },
    { name: 'Transportation',                                 total:       13_995 },
    { name: 'Debt service — Principal retirement',            total:        2_033 },
    { name: 'Securities lending',                             total:          237 },
  ]},
  2016: { total: 9_584_205, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_506_165 },
    { name: 'Legislative and judicial',                       total:      391_222 },
    { name: 'Commerce',                                       total:       36_004 },
    { name: 'Education and humanities',                       total:    4_433_874 },
    { name: 'Human resources',                                total:    2_378_145 },
    { name: 'Justice',                                        total:      741_252 },
    { name: 'Natural resources and environmental protection', total:       65_720 },
    { name: 'Public protection and regulation',               total:       17_423 },
    { name: 'Transportation',                                 total:        6_285 },
    { name: 'Debt service — Principal retirement',            total:        7_359 },
    { name: 'Securities lending',                             total:          756 },
  ]},
  2017: { total: 10_464_451, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_638_967 },
    { name: 'Legislative and judicial',                       total:      415_170 },
    { name: 'Commerce',                                       total:       38_808 },
    { name: 'Education and humanities',                       total:    4_922_871 },
    { name: 'Human resources',                                total:    2_534_094 },
    { name: 'Justice',                                        total:      813_096 },
    { name: 'Natural resources and environmental protection', total:       68_330 },
    { name: 'Public protection and regulation',               total:       18_693 },
    { name: 'Transportation',                                 total:       13_670 },
    { name: 'Securities lending',                             total:          752 },
  ]},
  2018: { total: 10_432_406, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_645_422 },
    { name: 'Legislative and judicial',                       total:      417_462 },
    { name: 'Commerce',                                       total:       26_033 },
    { name: 'Education and humanities',                       total:    4_859_599 },
    { name: 'Human resources',                                total:    2_542_035 },
    { name: 'Justice',                                        total:      848_440 },
    { name: 'Natural resources and environmental protection', total:       63_982 },
    { name: 'Public protection and regulation',               total:       16_195 },
    { name: 'Transportation',                                 total:       12_364 },
    { name: 'Securities lending',                             total:          874 },
  ]},
  2019: { total: 10_835_302, confidence: 'actual', categories: [
    { name: 'General government',                             total:    1_658_369 },
    { name: 'Legislative and judicial',                       total:      446_183 },
    { name: 'Commerce',                                       total:       31_474 },
    { name: 'Education and humanities',                       total:    4_961_172 },
    { name: 'Human resources',                                total:    2_726_895 },
    { name: 'Justice',                                        total:      908_343 },
    { name: 'Natural resources and environmental protection', total:       71_925 },
    { name: 'Public protection and regulation',               total:       18_909 },
    { name: 'Transportation',                                 total:       10_224 },
    { name: 'Securities lending',                             total:        1_808 },
  ]},
  2020: { total: 10_914_165, confidence: 'actual', categories: [
    { name: 'General Government',                             total:    1_744_318 },
    { name: 'Legislative and Judicial',                       total:      446_827 },
    { name: 'Commerce',                                       total:       36_219 },
    { name: 'Education and Humanities',                       total:    4_834_010 },
    { name: 'Human Resources',                                total:    2_851_773 },
    { name: 'Justice',                                        total:      902_032 },
    { name: 'Natural Resources and Environmental Protection', total:       73_554 },
    { name: 'Public Protection and Regulation',               total:       17_929 },
    { name: 'Transportation',                                 total:        7_138 },
    { name: 'Securities lending',                             total:          365 },
  ]},
  2021: { total: 10_413_575, confidence: 'actual', categories: [
    { name: 'General Government',                             total:    1_573_363 },
    { name: 'Legislative and Judicial',                       total:      447_342 },
    { name: 'Commerce',                                       total:       48_257 },
    { name: 'Education and Humanities',                       total:    4_641_417 },
    { name: 'Human Resources',                                total:    2_821_540 },
    { name: 'Justice',                                        total:      789_747 },
    { name: 'Natural Resources and Environmental Protection', total:       69_465 },
    { name: 'Public Protection and Regulation',               total:       16_498 },
    { name: 'Transportation',                                 total:        5_946 },
  ]},
  2022: { total: 11_969_615, confidence: 'actual', categories: [
    { name: 'General Government',                             total:    2_126_906 },
    { name: 'Legislative and Judicial',                       total:      448_953 },
    { name: 'Commerce',                                       total:       63_823 },
    { name: 'Education and Humanities',                       total:    5_366_150 },
    { name: 'Human Resources',                                total:    2_814_118 },
    { name: 'Justice',                                        total:    1_048_516 },
    { name: 'Natural Resources and Environmental Protection', total:       74_134 },
    { name: 'Public Protection and Regulation',               total:       19_584 },
    { name: 'Transportation',                                 total:        7_431 },
  ]},
  2024: { total: 13_410_629, confidence: 'actual', categories: [
    { name: 'General Government',                             total:    2_567_279 },
    { name: 'Legislative and Judicial',                       total:      536_937 },
    { name: 'Commerce',                                       total:      100_400 },
    { name: 'Education and Humanities',                       total:    5_146_641 },
    { name: 'Human Resources',                                total:    3_673_729 },
    { name: 'Justice',                                        total:    1_250_799 },
    { name: 'Natural Resources and Environmental Protection', total:       91_454 },
    { name: 'Public Protection and Regulation',               total:       22_090 },
    { name: 'Transportation',                                 total:       21_300 },
  ]},
  2025: { total: 14_495_976, confidence: 'actual', categories: [
    { name: 'General Government',                             total:    2_965_699 },
    { name: 'Legislative and Judicial',                       total:      530_644 },
    { name: 'Commerce',                                       total:       75_208 },
    { name: 'Education and Humanities',                       total:    5_646_652 },
    { name: 'Human Resources',                                total:    3_847_789 },
    { name: 'Justice',                                        total:    1_246_183 },
    { name: 'Natural Resources and Environmental Protection', total:       88_397 },
    { name: 'Public Protection and Regulation',               total:       22_483 },
    { name: 'Transportation',                                 total:       72_921 },
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
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Kentucky General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2024, 2025];
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
    const srcPayload = { name: 'Kentucky General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ky-acfr-gf-operating', base_url: 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/Pages/annual-comprehensive-financial-reports.aspx', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2024,2025], municipality_id: muniId };
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
      const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
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
