import type { LineItem } from '../types/budget';

/**
 * Which money columns a source actually published — issue #217.
 *
 * ── ⚠⚠ THE LIE THIS EXISTS TO STOP ──────────────────────────────────────────
 *
 * Every line item of every actuals-only source carries `approvedAmount: 0`.
 * Rendered in a column headed "Budgeted", beside a red −100% variance, that
 * said Redmond **budgeted $0 and spent $140,249,393**. The truth is that no
 * adopted budget was ever published for those figures — a fact about the
 * SOURCE, not about the government.
 *
 * It is the same class as `audit_grade` and `accounting_basis`: an unknown
 * must not render as a substantive value. `0` is a number, and a reader cannot
 * tell an asserted zero from an absent one.
 *
 * ── ⚠ WHY THE DATA DECIDES, NOT THE `basis` AXIS ────────────────────────────
 *
 * `basis` (actual vs adopted) is the field that ought to answer this, and it
 * is `unknown` across a large part of the corpus — a new fiscal year arrives
 * unknown. Asking the rows in hand needs no axis and no prop drilling: a
 * column that is entirely zero is a column the source did not publish.
 *
 * ⚠ SYMMETRIC ON PURPOSE. An adopted-budget source with no actuals would
 * otherwise tell the reader the government spent $0 — the identical lie,
 * mirrored. Both directions are handled here.
 *
 * ⚠ ONE non-zero entry is enough to count a column as published: a real budget
 * can legitimately be $0 on an individual line, and requiring every row to be
 * non-zero would hide a column the source did publish. A negative amount
 * counts too — a credit is a figure, not an absence.
 */
export interface MoneyColumns {
  /** Show the "Budgeted" column. */
  budgeted: boolean;
  /** Show the "Actual" column. */
  actual: boolean;
  /** Show the "Variance" column — only ever when both sides exist. */
  variance: boolean;
  /**
   * One sentence telling the reader why a column is absent, or null when
   * nothing needs explaining.
   *
   * ⚠ Removing a column silently trades a false claim for an unexplained gap.
   * The note is what makes the omission honest rather than merely quiet.
   */
  note: string | null;
}

const NONE: MoneyColumns = { budgeted: false, actual: false, variance: false, note: null };

const published = (
  items: LineItem[],
  pick: (li: LineItem) => number | null | undefined,
): boolean =>
  items.some((li) => {
    const v = pick(li);
    return typeof v === 'number' && Number.isFinite(v) && v !== 0;
  });

export function visibleMoneyColumns(lineItems: LineItem[]): MoneyColumns {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return NONE;

  const budgeted = published(lineItems, (li) => li.approvedAmount);
  const actual = published(lineItems, (li) => li.actualAmount);

  let note: string | null = null;
  if (!budgeted && actual) {
    note = 'This source publishes actual spending only. '
      + 'No adopted budget was published for these figures.';
  } else if (budgeted && !actual) {
    note = 'This source publishes the adopted budget only. '
      + 'Actual spending has not been published for these figures.';
  }

  return { budgeted, actual, variance: budgeted && actual, note };
}
