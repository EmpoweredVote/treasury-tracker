/**
 * HOW a figure was measured, in the reader's words.
 *
 * ⚠⚠ A NON-GAAP BASIS IS NOT A DEFECT. Duvall, WA is audited under Government
 * Auditing Standards with an UNMODIFIED opinion on its regulatory (BARS)
 * basis; it simply reports on a different basis from a city filing an ACFR.
 * Copy here must say DIFFERENT, never WORSE — the figure is real and attested,
 * and calling it second-rate would be as false as calling it GAAP.
 *
 * ⚠ The WORDS are the whole mechanism. Colour cannot carry this distinction,
 * because every graded chip in ScopeLabel shares one tone on purpose: colour
 * is a ranking whether or not you intend it, and `cash` is not a worse `gaap`.
 *
 * ⚠ Mirrors `ACCOUNTING_BASIS` in scripts/lib/budgetAxes.mjs. The two are kept
 * in step by the CHECK-constraint parity test — the database is the real
 * enforcement, and the vocabulary that differs from it is the one that is
 * wrong.
 */
export type AccountingBasis = 'gaap' | 'modified_cash' | 'cash' | 'unknown';

export const ACCOUNTING_BASIS_VALUES: readonly AccountingBasis[] =
  ['gaap', 'modified_cash', 'cash', 'unknown'] as const;

export interface AccountingBasisCopy {
  /** The chip's text. */
  label: string;
  /** The hover title — one sentence, and it must say what the figure IS comparable to. */
  short: string;
}

export const ACCOUNTING_BASIS_COPY: Record<AccountingBasis, AccountingBasisCopy> = {
  gaap: {
    label: 'GAAP basis',
    short: 'Measured under U.S. generally accepted accounting principles.',
  },
  modified_cash: {
    label: 'Modified cash basis',
    short: 'Measured on a modified cash basis rather than U.S. GAAP. '
      + 'Comparable to other modified-cash figures, not to GAAP ones.',
  },
  cash: {
    label: 'Cash basis',
    short: 'Measured on a cash basis rather than U.S. GAAP. '
      + 'Comparable to other cash-basis figures, not to GAAP ones.',
  },
  unknown: {
    label: 'Basis not established',
    short: 'We have not yet confirmed how this figure was measured.',
  },
};

export function normalizeAccountingBasis(raw: unknown): AccountingBasis {
  return (ACCOUNTING_BASIS_VALUES as readonly string[]).includes(raw as string)
    ? (raw as AccountingBasis)
    : 'unknown';
}

/**
 * May two figures on these bases be drawn against each other?
 *
 * ⚠⚠ REFUSES ONLY WHEN BOTH ARE KNOWN AND DIFFERENT. The inverse — "comparable
 * only if both are known and equal" — sounds more rigorous and would switch
 * off cross-entity comparison across nearly the whole site, because this axis
 * starts at 100% `unknown` and will stay mostly unknown for a long time.
 *
 * ⚠ The TS mirror of `isComparablePair` in scripts/lib/fundScope.mjs, which
 * also composes the fund scope. This half takes bases only, because the UI
 * already has `isComparableScope` for the other half.
 */
export function isComparableBasisPair(
  a: AccountingBasis | null | undefined,
  b: AccountingBasis | null | undefined,
): boolean {
  const known = (v: AccountingBasis | null | undefined): boolean =>
    typeof v === 'string' && v !== '' && v !== 'unknown';
  if (!known(a) || !known(b)) return true;   // absence never blocks
  return a === b;
}
