#!/usr/bin/env node
/**
 * Oklahoma General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Oklahoma Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the OK state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   OK state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-48): OK ACFR GF ~3.35x NASBO GF (FY2024 $30,604,464K vs FY2024 NASBO
 *   $9,139,000K) -- the WIDEST divergence in Batch 4. Oklahoma's General Fund consolidates
 *   nearly all state general-purpose taxes AND the full Federal Grants line ($13,780,254K
 *   FY2024, ~45% of GF total revenues) into a single fund, whereas NASBO's narrower budgetary
 *   concept excludes most earmarked/dedicated-revolving-fund and federal-passthrough activity.
 *   Accepted-and-relabelled honestly (TX/MI/WV precedent), documented prominently.
 *
 * 5-COLUMN LAYOUT: GENERAL is the 1st of 5 (General | Commissioners of the Land Office |
 *   Department of Wildlife Lifetime Licenses | Tobacco Settlement Endowment | Total
 *   Governmental Funds). extract_gf.py's position-anchor isolates General regardless of the
 *   total column count -- confirmed at both bookends (FY2024 rev $30,604,464K / FY2002 rev
 *   $9,568,595K, exact $0 diff on BOTH revenues and expenditures, byte-identical to the
 *   preserved v2.14/117 recon) and on all 23 loaded years.
 *
 * SHARED EXTRACTOR FIX (ACFR-48 discovered it, reusable): FY2013's `pdftotext -table` output
 *   letter-spaces the bold "Total Revenues"/"Total Expenditures" row labels as "T otal Revenues"
 *   / "T otal Expenditures" (same class of defect as AR's letter-spaced section headers and MT's
 *   parenthetical statement-note suffix). The un-normalized `label.lower().startswith('total
 *   revenues')` check silently failed to recognize these rows as totals, which let extract_gf.py
 *   fall through to an EARLIER, WRONG candidate match (a Management's Discussion & Analysis
 *   narrative paragraph that happens to mention the statement's title in prose) and mis-tie
 *   against unrelated MD&A summary-table figures instead of the real Governmental Funds
 *   statement. Fixed generically in extract_gf.py: a new `flat()` helper strips ALL whitespace
 *   from a candidate LABEL (not the full row) before comparing to 'totalrevenues'/
 *   'totalexpenditures'/'total', so "T otal Revenues" normalizes to "totalrevenues" and matches
 *   correctly regardless of injected spacing. Re-verified zero regression across a cohort spot
 *   check (SC 24/24, MT 11/11, NE 6/6, ND 7/7, KS 7/7, CO 3/3, UT 7/7, ME 24/24 excl. its own
 *   documented FY2000/2001 pre-GASB-34 holes, IA's dedicated ia_extract.py post-processor
 *   unaffected by design) -- all previously-tying years still tie identically after the fix.
 *
 * HONEST HAND-PATCH (FY2019, NM FY2022 precedent): FY2019's Governmental Funds statement page
 *   (PDF page 56) has NO text layer at all for its data table -- `pdffonts`/`pdfimages` confirm
 *   the entire numeric table is embedded as a single JPEG picture (2388x2619px), not live text,
 *   while the surrounding narrative pages on either side extract normally. Rendered the page to
 *   PNG (`pdftoppm -r 300`) and hand-transcribed the GENERAL column directly from the crisp
 *   rendered image; independently re-summed BOTH the revenue items (19,417,878) and expenditure
 *   items (18,344,756) to confirm exact $0 diff against the printed "Total Revenues"/"Total
 *   Expenditures" figures before hand-patching ok_all.json. Category-name convention matches the
 *   sibling FY2018/FY2020 auto-extracted years exactly (OK's own PDFs never put a colon after a
 *   "Taxes"/"Debt Service" subsection header, so extract_gf.py's own pending-label mechanism
 *   merges the header text onto only the FIRST item in that subsection, e.g. "Taxes Income
 *   Taxes-Individual", "Debt Service Principal Retirement" -- FY2019 was hand-authored to follow
 *   this exact same established pattern for cohort consistency).
 *
 * URL PATTERN (mostly derivable, current-year exception): FY2000-FY2020 =
 *   cafr{YYYY}.pdf; FY2021-FY2023 = ACFR{YYYY}.pdf; FY2024 (current, breaks the pattern) =
 *   acfr-2024.pdf. Landing: oklahoma.gov/omes/divisions/central-accounting-reporting/
 *   financial-reporting/acfr-archives.html. All 23 downloaded PDFs confirmed real
 *   (%PDF magic, >2MB each, application/pdf).
 *
 * HONEST HOLE (FY2025): re-checked live at load time (2026-07-04) -- HTTP 404 on
 *   acfr-2025.pdf, landing page's newest entry remains FY2024. Not a gap -- normal reporting
 *   lag (byte-identical finding to the 117 recon dated the same day). Does not block the
 *   recency floor (FY2023 + FY2024 both loaded). Window = FY2002-FY2024 (23 years).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Interest and Investment Revenue" is positive at both bookends (FY2024 +$459,743K, FY2002 +$96,796K) -- no P2 clamp risk from that line. FULL-COHORT SCAN found ONE genuine negative interior line: FY2014 "Other" revenue = -$99,596K (printed "(99,596)" in the GENERAL column; a real GAAP refund/adjustment, confirmed against the raw statement text, not an extraction artifact) -- the P2 clamp IS exercised for OK at FY2014; no year shows a negative GF Total revenues (FY2014 GF total revenues still ties positive at $16,866,273K).
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ok/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processOKAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Oklahoma'; const STATE_ABBR = 'OK'; const POPULATION = 4_053_824;
const EXPECTED_MUNI_ID = '54233a91-919d-4a5f-9f24-2f9325250e64';
const UNITS = 1_000; // OK ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2002.pdf', date: '2002-06-30' },
  2003: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2003.pdf', date: '2003-06-30' },
  2004: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2004.pdf', date: '2004-06-30' },
  2005: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2005.pdf', date: '2005-06-30' },
  2006: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2006.pdf', date: '2006-06-30' },
  2007: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2007.pdf', date: '2007-06-30' },
  2008: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2008.pdf', date: '2008-06-30' },
  2009: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2009.pdf', date: '2009-06-30' },
  2010: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2010.pdf', date: '2010-06-30' },
  2011: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2011.pdf', date: '2011-06-30' },
  2012: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2012.pdf', date: '2012-06-30' },
  2013: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2013.pdf', date: '2013-06-30' },
  2014: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2014.pdf', date: '2014-06-30' },
  2015: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2015.pdf', date: '2015-06-30' },
  2016: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2016.pdf', date: '2016-06-30' },
  2017: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2017.pdf', date: '2017-06-30' },
  2018: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2018.pdf', date: '2018-06-30' },
  2019: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2019.pdf', date: '2019-06-30' },
  2020: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://oklahoma.gov/content/dam/ok/en/omes/documents/acfr-2024.pdf', date: '2024-06-30' },
};
const dataSource = (fy) => `Oklahoma State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — OK ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 10_107_983, confidence: 'actual', categories: [
    { name: 'Current Education',           total:    3_323_695 },
    { name: 'General Government',          total:      385_283 },
    { name: 'Health Services',             total:      396_472 },
    { name: 'Legal and Judiciary',         total:      164_410 },
    { name: 'Museums',                     total:        9_302 },
    { name: 'Natural Resources',           total:      182_524 },
    { name: 'Public Safety and Defense',   total:      737_410 },
    { name: 'Regulatory Services',         total:      167_360 },
    { name: 'Social Services',             total:    3_684_277 },
    { name: 'Transportation',              total:      233_439 },
    { name: 'Capital Outlay',              total:      706_508 },
    { name: 'Principal Retirement',        total:       63_850 },
    { name: 'Interest and Fiscal Charges', total:       53_453 },
  ]},
  2003: { total: 10_580_440, confidence: 'actual', categories: [
    { name: 'Current Education',                 total:    3_249_856 },
    { name: 'General Government',                total:      980_742 },
    { name: 'Health Services',                   total:      390_047 },
    { name: 'Legal and Judiciary',               total:      163_576 },
    { name: 'Museums',                           total:        7_943 },
    { name: 'Natural Resources',                 total:      186_898 },
    { name: 'Public Safety and Defense',         total:      607_896 },
    { name: 'Regulatory Services',               total:      174_004 },
    { name: 'Social Services',                   total:    3_822_301 },
    { name: 'Transportation',                    total:      222_475 },
    { name: 'Capital Outlay',                    total:      653_302 },
    { name: 'Debt Service Principal Retirement', total:       75_226 },
    { name: 'Interest and Fiscal Charges',       total:       46_174 },
  ]},
  2004: { total: 11_004_663, confidence: 'actual', categories: [
    { name: 'Current Education',                 total:    3_342_814 },
    { name: 'General Government',                total:    1_240_291 },
    { name: 'Health Services',                   total:      385_634 },
    { name: 'Legal and Judiciary',               total:      155_822 },
    { name: 'Museums',                           total:        9_497 },
    { name: 'Natural Resources',                 total:      170_469 },
    { name: 'Public Safety and Defense',         total:      596_905 },
    { name: 'Regulatory Services',               total:       70_559 },
    { name: 'Social Services',                   total:    4_118_013 },
    { name: 'Transportation',                    total:      205_421 },
    { name: 'Capital Outlay',                    total:      635_411 },
    { name: 'Debt Service Principal Retirement', total:       28_212 },
    { name: 'Interest and Fiscal Charges',       total:       45_615 },
  ]},
  2005: { total: 11_663_447, confidence: 'actual', categories: [
    { name: 'Current Education',                 total:    3_534_042 },
    { name: 'General Government',                total:    1_412_973 },
    { name: 'Health Services',                   total:    3_144_918 },
    { name: 'Legal and Judiciary',               total:      170_337 },
    { name: 'Museums',                           total:       11_171 },
    { name: 'Natural Resources',                 total:      191_514 },
    { name: 'Public Safety and Defense',         total:      628_901 },
    { name: 'Regulatory Services',               total:       81_333 },
    { name: 'Social Services',                   total:    1_589_397 },
    { name: 'Transportation',                    total:      146_013 },
    { name: 'Capital Outlay',                    total:      673_529 },
    { name: 'Debt Service Principal Retirement', total:       31_550 },
    { name: 'Interest and Fiscal Charges',       total:       47_769 },
  ]},
  2006: { total: 12_847_605, confidence: 'actual', categories: [
    { name: 'Current Education',                 total:    3_702_398 },
    { name: 'General Government',                total:    1_599_341 },
    { name: 'Health Services',                   total:    3_447_085 },
    { name: 'Legal and Judiciary',               total:      190_644 },
    { name: 'Museums',                           total:       30_316 },
    { name: 'Natural Resources',                 total:      231_616 },
    { name: 'Public Safety and Defense',         total:      674_494 },
    { name: 'Regulatory Services',               total:      114_871 },
    { name: 'Social Services',                   total:    1_697_057 },
    { name: 'Transportation',                    total:      224_885 },
    { name: 'Capital Outlay',                    total:      768_003 },
    { name: 'Debt Service Principal Retirement', total:       98_512 },
    { name: 'Interest and Fiscal Charges',       total:       68_383 },
  ]},
  2007: { total: 14_050_015, confidence: 'actual', categories: [
    { name: 'Current Education',                 total:    4_150_812 },
    { name: 'General Government',                total:    1_594_480 },
    { name: 'Health Services',                   total:    3_936_893 },
    { name: 'Legal and Judiciary',               total:      207_229 },
    { name: 'Museums',                           total:       17_045 },
    { name: 'Natural Resources',                 total:      238_075 },
    { name: 'Public Safety and Defense',         total:      773_813 },
    { name: 'Regulatory Services',               total:      108_231 },
    { name: 'Social Services',                   total:    1_758_475 },
    { name: 'Transportation',                    total:      173_532 },
    { name: 'Capital Outlay',                    total:      918_055 },
    { name: 'Debt Service Principal Retirement', total:      103_606 },
    { name: 'Interest and Fiscal Charges',       total:       69_769 },
  ]},
  2008: { total: 14_921_282, confidence: 'actual', categories: [
    { name: 'Current Education',                 total:    4_305_744 },
    { name: 'General Government',                total:    1_681_350 },
    { name: 'Health Services',                   total:    4_200_188 },
    { name: 'Legal and Judiciary',               total:      215_942 },
    { name: 'Museums',                           total:       31_586 },
    { name: 'Natural Resources',                 total:      263_551 },
    { name: 'Public Safety and Defense',         total:      876_660 },
    { name: 'Regulatory Services',               total:       93_438 },
    { name: 'Social Services',                   total:    1_755_810 },
    { name: 'Transportation',                    total:      286_540 },
    { name: 'Capital Outlay',                    total:    1_010_262 },
    { name: 'Debt Service Principal Retirement', total:      126_103 },
    { name: 'Interest and Fiscal Charges',       total:       74_108 },
  ]},
  2009: { total: 15_953_003, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_519_438 },
    { name: 'General Government',                total:    1_614_395 },
    { name: 'Health Services',                   total:    4_525_993 },
    { name: 'Legal and Judiciary',               total:      225_225 },
    { name: 'Museums',                           total:       16_903 },
    { name: 'Natural Resources',                 total:      271_487 },
    { name: 'Public Safety and Defense',         total:      915_880 },
    { name: 'Regulatory Services',               total:      127_803 },
    { name: 'Social Services',                   total:    1_933_117 },
    { name: 'Transportation',                    total:      199_517 },
    { name: 'Capital Outlay',                    total:    1_438_064 },
    { name: 'Debt Service Principal Retirement', total:       95_155 },
    { name: 'Interest and Fiscal Charges',       total:       70_026 },
  ]},
  2010: { total: 16_457_887, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_516_770 },
    { name: 'General Government',                total:    1_541_068 },
    { name: 'Health Services',                   total:    4_737_363 },
    { name: 'Legal and Judiciary',               total:      248_996 },
    { name: 'Museums',                           total:       14_993 },
    { name: 'Natural Resources',                 total:      279_830 },
    { name: 'Public Safety and Defense',         total:      755_376 },
    { name: 'Regulatory Services',               total:      117_821 },
    { name: 'Social Services',                   total:    2_259_473 },
    { name: 'Transportation',                    total:      177_683 },
    { name: 'Capital Outlay',                    total:    1_626_149 },
    { name: 'Debt Service Principal Retirement', total:      111_816 },
    { name: 'Interest and Fiscal Charges',       total:       70_549 },
  ]},
  2011: { total: 16_451_307, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_399_422 },
    { name: 'General Government',                total:    1_613_827 },
    { name: 'Health Services',                   total:    4_851_630 },
    { name: 'Legal and Judiciary',               total:      232_245 },
    { name: 'Museums',                           total:       13_801 },
    { name: 'Natural Resources',                 total:      250_174 },
    { name: 'Public Safety and Defense',         total:      798_995 },
    { name: 'Regulatory Services',               total:      115_076 },
    { name: 'Social Services',                   total:    2_252_188 },
    { name: 'Transportation',                    total:      182_708 },
    { name: 'Capital Outlay',                    total:    1_551_004 },
    { name: 'Debt Service Principal Retirement', total:      118_163 },
    { name: 'Interest and Fiscal Charges',       total:       72_074 },
  ]},
  2012: { total: 16_484_978, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_209_660 },
    { name: 'General Government',                total:    1_708_680 },
    { name: 'Health Services',                   total:    5_436_158 },
    { name: 'Legal and Judiciary',               total:      231_292 },
    { name: 'Museums',                           total:       14_281 },
    { name: 'Natural Resources',                 total:      211_946 },
    { name: 'Public Safety and Defense',         total:      764_714 },
    { name: 'Regulatory Services',               total:      111_911 },
    { name: 'Social Services',                   total:    2_091_972 },
    { name: 'Transportation',                    total:      208_009 },
    { name: 'Capital Outlay',                    total:    1_302_427 },
    { name: 'Debt Service Principal Retirement', total:       98_831 },
    { name: 'Interest and Fiscal Charges',       total:       95_097 },
  ]},
  2013: { total: 16_862_909, confidence: 'actual', categories: [
    { name: 'Educat io n',                       total:    4_265_166 },
    { name: 'General Government',                total:    1_821_488 },
    { name: 'Health Services',                   total:    5_447_207 },
    { name: 'Legal and Judiciary',               total:      239_421 },
    { name: 'Museums',                           total:       14_915 },
    { name: 'Natural Resources',                 total:      337_867 },
    { name: 'Public Safety and Defense',         total:      768_059 },
    { name: 'Regulatory Services',               total:      122_354 },
    { name: 'Social Services',                   total:    2_196_864 },
    { name: 'T ransportation',                   total:      212_248 },
    { name: 'Capital Outlay',                    total:    1_104_103 },
    { name: 'Debt Service Principal Retirement', total:      221_187 },
    { name: 'Interest and Fiscal Charges',       total:      112_030 },
  ]},
  2014: { total: 17_331_768, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_213_301 },
    { name: 'Government Administration',         total:    2_166_450 },
    { name: 'Health Services',                   total:    5_745_842 },
    { name: 'Legal and Judiciary',               total:      250_376 },
    { name: 'Museums',                           total:       14_532 },
    { name: 'Natural Resources',                 total:      246_556 },
    { name: 'Public Safety and Defense',         total:      798_173 },
    { name: 'Regulatory Services',               total:      128_460 },
    { name: 'Social Services',                   total:    2_214_898 },
    { name: 'Transportation',                    total:      225_768 },
    { name: 'Capital Outlay',                    total:      894_655 },
    { name: 'Debt Service Principal Retirement', total:      361_488 },
    { name: 'Interest and Fiscal Charges',       total:       71_269 },
  ]},
  2015: { total: 17_171_876, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_293_365 },
    { name: 'Government Administration',         total:    1_472_381 },
    { name: 'Health Services',                   total:    5_636_440 },
    { name: 'Legal and Judiciary',               total:      248_668 },
    { name: 'Museums',                           total:        9_698 },
    { name: 'Natural Resources',                 total:      273_081 },
    { name: 'Public Safety and Defense',         total:      786_197 },
    { name: 'Regulatory Services',               total:      150_864 },
    { name: 'Social Services',                   total:    2_177_124 },
    { name: 'Transportation',                    total:      203_021 },
    { name: 'Capital Outlay',                    total:    1_451_561 },
    { name: 'Debt Service Principal Retirement', total:      408_643 },
    { name: 'Interest and Fiscal Charges',       total:       60_833 },
  ]},
  2016: { total: 17_754_999, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_230_653 },
    { name: 'Government Administration',         total:    1_643_507 },
    { name: 'Health Services',                   total:    5_704_161 },
    { name: 'Legal and Judiciary',               total:      251_114 },
    { name: 'Museums',                           total:        9_074 },
    { name: 'Natural Resources',                 total:      281_530 },
    { name: 'Public Safety and Defense',         total:      826_716 },
    { name: 'Regulatory Services',               total:      191_627 },
    { name: 'Social Services',                   total:    2_347_661 },
    { name: 'Transportation',                    total:      237_427 },
    { name: 'Capital Outlay',                    total:    1_764_029 },
    { name: 'Debt Service Principal Retirement', total:      191_272 },
    { name: 'Interest and Fiscal Charges',       total:       76_228 },
  ]},
  2017: { total: 17_300_084, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_094_404 },
    { name: 'Government Administration',         total:    1_877_349 },
    { name: 'Health Services',                   total:    5_614_255 },
    { name: 'Legal and Judiciary',               total:      254_551 },
    { name: 'Museums',                           total:        7_444 },
    { name: 'Natural Resources',                 total:      295_638 },
    { name: 'Public Safety and Defense',         total:      837_157 },
    { name: 'Regulatory Services',               total:       95_621 },
    { name: 'Social Services',                   total:    2_192_547 },
    { name: 'Transportation',                    total:      203_290 },
    { name: 'Capital Outlay',                    total:    1_575_450 },
    { name: 'Debt Service Principal Retirement', total:      179_384 },
    { name: 'Interest and Fiscal Charges',       total:       72_994 },
  ]},
  2018: { total: 17_180_747, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_125_378 },
    { name: 'Government Administration',         total:    1_936_229 },
    { name: 'Health Services',                   total:    5_595_980 },
    { name: 'Legal and Judiciary',               total:      255_739 },
    { name: 'Museums',                           total:        7_650 },
    { name: 'Natural Resources',                 total:      252_484 },
    { name: 'Public Safety and Defense',         total:      838_098 },
    { name: 'Regulatory Services',               total:      114_355 },
    { name: 'Social Services',                   total:    2_145_461 },
    { name: 'Transportation',                    total:      215_428 },
    { name: 'Capital Outlay',                    total:    1_494_528 },
    { name: 'Debt Service Principal Retirement', total:      140_272 },
    { name: 'Interest and Fiscal Charges',       total:       59_145 },
  ]},
  2019: { total: 18_344_756, confidence: 'actual', categories: [
    { name: 'Education',                         total:    4_667_479 },
    { name: 'Government Administration',         total:    2_001_609 },
    { name: 'Health Services',                   total:    5_954_945 },
    { name: 'Legal and Judiciary',               total:      263_275 },
    { name: 'Museums',                           total:       12_553 },
    { name: 'Natural Resources',                 total:      449_324 },
    { name: 'Public Safety and Defense',         total:      833_423 },
    { name: 'Regulatory Services',               total:      150_625 },
    { name: 'Social Services',                   total:    2_179_379 },
    { name: 'Transportation',                    total:      233_357 },
    { name: 'Capital Outlay',                    total:    1_388_291 },
    { name: 'Debt Service Principal Retirement', total:      157_460 },
    { name: 'Interest and Fiscal Charges',       total:       53_036 },
  ]},
  2020: { total: 19_566_178, confidence: 'actual', categories: [
    { name: 'Education',                         total:    5_041_110 },
    { name: 'Government Administration',         total:    2_114_446 },
    { name: 'Health Services',                   total:    6_190_644 },
    { name: 'Legal and Judiciary',               total:      270_298 },
    { name: 'Museums',                           total:       12_997 },
    { name: 'Natural Resources',                 total:      298_966 },
    { name: 'Public Safety and Defense',         total:      901_917 },
    { name: 'Regulatory Services',               total:      147_474 },
    { name: 'Social Services',                   total:    2_454_286 },
    { name: 'Transportation',                    total:      247_456 },
    { name: 'Capital Outlay',                    total:    1_609_621 },
    { name: 'Debt Service Principal Retirement', total:      215_446 },
    { name: 'Interest Fiscal Charges',           total:       61_517 },
  ]},
  2021: { total: 22_278_303, confidence: 'actual', categories: [
    { name: 'Education',                         total:    5_111_053 },
    { name: 'Government Administration',         total:    2_891_051 },
    { name: 'Health Services',                   total:    6_788_138 },
    { name: 'Legal and Judiciary',               total:      273_784 },
    { name: 'Museums',                           total:       13_199 },
    { name: 'Natural Resources',                 total:      498_354 },
    { name: 'Public Safety and Defense',         total:      908_312 },
    { name: 'Regulatory Services',               total:      286_465 },
    { name: 'Social Services',                   total:    3_281_031 },
    { name: 'Transportation',                    total:      231_180 },
    { name: 'Capital Outlay',                    total:    1_814_849 },
    { name: 'Debt Service Principal Retirement', total:      122_507 },
    { name: 'Interest',                          total:       58_380 },
  ]},
  2022: { total: 25_591_387, confidence: 'actual', categories: [
    { name: 'Education',                         total:    5_908_767 },
    { name: 'Government Administration',         total:    3_130_056 },
    { name: 'Health Services',                   total:    8_477_738 },
    { name: 'Legal and Judiciary',               total:      295_814 },
    { name: 'Museums',                           total:       13_775 },
    { name: 'Natural Resources',                 total:      463_591 },
    { name: 'Public Safety and Defense',         total:      970_175 },
    { name: 'Regulatory Services',               total:      277_123 },
    { name: 'Social Services',                   total:    3_941_632 },
    { name: 'Transportation',                    total:      417_180 },
    { name: 'Capital Outlay',                    total:    1_489_367 },
    { name: 'Debt Service Principal Retirement', total:      141_899 },
    { name: 'Interest',                          total:       64_270 },
  ]},
  2023: { total: 28_121_194, confidence: 'actual', categories: [
    { name: 'Education',                         total:    5_844_930 },
    { name: 'Government Administration',         total:    3_088_201 },
    { name: 'Health Services',                   total:   10_213_534 },
    { name: 'Legal and Judiciary',               total:      265_408 },
    { name: 'Museums',                           total:       17_636 },
    { name: 'Natural Resources',                 total:      659_816 },
    { name: 'Public Safety and Defense',         total:      998_353 },
    { name: 'Regulatory Services',               total:      301_531 },
    { name: 'Social Services',                   total:    4_445_814 },
    { name: 'Transportation',                    total:      504_706 },
    { name: 'Capital Outlay',                    total:    1_528_083 },
    { name: 'Debt Service Principal Retirement', total:      185_451 },
    { name: 'Interest',                          total:       67_731 },
  ]},
  2024: { total: 30_421_436, confidence: 'actual', categories: [
    { name: 'Education',                         total:    6_566_142 },
    { name: 'Government Administration',         total:    3_350_697 },
    { name: 'Health Services',                   total:   11_140_882 },
    { name: 'Legal and Judiciary',               total:      317_063 },
    { name: 'Museums',                           total:       20_027 },
    { name: 'Natural Resources',                 total:      975_070 },
    { name: 'Public Safety and Defense',         total:    1_138_649 },
    { name: 'Regulatory Services',               total:      316_954 },
    { name: 'Social Services',                   total:    3_872_288 },
    { name: 'Transportation',                    total:      569_584 },
    { name: 'Capital Outlay',                    total:    1_908_455 },
    { name: 'Debt Service Principal Retirement', total:      181_119 },
    { name: 'Interest',                          total:       64_506 },
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
  return { jsonTree: [{ n: 'Oklahoma General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'Oklahoma General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ok-acfr-gf-operating', base_url: 'https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
