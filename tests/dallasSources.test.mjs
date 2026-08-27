import { describe, it, expect } from 'vitest';
import {
  DALLAS_SOURCES,
  DALLAS_FISCAL_YEAR_START_MONTH,
  dallasDatasetUrl,
  repoDialectHierarchy,
} from '../scripts/lib/dallasSources.mjs';
import { buildBudgetTree } from '../scripts/buildBudgetTree.mjs';

/**
 * Port of the tree builder inside supabase/functions/treasury-sync/index.ts.
 *
 * The edge function is Deno TypeScript and calls Deno.serve() at import time, so
 * it cannot be imported here. This mirrors its buildBudgetTree exactly — INCLUDING
 * the fallbacks that caused the Dallas defect — so a dialect regression fails a
 * test instead of silently writing $0 to production.
 */
function edgeBuildBudgetTree(rows, cm) {
  const hCols = cm.hierarchy_columns || ['department_name', 'fund_name', 'account_name'];
  const ac = cm.amount_column || 'total_budget';
  const amt = v => {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
  };
  const mk = () => ({ a: 0, ch: new Map(), rs: [] });
  const root = mk();
  for (const r of rows) {
    const approved = amt(r[ac]);
    const actual = cm.actual_amount_column ? amt(r[cm.actual_amount_column]) : 0;
    if (approved === 0 && actual === 0) continue;
    let n = root;
    for (const c of hCols) {
      const k = r[c] || 'Unknown';
      if (!n.ch.has(k)) n.ch.set(k, mk());
      n = n.ch.get(k);
    }
    n.a += approved;
    n.rs.push(r);
  }
  const rc = n => {
    if (n.ch.size === 0) return n.a;
    let t = 0;
    for (const [, c] of n.ch) t += rc(c);
    n.a = t;
    return t;
  };
  rc(root);
  const tj = n => {
    const a = [];
    for (const [nm, ch] of n.ch) {
      const o = { n: nm, a: ch.a };
      if (ch.ch.size === 0 && ch.rs.length > 0) {
        o.i = ch.rs.map(r => ({
          d: r[cm.description_column] || nm,
          a: cm.actual_amount_column ? amt(r[cm.actual_amount_column]) : null,
          aa: cm.approved_amount_column ? amt(r[cm.approved_amount_column]) : amt(r[ac]),
          f: cm.fund_column ? r[cm.fund_column] : null,
        }));
      } else if (ch.ch.size > 0) o.c = tj(ch);
      a.push(o);
    }
    a.sort((x, y) => y.a - x.a);
    return a;
  };
  return { tree: tj(root), total: root.a };
}

// Two real FY2026 operating rows, field names verbatim from dataset e2fs-y4nb.
const OPERATING_ROWS = [
  { bfy: '2026', appropriation: 'Police Department GF', service: 'Patrol', objectgroup: 'Personnel Services', budcurr: '600000', expbfy: '0', fundtype: 'General Fund' },
  { bfy: '2026', appropriation: 'Police Department GF', service: 'Patrol', objectgroup: 'Supplies', budcurr: '158330072', expbfy: '0', fundtype: 'General Fund' },
  { bfy: '2026', appropriation: 'Water Utilities DWU', service: 'Water Production', objectgroup: 'Personnel Services', budcurr: '901895629', expbfy: '0', fundtype: 'Enterprise Operating Fund' },
];

const REVENUE_ROWS = [
  { bfy: '2026', fundtype: 'General Fund', department: 'Revenue', revsource: 'Ad Valorem Tax', budcurr: '1000000', revbfy: '0' },
  { bfy: '2026', fundtype: 'General Fund', department: 'Revenue', revsource: 'Sales Tax', budcurr: '500000', revbfy: '0' },
];

const bySlug = Object.fromEntries(DALLAS_SOURCES.map(s => [s.dataset_type, s]));

describe('Dallas source definitions', () => {
  it('defines exactly the operating and revenue sources', () => {
    expect(DALLAS_SOURCES.map(s => s.dataset_type).sort()).toEqual(['operating', 'revenue']);
  });

  it('pins the Socrata dataset ids so provenance cannot be lost again', () => {
    expect(bySlug.operating.dataset_id).toBe('e2fs-y4nb');
    expect(bySlug.revenue.dataset_id).toBe('rtn4-pmj9');
    expect(dallasDatasetUrl('e2fs-y4nb')).toBe('https://www.dallasopendata.com/d/e2fs-y4nb');
  });

  it('sets fiscal_year_start_month explicitly on every source (PR #69 made it NOT NULL)', () => {
    for (const s of DALLAS_SOURCES) {
      expect(s.fiscal_year_start_month).toBe(DALLAS_FISCAL_YEAR_START_MONTH);
      expect(s.fiscal_year_start_month).toBe(10); // Dallas FY starts Oct 1
    }
  });
});

describe('the two column_mapping dialects agree', () => {
  it.each(DALLAS_SOURCES)('$name declares both dialects', src => {
    const cm = src.column_mapping;
    // edge-function dialect must be present — its absence IS the Dallas defect
    expect(Array.isArray(cm.hierarchy_columns)).toBe(true);
    expect(cm.hierarchy_columns).toHaveLength(3);
    expect(cm.amount_column).toBeTruthy();
    // repo-loader dialect must be present too
    expect(cm.category_column).toBeTruthy();
    expect(cm.approved_amount_column).toBeTruthy();
  });

  it.each(DALLAS_SOURCES)('$name describes ONE tree in both dialects', src => {
    const cm = src.column_mapping;
    expect(cm.hierarchy_columns).toEqual(repoDialectHierarchy(cm));
    expect(cm.amount_column).toBe(cm.approved_amount_column);
  });
});

describe('edge-function tree build (the loader that actually runs Dallas)', () => {
  it('rolls operating up to a non-zero total under real category names', () => {
    const { tree, total } = edgeBuildBudgetTree(OPERATING_ROWS, bySlug.operating.column_mapping);
    expect(total).toBe(1060825701);
    expect(tree.map(t => t.n)).toEqual(['Water Utilities DWU', 'Police Department GF']);
    expect(tree.map(t => t.n)).not.toContain('Unknown');
    expect(tree[0].a).toBe(901895629);
  });

  it('rolls revenue up under fund > department > source', () => {
    const { tree, total } = edgeBuildBudgetTree(REVENUE_ROWS, bySlug.revenue.column_mapping);
    expect(total).toBe(1500000);
    expect(tree[0].n).toBe('General Fund');
    expect(tree[0].c[0].c.map(l => l.n).sort()).toEqual(['Ad Valorem Tax', 'Sales Tax']);
  });

  it('reproduces the defect when the edge-function dialect is missing', () => {
    // The pre-fix Dallas mapping: repo dialect only. Rows carry non-zero actuals so
    // they survive the all-zero drop and the shape of the original defect stays
    // visible — every hierarchy level keying to the literal "Unknown".
    const brokenCm = { ...bySlug.operating.column_mapping };
    delete brokenCm.hierarchy_columns;
    delete brokenCm.amount_column;
    const rowsWithActuals = OPERATING_ROWS.map(r => ({ ...r, expbfy: '500' }));

    const { tree, total } = edgeBuildBudgetTree(rowsWithActuals, brokenCm);
    expect(total).toBe(0);                       // -> budgets.total_budget = 0
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('Unknown');           // -> the Unknown > Unknown > Unknown chain
    expect(tree[0].c[0].n).toBe('Unknown');
    expect(tree[0].c[0].c[0].n).toBe('Unknown');
    expect(tree[0].c[0].c[0].i.every(i => i.d === 'Unknown')).toBe(true);
  });

  it('and with the zero-drop in place, the wrong dialect collapses to nothing', () => {
    // Dallas's real rows have expbfy 0, so under the wrong dialect every row is
    // all-zero and drops: empty tree, total 0, which trips the zero-total guard
    // before anything is written. Two independent defences now.
    const brokenCm = { ...bySlug.operating.column_mapping };
    delete brokenCm.hierarchy_columns;
    delete brokenCm.amount_column;
    const { tree, total } = edgeBuildBudgetTree(OPERATING_ROWS, brokenCm);
    expect(total).toBe(0);
    expect(tree).toEqual([]);
  });
});

describe('repo-loader tree build agrees with the edge function', () => {
  it('produces the same total and the same top-level category names', () => {
    const cm = bySlug.operating.column_mapping;
    const edge = edgeBuildBudgetTree(OPERATING_ROWS, cm);
    const repo = buildBudgetTree(OPERATING_ROWS, cm);
    expect(repo.total).toBe(edge.total);
    expect(repo.jsonTree.map(t => t.n).sort()).toEqual(edge.tree.map(t => t.n).sort());
  });
});

describe('actual_amount must not silently mirror the budget', () => {
  // _treasury_insert_tree maps i.aa -> approved_amount and i.a -> actual_amount.
  // Pointing amount_column at budcurr (needed for the rollup) previously also drove
  // i.a, so actual_amount came back exactly equal to the budget.
  it('reads i.a from actual_amount_column, not amount_column', () => {
    const cm = bySlug.operating.column_mapping;
    expect(cm.actual_amount_column).toBe('expbfy');

    const rows = [
      { appropriation: 'Police Department GF', service: 'Patrol', objectgroup: 'Supplies',
        budcurr: '1000', expbfy: '250', fundtype: 'General Fund' },
    ];
    const { tree, total } = edgeBuildBudgetTree(rows, cm);
    const item = tree[0].c[0].c[0].i[0];

    expect(total).toBe(1000);
    expect(item.aa).toBe(1000); // -> approved_amount
    expect(item.a).toBe(250);   // -> actual_amount, NOT 1000
    expect(item.a).not.toBe(item.aa);
  });

  it('leaves actual NULL — never the budget — when no actual_amount_column is declared', () => {
    // San Francisco's case: xdgd-c79v publishes no actuals. Falling back to the
    // rollup amount here would make every row claim the city spent its budget
    // exactly, which is the defect PR #83 introduced and had to undo.
    const cm = { ...bySlug.operating.column_mapping };
    delete cm.actual_amount_column;
    const rows = [{ appropriation: 'A', service: 'B', objectgroup: 'C', budcurr: '1000', expbfy: '250' }];
    const item = edgeBuildBudgetTree(rows, cm).tree[0].c[0].c[0].i[0];
    expect(item.a).toBeNull();
    expect(item.aa).toBe(1000);
  });

  it('falls approved back to amount_column when approved_amount_column is absent', () => {
    // LA Open Budget Appropriations: amount_column only. Without this fallback the
    // money reached NEITHER line-item column.
    const cm = { ...bySlug.operating.column_mapping };
    delete cm.approved_amount_column;
    const rows = [{ appropriation: 'A', service: 'B', objectgroup: 'C', budcurr: '1000', expbfy: '250' }];
    const item = edgeBuildBudgetTree(rows, cm).tree[0].c[0].c[0].i[0];
    expect(item.aa).toBe(1000);
    expect(item.a).toBe(250);
  });
});

describe('the edge builder drops all-zero rows, like the repo builder', () => {
  const cm = () => ({ ...bySlug.operating.column_mapping });

  it('drops a row whose budget AND actual are both zero', () => {
    const rows = [
      { appropriation: 'A', service: 'S', objectgroup: 'O', budcurr: '100', expbfy: '0' },
      { appropriation: 'Z', service: 'S', objectgroup: 'O', budcurr: '0', expbfy: '0' },
    ];
    const { tree, total } = edgeBuildBudgetTree(rows, cm());
    expect(total).toBe(100);
    expect(tree.map((t) => t.n)).toEqual(['A']);
  });

  it('KEEPS a zero-budget row that has real actual spending', () => {
    // Dallas has 125 FY2025 rows with a blank appropriation and budcurr 0 carrying
    // $880k of expbfy. Dropping those would lose real spending.
    const rows = [{ appropriation: '', service: 'S', objectgroup: 'O', budcurr: '0', expbfy: '880009.60' }];
    const { tree, total } = edgeBuildBudgetTree(rows, cm());
    expect(total).toBe(0);
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('Unknown');
    expect(tree[0].c[0].c[0].i[0].a).toBe(880009.6);
  });

  it('drops zero rows when the source declares no actual column at all', () => {
    const c = cm();
    delete c.actual_amount_column;
    const rows = [
      { appropriation: 'A', service: 'S', objectgroup: 'O', budcurr: '100' },
      { appropriation: 'Z', service: 'S', objectgroup: 'O', budcurr: '0' },
    ];
    expect(edgeBuildBudgetTree(rows, c).tree.map((t) => t.n)).toEqual(['A']);
  });
});
