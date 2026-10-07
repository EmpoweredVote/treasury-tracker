/**
 * Divide a money figure by a denominator, preserving absence.
 *
 * ── ⚠⚠ WHY THIS IS NOT JUST `v / divisor` ───────────────────────────────────
 *
 * `null / 4` is `0` in JavaScript. The federal per-person view divides every
 * line item by population, so a `null` approved amount — which means "this
 * source published no adopted budget" — came out the other side as a hard 0.
 *
 * That would have undone the API fix for issue #217 one layer above it,
 * silently, and ONLY in the scaled view: the unscaled table would say "no
 * adopted budget" while the per-person table said the city budgeted $0. Two
 * views of one row, disagreeing.
 *
 * ⚠ `undefined` is kept distinct from `null` because `BudgetCategory.actualAmount`
 * is optional while `LineItem.actualAmount` is nullable. Flattening them here
 * would make an optional field look like a stated absence.
 *
 * ⚠ A REAL ZERO SCALES TO ZERO. A government that genuinely budgeted nothing
 * still budgeted nothing per person; turning that into `null` would be the
 * inverse error and just as false.
 */
export function scaleMoney(value: number, divisor: number): number | null;
export function scaleMoney(value: number | null, divisor: number): number | null;
export function scaleMoney(
  value: number | null | undefined, divisor: number,
): number | null | undefined;
export function scaleMoney(
  value: number | null | undefined,
  divisor: number,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  // ⚠ Without this, a municipality with no recorded population renders
  // Infinity (or NaN for 0/0) in every cell of the scaled view.
  if (!Number.isFinite(divisor) || divisor === 0) return null;
  return value / divisor;
}
