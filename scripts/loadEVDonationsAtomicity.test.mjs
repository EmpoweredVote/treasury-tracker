import { test, describe } from 'vitest';
import assert from 'node:assert/strict';
import { reapplyWebhookDelta, headerTreeMismatch } from './loadEVDonations.js';

/**
 * Two writers keep EV's revenue budget: this loader, and the live Givebutter
 * webhook (edge function -> treasury.record_givebutter_donation).
 *
 * ⚠⚠ THEY MUST AGREE ON HOW TO WRITE, NOT JUST ON WHAT. The RPC is atomic:
 *
 *     UPDATE treasury.budgets SET total_budget = total_budget + p_amount ...
 *
 * while this loader used to do a read-modify-write:
 *
 *     const { data: b } = await sb.from('budgets').select('total_budget')...  // reads T
 *     await sb.from('budgets').update({ total_budget: Number(b.total_budget) + sum })
 *
 * A webhook donation landing between those two statements is erased from the
 * HEADER while the category amounts keep it, because the RPC increments those
 * atomically too. The signature is `total_budget` understated relative to the
 * tree by exactly one donation — which is what was observed on 2026-09-20
 * ($4,770.40 header vs $4,990.40 tree, categories correct).
 *
 * The same hazard applied to the two budget_categories updates.
 *
 * ⚠ The fix is not "add a lock". It is to route the loader through THE SAME
 * atomic RPC the webhook already uses, so there is one write path and no
 * read-modify-write anywhere.
 */

/** A fake supabase client that records calls and fails loudly on unexpected ones. */
function fakeSb({ categories }) {
  const calls = [];
  const api = {
    calls,
    rpc(name, args) {
      calls.push({ kind: 'rpc', name, args });
      return Promise.resolve({ error: null });
    },
    from(table) {
      const q = { table, _filters: [] };
      q.select = () => { calls.push({ kind: 'select', table }); return q; };
      q.eq = () => q;
      q.is = () => q;
      q.single = () => Promise.resolve({ data: categories, error: null });
      q.maybeSingle = () => Promise.resolve({ data: categories, error: null });
      q.insert = (payload) => {
        calls.push({ kind: 'insert', table, payload });
        return Promise.resolve({ data: null, error: null });
      };
      q.update = (payload) => {
        calls.push({ kind: 'update', table, payload });
        return Promise.resolve({ data: null, error: null });
      };
      q.then = (res) => res({ data: categories, error: null });
      return q;
    },
  };
  return api;
}

const CATS = [
  { id: 'gb-id', name: 'Give Butter', parent_id: 'don-id', amount: 753 },
  { id: 'don-id', name: 'Donations', parent_id: null, amount: 4768 },
];

const DELTA = [
  { actual_amount: 120, description: 'd1', vendor: 'GiveButter', date: '2026-09-15', external_id: 'x1' },
  { actual_amount: 100, description: 'd2', vendor: 'GiveButter', date: '2026-09-16', external_id: 'x2' },
];

describe('reapplyWebhookDelta — one write path, no read-modify-write', () => {
  test('returns the delta sum', async () => {
    const sb = fakeSb({ categories: CATS });
    assert.equal(await reapplyWebhookDelta(sb, 'budget-1', DELTA), 220);
  });

  test('is a no-op for an empty delta', async () => {
    const sb = fakeSb({ categories: CATS });
    assert.equal(await reapplyWebhookDelta(sb, 'budget-1', []), 0);
    assert.equal(sb.calls.length, 0);
  });

  test('⭐ routes every row through the SAME atomic RPC the webhook uses', async () => {
    const sb = fakeSb({ categories: CATS });
    await reapplyWebhookDelta(sb, 'budget-1', DELTA);
    const rpcs = sb.calls.filter(c => c.kind === 'rpc');
    assert.equal(rpcs.length, 2, 'one RPC per delta row');
    for (const r of rpcs) assert.equal(r.name, 'record_givebutter_donation');
    assert.deepEqual(
      rpcs.map(r => r.args.p_amount).sort((a, b) => a - b), [100, 120]
    );
    // It must address the same budget and the same leaf/parent the webhook would.
    for (const r of rpcs) {
      assert.equal(r.args.p_budget_id, 'budget-1');
      assert.equal(r.args.p_leaf_category_id, 'gb-id');
      assert.equal(r.args.p_parent_category_id, 'don-id');
    }
  });

  test('⚠⚠ NEVER writes total_budget from a value it read first', async () => {
    // The defect, stated directly. A read-modify-write on budgets is what let a
    // concurrent webhook donation be erased from the header.
    const sb = fakeSb({ categories: CATS });
    await reapplyWebhookDelta(sb, 'budget-1', DELTA);
    const budgetUpdates = sb.calls.filter(c => c.kind === 'update' && c.table === 'budgets');
    assert.deepEqual(budgetUpdates, [], 'no direct update to budgets');
  });

  test('⚠⚠ NEVER writes a category amount from a value it read first', async () => {
    const sb = fakeSb({ categories: CATS });
    await reapplyWebhookDelta(sb, 'budget-1', DELTA);
    const catUpdates = sb.calls.filter(c => c.kind === 'update' && c.table === 'budget_categories');
    assert.deepEqual(catUpdates, [], 'no direct update to budget_categories');
  });

  test('does not hand-insert line items — the RPC owns that, idempotently', async () => {
    const sb = fakeSb({ categories: CATS });
    await reapplyWebhookDelta(sb, 'budget-1', DELTA);
    const inserts = sb.calls.filter(c => c.kind === 'insert');
    assert.deepEqual(inserts, []);
  });

  test('surfaces an RPC error instead of discarding it', async () => {
    const sb = fakeSb({ categories: CATS });
    sb.rpc = () => Promise.resolve({ error: { message: 'boom' } });
    await assert.rejects(
      () => reapplyWebhookDelta(sb, 'budget-1', DELTA),
      /boom/,
      'the original code discarded the error on every write, which is why the '
      + '2026-09-20 incident left no trace to diagnose'
    );
  });

  test('still refuses when the Give Butter category is missing', async () => {
    const sb = fakeSb({ categories: [{ id: 'x', name: 'Other', parent_id: null, amount: 1 }] });
    await assert.rejects(() => reapplyWebhookDelta(sb, 'budget-1', DELTA), /Give Butter/);
  });
});

describe('headerTreeMismatch — the invariant that makes a divergence visible', () => {
  test('passes when the header equals the top-level sum', () => {
    assert.equal(headerTreeMismatch(4990.40, [{ amount: 4988 }, { amount: 2.40 }]), null);
  });

  test('⭐ catches the exact 2026-09-20 divergence', () => {
    // header $4,770.40 vs tree $4,990.40 — understated by the $220 webhook delta.
    const m = headerTreeMismatch(4770.40, [{ amount: 4988 }, { amount: 2.40 }]);
    assert.ok(m, 'must report a mismatch');
    assert.equal(m.expected, 4990.40);
    assert.equal(m.actual, 4770.40);
    assert.equal(Math.round(m.diff * 100) / 100, -220);
  });

  test('tolerates float noise but not a real cent', () => {
    assert.equal(headerTreeMismatch(100.00, [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }]), null);
    assert.ok(headerTreeMismatch(100.01, [{ amount: 33.33 }, { amount: 33.33 }, { amount: 33.34 }]));
  });

  test('counts only top-level rows — a tree sums its parents, not its children', () => {
    // Summing every row double-counts: parents already contain their children.
    // (This is the mistake I made reading the DB during diagnosis.)
    assert.equal(headerTreeMismatch(10, [{ amount: 10 }]), null);
  });
});
