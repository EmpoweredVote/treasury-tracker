#!/usr/bin/env node
/**
 * Wisconsin General Fund Operating (Expenditure) Loader — FY2000-FY2025 ACTUAL (26 yrs)
 * Source: WI Annual Comprehensive Financial Report (ACFR/CAFR), Governmental Funds Statement of Revenues,
 *   Expenditures, and Changes in Fund Balances, GENERAL FUND column (GAAP, thousands). WI DOA/SCO.
 *
 * Phase 109-03 (ACFR-16 / ACFR-19 / ACFR-20 / RECON-08). Replaces the NASBO operating rows on the
 *   WI state node (15fe5240-19d9-4fef-b785-d624b0a39a2a) in place. Node by name='Wisconsin'.
 *
 * PARSER-BASED (scripts/maAcfrExtract.mjs, D-02): WI's GF statement has 3 fund columns
 *   (General | Transportation | Nonmajor Governmental | Total). GENERAL FUND (1st) column ONLY —
 *   never a multi-column sum. Exact per-FY GF total-tie gate (D-04); non-tying years skipped+logged
 *   (D-05 honest hole).
 *
 * PRE-GASB-34 DEEPENING (Phase 115-02, DEEP-02/DEEP-04): FY2000–FY2001 (2 yrs) use the DIFFERENT
 *   "Combined Statement of Revenues, Expenditures, and Changes in Fund Balances — All Governmental
 *   Fund Types" format (scripts/pre34Extract.mjs), carrying a DISTINCT basis label (pre-GASB-34
 *   combined statement basis, not GAAP) — never mixed into the same series as a GAAP figure. Both
 *   years tie within TOL on both revenue and expenditure printed General Fund totals (FY2001
 *   expenditure diff = -2 thousand, the same GAAP-rounding pattern already documented for
 *   FY2011 in the modern series).
 *
 * SOURCES = EXPLICIT per-year URLs across THREE doa.wi.gov path families (enumerated from the
 *   Financial-Reporting-Archive page — no derivable pattern): /budget/ (FY2018-2021, FY2024-25),
 *   /budget/SCO/ (FY2022-23), /DEBFCapitalFinance/{YYYY}/ (FY2000-2017, per-year naming variants).
 * HONEST HOLES: pre-FY2000 is the 4-section multi-file era (out of scope per Phase 109/115 plan).
 *
 * UNITS = 1_000. TX-TRAP (ACFR-19): WI ACFR GF ~1.74× NASBO ($14.4B Intergovernmental — nearly all
 *   federal — inside GAAP GF; the MA ~1.73× analog). Accept-and-relabel honestly.
 * P2 CLAMP (ACFR-20): Interest Income NEGATIVE in FY2011–FY2013 (zero-rate era) — clamp triggers.
 * Bookends (GF Total revenues, thousands): FY2025 = 38,655,598 ; FY2019 = 27,866,801.
 * Usage: node scripts/processWIAcfr.js [--dry-run] [--fy YYYY]
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractGovFundGeneralColumn, extractGovFundGeneralColumnPositional } from './maAcfrExtract.mjs';
import { extractPre34GeneralFund } from './pre34Extract.mjs';
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
// Explicit per-year paths across the three families (archive-enumerated at load). FY2000/2001 =
// pre-GASB-34 Combined-Statement format, routed through pre34Extract.mjs below (Phase 115-02).
const PRE34_LAST_FY = 2001; // years <= this use extractPre34GeneralFund, not the modern extractor
const SRC = {
  2000: '/DEBFCapitalFinance/2000/2000cafr.pdf',
  2001: '/DEBFCapitalFinance/2001/2001cafr.pdf',
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
// Pre-34 years carry a DISTINCT honest basis label — never the GAAP label (DEEP-02 success criterion 1).
const dataSource = (fy) => fy <= PRE34_LAST_FY
  ? `Wisconsin State CAFR — General Fund (FY${fy} actual, pre-GASB-34 combined statement basis)`
  : `Wisconsin State ACFR — General Fund (FY${fy} actual, GAAP basis)`;
function clampForRender(a) { return Math.max(a, 0); }
// Token-order first; positional fallback — gated per-dataset (exp tie here). Pre-34 years route
// through the dedicated Combined-Statement extractor (Phase 115-02) — different statement, different
// title anchor, never mixed with the modern token-order/positional pair.
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
  const ties = (r) => r?.found && Math.abs(r.expenditures.reduce((a, c) => a + c.total, 0) - r.expTotal) <= TOL;
  if (fy <= PRE34_LAST_FY) {
    const pre34 = extractPre34GeneralFund(txt);
    return ties(pre34) ? pre34 : null;
  }
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
  return { jsonTree: [{ n: 'Wisconsin General Fund Budget', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}
async function main() {
  // Phase 115-02 hardening (fix-while-touching, WR-05/WR-06 precedent): strict parsing +
  // --fy value validation — a mistyped flag or year must fail loudly, never silently no-op.
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run'];
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !SRC[parseInt(opts.fy, 10)])) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${YEARS.join(', ')})`); process.exit(2); }
  const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : YEARS;
  console.log(`${STATE_NAME} GF Operating Loader (ACFR GAAP + pre-GASB-34, parser, thousands×${UNITS})${dryRun ? ' (dry-run)' : ''}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId, ds;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})`);
    const srcPayload = { name: 'Wisconsin General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'wi-acfr-gf-operating', base_url: 'https://doa.wi.gov/Pages/StateFinances/Financial-Reporting-Archive.aspx', fiscal_years: years, municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log(`data_source: ${ds.id}\n`);
  }
  const loaded = [], holes = [];
  try {
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
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'operating').maybeSingle();
      if (selErr) { console.error(`FY${fy}: stamp lookup failed: ${selErr.message}`); process.exit(2); } // WR-07: surface select errors — never misreport as a missing row
      if (!bud?.id) { console.error(`FY${fy}: no operating row to stamp`); process.exit(2); }
      await supabase.schema('treasury').from('budgets').update({ source_url: urlFor(fy), source_date: `${fy}-06-30`, data_source: dataSource(fy) }).eq('id', bud.id);
      loaded.push(fy);
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length}: ${loaded.join(', ') || 'none'}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.\nDone.`);
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
