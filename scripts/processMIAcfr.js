#!/usr/bin/env node
/**
 * Michigan General Fund Operating (Expenditure) Loader — FY2019-FY2025 ACTUAL (7 yrs)
 * Source: MI Annual Comprehensive Financial Report (ACFR), Governmental Funds Statement of Revenues,
 *   Expenditures, and Changes in Fund Balances, GENERAL FUND (Fund 10) column (GAAP, thousands).
 *   MI Dept. of Technology, Management & Budget / Office of Financial Management.
 *
 * Phase 109-05 (ACFR-18 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the
 *   MI state node (38c9f1ff-130e-423d-955a-6f0aa5aecae2) in place. Node by name='Michigan'.
 *
 * ============ SEPTEMBER 30 FY-END — THE ROSTER'S ONE STRUCTURAL EXCEPTION (D-03) ============
 * Michigan's fiscal year runs October 1 – September 30 (every other Batch-1/Batch-2 state is
 * June 30). This loader therefore:
 *   1. Stamps source_date = `${fy}-09-30` (NOT -06-30) on every budgets row.
 *   2. Sets fiscal_year_start_month: 10 in the data_sources payload — the treasury_sync_budget_tree
 *      RPC propagates v_ds.fiscal_year_start_month into treasury.budgets (migration 20260613120000).
 *   3. FY labels align to NASBO's calendar-year designation: ACFR "FY2025" = Oct 2024–Sep 2025 =
 *      NASBO "FY2025" ✓ (same year label, different month boundary).
 * =============================================================================================
 *
 * PARSER-BASED (scripts/maAcfrExtract.mjs positional variant, D-02): MI's column headers are FUND
 *   CODES (10 | 20 | 30 | 70) over GENERAL FUND | SCHOOL AID FUND | NON-MAJOR FUNDS | TOTALS.
 *   The GF = Fund 10 = 1st numeric column ONLY — the ~$19.5B School Aid Fund (Fund 20) is a
 *   SEPARATE major fund and must never bleed in. MI's all-caps headers + "(Note NN)" label
 *   cross-references drove two positional-parser generalizations (case-insensitive header match;
 *   Note-reference stripping). Exact per-FY tie gate (D-04) with TOL=5 thousands absorbing the
 *   DOCUMENTED GAAP rounding (FY2025 printed total 53,788,610 vs line-sum 53,788,611 — $1K;
 *   MA/MD precedent); non-tying years skipped+logged (D-05).
 *
 * SOURCES: base /budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report/
 *   — `ACFR-FY{YYYY}.pdf` FY2019–FY2024; FY2025 = `FY-2025-ACFR.pdf` (REVERSED name — special-cased).
 *   `?rev=&hash=` query params not required. Pre-FY2019 not on the archive (recon gap) — deferred.
 *
 * UNITS = 1_000. TX-TRAP AT ITS MOST PRONOUNCED (ACFR-19): MI ACFR GAAP GF ~3.56× NASBO — THE
 *   LARGEST DIVERGENCE IN THE WHOLE TRANCHE. Driver: ~$30.3B "From federal agencies" revenue
 *   (Medicaid federal match + ARP passthrough) sits INSIDE Michigan's GAAP General Fund, while
 *   NASBO's budgetary GF is the narrow ~$15.1B general fund. Accept-and-relabel honestly.
 * P2 CLAMP (ACFR-20): investment income is embedded in Miscellaneous (no standalone line) — no
 *   named clamp risk; clampForRender stays wired as the safety net.
 * Bookends (GF Total Revenues, thousands): FY2025 = 53,788,610 (line-sum +1 documented) ;
 *   FY2020 = 39,920,656 (diff 0).
 * Usage: node scripts/processMIAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Michigan'; const STATE_ABBR = 'MI'; const POPULATION = 10_077_331;
const UNITS = 1_000; const TOL = 5; // TOL absorbs the documented FY2025 $1K GAAP thousands-rounding ONLY
const FY_END_MONTH_DAY = '09-30'; // D-03: September 30 fiscal year end (Oct 1 start)
const WORK = resolve(__dirname, '../_acfr-work/mi');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MI_BASE = 'https://www.michigan.gov/budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report';
// FY2025 name is REVERSED (FY-2025-ACFR.pdf) vs the ACFR-FY{YYYY}.pdf pattern — special-cased.
const SRC = {
  2019: 'ACFR-FY2019.pdf', 2020: 'ACFR-FY2020.pdf', 2021: 'ACFR-FY2021.pdf',
  2022: 'ACFR-FY2022.pdf', 2023: 'ACFR-FY2023.pdf', 2024: 'ACFR-FY2024.pdf',
  2025: 'FY-2025-ACFR.pdf',
};
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => `${MI_BASE}/${SRC[fy]}`;
const dataSource = (fy) => `Michigan State ACFR — General Fund (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
// MI needs the positional variant (all-caps headers, blank Fund-10 cells); token-order tried first
// for form's sake. Gated per-dataset (exp tie here).
function loadYear(fy) {
  const txtPath = `${WORK}/MI${fy}.txt`; const pdfPath = `${WORK}/MI${fy}.pdf`;
  if (!existsSync(txtPath)) {
    if (!existsSync(pdfPath)) {
      try { execFileSync('curl', ['-sS','-L','--http1.1','--retry','2','--retry-delay','2','-A',UA,'--max-time','300','-o',pdfPath, urlFor(fy)]); } catch { return null; }
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
  return { jsonTree: [{ n: 'Michigan General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}
async function main() {
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: false });
  const dryRun = opts['dry-run']; const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : YEARS;
  console.log(`${STATE_NAME} GF Operating Loader (ACFR GAAP, parser, thousands×${UNITS}, Sep-30 FY-end)${dryRun ? ' (dry-run)' : ''}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId, ds;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})`);
    // fiscal_year_start_month: 10 → RPC propagates into treasury.budgets (D-03).
    const srcPayload = { name: 'Michigan General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'mi-acfr-gf-operating', base_url: 'https://www.michigan.gov/budget/fiscal-pages/reports/annual-comprehensive-financial-report', fiscal_years: years, municipality_id: muniId, fiscal_year_start_month: 10 };
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
    // D-03: September 30 source_date + fiscal_year_start_month=10 belt-and-suspenders stamp.
    await supabase.schema('treasury').from('budgets').update({ source_url: urlFor(fy), source_date: `${fy}-${FY_END_MONTH_DAY}`, data_source: dataSource(fy), fiscal_year_start_month: 10 }).eq('id', bud.id);
    loaded.push(fy);
  }
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id); // ephemeral cleanup — leaves 0 residue (WR-05 / LOAD-01)
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length}: ${loaded.join(', ') || 'none'}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.\nDone.`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
