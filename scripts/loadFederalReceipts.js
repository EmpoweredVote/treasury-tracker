#!/usr/bin/env node
/**
 * Federal Receipts-by-Source Loader (Phase 49) — historical, from OMB Hist 2.1.
 *
 * Money In: a FLAT tree of major receipt sources for any fiscal year FY1976–FY2024
 * (and the FY1976 Transition Quarter), read directly from OMB Historical Table 2.1
 * (free xlsx, browser UA). The existing FY2025 `revenue` tree comes from MTS Table 9
 * (Fiscal Data API, history only to FY2015), so history needs this OMB-sourced path.
 *
 * Shape (CONTEXT D-04, clarity-first): one flat level of the table's own top-level
 * source buckets. The current Hist 2.1 edition exposes 5 (Individual Income,
 * Corporation Income, Social Insurance & Retirement, Excise, Other [estate & gift +
 * customs + miscellaneous, per the table footnote]). The extractor is data-driven, so
 * an edition that splits Other into 3 columns yields 7 buckets with no code change.
 *
 * Per-year anchor = OMB Hist 1.1 receipts (treasury.federal_annual_summary). Never
 * hard-halts on a historical reconciliation miss — loads anyway + disclosure (HIST-04).
 *
 * Usage:
 *   node scripts/loadFederalReceipts.js --fy 2024 --dry-run
 *   node scripts/loadFederalReceipts.js --tq --dry-run     # Transition Quarter
 *
 * The TQ run passes p_period_label and requires migration 49-01.
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

const HIST_LANDING = 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const RECON_TOLERANCE = 0.005;

const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    fy: { type: 'string' },
    tq: { type: 'boolean', default: false },
  },
});
const dryRun = opts['dry-run'];
const isTQ = opts.tq;
if (!isTQ && !opts.fy) { console.error('Specify --fy <YEAR> or --tq'); process.exit(1); }

const FY = isTQ ? 1976 : parseInt(opts.fy, 10);
if (!isTQ && (!Number.isInteger(FY) || FY < 1962 || FY > 2025)) { console.error(`--fy must be 1962–2025 (got ${opts.fy})`); process.exit(1); }
const PERIOD = isTQ ? 'TQ' : String(FY);
const PERIOD_LABEL = isTQ ? 'Transition Quarter (Jul–Sep 1976)' : null;
const DATASET_ID = isTQ ? 'tq1976' : `fy${FY}`;
const PERIOD_KEY = isTQ ? 'tq1976' : `fy${FY}`;
const AS_OF = isTQ ? '1976-09-30' : `${FY}-09-30`;
const HUMAN = isTQ ? 'Transition Quarter (Jul–Sep 1976)' : `FY${FY}`;

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
  if (!m) throw new Error(`No ${stem} xlsx on page (whitehouse.gov only)`);
  return m[1];
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

async function main() {
  console.log(`\n=== Receipts lens: ${HUMAN} (Hist 2.1 row "${PERIOD}") ===`);
  const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  if (!supabase) console.warn('No SUPABASE key — anchor check skipped.');

  const histHtml = await fetchText(HIST_LANDING);
  const hist21Url = findXlsxUrl(histHtml, 'hist02z1');
  console.log(`Hist 2.1: ${hist21Url}`);

  const dir = path.join(tmpdir(), 'omb-receipts');
  mkdirSync(dir, { recursive: true });
  const f21 = path.join(dir, 'hist02z1.xlsx');
  await download(hist21Url, f21);

  let json;
  try {
    json = execFileSync('python', [path.join(__dirname, 'extractOMBReceipts.py'), f21, PERIOD],
      { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch (e) {
    const stderr = e.stderr ? String(e.stderr) : e.message;
    throw new Error(`Receipts extractor failed for "${PERIOD}": ${stderr.trim()}`);
  }
  const { buckets, total_receipts } = JSON.parse(json);

  // Flat tree: positive buckets become nodes; non-positive buckets disclosed.
  const positives = buckets.filter(b => b.amount > 0).sort((a, b) => b.amount - a.amount);
  const excluded = buckets.filter(b => b.amount <= 0);
  const tree = positives.map(b => ({ n: b.name, a: b.amount, i: [{ d: b.name, a: b.amount, aa: null, f: null, e: null }] }));
  const total = tree.reduce((s, n) => s + n.a, 0);

  console.log(`Buckets (${buckets.length}): ${buckets.map(b => `${b.name} $${(b.amount / 1e9).toFixed(1)}B`).join(' · ')}`);
  console.log(`Sum of buckets $${(total / 1e9).toFixed(1)}B; table Total Receipts $${(total_receipts / 1e9).toFixed(1)}B`);

  let anchor = null, anchorSource = null;
  if (supabase && !isTQ) {
    const { data: fas } = await supabase.schema('treasury').from('federal_annual_summary')
      .select('receipts').eq('fiscal_year', FY).maybeSingle();
    if (fas?.receipts != null) { anchor = Number(fas.receipts); anchorSource = 'federal_annual_summary (OMB Hist 1.1)'; }
  }

  let visualVsOfficial = null;
  if (anchor != null) {
    const delta = Math.abs(total - anchor) / anchor;
    console.log(`Sum vs anchor $${(anchor / 1e9).toFixed(1)}B (${anchorSource}): ${(delta * 100).toFixed(4)}%`);
    if (delta > RECON_TOLERANCE) {
      visualVsOfficial = total - anchor;
      console.warn(`  ⚠ Tier-2: outside ${RECON_TOLERANCE * 100}% — loading anyway with disclosure (gap $${(visualVsOfficial / 1e9).toFixed(1)}B).`);
    }
  } else {
    console.log(`No anchor (${isTQ ? 'TQ self-anchors on Hist 2.1 row' : 'summary missing this year'}).`);
  }

  if (dryRun) { console.log('[dry-run] No DB writes.'); return; }

  if (!supabase) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const { data: muni, error: muniErr } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (muniErr || !muni) throw new Error('US federal entity not found — run seedUSFederal.js');

  const src = {
    name: `US Federal Receipts by Source ${HUMAN} (OMB Historical Table 2.1)`,
    api_type: 'xlsx_download',
    dataset_type: 'revenue',
    dataset_id: DATASET_ID,
    base_url: hist21Url,
    fiscal_years: [FY],
    fiscal_year_start_month: 10,
    municipality_id: muni.id,
    column_mapping: { hierarchy_columns: ['source'] },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muni.id).eq('api_type', 'xlsx_download')
    .eq('dataset_id', DATASET_ID).eq('dataset_type', 'revenue').maybeSingle();
  let ds;
  if (existing?.id) {
    ({ data: ds } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single());
  } else {
    ({ data: ds } = await supabase.schema('treasury').from('data_sources')
      .insert(src).select().single());
  }
  if (!ds?.id) throw new Error('data_source upsert failed');
  console.log(`  data_source: ${ds.id}`);

  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FY);
  if (delErr) throw new Error(`pre-delete: ${delErr.message}`);

  const rpcParams = {
    p_data_source_id: ds.id,
    p_fiscal_year: FY,
    p_dataset_type: 'revenue',
    p_total: total,
    p_tree: tree,
    p_row_count: tree.length,
    p_triggered_by: 'bulk_load',
  };
  if (PERIOD_LABEL) rpcParams.p_period_label = PERIOD_LABEL;

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', rpcParams);
  if (rpcErr) {
    if (PERIOD_LABEL) throw new Error(`RPC: ${rpcErr.message} — the TQ requires migration 49-01. Apply it first.`);
    throw new Error(`RPC: ${rpcErr.message}`);
  }
  if (rpc?.error) throw new Error(`RPC returned: ${rpc.error}`);
  console.log(`  Inserted: ${rpc?.rows_inserted} line items (budget ${rpc?.budget_id})`);

  const today = new Date().toISOString().slice(0, 10);
  const metricRows = excluded.map(e => ({
    metric_key: `excluded_receipt_${slug(e.name)}_${PERIOD_KEY}`,
    value: e.amount, as_of_date: AS_OF,
    label: `Excluded from ${HUMAN} receipts visual (non-positive source): ${e.name}`,
  }));
  if (visualVsOfficial != null) {
    metricRows.push({
      metric_key: `visual_vs_official_receipts_${PERIOD_KEY}`,
      value: visualVsOfficial, as_of_date: AS_OF,
      label: `${HUMAN} receipts bucket sum minus OMB published receipts ($${(anchor / 1e9).toFixed(1)}B) — did not reconcile within ${RECON_TOLERANCE * 100}%; loaded anyway per HIST-04`,
    });
  }
  for (const m of metricRows) {
    const row = {
      ...m,
      source_name: 'omb-historical-tables', source_url: hist21Url, source_date: today,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.schema('treasury').from('federal_context_metrics')
      .upsert(row, { onConflict: 'metric_key' });
    if (error) throw new Error(`metric: ${error.message}`);
  }
  console.log(`  Disclosure metrics: ${metricRows.length}`);
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
