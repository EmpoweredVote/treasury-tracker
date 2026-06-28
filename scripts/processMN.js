#!/usr/bin/env node
/**
 * Minnesota General Fund Operating (Expenditure) Loader — FY2008-FY2025 ACTUAL
 * Source: State of Minnesota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, modified accrual, in thousands). Published by MN Management & Budget (MMB).
 *   Per-FY source URL below.
 * FY2023-FY2025: loaded in Phase 93 (2026-06-27).
 * FY2008-FY2022: extended in Phase 95 (2026-06-28) — full modern GASB-34 era history.
 * Confidence: actual (audited GAAP figures) for all 18 years.
 *
 * Usage:
 *   node scripts/processMN.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Minnesota'; const STATE_ABBR = 'MN'; const POPULATION = 5_706_494;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published State of Minnesota ACFR (source_date = fiscal year end).
const SOURCES = {
  // --- Existing (Phase 93) ---
  2023: { url: 'https://mn.gov/mmb/assets/2023%20-%20ACFR%20Final%20accessible_tcm1059-604563.pdf', date: '2023-06-30' },
  2024: { url: 'https://mn.gov/mmb/assets/2024%20-%20Final%20ACFR%20with%20Cover%202024%20-%20accessible_tcm1059-661432.pdf', date: '2024-06-30' },
  2025: { url: 'https://mn.gov/mmb-stat/documents/accounting/acfr/2025-ACFR.pdf', date: '2025-06-30' },
  // --- Extended (Phase 95, FY2022 back to FY2008) ---
  2022: { url: 'https://mn.gov/mmb/assets/2022%20-%20Final%20ACFR%20accessible_tcm1059-552884.pdf', date: '2022-06-30' },
  2021: { url: 'https://mn.gov/mmb/assets/2021%20-%20Final%20ACFR%20-%20accessible_tcm1059-513497.pdf', date: '2021-06-30' },
  2020: { url: 'https://mn.gov/mmb/assets/2020-ACFR_tcm1059-458810.pdf', date: '2020-06-30' },
  2019: { url: 'https://mn.gov/mmb/assets/2019-ACFR_tcm1059-413715.pdf', date: '2019-06-30' },
  2018: { url: 'https://mn.gov/mmb/assets/2018-ACFR_tcm1059-363004.pdf', date: '2018-06-30' },
  2017: { url: 'https://mn.gov/mmb/assets/2017-ACFR_tcm1059-321449.pdf', date: '2017-06-30' },
  2016: { url: 'https://mn.gov/mmb/assets/2016-ACFR_tcm1059-268792.pdf', date: '2016-06-30' },
  2015: { url: 'https://mn.gov/mmb/assets/2015-ACFR_tcm1059-125253.pdf', date: '2015-06-30' },
  2014: { url: 'https://mn.gov/mmb/assets/2014-ACFR_tcm1059-125168.pdf', date: '2014-06-30' },
  2013: { url: 'https://mn.gov/mmb/assets/2013_tcm1059-125158.pdf', date: '2013-06-30' },
  2012: { url: 'https://mn.gov/mmb/assets/2012_tcm1059-125116.pdf', date: '2012-06-30' },
  2011: { url: 'https://mn.gov/mmb/assets/2011_tcm1059-125045.pdf', date: '2011-06-30' },
  2010: { url: 'https://mn.gov/mmb/assets/2010_tcm1059-125009.pdf', date: '2010-06-30' },
  2009: { url: 'https://mn.gov/mmb/assets/2009_tcm1059-124962.pdf', date: '2009-06-30' },
  2008: { url: 'https://mn.gov/mmb/assets/2008_tcm1059-232154.pdf', date: '2008-06-30' },
};
const dataSource = (fy) => `State of Minnesota ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// General Fund expenditures by function — State of MN ACFR, GENERAL FUND column (in $).
// Function-level totals only (the ACFR governmental-funds statement does not break functions into
// sub-line-items), so these are depth-1 leaves under the GF root. Sums verified to Total Expenditures.
// FY2023-FY2025: Phase 93 (unchanged).
// FY2008-FY2022: Phase 95 — extracted from local ACFR PDFs (C:\tmp\Minn), verified against
//   published General Fund Total Expenditures line (tolerance: within $10M).
const EXPENDITURES = {
  // ---- Phase 93: FY2023-FY2025 (unchanged) ----
  2023: { total: 26_646_765_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 10_295_273_000, lineItems: [] },
    { name: 'Health and Human Services', total: 9_382_910_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_504_788_000, lineItems: [] },
    { name: 'General Government', total: 1_016_072_000, lineItems: [] },
    { name: 'Higher Education', total: 985_891_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 865_633_000, lineItems: [] },
    { name: 'Transportation', total: 613_082_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 404_235_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 386_802_000, lineItems: [] },
    { name: 'Capital Outlay', total: 104_412_000, lineItems: [] },
    { name: 'Debt Service', total: 87_667_000, lineItems: [] },
  ]},
  2024: { total: 33_534_701_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 11_921_970_000, lineItems: [] },
    { name: 'Health and Human Services', total: 11_739_746_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_752_507_000, lineItems: [] },
    { name: 'General Government', total: 2_339_791_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 1_173_272_000, lineItems: [] },
    { name: 'Higher Education', total: 1_146_680_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 1_048_915_000, lineItems: [] },
    { name: 'Transportation', total: 638_509_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 491_047_000, lineItems: [] },
    { name: 'Capital Outlay', total: 184_522_000, lineItems: [] },
    { name: 'Debt Service', total: 97_742_000, lineItems: [] },
  ]},
  2025: { total: 35_114_726_000, confidence: 'actual', categories: [
    { name: 'Health and Human Services', total: 13_361_362_000, lineItems: [] },
    { name: 'General Education', total: 12_661_467_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_951_642_000, lineItems: [] },
    { name: 'General Government', total: 1_287_599_000, lineItems: [] },
    { name: 'Higher Education', total: 1_196_290_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 1_181_789_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 853_759_000, lineItems: [] },
    { name: 'Transportation', total: 701_411_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 624_479_000, lineItems: [] },
    { name: 'Capital Outlay', total: 181_074_000, lineItems: [] },
    { name: 'Debt Service', total: 113_854_000, lineItems: [] },
  ]},
  // ---- Phase 95: FY2008-FY2022 (new) ----
  // Source: MN ACFR Governmental Funds Statement — GENERAL FUND column (in thousands → dollars)
  // Total = published General Fund Total Expenditures (Current + Capital Outlay + Debt Service)
  2022: { total: 24_333_496_000, confidence: 'actual', categories: [
    // Current expenditures by function
    { name: 'General Education', total: 10_032_021_000, lineItems: [] },
    { name: 'Health and Human Services', total: 8_134_337_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_011_024_000, lineItems: [] },
    { name: 'Higher Education', total: 1_016_919_000, lineItems: [] },
    { name: 'General Government', total: 904_011_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 798_457_000, lineItems: [] },
    { name: 'Transportation', total: 582_994_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 354_330_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 354_669_000, lineItems: [] },
    { name: 'Capital Outlay', total: 77_791_000, lineItems: [] },
    { name: 'Debt Service', total: 66_943_000, lineItems: [] },
  ]},
  2021: { total: 24_284_883_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 10_019_769_000, lineItems: [] },
    { name: 'Health and Human Services', total: 8_198_224_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_957_585_000, lineItems: [] },
    { name: 'General Government', total: 1_041_012_000, lineItems: [] },
    { name: 'Higher Education', total: 974_767_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 854_501_000, lineItems: [] },
    { name: 'Transportation', total: 536_619_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 360_345_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 241_243_000, lineItems: [] },
    { name: 'Capital Outlay', total: 67_393_000, lineItems: [] },
    { name: 'Debt Service', total: 33_425_000, lineItems: [] },
  ]},
  2020: { total: 23_696_712_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 9_895_517_000, lineItems: [] },
    { name: 'Health and Human Services', total: 8_134_332_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_780_498_000, lineItems: [] },
    { name: 'Higher Education', total: 976_077_000, lineItems: [] },
    { name: 'General Government', total: 885_550_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 774_862_000, lineItems: [] },
    { name: 'Transportation', total: 500_078_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 357_436_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 261_482_000, lineItems: [] },
    { name: 'Capital Outlay', total: 88_158_000, lineItems: [] },
    { name: 'Debt Service', total: 42_722_000, lineItems: [] },
  ]},
  2019: { total: 23_314_047_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 9_678_641_000, lineItems: [] },
    { name: 'Health and Human Services', total: 8_029_374_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_867_151_000, lineItems: [] },
    { name: 'Higher Education', total: 942_218_000, lineItems: [] },
    { name: 'General Government', total: 865_390_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 725_507_000, lineItems: [] },
    { name: 'Transportation', total: 542_645_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 280_074_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 237_288_000, lineItems: [] },
    { name: 'Capital Outlay', total: 115_086_000, lineItems: [] },
    { name: 'Debt Service', total: 30_673_000, lineItems: [] },
  ]},
  2018: { total: 22_033_656_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 9_323_311_000, lineItems: [] },
    { name: 'Health and Human Services', total: 7_397_368_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_698_970_000, lineItems: [] },
    { name: 'Higher Education', total: 962_131_000, lineItems: [] },
    { name: 'General Government', total: 855_543_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 689_217_000, lineItems: [] },
    { name: 'Transportation', total: 487_101_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 244_522_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 261_267_000, lineItems: [] },
    { name: 'Capital Outlay', total: 87_621_000, lineItems: [] },
    { name: 'Debt Service', total: 26_605_000, lineItems: [] },
  ]},
  2017: { total: 20_557_245_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 8_962_695_000, lineItems: [] },
    { name: 'Health and Human Services', total: 6_443_833_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_644_033_000, lineItems: [] },
    { name: 'Higher Education', total: 902_068_000, lineItems: [] },
    { name: 'General Government', total: 876_249_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 683_232_000, lineItems: [] },
    { name: 'Transportation', total: 452_701_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 249_026_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 263_932_000, lineItems: [] },
    { name: 'Capital Outlay', total: 52_135_000, lineItems: [] },
    { name: 'Debt Service', total: 27_341_000, lineItems: [] },
  ]},
  2016: { total: 19_379_118_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 8_600_102_000, lineItems: [] },
    { name: 'Health and Human Services', total: 5_956_678_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_626_221_000, lineItems: [] },
    { name: 'Higher Education', total: 899_091_000, lineItems: [] },
    { name: 'General Government', total: 719_083_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 644_486_000, lineItems: [] },
    { name: 'Transportation', total: 407_206_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 218_708_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 251_055_000, lineItems: [] },
    { name: 'Capital Outlay', total: 31_209_000, lineItems: [] },
    { name: 'Debt Service', total: 25_279_000, lineItems: [] },
  ]},
  2015: { total: 18_986_749_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 8_275_184_000, lineItems: [] },
    { name: 'Health and Human Services', total: 6_053_433_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_583_093_000, lineItems: [] },
    { name: 'Higher Education', total: 850_649_000, lineItems: [] },
    { name: 'General Government', total: 748_208_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 631_140_000, lineItems: [] },
    { name: 'Transportation', total: 363_266_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 184_236_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 238_032_000, lineItems: [] },
    { name: 'Capital Outlay', total: 31_384_000, lineItems: [] },
    { name: 'Debt Service', total: 28_124_000, lineItems: [] },
  ]},
  2014: { total: 18_177_140_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 8_243_607_000, lineItems: [] },
    { name: 'Health and Human Services', total: 5_644_686_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_290_612_000, lineItems: [] },
    { name: 'Higher Education', total: 823_664_000, lineItems: [] },
    { name: 'General Government', total: 694_465_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 592_058_000, lineItems: [] },
    { name: 'Transportation', total: 400_551_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 245_734_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 178_859_000, lineItems: [] },
    { name: 'Capital Outlay', total: 28_182_000, lineItems: [] },
    { name: 'Debt Service', total: 34_722_000, lineItems: [] },
  ]},
  2013: { total: 17_186_483_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 7_415_750_000, lineItems: [] },
    { name: 'Health and Human Services', total: 5_683_366_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_268_609_000, lineItems: [] },
    { name: 'Higher Education', total: 745_965_000, lineItems: [] },
    { name: 'General Government', total: 722_829_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 583_556_000, lineItems: [] },
    { name: 'Transportation', total: 295_195_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 246_882_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 145_280_000, lineItems: [] },
    { name: 'Capital Outlay', total: 26_952_000, lineItems: [] },
    { name: 'Debt Service', total: 52_099_000, lineItems: [] },
  ]},
  2012: { total: 16_734_755_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 7_171_507_000, lineItems: [] },
    { name: 'Health and Human Services', total: 5_644_629_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_358_142_000, lineItems: [] },
    { name: 'Higher Education', total: 712_363_000, lineItems: [] },
    { name: 'General Government', total: 628_869_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 546_974_000, lineItems: [] },
    { name: 'Transportation', total: 277_690_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 204_553_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 118_676_000, lineItems: [] },
    { name: 'Capital Outlay', total: 14_476_000, lineItems: [] },
    { name: 'Debt Service', total: 56_876_000, lineItems: [] },
  ]},
  2011: { total: 15_411_323_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 6_578_615_000, lineItems: [] },
    { name: 'Health and Human Services', total: 4_815_804_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_316_886_000, lineItems: [] },
    { name: 'Higher Education', total: 747_617_000, lineItems: [] },
    { name: 'General Government', total: 683_314_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 579_977_000, lineItems: [] },
    { name: 'Transportation', total: 286_796_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 205_342_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 130_497_000, lineItems: [] },
    { name: 'Capital Outlay', total: 25_571_000, lineItems: [] },
    { name: 'Debt Service', total: 40_867_000, lineItems: [] },
  ]},
  // FY2010: General Fund total from ACFR (dotted-column format, verified against published totals)
  // Current: Public Safety 540,876 + Transportation 283,228 + Ag/Env 205,116 + Econ/WF 156,781 +
  //   Gen Ed 6,444,487 + Higher Ed 841,752 + H&HS 4,384,540 + Gen Gov 633,298 + Intergovt 1,549,199
  //   + Securities Lending 56 = 15,039,333; Capital Outlay 30,972; Debt Service 45,841 = 15,116,146
  2010: { total: 15_116_146_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 6_444_487_000, lineItems: [] },
    { name: 'Health and Human Services', total: 4_384_540_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_549_199_000, lineItems: [] },
    { name: 'Higher Education', total: 841_752_000, lineItems: [] },
    { name: 'General Government', total: 633_298_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 540_876_000, lineItems: [] },
    { name: 'Transportation', total: 283_228_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 205_116_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 156_781_000, lineItems: [] },
    { name: 'Capital Outlay', total: 30_972_000, lineItems: [] },
    { name: 'Debt Service', total: 45_841_000, lineItems: [] },
  ]},
  // FY2009: Current: Public Safety 601,299 + Transportation 237,131 + Ag/Env 234,886 + Econ/WF 111,869 +
  //   Gen Ed 7,076,624 + Higher Ed 830,789 + H&HS 4,551,788 + Gen Gov 692,936 + Intergovt 1,435,675
  //   + Sec Lending 568 = 15,773,565; Capital Outlay 8,067; Debt Service 32,149 = 15,813,781
  2009: { total: 15_813_781_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 7_076_624_000, lineItems: [] },
    { name: 'Health and Human Services', total: 4_551_788_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_435_675_000, lineItems: [] },
    { name: 'Higher Education', total: 830_789_000, lineItems: [] },
    { name: 'General Government', total: 692_936_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 601_299_000, lineItems: [] },
    { name: 'Transportation', total: 237_131_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 234_886_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 111_869_000, lineItems: [] },
    { name: 'Capital Outlay', total: 8_067_000, lineItems: [] },
    { name: 'Debt Service', total: 32_149_000, lineItems: [] },
  ]},
  // FY2008: Current: Public Safety 578,464 + Transportation 252,390 + Ag/Env 216,220 + Econ/WF 203,457 +
  //   Gen Ed 6,969,053 + Higher Ed 870,322 + H&HS 4,713,362 + Gen Gov 710,433 + Intergovt 1,511,504
  //   + Sec Lending 8,793 = 16,033,998; Capital Outlay 15,587; Debt Service 36,965 = 16,086,550
  2008: { total: 16_086_550_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 6_969_053_000, lineItems: [] },
    { name: 'Health and Human Services', total: 4_713_362_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 1_511_504_000, lineItems: [] },
    { name: 'Higher Education', total: 870_322_000, lineItems: [] },
    { name: 'General Government', total: 710_433_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 578_464_000, lineItems: [] },
    { name: 'Transportation', total: 252_390_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 203_457_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 216_220_000, lineItems: [] },
    { name: 'Capital Outlay', total: 15_587_000, lineItems: [] },
    { name: 'Debt Service', total: 36_965_000, lineItems: [] },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) {
    if (cat.lineItems && cat.lineItems.length) {
      const itemSum = cat.lineItems.reduce((s, li) => s + li.amount, 0);
      if (Math.abs(itemSum - cat.total) > 1_000_000) { console.error(`FY${fy} "${cat.name}": items ${itemSum} ≠ ${cat.total}`); ok = false; }
    }
    catSum += cat.total;
  }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: (cat.lineItems || []).filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })) }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Minnesota General Fund Budget', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).single();
    if (error || !muni) { console.error(`${STATE_NAME} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: `${STATE_NAME} General Fund Operating Budget`, api_type: 'html', dataset_type: 'operating', dataset_id: 'mn-gf-operating', base_url: 'https://mn.gov/mmb/accounting/reports/annual-comprehensive-financial-report.jsp', fiscal_years: [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('name', srcPayload.name).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL EXPENDITURES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Stamp the per-FY source on the budget row (the RPC does not set source_url/source_date). Idempotent.
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} operating row\n`);
    } else { console.error(`Could not find FY${fy} operating budget row to stamp source`); process.exit(2); }
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
