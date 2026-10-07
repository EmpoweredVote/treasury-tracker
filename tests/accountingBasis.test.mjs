import { describe, it, expect } from 'vitest';
import { isComparablePair } from '../scripts/lib/fundScope.mjs';

const row = (scope, accountingBasis) => ({ scope, accountingBasis });

describe('isComparablePair', () => {
  it('REFUSES a proven mismatch — GAAP against cash', () => {
    // Duvall vs Redmond: two King County cities, two measurements. This is the
    // whole reason the axis exists.
    expect(isComparablePair(row('general_fund', 'gaap'), row('general_fund', 'cash'))).toBe(false);
  });

  it('REFUSES modified cash against GAAP — Brown County SD vs Aberdeen SD', () => {
    // Twelve miles apart, audited in the same town, measured differently.
    expect(isComparablePair(row('general_fund', 'modified_cash'), row('general_fund', 'gaap'))).toBe(false);
  });

  it('REFUSES cash against modified cash — they are different bases', () => {
    // Not "both non-GAAP, therefore comparable". Cash and modified cash are
    // two different measurements and merging them would be the same error one
    // level down.
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'modified_cash'))).toBe(false);
  });

  it('ALLOWS two figures on the same known basis', () => {
    expect(isComparablePair(row('general_fund', 'gaap'), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'cash'))).toBe(true);
  });

  // ⚠⚠ THE LOAD-BEARING CASE. The column starts 100% `unknown` and will stay
  // mostly unknown for a long time — `audit_grade` is 68% unknown today. A rule
  // phrased "comparable only if both are known and equal" is defensible in the
  // abstract and catastrophic in practice: it would switch off cross-entity
  // comparison across nearly the whole site on the day it shipped.
  it('ALLOWS when either side is unknown — absence never blocks', () => {
    expect(isComparablePair(row('general_fund', 'unknown'), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'unknown'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'unknown'), row('general_fund', 'unknown'))).toBe(true);
  });

  it('ALLOWS when the basis is missing entirely — a caller that knows nothing', () => {
    expect(isComparablePair(row('general_fund', null), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', undefined), row('general_fund', 'cash'))).toBe(true);
    expect(isComparablePair(row('general_fund', ''), row('general_fund', 'cash'))).toBe(true);
  });

  it('still refuses on a non-comparable SCOPE, independently of basis', () => {
    // The two axes compose; neither excuses the other.
    expect(isComparablePair(row('unknown', 'gaap'), row('unknown', 'gaap'))).toBe(false);
    expect(isComparablePair(row('unknown', 'gaap'), row('general_fund', 'gaap'))).toBe(false);
  });

  it('refuses a malformed argument rather than treating it as comparable', () => {
    expect(isComparablePair(null, row('general_fund', 'gaap'))).toBe(false);
    expect(isComparablePair(undefined, undefined)).toBe(false);
  });
});
