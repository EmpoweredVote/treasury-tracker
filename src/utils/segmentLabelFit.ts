import { measureTextPx } from './manropeMetrics';

/**
 * Whether an icicle segment is wide enough to carry its label — IN PIXELS.
 *
 * ── ⚠⚠ WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * `BudgetIcicle` used to decide this from the segment's share of its LEVEL:
 *
 *     return width >= (isAncestor ? 6 : 8);   // "Rough heuristic"
 *
 * A percentage says nothing about how many pixels a label gets. The same rule
 * therefore made two opposite mistakes at once:
 *
 *   • HID a label that fits. New York City FY2002 `General Government` is 5.2%
 *     of `Current Operations`. On a 1350px chart that is ~70px — room for the
 *     name and `$2.4B` — and it rendered as a blank block at the far left.
 *     Reported 2026-10-10 ("there's also a sliver to the left of judicial").
 *   • SHOWED a label that does not fit. 10% of a 358px phone chart is 36px,
 *     which is under half the width `$13.5B` alone needs, so the reader got a
 *     clipped fragment.
 *
 * The threshold the component actually wanted was always a pixel one. The chart
 * is fluid, so the pixels have to be MEASURED — see `useElementWidth`.
 */

/**
 * ── HOW THE FLOORS ARE DERIVED, from `BudgetIcicle.css` and the REAL FONT ────
 *
 * `.segment-content` has `padding: 4px 8px`, so 16px of every segment is gone
 * before a glyph is drawn. What must fit in the rest:
 *
 *   CURRENT level — `.segment-name` 0.75rem (12px) weight 600 over
 *   `.segment-amount` 0.7rem (11.2px) weight 500, STACKED, so the requirement
 *   is the WIDER of the two, not their sum.
 *   ANCESTOR level — name only, 0.7rem, no amount, laid out in a row.
 *
 * ⚠⚠ THESE ARE MEASURED, NOT GUESSED. They used to be literal 64 and 48,
 * reasoned from "0.55em per letter, 0.6em per digit". The money string is what
 * sets the current-level floor, and digits are really 0.642em with '$' at
 * 0.615em — so the old floor sat about 5px TOO LOW, which is the direction
 * that clips a label rather than hiding it. It moves 64 -> 68.
 *
 * ⚠ The ancestor floor lands back on 48, unchanged, which is worth saying
 * plainly: the original judgement there was sound and the measurement agrees
 * with it. Only the number that was doing real work moved.
 *
 * ⚠ Computed from real strings at import time rather than written down, so the
 * floors cannot drift out of step with `manropeMetrics.ts` the way a copied
 * number would.
 */

/** The widest money string the compact ladder produces — see formatMoney.ts. */
const WIDEST_AMOUNT = '-$999.9M';

/**
 * A useful fragment of a name: six letters and the ellipsis the CSS adds.
 * Six real letters rather than an average, because an average is the thing
 * this whole change exists to stop relying on.
 */
const NAME_FRAGMENT = 'Genera…';

/**
 * ⚠ An ancestor asks for LESS, deliberately, and this is a judgement not a
 * measurement. That row is a compressed breadcrumb: its job is to let a reader
 * recognise where they are, not to be read. Four letters do that ("Curr…",
 * "Educ…"), and demanding the full six-letter fragment would have pushed the
 * floor from 48 to 63 and stripped labels off breadcrumbs that were fine.
 */
const ANCESTOR_FRAGMENT = 'Curr…';

const PADDING_PX = 16;          // `.segment-content` padding: 4px 8px

export const LABEL_FLOOR_PX = {
  current: Math.ceil(PADDING_PX + Math.max(
    measureTextPx(WIDEST_AMOUNT, 11.2, 500),
    measureTextPx(NAME_FRAGMENT, 12, 600),
  )),
  ancestor: Math.ceil(PADDING_PX + measureTextPx(ANCESTOR_FRAGMENT, 11.2, 600)),
} as const;

/**
 * The rule this replaced, kept as the UNMEASURED fallback.
 *
 * ⚠⚠ NOT DEAD CODE. It is what renders before the first measurement lands and
 * in any environment with no layout at all — `renderToStaticMarkup`, which is
 * the only way this repo can test a component. A chart with no labels would be
 * worse than a chart with the old heuristic's labels, so the fallback keeps the
 * pre-2026-10-10 behaviour exactly rather than blanking.
 */
export const LEGACY_PCT_FLOOR = { current: 8, ancestor: 6 } as const;

/**
 * ── ⚠⚠ THE TYPE SIZES THE LABELS ARE SET IN, from `BudgetIcicle.css` ────────
 * Current level: `.segment-name` 0.75rem / 600 over `.segment-amount`
 * 0.7rem / 500. Ancestor: name only, 0.7rem / 600, laid out in a row.
 */
const TYPE = {
  current: { namePx: 12, nameWeight: 600 as const, amountPx: 11.2, amountWeight: 500 as const },
  ancestor: { namePx: 11.2, nameWeight: 600 as const },
};

/** Characters of a long name worth showing before the CSS ellipsis. */
const MIN_NAME_CHARS = 6;
const MIN_ANCESTOR_CHARS = 4;

/**
 * The shortest form of a name worth drawing: the whole thing when it is short,
 * otherwise a fragment plus the ellipsis `.segment-name` already applies.
 */
function shortestUsefulName(name: string, minChars: number): string {
  return name.length <= minChars ? name : name.slice(0, minChars).trimEnd() + '…';
}

/** What a segment actually has to print. */
export interface SegmentText {
  name: string;
  /** The formatted figure, or null on an ancestor row, which prints none. */
  amount: string | null;
}

/**
 * ⚠⚠ THE WIDTH A SEGMENT REALLY NEEDS, from the strings it really prints.
 *
 * `.segment-name` ellipsises in CSS, so a long name only needs room for a
 * useful FRAGMENT — but `.segment-amount` has no `text-overflow` and sits in an
 * `overflow: hidden` box, so an amount that does not fit is HARD-CLIPPED
 * mid-glyph. A clipped figure is not a tidier figure, it is a different number:
 * `$13.5B` losing its tail reads as `$13.5` or `$1`. So the amount must fit
 * WHOLE and the name need not.
 *
 * They are stacked, so the requirement is the wider of the two, not the sum.
 */
export function requiredLabelPx(text: SegmentText, isAncestor: boolean): number {
  if (isAncestor) {
    const t = TYPE.ancestor;
    return PADDING_PX + measureTextPx(
      shortestUsefulName(text.name, MIN_ANCESTOR_CHARS), t.namePx, t.nameWeight);
  }
  const t = TYPE.current;
  const namePx = measureTextPx(
    shortestUsefulName(text.name, MIN_NAME_CHARS), t.namePx, t.nameWeight);
  const amountPx = text.amount
    ? measureTextPx(text.amount, t.amountPx, t.amountWeight)
    : 0;
  return PADDING_PX + Math.max(namePx, amountPx);
}

/**
 * @param widthPct     the segment's share of its own level, 0-100
 * @param containerPx  the measured chart width, or null before it is known
 * @param text         the strings this segment prints. ⚠ Omit ONLY where they
 *                     are genuinely unavailable; without them this falls back
 *                     to `LABEL_FLOOR_PX`, which is sized for the worst case
 *                     and therefore hides labels that would have fitted.
 */
export function canFitLabel(
  widthPct: number,
  containerPx: number | null,
  isAncestor: boolean,
  text?: SegmentText,
): boolean {
  const tier = isAncestor ? 'ancestor' : 'current';
  if (!Number.isFinite(widthPct) || widthPct <= 0) return false;
  if (containerPx === null || !Number.isFinite(containerPx) || containerPx <= 0) {
    return widthPct >= LEGACY_PCT_FLOOR[tier];
  }
  const segmentPx = (widthPct / 100) * containerPx;
  // ⚠⚠ MEASURE THE SEGMENT'S OWN STRINGS WHEN THEY ARE KNOWN. A single floor
  // has to be sized for the widest figure the ladder can print (`-$999.9M`),
  // so it held a segment showing `$2.2B` to a bar meant for a figure half again
  // as wide — New York City's `Health` lost its label at 66px while its real
  // text needs about 46. That is the same "one average for everything" mistake
  // the glyph constant was, one level up.
  return segmentPx >= (text ? requiredLabelPx(text, isAncestor) : LABEL_FLOOR_PX[tier]);
}
