import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  aggregateCityYear, classifyPrefix,
  SCHOOL_ARCHIVE_PATH, SCHOOL_ARCHIVE_URL, readYear,
} from '../scripts/lib/nyOsc.mjs';
import { NY_SCHOOL_ENTITIES } from '../scripts/data/nyOscSchoolEntities.mjs';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from '../scripts/data/nyOscSchoolFundPrefixes.mjs';

const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };
const R = (fundPrefix, amt) => ({
  fundPrefix, section: 'EXPENDITURE',
  LEVEL_1_CATEGORY: 'Education', LEVEL_2_CATEGORY: 'Sub',
  OBJECT_OF_EXPENDITURE: `o${fundPrefix}`, AMOUNT: amt,
});

describe('classifyPrefix with an injected registry', () => {
  it('defaults to the CITY registry when none is given', () => {
    expect(classifyPrefix('EW')).toEqual({ type: 'enterprise', name: 'Water' });
    expect(classifyPrefix('F')).toBeNull();           // cities have no bare F
  });

  it('uses the district registry when given one', () => {
    expect(classifyPrefix('F', NY_SCHOOL_FUND_PREFIXES))
      .toEqual({ type: 'special_revenue', name: 'Special Aid' });
    expect(classifyPrefix('EW', NY_SCHOOL_FUND_PREFIXES)).toBeNull();
  });
});

describe('aggregateCityYear for school districts', () => {
  it('⚠ INCLUDES the C food-service fund in total_governmental', () => {
    const out = aggregateCityYear(
      [R('A', '100'), R('C', '40'), R('F', '25'), R('TC', '7'), R('TE', '3')],
      { section: 'EXPENDITURE', scope: 'total_governmental', ...SCHOOL });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(165);   // A + C + F; TC and TE are fiduciary
  });

  it('general_fund is the A fund alone', () => {
    const out = aggregateCityYear([R('A', '100'), R('F', '900')],
      { section: 'EXPENDITURE', scope: 'general_fund', ...SCHOOL });
    expect(out.total).toBe(100);
  });

  it('a retired prefix makes the scope unknown, not a short sum', () => {
    const out = aggregateCityYear([R('A', '100'), R('CS', '40')],
      { section: 'EXPENDITURE', scope: 'total_governmental', ...SCHOOL });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['CS']);
  });

  it('a retired prefix does NOT disturb general_fund', () => {
    const out = aggregateCityYear([R('A', '100'), R('TN', '40')],
      { section: 'EXPENDITURE', scope: 'general_fund', ...SCHOOL });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('⚠ the city path is unchanged — a district fund is unknown to it', () => {
    // Review Focus #5: the new parameter must not leak either direction.
    const out = aggregateCityYear([R('A', '100'), R('F', '40')],
      { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['F']);
  });

  it('⚠ and a CITY enterprise fund is excluded, not refused, for a city', () => {
    const out = aggregateCityYear([R('A', '100'), R('EW', '900')],
      { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(100);
  });
});

const archiveIt = existsSync(SCHOOL_ARCHIVE_PATH) ? it : it.skip;

describe('the school archive', () => {
  it('exports a well-formed path and url', () => {
    expect(SCHOOL_ARCHIVE_PATH).toMatch(/school_all_years\.zip$/);
    expect(SCHOOL_ARCHIVE_URL).toMatch(/^https:\/\/wwe1\.osc\.state\.ny\.us\/.*schooldistrict_all_years\.zip$/);
  });

  archiveIt('reads a modern district year', () => {
    const rows = readYear(SCHOOL_ARCHIVE_PATH, 2021, 'SchoolDistrict');
    expect(rows.length).toBeGreaterThan(100000);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['REVENUE', 'EXPENDITURE']));

    // ⚠⚠ 689, NOT the 692 in §3 of the spec. Both numbers are right and they
    // count different things. 692 districts APPEAR in 2021_SchoolDistrict.csv;
    // only 689 filed a REVENUE or EXPENDITURE section. Measured from the raw
    // member: REVENUE 689, EXPENDITURE 689, GL 689, FBNP 692. The three that
    // filed balance-sheet sections ONLY are Berkshire UFSD, Hopevale and West
    // Park UFSD. `readYear` drops section OTHER, so it returns what is
    // loadable, which is the number that matters to the loader — those three
    // contribute no FY2021 row and that is correct, not a miss.
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(689);
  });

  archiveIt('reads an old-era district year with the same row shape', () => {
    const rows = readYear(SCHOOL_ARCHIVE_PATH, 2010, 'SchoolDistrict');
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(696);
    expect(rows.every((r) => r.fiscalYearStartMonth === 7)).toBe(true);
  });
});

describe('the district roster', () => {
  it('has 719 districts on 717 municipal codes', () => {
    // ⚠ The counts DIFFER ON PURPOSE. Two codes carry two spellings each:
    //   260631600100  Gates Chili / Gates-Chili Central School District
    //   140936100300  Hopevale / Hopevale School District
    // Keying on the NAME would fork both. The roster keeps one row per NAME so
    // every spelling resolves, and treasury_ensure_municipality collapses them
    // onto one entity by code, recording the other spelling as an alias.
    expect(NY_SCHOOL_ENTITIES).toHaveLength(719);
    expect(new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode)).size).toBe(717);
  });

  it('names the two double-spelled codes explicitly', () => {
    const dupes = new Map();
    for (const e of NY_SCHOOL_ENTITIES) {
      if (!dupes.has(e.municipalCode)) dupes.set(e.municipalCode, []);
      dupes.get(e.municipalCode).push(e.name);
    }
    const multi = [...dupes.entries()].filter(([, n]) => n.length > 1).map(([c]) => c).sort();
    expect(multi).toEqual(['140936100300', '260631600100']);
  });

  it('carries a well-formed code and a county for every district', () => {
    expect(NY_SCHOOL_ENTITIES.every((e) => /^\d{12}$/.test(e.municipalCode))).toBe(true);
    expect(NY_SCHOOL_ENTITIES.every((e) => e.county && e.county.length > 1)).toBe(true);
    expect(NY_SCHOOL_ENTITIES.every((e) => e.name && e.name.length > 1)).toBe(true);
  });

  archiveIt('covers every district in every sampled year', () => {
    const known = new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode));
    for (const fy of [1995, 2003, 2012, 2013, 2021, 2025]) {
      for (const c of new Set(readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')
        .map((r) => r.municipalCode))) {
        expect(known.has(c), `FY${fy} has unknown district ${c}`).toBe(true);
      }
    }
  });
});
