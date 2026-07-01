#!/usr/bin/env node
/**
 * Georgia General Fund Operating (Expenditure) Loader — FY2021-FY2025 ACTUAL
 * Source: State of Georgia ACFR, Governmental Funds Statement of Revenues, Expenditures, and Changes
 *   in Fund Balances, GENERAL FUND column (GAAP, thousands). Georgia State Accounting Office (SAO).
 *
 * Phase 108-04 (ACFR-12 / ACFR-19 / ACFR-20 / RECON-08 + F-97-01 supersede). Replaces the NASBO
 *   operating rows on the GA state node (6eb7dd4a-4dcf-4dcc-898f-45af9a3e20c3) in place — including
 *   the v2.10 Phase-97 F-97-01 Medicaid-corrected FY2023 NASBO row (same (muni,fy,'operating') key;
 *   the ACFR GAAP actual supersedes it, no orphan). Node by name='Georgia', entity_type='state'.
 *
 * PARSER-BASED (reuses scripts/maAcfrExtract.mjs): GA GF statement = General Fund | Capital Projects |
 *   Nonmajor | Total; GENERAL FUND is the 1st numeric column. ~12 revenue sources / ~15 functional
 *   expenditures. Each FY gated by an exact GF total-tie; non-tying skipped+logged.
 *
 * SOURCES = 5 EXPLICIT opaque SAO Drupal slugs (recon's slugs were stale — real slugs enumerated at
 *   load from sao.georgia.gov/swar/acfr + /historical-acfr-reports). UNITS = 1_000.
 * TX-TRAP (ACFR-19): GA ACFR GF ~1.98× NASBO ("Intergovernmental - Federal" ~$27.8B inside GAAP GF).
 * P2 CLAMP (ACFR-20): "Interest and Other Investment Income" positive in loaded years; safety net.
 * Bookends (GF Total Revenues, thousands): FY2025 = 68,445,055 ; FY2021 = 55,378,103.
 * Usage: node scripts/processGAAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Georgia'; const STATE_ABBR = 'GA'; const POPULATION = 11_180_878;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/ga');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const GA_DOC = 'https://sao.georgia.gov/document/document';
const SLUG = {
  2021: '2021acfrfinal070122bdpdf', 2022: '2022-acfr-final-securedpdf', 2023: '2023-acfr-final-securepdf',
  2024: '2024-acfr-42525-securedv2pdf', 2025: '2025-acfr-21325-securedpdf',
};
const YEARS = Object.keys(SLUG).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => `${GA_DOC}/${SLUG[fy]}/download`;
const dataSource = (fy) => `Georgia State ACFR — General Fund (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
function loadYear(fy) {
  const txtPath = `${WORK}/GA${fy}.txt`; const pdfPath = `${WORK}/GA${fy}.pdf`;
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
  const total = ex.expTotal;
  const children = ex.expenditures.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label.slice(0, 90), a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Georgia General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}
async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : YEARS;
  console.log(`${STATE_NAME} GF Operating Loader (ACFR GAAP, parser, thousands×${UNITS})${dryRun ? ' (dry-run)' : ''}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId, ds;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})`);
    const srcPayload = { name: 'Georgia General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ga-acfr-gf-operating', base_url: 'https://sao.georgia.gov/swar/acfr', fiscal_years: years, municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('dataset_id', srcPayload.dataset_id).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; }
    console.log(`data_source: ${ds.id}\n`);
  }
  const loaded = [], holes = [];
  for (const fy of years) {
    const ex = loadYear(fy);
    if (!ex) { console.log(`FY${fy}: SKIP (not parseable) — honest hole`); holes.push(fy); continue; }
    const catSum = ex.expenditures.reduce((a, c) => a + c.total, 0); const diff = catSum - ex.expTotal;
    if (Math.abs(diff) > TOL) { console.log(`FY${fy}: SKIP (exp sum ${catSum} ≠ ${ex.expTotal}, diff ${diff}) — honest hole`); holes.push(fy); continue; }
    const { jsonTree, total, rowCount } = buildTree(fy, ex);
    console.log(`FY${fy}: TIE (${rowCount} functions, diff ${diff})  Total Exp $${Math.round(total).toLocaleString()}`);
    if (dryRun) continue;
    const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'operating', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
    if (rpcErr || r?.error) { console.error(`RPC error FY${fy}: ${rpcErr?.message || r.error}`); process.exit(2); }
    const { data: bud } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
    if (!bud?.id) { console.error(`FY${fy}: no operating row to stamp`); process.exit(2); }
    await supabase.schema('treasury').from('budgets').update({ source_url: urlFor(fy), source_date: `${fy}-06-30`, data_source: dataSource(fy) }).eq('id', bud.id);
    loaded.push(fy);
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length}: ${loaded.join(', ') || 'none'}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.\nDone.`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
