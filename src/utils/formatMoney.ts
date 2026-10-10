/**
 * The one money formatter.
 *
 * ── ⚠⚠ WHY THIS EXISTS ──────────────────────────────────────────────────────
 *
 * There were FOURTEEN hand-rolled `formatCurrency` functions in `src/`, each
 * written where it was needed and none of them aware of the others. Only two of
 * them — `BudgetIcicle` and `DatasetTabs` — ever grew a BILLIONS tier. So on
 * New York City FY2002 the bar read `$13.5B` and the card directly beneath it
 * read `$13480.9M`: the same number, the same screen, two ladders. Reported
 * 2026-10-10: "we are sometimes using 'Billions' and other times 1k Millions."
 *
 * Adding `B` to the thirteenth copy would have left a fourteenth to find later.
 * The ladder lives here now, once, and the components call it.
 *
 * ⚠ This is the ABBREVIATING ladder, for charts, cards and summaries. It is
 * deliberately NOT used by `LineItemsTable` or `TransactionLineItemsTable`,
 * which show a filer's own line amounts and must print every dollar, nor by
 * `DatasetTabs`' `exact` mode. Rounding a transaction is not a formatting
 * choice, it is losing the figure.
 */

/** Below this, a figure prints in full rather than being abbreviated. */
const K = 1_000;
const M = 1_000_000;
const B = 1_000_000_000;

/**
 * Whole dollars, grouped — `$1,234,567`. The honest form when a figure must not
 * be rounded, and the fallback below $1,000.
 */
export function formatMoneyExact(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * `$13.5B` / `$428.5M` / `$57K` / `$912`.
 *
 * ⚠⚠ THE SIGN IS TAKEN OFF FIRST, AND THAT IS A FIX, NOT A FLOURISH. Every copy
 * this replaced tested `amount >= 1_000_000`, so a NEGATIVE amount fell past
 * every tier and printed in full. Federal trees carry offsetting-receipt rows
 * that are genuinely negative (see `icicleLevels.ts`), so `-$2,400,000,000` was
 * being rendered inside a chart segment sized for `-$2.4B`.
 *
 * ⚠ Not `Intl`'s `notation: 'compact'`: that yields `$13B` for 13.48e9 at zero
 * fraction digits and `13.5B` with a non-breaking space at one, and it localises
 * the suffix. The product's existing strings are `$13.5B`, and a reader
 * comparing two cities should not see the ladder shift under them.
 */
export function formatMoneyCompact(amount: number): string {
  if (!Number.isFinite(amount)) return formatMoneyExact(0);
  const sign = amount < 0 ? '-' : '';
  const n = Math.abs(amount);
  if (n >= B) return `${sign}$${(n / B).toFixed(1)}B`;
  if (n >= M) return `${sign}$${(n / M).toFixed(1)}M`;
  if (n >= K) return `${sign}$${(n / K).toFixed(0)}K`;
  return formatMoneyExact(amount);
}
