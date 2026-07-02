#!/usr/bin/env node
/**
 * Virginia General Fund Revenue Loader — FY2022-FY2025 ACTUAL
 * Source: Commonwealth of Virginia Annual Comprehensive Financial Report (ACFR),
 *   Section G — Major Governmental Funds, Statement of Revenues, Expenditures, and
 *   Changes in Fund Balances, GENERAL FUND column (GAAP / modified accrual basis,
 *   in thousands). Published by the Virginia Department of Accounts (DOA).
 *   Per-FY source URL = targeted section-G PDF (~100KB) from doa.virginia.gov.
 * Replaces the prior FY2022-2026 round-number ESTIMATE placeholders sourced to
 *   dpb.virginia.gov/budget (enacted/estimated budget, not GAAP actuals, NULL
 *   source_date). Confidence: actual (audited GAAP figures, modified accrual basis).
 * NOTE: FY2026 row cleanup (DELETE) is handled separately in Plan 05.
 *
 * FY2022 note: "Interest, Dividends, Rents, and Other Investment Income" is NEGATIVE
 *   (−498,365 thousand) due to investment losses in that year. Per P2 policy, the
 *   rendered area is clamped to 0 and the true signed value is preserved in the label.
 *   The root node total carries the audited Total Revenues (which already nets the negative).
 *
 * Extraction method: pdftotext -table on downloaded G_Major_Governmental_Funds.pdf
 *   (per-section PDF, ~100KB). GENERAL FUND = first fund column on the statement.
 *   All 4 revenue-total checksums verified to 0 diff vs. published ACFR totals.
 *
 * Usage:
 *   node scripts/processVARevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Virginia'; const STATE_ABBR = 'VA'; const POPULATION = 8_631_393;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Per-FY source: each year's own published Virginia ACFR section G PDF
// (source_date = fiscal year end June 30, Virginia GF fiscal year ends June 30).
// FY2022 uses www.doa.virginia.gov absolute URL (Pitfall 2 / A5 confirmed resolved).
const SOURCES = {
  2022: { url: 'https://www.doa.virginia.gov/reports/ACFReport/2022/G_Major_Governmental_Funds.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.doa.virginia.gov/reports/ACFReport/2023/G_Major_Governmental_Funds.pdf', date: '2023-06-30' },
  2024: { url: 'https://doa.virginia.gov/reports/ACFReport/2024/G_Major_Governmental_Funds.pdf', date: '2024-06-30' },
  2025: { url: 'https://doa.virginia.gov/reports/ACFReport/2025/G_Major_Governmental_Funds.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `State of Virginia ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund net revenues by source — Commonwealth of Virginia ACFR, GENERAL FUND column (in $).
// Source-level totals (depth-1 leaves under the GF root). Sums verified to TOTAL REVENUES.
// Verbatim ACFR revenue source category names from the Governmental Funds statement, Section G.
// FY2022: "Interest, Dividends, Rents, and Other Investment Income" is negative (−498,365k);
//   clamped to 0 in buildTree per P2. Root node total = published Total Revenues (nets the negative).
// (Dollars in Thousands × 1000 = dollars)
const REVENUE = {
  2022: { total: 29_208_709_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                                           total:  28_933_826_000 },
    { name: 'Other',                                                           total:     612_624_000 },
    { name: 'Rights and Privileges',                                           total:     114_342_000 },
    { name: 'Institutional Revenue',                                           total:      34_557_000 },
    { name: 'Federal Grants and Contracts',                                    total:      11_725_000 },
    { name: 'Interest, Dividends, Rents, and Other Investment Income',         total:    -498_365_000 }, // NEGATIVE — P2 clamp to 0 in buildTree
  ]},
  2023: { total: 28_408_798_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                                           total:  27_055_653_000 },
    { name: 'Other',                                                           total:     633_410_000 },
    { name: 'Interest, Dividends, Rents, and Other Investment Income',         total:     550_482_000 },
    { name: 'Rights and Privileges',                                           total:     125_679_000 },
    { name: 'Institutional Revenue',                                           total:      32_315_000 },
    { name: 'Federal Grants and Contracts',                                    total:      11_259_000 },
  ]},
  2024: { total: 32_875_046_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                                           total:  30_902_342_000 },
    { name: 'Interest, Dividends, Rents, and Other Investment Income',         total:   1_255_816_000 },
    { name: 'Other',                                                           total:     543_168_000 },
    { name: 'Rights and Privileges',                                           total:     120_541_000 },
    { name: 'Institutional Revenue',                                           total:      39_326_000 },
    { name: 'Federal Grants and Contracts',                                    total:      13_853_000 },
  ]},
  2025: { total: 31_593_096_000, confidence: 'actual', categories: [
    { name: 'Taxes',                                                           total:  29_482_661_000 },
    { name: 'Interest, Dividends, Rents, and Other Investment Income',         total:   1_380_276_000 },
    { name: 'Other',                                                           total:     544_065_000 },
    { name: 'Rights and Privileges',                                           total:     137_624_000 },
    { name: 'Institutional Revenue',                                           total:      39_394_000 },
    { name: 'Federal Grants and Contracts',                                    total:       9_076_000 },
  ]},
};

// P2: clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) { catSum += cat.total; }
  if (Math.abs(catSum - total) > 10_000_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total}`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  }); // keep all including 0-clamped negatives (shown as 0 area, visible in label)
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Virginia General Fund Revenue', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: `${STATE_NAME} General Fund Revenue`, api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'va-gf-revenue', base_url: 'https://www.doa.virginia.gov/reports/ACFReport/', fiscal_years: [2022,2023,2024,2025], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(58)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(78));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(56)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    // Show true signed value for FY2022 negative category
    if (fy === 2022) { const inv = REVENUE[2022].categories.find(c => c.name === 'Interest, Dividends, Rents, and Other Investment Income'); if (inv && inv.total < 0) console.log(`  [Note: Interest/Investment Income true value: ${inv.total.toLocaleString()} (net loss — shown at 0)]`); }
    console.log('─'.repeat(78)); console.log(`${'TOTAL REVENUES'.padEnd(58)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Post-RPC source stamp (P4: targeted UPDATE; RPC does not set source_url/source_date). Idempotent.
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
