#!/usr/bin/env node
/**
 * Federal Function-Lens Loader (Phase 44, Plan 04)
 *
 * Money Out, the DEFAULT lens: Function → Subfunction → Account, FY2025 actuals,
 * from the OMB Public Budget Database outlays file (account-level, function-coded,
 * in thousands — verified to sum EXACTLY to OMB Hist 1.1 FY2025 outlays).
 * Function titles sourced from OMB Hist 3.2 (never model memory).
 *
 * Depth rules (Chris 2026-06-12: deeper than 3 where data supports; clarity first):
 *   - Function and Subfunction node amounts = NET sums (match published totals).
 *   - Every positive subfunction gets ACCOUNT CHILD NODES (positive accounts,
 *     largest first). Its NEGATIVE accounts (offsetting collections/receipts)
 *     ride along as LINE ITEMS on the same node — honestly negative in the data,
 *     surfaced by Phase 45/46 methodology display — and are aggregated into a
 *     per-function disclosure metric. (Offsetting collections exist in nearly
 *     every subfunction, so an all-positive gate would yield zero account depth.)
 *   - BudgetIcicle normalizes child widths by the sum of displayed children
 *     (identical math for city/state trees, where children sum to parent).
 *   - Functions/subfunctions with NET <= 0 are excluded from the tree, logged,
 *     and stored as federal_context_metrics rows for Phase 45 disclosure.
 *
 * Usage: node scripts/loadFederalFunctions.js [--dry-run]
 * Checkpoint: 44-03 GO decision (Chris, 2026-06-12) covers this load.
 */

import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
const FY = 2025;
const OMB_OUTLAYS = 7_011_105e6; // FY2025 anchor, dollars

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

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
function findXlsxUrl(html, stem) {
  const re = new RegExp(`href="(https://www\\.whitehouse\\.gov/[^"]*${stem}[^"]*\\.xlsx)"`, 'i');
  const m = html.match(re);
  if (!m) throw new Error(`No ${stem} xlsx on page (whitehouse.gov only, T-44-04)`);
  return m[1];
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ── Tree builder per depth rules ──────────────────────────────────────────────
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
        // Negative accounts (offsetting collections/receipts) stay in the data
        // as line items on the subfunction node — honestly negative.
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
  await download(outlaysUrl, fOut);
  await download(hist32Url, f32);

  const json = execFileSync('python',
    [path.join(__dirname, 'extractOMBPublicBudgetDB.py'), fOut, f32, String(FY)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const { rows, net_total } = JSON.parse(json);
  console.log(`Extracted ${rows.length} account rows; net total $${(net_total / 1e9).toFixed(1)}B`);

  // Net total must equal the OMB anchor EXACTLY at file precision (thousands)
  if (Math.abs(net_total - OMB_OUTLAYS) > 1000) {
    throw new Error(`Net total ${net_total} != OMB anchor ${OMB_OUTLAYS} — halting`);
  }

  const { tree, total, excluded, offsetsByFunction, accountNodeCount } = buildTree(rows);
  const excludedSum = excluded.reduce((s, e) => s + e.value, 0);
  const offsetsTotal = [...offsetsByFunction.values()].reduce((s, v) => s + v, 0);

  console.log(`Tree: ${tree.length} functions, ${tree.reduce((s, n) => s + n.c.length, 0)} subfunctions, ${accountNodeCount} account nodes; within-subfunction offsets $${(offsetsTotal / 1e9).toFixed(1)}B across ${offsetsByFunction.size} functions (kept as line items)`);
  for (const n of tree.slice(0, 10)) console.log(`  ${n.n}: $${(n.a / 1e9).toFixed(1)}B (${n.c.length} subfunctions)`);
  for (const e of excluded) console.log(`  ⚠ EXCLUDED ${e.kind}: ${e.name} $${(e.value / 1e9).toFixed(1)}B`);

  // Reconciliation: displayed + excluded nets == net_total (identity), and vs anchor
  const recon = Math.abs(total + excludedSum - OMB_OUTLAYS) / OMB_OUTLAYS;
  console.log(`Displayed $${(total / 1e9).toFixed(1)}B + excluded $${(excludedSum / 1e9).toFixed(1)}B vs anchor: ${(recon * 100).toFixed(4)}%`);
  if (recon > 0.005) throw new Error('Reconciliation outside 0.5% — halting');

  if (dryRun) { console.log('[dry-run] No DB writes.'); return; }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: muni, error: muniErr } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (muniErr || !muni) throw new Error('US federal entity not found — run seedUSFederal.js');

  // data_sources upsert
  const src = {
    name: `US Federal Outlays by Function FY${FY} (OMB Public Budget Database)`,
    api_type: 'xlsx_download',
    dataset_type: 'operating',
    dataset_id: `fy${FY}`,
    base_url: outlaysUrl,
    fiscal_years: [FY],
    fiscal_year_start_month: 10,
    municipality_id: muni.id,
    column_mapping: { hierarchy_columns: ['function', 'subfunction', 'account'] },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muni.id).eq('api_type', 'xlsx_download')
    .eq('dataset_id', `fy${FY}`).eq('dataset_type', 'operating').maybeSingle();
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

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: FY,
    p_dataset_type: 'operating',
    p_total: total,
    p_tree: tree,
    p_row_count: rows.length,
    p_triggered_by: 'bulk_load',
  });
  if (rpcErr) throw new Error(`RPC: ${rpcErr.message}`);
  if (rpc?.error) throw new Error(`RPC returned: ${rpc.error}`);
  console.log(`Inserted: ${rpc?.rows_inserted} line items (budget ${rpc?.budget_id})`);

  // Excluded nets + per-function offsets → disclosure metrics
  const today = new Date().toISOString().slice(0, 10);
  const metricRows = excluded.map(e => ({
    metric_key: `excluded_${e.kind}_${slug(e.name)}_fy${FY}`,
    value: e.value, as_of_date: `${FY}-09-30`,
    label: `Excluded from FY${FY} spending visual (net ≤ 0 ${e.kind}): ${e.name}`,
  }));
  for (const [fnTitle, negSum] of offsetsByFunction) {
    metricRows.push({
      metric_key: `offsets_within_${slug(fnTitle)}_fy${FY}`,
      value: negSum, as_of_date: `${FY}-09-30`,
      label: `Offsetting collections/receipts inside ${fnTitle} (FY${FY}) — present as negative line items, not as tree bars`,
    });
  }
  for (const m of metricRows) {
    const row = {
      ...m,
      source_name: 'omb-historical-tables', source_url: outlaysUrl, source_date: today,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.schema('treasury').from('federal_context_metrics')
      .upsert(row, { onConflict: 'metric_key' });
    if (error) throw new Error(`metric: ${error.message}`);
  }
  console.log(`Disclosure metrics: ${metricRows.length}`);
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
