#!/usr/bin/env node
/**
 * verify-phase106-cohort-audit.mjs
 *
 * 50-node state source-chain audit for Phase 106 (VER-03b+c).
 *
 * Adapted from verify-phase102-cohort-audit.mjs for the v2.12-augmented cohort:
 *   - Updated WINDOW_BOUNDS: CA FY2008-2025, NY FY2003-2024, FL FY2021-2024 (deepened in Phase 104)
 *   - Added PA FY2016-2025 and IL FY2021-2025 (new ACFR nodes from Phase 105)
 *   - Extended INV-6 ACFR-GAAP set to include PA + IL alongside CA/TX/NY/FL/MN/OH/VA (now 9 states)
 *
 * Asserts 7 invariants across ALL entity_type='state' nodes:
 *   INV-1  NULL-basis        — every displayed state-node budgets row has non-null data_source
 *                              AND source_url AND source_date (policy P4 text-stamp)
 *   INV-2  residue/fragile  — 0 state-related *-gf-* data_sources rows in data_sources table
 *                              with 0 referencing live budgets rows (stale artifacts)
 *   INV-3  out-of-window    — 0 state-node FYs outside the per-state loaded window bounds
 *   INV-4  dup              — 0 (municipality_id, fiscal_year, dataset_type) combos appearing
 *                              more than once
 *   INV-5  orphan           — 0 budgets rows whose non-null data_source_id points to a missing
 *                              data_sources row
 *   INV-6  ACFR-GAAP-on-9  — CA/TX/NY/FL/MN/OH/VA/PA/IL operating+revenue rows carry the
 *                              ACFR-GAAP provenance label (contains 'ACFR' in data_source column)
 *   INV-7  NASBO-untouched  — the 41 non-ACFR states (excluding the 9 ACFR states above)
 *                              carry NASBO-budgetary provenance (contains 'NASBO' in data_source)
 *                              and no unexpected dataset_types beyond 'operating'
 *
 * Read-only. Makes NO writes. Exit 0 = all PASS, exit 2 = one or more FAIL.
 * $0/no-AI.
 *
 * Usage: node scripts/verify-phase106-cohort-audit.mjs
 *
 * Window bounds (v2.12 loaded windows):
 *   CA  FY2008–FY2025  (ACFR GAAP; deepened in Phase 104 from FY2020-2025)
 *   TX  FY2015–FY2024  (ACFR GAAP; unchanged)
 *   NY  FY2003–FY2024  (ACFR GAAP; deepened in Phase 104 from FY2015-2024)
 *   FL  FY2021–FY2024  (ACFR GAAP; deepened in Phase 104 from FY2022-2024)
 *   MN  FY2008–FY2025  (ACFR GAAP, v2.9; unchanged)
 *   OH  FY2020–FY2025  (ACFR GAAP, v2.8; unchanged)
 *   VA  FY2022–FY2025  (ACFR GAAP, v2.7; unchanged)
 *   PA  FY2016–FY2025  (ACFR GAAP; NEW in Phase 105)
 *   IL  FY2021–FY2025  (ACFR GAAP; NEW in Phase 105)
 *   All other 41 NASBO states: FY2023–FY2024
 *
 * ACFR states (9 total — INV-6 checks ACFR-GAAP label on operating+revenue rows):
 *   CA, TX, NY, FL (v2.11 upgrade), MN (v2.9), OH (v2.8), VA (v2.7),
 *   PA (Phase 105 / v2.12), IL (Phase 105 / v2.12)
 *
 * Expected row counts (from load logs):
 *   CA: 36 rows (18 op + 18 rev, FY2008-2025)
 *   NY: 44 rows (22 op + 22 rev, FY2003-2024)
 *   FL:  8 rows ( 4 op +  4 rev, FY2021-2024)
 *   TX: 20 rows (10 op + 10 rev, FY2015-2024)
 *   MN: 36 rows (18 op + 18 rev, FY2008-2025)
 *   OH: 12 rows ( 6 op +  6 rev, FY2020-2025)
 *   VA:  8 rows ( 4 op +  4 rev, FY2022-2025)
 *   PA: 20 rows (10 op + 10 rev, FY2016-2025) [NEW]
 *   IL: 10 rows ( 5 op +  5 rev, FY2021-2025) [NEW]
 *   GA (NASBO control): 2 rows (operating-only, FY2023-2024)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    } catch {}
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('FATAL: Missing SUPABASE_SERVICE_KEY — cannot run audit.');
  process.exit(2);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Per-state window bounds (v2.12-augmented) ─────────────────────────────────
// All 9 ACFR states: have real ACFR GAAP data with both operating + revenue datasets
const ACFR_STATES = new Set(['CA', 'TX', 'NY', 'FL', 'MN', 'OH', 'VA', 'PA', 'IL']);
// INV-6 checks: all 9 ACFR nodes must carry ACFR-GAAP label on operating+revenue rows
const ACFR_LABEL_STATES = new Set(['CA', 'TX', 'NY', 'FL', 'MN', 'OH', 'VA', 'PA', 'IL']);

// Updated for v2.12:
//   CA FY2008-2025 (deepened from 2020-2025 in Phase 104)
//   NY FY2003-2024 (deepened from 2015-2024 in Phase 104)
//   FL FY2021-2024 (deepened from 2022-2024 in Phase 104)
//   PA FY2016-2025 (NEW Phase 105)
//   IL FY2021-2025 (NEW Phase 105)
const WINDOW_BOUNDS = {
  CA: { min: 2008, max: 2025 },
  TX: { min: 2015, max: 2024 },
  NY: { min: 2003, max: 2024 },
  FL: { min: 2021, max: 2024 },
  MN: { min: 2008, max: 2025 },
  OH: { min: 2020, max: 2025 },
  VA: { min: 2022, max: 2025 },
  PA: { min: 2016, max: 2025 },  // NEW Phase 105
  IL: { min: 2021, max: 2025 },  // NEW Phase 105
  // All NASBO states: FY2023-2024
  _NASBO: { min: 2023, max: 2024 },
};

function getWindow(stateCode) {
  return WINDOW_BOUNDS[stateCode] ?? WINDOW_BOUNDS._NASBO;
}

// ── Result tracking ───────────────────────────────────────────────────────────
const results = [];

function pass(invId, description, detail) {
  console.log(`  [PASS] ${invId}: ${description}`);
  if (detail) console.log(`         ${detail}`);
  results.push({ invId, status: 'PASS', description });
}

function fail(invId, description, detail) {
  console.log(`  [FAIL] ${invId}: ${description}`);
  if (detail) console.log(`         Detail: ${detail}`);
  results.push({ invId, status: 'FAIL', description, detail });
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('Phase 106 — 50-node state cohort source-chain audit (VER-03b+c)');
console.log('v2.12-augmented: CA FY2008-2025, NY FY2003-2024, FL FY2021-2024, PA FY2016-2025 (NEW), IL FY2021-2025 (NEW)');
console.log('Checks: INV-1 NULL-basis, INV-2 residue, INV-3 out-of-window,');
console.log('        INV-4 dup, INV-5 orphan, INV-6 ACFR-GAAP-on-9, INV-7 NASBO-untouched');
console.log('');

// ── Load all state municipality nodes ─────────────────────────────────────────
const { data: stateNodes, error: stateErr } = await sb.schema('treasury')
  .from('municipalities')
  .select('id,name,state,entity_type')
  .eq('entity_type', 'state')
  .order('state');

if (stateErr) {
  console.error('FATAL: Could not load state nodes:', stateErr.message);
  process.exit(2);
}

console.log(`Loaded ${stateNodes.length} state nodes from treasury.municipalities`);
if (stateNodes.length !== 50) {
  console.warn(`  WARNING: Expected 50 state nodes, found ${stateNodes.length}`);
}

const stateIds = stateNodes.map(m => m.id);
const stateById = Object.fromEntries(stateNodes.map(m => [m.id, m]));

// ── Load all budget rows for state nodes ──────────────────────────────────────
const { data: allBudgets, error: budgetErr } = await sb.schema('treasury')
  .from('budgets')
  .select('id,municipality_id,fiscal_year,dataset_type,total_budget,data_source,source_url,source_date,data_source_id')
  .in('municipality_id', stateIds)
  .order('municipality_id').order('fiscal_year').order('dataset_type');

if (budgetErr) {
  console.error('FATAL: Could not load budgets:', budgetErr.message);
  process.exit(2);
}

console.log(`Loaded ${allBudgets.length} state budget rows from treasury.budgets`);

// ── Print per-state row counts for key states ─────────────────────────────────
console.log('');
console.log('── Per-state row counts (key v2.12 states) ────────────────────────────────');
{
  const KEY_STATES = ['CA', 'NY', 'FL', 'TX', 'MN', 'OH', 'VA', 'PA', 'IL', 'GA'];
  const stateCountMap = {};
  for (const r of allBudgets) {
    const m = stateById[r.municipality_id];
    if (!m) continue;
    if (!stateCountMap[m.state]) stateCountMap[m.state] = { op: 0, rev: 0, fys: new Set() };
    if (r.dataset_type === 'operating') stateCountMap[m.state].op++;
    else if (r.dataset_type === 'revenue') stateCountMap[m.state].rev++;
    stateCountMap[m.state].fys.add(r.fiscal_year);
  }
  for (const s of KEY_STATES) {
    const c = stateCountMap[s];
    if (c) {
      const fys = [...c.fys].sort((a, b) => a - b);
      const fyRange = fys.length > 0 ? `FY${fys[0]}-FY${fys[fys.length-1]}` : 'none';
      console.log(`    ${s}: ${c.op + c.rev} rows (${c.op} op + ${c.rev} rev), ${fyRange}`);
    } else {
      console.log(`    ${s}: 0 rows`);
    }
  }
}
console.log('');

// ── INV-1: NULL-basis ─────────────────────────────────────────────────────────
// Every displayed state-node row must have non-null data_source AND source_url AND source_date
console.log('── INV-1: NULL-basis ───────────────────────────────────────────────────────');
{
  const nullRows = allBudgets.filter(r =>
    !r.data_source || !r.source_url || !r.source_date
  );
  if (nullRows.length === 0) {
    pass('INV-1', `NULL-basis: 0 rows with missing basis label across ${allBudgets.length} state budget rows`);
  } else {
    const detail = nullRows.slice(0, 10).map(r => {
      const m = stateById[r.municipality_id];
      const missing = [];
      if (!r.data_source) missing.push('data_source');
      if (!r.source_url) missing.push('source_url');
      if (!r.source_date) missing.push('source_date');
      return `${m?.state || r.municipality_id} FY${r.fiscal_year} ${r.dataset_type} missing=[${missing.join(',')}]`;
    }).join(' | ') + (nullRows.length > 10 ? ` ... (+${nullRows.length - 10} more)` : '');
    fail('INV-1', `NULL-basis: ${nullRows.length} row(s) missing data_source/source_url/source_date`, detail);
  }
}

// ── INV-2: residue/fragile ────────────────────────────────────────────────────
// State-related *-gf-* data_sources should have 0 entries with 0 referencing live
// budgets rows after the cohort cleanup (D-05 nasbo metadata deleted in Phase 102).
//
// Scope:
//   - Excluded: city-level entries (anaheim-, fresno-, etc.) — not state data
//   - Included: all state *-gf-* family (no nasbo exclusion — those were deleted in Phase 102)
console.log('── INV-2: residue/fragile ──────────────────────────────────────────────────');
{
  const CITY_PREFIXES = ['anaheim-', 'fresno-', 'longbeach-', 'riverside-', 'sanjose-', 'santa-ana-'];

  const { data: gfSources, error: gfErr } = await sb.schema('treasury')
    .from('data_sources')
    .select('id,name,dataset_id,api_type')
    .like('dataset_id', '%-gf-%')
    .order('dataset_id');

  if (gfErr) {
    fail('INV-2', 'residue/fragile: Could not load data_sources', gfErr.message);
  } else {
    // Filter: state-related only (no nasbo exclusion — nasbo metadata deleted in Phase 102 per D-05)
    const staleTargets = gfSources.filter(ds =>
      !CITY_PREFIXES.some(prefix => ds.dataset_id.startsWith(prefix))
    );

    // For each state source, check 0 referencing rows = stale residue
    const residue = [];
    for (const ds of staleTargets) {
      const { count, error: cErr } = await sb.schema('treasury')
        .from('budgets')
        .select('id', { count: 'exact', head: true })
        .eq('data_source_id', ds.id);
      if (cErr) {
        console.warn(`    WARNING: count error for ${ds.dataset_id}: ${cErr.message}`);
        continue;
      }
      const n = count ?? 0;
      if (n === 0) {
        residue.push(ds.dataset_id);
      }
    }

    if (residue.length === 0) {
      pass('INV-2', `residue/fragile: 0 state *-gf-* data_sources with 0 referencing live rows`,
        `(full state *-gf-* family checked — nasbo metadata deleted per Phase 102 D-05, no exclusions)`);
    } else {
      fail('INV-2',
        `residue/fragile: ${residue.length} state *-gf-* data_sources backing 0 live rows (stale residue)`,
        `First 10: ${residue.slice(0, 10).join(', ')}${residue.length > 10 ? ` ... (+${residue.length - 10} more)` : ''}`
      );
    }
  }
}

// ── INV-3: out-of-window ──────────────────────────────────────────────────────
// 0 state-node FYs outside their per-state loaded window bounds (v2.12 bounds)
console.log('── INV-3: out-of-window ────────────────────────────────────────────────────');
{
  const outOfWindow = allBudgets.filter(r => {
    const m = stateById[r.municipality_id];
    if (!m) return false;
    const win = getWindow(m.state);
    return r.fiscal_year < win.min || r.fiscal_year > win.max;
  });

  if (outOfWindow.length === 0) {
    pass('INV-3', `out-of-window: 0 state-node FYs outside their per-state loaded window bounds`,
      `Bounds: CA 2008-2025, NY 2003-2024, FL 2021-2024, PA 2016-2025 (new), IL 2021-2025 (new), NASBO 2023-2024`);
  } else {
    const detail = outOfWindow.slice(0, 10).map(r => {
      const m = stateById[r.municipality_id];
      const win = getWindow(m?.state);
      return `${m?.state} FY${r.fiscal_year} ${r.dataset_type} (window: ${win.min}–${win.max})`;
    }).join(' | ') + (outOfWindow.length > 10 ? ` ... (+${outOfWindow.length - 10} more)` : '');
    fail('INV-3', `out-of-window: ${outOfWindow.length} row(s) outside their per-state window`, detail);
  }
}

// ── INV-4: dup ────────────────────────────────────────────────────────────────
console.log('── INV-4: dup ──────────────────────────────────────────────────────────────');
{
  // Build (muni_id, fiscal_year, dataset_type) key counts
  const keyCounts = new Map();
  for (const r of allBudgets) {
    const key = `${r.municipality_id}::${r.fiscal_year}::${r.dataset_type}`;
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }
  const dups = [...keyCounts.entries()].filter(([, count]) => count > 1);

  if (dups.length === 0) {
    pass('INV-4', `dup: 0 duplicate (municipality_id, fiscal_year, dataset_type) combos`);
  } else {
    const detail = dups.slice(0, 5).map(([key, count]) => {
      const [muniId, fy, dt] = key.split('::');
      const m = stateById[muniId];
      return `${m?.state || muniId} FY${fy} ${dt} × ${count}`;
    }).join(' | ') + (dups.length > 5 ? ` ... (+${dups.length - 5} more)` : '');
    fail('INV-4', `dup: ${dups.length} duplicate (muni, fy, dataset_type) combo(s)`, detail);
  }
}

// ── INV-5: orphan ─────────────────────────────────────────────────────────────
// Budgets rows whose non-null data_source_id points to a missing data_sources row
console.log('── INV-5: orphan ───────────────────────────────────────────────────────────');
{
  const rowsWithDSID = allBudgets.filter(r => r.data_source_id != null);
  if (rowsWithDSID.length === 0) {
    pass('INV-5', `orphan: 0 state budget rows have non-null data_source_id (all use text-stamp per P4; no FK orphan possible)`);
  } else {
    // Check each non-null data_source_id against data_sources table
    const dsIds = [...new Set(rowsWithDSID.map(r => r.data_source_id))];
    const { data: existingDs, error: dsErr } = await sb.schema('treasury')
      .from('data_sources')
      .select('id')
      .in('id', dsIds);

    if (dsErr) {
      fail('INV-5', 'orphan: Could not verify data_sources existence', dsErr.message);
    } else {
      const existingIds = new Set(existingDs.map(d => d.id));
      const orphans = rowsWithDSID.filter(r => !existingIds.has(r.data_source_id));
      if (orphans.length === 0) {
        pass('INV-5', `orphan: 0 orphan budgets rows (${rowsWithDSID.length} rows with data_source_id all resolve)`);
      } else {
        const detail = orphans.slice(0, 5).map(r => {
          const m = stateById[r.municipality_id];
          return `${m?.state} FY${r.fiscal_year} ${r.dataset_type} dsid=${r.data_source_id}`;
        }).join(' | ');
        fail('INV-5', `orphan: ${orphans.length} budgets row(s) reference missing data_sources rows`, detail);
      }
    }
  }
}

// ── INV-6: ACFR-GAAP-on-9 ────────────────────────────────────────────────────
// All 9 ACFR states (CA/TX/NY/FL/MN/OH/VA/PA/IL) operating+revenue rows must carry
// ACFR-GAAP provenance. PA + IL are new to this invariant in Phase 106 (v2.12).
console.log('── INV-6: ACFR-GAAP-on-9 ──────────────────────────────────────────────────');
{
  const acfrNodes = stateNodes.filter(m => ACFR_LABEL_STATES.has(m.state));
  const acfrIds = new Set(acfrNodes.map(m => m.id));
  const acfrBudgets = allBudgets.filter(r =>
    acfrIds.has(r.municipality_id) &&
    (r.dataset_type === 'operating' || r.dataset_type === 'revenue')
  );

  const nonAcfrLabelled = acfrBudgets.filter(r =>
    !r.data_source || !r.data_source.toUpperCase().includes('ACFR')
  );

  // Per-state breakdown for verification report
  const stateBreakdown = {};
  for (const r of acfrBudgets) {
    const m = stateById[r.municipality_id];
    if (!m) continue;
    if (!stateBreakdown[m.state]) stateBreakdown[m.state] = { op: 0, rev: 0, nonAcfr: 0 };
    if (r.dataset_type === 'operating') stateBreakdown[m.state].op++;
    else if (r.dataset_type === 'revenue') stateBreakdown[m.state].rev++;
    if (!r.data_source || !r.data_source.toUpperCase().includes('ACFR')) {
      stateBreakdown[m.state].nonAcfr++;
    }
  }

  console.log('    ACFR state row counts:');
  for (const s of [...ACFR_LABEL_STATES].sort()) {
    const c = stateBreakdown[s] || { op: 0, rev: 0, nonAcfr: 0 };
    const marker = ['PA', 'IL'].includes(s) ? ' [NEW]' : '';
    console.log(`      ${s}${marker}: ${c.op + c.rev} rows (${c.op} op + ${c.rev} rev)${c.nonAcfr > 0 ? ` *** ${c.nonAcfr} non-ACFR labelled ***` : ''}`);
  }

  if (nonAcfrLabelled.length === 0) {
    pass('INV-6',
      `ACFR-GAAP-on-9: All ${acfrBudgets.length} CA/TX/NY/FL/MN/OH/VA/PA/IL operating+revenue rows carry ACFR provenance label`,
      `States checked: ${[...ACFR_LABEL_STATES].sort().join(', ')}`
    );
  } else {
    const detail = nonAcfrLabelled.slice(0, 10).map(r => {
      const m = stateById[r.municipality_id];
      return `${m?.state} FY${r.fiscal_year} ${r.dataset_type}: "${(r.data_source || 'null').slice(0, 50)}"`;
    }).join(' | ');
    fail('INV-6',
      `ACFR-GAAP-on-9: ${nonAcfrLabelled.length} ACFR state row(s) missing ACFR provenance in data_source`,
      detail
    );
  }
}

// ── INV-7: NASBO-untouched-on-41 ─────────────────────────────────────────────
// The 41 non-ACFR states (all except the 9 ACFR states) must carry NASBO provenance
// and have only 'operating' dataset (no unexpected 'revenue' rows).
// Note: Phase 102 had 46 NASBO states (7 ACFR); Phase 106 has 41 NASBO states (9 ACFR).
// GA is the canonical control — checked dynamically.
console.log('── INV-7: NASBO-untouched-on-41 ────────────────────────────────────────────');
{
  const nasboPureStates = stateNodes.filter(m => !ACFR_STATES.has(m.state));
  const nasboIds = new Set(nasboPureStates.map(m => m.id));
  const nasboBudgets = allBudgets.filter(r => nasboIds.has(r.municipality_id));

  const issues = [];

  // Check 1: all rows must carry NASBO provenance
  const nonNasboBudgets = nasboBudgets.filter(r =>
    !r.data_source || !r.data_source.toUpperCase().includes('NASBO')
  );
  if (nonNasboBudgets.length > 0) {
    const ex = nonNasboBudgets.slice(0, 5).map(r => {
      const m = stateById[r.municipality_id];
      return `${m?.state} FY${r.fiscal_year} ${r.dataset_type}: "${(r.data_source || 'null').slice(0, 40)}"`;
    }).join(' | ');
    issues.push(`${nonNasboBudgets.length} row(s) missing NASBO label: ${ex}`);
  }

  // Check 2: no unexpected dataset_types (NASBO only provides operating)
  const unexpectedDatasets = nasboBudgets.filter(r => r.dataset_type !== 'operating');
  if (unexpectedDatasets.length > 0) {
    const ex = unexpectedDatasets.slice(0, 5).map(r => {
      const m = stateById[r.municipality_id];
      return `${m?.state} FY${r.fiscal_year} ${r.dataset_type}`;
    }).join(' | ');
    issues.push(`${unexpectedDatasets.length} unexpected non-operating row(s) on NASBO states: ${ex}`);
  }

  // Report per-state row counts for pure-NASBO states
  const nasboStateCounts = {};
  for (const r of nasboBudgets) {
    const m = stateById[r.municipality_id];
    if (m) nasboStateCounts[m.state] = (nasboStateCounts[m.state] || 0) + 1;
  }
  const statesWithRows = Object.keys(nasboStateCounts).sort();
  const statesWithZeroRows = nasboPureStates.map(m => m.state).filter(s => !nasboStateCounts[s]).sort();

  // GA control check (canonical NASBO control state)
  const gaNode = stateNodes.find(m => m.state === 'GA');
  if (gaNode) {
    const gaRows = nasboBudgets.filter(r => r.municipality_id === gaNode.id);
    const gaLabel = gaRows[0]?.data_source?.slice(0, 60) || 'N/A';
    console.log(`    GA control: ${gaRows.length} rows, label="${gaLabel}"`);
  }

  console.log(`    Pure-NASBO states (${nasboPureStates.length}): ${nasboPureStates.map(m => m.state).sort().join(', ')}`);
  console.log(`    States with rows: ${statesWithRows.length}, States with 0 rows: ${statesWithZeroRows.length}`);
  if (statesWithZeroRows.length > 0) {
    console.log(`    Zero-row states: ${statesWithZeroRows.join(', ')}`);
  }
  console.log(`    Note: NASBO pure-state count is 41 (was 46 in Phase 102) — PA + IL moved to ACFR set in v2.12 (Phase 105)`);

  if (issues.length === 0) {
    pass('INV-7',
      `NASBO-untouched-on-41: All ${nasboBudgets.length} rows across ${nasboPureStates.length} NASBO states carry NASBO provenance and only 'operating' dataset`,
      `States with rows: ${statesWithRows.length}/${nasboPureStates.length} NASBO states`
    );
  } else {
    fail('INV-7', `NASBO-untouched-on-41: ${issues.length} issue(s) found`, issues.join(' || '));
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log('── Summary ─────────────────────────────────────────────────────────────────');
console.log('');
console.log('  Invariant          Result');
console.log('  ─────────────────────────────────────────────────────');
for (const r of results) {
  const status = r.status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`  ${r.invId.padEnd(18)} ${status}  ${r.description.slice(0, 60)}`);
}
console.log('');

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;

console.log(`  ${passCount} PASS, ${failCount} FAIL (of ${results.length} invariants)`);
console.log('');

if (failCount === 0) {
  console.log('PASS — All 7 Phase 106 cohort source-chain audit invariants satisfied (v2.12 cohort)');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 106 cohort audit invariants failed');
  process.exit(2);
}
