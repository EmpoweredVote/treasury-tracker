#!/usr/bin/env node
/**
 * New York General Fund Operating (Expenditure) Loader — FY2003-FY2024 ACTUAL
 * Source: State of New York Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL column
 *   (GAAP basis, Amounts in MILLIONS). Published by the Office of the State Comptroller (OSC).
 *   Per-FY source URL below (osc.ny.gov finance/reports ACFR — NOT the NYSLRS pension ACFR).
 *
 * Phase 100 (ACFR-03). Replaces the NASBO operating rows on the NY state node in place
 *   (same (muni,fy,'operating') RPC key). NY state node id (D-01):
 *   1a7f871c-7f2e-4786-9c55-5ab3409716f4.
 *   NOTE: filename is processNYAcfr.js (NOT processNY.js) — the legacy v1.7 openbudget.ny.gov
 *   operating loader still lives at scripts/processNY.js (dead/superseded); this ACFR loader
 *   is the Phase-100 replacement and does not clobber it.
 *
 * UNITS = MILLIONS (D-03): the ACFR prints figures in millions → multiply by UNITS
 *   (1,000,000) to store dollars. This is the extra ×1000 vs the thousands-based CA/FL/TX
 *   template. Raw printed millions are kept in EXPENDITURES below for faithful audit;
 *   buildTree/validate apply UNITS.
 *
 * Control = printed General-column "Total expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total (in millions) or the loader
 *   refuses to write (process.exit(2)). Bookend (recon-confirmed): FY2024 Total revenues
 *   93,894 (millions) = $93,894,000,000.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/ny/ (NOT -layout).
 *   The GENERAL column is the 1st numeric column. All 10 years tie to 0 diff vs. the
 *   printed General-column Total expenditures. NY has NO negative GF expenditure categories.
 *
 * Phase 104 deepening (DEEP-01/RECON-05/ACFR-08): added FY2003-FY2014 (12 years) to the
 *   window. All 12 added years tie to 0 diff vs. printed General-column Total expenditures.
 *   FY2003-FY2012 use the older ACFR category names (Local assistance grants: Social services /
 *   Education / Mental hygiene / General purpose / Health and environment / Transportation /
 *   Criminal justice / Miscellaneous; Departmental operations: Personal service / Non-personal
 *   service / Pension contribution / Other fringe benefits). FY2013-FY2014 use the newer format
 *   matching FY2015+ (Local assistance — Education / Public health / etc.). All verbatim ACFR.
 *
 * Usage:
 *   node scripts/processNYAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New York'; const STATE_ABBR = 'NY'; const POPULATION = 20_201_249;
const STATE_NODE_ID = '1a7f871c-7f2e-4786-9c55-5ab3409716f4'; // D-01: upgrade this node in place
const UNITS = 1_000_000; // NY ACFR is in MILLIONS → ×1,000,000 to store dollars (D-03)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published State of New York ACFR (source_date = Mar 31 FYE).
// URL naming flips at FY2022: ≤2021 comprehensive-annual-…; ≥2022 annual-comprehensive-… (D-02).
const NY_BASE = 'https://www.osc.ny.gov/files/reports/finance/pdf';
function nyUrl(fy) {
  return fy >= 2022
    ? `${NY_BASE}/annual-comprehensive-financial-report-${fy}.pdf`
    : `${NY_BASE}/comprehensive-annual-financial-report-${fy}.pdf`;
}
const SOURCES = Object.fromEntries(
  [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024].map(fy => [fy, { url: nyUrl(fy), date: `${fy}-03-31` }])
);
const dataSource = (fy) => `New York State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — NY ACFR, GENERAL column (raw MILLIONS; ×UNITS → dollars).
// Verbatim ACFR function names, grouped (Local assistance / State operations) into a flat
// leaf list. total = printed General-column "Total expenditures" (millions). 0-diff verified.
// FY2003-FY2012 use older ACFR category names (Social services / Mental hygiene / etc.).
// FY2013+ use newer names matching FY2015+ (Education / Public health / etc.).
const EXPENDITURES = {
  2003: { total: 40_910, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total:  9_297 },
    { name: 'Local assistance — Education',                   total: 14_632 },
    { name: 'Local assistance — Mental hygiene',              total:  1_077 },
    { name: 'Local assistance — General purpose',             total:    847 },
    { name: 'Local assistance — Health and environment',      total:  1_515 },
    { name: 'Local assistance — Transportation',              total:    481 },
    { name: 'Local assistance — Criminal justice',            total:    214 },
    { name: 'Local assistance — Miscellaneous',               total:    447 },
    { name: 'Departmental operations — Personal service',     total:  7_234 },
    { name: 'Departmental operations — Non-personal service', total:  2_583 },
    { name: 'Departmental operations — Pension contribution', total:    139 },
    { name: 'Departmental operations — Other fringe benefits',total:  2_444 },
  ]},
  2004: { total: 43_386, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 10_495 },
    { name: 'Local assistance — Education',                   total: 15_426 },
    { name: 'Local assistance — Mental hygiene',              total:  1_105 },
    { name: 'Local assistance — General purpose',             total:    869 },
    { name: 'Local assistance — Health and environment',      total:  1_690 },
    { name: 'Local assistance — Transportation',              total:    480 },
    { name: 'Local assistance — Criminal justice',            total:    201 },
    { name: 'Local assistance — Miscellaneous',               total:    423 },
    { name: 'Departmental operations — Personal service',     total:  7_009 },
    { name: 'Departmental operations — Non-personal service', total:  2_620 },
    { name: 'Departmental operations — Pension contribution', total:    437 },
    { name: 'Departmental operations — Other fringe benefits',total:  2_631 },
  ]},
  2005: { total: 45_104, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 10_777 },
    { name: 'Local assistance — Education',                   total: 15_810 },
    { name: 'Local assistance — Mental hygiene',              total:  1_035 },
    { name: 'Local assistance — General purpose',             total:  1_016 },
    { name: 'Local assistance — Health and environment',      total:  1_810 },
    { name: 'Local assistance — Transportation',              total:    416 },
    { name: 'Local assistance — Criminal justice',            total:    187 },
    { name: 'Local assistance — Miscellaneous',               total:    373 },
    { name: 'Departmental operations — Personal service',     total:  7_261 },
    { name: 'Departmental operations — Non-personal service', total:  2_829 },
    { name: 'Departmental operations — Pension contribution', total:    637 },
    { name: 'Departmental operations — Other fringe benefits',total:  2_953 },
  ]},
  2006: { total: 48_321, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 12_490 },
    { name: 'Local assistance — Education',                   total: 16_745 },
    { name: 'Local assistance — Mental hygiene',              total:  1_130 },
    { name: 'Local assistance — General purpose',             total:  1_047 },
    { name: 'Local assistance — Health and environment',      total:  1_181 },
    { name: 'Local assistance — Transportation',              total:    474 },
    { name: 'Local assistance — Criminal justice',            total:    198 },
    { name: 'Local assistance — Miscellaneous',               total:    413 },
    { name: 'Departmental operations — Personal service',     total:  7_599 },
    { name: 'Departmental operations — Non-personal service', total:  3_082 },
    { name: 'Departmental operations — Pension contribution', total:    885 },
    { name: 'Departmental operations — Other fringe benefits',total:  3_077 },
  ]},
  2007: { total: 51_936, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 13_318 },
    { name: 'Local assistance — Education',                   total: 17_885 },
    { name: 'Local assistance — Mental hygiene',              total:  1_213 },
    { name: 'Local assistance — General purpose',             total:  1_192 },
    { name: 'Local assistance — Health and environment',      total:  1_648 },
    { name: 'Local assistance — Transportation',              total:    408 },
    { name: 'Local assistance — Criminal justice',            total:    244 },
    { name: 'Local assistance — Miscellaneous',               total:    587 },
    { name: 'Departmental operations — Personal service',     total:  7_966 },
    { name: 'Departmental operations — Non-personal service', total:  3_337 },
    { name: 'Departmental operations — Pension contribution', total:  1_008 },
    { name: 'Departmental operations — Other fringe benefits',total:  3_130 },
  ]},
  2008: { total: 54_540, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 13_445 },
    { name: 'Local assistance — Education',                   total: 19_511 },
    { name: 'Local assistance — Mental hygiene',              total:  1_532 },
    { name: 'Local assistance — General purpose',             total:    928 },
    { name: 'Local assistance — Health and environment',      total:  1_426 },
    { name: 'Local assistance — Transportation',              total:    446 },
    { name: 'Local assistance — Criminal justice',            total:    242 },
    { name: 'Local assistance — Miscellaneous',               total:    712 },
    { name: 'Departmental operations — Personal service',     total:  8_407 },
    { name: 'Departmental operations — Non-personal service', total:  3_522 },
    { name: 'Departmental operations — Pension contribution', total:  1_052 },
    { name: 'Departmental operations — Other fringe benefits',total:  3_317 },
  ]},
  2009: { total: 56_630, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 12_601 },
    { name: 'Local assistance — Education',                   total: 21_157 },
    { name: 'Local assistance — Mental hygiene',              total:  1_686 },
    { name: 'Local assistance — General purpose',             total:  1_220 },
    { name: 'Local assistance — Health and environment',      total:  1_789 },
    { name: 'Local assistance — Transportation',              total:    571 },
    { name: 'Local assistance — Criminal justice',            total:    253 },
    { name: 'Local assistance — Miscellaneous',               total:    537 },
    { name: 'Departmental operations — Personal service',     total:  8_948 },
    { name: 'Departmental operations — Non-personal service', total:  3_318 },
    { name: 'Departmental operations — Pension contributions',total:    907 },
    { name: 'Departmental operations — Other fringe benefits',total:  3_643 },
  ]},
  2010: { total: 54_129, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 11_443 },
    { name: 'Local assistance — Education',                   total: 20_542 },
    { name: 'Local assistance — Mental hygiene',              total:  1_644 },
    { name: 'Local assistance — General purpose',             total:  1_251 },
    { name: 'Local assistance — Health and environment',      total:  1_677 },
    { name: 'Local assistance — Transportation',              total:    461 },
    { name: 'Local assistance — Criminal justice',            total:    211 },
    { name: 'Local assistance — Miscellaneous',               total:    493 },
    { name: 'Departmental operations — Personal service',     total:  8_771 },
    { name: 'Departmental operations — Non-personal service', total:  3_111 },
    { name: 'Departmental operations — Pension contributions',total:    810 },
    { name: 'Departmental operations — Other fringe benefits',total:  3_715 },
  ]},
  2011: { total: 55_090, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 12_425 },
    { name: 'Local assistance — Education',                   total: 19_862 },
    { name: 'Local assistance — Mental hygiene',              total:  1_660 },
    { name: 'Local assistance — General purpose',             total:  1_037 },
    { name: 'Local assistance — Health and environment',      total:  1_838 },
    { name: 'Local assistance — Transportation',              total:    476 },
    { name: 'Local assistance — Criminal justice',            total:    177 },
    { name: 'Local assistance — Miscellaneous',               total:    402 },
    { name: 'Departmental operations — Personal service',     total:  8_863 },
    { name: 'Departmental operations — Non-personal service', total:  3_072 },
    { name: 'Departmental operations — Pension contributions',total:  1_152 },
    { name: 'Departmental operations — Other fringe benefits',total:  4_126 },
  ]},
  2012: { total: 57_911, confidence: 'actual', categories: [
    { name: 'Local assistance — Social services',              total: 14_351 },
    { name: 'Local assistance — Education',                   total: 20_184 },
    { name: 'Local assistance — Mental hygiene',              total:  1_841 },
    { name: 'Local assistance — General purpose',             total:  1_042 },
    { name: 'Local assistance — Health and environment',      total:  1_813 },
    { name: 'Local assistance — Transportation',              total:    503 },
    { name: 'Local assistance — Criminal justice',            total:    184 },
    { name: 'Local assistance — Miscellaneous',               total:    440 },
    { name: 'Departmental operations — Personal service',     total:  8_503 },
    { name: 'Departmental operations — Non-personal service', total:  3_307 },
    { name: 'Departmental operations — Pension contributions',total:  1_460 },
    { name: 'Departmental operations — Other fringe benefits',total:  4_283 },
  ]},
  2013: { total: 59_796, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                   total: 20_890 },
    { name: 'Local assistance — Public health',               total: 16_717 },
    { name: 'Local assistance — Public welfare',              total:  3_017 },
    { name: 'Local assistance — Public safety',               total:    314 },
    { name: 'Local assistance — Transportation',              total:    557 },
    { name: 'Local assistance — Environment and recreation',  total:      7 },
    { name: 'Local assistance — Support and regulate business', total:  360 },
    { name: 'Local assistance — General government',          total:    962 },
    { name: 'State operations — Personal service',            total:  8_792 },
    { name: 'State operations — Non-personal service',        total:  3_177 },
    { name: 'State operations — Pension contributions',       total:  1_365 },
    { name: 'State operations — Other fringe benefits',       total:  3_638 },
  ]},
  2014: { total: 59_782, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                   total: 20_717 },
    { name: 'Local assistance — Public health',               total: 16_071 },
    { name: 'Local assistance — Public welfare',              total:  3_041 },
    { name: 'Local assistance — Public safety',               total:    287 },
    { name: 'Local assistance — Transportation',              total:    575 },
    { name: 'Local assistance — Environment and recreation',  total:     10 },
    { name: 'Local assistance — Support and regulate business', total:  376 },
    { name: 'Local assistance — General government',          total:  1_163 },
    { name: 'State operations — Personal service',            total:  8_744 },
    { name: 'State operations — Non-personal service',        total:  3_310 },
    { name: 'State operations — Pension contributions',       total:  1_749 },
    { name: 'State operations — Other fringe benefits',       total:  3_739 },
  ]},
  2015: { total: 60_612, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 22_405 },
    { name: 'Local assistance — Public health',              total: 15_812 },
    { name: 'Local assistance — Public welfare',             total:  2_782 },
    { name: 'Local assistance — Public safety',              total:    207 },
    { name: 'Local assistance — Transportation',             total:     97 },
    { name: 'Local assistance — Environment and recreation', total:     10 },
    { name: 'Local assistance — Support and regulate business', total:  362 },
    { name: 'Local assistance — General government',         total:  1_076 },
    { name: 'State operations — Personal service',           total:  8_959 },
    { name: 'State operations — Non-personal service',       total:  3_286 },
    { name: 'State operations — Pension contributions',      total:  1_859 },
    { name: 'State operations — Other fringe benefits',      total:  3_757 },
  ]},
  2016: { total: 62_756, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 24_053 },
    { name: 'Local assistance — Public health',              total: 16_062 },
    { name: 'Local assistance — Public welfare',             total:  2_950 },
    { name: 'Local assistance — Public safety',              total:    200 },
    { name: 'Local assistance — Transportation',             total:    109 },
    { name: 'Local assistance — Environment and recreation', total:     12 },
    { name: 'Local assistance — Support and regulate business', total:  212 },
    { name: 'Local assistance — General government',         total:  1_092 },
    { name: 'State operations — Personal service',           total:  9_116 },
    { name: 'State operations — Non-personal service',       total:  3_163 },
    { name: 'State operations — Pension contributions',      total:  1_924 },
    { name: 'State operations — Other fringe benefits',      total:  3_863 },
  ]},
  2017: { total: 64_454, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 24_746 },
    { name: 'Local assistance — Public health',              total: 16_399 },
    { name: 'Local assistance — Public welfare',             total:  3_013 },
    { name: 'Local assistance — Public safety',              total:    258 },
    { name: 'Local assistance — Transportation',             total:    106 },
    { name: 'Local assistance — Environment and recreation', total:      9 },
    { name: 'Local assistance — Support and regulate business', total:  266 },
    { name: 'Local assistance — General government',         total:  1_076 },
    { name: 'State operations — Personal service',           total:  9_083 },
    { name: 'State operations — Non-personal service',       total:  3_141 },
    { name: 'State operations — Pension contributions',      total:  2_137 },
    { name: 'State operations — Other fringe benefits',      total:  4_220 },
  ]},
  2018: { total: 66_475, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 25_686 },
    { name: 'Local assistance — Public health',              total: 17_869 },
    { name: 'Local assistance — Public welfare',             total:  2_814 },
    { name: 'Local assistance — Public safety',              total:    222 },
    { name: 'Local assistance — Transportation',             total:    116 },
    { name: 'Local assistance — Environment and recreation', total:      8 },
    { name: 'Local assistance — Support and regulate business', total:  257 },
    { name: 'Local assistance — General government',         total:  1_024 },
    { name: 'State operations — Personal service',           total:  9_305 },
    { name: 'State operations — Non-personal service',       total:  2_921 },
    { name: 'State operations — Pension contributions',      total:  2_111 },
    { name: 'State operations — Other fringe benefits',      total:  4_142 },
  ]},
  2019: { total: 69_553, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 26_986 },
    { name: 'Local assistance — Public health',              total: 20_073 },
    { name: 'Local assistance — Public welfare',             total:  2_510 },
    { name: 'Local assistance — Public safety',              total:    416 },
    { name: 'Local assistance — Transportation',             total:    304 },
    { name: 'Local assistance — Environment and recreation', total:      8 },
    { name: 'Local assistance — Support and regulate business', total:  242 },
    { name: 'Local assistance — General government',         total:  1_038 },
    { name: 'State operations — Personal service',           total:  9_680 },
    { name: 'State operations — Non-personal service',       total:  2_863 },
    { name: 'State operations — Pension contributions',      total:  2_215 },
    { name: 'State operations — Other fringe benefits',      total:  3_218 },
  ]},
  2020: { total: 70_322, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 27_455 },
    { name: 'Local assistance — Public health',              total: 20_423 },
    { name: 'Local assistance — Public welfare',             total:  2_445 },
    { name: 'Local assistance — Public safety',              total:    118 },
    { name: 'Local assistance — Transportation',             total:    110 },
    { name: 'Local assistance — Environment and recreation', total:      8 },
    { name: 'Local assistance — Support and regulate business', total:  246 },
    { name: 'Local assistance — General government',         total:  1_173 },
    { name: 'State operations — Personal service',           total:  9_805 },
    { name: 'State operations — Non-personal service',       total:  2_974 },
    { name: 'State operations — Pension contributions',      total:  2_187 },
    { name: 'State operations — Other fringe benefits',      total:  3_378 },
  ]},
  2021: { total: 83_878, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 26_276 },
    { name: 'Local assistance — Public health',              total: 23_157 },
    { name: 'Local assistance — Public welfare',             total:  2_764 },
    { name: 'Local assistance — Public safety',              total:    215 },
    { name: 'Local assistance — Transportation',             total:    110 },
    { name: 'Local assistance — Environment and recreation', total:     18 },
    { name: 'Local assistance — Support and regulate business', total:  144 },
    { name: 'Local assistance — General government',         total:  1_616 },
    { name: 'State operations — Personal service',           total:  7_594 },
    { name: 'State operations — Non-personal service',       total: 16_252 },
    { name: 'State operations — Pension contributions',      total:  2_603 },
    { name: 'State operations — Other fringe benefits',      total:  3_129 },
  ]},
  2022: { total: 101_018, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 28_344 },
    { name: 'Local assistance — Public health',              total: 26_479 },
    { name: 'Local assistance — Public welfare',             total:  5_274 },
    { name: 'Local assistance — Public safety',              total:    287 },
    { name: 'Local assistance — Transportation',             total:    120 },
    { name: 'Local assistance — Environment and recreation', total:      5 },
    { name: 'Local assistance — Support and regulate business', total:  852 },
    { name: 'Local assistance — General government',         total:  3_191 },
    { name: 'State operations — Personal service',           total:  9_345 },
    { name: 'State operations — Non-personal service',       total: 20_539 },
    { name: 'State operations — Pension contributions',      total:  2_024 },
    { name: 'State operations — Other fringe benefits',      total:  4_558 },
  ]},
  2023: { total: 109_474, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 28_831 },
    { name: 'Local assistance — Public health',              total: 31_257 },
    { name: 'Local assistance — Public welfare',             total:  5_118 },
    { name: 'Local assistance — Public safety',              total:    350 },
    { name: 'Local assistance — Transportation',             total:    151 },
    { name: 'Local assistance — Environment and recreation', total:      6 },
    { name: 'Local assistance — Support and regulate business', total:  883 },
    { name: 'Local assistance — General government',         total:  1_659 },
    { name: 'State operations — Personal service',           total: 10_489 },
    { name: 'State operations — Non-personal service',       total: 23_971 },
    { name: 'State operations — Pension contributions',      total:  1_723 },
    { name: 'State operations — Other fringe benefits',      total:  5_036 },
  ]},
  2024: { total: 115_828, confidence: 'actual', categories: [
    { name: 'Local assistance — Education',                  total: 32_790 },
    { name: 'Local assistance — Public health',              total: 36_092 },
    { name: 'Local assistance — Public welfare',             total:  4_490 },
    { name: 'Local assistance — Public safety',              total:    413 },
    { name: 'Local assistance — Transportation',             total:    534 },
    { name: 'Local assistance — Environment and recreation', total:      9 },
    { name: 'Local assistance — Support and regulate business', total:  498 },
    { name: 'Local assistance — General government',         total:  1_332 },
    { name: 'State operations — Personal service',           total: 10_997 },
    { name: 'State operations — Non-personal service',       total: 22_454 },
    { name: 'State operations — Pension contributions',      total:  1_509 },
    { name: 'State operations — Other fringe benefits',      total:  4_710 },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  // tolerance 10 (millions) ≈ $10M, mirroring the CA loader's $10M dollar tolerance.
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [millions]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total * UNITS, i: [] }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'New York General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, MILLIONS×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId = STATE_NODE_ID;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('id', STATE_NODE_ID).single();
    if (error || !muni) { console.error(`${STATE_NAME} state node ${STATE_NODE_ID} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'New York General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ny-acfr-gf-operating', base_url: 'https://www.osc.ny.gov/reports/finance', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
