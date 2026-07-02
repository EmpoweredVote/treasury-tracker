#!/usr/bin/env node
/**
 * Connecticut General Fund Operating (Expenditure) Loader — FY2002-FY2025 ACTUAL (23 yrs; FY2006 hole)
 * Source: CT Annual Comprehensive Financial Report (ACFR/CAFR), Governmental Funds Statement of Revenues,
 *   Expenditures, and Changes in Fund Balances, GENERAL FUND column (GAAP, thousands). CT OSC.
 *
 * Phase 109-02 (ACFR-15 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the
 *   CT state node (d01de53e-d687-4825-bfe2-09f7694c28d6) in place. Node by name='Connecticut'.
 *
 * PARSER-BASED (scripts/maAcfrExtract.mjs, D-02): CT's GF statement has SEVEN fund columns
 *   (General | Debt Service | Transportation | Restricted Grants & Accounts | Grant & Loan Programs |
 *   Other | Total) — the tranche's highest multi-column-sum risk. GENERAL FUND (1st) column ONLY.
 *   Token-order extractor first; positional (nearest right-aligned anchor column) fallback for
 *   blank-GF-cell years (FY2002–FY2004, FY2022–FY2023). Exact per-FY GF total-tie gate (D-04);
 *   non-tying years skipped+logged (D-05 honest hole).
 *
 * SOURCES = EXPLICIT per-year URLs enumerated from the `_reportsSource` JSON on osc.ct.gov/reports
 *   (FY2022 "revised" suffix; pre-FY2021 CAFR naming; FY2015-16 /20XXcafr/ paths). Never derived.
 * HONEST HOLES: FY2006 = scanned PDF (no text layer). FY1988–FY2001 = pre-GASB-34 "Combined
 *   Statement" format (different statement + basis) — self-limited per D-01, future deepening pass.
 *
 * UNITS = 1_000. TX-TRAP (ACFR-19): CT ACFR GF ~1.14× NASBO (smallest tranche divergence —
 *   $2.8B Federal Grants and Aid inside GAAP GF). Accept-and-relabel honestly.
 * P2 CLAMP (ACFR-20): CT fiscal-stress years (2009–2017) are the named negative-investment watch.
 * Bookends (GF Total revenues, thousands): FY2025 = 26,074,183 ; FY2019 = 20,776,288.
 * Usage: node scripts/processCTAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Connecticut'; const STATE_ABBR = 'CT'; const POPULATION = 3_605_944;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/ct');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// Exact per-year URLs from the osc.ct.gov/reports _reportsSource JSON (FY2006 omitted — scanned, no
// text layer; FY1988–FY2001 omitted — pre-GASB-34 Combined-Statement format, honest holes per D-01).
const SRC = {
  2002: 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY2002.pdf',
  2003: 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY2003.pdf',
  2004: 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY2004.pdf',
  2005: 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY2005.pdf',
  2007: 'https://osc.ct.gov/2007cafr/CT2007_CAFR.pdf',
  2008: 'https://osc.ct.gov/2008cafr/cafr2008.pdf',
  2009: 'https://osc.ct.gov/2009cafr/CAFR09.pdf',
  2010: 'https://osc.ct.gov/2010cafr/CAFR10.pdf',
  2011: 'https://osc.ct.gov/2011cafr/CAFR11.pdf',
  2012: 'https://osc.ct.gov/2012cafr/CAFR12.pdf',
  2013: 'https://osc.ct.gov/2013cafr/CAFR13.pdf',
  2014: 'https://osc.ct.gov/2014cafr/cafr2014.pdf',
  2015: 'https://osc.ct.gov/2015cafr/cafr2015.pdf',
  2016: 'https://osc.ct.gov/2016cafr/CAFR2016rev.pdf',
  2017: 'https://osc.ct.gov/reports/2017CAFRrev012918.pdf',
  2018: 'https://osc.ct.gov/reports/CAFR-2018rev040919.pdf',
  2019: 'https://osc.ct.gov/reports/CAFR-2019.pdf',
  2020: 'https://osc.ct.gov/reports/CAFR2020.pdf',
  2021: 'https://osc.ct.gov/reports/ACFR2021.pdf',
  2022: 'https://osc.ct.gov/reports/ACFR-2022revised032227.pdf',
  2023: 'https://osc.ct.gov/wp-content/uploads/2024/04/ACFR-FY2023-v11-2024-04-12.pdf',
  2024: 'https://osc.ct.gov/wp-content/uploads/2025/03/State-of-Connecticut-ACFR-FY-24-3-26-25.pdf',
  2025: 'https://osc.ct.gov/wp-content/uploads/2026/03/State-of-Connecticut-ACFR-2-27-26_Final.pdf',
};
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => SRC[fy];
const dataSource = (fy) => `Connecticut State ACFR — General Fund (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
// Token-order first; positional fallback — gated per-dataset (exp tie here).
function loadYear(fy) {
  const txtPath = `${WORK}/CT${fy}.txt`; const pdfPath = `${WORK}/CT${fy}.pdf`;
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
  const pos0 = extractGovFundGeneralColumnPositional(txt, { startLine: 0 });
  if (ties(pos0)) return pos0;
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
  return { jsonTree: [{ n: 'Connecticut General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Connecticut General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'ct-acfr-gf-operating', base_url: 'https://osc.ct.gov/reports', fiscal_years: years, municipality_id: muniId };
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
