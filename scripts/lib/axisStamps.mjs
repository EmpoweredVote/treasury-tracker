/**
 * Did the stamp actually LAND?
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs. A `#!` on any module a test
 * imports breaks `npm test` on Windows.
 *
 * ⚠⚠ THE HOLE THIS CLOSES. Every partition gate in this repo answers "does
 * each registry entry claim the number of rows we measured?" — `planAxis` in
 * scripts/stampBudgetAxes.mjs and `checkPartition` in scripts/lib/fundScope.mjs
 * both build their tallies from the `data_source` STRING. Neither reads the
 * axis column. So a row can match an entry, be counted toward `wa-sao: 328`,
 * pass every gate, and hold `unknown`.
 *
 * That is not hypothetical and it is not rare. Duvall FY2016-FY2019 were
 * reloaded to repair a label AFTER the stampers had run, and the 8 recreated
 * rows carried `unknown` on ALL FIVE axes while `npm test` (2715), both Python
 * selftests (277) and all three partition gates stayed green — including the
 * one reporting 328. A reader opening those four years was told "Audit status
 * not established — we have not yet checked what assurance stands behind this
 * figure" about a figure read out of an audited WA SAO report whose split
 * opinion is transcribed into scripts/data/auditGradeRegistry.mjs.
 *
 * ⚠ A LOAD IS NOT A STAMP. Any delete-and-reinsert silently un-stamps its own
 * rows, because the new rows are new rows. This repo has now lost state that
 * way twice — the EV financials refresh is the other, and it is recorded in
 * the memory index as re-injecting new ids on every run.
 *
 * Usage:
 *   node scripts/verifyAxisStamps.mjs            # all five axes, whole table
 *   node scripts/verifyAxisStamps.mjs --like "WA State Auditor — Duvall%"
 */
import { classifyAxis, BASIS, BASIS_VALUES, REPORTING_ENTITY, REPORTING_ENTITY_VALUES,
  AUDIT_GRADE, AUDIT_GRADE_VALUES, ACCOUNTING_BASIS, ACCOUNTING_BASIS_VALUES } from './budgetAxes.mjs';
import { SCOPE, SCOPE_VALUES } from './fundScope.mjs';
import { BASIS_REGISTRY } from '../data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from '../data/reportingEntityRegistry.mjs';
import { AUDIT_GRADE_REGISTRY } from '../data/auditGradeRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../data/accountingBasisRegistry.mjs';
import { FUND_SCOPE_REGISTRY } from '../data/fundScopeRegistry.mjs';

/**
 * Every axis, so a new one cannot be added without this check covering it.
 *
 * ⚠ `fund_scope`'s registry keys its value on `scope`, not `value`, so its
 * entries are projected onto the shared shape rather than special-cased here —
 * one classification rule, five axes.
 */
export const AXES = Object.freeze([
  { column: 'basis', registry: BASIS_REGISTRY, legal: BASIS_VALUES, unknown: BASIS.UNKNOWN },
  {
    column: 'reporting_entity',
    registry: REPORTING_ENTITY_REGISTRY,
    legal: REPORTING_ENTITY_VALUES,
    unknown: REPORTING_ENTITY.UNKNOWN,
  },
  { column: 'audit_grade', registry: AUDIT_GRADE_REGISTRY, legal: AUDIT_GRADE_VALUES, unknown: AUDIT_GRADE.UNKNOWN },
  {
    column: 'accounting_basis',
    registry: ACCOUNTING_BASIS_REGISTRY,
    legal: ACCOUNTING_BASIS_VALUES,
    unknown: ACCOUNTING_BASIS.UNKNOWN,
  },
  {
    column: 'fund_scope',
    registry: FUND_SCOPE_REGISTRY.map((e) => ({ ...e, value: e.scope })),
    legal: SCOPE_VALUES,
    unknown: SCOPE.UNKNOWN,
  },
]);

/**
 * Rows whose `data_source` classifies to a value their column does not hold.
 *
 * ⚠ A row NO entry claims is not reported. 65,397 rows match nothing and are
 * left alone by the stampers deliberately — reporting them would bury the real
 * finding under noise, which is how a gate stops being read.
 *
 * ⚠ A row stamped with the WRONG value is reported alongside an unstamped one.
 * A stale stamp left by a registry change is the same defect and strictly
 * harder to notice than a missing one.
 *
 * ⚠ An entry carrying a `branch` is skipped: its expected value is per-row
 * (Minnesota resolves a statutory class per city-year) and cannot be decided
 * from the data_source alone, so asserting the entry's base value here would
 * report every correctly-branched row as wrong. Named in the result so the
 * narrowing is never silent.
 */
export function unstampedRows(rows, registry, legalValues, unknownValue, column) {
  const out = [];
  const branching = new Set(registry.filter((e) => typeof e?.branch === 'function').map((e) => e.id));
  for (const row of rows ?? []) {
    const { value, entryId } = classifyAxis(row.data_source, registry, legalValues, unknownValue);
    if (!entryId) continue;              // nothing claims this row
    if (branching.has(entryId)) continue; // per-row expectation; see above
    const actual = row[column] ?? null;
    if (actual === value) continue;
    out.push({ id: row.id, dataSource: row.data_source, entryId, expected: value, actual, column });
  }
  return out;
}

/** The branching entries this check cannot speak for, for honest reporting. */
export function branchingEntryIds(registry) {
  return registry.filter((e) => typeof e?.branch === 'function').map((e) => e.id);
}
