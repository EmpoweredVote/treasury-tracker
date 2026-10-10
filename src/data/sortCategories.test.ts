import { describe, it, expect } from 'vitest';
import { sortCategoriesByAmount } from './sortCategories';
import type { BudgetCategory } from '../types/budget';

/** A category, with optional children. */
const cat = (
  name: string, amount: number, subcategories?: BudgetCategory[],
): BudgetCategory => ({ name, amount, subcategories } as BudgetCategory);

const names = (cs: BudgetCategory[]) => cs.map((c) => c.name);

/**
 * NEW YORK CITY FY2002, `Current Operations` — the level that reported this.
 * Listed here in the order the ACFR prints its functions, which is the order
 * the product rendered. Amounts in $M, as the page shows them.
 */
const nycCurrentOperations = [
  cat('General Government', 2_399.9),
  cat('Public safety and judicial', 7_290.8),
  cat('Education', 13_480.9),
  cat('City University', 428.5),
  cat('Social services', 9_203.9),
  cat('Environmental protection', 2_824.5),
  cat('Transportation services', 1_593.5),
  cat('Parks, recreation and cultural activities', 674.6),
  cat('Housing', 820.7),
  cat('Libraries', 158.4),
];

describe('sortCategoriesByAmount', () => {
  it('puts the biggest function first for the NYC level that reported this', () => {
    const out = sortCategoriesByAmount(nycCurrentOperations);
    expect(names(out).slice(0, 4)).toEqual([
      'Education',
      'Social services',
      'Public safety and judicial',
      'Environmental protection',
    ]);
    expect(names(out).at(-1)).toBe('Libraries');
  });

  it('leaves every level monotonically non-increasing', () => {
    // The invariant the bar chart needs: no segment is ever wider than the one
    // to its left. Stated as a property so it holds for trees nobody wrote a
    // case for.
    const out = sortCategoriesByAmount(nycCurrentOperations);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].amount).toBeLessThanOrEqual(out[i - 1].amount);
    }
  });

  it('sorts EVERY level, not just the top one', () => {
    const tree = [
      cat('Current Operations', 100, [
        cat('Small', 10, [cat('tiny', 1), cat('big', 9)]),
        cat('Large', 90),
      ]),
    ];
    const out = sortCategoriesByAmount(tree);
    expect(names(out[0].subcategories!)).toEqual(['Large', 'Small']);
    expect(names(out[0].subcategories![1].subcategories!)).toEqual(['big', 'tiny']);
  });

  it('keeps the document order when two amounts tie', () => {
    // `Array.prototype.sort` is stable, and the printed order is the only
    // ordering signal left once the amounts are equal.
    const out = sortCategoriesByAmount([cat('b', 5), cat('a', 5), cat('c', 9)]);
    expect(names(out)).toEqual(['c', 'b', 'a']);
  });

  it('sorts zero-amount rows LAST, behind negatives', () => {
    // ⚠⚠ The colour invariant depends on this. `CategoryList` is handed a list
    // with zero rows filtered OUT and the icicle is handed the level whole;
    // both colour by position. Only a suffix-trim leaves the two agreeing, so a
    // zero may never sit in the middle — not even ahead of a federal offset.
    const out = sortCategoriesByAmount([
      cat('zero', 0),
      cat('offset', -40),
      cat('big', 100),
    ]);
    expect(names(out)).toEqual(['big', 'offset', 'zero']);
  });

  it('gives the filtered list and the whole list the same index for every surviving row', () => {
    // Stated the way the bug would actually appear: card N and bar N disagree.
    const level = [cat('a', 0), cat('b', 7), cat('c', 0), cat('d', 9)];
    const whole = sortCategoriesByAmount(level);
    const filtered = whole.filter((c) => c.amount !== 0);
    filtered.forEach((c, i) => expect(whole[i].name).toBe(c.name));
  });

  it('moves no money and mutates nothing the caller passed in', () => {
    const level = [cat('a', 1), cat('b', 2)];
    const before = JSON.stringify(level);
    const out = sortCategoriesByAmount(level);
    expect(JSON.stringify(level)).toBe(before);
    expect(out.reduce((n, c) => n + c.amount, 0))
      .toBe(level.reduce((n, c) => n + c.amount, 0));
  });

  it('passes a childless category through as the same object', () => {
    // No needless copying: a leaf keeps its identity, lineItems and all.
    const leaf = cat('leaf', 3);
    expect(sortCategoriesByAmount([leaf])[0]).toBe(leaf);
  });

  it('survives an empty or absent level', () => {
    expect(sortCategoriesByAmount([])).toEqual([]);
    expect(sortCategoriesByAmount(undefined as unknown as BudgetCategory[])).toEqual([]);
  });
});
