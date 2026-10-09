import { describe, it, expect } from 'vitest';
import {
  NYC_FYS, NYC_ACFR_BASE, nycAcfrFilename, nycAcfrUrl,
} from '../scripts/lib/nycAcfrSources.mjs';

describe('NYC ACFR source map', () => {
  it('covers FY2002-FY2025 and nothing else', () => {
    expect(NYC_FYS).toHaveLength(24);
    expect(NYC_FYS[0]).toBe(2002);
    expect(NYC_FYS.at(-1)).toBe(2025);
  });

  it('uses lowercase cafr for FY2002-FY2011', () => {
    expect(nycAcfrFilename(2002)).toBe('cafr2002.pdf');
    expect(nycAcfrFilename(2011)).toBe('cafr2011.pdf');
  });

  it('uses uppercase CAFR for FY2012-FY2020', () => {
    expect(nycAcfrFilename(2012)).toBe('CAFR2012.pdf');
    expect(nycAcfrFilename(2020)).toBe('CAFR2020.pdf');
  });

  it('uses ACFR- for FY2021-FY2024', () => {
    expect(nycAcfrFilename(2021)).toBe('ACFR-2021.pdf');
    expect(nycAcfrFilename(2024)).toBe('ACFR-2024.pdf');
  });

  // Review Focus 1.
  it('returns FY2025 from the one-off table, not the ACFR- pattern', () => {
    expect(nycAcfrFilename(2025)).toBe('ACFR-2025-7-28-2026.pdf');
  });

  // Review Focus 1 -- the load-bearing case.
  it('THROWS for a year with no known convention rather than guessing', () => {
    expect(() => nycAcfrFilename(2026)).toThrow(/look it up/i);
    expect(() => nycAcfrFilename(2001)).toThrow(/pre-GASB-34/i);
  });

  it('builds a full URL on the comptroller host', () => {
    expect(nycAcfrUrl(2024)).toBe(`${NYC_ACFR_BASE}ACFR-2024.pdf`);
  });
});
