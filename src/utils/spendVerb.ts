import type { Basis } from '../data/fundScopeVocabulary';

export type SpendVerb = 'spent' | 'has spent' | 'budgeted' | 'is spending';

export interface SpendVerbInput {
  /** The displayed row's `basis` axis. `unknown`/null means the API has not said. */
  basis: Basis | string | null | undefined;
  /** The fiscal year is over. */
  isPastYear: boolean;
  /** Per-category `actualAmount` values are present and sum above zero. */
  hasActualData: boolean;
}

/**
 * Choose the verb for the plain-language summary.
 *
 * ⚠ Why this exists: before SCOPE-01/02 the ONLY signal that a figure was actuals
 * was the presence of per-category `actualAmount` values. Sources that publish a
 * single audited total per fiscal year carry none of those — the CA State
 * Controller and every ACFR load included, where the row total IS the actual. So
 * an audited actual rendered as "budgeted", directly beneath a chip reading
 * "Actuals" (found on Los Angeles FY2024 during LA-02).
 *
 * The `basis` axis states the answer outright, so it wins when known. When it is
 * `unknown` (absent field — a real production state, see normalizeBasis) this
 * falls back to the legacy heuristic byte-for-byte, so nothing that was right
 * before changes.
 *
 * This only decides the VERB. It must not be used to pick the amount: `actualTotal`
 * is 0 precisely in the case this function exists to fix.
 */
export function chooseSpendVerb({ basis, isPastYear, hasActualData }: SpendVerbInput): SpendVerb {
  if (basis === 'actual') return isPastYear ? 'spent' : 'has spent';
  if (hasActualData) return isPastYear ? 'spent' : 'has spent';
  return isPastYear ? 'budgeted' : 'is spending';
}

/** True when the verb describes money already gone out, so the sentence needs past/actual phrasing. */
export function usesSpentLanguage(verb: SpendVerb): boolean {
  return verb === 'spent' || verb === 'has spent';
}
