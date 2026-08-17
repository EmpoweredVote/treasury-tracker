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
 *             relabelling. It must NEVER move while this milestone runs. If it
 *             does, something wrote a figure and that is a bug, full stop.
 *
 *   composite sha256 over the Task 3 key. A CHANGE DETECTOR, not an invariant.
 *             It is allowed to move when a migration says so, and the baseline is
 *             then updated with that migration cited.
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
import { getSupabase } from './lib/scopeDb.mjs';
import { validateRegistry, SCOPE_VALUES, SCOPE } from './lib/fundScope.mjs';
import { figureDigest, compositeDigest } from './lib/scopeVerify.mjs';
import { FUND_SCOPE_REGISTRY } from './data/fundScopeRegistry.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(HERE, 'data', 'scopeBaseline.json');

/** Fetch every row with the fields both digests and the tally need. */
async function fetchAll(supabase) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .schema('treasury').from('budgets')
      .select('id, municipality_id, fiscal_year, dataset_type, period_label, total_budget, fund_scope, data_source')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`fetch budgets: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
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
  const rows = await fetchAll(supabase);
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

  // ── 4. The two digests ───────────────────────────────────────────────────
  console.log('\n── digests ──');
  const figures = figureDigest(rows);
  const composite = compositeDigest(rows);
  const baseline = loadBaseline();

  if (values['write-baseline']) {
    // ⚠ ONLY when a committed migration explains the change. Rewriting a baseline
    // to silence this harness is the one action that defeats the entire task.
    const next = {
      _warning: 'Do NOT edit or regenerate to make the harness pass. `figures` must never change; `composite` changes only when a migration explains it.',
      rows: rows.length,
      figures,
      composite,
      composite_history: [
        ...(baseline?.composite_history ?? []),
        ...(baseline && baseline.composite !== composite
          ? [{ digest: baseline.composite, superseded_by: 'see the newest migration in supabase/migrations/' }] : []),
      ],
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`  wrote ${BASELINE_PATH}`);
    console.log(`  figures   ${figures}`);
    console.log(`  composite ${composite}`);
    return;
  }

  if (!baseline) {
    fail(`no baseline at ${BASELINE_PATH} — run once with --write-baseline`);
  } else {
    if (baseline.rows === rows.length) pass(`row count unchanged at ${rows.length.toLocaleString()}`);
    else fail(`row count moved: baseline ${baseline.rows} → now ${rows.length}`);

    if (baseline.figures === figures) pass(`FIGURE digest unchanged — no figure moved  (${figures.slice(0, 16)}…)`);
    else {
      fail(`FIGURE DIGEST MOVED. baseline ${baseline.figures}\n        now      ${figures}`);
      console.error('     This is the invariant. A figure was written. Investigate before anything else —');
      console.error('     this milestone changes no figure, so a move here is a bug, not a baseline to update.');
    }

    if (baseline.composite === composite) pass(`composite digest unchanged (${composite.slice(0, 16)}…)`);
    else {
      console.log(`  ⚠ composite digest moved (it includes dataset_type, a mutable label):`);
      console.log(`      baseline ${baseline.composite}`);
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
