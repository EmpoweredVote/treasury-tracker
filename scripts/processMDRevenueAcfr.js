#!/usr/bin/env node
/**
 * Maryland General Fund Revenue (by source) Loader — FY2022-FY2025 ACTUAL
 * Source: State of Maryland ACFR, Governmental Funds Statement of Revenues, Expenditures, and Changes
 *   in Fund Balances, GENERAL FUND column (GAAP, thousands). Maryland Comptroller.
 *
 * Phase 108-05 (ACFR-13 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the MD
 *   state node (8e597f8f-c696-47c0-9001-ed78a54f2228) in place. Node by name='Maryland'.
 *
 * PARSER-BASED (reuses scripts/maAcfrExtract.mjs): MD GF statement = General Fund | Special Revenue |
 *   Debt Service | Capital Projects | Enterprise | Total; GENERAL FUND is the 1st numeric column.
 *   ~13 revenue sources / ~20 functional expenditures. Each FY gated by a GF total-tie within TOL.
 *
 * SOURCES — CASE CHANGE at FY2024: FY2024/FY2025 lowercase `acfr{YYYY}.pdf`; FY2022/FY2023 uppercase
 *   `ACFR{YYYY}.pdf`. UNITS = 1_000.
 * TX-TRAP (ACFR-19): MD ACFR GF ~1.78× NASBO (federal intergovernmental inside GAAP GF). Accept-relabel.
 * P2 CLAMP (ACFR-20): FY2022 "Interest and other investment income" = -$275,992K (NEGATIVE) →
 *   clampForRender renders 0, signed magnitude in label, parent total nets it.
 * TOL = 5 thousand: MD bookends carry documented GAAP thousands rounding (FY2025 rev sum vs printed
 *   differ by ~$1; FY2022 by ~$2) — logged, not hidden.
 * Bookends (GF Total revenues, thousands): FY2025 = 48,689,018 ; FY2022 = 50,540,136.
 * Usage: node scripts/processMDAcfr.js [--dry-run] [--fy YYYY]
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGovFundGeneralColumn } from './maAcfrExtract.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const STATE_NAME = 'Maryland'; const STATE_ABBR = 'MD'; const POPULATION = 6_177_224;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/md');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const MD_BASE = 'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial';
// CASE CHANGE at FY2024: lowercase acfr{YYYY}.pdf for FY2024+, uppercase ACFR{YYYY}.pdf for FY2022-2023.
const SRC = { 2022: 'ACFR2022.pdf', 2023: 'ACFR2023.pdf', 2024: 'acfr2024.pdf', 2025: 'acfr2025.pdf' };
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => `${MD_BASE}/${SRC[fy]}`;
const dataSource = (fy) => `Maryland State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
function loadYear(fy) {
  const txtPath = `${WORK}/MD${fy}.txt`; const pdfPath = `${WORK}/MD${fy}.pdf`;
  if (!existsSync(txtPath)) {
    if (!existsSync(pdfPath)) {
      try { execFileSync('curl', ['-sS','-L','--max-time','300','-o',pdfPath, urlFor(fy)]); } catch { return null; }
      const b = readFileSync(pdfPath); if (b.slice(0,5).toString() !== '%PDF-' || b.length < 400000) return null;
    }
    try { execFileSync('pdftotext', ['-table', pdfPath, txtPath]); } catch { return null; }
  }
  const r = extractGovFundGeneralColumn(readFileSync(txtPath, 'utf8'));
  return r.found ? r : null;
}
function buildTree(fy, ex) {
  const total = ex.revTotal;
  const children = ex.revenues.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label.slice(0, 90), a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Maryland General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}
async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : YEARS;
  console.log(`${STATE_NAME} GF Revenue Loader (ACFR GAAP, parser, thousands×${UNITS})${dryRun ? ' (dry-run)' : ''}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId, ds;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})`);
    const srcPayload = { name: 'Maryland General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'md-acfr-gf-revenue', base_url: 'https://www.marylandcomptroller.gov/reports/annual-comprehensive-financial-report-acfr.html', fiscal_years: years, municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log(`data_source: ${ds.id}\n`);
  }
  const loaded = [], holes = [];
  for (const fy of years) {
    const ex = loadYear(fy);
    if (!ex) { console.log(`FY${fy}: SKIP (not parseable) — honest hole`); holes.push(fy); continue; }
    const catSum = ex.revenues.reduce((a, c) => a + c.total, 0); const diff = catSum - ex.revTotal;
    if (Math.abs(diff) > TOL) { console.log(`FY${fy}: SKIP (rev sum ${catSum} ≠ ${ex.revTotal}, diff ${diff}) — honest hole`); holes.push(fy); continue; }
    const { jsonTree, total, rowCount } = buildTree(fy, ex);
    console.log(`FY${fy}: TIE (${rowCount} sources, diff ${diff})  Total Rev $${Math.round(total).toLocaleString()}`);
    if (dryRun) continue;
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr || r?.error) { console.error(`RPC error FY${fy}: ${rpcErr?.message || r.error}`); process.exit(2); }
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
    if (!bud?.id) { console.error(`FY${fy}: no revenue row to stamp`); process.exit(2); }
    await supabase.schema('treasury').from('budgets').update({ source_url: urlFor(fy), source_date: `${fy}-06-30`, data_source: dataSource(fy) }).eq('id', bud.id);
    loaded.push(fy);
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length}: ${loaded.join(', ') || 'none'}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.\nDone.`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
