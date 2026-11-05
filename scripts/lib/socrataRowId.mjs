/**
 * Choosing `source_row_id` for a Socrata transaction source.
 *
 * ⚠⚠⚠ WHY THIS EXISTS — $6.06 BILLION OF SPENDING WENT MISSING.
 *
 * `treasury_sync_transactions` inserts
 *   ON CONFLICT (budget_id, source_row_id) WHERE source_row_id IS NOT NULL
 *   DO NOTHING
 * so whatever `source_row_id_column` names becomes the definition of "this is
 * the same row". Two sources named a column that is NOT a row id:
 *
 *   West Hollywood  source_row_id_column = "demand"          (a demand-register
 *                   BATCH number: 24,123 published rows carry 22 of them)
 *   LA City         source_row_id_column = "transaction_id"  (a document number:
 *                   6,584,328 rows carry 1,508,282 of them)
 *
 * One row per batch survived. West Hollywood's whole municipality held 143
 * transactions out of 134,643 loaded; LA City FY2025 held 226,909 of 749,295.
 * Measured 2026-11-05 against the publishers' own sums:
 *
 *     West Hollywood, 9 years   TT $169,689,667.89   published $1,365,917,958.43
 *     LA City FY2024            TT   $7.91B          published $11.28B
 *     LA City FY2025            TT  $11.73B          published $13.22B
 *
 * ⚠⚠ AND IT WAS SILENT. Every cron run since logged `success` with
 * rows_inserted 0 / rows_skipped 5000. Nothing anywhere treats "fetched
 * thousands, kept none" as a failure.
 *
 * ── ⭐⭐ THE FIX: SOCRATA'S OWN `:id`, NOT A GUESS AT A KEY ────────────────
 *
 * No published column is unique. Measured, not assumed:
 *
 *   LA    transaction_id|inv_line|inv_dist_line → 741,984 of 749,295 (loses 7,311)
 *   WeHo  demand|check|invoice_number|vendor_code → 12,794 of 16,342 (loses 22%)
 *
 * And the collisions are LEGITIMATE: LA transaction 134067 is four $4.50 lines
 * numbered inv_line 1-4 — genuine detail, not one total repeated (the shape
 * that bit Frisco in #339, checked for explicitly). A content hash would
 * collapse them, which is the McKinney-Tahoes defect from xlsxRows.mjs.
 *
 * Socrata's system field `:id` is exactly 1:1 — 16,342 of 16,342 for WeHo
 * 7kgt-b5t8, 749,295 of 749,295 for LA FY2025 — and it is the PUBLISHER'S own
 * row identifier rather than something TT derived.
 *
 * ⚠ It is also STABLE, which was checked before relying on it: both datasets
 * are APPENDED to, not replaced wholesale (WeHo 5d72-njxw carries 18 distinct
 * `:created_at` values with the oldest rows still at their original 2025-11-03
 * timestamp; LA carries 130, oldest 2024-07-15). A wholesale replace would mint
 * new `:id`s and duplicate everything on the next sync — hence
 * `verifySourceRowCoverage` exists to catch that if a publisher ever changes.
 *
 * ⚠⚠ TWO THINGS A CALLER MUST DO, and both are easy to miss:
 *   1. A PLAIN FETCH DOES NOT RETURN `:id`. It must be asked for with
 *      `$select=:*,*`, or every row keys as NULL and dedup stops entirely.
 *   2. ORDER BY `:id`, not by the date column. `$order=check_date` is not a
 *      total order, and on WeHo 7kgt-b5t8 `check_date` is TEXT in MM-DD-YYYY,
 *      so it sorts lexicographically — not even chronologically. Paging a
 *      non-total order silently skips and repeats rows (see the
 *      paged-reads-need-total-order memo; broken six times before this).
 */

/** Socrata system fields are the ones whose name starts with a colon. */
export const SYSTEM_ROW_ID = ':id';

export function isSystemRowId(ridCol) {
  return typeof ridCol === 'string' && ridCol.startsWith(':');
}

/**
 * The `$select` a source needs, or null to let Socrata return its default
 * columns. System fields are only returned when explicitly selected.
 */
export function selectFor(ridCol) {
  return isSystemRowId(ridCol) ? ':*,*' : null;
}

/**
 * What to page by. A total order or nothing — never a date column.
 *
 * ⚠ Returning null here means the caller must NOT substitute a date column as
 * a "better than nothing" order. Unordered paging is at least honest about
 * being arbitrary; a non-total order looks deliberate and is not.
 */
export function orderFor(ridCol) {
  return isSystemRowId(ridCol) ? SYSTEM_ROW_ID : null;
}

/**
 * Refuse a source whose declared row id is not actually one.
 *
 * ⚠⚠ THIS IS THE GATE THAT WOULD HAVE CAUGHT IT ON DAY ONE, and it costs a
 * single extra count query per sync. `rows` and `distinct` come from the
 * publisher: `$select=count(*)` and `$select=count(distinct <col>)`.
 *
 * A column that is unique TODAY can stop being unique later, so this runs on
 * every sync rather than once at onboarding.
 */
export function assertRowIdIsUnique(sourceName, ridCol, rows, distinct) {
  if (!ridCol || isSystemRowId(ridCol)) return;
  if (!Number.isFinite(rows) || !Number.isFinite(distinct)) {
    throw new Error(
      `Refusing to sync ${sourceName}: could not measure whether ` +
      `${JSON.stringify(ridCol)} is unique, and an unverified row id is how ` +
      `99.9% of West Hollywood's register was discarded in silence.`,
    );
  }
  if (distinct < rows) {
    const kept = rows === 0 ? 0 : ((distinct / rows) * 100).toFixed(1);
    throw new Error(
      `Refusing to sync ${sourceName}: source_row_id_column ` +
      `${JSON.stringify(ridCol)} is NOT unique — ${rows.toLocaleString()} published ` +
      `rows carry only ${distinct.toLocaleString()} distinct values, so ` +
      `ON CONFLICT (budget_id, source_row_id) DO NOTHING would keep ${kept}% of ` +
      `them and report success. Use ':id' (Socrata's own row identifier) unless ` +
      `the publisher offers a column proven 1:1.`,
    );
  }
}
