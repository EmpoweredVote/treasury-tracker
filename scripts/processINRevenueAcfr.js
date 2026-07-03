#!/usr/bin/env node
/**
 * Indiana General Fund Revenue (by source) Loader — FY2002-FY2025 ACTUAL
 * Source: State of Indiana Annual Comprehensive Financial Report (ACFR/CAFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Indiana State Comptroller (in.gov/comptroller).
 *
 * Phase 113 (ACFR-21 + ACFR-31 + ACFR-32). Revenue is NEW on the IN state node (NASBO had no
 *   revenue-by-source) → pure insert keyed (muni,fy,'revenue').
 *   IN state node resolved by name='Indiana', state='IN', entity_type='state'
 *   and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE PARITY NOTE (ACFR-31): IN ACFR GF ~0.99× NASBO GF — near parity, the smallest
 *   divergence in the v2.14 tranche. Indiana reports Medicaid through a SEPARATE major fund
 *   ("Public Welfare-Medicaid Assistance Fund", $15,111,031K FY2024) instead of folding it
 *   into the General Fund column, so the GAAP GF stays close to NASBO's budgetary concept.
 *   No material accept-relabel jump; recorded at load per policy.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): FY2022 "Investment income (loss)" = −30,464 (thousands) in
 *   the GF column — the only negative year in the window. P2 clamp renders it at 0 with the
 *   signed magnitude in the label; the root total carries the signed net (printed Total
 *   already nets it). clampForRender applies to all FYs as a safety net.
 *
 * UNITS = thousands: ×1,000 to store dollars (IL/FL convention).
 *
 * Filename eras vary by year (7 patterns FY2002–FY2025) — SOURCES enumerates the exact
 *   per-year filename on www.in.gov/comptroller/files/ (all confirmed downloadable, no CDN
 *   friction). FY2001 exists but is pre-GASB-34-boundary — intentionally NOT loaded (D-12).
 *
 * Control = printed GENERAL FUND column "Total revenues". Every FY2002–FY2025 ties $0 diff
 *   (extraction: pdftotext -table on local copies in _acfr-work/in/, NOT -layout).
 *   Bookends (GF Total revenues, thousands): FY2024 = 22,101,900 ; FY2002 = 7,341,746.
 *
 * Usage:
 *   node scripts/processINRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Indiana'; const STATE_ABBR = 'IN'; const POPULATION = 6_785_528;
const EXPECTED_MUNI_ID = '7eb77ada-b504-4531-98cc-8262cfb22ff5';
const UNITS = 1_000; // IN ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs — filename era shifts 7 times across the window.
const IN_BASE = 'https://www.in.gov/comptroller/files';
const SOURCES = {
  2002: { url: `${IN_BASE}/State_of_Indiana_2002_CAFR.pdf`, date: '2002-06-30' },
  2003: { url: `${IN_BASE}/State_of_Indiana_2003_CAFR.pdf`, date: '2003-06-30' },
  2004: { url: `${IN_BASE}/State_of_Indiana_2004_CAFR.pdf`, date: '2004-06-30' },
  2005: { url: `${IN_BASE}/State_of_Indiana_2005_CAFR.pdf`, date: '2005-06-30' },
  2006: { url: `${IN_BASE}/State_of_Indiana_2006_CAFR.pdf`, date: '2006-06-30' },
  2007: { url: `${IN_BASE}/State_of_Indiana_2007_CAFR.pdf`, date: '2007-06-30' },
  2008: { url: `${IN_BASE}/Entire_2008_CAFR.pdf`, date: '2008-06-30' },
  2009: { url: `${IN_BASE}/Entire_2009_CAFR.pdf`, date: '2009-06-30' },
  2010: { url: `${IN_BASE}/Entire_2010_CAFR.pdf`, date: '2010-06-30' },
  2011: { url: `${IN_BASE}/Entire_2011_CAFR.pdf`, date: '2011-06-30' },
  2012: { url: `${IN_BASE}/Entire_2012_CAFR.pdf`, date: '2012-06-30' },
  2013: { url: `${IN_BASE}/Entire_2013_CAFR.pdf`, date: '2013-06-30' },
  2014: { url: `${IN_BASE}/Entire_2014_CAFR.pdf`, date: '2014-06-30' },
  2015: { url: `${IN_BASE}/Entire_2015_CAFR.pdf`, date: '2015-06-30' },
  2016: { url: `${IN_BASE}/Entire-2016-CAFR.pdf`, date: '2016-06-30' },
  2017: { url: `${IN_BASE}/Entire-2017-CAFR.pdf`, date: '2017-06-30' },
  2018: { url: `${IN_BASE}/Entire-2018-CAFR.pdf`, date: '2018-06-30' },
  2019: { url: `${IN_BASE}/Entire-CAFR-2019.pdf`, date: '2019-06-30' },
  2020: { url: `${IN_BASE}/Entire-CAFR-2020.pdf`, date: '2020-06-30' },
  2021: { url: `${IN_BASE}/Entire-2021-ACFR.pdf`, date: '2021-06-30' },
  2022: { url: `${IN_BASE}/2022-ACFR.pdf`, date: '2022-06-30' },
  2023: { url: `${IN_BASE}/Entire-Annual-Comprehensive-Financial-Report-2023.pdf`, date: '2023-06-30' },
  2024: { url: `${IN_BASE}/2024-ACFR.pdf`, date: '2024-06-30' },
  2025: { url: `${IN_BASE}/Fiscal-2025-Annual-Comprehensive-Financial-Report.pdf`, date: '2025-06-30' },
};
const dataSource = (fy) => `Indiana State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — IN ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim statement line items (tax lines suffixed " taxes"; debt-service lines prefixed) —
// extracted via pdftotext -table + tie-verified $0 diff vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 7_341_746, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    4_230_931 },
    { name: 'Sales taxes',               total:    2_158_827 },
    { name: 'Gaming taxes',              total:      136_055 },
    { name: 'Inheritance taxes',         total:      153_593 },
    { name: 'Alcohol and tobacco taxes', total:       72_999 },
    { name: 'Insurance taxes',           total:      180_610 },
    { name: 'Current service charges',   total:      237_469 },
    { name: 'Investment income',         total:      122_060 },
    { name: 'Grants',                    total:       11_130 },
    { name: 'Other',                     total:       38_072 },
  ]},
  2003: { total: 7_639_867, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    4_148_793 },
    { name: 'Sales taxes',               total:    2_161_831 },
    { name: 'Gaming taxes',              total:       84_308 },
    { name: 'Inheritance taxes',         total:      175_873 },
    { name: 'Alcohol and tobacco taxes', total:      315_966 },
    { name: 'Insurance taxes',           total:      178_479 },
    { name: 'Other taxes',               total:       82_110 },
    { name: 'Current service charges',   total:      205_317 },
    { name: 'Investment income',         total:       57_274 },
    { name: 'Sales/rents',               total:        2_645 },
    { name: 'Grants',                    total:      117_575 },
    { name: 'Other',                     total:      109_696 },
  ]},
  2004: { total: 7_933_336, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    4_363_143 },
    { name: 'Sales taxes',               total:    2_258_415 },
    { name: 'Gaming taxes',              total:       85_907 },
    { name: 'Inheritance taxes',         total:      136_382 },
    { name: 'Alcohol and tobacco taxes', total:      299_506 },
    { name: 'Insurance taxes',           total:      177_751 },
    { name: 'Other taxes',               total:      154_414 },
    { name: 'Current service charges',   total:      190_189 },
    { name: 'Investment income',         total:       40_444 },
    { name: 'Sales/rents',               total:        1_252 },
    { name: 'Grants',                    total:      120_218 },
    { name: 'Other',                     total:      105_715 },
  ]},
  2005: { total: 8_503_309, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    4_942_205 },
    { name: 'Sales taxes',               total:    2_386_526 },
    { name: 'Gaming taxes',              total:       84_519 },
    { name: 'Inheritance taxes',         total:      166_825 },
    { name: 'Alcohol and tobacco taxes', total:      300_777 },
    { name: 'Insurance taxes',           total:      187_671 },
    { name: 'Other taxes',               total:      155_386 },
    { name: 'Current service charges',   total:      170_956 },
    { name: 'Investment income',         total:       63_344 },
    { name: 'Sales/rents',               total:        1_250 },
    { name: 'Grants',                    total:        9_124 },
    { name: 'Other',                     total:       34_726 },
  ]},
  2006: { total: 9_200_164, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_292_697 },
    { name: 'Sales taxes',               total:    2_554_675 },
    { name: 'Gaming taxes',              total:       85_548 },
    { name: 'Inheritance taxes',         total:      139_341 },
    { name: 'Alcohol and tobacco taxes', total:      313_140 },
    { name: 'Insurance taxes',           total:      176_891 },
    { name: 'Other taxes',               total:      180_121 },
    { name: 'Current service charges',   total:      236_560 },
    { name: 'Investment income',         total:      153_721 },
    { name: 'Sales/rents',               total:        1_143 },
    { name: 'Grants',                    total:       11_622 },
    { name: 'Other',                     total:       54_705 },
  ]},
  2007: { total: 9_653_635, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_481_976 },
    { name: 'Sales taxes',               total:    2_650_348 },
    { name: 'Gaming taxes',              total:       87_958 },
    { name: 'Inheritance taxes',         total:      154_814 },
    { name: 'Alcohol and tobacco taxes', total:      334_785 },
    { name: 'Insurance taxes',           total:      190_925 },
    { name: 'Other taxes',               total:      206_429 },
    { name: 'Current service charges',   total:      200_181 },
    { name: 'Investment income',         total:      261_267 },
    { name: 'Sales/rents',               total:        1_512 },
    { name: 'Grants',                    total:       15_430 },
    { name: 'Other',                     total:       68_010 },
  ]},
  2008: { total: 10_912_869, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_728_520 },
    { name: 'Sales taxes',               total:    3_653_894 },
    { name: 'Gaming taxes',              total:       83_766 },
    { name: 'Inheritance taxes',         total:      166_095 },
    { name: 'Alcohol and tobacco taxes', total:      345_478 },
    { name: 'Insurance taxes',           total:      200_626 },
    { name: 'Other taxes',               total:      212_776 },
    { name: 'Current service charges',   total:      195_981 },
    { name: 'Investment income',         total:      239_128 },
    { name: 'Sales/rents',               total:        3_710 },
    { name: 'Grants',                    total:       10_406 },
    { name: 'Other',                     total:       72_489 },
  ]},
  2009: { total: 12_405_185, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_035_065 },
    { name: 'Sales taxes',               total:    6_009_729 },
    { name: 'Gaming taxes',              total:       83_723 },
    { name: 'Inheritance taxes',         total:      183_216 },
    { name: 'Alcohol and tobacco taxes', total:      334_985 },
    { name: 'Insurance taxes',           total:      182_933 },
    { name: 'Other taxes',               total:      240_430 },
    { name: 'Current service charges',   total:      185_912 },
    { name: 'Investment income',         total:       95_134 },
    { name: 'Sales/rents',               total:        1_804 },
    { name: 'Grants',                    total:       12_942 },
    { name: 'Other',                     total:       39_312 },
  ]},
  2010: { total: 11_558_696, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    4_354_395 },
    { name: 'Sales taxes',               total:    5_912_564 },
    { name: 'Fuels taxes',               total:            1 },
    { name: 'Gaming taxes',              total:       93_791 },
    { name: 'Inheritance taxes',         total:      127_674 },
    { name: 'Alcohol and tobacco taxes', total:      277_332 },
    { name: 'Insurance taxes',           total:      175_032 },
    { name: 'Other taxes',               total:      277_001 },
    { name: 'Current service charges',   total:      202_984 },
    { name: 'Investment income',         total:       28_691 },
    { name: 'Sales/rents',               total:          767 },
    { name: 'Grants',                    total:       32_942 },
    { name: 'Other',                     total:       75_522 },
  ]},
  2011: { total: 13_000_029, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_464_957 },
    { name: 'Sales taxes',               total:    6_257_133 },
    { name: 'Gaming taxes',              total:       90_674 },
    { name: 'Inheritance taxes',         total:      160_912 },
    { name: 'Alcohol and tobacco taxes', total:      282_549 },
    { name: 'Insurance taxes',           total:      185_858 },
    { name: 'Other taxes',               total:      229_423 },
    { name: 'Current service charges',   total:      221_268 },
    { name: 'Investment income',         total:       22_521 },
    { name: 'Sales/rents',               total:        1_094 },
    { name: 'Grants',                    total:       49_451 },
    { name: 'Other',                     total:       34_189 },
  ]},
  2012: { total: 13_731_442, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_759_944 },
    { name: 'Sales taxes',               total:    6_643_529 },
    { name: 'Gaming taxes',              total:       88_806 },
    { name: 'Inheritance taxes',         total:      169_792 },
    { name: 'Alcohol and tobacco taxes', total:      299_117 },
    { name: 'Insurance taxes',           total:      202_437 },
    { name: 'Other taxes',               total:      229_771 },
    { name: 'Current service charges',   total:      219_472 },
    { name: 'Investment income',         total:       16_344 },
    { name: 'Sales/rents',               total:        5_503 },
    { name: 'Grants',                    total:       12_151 },
    { name: 'Other',                     total:       84_576 },
  ]},
  2013: { total: 13_527_118, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_441_430 },
    { name: 'Sales taxes',               total:    6_812_520 },
    { name: 'Gaming taxes',              total:       77_624 },
    { name: 'Inheritance taxes',         total:      160_820 },
    { name: 'Alcohol and tobacco taxes', total:      299_149 },
    { name: 'Insurance taxes',           total:      207_490 },
    { name: 'Other taxes',               total:      236_192 },
    { name: 'Current service charges',   total:      193_257 },
    { name: 'Investment income',         total:       27_990 },
    { name: 'Sales/rents',               total:        1_391 },
    { name: 'Grants',                    total:       11_731 },
    { name: 'Other',                     total:       57_524 },
  ]},
  2014: { total: 13_983_119, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    5_891_093 },
    { name: 'Sales taxes',               total:    6_959_789 },
    { name: 'Fuels taxes',               total:        1_648 },
    { name: 'Gaming taxes',              total:       60_431 },
    { name: 'Inheritance taxes',         total:       56_166 },
    { name: 'Alcohol and tobacco taxes', total:      274_208 },
    { name: 'Insurance taxes',           total:      220_124 },
    { name: 'Other taxes',               total:      240_070 },
    { name: 'Current service charges',   total:      202_310 },
    { name: 'Investment income',         total:       19_769 },
    { name: 'Sales/rents',               total:          627 },
    { name: 'Grants',                    total:        2_291 },
    { name: 'Other',                     total:       54_593 },
  ]},
  2015: { total: 14_530_753, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    6_246_681 },
    { name: 'Sales taxes',               total:    7_185_700 },
    { name: 'Fuels taxes',               total:        1_711 },
    { name: 'Gaming taxes',              total:       57_258 },
    { name: 'Alcohol and tobacco taxes', total:      268_500 },
    { name: 'Insurance taxes',           total:      218_205 },
    { name: 'Other taxes',               total:      312_212 },
    { name: 'Current service charges',   total:      160_234 },
    { name: 'Investment income',         total:       22_084 },
    { name: 'Sales/rents',               total:          471 },
    { name: 'Grants',                    total:        6_074 },
    { name: 'Other',                     total:       51_623 },
  ]},
  2016: { total: 14_684_898, confidence: 'actual', categories: [
    { name: 'Income taxes',                 total:    6_300_756 },
    { name: 'Sales taxes',                  total:    7_268_933 },
    { name: 'Fuels taxes',                  total:        2_116 },
    { name: 'Gaming taxes',                 total:       52_932 },
    { name: 'Alcohol and tobacco taxes',    total:      270_918 },
    { name: 'Insurance taxes',              total:      230_321 },
    { name: 'Financial Institutions taxes', total:          185 },
    { name: 'Other taxes',                  total:      309_824 },
    { name: 'Current service charges',      total:      179_337 },
    { name: 'Investment income',            total:       36_340 },
    { name: 'Sales/rents',                  total:          378 },
    { name: 'Grants',                       total:        1_019 },
    { name: 'Other',                        total:       31_839 },
  ]},
  2017: { total: 15_055_414, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    6_442_695 },
    { name: 'Sales taxes',               total:    7_511_874 },
    { name: 'Fuels taxes',               total:        1_776 },
    { name: 'Gaming taxes',              total:       50_447 },
    { name: 'Alcohol and tobacco taxes', total:      267_837 },
    { name: 'Insurance taxes',           total:      230_412 },
    { name: 'Other taxes',               total:      310_655 },
    { name: 'Current service charges',   total:      163_594 },
    { name: 'Investment income',         total:       46_640 },
    { name: 'Sales/rents',               total:          260 },
    { name: 'Grants',                    total:        1_669 },
    { name: 'Other',                     total:       27_555 },
  ]},
  2018: { total: 15_388_104, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    6_400_467 },
    { name: 'Sales taxes',               total:    7_756_396 },
    { name: 'Fuels taxes',               total:        1_999 },
    { name: 'Gaming taxes',              total:       47_984 },
    { name: 'Alcohol and tobacco taxes', total:      260_058 },
    { name: 'Insurance taxes',           total:      226_356 },
    { name: 'Other taxes',               total:      339_869 },
    { name: 'Current service charges',   total:      219_008 },
    { name: 'Investment income',         total:       89_240 },
    { name: 'Sales/rents',               total:          124 },
    { name: 'Grants',                    total:        5_568 },
    { name: 'Other',                     total:       41_035 },
  ]},
  2019: { total: 16_299_667, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    6_850_851 },
    { name: 'Sales taxes',               total:    8_009_760 },
    { name: 'Fuels taxes',               total:        1_910 },
    { name: 'Gaming taxes',              total:       47_246 },
    { name: 'Alcohol and tobacco taxes', total:      251_911 },
    { name: 'Insurance taxes',           total:      251_413 },
    { name: 'Other taxes',               total:      365_784 },
    { name: 'Current service charges',   total:      286_390 },
    { name: 'Investment income',         total:      189_905 },
    { name: 'Sales/rents',               total:          128 },
    { name: 'Grants',                    total:        1_767 },
    { name: 'Other',                     total:       42_602 },
  ]},
  2020: { total: 16_406_396, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    6_686_004 },
    { name: 'Sales taxes',               total:    8_239_440 },
    { name: 'Fuels taxes',               total:        1_699 },
    { name: 'Gaming taxes',              total:       41_386 },
    { name: 'Alcohol and tobacco taxes', total:      256_887 },
    { name: 'Insurance taxes',           total:      243_330 },
    { name: 'Other taxes',               total:      401_111 },
    { name: 'Current service charges',   total:      320_494 },
    { name: 'Investment income',         total:      172_443 },
    { name: 'Sales/rents',               total:          379 },
    { name: 'Grants',                    total:        2_330 },
    { name: 'Other',                     total:       40_893 },
  ]},
  2021: { total: 18_709_643, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    7_997_414 },
    { name: 'Sales taxes',               total:    9_264_222 },
    { name: 'Fuels taxes',               total:        1_541 },
    { name: 'Gaming taxes',              total:      191_663 },
    { name: 'Alcohol and tobacco taxes', total:      255_190 },
    { name: 'Insurance taxes',           total:      229_457 },
    { name: 'Other taxes',               total:      412_754 },
    { name: 'Current service charges',   total:      247_716 },
    { name: 'Investment income',         total:       24_425 },
    { name: 'Sales/rents',               total:          849 },
    { name: 'Grants',                    total:        2_565 },
    { name: 'Other',                     total:       81_847 },
  ]},
  2022: { total: 20_938_603, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    9_130_659 },
    { name: 'Sales taxes',               total:   10_238_270 },
    { name: 'Gaming taxes',              total:      228_128 },
    { name: 'Alcohol and tobacco taxes', total:      237_396 },
    { name: 'Insurance taxes',           total:      252_235 },
    { name: 'Other taxes',               total:      434_696 },
    { name: 'Current service charges',   total:      310_507 },
    { name: 'Investment income (loss)',  total:      -30_464 },
    { name: 'Sales/rents',               total:          872 },
    { name: 'Grants',                    total:       10_064 },
    { name: 'Other',                     total:      126_240 },
  ]},
  2023: { total: 21_863_097, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    8_791_319 },
    { name: 'Sales taxes',               total:   10_498_790 },
    { name: 'Gaming taxes',              total:      232_653 },
    { name: 'Alcohol and tobacco taxes', total:      245_078 },
    { name: 'Insurance taxes',           total:      261_846 },
    { name: 'Other taxes',               total:      434_280 },
    { name: 'Current service charges',   total:      700_984 },
    { name: 'Investment income (loss)',  total:      466_834 },
    { name: 'Sales/rents',               total:        1_189 },
    { name: 'Grants',                    total:        9_690 },
    { name: 'Other',                     total:      220_434 },
  ]},
  2024: { total: 22_101_900, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    8_923_553 },
    { name: 'Sales taxes',               total:   10_368_987 },
    { name: 'Gaming taxes',              total:      226_414 },
    { name: 'Alcohol and tobacco taxes', total:      220_806 },
    { name: 'Insurance taxes',           total:      266_679 },
    { name: 'Other taxes',               total:      387_764 },
    { name: 'Current service charges',   total:      668_979 },
    { name: 'Investment income (loss)',  total:      963_310 },
    { name: 'Sales/rents',               total:        1_135 },
    { name: 'Grants',                    total:           68 },
    { name: 'Other',                     total:       74_205 },
  ]},
  2025: { total: 23_203_835, confidence: 'actual', categories: [
    { name: 'Income taxes',              total:    9_535_309 },
    { name: 'Sales taxes',               total:   10_684_259 },
    { name: 'Gaming taxes',              total:      237_909 },
    { name: 'Alcohol and tobacco taxes', total:      232_344 },
    { name: 'Insurance taxes',           total:      316_557 },
    { name: 'Other taxes',               total:      386_872 },
    { name: 'Current service charges',   total:      646_068 },
    { name: 'Investment income (loss)',  total:      888_934 },
    { name: 'Sales/rents',               total:        1_067 },
    { name: 'Grants',                    total:        3_132 },
    { name: 'Other',                     total:      271_384 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 1_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Indiana General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Indiana General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'in-acfr-gf-revenue', base_url: 'https://www.in.gov/comptroller/Annual-Comprehensive-Financial-Reports', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (net loss — shown at 0)]`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL REVENUES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} revenue budget row to stamp source`); process.exit(2); }
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
