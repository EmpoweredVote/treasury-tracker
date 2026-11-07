/**
 * ⚠⚠⚠ A `"` IS A DELIMITER ONLY AT A FIELD'S START.
 *
 * `splitCSVLine` used to flip quote mode on any `"` anywhere in the line. Plano's
 * check register writes inch marks in unquoted descriptions, so one `6"` opened
 * a field that never closed and swallowed the fund, the payee and the AMOUNT.
 * Those rows were stored at $0.00.
 *
 * Measured on Plano FY2024: 455 lines carry an unbalanced inch mark, and the
 * publisher's own file totals $462,672,864.36 over 29,557 rows against TT's
 * $461,886,142.73 over 28,863 — 694 rows and $786,721.63 lost to a parser.
 */
import { describe, it, expect } from 'vitest';
import { splitCSVLine, repairFixedWidthRow, parseCSV } from '../scripts/lib/xlsxRows.mjs';

describe('splitCSVLine', () => {
  it('splits a plain line', () => {
    expect(splitCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a comma inside a properly quoted field', () => {
    // Plano really does quote these — all 7,036 of them.
    expect(splitCSVLine('x,"CAREY, JAMES",y')).toEqual(['x', 'CAREY, JAMES', 'y']);
  });

  it('unescapes a doubled quote inside a quoted field', () => {
    expect(splitCSVLine('"he said ""hi""",b')).toEqual(['he said "hi"', 'b']);
  });

  // ⭐⭐ THE REGRESSION. One inch mark used to eat the rest of the line.
  it('treats an inch mark inside an unquoted field as a literal', () => {
    const line = 'A,GLAND FIELD LOK D.I. 6"       ,1826350,PV,Municipal Warehouse,NORTH,910.8000';
    const f = splitCSVLine(line);
    expect(f).toHaveLength(7);
    expect(f[1]).toBe('GLAND FIELD LOK D.I. 6"       ');
    // The fund, payee and amount must survive — they are what went missing.
    expect(f[4]).toBe('Municipal Warehouse');
    expect(f[6]).toBe('910.8000');
  });

  it('handles two inch marks in one unquoted field', () => {
    expect(splitCSVLine('ANGLE STOP 1" SWIVEL X 2" COMP,b')).toEqual(['ANGLE STOP 1" SWIVEL X 2" COMP', 'b']);
  });

  it('handles an inch mark in a field that IS quoted', () => {
    expect(splitCSVLine('"PIPE 6", 1826350')).toEqual(['PIPE 6', ' 1826350']);
    expect(splitCSVLine('"PIPE, 6"" LONG",x')).toEqual(['PIPE, 6" LONG', 'x']);
  });

  it('keeps an empty trailing field', () => {
    expect(splitCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });

  it('keeps empty fields in the middle', () => {
    expect(splitCSVLine('a,,b')).toEqual(['a', '', 'b']);
  });

  /**
   * ⚠ The property that matters for a fixed-column export: a line must yield
   * the same number of fields whether or not its text contains inch marks.
   */
  it('gives a 10-column Plano line 10 fields, inch mark or not', () => {
    const withInch = '9/27/2024,Inventories,2859211,MUNICIPALWAREHOUSE,GLAND FIELD LOK D.I. 6"       ,1826350,PV,Municipal Warehouse,NORTH,910.8000';
    const without = '9/27/2024,Inventories,2859211,MUNICIPALWAREHOUSE,GLAND FIELD LOK D.I. 6        ,1826350,PV,Municipal Warehouse,NORTH,910.8000';
    expect(splitCSVLine(withInch)).toHaveLength(10);
    expect(splitCSVLine(without)).toHaveLength(10);
    expect(splitCSVLine(withInch).at(-1)).toBe('910.8000');
  });
});

/**
 * ⚠⚠ Some of Plano's fields are malformed CSV that NO parser can read on its
 * own, because the quoting is genuinely ambiguous. What rescues them is that
 * the file has a known width: any surplus commas must live inside one field,
 * and that field is the one which opens with a quote.
 */
describe('repairFixedWidthRow', () => {
  it('returns the naive split when the arithmetic already works', () => {
    // `"L" Reference Scale Reversible` — decorative quotes, no inner comma.
    const line = 'a,b,"L" Reference Scale Reversible,d';
    expect(repairFixedWidthRow(line, 4)).toEqual(['a', 'b', '"L" Reference Scale Reversible', 'd']);
  });

  it('absorbs ONE surplus comma into the quote-opened field', () => {
    const line = 'a,"Platform-14x24", Approach Step",d';
    expect(repairFixedWidthRow(line, 3)).toEqual(['a', '"Platform-14x24", Approach Step"', 'd']);
  });

  it('absorbs TWO surplus commas into the quote-opened field', () => {
    const line = 'a,"Slide Entry, 30", Tube Slide  ",d';
    expect(repairFixedWidthRow(line, 3)).toEqual(['a', '"Slide Entry, 30", Tube Slide  "', 'd']);
  });

  // ⚠ Refuses rather than guesses — a guessed row is a different row.
  it('returns null when nothing opens with a quote', () => {
    expect(repairFixedWidthRow('a,b,c,d', 3)).toBeNull();
  });

  it('returns null when the line is too SHORT to reconcile', () => {
    expect(repairFixedWidthRow('a,b', 5)).toBeNull();
  });
});

describe('parseCSV reports what it had to repair', () => {
  const file = (text) => Buffer.from(text, 'utf8');

  it('counts nothing when every line is clean', () => {
    const r = parseCSV(file('a,b\n1,2\n3,4'));
    expect(r.repaired).toBe(0);
    expect(r.unreadable).toBe(0);
    expect(r.rows).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });

  it('repairs an ambiguous quoted field and says so', () => {
    const r = parseCSV(file('desc,amount\n"Platform-14x24", Approach Step",276.73'));
    expect(r.repaired).toBe(1);
    expect(r.unreadable).toBe(0);
    // ⭐ The AMOUNT is what used to be lost — it must land in `amount`.
    expect(r.rows[0].amount).toBe('276.73');
    expect(r.rows[0].desc).toBe('Platform-14x24", Approach Step');
  });

  it('reads an inch mark in an unquoted field without repair', () => {
    const r = parseCSV(file('desc,amount\nGLAND FIELD LOK D.I. 6",910.80'));
    expect(r.repaired).toBe(0);
    expect(r.rows[0]).toEqual({ desc: 'GLAND FIELD LOK D.I. 6"', amount: '910.80' });
  });
});
