/**
 * Ohio AOS publishes a wide table whose header spans FOUR rows, and two of its
 * quirks put 1,778 budgets into the database with duplicate root categories.
 *
 * ⚠⚠ 1. A VERBATIM REPEATED COLUMN. In the FY2024 GAAP city workbook, columns
 * 11 and 12 are both headed "Rentals" and carry the IDENTICAL value — measured
 * 237 of 237 cities. The publisher's own Total counts it ONCE, so reading both
 * double-counts: revenue ties for 146/237 today and 237/237 once the repeat is
 * dropped. That single column is the whole gap.
 *
 * ⚠⚠ 2. A LEAF LABEL REUSED UNDER DIFFERENT GROUPS. "Other" is column 19
 * (Current → Security Of Persons And Property → Other) and column 33 (Debt
 * Service → Other). Same word, different governments' money. Those must be
 * told apart, not merged.
 *
 * The two cases need OPPOSITE handling, which is why the rule keys on the
 * AMOUNT as well as the label: identical label AND identical amount is the
 * publisher repeating itself; identical label with a different amount is two
 * real categories that need their group prefix.
 */

import { describe, it, expect } from 'vitest';
import { buildOhioTree } from '../scripts/lib/ohioTree.mjs';

describe('buildOhioTree', () => {
  it('keeps distinct labels untouched', () => {
    const r = buildOhioTree([
      { label: 'Property Taxes', amount: 100 },
      { label: 'Income Taxes', amount: 200 },
    ]);
    expect(r.tree).toEqual([{ n: 'Income Taxes', a: 200 }, { n: 'Property Taxes', a: 100 }]);
    expect(r.skipped).toHaveLength(0);
  });

  it('SKIPS a verbatim repeated column — the Rentals case', () => {
    const r = buildOhioTree([
      { label: 'Rentals', amount: 18866 },
      { label: 'Rentals', amount: 18866 },
    ]);
    expect(r.tree).toEqual([{ n: 'Rentals', a: 18866 }]);
    expect(r.skipped).toEqual([{ label: 'Rentals', amount: 18866, why: 'verbatim repeat' }]);
  });

  it('makes the tree tie to the publisher total once the repeat is dropped', () => {
    const cells = [
      { label: 'Property Taxes', amount: 2404143 },
      { label: 'Rentals', amount: 18866 },
      { label: 'Rentals', amount: 18866 },
    ];
    const sum = buildOhioTree(cells).tree.reduce((s, n) => s + n.a, 0);
    expect(sum).toBe(2404143 + 18866);
  });

  it('DISAMBIGUATES a reused label when the amounts differ — the "Other" case', () => {
    const r = buildOhioTree([
      { label: 'Other', amount: 457280, group: 'Security Of Persons And Property' },
      { label: 'Other', amount: 10026280, group: 'Debt Service' },
    ]);
    expect(r.tree.map((n) => n.n).sort()).toEqual([
      'Debt Service: Other', 'Security Of Persons And Property: Other',
    ]);
  });

  it('never prefixes a label that is already unique', () => {
    // ⚠ Reader-facing text. Only a genuine collision earns a longer name.
    const r = buildOhioTree([{ label: 'Police', amount: 5, group: 'Security Of Persons And Property' }]);
    expect(r.tree[0].n).toBe('Police');
  });

  it('falls back to a numbered suffix when there is no group to tell them apart', () => {
    // ⚠ Still never two identical names: a duplicate root is what this exists
    // to prevent, and silently merging different amounts would invent a figure.
    const r = buildOhioTree([
      { label: 'Other', amount: 10 },
      { label: 'Other', amount: 20 },
    ]);
    expect(new Set(r.tree.map((n) => n.n)).size).toBe(2);
    expect(r.tree.reduce((s, n) => s + n.a, 0)).toBe(30);
  });

  it('drops zero and blank amounts, and unlabelled columns', () => {
    const r = buildOhioTree([
      { label: 'Police', amount: 0 },
      { label: '', amount: 500 },
      { label: 'Fire', amount: null },
      { label: 'Health', amount: 7 },
    ]);
    expect(r.tree).toEqual([{ n: 'Health', a: 7 }]);
  });

  it('sorts descending by amount, as the loader always has', () => {
    const r = buildOhioTree([
      { label: 'Small', amount: 1 }, { label: 'Big', amount: 9 }, { label: 'Mid', amount: 5 },
    ]);
    expect(r.tree.map((n) => n.n)).toEqual(['Big', 'Mid', 'Small']);
  });
});
