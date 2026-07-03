#!/usr/bin/env node
/**
 * Alabama General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Alabama Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the AL state node → pure insert keyed (muni,fy,'revenue').
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
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/al/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processALRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Alabama State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — AL ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2002: { total: 1_094_623, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:      890_276 },
    { name: 'Licenses, Permits, and Fees',            total:      121_345 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       18_199 },
    { name: 'Investment Income',                      total:       35_139 },
    { name: 'Other Revenues',                         total:       29_664 },
  ]},
  2003: { total: 1_117_171, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:      848_223 },
    { name: 'Licenses, Permits, and Fees',            total:      120_331 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       45_896 },
    { name: 'Investment Income',                      total:       20_501 },
    { name: 'Federal Grants and Reimbursements',      total:       75_612 },
    { name: 'Other Revenues',                         total:        6_608 },
  ]},
  2004: { total: 1_170_522, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:      903_902 },
    { name: 'Licenses, Permits, and Fees',            total:      130_165 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       19_176 },
    { name: 'Investment Income',                      total:       38_212 },
    { name: 'Federal Grants and Reimbursements',      total:       75_612 },
    { name: 'Other Revenues',                         total:        3_455 },
  ]},
  2005: { total: 1_292_117, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_070_226 },
    { name: 'Licenses, Permits, and Fees',            total:      139_585 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       20_422 },
    { name: 'Investment Income',                      total:       54_083 },
    { name: 'Other Revenues',                         total:        7_801 },
  ]},
  2006: { total: 1_465_052, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_172_943 },
    { name: 'Licenses, Permits, and Fees',            total:      143_414 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       22_829 },
    { name: 'Investment Income',                      total:      110_375 },
    { name: 'Federal Grants and Reimbursements',      total:          194 },
    { name: 'Other Revenues',                         total:       15_297 },
  ]},
  2007: { total: 1_466_968, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_132_578 },
    { name: 'Licenses, Permits, and Fees',            total:      149_728 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       24_156 },
    { name: 'Investment Income',                      total:      146_593 },
    { name: 'Federal Grants and Reimbursements',      total:          736 },
    { name: 'Other Revenues',                         total:       13_177 },
  ]},
  2008: { total: 1_548_046, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_159_828 },
    { name: 'Licenses, Permits, and Fees',            total:      159_733 },
    { name: 'Fines, Forfeits, and Court Settlements', total:      116_128 },
    { name: 'Investment Income',                      total:       90_181 },
    { name: 'Federal Grants and Reimbursements',      total:        3_378 },
    { name: 'Other Revenues',                         total:       18_798 },
  ]},
  2009: { total: 1_383_735, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_071_591 },
    { name: 'Licenses, Permits, and Fees',            total:      155_910 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       76_837 },
    { name: 'Investment Income',                      total:       35_560 },
    { name: 'Federal Grants and Reimbursements',      total:          875 },
    { name: 'Other Revenues',                         total:       42_962 },
  ]},
  2010: { total: 1_233_189, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_023_088 },
    { name: 'Licenses, Permits, and Fees',            total:      157_326 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       24_191 },
    { name: 'Investment Income',                      total:       24_177 },
    { name: 'Federal Grants and Reimbursements',      total:        1_549 },
    { name: 'Other Revenues',                         total:        2_858 },
  ]},
  2011: { total: 1_257_565, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_042_376 },
    { name: 'Licenses, Permits, and Fees',            total:      155_170 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       38_625 },
    { name: 'Investment Income',                      total:       16_848 },
    { name: 'Federal Grants and Reimbursements',      total:        2_856 },
    { name: 'Other Revenues',                         total:        1_690 },
  ]},
  2012: { total: 1_310_652, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_095_704 },
    { name: 'Licenses, Permits, and Fees',            total:      156_142 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       26_375 },
    { name: 'Investment Income',                      total:       15_699 },
    { name: 'Federal Grants and Reimbursements',      total:        2_724 },
    { name: 'Other Revenues',                         total:       14_008 },
  ]},
  2013: { total: 1_405_981, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_210_064 },
    { name: 'Licenses, Permits, and Fees',            total:      153_155 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       19_152 },
    { name: 'Investment Income',                      total:       15_575 },
    { name: 'Federal Grants and Reimbursements',      total:        2_134 },
    { name: 'Other Revenues',                         total:        5_901 },
  ]},
  2014: { total: 1_416_050, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_232_136 },
    { name: 'Licenses, Permits, and Fees',            total:      152_786 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       15_614 },
    { name: 'Investment Income',                      total:       11_921 },
    { name: 'Federal Grants and Reimbursements',      total:        1_969 },
    { name: 'Other Revenues',                         total:        1_624 },
  ]},
  2015: { total: 1_460_576, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_274_896 },
    { name: 'Licenses, Permits, and Fees',            total:      155_390 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       15_518 },
    { name: 'Investment Income',                      total:       10_610 },
    { name: 'Federal Grants and Reimbursements',      total:        1_697 },
    { name: 'Other Revenues',                         total:        2_465 },
  ]},
  2016: { total: 1_684_229, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_419_023 },
    { name: 'Licenses, Permits, and Fees',            total:      159_976 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       84_726 },
    { name: 'Investment Income',                      total:        9_409 },
    { name: 'Federal Grants and Reimbursements',      total:        8_538 },
    { name: 'Other Revenues',                         total:        2_557 },
  ]},
  2017: { total: 1_769_555, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_480_892 },
    { name: 'Licenses, Permits, and Fees',            total:      161_178 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       72_341 },
    { name: 'Investment Income',                      total:       15_185 },
    { name: 'Federal Grants and Reimbursements',      total:       39_294 },
    { name: 'Other Revenues',                         total:          665 },
  ]},
  2018: { total: 1_775_997, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_567_128 },
    { name: 'Licenses, Permits, and Fees',            total:      162_372 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       13_921 },
    { name: 'Investment Income',                      total:       31_997 },
    { name: 'Federal Grants and Reimbursements',      total:           15 },
    { name: 'Other Revenues',                         total:          564 },
  ]},
  2019: { total: 1_938_768, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_693_705 },
    { name: 'Licenses, Permits, and Fees',            total:      167_961 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       12_705 },
    { name: 'Investment Income',                      total:       63_630 },
    { name: 'Other Revenues',                         total:          767 },
  ]},
  2020: { total: 2_090_839, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    1_860_793 },
    { name: 'Licenses, Permits, and Fees',            total:      164_186 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       11_942 },
    { name: 'Investment Income',                      total:       52_383 },
    { name: 'Federal Grants and Reimbursements',      total:           61 },
    { name: 'Other Revenues',                         total:        1_474 },
  ]},
  2021: { total: 2_344_449, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    2_089_690 },
    { name: 'Licenses, Permits, and Fees',            total:      181_275 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       14_311 },
    { name: 'Investment Income',                      total:       19_384 },
    { name: 'Other Revenues',                         total:       39_789 },
  ]},
  2022: { total: 2_616_214, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    2_370_496 },
    { name: 'Licenses, Permits, and Fees',            total:      183_289 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       15_175 },
    { name: 'Investment Income',                      total:       40_411 },
    { name: 'Other Revenues',                         total:        6_843 },
  ]},
  2023: { total: 3_060_733, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    2_431_610 },
    { name: 'Licenses, Permits, and Fees',            total:      190_260 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       16_644 },
    { name: 'Investment Income',                      total:      418_737 },
    { name: 'Other Revenues',                         total:        3_482 },
  ]},
  2024: { total: 3_262_681, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    2_476_722 },
    { name: 'Licenses, Permits, and Fees',            total:      205_949 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       17_224 },
    { name: 'Investment Income',                      total:      559_074 },
    { name: 'Other Revenues',                         total:        3_712 },
  ]},
  2025: { total: 3_399_417, confidence: 'actual', categories: [
    { name: 'Taxes',                                  total:    2_657_155 },
    { name: 'Licenses, Permits, and Fees',            total:      205_330 },
    { name: 'Fines, Forfeits, and Court Settlements', total:       17_191 },
    { name: 'Investment Income',                      total:      518_107 },
    { name: 'Other Revenues',                         total:        1_634 },
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
  return { jsonTree: [{ n: 'Alabama General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
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
    const srcPayload = { name: 'Alabama General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'al-acfr-gf-revenue', base_url: 'https://comptroller.alabama.gov/acfr-2/', fiscal_years: [2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId, fiscal_year_start_month: 10 };
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
      const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
      if (bud?.id) {
        const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy), fiscal_year_start_month: 10 }).eq('id', bud.id);
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
