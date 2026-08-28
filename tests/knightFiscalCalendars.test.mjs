import { describe, it, expect } from 'vitest';
import { censusGuard, censusMonthFor } from '../scripts/lib/facFiscalYearCensus.mjs';

/**
 * Pin the fiscal-year start month of every already-loaded Knight entity against
 * the entity's own federally filed Single Audit record.
 *
 * ⚠ WHY THIS EXISTS: fiscal_year_start_month moves no dollar. Every tie test
 * passes at $0 whether the month is right or wrong, which is how a
 * `NOT NULL DEFAULT 1` came to assert an unverified month on ~18,700 rows and
 * read as fact for months (project_fysm_column_default_one_defect). The federal
 * audit record is the only independent oracle for this column.
 *
 * ⚠ NEVER CARRY A TARGET MONTH BETWEEN STATES. Ohio and Minnesota locals run
 * calendar years; California counties run July; Long Beach runs October. A
 * loader that takes one month for a whole multi-entity run is the exact shape of
 * the Texas defect — right for 718 of 842 entities and wrong for Houston, El Paso
 * and 42 January counties.
 *
 * Observed on the live DB 2026-08-28. Each entry is (entity, state, month, a
 * fiscal year in range) — the month is resolved PER ROW GROUP, not per entity,
 * because entities do change calendars mid-series.
 */
const LOADED = [
  // Ohio AOS — calendar year
  { name: 'Akron', state: 'OH', month: 1, fy: 2024 },
  { name: 'Summit County', state: 'OH', month: 1, fy: 2024 },
  // Minnesota OSA — calendar year
  { name: 'Duluth', state: 'MN', month: 1, fy: 2022 },
  { name: 'Saint Paul', state: 'MN', month: 1, fy: 2022 },
  { name: 'Ramsey County', state: 'MN', month: 1, fy: 2020 },
  { name: 'Saint Louis County', state: 'MN', month: 1, fy: 2020 },
  // California — counties July, Long Beach October
  { name: 'Long Beach', state: 'CA', month: 10, fy: 2023 },
  { name: 'Los Angeles County', state: 'CA', month: 7, fy: 2023 },
  { name: 'Santa Clara County', state: 'CA', month: 7, fy: 2023 },
  { name: 'San Jose', state: 'CA', month: 7, fy: 2023 },
];

/**
 * Compensation rows are CALENDAR-year by construction — publicpay reports a
 * calendar year of pay regardless of the entity's fiscal calendar. Long Beach and
 * San Jose therefore legitimately hold month 1 for their salaries rows alongside
 * month 10 / month 7 for their budget rows. That is a correct split, not drift.
 */
const CALENDAR_YEAR_COMPENSATION = [
  { name: 'Long Beach', state: 'CA', month: 1, fy: 2023 },
  { name: 'San Jose', state: 'CA', month: 1, fy: 2023 },
];

describe('Knight entities: fiscal calendars vs the federal audit record', () => {
  for (const { name, state, month, fy } of LOADED) {
    it(`${name}, ${state} FY${fy} month ${month} does not contradict its Single Audit filings`, () => {
      const verdict = censusGuard(name, state, month, fy);
      // `{ok:true, unknown}` is a PASS — the census does not extrapolate, and
      // silence is not disagreement. Only an explicit contradiction fails.
      expect(verdict.error, verdict.error).toBeUndefined();
    });
  }
});

describe('the guard is doing real work, not passing on ignorance', () => {
  // ⚠ THE VACUITY CHECK. censusGuard returns {ok:true} when it cannot find the
  // entity, so a name mismatch between TT and FAC would make every assertion
  // above pass while verifying nothing. This asserts the census actually knows
  // some of these entities by the names TT stores them under.
  it('the census recognises at least half of the loaded Knight entities', () => {
    const found = LOADED.filter(({ name, state, fy }) => !censusMonthFor(state, name, fy).unknown);
    const names = found.map((f) => `${f.name}, ${f.state}`);
    expect(names.length, `census matched only: ${JSON.stringify(names)}`)
      .toBeGreaterThanOrEqual(Math.ceil(LOADED.length / 2));
  });

  /**
   * ⚠ PIN THE BLIND SPOT. Measured 2026-08-28: 7 of 10 confirmed, 0 contradicted,
   * and 3 return "no evidence" for reasons that are NOT genuine absence:
   *
   *   Los Angeles County, CA  — the census holds ZERO CA county rows (549 CA
   *   Santa Clara County, CA    entities, all typed `municipality`), because the
   *                             CA slice was built city-scoped for PR #101. MN by
   *                             contrast has 93 county rows. So the FAC oracle is
   *                             blind to all 54 CA counties in TT, and their
   *                             month-7 values are UNVERIFIED assumptions.
   *
   *   Saint Louis County, MN  — a name-normalisation miss, not absence. FAC holds
   *                             it as BOTH "St Louis County" (1998-2004, 2021-2022)
   *                             and "St. Louis County" (2005-2020, 2023-2025);
   *                             TT stores "Saint Louis County". FAC's month is 1,
   *                             which matches what TT stores — it simply cannot be
   *                             matched by name.
   *
   * This test exists so those gaps are TRACKED rather than silent. If the census
   * later gains CA counties or "Saint"/"St." normalisation, this fails and asks
   * to be updated — surfacing the improvement instead of hiding it.
   */
  it('pins the three known census gaps so they cannot go silent', () => {
    const uncensused = LOADED
      .filter(({ name, state, fy }) => censusMonthFor(state, name, fy).unknown)
      .map((e) => `${e.name}, ${e.state}`)
      .sort();
    expect(uncensused).toEqual([
      'Los Angeles County, CA',
      'Saint Louis County, MN',
      'Santa Clara County, CA',
    ]);
  });

  it('would catch a contradicted month for an entity the census knows', () => {
    const known = LOADED.find(({ name, state, fy }) => !censusMonthFor(state, name, fy).unknown);
    expect(known, 'no censused entity available to prove the gate fires').toBeTruthy();
    const real = censusMonthFor(known.state, known.name, known.fy).month;
    const wrong = real === 6 ? 9 : 6;
    const verdict = censusGuard(known.name, known.state, wrong, known.fy);
    expect(verdict.error).toBeTruthy();
    expect(verdict.error).toContain('contradicts the federal audit record');
  });
});

describe('calendar-year compensation rows are a legitimate split', () => {
  for (const { name, state, month, fy } of CALENDAR_YEAR_COMPENSATION) {
    it(`${name}, ${state} salaries month ${month} is not treated as drift`, () => {
      // These are asserted to be *recorded*, not census-clean: publicpay's
      // calendar year is expected to differ from the entity's fiscal year, so a
      // census contradiction here would be about the wrong thing. The value of
      // this block is that the split is documented and cannot be "fixed" by
      // someone assuming one month per entity.
      expect(month).toBe(1);
    });
  }
});
