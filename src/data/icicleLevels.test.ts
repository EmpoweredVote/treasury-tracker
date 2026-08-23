import { describe, it, expect } from 'vitest';
import { buildIcicleLevels } from './icicleLevels';
import type { BudgetCategory } from '../types/budget';

/** A category, with optional children. */
const cat = (
  name: string, amount: number, subcategories?: BudgetCategory[],
): BudgetCategory => ({ name, amount, subcategories } as BudgetCategory);

/**
 * MODESTO salaries, FY2024 — a TWO-level tree: departments, then job titles with
 * no children of their own. `dataset_type='salaries'` has no `i` array at all.
 */
const parks = cat('Parks, Recreation & Neighborhoods', 7_700_000, [
  cat('Maintenance Worker II (26)', 1_600_000),
  cat('Recreation Coordinator (7)', 653_285),
]);
const police = cat('Modesto Police Department', 50_100_000, [
  cat('Police Officer (200)', 40_000_000),
]);
const TOTAL = 57_800_000;

describe('buildIcicleLevels', () => {
  it('renders one current level at the top of the tree', () => {
    const levels = buildIcicleLevels([police, parks], [], TOTAL);
    expect(levels).toHaveLength(1);
    expect(levels[0].isAncestor).toBe(false);
    expect(levels[0].segments.map((s) => s.category.name))
      .toEqual(['Modesto Police Department', 'Parks, Recreation & Neighborhoods']);
  });

  it('drilling one level deep leaves the children current and the roots ancestral', () => {
    const levels = buildIcicleLevels([police, parks], [parks], TOTAL);
    expect(levels.map((l) => l.isAncestor)).toEqual([true, false]);
    expect(levels[1].segments).toHaveLength(2);
    expect(levels[1].levelName).toBe('Parks, Recreation & Neighborhoods');
  });

  // ⚠ UAT 2026-08-22 (G2). Clicking a job title — a segment with no children —
  // used to make EVERY level ancestral: `isAncestor` was derived from "is this the
  // last item in navigationPath", and a childless last item contributes no level of
  // its own, so nothing was left current. The whole chart dimmed to 40% and read as
  // disabled, which is what Chris reported as "the icicle doesn't work".
  //
  // The deepest level actually RENDERED must stay current, whatever the path says.
  it('keeps the deepest rendered level current when the reader clicks a LEAF', () => {
    const leaf = parks.subcategories![0];
    const levels = buildIcicleLevels([police, parks], [parks, leaf], TOTAL);

    expect(levels).toHaveLength(2);
    expect(levels.map((l) => l.isAncestor)).toEqual([true, false]);
    expect(levels.some((l) => !l.isAncestor)).toBe(true);
  });

  it('marks the clicked leaf as the selected segment of that level', () => {
    const leaf = parks.subcategories![0];
    const levels = buildIcicleLevels([police, parks], [parks, leaf], TOTAL);
    const selected = levels[1].segments.filter((s) => s.isSelected);
    expect(selected.map((s) => s.category.name)).toEqual(['Maintenance Worker II (26)']);
  });

  it('normalises a level by the sum of the children it draws, not the parent total', () => {
    // Required for federal nets, where positive account bars sit under a parent
    // whose official total nets out offsetting receipts.
    const parent = cat('Agency', 100, [cat('A', 30), cat('B', 30)]);
    const levels = buildIcicleLevels([parent], [parent], 100);
    expect(levels[1].totalAmount).toBe(60);
    expect(levels[1].segments.map((s) => s.width)).toEqual([50, 50]);
  });

  it('reports whether each segment can be drilled into', () => {
    const levels = buildIcicleLevels([police, parks], [parks], TOTAL);
    expect(levels[1].segments.map((s) => s.hasChildren)).toEqual([false, false]);
    expect(levels[0].segments.map((s) => s.hasChildren)).toEqual([true, true]);
  });
});
