import type { LinkedTransactionSummary } from '../types/budget';

/**
 * What the leaf-node transactions slot should render.
 *
 * ⚠⚠ THIS EXISTS BECAUSE `LinkedTransactionSummary | null` WAS BEING USED TO
 * CARRY THREE STATES AND COULD ONLY EXPRESS TWO. `null` meant "not started"
 * (set at the top of the effect), "loaded and there are none" (the API returns
 * null, or a non-ok response), AND "the request failed" (the catch). The view
 * read every falsy value as "still loading" and spun forever.
 *
 * App-wide only two entities carry any `transactions` rows at all, so the
 * perpetual spinner was the DEFAULT experience on a leaf category, not an edge
 * case. New York City — 24 years of drillable categories and no transactions —
 * is simply where it became impossible to miss.
 *
 * `wrapperCategories.promote()` already states the intended behaviour: "Where
 * no transactions are keyed that way the lookup simply returns nothing, which
 * is the honest answer." Nothing was wrong with the data layer; the view had
 * no way to say "nothing".
 */
export type LinkedTxStatus = 'idle' | 'loading' | 'empty' | 'loaded';

export type LinkedTxView = 'panel' | 'spinner' | 'none';

export interface LinkedTxViewInput {
  activeDataset: string;
  linkKey?: string | null;
  status: LinkedTxStatus;
  summary: LinkedTransactionSummary | null;
}

/**
 * ⚠ A summary that exists but holds no transactions is EMPTY, not loaded.
 * The API can answer with a well-formed summary whose `transactions` array is
 * empty; rendering the panel for that shows a reader an empty table under a
 * heading promising transactions.
 */
export function summaryIsEmpty(summary: LinkedTransactionSummary | null): boolean {
  if (!summary) return true;
  const rows = summary.transactions?.length ?? 0;
  return rows === 0 && (summary.transactionCount ?? 0) === 0;
}

export function linkedTxView(input: LinkedTxViewInput): LinkedTxView {
  const { activeDataset, linkKey, status, summary } = input;

  // Transactions hang off operating spending only, and off a category that
  // declares a key to hang them from.
  if (activeDataset !== 'operating' || !linkKey) return 'none';

  // ⚠ ONLY a request genuinely in flight shows a spinner. `idle` is not
  // loading -- it is the state before any request was made, and a view that
  // cannot tell them apart is the bug this module fixes.
  if (status === 'loading') return 'spinner';

  if (status === 'loaded' && !summaryIsEmpty(summary)) return 'panel';

  // 'empty', 'idle', a failed load, or a summary with nothing in it.
  return 'none';
}
