import { describe, it, expect } from 'vitest';
import {
  HI_COUNTIES, FAC_ROSTER, countyByKey, fysFor, documentUrlFor,
} from '../scripts/lib/hiCountySources.mjs';
import { FAC_PDF_BASE, assertCitable } from '../scripts/lib/facCitable.mjs';

describe('the Hawaii county roster', () => {
  it('holds exactly four governments', () => {
    expect(HI_COUNTIES).toHaveLength(4);
    expect(HI_COUNTIES.map((c) => c.key).sort()).toEqual(['hawaii', 'honolulu', 'kauai', 'maui']);
  });

  // ⚠⚠ Kalawao County (pop 81) is administered by the STATE Department of
  // Health, not by a county government, and files nothing at FAC. It is a
  // census county-equivalent that is not a government — the same class as
  // Alaska's 11 census areas. Creating it would MINT A GOVERNMENT THAT DOES
  // NOT EXIST.
  it('does not contain Kalawao', () => {
    expect(JSON.stringify(HI_COUNTIES)).not.toMatch(/kalawao/i);
    expect(JSON.stringify(FAC_ROSTER)).not.toMatch(/kalawao/i);
  });

  // ⚠⚠⚠ 299 Hawaii auditees file at FAC and only FOUR are general-purpose
  // local governments. `Department of Water, County of Kauai` (EIN 472810526)
  // is a COMPONENT UNIT of Kauai with its own EIN and its own filings — the
  // exact lookalike the Alaska loader had to exclude. Key on EIN, never name.
  it('keys on the four government EINs only', () => {
    expect(HI_COUNTIES.map((c) => c.ein).sort())
      .toEqual(['996000567', '996000618', '996000658', '996001257']);
    expect(JSON.stringify(FAC_ROSTER)).not.toContain('472810526');
  });

  // ⚠⚠⚠ Honolulu is a CONSOLIDATED CITY AND COUNTY. Alaska's census typing
  // rule (no SUMLEV 162 row => county) is an ALASKA rule and would type it
  // `county`. TT's own precedent governs: San Francisco, Philadelphia and
  // Nashville-Davidson are all `city` with county_id null.
  it('types Honolulu city and the other three county', () => {
    expect(countyByKey('honolulu').entityType).toBe('city');
    for (const k of ['hawaii', 'maui', 'kauai']) {
      expect(countyByKey(k).entityType).toBe('county');
    }
  });

  // Measured LIVE 2026-10-29 against api.fac.gov: Hawaii County and Kaua'i
  // have NOT filed FY2025, and nobody has filed FY2026. The roster is 38.
  it('spans 38 filings, with two counties stopping at FY2024', () => {
    expect(fysFor('honolulu')).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(fysFor('maui')).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(fysFor('hawaii').at(-1)).toBe(2024);
    expect(fysFor('kauai').at(-1)).toBe(2024);
    expect(HI_COUNTIES.reduce((n, c) => n + fysFor(c.key).length, 0)).toBe(38);
  });

  // ⚠⚠⚠ FAC answers its PDF endpoint with a 302 to a PRESIGNED S3 object
  // carrying `X-Amz-Expires=30` — thirty SECONDS. 253 Alaska rows shipped
  // that redirect target as their `source_url`, dead before the load writing
  // it had finished, with every other gate green.
  it('builds every document URL from the citable FAC endpoint', () => {
    for (const c of HI_COUNTIES) {
      for (const fy of fysFor(c.key)) {
        const u = documentUrlFor(c.key, fy);
        expect(u.startsWith(FAC_PDF_BASE)).toBe(true);
        expect(() => assertCitable(u)).not.toThrow();
      }
    }
  });

  it('returns null for a fiscal year the county did not file', () => {
    expect(documentUrlFor('hawaii', 2025)).toBeNull();
    expect(documentUrlFor('kauai', 2025)).toBeNull();
    expect(documentUrlFor('honolulu', 2025)).not.toBeNull();
  });

  it('carries the 2024 census populations and county GEOIDs', () => {
    expect(countyByKey('honolulu')).toMatchObject({ population: 998747, geoid: '15003' });
    expect(countyByKey('hawaii')).toMatchObject({ population: 209790, geoid: '15001' });
    expect(countyByKey('maui')).toMatchObject({ population: 163688, geoid: '15009' });
    expect(countyByKey('kauai')).toMatchObject({ population: 73840, geoid: '15007' });
  });

  it('names each county as TT will store it', () => {
    expect(countyByKey('honolulu').name).toBe('Honolulu');
    expect(countyByKey('hawaii').name).toBe('Hawaii County');
    expect(countyByKey('maui').name).toBe('Maui County');
    expect(countyByKey('kauai').name).toBe('Kauai County');
  });
});
