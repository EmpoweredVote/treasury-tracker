import { describe, it, expect } from 'vitest';

import {
  SC_CITY_ENTITIES, SC_CITY_DEFERRED, SC_CITY_COVERAGE_GAPS, SC_CITY_STATE,
  scCityLoadableEntities, scCityFilings, scCityByKey,
} from '../scripts/data/scCityAcfrEntities.mjs';
import { sourceNameFor, sourcePrefixFor, FUND_SCOPE, BASIS_VALUE, DERIVATION } from '../scripts/loadScCityAcfrs.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE, BASIS, BASIS_VALUES, classifyAxis } from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { censusGuard, censusMonthFor } from '../scripts/lib/facFiscalYearCensus.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';
import { READER_DISAGREEMENTS, disagreementFor } from '../scripts/verifyScCityReaders.mjs';

describe('the South Carolina city wave-1 roster', () => {
  it('holds five governments and loads four of them', () => {
    expect(SC_CITY_ENTITIES.map((e) => e.key).sort())
      .toEqual(['charleston', 'greenville', 'mount-pleasant', 'north-charleston', 'rock-hill']);
    // ⚠ North Charleston is the only one held back, and on evidence — see below.
    expect(scCityLoadableEntities().map((e) => e.key))
      .toEqual(['charleston', 'mount-pleasant', 'rock-hill', 'greenville']);
  });

  it('loads 38 entity-years, and Mount Pleasant is short by exactly its two gaps', () => {
    const filings = scCityFilings();
    expect(filings).toHaveLength(38);
    const byKey = {};
    for (const f of filings) byKey[f.entity.key] = (byKey[f.entity.key] || 0) + 1;
    // ⚠ Mount Pleasant's 8 is the point: FAC serves no filing under its EIN
    // before FY2018, and those two years are declared gaps rather than invented.
    expect(byKey).toEqual({
      charleston: 10, 'mount-pleasant': 8, 'rock-hill': 10, greenville: 10,
    });
  });

  /**
   * ⚠⚠ THE TRAP THIS PINS. A FAC name search for `*charleston*` + `*mount
   * pleasant*` in SC returns 50 distinct (EIN, name) pairs, and two of the near
   * misses are ONE DIGIT from the right answer — 576000227 is the Commissioners
   * of Public Works of the City of Charleston, 576001080 is Mount Pleasant
   * Waterworks. Both are real governments filing their own audited statements,
   * so a typo loads the WRONG government's money under the city's name and every
   * tie gate downstream still passes.
   */
  it('joins on the EIN, and not on a neighbouring one', () => {
    expect(scCityByKey('charleston').facEin).toBe('576000226');
    expect(scCityByKey('charleston').facEin).not.toBe('576000227');
    expect(scCityByKey('mount-pleasant').facEin).toBe('576001079');
    expect(scCityByKey('mount-pleasant').facEin).not.toBe('576001080');
    // ⚠ Every entity in the roster carries a DISTINCT EIN. (That the EIN is not
    // by itself a sufficient join is a separate fact — see the wave-2 block.)
    expect(new Set(SC_CITY_ENTITIES.map((e) => e.facEin)).size).toBe(SC_CITY_ENTITIES.length);
  });

  it('records every FAC report id per year rather than rebuilding a pattern', () => {
    for (const e of SC_CITY_ENTITIES) {
      for (const [fy, id] of Object.entries(e.facReports)) {
        // Through FY2022 the id is `<fy>-<mm>-CENSUS-<stable>`; from FY2023 it is
        // `<fy>-<mm>-GSAFAC-<changes every year>`. Only half is ever derivable.
        expect(id).toMatch(new RegExp(`^${fy}-\\d{2}-(CENSUS|GSAFAC)-\\d{10}$`));
      }
    }
  });

  /**
   * ⚠⚠ ALL 46 SC COUNTIES RUN JULY AND CHARLESTON DOES NOT. Its ten federal
   * filings all report fy_end_date 12-31 and the FAC census independently records
   * month 1. The state norm is exactly the wrong default here, which is the
   * condition project_fysm_column_default_one_defect exists for.
   */
  it('evidences a fiscal month per entity — Charleston is JANUARY', () => {
    expect(scCityByKey('charleston').fiscalYearStartMonth).toBe(1);
    expect(scCityByKey('mount-pleasant').fiscalYearStartMonth).toBe(7);
    for (const e of SC_CITY_ENTITIES) expect(e.monthStatus).toBe('confirmed');
  });

  it('agrees with the federal audit record for every loaded entity-year', () => {
    for (const f of scCityFilings()) {
      const g = censusGuard(f.entity.censusName, SC_CITY_STATE,
        f.entity.fiscalYearStartMonth, f.fiscalYear);
      expect(g.error).toBeUndefined();
    }
    expect(censusMonthFor(SC_CITY_STATE, 'Charleston').month).toBe(1);
    expect(censusMonthFor(SC_CITY_STATE, 'Mount Pleasant').month).toBe(7);
  });

  /**
   * ⚠ `treasury_ensure_municipality` keys on (name, state, entity_type), so the
   * type is part of the government's identity. Mount Pleasant is a TOWN in the
   * Census file and in its own filings; flattening it to `city` would be a
   * different government from the one that filed these statements.
   */
  it('keeps Mount Pleasant a town, all the way through to the source label', () => {
    expect(scCityByKey('mount-pleasant').entityType).toBe('town');
    expect(sourcePrefixFor(scCityByKey('mount-pleasant'))).toBe('Town of Mount Pleasant');
    expect(sourcePrefixFor(scCityByKey('charleston'))).toBe('City of Charleston');
    // ⚠ Or the provenance chip silently does not render — `city` was missing
    // from this set for months with every gate green.
    expect(SOURCE_CHIP_ENTITY_TYPES.has('town')).toBe(true);
    expect(SOURCE_CHIP_ENTITY_TYPES.has('city')).toBe(true);
  });

  /** A gap is DECLARED, never written as $0 and never silently skipped. */
  it('declares Mount Pleasant FY2016 and FY2017 as coverage gaps', () => {
    expect(Object.keys(SC_CITY_COVERAGE_GAPS['mount-pleasant']).sort()).toEqual(['2016', '2017']);
    for (const fy of [2016, 2017]) {
      expect(scCityByKey('mount-pleasant').facReports[fy]).toBeUndefined();
      expect(SC_CITY_COVERAGE_GAPS['mount-pleasant'][fy]).toMatch(/Federal Audit Clearinghouse/);
    }
  });

  /**
   * ⚠⚠ North Charleston is held back ON EVIDENCE. Three years are image-only at
   * BOTH publishers, and the seven readable ones pass all four document-quality
   * checks while still carrying OCR damage in the statement table itself
   * (`Licenses and pennits`). A whole-document gate does not prove the statement
   * page is clean.
   */
  it('defers North Charleston with a diagnosis and no extractor', () => {
    expect(Object.keys(SC_CITY_DEFERRED)).toEqual(['north-charleston']);
    const d = SC_CITY_DEFERRED['north-charleston'];
    expect(Object.keys(d.unreadableYears).sort()).toEqual(['2019', '2020', '2023']);
    for (const why of Object.values(d.unreadableYears)) {
      // Both publishers named in every entry — quality is a property of the COPY.
      expect(why).toMatch(/FAC/);
      expect(why).toMatch(/city/);
    }
    expect(scCityByKey('north-charleston').extractor).toBeNull();
    expect(scCityFilings().some((f) => f.entity.key === 'north-charleston')).toBe(false);
  });

  it('gives every loaded entity an extractor', () => {
    for (const e of scCityLoadableEntities()) expect(e.extractor).toMatch(/^scripts\/extract.*\.py$/);
  });
});

describe('the South Carolina city source labels', () => {
  /**
   * ⚠⚠ These EXTEND the existing `sc-local-acfr-gf` family rather than opening a
   * lookalike beside it, so the label must reproduce Columbia's shape exactly.
   */
  it('reproduces the existing family label shape', () => {
    expect(sourceNameFor(scCityByKey('charleston'), 'revenue', 2024))
      .toBe('City of Charleston ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)');
    expect(sourceNameFor(scCityByKey('mount-pleasant'), 'operating', 2018))
      .toBe('Town of Mount Pleasant ACFR — General Fund Expenditure by Function (FY2018 actual, GAAP basis)');
  });

  /**
   * ⚠⚠ THE REGISTRIES ANCHOR ON THE ENTITY NAME, so a new entity is unclaimed
   * until its pattern is widened — and an unclaimed row looks perfectly fine.
   * Florida's third branch matched none of three registries; Pennsylvania matched
   * only auditGrade.
   */
  it('is claimed by the audit-grade and basis registries, for every loaded year', () => {
    for (const f of scCityFilings()) {
      for (const ds of ['revenue', 'operating']) {
        const label = sourceNameFor(f.entity, ds, f.fiscalYear);
        expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
        expect(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
          .toBe('sc-local-acfr-gf');
      }
    }
  });

  it('still claims the two entities that were already in the family', () => {
    for (const name of ['City of Columbia', 'City of Myrtle Beach']) {
      const label = `${name} ACFR — General Fund Revenue by Source (FY2020 actual, GAAP basis)`;
      expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
    }
  });

  it('does not claim a neighbouring South Carolina source', () => {
    for (const s of [
      'City of Charleston ACFR',
      'City of North Charleston ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      'South Carolina RFA Local Government Finance Report — Revenue by Source (FY2024 actual, county only, excl. bond and lease proceeds)',
    ]) {
      expect(classifyAxis(s, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
        .not.toBe('sc-local-acfr-gf');
    }
  });

  it('writes the axis triple the existing family already carries', () => {
    expect(FUND_SCOPE).toBe('general_fund');
    expect(BASIS_VALUE).toBe('actual');
    expect(DERIVATION).toBe('published');
  });
});

/**
 * ⚠⚠ WAVE 2 CORRECTED WAVE 1'S RULE. Wave 1 recorded "the EIN is the join, never
 * the name". It is NECESSARY BUT NOT SUFFICIENT: FAC's EIN 576000244 carries the
 * CITY of Rock Hill *and* the HOUSING AUTHORITY OF THE CITY OF ROCK HILL, with
 * two different fiscal year ends. Joining on the EIN alone would pull the
 * authority's audited statements into the city's series AND make the city look
 * like it alternates its fiscal calendar every year.
 */
describe('the South Carolina city wave-2 roster', () => {
  it('loads Rock Hill and Greenville across the full decade', () => {
    expect(scCityLoadableEntities().map((e) => e.key))
      .toEqual(['charleston', 'mount-pleasant', 'rock-hill', 'greenville']);
    for (const k of ['rock-hill', 'greenville']) {
      expect(Object.keys(scCityByKey(k).facReports).map(Number).sort())
        .toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    }
    expect(scCityFilings()).toHaveLength(38);
  });

  it('records that Rock Hill shares its EIN with another government', () => {
    const rh = scCityByKey('rock-hill');
    expect(rh.facEin).toBe('576000244');
    expect(rh.facEinSharedWith).toMatch(/HOUSING AUTHORITY/i);
    // ⭐ Every recorded id is a `-06-` filing: the city closes June, the housing
    // authority December, so a December id here would be the wrong government.
    for (const id of Object.values(rh.facReports)) expect(id).toMatch(/^\d{4}-06-/);
    // And the census-era ids are the city's own stable number, not the authority's.
    for (const fy of [2016, 2017, 2018, 2019, 2020, 2021, 2022]) {
      expect(rh.facReports[fy]).toBe(`${fy}-06-CENSUS-0000170607`);
      expect(rh.facReports[fy]).not.toContain('0000182948');
    }
  });

  /**
   * ⚠⚠ FAC records Rock Hill's FY2024 `auditee_name` as `Drew Cooper` — a
   * person. A name-based join drops the year silently, leaving a hole that reads
   * exactly like a city that did not file. The document is the city's own ACFR.
   */
  it('keeps Rock Hill FY2024, which FAC files under a person\'s name', () => {
    expect(scCityByKey('rock-hill').facReports[2024]).toBe('2024-06-GSAFAC-0000347380');
    expect(scCityFilings().some((f) => f.entity.key === 'rock-hill' && f.fiscalYear === 2024)).toBe(true);
  });

  it('gives Greenville a clean EIN with no sharing declared', () => {
    expect(scCityByKey('greenville').facEin).toBe('576000236');
    expect(scCityByKey('greenville').facEinSharedWith).toBeUndefined();
    // ⚠ NOT Greenville County, the school district, the water system, the
    // airport commission, the housing authority or the technical college.
    for (const other of ['576000356', '576000234', '576000555', '576000554', '576000612', '570420667']) {
      expect(scCityByKey('greenville').facEin).not.toBe(other);
    }
  });

  it('routes Rock Hill through the coordinate reader and keeps a corroborator', () => {
    const rh = scCityByKey('rock-hill');
    expect(rh.extractor).toBe('scripts/extractRockHillCoords.py');
    expect(rh.corroboratingExtractor).toBe('scripts/extractRockHillSC.py');
    // Every other loaded entity reads cleanly through the -table reader alone.
    for (const e of scCityLoadableEntities().filter((x) => x.key !== 'rock-hill')) {
      expect(e.corroboratingExtractor).toBeUndefined();
    }
  });

  it('claims both new entities on the audit-grade and basis registries', () => {
    for (const f of scCityFilings().filter((x) => ['rock-hill', 'greenville'].includes(x.entity.key))) {
      for (const ds of ['revenue', 'operating']) {
        const label = sourceNameFor(f.entity, ds, f.fiscalYear);
        expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
        expect(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
          .toBe('sc-local-acfr-gf');
      }
    }
  });
});

/**
 * ⚠⚠ NEITHER `-table` STRATEGY IS RIGHT FOR ROCK HILL, and picking whichever
 * ties per year is curve-fitting — the error that got the LA-01 scope verdict
 * retracted. `positional` reads FY2024 revenue 432,533 short; `ordinal` fixes
 * that and breaks FY2025 operating by 20,125.
 */
describe('the two-reader corroboration register', () => {
  it('declares exactly the two Rock Hill disagreements, with their cause', () => {
    expect(READER_DISAGREEMENTS.map((d) => d.id).sort())
      .toEqual(['rock-hill-fy2024-revenue-two-offset', 'rock-hill-fy2025-operating-readable']);
    for (const d of READER_DISAGREEMENTS) {
      expect(d.entityKey).toBe('rock-hill');
      expect(d.why.length).toBeGreaterThan(40);
    }
  });

  it('pins the FY2024 delta to the exact dropped figure', () => {
    const d = disagreementFor({ entityKey: 'rock-hill', fiscalYear: 2024, mode: 'revenue' });
    // ⚠ 432,533 is `Fines and forfeitures` on the printed page — the row whose
    // General Fund cell is rendered ~24 characters right of the column.
    expect(d.delta).toBe(-432533);
    expect(d.recordTotal).toBe(96194080);
  });

  /** ⚠ An exact registry, never a tolerance: a declared -432,533 excuses nothing else. */
  it('does not excuse a neighbouring delta, year or mode', () => {
    expect(disagreementFor({ entityKey: 'rock-hill', fiscalYear: 2023, mode: 'revenue' })).toBeNull();
    expect(disagreementFor({ entityKey: 'rock-hill', fiscalYear: 2024, mode: 'operating' })).toBeNull();
    expect(disagreementFor({ entityKey: 'greenville', fiscalYear: 2024, mode: 'revenue' })).toBeNull();
  });
});
