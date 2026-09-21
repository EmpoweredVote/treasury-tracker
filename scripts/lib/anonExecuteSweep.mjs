/**
 * Decision logic for the LIVE anon-EXECUTE sweep (watchlist #74 follow-up).
 *
 * ── The split, and why ─────────────────────────────────────────────────────
 *
 * The live scan happens INSIDE the database (treasury.run_anon_execute_sweep),
 * on pg_cron, where no credential has to travel and no rows cross the network —
 * the same rail the frozen-figure invariant moved onto after a service-role key
 * in GitHub Actions was ruled out (PR #90, frozen-invariant-watch.yml).
 *
 * This module is the other half: it decides what a verdict MEANS. It is pure,
 * takes no database handle, and therefore runs in the ordinary PR gate with no
 * credential — the same structure that makes definerFunctionGrants.mjs a real
 * CI guard rather than a script nobody runs.
 *
 * ── ⚠⚠ THE RULE THIS EXISTS TO ENCODE ─────────────────────────────────────
 *
 * A MISSING OR STALE VERDICT IS NOT A PASS.
 *
 * On 2026-09-21 the frozen-figure invariant was found to have failed on
 * 2026-09-07, -14 and -21 — three consecutive weeks, `ok = false` each time —
 * with nobody informed. The pg_cron job fired perfectly and wrote its verdict
 * into treasury.frozen_invariant_runs, which nothing in the repo reads, and the
 * workflow that would have opened an issue was disabled for want of a
 * credential. The check worked and reported into a void.
 *
 * So `surfaceVerdict` fails closed on absence as well as on failure: no verdict
 * row, or a verdict older than STALE_CYCLES cycles, is reported as a problem.
 * A sweep that quietly stops running must not look clean.
 *
 * ── ⚠ Caveat on the empty baseline ────────────────────────────────────────
 *
 * An empty baseline is read as INCONCLUSIVE (the seed never ran), not as "the
 * database is clean". In practice the baseline is never legitimately empty —
 * the shared project serves ev-accounts schemas whose functions are
 * intentionally anon-callable. If that ever changes and the baseline is pruned
 * to nothing, record a sentinel entry rather than teaching this to pass on
 * empty; a check that treats "no data" as "all good" is the defect above.
 */

/** The sweep's pg_cron cadence, in days. Keep in step with the cron schedule. */
export const CYCLE_DAYS = 7;

/**
 * How many cycles a verdict may age before it is treated as no verdict at all.
 * Two allows one missed run (a maintenance window, a paused project) without
 * crying wolf, while still catching a sweep that has genuinely stopped.
 */
export const STALE_CYCLES = 2;

const signatureOf = (r) => r.signature;
const isExposed = (r) => Boolean(r.anon_exec || r.authed_exec);

/**
 * Diff the live exposure set against the accepted baseline and name the actual
 * condition — reporting one condition for another is how the frozen invariant
 * stopped being read.
 *
 * @param {{live?: Array, baseline?: Array}} input
 *   live     — rows from treasury.anon_executable_functions()
 *   baseline — rows from treasury.anon_execute_baseline
 * @returns {{ok: boolean, detail: string, newExposures: string[], goneEntries: string[]}}
 */
export function classifyVerdict({ live = [], baseline = [] } = {}) {
  const exposed = live.filter(isExposed).map(signatureOf);
  const acceptedSet = new Set(baseline.map(signatureOf));
  const exposedSet = new Set(exposed);

  const newExposures = exposed.filter((s) => !acceptedSet.has(s)).sort();
  const goneEntries = baseline.map(signatureOf).filter((s) => !exposedSet.has(s)).sort();

  if (baseline.length === 0 && exposed.length === 0) {
    return {
      ok: false,
      detail:
        'No baseline recorded - nothing to compare against. This is INCONCLUSIVE, not a pass. ' +
        'Seed treasury.anon_execute_baseline from the current live state.',
      newExposures,
      goneEntries,
    };
  }

  if (newExposures.length > 0) {
    return {
      ok: false,
      detail:
        `NEW EXPOSURE: ${newExposures.length} function(s) are EXECUTE-able by anon or authenticated ` +
        `and are not in the accepted baseline: ${newExposures.join(', ')}. ` +
        'Close each with REVOKE EXECUTE ON FUNCTION <fn> FROM PUBLIC, anon, authenticated; ' +
        '(the grant comes from the PUBLIC default, so revoking anon alone is a no-op). ' +
        'If an entry is genuinely meant to be public, add it to the baseline WITH A REASON.',
      newExposures,
      goneEntries,
    };
  }

  if (goneEntries.length > 0) {
    return {
      ok: true,
      detail:
        `BASELINE ENTRY GONE: ${goneEntries.join(', ')} - no longer exposed. ` +
        'This is good news, not a failure. Prune the row so the baseline keeps meaning something.',
      newExposures,
      goneEntries,
    };
  }

  return { ok: true, detail: 'unchanged', newExposures, goneEntries };
}

/**
 * Decide what the orchestrator should act on, given the most recent verdict row
 * (or null if there is none). Fails closed on absence and on staleness.
 *
 * @param {{ok: boolean, detail: string, ran_at: string}|null} latest
 * @param {Date} now
 */
export function surfaceVerdict(latest, now = new Date()) {
  if (!latest) {
    return {
      ok: false,
      detail:
        'No anon-EXECUTE sweep has ever recorded a verdict. This is INCONCLUSIVE, not a pass - ' +
        'the sweep is not armed.',
      ageDays: null,
    };
  }

  const ranAt = new Date(latest.ran_at);
  const ageDays = (now.getTime() - ranAt.getTime()) / 86_400_000;
  const staleAfter = CYCLE_DAYS * STALE_CYCLES;

  if (ageDays > staleAfter) {
    return {
      ok: false,
      detail:
        `STALE VERDICT: the last anon-EXECUTE sweep ran ${ageDays.toFixed(1)} days ago ` +
        `(limit ${staleAfter}). The sweep has stopped running, so its last result means nothing. ` +
        `Check the pg_cron job. Last recorded detail: ${latest.detail}`,
      ageDays,
    };
  }

  return { ok: Boolean(latest.ok), detail: latest.detail, ageDays };
}

/**
 * An accepted exposure without a written reason is just a hidden hole. Enforced
 * here as well as by a NOT NULL + CHECK in the table, so a baseline assembled
 * in JS cannot skip the discipline either.
 */
export function assertBaselineHasReasons(baseline = []) {
  for (const entry of baseline) {
    if (typeof entry.reason !== 'string' || entry.reason.trim().length === 0) {
      throw new Error(
        `anon-execute baseline entry ${entry.signature} has no reason. ` +
          'Every accepted exposure must say why it is acceptable, with live evidence.',
      );
    }
  }
}
