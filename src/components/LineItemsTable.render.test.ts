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
