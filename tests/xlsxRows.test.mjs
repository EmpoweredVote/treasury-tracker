/**
 * The parse-and-key path that decides whether a published figure matches its
 * source.
 *
 * ⚠⚠ These functions were moved out of scripts/bulkLoadXLSX.js UNCHANGED so a
 * measurement could import the loader's own code. That move is only safe if the
 * behaviour is pinned, because `hashRow` becomes `transactions.source_row_id`
 * and `treasury_sync_transactions` does ON CONFLICT DO NOTHING on it — a change
 * to the hash silently changes which rows exist.
 */
import { describe, it, expect } from 'vitest';
import { hashRow, parseAmount, parseCSV, splitCSVLine, rowKeys } from '../scripts/lib/xlsxRows.mjs';

describe('hashRow — the dedup key', () => {
  it('is stable for the same row', () => {
    const r = { a: 1, b: 'x' };
    expect(hashRow(r)).toBe(hashRow({ a: 1, b: 'x' }));
  });

  it('does not depend on key order', () => {
    // The sort in hashRow exists for this; without it a parser change that
    // reordered headers would re-key every row in the fleet.
    expect(hashRow({ a: 1, b: 2 })).toBe(hashRow({ b: 2, a: 1 }));
  });

  it('distinguishes rows that differ anywhere', () => {
    expect(hashRow({ a: 1 })).not.toBe(hashRow({ a: 2 }));
    expect(hashRow({ a: 1 })).not.toBe(hashRow({ a: '1' }));
  });

  it('normalises Date to ISO so a re-parse keys the same', () => {
    const d = new Date('2024-03-25T00:00:00Z');
    expect(hashRow({ when: d })).toBe(hashRow({ when: new Date(d.getTime()) }));
  });

  // ⚠⚠⚠ THE DEFECT THIS KEY HAS. Two rows whose every published column matches
  // are ONE row in the database — and for a publisher that prints no
  // identifier, six people each posting an identical $529 court bond produce
  // six byte-identical rows. The hash cannot tell them apart; nothing can,
  // from content alone. Pinned so the limitation is visible in the test suite
  // rather than only in a migration comment.
  it('CANNOT distinguish genuinely distinct rows with identical content', () => {
    const bond = { check_date: '2024-04-04', vendor_name: 'ONE TIME PAY - COURT', amount: 529 };
    expect(hashRow(bond)).toBe(hashRow({ ...bond }));
  });
});

describe('parseAmount', () => {
  it('passes numbers through', () => {
    expect(parseAmount(1234.5)).toBe(1234.5);
  });
  it('strips currency and separators', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5);
  });
  it('reads parenthetical negatives', () => {
    expect(parseAmount('(123.45)')).toBe(-123.45);
  });
  it('treats empty and null as zero', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount(null)).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });
  it('does not return NaN for junk', () => {
    expect(parseAmount('n/a')).toBe(0);
  });
});

describe('splitCSVLine', () => {
  it('splits on commas', () => {
    expect(splitCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });
  it('respects quotes', () => {
    expect(splitCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });
  it('unescapes doubled quotes', () => {
    expect(splitCSVLine('a,"say ""hi""",c')).toEqual(['a', 'say "hi"', 'c']);
  });
  it('keeps trailing empty fields', () => {
    expect(splitCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });
});

describe('parseCSV', () => {
  const csv = Buffer.from(
    'Check Date,Payee Name,Amount\n' +
    '2024-04-04,ONE TIME PAY - COURT,529\n' +
    '\n' +                                   // blank line
    '2024-04-04,ONE TIME PAY - COURT,529\n',  // byte-identical to row 1
  );

  it('normalises headers to snake_case', () => {
    expect(parseCSV(csv).headers).toEqual(['check_date', 'payee_name', 'amount']);
  });

  it('skips blank lines and counts them', () => {
    const { rows, blankSkipped } = parseCSV(csv);
    expect(rows).toHaveLength(2);
    // ⚠ TWO, not one: the interior blank line plus the empty string after the
    // file's trailing newline. Worth pinning — blankSkipped is printed in the
    // loader's summary line, so a reader comparing it to the file's visible
    // blank rows will always see one more.
    expect(blankSkipped).toBe(2);
  });

  it('turns empty fields into null', () => {
    const { rows } = parseCSV(Buffer.from('a,b\n1,\n'));
    expect(rows[0]).toEqual({ a: '1', b: null });
  });

  // The measurement in scripts/measureXlsxDedupLoss.mjs counts exactly this.
  it('yields two rows that collapse to one dedup key', () => {
    const { rows } = parseCSV(csv);
    expect(new Set(rows.map(hashRow)).size).toBe(1);
  });
});

describe('rowKeys — the opt-in dedup policy', () => {
  const bond = { check_date: '2024-04-04', payee: 'ONE TIME PAY - COURT', amount: 529 };
  const other = { check_date: '2024-04-05', payee: 'ATMOS', amount: 76.65 };
  const rows = [bond, other, { ...bond }, { ...bond }];

  it('defaults to content hashing — unchanged behaviour', () => {
    const keys = rowKeys(rows);
    expect(keys).toEqual(rows.map(hashRow));
    expect(new Set(keys).size).toBe(2);        // the three bonds collapse to one
  });

  it('is content hashing for any unknown policy name', () => {
    expect(rowKeys(rows, 'something-else')).toEqual(rowKeys(rows));
  });

  // ⚠⚠⚠ The repair. Four police Tahoes on one PO are four rows, not one.
  it('keeps every copy under the occurrence policy', () => {
    const keys = rowKeys(rows, 'occurrence');
    expect(new Set(keys).size).toBe(4);
  });

  // ⚠ This is what makes turning the policy on safe without a force-reload.
  it('leaves the FIRST of a group keyed exactly as content hashing does', () => {
    const keys = rowKeys(rows, 'occurrence');
    expect(keys[0]).toBe(hashRow(bond));
    expect(keys[1]).toBe(hashRow(other));
    expect(keys[2]).toBe(`${hashRow(bond)}#1`);
    expect(keys[3]).toBe(`${hashRow(bond)}#2`);
  });

  it('numbers each identical group independently', () => {
    const a = { x: 1 }; const b = { x: 2 };
    expect(rowKeys([a, b, { ...a }, { ...b }], 'occurrence'))
      .toEqual([hashRow(a), hashRow(b), `${hashRow(a)}#1`, `${hashRow(b)}#1`]);
  });

  it('returns one key per row, in order', () => {
    expect(rowKeys(rows, 'occurrence')).toHaveLength(rows.length);
    expect(rowKeys([], 'occurrence')).toEqual([]);
  });

  // ⚠⚠ The loader sends 500 rows at a time; computing this per chunk would put
  // two identical rows in different chunks back on the same key.
  it('is stable however the file is later sliced', () => {
    const whole = rowKeys(rows, 'occurrence');
    const halves = [...rowKeys(rows.slice(0, 2), 'occurrence'), ...rowKeys(rows.slice(2), 'occurrence')];
    expect(halves).not.toEqual(whole);   // proving the per-chunk mistake IS a mistake
    expect(new Set(halves).size).toBe(3);
    expect(new Set(whole).size).toBe(4);
  });
});
