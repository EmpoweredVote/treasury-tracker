import type { BudgetCategory } from '../types/budget';

/**
 * Order every level of a category tree largest-first.
 *
 * ── ⚠⚠ WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * Nothing in the UI ever sorted. A level rendered in whatever order the loader
 * stored, which for a published statement is the ORDER OF THE PRINTED TABLE.
 * New York City FY2002 made that visible: under `Current Operations` the bars
 * read General Government $2.4B, Public safety $7.3B, Education $13.5B,
 * City University $0.4B, Social services $9.2B … — the NYC ACFR's function
 * order, and nonsense as a chart. A 5.2% unlabelled block sat at the far left
 * because `General Government` is simply the first row the ACFR prints.
 *
 * It looked sorted elsewhere only by accident: the Utah, CA-salaries and a few
 * other LOADERS sort their children by amount before writing. Three planning
 * docs went on to assert "the icicle sorts by amount" (69-CONTEXT.md,
 * 70-CONTEXT.md, 69-01-SUMMARY.md). The icicle never did. This is where that
 * claim becomes true, for every source at once, rather than per loader.
 *
 * ⚠ The SUNBURST has always sorted (`BudgetSunburst.tsx`, d3 `.sort()`), so
 * before this the Bars/Sunburst toggle re-ordered the same data under the
 * reader. Now both agree.
 *
 * ── ⚠⚠ WHAT THIS IS NOT ─────────────────────────────────────────────────────
 *
 * Presentation only, and it moves no money: a reorder of existing nodes with
 * every amount, percentage, linkKey and lineItems array passed through
 * untouched. The STORED hierarchy still reproduces the document, which is what
 * the re-derivation harnesses check against the PDF.
 */

const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * Descending by amount — but ZEROS ALWAYS LAST, even behind negatives.
 *
 * ⚠⚠ THIS IS NOT COSMETIC, IT IS WHAT KEEPS THE BARS AND THE CARDS THE SAME
 * COLOUR. Both palettes are indexed BY POSITION, and the two lists are not the
 * same list: `CategoryList` is handed `displayCategories`, which drops
 * zero-amount rows, while the icicle is handed the level whole. Any dropped row
 * in the MIDDLE shifts every card after it one hue away from its bar.
 *
 * Sorting zeros to the tail makes that filter a pure suffix-trim, so every
 * surviving row holds the same index in both lists by construction. Federal
 * trees carry negative offset rows, which is why zeros must sort behind
 * negatives too and not merely behind positives.
 *
 * A zero-amount row draws a zero-width segment, so moving it costs a reader
 * nothing on screen.
 */
function byAmountDesc(a: BudgetCategory, b: BudgetCategory): number {
  const av = num(a.amount);
  const bv = num(b.amount);
  if ((av === 0) !== (bv === 0)) return av === 0 ? 1 : -1;
  return bv - av;
}

/**
 * Sort `categories` and every descendant level. Pure: returns new arrays and
 * new parent objects, mutates nothing the caller passed in.
 *
 * ⚠ `Array.prototype.sort` is stable, so rows of EQUAL amount keep the order
 * the document printed them in. That is deliberate — it is the only ordering
 * signal left once the amounts tie.
 *
 * ⚠ `lineItems` are deliberately untouched. `LineItemsTable` sorts its own rows
 * by the column a reader picked, and reordering them here would fight it.
 */
export function sortCategoriesByAmount(categories: BudgetCategory[]): BudgetCategory[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  return [...categories].sort(byAmountDesc).map((c) =>
    c.subcategories && c.subcategories.length > 0
      ? { ...c, subcategories: sortCategoriesByAmount(c.subcategories) }
      : c,
  );
}
