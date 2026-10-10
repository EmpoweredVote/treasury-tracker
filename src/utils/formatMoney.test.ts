import { describe, it, expect } from 'vitest';
import { formatMoneyCompact, formatMoneyExact } from './formatMoney';

/**
 * ⚠ The defect this was written against, stated as a case: New York City FY2002
 * Education is $13,480,900,000. The icicle printed `$13.5B` and the card under
 * it printed `$13480.9M`, because only two of fourteen formatters had a
 * billions tier. One ladder now, so the two cannot disagree.
 */
describe('formatMoneyCompact', () => {
  it('abbreviates NYC Education the same way wherever it is drawn', () => {
    expect(formatMoneyCompact(13_480_900_000)).toBe('$13.5B');
  });

  it('keeps sub-billion functions in millions', () => {
    // City University $428.5M must NOT become `$0.4B` — the ladder steps at a
    // billion, so the figure a reader can still read stays readable.
    expect(formatMoneyCompact(428_500_000)).toBe('$428.5M');
    expect(formatMoneyCompact(999_900_000)).toBe('$999.9M');
  });

  it('steps exactly at each boundary', () => {
    expect(formatMoneyCompact(999)).toBe('$999');
    expect(formatMoneyCompact(1_000)).toBe('$1K');
    expect(formatMoneyCompact(999_999)).toBe('$1000K');
    expect(formatMoneyCompact(1_000_000)).toBe('$1.0M');
    expect(formatMoneyCompact(1_000_000_000)).toBe('$1.0B');
  });

  it('abbreviates NEGATIVE amounts instead of printing them in full', () => {
    // ⚠⚠ The bug every copy shared: `amount >= 1_000_000` is false for a
    // negative, so a federal offsetting-receipt row fell through to
    // `-$2,400,000,000` inside a chart segment sized for `-$2.4B`.
    expect(formatMoneyCompact(-2_400_000_000)).toBe('-$2.4B');
    expect(formatMoneyCompact(-5_500_000)).toBe('-$5.5M');
    expect(formatMoneyCompact(-2_000)).toBe('-$2K');
  });

  it('prints small and zero amounts in full', () => {
    expect(formatMoneyCompact(0)).toBe('$0');
    expect(formatMoneyCompact(912)).toBe('$912');
    expect(formatMoneyCompact(-912)).toBe('-$912');
  });

  it('does not render NaN or Infinity at a reader', () => {
    expect(formatMoneyCompact(NaN)).toBe('$0');
    expect(formatMoneyCompact(Infinity)).toBe('$0');
  });
});

describe('formatMoneyExact', () => {
  it('prints whole grouped dollars', () => {
    expect(formatMoneyExact(1_234_567)).toBe('$1,234,567');
    expect(formatMoneyExact(0)).toBe('$0');
  });
});
