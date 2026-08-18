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
import { findIllegalDuplicates, frozenIdDigest } from './lib/scopeVerify.mjs';

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
const dupes = findIllegalDuplicates(rows);
if (dupes.length) {
  failed = true;
  console.error(`  ✗ ${dupes.length} (city-year, dataset, basis) groups hold more than one row`);
  for (const d of dupes.slice(0, 10)) console.error(`      ${d.name} FY${d.fiscal_year} ${d.dataset_type} basis=${d.basis} rows=${d.rows}`);
} else {
  console.log('  ✅ at most one row per (city-year, dataset, basis)');
}

console.log('\n── the figure invariant (frozen at v2.24, computed as an exclusion) ──');
const baseline = JSON.parse(readFileSync('scripts/data/scopeBaseline.json', 'utf8'));
const excludedIds = JSON.parse(readFileSync(baseline.excluded_ids_file, 'utf8'));
const digest = frozenIdDigest(rows, excludedIds);
if (baseline.figures_frozen && digest !== baseline.figures_frozen) {
  failed = true;
  console.error(`  ✗ FROZEN FIGURE DIGEST MOVED — a row that existed at v2.24 changed or vanished`);
  console.error(`      expected ${baseline.figures_frozen}`);
  console.error(`      got      ${digest}`);
  console.error('      This is a bug, never a baseline to update.');
} else {
  console.log(`  ✅ unchanged (${digest.slice(0, 16)}…)`);
}

console.log(failed ? '\n✗ checks failed\n' : '\n✅ all checks passed\n');
process.exit(failed ? 1 : 0);
