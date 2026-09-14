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
import {
  STATE_FIPS, resolveState,
  buildCountyIndex, resolveCounty,
  buildPlaceIndex, resolvePlace,
  buildMcdIndex, resolveTownship,
  buildMcdStateIndex, resolveMcdByState,
  buildPlaceCountyIndex,
} from '../scripts/lib/geoid.mjs';

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

describe('resolveCounty', () => {
  const rows = [
    { SUMLEV: '050', STATE: '18', COUNTY: '105', STNAME: 'Indiana', CTYNAME: 'Monroe County' },
    { SUMLEV: '050', STATE: '18', COUNTY: '097', STNAME: 'Indiana', CTYNAME: 'Marion County' },
    { SUMLEV: '050', STATE: '18', COUNTY: '141', STNAME: 'Indiana', CTYNAME: 'St. Joseph County' },
    { SUMLEV: '040', STATE: '18', COUNTY: '000', STNAME: 'Indiana', CTYNAME: 'Indiana' },
    { SUMLEV: '050', STATE: '26', COUNTY: '091', STNAME: 'Michigan', CTYNAME: 'Lenawee County' },
  ];
  const idx = buildCountyIndex(rows, '18');

  it('ignores rows from other states and non-county SUMLEVs', () => {
    expect(idx.size).toBe(3);
  });

  it('composes STATE+COUNTY, preserving the leading zero', () => {
    expect(resolveCounty(idx, '18', 'Marion County')).toEqual({
      geoid: '18097', basis: 'census-pep-050-exact', reason: null,
    });
  });

  it('matches a county whose name carries punctuation', () => {
    expect(resolveCounty(idx, '18', 'St. Joseph County').geoid).toBe('18141');
  });

  it('returns a null with a reason when the county is absent', () => {
    const r = resolveCounty(idx, '18', 'Nowhere County');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no county match for "Nowhere County"');
  });
});

describe('resolvePlace', () => {
  const rows = [
    { SUMLEV: '162', STATE: '18', PLACE: '05860', NAME: 'Bloomington city' },
    { SUMLEV: '162', STATE: '18', PLACE: '82700', NAME: 'Westfield city' },
    { SUMLEV: '162', STATE: '18', PLACE: '21000', NAME: 'Ellettsville town' },
    { SUMLEV: '162', STATE: '12', PLACE: '21525', NAME: 'Everglades city' },
    { SUMLEV: '157', STATE: '18', PLACE: '05860', COUNTY: '105', NAME: 'Bloomington city' },
  ];
  const idx = buildPlaceIndex(rows);

  it('indexes only whole-place rows, never place PARTS', () => {
    // a 157 row shares its parent's PLACE code; counting it would look like an
    // ambiguity and null out a perfectly good match
    expect(resolvePlace(idx, 'Bloomington').geoid).toBe('1805860');
  });

  it('composes STATE+PLACE', () => {
    expect(resolvePlace(idx, 'Westfield')).toEqual({
      geoid: '1882700', basis: 'census-pep-162-exact', reason: null,
    });
  });

  it('matches a town as readily as a city', () => {
    expect(resolvePlace(idx, 'Ellettsville').geoid).toBe('1821000');
  });

  // ⚠ Everglades City is the CITY OF EVERGLADES CITY. Census renders it
  // "Everglades city" — identical to how it would render a city named
  // Everglades, which does not exist. Appending designators to the TT name
  // finds it; stripping the Census tail yields "Everglades", naming nothing.
  it('matches a place whose legal name ends in a designator word', () => {
    expect(resolvePlace(idx, 'Everglades City').geoid).toBe('1221525');
  });

  it('returns a null with a reason when absent', () => {
    const r = resolvePlace(idx, 'Nowheresville');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no place match for "Nowheresville"');
  });

  it('returns a null with a reason when ambiguous — never picks', () => {
    const dupes = buildPlaceIndex([
      { SUMLEV: '162', STATE: '27', PLACE: '40514', NAME: 'Marine on Saint Croix city' },
      { SUMLEV: '162', STATE: '27', PLACE: '40518', NAME: 'Marine on Saint Croix city' },
    ]);
    const r = resolvePlace(dupes, 'Marine on Saint Croix');
    expect(r.geoid).toBeNull();
    expect(r.reason).toMatch(/^ambiguous place match for "Marine on Saint Croix": /);
  });
});

describe('resolveTownship', () => {
  const rows = readPepCsv('tests/fixtures/census/mi-adrian-slice.csv');
  const mcd = buildMcdIndex(rows);
  // ⚠ Counties come from the COUNTY file, which is the only one carrying
  // CTYNAME — mirroring what the driver does. buildCountyIndex now throws if
  // handed place-file rows rather than quietly building an empty index.
  const counties = buildCountyIndex(
    [{ SUMLEV: '050', STATE: '26', COUNTY: '091', STNAME: 'Michigan', CTYNAME: 'Lenawee County' }],
    '26',
  );

  // ⚠⚠ THE REGRESSION. In an MCD state an incorporated CITY is ALSO a county
  // subdivision, so "Adrian city" and "Adrian township" are BOTH SUMLEV-061
  // rows in Lenawee County. Normalising the designator away collapses them to
  // one key. Measured: 105 such false ambiguities in Michigan alone, each one
  // a chance to hand a township a city's geoid.
  it('does not confuse "Adrian city" with "Adrian township"', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township, Lenawee County');
    expect(r.geoid).toBe('2609100440');   // the TOWNSHIP's COUSUB, not the city's
    expect(r.basis).toBe('census-pep-061-county-scoped');
    expect(r.reason).toBeNull();
  });

  it('composes STATE+COUNTY+COUSUB — ten digits', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township, Lenawee County');
    expect(r.geoid).toHaveLength(10);
  });

  it('matches a charter township', () => {
    const r = resolveTownship(mcd, counties, '26', 'Madison Charter Township, Lenawee County');
    expect(r.geoid).toBe('2609152080');
  });

  it('never returns a city geoid for any township query', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township, Lenawee County');
    expect(r.geoid).not.toBe('2609100420'); // "Adrian city" as an MCD
  });

  it('returns a null with a reason when the stored name has no county half', () => {
    const r = resolveTownship(mcd, counties, '26', 'Adrian Township');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('township name carries no county: "Adrian Township"');
  });

  it('returns a null with a reason when the county half does not resolve', () => {
    const r = resolveTownship(mcd, counties, '26', 'Acme Township, Nowhere County');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no county match for "Nowhere County"');
  });

  it('returns a null with a reason when the township is absent in that county', () => {
    const r = resolveTownship(mcd, counties, '26', 'Nosuch Township, Lenawee County');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no township match for "Nosuch" in county 091');
  });
});

describe('buildCountyIndex guards against the wrong file', () => {
  it('throws when handed place-file rows instead of county-file rows', () => {
    const placeFileRows = readPepCsv('tests/fixtures/census/mi-adrian-slice.csv');
    expect(() => buildCountyIndex(placeFileRows, '26')).toThrow(/not the county file/);
  });
});

describe('name normalisation — the shapes TT stores that Census does not', () => {
  const idx = buildPlaceIndex([
    { SUMLEV: '162', STATE: '08', PLACE: '07850', NAME: 'Boulder city' },
    { SUMLEV: '162', STATE: '27', PLACE: '46924', NAME: 'North St. Paul city' },
    { SUMLEV: '162', STATE: '39', PLACE: '53102', NAME: 'Mount Healthy city' },
    { SUMLEV: '162', STATE: '42', PLACE: '00212', NAME: 'Addison borough' },
  ]);

  // TT stores some entities under the government's formal style.
  it('matches through a "City of X" prefix', () => {
    expect(resolvePlace(idx, 'City of Boulder').geoid).toBe('0807850');
  });

  // ⚠ Census abbreviates Saint as St. TT does not, consistently.
  it('matches Saint against Census St.', () => {
    expect(resolvePlace(idx, 'North Saint Paul').geoid).toBe('2746924');
  });

  // ⚠ And the reverse: TT abbreviates Mount as Mt. where Census spells it.
  it('matches Mt. against Census Mount', () => {
    expect(resolvePlace(idx, 'Mt. Healthy').geoid).toBe('3953102');
  });

  // ⚠ PA disambiguates same-named boroughs by appending the county, the same
  // convention MI uses for townships. The place matcher must strip it.
  it('matches through a ", X County" disambiguation suffix', () => {
    expect(resolvePlace(idx, 'Addison, Somerset County').geoid).toBe('4200212');
  });
});

describe('resolveMcdByState — New England towns are MCDs, not places', () => {
  // ⚠⚠ Massachusetts files 351 MCDs and only 58 places. Most MA towns have no
  // place FIPS at all, and Census renders them "Amherst Town city" — a name
  // that no amount of designator-appending turns into a 162 match, because
  // there is no 162 row. The tier is a property of the STATE's Census
  // structure, not of TT's entity_type label.
  const rows = [
    { SUMLEV: '061', STATE: '25', COUNTY: '015', COUSUB: '01370', NAME: 'Amherst Town city' },
    { SUMLEV: '061', STATE: '25', COUNTY: '025', COUSUB: '07000', NAME: 'Boston city' },
    { SUMLEV: '162', STATE: '25', PLACE: '07000', NAME: 'Boston city' },
  ];
  const idx = buildMcdStateIndex(rows);

  it('resolves a town that exists only as an MCD', () => {
    expect(resolveMcdByState(idx, 'Amherst')).toEqual({
      geoid: '2501501370', basis: 'census-pep-061-state-scoped', reason: null,
    });
  });

  it('composes STATE+COUNTY+COUSUB — ten digits', () => {
    expect(resolveMcdByState(idx, 'Amherst').geoid).toHaveLength(10);
  });

  it('returns a null with a reason when absent', () => {
    const r = resolveMcdByState(idx, 'Nowhere');
    expect(r.geoid).toBeNull();
    expect(r.reason).toBe('no MCD match for "Nowhere"');
  });

  it('returns a null with a reason when ambiguous — never picks', () => {
    const dupes = buildMcdStateIndex([
      { SUMLEV: '061', STATE: '25', COUNTY: '001', COUSUB: '11111', NAME: 'Springfield town' },
      { SUMLEV: '061', STATE: '25', COUNTY: '003', COUSUB: '22222', NAME: 'Springfield town' },
    ]);
    const r = resolveMcdByState(dupes, 'Springfield');
    expect(r.geoid).toBeNull();
    expect(r.reason).toMatch(/^ambiguous MCD match for "Springfield": /);
  });
});

describe('county-scoped place disambiguation', () => {
  // ⚠⚠ Pennsylvania has genuinely DISTINCT boroughs sharing a name across
  // counties — Centerville in Crawford County and Centerville in Washington
  // County are two different governments. TT disambiguates them the way it
  // does MI townships, by appending the county, and the matcher must use it.
  // Refusing (null) is safe but needless here: the answer is in the name.
  const subRows = [
    { SUMLEV: '162', STATE: '42', PLACE: '12184', NAME: 'Centerville borough' },
    { SUMLEV: '162', STATE: '42', PLACE: '12224', NAME: 'Centerville borough' },
    { SUMLEV: '157', STATE: '42', PLACE: '12184', COUNTY: '039', NAME: 'Centerville borough' },
    { SUMLEV: '157', STATE: '42', PLACE: '12224', COUNTY: '125', NAME: 'Centerville borough' },
  ];
  const countyRows = [
    { SUMLEV: '050', STATE: '42', COUNTY: '039', STNAME: 'Pennsylvania', CTYNAME: 'Crawford County' },
    { SUMLEV: '050', STATE: '42', COUNTY: '125', STNAME: 'Pennsylvania', CTYNAME: 'Washington County' },
  ];
  const idx = buildPlaceIndex(subRows);
  const placeCounty = buildPlaceCountyIndex(subRows);
  const counties = buildCountyIndex(countyRows, '42');
  const opts = { placeCountyIndex: placeCounty, countyIndex: counties };

  it('still refuses when there is no county to disambiguate with', () => {
    const r = resolvePlace(idx, 'Centerville');
    expect(r.geoid).toBeNull();
    expect(r.reason).toMatch(/^ambiguous place match/);
  });

  it('uses the county half of the stored name to pick the right one', () => {
    expect(resolvePlace(idx, 'Centerville, Crawford County', opts).geoid).toBe('4212184');
    expect(resolvePlace(idx, 'Centerville, Washington County', opts).geoid).toBe('4212224');
  });

  it('refuses when the named county does not resolve', () => {
    const r = resolvePlace(idx, 'Centerville, Nowhere County', opts);
    expect(r.geoid).toBeNull();
    expect(r.reason).toMatch(/^ambiguous place match/);
  });
});

describe('township name variants', () => {
  // ⚠ PA writes "Mt Joy Township" with no period; Census spells "Mount Joy
  // township". The place matcher already normalised this — resolveTownship
  // did not, so the same divergence failed in one tier and passed in another.
  const mcd = buildMcdIndex([
    { SUMLEV: '061', STATE: '42', COUNTY: '071', COUSUB: '51520', NAME: 'Mount Joy township' },
  ]);
  const counties = buildCountyIndex(
    [{ SUMLEV: '050', STATE: '42', COUNTY: '071', STNAME: 'Pennsylvania', CTYNAME: 'Lancaster County' }],
    '42',
  );

  it('matches Mt against Census Mount in the township tier', () => {
    const r = resolveTownship(mcd, counties, '42', 'Mt Joy Township, Lancaster County');
    expect(r.geoid).toBe('4207151520');
    expect(r.basis).toBe('census-pep-061-county-scoped');
  });
});

describe('⚠⚠ collisions the uniqueness check caught after the first national run', () => {
  // Census renders Indiana's two towns as "Elizabeth town" and
  // "Elizabethtown town". Appending the designator to TT's "Elizabeth" yields
  // the key "elizabethtown" — identical to the BARE name of the OTHER town.
  // Both TT rows then claimed geoid 1820674. This is the same collision shape
  // the spec flagged in buildFlStatewideEntities.mjs and then reproduced here.
  it('does not let "Elizabeth" + town steal "Elizabethtown"', () => {
    const idx = buildPlaceIndex([
      { SUMLEV: '162', STATE: '18', PLACE: '20674', NAME: 'Elizabeth town' },
      { SUMLEV: '162', STATE: '18', PLACE: '20682', NAME: 'Elizabethtown town' },
    ]);
    expect(resolvePlace(idx, 'Elizabeth', { entityType: 'town' }).geoid).toBe('1820674');
    expect(resolvePlace(idx, 'Elizabethtown', { entityType: 'town' }).geoid).toBe('1820682');
  });

  // Pennsylvania has a Franklin BOROUGH in Cambria County and a Franklin CITY
  // in Venango County. With designators tried in a fixed order beginning
  // 'city', the borough matched the city and both claimed 4227456. The
  // entity's own type has to drive which designator is tried first.
  it('prefers the designator matching the entity type', () => {
    const idx = buildPlaceIndex([
      { SUMLEV: '162', STATE: '42', PLACE: '27424', NAME: 'Franklin borough' },
      { SUMLEV: '162', STATE: '42', PLACE: '27456', NAME: 'Franklin city' },
    ]);
    expect(resolvePlace(idx, 'Franklin, Cambria County', { entityType: 'borough' }).geoid)
      .toBe('4227424');
    expect(resolvePlace(idx, 'Franklin, Venango County', { entityType: 'city' }).geoid)
      .toBe('4227456');
  });

  // The Everglades case must survive both fixes.
  it('still matches a legal name that ends in a designator word', () => {
    const idx = buildPlaceIndex([
      { SUMLEV: '162', STATE: '12', PLACE: '21525', NAME: 'Everglades city' },
    ]);
    expect(resolvePlace(idx, 'Everglades City', { entityType: 'city' }).geoid).toBe('1221525');
  });
});
