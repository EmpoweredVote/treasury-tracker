/**
 * Pure tree-building logic extracted from bulkLoadBudget.js
 *
 * Exported for unit testing and reuse. No side effects, no Supabase client.
 *
 * buildBudgetTree(rows, cm) — builds a 2-level or 3-level budget tree:
 *   - 2-level (cm.department_column absent): category → subcategory
 *   - 3-level (cm.department_column set):    department → category → subcategory
 */

// ── Amount parser ───────────────────────────────────────────────────────
export function parseAmount(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Tree builder ────────────────────────────────────────────────────────
/**
 * Build a compact budget tree from flat Socrata rows.
 *
 * @param {object[]} rows   - Raw Socrata row objects
 * @param {object}   cm     - column_mapping from data_sources
 *
 * column_mapping keys used:
 *   department_column     (optional) — if set, adds a 3rd (top) level above category
 *   category_column       (required) — depth-0 for 2-level; depth-1 for 3-level
 *   subcategory_column    (optional) — leaf grouping
 *   approved_amount_column (required)
 *   actual_amount_column  (optional)
 *   fund_column           (optional)
 *
 * Returns { jsonTree, total, kept, droppedZero }
 *
 * ⚠⚠ ITEM FIELD CONTRACT — `aa` IS THE APPROVED AMOUNT, `a` IS THE ACTUAL.
 *
 * `_treasury_insert_tree` (the RPC that persists this tree) does:
 *     approved_amount := (i->>'aa')::numeric
 *     actual_amount   := (i->>'a')::numeric
 *
 * This builder had it backwards — it emitted `{ a: approved, aa: actual }` — so
 * every entity it loaded stored its ADOPTED BUDGET in `actual_amount` and left
 * `approved_amount` NULL. San Francisco showed the effect: 19,299 line items
 * rendering as "Budgeted $0 / Actual $15.9B" with a nonsense variance, and a
 * sort key that was uniformly zero. The `total` was right the whole time, which
 * is why it went unnoticed — the headline number never moved.
 *
 * Node rollups therefore sum `i.aa`, NOT `i.a`: the tree is a budget tree, and
 * its node amounts must agree with `total`, which sums the approved figure.
 * If you add a loader, match this contract — the treasury-sync edge function
 * already does.
 *
 * 2-level shape:
 *   [{ n, a, c: [{ n, a, i: [{ d, a, aa, f, e }] }] }]
 *
 * 3-level shape:
 *   [{ n, a, c: [{ n, a, c: [{ n, a, i: [{ d, a, aa, f, e }] }] }] }]
 *
 * Backward compat: when department_column is absent, output is byte-for-byte
 * identical to the prior 2-level implementation.
 */
export function buildBudgetTree(rows, cm) {
  const deptCol = cm.department_column || null;   // NEW: optional depth-0 grouping above category
  const catCol = cm.category_column;
  const subCol = cm.subcategory_column;
  const approvedCol = cm.approved_amount_column;
  const actualCol = cm.actual_amount_column || null;
  const fundCol = cm.fund_column || null;

  if (!catCol || !approvedCol) {
    throw new Error('column_mapping must define category_column and approved_amount_column');
  }

  const tree = new Map();
  let total = 0;
  let kept = 0;
  let droppedZero = 0;

  for (const row of rows) {
    const approved = parseAmount(row[approvedCol]);
    const actual = actualCol ? parseAmount(row[actualCol]) : null;

    // Drop rows where both approved AND actual are 0
    if (approved === 0 && (actual === null || actual === 0)) {
      droppedZero++;
      continue;
    }

    if (deptCol) {
      // ── 3-level path (NEW) ──────────────────────────────────────────
      // Dept: null/empty → 'Unknown' (T-36-06 mitigation)
      const dept = row[deptCol] || 'Unknown';
      const cat  = row[catCol]  || 'Unknown';
      // Sub: when subcategory_column is absent, synthetic 'General' bucket
      const sub  = subCol ? (row[subCol] || 'General') : 'General';

      if (!tree.has(dept)) tree.set(dept, new Map());
      if (!tree.get(dept).has(cat)) tree.get(dept).set(cat, new Map());
      if (!tree.get(dept).get(cat).has(sub)) tree.get(dept).get(cat).set(sub, []);

      tree.get(dept).get(cat).get(sub).push({
        d: sub,
        a: actual,      // -> budget_line_items.actual_amount
        aa: approved,   // -> budget_line_items.approved_amount
        f: fundCol ? (row[fundCol] || null) : null,
        e: null,
      });
    } else {
      // ── 2-level path (UNCHANGED from original) ──────────────────────
      const cat = row[catCol] || 'Unknown';
      const sub = subCol ? (row[subCol] || 'General') : 'General';

      if (!tree.has(cat)) tree.set(cat, new Map());
      if (!tree.get(cat).has(sub)) tree.get(cat).set(sub, []);

      tree.get(cat).get(sub).push({
        d: sub,
        a: actual,      // -> budget_line_items.actual_amount
        aa: approved,   // -> budget_line_items.approved_amount
        f: fundCol ? (row[fundCol] || null) : null,
        e: null,
      });
    }

    total += approved;
    kept++;
  }

  // ── Convert Maps to compact JSON tree ─────────────────────────────────

  if (deptCol) {
    // ── 3-level conversion (NEW) ────────────────────────────────────────
    const jsonTree = [];
    for (const [deptName, cats] of tree) {
      let deptTotal = 0;
      const catNodes = [];
      for (const [catName, subs] of cats) {
        let catTotal = 0;
        const subNodes = [];
        for (const [subName, items] of subs) {
          const subTotal = items.reduce((s, i) => s + i.aa, 0);
          catTotal += subTotal;
          subNodes.push({ n: subName, a: subTotal, i: items });
        }
        subNodes.sort((a, b) => b.a - a.a);
        catNodes.push({ n: catName, a: catTotal, c: subNodes });
        deptTotal += catTotal;
      }
      catNodes.sort((a, b) => b.a - a.a);
      jsonTree.push({ n: deptName, a: deptTotal, c: catNodes });
    }
    jsonTree.sort((a, b) => b.a - a.a);
    return { jsonTree, total, kept, droppedZero };
  }

  // ── 2-level conversion (UNCHANGED from original) ──────────────────────
  const jsonTree = [];
  for (const [catName, subs] of tree) {
    let catTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.aa, 0);
      catTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  return { jsonTree, total, kept, droppedZero };
}
