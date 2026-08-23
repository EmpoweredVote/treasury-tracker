import { describe, it, expect } from 'vitest';
import { getCategoryColor, shadeWithinBranch, BRANCH_SHADE_CYCLE } from './chartColors';

/**
 * ⚠ UAT 2026-08-22 (G3). A drilled level inherits its ROOT's colour index, on
 * purpose — a branch should read as one colour. But Modesto's salaries chart drills
 * into 36 children, so all 36 rendered in the single fill `var(--color-data-sage-500)`
 * with only 2 of them wide enough to carry a label. Chris: "the green looks odd in
 * that setup." The row read as one undifferentiated block.
 *
 * Chris's call (2026-08-23): keep the branch colour and VARY LIGHTNESS per child.
 * So the requirement is two-sided — neighbours must differ, and every step must
 * still be recognisably the branch's colour.
 */
describe('shadeWithinBranch', () => {
  const SAGE = 'var(--color-data-sage-500)';

  it('leaves the first child on the branch colour exactly', () => {
    // A single-child level, and the first segment of every level, look exactly as
    // they do today. The change is additive.
    expect(shadeWithinBranch(SAGE, 0)).toBe(SAGE);
  });

  it('gives ADJACENT children different fills', () => {
    // The defect, stated: 36 identical fills in a row.
    const fills = Array.from({ length: 6 }, (_, i) => shadeWithinBranch(SAGE, i));
    for (let i = 1; i < fills.length; i++) {
      expect(fills[i]).not.toBe(fills[i - 1]);
    }
  });

  it('keeps every step recognisably the branch colour', () => {
    // Lightness varies; hue does not. Every fill still names the same base token,
    // and the base always stays the dominant term of the mix.
    for (let i = 0; i < 12; i++) {
      const fill = shadeWithinBranch(SAGE, i);
      expect(fill).toContain(SAGE);
      const pct = Number(fill.match(/(\d+)%/)?.[1] ?? '100');
      expect(pct).toBeGreaterThanOrEqual(80);
    }
  });

  it('cycles rather than fading to nothing across a long level', () => {
    // 36 children must not mean 36 lightness steps — the far end would be
    // unreadable. The cycle repeats, so neighbours differ and nothing runs out
    // of contrast.
    expect(shadeWithinBranch(SAGE, BRANCH_SHADE_CYCLE)).toBe(shadeWithinBranch(SAGE, 0));
    expect(shadeWithinBranch(SAGE, BRANCH_SHADE_CYCLE + 2)).toBe(shadeWithinBranch(SAGE, 2));
  });

  it('mixes both lighter and darker, not only lighter', () => {
    const fills = Array.from({ length: BRANCH_SHADE_CYCLE }, (_, i) => shadeWithinBranch(SAGE, i));
    expect(fills.some((f) => f.includes('white'))).toBe(true);
    expect(fills.some((f) => f.includes('black'))).toBe(true);
  });

  it('works on a literal hex base as well as a token', () => {
    // BRAND_BAR_COLORS entries are hex (the nonprofit categories).
    expect(shadeWithinBranch('#22C55E', 1)).toContain('#22C55E');
  });

  it('does not disturb the root-level palette', () => {
    expect(getCategoryColor(0)).toBe('var(--color-data-teal-500)');
    expect(getCategoryColor(4)).toBe('var(--color-data-sage-500)');
  });
});
