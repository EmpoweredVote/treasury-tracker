/**
 * Rolling transactions up into a category tree.
 *
 * ⚠⚠ The defect these guard against is not an arithmetic one. The McKinney
 * tree summed correctly, tied to its headline and passed every gate while its
 * largest-but-one root pointed at nothing — because the rows beneath it had
 * lost their key and the rollup that built it was a one-off nobody could re-run.
 */
import { describe, it, expect } from 'vitest';
import { rollUpTransactions, diffTree } from '../scripts/lib/transactionTree.mjs';
import { resolverFor, isEnrolled } from '../scripts/lib/transactionTreeSources.mjs';

const byKey = (names) => (keys) => new Map(keys.map((k) => [k, names[k] ?? `Key ${k}`]));

describe('rollUpTransactions', () => {
  it('groups by link_key and sums', () => {
    const { roots, total } = rollUpTransactions(
      [{ link_key: 'a', amount: 10 }, { link_key: 'b', amount: 5 }, { link_key: 'a', amount: 2.5 }],
      byKey({ a: 'Alpha', b: 'Beta' }),
    );
    expect(total).toBe(17.5);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toMatchObject({ link_key: 'a', name: 'Alpha', amount: 12.5, item_count: 2 });
    // ⚠ A register records money already spent: the actual IS the amount.
    expect(roots[0].actual_amount).toBe(12.5);
    expect(roots[1]).toMatchObject({ link_key: 'b', name: 'Beta', amount: 5, item_count: 1 });
  });

  it('orders by amount descending and stamps sort_order', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'small', amount: 1 }, { link_key: 'big', amount: 100 }],
      byKey({ small: 'Small', big: 'Big' }),
    );
    expect(roots.map((r) => r.link_key)).toEqual(['big', 'small']);
    // 1-based, matching every transaction-backed tree already stored.
    expect(roots.map((r) => r.sort_order)).toEqual([1, 2]);
  });

  it('computes percentages that sum to ~100', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: 'b', amount: 2 }, { link_key: 'c', amount: 1 }],
      byKey({ a: 'A', b: 'B', c: 'C' }),
    );
    expect(roots.reduce((s, r) => s + r.percentage, 0)).toBeCloseTo(100, 3);
  });

  // ⚠⚠⚠ The refusal that matters. $79.1M once went into an "Unknown" bucket.
  it('REFUSES a null link_key instead of bucketing it', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 10 }, { link_key: null, amount: 79113309.51 }],
      byKey({ a: 'Alpha' }),
    )).toThrow(/have NO link_key/);
  });

  it('names the money it is refusing, so the refusal is actionable', () => {
    let msg = '';
    try {
      rollUpTransactions([{ link_key: null, amount: 1234.5 }], byKey({}));
    } catch (e) { msg = e.message; }
    expect(msg).toMatch(/1,234\.5/);
    expect(msg).toMatch(/do NOT bucket them/);
  });

  it('treats an empty-string key as missing too', () => {
    expect(() => rollUpTransactions([{ link_key: '', amount: 1 }], byKey({}))).toThrow(/NO link_key/);
  });

  it('refuses to write an empty tree', () => {
    expect(() => rollUpTransactions([], byKey({}))).toThrow(/no transactions/);
  });

  it('refuses when the resolver has no name for a key', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }],
      () => new Map(),
    )).toThrow(/resolver returned nothing/);
  });

  // ⛔ A duplicate label is the original McKinney symptom.
  it('refuses duplicate root labels', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: 'b', amount: 2 }],
      byKey({ a: 'Same', b: 'Same' }),
    )).toThrow(/duplicate root label/);
  });

  it('says not to append the key to separate duplicates', () => {
    let msg = '';
    try {
      rollUpTransactions([{ link_key: 'a', amount: 1 }, { link_key: 'b', amount: 2 }], byKey({ a: 'S', b: 'S' }));
    } catch (e) { msg = e.message; }
    expect(msg).toMatch(/would make an unsourced name look sourced/);
  });

  it('rounds the total to cents once, not per row', () => {
    const txns = Array.from({ length: 3 }, () => ({ link_key: 'a', amount: 0.1 }));
    const { total, roots } = rollUpTransactions(txns, byKey({ a: 'A' }));
    expect(total).toBe(0.3);
    expect(roots[0].amount).toBe(0.3);
  });
});

describe('diffTree', () => {
  const roots = [
    { link_key: 'a', name: 'Alpha', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 1 },
    { link_key: 'b', name: 'Beta', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 2 },
  ];

  it('inserts a key that has no category', () => {
    const d = diffTree([{ id: '1', link_key: 'a', name: 'Alpha', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 1 }], roots);
    expect(d.inserts.map((i) => i.link_key)).toEqual(['b']);
    expect(d.updates).toHaveLength(0);
  });

  it('deletes a category whose key no longer appears', () => {
    const existing = [...roots.map((r, i) => ({ id: String(i), ...r })),
      { id: 'x', link_key: 'gone', name: 'Gone', amount: 1, actual_amount: 1, percentage: 0, item_count: 1, sort_order: 3 }];
    const d = diffTree(existing, roots);
    expect(d.deletes.map((x) => x.link_key)).toEqual(['gone']);
  });

  it('updates a renamed category and keeps its id', () => {
    const existing = [{ id: 'keep', link_key: 'a', name: 'Risk Management', amount: 10, percentage: 50, item_count: 1, sort_order: 1 },
      { id: '1', ...roots[1] }];
    const d = diffTree(existing, roots);
    expect(d.updates).toHaveLength(1);
    expect(d.updates[0].id).toBe('keep');
    expect(d.updates[0].after.name).toBe('Alpha');
  });

  it('is a no-op when nothing changed', () => {
    const existing = roots.map((r, i) => ({ id: String(i), ...r }));
    const d = diffTree(existing, roots);
    expect(d).toMatchObject({ inserts: [], updates: [], deletes: [] });
  });

  // ⚠⚠ Enrichment is paid for and slow to regenerate; a rebuild must not drop it.
  it('does not touch description or why_matters', () => {
    const existing = [{ id: 'k', link_key: 'a', name: 'Alpha', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 1,
                        description: 'written by enrichment', why_matters: 'also enrichment' },
                      { id: '1', ...roots[1] }];
    const d = diffTree(existing, roots);
    expect(d.updates).toHaveLength(0);
    expect(d.deletes).toHaveLength(0);
  });
});

describe('transactionTreeSources — enrolment is opt-in', () => {
  it('enrols the McKinney check registers', () => {
    expect(isEnrolled('McKinney Check Register FY2024')).toBe(true);
  });

  it('does NOT enrol sources whose naming rule nobody has checked', () => {
    for (const s of ['Frisco Check Register FY2026', 'Plano Check Register FY2025',
                     'West Hollywood Demand Register FY2024-25', 'McKinney Payroll Register FY2024']) {
      expect(isEnrolled(s), s).toBe(false);
      expect(resolverFor(s, 2024)).toBeNull();
    }
  });

  it('resolves McKinney codes to the publisher’s names', () => {
    const { resolveNames } = resolverFor('McKinney Check Register FY2024', 2024);
    const out = resolveNames(['2119', '4306', '9999']);
    expect(out.get('2119')).toBe('Internal Services - Information Technology');
    expect(out.get('4306')).toBe('Parks & Recreation - Parks Maintenance');
    expect(out.get('9999')).toBe('Non-Departmental');
  });

  it('keeps the publisher identifier for a code McKinney never names', () => {
    const { resolveNames } = resolverFor('McKinney Check Register FY2024', 2024);
    expect(resolveNames(['7777']).get('7777')).toBe('Department 7777');
    expect(resolveNames(['0']).get('0')).toBe('Department 0');
  });

  // ⚠ The alias exists so a rebuild run before the key backfill still names the
  // root correctly rather than refusing — the backfill is the real fix.
  it('maps the legacy `unknown` key to department 0', () => {
    const { resolveNames } = resolverFor('McKinney Check Register FY2024', 2024);
    expect(resolveNames(['unknown']).get('unknown')).toBe('Department 0');
  });

  it('cites the published source', () => {
    expect(resolverFor('McKinney Check Register FY2022', 2022).source).toMatch(/Adopted Budget Worksheets/);
  });
});

// ── Idempotence: the property that makes drift detectable ────────────────────
//
// ⚠⚠ If a rebuild rewrote rows even when nothing changed, "the tree disagrees
// with its transactions" would be indistinguishable from "the rebuild ran", and
// the gate would be noise. A no-change rebuild must be a no-op.
describe('a rebuild is a no-op when nothing changed', () => {
  const txns = [
    { link_key: '2119', amount: 100 }, { link_key: '2119', amount: 50 },
    { link_key: '4306', amount: 25 },  { link_key: '0', amount: 1000 },
  ];
  const resolve = resolverFor('McKinney Check Register FY2024', 2024).resolveNames;

  it('produces the same roots twice', () => {
    const a = rollUpTransactions(txns, resolve);
    const b = rollUpTransactions(txns, resolve);
    expect(b).toEqual(a);
  });

  it('diffs to nothing against its own output', () => {
    const { roots } = rollUpTransactions(txns, resolve);
    const stored = roots.map((r, i) => ({ id: `id-${i}`, ...r }));
    expect(diffTree(stored, roots)).toMatchObject({ inserts: [], updates: [], deletes: [] });
  });

  it('is insensitive to the order transactions arrive in', () => {
    const a = rollUpTransactions(txns, resolve);
    const b = rollUpTransactions([...txns].reverse(), resolve);
    expect(b.roots).toEqual(a.roots);
  });
});
