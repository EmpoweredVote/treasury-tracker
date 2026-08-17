#!/usr/bin/env node
/**
 * SCOPE-01 Task 7 — the duplicate-scope detector.
 *
 * Reports any (municipality, fiscal_year, dataset_type) holding more than one
 * distinct `fund_scope`.
 *
 * ⚠ IT MUST READ ZERO TODAY. The unique index still forbids two rows per
 * (municipality_id, fiscal_year, dataset_type, period_label), so more than one
 * scope for a city-year is currently impossible. The guard is built now PRECISELY
 * because it should read zero now -- a guard first exercised on the data it is
 * meant to police is a guard nobody has tested. SCOPE-02 moves it off zero
 * deliberately when it widens the index.
 *
 * Because "reads zero" is unfalsifiable on its own, `--mutation-test` proves the
 * detector can actually fire: it injects a synthetic second scope into a REAL
 * city-year group in memory and asserts exactly that group is reported. No write,
 * so no risk to production data and nothing to roll back.
 *
 * NOTE the grouping deliberately excludes `period_label`. The only real
 * multi-row city-years in the table today are the federal FY1976 Transition
 * Quarter pairs; grouping by period_label as well would put them in separate
 * buckets and make the TQ double-count hazard invisible by construction.
 *
 * Usage:
 *   node scripts/verify-scope-duplicates.mjs
 *   node scripts/verify-scope-duplicates.mjs --mutation-test
 */

import { parseArgs } from 'node:util';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';
import { findDuplicateScopes } from './lib/scopeVerify.mjs';
import { SCOPE } from './lib/fundScope.mjs';

function report(dupes) {
  for (const d of dupes) {
    console.log(`  ${(`${d.name}, ${d.state}`).padEnd(26)} FY${d.fiscal_year} ${d.dataset_type.padEnd(16)} `
      + `${d.rows} rows, scopes [${d.scopes.join(', ')}]`);
    for (const r of d.detail) {
      console.log(`      ${r.fund_scope.padEnd(20)} period=${String(r.period_label ?? '(null)').padEnd(34)} `
        + `$${Number(r.total_budget).toLocaleString()}  ${String(r.data_source).slice(0, 46)}`);
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: { 'mutation-test': { type: 'boolean', default: false } } });

  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  console.log(`read ${rows.length.toLocaleString()} rows`);

  const dupes = findDuplicateScopes(rows);
  console.log(`\n── live table ──`);
  if (dupes.length === 0) {
    console.log('  ✅ ZERO city-years hold more than one fund_scope — as expected while the unique index is unwidened.');
  } else {
    console.log(`  ❌ ${dupes.length} city-year(s) hold more than one fund_scope:`);
    report(dupes);
  }

  if (values['mutation-test']) {
    console.log('\n── mutation test: can the detector actually fire? ──');

    // Pick a real city-year that genuinely has more than one row, so the injected
    // duplicate is shaped like the hazard SCOPE-02 will create rather than like a
    // fixture. Falls back to cloning any row if no multi-row group exists.
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.municipality_id} ${r.fiscal_year} ${r.dataset_type}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const multi = [...groups.values()].find((g) => g.length > 1);
    const target = multi ?? [rows[0], { ...rows[0], period_label: '(synthetic second row)' }];

    const mutated = rows.map((r) => r);
    const victimIdx = mutated.indexOf(target[1]);
    const victim = { ...target[1], fund_scope: target[0].fund_scope === SCOPE.ALL_FUNDS ? SCOPE.GENERAL_FUND : SCOPE.ALL_FUNDS };
    if (victimIdx >= 0) mutated[victimIdx] = victim; else mutated.push(victim);

    console.log(`  flipped ONE row in memory: ${victim.name}, FY${victim.fiscal_year} ${victim.dataset_type}`);
    console.log(`    period_label = ${victim.period_label ?? '(null)'}`);
    console.log(`    fund_scope   ${target[1].fund_scope} → ${victim.fund_scope}`);

    const after = findDuplicateScopes(mutated);
    const hit = after.find((d) => d.municipality_id === victim.municipality_id
      && d.fiscal_year === victim.fiscal_year && d.dataset_type === victim.dataset_type);

    console.log(`\n  detector output with the mutation present: ${after.length} group(s)`);
    report(after);

    const exactlyOne = after.length === dupes.length + 1;
    if (!hit || !exactlyOne) {
      console.error('\n  ❌ MUTATION TEST FAILED: the detector did not report exactly the mutated city-year.');
      console.error(`     expected ${dupes.length + 1} group(s), got ${after.length}; target found: ${Boolean(hit)}`);
      process.exit(1);
    }
    console.log('\n  ✅ the detector reported exactly the mutated city-year, and nothing else.');
    console.log('     No write occurred, so there is nothing to roll back.');
  }

  if (dupes.length > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
