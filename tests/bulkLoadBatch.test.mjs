/**
 * buildBatch — the row-to-RPC shape.
 *
 * ⚠⚠ Importing this module used to RUN THE LOADER. bulkLoadXLSX.js called
 * main() unconditionally at the bottom, so a test that imported it would have
 * downloaded and loaded every xlsx source in the fleet. The entry guard that
 * makes these tests possible is itself worth keeping honest — hence the first
 * test below.
 */
import { describe, it, expect } from 'vitest';
import { buildBatch } from '../scripts/bulkLoadXLSX.js';

const KEYS = (n) => Array.from({ length: n }, (_, i) => `key-${i}`);

describe('importing the loader', () => {
  /**
   * ⚠⚠⚠ THIS TEST IS THE GUARD, and CI is what makes it bite.
   *
   * The import above has to survive with NO SUPABASE CREDENTIALS, which is
   * exactly the environment CI runs in. Two separate module-scope side effects
   * broke that and were only caught here:
   *
   *   rebuildTransactionTree.mjs  createClient() at module scope — it THROWS
   *                               without a key ("supabaseKey is required")
   *   bulkLoadXLSX.js             process.exit(1) at module scope when no key
   *                               was set, which KILLS THE TEST RUNNER
   *
   * Both ran green locally, because a developer has a .env. Only the
   * credential-free run told the truth. If this file ever starts failing with
   * a connection or key error, something has moved back to module scope.
   */
  it('does not run it, and needs no credentials', () => {
    expect(typeof buildBatch).toBe('function');
  });
});

describe('buildBatch — the vendor rule', () => {
  const rows = [
    { payee: 'ACME SUPPLY', amount: 100, desc: 'WIDGETS' },
    { payee: '', amount: 200, desc: 'GADGETS' },
  ];

  it('names the vendor when a vendor column is configured', () => {
    const cm = { vendor_column: 'payee', amount_column: 'amount', description_column: 'desc' };
    const { vendors, transactions } = buildBatch(rows, cm, KEYS(2));
    expect(transactions[0].vn).toBe('ACME SUPPLY');
    expect(vendors.map((v) => v.n)).toContain('ACME SUPPLY');
  });

  it('falls back to Unknown for a blank payee when the column exists', () => {
    const cm = { vendor_column: 'payee', amount_column: 'amount', description_column: 'desc' };
    const { transactions } = buildBatch(rows, cm, KEYS(2));
    expect(transactions[1].vn).toBe('Unknown');
  });

  /**
   * ⚠⚠⚠ PLANO. Its PayeeName is truncated to a 5-character fixed width in
   * every row of every file: TT's largest Plano payee read "MO MI" and held
   * $483,527,652.16, and "COLLI" merged Collin County with Collin Creek — so
   * the axis MIS-AGGREGATED, not merely mislabelled.
   *
   * With no vendor_column the answer must be SILENCE. A row attributed to a
   * vendor literally called "Unknown" is still an assertion, and it would put
   * every Plano transaction under one invented payee.
   */
  it('emits NO vendor at all when no vendor column is configured', () => {
    const cm = { amount_column: 'amount', description_column: 'desc' };
    const { vendors, transactions } = buildBatch(rows, cm, KEYS(2));
    expect(transactions.every((t) => t.vn === null)).toBe(true);
    expect(vendors).toEqual([]);
  });

  it('still carries every other field when the vendor is absent', () => {
    const cm = { amount_column: 'amount', description_column: 'desc', date_column: 'when' };
    const withDate = rows.map((r) => ({ ...r, when: '9/30/2021 12:00:00 AM' }));
    const { transactions } = buildBatch(withDate, cm, KEYS(2));
    expect(transactions[0].a).toBe(100);
    expect(transactions[0].d).toBe('WIDGETS');
    expect(transactions[0].dt).toBe('2021-09-30');
    expect(transactions[0].rid).toBe('key-0');
  });

  it('does not collapse distinct rows into one vendor entry', () => {
    const cm = { vendor_column: 'payee', amount_column: 'amount' };
    const many = [
      { payee: 'A', amount: 1 }, { payee: 'B', amount: 2 }, { payee: 'A', amount: 3 },
    ];
    const { vendors } = buildBatch(many, cm, KEYS(3));
    expect(vendors.map((v) => v.n).sort()).toEqual(['A', 'B']);
  });
});

describe('buildBatch — the key it was handed', () => {
  // ⚠ Keys are computed over the WHOLE file and passed in. Recomputing them
  // per 500-row chunk would give two identical rows in different chunks the
  // same key and collapse them anyway.
  it('uses the caller-supplied key verbatim, in order', () => {
    const cm = { amount_column: 'amount' };
    const { transactions } = buildBatch([{ amount: 1 }, { amount: 2 }], cm, ['abc', 'def#1']);
    expect(transactions.map((t) => t.rid)).toEqual(['abc', 'def#1']);
  });
});
