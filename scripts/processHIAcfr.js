#!/usr/bin/env node
/**
 * Hawaii General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Hawaii Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the HI state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/hi/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processHIAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Hawaii State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — HI ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2005: { total: 3_653_792, confidence: 'actual', categories: [
    { name: 'General government',                  total:      384_203 },
    { name: 'Public safety',                       total:      204_390 },
    { name: 'Conservation of natural resources',   total:       26_841 },
    { name: 'Health',                              total:      389_984 },
    { name: 'Welfare',                             total:      623_599 },
    { name: 'Lower education',                     total:    1_434_862 },
    { name: 'Higher education',                    total:      510_194 },
    { name: 'Other education',                     total:        4_197 },
    { name: 'Culture and recreation',              total:       38_485 },
    { name: 'Urban redevelopment and housing',     total:        7_246 },
    { name: 'Economic development and assistance', total:       29_791 },
  ]},
  2006: { total: 3_985_907, confidence: 'actual', categories: [
    { name: 'General government',                  total:      366_761 },
    { name: 'Public safety',                       total:      222_855 },
    { name: 'Conservation of natural resources',   total:       32_936 },
    { name: 'Health',                              total:      455_388 },
    { name: 'Welfare',                             total:      652_371 },
    { name: 'Lower education',                     total:    1_588_824 },
    { name: 'Higher education',                    total:      574_836 },
    { name: 'Other education',                     total:        4_714 },
    { name: 'Culture and recreation',              total:       40_574 },
    { name: 'Urban redevelopment and housing',     total:       14_486 },
    { name: 'Economic development and assistance', total:       32_162 },
  ]},
  2007: { total: 4_458_995, confidence: 'actual', categories: [
    { name: 'General government',                  total:      351_674 },
    { name: 'Public safety',                       total:      256_072 },
    { name: 'Conservation of natural resources',   total:       38_445 },
    { name: 'Health',                              total:      558_748 },
    { name: 'Welfare',                             total:      702_526 },
    { name: 'Lower education',                     total:    1_776_222 },
    { name: 'Higher education',                    total:      660_336 },
    { name: 'Other education',                     total:        5_651 },
    { name: 'Culture and recreation',              total:       42_259 },
    { name: 'Urban redevelopment and housing',     total:       28_060 },
    { name: 'Economic development and assistance', total:       35_586 },
    { name: 'Other',                               total:        3_416 },
  ]},
  2008: { total: 4_785_562, confidence: 'actual', categories: [
    { name: 'General government',                  total:      407_147 },
    { name: 'Public safety',                       total:      280_962 },
    { name: 'Conservation of natural resources',   total:       46_489 },
    { name: 'Health',                              total:      573_929 },
    { name: 'Welfare',                             total:      744_547 },
    { name: 'Lower education',                     total:    1_882_742 },
    { name: 'Higher education',                    total:      697_333 },
    { name: 'Other education',                     total:        6_293 },
    { name: 'Culture and recreation',              total:       53_805 },
    { name: 'Urban redevelopment and housing',     total:       52_035 },
    { name: 'Economic development and assistance', total:       39_752 },
    { name: 'Other',                               total:          528 },
  ]},
  2009: { total: 4_949_414, confidence: 'actual', categories: [
    { name: 'General government',                  total:      421_408 },
    { name: 'Public safety',                       total:      287_883 },
    { name: 'Conservation of natural resources',   total:       56_813 },
    { name: 'Health',                              total:      545_854 },
    { name: 'Welfare',                             total:      669_612 },
    { name: 'Lower education',                     total:    2_106_450 },
    { name: 'Higher education',                    total:      735_348 },
    { name: 'Other education',                     total:       14_637 },
    { name: 'Culture and recreation',              total:       45_576 },
    { name: 'Urban redevelopment and housing',     total:       22_619 },
    { name: 'Economic development and assistance', total:       41_305 },
    { name: 'Housing',                             total:        1_909 },
  ]},
  2010: { total: 4_225_892, confidence: 'actual', categories: [
    { name: 'General government',                  total:      344_110 },
    { name: 'Public safety',                       total:      294_576 },
    { name: 'Conservation of natural resources',   total:       35_390 },
    { name: 'Health',                              total:      503_625 },
    { name: 'Welfare',                             total:      712_900 },
    { name: 'Lower education',                     total:    1_720_097 },
    { name: 'Higher education',                    total:      525_446 },
    { name: 'Other education',                     total:        5_095 },
    { name: 'Culture and recreation',              total:       35_884 },
    { name: 'Urban redevelopment and housing',     total:       20_386 },
    { name: 'Economic development and assistance', total:       28_269 },
    { name: 'Housing',                             total:          114 },
  ]},
  2011: { total: 4_154_924, confidence: 'actual', categories: [
    { name: 'General government',                  total:      353_124 },
    { name: 'Public safety',                       total:      259_086 },
    { name: 'Conservation of natural resources',   total:       28_119 },
    { name: 'Health',                              total:      461_894 },
    { name: 'Welfare',                             total:      761_208 },
    { name: 'Lower education',                     total:    1_694_529 },
    { name: 'Higher education',                    total:      502_424 },
    { name: 'Other education',                     total:        5_299 },
    { name: 'Culture and recreation',              total:       38_682 },
    { name: 'Urban redevelopment and housing',     total:           82 },
    { name: 'Economic development and assistance', total:       22_997 },
    { name: 'Housing',                             total:       20_758 },
    { name: 'Other',                               total:        6_722 },
  ]},
  2012: { total: 4_624_748, confidence: 'actual', categories: [
    { name: 'General government',                  total:      369_664 },
    { name: 'Public safety',                       total:      316_863 },
    { name: 'Conservation of natural resources',   total:       26_290 },
    { name: 'Health',                              total:      484_543 },
    { name: 'Welfare',                             total:    1_019_919 },
    { name: 'Lower education',                     total:    1_776_825 },
    { name: 'Higher education',                    total:      535_457 },
    { name: 'Other education',                     total:        5_544 },
    { name: 'Culture and recreation',              total:       39_144 },
    { name: 'Urban redevelopment and housing',     total:          108 },
    { name: 'Economic development and assistance', total:       24_141 },
    { name: 'Housing',                             total:       20_021 },
    { name: 'Other',                               total:        6_229 },
  ]},
  2013: { total: 4_640_278, confidence: 'actual', categories: [
    { name: 'General government',                  total:      322_464 },
    { name: 'Public safety',                       total:      291_855 },
    { name: 'Conservation of natural resources',   total:       28_260 },
    { name: 'Health',                              total:      521_592 },
    { name: 'Welfare',                             total:    1_102_912 },
    { name: 'Lower education',                     total:    1_741_202 },
    { name: 'Higher education',                    total:      518_486 },
    { name: 'Other education',                     total:        5_737 },
    { name: 'Culture and recreation',              total:       38_979 },
    { name: 'Urban redevelopment and housing',     total:          294 },
    { name: 'Economic development and assistance', total:       25_876 },
    { name: 'Housing',                             total:       19_378 },
    { name: 'Other',                               total:       23_243 },
  ]},
  2014: { total: 5_047_585, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      425_549 },
    { name: 'Public safety',                       total:      377_408 },
    { name: 'Conservation of natural resources',   total:       34_132 },
    { name: 'Health',                              total:      559_981 },
    { name: 'Welfare',                             total:      992_675 },
    { name: 'Lower education',                     total:    1_958_940 },
    { name: 'Higher education',                    total:      563_764 },
    { name: 'Other education',                     total:        6_559 },
    { name: 'Culture and recreation',              total:       43_567 },
    { name: 'Urban redevelopment and housing',     total:       10_005 },
    { name: 'Economic development and assistance', total:       32_992 },
    { name: 'Housing',                             total:       19_687 },
    { name: 'Other',                               total:       22_326 },
  ]},
  2015: { total: 5_266_450, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      440_602 },
    { name: 'Public safety',                       total:      343_368 },
    { name: 'Conservation of natural resources',   total:       42_706 },
    { name: 'Health',                              total:      587_358 },
    { name: 'Welfare',                             total:    1_092_243 },
    { name: 'Lower education',                     total:    2_040_751 },
    { name: 'Higher education',                    total:      600_015 },
    { name: 'Other education',                     total:        6_902 },
    { name: 'Culture and recreation',              total:       43_770 },
    { name: 'Urban redevelopment and housing',     total:       11_764 },
    { name: 'Economic development and assistance', total:       28_889 },
    { name: 'Housing',                             total:       20_835 },
    { name: 'Other',                               total:        7_247 },
  ]},
  2016: { total: 5_601_616, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      505_656 },
    { name: 'Public safety',                       total:      345_453 },
    { name: 'Conservation of natural resources',   total:       50_402 },
    { name: 'Health',                              total:      614_456 },
    { name: 'Welfare',                             total:    1_100_399 },
    { name: 'Lower education',                     total:    2_184_067 },
    { name: 'Higher education',                    total:      656_700 },
    { name: 'Other education',                     total:        7_040 },
    { name: 'Culture and recreation',              total:       49_864 },
    { name: 'Urban redevelopment and housing',     total:       11_962 },
    { name: 'Economic development and assistance', total:       43_690 },
    { name: 'Housing',                             total:       18_334 },
    { name: 'Other',                               total:       13_593 },
  ]},
  2017: { total: 6_027_463, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      526_006 },
    { name: 'Public safety',                       total:      389_190 },
    { name: 'Highways',                            total:          203 },
    { name: 'Conservation of natural resources',   total:       67_889 },
    { name: 'Health',                              total:      614_536 },
    { name: 'Welfare',                             total:    1_227_601 },
    { name: 'Lower education',                     total:    2_304_577 },
    { name: 'Higher education',                    total:      740_102 },
    { name: 'Other education',                     total:        7_621 },
    { name: 'Culture and recreation',              total:       50_107 },
    { name: 'Urban redevelopment and housing',     total:       18_613 },
    { name: 'Economic development and assistance', total:       47_736 },
    { name: 'Housing',                             total:       29_805 },
    { name: 'Other',                               total:        3_477 },
  ]},
  2018: { total: 6_576_615, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      567_869 },
    { name: 'Public safety',                       total:      430_954 },
    { name: 'Highways',                            total:      115_233 },
    { name: 'Conservation of natural resources',   total:       64_986 },
    { name: 'Health',                              total:      577_749 },
    { name: 'Welfare',                             total:    1_186_888 },
    { name: 'Lower education',                     total:    2_485_351 },
    { name: 'Higher education',                    total:      766_764 },
    { name: 'Other education',                     total:        9_970 },
    { name: 'Culture and recreation',              total:       56_148 },
    { name: 'Urban redevelopment and housing',     total:       21_105 },
    { name: 'Economic development and assistance', total:       45_527 },
    { name: 'Housing',                             total:      244_787 },
    { name: 'Other',                               total:        3_284 },
  ]},
  2019: { total: 6_540_669, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      506_453 },
    { name: 'Public safety',                       total:      465_608 },
    { name: 'Highways',                            total:       13_031 },
    { name: 'Conservation of natural resources',   total:       72_056 },
    { name: 'Health',                              total:      750_450 },
    { name: 'Welfare',                             total:    1_116_455 },
    { name: 'Lower education',                     total:    2_606_362 },
    { name: 'Higher education',                    total:      821_327 },
    { name: 'Other education',                     total:        8_082 },
    { name: 'Culture and recreation',              total:       57_220 },
    { name: 'Urban redevelopment and housing',     total:       32_882 },
    { name: 'Economic development and assistance', total:       52_908 },
    { name: 'Housing',                             total:       34_090 },
    { name: 'Other',                               total:        3_745 },
  ]},
  2020: { total: 6_889_438, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      587_460 },
    { name: 'Public safety',                       total:      438_510 },
    { name: 'Highways',                            total:       23_600 },
    { name: 'Conservation of natural resources',   total:       81_675 },
    { name: 'Health',                              total:      780_726 },
    { name: 'Welfare',                             total:    1_240_717 },
    { name: 'Lower education',                     total:    2_671_404 },
    { name: 'Higher education',                    total:      851_779 },
    { name: 'Other education',                     total:        7_407 },
    { name: 'Culture and recreation',              total:       82_271 },
    { name: 'Urban redevelopment and housing',     total:       23_595 },
    { name: 'Economic development and assistance', total:       60_989 },
    { name: 'Housing',                             total:       34_306 },
    { name: 'Other',                               total:        4_999 },
  ]},
  2021: { total: 7_178_404, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      930_895 },
    { name: 'Public safety',                       total:      422_017 },
    { name: 'Highways',                            total:        3_537 },
    { name: 'Conservation of natural resources',   total:       67_198 },
    { name: 'Health',                              total:      725_269 },
    { name: 'Welfare',                             total:    1_265_818 },
    { name: 'Lower education',                     total:    2_693_083 },
    { name: 'Higher education',                    total:      885_315 },
    { name: 'Other education',                     total:        6_776 },
    { name: 'Culture and recreation',              total:       64_854 },
    { name: 'Urban redevelopment and housing',     total:       20_703 },
    { name: 'Economic development and assistance', total:       58_068 },
    { name: 'Housing',                             total:       34_871 },
  ]},
  2022: { total: 6_579_047, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      578_495 },
    { name: 'Public safety',                       total:      399_449 },
    { name: 'Highways',                            total:        4_039 },
    { name: 'Conservation of natural resources',   total:       60_932 },
    { name: 'Health',                              total:      665_233 },
    { name: 'Welfare',                             total:    1_350_186 },
    { name: 'Lower education',                     total:    2_512_402 },
    { name: 'Higher education',                    total:      768_478 },
    { name: 'Other education',                     total:        6_439 },
    { name: 'Culture and recreation',              total:       60_801 },
    { name: 'Urban redevelopment and housing',     total:       18_975 },
    { name: 'Economic development and assistance', total:       49_779 },
    { name: 'Housing',                             total:       31_057 },
    { name: 'Other',                               total:       72_782 },
  ]},
  2023: { total: 7_695_802, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      852_277 },
    { name: 'Public safety',                       total:      441_535 },
    { name: 'Conservation of natural resources',   total:       83_288 },
    { name: 'Health',                              total:      658_965 },
    { name: 'Welfare',                             total:    1_389_649 },
    { name: 'Lower education',                     total:    3_122_020 },
    { name: 'Higher education',                    total:      940_609 },
    { name: 'Other education',                     total:        7_752 },
    { name: 'Culture and recreation',              total:       78_546 },
    { name: 'Urban redevelopment and housing',     total:       32_142 },
    { name: 'Economic development and assistance', total:       59_770 },
    { name: 'Housing',                             total:       25_521 },
    { name: 'Other',                               total:        3_728 },
  ]},
  2024: { total: 9_285_436, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      738_778 },
    { name: 'Public safety',                       total:      662_394 },
    { name: 'Highways',                            total:        9_890 },
    { name: 'Conservation of natural resources',   total:      109_643 },
    { name: 'Health',                              total:      949_343 },
    { name: 'Welfare',                             total:    1_458_249 },
    { name: 'Lower education',                     total:    3_410_277 },
    { name: 'Higher education',                    total:    1_041_710 },
    { name: 'Other education',                     total:        7_586 },
    { name: 'Culture and recreation',              total:       83_630 },
    { name: 'Urban redevelopment and housing',     total:       63_847 },
    { name: 'Economic development and assistance', total:      334_415 },
    { name: 'Housing',                             total:      342_983 },
    { name: 'Other',                               total:       72_691 },
  ]},
  2025: { total: 8_728_004, confidence: 'actual', categories: [
    { name: 'Current General government',          total:      685_101 },
    { name: 'Public safety',                       total:      647_530 },
    { name: 'Highways',                            total:        3_135 },
    { name: 'Conservation of natural resources',   total:      125_031 },
    { name: 'Health',                              total:      926_738 },
    { name: 'Welfare',                             total:    1_516_717 },
    { name: 'Lower education',                     total:    3_352_597 },
    { name: 'Higher education',                    total:      987_129 },
    { name: 'Other education',                     total:       10_203 },
    { name: 'Culture and recreation',              total:       99_702 },
    { name: 'Urban redevelopment and housing',     total:       85_790 },
    { name: 'Economic development and assistance', total:      204_798 },
    { name: 'Housing',                             total:       62_283 },
    { name: 'Other',                               total:       21_250 },
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
  return { jsonTree: [{ n: 'Hawaii General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Hawaii General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'hi-acfr-gf-operating', base_url: 'https://ags.hawaii.gov/accounting/annual-financial-reports/', fiscal_years: [2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
