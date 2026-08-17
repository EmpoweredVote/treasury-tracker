/**
 * CA-CITIES-01 roster integrity.
 *
 * The load-bearing assertion here is the per-capita gate. `population_year` is
 * NULL on all five cities in production, and a current population estimate
 * silently attributed to a FY2007 figure is exactly the kind of wrong number
 * wearing a real-looking label that this project exists to avoid. So a city
 * without a population year must not carry a per-capita band, and that pairing
 * is asserted rather than remembered.
 */

import { describe, it, expect } from 'vitest';
import { CA_CITIES, loadableCities, cityByName } from '../scripts/lib/caRoster.mjs';

describe('CA roster integrity', () => {
  it('carries exactly the five spec cities', () => {
    expect(CA_CITIES.map((c) => c.name).sort()).toEqual([
      'Chula Vista',
      'Irvine',
      'Modesto',
      'Santa Clarita',
      'Stockton',
    ]);
  });

  it('gives every city a municipality id and a county node', () => {
    for (const c of CA_CITIES) {
      expect(c.municipalityId, c.name).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(c.countyNode, c.name).toBeTruthy();
    }
  });

  it('never shares a per-capita band between cities', () => {
    // Seattle's band rejects a correct Kitsap load. A band is per-entity, always.
    const bands = CA_CITIES.filter((c) => c.perCapitaBand).map((c) => JSON.stringify(c.perCapitaBand));
    expect(new Set(bands).size).toBe(bands.length);
  });

  it('refuses a per-capita band on a city with no population year', () => {
    for (const c of CA_CITIES) {
      if (!c.populationYear) expect(c.perCapitaBand, c.name).toBeNull();
    }
  });

  it('treats a city with no reconciled years as not yet loadable', () => {
    // fys is filled by each city's recon task; until then nothing is loadable,
    // so a loader that runs early has nothing to write rather than something wrong.
    expect(loadableCities()).toEqual([]);
  });

  it('resolves a city by name and returns undefined for a stranger', () => {
    expect(cityByName('Modesto').population).toBe(203294);
    expect(cityByName('Fresno')).toBeUndefined();
  });
});
