#!/usr/bin/env node
/**
 * West Virginia General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of West Virginia Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the WV state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
 *   WV state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-52): WV ACFR GF ~3.52x NASBO GF (FY2024 $13,670,366K vs FY2024 NASBO
 *   $4,164,000K) -- the 2nd-widest divergence in Batch 4 (behind OK's ~3.35x -- actually the
 *   WIDEST by dollar-ratio in this batch). West Virginia's General Fund consolidates nearly all
 *   state general-purpose taxes AND the large Intergovernmental (federal-passthrough) line
 *   ($6,918,845K FY2025, ~47% of GF total revenues) into a single fund column, whereas NASBO's
 *   narrower budgetary concept excludes most of that federal-passthrough activity. Accepted-
 *   and-relabelled honestly (OK/MS/TX precedent), documented prominently.
 *
 * OPAQUE DRUPAL MEDIA-ID URLS (no derivable pattern, RI/NC/GA precedent): every year's ACFR is
 *   served at a non-derivable finance.wv.gov/media/{id}/download?inline path -- all 6 URLs read
 *   directly off the landing page (https://finance.wv.gov/annual-comprehensive-financial-report-acfr)
 *   and verified individually (%PDF magic + size >5MB, all 6 years). Landing page re-checked live
 *   at load time (2026-07-05) -- confirmed still exactly the 6 known media IDs, no newly-added
 *   older years discoverable.
 *
 * SINGLE "Taxes:" HEADER (SC/MS/MT precedent, WV's own instance): WV's printed statement puts
 *   one "Taxes:" subsection header ahead of ALL revenue line items (confirmed across all 6
 *   loaded years FY2020-FY2025) with no closing header before the non-tax lines that follow.
 *   rev_boundary='Intergovernmental' clears the sub-heading at the first genuinely non-tax line
 *   (present in the same position every loaded year, immediately after the tax lines) so only
 *   the true tax lines (Personal Income, Consumer Sales and Use, Severance, Corporate Net
 *   Income, Business and Occupation, Medicaid, catch-all "Other") get the " taxes" suffix --
 *   "Intergovernmental" is never mislabeled "Intergovernmental taxes". A second catch-all
 *   "Other" line prints AFTER the boundary (non-tax, stays plain "Other") -- no name collision
 *   with the pre-boundary "Other Taxes".
 *
 * 5-COLUMN LAYOUT: GENERAL is the 1st of 5 (General | Transportation | Tobacco Settlement
 *   Finance Authority | State Road | Other Governmental Funds | Total). extract_gf.py's
 *   position-anchor isolates General regardless of the total column count -- confirmed at both
 *   bookends (FY2025 rev $14,639,897K / FY2020 rev $10,760,376K, exact $0 diff on BOTH revenues
 *   and expenditures) and on all 6 loaded years.
 *
 * CATEGORY-NAME EVOLUTION (real GAAP relabeling across the 6-year window, not extraction
 *   defects -- confirmed against each year's own raw statement text): the SNAP/food-assistance
 *   revenue line reads "Food Stamp Revenue" FY2020-FY2022, then "SNAP Revenue" FY2023-FY2025
 *   (same underlying program). On the expenditure side, "Military Affairs and Public Safety"
 *   (FY2020) becomes "Homeland Security" (FY2021+); "Health and Human Resources" (FY2020-2023)
 *   becomes "Health, Health Facilities, and Human Services" (FY2024-2025); several functions
 *   (Arts/Culture/History, Economic Development, Employment Programs, Environmental Protection,
 *   Tourism) appear/disappear across years as the state reorganizes agency reporting lines --
 *   every year still ties exactly to its own printed GF total regardless of naming drift.
 *
 * CLEAN EXTRACTION: all 6 years FY2020-FY2025 tied to $0 diff on BOTH the revenue and
 *   expenditure printed GENERAL column totals on the FIRST extraction pass -- zero honest
 *   holes, zero hand-patches. Bookends: FY2025 rev 14,639,897 / exp 15,065,132; FY2020 rev
 *   10,760,376 / exp 10,752,235 (all four $0 diff).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment Earnings" went NEGATIVE in FY2022 only: -92,660K (thousands) -- a real GAAP fair-value-of-investments loss, confirmed printed as "(92,660)" in the source PDF, not an extraction artifact. Every other loaded year is positive (FY2025 +352,526K / FY2020 +96,028K, the recon-confirmed bookends -- both already flagged clean in the 117 recon). The P2 clamp is the render path for FY2022; no year shows a negative GF Total revenues.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/wv/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processWVAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'West Virginia'; const STATE_ABBR = 'WV'; const POPULATION = 1_775_156;
const EXPECTED_MUNI_ID = 'e21923d7-ad99-4711-b765-255b9807c059';
const UNITS = 1_000; // WV ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2020: { url: 'https://finance.wv.gov/media/10646/download?inline', date: '2020-06-30' },
  2021: { url: 'https://finance.wv.gov/media/10521/download?inline', date: '2021-06-30' },
  2022: { url: 'https://finance.wv.gov/media/10236/download?inline', date: '2022-06-30' },
  2023: { url: 'https://finance.wv.gov/media/10251/download?inline', date: '2023-06-30' },
  2024: { url: 'https://finance.wv.gov/media/10261/download?inline', date: '2024-06-30' },
  2025: { url: 'https://finance.wv.gov/media/37441/download?inline', date: '2025-06-30' },
};
const dataSource = (fy) => `West Virginia State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — WV ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2020: { total: 10_752_235, confidence: 'actual', categories: [
    { name: 'Legislative',                        total:       21_756 },
    { name: 'Judicial',                           total:      137_777 },
    { name: 'Executive',                          total:      374_699 },
    { name: 'Administration',                     total:      146_844 },
    { name: 'Commerce',                           total:      220_882 },
    { name: 'Education',                          total:    3_088_635 },
    { name: 'Health and Human Resources',         total:    6_018_370 },
    { name: 'Military Affairs and Public Safety', total:      566_560 },
    { name: 'Revenue',                            total:       51_190 },
    { name: 'Transportation',                     total:       37_051 },
    { name: 'Veterans Assistance',                total:       21_516 },
    { name: 'Senior Services',                    total:       48_651 },
    { name: 'Regulatory Boards and Commissions',  total:       18_304 },
  ]},
  2021: { total: 12_419_500, confidence: 'actual', categories: [
    { name: 'Legislative',                       total:       24_440 },
    { name: 'Judicial',                          total:      135_586 },
    { name: 'Executive',                         total:      843_107 },
    { name: 'Administration',                    total:       99_863 },
    { name: 'Commerce',                          total:      289_378 },
    { name: 'Environmental Protection',          total:          305 },
    { name: 'Employment Programs',               total:       11_910 },
    { name: 'Education',                         total:    3_109_129 },
    { name: 'Health and Human Resources',        total:    7_018_893 },
    { name: 'Homeland Security',                 total:      568_532 },
    { name: 'Revenue',                           total:      117_699 },
    { name: 'Transportation',                    total:       13_002 },
    { name: 'Veterans Assistance',               total:       21_024 },
    { name: 'Senior Services',                   total:       54_576 },
    { name: 'Regulatory Boards and Commissions', total:      112_056 },
  ]},
  2022: { total: 14_086_000, confidence: 'actual', categories: [
    { name: 'Legislative',                           total:       27_080 },
    { name: 'Judicial',                              total:      150_671 },
    { name: 'Executive',                             total:      785_832 },
    { name: 'Administration',                        total:      158_455 },
    { name: 'Commerce',                              total:      186_761 },
    { name: 'Environmental Protection',              total:            1 },
    { name: 'Economic Development',                  total:      473_062 },
    { name: 'Education',                             total:    3_175_358 },
    { name: 'Arts, Culture, and History',            total:       36_735 },
    { name: 'Health and Human Resources',            total:    8_053_902 },
    { name: 'Homeland Security',                     total:      488_555 },
    { name: 'Revenue',                               total:       63_485 },
    { name: 'Tourism',                               total:       35_508 },
    { name: 'Transportation',                        total:       11_211 },
    { name: 'Veterans Assistance',                   total:       22_198 },
    { name: 'Senior Services',                       total:       52_603 },
    { name: 'Regulatory Boards and Commissions',     total:      346_921 },
    { name: 'Debt service — Right-to-Use Principal', total:       14_700 },
    { name: 'Debt service — Right-to-Use Interest',  total:        2_962 },
  ]},
  2023: { total: 15_250_429, confidence: 'actual', categories: [
    { name: 'Legislative',                           total:       25_330 },
    { name: 'Judicial',                              total:      148_943 },
    { name: 'Executive',                             total:      377_969 },
    { name: 'Administration',                        total:      157_514 },
    { name: 'Commerce',                              total:      224_965 },
    { name: 'Environmental Protection',              total:            1 },
    { name: 'Economic Development',                  total:      108_816 },
    { name: 'Education',                             total:    3_330_197 },
    { name: 'Arts, Culture, and History',            total:       36_829 },
    { name: 'Health and Human Resources',            total:    8_325_854 },
    { name: 'Homeland Security',                     total:      611_915 },
    { name: 'Revenue',                               total:      114_243 },
    { name: 'Tourism',                               total:       30_533 },
    { name: 'Transportation',                        total:      173_598 },
    { name: 'Veterans Assistance',                   total:       25_916 },
    { name: 'Senior Services',                       total:       55_449 },
    { name: 'Regulatory Boards and Commissions',     total:    1_480_703 },
    { name: 'Debt service — Right-to-Use Principal', total:       18_132 },
    { name: 'Debt service — Right-to-Use Interest',  total:        3_522 },
  ]},
  2024: { total: 14_141_182, confidence: 'actual', categories: [
    { name: 'Legislative',                                   total:       35_934 },
    { name: 'Judicial',                                      total:      160_133 },
    { name: 'Executive',                                     total:      385_192 },
    { name: 'Administration',                                total:      160_489 },
    { name: 'Commerce',                                      total:      338_214 },
    { name: 'Economic Development',                          total:      119_311 },
    { name: 'Education',                                     total:    3_817_309 },
    { name: 'Arts, Culture, and History',                    total:       39_267 },
    { name: 'Health, Health Facilities, and Human Services', total:    7_561_303 },
    { name: 'Homeland Security',                             total:      665_802 },
    { name: 'Revenue',                                       total:      207_525 },
    { name: 'Tourism',                                       total:       29_449 },
    { name: 'Transportation',                                total:      326_583 },
    { name: 'Veterans Assistance',                           total:       31_494 },
    { name: 'Senior Services',                               total:       54_270 },
    { name: 'Regulatory Boards and Commissions',             total:      186_964 },
    { name: 'Debt service — Right-to-Use Principal',         total:       18_359 },
    { name: 'Debt service — Right-to-Use Interest',          total:        3_584 },
  ]},
  2025: { total: 15_065_132, confidence: 'actual', categories: [
    { name: 'Legislative',                                   total:       31_612 },
    { name: 'Judicial',                                      total:      171_480 },
    { name: 'Executive',                                     total:      751_353 },
    { name: 'Administration',                                total:      159_149 },
    { name: 'Commerce',                                      total:      308_672 },
    { name: 'Economic Development',                          total:      100_442 },
    { name: 'Education',                                     total:    3_379_559 },
    { name: 'Arts, Culture, and History',                    total:       40_943 },
    { name: 'Health, Health Facilities, and Human Services', total:    8_834_785 },
    { name: 'Homeland Security',                             total:      735_839 },
    { name: 'Revenue',                                       total:      108_789 },
    { name: 'Tourism',                                       total:       29_130 },
    { name: 'Transportation',                                total:       16_098 },
    { name: 'Veterans Assistance',                           total:       29_899 },
    { name: 'Senior Services',                               total:       54_909 },
    { name: 'Regulatory Boards and Commissions',             total:      289_637 },
    { name: 'Debt service — Right-to-Use Principal',         total:       19_135 },
    { name: 'Debt service — Right-to-Use Interest',          total:        3_701 },
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
  return { jsonTree: [{ n: 'West Virginia General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !EXPENDITURES[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(EXPENDITURES).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'West Virginia General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'wv-acfr-gf-operating', base_url: 'https://finance.wv.gov/annual-comprehensive-financial-report-acfr', fiscal_years: [2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
