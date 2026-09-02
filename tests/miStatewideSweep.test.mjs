import { describe, it, expect } from 'vitest';

import {
  canonicalMunicode, displayName, startMonthFromEndMonth, foldFilings, unitBaseName,
  SWEEP_UNIT_TYPES, ENTITY_TYPE_BY_UNIT,
} from '../scripts/buildMiStatewideRoster.mjs';
import { dedupeFilingRows, KNOWN_DUPLICATED_DETAIL } from '../scripts/lib/michiganF65.mjs';
import {
  MI_CENSUS_ALIASES, MI_TV_CENSUS_ALIASES, displayFromCensusName, displayFromCensusTownship,
} from '../scripts/data/miCensusAliases.mjs';
import { MI_STATEWIDE_ENTITIES, entityByMunicode, entityByKey }
  from '../scripts/data/miStatewideEntities.mjs';
import {
  EXCLUDED_ENTITY_YEARS, MI_MUNICODE_CONTINUATIONS, applyContinuations,
  countyFipsFromMunicode, facLookupName,
} from '../scripts/buildMiStatewideEntities.mjs';
import { DATASETS } from '../scripts/fetchMichiganF65.mjs';
import { auditRoster } from '../scripts/auditMiF65FiscalMonths.mjs';

describe('canonicalMunicode', () => {
  // ⚠⚠ THE DEFECT THIS EXISTS FOR. The municode is CCTTTT, so counties 01-09
  // carry a leading zero. Socrata types the field as a NUMBER in fifteen of the
  // sixteen City datasets — dropping that zero — and as a STRING in FY2020.
  // Joining on the raw value split 18 cities into a 15-year entity and a phantom
  // FY2020 twin, and the phantom carried the one year that ALSO has the
  // formatted-currency defect.
  it('pads to six so FY2020 and every other year agree', () => {
    expect(canonicalMunicode('12010')).toBe('012010');
    expect(canonicalMunicode('012010')).toBe('012010');
    expect(canonicalMunicode('12010')).toBe(canonicalMunicode('012010'));
  });

  it('leaves an already-six-digit code alone', () => {
    expect(canonicalMunicode('822050')).toBe('822050');
    expect(canonicalMunicode('820000')).toBe('820000');
  });

  it('refuses anything that is not a plain code, rather than coercing', () => {
    for (const bad of ['', '  ', 'abc', '1234567', null, undefined, '12-010']) {
      expect(canonicalMunicode(bad)).toBeNull();
    }
  });
});

describe('startMonthFromEndMonth', () => {
  // `fiscalendmonth` is the ENDING month: a June end is a July start.
  it('maps an ending month to the following start month', () => {
    expect(startMonthFromEndMonth(6)).toBe(7);
    expect(startMonthFromEndMonth(9)).toBe(10);
    expect(startMonthFromEndMonth(12)).toBe(1);
  });

  it('returns null rather than guessing on a bad value', () => {
    for (const bad of [0, 13, -1, null, undefined, 'x']) {
      expect(startMonthFromEndMonth(bad)).toBeNull();
    }
  });
});

describe('displayName', () => {
  it('agrees across the publisher\'s own spellings of one unit', () => {
    expect(displayName('City of Detroit', 'City')).toBe('Detroit');
    expect(displayName('Detroit', 'City')).toBe('Detroit');
  });

  it('gives a county the word County exactly once', () => {
    expect(displayName('Wayne', 'County')).toBe('Wayne County');
    expect(displayName('Wayne County', 'County')).toBe('Wayne County');
  });

  // ⚠⚠ EIGHT MICHIGAN VILLAGES ARE GENUINELY NAMED `... City`, and the
  // publisher files each under two spellings across the series. A rule that
  // trimmed a trailing type word would rename Mackinaw City to `Mackinaw`,
  // which matches no Census row — the village would resolve to nothing and be
  // dropped from the load without any figure being wrong.
  it('never strips a trailing City from a village that is named one', () => {
    for (const raw of ['Mackinaw City', 'Village of Mackinaw City']) {
      expect(displayName(raw, 'Village')).toBe('Mackinaw City');
      expect(unitBaseName(raw, 'Village')).toBe('Mackinaw City');
    }
    for (const v of ['Cass City', 'Union City', 'Kent City', 'Copper City',
      'Cement City', 'Howard City', 'Minden City']) {
      expect(displayName(`Village of ${v}`, 'Village')).toBe(v);
    }
  });
});

describe('unitBaseName', () => {
  // ⚠⚠ THE F-65 CHANGED THE SHAPE OF ITS TOWNSHIP NAMES MID-SERIES. Three
  // Otsego County townships file as bare `Hayes` through FY2019 and as
  // `Hayes Township` from FY2020. Both must reduce to one Census join key, or
  // which year a caller happens to read decides whether the unit resolves.
  it('reduces both of the publisher\'s township spellings to one base', () => {
    for (const ut of ['Township Part 1', 'Township Part 2']) {
      expect(unitBaseName('Hayes', ut)).toBe('Hayes');
      expect(unitBaseName('Hayes Township', ut)).toBe('Hayes');
      expect(unitBaseName('Otsego Lake Township', ut)).toBe('Otsego Lake');
      expect(unitBaseName('Township of Hayes', ut)).toBe('Hayes');
    }
  });

  // ⚠ Charter status is a fact the CENSUS states (`Comstock charter township`).
  // Re-deriving it from the F-65's spelling would be a second, weaker source.
  it('drops Charter, leaving the Census to state it', () => {
    expect(unitBaseName('Comstock Charter Township', 'Township Part 1')).toBe('Comstock');
    expect(unitBaseName('Charter Township of Comstock', 'Township Part 1')).toBe('Comstock');
  });

  it('normalises a county the same way displayName does', () => {
    expect(unitBaseName('Cass', 'County')).toBe('Cass County');
    expect(unitBaseName('Cass County', 'County')).toBe('Cass County');
  });
});

describe('the F-65 unit types', () => {
  it('carries a dataset id for all five types in all sixteen years', () => {
    expect(SWEEP_UNIT_TYPES).toHaveLength(5);
    const ids = [];
    for (const ut of SWEEP_UNIT_TYPES) {
      expect(Object.keys(DATASETS[ut] ?? {}), ut).toHaveLength(16);
      for (let fy = 2010; fy <= 2025; fy += 1) {
        expect(DATASETS[ut][fy], `${ut} FY${fy}`).toBeTruthy();
        ids.push(DATASETS[ut][fy]);
      }
    }
    // ⚠ 80 DISTINCT ids. One id reused across two years would load a year of
    // the wrong data while every arithmetic check still passed.
    expect(ids).toHaveLength(80);
    expect(new Set(ids).size).toBe(80);
  });

  it('maps every unit type to an entity_type the database permits', () => {
    // ⚠ These five must match the municipalities_entity_type_check constraint.
    for (const ut of SWEEP_UNIT_TYPES) {
      expect(['city', 'county', 'village', 'township']).toContain(ENTITY_TYPE_BY_UNIT[ut]);
    }
    expect(ENTITY_TYPE_BY_UNIT['Township Part 1']).toBe('township');
    expect(ENTITY_TYPE_BY_UNIT['Township Part 2']).toBe('township');
  });
});

describe('countyFipsFromMunicode', () => {
  // ⚠⚠ The municode's `CC` is an ALPHABETICAL county index, not a FIPS code:
  // Michigan's county FIPS are the odd numbers 001-165, so fips = 2*CC - 1.
  // Township names are not unique in Michigan, so this is the only thing that
  // makes the Census join county-scoped — and it was verified on all 83.
  it('maps the alphabetical index to the odd FIPS code', () => {
    expect(countyFipsFromMunicode('012010')).toBe('001'); // Alcona, CC 01
    expect(countyFipsFromMunicode('822050')).toBe('163'); // Wayne,  CC 82
    expect(countyFipsFromMunicode('820000')).toBe('163');
    expect(countyFipsFromMunicode('831000')).toBe('165'); // Wexford, the last
  });

  it('refuses a code outside Michigan\'s 83 counties rather than computing one', () => {
    for (const bad of ['000000', '840000', '', null, undefined, 'xx1000']) {
      expect(countyFipsFromMunicode(bad)).toBeNull();
    }
  });
});

describe('foldFilings', () => {
  // ⚠⚠ Four units changed fiscal calendar mid-series. A mode or a default would
  // move $0 and mislabel the period — the defect this project has shipped more
  // often than any other. A unit that disagrees with itself gets NULL and a
  // conflict report.
  it('reports a mid-series calendar change instead of averaging it', () => {
    const { entries, conflicts } = foldFilings([
      { municode: '440000', unitType: 'County', lu_name: 'Lapeer', fiscalendmonth: 12, fiscalYear: 2020 },
      { municode: '440000', unitType: 'County', lu_name: 'Lapeer', fiscalendmonth: 9, fiscalYear: 2022 },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(entries[0].fiscalYearStartMonth).toBeNull();
    expect(entries[0].monthsByYear).toEqual({ 2020: 1, 2022: 10 });
  });

  // ⚠⚠ The whole township-part design rests on Part 1 and Part 2 being disjoint
  // sets of GOVERNMENTS. If one code ever appeared in both, folding them would
  // concatenate two forms into one unit and double its money — while every tie
  // test still passed, because both halves are internally consistent.
  it('THROWS when one municode appears under two unit types', () => {
    expect(() => foldFilings([
      { municode: '171150', unitType: 'Township Part 1', lu_name: 'Trout Lake Township', fiscalendmonth: 3, fiscalYear: 2024 },
      { municode: '171150', unitType: 'Township Part 2', lu_name: 'Trout Lake Township', fiscalendmonth: 3, fiscalYear: 2025 },
    ])).toThrow(/two unit types|disjoint/);
  });

  // ⚠ Three Otsego County townships file as bare `Hayes` through FY2019 and
  // `Hayes Township` from FY2020. One government, one Census join key.
  it('folds the publisher\'s two township spellings into one unit', () => {
    const { entries } = foldFilings([
      { municode: '691070', unitType: 'Township Part 2', lu_name: 'Hayes', fiscalendmonth: 3, fiscalYear: 2019 },
      { municode: '691070', unitType: 'Township Part 2', lu_name: 'Hayes Township', fiscalendmonth: 3, fiscalYear: 2020 },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].baseName).toBe('Hayes');
    expect(entries[0].baseNameVariants).toBeUndefined();
    expect(entries[0].entityType).toBe('township');
  });

  it('keeps one constant month when the unit never moved', () => {
    const { entries, conflicts } = foldFilings([
      { municode: '822050', unitType: 'City', lu_name: 'Detroit', fiscalendmonth: 6, fiscalYear: 2010 },
      { municode: '822050', unitType: 'City', lu_name: 'City of Detroit', fiscalendmonth: 6, fiscalYear: 2011 },
    ]);
    expect(conflicts).toHaveLength(0);
    expect(entries[0].fiscalYearStartMonth).toBe(7);
  });

  it('folds the padded and unpadded forms of one unit together', () => {
    const { entries } = foldFilings([
      { municode: '12010', unitType: 'City', lu_name: 'Harrisville', fiscalendmonth: 6, fiscalYear: 2019 },
      { municode: '012010', unitType: 'City', lu_name: 'Harrisville', fiscalendmonth: 6, fiscalYear: 2020 },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].fiscalYears).toEqual([2019, 2020]);
  });
});

describe('dedupeFilingRows', () => {
  // ⚠⚠ Six filings are emitted TWICE by the portal, every row repeated. Left
  // alone, every leaf sum doubles while the published subtotals stay right —
  // which looks exactly like the Detroit FY2015 defect and is not it.
  it('collapses an exactly-repeated filing losslessly', () => {
    const row = (fn, g, v) => ({ field_name: fn, group: g, field_data: v });
    const rows = [row('T1R9C2', 'General Fund', '100'), row('T1R10C2', 'General Fund', '100')];
    const { rows: out, removed } = dedupeFilingRows([...rows, ...rows]);
    expect(removed).toBe(2);
    expect(out).toHaveLength(2);
  });

  it('does nothing to a filing that is not repeated', () => {
    const rows = [
      { field_name: 'T1R9C2', group: 'General Fund', field_data: '1' },
      { field_name: 'T1R10C2', group: 'General Fund', field_data: '2' },
    ];
    expect(dedupeFilingRows(rows).removed).toBe(0);
  });

  // ⚠⚠ A repeat whose copies DISAGREE is not a repeat. Keeping the first, the
  // last or the larger would be curve-fitting dressed as a tie-break.
  it('THROWS when two copies of one key carry different amounts', () => {
    expect(() => dedupeFilingRows([
      { field_name: 'T1R9C2', group: 'General Fund', field_data: '100' },
      { field_name: 'T1R9C2', group: 'General Fund', field_data: '101' },
    ], 'somewhere')).toThrow(/CONFLICTING values/);
  });

  // The two faces are separate columns; the same grid cell in a different group
  // is a different number and must not be collapsed.
  it('keys on field_name AND group, never field_name alone', () => {
    const { removed } = dedupeFilingRows([
      { field_name: 'T1R9C2', group: 'General Fund', field_data: '1' },
      { field_name: 'T1R9C2', group: 'Total', field_data: '9' },
    ]);
    expect(removed).toBe(0);
  });
});

describe('the Detroit FY2015 registry is untouched by the sweep', () => {
  // ⚠ The sweep added nothing here on purpose: its six look-alike filings are
  // whole-filing repeats, not contradicted detail. Detroit FY2015 has 620 keys
  // and none repeated — checked, not assumed.
  it('still holds exactly the three session-7a roots', () => {
    expect(KNOWN_DUPLICATED_DETAIL).toHaveLength(3);
    expect(KNOWN_DUPLICATED_DETAIL.every((d) => d.municode === '822050')).toBe(true);
    expect(KNOWN_DUPLICATED_DETAIL.every((d) => d.fiscalYear === 2015)).toBe(true);
  });
});

describe('the census alias registry', () => {
  // ⚠⚠ The St. Joseph trap: a city of 7,930 and a county of 61,171. A fuzzy
  // matcher collapsing punctuation could pair one with the other's population,
  // move $0, and be wrong by 8x.
  it('keeps St. Joseph city and St. Joseph County apart', () => {
    expect(MI_CENSUS_ALIASES['St Joseph County']).toBe('St. Joseph County');
    expect(MI_CENSUS_ALIASES['St Joseph']).toBeUndefined();
    const city = MI_STATEWIDE_ENTITIES.find((e) => e.name === 'St. Joseph' && e.entityType === 'city');
    const county = MI_STATEWIDE_ENTITIES.find((e) => e.name === 'St. Joseph County');
    expect(city.population).not.toBe(county.population);
  });

  it('strips only the Census type word', () => {
    expect(displayFromCensusName('Sault Ste. Marie city')).toBe('Sault Ste. Marie');
    expect(displayFromCensusName('Village of Clarkston city')).toBe('Village of Clarkston');
    expect(displayFromCensusName('St. Clair County')).toBe('St. Clair County');
  });
});

describe('the township/village census aliases', () => {
  // ⚠⚠ Keyed on the MUNICODE because a township name is not unique. `AuSable`
  // names two different governments, and `LeRoy` and `St Charles` each name
  // both a township and a village. A name-keyed entry would resolve one of each
  // pair to the other's Census row and move $0 while being wrong.
  it('keeps the two AuSables apart', () => {
    expect(MI_TV_CENSUS_ALIASES['351020']).toBe('Au Sable charter township');
    expect(MI_TV_CENSUS_ALIASES['721010']).toBe('Au Sable township');
    expect(MI_TV_CENSUS_ALIASES['351020']).not.toBe(MI_TV_CENSUS_ALIASES['721010']);
  });

  it('keeps a township and a like-named village apart', () => {
    expect(MI_TV_CENSUS_ALIASES['671070']).toBe('Le Roy township'); // Osceola township
    expect(MI_TV_CENSUS_ALIASES['673020']).toBe('Le Roy village'); //  Osceola village
    expect(MI_TV_CENSUS_ALIASES['731210']).toBe('St. Charles township');
    expect(MI_TV_CENSUS_ALIASES['733050']).toBe('St. Charles village');
  });

  it('is keyed only on six-digit municodes', () => {
    for (const k of Object.keys(MI_TV_CENSUS_ALIASES)) expect(k).toMatch(/^\d{6}$/);
  });

  it('turns a Census township name into TT\'s display form', () => {
    expect(displayFromCensusTownship('Comstock charter township')).toBe('Comstock Charter Township');
    expect(displayFromCensusTownship('Trout Lake township')).toBe('Trout Lake Township');
    // ⚠ `De Tour Village village` keeps the word Village, which is part of the
    // place name; only the trailing TYPE word is the suffix.
    expect(displayFromCensusName('De Tour Village village')).toBe('De Tour Village');
  });
});

describe('facLookupName', () => {
  const census = { townshipNameCounts: new Map([['Grant Township', 11], ['Trout Lake Township', 1]]) };
  const counts = new Map([['Trout Lake Township', 1], ['Springport', 1], ['Blissfield', 2]]);

  // ⚠⚠ The FAC census carries no county, so `Grant Township, MI` there could be
  // any of eleven. A wrong CONFIRMATION is worse than no evidence — it reads as
  // a check that passed.
  it('refuses a township name that means more than one government', () => {
    expect(facLookupName('township', { censusName: 'Grant township', name: 'x' }, census, counts)).toBeNull();
  });

  it('allows a township name that means exactly one', () => {
    expect(facLookupName('township', { censusName: 'Trout Lake township', name: 'x' }, census, counts))
      .toBe('Trout Lake Township');
  });

  // ⚠ `buildCensus` keys on the name alone, so two rows under one name merge
  // into a single entry with two months — which then reads as a fiscal-year
  // change that never happened.
  it('refuses a name the census holds more than one row for', () => {
    expect(facLookupName('village', { censusName: 'Blissfield village', name: 'x' }, census, counts)).toBeNull();
    expect(facLookupName('village', { censusName: 'Springport village', name: 'x' }, census, counts))
      .toBe('Springport');
  });

  // ⚠ Cities and counties keep the behaviour the FY2026-08 sweep proved.
  it('leaves cities and counties on their Census display name', () => {
    expect(facLookupName('city', { censusName: 'Detroit city', name: 'Detroit' }, census, counts)).toBe('Detroit');
    expect(facLookupName('county', { censusName: 'Wayne County', name: 'Wayne County' }, census, counts))
      .toBe('Wayne County');
  });
});

describe('applyContinuations', () => {
  const roster = () => ([
    {
      municode: '812019', unitType: 'City', entityType: 'city', name: 'Manchester',
      fiscalYears: [2020, 2021], monthsByYear: { 2020: 7, 2021: 7 },
    },
    {
      municode: '813030', unitType: 'Village', entityType: 'village', name: 'Manchester',
      fiscalYears: [2018, 2019], monthsByYear: { 2018: 7, 2019: 7 },
    },
  ]);

  it('joins one government\'s two municodes into one entity', () => {
    const out = applyContinuations(roster(), MI_MUNICODE_CONTINUATIONS);
    expect(out).toHaveLength(1);
    expect(out[0].municodes).toEqual(['812019', '813030']);
    expect(out[0].fiscalYears).toEqual([2018, 2019, 2020, 2021]);
    expect(out[0].entityType).toBe('village');
    // ⚠ The unit type is recorded PER YEAR: the fetcher reads the Village
    // dataset for FY2018-19 and the City dataset for FY2020-21.
    expect(out[0].unitTypeByYear).toEqual({
      2018: 'Village', 2019: 'Village', 2020: 'City', 2021: 'City',
    });
  });

  // ⚠⚠ Two codes filing the SAME year are two governments, not one. Merging
  // them would sum two units' budgets under a single card.
  it('THROWS when the two municodes overlap in a year', () => {
    const r = roster();
    r[1].fiscalYears = [2019, 2020];
    r[1].monthsByYear = { 2019: 7, 2020: 7 };
    expect(() => applyContinuations(r, MI_MUNICODE_CONTINUATIONS)).toThrow(/overlaps/);
  });

  it('declares exactly one continuation, and it is Manchester', () => {
    expect(MI_MUNICODE_CONTINUATIONS).toHaveLength(1);
    expect(MI_MUNICODE_CONTINUATIONS[0]).toMatchObject({
      canonical: '812019', absorbs: '813030', entityType: 'village',
    });
  });
});

describe('MI_STATEWIDE_ENTITIES', () => {
  it('covers every Michigan unit that filed, and no duplicates', () => {
    // 280 cities · 83 counties · 253 villages · 1,240 townships.
    // ⚠ 280 not 281: Manchester moved to `village` when its two municodes joined.
    expect(MI_STATEWIDE_ENTITIES.length).toBe(1856);
    const byType = (t) => MI_STATEWIDE_ENTITIES.filter((e) => e.entityType === t).length;
    expect(byType('city')).toBe(280);
    expect(byType('county')).toBe(83);
    expect(byType('village')).toBe(253);
    // ⚠ Exactly the number of townships the Census counts in Michigan — Part 1
    // and Part 2 are disjoint, so their union is the whole state.
    expect(byType('township')).toBe(1240);

    const codes = new Set(MI_STATEWIDE_ENTITIES.flatMap((e) => e.municodes));
    const keys = new Set(MI_STATEWIDE_ENTITIES.map((e) => e.key));
    const names = new Set(MI_STATEWIDE_ENTITIES.map((e) => `${e.entityType}|${e.name}`));
    expect(codes.size).toBe(1857); // ⚠ one more than entities: Manchester's two
    expect(keys.size).toBe(MI_STATEWIDE_ENTITIES.length);
    // ⚠⚠ `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE). Two
    // units sharing both would silently become ONE municipality carrying both
    // budgets — which is what bare township names would have done to 302 of them.
    expect(names.size).toBe(MI_STATEWIDE_ENTITIES.length);
  });

  // ⚠⚠ 117 Michigan township names are shared by 302 townships, and `Grant
  // Township` names eleven. The county is part of the name, not an annotation.
  it('gives every township its county, and eleven Grant Townships eleven names', () => {
    const townships = MI_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'township');
    for (const t of townships) {
      expect(t.name, t.municode).toMatch(/ Township, .+ County$/);
    }
    const grants = townships.filter((e) => e.name.startsWith('Grant Township,'));
    expect(grants).toHaveLength(11);
    expect(new Set(grants.map((e) => e.name)).size).toBe(11);
    // ⚠ Eleven DIFFERENT populations from eleven different Census rows — the
    // check that a name-keyed map would have failed silently.
    expect(new Set(grants.map((e) => e.population)).size).toBeGreaterThan(1);
  });

  // ⚠ Eight villages are genuinely named `... City`.
  it('keeps the villages that are named City', () => {
    for (const v of ['Mackinaw City', 'Cass City', 'Union City', 'Kent City',
      'Copper City', 'Cement City', 'Howard City', 'Minden City']) {
      const e = MI_STATEWIDE_ENTITIES.find((x) => x.name === v && x.entityType === 'village');
      expect(e, v).toBeTruthy();
      expect(e.population).toBeGreaterThan(0);
    }
  });

  // ⚠⚠ FY2016 Village publishes the amount where the grid coordinate belongs,
  // on all 83,274 rows. No village may claim that year.
  it('drops FY2016 from every village', () => {
    const villages = MI_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'village');
    expect(villages.length).toBe(253);
    for (const v of villages) expect(v.fiscalYears, v.name).not.toContain(2016);
    // ⚠ And only that year — a village that lost more would mean the exclusion
    // widened past what was measured.
    const cities = MI_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'city');
    expect(cities.some((c) => c.fiscalYears.includes(2016))).toBe(true);
  });

  it('reunites the Village of Manchester\'s two municodes', () => {
    const m = entityByMunicode('813030');
    expect(m).toBe(entityByMunicode('812019'));
    expect(m.name).toBe('Manchester');
    expect(m.entityType).toBe('village');
    expect(m.municodes).toEqual(['812019', '813030']);
    // ⚠ FY2016 is dropped with every other village year; the rest is continuous.
    expect(m.fiscalYears).toEqual([
      2010, 2011, 2012, 2013, 2014, 2015, 2017, 2018, 2019,
      2020, 2021, 2022, 2023, 2024, 2025,
    ]);
    expect(m.unitTypeByYear[2019]).toBe('Village');
    expect(m.unitTypeByYear[2020]).toBe('City');
  });

  // ⚠ A unit the federal census cannot name unambiguously carries null here, and
  // the loader's guard reads THIS field rather than the display name.
  it('refuses a FAC lookup for every ambiguous township name', () => {
    const townships = MI_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'township');
    const grants = townships.filter((e) => e.name.startsWith('Grant Township,'));
    for (const g of grants) expect(g.facCensusName, g.name).toBeNull();
    // ⚠ And it is not refusing everything — that would be a guard measuring nothing.
    expect(townships.filter((e) => e.facCensusName !== null).length).toBeGreaterThan(700);
  });

  it('gives every entity a population and a per-year month', () => {
    for (const e of MI_STATEWIDE_ENTITIES) {
      expect(e.population, e.name).toBeGreaterThan(0);
      expect(e.fiscalYears.length, e.name).toBeGreaterThan(0);
      for (const fy of e.fiscalYears) {
        expect(e.monthsByYear[String(fy)], `${e.name} FY${fy}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  // ⚠⚠ Detroit and Wayne County already hold rows in TT under exactly these
  // names. A rename would orphan them behind a duplicate entity.
  it('keeps the two session-7a entities at their existing names', () => {
    expect(entityByMunicode('822050').name).toBe('Detroit');
    expect(entityByMunicode('820000').name).toBe('Wayne County');
    expect(entityByKey('detroit').municode).toBe('822050');
  });

  // ⚠ Padded or unpadded, the caller gets the same entity.
  it('resolves a municode however it is spelled', () => {
    expect(entityByMunicode('12010')).toBe(entityByMunicode('012010'));
  });

  // ⚠⚠ A DECLARED EXCLUSION THAT NAMES NOTHING EXCLUDES NOTHING. One of these
  // was written with a municode that belonged to a different township — the
  // registry looked right, the entry was well-formed, and the year it named
  // stayed in the load. Only counting the drops found it.
  it('has dropped every excluded entity-year, and each names a real unit', () => {
    const byCode = new Map();
    for (const e of MI_STATEWIDE_ENTITIES) for (const c of e.municodes) byCode.set(c, e);
    expect(EXCLUDED_ENTITY_YEARS.length).toBe(58);
    for (const x of EXCLUDED_ENTITY_YEARS) {
      const e = byCode.get(x.municode);
      expect(e, `${x.municode} (${x.name}) is not in the roster`).toBeTruthy();
      // ⚠ The registry's own name must match the roster's, or the entry is
      // describing one government while excluding another.
      expect(e.name, x.municode).toBe(x.name);
      expect(e.fiscalYears, `${x.name} FY${x.fiscalYear}`).not.toContain(x.fiscalYear);
      expect(x.why, `${x.name} FY${x.fiscalYear}`).toBeTruthy();
    }
  });

  // ⚠⚠ The load's own claim about itself. If a future edit widens the roster,
  // this is the number that has to move with it.
  it('accounts for exactly 29,114 entity-years', () => {
    const total = MI_STATEWIDE_ENTITIES.reduce((n, e) => n + e.fiscalYears.length, 0);
    expect(total).toBe(29114);
    // The city+county half is the FY2026-08 sweep, unchanged except that
    // Manchester's six years moved with it into `village`.
    const cityCounty = MI_STATEWIDE_ENTITIES
      .filter((e) => ['city', 'county'].includes(e.entityType))
      .reduce((n, e) => n + e.fiscalYears.length, 0);
    expect(cityCounty).toBe(5765);
  });

  it('gives every entity at least one municode and a per-year unit type', () => {
    for (const e of MI_STATEWIDE_ENTITIES) {
      expect(e.municodes.length, e.name).toBeGreaterThan(0);
      for (const fy of e.fiscalYears) {
        expect(e.unitTypeByYear[fy], `${e.name} FY${fy}`).toBeTruthy();
      }
    }
  });
});

describe('auditRoster', () => {
  // ⚠⚠ ABSENCE OF CENSUS COVERAGE IS NOT AGREEMENT. censusGuard returns ok when
  // it has no evidence, which is right for a guard and useless for a
  // measurement — 3,634 of the sweep's 5,802 entity-years are uncovered, and
  // folding them into the numerator would report 98.8% as 99.5%.
  it('counts uncovered separately and never as agreement', () => {
    const roster = [{ municode: '000001', name: 'Nowhere', unitType: 'City', monthsByYear: { 2020: 7 } }];
    const r = auditRoster(roster, () => ({ unknown: true }));
    expect(r).toMatchObject({ agree: 0, conflict: 0, uncovered: 1 });
  });

  it('reports a contradiction with both months', () => {
    const roster = [{ municode: '440000', name: 'Lapeer County', unitType: 'County', monthsByYear: { 2022: 10 } }];
    const r = auditRoster(roster, () => ({ month: 1 }));
    expect(r.conflict).toBe(1);
    expect(r.details[0]).toMatchObject({ f65Month: 10, censusMonth: 1, fiscalYear: 2022 });
  });
});
