#!/usr/bin/env node
/**
 * Minnesota General Fund Operating (Expenditure) Loader — FY2023-FY2025 ACTUAL
 * Source: State of Minnesota Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by MN Management & Budget (MMB). Per-FY source URL below.
 * Replaces the prior FY2022-2026 round-number ESTIMATE placeholders (Phase 93 / 93-02 D-93-05,
 * Chris-approved 2026-06-27) — those were unsourced and violated the "no unsourced data" rule.
 * Closed years with published GAAP actuals only (FY2023, FY2024, FY2025). FY2021/FY2022 use the
 * SAME ACFRs but their expenditure tables need page-image extraction (and FY2022 has a negative
 * investment line) — deferred. Confidence: actual (audited GAAP figures).
 *
 * Usage:
 *   node scripts/processMN.js [--dry-run] [--fy YYYY]
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

// Per-FY source: each year's own published State of Minnesota ACFR (source_date = fiscal year end).
const SOURCES = {
  2023: { url: 'https://mn.gov/mmb/assets/2023%20-%20ACFR%20Final%20accessible_tcm1059-604563.pdf', date: '2023-06-30' },
  2024: { url: 'https://mn.gov/mmb/assets/2024%20-%20Final%20ACFR%20with%20Cover%202024%20-%20accessible_tcm1059-661432.pdf', date: '2024-06-30' },
  2025: { url: 'https://mn.gov/mmb-stat/documents/accounting/acfr/2025-ACFR.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `State of Minnesota ACFR — General Fund (FY${fy} actual)`;

// General Fund expenditures by function — State of MN ACFR, GENERAL FUND column (in $).
// Function-level totals only (the ACFR governmental-funds statement does not break functions into
// sub-line-items), so these are depth-1 leaves under the GF root. Sums verified to Total Expenditures.
const EXPENDITURES = {
  2023: { total: 26_646_765_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 10_295_273_000, lineItems: [] },
    { name: 'Health and Human Services', total: 9_382_910_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_504_788_000, lineItems: [] },
    { name: 'General Government', total: 1_016_072_000, lineItems: [] },
    { name: 'Higher Education', total: 985_891_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 865_633_000, lineItems: [] },
    { name: 'Transportation', total: 613_082_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 404_235_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 386_802_000, lineItems: [] },
    { name: 'Capital Outlay', total: 104_412_000, lineItems: [] },
    { name: 'Debt Service', total: 87_667_000, lineItems: [] },
  ]},
  2024: { total: 33_534_701_000, confidence: 'actual', categories: [
    { name: 'General Education', total: 11_921_970_000, lineItems: [] },
    { name: 'Health and Human Services', total: 11_739_746_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_752_507_000, lineItems: [] },
    { name: 'General Government', total: 2_339_791_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 1_173_272_000, lineItems: [] },
    { name: 'Higher Education', total: 1_146_680_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 1_048_915_000, lineItems: [] },
    { name: 'Transportation', total: 638_509_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 491_047_000, lineItems: [] },
    { name: 'Capital Outlay', total: 184_522_000, lineItems: [] },
    { name: 'Debt Service', total: 97_742_000, lineItems: [] },
  ]},
  2025: { total: 35_114_726_000, confidence: 'actual', categories: [
    { name: 'Health and Human Services', total: 13_361_362_000, lineItems: [] },
    { name: 'General Education', total: 12_661_467_000, lineItems: [] },
    { name: 'Intergovernmental Aid', total: 2_951_642_000, lineItems: [] },
    { name: 'General Government', total: 1_287_599_000, lineItems: [] },
    { name: 'Higher Education', total: 1_196_290_000, lineItems: [] },
    { name: 'Public Safety and Corrections', total: 1_181_789_000, lineItems: [] },
    { name: 'Economic and Workforce Development', total: 853_759_000, lineItems: [] },
    { name: 'Transportation', total: 701_411_000, lineItems: [] },
    { name: 'Agricultural, Environmental and Energy Resources', total: 624_479_000, lineItems: [] },
    { name: 'Capital Outlay', total: 181_074_000, lineItems: [] },
    { name: 'Debt Service', total: 113_854_000, lineItems: [] },
  ]},
};

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
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
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total > 0).map(cat => ({ n: cat.name, a: cat.total, i: cat.lineItems.filter(li => li.amount > 0).map(li => ({ d: li.name, a: li.amount, aa: null, f: 'General Fund', e: null })) }));
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Minnesota General Fund Budget', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: `${STATE_NAME} General Fund Operating Budget`, api_type: 'html', dataset_type: 'operating', dataset_id: 'mn-gf-operating', base_url: 'https://mn.gov/mmb/accounting/reports/annual-comprehensive-financial-report.jsp', fiscal_years: [2023,2024,2025], municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('name', srcPayload.name).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; console.log(`data_source updated: ${ds.id}`); }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; console.log(`data_source created: ${ds.id}`); }
    console.log('');
  }
  for (const fy of years) {
    if (!EXPENDITURES[fy] || !SOURCES[fy]) { console.warn(`No data/source for FY${fy}`); continue; }
    console.log(`── FY${fy} ─────────────────────────────────────────────`);
    if (!validate(fy)) { process.exit(2); }
    console.log(`FY${fy} validation: PASS  (${EXPENDITURES[fy].confidence})`);
    const { jsonTree, total, rowCount } = buildTree(fy);
    const cats = jsonTree[0].c;
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL EXPENDITURES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Stamp the per-FY source on the budget row (the RPC does not set source_url/source_date). Idempotent.
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (bud?.id) {
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: SOURCES[fy].url, source_date: SOURCES[fy].date, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) { console.error(`source stamp failed: ${upErr.message}`); process.exit(2); }
      console.log(`Stamped source on FY${fy} operating row\n`);
    } else { console.error(`Could not find FY${fy} operating budget row to stamp source`); process.exit(2); }
    await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  }
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
