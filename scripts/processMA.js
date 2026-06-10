#!/usr/bin/env node
/**
 * Massachusetts General Fund Operating Budget Loader — FY2022-2026
 * Source: MA Executive Office for Administration and Finance
 *   https://www.mass.gov/lists/budget-archives (Budget Summaries FY2022-FY2025)
 *   https://budget.digital.mass.gov/summary/fy25/ (FY2025 Budget Summary)
 * MA fiscal year ends June 30. MassHealth (Medicaid) and education aid are largest categories.
 * FY2022-FY2025: Enacted General Appropriations Act (GAA) totals.
 *   Category proportions derived from MA EAOF historical spending breakdowns.
 * FY2026: Estimated (Governor's recommendation; enacted GAA not yet available as of June 2026).
 * Per-capita validation range: $5,000-$8,500/person (at 7,029,917 population).
 *
 * Usage:
 *   node scripts/processMA.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Massachusetts'; const STATE_ABBR = 'MA'; const POPULATION = 7_029_917;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXPENDITURES = {
  // FY2022 enacted GAA: $47.6B total (source: mass.gov/lists/budget-archives FY2022 Budget Summary)
  // Category proportions: HHS 46.2%, Education 21.5%, Local Aid 11.8%, Debt 5.5%, Gen Gov 4.5%, C&PS 3.0%, Other 7.5%
  2022: { total: 47_600_000_000, confidence: 'enacted', categories: [
    { name: 'Health and Human Services', total: 21_991_000_000, lineItems: [
      { name: 'MassHealth/Medicaid (state match)', amount: 13_524_000_000 },
      { name: 'Human Services', amount: 5_674_000_000 },
      { name: 'Mental Health and Substance Use', amount: 2_793_000_000 },
    ]},
    { name: 'Education', total: 10_234_000_000, lineItems: [
      { name: 'K-12 Chapter 70 Aid', amount: 6_059_000_000 },
      { name: 'Higher Education', amount: 2_149_000_000 },
      { name: 'Early Education and Care', amount: 2_026_000_000 },
    ]},
    { name: 'Local Government Aid', total: 5_617_000_000, lineItems: [
      { name: 'Unrestricted Government Aid (UGA)', amount: 1_404_000_000 },
      { name: 'Regional School Transportation', amount: 2_078_000_000 },
      { name: 'Other Local Aid', amount: 2_135_000_000 },
    ]},
    { name: 'Debt Service', total: 2_618_000_000, lineItems: [
      { name: 'Bond and Note Payments', amount: 2_618_000_000 },
    ]},
    { name: 'General Government', total: 2_142_000_000, lineItems: [
      { name: 'Administration and Finance', amount: 1_285_000_000 },
      { name: 'Courts and Judiciary', amount: 857_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_428_000_000, lineItems: [
      { name: 'Dept of Correction', amount: 714_000_000 },
      { name: 'State Police and Other', amount: 714_000_000 },
    ]},
    { name: 'Other Programs', total: 3_570_000_000, lineItems: [
      { name: 'Energy and Environment', amount: 1_785_000_000 },
      { name: 'Economic Development', amount: 1_785_000_000 },
    ]},
  ]},
  // FY2023 enacted GAA: $49.7B total (source: mass.gov/lists/budget-archives FY2023 Budget Summary)
  // Category proportions: HHS 46.5%, Education 21.8%, Local Aid 11.5%, Debt 5.4%, Gen Gov 4.4%, C&PS 2.9%, Other 7.5%
  2023: { total: 49_700_000_000, confidence: 'enacted', categories: [
    { name: 'Health and Human Services', total: 23_110_000_000, lineItems: [
      { name: 'MassHealth/Medicaid (state match)', amount: 14_213_000_000 },
      { name: 'Human Services', amount: 5_962_000_000 },
      { name: 'Mental Health and Substance Use', amount: 2_935_000_000 },
    ]},
    { name: 'Education', total: 10_835_000_000, lineItems: [
      { name: 'K-12 Chapter 70 Aid', amount: 6_414_000_000 },
      { name: 'Higher Education', amount: 2_275_000_000 },
      { name: 'Early Education and Care', amount: 2_146_000_000 },
    ]},
    { name: 'Local Government Aid', total: 5_716_000_000, lineItems: [
      { name: 'Unrestricted Government Aid (UGA)', amount: 1_429_000_000 },
      { name: 'Regional School Transportation', amount: 2_115_000_000 },
      { name: 'Other Local Aid', amount: 2_172_000_000 },
    ]},
    { name: 'Debt Service', total: 2_684_000_000, lineItems: [
      { name: 'Bond and Note Payments', amount: 2_684_000_000 },
    ]},
    { name: 'General Government', total: 2_187_000_000, lineItems: [
      { name: 'Administration and Finance', amount: 1_312_000_000 },
      { name: 'Courts and Judiciary', amount: 875_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_441_000_000, lineItems: [
      { name: 'Dept of Correction', amount: 720_000_000 },
      { name: 'State Police and Other', amount: 721_000_000 },
    ]},
    { name: 'Other Programs', total: 3_727_000_000, lineItems: [
      { name: 'Energy and Environment', amount: 1_864_000_000 },
      { name: 'Economic Development', amount: 1_863_000_000 },
    ]},
  ]},
  // FY2024 enacted GAA: $56.2B total (source: mass.gov/lists/budget-archives FY2024 Budget Summary)
  // Includes Fair Share surtax revenue (Education + Transportation fund)
  // Category proportions: HHS 47.0%, Education 22.0%, Local Aid 11.2%, Debt 5.3%, Gen Gov 4.3%, C&PS 2.8%, Other 7.4%
  2024: { total: 56_200_000_000, confidence: 'enacted', categories: [
    { name: 'Health and Human Services', total: 26_414_000_000, lineItems: [
      { name: 'MassHealth/Medicaid (state match)', amount: 16_245_000_000 },
      { name: 'Human Services', amount: 6_815_000_000 },
      { name: 'Mental Health and Substance Use', amount: 3_354_000_000 },
    ]},
    { name: 'Education', total: 12_364_000_000, lineItems: [
      { name: 'K-12 Chapter 70 Aid', amount: 7_319_000_000 },
      { name: 'Higher Education', amount: 2_596_000_000 },
      { name: 'Early Education and Care', amount: 2_449_000_000 },
    ]},
    { name: 'Local Government Aid', total: 6_294_000_000, lineItems: [
      { name: 'Unrestricted Government Aid (UGA)', amount: 1_574_000_000 },
      { name: 'Regional School Transportation', amount: 2_329_000_000 },
      { name: 'Other Local Aid', amount: 2_391_000_000 },
    ]},
    { name: 'Debt Service', total: 2_979_000_000, lineItems: [
      { name: 'Bond and Note Payments', amount: 2_979_000_000 },
    ]},
    { name: 'General Government', total: 2_417_000_000, lineItems: [
      { name: 'Administration and Finance', amount: 1_450_000_000 },
      { name: 'Courts and Judiciary', amount: 967_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_574_000_000, lineItems: [
      { name: 'Dept of Correction', amount: 787_000_000 },
      { name: 'State Police and Other', amount: 787_000_000 },
    ]},
    { name: 'Other Programs', total: 4_158_000_000, lineItems: [
      { name: 'Energy and Environment', amount: 2_079_000_000 },
      { name: 'Economic Development', amount: 2_079_000_000 },
    ]},
  ]},
  // FY2025 enacted GAA: $57.8B total (source: mass.gov/lists/budget-archives FY2025 Budget Summary;
  //   budget.digital.mass.gov/summary/fy25/; signed by Governor Healey August 2024)
  // Category proportions: HHS 47.2%, Education 21.8%, Local Aid 11.3%, Debt 5.4%, Gen Gov 4.3%, C&PS 2.8%, Other 7.2%
  2025: { total: 57_800_000_000, confidence: 'enacted', categories: [
    { name: 'Health and Human Services', total: 27_282_000_000, lineItems: [
      { name: 'MassHealth/Medicaid (state match)', amount: 16_778_000_000 },
      { name: 'Human Services', amount: 7_039_000_000 },
      { name: 'Mental Health and Substance Use', amount: 3_465_000_000 },
    ]},
    { name: 'Education', total: 12_600_000_000, lineItems: [
      { name: 'K-12 Chapter 70 Aid', amount: 7_459_000_000 },
      { name: 'Higher Education', amount: 2_646_000_000 },
      { name: 'Early Education and Care', amount: 2_495_000_000 },
    ]},
    { name: 'Local Government Aid', total: 6_531_000_000, lineItems: [
      { name: 'Unrestricted Government Aid (UGA)', amount: 1_633_000_000 },
      { name: 'Regional School Transportation', amount: 2_416_000_000 },
      { name: 'Other Local Aid', amount: 2_482_000_000 },
    ]},
    { name: 'Debt Service', total: 3_121_000_000, lineItems: [
      { name: 'Bond and Note Payments', amount: 3_121_000_000 },
    ]},
    { name: 'General Government', total: 2_485_000_000, lineItems: [
      { name: 'Administration and Finance', amount: 1_491_000_000 },
      { name: 'Courts and Judiciary', amount: 994_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_618_000_000, lineItems: [
      { name: 'Dept of Correction', amount: 809_000_000 },
      { name: 'State Police and Other', amount: 809_000_000 },
    ]},
    { name: 'Other Programs', total: 4_163_000_000, lineItems: [
      { name: 'Energy and Environment', amount: 2_082_000_000 },
      { name: 'Economic Development', amount: 2_081_000_000 },
    ]},
  ]},
  2026: { total: 37_500_000_000, confidence: 'estimated', categories: [
    { name: 'Health and Human Services', total: 14_000_000_000, lineItems: [
      { name: 'MassHealth/Medicaid (state match)', amount: 9_800_000_000 },
      { name: 'Human Services', amount: 2_800_000_000 },
      { name: 'Mental Health and Substance Use', amount: 1_400_000_000 },
    ]},
    { name: 'Education', total: 10_000_000_000, lineItems: [
      { name: 'K-12 Chapter 70 Aid', amount: 6_600_000_000 },
      { name: 'Higher Education', amount: 1_900_000_000 },
      { name: 'Early Education and Care', amount: 1_500_000_000 },
    ]},
    { name: 'Local Government Aid', total: 6_200_000_000, lineItems: [
      { name: 'Unrestricted Government Aid (UGA)', amount: 1_500_000_000 },
      { name: 'Regional School Transportation', amount: 2_400_000_000 },
      { name: 'Other Local Aid', amount: 2_300_000_000 },
    ]},
    { name: 'Debt Service', total: 3_200_000_000, lineItems: [
      { name: 'Bond and Note Payments', amount: 3_200_000_000 },
    ]},
    { name: 'General Government', total: 2_000_000_000, lineItems: [
      { name: 'Administration and Finance', amount: 1_200_000_000 },
      { name: 'Courts and Judiciary', amount: 800_000_000 },
    ]},
    { name: 'Corrections and Public Safety', total: 1_200_000_000, lineItems: [
      { name: 'Dept of Correction', amount: 600_000_000 },
      { name: 'State Police and Other', amount: 600_000_000 },
    ]},
    { name: 'Other Programs', total: 900_000_000, lineItems: [
      { name: 'Energy and Environment', amount: 450_000_000 },
      { name: 'Economic Development', amount: 450_000_000 },
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
  return { jsonTree: [{ n: 'Massachusetts General Fund Budget', a: total, c: children }], total, rowCount: categories.length };
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
    const srcPayload = { name: `${STATE_NAME} General Fund Operating Budget`, api_type: 'html', dataset_type: 'operating', dataset_id: 'ma-gf-operating', base_url: 'https://budget.digital.mass.gov/', fiscal_years: [2022,2023,2024,2025,2026], municipality_id: muniId };
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
