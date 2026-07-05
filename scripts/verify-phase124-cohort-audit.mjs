#!/usr/bin/env node
/**
 * verify-phase124-cohort-audit.mjs
 *
 * 50-node state source-chain audit for Phase 124 (VER-09 parts b+c, VER-10).
 *
 * Adapted from verify-phase116-cohort-audit.mjs for the v2.15 final-tail + NASBO-retirement
 * cohort — the whole cohort is now on ACFR:
 *   - ADDED the 21 tail-state WINDOW_BOUNDS (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/
 *     OK/RI/SD/VT/WV/WY); WIDENED CA to 2002-2025 (was 2008-2025) and FL to 2003-2024
 *     (was 2021-2024). REMOVED the `_NASBO` default fallback entirely — every one of the 50
 *     states now has an explicit window; a state resolving to no window is itself a FAIL.
 *   - INV-6 ACFR-GAAP set is now ALL 50 states (was 29). Two documented exceptions remain
 *     NASBO-labelled: KY FY2023 operating (broken-font honest hole) and NV FY2024 operating
 *     (recency-tail honest hole, the Phase 123 fallback).
 *   - REPLACED the old INV-7 ("N NASBO states x 2 rows") with NASBORT-01: the NASBO cohort is
 *     retired — assert EXACTLY 2 NASBO-labelled rows exist in the ENTIRE cohort (NV FY2024 op +
 *     KY FY2023 op), neither has a same-year ACFR operating row, and generally 0 NASBO rows
 *     exist at any (state, fy) key that also carries an ACFR operating row.
 *   - ADDED the 50/50-ACFR invariant: count(distinct state with an ACFR operating row) === 50;
 *     0 states are NASBO-only / ACFR-absent.
 *   - GENERALIZED INV-11 (window-integrity) to the 23 touched states (21 tail + CA + FL),
 *     each state's EXACT loaded-FY set (operating/revenue tracked separately since NV/KY
 *     diverge) matches its recorded LOADLOG disposition; recorded holes are absent BY DESIGN.
 *   - ADDED the ME non-June fiscal_year_start_month check (ME was flagged pre-recon as a
 *     possible non-June FY-end state; 119-03 confirmed standard June-30 on all 26 downloaded
 *     covers — this invariant proves that resolution DB-side: fiscal_year_start_month=1
 *     uniformly, same as every other standard June-30 state, not the Sep-30 special value).
 *   - CARRIED FORWARD unchanged: INV-1..5 (NULL-basis/residue/out-of-window/dup/orphan),
 *     INV-8 (CT/WI/MA pre-GASB-34 basis-label distinctness), INV-9 (AL Sep-30), INV-10
 *     (MI Sep-30), INV-12 (GA F-97-01 supersede).
 *
 * IMPORTANT (discovered building this script): the live cohort now totals 1,560 state budget
 * rows, which EXCEEDS PostgREST's default 1,000-row response cap. The Phase 116 template's
 * plain `.select()` (no explicit `.range()`) would silently truncate the result set and
 * corrupt every downstream invariant for the states sorted after the cutoff. This script
 * paginates the budgets fetch explicitly (1,000-row pages via `.range()`) to guarantee the
 * full 1,560-row cohort is loaded before any invariant runs.
 *
 * Read-only. Makes NO writes. Exit 0 = all PASS, exit 2 = one or more FAIL. $0/no-AI.
 *
 * Usage: node scripts/verify-phase124-cohort-audit.mjs
 *
 * Expected row counts (op+rev unless noted), from the 118-121 + 122 SUMMARYs:
 *   AK 20+20, AR 22+22, DE 21+21, HI 21+21, ID 22+22, IA 23+23, KS 7+7, ME 24+24, MS 22+22,
 *   MT 11+11, NE 6+6, NV 6op(5 ACFR + 1 NASBO FY2024)+5rev, NH 8+8, NM 4+4, ND 5+5,
 *   OK 23+23, RI 20+20, SD 24+24, VT 11+11, WV 6+6, WY 21+21,
 *   CA 24+24 (was 18+18), FL 22+22 (was 4+4).
 *   Cohort: 50 ACFR states (901 pre-tail rows + 659 tail/deepening rows = 1,560 rows total),
 *   exactly 2 NASBO rows in the whole cohort (NV FY2024 op, KY FY2023 op).
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

// ── ACFR cohort (ALL 50 states — the v2.15 final-tail milestone's end state) ────────────────
const PRE_TAIL_29 = [
  'CA', 'TX', 'NY', 'FL', 'MN', 'OH', 'VA', 'PA', 'IL',          // v2.11 (9)
  'NJ', 'MA', 'NC', 'GA', 'MD', 'TN', 'CT', 'WI', 'WA', 'MI',    // v2.13 tranche-2 (10)
  'IN', 'AZ', 'OR', 'MO', 'CO', 'SC', 'KY', 'UT', 'AL', 'LA',    // v2.14 tranche-3 (10)
];
const TAIL_21 = [
  'AK', 'AR', 'DE', 'HI', 'ID',                    // Batch 1
  'IA', 'KS', 'ME', 'MS', 'MT',                    // Batch 2
  'NE', 'NV', 'NH', 'NM', 'ND',                    // Batch 3
  'OK', 'RI', 'SD', 'VT', 'WV', 'WY',              // Batch 4
];
const ACFR_STATES = new Set([...PRE_TAIL_29, ...TAIL_21]); // 50
const DEEPENED_WIDENED = ['CA', 'FL'];   // widened this phase
const DEEPENED_116 = ['NJ', 'CT', 'WI', 'MA']; // carried, unchanged
const TOUCHED_THIS_PHASE = [...TAIL_21, ...DEEPENED_WIDENED]; // 23 — INV-11 scope

const WINDOW_BOUNDS = {
  // Pre-tail 29 (unchanged from 116 except CA/FL widened below)
  TX: { min: 2015, max: 2024 }, NY: { min: 2003, max: 2024 },
  MN: { min: 2008, max: 2025 }, OH: { min: 2020, max: 2025 },
  VA: { min: 2022, max: 2025 }, PA: { min: 2016, max: 2025 }, IL: { min: 2021, max: 2025 },
  NC: { min: 2012, max: 2025 }, GA: { min: 2021, max: 2025 }, MD: { min: 2022, max: 2025 },
  TN: { min: 2009, max: 2025 }, WA: { min: 2020, max: 2025 }, MI: { min: 2019, max: 2025 },
  NJ: { min: 2002, max: 2025 }, CT: { min: 1988, max: 2025 }, WI: { min: 2000, max: 2025 },
  MA: { min: 2001, max: 2025 },
  IN: { min: 2002, max: 2025 }, AZ: { min: 2002, max: 2024 }, OR: { min: 2022, max: 2025 },
  MO: { min: 2012, max: 2025 }, CO: { min: 2023, max: 2025 }, SC: { min: 2002, max: 2025 },
  KY: { min: 2002, max: 2025 }, UT: { min: 2019, max: 2025 }, AL: { min: 2002, max: 2025 },
  LA: { min: 2002, max: 2025 },
  // Widened deepening (this phase)
  CA: { min: 2002, max: 2025 }, // was 2008-2025
  FL: { min: 2003, max: 2024 }, // was 2021-2024
  // New tail-21 (this phase)
  AK: { min: 2006, max: 2025 }, AR: { min: 2003, max: 2024 }, DE: { min: 2004, max: 2025 },
  HI: { min: 2005, max: 2025 }, ID: { min: 2004, max: 2025 },
  IA: { min: 2002, max: 2025 }, KS: { min: 2019, max: 2025 }, ME: { min: 2002, max: 2025 },
  MS: { min: 2003, max: 2024 }, MT: { min: 2015, max: 2025 },
  NE: { min: 2020, max: 2025 }, NV: { min: 2019, max: 2024 }, NH: { min: 2017, max: 2024 },
  NM: { min: 2019, max: 2024 }, ND: { min: 2021, max: 2025 },
  OK: { min: 2002, max: 2024 }, RI: { min: 2006, max: 2025 }, SD: { min: 2002, max: 2025 },
  VT: { min: 2015, max: 2025 }, WV: { min: 2020, max: 2025 }, WY: { min: 2005, max: 2025 },
};
// No default fallback — a state resolving to `undefined` is itself an INV-3 FAIL (see below).
const getWindow = (s) => WINDOW_BOUNDS[s];

// INV-11 exact expected FY sets for the 23 touched states (operating / revenue tracked
// separately — NV's op/rev windows diverge; KY is carried-forward unchanged from 116, not
// re-verified here since it wasn't touched this phase).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const EXPECTED_FYS_OP = {
  AK: range(2006, 2025),
  AR: range(2003, 2024),
  DE: range(2004, 2025).filter((f) => f !== 2005),           // hole: 2005 (404)
  HI: range(2005, 2025),
  ID: range(2004, 2025),
  IA: range(2002, 2025).filter((f) => f !== 2008),           // hole: 2008 (RC4-encrypted)
  KS: range(2019, 2025),
  ME: range(2002, 2025),
  MS: range(2003, 2024),
  MT: range(2015, 2025),
  NE: range(2020, 2025),
  NV: range(2019, 2024),                                      // FY2024 op = NASBO fallback
  NH: range(2017, 2024),
  NM: range(2019, 2024).filter((f) => f !== 2020 && f !== 2021), // holes: 2020/2021 (narrower doc)
  ND: range(2021, 2025),
  OK: range(2002, 2024),
  RI: range(2006, 2025),
  SD: range(2002, 2025),
  VT: range(2015, 2025),
  WV: range(2020, 2025),
  WY: range(2005, 2025),
  CA: range(2002, 2025),
  FL: range(2003, 2024),
};
const EXPECTED_FYS_REV = {
  ...EXPECTED_FYS_OP,
  NV: range(2019, 2023), // NV revenue ends FY2023 (FY2024 revenue honestly absent)
};

const results = [];
const pass = (id, desc, det) => { console.log(`  [PASS] ${id}: ${desc}`); if (det) console.log(`         ${det}`); results.push({ id, status: 'PASS', desc }); };
const fail = (id, desc, det) => { console.log(`  [FAIL] ${id}: ${desc}`); if (det) console.log(`         Detail: ${det}`); results.push({ id, status: 'FAIL', desc, det }); };

console.log('Phase 124 — 50-node state cohort source-chain audit (VER-09 b+c, VER-10)');
console.log('v2.15 final-tail + NASBO retirement: +21 tail states, CA/FL widened — ALL 50 states on ACFR, 2 honest NASBO fallbacks');
console.log('');

// ── Load state nodes ──────────────────────────────────────────────────────────
const { data: stateNodes, error: stateErr } = await sb.schema('treasury')
  .from('municipalities').select('id,name,state,entity_type').eq('entity_type', 'state').order('state');
if (stateErr) { console.error('FATAL:', stateErr.message); process.exit(2); }
console.log(`Loaded ${stateNodes.length} state nodes`);
if (stateNodes.length !== 50) console.warn(`  WARNING: expected 50 state nodes, found ${stateNodes.length}`);

const stateIds = stateNodes.map(m => m.id);
const stateById = Object.fromEntries(stateNodes.map(m => [m.id, m]));

// ── Load ALL budget rows, explicitly paginated (see header note — cohort exceeds the
//    PostgREST 1,000-row default response cap) ───────────────────────────────────────────
async function fetchAllBudgets() {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb.schema('treasury')
      .from('budgets')
      .select('id,municipality_id,fiscal_year,dataset_type,total_budget,data_source,source_url,source_date,data_source_id,fiscal_year_start_month')
      .in('municipality_id', stateIds)
      .order('municipality_id').order('fiscal_year').order('dataset_type')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
let allBudgets;
try {
  allBudgets = await fetchAllBudgets();
} catch (e) {
  console.error('FATAL:', e.message); process.exit(2);
}
console.log(`Loaded ${allBudgets.length} state budget rows (paginated fetch — verified complete)`);

// Per-state counts for the report.
console.log('');
console.log('── Row counts (50 ACFR states) ─────────────────────────────────────────────');
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
  const mark = TAIL_21.includes(s) ? ' [NEW-TAIL]' : DEEPENED_WIDENED.includes(s) ? ' [WIDENED]' : DEEPENED_116.includes(s) ? ' [DEEPENED-116]' : '';
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
  // Documented exception (122-03-DEEP05-CLOSEOUT.md line 29 / 122-03-SUMMARY.md): CA's
  // operating loader is NOT ephemeral for this one dataset and intentionally keeps exactly
  // 1 persistent registry row (`ca-acfr-gf-operating`, 24 fiscal_years). Phase 122 verified
  // this is the only persistent row on the CA node (0 orphan/duplicate) — budgets rows use
  // text-stamp provenance (data_source_id is NULL on every CA row, confirmed by INV-5), so
  // this row backing "0 referencing rows" is BY DESIGN, not WR-05-class residue.
  const DOCUMENTED_PERSISTENT_REGISTRY = new Set(['ca-acfr-gf-operating']);
  const { data: gfSources, error: gfErr } = await sb.schema('treasury')
    .from('data_sources').select('id,name,dataset_id,api_type').like('dataset_id', '%-gf-%').order('dataset_id');
  if (gfErr) fail('INV-2', 'could not load data_sources', gfErr.message);
  else {
    const targets = gfSources.filter(ds => !CITY_PREFIXES.some(p => ds.dataset_id.startsWith(p)) && !DOCUMENTED_PERSISTENT_REGISTRY.has(ds.dataset_id));
    const residue = [];
    for (const ds of targets) {
      const { count, error: cErr } = await sb.schema('treasury')
        .from('budgets').select('id', { count: 'exact', head: true }).eq('data_source_id', ds.id);
      if (cErr) { console.warn(`    WARNING: count error for ${ds.dataset_id}: ${cErr.message}`); continue; }
      if ((count ?? 0) === 0) residue.push(ds.dataset_id);
    }
    const excludedFound = gfSources.filter(ds => DOCUMENTED_PERSISTENT_REGISTRY.has(ds.dataset_id));
    if (excludedFound.length !== DOCUMENTED_PERSISTENT_REGISTRY.size) {
      fail('INV-2', `Expected exactly the ${DOCUMENTED_PERSISTENT_REGISTRY.size} documented persistent registry row(s) (${[...DOCUMENTED_PERSISTENT_REGISTRY].join(', ')}), found ${excludedFound.length}`,
        excludedFound.map(d => d.dataset_id).join(', ') || 'none found');
    } else if (residue.length === 0) {
      pass('INV-2', `0 state *-gf-* data_sources with 0 referencing live rows (${targets.length} checked, excl. the 1 documented CA persistent-registry exception)`);
    } else {
      fail('INV-2', `${residue.length} stale *-gf-* data_sources back 0 live rows (WR-05-class residue)`,
        residue.slice(0, 10).join(', '));
    }
  }
}

// ── INV-3: out-of-window ──────────────────────────────────────────────────────
console.log('── INV-3: out-of-window ────────────────────────────────────────────────────');
{
  const noWindow = [...new Set(allBudgets.map(r => stateById[r.municipality_id]?.state).filter(Boolean))]
    .filter(s => !getWindow(s));
  const oow = allBudgets.filter(r => {
    const m = stateById[r.municipality_id];
    if (!m) return false;
    const w = getWindow(m.state);
    if (!w) return true; // no explicit window resolved -> FAIL (no _NASBO default anymore)
    return r.fiscal_year < w.min || r.fiscal_year > w.max;
  });
  if (oow.length === 0 && noWindow.length === 0) pass('INV-3', `0 state-node FYs outside their per-state loaded window bounds (all 50 states have an explicit window; no default fallback)`);
  else fail('INV-3', `${oow.length} row(s) outside their window${noWindow.length ? `; ${noWindow.length} state(s) with NO explicit window: ${noWindow.join(', ')}` : ''}`,
    oow.slice(0, 10).map(r => { const m = stateById[r.municipality_id]; const w = getWindow(m?.state); return `${m?.state} FY${r.fiscal_year} ${r.dataset_type} (window ${w ? `${w.min}-${w.max}` : 'NONE'})`; }).join(' | '));
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

// ── INV-6: ACFR-GAAP-on-50 ──────────────────────────────────────────────────────
console.log('── INV-6: ACFR-GAAP-on-50 ──────────────────────────────────────────────────');
{
  const acfrIds = new Set(stateNodes.filter(m => ACFR_STATES.has(m.state)).map(m => m.id));
  const acfrBudgets = allBudgets.filter(r => acfrIds.has(r.municipality_id) && ['operating', 'revenue'].includes(r.dataset_type));

  // Two documented exceptions: KY FY2023 operating + NV FY2024 operating remain NASBO-labelled
  // honest holes (the only 2 NASBO rows in the whole cohort — see NASBORT-01 below).
  const isKY2023Op = (r) => stateById[r.municipality_id]?.state === 'KY' && r.fiscal_year === 2023 && r.dataset_type === 'operating';
  const isNV2024Op = (r) => stateById[r.municipality_id]?.state === 'NV' && r.fiscal_year === 2024 && r.dataset_type === 'operating';
  const checkable = acfrBudgets.filter(r => !isKY2023Op(r) && !isNV2024Op(r));
  const exceptions = acfrBudgets.filter(r => isKY2023Op(r) || isNV2024Op(r));

  // Pre-GASB-34 years honestly carry "State CAFR" (the era-correct term); accept either
  // acronym here — INV-8 separately enforces the pre-34-vs-GAAP basis-label distinctness.
  const bad = checkable.filter(r => !r.data_source || !/\b(ACFR|CAFR)\b/i.test(r.data_source));
  const nasboLeak = checkable.filter(r => r.data_source && r.data_source.toUpperCase().includes('NASBO'));
  const exceptionsBad = exceptions.filter(r => !r.data_source || !r.data_source.toUpperCase().includes('NASBO'));

  console.log(`    ${[...ACFR_STATES].length} ACFR states checked (all 50)`);
  if (bad.length === 0 && nasboLeak.length === 0 && exceptionsBad.length === 0 && exceptions.length === 2) {
    pass('INV-6', `All ${checkable.length} rows on the 50 ACFR states carry ACFR/CAFR provenance (0 unexpected NASBO leaks); the 2 documented exceptions (KY FY2023 op, NV FY2024 op) correctly retain their NASBO label`);
  } else {
    fail('INV-6', `${bad.length} non-ACFR-labelled + ${nasboLeak.length} unexpected-NASBO-labelled row(s) on ACFR states (excl. the 2 documented exceptions); exception count=${exceptions.length} (expect 2), bad-exceptions=${exceptionsBad.length}`,
      [...bad, ...nasboLeak, ...exceptionsBad].slice(0, 10).map(r => `${stateById[r.municipality_id]?.state} FY${r.fiscal_year} ${r.dataset_type}: "${(r.data_source || 'null').slice(0, 40)}"`).join(' | '));
  }
}

// ── NASBORT-01: exactly 2 NASBO rows cohort-wide, no ACFR-occupied overlap ──────────────────
console.log('── NASBORT-01: NASBO retired to exactly 2 fallback rows ───────────────────');
{
  const nasboRows = allBudgets.filter(r => r.data_source && r.data_source.toUpperCase().includes('NASBO'));
  const issues = [];

  if (nasboRows.length !== 2) issues.push(`expected exactly 2 NASBO rows cohort-wide, found ${nasboRows.length}`);

  const key = (r) => `${stateById[r.municipality_id]?.state}::${r.fiscal_year}::${r.dataset_type}`;
  const nasboKeys = new Set(nasboRows.map(key));
  const expectedKeys = new Set(['NV::2024::operating', 'KY::2023::operating']);
  const unexpected = [...nasboKeys].filter(k => !expectedKeys.has(k));
  const missing = [...expectedKeys].filter(k => !nasboKeys.has(k));
  if (unexpected.length) issues.push(`unexpected NASBO row(s) at: ${unexpected.join(', ')}`);
  if (missing.length) issues.push(`missing expected NASBO row(s) at: ${missing.join(', ')}`);

  // Every (state, fy) key with an ACFR-labelled operating row must have 0 NASBO rows at the
  // same key (the general "no node shows NASBO where ACFR exists" form).
  const acfrOpKeys = new Set(
    allBudgets
      .filter(r => r.dataset_type === 'operating' && r.data_source && /\b(ACFR|CAFR)\b/i.test(r.data_source) && !r.data_source.toUpperCase().includes('NASBO'))
      .map(r => `${stateById[r.municipality_id]?.state}::${r.fiscal_year}`)
  );
  const nasboOpKeysShort = new Set(nasboRows.filter(r => r.dataset_type === 'operating').map(r => `${stateById[r.municipality_id]?.state}::${r.fiscal_year}`));
  const overlap = [...nasboOpKeysShort].filter(k => acfrOpKeys.has(k));
  if (overlap.length) issues.push(`(state, fy) key(s) with BOTH an ACFR and a NASBO operating row: ${overlap.join(', ')}`);

  if (issues.length === 0) {
    pass('NASBORT-01', 'Exactly 2 NASBO rows in the entire cohort (NV FY2024 operating, KY FY2023 operating); neither key carries a same-year ACFR operating row; 0 (state,fy) keys carry both an ACFR and a NASBO operating row cohort-wide');
  } else fail('NASBORT-01', `${issues.length} issue(s)`, issues.join(' || '));
}

// ── 50/50-ACFR: every state has an ACFR operating row, 0 NASBO-only states ─────────────────
console.log('── 50/50-ACFR: distinct-ACFR-state count === 50 ───────────────────────────');
{
  const acfrOpStates = new Set(
    allBudgets
      .filter(r => r.dataset_type === 'operating' && r.data_source && /\b(ACFR|CAFR)\b/i.test(r.data_source) && !r.data_source.toUpperCase().includes('NASBO'))
      .map(r => stateById[r.municipality_id]?.state)
      .filter(Boolean)
  );
  // NV and KY each have exactly 1 ACFR-labelled year missing (their NASBO fallback year), but
  // both still have >=1 OTHER ACFR operating row, so they still count toward the 50.
  const allStateAbbrs = new Set(stateNodes.map(m => m.state));
  const missing = [...allStateAbbrs].filter(s => !acfrOpStates.has(s));
  if (acfrOpStates.size === 50 && missing.length === 0) {
    pass('INV-5050', `All 50 states have at least 1 ACFR-labelled operating row; 0 states are NASBO-only / ACFR-absent`);
  } else {
    fail('INV-5050', `Distinct ACFR-op-state count = ${acfrOpStates.size} (expect 50)`,
      `Missing ACFR coverage: ${missing.join(', ') || 'none'}`);
  }
}

// ── INV-8: pre-GASB-34 basis-label distinctness (carried, unchanged) ────────────
console.log('── INV-8: pre-GASB-34 basis-label distinctness (carried) ──────────────────');
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
    pass('INV-8', 'CT FY1988-2001, WI FY2000-2001, MA FY2001 all carry the distinct pre-GASB-34 label; their modern years (incl. CT FY2006, OCR-recovered) carry GAAP basis — the tail load + NASBO retirement did not disturb these',
      spotChecks.join(' | '));
  } else fail('INV-8', `${issues.length} pre-34 label issue(s)`, issues.join(' || '));
}

// ── INV-9: AL Sep-30 FY-end semantics (carried, unchanged) ──────────────────────
console.log('── INV-9: AL Sep-30 FY-end semantics (carried) ─────────────────────────────');
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

// ── INV-10: MI Sep-30 FY-end semantics (carried, unchanged) ────────────────────
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

// ── INV-ME: ME non-June FY-end flag resolved (standard June-30, NEW this phase) ────────────
console.log('── INV-ME: ME fiscal_year_start_month matches its LOADLOG (standard June-30) ──');
{
  const me = stateNodes.find(m => m.state === 'ME');
  const meRows = allBudgets.filter(r => r.municipality_id === me?.id);
  // 119-03-ME-LOADLOG confirmed standard June-30 FY-end on all 26 downloaded covers (the
  // pre-recon "non-June to watch" flag was resolved, NOT confirmed as non-June). Standard
  // June-30 states carry fiscal_year_start_month = 1 (same value as every other unflagged
  // state, e.g. ND/SD) and source_date = {FY}-06-30 — NOT the Sep-30 special value (10).
  const badMonth = meRows.filter(r => r.fiscal_year_start_month !== 1);
  const badDate = meRows.filter(r => !(r.source_date || '').endsWith('-06-30'));
  if (meRows.length === 48 && badMonth.length === 0 && badDate.length === 0) {
    pass('INV-ME', `All 48 ME rows: fiscal_year_start_month = 1 (standard, not Sep-30) and source_date ends -06-30 — the pre-recon non-June flag is confirmed resolved DB-side`);
  } else {
    fail('INV-ME', `ME FY-end check: rows=${meRows.length} (expect 48), badMonth=${badMonth.length}, badDate=${badDate.length}`,
      [...badMonth, ...badDate].slice(0, 5).map(r => `FY${r.fiscal_year} ${r.dataset_type} date=${r.source_date} month=${r.fiscal_year_start_month}`).join(' | '));
  }
}

// ── INV-11: window-integrity (23 touched states: 21 new tail + CA + FL) ────────────────────
console.log('── INV-11: window-integrity (23 touched states, exact FY sets, holes encoded) ──');
{
  const issues = [];
  for (const s of TOUCHED_THIS_PHASE) {
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
    pass('INV-11', `All ${TOUCHED_THIS_PHASE.length} touched states (21 new tail + CA + FL) match their recorded loaded-FY sets exactly (op & rev tracked separately; holes absent by design)`,
      'Holes verified absent-by-design: DE 2005 · IA 2008 · NM 2020/2021 · NV rev ends 2023 (op FY2024 = NASBO fallback) · CA/FL below-floor years excluded from window');
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
for (const r of results) console.log(`  ${r.id.padEnd(10)} ${r.status}  ${r.desc.slice(0, 80)}`);
const failCount = results.filter(r => r.status === 'FAIL').length;
console.log('');
console.log(`  ${results.length - failCount} PASS, ${failCount} FAIL (of ${results.length} invariants)`);
console.log('');
if (failCount === 0) {
  console.log('PASS — All Phase 124 cohort source-chain audit invariants satisfied (v2.15 final-tail + NASBO-retirement cohort, 50/50 ACFR)');
  process.exit(0);
} else {
  console.log('FAIL — One or more Phase 124 cohort audit invariants failed');
  process.exit(2);
}
