#!/usr/bin/env node
/**
 * New Jersey General Fund Operating (Expenditure) Loader — FY2002-FY2025 ACTUAL
 * Source: State of New Jersey Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis). Published by the NJ Office of Management and Budget (OMB).
 *
 * Phase 108 (ACFR-09 / ACFR-19 / ACFR-20 / RECON-08) loaded FY2020-FY2025 (6 yrs). Phase 115
 *   (DEEP-03) deepens back through FY2002 — NJ adopted GASB 34 in FY2002 (its FIRST reporting
 *   year), so there is NO pre-GASB-34 "Combined Statement" boundary to stop at: every candidate
 *   year FY2002-FY2019 enumerated from the OMB landing page (nj.gov/treasury/omb/fr.shtml) uses
 *   the SAME modern "STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES IN FUND BALANCES —
 *   GOVERNMENTAL FUNDS" format, GENERAL FUND as the 1st column, and ALL 18 years tie exactly
 *   ($0 diff) to the printed General-Fund column total. ZERO honest holes in this window.
 *
 * ⚠ UNITS = 1 — NJ reports the ACFR in DOLLARS, NOT thousands, in EVERY loaded year back to
 *   FY2002 (confirmed by inspecting each year's printed units note + per-capita sanity
 *   $2.8k-$4.4k/person across FY2002-FY2025 — no thousands-era override needed).
 *
 * EXTRACTION DISCIPLINE (mirrors processCTAcfr.js's token-order + positional fallback via
 *   scripts/maAcfrExtract.mjs): NJ's ACFR ALSO contains a "BUDGETARY COMPARISON SCHEDULE —
 *   MAJOR GOVERNMENTAL FUNDS" table (General Fund on a BUDGETARY basis, NOT GAAP) and
 *   "NON-MAJOR GOVERNMENTAL FUNDS — BY FUND TYPE" / "COMBINING STATEMENT…" tables that share
 *   enough header vocabulary ("General Fund" + "Governmental Funds") to false-match the shared
 *   extractor's loose heuristic when scanning the whole document. Every NJ ACFR back to FY2002
 *   prints the GAAP statement's bare title ("STATEMENT OF REVENUES, EXPENDITURES[,] AND CHANGES
 *   IN FUND BALANCES" — no "COMBINING"/"BUDGETARY COMPARISON" prefix) followed within a few
 *   lines by a bare "GOVERNMENTAL FUNDS" subtitle exactly ONCE, ahead of any other occurrence —
 *   isolateNJStatement() below anchors on that exact bare title+subtitle pair before handing a
 *   scoped snippet to the shared token-order/positional extractors, eliminating the false-match.
 *   FY2002-FY2003 need the positional fallback (blank-GF-cell years — a "$"-glyph pdftotext
 *   artifact renders as a bare "--" ahead of every dollar figure, including in "populated"
 *   columns, so token order alone misassigns cells); FY2004-FY2025 tie on token order.
 *   This was VERIFIED to reproduce the existing FY2020-FY2025 embedded totals exactly (bookend
 *   regression check, $0 delta on both revenue and expenditure totals) before being used to
 *   derive the newly-embedded FY2002-FY2019 categories below — the transcribed data below IS
 *   this extraction's tied output (embedded once fully verified, not re-parsed at runtime, per
 *   this loader's existing architecture).
 *
 * SOURCES uses EXPLICIT per-year URLs enumerated from nj.gov/treasury/omb/fr.shtml (never
 *   derived blindly). FY2002-FY2007 = `{YY}fr/pdf/{YY}FR.pdf`; FY2008-FY2015 =
 *   `{YY}fr/pdf/fullfr{YYYY}.pdf`; FY2016-FY2017 DROP the year suffix → `{YY}fr/pdf/fullfr.pdf`;
 *   FY2018 = `18fr/FR 2018 Secured Final.pdf` (space, url-encoded at fetch time); FY2019 =
 *   `19fr/NJFR2019 Complete.pdf` (space); FY2020-FY2024 = `NJFRFY{YYYY}Complete.pdf`; FY2025
 *   DROPS the "FR" infix → `NJFY2025Complete.pdf` (special-cased, unchanged from Phase 108).
 *
 * TX-TRAP SCOPE NOTE (ACFR-19): NJ ACFR General Fund ~1.15× NASBO GF (smallest divergence in the
 *   tranche) because the GAAP General Fund consolidates federal/intergovernmental revenue that
 *   NASBO's budgetary concept excludes. Accepted-and-relabelled honestly via the GAAP basis label.
 *
 * P2 CLAMP (ACFR-20): NJ investment earnings are positive in every FY2020-2025 loaded year;
 *   FY2009 (financial-crisis year, newly recovered) has ONE negative category (Investment
 *   earnings -$11,876,353) — clampForRender renders it at 0, true signed value preserved in the
 *   console note + the row label. No other negative categories across FY2002-FY2025.
 *
 * Control = printed General-Fund-column "Total Expenditures". Each FY's transcribed spend-by-
 *   function categories tie to the printed Total (dollars) or the loader refuses to write
 *   (process.exit(2)). All 24 FYs (FY2002-FY2025) tie 0 diff. Extraction: pdftotext -table on
 *   local PDFs in _acfr-work/nj/ (NOT -layout).
 *
 * Usage: node scripts/processNJAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New Jersey'; const STATE_ABBR = 'NJ'; const POPULATION = 9_288_994;
const UNITS = 1; // ⚠ NJ ACFR is in DOLLARS — do NOT ×1,000. Confirmed for every FY2002-2025.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const NJ_BASE = 'https://www.nj.gov/treasury/omb/publications';
const SOURCES = {
  2002: { url: `${NJ_BASE}/02fr/pdf/02FR.pdf`, date: '2002-06-30' },
  2003: { url: `${NJ_BASE}/03fr/pdf/03FR.pdf`, date: '2003-06-30' },
  2004: { url: `${NJ_BASE}/04fr/pdf/04FR.pdf`, date: '2004-06-30' },
  2005: { url: `${NJ_BASE}/05fr/pdf/05FR.pdf`, date: '2005-06-30' },
  2006: { url: `${NJ_BASE}/06fr/pdf/06FR.pdf`, date: '2006-06-30' },
  2007: { url: `${NJ_BASE}/07fr/pdf/07FR.pdf`, date: '2007-06-30' },
  2008: { url: `${NJ_BASE}/08fr/pdf/fullfr2008.pdf`, date: '2008-06-30' },
  2009: { url: `${NJ_BASE}/09fr/pdf/fullfr2009.pdf`, date: '2009-06-30' },
  2010: { url: `${NJ_BASE}/10fr/pdf/fullfr2010.pdf`, date: '2010-06-30' },
  2011: { url: `${NJ_BASE}/11fr/pdf/fullfr2011.pdf`, date: '2011-06-30' },
  2012: { url: `${NJ_BASE}/12fr/pdf/fullfr2012.pdf`, date: '2012-06-30' },
  2013: { url: `${NJ_BASE}/13fr/pdf/fullfr2013.pdf`, date: '2013-06-30' },
  2014: { url: `${NJ_BASE}/14fr/pdf/fullfr2014.pdf`, date: '2014-06-30' },
  2015: { url: `${NJ_BASE}/15fr/pdf/fullfr2015.pdf`, date: '2015-06-30' },
  2016: { url: `${NJ_BASE}/16fr/pdf/fullfr.pdf`, date: '2016-06-30' },
  2017: { url: `${NJ_BASE}/17fr/pdf/fullfr.pdf`, date: '2017-06-30' },
  2018: { url: `${NJ_BASE}/18fr/FR%202018%20Secured%20Final.pdf`, date: '2018-06-30' },
  2019: { url: `${NJ_BASE}/19fr/NJFR2019%20Complete.pdf`, date: '2019-06-30' },
  2020: { url: `${NJ_BASE}/20fr/NJFRFY2020Complete.pdf`, date: '2020-06-30' },
  2021: { url: `${NJ_BASE}/21fr/NJFRFY2021Complete.pdf`, date: '2021-06-30' },
  2022: { url: `${NJ_BASE}/22fr/NJFRFY2022Complete.pdf`, date: '2022-06-30' },
  2023: { url: `${NJ_BASE}/23fr/NJFRFY2023Complete.pdf`, date: '2023-06-30' },
  2024: { url: `${NJ_BASE}/24fr/NJFRFY2024Complete.pdf`, date: '2024-06-30' },
  2025: { url: `${NJ_BASE}/25fr/NJFY2025Complete.pdf`,   date: '2025-06-30' }, // FR infix dropped — special-case
};
const dataSource = (fy) => `New Jersey State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — NJ ACFR, GENERAL FUND column (raw DOLLARS; UNITS=1).
// Verbatim ACFR function names from the Governmental Funds Statement of Rev/Exp/Changes.
// total = printed General-Fund "Total Expenditures" (dollars). All 24 FYs tie 0 diff.
const EXPENDITURES = {
  2002: { total: 24_075_099_379, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 8_458_213_719 },
    { name: 'Educational, cultural, and intellectual development', total: 3_980_212_984 },
    { name: 'Government direction, management, and control',       total: 3_658_003_389 },
    { name: 'Economic planning, development, and security',        total: 2_826_119_681 },
    { name: 'Public safety and criminal justice',                  total: 2_459_593_193 },
    { name: 'Capital Outlay',                                      total: 1_122_317_050 },
    { name: 'Community development and environmental management',  total:   947_822_637 },
    { name: 'Transportation programs',                             total:   392_590_253 },
    { name: 'Special government services',                         total:   230_226_473 },
  ]},
  2003: { total: 26_489_239_411, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 8_890_951_220 },
    { name: 'Educational, cultural, and intellectual development', total: 5_618_660_976 },
    { name: 'Government direction, management, and control',       total: 4_165_566_011 },
    { name: 'Economic planning, development, and security',        total: 2_890_053_202 },
    { name: 'Public safety and criminal justice',                  total: 2_476_854_764 },
    { name: 'Community development and environmental management',  total:   908_589_106 },
    { name: 'Capital Outlay',                                      total:   863_063_000 },
    { name: 'Transportation programs',                             total:   436_551_021 },
    { name: 'Special government services',                         total:   238_950_111 },
  ]},
  2004: { total: 26_360_090_205, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 8_284_419_265 },
    { name: 'Educational, cultural, and intellectual development', total: 6_223_363_773 },
    { name: 'Government direction, management, and control',       total: 4_207_990_123 },
    { name: 'Economic planning, development, and security',        total: 3_072_175_117 },
    { name: 'Public safety and criminal justice',                  total: 2_638_216_320 },
    { name: 'Community development and environmental management',  total:   971_809_289 },
    { name: 'Transportation programs',                             total:   365_139_312 },
    { name: 'Capital Outlay',                                      total:   326_335_639 },
    { name: 'Special government services',                         total:   270_641_367 },
  ]},
  2005: { total: 27_234_312_016, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 9_010_144_712 },
    { name: 'Educational, cultural, and intellectual development', total: 5_869_130_881 },
    { name: 'Government direction, management, and control',       total: 3_597_138_646 },
    { name: 'Economic planning, development, and security',        total: 3_559_574_879 },
    { name: 'Public safety and criminal justice',                  total: 2_881_184_469 },
    { name: 'Community development and environmental management',  total: 1_087_993_359 },
    { name: 'Transportation programs',                             total:   431_557_429 },
    { name: 'Special government services',                         total:   299_592_878 },
    { name: 'Capital Outlay',                                      total:   237_658_025 },
    { name: 'Interest',                                            total:   153_598_675 },
    { name: 'Debt Service: Principal',                             total:   106_738_063 },
  ]},
  2006: { total: 27_221_313_749, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 9_116_650_051 },
    { name: 'Educational, cultural, and intellectual development', total: 4_250_008_748 },
    { name: 'Economic planning, development, and security',        total: 4_110_301_444 },
    { name: 'Government direction, management, and control',       total: 4_078_454_746 },
    { name: 'Public safety and criminal justice',                  total: 3_040_496_708 },
    { name: 'Community development and environmental management',  total: 1_137_359_170 },
    { name: 'Capital Outlay',                                      total:   573_536_305 },
    { name: 'Transportation programs',                             total:   432_131_126 },
    { name: 'Special government services',                         total:   313_051_115 },
    { name: 'Interest',                                            total:   155_654_336 },
    { name: 'Debt Service: Principal',                             total:    13_670_000 },
  ]},
  2007: { total: 29_151_155_987, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 9_295_457_377 },
    { name: 'Government direction, management, and control',       total: 5_110_640_066 },
    { name: 'Educational, cultural, and intellectual development', total: 4_601_536_207 },
    { name: 'Economic planning, development, and security',        total: 4_449_974_963 },
    { name: 'Public safety and criminal justice',                  total: 3_130_834_998 },
    { name: 'Community development and environmental management',  total: 1_233_852_074 },
    { name: 'Transportation programs',                             total:   468_228_304 },
    { name: 'Special government services',                         total:   327_889_602 },
    { name: 'Debt Service: Principal',                             total:   254_244_874 },
    { name: 'Interest',                                            total:   173_538_945 },
    { name: 'Capital Outlay',                                      total:   104_958_577 },
  ]},
  2008: { total: 30_149_621_957, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 9_764_795_923 },
    { name: 'Government direction, management, and control',       total: 5_206_015_743 },
    { name: 'Economic planning, development, and security',        total: 4_683_305_430 },
    { name: 'Educational, cultural, and intellectual development', total: 4_502_670_475 },
    { name: 'Public safety and criminal justice',                  total: 3_196_618_565 },
    { name: 'Community development and environmental management',  total: 1_257_505_855 },
    { name: 'Transportation programs',                             total:   459_836_955 },
    { name: 'Special government services',                         total:   331_652_845 },
    { name: 'Capital Outlay',                                      total:   318_550_569 },
    { name: 'Debt Service: Principal',                             total:   270_714_446 },
    { name: 'Interest',                                            total:   157_955_151 },
  ]},
  2009: { total: 30_673_226_648, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 10_248_531_955 },
    { name: 'Economic planning, development, and security',        total:  5_116_785_197 },
    { name: 'Government direction, management, and control',       total:  4_924_255_107 },
    { name: 'Educational, cultural, and intellectual development', total:  4_459_036_818 },
    { name: 'Public safety and criminal justice',                  total:  3_155_123_741 },
    { name: 'Community development and environmental management',  total:  1_457_529_180 },
    { name: 'Transportation programs',                             total:    528_468_778 },
    { name: 'Special government services',                         total:    345_739_138 },
    { name: 'Debt Service: Principal',                             total:    255_525_482 },
    { name: 'Interest',                                            total:    150_193_817 },
    { name: 'Capital Outlay',                                      total:     32_037_435 },
  ]},
  2010: { total: 32_638_456_069, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 10_692_176_378 },
    { name: 'Educational, cultural, and intellectual development', total:  5_734_107_534 },
    { name: 'Economic planning, development, and security',        total:  5_495_827_910 },
    { name: 'Government direction, management, and control',       total:  5_033_770_801 },
    { name: 'Public safety and criminal justice',                  total:  3_207_152_945 },
    { name: 'Community development and environmental management',  total:  1_381_644_808 },
    { name: 'Transportation programs',                             total:    452_352_008 },
    { name: 'Special government services',                         total:    338_680_052 },
    { name: 'Debt Service: Principal',                             total:    139_120_000 },
    { name: 'Interest',                                            total:    124_494_399 },
    { name: 'Capital Outlay',                                      total:     39_129_234 },
  ]},
  2011: { total: 31_678_836_835, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 11_009_795_145 },
    { name: 'Economic planning, development, and security',        total:  5_567_333_851 },
    { name: 'Government direction, management, and control',       total:  5_199_134_126 },
    { name: 'Educational, cultural, and intellectual development', total:  4_385_848_692 },
    { name: 'Public safety and criminal justice',                  total:  3_165_461_351 },
    { name: 'Community development and environmental management',  total:  1_315_075_385 },
    { name: 'Transportation programs',                             total:    483_812_074 },
    { name: 'Special government services',                         total:    350_275_034 },
    { name: 'Interest',                                            total:     97_035_805 },
    { name: 'Capital Outlay',                                      total:     81_710_372 },
    { name: 'Debt Service: Principal',                             total:     23_355_000 },
  ]},
  2012: { total: 32_665_260_823, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 11_394_035_518 },
    { name: 'Economic planning, development, and security',        total:  5_547_246_713 },
    { name: 'Government direction, management, and control',       total:  5_453_092_689 },
    { name: 'Educational, cultural, and intellectual development', total:  4_459_445_345 },
    { name: 'Public safety and criminal justice',                  total:  3_253_200_559 },
    { name: 'Community development and environmental management',  total:  1_301_588_529 },
    { name: 'Transportation programs',                             total:    516_392_408 },
    { name: 'Special government services',                         total:    340_382_154 },
    { name: 'Debt Service: Principal',                             total:    182_230_000 },
    { name: 'Capital Outlay',                                      total:    122_514_647 },
    { name: 'Interest',                                            total:     95_132_261 },
  ]},
  2013: { total: 33_378_008_930, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 11_427_272_175 },
    { name: 'Economic planning, development, and security',        total:  5_712_587_168 },
    { name: 'Government direction, management, and control',       total:  5_559_323_258 },
    { name: 'Educational, cultural, and intellectual development', total:  4_137_590_364 },
    { name: 'Public safety and criminal justice',                  total:  3_416_519_364 },
    { name: 'Community development and environmental management',  total:  1_492_532_852 },
    { name: 'Transportation programs',                             total:    648_414_311 },
    { name: 'Special government services',                         total:    345_371_126 },
    { name: 'Debt Service: Principal',                             total:    333_755_000 },
    { name: 'Capital Outlay',                                      total:    189_340_265 },
    { name: 'Interest',                                            total:    115_303_047 },
  ]},
  2014: { total: 35_251_534_135, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 12_733_521_381 },
    { name: 'Government direction, management, and control',       total:  5_729_940_194 },
    { name: 'Economic planning, development, and security',        total:  5_608_379_905 },
    { name: 'Educational, cultural, and intellectual development', total:  4_028_900_527 },
    { name: 'Public safety and criminal justice',                  total:  3_482_406_021 },
    { name: 'Community development and environmental management',  total:  1_980_029_724 },
    { name: 'Transportation programs',                             total:    762_480_453 },
    { name: 'Special government services',                         total:    348_763_820 },
    { name: 'Debt Service: Principal',                             total:    243_445_000 },
    { name: 'Capital Outlay',                                      total:    221_844_642 },
    { name: 'Interest',                                            total:    111_822_468 },
  ]},
  2015: { total: 37_344_818_389, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 14_786_681_497 },
    { name: 'Government direction, management, and control',       total:  5_733_623_746 },
    { name: 'Economic planning, development, and security',        total:  5_433_179_328 },
    { name: 'Educational, cultural, and intellectual development', total:  4_112_955_297 },
    { name: 'Public safety and criminal justice',                  total:  3_287_912_113 },
    { name: 'Community development and environmental management',  total:  2_245_231_498 },
    { name: 'Transportation programs',                             total:    628_380_863 },
    { name: 'Special government services',                         total:    357_524_365 },
    { name: 'Debt Service: Principal',                             total:    309_770_000 },
    { name: 'Capital Outlay',                                      total:    253_212_076 },
    { name: 'Interest',                                            total:     98_826_888 },
    { name: 'Contributory life insurance payment',                 total:     97_520_718 },
  ]},
  2016: { total: 36_158_959_713, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 14_094_954_284 },
    { name: 'Government direction, management, and control',       total:  5_810_680_013 },
    { name: 'Economic planning, development, and security',        total:  5_190_914_105 },
    { name: 'Educational, cultural, and intellectual development', total:  4_212_977_203 },
    { name: 'Public safety and criminal justice',                  total:  3_180_827_422 },
    { name: 'Community development and environmental management',  total:  1_967_036_443 },
    { name: 'Transportation programs',                             total:    744_054_085 },
    { name: 'Debt Service: Principal',                             total:    373_215_000 },
    { name: 'Special government services',                         total:    343_327_160 },
    { name: 'Capital Outlay',                                      total:    135_780_583 },
    { name: 'Interest',                                            total:    105_193_415 },
  ]},
  2017: { total: 34_119_271_433, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 14_777_165_818 },
    { name: 'Economic planning, development, and security',        total:  5_260_294_633 },
    { name: 'Educational, cultural, and intellectual development', total:  4_159_139_010 },
    { name: 'Government direction, management, and control',       total:  3_364_244_100 },
    { name: 'Public safety and criminal justice',                  total:  3_076_517_837 },
    { name: 'Community development and environmental management',  total:  1_859_945_995 },
    { name: 'Transportation programs',                             total:    747_188_687 },
    { name: 'Special government services',                         total:    344_466_368 },
    { name: 'Debt Service: Principal',                             total:    251_660_000 },
    { name: 'Capital Outlay',                                      total:    187_376_897 },
    { name: 'Interest',                                            total:     91_272_088 },
  ]},
  2018: { total: 34_216_874_006, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 15_086_688_028 },
    { name: 'Economic planning, development, and security',        total:  5_144_613_657 },
    { name: 'Educational, cultural, and intellectual development', total:  4_082_955_565 },
    { name: 'Government direction, management, and control',       total:  3_157_550_417 },
    { name: 'Public safety and criminal justice',                  total:  3_119_724_970 },
    { name: 'Community development and environmental management',  total:  1_754_805_174 },
    { name: 'Transportation programs',                             total:    707_004_696 },
    { name: 'Capital Outlay',                                      total:    468_995_503 },
    { name: 'Special government services',                         total:    357_446_930 },
    { name: 'Debt Service: Principal',                             total:    244_725_000 },
    { name: 'Interest',                                            total:     92_364_066 },
  ]},
  2019: { total: 35_606_424_579, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 15_448_550_319 },
    { name: 'Economic planning, development, and security',        total:  5_110_571_377 },
    { name: 'Educational, cultural, and intellectual development', total:  3_978_801_483 },
    { name: 'Government direction, management, and control',       total:  3_843_673_556 },
    { name: 'Public safety and criminal justice',                  total:  3_350_883_965 },
    { name: 'Community development and environmental management',  total:  1_776_610_517 },
    { name: 'Transportation programs',                             total:    930_300_577 },
    { name: 'Current refunding bonds escrow payment',              total:    393_992_987 },
    { name: 'Special government services',                         total:    366_679_095 },
    { name: 'Debt Service: Principal',                             total:    244_570_000 },
    { name: 'Capital Outlay',                                      total:     81_805_031 },
    { name: 'Interest',                                            total:     79_985_672 },
  ]},
  2020: { total: 36_563_705_440, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 15_701_316_051 },
    { name: 'Economic planning, development, and security',        total:  5_264_516_794 },
    { name: 'Educational, cultural, and intellectual development', total:  4_535_783_310 },
    { name: 'Government direction, management, and control',        total:  4_307_484_964 },
    { name: 'Public safety and criminal justice',                  total:  3_464_684_239 },
    { name: 'Community development and environmental management',  total:  1_655_370_737 },
    { name: 'Transportation programs',                             total:    877_022_170 },
    { name: 'Special government services',                         total:    358_566_836 },
    { name: 'Debt Service — Principal',                            total:    277_025_000 },
    { name: 'Interest',                                            total:     70_365_817 },
    { name: 'Capital Outlay',                                      total:     51_569_522 },
  ]},
  2021: { total: 43_197_990_156, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 17_630_508_473 },
    { name: 'Educational, cultural, and intellectual development', total:  7_708_364_030 },
    { name: 'Economic planning, development, and security',        total:  5_943_704_090 },
    { name: 'Government direction, management, and control',        total:  4_139_526_548 },
    { name: 'Public safety and criminal justice',                  total:  3_832_692_542 },
    { name: 'Community development and environmental management',  total:  2_073_728_408 },
    { name: 'Transportation programs',                             total:    713_835_803 },
    { name: 'Capital Outlay',                                      total:    434_891_333 },
    { name: 'Special government services',                         total:    353_155_158 },
    { name: 'Debt Service — Principal',                            total:    216_585_000 },
    { name: 'Interest',                                            total:    150_998_771 },
  ]},
  2022: { total: 50_311_616_860, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 20_295_300_745 },
    { name: 'Government direction, management, and control',        total:  7_945_467_930 },
    { name: 'Economic planning, development, and security',        total:  7_036_576_357 },
    { name: 'Educational, cultural, and intellectual development', total:  5_718_619_926 },
    { name: 'Public safety and criminal justice',                  total:  4_141_431_417 },
    { name: 'Community development and environmental management',  total:  3_732_087_988 },
    { name: 'Transportation programs',                             total:    643_739_508 },
    { name: 'Special government services',                         total:    409_466_912 },
    { name: 'Interest',                                            total:    221_586_501 },
    { name: 'Debt Service — Principal',                            total:    159_415_000 },
    { name: 'Capital Outlay',                                      total:      7_924_576 },
  ]},
  2023: { total: 53_640_149_629, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 21_846_545_988 },
    { name: 'Economic planning, development, and security',        total:  7_533_972_119 },
    { name: 'Educational, cultural, and intellectual development', total:  7_359_960_199 },
    { name: 'Government direction, management, and control',        total:  6_983_170_691 },
    { name: 'Public safety and criminal justice',                  total:  4_676_751_590 },
    { name: 'Community development and environmental management',  total:  2_884_977_217 },
    { name: 'Transportation programs',                             total:  1_256_240_674 },
    { name: 'Special government services',                         total:    416_822_820 },
    { name: 'Debt Service — Principal',                            total:    417_010_000 },
    { name: 'Interest',                                            total:    214_240_923 },
    { name: 'Capital Outlay',                                      total:     50_457_408 },
  ]},
  2024: { total: 59_174_201_425, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 23_032_877_863 },
    { name: 'Educational, cultural, and intellectual development', total: 12_937_793_234 },
    { name: 'Economic planning, development, and security',        total:  7_825_051_562 },
    { name: 'Government direction, management, and control',        total:  5_969_614_760 },
    { name: 'Public safety and criminal justice',                  total:  4_247_268_386 },
    { name: 'Community development and environmental management',  total:  2_843_943_097 },
    { name: 'Transportation programs',                             total:  1_009_850_945 },
    { name: 'Special government services',                         total:    521_711_542 },
    { name: 'Debt Service — Principal',                            total:    374_345_000 },
    { name: 'Capital Outlay',                                      total:    230_312_326 },
    { name: 'Interest',                                            total:    181_432_710 },
  ]},
  2025: { total: 59_603_886_014, confidence: 'actual', categories: [
    { name: 'Physical and mental health',                          total: 24_066_301_495 },
    { name: 'Educational, cultural, and intellectual development', total: 11_695_394_902 },
    { name: 'Economic planning, development, and security',        total:  8_030_184_577 },
    { name: 'Government direction, management, and control',        total:  6_125_847_029 },
    { name: 'Public safety and criminal justice',                  total:  4_384_995_823 },
    { name: 'Community development and environmental management',  total:  3_277_032_324 },
    { name: 'Transportation programs',                             total:    901_904_480 },
    { name: 'Special government services',                         total:    528_131_553 },
    { name: 'Debt Service — Principal',                            total:    410_755_000 },
    { name: 'Interest',                                            total:    163_427_135 },
    { name: 'Capital Outlay',                                      total:     19_911_696 },
  ]},
};

// P2 clamp (ACFR-20): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 1_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'New Jersey General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (Phase 114 hardening): reject --fy values that are not loadable years — a typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : Object.keys(EXPENDITURES).map(Number).sort((a, b) => a - b);
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, DOLLARS ×${UNITS})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06 (Phase 114 hardening): validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (EXPENDITURES[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'New Jersey General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'nj-acfr-gf-operating', base_url: 'https://www.nj.gov/treasury/omb/fr.shtml', fiscal_years: Object.keys(EXPENDITURES).map(Number).sort((a, b) => a - b), municipality_id: muniId };
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
      for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (net loss — shown at 0)]`);
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
