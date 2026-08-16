/**
 * Unit tests for the two column readings inside scripts/verify-wa-rederive.mjs.
 *
 * Every fixture here is TRANSCRIBED FROM A REAL PAGE, with the file and page
 * recorded beside it. That matters more than usual: each of these cases is a
 * shape that once made a reader return a confident wrong answer or silently
 * drop a row, and a synthetic approximation would not have reproduced any of
 * them. The column offsets are the offsets pdftotext actually emits.
 *
 * The harness itself is the integration test — it re-derives 110 rows against
 * production. These exist because that run needs the source PDFs, credentials
 * and several minutes, so a regression in a reader would otherwise only ever
 * surface as a mysterious blocker on one city.
 */
import { describe, it, expect } from 'vitest';
import {
  lpSplit, lpModalGlyphGap, assertLinePrinterCalibration, LP_MAX_CHAR_GAP,
  readRowOrdinal, makeRowReader, buildRevenue, buildOperating, pageExactChunks,
  assertPageYear,
} from '../scripts/verify-wa-rederive.mjs';

describe('page identity: the period sentence survives a mis-mapped glyph', () => {
  it('reads a normally rendered period sentence', () => {
    expect(assertPageYear('For the Fiscal Year Ended December 31, 2024', 2024, 'fixture'))
      .toMatch(/2024/);
  });

  it('reads one whose "Year" lost its Y to a bad glyph map', () => {
    // Spokane FY2018 and FY2022 render it "For the Fiscal <ear Ended December
    // 31, 2018". The YEAR itself is intact and unambiguous; only one letter of
    // the scaffolding word is corrupt. Refusing the page over that would drop
    // two otherwise perfect years, the same call as Tacoma's "Govermental
    // Funds".
    expect(assertPageYear('For the Fiscal <ear Ended December 31, 2018', 2018, 'fixture'))
      .toMatch(/2018/);
  });

  it('still refuses a page whose stated year is not the one being read', () => {
    expect(() => assertPageYear('For the Fiscal <ear Ended December 31, 2017', 2018, 'fixture'))
      .toThrow(/2017/);
  });

  it('still refuses a page that states no period at all', () => {
    expect(() => assertPageYear('Schedule of Investments', 2018, 'fixture'))
      .toThrow(/no evidence/i);
  });
});

describe('a form feed in -table output is not always a page break', () => {
  // Spokane FY2019 splits a 176-page PDF into 455 form-feed chunks: poppler
  // emits at least one per page and sometimes extra ones WITHIN a page. Its
  // governmental-funds statement is chunk 63 but PDF page 37, and that index is
  // handed to `pdftotext -lineprinter -f N`, which would have read an unrelated
  // investment-policy table in the notes.
  it('accepts the cheap split when the chunk count matches the page count', () => {
    expect(pageExactChunks('a\fb\fc', 3)).toEqual(['a', 'b', 'c']);
  });

  it('drops the empty chunk the final page\'s own form feed leaves behind', () => {
    expect(pageExactChunks('a\fb\fc\f', 3)).toEqual(['a', 'b', 'c']);
  });

  it('refuses the split when a page emitted an extra form feed', () => {
    // Extra feeds can only ever ADD chunks, which is what makes the
    // discrepancy self-detecting rather than silent.
    expect(pageExactChunks('a\fb1\fb2\fc\f', 3)).toBeNull();
  });

  it('refuses the split when chunks are MISSING too, rather than padding', () => {
    expect(pageExactChunks('a\fb\f', 3)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// READING 2 — `pdftotext -lineprinter`
// ═══════════════════════════════════════════════════════════════════════════
describe('lineprinter: a $ belonging to the NEXT column must not weld onto this one', () => {
  // Tacoma FY2010 p.29, the "Taxes" row, at the offsets pdftotext emits:
  //   "Taxes" at 60..70, "$" at 164, "169,326" at 190..204, "$" at 209,
  //   "18,578" at 244..255, "$" at 264, "187,904" at 294..307.
  // The second column's leading "$" sits FIVE columns past the last digit of
  // the General Fund figure -- inside LP_MAX_CHAR_GAP -- so proximity grouping
  // welded it on, "169,326$" stopped matching the money pattern, the row was
  // left with no cell in the General Fund band and was skipped entirely.
  // The row vanished from the geometric reading while the ordinal reading kept
  // it, which is how a $169m line item became a "row count" disagreement.
  const at = (pairs) => {
    let s = '';
    for (const [col, text] of pairs) { s = s.padEnd(col, ' ') + text; }
    return s;
  };
  const TAXES_ROW = at([[60, 'T a x e s'], [164, '$'], [190, '1 6 9 , 3 2 6'],
    [209, '$'], [244, '1 8 , 5 7 8'], [264, '$'], [294, '1 8 7 , 9 0 4']]);

  it('reads all three money cells off the row', () => {
    const { cells } = lpSplit(TAXES_ROW);
    expect(cells.map((c) => c.value)).toEqual([169326, 18578, 187904]);
  });

  it('leaves the label recognisable after the $ signs are set aside', () => {
    const { label } = lpSplit(TAXES_ROW);
    expect(label.toLowerCase().replace(/[^a-z0-9]/g, '')).toBe('taxes');
  });

  it('still reads a $ that legitimately LEADS its own amount', () => {
    // "$61,037" rendered tight, as the first row of a section usually is.
    const { cells } = lpSplit('   P r o p e r t y                $ 6 1 , 0 3 7');
    expect(cells.map((c) => c.value)).toEqual([61037]);
  });
});

describe('lineprinter: only a fragment in the page MARGIN is decoration', () => {
  const at = (pairs) => {
    let s = '';
    for (const [col, text] of pairs) { s = s.padEnd(col, ' ') + text; }
    return s;
  };

  it('strips the rotated SAO stamp and the margin rule a gutter away from the label', () => {
    // Bainbridge FY2013 p.32: one character of the rotated "Washington State
    // Auditor's Office" stamp plus the rendered rule, 72-85 columns clear of
    // the label they precede.
    expect(lpSplit(at([[18, 'W'], [31, '_'], [104, 'C a p i t a l O u t l a y']])).label)
      .toBe('CapitalOutlay');
  });

  it('strips a whole run whose members sit only a letter-advance apart', () => {
    // Bainbridge FY2007 p.24 is the tight case: the stamp character and the
    // rule are FIVE columns apart, and only the run as a whole clears the
    // gutter — 34 columns, on a page whose gutter is half FY2013's.
    expect(lpSplit(at([[15, 'W'], [21, '_'], [56, 'J u d i c i a l']])).label)
      .toBe('Judicial');
  });

  it('keeps a first letter that merely rendered as its own group', () => {
    // Tacoma FY2022 p.52: the capital M of "Miscellaneous" is wide enough that
    // its advance exceeds the word-grouping gap, so it splits off — five
    // columns clear, not a gutter. Stripping it shipped "iscellaneous" into the
    // label comparison while the figure stayed correct.
    expect(lpSplit(at([[39, 'M'], [45, 'i s c e l l a n e o u s']])).label)
      .toBe('Miscellaneous');
  });
});

describe('lineprinter: the character pitch is a per-document guess and must be pinned', () => {
  // `pdftotext -lineprinter` auto-detects a character pitch per document. Across
  // the 64 statement pages in this corpus it lands on ~1.55pt for 62 of them --
  // a modal glyph gap of 2 or 3 columns, which is what LP_MAX_CHAR_GAP = 5 was
  // calibrated against. On Tacoma FY2012 it picks a pitch SIX TIMES finer
  // (modal gap 17, page 2124 columns wide) and on FY2023 three times finer
  // (modal gap 8). At those pitches no word ever reassembles, so the reader
  // found no "Total revenues" row at all and both years failed outright.
  const explode = (text, step) => text.split('').map((c) => c + ' '.repeat(step - 1)).join('');

  it('measures the modal gap of a normally-pitched page', () => {
    expect(lpModalGlyphGap([explode('TotalRevenues', 3), explode('Property', 3)])).toBe(3);
  });

  it('accepts a page whose modal gap is inside the calibration', () => {
    expect(() => assertLinePrinterCalibration([explode('TotalRevenues', 3)], 'fixture')).not.toThrow();
  });

  it('refuses a page rendered at an anomalous pitch rather than silently misreading it', () => {
    const wide = [explode('TotalRevenues', 17), explode('Property', 17)];
    expect(lpModalGlyphGap(wide)).toBeGreaterThanOrEqual(LP_MAX_CHAR_GAP);
    expect(() => assertLinePrinterCalibration(wide, 'Tacoma FY2012 revenue'))
      .toThrow(/pitch|calibrat/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// READING 1 — `pdftotext -table`
// ═══════════════════════════════════════════════════════════════════════════
// Tacoma FY2019 p.40 revenue, transcribed at the emitted offsets. Four money
// columns: General Fund | Trans Capital & Engineering | Other Governmental |
// Total Governmental. The `Business` row prints NOTHING in the Trans Capital
// column -- not a dash, nothing -- so it carries three tokens where every other
// row carries four.
const FY2019 = {
  ncols: 4,
  total: 'Total Revenues                                       210,733              15,378      115,571       341,682',
  body: [
    'Taxes:',
    'Property                                          $  61,037      $              -  $  17,971     $  79,008',
    'Retail Sales & Use                                   58,312                     -     22,820        81,132',
    'Business                                             51,203                           2,360         53,563',
    'Excise                                               1,360                      -     13,960        15,320',
    'Licenses and Permits                                 7,271                      -     3,754         11,025',
    'Intergovernmental                                    13,682               14,751      27,539        55,972',
  ],
};

describe('table: a row with money but fewer cells than the Total row is NOT a header', () => {
  it('classifies the short Business row as incomplete, not as a heading', () => {
    const r = readRowOrdinal(FY2019.body[3], FY2019.ncols);
    expect(r.kind).toBe('incomplete');
  });

  it('still classifies a genuine valueless heading as a header', () => {
    expect(readRowOrdinal(FY2019.body[0], FY2019.ncols).kind).toBe('header');
  });

  it('still classifies a full row as an ordinal cell', () => {
    const r = readRowOrdinal(FY2019.body[1], FY2019.ncols);
    expect(r.kind).toBe('cell');
    expect(r.value).toBe(61037);
  });
});

describe('table: an incomplete row is resolved by bands validated on the same page', () => {
  it('recovers the General Fund figure the ordinal count could not reach', () => {
    // Silently dropping this row is what made the re-derived FY2019 revenue
    // total short by exactly 51,203 thousand -- and the shortfall then read as
    // a database defect rather than as a reader defect.
    const read = makeRowReader(FY2019.body, FY2019.total, FY2019.ncols, 'fixture');
    const r = read(FY2019.body[3]);
    expect(r.kind).toBe('cell');
    expect(r.value).toBe(51203);
    expect(r.label).toBe('Business');
  });

  it('reports a BLANK General Fund cell as blank, never as the next column over', () => {
    // Tacoma FY2023 p.48 operating: `Transportation` prints nothing in the
    // General Fund column, and 4,330 is the Trans Capital figure. Counting
    // cells back from the right end reads that 4,330 as General Fund and
    // inflates the total by exactly that much.
    const ncols = 4;
    const total = 'Total Expenditures                                   264,071              17,306      151,943       433,320';
    const body = [
      'General Government                                   29,310                           4,111         33,421',
      'Transportation                                                            4,330        38,605        42,935',
      'Interest and Other Costs                             226                   96          8,155         8,477',
      'Capital Outlay                                       2,522                12,880       3,507         18,909',
    ];
    const read = makeRowReader(body, total, ncols, 'fixture');
    expect(read(body[1]).kind).toBe('blank');
  });

  it('refuses to use bands whose reading contradicts the ordinal reading', () => {
    // The bands are only ever trusted after they reproduce the ordinal answer
    // on every COMPLETE row of the same section. Kitsap renders its General
    // Fund column in two disjoint zones under `-table`, so no band rule can
    // work there; if such a page ever also carried an incomplete row this must
    // fail loudly rather than invent a column.
    const ncols = 3;
    const total = 'Total Revenues       100        200        300';
    const body = [
      // 40 is nowhere near the Total row's first band; the ordinal reading says
      // it IS the General Fund cell. The two disagree, so the page is refused.
      'Scattered                            40        60         100',
      'Short                                              7        7',
    ];
    expect(() => makeRowReader(body, total, ncols, 'fixture'))
      .toThrow(/band|contradict|disagree/i);
  });
});

describe('table: a colon-terminated revenue heading opens a group', () => {
  // Tacoma FY2019-FY2024 print `Taxes:` as a parent over Property / Retail
  // Sales & Use / Business / Excise, and `-table` FLATTENS the indentation that
  // says so. Without a grouping rule the heading was carried forward as a label
  // fragment and welded onto the next row ("Taxes Property"), producing four
  // root-level tax leaves against the database's single `Taxes` parent. Every
  // figure was right; only the shape was wrong -- the class of defect a $0 tie
  // cannot see.
  //
  // The indentation comes from `pdftotext -layout`, which preserves it, and is
  // used for STRUCTURE ONLY. -layout's column pairing is not trusted for this
  // issuer: on Tacoma it emits labels and values on different output lines.
  const indents = new Map([
    ['taxes', 0], ['property', 2], ['retailsalesuse', 2], ['business', 2], ['excise', 2],
    ['licensesandpermits', 0], ['intergovernmental', 0],
  ]);

  it('nests the four tax lines under Taxes and closes the group at the next root row', () => {
    const read = makeRowReader(FY2019.body, FY2019.total, FY2019.ncols, 'fixture');
    const roots = buildRevenue(FY2019.body, read, (v) => v * 1000, [], indents);
    expect(roots.map((r) => r.label)).toEqual([
      'Taxes', 'Licenses and Permits', 'Intergovernmental',
    ]);
    expect(roots[0].children.map((c) => c.label)).toEqual([
      'Property', 'Retail Sales & Use', 'Business', 'Excise',
    ]);
    expect(roots[0].children.reduce((s, c) => s + c.value, 0)).toBe(171_912_000);
  });

  it('leaves a FLAT revenue side untouched — no colon heading, no group', () => {
    // Tacoma Era B (FY2012-FY2017) and both v2.22 entities print `Taxes` as an
    // ordinary valued leaf. Nothing may nest.
    const ncols = 3;
    const total = 'Total revenues                        191,829        71,334       263,163';
    const body = [
      'Taxes                              $   169,326   $   18,578   $   187,904',
      'Licenses and permits                   3,114         709         3,823',
    ];
    const read = makeRowReader(body, total, ncols, 'fixture');
    const roots = buildRevenue(body, read, (v) => v, [], new Map());
    expect(roots.map((r) => r.label)).toEqual(['Taxes', 'Licenses and permits']);
    expect(roots[0].children).toHaveLength(1);
  });
});

describe('table: a leading page-footer page number is furniture, not a cell', () => {
  // Spokane FY2007 p.44 puts the SAO page-footer page number `41` at column 0
  // of the `Debt service:` HEADING row. The heading carries no money of its
  // own, so with the page number counted as a cell the row looked like a data
  // row with all but one cell missing — and, this section having genuinely
  // incomplete rows elsewhere, it resolved to "no General Fund cell" and was
  // dropped. The group never opened and `Interest` surfaced at root against
  // the database's `Debt service / Interest`.
  const ncols = 7;
  const total = 'Total expenditures        108,531,791   1  2  3  4  5  6';
  const body = [
    '41                                 Debt service:',
    'Principal                          2,000          1  2  3  4  5  6',
    'Interest                           2,731          1  2  3  4  5  6',
  ];

  it('reads the page-numbered heading as a heading', () => {
    expect(readRowOrdinal(body[0], ncols).kind).toBe('header');
    expect(readRowOrdinal(body[0], ncols).label).toBe('Debt service');
  });

  it('still ignores the page number when picking a data row\'s cell', () => {
    // Bainbridge FY2004/2005/2007/2008 prepend a page number to DATA rows.
    // Counting back from the right end already shrugged those off; dropping
    // the furniture must not change which cell is chosen.
    const row = '16   Transportation   75   1,785,388   -   -   -   1,785,463';
    const r = readRowOrdinal(row, 6);
    expect(r.kind).toBe('cell');
    expect(r.value).toBe(75);
    expect(r.label).toBe('Transportation');
  });

  it('opens the group so Interest lands under Debt service', () => {
    const read = makeRowReader(body, total, ncols, 'fixture');
    const roots = buildOperating(body, read, (v) => v, []);
    expect(roots.map((r) => r.label)).toEqual(['Debt service']);
    expect(roots[0].children.map((c) => c.label)).toEqual(['Principal', 'Interest']);
  });
});

describe('table: the operating side keeps its GASB character rule', () => {
  it('treats the PLURAL Capital outlays as a root peer, not a Current child', () => {
    // Spokane prints `Capital outlay` FY2004-FY2011 and `Capital outlays`
    // FY2013-FY2024. The character rule knew only the singular, so half the
    // corpus nested the capital line inside Current: — inflating that subtotal
    // by the capital amount while the row still tied at $0, because the same
    // dollars are present either way. FY2004, the only era that still prints
    // indentation, puts `Capital outlay` at the parent level.
    const ncols = 3;
    const total = 'Total Expenditures        134,757,595   1   2';
    const body = [
      'Current:',
      'General government        50,000,000   1   2',
      'Capital outlays           2,216,660    1   2',
    ];
    const read = makeRowReader(body, total, ncols, 'fixture');
    const roots = buildOperating(body, read, (v) => v, []);
    expect(roots.map((r) => r.label)).toEqual(['Current', 'Capital outlays']);
  });

  it('nests functions under Current: and keeps Capital Outlay at root', () => {
    const ncols = 4;
    const total = 'Total Expenditures                                   264,071              17,306      151,943       433,320';
    const body = [
      'Current:',
      'General Government                                   29,310               1,000        4,111         34,421',
      'Public Safety                                        193,341              2,000        6,000         201,341',
      'Capital Outlay                                       2,522                12,880       3,507         18,909',
    ];
    const read = makeRowReader(body, total, ncols, 'fixture');
    const roots = buildOperating(body, read, (v) => v, []);
    expect(roots.map((r) => r.label)).toEqual(['Current', 'Capital Outlay']);
    expect(roots[0].children.map((c) => c.label)).toEqual(['General Government', 'Public Safety']);
  });
});
