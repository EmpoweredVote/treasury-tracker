#!/usr/bin/env node
/**
 * Oregon General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Oregon Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the OR state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/or/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processORAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Oregon State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — OR ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2022: { total: 13_673_575, confidence: 'actual', categories: [
    { name: 'Education',                          total:      351_428 },
    { name: 'Human Resources',                    total:    3_009_959 },
    { name: 'Public Safety',                      total:    1_288_560 },
    { name: 'Economic and Community Development', total:      166_702 },
    { name: 'Natural Resources',                  total:      236_686 },
    { name: 'Transportation',                     total:       29_202 },
    { name: 'Consumer and Business Services',     total:        8_601 },
    { name: 'Administration',                     total:      379_468 },
    { name: 'Legislative',                        total:       60_362 },
    { name: 'Judicial',                           total:      469_183 },
    { name: 'Intergovernmental',                  total:    6_704_447 },
    { name: 'Capital Outlay',                     total:      549_082 },
    { name: 'Debt service — Principal',           total:      258_559 },
    { name: 'Debt service — Interest',            total:      160_929 },
    { name: 'Other Debt Service',                 total:          408 },
  ]},
  2023: { total: 14_859_176, confidence: 'actual', categories: [
    { name: 'Education',                          total:      317_840 },
    { name: 'Human Resources',                    total:    3_400_720 },
    { name: 'Public Safety',                      total:    1_408_925 },
    { name: 'Economic and Community Development', total:      250_068 },
    { name: 'Natural Resources',                  total:      309_168 },
    { name: 'Transportation',                     total:        2_154 },
    { name: 'Consumer and Business Services',     total:       28_408 },
    { name: 'Administration',                     total:      437_057 },
    { name: 'Legislative',                        total:       73_958 },
    { name: 'Judicial',                           total:      525_617 },
    { name: 'Intergovernmental',                  total:    7_422_703 },
    { name: 'Capital Outlay',                     total:      219_520 },
    { name: 'Debt service — Principal',           total:      291_559 },
    { name: 'Debt service — Interest',            total:      170_876 },
    { name: 'Other Debt Service',                 total:          603 },
  ]},
  2024: { total: 16_455_067, confidence: 'actual', categories: [
    { name: 'Education',                          total:      424_811 },
    { name: 'Human Resources',                    total:    4_682_632 },
    { name: 'Public Safety',                      total:    1_514_470 },
    { name: 'Economic and Community Development', total:      328_475 },
    { name: 'Natural Resources',                  total:      298_045 },
    { name: 'Transportation',                     total:       31_794 },
    { name: 'Consumer and Business Services',     total:       14_390 },
    { name: 'Administration',                     total:      434_671 },
    { name: 'Legislative',                        total:       73_470 },
    { name: 'Judicial',                           total:      613_852 },
    { name: 'Intergovernmental',                  total:    7_366_852 },
    { name: 'Capital Outlay',                     total:      138_194 },
    { name: 'Debt service — Principal',           total:      328_032 },
    { name: 'Debt service — Interest',            total:      204_967 },
    { name: 'Other Debt Service',                 total:          411 },
  ]},
  2025: { total: 17_774_745, confidence: 'actual', categories: [
    { name: 'Education',                          total:      340_685 },
    { name: 'Human Resources',                    total:    5_272_636 },
    { name: 'Public Safety',                      total:    1_953_589 },
    { name: 'Economic and Community Development', total:      394_364 },
    { name: 'Natural Resources',                  total:      430_694 },
    { name: 'Transportation',                     total:       30_395 },
    { name: 'Consumer and Business Services',     total:       19_202 },
    { name: 'Administration',                     total:      581_322 },
    { name: 'Legislative',                        total:       91_162 },
    { name: 'Judicial',                           total:      361_480 },
    { name: 'Intergovernmental',                  total:    7_573_845 },
    { name: 'Capital Outlay',                     total:      161_932 },
    { name: 'Debt service — Principal',           total:      343_865 },
    { name: 'Debt service — Interest',            total:      218_928 },
    { name: 'Other Debt Service',                 total:          645 },
  ]},
};

// P2 clamp (ACFR-32): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net refund/loss — shown at 0; actual ${(cat.total * UNITS).toLocaleString()})` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Oregon General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Oregon General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'or-acfr-gf-operating', base_url: 'https://www.oregon.gov/das/Financial/Acctng/Pages/index.aspx', fiscal_years: [2022,2023,2024,2025], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(52)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(72));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,50).padEnd(50)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = EXPENDITURES[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (clamped at render)]`);
    console.log('─'.repeat(72)); console.log(`${'TOTAL EXPENDITURES'.padEnd(52)}${Math.round(total).toLocaleString().padStart(18)}`);
    console.log(`Per-capita: $${Math.round(total/POPULATION).toLocaleString()}/person\n`);
    if (dryRun) { console.log(`(dry-run)\n`); continue; }
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr) { console.error(`RPC error: ${rpcErr.message}`); process.exit(2); }
    if (r?.error) { console.error(`RPC error: ${r.error}`); process.exit(2); }
    console.log(`Loaded ${r?.rows_inserted ?? rowCount} rows for FY${fy}`);
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
