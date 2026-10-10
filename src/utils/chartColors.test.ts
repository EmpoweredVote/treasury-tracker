import { describe, it, expect } from 'vitest';
import { getCategoryColor, DATA_VIZ_HUES } from './chartColors';

/**
 * ⚠ These tests replaced the `shadeWithinBranch` suite, retired 2026-10-10.
 *
 * That function let a drilled level inherit its ROOT's hue and separate its
 * children by lightness (G3, UAT 2026-08-22). It worked for the case it was
 * written for — Modesto's 36 job titles — and failed the general one: New York
 * City FY2002 drew twelve `Current Operations` functions as twelve teals while
 * the twelve CARDS under them drew in twelve different hues. One list, two
 * palettes, reported 2026-10-10.
 *
 * The rule now is the CARDS' rule, everywhere: colour by position in the level.
 * What has to hold is that `getCategoryColor` still separates neighbours over a
 * long level, because that is the whole of what the lightness steps were for.
 */
describe('getCategoryColor', () => {
  it('holds the palette the rest of the product is drawn from', () => {
    expect(getCategoryColor(0)).toBe('var(--color-data-teal-500)');
    expect(getCategoryColor(4)).toBe('var(--color-data-sage-500)');
  });

  it('gives ADJACENT positions different fills', () => {
    // The defect `shadeWithinBranch` was written for, restated against the
    // mechanism that replaced it: a long level must never be one flat block.
    const fills = Array.from({ length: 36 }, (_, i) => getCategoryColor(i));
    for (let i = 1; i < fills.length; i++) {
      expect(fills[i]).not.toBe(fills[i - 1]);
    }
  });

  it('separates neighbours by HUE, not by lightness', () => {
    // Stronger than the rule it replaced, and the reason the retirement is safe:
    // consecutive segments differ in the hue token itself.
    expect(getCategoryColor(0)).not.toBe(getCategoryColor(1));
    expect(getCategoryColor(0)).toContain('teal');
    expect(getCategoryColor(1)).toContain('coral');
  });

  it('cycles rather than running out of colours on a long level', () => {
    const n = DATA_VIZ_HUES.length;
    expect(getCategoryColor(n)).toBe(getCategoryColor(0));
    expect(getCategoryColor(n + 2)).toBe(getCategoryColor(2));
  });

  it('colours the icicle and the cards identically for the same position', () => {
    // ⚠⚠ THE INVARIANT THE 2026-10-10 FIX EXISTS TO CREATE. `CategoryList`
    // builds its fill as `var(--color-data-${DATA_VIZ_HUES[i % n]}-500)` inline;
    // `BudgetIcicle` calls `getCategoryColor(i)`. If those two ever drift, the
    // Nth bar and the Nth card stop matching and nothing else would catch it.
    for (let i = 0; i < 25; i++) {
      const asCardListBuildsIt = `var(--color-data-${DATA_VIZ_HUES[i % DATA_VIZ_HUES.length]}-500)`;
      expect(getCategoryColor(i)).toBe(asCardListBuildsIt);
    }
  });
});
