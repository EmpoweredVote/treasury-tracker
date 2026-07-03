#!/usr/bin/env node
/**
 * Colorado General Fund Operating (Expenditure) Loader — ACTUAL (ACFR GAAP basis)
 * Source: State of Colorado Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures, and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands).
 *
 * Phase 113. Replaces the NASBO operating rows on the CO state node in place (same (muni,fy,'operating') RPC key) for FY2023/FY2024; other FYs net-new.
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
 *   "Total expenditures" (validate() tolerance 10 thousands; extraction: pdftotext -table
 *   on local copies in _acfr-work/co/, tie-verified per year).
 *
 * Usage:
 *   node scripts/processCOAcfr.js [--dry-run] [--fy YYYY]
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
const dataSource = (fy) => `Colorado State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — CO ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Extracted via pdftotext -table + tie-verified vs the printed GF total, every FY.
const EXPENDITURES = {
  2023: { total: 24_805_259, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      353_304 },
    { name: 'Business, Community, and Consumer Affairs', total:      287_747 },
    { name: 'Education',                                 total:    1_136_311 },
    { name: 'Health and Rehabilitation',                 total:    1_234_024 },
    { name: 'Justice',                                   total:    1_868_339 },
    { name: 'Natural Resources',                         total:       45_219 },
    { name: 'Social Assistance',                         total:   11_172_032 },
    { name: 'Capital Outlay',                            total:      200_813 },
    { name: 'Intergovernmental — Cities',                total:      114_910 },
    { name: 'Intergovernmental — Counties',              total:    1_660_926 },
    { name: 'Intergovernmental — School Districts',      total:    5_879_919 },
    { name: 'Intergovernmental — Special Districts',     total:       93_069 },
    { name: 'Intergovernmental — Federal',               total:        2_943 },
    { name: 'Intergovernmental — Other',                 total:      621_152 },
    { name: 'Debt Service',                              total:      134_551 },
  ]},
  2024: { total: 24_875_053, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      422_239 },
    { name: 'Business, Community, and Consumer Affairs', total:      342_014 },
    { name: 'Education',                                 total:    1_286_299 },
    { name: 'Health and Rehabilitation',                 total:      976_155 },
    { name: 'Justice',                                   total:    1_292_749 },
    { name: 'Natural Resources',                         total:       49_969 },
    { name: 'Social Assistance',                         total:   11_750_071 },
    { name: 'Capital Outlay',                            total:      161_027 },
    { name: 'Intergovernmental — Cities',                total:       94_520 },
    { name: 'Intergovernmental — Counties',              total:    1_796_801 },
    { name: 'Intergovernmental — School Districts',      total:    6_335_003 },
    { name: 'Intergovernmental — Special Districts',     total:       89_483 },
    { name: 'Intergovernmental — Federal',               total:        5_893 },
    { name: 'Intergovernmental — Other',                 total:      121_423 },
    { name: 'Debt Service',                              total:      151_407 },
  ]},
  2025: { total: 27_559_901, confidence: 'actual', categories: [
    { name: 'General Government',                        total:      440_832 },
    { name: 'Business, Community, and Consumer Affairs', total:      537_113 },
    { name: 'Education',                                 total:    1_400_976 },
    { name: 'Health and Rehabilitation',                 total:    1_312_477 },
    { name: 'Justice',                                   total:    1_774_973 },
    { name: 'Natural Resources',                         total:       56_017 },
    { name: 'Social Assistance',                         total:   13_424_559 },
    { name: 'Transportation',                            total:       28_169 },
    { name: 'Capital Outlay',                            total:      188_526 },
    { name: 'Intergovernmental — Cities',                total:      151_813 },
    { name: 'Intergovernmental — Counties',              total:    1_942_426 },
    { name: 'Intergovernmental — School Districts',      total:    5_730_296 },
    { name: 'Intergovernmental — Special Districts',     total:       87_224 },
    { name: 'Intergovernmental — Federal',               total:       20_305 },
    { name: 'Intergovernmental — Other',                 total:      305_952 },
    { name: 'Debt Service',                              total:      158_243 },
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
  return { jsonTree: [{ n: 'Colorado General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2023, 2024, 2025];
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
    const srcPayload = { name: 'Colorado General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'co-acfr-gf-operating', base_url: 'https://osc.colorado.gov/financial-operations/financial-reports/acfr', fiscal_years: [2023,2024,2025], municipality_id: muniId };
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
