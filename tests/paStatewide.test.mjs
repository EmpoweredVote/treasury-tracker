import { describe, it, expect } from 'vitest';

import {
  tidy, stripTypeSuffix, titleCase, countyDisplayName, baseDisplayName,
  assignDisplayNames, assertExceptionsUsed, assertTitleExceptionsUsed, censusMayName,
  NO_STRIP_IDS, TITLE_CASE_EXCEPTIONS, TYPE_MAP, TYPE_OVERRIDE_IDS, PLACEHOLDER_IDS,
  PA_CONSOLIDATED, PA_EXISTING_TT_NAMES, PA_DEFAULT_FISCAL_MONTH, FISCAL_MONTH_IDS,
} from '../scripts/data/paNameRules.mjs';
import { resolveMonth, PA_FIRST_YEAR, PA_LAST_YEAR } from '../scripts/buildPaStatewideEntities.mjs';
import { plannedRowsFor, DATASETS, toRpcTree } from '../scripts/loadPaStatewide.mjs';
import { buildTree } from '../scripts/lib/paDced.mjs';
import {
  PA_STATEWIDE_ENTITIES, PA_STATEWIDE_LOAD_WINDOW, paEntityByDcedId,
} from '../scripts/data/paStatewideEntities.mjs';
import { TYPE_MIGRATIONS } from '../scripts/seedPaStatewide.mjs';
import { expectedKeys, digestOf } from '../scripts/verifyPaStatewideLoad.mjs';
import { fundScopeFor } from '../scripts/loadPaDced.mjs';

describe('PA names — the published string is not the name', () => {
  it('collapses the double spaces DCED ships', () => {
    expect(tidy('FRANKLIN  TWP')).toBe('FRANKLIN TWP');
    expect(tidy('PHILADELPHIA  COUNTY')).toBe('PHILADELPHIA COUNTY');
  });

  it('⚠⚠ strips exactly ONE trailing type token, never repeatedly', () => {
    // 13 boroughs are legally named "... City".
    expect(stripTypeSuffix('GROVE CITY BORO')).toBe('GROVE CITY');
    expect(stripTypeSuffix('HOMER CITY BORO')).toBe('HOMER CITY');
    expect(stripTypeSuffix('MAHANOY CITY BORO')).toBe('MAHANOY CITY');
    // ...and a plain city loses only its designator.
    expect(stripTypeSuffix('CLAIRTON CITY')).toBe('CLAIRTON');
  });

  it('handles every spelling of the suffix, not just the abbreviations', () => {
    expect(stripTypeSuffix('HARRIS TOWNSHIP')).toBe('HARRIS');
    expect(stripTypeSuffix('TEMPLE  BOROUGH')).toBe('TEMPLE');
    expect(stripTypeSuffix('BLOOMSBURG TOWN')).toBe('BLOOMSBURG');
    expect(stripTypeSuffix('BERWICK TWP')).toBe('BERWICK');
  });

  it('title-cases without expanding the publisher\'s abbreviations', () => {
    expect(titleCase('STATE COLLEGE')).toBe('State College');
    // ⚠ NOT "Mount Joy" — expanding is a rewrite and can be wrong.
    expect(titleCase('MT JOY')).toBe('Mt Joy');
  });

  it('⚠ gets every Mc name right by rule, not by listing', () => {
    for (const [input, want] of [
      ['MCKEESPORT', 'McKeesport'], ['EAST MCKEESPORT', 'East McKeesport'],
      ['MCCANDLESS', 'McCandless'], ['MCKEES ROCKS', 'McKees Rocks'],
      ['MCSHERRYSTOWN', 'McSherrystown'], ['MCCONNELLSBURG', 'McConnellsburg'],
      ['MCVEYTOWN', 'McVeytown'], ['MCEWENSVILLE', 'McEwensville'],
      ['MCADOO', 'McAdoo'], ['MCCLURE', 'McClure'], ['MCDONALD', 'McDonald'],
      ['MCHENRY', 'McHenry'], ['MCINTYRE', 'McIntyre'], ['MCNETT', 'McNett'],
      ['MCKEAN', 'McKean'], ['MCCALMONT', 'McCalmont'],
    ]) {
      expect(titleCase(input), input).toBe(want);
    }
  });

  it('cases each hyphen segment and leaves an acronym alone', () => {
    expect(titleCase('VALLEY-HI')).toBe('Valley-Hi');
    expect(titleCase('S.N.P.J.')).toBe('S.N.P.J.');
  });

  it('renders a county name from the raw county string', () => {
    expect(countyDisplayName('BERKS')).toBe('Berks County');
    expect(countyDisplayName('MCKEAN')).toBe('McKean County');
    expect(countyDisplayName('PHILADELPHIA  COUNTY')).toBe('Philadelphia County');
  });

  it('⚠⚠ Oil City keeps its type word — the Everglades City trap', () => {
    expect(baseDisplayName({ id: '610512', name: 'OIL CITY', entityType: 'city' })).toBe('Oil City');
    // and the declared id is the REAL one, not a plausible neighbour
    expect(Object.keys(NO_STRIP_IDS)).toContain('610512');
  });
});

describe('PA names — collisions', () => {
  const recs = [
    { id: '1', name: 'FRANKLIN TWP', type: 'Second Class Township', county: 'ADAMS' },
    { id: '2', name: 'FRANKLIN TWP', type: 'Second Class Township', county: 'BERKS' },
    { id: '3', name: 'STATE COLLEGE BORO', type: 'Borough', county: 'CENTRE' },
    { id: '4', name: 'FRANKLIN CITY', type: 'City', county: 'VENANGO' },
    { id: '5', name: 'FRANKLIN BORO', type: 'Borough', county: 'CAMBRIA' },
    { id: '6', name: 'PHILADELPHIA CITY', type: 'City', county: 'PHILADELPHIA' },
  ];
  const named = assignDisplayNames(recs);
  const by = new Map(named.map((n) => [n.id, n]));

  it('⚠⚠ county-qualifies every township, because 15 share one name', () => {
    expect(by.get('1').displayName).toBe('Franklin Township, Adams County');
    expect(by.get('2').displayName).toBe('Franklin Township, Berks County');
  });

  it('leaves an unambiguous borough or city BARE — State College must not be renamed', () => {
    expect(by.get('3').displayName).toBe('State College');
    expect(by.get('6').displayName).toBe('Philadelphia');
  });

  it('⚠ qualifies on the DISPLAY NAME alone, so a reader never sees two Franklins', () => {
    expect(by.get('4').displayName).toBe('Franklin, Venango County');
    expect(by.get('5').displayName).toBe('Franklin, Cambria County');
  });

  it('produces globally unique names', () => {
    const names = named.map((n) => n.displayName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('maps every DCED type, and refuses one it does not know', () => {
    expect(TYPE_MAP.Borough).toBe('borough');
    expect(TYPE_MAP.City).toBe('city');
    expect(TYPE_MAP['First Class Township']).toBe('township');
    expect(TYPE_MAP['Second Class Township']).toBe('township');
    expect(() => assignDisplayNames([{ id: 'x', name: 'X TWP', type: 'Fourth Class Whatever', county: 'ADAMS' }]))
      .toThrow(/Unknown DCED Municipality Type/);
  });

  it('Bloomsburg is a town, by declared override', () => {
    const [b] = assignDisplayNames([{ id: '190153', name: 'BLOOMSBURG TOWN', type: 'Borough', county: 'COLUMBIA' }]);
    expect(b.entityType).toBe('town');
    expect(b.displayName).toBe('Bloomsburg');
  });
});

describe('PA declared exceptions must each do work', () => {
  it('⚠⚠ reports a NO_STRIP id that matches nothing — the defect that shipped once', () => {
    expect(assertExceptionsUsed([{ id: '999999' }]).join(' ')).toMatch(/NO_STRIP_IDS names id/);
    expect(assertExceptionsUsed([{ id: '610512' }, { id: '190153' }, { id: '040553' }, { id: '070613' }]))
      .toEqual([]);
  });

  it('reports a stale title-case exception', () => {
    expect(assertTitleExceptionsUsed([{ name: 'SOMEWHERE BORO' }]).length)
      .toBe(Object.keys(TITLE_CASE_EXCEPTIONS).length);
  });

  it('every declared id is present in the real registry or deliberately excluded', () => {
    const ids = new Set(PA_STATEWIDE_ENTITIES.map((e) => e.dcedId));
    for (const id of Object.keys(NO_STRIP_IDS)) expect(ids.has(id), `NO_STRIP ${id}`).toBe(true);
    for (const id of Object.keys(TYPE_OVERRIDE_IDS)) expect(ids.has(id), `TYPE_OVERRIDE ${id}`).toBe(true);
    // ⚠ Placeholders are the opposite: they must NOT be in the registry.
    for (const id of Object.keys(PLACEHOLDER_IDS)) expect(ids.has(id), `PLACEHOLDER ${id}`).toBe(false);
  });

  it('⚠ the two county-part stubs are gone and the real filings remain', () => {
    expect(paEntityByDcedId('040553')).toBeNull();   // Ellwood City, Beaver stub
    expect(paEntityByDcedId('070613')).toBeNull();   // Tunnelhill, Blair stub
    expect(paEntityByDcedId('370093').name).toBe('Ellwood City');
    expect(paEntityByDcedId('111683').name).toBe('Tunnelhill');
    expect(paEntityByDcedId('370093').fiscalYears.length).toBe(10);
  });
});

describe('PA fiscal month — one exception, settled by oracle', () => {
  it('defaults to January, which the federal record puts at 611 of 643 PA rows', () => {
    expect(PA_DEFAULT_FISCAL_MONTH).toBe(1);
  });

  it('declares Philadelphia as month 7', () => {
    expect(FISCAL_MONTH_IDS['510012']).toBe(7);
  });

  it('every registry entity carries a month, and only Philadelphia differs', () => {
    const odd = PA_STATEWIDE_ENTITIES.filter((e) => e.fiscalYearStartMonth !== 1);
    expect(odd.map((e) => e.name)).toEqual(['Philadelphia']);
    expect(odd[0].fiscalYearStartMonth).toBe(7);
    for (const e of PA_STATEWIDE_ENTITIES) expect(Number.isInteger(e.fiscalYearStartMonth)).toBe(true);
  });

  it('⚠⚠ REFUSES the census for a county-qualified name — it records no county', () => {
    expect(censusMayName({ qualified: true })).toBe(false);
    expect(censusMayName({ qualified: false })).toBe(true);
    const r = resolveMonth({ dcedId: '1', name: 'Franklin Township, Adams County', qualified: true,
      entityType: 'township' }, [2023], () => { throw new Error('must not be consulted'); });
    expect(r.status).toBe('refused');
    expect(r.month).toBe(1);
  });

  it('confirms when the census agrees', () => {
    const r = resolveMonth({ dcedId: '510012', name: 'Philadelphia', qualified: false, entityType: 'city' },
      [2023], () => ({ month: 7, auditYears: [2023] }));
    expect(r.status).toBe('confirmed');
    expect(r.month).toBe(7);
  });

  it('⚠ reports UNVERIFIED rather than confirmed when the census has nothing', () => {
    const r = resolveMonth({ dcedId: '1', name: 'Nowhere', qualified: false, entityType: 'borough' },
      [2023], () => ({ unknown: 'no filing' }));
    expect(r.status).toBe('unverified');
  });

  it('⚠⚠ CONFLICTS when the census contradicts the declared month', () => {
    const r = resolveMonth({ dcedId: '1', name: 'Somewhere', qualified: false, entityType: 'borough' },
      [2023], () => ({ month: 7, auditYears: [2023] }));
    expect(r.status).toBe('conflict');
  });
});

describe('PA subtotal collapse — the publisher disagreeing with itself', () => {
  const ix = new Map([
    ['total taxes revenues', 0], ['real estate tax revenues', 1], ['earned income tax revenues', 2],
  ]);
  const spec = [{
    label: 'Taxes', subtotal: 'Total Taxes Revenues',
    children: ['Real Estate Tax Revenues', 'Earned Income Tax Revenues'],
  }];

  it('keeps the detail when the subtotal reconciles', () => {
    const t = buildTree(spec, [300, 100, 200], ix, { onSubtotalMismatch: 'collapse' });
    expect(t.roots[0].a).toBe(300);
    expect(t.roots[0].c).toHaveLength(2);
    expect(t.collapsed).toEqual([]);
  });

  it('⚠⚠ drops the detail and KEEPS the published total when it does not', () => {
    const t = buildTree(spec, [350, 100, 200], ix, { onSubtotalMismatch: 'collapse' });
    expect(t.roots[0].a).toBe(350);          // the publisher's figure survives
    expect(t.roots[0].c).toBeUndefined();    // ...and the contract is not violated
    expect(t.collapsed).toHaveLength(1);
    expect(t.collapsed[0]).toMatchObject({ id: 'Taxes', published: 350, detailSum: 300, diff: 50 });
  });

  it('⚠ the collapse is never silent, and the default still REFUSES', () => {
    const refuse = buildTree(spec, [350, 100, 200], ix);
    expect(refuse.collapsed).toEqual([]);
    expect(refuse.checks[0].diff).toBe(50);   // reported as a failing check instead
  });

  it('a collapsed node still satisfies the children-sum contract', () => {
    const t = buildTree(spec, [350, 100, 200], ix, { onSubtotalMismatch: 'collapse' });
    for (const n of toRpcTree(t)) {
      if (n.c) expect(n.c.reduce((s, c) => s + c.a, 0)).toBe(n.a);
    }
  });
});

describe('PA statewide registry — integrity', () => {
  it('covers the published window and no more', () => {
    expect(PA_STATEWIDE_LOAD_WINDOW).toEqual({ first: PA_FIRST_YEAR, last: PA_LAST_YEAR });
    expect(PA_FIRST_YEAR).toBe(2015);   // ⚠ pre-2015 is a DIFFERENT report
    for (const e of PA_STATEWIDE_ENTITIES) {
      for (const y of e.fiscalYears) {
        expect(y).toBeGreaterThanOrEqual(PA_FIRST_YEAR);
        expect(y).toBeLessThanOrEqual(PA_LAST_YEAR);
      }
    }
  });

  it('⚠⚠ display names are unique — the database keys on them', () => {
    const names = PA_STATEWIDE_ENTITIES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('DCED ids are unique and are the real join key', () => {
    const ids = PA_STATEWIDE_ENTITIES.map((e) => e.dcedId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(paEntityByDcedId('510012').name).toBe('Philadelphia');
    expect(paEntityByDcedId('140933').name).toBe('State College');
  });

  it('⚠⚠ reproduces every pre-existing TT name exactly', () => {
    const names = new Set(PA_STATEWIDE_ENTITIES.map((e) => e.name));
    for (const n of PA_EXISTING_TT_NAMES) expect(names.has(n), n).toBe(true);
  });

  it('State College is migrated to borough, not duplicated', () => {
    expect(paEntityByDcedId('140933').entityType).toBe('borough');
    expect(TYPE_MIGRATIONS).toEqual([{ name: 'State College', from: 'municipality', to: 'borough' }]);
  });

  it('every entity has at least one approved year and a positive population', () => {
    for (const e of PA_STATEWIDE_ENTITIES) {
      expect(e.fiscalYears.length).toBeGreaterThan(0);
      expect(e.population).toBeGreaterThan(0);
    }
  });

  it('every county link names a county that is itself in the registry', () => {
    const counties = new Set(PA_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'county').map((e) => e.name));
    for (const e of PA_STATEWIDE_ENTITIES) {
      if (e.countyDbName) expect(counties.has(e.countyDbName), e.name).toBe(true);
    }
  });

  it('⚠ Philadelphia County is absent on purpose and Philadelphia says why', () => {
    expect(PA_STATEWIDE_ENTITIES.some((e) => e.name === 'Philadelphia County')).toBe(false);
    expect(PA_CONSOLIDATED['Philadelphia County']).toMatch(/consolidated/i);
    const p = paEntityByDcedId('510012');
    expect(p.countyDbName).toBeNull();
    expect(p.countyNote).toMatch(/Philadelphia County/);
  });

  it('the two scopes are carried per report, not per state', () => {
    const sources = new Set(PA_STATEWIDE_ENTITIES.map((e) => e.source));
    expect(sources).toEqual(new Set(['PA_MUNI', 'PA_COUNTY']));
  });

  it('plans two datasets per approved entity-year', () => {
    expect(DATASETS).toEqual(['operating', 'revenue']);
    const entityYears = PA_STATEWIDE_ENTITIES.reduce((s, e) => s + e.fiscalYears.length, 0);
    expect(plannedRowsFor()).toBe(entityYears * 2);
    expect(entityYears).toBeGreaterThan(25000);
  });
});

describe('PA statewide load — reconciliation is by digest, not by count', () => {
  it('the intended count is entity-years times two datasets', () => {
    const entityYears = PA_STATEWIDE_ENTITIES.reduce((s, e) => s + e.fiscalYears.length, 0);
    expect(expectedKeys()).toHaveLength(entityYears * DATASETS.length);
  });

  it('every intended key names a real entity and one of its own approved years', () => {
    const byName = new Map(PA_STATEWIDE_ENTITIES.map((e) => [e.name, e]));
    for (const k of expectedKeys()) {
      const [name, fy, ds] = k.split('|');
      expect(byName.has(name), `key names ${name}`).toBe(true);
      expect(byName.get(name).fiscalYears).toContain(Number(fy));
      expect(DATASETS).toContain(ds);
    }
  });

  it('⚠⚠ the digest is order-independent but membership-sensitive', () => {
    const a = ['Philadelphia|2023|operating', 'State College|2023|revenue'];
    expect(digestOf(a)).toBe(digestOf([...a].reverse()));
    expect(digestOf(a)).not.toBe(digestOf(['Philadelphia|2023|operating', 'State College|2024|revenue']));
  });

  it('holds no duplicate intended keys', () => {
    const keys = expectedKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('⚠⚠ carries TWO fund scopes, read from the two reports', () => {
    const muni = PA_STATEWIDE_ENTITIES.find((e) => e.source === 'PA_MUNI');
    const county = PA_STATEWIDE_ENTITIES.find((e) => e.source === 'PA_COUNTY');
    expect(fundScopeFor(muni)).toBe('all_funds');
    expect(fundScopeFor(county)).toBe('total_governmental');
  });
});
