import type { BudgetCategory } from '../types/budget';
import { ellipsiseToPx } from '../utils/manropeMetrics';

/**
 * The two decisions the sunburst makes about every arc — which colour it gets
 * and how emphasised it is — pulled out of the component so they can be tested.
 *
 * ── ⚠⚠ WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * The icicle's 2026-10-10 fixes did not reach the sunburst, and the Bars /
 * Sunburst toggle sits on the same chart. Checked on production after that
 * shipped, New York City FY2002 `Current Operations` drew as a single pale
 * blob, for two separate reasons that compounded:
 *
 *   • every descendant inherited its ROOT category's colour index, so all
 *     fifteen functions were one teal — the same defect the icicle had, while
 *     the fifteen cards below were fifteen different hues;
 *   • the CURRENT level rendered at 0.3 opacity while its PARENT rendered at
 *     1.0 — inverted. The thing the reader had just drilled into, and was
 *     reading about in the cards, was the faintest thing on screen.
 */

export interface SunburstNode {
  name: string;
  value?: number;
  /** ⚠ Position among its OWN SIBLINGS — see `buildSunburstHierarchy`. */
  categoryIndex: number;
  category: BudgetCategory;
  children?: SunburstNode[];
}

/**
 * Build the d3 hierarchy, colouring every node by its position among its own
 * siblings.
 *
 * ⚠⚠ THE INDEX IS SIBLING POSITION, NOT THE ROOT'S. It used to be threaded
 * down from the root (`buildHierarchy(cat.subcategories, idx)`) so that a whole
 * branch read as one colour. That is the rule the icicle dropped on 2026-10-10:
 * a ring IS the card list a reader sees under the chart, and those are coloured
 * by position across ten hues, so inheriting made one list render under two
 * palettes.
 *
 * Sibling position gives the same mapping the icicle and the cards now use, so
 * the Nth wedge of a ring, the Nth bar and the Nth card are one colour.
 *
 * ⚠ A parent and its first child therefore share a hue, radially adjacent. The
 * white arc stroke separates them, and the alternative — a palette that depends
 * on depth — would break the agreement with the cards, which is the property
 * worth having.
 */
export function buildSunburstHierarchy(categories: BudgetCategory[]): SunburstNode[] {
  if (!Array.isArray(categories)) return [];
  return categories.map((cat, i) => {
    const kids = cat.subcategories && cat.subcategories.length > 0 ? cat.subcategories : null;
    return {
      name: cat.name,
      // d3 sums leaves; an internal node must not also carry a value or its
      // children would be double-counted.
      value: kids ? undefined : cat.amount,
      categoryIndex: i,
      category: cat,
      children: kids ? buildSunburstHierarchy(kids) : undefined,
    };
  });
}

/** How strongly an arc is drawn. */
export type ArcEmphasis =
  /** On the navigation path — an ancestor of, or, the current selection. */
  | 'path'
  /** A child of the current selection: THE LEVEL THE READER IS READING. */
  | 'current'
  /** Everything else: a sibling of a path node, or unrelated. */
  | 'dim';

/**
 * ⚠⚠ THE BUG THIS ENCODES A FIX FOR: `isSibling` returned true for ANY node
 * whose parent was on the path, which lumps two different things together —
 * a true sibling of a path node (`Debt Service` beside `Current Operations`)
 * and a CHILD OF THE DEEPEST SELECTION (`Education` under `Current
 * Operations`). The second group is the current level. Dimming it to 0.3 made
 * the reader's own level the faintest ring on the chart, under a parent at full
 * strength.
 *
 * Depth is what separates them, and nothing else does: a child of the selection
 * is exactly one level deeper than the path.
 */
export function arcEmphasis(nodePath: string[], currentPath: string[]): ArcEmphasis {
  // Nothing selected: the whole top level reads normally.
  if (currentPath.length === 0) return nodePath.length === 1 ? 'current' : 'dim';

  const isPrefixOfPath =
    nodePath.length <= currentPath.length &&
    nodePath.every((name, i) => name === currentPath[i]);
  if (isPrefixOfPath) return 'path';

  if (
    nodePath.length === currentPath.length + 1 &&
    currentPath.every((name, i) => name === nodePath[i])
  ) {
    return 'current';
  }

  return 'dim';
}

/** Fill opacity per emphasis. The current level is never the faintest thing. */
export const ARC_OPACITY: Record<ArcEmphasis, number> = {
  path: 1,
  current: 1,
  dim: 0.3,
};

/**
 * ── ⚠⚠ ARC LABELS ───────────────────────────────────────────────────────────
 *
 * The sunburst drew NO labels at all — every figure was tooltip-only, so the
 * chart could not be read without a pointer, and not at all on a touch screen.
 * The bars beside it label any segment with room. Reported 2026-10-10 with the
 * crop below.
 *
 * ⚠ THE FIT TEST IS THE SAME SHAPE AS THE ICICLE'S, AND FOR THE SAME REASON:
 * it is about PIXELS, not about fractions. An arc has two independent
 * dimensions and a label needs both —
 *
 *   · RADIAL room (ring width) bounds the text's LENGTH;
 *   · TANGENTIAL room (arc length at the middle of the ring) bounds its HEIGHT.
 *
 * A thin wedge of a fat ring has length but no height; a wide wedge of a thin
 * ring has the opposite. Checking one and not the other is how a label ends up
 * crossing its own arc boundary.
 */

/** Rendered size we aim a label at, in CSS pixels. */
export const SUNBURST_LABEL_PX = 11;

/** Shortest fragment worth drawing, in characters, before the ellipsis. */
const MIN_LABEL_CHARS = 5;

export interface ArcGeometry {
  label: string;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  /** In the SAME units as the radii — the caller converts from pixels. */
  fontSize: number;
}

/**
 * The text to draw inside an arc, ellipsised to the ring width, or null when
 * the arc cannot carry a legible fragment.
 *
 * ⚠ Returns a TRUNCATION rather than hiding whenever five characters fit. SVG
 * `<text>` has no `text-overflow`, so this is where the icicle's CSS ellipsis
 * has to be done by hand; without it the chart would label only its two or
 * three widest arcs and stay unreadable.
 */
export function fitArcLabel(g: ArcGeometry): string | null {
  const { label, innerRadius, outerRadius, startAngle, endAngle, fontSize } = g;
  if (!label || !Number.isFinite(fontSize) || fontSize <= 0) return null;

  const ringWidth = outerRadius - innerRadius;
  const midRadius = (outerRadius + innerRadius) / 2;
  const sweep = Math.abs(endAngle - startAngle);
  if (!(ringWidth > 0) || !(sweep > 0)) return null;

  // Height: the arc must be at least as "tall" as the line, with a little air.
  if (sweep * midRadius < fontSize * 1.25) return null;

  // ⚠⚠ MEASURED PER CHARACTER against the real font, not counted. This used to
  // divide the ring width by `fontSize * 0.55`, a guessed average advance.
  // Measured over the product's own labels that guess runs WIDE by 9% on
  // average and 21% at worst — real names are full of spaces (0.2em) and thin
  // letters ('i' and 'l' are 0.265em) — so arcs were truncating labels harder
  // than they had to, losing up to a fifth of the visible text for nothing.
  //
  // ⚠ Counting characters is the deeper error: 'l' is 0.265em and 'W' is
  // 0.963em, so "Libraries" and "Wastewater" are the same length and nowhere
  // near the same width.
  //
  // ⚠ `measureTextPx` is unit-agnostic: it returns whatever unit `fontSize` is
  // in, which here is viewBox units, not pixels.
  const usable = ringWidth - fontSize * 0.6;   // a little air at each end
  return ellipsiseToPx(label, usable, fontSize, 600, MIN_LABEL_CHARS);
}

/**
 * Keep radial text the right way up.
 *
 * d3 angles run clockwise from twelve o'clock, so an arc centred anywhere in
 * the left half (π … 2π) has its outward direction pointing leftward and its
 * text would read upside down and backwards. Those labels are rotated a
 * further 180°, which is why this returns the flip as well as the angle.
 */
export function arcLabelTransform(startAngle: number, endAngle: number, midRadius: number): string {
  const mid = (startAngle + endAngle) / 2;
  const deg = (mid * 180) / Math.PI - 90;
  const flip = mid > Math.PI ? 180 : 0;
  return `rotate(${deg}) translate(${midRadius},0) rotate(${flip})`;
}
