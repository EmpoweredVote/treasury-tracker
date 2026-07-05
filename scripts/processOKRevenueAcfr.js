#!/usr/bin/env node
/**
 * Oklahoma General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Oklahoma Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the OK state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ok/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processOKRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Oklahoma State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — OK ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 9_568_595, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_193_040 },
    { name: 'Income Taxes-Corporate',          total:      205_759 },
    { name: 'Sales Tax',                       total:    1_478_325 },
    { name: 'Gross Production Taxes',          total:      226_094 },
    { name: 'Motor Vehicle Taxes',             total:      250_870 },
    { name: 'Fuel Taxes',                      total:      274_476 },
    { name: 'Insurance Taxes',                 total:      174_424 },
    { name: 'Beverage Taxes',                  total:       55_637 },
    { name: 'Other Taxes',                     total:      223_163 },
    { name: 'Licenses, Permits and Fees',      total:      243_821 },
    { name: 'Interest and Investment Revenue', total:       96_796 },
    { name: 'Federal Grants',                  total:    3_647_137 },
    { name: 'Sales and Services',              total:      136_043 },
    { name: 'Other',                           total:      363_010 },
  ]},
  2003: { total: 10_219_858, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_063_414 },
    { name: 'Income Taxes-Corporate',          total:      178_161 },
    { name: 'Sales Tax',                       total:    1_437_630 },
    { name: 'Gross Production Taxes',          total:      468_064 },
    { name: 'Motor Vehicle Taxes',             total:      539_748 },
    { name: 'Fuel Taxes',                      total:      378_021 },
    { name: 'Insurance Taxes',                 total:      197_799 },
    { name: 'Beverage Taxes',                  total:       66_291 },
    { name: 'Other Taxes',                     total:      210_982 },
    { name: 'Licenses, Permits and Fees',      total:      244_143 },
    { name: 'Interest and Investment Revenue', total:       54_740 },
    { name: 'Federal Grants',                  total:    3_928_922 },
    { name: 'Sales and Services',              total:      146_204 },
    { name: 'Other',                           total:      305_739 },
  ]},
  2004: { total: 11_412_583, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_427_239 },
    { name: 'Income Taxes-Corporate',          total:      199_937 },
    { name: 'Sales Tax',                       total:    1_623_423 },
    { name: 'Gross Production Taxes',          total:      656_035 },
    { name: 'Motor Vehicle Taxes',             total:      572_844 },
    { name: 'Fuel Taxes',                      total:      383_871 },
    { name: 'Insurance Taxes',                 total:      173_535 },
    { name: 'Beverage Taxes',                  total:       68_617 },
    { name: 'Other Taxes',                     total:      163_262 },
    { name: 'Licenses, Permits and Fees',      total:      257_683 },
    { name: 'Interest and Investment Revenue', total:       47_201 },
    { name: 'Federal Grants',                  total:    4_314_751 },
    { name: 'Sales and Services',              total:      146_896 },
    { name: 'Other',                           total:      377_289 },
  ]},
  2005: { total: 12_048_398, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_410_234 },
    { name: 'Income Taxes-Corporate',          total:      277_265 },
    { name: 'Sales Tax',                       total:    1_682_636 },
    { name: 'Gross Production Taxes',          total:      737_204 },
    { name: 'Motor Vehicle Taxes',             total:      574_800 },
    { name: 'Fuel Taxes',                      total:      407_276 },
    { name: 'Tobacco Taxes',                   total:      124_347 },
    { name: 'Insurance Taxes',                 total:       81_852 },
    { name: 'Beverage Taxes',                  total:       71_300 },
    { name: 'Other Taxes',                     total:      285_808 },
    { name: 'Licenses, Permits and Fees',      total:      282_976 },
    { name: 'Interest and Investment Revenue', total:      117_927 },
    { name: 'Federal Grants',                  total:    4_493_290 },
    { name: 'Sales and Services',              total:      157_501 },
    { name: 'Other',                           total:      343_982 },
  ]},
  2006: { total: 13_542_723, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_693_548 },
    { name: 'Income Taxes-Corporate',          total:      426_725 },
    { name: 'Sales Tax',                       total:    1_843_803 },
    { name: 'Gross Production Taxes',          total:    1_036_888 },
    { name: 'Motor Vehicle Taxes',             total:      584_294 },
    { name: 'Fuel Taxes',                      total:      414_677 },
    { name: 'Tobacco Taxes',                   total:      216_512 },
    { name: 'Insurance Taxes',                 total:       76_874 },
    { name: 'Beverage Taxes',                  total:       75_517 },
    { name: 'Other Taxes',                     total:      343_978 },
    { name: 'Licenses, Permits and Fees',      total:      293_950 },
    { name: 'Interest and Investment Revenue', total:      208_638 },
    { name: 'Federal Grants',                  total:    4_770_328 },
    { name: 'Sales and Services',              total:      170_788 },
    { name: 'Other',                           total:      386_203 },
  ]},
  2007: { total: 14_087_832, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',          total:    2_654_294 },
    { name: 'Sales Tax',                              total:    1_968_931 },
    { name: 'Gross Production Taxes',                 total:      822_888 },
    { name: 'Income Taxes-Corporate',                 total:      772_668 },
    { name: 'Motor Vehicle Taxes',                    total:      609_669 },
    { name: 'GFuroesl sTaPxreosduction Taxes',        total:      401_992 },
    { name: 'Tobacco Taxes',                          total:      220_556 },
    { name: 'GOrtohsesr PerorsdouncatiloTnaTxaexses', total:      191_860 },
    { name: 'Insurance Taxes',                        total:      104_403 },
    { name: 'GBerovsesraPgreodTuacxteiosn Taxes',     total:       79_996 },
    { name: 'Other Taxes',                            total:      147_470 },
    { name: 'Licenses, Permits and Fees',             total:      286_765 },
    { name: 'Interest and Investment Revenue',        total:      328_772 },
    { name: 'Federal Grants',                         total:    5_006_861 },
    { name: 'Sales and Services',                     total:      172_558 },
    { name: 'Other Grants and Reimbursements',        total:      228_283 },
    { name: 'Fines and Penalties',                    total:       43_180 },
    { name: 'Other',                                  total:       46_686 },
  ]},
  2008: { total: 14_924_272, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_753_040 },
    { name: 'Sales Tax',                       total:    2_107_116 },
    { name: 'Gross Production Taxes',          total:    1_114_950 },
    { name: 'Income Taxes-Corporate',          total:      552_193 },
    { name: 'Motor Vehicle Taxes',             total:      604_926 },
    { name: 'Fuel Taxes',                      total:      419_617 },
    { name: 'Tobacco Taxes',                   total:      237_166 },
    { name: 'Other Personal Taxes',            total:       83_142 },
    { name: 'Insurance Taxes',                 total:      100_778 },
    { name: 'Beverage Taxes',                  total:       86_648 },
    { name: 'Other Taxes',                     total:      121_670 },
    { name: 'Licenses, Permits and Fees',      total:      321_037 },
    { name: 'Interest and Investment Revenue', total:      351_176 },
    { name: 'Federal Grants',                  total:    5_503_532 },
    { name: 'Sales and Services',              total:      160_278 },
    { name: 'Other Grants and Reimbursements', total:      341_225 },
    { name: 'Fines and Penalties',             total:       40_181 },
    { name: 'Other',                           total:       25_597 },
  ]},
  2009: { total: 15_336_038, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',          total:    2_537_221 },
    { name: 'Sales Tax',                              total:    2_190_082 },
    { name: 'Gross Production Taxes',                 total:    1_136_279 },
    { name: 'Income Taxes-Corporate',                 total:      345_929 },
    { name: 'Motor Vehicle Taxes',                    total:      585_084 },
    { name: 'GFuroesl sTaPxreosduction Taxes',        total:      397_852 },
    { name: 'Tobacco Taxes',                          total:      254_006 },
    { name: 'Other Business Taxes',                   total:      103_981 },
    { name: 'GOrtohsesr PerorsdouncatiloTnaTxaexses', total:       40_952 },
    { name: 'Insurance Taxes',                        total:      105_076 },
    { name: 'GBerovsesraPgreodTuacxteiosn Taxes',     total:       90_071 },
    { name: 'Other Taxes',                            total:       78_994 },
    { name: 'Licenses, Permits and Fees',             total:      354_533 },
    { name: 'Interest and Investment Revenue',        total:      203_053 },
    { name: 'Federal Grants',                         total:    6_227_575 },
    { name: 'Sales and Services',                     total:      188_706 },
    { name: 'Other Grants and Reimbursements',        total:      330_166 },
    { name: 'Fines and Penalties',                    total:       48_762 },
    { name: 'Other',                                  total:      117_716 },
  ]},
  2010: { total: 15_290_433, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',          total:    1_969_264 },
    { name: 'Sales Tax',                              total:    1_981_220 },
    { name: 'Gross Production Taxes',                 total:      702_949 },
    { name: 'Income Taxes-Corporate',                 total:      171_555 },
    { name: 'Motor Vehicle Taxes',                    total:      551_029 },
    { name: 'GFuroesl sTaPxroedsuction Taxes',        total:      384_383 },
    { name: 'Tobacco Taxes',                          total:      234_540 },
    { name: 'Other Business Taxes',                   total:      167_260 },
    { name: 'GOrtohsesr PerorsdouncatiloTnaTxaexses', total:       20_683 },
    { name: 'Insurance Taxes',                        total:       87_805 },
    { name: 'GBerovsesraPgreodTuacxteiosn Taxes',     total:       83_673 },
    { name: 'Other Taxes',                            total:      163_026 },
    { name: 'Licenses, Permits and Fees',             total:      353_930 },
    { name: 'Interest and Investment Revenue',        total:       75_096 },
    { name: 'Federal Grants',                         total:    7_456_421 },
    { name: 'Sales and Services',                     total:      171_048 },
    { name: 'Other Grants and Reimbursements',        total:      459_236 },
    { name: 'Fines and Penalties',                    total:       46_047 },
    { name: 'Other',                                  total:      211_268 },
  ]},
  2011: { total: 16_256_409, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',          total:    2_393_660 },
    { name: 'Sales Tax',                              total:    2_191_643 },
    { name: 'Gross Production Taxes',                 total:      786_827 },
    { name: 'Income Taxes-Corporate',                 total:      328_007 },
    { name: 'Motor Vehicle Taxes',                    total:      633_107 },
    { name: 'GFuroesl sTaPxroedsuction Taxes',        total:      399_011 },
    { name: 'Tobacco Taxes',                          total:      267_948 },
    { name: 'Other Business Taxes',                   total:      195_919 },
    { name: 'GOrtohsesr PerorsdouncatiloTnaTxaexses', total:        5_661 },
    { name: 'Insurance Taxes',                        total:      113_948 },
    { name: 'GBerovsesraPgreodTuacxteiosn Taxes',     total:       94_352 },
    { name: 'Other Taxes',                            total:      123_347 },
    { name: 'Licenses, Permits and Fees',             total:      400_810 },
    { name: 'Interest and Investment Revenue',        total:      210_510 },
    { name: 'Federal Grants',                         total:    7_499_163 },
    { name: 'Sales and Services',                     total:      153_886 },
    { name: 'Other Grants and Reimbursements',        total:      394_069 },
    { name: 'Fines and Penalties',                    total:       47_484 },
    { name: 'Other',                                  total:       17_057 },
  ]},
  2012: { total: 16_806_165, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_739_864 },
    { name: 'Sales Tax',                       total:    2_400_354 },
    { name: 'Gross Production Taxes',          total:      885_038 },
    { name: 'Income Taxes-Corporate',          total:      413_113 },
    { name: 'Motor Vehicle Taxes',             total:      693_524 },
    { name: 'Fuel Taxes',                      total:      416_940 },
    { name: 'Tobacco Taxes',                   total:      281_754 },
    { name: 'Other Business Taxes',            total:      216_219 },
    { name: 'Other Personal Taxes',            total:        1_815 },
    { name: 'Insurance Taxes',                 total:      124_651 },
    { name: 'Beverage Taxes',                  total:       99_567 },
    { name: 'Other Taxes',                     total:      143_626 },
    { name: 'Licenses, Permits and Fees',      total:      594_889 },
    { name: 'Interest and Investment Revenue', total:      135_336 },
    { name: 'Federal Grants',                  total:    6_934_571 },
    { name: 'Sales and Services',              total:      178_416 },
    { name: 'Other Grants and Reimbursements', total:      484_570 },
    { name: 'Fines and Penalties',             total:       48_046 },
    { name: 'Other',                           total:       13_872 },
  ]},
  2013: { total: 16_731_218, confidence: 'actual', categories: [
    { name: 'T axes Income T axes-Individual',          total:    2_855_509 },
    { name: 'Sales T ax',                               total:    2_523_098 },
    { name: 'Gross Production T axes',                  total:      513_350 },
    { name: 'Income T axes-Corporate',                  total:      595_249 },
    { name: 'Motor Vehicle T axes',                     total:      686_540 },
    { name: 'GFuroelssTParxoedsuction T axes',          total:      408_507 },
    { name: 'T obacco T axes',                          total:      272_123 },
    { name: 'Other Business T axes',                    total:      121_285 },
    { name: 'GOrtohsesrPPreordsuocntaiol nT aTxaexses', total:          136 },
    { name: 'Insurance T axes',                         total:      145_437 },
    { name: 'GBreovsesraPgreodTuacxtieosn T axes',      total:      105_316 },
    { name: 'Other T axes',                             total:      143_938 },
    { name: 'Licenses, Permits and Fees',               total:      624_622 },
    { name: 'Interest and Investment Revenue',          total:      154_477 },
    { name: 'Federal Grants',                           total:    6_647_031 },
    { name: 'Sales and Services',                       total:      163_462 },
    { name: 'Other Grants and Reimbursements',          total:      514_571 },
    { name: 'Fines and Penalties',                      total:       51_290 },
    { name: 'Ot her',                                   total:      205_277 },
  ]},
  2014: { total: 16_866_273, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_855_601 },
    { name: 'Sales Tax',                       total:    2_598_873 },
    { name: 'Gross Production Tax',            total:      657_476 },
    { name: 'Income Taxes-Corporate',          total:      408_665 },
    { name: 'Motor Vehicle Taxes',             total:      778_694 },
    { name: 'Fuel Taxes',                      total:      419_084 },
    { name: 'Tobacco Taxes',                   total:      250_228 },
    { name: 'Other Business Taxes',            total:      199_800 },
    { name: 'Other Personal Taxes',            total:          873 },
    { name: 'Insurance Taxes',                 total:      167_444 },
    { name: 'Beverage Taxes',                  total:      108_830 },
    { name: 'Other Taxes',                     total:      200_580 },
    { name: 'Licenses, Permits and Fees',      total:      669_106 },
    { name: 'Interest and Investment Revenue', total:      174_986 },
    { name: 'Federal Grants',                  total:    6_746_151 },
    { name: 'Sales and Services',              total:      188_029 },
    { name: 'Other Grants and Reimbursements', total:      487_655 },
    { name: 'Fines and Penalties',             total:       53_794 },
    { name: 'Other',                           total:      -99_596 },
  ]},
  2015: { total: 17_121_752, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    3_003_481 },
    { name: 'Sales Tax',                       total:    2_553_855 },
    { name: 'Gross Production Tax',            total:      578_464 },
    { name: 'Income Taxes-Corporate',          total:      357_681 },
    { name: 'Motor Vehicle Taxes',             total:      772_690 },
    { name: 'Fuel Taxes',                      total:      424_560 },
    { name: 'Tobacco Taxes',                   total:      251_786 },
    { name: 'Other Business Taxes',            total:      242_548 },
    { name: 'Other Personal Taxes',            total:        1_057 },
    { name: 'Insurance Taxes',                 total:      183_762 },
    { name: 'Beverage Taxes',                  total:      113_229 },
    { name: 'Other Taxes',                     total:      186_921 },
    { name: 'Licenses, Permits and Fees',      total:      696_003 },
    { name: 'Interest and Investment Revenue', total:      174_272 },
    { name: 'Federal Grants',                  total:    6_652_689 },
    { name: 'Sales and Services',              total:      180_205 },
    { name: 'Other Grants and Reimbursements', total:      448_562 },
    { name: 'Fines and Penalties',             total:       45_034 },
    { name: 'Other',                           total:      254_953 },
  ]},
  2016: { total: 16_621_650, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_932_254 },
    { name: 'Sales Tax',                       total:    2_481_557 },
    { name: 'Gross Production Tax',            total:      319_071 },
    { name: 'Income Taxes-Corporate',          total:      369_559 },
    { name: 'Motor Vehicle Taxes',             total:      762_862 },
    { name: 'Fuel Taxes',                      total:      424_276 },
    { name: 'Tobacco Taxes',                   total:      257_797 },
    { name: 'Other Business Taxes',            total:      224_176 },
    { name: 'Other Personal Taxes',            total:          126 },
    { name: 'Insurance Taxes',                 total:      181_477 },
    { name: 'Beverage Taxes',                  total:      115_463 },
    { name: 'Other Taxes',                     total:      173_398 },
    { name: 'Licenses, Permits and Fees',      total:      681_130 },
    { name: 'Interest and Investment Revenue', total:      150_773 },
    { name: 'Federal Grants',                  total:    6_667_592 },
    { name: 'Sales and Services',              total:      212_228 },
    { name: 'Other Grants and Reimbursements', total:      492_888 },
    { name: 'Fines and Penalties',             total:       53_475 },
    { name: 'Other',                           total:      121_548 },
  ]},
  2017: { total: 16_674_725, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    2_948_868 },
    { name: 'Sales Tax',                       total:    2_460_238 },
    { name: 'Gross Production Tax',            total:      412_898 },
    { name: 'Income Taxes-Corporate',          total:      169_639 },
    { name: 'Motor Vehicle Taxes',             total:      757_223 },
    { name: 'Fuel Taxes',                      total:      432_780 },
    { name: 'Tobacco Taxes',                   total:      254_935 },
    { name: 'Other Business Taxes',            total:      226_209 },
    { name: 'Other Personal Taxes',            total:          177 },
    { name: 'Insurance Taxes',                 total:      164_008 },
    { name: 'Beverage Taxes',                  total:      118_449 },
    { name: 'Other Taxes',                     total:      186_528 },
    { name: 'Licenses, Permits and Fees',      total:      708_917 },
    { name: 'Interest and Investment Revenue', total:      220_987 },
    { name: 'Federal Grants',                  total:    6_695_846 },
    { name: 'Sales and Services',              total:      222_086 },
    { name: 'Other Grants and Reimbursements', total:      498_801 },
    { name: 'Fines and Penalties',             total:       52_431 },
    { name: 'Other',                           total:      143_705 },
  ]},
  2018: { total: 17_469_602, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    3_240_777 },
    { name: 'Sales Tax',                       total:    2_823_427 },
    { name: 'Gross Production Tax',            total:      596_196 },
    { name: 'Income Taxes-Corporate',          total:      251_163 },
    { name: 'Motor Vehicle Taxes',             total:      868_042 },
    { name: 'Fuel Taxes',                      total:      441_978 },
    { name: 'Tobacco Taxes',                   total:      261_234 },
    { name: 'Other Business Taxes',            total:      244_168 },
    { name: 'Other Personal Taxes',            total:            0 },
    { name: 'Insurance Taxes',                 total:      181_614 },
    { name: 'Beverage Taxes',                  total:      122_541 },
    { name: 'Other Taxes',                     total:      200_532 },
    { name: 'Licenses, Permits and Fees',      total:      778_446 },
    { name: 'Interest and Investment Revenue', total:      161_121 },
    { name: 'Federal Grants',                  total:    6_440_084 },
    { name: 'Sales and Services',              total:      217_647 },
    { name: 'Other Grants and Reimbursements', total:      465_775 },
    { name: 'Fines and Penalties',             total:       58_732 },
    { name: 'Other',                           total:      116_125 },
  ]},
  2019: { total: 19_417_878, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes-Individual',   total:    3_469_633 },
    { name: 'Sales Tax',                       total:    3_076_488 },
    { name: 'Gross Production Tax',            total:    1_037_656 },
    { name: 'Income Taxes-Corporate',          total:      312_862 },
    { name: 'Motor Vehicle Taxes',             total:      887_074 },
    { name: 'Fuel Taxes',                      total:      539_150 },
    { name: 'Tobacco Taxes',                   total:      360_886 },
    { name: 'Other Business Taxes',            total:      264_372 },
    { name: 'Insurance Taxes',                 total:      176_198 },
    { name: 'Beverage Taxes',                  total:      139_737 },
    { name: 'Other Taxes',                     total:      188_842 },
    { name: 'Licenses, Permits and Fees',      total:      806_433 },
    { name: 'Interest and Investment Revenue', total:      185_254 },
    { name: 'Federal Grants',                  total:    6_811_030 },
    { name: 'Sales and Services',              total:      236_892 },
    { name: 'Other Grants and Reimbursements', total:      550_333 },
    { name: 'Fines and Penalties',             total:       60_391 },
    { name: 'Other',                           total:      314_647 },
  ]},
  2020: { total: 19_404_585, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes - Individual', total:    3_369_765 },
    { name: 'Sales Tax',                       total:    2_977_345 },
    { name: 'Gross Production Tax',            total:      620_205 },
    { name: 'Income Taxes - Corporate',        total:      221_699 },
    { name: 'Motor Vehicle Taxes',             total:      935_103 },
    { name: 'Fuel Taxes',                      total:      492_155 },
    { name: 'Tobacco Taxes',                   total:      402_268 },
    { name: 'Other Business Taxes',            total:      268_154 },
    { name: 'Insurance Taxes',                 total:      172_060 },
    { name: 'Beverage Taxes',                  total:      137_382 },
    { name: 'Other Taxes',                     total:      177_193 },
    { name: 'Licenses, Permits and Fees',      total:      819_357 },
    { name: 'Interest and Investment Revenue', total:      183_277 },
    { name: 'Federal Revenue',                 total:    7_695_068 },
    { name: 'Sales and Services',              total:      242_319 },
    { name: 'Other Grants and Reimbursements', total:      546_759 },
    { name: 'Fines and Penalties',             total:       55_568 },
    { name: 'Other',                           total:       88_908 },
  ]},
  2021: { total: 23_373_562, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes - Individual', total:    3_573_364 },
    { name: 'Sales Tax',                       total:    3_158_947 },
    { name: 'Gross Production Tax',            total:      864_090 },
    { name: 'Income Taxes - Corporate',        total:      456_186 },
    { name: 'Motor Vehicle Taxes',             total:      889_607 },
    { name: 'Fuel Taxes',                      total:      504_101 },
    { name: 'Tobacco Taxes',                   total:      460_757 },
    { name: 'Other Business Taxes',            total:      321_926 },
    { name: 'Insurance Taxes',                 total:      177_539 },
    { name: 'Beverage Taxes',                  total:      150_000 },
    { name: 'Other Taxes',                     total:      227_157 },
    { name: 'Licenses, Permits and Fees',      total:      852_001 },
    { name: 'Interest and Investment Revenue', total:      177_873 },
    { name: 'Federal Revenue',                 total:   10_586_296 },
    { name: 'Sales and Services',              total:      269_563 },
    { name: 'Other Grants and Reimbursements', total:      364_679 },
    { name: 'Fines and Penalties',             total:       67_905 },
    { name: 'Other',                           total:      271_571 },
  ]},
  2022: { total: 28_615_026, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes - Individual', total:    4_235_500 },
    { name: 'Sales Tax',                       total:    3_550_107 },
    { name: 'Gross Production Tax',            total:    1_736_288 },
    { name: 'Income Taxes - Corporate',        total:      902_865 },
    { name: 'Motor Vehicle Taxes',             total:      968_429 },
    { name: 'Fuel Taxes',                      total:      569_442 },
    { name: 'Tobacco Taxes',                   total:      460_625 },
    { name: 'Other Business Taxes',            total:      370_340 },
    { name: 'Insurance Taxes',                 total:      188_471 },
    { name: 'Beverage Taxes',                  total:      169_935 },
    { name: 'Other Taxes',                     total:      240_725 },
    { name: 'Licenses, Permits and Fees',      total:      978_823 },
    { name: 'Interest and Investment Revenue', total:      137_144 },
    { name: 'Federal Revenue',                 total:   13_282_831 },
    { name: 'Sales and Services',              total:      223_266 },
    { name: 'Other Grants and Reimbursements', total:      333_097 },
    { name: 'Fines and Penalties',             total:       68_045 },
    { name: 'Other',                           total:      199_093 },
  ]},
  2023: { total: 30_542_100, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes - Individual', total:    4_152_409 },
    { name: 'Sales Tax',                       total:    3_751_893 },
    { name: 'Gross Production Tax',            total:    1_539_531 },
    { name: 'Income Taxes - Corporate',        total:      740_097 },
    { name: 'Motor Vehicle Taxes',             total:      957_647 },
    { name: 'Fuel Taxes',                      total:      572_343 },
    { name: 'Tobacco Taxes',                   total:      436_511 },
    { name: 'Other Business Taxes',            total:      376_087 },
    { name: 'Insurance Taxes',                 total:      409_553 },
    { name: 'Beverage Taxes',                  total:      177_729 },
    { name: 'Other Taxes',                     total:      228_555 },
    { name: 'Licenses, Permits and Fees',      total:    1_054_570 },
    { name: 'Interest and Investment Revenue', total:      310_079 },
    { name: 'Federal Revenue',                 total:   14_988_395 },
    { name: 'Sales and Services',              total:      260_923 },
    { name: 'Other Grants and Reimbursements', total:      386_814 },
    { name: 'Fines and Penalties',             total:       95_064 },
    { name: 'Other',                           total:      103_900 },
  ]},
  2024: { total: 30_604_464, confidence: 'actual', categories: [
    { name: 'Taxes Income Taxes - Individual', total:    4_509_563 },
    { name: 'Sales Tax',                       total:    3_777_379 },
    { name: 'Gross Production Tax',            total:    1_077_769 },
    { name: 'Income Taxes - Corporate',        total:      673_750 },
    { name: 'Motor Vehicle Taxes',             total:    1_022_263 },
    { name: 'Fuel Taxes',                      total:      559_341 },
    { name: 'Tobacco Taxes',                   total:      392_409 },
    { name: 'Other Business Taxes',            total:      361_604 },
    { name: 'Insurance Taxes',                 total:      216_002 },
    { name: 'Beverage Taxes',                  total:      188_370 },
    { name: 'Other Taxes',                     total:      248_284 },
    { name: 'Licenses, Permits and Fees',      total:    1_160_142 },
    { name: 'Interest and Investment Revenue', total:      459_743 },
    { name: 'Federal Revenue',                 total:   13_778_064 },
    { name: 'Sales and Services',              total:      292_191 },
    { name: 'Other Grants and Reimbursements', total:    1_151_477 },
    { name: 'Fines and Penalties',             total:       80_567 },
    { name: 'Other',                           total:      655_546 },
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
  return { jsonTree: [{ n: 'Oklahoma General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
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
    const srcPayload = { name: 'Oklahoma General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ok-acfr-gf-revenue', base_url: 'https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024], municipality_id: muniId };
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
