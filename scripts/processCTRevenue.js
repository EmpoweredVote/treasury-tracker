#!/usr/bin/env node
/**
 * Connecticut General Fund Revenue Loader — FY2022-2026
 * Source: CT Office of Policy and Management (ct.gov/opm)
 * CT fiscal year ends June 30. Income tax (graduated to 6.99%) is dominant.
 * Pass-Through Entity (PTE) tax introduced FY2019, now $1.5-2B/yr.
 * Sales tax 6.35%. Strong capital gains component in income tax.
 * Confidence: estimated for all years.
 *
 * Usage:
 *   node scripts/processCTRevenue.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Connecticut'; const STATE_ABBR = 'CT'; const POPULATION = 3_617_176;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const REVENUE = {
  2022: { total: 22_000_000_000, confidence: 'estimated', categories: [
    { name: 'Individual Income Tax', total: 10_500_000_000, lineItems: [
      { name: 'Individual Income Tax (graduated to 6.99%)', amount: 8_700_000_000 },
      { name: 'Pass-Through Entity (PTE) Tax', amount: 1_800_000_000 },
    ]},
    { name: 'Sales and Use Tax', total: 5_300_000_000, lineItems: [{ name: 'Sales and Use Tax (6.35% rate)', amount: 5_300_000_000 }] },
    { name: 'Corporation Business Tax', total: 2_000_000_000, lineItems: [{ name: 'Corporation Business Tax', amount: 2_000_000_000 }] },
    { name: 'Estate and Gift Tax', total: 700_000_000, lineItems: [{ name: 'Estate Tax', amount: 700_000_000 }] },
    { name: 'Other Revenue', total: 3_500_000_000, lineItems: [
      { name: 'Motor Vehicle Fuels Tax', amount: 700_000_000 },
      { name: 'Lottery and Gaming', amount: 600_000_000 },
      { name: 'Federal Grants and Transfers', amount: 1_100_000_000 },
      { name: 'Miscellaneous Revenue', amount: 1_100_000_000 },
    ]},
  ]},
  2023: { total: 23_000_000_000, confidence: 'estimated', categories: [
    { name: 'Individual Income Tax', total: 11_000_000_000, lineItems: [
      { name: 'Individual Income Tax (graduated to 6.99%)', amount: 9_000_000_000 },
      { name: 'Pass-Through Entity (PTE) Tax', amount: 2_000_000_000 },
    ]},
    { name: 'Sales and Use Tax', total: 5_500_000_000, lineItems: [{ name: 'Sales and Use Tax (6.35% rate)', amount: 5_500_000_000 }] },
    { name: 'Corporation Business Tax', total: 2_200_000_000, lineItems: [{ name: 'Corporation Business Tax', amount: 2_200_000_000 }] },
    { name: 'Estate and Gift Tax', total: 700_000_000, lineItems: [{ name: 'Estate Tax', amount: 700_000_000 }] },
    { name: 'Other Revenue', total: 3_600_000_000, lineItems: [
      { name: 'Motor Vehicle Fuels Tax', amount: 700_000_000 },
      { name: 'Lottery and Gaming', amount: 600_000_000 },
      { name: 'Federal Grants and Transfers', amount: 1_200_000_000 },
      { name: 'Miscellaneous Revenue', amount: 1_100_000_000 },
    ]},
  ]},
  2024: { total: 24_000_000_000, confidence: 'estimated', categories: [
    { name: 'Individual Income Tax', total: 11_500_000_000, lineItems: [
      { name: 'Individual Income Tax (graduated to 6.99%)', amount: 9_500_000_000 },
      { name: 'Pass-Through Entity (PTE) Tax', amount: 2_000_000_000 },
    ]},
    { name: 'Sales and Use Tax', total: 5_700_000_000, lineItems: [{ name: 'Sales and Use Tax (6.35% rate)', amount: 5_700_000_000 }] },
    { name: 'Corporation Business Tax', total: 2_400_000_000, lineItems: [{ name: 'Corporation Business Tax', amount: 2_400_000_000 }] },
    { name: 'Estate and Gift Tax', total: 700_000_000, lineItems: [{ name: 'Estate Tax', amount: 700_000_000 }] },
    { name: 'Other Revenue', total: 3_700_000_000, lineItems: [
      { name: 'Motor Vehicle Fuels Tax', amount: 700_000_000 },
      { name: 'Lottery and Gaming', amount: 700_000_000 },
      { name: 'Federal Grants and Transfers', amount: 1_200_000_000 },
      { name: 'Miscellaneous Revenue', amount: 1_100_000_000 },
    ]},
  ]},
  2025: { total: 25_000_000_000, confidence: 'estimated', categories: [
    { name: 'Individual Income Tax', total: 12_000_000_000, lineItems: [
      { name: 'Individual Income Tax (graduated to 6.99%)', amount: 9_900_000_000 },
      { name: 'Pass-Through Entity (PTE) Tax', amount: 2_100_000_000 },
    ]},
    { name: 'Sales and Use Tax', total: 5_900_000_000, lineItems: [{ name: 'Sales and Use Tax (6.35% rate)', amount: 5_900_000_000 }] },
    { name: 'Corporation Business Tax', total: 2_500_000_000, lineItems: [{ name: 'Corporation Business Tax', amount: 2_500_000_000 }] },
    { name: 'Estate and Gift Tax', total: 700_000_000, lineItems: [{ name: 'Estate Tax', amount: 700_000_000 }] },
    { name: 'Other Revenue', total: 3_900_000_000, lineItems: [
      { name: 'Motor Vehicle Fuels Tax', amount: 700_000_000 },
      { name: 'Lottery and Gaming', amount: 700_000_000 },
      { name: 'Federal Grants and Transfers', amount: 1_400_000_000 },
      { name: 'Miscellaneous Revenue', amount: 1_100_000_000 },
    ]},
  ]},
  2026: { total: 26_000_000_000, confidence: 'estimated', categories: [
    { name: 'Individual Income Tax', total: 12_500_000_000, lineItems: [
      { name: 'Individual Income Tax (graduated to 6.99%)', amount: 10_300_000_000 },
      { name: 'Pass-Through Entity (PTE) Tax', amount: 2_200_000_000 },
    ]},
    { name: 'Sales and Use Tax', total: 6_100_000_000, lineItems: [{ name: 'Sales and Use Tax (6.35% rate)', amount: 6_100_000_000 }] },
    { name: 'Corporation Business Tax', total: 2_600_000_000, lineItems: [{ name: 'Corporation Business Tax', amount: 2_600_000_000 }] },
    { name: 'Estate and Gift Tax', total: 700_000_000, lineItems: [{ name: 'Estate Tax', amount: 700_000_000 }] },
    { name: 'Other Revenue', total: 4_100_000_000, lineItems: [
      { name: 'Motor Vehicle Fuels Tax', amount: 700_000_000 },
      { name: 'Lottery and Gaming', amount: 700_000_000 },
      { name: 'Federal Grants and Transfers', amount: 1_600_000_000 },
      { name: 'Miscellaneous Revenue', amount: 1_100_000_000 },
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
  return { jsonTree: [{ n: 'Connecticut General Fund Revenue', a: total, c: children }], total, rowCount: categories.length };
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
    const srcPayload = { name: `${STATE_NAME} General Fund Revenue`, api_type: 'html', dataset_type: 'revenue', dataset_id: 'ct-gf-revenue', base_url: 'https://portal.ct.gov/OPM/Fin-BudgetInfo/BudgetInformation/Current-State-Budget', fiscal_years: [2022,2023,2024,2025,2026], municipality_id: muniId };
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
