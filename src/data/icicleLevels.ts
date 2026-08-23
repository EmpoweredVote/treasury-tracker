/**
 * The levels an icicle chart draws — moved out of BudgetIcicle.tsx so it can be
 * tested at all.
 *
 * This repo can run NO component tests (vitest is `environment: 'node'` and never
 * collects `.test.tsx`), and this function is where the chart decides which row a
 * reader can interact with. It was wrong for every leaf click in the product and
 * nothing could have caught it. Pure: no React, no DOM, no colour, no formatting.
 */
import type { BudgetCategory } from '../types/budget';

export interface BarSegment {
  category: BudgetCategory;
  path: BudgetCategory[];
  /** Percentage of its own level. */
  width: number;
  isSelected: boolean;
  hasChildren: boolean;
  /** Root-level category index, for colour cycling. */
  categoryIndex: number;
}

export interface BarLevel {
  segments: BarSegment[];
  /** Ancestor levels are compressed and dimmed. */
  isAncestor: boolean;
  totalAmount: number;
  /** For accessibility. */
  levelName: string;
}

export function buildIcicleLevels(
  categories: BudgetCategory[],
  navigationPath: BudgetCategory[],
  totalBudget: number,
): BarLevel[] {
  const result: BarLevel[] = [];

  // Root category name → its index, so descendants can inherit its colour.
  const rootIndexMap = new Map<string, number>();
  categories.forEach((c, i) => rootIndexMap.set(c.name, i));

  result.push({
    segments: categories.map((c, i) => ({
      category: c,
      path: [c],
      width: (c.amount / totalBudget) * 100,
      isSelected: navigationPath.length > 0 && navigationPath[0].name === c.name,
      hasChildren: (c.subcategories && c.subcategories.length > 0) || false,
      categoryIndex: i,
    })),
    isAncestor: navigationPath.length > 0,
    totalAmount: totalBudget,
    levelName: 'Total Budget',
  });

  navigationPath.forEach((pathCat, pathIndex) => {
    const subcats = pathCat.subcategories || [];
    // A childless item contributes no level — this is what used to leave a leaf
    // click with no current level at all.
    if (subcats.length === 0) return;

    // Normalize by the sum of the children actually drawn, not the parent's stored
    // amount. Identical for trees where children sum to the parent (all municipal
    // data); required for federal nets, where positive account bars sit under a
    // parent whose official total nets out offsetting receipts.
    const childrenSum = subcats.reduce((sum, c) => sum + c.amount, 0);
    const levelTotal = childrenSum > 0 ? childrenSum : pathCat.amount;
    const rootCatIndex = rootIndexMap.get(navigationPath[0].name) ?? 0;

    result.push({
      segments: subcats.map((c) => ({
        category: c,
        path: [...navigationPath.slice(0, pathIndex + 1), c],
        width: (c.amount / levelTotal) * 100,
        isSelected: navigationPath[pathIndex + 1]?.name === c.name,
        hasChildren: (c.subcategories && c.subcategories.length > 0) || false,
        categoryIndex: rootCatIndex,
      })),
      isAncestor: true,
      totalAmount: levelTotal,
      levelName: pathCat.name,
    });
  });

  // ⚠ THE DEEPEST LEVEL RENDERED IS ALWAYS THE CURRENT ONE.
  //
  // This used to be decided per path item — `isAncestor: pathIndex !== navigationPath
  // .length - 1` — which is only the same thing while the last item in the path has
  // children. Click a LEAF (any job title on the salaries tree, any node of a flat
  // source) and the last path item contributes no level, so no level was current:
  // every row dimmed to 40% and the chart read as disabled. Reported as "the icicle
  // doesn't work", UAT 2026-08-22 (G2).
  //
  // Deriving it from what was actually pushed cannot drift out of step with the
  // path the way the old rule did.
  if (result.length > 0) result[result.length - 1].isAncestor = false;

  return result;
}
