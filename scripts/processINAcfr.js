#!/usr/bin/env node
/**
 * Indiana General Fund Operating (Expenditure) Loader — FY2002-FY2025 ACTUAL
 * Source: State of Indiana Annual Comprehensive Financial Report (ACFR/CAFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Indiana State Comptroller (in.gov/comptroller).
 *
 * Phase 113 (ACFR-21 + ACFR-31 + ACFR-32). Replaces the NASBO operating rows on the IN state node in
 *   place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 * Control = printed GENERAL FUND column "Total expenditures". Every FY2002–FY2025 ties $0 diff
 *   (extraction: pdftotext -table on local copies in _acfr-work/in/, NOT -layout).
 *   Bookends (GF Total revenues, thousands): FY2024 = 22,101,900 ; FY2002 = 7,341,746.
 *
 * Usage:
 *   node scripts/processINAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Indiana State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — IN ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim statement line items (tax lines suffixed " taxes"; debt-service lines prefixed) —
// extracted via pdftotext -table + tie-verified $0 diff vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 7_536_060, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_316_352 },
    { name: 'Public safety',                         total:      633_087 },
    { name: 'Health',                                total:      123_672 },
    { name: 'Welfare',                               total:      401_667 },
    { name: 'Conservation, culture and development', total:       70_845 },
    { name: 'Education',                             total:    4_986_602 },
    { name: 'Transportation',                        total:        3_811 },
    { name: 'Other',                                 total:           24 },
  ]},
  2003: { total: 7_522_226, confidence: 'actual', categories: [
    { name: 'General government',                    total:      913_660 },
    { name: 'Public safety',                         total:      599_430 },
    { name: 'Health',                                total:       93_131 },
    { name: 'Welfare',                               total:      375_536 },
    { name: 'Conservation, culture and development', total:       62_328 },
    { name: 'Education',                             total:    5_473_045 },
    { name: 'Transportation',                        total:        5_096 },
  ]},
  2004: { total: 7_625_452, confidence: 'actual', categories: [
    { name: 'General government',                    total:      941_421 },
    { name: 'Public safety',                         total:      629_864 },
    { name: 'Health',                                total:      102_565 },
    { name: 'Welfare',                               total:      364_587 },
    { name: 'Conservation, culture and development', total:       56_922 },
    { name: 'Education',                             total:    5_526_576 },
    { name: 'Transportation',                        total:        3_517 },
  ]},
  2005: { total: 7_855_183, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_128_976 },
    { name: 'Public safety',                         total:      622_966 },
    { name: 'Health',                                total:       99_624 },
    { name: 'Welfare',                               total:      366_067 },
    { name: 'Conservation, culture and development', total:       80_183 },
    { name: 'Education',                             total:    5_555_431 },
    { name: 'Transportation',                        total:        1_936 },
  ]},
  2006: { total: 8_269_820, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_188_610 },
    { name: 'Public safety',                         total:      600_863 },
    { name: 'Health',                                total:       96_587 },
    { name: 'Welfare',                               total:      346_883 },
    { name: 'Conservation, culture and development', total:       72_968 },
    { name: 'Education',                             total:    5_962_957 },
    { name: 'Transportation',                        total:          952 },
  ]},
  2007: { total: 8_374_702, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_186_039 },
    { name: 'Public safety',                         total:      622_272 },
    { name: 'Health',                                total:       86_002 },
    { name: 'Welfare',                               total:      313_593 },
    { name: 'Conservation, culture and development', total:       85_060 },
    { name: 'Education',                             total:    6_080_511 },
    { name: 'Transportation',                        total:        1_225 },
  ]},
  2008: { total: 8_963_612, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_526_935 },
    { name: 'Public safety',                         total:      682_091 },
    { name: 'Health',                                total:       93_455 },
    { name: 'Welfare',                               total:      284_049 },
    { name: 'Conservation, culture and development', total:       87_121 },
    { name: 'Education',                             total:    6_288_452 },
    { name: 'Transportation',                        total:        1_509 },
  ]},
  2009: { total: 10_550_589, confidence: 'actual', categories: [
    { name: 'General government',                    total:    2_144_038 },
    { name: 'Public safety',                         total:      714_838 },
    { name: 'Health',                                total:       67_140 },
    { name: 'Welfare',                               total:      307_186 },
    { name: 'Conservation, culture and development', total:       88_026 },
    { name: 'Education',                             total:    7_227_174 },
    { name: 'Transportation',                        total:        2_187 },
  ]},
  2010: { total: 10_588_632, confidence: 'actual', categories: [
    { name: 'General government',                    total:      582_063 },
    { name: 'Public safety',                         total:      705_219 },
    { name: 'Health',                                total:       60_138 },
    { name: 'Welfare',                               total:      529_366 },
    { name: 'Conservation, culture and development', total:       80_265 },
    { name: 'Education',                             total:    8_629_877 },
    { name: 'Transportation',                        total:        1_704 },
  ]},
  2011: { total: 11_103_731, confidence: 'actual', categories: [
    { name: 'General government',                    total:      957_408 },
    { name: 'Public safety',                         total:      671_302 },
    { name: 'Health',                                total:       46_841 },
    { name: 'Welfare',                               total:      641_873 },
    { name: 'Conservation, culture and development', total:       74_116 },
    { name: 'Education',                             total:    8_710_221 },
    { name: 'Transportation',                        total:        1_970 },
  ]},
  2012: { total: 11_703_034, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_599_461 },
    { name: 'Public safety',                         total:      708_233 },
    { name: 'Health',                                total:       42_650 },
    { name: 'Welfare',                               total:      601_031 },
    { name: 'Conservation, culture and development', total:       53_859 },
    { name: 'Education',                             total:    8_696_505 },
    { name: 'Transportation',                        total:        1_295 },
  ]},
  2013: { total: 12_078_737, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_479_884 },
    { name: 'Public safety',                         total:      774_855 },
    { name: 'Health',                                total:       38_690 },
    { name: 'Welfare',                               total:      822_390 },
    { name: 'Conservation, culture and development', total:       54_360 },
    { name: 'Education',                             total:    8_907_518 },
    { name: 'Transportation',                        total:        1_040 },
  ]},
  2014: { total: 11_912_992, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_058_290 },
    { name: 'Public safety',                         total:      872_232 },
    { name: 'Health',                                total:       43_249 },
    { name: 'Welfare',                               total:      673_152 },
    { name: 'Conservation, culture and development', total:       57_687 },
    { name: 'Education',                             total:    9_206_824 },
    { name: 'Transportation',                        total:        1_558 },
  ]},
  2015: { total: 12_173_650, confidence: 'actual', categories: [
    { name: 'General government',                     total:    1_136_224 },
    { name: 'Public safety',                          total:      883_613 },
    { name: 'Health',                                 total:       44_427 },
    { name: 'Welfare',                                total:      698_143 },
    { name: 'Conservation, culture and development',  total:       58_860 },
    { name: 'Education',                              total:    9_340_771 },
    { name: 'Transportation',                         total:          487 },
    { name: 'Debt service — Capital lease principal', total:        6_096 },
    { name: 'Debt service — Capital lease interest',  total:        5_029 },
  ]},
  2016: { total: 12_718_912, confidence: 'actual', categories: [
    { name: 'General government',                     total:    1_310_960 },
    { name: 'Public safety',                          total:      922_131 },
    { name: 'Health',                                 total:       45_383 },
    { name: 'Welfare',                                total:      802_150 },
    { name: 'Conservation, culture and development',  total:       72_500 },
    { name: 'Education',                              total:    9_553_259 },
    { name: 'Transportation',                         total:          157 },
    { name: 'Debt service — Capital lease principal', total:        7_154 },
    { name: 'Debt service — Capital lease interest',  total:        5_218 },
  ]},
  2017: { total: 13_011_200, confidence: 'actual', categories: [
    { name: 'General government',                     total:      940_349 },
    { name: 'Public safety',                          total:    1_102_174 },
    { name: 'Health',                                 total:       48_160 },
    { name: 'Welfare',                                total:      990_317 },
    { name: 'Conservation, culture and development',  total:       97_337 },
    { name: 'Education',                              total:    9_683_413 },
    { name: 'Transportation',                         total:      143_511 },
    { name: 'Debt service — Capital lease principal', total:        5_548 },
    { name: 'Debt service — Capital lease interest',  total:          391 },
  ]},
  2018: { total: 13_805_713, confidence: 'actual', categories: [
    { name: 'General government',                     total:      961_207 },
    { name: 'Public safety',                          total:    1_146_856 },
    { name: 'Health',                                 total:       45_960 },
    { name: 'Welfare',                                total:    1_178_934 },
    { name: 'Conservation, culture and development',  total:       90_521 },
    { name: 'Education',                              total:   10_210_951 },
    { name: 'Transportation',                         total:      167_727 },
    { name: 'Debt service — Capital lease principal', total:        3_031 },
    { name: 'Debt service — Capital lease interest',  total:          526 },
  ]},
  2019: { total: 14_267_737, confidence: 'actual', categories: [
    { name: 'General government',                     total:    1_198_677 },
    { name: 'Public safety',                          total:    1_184_691 },
    { name: 'Health',                                 total:       47_350 },
    { name: 'Welfare',                                total:    1_010_989 },
    { name: 'Conservation, culture and development',  total:      119_901 },
    { name: 'Education',                              total:   10_538_581 },
    { name: 'Transportation',                         total:      165_186 },
    { name: 'Debt service — Capital lease principal', total:        2_081 },
    { name: 'Debt service — Capital lease interest',  total:          281 },
  ]},
  2020: { total: 14_248_261, confidence: 'actual', categories: [
    { name: 'General government',                     total:    1_006_412 },
    { name: 'Public safety',                          total:    1_054_644 },
    { name: 'Health',                                 total:       21_351 },
    { name: 'Welfare',                                total:    1_210_520 },
    { name: 'Conservation, culture and development',  total:      121_215 },
    { name: 'Education',                              total:   10_598_534 },
    { name: 'Transportation',                         total:      231_565 },
    { name: 'Debt service — Capital lease principal', total:        3_669 },
    { name: 'Debt service — Capital lease interest',  total:          351 },
  ]},
  2021: { total: 14_676_134, confidence: 'actual', categories: [
    { name: 'General government',                     total:    1_054_614 },
    { name: 'Public safety',                          total:      988_743 },
    { name: 'Health',                                 total:        5_242 },
    { name: 'Welfare',                                total:    1_073_601 },
    { name: 'Conservation, culture and development',  total:      143_133 },
    { name: 'Education',                              total:   11_199_277 },
    { name: 'Transportation',                         total:      207_660 },
    { name: 'Debt service — Capital lease principal', total:        3_583 },
    { name: 'Debt service — Capital lease interest',  total:          281 },
  ]},
  2022: { total: 16_104_058, confidence: 'actual', categories: [
    { name: 'General government',                                   total:    1_998_846 },
    { name: 'Public safety',                                        total:    1_311_228 },
    { name: 'Health',                                               total:       46_601 },
    { name: 'Welfare',                                              total:    1_055_481 },
    { name: 'Conservation, culture and development',                total:      159_546 },
    { name: 'Education',                                            total:   11_175_788 },
    { name: 'Transportation',                                       total:      207_937 },
    { name: 'Debt service — Lease and financed purchase principal', total:       10_904 },
    { name: 'Debt service — Lease and financed purchase interest',  total:          950 },
    { name: 'Capital outlay',                                       total:      136_777 },
  ]},
  2023: { total: 20_298_587, confidence: 'actual', categories: [
    { name: 'General government',                    total:    4_359_839 },
    { name: 'Public safety',                         total:    1_352_731 },
    { name: 'Health',                                total:      104_895 },
    { name: 'Welfare',                               total:    1_125_560 },
    { name: 'Conservation, culture and development', total:      991_071 },
    { name: 'Education',                             total:   12_286_161 },
    { name: 'Transportation',                        total:       26_364 },
    { name: 'Debt service — Principal',              total:       19_463 },
    { name: 'Debt service — Interest',               total:        3_138 },
    { name: 'Capital outlay',                        total:       29_365 },
  ]},
  2024: { total: 18_534_655, confidence: 'actual', categories: [
    { name: 'General government',                    total:    2_244_483 },
    { name: 'Public safety',                         total:    1_514_205 },
    { name: 'Health',                                total:      232_490 },
    { name: 'Welfare',                               total:    1_324_026 },
    { name: 'Conservation, culture and development', total:      182_414 },
    { name: 'Education',                             total:   12_583_671 },
    { name: 'Transportation',                        total:       49_568 },
    { name: 'Debt service — Principal',              total:       19_590 },
    { name: 'Debt service — Interest',               total:        5_086 },
    { name: 'Capital outlay',                        total:      379_122 },
  ]},
  2025: { total: 19_123_203, confidence: 'actual', categories: [
    { name: 'General government',                    total:    1_823_011 },
    { name: 'Public safety',                         total:    1_666_555 },
    { name: 'Health',                                total:      319_339 },
    { name: 'Welfare',                               total:    1_440_479 },
    { name: 'Conservation, culture and development', total:      162_231 },
    { name: 'Education',                             total:   13_139_453 },
    { name: 'Transportation',                        total:       47_634 },
    { name: 'Debt service — Principal',              total:       21_611 },
    { name: 'Debt service — Interest',               total:        7_315 },
    { name: 'Capital outlay',                        total:      495_575 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 1_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
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
  return { jsonTree: [{ n: 'Indiana General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Indiana General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'in-acfr-gf-operating', base_url: 'https://www.in.gov/comptroller/Annual-Comprehensive-Financial-Reports', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
    const neg = EXPENDITURES[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (net loss — shown at 0)]`);
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
