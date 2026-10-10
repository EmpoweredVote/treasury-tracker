/**
 * Real Manrope advance widths, measured — not estimated.
 *
 * ── ⚠⚠ WHAT THE GUESS ACTUALLY GOT WRONG ───────────────────────────────────
 *
 * Two chart label rules sized text at 0.55em per letter and 0.60em per digit.
 * Measured against the real font over the product's OWN labels, `0.55 x length`
 * misses by -2.8% to +21%, mean +9.1%:
 *
 *     Housing                       -2.8%   (short, wide letters)
 *     General Government            -0.4%
 *     Education                     +1.9%
 *     Environmental protection      +7.6%
 *     Libraries                    +19.5%   (i, r, a, e are all narrow)
 *     Parks, recreation and ...    +20.5%
 *     Public safety and judicial   +21.0%   (five spaces at 0.2em each)
 *
 * ⚠ So it ran WIDE on names, not narrow: real labels are full of spaces
 * (0.2em) and thin letters ('i' and 'l' are 0.265em), and a flat average
 * cannot see either. Names were therefore truncated MORE than they needed to
 * be, losing up to a fifth of their visible text for nothing.
 *
 * ⚠⚠ AND NARROW ON MONEY, which is the dangerous direction. Digits are 0.642em
 * and '$' is 0.615em against the 0.60 assumed, so the icicle's label floor —
 * which is set by the widest money string — sat about 5px too LOW. A floor
 * that is too low clips a label a reader is trying to read.
 *
 * ⚠ The deeper error was counting characters at all. 'l' is 0.265em and 'W' is
 * 0.963em, so "Libraries" and "Wastewater" are the same length and nowhere
 * near the same width.
 *
 * ⚠ Numbers are advance widths in 1/1000 em, from `getComputedTextLength()` on
 * an SVG <text> at 200px — the same layout path the sunburst's labels use, not
 * canvas `measureText`, which did not pick up the webfont and silently
 * returned system-fallback metrics.
 *
 * ⚠ Only weights 500 and 600 are here, because only those are used for chart
 * labels (`.segment-name` 600, `.segment-amount` 500, sunburst arcs 600).
 *
 * ⚠⚠ MANROPE'S DIGITS ARE NOT TABULAR BY DEFAULT: '1' is 0.422em against
 * '0' at 0.642em. Any rule that assumed one digit width was wrong by up
 * to a third on a figure like `$1,111,111`.
 *
 * ── REGENERATING ────────────────────────────────────────────────────────────
 *
 * Measured 2026-10-10 against Manrope as Google Fonts serves it. If the font,
 * its version, or the weights in use change, re-measure — do not hand-edit.
 * The procedure is recorded in `manrope_metrics_measurement` in memory: load
 * the page, force every weight with `document.fonts.load(w + 'px Manrope', chars)`,
 * then measure each glyph via `getComputedTextLength()`.
 *
 * ⚠ Verify any re-measurement PER CHARACTER against a known different font.
 * Manrope and Arial are 0.08% apart on total width for a 31-character probe,
 * so a total-width check cannot tell them apart and will accept fallback
 * metrics as real ones.
 */

/** Every character measured, in the same order as the width tables. */
const CHARS = "0123456789 !\"#$%&'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~…–—’éñáíóúü°";

/** Advance widths in 1/1000 em, indexed to CHARS. */
const ADVANCE: Record<500 | 600, readonly number[]> = {
  500: [626,406,579,563,596,581,621,513,591,621,200,329,417,924,602,901,657,229,435,435,446,575,278,420,270,403,314,318,622,750,622,534,907,646,619,723,681,575,510,714,697,249,476,612,518,846,696,732,616,732,641,630,600,708,616,949,623,575,631,413,403,413,673,660,506,563,600,561,601,591,363,600,605,249,263,510,249,865,605,601,600,601,374,531,412,605,523,779,536,538,531,430,269,430,680,658,540,780,243,591,605,563,249,601,605,605,450],
  600: [642,422,587,572,603,584,622,523,602,622,200,345,442,928,615,901,663,245,444,444,456,574,291,420,287,418,328,331,630,750,630,544,911,659,625,731,691,580,517,723,710,265,489,630,526,851,707,741,627,741,651,644,604,714,629,963,639,593,647,418,418,418,677,660,523,570,608,569,609,597,371,608,615,265,276,524,265,882,615,610,608,609,387,536,423,615,538,791,545,549,533,439,285,439,698,684,540,780,264,597,615,570,265,610,615,615,450],
};

export type LabelWeight = 500 | 600;

const INDEX = new Map<string, number>();
for (let i = 0; i < CHARS.length; i++) INDEX.set(CHARS[i], i);

/**
 * Fallback for a character that was not measured — a CJK name, an unusual
 * symbol. Deliberately the widest letter rather than the mean, so an unmeasured
 * string is over-estimated and a label is hidden rather than clipped.
 */
const UNMEASURED = 963 / 1000;

/** Width of `text` in em at the given weight. */
export function measureEm(text: string, weight: LabelWeight = 600): number {
  const table = ADVANCE[weight];
  let total = 0;
  for (const ch of text) {
    const i = INDEX.get(ch);
    total += i === undefined ? UNMEASURED : table[i] / 1000;
  }
  return total;
}

/**
 * Width of `text` in CSS pixels at `fontSizePx`.
 *
 * ⚠ Summing per-character advances ignores kerning, so this over-estimates a
 * real rendered string by about 0.4% on average and 1.2% at worst (measured
 * across the product's own labels; the worst case is `$1,234,567`). That sign
 * is deliberate and must stay: over-estimating hides a label that would just
 * have fitted, under-estimating clips one a reader is trying to read.
 */
export function measureTextPx(text: string, fontSizePx: number, weight: LabelWeight = 600): number {
  return measureEm(text, weight) * fontSizePx;
}

/**
 * The longest prefix of `text` that fits `maxPx`, with an ellipsis appended
 * when anything was dropped — or null when not even `minChars` fit.
 *
 * ⚠ The ellipsis is measured too. It is 0.684em in Manrope, well over a
 * character's worth, so budgeting for it by assuming one more glyph would
 * under-count and push the text past its box.
 */
export function ellipsiseToPx(
  text: string,
  maxPx: number,
  fontSizePx: number,
  weight: LabelWeight = 600,
  minChars = 5,
): string | null {
  if (!text || !(maxPx > 0) || !(fontSizePx > 0)) return null;
  if (measureTextPx(text, fontSizePx, weight) <= maxPx) return text;

  const chars = [...text];
  const ellipsisPx = measureTextPx('…', fontSizePx, weight);
  let used = 0;
  let kept = 0;
  for (const ch of chars) {
    const next = used + measureTextPx(ch, fontSizePx, weight);
    if (next + ellipsisPx > maxPx) break;
    used = next;
    kept++;
  }
  if (kept < minChars) return null;
  return chars.slice(0, kept).join('').trimEnd() + '…';
}
