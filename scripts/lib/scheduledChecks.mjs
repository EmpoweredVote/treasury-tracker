/**
 * Judging the verdicts that pg_cron recorded.
 *
 * ⚠⚠⚠ THE TWO FAILURE MODES THAT LOOK LIKE SUCCESS, and why this is a separate
 * pure function rather than three lines inside the reporter:
 *
 *   STALE  — a check that stopped running leaves its last good verdict in the
 *            table. Reading only `ok` calls that a pass forever.
 *   ABSENT — a check that has never run returns NO ROW, so it is simply missing
 *            from a list nobody counts, and the report is green because there
 *            was nothing in it to be red.
 *
 * Both are the shape this project keeps rediscovering: verify-budget-axes.mjs
 * ran nowhere across three releases while every report said it was fine. They
 * are judged here so they can be tested without a database.
 */

/**
 * @param rows     from treasury.scheduled_check_status(): { check_name, ran_at, ok, stale, detail }
 * @param expected every check that MUST have a verdict
 * @returns { ok, faults: [{ check_name, kind, detail }] }
 */
export function judgeScheduledChecks(rows, expected) {
  const faults = [];
  const seen = new Set();

  for (const r of rows ?? []) {
    seen.add(r.check_name);
    if (r.stale) {
      faults.push({
        check_name: r.check_name,
        kind: 'stale',
        detail: `last verdict ${r.ran_at} is too old to speak for today — the pg_cron job has stopped`,
      });
    } else if (!r.ok) {
      faults.push({ check_name: r.check_name, kind: 'failing', detail: r.detail });
    }
  }

  for (const name of expected ?? []) {
    if (!seen.has(name)) {
      faults.push({
        check_name: name,
        kind: 'absent',
        detail: 'no verdict has ever been recorded — inconclusive, not a pass',
      });
    }
  }

  // ⚠ An empty result set with nothing expected is NOT a pass: it means this
  // reporter is watching nothing at all.
  if (!faults.length && !(rows ?? []).length) {
    faults.push({
      check_name: '(none)',
      kind: 'absent',
      detail: 'scheduled_check_status() returned no rows and nothing was expected — ' +
              'this reporter is watching NOTHING.',
    });
  }

  return { ok: faults.length === 0, faults };
}
