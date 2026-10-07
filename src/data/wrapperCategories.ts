import type { BudgetCategory, LineItem } from '../types/budget';

/**
 * Lift a GAAP statement's `Current` grouping so the reader sees FUNCTIONS first.
 *
 * ── ⚠⚠ WHY THIS EXISTS (issue #218) ─────────────────────────────────────────
 *
 * A GAAP governmental-funds statement classifies expenditures as
 * **Current / Capital outlay / Debt service** first and by function second. A
 * general fund is overwhelmingly operating cost, so the first thing a reader
 * saw was ONE SLICE holding 97–99% of the money, labelled "Current Operations".
 * Measured on production: Austin TX 99.3%, Durham NC 99.3%, Redmond WA 97.5%.
 *
 * Redmond's Public safety is $66,240,230 — 47% of everything the city spent —
 * and it was invisible until a click.
 *
 * ⚠ A BARS cash-basis filer has no such wrapper: Duvall prints its six
 * functions at the top level already. So two WA cities rendered as if they
 * were different products, for a reason that is real in the documents and
 * meaningless to a reader.
 *
 * ── ⚠⚠ WHAT THIS IS NOT ─────────────────────────────────────────────────────
 *
 * This is PRESENTATION ONLY. The stored hierarchy is untouched and keeps
 * reproducing the document, because the re-derivation harnesses check it
 * against the PDF. Nothing here may alter an amount: the promoted categories
 * sum to exactly what the wrapper held, and the page total is unchanged to the
 * penny.
 */

/**
 * The grouping words that are a FILING CONVENTION rather than a kind of
 * spending. Deliberately a tiny closed set.
 *
 * ⚠⚠ ANYTHING ADDED HERE GETS DISSOLVED. `Public safety` is a real category
 * that some issuers print with children; it must never appear in this list, or
 * a reader loses the grouping that tells them police and fire are one thing.
 * `Debt service` and `Capital outlay` stay as peers for the same reason — they
 * are genuinely different kinds of spending, not a wrapper around functions.
 */
export const WRAPPER_NAMES: ReadonlySet<string> = new Set([
  'current',
  'current operations',
  'current expenditures',
]);

const key = (s: string) => s.trim().toLowerCase().replace(/[:\s]+$/, '');

/** Is this category a dissolvable wrapper, on the evidence of this row alone? */
function isWrapper(c: BudgetCategory): boolean {
  if (!WRAPPER_NAMES.has(key(c.name ?? ''))) return false;
  const kids = c.lineItems ?? [];
  // One child reveals nothing and costs the reader the grouping.
  if (kids.length < 2) return false;
  // ⚠⚠ RECONCILIATION IS THE GATE. If the children do not sum to the parent,
  // promoting would DROP the residue from the displayed total and the page
  // would stop matching total_budget. Refusing keeps "moves no money"
  // unconditional, and leaves the residue visible as the intact wrapper —
  // which is a real signal about the issuer, not noise to absorb.
  const kidSum = kids.reduce((n, li) => n + (li.actualAmount ?? 0), 0);
  return kidSum === c.amount;
}

function promote(li: LineItem, wrapper: BudgetCategory): BudgetCategory {
  const amount = li.actualAmount ?? 0;
  return {
    name: li.description,
    amount,
    // The category level carries its money in `amount`; `actualAmount` is 0
    // here for every source in the corpus. Matching that exactly is what makes
    // a promoted row indistinguishable from a cash-basis filer's own row.
    actualAmount: 0,
    // Exact, and independent of whatever denominator the server used: the
    // wrapper's own share, split by the child's share of the wrapper.
    percentage: wrapper.amount > 0
      ? wrapper.percentage * (amount / wrapper.amount)
      : 0,
    color: '',
    items: 1,
    // ⚠⚠ NOT the wrapper's linkKey. `current` is the key the wrapper's
    // transactions hang off; handing it to six children would show each
    // function the SAME transaction list and attribute all of Current's
    // spending to whichever one the reader happened to click.
    //
    // The lowercased name is the convention a cash-basis filer already uses
    // (Duvall: `public safety`). Where no transactions are keyed that way the
    // lookup simply returns nothing, which is the honest answer.
    linkKey: key(li.description),
    // ⚠ NOT inherited either. "Day-to-day government operating costs" is true
    // of Current and false of Public safety, so carrying it down would publish
    // a description of the parent under the child's name.
    enrichment: null,
    lineItems: [li],
  };
}

export function promoteWrapperCategories(categories: BudgetCategory[]): BudgetCategory[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  if (!categories.some(isWrapper)) return categories;   // identity for every BARS filer

  const out: BudgetCategory[] = [];
  for (const c of categories) {
    if (isWrapper(c)) out.push(...(c.lineItems ?? []).map((li) => promote(li, c)));
    else out.push(c);
  }
  return out;
}
