#!/usr/bin/env node
/**
 * Alabama General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Alabama Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the AL state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   AL state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SEPTEMBER 30 FY-END (MI precedent, D-03 -- the ONLY non-June-30 state in this tranche):
 *   AL's fiscal year runs October 1 - September 30. source_date = `${fy}-09-30` (NOT -06-30)
 *   on every budgets row; fiscal_year_start_month: 10 stamped on the ephemeral data_sources
 *   payload AND belt-and-suspenders on the post-RPC budgets update (RPC migration
 *   20260613120000 propagates v_ds.fiscal_year_start_month into treasury.budgets).
 *
 * SCOPE DECISION (ACFR-31 -- resolves the recon's AL load-phase flag): AL ACFR GF Total
 *   revenues ~0.24x NASBO GF ($3,262,681K FY2024 vs $13,511,000K NASBO FY2024) -- the
 *   NARROWEST divergence direction in the entire v2.14 tranche (every other Batch-1/Batch-2
 *   state's GAAP GF is AT OR ABOVE its NASBO figure via federal-passthrough consolidation;
 *   AL and UT are the only two states where ACFR undershoots). Driver: Alabama's
 *   CONSTITUTIONAL DUAL-BUDGET system -- the General Fund funds non-education government
 *   while the Education Trust Fund ($10,779,442K FY2024) is kept as a legally separate major
 *   fund column in the same statement. GF + ETF = $14,042,123K ~= 1.04x NASBO -- strong
 *   corroborating evidence that NASBO's survey-reported "General Fund" figure for Alabama
 *   combines both funds' concept, while the ACFR statement legally separates them.
 *
 *   THIS LOADER'S DECISION: load the printed GENERAL FUND column ALONE -- NOT a synthetic
 *   GF+ETF composite. Rationale (same as UT's ACFR-31 precedent): the phase's tie standard
 *   requires every stored total to tie to a printed GF-column total; a two-fund composite is
 *   a synthetic figure no statement prints; and the cohort-wide mold is the printed GF column
 *   of the same statement in every state. Consequence, documented honestly: the AL node total
 *   drops from ~$13.5B (NASBO) to ~$2.3B (GAAP GF expenditures) -- expected, correct, and
 *   NOT a regression. No Education Trust Fund amount is summed into any stored total.
 *
 * COLUMN-POSITION NOTE: GF = column 1 in EVERY loaded year, but the major-fund lineup to its
 *   right shifts across eras (FY2002: General Fund | Education Trust Fund | Alabama Trust
 *   Fund | Medicaid Fund | Public Road and Bridge Fund | Public Welfare Trust Fund |
 *   Nonmajor | Total; FY2024: General Fund | Education Trust Fund | Alabama Trust Fund |
 *   Medicaid Fund | Public Welfare Trust Fund | ARPA Coronavirus State Fiscal Recovery Fund |
 *   Nonmajor | Total) -- extracted by POSITION (first numeric token), never by column-header
 *   text matching (UT/KY precedent).
 *
 * CLEAN EXTRACTION (unusual for this tranche): all 24 years FY2002-FY2025 tied to $0 diff on
 *   BOTH the revenue and expenditure printed General Fund totals on the FIRST extraction
 *   pass -- zero honest holes, a uniform 6-revenue-category / 11-12-expenditure-category
 *   statement shape across the entire window, no OCR/font defects, no wrapped labels
 *   requiring the KY pending-prefix fix. Bookends: FY2024 rev 3,262,681 / exp 2,291,921;
 *   FY2002 rev 1,094,623 / exp 1,044,708 (all four $0 diff).
 *
 * WINDOW NOTE (D-12): AL's archive is live back to FY2000 (`{{YYYY}}CAFR.pdf` era), but this
 *   tranche stops at the FY2002 pre-GASB-34 boundary per the locked Phase-112/114 scope
 *   (deeper AL history is Phase 115 extractor territory).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): No negative GF lines observed in any of the 24 loaded years, on either the revenue or expenditure side (confirmed by a full-cohort negative-value scan, not just the two bookend years). Clamp path (clampForRender / P2) stays wired per ACFR-32 as the tranche-standard safety net, unexercised for AL.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/al/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processALAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Alabama'; const STATE_ABBR = 'AL'; const POPULATION = 5_024_279;
const EXPECTED_MUNI_ID = 'bc953061-98de-43ad-878a-c6564bf75dbc';
const UNITS = 1_000; // AL ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2002: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/2002CAFR.pdf', date: '2002-09-30' },
  2003: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/2003CAFR.pdf', date: '2003-09-30' },
  2004: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/2004CAFR.pdf', date: '2004-09-30' },
  2005: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/2005CAFR.pdf', date: '2005-09-30' },
  2006: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/2006CAFR.pdf', date: '2006-09-30' },
  2007: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2007.pdf', date: '2007-09-30' },
  2008: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2008.pdf', date: '2008-09-30' },
  2009: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2009.pdf', date: '2009-09-30' },
  2010: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2010.pdf', date: '2010-09-30' },
  2011: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/CAFR.Ala_.2011.pdf', date: '2011-09-30' },
  2012: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.ala_.2012.pdf', date: '2012-09-30' },
  2013: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2013.ala_.pdf', date: '2013-09-30' },
  2014: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2014.Alabama.pdf', date: '2014-09-30' },
  2015: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/Cafr.2015.pdf', date: '2015-09-30' },
  2016: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2018/03/CAFR-2016.Alabama.pdf', date: '2016-09-30' },
  2017: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2018/11/CAFR-2017.Alabama.pdf', date: '2017-09-30' },
  2018: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2019/04/CAFR-2018.Alabama.pdf', date: '2018-09-30' },
  2019: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2020/03/CAFR-2019.Alabama.pdf', date: '2019-09-30' },
  2020: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2021/03/CAFR-2020.Alabama.pdf', date: '2020-09-30' },
  2021: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2022/03/ACFR-2021.Alabama.pdf', date: '2021-09-30' },
  2022: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2023/04/ACFR-2022.Alabama.pdf', date: '2022-09-30' },
  2023: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2024/03/ACFR-2023.Alabama.pdf', date: '2023-09-30' },
  2024: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2025/04/ACFR-2024.Alabama.pdf', date: '2024-09-30' },
  2025: { url: 'https://comptroller.alabama.gov/wp-content/uploads/2026/03/ACFR-2025.Alabama.pdf', date: '2025-09-30' },
};
const dataSource = (fy) => `Alabama State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — AL ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2002: { total: 1_044_708, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        7_625 },
    { name: 'Education and Cultural Resources',          total:        9_946 },
    { name: 'Natural Resources and Recreation',          total:        6_820 },
    { name: 'Health - Physical and Mental',              total:      381_134 },
    { name: 'Social Services',                           total:       24_450 },
    { name: 'Protection of Persons and Property',        total:      342_430 },
    { name: 'General Government',                        total:      250_258 },
    { name: 'Debt Service - Principal Retirement',       total:       18_424 },
    { name: 'Debt Service - Interest and Other Charges', total:        3_621 },
  ]},
  2003: { total: 1_078_341, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        7_684 },
    { name: 'Education and Cultural Resources',          total:        8_975 },
    { name: 'Natural Resources and Recreation',          total:        5_695 },
    { name: 'Health - Physical and Mental',              total:      368_999 },
    { name: 'Social Services',                           total:       22_190 },
    { name: 'Protection of Persons and Property',        total:      382_069 },
    { name: 'Transportation',                            total:            1 },
    { name: 'General Government',                        total:      262_297 },
    { name: 'Debt Service - Principal Retirement',       total:       18_187 },
    { name: 'Debt Service - Interest and Other Charges', total:        2_244 },
  ]},
  2004: { total: 1_083_346, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        5_958 },
    { name: 'Education and Cultural Resources',          total:        6_343 },
    { name: 'Natural Resources and Recreation',          total:        2_372 },
    { name: 'Health - Physical and Mental',              total:      393_649 },
    { name: 'Social Services',                           total:       16_620 },
    { name: 'Protection of Persons and Property',        total:      413_254 },
    { name: 'General Government',                        total:      230_950 },
    { name: 'Distributions to Local Governments',        total:        5_330 },
    { name: 'Debt Service - Principal Retirement',       total:        6_892 },
    { name: 'Debt Service - Interest and Other Charges', total:        1_978 },
  ]},
  2005: { total: 1_247_764, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        6_261 },
    { name: 'Education and Cultural Resources',          total:        6_022 },
    { name: 'Natural Resources and Recreation',          total:        2_018 },
    { name: 'Health - Physical and Mental',              total:      504_658 },
    { name: 'Social Services',                           total:       16_016 },
    { name: 'Protection of Persons and Property',        total:      465_085 },
    { name: 'General Government',                        total:      246_739 },
    { name: 'Debt Service - Principal Retirement',       total:           27 },
    { name: 'Debt Service - Interest and Other Charges', total:          938 },
  ]},
  2006: { total: 1_409_195, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        7_275 },
    { name: 'Education and Cultural Resources',          total:        4_609 },
    { name: 'Natural Resources and Recreation',          total:        2_590 },
    { name: 'Health - Physical and Mental',              total:      592_093 },
    { name: 'Social Services',                           total:       14_830 },
    { name: 'Protection of Persons and Property',        total:      511_972 },
    { name: 'General Government',                        total:      274_892 },
    { name: 'Debt Service - Principal Retirement',       total:           27 },
    { name: 'Debt Service - Interest and Other Charges', total:          907 },
  ]},
  2007: { total: 1_456_734, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:       10_337 },
    { name: 'Education and Cultural Resources',          total:        7_563 },
    { name: 'Natural Resources and Recreation',          total:        4_338 },
    { name: 'Health - Physical and Mental',              total:      586_806 },
    { name: 'Social Services',                           total:       15_541 },
    { name: 'Protection of Persons and Property',        total:      524_450 },
    { name: 'General Government',                        total:      307_614 },
    { name: 'Debt Service - Principal Retirement',       total:           73 },
    { name: 'Debt Service - Interest and Other Charges', total:           12 },
  ]},
  2008: { total: 1_615_484, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:       11_712 },
    { name: 'Education and Cultural Resources',          total:       10_630 },
    { name: 'Natural Resources and Recreation',          total:        6_283 },
    { name: 'Health',                                    total:      658_170 },
    { name: 'Social Services',                           total:       15_113 },
    { name: 'Protection of Persons and Property',        total:      580_773 },
    { name: 'General Government',                        total:      331_960 },
    { name: 'Debt Service - Principal Retirement',       total:          691 },
    { name: 'Debt Service - Interest and Other Charges', total:          152 },
  ]},
  2009: { total: 1_475_848, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:       10_233 },
    { name: 'Education and Cultural Resources',          total:       11_121 },
    { name: 'Natural Resources and Recreation',          total:        5_599 },
    { name: 'Health',                                    total:      546_062 },
    { name: 'Social Services',                           total:       12_422 },
    { name: 'Protection of Persons and Property',        total:      562_999 },
    { name: 'General Government',                        total:      326_361 },
    { name: 'Debt Service - Principal Retirement',       total:          896 },
    { name: 'Debt Service - Interest and Other Charges', total:          155 },
  ]},
  2010: { total: 1_256_598, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        8_797 },
    { name: 'Education and Cultural Resources',          total:       13_386 },
    { name: 'Natural Resources and Recreation',          total:        5_352 },
    { name: 'Health',                                    total:      457_995 },
    { name: 'Social Services',                           total:       13_462 },
    { name: 'Protection of Persons and Property',        total:      441_291 },
    { name: 'Transportation',                            total:            2 },
    { name: 'General Government',                        total:      313_429 },
    { name: 'Debt Service - Principal Retirement',       total:        2_731 },
    { name: 'Debt Service - Interest and Other Charges', total:          153 },
  ]},
  2011: { total: 1_322_266, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        7_431 },
    { name: 'Education and Cultural Resources',          total:        9_832 },
    { name: 'Natural Resources and Recreation',          total:        4_731 },
    { name: 'Health',                                    total:      557_926 },
    { name: 'Social Services',                           total:       11_107 },
    { name: 'Protection of Persons and Property',        total:      469_526 },
    { name: 'General Government',                        total:      260_780 },
    { name: 'Debt Service - Principal Retirement',       total:          870 },
    { name: 'Debt Service - Interest and Other Charges', total:           63 },
  ]},
  2012: { total: 1_490_146, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        5_797 },
    { name: 'Education and Cultural Resources',          total:        4_456 },
    { name: 'Natural Resources and Recreation',          total:        3_172 },
    { name: 'Health',                                    total:      710_265 },
    { name: 'Social Services',                           total:        9_314 },
    { name: 'Protection of Persons and Property',        total:      527_287 },
    { name: 'General Government',                        total:      229_006 },
    { name: 'Debt Service - Principal Retirement',       total:          827 },
    { name: 'Debt Service - Interest and Other Charges', total:           22 },
  ]},
  2013: { total: 1_353_122, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation', total:        4_650 },
    { name: 'Education and Cultural Resources',    total:        6_301 },
    { name: 'Natural Resources and Recreation',    total:        3_723 },
    { name: 'Health',                              total:      601_337 },
    { name: 'Social Services',                     total:       10_755 },
    { name: 'Protection of Persons and Property',  total:      528_985 },
    { name: 'General Government',                  total:      197_371 },
  ]},
  2014: { total: 1_419_006, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        5_230 },
    { name: 'Education and Cultural Resources',          total:        5_045 },
    { name: 'Natural Resources and Recreation',          total:        5_045 },
    { name: 'Health',                                    total:      651_095 },
    { name: 'Social Services',                           total:       12_152 },
    { name: 'Protection of Persons and Property',        total:      532_953 },
    { name: 'General Government',                        total:      207_475 },
    { name: 'Debt Service - Interest and Other Charges', total:           11 },
  ]},
  2015: { total: 1_460_109, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation', total:        6_036 },
    { name: 'Education and Cultural Resources',    total:        5_335 },
    { name: 'Natural Resources and Recreation',    total:        7_353 },
    { name: 'Health',                              total:      730_217 },
    { name: 'Social Services',                     total:       13_606 },
    { name: 'Protection of Persons and Property',  total:      497_187 },
    { name: 'General Government',                  total:      200_375 },
  ]},
  2016: { total: 1_477_001, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        6_017 },
    { name: 'Education and Cultural Resources',          total:        2_806 },
    { name: 'Natural Resources and Recreation',          total:        5_904 },
    { name: 'Health',                                    total:      751_660 },
    { name: 'Social Services',                           total:       12_361 },
    { name: 'Protection of Persons and Property',        total:      512_069 },
    { name: 'General Government',                        total:      185_354 },
    { name: 'Debt Service - Principal Retirement',       total:           55 },
    { name: 'Debt Service - Interest and Other Charges', total:          775 },
  ]},
  2017: { total: 1_529_420, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        6_110 },
    { name: 'Education and Cultural Resources',          total:        2_720 },
    { name: 'Natural Resources and Recreation',          total:        5_757 },
    { name: 'Health',                                    total:      767_935 },
    { name: 'Social Services',                           total:       11_622 },
    { name: 'Protection of Persons and Property',        total:      527_828 },
    { name: 'General Government',                        total:      207_064 },
    { name: 'Debt Service - Principal Retirement',       total:          134 },
    { name: 'Debt Service - Interest and Other Charges', total:          250 },
  ]},
  2018: { total: 1_465_292, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        6_062 },
    { name: 'Education and Cultural Resources',          total:        2_643 },
    { name: 'Natural Resources and Recreation',          total:        3_820 },
    { name: 'Health',                                    total:      696_495 },
    { name: 'Social Services',                           total:       10_764 },
    { name: 'Protection of Persons and Property',        total:      534_638 },
    { name: 'General Government',                        total:      210_478 },
    { name: 'Debt Service - Principal Retirement',       total:          137 },
    // "Interest and Other Changes" (not "Charges") is VERIFIED as the label Alabama actually prints on the
    // Governmental Funds Rev/Exp/Fund-Balances statement from FY2018 through FY2025 (checked in _acfr-work/al/
    // AL2018–AL2025.txt: other statements in the same ACFRs still print "Charges", so this is AL's own caption
    // typo copied forward, not an extraction defect). Transcribed faithfully — do not "correct" to "Charges".
    { name: 'Debt Service - Interest and Other Changes', total:          255 },
  ]},
  2019: { total: 1_657_112, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        7_963 },
    { name: 'Education and Cultural Resources',          total:        2_534 },
    { name: 'Natural Resources and Recreation',          total:        4_260 },
    { name: 'Health',                                    total:      829_328 },
    { name: 'Social Services',                           total:       11_292 },
    { name: 'Protection of Persons and Property',        total:      588_178 },
    { name: 'General Government',                        total:      213_172 },
    { name: 'Debt Service - Principal Retirement',       total:          141 },
    { name: 'Debt Service - Interest and Other Changes', total:          244 },
  ]},
  2020: { total: 1_663_070, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        6_313 },
    { name: 'Education and Cultural Resources',          total:        2_700 },
    { name: 'Natural Resources and Recreation',          total:        6_097 },
    { name: 'Health',                                    total:      748_839 },
    { name: 'Social Services',                           total:        8_659 },
    { name: 'Protection of Persons and Property',        total:      620_572 },
    { name: 'General Government',                        total:      269_513 },
    { name: 'Debt Service - Principal Retirement',       total:          144 },
    { name: 'Debt Service - Interest and Other Changes', total:          233 },
  ]},
  2021: { total: 1_736_724, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        7_313 },
    { name: 'Education and Cultural Resources',          total:        5_082 },
    { name: 'Natural Resources and Recreation',          total:        6_376 },
    { name: 'Health',                                    total:      702_146 },
    { name: 'Social Services',                           total:       13_167 },
    { name: 'Protection of Persons and Property',        total:      693_377 },
    { name: 'General Government',                        total:      308_729 },
    { name: 'Debt Service - Principal Retirement',       total:          287 },
    { name: 'Debt Service - Interest and Other Changes', total:          247 },
  ]},
  2022: { total: 1_781_795, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:        8_035 },
    { name: 'Education and Cultural Resources',          total:        8_380 },
    { name: 'Natural Resources and Recreation',          total:       12_155 },
    { name: 'Health',                                    total:      732_523 },
    { name: 'Social Services',                           total:       15_033 },
    { name: 'Protection of Persons and Property',        total:      703_937 },
    { name: 'General Government',                        total:      297_865 },
    { name: 'Debt Service - Principal Retirement',       total:        3_059 },
    { name: 'Debt Service - Interest and Other Changes', total:          808 },
  ]},
  2023: { total: 2_055_968, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:       11_775 },
    { name: 'Education and Cultural Resources',          total:        9_542 },
    { name: 'Natural Resources and Recreation',          total:       12_464 },
    { name: 'Health',                                    total:      871_188 },
    { name: 'Social Services',                           total:       20_725 },
    { name: 'Protection of Persons and Property',        total:      797_598 },
    { name: 'General Government',                        total:      325_755 },
    { name: 'Debt Service - Principal Retirement',       total:        5_993 },
    { name: 'Debt Service - Interest and Other Changes', total:          928 },
  ]},
  2024: { total: 2_291_921, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:       29_486 },
    { name: 'Education and Cultural Resources',          total:       11_017 },
    { name: 'Natural Resources and Recreation',          total:       23_215 },
    { name: 'Health',                                    total:      952_818 },
    { name: 'Social Services',                           total:       26_251 },
    { name: 'Protection of Persons and Property',        total:      877_862 },
    { name: 'General Government',                        total:      363_564 },
    { name: 'Debt Service - Principal Retirement',       total:        6_650 },
    { name: 'Debt Service - Interest and Other Changes', total:        1_058 },
  ]},
  2025: { total: 2_597_406, confidence: 'actual', categories: [
    { name: 'Economic Development and Regulation',       total:       14_205 },
    { name: 'Education and Cultural Resources',          total:       10_536 },
    { name: 'Natural Resources and Recreation',          total:       23_356 },
    { name: 'Health',                                    total:    1_117_411 },
    { name: 'Social Services',                           total:       24_210 },
    { name: 'Protection of Persons and Property',        total:      958_584 },
    { name: 'General Government',                        total:      436_183 },
    { name: 'Capital Outlay',                            total:        1_058 },
    { name: 'Debt Service - Principal Retirement',       total:       10_558 },
    { name: 'Debt Service - Interest and Other Changes', total:        1_305 },
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
  return { jsonTree: [{ n: 'Alabama General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Alabama General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'al-acfr-gf-operating', base_url: 'https://comptroller.alabama.gov/acfr-2/', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId, fiscal_year_start_month: 10 };
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
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy), fiscal_year_start_month: 10 }).eq('id', bud.id);
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
