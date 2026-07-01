#!/usr/bin/env node
/**
 * Wisconsin General Fund Revenue (by source) Loader — FY2002-FY2025 ACTUAL (24 yrs)
 * Source: WI Annual Comprehensive Financial Report (ACFR/CAFR), Governmental Funds Statement of Revenues,
 *   Expenditures, and Changes in Fund Balances, GENERAL FUND column (GAAP, thousands). WI DOA/SCO.
 *
 * Phase 109-03 (ACFR-16 / ACFR-19 / ACFR-20 / RECON-08). Revenue is NEW on the WI state node
 *   (15fe5240) → pure insert keyed (muni,fy,'revenue'); enables "Money In". Node by name='Wisconsin'.
 *
 * PARSER-BASED (scripts/maAcfrExtract.mjs, D-02): WI's GF statement has 3 fund columns
 *   (General | Transportation | Nonmajor Governmental | Total). GENERAL FUND (1st) column ONLY —
 *   never a multi-column sum. Exact per-FY GF total-tie gate (D-04); non-tying years skipped+logged
 *   (D-05 honest hole).
 *
 * SOURCES = EXPLICIT per-year URLs across THREE doa.wi.gov path families (enumerated from the
 *   Financial-Reporting-Archive page — no derivable pattern): /budget/ (FY2018-2021, FY2024-25),
 *   /budget/SCO/ (FY2022-23), /DEBFCapitalFinance/{YYYY}/ (FY2002-2017, per-year naming variants).
 * HONEST HOLES: FY2000–FY2001 = pre-GASB-34 Combined-Statement format (different statement + basis)
 *   — self-limited per D-01; pre-FY2000 is the 4-section multi-file era (out of scope).
 *
 * UNITS = 1_000. TX-TRAP (ACFR-19): WI ACFR GF ~1.74× NASBO ($14.4B Intergovernmental — nearly all
 *   federal — inside GAAP GF; the MA ~1.73× analog). Accept-and-relabel honestly.
 * P2 CLAMP (ACFR-20): Interest Income NEGATIVE in FY2011–FY2013 (zero-rate era) — clamp triggers.
 * Bookends (GF Total revenues, thousands): FY2025 = 38,655,598 ; FY2019 = 27,866,801.
 * Usage: node scripts/processWIRevenueAcfr.js [--dry-run] [--fy YYYY]
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
const STATE_NAME = 'Wisconsin'; const STATE_ABBR = 'WI'; const POPULATION = 5_893_718;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/wi');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const WI_BASE = 'https://doa.wi.gov';
// Explicit per-year paths across the three families (archive-enumerated at load; FY2000/2001 omitted
// — pre-GASB-34 Combined-Statement format, honest holes per D-01).
const SRC = {
  2002: '/DEBFCapitalFinance/2002/2002cafr.pdf',
  2003: '/DEBFCapitalFinance/2003/2003cafr.pdf',
  2004: '/DEBFCapitalFinance/2004/2004CAFR.pdf',
  2005: '/DEBFCapitalFinance/2005/2005CAFR.pdf',
  2006: '/DEBFCapitalFinance/2006/2006CAFR.pdf',
  2007: '/DEBFCapitalFinance/2007/2007CAFR_Linked.pdf',
  2008: '/DEBFCapitalFinance/2008/2008CAFR_Linked.pdf',
  2009: '/DEBFCapitalFinance/2009/2009CAFR_Linked.pdf',
  2010: '/DEBFCapitalFinance/2010/2010_CAFR_Linked.pdf',
  2011: '/DEBFCapitalFinance/2011/2011CAFR_Linked.pdf',
  2012: '/DEBFCapitalFinance/2012/2012_CAFR_Linked.pdf',
  2013: '/DEBFCapitalFinance/2013/2013_CAFR_Linked.pdf',
  2014: '/DEBFCapitalFinance/2014/2014_CAFR_Linked.pdf',
  2015: '/DEBFCapitalFinance/2015/2015_CAFR_Linked.pdf',
  2016: '/DEBFCapitalFinance/2016/2016_CAFR_Linked.pdf',
  2017: '/DEBFCapitalFinance/2017/2017_CAFR_Linked.pdf',
  2018: '/budget/CAFR2018.pdf',
  2019: '/budget/CAFR2019.pdf',
  2020: '/budget/CAFR2020.pdf',
  2021: '/budget/ACFR2021.pdf',
  2022: '/budget/SCO/FY%202022%20ACFR.pdf',
  2023: '/budget/SCO/FY%202023%20ACFR%20Final.pdf',
  2024: '/budget/FY%202024%20ACFR%20Final.pdf',
  2025: '/budget/FY%202025%20ACFR%20Final.pdf',
};
const YEARS = Object.keys(SRC).map(Number).sort((a, b) => a - b);
const urlFor = (fy) => `${WI_BASE}${SRC[fy]}`;
const dataSource = (fy) => `Wisconsin State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
// Token-order first; positional fallback — gated per-dataset (rev tie here).
function loadYear(fy) {
  const txtPath = `${WORK}/WI${fy}.txt`; const pdfPath = `${WORK}/WI${fy}.pdf`;
  if (!existsSync(txtPath)) {
    if (!existsSync(pdfPath)) {
      try { execFileSync('curl', ['-sS','-L','--http1.1','--retry','2','--retry-delay','2','-A',UA,'--max-time','300','-o',pdfPath, urlFor(fy)]); } catch { return null; }
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
  const pos0 = extractGovFundGeneralColumnPositional(txt, { startLine: 0 });
  if (ties(pos0)) return pos0;
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
  return { jsonTree: [{ n: 'Wisconsin General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
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
    const srcPayload = { name: 'Wisconsin General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'wi-acfr-gf-revenue', base_url: 'https://doa.wi.gov/Pages/StateFinances/Financial-Reporting-Archive.aspx', fiscal_years: years, municipality_id: muniId };
    const { data: existing } = await supabase.schema('treasury').from('data_sources').select('id').eq('dataset_id', srcPayload.dataset_id).maybeSingle();
    if (existing?.id) { const { data } = await supabase.schema('treasury').from('data_sources').update(srcPayload).eq('id', existing.id).select().single(); ds = data; }
    else { const { data, error } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (error) { console.error('insert failed:', error.message); process.exit(2); } ds = data; }
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
  if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', ds.id);
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length}: ${loaded.join(', ') || 'none'}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.\nDone.`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
