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

describe('the South Carolina city wave-1 roster', () => {
  it('holds three governments and loads two of them', () => {
    expect(SC_CITY_ENTITIES.map((e) => e.key).sort())
      .toEqual(['charleston', 'mount-pleasant', 'north-charleston']);
    expect(scCityLoadableEntities().map((e) => e.key)).toEqual(['charleston', 'mount-pleasant']);
  });

  it('loads 18 entity-years — Charleston 10, Mount Pleasant 8', () => {
    const filings = scCityFilings();
    expect(filings).toHaveLength(18);
    const byKey = {};
    for (const f of filings) byKey[f.entity.key] = (byKey[f.entity.key] || 0) + 1;
    expect(byKey).toEqual({ charleston: 10, 'mount-pleasant': 8 });
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
    expect(new Set(SC_CITY_ENTITIES.map((e) => e.facEin)).size).toBe(3);
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
