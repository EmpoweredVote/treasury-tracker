#!/usr/bin/env node
/**
 * Kansas General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Kansas Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the KS state node → pure insert keyed (muni,fy,'revenue').
 *   KS state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-39): KS ACFR GF ~1.11x NASBO GF (FY2025 $10,352,600K vs FY2024 NASBO
 *   $9,365,000K) -- the NARROWEST divergence in Batch 2. Kansas's Operating grants and Capital
 *   grants lines are BOTH $0 in the General column at every loaded year FY2019-FY2025 -- federal
 *   flows route through the separate Social Services / Health and Environment / Transportation /
 *   Executive / Commerce major-fund columns, not the General column. Accepted-and-relabelled
 *   honestly (NJ-precedent, modest divergence).
 *
 * WIDE 8-COLUMN LAYOUT: General is the 1st of 8 (General | Social Services | Health and
 *   Environment | Transportation | Executive | Commerce | Non-major Governmental | Total
 *   Governmental). extract_gf.py's position-anchor (right-edge of the FIRST numeric token on the
 *   'Total revenues' row) isolates General regardless of the total column count -- confirmed at
 *   both bookends (FY2025 $10,352,600K / FY2019 $7,539,362K, exact $0 diff) and re-confirmed on
 *   all 7 loaded years (uniform 9-revenue-category / 9-expenditure-category shape, zero name
 *   collisions, zero rev_boundary sub-heading complications -- KS's revenue lines carry no
 *   sub-heading at all, sub=None throughout).
 *
 * OPAQUE HASH URLS: admin.ks.gov serves every year's ACFR at a non-derivable
 *   /browse/files/{hash}/download path -- every URL below was read off the ACFR Reports category
 *   page (https://www.admin.ks.gov/.../categories/5cdd672f16a4499194349dadf359b1b3) and verified
 *   individually (%PDF magic + size >1.8MB, all 7 years), never guessed from the FY.
 *
 * SHALLOW WINDOW: FY2019-FY2025 (7 years) is the full durable window -- the current
 *   admin.ks.gov ACFR Reports category page does not list pre-FY2019 years. Not chased further
 *   this pass (EMMA historical-filing venue noted in recon as an unverified extension candidate).
 *   Zero honest holes within the window -- all 7 years tied exactly on the first extraction pass.
 *
 * CLEAN EXTRACTION: no wrapped labels, no ALL-CAPS source text, no dual-subsection name
 *   collisions -- the simplest cohort member extracted so far in this tranche.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): "Investment earnings" went NEGATIVE in FY2021 only: -3,712 (thousands) -- a real GAAP fair-value-of-investments loss, not an extraction artifact. Every other loaded year is positive (FY2025 +305,819K / FY2019 +36,370K, the recon-confirmed bookends). The P2 clamp is the render path for FY2021; no year shows a negative GF Total.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/ks/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processKSRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Kansas'; const STATE_ABBR = 'KS'; const POPULATION = 2_937_880;
const EXPECTED_MUNI_ID = 'bb3dcf05-586c-4e68-85d3-26a6199cc4ab';
const UNITS = 1_000; // KS ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2019: { url: 'https://www.admin.ks.gov/browse/files/2bd8990b55c94ceaa02fb136b6a2b111/download', date: '2019-06-30' },
  2020: { url: 'https://www.admin.ks.gov/browse/files/cf4e8d86320544d2a815531a87dbcb36/download', date: '2020-06-30' },
  2021: { url: 'https://www.admin.ks.gov/browse/files/7d8b648a351d481eaebd75655a44ea07/download', date: '2021-06-30' },
  2022: { url: 'https://www.admin.ks.gov/browse/files/ee6e0e7000bb4e5f957683878a938886/download', date: '2022-06-30' },
  2023: { url: 'https://www.admin.ks.gov/browse/files/aa7495fbfc7e4c02a9afe62e18c23305/download', date: '2023-06-30' },
  2024: { url: 'https://www.admin.ks.gov/browse/files/d74a7e638a0947d5bb8369a5d35ebb48/download', date: '2024-06-30' },
  2025: { url: 'https://www.admin.ks.gov/browse/files/d2d39a0deef8464faaba21b8f4e69a24/download', date: '2025-06-30' },
};
const dataSource = (fy) => `Kansas State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — KS ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2019: { total: 7_539_362, confidence: 'actual', categories: [
    { name: 'Property tax',               total:            4 },
    { name: 'Income and inheritance tax', total:    4_243_431 },
    { name: 'Sales and excise tax',       total:    3_052_192 },
    { name: 'Gross receipts tax',         total:      163_950 },
    { name: 'Charges for services',       total:       32_655 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:       36_370 },
    { name: 'Other revenues',             total:       10_760 },
  ]},
  2020: { total: 7_587_410, confidence: 'actual', categories: [
    { name: 'Property tax',               total:           13 },
    { name: 'Income and inheritance tax', total:    4_228_025 },
    { name: 'Sales and excise tax',       total:    3_113_300 },
    { name: 'Gross receipts tax',         total:      173_518 },
    { name: 'Charges for services',       total:       30_610 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:       28_306 },
    { name: 'Other revenues',             total:       13_638 },
  ]},
  2021: { total: 8_533_069, confidence: 'actual', categories: [
    { name: 'Property tax',               total:           47 },
    { name: 'Income and inheritance tax', total:    4_852_523 },
    { name: 'Sales and excise tax',       total:    3_445_273 },
    { name: 'Gross receipts tax',         total:      182_595 },
    { name: 'Charges for services',       total:       33_239 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:       -3_712 },
    { name: 'Other revenues',             total:       23_104 },
  ]},
  2022: { total: 9_772_911, confidence: 'actual', categories: [
    { name: 'Property tax',               total:            0 },
    { name: 'Income and inheritance tax', total:    5_719_921 },
    { name: 'Sales and excise tax',       total:    3_782_326 },
    { name: 'Gross receipts tax',         total:      201_284 },
    { name: 'Charges for services',       total:       48_530 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:        5_416 },
    { name: 'Other revenues',             total:       15_434 },
  ]},
  2023: { total: 10_512_729, confidence: 'actual', categories: [
    { name: 'Property tax',               total:          102 },
    { name: 'Income and inheritance tax', total:    6_050_670 },
    { name: 'Sales and excise tax',       total:    3_977_709 },
    { name: 'Gross receipts tax',         total:      193_207 },
    { name: 'Charges for services',       total:       80_652 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:      185_802 },
    { name: 'Other revenues',             total:       24_587 },
  ]},
  2024: { total: 10_237_246, confidence: 'actual', categories: [
    { name: 'Property tax',               total:            0 },
    { name: 'Income and inheritance tax', total:    5_849_125 },
    { name: 'Sales and excise tax',       total:    3_789_421 },
    { name: 'Gross receipts tax',         total:      221_753 },
    { name: 'Charges for services',       total:       60_308 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:      302_444 },
    { name: 'Other revenues',             total:       14_195 },
  ]},
  2025: { total: 10_352_600, confidence: 'actual', categories: [
    { name: 'Property tax',               total:           21 },
    { name: 'Income and inheritance tax', total:    5_981_722 },
    { name: 'Sales and excise tax',       total:    3_718_917 },
    { name: 'Gross receipts tax',         total:      218_826 },
    { name: 'Charges for services',       total:       71_832 },
    { name: 'Operating grants',           total:            0 },
    { name: 'Capital grants',             total:            0 },
    { name: 'Investment earnings',        total:      305_819 },
    { name: 'Other revenues',             total:       55_463 },
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
  return { jsonTree: [{ n: 'Kansas General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false }); // WR-05: mistyped flags must fail, never silently live-load
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  // WR-01 (re-review): reject --fy values that are not loadable years — an operator typo must exit non-zero, not print Done. as a silent no-op.
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !REVENUE[targetFY])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${Object.keys(REVENUE).join(', ')})`); process.exit(2); }
  const years = targetFY ? [targetFY] : [2019, 2020, 2021, 2022, 2023, 2024, 2025];
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
    const srcPayload = { name: 'Kansas General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ks-acfr-gf-revenue', base_url: 'https://www.admin.ks.gov/offices/accounts-reports/state-agencies/finance/annual-comprehensive-financial-report/annual-comprehensive-financial-report---acfr/categories/5cdd672f16a4499194349dadf359b1b3', fiscal_years: [2019,2020,2021,2022,2023,2024,2025], municipality_id: muniId };
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
