import { describe, it, expect } from 'vitest';

import {
  CO_KS_ENTITIES, entityByKey,
} from '../scripts/data/coKsKnightEntities.mjs';
import {
  WICHITA_ADID, SEDGWICK_MEDIA, BOULDER_COUNTY_URL, BOULDER_CITY_FAC,
  CO_KS_WINDOWS, SOURCE_PAGE, documentUrlFor,
} from '../scripts/data/coKsAcfrSources.mjs';
import { EXTRACTORS, KNOWN_DOCUMENT_GAPS } from '../scripts/extractCoKsAll.mjs';
import {
  sourceNameFor, BASIS_VALUE, DERIVATION, FUND_SCOPE,
} from '../scripts/loadCoKsAcfrs.mjs';
// ⚠ Only fundScopeRegistry has a default export; the other two are named only.
import { FUND_SCOPE_REGISTRY } from '../scripts/data/fundScopeRegistry.mjs';
import { BASIS_REGISTRY } from '../scripts/data/basisRegistry.mjs';
import { REPORTING_ENTITY_REGISTRY } from '../scripts/data/reportingEntityRegistry.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';

const entryById = (reg, id) => reg.find((e) => e.id === id);

describe('CO/KS entity roster', () => {
  it('has exactly the four session-7b entities', () => {
    expect(CO_KS_ENTITIES).toHaveLength(4);
    expect(CO_KS_ENTITIES.map((e) => e.key).sort())
      .toEqual(['boulder', 'boulder-county', 'sedgwick-county', 'wichita']);
  });

  // ⚠⚠ SIXTH SAINT-LOUIS-COUNTY NEAR-MISS. The FAC census carries
  // `KS,Sedgwick,municipality` — the CITY of Sedgwick, a town of ~1,600 in
  // HARVEY County, not even inside Sedgwick County.
  it('never uses a bare "Sedgwick" as a census name', () => {
    const c = entityByKey('sedgwick-county');
    expect(c.censusName).toBe('Sedgwick County');
    expect(c.censusName).not.toBe('Sedgwick');
  });

  it('carries a census name and a population for every entity', () => {
    for (const e of CO_KS_ENTITIES) {
      expect(e.censusName.trim(), e.key).toBe(e.censusName);
      expect(e.population, e.key).toBeGreaterThan(1000);
      expect(SOURCE_CHIP_ENTITY_TYPES, e.key).toContain(e.entityType);
      expect(SOURCE_PAGE[e.key], e.key).toMatch(/^https:\/\//);
    }
  });

  // All four are calendar-year and all four are FAC-confirmed — but that is
  // READ per entity, not assumed. Michigan, one session earlier, put a city at
  // month 7 and its own parent county at month 10.
  it('puts every entity on a calendar fiscal year', () => {
    for (const e of CO_KS_ENTITIES) expect(e.fiscalYearStartMonth, e.key).toBe(1);
  });

  // ⚠⚠ TWO ENTITIES IN ONE STATE, OPPOSITE DENOMINATIONS. A units error is
  // INVISIBLE to the tie — every figure on a statement scales together.
  it('records units per entity: Boulder in thousands, everything else whole dollars', () => {
    expect(entityByKey('boulder').units).toBe(1000);
    expect(entityByKey('boulder-county').units).toBe(1);
    expect(entityByKey('wichita').units).toBe(1);
    expect(entityByKey('sedgwick-county').units).toBe(1);
  });

  it('assigns Colorado to the existing family and Kansas to a new one', () => {
    expect(entityByKey('boulder').family).toBe('co-local-acfr-gf');
    expect(entityByKey('boulder-county').family).toBe('co-local-acfr-gf');
    expect(entityByKey('wichita').family).toBe('ks-local-acfr-gf');
    expect(entityByKey('sedgwick-county').family).toBe('ks-local-acfr-gf');
  });

  it('gives each entity its own extractor', () => {
    for (const e of CO_KS_ENTITIES) expect(EXTRACTORS[e.key], e.key).toMatch(/^scripts\/extract.*\.py$/);
    expect(new Set(Object.values(EXTRACTORS)).size).toBe(4);
  });
});

describe('document manifests', () => {
  // ⚠⚠ Wichita's archive ids are NOT ordered by year: FY2018 is 56 while FY2017
  // is 57, and FY2016 is 54 while FY2015 is 55. Deriving an id from a year
  // would swap two fiscal years and every tie would still pass.
  it('keeps Wichita ADIDs unique and records the two known inversions', () => {
    const ids = Object.values(WICHITA_ADID);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WICHITA_ADID[2018]).toBeLessThan(WICHITA_ADID[2017]);
    expect(WICHITA_ADID[2016]).toBeLessThan(WICHITA_ADID[2015]);
  });

  it('covers FY2000-FY2025 for Wichita and FY2005-FY2024 for Sedgwick County', () => {
    for (let fy = 2000; fy <= 2025; fy += 1) expect(WICHITA_ADID[fy], `wichita ${fy}`).toBeDefined();
    for (let fy = 2005; fy <= 2024; fy += 1) expect(SEDGWICK_MEDIA[fy], `sedgwick ${fy}`).toBeDefined();
  });

  it('resolves a fetch URL for every year in every window', () => {
    for (const [key, years] of Object.entries(CO_KS_WINDOWS)) {
      for (const fy of years) expect(documentUrlFor(key, fy), `${key} ${fy}`).toMatch(/^https:\/\//);
    }
    expect(documentUrlFor('nope', 2024)).toBeNull();
  });

  // ⚠ FY2023+ 404s under the census-era shape (FAC migrated to GSAFAC ids) and
  // the city's own archive is unreachable — an incomplete TLS chain. Recorded
  // as a gap rather than guessed.
  it('stops Boulder city at FY2022 and uses the census-era FAC id shape', () => {
    expect(Object.keys(BOULDER_CITY_FAC).map(Number).sort()).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022]);
    for (const [fy, id] of Object.entries(BOULDER_CITY_FAC)) {
      expect(id).toBe(`${fy}-12-CENSUS-0000134815`);
    }
    expect(BOULDER_CITY_FAC[2023]).toBeUndefined();
  });

  it('lists Boulder County FY2021-FY2025 as direct PDFs', () => {
    expect(Object.keys(BOULDER_COUNTY_URL).map(Number).sort()).toEqual([2021, 2022, 2023, 2024, 2025]);
  });
});

describe('declared document gaps', () => {
  // ⚠ Four gaps, three distinct causes. Declared so an absence is a recorded
  // decision rather than a silent hole in a series — and never a $0 row.
  it('declares exactly the four unloadable documents with a reason', () => {
    expect(Object.keys(KNOWN_DOCUMENT_GAPS).sort()).toEqual([
      'sedgwick-county-2005', 'sedgwick-county-2019', 'wichita-2001', 'wichita-2008',
    ]);
    for (const [k, why] of Object.entries(KNOWN_DOCUMENT_GAPS)) {
      expect(why.length, k).toBeGreaterThan(30);
    }
  });

  it('names the cause of each gap rather than just marking it missing', () => {
    expect(KNOWN_DOCUMENT_GAPS['wichita-2001']).toMatch(/scan/i);
    expect(KNOWN_DOCUMENT_GAPS['wichita-2008']).toMatch(/scan/i);
    expect(KNOWN_DOCUMENT_GAPS['sedgwick-county-2005']).toMatch(/404/);
    expect(KNOWN_DOCUMENT_GAPS['sedgwick-county-2019']).toMatch(/encoding/i);
  });
});

describe('source labels and the registries that read them', () => {
  // ⚠ Reproduces the EXISTING co-local-acfr-gf shape exactly, so Boulder joins
  // that family instead of forming a lookalike beside it.
  it('matches the shape the Colorado family already uses', () => {
    expect(sourceNameFor('El Paso County', 'revenue', 2005))
      .toBe('El Paso County ACFR — General Fund Revenue by Source (FY2005 actual, GAAP basis)');
    expect(sourceNameFor('City of Boulder', 'operating', 2022))
      .toBe('City of Boulder ACFR — General Fund Expenditure by Function (FY2022 actual, GAAP basis)');
  });

  it('resolves fund scope, basis and reporting entity for every loaded label', () => {
    const fs = entryById(FUND_SCOPE_REGISTRY, 'co-local-acfr-gf');
    const fsKs = entryById(FUND_SCOPE_REGISTRY, 'ks-local-acfr-gf');
    const bs = entryById(BASIS_REGISTRY, 'co-local-acfr-gf');
    const bsKs = entryById(BASIS_REGISTRY, 'ks-local-acfr-gf');
    const re = entryById(REPORTING_ENTITY_REGISTRY, 'co-local-acfr-gf');
    const reKs = entryById(REPORTING_ENTITY_REGISTRY, 'ks-local-acfr-gf');
    for (const r of [fs, fsKs, bs, bsKs, re, reKs]) expect(r).toBeTruthy();

    for (const ent of CO_KS_ENTITIES) {
      const co = ent.family === 'co-local-acfr-gf';
      for (const fy of CO_KS_WINDOWS[ent.key]) {
        for (const dt of ['revenue', 'operating']) {
          const label = sourceNameFor(ent.name, dt, fy);
          expect((co ? fs : fsKs).match.test(label), label).toBe(true);
          expect((co ? bs : bsKs).match.test(label), label).toBe(true);
          expect((co ? re : reKs).match.test(label), label).toBe(true);
          // ⚠ And the families must not claim each other's labels.
          expect((co ? fsKs : fs).match.test(label), label).toBe(false);
        }
      }
    }
  });

  // ⚠ The Colorado entries were EXTENDED, not replaced — the two pre-existing
  // entities must still match, or 64 merged rows silently lose their axes.
  it('keeps the pre-existing Colorado entities matching after the extension', () => {
    for (const id of ['co-local-acfr-gf']) {
      for (const reg of [FUND_SCOPE_REGISTRY, BASIS_REGISTRY, REPORTING_ENTITY_REGISTRY]) {
        const e = entryById(reg, id);
        expect(e.match.test('City of Colorado Springs ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)')).toBe(true);
        expect(e.match.test('El Paso County ACFR — General Fund Expenditure by Function (FY2012 actual, GAAP basis)')).toBe(true);
      }
    }
  });

  // ⚠ Anchored at the start and enumerated. A bare /^City of/ would claim every
  // future entity in either state sight unseen.
  it('does not claim a neighbouring or future entity', () => {
    const fsKs = entryById(FUND_SCOPE_REGISTRY, 'ks-local-acfr-gf');
    const fs = entryById(FUND_SCOPE_REGISTRY, 'co-local-acfr-gf');
    // Boulder City, NEVADA — a real municipality with its own reports page.
    expect(fs.match.test('Boulder City ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)')).toBe(false);
    // Wichita COUNTY, KS is a different government 250 miles from the city.
    expect(fsKs.match.test('Wichita County ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)')).toBe(false);
    // The CITY of Sedgwick, in Harvey County.
    expect(fsKs.match.test('City of Sedgwick ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)')).toBe(false);
    expect(fsKs.match.test('City of Topeka ACFR — General Fund Revenue by Source (FY2024 actual, GAAP basis)')).toBe(false);
  });

  it('records the axes the loader writes', () => {
    expect(FUND_SCOPE).toBe('general_fund');
    expect(BASIS_VALUE).toBe('actual');
    expect(DERIVATION).toBe('published');
  });
});

describe('audit grade', () => {
  it('grades every loaded label audited_gaap', () => {
    for (const ent of CO_KS_ENTITIES) {
      for (const fy of CO_KS_WINDOWS[ent.key]) {
        for (const dt of ['revenue', 'operating']) {
          const label = sourceNameFor(ent.name, dt, fy);
          const g = gradeFor(label);
          expect(g.value, label).toBe(AUDIT_GRADE.AUDITED_GAAP);
          expect(g.entryId, label).toBe('co-ks-local-acfr-gf');
        }
      }
    }
  });

  // ⚠⚠ THE GUARANTEE HERE IS ABOUT WHICH ENTRY CLAIMS THEM, NOT ABOUT THE GRADE.
  //
  // This test used to assert Colorado Springs and El Paso County were `unknown`,
  // because session 7b anchored its entry to the four entities whose opinions it
  // actually read. On 2026-08-31 those 32 documents WERE read — both opinion
  // gates, over every one — so they are now graded by their OWN entry,
  // `co-springs-epc-acfr-gf`, carrying its own evidence.
  //
  // What must NOT happen is the 7b entry widening to swallow them. That is still
  // the failure §3.5 forbids: one entry's evidence covering documents nobody
  // checked under it. So the assertion is now on the entryId. If a future edit
  // broadens `co-ks-local-acfr-gf`, this fails — which is the whole point.
  it('grades the pre-existing Colorado entities from their OWN entry, not the 7b one', () => {
    for (const name of ['City of Colorado Springs', 'El Paso County']) {
      const label = sourceNameFor(name, 'revenue', 2024);
      const g = gradeFor(label);
      expect(g.value, label).toBe(AUDIT_GRADE.AUDITED_GAAP);
      expect(g.entryId, label).toBe('co-springs-epc-acfr-gf');
      expect(g.entryId, `${label} must NOT be claimed by the session-7b entry`)
        .not.toBe('co-ks-local-acfr-gf');
    }
  });

  it('does not grade a neighbouring government', () => {
    for (const name of ['Boulder City', 'Wichita County', 'City of Sedgwick']) {
      expect(gradeFor(sourceNameFor(name, 'revenue', 2024)).value, name).toBe(AUDIT_GRADE.UNKNOWN);
    }
  });
});
