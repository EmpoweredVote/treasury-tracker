import { describe, it, expect } from 'vitest';
import { visibleMoneyColumns } from './moneyColumns';

/**
 * Issue #217 — a $0 budget published where no adopted budget exists.
 *
 * ⚠⚠ THE LIE WAS REDMOND SAYING IT BUDGETED $0 AND SPENT $140,249,393.
 * Every line item of every actuals-only source carries `approvedAmount: 0`,
 * and the Line Item Details table rendered that in a column headed "Budgeted"
 * beside a red −100% variance. The truth is that no adopted budget was ever
 * published for these figures.
 *
 * ⚠ The rule is SELF-EVIDENCING rather than taken from the `basis` axis,
 * because that axis is `unknown` on a large part of the corpus and a new
 * fiscal year arrives unknown. The data in hand answers the question: a column
 * that is entirely zero is a column the source did not publish.
 *
 * ⚠ It is symmetric on purpose. An adopted-budget source with no actuals would
 * otherwise say the government spent $0 — the same lie, mirrored.
 */

const item = (approvedAmount: number, actualAmount: number) => ({
  description: 'x', approvedAmount, actualAmount,
});

describe('visibleMoneyColumns', () => {
  it('hides Budgeted and Variance for an actuals-only source', () => {
    const c = visibleMoneyColumns([item(0, 30_944_687), item(0, 66_240_230)]);
    expect(c.budgeted).toBe(false);
    expect(c.actual).toBe(true);
    expect(c.variance).toBe(false);
  });

  it('says WHY the column is missing rather than silently dropping it', () => {
    // ⚠ Removing the column without explanation trades a false claim for an
    // unexplained gap. The reader must learn that no budget was published —
    // which is a fact about the source, not about the government.
    const c = visibleMoneyColumns([item(0, 30_944_687)]);
    expect(c.note).toMatch(/no adopted budget/i);
    expect(c.note).not.toMatch(/\$0|zero/i);
  });

  it('hides Actual and Variance for an adopted-budget-only source', () => {
    // The mirrored lie: otherwise the table says the government spent $0.
    const c = visibleMoneyColumns([item(5_000_000, 0), item(2_500_000, 0)]);
    expect(c.budgeted).toBe(true);
    expect(c.actual).toBe(false);
    expect(c.variance).toBe(false);
    expect(c.note).toMatch(/actual spending has not been published/i);
  });

  it('shows all three when the source really publishes both', () => {
    const c = visibleMoneyColumns([item(5_000_000, 4_800_000)]);
    expect(c).toEqual({ budgeted: true, actual: true, variance: true, note: null });
  });

  it('needs only ONE non-zero entry to count a column as published', () => {
    // ⚠ A real budget can be $0 for an individual line. Requiring every row to
    // be non-zero would hide a column the source DID publish.
    const c = visibleMoneyColumns([item(0, 100), item(250_000, 200)]);
    expect(c.budgeted).toBe(true);
    expect(c.variance).toBe(true);
    expect(c.note).toBeNull();
  });

  it('treats a NEGATIVE amount as published — it is not absence', () => {
    // A credit or a contra entry is a figure the source published.
    const c = visibleMoneyColumns([item(-1_200, 0)]);
    expect(c.budgeted).toBe(true);
  });

  it('survives missing fields, an empty list and a null-ish input', () => {
    expect(visibleMoneyColumns([])).toEqual(
      { budgeted: false, actual: false, variance: false, note: null });
    expect(visibleMoneyColumns(undefined as never)).toEqual(
      { budgeted: false, actual: false, variance: false, note: null });
    const c = visibleMoneyColumns([{ description: 'x' } as never]);
    expect(c.budgeted).toBe(false);
    expect(c.actual).toBe(false);
  });

  it('offers no note when there is nothing to explain', () => {
    expect(visibleMoneyColumns([item(0, 0)]).note).toBeNull();
  });
});
