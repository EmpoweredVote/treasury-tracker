#!/usr/bin/env node
/**
 * Oregon General Fund Operating Budget Loader — FY2022-2026
 * Source: OR Legislative Fiscal Office / Department of Administrative Services (oregon.gov)
 * OR fiscal year ends June 30 (biennial budget; amounts here are single-year estimates).
 * No sales tax — income tax (graduated to 9.9%) is dominant revenue source.
 * Oregon Health Plan (Medicaid) + education are largest spending areas.
 * Confidence: estimated for all years.
 *
 * Usage:
 *   node scripts/processOR.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Oregon'; const STATE_ABBR = 'OR'; const POPULATION = 4_233_358;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXPENDITURES = {
  2022: { total: 10_000_000_000, confidence: 'estimated', categories: [
    { name: 'Education', total: 3_800_000_000, lineItems: [
      { name: 'K-12 State School Fund', amount: 2_900_000_000 },
      { name: 'Higher Education (OUS/OHA)', amount: 700_000_000 },
      { name: 'Other Education Programs', amount: 200_000_000 },
    ]},
    { name: 'Health and Human Services', total: 3_200_000_000, lineItems: [
      { name: 'Oregon Health Plan (OHP/Medicaid)', amount: 2_400_000_000 },
      { name: 'DHS Child Welfare', amount: 500_000_000 },
      { name: 'Public Health', amount: 300_000_000 },
    ]},
    { name: 'General Government', total: 1_500_000_000, lineItems: [
      { name: 'State Agency Operations', amount: 1_100_000_000 },
      { name: 'Courts and Judiciary', amount: 400_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_200_000_000, lineItems: [
      { name: 'Dept of Corrections', amount: 900_000_000 },
      { name: 'State Police and OEM', amount: 300_000_000 },
    ]},
    { name: 'Economic and Natural Resources', total: 300_000_000, lineItems: [
      { name: 'Agriculture and Forestry', amount: 150_000_000 },
      { name: 'Economic Development', amount: 150_000_000 },
    ]},
  ]},
  2023: { total: 11_000_000_000, confidence: 'estimated', categories: [
    { name: 'Education', total: 4_200_000_000, lineItems: [
      { name: 'K-12 State School Fund', amount: 3_200_000_000 },
      { name: 'Higher Education (OUS/OHA)', amount: 750_000_000 },
      { name: 'Other Education Programs', amount: 250_000_000 },
    ]},
    { name: 'Health and Human Services', total: 3_400_000_000, lineItems: [
      { name: 'Oregon Health Plan (OHP/Medicaid)', amount: 2_600_000_000 },
      { name: 'DHS Child Welfare', amount: 500_000_000 },
      { name: 'Public Health', amount: 300_000_000 },
    ]},
    { name: 'General Government', total: 1_700_000_000, lineItems: [
      { name: 'State Agency Operations', amount: 1_300_000_000 },
      { name: 'Courts and Judiciary', amount: 400_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_300_000_000, lineItems: [
      { name: 'Dept of Corrections', amount: 1_000_000_000 },
      { name: 'State Police and OEM', amount: 300_000_000 },
    ]},
    { name: 'Economic and Natural Resources', total: 400_000_000, lineItems: [
      { name: 'Agriculture and Forestry', amount: 200_000_000 },
      { name: 'Economic Development', amount: 200_000_000 },
    ]},
  ]},
  2024: { total: 12_000_000_000, confidence: 'estimated', categories: [
    { name: 'Education', total: 4_600_000_000, lineItems: [
      { name: 'K-12 State School Fund', amount: 3_500_000_000 },
      { name: 'Higher Education (OUS/OHA)', amount: 800_000_000 },
      { name: 'Other Education Programs', amount: 300_000_000 },
    ]},
    { name: 'Health and Human Services', total: 3_700_000_000, lineItems: [
      { name: 'Oregon Health Plan (OHP/Medicaid)', amount: 2_900_000_000 },
      { name: 'DHS Child Welfare', amount: 500_000_000 },
      { name: 'Public Health', amount: 300_000_000 },
    ]},
    { name: 'General Government', total: 1_900_000_000, lineItems: [
      { name: 'State Agency Operations', amount: 1_500_000_000 },
      { name: 'Courts and Judiciary', amount: 400_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_400_000_000, lineItems: [
      { name: 'Dept of Corrections', amount: 1_100_000_000 },
      { name: 'State Police and OEM', amount: 300_000_000 },
    ]},
    { name: 'Economic and Natural Resources', total: 400_000_000, lineItems: [
      { name: 'Agriculture and Forestry', amount: 200_000_000 },
      { name: 'Economic Development', amount: 200_000_000 },
    ]},
  ]},
  2025: { total: 12_500_000_000, confidence: 'estimated', categories: [
    { name: 'Education', total: 4_800_000_000, lineItems: [
      { name: 'K-12 State School Fund', amount: 3_700_000_000 },
      { name: 'Higher Education (OUS/OHA)', amount: 800_000_000 },
      { name: 'Other Education Programs', amount: 300_000_000 },
    ]},
    { name: 'Health and Human Services', total: 3_900_000_000, lineItems: [
      { name: 'Oregon Health Plan (OHP/Medicaid)', amount: 3_100_000_000 },
      { name: 'DHS Child Welfare', amount: 500_000_000 },
      { name: 'Public Health', amount: 300_000_000 },
    ]},
    { name: 'General Government', total: 2_000_000_000, lineItems: [
      { name: 'State Agency Operations', amount: 1_600_000_000 },
      { name: 'Courts and Judiciary', amount: 400_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_400_000_000, lineItems: [
      { name: 'Dept of Corrections', amount: 1_100_000_000 },
      { name: 'State Police and OEM', amount: 300_000_000 },
    ]},
    { name: 'Economic and Natural Resources', total: 400_000_000, lineItems: [
      { name: 'Agriculture and Forestry', amount: 200_000_000 },
      { name: 'Economic Development', amount: 200_000_000 },
    ]},
  ]},
  2026: { total: 13_000_000_000, confidence: 'estimated', categories: [
    { name: 'Education', total: 5_000_000_000, lineItems: [
      { name: 'K-12 State School Fund', amount: 3_800_000_000 },
      { name: 'Higher Education (OUS/OHA)', amount: 900_000_000 },
      { name: 'Other Education Programs', amount: 300_000_000 },
    ]},
    { name: 'Health and Human Services', total: 4_100_000_000, lineItems: [
      { name: 'Oregon Health Plan (OHP/Medicaid)', amount: 3_300_000_000 },
      { name: 'DHS Child Welfare', amount: 500_000_000 },
      { name: 'Public Health', amount: 300_000_000 },
    ]},
    { name: 'General Government', total: 2_100_000_000, lineItems: [
      { name: 'State Agency Operations', amount: 1_700_000_000 },
      { name: 'Courts and Judiciary', amount: 400_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_400_000_000, lineItems: [
      { name: 'Dept of Corrections', amount: 1_100_000_000 },
      { name: 'State Police and OEM', amount: 300_000_000 },
    ]},
    { name: 'Economic and Natural Resources', total: 400_000_000, lineItems: [
      { name: 'Agriculture and Forestry', amount: 200_000_000 },
      { name: 'Economic Development', amount: 200_000_000 },
    ]},
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) {
    const itemSum = cat.lineItems.reduce((s, li) => s + li.amount, 0);
    if (Math.abs(itemSum - cat.total) > 1_000_000) { console.error(`FY${fy} "${cat.name}": items ${itemSum} ≠ ${cat.total}`); ok = false; }
    catSum += cat.total;
  }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: cat.lineItems.filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })) }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Oregon General Fund Budget', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2022, 2023, 2024, 2025, 2026];
  console.log(`${STATE_NAME} Operating Budget Loader${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: `${STATE_NAME} General Fund Operating Budget`, api_type: 'html', dataset_type: 'operating', dataset_id: 'or-gf-operating', base_url: 'https://www.oregon.gov/das/Financial/Acctng/Pages/CAFR.aspx', fiscal_years: [2022,2023,2024,2025,2026], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('name', srcPayload.name).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy]) { console.warn(`No data for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(32)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(52));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(30)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(52)); console.log(`${'TOTAL BUDGET'.padEnd(32)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}\n`);
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
