#!/usr/bin/env node
/**
 * Florida General Fund Revenue (by source) Loader — FY2021-FY2024 ACTUAL
 * Source: State of Florida Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Florida Dept. of Financial Services (DFS).
 *
 * Phase 100 (ACFR-04 + ACFR-05). Revenue is NEW on the FL state node (NASBO had no
 *   revenue-by-source) → pure insert keyed (muni,fy,'revenue'). FL state node id (D-05):
 *   adb19ea0-de7c-4cd5-9445-cbf2108a8a1a.
 *
 * UNITS = thousands (D-06): ×1,000 to store dollars.
 *
 * Control = printed General-Fund-column "Total revenues". Each FY's transcribed rev-by-source
 *   categories must tie to the printed Total (thousands) or the loader refuses to write
 *   (process.exit(2)). Bookends (recon-confirmed): FY2021 46,989,188k; FY2022 57,241,428k;
 *   FY2024 59,810,603k.
 *
 * P2 clamp (ACFR-05 / ACFR-08): FL FY2022 has TWO negative GF revenue categories —
 *   "Investment earnings (losses)" −1,573,844k and "Other" −56,189k. FL FY2021 has ONE —
 *   "Investment earnings (losses)" −398,287k. Each renders at 0 area with the true signed
 *   value preserved in the label; the FY total carries the net (which already nets the
 *   negatives). FY2021 is the Phase 104 clamp demonstration (ACFR-08).
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-tmp/fl/ (NOT -layout). The
 *   GENERAL FUND value is the 1st numeric token per row. All 4 years tie to 0 diff.
 *
 * Usage:
 *   node scripts/processFLRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NODE_ID = 'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a'; // D-05
const UNITS = 1_000; // thousands → dollars (D-06)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const FL_BASE = 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr';
const SOURCES = Object.fromEntries(
  [2021, 2022, 2023, 2024].map(fy => [fy, { url: `${FL_BASE}/fye-${fy}-state-of-florida-annual-comprehensive-financial-report.pdf`, date: `${fy}-06-30` }])
);
const dataSource = (fy) => `Florida State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF net revenues by source — FL ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim ACFR source names. total = printed General-Fund "Total revenues". 0-diff verified.
// FY2021 has negative "Investment earnings (losses)" → P2 clamp fires (ACFR-08, Phase 104).
// FY2022 has negative "Investment earnings (losses)" + "Other" → P2 clamp fires (ACFR-05).
const REVENUE = {
  2021: { total: 46_989_188, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 41_873_817 },
    { name: 'Licenses and permits',                        total:    272_136 },
    { name: 'Fees and charges',                            total:  1_629_633 },
    { name: 'Grants and donations',                        total:  3_068_898 },
    { name: 'Investment earnings (losses)',                total:   -398_287 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    526_221 },
    { name: 'Other',                                       total:     16_770 },
  ]},
  2022: { total: 57_241_428, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 51_757_327 },
    { name: 'Licenses and permits',                        total:    450_317 },
    { name: 'Fees and charges',                            total:  1_690_723 },
    { name: 'Grants and donations',                        total:  4_787_704 },
    { name: 'Investment earnings (losses)',                total: -1_573_844 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    185_390 },
    { name: 'Other',                                       total:    -56_189 },
  ]},
  2023: { total: 59_446_062, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 54_259_527 },
    { name: 'Licenses and permits',                        total:    242_256 },
    { name: 'Fees and charges',                            total:  1_727_882 },
    { name: 'Grants and donations',                        total:  1_563_847 },
    { name: 'Investment earnings (losses)',                total:  1_126_538 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    351_678 },
    { name: 'Other',                                       total:    174_334 },
  ]},
  2024: { total: 59_810_603, confidence: 'actual', categories: [
    { name: 'Taxes',                                       total: 54_521_794 },
    { name: 'Licenses and permits',                        total:    428_481 },
    { name: 'Fees and charges',                            total:  1_735_524 },
    { name: 'Grants and donations',                        total:     26_448 },
    { name: 'Investment earnings (losses)',                total:  2_551_901 },
    { name: 'Fines, forfeits, settlements and judgments',  total:    431_592 },
    { name: 'Other',                                       total:    114_863 },
  ]},
};

// P2: clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Florida General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2021, 2022, 2023, 2024];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Florida General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'fl-acfr-gf-revenue', base_url: 'https://www.myfloridacfo.com/transparency', fiscal_years: [2021,2022,2023,2024], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total*UNITS).toLocaleString()} (net loss — shown at 0)]`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
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
