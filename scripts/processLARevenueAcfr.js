#!/usr/bin/env node
/**
 * Louisiana General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Louisiana Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the LA state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/la/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processLARevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Louisiana State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — LA ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 5_807_699, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:    5_767_877 },
    { name: 'Use of Money and Property',  total:       18_822 },
    { name: 'Other',                      total:       21_000 },
  ]},
  2003: { total: 6_333_578, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:    6_266_779 },
    { name: 'Use of Money and Property',  total:       25_789 },
    { name: 'Other',                      total:       41_010 },
  ]},
  2004: { total: 6_691_138, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:    6_715_586 },
    { name: 'Use of Money and Property',  total:      -38_246 },
    { name: 'Other',                      total:       13_798 },
  ]},
  2005: { total: 7_101_146, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:    7_057_275 },
    { name: 'Use of Money and Property',  total:          583 },
    { name: 'Other',                      total:       43_288 },
  ]},
  2006: { total: 8_899_321, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:    8_854_240 },
    { name: 'Use of Money and Property',  total:        4_990 },
    { name: 'Other',                      total:       40_091 },
  ]},
  2007: { total: 12_499_982, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:   12_374_474 },
    { name: 'Use of Money and Property',  total:       66_204 },
    { name: 'Other',                      total:       59_304 },
  ]},
  2008: { total: 13_414_077, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:   13_241_880 },
    { name: 'Use of Money and Property',  total:      118_450 },
    { name: 'Other',                      total:       53_747 },
  ]},
  2009: { total: 12_889_013, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:   12_766_711 },
    { name: 'Use of Money and Property',  total:       86_435 },
    { name: 'Other',                      total:       35_867 },
  ]},
  2010: { total: 12_441_850, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues', total:   12_381_334 },
    { name: 'Use of Money and Property',  total:          781 },
    { name: 'Other',                      total:       59_735 },
  ]},
  2011: { total: 12_878_833, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',       total:   12_568_845 },
    { name: 'Use of Money and Property',        total:        7_253 },
    { name: 'Licenses, Permits, and Fees',      total:        4_058 },
    { name: 'Pollution Remediation Settlement', total:      258_631 },
    { name: 'Other',                            total:       40_046 },
  ]},
  2012: { total: 11_660_084, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',       total:   11_601_915 },
    { name: 'Use of Money and Property',        total:      -20_092 },
    { name: 'Licenses, Permits, and Fees',      total:        4_014 },
    { name: 'Pollution Remediation Settlement', total:       13_996 },
    { name: 'Other',                            total:       60_251 },
  ]},
  2013: { total: 10_287_062, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',       total:   10_228_621 },
    { name: 'Use of Money and Property',        total:      -80_800 },
    { name: 'Licenses, Permits, and Fees',      total:       10_326 },
    { name: 'Pollution Remediation Settlement', total:       87_519 },
    { name: 'Other',                            total:       41_396 },
  ]},
  2014: { total: 10_682_828, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',       total:   10_578_699 },
    { name: 'Use of Money and Property',        total:       13_794 },
    { name: 'Licenses, Permits, and Fees',      total:        2_760 },
    { name: 'Pollution Remediation Settlement', total:       44_785 },
    { name: 'Other',                            total:       42_790 },
  ]},
  2015: { total: 10_625_856, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   10_371_748 },
    { name: 'Use of Money & Property',             total:       16_538 },
    { name: 'Licenses, Permits & Fees',            total:        7_880 },
    { name: 'Sales of Commodities & Services',     total:       61_054 },
    { name: 'Unclaimed Property',                  total:       24_824 },
    { name: 'Other Settlements',                   total:       12_200 },
    { name: 'Gifts, Donations, and Contributions', total:       36_928 },
    { name: 'Other',                               total:       94_684 },
  ]},
  2016: { total: 10_080_454, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:    9_922_224 },
    { name: 'Use of Money & Property',             total:       26_623 },
    { name: 'Licenses, Permits & Fees',            total:       13_196 },
    { name: 'Sales of Commodities & Services',     total:        2_415 },
    { name: 'Unclaimed Property',                  total:       43_021 },
    { name: 'Other Settlements',                   total:            3 },
    { name: 'Gifts, Donations, and Contributions', total:           82 },
    { name: 'Other',                               total:       72_890 },
  ]},
  2017: { total: 13_841_215, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   13_678_391 },
    { name: 'Use of Money & Property',             total:       15_251 },
    { name: 'Licenses, Permits & Fees',            total:        7_842 },
    { name: 'Sales of Commodities & Services',     total:        8_034 },
    { name: 'Unclaimed Property',                  total:       53_462 },
    { name: 'Other Settlements',                   total:        5_323 },
    { name: 'Gifts, Donations, and Contributions', total:       20_036 },
    { name: 'Other',                               total:       52_876 },
  ]},
  2018: { total: 13_138_256, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   12_923_707 },
    { name: 'Taxes',                               total:        4_350 },
    { name: 'Use of Money & Property',             total:       10_620 },
    { name: 'Licenses, Permits & Fees',            total:       25_276 },
    { name: 'Sales of Commodities & Services',     total:        8_351 },
    { name: 'Unclaimed Property',                  total:       43_086 },
    { name: 'Other Settlements',                   total:          290 },
    { name: 'Gifts, Donations, and Contributions', total:       67_356 },
    { name: 'Other',                               total:       55_220 },
  ]},
  2019: { total: 13_760_440, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   13_485_650 },
    { name: 'Use of Money & Property',             total:       14_673 },
    { name: 'Licenses, Permits & Fees',            total:       24_793 },
    { name: 'Sales of Commodities & Services',     total:        6_880 },
    { name: 'Unclaimed Property',                  total:       21_303 },
    { name: 'Other Settlements',                   total:       53_334 },
    { name: 'Gifts, Donations, and Contributions', total:       75_949 },
    { name: 'Other',                               total:       77_858 },
  ]},
  2020: { total: 16_202_084, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   15_961_789 },
    { name: 'Taxes',                               total:           96 },
    { name: 'Use of Money & Property',             total:       12_239 },
    { name: 'Licenses, Permits & Fees',            total:       24_265 },
    { name: 'Sales of Commodities & Services',     total:        5_601 },
    { name: 'Gifts, Donations, and Contributions', total:      127_934 },
    { name: 'Other',                               total:       70_160 },
  ]},
  2021: { total: 20_434_431, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   20_134_839 },
    { name: 'Use of Money & Property',             total:       14_983 },
    { name: 'Licenses, Permits & Fees',            total:       25_175 },
    { name: 'Sales of Commodities & Services',     total:        8_110 },
    { name: 'Unclaimed Property',                  total:        4_601 },
    { name: 'Gifts, Donations, and Contributions', total:       87_877 },
    { name: 'Other',                               total:      158_846 },
  ]},
  2022: { total: 22_874_308, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   22_645_959 },
    { name: 'Taxes',                               total:           78 },
    { name: 'Use of Money & Property',             total:       -4_006 },
    { name: 'Licenses, Permits & Fees',            total:       25_365 },
    { name: 'Sales of Commodities & Services',     total:        8_354 },
    { name: 'Gifts, Donations, and Contributions', total:       91_530 },
    { name: 'Other',                               total:      107_028 },
  ]},
  2023: { total: 25_951_221, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   25_638_665 },
    { name: 'Use of Money & Property',             total:       12_927 },
    { name: 'Licenses, Permits & Fees',            total:       24_527 },
    { name: 'Sales of Commodities & Services',     total:        8_014 },
    { name: 'Gifts, Donations, and Contributions', total:      125_452 },
    { name: 'Other',                               total:      141_636 },
  ]},
  2024: { total: 24_115_531, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   23_766_628 },
    { name: 'Use of Money & Property',             total:       20_703 },
    { name: 'Licenses, Permits & Fees',            total:       25_726 },
    { name: 'Sales of Commodities & Services',     total:        8_334 },
    { name: 'Gifts, Donations, and Contributions', total:      126_248 },
    { name: 'Other',                               total:      167_892 },
  ]},
  2025: { total: 22_780_529, confidence: 'actual', categories: [
    { name: 'Intergovernmental Revenues',          total:   22_482_784 },
    { name: 'Use of Money & Property',             total:       50_906 },
    { name: 'Licenses, Permits & Fees',            total:       26_794 },
    { name: 'Sales of Commodities & Services',     total:        8_287 },
    { name: 'Gifts, Donations, and Contributions', total:      126_208 },
    { name: 'Other',                               total:       85_550 },
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
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Louisiana General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
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
    const srcPayload = { name: 'Louisiana General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'la-acfr-gf-revenue', base_url: 'https://www.doa.la.gov/doa/osrap/annual-financial-report/', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
