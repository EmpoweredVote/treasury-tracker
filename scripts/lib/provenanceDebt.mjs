/**
 * The provenance ratchet: what a reader cannot get from a row today, held
 * flat so it can only shrink.
 *
 * NO SHEBANG — a test imports this module.
 *
 * ⚠⚠ THE GATE AND THE RATCHET DO DIFFERENT JOBS, AND BOTH ARE NEEDED. The
 * gate (in treasury_sync_city_budget) stops a NEW unregistered family being
 * written at all. It deliberately grandfathers families already present,
 * because only 1,966 of 5,929 match all three active axes and refusing the
 * rest would block the very re-runs that fix bad data. That leaves standing
 * debt — and debt nobody counts is debt that grows. This counts it.
 *
 * Measured 2026-11-02:
 *     3,963 unregistered families   54,914 rows
 *     24,947 rows with no source_url
 *
 * ⚠ A ratchet, not a pass/fail gate: a source worse than its recorded
 * baseline fails; equal passes; better passes and says so. Same shape as
 * scripts/lib/totalsTie.mjs, which this follows deliberately — a second
 * vocabulary for the same idea is a second thing to learn.
 */

/**
 * @param {Array<{data_source: string, rows: number, linkless: number, unregistered: boolean}>} current
 * @param {{sources: Record<string, {unregisteredRows: number, linkless: number}>}} baseline
 */
export function summarizeProvenanceDebt(current, baseline) {
  const base = baseline?.sources ?? {};
  const worse = []; const better = []; const added = [];
  let unregisteredRows = 0; let linkless = 0; let rows = 0;

  for (const row of current ?? []) {
    const name = row.data_source;
    const unreg = row.unregistered ? row.rows : 0;
    rows += row.rows;
    unregisteredRows += unreg;
    linkless += row.linkless;

    const b = base[name];
    if (!b) {
      // ⚠ A source the baseline has never seen is only debt if it ARRIVES
      // with debt. A clean new source is the normal case and must not fail.
      if (unreg > 0 || row.linkless > 0) {
        added.push({ name, unregisteredRows: unreg, linkless: row.linkless });
      }
      continue;
    }
    if (unreg > b.unregisteredRows || row.linkless > b.linkless) {
      worse.push({
        name,
        unregisteredRows: unreg, wasUnregisteredRows: b.unregisteredRows,
        linkless: row.linkless, wasLinkless: b.linkless,
      });
    } else if (unreg < b.unregisteredRows || row.linkless < b.linkless) {
      better.push({
        name,
        unregisteredRows: unreg, wasUnregisteredRows: b.unregisteredRows,
        linkless: row.linkless, wasLinkless: b.linkless,
      });
    }
  }

  return {
    ok: worse.length === 0 && added.length === 0,
    worse, better, added,
    totals: { rows, unregisteredRows, linkless },
  };
}

/** Turn a measurement into the baseline file's shape. */
export function toBaseline(current) {
  const sources = {};
  for (const row of current ?? []) {
    if (!row.unregistered && row.linkless === 0) continue;   // nothing to record
    sources[row.data_source] = {
      unregisteredRows: row.unregistered ? row.rows : 0,
      linkless: row.linkless,
    };
  }
  return { sources };
}
