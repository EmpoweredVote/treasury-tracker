#!/usr/bin/env node
/**
 * Arkansas General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Arkansas Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the AR state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   AR state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-34): AR ACFR GF ~3.96x NASBO GF (FY2024 $24,045,611K vs FY2024 NASBO
 *   $6,075,000K) -- the WIDEST scope divergence in the entire ACFR cohort to date. Arkansas is a
 *   SINGLE-fund state: the whole Governmental Fund statement IS the General Fund (no major/nonmajor
 *   split), so ~$11.2B of Intergovernmental/federal revenue sits inside the reported GF column that
 *   NASBO's narrower budgetary concept excludes. Accepted-and-relabelled honestly with a prominent basis note.
 *
 * SINGLE-FUND LAYOUT: title is "Statement of Revenues, Expenditures, and Changes in Fund Balance"
 *   (singular) over "Governmental Fund" (singular); GENERAL FUND is the sole column. extract_gf.py
 *   gained singular-fund detection + space-tolerant section headers (some AR years letter-space
 *   "Re ve nue s :") -- reusable generalizations.
 *
 * HONEST HOLE (FY2025): 2025-Arkansas-ACFR.pdf is a valid ~49MB PDF but Type-3-font garbled (no
 *   ToUnicode CMap, pdftotext unreadable, KY FY2023 precedent) -> NOT loaded. Window ends FY2024;
 *   re-check for a corrected upload / browser-OCR at a future touch.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Investment earnings (loss) positive at both bookends (FY2024 +$442,735K, FY2003 +$46,139K); every loaded year scanned - clamp is the render path if any interior year goes negative.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ar/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processARAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Arkansas'; const STATE_ABBR = 'AR'; const POPULATION = 3_011_524;
const EXPECTED_MUNI_ID = '5efd2f95-6deb-4118-a07a-9f48cdca681c';
const UNITS = 1_000; // AR ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2003: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2003.pdf', date: '2003-06-30' },
  2004: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2004.pdf', date: '2004-06-30' },
  2005: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2005.pdf', date: '2005-06-30' },
  2006: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2024.pdf', date: '2024-06-30' },
};
const dataSource = (fy) => `Arkansas State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — AR ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2003: { total: 9_017_879, confidence: 'actual', categories: [
    { name: 'Education',                            total:    2_324_631 },
    { name: 'Health and human services',            total:    3_772_155 },
    { name: 'Transportation',                       total:      346_282 },
    { name: 'Law, justice, and public safety',      total:      416_353 },
    { name: 'Recreation and resources development', total:      221_987 },
    { name: 'General government',                   total:    1_044_164 },
    { name: 'Labor, commerce and regulatory',       total:      108_378 },
    { name: 'Debt service — Principal retirement',  total:       40_066 },
    { name: 'Debt service — Interest Expense',      total:       50_341 },
    { name: 'Bond issuance costs',                  total:          624 },
    { name: 'Capital outlay',                       total:      692_898 },
  ]},
  2004: { total: 9_376_679, confidence: 'actual', categories: [
    { name: 'Education',                                total:    2_336_813 },
    { name: 'Health and human services',                total:    4_065_745 },
    { name: 'Transportation',                           total:      312_688 },
    { name: 'Law, justice, and public safety',          total:      496_109 },
    { name: 'Recreation and resources development',     total:      159_895 },
    { name: 'General government',                       total:    1_029_316 },
    { name: 'Regulation of business and professionals', total:      125_968 },
    { name: 'Debt service — Principal retirement',      total:       36_809 },
    { name: 'Debt service — Interest expense',          total:       56_769 },
    { name: 'Bond issuance costs',                      total:        1_194 },
    { name: 'Capital outlay',                           total:      755_373 },
  ]},
  2005: { total: 10_348_606, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_058_514 },
    { name: 'Education',                                total:    2_877_770 },
    { name: 'Health and human services',                total:    4_526_132 },
    { name: 'Transportation',                           total:      319_140 },
    { name: 'Law, justice, and public safety',          total:      480_246 },
    { name: 'Recreation and resources development',     total:      159_709 },
    { name: 'Regulation of business and professionals', total:      114_484 },
    { name: 'Debt service — Principal retirement',      total:       46_723 },
    { name: 'Debt service — Interest expense',          total:       58_866 },
    { name: 'Bond issuance costs',                      total:        2_905 },
    { name: 'Capital outlay',                           total:      704_117 },
  ]},
  2006: { total: 10_870_071, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_137_458 },
    { name: 'Education',                                total:    3_044_735 },
    { name: 'Health and human services',                total:    4_653_553 },
    { name: 'Transportation',                           total:      320_417 },
    { name: 'Law, justice, and public safety',          total:      582_086 },
    { name: 'Recreation and resources development',     total:      186_137 },
    { name: 'Regulation of business and professionals', total:      112_595 },
    { name: 'Debt service — Principal retirement',      total:       97_583 },
    { name: 'Debt service — Interest',                  total:       61_065 },
    { name: 'Bond issuance costs',                      total:          818 },
    { name: 'Capital outlay',                           total:      673_624 },
  ]},
  2007: { total: 11_135_487, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_213_597 },
    { name: 'Education',                                total:    3_149_468 },
    { name: 'Health and human services',                total:    4_844_657 },
    { name: 'Transportation',                           total:      297_816 },
    { name: 'Law, justice, and public safety',          total:      552_728 },
    { name: 'Recreation and resources development',     total:      187_970 },
    { name: 'Regulation of business and professionals', total:      112_833 },
    { name: 'Debt service — Principal retirement',      total:      103_782 },
    { name: 'Debt service — Interest',                  total:       59_752 },
    { name: 'Bond issuance costs',                      total:        1_317 },
    { name: 'Capital outlay',                           total:      611_567 },
  ]},
  2008: { total: 11_740_656, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_190_857 },
    { name: 'Education',                                total:    3_286_143 },
    { name: 'Health and human services',                total:    5_184_858 },
    { name: 'Transportation',                           total:      338_062 },
    { name: 'Law, justice, and public safety',          total:      606_633 },
    { name: 'Recreation and resources development',     total:      228_663 },
    { name: 'Regulation of business and professionals', total:      109_818 },
    { name: 'Debt service — Principal retirement',      total:      107_070 },
    { name: 'Debt service — Interest',                  total:       59_671 },
    { name: 'Bond issuance costs',                      total:          345 },
    { name: 'Capital outlay',                           total:      628_536 },
  ]},
  2009: { total: 12_159_384, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_190_436 },
    { name: 'Education',                                total:    3_333_875 },
    { name: 'Health and human services',                total:    5_441_822 },
    { name: 'Transportation',                           total:      348_665 },
    { name: 'Law, justice and public safety',           total:      794_793 },
    { name: 'Recreation and resources development',     total:      225_461 },
    { name: 'Regulation of business and professionals', total:      105_752 },
    { name: 'Debt service — Principal retirement',      total:      101_054 },
    { name: 'Debt service — Interest',                  total:       55_766 },
    { name: 'Bond issuance costs',                      total:          406 },
    { name: 'Capital outlay',                           total:      561_354 },
  ]},
  2010: { total: 13_213_284, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_237_895 },
    { name: 'Education',                                total:    3_600_560 },
    { name: 'Health and human services',                total:    6_129_257 },
    { name: 'Transportation',                           total:      365_980 },
    { name: 'Law, justice and public safety',           total:      747_379 },
    { name: 'Recreation and resources development',     total:      258_322 },
    { name: 'Regulation of business and professionals', total:      108_748 },
    { name: 'Debt service — Principal retirement',      total:       95_924 },
    { name: 'Debt service — Interest',                  total:       53_303 },
    { name: 'Bond issuance costs',                      total:        1_675 },
    { name: 'Capital outlay',                           total:      614_241 },
  ]},
  2011: { total: 14_034_917, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_367_985 },
    { name: 'Education',                                total:    3_764_814 },
    { name: 'Health and human services',                total:    6_401_101 },
    { name: 'Transportation',                           total:      391_019 },
    { name: 'Law, justice and public safety',           total:      719_401 },
    { name: 'Recreation and resources development',     total:      330_301 },
    { name: 'Regulation of business and professionals', total:      119_058 },
    { name: 'Debt service — Principal retirement',      total:      204_701 },
    { name: 'Debt service — Interest',                  total:       52_665 },
    { name: 'Capital outlay',                           total:      683_872 },
  ]},
  2012: { total: 14_146_911, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_426_718 },
    { name: 'Education',                                total:    3_644_195 },
    { name: 'Health and human services',                total:    6_696_046 },
    { name: 'Transportation',                           total:      379_278 },
    { name: 'Law, justice and public safety',           total:      763_725 },
    { name: 'Recreation and resources development',     total:      246_158 },
    { name: 'Regulation of business and professionals', total:      117_450 },
    { name: 'Debt service — Principal retirement',      total:       83_111 },
    { name: 'Debt service — Interest',                  total:       44_865 },
    { name: 'Bond issuance costs',                      total:        1_365 },
    { name: 'Capital outlay',                           total:      744_000 },
  ]},
  2013: { total: 14_154_278, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_410_902 },
    { name: 'Education',                                total:    3_583_254 },
    { name: 'Health and human services',                total:    6_761_841 },
    { name: 'Transportation',                           total:      422_153 },
    { name: 'Law, justice and public safety',           total:      718_798 },
    { name: 'Recreation and resources development',     total:      238_143 },
    { name: 'Regulation of business and professionals', total:      120_715 },
    { name: 'Debt service — Principal retirement',      total:      125_590 },
    { name: 'Debt service — Interest',                  total:       46_206 },
    { name: 'Bond issuance costs',                      total:        1_231 },
    { name: 'Capital outlay',                           total:      725_445 },
  ]},
  2014: { total: 14_958_973, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_537_466 },
    { name: 'Education',                                total:    3_588_822 },
    { name: 'Health and human services',                total:    7_195_414 },
    { name: 'Transportation',                           total:      455_070 },
    { name: 'Law, justice and public safety',           total:      766_498 },
    { name: 'Recreation and resources development',     total:      265_133 },
    { name: 'Regulation of business and professionals', total:      145_026 },
    { name: 'Debt service — Principal retirement',      total:      124_425 },
    { name: 'Debt service — Interest',                  total:       63_393 },
    { name: 'Bond issuance costs',                      total:           33 },
    { name: 'Capital outlay',                           total:      817_693 },
  ]},
  2015: { total: 16_182_838, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_535_963 },
    { name: 'Education',                                total:    3_676_561 },
    { name: 'Health and human services',                total:    8_162_633 },
    { name: 'Transportation',                           total:      508_716 },
    { name: 'Law, justice and public safety',           total:      768_521 },
    { name: 'Recreation and resources development',     total:      264_169 },
    { name: 'Regulation of business and professionals', total:      128_769 },
    { name: 'Debt service — Principal retirement',      total:      165_416 },
    { name: 'Debt service — Interest',                  total:       71_526 },
    { name: 'Bond issuance costs',                      total:        1_062 },
    { name: 'Capital outlay',                           total:      899_502 },
  ]},
  2016: { total: 16_398_766, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_468_346 },
    { name: 'Education',                                total:    3_715_057 },
    { name: 'Health and human services',                total:    8_458_304 },
    { name: 'Transportation',                           total:      521_237 },
    { name: 'Law, justice and public safety',           total:      796_987 },
    { name: 'Recreation and resources development',     total:      255_074 },
    { name: 'Regulation of business and professionals', total:      131_865 },
    { name: 'Debt service — Principal retirement',      total:       99_689 },
    { name: 'Debt service — Interest',                  total:       76_631 },
    { name: 'Bond issuance costs',                      total:           63 },
    { name: 'Capital outlay',                           total:      875_513 },
  ]},
  2017: { total: 17_290_490, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_446_481 },
    { name: 'Education',                                total:    3_748_403 },
    { name: 'Health and human services',                total:    8_930_024 },
    { name: 'Transportation',                           total:      680_353 },
    { name: 'Law, justice and public safety',           total:      789_376 },
    { name: 'Recreation and resources development',     total:      257_494 },
    { name: 'Regulation of business and professionals', total:      125_232 },
    { name: 'Debt service — Principal retirement',      total:      102_397 },
    { name: 'Debt service — Interest',                  total:       77_568 },
    { name: 'Bond issuance costs',                      total:           63 },
    { name: 'Capital outlay',                           total:    1_133_099 },
  ]},
  2018: { total: 17_175_826, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_536_902 },
    { name: 'Education',                                total:    3_752_555 },
    { name: 'Health and human services',                total:    8_834_154 },
    { name: 'Transportation',                           total:      493_272 },
    { name: 'Law, justice and public safety',           total:      814_586 },
    { name: 'Recreation and resources development',     total:      265_003 },
    { name: 'Regulation of business and professionals', total:      119_428 },
    { name: 'Debt service — Principal retirement',      total:      155_947 },
    { name: 'Debt service — Interest',                  total:       67_455 },
    { name: 'Capital outlay',                           total:    1_136_524 },
  ]},
  2019: { total: 17_238_444, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_539_201 },
    { name: 'Education',                                total:    3_762_150 },
    { name: 'Health and human services',                total:    9_239_216 },
    { name: 'Transportation',                           total:      457_534 },
    { name: 'Law, justice and public safety',           total:      852_412 },
    { name: 'Recreation and resources development',     total:      259_939 },
    { name: 'Regulation of business and professionals', total:      124_385 },
    { name: 'Debt service — Principal retirement',      total:      116_756 },
    { name: 'Debt service — Interest',                  total:       63_846 },
    { name: 'Capital outlay',                           total:      823_005 },
  ]},
  2020: { total: 18_083_907, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_457_416 },
    { name: 'Education',                                total:    3_732_911 },
    { name: 'Health and human services',                total:    9_530_819 },
    { name: 'Transportation',                           total:      517_988 },
    { name: 'Law, justice and public safety',           total:      873_435 },
    { name: 'Recreation and tourism',                   total:      182_273 },
    { name: 'Regulation of business and professionals', total:       24_869 },
    { name: 'Resource development',                     total:      141_455 },
    { name: 'Commerce',                                 total:      441_429 },
    { name: 'Debt service — Principal retirement',      total:      176_063 },
    { name: 'Debt service — Interest',                  total:       60_754 },
    { name: 'Bond issuance costs',                      total:           93 },
    { name: 'Capital outlay',                           total:      944_402 },
  ]},
  2021: { total: 20_557_148, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_642_741 },
    { name: 'Education',                                total:    4_177_850 },
    { name: 'Health and human services',                total:   10_740_086 },
    { name: 'Transportation',                           total:      731_333 },
    { name: 'Law, justice and public safety',           total:      935_489 },
    { name: 'Recreation and tourism',                   total:      181_550 },
    { name: 'Regulation of business and professionals', total:       24_008 },
    { name: 'Resource development',                     total:      165_593 },
    { name: 'Commerce',                                 total:      554_912 },
    { name: 'Debt service — Principal retirement',      total:      240_662 },
    { name: 'Debt service — Interest',                  total:       56_288 },
    { name: 'Capital outlay',                           total:    1_106_636 },
  ]},
  2022: { total: 22_390_660, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_580_566 },
    { name: 'Education',                                total:    4_638_723 },
    { name: 'Health and human services',                total:   11_968_473 },
    { name: 'Transportation',                           total:      784_338 },
    { name: 'Law, justice and public safety',           total:      988_209 },
    { name: 'Recreation and tourism',                   total:      198_020 },
    { name: 'Regulation of business and professionals', total:       26_529 },
    { name: 'Resource development',                     total:      204_352 },
    { name: 'Commerce',                                 total:      560_389 },
    { name: 'Debt service — Principal retirement',      total:      246_871 },
    { name: 'Debt service — Interest',                  total:       54_735 },
    { name: 'Capital outlay',                           total:    1_139_455 },
  ]},
  2023: { total: 22_856_229, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_635_355 },
    { name: 'Education',                                total:    4_604_347 },
    { name: 'Health and human services',                total:   12_389_117 },
    { name: 'Transportation',                           total:      760_392 },
    { name: 'Law, justice, and public safety',          total:    1_036_743 },
    { name: 'Recreation and tourism',                   total:      229_063 },
    { name: 'Regulation of business and professionals', total:       27_602 },
    { name: 'Resource development',                     total:      232_005 },
    { name: 'Commerce',                                 total:      411_949 },
    { name: 'Debt service — Principal retirement',      total:      246_451 },
    { name: 'Debt service — Interest',                  total:       43_888 },
    { name: 'Capital outlay',                           total:    1_239_317 },
  ]},
  2024: { total: 22_159_960, confidence: 'actual', categories: [
    { name: 'General government',                       total:    1_646_752 },
    { name: 'Education',                                total:    4_912_965 },
    { name: 'Health and human services',                total:   10_915_820 },
    { name: 'Transportation',                           total:      847_497 },
    { name: 'Law, justice, and public safety',          total:    1_216_678 },
    { name: 'Recreation and tourism',                   total:      241_563 },
    { name: 'Regulation of business and professionals', total:       28_372 },
    { name: 'Resource development',                     total:      277_527 },
    { name: 'Commerce',                                 total:      464_656 },
    { name: 'Debt service — Principal retirement',      total:      121_242 },
    { name: 'Debt service — Interest',                  total:       38_144 },
    { name: 'Capital outlay',                           total:    1_448_744 },
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
  return { jsonTree: [{ n: 'Arkansas General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Arkansas General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ar-acfr-gf-operating', base_url: 'https://www.dfa.arkansas.gov/office/accounting/annual-comprehensive-financial-report/', fiscal_years: [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
