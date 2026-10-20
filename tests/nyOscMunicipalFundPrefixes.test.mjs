import { describe, it, expect } from 'vitest';
import {
  NY_MUNICIPAL_FUND_PREFIXES as R, MUNICIPAL_GOVERNMENTAL_TYPES as GOV,
} from '../scripts/data/nyOscMunicipalFundPrefixes.mjs';
import { NY_FUND_PREFIXES } from '../scripts/data/nyOscFundPrefixes.mjs';
import { classifyPrefix } from '../scripts/lib/nyOsc.mjs';

describe('the town/village/county fund registry', () => {
  it('⚠⚠⚠ treats bare S (Workers\' Compensation) as PROPRIETARY, not as the S_ family', () => {
    // THE TRAP, and it is one letter wide. `S_` is Special Districts and is
    // GOVERNMENTAL. Bare `S` is Workers' Compensation and is PROPRIETARY. ARM
    // ch. 4: "Workers Compensation Fund (S) ... should be reported as an
    // internal service fund." It carries 6,214 revenue/expenditure lines in
    // all 31 years, counties only. Classified by its letter it would inflate
    // every New York county's Total Governmental for the entire series.
    expect(R.S.type).toBe('internal_service');
    expect(GOV.has(R.S.type)).toBe(false);
    expect(R.S.name).toBe("Workers' Compensation");

    // ...while every two-letter S_ fund IS governmental.
    for (const p of ['SD', 'SF', 'SL', 'SM', 'SP', 'SR', 'SS', 'ST', 'SW']) {
      expect(R[p].type, p).toBe('special_revenue');
      expect(GOV.has(R[p].type), p).toBe(true);
    }
  });

  it('⚠ SP is Park and ST is Public Parking — the opposite of what CP/EP invite', () => {
    expect(R.SP.name).toBe('Special District — Park');
    expect(R.ST.name).toBe('Special District — Public Parking');
    // The pattern that makes the mistake tempting:
    expect(R.CP.name).toBe('Parking');
    expect(R.EP.name).toBe('Parking');
  });

  it('⚠ B is SPECIAL REVENUE, not a second general fund', () => {
    // `General Fund Town-Outside-Village (B)` carries "General Fund" in its own
    // name, and the ARM still prints it under "Special Revenue Funds include -".
    // Treating it as `general` would put 259,199 lines of part-town money into
    // every village-containing town's General Fund and make that town
    // incomparable with a village-free one.
    expect(R.B.type).toBe('special_revenue');
    expect(R.B.name).toContain('Town-Outside-Village');
    expect(GOV.has(R.B.type)).toBe(true);
  });

  it('classifies the highway and county-road block as governmental', () => {
    for (const p of ['D', 'DA', 'DB', 'DM']) {
      expect(R[p].type, p).toBe('special_revenue');
      expect(GOV.has(R[p].type), p).toBe(true);
    }
  });

  it('⚠⚠ leaves CS, EB, C, F and T UNCLASSIFIED, so their entity-years blank', () => {
    // None is in the 2021 ARM. `CS` in particular was investigated for the
    // cities and the obvious fix (CS was renamed MS) TESTED AND DISPROVED.
    // An entry is created when its evidence is.
    for (const p of ['CS', 'EB', 'C', 'F', 'T']) {
      expect(Object.hasOwn(R, p), p).toBe(false);
      expect(classifyPrefix(p, R), p).toBeNull();
    }
  });

  it('every entry carries a type, a name and a real ARM citation', () => {
    const TYPES = new Set(['general', 'special_revenue', 'capital_projects', 'debt_service',
      'permanent', 'enterprise', 'internal_service', 'fiduciary', 'schedule']);
    for (const [p, e] of Object.entries(R)) {
      expect(TYPES.has(e.type), `${p} type ${e.type}`).toBe(true);
      expect(e.name, p).toBeTruthy();
      // ⚠ Not merely non-empty: a citation that does not name the manual is a
      // placeholder, and the whole registry exists so a guess cannot reach the
      // database wearing evidence.
      expect(e.citation, p).toMatch(/Accounting and Reporting Manual/);
      expect(e.citation.length, p).toBeGreaterThan(60);
    }
  });

  it('⭐ reproduces the CITY registry wherever the two overlap', () => {
    // The ch. 5 table was read by glyph coordinates because `pdftotext -layout`
    // scrambles it. THIS is the check that the alignment is right: the city
    // registry was built independently from ch. 4 PROSE, so agreement on every
    // shared code is 25 independent confirmations of one reading.
    const shared = Object.keys(R).filter((p) => Object.hasOwn(NY_FUND_PREFIXES, p));
    expect(shared.length).toBeGreaterThanOrEqual(25);
    for (const p of shared) {
      expect(R[p].type, `${p} type disagrees with the city registry`)
        .toBe(NY_FUND_PREFIXES[p].type);
    }
  });

  it('⚠ the governmental type set is declared separately from the cities\'', () => {
    // Identical membership today, separate constants on purpose: the two
    // publications are allowed to diverge and a shared constant would make a
    // future divergence invisible.
    expect([...GOV].sort()).toEqual(
      ['capital_projects', 'debt_service', 'general', 'permanent', 'special_revenue']);
  });

  it('the registry is frozen, and classifyPrefix cannot be fooled by the prototype', () => {
    expect(Object.isFrozen(R)).toBe(true);
    // `registry['constructor']` returns a truthy inherited value under a bare
    // index and would escape the null check.
    expect(classifyPrefix('constructor', R)).toBeNull();
    expect(classifyPrefix('toString', R)).toBeNull();
  });
});
