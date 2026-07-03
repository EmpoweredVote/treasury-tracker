#!/usr/bin/env node
/**
 * Arizona General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Arizona Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the AZ state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   AZ state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): AZ ACFR GF ~2.46× NASBO GF — "Intergovernmental" (federal
 *   Medicaid/education passthrough, $25,234,916K FY2024) consolidated into the GAAP GF.
 *   Accepted-and-relabelled honestly (TX precedent).
 *
 * ACCESS: gao.az.gov runs a Cloudflare bot-management WAF (session cookie + Referer needed;
 *   see 113-02-AZ-LOADLOG.md for the fetch recipe used).
 *
 * FY2024 URL DURABILITY: see the SOURCES[2024] entry comment — resolved per the locked
 *   Phase-113 decision (re-check gao.az.gov, else caveated Google Drive link).
 *
 * WINDOW: FY2002–FY2024 (FY2025 not yet published — NASBO shows it as "Estimated").
 *
 * NEGATIVE-LINE NOTE (ACFR-32): No negative GF lines in the bookend years; every transcribed year scanned — clamp is the render path if any year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/az/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processAZAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Arizona'; const STATE_ABBR = 'AZ'; const POPULATION = 7_151_502;
const EXPECTED_MUNI_ID = '866036ee-20b2-4e3c-a4f3-5100659edf31';
const UNITS = 1_000; // AZ ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://gao.az.gov/sites/default/files/2022-05/02-CAFRall_0.pdf', date: '2002-06-30' },
  2003: { url: 'https://gao.az.gov/sites/default/files/2022-05/03-CAFR-all_0.pdf', date: '2003-06-30' },
  2004: { url: 'https://gao.az.gov/sites/default/files/2022-05/04-CAFR2004_0.pdf', date: '2004-06-30' },
  2005: { url: 'https://gao.az.gov/sites/default/files/2022-05/CAFR2005_3.pdf', date: '2005-06-30' },
  2006: { url: 'https://gao.az.gov/sites/default/files/2022-05/CAFR2006_all_0.pdf', date: '2006-06-30' },
  2007: { url: 'https://gao.az.gov/sites/default/files/2022-05/CAFR2007_all_0.pdf', date: '2007-06-30' },
  2008: { url: 'https://gao.az.gov/sites/default/files/2022-05/2008_CAFR_RFS_0.pdf', date: '2008-06-30' },
  2009: { url: 'https://gao.az.gov/sites/default/files/2022-05/FY09CAFR-051110_0.pdf', date: '2009-06-30' },
  2010: { url: 'https://gao.az.gov/sites/default/files/2022-05/2010_CAFR-031511_0.pdf', date: '2010-06-30' },
  2011: { url: 'https://gao.az.gov/sites/default/files/2022-05/FY11_CAFR-022812_0.pdf', date: '2011-06-30' },
  2012: { url: 'https://gao.az.gov/sites/default/files/2022-05/FY12_CAFR-021513_0.pdf', date: '2012-06-30' },
  2013: { url: 'https://gao.az.gov/sites/default/files/2022-05/FY13CAFR-SECURED_0.pdf', date: '2013-06-30' },
  2014: { url: 'https://gao.az.gov/sites/default/files/2022-05/2014_CAFR-TOC.pdf', date: '2014-06-30' },
  2015: { url: 'https://gao.az.gov/sites/default/files/2022-05/FY%25202015%2520CAFR%2520FINAL%2520NO%2520AG%2520SIG%25206-9-16.pdf', date: '2015-06-30' },
  2016: { url: 'https://gao.az.gov/sites/default/files/2022-05/16%2520CAFR%25206-08-17%2520wosig.pdf', date: '2016-06-30' },
  2017: { url: 'https://gao.az.gov/sites/default/files/2022-05/CAFR%2520-%2520Final%2520NoSig%2520-%2520FY2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://gao.az.gov/sites/default/files/2022-05/Final%2520State%2520of%2520AZ%2520-%2520CAFR%2520-%2520FY18%2520-%25203-8-19%2520no%2520sig.pdf', date: '2018-06-30' },
  2019: { url: 'https://gao.az.gov/sites/default/files/2022-04/State%2520of%2520AZ%2520-%2520CAFR%2520-%25202019%2520Opinion%2520wosig.pdf', date: '2019-06-30' },
  2020: { url: 'https://gao.az.gov/sites/default/files/2022-05/State%2520of%2520AZ%2520-%2520CAFR%2520Final%2520-%2520nosig%2520-2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://gao.az.gov/sites/default/files/2022-11/State%20of%20AZ%20-%20FY21%20ACFR%20Final%20-%20w%20sig_0.pdf', date: '2021-06-30' },
  2022: { url: 'https://gao.az.gov/sites/default/files/2023-10/State%20of%20AZ%20-%20FY22%20ACFR%20Final%20-%20w%20sig.pdf', date: '2022-06-30' },
  2023: { url: 'https://gao.az.gov/sites/default/files/2024-11/State%20of%20AZ%20-%20FY23%20ACFR%20Final%20-%20w%20sig.pdf', date: '2023-06-30' },
  // FY2024 NON-DURABLE URL CAVEAT (D-06/D-07, Phase-113 locked decision): as of 2026-07-02 the
  // FY2024 ACFR is published ONLY via this Google Drive share link — the gao.az.gov FY2024 node
  // page was re-checked at load time and still links to Drive, not to the normal
  // sites/default/files hosting every other year uses. Re-check for a migrated durable URL at
  // the next AZ touch and swap it in (numbers tie exactly; only the URL is fragile).
  2024: { url: 'https://drive.google.com/uc?export=download&id=14FYCgTQPsu77pxLtz41E_Ba_0hCuMhwA', date: '2024-06-30' },
};
const dataSource = (fy) => `Arizona State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — AZ ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 11_702_561, confidence: 'actual', categories: [
    { name: 'General government',                               total:      401_389 },
    { name: 'Health and welfare',                               total:    5_512_341 },
    { name: 'Inspection and regulation',                        total:       49_152 },
    { name: 'Education',                                        total:    3_599_432 },
    { name: 'Protection and safety',                            total:      822_952 },
    { name: 'Transportation',                                   total:           56 },
    { name: 'Natural resources',                                total:       54_375 },
    { name: 'Intergovernmental revenue sharing',                total:    1_205_039 },
    { name: 'Debt service — Principal',                         total:        6_316 },
    { name: 'Debt service — Interest and other fiscal charges', total:        1_270 },
    { name: 'Capital outlay',                                   total:       50_239 },
  ]},
  2003: { total: 13_031_600, confidence: 'actual', categories: [
    { name: 'General government',                               total:      595_951 },
    { name: 'Health and welfare',                               total:    6_312_800 },
    { name: 'Inspection and regulation',                        total:       49_390 },
    { name: 'Education',                                        total:    3_811_254 },
    { name: 'Protection and safety',                            total:      829_850 },
    { name: 'Transportation',                                   total:           62 },
    { name: 'Natural resources',                                total:       45_182 },
    { name: 'Intergovernmental revenue sharing',                total:    1_202_634 },
    { name: 'Debt service — Principal',                         total:        8_079 },
    { name: 'Debt service — Interest and other fiscal charges', total:        3_958 },
    { name: 'Capital outlay',                                   total:      172_440 },
  ]},
  2004: { total: 14_337_390, confidence: 'actual', categories: [
    { name: 'General government',                               total:      627_051 },
    { name: 'Health and welfare',                               total:    7_448_239 },
    { name: 'Inspection and regulation',                        total:       44_822 },
    { name: 'Education',                                        total:    4_027_898 },
    { name: 'Protection and safety',                            total:      924_069 },
    { name: 'Transportation',                                   total:           68 },
    { name: 'Natural resources',                                total:       48_789 },
    { name: 'Intergovernmental revenue sharing',                total:    1_121_670 },
    { name: 'Debt service — Principal',                         total:        5_998 },
    { name: 'Debt service — Interest and other fiscal charges', total:       33_387 },
    { name: 'Capital outlay',                                   total:       55_399 },
  ]},
  2005: { total: 15_569_604, confidence: 'actual', categories: [
    { name: 'General government',                               total:      662_139 },
    { name: 'Health and welfare',                               total:    8_088_851 },
    { name: 'Inspection and regulation',                        total:       47_809 },
    { name: 'Education',                                        total:    4_333_786 },
    { name: 'Protection and safety',                            total:    1_025_226 },
    { name: 'Transportation',                                   total:           72 },
    { name: 'Natural resources',                                total:       54_438 },
    { name: 'Intergovernmental revenue sharing',                total:    1_248_817 },
    { name: 'Debt service — Principal',                         total:       23_053 },
    { name: 'Debt service — Interest and other fiscal charges', total:       45_114 },
    { name: 'Capital outlay',                                   total:       40_299 },
  ]},
  2006: { total: 16_985_072, confidence: 'actual', categories: [
    { name: 'General government',                               total:      749_992 },
    { name: 'Health and welfare',                               total:    8_657_773 },
    { name: 'Inspection and regulation',                        total:       53_422 },
    { name: 'Education',                                        total:    4_713_730 },
    { name: 'Protection and safety',                            total:    1_129_320 },
    { name: 'Transportation',                                   total:           76 },
    { name: 'Natural resources',                                total:       66_892 },
    { name: 'Intergovernmental revenue sharing',                total:    1_470_931 },
    { name: 'Debt service — Principal',                         total:       17_861 },
    { name: 'Debt service — Interest and other fiscal charges', total:       39_339 },
    { name: 'Capital outlay',                                   total:       85_736 },
  ]},
  2007: { total: 18_647_261, confidence: 'actual', categories: [
    { name: 'General government',                               total:      740_098 },
    { name: 'Health and welfare',                               total:    9_333_871 },
    { name: 'Inspection and regulation',                        total:       60_107 },
    { name: 'Education',                                        total:    5_296_593 },
    { name: 'Protection and safety',                            total:    1_258_908 },
    { name: 'Transportation',                                   total:        1_188 },
    { name: 'Natural resources',                                total:       28_610 },
    { name: 'Intergovernmental revenue sharing',                total:    1_645_335 },
    { name: 'Debt service — Principal',                         total:       46_773 },
    { name: 'Debt service — Interest and other fiscal charges', total:       47_966 },
    { name: 'Capital outlay',                                   total:      187_812 },
  ]},
  2008: { total: 20_452_911, confidence: 'actual', categories: [
    { name: 'General government',                               total:      834_957 },
    { name: 'Health and welfare',                               total:   10_560_068 },
    { name: 'Inspection and regulation',                        total:       60_742 },
    { name: 'Education',                                        total:    5_606_652 },
    { name: 'Protection and safety',                            total:    1_339_292 },
    { name: 'Transportation',                                   total:           76 },
    { name: 'Natural resources',                                total:      117_947 },
    { name: 'Intergovernmental revenue sharing',                total:    1_785_454 },
    { name: 'Debt service — Principal',                         total:       44_543 },
    { name: 'Debt service — Interest and other fiscal charges', total:       43_197 },
    { name: 'Capital outlay',                                   total:       59_983 },
  ]},
  2009: { total: 21_135_389, confidence: 'actual', categories: [
    { name: 'General government',                               total:      766_236 },
    { name: 'Health and welfare',                               total:   11_688_927 },
    { name: 'Inspection and regulation',                        total:       55_210 },
    { name: 'Education',                                        total:    5_365_372 },
    { name: 'Protection and safety',                            total:    1_350_340 },
    { name: 'Transportation',                                   total:           70 },
    { name: 'Natural resources',                                total:       87_506 },
    { name: 'Intergovernmental revenue sharing',                total:    1_663_817 },
    { name: 'Debt service — Principal',                         total:       55_057 },
    { name: 'Debt service — Interest and other fiscal charges', total:       52_189 },
    { name: 'Capital outlay',                                   total:       50_665 },
  ]},
  2010: { total: 21_896_326, confidence: 'actual', categories: [
    { name: 'General government',                               total:      790_719 },
    { name: 'Health and welfare',                               total:   12_789_086 },
    { name: 'Inspection and regulation',                        total:       45_194 },
    { name: 'Education',                                        total:    5_192_311 },
    { name: 'Protection and safety',                            total:    1_274_928 },
    { name: 'Transportation',                                   total:           58 },
    { name: 'Natural resources',                                total:       55_754 },
    { name: 'Intergovernmental revenue sharing',                total:    1_527_963 },
    { name: 'Debt service — Principal',                         total:       57_283 },
    { name: 'Debt service — Interest and other fiscal charges', total:       89_831 },
    { name: 'Capital outlay',                                   total:       73_199 },
  ]},
  2011: { total: 21_129_871, confidence: 'actual', categories: [
    { name: 'General government',                               total:      827_400 },
    { name: 'Health and welfare',                               total:   12_567_149 },
    { name: 'Inspection and regulation',                        total:       44_520 },
    { name: 'Education',                                        total:    4_879_624 },
    { name: 'Protection and safety',                            total:    1_068_160 },
    { name: 'Transportation',                                   total:           44 },
    { name: 'Natural resources',                                total:       86_095 },
    { name: 'Intergovernmental revenue sharing',                total:    1_437_422 },
    { name: 'Debt service — Principal',                         total:       70_182 },
    { name: 'Debt service — Interest and other fiscal charges', total:       72_259 },
    { name: 'Capital outlay',                                   total:       77_016 },
  ]},
  2012: { total: 20_099_321, confidence: 'actual', categories: [
    { name: 'General government',                               total:      730_123 },
    { name: 'Health and welfare',                               total:   11_774_277 },
    { name: 'Inspection and regulation',                        total:       43_987 },
    { name: 'Education',                                        total:    4_658_966 },
    { name: 'Protection and safety',                            total:    1_111_843 },
    { name: 'Transportation',                                   total:           51 },
    { name: 'Natural resources',                                total:       88_636 },
    { name: 'Intergovernmental revenue sharing',                total:    1_468_757 },
    { name: 'Debt service — Principal',                         total:       98_590 },
    { name: 'Debt service — Interest and other fiscal charges', total:       75_265 },
    { name: 'Capital outlay',                                   total:       48_826 },
  ]},
  2013: { total: 20_382_879, confidence: 'actual', categories: [
    { name: 'General government',                               total:      691_653 },
    { name: 'Health and welfare',                               total:   11_942_103 },
    { name: 'Inspection and regulation',                        total:       45_373 },
    { name: 'Education',                                        total:    4_687_071 },
    { name: 'Protection and safety',                            total:    1_114_068 },
    { name: 'Natural resources',                                total:       89_150 },
    { name: 'Intergovernmental revenue sharing',                total:    1_611_292 },
    { name: 'Debt service — Principal',                         total:      109_027 },
    { name: 'Debt service — Interest and other fiscal charges', total:       67_019 },
    { name: 'Capital outlay',                                   total:       26_123 },
  ]},
  2014: { total: 21_120_654, confidence: 'actual', categories: [
    { name: 'General government',                               total:      618_964 },
    { name: 'Health and welfare',                               total:   12_290_325 },
    { name: 'Inspection and regulation',                        total:       42_635 },
    { name: 'Education',                                        total:    4_828_811 },
    { name: 'Protection and safety',                            total:    1_108_806 },
    { name: 'Transportation',                                   total:            4 },
    { name: 'Natural resources',                                total:       80_237 },
    { name: 'Intergovernmental revenue sharing',                total:    1_712_501 },
    { name: 'Debt service — Principal',                         total:      131_033 },
    { name: 'Debt service — Interest and other fiscal charges', total:       62_749 },
    { name: 'Capital outlay',                                   total:      244_589 },
  ]},
  2015: { total: 22_927_537, confidence: 'actual', categories: [
    { name: 'General government',                               total:      692_764 },
    { name: 'Health and welfare',                               total:   13_828_725 },
    { name: 'Inspection and regulation',                        total:       42_164 },
    { name: 'Education',                                        total:    5_045_965 },
    { name: 'Protection and safety',                            total:    1_139_230 },
    { name: 'Transportation',                                   total:            1 },
    { name: 'Natural resources',                                total:       65_993 },
    { name: 'Intergovernmental revenue sharing',                total:    1_810_749 },
    { name: 'Debt service — Principal',                         total:      127_469 },
    { name: 'Debt service — Interest and other fiscal charges', total:       46_038 },
    { name: 'Capital outlay',                                   total:      128_439 },
  ]},
  2016: { total: 23_711_810, confidence: 'actual', categories: [
    { name: 'General government',                               total:      591_999 },
    { name: 'Health and welfare',                               total:   14_529_077 },
    { name: 'Inspection and regulation',                        total:       43_802 },
    { name: 'Education',                                        total:    5_176_055 },
    { name: 'Protection and safety',                            total:    1_165_609 },
    { name: 'Natural resources',                                total:       62_545 },
    { name: 'Intergovernmental revenue sharing',                total:    1_855_234 },
    { name: 'Debt service — Principal',                         total:      145_717 },
    { name: 'Debt service — Interest and other fiscal charges', total:       32_801 },
    { name: 'Capital outlay',                                   total:      108_971 },
  ]},
  2017: { total: 24_745_455, confidence: 'actual', categories: [
    { name: 'General government',                               total:      661_456 },
    { name: 'Health and welfare',                               total:   15_096_388 },
    { name: 'Inspection and regulation',                        total:       40_468 },
    { name: 'Education',                                        total:    5_328_993 },
    { name: 'Protection and safety',                            total:    1_175_700 },
    { name: 'Transportation',                                   total:       28_773 },
    { name: 'Natural resources',                                total:       56_927 },
    { name: 'Intergovernmental revenue sharing',                total:    2_037_292 },
    { name: 'Debt service — Principal',                         total:      154_154 },
    { name: 'Debt service — Interest and other fiscal charges', total:       40_339 },
    { name: 'Capital outlay',                                   total:      124_965 },
  ]},
  2018: { total: 25_365_153, confidence: 'actual', categories: [
    { name: 'General government',                               total:      684_058 },
    { name: 'Health and welfare',                               total:   15_468_314 },
    { name: 'Inspection and regulation',                        total:       39_469 },
    { name: 'Education',                                        total:    5_463_140 },
    { name: 'Protection and safety',                            total:    1_206_281 },
    { name: 'Natural resources',                                total:       67_994 },
    { name: 'Intergovernmental revenue sharing',                total:    2_145_441 },
    { name: 'Debt service — Principal',                         total:      150_999 },
    { name: 'Debt service — Interest and other fiscal charges', total:       28_577 },
    { name: 'Capital outlay',                                   total:      110_880 },
  ]},
  2019: { total: 26_556_680, confidence: 'actual', categories: [
    { name: 'General government',                               total:      719_401 },
    { name: 'Health and welfare',                               total:   16_043_519 },
    { name: 'Inspection and regulation',                        total:       37_800 },
    { name: 'Education',                                        total:    6_001_225 },
    { name: 'Protection and safety',                            total:    1_273_697 },
    { name: 'Natural resources',                                total:       66_721 },
    { name: 'Intergovernmental revenue sharing',                total:    2_232_531 },
    { name: 'Debt service — Principal',                         total:      119_962 },
    { name: 'Debt service — Interest and other fiscal charges', total:       24_227 },
    { name: 'Capital outlay',                                   total:       37_597 },
  ]},
  2020: { total: 29_417_338, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_050_814 },
    { name: 'Health and welfare',                               total:   17_420_661 },
    { name: 'Inspection and regulation',                        total:       41_261 },
    { name: 'Education',                                        total:    6_595_718 },
    { name: 'Protection and safety',                            total:    1_427_214 },
    { name: 'Natural resources',                                total:       86_355 },
    { name: 'Intergovernmental revenue sharing',                total:    2_380_749 },
    { name: 'Debt service — Principal',                         total:      312_952 },
    { name: 'Debt service — Interest and other fiscal charges', total:       19_368 },
    { name: 'Capital outlay',                                   total:       82_246 },
  ]},
  2021: { total: 35_945_797, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_607_207 },
    { name: 'Health and welfare',                               total:   22_018_184 },
    { name: 'Inspection and regulation',                        total:       36_701 },
    { name: 'Education',                                        total:    6_843_738 },
    { name: 'Protection and safety',                            total:    1_391_670 },
    { name: 'Natural resources',                                total:       86_680 },
    { name: 'Intergovernmental revenue sharing',                total:    2_742_407 },
    { name: 'Debt service — Principal',                         total:       61_811 },
    { name: 'Debt service — Interest and other fiscal charges', total:       15_291 },
    { name: 'Capital outlay',                                   total:      142_108 },
  ]},
  2022: { total: 41_115_213, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_168_594 },
    { name: 'Health and welfare',                               total:   25_517_667 },
    { name: 'Inspection and regulation',                        total:       76_145 },
    { name: 'Education',                                        total:    8_225_252 },
    { name: 'Protection and safety',                            total:    1_520_213 },
    { name: 'Natural resources',                                total:      104_589 },
    { name: 'Intergovernmental revenue sharing',                total:    3_138_688 },
    { name: 'Debt service — Principal',                         total:      221_786 },
    { name: 'Debt service — Interest and other fiscal charges', total:       14_403 },
    { name: 'Capital outlay',                                   total:      127_876 },
  ]},
  2023: { total: 45_055_595, confidence: 'actual', categories: [
    { name: 'General government',                               total:    1_860_857 },
    { name: 'Health and welfare',                               total:   27_664_372 },
    { name: 'Inspection and regulation',                        total:      107_505 },
    { name: 'Education',                                        total:    9_485_638 },
    { name: 'Protection and safety',                            total:    1_820_696 },
    { name: 'Natural resources',                                total:      165_180 },
    { name: 'Intergovernmental revenue sharing',                total:    3_577_470 },
    { name: 'Debt service — Principal',                         total:       71_279 },
    { name: 'Debt service — Interest and other fiscal charges', total:       12_575 },
    { name: 'Capital outlay',                                   total:      290_023 },
  ]},
  2024: { total: 45_047_271, confidence: 'actual', categories: [
    { name: 'General government',                               total:    2_045_501 },
    { name: 'Health and welfare',                               total:   26_210_052 },
    { name: 'Inspection and regulation',                        total:      118_344 },
    { name: 'Education',                                        total:   10_220_471 },
    { name: 'Protection and safety',                            total:    1_836_568 },
    { name: 'Natural resources',                                total:      165_982 },
    { name: 'Intergovernmental revenue sharing',                total:    4_108_139 },
    { name: 'Debt service — Principal',                         total:       69_710 },
    { name: 'Debt service — Interest and other fiscal charges', total:       12_907 },
    { name: 'Capital outlay',                                   total:      259_597 },
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
  return { jsonTree: [{ n: 'Arizona General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Arizona General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'az-acfr-gf-operating', base_url: 'https://gao.az.gov/financials/acfr', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
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
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} operating row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} operating budget row to stamp source`); process.exit(2); }
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
