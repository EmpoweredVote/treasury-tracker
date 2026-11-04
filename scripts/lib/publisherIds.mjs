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
