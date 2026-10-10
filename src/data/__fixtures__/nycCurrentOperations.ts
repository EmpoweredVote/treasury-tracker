import type { BudgetCategory } from '../../types/budget';

/**
 * New York City FY2002, `Current Operations` — the level that reported the
 * 2026-10-10 defects (one blue, unsorted, `$13480.9M`, a blank sliver).
 *
 * ⚠⚠ ALL FIFTEEN FUNCTIONS, IN THE ACFR'S OWN ROW ORDER. An abridged copy is
 * worse than useless for these tests: every share is a fraction of the level
 * TOTAL, so dropping five functions shrinks the denominator and moves every
 * segment's pixel width. A ten-row version put `Public safety and judicial` at
 * 18.8% instead of 15.9%, which is the difference between 64px and 54px on a
 * phone — i.e. between the two sides of the label floor.
 *
 * Figures are the ones the product displays, read back from the live page
 * (production API, 2026-10-10) and cross-checked against the reported
 * screenshot.
 *
 * ⚠ `Fringe benefits` and `Health` are the two the screenshot clipped. They are
 * carried at the values that reproduce their published shares (5.3% / 4.9%) and
 * make the level sum to the $46,009.9M that Education's 29.3% implies. Every
 * other figure is exact. Nothing here is an oracle for an AMOUNT — these tests
 * assert layout and colour, never money.
 */
const m = (millions: number) => millions * 1_000_000;

const cat = (name: string, millions: number): BudgetCategory =>
  ({ name, amount: m(millions), percentage: 0, subcategories: [] } as unknown as BudgetCategory);

export const NYC_CURRENT_OPERATIONS: BudgetCategory[] = [
  cat('General Government', 2_399.9),
  cat('Public safety and judicial', 7_290.8),
  cat('Education', 13_480.9),
  cat('City University', 428.5),
  cat('Social services', 9_203.9),
  cat('Environmental protection', 2_824.5),
  cat('Transportation services', 1_593.5),
  cat('Parks, recreation and cultural activities', 674.6),
  cat('Housing', 820.7),
  cat('Health (including payments to HHC)', 2_272.3),
  cat('Libraries', 158.4),
  cat('Pensions', 1_391.9),
  cat('Judgments and claims', 521.8),
  cat('Fringe benefits and other benefit payments', 2_457.8),
  cat('Administrative and other', 490.4),
];

export const NYC_CURRENT_OPERATIONS_TOTAL =
  NYC_CURRENT_OPERATIONS.reduce((n, c) => n + c.amount, 0);

/** The peer `Current Operations` sits beside at the root of the FY2002 tree. */
export const NYC_DEBT_SERVICE = cat('Debt Service', 1_800);

export function nycCurrentOperationsNode(functions: BudgetCategory[]): BudgetCategory {
  return {
    name: 'Current Operations',
    amount: functions.reduce((n, c) => n + c.amount, 0),
    percentage: 96,
    subcategories: functions,
  } as unknown as BudgetCategory;
}
