#!/usr/bin/env node
/**
 * Vermont General Fund Revenue Loader — FY2022-2026
 * Source: Vermont Department of Finance and Management (finance.vermont.gov)
 * VT fiscal year ends June 30. High income tax (graduated to 8.75%); sales tax 6%.
 * NOTE: K-12 education is funded by the Education Fund (not GF); GF is smaller than other states.
 * Confidence: estimated for all years.
 *
 * Usage:
 *   node scripts/processVTRevenue.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Vermont'; const STATE_ABBR = 'VT'; const POPULATION = 647_064;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const REVENUE = {
  2022: { total: 2_000_000_000, confidence: 'estimated', categories: [
    { name: 'Personal Income Tax', total: 800_000_000, lineItems: [{ name: 'Personal Income Tax (graduated to 8.75%)', amount: 800_000_000 }] },
    { name: 'Sales and Use Tax', total: 250_000_000, lineItems: [{ name: 'Sales and Use Tax (6%)', amount: 250_000_000 }] },
    { name: 'Rooms and Meals Tax', total: 150_000_000, lineItems: [{ name: 'Rooms and Meals Tax (9%)', amount: 150_000_000 }] },
    { name: 'Corporate Income Tax', total: 130_000_000, lineItems: [{ name: 'Corporate Income Tax (8.5%)', amount: 130_000_000 }] },
    { name: 'Other Revenue', total: 670_000_000, lineItems: [
      { name: 'Estate Tax', amount: 50_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 50_000_000 },
      { name: 'Tobacco Tax', amount: 50_000_000 },
      { name: 'Other Taxes and Fees', amount: 520_000_000 },
    ]},
  ]},
  2023: { total: 2_200_000_000, confidence: 'estimated', categories: [
    { name: 'Personal Income Tax', total: 880_000_000, lineItems: [{ name: 'Personal Income Tax (graduated to 8.75%)', amount: 880_000_000 }] },
    { name: 'Sales and Use Tax', total: 270_000_000, lineItems: [{ name: 'Sales and Use Tax (6%)', amount: 270_000_000 }] },
    { name: 'Rooms and Meals Tax', total: 170_000_000, lineItems: [{ name: 'Rooms and Meals Tax (9%)', amount: 170_000_000 }] },
    { name: 'Corporate Income Tax', total: 150_000_000, lineItems: [{ name: 'Corporate Income Tax (8.5%)', amount: 150_000_000 }] },
    { name: 'Other Revenue', total: 730_000_000, lineItems: [
      { name: 'Estate Tax', amount: 55_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 55_000_000 },
      { name: 'Tobacco Tax', amount: 50_000_000 },
      { name: 'Other Taxes and Fees', amount: 570_000_000 },
    ]},
  ]},
  2024: { total: 2_400_000_000, confidence: 'estimated', categories: [
    { name: 'Personal Income Tax', total: 960_000_000, lineItems: [{ name: 'Personal Income Tax (graduated to 8.75%)', amount: 960_000_000 }] },
    { name: 'Sales and Use Tax', total: 290_000_000, lineItems: [{ name: 'Sales and Use Tax (6%)', amount: 290_000_000 }] },
    { name: 'Rooms and Meals Tax', total: 180_000_000, lineItems: [{ name: 'Rooms and Meals Tax (9%)', amount: 180_000_000 }] },
    { name: 'Corporate Income Tax', total: 160_000_000, lineItems: [{ name: 'Corporate Income Tax (8.5%)', amount: 160_000_000 }] },
    { name: 'Other Revenue', total: 810_000_000, lineItems: [
      { name: 'Estate Tax', amount: 55_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 55_000_000 },
      { name: 'Tobacco Tax', amount: 50_000_000 },
      { name: 'Other Taxes and Fees', amount: 650_000_000 },
    ]},
  ]},
  2025: { total: 2_600_000_000, confidence: 'estimated', categories: [
    { name: 'Personal Income Tax', total: 1_040_000_000, lineItems: [{ name: 'Personal Income Tax (graduated to 8.75%)', amount: 1_040_000_000 }] },
    { name: 'Sales and Use Tax', total: 310_000_000, lineItems: [{ name: 'Sales and Use Tax (6%)', amount: 310_000_000 }] },
    { name: 'Rooms and Meals Tax', total: 190_000_000, lineItems: [{ name: 'Rooms and Meals Tax (9%)', amount: 190_000_000 }] },
    { name: 'Corporate Income Tax', total: 160_000_000, lineItems: [{ name: 'Corporate Income Tax (8.5%)', amount: 160_000_000 }] },
    { name: 'Other Revenue', total: 900_000_000, lineItems: [
      { name: 'Estate Tax', amount: 60_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 60_000_000 },
      { name: 'Tobacco Tax', amount: 50_000_000 },
      { name: 'Other Taxes and Fees', amount: 730_000_000 },
    ]},
  ]},
  2026: { total: 2_800_000_000, confidence: 'estimated', categories: [
    { name: 'Personal Income Tax', total: 1_120_000_000, lineItems: [{ name: 'Personal Income Tax (graduated to 8.75%)', amount: 1_120_000_000 }] },
    { name: 'Sales and Use Tax', total: 330_000_000, lineItems: [{ name: 'Sales and Use Tax (6%)', amount: 330_000_000 }] },
    { name: 'Rooms and Meals Tax', total: 200_000_000, lineItems: [{ name: 'Rooms and Meals Tax (9%)', amount: 200_000_000 }] },
    { name: 'Corporate Income Tax', total: 170_000_000, lineItems: [{ name: 'Corporate Income Tax (8.5%)', amount: 170_000_000 }] },
    { name: 'Other Revenue', total: 980_000_000, lineItems: [
      { name: 'Estate Tax', amount: 60_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 60_000_000 },
      { name: 'Tobacco Tax', amount: 50_000_000 },
      { name: 'Other Taxes and Fees', amount: 810_000_000 },
    ]},
  ]},
};

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) {
    const itemSum = cat.lineItems.reduce((s, li) => s + li.amount, 0);
    if (Math.abs(itemSum - cat.total) > 1_000_000) { console.error(`FY${fy} "${cat.name}": items ${itemSum} ≠ ${cat.total}`); ok = false; }
    catSum += cat.total;
  }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: cat.lineItems.filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })) }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Vermont General Fund Revenue', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2022, 2023, 2024, 2025, 2026];
  console.log(`${STATE_NAME} Revenue Loader${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: `${STATE_NAME} General Fund Revenue`, api_type: 'html', dataset_type: 'revenue', dataset_id: 'vt-gf-revenue', base_url: 'https://finance.vermont.gov/', fiscal_years: [2022,2023,2024,2025,2026], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(32)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(52));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(30)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(52)); console.log(`${'TOTAL REVENUE'.padEnd(32)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}\n`);
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
