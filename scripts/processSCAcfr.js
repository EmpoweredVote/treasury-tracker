#!/usr/bin/env node
/**
 * South Carolina General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of South Carolina Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the SC state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   SC state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): SC ACFR GF ~1.46× NASBO GF ($20,731,521K FY2025 vs $14,189,000K
 *   NASBO FY2024). UNLIKE most other Batch-2 states, the driver here is NOT federal
 *   passthrough within the GF column (federal revenue in GF is only ~$46,273K FY2025) — it
 *   is a GAAP-vs-budgetary BASIS divergence: SC's GAAP General Fund consolidates broader
 *   transfer/interest/departmental-services activity than NASBO's narrower budgetary
 *   concept captures. Accepted-and-relabelled honestly (TX precedent), driver documented.
 *
 * REVENUE LABEL NOTE: SC's printed Governmental Funds statement prints a single "Taxes:"
 *   subsection header ahead of ALL General Fund revenue line items (confirmed across all 24
 *   loaded years, FY2002–FY2025) — there is no second header before the non-tax lines
 *   ("Licenses, fees, and permits", "Interest and other investment income", "Federal",
 *   "Local and private grants", "Departmental services", "Contributions", "Fines and
 *   penalties", "Tobacco/Opioid legal settlement", catch-all "Other") that follow. Naively
 *   suffixing every item under that header with " taxes" would mislabel "Federal" as
 *   "Federal taxes". gen_state.py's rev_boundary='Licenses, fees, and permits' clears the
 *   sub-heading at that line (the first genuinely non-tax item, confirmed present and in the
 *   same position in every loaded year) so only the true tax lines (Individual income,
 *   Retail sales and use, Corporate income, Gas and motor vehicle, Insurance, Hospital,
 *   Other) get the " taxes" suffix; the pre-2013 years report fewer tax sub-lines (Corporate
 *   income/Gas and motor vehicle/Insurance/Hospital folded into "Other taxes") — a real
 *   reporting-era difference, not an extraction gap.
 *
 * WINDOW NOTE (D-12): SC's full archive is live back to FY1993 on cg.sc.gov, but this
 *   tranche stops at the FY2002 pre-GASB-34 boundary per the locked Phase-112/114 scope
 *   (deeper SC history is Phase 115 extractor territory). FY2002–FY2025 = 24 years, all 24
 *   tie to $0 diff on both the revenue and expenditure printed General Fund totals.
 *
 * FY2025 FILE NOTE: the FY2025 ACFR is split into 9 part-PDFs; the Rev/Exp/Fund-Balances
 *   statement lives ONLY in `039-191-ACFR-FY2025-BasicFinancialStatements.pdf` (confirmed
 *   `application/pdf`, ties to $0 diff) — FY2019–FY2024 are each a single combined file.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): No negative GF lines observed in any of the 24 loaded years (Interest and other investment income positive throughout, FY2025 +$684,860K / FY2002 +$62,039K). Structural note: FY2002 General Fund ENDING FUND BALANCE was a deficit $(139,951)K — a balance-sheet fact, not a revenue-line P2 clamp trigger. Clamp path stays wired per ACFR-32.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/sc/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processSCAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'South Carolina'; const STATE_ABBR = 'SC'; const POPULATION = 5_118_425;
const EXPECTED_MUNI_ID = 'f0024b19-1b89-4bdf-af47-d2e28c21278f';
const UNITS = 1_000; // SC ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202002%20CAFR.pdf', date: '2002-06-30' },
  2003: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202003%20CAFR.pdf', date: '2003-06-30' },
  2004: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202004%20CAFR.pdf', date: '2004-06-30' },
  2005: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202005%20CAFR.pdf', date: '2005-06-30' },
  2006: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202006%20CAFR.pdf', date: '2006-06-30' },
  2007: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202007%20CAFR.pdf', date: '2007-06-30' },
  2008: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202008%20CAFR.pdf', date: '2008-06-30' },
  2009: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202009%20CAFR.pdf', date: '2009-06-30' },
  2010: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/SC%20FY%202010%20CAFR.pdf', date: '2010-06-30' },
  2011: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/SC%20FY%202011%20CAFR.pdf', date: '2011-06-30' },
  2012: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/SC%20FY%202012%20CAFR.pdf', date: '2012-06-30' },
  2013: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/State%20of%20South%20Carolina%202013%20CAFR.pdf', date: '2013-06-30' },
  2014: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/CAFR%20-%20FY%202014.pdf', date: '2014-06-30' },
  2015: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/CAFR%20-%20FY%202015.pdf', date: '2015-06-30' },
  2016: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/CAFR%20-%20FY%202016%20-%20Final.pdf', date: '2016-06-30' },
  2017: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/State%20of%20SC%20FY%202017%20CAFR.pdf', date: '2017-06-30' },
  2018: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/FY%202018%20CAFR%20-%202018-11-15.pdf', date: '2018-06-30' },
  2019: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001%20-%20302%20-%20CAFR%20-%20FY%202019.pdf', date: '2019-06-30' },
  2020: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-302-CAFR-FY2020.pdf', date: '2020-06-30' },
  2021: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-304-CAFR-FY2021.pdf', date: '2021-06-30' },
  2022: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-304-CAFR-FY2022.pdf', date: '2022-06-30' },
  2023: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-308-CAFR-FY2023.pdf', date: '2023-06-30' },
  2024: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/001-316-ACFR-FY2024.pdf', date: '2024-06-30' },
  2025: { url: 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2010%20-%202019)/ACFR%20Current%20Year/039-191-ACFR-FY2025-BasicFinancialStatements.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `South Carolina State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — SC ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 5_455_224, confidence: 'actual', categories: [
    { name: 'General government',                         total:      282_301 },
    { name: 'Education',                                  total:      303_809 },
    { name: 'Health and environment',                     total:    1_265_853 },
    { name: 'Social services',                            total:       93_772 },
    { name: 'Administration of justice',                  total:      530_835 },
    { name: 'Resources and economic development',         total:       93_214 },
    { name: 'Debt service — Principal retirement',        total:      120_902 },
    { name: 'Debt service — Interest and fiscal charges', total:       65_936 },
    { name: 'Intergovernmental',                          total:    2_698_602 },
  ]},
  2003: { total: 5_287_968, confidence: 'actual', categories: [
    { name: 'General government',                         total:      271_083 },
    { name: 'Education',                                  total:      309_013 },
    { name: 'Health and environment',                     total:    1_292_867 },
    { name: 'Social services',                            total:       83_176 },
    { name: 'Administration of justice',                  total:      503_424 },
    { name: 'Resources and economic development',         total:       87_618 },
    { name: 'Debt service — Principal retirement',        total:      155_656 },
    { name: 'Debt service — Interest and fiscal charges', total:       74_003 },
    { name: 'Intergovernmental',                          total:    2_511_128 },
  ]},
  2004: { total: 5_347_427, confidence: 'actual', categories: [
    { name: 'General government',                         total:      277_279 },
    { name: 'Education',                                  total:      324_233 },
    { name: 'Health and environment',                     total:    1_398_048 },
    { name: 'Social services',                            total:       79_178 },
    { name: 'Administration of justice',                  total:      455_045 },
    { name: 'Resources and economic development',         total:       78_087 },
    { name: 'Debt service — Principal retirement',        total:      144_345 },
    { name: 'Debt service — Interest and fiscal charges', total:       69_372 },
    { name: 'Intergovernmental',                          total:    2_521_840 },
  ]},
  2005: { total: 5_425_918, confidence: 'actual', categories: [
    { name: 'General government',                         total:      289_505 },
    { name: 'Education',                                  total:      247_722 },
    { name: 'Health and environment',                     total:    1_518_624 },
    { name: 'Social services',                            total:       81_205 },
    { name: 'Administration of justice',                  total:      461_495 },
    { name: 'Resources and economic development',         total:       78_290 },
    { name: 'Capital outlay',                             total:        2_163 },
    { name: 'Debt service — Principal retirement',        total:      161_735 },
    { name: 'Debt service — Interest and fiscal charges', total:       68_930 },
    { name: 'Intergovernmental',                          total:    2_516_249 },
  ]},
  2006: { total: 5_803_405, confidence: 'actual', categories: [
    { name: 'General government',                         total:      306_933 },
    { name: 'Education',                                  total:      278_760 },
    { name: 'Health and environment',                     total:    1_600_693 },
    { name: 'Social services',                            total:       82_502 },
    { name: 'Administration of justice',                  total:      513_531 },
    { name: 'Resources and economic development',         total:       85_595 },
    { name: 'Capital outlay',                             total:           35 },
    { name: 'Debt service — Principal retirement',        total:      158_947 },
    { name: 'Debt service — Interest and fiscal charges', total:       70_761 },
    { name: 'Intergovernmental',                          total:    2_705_648 },
  ]},
  2007: { total: 6_515_978, confidence: 'actual', categories: [
    { name: 'General government',                         total:      507_866 },
    { name: 'Education',                                  total:      334_738 },
    { name: 'Health and environment',                     total:    1_744_123 },
    { name: 'Social services',                            total:      131_719 },
    { name: 'Administration of justice',                  total:      561_717 },
    { name: 'Resources and economic development',         total:      111_216 },
    { name: 'Debt service — Principal retirement',        total:      158_318 },
    { name: 'Debt service — Interest and fiscal charges', total:       72_242 },
    { name: 'Intergovernmental',                          total:    2_894_039 },
  ]},
  2008: { total: 6_843_844, confidence: 'actual', categories: [
    { name: 'General government',                         total:      453_451 },
    { name: 'Education',                                  total:      421_945 },
    { name: 'Health and environment',                     total:    2_022_785 },
    { name: 'Social services',                            total:      143_232 },
    { name: 'Administration of justice',                  total:      613_693 },
    { name: 'Resources and economic development',         total:      130_389 },
    { name: 'Capital outlay',                             total:        2_400 },
    { name: 'Debt service — Principal retirement',        total:      157_286 },
    { name: 'Debt service — Interest and fiscal charges', total:       65_970 },
    { name: 'Intergovernmental',                          total:    2_832_693 },
  ]},
  2009: { total: 5_229_880, confidence: 'actual', categories: [
    { name: 'General government',                         total:      338_090 },
    { name: 'Education',                                  total:      262_562 },
    { name: 'Health and environment',                     total:    1_079_264 },
    { name: 'Social services',                            total:      108_114 },
    { name: 'Administration of justice',                  total:      561_631 },
    { name: 'Resources and economic development',         total:       95_668 },
    { name: 'Transportation',                             total:           31 },
    { name: 'Debt service — Principal retirement',        total:      159_611 },
    { name: 'Debt service — Interest and fiscal charges', total:       63_595 },
    { name: 'Intergovernmental',                          total:    2_561_314 },
  ]},
  2010: { total: 4_785_390, confidence: 'actual', categories: [
    { name: 'General government',                         total:      259_750 },
    { name: 'Education',                                  total:      270_080 },
    { name: 'Health and environment',                     total:    1_009_426 },
    { name: 'Social services',                            total:      117_977 },
    { name: 'Administration of justice',                  total:      508_931 },
    { name: 'Resources and economic development',         total:       73_830 },
    { name: 'Transportation',                             total:          808 },
    { name: 'Debt service — Principal retirement',        total:      141_956 },
    { name: 'Debt service — Interest and fiscal charges', total:       54_599 },
    { name: 'Intergovernmental',                          total:    2_348_033 },
  ]},
  2011: { total: 7_923_457, confidence: 'actual', categories: [
    { name: 'General government',                         total:      498_400 },
    { name: 'Education',                                  total:      420_096 },
    { name: 'Health and environment',                     total:    2_170_109 },
    { name: 'Social services',                            total:      157_153 },
    { name: 'Administration of justice',                  total:      612_466 },
    { name: 'Resources and economic development',         total:      119_682 },
    { name: 'Transportation',                             total:        1_292 },
    { name: 'Debt service — Principal retirement',        total:      155_722 },
    { name: 'Debt service — Interest and fiscal charges', total:       58_690 },
    { name: 'Intergovernmental',                          total:    3_729_847 },
  ]},
  2012: { total: 8_397_741, confidence: 'actual', categories: [
    { name: 'General government',                         total:      444_753 },
    { name: 'Education',                                  total:      564_973 },
    { name: 'Health and environment',                     total:    2_153_646 },
    { name: 'Social services',                            total:      281_405 },
    { name: 'Administration of justice',                  total:      689_442 },
    { name: 'Resources and economic development',         total:      133_813 },
    { name: 'Transportation',                             total:        2_135 },
    { name: 'Capital outlay',                             total:       32_334 },
    { name: 'Debt service — Principal retirement',        total:      145_416 },
    { name: 'Debt service — Interest and fiscal charges', total:       52_419 },
    { name: 'Intergovernmental',                          total:    3_897_405 },
  ]},
  2013: { total: 8_823_817, confidence: 'actual', categories: [
    { name: 'General government',                         total:      490_134 },
    { name: 'Education',                                  total:      471_559 },
    { name: 'Health and environment',                     total:    2_360_744 },
    { name: 'Social services',                            total:      290_081 },
    { name: 'Administration of justice',                  total:      678_463 },
    { name: 'Resources and economic development',         total:       97_657 },
    { name: 'Transportation',                             total:        2_470 },
    { name: 'Capital outlay',                             total:       46_932 },
    { name: 'Debt service — Principal retirement',        total:      149_620 },
    { name: 'Debt service — Interest and fiscal charges', total:       49_207 },
    { name: 'Intergovernmental',                          total:    4_186_950 },
  ]},
  2014: { total: 9_368_284, confidence: 'actual', categories: [
    { name: 'General government',                         total:      603_967 },
    { name: 'Education',                                  total:      567_699 },
    { name: 'Health and environment',                     total:    2_528_519 },
    { name: 'Social services',                            total:      324_402 },
    { name: 'Administration of justice',                  total:      770_354 },
    { name: 'Resources and economic development',         total:      142_446 },
    { name: 'Transportation',                             total:        1_553 },
    { name: 'Capital outlay',                             total:       78_155 },
    { name: 'Debt service — Principal retirement',        total:      149_360 },
    { name: 'Debt service — Interest and fiscal charges', total:       45_595 },
    { name: 'Intergovernmental',                          total:    4_156_234 },
  ]},
  2015: { total: 9_952_249, confidence: 'actual', categories: [
    { name: 'General government',                         total:      679_251 },
    { name: 'Education',                                  total:      548_098 },
    { name: 'Health and environment',                     total:    2_840_911 },
    { name: 'Social services',                            total:      178_122 },
    { name: 'Administration of justice',                  total:      790_816 },
    { name: 'Resources and economic development',         total:      163_240 },
    { name: 'Transportation',                             total:        1_682 },
    { name: 'Capital outlay',                             total:       85_456 },
    { name: 'Debt service — Principal retirement',        total:      161_280 },
    { name: 'Debt service — Interest and fiscal charges', total:       41_480 },
    { name: 'Intergovernmental',                          total:    4_461_913 },
  ]},
  2016: { total: 9_197_004, confidence: 'actual', categories: [
    { name: 'General government',                         total:      541_298 },
    { name: 'Education',                                  total:      560_778 },
    { name: 'Health and environment',                     total:    2_739_410 },
    { name: 'Social services',                            total:      200_356 },
    { name: 'Administration of justice',                  total:      779_317 },
    { name: 'Resources and economic development',         total:      188_540 },
    { name: 'Transportation',                             total:        1_929 },
    { name: 'Capital outlay',                             total:       47_046 },
    { name: 'Debt service — Principal retirement',        total:      135_630 },
    { name: 'Debt service — Interest and fiscal charges', total:       40_239 },
    { name: 'Intergovernmental',                          total:    3_962_461 },
  ]},
  2017: { total: 10_187_073, confidence: 'actual', categories: [
    { name: 'General government',                         total:      573_727 },
    { name: 'Education',                                  total:      567_931 },
    { name: 'Health and environment',                     total:    2_904_557 },
    { name: 'Social services',                            total:      197_548 },
    { name: 'Administration of justice',                  total:      820_582 },
    { name: 'Resources and economic development',         total:      183_623 },
    { name: 'Transportation',                             total:        1_852 },
    { name: 'Capital outlay',                             total:      100_884 },
    { name: 'Debt service — Principal retirement',        total:      147_648 },
    { name: 'Debt service — Interest and fiscal charges', total:       28_486 },
    { name: 'Intergovernmental',                          total:    4_660_235 },
  ]},
  2018: { total: 10_522_675, confidence: 'actual', categories: [
    { name: 'General government',                         total:      562_958 },
    { name: 'Education',                                  total:      561_056 },
    { name: 'Health and environment',                     total:    2_974_555 },
    { name: 'Social services',                            total:      248_522 },
    { name: 'Administration of justice',                  total:      865_050 },
    { name: 'Resources and economic development',         total:      171_047 },
    { name: 'Transportation',                             total:        2_013 },
    { name: 'Capital outlay',                             total:       84_634 },
    { name: 'Debt service — Principal retirement',        total:      135_033 },
    { name: 'Debt service — Interest and fiscal charges', total:       31_927 },
    { name: 'Intergovernmental',                          total:    4_885_880 },
  ]},
  2019: { total: 10_397_247, confidence: 'actual', categories: [
    { name: 'General government',                         total:    1_211_617 },
    { name: 'Education',                                  total:      617_339 },
    { name: 'Health and environment',                     total:    3_091_832 },
    { name: 'Social services',                            total:      244_320 },
    { name: 'Administration of justice',                  total:      881_512 },
    { name: 'Resources and economic development',         total:      162_421 },
    { name: 'Transportation',                             total:        1_979 },
    { name: 'Capital outlay',                             total:       69_780 },
    { name: 'Debt service — Principal retirement',        total:       56_471 },
    { name: 'Debt service — Interest and fiscal charges', total:       21_956 },
    { name: 'Intergovernmental',                          total:    4_038_020 },
  ]},
  2020: { total: 10_728_014, confidence: 'actual', categories: [
    { name: 'General government',                         total:    1_129_527 },
    { name: 'Education',                                  total:      645_387 },
    { name: 'Health and environment',                     total:    3_073_535 },
    { name: 'Social services',                            total:      274_257 },
    { name: 'Administration of justice',                  total:      909_993 },
    { name: 'Resources and economic development',         total:      207_973 },
    { name: 'Transportation',                             total:        1_975 },
    { name: 'Capital outlay',                             total:      132_815 },
    { name: 'Debt service — Principal retirement',        total:       63_812 },
    { name: 'Debt service — Interest and fiscal charges', total:       17_716 },
    { name: 'Intergovernmental',                          total:    4_271_024 },
  ]},
  2021: { total: 10_360_765, confidence: 'actual', categories: [
    { name: 'General government',                         total:      606_878 },
    { name: 'Education',                                  total:      594_339 },
    { name: 'Health and environment',                     total:    3_063_771 },
    { name: 'Social services',                            total:      283_531 },
    { name: 'Administration of justice',                  total:      904_665 },
    { name: 'Resources and economic development',         total:      183_954 },
    { name: 'Transportation',                             total:        1_831 },
    { name: 'Capital outlay',                             total:      117_009 },
    { name: 'Debt service — Principal retirement',        total:       77_389 },
    { name: 'Debt service — Interest and fiscal charges', total:       14_507 },
    { name: 'Intergovernmental',                          total:    4_512_891 },
  ]},
  2022: { total: 12_345_257, confidence: 'actual', categories: [
    { name: 'General government',                         total:    1_149_501 },
    { name: 'Education',                                  total:    1_727_179 },
    { name: 'Health and environment',                     total:    2_997_937 },
    { name: 'Social services',                            total:      301_796 },
    { name: 'Administration of justice',                  total:      953_864 },
    { name: 'Resources and economic development',         total:      237_163 },
    { name: 'Transportation',                             total:       53_828 },
    { name: 'Capital outlay',                             total:       45_472 },
    { name: 'Debt service — Principal retirement',        total:       90_793 },
    { name: 'Debt service — Interest and fiscal charges', total:       28_651 },
    { name: 'Intergovernmental',                          total:    4_759_073 },
  ]},
  2023: { total: 15_531_902, confidence: 'actual', categories: [
    { name: 'General government',                         total:    2_300_230 },
    { name: 'Education',                                  total:      986_813 },
    { name: 'Health and environment',                     total:    3_152_766 },
    { name: 'Social services',                            total:      384_676 },
    { name: 'Administration of justice',                  total:    1_263_981 },
    { name: 'Resources and economic development',         total:      295_430 },
    { name: 'Transportation',                             total:      255_487 },
    { name: 'Capital outlay',                             total:       81_022 },
    { name: 'Debt service — Principal retirement',        total:       92_318 },
    { name: 'Debt service — Interest and fiscal charges', total:       12_147 },
    { name: 'Intergovernmental',                          total:    6_707_032 },
  ]},
  2024: { total: 18_569_778, confidence: 'actual', categories: [
    { name: 'General government',                         total:      954_101 },
    { name: 'Education',                                  total:    1_064_247 },
    { name: 'Health and environment',                     total:    4_155_726 },
    { name: 'Social services',                            total:      389_543 },
    { name: 'Administration of justice',                  total:    1_271_912 },
    { name: 'Resources and economic development',         total:      504_231 },
    { name: 'Transportation',                             total:      142_538 },
    { name: 'Capital outlay',                             total:       22_122 },
    { name: 'Debt service — Principal retirement',        total:       96_571 },
    { name: 'Debt service — Interest and fiscal charges', total:       11_296 },
    { name: 'Intergovernmental',                          total:    9_957_491 },
  ]},
  2025: { total: 20_323_239, confidence: 'actual', categories: [
    { name: 'General government',                               total:      938_492 },
    { name: 'Education',                                        total:    1_512_502 },
    { name: 'Health',                                           total:    4_283_377 },
    { name: 'Social services',                                  total:      403_362 },
    { name: 'Administration of justice',                        total:    1_355_530 },
    { name: 'Resources, environment, and economic development', total:      914_129 },
    { name: 'Transportation',                                   total:      565_708 },
    { name: 'Capital outlay',                                   total:      359_416 },
    { name: 'Debt service — Principal retirement',              total:       79_289 },
    { name: 'Debt service — Interest and fiscal charges',       total:       23_748 },
    { name: 'Intergovernmental',                                total:    9_887_686 },
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
  return { jsonTree: [{ n: 'South Carolina General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'South Carolina General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'sc-acfr-gf-operating', base_url: 'https://cg.sc.gov/financial-reports/annual-comprehensive-financial-reports-acfrs', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
      const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
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
