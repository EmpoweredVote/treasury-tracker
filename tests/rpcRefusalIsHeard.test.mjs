/**
 * A refusal the caller cannot hear is not a refusal.
 *
 * ⚠⚠⚠ THE PREREQUISITE FOR THE REGISTRY GATE. `treasury_sync_city_budget`
 * reports failure INSIDE a successful PostgREST call — it returns
 * `jsonb_build_object('error', …)` and supabase-js hands back `error: null`.
 * `scripts/lib/rpcResult.mjs` exists to classify that, and documents the bug
 * it was written for: a truthiness check conflated *refused*, *legitimately
 * wrote nothing*, and *success*, so a refused write printed a success line
 * with a quietly smaller number.
 *
 * Measured 2026-11-01: 32 of the 34 call sites still have that shape. They
 * test the TRANSPORT error (`error` from supabase-js) and never the PAYLOAD
 * error. Arming the gate before fixing them would convert silent bad data
 * into a silent no-op, which is worse — the operator sees a success line,
 * nothing is written, and they re-run it.
 *
 * This file pins the contract for the loaders as they are converted:
 *
 *     refused   -> THROW. A write that did not happen must never read as one
 *                  that did, and throwing exits the CLI non-zero for free.
 *     skipped   -> null. The never-overwrite guard declining is legitimate.
 *     written   -> the RPC payload.
 */

import { describe, it, expect } from 'vitest';
import { importDataset } from '../scripts/loadVAComparativeReport.js';
import { importDataset as importOhio } from '../scripts/loadOhioAOS.js';
import { importDataset as importMnOsa } from '../scripts/loadMNOSA.js';

/** A Supabase stub whose RPC returns exactly what the real one returns. */
function stubClient(rpcPayload) {
  return {
    rpc: async () => ({ data: rpcPayload, error: null }),
    // findConflictingBudget() queries budgets; no conflict, so the write proceeds.
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: function eq() { return this; },
          limit: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    from: () => ({
      select: () => ({
        eq: function eq() { return this; },
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    }),
  };
}

const ARGS = [
  '00000000-0000-0000-0000-000000000000', 2024, 'revenue',
  [{ n: 'Taxes', a: 1 }], 1, 'https://example.invalid/report', '2026-11-01',
];

describe('a refused write is heard by the caller', () => {
  it('throws when the RPC refuses in its payload', async () => {
    const refusal = 'unregistered source family: Virginia APA Comparative Report '
      + '(unmatched: audit_grade, fund_scope, basis, accounting_basis)';
    await expect(importDataset(stubClient({ error: refusal }), ...ARGS))
      .rejects.toThrow(/unregistered source family/);
  });

  it('the thrown message carries the reason, so the operator can act on it', async () => {
    const refusal = 'row has no source_url';
    await expect(importDataset(stubClient({ error: refusal }), ...ARGS))
      .rejects.toThrow(/no source_url/);
  });

  // ⚠ The other half of the original bug, and the reason this is not just a
  // truthiness check: `rows_inserted: 0` is a LEGITIMATE success — a budget
  // with no line items — and is also falsy. It must not be mistaken for a
  // refusal now that refusals throw.
  it('does not throw when the RPC legitimately wrote nothing', async () => {
    await expect(importDataset(stubClient({ rows_inserted: 0 }), ...ARGS))
      .resolves.toEqual({ rows_inserted: 0 });
  });

  it('returns the payload on a normal write', async () => {
    await expect(importDataset(stubClient({ rows_inserted: 4 }), ...ARGS))
      .resolves.toEqual({ rows_inserted: 4 });
  });
});

/**
 * ⚠⚠ THE CONVERSION WAS TESTED ON ONE LOADER OUT OF FIFTEEN. Code review
 * flagged it, and it was the right flag: the one place the conversion broke
 * surrounding design (bulkLoadStateController's per-city failure path) was in
 * an unconverted-by-test file. These cover two more writers that take their
 * client as an argument, so the contract is pinned on more than a sample.
 *
 * ⚠ The remaining twelve are not unit-testable without refactoring: they take
 * no client, or do the RPC inline in a main(). That is a real gap and is
 * recorded as such rather than papered over.
 */
describe('the refusal contract holds across the converted loaders', () => {
  const REFUSAL = 'unregistered source family: X (unmatched: audit_grade)';

  const cases = [
    ['loadOhioAOS', (c) => importOhio(
      c, '00000000-0000-0000-0000-000000000000', 'Testville', 2024, 'revenue',
      [{ n: 'Taxes', a: 1 }], 1, 'https://example.invalid/x.XLSX', '2026-11-02',
    )],
    ['loadMNOSA', (c) => importMnOsa(
      c, '00000000-0000-0000-0000-000000000000', 2024, 'revenue',
      [{ n: 'Taxes', a: 1 }], 1, 'https://example.invalid/x.xlsx', '2026-11-02',
    )],
  ];

  for (const [name, call] of cases) {
    it(`${name} throws on a payload refusal`, async () => {
      await expect(call(stubClient({ error: REFUSAL }))).rejects.toThrow(/unregistered source family/);
    });

    // The other half of the original bug: rows_inserted 0 is a LEGITIMATE
    // success (a budget with no line items) and is also falsy.
    it(`${name} does not throw when the RPC legitimately wrote nothing`, async () => {
      await expect(call(stubClient({ rows_inserted: 0 }))).resolves.toBeDefined();
    });
  }
});
