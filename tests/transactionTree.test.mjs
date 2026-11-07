/**
 * Rolling transactions up into a category tree.
 *
 * ⚠⚠ The defect these guard against is not an arithmetic one. The McKinney
 * tree summed correctly, tied to its headline and passed every gate while its
 * largest-but-one root pointed at nothing — because the rows beneath it had
 * lost their key and the rollup that built it was a one-off nobody could re-run.
 */
import { describe, it, expect } from 'vitest';
import { rollUpTransactions, diffTree, isEmptyPublishedRow } from '../scripts/lib/transactionTree.mjs';
import { resolverFor, isEnrolled } from '../scripts/lib/transactionTreeSources.mjs';

const byKey = (names) => (keys) => new Map(keys.map((k) => [k, names[k] ?? `Key ${k}`]));

describe('rollUpTransactions', () => {
  it('groups by link_key and sums', () => {
    const { roots, total } = rollUpTransactions(
      [{ link_key: 'a', amount: 10 }, { link_key: 'b', amount: 5 }, { link_key: 'a', amount: 2.5 }],
      byKey({ a: 'Alpha', b: 'Beta' }),
    );
    expect(total).toBe(17.5);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toMatchObject({ link_key: 'a', name: 'Alpha', amount: 12.5, item_count: 2 });
    // ⚠ A register records money already spent: the actual IS the amount.
    expect(roots[0].actual_amount).toBe(12.5);
    expect(roots[1]).toMatchObject({ link_key: 'b', name: 'Beta', amount: 5, item_count: 1 });
  });

  it('orders by amount descending and stamps sort_order', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'small', amount: 1 }, { link_key: 'big', amount: 100 }],
      byKey({ small: 'Small', big: 'Big' }),
    );
    expect(roots.map((r) => r.link_key)).toEqual(['big', 'small']);
    // 1-based, matching every transaction-backed tree already stored.
    expect(roots.map((r) => r.sort_order)).toEqual([1, 2]);
  });

  it('computes percentages that sum to ~100', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: 'b', amount: 2 }, { link_key: 'c', amount: 1 }],
      byKey({ a: 'A', b: 'B', c: 'C' }),
    );
    expect(roots.reduce((s, r) => s + r.percentage, 0)).toBeCloseTo(100, 3);
  });

  // ⚠⚠⚠ The refusal that matters. $79.1M once went into an "Unknown" bucket.
  it('REFUSES a null link_key instead of bucketing it', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 10 }, { link_key: null, amount: 79113309.51 }],
      byKey({ a: 'Alpha' }),
    )).toThrow(/have NO link_key/);
  });

  it('names the money it is refusing, so the refusal is actionable', () => {
    let msg = '';
    try {
      rollUpTransactions([{ link_key: null, amount: 1234.5 }], byKey({}));
    } catch (e) { msg = e.message; }
    expect(msg).toMatch(/1,234\.5/);
    expect(msg).toMatch(/do NOT bucket them/);
  });

  it('treats an empty-string key as missing too', () => {
    expect(() => rollUpTransactions([{ link_key: '', amount: 1 }], byKey({}))).toThrow(/NO link_key/);
  });

  /**
   * ── ⚠⚠ THE EMPTY PUBLISHED ROW, AND WHY IT IS NOT A LOOPHOLE ────────────
   *
   * West Hollywood's FY2018-19 register contains one row the city published
   * with nothing in it (`row-kt5z-k7g9.mzuf`: only system fields and
   * `retainage: "0"`). It has no key because there is nothing to key it on,
   * and it carries $0. TT stores it — the Milledgeville Rule — so the roll-up
   * has to say something about it.
   *
   * These tests pin the line. Zero amount is NOT on its own enough: a row with
   * $0 and a real date or description has content the publisher declined to
   * classify, which is the thing the refusal exists for.
   */
  it('excludes a row the publisher published EMPTY, and counts it', () => {
    const { roots, total, emptyRows } = rollUpTransactions(
      [{ link_key: 'a', amount: 10 },
       { link_key: null, amount: 0, description: null, payment_date: null }],
      byKey({ a: 'Alpha' }),
    );
    expect(emptyRows).toBe(1);
    expect(total).toBe(10);
    expect(roots).toHaveLength(1);
  });

  it('reports zero empty rows when there are none', () => {
    const { emptyRows } = rollUpTransactions([{ link_key: 'a', amount: 1 }], byKey({ a: 'A' }));
    expect(emptyRows).toBe(0);
  });

  it('still REFUSES a $0 row that carries a date', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: null, amount: 0, payment_date: '2019-03-14' }],
      byKey({ a: 'Alpha' }),
    )).toThrow(/NO link_key/);
  });

  it('still REFUSES a $0 row that carries a description', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: null, amount: 0, description: 'VOID — reissued' }],
      byKey({ a: 'Alpha' }),
    )).toThrow(/NO link_key/);
  });

  it('still REFUSES a $0 row that carries an invoice number or a fund', () => {
    for (const extra of [{ invoice_number: '0013247' }, { fund: 'General Fund' },
                         { expense_category: 'Contracted Services' }, { department: '4306' }]) {
      expect(() => rollUpTransactions(
        [{ link_key: 'a', amount: 1 }, { link_key: null, amount: 0, ...extra }],
        byKey({ a: 'Alpha' }),
      ), JSON.stringify(extra)).toThrow(/NO link_key/);
    }
  });

  // ⚠⚠⚠ The McKinney case must survive untouched: money with no key refuses.
  it('still REFUSES an unkeyed row that carries money', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 10 }, { link_key: null, amount: 79113309.51 }],
      byKey({ a: 'Alpha' }),
    )).toThrow(/have NO link_key/);
  });

  /**
   * ⚠ The vendor is deliberately NOT evidence of emptiness. The loader writes
   * `vendor || "Unknown"`, so the real WeHo row comes back carrying the string
   * "Unknown" — a column that is never empty cannot prove a row is.
   */
  it('counts the row empty even though the loader gave it a vendor of "Unknown"', () => {
    const { emptyRows } = rollUpTransactions(
      [{ link_key: 'a', amount: 1 },
       { link_key: null, amount: 0, vendors: { name: 'Unknown' } }],
      byKey({ a: 'A' }),
    );
    expect(emptyRows).toBe(1);
  });

  it('exposes the predicate on its own so the SQL gate can be checked against it', () => {
    expect(isEmptyPublishedRow({ amount: 0 })).toBe(true);
    expect(isEmptyPublishedRow({ amount: '0' })).toBe(true);
    expect(isEmptyPublishedRow({ amount: 0.01 })).toBe(false);
    expect(isEmptyPublishedRow({ amount: -1 })).toBe(false);
    expect(isEmptyPublishedRow({ amount: 0, description: '' })).toBe(true);
    expect(isEmptyPublishedRow({ amount: 0, program: 'Rent Stabilization' })).toBe(false);
  });

  it('refuses to write an empty tree', () => {
    expect(() => rollUpTransactions([], byKey({}))).toThrow(/no transactions/);
  });

  it('refuses when the resolver has no name for a key', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }],
      () => new Map(),
    )).toThrow(/resolver returned nothing/);
  });

  /**
   * ⚠⚠⚠ MIXED DEPTH. The drill-down matches whole "|" segments, so a root
   * keyed `HARBOR` returns the bare row AND every `HARBOR|fund|acct` row.
   * LA City really has this: two FY2024 rows key as bare `HARBOR`.
   */
  it('REFUSES a root key that is a segment-prefix of another', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'HARBOR', amount: 10 }, { link_key: 'HARBOR|GENERAL FUND|SALARIES', amount: 5 }],
      byKey({ HARBOR: 'Harbor', 'HARBOR|GENERAL FUND|SALARIES': 'Harbor salaries' }),
    )).toThrow(/segment-prefix/);
  });

  /**
   * ⚠⚠ The counter-case, and the one that matters: #351 shipped a PLAIN
   * string-prefix test, which would have refused this. Both are real LA City
   * departments and the server cannot confuse them — measured against the live
   * API, `RECREATION AND PARKS` returns 53,392 rows and does NOT include
   * `RECREATION AND PARKS - SPECIAL ACCOUNTS`.
   */
  it('ALLOWS sibling keys where one is a plain string prefix of the other', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'RECREATION AND PARKS', amount: 10 },
       { link_key: 'RECREATION AND PARKS - SPECIAL ACCOUNTS', amount: 5 },
       { link_key: 'NON-DEPARTMENTAL - GENERAL', amount: 3 },
       { link_key: 'NON-DEPARTMENTAL - GENERAL CITY PURPOSES', amount: 2 }],
      byKey({
        'RECREATION AND PARKS': 'Recreation and Parks',
        'RECREATION AND PARKS - SPECIAL ACCOUNTS': 'Recreation and Parks - Special Accounts',
        'NON-DEPARTMENTAL - GENERAL': 'Non-Departmental - General',
        'NON-DEPARTMENTAL - GENERAL CITY PURPOSES': 'Non-Departmental - General City Purposes',
      }),
    );
    expect(roots).toHaveLength(4);
  });

  it('allows keys that merely share a word', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'Other Revenues', amount: 10 }, { link_key: 'Other Operating Costs', amount: 5 }],
      byKey({ 'Other Revenues': 'Other Revenues', 'Other Operating Costs': 'Other Operating Costs' }),
    );
    expect(roots).toHaveLength(2);
  });

  // ── a row may already be a GROUP ───────────────────────────────────────────

  it('accepts a pre-summed group via item_count', () => {
    const { roots, total } = rollUpTransactions(
      [{ link_key: 'a', amount: 1000, item_count: 250 }],
      byKey({ a: 'Alpha' }),
    );
    expect(total).toBe(1000);
    expect(roots[0]).toMatchObject({ amount: 1000, item_count: 250 });
  });

  it('mixes pre-summed groups with individual rows', () => {
    const { roots } = rollUpTransactions(
      [{ link_key: 'a', amount: 1000, item_count: 250 }, { link_key: 'a', amount: 5 }],
      byKey({ a: 'Alpha' }),
    );
    expect(roots[0]).toMatchObject({ amount: 1005, item_count: 251 });
  });

  // ── keyOf: rolling up coarser than the key ────────────────────────────────

  it('rolls up on a derived key when keyOf is given', () => {
    const dept = (t) => String(t.link_key).split('|')[0];
    const { roots, total } = rollUpTransactions(
      [{ link_key: 'HARBOR|A|X', amount: 10, item_count: 3 },
       { link_key: 'HARBOR|B|Y', amount: 5, item_count: 2 },
       { link_key: 'PENSION|C|Z', amount: 1, item_count: 1 }],
      byKey({ HARBOR: 'Harbor', PENSION: 'Pension' }),
      { keyOf: dept },
    );
    expect(total).toBe(16);
    expect(roots).toHaveLength(2);
    expect(roots[0]).toMatchObject({ link_key: 'HARBOR', name: 'Harbor', amount: 15, item_count: 5 });
  });

  /**
   * ⚠ The bare-`HARBOR` rows fold into their own department rather than
   * colliding with it — which is exactly why LA rolls up to the department.
   */
  it('folds a bare-department row into its department root', () => {
    const dept = (t) => String(t.link_key).split('|')[0];
    const { roots } = rollUpTransactions(
      [{ link_key: 'HARBOR|A|X', amount: 10, item_count: 3 }, { link_key: 'HARBOR', amount: 0 }],
      byKey({ HARBOR: 'Harbor' }),
      { keyOf: dept },
    );
    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({ amount: 10, item_count: 4 });
  });

  it('REFUSES a keyOf that drops a key', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a|b', amount: 1 }], byKey({}), { keyOf: () => null },
    )).toThrow(/keyOf\(\) returned nothing/);
  });

  // ⚠ An unkeyed row stays unkeyed: a derivation must not invent a key.
  it('does not let keyOf rescue an unkeyed row', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: null, amount: 500 }],
      byKey({ a: 'A' }), { keyOf: () => 'INVENTED' },
    )).toThrow(/have NO link_key/);
  });

  // ⛔ A duplicate label is the original McKinney symptom.
  it('refuses duplicate root labels', () => {
    expect(() => rollUpTransactions(
      [{ link_key: 'a', amount: 1 }, { link_key: 'b', amount: 2 }],
      byKey({ a: 'Same', b: 'Same' }),
    )).toThrow(/duplicate root label/);
  });

  it('says not to append the key to separate duplicates', () => {
    let msg = '';
    try {
      rollUpTransactions([{ link_key: 'a', amount: 1 }, { link_key: 'b', amount: 2 }], byKey({ a: 'S', b: 'S' }));
    } catch (e) { msg = e.message; }
    expect(msg).toMatch(/would make an unsourced name look sourced/);
  });

  it('rounds the total to cents once, not per row', () => {
    const txns = Array.from({ length: 3 }, () => ({ link_key: 'a', amount: 0.1 }));
    const { total, roots } = rollUpTransactions(txns, byKey({ a: 'A' }));
    expect(total).toBe(0.3);
    expect(roots[0].amount).toBe(0.3);
  });
});

describe('diffTree', () => {
  const roots = [
    { link_key: 'a', name: 'Alpha', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 1 },
    { link_key: 'b', name: 'Beta', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 2 },
  ];

  it('inserts a key that has no category', () => {
    const d = diffTree([{ id: '1', link_key: 'a', name: 'Alpha', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 1 }], roots);
    expect(d.inserts.map((i) => i.link_key)).toEqual(['b']);
    expect(d.updates).toHaveLength(0);
  });

  it('deletes a category whose key no longer appears', () => {
    const existing = [...roots.map((r, i) => ({ id: String(i), ...r })),
      { id: 'x', link_key: 'gone', name: 'Gone', amount: 1, actual_amount: 1, percentage: 0, item_count: 1, sort_order: 3 }];
    const d = diffTree(existing, roots);
    expect(d.deletes.map((x) => x.link_key)).toEqual(['gone']);
  });

  it('updates a renamed category and keeps its id', () => {
    const existing = [{ id: 'keep', link_key: 'a', name: 'Risk Management', amount: 10, percentage: 50, item_count: 1, sort_order: 1 },
      { id: '1', ...roots[1] }];
    const d = diffTree(existing, roots);
    expect(d.updates).toHaveLength(1);
    expect(d.updates[0].id).toBe('keep');
    expect(d.updates[0].after.name).toBe('Alpha');
  });

  it('is a no-op when nothing changed', () => {
    const existing = roots.map((r, i) => ({ id: String(i), ...r }));
    const d = diffTree(existing, roots);
    expect(d).toMatchObject({ inserts: [], updates: [], deletes: [] });
  });

  // ⚠⚠ Enrichment is paid for and slow to regenerate; a rebuild must not drop it.
  it('does not touch description or why_matters', () => {
    const existing = [{ id: 'k', link_key: 'a', name: 'Alpha', amount: 10, actual_amount: 10, percentage: 50, item_count: 1, sort_order: 1,
                        description: 'written by enrichment', why_matters: 'also enrichment' },
                      { id: '1', ...roots[1] }];
    const d = diffTree(existing, roots);
    expect(d.updates).toHaveLength(0);
    expect(d.deletes).toHaveLength(0);
  });
});

describe('transactionTreeSources — enrolment is opt-in', () => {
  it('enrols the McKinney check registers', () => {
    expect(isEnrolled('McKinney Check Register FY2024')).toBe(true);
  });

  /**
   * ⚠ Frisco was on this list and has been DELIBERATELY moved off it. Its
   * naming rule is now checked: the label is the publisher's own vendor_name,
   * carried through unchanged, and the key rule was recovered by measurement
   * against the five years no reload had touched (10,892 keys, 0 differences).
   * Leaving it unenrolled was what let its trees keep a $2.52B phantom root
   * after #336 corrected the headlines above them.
   */
  it('enrols the Frisco check registers, whose labels are the publisher’s own', () => {
    expect(isEnrolled('Frisco Check Register FY2026')).toBe(true);
  });

  /**
   * ⚠ West Hollywood has moved OFF this list for the same reason Frisco did:
   * its labels are the publisher's own `category` cells, carried through
   * unchanged, and every one of its eight years was checked against the city's
   * own group-by before enrolling. Plano stays off — the publisher truncates
   * its vendor names to five characters (#340).
   */
  it('does NOT enrol sources whose naming rule nobody has checked', () => {
    for (const s of ['Plano Check Register FY2025', 'McKinney Payroll Register FY2024']) {
      expect(isEnrolled(s), s).toBe(false);
      expect(resolverFor(s, 2024)).toBeNull();
    }
  });

  it('enrols all eight West Hollywood demand registers', () => {
    for (const s of ['FY2018-19', 'FY2019-20', 'FY2020-21', 'FY2021-22',
                     'FY2022-23', 'FY2022-24', 'FY2024-25', 'FY2025-26']) {
      expect(isEnrolled(`West Hollywood Demand Register ${s}`), s).toBe(true);
    }
  });

  // ⚠ The file titles are not the fiscal years — "FY2022-24" is TT's FY2024
  // budget — so the pattern must not assume a single four-digit year.
  it('does not enrol a West Hollywood source with a different shape', () => {
    expect(isEnrolled('West Hollywood Demand Register FY2024')).toBe(false);
    expect(isEnrolled('West Hollywood Budget Expenditure Detail')).toBe(false);
  });

  it('labels a West Hollywood root with the published category, unchanged', () => {
    const { resolveNames, source } = resolverFor('West Hollywood Demand Register FY2025-26', 2026);
    const out = resolveNames(['Contracted Services', 'Payroll Liabilities', 'Prepaids & Deposits']);
    expect(out.get('Contracted Services')).toBe('Contracted Services');
    expect(out.get('Payroll Liabilities')).toBe('Payroll Liabilities');
    // Ampersands and spacing survive exactly as the city wrote them.
    expect(out.get('Prepaids & Deposits')).toBe('Prepaids & Deposits');
    expect(source).toMatch(/category column of West Hollywood's published demand register/);
  });

  /**
   * ⚠⚠⚠ THE GUARD THAT STOPS AN INVENTED LABEL LOOKING SOURCED. `linkKey()`
   * joins its parts with "|" and today only one part survives. Map a
   * fund_column on one of these sources and every key becomes
   * "General Fund|Contracted Services" — which an identity rule would print to
   * a reader as the name of a category.
   */
  it('REFUSES a composite West Hollywood key rather than printing it as a name', () => {
    const { resolveNames } = resolverFor('West Hollywood Demand Register FY2025-26', 2026);
    expect(() => resolveNames(['General Fund|Contracted Services']))
      .toThrow(/composite/);
  });

  it('resolves McKinney codes to the publisher’s names', () => {
    const { resolveNames } = resolverFor('McKinney Check Register FY2024', 2024);
    const out = resolveNames(['2119', '4306', '9999']);
    expect(out.get('2119')).toBe('Internal Services - Information Technology');
    expect(out.get('4306')).toBe('Parks & Recreation - Parks Maintenance');
    expect(out.get('9999')).toBe('Non-Departmental');
  });

  it('keeps the publisher identifier for a code McKinney never names', () => {
    const { resolveNames } = resolverFor('McKinney Check Register FY2024', 2024);
    expect(resolveNames(['7777']).get('7777')).toBe('Department 7777');
    expect(resolveNames(['0']).get('0')).toBe('Department 0');
  });

  // ⚠ The alias exists so a rebuild run before the key backfill still names the
  // root correctly rather than refusing — the backfill is the real fix.
  it('maps the legacy `unknown` key to department 0', () => {
    const { resolveNames } = resolverFor('McKinney Check Register FY2024', 2024);
    expect(resolveNames(['unknown']).get('unknown')).toBe('Department 0');
  });

  it('enrols the LA City Checkbook', () => {
    expect(isEnrolled('LA City Checkbook')).toBe(true);
    expect(isEnrolled('LA City Payroll')).toBe(false);
    expect(isEnrolled('LA City Revenue')).toBe(false);
  });

  /**
   * ⚠⚠ LA is the only source whose ROOTS are coarser than its keys: the loader
   * writes `DEPARTMENT|FUND|ACCOUNT` (3,619 distinct) and the breakdown is the
   * 56 departments. The derived key must be a whole `|` segment, because that
   * is what the drill-down can match.
   */
  it('rolls LA up to the department, and labels it as the city publishes it', () => {
    const r = resolverFor('LA City Checkbook', 2025);
    expect(r.keyOf({ link_key: 'WATER AND POWER|POWER REVENUE FUND|POWER REVENUE FUND' }))
      .toBe('WATER AND POWER');
    // ⚠ Two FY2024 rows key as a bare department, with no fund or account.
    expect(r.keyOf({ link_key: 'HARBOR' })).toBe('HARBOR');
    // SCREAMING CAPS is the publisher's own, and so is the inconsistency
    // between NON_DEPARTMENTAL and NON-DEPARTMENTAL - LEASING.
    expect(r.resolveNames(['WATER AND POWER', 'NON_DEPARTMENTAL']).get('WATER AND POWER'))
      .toBe('WATER AND POWER');
    expect(r.source).toMatch(/department_name column of the LA City Checkbook/);
  });

  it('gives every other source no keyOf, so a root stays one link_key', () => {
    for (const s of ['McKinney Check Register FY2024', 'Frisco Check Register FY2024',
                     'West Hollywood Demand Register FY2025-26']) {
      expect(resolverFor(s, 2024).keyOf, s).toBeNull();
    }
  });

  it('cites the published source', () => {
    expect(resolverFor('McKinney Check Register FY2022', 2022).source).toMatch(/Adopted Budget Worksheets/);
  });
});

// ── Idempotence: the property that makes drift detectable ────────────────────
//
// ⚠⚠ If a rebuild rewrote rows even when nothing changed, "the tree disagrees
// with its transactions" would be indistinguishable from "the rebuild ran", and
// the gate would be noise. A no-change rebuild must be a no-op.
describe('a rebuild is a no-op when nothing changed', () => {
  const txns = [
    { link_key: '2119', amount: 100 }, { link_key: '2119', amount: 50 },
    { link_key: '4306', amount: 25 },  { link_key: '0', amount: 1000 },
  ];
  const resolve = resolverFor('McKinney Check Register FY2024', 2024).resolveNames;

  it('produces the same roots twice', () => {
    const a = rollUpTransactions(txns, resolve);
    const b = rollUpTransactions(txns, resolve);
    expect(b).toEqual(a);
  });

  it('diffs to nothing against its own output', () => {
    const { roots } = rollUpTransactions(txns, resolve);
    const stored = roots.map((r, i) => ({ id: `id-${i}`, ...r }));
    expect(diffTree(stored, roots)).toMatchObject({ inserts: [], updates: [], deletes: [] });
  });

  it('is insensitive to the order transactions arrive in', () => {
    const a = rollUpTransactions(txns, resolve);
    const b = rollUpTransactions([...txns].reverse(), resolve);
    expect(b.roots).toEqual(a.roots);
  });
});

/**
 * ── THE TAIL BUCKET ───────────────────────────────────────────────────────
 *
 * ⚠⚠ Added for Frisco, whose roots are VENDORS: ~2,400 distinct payees a year,
 * which no reader can use as a breakdown. Every stored Frisco year keeps the
 * 30 largest and gathers the rest into "Other Vendors".
 *
 * The sort test below is the one that matters. Sorting the bucket by amount
 * like any other root put it FIRST (it outweighs every named vendor) and
 * pushed all 30 down one place — so a rebuild of an already-correct year
 * rewrote all 31 rows, and "a diff means real drift" stopped being true.
 */
describe('rollUpTransactions — the tail bucket', () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({
    link_key: `v${String(i).padStart(3, '0')}`, amount: (n - i) * 100,
  }));
  const names = (keys) => new Map(keys.map((k) => [k, k.toUpperCase()]));
  const OPTS = { keepTop: 3, tailKey: 'other-vendors', tailName: 'Other Vendors' };

  it('keeps one root per key when no keepTop is given', () => {
    const { roots } = rollUpTransactions(many(10), names);
    expect(roots).toHaveLength(10);
    expect(roots.map((r) => r.link_key)).not.toContain('other-vendors');
  });

  it('keeps the largest keepTop and buckets the rest', () => {
    const { roots } = rollUpTransactions(many(10), names, OPTS);
    expect(roots).toHaveLength(4);
    expect(roots.map((r) => r.link_key)).toEqual(['v000', 'v001', 'v002', 'other-vendors']);
  });

  it('puts the bucket LAST even though it is the largest root', () => {
    const { roots } = rollUpTransactions(many(10), names, OPTS);
    const tail = roots.find((r) => r.link_key === 'other-vendors');
    expect(tail.sort_order).toBe(4);
    expect(tail.amount).toBeGreaterThan(roots[0].amount); // bigger, still last
  });

  it('preserves the total exactly — the bucket loses no money', () => {
    const rows = many(10);
    const expected = rows.reduce((a, r) => a + r.amount, 0);
    const { roots, total } = rollUpTransactions(rows, names, OPTS);
    expect(total).toBe(expected);
    expect(roots.reduce((a, r) => a + r.amount, 0)).toBe(expected);
  });

  it('sums the bucket’s item_count over every row it swallowed', () => {
    const { roots } = rollUpTransactions(many(10), names, OPTS);
    expect(roots.find((r) => r.link_key === 'other-vendors').item_count).toBe(7);
  });

  it('does not bucket when there are no more keys than keepTop', () => {
    const { roots } = rollUpTransactions(many(3), names, OPTS);
    expect(roots).toHaveLength(3);
    expect(roots.map((r) => r.link_key)).not.toContain('other-vendors');
  });

  it('never asks the resolver to name the bucket', () => {
    const seen = [];
    rollUpTransactions(many(10), (keys) => { seen.push(...keys); return names(keys); }, OPTS);
    expect(seen).not.toContain('other-vendors');
  });

  it('refuses a keepTop with no name for the bucket', () => {
    expect(() => rollUpTransactions(many(10), names, { keepTop: 3 }))
      .toThrow(/invented label/);
  });

  /**
   * ⚠ Only a collider large enough to SURVIVE into the kept roots is a
   * collision. One small enough to fall into the tail is simply absorbed by
   * it, which is the right answer and must not throw — so both halves are
   * asserted here.
   */
  it('refuses when a surviving vendor already keys as the bucket', () => {
    const rows = [...many(10), { link_key: 'other-vendors', amount: 999999 }];
    expect(() => rollUpTransactions(rows, names, OPTS)).toThrow(/collide/);
  });

  it('absorbs a same-keyed vendor that falls into the tail anyway', () => {
    const rows = [...many(10), { link_key: 'other-vendors', amount: 1 }];
    const { roots, total } = rollUpTransactions(rows, names, OPTS);
    expect(roots).toHaveLength(4);
    expect(total).toBe(rows.reduce((a, r) => a + r.amount, 0));
  });

  it('is still insensitive to the order rows arrive in', () => {
    const rows = many(10);
    const a = rollUpTransactions(rows, names, OPTS);
    const b = rollUpTransactions([...rows].reverse(), names, OPTS);
    expect(b.roots).toEqual(a.roots);
  });
});

describe('Frisco is enrolled, and names nothing it was not given', () => {
  it('is enrolled with the measured 30 + Other Vendors shape', () => {
    const r = resolverFor('Frisco Check Register FY2019', 2019);
    expect(r).toBeTruthy();
    expect(r.keepTop).toBe(30);
    expect(r.tailKey).toBe('other-vendors');
    expect(r.tailName).toBe('Other Vendors');
  });

  it('labels a root with the publisher’s own vendor name', () => {
    const r = resolverFor('Frisco Check Register FY2019', 2019);
    const vendorNameByKey = new Map([['north-texas-municipal-water-district', 'NORTH TEXAS MUNICIPAL WATER DISTRICT']]);
    const out = r.resolveNames(['north-texas-municipal-water-district'], { vendorNameByKey });
    expect(out.get('north-texas-municipal-water-district')).toBe('NORTH TEXAS MUNICIPAL WATER DISTRICT');
  });

  /**
   * ⚠⚠ A key with no vendor behind it means the read came back short. The
   * resolver returns nothing and rollUpTransactions refuses — it must NOT
   * invent "Unknown", which is the exact label that put $79.1M of McKinney
   * money under a root that led nowhere.
   */
  it('returns NOTHING for a key it has no name for', () => {
    const r = resolverFor('Frisco Check Register FY2019', 2019);
    const out = r.resolveNames(['missing-vendor'], { vendorNameByKey: new Map() });
    expect(out.get('missing-vendor')).toBeUndefined();
    expect(() => rollUpTransactions(
      [{ link_key: 'missing-vendor', amount: 1 }],
      (keys) => r.resolveNames(keys, { vendorNameByKey: new Map() }),
    )).toThrow(/resolver returned nothing/);
  });

  /** ⚠ Plano's payee is truncated to 5 characters — #340 removed that axis. */
  it('does NOT enrol Plano', () => {
    expect(isEnrolled('Plano Check Register FY2023')).toBe(false);
    expect(resolverFor('Plano Check Register FY2023', 2023)).toBeNull();
  });

  it('leaves McKinney with no bucket, one root per department', () => {
    const r = resolverFor('McKinney Check Register FY2024', 2024);
    expect(r.keepTop).toBeNull();
  });
});
