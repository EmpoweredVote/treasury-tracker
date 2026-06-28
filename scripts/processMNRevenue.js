#!/usr/bin/env node
/**
 * Minnesota General Fund Revenue Loader — FY2024 ACTUAL
 * Source: State of Minnesota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, General Fund column,
 *   Year Ended June 30, 2024 (in thousands). Published by MN Management & Budget (MMB).
 *   URL: https://mn.gov/mmb/assets/2024 - Final ACFR with Cover 2024 - accessible_tcm1059-661432.pdf
 * Replaces the prior FY2022-2026 round-number ESTIMATE placeholders (Phase 93 / 93-02 D-93-05,
 * Chris-approved 2026-06-27) — those were unsourced. Only FY2024 (closed year, published actuals)
 * is loaded; FY2025/2026 (forecast) and FY2022/2023 (prior-year full ACFRs pending) are not loaded.
 * Confidence: actual (audited GAAP figures).
 *
 * Usage:
 *   node scripts/processMNRevenue.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Minnesota'; const STATE_ABBR = 'MN'; const POPULATION = 5_706_494;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SOURCE_URL  = 'https://mn.gov/mmb/assets/2024%20-%20Final%20ACFR%20with%20Cover%202024%20-%20accessible_tcm1059-661432.pdf';
const SOURCE_DATE = '2024-06-30'; // fiscal year end / as-of date of the audited statement
const DATA_SOURCE = 'State of Minnesota ACFR — General Fund Revenue (FY2024 actual)';

// General Fund net revenues by source — State of MN FY2024 ACFR, General Fund column (in $).
// Source-level totals (depth-0 leaves). Sums verified to the published Net Revenues total.
const REVENUE = {
  2024: { total: 34_562_737_000, confidence: 'actual', categories: [
    { name: 'Individual Income Taxes', total: 16_633_430_000, lineItems: [] },
    { name: 'Sales Taxes', total: 7_593_195_000, lineItems: [] },
    { name: 'Other Taxes', total: 3_259_996_000, lineItems: [] },
    { name: 'Corporate Income Taxes', total: 3_205_333_000, lineItems: [] },
    { name: 'Investment/Interest Earnings', total: 1_398_513_000, lineItems: [] },
    { name: 'Property Taxes', total: 719_571_000, lineItems: [] },
    { name: 'Other Revenues', total: 623_389_000, lineItems: [] },
    { name: 'Motor Vehicle Taxes', total: 451_195_000, lineItems: [] },
    { name: 'Licenses and Fees', total: 263_781_000, lineItems: [] },
    { name: 'Departmental Services', total: 188_191_000, lineItems: [] },
    { name: 'Tobacco Settlement', total: 165_053_000, lineItems: [] },
    { name: 'Federal Revenues', total: 61_090_000, lineItems: [] },
  ]},
};

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) {
    if (cat.lineItems.length) {
      const itemSum = cat.lineItems.reduce((s, li) => s + li.amount, 0);
      if (Math.abs(itemSum - cat.total) > 1_000_000) { console.error(`FY${fy} "${cat.name}": items ${itemSum} ≠ ${cat.total}`); ok = false; }
    }
    catSum += cat.total;
  }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: cat.lineItems.filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })) }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Minnesota General Fund Revenue', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2024];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).single();
    if (error || !muni) { console.error(`${STATE_NAME} not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: `${STATE_NAME} General Fund Revenue`, api_type: 'html', dataset_type: 'revenue', dataset_id: 'mn-gf-revenue', base_url: SOURCE_URL, fiscal_years: [2024], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('name', srcPayload.name).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
    console.log('');
  }
  for (const fy of years) {
    if (!REVENUE[fy]) { console.warn(`No data for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${REVENUE[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(34)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(54));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(32)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(54)); console.log(`${'TOTAL REVENUE'.padEnd(34)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Stamp the real source on the budget row (the RPC does not set source_url/source_date). Idempotent.
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCE_URL, source_date: SOURCE_DATE, data_source: DATA_SOURCE }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} revenue row\n`);
    } else { console.error(`Could not find FY${fy} revenue budget row to stamp source`); process.exit(2); }
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
