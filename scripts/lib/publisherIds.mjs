/**
 * Reading an identifier out of a publisher's spreadsheet cell.
 *
 * ⚠⚠⚠ THE FALSY-ZERO BUG. `r[col] || null` turns the integer 0 into null, and
 * `[...].filter(Boolean)` drops it from a composite key. Both patterns are
 * correct for amounts and wrong for identifiers, and the difference is invisible
 * until a publisher happens to number something from zero.
 *
 * McKinney does. Its check register publishes `Department` as an INTEGER, and
 * code `0` — the `0000` account segment, carrying revenue and balance-sheet
 * lines — held **$79,113,310 in FY2024 alone**. Every dollar lost its link key
 * in `buildBatch` and reached readers in a bucket labelled `Unknown Department`.
 * Nothing was broken enough to notice: the total still tied, the tree still had
 * one root per code, and the gate in verifyTotalsTieToTree.mjs saw a clean
 * budget. A figure can be wrong for the reader while every number agrees.
 *
 * ⚠ An identifier is absent when it is null, undefined or blank. Never when it
 * is zero. Use this for every id, code, key and reference read from a cell; use
 * plain truthiness only where zero genuinely means "nothing".
 */

/** An identifier as a trimmed string, or null when the cell is truly empty. */
export function idOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/**
 * Join identifier parts into a composite link key, keeping zeros.
 *
 * ⚠ The replacement for `[...].filter(Boolean).join('|')`.
 */
export function linkKey(parts) {
  const kept = parts.map(idOrNull).filter((v) => v !== null);
  return kept.length ? kept.join('|') : null;
}

/**
 * The mapping entries that make a link key, in order.
 *
 * ── ⚠⚠⚠ WHY THIS IS CONFIGURABLE AND WAS NOT ────────────────────────────────
 *
 * The order used to be hardcoded as `[department, fund, expense_category]` in
 * two loaders, and that hardcode decided which breakdowns were POSSIBLE —
 * because the drill-down can only match a LEADING `|` segment. Whatever column
 * happened to be first was the only axis a reader could ever be given.
 *
 * Plano is the case that proved it. Its register publishes a cost centre and a
 * fund; the hardcode put the cost centre first, and Plano's cost-centre names
 * arrive machine-truncated at 25 characters — `UTILITYMAINTADMINISTRATIO`,
 * `SOLIDWASTECOLLECTIONS` — which is the same defect that removed its vendor
 * axis in #340. Its FUND names are clean and publishable (`Water & Sewer`,
 * `G.O. Debt Service`), but fund was segment two, so a fund root was not a
 * prefix the API could match and the city had no usable breakdown at all.
 *
 * ⚠ ABSENT MEANS THE OLD ORDER, EXACTLY. Every source without
 * `link_key_columns` keys precisely as before — this cannot re-key McKinney,
 * Frisco, West Hollywood or LA by accident, and a test pins that.
 *
 * ⚠⚠ Changing it for a source that already has rows RE-KEYS THEM, so the
 * stored rows must be backfilled in the same change and the tree above them
 * rebuilt. A key is the definition of "the same row" for dedup
 * (`ON CONFLICT`), so this is never a cosmetic edit.
 */
export const DEFAULT_LINK_KEY_COLUMNS = ['department_column', 'fund_column', 'expense_category_column'];

/**
 * Build a row's link key from the source's column_mapping.
 *
 * `readCell(columnName)` returns that column's raw cell — the loaders differ
 * (`r[name]` for a parsed sheet, `cell(r, name)` for a Socrata row), so the
 * accessor is supplied rather than assumed.
 */
export function linkKeyFromMapping(cm, readCell) {
  const entries = Array.isArray(cm?.link_key_columns) && cm.link_key_columns.length
    ? cm.link_key_columns
    : DEFAULT_LINK_KEY_COLUMNS;
  return linkKey(entries.map((entry) => readCell(cm?.[entry])));
}
