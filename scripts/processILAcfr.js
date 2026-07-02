#!/usr/bin/env node
/**
 * Illinois General Fund Operating (Expenditure) Loader — FY2021-FY2025 ACTUAL
 * Source: State of Illinois Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Illinois Comptroller.
 *   Per-FY source URL below (illinoiscomptroller.gov CAFR ACFR Final … files).
 *
 * Phase 105 (ACFR-07). Replaces the NASBO operating rows on the IL state node in place
 *   (same (muni,fy,'operating') RPC key). IL state node resolved by
 *   name='Illinois', state='IL', entity_type='state'.
 *
 * USE FINAL AUDITED FILES ONLY — the Illinois Comptroller also publishes an
 *   "Interim … unaudited" ACFR for each fiscal year (e.g. "FY24 Interim ACFR unaudited.pdf").
 *   The loader MUST NEVER point at the interim/unaudited file. The SOURCES map uses
 *   EXPLICIT per-year filenames (not a derived pattern) because the naming varies:
 *   FY2021 has no "Bookmarked" suffix; FY2022 uses "ACFR Final FY 2022.pdf" (with "FY"
 *   prefix); FY2023-FY2025 use "ACFR Final {YYYY} - Bookmarked.pdf".
 *
 * UNITS = thousands (D-05/recon): ×1,000 to store dollars (same as FL/CA).
 *
 * TX-TRAP SCOPE NOTE (D-04): IL ACFR General Fund ~1.5× NASBO GF because the GAAP General
 *   Fund consolidates federal intergovernmental revenue (~$22.1B) that NASBO's budgetary
 *   concept excludes. This is the same mechanism as TX (~3×) and PA (~2×). The divergence
 *   is accepted-and-relabelled honestly: GAAP basis label in dataSource(), confirmed at load
 *   in Plan 105-03.
 *
 * Control = printed General-Fund-column "Total expenditures". Each FY's transcribed
 *   spend-by-function categories must tie to the printed Total (in thousands) or the loader
 *   refuses to write (process.exit(2)). Tolerance = 10,000 thousands (same as FL).
 *   All 5 years tie to 0 diff vs. the printed General-Fund Total expenditures.
 *
 * Bookend ties (GENERAL FUND Total revenues, thousands): FY2025 = 78,342,927 ; FY2023 = 73,827,795.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-work/il/ (NOT -layout).
 *
 * Usage:
 *   node scripts/processILAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Illinois'; const STATE_ABBR = 'IL'; const POPULATION = 12_812_508;
const UNITS = 1_000; // IL ACFR is in thousands → ×1,000 to store dollars
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// EXPLICIT per-year URLs — ACFR FINAL AUDITED files only (no Interim/unaudited).
// FY2021: no Bookmarked suffix; FY2022: uses "FY" prefix in filename;
// FY2023-FY2025: Bookmarked suffix. URL-encode spaces as %20.
const IL_BASE = 'https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR';
const SOURCES = {
  2021: { url: `${IL_BASE}/ACFR%20Final%202021.pdf`,                   date: '2021-06-30' }, // no Bookmarked suffix
  2022: { url: `${IL_BASE}/ACFR%20Final%20FY%202022.pdf`,              date: '2022-06-30' }, // "FY" prefix in filename (per redirect)
  2023: { url: `${IL_BASE}/ACFR%20Final%202023%20-%20Bookmarked.pdf`,  date: '2023-06-30' }, // Bookmarked
  2024: { url: `${IL_BASE}/ACFR%20Final%202024%20-%20Bookmarked.pdf`,  date: '2024-06-30' }, // Bookmarked
  2025: { url: `${IL_BASE}/ACFR%20Final%202025%20-%20Bookmarked.pdf`,  date: '2025-06-30' }, // Bookmarked
};
const dataSource = (fy) => `Illinois State ACFR — General Fund (FY${fy} actual, GAAP basis)`;

// GF expenditures by function — IL ACFR, GENERAL FUND column (raw thousands; ×UNITS → dollars).
// Verbatim ACFR function names from the Governmental Funds Statement of Rev/Exp/Changes.
// total = printed General-Fund "Total expenditures" (thousands). All 5 FYs tie 0 diff.
const EXPENDITURES = {
  2021: { total: 59_523_406, confidence: 'actual', categories: [
    { name: 'Health and social services',            total: 32_608_228 },
    { name: 'Education',                             total: 19_019_947 },
    { name: 'Public protection and justice',         total:  3_316_060 },
    { name: 'General government',                    total:  2_791_621 },
    { name: 'Employment and economic development',   total:    965_115 },
    { name: 'Transportation',                        total:    557_793 },
    { name: 'Environment and business regulation',   total:    164_255 },
    { name: 'Capital outlays',                       total:     91_186 },
    { name: 'Debt service — Principal',              total:      3_653 },
    { name: 'Debt service — Interest',               total:      5_548 },
  ]},
  2022: { total: 62_089_769, confidence: 'actual', categories: [
    { name: 'Health and social services',            total: 33_809_300 },
    { name: 'Education',                             total: 20_239_433 },
    { name: 'Public protection and justice',         total:  3_378_538 },
    { name: 'General government',                    total:  2_915_782 },
    { name: 'Employment and economic development',   total:    796_958 },
    { name: 'Transportation',                        total:    658_583 },
    { name: 'Environment and business regulation',   total:    171_931 },
    { name: 'Capital outlays',                       total:     94_429 },
    { name: 'Debt service — Principal',              total:     18_616 },
    { name: 'Debt service — Interest',               total:      6_199 },
  ]},
  2023: { total: 68_661_594, confidence: 'actual', categories: [
    { name: 'Health and social services',            total: 39_637_192 },
    { name: 'Education',                             total: 21_232_961 },
    { name: 'General government',                    total:  3_254_195 },
    { name: 'Public protection and justice',         total:  2_581_735 },
    { name: 'Employment and economic development',   total:    766_742 },
    { name: 'Transportation',                        total:    705_989 },
    { name: 'Environment and business regulation',   total:    196_877 },
    { name: 'Capital outlays',                       total:    235_496 },
    { name: 'Debt service — Principal',              total:     44_245 },
    { name: 'Debt service — Interest',               total:      6_162 },
  ]},
  2024: { total: 71_610_582, confidence: 'actual', categories: [
    { name: 'Health and social services',            total: 41_164_205 },
    { name: 'Education',                             total: 22_176_693 },
    { name: 'Public protection and justice',         total:  3_469_765 },
    { name: 'General government',                    total:  2_992_775 },
    { name: 'Employment and economic development',   total:    538_811 },
    { name: 'Transportation',                        total:    702_072 },
    { name: 'Environment and business regulation',   total:    223_396 },
    { name: 'Capital outlays',                       total:    285_447 },
    { name: 'Debt service — Principal',              total:     50_235 },
    { name: 'Debt service — Interest',               total:      7_183 },
  ]},
  2025: { total: 75_456_922, confidence: 'actual', categories: [
    { name: 'Health and social services',            total: 43_249_748 },
    { name: 'Education',                             total: 23_127_480 },
    { name: 'Public protection and justice',         total:  3_841_119 },
    { name: 'General government',                    total:  3_311_689 },
    { name: 'Transportation',                        total:    760_380 },
    { name: 'Employment and economic development',   total:    519_699 },
    { name: 'Environment and business regulation',   total:    279_868 },
    { name: 'Capital outlays',                       total:    249_394 },
    { name: 'Debt service — Principal',              total:    108_108 },
    { name: 'Debt service — Interest',               total:      9_437 },
  ]},
};

// P2 clamp (ACFR-08): clamp negative rendered area to 0; preserve signed value in label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = EXPENDITURES[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = EXPENDITURES[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Illinois General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Operating Loader (ACTUAL — ACFR GAAP basis, thousands×${UNITS.toLocaleString()})${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
  }
  let ds;
  if (!dryRun) {
    const srcPayload = { name: 'Illinois General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'il-acfr-gf-operating', base_url: 'https://illinoiscomptroller.gov/financial-reports-data/find-a-report/comprehensive-reporting/annual-comprehensive-financial-report/', fiscal_years: [2021,2022,2023,2024,2025], municipality_id: muniId };
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
