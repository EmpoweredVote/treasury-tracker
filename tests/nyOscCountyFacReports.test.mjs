import { describe, it, expect } from 'vitest';
import { NY_COUNTY_FAC_REPORTS, FAC_PDF_BASE } from '../scripts/data/nyOscCountyFacReports.mjs';
import { NY_MUNICIPAL_ENTITIES } from '../scripts/data/nyOscMunicipalEntities.mjs';

describe('the NY county FAC report registry', () => {
  it('names four counties that TT actually loaded, by municipal code', () => {
    const counties = new Map(NY_MUNICIPAL_ENTITIES
      .filter((e) => e.memberClass === 'County')
      .map((e) => [e.municipalCode, e.name]));
    expect(NY_COUNTY_FAC_REPORTS).toHaveLength(4);
    for (const c of NY_COUNTY_FAC_REPORTS) {
      expect(counties.has(c.municipalCode), `${c.displayName} ${c.municipalCode}`).toBe(true);
      expect(counties.get(c.municipalCode)).toBe(c.displayName);
    }
  });

  it('⚠⚠ keys on the EIN, and every EIN is distinct', () => {
    // 322 NY auditees have "COUNTY" in their name and only 90 are governments
    // at all; one government files under two name forms (COUNTY OF FULTON /
    // COUNTY OF FULTON NEW YORK, one EIN). The name is a display field here.
    const eins = NY_COUNTY_FAC_REPORTS.map((c) => c.auditeeEin);
    expect(new Set(eins).size).toBe(eins.length);
    for (const e of eins) expect(e, e).toMatch(/^\d{9}$/);
  });

  it('⚠ carries ONE report id per audit year — a duplicate is a resubmission', () => {
    // Albany FY2023 filed twice (2023-12-GSAFAC-0000057283 and
    // ...-0000344591). The generator keeps the later id; a map cannot hold
    // both, and this pins that the collapse happened rather than silently
    // picking whichever came last out of the CSV.
    for (const c of NY_COUNTY_FAC_REPORTS) {
      const years = Object.keys(c.reports);
      expect(new Set(years).size, c.displayName).toBe(years.length);
      expect(years.length, c.displayName).toBe(9);
    }
    const albany = NY_COUNTY_FAC_REPORTS.find((c) => c.displayName === 'Albany');
    expect(albany.reports[2023]).toBe('2023-12-GSAFAC-0000344591');
  });

  it('⚠ every report id encodes a DECEMBER year end, matching the load', () => {
    // All 57 NY counties were loaded with fiscal start month 1. A report id
    // whose month segment is not 12 would be a different fiscal calendar and
    // the comparison would be year-shifted.
    for (const c of NY_COUNTY_FAC_REPORTS) {
      for (const [fy, id] of Object.entries(c.reports)) {
        expect(id, `${c.displayName} FY${fy}`).toMatch(/^\d{4}-12-(CENSUS|GSAFAC)-\d{10}$/);
        expect(id.slice(0, 4), `${c.displayName} FY${fy}`).toBe(String(fy));
      }
    }
  });

  it('⚠ FAC starts at audit year 2016 — no entry may claim an earlier year', () => {
    // TT loads FY1995-FY2025. 21 of those 31 years have no audit route, and
    // the findings must never be read as covering them.
    for (const c of NY_COUNTY_FAC_REPORTS) {
      for (const fy of Object.keys(c.reports)) expect(Number(fy)).toBeGreaterThanOrEqual(2016);
    }
  });

  it('the PDF endpoint is the unauthenticated FAC one', () => {
    expect(FAC_PDF_BASE).toBe('https://app.fac.gov/dissemination/report/pdf');
  });
});
