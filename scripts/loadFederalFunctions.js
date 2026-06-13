#!/usr/bin/env node
/**
 * Federal Function-Lens Loader (Phase 44, Plan 04 — parameterized in Phase 49)
 *
 * Money Out, the DEFAULT lens: Function → Subfunction → Account, from the OMB
 * Public Budget Database outlays file (account-level, function-coded, in
 * thousands). Function titles sourced from OMB Hist 3.2 (never model memory).
 *
 * Phase 49: any fiscal year FY1976–FY2025 (and the FY1976 Transition Quarter)
 * loads from the SAME file — the PBD has one column per year (1962→present) plus
 * a literal `TQ` column. Per-year reconciliation anchor = OMB Hist 1.1 total
 * outlays, read from treasury.federal_annual_summary (already holds FY1962+).
 * Historical years NEVER hard-halt on a reconciliation miss — they load anyway
 * with a per-year visual-vs-official disclosure metric (HIST-04: no year dropped).
 *
 * Depth rules (unchanged from FY2025):
 *   - Function and Subfunction node amounts = NET sums (match published totals).
 *   - Positive accounts become child nodes; negative accounts (offsetting
 *     collections/receipts) ride as line items and aggregate into per-function
 *     disclosure metrics. Net<=0 functions/subfunctions excluded + disclosed.
 *
 * Usage:
 *   node scripts/loadFederalFunctions.js --fy 2024 [--dry-run]
 *   node scripts/loadFederalFunctions.js --tq [--dry-run]   # Transition Quarter
 *   node scripts/loadFederalFunctions.js --fy 2025          # FY2025 (back-compat)
 *
 * The TQ run passes p_period_label to treasury_sync_budget_tree and therefore
 * requires migration 49-01 (period_label column + 8-arg RPC). Normal years pass
 * only the original 7 args and work without that migration.
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPPLEMENTAL = 'https://www.whitehouse.gov/omb/information-resources/budget/supplemental-materials/';
const HIST_LANDING = 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const RECON_TOLERANCE = 0.005; // 0.5% — anchor is rounded to the million in federal_annual_summary

const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    fy: { type: 'string' },
    tq: { type: 'boolean', default: false },
  },
});
const dryRun = opts['dry-run'];
const isTQ = opts.tq;
if (!isTQ && !opts.fy) {
  console.error('Specify --fy <YEAR> (e.g. --fy 2024) or --tq for the Transition Quarter');
  process.exit(1);
}

// ── Period resolution ──────────────────────────────────────────────────────────
const FY = isTQ ? 1976 : parseInt(opts.fy, 10);
if (!isTQ && (!Number.isInteger(FY) || FY < 1962 || FY > 2025)) {
  console.error(`--fy must be an integer 1962–2025 (got ${opts.fy})`);
  process.exit(1);
}
const COLUMN = isTQ ? 'TQ' : String(FY);          // PBD column header to extract
const PERIOD_LABEL = isTQ ? 'Transition Quarter (Jul–Sep 1976)' : null;
const DATASET_ID = isTQ ? 'tq1976' : `fy${FY}`;
const PERIOD_KEY = isTQ ? 'tq1976' : `fy${FY}`;    // metric_key suffix
const AS_OF = isTQ ? '1976-09-30' : `${FY}-09-30`; // TQ ends Sep 30, 1976
const PERIOD_LABEL_HUMAN = isTQ ? 'Transition Quarter (Jul–Sep 1976)' : `FY${FY}`;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}
async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}
// Reuse a recently-downloaded file (within 24h) — lets a multi-year backfill avoid
// re-downloading the same large PBD edition once per year. Edition is stable per run.
async function cachedDownload(url, dest) {
  try { if (Date.now() - statSync(dest).mtimeMs < 24 * 3600 * 1000) return; } catch { /* not cached */ }
  await download(url, dest);
}
function findXlsxUrl(html, stem) {
  const re = new RegExp(`href="(https://www\\.whitehouse\\.gov/[^"]*${stem}[^"]*\\.xlsx)"`, 'i');
  const m = html.match(re);
  if (!m) throw new Error(`No ${stem} xlsx on page (whitehouse.gov only, T-44-04)`);
  return m[1];
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ── Tree builder per depth rules (unchanged from FY2025) ───────────────────────
function buildTree(rows) {
  const byFunction = new Map();
  for (const r of rows) {
    if (!byFunction.has(r.function_code)) {
      byFunction.set(r.function_code, { title: r.function_title, subs: new Map() });
    }
    const fn = byFunction.get(r.function_code);
    const sfKey = r.subfunction_code;
    if (!fn.subs.has(sfKey)) fn.subs.set(sfKey, { title: r.subfunction_title, accounts: [] });
    fn.subs.get(sfKey).accounts.push(r);
  }

  const tree = [];
  const excluded = [];   // {kind, name, value}
  const offsetsByFunction = new Map(); // function title -> sum of negative accounts
  let accountNodeCount = 0;

  for (const [, fn] of [...byFunction.entries()].sort()) {
    const fnNode = { n: fn.title, a: 0, c: [] };
    for (const [, sf] of [...fn.subs.entries()].sort()) {
      const net = sf.accounts.reduce((s, a) => s + a.amount, 0);
      if (net <= 0) {
        excluded.push({ kind: 'subfunction', name: `${fn.title} / ${sf.title}`, value: net });
        continue;
      }
      const positives = sf.accounts.filter(a => a.amount > 0).sort((x, y) => y.amount - x.amount);
      const negatives = sf.accounts.filter(a => a.amount < 0).sort((x, y) => x.amount - y.amount);
      if (negatives.length) {
        const negSum = negatives.reduce((s, a) => s + a.amount, 0);
        offsetsByFunction.set(fn.title, (offsetsByFunction.get(fn.title) ?? 0) + negSum);
      }

      const seen = new Map();
      const sfNode = {
        n: sf.title,
        a: net, // official NET total for this subfunction
        c: positives.map(a => {
          let name = a.account;
          const k = name.toLowerCase();
          if (seen.has(k)) name = `${name} (${a.agency})`;
          seen.set(k, true);
          accountNodeCount += 1;
          return {
            n: name, a: a.amount,
            i: [{ d: `${a.account} — ${a.agency}`, a: a.amount, aa: null, f: a.bea_category || null, e: null }],
          };
        }),
        ...(negatives.length ? {
          i: negatives.map(a => ({ d: `${a.account} — ${a.agency} (offsetting)`, a: a.amount, aa: null, f: a.bea_category || null, e: null })),
        } : {}),
      };
      fnNode.a += net;
      fnNode.c.push(sfNode);
    }
    if (fnNode.a <= 0 || fnNode.c.length === 0) {
      excluded.push({ kind: 'function', name: fn.title, value: fnNode.a });
      continue;
    }
    fnNode.c.sort((x, y) => y.a - x.a);
    tree.push(fnNode);
  }
  tree.sort((x, y) => y.a - x.a);

  const total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total, excluded, offsetsByFunction, accountNodeCount };
}

async function main() {
  console.log(`\n=== Function lens: ${PERIOD_LABEL_HUMAN} (PBD column "${COLUMN}") ===`);

  // A supabase client is used (read-only in dry-run) to fetch the per-year anchor.
  const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  if (!supabase) console.warn('No SUPABASE key — anchor check skipped (net reported unverified).');

  // Locate + download current-edition files
  const suppHtml = await fetchText(SUPPLEMENTAL);
  const outlaysUrl = findXlsxUrl(suppHtml, 'outlays');
  const histHtml = await fetchText(HIST_LANDING);
  const hist32Url = findXlsxUrl(histHtml, 'hist03z2');
  console.log(`Outlays DB: ${outlaysUrl}`);
  console.log(`Hist 3.2:   ${hist32Url}`);

  const dir = path.join(tmpdir(), 'omb-pbdb');
  mkdirSync(dir, { recursive: true });
  const fOut = path.join(dir, 'outlays.xlsx');
  const f32 = path.join(dir, 'hist03z2.xlsx');
  await cachedDownload(outlaysUrl, fOut);
  await cachedDownload(hist32Url, f32);

  let json;
  try {
    json = execFileSync('python',
      [path.join(__dirname, 'extractOMBPublicBudgetDB.py'), fOut, f32, COLUMN],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const stderr = e.stderr ? String(e.stderr) : e.message;
    throw new Error(`Extractor failed for column "${COLUMN}". If this is the TQ, confirm the PBD header string (often "TQ"). Detail: ${stderr.trim()}`);
  }
  const { rows, net_total } = JSON.parse(json);
  console.log(`Extracted ${rows.length} account rows; net total $${(net_total / 1e9).toFixed(1)}B`);

  // Per-year anchor from federal_annual_summary (OMB Hist 1.1 outlays, dollars).
  // No TQ row exists there (year-keyed), so the TQ self-anchors on its PBD column.
  let anchor = null, anchorSource = null;
  if (supabase && !isTQ) {
    const { data: fas } = await supabase.schema('treasury').from('federal_annual_summary')
      .select('outlays').eq('fiscal_year', FY).maybeSingle();
    if (fas?.outlays != null) { anchor = Number(fas.outlays); anchorSource = 'federal_annual_summary (OMB Hist 1.1)'; }
  }

  const { tree, total, excluded, offsetsByFunction, accountNodeCount } = buildTree(rows);
  const excludedSum = excluded.reduce((s, e) => s + e.value, 0);
  const offsetsTotal = [...offsetsByFunction.values()].reduce((s, v) => s + v, 0);

  console.log(`Tree: ${tree.length} functions, ${tree.reduce((s, n) => s + n.c.length, 0)} subfunctions, ${accountNodeCount} account nodes; within-subfunction offsets $${(offsetsTotal / 1e9).toFixed(1)}B across ${offsetsByFunction.size} functions (kept as line items)`);
  for (const n of tree.slice(0, 8)) console.log(`  ${n.n}: $${(n.a / 1e9).toFixed(1)}B (${n.c.length} subfunctions)`);
  if (excluded.length) for (const e of excluded.slice(0, 6)) console.log(`  ⚠ EXCLUDED ${e.kind}: ${e.name} $${(e.value / 1e9).toFixed(1)}B`);

  // Tiered reconciliation (D-05): account depth, then load-anyway+disclosure.
  // NEVER halt on a historical miss — record the gap and write the best tree.
  let tier = 'account';
  let visualVsOfficial = null;
  if (anchor != null) {
    const netDelta = Math.abs(net_total - anchor) / anchor;
    console.log(`Net $${(net_total / 1e9).toFixed(1)}B vs anchor $${(anchor / 1e9).toFixed(1)}B (${anchorSource}): ${(netDelta * 100).toFixed(4)}%`);
    if (netDelta > RECON_TOLERANCE) {
      tier = 'load-anyway';
      visualVsOfficial = net_total - anchor;
      console.warn(`  ⚠ Tier-2 fallback: net outside ${RECON_TOLERANCE * 100}% — loading anyway with a visual-vs-official disclosure (gap $${(visualVsOfficial / 1e9).toFixed(1)}B).`);
    }
  } else {
    console.log(`No anchor (${isTQ ? 'TQ self-anchors on PBD column' : 'federal_annual_summary missing this year'}); net taken as published.`);
  }

  if (dryRun) {
    console.log(`[dry-run] tier=${tier}; displayed $${(total / 1e9).toFixed(1)}B + excluded $${(excludedSum / 1e9).toFixed(1)}B. No DB writes.`);
    return;
  }

  if (!supabase) { console.error('Missing SUPABASE_SERVICE_KEY for write'); process.exit(1); }

  const { data: muni, error: muniErr } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (muniErr || !muni) throw new Error('US federal entity not found — run seedUSFederal.js');

  // data_sources upsert
  const src = {
    name: `US Federal Outlays by Function ${PERIOD_LABEL_HUMAN} (OMB Public Budget Database)`,
    api_type: 'xlsx_download',
    dataset_type: 'operating',
    dataset_id: DATASET_ID,
    base_url: outlaysUrl,
    fiscal_years: [FY],
    fiscal_year_start_month: 10,
    municipality_id: muni.id,
    column_mapping: { hierarchy_columns: ['function', 'subfunction', 'account'] },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muni.id).eq('api_type', 'xlsx_download')
    .eq('dataset_id', DATASET_ID).eq('dataset_type', 'operating').maybeSingle();
  let ds;
  if (existing?.id) {
    ({ data: ds } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single());
  } else {
    ({ data: ds } = await supabase.schema('treasury').from('data_sources')
      .insert(src).select().single());
  }
  if (!ds?.id) throw new Error('data_source upsert failed');
  console.log(`data_source: ${ds.id}`);

  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FY);
  if (delErr) throw new Error(`pre-delete: ${delErr.message}`);

  const rpcParams = {
    p_data_source_id: ds.id,
    p_fiscal_year: FY,
    p_dataset_type: 'operating',
    p_total: total,
    p_tree: tree,
    p_row_count: rows.length,
    p_triggered_by: 'bulk_load',
  };
  // Only TQ passes the 8th arg — keeps normal years compatible with the 7-arg RPC.
  if (PERIOD_LABEL) rpcParams.p_period_label = PERIOD_LABEL;

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', rpcParams);
  if (rpcErr) {
    if (PERIOD_LABEL) throw new Error(`RPC: ${rpcErr.message} — the TQ requires migration 49-01 (period_label column + 8-arg RPC). Apply it first.`);
    throw new Error(`RPC: ${rpcErr.message}`);
  }
  if (rpc?.error) throw new Error(`RPC returned: ${rpc.error}`);
  console.log(`Inserted: ${rpc?.rows_inserted} line items (budget ${rpc?.budget_id})`);

  // Link the budget to its source_registry row (the SourceChip / data_source_info
  // path). The RPC does not set budgets.data_source_id; the loader owns the link.
  const { data: reg } = await supabase.schema('treasury').from('source_registry')
    .select('id').eq('name', 'omb-public-budget-database').single();
  if (!reg?.id) throw new Error("source_registry 'omb-public-budget-database' not found");
  const { error: linkErr } = await supabase.schema('treasury').from('budgets')
    .update({ data_source_id: reg.id }).eq('id', rpc.budget_id);
  if (linkErr) throw new Error(`budget source link: ${linkErr.message}`);

  // Disclosure metrics (per-period keys) → excluded nets, per-function offsets,
  // and (Tier-2) the visual-vs-official gap. Recomputed per year, never copied.
  const today = new Date().toISOString().slice(0, 10);
  const metricRows = excluded.map(e => ({
    metric_key: `excluded_${e.kind}_${slug(e.name)}_${PERIOD_KEY}`,
    value: e.value, as_of_date: AS_OF,
    label: `Excluded from ${PERIOD_LABEL_HUMAN} spending visual (net ≤ 0 ${e.kind}): ${e.name}`,
  }));
  for (const [fnTitle, negSum] of offsetsByFunction) {
    metricRows.push({
      metric_key: `offsets_within_${slug(fnTitle)}_${PERIOD_KEY}`,
      value: negSum, as_of_date: AS_OF,
      label: `Offsetting collections/receipts inside ${fnTitle} (${PERIOD_LABEL_HUMAN}) — present as negative line items, not as tree bars`,
    });
  }
  if (visualVsOfficial != null) {
    metricRows.push({
      metric_key: `visual_vs_official_function_${PERIOD_KEY}`,
      value: visualVsOfficial, as_of_date: AS_OF,
      label: `${PERIOD_LABEL_HUMAN} function-lens net ($${(net_total / 1e9).toFixed(1)}B) minus OMB published outlays ($${(anchor / 1e9).toFixed(1)}B) — account-level did not reconcile within ${RECON_TOLERANCE * 100}%; loaded anyway per HIST-04`,
    });
  }
  for (const m of metricRows) {
    const row = {
      ...m,
      source_name: 'omb-historical-tables', source_url: SUPPLEMENTAL, source_date: today,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.schema('treasury').from('federal_context_metrics')
      .upsert(row, { onConflict: 'metric_key' });
    if (error) throw new Error(`metric: ${error.message}`);
  }
  console.log(`Disclosure metrics: ${metricRows.length} (tier=${tier})`);
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
