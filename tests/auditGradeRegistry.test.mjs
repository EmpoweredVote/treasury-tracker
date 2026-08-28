import { describe, it, expect } from 'vitest';
import { AUDIT_GRADE, AUDIT_GRADE_VALUES, validateAxisRegistry } from '../scripts/lib/budgetAxes.mjs';
import { AUDIT_GRADE_REGISTRY, gradeFor } from '../scripts/data/auditGradeRegistry.mjs';

describe('audit grade registry', () => {
  it('is structurally valid', () => {
    const result = validateAxisRegistry(AUDIT_GRADE_REGISTRY, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN);
    expect(result.ok).toBe(true);
    expect(result.unevidenced).toEqual([]);
    expect(result.duplicateIds).toEqual([]);
    expect(result.badValues).toEqual([]);
    expect(result.badMatches).toEqual([]);
    expect(result.missingIds).toBe(0);
  });

  it('every entry carries non-placeholder evidence', () => {
    expect(AUDIT_GRADE_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of AUDIT_GRADE_REGISTRY) {
      expect(entry.evidence.document.trim().length, entry.id).toBeGreaterThan(20);
      expect(entry.evidence.figures.trim().length, entry.id).toBeGreaterThan(20);
      expect(entry.evidence.document.toUpperCase(), entry.id).not.toContain('TODO');
      expect(entry.evidence.document.toUpperCase(), entry.id).not.toContain('TBD');
      expect(entry.evidence.figures.toUpperCase(), entry.id).not.toContain('TODO');
      expect(entry.evidence.figures.toUpperCase(), entry.id).not.toContain('TBD');
    }
  });

  it('has unique ids', () => {
    const ids = AUDIT_GRADE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('gradeFor', () => {
  it('grades the Ohio AOS summarized reports as self-reported', () => {
    expect(gradeFor('Ohio Auditor of State Summarized Annual Financial Reports'))
      .toEqual({ value: 'self_reported_unaudited', entryId: 'oh-aos-summarized' });
  });

  it('grades both CA SCO city series as self-reported', () => {
    expect(gradeFor('CA State Controller - Expenditures'))
      .toEqual({ value: 'self_reported_unaudited', entryId: 'ca-sco-city-exp' });
    expect(gradeFor('CA State Controller - Revenues'))
      .toEqual({ value: 'self_reported_unaudited', entryId: 'ca-sco-city-rev' });
  });

  // ⚠ THE ANCHORING TRAP, pinned. /^CA State Controller/ also matches the
  // publicpay compensation source, which no audit evidence covers. SCOPE-01 lost
  // a task to this; it fired again during this campaign's own scoping, where a
  // `like 'CA State Controller%'` query counted San Jose's 16 publicpay rows and
  // hid the fact that its entire SCO series was missing.
  it('does NOT classify the publicpay compensation source', () => {
    const publicpay = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';
    expect(gradeFor(publicpay)).toEqual({ value: 'unknown', entryId: null });
  });

  // ⚠ MN OSA is DELIBERATELY absent from the registry. Three publisher pages were
  // checked on 2026-08-28 and none states what the Finances Report is compiled
  // from or whether it is audited. "Probably self-reported" is inference, and
  // spec §3.5 forbids classifying on inference. See KNIGHT-COMMUNITIES-PROGRESS.md.
  // If MN is later verified, this assertion is the one to change — deliberately.
  it('leaves the MN OSA report unknown, because its audit status is unverified', () => {
    expect(gradeFor('Minnesota Office of the State Auditor City/County Finances Report'))
      .toEqual({ value: 'unknown', entryId: null });
  });

  it('returns unknown for an unregistered source', () => {
    expect(gradeFor('Some City Adopted Budget FY2026')).toEqual({ value: 'unknown', entryId: null });
  });

  it('returns unknown for null, undefined and empty input', () => {
    expect(gradeFor(null)).toEqual({ value: 'unknown', entryId: null });
    expect(gradeFor(undefined)).toEqual({ value: 'unknown', entryId: null });
    expect(gradeFor('')).toEqual({ value: 'unknown', entryId: null });
    expect(gradeFor('   ')).toEqual({ value: 'unknown', entryId: null });
  });

  // A near-miss must not classify: the SCO patterns are anchored at both ends.
  it('does not classify a source that merely contains a registered name', () => {
    expect(gradeFor('Archived CA State Controller - Expenditures (superseded)'))
      .toEqual({ value: 'unknown', entryId: null });
  });
});
