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

  it('treats a blank cell as zero — it is the publisher\'s own nil', () => {
    // 7,068 revenue/expenditure rows FY2000-2012 carry a blank AMOUNT.
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
  });

  it('THROWS on undefined — that is a missing column, not a nil', () => {
    // Blank and undefined are different facts. `undefined` means the column
    // was absent or the row was short; coercing it to 0 let a renamed AMOUNT
    // column produce an empty tree with a $0 total and no error at all.
    expect(() => parseAmount(undefined)).toThrow(/column missing/i);
  });

  it('refuses the values Number() would silently accept', () => {
    // An anchored decimal regex, not Number(). The realistic hazard is an
    // Excel round-trip emitting `1.23457E+08`, which Number() parses
    // SUCCESSFULLY with lost precision rather than throwing.
    for (const v of ['0x10', '1e5', '1.23457E+08', 'Infinity', '1,234', '(500)', '$5']) {
      expect(() => parseAmount(v), v).toThrow(/non-numeric amount/i);
    }
  });

  it('treats a whitespace-only cell as blank, not as an error', () => {
    // Deliberate: a cell holding only spaces is the publisher's nil with
    // stray whitespace, the same fact as an empty cell.
    expect(parseAmount(' ')).toBe(0);
    expect(parseAmount('\t')).toBe(0);
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

import { ARCHIVE_PATH, readYear } from '../scripts/lib/nyOsc.mjs';
import { makeArchiveIt } from './support/nyOscArchive.mjs';

// ⚠ ARCHIVE_PATH must be a real exported path BEFORE the skip guard runs.
// existsSync(undefined) is merely false, so a missing export would silently
// skip every archive test instead of failing one -- a harness nobody runs.
const archiveIt = makeArchiveIt();

describe('readYear (needs docs/NY/city_all_years.zip)', () => {
  it('exports a well-formed archive path', () => {
    // Unconditional: this one fails rather than skips when the export is gone.
    expect(typeof ARCHIVE_PATH).toBe('string');
    expect(ARCHIVE_PATH).toMatch(/city_all_years\.zip$/);
  });

  it('announces when the archive is absent instead of quietly skipping', () => {
    // The archive is gitignored, so CI genuinely cannot have it. That is fine
    // -- but a run where these tests vanished must say so out loud, with the
    // REAL count. See tests/support/nyOscArchive.mjs: the number is derived,
    // because the hardcoded one said 4 while CI skipped 11.
    archiveIt.warnIfMissing();
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

  archiveIt('normalises both eras onto ONE label set, at every level', () => {
    // Review Focus #4, end to end -- and this is the assertion spec §4.2
    // actually asked for. The previous version of this test compared the
    // INTERSECTION (`shared.length > 8`, which passes while any number of
    // labels double) and then looped `expect(s).toBe(normLabel(s))` over
    // outputs of normLabel -- vacuously true, since normLabel is idempotent.
    // It could not fail, and it never looked below LEVEL_1. It missed a real
    // $830M split: "Interest & Penalties" vs "Interest and Penalties".
    // ⚠ Compare ERA UNIONS, not two adjacent years. A single-year comparison
    // is noisy: `Federal Aid - Utilities` is in FY2012 and absent from FY2013,
    // but present again in FY2017 — a reporting gap, not a rename.
    const union = (years, level, section) => {
      const s = new Set();
      for (const y of years) {
        for (const r of readYear(ARCHIVE_PATH, y)) {
          if (r.section !== section) continue;
          const v = normLabel(r[level]);
          if (v) s.add(v);
        }
      }
      return s;
    };
    const OLD_YEARS = [1995, 2003, 2012];
    const NEW_YEARS = [2013, 2017, 2021];

    // Labels genuinely retired at the boundary, not casing or ampersand
    // splits. Named individually so a NEW divergence fails the test instead of
    // hiding behind a loose threshold — which is exactly how the ampersand
    // split survived the first version of this test.
    const RETIRED = new Set([
      'Miscellaneous Other Sources', 'Community Services Charges',
      'Social Service Administration', 'Public Health Facilities',
    ]);

    for (const level of ['LEVEL_1_CATEGORY', 'LEVEL_2_CATEGORY', 'OBJECT_OF_EXPENDITURE']) {
      for (const section of ['REVENUE', 'EXPENDITURE']) {
        const before = union(OLD_YEARS, level, section);
        const after = union(NEW_YEARS, level, section);
        const onlyOld = [...before].filter((x) => !after.has(x) && !RETIRED.has(x));
        expect(onlyOld, `${level}/${section}: old era only, unaccounted for`).toEqual([]);
      }
    }
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

import { SOURCE_PREFIX, sourceNameFor } from '../scripts/lib/nyOsc.mjs';
import { classify } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { AUDIT_GRADE_REGISTRY } from '../scripts/data/auditGradeRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';

describe('source naming and registry coverage', () => {
  it('names the source distinctly per scope', () => {
    const gf = sourceNameFor('operating', 2021, 'general_fund');
    const tg = sourceNameFor('operating', 2021, 'total_governmental');
    expect(gf).toContain(SOURCE_PREFIX);
    expect(gf).not.toBe(tg);
  });

  it('classifies both scopes from the registry', () => {
    // classify() returns { scope, entryId } -- not a bare string.
    expect(classify(sourceNameFor('operating', 2021, 'general_fund'), FUND_SCOPE_REGISTRY).scope)
      .toBe('general_fund');
    expect(classify(sourceNameFor('revenue', 2005, 'total_governmental'), FUND_SCOPE_REGISTRY).scope)
      .toBe('total_governmental');
    // the matching entry is named, so a future loose pattern elsewhere is visible
    expect(classify(sourceNameFor('operating', 2021, 'general_fund'), FUND_SCOPE_REGISTRY).entryId)
      .toBe('ny-osc-city-general-fund');
  });

  it('matches every year in the load window, both datasets, both scopes', () => {
    for (const fy of [1995, 2000, 2012, 2013, 2021]) {
      for (const dt of ['operating', 'revenue']) {
        for (const sc of ['general_fund', 'total_governmental']) {
          const name = sourceNameFor(dt, fy, sc);
          expect(classify(name, FUND_SCOPE_REGISTRY).scope, name).toBe(sc);
          expect(BASIS_REGISTRY.some((e) => e.match.test(name)), `basis ${name}`).toBe(true);
          expect(AUDIT_GRADE_REGISTRY.some((e) => e.match.test(name)), `grade ${name}`).toBe(true);
        }
      }
    }
  });

  it('does NOT claim an accounting basis', () => {
    // Spec §6.1: the ARM directs modified accrual, but no audit establishes
    // that any city achieved GAAP. Asserting it would convert an instruction
    // into an outcome across 61 cities at once.
    const hit = ACCOUNTING_BASIS_REGISTRY.filter((e) =>
      e.match.test(sourceNameFor('operating', 2021, 'general_fund')));
    expect(hit).toHaveLength(0);
  });

  it('does not claim any source outside NY OSC', () => {
    const foreign = ['CA State Controller - Expenditures',
      'Pennsylvania DCED Municipal Annual Audit and Financial Report — Revenues (FY2023 actual)',
      'New York City ACFR — General Fund (FY2024 actual)'];
    const mine = (reg) => reg.filter((x) => String(x.id).startsWith('ny-osc'));
    for (const f of foreign) {
      for (const reg of [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, AUDIT_GRADE_REGISTRY]) {
        for (const e of mine(reg)) {
          expect(e.match.test(f), `${e.id} claims ${f}`).toBe(false);
        }
      }
    }
  });
});
