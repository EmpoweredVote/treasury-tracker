#!/usr/bin/env node
/**
 * South Dakota General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of South Dakota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the SD state node → pure insert keyed (muni,fy,'revenue').
 *   SD state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-50): SD ACFR GF ~1.03x NASBO GF (FY2025 $2,423,413K vs FY2024 NASBO
 *   $2,362,000K) -- the SMALLEST divergence in the entire v2.15 milestone. South Dakota's
 *   federal-passthrough revenue ("Administering Programs", $748,507K FY2025, routed through
 *   Transportation/Social Services Federal/COVID-19 Federal columns) does NOT consolidate into
 *   the GENERAL FUND column, keeping GF near-parity with NASBO's narrower budgetary concept.
 *   Accepted-and-relabelled honestly (TX/NE precedent), though the divergence is minimal.
 *
 * CLEANLY DERIVABLE URL, FIXED ERA BOUNDARY -- the best URL pattern in Batch 4:
 *   bfm.sd.gov/acfr/SD_ACFR_{YYYY}.PDF (FY2021-FY2025) / SD_CAFR_{YYYY}.PDF (FY2002-FY2020).
 *   Landing: bfm.sd.gov/ACFR/. All 24 PDFs confirmed real (%PDF magic, application/pdf).
 *
 * 7-COLUMN LAYOUT (5-column pre-FY2003): GENERAL FUND is the 1st of 7 (General Fund |
 *   Transportation | Social Services Federal | COVID-19 Federal [from FY2021] | Dakota Cement
 *   Trust | Education Enhancement Trust | Nonmajor | Total). FY2002 had only 5 columns (no
 *   COVID-19 Federal, no Education Enhancement Trust) -- extract_gf.py's position-anchor
 *   isolates General regardless of the total column count -- confirmed at both bookends
 *   (FY2025 rev $2,423,413K / FY2002 rev $697,589K, exact $0 diff) and on all 24 loaded years.
 *
 * SHARED EXTRACTOR FIXES (ACFR-50 discovered both, reusable): (1) SD's statement prints the
 *   SINGULAR 'Revenue:' section header and 'Total Revenue' row label (no trailing 's'),
 *   unlike every other cohort state's plural 'Revenues:'/'Total Revenues' -- the hardcoded
 *   plural-only match silently returned zero revenue items/total every year. Fixed generically
 *   in extract_gf.py: match the singular stem ('revenue'/'totalrevenue', a safe superset of the
 *   plural forms). (2) re-verified zero regression against the whole already-loaded cohort
 *   (every prior state's statement already used the plural form, so the widened match is a
 *   no-op for them).
 *
 * WHOLE-DOCUMENT SCANNED/UNRENDERABLE PDFs (9 years, IA FY2008 precedent generalized): FY2003-
 *   2006 and FY2010 are entirely embedded-image scans (`pdffonts`/`pdfimages` confirm zero
 *   embedded fonts, every page a raster image) -- zero-length `pdftotext` extraction across the
 *   WHOLE document, not just the statement page. FY2007-2009 and FY2011 report embedded fonts
 *   in `pdffonts` yet still extract to near-zero text (a font-subsetting/CID-mapping defect,
 *   not a scan) -- same practical effect. All 9 years hand-transcribed from `pdftoppm`
 *   150-300dpi-rendered GENERAL FUND column images (NM FY2022 / OK FY2019 precedent, generalized
 *   from a single page to a whole document), independently re-summed to $0 diff against the
 *   printed GENERAL FUND "Total Revenue"/"Total Expenditures" line for every single year before
 *   hand-patching sd_all.json.
 *
 * POST-2021 8-COLUMN STRAY-SPACE DIGIT-SPLIT (FY2024/FY2025, new defect this state discovered):
 *   the wider 8-column layout (added COVID-19 Federal) causes `pdftotext -table` to render some
 *   digit groups with a stray injected space (e.g. "135, 074" instead of "135,074"), which
 *   silently truncates `parse_num`'s regex match and also shifts blank-GF-cell rows' first
 *   printed token into a neighboring fund column (same class of defect as NE's DASH_TOKEN
 *   fix, but a comma-splitting variant instead of a placeholder-glyph variant). Both years
 *   hand-transcribed from rendered images instead of patching the regex (2 years, not worth a
 *   new generic tokenizer change); FY2025 GF Total Revenue $2,423,413K matches the 117 recon
 *   bookend exactly.
 *
 * HONEST SINGLE-DIGIT HAND-PATCH (FY2017/FY2019): auto-extraction ties exactly on expenditures
 *   both years but silently drops a single-digit GF "Administering Programs" value (FY2017 $2K,
 *   FY2019 $8K) that `pdftotext -table` renders with unusually tight column spacing relative to
 *   the label -- re-verified against the printed page, hand-patched into sd_all.json's revenue
 *   items, now ties exactly $0 diff both years.
 *
 * WINDOW: FY2002-FY2025 (24 years, the full recon target window), ZERO honest holes -- every
 *   single year ties $0 diff on both the revenue and expenditure printed GENERAL FUND totals.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): Full-cohort negative scan (all 24 loaded years, both revenue and expenditure sections): exactly ONE genuine negative interior line found -- FY2022 "Use of Money and Property" revenue = -$32,246K (a real GAAP fair-value-of-investments loss during a rate-hike year, confirmed against the raw statement text, not an extraction artifact). Both bookend years are positive (FY2025 Use of Money and Property +$127,799K / FY2002 +$23,060K, matching the 117 recon's "no clamp needed at either confirmed bookend" finding) -- this negative is an interior-year discovery made during this load. No year shows a negative GF Total revenues. The P2 clamp IS exercised for SD at FY2022.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/sd/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processSDRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'South Dakota'; const STATE_ABBR = 'SD'; const POPULATION = 886_667;
const EXPECTED_MUNI_ID = 'e7273079-b392-449d-af38-d2e4d0df73e0';
const UNITS = 1_000; // SD ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2002.PDF', date: '2002-06-30' },
  2003: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2003.PDF', date: '2003-06-30' },
  2004: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2004.PDF', date: '2004-06-30' },
  2005: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2005.PDF', date: '2005-06-30' },
  2006: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2006.PDF', date: '2006-06-30' },
  2007: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2007.PDF', date: '2007-06-30' },
  2008: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2008.PDF', date: '2008-06-30' },
  2009: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2009.PDF', date: '2009-06-30' },
  2010: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2010.PDF', date: '2010-06-30' },
  2011: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2011.PDF', date: '2011-06-30' },
  2012: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2012.PDF', date: '2012-06-30' },
  2013: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2013.PDF', date: '2013-06-30' },
  2014: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2014.PDF', date: '2014-06-30' },
  2015: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2015.PDF', date: '2015-06-30' },
  2016: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2016.PDF', date: '2016-06-30' },
  2017: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2017.PDF', date: '2017-06-30' },
  2018: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2018.PDF', date: '2018-06-30' },
  2019: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2019.PDF', date: '2019-06-30' },
  2020: { url: 'https://bfm.sd.gov/acfr/SD_CAFR_2020.PDF', date: '2020-06-30' },
  2021: { url: 'https://bfm.sd.gov/acfr/SD_ACFR_2021.PDF', date: '2021-06-30' },
  2022: { url: 'https://bfm.sd.gov/acfr/SD_ACFR_2022.PDF', date: '2022-06-30' },
  2023: { url: 'https://bfm.sd.gov/acfr/SD_ACFR_2023.PDF', date: '2023-06-30' },
  2024: { url: 'https://bfm.sd.gov/acfr/SD_ACFR_2024.PDF', date: '2024-06-30' },
  2025: { url: 'https://bfm.sd.gov/acfr/SD_ACFR_2025.PDF', date: '2025-06-30' },
};
const dataSource = (fy) => `South Dakota State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — SD ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 697_589, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      657_529 },
    { name: 'Licenses, Permits and Fees',    total:        5_189 },
    { name: 'Fines, Forfeits and Penalties', total:          498 },
    { name: 'Use of Money and Property',     total:       23_060 },
    { name: 'Sales and Services',            total:        5_387 },
    { name: 'Other Revenue',                 total:        5_926 },
  ]},
  2003: { total: 732_441, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      693_007 },
    { name: 'Licenses, Permits and Fees',    total:        5_151 },
    { name: 'Fines, Forfeits and Penalties', total:          471 },
    { name: 'Use of Money and Property',     total:       21_350 },
    { name: 'Sales and Services',            total:        6_115 },
    { name: 'Other Revenue',                 total:        6_347 },
  ]},
  2004: { total: 753_238, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      722_871 },
    { name: 'Licenses, Permits and Fees',    total:        5_851 },
    { name: 'Fines, Forfeits and Penalties', total:          543 },
    { name: 'Use of Money and Property',     total:        9_063 },
    { name: 'Sales and Services',            total:        6_822 },
    { name: 'Administering Programs',        total:           19 },
    { name: 'Other Revenue',                 total:        8_069 },
  ]},
  2005: { total: 793_836, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      758_874 },
    { name: 'Licenses, Permits and Fees',    total:        6_294 },
    { name: 'Fines, Forfeits and Penalties', total:          814 },
    { name: 'Use of Money and Property',     total:       13_552 },
    { name: 'Sales and Services',            total:        5_693 },
    { name: 'Administering Programs',        total:           30 },
    { name: 'Other Revenue',                 total:        8_579 },
  ]},
  2006: { total: 863_303, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      821_843 },
    { name: 'Licenses, Permits and Fees',    total:        6_506 },
    { name: 'Fines, Forfeits and Penalties', total:          573 },
    { name: 'Use of Money and Property',     total:       14_337 },
    { name: 'Sales and Services',            total:        6_852 },
    { name: 'Administering Programs',        total:           37 },
    { name: 'Other Revenue',                 total:       13_155 },
  ]},
  2007: { total: 917_987, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      867_096 },
    { name: 'Licenses, Permits and Fees',    total:        5_870 },
    { name: 'Fines, Forfeits and Penalties', total:          593 },
    { name: 'Use of Money and Property',     total:       25_073 },
    { name: 'Sales and Services',            total:        5_951 },
    { name: 'Administering Programs',        total:           51 },
    { name: 'Other Revenue',                 total:       13_353 },
  ]},
  2008: { total: 953_147, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      898_282 },
    { name: 'Licenses, Permits and Fees',    total:        6_414 },
    { name: 'Fines, Forfeits and Penalties', total:          562 },
    { name: 'Use of Money and Property',     total:       26_308 },
    { name: 'Sales and Services',            total:        6_326 },
    { name: 'Administering Programs',        total:           32 },
    { name: 'Other Revenue',                 total:       15_223 },
  ]},
  2009: { total: 952_933, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      895_567 },
    { name: 'Licenses, Permits and Fees',    total:        7_517 },
    { name: 'Fines, Forfeits and Penalties', total:          614 },
    { name: 'Use of Money and Property',     total:       26_422 },
    { name: 'Sales and Services',            total:        8_593 },
    { name: 'Administering Programs',        total:            4 },
    { name: 'Other Revenue',                 total:       14_216 },
  ]},
  2010: { total: 916_027, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      863_838 },
    { name: 'Licenses, Permits and Fees',    total:        8_199 },
    { name: 'Fines, Forfeits and Penalties', total:          575 },
    { name: 'Use of Money and Property',     total:       21_002 },
    { name: 'Sales and Services',            total:        7_995 },
    { name: 'Administering Programs',        total:           43 },
    { name: 'Other Revenue',                 total:       14_375 },
  ]},
  2011: { total: 995_240, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:      936_072 },
    { name: 'Licenses, Permits and Fees',    total:        9_098 },
    { name: 'Fines, Forfeits and Penalties', total:          518 },
    { name: 'Use of Money and Property',     total:       12_970 },
    { name: 'Sales and Services',            total:       14_390 },
    { name: 'Administering Programs',        total:           57 },
    { name: 'Other Revenue',                 total:       22_135 },
  ]},
  2012: { total: 1_087_568, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:    1_029_285 },
    { name: 'Licenses, Permits and Fees',    total:        9_251 },
    { name: 'Fines, Forfeits and Penalties', total:          470 },
    { name: 'Use of Money and Property',     total:        9_759 },
    { name: 'Sales and Services',            total:       14_382 },
    { name: 'Administering Programs',        total:          119 },
    { name: 'Other Revenue',                 total:       24_302 },
  ]},
  2013: { total: 1_146_458, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:    1_074_297 },
    { name: 'Licenses, Permits and Fees',    total:        9_622 },
    { name: 'Fines, Forfeits and Penalties', total:          460 },
    { name: 'Use of Money and Property',     total:        7_311 },
    { name: 'Sales and Services',            total:       16_484 },
    { name: 'Administering Programs',        total:           39 },
    { name: 'Other Revenue',                 total:       38_245 },
  ]},
  2014: { total: 1_251_092, confidence: 'actual', categories: [
    { name: 'Taxes',                         total:    1_107_011 },
    { name: 'Licenses, Permits and Fees',    total:       10_097 },
    { name: 'Fines, Forfeits and Penalties', total:          358 },
    { name: 'Use of Money and Property',     total:        8_254 },
    { name: 'Sales and Services',            total:       17_706 },
    { name: 'Administering Programs',        total:           25 },
    { name: 'Other Revenue',                 total:      107_641 },
  ]},
  2015: { total: 1_237_140, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_137_943 },
    { name: 'Licenses, Permits, and Fees',    total:       10_267 },
    { name: 'Fines, Forfeits, and Penalties', total:          368 },
    { name: 'Use of Money and Property',      total:        6_658 },
    { name: 'Sales and Services',             total:       23_463 },
    { name: 'Administering Programs',         total:           10 },
    { name: 'Other Revenue',                  total:       58_431 },
  ]},
  2016: { total: 1_305_173, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_196_805 },
    { name: 'Licenses, Permits, and Fees',    total:       10_165 },
    { name: 'Fines, Forfeits, and Penalties', total:          366 },
    { name: 'Use of Money and Property',      total:       10_788 },
    { name: 'Sales and Services',             total:       19_737 },
    { name: 'Administering Programs',         total:           20 },
    { name: 'Other Revenue',                  total:       67_292 },
  ]},
  2017: { total: 1_392_218, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_294_570 },
    { name: 'Licenses, Permits, and Fees',    total:       10_814 },
    { name: 'Fines, Forfeits, and Penalties', total:          340 },
    { name: 'Use of Money and Property',      total:        2_075 },
    { name: 'Sales and Services',             total:       23_032 },
    { name: 'Administering Programs',         total:            2 },
    { name: 'Other Revenue',                  total:       61_385 },
  ]},
  2018: { total: 1_447_574, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_339_937 },
    { name: 'Licenses, Permits, and Fees',    total:       11_634 },
    { name: 'Fines, Forfeits, and Penalties', total:          693 },
    { name: 'Use of Money and Property',      total:        1_180 },
    { name: 'Sales and Services',             total:       23_124 },
    { name: 'Other Revenue',                  total:       71_006 },
  ]},
  2019: { total: 1_505_314, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_372_840 },
    { name: 'Licenses, Permits, and Fees',    total:       12_247 },
    { name: 'Fines, Forfeits, and Penalties', total:          551 },
    { name: 'Use of Money and Property',      total:       29_458 },
    { name: 'Sales and Services',             total:       22_183 },
    { name: 'Administering Programs',         total:            8 },
    { name: 'Other Revenue',                  total:       68_027 },
  ]},
  2020: { total: 1_594_601, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_472_523 },
    { name: 'Licenses, Permits, and Fees',    total:       11_947 },
    { name: 'Fines, Forfeits, and Penalties', total:          303 },
    { name: 'Use of Money and Property',      total:       42_616 },
    { name: 'Sales and Services',             total:       21_049 },
    { name: 'Administering Programs',         total:            1 },
    { name: 'Other Revenue',                  total:       46_162 },
  ]},
  2021: { total: 1_769_432, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_657_591 },
    { name: 'Licenses, Permits, and Fees',    total:       13_311 },
    { name: 'Fines, Forfeits, and Penalties', total:          439 },
    { name: 'Use of Money and Property',      total:        7_725 },
    { name: 'Sales and Services',             total:       20_778 },
    { name: 'Administering Programs',         total:           48 },
    { name: 'Other Revenue',                  total:       69_540 },
  ]},
  2022: { total: 1_866_285, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_799_122 },
    { name: 'Licenses, Permits, and Fees',    total:       14_168 },
    { name: 'Fines, Forfeits, and Penalties', total:          675 },
    { name: 'Use of Money and Property',      total:      -32_246 },
    { name: 'Sales and Services',             total:       20_739 },
    { name: 'Other Revenue',                  total:       63_827 },
  ]},
  2023: { total: 2_160_591, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_960_528 },
    { name: 'Licenses, Permits, and Fees',    total:       14_466 },
    { name: 'Fines, Forfeits, and Penalties', total:          800 },
    { name: 'Use of Money and Property',      total:       61_164 },
    { name: 'Sales and Services',             total:       24_264 },
    { name: 'Administering Programs',         total:           12 },
    { name: 'Other Revenue',                  total:       99_357 },
  ]},
  2024: { total: 2_269_333, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_937_034 },
    { name: 'Licenses, Permits, and Fees',    total:       14_709 },
    { name: 'Fines, Forfeits, and Penalties', total:          957 },
    { name: 'Use of Money and Property',      total:      124_626 },
    { name: 'Sales and Services',             total:       26_184 },
    { name: 'Administering Programs',         total:           13 },
    { name: 'Other Revenue',                  total:      165_810 },
  ]},
  2025: { total: 2_423_413, confidence: 'actual', categories: [
    { name: 'Taxes',                          total:    1_964_549 },
    { name: 'Licenses, Permits, and Fees',    total:       15_046 },
    { name: 'Fines, Forfeits, and Penalties', total:          823 },
    { name: 'Use of Money and Property',      total:      127_799 },
    { name: 'Sales and Services',             total:       25_974 },
    { name: 'Other Revenue',                  total:      289_222 },
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
    const label = cat.total < 0 ? `${cat.name.trim()} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name.trim(); // WR-01: trim so a stray-space transcription can never fork a category name across years
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'South Dakota General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  // WR-06: validate EVERY target year up front — a failing year must abort before ANY write, never mid-run.
  for (const fy of years) { if (REVENUE[fy] && !validate(fy)) { console.error(`FY${fy} failed validation — aborting before any write`); process.exit(2); } }
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
    const srcPayload = { name: 'South Dakota General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'sd-acfr-gf-revenue', base_url: 'https://bfm.sd.gov/ACFR/', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
      console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
      for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
      const neg = REVENUE[fy].categories.filter(c => c.total < 0);
      for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
      console.log('─'.repeat(72)); console.log(`${'TOTAL REVENUES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
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
