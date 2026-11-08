/**
 * The chain between a published file and the rows TT stores.
 *
 * ⚠ The point of these tests is `expected` — the number the coverage gate
 * compares against the database. Every assertion here is really the same
 * assertion: a published line is not a stored row, and the difference is
 * policy, not loss.
 */
import { describe, it, expect } from 'vitest';
import { applyRowPolicies, MAX_PARSE_ERROR_SHARE } from '../scripts/lib/xlsxPolicies.mjs';

/** A Frisco-shaped mapping: no department, fund or category. */
const FRISCO = {
  header_row: 5,
  date_column: 'check_date',
  amount_column: 'amount',
  vendor_column: 'vendor_name',
  description_column: 'description',
};

/** A McKinney-shaped mapping: occurrence dedup, numeric department. */
const MCKINNEY = {
  dedup: 'occurrence',
  date_column: 'payment_date',
  amount_column: 'net_amount',
  vendor_column: 'description_1',
  department_column: 'department',
  description_column: 'description_2',
  invoice_number_column: 'payment_number',
};

const pay = (date, vendor, amount, description = 'x') => ({
  check_date: date, vendor_name: vendor, amount, description,
});

const mck = (date, vendor, amount, description = 'x', department = 1) => ({
  payment_date: date, description_1: vendor, net_amount: amount,
  description_2: description, department, payment_number: '1',
});

describe('applyRowPolicies — the count the gate compares', () => {
  it('counts every distinct row when no policy applies', () => {
    const rows = [
      pay('2024-01-02', 'A', 100),
      pay('2024-01-03', 'B', 200),
      pay('2024-01-04', 'C', 300),
    ];
    const r = applyRowPolicies(rows, FRISCO);
    expect(r.blocked).toBeNull();
    expect(r.expected).toBe(3);
  });

  /**
   * ⚠⚠⚠ THE DEFAULT POLICY COLLAPSES IDENTICAL LINES, and that is why the
   * gate cannot compare against a file's row count. Three identical published
   * lines become ONE row via ON CONFLICT DO NOTHING.
   */
  it('counts content-identical rows once under the default dedup', () => {
    const rows = [pay('2024-01-02', 'A', 100), pay('2024-01-02', 'A', 100), pay('2024-01-02', 'A', 100)];
    const r = applyRowPolicies(rows, FRISCO);
    expect(r.stages.parsedRows).toBe(3);
    expect(r.expected).toBe(1);
  });

  /**
   * ⚠ And keeps them under 'occurrence' — McKinney's four police Tahoes at
   * $52,962.25 on one purchase order are four payments, not one.
   */
  it('counts content-identical rows separately under occurrence dedup', () => {
    const rows = [
      mck('2024-01-02', 'TAHOE', 52962.25),
      mck('2024-01-02', 'TAHOE', 52962.25),
      mck('2024-01-02', 'TAHOE', 52962.25),
      mck('2024-01-02', 'TAHOE', 52962.25),
      mck('2024-01-03', 'OTHER', 10),
      mck('2024-01-04', 'THIRD', 20),
    ];
    const r = applyRowPolicies(rows, MCKINNEY);
    expect(r.blocked).toBeNull();
    expect(r.expected).toBe(6);
  });
});

/** Ten distinct payments of $10, $20 … $100 — $550 in all. */
const tenPayments = () => Array.from({ length: 10 }, (_, i) =>
  pay(`2024-01-${String(i + 2).padStart(2, '0')}`, `VENDOR ${i}`, (i + 1) * 10));

const totalRow = (amount) => ({
  check_date: null, vendor_name: null, amount, description: 'TOTAL',
});

describe('applyRowPolicies — the money, over the rows the database keeps', () => {
  /**
   * ⚠⚠ Summed over the FIRST row of each key. ON CONFLICT DO NOTHING discards
   * the later copies, so summing every row would count duplicates the database
   * does not hold — and the gate would report a shortfall that is not there.
   */
  it('counts a content-duplicated amount once', () => {
    const rows = [pay('2024-01-02', 'A', 100), pay('2024-01-02', 'A', 100), pay('2024-01-03', 'B', 7.5)];
    const r = applyRowPolicies(rows, FRISCO);
    expect(r.expected).toBe(2);
    expect(r.expectedAmount).toBe(107.5);
  });

  it('counts it every time under occurrence dedup', () => {
    const rows = [mck('2024-01-02', 'A', 100), mck('2024-01-02', 'A', 100), mck('2024-01-03', 'B', 7.5)];
    const r = applyRowPolicies(rows, MCKINNEY);
    expect(r.expected).toBe(3);
    expect(r.expectedAmount).toBe(207.5);
  });

  it('leaves the publisher’s grand total out of the money too', () => {
    const r = applyRowPolicies([...tenPayments(), totalRow(550)], FRISCO);
    expect(r.expectedAmount).toBe(550);
  });

  it('reports no money for a file it refuses', () => {
    const r = applyRowPolicies([totalRow(100), totalRow(100),
      pay('2024-02-01', 'P', 50), pay('2024-03-01', 'N', -50),
      ...Array.from({ length: 6 }, (_, i) => pay(`2024-04-0${i + 1}`, `Z${i}`, 0))], FRISCO);
    expect(r.blocked).not.toBeNull();
    expect(r.expectedAmount).toBe(0);
  });
});

describe("applyRowPolicies — the publisher's own grand total", () => {
  /** #336: loading this row published three Frisco years at exactly twice the truth. */
  it('excludes a grand total row and does not count it', () => {
    const r = applyRowPolicies([...tenPayments(), totalRow(550)], FRISCO);
    expect(r.stages.totalRow.found).toBe(true);
    expect(r.stages.tie.ok).toBe(true);
    expect(r.expected).toBe(10);
  });

  /**
   * ⚠ A row that does NOT equal the sum of the others is not a total at all —
   * it stays in, as a payment. The arithmetic is the test, not the label, so
   * `assertTieToTotal` can never fail behind a `found` verdict. That is why
   * the loader's tie check is belt-and-braces and this test asserts the
   * identification, not the tie.
   */
  it('leaves a row labelled TOTAL alone when the arithmetic does not agree', () => {
    const r = applyRowPolicies([...tenPayments(), totalRow(999)], FRISCO);
    expect(r.stages.totalRow.found).toBe(false);
    expect(r.expected).toBe(11);
  });

  /**
   * ⚠⚠ Two rows that each equal the sum of the others. Picking one would
   * delete a real payment, so the chain refuses. Reachable only with
   * offsetting entries — A = B = G/2 forces the rest to net to zero.
   */
  it('blocks rather than guesses when two rows could each be the total', () => {
    const offsetting = [];
    for (let i = 0; i < 4; i++) {
      offsetting.push(pay(`2024-02-0${i + 1}`, `P${i}`, 50));
      offsetting.push(pay(`2024-03-0${i + 1}`, `N${i}`, -50));
    }
    const r = applyRowPolicies([totalRow(100), totalRow(100), ...offsetting], FRISCO);
    expect(r.stages.totalRow.ambiguous).toBe(true);
    expect(r.blocked?.stage).toBe('total-row-ambiguous');
    expect(r.expected).toBe(0);
  });
});

describe('applyRowPolicies — blocked files report, they do not throw', () => {
  /**
   * ⚠ The loader calls process.exit() on these. The gate must not: a file it
   * read perfectly well but cannot judge is a FINDING, not an unreachable
   * publisher, and the two must never read the same.
   */
  it('returns a blocked verdict instead of exiting', () => {
    const rows = [totalRow(100), totalRow(100), pay('2024-02-01', 'P', 50), pay('2024-03-01', 'N', -50)];
    for (let i = 0; i < 6; i++) rows.push(pay(`2024-04-0${i + 1}`, `Z${i}`, 0));
    expect(() => applyRowPolicies(rows, FRISCO)).not.toThrow();
    expect(applyRowPolicies(rows, FRISCO).blocked).not.toBeNull();
  });

  it('blocks an occurrence source whose doubled-export check cannot run', () => {
    const r = applyRowPolicies([mck('2024-01-02', 'A', 100)], { ...MCKINNEY, date_column: null });
    expect(r.blocked?.stage).toBe('doubled-days-unsupported');
  });
});

describe('applyRowPolicies — an empty file', () => {
  it('expects zero rows without blocking', () => {
    const r = applyRowPolicies([], FRISCO);
    expect(r.blocked).toBeNull();
    expect(r.expected).toBe(0);
  });

  it('does not divide by zero on the parse error rate', () => {
    expect(MAX_PARSE_ERROR_SHARE).toBeGreaterThan(0);
    expect(applyRowPolicies([], FRISCO).stages.parseErrors).toBe(0);
  });
});
