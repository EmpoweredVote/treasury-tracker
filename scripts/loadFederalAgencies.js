#!/usr/bin/env node
/**
 * Federal Agency-Lens Loader (Phase 44, Plan 05)
 *
 * Who spends it: Department → Bureau → Account tree from MTS Table 5 at
 * record_date 2025-09-30 (September FYTD = FY2025 full-year actuals).
 * dataset_type='federal_agency' (legal since 44-01; kept out of city tabs).
 *
 * Tree rules (43-CONTEXT/44-CONTEXT gotchas):
 *   - Build STRICTLY by parent_id/classification_id linkage; depth from
 *     sequence_level_nbr. NEVER sum 'Total--*' rows (printed subtotals at
 *     MIXED levels — summing them double-counts).
 *   - Exclude: 'Total--*', 'Total', 'Memorandum' subtrees, on/off-budget
 *     total rows ('Total On-Budget', 'Total Off-Budget', '(On-Budget)',
 *     '(Off-Budget)'), 'Sale of Major Assets' memorandum items.
 *   - Leaf amount = current_fytd_net_outly_amt. Parent nodes with null
 *     amounts take the sum of kept children. Parents with BOTH an amount and
 *     children: children-sum wins; discrepancy > 0.1% logged.
 *   - Negative nodes (Proprietary Receipts, Intrabudgetary Transactions,
 *     Offsetting Governmental Receipts, negative accounts): excluded from the
 *     tree, kept as '(offsetting)' line items on their parent, aggregated per
 *     department into disclosure metrics.
 *   - Reconciliation: displayed roots + excluded nets vs MTS T9 FY2025 total
 *     net outlays ($7,010.0B) within 0.5%.
 *
 * Usage: node scripts/loadFederalAgencies.js [--dry-run]
 * Checkpoint: 44-03 GO decision (Chris, 2026-06-12) covers this load.
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
const FY = 2025;
const FY_DATE = '2025-09-30';
const T9_NET_OUTLAYS = 7_010_038e6; // FY2025 T9 'Total' net outlays (verified live 2026-06-12: $7,010.0B)
const RECON_TOLERANCE = 0.005;

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const amt = (r) =>
  r.current_fytd_net_outly_amt === 'null' || r.current_fytd_net_outly_amt == null
    ? null : Number(r.current_fytd_net_outly_amt);

// Printed subtotals and grand totals duplicate their siblings/sections —
// ignored entirely (no tally; tallying them would double-count).
const isSubtotalName = (name) =>
  name.startsWith('Total--') || name === 'Total' || name.startsWith('Total ') ||
  name === 'Memorandum' || name === 'Net Outlays';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// ── Build forest from parent_id linkage ───────────────────────────────────────
// Uniform, complete-by-construction rule: every leaf dollar ends up either in
// a displayed (positive) node or in the dropped ledger, EXACTLY once.
//   leaf  → amount = its own FYTD net outlay
//   parent→ amount = sum of its kept (positive) children; non-positive children
//           are tallied into the dropped ledger AND kept as '(offsetting)' line
//           items on the parent, so the data retains them honestly.
// Parents' own printed amounts are used only for leaf fallback + discrepancy
// logging — never summed alongside children (the Total-- double-count trap).
function buildForest(rows) {
  const children = new Map();
  for (const r of rows) {
    const pid = r.parent_id === 'null' ? null : r.parent_id;
    if (!children.has(pid)) children.set(pid, []);
    children.get(pid).push(r);
  }
  for (const list of children.values()) {
    list.sort((a, b) => Number(a.src_line_nbr) - Number(b.src_line_nbr));
  }

  const droppedByDept = new Map(); // dept -> sum of non-positive nets dropped from bars
  const discrepancies = [];
  const excludedNames = new Set();

  function tally(dept, v) {
    if (v) droppedByDept.set(dept, (droppedByDept.get(dept) ?? 0) + v);
  }

  // Returns a node {n, a, c?, i?} — possibly with a <= 0; the CALLER decides
  // whether it becomes a bar (a > 0) or a tallied line item. Returns null only
  // for subtotal rows, which must vanish without a tally.
  function walk(row, deptName) {
    const name = row.classification_desc.replace(/:$/, '').trim();
    if (isSubtotalName(name)) { excludedNames.add(name); return null; }

    const kids = (children.get(row.classification_id) ?? []);
    const ownAmt = amt(row);

    if (kids.length === 0) {
      return { n: name, a: ownAmt ?? 0, i: [{ d: name, a: ownAmt ?? 0, aa: null, f: null, e: null }] };
    }

    const built = kids.map(k => walk(k, deptName)).filter(Boolean);
    const kept = built.filter(n => n.a > 0);
    const dropped = built.filter(n => n.a <= 0);

    const nodeAmt = kept.reduce((s, n) => s + n.a, 0);
    for (const d of dropped) tally(deptName, d.a);

    if (ownAmt !== null && ownAmt > 0 && nodeAmt > 0 && Math.abs(ownAmt - nodeAmt) / ownAmt > 0.001) {
      discrepancies.push({ name, own: ownAmt, sum: nodeAmt });
    }

    const node = { n: name, a: nodeAmt };
    if (kept.length) node.c = kept;
    if (dropped.length) {
      node.i = dropped.map(d => ({ d: `${d.n} (offsetting)`, a: d.a, aa: null, f: null, e: null }));
    }
    return node;
  }

  const roots = [];
  for (const r of (children.get(null) ?? []).filter(r => r.sequence_level_nbr === '1')) {
    const deptName = r.classification_desc.replace(/:$/, '').trim();
    const node = walk(r, deptName);
    if (!node) continue;
    if (node.a > 0) roots.push(node);
    else tally(deptName, node.a);
  }
  roots.sort((a, b) => b.a - a.a);

  return { roots, droppedByDept, discrepancies, excludedNames: [...excludedNames] };
}

function depthStats(nodes, d = 0, acc = {}) {
  for (const n of nodes) {
    acc[d] = (acc[d] ?? 0) + 1;
    if (n.c) depthStats(n.c, d + 1, acc);
  }
  return acc;
}

async function main() {
  // Paginate T5 (≈800 rows/month)
  const baseUrl = `${API}/v1/accounting/mts/mts_table_5?filter=record_date:eq:${FY_DATE}&page%5Bsize%5D=900`;
  console.log(`Fetching FY${FY} T5: ${baseUrl}`);
  const first = await fetchJson(baseUrl);
  let rows = first.data ?? [];
  const totalCount = first.meta['total-count'];
  for (let page = 2; rows.length < totalCount; page++) {
    const d = await fetchJson(`${baseUrl}&page%5Bnumber%5D=${page}`);
    if (!d.data?.length) break;
    rows = rows.concat(d.data);
  }
  if (!rows.length) throw new Error(`No T5 rows for ${FY_DATE}`);
  console.log(`  ${rows.length}/${totalCount} rows fetched`);

  const { roots, droppedByDept, discrepancies, excludedNames } = buildForest(rows);
  const total = roots.reduce((s, n) => s + n.a, 0);
  const droppedTotal = [...droppedByDept.values()].reduce((s, v) => s + v, 0);
  const stats = depthStats(roots);

  console.log(`  Tree: ${roots.length} departments; depth distribution ${JSON.stringify(stats)}`);
  for (const n of roots.slice(0, 10)) console.log(`    ${n.n}: $${(n.a / 1e9).toFixed(1)}B`);
  console.log(`  Dropped (net ≤ 0) from bars: $${(droppedTotal / 1e9).toFixed(1)}B across ${droppedByDept.size} departments (kept as line items)`);
  console.log(`  Ignored subtotal labels: ${excludedNames.length}`);
  if (discrepancies.length) {
    console.log(`  ⚠ parent-vs-children discrepancies > 0.1%: ${discrepancies.length}`);
    for (const d of discrepancies.slice(0, 5)) console.log(`    ${d.name}: own ${d.own} vs sum ${d.sum}`);
  }

  // Identity check vs T5's own 'Total Outlays' row, cross-check vs T9 constant
  const t5TotalRow = rows.find(r => r.classification_desc.trim() === 'Total Outlays');
  const t5Total = t5TotalRow ? amt(t5TotalRow) : null;
  const reconTarget = t5Total ?? T9_NET_OUTLAYS;
  const recon = Math.abs(total + droppedTotal - reconTarget) / reconTarget;
  console.log(`  Displayed $${(total / 1e9).toFixed(1)}B + dropped $${(droppedTotal / 1e9).toFixed(1)}B vs T5 'Total Outlays' $${(reconTarget / 1e9).toFixed(1)}B: ${(recon * 100).toFixed(3)}%`);
  const t9delta = Math.abs(total + droppedTotal - T9_NET_OUTLAYS) / T9_NET_OUTLAYS;
  console.log(`  Cross-check vs T9 net outlays $${(T9_NET_OUTLAYS / 1e9).toFixed(1)}B: ${(t9delta * 100).toFixed(3)}%`);
  if (recon > RECON_TOLERANCE) throw new Error(`Reconciliation ${(recon * 100).toFixed(3)}% outside ${RECON_TOLERANCE * 100}% — halting`);
  if (t9delta > RECON_TOLERANCE) throw new Error(`T9 cross-check ${(t9delta * 100).toFixed(3)}% outside ${RECON_TOLERANCE * 100}% — halting`);

  if (dryRun) { console.log('[dry-run] No DB writes.'); return; }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: muni, error: muniErr } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (muniErr || !muni) throw new Error('US federal entity not found — run seedUSFederal.js');

  const src = {
    name: `US Federal Outlays by Agency FY${FY} (MTS Table 5)`,
    api_type: 'fiscal-data-api',
    dataset_type: 'federal_agency',
    dataset_id: `fy${FY}`,
    base_url: baseUrl,
    fiscal_years: [FY],
    fiscal_year_start_month: 10,
    municipality_id: muni.id,
    column_mapping: { hierarchy_columns: ['department', 'bureau', 'account'] },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muni.id).eq('api_type', 'fiscal-data-api')
    .eq('dataset_id', `fy${FY}`).eq('dataset_type', 'federal_agency').maybeSingle();
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

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: FY,
    p_dataset_type: 'federal_agency',
    p_total: total,
    p_tree: roots,
    p_row_count: rows.length,
    p_triggered_by: 'bulk_load',
  });
  if (rpcErr) throw new Error(`RPC: ${rpcErr.message}`);
  if (rpc?.error) throw new Error(`RPC returned: ${rpc.error}`);
  console.log(`  Inserted: ${rpc?.rows_inserted} line items (budget ${rpc?.budget_id})`);

  const today = new Date().toISOString().slice(0, 10);
  for (const [dept, v] of droppedByDept) {
    const row = {
      metric_key: `agency_offsets_${slug(dept)}_fy${FY}`,
      value: v, as_of_date: FY_DATE,
      label: `Offsetting receipts/intrabudgetary transactions inside ${dept} (FY${FY}, agency lens) — line items, not tree bars`,
      source_name: 'treasury-fiscal-data', source_url: baseUrl, source_date: today,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.schema('treasury').from('federal_context_metrics')
      .upsert(row, { onConflict: 'metric_key' });
    if (error) throw new Error(`metric: ${error.message}`);
  }
  console.log(`  Disclosure metrics: ${droppedByDept.size}`);
  console.log('Done.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
