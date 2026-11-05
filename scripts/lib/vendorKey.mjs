/**
 * The link key for a vendor-keyed transaction tree.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ── ⚠⚠⚠ WHY THIS EXISTS ──────────────────────────────────────────────────
 *
 * `treasury_sync_transactions` writes transactions and recomputes
 * `budgets.total_budget`; it does NOT touch `budget_categories`. The trees
 * over those transactions were built once by an uncommitted migration, and
 * that migration keyed Frisco's roots on the VENDOR NAME.
 *
 * The loader never reproduced that key. `buildBatch` computed
 * `linkKey([department, fund, expense_category])` — three columns Frisco's
 * column_mapping does not have — so every Frisco reload wrote `link_key NULL`
 * on every row, and the tree above it silently stopped describing the
 * transactions below it.
 *
 * That is exactly what happened to FY2018, FY2019, FY2022 and FY2026 when
 * they were reloaded for #336 and #339: their headlines were corrected and
 * their trees were left holding the OLD figures, including a phantom root
 * called "Unknown" worth $2.52 BILLION across the three — the publisher TOTAL
 * row that #336 had just removed from the transactions.
 *
 * ── ⭐⭐ THE RULE IS MEASURED, NOT INVENTED ───────────────────────────────
 *
 * It was recovered by running candidate rules against the five Frisco years
 * whose keys the reloads never touched, and keeping the one that reproduced
 * the stored keys EXACTLY:
 *
 *     FY2020 2,210 · FY2021 1,685 · FY2023 2,246 · FY2024 2,337 · FY2025 2,414
 *     = 10,892 distinct keys, 10,892 matches, 0 differences.
 *
 * ⚠ Two details are load-bearing and both were found by that measurement:
 *
 *   * the NAME is whitespace-trimmed first — "A TO T LAMPS INC    " keys as
 *     `a-to-t-lamps-inc`, and " CORD B SMITH" as `cord-b-smith`;
 *   * the KEY is NOT dash-trimmed — "A&M MAINTENANCE SERVICES, INC." keys as
 *     `a-m-maintenance-services-inc-`, WITH the trailing dash.
 *
 * Trimming the dash looks tidier and is wrong: it would re-key 50 vendors in
 * FY2020 alone, so a no-change rebuild would stop being a no-op and the drift
 * this whole line of work exists to detect would become invisible.
 */

/**
 * The published vendor name as a link key, or null when there is no name.
 *
 * ⚠ Mirrors `regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')` in
 * supabase/migrations/20261105040000_frisco_vendor_link_keys.sql. If one
 * changes the other must, or a reload will re-key every root it touches.
 */
export function vendorLinkKey(name) {
  if (name === null || name === undefined) return null;
  const trimmed = String(name).trim();
  if (trimmed === '') return null;
  return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
