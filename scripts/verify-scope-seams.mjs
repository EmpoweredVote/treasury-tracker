#!/usr/bin/env node
/**
 * SCOPE-01 Task 6 — the seam detector.
 *
 * Walks every (entity, dataset, period) series by fiscal year and flags each point
 * where `fund_scope` changes. Reports both scopes and the percentage change in
 * total_budget across the seam.
 *
 * ⚠ IT MUST FIND THE SEVEN KNOWN CA CITIES. Chris's instruction, verbatim: "the
 * seam detector in Task 6 must find those seven cities. If it finds fewer, the
 * detector is broken, not the data." So this script ASSERTS them and exits 1 on a
 * short count -- it is an acceptance test that happens to also produce a report.
 * Finding MORE is a result: the extras are recorded as SCOPE-02's work queue.
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
import { detectSeams, checkRequiredSeams, REQUIRED_SEAMS } from './lib/scopeVerify.mjs';

const fmt = (n) => (n == null ? '     —' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);
const money = (n) => (Number.isFinite(n) ? `$${(n / 1e6).toFixed(1)}M` : '—');

async function main() {
  const { values } = parseArgs({
    options: { all: { type: 'boolean', default: false }, json: { type: 'boolean', default: false } },
  });

  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  const seams = detectSeams(rows);
  const check = checkRequiredSeams(seams);

  if (values.json) {
    console.log(JSON.stringify({ seams, required: check }, null, 2));
    process.exit(check.ok ? 0 : 1);
  }

  console.log(`read ${rows.length.toLocaleString()} rows`);
  console.log(`found ${seams.length} scope seams\n`);

  console.log('── REQUIRED: the seven CA seams from CA-CITIES-01 ──');
  for (const r of check.results) {
    const mark = r.found ? '✅' : '❌';
    const detail = r.found
      ? `${fmt(r.actual_pct)} (expected ${fmt(r.pct)}, drift ${r.drift.toFixed(2)}pt)  ${r.from_scope} → ${r.to_scope}`
      : `MISSING — ${r.reason}`;
    console.log(`  ${mark} ${r.name.padEnd(13)} FY${r.from_fy}→${r.to_fy}  ${detail}`);
  }

  if (!check.ok) {
    console.error(`\n❌ DETECTOR BROKEN: found ${check.results.filter((r) => r.found).length}/${REQUIRED_SEAMS.length} required seams.`);
    console.error('   Per the plan, a short count condemns the DETECTOR, not the data. Do not');
    console.error('   relax the expectations — fix the detection. The most likely cause is');
    console.error('   treating a change into/out of `unknown` as "not a seam": every one of the');
    console.error('   seven is all_funds → unknown, so that bug reports zero and looks clean.');
    process.exit(1);
  }
  console.log(`\n✅ all ${REQUIRED_SEAMS.length} required seams found`);

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
  console.log('This list is SCOPE-02\'s work queue.');
}

main().catch((e) => { console.error(e); process.exit(1); });
