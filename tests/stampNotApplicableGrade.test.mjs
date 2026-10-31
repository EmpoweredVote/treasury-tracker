import { describe, it, expect } from 'vitest';
import { planNotApplicable, NOT_APPLICABLE_DATASET_TYPES } from '../scripts/stampNotApplicableGrade.mjs';

/**
 * ⭐ AUDIT-GRADE UI §5.4 — Chris's call, 2026-10-30: "not_applicable value —
 * salaries aren't financial statements."
 *
 * ⚠⚠ THIS STAMP IS A `dataset_type` FACT AND CANNOT GO THROUGH
 * scripts/stampAuditGrade.mjs. That script is registry-driven and refuses any
 * row without a `source_url` — and 7,753 of these 7,932 rows (97.7%) have none,
 * because a payroll extract has no justifying document to cite. Every other
 * grade answers "what did the PUBLISHER do"; this one answers "what KIND of
 * record is this", and the row already says.
 */
describe('planNotApplicable', () => {
  it('claims every salaries and transactions row', () => {
    expect(planNotApplicable([
      { id: 'a', dataset_type: 'salaries', audit_grade: 'unknown' },
      { id: 'b', dataset_type: 'transactions', audit_grade: 'unknown' },
    ])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  // ⚠⚠ THE DESTRUCTIVE DIRECTION. A statement row carrying this value would deny
  // that the audit question applies to a financial statement — the one kind of
  // record where it always does — and would erase a real gap from every coverage
  // figure Treasury Tracker publishes.
  it('never claims a statement row, whatever grade it carries', () => {
    expect(planNotApplicable([
      { id: 'c', dataset_type: 'operating', audit_grade: 'unknown' },
      { id: 'd', dataset_type: 'revenue', audit_grade: 'self_reported_unaudited' },
      { id: 'e', dataset_type: 'federal_agency', audit_grade: 'unknown' },
      { id: 'f', dataset_type: 'all_funds_requirements', audit_grade: 'unknown' },
    ])).toEqual([]);
  });

  // The script is re-runnable: a second pass must plan nothing rather than
  // rewriting 7,932 rows. A no-op UPDATE still touches the row.
  it('is idempotent', () => {
    expect(planNotApplicable([
      { id: 'g', dataset_type: 'salaries', audit_grade: 'not_applicable' },
    ])).toEqual([]);
  });

  // ⚠ It does NOT require a source_url, and that is the whole reason it exists
  // separately. The database agrees: migration 20261030000000 exempts this value
  // from budgets_graded_rows_need_a_source_url, because it makes no positive
  // claim about assurance.
  it('claims a row with no source_url at all', () => {
    expect(planNotApplicable([
      { id: 'h', dataset_type: 'salaries', audit_grade: 'unknown', source_url: null },
      { id: 'i', dataset_type: 'salaries', audit_grade: 'unknown', source_url: '' },
    ])).toEqual([{ id: 'h' }, { id: 'i' }]);
  });

  // A row whose dataset_type the API has not told us about is left alone. The
  // destructive direction here is "assert", never "skip".
  it('leaves a row with no dataset_type alone', () => {
    expect(planNotApplicable([
      { id: 'j', audit_grade: 'unknown' },
      { id: 'k', dataset_type: null, audit_grade: 'unknown' },
    ])).toEqual([]);
  });

  it('names exactly the two non-statement dataset types', () => {
    expect([...NOT_APPLICABLE_DATASET_TYPES].sort()).toEqual(['salaries', 'transactions']);
  });
});
