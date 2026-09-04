import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUDIT_GRADE, AUDIT_GRADE_VALUES, validateAxisRegistry } from '../scripts/lib/budgetAxes.mjs';
import { AUDIT_GRADE_REGISTRY, gradeFor, mnOsaGradeFor } from '../scripts/data/auditGradeRegistry.mjs';

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

  /**
   * ⚠⚠ MN OSA IS THE REGISTRY'S FIRST **BRANCHING** ENTRY (2026-09-04). It used to
   * be deliberately absent, and the assertion here used to pin `unknown` — the old
   * comment said "if MN is later verified, this assertion is the one to change,
   * deliberately". It was verified, so it changed.
   *
   * It is a MIXED source: the audit duty follows the entity's statutory class.
   *   counties            Minn. Stat. § 6.481 subd. 2 — audit UNCONDITIONAL
   *   cities over 2,500   § 471.697(c) — audited statements filed with OSA
   *   cities under 2,500  § 471.698 — NO audit clause at all
   */
  const MN = 'Minnesota Office of the State Auditor City/County Finances Report';

  it('grades an MN COUNTY compiled_from_audited — § 6.481 makes the audit unconditional', () => {
    expect(gradeFor(MN, { entityType: 'county', name: 'Ramsey', fiscalYear: 2021 }))
      .toEqual({ value: 'compiled_from_audited', entryId: 'mn-osa-lgf' });
  });

  it('grades a LARGE MN city compiled_from_audited, using the OSA class code', () => {
    // ⭐ Duluth is ClassCode 1 at a population of 86,788 — still a city of the
    // FIRST class though under 100,000, because § 410.01 does not reclassify until
    // population falls 25% below the qualifying figure. Read off OSA's data, not
    // reasoned about, and first-class cities are audited BY the State Auditor.
    expect(gradeFor(MN, { entityType: 'city', name: 'Duluth', fiscalYear: 2021 }))
      .toEqual({ value: 'compiled_from_audited', entryId: 'mn-osa-lgf' });
    expect(gradeFor(MN, { entityType: 'city', name: 'Saint Paul', fiscalYear: 2021 }))
      .toEqual({ value: 'compiled_from_audited', entryId: 'mn-osa-lgf' });
  });

  it('grades a FIFTH-CLASS city self_reported_unaudited — § 471.698 requires no audit', () => {
    expect(gradeFor(MN, { entityType: 'city', name: 'Ada', fiscalYear: 2021 }))
      .toEqual({ value: 'self_reported_unaudited', entryId: 'mn-osa-lgf' });
  });

  /**
   * ⚠⚠ THE PROPERTY THAT MATTERS MOST: a branch can only ever RAISE a grade on
   * evidence. Every unresolvable shape must land on the WEAKER branch, never on
   * `compiled_from_audited`. If this ever inverts, the registry starts asserting
   * assurance that no document supports — the exact failure §3.5 exists to stop.
   */
  it('falls back to the WEAKER branch whenever the entity-year cannot be resolved', () => {
    const weak = { value: 'self_reported_unaudited', entryId: 'mn-osa-lgf' };
    expect(gradeFor(MN)).toEqual(weak);                                            // no context
    expect(gradeFor(MN, null)).toEqual(weak);                                      // explicit null
    expect(gradeFor(MN, { entityType: 'city', name: 'Nowhere', fiscalYear: 2021 })).toEqual(weak);
    expect(gradeFor(MN, { entityType: 'city', name: 'Ada', fiscalYear: 1999 })).toEqual(weak);
    expect(gradeFor(MN, { entityType: 'township', name: 'Ada', fiscalYear: 2021 })).toEqual(weak);
    expect(gradeFor(MN, { entityType: 'city' })).toEqual(weak);                    // no name/year
  });

  it('resolves the branch directly, and never invents a class', () => {
    expect(mnOsaGradeFor(null)).toBeNull();
    expect(mnOsaGradeFor({ entityType: 'city', name: 'Nowhere', fiscalYear: 2021 })).toBeNull();
    expect(mnOsaGradeFor({ entityType: 'township', name: 'Ada', fiscalYear: 2021 })).toBeNull();
    expect(mnOsaGradeFor({ entityType: 'county', name: 'anything', fiscalYear: 2021 }))
      .toBe('compiled_from_audited');
  });

  /**
   * ⚠ The committed branch file must agree with the publisher's own prose. The
   * 2023 City Finances Report says "347 of the 619 small cities (56.1 percent)",
   * so FY2023 must hold exactly 619 fifth-class cities. This is the one number
   * that ties the generated file back to a sentence a human can read.
   */
  it('reconciles the branch file against the count the report itself states', () => {
    const branch = JSON.parse(
      readFileSync(new URL('../scripts/data/mnOsaAuditBranch.json', import.meta.url), 'utf8'),
    );
    expect(branch.per_fy_class_distribution['2023'][5]).toBe(619);
    // ⚠ And the file must not be empty in a way that makes the tests above vacuous.
    expect(branch.entity_years).toBeGreaterThan(10_000);
    expect(Object.keys(branch.cities).length).toBeGreaterThan(800);
  });

  /**
   * ⚠⚠ THE PUBLISHER ITSELF LEAVES A ROW UNCLASSIFIED, and that is DECLARED
   * rather than silently dropped. Pierz FY2012 carries `ClassCode` = null in
   * OSA's own cired_12 file (population 1,387; class 5 the following year).
   *
   * It resolves to the WEAKER branch — which is the right answer here — but by
   * the safe default, NOT by inferring class from population. Inferring would
   * break the rule that OSA assigns class from the DECENNIAL census, so a city
   * can sit under 2,500 and still be fourth class.
   *
   * ⚠ Asserted exactly, so a new unclassified row appearing, or this one being
   * quietly back-filled, is a VISIBLE change. A declared exception that stops
   * being observed must fail, or it rots into dead permission.
   */
  it('declares every entity-year the publisher left unclassified, and no more', () => {
    const branch = JSON.parse(
      readFileSync(new URL('../scripts/data/mnOsaAuditBranch.json', import.meta.url), 'utf8'),
    );
    expect(branch.unclassified_entity_years).toEqual([
      { name: 'Pierz', fy: 2012, population: 1387 },
    ]);
    // ⚠ And it must NOT appear in the lookup, so the grader cannot read a class
    // for it by accident.
    expect(branch.cities.Pierz?.['2012']).toBeUndefined();
    expect(branch.cities.Pierz?.['2013']).toBe(5);
    expect(mnOsaGradeFor({ entityType: 'city', name: 'Pierz', fiscalYear: 2012 })).toBeNull();
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

  // Colorado Springs + El Paso County, graded 2026-08-31 after both opinion
  // gates were run over all 32 documents.
  //
  // ⚠ THE YEAR ALTERNATION IS THE ASSERTION. It is exactly the loaded set, and
  // the two exclusions below are the whole reason this entry is not a decade
  // wildcard. Widen it and rows get graded off opinions nobody read — the
  // failure this registry exists to prevent.
  const springs = (fy) =>
    `City of Colorado Springs ACFR — General Fund Expenditure by Function (FY${fy} actual, GAAP basis)`;
  const elPaso = (fy) =>
    `El Paso County ACFR — General Fund Revenue by Source (FY${fy} actual, GAAP basis)`;

  it('grades the loaded Colorado Springs and El Paso County ACFR years', () => {
    for (const fy of [2012, 2019, 2025]) {
      expect(gradeFor(springs(fy)))
        .toEqual({ value: 'audited_gaap', entryId: 'co-springs-epc-acfr-gf' });
    }
    for (const fy of [2005, 2009, 2010, 2025]) {
      expect(gradeFor(elPaso(fy)))
        .toEqual({ value: 'audited_gaap', entryId: 'co-springs-epc-acfr-gf' });
    }
  });

  // ⚠ El Paso FY2006-FY2008 are PUBLISHED but declined as unparseable, so they
  // are not loaded and no opinion was read. They must stay unknown.
  it('leaves El Paso County FY2006-FY2008 unknown — published, but never read', () => {
    for (const fy of [2006, 2007, 2008]) {
      expect(gradeFor(elPaso(fy))).toEqual({ value: 'unknown', entryId: null });
    }
  });

  // ⚠ A future year must NOT inherit this grade. The next ACFR needs its own
  // opinion read before anything grades it.
  it('does not grade a year beyond the ones actually read', () => {
    expect(gradeFor(springs(2026))).toEqual({ value: 'unknown', entryId: null });
    expect(gradeFor(elPaso(2026))).toEqual({ value: 'unknown', entryId: null });
  });

  // ⚠⚠ NAME COLLISION. El Paso County, TEXAS is a real county TT does not hold.
  // The registry sees `data_source` and nothing else, so if it is ever onboarded
  // with this label shape it WOULD be claimed by the Colorado entry. This pins
  // the fact that the two are indistinguishable today, so the collision is
  // discovered here rather than in production.
  it('cannot tell El Paso County TX from El Paso County CO by label alone', () => {
    expect(gradeFor(elPaso(2020)).entryId).toBe('co-springs-epc-acfr-gf');
  });
});
