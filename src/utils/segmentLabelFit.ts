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
 * ── HOW THE FLOORS WERE DERIVED, from `BudgetIcicle.css` ─────────────────────
 *
 * `.segment-content` has `padding: 4px 8px`, so 16px of every segment is gone
 * before a glyph is drawn. What must fit in the rest:
 *
 *   CURRENT level — `.segment-name` 0.75rem (12px) over `.segment-amount`
 *   0.7rem (11.2px), stacked, so the requirement is the WIDER of the two, not
 *   their sum.
 *     · the amount, in full: the longest compact form is 7 characters
 *       (`-$999.9M`, `$13.5B`). Digits run ~0.6em → 11.2 × 0.6 × 7 ≈ 47px.
 *     · a USEFUL fragment of the name: 6 glyphs plus the ellipsis the CSS
 *       already applies → 12 × 0.55 × 7 ≈ 46px.
 *     max(47, 46) + 16 ≈ 63  →  64px.
 *
 *   ANCESTOR level — name only, 0.7rem, laid out in a row. 5 glyphs plus the
 *   ellipsis → 11.2 × 0.55 × 6 ≈ 37px, + 16 ≈ 53  →  48px, kept deliberately
 *   permissive because an ancestor row is a breadcrumb rather than the figure
 *   a reader is reading, which is also why the old rule asked less of it (6%).
 *
 * ⚠ 0.55em / 0.6em are AVERAGE advances for a mid-weight UI sans, not Manrope's
 * own metrics, so these are approximations with the margin deliberately on the
 * conservative side. Being 10% too strict hides a label that would just have
 * fitted; being 10% too loose clips one a reader is trying to read. Only the
 * second is a defect.
 *
 * ⚠ Sized for the DESKTOP type scale. Under the 768px media query the fonts
 * drop to 0.7/0.65rem, so these floors ask for slightly more room than that
 * text needs — erring toward the harmless side again, and avoiding a second
 * threshold keyed off a media query this module cannot see.
 */
export const LABEL_FLOOR_PX = { current: 64, ancestor: 48 } as const;

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
