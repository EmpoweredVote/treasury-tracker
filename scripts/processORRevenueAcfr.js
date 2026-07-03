#!/usr/bin/env node
/**
 * Oregon General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Oregon Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the OR state node → pure insert keyed (muni,fy,'revenue').
 *   OR state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): OR ACFR GF ~1.07× NASBO GF — smallest relabel risk in Batch 1.
 *   Oregon's federal flows route mostly through the separate "Health and Social Services" /
 *   "Public Transportation" fund columns; Federal inside the GF column itself is small.
 *
 * WINDOW NOTE (D-06): FY2005–FY2021 files exist historically (Wayback CDX) but 404 on the
 *   live site — EXCLUDED per the durable-URL rule. FY2022–FY2025 is the honest full window.
 *
 * ROUNDING: Oregon rounds line items independently; leaf sums differ from the printed
 *   section totals by ±1–3 (thousands). validate() tolerance = 10 (thousands); the stored
 *   root total is the PRINTED total.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): No negative GF lines in any loaded year (Investment Income positive throughout).
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/or/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processORRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Oregon'; const STATE_ABBR = 'OR'; const POPULATION = 4_237_256;
const EXPECTED_MUNI_ID = '7686da27-5d64-44c2-bae2-f8c85c073e37';
const UNITS = 1_000; // OR ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2022: { url: 'https://www.oregon.gov/das/Financial/Acctng/Documents/2022%20ACFR.pdf', date: '2022-06-30' },
  2023: { url: 'https://www.oregon.gov/das/Financial/Acctng/Documents/2023ACFR.pdf', date: '2023-06-30' },
  2024: { url: 'https://www.oregon.gov/das/Financial/Acctng/Documents/2024_ACFR.pdf', date: '2024-06-30' },
  2025: { url: 'https://www.oregon.gov/das/Financial/Acctng/Documents/2025.ACFR.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Oregon State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — OR ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2022: { total: 15_711_953, confidence: 'actual', categories: [
    { name: 'Personal Income Taxes',             total:   12_325_489 },
    { name: 'Corporate Income Taxes',            total:    1_532_104 },
    { name: 'Corporate Activity Taxes',          total:        7_947 },
    { name: 'Tobacco Taxes',                     total:       54_393 },
    { name: 'Healthcare Provider Taxes',         total:          647 },
    { name: 'Insurance Premium Taxes',           total:       85_403 },
    { name: 'Employer-Employee Taxes',           total:      122_057 },
    { name: 'Other Taxes',                       total:      548_784 },
    { name: 'Licenses and Fees',                 total:      118_970 },
    { name: 'Federal',                           total:      774_969 },
    { name: 'Rebates and Recoveries',            total:        1_191 },
    { name: 'Charges for Services',              total:       26_405 },
    { name: 'Fines, Forfeitures, and Penalties', total:       17_581 },
    { name: 'Rents and Royalties',               total:          798 },
    { name: 'Investment Income',                 total:       59_464 },
    { name: 'Sales',                             total:          373 },
    { name: 'Donations and Grants',              total:        4_635 },
    { name: 'Other',                             total:       30_744 },
  ]},
  2023: { total: 16_762_956, confidence: 'actual', categories: [
    { name: 'Personal Income Taxes',             total:   13_186_929 },
    { name: 'Corporate Income Taxes',            total:    1_617_850 },
    { name: 'Corporate Activity Taxes',          total:        7_947 },
    { name: 'Tobacco Taxes',                     total:       54_344 },
    { name: 'Healthcare Provider Taxes',         total:          661 },
    { name: 'Insurance Premium Taxes',           total:       84_985 },
    { name: 'Employer-Employee Taxes',           total:      132_688 },
    { name: 'Other Taxes',                       total:      529_139 },
    { name: 'Licenses and Fees',                 total:      121_518 },
    { name: 'Federal',                           total:      617_777 },
    { name: 'Rebates and Recoveries',            total:        2_684 },
    { name: 'Charges for Services',              total:       28_437 },
    { name: 'Fines, Forfeitures, and Penalties', total:       18_677 },
    { name: 'Rents and Royalties',               total:          874 },
    { name: 'Investment Income',                 total:      341_177 },
    { name: 'Sales',                             total:        3_177 },
    { name: 'Donations and Grants',              total:        2_459 },
    { name: 'Other',                             total:       11_634 },
  ]},
  2024: { total: 16_151_462, confidence: 'actual', categories: [
    { name: 'Personal Income Taxes',             total:   12_649_950 },
    { name: 'Corporate Income Taxes',            total:    1_631_724 },
    { name: 'Corporate Activity Taxes',          total:       10_475 },
    { name: 'Tobacco Taxes',                     total:       43_305 },
    { name: 'Healthcare Provider Taxes',         total:          660 },
    { name: 'Insurance Premium Taxes',           total:       77_127 },
    { name: 'Employer-Employee Taxes',           total:      135_511 },
    { name: 'Other Taxes',                       total:      583_737 },
    { name: 'Licenses and Fees',                 total:      122_310 },
    { name: 'Federal',                           total:      194_275 },
    { name: 'Rebates and Recoveries',            total:        3_315 },
    { name: 'Charges for Services',              total:       29_986 },
    { name: 'Fines, Forfeitures, and Penalties', total:       20_123 },
    { name: 'Rents and Royalties',               total:          868 },
    { name: 'Investment Income',                 total:      569_344 },
    { name: 'Sales',                             total:        1_535 },
    { name: 'Donations and Grants',              total:        5_401 },
    { name: 'Other',                             total:       71_813 },
  ]},
  2025: { total: 17_291_987, confidence: 'actual', categories: [
    { name: 'Personal Income Taxes',             total:   14_139_606 },
    { name: 'Corporate Income Taxes',            total:    1_515_346 },
    { name: 'Corporate Activity Taxes',          total:       10_836 },
    { name: 'Tobacco Taxes',                     total:       44_196 },
    { name: 'Healthcare Provider Taxes',         total:          450 },
    { name: 'Insurance Premium Taxes',           total:      109_117 },
    { name: 'Employer-Employee Taxes',           total:      139_183 },
    { name: 'Other Taxes',                       total:      698_912 },
    { name: 'Licenses and Fees',                 total:      124_548 },
    { name: 'Federal',                           total:       16_441 },
    { name: 'Rebates and Recoveries',            total:       12_999 },
    { name: 'Charges for Services',              total:       29_550 },
    { name: 'Fines, Forfeitures, and Penalties', total:       20_195 },
    { name: 'Rents and Royalties',               total:          749 },
    { name: 'Investment Income',                 total:      411_848 },
    { name: 'Sales',                             total:        1_733 },
    { name: 'Donations and Grants',              total:        4_174 },
    { name: 'Other',                             total:       12_105 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Oregon General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    if (muni.id !== EXPECTED_MUNI_ID) { console.error(`Resolved node ${muni.id} ≠ expected ${EXPECTED_MUNI_ID} — refusing to write`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Oregon General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'or-acfr-gf-revenue', base_url: 'https://www.oregon.gov/das/Financial/Acctng/Pages/index.aspx', fiscal_years: [2022,2023,2024,2025], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL REVENUES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
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
