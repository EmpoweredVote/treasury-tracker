/**
 * NC-DURHAM-AVL-01 — source manifests and content guards.
 *
 * The centrepiece is `assertIssuer` against a REAL adversarial fixture: the
 * front matter of the Buncombe County Board of Education's FY2024 ACFR, a
 * genuine 137-page audited report that a naive guard accepts as Buncombe
 * County's own. The first version of the guard DID accept it; these tests
 * exist so that regression cannot recur silently.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DURHAM_CITY_DOCS, DURHAM_CITY_FYS, durhamCityUrls,
  DURHAM_COUNTY_FILES, DURHAM_COUNTY_FYS, durhamCountyUrls,
  ASHEVILLE_DRIVE_IDS, ASHEVILLE_REJECTED_IDS, ashevilleUrls, ashevilleViewerUrl,
  BUNCOMBE_DOC_IDS, BUNCOMBE_REJECTED_IDS, BUNCOMBE_LEGACY_FYS, BUNCOMBE_FYS, buncombeUrls,
  NC_FISCAL_YEAR_START_MONTH, NC_FY_END_MONTH_DAY, NC_ENTITIES,
  assertFiscalYear, assertIssuer, NC_ISSUERS,
} from '../scripts/lib/ncAcfrSources.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(HERE, 'fixtures', 'nc', name), 'utf8');

const SCHOOLS_FY2024 = fixture('buncombe-schools-fy2024-frontmatter.txt');
const COUNTY_FY2024 = fixture('buncombe-county-fy2024-frontmatter.txt');

describe('assertIssuer — the Buncombe County Schools adversary', () => {
  it('ACCEPTS the genuine Buncombe County ACFR', () => {
    expect(assertIssuer(COUNTY_FY2024, NC_ISSUERS.buncombe).ok).toBe(true);
  });

  it('REJECTS the Buncombe County Board of Education ACFR', () => {
    const r = assertIssuer(SCHOOLS_FY2024, NC_ISSUERS.buncombe);
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/WRONG ISSUER/);
  });

  /**
   * The impostor's cover reads "Buncombe County Board of Education". Both of
   * these are true of it, and together they are exactly why a require/forbid
   * guard on NAMES cannot separate the two documents — the redesign to an
   * authorship test was forced by these two facts.
   */
  it('documents WHY a name-only guard fails: the impostor contains the county name', () => {
    expect(NC_ISSUERS.buncombe.require.test(SCHOOLS_FY2024)).toBe(true);
    expect(/BUNCOMBE\s+COUNTY/i.test(SCHOOLS_FY2024)).toBe(true);
  });

  it('documents WHY forbidding "Board of Education" outright fails: the real ACFR mentions it', () => {
    // Not in the 3KB cover fixture, but in the full front matter of all 16
    // genuine Buncombe reports — the school board is a component unit.
    const withComponentUnit = `${COUNTY_FY2024}\nDiscretely Presented Component Unit — Buncombe County Board of Education`;
    expect(assertIssuer(withComponentUnit, NC_ISSUERS.buncombe).ok).toBe(true);
  });

  it('rejects a document that names the county but no governing body at all', () => {
    const r = assertIssuer('BUNCOMBE COUNTY, NORTH CAROLINA — Quarterly Financial Report', NC_ISSUERS.buncombe);
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/no governing-body or chief-executive marker/);
  });

  it('treats missing text as UNVERIFIABLE, never as a pass', () => {
    expect(assertIssuer(null, NC_ISSUERS.buncombe).ok).toBe(false);
    expect(assertIssuer(undefined, NC_ISSUERS.buncombe).ok).toBe(false);
  });

  it('requires the issuer name even when a governing marker is present', () => {
    const r = assertIssuer('COUNTY MANAGER / BOARD OF COMMISSIONERS of Wake County', NC_ISSUERS.buncombe);
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/does not name/);
  });

  it('every entity has a require pattern, an any-of governing set, and a forbid set', () => {
    for (const [name, iss] of Object.entries(NC_ISSUERS)) {
      expect(iss.require, name).toBeInstanceOf(RegExp);
      expect(Array.isArray(iss.governing), name).toBe(true);
      expect(iss.governing.length, name).toBeGreaterThan(0);
      expect(iss.forbidGoverning.length, name).toBeGreaterThan(0);
    }
  });
});

describe('assertFiscalYear', () => {
  it('accepts a June 30 close naming the claimed year', () => {
    expect(assertFiscalYear('For the Fiscal Year Ended June 30, 2024', 2024).ok).toBe(true);
  });

  it('accepts the space-dropped rendering that once mis-loaded King County', () => {
    expect(assertFiscalYear('YEAR ENDED JUNE30,2024', 2024).ok).toBe(true);
  });

  it('rejects a document naming only an adjacent year', () => {
    const r = assertFiscalYear('For the Fiscal Year Ended June 30, 2023', 2024);
    expect(r.ok).toBe(false);
    expect(r.note).toMatch(/names FY2023/);
  });

  it('ALLOWS a miss — an unreadable caption is not proof of a wrong year', () => {
    const r = assertFiscalYear('cover page with no caption', 2024);
    expect(r.ok).toBe(true);
    expect(r.note).toMatch(/MISS/);
  });

  it('accepts a report that also names the prior year in its comparative columns', () => {
    const text = 'Fiscal Year Ended June 30, 2024 ... compared with June 30, 2023';
    expect(assertFiscalYear(text, 2024).ok).toBe(true);
  });
});

describe('source manifests', () => {
  it('City of Durham ids are NOT monotonic in fiscal year', () => {
    // FY2010-FY2016 were re-uploaded in 2020 with ids above FY2017's and
    // FY2018's. Any year-from-id inference would mis-assign seven years.
    const id = (fy) => Number(DURHAM_CITY_DOCS[fy].split('/')[0]);
    expect(id(2016)).toBeGreaterThan(id(2017));
    expect(id(2016)).toBeGreaterThan(id(2018));
  });

  it('City of Durham covers FY2009-FY2024 with no gaps', () => {
    expect(DURHAM_CITY_FYS[0]).toBe(2009);
    expect(DURHAM_CITY_FYS.at(-1)).toBe(2024);
    for (let fy = 2009; fy <= 2024; fy++) expect(DURHAM_CITY_FYS).toContain(fy);
  });

  it('Durham County FY2014 breaks the Fiscal-Year-Ending run', () => {
    expect(DURHAM_COUNTY_FILES[2013]).toBe('Fiscal-Year-Ending-June-2013.pdf');
    expect(DURHAM_COUNTY_FILES[2015]).toBe('Fiscal-Year-Ending-June-2015.pdf');
    expect(DURHAM_COUNTY_FILES[2014]).not.toMatch(/Fiscal-Year-Ending/);
  });

  it("Durham County FY2025 keeps the county's own misspelling", () => {
    expect(DURHAM_COUNTY_FILES[2025]).toMatch(/Duhram/);
  });

  it('Durham County covers FY2005-FY2025 with no gaps', () => {
    for (let fy = 2005; fy <= 2025; fy++) expect(DURHAM_COUNTY_FYS).toContain(fy);
  });

  it('every Durham County year offers an /Archive/ fallback candidate', () => {
    for (const fy of DURHAM_COUNTY_FYS) {
      const urls = durhamCountyUrls(fy);
      expect(urls.length, `FY${fy}`).toBe(2);
      expect(urls.some((u) => u.includes('/Archive/')), `FY${fy}`).toBe(true);
    }
  });

  it('Asheville never returns the FY2021 Compliance Audit id', () => {
    const rejected = Object.keys(ASHEVILLE_REJECTED_IDS);
    expect(rejected.length).toBeGreaterThan(0);
    const all = Object.values(ASHEVILLE_DRIVE_IDS);
    for (const bad of rejected) expect(all).not.toContain(bad);
    for (const fy of Object.keys(ASHEVILLE_DRIVE_IDS).map(Number)) {
      for (const bad of rejected) {
        expect(ashevilleUrls(fy).join(' '), `FY${fy}`).not.toContain(bad);
      }
    }
  });

  it('Asheville resolves to a download endpoint, never the viewer page', () => {
    for (const fy of Object.keys(ASHEVILLE_DRIVE_IDS).map(Number)) {
      for (const u of ashevilleUrls(fy)) {
        expect(u, `FY${fy}`).toMatch(/export=download/);
        expect(u, `FY${fy}`).not.toMatch(/\/file\/d\/.*\/view/);
      }
      expect(ashevilleViewerUrl(fy)).toMatch(/\/file\/d\/.*\/view/);
    }
  });

  it('Buncombe never returns the FY2019 PAFR id', () => {
    const pafr = Object.keys(BUNCOMBE_REJECTED_IDS);
    expect(pafr).toContain('6519');
    for (const fy of BUNCOMBE_FYS) {
      for (const bad of pafr) {
        expect(buncombeUrls(fy).join(' '), `FY${fy}`).not.toMatch(new RegExp(`/View/${bad}\\b`));
      }
    }
  });

  it('Buncombe DocumentCenter labels map to the SECOND year of the span', () => {
    // "2023-2024" is FY2024. Reading the first year would shift the whole
    // county series back by one while every file still passed every guard.
    for (const [fy, doc] of Object.entries(BUNCOMBE_DOC_IDS)) {
      expect(doc, `FY${fy}`).toMatch(new RegExp(`${Number(fy) - 1}-${fy}-`));
    }
  });

  it('Buncombe FY2020 offers the pre-GFOA-rename word order', () => {
    const urls = buncombeUrls(2020).join(' ');
    expect(urls).toContain('comprehensive-annual-financial-report.pdf');
    expect(urls).toContain('annual-comprehensive-financial-report.pdf');
  });

  it('Buncombe has a real FY2009/FY2010 gap, not a naming variant', () => {
    // Every two-digit year 05-25 was probed against CAFR<yy>.pdf; these 404.
    expect(BUNCOMBE_LEGACY_FYS).not.toContain(2009);
    expect(BUNCOMBE_LEGACY_FYS).not.toContain(2010);
    expect(BUNCOMBE_FYS).not.toContain(2009);
    expect(BUNCOMBE_FYS).not.toContain(2010);
    expect(BUNCOMBE_FYS).toContain(2008);
    expect(BUNCOMBE_FYS).toContain(2011);
  });

  it('Buncombe FY2025 exists only on DocumentCenter', () => {
    const urls = buncombeUrls(2025);
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('/DocumentCenter/View/6705');
  });

  it('every entity year resolves to at least one candidate URL', () => {
    for (const [name, ent] of Object.entries(NC_ENTITIES)) {
      expect(ent.fys.length, name).toBeGreaterThan(0);
      for (const fy of ent.fys) {
        expect(ent.urls(fy).length, `${name} FY${fy}`).toBeGreaterThan(0);
        expect(ent.file(fy), `${name} FY${fy}`).toMatch(/\.pdf$/);
      }
    }
  });

  it('every candidate URL is https', () => {
    for (const ent of Object.values(NC_ENTITIES)) {
      for (const fy of ent.fys) {
        for (const u of ent.urls(fy)) expect(u).toMatch(/^https:\/\//);
      }
    }
  });
});

describe('NC fiscal calendar', () => {
  it('is July-June per N.C.G.S. 159-8(b), matching the NC state node', () => {
    expect(NC_FISCAL_YEAR_START_MONTH).toBe(7);
    expect(NC_FY_END_MONTH_DAY).toBe('06-30');
  });

  it('start month and year end agree with each other', () => {
    // The cross-check acfrGfLoad.mjs enforces: a year ending 06-30 starts in 07.
    const endMonth = Number(NC_FY_END_MONTH_DAY.split('-')[0]);
    expect((endMonth % 12) + 1).toBe(NC_FISCAL_YEAR_START_MONTH);
  });
});
