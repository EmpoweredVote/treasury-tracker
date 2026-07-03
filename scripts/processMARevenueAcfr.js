#!/usr/bin/env node
/**
 * Massachusetts General Fund Revenue (by source) Loader — FY2001-FY2025 ACTUAL (best-effort window)
 * Source: Commonwealth of Massachusetts ACFR, Governmental Funds Statement of Revenues, Expenditures
 *   and Changes in Fund Balances, GENERAL FUND column (GAAP basis, thousands). MA Comptroller.
 *
 * Phase 108-02 (ACFR-10 / ACFR-19 / ACFR-20 / RECON-08). Revenue is NEW on the MA state node
 *   (fd6b008f) → pure insert keyed (muni,fy,'revenue'); enables the data-driven "Money In" view.
 *   IN-PLACE upgrade of the existing node (v1.8 DLS is city-level, unrelated) — NO new node.
 *
 * ⚠ PARSER-BASED (scripts/maAcfrExtract.mjs): MA GF revenue is 5 sources (Taxes, Assessments,
 *   Federal grants and reimbursements, Departmental, Miscellaneous). GENERAL FUND = 1st numeric
 *   column. Every FY gated by a GF-column total-tie; non-tying years SKIPPED + logged (honest hole).
 *
 * UNITS = 1_000. TOL = 5 thousand (documented GAAP rounding; nonzero diffs logged).
 * TX-TRAP SCOPE NOTE (ACFR-19): MA ACFR GF ~1.73× NASBO — "Federal grants and reimbursements"
 *   (~$16.2B FY2025) sits inside the GAAP GF. Accepted-and-relabelled honestly.
 * P2 CLAMP (ACFR-20): investment income embedded in Miscellaneous; clampForRender is a safety net.
 *
 * Bookends (GENERAL FUND Total revenues, thousands): FY2025 = 61,907,573 ; FY2015 = 35,029,512.
 *
 * DEEPENING (Phase 115-03, DEEP-03): recovered FY2014 (isolated font-glyph substitutions on the
 *   section anchors, fixed generically in maAcfrExtract.mjs) and FY2001 (pre-GASB-34 Combined
 *   Statement format, routed through scripts/pre34Extract.mjs, distinct basis label).
 *   FY2002/2004/2005 investigated and left as honest holes (dot-leader digit-interleaving
 *   corruption, not reliably separable from a genuine inter-column gap — see
 *   115-03-MA-LOADLOG.md). FY2021 investigated and left as an honest hole (document-wide
 *   corrupted font ToUnicode mapping).
 *
 * Usage: node scripts/processMARevenueAcfr.js [--dry-run] [--fy YYYY]
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractMAGeneralFund } from './maAcfrExtract.mjs';
import { extractPre34GeneralFund } from './pre34Extract.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const STATE_NAME = 'Massachusetts'; const STATE_ABBR = 'MA'; const POPULATION = 7_029_917;
const UNITS = 1_000; const TOL = 5;
const WORK = resolve(__dirname, '../_acfr-work/ma');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const MA_BASE = 'https://www.macomptroller.org/wp-content/uploads';
const YEARS = Array.from({ length: 2025 - 2001 + 1 }, (_, i) => 2001 + i);
const urlFor = (fy) => fy === 2017 ? `${MA_BASE}/acfr_fy2017.pdf` : `${MA_BASE}/acfr_fy-${fy}.pdf`;
// FY2001 is MA's only recovered pre-GASB-34 year — carries the distinct pre-GASB-34 basis label,
// never mixed into the GAAP series (DEEP-02 success criterion 1).
const PRE34_FYS = new Set([2001]);
const dataSource = (fy) => PRE34_FYS.has(fy)
  ? `Massachusetts State CAFR — General Fund Revenue (FY${fy} actual, pre-GASB-34 combined statement basis)`
  : `Massachusetts State ACFR — General Fund Revenue (FY${fy} actual, GAAP basis)`;

function clampForRender(a) { return Math.max(a, 0); }
// Pre-34 years route through the dedicated Combined-Statement extractor (Phase 115-02) — different
// statement, different title anchor, never mixed with the modern extractor.
function loadYear(fy) {
  const txtPath = `${WORK}/MA${fy}.txt`; const pdfPath = `${WORK}/MA${fy}.pdf`;
  if (!existsSync(txtPath)) {
    if (!existsSync(pdfPath)) {
      try { execFileSync('curl', ['-sS','-L','--fail','--max-time','300','-o',pdfPath, urlFor(fy)]); } catch { if (existsSync(pdfPath)) unlinkSync(pdfPath); return null; } // WR-03 (115 review): --fail + delete partial artifact — a transient HTTP error must never poison the cache
      const b = readFileSync(pdfPath); if (b.slice(0,5).toString() !== '%PDF-' || b.length < 400000) { unlinkSync(pdfPath); return null; } // WR-03: delete corrupt download so the next run re-fetches instead of reporting a fake honest hole
    }
    try { execFileSync('pdftotext', ['-table', pdfPath, txtPath]); } catch { return null; }
  }
  const txt = readFileSync(txtPath, 'utf8');
  if (PRE34_FYS.has(fy)) { const pre34 = extractPre34GeneralFund(txt); return pre34.found ? pre34 : null; }
  const r = extractMAGeneralFund(txt);
  return r.found ? r : null;
}
function buildTree(fy, ex) {
  const total = ex.revTotal;
  const children = ex.revenues.filter(c => c.total !== 0).map(cat => {
    const rendered = clampForRender(cat.total) * UNITS;
    const label = cat.total < 0 ? `${cat.name} (net loss — shown at 0)` : cat.name;
    return { n: label.slice(0, 90), a: rendered, i: [] };
  });
  children.sort((a, b) => b.a - a.a);
  return { jsonTree: [{ n: 'Massachusetts General Fund Revenue', a: total * UNITS, c: children }], total: total * UNITS, rowCount: children.length };
}

async function main() {
  // Phase 115-03 hardening (fix-while-touching, WR-05/WR-06/WR-07 precedent, 115-02 CT/WI pattern):
  // strict parsing + --fy value validation — a mistyped flag or year must fail loudly, never
  // silently no-op.
  const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, fy: { type: 'string' } }, strict: true, allowPositionals: false });
  const dryRun = opts['dry-run'];
  if (opts.fy !== undefined && (!/^[0-9]{4}$/.test(opts.fy) || !YEARS.includes(parseInt(opts.fy, 10)))) { console.error(`--fy ${opts.fy} is not a loadable fiscal year (available: ${YEARS[0]}-${YEARS[YEARS.length-1]})`); process.exit(2); }
  const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;
  const years = targetFY ? [targetFY] : YEARS;
  console.log(`${STATE_NAME} GF Revenue Loader (ACTUAL — ACFR GAAP basis, parser, thousands×${UNITS})${dryRun ? ' (dry-run)' : ''}\nFiscal years attempted: ${years[0]}–${years[years.length-1]}\n`);
  if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
  const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);
  let muniId, ds;
  if (!dryRun) {
    const { data: muni, error } = await supabase.schema('treasury').from('municipalities').select('id,name').eq('name', STATE_NAME).eq('state', STATE_ABBR).eq('entity_type', 'state').single();
    if (error || !muni) { console.error(`${STATE_NAME} state node not found`); process.exit(2); }
    muniId = muni.id; console.log(`Municipality: ${muni.name} (${muniId})\n`);
    const srcPayload = { name: 'Massachusetts General Fund Revenue', api_type: 'pdf_download', dataset_type: 'revenue', dataset_id: 'ma-acfr-gf-revenue', base_url: 'https://www.macomptroller.org/resource-categories/annual-comprehensive-financial-reports/', fiscal_years: years, municipality_id: muniId };
    // Ephemeral RPC parameter vehicle (WR-05 / LOAD-01): budgets rows carry text-stamp provenance, so a persistent data_sources row is unreferenceable residue — create fresh here, delete at end of run.
    await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', srcPayload.dataset_id);
    const { data: dsRow, error: dsErr } = await supabase.schema('treasury').from('data_sources').insert(srcPayload).select().single(); if (dsErr) { console.error('insert failed:', dsErr.message); process.exit(2); } ds = dsRow; console.log(`data_source created (ephemeral): ${ds.id}`);
    console.log(`data_source: ${ds.id}\n`);
  }
  const loaded = [], holes = [];
  try {
    for (const fy of years) {
      const ex = loadYear(fy);
      if (!ex) { console.log(`FY${fy}: SKIP (statement not parseable) — honest hole`); holes.push(fy); continue; }
      const catSum = ex.revenues.reduce((a, c) => a + c.total, 0);
      const diff = catSum - ex.revTotal;
      if (Math.abs(diff) > TOL) { console.log(`FY${fy}: SKIP (rev sum ${catSum} ≠ total ${ex.revTotal}, diff ${diff} > TOL) — honest hole`); holes.push(fy); continue; }
      const { jsonTree, total, rowCount } = buildTree(fy, ex);
      console.log(`FY${fy}: TIE (${rowCount} sources, diff ${diff})  Total Rev $${Math.round(total).toLocaleString()}`);
      if (dryRun) continue;
      const { data: r, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: ds.id, p_fiscal_year: fy, p_dataset_type: 'revenue', p_total: total, p_tree: jsonTree, p_row_count: rowCount, p_triggered_by: 'bulk_load' });
      if (rpcErr || r?.error) throw new Error(`FY${fy} RPC error: ${rpcErr?.message || r.error}`); // WR-01 (115 review): throw, never process.exit inside try — the finally cleanup must run
      const { data: bud, error: selErr } = await supabase.schema('treasury').from('budgets').select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', 'revenue').maybeSingle();
      if (selErr) throw new Error(`FY${fy} stamp lookup failed: ${selErr.message}`); // WR-07: surface select errors — never misreport as a missing row
      if (!bud?.id) throw new Error(`FY${fy}: no revenue row to stamp`);
      const { error: upErr } = await supabase.schema('treasury').from('budgets').update({ source_url: urlFor(fy), source_date: `${fy}-06-30`, data_source: dataSource(fy) }).eq('id', bud.id);
      if (upErr) throw new Error(`FY${fy} source stamp failed: ${upErr.message}`); // WR-02 (115 review): a failed stamp must abort loudly — never count a year as loaded with stale provenance
      loaded.push(fy);
    }
  } finally {
    // Ephemeral data_sources cleanup — runs on success AND on any mid-run failure (WR-04), leaves 0 residue (WR-05 / LOAD-01).
    if (!dryRun && ds) await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
  }
  console.log(`\n${dryRun ? '[dry-run] ' : ''}Loaded ${loaded.length} FYs${loaded.length?': '+loaded.join(', '):''}. Holes (${holes.length}): ${holes.join(', ') || 'none'}.`);
  console.log('Done.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
