/**
 * The Socrata transaction loader's failure handling.
 *
 * ⚠⚠ Importing this module must work with NO CREDENTIALS. It used to call
 * `process.exit(1)` at module scope when no key was set — which kills the test
 * runner — and ran `main()` unconditionally at the bottom, so importing it
 * would have loaded every Socrata source in the fleet. Both are fixed; this
 * file is what keeps them fixed.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildBatch, withRetry } from '../scripts/bulkLoadTransactions.js';

describe('withRetry', () => {
  /**
   * ⚠⚠⚠ WHY THIS EXISTS. LA City FY2025 is 749,295 rows over 150 requests.
   * The first attempt died at row 65,000 with ECONNRESET and the run exited,
   * leaving the year PART-LOADED and live on the site. A connection does not
   * survive a quarter of an hour; the loader has to expect that.
   */
  it('returns the value when the first attempt works', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry('x', fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recovers from a transient failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');
    await expect(withRetry('x', fn, 3)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  /** ⚠ A permanent failure must still FAIL. Retrying is not swallowing. */
  it('gives up and throws, naming the label and the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('terminated'));
    await expect(withRetry('fetch offset 65000', fn, 3))
      .rejects.toThrow(/fetch offset 65000 failed after 3 attempts: terminated/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when told not to', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('nope'));
    await expect(withRetry('x', fn, 1)).rejects.toThrow(/failed after 1 attempts/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('buildBatch', () => {
  const cm = {
    amount_column: 'amt_paid',
    date_column: 'check_date',
    vendor_column: 'vendor_name',
    expense_category_column: 'category',
    source_row_id_column: ':id',
  };

  /**
   * ⚠⚠⚠ THE WHOLE DEFECT IN ONE ASSERTION. `rid` becomes `source_row_id`, and
   * `treasury_sync_transactions` treats rows sharing one as the SAME ROW. When
   * this read `demand` — a batch number carried by ~1,100 rows at a time —
   * West Hollywood kept 143 of 134,643 published rows.
   */
  it('takes the row id from the declared column', () => {
    const { transactions } = buildBatch(
      [{ ':id': 'row-abcd~1234', amt_paid: '10.00', vendor_name: 'ACME', category: 'Supplies', demand: '870' }],
      cm,
    );
    expect(transactions[0].rid).toBe('row-abcd~1234');
    expect(transactions[0].rid).not.toBe('870');
  });

  it('gives distinct row ids to rows a batch number would have merged', () => {
    const rows = [
      { ':id': 'row-aaaa~1', amt_paid: '1.00', vendor_name: 'A', demand: '870' },
      { ':id': 'row-bbbb~2', amt_paid: '2.00', vendor_name: 'B', demand: '870' },
    ];
    const { transactions } = buildBatch(rows, cm);
    expect(new Set(transactions.map((t) => t.rid)).size).toBe(2);
  });

  /** ⚠ A missing column must read as absent, not as the string "undefined". */
  it('is null when the declared row id is absent from the row', () => {
    const { transactions } = buildBatch([{ amt_paid: '1.00', vendor_name: 'A' }], cm);
    expect(transactions[0].rid).toBeNull();
  });

  it('is null when no row id column is declared at all', () => {
    const { transactions } = buildBatch(
      [{ ':id': 'row-x', amt_paid: '1.00', vendor_name: 'A' }],
      { amount_column: 'amt_paid', vendor_column: 'vendor_name' },
    );
    expect(transactions[0].rid).toBeNull();
  });

  /**
   * ⚠⚠ West Hollywood FY2018-19 publishes `amt_paid`; the mapping named
   * `amount_paid`, so every row parsed to 0 and TT published $0 for the year.
   */
  it('parses zero when the amount column does not exist, which is why $0 shipped', () => {
    const { transactions } = buildBatch(
      [{ ':id': 'row-x', amount_paid: '123.45', vendor_name: 'A' }], cm,
    );
    expect(transactions[0].a).toBe(0);
  });

  it('reads the amount when the column name is right', () => {
    const { transactions } = buildBatch(
      [{ ':id': 'row-x', amt_paid: '123.45', vendor_name: 'A' }], cm,
    );
    expect(transactions[0].a).toBe(123.45);
  });

  it('collects distinct vendors', () => {
    const { vendors } = buildBatch([
      { ':id': 'a', amt_paid: '1', vendor_name: 'ACME' },
      { ':id': 'b', amt_paid: '1', vendor_name: 'ACME' },
      { ':id': 'c', amt_paid: '1', vendor_name: 'OTHER' },
    ], cm);
    expect(vendors.map((v) => v.n).sort()).toEqual(['ACME', 'OTHER']);
  });
});
