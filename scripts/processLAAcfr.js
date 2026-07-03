#!/usr/bin/env node
/**
 * Louisiana General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Louisiana Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the LA state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   LA state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE DECISION (ACFR-31, resolving the recon's LA load-phase flag): LA ACFR GF Total
 *   revenues ~1.90x NASBO GF ($22,780,529K FY2025 vs $11,970,000K NASBO FY2024) -- the driver
 *   is NOT a modest federal-passthrough increment like most other tranche states, it is
 *   STRUCTURAL: ~99% of LA's GAAP General Fund is federal Intergovernmental Revenues
 *   ($22,482,784K of $22,780,529K FY2025 -- Medicaid/grant passthrough), while Louisiana's
 *   OWN-SOURCE STATE TAXES (~$14.1B) are booked to the separate Bond Security & Redemption
 *   Fund column of the SAME statement, not the General Fund column. Confirmed by inspecting
 *   every loaded year: the "Taxes"/"Gaming"/"Tobacco Settlement" revenue lines print a blank
 *   ("--") GENERAL FUND cell in every single year FY2002-FY2025 -- their real dollar amounts
 *   sit entirely in the Bond Security & Redemption Fund column instead.
 *
 *   THIS LOADER'S DECISION: load the printed GENERAL FUND column ALONE -- NOT a synthetic
 *   GF+Bond-Security-and-Redemption composite (same rationale as the UT/AL ACFR-31 precedent:
 *   the tie-to-printed-column standard and the cohort-wide uniform mold both point at the
 *   printed GF column; a two-fund composite is a total no statement prints). CONSEQUENCE,
 *   documented with prominence per ACFR-31's honest-relabel obligation: the verbatim
 *   "Intergovernmental Revenues" category will visibly DOMINATE the LA General Fund tree
 *   (~99% of the total) -- this is the honest rendering, not a bug, and must never be
 *   misread as "Louisiana's state tax revenue." The GAAP-basis dataSource() label plus this
 *   head_note plus the LOADLOG carry the composition record so no downstream consumer makes
 *   that naive-GF assumption.
 *
 * HASH-URL RE-ENUMERATION (mechanical trap): doa.la.gov serves every ACFR/CAFR PDF at a
 *   non-derivable hash path (`/media/{hash}/{slug}.pdf`). Every per-year URL in SOURCES below
 *   was resolved by fetching the two landing pages -- `doa.la.gov/doa/osrap/annual-financial-
 *   report/` (FY2022-FY2025) and `doa.la.gov/doa/osrap/archives/` (FY2002-FY2021) -- and
 *   reading the live href off each page at load time; NEVER guessed from the FY. Re-run this
 *   enumeration on any future refresh -- hashes can change on republish. One filename quirk:
 *   the archive page's FY2003 file is misspelled `carf03.pdf` (not `cafr03.pdf`) -- confirmed
 *   correct by content (ties to FY2003's printed GF totals), not a wrong-year download.
 *
 * ALL-CAPS SOURCE FIX (shared gen_state.py fix, LA discovered it): LA's printed Governmental
 *   Funds statement renders every category label in ALL CAPS (e.g. "INTERGOVERNMENTAL
 *   REVENUES", "USE OF MONEY & PROPERTY") -- unlike every prior tranche state (SC/KY/UT/AL/
 *   MO/AZ/OR/CO), which already print Title Case. gen_state.py's norm() now title-cases any
 *   label that is genuinely all-uppercase (smart_title(), lowercasing connector words like
 *   "of"/"and"/"&" except when leading) so LA's tree reads "Intergovernmental Revenues" like
 *   every other cohort state, not "INTERGOVERNMENTAL REVENUES" -- the amounts are completely
 *   unaffected, only display casing. Reusable for any future ALL-CAPS state.
 *
 * DUAL EXPENDITURE-SUBSECTION FIX (shared gen_state.py fix, LA discovered it): LA's printed
 *   EXPENDITURES section repeats the SAME function-name lineup (General Government, Education,
 *   Public Safety, ...) under TWO separate subsections -- "Current" (direct state spending)
 *   and "Intergovernmental" (aid/transfers to local governments, by function) -- a genuine
 *   GAAP distinction, not a duplicate row. default_exp_name() now appends " — Intergovernmental"
 *   to the second occurrence so the tree never shows two identically-named leaves (e.g.
 *   "Education" [Current, direct state spending] vs. "Education — Intergovernmental" [MFP
 *   formula aid to local school boards, FY2025 $6,801,090K -- larger than the Current-Education
 *   line itself, a real and expected GAAP fact for LA's K-12 funding mechanism]).
 *
 * EXTRACT_GF.PY FIXES (shared, LA discovered both): (1) the statement-header regex required a
 *   single literal space between "Revenues," and "Expenditures" -- LA's FY2016-FY2019 PDFs
 *   print that header with large multi-space gaps (a title-line rendering quirk), which the
 *   regex now tolerates (\s+). (2) FY2003-FY2005's `pdftotext -table` output does not hold a
 *   stable right-edge column position across every row in the same section (label-length-
 *   dependent padding drift, not a wrap) -- the single 'Total revenues'-anchored position
 *   check wrongly rejected genuine in-column GF values on some rows (FY2003, FY2005) and the
 *   whole expenditures section drifted to a different right edge than the revenue section's
 *   anchor (FY2004). extract_gf.py now retries with position-blind first-cell extraction
 *   (GF is always column 1) whenever the anchored pass fails to tie, per document -- FY2003/
 *   2004/2005 all now tie at $0 diff. Re-verified zero regression on SC/KY/UT/AL (all 96
 *   already-loaded state-years unaffected, same ties as before this fix).
 *
 * WINDOW: FY2002-FY2025 (24 years), zero honest holes -- every year ties $0 diff on both the
 *   revenue and expenditure printed GENERAL FUND totals. Bookends: FY2025 rev 22,780,529 /
 *   exp 39,246,140; FY2002 rev 5,807,699 / exp 14,695,770.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Use of Money and Property" (later years print "Use of Money & Property") went NEGATIVE in FY2004 (-38,246K), FY2012 (-20,092K), FY2013 (-80,800K), and FY2022 (-4,006K) -- real GAAP fair-value-of-investments losses, not extraction artifacts. Every other loaded year is positive. The P2 clamp is the render path for those four years; no year shows a negative GF Total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/la/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processLAAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Louisiana'; const STATE_ABBR = 'LA'; const POPULATION = 4_657_757;
const EXPECTED_MUNI_ID = 'b7e9e7cd-8b7e-4272-8e42-ef41b293120b';
const UNITS = 1_000; // LA ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://doa.la.gov/media/fthjchle/cafr02.pdf', date: '2002-06-30' },
  2003: { url: 'https://doa.la.gov/media/o13hvozq/carf03.pdf', date: '2003-06-30' },
  2004: { url: 'https://doa.la.gov/media/m3rkoeak/cafr04.pdf', date: '2004-06-30' },
  2005: { url: 'https://doa.la.gov/media/10vl5wad/cafr05-beg-end.pdf', date: '2005-06-30' },
  2006: { url: 'https://doa.la.gov/media/qjzgvoh1/cafr06.pdf', date: '2006-06-30' },
  2007: { url: 'https://doa.la.gov/media/pymdqejm/cafr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://doa.la.gov/media/r4rjly0a/cafr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://doa.la.gov/media/kucfp5rl/cafr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://doa.la.gov/media/1finonbd/cafr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://doa.la.gov/media/s1bh0xlp/cafr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://doa.la.gov/media/d5xpcowe/cafr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://doa.la.gov/media/smwlbb1f/cafr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://doa.la.gov/media/fc0dewmg/cafr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://doa.la.gov/media/bdpjhmoj/final-cafr-12-22-15-with-covers.pdf', date: '2015-06-30' },
  2016: { url: 'https://doa.la.gov/media/ar3o2oqt/cafr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://doa.la.gov/media/fshfc0im/cafr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://doa.la.gov/media/53vjcgnt/cafr-fy18-final.pdf', date: '2018-06-30' },
  2019: { url: 'https://doa.la.gov/media/qojduzei/cafr2019-2.pdf', date: '2019-06-30' },
  2020: { url: 'https://doa.la.gov/media/wadnaduk/cafr2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://doa.la.gov/media/bxtnn4d2/fy21-acfr.pdf', date: '2021-06-30' },
  2022: { url: 'https://doa.la.gov/media/ofqdeujb/acfr-2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://doa.la.gov/media/epmbw2el/fy2023-acfr-final.pdf', date: '2023-06-30' },
  2024: { url: 'https://doa.la.gov/media/db0f1bsl/fy2024-acfr-final.pdf', date: '2024-06-30' },
  2025: { url: 'https://doa.la.gov/media/lqvhnfhs/fy25-acfr-final.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Louisiana State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — LA ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 14_695_770, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    1_872_348 },
    { name: 'Culture, Recreation, and Tourism',           total:       59_745 },
    { name: 'Transportation and Development',             total:      303_177 },
    { name: 'Public Safety',                              total:      223_170 },
    { name: 'Health and Welfare',                         total:    6_704_422 },
    { name: 'Corrections',                                total:      594_467 },
    { name: 'Conservation and Environment',               total:      219_965 },
    { name: 'Education',                                  total:    4_335_452 },
    { name: 'Other',                                      total:        1_104 },
    { name: 'Intergovernmental',                          total:      322_075 },
    { name: 'Debt service — Principal Retirement',        total:       47_010 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       12_835 },
  ]},
  2003: { total: 15_396_766, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    2_121_596 },
    { name: 'Culture, Recreation, and Tourism',           total:       60_647 },
    { name: 'Transportation and Development',             total:      323_289 },
    { name: 'Public Safety',                              total:      221_504 },
    { name: 'Health and Welfare',                         total:    6_625_988 },
    { name: 'Corrections',                                total:      611_685 },
    { name: 'Conservation and Environment',               total:      234_402 },
    { name: 'Education',                                  total:    4_674_987 },
    { name: 'Other',                                      total:        4_793 },
    { name: 'Intergovernmental',                          total:      365_818 },
    { name: 'Debt service — Principal Retirement',        total:      125_930 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       26_127 },
  ]},
  2004: { total: 16_082_176, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    2_172_105 },
    { name: 'Culture, Recreation, and Tourism',           total:       60_370 },
    { name: 'Transportation and Development',             total:      330_164 },
    { name: 'Public Safety',                              total:      256_403 },
    { name: 'Health and Welfare',                         total:    7_061_555 },
    { name: 'Corrections',                                total:      623_629 },
    { name: 'Conservation and Environment',               total:      240_743 },
    { name: 'Education',                                  total:    4_929_255 },
    { name: 'Other',                                      total:       13_311 },
    { name: 'Intergovernmental',                          total:      354_846 },
    { name: 'Debt service — Principal Retirement',        total:       20_605 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       19_190 },
  ]},
  2005: { total: 16_807_994, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    2_300_964 },
    { name: 'Culture, Recreation, and Tourism',           total:       64_548 },
    { name: 'Transportation and Development',             total:      356_665 },
    { name: 'Public Safety',                              total:      272_785 },
    { name: 'Health and Welfare',                         total:    7_408_900 },
    { name: 'Corrections',                                total:      651_974 },
    { name: 'Conservation and Environment',               total:      244_059 },
    { name: 'Education',                                  total:    5_077_793 },
    { name: 'Other',                                      total:       10_024 },
    { name: 'Intergovernmental',                          total:      375_373 },
    { name: 'Debt service — Principal Retirement',        total:       21_265 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       23_644 },
  ]},
  2006: { total: 19_428_136, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    4_373_467 },
    { name: 'Culture, Recreation, and Tourism',           total:       61_264 },
    { name: 'Transportation and Development',             total:      350_486 },
    { name: 'Public Safety',                              total:      303_951 },
    { name: 'Health and Welfare',                         total:    7_386_464 },
    { name: 'Corrections',                                total:      542_143 },
    { name: 'Youth Services',                             total:      115_369 },
    { name: 'Conservation and Environment',               total:      235_235 },
    { name: 'Education',                                  total:    5_253_731 },
    { name: 'Other',                                      total:        6_359 },
    { name: 'Intergovernmental',                          total:      754_737 },
    { name: 'Debt service — Principal Retirement',        total:       22_235 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       22_695 },
  ]},
  2007: { total: 22_243_498, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    6_473_720 },
    { name: 'Culture, Recreation, and Tourism',           total:       92_220 },
    { name: 'Transportation and Development',             total:      385_408 },
    { name: 'Public Safety',                              total:      321_763 },
    { name: 'Health and Welfare',                         total:    7_564_017 },
    { name: 'Corrections',                                total:      535_772 },
    { name: 'Youth Services',                             total:      120_926 },
    { name: 'Conservation and Environment',               total:      274_861 },
    { name: 'Education',                                  total:    5_940_907 },
    { name: 'Other',                                      total:       19_663 },
    { name: 'Intergovernmental',                          total:      465_047 },
    { name: 'Debt service — Principal Retirement',        total:       27_570 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       21_624 },
  ]},
  2008: { total: 25_638_521, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    8_172_304 },
    { name: 'Culture, Recreation, and Tourism',           total:      129_615 },
    { name: 'Transportation and Development',             total:      433_359 },
    { name: 'Public Safety',                              total:      290_245 },
    { name: 'Health and Welfare',                         total:    8_330_132 },
    { name: 'Corrections',                                total:      606_876 },
    { name: 'Youth Services',                             total:      155_475 },
    { name: 'Conservation and Environment',               total:      324_512 },
    { name: 'Education',                                  total:    6_587_432 },
    { name: 'Other',                                      total:       20_495 },
    { name: 'Intergovernmental',                          total:      540_504 },
    { name: 'Debt service — Principal Retirement',        total:       28_800 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       18_772 },
  ]},
  2009: { total: 25_135_973, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    6_435_832 },
    { name: 'Culture, Recreation, and Tourism',           total:       97_709 },
    { name: 'Transportation and Development',             total:      438_634 },
    { name: 'Public Safety',                              total:      305_054 },
    { name: 'Health and Welfare',                         total:    9_372_783 },
    { name: 'Corrections',                                total:      666_542 },
    { name: 'Youth Services',                             total:      154_821 },
    { name: 'Conservation and Environment',               total:      368_850 },
    { name: 'Education',                                  total:    6_713_924 },
    { name: 'Other',                                      total:       20_403 },
    { name: 'Intergovernmental',                          total:      485_874 },
    { name: 'Debt service — Principal Retirement',        total:       43_068 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       32_479 },
  ]},
  2010: { total: 23_223_603, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    4_911_766 },
    { name: 'Culture, Recreation, and Tourism',           total:       71_088 },
    { name: 'Transportation and Development',             total:      424_007 },
    { name: 'Public Safety',                              total:      296_083 },
    { name: 'Health and Welfare',                         total:    9_497_394 },
    { name: 'Corrections',                                total:      612_723 },
    { name: 'Youth Services',                             total:      138_506 },
    { name: 'Conservation and Environment',               total:      463_913 },
    { name: 'Education',                                  total:    6_319_886 },
    { name: 'Other',                                      total:       21_284 },
    { name: 'Intergovernmental',                          total:      398_377 },
    { name: 'Debt service — Principal Retirement',        total:       38_270 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       30_306 },
  ]},
  2011: { total: 24_040_678, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    5_764_484 },
    { name: 'Culture, Recreation, and Tourism',           total:       82_009 },
    { name: 'Transportation and Development',             total:      428_301 },
    { name: 'Public Safety',                              total:      306_984 },
    { name: 'Health and Welfare',                         total:    9_671_602 },
    { name: 'Corrections',                                total:      620_948 },
    { name: 'Youth Services',                             total:      125_651 },
    { name: 'Conservation and Environment',               total:      259_065 },
    { name: 'Education',                                  total:    6_263_206 },
    { name: 'Other',                                      total:       21_641 },
    { name: 'Intergovernmental',                          total:      430_763 },
    { name: 'Debt service — Principal Retirement',        total:       37_120 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       28_904 },
  ]},
  2012: { total: 23_311_027, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    4_819_183 },
    { name: 'Culture, Recreation, and Tourism',           total:       90_700 },
    { name: 'Transportation and Development',             total:      435_706 },
    { name: 'Public Safety',                              total:      307_151 },
    { name: 'Health and Welfare',                         total:    9_884_320 },
    { name: 'Corrections',                                total:      601_057 },
    { name: 'Youth Services',                             total:      110_992 },
    { name: 'Conservation and Environment',               total:      247_954 },
    { name: 'Education',                                  total:    6_287_826 },
    { name: 'Other',                                      total:       15_751 },
    { name: 'Intergovernmental',                          total:      445_401 },
    { name: 'Debt service — Principal Retirement',        total:       38_265 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       26_721 },
  ]},
  2013: { total: 22_733_857, confidence: 'actual', categories: [
    { name: 'General Government',                         total:    4_045_115 },
    { name: 'Culture, Recreation, and Tourism',           total:       85_632 },
    { name: 'Transportation and Development',             total:      437_582 },
    { name: 'Public Safety',                              total:      310_727 },
    { name: 'Health and Welfare',                         total:   10_006_567 },
    { name: 'Corrections',                                total:      627_148 },
    { name: 'Youth Services',                             total:       98_823 },
    { name: 'Conservation and Environment',               total:      275_245 },
    { name: 'Education',                                  total:    6_304_682 },
    { name: 'Other',                                      total:       20_239 },
    { name: 'Intergovernmental',                          total:      456_230 },
    { name: 'Debt service — Principal Retirement',        total:       40_188 },
    { name: 'Debt service — Interest and Fiscal Charges', total:       25_679 },
  ]},
  2014: { total: 23_081_502, confidence: 'actual', categories: [
    { name: 'General Government',                  total:    4_394_816 },
    { name: 'Culture, Recreation, and Tourism',    total:       82_379 },
    { name: 'Transportation and Development',      total:      461_917 },
    { name: 'Public Safety',                       total:      310_580 },
    { name: 'Health and Welfare',                  total:   10_174_503 },
    { name: 'Corrections',                         total:      597_220 },
    { name: 'Youth Services',                      total:      103_472 },
    { name: 'Conservation and Environment',        total:      240_356 },
    { name: 'Education',                           total:    6_102_924 },
    { name: 'Intergovernmental',                   total:      524_373 },
    { name: 'Debt service — Principal Retirement', total:       30_726 },
    { name: 'Debt service — Interest',             total:       38_332 },
    { name: 'Other',                               total:       19_904 },
  ]},
  2015: { total: 23_538_351, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_191_212 },
    { name: 'Culture, Recreation & Tourism',                     total:       74_228 },
    { name: 'Transportation & Development',                      total:      432_151 },
    { name: 'Public Safety',                                     total:      830_934 },
    { name: 'Health & Welfare',                                  total:   10_765_058 },
    { name: 'Corrections',                                       total:      643_885 },
    { name: 'Youth Development',                                 total:       82_701 },
    { name: 'Conservation & Environment',                        total:      274_273 },
    { name: 'Education',                                         total:    1_000_427 },
    { name: 'Agriculture & Forestry',                            total:       53_336 },
    { name: 'Economic Development',                              total:       83_776 },
    { name: 'Military & Veterans Affairs',                       total:      120_152 },
    { name: 'Workforce Support & Training',                      total:      193_700 },
    { name: 'General Government — Intergovernmental',            total:      307_931 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       15_989 },
    { name: 'Transportation & Development — Intergovernmental',  total:       54_722 },
    { name: 'Public Safety — Intergovernmental',                 total:      786_830 },
    { name: 'Health & Welfare — Intergovernmental',              total:       57_200 },
    { name: 'Corrections — Intergovernmental',                   total:       35_845 },
    { name: 'Youth Development — Intergovernmental',             total:        3_155 },
    { name: 'Conservation & Environment — Intergovernmental',    total:          281 },
    { name: 'Education — Intergovernmental',                     total:    4_816_502 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:       26_415 },
    { name: 'Economic Development — Intergovernmental',          total:      141_814 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       36_236 },
    { name: 'Capital Outlay — Intergovernmental',                total:      225_964 },
    { name: 'Debt service — Principal',                          total:      239_383 },
    { name: 'Debt service — Interest',                           total:       39_837 },
    { name: 'Issuance Costs & Other Charges',                    total:        4_414 },
  ]},
  2016: { total: 23_113_145, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_025_083 },
    { name: 'Culture, Recreation & Tourism',                     total:       68_598 },
    { name: 'Transportation & Development',                      total:      422_252 },
    { name: 'Public Safety',                                     total:      879_925 },
    { name: 'Health & Welfare',                                  total:   10_934_259 },
    { name: 'Corrections',                                       total:      628_518 },
    { name: 'Youth Development',                                 total:       83_530 },
    { name: 'Conservation & Environment',                        total:      289_977 },
    { name: 'Education',                                         total:      953_475 },
    { name: 'Agriculture & Forestry',                            total:       49_279 },
    { name: 'Economic Development',                              total:       75_849 },
    { name: 'Military & Veterans Affairs',                       total:      126_860 },
    { name: 'Workforce Support & Training',                      total:      192_828 },
    { name: 'General Government — Intergovernmental',            total:      254_735 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       15_086 },
    { name: 'Transportation & Development — Intergovernmental',  total:       65_399 },
    { name: 'Health & Welfare — Intergovernmental',              total:      464_985 },
    { name: 'Corrections — Intergovernmental',                   total:       36_793 },
    { name: 'Youth Development — Intergovernmental',             total:        1_942 },
    { name: 'Conservation & Environment — Intergovernmental',    total:          306 },
    { name: 'Education — Intergovernmental',                     total:    4_910_966 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:       34_584 },
    { name: 'Economic Development — Intergovernmental',          total:      134_651 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       34_602 },
    { name: 'Capital Outlay — Intergovernmental',                total:      224_769 },
    { name: 'Debt service — Principal',                          total:      165_149 },
    { name: 'Debt service — Interest',                           total:       34_091 },
    { name: 'Issuance Costs & Other Charges',                    total:        4_654 },
  ]},
  2017: { total: 26_499_546, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    1_891_014 },
    { name: 'Culture, Recreation & Tourism',                     total:       66_032 },
    { name: 'Transportation & Development',                      total:      433_428 },
    { name: 'Public Safety',                                     total:      898_418 },
    { name: 'Health & Welfare',                                  total:   13_431_804 },
    { name: 'Corrections',                                       total:      627_210 },
    { name: 'Youth Development',                                 total:       86_201 },
    { name: 'Conservation & Environment',                        total:      266_212 },
    { name: 'Education',                                         total:      794_260 },
    { name: 'Agriculture & Forestry',                            total:       42_801 },
    { name: 'Economic Development',                              total:       82_898 },
    { name: 'Military & Veterans Affairs',                       total:      132_166 },
    { name: 'Workforce Support & Training',                      total:      191_460 },
    { name: 'General Government — Intergovernmental',            total:      269_156 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       16_934 },
    { name: 'Transportation & Development — Intergovernmental',  total:       63_671 },
    { name: 'Public Safety — Intergovernmental',                 total:      923_123 },
    { name: 'Health & Welfare — Intergovernmental',              total:      712_593 },
    { name: 'Corrections — Intergovernmental',                   total:       47_310 },
    { name: 'Youth Development — Intergovernmental',             total:        1_310 },
    { name: 'Conservation & Environment — Intergovernmental',    total:          313 },
    { name: 'Education — Intergovernmental',                     total:    5_037_043 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:       44_530 },
    { name: 'Economic Development — Intergovernmental',          total:      139_805 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       39_279 },
    { name: 'Capital Outlay — Intergovernmental',                total:      177_959 },
    { name: 'Debt service — Principal',                          total:       47_671 },
    { name: 'Debt service — Interest',                           total:       30_751 },
    { name: 'Issuance Costs & Other Charges',                    total:        4_194 },
  ]},
  2018: { total: 26_045_367, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_328_811 },
    { name: 'Culture, Recreation & Tourism',                     total:       65_595 },
    { name: 'Transportation & Development',                      total:      412_295 },
    { name: 'Public Safety',                                     total:      652_535 },
    { name: 'Health & Welfare',                                  total:   13_785_451 },
    { name: 'Corrections',                                       total:      635_117 },
    { name: 'Youth Development',                                 total:       76_169 },
    { name: 'Conservation & Environment',                        total:      269_001 },
    { name: 'Education',                                         total:      862_414 },
    { name: 'Agriculture & Forestry',                            total:       90_978 },
    { name: 'Economic Development',                              total:       85_255 },
    { name: 'Military & Veterans Affairs',                       total:      123_548 },
    { name: 'Workforce Support & Training',                      total:      171_606 },
    { name: 'General Government — Intergovernmental',            total:      293_526 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       16_421 },
    { name: 'Transportation & Development — Intergovernmental',  total:       66_199 },
    { name: 'Public Safety — Intergovernmental',                 total:      268_577 },
    { name: 'Health & Welfare — Intergovernmental',              total:      159_506 },
    { name: 'Corrections — Intergovernmental',                   total:       50_961 },
    { name: 'Youth Development — Intergovernmental',             total:          606 },
    { name: 'Conservation & Environment — Intergovernmental',    total:          540 },
    { name: 'Education — Intergovernmental',                     total:    5_197_126 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        1_768 },
    { name: 'Economic Development — Intergovernmental',          total:      137_416 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       37_921 },
    { name: 'Capital Outlay — Intergovernmental',                total:      156_796 },
    { name: 'Debt service — Principal',                          total:       67_687 },
    { name: 'Debt service — Interest',                           total:       28_709 },
    { name: 'Issuance Costs & Other Charges',                    total:        2_833 },
  ]},
  2019: { total: 26_943_048, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    1_860_955 },
    { name: 'Culture, Recreation & Tourism',                     total:       78_569 },
    { name: 'Transportation & Development',                      total:      517_049 },
    { name: 'Public Safety',                                     total:      679_594 },
    { name: 'Health & Welfare',                                  total:   14_671_163 },
    { name: 'Corrections',                                       total:      733_592 },
    { name: 'Youth Development',                                 total:      109_365 },
    { name: 'Conservation & Environment',                        total:      321_152 },
    { name: 'Education',                                         total:      758_398 },
    { name: 'Agriculture & Forestry',                            total:      122_428 },
    { name: 'Economic Development',                              total:       70_470 },
    { name: 'Military & Veterans Affairs',                       total:      142_927 },
    { name: 'Workforce Support & Training',                      total:      201_746 },
    { name: 'General Government — Intergovernmental',            total:      273_780 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       17_433 },
    { name: 'Transportation & Development — Intergovernmental',  total:       66_015 },
    { name: 'Public Safety — Intergovernmental',                 total:      285_341 },
    { name: 'Health & Welfare — Intergovernmental',              total:      169_499 },
    { name: 'Corrections — Intergovernmental',                   total:       52_355 },
    { name: 'Youth Development — Intergovernmental',             total:          727 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        1_159 },
    { name: 'Education — Intergovernmental',                     total:    5_369_809 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        2_393 },
    { name: 'Economic Development — Intergovernmental',          total:      143_362 },
    { name: 'Military & Veterans Affairs — Intergovernmental',   total:          490 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       43_342 },
    { name: 'Capital Outlay — Intergovernmental',                total:      170_656 },
    { name: 'Debt service — Principal',                          total:       50_491 },
    { name: 'Debt service — Interest',                           total:       25_915 },
    { name: 'Issuance Costs & Other Charges',                    total:        2_873 },
  ]},
  2020: { total: 29_532_215, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    1_806_541 },
    { name: 'Culture, Recreation & Tourism',                     total:       81_240 },
    { name: 'Transportation & Development',                      total:      519_531 },
    { name: 'Public Safety',                                     total:    1_324_963 },
    { name: 'Health & Welfare',                                  total:   16_163_931 },
    { name: 'Corrections',                                       total:      623_714 },
    { name: 'Youth Development',                                 total:      101_921 },
    { name: 'Conservation & Environment',                        total:      341_190 },
    { name: 'Education',                                         total:      845_722 },
    { name: 'Agriculture & Forestry',                            total:      149_884 },
    { name: 'Economic Development',                              total:       88_788 },
    { name: 'Military & Veterans Affairs',                       total:      152_883 },
    { name: 'Workforce Support & Training',                      total:      208_241 },
    { name: 'General Government — Intergovernmental',            total:      255_364 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       17_363 },
    { name: 'Transportation & Development — Intergovernmental',  total:       64_325 },
    { name: 'Public Safety — Intergovernmental',                 total:      635_183 },
    { name: 'Health & Welfare — Intergovernmental',              total:      165_187 },
    { name: 'Corrections — Intergovernmental',                   total:       61_444 },
    { name: 'Youth Development — Intergovernmental',             total:        2_897 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        1_312 },
    { name: 'Education — Intergovernmental',                     total:    5_552_500 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        4_220 },
    { name: 'Economic Development — Intergovernmental',          total:      140_076 },
    { name: 'Military & Veterans Affairs — Intergovernmental',   total:           77 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       43_819 },
    { name: 'Capital Outlay — Intergovernmental',                total:      111_754 },
    { name: 'Debt service — Principal',                          total:       41_845 },
    { name: 'Debt service — Interest',                           total:       23_450 },
    { name: 'Issuance Costs & Other Charges',                    total:        2_850 },
  ]},
  2021: { total: 34_079_241, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_605_381 },
    { name: 'Culture, Recreation & Tourism',                     total:       94_016 },
    { name: 'Transportation & Development',                      total:      551_006 },
    { name: 'Public Safety',                                     total:    1_197_690 },
    { name: 'Health & Welfare',                                  total:   18_709_065 },
    { name: 'Corrections',                                       total:      768_204 },
    { name: 'Youth Development',                                 total:      110_698 },
    { name: 'Conservation & Environment',                        total:      320_419 },
    { name: 'Education',                                         total:      926_247 },
    { name: 'Agriculture & Forestry',                            total:      151_737 },
    { name: 'Economic Development',                              total:       64_096 },
    { name: 'Military & Veterans Affairs',                       total:      182_639 },
    { name: 'Workforce Support & Training',                      total:      288_787 },
    { name: 'General Government — Intergovernmental',            total:      658_506 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       25_134 },
    { name: 'Transportation & Development — Intergovernmental',  total:       72_204 },
    { name: 'Public Safety — Intergovernmental',                 total:      924_403 },
    { name: 'Health & Welfare — Intergovernmental',              total:      154_548 },
    { name: 'Corrections — Intergovernmental',                   total:       80_146 },
    { name: 'Youth Development — Intergovernmental',             total:        4_316 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        4_099 },
    { name: 'Education — Intergovernmental',                     total:    5_824_196 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        8_249 },
    { name: 'Economic Development — Intergovernmental',          total:      128_796 },
    { name: 'Military & Veterans Affairs — Intergovernmental',   total:           84 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       16_950 },
    { name: 'Capital Outlay — Intergovernmental',                total:      145_144 },
    { name: 'Debt service — Principal',                          total:       38_029 },
    { name: 'Debt service — Interest',                           total:       17_916 },
    { name: 'Issuance Costs & Other Charges',                    total:        6_536 },
  ]},
  2022: { total: 37_748_650, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_292_388 },
    { name: 'Culture, Recreation & Tourism',                     total:      106_061 },
    { name: 'Transportation & Development',                      total:      549_715 },
    { name: 'Public Safety',                                     total:    1_794_639 },
    { name: 'Health & Welfare',                                  total:   20_401_219 },
    { name: 'Corrections',                                       total:      797_055 },
    { name: 'Youth Development',                                 total:      122_324 },
    { name: 'Conservation & Environment',                        total:      345_208 },
    { name: 'Education',                                         total:    1_545_458 },
    { name: 'Agriculture & Forestry',                            total:      179_599 },
    { name: 'Economic Development',                              total:       71_963 },
    { name: 'Military & Veterans Affairs',                       total:      181_960 },
    { name: 'Workforce Support & Training',                      total:      277_562 },
    { name: 'General Government — Intergovernmental',            total:      425_900 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       37_950 },
    { name: 'Transportation & Development — Intergovernmental',  total:       80_933 },
    { name: 'Public Safety — Intergovernmental',                 total:    1_334_261 },
    { name: 'Health & Welfare — Intergovernmental',              total:      197_470 },
    { name: 'Corrections — Intergovernmental',                   total:       78_117 },
    { name: 'Youth Development — Intergovernmental',             total:        4_946 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        2_978 },
    { name: 'Education — Intergovernmental',                     total:    6_274_886 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        6_165 },
    { name: 'Economic Development — Intergovernmental',          total:      143_124 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       15_515 },
    { name: 'Capital Outlay — Intergovernmental',                total:      400_579 },
    { name: 'Debt service — Principal',                          total:       66_490 },
    { name: 'Debt service — Interest',                           total:       11_443 },
    { name: 'Issuance Costs & Other Charges',                    total:        2_742 },
  ]},
  2023: { total: 40_126_350, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_174_685 },
    { name: 'Culture, Recreation & Tourism',                     total:      117_917 },
    { name: 'Transportation & Development',                      total:        4_303 },
    { name: 'Public Safety',                                     total:    1_934_876 },
    { name: 'Health & Welfare',                                  total:   22_387_930 },
    { name: 'Corrections',                                       total:      854_128 },
    { name: 'Youth Development',                                 total:      141_331 },
    { name: 'Conservation & Environment',                        total:      372_897 },
    { name: 'Education',                                         total:    1_376_895 },
    { name: 'Agriculture & Forestry',                            total:      142_440 },
    { name: 'Economic Development',                              total:       72_383 },
    { name: 'Military & Veterans Affairs',                       total:      159_714 },
    { name: 'Workforce Support & Training',                      total:      252_958 },
    { name: 'General Government — Intergovernmental',            total:      858_968 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       25_165 },
    { name: 'Transportation & Development — Intergovernmental',  total:       18_793 },
    { name: 'Public Safety — Intergovernmental',                 total:    1_432_733 },
    { name: 'Health & Welfare — Intergovernmental',              total:      215_180 },
    { name: 'Corrections — Intergovernmental',                   total:       37_522 },
    { name: 'Youth Development — Intergovernmental',             total:        6_470 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        1_254 },
    { name: 'Education — Intergovernmental',                     total:    7_060_009 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        4_102 },
    { name: 'Economic Development — Intergovernmental',          total:      157_710 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       16_345 },
    { name: 'Capital Outlay — Intergovernmental',                total:      212_595 },
    { name: 'Debt service — Principal',                          total:       74_610 },
    { name: 'Debt service — Interest',                           total:        9_846 },
    { name: 'Issuance Costs & Other Charges',                    total:        2_591 },
  ]},
  2024: { total: 39_856_311, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    1_941_765 },
    { name: 'Culture, Recreation & Tourism',                     total:      118_624 },
    { name: 'Transportation & Development',                      total:       18_130 },
    { name: 'Public Safety',                                     total:    1_497_202 },
    { name: 'Health & Welfare',                                  total:   22_440_405 },
    { name: 'Corrections',                                       total:      895_640 },
    { name: 'Youth Development',                                 total:      157_677 },
    { name: 'Conservation & Environment',                        total:      422_104 },
    { name: 'Education',                                         total:    1_360_652 },
    { name: 'Agriculture & Forestry',                            total:      177_430 },
    { name: 'Economic Development',                              total:       94_184 },
    { name: 'Military & Veterans Affairs',                       total:      182_070 },
    { name: 'Workforce Support & Training',                      total:      226_574 },
    { name: 'General Government — Intergovernmental',            total:      590_867 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       16_129 },
    { name: 'Transportation & Development — Intergovernmental',  total:       31_309 },
    { name: 'Public Safety — Intergovernmental',                 total:    1_401_859 },
    { name: 'Health & Welfare — Intergovernmental',              total:      216_417 },
    { name: 'Corrections — Intergovernmental',                   total:       36_036 },
    { name: 'Youth Development — Intergovernmental',             total:        8_572 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        1_424 },
    { name: 'Education — Intergovernmental',                     total:    7_479_168 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        5_800 },
    { name: 'Economic Development — Intergovernmental',          total:      173_478 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       10_416 },
    { name: 'Capital Outlay — Intergovernmental',                total:      241_376 },
    { name: 'Debt service — Principal',                          total:       97_892 },
    { name: 'Debt service — Interest',                           total:       11_349 },
    { name: 'Issuance Costs & Other Charges',                    total:        1_762 },
  ]},
  2025: { total: 39_246_140, confidence: 'actual', categories: [
    { name: 'General Government',                                total:    2_682_166 },
    { name: 'Culture, Recreation & Tourism',                     total:      115_288 },
    { name: 'Transportation & Development',                      total:       45_966 },
    { name: 'Public Safety',                                     total:    1_458_629 },
    { name: 'Health & Welfare',                                  total:   22_611_064 },
    { name: 'Corrections',                                       total:      916_325 },
    { name: 'Youth Development',                                 total:      165_061 },
    { name: 'Conservation & Environment',                        total:      445_143 },
    { name: 'Education',                                         total:    1_309_762 },
    { name: 'Agriculture & Forestry',                            total:      183_190 },
    { name: 'Economic Development',                              total:      147_091 },
    { name: 'Military & Veterans Affairs',                       total:      193_369 },
    { name: 'Workforce Support & Training',                      total:      241_463 },
    { name: 'General Government — Intergovernmental',            total:      324_121 },
    { name: 'Culture, Recreation & Tourism — Intergovernmental', total:       13_715 },
    { name: 'Transportation & Development — Intergovernmental',  total:       18_570 },
    { name: 'Public Safety — Intergovernmental',                 total:      672_808 },
    { name: 'Health & Welfare — Intergovernmental',              total:      215_738 },
    { name: 'Corrections — Intergovernmental',                   total:       68_619 },
    { name: 'Youth Development — Intergovernmental',             total:       11_139 },
    { name: 'Conservation & Environment — Intergovernmental',    total:        1_806 },
    { name: 'Education — Intergovernmental',                     total:    6_801_090 },
    { name: 'Agriculture & Forestry — Intergovernmental',        total:        7_970 },
    { name: 'Economic Development — Intergovernmental',          total:      163_095 },
    { name: 'Workforce Support & Training — Intergovernmental',  total:       14_612 },
    { name: 'Capital Outlay — Intergovernmental',                total:      316_264 },
    { name: 'Debt service — Principal',                          total:       87_749 },
    { name: 'Debt service — Interest',                           total:       13_939 },
    { name: 'Issuance Costs & Other Charges',                    total:          388 },
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
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Louisiana General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
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
    const srcPayload = { name: 'Louisiana General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'la-acfr-gf-operating', base_url: 'https://www.doa.la.gov/doa/osrap/annual-financial-report/', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
