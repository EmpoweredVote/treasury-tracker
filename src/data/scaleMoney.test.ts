import { describe, it, expect } from 'vitest';
import { scaleMoney } from './scaleMoney';

/**
 * Per-capita scaling must not resurrect the $0 claim — issue #217.
 *
 * ⚠⚠ `null / divisor` IS 0 IN JAVASCRIPT. The federal per-person view divided
 * every line item by population, so a `null` approved amount — meaning "this
 * source published no adopted budget" — came out the other side as a hard 0.
 * The API fix would have been undone one layer up, silently, and only in the
 * scaled view.
 *
 * ⚠ `undefined` is preserved as `undefined` for the same reason, because
 * BudgetCategory.actualAmount is optional rather than nullable and the two
 * absences must not be flattened into each other.
 */

describe('scaleMoney', () => {
  it('divides a real figure', () => {
    expect(scaleMoney(1000, 4)).toBe(250);
  });

  it('keeps null as null rather than 0', () => {
    expect(scaleMoney(null, 4)).toBeNull();
  });

  it('keeps undefined as undefined', () => {
    expect(scaleMoney(undefined, 4)).toBeUndefined();
  });

  it('keeps a REAL zero as zero', () => {
    // ⚠ A genuinely budgeted $0 scaled per person is still $0, and must not
    // become null — the inverse of the bug would be just as wrong.
    expect(scaleMoney(0, 4)).toBe(0);
  });

  it('refuses to divide by zero rather than returning Infinity', () => {
    // A city with no recorded population would otherwise render Infinity or
    // NaN in every cell.
    expect(scaleMoney(1000, 0)).toBeNull();
  });

  it('scales a negative figure without changing its sign', () => {
    expect(scaleMoney(-800, 4)).toBe(-200);
  });
});
