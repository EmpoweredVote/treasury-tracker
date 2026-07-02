#!/usr/bin/env node
/**
 * North Carolina General Fund Operating (Expenditure) Loader — FY2012-FY2025 ACTUAL (best-effort)
 * Source: NC Annual Comprehensive Financial Report (ACFR), Governmental Funds Statement of Revenues,
 *   Expenditures and Changes in Fund Balances, GENERAL FUND column (GAAP, thousands). NC OSC.
 *
 * Phase 108-03 (ACFR-11 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the
 *   NC state node (dd5281e8-6988-4f42-b83c-4fed43c7ada4) in place. Node by name='North Carolina'.
 *
 * PARSER-BASED (reuses scripts/maAcfrExtract.mjs): NC's GF statement has 4+ fund columns
 *   (General | Highway | Other Highway | Other Governmental | Total) and functional expenditures
 *   (~13) + ~23 revenue sources. The extractor takes the GENERAL FUND (1st numeric) column ONLY —
 *   this AVOIDS the recon-warned multi-column-sum error. Every FY gated by an exact GF total-tie;
 *   non-tying years skipped+logged (honest hole per D-04).
 *
 * SOURCES = 14 EXPLICIT per-year ncosc.gov URLs (no derivable pattern; older = June_30_{YYYY}_CAFR,
 *   FY2017-2021 = "{YYYY} Comprehensive Annual Financial Report" variants, FY2022-2025 = "{YYYY}
 *   [North Carolina] Annual Comprehensive Financial Report"). All confirmed real PDFs at load.
 *
 * UNITS = 1_000. TX-TRAP (ACFR-19): NC ACFR GF ~2.58× NASBO (largest Batch-1 divergence — huge
 *   federal Medicaid/education grant flows, "Federal funds" $35B inside GAAP GF). Accept-relabel.
 * P2 CLAMP (ACFR-20): "Investment earnings (losses)" can be negative in adverse years; clampForRender.
 * Bookends (GF Total revenues, thousands): FY2025 = 75,416,082 ; FY2020 = 44,930,429.
 * Usage: node scripts/processNCAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'North Carolina'; const STATE_ABBR = 'NC'; const POPULATION = 10_439_388;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/nc');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const NC_BASE = 'https://www.ncosc.gov/sites/default/files';
// Explicit per-year URL paths (enumerated from ncosc.gov archive + current pages, confirmed at load).
const SRC = {
  2012: '2024-10/June_30_2012_CAFR.pdf', 2013: '2024-10/June_30_2013_CAFR.pdf',
  2014: '2024-10/June_30_2014_CAFR.pdf', 2015: '2024-10/June_30_2015_CAFR.pdf',
  2016: '2024-10/June_30_2016_CAFR.pdf',
  2017: '2024-10/2017%20Comprehensive%20Annual%20Financial%20Report_bookmarks.pdf',
  2018: '2024-10/2018%20Comprehensive%20Annual%20Financial%20Report_bookmarks.pdf',
  2019: '2024-10/2019_Comprehensive_Annual_Financial_Report_bookmarks.pdf',
  2020: '2024-10/2020_Comprehensive_Annual_Financial_Report-Bookmarks.pdf',
  2021: '2024-10/2021_Comprehensive_Annual_Financial_Report-Bookmarks.pdf',
  2022: '2024-10/2022%20North%20Carolina%20Annual%20Comprehensive%20Financial%20Report.pdf',
  2023: '2024-10/2023%20North%20Carolina%20Annual%20Comprehensive%20Financial%20Report.pdf',
  2024: '2024-12/2024%20North%20Carolina%20Annual%20Comprehensive%20Financial%20Report.pdf',
  2025: '2025-12/2025_North_Carolina_Annual_Comprehensive_Financial_Report.pdf',
};
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => `${NC_BASE}/${SRC[fy]}`;
const dataSource = (fy) => `North Carolina State ACFR — General Fund (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
function loadYear(fy) {
  const txtPath = `${WORK}/NC${fy}.txt`; const pdfPath = `${WORK}/NC${fy}.pdf`;
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
  return { jsonTree: [{ n: 'North Carolina General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'North Carolina General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'nc-acfr-gf-operating', base_url: 'https://www.ncosc.gov/annual-report-and-popular-report-archives', fiscal_years: years, municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
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
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length}: ${loaded.join(', ') || 'none'}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.\nDone.`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
