import { describe, it, expect } from 'vitest';

import {
  countyKey, looksLikeCountyGovernment, splitCsvLine, pdfUrlFor,
} from '../scripts/buildInCountyFacRoster.mjs';

/**
 * ── ⚠⚠ THIS NORMALISER HAS PRODUCED A PLAUSIBLE WRONG ANSWER TWICE ──────────
 *
 * Both failures reported a coverage figure that looked entirely reasonable:
 *
 *  1. It did not strip PERIODS, so `St. Joseph County` never matched FAC's
 *     `ST JOSEPH` and the county read as having filed NOTHING. It has eight.
 *  2. It did not strip a trailing `, INDIANA`, so `Marion County, Indiana` —
 *     the county whose audited ACFR this whole route was justified by — read as
 *     having filed NOTHING. It has ten.
 *
 * And the companion filter rejected every MIXED-CASE auditee name, because its
 * character class was uppercase-only. That one reported 88 of 92 counties
 * covered and FY2023 as THREE filings instead of 63.
 *
 * ⚠⚠ EVERY ONE OF THE THREE LOOKED FINE. A coverage figure measures the MATCHER
 * before it measures the publisher — so the matcher gets tests, not trust.
 */
describe('Indiana county FAC name matching', () => {
  it('matches the roster spelling to the FAC spelling', () => {
    expect(countyKey('Marion County')).toBe(countyKey('MARION COUNTY, INDIANA'));
    expect(countyKey('St. Joseph County')).toBe(countyKey('ST JOSEPH'));
    expect(countyKey('Allen County')).toBe(countyKey('Allen County'));
  });

  it('strips periods — the St. Joseph defect', () => {
    expect(countyKey('St. Joseph County')).toBe('ST JOSEPH');
    expect(countyKey('ST. JOSEPH COUNTY, INDIANA')).toBe('ST JOSEPH');
  });

  it('strips a trailing state name — the Marion defect', () => {
    expect(countyKey('Marion County, Indiana')).toBe('MARION');
    expect(countyKey('MARION COUNTY INDIANA')).toBe('MARION');
    expect(countyKey('State of Indiana, Marion County')).toBe('MARION');
  });

  it('handles the County of X form', () => {
    expect(countyKey('County of Vigo')).toBe('VIGO');
    expect(countyKey('THE COUNTY OF VIGO, INDIANA')).toBe('VIGO');
  });

  // ⚠ A county whose own name contains a word the normaliser strips would be
  // mangled. Indiana has none named "Indiana" or "County", but pin the shape.
  it('does not eat a county whose name merely resembles a stripped token', () => {
    expect(countyKey('White County')).toBe('WHITE');
    expect(countyKey('Union County')).toBe('UNION');
    expect(countyKey('LaPorte County')).toBe('LAPORTE');
    expect(countyKey('De Kalb County')).toBe('DE KALB');
  });
});

describe('Indiana county FAC government filter', () => {
  // ⚠⚠ THE CASE DEFECT. Newer GSAFAC-era rows are mixed case.
  it('accepts mixed-case auditee names', () => {
    expect(looksLikeCountyGovernment('Marion County, Indiana')).toBe(true);
    expect(looksLikeCountyGovernment('Allen County')).toBe(true);
    expect(looksLikeCountyGovernment('LAKE COUNTY')).toBe(true);
  });

  it('rejects the impostors that merely carry a county name', () => {
    for (const n of [
      'FLOYD COUNTY COMMUNITY ACTION AGENCY, INC.',
      'SCOTT COUNTY SCHOOL DISTRICT 2',
      'MONROE COUNTY COMMUNITY SCHOOL CORPORATION',
      'HEALTH AND HOSPITAL CORPORATION OF MARION COUNTY',
      'INDIANAPOLIS AIRPORT AUTHORITY',
      'HOUSING AUTHORITY OF THE CITY OF MISHAWAKA',
      'MONROE COUNTY PUBLIC LIBRARY',
    ]) {
      expect(looksLikeCountyGovernment(n), n).toBe(false);
    }
  });

  // ⚠ FAC records SC's Rock Hill FY2024 auditee_name as a PERSON. A person's
  // name passes this filter, which is exactly why the ROSTER is the authority
  // and this filter only keeps the unmatched report readable.
  it('does not pretend to be an identity check', () => {
    expect(looksLikeCountyGovernment('Drew Cooper')).toBe(true);
    expect(countyKey('Drew Cooper')).toBe('DREW COOPER'); // matches no county
  });
});

describe('Indiana county FAC csv and url helpers', () => {
  it('splits quoted fields containing commas', () => {
    expect(splitCsvLine('a,"Marion County, Indiana",IN,local'))
      .toEqual(['a', 'Marion County, Indiana', 'IN', 'local']);
  });

  it('handles escaped quotes', () => {
    expect(splitCsvLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('builds the free unauthenticated ACFR pdf url', () => {
    expect(pdfUrlFor('2025-12-GSAFAC-0000409398'))
      .toBe('https://app.fac.gov/dissemination/report/pdf/2025-12-GSAFAC-0000409398');
  });
});
