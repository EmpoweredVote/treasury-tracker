import { describe, it, expect } from 'vitest';

import {
  COLUMBIA_FAC_REPORTS, MYRTLE_BEACH_FAC_REPORTS, COLUMBIA_LOAD_YEARS,
  MYRTLE_BEACH_LOAD_YEARS, COLUMBIA_UNLOADABLE, FIRST_PARTY_OVERRIDES,
  FAC_PDF_BASE, COLUMBIA_PUBLICATION_PAGE, MYRTLE_BEACH_PUBLICATION_PAGE,
} from '../scripts/data/scAcfrSources.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { classify as classifyScope } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';
import { KNOWN_DOCUMENT_GAPS } from '../scripts/extractScCitiesAll.mjs';
import { scCityFilings } from '../scripts/data/scCityAcfrEntities.mjs';
import { readFileSync } from 'node:fs';

/**
 * ⚠ READ AS TEXT, NEVER IMPORTED. `scripts/classifyFundScope.mjs` carries a
 * shebang, and a `#!` on any module a test imports breaks `npm test` on Windows
 * — the defect `tests/waSao.test.mjs` guards against, which fired on exactly
 * this import while this file was being written.
 */
function expectedRowsFor(id) {
  const src = readFileSync('scripts/classifyFundScope.mjs', 'utf8');
  const m = new RegExp(`'${id}':\\s*(\\d+),`).exec(src);
  return m ? Number(m[1]) : null;
}

const src = (city, mode, fy) => `${city} ACFR — General Fund `
  + `${mode === 'operating' ? 'Expenditure by Function' : 'Revenue by Source'} (FY${fy} actual, GAAP basis)`;

const CITIES = ['City of Columbia', 'City of Myrtle Beach'];

describe('South Carolina city ACFR provenance', () => {
  it('records a FAC report id for every year of both cities', () => {
    for (const fy of [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
      expect(COLUMBIA_FAC_REPORTS[fy]).toMatch(/^\d{4}-06-(CENSUS|GSAFAC)-\d{10}$/);
      expect(MYRTLE_BEACH_FAC_REPORTS[fy]).toMatch(/^\d{4}-06-(CENSUS|GSAFAC)-\d{10}$/);
    }
  });

  // ⚠ The PDF endpoint takes no key; only api.fac.gov needs one. If this ever
  // changes the fetcher fails loudly rather than silently writing an error page.
  it('builds FAC PDF URLs that carry no credential', () => {
    expect(FAC_PDF_BASE).toBe('https://app.fac.gov/dissemination/report/pdf');
    expect(FAC_PDF_BASE).not.toMatch(/api[_-]?key|token/i);
  });

  /**
   * ⚠⚠ COLUMBIA FY2019 IS ABSENT BY DECISION, NOT BY OVERSIGHT. Both surviving
   * copies are scans: FAC's carries a defective OCR layer (`20 ,775,337`,
   * `Slate government`) and the city's own has no text layer at all. Loading it
   * would mean trusting money read off an image.
   */
  it('excludes Columbia FY2019 from the load window and says why', () => {
    expect(COLUMBIA_LOAD_YEARS).not.toContain(2019);
    expect(COLUMBIA_LOAD_YEARS).toEqual([2016, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(COLUMBIA_UNLOADABLE[2019]).toMatch(/scan|OCR/i);
    // Still recorded, so nobody re-derives the window and silently re-adds it.
    expect(COLUMBIA_FAC_REPORTS[2019]).toBeTruthy();
  });

  it('loads Myrtle Beach across the full decade', () => {
    expect(MYRTLE_BEACH_LOAD_YEARS).toHaveLength(10);
    expect(MYRTLE_BEACH_LOAD_YEARS[0]).toBe(2016);
    expect(MYRTLE_BEACH_LOAD_YEARS[9]).toBe(2025);
  });

  /**
   * ⚠⚠ Myrtle Beach FY2018's FAC copy is a scan whose OCR fuses four revenue
   * line items into one row and misses the printed total by EXACTLY $1
   * (64,439,897 vs 64,439,896). A "small delta" tolerance would have shipped it
   * with four categories destroyed — which is why acfrGF.py's `source_rounding`
   * is an exact-delta registry rather than a tolerance.
   */
  it('overrides Myrtle Beach FY2018 with the city\'s own copy', () => {
    expect(FIRST_PARTY_OVERRIDES.myrtlebeach_2018).toMatch(/^https:\/\//);
    expect(FIRST_PARTY_OVERRIDES.columbia_2019).toBeUndefined();
  });

  it('cites each city\'s own publication page for readers', () => {
    for (const u of [COLUMBIA_PUBLICATION_PAGE, MYRTLE_BEACH_PUBLICATION_PAGE]) {
      expect(u).toMatch(/^https:\/\//);
      expect(u).not.toMatch(/app\.fac\.gov/);
    }
  });
});

describe('South Carolina city ACFR axes', () => {
  it('grades every loaded source string audited_gaap', () => {
    for (const city of CITIES) {
      const years = city === 'City of Columbia' ? COLUMBIA_LOAD_YEARS : MYRTLE_BEACH_LOAD_YEARS;
      for (const fy of years) {
        for (const mode of ['operating', 'revenue']) {
          expect(gradeFor(src(city, mode, fy)).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
        }
      }
    }
  });

  it('classifies every loaded source string general_fund', () => {
    for (const city of CITIES) {
      for (const mode of ['operating', 'revenue']) {
        expect(classifyScope(src(city, mode, 2024), FUND_SCOPE_REGISTRY).scope).toBe('general_fund');
      }
    }
  });

  // ⚠ Anchored at both ends. The bare /ACFR — General Fund/ shape claims ~1,850
  // rows across families nobody has reconciled.
  it('claims no year outside the window and no neighbouring string', () => {
    for (const city of CITIES) {
      expect(gradeFor(src(city, 'revenue', 2015)).value).toBe(AUDIT_GRADE.UNKNOWN);
      expect(gradeFor(src(city, 'revenue', 2026)).value).toBe(AUDIT_GRADE.UNKNOWN);
    }
    for (const s of [
      'City of Columbia ACFR — General Fund Revenue by Source (FY2024 actual)',
      'City of West Columbia ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      'City of North Myrtle Beach ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      'Columbia ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
    ]) {
      expect(gradeFor(s).value).toBe(AUDIT_GRADE.UNKNOWN);
    }
  });

  /**
   * ⚠ `City of West Columbia` and `City of North Myrtle Beach` are DIFFERENT
   * GOVERNMENTS that file their own audits in the same two counties, and both
   * appear in FAC beside ours. This is session 2's `assertIssuer` lesson: a
   * name-plus-marker rule accepts the wrong document.
   */
  it('is not fooled by the neighbouring governments in the same counties', () => {
    expect(classifyScope(
      'City of West Columbia ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      FUND_SCOPE_REGISTRY,
    ).scope).toBe('unknown');
  });

  it('pins the partition count, including the year that is deliberately missing', () => {
    // ⚠ 38 -> 74 -> 114 -> 138 -> 146: wave 1 added Charleston (10 years) and
    // Mount Pleasant (8) = 36 rows; wave 2 added Rock Hill and Greenville (10
    // each) = 40; wave 3 added Summerville and Goose Creek (6 each) = 24, then
    // North Charleston (4 of its 10) = 8. The session-6a half is UNCHANGED and
    // still checked separately below, because THAT is what this test is for.
    expect(expectedRowsFor('sc-local-acfr-gf')).toBe(146);

    // ⚠⚠ THE ORIGINAL INTENT, PRESERVED. 38 = 19 session-6a entity-years x 2
    // datasets, and 40 would mean Columbia FY2019 came back — the year whose only
    // two surviving copies are scans with a defective OCR layer. Extending the
    // family must not quietly relax the check that year is still absent.
    expect((COLUMBIA_LOAD_YEARS.length + MYRTLE_BEACH_LOAD_YEARS.length) * 2).toBe(38);
    expect(COLUMBIA_LOAD_YEARS).not.toContain(2019);

    // 100 = Charleston 10 + Mount Pleasant 8 + Rock Hill 10 + Greenville 10 +
    // Summerville 6 + Goose Creek 6, x 2 datasets.
    // ⚠ 104 would mean Mount Pleasant FY2016/FY2017 were invented: FAC serves no
    // filing under EIN 576001079 before FY2018.
    // ⚠ And 120 would mean wave 3's missing years were invented. Summerville and
    // Goose Creek file a Single Audit only in years they expend >= $750k of
    // federal awards, so six years each is the FEDERAL record, not the town's
    // publishing history — those gaps are declared, never written as $0.
    // ⚠⚠ NOT scCityFilings() * 2 ANY MORE. That counts every year in the
    // roster, and North Charleston contributes TEN while only FOUR are
    // loadable — its other six documents cannot be read at either publisher and
    // are declared in KNOWN_DOCUMENT_GAPS. A count that ignored them would
    // silently expect 12 rows that must never exist.
    const loadable = scCityFilings()
      .filter((f) => !KNOWN_DOCUMENT_GAPS[`${f.entity.key}-${f.fiscalYear}`]);
    expect(loadable.length * 2).toBe(108);
    expect(38 + 108).toBe(146);
  });

  // ⚠ `city` was missing from this set for months with every gate green.
  it('types both cities so the provenance chip renders', () => {
    expect(SOURCE_CHIP_ENTITY_TYPES).toContain('city');
  });
});
