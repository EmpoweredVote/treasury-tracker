#!/usr/bin/env node
/**
 * verify-phase110-cohort-audit.mjs
 *
 * 50-node state source-chain audit for Phase 110 (VER-05 b+c).
 *
 * Adapted from verify-phase106-cohort-audit.mjs for the v2.13 tranche-2 cohort:
 *   - ADDED 10 tranche-2 windows: NJ 2020-2025, MA 2003-2025 (holes 2001/02/04/05/14/21
 *     outside/inside handled by INV-8), NC 2012-2025, GA 2021-2025, MD 2022-2025,
 *     TN 2009-2025, CT 2002-2025 (hole 2006), WI 2002-2025, WA 2020-2025, MI 2019-2025.
 *     (MA/NC bounds reflect the post-plan colon-fix recoveries recorded in the
 *      108-02/108-03 LOADLOG UPDATE sections: MA oldest FY2003, NC full FY2012-2025.)
 *   - INV-6 ACFR-GAAP set now 19 states (9 pre-tranche + 10 new).
 *   - INV-7 NASBO set now 31 states; GA is no longer the control (it is ACFR now) —
 *     CO reported as the dynamic control.
 *   - INV-8 (NEW) window-integrity: each tranche-2 state's EXACT loaded-FY set matches
 *     the loadlog record (holes are absent BY DESIGN, extra/missing FYs FAIL), and the
 *     operating and revenue FY sets are identical per state.
 *   - INV-9 (NEW) MI Sep-30 semantics: every MI row has source_date = {FY}-09-30 and
 *     fiscal_year_start_month = 10 (Phase 109 D-03).
 *   - INV-10 (NEW) GA F-97-01 supersede: GA FY2023 operating = $59,893,783,000 (ACFR)
 *     at the original key; 0 NASBO-labelled rows on the GA node.
 *
 * Read-only. Makes NO writes. Exit 0 = all PASS, exit 2 = one or more FAIL. $0/no-AI.
 *
 * Usage: node scripts/verify-phase110-cohort-audit.mjs
 *
 * Expected tranche-2 row counts (from LOADLOGs incl. UPDATE sections):
 *   NJ 12 (6+6) · MA 38 (19+19) · NC 28 (14+14) · GA 10 (5+5) · MD 8 (4+4)
 *   TN 34 (17+17) · CT 46 (23+23) · WI 48 (24+24) · WA 12 (6+6) · MI 14 (7+7)
 *   = 250 tranche-2 rows (125 op + 125 rev).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('FATAL: Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── ACFR cohort (19 states) ───────────────────────────────────────────────────
const ACFR_STATES = new Set([
  'CA', 'TX', 'NY', 'FL', 'MN', 'OH', 'VA', 'PA', 'IL',          // pre-tranche (9)
  'NJ', 'MA', 'NC', 'GA', 'MD', 'TN', 'CT', 'WI', 'WA', 'MI',    // tranche-2 (10)
]);

const WINDOW_BOUNDS = {
  CA: { min: 2008, max: 2025 }, TX: { min: 2015, max: 2024 }, NY: { min: 2003, max: 2024 },
  FL: { min: 2021, max: 2024 }, MN: { min: 2008, max: 2025 }, OH: { min: 2020, max: 2025 },
  VA: { min: 2022, max: 2025 }, PA: { min: 2016, max: 2025 }, IL: { min: 2021, max: 2025 },
  NJ: { min: 2020, max: 2025 }, MA: { min: 2003, max: 2025 }, NC: { min: 2012, max: 2025 },
  GA: { min: 2021, max: 2025 }, MD: { min: 2022, max: 2025 }, TN: { min: 2009, max: 2025 },
  CT: { min: 2002, max: 2025 }, WI: { min: 2002, max: 2025 }, WA: { min: 2020, max: 2025 },
  MI: { min: 2019, max: 2025 },
  _NASBO: { min: 2023, max: 2024 },
};
const getWindow = (s) => WINDOW_BOUNDS[s] ?? WINDOW_BOUNDS._NASBO;

// INV-8 exact expected FY sets per tranche-2 state (holes encoded — from LOADLOGs).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const EXPECTED_FYS = {
  NJ: range(2020, 2025),
  MA: [2003, ...range(2006, 2013), ...range(2015, 2020), ...range(2022, 2025)], // 19; holes 2001/02/04/05/14/21
  NC: range(2012, 2025),                                                        // 14; colon-fix recovered 2012/13
  GA: range(2021, 2025),
  MD: range(2022, 2025),
  TN: range(2009, 2025),
  CT: [...range(2002, 2005), ...range(2007, 2025)],                             // 23; hole 2006 (scanned PDF)
  WI: range(2002, 2025),                                                        // 24; contiguous
  WA: range(2020, 2025),
  MI: range(2019, 2025),
};

const results = [];
const pass = (id, desc, det) => { console.log(`  [PASS] ${id}: ${desc}`); if (det) console.log(`         ${det}`); results.push({ id, status: 'PASS', desc }); };
const fail = (id, desc, det) => { console.log(`  [FAIL] ${id}: ${desc}`); if (det) console.log(`         Detail: ${det}`); results.push({ id, status: 'FAIL', desc, det }); };

console.log('Phase 110 — 50-node state cohort source-chain audit (VER-05 b+c)');
console.log('v2.13 tranche-2: +NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI — 19 ACFR states, 31 NASBO states');
console.log('');

// ── Load state nodes + budgets ────────────────────────────────────────────────
const { data: stateNodes, error: stateErr } = await sb.schema('treasury')
  .from('municipalities').select('id,name,state,entity_type').eq('entity_type', 'state').order('state');
if (stateErr) { console.error('FATAL:', stateErr.message); process.exit(2); }
console.log(`Loaded ${stateNodes.length} state nodes`);
if (stateNodes.length !== 50) console.warn(`  WARNING: expected 50 state nodes, found ${stateNodes.length}`);

const stateIds = stateNodes.map(m => m.id);
const stateById = Object.fromEntries(stateNodes.map(m => [m.id, m]));

const { data: allBudgets, error: budgetErr } = await sb.schema('treasury')
  .from('budgets')
  .select('id,municipality_id,fiscal_year,dataset_type,total_budget,data_source,source_url,source_date,data_source_id,fiscal_year_start_month')
  .in('municipality_id', stateIds)
  .order('municipality_id').order('fiscal_year').order('dataset_type');
if (budgetErr) { console.error('FATAL:', budgetErr.message); process.exit(2); }
console.log(`Loaded ${allBudgets.length} state budget rows`);

// Per-state counts for the report (tranche-2 states).
console.log('');
console.log('── Tranche-2 per-state row counts ─────────────────────────────────────────');
const TRANCHE2 = ['NJ', 'MA', 'NC', 'GA', 'MD', 'TN', 'CT', 'WI', 'WA', 'MI'];
const counts = {};
for (const r of allBudgets) {
  const m = stateById[r.municipality_id];
  if (!m) continue;
  counts[m.state] ??= { op: 0, rev: 0, fys: new Set() };
  if (r.dataset_type === 'operating') counts[m.state].op++;
  else if (r.dataset_type === 'revenue') counts[m.state].rev++;
  counts[m.state].fys.add(r.fiscal_year);
}
for (const s of TRANCHE2) {
  const c = counts[s] || { op: 0, rev: 0, fys: new Set() };
  const fys = [...c.fys].sort((a, b) => a - b);
  console.log(`    ${s}: ${c.op + c.rev} rows (${c.op} op + ${c.rev} rev), FY${fys[0]}-FY${fys[fys.length - 1]}, ${fys.length} FYs`);
}
console.log('');

// ── INV-1: NULL-basis ─────────────────────────────────────────────────────────
console.log('── INV-1: NULL-basis ───────────────────────────────────────────────────────');
{
  const nullRows = allBudgets.filter(r => !r.data_source || !r.source_url || !r.source_date);
  if (nullRows.length === 0) pass('INV-1', `0 rows missing data_source/source_url/source_date across ${allBudgets.length} state rows`);
  else fail('INV-1', `${nullRows.length} row(s) missing basis fields`,
    nullRows.slice(0, 10).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year} ${r.dataset_type}`).join(' | '));
}

// ── INV-2: residue/fragile ────────────────────────────────────────────────────
console.log('── INV-2: residue/fragile ──────────────────────────────────────────────────');
{
  const CITY_PREFIXES = ['anaheim-', 'fresno-', 'longbeach-', 'riverside-', 'sanjose-', 'santa-ana-'];
  const { data: gfSources, error: gfErr } = await sb.schema('treasury')
    .from('data_sources').select('id,name,dataset_id,api_type').like('dataset_id', '%-gf-%').order('dataset_id');
  if (gfErr) fail('INV-2', 'could not load data_sources', gfErr.message);
  else {
    const targets = gfSources.filter(ds => !CITY_PREFIXES.some(p => ds.dataset_id.startsWith(p)));
    const residue = [];
    for (const ds of targets) {
      const { count, error: cErr } = await sb.schema('treasury')
        .from('budgets').select('id', { count: 'exact', head: true }).eq('data_source_id', ds.id);
      if (cErr) { console.warn(`    WARNING: count error for ${ds.dataset_id}: ${cErr.message}`); continue; }
      if ((count ?? 0) === 0) residue.push(ds.dataset_id);
    }
    if (residue.length === 0) pass('INV-2', `0 state *-gf-* data_sources with 0 referencing live rows (${targets.length} checked)`);
    else fail('INV-2', `${residue.length} stale *-gf-* data_sources back 0 live rows (WR-05-class residue)`,
      residue.slice(0, 10).join(', '));
  }
}

// ── INV-3: out-of-window ──────────────────────────────────────────────────────
console.log('── INV-3: out-of-window ────────────────────────────────────────────────────');
{
  const oow = allBudgets.filter(r => {
    const m = stateById[r.municipality_id];
    if (!m) return false;
    const w = getWindow(m.state);
    return r.fiscal_year < w.min || r.fiscal_year > w.max;
  });
  if (oow.length === 0) pass('INV-3', '0 state-node FYs outside their per-state loaded window bounds (19 ACFR windows + NASBO 2023-2024)');
  else fail('INV-3', `${oow.length} row(s) outside their window`,
    oow.slice(0, 10).map(r => { const m = stateById[r.municipality_id]; const w = getWindow(m?.state); return `${m?.state} FY${r.fiscal_year} ${r.dataset_type} (window ${w.min}-${w.max})`; }).join(' | '));
}

// ── INV-4: dup ────────────────────────────────────────────────────────────────
console.log('── INV-4: dup ──────────────────────────────────────────────────────────────');
{
  const keyCounts = new Map();
  for (const r of allBudgets) {
    const k = `${r.municipality_id}::${r.fiscal_year}::${r.dataset_type}`;
    keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  }
  const dups = [...keyCounts.entries()].filter(([, c]) => c > 1);
  if (dups.length === 0) pass('INV-4', '0 duplicate (municipality_id, fiscal_year, dataset_type) combos');
  else fail('INV-4', `${dups.length} duplicate combo(s)`,
    dups.slice(0, 5).map(([k, c]) => { const [id, fy, dt] = k.split('::'); return `${stateById[id]?.state} FY${fy} ${dt} ×${c}`; }).join(' | '));
}

// ── INV-5: orphan ─────────────────────────────────────────────────────────────
console.log('── INV-5: orphan ───────────────────────────────────────────────────────────');
{
  const withDsid = allBudgets.filter(r => r.data_source_id != null);
  if (withDsid.length === 0) pass('INV-5', '0 rows carry data_source_id (text-stamp only; no FK orphan possible)');
  else {
    const dsIds = [...new Set(withDsid.map(r => r.data_source_id))];
    const { data: existing, error: dsErr } = await sb.schema('treasury').from('data_sources').select('id').in('id', dsIds);
    if (dsErr) fail('INV-5', 'could not verify data_sources', dsErr.message);
    else {
      const ok = new Set(existing.map(d => d.id));
      const orphans = withDsid.filter(r => !ok.has(r.data_source_id));
      if (orphans.length === 0) pass('INV-5', `0 orphans (${withDsid.length} rows with data_source_id all resolve)`);
      else fail('INV-5', `${orphans.length} orphan row(s)`,
        orphans.slice(0, 5).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year} ${r.dataset_type}`).join(' | '));
    }
  }
}

// ── INV-6: ACFR-GAAP-on-19 ────────────────────────────────────────────────────
console.log('── INV-6: ACFR-GAAP-on-19 ──────────────────────────────────────────────────');
{
  const acfrIds = new Set(stateNodes.filter(m => ACFR_STATES.has(m.state)).map(m => m.id));
  const acfrBudgets = allBudgets.filter(r => acfrIds.has(r.municipality_id) && ['operating', 'revenue'].includes(r.dataset_type));
  const bad = acfrBudgets.filter(r => !r.data_source || !r.data_source.toUpperCase().includes('ACFR'));
  const nasboLeak = acfrBudgets.filter(r => r.data_source && r.data_source.toUpperCase().includes('NASBO'));
  console.log('    ACFR state row counts:');
  for (const s of [...ACFR_STATES].sort()) {
    const c = counts[s] || { op: 0, rev: 0 };
    const mark = TRANCHE2.includes(s) ? ' [NEW]' : '';
    console.log(`      ${s}${mark}: ${c.op + c.rev} rows (${c.op} op + ${c.rev} rev)`);
  }
  if (bad.length === 0 && nasboLeak.length === 0) {
    pass('INV-6', `All ${acfrBudgets.length} rows on the 19 ACFR states carry ACFR provenance; 0 NASBO labels remain`);
  } else {
    fail('INV-6', `${bad.length} non-ACFR-labelled + ${nasboLeak.length} NASBO-labelled row(s) on ACFR states`,
      [...bad, ...nasboLeak].slice(0, 10).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year} ${r.dataset_type}: "${(r.data_source || 'null').slice(0, 40)}"`).join(' | '));
  }
}

// ── INV-7: NASBO-untouched-on-31 ─────────────────────────────────────────────
console.log('── INV-7: NASBO-untouched-on-31 ────────────────────────────────────────────');
{
  const nasboStates = stateNodes.filter(m => !ACFR_STATES.has(m.state));
  const nasboIds = new Set(nasboStates.map(m => m.id));
  const nasboBudgets = allBudgets.filter(r => nasboIds.has(r.municipality_id));
  const issues = [];

  const nonNasbo = nasboBudgets.filter(r => !r.data_source || !r.data_source.toUpperCase().includes('NASBO'));
  if (nonNasbo.length > 0) issues.push(`${nonNasbo.length} row(s) missing NASBO label: ` +
    nonNasbo.slice(0, 5).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year}`).join(' | '));

  const unexpected = nasboBudgets.filter(r => r.dataset_type !== 'operating');
  if (unexpected.length > 0) issues.push(`${unexpected.length} non-operating row(s): ` +
    unexpected.slice(0, 5).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year} ${r.dataset_type}`).join(' | '));

  // Every NASBO state must have exactly 2 operating rows (FY2023 + FY2024).
  const perState = {};
  for (const r of nasboBudgets) { const m = stateById[r.municipality_id]; if (m) perState[m.state] = (perState[m.state] || 0) + 1; }
  const wrongCount = nasboStates.map(m => m.state).filter(s => (perState[s] || 0) !== 2);
  if (wrongCount.length > 0) issues.push(`states without exactly 2 NASBO rows: ${wrongCount.map(s => `${s}=${perState[s] || 0}`).join(', ')}`);

  // CO = reported control (GA graduated to ACFR in this tranche).
  const co = stateNodes.find(m => m.state === 'CO');
  if (co) {
    const coRows = nasboBudgets.filter(r => r.municipality_id === co.id);
    console.log(`    CO control: ${coRows.length} rows, label="${coRows[0]?.data_source?.slice(0, 60) || 'N/A'}"`);
  }
  console.log(`    Pure-NASBO states (${nasboStates.length}): ${nasboStates.map(m => m.state).sort().join(', ')}`);
  console.log('    Note: NASBO pure-state count is 31 (was 41 in Phase 106) — 10 tranche-2 states moved to the ACFR set.');

  if (issues.length === 0) pass('INV-7', `All ${nasboBudgets.length} rows on the 31 NASBO states: NASBO provenance, operating-only, exactly 2 rows each`);
  else fail('INV-7', `${issues.length} issue(s)`, issues.join(' || '));
}

// ── INV-8: window-integrity (tranche-2 exact FY sets) ───────────────────────
console.log('── INV-8: window-integrity (tranche-2 exact FY sets, holes encoded) ───────');
{
  const issues = [];
  for (const s of TRANCHE2) {
    const node = stateNodes.find(m => m.state === s);
    if (!node) { issues.push(`${s}: node missing`); continue; }
    const rows = allBudgets.filter(r => r.municipality_id === node.id);
    const opF = rows.filter(r => r.dataset_type === 'operating').map(r => r.fiscal_year).sort((a, b) => a - b);
    const revF = rows.filter(r => r.dataset_type === 'revenue').map(r => r.fiscal_year).sort((a, b) => a - b);
    const expected = EXPECTED_FYS[s];
    const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    if (!eq(opF, expected)) issues.push(`${s} operating FYs != expected (${opF.length} vs ${expected.length}): missing=[${expected.filter(f => !opF.includes(f))}] extra=[${opF.filter(f => !expected.includes(f))}]`);
    if (!eq(revF, expected)) issues.push(`${s} revenue FYs != expected (${revF.length} vs ${expected.length}): missing=[${expected.filter(f => !revF.includes(f))}] extra=[${revF.filter(f => !expected.includes(f))}]`);
  }
  if (issues.length === 0) {
    pass('INV-8', 'All 10 tranche-2 states match their recorded loaded-FY sets exactly (op & rev identical; holes absent by design)',
      'Holes verified absent: MA 2001/02/04/05/14/21 · CT 2006 · window floors per recon');
  } else fail('INV-8', `${issues.length} window-integrity issue(s)`, issues.join(' || '));
}

// ── INV-9: MI Sep-30 semantics ────────────────────────────────────────────────
console.log('── INV-9: MI Sep-30 FY-end semantics ──────────────────────────────────────');
{
  const mi = stateNodes.find(m => m.state === 'MI');
  const miRows = allBudgets.filter(r => r.municipality_id === mi?.id);
  const badDate = miRows.filter(r => !(r.source_date || '').startsWith(`${r.fiscal_year}-09-30`));
  const badMonth = miRows.filter(r => r.fiscal_year_start_month !== 10);
  if (miRows.length === 14 && badDate.length === 0 && badMonth.length === 0) {
    pass('INV-9', `All 14 MI rows: source_date = {FY}-09-30 and fiscal_year_start_month = 10`);
  } else {
    fail('INV-9', `MI Sep-30 check: rows=${miRows.length} (expect 14), badDate=${badDate.length}, badMonth=${badMonth.length}`,
      [...badDate, ...badMonth].slice(0, 5).map(r => `FY${r.fiscal_year} ${r.dataset_type} date=${r.source_date} month=${r.fiscal_year_start_month}`).join(' | '));
  }
}

// ── INV-10: GA F-97-01 supersede ─────────────────────────────────────────────
console.log('── INV-10: GA F-97-01 supersede ────────────────────────────────────────────');
{
  const ga = stateNodes.find(m => m.state === 'GA');
  const gaRows = allBudgets.filter(r => r.municipality_id === ga?.id);
  const fy23op = gaRows.find(r => r.fiscal_year === 2023 && r.dataset_type === 'operating');
  const nasboOnGa = gaRows.filter(r => r.data_source && r.data_source.toUpperCase().includes('NASBO'));
  if (fy23op && Number(fy23op.total_budget) === 59_893_783_000 && nasboOnGa.length === 0) {
    pass('INV-10', 'GA FY2023 operating = $59,893,783,000 (ACFR GAAP) at the original key; 0 NASBO rows on the GA node');
  } else {
    fail('INV-10', `GA supersede check failed`,
      `FY2023 op=${fy23op ? fy23op.total_budget : 'MISSING'} (expect 59893783000), NASBO rows on GA=${nasboOnGa.length}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log('── Summary ─────────────────────────────────────────────────────────────────');
for (const r of results) console.log(`  ${r.id.padEnd(8)} ${r.status}  ${r.desc.slice(0, 80)}`);
const failCount = results.filter(r => r.status === 'FAIL').length;
console.log('');
console.log(`  ${results.length - failCount} PASS, ${failCount} FAIL (of ${results.length} invariants)`);
console.log('');
if (failCount === 0) {
  console.log('PASS — All Phase 110 cohort source-chain audit invariants satisfied (v2.13 cohort)');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 110 cohort audit invariants failed');
  process.exit(2);
}
