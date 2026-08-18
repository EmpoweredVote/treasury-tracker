/**
 * Classify what `treasury_sync_city_budget` actually returned.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * The RPC reports failure INSIDE a successful PostgREST call. Two paths do it:
 *
 *   the ambiguity guard   RETURN jsonb_build_object('error', 'ambiguous target: …')
 *   EXCEPTION WHEN OTHERS RETURN jsonb_build_object('error', SQLERRM)
 *
 * Both are ordinary RETURNs, so supabase-js hands back `error: null` and the
 * failure travels in the payload. `bulkLoadStateController.js` tested
 * `if (result && result.rows_inserted)`, which is falsy for `{error}` — so a
 * REFUSED WRITE was treated as "nothing to do": no message, no count, no
 * non-zero exit. The run printed a success line with a quietly smaller number.
 *
 * That one truthiness check conflated three outcomes, and the second one bit
 * just as hard: `rows_inserted: 0` is a legitimate success (a budget with no
 * line items) and is ALSO falsy, so it was silently uncounted.
 *
 * ⚠ The blanket EXCEPTION handler is why this must not be scoped to the
 * ambiguity guard. Every database error inside that function — constraint
 * violation, type error, anything — arrives through the same door.
 *
 * Fails CLOSED: an unrecognised payload is a failure, not an assumption that it
 * probably worked. Guessing "probably fine" is exactly how the original read.
 *
 * @param {null | {error?: string, status?: string, rows_inserted?: number}} result
 *   the RPC payload, or null when the caller hit a transport error
 * @returns {{ok: true, rowsInserted: number}
 *          | {ok: false, kind: 'transport'|'rpc'|'malformed', message: string}}
 */
export function classifySyncResult(result) {
  if (result == null) {
    return { ok: false, kind: 'transport', message: 'RPC returned no result (transport error)' };
  }
  // The error key wins over anything else in the payload. If a future version
  // returns both an error and a count, the count is not to be believed.
  if (result.error) {
    return { ok: false, kind: 'rpc', message: String(result.error) };
  }
  if (typeof result.rows_inserted !== 'number') {
    return {
      ok: false,
      kind: 'malformed',
      message: `unrecognised RPC payload: ${JSON.stringify(result)}`,
    };
  }
  return { ok: true, rowsInserted: result.rows_inserted };
}
