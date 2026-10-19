import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  aggregateCityYear, classifyPrefix,
  SCHOOL_ARCHIVE_PATH, SCHOOL_ARCHIVE_URL, readYear,
  isForeignRow, SCHOOL_SOURCE_PREFIX, schoolSourceNameFor, sourceNameFor, SOURCE_PREFIX,
} from '../scripts/lib/nyOsc.mjs';
import { classify } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { AUDIT_GRADE_REGISTRY } from '../scripts/data/auditGradeRegistry.mjs';
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';
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

/**
 * ⚠⚠ THE GUARD MUST KEY ON ROW PRESENCE, NEVER ON THE TRUTHINESS OF
 * `data_source`. `existingForYear` returns Map<key, r.data_source>, so a row
 * that EXISTS with a NULL or empty `data_source` yields a falsy value. Reading
 * presence off that value lets the loader overwrite another publisher's row
 * while printing "0 skipped by the never-overwrite guard" — a silent overwrite
 * reported as a clean run.
 *
 * Every other loader coerces defensively: loadNyOscCities.mjs:131,
 * loadGeorgiaRLGF.mjs:553, loadMichiganF65.mjs:296, loadPaDced.mjs:254,
 * loadNYCAcfrs.mjs:204 and loadInCountyAcfrs.mjs:340 all test
 * `existing?.[0] && !String(existing[0].data_source || '').startsWith(...)` —
 * presence first, then the value.
 */
describe('the never-overwrite guard', () => {
  const K = '42|operating|general_fund';
  const OURS = `${SCHOOL_SOURCE_PREFIX} — Expenditures, General Fund (FY2021 actual, self-reported)`;

  it('preserves another publisher\'s row', () => {
    expect(isForeignRow(new Map([[K, 'Buffalo ACFR']]), K, SCHOOL_SOURCE_PREFIX)).toBe(true);
  });

  it('overwrites a row this loader family wrote', () => {
    expect(isForeignRow(new Map([[K, OURS]]), K, SCHOOL_SOURCE_PREFIX)).toBe(false);
  });

  it('writes freely where no row exists', () => {
    expect(isForeignRow(new Map(), K, SCHOOL_SOURCE_PREFIX)).toBe(false);
  });

  it('⚠ PRESERVES a row that exists with a NULL data_source', () => {
    expect(isForeignRow(new Map([[K, null]]), K, SCHOOL_SOURCE_PREFIX)).toBe(true);
  });

  it('⚠ PRESERVES a row that exists with an EMPTY data_source', () => {
    expect(isForeignRow(new Map([[K, '']]), K, SCHOOL_SOURCE_PREFIX)).toBe(true);
  });
});

/**
 * The school counterpart of `tests/nyOsc.test.mjs`'s "source naming and
 * registry coverage", which the cities have had since #257 and the districts
 * never got.
 *
 * ⚠⚠ `schoolSourceNameFor`'s own header warns that a string which misses its
 * registry entry loses `fund_scope`, `basis` AND `audit_grade` at once — all
 * three silently become `unknown`. Nothing failed when that was unguarded,
 * which is exactly the problem: the loss is invisible at write time and shows
 * up as a column of `unknown` long afterwards.
 *
 * ⭐ Stronger than the cities' version on purpose: it asserts EXACTLY ONE entry
 * matches, not `.some(...)`. A second pattern that also claimed these strings
 * would pass a `.some()` check while making which entry wins depend on
 * registry order.
 */
describe('school source naming and registry coverage', () => {
  const YEARS = Array.from({ length: 31 }, (_, i) => 1995 + i); // FY1995-FY2025
  const DATASETS = ['operating', 'revenue'];
  const SCOPES = ['general_fund', 'total_governmental'];
  const every = (fn) => {
    for (const fy of YEARS) for (const dt of DATASETS) for (const sc of SCOPES) fn(dt, fy, sc);
  };

  it('names the source distinctly per scope, under the school prefix', () => {
    const gf = schoolSourceNameFor('operating', 2021, 'general_fund');
    const tg = schoolSourceNameFor('operating', 2021, 'total_governmental');
    expect(gf).toContain(SCHOOL_SOURCE_PREFIX);
    expect(gf).not.toBe(tg);
  });

  it('classifies every year/dataset/scope to the right SCHOOL entry', () => {
    every((dt, fy, sc) => {
      const name = schoolSourceNameFor(dt, fy, sc);
      const got = classify(name, FUND_SCOPE_REGISTRY);
      expect(got.scope, name).toBe(sc);
      expect(got.entryId, name).toBe(`ny-osc-school-${sc.replace(/_/g, '-')}`);
    });
  });

  it('⚠ matches EXACTLY ONE basis and ONE audit-grade entry, never two', () => {
    every((dt, fy, sc) => {
      const name = schoolSourceNameFor(dt, fy, sc);
      expect(BASIS_REGISTRY.filter((e) => e.match.test(name)).map((e) => e.id), `basis ${name}`)
        .toHaveLength(1);
      expect(AUDIT_GRADE_REGISTRY.filter((e) => e.match.test(name)).map((e) => e.id), `grade ${name}`)
        .toHaveLength(1);
    });
  });

  it('does NOT claim an accounting basis', () => {
    // Same reasoning as the cities: the district ARM directs modified accrual,
    // but no audit establishes that any district ACHIEVED GAAP. 717 districts
    // is a large number of claims to make on an instruction.
    every((dt, fy, sc) => {
      const name = schoolSourceNameFor(dt, fy, sc);
      expect(ACCOUNTING_BASIS_REGISTRY.filter((e) => e.match.test(name)), name).toHaveLength(0);
    });
  });

  it('⚠⚠ the CITY entries do not claim a SCHOOL string, or the reverse', () => {
    const idsFor = (reg, pre) => reg.filter((x) => String(x.id).startsWith(pre));
    const REGS = [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, AUDIT_GRADE_REGISTRY];
    const school = schoolSourceNameFor('operating', 2021, 'general_fund');
    const city = sourceNameFor('operating', 2021, 'general_fund');
    expect(city).toContain(SOURCE_PREFIX);
    for (const reg of REGS) {
      for (const e of idsFor(reg, 'ny-osc-city')) {
        expect(e.match.test(school), `${e.id} claims the school string`).toBe(false);
      }
      for (const e of idsFor(reg, 'ny-osc-school')) {
        expect(e.match.test(city), `${e.id} claims the city string`).toBe(false);
      }
    }
  });

  it('does not claim any source outside NY OSC', () => {
    const foreign = ['CA State Controller - Expenditures',
      'Pennsylvania DCED Municipal Annual Audit and Financial Report — Revenues (FY2023 actual)',
      'New York City ACFR — General Fund (FY2024 actual)',
      'Georgia DCA Report of Local Government Finance — Revenues (FY2024 actual)'];
    for (const f of foreign) {
      for (const reg of [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, AUDIT_GRADE_REGISTRY]) {
        for (const e of reg.filter((x) => String(x.id).startsWith('ny-osc-school'))) {
          expect(e.match.test(f), `${e.id} claims ${f}`).toBe(false);
        }
      }
    }
  });
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


  // ⚠ Explicit budget: this reads the 111 MB school archive, so its duration
  // tracks the MACHINE, not the code. Measured ~3.5s idle; vitest.config.ts
  // records ~8x slowdown under disk contention, which puts it past the 30s
  // global default. See reference_ci_and_io_test_timeouts.
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
  }, 60_000);


  // ⚠ Explicit budget: this reads the 111 MB school archive, so its duration
  // tracks the MACHINE, not the code. Measured ~4.6s idle; vitest.config.ts
  // records ~8x slowdown under disk contention, which puts it past the 30s
  // global default. See reference_ci_and_io_test_timeouts.
  archiveIt('reads an old-era district year with the same row shape', () => {
    const rows = readYear(SCHOOL_ARCHIVE_PATH, 2010, 'SchoolDistrict');
    expect(new Set(rows.map((r) => r.entityName)).size).toBe(696);
    expect(rows.every((r) => r.fiscalYearStartMonth === 7)).toBe(true);
  }, 60_000);
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


  // ⚠ Explicit budget: this reads the 111 MB school archive, so its duration
  // tracks the MACHINE, not the code. Measured ~19.4s idle; vitest.config.ts
  // records ~8x slowdown under disk contention, which puts it past the 30s
  // global default. See reference_ci_and_io_test_timeouts.
  archiveIt('covers every district in every sampled year', () => {
    const known = new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode));
    for (const fy of [1995, 2003, 2012, 2013, 2021, 2025]) {
      for (const c of new Set(readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')
        .map((r) => r.municipalCode))) {
        expect(known.has(c), `FY${fy} has unknown district ${c}`).toBe(true);
      }
    }
  }, 120_000);
});
