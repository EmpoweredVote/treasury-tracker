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
 * @param widthPct     the segment's share of its own level, 0–100
 * @param containerPx  the measured chart width, or null before it is known
 */
export function canFitLabel(
  widthPct: number,
  containerPx: number | null,
  isAncestor: boolean,
): boolean {
  const tier = isAncestor ? 'ancestor' : 'current';
  if (!Number.isFinite(widthPct) || widthPct <= 0) return false;
  if (containerPx === null || !Number.isFinite(containerPx) || containerPx <= 0) {
    return widthPct >= LEGACY_PCT_FLOOR[tier];
  }
  return (widthPct / 100) * containerPx >= LABEL_FLOOR_PX[tier];
}
