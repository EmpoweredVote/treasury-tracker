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
    // fys is filled by each city's recon task, so this set grows as the milestone
    // proceeds. Asserted as an invariant rather than a snapshot: a city is
    // loadable exactly when its recon gave it years, so a loader run against an
    // un-recon'd city has nothing to write rather than something wrong.
    const withYears = CA_CITIES.filter((c) => c.fys.length > 0).map((c) => c.name);
    expect(loadableCities().map((c) => c.name)).toEqual(withYears);
    for (const c of CA_CITIES) {
      if (c.fys.length === 0) expect(loadableCities()).not.toContain(c);
    }
  });

  it('gives Modesto the window its source recon established', () => {
    // Task 4, 2026-08-16: 23 years. FY1995-99 and FY2009 are image-only scans,
    // FY2000-01 are pre-GASB-34 and deferred. FY2002 sits below SCO's floor and
    // FY2025 above its ceiling, so both load with nothing to reconcile against.
    const modesto = cityByName('Modesto');
    expect(modesto.fys).toHaveLength(23);
    expect(modesto.fys).not.toContain(2009);
    expect(modesto.fys).not.toContain(2001);
    expect(modesto.fys.at(0)).toBe(2002);
    expect(modesto.fys.at(-1)).toBe(2025);
    // The two years with no SCO counterpart.
    const [lo, hi] = modesto.scoWindow;
    expect(modesto.fys.filter((fy) => fy < lo || fy > hi)).toEqual([2002, 2025]);
  });

  it('resolves a city by name and returns undefined for a stranger', () => {
    expect(cityByName('Modesto').population).toBe(203294);
    expect(cityByName('Fresno')).toBeUndefined();
  });
});
