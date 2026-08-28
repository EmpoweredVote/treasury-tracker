#!/usr/bin/env node
/**
 * SCOPE-02 verification — axis coverage (basis + reporting_entity), the
 * unclosed-year rule, the inverted duplicate rule, and the frozen-figure
 * invariant.
 *
 * Supersedes the spec's separate verify-basis.mjs, and folds in the
 * reporting_entity coverage the spec assigned to verify-fund-scope.mjs. One
 * harness, both new axes.
 *
 * Coverage is REPORTED, never hidden: `unknown` on either axis is a result.
 *
 * Usage: node scripts/verify-budget-axes.mjs
 */

import { readFileSync } from 'node:fs';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';
import { findIllegalDuplicates, classifyDuplicates, frozenIdDigest, classifyFrozenDrift } from './lib/scopeVerify.mjs';

const LAST_CLOSED_FY = 2025;

function tallyBy(rows, field) {
  const t = new Map();
  for (const r of rows) {
    const v = r[field] ?? 'unknown';
    if (!t.has(v)) t.set(v, { rows: 0, entities: new Set() });
    const g = t.get(v);
    g.rows += 1;
    g.entities.add(r.municipality_id);
  }
  return [...t].map(([value, g]) => ({ value, rows: g.rows, entities: g.entities.size }))
    .sort((a, b) => b.rows - a.rows);
}

const supabase = await getSupabase();
const rows = await fetchScopeRows(supabase);
let failed = false;

console.log(`\n── coverage (${rows.length.toLocaleString()} rows) ──`);
for (const field of ['basis', 'reporting_entity']) {
  console.log(`  ${field}:`);
  for (const t of tallyBy(rows, field)) {
    const pct = ((t.rows / rows.length) * 100).toFixed(1);
    console.log(`    ${String(t.value).padEnd(22)} ${String(t.rows).padStart(6)} rows  ${pct.padStart(5)}%  ${t.entities} entities`);
  }
}

console.log('\n── the unclosed-year rule ──');
const unclosed = rows.filter((r) => r.basis === 'actual' && r.fiscal_year > LAST_CLOSED_FY);
if (unclosed.length) {
  failed = true;
  console.error(`  ✗ ${unclosed.length} rows are 'actual' for a fiscal year after FY${LAST_CLOSED_FY}`);
  for (const r of unclosed.slice(0, 10)) console.error(`      ${r.name} FY${r.fiscal_year} ${r.dataset_type} ${r.data_source}`);
} else {
  console.log(`  ✅ no row claims 'actual' for a year after FY${LAST_CLOSED_FY}`);
}

console.log('\n── illegal duplicates (inverted rule) ──');
const { illegal, periodSplit, scopeSplit } = classifyDuplicates(findIllegalDuplicates(rows));
if (illegal.length) {
  failed = true;
  console.error(`  ✗ ${illegal.length} (city-year, dataset, basis) groups hold more than one row FOR THE SAME PERIOD`);
  for (const d of illegal.slice(0, 10)) console.error(`      ${d.name} FY${d.fiscal_year} ${d.dataset_type} basis=${d.basis} rows=${d.rows}`);
} else {
  console.log('  ✅ at most one row per (city-year, dataset, basis, period)');
}
if (periodSplit.length) {
  // Reported, never fatal: these are two non-overlapping reporting periods filed
  // under one fiscal year, not a double-count. See classifyDuplicates().
  console.log(`  ℹ ${periodSplit.length} group(s) split across DISTINCT periods — expected, still a hazard for naive summing:`);
  for (const d of periodSplit.slice(0, 10)) {
    const labels = d.detail.map((r) => r.period_label ?? '(annual)').join(' | ');
    console.log(`      ${d.name} FY${d.fiscal_year} ${d.dataset_type} — ${labels}`);
  }
}
if (scopeSplit.length) {
  // SCOPE-04. Reported, never fatal: one published all_funds row beside one
  // derived total_governmental row for the same city-year is the state this
  // milestone exists to create. ⚠ Still a hazard for anything that SUMS a
  // city-year, because all_funds CONTAINS total_governmental — the app draws one
  // series at a time and never adds them.
  console.log(`  ℹ ${scopeSplit.length} group(s) split across DISTINCT fund scopes — SCOPE-04's intended`
    + ' state, still a hazard for naive summing (all_funds CONTAINS total_governmental):');
  for (const d of scopeSplit.slice(0, 5)) {
    const scopes = d.detail.map((r) => `${r.fund_scope}${r.derivation === 'derived' ? ' (derived)' : ''}`).join(' | ');
    console.log(`      ${d.name} FY${d.fiscal_year} ${d.dataset_type} — ${scopes}`);
  }
  if (scopeSplit.length > 5) console.log(`      … and ${scopeSplit.length - 5} more`);
}

console.log('\n── the figure invariant (frozen at v2.24, computed as an exclusion) ──');
const baseline = JSON.parse(readFileSync('scripts/data/scopeBaseline.json', 'utf8'));
// ⚠ A LIST since v2.30 — one file per milestone that creates rows. It was a single
// path and went un-updated across v2.27, v2.28 and v2.29, so this digest read as
// moved on every run in that window. See scopeBaseline.json `_rebased_at_v2_30`.
const excludedIds = (baseline.excluded_ids_files
  ?? (baseline.excluded_ids_file ? [baseline.excluded_ids_file] : []))
  .flatMap((rel) => JSON.parse(readFileSync(rel, 'utf8')));

// The authorised-correction ledger. Each entry records the value a frozen row
// held BEFORE an approved correction, so the digest survives the correction
// while an UNRECORDED change still moves it. Without this, repairing a wrong
// figure — which is what TT is for — destroys the invariant's lineage and
// forces a rebase. That happened twice in one week; see scopeBaseline.json.
const ledger = new Map();
for (const rel of baseline.figure_change_files ?? []) {
  for (const e of JSON.parse(readFileSync(rel, 'utf8'))) ledger.set(e.id, e.old);
}

const excludedSet = new Set(excludedIds);
const nonExcludedCount = rows.filter((r) => !excludedSet.has(r.id)).length;
const digest = frozenIdDigest(rows, excludedIds, ledger);

const verdict = classifyFrozenDrift({
  nonExcludedCount,
  frozenRowCount: baseline.frozen_row_count,
  digest,
  expectedDigest: baseline.figures_frozen,
});

if (ledger.size) console.log(`  ℹ ${ledger.size} authorised correction(s) applied from the ledger`);

// ⚠ Report the live-sync exposure ALWAYS, pass or fail. A frozen row belonging to
// an enabled cron-syncing source can have its total_budget rewritten when the
// upstream publisher revises a figure — with no human involved, so no ledger
// entry can ever be written for it. That is a drift source the ledger cannot
// cover, and knowing its size is what makes the next failure diagnosable in
// minutes instead of an afternoon. If drift recurs here, the fix is to scope the
// digest to rows NOT under live sync.
try {
  const { data: live } = await supabase.schema('treasury').from('data_sources')
    .select('name').eq('is_enabled', true).not('sync_frequency', 'is', null).limit(5000);
  const liveNames = new Set((live ?? []).map((d) => d.name));
  const exposed = rows.filter((r) => !excludedSet.has(r.id) && liveNames.has(r.data_source)).length;
  const pct = ((exposed / Math.max(nonExcludedCount, 1)) * 100).toFixed(1);
  console.log(`  ℹ ${exposed.toLocaleString()} of ${nonExcludedCount.toLocaleString()} frozen rows (${pct}%) are under LIVE SYNC — a drift source no ledger can capture`);
} catch {
  console.log('  ℹ live-sync exposure could not be measured (data_sources unreadable)');
}

if (verdict.kind === 'ok') {
  console.log(`  ✅ ${verdict.message} (${digest.slice(0, 16)}…)`);
} else {
  failed = true;
  // ⚠ Name the ACTUAL condition. Reporting "a figure moved" for what is really an
  // unregistered-rows bookkeeping miss is how this check stopped being read.
  const title = {
    unregistered_rows: 'ROWS NOT REGISTERED — the count does not reconcile',
    missing_rows: 'FROZEN ROWS HAVE VANISHED',
    figure_changed: 'FROZEN FIGURE DIGEST MOVED — a surviving row changed',
  }[verdict.kind];
  console.error(`  ✗ ${title}`);
  for (const line of verdict.message.match(/.{1,88}(\s|$)/g) ?? []) {
    console.error(`      ${line.trim()}`);
  }
  console.error('      ⚠ Never regenerate figures_frozen to make this pass.');
}

console.log(failed ? '\n✗ checks failed\n' : '\n✅ all checks passed\n');
process.exit(failed ? 1 : 0);
