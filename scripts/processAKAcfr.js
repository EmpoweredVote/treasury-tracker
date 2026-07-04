#!/usr/bin/env node
/**
 * Alaska General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Alaska Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the AK state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   AK state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-33): AK ACFR GF ~1.32x NASBO GF (FY2025 $8,378,945K vs FY2024 NASBO $6,339,000K).
 *   Federal Grants in Aid ($4,833,918K FY2025) consolidated into the GAAP General Fund column;
 *   NASBO's narrower budgetary GF concept excludes most of it. Accepted-and-relabelled honestly (TX precedent).
 *
 * NAMING: FY2020-2025 = {YYYY}acfr.pdf; FY2010-2019 = {YYYY}cafr.pdf; FY2006-2009 = {YY}cafr.pdf (2-digit).
 *   FY1998-2005 not durably linked on the DOF reports page (FY1998/99 present but pre-GASB-34 / no clean tie;
 *   FY2000-2005 absent) -> honest holes. Durable clean window = FY2006-FY2025 (20 contiguous years).
 *
 * PRE-LOAD CLEANUP (WR-05/LOAD-01): 2 orphaned data_sources rows (ak-ugf-revenue, ak-ugf-operating,
 *   from an abandoned HTML loader, 0 referencing budgets rows) deleted before this load (see 118-01-AK-LOADLOG.md).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Interest and Investment Income (Loss) positive at both bookends (FY2025 +$350,330K, FY2020 +$273,988K); every loaded year scanned - clamp is the render path if any interior year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ak/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processAKAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Alaska'; const STATE_ABBR = 'AK'; const POPULATION = 733_391;
const EXPECTED_MUNI_ID = 'b268c415-0058-4fea-8ba1-24f49fb434b4';
const UNITS = 1_000; // AK ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2006: { url: 'https://doa.alaska.gov/dof/reports/resource/06cafr.pdf', date: '2006-06-30' },
  2007: { url: 'https://doa.alaska.gov/dof/reports/resource/07cafr.pdf', date: '2007-06-30' },
  2008: { url: 'https://doa.alaska.gov/dof/reports/resource/08cafr.pdf', date: '2008-06-30' },
  2009: { url: 'https://doa.alaska.gov/dof/reports/resource/09cafr.pdf', date: '2009-06-30' },
  2010: { url: 'https://doa.alaska.gov/dof/reports/resource/2010cafr.pdf', date: '2010-06-30' },
  2011: { url: 'https://doa.alaska.gov/dof/reports/resource/2011cafr.pdf', date: '2011-06-30' },
  2012: { url: 'https://doa.alaska.gov/dof/reports/resource/2012cafr.pdf', date: '2012-06-30' },
  2013: { url: 'https://doa.alaska.gov/dof/reports/resource/2013cafr.pdf', date: '2013-06-30' },
  2014: { url: 'https://doa.alaska.gov/dof/reports/resource/2014cafr.pdf', date: '2014-06-30' },
  2015: { url: 'https://doa.alaska.gov/dof/reports/resource/2015cafr.pdf', date: '2015-06-30' },
  2016: { url: 'https://doa.alaska.gov/dof/reports/resource/2016cafr.pdf', date: '2016-06-30' },
  2017: { url: 'https://doa.alaska.gov/dof/reports/resource/2017cafr.pdf', date: '2017-06-30' },
  2018: { url: 'https://doa.alaska.gov/dof/reports/resource/2018cafr.pdf', date: '2018-06-30' },
  2019: { url: 'https://doa.alaska.gov/dof/reports/resource/2019cafr.pdf', date: '2019-06-30' },
  2020: { url: 'https://doa.alaska.gov/dof/reports/resource/2020acfr.pdf', date: '2020-06-30' },
  2021: { url: 'https://doa.alaska.gov/dof/reports/resource/2021acfr.pdf', date: '2021-06-30' },
  2022: { url: 'https://doa.alaska.gov/dof/reports/resource/2022acfr.pdf', date: '2022-06-30' },
  2023: { url: 'https://doa.alaska.gov/dof/reports/resource/2023acfr.pdf', date: '2023-06-30' },
  2024: { url: 'https://doa.alaska.gov/dof/reports/resource/2024acfr.pdf', date: '2024-06-30' },
  2025: { url: 'https://doa.alaska.gov/dof/reports/resource/2025acfr.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Alaska State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — AK ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2006: { total: 6_215_777, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      234_921 },
    { name: 'Alaska Permanent Fund Dividend',            total:      505_093 },
    { name: 'Education',                                 total:    1_164_369 },
    { name: 'University',                                total:      258_942 },
    { name: 'Health and Human Services',                 total:    1_789_841 },
    { name: 'Law and Justice',                           total:      169_236 },
    { name: 'Public Protection',                         total:      526_396 },
    { name: 'Natural Resources',                         total:      198_556 },
    { name: 'Development',                               total:      460_785 },
    { name: 'Transportation',                            total:      833_547 },
    { name: 'Intergovernmental Revenue Sharing',         total:       59_477 },
    { name: 'Debt service — Principal',                  total:       10_875 },
    { name: 'Debt service — Interest and Other Charges', total:        3_739 },
  ]},
  2007: { total: 6_777_300, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      276_867 },
    { name: 'Alaska Permanent Fund Dividend',            total:      658_294 },
    { name: 'Education',                                 total:    1_303_482 },
    { name: 'University',                                total:      310_173 },
    { name: 'Health and Human Services',                 total:    1_815_070 },
    { name: 'Law and Justice',                           total:      178_374 },
    { name: 'Public Protection',                         total:      553_412 },
    { name: 'Natural Resources',                         total:      233_359 },
    { name: 'Development',                               total:      412_559 },
    { name: 'Transportation',                            total:      960_638 },
    { name: 'Intergovernmental Revenue Sharing',         total:       61_925 },
    { name: 'Debt service — Principal',                  total:        9_495 },
    { name: 'Debt service — Interest and Other Charges', total:        3_652 },
  ]},
  2008: { total: 7_835_681, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      516_377 },
    { name: 'Alaska Permanent Fund Dividend',            total:      990_379 },
    { name: 'Education',                                 total:    1_677_120 },
    { name: 'University',                                total:      373_726 },
    { name: 'Health and Human Services',                 total:    1_877_353 },
    { name: 'Law and Justice',                           total:      207_554 },
    { name: 'Public Protection',                         total:      577_377 },
    { name: 'Natural Resources',                         total:      233_166 },
    { name: 'Development',                               total:      238_540 },
    { name: 'Transportation',                            total:    1_004_380 },
    { name: 'Intergovernmental Revenue Sharing',         total:      128_564 },
    { name: 'Debt service — Principal',                  total:        8_285 },
    { name: 'Debt service — Interest and Other Charges', total:        2_860 },
  ]},
  2009: { total: 9_548_605, confidence: 'actual', categories: [
    { name: 'General Government',                             total:      677_541 },
    { name: 'Alaska Permanent Fund Dividend/Resource Rebate', total:    2_015_974 },
    { name: 'Education',                                      total:    1_614_892 },
    { name: 'University',                                     total:      409_072 },
    { name: 'Health and Human Services',                      total:    2_059_425 },
    { name: 'Law and Justice',                                total:      201_383 },
    { name: 'Public Protection',                              total:      620_898 },
    { name: 'Natural Resources',                              total:      252_016 },
    { name: 'Development',                                    total:      375_980 },
    { name: 'Transportation',                                 total:    1_081_805 },
    { name: 'Intergovernmental Revenue Sharing',              total:      231_364 },
    { name: 'Debt service — Principal',                       total:        5_794 },
    { name: 'Debt service — Interest and Other Charges',      total:        2_461 },
  ]},
  2010: { total: 8_419_469, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      365_067 },
    { name: 'Alaska Permanent Fund Dividend',            total:      817_162 },
    { name: 'Education',                                 total:    1_669_469 },
    { name: 'University',                                total:      402_851 },
    { name: 'Health and Human Services',                 total:    2_246_658 },
    { name: 'Law and Justice',                           total:      302_185 },
    { name: 'Public Protection',                         total:      715_011 },
    { name: 'Natural Resources',                         total:      266_283 },
    { name: 'Development',                               total:      320_285 },
    { name: 'Transportation',                            total:    1_128_683 },
    { name: 'Intergovernmental Revenue Sharing',         total:      177_804 },
    { name: 'Debt service — Principal',                  total:        5_810 },
    { name: 'Debt service — Interest and Other Charges', total:        2_201 },
  ]},
  2011: { total: 9_307_100, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      388_109 },
    { name: 'Alaska Permanent Fund Dividend',            total:      817_894 },
    { name: 'Education',                                 total:    1_798_577 },
    { name: 'University',                                total:      436_112 },
    { name: 'Health and Human Services',                 total:    2_423_401 },
    { name: 'Law and Justice',                           total:      236_605 },
    { name: 'Public Protection',                         total:      783_971 },
    { name: 'Natural Resources',                         total:      267_631 },
    { name: 'Development',                               total:      869_912 },
    { name: 'Transportation',                            total:    1_086_107 },
    { name: 'Intergovernmental Revenue Sharing',         total:      189_796 },
    { name: 'Debt service — Principal',                  total:        7_174 },
    { name: 'Debt service — Interest and Other Charges', total:        1_811 },
  ]},
  2012: { total: 9_363_479, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      399_850 },
    { name: 'Alaska Permanent Fund Dividend',            total:      757_576 },
    { name: 'Education',                                 total:    1_845_251 },
    { name: 'University',                                total:      444_083 },
    { name: 'Health and Human Services',                 total:    2_569_119 },
    { name: 'Law and Justice',                           total:      277_332 },
    { name: 'Public Protection',                         total:      734_036 },
    { name: 'Natural Resources',                         total:      295_205 },
    { name: 'Development',                               total:      565_558 },
    { name: 'Transportation',                            total:    1_122_635 },
    { name: 'Intergovernmental Revenue Sharing',         total:      254_525 },
    { name: 'Debt service — Principal',                  total:       73_410 },
    { name: 'Debt service — Interest and Other Charges', total:       24_899 },
  ]},
  2013: { total: 9_817_566, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      467_958 },
    { name: 'Alaska Permanent Fund Dividend',            total:      562_621 },
    { name: 'Education',                                 total:    1_999_500 },
    { name: 'University',                                total:      467_757 },
    { name: 'Health and Human Services',                 total:    2_736_135 },
    { name: 'Law and Justice',                           total:      270_155 },
    { name: 'Public Protection',                         total:      736_055 },
    { name: 'Natural Resources',                         total:      319_002 },
    { name: 'Development',                               total:      685_512 },
    { name: 'Transportation',                            total:    1_234_758 },
    { name: 'Intergovernmental Revenue Sharing',         total:      288_281 },
    { name: 'Debt service — Principal',                  total:       30_549 },
    { name: 'Debt service — Interest and Other Charges', total:       19_283 },
  ]},
  2014: { total: 10_122_042, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      454_287 },
    { name: 'Alaska Permanent Fund Dividend',            total:      570_590 },
    { name: 'Education',                                 total:    2_049_927 },
    { name: 'University',                                total:      551_205 },
    { name: 'Health and Human Services',                 total:    2_595_082 },
    { name: 'Law and Justice',                           total:      292_586 },
    { name: 'Public Protection',                         total:      801_567 },
    { name: 'Natural Resources',                         total:      327_738 },
    { name: 'Development',                               total:      691_420 },
    { name: 'Transportation',                            total:    1_474_679 },
    { name: 'Intergovernmental Revenue Sharing',         total:      263_408 },
    { name: 'Debt service — Principal',                  total:       31_050 },
    { name: 'Debt service — Interest and Other Charges', total:       18_503 },
  ]},
  2015: { total: 13_127_986, confidence: 'actual', categories: [
    { name: 'General Government',                        total:    1_290_102 },
    { name: 'Alaska Permanent Fund Dividend',            total:    1_203_234 },
    { name: 'Education',                                 total:    3_729_601 },
    { name: 'University',                                total:      650_616 },
    { name: 'Health and Human Services',                 total:    2_799_516 },
    { name: 'Law and Justice',                           total:      271_577 },
    { name: 'Public Protection',                         total:      793_568 },
    { name: 'Natural Resources',                         total:      349_710 },
    { name: 'Development',                               total:      385_764 },
    { name: 'Transportation',                            total:    1_464_579 },
    { name: 'Intergovernmental Revenue Sharing',         total:      134_686 },
    { name: 'Debt service — Principal',                  total:       36_161 },
    { name: 'Debt service — Interest and Other Charges', total:       18_446 },
    { name: 'Bond Issuance Costs',                       total:          426 },
  ]},
  2016: { total: 10_285_928, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      410_384 },
    { name: 'Alaska Permanent Fund Dividend',            total:    1_330_027 },
    { name: 'Education',                                 total:    1_826_578 },
    { name: 'University',                                total:      449_266 },
    { name: 'Health and Human Services',                 total:    2_915_199 },
    { name: 'Law and Justice',                           total:      252_049 },
    { name: 'Public Protection',                         total:      764_466 },
    { name: 'Natural Resources',                         total:      321_985 },
    { name: 'Development',                               total:      429_184 },
    { name: 'Transportation',                            total:    1_403_700 },
    { name: 'Intergovernmental Revenue Sharing',         total:      125_351 },
    { name: 'Debt service — Principal',                  total:       41_554 },
    { name: 'Debt service — Interest and Other Charges', total:       16_185 },
  ]},
  2017: { total: 9_073_306, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      400_278 },
    { name: 'Alaska Permanent Fund Dividend',            total:      652_746 },
    { name: 'Education',                                 total:    1_770_809 },
    { name: 'University',                                total:      374_028 },
    { name: 'Health and Human Services',                 total:    3_072_594 },
    { name: 'Law and Justice',                           total:      235_223 },
    { name: 'Public Protection',                         total:      714_867 },
    { name: 'Natural Resources',                         total:      290_933 },
    { name: 'Development',                               total:      177_564 },
    { name: 'Transportation',                            total:    1_242_139 },
    { name: 'Intergovernmental Revenue Sharing',         total:       97_454 },
    { name: 'Debt service — Principal',                  total:       30_832 },
    { name: 'Debt service — Interest and Other Charges', total:       13_839 },
  ]},
  2018: { total: 9_093_115, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      298_614 },
    { name: 'Alaska Permanent Fund Dividend',            total:      698_016 },
    { name: 'Education',                                 total:    1_786_851 },
    { name: 'University',                                total:      368_534 },
    { name: 'Health and Human Services',                 total:    3_182_552 },
    { name: 'Law and Justice',                           total:      240_902 },
    { name: 'Public Protection',                         total:      738_289 },
    { name: 'Natural Resources',                         total:      280_276 },
    { name: 'Development',                               total:      201_811 },
    { name: 'Transportation',                            total:    1_140_187 },
    { name: 'Intergovernmental Revenue Sharing',         total:      107_852 },
    { name: 'Debt service — Principal',                  total:       34_816 },
    { name: 'Debt service — Interest and Other Charges', total:       14_415 },
  ]},
  2019: { total: 9_763_448, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      358_574 },
    { name: 'Alaska Permanent Fund Dividend',            total:    1_014_677 },
    { name: 'Education',                                 total:    1_792_361 },
    { name: 'University',                                total:      384_090 },
    { name: 'Health and Human Services',                 total:    3_340_407 },
    { name: 'Law and Justice',                           total:      243_279 },
    { name: 'Public Protection',                         total:      772_552 },
    { name: 'Natural Resources',                         total:      290_662 },
    { name: 'Development',                               total:      124_848 },
    { name: 'Transportation',                            total:    1_294_651 },
    { name: 'Intergovernmental Revenue Sharing',         total:      109_666 },
    { name: 'Debt service — Principal',                  total:       26_312 },
    { name: 'Debt service — Interest and Other Charges', total:       11_369 },
  ]},
  2020: { total: 9_832_680, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      360_016 },
    { name: 'Alaska Permanent Fund Dividend',            total:    1_024_587 },
    { name: 'Education',                                 total:    1_833_960 },
    { name: 'University',                                total:      345_327 },
    { name: 'Health and Human Services',                 total:    3_406_972 },
    { name: 'Law and Justice',                           total:      248_758 },
    { name: 'Public Protection',                         total:      890_219 },
    { name: 'Natural Resources',                         total:      275_493 },
    { name: 'Development',                               total:      133_813 },
    { name: 'Transportation',                            total:    1_155_931 },
    { name: 'Intergovernmental Revenue Sharing',         total:      106_977 },
    { name: 'Debt service — Principal',                  total:       37_633 },
    { name: 'Debt service — Interest and Other Charges', total:       12_994 },
  ]},
  2021: { total: 11_500_309, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      909_595 },
    { name: 'Alaska Permanent Fund Dividend',            total:      631_807 },
    { name: 'Education',                                 total:    1_821_946 },
    { name: 'University',                                total:      322_105 },
    { name: 'Health and Human Services',                 total:    3_723_772 },
    { name: 'Law and Justice',                           total:      246_111 },
    { name: 'Public Protection',                         total:      802_845 },
    { name: 'Natural Resources',                         total:      276_949 },
    { name: 'Development',                               total:    1_497_702 },
    { name: 'Transportation',                            total:    1_138_542 },
    { name: 'Intergovernmental Revenue Sharing',         total:       89_708 },
    { name: 'Debt service — Principal',                  total:       27_256 },
    { name: 'Debt service — Interest and Other Charges', total:       11_971 },
  ]},
  2022: { total: 11_108_014, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      548_912 },
    { name: 'Alaska Permanent Fund Dividend',            total:      709_490 },
    { name: 'Education',                                 total:    2_164_955 },
    { name: 'University',                                total:      315_803 },
    { name: 'Health and Human Services',                 total:    4_171_181 },
    { name: 'Law and Justice',                           total:      267_823 },
    { name: 'Public Protection',                         total:      970_084 },
    { name: 'Natural Resources',                         total:      292_754 },
    { name: 'Development',                               total:      178_327 },
    { name: 'Transportation',                            total:    1_244_143 },
    { name: 'Intergovernmental Revenue Sharing',         total:      182_375 },
    { name: 'Debt service — Principal',                  total:       47_915 },
    { name: 'Debt service — Interest and Other Charges', total:       14_252 },
  ]},
  2023: { total: 12_389_996, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      281_592 },
    { name: 'Alaska Permanent Fund Dividend',            total:    2_070_825 },
    { name: 'Education',                                 total:    2_041_940 },
    { name: 'University',                                total:      337_311 },
    { name: 'Health and Human Services',                 total:    4_139_337 },
    { name: 'Law and Justice',                           total:      291_846 },
    { name: 'Public Protection',                         total:    1_090_340 },
    { name: 'Natural Resources',                         total:      305_639 },
    { name: 'Development',                               total:      179_763 },
    { name: 'Transportation',                            total:    1_429_865 },
    { name: 'Intergovernmental Revenue Sharing',         total:      145_039 },
    { name: 'Debt service — Principal',                  total:       61_868 },
    { name: 'Debt service — Interest and Other Charges', total:       14_631 },
  ]},
  2024: { total: 11_809_551, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      400_551 },
    { name: 'Alaska Permanent Fund Dividend',            total:      836_499 },
    { name: 'Education',                                 total:    2_039_732 },
    { name: 'University',                                total:      379_146 },
    { name: 'Health and Human Services',                 total:    4_351_976 },
    { name: 'Law and Justice',                           total:      308_224 },
    { name: 'Public Protection',                         total:    1_104_040 },
    { name: 'Natural Resources',                         total:      349_507 },
    { name: 'Development',                               total:      177_883 },
    { name: 'Transportation',                            total:    1_659_378 },
    { name: 'Intergovernmental Revenue Sharing',         total:      122_525 },
    { name: 'Debt service — Principal',                  total:       64_277 },
    { name: 'Debt service — Interest and Other Charges', total:       15_813 },
  ]},
  2025: { total: 12_373_317, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      339_106 },
    { name: 'Alaska Permanent Fund Dividend',            total:    1_074_244 },
    { name: 'Education',                                 total:    2_051_342 },
    { name: 'University',                                total:      409_550 },
    { name: 'Health and Human Services',                 total:    4_686_133 },
    { name: 'Law and Justice',                           total:      342_364 },
    { name: 'Public Protection',                         total:    1_120_051 },
    { name: 'Natural Resources',                         total:      383_905 },
    { name: 'Development',                               total:      171_184 },
    { name: 'Transportation',                            total:    1_601_168 },
    { name: 'Intergovernmental Revenue Sharing',         total:       95_832 },
    { name: 'Debt service — Principal',                  total:       81_246 },
    { name: 'Debt service — Interest and Other Charges', total:       17_192 },
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
  return { jsonTree: [{ n: 'Alaska General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Alaska General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ak-acfr-gf-operating', base_url: 'https://doa.alaska.gov/dof/reports/annualreport.html', fiscal_years: [2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
