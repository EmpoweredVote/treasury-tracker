import { describe, it, expect } from 'vitest';
import { classifySyncResult } from '../scripts/lib/rpcResult.mjs';

/**
 * `treasury_sync_city_budget` reports failure INSIDE a successful PostgREST call.
 * Both its ambiguity guard and its blanket `EXCEPTION WHEN OTHERS` handler do
 * `RETURN jsonb_build_object('error', ...)`, so supabase-js reports `error: null`
 * and the payload carries the failure. bulkLoadStateController.js then tested
 * `if (result && result.rows_inserted)`, which is falsy for `{error}` — so a
 * refused write was counted as "nothing to do", with no message and no non-zero
 * exit. That single truthiness check conflated three different outcomes; these
 * tests pin all three apart.
 */
describe('classifySyncResult', () => {
  it('FAILS on the ambiguity guard — the case SCOPE-02 built and nobody read', () => {
    const r = classifySyncResult({
      error: 'ambiguous target: 2 rows match (muni=abc fy=2024 dataset=operating '
           + 'fund_scope=all_funds basis=actual)',
    });
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('rpc');
    expect(r.message).toMatch(/ambiguous target: 2 rows match/);
  });

  it('FAILS on any SQL exception, not just ambiguity', () => {
    // The function ends `EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object(
    // 'error', SQLERRM)`, so EVERY database error arrives by this same door.
    // Scoping the fix to the ambiguity guard alone would leave the rest silent.
    const r = classifySyncResult({ error: 'duplicate key value violates unique constraint' });
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('rpc');
  });

  it('SUCCEEDS with rows_inserted 0 — a real import that happened to add no items', () => {
    // The second bug hiding in the same line: 0 is falsy, so a legitimate
    // zero-item success was silently uncounted and the city never reported.
    const r = classifySyncResult({ status: 'success', rows_inserted: 0, total_budget: 5 });
    expect(r.ok).toBe(true);
    expect(r.rowsInserted).toBe(0);
  });

  it('succeeds normally', () => {
    const r = classifySyncResult({ status: 'success', budget_id: 'x', rows_inserted: 42 });
    expect(r).toMatchObject({ ok: true, rowsInserted: 42 });
  });

  it('FAILS on null — the transport-error path importCityData returns', () => {
    const r = classifySyncResult(null);
    expect(r.ok).toBe(false);
    expect(r.kind).toBe('transport');
  });

  it('FAILS on a payload with neither error nor a numeric rows_inserted', () => {
    // Fails CLOSED. An unrecognised shape means the contract changed, and
    // guessing "probably fine" is how the original bug read.
    expect(classifySyncResult({ status: 'success' }).ok).toBe(false);
    expect(classifySyncResult({ status: 'success' }).kind).toBe('malformed');
    expect(classifySyncResult({ rows_inserted: '42' }).ok).toBe(false);
  });

  it('never reports ok for a payload carrying an error, whatever else it holds', () => {
    // Defensive: if a future version returns both, the error must win.
    const r = classifySyncResult({ error: 'boom', status: 'success', rows_inserted: 99 });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('boom');
  });
});
