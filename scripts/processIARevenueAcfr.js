#!/usr/bin/env node
/**
 * Iowa General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Iowa Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the IA state node → pure insert keyed (muni,fy,'revenue').
 *   IA state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-38): IA ACFR GF ~2.83x NASBO GF (FY2025 NET REVENUES $24,251,676K vs
 *   FY2024 NASBO $8,560,000K). "Receipts from other entities" ($10,668,647K FY2025, mostly
 *   federal/intergovernmental) is consolidated into the GAAP General Fund column; NASBO's
 *   narrower budgetary GF concept excludes most of it. Accepted-and-relabelled honestly (TX/AR precedent).
 *
 * NET-REVENUES TIE (the IA trap, ACFR-38): IA's printed statement does NOT have a literal
 *   "Total revenues" line -- it prints GROSS REVENUES (sum of Taxes, Receipts from other
 *   entities, Investment income, Fees/licenses/permits, Refunds & reimbursements, Sales/rents/
 *   services, Miscellaneous[, Contributions in some years]), then a "Less revenue refunds"
 *   contra line, then NET REVENUES. The stored revenue tree total is NET REVENUES (gross minus
 *   the contra), NOT gross -- ia_extract.py (a dedicated IA post-processor over the shared
 *   extract_gf.py line-parser) pops the GROSS REVENUES/Less revenue refunds/NET REVENUES triple
 *   back out of the generic extractor's item list (extract_gf.py has no "Total revenues"
 *   literal to anchor on for IA, so all three would otherwise land as ordinary mislabeled
 *   revenue items) and stores "Revenue refunds" as a NEGATIVE category -- same P2-clamp
 *   mechanism as CO's TABOR Excess Revenue line -- so category-sum-vs-total ties exactly to
 *   NET REVENUES at every loaded year (verified: FY2025 24,251,676 = FY2002 9,752,220 = bookends).
 *
 * DUAL EXPENDITURE-SUBSECTION (LA precedent, IA's own instance): several early years (FY2004
 *   confirmed) repeat the SAME function-name lineup under TWO expenditure subsections --
 *   "Current:" (operating spend) and "Capital Outlay:" (capital spend, by function) -- a real
 *   GAAP distinction. gen_state.py's default_exp_name() now appends " — Capital Outlay" to the
 *   second occurrence (same mechanism as LA's " — Intergovernmental" fix) so the tree never
 *   shows two identically-named leaves. FY2002/2003/2005-2025 either have no GF dollars in the
 *   Capital Outlay: subsection (all "-") or no separate subsection at all -- no collision.
 *
 * FY2003 WRAP DEFECT (one-off, hand-patched in ia_all.json, KY/UT precedent): `pdftotext -table`
 *   split the "Agriculture & Natural Resources" (Current) row so its GENERAL FUND value
 *   (139,493) landed alone on the PRECEDING physical line with no label, while the label line
 *   itself only carried the later Nonmajor/Total columns (6,318 / 149,625) -- the opposite
 *   direction from KY's pending-label-prefix wrap. ia_extract.py filters the resulting phantom
 *   numeric-only "label" row generically; the true GF value (139,493) was hand-patched directly
 *   into ia_all.json with the printed-row evidence above. Confirmed: Current-subsection sum
 *   with the corrected value ties FY2003's printed TOTAL EXPENDITURES $10,004,502K exactly ($0
 *   diff); every other loaded year tied on the first extraction pass.
 *
 * HONEST HOLE (FY2008): the FY2008 ACFR PDF (184 pages, RC4-encrypted print:yes/copy:no) is
 *   text-bearing (pdftoppm renders real vector financial-statement text, confirmed visually on
 *   the budgetary-comparison page) but BOTH pdftotext (-table and plain) and pypdf's decrypt+
 *   extract_text() return zero characters for every page beyond the first, and pdffonts finds
 *   no font resources at all past the front matter -- a genuine, documented extraction failure
 *   (KY FY2023 no-ToUnicode-CMap precedent), not a scanned-image case. No OCR/qpdf/mutool/
 *   ghostscript tooling was available in this environment as a fallback. FY2008 is OMITTED;
 *   FY2007 and FY2009 bracket the gap. Durable clean window = FY2002-FY2007 + FY2009-FY2025
 *   (23 of the target 24 years).
 *
 * OPAQUE IDS: das.iowa.gov/acfr-archive lists FY1997-2024 as ePrints numeric IDs (grid table,
 *   cell-scoped href+alt-text pairing, NOT a simple nearest-preceding-href heuristic -- some
 *   IDs are non-monotonic re-publish artifacts, e.g. FY2007's id 41338 is NEWER than FY2008's
 *   10538); FY2025 lives on the das.iowa.gov landing page instead (id 54805). Each landing id's
 *   actual PDF href (id/1/ or id/2/<filename>) was resolved by fetching that id's own landing
 *   page -- never guessed from the FY. FY2025 file is owner-password-encrypted ("Protected" in
 *   the filename); pdftotext -table extracts it cleanly regardless (confirmed, DE FY-Referer-
 *   style precedent: encryption alone doesn't block extraction, unlike FY2008's defect above).
 *
 * REVENUE LABEL NOTE: IA's revenue lines have no sub-heading at all (sub=None throughout every
 *   loaded year) -- no rev_boundary config needed; default_rev_name() only suffixes " taxes"
 *   when sub.lower()=='taxes', which never fires here.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment income" (renamed "Investment income (loss)" in loss years) went NEGATIVE in FY2022 only: -65,193K (thousands) -- a real GAAP fair-value-of-investments loss, not an extraction artifact. Every other loaded year is positive (FY2025 +485,838K / FY2002 +80,099K, the recon-confirmed bookends). The P2 clamp is the render path for FY2022; no year shows a negative NET REVENUES total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ia/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processIARevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Iowa'; const STATE_ABBR = 'IA'; const POPULATION = 3_190_369;
const EXPECTED_MUNI_ID = '6e71a93f-a43d-4972-a239-85ddbebe2545';
const UNITS = 1_000; // IA ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://publications.iowa.gov/5514/2/FY02_CAFR.pdf', date: '2002-06-30' },
  2003: { url: 'https://publications.iowa.gov/5515/1/2003CAFR.pdf', date: '2003-06-30' },
  2004: { url: 'https://publications.iowa.gov/5516/1/2004CAFR.pdf', date: '2004-06-30' },
  2005: { url: 'https://publications.iowa.gov/5517/1/2005CAFR.pdf', date: '2005-06-30' },
  2006: { url: 'https://publications.iowa.gov/5504/1/final_2006_cafr.pdf', date: '2006-06-30' },
  2007: { url: 'https://publications.iowa.gov/41338/1/fy07_cafr.pdf', date: '2007-06-30' },
  2009: { url: 'https://publications.iowa.gov/10536/1/FY09_cafr.pdf', date: '2009-06-30' },
  2010: { url: 'https://publications.iowa.gov/10537/1/10_cafr.pdf', date: '2010-06-30' },
  2011: { url: 'https://publications.iowa.gov/18388/1/2011_cafr.pdf', date: '2011-06-30' },
  2012: { url: 'https://publications.iowa.gov/18389/1/2012_cafr.pdf', date: '2012-06-30' },
  2013: { url: 'https://publications.iowa.gov/18391/1/2013_cafr.pdf', date: '2013-06-30' },
  2014: { url: 'https://publications.iowa.gov/18387/1/14_cafr.pdf', date: '2014-06-30' },
  2015: { url: 'https://publications.iowa.gov/30562/1/fy15_cafr.pdf', date: '2015-06-30' },
  2016: { url: 'https://publications.iowa.gov/30563/1/fy16_cafr.pdf', date: '2016-06-30' },
  2017: { url: 'https://publications.iowa.gov/30564/1/fy17_cafr.pdf', date: '2017-06-30' },
  2018: { url: 'https://publications.iowa.gov/30565/1/fy18_cafr.pdf', date: '2018-06-30' },
  2019: { url: 'https://publications.iowa.gov/38479/1/fy19_cafr.pdf', date: '2019-06-30' },
  2020: { url: 'https://publications.iowa.gov/38480/1/fy20_cafr.pdf', date: '2020-06-30' },
  2021: { url: 'https://publications.iowa.gov/41337/1/fy21_acfr.pdf', date: '2021-06-30' },
  2022: { url: 'https://publications.iowa.gov/45680/1/FY2022_ACFR.pdf', date: '2022-06-30' },
  2023: { url: 'https://publications.iowa.gov/47299/1/ACFR%20FY2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://publications.iowa.gov/51393/1/FY2024%20ACFR.pdf', date: '2024-06-30' },
  2025: { url: 'https://publications.iowa.gov/54805/1/ACFR%20FY2025%20-%20Protected%2012.22.2025.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Iowa State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — IA ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 9_752_220, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    5_567_742 },
    { name: 'Receipts from Other Entities', total:    3_228_777 },
    { name: 'Investment Income',            total:       80_099 },
    { name: 'Fees, Licenses & Permits',     total:      550_649 },
    { name: 'Refunds & Reimbursements',     total:      913_185 },
    { name: 'Sales, Rents & Services',      total:       21_300 },
    { name: 'Miscellaneous',                total:      132_622 },
    { name: 'Revenue refunds',              total:     -742_154 },
  ]},
  2003: { total: 9_739_805, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    5_550_582 },
    { name: 'Receipts from Other Entities', total:    3_393_268 },
    { name: 'Investment Income',            total:       38_599 },
    { name: 'Fees, Licenses & Permits',     total:      572_132 },
    { name: 'Refunds & Reimbursements',     total:      740_481 },
    { name: 'Sales, Rents & Services',      total:       18_470 },
    { name: 'Miscellaneous',                total:      149_365 },
    { name: 'Revenue refunds',              total:     -723_092 },
  ]},
  2004: { total: 9_819_365, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    5_870_686 },
    { name: 'Receipts from Other Entities', total:    3_513_397 },
    { name: 'Investment Income',            total:       46_728 },
    { name: 'Fees, Licenses & Permits',     total:      610_929 },
    { name: 'Refunds & Reimbursements',     total:      358_855 },
    { name: 'Sales, Rents & Services',      total:       25_483 },
    { name: 'Miscellaneous',                total:      184_960 },
    { name: 'Revenue refunds',              total:     -791_673 },
  ]},
  2005: { total: 10_185_629, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    6_216_356 },
    { name: 'Receipts from Other Entities', total:    3_554_749 },
    { name: 'Investment Income',            total:       56_503 },
    { name: 'Fees, Licenses & Permits',     total:      634_058 },
    { name: 'Refunds & Reimbursements',     total:      276_774 },
    { name: 'Sales, Rents & Services',      total:       24_447 },
    { name: 'Miscellaneous',                total:      198_133 },
    { name: 'Revenue refunds',              total:     -775_391 },
  ]},
  2006: { total: 10_938_743, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    6_422_323 },
    { name: 'Receipts from Other Entities', total:    3_938_003 },
    { name: 'Investment Income',            total:       76_214 },
    { name: 'Fees, Licenses & Permits',     total:      646_609 },
    { name: 'Refunds & Reimbursements',     total:      396_950 },
    { name: 'Sales, Rents & Services',      total:       23_189 },
    { name: 'Miscellaneous',                total:      110_484 },
    { name: 'Revenue refunds',              total:     -675_029 },
  ]},
  2007: { total: 10_872_388, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    6_798_117 },
    { name: 'Receipts from Other Entities', total:    3_490_800 },
    { name: 'Investment Income',            total:      120_475 },
    { name: 'Fees, Licenses & Permits',     total:      676_432 },
    { name: 'Refunds & Reimbursements',     total:      334_508 },
    { name: 'Sales, Rents & Services',      total:       23_535 },
    { name: 'Miscellaneous',                total:      111_415 },
    { name: 'Revenue refunds',              total:     -682_894 },
  ]},
  2009: { total: 13_019_055, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    7_333_205 },
    { name: 'Receipts from other entities', total:    5_058_198 },
    { name: 'Investment income',            total:       60_436 },
    { name: 'Fees, licenses & permits',     total:      974_830 },
    { name: 'Refunds & reimbursements',     total:      361_854 },
    { name: 'Sales, rents & services',      total:       25_323 },
    { name: 'Miscellaneous',                total:       85_846 },
    { name: 'Revenue refunds',              total:     -880_637 },
  ]},
  2010: { total: 13_723_441, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    7_089_985 },
    { name: 'Receipts from other entities', total:    6_002_491 },
    { name: 'Investment income',            total:       19_740 },
    { name: 'Fees, licenses & permits',     total:    1_064_768 },
    { name: 'Refunds & reimbursements',     total:      350_956 },
    { name: 'Sales, rents & services',      total:       30_551 },
    { name: 'Miscellaneous',                total:      107_391 },
    { name: 'Revenue refunds',              total:     -942_441 },
  ]},
  2011: { total: 14_390_230, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    7_488_602 },
    { name: 'Receipts from other entities', total:    6_042_458 },
    { name: 'Investment income',            total:       23_488 },
    { name: 'Fees, licenses & permits',     total:    1_156_930 },
    { name: 'Refunds & reimbursements',     total:      432_486 },
    { name: 'Sales, rents & services',      total:       27_370 },
    { name: 'Miscellaneous',                total:      132_712 },
    { name: 'Revenue refunds',              total:     -913_816 },
  ]},
  2012: { total: 14_440_976, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    7_985_697 },
    { name: 'Receipts from other entities', total:    5_574_095 },
    { name: 'Investment income',            total:       18_384 },
    { name: 'Fees, licenses & permits',     total:    1_188_027 },
    { name: 'Refunds & reimbursements',     total:      433_870 },
    { name: 'Sales, rents & services',      total:       29_541 },
    { name: 'Miscellaneous',                total:      125_614 },
    { name: 'Revenue refunds',              total:     -914_252 },
  ]},
  2013: { total: 14_773_573, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    8_456_345 },
    { name: 'Receipts from other entities', total:    5_378_462 },
    { name: 'Investment income',            total:        1_588 },
    { name: 'Fees, licenses & permits',     total:    1_231_785 },
    { name: 'Refunds & reimbursements',     total:      448_836 },
    { name: 'Sales, rents & services',      total:       29_067 },
    { name: 'Miscellaneous',                total:      134_704 },
    { name: 'Revenue refunds',              total:     -907_214 },
  ]},
  2014: { total: 14_996_066, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    8_414_849 },
    { name: 'Receipts from other entities', total:    5_646_191 },
    { name: 'Investment income',            total:       15_932 },
    { name: 'Fees, licenses & permits',     total:    1_286_594 },
    { name: 'Refunds & reimbursements',     total:      495_722 },
    { name: 'Sales, rents & services',      total:       32_180 },
    { name: 'Miscellaneous',                total:      142_512 },
    { name: 'Revenue refunds',              total:   -1_037_914 },
  ]},
  2015: { total: 15_851_942, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    8_917_337 },
    { name: 'Receipts from other entities', total:    5_930_405 },
    { name: 'Investment income',            total:       16_102 },
    { name: 'Fees, licenses & permits',     total:    1_321_520 },
    { name: 'Refunds & reimbursements',     total:      533_630 },
    { name: 'Sales, rents & services',      total:       35_242 },
    { name: 'Miscellaneous',                total:      161_828 },
    { name: 'Revenue refunds',              total:   -1_064_122 },
  ]},
  2016: { total: 16_400_906, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    9_263_248 },
    { name: 'Receipts from other entities', total:    6_054_948 },
    { name: 'Investment income',            total:       19_145 },
    { name: 'Fees, licenses & permits',     total:    1_353_336 },
    { name: 'Refunds & reimbursements',     total:      638_862 },
    { name: 'Sales, rents & services',      total:       34_652 },
    { name: 'Miscellaneous',                total:      189_684 },
    { name: 'Revenue refunds',              total:   -1_152_969 },
  ]},
  2017: { total: 16_636_399, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    9_503_731 },
    { name: 'Receipts from other entities', total:    5_962_628 },
    { name: 'Investment income',            total:       10_834 },
    { name: 'Fees, licenses & permits',     total:    1_369_619 },
    { name: 'Refunds & reimbursements',     total:      778_287 },
    { name: 'Sales, rents & services',      total:       36_458 },
    { name: 'Miscellaneous',                total:      187_076 },
    { name: 'Revenue refunds',              total:   -1_212_234 },
  ]},
  2018: { total: 16_944_158, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:    9_846_473 },
    { name: 'Receipts from other entities', total:    5_972_551 },
    { name: 'Investment income',            total:       24_581 },
    { name: 'Fees, licenses & permits',     total:    1_400_242 },
    { name: 'Refunds & reimbursements',     total:      748_789 },
    { name: 'Sales, rents & services',      total:       31_469 },
    { name: 'Miscellaneous',                total:      186_499 },
    { name: 'Revenue refunds',              total:   -1_266_446 },
  ]},
  2019: { total: 17_855_287, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   10_307_880 },
    { name: 'Receipts from other entities', total:    6_287_531 },
    { name: 'Investment income',            total:       69_312 },
    { name: 'Fees, licenses & permits',     total:    1_441_842 },
    { name: 'Refunds & reimbursements',     total:      742_811 },
    { name: 'Sales, rents & services',      total:       38_433 },
    { name: 'Miscellaneous',                total:      223_069 },
    { name: 'Revenue refunds',              total:   -1_255_591 },
  ]},
  2020: { total: 19_230_313, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   10_380_464 },
    { name: 'Receipts from other entities', total:    8_238_563 },
    { name: 'Investment income',            total:       51_647 },
    { name: 'Fees, licenses & permits',     total:    1_428_566 },
    { name: 'Refunds & reimbursements',     total:      870_066 },
    { name: 'Sales, rents & services',      total:       31_193 },
    { name: 'Miscellaneous',                total:      227_299 },
    { name: 'Revenue refunds',              total:   -1_997_485 },
  ]},
  2021: { total: 21_711_615, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   11_314_249 },
    { name: 'Receipts from other entities', total:    9_849_820 },
    { name: 'Investment income',            total:        3_441 },
    { name: 'Fees, licenses & permits',     total:    1_587_065 },
    { name: 'Refunds & reimbursements',     total:      723_627 },
    { name: 'Sales, rents & services',      total:       29_543 },
    { name: 'Miscellaneous',                total:      272_318 },
    { name: 'Revenue refunds',              total:   -2_068_448 },
  ]},
  2022: { total: 23_855_338, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   12_325_647 },
    { name: 'Receipts from other entities', total:   10_794_603 },
    { name: 'Investment income (loss)',     total:      -65_193 },
    { name: 'Fees, licenses & permits',     total:    1_626_228 },
    { name: 'Refunds & reimbursements',     total:      826_298 },
    { name: 'Sales, rents & services',      total:       29_498 },
    { name: 'Miscellaneous',                total:      261_548 },
    { name: 'Revenue refunds',              total:   -1_943_291 },
  ]},
  2023: { total: 23_366_953, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   12_576_527 },
    { name: 'Receipts from other entities', total:    9_672_162 },
    { name: 'Investment income',            total:      225_554 },
    { name: 'Fees, licenses & permits',     total:    1_663_898 },
    { name: 'Refunds & reimbursements',     total:      990_403 },
    { name: 'Sales, rents & services',      total:       36_633 },
    { name: 'Miscellaneous',                total:      381_113 },
    { name: 'Revenue refunds',              total:   -2_179_337 },
  ]},
  2024: { total: 24_463_693, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   12_623_228 },
    { name: 'Receipts from other entities', total:   10_404_561 },
    { name: 'Investment income',            total:      535_775 },
    { name: 'Fees, licenses & permits',     total:    1_678_882 },
    { name: 'Refunds & reimbursements',     total:      937_978 },
    { name: 'Sales, rents & services',      total:       40_362 },
    { name: 'Miscellaneous',                total:      741_770 },
    { name: 'Revenue refunds',              total:   -2_498_863 },
  ]},
  2025: { total: 24_251_676, confidence: 'actual', categories: [
    { name: 'Taxes',                        total:   11_938_586 },
    { name: 'Receipts from other entities', total:   10_668_647 },
    { name: 'Investment income',            total:      485_838 },
    { name: 'Fees, licenses & permits',     total:    1_723_499 },
    { name: 'Refunds & reimbursements',     total:      924_381 },
    { name: 'Sales, rents & services',      total:       33_129 },
    { name: 'Miscellaneous',                total:      874_870 },
    { name: 'Revenue refunds',              total:   -2_397_274 },
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
  return { jsonTree: [{ n: 'Iowa General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Iowa General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ia-acfr-gf-revenue', base_url: 'https://das.iowa.gov/state-employees/state-accounting/state-financial-reports', fiscal_years: [2002,2003,2004,2005,2006,2007,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
