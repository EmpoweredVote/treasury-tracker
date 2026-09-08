import { describe, it, expect } from 'vitest';
import {
  bareName, displayName, entityTypeFor, UNIT_TYPE_MAP,
  TITLE_CASE_EXCEPTIONS, assertExceptionsAreObserved,
} from '../scripts/data/inNameRules.mjs';

/**
 * ⚠⚠ THE FOURTEEN GOVERNMENTS WITH "City" IN THEIR REAL NAME — and SEVEN of
 * them are TOWNS. Every one is a verbatim Gateway `unit_name` from the live
 * all-years extracts. A trailing-CITY rule turns `Clay City` into `Clay` and
 * types a town as a city on the way.
 */
const CITY_IN_THE_NAME = [
  ['HARTFORD CITY CIVIL CITY', 'city', 'Hartford City'],
  ['MICHIGAN CITY CIVIL CITY', 'city', 'Michigan City'],
  ['TELL CITY CIVIL CITY', 'city', 'Tell City'],
  ['UNION CITY CIVIL CITY', 'city', 'Union City'],
  ['GAS CITY CIVIL CITY', 'city', 'Gas City'],
  ['OAKLAND CITY CIVIL CITY', 'city', 'Oakland City'],
  ['COLUMBIA CITY CIVIL CITY', 'city', 'Columbia City'],
  ['CLAY CITY CIVIL TOWN', 'town', 'Clay City'],
  ['SWITZ CITY CIVIL TOWN', 'town', 'Switz City'],
  ['MONROE CITY CIVIL TOWN', 'town', 'Monroe City'],
  ['ROME CITY CIVIL TOWN', 'town', 'Rome City'],
  ['STATE LINE CITY CIVIL TOWN', 'town', 'State Line City'],
  ['CAMBRIDGE CITY CIVIL TOWN', 'town', 'Cambridge City'],
  ['FOUNTAIN CITY CIVIL TOWN', 'town', 'Fountain City'],
];

describe('stripping the publisher\'s type wording and nothing else', () => {
  it('keeps "City" when it is part of the name', () => {
    for (const [gateway, type, expected] of CITY_IN_THE_NAME) {
      expect(displayName(gateway, type), gateway).toBe(expected);
    }
  });

  it('proves the guard is not vacuous — seven of the fourteen are TOWNS', () => {
    const towns = CITY_IN_THE_NAME.filter(([, t]) => t === 'town');
    expect(towns).toHaveLength(7);
    // Each still ends in "City" after the suffix comes off.
    for (const [g, , expected] of towns) {
      expect(bareName(g).toUpperCase().endsWith('CITY'), g).toBe(true);
      expect(expected.endsWith('City')).toBe(true);
    }
  });

  it('handles the eight units that use a different naming form', () => {
    expect(displayName('CITY OF GREENDALE', 'city')).toBe('Greendale');
    expect(displayName('CITY OF JONESBORO', 'city')).toBe('Jonesboro');
    // ⚠ Austin, INDIANA. TT already holds Austin, TEXAS as a `city`.
    expect(displayName('CITY OF AUSTIN', 'city')).toBe('Austin');
    expect(displayName('TOWN OF BORDEN', 'town')).toBe('Borden');
    expect(displayName('TOWN OF CROWS NEST', 'town')).toBe('Crows Nest');
    expect(displayName('TOWN OF NORTH CROWS NEST', 'town')).toBe('North Crows Nest');
    expect(displayName('TOWN OF WEST BADEN SPRINGS', 'town')).toBe('West Baden Springs');
    // No type word at all.
    expect(displayName('LEO-CEDARVILLE', 'town')).toBe('Leo-Cedarville');
  });

  it('does not strip a prefix out of the middle of a name', () => {
    // "Town of" only comes off the FRONT — a name containing it elsewhere survives.
    expect(bareName('MONROE CITY CIVIL TOWN')).toBe('MONROE CITY');
  });

  it('counties keep the word County, cities and towns do not', () => {
    expect(displayName('ALLEN COUNTY', 'county')).toBe('Allen County');
    expect(displayName('ST. JOSEPH COUNTY', 'county')).toBe('St. Joseph County');
    expect(displayName('FORT WAYNE CIVIL CITY', 'city')).toBe('Fort Wayne');
  });

  it('refuses a name that reduces to nothing rather than storing an empty one', () => {
    expect(() => displayName('   ', 'town')).toThrow(/empty name/);
    expect(() => displayName(null, 'town')).toThrow(/empty name/);
    expect(() => displayName(undefined, 'town')).toThrow(/empty name/);
    expect(() => displayName('', 'town')).toThrow(/empty name/);
  });

  /**
   * ⚠ `bareName` trims BEFORE matching, so a dangling prefix loses the trailing
   * whitespace the pattern needs and is left intact rather than emptied. Recorded
   * because I first asserted the opposite: the only reachable empty result is an
   * input that is blank or absent to begin with.
   */
  it('leaves a dangling prefix intact rather than emptying the name', () => {
    expect(displayName('TOWN OF ', 'town')).toBe('Town Of');
  });

  /**
   * ⚠ The suffix pattern requires WHITESPACE before CIVIL, so a name consisting
   * of only the type words is left alone rather than stripped to nothing. No such
   * unit exists in the 660, and this is the conservative direction: the failure
   * mode of stripping too eagerly is a government losing its name (Everglades,
   * Oil, Clay), which is far worse than one implausible input surviving intact.
   */
  it('leaves a name that is ONLY the type words alone, rather than emptying it', () => {
    expect(displayName('CIVIL TOWN', 'town')).toBe('Civil Town');
    expect(bareName('CIVIL TOWN')).toBe('CIVIL TOWN');
  });
});

describe('title casing', () => {
  it('applies the four measured exceptions', () => {
    expect(displayName('MCCORDSVILLE CIVIL TOWN', 'town')).toBe('McCordsville');
    expect(displayName('DEKALB COUNTY', 'county')).toBe('DeKalb County');
    expect(displayName('LAPORTE CIVIL CITY', 'city')).toBe('LaPorte');
    expect(displayName('LAGRANGE CIVIL TOWN', 'town')).toBe('LaGrange');
  });

  /**
   * ⚠ Indiana's Dubois County really is "Dubois"; Pennsylvania's DuBois CITY is
   * not, and paNameRules.mjs carries that exception. Same letters, two states,
   * different answers — which is why exceptions are per-state and measured.
   */
  it('does NOT apply Pennsylvania\'s DuBois exception to Indiana\'s Dubois', () => {
    expect(displayName('DUBOIS COUNTY', 'county')).toBe('Dubois County');
    expect(TITLE_CASE_EXCEPTIONS).not.toHaveProperty('DUBOIS');
  });

  it('title-cases each hyphen and space segment', () => {
    expect(displayName('LEO-CEDARVILLE', 'town')).toBe('Leo-Cedarville');
    expect(displayName('COUNTRY CLUB HEIGHTS CIVIL TOWN', 'town')).toBe('Country Club Heights');
    expect(displayName('NEW HAVEN CIVIL CITY', 'city')).toBe('New Haven');
  });

  it('keeps the period in a St. name', () => {
    expect(displayName('ST. LEON CIVIL TOWN', 'town')).toBe('St. Leon');
    expect(displayName('ST. JOHN CIVIL TOWN', 'town')).toBe('St. John');
  });

  it('is idempotent on the one already mixed-case name', () => {
    // 659 of 660 Gateway names are ALL CAPS; `Victoria Woods Civil Town` is not.
    expect(displayName('Victoria Woods Civil Town', 'town')).toBe('Victoria Woods');
  });
});

describe('entity_type comes from afr_unit_type', () => {
  it('maps the publisher\'s three codes', () => {
    expect(entityTypeFor(1)).toBe('county');
    expect(entityTypeFor(2)).toBe('city');
    expect(entityTypeFor(3)).toBe('town');
    expect(entityTypeFor('3')).toBe('town');
  });

  /**
   * ⚠⚠ A silent default would file a school corporation or a library as a city.
   * The `All` unit-type extract carries types 5, 6, 7 and 8 as well, and 77 of
   * its (cnty_cd, unit_code) keys hold two governments — so the type must be
   * asserted, not assumed, the moment anyone widens the sweep.
   */
  it('refuses any other unit type instead of defaulting', () => {
    for (const bad of [5, 6, 7, 8, 19, 0, null, undefined, 'city', '']) {
      expect(() => entityTypeFor(bad), String(bad)).toThrow(/REFUSING/);
    }
  });

  it('covers exactly the three types the City/Town and County extracts hold', () => {
    expect(Object.keys(UNIT_TYPE_MAP).sort()).toEqual(['1', '2', '3']);
    expect(new Set(Object.values(UNIT_TYPE_MAP))).toEqual(new Set(['county', 'city', 'town']));
  });
});

describe('a declared exception that names nothing excludes nothing', () => {
  it('passes when every exception is observed', () => {
    expect(assertExceptionsAreObserved(
      ['MCCORDSVILLE', 'DEKALB', 'LAPORTE', 'LAGRANGE', 'FORT WAYNE'])).toBe(true);
  });

  it('refuses when an exception matches no unit, and names which', () => {
    expect(() => assertExceptionsAreObserved(['MCCORDSVILLE', 'DEKALB', 'LAPORTE']))
      .toThrow(/LAGRANGE/);
    expect(() => assertExceptionsAreObserved([])).toThrow(/MCCORDSVILLE/);
  });

  it('refuses rather than passing vacuously on an empty roster', () => {
    // ⚠ A gate that can measure nothing must fail, not pass.
    expect(() => assertExceptionsAreObserved([])).toThrow(/REFUSING/);
  });
});
