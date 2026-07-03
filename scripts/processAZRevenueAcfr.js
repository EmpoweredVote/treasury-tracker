#!/usr/bin/env node
/**
 * Arizona General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Arizona Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the AZ state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/az/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processAZRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Arizona State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — AZ ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 11_655_423, confidence: 'actual', categories: [
    { name: 'Sales taxes',                      total:    3_800_270 },
    { name: 'Income taxes',                     total:    2_410_342 },
    { name: 'Property taxes',                   total:       40_823 },
    { name: 'Motor vehicle and fuel taxes',     total:       11_324 },
    { name: 'Other taxes',                      total:      358_590 },
    { name: 'Intergovernmental',                total:    4_573_647 },
    { name: 'Licenses, fees and permits',       total:       72_847 },
    { name: 'Earnings on investments',          total:       61_153 },
    { name: 'Sales and charges for services',   total:       80_977 },
    { name: 'Fines, forfeitures and penalties', total:       16_627 },
    { name: 'Other',                            total:      228_823 },
  ]},
  2003: { total: 12_659_628, confidence: 'actual', categories: [
    { name: 'Sales taxes',                      total:    3_831_421 },
    { name: 'Income taxes',                     total:    2_387_340 },
    { name: 'Property taxes',                   total:       29_407 },
    { name: 'Motor vehicle and fuel taxes',     total:        7_723 },
    { name: 'Other taxes',                      total:      423_939 },
    { name: 'Intergovernmental',                total:    5_551_059 },
    { name: 'Licenses, fees and permits',       total:       81_041 },
    { name: 'Earnings on investments',          total:       21_641 },
    { name: 'Sales and charges for services',   total:       68_064 },
    { name: 'Fines, forfeitures and penalties', total:       10_700 },
    { name: 'Other',                            total:      247_293 },
  ]},
  2004: { total: 14_756_194, confidence: 'actual', categories: [
    { name: 'Sales taxes',                      total:    4_201_649 },
    { name: 'Income taxes',                     total:    2_818_733 },
    { name: 'Tobacco taxes',                    total:       58_471 },
    { name: 'Property taxes',                   total:       42_892 },
    { name: 'Motor vehicle and fuel taxes',     total:          801 },
    { name: 'Other taxes',                      total:      431_101 },
    { name: 'Intergovernmental',                total:    6_655_803 },
    { name: 'Licenses, fees and permits',       total:       87_817 },
    { name: 'Earnings on investments',          total:        9_462 },
    { name: 'Sales and charges for services',   total:      100_419 },
    { name: 'Fines, forfeitures and penalties', total:       32_748 },
    { name: 'Gaming',                           total:        3_612 },
    { name: 'Tobacco settlement',               total:       92_550 },
    { name: 'Other',                            total:      220_136 },
  ]},
  2005: { total: 16_333_270, confidence: 'actual', categories: [
    { name: 'Sales taxes',                      total:    4_546_492 },
    { name: 'Income taxes',                     total:    3_528_522 },
    { name: 'Tobacco taxes',                    total:       60_859 },
    { name: 'Property taxes',                   total:       29_055 },
    { name: 'Motor vehicle and fuel taxes',     total:          629 },
    { name: 'Other taxes',                      total:      395_335 },
    { name: 'Intergovernmental',                total:    7_132_985 },
    { name: 'Licenses, fees and permits',       total:       91_278 },
    { name: 'Earnings on investments',          total:       59_454 },
    { name: 'Sales and charges for services',   total:       85_356 },
    { name: 'Fines, forfeitures and penalties', total:       16_285 },
    { name: 'Gaming',                           total:        4_760 },
    { name: 'Tobacco settlement',               total:       93_933 },
    { name: 'Other',                            total:      288_327 },
  ]},
  2006: { total: 18_576_775, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_427_713 },
    { name: 'Income taxes',                      total:    4_535_454 },
    { name: 'Tobacco taxes',                     total:       64_078 },
    { name: 'Property taxes',                    total:       29_117 },
    { name: 'Motor vehicle and fuel taxes',      total:          587 },
    { name: 'Other taxes',                       total:      467_428 },
    { name: 'Intergovernmental',                 total:    7_532_085 },
    { name: 'Licenses, fees, and permits',       total:      106_244 },
    { name: 'Earnings on investments',           total:      116_618 },
    { name: 'Sales and charges for services',    total:       89_593 },
    { name: 'Fines, forfeitures, and penalties', total:       18_087 },
    { name: 'Gaming',                            total:        6_008 },
    { name: 'Tobacco settlement',                total:       86_231 },
    { name: 'Other',                             total:       97_532 },
  ]},
  2007: { total: 19_309_065, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_666_980 },
    { name: 'Income taxes',                      total:    4_629_179 },
    { name: 'Tobacco taxes',                     total:       98_436 },
    { name: 'Property taxes',                    total:       28_433 },
    { name: 'Motor vehicle and fuel taxes',      total:          686 },
    { name: 'Other taxes',                       total:      438_539 },
    { name: 'Intergovernmental',                 total:    7_832_627 },
    { name: 'Licenses, fees, and permits',       total:      113_730 },
    { name: 'Earnings on investments',           total:      172_435 },
    { name: 'Sales and charges for services',    total:       84_465 },
    { name: 'Fines, forfeitures, and penalties', total:       25_809 },
    { name: 'Gaming',                            total:        6_751 },
    { name: 'Tobacco settlement',                total:       90_258 },
    { name: 'Other',                             total:      120_737 },
  ]},
  2008: { total: 19_608_118, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_450_023 },
    { name: 'Income taxes',                      total:    4_174_859 },
    { name: 'Tobacco taxes',                     total:       83_224 },
    { name: 'Property taxes',                    total:       22_910 },
    { name: 'Motor vehicle and fuel taxes',      total:          915 },
    { name: 'Other taxes',                       total:      453_274 },
    { name: 'Intergovernmental',                 total:    8_831_263 },
    { name: 'Licenses, fees, and permits',       total:      115_156 },
    { name: 'Earnings on investments',           total:      112_624 },
    { name: 'Sales and charges for services',    total:       95_288 },
    { name: 'Fines, forfeitures, and penalties', total:       33_805 },
    { name: 'Gaming',                            total:        6_695 },
    { name: 'Tobacco settlement',                total:      115_587 },
    { name: 'Other',                             total:      112_495 },
  ]},
  2009: { total: 19_511_587, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    4_669_693 },
    { name: 'Income taxes',                      total:    3_137_714 },
    { name: 'Tobacco taxes',                     total:       75_128 },
    { name: 'Property taxes',                    total:       20_589 },
    { name: 'Other taxes',                       total:      456_561 },
    { name: 'Intergovernmental',                 total:   10_614_124 },
    { name: 'Licenses, fees, and permits',       total:      110_563 },
    { name: 'Earnings on investments',           total:       19_107 },
    { name: 'Sales and charges for services',    total:       88_198 },
    { name: 'Fines, forfeitures, and penalties', total:       40_570 },
    { name: 'Gaming',                            total:        5_973 },
    { name: 'Tobacco settlement',                total:      125_571 },
    { name: 'Other',                             total:      147_796 },
  ]},
  2010: { total: 21_031_587, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    4_370_699 },
    { name: 'Income taxes',                      total:    2_805_338 },
    { name: 'Tobacco taxes',                     total:       67_815 },
    { name: 'Property taxes',                    total:       21_890 },
    { name: 'Other taxes',                       total:      451_407 },
    { name: 'Intergovernmental',                 total:   12_794_911 },
    { name: 'Licenses, fees, and permits',       total:       91_565 },
    { name: 'Earnings on investments',           total:       10_766 },
    { name: 'Sales and charges for services',    total:       98_552 },
    { name: 'Fines, forfeitures, and penalties', total:       38_355 },
    { name: 'Gaming',                            total:        5_417 },
    { name: 'Tobacco settlement',                total:      105_394 },
    { name: 'Other',                             total:      169_478 },
  ]},
  2011: { total: 21_769_182, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_301_950 },
    { name: 'Income taxes',                      total:    3_398_894 },
    { name: 'Tobacco taxes',                     total:       66_558 },
    { name: 'Property taxes',                    total:       22_239 },
    { name: 'Motor vehicle and fuel taxes',      total:       55_839 },
    { name: 'Other taxes',                       total:      457_002 },
    { name: 'Intergovernmental',                 total:   12_009_267 },
    { name: 'Licenses, fees, and permits',       total:      102_623 },
    { name: 'Earnings on investments',           total:       14_862 },
    { name: 'Sales and charges for services',    total:       94_285 },
    { name: 'Fines, forfeitures, and penalties', total:       38_205 },
    { name: 'Gaming',                            total:        5_656 },
    { name: 'Tobacco settlement',                total:       99_130 },
    { name: 'Other',                             total:      102_672 },
  ]},
  2012: { total: 21_274_627, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_612_685 },
    { name: 'Income taxes',                      total:    3_715_007 },
    { name: 'Tobacco taxes',                     total:       63_838 },
    { name: 'Property taxes',                    total:       17_921 },
    { name: 'Motor vehicle and fuel taxes',      total:      106_404 },
    { name: 'Other taxes',                       total:      425_759 },
    { name: 'Intergovernmental',                 total:   10_830_480 },
    { name: 'Licenses, fees, and permits',       total:       84_140 },
    { name: 'Earnings on investments',           total:       17_820 },
    { name: 'Sales and charges for services',    total:      104_527 },
    { name: 'Fines, forfeitures, and penalties', total:       30_856 },
    { name: 'Gaming',                            total:        6_056 },
    { name: 'Tobacco settlement',                total:      101_067 },
    { name: 'Other',                             total:      158_067 },
  ]},
  2013: { total: 21_512_469, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_795_717 },
    { name: 'Income taxes',                      total:    4_034_572 },
    { name: 'Tobacco taxes',                     total:       64_888 },
    { name: 'Property taxes',                    total:       17_345 },
    { name: 'Motor vehicle and fuel taxes',      total:        6_130 },
    { name: 'Other taxes',                       total:      419_769 },
    { name: 'Intergovernmental',                 total:   10_670_984 },
    { name: 'Licenses, fees, and permits',       total:       86_771 },
    { name: 'Earnings on investments',           total:       -9_970 },
    { name: 'Sales and charges for services',    total:      103_157 },
    { name: 'Fines, forfeitures, and penalties', total:       37_850 },
    { name: 'Gaming',                            total:        6_148 },
    { name: 'Tobacco settlement',                total:      149_125 },
    { name: 'Other',                             total:      129_983 },
  ]},
  2014: { total: 21_172_535, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_156_987 },
    { name: 'Income taxes',                      total:    4_012_562 },
    { name: 'Tobacco taxes',                     total:       68_043 },
    { name: 'Property taxes',                    total:       26_240 },
    { name: 'Motor vehicle and fuel taxes',      total:        8_534 },
    { name: 'Other taxes',                       total:      439_703 },
    { name: 'Intergovernmental',                 total:   10_952_638 },
    { name: 'Licenses, fees, and permits',       total:       89_352 },
    { name: 'Earnings on investments',           total:       22_979 },
    { name: 'Sales and charges for services',    total:      100_409 },
    { name: 'Fines, forfeitures, and penalties', total:       24_999 },
    { name: 'Gaming',                            total:        6_131 },
    { name: 'Tobacco settlement',                total:      100_765 },
    { name: 'Other',                             total:      163_193 },
  ]},
  2015: { total: 23_630_630, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_469_062 },
    { name: 'Income taxes',                      total:    4_398_892 },
    { name: 'Tobacco taxes',                     total:       64_363 },
    { name: 'Property taxes',                    total:       41_646 },
    { name: 'Motor vehicle and fuel taxes',      total:        7_093 },
    { name: 'Other taxes',                       total:      465_805 },
    { name: 'Intergovernmental',                 total:   12_632_194 },
    { name: 'Licenses, fees, and permits',       total:       92_008 },
    { name: 'Earnings on investments',           total:       24_044 },
    { name: 'Sales and charges for services',    total:      100_375 },
    { name: 'Fines, forfeitures, and penalties', total:       16_780 },
    { name: 'Gaming',                            total:        6_372 },
    { name: 'Tobacco settlement',                total:       99_975 },
    { name: 'Other',                             total:      212_021 },
  ]},
  2016: { total: 24_458_233, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_609_439 },
    { name: 'Income taxes',                      total:    4_513_193 },
    { name: 'Tobacco taxes',                     total:       65_580 },
    { name: 'Property taxes',                    total:       40_115 },
    { name: 'Motor vehicle and fuel taxes',      total:        8_213 },
    { name: 'Other taxes',                       total:      537_215 },
    { name: 'Intergovernmental',                 total:   13_079_163 },
    { name: 'Licenses, fees, and permits',       total:      117_163 },
    { name: 'Earnings on investments',           total:       30_267 },
    { name: 'Sales and charges for services',    total:       88_975 },
    { name: 'Fines, forfeitures, and penalties', total:       22_918 },
    { name: 'Gaming',                            total:        6_408 },
    { name: 'Tobacco settlement',                total:       98_907 },
    { name: 'Other',                             total:      240_677 },
  ]},
  2017: { total: 25_266_987, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    5_855_752 },
    { name: 'Income taxes',                      total:    4_473_790 },
    { name: 'Tobacco taxes',                     total:       63_128 },
    { name: 'Property taxes',                    total:       36_433 },
    { name: 'Motor vehicle and fuel taxes',      total:        7_627 },
    { name: 'Other taxes',                       total:      544_762 },
    { name: 'Intergovernmental',                 total:   13_759_678 },
    { name: 'Licenses, fees, and permits',       total:      134_804 },
    { name: 'Earnings on investments',           total:       37_130 },
    { name: 'Sales and charges for services',    total:      125_645 },
    { name: 'Fines, forfeitures, and penalties', total:       29_140 },
    { name: 'Gaming',                            total:        6_483 },
    { name: 'Tobacco settlement',                total:      101_522 },
    { name: 'Other',                             total:       91_093 },
  ]},
  2018: { total: 26_314_462, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    6_242_647 },
    { name: 'Income taxes',                      total:    4_892_155 },
    { name: 'Tobacco taxes',                     total:       59_141 },
    { name: 'Property taxes',                    total:       42_100 },
    { name: 'Motor vehicle and fuel taxes',      total:       16_353 },
    { name: 'Other taxes',                       total:      545_656 },
    { name: 'Intergovernmental',                 total:   13_943_460 },
    { name: 'Licenses, fees, and permits',       total:      126_649 },
    { name: 'Earnings on investments',           total:       20_781 },
    { name: 'Sales and changes for services',    total:      124_237 },
    { name: 'Fines, forfeitures, and penalties', total:       42_915 },
    { name: 'Gaming',                            total:        6_790 },
    { name: 'Tobacco settlement',                total:      101_761 },
    { name: 'Other',                             total:      149_817 },
  ]},
  2019: { total: 28_224_222, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    6_660_976 },
    { name: 'Income taxes',                      total:    5_498_061 },
    { name: 'Tobacco taxes',                     total:       57_388 },
    { name: 'Property taxes',                    total:       31_911 },
    { name: 'Motor vehicle and fuel taxes',      total:       63_028 },
    { name: 'Other taxes',                       total:      585_896 },
    { name: 'Intergovernmental',                 total:   14_631_155 },
    { name: 'Licenses, fees, and permits',       total:      110_121 },
    { name: 'Earnings on investments',           total:      101_446 },
    { name: 'Sales and charges for services',    total:      124_519 },
    { name: 'Fines, forfeitures, and penalties', total:       20_837 },
    { name: 'Gaming',                            total:        7_097 },
    { name: 'Tobacco settlement',                total:       98_938 },
    { name: 'Other',                             total:      232_849 },
  ]},
  2020: { total: 31_059_778, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    7_067_479 },
    { name: 'Income taxes',                      total:    5_771_734 },
    { name: 'Tobacco taxes',                     total:       57_159 },
    { name: 'Property taxes',                    total:       25_706 },
    { name: 'Motor vehicle and fuel taxes',      total:       45_906 },
    { name: 'Other taxes',                       total:      578_215 },
    { name: 'Intergovernmental',                 total:   16_748_902 },
    { name: 'Licenses, fees, and permits',       total:      114_715 },
    { name: 'Earnings on investments',           total:       92_085 },
    { name: 'Sales and charges for services',    total:      128_840 },
    { name: 'Fines, forfeitures, and penalties', total:       17_510 },
    { name: 'Gaming',                            total:        6_138 },
    { name: 'Tobacco settlement',                total:       94_283 },
    { name: 'Other',                             total:      311_106 },
  ]},
  2021: { total: 38_265_404, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    8_292_609 },
    { name: 'Income taxes',                      total:    6_699_521 },
    { name: 'Tobacco taxes',                     total:       61_663 },
    { name: 'Property taxes',                    total:       25_272 },
    { name: 'Motor vehicle and fuel taxes',      total:       27_314 },
    { name: 'Other taxes',                       total:      658_382 },
    { name: 'Intergovernmental',                 total:   21_798_883 },
    { name: 'Licenses, fees, and permits',       total:      146_194 },
    { name: 'Earnings on investments',           total:       24_866 },
    { name: 'Sales and charges for services',    total:      115_026 },
    { name: 'Fines, forfeitures, and penalties', total:       20_662 },
    { name: 'Gaming',                            total:        8_880 },
    { name: 'Tobacco settlement',                total:      105_683 },
    { name: 'Other',                             total:      280_449 },
  ]},
  2022: { total: 46_641_561, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    9_543_469 },
    { name: 'Income taxes',                      total:    8_644_242 },
    { name: 'Tobacco taxes',                     total:       57_810 },
    { name: 'Property taxes',                    total:       29_251 },
    { name: 'Motor vehicle and fuel taxes',      total:       24_934 },
    { name: 'Other taxes',                       total:      755_580 },
    { name: 'Intergovernmental',                 total:   27_097_663 },
    { name: 'Licenses, fees, and permits',       total:      109_146 },
    { name: 'Earnings on investments',           total:      -16_230 },
    { name: 'Interest revenues - leases',        total:           10 },
    { name: 'Amortization revenues - leases',    total:           37 },
    { name: 'Sales and charges for services',    total:      119_578 },
    { name: 'Fines, forfeitures, and penalties', total:       20_140 },
    { name: 'Gaming',                            total:        8_868 },
    { name: 'Tobacco settlement',                total:      108_433 },
    { name: 'Other',                             total:      138_630 },
  ]},
  2023: { total: 45_352_600, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:    8_828_764 },
    { name: 'Income taxes',                      total:    7_014_085 },
    { name: 'Tobacco taxes',                     total:       49_519 },
    { name: 'Property taxes',                    total:       24_830 },
    { name: 'Motor vehicle and fuel taxes',      total:        4_656 },
    { name: 'Other taxes',                       total:      810_122 },
    { name: 'Intergovernmental',                 total:   27_642_420 },
    { name: 'Licenses, fees, and permits',       total:      140_075 },
    { name: 'Earnings on investments',           total:      408_528 },
    { name: 'Interest revenues - leases',        total:           20 },
    { name: 'Amortization revenues - leases',    total:           36 },
    { name: 'Sales and charges for services',    total:      130_840 },
    { name: 'Fines, forfeitures, and penalties', total:       96_156 },
    { name: 'Gaming',                            total:       11_027 },
    { name: 'Tobacco settlement',                total:       98_981 },
    { name: 'Other',                             total:       92_541 },
  ]},
  2024: { total: 44_045_434, confidence: 'actual', categories: [
    { name: 'Sales taxes',                       total:   10_386_641 },
    { name: 'Income taxes',                      total:    6_147_443 },
    { name: 'Tobacco taxes',                     total:       52_197 },
    { name: 'Property taxes',                    total:       28_329 },
    { name: 'Motor vehicle and fuel taxes',      total:        6_200 },
    { name: 'Other taxes',                       total:      850_390 },
    { name: 'Intergovernmental',                 total:   25_234_916 },
    { name: 'Licenses, fees, and permits',       total:      145_045 },
    { name: 'Earnings on investments',           total:      518_945 },
    { name: 'Amortization revenues - leases',    total:           37 },
    { name: 'Sales and charges for services',    total:      137_899 },
    { name: 'Fines, forfeitures, and penalties', total:       22_311 },
    { name: 'Gaming',                            total:       11_368 },
    { name: 'Tobacco settlement',                total:       88_273 },
    { name: 'Sweeps from component units',       total:      215_700 },
    { name: 'Other',                             total:      199_740 },
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
  return { jsonTree: [{ n: 'Arizona General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'Arizona General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'az-acfr-gf-revenue', base_url: 'https://gao.az.gov/financials/acfr', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
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
