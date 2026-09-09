import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  IN_COUNTY_ENTITIES, IN_COUNTY_STATE, IN_COUNTY_ENTITY_TYPE, IN_COUNTY_DEFERRED,
  IN_COUNTY_BASIS_GAPS, IN_COUNTY_COVERAGE_GAPS, IN_COUNTY_FILING_CHOICES,
  IN_COUNTY_SERIES_NOTES,
  fiscalMonthFor, inCountyFilingsFor, inCountyLoadableEntities, inCountyRoster,
  inCountyYearsFor, rosterEntryFor,
} from '../scripts/data/inCountyAcfrEntities.mjs';
import {
  IN_COUNTY_MODIFIED_OPINIONS, IN_COUNTY_UNMODIFIED, opinionFor, opinionIsFundLevel,
} from '../scripts/data/inCountyAcfrOpinions.mjs';
import { KNOWN_DOCUMENT_GAPS, MODES, loadableYearsFor } from '../scripts/extractInCountiesAll.mjs';
import {
  BASIS_VALUE, DERIVATION, FUND_SCOPE, sourceNameFor, sourcePrefixFor,
} from '../scripts/loadInCountyAcfrs.mjs';
import { AUDIT_GRADE_REGISTRY, gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { AUDIT_GRADE, BASIS, BASIS_VALUES, classifyAxis } from '../scripts/lib/budgetAxes.mjs';
import { SCOPE, classify } from '../scripts/lib/fundScope.mjs';
import { censusGuard } from '../scripts/lib/facFiscalYearCensus.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';

/** Every (entity, fiscalYear) this wave intends to write. Derived, never listed. */
function loadablePairs() {
  return inCountyLoadableEntities().flatMap(
    (e) => loadableYearsFor(e).map((fy) => ({ entity: e, fy })),
  );
}

describe('the Indiana county ACFR roster, waves 1 and 2', () => {
  it('holds Indiana\'s eight largest counties, in population order, and loads all eight', () => {
    expect(IN_COUNTY_ENTITIES.map((e) => e.key)).toEqual([
      'marion', 'lake', 'allen', 'hamilton',              // wave 1
      'st-joseph', 'elkhart', 'tippecanoe', 'hendricks',  // wave 2
    ]);
    expect(inCountyLoadableEntities().map((e) => e.key)).toHaveLength(8);
    expect(Object.keys(IN_COUNTY_DEFERRED)).toEqual([]);
    // ⚠ Each wave was chosen on a MEASURED ranking (Census PEP vintage 2024,
    // SUMLEV 050), not on reputation, and the two together are Indiana's eight
    // largest counties in order — so wave 3 starts at number nine.
    const pops = IN_COUNTY_ENTITIES.map((e) => e.population);
    expect(pops).toEqual([...pops].sort((a, b) => b - a));
    expect(pops).toEqual([981628, 502955, 399295, 379704,
      273744, 207436, 191650, 190629]);
  });

  it('types every entity as a county, and `county` renders a source chip', () => {
    for (const e of IN_COUNTY_ENTITIES) {
      expect(e.entityType).toBe(IN_COUNTY_ENTITY_TYPE);
      expect(e.state).toBe(IN_COUNTY_STATE);
    }
    // ⚠⚠ FIVE DECLARATIONS MUST AGREE ON AN entity_type AND THE TS UNION GATES
    // THE REST — 949 PA boroughs reached the DB and showed NO source chip. This
    // asserts the reader-facing end of that chain rather than only the DB end.
    expect(SOURCE_CHIP_ENTITY_TYPES).toContain('county');
  });

  it('names each entity with the word County, because that IS the name', () => {
    // ⚠ `County of Marion` would be a second, different government by
    // `treasury_ensure_municipality`'s (name, state, entity_type) key — and the
    // Gateway load already created these rows as `Marion County`.
    for (const e of IN_COUNTY_ENTITIES) expect(e.name).toMatch(/ County$/);
    expect(sourcePrefixFor(IN_COUNTY_ENTITIES[0]))
      .toBe('Marion County ACFR — Total Governmental Funds');
  });
});

describe('the year list comes from the committed FAC roster', () => {
  it('reads every entity out of the roster PR #154 built', () => {
    expect(inCountyRoster().counties).toBe(92);
    expect(inCountyRoster().withFilings).toBe(89);
    for (const e of IN_COUNTY_ENTITIES) expect(rosterEntryFor(e.name).name).toBe(e.name);
  });

  it('declares no facReports of its own — one record, not two that can disagree', () => {
    for (const e of IN_COUNTY_ENTITIES) expect(e.facReports).toBeUndefined();
  });

  it('carries the roster years exactly, including Lake\'s missing FY2019', () => {
    const years = Object.fromEntries(
      IN_COUNTY_ENTITIES.map((e) => [e.key, inCountyYearsFor(e)]));
    expect(years.marion).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(years.hamilton).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(years.allen).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    // ⚠ FY2019 and FY2025 are absent because FAC serves no filing, not because
    // the county stopped publishing. Coverage is a property of the $750k Single
    // Audit threshold: 44 Indiana counties file for FY2016 and 86 for FY2020.
    expect(years.lake).toEqual([2016, 2017, 2018, 2020, 2021, 2022, 2023, 2024]);
    expect(Object.keys(IN_COUNTY_COVERAGE_GAPS.lake).map(Number)).toEqual([2019, 2025]);
    expect(Object.keys(IN_COUNTY_COVERAGE_GAPS.allen).map(Number)).toEqual([2025]);
  });

  it('carries wave 2\'s roster years, including St. Joseph\'s hole at FY2023', () => {
    const years = Object.fromEntries(
      IN_COUNTY_ENTITIES.map((e) => [e.key, inCountyYearsFor(e)]));
    // ⚠⚠ A COVERAGE GAP IN THE MIDDLE OF A SERIES, not at its edges. St. Joseph
    // files GAAP either side of FY2023 and files nothing for FY2023 itself. It
    // is reported, never interpolated, and never a $0 — and it is why that
    // county's FY2024 series movement spans TWO years.
    expect(years['st-joseph']).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2024, 2025]);
    expect(Object.keys(IN_COUNTY_COVERAGE_GAPS['st-joseph']).map(Number))
      .toEqual([2016, 2023]);
    expect(IN_COUNTY_COVERAGE_GAPS['st-joseph'][2023]).toMatch(/HOLE INSIDE THE SERIES/);
    for (const key of ['elkhart', 'tippecanoe', 'hendricks']) {
      expect(years[key]).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
      expect(Object.keys(IN_COUNTY_COVERAGE_GAPS[key]).map(Number)).toEqual([2025]);
    }
  });

  it('records `facEin` as evidence that the roster itself corroborates', () => {
    // ⚠⚠ ONE INDIANA COUNTY CAN FILE UNDER TWO EINs — the opposite of South
    // Carolina, where one EIN covered two governments. Identity is the ROSTER
    // COUNTY; `facEin` is an attribute of a filing and nothing joins on it. A
    // declared id that matches no filing is well-formed, plausible and inert,
    // which is exactly how PA's Oil City entry went wrong.
    for (const e of IN_COUNTY_ENTITIES) {
      const eins = new Set(inCountyFilingsFor(e).map((f) => f.ein));
      expect(eins.has(e.facEin)).toBe(true);
    }
  });
});

describe('a county-year with two accepted filings refuses until the choice is recorded', () => {
  it('resolves Allen FY2023 to the later, more complete filing', () => {
    const chosen = IN_COUNTY_FILING_CHOICES['allen-2023'];
    expect(chosen.reportId).toBe('2023-12-GSAFAC-0000068814');
    // ⚠⚠ FAC marks BOTH filings `most_recent`, so `resubmission_status` cannot
    // decide — the Sumter SC FY2024 defect in a second state. The recorded
    // reason has to say what was COMPARED, not merely which was picked.
    expect(chosen.why).toMatch(/IDENTICAL IN BOTH/);
    expect(chosen.why).toMatch(/260,926,477/);
    const allen = IN_COUNTY_ENTITIES.find((e) => e.key === 'allen');
    const fy2023 = inCountyFilingsFor(allen).find((f) => f.fy === 2023);
    expect(fy2023.reportId).toBe('2023-12-GSAFAC-0000068814');
  });

  it('throws rather than letting array order pick', () => {
    // Mutation test: with the choice removed, the resolver must REFUSE.
    const roster = inCountyRoster();
    const allen = roster.entities.find((e) => e.name === 'Allen County');
    const y2023 = allen.years.find((y) => y.year === 2023);
    expect(y2023.filings).toHaveLength(2);
    const fake = { key: 'allen-unrecorded', name: 'Allen County' };
    expect(() => inCountyFilingsFor(fake))
      .toThrow(/two accepted filings|2 accepted FAC filings/i);
  });

  it('refuses a recorded choice that names no real filing', () => {
    // ⚠ A declared exception that names nothing excludes nothing — PA's Oil City.
    const before = IN_COUNTY_FILING_CHOICES['allen-2023'].reportId;
    expect(before).toMatch(/^2023-12-GSAFAC-/);
    const allen = IN_COUNTY_ENTITIES.find((e) => e.key === 'allen');
    const ids = inCountyFilingsFor(allen).map((f) => f.reportId);
    expect(ids).toContain(before);
  });
});

describe('THE GAAP CEILING — basis is a property of the FILING, not the county', () => {
  it('excludes Lake\'s six regulatory-basis years and keeps only FY2020-FY2021', () => {
    // ⚠⚠ THE FINDING THAT RESIZES THE ROUTE. 459 of Indiana's 562 county FAC
    // filings are State Board of Accounts REGULATORY-BASIS reports with no
    // governmental-funds statement in them at all. Only 17 of the 89 filing
    // counties ever file GAAP. "89 counties file" was never "89 can be loaded".
    expect(Object.keys(IN_COUNTY_BASIS_GAPS.lake).map(Number))
      .toEqual([2016, 2017, 2018, 2022, 2023, 2024]);
    const lake = IN_COUNTY_ENTITIES.find((e) => e.key === 'lake');
    expect(loadableYearsFor(lake)).toEqual([2020, 2021]);
    for (const why of Object.values(IN_COUNTY_BASIS_GAPS.lake)) {
      expect(why).toMatch(/REGULATORY-BASIS/);
      expect(why).toMatch(/sp_framework_basis=regulatory_basis/);
    }
  });

  it('leaves the wave-1 counties that file GAAP throughout untouched', () => {
    for (const key of ['marion', 'allen', 'hamilton']) {
      const e = IN_COUNTY_ENTITIES.find((x) => x.key === key);
      expect(loadableYearsFor(e)).toEqual(inCountyYearsFor(e));
    }
  });

  it('opens wave 2\'s GAAP window at FY2019 in ALL FOUR counties', () => {
    // ⭐ THE FINDING OF WAVE 2, MEASURED RATHER THAN GUESSED. Every FY2016-FY2018
    // filing these four counties have is an SBOA regulatory-basis report and
    // every FY2019-onward one is GAAP. The transition is a PUBLISHING CHANGE,
    // not a coverage change — the filings exist throughout.
    // ⚠⚠ A route that measured COVERAGE would have read those eleven documents
    // as loadable and produced the all-funds cash figures this family exists to
    // escape, under an `audited_gaap` label.
    for (const key of ['st-joseph', 'elkhart', 'tippecanoe', 'hendricks']) {
      const e = IN_COUNTY_ENTITIES.find((x) => x.key === key);
      const loadable = loadableYearsFor(e);
      expect(Math.min(...loadable)).toBe(2019);
      for (const fy of Object.keys(IN_COUNTY_BASIS_GAPS[key]).map(Number)) {
        expect(fy).toBeLessThan(2019);
      }
      for (const why of Object.values(IN_COUNTY_BASIS_GAPS[key])) {
        expect(why).toMatch(/REGULATORY-BASIS/);
        expect(why).toMatch(/sp_framework_basis=regulatory_basis/);
        expect(why).toMatch(/gaap_results=not_gaap/);
      }
    }
    // ⚠ Marion, Allen and Hamilton reaching FY2016 is the EXCEPTION among
    // Indiana's seventeen GAAP counties, not the rule.
    for (const key of ['marion', 'allen', 'hamilton']) {
      const e = IN_COUNTY_ENTITIES.find((x) => x.key === key);
      expect(Math.min(...loadableYearsFor(e))).toBe(2016);
    }
  });

  it('loads 55 entity-years and declares every absence with a cause', () => {
    expect(loadablePairs()).toHaveLength(55);
    const perEntity = Object.fromEntries(
      inCountyLoadableEntities().map((e) => [e.key, loadableYearsFor(e).length]));
    expect(perEntity).toEqual({
      marion: 10, lake: 2, allen: 9, hamilton: 10,                     // 31, wave 1
      'st-joseph': 6, elkhart: 6, tippecanoe: 6, hendricks: 6,         // 24, wave 2
    });
    // ⚠ THREE KINDS OF ABSENCE, NONE OF THEM $0: a coverage gap (no filing), a
    // basis gap (a filing that is not GAAP), a document gap (a GAAP filing that
    // cannot be read). Wave 1 had 3 + 6 + 0; both waves together are 8 + 17 + 0.
    const coverage = Object.values(IN_COUNTY_COVERAGE_GAPS)
      .reduce((n, y) => n + Object.keys(y).length, 0);
    const basis = Object.values(IN_COUNTY_BASIS_GAPS)
      .reduce((n, y) => n + Object.keys(y).length, 0);
    expect([coverage, basis, Object.keys(KNOWN_DOCUMENT_GAPS).length]).toEqual([8, 17, 0]);
    // ⚠⚠ AND THE 17 ARE CORROBORATED FROM THE DOCUMENTS THEMSELVES, not only
    // from FAC's metadata: `scripts/verifyInCountyOpinions.py` finds the SBOA
    // dual-opinion signature (ADVERSE on GAAP + unmodified on the regulatory
    // basis) in exactly those seventeen and in no other Indiana county document.
    // A third, independent signal: the shared reader's own page finder locates
    // no governmental-funds statement in any of them.
  });
});

describe('the fiscal calendar is confirmed per entity-year, never assumed', () => {
  it('runs January for every loadable entity-year, and the census agrees or is silent', () => {
    let confirmed = 0;
    let uncovered = 0;
    for (const { entity, fy } of loadablePairs()) {
      const month = fiscalMonthFor(entity, fy);
      expect(month).toBe(1);
      const guard = censusGuard(entity.censusName, IN_COUNTY_STATE, month, fy);
      expect(guard.error).toBeUndefined();
      if (guard.unknown) uncovered += 1; else confirmed += 1;
    }
    // ⚠ ALL 55 are actively confirmed — the census reaches FY2025 for all three
    // counties that filed one. The `uncovered` branch is still asserted at zero
    // rather than dropped: silence is not disagreement, and if a later wave adds
    // a year the census cannot reach, this number is where it will show up.
    expect(uncovered).toBe(0);
    expect(confirmed).toBe(55);
  });

  it('rejects a contradicting month, so the guard is not decorative', () => {
    // Mutation test: the guard must actually be able to fail.
    const bad = censusGuard('Marion County', IN_COUNTY_STATE, 7, 2024);
    expect(bad.error).toBeTruthy();
  });
});

describe('the audit opinion is recorded per document', () => {
  it('covers every loadable entity-year exactly once', () => {
    for (const { entity, fy } of loadablePairs()) {
      // ⚠⚠ THROWS on an entity-year nobody looked at. A registry that answers
      // "no modification" for an unexamined year launders an absence of evidence
      // into a clean bill.
      expect(() => opinionFor(entity.key, fy)).not.toThrow();
      const modified = Boolean(IN_COUNTY_MODIFIED_OPINIONS[`${entity.key}-${fy}`]);
      const unmodified = (IN_COUNTY_UNMODIFIED[entity.key] || []).includes(fy);
      expect(modified !== unmodified).toBe(true);
    }
  });

  it('throws for an entity-year recorded nowhere', () => {
    expect(() => opinionFor('marion', 2099)).toThrow(/no recorded audit opinion/);
  });

  it('records eighteen modified opinions, of which exactly one is fund-level', () => {
    const modified = loadablePairs().filter(({ entity, fy }) => opinionFor(entity.key, fy));
    // 11 in wave 1 (9 Allen + 2 Lake), 7 more in wave 2 (2 St. Joseph,
    // 2 Elkhart, 3 Hendricks). Tippecanoe is clean in all six of its years.
    expect(modified).toHaveLength(18);
    const fundLevel = loadablePairs()
      .filter(({ entity, fy }) => opinionIsFundLevel(entity.key, fy))
      .map(({ entity, fy }) => `${entity.key}-${fy}`);
    // ⚠⚠ Allen FY2020's SECOND qualification names the Aggregate Remaining Fund
    // Information, which spans the nonmajor governmental funds this row reports.
    // The auditor's stated basis is entirely fiduciary, but that is a judgement
    // and the year is flagged rather than argued down.
    expect(fundLevel).toEqual(['allen-2020']);
  });

  it('keeps wave 2\'s seven modifications outside the loaded scope, on the evidence', () => {
    // ⚠⚠ TWO OF THESE ARRIVED AS BARE VERDICT HEADINGS — St. Joseph FY2020
    // prints `Adverse Opinion` and Elkhart FY2020 `Qualified Opinion` with no
    // unit named on the heading line — and the gate's conservative default
    // reported both as FUND-LEVEL. Each sits under its own `Basis for <kind>
    // Opinion on <unit>` heading naming a DISCRETELY PRESENTED COMPONENT UNIT.
    const wave2 = ['st-joseph-2020', 'st-joseph-2021', 'elkhart-2020', 'elkhart-2021',
      'hendricks-2020', 'hendricks-2021', 'hendricks-2022'];
    for (const key of wave2) {
      expect(IN_COUNTY_MODIFIED_OPINIONS[key].scope).toBe('outside');
    }
    expect(IN_COUNTY_MODIFIED_OPINIONS['st-joseph-2020'].kind).toBe('adverse');
    expect(IN_COUNTY_MODIFIED_OPINIONS['st-joseph-2020'].units)
      .toEqual(['Aggregate Discretely Presented Component Units']);
    // ⚠⚠ HENDRICKS IS THE ONLY WAVE-2 MODIFICATION NAMING A "MAJOR FUND" AT ALL,
    // and it is still outside: the Regional Sewer District is a major ENTERPRISE
    // fund, paired with `Business-Type Activities` in every heading, and it
    // appears in NO column of the governmental funds statement. Checked on the
    // statement page, not inferred from the words.
    for (const fy of [2020, 2021, 2022]) {
      expect(IN_COUNTY_MODIFIED_OPINIONS[`hendricks-${fy}`].units)
        .toContain('Hendricks County Regional Sewer District');
      expect(IN_COUNTY_MODIFIED_OPINIONS[`hendricks-${fy}`].why)
        .toMatch(/ENTERPRISE fund|business-type/i);
    }
    // ⭐ Tippecanoe carries none at all.
    for (const fy of [2019, 2020, 2021, 2022, 2023, 2024]) {
      expect(IN_COUNTY_MODIFIED_OPINIONS[`tippecanoe-${fy}`]).toBeUndefined();
      expect(opinionFor('tippecanoe', fy)).toBeNull();
    }
  });

  it('records where FAC\'s own metadata UNDER-REPORTS the document', () => {
    // ⚠⚠ THE ALLEN FY2016/FY2017 SHAPE, NOW IN THREE MORE PLACES. FAC's
    // `gaap_results` carries only the modified token for Elkhart FY2021
    // (`qualified_opinion`) and Hendricks FY2020/FY2021 (`disclaimer_of_opinion`),
    // omitting the unmodified fund-level opinions those documents plainly give.
    // THE DOCUMENT IS THE AUTHORITY; the metadata is a locator.
    expect(IN_COUNTY_MODIFIED_OPINIONS['elkhart-2021'].why).toMatch(/under-reporting|UNDER-REPORT/i);
    expect(IN_COUNTY_MODIFIED_OPINIONS['hendricks-2020'].why).toMatch(/under-reporting|UNDER-REPORT/i);
  });

  it('says which units each modification names, and why it is or is not in scope', () => {
    for (const [key, rec] of Object.entries(IN_COUNTY_MODIFIED_OPINIONS)) {
      expect(['outside', 'fund_level']).toContain(rec.scope);
      expect(rec.units.length).toBeGreaterThan(0);
      expect(rec.why.length).toBeGreaterThan(120);
      expect(key).toMatch(/^[a-z-]+-20\d\d$/);
    }
    expect(IN_COUNTY_MODIFIED_OPINIONS['lake-2020'].units).toContain('Governmental Activities');
    expect(IN_COUNTY_MODIFIED_OPINIONS['lake-2020'].why).toMatch(/288,186,733/);
    expect(IN_COUNTY_MODIFIED_OPINIONS['allen-2024'].units)
      .toEqual(['Aggregate Discretely Presented Component Units']);
  });
});

describe('every 20%+ series movement is traced, and one of them is a relabelling', () => {
  it('names a note for each flagged year, keyed to a loadable entity-year', () => {
    expect(Object.keys(IN_COUNTY_SERIES_NOTES).sort()).toEqual([
      'allen-2023', 'allen-2024', 'elkhart-2022', 'elkhart-2023', 'elkhart-2024',
      'hamilton-2023', 'hendricks-2020', 'hendricks-2023',
      'marion-2019', 'marion-2020', 'marion-2022', 'marion-2023',
      'st-joseph-2024', 'tippecanoe-2023',
    ]);
    const loadable = new Set(loadablePairs().map(({ entity, fy }) => `${entity.key}-${fy}`));
    for (const key of Object.keys(IN_COUNTY_SERIES_NOTES)) expect(loadable.has(key)).toBe(true);
  });

  it('records that Marion RECLASSIFIED its expenditure functions at FY2023', () => {
    // ⚠⚠ NOT A SPENDING CHANGE. General government -158,914,868 and Public
    // safety -160,327,166 against Corrections +141,746,632 and Judicial
    // +129,480,926 is the SAME MONEY UNDER NEW NAMES. Totals stay comparable
    // across the break; CATEGORIES do not. Loaded as published and flagged —
    // normalising two charts of accounts onto one another is inferring intent.
    const note = IN_COUNTY_SERIES_NOTES['marion-2023'];
    expect(note).toMatch(/RECLASSIFIED/);
    expect(note).toMatch(/SAME MONEY UNDER NEW NAMES/);
    expect(note).toMatch(/THE CATEGORIES DO NOT/);
  });

  it('says where the money came from without letting a bond issue become revenue', () => {
    // ⚠ Allen issued $203,655,000 of bonds in FY2024 and Hamilton $157,500,000
    // in FY2023. Both are OTHER FINANCING SOURCES, below the `Total revenues`
    // row, and neither is in the loaded revenue — the LA TRAN defect, where
    // $4.77B of borrowing was counted as spending because of a label.
    expect(IN_COUNTY_SERIES_NOTES['allen-2024']).toMatch(/203,655,000/);
    expect(IN_COUNTY_SERIES_NOTES['allen-2024']).toMatch(/OTHER FINANCING SOURCE/);
    expect(IN_COUNTY_SERIES_NOTES['hamilton-2023']).toMatch(/157,500,000/);
    // ⚠ St. Joseph FY2024 issues $40,000,000 into the GM-Samsung bond fund. Same
    // trap, third county.
    expect(IN_COUNTY_SERIES_NOTES['st-joseph-2024']).toMatch(/40,000,000/);
    expect(IN_COUNTY_SERIES_NOTES['st-joseph-2024']).toMatch(/OTHER FINANCING SOURCE/);
  });

  it('says that St. Joseph\'s FY2024 movement spans TWO years, not one', () => {
    // ⚠⚠ A MOVEMENT REPORT THAT ASSUMED CONSECUTIVE YEARS WOULD DESCRIBE A
    // TWO-YEAR CHANGE AS A ONE-YEAR ONE. St. Joseph has no FY2023 filing, so
    // FY2024's neighbour in the series is FY2022.
    expect(IN_COUNTY_SERIES_NOTES['st-joseph-2024']).toMatch(/ACROSS TWO YEARS, NOT ONE/);
    const sj = IN_COUNTY_ENTITIES.find((e) => e.key === 'st-joseph');
    expect(loadableYearsFor(sj)).not.toContain(2023);
  });

  it('does not mistake a relabelling for a movement, in a second county', () => {
    // ⚠ Hendricks relabelled `Investment Income` to `Investment income` between
    // FY2019 and FY2020, so a naive label diff shows two moves where there is
    // one small one. Both load in the case the ISSUER printed.
    expect(IN_COUNTY_SERIES_NOTES['hendricks-2020']).toMatch(/relabelled/);
    expect(IN_COUNTY_SERIES_NOTES['hendricks-2020']).toMatch(/-221,693/);
  });

  it('quotes the issuer wherever the issuer gives a mechanism', () => {
    // ⭐ The tie proves the READ; a traced movement is what says the SERIES is
    // comparable. Three wave-2 notes carry the county's own words.
    expect(IN_COUNTY_SERIES_NOTES['hendricks-2023'])
      .toMatch(/change in estimating local income taxes/);
    expect(IN_COUNTY_SERIES_NOTES['tippecanoe-2023'])
      .toMatch(/increase in amounts distributed by the state/);
    expect(IN_COUNTY_SERIES_NOTES['st-joseph-2024'])
      .toMatch(/Amazon Web Servies/);   // ⚠ the county's own spelling, quoted as printed
  });
});

describe('the source label, and the three axis registries that must match it', () => {
  it('names the scope it actually reads', () => {
    expect(sourceNameFor(IN_COUNTY_ENTITIES[0], 'revenue', 2025))
      .toBe('Marion County ACFR — Total Governmental Funds Revenue by Source '
        + '(FY2025 actual, GAAP basis)');
    expect(sourceNameFor(IN_COUNTY_ENTITIES[3], 'operating', 2016))
      .toBe('Hamilton County ACFR — Total Governmental Funds Expenditure by Function '
        + '(FY2016 actual, GAAP basis)');
    // ⚠⚠ NOT `General Fund`. Every other ACFR family in TT reads the General
    // Fund column; a label that said so while reading the total-governmental
    // column is failure mode 11 — the LA TRAN shape, at a $0 tie.
    for (const { entity, fy } of loadablePairs()) {
      for (const mode of MODES) {
        expect(sourceNameFor(entity, mode === 'operating' ? 'operating' : 'revenue', fy))
          .not.toMatch(/General Fund/);
      }
    }
  });

  it('is claimed by ALL THREE registries, for every one of the 110 labels', () => {
    // ⚠⚠ THE DEFECT THIS EXISTS TO CATCH HAS HAPPENED THREE TIMES: Florida's
    // third branch matched NONE of three registries, Pennsylvania matched only
    // auditGrade, and SC wave 3 widened two of three. Rows sit unclaimed while
    // looking perfectly fine — invisible at 58 rows, not at 51,078.
    let n = 0;
    for (const { entity, fy } of loadablePairs()) {
      for (const datasetType of ['revenue', 'operating']) {
        const label = sourceNameFor(entity, datasetType, fy);
        n += 1;
        expect(FUND_SCOPE_REGISTRY.filter((e) => e.match.test(label)).map((e) => e.id))
          .toEqual(['in-county-acfr-tg']);
        expect(BASIS_REGISTRY.filter((e) => e.match.test(label)).map((e) => e.id))
          .toEqual(['in-county-acfr-tg']);
        expect(AUDIT_GRADE_REGISTRY.filter((e) => e.match.test(label)).map((e) => e.id))
          .toEqual(['in-county-acfr-tg']);
      }
    }
    expect(n).toBe(110);
  });

  it('classifies to total_governmental / actual / audited_gaap', () => {
    const label = sourceNameFor(IN_COUNTY_ENTITIES[0], 'revenue', 2025);
    expect(FUND_SCOPE).toBe(SCOPE.TOTAL_GOVERNMENTAL);
    expect(BASIS_VALUE).toBe(BASIS.ACTUAL);
    expect(DERIVATION).toBe('published');
    expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
    expect(gradeFor(label).entryId).toBe('in-county-acfr-tg');
    // ⚠ `classifyAxis` refuses an entry with no `evidence`, so this asserts the
    // evidence block is present and real, not only that the pattern matches.
    expect(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN))
      .toEqual({ value: BASIS.ACTUAL, entryId: 'in-county-acfr-tg' });
    expect(classify(label, FUND_SCOPE_REGISTRY))
      .toEqual({ scope: SCOPE.TOTAL_GOVERNMENTAL, entryId: 'in-county-acfr-tg' });
  });

  it('does NOT claim the Indiana Gateway rows that sit beside it', () => {
    // ⚠⚠ The same counties already hold Gateway AFR rows at `all_funds`, and
    // Marion's run ~3.3x its audited governmental-funds revenue. Two scopes of
    // one government are two rows, not a conflict — but only while neither
    // pattern reaches the other's label.
    for (const gw of [
      'Indiana Gateway Annual Financial Report — Receipts by Fund (FY2024 actual)',
      'Marion County Gateway AFR — Receipts by Fund (FY2024 actual)',
    ]) {
      for (const reg of [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, AUDIT_GRADE_REGISTRY]) {
        expect(reg.filter((e) => e.match.test(gw)).map((e) => e.id))
          .not.toContain('in-county-acfr-tg');
      }
    }
  });

  it('is anchored, so a NINTH county lands `unknown` until it is evidenced', () => {
    // ⚠ An unanchored `/ACFR —/` shape claims ~1,850 rows across families nobody
    // has reconciled. The correct failure direction for a new entity is
    // `unknown`, not an inherited grade.
    // ⚠⚠ THIS TEST NAMED ST. JOSEPH COUNTY UNTIL WAVE 2 LOADED IT, and then
    // asserted the opposite of the truth. A placeholder that is a real
    // government is a placeholder with an expiry date; Vanderburgh is the next
    // county in the seventeen and is deliberately NOT loaded.
    const unevidenced = 'Vanderburgh County ACFR — Total Governmental Funds Revenue by Source '
      + '(FY2024 actual, GAAP basis)';
    expect(IN_COUNTY_ENTITIES.some((e) => e.name === 'Vanderburgh County')).toBe(false);
    expect(FUND_SCOPE_REGISTRY.some((e) => e.match.test(unevidenced))).toBe(false);
    expect(AUDIT_GRADE_REGISTRY.some((e) => e.match.test(unevidenced))).toBe(false);
    expect(BASIS_REGISTRY.some((e) => e.match.test(unevidenced))).toBe(false);
  });

  it('escapes the period in `St. Joseph County` so the pattern is not merely inert', () => {
    // ⚠ An unescaped `.` matches ANY character, so the pattern would also claim
    // `StXJoseph County ACFR — ...`. Nothing would ever produce that string, so
    // the bug would be invisible — and a pattern that is wrong but inert is
    // exactly the shape this repo keeps shipping.
    const bogus = 'StXJoseph County ACFR — Total Governmental Funds Revenue by Source '
      + '(FY2024 actual, GAAP basis)';
    for (const reg of [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, AUDIT_GRADE_REGISTRY]) {
      expect(reg.some((e) => e.match.test(bogus))).toBe(false);
    }
    expect(FUND_SCOPE_REGISTRY.some(
      (e) => e.match.test(sourceNameFor(
        IN_COUNTY_ENTITIES.find((x) => x.key === 'st-joseph'), 'revenue', 2024)))).toBe(true);
  });
});

describe('the extractors declare the facts the library cannot infer', () => {
  const read = (p) => readFileSync(p, 'utf8');

  it('gives every entity its own wrapper, and every wrapper target_column=last', () => {
    for (const e of inCountyLoadableEntities()) {
      const src = read(e.extractor);
      // ⚠⚠ Without this the wrapper reads the GENERAL FUND and returns it under
      // a total-governmental label, at a $0 tie. `scope_label()` derives the
      // root name from this very setting, which is why the extract driver and
      // the loader both assert the root name too.
      expect(src).toMatch(/target_column='last'/);
      expect(src).toMatch(/fy_end=\('December', 31\)/);
      // ⚠ Failure mode 10: a General-Fund-only statement in the same document.
      expect(src).toMatch(/Governmental\\s\+Funds/);
    }
  });

  it('does NOT share one expenditure shape between the eight counties', () => {
    // ⚠⚠ THREE COUNTIES, THREE SHAPES, AND COPYING ONE ONTO ANOTHER STILL TIES
    // TO THE CENT. Marion prints `Capital outlay` as a ROOT LEAF; Allen and
    // Hamilton print `Capital outlay:` as a PARENT over five children; Lake
    // prints no `Current:` heading at all. That is failure mode 2, and this test
    // exists so a future tidy-up cannot collapse them into one config.
    // ⚠ Read the CONFIG block, not the file: each docstring quotes its
    // NEIGHBOURS' shapes to explain why they must not be copied, and a whole-file
    // regex happily matches the warning instead of the setting.
    const configOf = (src) => src.slice(src.indexOf('CONFIG = CityConfig('));
    const parents = Object.fromEntries(inCountyLoadableEntities().map(
      (e) => [e.key, /\n {4}parents=\(([^)]*)\)/.exec(configOf(read(e.extractor)))[1]]));
    expect(parents.marion).toMatch(/'current', 'debt service'/);
    expect(configOf(read('scripts/extractMarionCountyIN.py')))
      .toMatch(/root_leaves=\('capital outlay',\)/);
    expect(parents.allen).toMatch(/'current', 'debt service', 'capital outlay'/);
    expect(parents.hamilton).toMatch(/'current', 'debt service', 'capital outlay'/);
    expect(parents.lake).toMatch(/'debt service', 'capital outlay'/);
    expect(parents.lake).not.toMatch(/'current'/);
    // ── wave 2 ─────────────────────────────────────────────────────────────
    expect(parents.elkhart).toMatch(/'current', 'debt service', 'capital outlay'/);
    expect(parents.tippecanoe).toMatch(/'current', 'debt service', 'capital outlay'/);
    expect(parents.hendricks).toMatch(/'current', 'debt service', 'capital outlay'/);
    // ⚠⚠ ST. JOSEPH INVERTS THEM AGAIN: `Capital outlay` is a valued ROOT LEAF
    // (Marion's shape) and `Debt service` is in BOTH tuples — FY2019 prints one
    // valued `Debt service - principal and interest` line at root and FY2020
    // onward print a valueless heading over two children. A fifth shape.
    const sj = configOf(read('scripts/extractStJosephCountyIN.py'));
    expect(parents['st-joseph']).toMatch(/'current', 'curren t', 'debt service'/);
    expect(sj).toMatch(/root_leaves=\('capital outlay', 'debt service'\)/);
    // ⚠ And its revenue section header is SINGULAR.
    expect(sj).toMatch(/revenue_section_header='revenue'/);
  });

  it('gives Tippecanoe the no-caption fallback and nobody else', () => {
    // ⚠⚠ TIPPECANOE PRINTS NO `Expenditures` CAPTION FROM FY2022 — its statement
    // goes straight from `Total revenues` to `Current:`. Confirmed by rendering
    // page 23 of the FY2022 filing to an image, not inferred from `-table`.
    // ⭐ This one could not have shipped wrong: with no caption and no fallback
    // the expenditure tree is EMPTY and the tie gate fails with the whole
    // printed total as its delta.
    const configOf = (src) => src.slice(src.indexOf('CONFIG = CityConfig('));
    expect(configOf(read('scripts/extractTippecanoeCountyIN.py')))
      .toMatch(/expenditures_follow_revenue_total=True/);
    for (const e of inCountyLoadableEntities()) {
      if (e.key === 'tippecanoe') continue;
      expect(configOf(read(e.extractor))).not.toMatch(/expenditures_follow_revenue_total/);
    }
  });

  it('declares St. Joseph\'s label repairs one observed spelling at a time', () => {
    // ⚠⚠ FIVE SPELLINGS OF `Intergovernmental` ACROSS SIX YEARS, and the printed
    // page says `Intergovernmental` every time — confirmed by rendering page 46
    // of the FY2024 filing. `label_fixes` is EXACT-MATCH by design: a de-spacing
    // heuristic would corrupt `Fines and forfeitures` and `Interest on long-term
    // debt` on the very same page.
    const sj = read('scripts/extractStJosephCountyIN.py');
    for (const spelling of ['T axes', 'In t ergo v ern men t al', 'In t ergo v ern ment al',
      'In t ergo v ern m en t al', 'P rin cip al', 'P r in cip al', 'Curren t']) {
      expect(sj).toContain(`'${spelling}'`);
    }
    // ⚠⚠ `Curren t` IS THE GROUP HEADING over six of the seven expenditure
    // functions, and `label_fixes` did not reach group headings for four rounds:
    // every leaf under it repaired, the tie at $0, the group itself misnamed.
    expect(sj).toMatch(/'Curren t': 'Current'/);
    // ⚠ TWO SEPARATE DECLARATIONS. Repairing the name does not open the group —
    // `parents` must ALSO name the spelling the character grid produced.
    expect(sj).toMatch(/parents=\('current', 'curren t'/);
  });

  it('groups Hamilton\'s revenue and nobody else\'s, with both groups named', () => {
    // ⚠⚠ Hamilton prints `Other:` TWICE ON ONE PAGE at two different levels — a
    // sub-heading inside `Taxes:` and a root group. Read without
    // `revenue_subparents` it produced ten revenue roots where the page prints
    // seven, at a tie of exactly $0.
    const hamilton = read('scripts/extractHamiltonCountyIN.py');
    expect(hamilton).toMatch(/revenue_parents=\('taxes', 'other'\)/);
    expect(hamilton).toMatch(/revenue_subparents=\('other',\)/);
    // ⚠ An incomplete member list closes the group after its first non-member
    // and reparents the rest to the root — failure mode 1. Both eras' members
    // are named because the printed group changed shape at FY2021.
    for (const member of ['property', 'income', 'food and beverage', 'innkeepers',
      'interest revenue', 'sale of property', 'donations', 'donation',
      'sale of assets', 'miscellaneous']) {
      expect(hamilton).toContain(`'${member}'`);
    }
    const configOf = (src) => src.slice(src.indexOf('CONFIG = CityConfig('));
    for (const key of ['marion', 'allen', 'lake', 'st-joseph']) {
      const e = IN_COUNTY_ENTITIES.find((x) => x.key === key);
      expect(configOf(read(e.extractor))).not.toMatch(/revenue_parents=\('/);
    }
  });

  it('groups wave 2\'s revenue three ways, each with its own member list', () => {
    // ⚠⚠ Elkhart, Tippecanoe and Hendricks all print `Taxes:` over their tax
    // kinds and `Other:` over `Miscellaneous` — but their MEMBER LISTS DIFFER,
    // and an incomplete list closes the group at its first non-member and
    // reparents the rest to the root at a $0 tie (failure mode 1).
    const need = {
      elkhart: ['property', 'income', 'other', 'miscellaneous'],
      tippecanoe: ['property', 'income', 'other', 'miscellaneous'],
      // ⚠ `innkeepers` is FY2023-FY2024 only and `contribution` FY2023 only —
      // one year each, and each named in full because these members share no
      // common suffix a rule could key on.
      hendricks: ['property', 'income', 'innkeepers', 'other',
        'contribution', 'miscellaneous'],
    };
    for (const [key, members] of Object.entries(need)) {
      const e = IN_COUNTY_ENTITIES.find((x) => x.key === key);
      const src = read(e.extractor);
      expect(src).toMatch(/revenue_parents=\('taxes', 'other'\)/);
      for (const m of members) expect(src).toContain(`'${m}'`);
    }
    // ⚠ NONE of the three declares `revenue_subparents`, and that is a statement
    // about their documents rather than a copy of Hamilton's config: their
    // in-`Taxes` `Other` always carries a VALUE, so it is a leaf, and the root
    // `Other:` only arrives after the tax group has already closed. Declaring it
    // would be inert config that reads as protection.
    for (const key of ['elkhart', 'tippecanoe', 'hendricks']) {
      const e = IN_COUNTY_ENTITIES.find((x) => x.key === key);
      expect(read(e.extractor)).not.toMatch(/revenue_subparents=\('/);
    }
  });

  it('gives Elkhart a second anchor branch for its truncated FY2024 title', () => {
    // ⚠⚠ THE ISSUER'S OWN TYPO IN ITS OWN TITLE — failure mode 12, in a second
    // county. Elkhart FY2024 prints `Statement of Revenues, Expenditures and
    // Changes in Fund Balances -` and then the date line. The `Governmental
    // Funds` the dash introduces IS NOT THERE; the dash dangles.
    const elkhart = read('scripts/extractElkhartCountyIN.py');
    expect(elkhart).toMatch(/Year\\s\+Ended\\s\+December/);
    expect(elkhart).toMatch(/Governmental\\s\+Funds/);
  });

  it('gives Lake an anchor that matches ITS title order', () => {
    // ⚠ Lake prints `Governmental Funds - Statement of Revenues...`, the words
    // BEFORE the title rather than after it. The Marion/Allen/Hamilton anchor
    // requires them to follow `Fund Balances` and matches nothing here.
    const lake = read('scripts/extractLakeCountyIN.py');
    expect(lake).toMatch(/Governmental\\s\+Funds\\s\*\[/);
  });
});
