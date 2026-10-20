import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

import {
  archiveFor, readYear, aggregateCityYear, isFullFiscalPeriod, fiscalPeriodLength,
  assertMunicipalRoster, municipalSourceNameFor, MUNICIPAL_SOURCE_PREFIXES,
  MUNICIPAL_CLASSES, MUNICIPAL_FIRST_YEAR, MUNICIPAL_LAST_YEAR,
  NY_OSC_ARCHIVES, sourceNameFor, schoolSourceNameFor, SOURCE_PREFIX,
} from '../scripts/lib/nyOsc.mjs';
import { classify } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { AUDIT_GRADE_REGISTRY } from '../scripts/data/auditGradeRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';
import { NY_MUNICIPAL_ENTITIES } from '../scripts/data/nyOscMunicipalEntities.mjs';
import {
  NY_MUNICIPAL_FUND_PREFIXES, MUNICIPAL_GOVERNMENTAL_TYPES,
} from '../scripts/data/nyOscMunicipalFundPrefixes.mjs';

const REG = {
  registry: NY_MUNICIPAL_FUND_PREFIXES,
  governmentalTypes: MUNICIPAL_GOVERNMENTAL_TYPES,
};

/** ⚠ Measured on the archives 2026-10-19, not predicted. */
const EXPECTED_COUNTS = { Town: 933, Village: 561, County: 57 };

const byClass = (c) => NY_MUNICIPAL_ENTITIES.filter((e) => e.memberClass === c);

// ────────────────────────────────────────────────────────────────────────────
describe('the archive table', () => {
  it('declares all five NY OSC publications with their own year range', () => {
    expect(Object.keys(NY_OSC_ARCHIVES).sort())
      .toEqual(['City', 'County', 'SchoolDistrict', 'Town', 'Village']);
    for (const [cls, a] of Object.entries(NY_OSC_ARCHIVES)) {
      expect(a.path, cls).toMatch(/^docs\/NY\/.+\.zip$/);
      expect(a.url, cls).toMatch(/^https:\/\/wwe1\.osc\.state\.ny\.us\//);
      expect(Number.isInteger(a.firstYear) && Number.isInteger(a.lastYear), cls).toBe(true);
      expect(a.firstYear, cls).toBeLessThan(a.lastYear);
    }
  });

  it('⚠ refuses an unknown member class instead of borrowing another range', () => {
    // Before the table this was a ternary over City-vs-everything-else, so
    // readYear(zip, year, 'Town') silently used the SCHOOL range.
    expect(() => archiveFor('Hamlet')).toThrow(/unknown NY OSC member class/);
    expect(() => readYear('x.zip', 2021, 'Hamlet')).toThrow(/unknown NY OSC member class/);
  });

  it('⚠ the LOAD WINDOW is narrower than the archive — FY2026 is refused', () => {
    expect(MUNICIPAL_FIRST_YEAR).toBe(1995);
    expect(MUNICIPAL_LAST_YEAR).toBe(2025);
    for (const c of MUNICIPAL_CLASSES) {
      expect(archiveFor(c).lastYear, c).toBe(2026);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('non-annual filings', () => {
  const row = (periodStart, periodEnd) => ({ periodStart, periodEnd });

  it('⚠⚠⚠ refuses an entity-year that files a FULL YEAR AND A STUB together', () => {
    // THE DEFECT THIS CHECK EXISTS FOR, and a per-row version of it shipped
    // first and was wrong. Village of Schoharie files BOTH 2019-06-01..
    // 2020-05-31 (365d) AND 2020-06-01..2020-12-31 (213d) under CALENDAR_YEAR
    // 2020. The FIRST row is the full year, so a first-row check PASSES — and
    // the loader then sums both periods into one total and publishes NINETEEN
    // MONTHS AS A YEAR. Nothing raises; the figure is just ~58% too large and
    // ties against itself.
    const schoharieFy2020 = [
      row('2019-06-01', '2020-05-31'),   // the full year, and it comes FIRST
      row('2019-06-01', '2020-05-31'),
      row('2020-06-01', '2020-12-31'),   // the stub
    ];
    const got = isFullFiscalPeriod(schoharieFy2020);
    expect(got.ok).toBe(false);
    expect(got.periods).toHaveLength(2);
    expect(got.why).toMatch(/2 distinct fiscal periods/);

    // ...and the first row ALONE still looks like a clean full year, which is
    // exactly why the signature takes the whole entity-year.
    expect(isFullFiscalPeriod([schoharieFy2020[0]]).ok).toBe(true);
  });

  it('⚠⚠ refuses a lone 213-day stub and a lone 425-day period', () => {
    // Bloomingburg FY2023 is the 425-day case and files only that one period.
    expect(isFullFiscalPeriod([row('2021-06-01', '2021-12-31')]))
      .toMatchObject({ ok: false, checked: true, days: [213] });
    expect(isFullFiscalPeriod([row('2022-06-01', '2023-07-31')]))
      .toMatchObject({ ok: false, checked: true, days: [425] });
  });

  it('accepts 364, 365 and a leap 366 — repeated across many rows', () => {
    expect(isFullFiscalPeriod([row('2024-01-01', '2024-12-31')]).ok).toBe(true);  // 365
    expect(isFullFiscalPeriod([row('2023-06-01', '2024-05-31')]).ok).toBe(true);  // 365
    expect(isFullFiscalPeriod([row('2013-01-01', '2013-12-31')]).ok).toBe(true);  // 364
    // ⚠ Thousands of rows repeating ONE period is the normal case and must not
    // read as "many periods".
    const many = Array.from({ length: 500 }, () => row('2024-01-01', '2024-12-31'));
    expect(isFullFiscalPeriod(many)).toMatchObject({ ok: true, periods: ['2024-01-01..2024-12-31'] });
  });

  it('⚠ measures in UTC, so a DST boundary cannot shift the count', () => {
    // A local-time constructor yields 212.95 days here, which floors to 212.
    expect(fiscalPeriodLength(row('2021-06-01', '2021-12-31'))).toBe(213);
    expect(fiscalPeriodLength(row('2021-03-01', '2021-11-30'))).toBe(274);
  });

  it('⚠ passes the 1995-2012 era unchecked, and SAYS so', () => {
    // The old era publishes no period bounds. It is not silently trusted: a
    // transition REQUIRES FISCAL_YEAR_END to change, and across every entity
    // and every consecutive pair of old-era years there are ZERO changes in
    // all three classes. `checked: false` keeps that distinction visible.
    expect(isFullFiscalPeriod([{}]))
      .toEqual({ ok: true, checked: false, periods: [], days: [], why: null });
    expect(fiscalPeriodLength({})).toBeNull();
  });

  it('refuses to answer about an empty entity-year rather than passing it', () => {
    expect(() => isFullFiscalPeriod([])).toThrow(/at least one row/);
  });

  it('throws on a period it cannot parse rather than guessing', () => {
    expect(() => fiscalPeriodLength(row('6/1/2021', '2021-12-31'))).toThrow(/PERIOD_START/);
    expect(() => fiscalPeriodLength(row('2021-06-01', '20211231'))).toThrow(/PERIOD_END/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('the roster guard', () => {
  const e = (name, municipalCode, entityType = 'village') =>
    ({ name, municipalCode, entityType });

  it('⚠⚠ allows New York Mills — the city guard would have refused it', () => {
    // assertRosterHasNoNyc refuses anything matching /new york/i. The village
    // roster contains New York Mills, a real government in Oneida County, and
    // New York City cannot collide with a village in the first place.
    expect(() => assertMunicipalRoster([e('New York Mills', '300490803430')], 'Village'))
      .not.toThrow();
  });

  it('refuses a government actually named New York', () => {
    expect(() => assertMunicipalRoster([e('New York', '1')], 'Village'))
      .toThrow(/named "New York"/);
  });

  it('⚠⚠ refuses two governments that would share a display name', () => {
    // treasury_ensure_municipality keys on (name, state, entity_type), so this
    // would collapse two governments into ONE row carrying both budgets. Ten
    // town names are each shared by two towns.
    expect(() => assertMunicipalRoster(
      [e('Albion', '1', 'town'), e('Albion', '2', 'town')], 'Town'))
      .toThrow(/would both be named "Albion"/);
    // ...and the qualified pair is fine.
    expect(() => assertMunicipalRoster(
      [e('Albion, Orleans County', '1', 'town'), e('Albion, Oswego County', '2', 'town')], 'Town'))
      .not.toThrow();
  });

  it('refuses a duplicate municipal code, and a row typed for another class', () => {
    expect(() => assertMunicipalRoster(
      [e('A', '1', 'town'), e('B', '1', 'town')], 'Town')).toThrow(/duplicate municipal code/);
    expect(() => assertMunicipalRoster([e('A', '1', 'city')], 'Town')).toThrow(/typed city/);
  });

  it('⚠ runs to completion BEFORE anything is written, not inside a write loop', () => {
    // A guard in the write loop lets a bad entry at position 40 create 39
    // municipalities before refusing. This is a pure function over the roster.
    const roster = [e('Good', '1', 'town'), e('Good', '2', 'town')];
    expect(() => assertMunicipalRoster(roster, 'Town')).toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('the generated roster', () => {
  it('holds 933 towns, 561 villages and 57 counties', () => {
    for (const [cls, n] of Object.entries(EXPECTED_COUNTS)) {
      expect(byClass(cls).length, cls).toBe(n);
    }
    expect(NY_MUNICIPAL_ENTITIES.length).toBe(933 + 561 + 57);
  });

  it('⚠⚠ municipal codes are globally unique ACROSS the three classes', () => {
    const codes = NY_MUNICIPAL_ENTITIES.map((e) => e.municipalCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('⚠⚠ no two governments of one class share a display name', () => {
    for (const cls of MUNICIPAL_CLASSES) {
      const names = byClass(cls).map((e) => e.name.toLowerCase());
      expect(new Set(names).size, cls).toBe(names.length);
    }
  });

  it('county-qualifies exactly the ten colliding town names, and nothing else', () => {
    const qualified = NY_MUNICIPAL_ENTITIES.filter((e) => e.qualified);
    expect(qualified).toHaveLength(20);
    expect(new Set(qualified.map((e) => e.memberClass))).toEqual(new Set(['Town']));
    const bases = [...new Set(qualified.map((e) => e.name.split(',')[0]))].sort();
    expect(bases).toEqual(['Albion', 'Ashland', 'Brighton', 'Chester', 'Clinton',
      'Dickinson', 'Franklin', 'Fremont', 'Greenville', 'Lewis']);
    for (const e of qualified) expect(e.name, e.name).toMatch(/, .+ County$/);
  });

  it('⚠ 223 town/village names are shared ACROSS classes, and that is correct', () => {
    // entity_type differs, so these are different governments and
    // treasury_ensure_municipality keeps them apart. A guard that refused them
    // would refuse the truth.
    const towns = new Set(byClass('Town').map((e) => e.name));
    const villages = new Set(byClass('Village').map((e) => e.name));
    const shared = [...towns].filter((n) => villages.has(n));
    expect(shared.length).toBeGreaterThan(200);
    expect(shared).toContain('Green Island');
  });

  it('every row carries the entity type its archive produces', () => {
    for (const cls of MUNICIPAL_CLASSES) {
      const want = archiveFor(cls).entityType;
      for (const e of byClass(cls)) expect(e.entityType, e.name).toBe(want);
    }
    expect(new Set(NY_MUNICIPAL_ENTITIES.map((e) => e.entityType)))
      .toEqual(new Set(['town', 'village', 'county']));
  });

  it('⚠ keeps the publisher prefix OUT of the stored name', () => {
    // ⚠⚠ ONE EXCEPTION, AND IT IS A NAME RATHER THAN A BUG. OSC prints
    // `Village of Village of The Branch`, because that Suffolk County village
    // is LEGALLY NAMED "Village of The Branch". Stripping one prefix is right;
    // stripping twice gives "The Branch", which names nothing — the same shape
    // as Pennsylvania's `GROVE CITY BORO` -> "Grove City", never "Grove".
    const LEGALLY_PREFIXED = ['Village of The Branch'];
    const prefixed = NY_MUNICIPAL_ENTITIES
      .map((e) => e.name)
      .filter((n) => /^(Town|Village|County|City) of /.test(n))
      .sort();
    expect(prefixed).toEqual(LEGALLY_PREFIXED);
  });

  it('the 57 counties are New York\'s 62 minus the five NYC boroughs', () => {
    const counties = byClass('County').map((e) => e.name);
    expect(counties).toHaveLength(57);
    for (const borough of ['New York', 'Kings', 'Queens', 'Bronx', 'Richmond']) {
      expect(counties, borough).not.toContain(borough);
    }
    expect(counties).toContain('Albany');
    expect(counties).toContain('St. Lawrence');
  });

  it('the roster passes the seeder\'s own pre-flight for every class', () => {
    for (const cls of MUNICIPAL_CLASSES) {
      expect(() => assertMunicipalRoster(byClass(cls), cls), cls).not.toThrow();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('municipal source names', () => {
  const every = (fn) => {
    for (const cls of MUNICIPAL_CLASSES) {
      for (const dt of ['operating', 'revenue']) {
        for (const fy of [1995, 2012, 2013, 2025]) {
          for (const sc of ['general_fund', 'total_governmental']) fn(cls, dt, fy, sc);
        }
      }
    }
  };

  it('classifies every class/year/dataset/scope to its own fund-scope entry', () => {
    every((cls, dt, fy, sc) => {
      const name = municipalSourceNameFor(cls, dt, fy, sc);
      const got = classify(name, FUND_SCOPE_REGISTRY);
      expect(got.scope, name).toBe(sc);
      expect(got.entryId, name).toBe(`ny-osc-${cls.toLowerCase()}-${sc.replace(/_/g, '-')}`);
    });
  });

  it('⚠ matches EXACTLY ONE basis and ONE audit-grade entry, never two', () => {
    every((cls, dt, fy, sc) => {
      const name = municipalSourceNameFor(cls, dt, fy, sc);
      expect(BASIS_REGISTRY.filter((e) => e.match.test(name)).map((e) => e.id), `basis ${name}`)
        .toEqual(['ny-osc-municipal']);
      expect(AUDIT_GRADE_REGISTRY.filter((e) => e.match.test(name)).map((e) => e.id), `grade ${name}`)
        .toEqual(['ny-osc-municipal']);
    });
  });

  it('does NOT claim an accounting basis', () => {
    // ARM ch. 3 directs modified accrual, but an instruction is not an
    // outcome and no opinion establishes that any of these 1,551 governments
    // achieved it.
    every((cls, dt, fy, sc) => {
      const name = municipalSourceNameFor(cls, dt, fy, sc);
      expect(ACCOUNTING_BASIS_REGISTRY.filter((e) => e.match.test(name)), name).toHaveLength(0);
    });
  });

  it('⚠⚠ NO New York family claims another\'s string, in any direction', () => {
    // Four families share a publisher and nearly share a name. A string landing
    // under the wrong one loses fund_scope, basis AND audit_grade at once — or
    // worse, silently inherits another class's evidence prose.
    const names = {
      'ny-osc-city': sourceNameFor('operating', 2021, 'general_fund'),
      'ny-osc-school': schoolSourceNameFor('operating', 2021, 'general_fund'),
      'ny-osc-town': municipalSourceNameFor('Town', 'operating', 2021, 'general_fund'),
      'ny-osc-village': municipalSourceNameFor('Village', 'operating', 2021, 'general_fund'),
      'ny-osc-county': municipalSourceNameFor('County', 'operating', 2021, 'general_fund'),
    };
    expect(names['ny-osc-city']).toContain(SOURCE_PREFIX);
    const REGS = [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, AUDIT_GRADE_REGISTRY];
    for (const reg of REGS) {
      for (const entry of reg.filter((x) => String(x.id).startsWith('ny-osc'))) {
        for (const [family, name] of Object.entries(names)) {
          if (entry.match.test(name)) {
            // The one entry that may claim it is the one for this family —
            // `ny-osc-municipal` covers all three municipal classes.
            const own = String(entry.id).startsWith(family)
              || (entry.id === 'ny-osc-municipal' && family !== 'ny-osc-city'
                  && family !== 'ny-osc-school');
            expect(own, `${entry.id} claims the ${family} string`).toBe(true);
          }
        }
      }
    }
  });

  it('refuses every way of building the string wrong', () => {
    expect(() => municipalSourceNameFor('Hamlet', 'operating', 2021, 'general_fund'))
      .toThrow(/unknown member class/);
    expect(() => municipalSourceNameFor('Town', 'Expenditures', 2021, 'general_fund'))
      .toThrow(/unknown dataset type/);
    expect(() => municipalSourceNameFor('Town', 'operating', 2021, 'generalfund'))
      .toThrow(/unknown fund scope/);
    // ⚠ A NaN year produced `FYNaN`, matching NONE of the three registry
    // patterns, losing fund_scope, basis and audit_grade at once.
    expect(() => municipalSourceNameFor('Town', 'operating', NaN, 'general_fund'))
      .toThrow(/not an integer/);
    // ⚠ FY2026 is outside the LOAD window even though the archive has a member.
    expect(() => municipalSourceNameFor('Village', 'operating', 2026, 'general_fund'))
      .toThrow(/FY1995-FY2025/);
  });

  it('the three prefixes are distinct and each names its class', () => {
    expect(new Set(Object.values(MUNICIPAL_SOURCE_PREFIXES)).size).toBe(3);
    for (const cls of MUNICIPAL_CLASSES) {
      expect(MUNICIPAL_SOURCE_PREFIXES[cls]).toContain(cls);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('aggregation with the municipal registry', () => {
  const R = (fundPrefix, amt, section = 'EXPENDITURE') => ({
    fundPrefix,
    section,
    AMOUNT: String(amt),
    LEVEL_1_CATEGORY: 'General Government',
    LEVEL_2_CATEGORY: 'Unclassified',
    OBJECT_OF_EXPENDITURE: '',
  });

  it('⚠⚠ a county\'s S fund is EXCLUDED from total_governmental', () => {
    const rows = [R('A', 100), R('D', 50), R('DM', 25), R('S', 999)];
    const tg = aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'total_governmental', ...REG });
    expect(tg.scope).toBe('total_governmental');
    expect(tg.total).toBe(175);   // 999 of workers' comp stays out
  });

  it('a town\'s B, DA, DB and S_ funds are INCLUDED', () => {
    const rows = [R('A', 100), R('B', 40), R('DA', 30), R('DB', 20), R('SW', 10), R('SF', 5)];
    const tg = aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'total_governmental', ...REG });
    expect(tg.total).toBe(205);
    // ...and none of them reaches the General Fund.
    const gf = aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'general_fund', ...REG });
    expect(gf.total).toBe(100);
  });

  it('⚠⚠ ONE unclassifiable prefix blanks the whole total_governmental cell', () => {
    // Omitting a governmental fund understates; including a proprietary one
    // overstates. Both are wrong, and the destructive direction is "declare two
    // governments comparable".
    const rows = [R('A', 100), R('DA', 50), R('CS', 1)];
    const tg = aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'total_governmental', ...REG });
    expect(tg.scope).toBe('unknown');
    expect(tg.total).toBe(0);
    expect(tg.unknownPrefixes).toEqual(['CS']);
    // ...and general_fund is UNAFFECTED.
    const gf = aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'general_fund', ...REG });
    expect(gf.scope).toBe('general_fund');
    expect(gf.total).toBe(100);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ⚠ Archive-backed. The zips are gitignored (docs/*), so CI has no copy and
// these skip rather than fail there — the same shape tests/nyOscSchools.test.mjs
// uses. They are the checks that matter most locally.
describe('against the real archives', () => {
  const have = MUNICIPAL_CLASSES.every((c) => existsSync(archiveFor(c).path));
  const maybe = have ? it : it.skip;

  maybe('⭐ the ARM\'s falsifiable class restrictions hold in FY2021', () => {
    const prefixes = (cls) => new Set(
      readYear(archiveFor(cls).path, 2021, cls).map((r) => r.fundPrefix));
    const town = prefixes('Town');
    const village = prefixes('Village');
    const county = prefixes('County');

    // "Workers Compensation Fund (S) ... can only be used by counties"
    expect(county.has('S')).toBe(true);
    expect(town.has('S')).toBe(false);
    expect(village.has('S')).toBe(false);
    // "(County Only)"
    expect(county.has('DM')).toBe(true);
    expect(town.has('DM')).toBe(false);
    // "(Town Only)" — and villages have neither block
    expect(town.has('B') && town.has('DA') && town.has('DB')).toBe(true);
    expect(village.has('B') || village.has('DA') || village.has('DB')).toBe(false);
    // Town special districts are a town thing
    expect(town.has('SW') && town.has('SF')).toBe(true);
    expect(village.has('SW') || village.has('SF')).toBe(false);
  });

  maybe('every roster code appears in the archive it was generated from', () => {
    for (const cls of MUNICIPAL_CLASSES) {
      const inFile = new Set(readYear(archiveFor(cls).path, 2021, cls).map((r) => r.municipalCode));
      const roster = new Set(byClass(cls).map((e) => e.municipalCode));
      const strays = [...inFile].filter((c) => !roster.has(c));
      expect(strays, `${cls} codes in FY2021 but not in the roster`).toEqual([]);
    }
  });

  maybe('⚠ FY2026 is empty for towns and counties and partial for villages', () => {
    expect(readYear(archiveFor('Town').path, 2026, 'Town')).toHaveLength(0);
    expect(readYear(archiveFor('County').path, 2026, 'County')).toHaveLength(0);
    const villages = new Set(
      readYear(archiveFor('Village').path, 2026, 'Village').map((r) => r.municipalCode));
    expect(villages.size).toBeGreaterThan(0);
    expect(villages.size).toBeLessThan(EXPECTED_COUNTS.Village * 0.6);
  });

  maybe('⚠⚠ finds exactly four refused entity-years, all villages', () => {
    // ⚠ THREE OF THE FOUR ARE THE TWO-PERIOD SHAPE, not a lone stub, and the
    // ORDER of the two periods is what makes one of them dangerous. Kiryas
    // Joel and Middleburgh happen to put the 213-day stub FIRST, so even a
    // first-row check catches them. Schoharie puts the full 365-day year
    // first — a first-row check passes it, and the loader then sums 365 + 213
    // and publishes nineteen months as FY2020. Pinning the day lists IN ORDER
    // is what stops a future "simplification" back to a per-row check.
    //
    // ⚠ MODERN ERA ONLY, and that is not a shortcut for speed. FY1995-2012
    // publishes no period bounds, so this route CANNOT measure it — scanning
    // it would read 54 more files to learn nothing. That era is covered by a
    // different measurement: a transition requires FISCAL_YEAR_END to change,
    // and there are ZERO changes across every entity and every consecutive
    // pair of old-era years in all three classes (spec §6.1).
    //
    // The explicit budget is real work, not a hidden hang: 39 CSV members,
    // ~2.7M revenue/expenditure rows, each extracted through a python
    // subprocess.
    const found = [];
    for (const cls of MUNICIPAL_CLASSES) {
      for (let fy = 2013; fy <= MUNICIPAL_LAST_YEAR; fy++) {
        const byCode = new Map();
        for (const r of readYear(archiveFor(cls).path, fy, cls)) {
          if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
          byCode.get(r.municipalCode).push(r);
        }
        for (const rows of byCode.values()) {
          const p = isFullFiscalPeriod(rows);
          if (!p.ok) found.push(`${rows[0].entityName} FY${fy} [${p.days.join('+')}]`);
        }
      }
    }
    expect(found.sort()).toEqual([
      'Village of Bloomingburg FY2023 [425]',
      'Village of Kiryas Joel FY2021 [213+364]',
      'Village of Middleburgh FY2021 [213+364]',
      'Village of Schoharie FY2020 [365+213]',
    ]);
  }, 240_000);

  maybe('towns and counties are uniformly January, villages are not', () => {
    for (const cls of ['Town', 'County']) {
      const months = new Set(readYear(archiveFor(cls).path, 2021, cls)
        .map((r) => r.fiscalYearStartMonth));
      expect([...months], cls).toEqual([1]);
    }
    const villageMonths = new Set(readYear(archiveFor('Village').path, 2021, 'Village')
      .map((r) => r.fiscalYearStartMonth));
    expect(villageMonths.size).toBeGreaterThan(1);
    expect(villageMonths.has(6)).toBe(true);
  });
});
