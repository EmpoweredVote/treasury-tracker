/**
 * The row where a publisher wrote its own grand total — and why loading it as
 * a payment published three Frisco years at exactly twice the truth.
 *
 * ⚠⚠ No gate could catch this. The tree tied to the total, the total tied to
 * the transactions, every row had a real amount. A self-consistent file loaded
 * self-consistently; it was just counted twice. These tests are the only thing
 * standing between that file and the figure.
 */
import { describe, it, expect } from 'vitest';
import {
  findPublisherTotalRow,
  withoutTotalRow,
  assertTieToTotal,
  describeTotalRow,
  MIN_ROWS,
  TIE_TOLERANCE,
} from '../scripts/lib/publisherTotalRow.mjs';

const OPTS = {
  amountColumn: 'amount',
  dateColumn: 'check_date',
  vendorColumn: 'vendor_name',
  descriptionColumn: 'description',
};

/** n ordinary payments. */
function payments(n, each = 100) {
  return Array.from({ length: n }, (_, i) => ({
    check_date: '2019-06-06', vendor_name: `VENDOR ${i}`, description: 'SUPPLIES', amount: each,
  }));
}

/** Frisco's actual shape: last row, no date, no vendor, description TOTAL. */
function friscoTotal(amount, description = 'TOTAL') {
  return { check_date: null, vendor_name: null, description, amount };
}

describe('findPublisherTotalRow — the Frisco shape', () => {
  it('finds a trailing TOTAL row that equals the sum of the others', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    const v = findPublisherTotalRow(rows, OPTS);
    expect(v.found).toBe(true);
    expect(v.index).toBe(20);
    expect(v.amount).toBe(1000);
    expect(v.dataSum).toBe(1000);
    expect(v.reasons).toContain('no date');
    expect(v.reasons).toContain('no vendor');
    expect(v.reasons).toContain('labelled "TOTAL"');
  });

  // ⚠ Frisco FY2022's total row has a NULL description — matching on the word
  // "TOTAL" alone would have caught two of the three broken years and left the
  // third publishing $879,807,220.41 against a real $439,934,311.30.
  it('finds it when the label is missing entirely', () => {
    const rows = [...payments(20, 50), friscoTotal(1000, null)];
    const v = findPublisherTotalRow(rows, OPTS);
    expect(v.found).toBe(true);
    expect(v.reasons).toEqual(['no date', 'no vendor']);
  });

  it('finds it wherever it sits, not only at the end', () => {
    const rows = [...payments(10, 50), friscoTotal(1000), ...payments(10, 50)];
    expect(findPublisherTotalRow(rows, OPTS).index).toBe(10);
  });

  it('reports the sum the data rows must reach', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    const v = findPublisherTotalRow(rows, OPTS);
    expect(v.dataSum).toBe(1000);
  });
});

describe('findPublisherTotalRow — leaving ordinary files alone', () => {
  // Frisco FY2020, FY2021, FY2023-26 and every McKinney register.
  it('finds nothing in a file with no total row', () => {
    const v = findPublisherTotalRow(payments(50, 50), OPTS);
    expect(v.found).toBe(false);
    expect(v.candidates).toEqual([]);
  });

  // ⚠⚠⚠ THE ONE THAT MUST NOT FIRE. A blank-vendor row is ordinary in plenty
  // of registers; only the arithmetic makes it a total.
  it('leaves a date-less, vendor-less row that is NOT half the file', () => {
    const rows = [...payments(20, 50), friscoTotal(7)];
    expect(findPublisherTotalRow(rows, OPTS).found).toBe(false);
  });

  // ⚠ Arithmetic alone is not enough: a real payment could land on half the
  // file total, and in a small file one always does.
  it('refuses a row that is half the file but looks like a real payment', () => {
    const rows = [
      ...payments(20, 50),
      { check_date: '2019-07-01', vendor_name: 'BIG CONTRACTOR', description: 'PHASE 2', amount: 1000 },
    ];
    expect(findPublisherTotalRow(rows, OPTS).found).toBe(false);
  });

  it('ignores a zero or negative row', () => {
    const rows = [...payments(20, 0), friscoTotal(0)];
    expect(findPublisherTotalRow(rows, OPTS).found).toBe(false);
  });

  it('needs an amount column before it will judge anything', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    expect(findPublisherTotalRow(rows, { dateColumn: 'check_date' }).found).toBe(false);
  });

  // ⚠⚠ Sizes are LITERAL on purpose. Writing these as `payments(MIN_ROWS - 2)`
  // made the test move with the constant: mutating MIN_ROWS to 2 rewrote the
  // fixture too and the mutation escaped. A floor test must not be expressed
  // in terms of the floor.
  it('refuses a 9-row file and judges an 11-row one', () => {
    const under = [...payments(8, 50), friscoTotal(400)];        // 9 rows
    const over = [...payments(10, 50), friscoTotal(500)];        // 11 rows
    expect(under).toHaveLength(9);
    expect(over).toHaveLength(11);
    expect(findPublisherTotalRow(under, OPTS).found).toBe(false);
    expect(findPublisherTotalRow(over, OPTS).found).toBe(true);
  });

  it('keeps the floor at ten', () => {
    expect(MIN_ROWS).toBe(10);
  });
});

describe('findPublisherTotalRow — refusing to guess', () => {
  /**
   * ⚠⚠ Ambiguity is nearly impossible, and the algebra says why. If rows A and
   * B each equal the sum of all the others, then A = B = G/2, so everything
   * else must net to ZERO. In an ordinary register of positive payments that
   * cannot happen — it needs offsetting entries, like a reversal file.
   *
   * Constructed deliberately here: 18 rows of +50/-50 netting to nothing,
   * beside two blank rows of 1,000.
   */
  const offsetting = Array.from({ length: 18 }, (_, i) => ({
    check_date: '2019-06-06', vendor_name: `V${i}`, description: 'ADJ', amount: i % 2 ? -50 : 50,
  }));

  it('reports ambiguity rather than choosing', () => {
    const rows = [...offsetting, friscoTotal(1000), friscoTotal(1000)];
    const v = findPublisherTotalRow(rows, OPTS);
    expect(v.found).toBe(false);
    expect(v.ambiguous).toBe(true);
    expect(v.candidates).toHaveLength(2);
  });

  it('says so in words', () => {
    const rows = [...offsetting, friscoTotal(1000), friscoTotal(1000)];
    const lines = describeTotalRow(findPublisherTotalRow(rows, OPTS));
    expect(lines[0]).toMatch(/2 rows each equal the sum/);
    expect(lines).toHaveLength(3);
  });
});

describe('withoutTotalRow', () => {
  it('drops exactly the total row and keeps every payment', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    const kept = withoutTotalRow(rows, findPublisherTotalRow(rows, OPTS));
    expect(kept).toHaveLength(20);
    expect(kept.every((r) => r.vendor_name !== null)).toBe(true);
  });

  it('changes nothing when there is no total row', () => {
    const rows = payments(50, 50);
    expect(withoutTotalRow(rows, findPublisherTotalRow(rows, OPTS))).toBe(rows);
  });
});

describe('assertTieToTotal — the oracle half', () => {
  it('ties when the remaining rows sum to the published total', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    const v = findPublisherTotalRow(rows, OPTS);
    const tie = assertTieToTotal(withoutTotalRow(rows, v), v, 'amount');
    expect(tie.ok).toBe(true);
    expect(tie.expected).toBe(1000);
    expect(tie.actual).toBe(1000);
    expect(tie.difference).toBe(0);
  });

  // ⚠⚠ The gate half. If rows go missing between the parse and the load, the
  // publisher's own total is what notices.
  it('refuses when a row has gone missing', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    const v = findPublisherTotalRow(rows, OPTS);
    const short = withoutTotalRow(rows, v).slice(0, 19);
    const tie = assertTieToTotal(short, v, 'amount');
    expect(tie.ok).toBe(false);
    expect(tie.difference).toBe(-50);
  });

  it('passes trivially when the file carries no total to check against', () => {
    expect(assertTieToTotal(payments(20, 50), findPublisherTotalRow(payments(20, 50), OPTS), 'amount').ok).toBe(true);
  });

  it('tolerates float drift but not a real cent', () => {
    const rows = [...payments(20, 0.1), friscoTotal(2)];
    const v = findPublisherTotalRow(rows, OPTS);
    expect(assertTieToTotal(withoutTotalRow(rows, v), v, 'amount').ok).toBe(true);
    expect(TIE_TOLERANCE).toBeLessThan(0.02);
  });
});

describe('describeTotalRow', () => {
  it('names the row, the money and why it was judged a total', () => {
    const rows = [...payments(20, 50), friscoTotal(1000)];
    const [line] = describeTotalRow(findPublisherTotalRow(rows, OPTS));
    expect(line).toContain('row 20');
    expect(line).toContain('$1,000.00');
    expect(line).toContain('equals the sum of the other rows');
    expect(line).toContain('labelled "TOTAL"');
  });

  it('says nothing when there is nothing to say', () => {
    expect(describeTotalRow(findPublisherTotalRow(payments(30), OPTS))).toEqual([]);
  });
});
