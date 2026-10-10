import { describe, it, expect } from 'vitest';
import { measureEm, measureTextPx, ellipsiseToPx } from './manropeMetrics';

/**
 * ⚠ These lock the FACTS that made the old guess wrong, not the table itself —
 * a baked table can only be checked against the font by re-measuring in a
 * browser, and the procedure for that is recorded at the top of the module.
 */
describe('measureEm', () => {
  it('disagrees with 0.55em-per-character in BOTH directions, by a lot', () => {
    // ⚠⚠ THE DEFECT, as numbers, and NOT the one-directional error it first
    // looks like. Measured over the product's own labels, `0.55 * length` runs
    // WIDE on names — spaces are 0.2em and 'i' is 0.265em — and NARROW on
    // money, where digits are 0.642em. A single average cannot be right for
    // both, which is the whole argument for a table.
    const est = (s: string) => s.length * 0.55;

    const wide = 'Public safety and judicial';          // five spaces
    expect(est(wide) / measureEm(wide, 600)).toBeGreaterThan(1.15);

    const narrow = 'Housing';                            // short, round letters
    expect(est(narrow) / measureEm(narrow, 600)).toBeLessThan(1.0);

    // Money: the old 0.60 per digit under-counts, which is what let the
    // icicle's floor sit ~5px too low.
    expect(measureEm('0', 600)).toBeGreaterThan(0.60);
    expect(measureEm('$', 600)).toBeGreaterThan(0.60);
  });

  it('prices a space as a space, not as a letter', () => {
    // 0.2em against ~0.6em for a letter. Five of them in one label is most of
    // where the 21% error came from.
    expect(measureEm(' ', 600)).toBeLessThan(measureEm('n', 600) / 2);
  });

  it('does NOT give every digit the same width', () => {
    // ⚠⚠ Manrope's digits are proportional by default. A rule that assumed one
    // digit width was wrong by a third on a figure full of 1s.
    expect(measureEm('1', 600)).toBeLessThan(measureEm('0', 600));
    expect(measureEm('1', 600) / measureEm('0', 600)).toBeLessThan(0.7);
  });

  it('separates characters a character COUNT treats as equal', () => {
    // The deeper error: counting characters. 'l' and 'W' are one character
    // each and nearly four times apart in width.
    expect(measureEm('W', 600) / measureEm('l', 600)).toBeGreaterThan(3);
    expect(measureEm('llllllllll', 600)).toBeLessThan(measureEm('WWWWWWWWWW', 600) / 3);
  });

  it('prices the ellipsis properly rather than as one glyph', () => {
    // '…' is wider than most letters, so budgeting one character's worth for
    // it would push text past its box.
    expect(measureEm('…', 600)).toBeGreaterThan(measureEm('n', 600));
  });

  it('gets heavier with weight', () => {
    expect(measureEm('Education', 600)).toBeGreaterThan(measureEm('Education', 500));
  });

  it('over-estimates an unmeasured character rather than under', () => {
    // An unknown glyph must hide a label, never clip one.
    const widest = Math.max(...[...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ']
      .map((c) => measureEm(c, 600)));
    expect(measureEm('漢', 600)).toBeGreaterThanOrEqual(widest);
  });

  it('is empty for an empty string', () => {
    expect(measureEm('', 600)).toBe(0);
  });
});

describe('measureTextPx', () => {
  it('scales linearly with font size', () => {
    expect(measureTextPx('Education', 24, 600)).toBeCloseTo(measureTextPx('Education', 12, 600) * 2, 6);
  });

  it('agrees with the real rendered width to about a percent', () => {
    // ⚠ Measured in a browser 2026-10-10: `getComputedTextLength` for
    // "Education" at weight 600 is 4.8465em. Summing advances ignores kerning,
    // so this sits a little ABOVE — the safe direction.
    const summed = measureEm('Education', 600);
    expect(summed).toBeGreaterThan(4.8465);
    expect(summed).toBeLessThan(4.8465 * 1.015);
  });
});

describe('ellipsiseToPx', () => {
  const FONT = 12;

  it('returns the whole string when it fits', () => {
    const w = measureTextPx('Housing', FONT, 600);
    expect(ellipsiseToPx('Housing', w + 1, FONT, 600)).toBe('Housing');
  });

  it('truncates to something that ACTUALLY fits, ellipsis included', () => {
    // ⚠⚠ The property the old character-count rule could not hold: whatever
    // comes back must measure within the budget it was given.
    const budget = 60;
    const out = ellipsiseToPx('Environmental protection', budget, FONT, 600);
    expect(out).not.toBeNull();
    expect(out!.endsWith('…')).toBe(true);
    expect(measureTextPx(out!, FONT, 600)).toBeLessThanOrEqual(budget);
  });

  it('truncates WIDE and NARROW names to different lengths', () => {
    // Same budget, same character count, different glyphs. A count-based rule
    // returns the same number of characters for both; a measured one cannot.
    const budget = 52;
    const narrow = ellipsiseToPx('lilililililili', budget, FONT, 600);
    const wide = ellipsiseToPx('WAWAWAWAWAWAWA', budget, FONT, 600);
    expect(narrow).not.toBeNull();
    expect(narrow!.length).toBeGreaterThan((wide ?? '').length);
  });

  it('returns null rather than a stub when too little fits', () => {
    expect(ellipsiseToPx('Environmental protection', 20, FONT, 600)).toBeNull();
  });

  it('honours the minimum-character floor', () => {
    const budget = measureTextPx('Envi…', FONT, 600) + 0.5;
    expect(ellipsiseToPx('Environmental', budget, FONT, 600, 4)).toBe('Envi…');
    expect(ellipsiseToPx('Environmental', budget, FONT, 600, 8)).toBeNull();
  });

  it('does not leave a trailing space before the ellipsis', () => {
    const budget = measureTextPx('Social ', FONT, 600) + 1;
    const out = ellipsiseToPx('Social services', budget, FONT, 600, 3);
    expect(out).not.toBeNull();
    expect(out).not.toContain(' …');
  });

  it('refuses nonsense input', () => {
    expect(ellipsiseToPx('', 100, FONT, 600)).toBeNull();
    expect(ellipsiseToPx('Housing', 0, FONT, 600)).toBeNull();
    expect(ellipsiseToPx('Housing', 100, 0, 600)).toBeNull();
  });
});
