import { describe, it, expect } from 'vitest';
import { readPlaceVintage, squash } from '../scripts/lib/censusVintages.mjs';

const FIX = (v) => `tests/fixtures/census/sub-est${v}-ga-places-slice.csv`;

describe('readPlaceVintage reads by header name, not by column position', () => {
  /**
   * ⚠⚠ THE 2013 LAYOUT HAS NO `PRIMGEO_FLAG`. `NAME` sits at index 7 in 2013
   * and index 8 from 2014 on. A positional read returns the STNAME column —
   * i.e. it types four Georgia governments as "Georgia". This happened during
   * the scoping probe; it failed visibly in a shell and would have failed
   * silently inside a loader.
   */
  it('reads the 2013 layout, which is one column narrower', () => {
    const places = readPlaceVintage(FIX(2013), { vintage: 2013, stateFips: '13' });
    const macon = places.get(squash('Macon city'));
    expect(macon).toBeDefined();
    expect(macon.censusName).toBe('Macon city');
    expect(macon.base).toBe('Macon');
    expect(macon.censusType).toBe('city');
    expect(macon.placeFips).toBe('49000');
    expect(macon.vintage).toBe(2013);
  });

  it('⚠ never admits the state name as a place, which a positional read would', () => {
    for (const v of [2019, 2014, 2013]) {
      const places = readPlaceVintage(FIX(v), { vintage: v, stateFips: '13' });
      expect(places.get(squash('Georgia')), `vintage ${v}`).toBeUndefined();
      for (const p of places.values()) expect(p.censusName, `vintage ${v}`).not.toBe('Georgia');
    }
  });

  it('reads the 2019 layout and takes POPESTIMATE<vintage> as the population', () => {
    const places = readPlaceVintage(FIX(2019), { vintage: 2019, stateFips: '13' });
    const ranger = places.get(squash('Ranger town'));
    expect(ranger.censusType).toBe('town');
    expect(ranger.placeFips).toBe('63560');
    expect(Number.isInteger(ranger.population)).toBe(true);
  });

  it('⚠ EXCLUDES SUMLEV 157 `(pt.)` rows, which would become places of their own', () => {
    const places = readPlaceVintage(FIX(2019), { vintage: 2019, stateFips: '13' });
    for (const v of places.values()) expect(v.censusName).not.toMatch(/\(pt\.\)/);
    expect(places.get(squash('McRae-Helena city'))).toBeDefined();
  });

  it('throws, rather than returning nonsense, when a column it needs is absent', () => {
    expect(() => readPlaceVintage(FIX(2013), { vintage: 2024, stateFips: '13' }))
      .toThrow(/no POPESTIMATE2024 column/);
  });

  it('⚠ asserts the space-squash is unambiguous IN THIS vintage, not in 2024', () => {
    // Measured safe across Vintage 2024's 537 places. An older roster has
    // different membership, so it gets its own assertion rather than inheriting one.
    for (const v of [2019, 2014, 2013]) {
      const places = readPlaceVintage(FIX(v), { vintage: v, stateFips: '13' });
      const seen = new Map();
      for (const p of places.values()) {
        const k = squash(p.censusName);
        expect(seen.has(k), `vintage ${v} squash collision: ${p.censusName} vs ${seen.get(k)}`).toBe(false);
        seen.set(k, p.censusName);
      }
      expect(places.size).toBeGreaterThan(500);
    }
  });
});
