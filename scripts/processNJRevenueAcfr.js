#!/usr/bin/env node
/**
 * New Jersey General Fund Revenue (by source) Loader — FY2002-FY2025 ACTUAL
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
 *   FY2002 (confirmed by inspecting each year's printed units note + per-capita sanity across
 *   FY2002-FY2025 — no thousands-era override needed).
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
 *   isolating that exact bare title+subtitle pair before handing a scoped snippet to the shared
 *   token-order/positional extractors eliminates the false-match. FY2002-FY2003 need the
 *   positional fallback (blank-GF-cell years — a "$"-glyph pdftotext artifact renders as a bare
 *   "--" ahead of every dollar figure, so token order alone misassigns cells); FY2004-FY2025 tie
 *   on token order. This was VERIFIED to reproduce the existing FY2020-FY2025 embedded totals
 *   exactly (bookend regression check, $0 delta) before being used to derive the newly-embedded
 *   FY2002-FY2019 categories below — the transcribed data below IS this extraction's tied
 *   output (embedded once fully verified, not re-parsed at runtime, per this loader's existing
 *   architecture).
 *
 * SOURCES uses EXPLICIT per-year URLs enumerated from nj.gov/treasury/omb/fr.shtml (never
 *   derived blindly) — identical map to processNJAcfr.js (same statement, same PDF per year).
 *
 * TX-TRAP SCOPE NOTE (ACFR-19): NJ ACFR General Fund ~1.15× NASBO GF (smallest divergence in the
 *   tranche) — the GAAP General Fund consolidates federal/intergovernmental revenue ("Federal and
 *   other grants") that NASBO's budgetary concept excludes. Accepted-and-relabelled honestly.
 *
 * P2 CLAMP (ACFR-20): NJ "Investment earnings" is positive in every FY2020-2025 loaded year;
 *   FY2009 (financial-crisis year, newly recovered) has ONE negative category (Investment
 *   earnings -$11,876,353) — clampForRender renders it at 0, true signed value preserved in the
 *   console note. No other negative categories across FY2002-FY2025.
 *
 * Control = printed General-Fund-column "Total Revenues" (dollars). Each FY's transcribed
 *   rev-by-source categories tie to the printed Total or the loader refuses to write (exit 2).
 *   Bookends: FY2025 = 60,979,024,211 ; FY2002 = 21,939,257,600. All 24 FYs tie 0 diff.
 *   Extraction: pdftotext -table on local PDFs in _acfr-work/nj/ (NOT -layout).
 *
 * Usage: node scripts/processNJRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `New Jersey State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund revenues by source — NJ ACFR, GENERAL FUND column (raw DOLLARS; UNITS=1).
// Verbatim ACFR revenue source names from the Governmental Funds Statement of Rev/Exp/Changes.
// total = printed General-Fund "Total Revenues" (dollars). All 24 FYs tie 0 diff.
const REVENUE = {
  2002: { total: 21_939_257_600, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 9_615_364_634 },
    { name: 'Federal and other grants',   total: 6_864_935_878 },
    { name: 'Other',                      total: 3_149_451_463 },
    { name: 'Services and assessments',   total: 1_286_395_369 },
    { name: 'Licenses and fees',          total:   778_060_921 },
    { name: 'Contributions',              total:   231_238_095 },
    { name: 'Investment earnings',        total:    13_811_240 },
  ]},
  2003: { total: 24_559_781_706, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 11_234_979_182 },
    { name: 'Federal and other grants',   total:  7_159_907_110 },
    { name: 'Other',                      total:  3_394_039_232 },
    { name: 'Services and assessments',   total:  1_343_734_586 },
    { name: 'Licenses and fees',          total:    878_472_321 },
    { name: 'Contributions',              total:    510_204_967 },
    { name: 'Investment earnings',        total:     38_444_308 },
  ]},
  2004: { total: 24_788_219_646, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 11_866_659_748 },
    { name: 'Federal and other grants',   total:  7_653_663_535 },
    { name: 'Other',                      total:  2_778_541_616 },
    { name: 'Services and assessments',   total:  1_458_046_470 },
    { name: 'Licenses and fees',          total:    706_970_624 },
    { name: 'Contributions',              total:    281_865_051 },
    { name: 'Investment earnings',        total:     42_472_602 },
  ]},
  2005: { total: 25_706_389_910, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 12_331_317_446 },
    { name: 'Federal and other grants',   total:  7_853_084_617 },
    { name: 'Other',                      total:  3_058_063_129 },
    { name: 'Services and assessments',   total:  1_588_039_665 },
    { name: 'Licenses and fees',          total:    817_250_561 },
    { name: 'Investment earnings',        total:     58_633_842 },
    { name: 'Contributions',              total:            650 },
  ]},
  2006: { total: 27_666_686_164, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 13_572_024_514 },
    { name: 'Federal and other grants',   total:  8_298_340_121 },
    { name: 'Other',                      total:  3_161_810_724 },
    { name: 'Services and assessments',   total:  1_680_919_074 },
    { name: 'Licenses and fees',          total:    839_593_571 },
    { name: 'Investment earnings',        total:    113_996_718 },
    { name: 'Contributions',              total:          1_442 },
  ]},
  2007: { total: 28_512_867_194, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 15_038_368_917 },
    { name: 'Federal and other grants',   total:  8_400_214_087 },
    { name: 'Other',                      total:  2_105_802_258 },
    { name: 'Services and assessments',   total:  1_580_278_356 },
    { name: 'Licenses and fees',          total:  1_234_299_235 },
    { name: 'Investment earnings',        total:    153_902_721 },
    { name: 'Contributions',              total:          1_620 },
  ]},
  2008: { total: 29_150_698_861, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 15_414_147_171 },
    { name: 'Federal and other grants',   total:  8_650_050_707 },
    { name: 'Other',                      total:  2_174_548_245 },
    { name: 'Services and assessments',   total:  1_681_978_536 },
    { name: 'Licenses and fees',          total:  1_131_760_281 },
    { name: 'Investment earnings',        total:     98_212_336 },
    { name: 'Contributions',              total:          1_585 },
  ]},
  2009: { total: 29_178_277_740, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 14_142_387_477 },
    { name: 'Federal and other grants',   total:  9_889_434_758 },
    { name: 'Other',                      total:  2_377_165_326 },
    { name: 'Services and assessments',   total:  1_694_732_863 },
    { name: 'Licenses and fees',          total:  1_086_432_369 },
    { name: 'Contributions',              total:          1_300 },
    { name: 'Investment earnings',        total:    -11_876_353 },
  ]},
  2010: { total: 30_777_686_614, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 13_165_444_088 },
    { name: 'Federal and other grants',   total: 12_562_884_852 },
    { name: 'Other',                      total:  2_284_408_882 },
    { name: 'Services and assessments',   total:  1_628_392_658 },
    { name: 'Licenses and fees',          total:  1_122_043_710 },
    { name: 'Investment earnings',        total:     14_510_043 },
    { name: 'Contributions',              total:          2_381 },
  ]},
  2011: { total: 30_463_289_923, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 13_639_804_118 },
    { name: 'Federal and other grants',   total: 11_698_061_097 },
    { name: 'Other',                      total:  2_245_999_860 },
    { name: 'Services and assessments',   total:  1_660_637_465 },
    { name: 'Licenses and fees',          total:  1_185_312_317 },
    { name: 'Investment earnings',        total:     33_472_956 },
    { name: 'Contributions',              total:          2_110 },
  ]},
  2012: { total: 30_321_619_383, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 13_322_342_618 },
    { name: 'Federal and other grants',   total: 11_426_543_840 },
    { name: 'Other',                      total:  2_775_135_360 },
    { name: 'Services and assessments',   total:  1_617_823_551 },
    { name: 'Licenses and fees',          total:  1_168_023_182 },
    { name: 'Investment earnings',        total:     11_749_692 },
    { name: 'Contributions',              total:          1_140 },
  ]},
  2013: { total: 31_717_076_713, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 14_018_603_521 },
    { name: 'Federal and other grants',   total: 11_742_726_286 },
    { name: 'Other',                      total:  3_105_103_273 },
    { name: 'Services and assessments',   total:  1_634_970_880 },
    { name: 'Licenses and fees',          total:  1_209_328_260 },
    { name: 'Investment earnings',        total:      6_343_003 },
    { name: 'Contributions',              total:          1_490 },
  ]},
  2014: { total: 33_956_924_494, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 14_360_802_999 },
    { name: 'Federal and other grants',   total: 13_166_170_282 },
    { name: 'Other',                      total:  3_394_091_875 },
    { name: 'Services and assessments',   total:  1_770_334_788 },
    { name: 'Licenses and fees',          total:  1_243_592_034 },
    { name: 'Investment earnings',        total:     21_932_516 },
  ]},
  2015: { total: 36_771_269_050, confidence: 'actual', categories: [
    { name: 'Taxes',                      total: 15_330_177_188 },
    { name: 'Federal and other grants',   total: 15_155_506_266 },
    { name: 'Other',                      total:  3_238_472_255 },
    { name: 'Services and assessments',   total:  1_778_665_788 },
    { name: 'Licenses and fees',          total:  1_263_198_017 },
    { name: 'Investment earnings',        total:      5_249_536 },
  ]},
  2016: { total: 34_509_156_828, confidence: 'actual', categories: [
    { name: 'Taxes',                              total: 15_127_170_462 },
    { name: 'Federal and other grants',           total: 14_707_348_661 },
    { name: 'Services and assessments',           total:  2_029_174_784 },
    { name: 'Licenses and fees',                  total:  1_361_719_397 },
    { name: 'Other',                              total:    799_304_127 },
    { name: 'Component Units and Port Authority', total:    477_310_484 },
    { name: 'Investment earnings',                total:      7_128_913 },
  ]},
  2017: { total: 35_797_914_706, confidence: 'actual', categories: [
    { name: 'Taxes',                              total: 15_917_964_853 },
    { name: 'Federal and other grants',           total: 14_911_931_135 },
    { name: 'Services and assessments',           total:  1_803_487_336 },
    { name: 'Licenses and fees',                  total:  1_413_500_225 },
    { name: 'Other',                              total:  1_067_320_061 },
    { name: 'Component Units and Port Authority', total:    641_086_523 },
    { name: 'Investment earnings',                total:     42_624_573 },
  ]},
  2018: { total: 36_406_974_967, confidence: 'actual', categories: [
    { name: 'Taxes',                              total: 16_499_163_603 },
    { name: 'Federal and other grants',           total: 14_713_010_988 },
    { name: 'Services and assessments',           total:  1_754_959_023 },
    { name: 'Other',                              total:  1_659_751_708 },
    { name: 'Licenses and fees',                  total:  1_375_027_146 },
    { name: 'Component Units and Port Authority', total:    349_976_882 },
    { name: 'Investment earnings',                total:     55_085_617 },
  ]},
  2019: { total: 38_590_165_700, confidence: 'actual', categories: [
    { name: 'Taxes',                              total: 18_453_360_689 },
    { name: 'Federal and other grants',           total: 15_097_176_569 },
    { name: 'Services and assessments',           total:  1_809_450_424 },
    { name: 'Licenses and fees',                  total:  1_406_699_358 },
    { name: 'Other',                              total:  1_355_298_172 },
    { name: 'Component Units and Port Authority', total:    383_931_029 },
    { name: 'Investment earnings',                total:     84_249_459 },
  ]},
  2020: { total: 38_768_977_008, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 17_769_218_114 },
    { name: 'Federal and other grants',          total: 16_465_961_692 },
    { name: 'Services and assessments',          total:  1_929_890_116 },
    { name: 'Licenses and fees',                 total:  1_246_220_106 },
    { name: 'Other',                             total:  1_092_941_716 },
    { name: 'Component Units and Port Authority',total:    199_261_897 },
    { name: 'Investment earnings',               total:     65_483_367 },
  ]},
  2021: { total: 48_182_629_272, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 22_570_520_406 },
    { name: 'Federal and other grants',          total: 20_749_590_577 },
    { name: 'Services and assessments',          total:  1_982_119_316 },
    { name: 'Licenses and fees',                 total:  1_489_455_586 },
    { name: 'Other',                             total:  1_145_826_133 },
    { name: 'Component Units and Port Authority',total:    219_052_270 },
    { name: 'Investment earnings',               total:     26_064_984 },
  ]},
  2022: { total: 57_510_588_567, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 27_083_749_525 },
    { name: 'Federal and other grants',          total: 24_821_548_745 },
    { name: 'Services and assessments',          total:  2_017_816_056 },
    { name: 'Other',                             total:  1_753_877_406 },
    { name: 'Licenses and fees',                 total:  1_431_897_949 },
    { name: 'Component Units and Port Authority',total:    363_030_124 },
    { name: 'Investment earnings',               total:     38_668_762 },
  ]},
  2023: { total: 61_016_633_737, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 27_093_040_155 },
    { name: 'Federal and other grants',          total: 26_449_583_346 },
    { name: 'Services and assessments',          total:  2_265_920_747 },
    { name: 'Other',                             total:  2_053_171_608 },
    { name: 'Licenses and fees',                 total:  1_456_856_815 },
    { name: 'Investment earnings',               total:    928_949_659 },
    { name: 'Component Units and Port Authority',total:    769_111_407 },
  ]},
  2024: { total: 60_554_040_145, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 26_698_781_241 },
    { name: 'Federal and other grants',          total: 25_579_758_801 },
    { name: 'Services and assessments',          total:  2_949_512_530 },
    { name: 'Other',                             total:  2_133_031_203 },
    { name: 'Licenses and fees',                 total:  1_470_981_982 },
    { name: 'Investment earnings',               total:  1_236_245_708 },
    { name: 'Component Units and Port Authority',total:    485_728_680 },
  ]},
  2025: { total: 60_979_024_211, confidence: 'actual', categories: [
    { name: 'Taxes',                             total: 27_535_370_653 },
    { name: 'Federal and other grants',          total: 25_944_819_933 },
    { name: 'Other',                             total:  2_385_370_907 },
    { name: 'Services and assessments',          total:  2_140_760_752 },
    { name: 'Licenses and fees',                 total:  1_582_616_065 },
    { name: 'Investment earnings',               total:    952_995_499 },
    { name: 'Component Units and Port Authority',total:    437_090_402 },
  ]},
};

// P2 (ACFR-20): clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 1_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'New Jersey General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (Phase 114 hardening): reject --fy values that are not loadable years — a typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : Object.keys(REVENUE).map(Number).sort((a, b) => a - b);
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, General Fund, DOLLARS)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06 (Phase 114 hardening): validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (REVENUE[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
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
    const srcPayload = { name: 'New Jersey General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'nj-acfr-gf-revenue', base_url: 'https://www.nj.gov/treasury/omb/fr.shtml', fiscal_years: Object.keys(REVENUE).map(Number).sort((a, b) => a - b), municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  try {
    for (const fy of years) {
      if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
      console.log(`── FY${fy} ─────────────────────────────────────────────`);
      console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
      const { jsonTree, total, rowCount } = buildTree(fy);
      const cats = jsonTree[0].c;
      console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
      for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
      const neg = REVENUE[fy].categories.filter(c => c.total < 0);
      for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (net loss — shown at 0)]`);
      console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
      console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
      if (dryRun) { console.log(`(dry-run)\n`); continue; }
      const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
      if (rpcErr) throw new Error(`FY${fy} RPC error: ${rpcErr.message}`);
      if (r?.error) throw new Error(`FY${fy} RPC error: ${r.error}`);
      console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
      if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`); // WR-07: surface select errors — do not misreport as a missing row
      if (bud?.id) {
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
        if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`);
        console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
      } else { throw new Error(`Could not find FY${fy} revenue budget row to stamp source`); }
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
