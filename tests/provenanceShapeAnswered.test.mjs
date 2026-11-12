/**
 * The provenance ratchet and the records whose axes are answered by SHAPE.
 *
 * ── THE DEFECT THIS PINS ────────────────────────────────────────────────────
 *
 * `verify:provenance` failed on 2026-11-12 with seven NEW DEBT entries and one
 * WORSE, every one of them a check, payroll or demand register:
 *
 *     ❌ NEW DEBT Plano Check Register FY2026: unregistered 1, linkless 1
 *     ❌ NEW DEBT McKinney Check Register FY2026: unregistered 1, linkless 1
 *     ❌ WORSE    LA City Checkbook: unregistered 2→9
 *
 * It was not measuring debt. It was measuring the calendar.
 *
 * These family names embed the fiscal year, so every October a new year arrives
 * under a name the baseline has never seen. And the class can never be
 * registered: `stampNotApplicableGrade.mjs` answers their audit grade from
 * `dataset_type`, and `tests/auditGradeRegistry.test.mjs` PINS `not_applicable`
 * out of the registry on purpose — "a registry entry would dress a row-shape
 * fact as a publisher judgement". So the ratchet asked a registry a question
 * that registry is designed never to answer, and failed every year forever.
 *
 * ⚠ `linkless` IS STILL COUNTED, and that is the point. A payment register
 * still owes the reader a link; what it does not owe is an audit opinion.
 */
import { describe, it, expect } from 'vitest';
import {
  summarizeProvenanceDebt,
  SHAPE_ANSWERED_DATASET_TYPES,
  familyIsShapeAnswered,
  gradeDecayOf,
} from '../scripts/lib/provenanceDebt.mjs';

describe('familyIsShapeAnswered', () => {
  it('names salaries and transactions, and nothing else', () => {
    expect([...SHAPE_ANSWERED_DATASET_TYPES].sort()).toEqual(['salaries', 'transactions']);
  });

  it('is true when every row of the family is a shape-answered type', () => {
    expect(familyIsShapeAnswered(['transactions'])).toBe(true);
    expect(familyIsShapeAnswered(['salaries', 'salaries'])).toBe(true);
  });

  it('is FALSE for a statement, which must still be registered', () => {
    expect(familyIsShapeAnswered(['operating'])).toBe(false);
    expect(familyIsShapeAnswered(['revenue'])).toBe(false);
  });

  it('is FALSE for a mixed family, so one stray statement row cannot ride along', () => {
    // ⚠ ALL, never SOME. A family holding both a register and a statement owes
    // the statement's label, and `some()` here would excuse it.
    expect(familyIsShapeAnswered(['transactions', 'operating'])).toBe(false);
  });

  it('is FALSE for an empty or unknown set rather than defaulting to excused', () => {
    expect(familyIsShapeAnswered([])).toBe(false);
    expect(familyIsShapeAnswered(['something_new'])).toBe(false);
  });
});

describe('summarizeProvenanceDebt with shape-answered families', () => {
  const baseline = { sources: {} };

  it('does NOT call a cited register new debt, however new its name', () => {
    // Exactly `Plano Check Register FY2026` after it was given its publisher URL.
    const r = summarizeProvenanceDebt([{
      data_source: 'Plano Check Register FY2026',
      rows: 1, linkless: 0, unregistered: true, shapeAnswered: true,
    }], baseline);
    expect(r.added).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.totals.unregisteredRows).toBe(0);
  });

  it('STILL calls an uncited register new debt — the link is not excused', () => {
    const r = summarizeProvenanceDebt([{
      data_source: 'Somewhere Check Register FY2027',
      rows: 3, linkless: 3, unregistered: true, shapeAnswered: true,
    }], baseline);
    expect(r.added).toEqual([{
      name: 'Somewhere Check Register FY2027', unregisteredRows: 0, linkless: 3,
    }]);
    expect(r.ok).toBe(false);
  });

  it('still fails an unregistered STATEMENT family, which is the gate\'s real job', () => {
    const r = summarizeProvenanceDebt([{
      data_source: 'Somewhere ACFR — General Fund (FY2027 actual)',
      rows: 2, linkless: 0, unregistered: true, shapeAnswered: false,
    }], baseline);
    expect(r.added).toHaveLength(1);
    expect(r.ok).toBe(false);
  });

  it('lets a baselined register family grow in years without reading as WORSE', () => {
    // LA City Checkbook: one Socrata dataset, 2 fiscal years at baseline, 9 now.
    const r = summarizeProvenanceDebt(
      [{ data_source: 'LA City Checkbook', rows: 9, linkless: 0, unregistered: true, shapeAnswered: true }],
      { sources: { 'LA City Checkbook': { unregisteredRows: 2, linkless: 2 } } },
    );
    expect(r.worse).toEqual([]);
    expect(r.better).toHaveLength(1);
    expect(r.ok).toBe(true);
  });

  it('omits a shape-answered family from the unregistered TOTAL, so the headline is honest', () => {
    const r = summarizeProvenanceDebt([
      { data_source: 'A Register FY2026', rows: 5, linkless: 0, unregistered: true, shapeAnswered: true },
      { data_source: 'B ACFR', rows: 7, linkless: 0, unregistered: true, shapeAnswered: false },
    ], baseline);
    expect(r.totals.unregisteredRows).toBe(7);
    expect(r.totals.rows).toBe(12);
  });

  it('treats a missing shapeAnswered flag as NOT excused', () => {
    // ⚠ Absence must never mean permission. An older caller that does not set
    // the flag keeps the strict behaviour it had.
    const r = summarizeProvenanceDebt(
      [{ data_source: 'Legacy Family', rows: 1, linkless: 0, unregistered: true }],
      baseline,
    );
    expect(r.added).toHaveLength(1);
  });
});

/**
 * The excuse above is only honest while the shape-answered grade is actually
 * applied. If `budgets_fill_not_applicable_audit_grade` is ever dropped, these
 * rows silently return to `unknown` and the ratchet goes on excusing them —
 * which would turn a correct rule into a blindfold.
 *
 * ⚠⚠ THIS IS THE DEFECT THAT CAUSED THE ORIGINAL FAILURE, so it is the one
 * thing the repaired gate must watch. Measured 2026-11-12, thirteen days after
 * `stampNotApplicableGrade.mjs` last ran: 27 of 43 `transactions` rows had
 * decayed back to `unknown`. The sweep was never re-run and nothing noticed.
 */
describe('gradeDecayOf — the excuse must not outlive the grade', () => {
  it('counts a shape-answered row sitting at unknown', () => {
    expect(gradeDecayOf([
      { dataset_type: 'transactions', audit_grade: 'unknown' },
      { dataset_type: 'salaries', audit_grade: 'unknown' },
    ])).toBe(2);
  });

  it('counts nothing when the grade is applied', () => {
    expect(gradeDecayOf([
      { dataset_type: 'transactions', audit_grade: 'not_applicable' },
      { dataset_type: 'salaries', audit_grade: 'not_applicable' },
    ])).toBe(0);
  });

  it('ignores a statement row, whose unknown is often the honest answer', () => {
    // ⚠ 24,778 rows are honestly `unknown` on audit grade and that is CORRECT —
    // SCOPE-01 classified 33.2% as unknown rather than guess. Counting those
    // here would make the check fire constantly and be switched off.
    expect(gradeDecayOf([
      { dataset_type: 'operating', audit_grade: 'unknown' },
      { dataset_type: 'revenue', audit_grade: 'unknown' },
    ])).toBe(0);
  });

  it('counts a null grade too, which is the other spelling of nobody said', () => {
    expect(gradeDecayOf([{ dataset_type: 'transactions', audit_grade: null }])).toBe(1);
  });

  it('does not count an explicit considered grade on a register', () => {
    expect(gradeDecayOf([{ dataset_type: 'transactions', audit_grade: 'audited_gaap' }])).toBe(0);
  });

  it('is 0 for no rows at all', () => {
    expect(gradeDecayOf([])).toBe(0);
    expect(gradeDecayOf(null)).toBe(0);
  });
});
