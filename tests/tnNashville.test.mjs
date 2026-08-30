import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  TN_ENTITIES, TN_LOAD_WINDOW, NASHVILLE_LOAD_YEARS, NASHVILLE_ACFR_URLS,
  NASHVILLE_FAC_REPORTS, NASHVILLE_PUBLICATION_PAGE, tnEntityByKey,
} from '../scripts/data/tnKnightEntities.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { classify as classifyScope } from '../scripts/lib/fundScope.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';
import { classifyAuditee } from '../scripts/buildFacFiscalYearCensus.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';

const src = (mode, fy) => 'Metro Nashville ACFR — General Fund '
  + `${mode === 'operating' ? 'Expenditure by Function' : 'Revenue by Source'} (FY${fy} actual, GAAP basis)`;

/**
 * ⚠ READ AS TEXT, NEVER IMPORTED. `scripts/classifyFundScope.mjs` carries a
 * shebang, and a `#!` on any module a test imports breaks `npm test` on Windows
 * — the defect `tests/waSao.test.mjs` guards against.
 */
function expectedRowsFor(id) {
  const m = new RegExp(`'${id}':\\s*(\\d+),`).exec(readFileSync('scripts/classifyFundScope.mjs', 'utf8'));
  return m ? Number(m[1]) : null;
}

describe('Nashville-Davidson is ONE consolidated entity', () => {
  it('is the only Tennessee entity in this milestone', () => {
    expect(TN_ENTITIES).toHaveLength(1);
    expect(TN_ENTITIES[0].key).toBe('nashville-davidson');
  });

  /**
   * ⚠ Metro performs both city AND county functions. Creating a city row AND a
   * county row would double-count it in every state and national rollup
   * (spec §4.5). `city` + NULL county_id is the convention settled 2026-08-30
   * across San Francisco, Philadelphia, Macon-Bibb and Columbus-Muscogee.
   */
  it('is typed city with no parent county', () => {
    const e = tnEntityByKey('nashville-davidson');
    expect(e.entityType).toBe('city');
    expect(e.parentCountyKey).toBeNull();
  });

  /**
   * ⚠⚠ THREE CENSUS FIGURES EXIST FOR THIS ONE GOVERNMENT and the wrong one
   * silently misstates every per-capita figure — the only check that can catch a
   * wrong `units`:
   *
   *   Davidson County                              SUMLEV 050   729,505
   *   Nashville-Davidson metro government          SUMLEV 170   729,505
   *   Nashville-Davidson metro government (BALANCE) SUMLEV 162  704,963
   *
   * The "(balance)" figure excludes six independent satellite cities inside
   * Davidson County that never merged (Belle Meade, Berry Hill, Forest Hills,
   * Goodlettsville, Oak Hill, Ridgetop). Metro's General Services District
   * covers the whole county, so the county-wide figure is correct.
   *
   * ⚠ This DIFFERS from Philadelphia, where session 5 proved coterminousness by
   * finding place (162) and county (050) both at 1,573,916. Here 162 does NOT
   * equal 050 — only 170 does.
   */
  it('uses the consolidated-government population, not the place "(balance)" one', () => {
    expect(tnEntityByKey('nashville-davidson').population).toBe(729505);
    expect(tnEntityByKey('nashville-davidson').population).not.toBe(704963);
  });

  it('types the entity so the provenance chip renders', () => {
    for (const e of TN_ENTITIES) expect(SOURCE_CHIP_ENTITY_TYPES).toContain(e.entityType);
  });
});

describe('Nashville ACFR provenance', () => {
  it('covers FY2016-FY2025 with a first-party URL for every year', () => {
    expect(NASHVILLE_LOAD_YEARS).toHaveLength(10);
    expect(TN_LOAD_WINDOW).toEqual({ first: 2016, last: 2025 });
    for (const fy of NASHVILLE_LOAD_YEARS) {
      expect(NASHVILLE_ACFR_URLS[fy]).toMatch(/^https:\/\/www\.nashville\.gov\//);
    }
  });

  /**
   * ⚠ The URLs are NOT derivable — they carry the upload month and the naming
   * changes three times across the decade. This is the Travis case the manifest
   * exists for; a rebuilt URL would be a guess about where the boundary falls.
   */
  it('cannot be reconstructed from a naming rule', () => {
    expect(NASHVILLE_ACFR_URLS[2016]).toMatch(/CAFR2016\.pdf$/);
    expect(NASHVILLE_ACFR_URLS[2021]).toMatch(/ACFRFY21_01_21_2022_Upload\.pdf$/);
    expect(NASHVILLE_ACFR_URLS[2024]).toMatch(/Annual-Comprehensive-Financial-Report-2024\.pdf$/);
  });

  it('records a FAC report id per year as a second route', () => {
    for (const fy of NASHVILLE_LOAD_YEARS) {
      expect(NASHVILLE_FAC_REPORTS[fy]).toMatch(/^\d{4}-06-(CENSUS|GSAFAC)-\d{10}$/);
    }
  });

  it('cites the issuer\'s own publication page for readers', () => {
    expect(NASHVILLE_PUBLICATION_PAGE).toMatch(/^https:\/\/www\.nashville\.gov\//);
    expect(NASHVILLE_PUBLICATION_PAGE).not.toMatch(/app\.fac\.gov/);
  });
});

describe('Nashville axes', () => {
  it('grades, scopes and dates every loaded source string', () => {
    for (const fy of NASHVILLE_LOAD_YEARS) {
      for (const mode of ['operating', 'revenue']) {
        expect(gradeFor(src(mode, fy)).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
        expect(classifyScope(src(mode, fy), FUND_SCOPE_REGISTRY).scope).toBe('general_fund');
      }
    }
  });

  it('claims nothing outside the window', () => {
    expect(gradeFor(src('revenue', 2015)).value).toBe(AUDIT_GRADE.UNKNOWN);
    expect(gradeFor(src('revenue', 2026)).value).toBe(AUDIT_GRADE.UNKNOWN);
  });

  /**
   * ⚠⚠ A NAME MATCH OVER FAC'S TENNESSEE ROWS SWALLOWS A COMPONENT UNIT. The
   * Electric Power Board of Metro Govt (Nashville Electric Service) files its
   * own audit under a name containing the government's — session 2's Charlotte
   * Water trap exactly. `The Metropolitan Government of Lynchburg, Moore County`
   * is a DIFFERENT Tennessee consolidated government.
   */
  it('claims no neighbouring Tennessee government or component unit', () => {
    for (const s of [
      'Nashville Electric Service ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      'Electric Power Board of Metro Govt ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      'Metro Lynchburg Moore ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
      'Metro Nashville ACFR — General Fund Revenue by Source (FY2024 actual)',
      'Nashville ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)',
    ]) {
      expect(gradeFor(s).value).toBe(AUDIT_GRADE.UNKNOWN);
      expect(classifyScope(s, FUND_SCOPE_REGISTRY).scope).toBe('unknown');
    }
  });

  it('pins the partition count at one entity x ten years x two datasets', () => {
    expect(expectedRowsFor('tn-local-acfr-gf')).toBe(20);
    expect(NASHVILLE_LOAD_YEARS.length * 2).toBe(20);
  });
});

/**
 * ⚠⚠ A KNOWN, UNFIXED BLIND SPOT, PINNED SO A FUTURE FIX IS VISIBLE.
 *
 * `classifyAuditee` drops consolidated governments whose legal name does not use
 * the "City of" / "City and County of" form, so they never enter the FAC fiscal
 * calendar census — and `censusGuard()` returns `{ok:true}` when it cannot find
 * an entity, so they pass WITHOUT BEING CHECKED.
 *
 * This is not a one-off: it explains three "census absent" notes this campaign
 * had already recorded without diagnosing, and it predicts a fourth for
 * Lexington-Fayette in session 8.
 *
 * These assertions describe what the code DOES today, not what it should do. If
 * someone fixes the classifier, this test fails loudly and points at the
 * follow-up rather than letting the gap close silently and unnoticed.
 */
describe('FAC census blind spot for consolidated governments (known, unfixed)', () => {
  it('classifies the "City of" and "City and County of" forms correctly', () => {
    expect(classifyAuditee('CITY OF PHILADELPHIA', 'PA'))
      .toEqual({ kind: 'municipality', entity: 'Philadelphia' });
    expect(classifyAuditee('CITY AND COUNTY OF SAN FRANCISCO', 'CA'))
      .toEqual({ kind: 'municipality', entity: 'San Francisco' });
    expect(classifyAuditee('CITY AND COUNTY OF DENVER', 'CO'))
      .toEqual({ kind: 'municipality', entity: 'Denver' });
  });

  it('DROPS every other consolidated-government naming style', () => {
    for (const [state, name] of [
      ['TN', 'THE METROPOLITAN GOVERNMENT OF NASHVILLE & DAVIDSON COUNTY'],
      ['TN', 'THE METROPOLITAN GOVERNMENT OF NASHVILLE AND DAVIDSON COUNTY'],
      ['GA', 'MACON-BIBB COUNTY'],
      ['GA', 'COLUMBUS CONSOLIDATED GOVERNMENT'],
      ['KY', 'LEXINGTON-FAYETTE URBAN COUNTY GOVERNMENT'],
    ]) {
      expect(classifyAuditee(name, state), `${state} ${name}`).toBeNull();
    }
  });

  // So the month for this entity comes from the ACFR and the live FAC record,
  // both first-party and both stronger than the census would have been.
  it('is why this entity carries an explicit fiscal month', () => {
    expect(tnEntityByKey('nashville-davidson').fiscalYearStartMonth).toBe(7);
  });
});
