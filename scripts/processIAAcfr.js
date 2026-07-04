#!/usr/bin/env node
/**
 * Iowa General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Iowa Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the IA state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ia/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processIAAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Iowa State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — IA ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 9_968_538, confidence: 'actual', categories: [
    { name: 'Administration & Regulation',     total:    1_113_069 },
    { name: 'Education',                       total:    2_521_252 },
    { name: 'State Aid to Universities',       total:      646_233 },
    { name: 'Health & Human Rights',           total:      281_549 },
    { name: 'Human Services',                  total:    3_438_282 },
    { name: 'Justice & Public Defense',        total:      615_631 },
    { name: 'Economic Development',            total:      177_294 },
    { name: 'Transportation',                  total:    1_012_308 },
    { name: 'Agriculture & Natural Resources', total:      162_920 },
  ]},
  2003: { total: 10_004_502, confidence: 'actual', categories: [
    { name: 'Administration & Regulation',     total:    1_167_352 },
    { name: 'Education',                       total:    2_587_865 },
    { name: 'State Aid To Universities',       total:      610_338 },
    { name: 'Health & Human Rights',           total:      299_855 },
    { name: 'Human Services',                  total:    3_377_423 },
    { name: 'Justice & Public Defense',        total:      616_464 },
    { name: 'Economic Development',            total:      183_889 },
    { name: 'Transportation',                  total:    1_021_823 },
    { name: 'Agriculture & Natural Resources', total:      139_493 },
  ]},
  2004: { total: 9_825_703, confidence: 'actual', categories: [
    { name: 'Administration & Regulation',                      total:      917_077 },
    { name: 'Education',                                        total:    2_608_383 },
    { name: 'State Aid To Universities',                        total:      592_617 },
    { name: 'Health & Human Rights',                            total:      311_305 },
    { name: 'Human Services',                                   total:    3_417_274 },
    { name: 'Justice & Public Defense',                         total:      613_856 },
    { name: 'Economic Development',                             total:      195_699 },
    { name: 'Transportation',                                   total:      346_948 },
    { name: 'Agriculture & Natural Resources',                  total:      134_074 },
    { name: 'Administration & Regulation — Capital Outlay',     total:       11_187 },
    { name: 'Education — Capital Outlay',                       total:        3_058 },
    { name: 'Health & Human Rights — Capital Outlay',           total:        3_806 },
    { name: 'Human Services — Capital Outlay',                  total:        6_120 },
    { name: 'Justice & Public Defense — Capital Outlay',        total:       29_640 },
    { name: 'Economic Development — Capital Outlay',            total:        3_815 },
    { name: 'Transportation — Capital Outlay',                  total:      617_023 },
    { name: 'Agriculture & Natural Resources — Capital Outlay', total:       13_821 },
  ]},
  2005: { total: 9_741_692, confidence: 'actual', categories: [
    { name: 'Administration & Regulation',                   total:      858_444 },
    { name: 'Education',                                     total:    2_743_731 },
    { name: 'Health & Human Rights',                         total:      332_329 },
    { name: 'Human Services',                                total:    3_622_747 },
    { name: 'Justice & Public Defense',                      total:      650_354 },
    { name: 'Economic Development',                          total:      203_039 },
    { name: 'Transportation',                                total:      379_960 },
    { name: 'Agriculture & Natural Resources',               total:      142_352 },
    { name: 'Capital Outlay',                                total:      775_979 },
    { name: 'Debt service — Bond Principal Retirement',      total:       19_061 },
    { name: 'Debt service — Bond Interest & Fiscal Charges', total:       13_696 },
  ]},
  2006: { total: 10_367_339, confidence: 'actual', categories: [
    { name: 'Administration & Regulation',                   total:      895_177 },
    { name: 'Education',                                     total:    2_887_691 },
    { name: 'Health & Human Rights',                         total:      359_688 },
    { name: 'Human Services',                                total:    3_919_330 },
    { name: 'Justice & Public Defense',                      total:      695_188 },
    { name: 'Economic Development',                          total:      209_665 },
    { name: 'Transportation',                                total:      382_175 },
    { name: 'Agriculture & Natural Resources',               total:      151_237 },
    { name: 'Capital Outlay',                                total:      838_313 },
    { name: 'Debt service — Bond Principal Retirement',      total:       15_995 },
    { name: 'Debt service — Bond Interest & Fiscal Charges', total:       12_880 },
  ]},
  2007: { total: 10_463_448, confidence: 'actual', categories: [
    { name: 'Administration & Regulation',                   total:      859_153 },
    { name: 'Education',                                     total:    3_011_966 },
    { name: 'Health & Human Rights',                         total:      357_023 },
    { name: 'Human Services',                                total:    3_864_422 },
    { name: 'Justice & Public Defense',                      total:      765_972 },
    { name: 'Economic Development',                          total:      220_032 },
    { name: 'Transportation',                                total:      457_439 },
    { name: 'Agriculture & Natural Resources',               total:      162_319 },
    { name: 'Capital Outlay',                                total:      736_939 },
    { name: 'Debt service — Bond Principal Retirement',      total:       16_070 },
    { name: 'Debt service — Bond Interest & Fiscal Charges', total:       12_113 },
  ]},
  2009: { total: 12_847_469, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_241_175 },
    { name: 'Education',                                total:    3_402_603 },
    { name: 'Health & human rights',                    total:      429_645 },
    { name: 'Human services',                           total:    4_625_918 },
    { name: 'Justice & public defense',                 total:    1_141_012 },
    { name: 'Economic development',                     total:      333_417 },
    { name: 'Transportation',                           total:      471_016 },
    { name: 'Agriculture & natural resources',          total:      188_779 },
    { name: 'Capital outlay',                           total:      994_557 },
    { name: 'Debt service — Principal',                 total:        9_920 },
    { name: 'Debt service — Interest & fiscal charges', total:        9_427 },
  ]},
  2010: { total: 13_302_322, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_268_344 },
    { name: 'Education',                                total:    3_341_173 },
    { name: 'Health & human rights',                    total:      464_812 },
    { name: 'Human services',                           total:    4_897_619 },
    { name: 'Justice & public defense',                 total:    1_106_023 },
    { name: 'Economic development',                     total:      343_680 },
    { name: 'Transportation',                           total:      547_577 },
    { name: 'Agriculture & natural resources',          total:      180_580 },
    { name: 'Capital outlay',                           total:    1_104_086 },
    { name: 'Debt service — Principal',                 total:       10_440 },
    { name: 'Debt service — Interest & fiscal charges', total:       37_988 },
  ]},
  2011: { total: 13_866_211, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_383_762 },
    { name: 'Education',                                total:    3_506_955 },
    { name: 'Health & human rights',                    total:      450_345 },
    { name: 'Human services',                           total:    5_171_920 },
    { name: 'Justice & public defense',                 total:    1_063_509 },
    { name: 'Economic development',                     total:      575_013 },
    { name: 'Transportation',                           total:      541_526 },
    { name: 'Agriculture & natural resources',          total:      191_168 },
    { name: 'Capital outlay',                           total:      903_925 },
    { name: 'Debt service — Principal',                 total:       24_970 },
    { name: 'Debt service — Interest & fiscal charges', total:       53_118 },
  ]},
  2012: { total: 13_903_599, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_389_837 },
    { name: 'Education',                                total:    3_460_573 },
    { name: 'Health & human rights',                    total:      416_570 },
    { name: 'Human services',                           total:    5_460_995 },
    { name: 'Justice & public defense',                 total:    1_026_280 },
    { name: 'Economic development',                     total:      255_299 },
    { name: 'Transportation',                           total:      548_277 },
    { name: 'Agriculture & natural resources',          total:      191_697 },
    { name: 'Capital outlay',                           total:    1_043_125 },
    { name: 'Debt service — Principal',                 total:       55_700 },
    { name: 'Debt service — Interest & fiscal charges', total:       55_246 },
  ]},
  2013: { total: 13_854_019, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_350_606 },
    { name: 'Education',                                total:    3_541_952 },
    { name: 'Health & human rights',                    total:      414_546 },
    { name: 'Human services',                           total:    5_540_803 },
    { name: 'Justice & public defense',                 total:    1_034_932 },
    { name: 'Economic development',                     total:      184_877 },
    { name: 'Transportation',                           total:      551_879 },
    { name: 'Agriculture & natural resources',          total:      188_993 },
    { name: 'Capital outlay',                           total:      959_993 },
    { name: 'Debt service — Principal',                 total:       32_270 },
    { name: 'Debt service — Interest & fiscal charges', total:       53_168 },
  ]},
  2014: { total: 14_686_043, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_405_681 },
    { name: 'Education',                                total:    3_717_328 },
    { name: 'Health & human rights',                    total:      418_403 },
    { name: 'Human services',                           total:    5_783_104 },
    { name: 'Justice & public defense',                 total:    1_198_802 },
    { name: 'Economic development',                     total:      159_626 },
    { name: 'Transportation',                           total:      580_704 },
    { name: 'Agriculture & natural resources',          total:      194_004 },
    { name: 'Capital outlay',                           total:    1_084_275 },
    { name: 'Payment to escrow agent',                  total:       38_099 },
    { name: 'Debt service — Principal',                 total:       52_850 },
    { name: 'Debt service — Interest & fiscal charges', total:       53_167 },
  ]},
  2015: { total: 15_807_540, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_580_146 },
    { name: 'Education',                                total:    3_893_529 },
    { name: 'Health & human rights',                    total:      420_350 },
    { name: 'Human services',                           total:    6_454_748 },
    { name: 'Justice & public defense',                 total:    1_172_132 },
    { name: 'Economic development',                     total:      158_282 },
    { name: 'Transportation',                           total:      645_859 },
    { name: 'Agriculture & natural resources',          total:      199_576 },
    { name: 'Capital outlay',                           total:    1_200_013 },
    { name: 'Debt service — Principal',                 total:       33_890 },
    { name: 'Debt service — Interest & fiscal charges', total:       49_015 },
  ]},
  2016: { total: 16_194_808, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_770_460 },
    { name: 'Education',                                total:    3_985_465 },
    { name: 'Health & human rights',                    total:      430_989 },
    { name: 'Human services',                           total:    6_720_208 },
    { name: 'Justice & public defense',                 total:    1_053_781 },
    { name: 'Economic development',                     total:      145_436 },
    { name: 'Transportation',                           total:      610_854 },
    { name: 'Agriculture & natural resources',          total:      200_162 },
    { name: 'Capital outlay',                           total:    1_191_480 },
    { name: 'Debt service — Principal',                 total:       38_635 },
    { name: 'Debt service — Interest & fiscal charges', total:       47_338 },
  ]},
  2017: { total: 16_311_631, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_804_451 },
    { name: 'Education',                                total:    4_134_125 },
    { name: 'Health & human rights',                    total:      437_339 },
    { name: 'Human services',                           total:    6_601_012 },
    { name: 'Justice & public defense',                 total:      985_869 },
    { name: 'Economic development',                     total:      156_032 },
    { name: 'Transportation',                           total:      626_525 },
    { name: 'Agriculture & natural resources',          total:      205_803 },
    { name: 'Capital outlay',                           total:    1_271_853 },
    { name: 'Payment to escrow agent',                  total:        3_246 },
    { name: 'Debt service — Principal',                 total:       44_360 },
    { name: 'Debt service — Interest & fiscal charges', total:       41_016 },
  ]},
  2018: { total: 16_536_924, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_820_603 },
    { name: 'Education',                                total:    4_154_800 },
    { name: 'Health & human rights',                    total:      424_043 },
    { name: 'Human services',                           total:    6_758_942 },
    { name: 'Justice & public defense',                 total:      946_870 },
    { name: 'Economic development',                     total:      136_717 },
    { name: 'Transportation',                           total:      673_603 },
    { name: 'Agriculture & natural resources',          total:      197_349 },
    { name: 'Capital outlay',                           total:    1_338_132 },
    { name: 'Debt service — Principal',                 total:       44_005 },
    { name: 'Debt service — Interest & fiscal charges', total:       41_860 },
  ]},
  2019: { total: 17_111_166, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_854_503 },
    { name: 'Education',                                total:    4_218_911 },
    { name: 'Health & human rights',                    total:      426_133 },
    { name: 'Human services',                           total:    7_099_684 },
    { name: 'Justice & public defense',                 total:      946_533 },
    { name: 'Economic development',                     total:      131_231 },
    { name: 'Transportation',                           total:      680_359 },
    { name: 'Agriculture & natural resources',          total:      188_583 },
    { name: 'Capital outlay',                           total:    1_257_987 },
    { name: 'Debt service — Principal',                 total:      267_120 },
    { name: 'Debt service — Interest & fiscal charges', total:       40_122 },
  ]},
  2020: { total: 17_998_468, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    2_013_888 },
    { name: 'Education',                                total:    4_392_802 },
    { name: 'Health & human rights',                    total:      443_199 },
    { name: 'Human services',                           total:    7_660_486 },
    { name: 'Justice & public defense',                 total:    1_072_080 },
    { name: 'Economic development',                     total:      140_168 },
    { name: 'Transportation',                           total:      642_760 },
    { name: 'Agriculture & natural resources',          total:      203_130 },
    { name: 'Capital outlay',                           total:    1_344_400 },
    { name: 'Debt service — Principal',                 total:       56_010 },
    { name: 'Debt service — Interest & fiscal charges', total:       29_545 },
  ]},
  2021: { total: 19_992_644, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    2_461_615 },
    { name: 'Education',                                total:    4_815_441 },
    { name: 'Health & human rights',                    total:      552_064 },
    { name: 'Human services',                           total:    8_495_835 },
    { name: 'Justice & public defense',                 total:    1_171_264 },
    { name: 'Economic development',                     total:      169_241 },
    { name: 'Transportation',                           total:      605_948 },
    { name: 'Agriculture & natural resources',          total:      226_838 },
    { name: 'Capital outlay',                           total:    1_419_721 },
    { name: 'Debt service — Principal',                 total:       48_800 },
    { name: 'Debt service — Interest & fiscal charges', total:       25_877 },
  ]},
  2022: { total: 21_459_336, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    2_556_941 },
    { name: 'Education',                                total:    5_129_496 },
    { name: 'Health & human rights',                    total:      634_294 },
    { name: 'Human services',                           total:    9_481_954 },
    { name: 'Justice & public defense',                 total:    1_234_418 },
    { name: 'Economic development',                     total:      183_270 },
    { name: 'Transportation',                           total:      565_618 },
    { name: 'Agriculture & natural resources',          total:      216_394 },
    { name: 'Capital outlay',                           total:    1_387_006 },
    { name: 'Debt service — Principal',                 total:       45_871 },
    { name: 'Debt service — Interest & fiscal charges', total:       24_074 },
  ]},
  2023: { total: 21_215_674, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_748_876 },
    { name: 'Education',                                total:    5_153_015 },
    { name: 'Health & human rights',                    total:      645_836 },
    { name: 'Human services',                           total:    9_772_616 },
    { name: 'Justice & public defense',                 total:    1_121_201 },
    { name: 'Economic development',                     total:      200_585 },
    { name: 'Transportation',                           total:      558_767 },
    { name: 'Agriculture & natural resources',          total:      231_938 },
    { name: 'Capital outlay',                           total:    1_682_278 },
    { name: 'Debt service — Principal',                 total:       75_909 },
    { name: 'Debt service — Interest & fiscal charges', total:       24_653 },
  ]},
  2024: { total: 22_795_198, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_651_496 },
    { name: 'Education',                                total:    5_132_184 },
    { name: 'Health & human services',                  total:   11_737_833 },
    { name: 'Justice & public defense',                 total:    1_249_489 },
    { name: 'Economic development',                     total:      264_309 },
    { name: 'Transportation',                           total:      643_418 },
    { name: 'Agriculture & natural resources',          total:      251_675 },
    { name: 'Capital outlay',                           total:    1_772_369 },
    { name: 'Debt service — Principal',                 total:       70_473 },
    { name: 'Debt service — Interest & fiscal charges', total:       21_952 },
  ]},
  2025: { total: 23_947_143, confidence: 'actual', categories: [
    { name: 'Administration & regulation',              total:    1_852_168 },
    { name: 'Education',                                total:    5_176_577 },
    { name: 'Health & human services',                  total:   12_466_945 },
    { name: 'Justice & public defense',                 total:    1_382_892 },
    { name: 'Economic development',                     total:      299_268 },
    { name: 'Transportation',                           total:      661_424 },
    { name: 'Agriculture & natural resources',          total:      288_242 },
    { name: 'Capital outlay',                           total:    1_718_152 },
    { name: 'Debt service — Principal',                 total:       81_123 },
    { name: 'Debt service — Interest & fiscal charges', total:       20_352 },
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
  return { jsonTree: [{ n: 'Iowa General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Iowa General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ia-acfr-gf-operating', base_url: 'https://das.iowa.gov/state-employees/state-accounting/state-financial-reports', fiscal_years: [2002,2003,2004,2005,2006,2007,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
