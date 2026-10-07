import { describe, it, expect } from 'vitest';
import { transformAPIResponse } from './dataLoader';
import type { BudgetCategory } from '../types/budget';

/**
 * Issue #218, at the seam rather than in the unit.
 *
 * ⚠ `wrapperCategories.test.ts` proves the transform is correct. This proves
 * it is actually REACHED — the gap the accounting_basis axis fell into for a
 * whole branch, where a correct function sat behind a call site nobody made.
 */

const li = (description: string, actualAmount: number) => ({
  description, approvedAmount: 0, actualAmount,
});

const budget = {
  id: 'b1',
  fiscal_year: 2024,
  total_budget: 140_249_393,
  dataset_type: 'operating',
  data_source: 'WA State Auditor — Redmond Annual Financial Report FY2024',
  accounting_basis: 'gaap',
};

const categories: BudgetCategory[] = [
  {
    name: 'Current',
    amount: 136_809_979,
    actualAmount: 0,
    percentage: 97.5476,
    color: '',
    items: 6,
    linkKey: 'current',
    lineItems: [
      li('General government', 30_944_687),
      li('Public safety', 66_240_230),
      li('Transportation', 13_319_154),
      li('Economic environment', 8_206_308),
      li('Culture and recreation', 13_733_924),
      li('Social services', 4_365_676),
    ],
  },
  {
    name: 'Capital outlay',
    amount: 2_599_640,
    actualAmount: 0,
    percentage: 1.8536,
    color: '',
    items: 1,
    linkKey: 'capital outlay',
    lineItems: [li('Capital outlay', 2_599_640)],
  },
  {
    name: 'Debt service',
    amount: 839_774,
    actualAmount: 0,
    percentage: 0.5987,
    color: '',
    items: 2,
    linkKey: 'debt service',
    lineItems: [li('Principal', 643_167), li('Interest and debt issuance costs', 196_607)],
  },
];

describe('transformAPIResponse promotes the Current wrapper', () => {
  it('surfaces the functions a reader came for', () => {
    const out = transformAPIResponse(budget, categories);
    expect(out.categories.map((c) => c.name)).toContain('Public safety');
    expect(out.categories.find((c) => c.name === 'Current')).toBeUndefined();
  });

  it('keeps the page total equal to total_budget', () => {
    // ⚠⚠ If this ever fails, the breakdown and the headline figure disagree
    // and one of them is lying to the reader.
    const out = transformAPIResponse(budget, categories);
    const sum = out.categories.reduce((n, c) => n + c.amount, 0);
    expect(sum).toBe(out.metadata.totalBudget);
    expect(sum).toBe(140_249_393);
  });

  it('puts the largest function first in the reader\'s view of the data', () => {
    const out = transformAPIResponse(budget, categories);
    const biggest = [...out.categories].sort((a, b) => b.amount - a.amount)[0];
    expect(biggest.name).toBe('Public safety');
    expect(biggest.amount).toBe(66_240_230);
  });

  it('still carries the accounting basis through unchanged', () => {
    // The two changes touch the same function; neither may eat the other.
    const out = transformAPIResponse(budget, categories);
    expect(out.metadata.accountingBasis).toBe('gaap');
  });
});
