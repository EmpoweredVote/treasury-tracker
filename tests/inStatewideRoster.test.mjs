import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildRoster, entityKey, coverageByYear, ROSTER_EXTRACTS } from '../scripts/lib/inStatewideRoster.mjs';
import { bareName, assertExceptionsAreObserved, TITLE_CASE_EXCEPTIONS } from '../scripts/data/inNameRules.mjs';
import { serialise, ROSTER_FILE } from '../scripts/buildInStatewideRoster.mjs';

const committed = JSON.parse(readFileSync(ROSTER_FILE, 'utf8'));

/** One Gateway row, in the shape buildRoster consumes. */
const row = (o) => ({
  year: '2024', cntyCd: '02', cntyDescription: 'Allen', unitCode: '0407',
  sboaId: '02-001.00', afrUnitType: '2', unitName: 'FORT WAYNE CIVIL CITY', ...o,
});

describe('the committed roster', () => {
  it('holds all 660 governments in the measured proportions', () => {
    expect(committed.counts).toEqual({ total: 660, city: 119, town: 449, county: 92 });
    expect(committed.entities).toHaveLength(660);
  });

  it('re-serialises to exactly the committed bytes', () => {
    // ⚠ This is what --check compares. It also means *.json must stay pinned to
    // LF in .gitattributes: a CRLF checkout would report STALE on a file
    // identical in content, which is the failure PR #147 fixed.
    expect(serialise(committed.entities)).toBe(readFileSync(ROSTER_FILE, 'utf8'));
  });

  it('keys every entity on a well-formed sboa_id, all distinct', () => {
    const ids = committed.entities.map((e) => e.sboaId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of committed.entities) {
      expect(e.sboaId, e.name).toMatch(/^\d{2}-\d{3}\.\d{2}$/);
      expect(e.key).toBe(entityKey(e.sboaId));
    }
  });

  /**
   * ⚠⚠ The municipality key is (name, state, entity_type). Two governments
   * landing on one key would share a row and both their budgets — the Michigan
   * same-named-townships defect. The name rule is what makes these distinct, so
   * the roster is the place to assert it.
   */
  it('produces 660 distinct (name, state, entity_type) keys', () => {
    const keys = committed.entities.map((e) => `${e.name}|${e.state}|${e.entityType}`);
    expect(new Set(keys).size).toBe(660);
  });

  it('types every entity as city, town or county and nothing else', () => {
    expect(new Set(committed.entities.map((e) => e.entityType)))
      .toEqual(new Set(['city', 'town', 'county']));
  });

  it('names counties with the word County and cities and towns without it', () => {
    for (const e of committed.entities) {
      if (e.entityType === 'county') expect(e.name, e.name).toMatch(/ County$/);
      else expect(e.name, e.name).not.toMatch(/ County$/);
    }
  });

  /** ⚠⚠ The fourteen governments with "City" in their real name survived. */
  it('kept "City" in the names that really contain it, towns included', () => {
    const byName = new Map(committed.entities.map((e) => [e.name, e]));
    for (const n of ['Hartford City', 'Michigan City', 'Tell City', 'Union City',
      'Gas City', 'Oakland City', 'Columbia City']) {
      expect(byName.get(n)?.entityType, n).toBe('city');
    }
    for (const n of ['Clay City', 'Switz City', 'Monroe City', 'Rome City',
      'State Line City', 'Cambridge City', 'Fountain City']) {
      expect(byName.get(n)?.entityType, n).toBe('town');
    }
  });

  it('applied the four title-case exceptions', () => {
    const names = new Set(committed.entities.map((e) => e.name));
    expect(names).toContain('McCordsville');
    expect(names).toContain('DeKalb County');
    expect(names).toContain('LaPorte');
    expect(names).toContain('LaGrange');
    // ⚠ Indiana's Dubois County is NOT DuBois — that is Pennsylvania's city.
    expect(names).toContain('Dubois County');
  });

  it('handled the eight units that use a different naming form', () => {
    const names = new Set(committed.entities.map((e) => e.name));
    for (const n of ['Greendale', 'Jonesboro', 'Austin', 'Borden', 'Crows Nest',
      'North Crows Nest', 'West Baden Springs', 'Leo-Cedarville']) {
      expect(names, n).toContain(n);
    }
  });

  it('agrees with the eight entities TT already held', () => {
    // Measured against the live database 2026-09-07, after migration
    // 20260907000000 retyped Ellettsville. All eight agree; a disagreement here
    // means the sweep would INSERT a duplicate government.
    const byName = new Map(committed.entities.map((e) => [e.name, e.entityType]));
    expect(byName.get('Fort Wayne')).toBe('city');
    expect(byName.get('Gary')).toBe('city');
    expect(byName.get('Bloomington')).toBe('city');
    expect(byName.get('Allen County')).toBe('county');
    expect(byName.get('Lake County')).toBe('county');
    expect(byName.get('Monroe County')).toBe('county');
    expect(byName.get('Stinesville')).toBe('town');
    // ⚠⚠ The one that had to be migrated.
    expect(byName.get('Ellettsville')).toBe('town');
  });

  /** ⚠⚠ Coverage is a property of the YEAR. Never assert "all 92" for a year. */
  it('records the exact years each entity filed, and no year is complete', () => {
    for (const e of committed.entities) {
      expect(Array.isArray(e.years)).toBe(true);
      expect(e.years.length).toBeGreaterThan(0);
      expect([...e.years].sort((a, b) => a - b)).toEqual(e.years);
      for (const y of e.years) expect(y).toBeGreaterThanOrEqual(2011);
      for (const y of e.years) expect(y).toBeLessThanOrEqual(2025);
    }
    const cov = coverageByYear(committed.entities);
    expect([...cov.keys()]).toEqual(
      Array.from({ length: 15 }, (_, i) => 2011 + i));
    // No year has every government, and the weakest county year is 87 of 92.
    const counties = [...cov.values()].map((c) => c.county);
    expect(Math.min(...counties)).toBe(87);
    expect(Math.max(...counties)).toBe(92);
    for (const [, c] of cov) expect(c.city + c.town + c.county).toBeLessThan(660);
  });
});

/**
 * ⚠ `readRosterFromExtracts` is where the exceptions guard lives, and that path
 * needs the 443 MB corpus, so it never runs in CI. These exercise the guard
 * against the COMMITTED roster's real names instead — cheap, and it proves the
 * guard is satisfiable on the actual data rather than only in principle.
 */
describe('the exceptions guard, against the real roster', () => {
  const bareUpper = committed.entities.map((e) => bareName(e.gatewayName).toUpperCase());

  it('is satisfied by the committed roster', () => {
    expect(assertExceptionsAreObserved(bareUpper)).toBe(true);
  });

  it('fails if any one exception stops appearing', () => {
    for (const missing of Object.keys(TITLE_CASE_EXCEPTIONS)) {
      const without = bareUpper.filter((n) => n !== missing);
      expect(without.length, missing).toBeLessThan(bareUpper.length);
      expect(() => assertExceptionsAreObserved(without), missing).toThrow(new RegExp(missing));
    }
  });
});

describe('folding rows into governments', () => {
  it('collects the years one government filed', () => {
    const r = buildRoster([row({ year: '2015' }), row({ year: '2024' }), row({ year: '2015' })]);
    expect(r).toHaveLength(1);
    expect(r[0].years).toEqual([2015, 2024]);
    expect(r[0].name).toBe('Fort Wayne');
  });

  /**
   * ⚠⚠ An sboa_id that changes name, type or code between years is a different
   * government wearing the same id. Measured: 0 of 660 do — but Gateway HAS
   * renumbered an identifier before (Lake County's settlement Fund_code, FY2022,
   * $735,638,546 missed while every oracle passed), so this is asserted.
   */
  it('refuses an sboa_id that is not stable across years', () => {
    expect(() => buildRoster([row({}), row({ year: '2023', unitName: 'GARY CIVIL CITY' })]))
      .toThrow(/not stable/);
    expect(() => buildRoster([row({}), row({ year: '2023', afrUnitType: '3' })]))
      .toThrow(/not stable/);
    expect(() => buildRoster([row({}), row({ year: '2023', unitCode: '0999' })]))
      .toThrow(/not stable/);
  });

  it('refuses two governments that reduce to the same municipality key', () => {
    // Same display name, same type, different sboa_id — one would overwrite the other.
    expect(() => buildRoster([
      row({ sboaId: '02-001.00' }),
      row({ sboaId: '02-002.00', unitCode: '0408' }),
    ])).toThrow(/both reduce to/);
  });

  it('skips a blank sboa_id rather than folding it into a neighbour', () => {
    const r = buildRoster([row({}), row({ sboaId: '', unitName: 'MYSTERY CIVIL TOWN' })]);
    expect(r).toHaveLength(1);
    expect(r[0].sboaId).toBe('02-001.00');
  });

  it('refuses a malformed sboa_id instead of deriving a plausible key from it', () => {
    for (const bad of ['2-1.0', '02001.00', 'abc', '02-001', '']) {
      expect(() => entityKey(bad), bad).toThrow(/NN-NNN\.NN/);
    }
    expect(entityKey('02-001.00')).toBe('in-02-001-00');
  });

  it('refuses a unit type that is not a city, town or county', () => {
    // The All extract carries libraries, schools and special districts too.
    expect(() => buildRoster([row({ afrUnitType: '6' })])).toThrow(/REFUSING/);
  });
});

describe('the extracts it reads', () => {
  /**
   * ⚠⚠ NOT "Disbursements by Fund and Department", and not the `All` unit type.
   * The by-department report is General-Fund-only, and the `All` extract has 77
   * (cnty_cd, unit_code) keys carrying two governments each.
   */
  it('reads the two per-unit-type receipts extracts', () => {
    expect(ROSTER_EXTRACTS.map((g) => g.file)).toEqual(['rec_city_ALL.txt', 'rec_county_ALL.txt']);
  });

  it('declares which types each extract may contain, so a wrong download fails', () => {
    const byFile = Object.fromEntries(ROSTER_EXTRACTS.map((g) => [g.file, g.expectTypes]));
    expect(byFile['rec_city_ALL.txt'].sort()).toEqual(['city', 'town']);
    expect(byFile['rec_county_ALL.txt']).toEqual(['county']);
  });
});
