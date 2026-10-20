import { existsSync } from 'node:fs';

import { describe, it, expect } from 'vitest';
import {
  readPlaceVintage, squash, resolvePlace, loadLadder, DEFAULT_LADDER,
} from '../scripts/lib/censusVintages.mjs';
import { auditState } from '../scripts/auditCensusVintageGaps.mjs';

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

const V2024 = 'tests/fixtures/census/sub-est2024-ga-places-slice.csv';
const ladders = [2024, 2019, 2014, 2013].map((v) => ({
  vintage: v,
  places: readPlaceVintage(v === 2024 ? V2024 : FIX(v), { vintage: v, stateFips: '13' }),
}));

describe('the ladder stops at the newest vintage that names the government', () => {
  it('resolves all seven held-out Georgia municipalities to exact triples', () => {
    const expected = {
      'Ranger Town':     { entityType: 'town', placeFips: '63560', vintage: 2019 },
      'Sunny Side City': { entityType: 'city', placeFips: '74572', vintage: 2019 },
      'Helena City':     { entityType: 'city', placeFips: '37816', vintage: 2014 },
      'McRae City':      { entityType: 'city', placeFips: '49084', vintage: 2014 },
      'Payne City':      { entityType: 'city', placeFips: '59584', vintage: 2014 },
      'Riverside Town':  { entityType: 'town', placeFips: '65604', vintage: 2014 },
      'Macon City':      { entityType: 'city', placeFips: '49000', vintage: 2013 },
    };
    for (const [dcaName, want] of Object.entries(expected)) {
      const r = resolvePlace(dcaName, { ladders });
      expect(r.why, dcaName).toBeUndefined();
      expect({ entityType: r.entityType, placeFips: r.placeFips, vintage: r.vintage }, dcaName).toEqual(want);
    }
  });

  it('⚠ a live government still resolves at 2024 — the ladder changes nothing for it', () => {
    const r = resolvePlace('Atlanta City', { ladders });
    expect(r.vintage).toBe(2024);
    expect(r.entityType).toBe('city');
  });

  it('⚠⚠ NEWEST WINS when two vintages type the same place differently', () => {
    const fake = [
      { vintage: 2024, places: new Map([['dualplacecity', { censusName: 'Dualplace city', base: 'Dualplace', censusType: 'city', placeFips: '11111', population: 10, vintage: 2024 }]]) },
      { vintage: 2013, places: new Map([['dualplacetown', { censusName: 'Dualplace town', base: 'Dualplace', censusType: 'town', placeFips: '11111', population: 9, vintage: 2013 }]]) },
    ];
    const r = resolvePlace('Dualplace City', { ladders: fake });
    expect(r.entityType).toBe('city');
    expect(r.vintage).toBe(2024);
  });

  it('⚠ LEGAL still beats RETYPED on an older vintage', () => {
    const r = resolvePlace('Mountain City', { ladders });
    expect(r.how).toBe('legal');
    expect(r.base).toBe('Mountain City');
  });

  it('refuses a government no vintage names, and says which it tried', () => {
    const r = resolvePlace('Nowhereville City', { ladders });
    expect(r.entityType).toBeUndefined();
    expect(r.why).toMatch(/named by no vintage/);
    expect(r.tried).toEqual([2024, 2019, 2014, 2013]);
  });

  it('⚠⚠ AN ABSENT VINTAGE FILE IS REPORTED, NOT TREATED AS "NOT NAMED"', () => {
    // Otherwise forgetting the fetch silently becomes a refusal that reads as
    // "this government never existed".
    const r = resolvePlace('Macon City', { ladders: ladders.filter((l) => l.vintage !== 2013), missing: [2013] });
    expect(r.why).toMatch(/not present/);
    expect(r.missing).toEqual([2013]);
  });

  it('loadLadder reports an absent vintage instead of dropping it', () => {
    const { ladders: got, missing } = loadLadder('/nonexistent-root', '13', DEFAULT_LADDER);
    expect(got).toHaveLength(0);
    expect(missing).toEqual([2024, 2019, 2014, 2013]);
  });

  it('loadLadder reads the real cache for Georgia, where the cache is present', () => {
    // ⚠⚠ `cache/` IS GITIGNORED IN FULL. Asserting it exists passes on a
    // machine that has run the fetch and fails in CI, where the directory does
    // not. This asserted `missing` was `[]` and took the build red after a
    // green local run — the same trap as reference_stacked_prs_get_no_ci, in a
    // file whose other 20 tests read committed fixtures precisely to avoid it.
    //
    // SKIPS LOUDLY rather than passing vacuously: silence would mean the
    // assertion had quietly stopped testing anything.
    if (!existsSync('cache/sub-est2024_13.csv')) {
      console.warn('SKIPPED: no cache/ — run node scripts/fetchCensusVintages.mjs 13');
      return;
    }
    const { ladders: got, missing } = loadLadder('.', '13', DEFAULT_LADDER);
    expect(missing).toEqual([]);
    expect(got.map((l) => l.vintage)).toEqual([2024, 2019, 2014, 2013]);
  });
});

describe('the cross-state audit reports, and loads nothing', () => {
  it('buckets names by the vintage that would type them', () => {
    const r = auditState('13', ['Atlanta City', 'Macon City', 'Nowhereville City'], { ladders });
    expect(r.byVintage[2024]).toContain('Atlanta City');
    expect(r.byVintage[2013]).toContain('Macon City');
    expect(r.unnamed).toEqual(['Nowhereville City']);
    expect(r.named).toBe(2);
  });

  it('⚠ reports a state whose older vintages are not cached instead of calling it clean', () => {
    // Otherwise a state nobody fetched reads as "no recoverable governments",
    // which is the same lie the ladder exists to prevent, one level up.
    const r = auditState('06', ['Anything City'], { ladders: [], missing: [2019, 2014, 2013] });
    expect(r.incomplete).toBe(true);
    expect(r.missing).toEqual([2019, 2014, 2013]);
  });

  it('is clean when every name types at the current vintage', () => {
    const r = auditState('13', ['Atlanta City', 'Savannah City'], { ladders });
    expect(r.unnamed).toEqual([]);
    expect(Object.keys(r.byVintage)).toEqual(['2024']);
    expect(r.incomplete).toBe(false);
  });
});

describe('⚠⚠ a single-digit state FIPS must still match', () => {
  /**
   * FOUND BY THE CROSS-STATE AUDIT, NOT BY A TEST: Arizona, California and
   * Colorado each reported ZERO places in Vintage 2024.
   *
   * The census filename carries the BARE fips (`sub-est2024_4.csv`) while the
   * STATE column inside is ZERO-PADDED (`04`). Comparing the two as strings
   * matches nothing, so `readPlaceVintage` returned an EMPTY MAP and
   * `resolvePlace` refused every government with "named by no vintage of
   * 2024, 2019, 2014, 2013" — a total failure wearing the words of a
   * confident, measured refusal.
   *
   * ⚠ It would have hit AL, AK, AZ, AR, CA, CO and CT. California and
   * Colorado are live TT states.
   */
  const AZ = 'tests/fixtures/census/sub-est2024-az-places-slice.csv';

  it('matches when the caller passes the bare fips the FILENAME uses', () => {
    const places = readPlaceVintage(AZ, { vintage: 2024, stateFips: '4' });
    expect(places.size).toBe(5);
    expect(places.get(squash('Apache Junction city')).placeFips).toBe('02830');
  });

  it('matches when the caller passes the padded fips the FILE uses', () => {
    const places = readPlaceVintage(AZ, { vintage: 2024, stateFips: '04' });
    expect(places.size).toBe(5);
  });

  it('accepts a number, which is what a FIPS read from a filename often is', () => {
    expect(readPlaceVintage(AZ, { vintage: 2024, stateFips: 4 }).size).toBe(5);
  });

  it('⚠⚠ REFUSES an empty result rather than returning one', () => {
    // An empty place map is never a legitimate answer for a real state file.
    // Returning it silently is what turned a path bug into 7 states of
    // "this government never existed".
    expect(() => readPlaceVintage(AZ, { vintage: 2024, stateFips: '99' }))
      .toThrow(/no SUMLEV=162 rows for state 99/);
  });
});
