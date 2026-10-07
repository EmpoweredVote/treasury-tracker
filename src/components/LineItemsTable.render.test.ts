import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LineItemsTable from './LineItemsTable';

/**
 * Issue #217, asserted against the ACTUAL RENDERED TABLE.
 *
 * ⚠⚠ THIS REPO CAN RUN NO COMPONENT TESTS — `vitest.config.ts` includes only
 * `src/**‍/*.test.ts` and runs in the `node` environment, so a `.test.tsx` is
 * never executed and there is no DOM. That limitation is real for anything
 * needing interaction.
 *
 * It does NOT prevent asserting what the server renders. `renderToStaticMarkup`
 * needs no DOM, and this file is a `.test.ts` importing a `.tsx`, which Vite
 * compiles happily. So the claim "Redmond budgeted $0" can be tested as a
 * STRING THE READER WOULD SEE, rather than inferred from a helper that the
 * component might not even call — the exact gap `accounting_basis` fell into.
 */

const item = (description: string, approvedAmount: number, actualAmount: number) =>
  ({ description, approvedAmount, actualAmount });

const render = (lineItems: unknown[]) =>
  renderToStaticMarkup(createElement(LineItemsTable, {
    lineItems: lineItems as never, categoryName: 'Current Operations',
  } as never));

/** Redmond FY2024 — the real figures, as an actuals-only source returns them. */
const REDMOND = [
  item('General government', 0, 30_944_687),
  item('Public safety', 0, 66_240_230),
  item('Transportation', 0, 13_319_154),
];

describe('LineItemsTable does not claim a $0 budget', () => {
  it('renders no "Budgeted" heading for an actuals-only source', () => {
    const html = render(REDMOND);
    expect(html).not.toContain('Budgeted');
    expect(html).toContain('Actual');
  });

  it('renders no $0 anywhere, which is the claim itself', () => {
    // ⚠⚠ The literal the reader was seeing. If this string comes back, the
    // table is asserting a budget that was never published.
    const html = render(REDMOND);
    expect(html).not.toContain('$0');
  });

  it('drops the variance column rather than showing a red −100%', () => {
    const html = render(REDMOND);
    expect(html).not.toContain('Variance');
    expect(html).not.toContain('100.0%');
  });

  it('tells the reader why the column is absent', () => {
    const html = render(REDMOND);
    expect(html).toContain('No adopted budget was published');
  });

  it('hides the Under/Over Budget legend when there is no budget', () => {
    const html = render(REDMOND);
    expect(html).not.toContain('Over Budget');
  });

  it('still shows the real spending, largest first', () => {
    // ⚠ The table sorted by approvedAmount, which is zero on every row here,
    // so the biggest line item landed wherever the API happened to put it.
    const html = render(REDMOND);
    expect(html).toContain('66,240,230');
    const safety = html.indexOf('Public safety');
    const general = html.indexOf('General government');
    expect(safety).toBeGreaterThan(-1);
    expect(safety).toBeLessThan(general);
  });

  // ═════════════════════════════════════════════════════════════════════
  // A MIXED TABLE: THE SAME LIE, ONE ROW DOWN.
  // ═════════════════════════════════════════════════════════════════════
  //
  // ⚠⚠ Hiding the column handles a source with NO budget at all. It does
  // nothing for a source where SOME rows carry a budget and others do not:
  // the column is shown, and a null cell inside it reads as $0. The claim
  // simply moves from the column to the row.
  //
  // This only becomes reachable once the API preserves null (ev-accounts
  // #922) — which is exactly why it is written now, while the shape is fresh,
  // rather than after someone sees a $0 they cannot explain.
  const MIXED = [
    item('Police', 5_000_000, 4_800_000),
    { description: 'Grant-funded unit', approvedAmount: null, actualAmount: 1_200_000 },
  ];

  it('renders an em dash, not $0, for a row with no budget figure', () => {
    const html = render(MIXED);
    expect(html).toContain('Grant-funded unit');
    expect(html).not.toContain('$0');
  });

  it('still shows the budget of the rows that have one', () => {
    const html = render(MIXED);
    expect(html).toContain('5,000,000');
    expect(html).toContain('4,800,000');
  });

  it('shows no variance for a row that has nothing to compare', () => {
    // ⚠ A variance against an absent budget is an invented number. Showing
    // +$1,200,000 / +∞% there would be worse than showing nothing.
    const html = render(MIXED);
    expect(html).not.toContain('1,200,000.0%');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('NaN');
  });

  it('totals only what was actually published', () => {
    // ⚠ `sum + null` is `sum` in JS, so the total was accidentally right.
    // Asserting it means a later `Number(x)` or a spread cannot quietly turn
    // it into NaN.
    const html = render(MIXED);
    expect(html).toContain('5,000,000');
    expect(html).not.toContain('NaN');
  });

  it('keeps all three columns for a source that publishes both sides', () => {
    // ⚠ The no-regression half: this must not strip columns from a real
    // budget-vs-actual source.
    const html = render([item('Police', 5_000_000, 4_800_000)]);
    expect(html).toContain('Budgeted');
    expect(html).toContain('Actual');
    expect(html).toContain('Variance');
    expect(html).toContain('Over Budget');
  });
});
