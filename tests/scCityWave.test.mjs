import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

import {
  SC_CITY_ENTITIES, SC_CITY_DEFERRED, SC_CITY_COVERAGE_GAPS, SC_CITY_STATE,
  SC_CITY_LIBRARY_FIXES, SC_CITY_READER_HISTORY, SC_CITY_NO_FEDERAL_FILING,
  SC_CITY_NO_TABLE_CORROBORATOR, SC_CITY_SUPERSEDED_REPORTS,
  scCityLoadableEntities, scCityFilings, scCityByKey, fiscalMonthFor,
} from '../scripts/data/scCityAcfrEntities.mjs';
import { KNOWN_DOCUMENT_GAPS } from '../scripts/extractScCitiesAll.mjs';
import { sourceNameFor, sourcePrefixFor, FUND_SCOPE, BASIS_VALUE, DERIVATION } from '../scripts/loadScCityAcfrs.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE, BASIS, BASIS_VALUES, classifyAxis } from '../scripts/lib/budgetAxes.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { classify } from '../scripts/lib/fundScope.mjs';
import { censusGuard, censusMonthFor } from '../scripts/lib/facFiscalYearCensus.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';
import { READER_DISAGREEMENTS, disagreementFor } from '../scripts/verifyScCityReaders.mjs';

describe('the South Carolina city wave-1 roster', () => {
  it('holds eleven governments and loads all eleven', () => {
    expect(SC_CITY_ENTITIES.map((e) => e.key).sort()).toEqual([
      'charleston', 'florence', 'goose-creek', 'greenville', 'hilton-head',
      'mount-pleasant', 'north-charleston', 'rock-hill', 'spartanburg',
      'summerville', 'sumter',
    ]);
    // ⚠⚠ GREER IS DELIBERATELY ABSENT and is SC's ninth-largest place. It has NO
    // federal Single Audit filing in the window — the FAC census records it once,
    // in 2002 — so the route every other entity here uses does not exist for it.
    // Recorded with its evidence rather than silently skipped, and it falsifies
    // the campaign's earlier "top-30 all have FAC coverage" claim.
    expect(SC_CITY_NO_FEDERAL_FILING.greer.lastFacAuditYear).toBe(2002);
    expect(Object.keys(SC_CITY_NO_FEDERAL_FILING.greer.notThisGovernment))
      .toContain('576001040');   // Greer CPW — a separate government
    expect(SC_CITY_ENTITIES.some((e) => e.key === 'greer')).toBe(false);
    // ⚠⚠ NONE is deferred any more — but that does NOT mean every year loads.
    // North Charleston contributes four years of ten; its other six documents
    // cannot be read at EITHER publisher and are declared, with their causes, in
    // KNOWN_DOCUMENT_GAPS. Entity-level deferral and year-level document gaps
    // are different things, and conflating them is how a gap becomes a $0.
    expect(scCityLoadableEntities().map((e) => e.key))
      .toEqual(['charleston', 'north-charleston', 'mount-pleasant', 'rock-hill',
        'greenville', 'summerville', 'goose-creek', 'spartanburg', 'sumter',
        'florence', 'hilton-head']);
    expect(Object.keys(SC_CITY_DEFERRED)).toEqual([]);
  });

  it('loads 99 entity-years, and Mount Pleasant is short by exactly its two gaps', () => {
    const filings = scCityFilings();
    expect(filings).toHaveLength(99);
    const byKey = {};
    for (const f of filings) byKey[f.entity.key] = (byKey[f.entity.key] || 0) + 1;
    // ⚠ Mount Pleasant's 8 is the point: FAC serves no filing under its EIN
    // before FY2018, and those two years are declared gaps rather than invented.
    // ⚠ And wave 3's two are SHORT for a DIFFERENT reason: a Single Audit is
    // filed only when federal awards reach $750k, so FAC coverage is genuinely
    // intermittent. Absence of a FEDERAL filing is not absence of an ACFR, and
    // neither is written as $0.
    expect(byKey).toEqual({
      charleston: 10, 'mount-pleasant': 8, 'rock-hill': 10, greenville: 10,
      summerville: 6, 'goose-creek': 6, 'north-charleston': 10, spartanburg: 10,
      // ⚠ Wave 4. Both are FULL decades at FAC — coverage MEASURED in the bulk
      // table, not inherited from the "top-30 all have FAC coverage" claim that
      // Greer falsified.
      sumter: 10, florence: 10,
      // ⚠⚠ Wave 5, and the FIRST entity whose years come from TWO PUBLISHERS.
      // EIGHT are FAC filings; the NINTH (FY2020) is the town's own copy, which
      // is why this is 9 and not the "8 of 10" the campaign had recorded. FY2016
      // is absent at both publishers and is the only declared gap.
      'hilton-head': 9,
    });
    // ⚠⚠ AND THE SELF-PUBLISHED YEAR MUST ACTUALLY BE ENUMERATED HERE. Wave 5
    // wired `selfPublishedReports` into the FETCHER first and left this function
    // reading `facReports` alone — the document would have been fetched, quality
    // -checked, and then silently never loaded. Nothing would have failed.
    const hh = filings.filter((f) => f.entity.key === 'hilton-head');
    expect(hh.map((f) => f.fiscalYear))
      .toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(hh.filter((f) => f.publisher === 'self').map((f) => f.fiscalYear)).toEqual([2020]);
    expect(hh.find((f) => f.fiscalYear === 2020).reportId).toBeNull();
    // ⚠ Every OTHER year of every OTHER entity is a federal filing with an id.
    for (const f of filings) {
      if (f.publisher === 'fac') expect(f.reportId).toMatch(/^\d{4}-\d{2}-(CENSUS|GSAFAC)-\d{10}$/);
    }
    // ⚠⚠ North Charleston's TEN are roster years, not loaded years: six of its
    // documents are unreadable at both publishers and only four produce rows.
    const loadable = filings.filter((f) => !KNOWN_DOCUMENT_GAPS[`${f.entity.key}-${f.fiscalYear}`]);
    expect(loadable.filter((f) => f.entity.key === 'north-charleston').map((f) => f.fiscalYear))
      .toEqual([2021, 2022, 2024, 2025]);
    // ⚠ 99 filings less North Charleston's six unreadable documents = 93.
    // Wave 4 adds twenty and subtracts nothing: neither Sumter nor Florence
    // has a document gap, and both are full decades at FAC. Wave 5 adds NINE
    // and subtracts nothing either — all nine Hilton Head documents pass all
    // four checks in scripts/tools/acfrDocQuality.py, the self-published FY2020
    // included (1,922 ch/pg, 56.0% vocab, 0.0 welds, 73 numeric statement pages).
    expect(loadable).toHaveLength(93);
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

  /**
   * ⚠⚠ THE MONTH IS RESOLVED PER ENTITY-YEAR, NOT PER ENTITY. Summerville moved
   * from a December to a June fiscal year inside the loaded window, so its own
   * `fiscalYearStartMonth` is wrong for FY2018 and FY2020 — and this guard is
   * what said so, with `month 7 contradicts the federal audit record`. The
   * loader was passing the per-entity constant until this test failed on it.
   */
  it('agrees with the federal audit record for every loaded entity-year', () => {
    for (const f of scCityFilings()) {
      const g = censusGuard(f.entity.censusName, SC_CITY_STATE,
        fiscalMonthFor(f.entity, f.fiscalYear), f.fiscalYear);
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
  /**
   * ⚠⚠ NORTH CHARLESTON IS NO LONGER DEFERRED, AND THE REASON MATTERS. It was
   * held back as "OCR-damaged statement tables in every readable year"; the
   * glyphs are clean on the years that matter and two of the three defects were
   * MECHANICAL properties of the shared reader (single-linkage row chaining and
   * left-margin page furniture poisoning the indent baseline). ⭐ "The document
   * is damaged" is a CONCLUSION and needs the same evidence as any other.
   *
   * What remains genuinely unreadable is declared PER YEAR, with its cause and
   * with the SECOND publisher that was checked before it was called lost.
   */
  it('declares six unreadable North Charleston years, each checked at two publishers', () => {
    const years = [2016, 2017, 2018, 2019, 2020, 2023];
    for (const fy of years) {
      const why = KNOWN_DOCUMENT_GAPS[`north-charleston-${fy}`];
      expect(why, `FY${fy} must be declared`).toBeTruthy();
      // Both publishers named in every entry — quality is a property of the COPY.
      expect(why).toMatch(/FAC|city/i);
      expect(why.length).toBeGreaterThan(40);
    }
    expect(Object.keys(KNOWN_DOCUMENT_GAPS).sort())
      .toEqual(years.map((fy) => `north-charleston-${fy}`).sort());
  });

  it('keeps the corrected diagnosis on the record', () => {
    const h = SC_CITY_READER_HISTORY['north-charleston'];
    expect(h.actualCause).toMatch(/chaining/i);
    expect(h.loadedYears).toEqual([2021, 2022, 2024, 2025]);
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
  /**
   * ⚠⚠ ALL THREE REGISTRIES, FOR EVERY ENTITY — and it must stay all three.
   *
   * This loop checked audit-grade and basis and NOT fund-scope, which is the
   * exact pair wave 3 widened while forgetting the third. Fund-scope was instead
   * verified by HARD-CODED PER-WAVE LISTS added retroactively each time it broke
   * (see the wave-3 and wave-4 tests below, both kept as historical pins). So the
   * guard reproduced the defect's own shape: every wave had to remember to add
   * itself, which is precisely what a wave forgets.
   *
   * ⭐⭐ THE GENERAL LESSON, and the reason this is now driven from
   * `scCityFilings()` instead of a list: A GUARD THAT REQUIRES EACH NEW MEMBER TO
   * REGISTER ITSELF CANNOT CATCH THE MEMBER THAT FORGETS. Enumerate the
   * population and require every member to pass — the same rule
   * `verifyScCityReaders.mjs` learned when a gate derived its subject list from
   * the thing it was checking. Wave 6 is covered by this without doing anything.
   */
  it('is claimed by ALL THREE axis registries, for every entity and every loaded year', () => {
    const checked = [];
    for (const f of scCityFilings()) {
      for (const ds of ['revenue', 'operating']) {
        const label = sourceNameFor(f.entity, ds, f.fiscalYear);
        expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
        expect(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
          .toBe('sc-local-acfr-gf');
        // ⚠⚠ THE ONE WAVE 3 OMITTED. 52 of 166 rows sat unclaimed by it.
        expect(classify(label, FUND_SCOPE_REGISTRY))
          .toEqual({ scope: FUND_SCOPE, entryId: 'sc-local-acfr-gf' });
        checked.push(label);
      }
    }
    // ⚠⚠ A GATE THAT CAN MEASURE NOTHING MUST FAIL, NOT PASS. If the roster ever
    // returns empty this loop passes vacuously and reports full coverage.
    expect(checked.length).toBeGreaterThan(0);
    expect(new Set(checked).size).toBe(checked.length);
  });

  it('still claims the two entities that were already in the family', () => {
    for (const name of ['City of Columbia', 'City of Myrtle Beach']) {
      const label = `${name} ACFR — General Fund Revenue by Source (FY2020 actual, GAAP basis)`;
      expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
    }
  });

  it('does not claim a neighbouring South Carolina source', () => {
    // ⚠⚠ `City of North Charleston` USED to belong in this list, because it is a
    // DIFFERENT GOVERNMENT from `City of Charleston` and must never be swept up
    // by its pattern. It is now a loaded entity with its own alternative in the
    // regex, so the check that matters moved to the test below: it must be
    // claimed AS ITSELF, and Charleston's own rows must be unaffected.
    for (const s of [
      'City of Charleston ACFR',
      'South Carolina RFA Local Government Finance Report — Revenue by Source (FY2024 actual, county only, excl. bond and lease proceeds)',
    ]) {
      expect(classifyAxis(s, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
        .not.toBe('sc-local-acfr-gf');
    }
  });

  it('claims North Charleston as ITSELF, not as a Charleston variant', () => {
    // ⚠ Two governments, one substring. The alternation is of whole prefixes, so
    // `City of North Charleston` matches its own branch — and Charleston's
    // ten-year series is untouched by its arrival.
    const nc = 'City of North Charleston ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)';
    const chas = 'City of Charleston ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)';
    for (const label of [nc, chas]) {
      expect(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
        .toBe('sc-local-acfr-gf');
      expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
    }
    expect(sourcePrefixFor(scCityByKey('north-charleston'))).toBe('City of North Charleston');
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
    for (const k of ['rock-hill', 'greenville']) {
      expect(scCityLoadableEntities().some((e) => e.key === k)).toBe(true);
      expect(Object.keys(scCityByKey(k).facReports).map(Number).sort())
        .toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
      expect(scCityFilings().filter((f) => f.entity.key === k)).toHaveLength(10);
    }
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
    // ⚠ A corroborator on a `-table` entity would be a check that never runs, so
    // only coordinate entities carry one.
    const coords = scCityLoadableEntities().filter((e) => e.extractor.endsWith('Coords.py'));
    expect(coords.map((e) => e.key))
      .toEqual(['north-charleston', 'rock-hill', 'summerville', 'spartanburg', 'sumter']);
    for (const e of scCityLoadableEntities()) {
      if (!e.extractor.endsWith('Coords.py')) {
        expect(e.corroboratingExtractor).toBeUndefined();
      }
    }
  });

  /**
   * ⚠⚠ A COORDINATE ENTITY WITHOUT A CORROBORATOR WOULD BE UNFALSIFIABLE, so it
   * must be accounted for one way or the other. This test used to read
   * `Boolean(e.corroboratingExtractor) === e.extractor.endsWith('Coords.py')`,
   * which Sumter breaks DELIBERATELY: `pdftotext -table` cannot read that issuer
   * in any of its ten years, so there is no second reading to be had.
   *
   * The invariant is therefore EITHER/OR, never neither and never both — and it
   * is asserted here rather than left to `verifyScCityReaders.mjs`, which used
   * to select entities with `.filter(e => e.corroboratingExtractor)` and so
   * skipped exactly this case in silence.
   */
  it('accounts for every coordinate entity — a corroborator or a declared exemption', () => {
    const coords = scCityLoadableEntities().filter((e) => e.extractor.endsWith('Coords.py'));
    expect(coords.length).toBeGreaterThan(0);
    for (const e of coords) {
      const hasReader = Boolean(e.corroboratingExtractor);
      const exempt = e.key in SC_CITY_NO_TABLE_CORROBORATOR;
      expect(hasReader || exempt).toBe(true);
      expect(hasReader && exempt).toBe(false);
    }
    // ⚠ And no exemption may name an entity that is not a coordinate entity, or
    // one that does have a corroborator — dead permission is how a later entity
    // inherits an excuse it never earned.
    for (const key of Object.keys(SC_CITY_NO_TABLE_CORROBORATOR)) {
      const e = scCityByKey(key);
      expect(e).not.toBeNull();
      expect(e.extractor.endsWith('Coords.py')).toBe(true);
      expect(e.corroboratingExtractor).toBeUndefined();
    }
    expect(Object.keys(SC_CITY_NO_TABLE_CORROBORATOR)).toEqual(['sumter']);
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
  it('declares exactly eight disagreements, each with its cause', () => {
    expect(READER_DISAGREEMENTS.map((d) => d.id).sort()).toEqual([
      'north-charleston-fy2021-operating-grid',
      'north-charleston-fy2022-operating-grid',
      'north-charleston-fy2024-operating-grid',
      'north-charleston-fy2024-revenue-grid',
      'rock-hill-fy2024-revenue-two-offset',
      'rock-hill-fy2025-operating-readable',
      'spartanburg-fy2018-revenue-grid',
      'spartanburg-fy2018-operating-grid',
    ].sort());
    for (const d of READER_DISAGREEMENTS) {
      expect(['rock-hill', 'north-charleston', 'spartanburg']).toContain(d.entityKey);
      expect(d.why.length).toBeGreaterThan(40);
    }
  });

  /**
   * ⚠⚠ SPARTANBURG'S TWO ARE THE SAME DOCUMENT, and they are the diagnosed
   * reason the entity is on the coordinate reader at all. Nine of its ten years
   * read fine through `-table`; using it for those and coordinates for FY2018
   * would be picking whichever reader tied — the curve-fitting error the LA-01
   * scope verdict was retracted for. The ENTITY moves, once, for a stated reason.
   */
  it('names Spartanburg FY2018 as one document failing in both modes', () => {
    const both = READER_DISAGREEMENTS.filter((d) => d.entityKey === 'spartanburg');
    expect(both.map((d) => d.mode).sort()).toEqual(['operating', 'revenue']);
    expect(both.every((d) => d.fiscalYear === 2018)).toBe(true);
    // ⚠ The revenue delta IS an expenditure line: the grid mixed the sections.
    expect(both.find((d) => d.mode === 'revenue').why).toMatch(/EXPENDITURE line/);
  });

  /**
   * ⚠ North Charleston's four are declared because the corroborating reader
   * FAILS on them, not because it disagrees by a known amount — so `delta` is
   * null on purpose. A future run in which that reader DID return a total would
   * not match, and the verifier would report it. That is the intent: a
   * declaration must not quietly widen into permission.
   */
  it('records a null delta where the corroborating reader returns nothing', () => {
    for (const d of READER_DISAGREEMENTS.filter(
      (x) => x.entityKey === 'north-charleston' || x.entityKey === 'spartanburg')) {
      expect(d.delta).toBeNull();
      expect(d.recordTotal).toBeGreaterThan(0);
    }
    // ⭐ And the four it CAN read are not declared at all — they are checks.
    expect(disagreementFor({ entityKey: 'north-charleston', fiscalYear: 2021, mode: 'revenue' })).toBeNull();
    expect(disagreementFor({ entityKey: 'north-charleston', fiscalYear: 2025, mode: 'operating' })).toBeNull();
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

/**
 * ⚠⚠ SUMMERVILLE AND GOOSE CREEK WERE HELD BACK ON A **LIBRARY** GAP, NOT A
 * CONFIG GAP, AND IT IS NOW FIXED. Waves 1 and 2 were per-entity configuration;
 * these two were the first SC cities whose statements needed a change to the
 * SHARED extractors, which ~40 entities depend on — so the fix got its own
 * scoped change with every existing entity re-extracted and proved
 * byte-identical before either was loaded.
 */
describe('the wave-3 entities', () => {
  it('records what blocked each of them, and the fix that cleared it', () => {
    for (const k of ['summerville', 'goose-creek']) {
      const f = SC_CITY_LIBRARY_FIXES[k];
      expect(f.wasBlockedBy.length).toBeGreaterThan(20);
      expect(f.fix.length).toBeGreaterThan(20);
      // Both are now loadable and both declare a real extractor.
      expect(scCityByKey(k).extractor).toMatch(/^scripts\/extract.*\.py$/);
      expect(scCityFilings().some((x) => x.entity.key === k)).toBe(true);
      expect(SC_CITY_DEFERRED[k]).toBeUndefined();
    }
  });

  /**
   * ⚠⚠ THE COORDINATE READER IS THE RECORD READER FOR **SHAPE**, NOT FOR
   * ARITHMETIC. The `-table` reader agrees on all twelve Summerville totals once
   * `column_strategy='ordinal'` is set, so the tie could never have chosen
   * between them — the town prints THREE levels and no CityConfig holds three.
   */
  it('routes Summerville through the coordinate reader and keeps a corroborator', () => {
    const s = scCityByKey('summerville');
    expect(s.extractor).toBe('scripts/extractSummervilleCoords.py');
    expect(s.corroboratingExtractor).toBe('scripts/extractSummervilleSC.py');
    // ⚠ Goose Creek is an ordinary `-table` entity, like Charleston and
    // Greenville: no corroborator is required, and claiming one would be a
    // check that never runs.
    expect(scCityByKey('goose-creek').extractor).toBe('scripts/extractGooseCreekSC.py');
    expect(scCityByKey('goose-creek').corroboratingExtractor).toBeUndefined();
  });

  it('keeps their discovery work — EINs, report ids, months, gaps', () => {
    expect(scCityByKey('summerville').facEin).toBe('576001110');
    expect(scCityByKey('goose-creek').facEin).toBe('576008064');
    expect(Object.keys(scCityByKey('summerville').facReports).map(Number).sort())
      .toEqual([2018, 2020, 2022, 2023, 2024, 2025]);
    expect(Object.keys(scCityByKey('goose-creek').facReports).map(Number).sort())
      .toEqual([2016, 2021, 2022, 2023, 2024, 2025]);
    expect(Object.keys(SC_CITY_COVERAGE_GAPS.summerville).sort())
      .toEqual(['2016', '2017', '2019', '2021']);
    expect(Object.keys(SC_CITY_COVERAGE_GAPS['goose-creek']).sort())
      .toEqual(['2017', '2018', '2019', '2020']);
  });

  /**
   * ⚠⚠ SUMMERVILLE CHANGED ITS FISCAL YEAR INSIDE THE WINDOW — the first entity
   * in this campaign to do so. A single per-entity month would put a
   * January-starting year under a July label: a wrong value that moves no dollar
   * and fails no tie gate. It is in the DATABASE as two months for one entity.
   */
  it('carries a PER-YEAR fiscal month for Summerville', () => {
    const s = scCityByKey('summerville');
    expect(fiscalMonthFor(s, 2018)).toBe(1);
    expect(fiscalMonthFor(s, 2020)).toBe(1);
    expect(fiscalMonthFor(s, 2022)).toBe(7);
    expect(fiscalMonthFor(s, 2025)).toBe(7);
    // ⭐ Settled empirically: FY2022 is a FULL year, not a six-month stub.
    expect(SC_CITY_LIBRARY_FIXES.summerville.fiscalYearChangeover).toMatch(/NOT a short stub/);
  });

  it('still resolves a plain per-entity month for everyone else', () => {
    for (const e of scCityLoadableEntities().filter((x) => x.key !== 'summerville')) {
      expect(fiscalMonthFor(e, 2024)).toBe(e.fiscalYearStartMonth);
      expect(e.fiscalMonthOverrides).toBeUndefined();
    }
    expect(fiscalMonthFor(scCityByKey('goose-creek'), 2024)).toBe(1);
  });
});

describe('the wave-4 entities — Sumter and Florence', () => {
  it('measures coverage per entity rather than inheriting a claim', () => {
    // ⚠⚠ Greer falsified "top-30 by population all have FAC coverage", so
    // coverage is read per entity out of the bulk table. Both of these are full
    // decades, and BOTH ARE LARGER THAN SPARTANBURG, which wave 3 loaded.
    expect(scCityByKey('sumter').population).toBe(42958);
    expect(scCityByKey('florence').population).toBe(40923);
    expect(scCityByKey('sumter').population)
      .toBeGreaterThan(scCityByKey('spartanburg').population);
    expect(scCityByKey('florence').population)
      .toBeGreaterThan(scCityByKey('spartanburg').population);
    for (const key of ['sumter', 'florence']) {
      expect(Object.keys(scCityByKey(key).facReports).map(Number).sort())
        .toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
      // ⚠ No coverage gap and no document gap — asserted, not assumed.
      expect(SC_CITY_COVERAGE_GAPS[key]).toBeUndefined();
      expect(KNOWN_DOCUMENT_GAPS[key]).toBeUndefined();
    }
  });

  it('joins on an EIN whose one-digit neighbours are real, wrong governments', () => {
    expect(scCityByKey('sumter').facEin).toBe('576000246');
    expect(scCityByKey('florence').facEin).toBe('576000232');
    // ⚠⚠ Sumter's neighbours are two cities TT ALREADY HOLDS, so a typo loads a
    // loaded city's money under another city's name and every tie gate passes.
    expect(scCityByKey('rock-hill').facEin).toBe('576000244');
    expect(scCityByKey('spartanburg').facEin).toBe('576000245');
    // ⚠ Every EIN in the family is distinct — the cheap check that catches a
    // transposed digit landing on a sibling.
    const eins = scCityLoadableEntities().map((e) => e.facEin);
    expect(new Set(eins).size).toBe(eins.length);
  });

  it('evidences July three ways for both, and agrees with the federal record', () => {
    for (const key of ['sumter', 'florence']) {
      const e = scCityByKey(key);
      expect(e.fiscalYearStartMonth).toBe(7);
      expect(e.monthStatus).toBe('confirmed');
      expect(e.fiscalMonthOverrides).toBeUndefined();
      // ⚠ The census is an INDEPENDENT record, so it is asked rather than told.
      expect(censusMonthFor(SC_CITY_STATE, e.censusName).month).toBe(7);
      for (const fy of Object.keys(e.facReports).map(Number)) {
        expect(censusGuard(e.censusName, SC_CITY_STATE, fiscalMonthFor(e, fy), fy).error)
          .toBeUndefined();
      }
    }
  });

  /**
   * ⚠⚠ ONE GOVERNMENT-YEAR, TWO ACCEPTED FILINGS, AND EVERY TIE GATE PASSES BOTH.
   *
   * FAC serves eleven filings for Sumter's ten years. The extra is the same city,
   * same UEI, same 06-30 year end, filed twice — and the two documents differ by
   * a General Fund RECLASSIFICATION that offsets to the dollar, so the totals,
   * the tie, the row count and a leaf-sum check are all identical. Only the
   * record can decide, and it does: the PDF title says `- Reissued`, FAC accepted
   * it a year later, and the city's own site publishes only that one.
   */
  it('loads the REISSUED Sumter FY2024 and records what the superseded one said', () => {
    const sup = SC_CITY_SUPERSEDED_REPORTS.sumter[2024];
    expect(scCityByKey('sumter').facReports[2024]).toBe('2024-06-GSAFAC-0000392867');
    expect(sup.loadedReportId).toBe('2024-06-GSAFAC-0000392867');
    expect(sup.supersededReportId).toBe('2024-06-GSAFAC-0000344027');
    expect(sup.pdfTitles[sup.loadedReportId]).toMatch(/Reissued/);
    expect(sup.pdfTitles[sup.supersededReportId]).toMatch(/Final/);
    // ⚠⚠ THE RECLASSIFICATION SUMS TO ZERO — which is exactly why no arithmetic
    // gate can tell the two documents apart.
    const moves = Object.values(sup.generalFundReclassification);
    expect(moves).toHaveLength(4);
    expect(moves.reduce((a, b) => a + b, 0)).toBe(0);
    expect(sup.generalFundReclassification['Capital Outlay > Public safety']).toBe(-227950);
    expect(sup.generalFundReclassification['Current > Public safety and law enforcement'])
      .toBe(227950);
    // ⚠ And the figures that do NOT move are the ones every gate looks at.
    expect(sup.unchanged.totalRevenues).toBe(85437318);
    expect(sup.unchanged.totalExpenditures).toBe(64284680);
    // ⚠ A superseded id must never be the one recorded for loading.
    for (const e of scCityLoadableEntities()) {
      expect(Object.values(e.facReports)).not.toContain(sup.supersededReportId);
    }
  });

  it('claims both new entities on all THREE axis registries', () => {
    // ⚠⚠ All three anchor on the ENTITY NAME, so a load that widens two of them
    // leaves rows unclaimed while looking fine. Wave 3 widened basis and
    // audit-grade and NOT fund-scope, which the next test pins.
    for (const f of scCityFilings().filter((x) => ['sumter', 'florence'].includes(x.entity.key))) {
      for (const ds of ['revenue', 'operating']) {
        const label = sourceNameFor(f.entity, ds, f.fiscalYear);
        expect(gradeFor(label).value).toBe(AUDIT_GRADE.AUDITED_GAAP);
        expect(classifyAxis(label, BASIS_REGISTRY, BASIS_VALUES, BASIS.UNKNOWN).entryId)
          .toBe('sc-local-acfr-gf');
        expect(classify(label, FUND_SCOPE_REGISTRY))
          .toEqual({ scope: FUND_SCOPE, entryId: 'sc-local-acfr-gf' });
      }
    }
  });

  it('claims the WAVE-3 entities on fund-scope too, which wave 3 omitted', () => {
    // ⚠⚠ Found while adding wave 4: Summerville, Goose Creek, North Charleston
    // and Spartanburg were never added to fundScopeRegistry, so 52 of the
    // family's 166 rows sat unclaimed by it while looking perfectly fine.
    // Pinned here so it cannot regress.
    for (const key of ['summerville', 'goose-creek', 'north-charleston', 'spartanburg']) {
      const label = sourceNameFor(scCityByKey(key), 'revenue', 2024);
      expect(classify(label, FUND_SCOPE_REGISTRY))
        .toEqual({ scope: FUND_SCOPE, entryId: 'sc-local-acfr-gf' });
    }
  });

  it('keeps both as CITIES, and reads Capital Outlay per entity', () => {
    expect(scCityByKey('sumter').entityType).toBe('city');
    expect(scCityByKey('florence').entityType).toBe('city');
    expect(sourcePrefixFor(scCityByKey('sumter'))).toBe('City of Sumter');
    expect(sourcePrefixFor(scCityByKey('florence'))).toBe('City of Florence');
    // ⚠⚠ The two disagree on `Capital Outlay` — a PARENT over five children in
    // Sumter, a valued ROOT LEAF in Florence — in the same wave and the same
    // pull request. The Hillsboro inversion between two cities shipped on the
    // same day, which is why the fact lives per entity in each reader.
    expect(scCityByKey('sumter').extractor).toBe('scripts/extractSumterCoords.py');
    expect(scCityByKey('florence').extractor).toBe('scripts/extractFlorenceSC.py');
  });

  /**
   * ⚠⚠ SUMTER IS THE FIRST COORDINATE ENTITY WITH NO SECOND READER, and the
   * reason is a property of the DOCUMENTS: `pdftotext -table` renders its
   * statement page letter-spaced in every one of the ten years, so the shared
   * reader's banner and total-anchor patterns match nothing and `classify`
   * refuses the page outright. De-letter-spacing is the workaround the library
   * already declines. What checks it instead is the line the city derived itself.
   */
  it('substitutes the printed excess for the missing second reader', () => {
    const ex = SC_CITY_NO_TABLE_CORROBORATOR.sumter;
    expect(ex.why).toMatch(/letter-spaced/);
    expect(ex.refusedWorkaround).toMatch(/fuzzy label repair/);
    expect(ex.substitute).toMatch(/verifyScCityExcess\.py/);
    expect(ex.substituteResult).toMatch(/10 of 10/);
  });
});

/**
 * Invariants that hold for EVERY entity in the roster, present and future.
 *
 * ⭐ Written after wave 5, where three separate defects were each caught only by
 * a hard-coded per-entity assertion or by a row COUNT that happened not to
 * match. Each one below is the general form of a specific thing that went
 * wrong, so the next wave inherits the guard instead of re-learning the defect.
 */
describe('South Carolina city roster — universal invariants', () => {
  /**
   * ⚠⚠ EVERY DECLARED YEAR MUST BE ENUMERATED, FROM EVERY PUBLISHER.
   *
   * Wave 5 added `selfPublishedReports` (a year FAC does not serve, fetched from
   * the town itself) and wired it into the FETCHER only. Four places iterated
   * `entity.facReports` directly, so the document was fetched, quality-checked
   * and then silently skipped by three of them: 184 extractions where 186 were
   * expected, no error, no failing tie, the year simply absent.
   *
   * ⭐ The count was the ONLY signal. This asserts the relationship instead, so a
   * SIXTH publisher — or a new entity using an existing one — cannot lose a year
   * quietly. It is `fiscalMonthFor`'s "grep for the call site" lesson as a test.
   */
  it('enumerates every year declared by every publisher, for every entity', () => {
    for (const e of scCityLoadableEntities()) {
      const declared = [...new Set([
        ...Object.keys(e.facReports || {}).map(Number),
        ...Object.keys(e.selfPublishedReports || {}).map(Number),
      ])].sort((a, b) => a - b);
      const enumerated = scCityFilings()
        .filter((f) => f.entity.key === e.key)
        .map((f) => f.fiscalYear)
        .sort((a, b) => a - b);
      expect(enumerated, `${e.key}: declared years must all be enumerated`)
        .toEqual(declared);
      expect(declared.length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠⚠ A YEAR IS A FILING OR A DECLARED GAP — NEVER BOTH, AND NEVER NEITHER.
   *
   * A declared gap that quietly became a row, or a year that is neither loaded
   * nor declared, are the two shapes this whole campaign is organised against.
   * Both are silent: no dollar moves and no tie fails either way.
   */
  it('never declares a coverage gap for a year it also loads', () => {
    for (const e of scCityLoadableEntities()) {
      const gaps = Object.keys(SC_CITY_COVERAGE_GAPS[e.key] || {}).map(Number);
      const years = new Set(scCityFilings()
        .filter((f) => f.entity.key === e.key).map((f) => f.fiscalYear));
      for (const g of gaps) {
        expect(years.has(g), `${e.key} FY${g} is declared a gap AND enumerated`).toBe(false);
      }
      // ⚠ And a declared gap must state a REASON — an empty string excludes
      // nothing while looking like a declaration (the "declared exception that
      // names nothing" family, which has bitten in MI, PA and SC).
      for (const [fy, why] of Object.entries(SC_CITY_COVERAGE_GAPS[e.key] || {})) {
        expect(String(why).trim().length, `${e.key} FY${fy} gap has no reason`)
          .toBeGreaterThan(20);
      }
    }
  });

  /**
   * ⚠ EVERY DECLARED EXTRACTOR MUST EXIST ON DISK.
   *
   * A roster entry naming a renamed or not-yet-written extractor is well-formed
   * and inert until something tries to run it, at which point the failure is a
   * missing-file error far from the roster that caused it.
   */
  it('names an extractor that exists for every loadable entity', () => {
    for (const e of scCityLoadableEntities()) {
      expect(e.extractor, `${e.key} declares no extractor`).toMatch(/^scripts\/extract.*\.py$/);
      expect(existsSync(e.extractor), `${e.key}: ${e.extractor} does not exist`).toBe(true);
    }
  });

  /**
   * ⚠ A self-published year must carry a REAL URL and no FAC id, and the two
   * maps must never claim the same year — ambiguous provenance is refused at
   * fetch time and should be unrepresentable here too.
   */
  it('keeps the two publishers disjoint and evidenced', () => {
    let selfPublished = 0;
    for (const e of SC_CITY_ENTITIES) {
      const self = e.selfPublishedReports || {};
      for (const [fy, spec] of Object.entries(self)) {
        selfPublished += 1;
        expect(e.facReports?.[fy], `${e.key} FY${fy} declares BOTH publishers`).toBeUndefined();
        expect(spec.url).toMatch(/^https:\/\//);
        // ⚠ Spaces MUST be percent-encoded — unencoded, curl returns 000.
        expect(spec.url).not.toMatch(/ /);
        expect(String(spec.why || '').trim().length).toBeGreaterThan(20);
      }
    }
    // ⚠⚠ Wave 5 introduced exactly one. If this ever reads 0 the feature has
    // been removed and the tests above are passing vacuously.
    expect(selfPublished).toBeGreaterThan(0);
  });
});
