import { describe, it, expect } from 'vitest';
import {
  WA_ENTITIES, getEntity, cityEntities, countyEntities, loadableEntities,
  selectExactCity, assertMcag, POPULATION_YEAR,
} from '../scripts/lib/waRoster.mjs';

describe('WA roster shape', () => {
  it('carries the six WA-CITIES-01 cities, the two v2.22 entities, Redmond, Duvall and four nav-only counties', () => {
    expect(WA_ENTITIES.map((e) => e.name).sort()).toEqual([
      'Bainbridge Island', 'Bellevue', 'Clark County', 'Duvall', 'Everett',
      'Kent', 'Kitsap County', 'Pierce County', 'Redmond', 'Snohomish County',
      'Spokane', 'Spokane County', 'Tacoma', 'Vancouver',
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

  it('gives EVERY entity a population and a cited source, nav-only included', () => {
    // Nav-only county nodes carry a population too: the hero banner's info-row
    // renders a POPULATION stat, and Pima (v2.17) set that precedent. A node
    // with a NULL population renders a blank stat rather than no stat.
    for (const e of WA_ENTITIES) {
      expect(Number.isInteger(e.population), `${e.name} population`).toBe(true);
      expect(e.population, `${e.name} population > 0`).toBeGreaterThan(0);
      expect(e.populationNote, `${e.name} populationNote`).toMatch(/WA OFM/);
    }
  });

  it('keeps the whole cohort on one denominator year so per-capita is comparable', () => {
    expect(POPULATION_YEAR).toBe(2025);
    for (const e of WA_ENTITIES) {
      expect(e.populationNote, `${e.name}`).toContain('April 1, 2025');
    }
  });

  it('cites a line number for every population so the figure is traceable', () => {
    // "Read it from the authority and record the exact table" is the rule that
    // keeps a third-party estimate from creeping in. A note without a line
    // number cannot be re-checked.
    for (const e of WA_ENTITIES) {
      expect(e.populationNote, `${e.name}`).toMatch(/line \d+/);
    }
  });

  it('gives each city a smaller population than its parent county', () => {
    // A cheap sanity check on the OFM read: picking the Filter=4 city row for
    // a county, or vice versa, is an easy mistake and this catches it.
    const byName = new Map(WA_ENTITIES.map((e) => [e.name, e]));
    for (const c of cityEntities()) {
      const parent = byName.get(c.countyName);
      if (!parent || !parent.population) continue;   // King County is not in this roster
      expect(c.population, `${c.name} vs ${c.countyName}`).toBeLessThan(parent.population);
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

describe('Redmond', () => {
  it('carries Redmond with the eleven-year window', () => {
    const r = getEntity('Redmond');
    expect(r.mcag).toBe('0425');
    expect(r.entityType).toBe('city');
    expect(r.countyName).toBe('King County');
    expect(r.fiscalYears).toEqual(
      [2011, 2012, 2013, 2014, 2015, 2016, 2020, 2021, 2022, 2023, 2024]);
    expect(r.manifestSpan).toEqual([2004, 2025]);
  });

  it('declares a reason for every year in the manifest span that is not loaded', () => {
    const r = getEntity('Redmond');
    const [lo, hi] = r.manifestSpan;
    for (let fy = lo; fy <= hi; fy++) {
      const loaded = r.fiscalYears.includes(fy);
      const excluded = Object.prototype.hasOwnProperty.call(r.excludedYears, fy);
      expect(loaded !== excluded, `FY${fy} must be exactly one of loaded/excluded`).toBe(true);
    }
  });

  it('records the five policy exclusions as policy, not as document defects', () => {
    // FY2006-FY2010 are READABLE. If their reasons read like document defects,
    // a later reader records Redmond as harder than it is and a future WA
    // entity inherits a false difficulty estimate.
    const r = getEntity('Redmond');
    for (const fy of [2006, 2007, 2008, 2009, 2010]) {
      expect(r.excludedYears[fy], `FY${fy}`).toMatch(/floor rule/i);
      expect(r.excludedYears[fy], `FY${fy} must say it is readable`).toMatch(/READABLE/);
    }
  });

  it('records the three ciphered years as text-layer defects, not as policy', () => {
    const r = getEntity('Redmond');
    for (const fy of [2017, 2018, 2019]) {
      expect(r.excludedYears[fy], `FY${fy}`).toMatch(/no usable text layer/i);
    }
  });
});

describe('Duvall', () => {
  it('carries Duvall with its measured window', () => {
    const d = getEntity('Duvall');
    expect(d.mcag).toBe('0391');
    expect(d.entityType).toBe('city');
    expect(d.countyName).toBe('King County');
    expect(d.fiscalYears.length).toBeGreaterThan(0);
    // MEASURED in DUVALL-RECON.md §5: ten years on ONE config, ending at
    // FY2016 because the statement's shape changes between FY2015 and FY2016.
    expect(d.fiscalYears).toEqual(
      [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(d.manifestSpan).toEqual([2003, 2025]);
  });

  it('declares a reason for every year in the manifest span that is not loaded', () => {
    const d = getEntity('Duvall');
    const [lo, hi] = d.manifestSpan;
    for (let fy = lo; fy <= hi; fy++) {
      const loaded = d.fiscalYears.includes(fy);
      const excluded = Object.prototype.hasOwnProperty.call(d.excludedYears, fy);
      expect(loaded !== excluded, `FY${fy} must be exactly one of loaded/excluded`).toBe(true);
    }
  });

  it('is in King County alongside Redmond, Bellevue and Kent', () => {
    expect(getEntity('Duvall').countyName).toBe(getEntity('Redmond').countyName);
  });

  it('records FY2010-FY2015 as policy exclusions, not as document defects', () => {
    // DUVALL-RECON.md §5: these parse fine on a DIFFERENT config and are
    // excluded by the floor rule's era-split clause. A reason that reads like
    // a defect records Duvall as harder than it is, exactly as Redmond's
    // five readable exclusions would have.
    const d = getEntity('Duvall');
    for (const fy of [2010, 2011, 2012, 2013, 2014, 2015]) {
      expect(d.excludedYears[fy], `FY${fy}`).toMatch(/floor rule/i);
      expect(d.excludedYears[fy], `FY${fy} must say it is readable`).toMatch(/READABLE/);
    }
  });

  it("does not inherit Redmond's per-capita band", () => {
    // Duvall is ~8,800 people against Redmond's 82,380. A band copied from a
    // neighbour is the one guard that cannot catch a units error, because the
    // tie gate is unit-invariant.
    const d = getEntity('Duvall');
    const r = getEntity('Redmond');
    expect(d.perCapitaBand).not.toEqual(r.perCapitaBand);
  });

  // ⚠⚠ THE TEST ABOVE PASSES FOR *ANY* BAND AT ALL.
  //
  // `not.toEqual` is satisfied by `[0, 0]`, by a band copied from a third city,
  // or by one that admits every figure ever printed. It asserts that two values
  // differ, which is not the property anyone cares about: what matters is that
  // Duvall's band BINDS DUVALL. These tests assert that directly, so the band
  // cannot silently become decorative.
  //
  // The figures are MEASURED, not assumed -- Duvall FY2024 General Fund
  // operating is $7,801,148 against an OFM population of 8,810, i.e. ~$885.5
  // per capita. See the roster's own populationNote for the OFM line.
  it('brackets Duvall\'s own measured per-capita figure', () => {
    const d = getEntity('Duvall');
    const perCapita = 7_801_148 / d.population;   // ~885.5

    const [lo, hi] = d.verifyPerCapitaBand;
    expect(lo, 'band floor must be positive').toBeGreaterThan(0);
    expect(hi, 'band must be ordered').toBeGreaterThan(lo);
    expect(perCapita).toBeGreaterThan(lo);
    expect(perCapita).toBeLessThan(hi);
  });

  it('rejects the units errors it exists to catch', () => {
    // The $0 tie gate is unit-invariant: a whole statement read in thousands
    // ties perfectly against its own printed total. The per-capita band is the
    // ONLY guard that fires on it, so it must actually exclude the wrong scale.
    const d = getEntity('Duvall');
    const [lo, hi] = d.verifyPerCapitaBand;
    const correct = 7_801_148 / d.population;

    for (const [factor, name] of [[1000, 'read in thousands'], [1 / 1000, 'scaled down 1000x'],
      [10, 'off by 10x'], [1 / 10, 'off by 0.1x']]) {
      const wrong = correct * factor;
      expect(wrong >= lo && wrong <= hi, `a figure ${name} must fall outside the band`).toBe(false);
    }
  });

  it('is tighter than the load-time band, not a copy of it', () => {
    // Two bands exist on purpose: a wide one at load, a narrow one at verify.
    // If they were equal the second gate would measure nothing.
    const d = getEntity('Duvall');
    const [loadLo, loadHi] = d.perCapitaBand;
    const [vLo, vHi] = d.verifyPerCapitaBand;
    expect(vLo).toBeGreaterThan(loadLo);
    expect(vHi).toBeLessThan(loadHi);
  });
});
