#!/usr/bin/env node
/**
 * Washington General Fund Revenue (by source) Loader — FY2020-FY2025 ACTUAL (6 yrs)
 * Source: WA Annual Comprehensive Financial Report (ACFR/CAFR), Governmental Funds Statement of Revenues,
 *   Expenditures, and Changes in Fund Balances, GENERAL FUND column (GAAP, thousands). WA OFM.
 *
 * Phase 109-04 (ACFR-17 / ACFR-19 / ACFR-20 / RECON-08). Revenue is NEW on the WA state node
 *   (d8257751) → pure insert keyed (muni,fy,'revenue'); enables "Money In". Node by name='Washington'.
 *
 * PARSER-BASED (scripts/maAcfrExtract.mjs, D-02): WA's GF statement columns are
 *   GENERAL | Higher Education Special Revenue | Higher Education Endowment and Other Permanent |
 *   Total. GENERAL FUND (1st) column ONLY — never a multi-column sum. Exact per-FY GF total-tie
 *   gate (D-04); non-tying years skipped+logged (D-05 honest hole).
 *
 * BIENNIAL CAVEAT: Washington BUDGETS on a 2-year biennium, but the ACFR publishes ANNUAL GAAP
 *   statements per fiscal year ending June 30 ("For the Fiscal Year Ended June 30, {YYYY}" printed
 *   on the statement). The biennium is a budgetary/statutory concept only — this loader treats
 *   FY-end = June 30 and loads per-year annual GAAP figures. Do NOT mistake the budget cycle for
 *   the reporting period.
 *
 * SOURCES: FY2025 has a UNIQUE URL (`FY-2025-Annual-Comprehensive-Financial-Report.pdf`, ~24 MB —
 *   never derive from the CAFR/{YYYY}/ACFR{YY}.pdf pattern); FY2020 is `CAFR20.pdf` (not ACFR20).
 *   Pre-FY2020 not verified downloadable (recon gap) — deferred, not attempted.
 *
 * UNITS = 1_000. TX-TRAP (ACFR-19): WA ACFR GF ~1.72× NASBO ($22.4B federal grants-in-aid inside
 *   GAAP GF). Accept-and-relabel honestly.
 * P2 CLAMP (ACFR-20): "Investment income (loss)" NEGATIVE in FY2021 (−12,899K) and FY2022
 *   (−216,940K, adverse bond market) — clamp triggers on both.
 * Bookends (GF Total revenues, thousands): FY2025 = 55,775,958 ; FY2020 = 38,977,410.
 * Usage: node scripts/processWARevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Washington'; const STATE_ABBR = 'WA'; const POPULATION = 7_705_281;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/wa');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const WA_CAFR_BASE = 'https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR';
// FY2025 unique name special-cased (D-09 URL-risk fact); FY2020 = CAFR20 not ACFR20.
const SRC = {
  2020: `${WA_CAFR_BASE}/2020/CAFR20.pdf`,
  2021: `${WA_CAFR_BASE}/2021/ACFR21.pdf`,
  2022: `${WA_CAFR_BASE}/2022/ACFR22.pdf`,
  2023: `${WA_CAFR_BASE}/2023/ACFR23.pdf`,
  2024: `${WA_CAFR_BASE}/2024/ACFR24.pdf`,
  2025: 'https://ofm.wa.gov/wp-content/uploads/FY-2025-Annual-Comprehensive-Financial-Report.pdf',
};
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => SRC[fy];
const dataSource = (fy) => `Washington State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
// Token-order first; positional fallback — gated per-dataset (rev tie here).
function loadYear(fy) {
  const txtPath = `${WORK}/WA${fy}.txt`; const pdfPath = `${WORK}/WA${fy}.pdf`;
  if (!existsSync(txtPath)) {
    if (!existsSync(pdfPath)) {
      try { execFileSync('curl', ['-sS','-L','--http1.1','--retry','2','--retry-delay','2','-A',UA,'--max-time','420','-o',pdfPath, urlFor(fy)]); } catch { return null; }
      const b = readFileSync(pdfPath); if (b.slice(0,5).toString() !== '%PDF-' || b.length < 400000) return null;
    }
    try { execFileSync('pdftotext', ['-table', pdfPath, txtPath]); } catch { return null; }
  }
  const txt = readFileSync(txtPath, 'utf8');
  const ties = (r) => r?.found && Math.abs(r.revenues.reduce((a, c) => a + c.total, 0) - r.revTotal) <= TOL;
  const std = extractGovFundGeneralColumn(txt);
  if (ties(std)) return std;
  const pos = extractGovFundGeneralColumnPositional(txt);
  if (ties(pos)) return pos;
  return std.found ? std : (pos.found ? pos : null);
}
function buildTree(fy, ex) {
  const total = ex.revTotal;
  const children = ex.revenues.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label.slice(0, 90), a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Washington General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Washington General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'wa-acfr-gf-revenue', base_url: 'https://ofm.wa.gov/spending/financial-audit-reports/annual-comprehensive-financial-report/', fiscal_years: years, municipality_id: muniId };
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
