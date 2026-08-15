import { describe, it, expect } from 'vitest';
import {
  checkPerCapita, dataSourceLabel, buildFilenameRegex, makeExtractorSelector,
} from '../scripts/lib/waSaoLoad.mjs';

describe('checkPerCapita', () => {
  // Kitsap FY2024 GF operating: $128,230,878 / 288,900 = $443.9/resident.
  // Seattle's [500, 25000] band would REJECT this correct load; the
  // re-derived [100, 10000] band must PASS it.
  const KITSAP_BAND = [100, 10000];

  it('passes a genuine Kitsap-scale total ($443.9/resident) against [100, 10000]', () => {
    const total = 128_230_878;
    const population = 288_900;
    const perCapita = checkPerCapita(total, population, KITSAP_BAND, 2024, 'operating');
    expect(perCapita).toBeCloseTo(443.9, 1);
  });

  it('passes a genuine Bainbridge-scale total ($814.8/resident) against [100, 10000]', () => {
    const total = 20_801_297;
    const population = 25_530;
    const perCapita = checkPerCapita(total, population, KITSAP_BAND, 2025, 'operating');
    expect(perCapita).toBeCloseTo(814.8, 1);
  });

  it('rejects a missing x1000 (Kitsap total wrongly left in thousands)', () => {
    const total = 128_230.878; // what a stray /1000 would produce
    const population = 288_900;
    expect(() => checkPerCapita(total, population, KITSAP_BAND, 2024, 'operating'))
      .toThrow(/outside the plausible band \[100, 10000\]/);
  });

  it('rejects a spurious x1000 (Kitsap total wrongly multiplied)', () => {
    const total = 128_230_878 * 1000;
    const population = 288_900;
    expect(() => checkPerCapita(total, population, KITSAP_BAND, 2024, 'operating'))
      .toThrow(/units error/);
  });

  it('would have REJECTED Kitsap under Seattle\'s [500, 25000] band -- the trap this task warns about', () => {
    const total = 128_230_878;
    const population = 288_900;
    expect(() => checkPerCapita(total, population, [500, 25000], 2024, 'operating'))
      .toThrow(/outside the plausible band \[500, 25000\]/);
  });

  it('names the exact band it used in the error message', () => {
    expect(() => checkPerCapita(1, 1_000_000, [100, 10000], 2020, 'revenue'))
      .toThrow('FY2020 revenue: $0.00/resident is outside the plausible band [100, 10000]. Total=$1, pop=1000000. This is almost certainly a units error -- check the extractor\'s units setting.');
  });
});

describe('dataSourceLabel', () => {
  it('builds the exact operating (expenditure) label', () => {
    expect(dataSourceLabel('Bainbridge Island', 2025, 'operating')).toBe(
      'WA State Auditor — Bainbridge Island Annual Financial Report FY2025 (General Fund, Expenditure by Function)'
    );
  });
  it('builds the exact revenue label', () => {
    expect(dataSourceLabel('Kitsap County', 2024, 'revenue')).toBe(
      'WA State Auditor — Kitsap County Annual Financial Report FY2024 (General Fund, Revenue by Source)'
    );
  });
});

describe('buildFilenameRegex', () => {
  it('matches the expected Bainbridge filename and captures the year', () => {
    const re = buildFilenameRegex('bainbridge');
    const m = 'bainbridge-2025-acfr.pdf'.match(re);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('2025');
  });
  it('matches the expected Kitsap filename and captures the year', () => {
    const re = buildFilenameRegex('kitsap');
    const m = 'kitsap-2004-acfr.pdf'.match(re);
    expect(m).not.toBeNull();
    expect(m[1]).toBe('2004');
  });
  it('is case-insensitive', () => {
    const re = buildFilenameRegex('bainbridge');
    expect(re.test('Bainbridge-2025-ACFR.PDF')).toBe(true);
  });
  it('does not match a different entity\'s prefix', () => {
    const re = buildFilenameRegex('bainbridge');
    expect(re.test('kitsap-2024-acfr.pdf')).toBe(false);
  });
  it('does not match without the -acfr suffix', () => {
    const re = buildFilenameRegex('kitsap');
    expect(re.test('kitsap-2024.pdf')).toBe(false);
  });
});

describe('makeExtractorSelector', () => {
  it('reproduces the real Bainbridge era split: early years to extractBainbridgeEarly.py, the rest to extractBainbridge.py', () => {
    const selector = makeExtractorSelector('extractBainbridge.py', {
      2004: 'extractBainbridgeEarly.py',
      2005: 'extractBainbridgeEarly.py',
      2007: 'extractBainbridgeEarly.py',
      2008: 'extractBainbridgeEarly.py',
    });
    expect(selector(2004)).toBe('extractBainbridgeEarly.py');
    expect(selector(2005)).toBe('extractBainbridgeEarly.py');
    expect(selector(2007)).toBe('extractBainbridgeEarly.py');
    expect(selector(2008)).toBe('extractBainbridgeEarly.py');
    expect(selector(2010)).toBe('extractBainbridge.py');
    expect(selector(2025)).toBe('extractBainbridge.py');
    // FY2006 and FY2009 are excluded upstream (never in fiscalYears), but the
    // selector itself has no opinion on years outside its overrides map --
    // it just falls through to the default, which is correct behaviour for
    // any year the caller does pass in.
    expect(selector(2006)).toBe('extractBainbridge.py');
  });

  it('reproduces Kitsap: one extractor for the whole window, no overrides needed', () => {
    const selector = makeExtractorSelector('extractKitsap.py');
    expect(selector(2004)).toBe('extractKitsap.py');
    expect(selector(2020)).toBe('extractKitsap.py');
    expect(selector(2024)).toBe('extractKitsap.py');
  });
});
