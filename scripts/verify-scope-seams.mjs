#!/usr/bin/env node
/**
 * SCOPE-01 Task 6 — the seam detector.
 *
 * Walks every (entity, dataset, period) series by fiscal year and flags each point
 * where `fund_scope` changes. Reports both scopes and the percentage change in
 * total_budget across the seam.
 *
 * ── WHAT THIS ASSERTS, AND WHY IT CHANGED ───────────────────────────────────
 * SCOPE-01 asserted the seven known CA seams must be FOUND: "if it finds fewer,
 * the detector is broken, not the data". That was right while the seams were
 * open. SCOPE-02 then CLOSED four of them on purpose, so the SCOPE-01 assertion
 * inverted into a permanent false alarm -- the script exited 1 shouting
 * "DETECTOR BROKEN" precisely because the milestone had succeeded. A harness
 * nobody believes is worse than no harness, so the assertion now matches reality:
 *
 *   · the four SCOPE-02 closed must STAY closed  -> absent, or exit 1
 *   · the three that source coverage leaves open -> reported, never fatal
 *     (SCO ends FY2024, their adopted rows start FY2025: nothing to load)
 *
 * Finding MORE seams elsewhere is a result, not a failure: the rest of the list
 * is the triage queue.
 *
 * Logic lives in scripts/lib/scopeVerify.mjs (pure); this file is IO + reporting.
 *
 * Usage:
 *   node scripts/verify-scope-seams.mjs
 *   node scripts/verify-scope-seams.mjs --all      # every seam, not just the top 40
 *   node scripts/verify-scope-seams.mjs --json     # machine-readable
 */

import { parseArgs } from 'node:util';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';
import {
  detectSeams, checkSeamsClosed,
  SEAMS_CLOSED_BY_SCOPE_02, SEAMS_OPEN_BY_SOURCE_COVERAGE,
} from './lib/scopeVerify.mjs';

const fmt = (n) => (n == null ? '     —' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);
const money = (n) => (Number.isFinite(n) ? `$${(n / 1e6).toFixed(1)}M` : '—');

async function main() {
  const { values } = parseArgs({
    options: { all: { type: 'boolean', default: false }, json: { type: 'boolean', default: false } },
  });

  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  const seams = detectSeams(rows);
  const check = checkSeamsClosed(seams, SEAMS_CLOSED_BY_SCOPE_02);
  const find = (want) => seams.find((s) => s.name === want.name && s.dataset_type === 'operating'
    && s.from_fy === want.from_fy && s.to_fy === want.to_fy);

  if (values.json) {
    console.log(JSON.stringify({
      seams,
      closed_by_scope_02: check,
      open_by_source_coverage: SEAMS_OPEN_BY_SOURCE_COVERAGE.map((w) => ({ ...w, present: Boolean(find(w)) })),
    }, null, 2));
    process.exit(check.ok ? 0 : 1);
  }

  console.log(`read ${rows.length.toLocaleString()} rows`);
  console.log(`found ${seams.length} scope seams\n`);

  console.log('── MUST STAY CLOSED: the four SCOPE-02 backfilled ──');
  for (const want of SEAMS_CLOSED_BY_SCOPE_02) {
    const hit = find(want);
    console.log(`  ${hit ? '❌' : '✅'} ${want.name.padEnd(13)} FY${want.from_fy}→${want.to_fy}  `
      + `${hit ? `REOPENED at ${fmt(hit.pct)} (${hit.from_scope} → ${hit.to_scope})` : 'closed'}`);
  }

  console.log('\n── OPEN BY SOURCE COVERAGE: expected, not a defect (Ruling 9) ──');
  for (const want of SEAMS_OPEN_BY_SOURCE_COVERAGE) {
    const hit = find(want);
    console.log(`  ${hit ? '•' : '🎉'} ${want.name.padEnd(13)} FY${want.from_fy}→${want.to_fy}  `
      + (hit
        ? `open at ${fmt(hit.pct)} — SCO has no FY${want.to_fy} data to continue the series`
        : 'NOW CLOSED — a source must have gained coverage; move it to SEAMS_CLOSED_BY_SCOPE_02'));
  }

  if (!check.ok) {
    console.error(`\n❌ ${check.stillOpen.length} seam(s) SCOPE-02 closed have REOPENED: `
      + `${check.stillOpen.map((s) => s.name).join(', ')}.`);
    console.error('   These were closed by loading the missing all-funds actuals. A reopening');
    console.error('   means a figure or a classification regressed — investigate before triaging');
    console.error('   anything else in the list below.');
    process.exit(1);
  }
  console.log(`\n✅ all ${SEAMS_CLOSED_BY_SCOPE_02.length} seams SCOPE-02 closed are still closed`);

  const shown = values.all ? seams : seams.slice(0, 40);
  console.log(`\n── all seams, largest change first ${values.all ? '' : `(top ${shown.length} of ${seams.length}; --all for the rest)`} ──`);
  for (const s of shown) {
    const gap = s.fy_gap > 1 ? ` gap${s.fy_gap}` : '';
    console.log(
      `  ${(`${s.name}, ${s.state}`).padEnd(26)} ${s.dataset_type.padEnd(10)} FY${s.from_fy}→${s.to_fy}${gap.padEnd(6)} `
      + `${s.from_scope.padEnd(18)} → ${s.to_scope.padEnd(18)} ${money(s.from_total).padStart(9)} → ${money(s.to_total).padStart(9)} ${fmt(s.pct).padStart(8)}`,
    );
  }

  const byPair = new Map();
  for (const s of seams) {
    const k = `${s.from_scope} → ${s.to_scope}`;
    byPair.set(k, (byPair.get(k) ?? 0) + 1);
  }
  console.log('\n── seams by scope transition ──');
  for (const [k, n] of [...byPair].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(42)} ${n}`);

  const entities = new Set(seams.map((s) => s.municipality_id));
  const involvingUnknown = seams.filter((s) => s.involves_unknown).length;
  console.log(`\n${seams.length} seams across ${entities.size} entities. ${involvingUnknown} involve \`unknown\`,`
    + ` ${seams.length - involvingUnknown} are between two KNOWN scopes (those are the unambiguous defects).`);
  console.log('This list is the triage queue. Every entry is a change across TIME between');
  console.log('two years that share no fund_scope — same-year dual rows are not seams and');
  console.log('are policed by verify-budget-axes.mjs instead.');
}

main().catch((e) => { console.error(e); process.exit(1); });
