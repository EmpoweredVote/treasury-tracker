import { describe, it, expect } from 'vitest';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from '../scripts/data/nyOscSchoolFundPrefixes.mjs';
import { NY_FUND_PREFIXES } from '../scripts/data/nyOscFundPrefixes.mjs';

describe('the district fund registry', () => {
  it('⚠ treats C (School Food Service) as GOVERNMENTAL', () => {
    // THE TRAP. For a CITY, food service sits in an E_ enterprise fund and is
    // EXCLUDED from total_governmental. The district manual puts "School Food
    // Service Programs  C" under Special Revenue, which is governmental and
    // INCLUDED. 278,779 rows ride on this one letter.
    expect(NY_SCHOOL_FUND_PREFIXES.C.type).toBe('special_revenue');
    expect(SCHOOL_GOVERNMENTAL_TYPES.has(NY_SCHOOL_FUND_PREFIXES.C.type)).toBe(true);
  });

  it('classifies every fund the manual names', () => {
    const expected = {
      A: 'general', C: 'special_revenue', CM: 'special_revenue',
      F: 'special_revenue', L: 'special_revenue',
      H: 'capital_projects', PN: 'permanent', V: 'debt_service',
      TC: 'fiduciary', TE: 'fiduciary',
    };
    for (const [p, type] of Object.entries(expected)) {
      expect(NY_SCHOOL_FUND_PREFIXES[p]?.type, p).toBe(type);
    }
    expect(Object.keys(NY_SCHOOL_FUND_PREFIXES).sort())
      .toEqual(Object.keys(expected).sort());
  });

  it('excludes exactly the two fiduciary funds', () => {
    for (const p of ['TC', 'TE']) {
      expect(SCHOOL_GOVERNMENTAL_TYPES.has(NY_SCHOOL_FUND_PREFIXES[p].type), p).toBe(false);
    }
    const govt = Object.entries(NY_SCHOOL_FUND_PREFIXES)
      .filter(([, e]) => SCHOOL_GOVERNMENTAL_TYPES.has(e.type)).map(([p]) => p).sort();
    expect(govt).toEqual(['A', 'C', 'CM', 'F', 'H', 'L', 'PN', 'V']);
  });

  it('has NO enterprise or internal service funds at all', () => {
    // The city registry's largest exclusion class does not exist for districts.
    const types = new Set(Object.values(NY_SCHOOL_FUND_PREFIXES).map((e) => e.type));
    expect(types.has('enterprise')).toBe(false);
    expect(types.has('internal_service')).toBe(false);
  });

  it('does NOT register the retired codes', () => {
    // CS, TN and B occur in FY1995-2012 and are absent from the manual's table.
    for (const p of ['CS', 'TN', 'B']) {
      expect(NY_SCHOOL_FUND_PREFIXES[p], p).toBeUndefined();
    }
  });

  it('carries a manual citation on every entry', () => {
    for (const [p, e] of Object.entries(NY_SCHOOL_FUND_PREFIXES)) {
      expect(e.citation, `${p} has no citation`).toBeTruthy();
      expect(e.citation.length, `${p} citation is a placeholder`).toBeGreaterThan(12);
      expect(e.citation, `${p} cites the wrong manual`).toMatch(/School Districts/i);
    }
  });

  it('is a SEPARATE table from the city registry, and disagrees with it', () => {
    // Same letter, different answer. Merging the two tables would have to pick
    // one, and either choice is wrong for half the state.
    expect(NY_FUND_PREFIXES.C).toBeUndefined();            // cities have no bare C
    expect(NY_FUND_PREFIXES.EL.type).toBe('enterprise');   // a city's refuse fund
    expect(NY_SCHOOL_FUND_PREFIXES.C.type).toBe('special_revenue');
    expect(NY_SCHOOL_FUND_PREFIXES.EL).toBeUndefined();    // districts have no E_
  });
});
