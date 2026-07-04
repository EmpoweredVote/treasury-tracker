#!/usr/bin/env node
/**
 * North Dakota General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of North Dakota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in dollars).
 *
 * Phase 113. Revenue is NEW on the ND state node → pure insert keyed (muni,fy,'revenue').
 *   ND state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-47): ND ACFR GF ~1.57x NASBO GF (FY2025 $4,510,201,793 vs FY2024 NASBO
 *   $2,876,000K) -- the MILDEST divergence in Batch 3. North Dakota's General Fund is dominated
 *   by own-source Sales and Use Taxes ($1,346,955,054 FY2025) + Oil, Gas, and Coal Taxes
 *   ($750,043,102 FY2025); most federal intergovernmental revenue ($2,678,818,384 per the
 *   recon) is booked to the separate "Federal" special-revenue fund column, not General
 *   (General's own "Intergovernmental" line is only $874,624 FY2025). Accepted-and-relabelled
 *   honestly (NE/OH/VA near-parity precedent).
 *
 * ANNUAL-VS-BIENNIAL RESOLVED (D-03/D-09 pre-flagged risk): North Dakota adopts its BUDGET
 *   biennially but publishes GAAP financials ANNUALLY -- omb.nd.gov's ACFR landing page lists a
 *   distinct, individually-dated single-year ACFR for every FY2021-FY2025, confirmed audited
 *   annual GAAP statements (June 30 FY-end). Each FY loaded as a distinct single-year actual --
 *   no biennium is split or doubled, no FY-attribution exception. The D-03 biennial-budget
 *   concern does NOT apply to the audited ACFR.
 *
 * UNITS = DOLLARS, NOT THOUSANDS (the ND units trap) -- ND's printed statement is already in
 *   whole dollars. UNITS=1 hard-set; bookends asserted at load: FY2025 $4,510,201,793 /
 *   FY2021 $3,955,670,947 (both sides, $0 diff on revenues AND expenditures, confirmed on all
 *   5 loaded years).
 *
 * DERIVABLE URL WITH ONE EXCEPTION (the ND naming trap): omb.nd.gov/sites/www/files/documents/
 *   financial-transparency/cafr/{YYYY}-acfr.pdf for FY2022-FY2025. FY2021 EXCEPTION adds an
 *   `-nd` suffix: 2021-acfr-nd.pdf (special-cased above). Landing:
 *   omb.nd.gov/financial-transparency/annual-comprehensive-financial-reports-acfr lists all 5
 *   years directly, no discovery needed.
 *
 * 5-COLUMN LAYOUT: GENERAL is the 1st of 5 (General | Federal [Special Revenue] | State
 *   [Special Revenue] | Nonmajor Governmental Funds | Total). extract_gf.py's position-anchor
 *   isolates General regardless of column count -- confirmed at both bookends (FY2025 rev
 *   $4,510,201,793 / FY2021 rev $3,955,670,947, exact $0 diff on BOTH revenues and
 *   expenditures) and on all 5 loaded years.
 *
 * CLEAN EXTRACTION: all 5 years FY2021-FY2025 tied to $0 diff on BOTH the revenue and
 *   expenditure printed GENERAL FUND totals on the FIRST extraction pass -- zero honest holes,
 *   no wrapped labels beyond normal whitespace collapse (pdftotext renders "Individual and
 *   Corporate Income Taxes" with 1-4 stray internal spaces across different years --
 *   gen_state.py's norm() collapses runs of whitespace generically, no per-year patch needed),
 *   no rev_boundary sub-heading complications (ND's revenue lines carry no sub-heading at all,
 *   sub=None throughout -- every tax line already ends in the word "Taxes" in ND's own printed
 *   labels). Expenditures carry a single "Current" + "Debt Service" subsection pair with no
 *   dual-subsection collision (FY2023's null-valued "Bond and Note Cost of Issuance" line is
 *   dropped by the standard v-is-None filter, no phantom zero-row).
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Interest and Investment Income (Loss)" went NEGATIVE in FY2022 only: -$897,827,062 (dollars) -- a real GAAP fair-value-of-investments loss, not an extraction artifact. Both bookend years are positive (FY2025 +$1,595,980,317 / FY2021 +$1,674,078,872, matching the recon's "none observed in either bookend" finding -- the negative is an interior-year discovery made during this load, the P2 clamp exercise for ND). The P2 clamp is the render path for FY2022; no year shows a negative GF Total.
 *
 * UNITS = dollars (already dollars, no scaling). Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 dollars; extraction: pdftotext -table
 *   on local copies in _acfr-work/nd/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processNDRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'North Dakota'; const STATE_ABBR = 'ND'; const POPULATION = 779_094;
const EXPECTED_MUNI_ID = 'e84aafe0-eeaa-470a-8fd3-708c88af2a80';
const UNITS = 1; // ND ACFR is in dollars (already dollars — no scaling)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2021: { url: 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2021-acfr-nd.pdf', date: '2021-06-30' },
  2022: { url: 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2022-acfr.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2023-acfr.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2024-acfr.pdf', date: '2024-06-30' },
  2025: { url: 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2025-acfr.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `North Dakota State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — ND ACFR, GENERAL FUND column (raw dollars; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2021: { total: 3_955_670_947, confidence: 'actual', categories: [
    { name: 'Individual and Corporate Income Taxes', total:  568_578_886 },
    { name: 'Sales and Use Taxes',                   total: 1_049_848_144 },
    { name: 'Oil, Gas, and Coal Taxes',              total:  557_025_690 },
    { name: 'Business and Other Taxes',              total:   64_971_188 },
    { name: 'Licenses, Permits and Fees',            total:    9_681_484 },
    { name: 'Intergovernmental',                     total:    1_000_090 },
    { name: 'Sales and Services',                    total:    3_651_026 },
    { name: 'Royalties and Rents',                   total:   18_668_831 },
    { name: 'Fines and Forfeits',                    total:    4_322_710 },
    { name: 'Interest and Investment Income',        total: 1_674_078_872 },
    { name: 'Tobacco Settlement',                    total:        5_371 },
    { name: 'Miscellaneous',                         total:    3_838_655 },
  ]},
  2022: { total: 2_408_848_192, confidence: 'actual', categories: [
    { name: 'Individual and Corporate Income Taxes', total:  659_548_773 },
    { name: 'Sales and Use Taxes',                   total: 1_166_033_313 },
    { name: 'Oil, Gas, and Coal Taxes',              total: 1_354_249_531 },
    { name: 'Business and Other Taxes',              total:   64_143_069 },
    { name: 'Licenses, Permits and Fees',            total:    9_909_121 },
    { name: 'Intergovernmental',                     total:      981_677 },
    { name: 'Sales and Services',                    total:    2_345_312 },
    { name: 'Royalties and Rents',                   total:   41_368_353 },
    { name: 'Fines and Forfeits',                    total:    3_969_358 },
    { name: 'Interest and Investment Income (Loss)', total: -897_827_062 },
    { name: 'Tobacco Settlement',                    total:       10_809 },
    { name: 'Miscellaneous',                         total:    4_115_938 },
  ]},
  2023: { total: 3_950_313_589, confidence: 'actual', categories: [
    { name: 'Individual and Corporate Income Taxes', total:  803_991_790 },
    { name: 'Sales and Use Taxes',                   total: 1_398_395_757 },
    { name: 'Oil, Gas, and Coal Taxes',              total:  864_764_539 },
    { name: 'Business and Other Taxes',              total:   64_253_350 },
    { name: 'Licenses, Permits and Fees',            total:   10_249_762 },
    { name: 'Intergovernmental',                     total:      834_170 },
    { name: 'Sales and Services',                    total:    3_331_452 },
    { name: 'Royalties and Rents',                   total:   48_683_282 },
    { name: 'Fines and Forfeits',                    total:    2_780_094 },
    { name: 'Interest and Investment Income',        total:  744_847_324 },
    { name: 'Tobacco Settlement',                    total:       11_352 },
    { name: 'Miscellaneous',                         total:    8_170_717 },
  ]},
  2024: { total: 4_782_318_061, confidence: 'actual', categories: [
    { name: 'Individual and Corporate Income Taxes', total:  623_453_421 },
    { name: 'Sales and Use Taxes',                   total: 1_309_222_492 },
    { name: 'Oil, Gas, and Coal Taxes',              total: 1_504_367_919 },
    { name: 'Business and Other Taxes',              total:   57_783_455 },
    { name: 'Licenses, Permits and Fees',            total:   10_928_309 },
    { name: 'Intergovernmental',                     total:      734_752 },
    { name: 'Sales and Services',                    total:    2_198_366 },
    { name: 'Royalties and Rents',                   total:   43_535_837 },
    { name: 'Fines and Forfeits',                    total:    3_253_947 },
    { name: 'Interest and Investment Income',        total: 1_210_786_667 },
    { name: 'Miscellaneous',                         total:   16_052_896 },
  ]},
  2025: { total: 4_510_201_793, confidence: 'actual', categories: [
    { name: 'Individual and Corporate Income Taxes', total:  712_367_662 },
    { name: 'Sales and Use Taxes',                   total: 1_346_955_054 },
    { name: 'Oil, Gas, and Coal Taxes',              total:  750_043_102 },
    { name: 'Business and Other Taxes',              total:   50_906_678 },
    { name: 'Licenses, Permits and Fees',            total:   10_389_720 },
    { name: 'Intergovernmental',                     total:      874_624 },
    { name: 'Sales and Services',                    total:    2_960_005 },
    { name: 'Royalties and Rents',                   total:   29_733_562 },
    { name: 'Fines and Forfeits',                    total:    3_286_914 },
    { name: 'Interest and Investment Income',        total: 1_595_980_317 },
    { name: 'Miscellaneous',                         total:    6_704_155 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [dollars]`); ok = false; }
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
  return { jsonTree: [{ n: 'North Dakota General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, dollars×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'North Dakota General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'nd-acfr-gf-revenue', base_url: 'https://www.omb.nd.gov/financial-transparency/annual-comprehensive-financial-reports-acfr', fiscal_years: [2021,2022,2023,2024,2025], municipality_id: muniId };
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
