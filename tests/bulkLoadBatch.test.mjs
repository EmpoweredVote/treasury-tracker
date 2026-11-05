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

describe('no module-scope database client', () => {
  /**
   * ⚠⚠ The lazy-client refactor missed two call sites inside the
   * --force-reload branch, and nothing caught it: the import test only proves
   * the module LOADS, and buildBatch never touches the database. The bug
   * surfaced as `ReferenceError: supabase is not defined` on a real reload.
   *
   * This is a source-level guard, in the spirit of the shebang check in
   * tests/waSao.test.mjs — cheap, and it covers every branch at once.
   */
  it('reaches the client only through client() / db()', async () => {
    const { readFileSync } = await import('node:fs');
    const offenders = [];
    for (const f of ['scripts/bulkLoadXLSX.js', 'scripts/rebuildTransactionTree.mjs']) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // A bare `supabase.` / `db.` call, not `client()` / `db()`, and not a
        // comment, a URL, an env var, or the memoised private field.
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/\b(?:await\s+)?supabase\s*$|\bsupabase\s*\.\s*(?:schema|from|rpc)\b/.test(line)
          && !/_supabase|supabase\.co|SUPABASE_|@supabase/.test(line)) {
          offenders.push(`${f}:${i + 1}`);
        }
        if (/\bdb\s*\.\s*(?:schema|from|rpc)\b/.test(line)) offenders.push(`${f}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * ── ⚠⚠⚠ THE LINK KEY, WHICH THE LOADER USED TO ERASE ──────────────────────
 *
 * `treasury_sync_transactions` writes `link_key` from `t.lk` and does NOT
 * touch `budget_categories`. buildBatch only ever computed a key from
 * department|fund|expense_category — three columns Frisco's mapping does not
 * have — so every Frisco reload wrote NULL on every row while the tree above
 * them stayed keyed on the VENDOR NAME.
 *
 * The two silently stopped describing each other. When #336 removed the
 * publisher TOTAL row and #339 collapsed the repeated allocation rows, the
 * headlines were corrected and the TREES kept the old figures — including a
 * phantom root called "Unknown" holding $2.52 BILLION across three years,
 * still clickable on the live site.
 */
describe('buildBatch — the link key', () => {
  const KEY = (n) => Array.from({ length: n }, (_, i) => `row-${i}`);

  it('prefers a structural key when the publisher gives one', () => {
    const cm = { department_column: 'dept', fund_column: 'fund', amount_column: 'amount',
                 vendor_column: 'payee' };
    const rows = [{ dept: 2119, fund: '100', amount: 5, payee: 'ACME' }];
    expect(buildBatch(rows, cm, KEY(1)).transactions[0].lk).toBe('2119|100');
  });

  /** ⚠ The McKinney defect: department code 0 is REAL and must keep its key. */
  it('keeps the integer zero in a structural key', () => {
    const cm = { department_column: 'dept', amount_column: 'amount', vendor_column: 'payee' };
    const rows = [{ dept: 0, amount: 5, payee: 'ACME' }];
    expect(buildBatch(rows, cm, KEY(1)).transactions[0].lk).toBe('0');
  });

  it('falls back to the vendor when there is no structural column at all', () => {
    const cm = { amount_column: 'amount', vendor_column: 'payee' };
    const rows = [{ amount: 5, payee: 'NORTH TEXAS MUNICIPAL WATER DISTRICT' }];
    expect(buildBatch(rows, cm, KEY(1)).transactions[0].lk)
      .toBe('north-texas-municipal-water-district');
  });

  it('keys the vendor exactly as the stored Frisco trees do', () => {
    const cm = { amount_column: 'amount', vendor_column: 'payee' };
    const rows = [{ amount: 1, payee: 'CITY OF FRISCO - BIWEEKLY PAYROLL' },
                  { amount: 1, payee: 'A TO T LAMPS INC    ' },
                  { amount: 1, payee: 'A&M MAINTENANCE SERVICES, INC.' }];
    expect(buildBatch(rows, cm, KEY(3)).transactions.map((t) => t.lk))
      .toEqual(['city-of-frisco-biweekly-payroll', 'a-to-t-lamps-inc', 'a-m-maintenance-services-inc-']);
  });

  /**
   * ⚠⚠ Plano has NO vendor column (#340 removed it: the payee is truncated to
   * five characters). There is nothing to key on and the honest answer is a
   * NULL key, not a key derived from a label TT refuses to publish.
   */
  it('emits a NULL key when there is neither a structural column nor a vendor', () => {
    const cm = { amount_column: 'amount' };
    expect(buildBatch([{ amount: 5 }], cm, KEY(1)).transactions[0].lk).toBeNull();
  });

  it('never keys on the literal string "Unknown" for a blank payee', () => {
    // A blank payee becomes the vendor NAME "Unknown"; keying on it would
    // rebuild the very root this work removed.
    const cm = { amount_column: 'amount', vendor_column: 'payee' };
    const lk = buildBatch([{ amount: 5, payee: '' }], cm, KEY(1)).transactions[0].lk;
    expect(lk).toBe('unknown');
  });
});
