import { describe, it, expect } from 'vitest';
import { buildSunburstHierarchy, arcEmphasis, ARC_OPACITY } from './sunburstLevels';
import { sortCategoriesByAmount } from './sortCategories';
import {
  NYC_CURRENT_OPERATIONS,
  nycCurrentOperationsNode,
} from './__fixtures__/nycCurrentOperations';
import { getCategoryColor } from '../utils/chartColors';
import type { BudgetCategory } from '../types/budget';

const cat = (name: string, amount: number, subcategories?: BudgetCategory[]): BudgetCategory =>
  ({ name, amount, subcategories } as BudgetCategory);

/** The real FY2002 tree: Current Operations (15 functions) beside Debt Service. */
const tree = () => [
  nycCurrentOperationsNode(sortCategoriesByAmount(NYC_CURRENT_OPERATIONS)),
  cat('Debt Service', 1_800_000_000),
];

describe('buildSunburstHierarchy', () => {
  it('colours a ring by SIBLING position, not by its root', () => {
    // ⚠⚠ THE DEFECT. Every descendant used to inherit the root's index, so all
    // fifteen functions drew in one teal under fifteen differently-coloured
    // cards. Checked on production 2026-10-10.
    const ring2 = buildSunburstHierarchy(tree())[0].children!;
    expect(ring2.map((n) => n.categoryIndex)).toEqual([...Array(15).keys()]);
  });

  it('gives the Nth wedge the Nth card colour', () => {
    // The invariant the icicle fix created, extended to the second view: one
    // list, one palette, whichever chart is showing.
    const ring2 = buildSunburstHierarchy(tree())[0].children!;
    const fills = ring2.map((n) => getCategoryColor(n.categoryIndex));
    expect(fills[0]).toBe(getCategoryColor(0));
    expect(fills[1]).toBe(getCategoryColor(1));
    expect(fills[2]).toBe(getCategoryColor(2));
    for (let i = 1; i < fills.length; i++) expect(fills[i]).not.toBe(fills[i - 1]);
  });

  it('keeps the root level as it was', () => {
    const roots = buildSunburstHierarchy(tree());
    expect(roots.map((n) => n.categoryIndex)).toEqual([0, 1]);
  });

  it('gives an internal node no value, so d3 cannot double-count it', () => {
    const [ops, debt] = buildSunburstHierarchy(tree());
    expect(ops.value).toBeUndefined();
    expect(ops.children).toHaveLength(15);
    expect(debt.value).toBe(1_800_000_000);
    expect(debt.children).toBeUndefined();
  });

  it('indexes every level independently, however deep', () => {
    const deep = [cat('A', 10, [cat('A1', 6, [cat('A1a', 6)]), cat('A2', 4)])];
    const out = buildSunburstHierarchy(deep);
    expect(out[0].categoryIndex).toBe(0);
    expect(out[0].children!.map((n) => n.categoryIndex)).toEqual([0, 1]);
    expect(out[0].children![0].children![0].categoryIndex).toBe(0);
  });

  it('survives an empty or absent level', () => {
    expect(buildSunburstHierarchy([])).toEqual([]);
    expect(buildSunburstHierarchy(undefined as unknown as BudgetCategory[])).toEqual([]);
  });
});

describe('arcEmphasis', () => {
  const PATH = ['Current Operations'];

  it('never leaves the CURRENT LEVEL fainter than its parent', () => {
    // ⚠⚠ THE SECOND DEFECT, stated as the thing a reader saw: drilled into
    // Current Operations, the parent drew at 1.0 and all fifteen functions —
    // the level being read, and the level the cards list — drew at 0.3.
    const parent = ARC_OPACITY[arcEmphasis(PATH, PATH)];
    const child = ARC_OPACITY[arcEmphasis([...PATH, 'Education'], PATH)];
    expect(child).toBeGreaterThanOrEqual(parent);
    expect(child).toBe(1);
  });

  it('separates a child of the selection from a true sibling of the path', () => {
    // The old predicate lumped these together: both have a parent on the path.
    // Only DEPTH tells them apart.
    expect(arcEmphasis(['Current Operations', 'Education'], PATH)).toBe('current');
    expect(arcEmphasis(['Debt Service'], PATH)).toBe('dim');
  });

  it('marks ancestors and the selection itself as path', () => {
    const deep = ['Current Operations', 'Education'];
    expect(arcEmphasis(['Current Operations'], deep)).toBe('path');
    expect(arcEmphasis(['Current Operations', 'Education'], deep)).toBe('path');
  });

  it('dims a grandchild two levels below the selection', () => {
    expect(arcEmphasis(['Current Operations', 'Education', 'Teachers'], PATH)).toBe('dim');
  });

  it('dims a node that merely shares a prefix name', () => {
    expect(arcEmphasis(['Debt Service', 'Interest'], PATH)).toBe('dim');
  });

  it('reads the whole top level as current when nothing is selected', () => {
    expect(arcEmphasis(['Current Operations'], [])).toBe('current');
    expect(arcEmphasis(['Debt Service'], [])).toBe('current');
    expect(arcEmphasis(['Current Operations', 'Education'], [])).toBe('dim');
  });
});
