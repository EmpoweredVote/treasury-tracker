#!/usr/bin/env node
/**
 * Minnesota General Fund Revenue Loader — FY2008-FY2025 ACTUAL
 * Source: State of Minnesota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, modified accrual, in thousands). Published by MN Management & Budget (MMB).
 *   Per-FY source URL below.
 * FY2023-FY2025: loaded in Phase 93 (2026-06-27).
 * FY2008-FY2022: extended in Phase 95 (2026-06-28) — full modern GASB-34 era history.
 * FY2022: contains a negative Investment/Interest Income line (GF investment losses in that year).
 *   Handled per Policy P2: area clamped to 0, signed value retained in label, audited total carried verbatim.
 * Confidence: actual (audited GAAP figures) for all 18 years.
 *
 * Usage:
 *   node scripts/processMNRevenue.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `State of Minnesota ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund net revenues by source — State of MN ACFR, GENERAL FUND column (in $).
// Source-level totals (depth-1 leaves under the GF root). Sums verified to Net Revenues total.
// FY2023-FY2025: Phase 93 (unchanged).
// FY2008-FY2022: Phase 95 — extracted from local ACFR PDFs (C:\tmp\Minn), verified against
//   published General Fund Net Revenues line (tolerance: within $10M).
// FY2022 NOTE: Investment/Interest Income is NEGATIVE (-$350,456,000) — investment losses.
//   Per P2, this category's rendered area is clamped to 0; the signed value is preserved in the label;
//   the root node total carries the audited Net Revenues verbatim (already netting the negative).
// FY2011/FY2009/FY2008 NOTE: Securities Lending Income is a tiny separate line included in validate().
//   It is folded into the Investment/Interest Income category for display since it is < 0.1% of total.
const REVENUE = {
  // ---- Phase 93: FY2023-FY2025 (unchanged) ----
  2023: { total: 33_466_152_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 16_304_325_000, lineItems: [] },
    { name: 'Sales Taxes', total: 7_538_069_000, lineItems: [] },
    { name: 'Other Taxes', total: 3_296_489_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 2_911_082_000, lineItems: [] },
    { name: 'Investment/Interest Earnings', total: 1_033_719_000, lineItems: [] },
    { name: 'Property Taxes', total: 770_142_000, lineItems: [] },
    { name: 'Other Revenues', total: 513_816_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 424_120_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 264_560_000, lineItems: [] },
    { name: 'Departmental Services', total: 179_776_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 179_497_000, lineItems: [] },
    { name: 'Federal Revenues', total: 50_557_000, lineItems: [] },
  ]},
  2024: { total: 34_562_737_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 16_633_430_000, lineItems: [] },
    { name: 'Sales Taxes', total: 7_593_195_000, lineItems: [] },
    { name: 'Other Taxes', total: 3_259_996_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 3_205_333_000, lineItems: [] },
    { name: 'Investment/Interest Earnings', total: 1_398_513_000, lineItems: [] },
    { name: 'Property Taxes', total: 719_571_000, lineItems: [] },
    { name: 'Other Revenues', total: 623_389_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 451_195_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 263_781_000, lineItems: [] },
    { name: 'Departmental Services', total: 188_191_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 165_053_000, lineItems: [] },
    { name: 'Federal Revenues', total: 61_090_000, lineItems: [] },
  ]},
  2025: { total: 35_478_861_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 17_785_593_000, lineItems: [] },
    { name: 'Sales Taxes', total: 7_475_214_000, lineItems: [] },
    { name: 'Other Taxes', total: 3_520_418_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 3_056_349_000, lineItems: [] },
    { name: 'Investment/Interest Earnings', total: 1_108_205_000, lineItems: [] },
    { name: 'Property Taxes', total: 750_842_000, lineItems: [] },
    { name: 'Other Revenues', total: 616_180_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 441_408_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 286_788_000, lineItems: [] },
    { name: 'Departmental Services', total: 200_560_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 152_891_000, lineItems: [] },
    { name: 'Federal Revenues', total: 84_413_000, lineItems: [] },
  ]},
  // ---- Phase 95: FY2008-FY2022 (new) ----
  // Source: MN ACFR Governmental Funds Statement — GENERAL FUND column (in thousands → dollars)
  // Total = published General Fund Net Revenues (signed sum including any negative lines)
  // FY2022: Investment/Interest Income is NEGATIVE — P2 applied in buildTree
  2022: { total: 31_743_414_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 16_836_132_000, lineItems: [] },
    { name: 'Sales Taxes', total: 6_769_988_000, lineItems: [] },
    { name: 'Other Taxes', total: 3_277_382_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 2_848_019_000, lineItems: [] },
    { name: 'Property Taxes', total: 765_534_000, lineItems: [] },
    { name: 'Other Revenues', total: 499_416_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 394_630_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 269_423_000, lineItems: [] },
    { name: 'Departmental Services', total: 191_385_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 192_965_000, lineItems: [] },
    { name: 'Federal Revenues', total: 48_996_000, lineItems: [] },
    // NEGATIVE: GF investment losses in FY2022. P2 → area=0 in icicle, signed value in label.
    { name: 'Investment/Interest Income', total: -350_456_000, lineItems: [] },
  ]},
  2021: { total: 28_856_726_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 14_369_219_000, lineItems: [] },
    { name: 'Sales Taxes', total: 6_150_751_000, lineItems: [] },
    { name: 'Other Taxes', total: 3_074_525_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 2_404_057_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 413_345_000, lineItems: [] },
    { name: 'Property Taxes', total: 789_888_000, lineItems: [] },
    { name: 'Other Revenues', total: 481_261_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 392_255_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 260_722_000, lineItems: [] },
    { name: 'Departmental Services', total: 215_104_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 254_190_000, lineItems: [] },
    { name: 'Federal Revenues', total: 51_409_000, lineItems: [] },
  ]},
  2020: { total: 24_866_869_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 12_329_724_000, lineItems: [] },
    { name: 'Sales Taxes', total: 5_797_172_000, lineItems: [] },
    { name: 'Other Taxes', total: 2_765_354_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_620_684_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 206_495_000, lineItems: [] },
    { name: 'Property Taxes', total: 772_876_000, lineItems: [] },
    { name: 'Other Revenues', total: 414_783_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 324_150_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 245_113_000, lineItems: [] },
    { name: 'Departmental Services', total: 185_483_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 152_282_000, lineItems: [] },
    { name: 'Federal Revenues', total: 52_753_000, lineItems: [] },
  ]},
  2019: { total: 25_390_303_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 12_674_858_000, lineItems: [] },
    { name: 'Sales Taxes', total: 5_775_278_000, lineItems: [] },
    { name: 'Other Taxes', total: 2_817_669_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_613_373_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 243_163_000, lineItems: [] },
    { name: 'Property Taxes', total: 811_117_000, lineItems: [] },
    { name: 'Other Revenues', total: 479_461_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 323_059_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 234_462_000, lineItems: [] },
    { name: 'Departmental Services', total: 242_310_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 162_765_000, lineItems: [] },
    { name: 'Federal Revenues', total: 12_788_000, lineItems: [] },
  ]},
  2018: { total: 23_982_256_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 12_082_631_000, lineItems: [] },
    { name: 'Sales Taxes', total: 5_533_851_000, lineItems: [] },
    { name: 'Other Taxes', total: 2_724_021_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_327_533_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 177_692_000, lineItems: [] },
    { name: 'Property Taxes', total: 819_654_000, lineItems: [] },
    { name: 'Other Revenues', total: 366_677_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 309_565_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 234_410_000, lineItems: [] },
    { name: 'Departmental Services', total: 235_290_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 166_931_000, lineItems: [] },
    { name: 'Federal Revenues', total: 4_001_000, lineItems: [] },
  ]},
  2017: { total: 22_111_856_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 11_263_573_000, lineItems: [] },
    { name: 'Sales Taxes', total: 5_442_302_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_877_330_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_272_913_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 177_989_000, lineItems: [] },
    { name: 'Property Taxes', total: 848_463_000, lineItems: [] },
    { name: 'Other Revenues', total: 330_477_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 301_443_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 233_905_000, lineItems: [] },
    { name: 'Departmental Services', total: 190_439_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 168_226_000, lineItems: [] },
    { name: 'Federal Revenues', total: 4_796_000, lineItems: [] },
  ]},
  2016: { total: 21_555_138_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 11_013_385_000, lineItems: [] },
    { name: 'Sales Taxes', total: 5_217_805_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_862_792_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_414_531_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 62_005_000, lineItems: [] },
    { name: 'Property Taxes', total: 855_032_000, lineItems: [] },
    { name: 'Other Revenues', total: 249_380_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 286_219_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 222_306_000, lineItems: [] },
    { name: 'Departmental Services', total: 197_392_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 171_238_000, lineItems: [] },
    { name: 'Federal Revenues', total: 3_053_000, lineItems: [] },
  ]},
  2015: { total: 21_169_552_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 10_640_365_000, lineItems: [] },
    { name: 'Sales Taxes', total: 5_138_575_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_811_162_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_503_461_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 64_943_000, lineItems: [] },
    { name: 'Property Taxes', total: 836_257_000, lineItems: [] },
    { name: 'Other Revenues', total: 311_969_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 278_085_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 215_960_000, lineItems: [] },
    { name: 'Departmental Services', total: 196_884_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 170_747_000, lineItems: [] },
    { name: 'Federal Revenues', total: 1_144_000, lineItems: [] },
  ]},
  2014: { total: 19_922_250_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 9_859_403_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_980_503_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_750_926_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_302_563_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 138_728_000, lineItems: [] },
    { name: 'Property Taxes', total: 830_759_000, lineItems: [] },
    { name: 'Other Revenues', total: 213_123_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 260_503_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 205_965_000, lineItems: [] },
    { name: 'Departmental Services', total: 200_708_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 175_399_000, lineItems: [] },
    { name: 'Federal Revenues', total: 3_670_000, lineItems: [] },
  ]},
  2013: { total: 18_953_968_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 9_257_352_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_737_002_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_561_621_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_273_112_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 97_283_000, lineItems: [] },
    { name: 'Property Taxes', total: 817_895_000, lineItems: [] },
    { name: 'Other Revenues', total: 391_775_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 239_735_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 214_374_000, lineItems: [] },
    { name: 'Departmental Services', total: 191_006_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 170_060_000, lineItems: [] },
    { name: 'Federal Revenues', total: 2_753_000, lineItems: [] },
  ]},
  2012: { total: 17_246_846_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 8_267_608_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_574_768_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_464_448_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 996_524_000, lineItems: [] },
    { name: 'Investment/Interest Income', total: 38_282_000, lineItems: [] },
    { name: 'Property Taxes', total: 813_723_000, lineItems: [] },
    { name: 'Other Revenues', total: 306_889_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 220_065_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 225_681_000, lineItems: [] },
    { name: 'Departmental Services', total: 171_451_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 166_861_000, lineItems: [] },
    { name: 'Federal Revenues', total: 546_000, lineItems: [] },
  ]},
  // FY2011: GF Investment/Interest Income 108,862 + Securities Lending Income 58 = combined display
  // Net Revenues = 16,836,517 (includes Securities Lending Income 58 as a separate small line)
  // Folding Securities Lending Income into Investment/Interest Income for display (58K is trivial).
  2011: { total: 16_836_517_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 7_828_818_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_425_136_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_439_017_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_135_193_000, lineItems: [] },
    // 108,862 + 58 (Securities Lending Income) = 108,920 combined for display
    { name: 'Investment/Interest Income', total: 108_920_000, lineItems: [] },
    { name: 'Property Taxes', total: 766_926_000, lineItems: [] },
    { name: 'Other Revenues', total: 356_067_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 230_016_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 258_739_000, lineItems: [] },
    { name: 'Departmental Services', total: 114_545_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 172_886_000, lineItems: [] },
    { name: 'Federal Revenues', total: 254_000, lineItems: [] },
  ]},
  // FY2010: Net Revenues = 14,823,890 (from GAAP Governmental Funds statement, GENERAL FUND column)
  // Revenue lines extracted from the dotted-column pdftotext format:
  // Ind Income: 6,729,244 | Corporate: 540,504 | Sales: 4,181,319 | Property: 766,830 |
  // Motor Vehicle: 235,756 | Fuel: 0 (GF) | Other Taxes: 1,438,940 | Tobacco: 164,786 |
  // Fed Rev: 401 | Licenses/Fees: 256,278 | Departmental: 111,798 | Invest/Int: 63,127 |
  // Securities Lending: 183 | Other Revenues: 334,724
  // Sum: 6,729,244+540,504+4,181,319+766,830+235,756+1,438,940+164,786+401+256,278+111,798+63,127+183+334,724
  //    = 14,823,890 ✓ (matches published)
  2010: { total: 14_823_890_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 6_729_244_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_181_319_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_438_940_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 540_504_000, lineItems: [] },
    // 63,127 + 183 (Securities Lending) = 63,310 combined for display
    { name: 'Investment/Interest Income', total: 63_310_000, lineItems: [] },
    { name: 'Property Taxes', total: 766_830_000, lineItems: [] },
    { name: 'Other Revenues', total: 334_724_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 235_756_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 256_278_000, lineItems: [] },
    { name: 'Departmental Services', total: 111_798_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 164_786_000, lineItems: [] },
    { name: 'Federal Revenues', total: 401_000, lineItems: [] },
  ]},
  // FY2009: Net Revenues = 15,153,318 (from GAAP Governmental Funds statement, GENERAL FUND column)
  // Revenue lines extracted from dotted-column pdftotext format:
  // Ind Income: 7,162,974 | Corporate: 727,928 | Sales: 4,279,055 | Property: 729,373 |
  // Motor Vehicle: 244,917 | Fuel: 0 (GF) | Other Taxes: 1,196,171 | Tobacco: 179,854 |
  // Fed Rev: 0 (GF) | Licenses/Fees: 246,755 | Departmental: 47,503 | Invest/Int: 38,385 |
  // Securities Lending: 940 | Other Revenues: 299,463
  // Sum: 7,162,974+727,928+4,279,055+729,373+244,917+1,196,171+179,854+0+246,755+47,503+38,385+940+299,463
  //    = 15,153,318 ✓
  2009: { total: 15_153_318_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 7_162_974_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_279_055_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_196_171_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 727_928_000, lineItems: [] },
    // 38,385 + 940 (Securities Lending) = 39,325 combined for display
    { name: 'Investment/Interest Income', total: 39_325_000, lineItems: [] },
    { name: 'Property Taxes', total: 729_373_000, lineItems: [] },
    { name: 'Other Revenues', total: 299_463_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 244_917_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 246_755_000, lineItems: [] },
    { name: 'Departmental Services', total: 47_503_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 179_854_000, lineItems: [] },
    { name: 'Federal Revenues', total: 0, lineItems: [] },
  ]},
  // FY2008: Net Revenues = 16,600,864 (from GAAP Governmental Funds statement, GENERAL FUND column)
  // Revenue lines extracted from dotted-column pdftotext format:
  // Ind Income: 7,932,036 | Corporate: 1,024,040 | Sales: 4,499,400 | Property: 704,246 |
  // Motor Vehicle: 319,599 | Fuel: 0 (GF) | Other Taxes: 1,209,366 | Tobacco: 184,411 |
  // Fed Rev: 0 (GF) | Licenses/Fees: 254,691 | Departmental: 47,326 | Invest/Int: 95,900 |
  // Securities Lending: 9,197 | Other Revenues: 320,652
  // Sum: 7,932,036+1,024,040+4,499,400+704,246+319,599+1,209,366+184,411+0+254,691+47,326+95,900+9,197+320,652
  //    = 16,600,864 ✓
  2008: { total: 16_600_864_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 7_932_036_000, lineItems: [] },
    { name: 'Sales Taxes', total: 4_499_400_000, lineItems: [] },
    { name: 'Other Taxes', total: 1_209_366_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 1_024_040_000, lineItems: [] },
    // 95,900 + 9,197 (Securities Lending) = 105,097 combined for display
    { name: 'Investment/Interest Income', total: 105_097_000, lineItems: [] },
    { name: 'Property Taxes', total: 704_246_000, lineItems: [] },
    { name: 'Other Revenues', total: 320_652_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 319_599_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 254_691_000, lineItems: [] },
    { name: 'Departmental Services', total: 47_326_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 184_411_000, lineItems: [] },
    { name: 'Federal Revenues', total: 0, lineItems: [] },
  ]},
};

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
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

/**
 * buildTree — P2-aware (Phase 95, 2026-06-28).
 *
 * Policy P2 (Phase 94): For any category with a negative total (e.g. FY2022 Investment/Interest Income
 * due to GF investment losses):
 *   - Rendered area 'a' = Math.max(cat.total, 0)  — zero area in icicle, not dropped
 *   - Node label includes the signed value flagged "(net loss — shown at 0)"
 *   - Root node total = REVENUE[fy].total (audited Net Revenues verbatim, NOT recomputed from clamped leaves)
 *   - A footnote on the root node states that a category is net-negative
 *
 * Previously filtered out `c.total > 0` — that filter is removed (replaced by clamp).
 */
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  let hasNegative = false;
  const children = categories
    .filter(c => c.total !== 0)  // Only skip exact zero (FY2008/2009 Federal Revenues = 0 GF line)
    .map(cat => {
      const isNegative = cat.total < 0;
      if (isNegative) hasNegative = true;
      const displayName = isNegative
        ? `${cat.name}: -$${Math.abs(cat.total / 1e6).toFixed(0)}M (net loss — shown at 0)`
        : cat.name;
      return {
        n: displayName,
        a: Math.max(cat.total, 0),   // P2: clamp to 0 for render area
        i: (cat.lineItems || []).filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })),
      };
    });
  children.sort((a, b) => b.a - a.a);
  const rootNode = { n: 'Minnesota General Fund Revenue', a: total, c: children };
  if (hasNegative) {
    rootNode.footnote = `One or more revenue categories were net-negative in FY${fy} (investment losses) and are shown at zero area with their real signed value in the label. The total reflects audited Net Revenues including the negative line.`;
  }
  return { jsonTree: [rootNode], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: `${STATE_NAME} General Fund Revenue`, api_type: 'html', dataset_type: 'revenue', dataset_id: 'mn-gf-revenue', base_url: 'https://mn.gov/mmb/accounting/reports/annual-comprehensive-financial-report.jsp', fiscal_years: [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('name', srcPayload.name).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
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
    for (const cat of cats) {
      const displayAmt = cat.a === 0 ? '(net loss: $0 area)' : Math.round(cat.a).toLocaleString();
      console.log(`  ${cat.n.padEnd(50)}${displayAmt.padStart(20)}`);
    }
    console.log('─'.repeat(72)); console.log(`${'TOTAL REVENUE'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
    if (total > 0) console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (jsonTree[0].footnote) console.log(`NOTE: ${jsonTree[0].footnote}\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Stamp the per-FY source on the budget row (the RPC does not set source_url/source_date). Idempotent.
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} revenue row\n`);
    } else { console.error(`Could not find FY${fy} revenue budget row to stamp source`); process.exit(2); }
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
