import { test, describe, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import { ensureBudget as ensureBankBudget, clearBudgetChildren as clearBankChildren } from './loadEVBank.js';
import { ensureBudget as ensureRevBudget, clearBudgetChildren as clearRevChildren } from './loadEVDonations.js';

/**
 * ⚠⚠ THE BUDGET ROW MUST SURVIVE A REFRESH.
 *
 * Both EV loaders used to DELETE the budgets row and INSERT a replacement, so
 * every refresh minted a new uuid. Two consequences, both measured 2026-09-21:
 *
 *  1. The frozen-figure digest's EV exclusion materialises to a STATIC ID LIST
 *     (scripts/data/liveSyncExcludedIds.json). New ids are not on it, so two EV
 *     FY2026 rows re-entered the digest and the invariant went red -- exactly
 *     what v2.37 believed it had prevented by registering the feeds as sources.
 *  2. The dead ids stayed behind in treasury.frozen_excluded_ids, which is where
 *     the 4 orphaned registrations came from. Every refresh added more.
 *
 * Keeping the id stable fixes both at the source: no re-snapshot per refresh,
 * no orphan accumulation.
 *
 * These tests drive the DB layer through a recording fake, so they need no
 * credential and run in the ordinary PR gate -- the same approach as
 * loadEVDonationsAtomicity.test.mjs.
 */

/** A fake supabase client that records every write and resolves chained calls. */
function fakeSb({ existingBudgetId = null, categoryIds = [] } = {}) {
  const calls = [];
  const from = (table) => {
    const q = { table, op: 'select' };
    q.select = () => q;
    q.eq = () => q;
    q.is = () => q;
    q.in = () => q;
    q.delete = () => { q.op = 'delete'; return q; };
    q.insert = (payload) => { q.op = 'insert'; calls.push({ kind: 'insert', table, payload }); return q; };
    q.update = (payload) => { q.op = 'update'; calls.push({ kind: 'update', table, payload }); return q; };
    q.maybeSingle = () => Promise.resolve({
      data: table === 'budgets' && existingBudgetId ? { id: existingBudgetId } : null,
      error: null,
    });
    q.single = () => Promise.resolve({ data: { id: 'NEWLY-INSERTED-ID' }, error: null });
    q.then = (res) => {
      if (q.op === 'delete') calls.push({ kind: 'delete', table });
      const data = table === 'budget_categories' ? categoryIds.map((id) => ({ id })) : null;
      return res({ data, error: null });
    };
    return q;
  };
  return { calls, from };
}

const deletesOf = (sb, table) => sb.calls.filter((c) => c.kind === 'delete' && c.table === table);

// Both loaders own the same shape, so both get the same guarantees.
const LOADERS = [
  { name: 'loadEVBank (operating)', ensure: ensureBankBudget, clear: clearBankChildren, datasetType: 'operating' },
  { name: 'loadEVDonations (revenue)', ensure: ensureRevBudget, clear: clearRevChildren, datasetType: 'revenue' },
];

for (const L of LOADERS) {
  describe(`${L.name} — the budgets row survives a refresh`, () => {
    test('returns the EXISTING budget id rather than minting a new one', async () => {
      const sb = fakeSb({ existingBudgetId: 'STABLE-ID' });

      const id = await L.ensure(sb, 'muni-1', 2026, 123.45);

      assert.equal(id, 'STABLE-ID', 'a refresh must reuse the existing budget row');
    });

    // ⚠ The whole point. A delete against `budgets` is what changed the uuid.
    test('never issues a delete against budgets', async () => {
      const sb = fakeSb({ existingBudgetId: 'STABLE-ID' });

      await L.ensure(sb, 'muni-1', 2026, 123.45);

      assert.deepEqual(deletesOf(sb, 'budgets'), [], 'the budgets row must not be deleted');
    });

    test('inserts on a first-ever load, when no row exists yet', async () => {
      const sb = fakeSb({ existingBudgetId: null });

      const id = await L.ensure(sb, 'muni-1', 2026, 123.45);

      assert.equal(id, 'NEWLY-INSERTED-ID');
      const inserts = sb.calls.filter((c) => c.kind === 'insert' && c.table === 'budgets');
      assert.equal(inserts.length, 1, 'a first load still inserts the row');
      assert.equal(inserts[0].payload.dataset_type, L.datasetType);
      assert.equal(inserts[0].payload.municipality_id, 'muni-1');
      assert.equal(inserts[0].payload.fiscal_year, 2026);
    });

    test('clearBudgetChildren removes line items and categories but not the budget', async () => {
      const sb = fakeSb({ existingBudgetId: 'STABLE-ID', categoryIds: ['c1', 'c2'] });

      await L.clear(sb, 'STABLE-ID');

      assert.equal(deletesOf(sb, 'budget_line_items').length, 1, 'line items must be cleared');
      assert.equal(deletesOf(sb, 'budget_categories').length, 1, 'categories must be cleared');
      assert.deepEqual(deletesOf(sb, 'budgets'), [], 'the budgets row must survive');
    });

    // A category removed upstream must not linger. Clearing has to happen even
    // when the tree is currently empty, or a stale child could outlive its data.
    test('clearBudgetChildren still clears categories when none have line items', async () => {
      const sb = fakeSb({ existingBudgetId: 'STABLE-ID', categoryIds: [] });

      await L.clear(sb, 'STABLE-ID');

      assert.equal(deletesOf(sb, 'budget_categories').length, 1);
      assert.deepEqual(deletesOf(sb, 'budgets'), []);
    });
  });
}
