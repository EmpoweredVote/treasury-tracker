#!/usr/bin/env node
/**
 * Rhode Island General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Rhode Island Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the RI state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   RI state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-49): RI ACFR GF ~1.93x NASBO GF (FY2025 $10,095,792K vs FY2024 NASBO
 *   $5,236,000K). Rhode Island's General Fund consolidates a large Federal grants line
 *   ($4,551,647K FY2025, ~45% of GF total revenues) into a single fund, whereas NASBO's
 *   narrower budgetary concept excludes most federal-passthrough activity. Same mechanism as
 *   MD/GA (~1.8-2.0x). Accepted-and-relabelled honestly (TX precedent).
 *
 * 4-COLUMN LAYOUT: GENERAL is the 1st of 4 (General | Intermodal Surface Transportation |
 *   Rhode Island Capital Plan | Other Governmental Funds | Total). extract_gf.py's
 *   position-anchor isolates General regardless of the total column count -- confirmed at
 *   both bookends (FY2025 rev $10,095,792K / FY2006 rev $4,585,920K, exact $0 diff on BOTH
 *   revenues and expenditures, byte-identical to the 117 recon) and on all 20 loaded years.
 *
 * OPAQUE PER-YEAR URLS (NC/GA/OK precedent -- no derivable pattern): every year's ACFR/CAFR
 *   lives under a date-stamped Drupal directory on controller.admin.ri.gov with no per-FY
 *   naming rule -- FY2006-FY2016 are bare "{YYYY}.pdf" filenames under a single 2025-01/
 *   re-publish directory, FY2017-FY2020 use "CAFR%2006-30-{YYYY}.pdf" under a 2022-04/
 *   directory, FY2021 "ACFR%206-30-2021.pdf" (same 2022-04/ directory), and FY2022-FY2025
 *   each live under their own individually-dated directory with a unique filename. All 20
 *   URLs enumerated directly from the financial-reports page and re-verified live at load
 *   (%PDF magic + size >500KB, all 20 years; largest FY2025 file is 102MB).
 *
 * FY2022 LITERAL TRAILING SPACE (the RI filename trap, confirmed live): the FY2022 filename
 *   is "ACFR 6-30-2022 .pdf" -- a literal space character between "2022" and ".pdf",
 *   URL-encoded as "%20" immediately before the extension. Verified byte-for-byte against the
 *   financial-reports page link and re-confirmed by a successful download (not a typo in this
 *   loader -- the space is genuinely present in RI's published filename).
 *
 * CLEAN EXTRACTION: no wrapped labels, no ALL-CAPS source text, no rev_boundary sub-heading
 *   complications (RI's "Taxes" line prints as a single un-broken-out revenue item, not a
 *   subsection header over several tax lines -- sub=None throughout every loaded year on the
 *   revenue side) -- all 20 years FY2006-FY2025 tied exactly on the first extraction pass on
 *   both the revenue and expenditure sides. Minor category-label drift across years is cohort-
 *   normal (e.g. "Human services" -> "Health and human services" from FY2020, "Licenses, fines,
 *   sales, and services" -> "Licenses, fines, tolls, sales, and services" from FY2018,
 *   "Income from investments" -> "Income (loss) from investments" from FY2025) -- default_rev_name/
 *   default_exp_name normalize via norm(), no manual patch needed.
 *
 * WINDOW: FY2006-FY2025 (20 years) is the full durable window per the 117 recon -- pre-FY2006
 *   files are discoverable on the financial-reports page but were not individually
 *   tie-confirmed within the recon budget; not chased further this pass.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Full-cohort negative scan (all 20 loaded years, both revenue and expenditure sections): ZERO negative GF line items found anywhere -- "Income from investments"/"Income (loss) from investments" is positive throughout (FY2025 +$47,546K / FY2006 +$2,000K, the recon-confirmed bookends). The column header itself flags a "(loss)" possibility (confirmed present from FY2025 onward) but no interior year triggers it. Clamp path (clampForRender / P2) stays wired per ACFR-32 as the tranche-standard safety net, unexercised for RI.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ri/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processRIAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Rhode Island'; const STATE_ABBR = 'RI'; const POPULATION = 1_097_379;
const EXPECTED_MUNI_ID = '483f02b4-2167-4e3d-9f5c-0f3ed83be2e6';
const UNITS = 1_000; // RI ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2006: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/CAFR%2006-30-2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/ACFR%206-30-2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2023-01/ACFR%206-30-2022%20.pdf', date: '2022-06-30' },
  2023: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2024-02/ACFR%206-30-2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-03/2024%20State%20of%20Rhode%20Island%20ACFR%206.30.24%20-%20Final.pdf', date: '2024-06-30' },
  2025: { url: 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Rhode Island State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — RI ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2006: { total: 4_975_674, confidence: 'actual', categories: [
    { name: 'General government',                        total:      318_675 },
    { name: 'Human services',                            total:    2_614_712 },
    { name: 'Education',                                 total:      263_735 },
    { name: 'Public safety',                             total:      361_567 },
    { name: 'Natural resources',                         total:       69_538 },
    { name: 'Capital outlays',                           total:       35_479 },
    { name: 'Intergovernmental',                         total:    1_186_887 },
    { name: 'Debt service — Principal',                  total:       73_700 },
    { name: 'Debt service — Interest and other charges', total:       51_381 },
  ]},
  2007: { total: 5_032_331, confidence: 'actual', categories: [
    { name: 'General government',                        total:      633_893 },
    { name: 'Human services',                            total:    2_512_286 },
    { name: 'Education',                                 total:    1_267_255 },
    { name: 'Public safety',                             total:      396_029 },
    { name: 'Natural resources',                         total:       81_518 },
    { name: 'Debt service — Principal',                  total:       79_954 },
    { name: 'Debt service — Interest and other charges', total:       61_396 },
  ]},
  2008: { total: 5_286_852, confidence: 'actual', categories: [
    { name: 'General government',                        total:      626_052 },
    { name: 'Human services',                            total:    2_727_534 },
    { name: 'Education',                                 total:    1_289_124 },
    { name: 'Public safety',                             total:      410_605 },
    { name: 'Natural resources',                         total:       72_982 },
    { name: 'Debt service — Principal',                  total:       92_077 },
    { name: 'Debt service — Interest and other charges', total:       68_478 },
  ]},
  2009: { total: 5_155_930, confidence: 'actual', categories: [
    { name: 'General government',                        total:      586_628 },
    { name: 'Human services',                            total:    2_711_167 },
    { name: 'Education',                                 total:    1_217_271 },
    { name: 'Public safety',                             total:      401_976 },
    { name: 'Natural resources',                         total:       68_932 },
    { name: 'Debt service — Principal',                  total:      102_683 },
    { name: 'Debt service — Interest and other charges', total:       67_273 },
  ]},
  2010: { total: 5_327_364, confidence: 'actual', categories: [
    { name: 'General government',                        total:      552_229 },
    { name: 'Human services',                            total:    2_884_419 },
    { name: 'Education',                                 total:    1_239_074 },
    { name: 'Public safety',                             total:      394_860 },
    { name: 'Natural resources',                         total:       67_427 },
    { name: 'Debt service — Principal',                  total:      115_395 },
    { name: 'Debt service — Interest and other charges', total:       73_960 },
  ]},
  2011: { total: 5_437_962, confidence: 'actual', categories: [
    { name: 'General government',                        total:      458_222 },
    { name: 'Human services',                            total:    3_009_097 },
    { name: 'Education',                                 total:    1_287_549 },
    { name: 'Public safety',                             total:      428_687 },
    { name: 'Natural resources',                         total:       71_812 },
    { name: 'Debt service — Principal',                  total:      106_961 },
    { name: 'Debt service — Interest and other charges', total:       75_634 },
  ]},
  2012: { total: 5_444_395, confidence: 'actual', categories: [
    { name: 'General government',                        total:      474_135 },
    { name: 'Human services',                            total:    2_969_166 },
    { name: 'Education',                                 total:    1_281_879 },
    { name: 'Public safety',                             total:      459_114 },
    { name: 'Natural resources',                         total:       75_141 },
    { name: 'Debt service — Principal',                  total:      111_711 },
    { name: 'Debt service — Interest and other charges', total:       73_249 },
  ]},
  2013: { total: 5_570_483, confidence: 'actual', categories: [
    { name: 'General government',                        total:      470_328 },
    { name: 'Human services',                            total:    3_042_705 },
    { name: 'Education',                                 total:    1_330_128 },
    { name: 'Public safety',                             total:      463_734 },
    { name: 'Natural resources',                         total:       70_145 },
    { name: 'Debt service — Principal',                  total:      125_148 },
    { name: 'Debt service — Interest and other charges', total:       68_295 },
  ]},
  2014: { total: 5_911_189, confidence: 'actual', categories: [
    { name: 'General government',                        total:      488_707 },
    { name: 'Human services',                            total:    3_325_538 },
    { name: 'Education',                                 total:    1_357_630 },
    { name: 'Public safety',                             total:      478_108 },
    { name: 'Natural resources',                         total:       76_118 },
    { name: 'Debt service — Principal',                  total:      117_975 },
    { name: 'Debt service — Interest and other charges', total:       67_113 },
  ]},
  2015: { total: 6_339_355, confidence: 'actual', categories: [
    { name: 'General government',                        total:      518_101 },
    { name: 'Human services',                            total:    3_661_964 },
    { name: 'Education',                                 total:    1_403_507 },
    { name: 'Public safety',                             total:      490_981 },
    { name: 'Natural resources',                         total:       79_897 },
    { name: 'Debt service — Principal',                  total:      123_178 },
    { name: 'Debt service — Interest and other charges', total:       61_727 },
  ]},
  2016: { total: 6_455_655, confidence: 'actual', categories: [
    { name: 'General government',                        total:      577_399 },
    { name: 'Human services',                            total:    3_694_123 },
    { name: 'Education',                                 total:    1_467_236 },
    { name: 'Public safety',                             total:      504_217 },
    { name: 'Natural resources',                         total:       78_270 },
    { name: 'Debt service — Principal',                  total:       74_705 },
    { name: 'Debt service — Interest and other charges', total:       59_705 },
  ]},
  2017: { total: 6_687_173, confidence: 'actual', categories: [
    { name: 'General government',                        total:      553_479 },
    { name: 'Human services',                            total:    3_831_633 },
    { name: 'Education',                                 total:    1_525_626 },
    { name: 'Public safety',                             total:      534_495 },
    { name: 'Natural resources',                         total:       77_556 },
    { name: 'Debt service — Principal',                  total:      103_176 },
    { name: 'Debt service — Interest and other charges', total:       61_208 },
  ]},
  2018: { total: 6_846_153, confidence: 'actual', categories: [
    { name: 'General government',                        total:      510_206 },
    { name: 'Human services',                            total:    3_928_845 },
    { name: 'Education',                                 total:    1_579_577 },
    { name: 'Public safety',                             total:      555_393 },
    { name: 'Natural resources',                         total:       80_820 },
    { name: 'Debt service — Principal',                  total:      131_903 },
    { name: 'Debt service — Interest and other charges', total:       59_409 },
  ]},
  2019: { total: 7_055_959, confidence: 'actual', categories: [
    { name: 'General government',                        total:      539_520 },
    { name: 'Human services',                            total:    4_034_359 },
    { name: 'Education',                                 total:    1_641_632 },
    { name: 'Public safety',                             total:      577_168 },
    { name: 'Natural resources',                         total:       81_986 },
    { name: 'Debt service — Principal',                  total:      120_488 },
    { name: 'Debt service — Interest and other charges', total:       60_806 },
  ]},
  2020: { total: 7_433_227, confidence: 'actual', categories: [
    { name: 'General government',                        total:      577_417 },
    { name: 'Health and human services',                 total:    4_325_361 },
    { name: 'Education',                                 total:    1_662_174 },
    { name: 'Public safety',                             total:      578_721 },
    { name: 'Natural resources',                         total:       83_703 },
    { name: 'Debt service — Principal',                  total:      143_503 },
    { name: 'Debt service — Interest and other charges', total:       62_348 },
  ]},
  2021: { total: 8_781_509, confidence: 'actual', categories: [
    { name: 'General government',                        total:    1_141_313 },
    { name: 'Health and human services',                 total:    4_925_442 },
    { name: 'Education',                                 total:    1_839_019 },
    { name: 'Public safety',                             total:      587_243 },
    { name: 'Natural resources',                         total:       85_374 },
    { name: 'Debt service — Principal',                  total:      139_023 },
    { name: 'Debt service — Interest and other charges', total:       64_095 },
  ]},
  2022: { total: 9_627_644, confidence: 'actual', categories: [
    { name: 'General government',                        total:    1_233_846 },
    { name: 'Health and human services',                 total:    5_446_643 },
    { name: 'Education',                                 total:    1_965_268 },
    { name: 'Public safety',                             total:      653_607 },
    { name: 'Natural resources',                         total:      112_029 },
    { name: 'Debt service — Principal',                  total:      155_990 },
    { name: 'Debt service — Interest and other charges', total:       60_261 },
  ]},
  2023: { total: 9_828_669, confidence: 'actual', categories: [
    { name: 'General government',                        total:    1_241_092 },
    { name: 'Health and human services',                 total:    5_352_501 },
    { name: 'Education',                                 total:    2_183_718 },
    { name: 'Public safety',                             total:      701_231 },
    { name: 'Natural resources',                         total:      125_842 },
    { name: 'Debt service — Principal',                  total:      162_860 },
    { name: 'Debt service — Interest and other charges', total:       61_425 },
  ]},
  2024: { total: 10_131_354, confidence: 'actual', categories: [
    { name: 'General government',                        total:    1_033_841 },
    { name: 'Health and human services',                 total:    5_691_998 },
    { name: 'Education',                                 total:    2_327_796 },
    { name: 'Public safety',                             total:      712_176 },
    { name: 'Natural resources',                         total:      103_586 },
    { name: 'Debt service — Principal',                  total:      191_988 },
    { name: 'Debt service — Interest and other charges', total:       69_969 },
  ]},
  2025: { total: 10_523_009, confidence: 'actual', categories: [
    { name: 'General government',                        total:    1_106_013 },
    { name: 'Health and human services',                 total:    6_041_606 },
    { name: 'Education',                                 total:    2_256_314 },
    { name: 'Public safety',                             total:      748_964 },
    { name: 'Natural resources',                         total:      126_800 },
    { name: 'Debt service — Principal',                  total:      176_257 },
    { name: 'Debt service — Interest and other charges', total:       67_055 },
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
  return { jsonTree: [{ n: 'Rhode Island General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Rhode Island General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ri-acfr-gf-operating', base_url: 'https://controller.admin.ri.gov/financial-reporting-and-accounting/financial-reports', fiscal_years: [2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
