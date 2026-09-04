import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

import {
  keyFor, displayNameFor, readPopulations, resolveMonth,
  assertOverlapMatchesKnightRegistry, COUNTY_INFO_SUMMARY_ROWS, SC_COUNTY_COUNT,
  SC_COUNTY_FIPS,
} from '../scripts/buildScStatewideEntities.mjs';
import {
  SC_STATEWIDE_ENTITIES, SC_STATEWIDE_LOAD_WINDOW, scStatewideByKey,
} from '../scripts/data/scStatewideEntities.mjs';
import { SC_ENTITIES, SC_SOURCE, SC_LOAD_WINDOW } from '../scripts/data/scKnightEntities.mjs';
import { buildCensus } from '../scripts/lib/facFiscalYearCensus.mjs';
import { SC_LOAD_FLOOR } from '../scripts/lib/scRfa.mjs';
import {
  SC_PUBLISHED_TOTAL_RESIDUE, declaredResidue, residueKey, assertResiduesObserved,
} from '../scripts/data/scRfaPublisherResidue.mjs';

/**
 * ⚠⚠ THESE POPULATION CHECKS USED TO READ `cache/co-est2024-alldata.csv`, WHICH IS
 * GITIGNORED — so they threw ENOENT in CI and the `build` job went red on PR #134
 * while passing on every developer machine that happened to have the file. A test
 * that only runs where the data was manually downloaded is the harness-nobody-runs
 * problem in reverse: it ran locally, blocked the merge remotely, and asserted
 * nothing either way once it failed.
 *
 * The fixture is a VERBATIM extract of that Census PEP file — same bytes, same
 * column order — committed at 30 KB. Three inclusions are deliberate and must not
 * be "tidied":
 *
 *   * all 46 SUMLEV-050 rows for STATE 45          the counties under test
 *   * the SUMLEV-040 `South Carolina` row          one assertion below requires
 *     that this is NOT read as a county; drop it and the assertion passes
 *     trivially and proves nothing
 *   * three SUMLEV-050 rows for STATE 37 (NC)      otherwise `readPopulations`'s
 *     own `f[STATE] !== stateFips` filter is never exercised
 *
 * ⭐ And `keeps the fixture honest against its source` below re-reads the real
 * cache file WHEN PRESENT and asserts every fixture line appears in it verbatim,
 * so the fixture cannot drift into agreeing with a wrong registry. That check
 * SKIPS explicitly (and says so) where the source is absent, which is the only
 * part of this that CI cannot do.
 */
const CENSUS_FIXTURE = 'tests/fixtures/census/co-est2024-sc-slice.csv';
const CENSUS_SOURCE = 'cache/co-est2024-alldata.csv';

describe('the South Carolina statewide county registry', () => {
  it('holds all 46 counties, every one of them a county', () => {
    expect(SC_STATEWIDE_ENTITIES).toHaveLength(SC_COUNTY_COUNT);
    for (const e of SC_STATEWIDE_ENTITIES) {
      expect(e.entityType).toBe('county');
      expect(e.source).toBe(SC_SOURCE.RFA_COUNTY);
      expect(e.name).toMatch(/ County$/);
    }
  });

  it('keys and display names are unique — the database keys on the name', () => {
    expect(new Set(SC_STATEWIDE_ENTITIES.map((e) => e.key)).size).toBe(SC_COUNTY_COUNT);
    expect(new Set(SC_STATEWIDE_ENTITIES.map((e) => e.name)).size).toBe(SC_COUNTY_COUNT);
  });

  it('carries a distinct 5-digit South Carolina FIPS on every county', () => {
    const fips = SC_STATEWIDE_ENTITIES.map((e) => e.fips);
    expect(new Set(fips).size).toBe(SC_COUNTY_COUNT);
    for (const f of fips) expect(f).toMatch(new RegExp(`^${SC_COUNTY_FIPS}\\d{3}$`));
  });

  /**
   * ⚠⚠ THE WHOLE POINT OF `monthStatus`. RFA says only "fiscal year end on or
   * before June 30", which is not a claim of uniformity, so the month is
   * evidenced per county rather than defaulted. This asserts the MEASUREMENT of
   * the current edition — 46/46 confirmed at month 7 — and it must fail loudly if
   * a future edition adds a county the federal record cannot cover, rather than
   * quietly writing 7 for it.
   */
  it('evidences a fiscal month per county against the federal audit record', () => {
    for (const e of SC_STATEWIDE_ENTITIES) {
      expect(e.monthStatus).toBe('confirmed');
      expect(e.fiscalYearStartMonth).toBe(7);
      expect(e.censusName).toBeTruthy();
    }
  });

  it('never writes a month it could not evidence', () => {
    for (const e of SC_STATEWIDE_ENTITIES) {
      if (e.monthStatus !== 'confirmed') expect(e.fiscalYearStartMonth).toBeNull();
    }
  });

  /**
   * ⚠⚠ THE REGRESSION THIS PINS. `docs/fac/fac-local-fiscal-year-ends.csv` carries
   * a row `SC,Bertie County` — Bertie County is in NORTH CAROLINA and reaches the
   * SC census because a filer stamped the wrong state on its own Single Audit. A
   * generator driven from the census side would have produced a 47th "county"
   * with no sheet, no population and no money. Driving from the workbook's sheets
   * makes it inert.
   */
  it('excludes the North Carolina county that the federal record files under SC', () => {
    expect([...buildCensus('SC').keys()]).toContain('Bertie County');
    expect(SC_STATEWIDE_ENTITIES.map((e) => e.name)).not.toContain('Bertie County');
    expect(scStatewideByKey('bertie-county')).toBeNull();
  });

  /**
   * ⚠ `County Info`'s last three rows are summary arithmetic, not counties. A
   * generator iterating that matrix would ingest them as three governments.
   */
  it('excludes the three County Info summary rows', () => {
    for (const row of COUNTY_INFO_SUMMARY_ROWS) {
      expect(SC_STATEWIDE_ENTITIES.map((e) => e.name)).not.toContain(row);
      expect(scStatewideByKey(keyFor(row))).toBeNull();
    }
  });

  /**
   * ⚠⚠ `treasury_ensure_municipality` keys on (name, state, entity_type) — all
   * three. A drifted name or type here would not UPDATE Richland County, it would
   * CREATE A SECOND ONE, leaving the 52 rows already loaded on an orphan while
   * the sweep wrote a parallel series beside them.
   */
  it('reproduces the two pre-existing counties field for field', () => {
    expect(assertOverlapMatchesKnightRegistry(SC_STATEWIDE_ENTITIES)).toBe(2);

    const prior = SC_ENTITIES.filter((e) => e.source === SC_SOURCE.RFA_COUNTY);
    expect(prior.map((e) => e.key).sort()).toEqual(['horry-county', 'richland-county']);
    for (const p of prior) {
      const now = scStatewideByKey(p.key);
      expect(now).toBeTruthy();
      expect(now.name).toBe(p.name);
      expect(now.population).toBe(p.population);
      expect(now.sheet).toBe(p.sheet);
      expect(now.fiscalYearStartMonth).toBe(p.fiscalYearStartMonth);
    }
  });

  it('detects a drift in a pre-existing county rather than creating a twin', () => {
    const drifted = SC_STATEWIDE_ENTITIES.map((e) => (
      e.key === 'richland-county' ? { ...e, name: 'Richland Co.' } : e));
    expect(() => assertOverlapMatchesKnightRegistry(drifted)).toThrow(/richland-county\.name drifted/);
  });

  it('refuses a registry that lost a pre-existing county', () => {
    const without = SC_STATEWIDE_ENTITIES.filter((e) => e.key !== 'horry-county');
    expect(() => assertOverlapMatchesKnightRegistry(without)).toThrow(/lost the pre-existing county horry-county/);
  });

  /**
   * ⚠ The floor is a SCOPE decision. RFA's own notes record two category changes
   * taking effect at exactly FY2012 — bonds and leases became separately
   * reported, and county local option sales tax began including the county
   * revenue fund. Loading across it renders a definitional change as a trend.
   */
  it('inherits the FY2012 scope floor and the Knight window exactly', () => {
    expect(SC_STATEWIDE_LOAD_WINDOW.first).toBe(SC_LOAD_FLOOR);
    expect(SC_STATEWIDE_LOAD_WINDOW).toEqual({ ...SC_LOAD_WINDOW });
  });
});

describe('the statewide registry builders', () => {
  it('reproduces the two pre-existing keys', () => {
    expect(keyFor('Richland County')).toBe('richland-county');
    expect(keyFor('Horry County')).toBe('horry-county');
    expect(keyFor('McCormick County')).toBe('mccormick-county');
    expect(displayNameFor('Abbeville')).toBe('Abbeville County');
  });

  /**
   * ⚠ McCormick County is spelled `Mccormick County` in the federal audit record.
   * The resolution is case-insensitive and the RESOLVED string is written into
   * the registry, so the alias is visible rather than buried in a matcher.
   */
  it('records the federal record\'s own spelling as censusName', () => {
    const index = new Map([['MCCORMICK COUNTY', 'Mccormick County']]);
    const m = resolveMonth('McCormick County', index);
    expect(m.censusName).toBe('Mccormick County');
    expect(m.status).toBe('confirmed');
    expect(m.month).toBe(7);
    expect(scStatewideByKey('mccormick-county').censusName).toBe('Mccormick County');
  });

  it('reports unverified — never a default month — when the record cannot cover a county', () => {
    const m = resolveMonth('Nowhere County', new Map());
    expect(m.status).toBe('unverified');
    expect(m.month).toBeNull();
    expect(m.note).toMatch(/absence is not evidence/);
  });

  it('reads exactly the 46 South Carolina counties out of the Census PEP file', () => {
    const pops = readPopulations(CENSUS_FIXTURE);
    expect(pops.size).toBe(SC_COUNTY_COUNT);
    // Case-insensitive, so the Census `McCormick` and the record's `Mccormick`
    // reach the same row.
    expect(pops.get('MCCORMICK COUNTY').population).toBe(9983);
    expect(pops.get('RICHLAND COUNTY').fips).toBe('45079');
    // The SUMLEV-040 state row must not be read as a county.
    expect(pops.get('SOUTH CAROLINA')).toBeUndefined();
  });

  it('carries each county\'s own Census population, not a neighbour\'s', () => {
    const pops = readPopulations(CENSUS_FIXTURE);
    for (const e of SC_STATEWIDE_ENTITIES) {
      expect(e.population).toBe(pops.get(e.name.toUpperCase()).population);
      expect(e.fips).toBe(pops.get(e.name.toUpperCase()).fips);
    }
  });
});

/**
 * RFA's printed grand total for Bamberg County exceeds the sum of its own four
 * published categories by exactly $3 in FY2020 and FY2021 — verified present in
 * the ORIGINAL BIFF8 .xls by an independent xlrd read, so it is the publisher's,
 * not the conversion's and not the parser's.
 */
describe('the published-total residue register', () => {
  it('names exactly the two verified Bamberg entity-years', () => {
    expect(SC_PUBLISHED_TOTAL_RESIDUE.map((r) => r.id).sort())
      .toEqual(['bamberg-fy2020-revenue-residue', 'bamberg-fy2021-revenue-residue']);
  });

  /** ⚠ THE MILLEDGEVILLE RULE — flagged, never withheld. */
  it('loads every flagged entity-year rather than suppressing it', () => {
    for (const r of SC_PUBLISHED_TOTAL_RESIDUE) expect(r.loaded).toBe(true);
  });

  it('records figures that are internally consistent with the residue', () => {
    for (const r of SC_PUBLISHED_TOTAL_RESIDUE) {
      expect(r.detailTotal - r.publishedTotal).toBe(r.residue);
    }
  });

  it('excuses the exact declared discrepancy', () => {
    const hit = declaredResidue({
      entityKey: 'bamberg-county', fiscalYear: 2020, checkId: 'revenue:published', diff: -3,
    });
    expect(hit?.id).toBe('bamberg-fy2020-revenue-residue');
  });

  /**
   * ⚠⚠ THE LESSON THIS PINS: "never a tolerance where an exact registry will do".
   * A declared $3 must not excuse a $4, or the gate stops measuring across 1,196
   * filings.
   */
  it('refuses a neighbouring amount, a neighbouring year, and the other dataset', () => {
    const base = { entityKey: 'bamberg-county', fiscalYear: 2020, checkId: 'revenue:published' };
    expect(declaredResidue({ ...base, diff: -4 })).toBeNull();
    expect(declaredResidue({ ...base, diff: 3 })).toBeNull();
    expect(declaredResidue({ ...base, fiscalYear: 2019, diff: -3 })).toBeNull();
    expect(declaredResidue({ ...base, checkId: 'operating:published', diff: -3 })).toBeNull();
    expect(declaredResidue({ ...base, entityKey: 'barnwell-county', diff: -3 })).toBeNull();
  });

  it('refuses a deeper check id that merely starts the same way', () => {
    expect(declaredResidue({
      entityKey: 'bamberg-county', fiscalYear: 2020, checkId: 'revenue:roots', diff: -3,
    })).toBeNull();
  });

  /** ⚠⚠ A declared exception that names nothing excludes nothing. */
  it('fails when a declared in-scope residue was never observed', () => {
    expect(() => assertResiduesObserved(new Set(), () => true))
      .toThrow(/2 declared publisher residues were NOT observed/);
  });

  it('passes when the run never read the declared entity-years', () => {
    expect(assertResiduesObserved(new Set(), () => false)).toBe(0);
  });

  it('passes when every in-scope residue was observed', () => {
    const observed = new Set(SC_PUBLISHED_TOTAL_RESIDUE.map((r) => residueKey(r)));
    expect(assertResiduesObserved(observed, () => true)).toBe(2);
  });

  it('flags only counties that are in the statewide registry', () => {
    for (const r of SC_PUBLISHED_TOTAL_RESIDUE) {
      expect(scStatewideByKey(r.entityKey)).toBeTruthy();
      expect(scStatewideByKey(r.entityKey).name).toBe(r.name);
    }
  });
});

describe('the committed Census fixture', () => {
  it('holds exactly the rows the assertions depend on', () => {
    const lines = readFileSync(CENSUS_FIXTURE, 'latin1').split('\n').filter(Boolean);
    const head = lines[0].split(',');
    const ix = (n) => head.indexOf(n);
    const rows = lines.slice(1).map((l) => l.split(','));
    const sc = rows.filter((f) => f[ix('SUMLEV')] === '050' && f[ix('STATE')] === '45');
    expect(sc).toHaveLength(SC_COUNTY_COUNT);
    // ⚠ The state row must be PRESENT, so "not read as a county" is a real test.
    expect(rows.some((f) => f[ix('SUMLEV')] === '040' && f[ix('STATE')] === '45')).toBe(true);
    // ⚠ And a foreign state must be present, so the state filter is exercised.
    expect(rows.some((f) => f[ix('SUMLEV')] === '050' && f[ix('STATE')] === '37')).toBe(true);
    // ⚠ readPopulations must reject the foreign rows, not merely ignore them.
    const pops = readPopulations(CENSUS_FIXTURE);
    expect(pops.size).toBe(SC_COUNTY_COUNT);
    expect(pops.get('ALAMANCE COUNTY')).toBeUndefined();   // NC, SUMLEV 050
  });

  /**
   * ⚠⚠ A FIXTURE CAN DRIFT INTO AGREEING WITH A WRONG REGISTRY. This is the only
   * check that cannot run in CI, because it needs the 1.8 MB source file. It
   * SKIPS LOUDLY rather than passing vacuously — silence would mean the fixture
   * is trusted forever on the strength of one extraction.
   */
  it('keeps the fixture honest against its source, where the source is present', () => {
    if (!existsSync(CENSUS_SOURCE)) {
      console.log(`  SKIPPED: ${CENSUS_SOURCE} absent (gitignored). `
        + 'Fixture-vs-source parity was NOT checked in this run.');
      return;
    }
    const source = new Set(
      readFileSync(CENSUS_SOURCE, 'latin1').split(/\r?\n/).filter(Boolean),
    );
    const fixture = readFileSync(CENSUS_FIXTURE, 'latin1').split('\n').filter(Boolean);
    const missing = fixture.filter((l) => !source.has(l));
    expect(missing).toEqual([]);
  });
});
