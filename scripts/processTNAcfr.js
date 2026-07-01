#!/usr/bin/env node
/**
 * Tennessee General Fund Operating (Expenditure) Loader — FY2009-FY2025 ACTUAL (17 yrs)
 * Source: TN Annual Comprehensive Financial Report (ACFR), Governmental Funds Statement of Revenues,
 *   Expenditures, and Changes in Fund Balances, GENERAL FUND column (GAAP, thousands). TN F&A Div. of Accounts.
 *
 * Phase 109-01 (ACFR-14 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the
 *   TN state node (f96037ba-af9e-406d-a98f-8c5e2fd299d6) in place. Node by name='Tennessee'.
 *
 * PARSER-BASED (scripts/maAcfrExtract.mjs, D-02): TN's GF statement has 4+ fund columns
 *   (General | Education | Highway | Nonmajor | Total). GENERAL FUND (1st) column ONLY — never a
 *   multi-column sum. FY2009–FY2014 statements leave blank GF cells EMPTY (no dash), shifting
 *   token-order extraction → the POSITIONAL extractor (nearest right-aligned column) recovers them.
 *   Every FY gated by an exact GF total-tie (D-04); non-tying years skipped+logged (D-05 honest hole).
 *
 * SOURCES = 17 EXPLICIT per-year tn.gov URLs — mixed-case filenames, FY2025 space+dash special case;
 *   no derivable pattern. tn.gov resets plain-curl connections → browser UA required on downloads.
 *
 * UNITS = 1_000. TX-TRAP (ACFR-19): TN ACFR GF ~1.51× NASBO ($17.5B Federal revenue inside GAAP GF
 *   — Medicaid/education passthrough NASBO's budgetary GF excludes). Accept-and-relabel honestly.
 * P2 CLAMP (ACFR-20): investment income positive in all verified years; clampForRender safety net.
 * Bookends (GF Total revenues, thousands): FY2025 = 35,473,625 ; FY2019 = 22,201,193.
 * Usage: node scripts/processTNAcfr.js [--dry-run] [--fy YYYY]
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGovFundGeneralColumn, extractGovFundGeneralColumnPositional } from './maAcfrExtract.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const STATE_NAME = 'Tennessee'; const STATE_ABBR = 'TN'; const POPULATION = 6_910_840;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/tn');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const TN_BASE = 'https://www.tn.gov/content/dam/tn/finance/acfr/archive';
// Explicit per-year filenames (enumerated from the tn.gov archive page — mixed case, no pattern).
const SRC = {
  2009: 'acfr_fy09.pdf', 2010: 'acfr_fy10.pdf', 2011: 'acfr_fy11.pdf', 2012: 'acfr_fy12.pdf',
  2013: 'acfr_fy13.pdf', 2014: 'acfr_fy14.pdf', 2015: 'acfr_fy15.pdf', 2016: 'acfr_fy16.pdf',
  2017: 'acfr_fy17.pdf', 2018: 'acfr_fy18.pdf', 2019: 'acfr_fy19.pdf', 2020: 'acfr_fy20.pdf',
  2021: 'ACFR_fy21.pdf', 2022: 'ACFR_FY22.pdf', 2023: 'ACFR_fy23.pdf', 2024: 'ACFR_FY24.pdf',
  2025: 'ACFR%20-%20FY25.pdf',
};
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => `${TN_BASE}/${SRC[fy]}`;
const dataSource = (fy) => `Tennessee State ACFR — General Fund (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
// Try token-order extraction first; fall back to positional when the exp sum misses the tie.
function loadYear(fy) {
  const txtPath = `${WORK}/TN${fy}.txt`; const pdfPath = `${WORK}/TN${fy}.pdf`;
  if (!existsSync(txtPath)) {
    if (!existsSync(pdfPath)) {
      try { execFileSync('curl', ['-sS','-L','--http1.1','--retry','3','--retry-delay','2','-A',UA,'--max-time','300','-o',pdfPath, urlFor(fy)]); } catch { return null; }
      const b = readFileSync(pdfPath); if (b.slice(0,5).toString() !== '%PDF-' || b.length < 400000) return null;
    }
    try { execFileSync('pdftotext', ['-table', pdfPath, txtPath]); } catch { return null; }
  }
  const txt = readFileSync(txtPath, 'utf8');
  const ties = (r) => r?.found && Math.abs(r.expenditures.reduce((a, c) => a + c.total, 0) - r.expTotal) <= TOL;
  const std = extractGovFundGeneralColumn(txt);
  if (ties(std)) return std;
  const pos = extractGovFundGeneralColumnPositional(txt);
  if (ties(pos)) return pos;
  return std.found ? std : (pos.found ? pos : null);
}
function buildTree(fy, ex) {
  const total = ex.expTotal;
  const children = ex.expenditures.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total);
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label.slice(0, 90), a: rendered * UNITS, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Tennessee General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Tennessee General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'tn-acfr-gf-operating', base_url: 'https://www.tn.gov/finance/doa/fa-accfin-ar.html', fiscal_years: years, municipality_id: muniId };
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
