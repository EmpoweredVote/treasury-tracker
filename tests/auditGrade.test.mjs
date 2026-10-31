import { describe, it, expect } from 'vitest';
import {
  AUDIT_GRADE,
  AUDIT_GRADE_VALUES,
  classifyAxis,
} from '../scripts/lib/budgetAxes.mjs';

describe('AUDIT_GRADE vocabulary', () => {
  // ⚠ The ORDER is asserted, not just the membership: the ladder runs
  // strongest-assurance-first and `audited_ocboa` belongs directly below
  // `audited_gaap` — same independent opinion, different measurement basis.
  it('has exactly the six spec values, the five assurance values first', () => {
    expect(AUDIT_GRADE_VALUES).toEqual([
      'audited_gaap',
      'audited_ocboa',
      'compiled_from_audited',
      'self_reported_unaudited',
      'unknown',
      // ⚠ OFF THE LADDER, not at the bottom of it — see the
      // not-a-financial-statement test below.
      'not_applicable',
    ]);
  });

  // Added with Brown County SD (Knight session 8). Before it, an entity that is
  // genuinely audited on a NON-GAAP basis had no honest value: `audited_gaap`
  // asserts a basis its own document denies, `unknown` claims nobody looked, and
  // `self_reported_unaudited` denies the audit.
  // ⭐ ADDED 2026-10-30 (AUDIT-GRADE UI §5.4). Chris's call, verbatim:
  // "not_applicable value — salaries aren't financial statements."
  //
  // ⚠⚠ IT SITS LAST AND IT IS NOT A RUNG. The order above runs
  // strongest-assurance-first, and this value is not weaker than `unknown` — it
  // is off that axis entirely. A payroll roster has no auditor to hold an
  // opinion, so the question is INAPPLICABLE rather than unanswered (#198).
  // Appending it also keeps every existing index stable.
  it('can express a record that is not a financial statement', () => {
    expect(AUDIT_GRADE.NOT_APPLICABLE).toBe('not_applicable');
    expect(AUDIT_GRADE_VALUES).toEqual([
      'audited_gaap', 'audited_ocboa', 'compiled_from_audited',
      'self_reported_unaudited', 'unknown', 'not_applicable',
    ]);
  });

  it('can express an audited non-GAAP (OCBOA) filing', () => {
    expect(AUDIT_GRADE.AUDITED_OCBOA).toBe('audited_ocboa');
    expect(AUDIT_GRADE_VALUES).toContain('audited_ocboa');
  });

  // ⚠ Assert objecthood FIRST. Object.isFrozen(undefined) is `true` in ES2015+,
  // so a bare isFrozen check passes vacuously when the export is missing entirely
  // — it went green against an unimplemented module during this task's red phase.
  it('is frozen so a caller cannot widen it at runtime', () => {
    expect(typeof AUDIT_GRADE).toBe('object');
    expect(AUDIT_GRADE).not.toBeNull();
    expect(Array.isArray(AUDIT_GRADE_VALUES)).toBe(true);
    expect(Object.isFrozen(AUDIT_GRADE)).toBe(true);
    expect(Object.isFrozen(AUDIT_GRADE_VALUES)).toBe(true);
  });
});

describe('classifyAxis on the audit-grade axis', () => {
  const evidence = { document: 'doc', figures: 'figures' };

  it('returns unknown for a source no entry matches', () => {
    const registry = [
      { id: 'x', match: /^Nope$/, value: AUDIT_GRADE.AUDITED_GAAP, evidence },
    ];
    expect(classifyAxis('Something Else', registry, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual({ value: 'unknown', entryId: null });
  });

  it('refuses to classify an entry that has no evidence', () => {
    const registry = [
      { id: 'x', match: /^Src$/, value: AUDIT_GRADE.AUDITED_GAAP },
    ];
    expect(classifyAxis('Src', registry, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual({ value: 'unknown', entryId: null });
  });

  it('classifies when the entry matches and carries evidence', () => {
    const registry = [
      { id: 'x', match: /^Src$/, value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED, evidence },
    ];
    expect(classifyAxis('Src', registry, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual({ value: 'self_reported_unaudited', entryId: 'x' });
  });
});
