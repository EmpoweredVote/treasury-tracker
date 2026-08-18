#!/usr/bin/env node
/**
 * SCOPE-01 Task 7 — the duplicate-scope detector.
 *
 * Reports any (municipality, fiscal_year, dataset_type) holding more than one
 * distinct `fund_scope`.
 *
 * ── THE RULE THIS ASSERTS WAS INVERTED BY SCOPE-02 ──────────────────────────
 * SCOPE-01 asserted that NO city-year may hold more than one `fund_scope`, and
 * exited 1 otherwise. SCOPE-02 then widened the unique index precisely so a State
 * Controller all-funds actuals row could sit beside the city's own adopted
 * General Fund row -- so the SCOPE-01 assertion started failing on the 12 pairs
 * the milestone existed to create. It reported `❌ 12 city-year(s)` and exited 1
 * on a correct table, every run. A harness nobody believes is worse than no
 * harness, so the assertion now matches the rule of record:
 *
 *   scope plurality  -> REPORTED as information. It is the intended shape.
 *   two rows sharing (city-year, dataset, basis) for the SAME period -> FATAL.
 *
 * That second rule is findIllegalDuplicates(), the detector SCOPE-02 Task 11
 * built and tested for exactly this purpose but only ever wired into
 * verify-budget-axes.mjs. Both harnesses now apply it, and both classify their
 * findings the same way, so they cannot disagree about what a duplicate is.
 *
 * Because "reads zero" is unfalsifiable on its own, `--mutation-test` proves the
 * detector can actually fire: it makes a REAL pair collide in memory and asserts
 * exactly that group is reported. No write, so no risk to production data and
 * nothing to roll back.
 *
 * NOTE the grouping deliberately excludes `period_label`, so the federal FY1976
 * annual + Transition Quarter pairs are caught rather than hidden by
 * construction. They are then classified as a period split and reported without
 * failing the run -- see classifyDuplicates() for why that is not a suppression.
 *
 * Usage:
 *   node scripts/verify-scope-duplicates.mjs
 *   node scripts/verify-scope-duplicates.mjs --mutation-test
 */

import { parseArgs } from 'node:util';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';
import { findDuplicateScopes, findIllegalDuplicates, classifyDuplicates } from './lib/scopeVerify.mjs';

/**
 * Prints either shape: findDuplicateScopes groups carry `scopes`, while
 * findIllegalDuplicates groups carry `basis`. Reading only one of the two is how
 * this crashed when the second detector was wired in.
 */
function report(dupes) {
  for (const d of dupes) {
    const tag = d.scopes ? `scopes [${d.scopes.join(', ')}]` : `basis ${d.basis}`;
    console.log(`  ${(`${d.name}, ${d.state}`).padEnd(26)} FY${d.fiscal_year} ${d.dataset_type.padEnd(16)} `
      + `${d.rows} rows, ${tag}`);
    for (const r of d.detail) {
      console.log(`      ${String(r.fund_scope).padEnd(20)} period=${String(r.period_label ?? '(null)').padEnd(34)} `
        + `$${Number(r.total_budget).toLocaleString()}  ${String(r.data_source).slice(0, 46)}`);
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: { 'mutation-test': { type: 'boolean', default: false } } });

  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  console.log(`read ${rows.length.toLocaleString()} rows`);

  // ── information: scope plurality is the SHAPE SCOPE-02 created, not a defect ──
  const plural = findDuplicateScopes(rows);
  console.log('\n── scope plurality (informational) ──');
  if (plural.length === 0) {
    console.log('  no city-year holds more than one fund_scope.');
  } else {
    console.log(`  ℹ ${plural.length} city-year(s) hold more than one fund_scope — the intended SCOPE-02 pairing`);
    console.log('    (State Controller all-funds actuals beside the city\'s own adopted General Fund):');
    report(plural);
  }

  // ── the assertion: at most one row per (city-year, dataset, basis, period) ──
  const { illegal, periodSplit } = classifyDuplicates(findIllegalDuplicates(rows));
  console.log('\n── illegal duplicates (the rule of record) ──');
  if (illegal.length === 0) {
    console.log('  ✅ no (city-year, dataset, basis) group holds two rows for the SAME period');
  } else {
    console.log(`  ❌ ${illegal.length} group(s) double-count:`);
    report(illegal);
  }
  if (periodSplit.length) {
    console.log(`\n  ℹ ${periodSplit.length} group(s) split across DISTINCT periods — not a double-count:`);
    report(periodSplit);
  }

  if (values['mutation-test']) {
    console.log('\n── mutation test: can the detector actually fire? ──');

    // Make a REAL pair collide rather than inventing a fixture: take a city-year
    // that legitimately holds two rows under two different bases and force them
    // onto the same basis. That is precisely the double-count the widened index
    // now permits and this rule forbids — the hazard, not an approximation of it.
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.municipality_id} ${r.fiscal_year} ${r.dataset_type}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const pair = [...groups.values()].find((g) => g.length > 1
      && g[0].basis !== g[1].basis
      && (g[0].period_label ?? '') === (g[1].period_label ?? ''));
    if (!pair) {
      console.error('  ❌ no same-period pair with differing basis found to mutate.');
      process.exit(1);
    }

    const victim = { ...pair[1], basis: pair[0].basis };
    const mutated = rows.map((r) => (r === pair[1] ? victim : r));

    console.log(`  flipped ONE row in memory: ${victim.name}, FY${victim.fiscal_year} ${victim.dataset_type}`);
    console.log(`    period_label = ${victim.period_label ?? '(null)'}`);
    console.log(`    basis        ${pair[1].basis} → ${victim.basis}`);

    const after = classifyDuplicates(findIllegalDuplicates(mutated)).illegal;
    const hit = after.find((d) => d.municipality_id === victim.municipality_id
      && d.fiscal_year === victim.fiscal_year && d.dataset_type === victim.dataset_type);

    console.log(`\n  detector output with the mutation present: ${after.length} illegal group(s)`);
    report(after);

    const exactlyOne = after.length === illegal.length + 1;
    if (!hit || !exactlyOne) {
      console.error('\n  ❌ MUTATION TEST FAILED: the detector did not report exactly the mutated city-year.');
      console.error(`     expected ${illegal.length + 1} group(s), got ${after.length}; target found: ${Boolean(hit)}`);
      process.exit(1);
    }
    console.log('\n  ✅ the detector reported exactly the mutated city-year, and nothing else.');
    console.log('     No write occurred, so there is nothing to roll back.');
  }

  if (illegal.length > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
