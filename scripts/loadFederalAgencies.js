#!/usr/bin/env node
/**
 * Federal Agency-Lens Loader (Phase 44, Plan 05 — historical path added in Phase 49)
 *
 * Who spends it: Department → Bureau → Account.
 *
 *   --source mts (default, FY2025): MTS Table 5 at record_date 2025-09-30. The
 *     Fiscal Data API only carries T5 back to FY2015, so this path CANNOT backfill.
 *
 *   --source omb (Phase 49, FY1976–FY2024 + TQ): rebuilds the agency tree from the
 *     OMB Public Budget Database — the SAME account rows the function lens uses,
 *     regrouped by agency→bureau→account. Full account depth for every year from a
 *     single free file. Net total is identical to the function lens by construction,
 *     so it reconciles to the same OMB Hist 1.1 anchor (federal_annual_summary).
 *
 * Tree rules: leaf = account net; bureau/department node amount = NET sum; positive
 * accounts become child nodes, negative accounts (offsetting) ride as line items and
 * aggregate into per-department disclosure metrics; net<=0 bureaus/departments are
 * excluded + disclosed. Historical years never hard-halt — load-anyway + per-year
 * visual-vs-official disclosure (HIST-04).
 *
 * Usage:
 *   node scripts/loadFederalAgencies.js [--dry-run]                 # FY2025 MTS (back-compat)
 *   node scripts/loadFederalAgencies.js --source omb --fy 2024 --dry-run
 *   node scripts/loadFederalAgencies.js --source omb --tq --dry-run # Transition Quarter
 *
 * The TQ run passes p_period_label and requires migration 49-01.
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

const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const FY2025 = 2025;
const FY2025_DATE = '2025-09-30';
const T9_NET_OUTLAYS = 7_010_038e6; // FY2025 T9 'Total' net outlays (verified 2026-06-12)
const RECON_TOLERANCE = 0.005;

// OMB historical path
const SUPPLEMENTAL = 'https://www.whitehouse.gov/omb/information-resources/budget/supplemental-materials/';
const HIST_LANDING = 'https://www.whitehouse.gov/omb/information-resources/budget/historical-tables/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const { values: opts } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    source: { type: 'string', default: 'mts' }, // mts | omb
    fy: { type: 'string' },
    tq: { type: 'boolean', default: false },
  },
});
const dryRun = opts['dry-run'];
const SOURCE = opts.source;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
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

const amt = (r) =>
  r.current_fytd_net_outly_amt === 'null' || r.current_fytd_net_outly_amt == null
    ? null : Number(r.current_fytd_net_outly_amt);

const isSubtotalName = (name) =>
  name.startsWith('Total--') || name === 'Total' || name.startsWith('Total ') ||
  name === 'Memorandum' || name === 'Net Outlays';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

async function getUSMunicipality(supabase) {
  const { data, error } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (error || !data) throw new Error('US federal entity not found — run seedUSFederal.js');
  return data.id;
}

// ════════════════════════════════════════════════════════════════════════════
// MTS path (FY2025) — unchanged from Phase 44
// ════════════════════════════════════════════════════════════════════════════
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

  const droppedByDept = new Map();
  const discrepancies = [];
  const excludedNames = new Set();

  function tally(dept, v) {
    if (v) droppedByDept.set(dept, (droppedByDept.get(dept) ?? 0) + v);
  }

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

async function loadFromMTS() {
  const baseUrl = `${API}/v1/accounting/mts/mts_table_5?filter=record_date:eq:${FY2025_DATE}&page%5Bsize%5D=900`;
  console.log(`Fetching FY${FY2025} T5: ${baseUrl}`);
  const first = await fetchJson(baseUrl);
  let rows = first.data ?? [];
  const totalCount = first.meta['total-count'];
  for (let page = 2; rows.length < totalCount; page++) {
    const d = await fetchJson(`${baseUrl}&page%5Bnumber%5D=${page}`);
    if (!d.data?.length) break;
    rows = rows.concat(d.data);
  }
  if (!rows.length) throw new Error(`No T5 rows for ${FY2025_DATE}`);
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
  const muniId = await getUSMunicipality(supabase);

  const src = {
    name: `US Federal Outlays by Agency FY${FY2025} (MTS Table 5)`,
    api_type: 'fiscal-data-api',
    dataset_type: 'federal_agency',
    dataset_id: `fy${FY2025}`,
    base_url: baseUrl,
    fiscal_years: [FY2025],
    fiscal_year_start_month: 10,
    municipality_id: muniId,
    column_mapping: { hierarchy_columns: ['department', 'bureau', 'account'] },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muniId).eq('api_type', 'fiscal-data-api')
    .eq('dataset_id', `fy${FY2025}`).eq('dataset_type', 'federal_agency').maybeSingle();
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
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FY2025);
  if (delErr) throw new Error(`pre-delete: ${delErr.message}`);

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: FY2025,
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
      metric_key: `agency_offsets_${slug(dept)}_fy${FY2025}`,
      value: v, as_of_date: FY2025_DATE,
      label: `Offsetting receipts/intrabudgetary transactions inside ${dept} (FY${FY2025}, agency lens) — line items, not tree bars`,
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

// ════════════════════════════════════════════════════════════════════════════
// OMB Public Budget Database path (FY1976–FY2024 + TQ) — Phase 49
// ════════════════════════════════════════════════════════════════════════════
function buildAgencyTree(rows) {
  // Aggregate by agency → bureau → account (an account can appear under multiple
  // subfunctions in the PBD; sum them within the agency lens).
  const byAgency = new Map();
  for (const r of rows) {
    const agency = (r.agency || '').trim() || 'Unspecified Agency';
    const bureau = (r.bureau || '').trim() || '(agency-wide)';
    const account = (r.account || '').trim() || '(unspecified account)';
    if (!byAgency.has(agency)) byAgency.set(agency, new Map());
    const bMap = byAgency.get(agency);
    if (!bMap.has(bureau)) bMap.set(bureau, new Map());
    const aMap = bMap.get(bureau);
    aMap.set(account, (aMap.get(account) ?? 0) + r.amount);
  }

  const tree = [];
  const excluded = [];
  const offsetsByDept = new Map();
  let accountNodeCount = 0;

  for (const [agency, bMap] of [...byAgency.entries()].sort()) {
    const deptNode = { n: agency, a: 0, c: [] };
    for (const [bureau, aMap] of [...bMap.entries()].sort()) {
      const accounts = [...aMap.entries()].map(([account, amount]) => ({ account, amount }));
      const net = accounts.reduce((s, a) => s + a.amount, 0);
      if (net <= 0) { excluded.push({ kind: 'bureau', name: `${agency} / ${bureau}`, value: net }); continue; }
      const positives = accounts.filter(a => a.amount > 0).sort((x, y) => y.amount - x.amount);
      const negatives = accounts.filter(a => a.amount < 0).sort((x, y) => x.amount - y.amount);
      if (negatives.length) {
        const negSum = negatives.reduce((s, a) => s + a.amount, 0);
        offsetsByDept.set(agency, (offsetsByDept.get(agency) ?? 0) + negSum);
      }
      const bureauNode = {
        n: bureau,
        a: net,
        c: positives.map(a => { accountNodeCount += 1; return { n: a.account, a: a.amount, i: [{ d: a.account, a: a.amount, aa: null, f: null, e: null }] }; }),
        ...(negatives.length ? { i: negatives.map(a => ({ d: `${a.account} (offsetting)`, a: a.amount, aa: null, f: null, e: null })) } : {}),
      };
      deptNode.a += net;
      deptNode.c.push(bureauNode);
    }
    if (deptNode.a <= 0 || deptNode.c.length === 0) { excluded.push({ kind: 'department', name: agency, value: deptNode.a }); continue; }
    deptNode.c.sort((x, y) => y.a - x.a);
    tree.push(deptNode);
  }
  tree.sort((x, y) => y.a - x.a);
  const total = tree.reduce((s, n) => s + n.a, 0);
  return { tree, total, excluded, offsetsByDept, accountNodeCount };
}

async function loadFromOMB() {
  const isTQ = opts.tq;
  if (!isTQ && !opts.fy) { console.error('Specify --fy <YEAR> or --tq with --source omb'); process.exit(1); }
  const FY = isTQ ? 1976 : parseInt(opts.fy, 10);
  if (!isTQ && (!Number.isInteger(FY) || FY < 1962 || FY > 2025)) { console.error(`--fy must be 1962–2025 (got ${opts.fy})`); process.exit(1); }
  const COLUMN = isTQ ? 'TQ' : String(FY);
  const PERIOD_LABEL = isTQ ? 'Transition Quarter (Jul–Sep 1976)' : null;
  const DATASET_ID = isTQ ? 'tq1976' : `fy${FY}`;
  const PERIOD_KEY = isTQ ? 'tq1976' : `fy${FY}`;
  const AS_OF = isTQ ? '1976-09-30' : `${FY}-09-30`;
  const HUMAN = isTQ ? 'Transition Quarter (Jul–Sep 1976)' : `FY${FY}`;

  console.log(`\n=== Agency lens (OMB PBD): ${HUMAN} (column "${COLUMN}") ===`);
  const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
  if (!supabase) console.warn('No SUPABASE key — anchor check skipped.');

  const suppHtml = await fetchText(SUPPLEMENTAL);
  const outlaysUrl = findXlsxUrl(suppHtml, 'outlays');
  const histHtml = await fetchText(HIST_LANDING);
  const hist32Url = findXlsxUrl(histHtml, 'hist03z2');
  console.log(`Outlays DB: ${outlaysUrl}`);

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
    throw new Error(`Extractor failed for column "${COLUMN}": ${stderr.trim()}`);
  }
  const { rows, net_total } = JSON.parse(json);
  console.log(`Extracted ${rows.length} account rows; net total $${(net_total / 1e9).toFixed(1)}B`);

  let anchor = null, anchorSource = null;
  if (supabase && !isTQ) {
    const { data: fas } = await supabase.schema('treasury').from('federal_annual_summary')
      .select('outlays').eq('fiscal_year', FY).maybeSingle();
    if (fas?.outlays != null) { anchor = Number(fas.outlays); anchorSource = 'federal_annual_summary (OMB Hist 1.1)'; }
  }

  const { tree, total, excluded, offsetsByDept, accountNodeCount } = buildAgencyTree(rows);
  const excludedSum = excluded.reduce((s, e) => s + e.value, 0);
  const offsetsTotal = [...offsetsByDept.values()].reduce((s, v) => s + v, 0);

  console.log(`Tree: ${tree.length} departments, ${tree.reduce((s, n) => s + n.c.length, 0)} bureaus, ${accountNodeCount} account nodes; within-bureau offsets $${(offsetsTotal / 1e9).toFixed(1)}B across ${offsetsByDept.size} departments`);
  for (const n of tree.slice(0, 8)) console.log(`  ${n.n}: $${(n.a / 1e9).toFixed(1)}B (${n.c.length} bureaus)`);

  let tier = 'account';
  let visualVsOfficial = null;
  if (anchor != null) {
    const netDelta = Math.abs(net_total - anchor) / anchor;
    console.log(`Net $${(net_total / 1e9).toFixed(1)}B vs anchor $${(anchor / 1e9).toFixed(1)}B (${anchorSource}): ${(netDelta * 100).toFixed(4)}%`);
    if (netDelta > RECON_TOLERANCE) {
      tier = 'load-anyway';
      visualVsOfficial = net_total - anchor;
      console.warn(`  ⚠ Tier-2 fallback: outside ${RECON_TOLERANCE * 100}% — loading anyway with disclosure (gap $${(visualVsOfficial / 1e9).toFixed(1)}B).`);
    }
  } else {
    console.log(`No anchor (${isTQ ? 'TQ self-anchors on PBD column' : 'summary missing this year'}).`);
  }

  if (dryRun) {
    console.log(`[dry-run] tier=${tier}; displayed $${(total / 1e9).toFixed(1)}B + excluded $${(excludedSum / 1e9).toFixed(1)}B. No DB writes.`);
    return;
  }

  if (!supabase) { console.error('Missing SUPABASE_SERVICE_KEY for write'); process.exit(1); }
  const muniId = await getUSMunicipality(supabase);

  const src = {
    name: `US Federal Outlays by Agency ${HUMAN} (OMB Public Budget Database)`,
    api_type: 'xlsx_download',
    dataset_type: 'federal_agency',
    dataset_id: DATASET_ID,
    base_url: outlaysUrl,
    fiscal_years: [FY],
    fiscal_year_start_month: 10,
    municipality_id: muniId,
    column_mapping: { hierarchy_columns: ['department', 'bureau', 'account'] },
  };
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('municipality_id', muniId).eq('api_type', 'xlsx_download')
    .eq('dataset_id', DATASET_ID).eq('dataset_type', 'federal_agency').maybeSingle();
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
    p_dataset_type: 'federal_agency',
    p_total: total,
    p_tree: tree,
    p_row_count: rows.length,
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

  // Link the budget to its source_registry row. The historical agency lens is
  // sourced from the OMB Public Budget Database (same file as the function lens).
  const { data: reg } = await supabase.schema('treasury').from('source_registry')
    .select('id').eq('name', 'omb-public-budget-database').single();
  if (!reg?.id) throw new Error("source_registry 'omb-public-budget-database' not found");
  const { error: linkErr } = await supabase.schema('treasury').from('budgets')
    .update({ data_source_id: reg.id }).eq('id', rpc.budget_id);
  if (linkErr) throw new Error(`budget source link: ${linkErr.message}`);

  const today = new Date().toISOString().slice(0, 10);
  const metricRows = [];
  for (const [dept, v] of offsetsByDept) {
    metricRows.push({
      metric_key: `agency_offsets_${slug(dept)}_${PERIOD_KEY}`,
      value: v, as_of_date: AS_OF,
      label: `Offsetting receipts/collections inside ${dept} (${HUMAN}, agency lens) — line items, not tree bars`,
    });
  }
  for (const e of excluded) {
    metricRows.push({
      metric_key: `agency_excluded_${e.kind}_${slug(e.name)}_${PERIOD_KEY}`,
      value: e.value, as_of_date: AS_OF,
      label: `Excluded from ${HUMAN} agency visual (net ≤ 0 ${e.kind}): ${e.name}`,
    });
  }
  if (visualVsOfficial != null) {
    metricRows.push({
      metric_key: `visual_vs_official_agency_${PERIOD_KEY}`,
      value: visualVsOfficial, as_of_date: AS_OF,
      label: `${HUMAN} agency-lens net minus OMB published outlays ($${(anchor / 1e9).toFixed(1)}B) — did not reconcile within ${RECON_TOLERANCE * 100}%; loaded anyway per HIST-04`,
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
  console.log(`  Disclosure metrics: ${metricRows.length} (tier=${tier})`);
  console.log('Done.');
}

async function main() {
  if (SOURCE === 'omb') return loadFromOMB();
  if (SOURCE === 'mts') return loadFromMTS();
  throw new Error(`--source must be 'mts' or 'omb' (got '${SOURCE}')`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
