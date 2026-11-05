/**
 * classifyOutOfPeriod — the registry guard, in both directions.
 *
 * ⚠ The interesting tests here are the FAILURE ones. A gate like this is easy
 * to write so that it only catches new defects, and then it silently rots as
 * the registry drifts away from the data.
 */
import { describe, it, expect } from 'vitest';
import { classifyOutOfPeriod, isClean, periodKey } from '../scripts/lib/outOfPeriodRows.mjs';
import { OUT_OF_PERIOD_EXCEPTIONS } from '../scripts/data/outOfPeriodExceptions.mjs';

const hit = (municipality, state, fiscal_year, out_rows) =>
  ({ municipality, state, fiscal_year, out_rows });
const exc = (municipality, state, fiscalYear, outRows) =>
  ({ key: `${municipality}-${fiscalYear}`, municipality, state, fiscalYear, outRows });

describe('periodKey', () => {
  it('is insensitive to case and surrounding space', () => {
    expect(periodKey({ municipality: '  Frisco ', state: 'tx', fiscalYear: 2019 }))
      .toBe(periodKey({ municipality: 'FRISCO', state: 'TX', fiscal_year: 2019 }));
  });

  it('separates two cities of the same name in different states', () => {
    expect(periodKey({ municipality: 'Bloomington', state: 'IN', fiscalYear: 2020 }))
      .not.toBe(periodKey({ municipality: 'Bloomington', state: 'MN', fiscalYear: 2020 }));
  });

  it('separates two years of the same city', () => {
    expect(periodKey({ municipality: 'Frisco', state: 'TX', fiscalYear: 2019 }))
      .not.toBe(periodKey({ municipality: 'Frisco', state: 'TX', fiscalYear: 2020 }));
  });
});

describe('classifyOutOfPeriod', () => {
  it('declares a hit that matches its entry exactly', () => {
    const r = classifyOutOfPeriod([hit('Frisco', 'TX', 2019, 1)], [exc('Frisco', 'TX', 2019, 1)]);
    expect(r.declared).toHaveLength(1);
    expect(isClean(r)).toBe(true);
  });

  it('FAILS a hit nobody wrote down', () => {
    const r = classifyOutOfPeriod([hit('Plano', 'TX', 2022, 3)], []);
    expect(r.undeclared).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  /**
   * ⚠⚠ The quiet case. The budget is already tolerated, so a naive gate that
   * only asks "is this budget in the registry?" passes — and a brand-new
   * defect inherits an old one's permission slip.
   */
  it('FAILS when a declared budget gains a row', () => {
    const r = classifyOutOfPeriod([hit('Frisco', 'TX', 2019, 2)], [exc('Frisco', 'TX', 2019, 1)]);
    expect(r.declared).toHaveLength(0);
    expect(r.mismatched).toHaveLength(1);
    expect(r.mismatched[0]).toMatchObject({ expected: 1, actual: 2 });
    expect(isClean(r)).toBe(false);
  });

  it('FAILS when a declared budget LOSES a row, too', () => {
    const r = classifyOutOfPeriod([hit('Frisco', 'TX', 2019, 1)], [exc('Frisco', 'TX', 2019, 2)]);
    expect(r.mismatched).toHaveLength(1);
    expect(r.mismatched[0]).toMatchObject({ expected: 2, actual: 1 });
    expect(isClean(r)).toBe(false);
  });

  /**
   * ⚠⚠ The rot case. A reload fixes the defect, the entry stays, and the
   * registry starts describing a TT that no longer exists.
   */
  it('FAILS a registry entry that matches nothing at all', () => {
    const r = classifyOutOfPeriod([], [exc('Frisco', 'TX', 2019, 1)]);
    expect(r.stale).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  it('FAILS two entries claiming the same budget', () => {
    const r = classifyOutOfPeriod(
      [hit('Frisco', 'TX', 2019, 1)],
      [exc('Frisco', 'TX', 2019, 1), exc('Frisco', 'TX', 2019, 5)],
    );
    expect(r.duplicates).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  it('is clean on an empty fleet with an empty registry', () => {
    expect(isClean(classifyOutOfPeriod([], []))).toBe(true);
  });

  it('sorts a mixed fleet into every bucket at once', () => {
    const r = classifyOutOfPeriod(
      [hit('Frisco', 'TX', 2019, 1), hit('Plano', 'TX', 2022, 3), hit('McKinney', 'TX', 2024, 9)],
      [exc('Frisco', 'TX', 2019, 1), exc('McKinney', 'TX', 2024, 4), exc('Gone', 'TX', 2001, 1)],
    );
    expect(r.declared.map((d) => d.hit.municipality)).toEqual(['Frisco']);
    expect(r.undeclared.map((h) => h.municipality)).toEqual(['Plano']);
    expect(r.mismatched.map((m) => m.hit.municipality)).toEqual(['McKinney']);
    expect(r.stale.map((e) => e.municipality)).toEqual(['Gone']);
  });

  it('accepts the status function’s own out_rows spelling', () => {
    // The SQL function returns `out_rows`; a hand-built object may use outRows.
    const r = classifyOutOfPeriod([{ municipality: 'F', state: 'TX', fiscal_year: 2019, outRows: 1 }],
      [exc('F', 'TX', 2019, 1)]);
    expect(r.declared).toHaveLength(1);
  });
});

describe('the registry as shipped', () => {
  it('has a unique key per entry', () => {
    const keys = OUT_OF_PERIOD_EXCEPTIONS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('claims each budget at most once', () => {
    const r = classifyOutOfPeriod([], OUT_OF_PERIOD_EXCEPTIONS);
    expect(r.duplicates).toEqual([]);
  });

  it('gives every entry a positive expected row count', () => {
    for (const e of OUT_OF_PERIOD_EXCEPTIONS) {
      expect(Number.isInteger(e.outRows), `${e.key} outRows`).toBe(true);
      expect(e.outRows, `${e.key} outRows`).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠ An entry without a stated corroboration level is how an unverified
   * measurement starts reading like a finding.
   */
  it('states a corroboration level and a reason on every entry', () => {
    for (const e of OUT_OF_PERIOD_EXCEPTIONS) {
      expect(String(e.corroboration ?? ''), `${e.key} corroboration`).not.toBe('');
      expect(String(e.whyNotCorrected ?? ''), `${e.key} whyNotCorrected`).not.toBe('');
      expect(String(e.what ?? ''), `${e.key} what`).not.toBe('');
    }
  });

  it('keeps every entry out of reader-facing territory', () => {
    // None of these are corroborated to the figureFlags.ts bar yet.
    for (const e of OUT_OF_PERIOD_EXCEPTIONS) {
      expect(['loaded-as-published', 'accepted-pending-investigation'])
        .toContain(e.disposition);
    }
  });
});
