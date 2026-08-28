import { describe, it, expect } from 'vitest';
import {
  AUDIT_GRADE,
  AUDIT_GRADE_VALUES,
  classifyAxis,
} from '../scripts/lib/budgetAxes.mjs';

describe('AUDIT_GRADE vocabulary', () => {
  it('has exactly the four spec values', () => {
    expect(AUDIT_GRADE_VALUES).toEqual([
      'audited_gaap',
      'compiled_from_audited',
      'self_reported_unaudited',
      'unknown',
    ]);
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
