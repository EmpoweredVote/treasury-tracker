#!/usr/bin/env node
/**
 * Federal MTS Loader (Phase 44, Plan 03)
 *
 * Loads from the Treasury Fiscal Data API (free, no key):
 *   A. --dataset revenue : FY2025 receipts-by-source tree (MTS Table 9 at
 *      record_date 2025-09-30 — September FYTD = full-year actuals).
 *      2-level: 'Social Insurance and Retirement Receipts' carries L3 children.
 *      ⚠️ FIRST treasury.budgets WRITE for the US entity = public visibility.
 *         Gated by the 44-03 human checkpoint. Use --dry-run until GO recorded.
 *   B. --dataset metrics : federal_context_metrics upserts (NO app visibility):
 *      - fytd_receipts / fytd_outlays   (latest MTS T9 month, FY2026)
 *      - total_public_debt              (Debt to the Penny, latest)
 *      - fytd_interest_expense          (gross; sum of all security-type rows,
 *                                        latest month — NOT the same concept as
 *                                        the MTS 'Net Interest' function)
 *   C. --dataset all : both.
 *
 * Validation: revenue tree total within 0.5% of OMB FY2025 receipts
 * ($5,236,421M; MTS shows $5,234.6B — 0.03% cross-source delta, verified).
 * Negative/zero lines: excluded from tree, logged, stored as context metrics.
 *
 * Usage: node scripts/loadFederalMTS.js --dataset revenue --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
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

const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const FY2025_DATE = '2025-09-30';
const OMB_FY2025_RECEIPTS = 5_236_421e6; // anchor (federal_annual_summary / OMB 1.1)
const SOURCE_NAME = 'treasury-fiscal-data'; // source_registry key

const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    dataset: { type: 'string', default: 'all' }, // revenue | metrics | all
  },
});
const dryRun = opts['dry-run'];
const dataset = opts.dataset;

const t9Url = (filter) =>
  `${API}/v1/accounting/mts/mts_table_9?filter=${filter}&page%5Bsize%5D=200`;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const amt = (r, f = 'current_fytd_rcpt_outly_amt') =>
  r[f] === 'null' || r[f] == null ? null : Number(r[f]);

// ── Receipts tree from T9 (between L1 'Receipts' and L1 'Net Outlays') ───────
function buildReceiptsTree(rows) {
  const sorted = [...rows].sort((a, b) => Number(a.src_line_nbr) - Number(b.src_line_nbr));
  const start = sorted.findIndex(r => r.sequence_level_nbr === '1' && r.classification_desc === 'Receipts');
  const end = sorted.findIndex(r => r.sequence_level_nbr === '1' && r.classification_desc === 'Net Outlays');
  if (start === -1 || end === -1) throw new Error('T9 section markers not found');
  const section = sorted.slice(start + 1, end).filter(r => r.classification_desc !== 'Total');

  const tree = [];
  const excluded = [];
  let parent = null;
  let mtsTotal = 0;

  for (const r of section) {
    const name = r.classification_desc.replace(/:$/, '').trim();
    const value = amt(r);
    const level = r.sequence_level_nbr;

    if (level === '2' && value === null) {
      // Parent header (e.g. 'Social Insurance and Retirement Receipts:')
      parent = { n: name, a: 0, c: [] };
      tree.push(parent);
      continue;
    }
    if (value === null) continue;
    mtsTotal += value;

    if (value <= 0) {
      excluded.push({ name, value });
      continue;
    }
    const node = { n: name, a: value, i: [{ d: name, a: value, aa: null, f: null, e: null }] };
    if (level === '3' && parent) { parent.c.push(node); parent.a += value; }
    else { parent = null; tree.push(node); }
  }

  const cleanTree = tree.filter(n => n.a > 0);
  const total = cleanTree.reduce((s, n) => s + n.a, 0);
  return { tree: cleanTree, total, mtsTotal, excluded };
}

// ── data_sources upsert (loadMACountyBudget.js pattern) ──────────────────────
async function upsertDataSource(supabase, muniId, dsType, dsId, name, baseUrl, hierarchyCols, fiscalYears) {
  const src = {
    name,
    api_type: 'fiscal-data-api',
    dataset_type: dsType,
    dataset_id: dsId,
    base_url: baseUrl,
    fiscal_years: fiscalYears,
    fiscal_year_start_month: 10, // federal FY starts October (43-03 contract)
    municipality_id: muniId,
    column_mapping: { hierarchy_columns: hierarchyCols },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId).eq('api_type', 'fiscal-data-api')
    .eq('dataset_id', dsId).eq('dataset_type', dsType)
    .maybeSingle();
  if (existing?.id) {
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) throw new Error(`data_source update: ${error.message}`);
    return data;
  }
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) throw new Error(`data_source insert: ${error.message}`);
  return data;
}

async function getUSMunicipality(supabase) {
  const { data, error } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (error || !data) throw new Error('US federal entity not found — run seedUSFederal.js first');
  return data.id;
}

async function upsertMetric(supabase, key, value, asOf, label, sourceUrl) {
  const row = {
    metric_key: key, value, as_of_date: asOf, label,
    source_name: SOURCE_NAME, source_url: sourceUrl,
    source_date: new Date().toISOString().slice(0, 10),
    updated_at: new Date().toISOString(),
  };
  if (dryRun) { console.log(`  [dry-run] metric ${key} = ${value.toLocaleString()} (as of ${asOf})`); return; }
  const { error } = await supabase.schema('treasury').from('federal_context_metrics')
    .upsert(row, { onConflict: 'metric_key' });
  if (error) throw new Error(`metric ${key}: ${error.message}`);
  console.log(`  metric ${key} = ${value.toLocaleString()} (as of ${asOf})`);
}

// ── Revenue dataset ───────────────────────────────────────────────────────────
async function loadRevenue(supabase, muniId) {
  const url = t9Url(`record_date:eq:${FY2025_DATE}`);
  console.log(`Fetching FY2025 T9: ${url}`);
  const d = await fetchJson(url);
  if (!d.data?.length) throw new Error(`No T9 rows for ${FY2025_DATE} — check available record_dates`);

  const { tree, total, mtsTotal, excluded } = buildReceiptsTree(d.data);

  console.log(`  Receipts tree: ${tree.length} roots, total $${(total / 1e9).toFixed(1)}B (MTS section total incl. negatives: $${(mtsTotal / 1e9).toFixed(1)}B)`);
  for (const n of tree) {
    console.log(`    ${n.c ? '▸' : '·'} ${n.n}: $${(n.a / 1e9).toFixed(1)}B${n.c ? ` (${n.c.length} children)` : ''}`);
  }
  for (const e of excluded) console.log(`    ⚠ EXCLUDED (≤0): ${e.name} $${(e.value / 1e9).toFixed(1)}B`);

  const delta = Math.abs(total - OMB_FY2025_RECEIPTS) / OMB_FY2025_RECEIPTS;
  console.log(`  Delta vs OMB FY2025 receipts: ${(delta * 100).toFixed(3)}%`);
  if (delta > 0.005) throw new Error(`Receipts total outside 0.5% of OMB anchor — halting`);

  if (dryRun) { console.log('[dry-run] No DB writes.'); return; }

  const ds = await upsertDataSource(
    supabase, muniId, 'revenue', 'fy2025',
    'US Federal Receipts by Source FY2025 (MTS Table 9)',
    url, ['source', 'subcategory'], [2025],
  );
  console.log(`  data_source: ${ds.id}`);

  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', 2025);
  if (delErr) throw new Error(`pre-delete: ${delErr.message}`);

  const rowCount = tree.reduce((s, n) => s + 1 + (n.c?.length ?? 0), 0);
  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: 2025,
    p_dataset_type: 'revenue',
    p_total: total,
    p_tree: tree,
    p_row_count: rowCount,
    p_triggered_by: 'bulk_load',
  });
  if (rpcErr) throw new Error(`RPC: ${rpcErr.message}`);
  if (rpc?.error) throw new Error(`RPC returned: ${rpc.error}`);
  console.log(`  Inserted: ${rpc?.rows_inserted ?? '?'} line items (budget ${rpc?.budget_id})`);

  // Excluded negatives → disclosure metrics
  for (const e of excluded) {
    const slug = e.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    await upsertMetric(supabase, `excluded_receipt_${slug}_fy2025`, e.value, FY2025_DATE,
      `Excluded from FY2025 receipts visual (negative line): ${e.name}`, url);
  }
}

// ── Context metrics ───────────────────────────────────────────────────────────
async function loadMetrics(supabase) {
  // Latest T9 month: FYTD receipts + outlays
  const latestUrl = `${API}/v1/accounting/mts/mts_table_9?sort=-record_date&page%5Bsize%5D=1`;
  const latest = await fetchJson(latestUrl);
  const latestDate = latest.data[0].record_date;
  const monthUrl = t9Url(`record_date:eq:${latestDate}`);
  const month = await fetchJson(monthUrl);
  const sorted = month.data.sort((a, b) => Number(a.src_line_nbr) - Number(b.src_line_nbr));
  const recIdx = sorted.findIndex(r => r.sequence_level_nbr === '1' && r.classification_desc === 'Receipts');
  const outIdx = sorted.findIndex(r => r.sequence_level_nbr === '1' && r.classification_desc === 'Net Outlays');
  const recTotal = sorted.slice(recIdx, outIdx).find(r => r.classification_desc === 'Total');
  const outTotal = sorted.slice(outIdx).find(r => r.classification_desc === 'Total');
  // Federal FY = calendar year + 1 when the month is October or later
  const fy = Number(latestDate.slice(0, 4)) + (Number(latestDate.slice(5, 7)) >= 10 ? 1 : 0);
  await upsertMetric(supabase, 'fytd_receipts', amt(recTotal), latestDate,
    `FY${fy} receipts, fiscal year to date through ${latestDate}`, monthUrl);
  await upsertMetric(supabase, 'fytd_outlays', amt(outTotal), latestDate,
    `FY${fy} net outlays, fiscal year to date through ${latestDate}`, monthUrl);

  // Debt to the Penny
  const dtpUrl = `${API}/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=1`;
  const dtp = await fetchJson(dtpUrl);
  await upsertMetric(supabase, 'total_public_debt', Number(dtp.data[0].tot_pub_debt_out_amt),
    dtp.data[0].record_date, `Total public debt outstanding as of ${dtp.data[0].record_date}`, dtpUrl);

  // Gross interest expense FYTD: sum all security-type rows at the latest date.
  // NOTE: 'gross interest expense' ≠ the MTS 'Net Interest' budget function.
  const ieLatest = await fetchJson(`${API}/v2/accounting/od/interest_expense?sort=-record_date&page%5Bsize%5D=1`);
  const ieDate = ieLatest.data[0].record_date;
  const ieUrl = `${API}/v2/accounting/od/interest_expense?filter=record_date:eq:${ieDate}&page%5Bsize%5D=900`;
  const ie = await fetchJson(ieUrl);
  const ieSum = ie.data.reduce((s, r) => s + (amt(r, 'fytd_expense_amt') ?? 0), 0);
  await upsertMetric(supabase, 'fytd_interest_expense', ieSum, ieDate,
    `Gross federal interest expense, fiscal year to date through ${ieDate} (sum of all security types; not the same measure as the Net Interest budget function)`, ieUrl);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!dryRun && !SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = dryRun && !SUPABASE_KEY ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

  if (dataset === 'revenue' || dataset === 'all') {
    const muniId = dryRun ? null : await getUSMunicipality(supabase);
    await loadRevenue(supabase, muniId);
  }
  if (dataset === 'metrics' || dataset === 'all') {
    await loadMetrics(supabase);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
