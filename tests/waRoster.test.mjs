import { describe, it, expect } from 'vitest';
import {
  WA_ENTITIES, getEntity, cityEntities, countyEntities, loadableEntities,
  selectExactCity, assertMcag, POPULATION_YEAR,
} from '../scripts/lib/waRoster.mjs';

describe('WA roster shape', () => {
  it('carries the six WA-CITIES-01 cities, the two v2.22 entities and four nav-only counties', () => {
    expect(WA_ENTITIES.map((e) => e.name).sort()).toEqual([
      'Bainbridge Island', 'Bellevue', 'Clark County', 'Everett', 'Kent',
      'Kitsap County', 'Pierce County', 'Snohomish County', 'Spokane',
      'Spokane County', 'Tacoma', 'Vancouver',
    ]);
  });

  it('pins every MCAG as a 4-character string, never a number', () => {
    // MCAG 0610 must not become 610. Leading zeros are significant in the
    // SAO's identifiers and a numeric literal would silently drop them.
    for (const e of WA_ENTITIES) {
      expect(typeof e.mcag, `${e.name} mcag type`).toBe('string');
      expect(e.mcag, `${e.name} mcag format`).toMatch(/^\d{4}$/);
    }
  });

  it('never reuses an MCAG between entities', () => {
    const mcags = WA_ENTITIES.map((e) => e.mcag);
    expect(new Set(mcags).size).toBe(mcags.length);
  });

  it('assigns every city a county that is itself in the roster or is King County', () => {
    const known = new Set([...countyEntities().map((e) => e.name), 'King County']);
    for (const c of cityEntities()) {
      expect(known.has(c.countyName), `${c.name} -> ${c.countyName}`).toBe(true);
    }
  });

  it('gives every county a null countyName — a county has no parent county', () => {
    for (const c of countyEntities()) expect(c.countyName, c.name).toBeNull();
  });

  it('never gives a loadable entity Seattle\'s per-capita band', () => {
    // Seattle's [500, 25000] would REJECT a correct Kitsap load (~$444/resident).
    // Bands are re-derived per entity from the observed spread, never copied.
    for (const e of WA_ENTITIES) {
      if (e.navOnly || !e.perCapitaBand) continue;
      expect(e.perCapitaBand).not.toEqual([500, 25000]);
      expect(e.perCapitaBand[0]).toBeLessThan(e.perCapitaBand[1]);
    }
  });

  it('never reuses a datasetIdPrefix or a pdfPrefix between loadable entities', () => {
    const loadable = WA_ENTITIES.filter((e) => !e.navOnly);
    const ids = loadable.map((e) => e.datasetIdPrefix);
    const pfx = loadable.map((e) => e.pdfPrefix);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(pfx).size).toBe(pfx.length);
  });

  it('gives every non-nav-only entity a population and a cited source', () => {
    for (const e of WA_ENTITIES) {
      if (e.navOnly) continue;
      expect(Number.isInteger(e.population), `${e.name} population`).toBe(true);
      expect(e.populationNote, `${e.name} populationNote`).toMatch(/WA OFM/);
    }
  });

  it('keeps the whole cohort on one denominator year so per-capita is comparable', () => {
    expect(POPULATION_YEAR).toBe(2025);
    for (const e of WA_ENTITIES) {
      if (e.navOnly) continue;
      expect(e.populationNote).toContain('April 1, 2025');
    }
  });

  it('never marks an entity loadable while its window or band is unresolved', () => {
    for (const e of loadableEntities()) {
      expect(Array.isArray(e.fiscalYears), `${e.name} fiscalYears`).toBe(true);
      expect(e.fiscalYears.length).toBeGreaterThan(0);
      expect(Array.isArray(e.perCapitaBand), `${e.name} perCapitaBand`).toBe(true);
    }
  });

  it('keeps every declared fiscal-year window ascending and free of duplicates', () => {
    for (const e of WA_ENTITIES) {
      if (!e.fiscalYears) continue;
      const sorted = [...e.fiscalYears].sort((a, b) => a - b);
      expect(e.fiscalYears, `${e.name} window order`).toEqual(sorted);
      expect(new Set(e.fiscalYears).size, `${e.name} window duplicates`).toBe(e.fiscalYears.length);
    }
  });

  it('getEntity throws on an unknown name rather than returning undefined', () => {
    expect(() => getEntity('Spokane Valley')).toThrow(/not in the WA roster/i);
  });
});

describe('MCAG decoy guard', () => {
  // Observed live 2026-08-15: GetEntities matches on a name PREFIX, so
  // "Spokane" also returns City of Spokane Valley (2781) -- a genuinely
  // different municipality -- and "Kent" returns two inactive districts.
  // An MCAG mismatch is not a tie failure; it loads the wrong government's
  // money in a way every arithmetic gate passes.
  const SPOKANE_CANDIDATES = [
    { EntityName: 'City of Spokane', MCAG: '0724' },
    { EntityName: 'City of Spokane Valley', MCAG: '2781' },
    { EntityName: 'City of Spokane Transportation Benefit District (Inactive)', MCAG: '3062' },
  ];

  it('selects the exact "City of <Name>" entity and rejects the decoys', () => {
    expect(selectExactCity(SPOKANE_CANDIDATES, 'Spokane').MCAG).toBe('0724');
  });

  it('rejects the inactive-district decoys under Kent', () => {
    const kent = [
      { EntityName: 'City of Kent', MCAG: '0401' },
      { EntityName: 'City of Kent Economic Development Corporation (Inactive)', MCAG: '0662' },
      { EntityName: 'City of Kent Special Events Center Public Facilities District', MCAG: '3003' },
    ];
    expect(selectExactCity(kent, 'Kent').MCAG).toBe('0401');
  });

  it('throws rather than guessing when no exact match exists', () => {
    expect(() => selectExactCity([{ EntityName: 'City of Spokane Valley', MCAG: '2781' }], 'Spokane'))
      .toThrow(/no exact "City of Spokane" entity/i);
  });

  it('throws on an empty candidate list rather than returning undefined', () => {
    expect(() => selectExactCity([], 'Tacoma')).toThrow(/no exact "City of Tacoma" entity/i);
  });

  it('assertMcag accepts the pinned value and rejects a decoy', () => {
    expect(() => assertMcag('Spokane', '0724')).not.toThrow();
    expect(() => assertMcag('Spokane', '2781')).toThrow(/does not match the pinned MCAG/i);
  });

  it('assertMcag rejects the number form of a leading-zero MCAG', () => {
    // getEntity('Tacoma').mcag is '0610'; the number 610 must not pass.
    expect(() => assertMcag('Tacoma', 610)).toThrow(/does not match the pinned MCAG/i);
    expect(() => assertMcag('Tacoma', '0610')).not.toThrow();
  });
});
