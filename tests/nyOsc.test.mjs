import { describe, it, expect } from 'vitest';
import { ERA_OLD, ERA_NEW, eraForHeader, sectionOf } from '../scripts/lib/nyOsc.mjs';

const OLD_HEADER = ['CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'CLASS_DESCRIPTION',
  'COUNTY', 'FISCAL_YEAR_END', 'ACCOUNT_CODE', 'ACCOUNT_CODE_NARRATIVE',
  'FINANCIAL_STATEMENT', 'FINANCIAL_STATEMENT_SEGMENT', 'LEVEL_1_CATEGORY',
  'LEVEL_2_CATEGORY', 'OBJECT_OF_EXPENDITURE', 'AMOUNT', 'SNAPSHOT_DATE'];

const NEW_HEADER = ['CALENDAR_YEAR', 'MUNICIPAL_CODE', 'ENTITY_NAME', 'CLASS_DESCRIPTION',
  'COUNTY', 'PERIOD_START', 'PERIOD_END', 'ACCOUNT_CODE', 'ACCOUNT_CODE_NARRATIVE',
  'ACCOUNT_CODE_SECTION', 'LEVEL_1_CATEGORY', 'LEVEL_2_CATEGORY',
  'OBJECT_OF_EXPENDITURE', 'AMOUNT', 'SNAPSHOT_DATE'];

describe('era detection', () => {
  it('reads the era off the header, not the filename', () => {
    expect(eraForHeader(OLD_HEADER)).toBe(ERA_OLD);
    expect(eraForHeader(NEW_HEADER)).toBe(ERA_NEW);
  });

  it('refuses a header it does not recognise', () => {
    expect(() => eraForHeader(['CALENDAR_YEAR', 'AMOUNT']))
      .toThrow(/unrecognised NY OSC header/i);
  });
});

describe('sectionOf', () => {
  it('maps the new era straight through', () => {
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'REVENUE' })).toBe('REVENUE');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'EXPENDITURE' })).toBe('EXPENDITURE');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'GL' })).toBe('OTHER');
    expect(sectionOf({ ACCOUNT_CODE_SECTION: 'FBNP' })).toBe('OTHER');
  });

  it('maps the old era off FINANCIAL_STATEMENT', () => {
    expect(sectionOf({ FINANCIAL_STATEMENT: 'STATEMENT OF REVENUES AND OTHER SOURCES' }))
      .toBe('REVENUE');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'STATEMENT OF EXPENDITURES AND OTHER USES' }))
      .toBe('EXPENDITURE');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'BALANCE SHEET' })).toBe('OTHER');
    expect(sectionOf({ FINANCIAL_STATEMENT: 'CHANGE IN EQUITY' })).toBe('OTHER');
  });
});

import { normLabel } from '../scripts/lib/nyOsc.mjs';

describe('normLabel', () => {
  it('collapses the 2012/2013 casing change to one label', () => {
    // The whole reason this function exists: loaded raw, one city grows TWO
    // parallel icicle branches across the era boundary -- at an exact $0 tie,
    // because casing moves no money.
    expect(normLabel('GENERAL GOVERNMENT')).toBe(normLabel('General Government'));
    expect(normLabel('REAL PROPERTY TAXES AND ASSESSMENTS'))
      .toBe(normLabel('Real Property Taxes and Assessments'));
  });

  it('produces Title Case, matching the modern era as published', () => {
    expect(normLabel('GENERAL GOVERNMENT')).toBe('General Government');
    expect(normLabel('CULTURE AND RECREATION')).toBe('Culture and Recreation');
  });

  it('keeps small words lowercase except in first position', () => {
    expect(normLabel('USE AND SALE OF PROPERTY')).toBe('Use and Sale of Property');
    expect(normLabel('CHARGES TO OTHER GOVERNMENTS')).toBe('Charges to Other Governments');
  });

  it('trims and collapses interior whitespace', () => {
    expect(normLabel('  PUBLIC   SAFETY  ')).toBe('Public Safety');
  });

  it('is idempotent', () => {
    expect(normLabel(normLabel('STATE AID'))).toBe('State Aid');
  });

  it('passes an empty label through as empty', () => {
    expect(normLabel('')).toBe('');
    expect(normLabel(null)).toBe('');
  });
});

import { parseAmount, buildNyTree } from '../scripts/lib/nyOsc.mjs';

describe('parseAmount', () => {
  it('parses decimals — the archive really contains these', () => {
    // City of Batavia A64601 FY2021 is literally "-.29".
    expect(parseAmount('-.29')).toBeCloseTo(-0.29, 6);
    expect(parseAmount('-1481.26')).toBeCloseTo(-1481.26, 6);
    expect(parseAmount('61667390')).toBe(61667390);
  });

  it('treats blank and null as zero', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });

  it('refuses a non-numeric string rather than coercing it to zero', () => {
    expect(() => parseAmount('n/a')).toThrow(/non-numeric amount/i);
  });
});

describe('buildNyTree', () => {
  const row = (l1, l2, obj, amt) => ({
    LEVEL_1_CATEGORY: l1, LEVEL_2_CATEGORY: l2,
    OBJECT_OF_EXPENDITURE: obj, AMOUNT: amt,
  });

  it('nests level 1 -> level 2 -> object and totals each node', () => {
    const { tree, total } = buildNyTree([
      row('General Government', 'Administration', 'Personal Services', '100'),
      row('General Government', 'Administration', 'Contractual', '50'),
      row('General Government', 'Finance', 'Personal Services', '25'),
      row('Public Safety', 'Police', 'Personal Services', '200'),
    ]);
    expect(total).toBe(375);
    expect(tree).toHaveLength(2);
    const gg = tree.find((n) => n.n === 'General Government');
    expect(gg.a).toBe(175);
    expect(gg.c.find((c) => c.n === 'Administration').a).toBe(150);
    expect(gg.c.find((c) => c.n === 'Administration').i).toEqual([
      { d: 'Personal Services', a: 100 },
      { d: 'Contractual', a: 50 },
    ]);
  });

  it('KEEPS negative amounts — they are real contra entries', () => {
    // ~28 a year across the archive. A builder that filters `> 0` silently
    // shrinks every total that contains one.
    const { tree, total } = buildNyTree([
      row('State Aid', 'Public Safety', 'Federal Aid', '1000'),
      row('State Aid', 'Public Safety', 'Federal Aid Other Public Safety', '-1481.26'),
    ]);
    expect(total).toBeCloseTo(-481.26, 6);
    expect(tree[0].c[0].i).toHaveLength(2);
  });

  it('drops rows that are exactly zero, and only those', () => {
    const { tree, total } = buildNyTree([
      row('State Aid', 'Aid', 'Grant', '0'),
      row('State Aid', 'Aid', 'Other', '-5'),
    ]);
    expect(total).toBe(-5);
    expect(tree[0].c[0].i).toEqual([{ d: 'Other', a: -5 }]);
  });

  it('never emits `aa` — this source has no appropriations', () => {
    const { tree } = buildNyTree([row('A', 'B', 'C', '10')]);
    const item = tree[0].c[0].i[0];
    expect(item).toEqual({ d: 'C', a: 10 });
    expect('aa' in item).toBe(false);
  });

  it('normalises labels so both eras land on one branch', () => {
    const { tree } = buildNyTree([
      row('GENERAL GOVERNMENT', 'ADMINISTRATION', 'PERSONAL SERVICES', '10'),
      row('General Government', 'Administration', 'Personal Services', '10'),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('General Government');
    expect(tree[0].a).toBe(20);
  });

  it('buckets a blank object of expenditure rather than dropping the money', () => {
    const { tree, total } = buildNyTree([row('Sales and Use Tax', 'Sales Tax', '', '46685814')]);
    expect(total).toBe(46685814);
    expect(tree[0].c[0].i[0].d).toBe('Total');
  });

  it('returns an empty tree and zero total for no rows', () => {
    expect(buildNyTree([])).toEqual({ tree: [], total: 0 });
  });
});

import { fiscalYearStartMonth } from '../scripts/lib/nyOsc.mjs';

describe('fiscalYearStartMonth', () => {
  it('reads PERIOD_START directly in the modern era', () => {
    expect(fiscalYearStartMonth({ PERIOD_START: '2024-01-01', PERIOD_END: '2024-12-31' })).toBe(1);
    expect(fiscalYearStartMonth({ PERIOD_START: '2023-07-01', PERIOD_END: '2024-06-30' })).toBe(7);
  });

  it('derives it from FISCAL_YEAR_END + 1 in the old era', () => {
    // Old files give MM/DD with no year at all.
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '12/31' })).toBe(1);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '06/30' })).toBe(7);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '03/31' })).toBe(4);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '07/31' })).toBe(8);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '05/31' })).toBe(6);
  });

  it('refuses a row that establishes no period', () => {
    expect(() => fiscalYearStartMonth({})).toThrow(/no fiscal period/i);
  });
});

import { existsSync } from 'node:fs';
import { ARCHIVE_PATH, readYear } from '../scripts/lib/nyOsc.mjs';

// ⚠ ARCHIVE_PATH must be a real exported path BEFORE the skip guard runs.
// existsSync(undefined) is merely false, so a missing export would silently
// skip every archive test instead of failing one -- a harness nobody runs.
const haveArchive = typeof ARCHIVE_PATH === 'string' && ARCHIVE_PATH.length > 0
  && existsSync(ARCHIVE_PATH);
const archiveIt = haveArchive ? it : it.skip;

describe('readYear (needs docs/NY/city_all_years.zip)', () => {
  it('exports a well-formed archive path', () => {
    // Unconditional: this one fails rather than skips when the export is gone.
    expect(typeof ARCHIVE_PATH).toBe('string');
    expect(ARCHIVE_PATH).toMatch(/city_all_years\.zip$/);
  });

  it('announces when the archive is absent instead of quietly skipping', () => {
    // The archive is gitignored, so CI genuinely cannot have it. That is fine
    // -- but a run where these tests vanished must say so out loud.
    if (!haveArchive) {
      console.warn(`\n  ⚠ ${ARCHIVE_PATH} absent — 4 archive-backed tests SKIPPED.`
        + ' Run `node scripts/fetchNyOsc.mjs` to enable them.\n');
    }
    expect(true).toBe(true);
  });

  archiveIt('reads a modern year and keeps only revenue and expenditure', () => {
    const rows = readYear(ARCHIVE_PATH, 2021);
    expect(rows.length).toBeGreaterThan(10000);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['REVENUE', 'EXPENDITURE']));
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(61);
    expect(rows.every((r) => r.fiscalYear === 2021)).toBe(true);
  });

  archiveIt('reads an old-era year with the same row shape', () => {
    const rows = readYear(ARCHIVE_PATH, 2010);
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(61);
    expect(new Set(rows.map((r) => r.section))).toEqual(new Set(['REVENUE', 'EXPENDITURE']));
    expect(rows.every((r) => r.fiscalYearStartMonth >= 1 && r.fiscalYearStartMonth <= 12)).toBe(true);
  });

  archiveIt('never returns a K or W schedule row', () => {
    for (const y of [2010, 2021]) {
      const bad = readYear(ARCHIVE_PATH, y).filter((r) => r.fundPrefix === 'K' || r.fundPrefix === 'W');
      expect(bad, `year ${y}`).toHaveLength(0);
    }
  });

  archiveIt('agrees with the measured era split on category casing', () => {
    // Review Focus #4, end to end: both eras normalise onto one label set.
    const l1 = (y) => new Set(readYear(ARCHIVE_PATH, y)
      .filter((r) => r.section === 'EXPENDITURE')
      .map((r) => normLabel(r.LEVEL_1_CATEGORY)));
    const old2012 = l1(2012);
    const new2013 = l1(2013);
    const shared = [...old2012].filter((x) => new2013.has(x));
    expect(shared.length).toBeGreaterThan(8);
    for (const s of shared) expect(s).toBe(normLabel(s));
  });
});

import { aggregateCityYear } from '../scripts/lib/nyOsc.mjs';

const R = (fundPrefix, l1, amt) => ({
  fundPrefix, section: 'EXPENDITURE',
  LEVEL_1_CATEGORY: l1, LEVEL_2_CATEGORY: 'Sub', OBJECT_OF_EXPENDITURE: 'Obj', AMOUNT: amt,
});

describe('aggregateCityYear', () => {
  it('general_fund takes the A fund alone', () => {
    const out = aggregateCityYear(
      [R('A', 'General Government', '100'), R('EW', 'Utilities', '900')],
      { section: 'EXPENDITURE', scope: 'general_fund' });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('total_governmental includes governmental funds and excludes proprietary', () => {
    const out = aggregateCityYear([
      R('A', 'General Government', '100'),
      R('H', 'Transportation', '50'),
      R('V', 'Debt Service', '25'),
      R('EW', 'Utilities', '900'),
      R('MS', 'General Government', '7'),
      R('TA', 'General Government', '3'),
    ], { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('total_governmental');
    expect(out.total).toBe(175);
  });

  it('an unclassifiable prefix makes the scope unknown, NOT a short sum', () => {
    const out = aggregateCityYear([
      R('A', 'General Government', '100'),
      R('CS', 'General Government', '40'),
    ], { section: 'EXPENDITURE', scope: 'total_governmental' });
    expect(out.scope).toBe('unknown');
    expect(out.unknownPrefixes).toEqual(['CS']);
  });

  it('an unclassifiable prefix does NOT disturb general_fund', () => {
    const out = aggregateCityYear([
      R('A', 'General Government', '100'),
      R('CS', 'General Government', '40'),
    ], { section: 'EXPENDITURE', scope: 'general_fund' });
    expect(out.scope).toBe('general_fund');
    expect(out.total).toBe(100);
  });

  it('filters by section', () => {
    const rows = [R('A', 'General Government', '100'),
      { ...R('A', 'State Aid', '70'), section: 'REVENUE' }];
    expect(aggregateCityYear(rows, { section: 'REVENUE', scope: 'general_fund' }).total).toBe(70);
  });

  it('returns an empty result for a city-year with no matching rows', () => {
    const out = aggregateCityYear([], { section: 'REVENUE', scope: 'general_fund' });
    expect(out).toMatchObject({ total: 0, tree: [] });
  });
});

import { NY_CITY_ENTITIES } from '../scripts/data/nyOscCityEntities.mjs';

describe('the NY city roster', () => {
  it('has exactly 61 cities', () => {
    expect(NY_CITY_ENTITIES).toHaveLength(61);
  });

  it('does not contain New York City', () => {
    // NYC is loaded from its own ACFRs (PR #243) and is absent from this
    // source entirely — OSC files it as a separate `cityny` dataset.
    const names = NY_CITY_ENTITIES.map((e) => e.name.toLowerCase());
    expect(names).not.toContain('new york');
    expect(names.some((n) => n.includes('new york'))).toBe(false);
  });

  it('stores display names without the "City of " prefix', () => {
    expect(NY_CITY_ENTITIES.some((e) => e.name === 'Albany')).toBe(true);
    expect(NY_CITY_ENTITIES.every((e) => !e.name.startsWith('City of '))).toBe(true);
  });

  it('carries a unique OSC municipal code and a county for every city', () => {
    expect(new Set(NY_CITY_ENTITIES.map((e) => e.municipalCode)).size).toBe(61);
    expect(NY_CITY_ENTITIES.every((e) => /^\d{12}$/.test(e.municipalCode))).toBe(true);
    expect(NY_CITY_ENTITIES.every((e) => e.county && e.county.length > 1)).toBe(true);
  });

  archiveIt('matches the archive exactly for a mid-window year', () => {
    const fromArchive = new Set(readYear(ARCHIVE_PATH, 2010).map((r) => r.municipalCode));
    expect(fromArchive.size).toBe(61);
    for (const e of NY_CITY_ENTITIES) expect(fromArchive.has(e.municipalCode), e.name).toBe(true);
  });

  archiveIt('covers every city in every loaded year FY1995-2021', () => {
    const known = new Set(NY_CITY_ENTITIES.map((e) => e.municipalCode));
    for (const fy of [1995, 2003, 2012, 2013, 2021]) {
      const inYear = new Set(readYear(ARCHIVE_PATH, fy).map((r) => r.municipalCode));
      expect(inYear.size, `FY${fy} entity count`).toBe(61);
      for (const c of inYear) expect(known.has(c), `FY${fy} has unknown city ${c}`).toBe(true);
    }
  });
});
