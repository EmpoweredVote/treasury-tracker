#!/usr/bin/env node
/**
 * Florida General Fund Operating (Expenditure) Loader — FY2021-FY2024 ACTUAL
 * Source: State of Florida Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Florida Dept. of Financial Services (DFS).
 *   Per-FY source URL below (myfloridacfo.com cafr/fye-{YYYY}-…).
 *
 * Phase 100 (ACFR-04). Replaces the NASBO operating rows on the FL state node in place
 *   (same (muni,fy,'operating') RPC key). FL state node id (D-05):
 *   adb19ea0-de7c-4cd5-9445-cbf2108a8a1a.
 *   NOTE: filename is processFLAcfr.js (NOT processFL.js) — the legacy v1.7 flsenate.gov GRF
 *   operating loader still lives at scripts/processFL.js (dead/superseded); this ACFR loader
 *   is the Phase-100 replacement and does not clobber it.
 *
 * UNITS = thousands (D-06): ×1,000 to store dollars (same as CA). FL is a like-for-like GF
 *   (no TX-style scope mismatch): FY2024 ACFR exp $50.1B vs NASBO budgetary $51.6B.
 *
 * Control = printed General-Fund-column "Total expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total (in thousands) or the loader
 *   refuses to write (process.exit(2)). The GENERAL FUND value is the 1st numeric token per
 *   row (the `-table` layout indents smaller numbers, but the per-FY sum ties exactly).
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/fl/ (NOT -layout).
 *   All 4 years tie to 0 diff vs. the printed General-Fund Total expenditures.
 *
 * Usage:
 *   node scripts/processFLAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Florida'; const STATE_ABBR = 'FL'; const POPULATION = 21_538_187;
const STATE_NODE_ID = 'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a'; // D-05: upgrade this node in place
const UNITS = 1_000; // FL ACFR is in thousands → ×1,000 to store dollars (D-06)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const FL_BASE = 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr';
const SOURCES = Object.fromEntries(
  [2021, 2022, 2023, 2024].map(fy => [fy, { url: `${FL_BASE}/fye-${fy}-state-of-florida-annual-comprehensive-financial-report.pdf`, date: `${fy}-06-30` }])
);
const dataSource = (fy) => `Florida State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — FL ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim ACFR function names. total = printed General-Fund "Total expenditures" (thousands).
// 0-diff verified. Zero-value lines (Transportation FY2021) omitted.
const EXPENDITURES = {
  2021: { total: 37_277_963, confidence: 'actual', categories: [
    { name: 'General government',                  total:  4_241_011 },
    { name: 'Education',                           total: 18_113_925 },
    { name: 'Human services',                      total:  9_728_416 },
    { name: 'Criminal justice and corrections',    total:  3_981_348 },
    { name: 'Natural resources and environment',   total:    585_437 },
    { name: 'Judicial branch',                     total:    479_173 },
    { name: 'Capital outlay',                      total:    125_822 },
    { name: 'Debt service — Principal retirement', total:     19_732 },
    { name: 'Debt service — Interest and fiscal charges', total: 3_099 },
  ]},
  2022: { total: 36_205_183, confidence: 'actual', categories: [
    { name: 'General government',                  total:  5_149_229 },
    { name: 'Education',                           total: 15_922_607 },
    { name: 'Human services',                      total:  8_934_421 },
    { name: 'Criminal justice and corrections',    total:  4_309_468 },
    { name: 'Natural resources and environment',   total:    666_485 },
    { name: 'Transportation',                      total:     10_086 },
    { name: 'Judicial branch',                     total:    423_423 },
    { name: 'Capital outlay',                      total:    771_357 },
    { name: 'Debt service — Principal retirement', total:      9_072 },
    { name: 'Debt service — Interest and fiscal charges', total: 9_035 },
  ]},
  2023: { total: 44_464_013, confidence: 'actual', categories: [
    { name: 'General government',                  total:  7_355_881 },
    { name: 'Education',                           total: 18_974_755 },
    { name: 'Human services',                      total: 11_559_663 },
    { name: 'Criminal justice and corrections',    total:  4_447_386 },
    { name: 'Natural resources and environment',   total:    857_430 },
    { name: 'Transportation',                      total:      2_651 },
    { name: 'Judicial branch',                     total:    583_907 },
    { name: 'Capital outlay',                      total:    666_135 },
    { name: 'Debt service — Principal retirement', total:      9_548 },
    { name: 'Debt service — Interest and fiscal charges', total: 6_657 },
  ]},
  2024: { total: 50_141_014, confidence: 'actual', categories: [
    { name: 'General government',                  total:  7_382_582 },
    { name: 'Education',                           total: 21_161_284 },
    { name: 'Human services',                      total: 14_004_093 },
    { name: 'Criminal justice and corrections',    total:  5_274_779 },
    { name: 'Natural resources and environment',   total:  1_015_750 },
    { name: 'Transportation',                      total:     49_437 },
    { name: 'Judicial branch',                     total:    642_479 },
    { name: 'Capital outlay',                      total:    504_286 },
    { name: 'Debt service — Principal retirement', total:     98_779 },
    { name: 'Debt service — Interest and fiscal charges', total: 7_545 },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total * UNITS, i: [] }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Florida General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId = STATE_NODE_ID;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('id', STATE_NODE_ID).single();
    if (error || !muni) { console.error(`${STATE_NAME} state node ${STATE_NODE_ID} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Florida General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'fl-acfr-gf-operating', base_url: 'https://www.myfloridacfo.com/transparency', fiscal_years: [2021,2022,2023,2024], municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL EXPENDITURES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} operating row (GAAP basis)\n`);
    } else { console.error(`Could not find FY${fy} operating budget row to stamp source`); process.exit(2); }
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
