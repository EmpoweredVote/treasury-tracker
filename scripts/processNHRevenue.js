#!/usr/bin/env node
/**
 * New Hampshire General Fund Revenue Loader — FY2022-2026
 * Source: NH Dept of Administrative Services (das.nh.gov)
 * NH fiscal year ends June 30. No broad income tax, no general sales tax.
 * Revenue: Business Profits Tax + Business Enterprise Tax + Meals & Rooms + Tobacco + Lottery.
 * Interest & Dividends Tax (5%) phased out — eliminated starting calendar year 2025.
 * Confidence: estimated for all years.
 *
 * Usage:
 *   node scripts/processNHRevenue.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'New Hampshire'; const STATE_ABBR = 'NH'; const POPULATION = 1_395_231;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const REVENUE = {
  2022: { total: 3_000_000_000, confidence: 'estimated', categories: [
    { name: 'Business Profits Tax', total: 600_000_000, lineItems: [{ name: 'Business Profits Tax (7.6%)', amount: 600_000_000 }] },
    { name: 'Meals and Rooms Tax', total: 350_000_000, lineItems: [{ name: 'Meals and Rooms Tax (9%)', amount: 350_000_000 }] },
    { name: 'Business Enterprise Tax', total: 240_000_000, lineItems: [{ name: 'Business Enterprise Tax (0.6% on compensation/dividends/interest)', amount: 240_000_000 }] },
    { name: 'Interest and Dividends Tax', total: 200_000_000, lineItems: [{ name: 'Interest and Dividends Tax (5%, phasing out)', amount: 200_000_000 }] },
    { name: 'Tobacco Tax', total: 200_000_000, lineItems: [{ name: 'Tobacco Tax', amount: 200_000_000 }] },
    { name: 'Other Revenue', total: 1_410_000_000, lineItems: [
      { name: 'Liquor Commission Transfer', amount: 150_000_000 },
      { name: 'Lottery Commission Revenue', amount: 160_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 200_000_000 },
      { name: 'Utility Property Tax', amount: 150_000_000 },
      { name: 'Other Taxes and Federal Transfers', amount: 750_000_000 },
    ]},
  ]},
  2023: { total: 3_200_000_000, confidence: 'estimated', categories: [
    { name: 'Business Profits Tax', total: 750_000_000, lineItems: [{ name: 'Business Profits Tax (7.6% → 7.5%)', amount: 750_000_000 }] },
    { name: 'Meals and Rooms Tax', total: 360_000_000, lineItems: [{ name: 'Meals and Rooms Tax (9%)', amount: 360_000_000 }] },
    { name: 'Business Enterprise Tax', total: 280_000_000, lineItems: [{ name: 'Business Enterprise Tax (0.6%)', amount: 280_000_000 }] },
    { name: 'Interest and Dividends Tax', total: 200_000_000, lineItems: [{ name: 'Interest and Dividends Tax (5%, phasing out)', amount: 200_000_000 }] },
    { name: 'Tobacco Tax', total: 190_000_000, lineItems: [{ name: 'Tobacco Tax', amount: 190_000_000 }] },
    { name: 'Other Revenue', total: 1_420_000_000, lineItems: [
      { name: 'Liquor Commission Transfer', amount: 155_000_000 },
      { name: 'Lottery Commission Revenue', amount: 165_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 200_000_000 },
      { name: 'Utility Property Tax', amount: 150_000_000 },
      { name: 'Other Taxes and Federal Transfers', amount: 750_000_000 },
    ]},
  ]},
  2024: { total: 3_500_000_000, confidence: 'estimated', categories: [
    { name: 'Business Profits Tax', total: 780_000_000, lineItems: [{ name: 'Business Profits Tax (7.5%)', amount: 780_000_000 }] },
    { name: 'Meals and Rooms Tax', total: 370_000_000, lineItems: [{ name: 'Meals and Rooms Tax (9%)', amount: 370_000_000 }] },
    { name: 'Business Enterprise Tax', total: 280_000_000, lineItems: [{ name: 'Business Enterprise Tax (0.55% reduced)', amount: 280_000_000 }] },
    { name: 'Interest and Dividends Tax', total: 150_000_000, lineItems: [{ name: 'Interest and Dividends Tax (reduced rate, phasing out)', amount: 150_000_000 }] },
    { name: 'Tobacco Tax', total: 190_000_000, lineItems: [{ name: 'Tobacco Tax', amount: 190_000_000 }] },
    { name: 'Other Revenue', total: 1_730_000_000, lineItems: [
      { name: 'Liquor Commission Transfer', amount: 160_000_000 },
      { name: 'Lottery Commission Revenue', amount: 160_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 200_000_000 },
      { name: 'Utility Property Tax', amount: 150_000_000 },
      { name: 'Other Taxes and Federal Transfers', amount: 1_060_000_000 },
    ]},
  ]},
  2025: { total: 3_800_000_000, confidence: 'estimated', categories: [
    { name: 'Business Profits Tax', total: 790_000_000, lineItems: [{ name: 'Business Profits Tax (7.5%)', amount: 790_000_000 }] },
    { name: 'Meals and Rooms Tax', total: 380_000_000, lineItems: [{ name: 'Meals and Rooms Tax (9%)', amount: 380_000_000 }] },
    { name: 'Business Enterprise Tax', total: 290_000_000, lineItems: [{ name: 'Business Enterprise Tax (0.55%)', amount: 290_000_000 }] },
    { name: 'Interest and Dividends Tax', total: 100_000_000, lineItems: [{ name: 'Interest and Dividends Tax (further reduced, FY2025)', amount: 100_000_000 }] },
    { name: 'Tobacco Tax', total: 180_000_000, lineItems: [{ name: 'Tobacco Tax', amount: 180_000_000 }] },
    { name: 'Other Revenue', total: 2_060_000_000, lineItems: [
      { name: 'Liquor Commission Transfer', amount: 160_000_000 },
      { name: 'Lottery Commission Revenue', amount: 160_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 200_000_000 },
      { name: 'Utility Property Tax', amount: 150_000_000 },
      { name: 'Other Taxes and Federal Transfers', amount: 1_390_000_000 },
    ]},
  ]},
  2026: { total: 4_000_000_000, confidence: 'estimated', categories: [
    { name: 'Business Profits Tax', total: 800_000_000, lineItems: [{ name: 'Business Profits Tax (7.5%)', amount: 800_000_000 }] },
    { name: 'Meals and Rooms Tax', total: 390_000_000, lineItems: [{ name: 'Meals and Rooms Tax (9%)', amount: 390_000_000 }] },
    { name: 'Business Enterprise Tax', total: 300_000_000, lineItems: [{ name: 'Business Enterprise Tax (0.55%)', amount: 300_000_000 }] },
    { name: 'Tobacco Tax', total: 170_000_000, lineItems: [{ name: 'Tobacco Tax', amount: 170_000_000 }] },
    { name: 'Other Revenue', total: 2_340_000_000, lineItems: [
      { name: 'Liquor Commission Transfer', amount: 165_000_000 },
      { name: 'Lottery Commission Revenue', amount: 165_000_000 },
      { name: 'Real Estate Transfer Tax', amount: 200_000_000 },
      { name: 'Utility Property Tax', amount: 150_000_000 },
      { name: 'Other Taxes and Federal Transfers', amount: 1_660_000_000 },
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
  return { jsonTree: [{ n: 'New Hampshire General Fund Revenue', a: total, c: children }], total, rowCount: categories.length };
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
    const srcPayload = { name: `${STATE_NAME} General Fund Revenue`, api_type: 'html', dataset_type: 'revenue', dataset_id: 'nh-gf-revenue', base_url: 'https://das.nh.gov/budget/', fiscal_years: [2022,2023,2024,2025,2026], municipality_id: muniId };
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
