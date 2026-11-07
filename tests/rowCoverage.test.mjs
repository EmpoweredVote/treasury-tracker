import { describe, it, expect } from 'vitest';
import { classifyCoverage, coverageKey, isClean } from '../scripts/lib/rowCoverage.mjs';

const obs = (source, fiscalYear, stored, published) => ({ source, fiscalYear, stored, published });
const reg = (source, fiscalYear, rows) => ({ source, fiscalYear, rows });

describe('coverageKey', () => {
  it('is case- and whitespace-insensitive on the source name', () => {
    expect(coverageKey({ source: '  LA City Checkbook ', fiscalYear: 2025 }))
      .toBe(coverageKey({ source: 'la city checkbook', fiscalYear: 2025 }));
  });

  it('accepts either spelling of the year field', () => {
    expect(coverageKey({ source: 'x', fiscal_year: 2024 }))
      .toBe(coverageKey({ source: 'x', fiscalYear: 2024 }));
  });

  it('separates years of the same source', () => {
    expect(coverageKey({ source: 'x', fiscalYear: 2024 }))
      .not.toBe(coverageKey({ source: 'x', fiscalYear: 2025 }));
  });
});

describe('classifyCoverage', () => {
  it('is clean when stored, published and the baseline all agree', () => {
    const r = classifyCoverage([obs('A', 2025, 100, 100)], [reg('A', 2025, 100)]);
    expect(isClean(r)).toBe(true);
    expect(r.ok).toHaveLength(1);
    expect(r.baselineMoved).toHaveLength(0);
  });

  /** The defect itself: 22 rows kept of 24,123 published. */
  it('fails the real West Hollywood collapse as a shortfall', () => {
    const r = classifyCoverage(
      [obs('WeHo FY2018-19', 2019, 22, 24123)], [reg('WeHo FY2018-19', 2019, 24123)],
    );
    expect(r.shortfall).toHaveLength(1);
    expect(r.shortfall[0].missing).toBe(24101);
    expect(isClean(r)).toBe(false);
  });

  it('fails the real LA City FY2025 shortfall', () => {
    const r = classifyCoverage(
      [obs('LA City Checkbook', 2025, 226909, 749295)], [reg('LA City Checkbook', 2025, 749295)],
    );
    expect(r.shortfall[0].missing).toBe(522386);
    expect(isClean(r)).toBe(false);
  });

  /**
   * ⚠ A wholesale dataset replace re-mints every Socrata `:id`, so the next
   * sync inserts everything a second time. That reads as surplus.
   */
  it('fails duplication, not only loss', () => {
    const r = classifyCoverage([obs('A', 2025, 200, 100)], [reg('A', 2025, 100)]);
    expect(r.surplus).toHaveLength(1);
    expect(r.surplus[0].extra).toBe(100);
    expect(isClean(r)).toBe(false);
  });

  /**
   * ⚠⚠ THE WHOLE POINT OF THE REDESIGN. LA City appends rows weekly. When TT
   * keeps up, nothing is wrong — an exact-count registry would have failed
   * this every week and trained everyone to ignore the gate.
   */
  it('does NOT fail when TT kept up with a publisher that grew', () => {
    const r = classifyCoverage([obs('A', 2025, 140, 140)], [reg('A', 2025, 100)]);
    expect(isClean(r)).toBe(true);
    expect(r.baselineMoved).toHaveLength(1);
    expect(r.baselineMoved[0].baseline).toBe(100);
    expect(r.baselineMoved[0].now).toBe(140);
  });

  it('still fails when the publisher grew and TT did NOT keep up', () => {
    const r = classifyCoverage([obs('A', 2025, 100, 140)], [reg('A', 2025, 100)]);
    expect(r.shortfall).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  it('fails an undeclared budget rather than passing it silently', () => {
    const r = classifyCoverage([obs('New', 2026, 10, 10)], []);
    expect(r.undeclared).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  it('fails a registry entry whose budget has gone', () => {
    const r = classifyCoverage([], [reg('Gone', 2019, 5)]);
    expect(r.stale).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  it('fails duplicate registry keys instead of letting one shadow the other', () => {
    const r = classifyCoverage(
      [obs('A', 2025, 100, 100)], [reg('A', 2025, 100), reg('a', 2025, 999)],
    );
    expect(r.duplicates).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  /**
   * ⚠⚠ An unreachable publisher must NOT read as agreement. "We could not
   * look" and "we looked and it matched" are the distinction this gate exists
   * to preserve.
   */
  it('reports an unreachable publisher separately from a match', () => {
    for (const bad of [null, undefined, NaN]) {
      const r = classifyCoverage([obs('A', 2025, 100, bad)], [reg('A', 2025, 100)]);
      expect(r.unreachable).toHaveLength(1);
      expect(r.ok).toHaveLength(0);
      expect(isClean(r)).toBe(false);
    }
  });

  it('compares numbers, not strings', () => {
    const r = classifyCoverage([obs('A', 2025, '100', '100')], [reg('A', 2025, 100)]);
    expect(isClean(r)).toBe(true);
  });
});
