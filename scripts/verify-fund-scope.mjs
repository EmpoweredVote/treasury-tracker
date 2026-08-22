#!/usr/bin/env node
/**
 * SCOPE-01 Task 8 — coverage, registry integrity, and the no-figure-moved proof.
 *
 * ── WHY THERE ARE TWO DIGESTS ───────────────────────────────────────────────
 * The Task 3 baseline was keyed on
 *   (municipality_id, fiscal_year, dataset_type, period_label, total_budget)
 * and `dataset_type` is a MUTABLE LABEL. When the 304 VA APA revenue rows were
 * relabelled `revenue` -> `revenue_local_only` (migration 20260817000200, a
 * deliberate decision), that digest moved -- while every figure stayed identical.
 * A digest keyed on a mutable label conflates "a figure moved" with "a label
 * changed", and a harness that cries wolf gets ignored. So:
 *
 *   figures   sha256 over (id | total_budget), ordered by id.
 *             THE INVARIANT. `id` is the primary key, so this is immune to any
 *             relabelling. If it moves, something wrote a figure -- a bug, full stop.
 *
 *   composite sha256 over the Task 3 key. A CHANGE DETECTOR, not an invariant.
 *             It is allowed to move when a migration says so, and the baseline is
 *             then updated with that migration cited.
 *
 * ── SCOPE-02: BOTH DIGESTS ARE NOW COMPUTED AS AN EXCLUSION ─────────────────
 * SCOPE-01 computed both over EVERY row and asserted the figure digest never
 * moves. SCOPE-02 adds rows by design (Task 10 inserted 12), so a whole-table
 * digest moves legitimately -- and this script, left unchanged, reported
 * "FIGURE DIGEST MOVED" plus a grown row count on every single run. Three red
 * lines, none of them real. A harness nobody believes is worse than no harness.
 *
 * It was ONLY ever the row set that was wrong. Verified before this was changed:
 * over the frozen rows alone this script's own digests still reproduce the v2.24
 * baselines byte-for-byte (figures 2d6b948f..., composite 84c75e1c...). No figure
 * had moved; the harness was asking the wrong question.
 *
 * So both now cover every row EXCEPT the ids in scripts/data/scope02CreatedIds.json,
 * the same exclusion mechanism verify-budget-axes.mjs uses -- and this script now
 * shares that harness's fetch, so there is ONE query and ONE number for the
 * invariant. It previously kept a private fetch that selected `total_budget` as a
 * bare numeric; PostgREST's JSON encoding drops `numeric` scale (420993316.00 ->
 * 420993316) and on one row loses precision outright (316736239.26999999985 ->
 * 316736239.27), so the two harnesses computed DIFFERENT digests for the same
 * invariant and neither could corroborate the other.
 *
 * Baselines live in scripts/data/scopeBaseline.json so they are committed, diffable
 * and reviewable rather than buried in a comment.
 *
 * Usage:
 *   node scripts/verify-fund-scope.mjs
 *   node scripts/verify-fund-scope.mjs --write-baseline   # see the warning below
 */

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';
import { validateRegistry, SCOPE_VALUES, SCOPE } from './lib/fundScope.mjs';
import { compositeDigest, frozenIdDigest } from './lib/scopeVerify.mjs';
import { FUND_SCOPE_REGISTRY } from './data/fundScopeRegistry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(HERE, 'data', 'scopeBaseline.json');

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

/**
 * The ids created SINCE v2.24, which both digests exclude. Paths are committed in
 * the baseline.
 *
 * ⚠ This was a single `excluded_ids_file` holding SCOPE-02's 12 ids, and it went
 * un-updated across THREE milestones — v2.27 (Austin + Travis, 76 rows), v2.28
 * (LA-02) and v2.29 (Colorado Springs + El Paso, 64 rows). The harness reported
 * a moved figure digest on every run in that window, which is precisely how an
 * invariant stops being read. It is a LIST now so each milestone appends its own
 * file rather than editing a shared one.
 */
function loadExcludedIds(baseline) {
  const rels = baseline?.excluded_ids_files
    ?? (baseline?.excluded_ids_file ? [baseline.excluded_ids_file] : []);
  const ids = [];
  for (const rel of rels) {
    const path = join(HERE, '..', rel);
    if (!existsSync(path)) {
      console.error(`  ⚠ excluded ids file missing: ${rel}`);
      continue;
    }
    ids.push(...JSON.parse(readFileSync(path, 'utf8')));
  }
  return ids;
}

async function main() {
  const { values } = parseArgs({ options: { 'write-baseline': { type: 'boolean', default: false } } });
  let failures = 0;
  const fail = (m) => { console.error(`  ❌ ${m}`); failures += 1; };
  const pass = (m) => console.log(`  ✅ ${m}`);

  // ── 1. Registry integrity ────────────────────────────────────────────────
  console.log('── registry ──');
  const reg = validateRegistry(FUND_SCOPE_REGISTRY);
  if (reg.ok) pass(`${FUND_SCOPE_REGISTRY.length} entries, every non-unknown one evidenced`);
  else fail(`registry invalid: ${JSON.stringify(reg)}`);

  const unevidenced = FUND_SCOPE_REGISTRY.filter((e) => !e.evidence?.document?.trim() || !e.evidence?.figures?.trim());
  if (unevidenced.length === 0) pass('no entry claims a scope without a document AND figures');
  else fail(`entries missing evidence: ${unevidenced.map((e) => e.id).join(', ')}`);

  // ── 2. Coverage ──────────────────────────────────────────────────────────
  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  console.log(`\n── coverage (${rows.length.toLocaleString()} rows) ──`);

  const missing = rows.filter((r) => r.fund_scope == null || r.fund_scope === '');
  if (missing.length === 0) pass('every row has a fund_scope (NOT NULL, asserted anyway)');
  else fail(`${missing.length} rows have no fund_scope`);

  const illegal = rows.filter((r) => !SCOPE_VALUES.includes(r.fund_scope));
  if (illegal.length === 0) pass(`every value is one of: ${SCOPE_VALUES.join(', ')}`);
  else fail(`${illegal.length} rows hold a value outside the CHECK set: ${[...new Set(illegal.map((r) => r.fund_scope))].join(', ')}`);

  // ── 3. The tally, with unknown SHOWN ─────────────────────────────────────
  const t = new Map();
  for (const r of rows) {
    if (!t.has(r.fund_scope)) t.set(r.fund_scope, { rows: 0, ents: new Set(), srcs: new Set() });
    const g = t.get(r.fund_scope);
    g.rows += 1; g.ents.add(r.municipality_id); g.srcs.add(r.data_source);
  }
  console.log('\n── bucket tally (unknown is a RESULT, never hidden) ──');
  for (const [scope, g] of [...t].sort((a, b) => b[1].rows - a[1].rows)) {
    console.log(`  ${scope.padEnd(20)} ${String(g.rows).padStart(6)} rows  ${String((g.rows / rows.length * 100).toFixed(1)).padStart(5)}%  `
      + `${String(g.ents.size).padStart(5)} entities  ${String(g.srcs.size).padStart(5)} sources`);
  }
  const unknownRows = t.get(SCOPE.UNKNOWN)?.rows ?? 0;
  console.log(`  → ${unknownRows.toLocaleString()} rows (${(unknownRows / rows.length * 100).toFixed(1)}%) are honestly unclassified.`);

  // ── 4. The two digests, over the FROZEN row set ──────────────────────────
  const baseline = loadBaseline();
  const excludedIds = loadExcludedIds(baseline);
  const excluded = new Set(excludedIds);
  const frozenRows = rows.filter((r) => !excluded.has(r.id));

  console.log(`\n── digests (${frozenRows.length.toLocaleString()} frozen rows; `
    + `${excluded.size} created since v2.24 and excluded) ──`);
  const figures = frozenIdDigest(rows, excludedIds);
  const composite = compositeDigest(frozenRows);

  if (values['write-baseline']) {
    // ⚠ ONLY when a committed migration explains the change. Rewriting a baseline
    // to silence this harness is the one action that defeats the entire task.
    // `figures_frozen` is therefore NOT writable here: the invariant must not be
    // silenceable by a flag. If it genuinely needs rebasing, that is a deliberate,
    // reviewed edit to the JSON with the reason recorded beside it.
    if (baseline?.figures_frozen && baseline.figures_frozen !== figures) {
      fail('refusing to write a baseline while the FIGURE INVARIANT is moved.');
      console.error('     --write-baseline updates the change detector, never the invariant.');
      console.error('     Find out which frozen row changed first.');
      process.exit(1);
    }
    const next = {
      ...baseline,
      _warning: 'Do NOT edit or regenerate to make the harness pass. `figures_frozen` must never change and is NOT written by --write-baseline; `composite_frozen` changes only when a migration explains it.',
      composite_frozen: composite,
      composite_frozen_history: [
        ...(baseline?.composite_frozen_history ?? []),
        ...(baseline?.composite_frozen && baseline.composite_frozen !== composite
          ? [{ digest: baseline.composite_frozen, superseded_by: 'see the newest migration in supabase/migrations/' }] : []),
      ],
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`  wrote ${BASELINE_PATH}`);
    console.log(`  composite_frozen ${composite}`);
    return;
  }

  if (!baseline) {
    fail(`no baseline at ${BASELINE_PATH} — run once with --write-baseline`);
  } else {
    if (baseline.frozen_row_count === frozenRows.length) {
      pass(`frozen row count unchanged at ${frozenRows.length.toLocaleString()}`);
    } else {
      fail(`frozen row count moved: baseline ${baseline.frozen_row_count} → now ${frozenRows.length}`);
      console.error('     A row that existed at v2.24 was deleted, or a new row is missing from');
      console.error(`     ${baseline.excluded_ids_file}. Add created ids there as they are inserted.`);
    }

    if (baseline.figures_frozen === figures) pass(`FIGURE digest unchanged — no frozen figure moved  (${figures.slice(0, 16)}…)`);
    else {
      fail(`FIGURE DIGEST MOVED. baseline ${baseline.figures_frozen}\n        now      ${figures}`);
      console.error('     This is the invariant, over rows that existed at v2.24. A figure was');
      console.error('     written or a frozen row vanished. Investigate before anything else —');
      console.error('     this is a bug, never a baseline to update.');
    }

    if (!baseline.composite_frozen) {
      console.log(`  ⚠ no composite_frozen baseline yet — run once with --write-baseline (${composite.slice(0, 16)}…)`);
    } else if (baseline.composite_frozen === composite) {
      pass(`composite digest unchanged (${composite.slice(0, 16)}…)`);
    } else {
      console.log('  ⚠ composite digest moved (it includes dataset_type, a mutable label):');
      console.log(`      baseline ${baseline.composite_frozen}`);
      console.log(`      now      ${composite}`);
      console.log('    This is only acceptable if a committed migration explains it. If it does,');
      console.log('    re-run with --write-baseline; if it does not, a label changed unintentionally.');
      failures += 1;
    }
  }

  console.log(`\n${failures === 0 ? '✅ all checks passed' : `❌ ${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
