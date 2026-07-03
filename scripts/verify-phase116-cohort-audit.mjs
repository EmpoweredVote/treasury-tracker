#!/usr/bin/env node
/**
 * verify-phase116-cohort-audit.mjs
 *
 * 50-node state source-chain audit for Phase 116 (VER-07 parts b+c, VER-08).
 *
 * Adapted from verify-phase110-cohort-audit.mjs for the v2.14 tranche-3 + deepening cohort:
 *   - ADDED 10 tranche-3 windows: IN 2002-2025, AZ 2002-2024, OR 2022-2025, MO 2012-2025,
 *     CO 2023-2025, SC 2002-2025, KY 2002-2025 (hole FY2023 op-only, rev absent), UT 2019-2025,
 *     AL 2002-2025, LA 2002-2025.
 *   - WIDENED 4 deepening windows: NJ 2002-2025 (was 2020-2025), CT 1988-2025 (was 2002-2025,
 *     hole FY2006 now filled via OCR), WI 2000-2025 (was 2002-2025), MA 2001-2025 with holes
 *     FY2002/2004/2005/2021 (was 2003-2025 with 6 holes; FY2001 + FY2014 now recovered).
 *   - INV-6 ACFR-GAAP set now 29 states (19 prior + 10 tranche-3). KY FY2023 operating is a
 *     documented exception (still NASBO-labelled; the honest, disclosed hole for that FY).
 *   - INV-7 NASBO set now 21 states; control picked dynamically from the remaining NASBO pool
 *     (none of the 29 ACFR states).
 *   - INV-8 (NEW) pre-GASB-34 basis-label distinctness: CT FY1988-2001, WI FY2000-2001, and
 *     MA FY2001 rows carry "pre-GASB-34 combined statement basis"; the SAME nodes' modern years
 *     (incl. CT FY2006, which is GASB-34-era despite being OCR-recovered) carry "GAAP basis" —
 *     the two labels are visibly distinct on the same node.
 *   - INV-9 (NEW) AL Sep-30 FY-end semantics: every AL row has source_date = {FY}-09-30 and
 *     fiscal_year_start_month = 10 (same class as MI, Phase 114).
 *   - INV-10 MI Sep-30 semantics (carried forward from Phase 110/109, unchanged).
 *   - INV-11 (NEW, generalizes Phase 110's INV-8) window-integrity: each of the 10 tranche-3 +
 *     4 deepened states' EXACT loaded-FY set (operating and revenue tracked separately, since
 *     KY's op/rev sets diverge at FY2023) matches the recorded LOADLOG disposition — holes are
 *     absent BY DESIGN, any extra/missing FY FAILs.
 *   - INV-12 GA F-97-01 supersede (carried forward from Phase 110, unchanged — confirms the
 *     tranche-3 + deepening loads did not disturb the tranche-2 GA supersede).
 *
 * Read-only. Makes NO writes. Exit 0 = all PASS, exit 2 = one or more FAIL. $0/no-AI.
 *
 * Usage: node scripts/verify-phase116-cohort-audit.mjs
 *
 * Expected row counts (op+rev unless noted):
 *   Tranche-3: IN 24+24, AZ 23+23, OR 4+4, MO 14+14, CO 3+3, SC 24+24, KY 24+23 (op incl.
 *     FY2023 NASBO row; rev FY2023 absent), UT 7+7, AL 24+24, LA 24+24.
 *   Deepening (new totals): NJ 24+24, CT 38+38, WI 26+26, MA 21+21 (holes 2002/04/05/2021).
 *   Cohort: 29 ACFR states + 21 NASBO states (2 op rows each), 0 anomalies.
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

// ── ACFR cohort (29 states) ────────────────────────────────────────────────────
const ACFR_STATES = new Set([
  'CA', 'TX', 'NY', 'FL', 'MN', 'OH', 'VA', 'PA', 'IL',          // v2.11 (9)
  'NJ', 'MA', 'NC', 'GA', 'MD', 'TN', 'CT', 'WI', 'WA', 'MI',    // v2.13 tranche-2 (10)
  'IN', 'AZ', 'OR', 'MO', 'CO', 'SC', 'KY', 'UT', 'AL', 'LA',    // v2.14 tranche-3 (10)
]);
const TRANCHE3 = ['IN', 'AZ', 'OR', 'MO', 'CO', 'SC', 'KY', 'UT', 'AL', 'LA'];
const DEEPENED = ['NJ', 'CT', 'WI', 'MA'];

const WINDOW_BOUNDS = {
  // Unchanged (15)
  CA: { min: 2008, max: 2025 }, TX: { min: 2015, max: 2024 }, NY: { min: 2003, max: 2024 },
  FL: { min: 2021, max: 2024 }, MN: { min: 2008, max: 2025 }, OH: { min: 2020, max: 2025 },
  VA: { min: 2022, max: 2025 }, PA: { min: 2016, max: 2025 }, IL: { min: 2021, max: 2025 },
  NC: { min: 2012, max: 2025 }, GA: { min: 2021, max: 2025 }, MD: { min: 2022, max: 2025 },
  TN: { min: 2009, max: 2025 }, WA: { min: 2020, max: 2025 }, MI: { min: 2019, max: 2025 },
  // Widened deepening (4)
  NJ: { min: 2002, max: 2025 }, CT: { min: 1988, max: 2025 }, WI: { min: 2000, max: 2025 },
  MA: { min: 2001, max: 2025 },
  // New tranche-3 (10)
  IN: { min: 2002, max: 2025 }, AZ: { min: 2002, max: 2024 }, OR: { min: 2022, max: 2025 },
  MO: { min: 2012, max: 2025 }, CO: { min: 2023, max: 2025 }, SC: { min: 2002, max: 2025 },
  KY: { min: 2002, max: 2025 }, UT: { min: 2019, max: 2025 }, AL: { min: 2002, max: 2025 },
  LA: { min: 2002, max: 2025 },
  _NASBO: { min: 2023, max: 2024 },
};
const getWindow = (s) => WINDOW_BOUNDS[s] ?? WINDOW_BOUNDS._NASBO;

// INV-11 exact expected FY sets (operating / revenue tracked separately — KY diverges).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const EXPECTED_FYS_OP = {
  IN: range(2002, 2025), AZ: range(2002, 2024), OR: range(2022, 2025), MO: range(2012, 2025),
  CO: range(2023, 2025), SC: range(2002, 2025), KY: range(2002, 2025), // KY op includes FY2023 (NASBO exception row)
  UT: range(2019, 2025), AL: range(2002, 2025), LA: range(2002, 2025),
  NJ: range(2002, 2025), CT: range(1988, 2025), WI: range(2000, 2025),
  MA: [2001, 2003, ...range(2006, 2020), ...range(2022, 2025)], // 21; holes 2002/04/05/2021
};
const EXPECTED_FYS_REV = {
  ...EXPECTED_FYS_OP,
  KY: range(2002, 2025).filter((f) => f !== 2023), // 23; FY2023 revenue correctly absent
};

const results = [];
const pass = (id, desc, det) => { console.log(`  [PASS] ${id}: ${desc}`); if (det) console.log(`         ${det}`); results.push({ id, status: 'PASS', desc }); };
const fail = (id, desc, det) => { console.log(`  [FAIL] ${id}: ${desc}`); if (det) console.log(`         Detail: ${det}`); results.push({ id, status: 'FAIL', desc, det }); };

console.log('Phase 116 — 50-node state cohort source-chain audit (VER-07 b+c, VER-08)');
console.log('v2.14 tranche-3 + deepening: +IN/AZ/OR/MO/CO/SC/KY/UT/AL/LA — 29 ACFR states, 21 NASBO states');
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

// Per-state counts for the report.
console.log('');
console.log('── Row counts (29 ACFR states) ─────────────────────────────────────────────');
const counts = {};
for (const r of allBudgets) {
  const m = stateById[r.municipality_id];
  if (!m) continue;
  counts[m.state] ??= { op: 0, rev: 0, fys: new Set() };
  if (r.dataset_type === 'operating') counts[m.state].op++;
  else if (r.dataset_type === 'revenue') counts[m.state].rev++;
  counts[m.state].fys.add(r.fiscal_year);
}
for (const s of [...ACFR_STATES].sort()) {
  const c = counts[s] || { op: 0, rev: 0, fys: new Set() };
  const fys = [...c.fys].sort((a, b) => a - b);
  const mark = TRANCHE3.includes(s) ? ' [NEW-T3]' : DEEPENED.includes(s) ? ' [DEEPENED]' : '';
  console.log(`    ${s}${mark}: ${c.op + c.rev} rows (${c.op} op + ${c.rev} rev), FY${fys[0]}-FY${fys[fys.length - 1]}, ${fys.length} FYs`);
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
  if (oow.length === 0) pass('INV-3', '0 state-node FYs outside their per-state loaded window bounds (29 ACFR windows + NASBO 2023-2024)');
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

// ── INV-6: ACFR-GAAP-on-29 ────────────────────────────────────────────────────
console.log('── INV-6: ACFR-GAAP-on-29 ──────────────────────────────────────────────────');
{
  const acfrIds = new Set(stateNodes.filter(m => ACFR_STATES.has(m.state)).map(m => m.id));
  const acfrBudgets = allBudgets.filter(r => acfrIds.has(r.municipality_id) && ['operating', 'revenue'].includes(r.dataset_type));

  // Documented exception: KY FY2023 operating remains NASBO-labelled (broken-font honest hole).
  const isKY2023Op = (r) => stateById[r.municipality_id]?.state === 'KY' && r.fiscal_year === 2023 && r.dataset_type === 'operating';
  const checkable = acfrBudgets.filter(r => !isKY2023Op(r));
  const kyException = acfrBudgets.filter(isKY2023Op);

  // Pre-GASB-34 years honestly carry "State CAFR" (the era-correct term, pre-dating the ACFR
  // rename) rather than "ACFR" — accept either acronym here; INV-8 separately enforces the
  // pre-34-vs-GAAP basis-label distinctness within this same set.
  const bad = checkable.filter(r => !r.data_source || !/\b(ACFR|CAFR)\b/i.test(r.data_source));
  const nasboLeak = checkable.filter(r => r.data_source && r.data_source.toUpperCase().includes('NASBO'));
  const kyExceptionBad = kyException.filter(r => !r.data_source || !r.data_source.toUpperCase().includes('NASBO'));

  console.log('    ACFR state row counts (29):');
  for (const s of [...ACFR_STATES].sort()) {
    const c = counts[s] || { op: 0, rev: 0 };
    console.log(`      ${s}: ${c.op + c.rev} rows (${c.op} op + ${c.rev} rev)`);
  }
  if (bad.length === 0 && nasboLeak.length === 0 && kyExceptionBad.length === 0 && kyException.length === 1) {
    pass('INV-6', `All ${checkable.length} rows on the 29 ACFR states carry ACFR provenance (0 NASBO leaks); the 1 documented exception (KY FY2023 operating) correctly retains its NASBO label`);
  } else {
    fail('INV-6', `${bad.length} non-ACFR-labelled + ${nasboLeak.length} NASBO-labelled row(s) on ACFR states (excl. KY FY2023 exception); KY exception count=${kyException.length} (expect 1), bad-exception=${kyExceptionBad.length}`,
      [...bad, ...nasboLeak, ...kyExceptionBad].slice(0, 10).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year} ${r.dataset_type}: "${(r.data_source || 'null').slice(0, 40)}"`).join(' | '));
  }
}

// ── INV-7: NASBO-untouched-on-21 ─────────────────────────────────────────────
console.log('── INV-7: NASBO-untouched-on-21 ────────────────────────────────────────────');
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

  // Dynamic control: first (alphabetically) remaining NASBO state (none of the 29 ACFR states).
  const control = nasboStates.map(m => m.state).sort()[0];
  const controlNode = stateNodes.find(m => m.state === control);
  if (controlNode) {
    const controlRows = nasboBudgets.filter(r => r.municipality_id === controlNode.id);
    console.log(`    ${control} control: ${controlRows.length} rows, label="${controlRows[0]?.data_source?.slice(0, 60) || 'N/A'}"`);
  }
  console.log(`    Pure-NASBO states (${nasboStates.length}): ${nasboStates.map(m => m.state).sort().join(', ')}`);
  console.log('    Note: NASBO pure-state count is 21 (was 31 in Phase 110) — 10 tranche-3 states moved to the ACFR set.');

  if (issues.length === 0) pass('INV-7', `All ${nasboBudgets.length} rows on the 21 NASBO states: NASBO provenance, operating-only, exactly 2 rows each`);
  else fail('INV-7', `${issues.length} issue(s)`, issues.join(' || '));
}

// ── INV-8: pre-GASB-34 basis-label distinctness ──────────────────────────────
console.log('── INV-8: pre-GASB-34 basis-label distinctness ─────────────────────────────');
{
  const PRE34_YEARS = { CT: [...range(1988, 2001)], WI: [2000, 2001], MA: [2001] };
  const issues = [];
  const spotChecks = [];
  for (const [s, years] of Object.entries(PRE34_YEARS)) {
    const node = stateNodes.find(m => m.state === s);
    if (!node) { issues.push(`${s}: node missing`); continue; }
    const rows = allBudgets.filter(r => r.municipality_id === node.id && ['operating', 'revenue'].includes(r.dataset_type));
    const pre34Rows = rows.filter(r => years.includes(r.fiscal_year));
    const modernRows = rows.filter(r => !years.includes(r.fiscal_year));
    const badPre34 = pre34Rows.filter(r => !r.data_source || !r.data_source.toLowerCase().includes('pre-gasb-34 combined statement basis'));
    const leakedPre34Label = modernRows.filter(r => r.data_source && r.data_source.toLowerCase().includes('pre-gasb-34'));
    const badModern = modernRows.filter(r => !r.data_source || !r.data_source.toLowerCase().includes('gaap basis'));
    if (badPre34.length > 0) issues.push(`${s}: ${badPre34.length} pre-34 row(s) missing the pre-34 label`);
    if (leakedPre34Label.length > 0) issues.push(`${s}: ${leakedPre34Label.length} modern row(s) incorrectly carry the pre-34 label`);
    if (badModern.length > 0) issues.push(`${s}: ${badModern.length} modern row(s) missing "GAAP basis"`);
    if (pre34Rows.length !== years.length * 2) issues.push(`${s}: expected ${years.length * 2} pre-34 rows (op+rev), found ${pre34Rows.length}`);
    spotChecks.push(`${s} FY${years[0]}=pre-34, FY${modernRows[0]?.fiscal_year ?? '?'}=GAAP`);
  }
  // CT FY2006 special case: GASB-34-era despite OCR recovery — must be GAAP, not pre-34.
  const ct = stateNodes.find(m => m.state === 'CT');
  const ct2006 = allBudgets.filter(r => ct && r.municipality_id === ct.id && r.fiscal_year === 2006);
  const ct2006Bad = ct2006.filter(r => !r.data_source || r.data_source.toLowerCase().includes('pre-gasb-34') || !r.data_source.toLowerCase().includes('gaap basis'));
  if (ct2006.length !== 2) issues.push(`CT FY2006: expected 2 rows (op+rev), found ${ct2006.length}`);
  if (ct2006Bad.length > 0) issues.push(`CT FY2006: ${ct2006Bad.length} row(s) not correctly labelled GAAP (OCR-recovered but GASB-34-era)`);

  if (issues.length === 0) {
    pass('INV-8', 'CT FY1988-2001, WI FY2000-2001, MA FY2001 all carry the distinct pre-GASB-34 label; their modern years (incl. CT FY2006, OCR-recovered) carry GAAP basis',
      spotChecks.join(' | '));
  } else fail('INV-8', `${issues.length} pre-34 label issue(s)`, issues.join(' || '));
}

// ── INV-9: AL Sep-30 FY-end semantics ────────────────────────────────────────
console.log('── INV-9: AL Sep-30 FY-end semantics ────────────────────────────────────────');
{
  const al = stateNodes.find(m => m.state === 'AL');
  const alRows = allBudgets.filter(r => r.municipality_id === al?.id);
  const badDate = alRows.filter(r => !(r.source_date || '').startsWith(`${r.fiscal_year}-09-30`));
  const badMonth = alRows.filter(r => r.fiscal_year_start_month !== 10);
  if (alRows.length === 48 && badDate.length === 0 && badMonth.length === 0) {
    pass('INV-9', `All 48 AL rows: source_date = {FY}-09-30 and fiscal_year_start_month = 10`);
  } else {
    fail('INV-9', `AL Sep-30 check: rows=${alRows.length} (expect 48), badDate=${badDate.length}, badMonth=${badMonth.length}`,
      [...badDate, ...badMonth].slice(0, 5).map(r => `FY${r.fiscal_year} ${r.dataset_type} date=${r.source_date} month=${r.fiscal_year_start_month}`).join(' | '));
  }
}

// ── INV-10: MI Sep-30 FY-end semantics (carried, unchanged) ─────────────────
console.log('── INV-10: MI Sep-30 FY-end semantics (carried) ────────────────────────────');
{
  const mi = stateNodes.find(m => m.state === 'MI');
  const miRows = allBudgets.filter(r => r.municipality_id === mi?.id);
  const badDate = miRows.filter(r => !(r.source_date || '').startsWith(`${r.fiscal_year}-09-30`));
  const badMonth = miRows.filter(r => r.fiscal_year_start_month !== 10);
  if (miRows.length === 14 && badDate.length === 0 && badMonth.length === 0) {
    pass('INV-10', `All 14 MI rows: source_date = {FY}-09-30 and fiscal_year_start_month = 10`);
  } else {
    fail('INV-10', `MI Sep-30 check: rows=${miRows.length} (expect 14), badDate=${badDate.length}, badMonth=${badMonth.length}`,
      [...badDate, ...badMonth].slice(0, 5).map(r => `FY${r.fiscal_year} ${r.dataset_type} date=${r.source_date} month=${r.fiscal_year_start_month}`).join(' | '));
  }
}

// ── INV-11: window-integrity (10 tranche-3 + 4 deepened, exact FY sets) ─────
console.log('── INV-11: window-integrity (14 touched states, exact FY sets, holes encoded) ──');
{
  const TOUCHED = [...TRANCHE3, ...DEEPENED];
  const issues = [];
  for (const s of TOUCHED) {
    const node = stateNodes.find(m => m.state === s);
    if (!node) { issues.push(`${s}: node missing`); continue; }
    const rows = allBudgets.filter(r => r.municipality_id === node.id);
    const opF = rows.filter(r => r.dataset_type === 'operating').map(r => r.fiscal_year).sort((a, b) => a - b);
    const revF = rows.filter(r => r.dataset_type === 'revenue').map(r => r.fiscal_year).sort((a, b) => a - b);
    const expectedOp = EXPECTED_FYS_OP[s];
    const expectedRev = EXPECTED_FYS_REV[s];
    const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    if (!eq(opF, expectedOp)) issues.push(`${s} operating FYs != expected (${opF.length} vs ${expectedOp.length}): missing=[${expectedOp.filter(f => !opF.includes(f))}] extra=[${opF.filter(f => !expectedOp.includes(f))}]`);
    if (!eq(revF, expectedRev)) issues.push(`${s} revenue FYs != expected (${revF.length} vs ${expectedRev.length}): missing=[${expectedRev.filter(f => !revF.includes(f))}] extra=[${revF.filter(f => !expectedRev.includes(f))}]`);
  }
  if (issues.length === 0) {
    pass('INV-11', 'All 14 tranche-3 + deepened states match their recorded loaded-FY sets exactly (op & rev tracked separately; holes absent by design)',
      'Holes verified absent: KY 2023 (rev only) · MA 2002/04/05/2021 · window floors per recon');
  } else fail('INV-11', `${issues.length} window-integrity issue(s)`, issues.join(' || '));
}

// ── INV-12: GA F-97-01 supersede (carried, unchanged) ────────────────────────
console.log('── INV-12: GA F-97-01 supersede (carried) ──────────────────────────────────');
{
  const ga = stateNodes.find(m => m.state === 'GA');
  const gaRows = allBudgets.filter(r => r.municipality_id === ga?.id);
  const fy23op = gaRows.find(r => r.fiscal_year === 2023 && r.dataset_type === 'operating');
  const nasboOnGa = gaRows.filter(r => r.data_source && r.data_source.toUpperCase().includes('NASBO'));
  if (fy23op && Number(fy23op.total_budget) === 59_893_783_000 && nasboOnGa.length === 0) {
    pass('INV-12', 'GA FY2023 operating = $59,893,783,000 (ACFR GAAP) at the original key; 0 NASBO rows on the GA node');
  } else {
    fail('INV-12', `GA supersede check failed`,
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
  console.log('PASS — All Phase 116 cohort source-chain audit invariants satisfied (v2.14 cohort)');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 116 cohort audit invariants failed');
  process.exit(2);
}
