/**
 * Census FIPS geoid matching — the rules that decide which government a TT
 * entity is, keyed the way every other civic dataset keys it.
 *
 * ⚠⚠ THE CASE THIS FILE EXISTS FOR is the Michigan `Adrian` regression further
 * down: in an MCD state an incorporated CITY is also a county subdivision, so
 * "Adrian city" and "Adrian township" are BOTH SUMLEV-061 rows in Lenawee
 * County. Normalising the designator away collapses them, and the matcher then
 * has two candidate geoids for one township — measured at 105 such collisions
 * in Michigan alone, each one a chance to hand a township a city's geoid.
 *
 * Fixtures are COMMITTED (tests/fixtures/census/), never read from `cache/`,
 * which is gitignored — a test pointed at cache/ passes on the machine that
 * happens to have the file and silently never runs anywhere else.
 */

import { describe, it, expect } from 'vitest';
import { readPepCsv, SUMLEV } from '../scripts/lib/censusPep.mjs';
import { STATE_FIPS, resolveState } from '../scripts/lib/geoid.mjs';

describe('STATE_FIPS', () => {
  it('has exactly 50 states', () => {
    expect(Object.keys(STATE_FIPS)).toHaveLength(50);
  });

  it('is 2-digit zero-padded text, never a number', () => {
    for (const [abbrev, fips] of Object.entries(STATE_FIPS)) {
      expect(typeof fips, abbrev).toBe('string');
      expect(fips, abbrev).toMatch(/^\d{2}$/);
    }
    expect(STATE_FIPS.AL).toBe('01'); // the leading zero survives
  });

  it('has no duplicate FIPS codes', () => {
    const seen = new Set(Object.values(STATE_FIPS));
    expect(seen.size).toBe(50);
  });

  // ⚠ The point of this test: the table is checked AGAINST Census, not merely
  // asserted. A guard that keeps its own unverified copy of a list cannot catch
  // the list being wrong.
  //
  // ⚠⚠ It reads a COMMITTED FIXTURE, not cache/. `cache/` is gitignored
  // (.gitignore:121), so a test pointed there passes here and fails on a clean
  // checkout and in CI — a guard that does not run. The fixture is one
  // SUMLEV-050 row per state, so all 50 are still verified, offline.
  it('every FIPS matches the Census national county file', () => {
    const rows = readPepCsv('tests/fixtures/census/co-est2024-state-slice.csv');
    const fipsByStateName = new Map();
    for (const r of rows) {
      if (r.SUMLEV !== SUMLEV.county) continue;
      fipsByStateName.set(r.STNAME, r.STATE);
    }
    const NAMES = {
      AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
      CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
      HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
      KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
      MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
      MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
      NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
      NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
      OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
      SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
      VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin',
      WY: 'Wyoming',
    };
    for (const [abbrev, fips] of Object.entries(STATE_FIPS)) {
      expect(fipsByStateName.get(NAMES[abbrev]), abbrev).toBe(fips);
    }
  });
});

describe('resolveState', () => {
  it('resolves a known abbreviation', () => {
    expect(resolveState('IN')).toEqual({
      geoid: '18', basis: 'static-state-fips', reason: null,
    });
  });

  it('returns a null with a reason for an unknown abbreviation', () => {
    const r = resolveState('ZZ');
    expect(r.geoid).toBeNull();
    expect(r.basis).toBeNull();
    expect(r.reason).toBe('no state FIPS for abbrev ZZ');
  });
});
