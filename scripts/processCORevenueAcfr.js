#!/usr/bin/env node
/**
 * Colorado General Fund Revenue (by source) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Colorado Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Revenue is NEW on the CO state node → pure insert keyed (muni,fy,'revenue').
 *   CO state node resolved by name + state + entity_type and asserted equal to EXPECTED_MUNI_ID.
 *
 * SCOPE NOTE (ACFR-31): CO ACFR GF ~1.81× NASBO GF — "Federal Grants and Contracts"
 *   ($9,692,569K FY2024) consolidated into the GAAP GF. Accepted-and-relabelled honestly.
 *
 * TABOR / P2 CLAMP (ACFR-32 — the tranche's live clamp exercise): FY2024 "TABOR Excess
 *   Revenue" = −1,214,908 (thousands), a standalone NEGATIVE revenue line for Colorado's
 *   constitutional refund mechanism. Transcribed SIGNED; validate() ties on signed values;
 *   render clamps to 0 with the signed magnitude in the label; root carries the printed total.
 *   TABOR presentation varies by year: FY2023 netted the refund into Individual Income Tax
 *   (no standalone line). Every loaded year checked for BOTH forms — see loader data comments.
 *
 * ACCESS: every osc.colorado.gov fetch requires a Referer header matching the ACFR landing
 *   page (403 without it). Mild WAF, no cookies needed.
 *
 * WINDOW NOTE (D-12): FY2023–FY2025 only — pre-FY2023 vanished in a site/domain migration.
 *
 * NEGATIVE-LINE NOTE (ACFR-32): FY2024 TABOR Excess Revenue = −1,214,908K (standalone negative line, clamped at render); FY2023 netted TABOR into Individual Income Tax (no standalone line); FY2025 checked for both forms at transcription.
 *
 * UNITS = thousands: ×1,000 to store dollars. Control = printed GENERAL FUND column
 *   "Total revenues" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/co/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processCORevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Colorado'; const STATE_ABBR = 'CO'; const POPULATION = 5_773_714;
const EXPECTED_MUNI_ID = '89d2aff1-6980-4c20-80fe-513618bce8ac';
const UNITS = 1_000; // CO ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs (no derivable pattern).
const SOURCES = {
  2023: { url: 'https://osc.colorado.gov/sites/osc/files/acfr23.pdf', date: '2023-06-30' },
  2024: { url: 'https://osc.colorado.gov/sites/osc/files/documents/FY2024%20ACFR%20Final%20-%20Color%20Corrected_ADA.pdf', date: '2024-06-30' },
  2025: { url: 'https://osc.colorado.gov/sites/osc/files/documents/FY2025%20ACFR_ADA_1.30.26.pdf', date: '2025-06-30' },
};
const dataSource = (fy) => `Colorado State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// GF revenues by source — CO ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const REVENUE = {
  2023: { total: 24_912_540, confidence: 'actual', categories: [
    { name: 'Individual and Fiduciary Income taxes', total:    6_515_803 },
    { name: 'Corporate Income taxes',                total:    2_166_610 },
    { name: 'Sales and Use taxes',                   total:    4_815_433 },
    { name: 'Excise taxes',                          total:      104_054 },
    { name: 'Other Taxes',                           total:      516_996 },
    { name: 'Licenses, Permits, and Fines',          total:       89_541 },
    { name: 'Charges for Goods and Services',        total:       90_435 },
    { name: 'Rents',                                 total:          130 },
    { name: 'Investment Income (Loss)',              total:       57_313 },
    { name: 'Federal Grants and Contracts',          total:   10_228_462 },
    { name: 'Other',                                 total:      327_763 },
  ]},
  2024: { total: 26_271_588, confidence: 'actual', categories: [
    { name: 'Individual and Fiduciary Income taxes', total:    8_600_413 },
    { name: 'Corporate Income taxes',                total:    2_534_576 },
    { name: 'Sales and Use taxes',                   total:    4_891_494 },
    { name: 'Excise taxes',                          total:       98_118 },
    { name: 'TABOR Excess Revenue',                  total:   -1_214_908 },
    { name: 'Other Taxes',                           total:      542_303 },
    { name: 'Licenses, Permits, and Fines',          total:       98_735 },
    { name: 'Charges for Goods and Services',        total:      127_401 },
    { name: 'Rents',                                 total:          491 },
    { name: 'Investment Income (Loss)',              total:      549_275 },
    { name: 'Federal Grants and Contracts',          total:    9_692_569 },
    { name: 'Other',                                 total:      351_121 },
  ]},
  2025: { total: 27_950_701, confidence: 'actual', categories: [
    { name: 'Individual and Fiduciary Income taxes', total:    8_769_457 },
    { name: 'Corporate Income taxes',                total:    2_352_931 },
    { name: 'Sales and Use taxes',                   total:    4_874_687 },
    { name: 'Excise taxes',                          total:       97_473 },
    { name: 'TABOR Excess Revenue',                  total:     -129_536 },
    { name: 'Other Taxes',                           total:      659_689 },
    { name: 'Licenses, Permits, and Fines',          total:       16_823 },
    { name: 'Charges for Goods and Services',        total:      144_515 },
    { name: 'Rents',                                 total:          481 },
    { name: 'Investment Income (Loss)',              total:      422_016 },
    { name: 'Federal Grants and Contracts',          total:   10_295_103 },
    { name: 'Other',                                 total:      447_062 },
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
  return { jsonTree: [{ n: 'Colorado General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2023, 2024, 2025];
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
    const srcPayload = { name: 'Colorado General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'co-acfr-gf-revenue', base_url: 'https://osc.colorado.gov/financial-operations/financial-reports/acfr', fiscal_years: [2023,2024,2025], municipality_id: muniId };
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
