import { describe, it, expect } from 'vitest';
import { promoteWrapperCategories, WRAPPER_NAMES } from './wrapperCategories';
import type { BudgetCategory } from '../types/budget';

/**
 * Issue #218 — the first view of a GAAP entity was one slice at 97–99%.
 *
 * ⚠⚠ THE FIGURES ARE REDMOND FY2024, MEASURED FROM PRODUCTION, not invented.
 * Public safety is $66,240,230 of a $140,249,393 general fund — 47% of
 * everything the city spent — and it was invisible until a click, because a
 * GAAP governmental-funds statement groups it under `Current`.
 *
 * ⚠ This is a PRESENTATION change only. The stored hierarchy must keep
 * reproducing the document, because the re-derivation harnesses check it
 * against the PDF. Nothing here may alter an amount.
 */

const li = (description: string, actualAmount: number) => ({
  description, approvedAmount: 0, actualAmount,
});

/** Redmond FY2024 operating, exactly as /categories returns it. */
const redmond = (): BudgetCategory[] => ([
  {
    name: 'Current',
    amount: 136_809_979,
    actualAmount: 0,
    percentage: 97.54764428820023,
    color: '',
    items: 6,
    linkKey: 'current',
    enrichment: { plainName: 'Current Operations' } as never,
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
]);

const sum = (cs: BudgetCategory[]) => cs.reduce((n, c) => n + c.amount, 0);

describe('promoteWrapperCategories', () => {
  it('lifts the wrapper\'s children to the top level', () => {
    const out = promoteWrapperCategories(redmond());
    expect(out.map((c) => c.name)).toEqual([
      'General government', 'Public safety', 'Transportation',
      'Economic environment', 'Culture and recreation', 'Social services',
      'Capital outlay', 'Debt service',
    ]);
  });

  it('MOVES NO MONEY — the total is identical to the penny', () => {
    // ⚠⚠ The one assertion that must never be relaxed. A presentation change
    // that alters a figure is a data defect wearing a UI costume.
    const before = redmond();
    const out = promoteWrapperCategories(before);
    expect(sum(out)).toBe(sum(before));
    expect(sum(out)).toBe(140_249_393);
  });

  it('gives each promoted category its own amount, not the wrapper\'s', () => {
    const out = promoteWrapperCategories(redmond());
    const safety = out.find((c) => c.name === 'Public safety')!;
    expect(safety.amount).toBe(66_240_230);
  });

  it('recomputes percentages against the same denominator', () => {
    const out = promoteWrapperCategories(redmond());
    const safety = out.find((c) => c.name === 'Public safety')!;
    // 66,240,230 / 140,249,393 = 47.23%
    expect(safety.percentage).toBeCloseTo(47.23, 1);
    // and the untouched siblings keep theirs
    expect(out.find((c) => c.name === 'Debt service')!.percentage).toBeCloseTo(0.5987, 3);
  });

  it('matches the shape a cash-basis entity already returns', () => {
    // ⚠ Duvall's categories carry linkKey = the lowercased name and
    // lineItems = [itself]. Promoted categories must look the same or the two
    // cities still render as different products.
    const out = promoteWrapperCategories(redmond());
    const safety = out.find((c) => c.name === 'Public safety')!;
    expect(safety.linkKey).toBe('public safety');
    expect(safety.lineItems).toEqual([li('Public safety', 66_240_230)]);
    expect(safety.items).toBe(1);
    expect(safety.actualAmount).toBe(0);
  });

  it('does NOT inherit the wrapper\'s linkKey', () => {
    // ⚠⚠ `current` is the key the wrapper's transactions hang off. Handing it
    // to six children would show every function the SAME transaction list and
    // attribute Current's spending to whichever one the reader clicked.
    const out = promoteWrapperCategories(redmond());
    expect(out.filter((c) => c.linkKey === 'current')).toEqual([]);
  });

  it('does not inherit the wrapper\'s enrichment', () => {
    // "Day-to-day government operating costs" is true of Current, and false of
    // Public safety specifically. Carrying it down would publish a description
    // of the parent under the child's name.
    const out = promoteWrapperCategories(redmond());
    for (const c of out.slice(0, 6)) expect(c.enrichment ?? null).toBeNull();
  });

  it('leaves a statement that has no wrapper completely alone', () => {
    // Duvall and every other BARS cash filer. Identity, not a rebuild.
    const duvall: BudgetCategory[] = [
      { name: 'General Government', amount: 1_726_327, percentage: 22.1, color: '', items: 1,
        linkKey: 'general government', lineItems: [li('General Government', 1_726_327)] },
      { name: 'Public Safety', amount: 3_432_013, percentage: 44.0, color: '', items: 1,
        linkKey: 'public safety', lineItems: [li('Public Safety', 3_432_013)] },
    ];
    expect(promoteWrapperCategories(duvall)).toEqual(duvall);
  });

  it('does not promote a wrapper with only one child', () => {
    // Nothing is revealed, and the reader loses the grouping for free.
    const one: BudgetCategory[] = [
      { name: 'Current', amount: 100, percentage: 100, color: '', items: 1,
        linkKey: 'current', lineItems: [li('General government', 100)] },
    ];
    expect(promoteWrapperCategories(one)).toEqual(one);
  });

  it('does not promote a wrapper carrying no children at all', () => {
    const bare: BudgetCategory[] = [
      { name: 'Current', amount: 100, percentage: 100, color: '', items: 0, linkKey: 'current' },
    ];
    expect(promoteWrapperCategories(bare)).toEqual(bare);
  });

  it('only treats the declared grouping words as wrappers', () => {
    // ⚠ A real spending category must never be dissolved. `Public safety` has
    // children in some issuers' trees and is NOT a wrapper.
    const notAWrapper: BudgetCategory[] = [
      { name: 'Public safety', amount: 300, percentage: 100, color: '', items: 2,
        linkKey: 'public safety',
        lineItems: [li('Police', 200), li('Fire', 100)] },
    ];
    expect(promoteWrapperCategories(notAWrapper)).toEqual(notAWrapper);
    expect([...WRAPPER_NAMES]).not.toContain('public safety');
  });

  it('survives an empty list and a null-ish input without throwing', () => {
    expect(promoteWrapperCategories([])).toEqual([]);
    expect(promoteWrapperCategories(undefined as never)).toEqual([]);
  });

  it('REFUSES to promote a wrapper whose children do not reconcile to it', () => {
    // ⚠⚠ Promoting a non-reconciling wrapper would DROP the residue from the
    // displayed total — $100 of spending rendered as $90 — and the page total
    // would stop matching total_budget. Refusing keeps "moves no money"
    // unconditional rather than true-in-the-cases-we-thought-of.
    //
    // The residue is a real signal (the issuer printed a subtotal its own
    // children do not sum to); it stays visible as the intact wrapper instead
    // of being quietly absorbed.
    const odd: BudgetCategory[] = [
      { name: 'Current', amount: 100, percentage: 100, color: '', items: 2, linkKey: 'current',
        lineItems: [li('A', 60), li('B', 30)] },
    ];
    expect(promoteWrapperCategories(odd)).toEqual(odd);
  });
});
