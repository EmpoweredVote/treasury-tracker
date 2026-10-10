import type { BudgetCategory } from '../types/budget';

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
