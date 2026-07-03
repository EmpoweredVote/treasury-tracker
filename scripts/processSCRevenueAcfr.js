#!/usr/bin/env node
/**
 * South Carolina General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of South Carolina Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the SC state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/sc/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processSCRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `South Carolina State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — SC ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 5_763_261, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_338_858 },
    { name: 'Retail sales and use taxes',           total:    2_033_122 },
    { name: 'Other taxes',                          total:      666_115 },
    { name: 'Licenses, fees, and permits',          total:      102_335 },
    { name: 'Interest and other investment income', total:       62_039 },
    { name: 'Federal',                              total:      102_609 },
    { name: 'Local and private grants',             total:          877 },
    { name: 'Departmental services',                total:      409_954 },
    { name: 'Contributions',                        total:       12_477 },
    { name: 'Fines and penalties',                  total:       21_045 },
    { name: 'Tobacco legal settlement',             total:          600 },
    { name: 'Other',                                total:       13_230 },
  ]},
  2003: { total: 5_846_869, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_282_196 },
    { name: 'Retail sales and use taxes',           total:    2_068_826 },
    { name: 'Other taxes',                          total:      686_483 },
    { name: 'Licenses, fees, and permits',          total:      135_365 },
    { name: 'Interest and other investment income', total:       27_180 },
    { name: 'Federal',                              total:      176_343 },
    { name: 'Departmental services',                total:      427_327 },
    { name: 'Contributions',                        total:       11_874 },
    { name: 'Fines and penalties',                  total:       18_461 },
    { name: 'Other',                                total:       12_814 },
  ]},
  2004: { total: 6_130_682, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_398_475 },
    { name: 'Retail sales and use taxes',           total:    2_196_906 },
    { name: 'Other taxes',                          total:      737_590 },
    { name: 'Licenses, fees, and permits',          total:      129_521 },
    { name: 'Interest and other investment income', total:       11_925 },
    { name: 'Federal',                              total:      180_916 },
    { name: 'Departmental services',                total:      409_128 },
    { name: 'Contributions',                        total:       12_134 },
    { name: 'Fines and penalties',                  total:       25_531 },
    { name: 'Other',                                total:       28_556 },
  ]},
  2005: { total: 6_672_504, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_754_497 },
    { name: 'Retail sales and use taxes',           total:    2_341_244 },
    { name: 'Other taxes',                          total:      780_106 },
    { name: 'Licenses, fees, and permits',          total:      146_531 },
    { name: 'Interest and other investment income', total:       27_596 },
    { name: 'Federal',                              total:      122_567 },
    { name: 'Departmental services',                total:      423_125 },
    { name: 'Contributions',                        total:       25_424 },
    { name: 'Fines and penalties',                  total:       24_943 },
    { name: 'Other',                                total:       26_471 },
  ]},
  2006: { total: 7_289_210, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_115_907 },
    { name: 'Retail sales and use taxes',           total:    2_533_540 },
    { name: 'Other taxes',                          total:      873_247 },
    { name: 'Licenses, fees, and permits',          total:      125_673 },
    { name: 'Interest and other investment income', total:       62_766 },
    { name: 'Federal',                              total:       82_366 },
    { name: 'Local and private grants',             total:        2_418 },
    { name: 'Departmental services',                total:      425_893 },
    { name: 'Contributions',                        total:       14_955 },
    { name: 'Fines and penalties',                  total:       22_311 },
    { name: 'Other',                                total:       30_134 },
  ]},
  2007: { total: 7_667_405, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_323_665 },
    { name: 'Retail sales and use taxes',           total:    2_633_562 },
    { name: 'Other taxes',                          total:      877_147 },
    { name: 'Licenses, fees, and permits',          total:      121_056 },
    { name: 'Interest and other investment income', total:      129_320 },
    { name: 'Federal',                              total:       91_041 },
    { name: 'Local and private grants',             total:          892 },
    { name: 'Departmental services',                total:      424_704 },
    { name: 'Contributions',                        total:       14_999 },
    { name: 'Fines and penalties',                  total:       21_393 },
    { name: 'Other',                                total:       29_626 },
  ]},
  2008: { total: 7_515_320, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_344_965 },
    { name: 'Retail sales and use taxes',           total:    2_458_786 },
    { name: 'Other taxes',                          total:      854_588 },
    { name: 'Licenses, fees, and permits',          total:      111_440 },
    { name: 'Interest and other investment income', total:      147_366 },
    { name: 'Federal',                              total:       98_516 },
    { name: 'Local and private grants',             total:        2_440 },
    { name: 'Departmental services',                total:      447_532 },
    { name: 'Contributions',                        total:       15_833 },
    { name: 'Fines and penalties',                  total:       22_596 },
    { name: 'Other',                                total:       11_258 },
  ]},
  2009: { total: 6_228_514, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_811_634 },
    { name: 'Retail sales and use taxes',           total:    2_248_962 },
    { name: 'Other taxes',                          total:      769_580 },
    { name: 'Licenses, fees, and permits',          total:      113_309 },
    { name: 'Interest and other investment income', total:       60_422 },
    { name: 'Federal',                              total:       78_274 },
    { name: 'Local and private grants',             total:        2_703 },
    { name: 'Departmental services',                total:       63_641 },
    { name: 'Contributions',                        total:       20_510 },
    { name: 'Fines and penalties',                  total:       21_587 },
    { name: 'Other',                                total:       37_892 },
  ]},
  2010: { total: 5_908_175, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_643_141 },
    { name: 'Retail sales and use taxes',           total:    2_199_513 },
    { name: 'Other taxes',                          total:      701_160 },
    { name: 'Licenses, fees, and permits',          total:       96_071 },
    { name: 'Interest and other investment income', total:       50_815 },
    { name: 'Federal',                              total:       87_461 },
    { name: 'Departmental services',                total:        4_138 },
    { name: 'Contributions',                        total:       18_515 },
    { name: 'Fines and penalties',                  total:       52_484 },
    { name: 'Other',                                total:       54_877 },
  ]},
  2011: { total: 8_871_374, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    2_886_388 },
    { name: 'Retail sales and use taxes',           total:    3_343_926 },
    { name: 'Other taxes',                          total:    1_170_845 },
    { name: 'Licenses, fees, and permits',          total:      296_348 },
    { name: 'Interest and other investment income', total:       23_530 },
    { name: 'Federal',                              total:       81_700 },
    { name: 'Local and private grants',             total:       49_009 },
    { name: 'Departmental services',                total:      583_759 },
    { name: 'Contributions',                        total:       39_716 },
    { name: 'Fines and penalties',                  total:      100_405 },
    { name: 'Other',                                total:      295_748 },
  ]},
  2012: { total: 9_508_898, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_101_593 },
    { name: 'Retail sales and use taxes',           total:    3_490_637 },
    { name: 'Other taxes',                          total:    1_202_158 },
    { name: 'Licenses, fees, and permits',          total:      259_397 },
    { name: 'Interest and other investment income', total:       53_820 },
    { name: 'Federal',                              total:       77_451 },
    { name: 'Local and private grants',             total:       15_883 },
    { name: 'Departmental services',                total:      763_652 },
    { name: 'Contributions',                        total:       36_474 },
    { name: 'Fines and penalties',                  total:      100_149 },
    { name: 'Other',                                total:      407_684 },
  ]},
  2013: { total: 9_874_881, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_459_968 },
    { name: 'Retail sales and use taxes',           total:    3_624_715 },
    { name: 'Corporate Income taxes',               total:      386_847 },
    { name: 'Insurance taxes',                      total:      139_240 },
    { name: 'Hospital taxes',                       total:      263_435 },
    { name: 'Other taxes',                          total:      460_147 },
    { name: 'Licenses, fees, and permits',          total:      293_657 },
    { name: 'Interest and other investment income', total:       14_473 },
    { name: 'Federal',                              total:       63_473 },
    { name: 'Local and private grants',             total:        6_721 },
    { name: 'Departmental services',                total:      656_122 },
    { name: 'Contributions',                        total:        5_666 },
    { name: 'Fines and penalties',                  total:      111_890 },
    { name: 'Other',                                total:      388_527 },
  ]},
  2014: { total: 9_880_966, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_399_439 },
    { name: 'Retail sales and use taxes',           total:    3_464_553 },
    { name: 'Corporate Income taxes',               total:      327_809 },
    { name: 'Insurance taxes',                      total:      138_037 },
    { name: 'Hospital taxes',                       total:      262_962 },
    { name: 'Other taxes',                          total:      477_282 },
    { name: 'Licenses, fees, and permits',          total:      277_093 },
    { name: 'Interest and other investment income', total:       36_163 },
    { name: 'Federal',                              total:       51_402 },
    { name: 'Local and private grants',             total:        5_244 },
    { name: 'Departmental services',                total:      793_229 },
    { name: 'Contributions',                        total:       15_247 },
    { name: 'Fines and penalties',                  total:      133_468 },
    { name: 'Other',                                total:      499_038 },
  ]},
  2015: { total: 10_013_969, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_717_482 },
    { name: 'Retail sales and use taxes',           total:    3_665_745 },
    { name: 'Corporate Income taxes',               total:      377_329 },
    { name: 'Insurance taxes',                      total:      152_314 },
    { name: 'Hospital taxes',                       total:      263_557 },
    { name: 'Other taxes',                          total:      521_557 },
    { name: 'Licenses, fees, and permits',          total:      318_560 },
    { name: 'Interest and other investment income', total:        8_442 },
    { name: 'Federal',                              total:       56_946 },
    { name: 'Local and private grants',             total:        4_079 },
    { name: 'Departmental services',                total:      684_191 },
    { name: 'Contributions',                        total:       13_738 },
    { name: 'Fines and penalties',                  total:      101_248 },
    { name: 'Other',                                total:      128_781 },
  ]},
  2016: { total: 10_146_407, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    3_858_585 },
    { name: 'Retail sales and use taxes',           total:    3_557_449 },
    { name: 'Corporate Income taxes',               total:      408_297 },
    { name: 'Insurance taxes',                      total:      156_766 },
    { name: 'Hospital taxes',                       total:      265_689 },
    { name: 'Other taxes',                          total:      531_470 },
    { name: 'Licenses, fees, and permits',          total:      285_996 },
    { name: 'Interest and other investment income', total:       41_960 },
    { name: 'Federal',                              total:       60_386 },
    { name: 'Local and private grants',             total:        6_111 },
    { name: 'Departmental services',                total:      683_164 },
    { name: 'Contributions',                        total:        9_149 },
    { name: 'Fines and penalties',                  total:       93_460 },
    { name: 'Other',                                total:      187_925 },
  ]},
  2017: { total: 10_480_545, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    4_118_671 },
    { name: 'Retail sales and use taxes',           total:    3_627_303 },
    { name: 'Corporate Income taxes',               total:      340_327 },
    { name: 'Insurance taxes',                      total:      168_974 },
    { name: 'Hospital taxes',                       total:      267_235 },
    { name: 'Other taxes',                          total:      537_147 },
    { name: 'Licenses, fees, and permits',          total:      269_248 },
    { name: 'Interest and other investment income', total:       59_974 },
    { name: 'Federal',                              total:       85_018 },
    { name: 'Local and private grants',             total:        7_907 },
    { name: 'Departmental services',                total:      730_417 },
    { name: 'Contributions',                        total:        9_880 },
    { name: 'Fines and penalties',                  total:       77_653 },
    { name: 'Other',                                total:      180_791 },
  ]},
  2018: { total: 11_052_022, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    4_385_106 },
    { name: 'Retail sales and use taxes',           total:    3_736_072 },
    { name: 'Corporate Income taxes',               total:      404_164 },
    { name: 'Insurance taxes',                      total:      188_979 },
    { name: 'Hospital taxes',                       total:      260_715 },
    { name: 'Other taxes',                          total:      591_148 },
    { name: 'Licenses, fees, and permits',          total:      224_966 },
    { name: 'Interest and other investment income', total:       57_382 },
    { name: 'Federal',                              total:       59_600 },
    { name: 'Local and private grants',             total:        9_296 },
    { name: 'Departmental services',                total:      728_955 },
    { name: 'Contributions',                        total:       21_504 },
    { name: 'Fines and penalties',                  total:       74_035 },
    { name: 'Other',                                total:      310_100 },
  ]},
  2019: { total: 11_834_269, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    4_801_707 },
    { name: 'Retail sales and use taxes',           total:    3_968_934 },
    { name: 'Corporate Income taxes',               total:      396_207 },
    { name: 'Insurance taxes',                      total:      202_481 },
    { name: 'Hospital taxes',                       total:      261_448 },
    { name: 'Other taxes',                          total:      616_269 },
    { name: 'Licenses, fees, and permits',          total:      204_569 },
    { name: 'Interest and other investment income', total:      157_129 },
    { name: 'Federal',                              total:       45_649 },
    { name: 'Local and private grants',             total:        8_164 },
    { name: 'Departmental services',                total:      767_500 },
    { name: 'Contributions',                        total:       17_196 },
    { name: 'Fines and penalties',                  total:       67_593 },
    { name: 'Other',                                total:      319_423 },
  ]},
  2020: { total: 12_154_289, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    5_018_135 },
    { name: 'Retail sales and use taxes',           total:    4_068_487 },
    { name: 'Corporate Income taxes',               total:      362_569 },
    { name: 'Insurance taxes',                      total:      213_291 },
    { name: 'Hospital taxes',                       total:      268_702 },
    { name: 'Other taxes',                          total:      646_597 },
    { name: 'Licenses, fees, and permits',          total:      260_398 },
    { name: 'Interest and other investment income', total:      208_560 },
    { name: 'Federal',                              total:       68_280 },
    { name: 'Departmental services',                total:      769_417 },
    { name: 'Contributions',                        total:        7_228 },
    { name: 'Fines and penalties',                  total:       58_849 },
    { name: 'Other',                                total:      203_776 },
  ]},
  2021: { total: 14_405_366, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    5_559_739 },
    { name: 'Retail sales and use taxes',           total:    4_792_519 },
    { name: 'Corporate income taxes',               total:      573_618 },
    { name: 'Insurance taxes',                      total:      223_984 },
    { name: 'Hospital taxes',                       total:      258_970 },
    { name: 'Other taxes',                          total:      710_440 },
    { name: 'Licenses, fees, and permits',          total:      338_196 },
    { name: 'Interest and other investment income', total:       23_162 },
    { name: 'Federal',                              total:       54_195 },
    { name: 'Local and private grants',             total:        6_144 },
    { name: 'Departmental services',                total:      789_207 },
    { name: 'Contributions',                        total:        6_240 },
    { name: 'Fines and penalties',                  total:      111_149 },
    { name: 'Other',                                total:      957_803 },
  ]},
  2022: { total: 15_970_194, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    6_908_580 },
    { name: 'Retail sales and use taxes',           total:    5_579_590 },
    { name: 'Corporate income taxes',               total:    1_048_315 },
    { name: 'Insurance taxes',                      total:      236_187 },
    { name: 'Hospital taxes',                       total:      266_581 },
    { name: 'Other taxes',                          total:      826_124 },
    { name: 'Licenses, fees, and permits',          total:      305_833 },
    { name: 'Interest and other investment income', total:     -319_349 },
    { name: 'Federal',                              total:       80_711 },
    { name: 'Local and private grants',             total:       19_014 },
    { name: 'Departmental services',                total:      701_884 },
    { name: 'Contributions',                        total:       11_394 },
    { name: 'Fines and penalties',                  total:       67_722 },
    { name: 'Other',                                total:      237_608 },
  ]},
  2023: { total: 16_083_490, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    5_862_074 },
    { name: 'Retail sales and use taxes',           total:    5_817_004 },
    { name: 'Corporate income taxes',               total:    1_219_636 },
    { name: 'Insurance taxes',                      total:      265_396 },
    { name: 'Hospital taxes',                       total:      266_298 },
    { name: 'Other taxes',                          total:      816_613 },
    { name: 'Licenses, fees, and permits',          total:      382_111 },
    { name: 'Interest and other investment income', total:      335_554 },
    { name: 'Federal',                              total:       61_277 },
    { name: 'Local and private grants',             total:        5_980 },
    { name: 'Departmental services',                total:      575_145 },
    { name: 'Contributions',                        total:       21_304 },
    { name: 'Fines and penalties',                  total:       72_242 },
    { name: 'Other',                                total:      382_856 },
  ]},
  2024: { total: 17_835_376, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    5_903_170 },
    { name: 'Retail sales and use taxes',           total:    6_847_342 },
    { name: 'Corporate income taxes',               total:    1_250_049 },
    { name: 'Gas and motor vehicle taxes',          total:        1_585 },
    { name: 'Insurance taxes',                      total:      278_572 },
    { name: 'Hospital taxes',                       total:      847_308 },
    { name: 'Other taxes',                          total:      814_930 },
    { name: 'Licenses, fees, and permits',          total:       51_104 },
    { name: 'Interest and other investment income', total:      672_136 },
    { name: 'Federal',                              total:       54_637 },
    { name: 'Local and private grants',             total:        2_280 },
    { name: 'Departmental services',                total:      560_112 },
    { name: 'Contributions',                        total:       17_094 },
    { name: 'Fines and penalties',                  total:       84_881 },
    { name: 'Other',                                total:      450_176 },
  ]},
  2025: { total: 20_731_521, confidence: 'actual', categories: [
    { name: 'Individual income taxes',              total:    6_675_614 },
    { name: 'Retail sales and use taxes',           total:    7_690_715 },
    { name: 'Corporate income taxes',               total:    1_350_878 },
    { name: 'Gas and motor vehicle taxes',          total:        1_486 },
    { name: 'Insurance taxes',                      total:      294_450 },
    { name: 'Hospital taxes',                       total:      984_000 },
    { name: 'Other taxes',                          total:      887_299 },
    { name: 'Licenses, fees, and permits',          total:      964_578 },
    { name: 'Interest and other investment income', total:      684_860 },
    { name: 'Federal',                              total:       46_273 },
    { name: 'Local and private grants',             total:        8_224 },
    { name: 'Departmental services',                total:      654_580 },
    { name: 'Contributions',                        total:       16_275 },
    { name: 'Fines and penalties',                  total:       90_692 },
    { name: 'Other',                                total:      381_597 },
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
  return { jsonTree: [{ n: 'South Carolina General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'South Carolina General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'sc-acfr-gf-revenue', base_url: 'https://cg.sc.gov/financial-reports/annual-comprehensive-financial-reports-acfrs', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!REVENUE[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
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
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} revenue row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} revenue budget row to stamp source`); process.exit(2); }
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
