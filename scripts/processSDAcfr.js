#!/usr/bin/env node
/**
 * South Dakota General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of South Dakota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the SD state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/sd/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processSDAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `South Dakota State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — SD ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 879_803, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       32_084 },
    { name: 'Education',                                      total:       36_908 },
    { name: 'Education - State Aid to School Districts',      total:      320_748 },
    { name: 'Education - State Aid to Universities',          total:      131_462 },
    { name: 'Health and Human Services',                      total:      239_250 },
    { name: 'Law, Justice and Public Protection',             total:       83_340 },
    { name: 'Agriculture and Natural Resources',              total:       12_271 },
    { name: 'Commerce and Regulation',                        total:        3_082 },
    { name: 'Economic Resources',                             total:        2_187 },
    { name: 'Transportation',                                 total:          457 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       18_014 },
  ]},
  2003: { total: 875_157, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       26_511 },
    { name: 'Education',                                      total:       24_514 },
    { name: 'Education - State Aid to School Districts',      total:      311_142 },
    { name: 'Education - State Support to Universities',      total:      133_337 },
    { name: 'Health, Human and Social Services',              total:      247_065 },
    { name: 'Law, Justice, Public Protection and Regulation', total:       94_340 },
    { name: 'Agriculture and Natural Resources',              total:       12_662 },
    { name: 'Economic Resources',                             total:        4_541 },
    { name: 'Transportation',                                 total:          390 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       20_655 },
  ]},
  2004: { total: 857_904, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       30_044 },
    { name: 'Education',                                      total:       24_213 },
    { name: 'Education - Payments to School Districts',       total:      277_714 },
    { name: 'Education - State Support to Universities',      total:      137_028 },
    { name: 'Health, Human and Social Services',              total:      252_095 },
    { name: 'Law, Justice, Public Protection and Regulation', total:       98_964 },
    { name: 'Agriculture and Natural Resources',              total:       13_593 },
    { name: 'Economic Resources',                             total:        5_005 },
    { name: 'Transportation',                                 total:          503 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       18_745 },
  ]},
  2005: { total: 975_381, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       25_062 },
    { name: 'Education',                                      total:       28_101 },
    { name: 'Education - Payments to School Districts',       total:      338_257 },
    { name: 'Education - State Support to Universities',      total:      143_358 },
    { name: 'Health, Human and Social Services',              total:      287_523 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      109_332 },
    { name: 'Agriculture and Natural Resources',              total:       13_303 },
    { name: 'Economic Resources',                             total:        9_482 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       20_963 },
  ]},
  2006: { total: 1_053_963, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       27_392 },
    { name: 'Education',                                      total:       26_691 },
    { name: 'Education - Payments to School Districts',       total:      339_293 },
    { name: 'Education - State Support to Universities',      total:      149_040 },
    { name: 'Health, Human and Social Services',              total:      319_541 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      115_923 },
    { name: 'Agriculture and Natural Resources',              total:       14_868 },
    { name: 'Economic Resources',                             total:       29_763 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       31_452 },
  ]},
  2007: { total: 1_092_097, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       28_237 },
    { name: 'Education',                                      total:       33_454 },
    { name: 'Education - Payments to School Districts',       total:      347_992 },
    { name: 'Education - State Support to Universities',      total:      160_725 },
    { name: 'Health, Human and Social Services',              total:      343_474 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      119_845 },
    { name: 'Agriculture and Natural Resources',              total:       15_323 },
    { name: 'Economic Resources',                             total:       10_344 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       32_703 },
  ]},
  2008: { total: 1_180_895, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       29_798 },
    { name: 'Education',                                      total:       27_314 },
    { name: 'Education - Payments to School Districts',       total:      375_949 },
    { name: 'Education - State Support to Universities',      total:      170_348 },
    { name: 'Health, Human and Social Services',              total:      385_937 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      131_075 },
    { name: 'Agriculture and Natural Resources',              total:       16_073 },
    { name: 'Economic Resources',                             total:       12_159 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       32_242 },
  ]},
  2009: { total: 1_156_221, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       30_665 },
    { name: 'Education',                                      total:       21_476 },
    { name: 'Education - Payments to School Districts',       total:      378_255 },
    { name: 'Education - State Support to Higher Education',  total:      185_745 },
    { name: 'Health, Human and Social Services',              total:      359_514 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      125_731 },
    { name: 'Agriculture and Natural Resources',              total:       17_627 },
    { name: 'Economic Resources',                             total:       12_619 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       24_589 },
  ]},
  2010: { total: 1_114_735, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       27_557 },
    { name: 'Education',                                      total:       19_175 },
    { name: 'Education - Payments to School Districts',       total:      382_904 },
    { name: 'Education - State Support to Higher Education',  total:      171_040 },
    { name: 'Health, Human and Social Services',              total:      341_779 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      126_749 },
    { name: 'Agriculture and Natural Resources',              total:       14_255 },
    { name: 'Economic Resources',                             total:       10_205 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       21_071 },
  ]},
  2011: { total: 1_126_524, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       34_138 },
    { name: 'Education',                                      total:       19_890 },
    { name: 'Education - Payments to School Districts',       total:      366_725 },
    { name: 'Education - State Support to Higher Education',  total:      163_874 },
    { name: 'Health, Human and Social Services',              total:      360_279 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      126_099 },
    { name: 'Agriculture and Natural Resources',              total:       14_651 },
    { name: 'Economic Resources',                             total:       20_271 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       20_597 },
  ]},
  2012: { total: 1_225_213, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       38_233 },
    { name: 'Education',                                      total:       27_785 },
    { name: 'Education - Payments to School Districts',       total:      376_410 },
    { name: 'Education - State Support to Higher Education',  total:      167_384 },
    { name: 'Health, Human and Social Services',              total:      426_700 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      131_868 },
    { name: 'Agriculture and Natural Resources',              total:       13_257 },
    { name: 'Economic Resources',                             total:       20_002 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       23_574 },
  ]},
  2013: { total: 1_278_762, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       37_043 },
    { name: 'Education',                                      total:       21_347 },
    { name: 'Education - Payments to School Districts',       total:      396_652 },
    { name: 'Education - State Support to Higher Education',  total:      176_294 },
    { name: 'Health, Human and Social Services',              total:      453_929 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      135_271 },
    { name: 'Agriculture and Natural Resources',              total:       13_699 },
    { name: 'Economic Resources',                             total:       22_299 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       22_228 },
  ]},
  2014: { total: 1_413_866, confidence: 'actual', categories: [
    { name: 'General Government',                             total:       48_635 },
    { name: 'Education',                                      total:       24_250 },
    { name: 'Education - Payments to School Districts',       total:      395_151 },
    { name: 'Education - State Support to Higher Education',  total:      219_341 },
    { name: 'Health, Human and Social Services',              total:      484_262 },
    { name: 'Law, Justice, Public Protection and Regulation', total:      147_203 },
    { name: 'Agriculture and Natural Resources',              total:       15_638 },
    { name: 'Economic Resources',                             total:       24_415 },
    { name: 'State Shared Revenue Paid to Other Governments', total:       38_047 },
    { name: 'Payment to Refunded Bond Escrow Agent',          total:       16_924 },
  ]},
  2015: { total: 1_439_978, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       52_024 },
    { name: 'Education',                                       total:       25_280 },
    { name: 'Education - Payments to School Districts',        total:      404_909 },
    { name: 'Education - State Support to Higher Education',   total:      192_950 },
    { name: 'Health, Human, and Social Services',              total:      529_791 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      152_431 },
    { name: 'Agriculture and Natural Resources',               total:       16_163 },
    { name: 'Economic Resources',                              total:       28_745 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       37_685 },
  ]},
  2016: { total: 1_513_982, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       54_597 },
    { name: 'Education',                                       total:       28_778 },
    { name: 'Education - Payments to School Districts',        total:      421_666 },
    { name: 'Education - State Support to Higher Education',   total:      232_245 },
    { name: 'Health, Human, and Social Services',              total:      547_396 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      150_833 },
    { name: 'Agriculture and Natural Resources',               total:       18_314 },
    { name: 'Economic Resources',                              total:       23_818 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       36_335 },
  ]},
  2017: { total: 1_598_240, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       50_914 },
    { name: 'Education',                                       total:       29_488 },
    { name: 'Education - Payments to School Districts',        total:      516_880 },
    { name: 'Education - State Support to Higher Education',   total:      206_253 },
    { name: 'Health, Human, and Social Services',              total:      545_106 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      159_910 },
    { name: 'Agriculture and Natural Resources',               total:       18_610 },
    { name: 'Economic Resources',                              total:       25_648 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       45_431 },
  ]},
  2018: { total: 1_644_368, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       54_582 },
    { name: 'Education',                                       total:       33_322 },
    { name: 'Education - Payments to School Districts',        total:      547_119 },
    { name: 'Education - State Support to Higher Education',   total:      210_972 },
    { name: 'Health, Human, and Social Services',              total:      549_527 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      162_849 },
    { name: 'Agriculture and Natural Resources',               total:       17_291 },
    { name: 'Economic Resources',                              total:       25_556 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       43_150 },
  ]},
  2019: { total: 1_678_828, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       62_172 },
    { name: 'Education',                                       total:       30_541 },
    { name: 'Education - Payments to School Districts',        total:      559_484 },
    { name: 'Education - State Support to Higher Education',   total:      213_843 },
    { name: 'Health, Human, and Social Services',              total:      551_478 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      167_051 },
    { name: 'Agriculture and Natural Resources',               total:       17_122 },
    { name: 'Economic Resources',                              total:       29_170 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       47_967 },
  ]},
  2020: { total: 1_655_938, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       59_980 },
    { name: 'Education',                                       total:       30_957 },
    { name: 'Education - Payments to School Districts',        total:      563_878 },
    { name: 'Education - State Support to Higher Education',   total:      229_545 },
    { name: 'Health, Human, and Social Services',              total:      520_353 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      159_126 },
    { name: 'Agriculture and Natural Resources',               total:       18_026 },
    { name: 'Economic Resources',                              total:       23_466 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       50_607 },
  ]},
  2021: { total: 1_635_785, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       62_716 },
    { name: 'Education',                                       total:       30_639 },
    { name: 'Education - Payments to School Districts',        total:      585_672 },
    { name: 'Education - State Support to Higher Education',   total:      228_207 },
    { name: 'Health, Human, and Social Services',              total:      491_687 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      127_784 },
    { name: 'Agriculture and Natural Resources',               total:       18_111 },
    { name: 'Economic Resources',                              total:       31_349 },
    { name: 'Transportation',                                  total:           22 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       59_598 },
  ]},
  2022: { total: 2_016_701, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       79_964 },
    { name: 'Education',                                       total:       83_054 },
    { name: 'Education - Payments to School Districts',        total:      595_640 },
    { name: 'Education - State Support to Higher Education',   total:      242_751 },
    { name: 'Health, Human, and Social Services',              total:      584_588 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      164_900 },
    { name: 'Agriculture and Natural Resources',               total:       18_757 },
    { name: 'Economic Resources',                              total:      186_690 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       57_974 },
    { name: 'Debt service — Principal',                        total:        2_124 },
    { name: 'Debt service — Interest',                         total:          259 },
  ]},
  2023: { total: 2_068_824, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       87_502 },
    { name: 'Education',                                       total:       37_238 },
    { name: 'Education - Payments to School Districts',        total:      654_930 },
    { name: 'Education - State Support to Higher Education',   total:      289_029 },
    { name: 'Health, Human, and Social Services',              total:      639_204 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      226_305 },
    { name: 'Agriculture and Natural Resources',               total:       17_076 },
    { name: 'Economic Resources',                              total:       54_647 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       59_686 },
    { name: 'Debt service — Principal',                        total:        2_614 },
    { name: 'Debt service — Interest',                         total:          593 },
  ]},
  2024: { total: 2_332_956, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       95_044 },
    { name: 'Education',                                       total:       40_636 },
    { name: 'Education - Payments to School Districts',        total:      703_279 },
    { name: 'Education - State Support to Higher Education',   total:      338_215 },
    { name: 'Health, Human, and Social Services',              total:      768_813 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      259_748 },
    { name: 'Agriculture and Natural Resources',               total:       22_126 },
    { name: 'Economic Resources',                              total:       43_643 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       57_423 },
    { name: 'Debt service — Principal',                        total:        3_133 },
    { name: 'Debt service — Interest',                         total:          896 },
  ]},
  2025: { total: 2_599_721, confidence: 'actual', categories: [
    { name: 'General Government',                              total:       87_110 },
    { name: 'Education',                                       total:       42_064 },
    { name: 'Education - Payments to School Districts',        total:      733_609 },
    { name: 'Education - State Support to Higher Education',   total:      384_977 },
    { name: 'Health, Human, and Social Services',              total:      878_852 },
    { name: 'Law, Justice, Public Protection, and Regulation', total:      324_862 },
    { name: 'Agriculture and Natural Resources',               total:       28_107 },
    { name: 'Economic Resources',                              total:       57_476 },
    { name: 'Transportation',                                  total:        1_144 },
    { name: 'State Shared Revenue Paid to Other Governments',  total:       56_997 },
    { name: 'Debt service — Principal',                        total:        3_592 },
    { name: 'Debt service — Interest',                         total:          931 },
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
  return { jsonTree: [{ n: 'South Dakota General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'South Dakota General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'sd-acfr-gf-operating', base_url: 'https://bfm.sd.gov/ACFR/', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
