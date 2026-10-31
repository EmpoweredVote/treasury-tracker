/**
 * The decisions a CA State Controller fleet sweep makes, with no I/O.
 *
 * NO SHEBANG — a test imports this module. The driver that actually spawns
 * loaders is scripts/sweepCaStateController.mjs.
 *
 * ── WHY A SWEEP DRIVER EXISTS ───────────────────────────────────────────────
 * The CA FY2025 fleet load is 112 loader invocations: 55 counties of cities
 * (483 entities) plus 57 county governments. Two things make one
 * straight-through run the wrong shape:
 *
 *   1. `bulkLoadStateController.js` calls `process.exit(1)` on a fiscal-year
 *      contradiction (monthForCity / censusGuard). Today that abandons the
 *      whole county — 88 cities of Los Angeles lost to one city's bad month.
 *   2. bythenumbers.sco.ca.gov intermittently connect-times-out (~1/3 success
 *      observed 2026-06-17) and the loaders have no fetch retry.
 *
 * ⚠⚠ A TIMEOUT AND A CONTRADICTION ARE NOT THE SAME FAILURE, and this is the
 * distinction the whole module exists to make. Retrying a timeout converges in
 * seconds. Retrying a fiscal-month contradiction burns the same wall clock
 * forever and ends with the identical message, so it is PARKED for a person.
 *
 * ⚠⚠ TRUST THE OUTPUT, NOT THE EXIT CODE. A background chunk of the NY load
 * reported `exited with code 0` having done half its work. A unit is done only
 * when the loader printed its completion line AND exited zero.
 *
 * ⚠ The loaders are idempotent and never overwrite their own source label, so
 * re-running a unit is safe. That is what makes a checkpoint sound.
 */

/** Statuses a unit can hold. `retry` and `pending` are both still to do. */
const PENDING = new Set(['pending', 'retry']);

export function buildWorkList({ cityCounties = [], countyEntities = [], fy }) {
  if (!Number.isInteger(fy)) throw new Error('buildWorkList needs an integer fiscal year');
  // ⚠ Cities first, counties second, each alphabetical. Finishing one whole
  // class gives a verifiable result if the sweep is stopped halfway, and a
  // stable order makes a checkpoint from a previous run mean the same thing.
  const city = [...cityCounties].sort().map((key) => ({ id: `city:${key}:${fy}`, kind: 'city', key, fy }));
  const county = [...countyEntities].sort().map((key) => ({ id: `county:${key}:${fy}`, kind: 'county', key, fy }));
  return [...city, ...county];
}

/**
 * Apply a checkpoint to a work list.
 *
 * ⚠ A checkpoint entry for a unit NOT in this work list is ignored rather than
 * merged: ids carry the fiscal year, so a checkpoint from another year
 * describes different work entirely.
 */
export function mergeCheckpoint(units, checkpoint) {
  const saved = checkpoint?.units ?? {};
  return units.map((u) => {
    const prior = saved[u.id];
    return {
      ...u,
      status: prior?.status ?? 'pending',
      attempts: prior?.attempts ?? 0,
      note: prior?.note ?? null,
    };
  });
}

export function pendingUnits(units) {
  return units.filter((u) => PENDING.has(u.status));
}

/**
 * ⚠⚠ THE TWO LOADERS DO NOT ANNOUNCE SUCCESS THE SAME WAY, and a smoke test of
 * the driver on two real county units is what found it. Classifying every unit
 * against the city loader's line parked all 57 county units as "exited 0
 * without the completion line" — a clean run reported as total failure.
 *
 * Each kind is held to ITS OWN marker: a county run printing the city loader's
 * line would mean something has gone very strange, and waving it through is
 * how a wrong success gets recorded.
 */
const COMPLETION = {
  city: /State Controller import complete/,
  county: /Done\. \d+ year\/type combos processed\./,
};

/**
 * What a finished loader run means.
 *
 * @param {{kind?: 'city'|'county', code: number, output: string}} run
 * @returns {{status: 'done'|'retry'|'parked', note: string|null}}
 */
export function classifyRun({ kind = 'city', code, output }) {
  const text = String(output ?? '');

  // ⚠⚠ BOTH CONDITIONS. See the NY half-finished chunk above.
  if (code === 0 && COMPLETION[kind].test(text)) return { status: 'done', note: null };

  // ⚠ A REAL FINDING FROM THE FIRST SMOKE TEST. Alpine County is not seeded as
  // a county entity, so the loader refuses before fetching anything. Not
  // transient, and no retry will seed it.
  if (/County entity .* not found/.test(text)) {
    return { status: 'parked', note: 'county entity not seeded — see seedCountyLinks.js' };
  }

  // A fiscal-year contradiction. The registry or the federal audit record
  // disagrees about this entity's calendar, and no number of retries will
  // change either one's mind. It needs a person with the entity's own ACFR.
  const fatal = text.match(/^FATAL: (.+)$/m);
  if (fatal) return { status: 'parked', note: fatal[1].trim() };

  // ⚠⚠ THE DATABASE DECLINES WRITES FOR MORE THAN ONE REASON, AND THEY NEED
  // OPPOSITE ACTIONS. The FY2025 fleet load parked three counties as "resolve
  // the duplicate"; there were ZERO duplicates — every CA FY2025
  // all_funds/actual group was measured. The real cause was a missing fiscal
  // year month, and the wrong note cost an investigation.
  if (text.includes('were REFUSED')) {
    if (text.includes('cannot determine fiscal_year_start_month')) {
      // No prior row under this data_source to inherit a month from. For a
      // flagship custom-source city this is the standing "no SCO backfill"
      // decision being enforced; for a genuinely new city it needs the month
      // read off that entity's own financial report, never a default.
      return {
        status: 'parked',
        note: 'REFUSED — no fiscal-year start month to inherit; pass '
          + "--fiscal-year-start-month from the entity's own financial report, "
          + 'or leave the entity out if it has no series here on purpose',
      };
    }
    if (text.includes('ambiguous target')) {
      return {
        status: 'parked',
        note: 'REFUSED — ambiguous target: the entity-year holds more than one row for that '
          + '(fund_scope, basis). Resolve the duplicate, do not re-run and hope',
      };
    }
    return { status: 'parked', note: 'REFUSED by the database — read this unit\'s log for the reason' };
  }

  // The feed, not the data. These converge fast.
  if (/ConnectTimeoutError|UND_ERR|fetch failed|ETIMEDOUT|ECONNRESET|socket hang up|API 5\d\d/i.test(text)) {
    return { status: 'retry', note: 'transport error from bythenumbers.sco.ca.gov' };
  }

  // Exit zero and no completion line: a truncated run, worth one more go.
  if (code === 0) return { status: 'retry', note: 'exited 0 without the completion line' };

  // ⚠ An unrecognised failure is NOT assumed transient. A sweep that retries
  // everything forever is a sweep that never reports.
  return { status: 'parked', note: 'unrecognised failure — read the log for this unit' };
}

export function isRetryable(unit, maxAttempts) {
  return unit.status === 'retry' && unit.attempts < maxAttempts;
}

export function summarize(units) {
  const out = { total: units.length, done: 0, parked: 0, pending: 0, retry: 0 };
  for (const u of units) if (u.status in out) out[u.status] += 1;
  return out;
}

/**
 * What a DRY RUN would have written, read from the city loader's own summary.
 *
 * ⭐ A dry run that only says "done" proves the unit ran, not what it would
 * do. The number worth knowing before a fleet load is how many entities get
 * written and how many the never-overwrite guard skips because a richer
 * custom source already holds that year.
 *
 * ⚠ The line appears ONCE PER DATASET — expenditures and revenues both run in
 * one invocation — so these are summed, not taken from the first match.
 *
 * @returns {{wouldImport: number, skipped: number} | null} null when the
 *   output carries no such line (a real run, or the county loader).
 */
export function parseDryRunCounts(output) {
  const re = /(\d+) cities would import, (\d+) skipped/g;
  let m;
  let wouldImport = 0;
  let skipped = 0;
  let found = false;
  while ((m = re.exec(String(output ?? ''))) !== null) {
    found = true;
    wouldImport += Number(m[1]);
    skipped += Number(m[2]);
  }
  return found ? { wouldImport, skipped } : null;
}
