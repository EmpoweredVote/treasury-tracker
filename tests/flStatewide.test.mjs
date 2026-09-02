import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  splitCsvLine, readPepCsv, placeMatchKey, exactMatchKey, countyForPlace, SUMLEV,
} from '../scripts/lib/censusPep.mjs';
import { monthFromFye, auditBranchFor, entityTypeForCode } from '../scripts/buildFlStatewideRoster.mjs';
import { resolveGuard, facCandidatesFor } from '../scripts/buildFlStatewideEntities.mjs';
import { sourceNameForBranch, SOURCE_BRANCHES, SOURCE_PREFIX } from '../scripts/loadFloridaDFS.mjs';
import { plannedRowsFor, DATASETS } from '../scripts/loadFlStatewide.mjs';
import {
  FL_STATEWIDE_ENTITIES, FL_STATEWIDE_LOAD_WINDOW, flEntityByCode,
} from '../scripts/data/flStatewideEntities.mjs';
import {
  FL_CENSUS_ALIASES, FL_COUNTY_ALIASES, FL_DISSOLVED, FL_EXISTING_TT_NAMES, FL_CONSOLIDATED,
} from '../scripts/data/flCensusAliases.mjs';
import { FL_ORACLE_DRIFT, declaredDriftFor } from '../scripts/data/flOracleDrift.mjs';
import { toCents, moneyEquals } from '../scripts/lib/floridaDfs.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';

describe('Census PEP reader — the quoted comma that shifts a column', () => {
  it('splits a quoted field containing a comma as ONE cell', () => {
    const line = '162,12,000,34132,00000,00000,0,A,"Islamorada, Village of Islands village",'
      + 'Florida,7127,7122,7087,7089,7049,7013';
    const cells = splitCsvLine(line);
    expect(cells).toHaveLength(16);
    expect(cells[8]).toBe('Islamorada, Village of Islands village');
    // ⚠ THE POINT: the naive split puts the 2023 estimate here.
    expect(cells[15]).toBe('7013');
  });

  it('handles "" as an escaped quote', () => {
    expect(splitCsvLine('a,"say ""hi""",b')).toEqual(['a', 'say "hi"', 'b']);
  });

  it('throws on an unterminated quoted field rather than returning a short row', () => {
    expect(() => splitCsvLine('a,"never closed,b')).toThrow(/unterminated/i);
  });

  it('refuses a row whose cell count does not match the header — a shifted column is invisible', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pep-'));
    const f = path.join(dir, 'bad.csv');
    writeFileSync(f, 'SUMLEV,NAME,POPESTIMATE2024\n162,Springfield\n');
    expect(() => readPepCsv(f)).toThrow(/cells against .* headers/);
  });

  it('reads a well-formed file into objects', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pep-'));
    const f = path.join(dir, 'ok.csv');
    writeFileSync(f, 'SUMLEV,NAME,POPESTIMATE2024\n162,"Islamorada, Village of Islands village",7013\n');
    const rows = readPepCsv(f);
    expect(rows).toHaveLength(1);
    expect(rows[0].NAME).toBe('Islamorada, Village of Islands village');
    expect(rows[0].POPESTIMATE2024).toBe('7013');
  });
});

describe('Census PEP reader — the designator is stripped from the CENSUS side only', () => {
  it('strips a trailing designator to make a match key', () => {
    expect(placeMatchKey('Cooper City city')).toBe('coopercity');
    expect(placeMatchKey('Melbourne city')).toBe('melbourne');
    expect(placeMatchKey('Melbourne Village village')).toBe('melbournevillage');
  });

  it('⚠⚠ a LOGERx name keyed EXACTLY still reaches its census row', () => {
    // This is the regression: keying the LOGERx name through placeMatchKey turned
    // "Cooper City" into "cooper" and lost 16 municipalities whose names end in a
    // type word, while collapsing Melbourne Village onto Melbourne.
    expect(exactMatchKey('Cooper City')).toBe(placeMatchKey('Cooper City city'));
    expect(exactMatchKey('Panama City')).toBe(placeMatchKey('Panama City city'));
    expect(exactMatchKey('Melbourne Village')).toBe(placeMatchKey('Melbourne Village village'));
    // ...and the two must NOT collide.
    expect(exactMatchKey('Melbourne Village')).not.toBe(placeMatchKey('Melbourne city'));
  });

  it('a city and a village of the same stem stay distinct', () => {
    expect(placeMatchKey('Melbourne city')).not.toBe(placeMatchKey('Melbourne Village village'));
  });
});

describe('Census PEP reader — county parts and straddlers', () => {
  const parts = new Map([
    ['00001', [{ COUNTY: '035', PRIMGEO_FLAG: '0', POPESTIMATE2024: '5490' },
      { COUNTY: '127', PRIMGEO_FLAG: '0', POPESTIMATE2024: '78' }]],
    ['00002', [{ COUNTY: '087', PRIMGEO_FLAG: '1', POPESTIMATE2024: '7013' }]],
    ['00003', [{ COUNTY: '001', PRIMGEO_FLAG: '1', POPESTIMATE2024: '10' },
      { COUNTY: '002', PRIMGEO_FLAG: '0', POPESTIMATE2024: '9999' }]],
  ]);

  it('a single part is not a straddle', () => {
    expect(countyForPlace(parts, '00002')).toMatchObject({ countyFips: '087', straddles: false, parts: 1 });
  });

  it('falls back to the largest part and SAYS SO when no PRIMGEO_FLAG is set', () => {
    const r = countyForPlace(parts, '00001');
    expect(r).toMatchObject({ countyFips: '035', straddles: true, parts: 2 });
    expect(r.basis).toMatch(/largest/i);
  });

  it('PRIMGEO_FLAG beats population when Census actually sets it', () => {
    const r = countyForPlace(parts, '00003');
    expect(r.countyFips).toBe('001');
    expect(r.basis).toBe('PRIMGEO_FLAG');
  });

  it('names its SUMLEVs rather than carrying bare strings', () => {
    expect(SUMLEV.wholePlace).toBe('162');
    expect(SUMLEV.placePart).toBe('157');
    expect(SUMLEV.county).toBe('050');
  });
});

describe('Florida roster — the fiscal-year END is not the START month', () => {
  it('⚠⚠ 9/30 means the year STARTED in month 10', () => {
    expect(monthFromFye('9/30')).toBe(10);
  });

  it('handles the other calendars the same way', () => {
    expect(monthFromFye('6/30')).toBe(7);
    expect(monthFromFye('12/31')).toBe(1);
    expect(monthFromFye('3/31')).toBe(4);
  });

  it('returns null rather than guessing', () => {
    expect(monthFromFye('')).toBeNull();
    expect(monthFromFye(null)).toBeNull();
    expect(monthFromFye('Sept 30')).toBeNull();
    expect(monthFromFye('13/30')).toBeNull();
  });
});

describe('Florida roster — the reconciliation branch', () => {
  const compliance = new Map([
    ['200001', { auditReceived: '2024-01-02', auditCompleted: '' }],
    ['200002', { auditReceived: '', auditCompleted: '2024-03-04' }],
    ['200003', { auditReceived: '', auditCompleted: '' }],
  ]);

  it('either audit date means the audit branch applied', () => {
    expect(auditBranchFor(compliance, '200001')).toBe('audit-reconciled');
    expect(auditBranchFor(compliance, '200002')).toBe('audit-reconciled');
  });

  it('⚠⚠ both dates blank is UNRECORDED, never "a worksheet was used"', () => {
    // Tampa FY2013 is this case, and Tampa was certainly audited.
    expect(auditBranchFor(compliance, '200003')).toBe('branch-unrecorded');
    expect(auditBranchFor(compliance, '200003')).not.toBe('DEW-reconciled');
  });

  it('absent from both reports is its own answer', () => {
    expect(auditBranchFor(compliance, '999999')).toBe('absent');
  });

  it('classifies entity type from the code prefix, and excludes special districts', () => {
    expect(entityTypeForCode('100013')).toBe('county');
    expect(entityTypeForCode('200239')).toBe('city');
    expect(entityTypeForCode('300001')).toBeNull();
  });
});

describe('Florida — the source string carries all three branches', () => {
  it('builds a distinct name per branch', () => {
    for (const b of SOURCE_BRANCHES) {
      const s = sourceNameForBranch('operating', 2023, b);
      expect(s.startsWith(SOURCE_PREFIX)).toBe(true);
      expect(s).toContain(b);
    }
  });

  it('refuses a branch it does not know', () => {
    expect(() => sourceNameForBranch('operating', 2023, 'made-up')).toThrow(/unknown reconciliation branch/);
  });

  it('only the audit-reconciled branch earns the compiled_from_audited grade', () => {
    expect(gradeFor(sourceNameForBranch('operating', 2023, 'audit-reconciled')).value)
      .toBe(AUDIT_GRADE.COMPILED_FROM_AUDITED);
  });

  it('⚠ branch-unrecorded grades UNKNOWN — "we do not know" must look like not knowing', () => {
    for (const dataset of ['operating', 'revenue']) {
      const g = gradeFor(sourceNameForBranch(dataset, 2013, 'branch-unrecorded'));
      // No registry entry matches, so there is no grade to claim.
      expect(g?.value).not.toBe(AUDIT_GRADE.COMPILED_FROM_AUDITED);
      expect(g?.value).not.toBe(AUDIT_GRADE.SELF_REPORTED);
    }
  });
});

describe('Florida — the FAC guard takes candidates, and silence is not agreement', () => {
  const lookup = (state, name, fy) => {
    if (name === 'Everglades City') return { unknown: 'no filing' };
    if (name === 'Everglades') return { month: 10, auditYears: [fy] };
    if (name === 'Contradictor') return { month: 7, auditYears: [fy] };
    return { unknown: 'not covered' };
  };

  it('confirms through whichever candidate the census actually holds', () => {
    const r = resolveGuard(['Everglades City', 'Everglades'], 10, 2023, lookup);
    expect(r.status).toBe('confirmed');
    expect(r.via).toBe('Everglades');
  });

  it('reports UNVERIFIED when no candidate is covered — never "confirmed"', () => {
    const r = resolveGuard(['Nowhere', 'Nowhere Town'], 10, 2023, lookup);
    expect(r.status).toBe('unverified');
    expect(r.why).toBeTruthy();
  });

  it('⚠⚠ a contradiction wins even when another candidate agreed', () => {
    const r = resolveGuard(['Everglades', 'Contradictor'], 10, 2023, lookup);
    expect(r.status).toBe('conflict');
  });

  it('a contradiction is caught whichever order the candidates come in', () => {
    expect(resolveGuard(['Contradictor', 'Everglades'], 10, 2023, lookup).status).toBe('conflict');
  });

  it('counties are looked up as "<Name> County"', () => {
    expect(facCandidatesFor({ entityType: 'county', unitName: 'Leon' })).toEqual(['Leon County']);
  });

  it('a municipality tries its display name, its LOGERx name and its census stem', () => {
    const c = facCandidatesFor({
      entityType: 'city', unitName: 'Bal Harbour Village',
      displayName: 'Bal Harbour', censusName: 'Bal Harbour village',
    });
    expect(c).toContain('Bal Harbour');
    expect(c).toContain('Bal Harbour Village');
    expect(new Set(c).size).toBe(c.length); // deduplicated
  });
});

describe('Florida statewide registry — integrity', () => {
  it('holds every filing city and county, and nothing else', () => {
    const cities = FL_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'city');
    const counties = FL_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'county');
    expect(FL_STATEWIDE_ENTITIES.length).toBe(cities.length + counties.length);
    expect(counties.length).toBe(66); // 67 counties, less consolidated Duval
    expect(cities.length).toBeGreaterThan(400);
  });

  it('⚠⚠ the display name is unique — the database keys on it', () => {
    const names = FL_STATEWIDE_ENTITIES.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('the LOGERx code is unique and is the real join key', () => {
    const codes = FL_STATEWIDE_ENTITIES.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(flEntityByCode('200239').name).toBe('Miami');
    expect(flEntityByCode('100050').name).toBe('Palm Beach County');
    // ⚠ The Town of Palm Beach and Palm Beach County are different governments.
    expect(flEntityByCode('200287').entityType).toBe('city');
    expect(flEntityByCode('200287').name).not.toBe('Palm Beach County');
  });

  it('⚠⚠ reproduces every name that already exists in treasury.municipalities', () => {
    const names = new Set(FL_STATEWIDE_ENTITIES.map((e) => e.name));
    for (const n of FL_EXISTING_TT_NAMES) expect(names.has(n)).toBe(true);
  });

  it('every entity has at least one fiscal year, inside the published window', () => {
    for (const e of FL_STATEWIDE_ENTITIES) {
      expect(e.fiscalYears.length).toBeGreaterThan(0);
      for (const y of e.fiscalYears) {
        expect(y).toBeGreaterThanOrEqual(FL_STATEWIDE_LOAD_WINDOW.first);
        expect(y).toBeLessThanOrEqual(FL_STATEWIDE_LOAD_WINDOW.last);
      }
    }
  });

  it('every fiscal year carries a month, and Florida publishes October for all of them', () => {
    for (const e of FL_STATEWIDE_ENTITIES) {
      for (const y of e.fiscalYears) {
        expect(e.monthsByYear[y]).toBe(10);
      }
    }
  });

  it('every fiscal year carries a branch and a guard verdict', () => {
    for (const e of FL_STATEWIDE_ENTITIES) {
      for (const y of e.fiscalYears) {
        expect(SOURCE_BRANCHES).toContain(e.branchByYear[y]);
        expect(['confirmed', 'unverified']).toContain(e.guardByYear[y]);
      }
    }
  });

  it('a population is a real estimate or a declared null — never zero-by-accident', () => {
    for (const e of FL_STATEWIDE_ENTITIES) {
      if (e.population === null) {
        expect(e.dissolved).toBe(true);
        continue;
      }
      expect(Number.isInteger(e.population)).toBe(true);
      expect(e.population).toBeGreaterThan(0);
    }
  });

  it('every city either links to a county or says why it cannot', () => {
    for (const e of FL_STATEWIDE_ENTITIES.filter((x) => x.entityType === 'city')) {
      expect(Boolean(e.countyDbName) || Boolean(e.countyNote)).toBe(true);
    }
  });

  it('a county link always names a county that is itself in the registry', () => {
    const counties = new Set(FL_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'county').map((e) => e.name));
    for (const e of FL_STATEWIDE_ENTITIES) {
      if (e.countyDbName) expect(counties.has(e.countyDbName)).toBe(true);
    }
  });

  it('⚠ Duval County is absent on purpose and its municipalities say so', () => {
    expect(FL_STATEWIDE_ENTITIES.some((e) => e.name === 'Duval County')).toBe(false);
    expect(FL_CONSOLIDATED['Duval County']).toMatch(/Jacksonville/);
    const jax = FL_STATEWIDE_ENTITIES.find((e) => e.name === 'Jacksonville');
    expect(jax.countyDbName).toBeNull();
    expect(jax.countyNote).toMatch(/Duval/);
  });
});

describe('Florida statewide registry — the declared exceptions all do work', () => {
  it('every municipal alias names an entity that is actually in the registry', () => {
    const byUnitName = new Set(FL_STATEWIDE_ENTITIES.map((e) => e.unitName));
    for (const a of FL_CENSUS_ALIASES) expect(byUnitName.has(a.logerxName)).toBe(true);
  });

  it('every county alias names an entity that is actually in the registry', () => {
    const byUnitName = new Set(FL_STATEWIDE_ENTITIES.map((e) => e.unitName));
    for (const a of FL_COUNTY_ALIASES) expect(byUnitName.has(a.logerxName)).toBe(true);
  });

  it('⚠ Everglades City keeps its type word; Bal Harbour does not gain one', () => {
    expect(FL_STATEWIDE_ENTITIES.find((e) => e.code === '200103').name).toBe('Everglades City');
    expect(FL_STATEWIDE_ENTITIES.find((e) => e.code === '200016').name).toBe('Bal Harbour');
  });

  it('Melbourne and Melbourne Village are two governments with two populations', () => {
    const city = FL_STATEWIDE_ENTITIES.find((e) => e.name === 'Melbourne');
    const village = FL_STATEWIDE_ENTITIES.find((e) => e.name === 'Melbourne Village');
    expect(city.population).not.toBe(village.population);
    expect(city.population).toBeGreaterThan(village.population * 10);
  });

  it('a dissolved municipality keeps its history and stops when it stopped', () => {
    for (const d of FL_DISSOLVED) {
      const e = FL_STATEWIDE_ENTITIES.find((x) => x.name === d.displayName);
      expect(e).toBeTruthy();
      expect(e.dissolved).toBe(true);
      expect(e.population).toBeNull();
      expect(Math.max(...e.fiscalYears)).toBeLessThanOrEqual(d.lastFiscalYear);
      expect(e.fiscalYears.length).toBeGreaterThan(0);
    }
  });
});

describe('Florida statewide load — the planned size', () => {
  it('writes two datasets per entity-year', () => {
    expect(DATASETS).toEqual(['operating', 'revenue']);
    const entityYears = FL_STATEWIDE_ENTITIES.reduce((s, e) => s + e.fiscalYears.length, 0);
    expect(plannedRowsFor()).toBe(entityYears * 2);
  });

  it('is the size the roster measured, not a number carried forward', () => {
    // ⚠ "Count the authoritative table; never carry a previous total forward."
    const entityYears = FL_STATEWIDE_ENTITIES.reduce((s, e) => s + e.fiscalYears.length, 0);
    expect(entityYears).toBeGreaterThan(6000);
    expect(plannedRowsFor()).toBe(entityYears * DATASETS.length);
  });
});

describe('Florida oracle — money compares at the CENT, not in binary floats', () => {
  it('⚠ a float-accumulation artifact is NOT drift', () => {
    // The real FY2022 Sarasota County figures.
    expect(moneyEquals(1384728563.8200004, 1384728563.82)).toBe(true);
    expect(moneyEquals(644345803.9499999, 644345803.95)).toBe(true);
  });

  it('⚠⚠ but this is not a tolerance — one cent still fails', () => {
    expect(moneyEquals(1384728563.82, 1384728563.83)).toBe(false);
    expect(moneyEquals(100, 100.01)).toBe(false);
  });

  it('a real drift of any size still fails', () => {
    expect(moneyEquals(11942277, 11942384)).toBe(false); // Union County FY2014, $107
    expect(moneyEquals(29197130, 44225228)).toBe(false); // Brooksville FY2024
  });

  it('rounds to whole cents', () => {
    expect(toCents(1.01)).toBe(101);
    expect(toCents(0)).toBe(0);
    expect(toCents(-1.23)).toBe(-123);
    expect(toCents(1384728563.8200004)).toBe(138472856382);
  });
});

describe('Florida oracle drift — a declared exclusion must name something', () => {
  it('names a real registry entity for every entry', () => {
    const byCode = new Map(FL_STATEWIDE_ENTITIES.map((e) => [e.code, e]));
    for (const d of FL_ORACLE_DRIFT) {
      const e = byCode.get(d.code);
      expect(e, `drift entry ${d.name} names code ${d.code}`).toBeTruthy();
      expect(e.name).toBe(d.name);
    }
  });

  it('every declared entity-year is one the entity actually filed', () => {
    const byCode = new Map(FL_STATEWIDE_ENTITIES.map((e) => [e.code, e]));
    for (const d of FL_ORACLE_DRIFT) {
      expect(byCode.get(d.code).fiscalYears).toContain(d.fiscalYear);
    }
  });

  it('every entry states a non-zero delta somewhere — a zero-drift entry excludes nothing', () => {
    for (const d of FL_ORACLE_DRIFT) {
      expect(Math.abs(d.expDelta) + Math.abs(d.revDelta)).toBeGreaterThan(0);
    }
  });

  it('⚠ DFS is always ABOVE the detail report, never below', () => {
    for (const d of FL_ORACLE_DRIFT) {
      expect(d.expDelta).toBeGreaterThanOrEqual(0);
      expect(d.revDelta).toBeGreaterThanOrEqual(0);
    }
  });

  it('is keyed by code AND year — an entity may drift in one year and not another', () => {
    expect(declaredDriftFor('100014', 2016)).toBeTruthy();  // DeSoto County FY2016
    expect(declaredDriftFor('100014', 2015)).toBeNull();    // ...but not FY2015
    expect(declaredDriftFor('999999', 2016)).toBeNull();
  });

  it('holds no duplicate entity-years', () => {
    const keys = FL_ORACLE_DRIFT.map((d) => `${d.code}|${d.fiscalYear}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is a small, named exception rather than a blanket', () => {
    const entityYears = FL_STATEWIDE_ENTITIES.reduce((s, e) => s + e.fiscalYears.length, 0);
    expect(FL_ORACLE_DRIFT.length / entityYears).toBeLessThan(0.01);
  });
});
