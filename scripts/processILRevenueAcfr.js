#!/usr/bin/env node
/**
 * Illinois General Fund Revenue (by source) Loader — FY2021-FY2025 ACTUAL
 * Source: State of Illinois Annual Comprehensive Financial Report (ACFR), Governmental Funds
 *   Statement of Revenues, Expenditures and Changes in Fund Balances, GENERAL FUND column
 *   (GAAP basis, in thousands). Published by the Illinois Comptroller.
 *
 * Phase 105 (ACFR-07 + ACFR-08 + RECON-05). Revenue is NEW on the IL state node (NASBO had no
 *   revenue-by-source) → pure insert keyed (muni,fy,'revenue'). Node resolved by
 *   name='Illinois', state='IL', entity_type='state'.
 *
 * USE FINAL AUDITED FILES ONLY — the Illinois Comptroller also publishes an
 *   "Interim … unaudited" ACFR for each fiscal year (e.g. "FY24 Interim ACFR unaudited.pdf").
 *   The loader MUST NEVER point at the interim/unaudited file. The SOURCES map uses
 *   EXPLICIT per-year filenames (not a derived pattern) because the naming varies:
 *   FY2021 has no "Bookmarked" suffix; FY2022 uses "ACFR Final FY 2022.pdf" (with "FY"
 *   prefix); FY2023-FY2025 use "ACFR Final {YYYY} - Bookmarked.pdf".
 *
 * TX-TRAP SCOPE NOTE (D-04): IL ACFR General Fund ~1.5× NASBO GF because the GAAP General
 *   Fund consolidates federal intergovernmental revenue (~$22.1B in FY2025) that NASBO's
 *   budgetary concept excludes. This is the same mechanism as TX (~3×) and PA (~2×). The
 *   divergence is accepted-and-relabelled honestly: GAAP basis label in dataSource(), and
 *   the "Federal government" line item makes the scope transparent. Confirmed at load in
 *   Plan 105-03.
 *
 * UNITS = thousands (D-05/recon): store thousands in REVENUE (raw), ×1,000 at buildTree.
 *   This is the FL convention — NOT the TX raw-dollar convention. IL figures are in thousands.
 *
 * P2 CLAMP (ACFR-08): FY2022 "Interest and other investment income" in the General Fund
 *   column is NEGATIVE (−197,857 thousands). Rendered area is clamped to 0; the true signed
 *   value is preserved in the label; the root total carries the net (the printed Total already
 *   nets the negative). clampForRender applies to all FYs for safety.
 *
 * Bookend ties (GENERAL FUND Total revenues, thousands): FY2025 = 78,342,927 (×1000 = 78,342,927,000);
 *   FY2023 = 73,827,795 (×1000 = 73,827,795,000). Both tie 0 diff.
 *
 * Control = printed General-Fund-column "Total revenues". Each FY's transcribed
 *   rev-by-source categories must tie to the printed Total (in thousands) or the loader
 *   refuses to write (process.exit(2)). Tolerance = 10,000 thousands (same as FL).
 *   All 5 FYs tie to 0 diff vs. the printed General-Fund Total revenues.
 *
 * Extraction: pdftotext -table on local PDF copies in _acfr-work/il/ (NOT -layout).
 *
 * Usage:
 *   node scripts/processILRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const UNITS = 1_000; // IL ACFR is in thousands → ×1,000 at buildTree (FL convention, not TX raw-dollar)
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
const dataSource = (fy) => `Illinois State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

// General Fund revenues by source — IL ACFR, GENERAL FUND column (in thousands).
// Verbatim ACFR revenue source names from the Governmental Funds Statement of Rev/Exp/Changes.
// total = printed General-Fund "Total revenues" (thousands). All 5 FYs tie 0 diff.
// FY2022 "Interest and other investment income" is NEGATIVE (−197,857 thousands) → P2 clamp.
const REVENUE = {
  2021: { total: 63_136_008, confidence: 'actual', categories: [
    { name: 'Income taxes',                            total: 24_486_926 },
    { name: 'Federal government',                      total: 20_181_477 },
    { name: 'Sales taxes',                             total:  9_656_842 },
    { name: 'Medical providers assessment taxes',      total:  3_114_957 },
    { name: 'Other taxes',                             total:  3_019_018 },
    { name: 'Other',                                   total:  1_381_210 },
    { name: 'Public utility taxes',                    total:    805_363 },
    { name: 'Licenses and fees',                       total:    468_174 },
    { name: 'Interest and other investment income',    total:     22_041 },
  ]},
  2022: { total: 73_204_339, confidence: 'actual', categories: [
    { name: 'Income taxes',                            total: 30_416_464 },
    { name: 'Federal government',                      total: 23_180_399 },
    { name: 'Sales taxes',                             total: 10_691_978 },
    { name: 'Other taxes',                             total:  3_352_061 },
    { name: 'Medical providers assessment taxes',      total:  3_093_737 },
    { name: 'Other',                                   total:  1_369_415 },
    { name: 'Public utility taxes',                    total:    802_176 },
    { name: 'Licenses and fees',                       total:    495_966 },
    { name: 'Interest and other investment income',    total:   -197_857 }, // NEGATIVE — P2 clamp to 0
  ]},
  2023: { total: 73_827_795, confidence: 'actual', categories: [
    { name: 'Income taxes',                            total: 30_563_492 },
    { name: 'Federal government',                      total: 22_129_178 },
    { name: 'Sales taxes',                             total: 10_924_135 },
    { name: 'Other taxes',                             total:  3_316_911 },
    { name: 'Medical providers assessment taxes',      total:  3_621_665 },
    { name: 'Other',                                   total:  1_559_118 },
    { name: 'Public utility taxes',                    total:    773_441 },
    { name: 'Interest and other investment income',    total:    450_510 },
    { name: 'Licenses and fees',                       total:    489_345 },
  ]},
  2024: { total: 74_749_262, confidence: 'actual', categories: [
    { name: 'Income taxes',                            total: 31_111_196 },
    { name: 'Federal government',                      total: 21_674_883 },
    { name: 'Sales taxes',                             total: 10_901_218 },
    { name: 'Medical providers assessment taxes',      total:  3_815_003 },
    { name: 'Other taxes',                             total:  3_366_055 },
    { name: 'Other',                                   total:  1_731_287 },
    { name: 'Interest and other investment income',    total:    909_133 },
    { name: 'Public utility taxes',                    total:    740_720 },
    { name: 'Licenses and fees',                       total:    499_767 },
  ]},
  2025: { total: 78_342_927, confidence: 'actual', categories: [
    { name: 'Income taxes',                            total: 33_490_559 },
    { name: 'Federal government',                      total: 22_000_783 },
    { name: 'Sales taxes',                             total: 10_900_806 },
    { name: 'Medical providers assessment taxes',      total:  4_120_515 },
    { name: 'Other taxes',                             total:  3_461_226 },
    { name: 'Other',                                   total:  2_056_851 },
    { name: 'Interest and other investment income',    total:  1_043_390 },
    { name: 'Public utility taxes',                    total:    740_571 },
    { name: 'Licenses and fees',                       total:    528_226 },
  ]},
};

// P2 (ACFR-08): clamp negative rendered area to 0; preserve signed value in the label.
function clampForRender(amount) { return Math.max(amount, 0); }

function validate(fy) {
  const { total, categories } = REVENUE[fy]; let ok = true; let catSum = 0;
  for (const cat of categories) catSum += cat.total;
  if (Math.abs(catSum - total) > 10_000) { console.error(`FY${fy} sum ${catSum} ≠ total ${total} (diff ${catSum - total}) [thousands]`); ok = false; }
  return ok;
}
function buildTree(fy) {
  const { total, categories } = REVENUE[fy];
  const children = categories.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label, a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Illinois General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : [2021, 2022, 2023, 2024, 2025];
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, General Fund)${dryRun ? ' (dry-run)' : ''}\nFiscal years: ${years.join(', ')}\n`);
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
    const srcPayload = { name: 'Illinois General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'il-acfr-gf-revenue', base_url: 'https://illinoiscomptroller.gov/financial-reports-data/find-a-report/comprehensive-reporting/annual-comprehensive-financial-report/', fiscal_years: [2021,2022,2023,2024,2025], municipality_id: muniId };
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
    console.log(`\n${'Category'.padEnd(46)} ${'Amount ($)'.padStart(18)}`); console.log('─'.repeat(66));
    for (const cat of cats) console.log(`  ${cat.n.slice(0,44).padEnd(44)}${Math.round(cat.a).toLocaleString().padStart(18)}`);
    const neg = REVENUE[fy].categories.filter(c => c.total < 0);
    for (const c of neg) console.log(`  [Note: ${c.name} true value: ${(c.total * UNITS).toLocaleString()} (net loss — shown at 0)]`);
    console.log('─'.repeat(66)); console.log(`${'TOTAL REVENUES'.padEnd(46)}${Math.round(total).toLocaleString().padStart(18)}`);
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
