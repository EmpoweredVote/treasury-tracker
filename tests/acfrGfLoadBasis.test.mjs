import { describe, it, expect } from 'vitest';

// From the LIB, never from a shebang driver — see the note in coAcfrLoad.test.mjs.
import {
  dataSourceLabel, scopeForDataSource, basisForDataSource,
  reportingEntityForDataSource, auditGradeForDataSource, axisStampFor,
} from '../scripts/lib/acfrGfLoad.mjs';
import {
  BASIS, BASIS_VALUES, REPORTING_ENTITY, AUDIT_GRADE, classifyAxis,
} from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { SCOPE } from '../scripts/lib/fundScope.mjs';

/**
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * This loader stamped `fund_scope` and nothing else, so `basis` arrived at the
 * RPC's `COALESCE(p_basis, 'unknown')` and STAYED there. The 139 Alaska rows
 * read `basis = unknown` while all 98 rows of the sibling Texas and Colorado
 * families — loaded by this same module, from the same kind of statement in the
 * same kind of document — read `actual`. Every one of those Alaska rows carries
 * the word "actual" in its own `data_source` string.
 *
 * The cause was the one this codebase keeps re-learning: a family went into ONE
 * registry (fundScopeRegistry) and not its siblings. SCOPE-02's own stamper
 * could not have fixed it either — `basisRegistry.mjs` had no entry for the
 * family, so the sweep left it `unknown` too.
 *
 * ⚠⚠ AN UNKNOWN IS OMITTED FROM THE STAMP, NEVER WRITTEN.
 *
 * `axisStampFor` returns a PATCH, not a full row. A classification this loader
 * cannot make must not travel to the database as `unknown`, because the column
 * may already hold a value some other pass wrote. That is PR #300's defect —
 * a reload silently downgrading an evidenced row — and writing a literal
 * `unknown` over an existing `actual` would be the same defect on a second
 * axis. The sweep only ever writes rows an entry CLAIMS; this does the same.
 *
 * ⭐ The loader is not a second authority on either axis. It calls the same
 * `classifyAxis()` against the same `BASIS_REGISTRY` that
 * `scripts/stampBudgetAxes.mjs` uses, exactly as `scopeForDataSource` calls the
 * same `classify()` the SCOPE-01 sweep uses. The equality is pinned below,
 * because a loader that disagreed with the sweep would make the table flip
 * value depending on which ran last.
 */

const ANCHORAGE = {
  entityLabel: 'Municipality of Anchorage',
  muniName: 'Municipality of Anchorage',
  entityType: 'city',
  state: 'AK',
  pdfDir: 'docs/Anchorage',
  filePattern: /^anchorage-(\d{4})-acfr\.pdf$/i,
  extractScript: 'scripts/extractAnchorageAK.py',
  datasetIdPrefix: 'anchorage-acfr-gf',
  baseUrl: 'https://www.muni.org/',
  fys: [2024],
  // ⚠ Anchorage closes DECEMBER 31; its six siblings close JUNE 30. The basis
  // claim must hold across both calendars, so both are exercised.
  fyEndMonthDay: '12-31',
  fiscalYearStartMonth: 1,
};

const KODIAK = {
  ...ANCHORAGE,
  entityLabel: 'Kodiak Island Borough',
  muniName: 'Kodiak Island Borough',
  entityType: 'county',
  fyEndMonthDay: '06-30',
  fiscalYearStartMonth: 7,
};

/** Every entity the `ak-local-acfr-gf` family contains, by its stamped label. */
const AK_FAMILY = [
  'Municipality of Anchorage',
  'Matanuska-Susitna Borough',
  'Fairbanks North Star Borough',
  'Kenai Peninsula Borough',
  'City and Borough of Juneau',
  'Ketchikan Gateway Borough',
  'Kodiak Island Borough',
];

/** The sibling families this same module loads, already `actual` in the table. */
const TX_CO_FAMILY = [
  'City of Austin', 'Travis County',
  'City of Colorado Springs', 'El Paso County', 'City of Boulder', 'Boulder County',
];

const MODES = ['revenue', 'operating'];
/** The loaded window: Anchorage FY2012-FY2024, the six boroughs FY2016-FY2025. */
const LOADED_FYS = [2012, 2016, 2020, 2024, 2025];

describe('basisForDataSource — the axis the loader never stamped', () => {
  it('⭐ stamps actual for every entity in the ak-local-acfr-gf family', () => {
    for (const entity of AK_FAMILY) {
      for (const fy of LOADED_FYS) {
        for (const mode of MODES) {
          const label = dataSourceLabel({ entityLabel: entity }, fy, mode);
          expect(basisForDataSource(label), `${entity} FY${fy} ${mode}`).toBe(BASIS.ACTUAL);
        }
      }
    }
  });

  it('stamps actual for the Texas and Colorado families this module also loads', () => {
    // Those 98 rows already read `actual` in the table. If this loader is going
    // to write the column on every reload, it has to agree with what is there.
    for (const entity of TX_CO_FAMILY) {
      for (const mode of MODES) {
        const label = dataSourceLabel({ entityLabel: entity }, 2024, mode);
        expect(basisForDataSource(label), `${entity} ${mode}`).toBe(BASIS.ACTUAL);
      }
    }
  });

  it('AGREES WITH classifyAxis() exactly — the loader is not a second authority', () => {
    for (const entity of [...AK_FAMILY, ...TX_CO_FAMILY]) {
      for (const mode of MODES) {
        const label = dataSourceLabel({ entityLabel: entity }, 2024, mode);
        expect(basisForDataSource(label))
          .toBe(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).value);
      }
    }
  });

  it('leaves an UNRECOGNISED source unknown rather than guessing', () => {
    expect(basisForDataSource(dataSourceLabel({ entityLabel: 'Some Brand New City' }, 2024, 'revenue')))
      .toBe(BASIS.UNKNOWN);
    expect(basisForDataSource('')).toBe(BASIS.UNKNOWN);
    expect(basisForDataSource(null)).toBe(BASIS.UNKNOWN);
  });

  it('refuses an UNEVIDENCED registry entry, even one claiming a basis', () => {
    // ⚠⚠ The safety property, inherited from classifyAxis() rather than
    // re-implemented. `actual` is a public claim that a figure is a closed-year
    // result; an unevidenced claim must not reach the database through the
    // loader any more than through the sweep.
    const unevidenced = [{
      id: 'pretend-family',
      match: /^Pretendville ACFR — General Fund /,
      value: BASIS.ACTUAL,
      evidence: null,
    }];
    const label = dataSourceLabel({ entityLabel: 'Pretendville' }, 2024, 'revenue');
    expect(basisForDataSource(label, unevidenced)).toBe(BASIS.UNKNOWN);
  });

  it('never returns a value outside the CHECK constraint set', () => {
    for (const l of [dataSourceLabel(ANCHORAGE, 2024, 'revenue'), 'nonsense', '']) {
      expect(BASIS_VALUES).toContain(basisForDataSource(l));
    }
  });
});

describe('reportingEntityForDataSource / auditGradeForDataSource', () => {
  it('⭐ stamps primary_government for every entity in the family', () => {
    // The General Fund column of the FUND statements. A discretely presented
    // component unit lives only in the government-wide statements under GASB
    // 34, and four of the seven report no blended unit at all.
    for (const entity of AK_FAMILY) {
      for (const mode of MODES) {
        const label = dataSourceLabel({ entityLabel: entity }, 2024, mode);
        expect(reportingEntityForDataSource(label), entity).toBe(REPORTING_ENTITY.PRIMARY);
      }
    }
  });

  it('⭐ grades audited_gaap across each entity\'s OWN loaded window', () => {
    // Anchorage FY2012-FY2024, the six boroughs FY2016-FY2025 — 73 documents,
    // every opinion present in the text layer and every one unmodified.
    for (const fy of [2012, 2016, 2020, 2024]) {
      expect(auditGradeForDataSource(dataSourceLabel(ANCHORAGE, fy, 'revenue')), `Anchorage FY${fy}`)
        .toBe(AUDIT_GRADE.AUDITED_GAAP);
    }
    for (const entity of AK_FAMILY.filter((e) => e !== 'Municipality of Anchorage')) {
      for (const fy of [2016, 2020, 2025]) {
        for (const mode of MODES) {
          const label = dataSourceLabel({ entityLabel: entity }, fy, mode);
          expect(auditGradeForDataSource(label), `${entity} FY${fy} ${mode}`)
            .toBe(AUDIT_GRADE.AUDITED_GAAP);
        }
      }
    }
  });

  it('⭐⭐ refuses to grade a year whose opinion was never read', () => {
    // ⚠ THE ASYMMETRY IS THE POINT. The two calendars were read over different
    // windows, so a single FY2012-FY2025 range would auto-grade an Anchorage
    // FY2025 ACFR the moment it loaded, off an opinion nobody had opened.
    expect(auditGradeForDataSource(dataSourceLabel(ANCHORAGE, 2025, 'revenue'))).toBe(AUDIT_GRADE.UNKNOWN);
    expect(auditGradeForDataSource(dataSourceLabel(ANCHORAGE, 2011, 'revenue'))).toBe(AUDIT_GRADE.UNKNOWN);
    expect(auditGradeForDataSource(dataSourceLabel(KODIAK, 2015, 'revenue'))).toBe(AUDIT_GRADE.UNKNOWN);
    expect(auditGradeForDataSource(dataSourceLabel(KODIAK, 2026, 'revenue'))).toBe(AUDIT_GRADE.UNKNOWN);
    // ...while the years that WERE read still grade, so the narrowing has not
    // simply broken the entry.
    expect(auditGradeForDataSource(dataSourceLabel(ANCHORAGE, 2024, 'revenue'))).toBe(AUDIT_GRADE.AUDITED_GAAP);
    expect(auditGradeForDataSource(dataSourceLabel(KODIAK, 2025, 'revenue'))).toBe(AUDIT_GRADE.AUDITED_GAAP);
  });

  it('leaves an UNRECOGNISED source unknown on both axes', () => {
    const label = dataSourceLabel({ entityLabel: 'Some Brand New City' }, 2024, 'revenue');
    expect(reportingEntityForDataSource(label)).toBe(REPORTING_ENTITY.UNKNOWN);
    expect(auditGradeForDataSource(label)).toBe(AUDIT_GRADE.UNKNOWN);
    for (const bad of ['', null]) {
      expect(reportingEntityForDataSource(bad)).toBe(REPORTING_ENTITY.UNKNOWN);
      expect(auditGradeForDataSource(bad)).toBe(AUDIT_GRADE.UNKNOWN);
    }
  });
});

describe('axisStampFor — an unknown is OMITTED, never written', () => {
  it('⭐ carries all four axes for a fully classified label', () => {
    for (const cfg of [ANCHORAGE, KODIAK]) {
      for (const mode of MODES) {
        const label = dataSourceLabel(cfg, 2024, mode);
        expect(axisStampFor(label), `${cfg.entityLabel} ${mode}`).toEqual({
          fund_scope: SCOPE.GENERAL_FUND,
          basis: BASIS.ACTUAL,
          reporting_entity: REPORTING_ENTITY.PRIMARY,
          audit_grade: AUDIT_GRADE.AUDITED_GAAP,
        });
      }
    }
  });

  it('⭐⭐ drops ONLY the ungradeable axis for an unread year', () => {
    // Anchorage FY2025: scope, basis and reporting entity hold for the family
    // whatever the year, but the audit grade is per DOCUMENT and that document
    // has not been read. Three axes written, one left alone.
    const label = dataSourceLabel(ANCHORAGE, 2025, 'operating');
    expect(axisStampFor(label)).toEqual({
      fund_scope: SCOPE.GENERAL_FUND,
      basis: BASIS.ACTUAL,
      reporting_entity: REPORTING_ENTITY.PRIMARY,
    });
  });

  it('⭐⭐ omits a column it cannot classify instead of writing unknown over it', () => {
    // The whole reason this returns a PATCH. A row may already carry a value
    // this loader's registries cannot reproduce; stamping `unknown` there is
    // PR #300's defect wearing a different column name.
    const unknownToBoth = dataSourceLabel({ entityLabel: 'Some Brand New City' }, 2024, 'revenue');
    const patch = axisStampFor(unknownToBoth);
    expect(patch).toEqual({});
    expect('fund_scope' in patch).toBe(false);
    expect('basis' in patch).toBe(false);
  });

  it('omits ONE axis without suppressing the others', () => {
    // The axes are classified independently, so a family evidenced on scope but
    // not yet on basis — which is exactly what Alaska was until this change —
    // must still get its other three stamped.
    const label = dataSourceLabel(KODIAK, 2024, 'operating');
    expect(axisStampFor(label, { basis: [] })).toEqual({
      fund_scope: SCOPE.GENERAL_FUND,
      reporting_entity: REPORTING_ENTITY.PRIMARY,
      audit_grade: AUDIT_GRADE.AUDITED_GAAP,
    });
  });

  it('writes nothing but the four axis columns', () => {
    // The caller spreads this into an update beside source_url, source_date,
    // data_source and fiscal_year_start_month. A stray key here would overwrite
    // one of those silently.
    const keys = Object.keys(axisStampFor(dataSourceLabel(KODIAK, 2024, 'revenue'))).sort();
    expect(keys).toEqual(['audit_grade', 'basis', 'fund_scope', 'reporting_entity']);
  });

  it('agrees with every single-axis helper, on every label', () => {
    const cases = [...AK_FAMILY, ...TX_CO_FAMILY, 'Some Brand New City'];
    for (const entity of cases) {
      for (const fy of [2011, 2024, 2025]) {
        for (const mode of MODES) {
          const label = dataSourceLabel({ entityLabel: entity }, fy, mode);
          const patch = axisStampFor(label);
          expect(patch.fund_scope ?? SCOPE.UNKNOWN).toBe(scopeForDataSource(label));
          expect(patch.basis ?? BASIS.UNKNOWN).toBe(basisForDataSource(label));
          expect(patch.reporting_entity ?? REPORTING_ENTITY.UNKNOWN)
            .toBe(reportingEntityForDataSource(label));
          expect(patch.audit_grade ?? AUDIT_GRADE.UNKNOWN).toBe(auditGradeForDataSource(label));
        }
      }
    }
  });
});
