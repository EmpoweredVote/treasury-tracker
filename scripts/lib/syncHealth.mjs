/**
 * Classify the health of a data source from its own row plus its latest sync log.
 *
 * ── Why this exists ──
 *
 * San Francisco went unsynced from 2026-05-23 to 2026-08-27 while its
 * data_sources row read sync_status 'idle' and last_error NULL. Every field a
 * human would check said "fine"; the only tell was that last_synced_at was three
 * months old against a 'monthly' schedule. Nothing computed that comparison, so
 * nothing noticed.
 *
 * ⚠ THE RULE THIS ENCODES: **absence of an error is not health.** A source is
 * healthy only if it actually synced recently enough for its own declared
 * frequency. "idle + no error + ancient last_synced_at" is the silent-failure
 * shape, and it gets its own verdict here so it can never look green again.
 */

/** Days in one cycle of each sync_frequency. `manual` never goes stale on a clock. */
export const FREQ_DAYS = {
  daily: 1,
  weekly: 7,
  monthly: 28,
  quarterly: 84,
  manual: Infinity,
};

/**
 * How many cycles late a source may be before it counts as stale. Sync jobs skip
 * for benign reasons — a missed cron, a slow week — so one cycle is too tight.
 */
export const STALE_CYCLES = 3;

/**
 * @param {object} source  data_sources row: { name, sync_frequency, sync_status,
 *                         last_error, last_synced_at, is_enabled }
 * @param {object|null} latestLog  most recent sync_logs row: { status, error_message }
 * @param {Date} now
 * @returns {{ verdict, severity, reason }}
 *   verdict: 'ok' | 'error' | 'never_synced' | 'stale' | 'empty' | 'disabled'
 */
export function classifySyncHealth(source, latestLog, now = new Date()) {
  if (!source) throw new Error('classifySyncHealth requires a source row');
  if (source.is_enabled === false) {
    return { verdict: 'disabled', severity: 0, reason: 'source is disabled' };
  }

  // An explicit error outranks everything — it is the one case that was already
  // visible, and it stays the loudest.
  if (source.sync_status === 'error' || latestLog?.status === 'error') {
    const detail = source.last_error || latestLog?.error_message || 'unspecified error';
    return { verdict: 'error', severity: 3, reason: String(detail).slice(0, 300) };
  }

  if (!source.last_synced_at) {
    return { verdict: 'never_synced', severity: 2, reason: 'last_synced_at is NULL — this source has never completed a sync' };
  }

  const cycleDays = FREQ_DAYS[source.sync_frequency] ?? FREQ_DAYS.monthly;
  const ageDays = (now.getTime() - new Date(source.last_synced_at).getTime()) / 86_400_000;

  if (Number.isFinite(cycleDays) && ageDays > cycleDays * STALE_CYCLES) {
    // The San Francisco shape.
    return {
      verdict: 'stale',
      severity: 2,
      reason: `last synced ${Math.floor(ageDays)}d ago against a '${source.sync_frequency}' `
            + `schedule (${cycleDays}d) — more than ${STALE_CYCLES}x late while reporting `
            + `sync_status '${source.sync_status}' and no error`,
    };
  }

  if (latestLog?.status === 'empty') {
    return {
      verdict: 'empty',
      severity: 1,
      reason: latestLog.error_message
        ? String(latestLog.error_message).slice(0, 300)
        : 'most recent sync fetched 0 rows',
    };
  }

  return { verdict: 'ok', severity: 0, reason: `synced ${Math.floor(ageDays)}d ago` };
}

/** True when the verdict should fail a health gate. */
export function isUnhealthy(verdict) {
  return verdict === 'error' || verdict === 'never_synced' || verdict === 'stale';
}

/** Summarise a set of classified sources: { total, byVerdict, unhealthy }. */
export function summarise(classified) {
  const byVerdict = {};
  for (const c of classified) byVerdict[c.verdict] = (byVerdict[c.verdict] || 0) + 1;
  return {
    total: classified.length,
    byVerdict,
    unhealthy: classified.filter((c) => isUnhealthy(c.verdict)).length,
  };
}
