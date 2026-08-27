import { describe, it, expect } from 'vitest';
import { buildBudgetTree } from '../scripts/buildBudgetTree.mjs';

/**
 * The item-field contract between every tree-building loader and the RPC that
 * persists the tree.
 *
 * `_treasury_insert_tree` does, verbatim:
 *
 *   INSERT INTO treasury.budget_line_items
 *     (category_id, description, approved_amount, actual_amount, fund, expense_category)
 *   SELECT v_cat_id, i->>'d', (i->>'aa')::numeric, (i->>'a')::numeric, i->>'f', i->>'e'
 *
 * So: **aa -> approved_amount, a -> actual_amount.** Full stop.
 *
 * scripts/buildBudgetTree.mjs emitted these backwards until 2026-08-27, which
 * stored the ADOPTED BUDGET in actual_amount and left approved_amount NULL for
 * every entity it loaded. The row `total` stayed correct throughout — that is
 * exactly why it survived: no headline number ever moved, and the pre-existing
 * tests asserted node shape and totals without ever checking which money column
 * an item's figure landed in.
 *
 * These tests exist so a future re-inversion fails here instead of in production.
 */

const CM = {
  category_column: 'dept',
  subcategory_column: 'fund',
  approved_amount_column: 'budget',
  actual_amount_column: 'spent',
};

const ROWS = [
  { dept: 'Public Health', fund: 'General', budget: '1000', spent: '900' },
  { dept: 'Public Health', fund: 'Grants', budget: '500', spent: '250' },
  { dept: 'Airport', fund: 'Enterprise', budget: '2000', spent: '2100' },
];

function leafItems(tree) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.i) out.push(...n.i);
      if (n.c) walk(n.c);
    }
  };
  walk(tree);
  return out;
}

describe('budget tree item-field contract (aa = approved, a = actual)', () => {
  it('puts the approved figure in aa and the actual in a', () => {
    const { jsonTree } = buildBudgetTree(ROWS, CM);
    const items = leafItems(jsonTree);
    expect(items).toHaveLength(3);

    const byApproved = new Map(items.map((i) => [i.aa, i]));
    expect([...byApproved.keys()].sort((x, y) => x - y)).toEqual([500, 1000, 2000]);
    expect(byApproved.get(1000).a).toBe(900);
    expect(byApproved.get(500).a).toBe(250);
    expect(byApproved.get(2000).a).toBe(2100);
  });

  it('never lets the approved figure land in a — the San Francisco defect', () => {
    const { jsonTree } = buildBudgetTree(ROWS, CM);
    for (const item of leafItems(jsonTree)) {
      // If these are swapped, approved_amount goes NULL and actual_amount
      // silently receives the budget.
      expect(item.aa).not.toBeNull();
      expect(item.aa).toBeGreaterThan(0);
    }
  });

  it('leaves a null when the source publishes no actuals (SF: actual_amount_column absent)', () => {
    const cm = { ...CM };
    delete cm.actual_amount_column;
    const { jsonTree, total } = buildBudgetTree(ROWS, cm);
    const items = leafItems(jsonTree);

    // approved_amount must still be fully populated...
    expect(items.map((i) => i.aa).sort((x, y) => x - y)).toEqual([500, 1000, 2000]);
    // ...and actual_amount must be NULL, not zero and not a copy of the budget.
    expect(items.every((i) => i.a === null)).toBe(true);
    expect(total).toBe(3500);
  });

  it('rolls node amounts up from aa so every level agrees with total', () => {
    const { jsonTree, total } = buildBudgetTree(ROWS, CM);
    expect(total).toBe(3500);
    expect(jsonTree.reduce((s, n) => s + n.a, 0)).toBe(total);
    for (const node of jsonTree) {
      expect(node.c.reduce((s, c) => s + c.a, 0)).toBe(node.a);
      for (const leaf of node.c) {
        expect(leaf.i.reduce((s, i) => s + i.aa, 0)).toBe(leaf.a);
      }
    }
  });

  it('still agrees with total when the source publishes no actuals', () => {
    // The regression that a naive a/aa swap causes: node rollups summing `a`
    // collapse to 0 the moment actual_amount_column is absent, which is the
    // common case for adopted-budget sources.
    const cm = { ...CM };
    delete cm.actual_amount_column;
    const { jsonTree, total } = buildBudgetTree(ROWS, cm);
    expect(total).toBe(3500);
    expect(jsonTree.reduce((s, n) => s + n.a, 0)).toBe(3500);
  });

  it('holds on the 3-level path too', () => {
    const cm = { ...CM, department_column: 'org' };
    const rows = ROWS.map((r) => ({ ...r, org: 'Citywide' }));
    const { jsonTree, total } = buildBudgetTree(rows, cm);
    const items = leafItems(jsonTree);
    expect(items.map((i) => i.aa).sort((x, y) => x - y)).toEqual([500, 1000, 2000]);
    expect(items.map((i) => i.a).sort((x, y) => x - y)).toEqual([250, 900, 2100]);
    expect(jsonTree.reduce((s, n) => s + n.a, 0)).toBe(total);
  });
});
