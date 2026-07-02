#!/usr/bin/env node
/**
 * Virginia General Fund Operating (Expenditure) Loader — FY2022-FY2025 ACTUAL
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
 * Extraction method: pdftotext -table on downloaded G_Major_Governmental_Funds.pdf
 *   (per-section PDF, ~100KB, FY2022 from www.doa.virginia.gov; FY2023-2025 from
 *   doa.virginia.gov). GENERAL FUND = first fund column on the statement.
 *   All 4 expenditure-total checksums verified to 0 diff vs. published ACFR totals.
 *   FY2022 source_url: www.doa.virginia.gov (full-path absolute — Pitfall 2 / A5).
 *
 * Usage:
 *   node scripts/processVAAcfr.js [--dry-run] [--fy YYYY]
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
// FY2022 uses www.doa.virginia.gov absolute URL (Pitfall 2 / A5 — FY2022 index returned
// relative paths; full absolute path confirmed to resolve).
const SOURCES = {
  2022: { url: 'https://www.doa.virginia.gov/reports/ACFReport/2022/G_Major_Governmental_Funds.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.doa.virginia.gov/reports/ACFReport/2023/G_Major_Governmental_Funds.pdf', date: '2023-06-30' },
  2024: { url: 'https://doa.virginia.gov/reports/ACFReport/2024/G_Major_Governmental_Funds.pdf', date: '2024-06-30' },
  2025: { url: 'https://doa.virginia.gov/reports/ACFReport/2025/G_Major_Governmental_Funds.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `State of Virginia ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// General Fund expenditures by function — Commonwealth of Virginia ACFR, GENERAL FUND column
// (in $). Function-level totals only (depth-1 leaves under the GF root; lineItems = []).
// Verbatim ACFR function names from the Governmental Funds statement, Section G.
// Sums verified to zero diff vs. published ACFR Total Expenditures (all years).
// Debt Service Principal Retirement and Interest and Charges are included as published.
// (Dollars in Thousands × 1000 = dollars)
const EXPENDITURES = {
  2022: { total: 25_212_453_000, confidence: 'actual', categories: [
    { name: 'Education',                           total: 11_360_502_000, lineItems: [] },
    { name: 'Individual and Family Services',      total:  7_223_575_000, lineItems: [] },
    { name: 'Administration of Justice',           total:  3_125_944_000, lineItems: [] },
    { name: 'General Government',                  total:  2_791_480_000, lineItems: [] },
    { name: 'Resources and Economic Development',  total:    620_787_000, lineItems: [] },
    { name: 'Capital Outlay',                      total:     66_526_000, lineItems: [] },
    { name: 'Debt Service — Principal Retirement', total:     20_571_000, lineItems: [] },
    { name: 'Debt Service — Interest and Charges', total:      2_904_000, lineItems: [] },
    { name: 'Transportation',                      total:        164_000, lineItems: [] },
  ]},
  2023: { total: 28_345_459_000, confidence: 'actual', categories: [
    { name: 'Education',                           total: 12_700_072_000, lineItems: [] },
    { name: 'Individual and Family Services',      total:  8_300_820_000, lineItems: [] },
    { name: 'Administration of Justice',           total:  3_547_119_000, lineItems: [] },
    { name: 'General Government',                  total:  2_806_514_000, lineItems: [] },
    { name: 'Resources and Economic Development',  total:    775_576_000, lineItems: [] },
    { name: 'Capital Outlay',                      total:    164_837_000, lineItems: [] },
    { name: 'Debt Service — Principal Retirement', total:     35_256_000, lineItems: [] },
    { name: 'Debt Service — Interest and Charges', total:      2_835_000, lineItems: [] },
    { name: 'Transportation',                      total:     12_430_000, lineItems: [] },
  ]},
  2024: { total: 31_022_979_000, confidence: 'actual', categories: [
    { name: 'Education',                           total: 13_694_848_000, lineItems: [] },
    { name: 'Individual and Family Services',      total:  9_459_626_000, lineItems: [] },
    { name: 'Administration of Justice',           total:  3_686_906_000, lineItems: [] },
    { name: 'General Government',                  total:  2_777_821_000, lineItems: [] },
    { name: 'Resources and Economic Development',  total:    946_076_000, lineItems: [] },
    { name: 'Capital Outlay',                      total:    395_616_000, lineItems: [] },
    { name: 'Debt Service — Principal Retirement', total:     24_589_000, lineItems: [] },
    { name: 'Debt Service — Interest and Charges', total:      4_675_000, lineItems: [] },
    { name: 'Transportation',                      total:     32_822_000, lineItems: [] },
  ]},
  2025: { total: 34_099_267_000, confidence: 'actual', categories: [
    { name: 'Education',                           total: 14_914_898_000, lineItems: [] },
    { name: 'Individual and Family Services',      total: 10_618_319_000, lineItems: [] },
    { name: 'Administration of Justice',           total:  3_909_622_000, lineItems: [] },
    { name: 'General Government',                  total:  2_867_979_000, lineItems: [] },
    { name: 'Resources and Economic Development',  total:  1_078_659_000, lineItems: [] },
    { name: 'Capital Outlay',                      total:    539_013_000, lineItems: [] },
    { name: 'Debt Service — Principal Retirement', total:     27_430_000, lineItems: [] },
    { name: 'Debt Service — Interest and Charges', total:      6_014_000, lineItems: [] },
    { name: 'Transportation',                      total:    137_333_000, lineItems: [] },
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
  return { jsonTree: [{ n: 'Virginia General Fund Budget', a: total, c: children }], total, rowCount: categories.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    // find-or-create/update the data_source row for VA operating (updates base_url from DPB to DOA ACFR)
    const srcPayload = { name: `${STATE_NAME} General Fund Operating Budget`, api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'va-gf-operating', base_url: 'https://www.doa.virginia.gov/reports/ACFReport/', fiscal_years: [2022,2023,2024,2025], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL EXPENDITURES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
    // Post-RPC source stamp (P4: targeted UPDATE; RPC does not set source_url/source_date). Idempotent.
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
