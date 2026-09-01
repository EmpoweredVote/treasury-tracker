import { describe, it, expect } from 'vitest';

import { canonicalMunicode, displayName, startMonthFromEndMonth, foldFilings }
  from '../scripts/buildMiStatewideRoster.mjs';
import { dedupeFilingRows, KNOWN_DUPLICATED_DETAIL } from '../scripts/lib/michiganF65.mjs';
import { MI_CENSUS_ALIASES, displayFromCensusName } from '../scripts/data/miCensusAliases.mjs';
import { MI_STATEWIDE_ENTITIES, entityByMunicode, entityByKey }
  from '../scripts/data/miStatewideEntities.mjs';
import { EXCLUDED_ENTITY_YEARS } from '../scripts/buildMiStatewideEntities.mjs';
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

describe('MI_STATEWIDE_ENTITIES', () => {
  it('covers every Michigan city and county that filed, and no duplicates', () => {
    expect(MI_STATEWIDE_ENTITIES.length).toBe(364);
    const codes = new Set(MI_STATEWIDE_ENTITIES.map((e) => e.municode));
    const keys = new Set(MI_STATEWIDE_ENTITIES.map((e) => e.key));
    expect(codes.size).toBe(MI_STATEWIDE_ENTITIES.length);
    expect(keys.size).toBe(MI_STATEWIDE_ENTITIES.length);
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

  it('has dropped every excluded entity-year', () => {
    for (const x of EXCLUDED_ENTITY_YEARS) {
      const e = entityByMunicode(x.municode);
      expect(e.fiscalYears, `${x.name} FY${x.fiscalYear}`).not.toContain(x.fiscalYear);
    }
  });

  // ⚠⚠ The load's own claim about itself. If a future edit widens the roster,
  // this is the number that has to move with it.
  it('accounts for exactly 5,771 entity-years', () => {
    const total = MI_STATEWIDE_ENTITIES.reduce((n, e) => n + e.fiscalYears.length, 0);
    expect(total).toBe(5771);
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
