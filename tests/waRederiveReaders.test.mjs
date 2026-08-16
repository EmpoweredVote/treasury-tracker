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
  assertPageYear, GF_CAPTION_RE, sectionOf, lpRowIsDecoration, labelCompareKey,
} from '../scripts/verify-wa-rederive.mjs';

describe('the DB label comparison is blind to WHERE the spaces are, and nothing else', () => {
  // Bellevue FY2015/FY2016 letter-space two labels in the text layer
  // ("Premi ums /contri buti ons", "Tra ns porta ti on"). The extractor repairs
  // those with `label_fixes`; this reader deliberately does NOT, because it must
  // report what the document says. The comparison therefore has to tolerate a
  // whitespace-placement difference or the repair would read as a defect.
  //
  // What it must NOT tolerate is anything else. Every label defect this milestone
  // actually found survives the squash: a weld, a truncation and a wrong name all
  // change the letters, not just the spaces.
  it('accepts a letter-spaced rendering of the same name', () => {
    expect(labelCompareKey('Premi ums /contri buti ons')).toBe(labelCompareKey('Premiums/contributions'));
    expect(labelCompareKey('Tra ns porta ti on')).toBe(labelCompareKey('Transportation'));
  });

  it('still rejects a WELDED label', () => {
    expect(labelCompareKey('Lodging Other')).not.toBe(labelCompareKey('Other'));
    expect(labelCompareKey('Issuance costs Capital outlay')).not.toBe(labelCompareKey('Capital outlay'));
  });

  it('still rejects a TRUNCATED label', () => {
    expect(labelCompareKey('Fire District #')).not.toBe(labelCompareKey('Fire District # 37 Contract'));
  });

  it('still rejects a different name that merely looks similar', () => {
    expect(labelCompareKey('Other licenses and permits')).not.toBe(labelCompareKey('Other'));
    expect(labelCompareKey('Capital outlay')).not.toBe(labelCompareKey('Capital outlays'));
  });

  it('is case-insensitive, as it already was', () => {
    expect(labelCompareKey('Capital Outlay')).toBe(labelCompareKey('Capital outlay'));
  });
});

describe('page identity: "General" must name a FUND, not a debt or a function', () => {
  it('accepts a real General Fund column caption', () => {
    expect(GF_CAPTION_RE.test('Consolidated General Fund Consolidated Fire Fund')).toBe(true);
  });

  it('rejects a page whose only "General" is the expenditure function', () => {
    expect(GF_CAPTION_RE.test('General Government Public Safety')).toBe(false);
  });

  it('rejects a page whose only "General" is a General Obligation debt fund', () => {
    // Vancouver FY2021 splits its governmental-funds statement across two
    // pages. Page 46 carries the identical title and scope line but its
    // columns are American Rescue Plan Act / General Obligation Debt /
    // Non-Major / Total -- no General Fund at all. It qualified purely on the
    // word "General" in "General Obligation", making the statement page
    // AMBIGUOUS, which this harness treats as a blocker rather than resolving
    // by document order.
    expect(GF_CAPTION_RE.test('American Rescue Plan Act General Obligation Debt Non-Major Governmental Funds')).toBe(false);
  });

  it('still accepts a page where a General Fund caption sits beside a General Obligation column', () => {
    // The exclusion is per-occurrence, not per-page: only a caption in which
    // EVERY "General" is followed by an excluded word is rejected.
    expect(GF_CAPTION_RE.test('General Fund General Obligation Debt Total')).toBe(true);
  });

  it('still accepts Tacoma\'s flattened "General Governmental" caption', () => {
    // FY2003 flattens to "(0010) General Governmental Governmental Fund Funds
    // Funds" because the neighbouring column is Other Governmental. The
    // lookahead must not match inside "governmental".
    expect(GF_CAPTION_RE.test('(0010) General Governmental Governmental Fund Funds Funds')).toBe(true);
  });
});

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

  it('reads "Twelve Months ENDING" as well as "Year ENDED"', () => {
    // Bellevue FY2008-FY2012 caption their statements "For the Twelve Months
    // Ending December 31, 2008" rather than "For the Year Ended...". The period
    // is stated exactly as definitively; only the participle differs.
    expect(assertPageYear('For the Twelve Months Ending December 31, 2008', 2008, 'fixture'))
      .toMatch(/2008/);
  });

  it('catches a wrong year in the "Ending" form too', () => {
    expect(() => assertPageYear('For the Twelve Months Ending December 31, 2007', 2008, 'fixture'))
      .toThrow(/2007/);
  });
});

describe('table: a section whose header row the issuer omitted', () => {
  // Bellevue FY2015 and FY2016 print NO `Expenditures:` heading at all -- the
  // statement runs straight from `Total revenues` into `Current:`. Scanning
  // backward for the section's own header found nothing and the whole year
  // failed, on both sides, over a heading the document simply does not have.
  const LINES = [
    'Revenues :',
    'Taxes and special assessments   140,733   -   48,590   11,034   200,357',
    'Other                           144       78  2        485      709',
    'Total revenues                  195,316   18,987   71,131   17,389   302,824',
    'Current:',
    'General government              22,195    3    457      8,776    31,432',
    'Culture and recreation          34,887    -    5,387    193      40,466',
    'Total expenditures              185,915   20,695   102,458  38,820   347,888',
  ];

  it('falls back to the revenue total row and reads the section anyway', () => {
    const s = sectionOf(LINES, 'operating', 'fixture');
    expect(s.ncols).toBe(5);
    expect(s.body.map((l) => l.trim().split(/\s{2,}/)[0])).toEqual([
      'Current:', 'General government', 'Culture and recreation',
    ]);
  });

  it('still prefers a real Expenditures header when the issuer prints one', () => {
    const withHeader = [...LINES.slice(0, 4), 'Expenditures:', ...LINES.slice(4)];
    const s = sectionOf(withHeader, 'operating', 'fixture');
    expect(s.body[0].trim()).toBe('Current:');
  });

  it('throws when neither a header nor a revenue total row exists', () => {
    expect(() => sectionOf(LINES.filter((l) => !/Total revenues|Revenues :/.test(l)), 'operating', 'fixture'))
      .toThrow(/no operating section header/i);
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

  it('reads a value carrying a FOOTNOTE MARKER as money, not as label text', () => {
    // Everett FY2021 p.37 and FY2022 p.35 print `(52,270) *` in the Emergency
    // Medical Services column, with "* Negative revenue is due to changes in
    // fair value" at the foot of the page. The marker sits inside
    // LP_MAX_CHAR_GAP of the closing bracket, so proximity grouping welds it on,
    // "(52,270)*" stops matching the money pattern, and the amount lands in the
    // LABEL -- which read "Otherrevenues(52,270)*" against the ordinal reading's
    // "Other revenues". Same shape as the $ weld above: a neighbouring glyph
    // silently redefining a cell as text.
    const row = at([[60, 'O t h e r   r e v e n u e s'], [190, '1 , 5 4 7 , 3 0 9'],
      [240, '( 5 2 , 2 7 0 )'], [256, '*'], [294, '5 6 1 , 4 0 3']]);
    const { cells, label } = lpSplit(row);
    expect(cells.map((c) => c.value)).toEqual([1547309, -52270, 561403]);
    expect(label.toLowerCase().replace(/[^a-z0-9]/g, '')).toBe('otherrevenues');
  });

  it('does not turn a bare marker into a zero cell', () => {
    // The marker only ever rides ON a value. Alone it is punctuation.
    const { cells } = lpSplit(at([[60, 'N o t e'], [190, '*']]));
    expect(cells).toEqual([]);
  });
});

describe('lineprinter: an unlabelled all-dash row is decoration, not a row', () => {
  // Everett FY2015 p.37 prints the Capital outlay row's dash placeholders half a
  // line BELOW its figures, so strict physical geometry puts them on an output
  // row of their own: no label, two dash placeholders, one of them inside the
  // General Fund band. That phantom entered the geometric sequence as a $0 row
  // and shifted every row after it, so `Principal` was compared against `` and
  // `Interest` against `Principal` -- a row-count disagreement on a page whose
  // every figure was right.
  //
  // A row with NO LABEL and NOTHING BUT DASHES states no fact: a dash is the
  // issuer's way of writing "no amount", and there is no line item to attach it
  // to. Note what is deliberately NOT skipped -- a row with a REAL figure and no
  // label. That shape must stay loud (the ordinal side raises on it), because it
  // is how a real amount goes missing.
  it('skips a row with no label whose every cell is a dash', () => {
    expect(lpRowIsDecoration(lpSplit('                    -              -'))).toBe(true);
  });

  it('keeps an unlabelled row that carries a REAL figure', () => {
    expect(lpRowIsDecoration(lpSplit('              4 , 2 5 9 , 0 7 4        -'))).toBe(false);
  });

  it('keeps a LABELLED row whose cells are all dashes', () => {
    // Kitsap prints a dash on its `Debt service` heading; Everett prints rows
    // that are genuinely $0 in every column. Both are real rows.
    expect(lpRowIsDecoration(lpSplit('  P r i n c i p a l              -         -'))).toBe(false);
  });

  it('keeps a row with neither label nor cells out of it entirely', () => {
    // Nothing to decide; lpSection already skips these before asking.
    expect(lpRowIsDecoration(lpSplit('        '))).toBe(false);
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

// ═══════════════════════════════════════════════════════════════════════════
// A ROW CARRYING NO MONEY AT ALL IS ONE OF THREE THINGS, AND KENT PRINTS ALL
// THREE.
// ═══════════════════════════════════════════════════════════════════════════
// Both builders used to treat every valueless row that did not end in a colon
// as the first line of a WRAPPED LABEL and carry it onto the next valued row.
// That is one of the three shapes. The other two are a GROUP HEADING the issuer
// printed WITHOUT a colon, and a DATA ROW the issuer printed EMPTY IN EVERY
// COLUMN. Kent prints all three, and reading the wrong one welds two labels
// together -- a label defect a $0 tie is blind to by construction, which is
// exactly how ten of them reached production (`Lodging Other`,
// `Issuance costs Capital outlay`, ...).
//
// The discriminator is `pdftotext -layout` indentation, STRUCTURE ONLY, and it
// is read off the page's OWN colon headings rather than configured: a colon is
// a printed declaration, so the depth pair (heading, its children) that the
// page's colon headings establish is what a colon-LESS heading must also match.
//
//   Kent FY2016 p.47   `Intergovernmental revenue`  depth 0, next row depth 1
//                      -> the same pair `Taxes:`/`Property` prints  -> HEADING
//   Kent FY2022 p.50   `Unrealized net gain/(loss)` depth 1, next row depth 3
//                      -> 3 is no level on this page                -> WRAP
//   Kent FY2011 p.36   `Lodging`                    depth 1, next row depth 1
//                      -> a peer, not a parent, not a fragment      -> EMPTY
describe('table: a valueless row is a heading, a wrapped fragment, or an empty data row', () => {
  // ── Kent FY2011 p.36 revenue, transcribed at the emitted offsets. ─────────
  // `Real estate excise tax` prints only in Capital Improvement (blank in the
  // General Fund column) and `Lodging` prints in NO column at all. Both are
  // real line items; neither is a fragment of `Other`.
  const FY2011 = {
    ncols: 4,
    total: 'TOTAL REVENUES                                                            68,543,360       6,122,639        2,397,011       2,007,170',
    body: [
      'Taxes:',
      'Property                                                    $             19,367,630   $                 $               $',
      'Sales and use                                                             15,826,344       3,784,084',
      'Utility                                                                   15,544,305',
      'Real estate excise tax                                                                     2,235,174',
      'Lodging',
      'Other                                                                     1,130,391',
      'Licenses and permits:',
      'Building permits                                                          952,486',
      'Other licenses and permits                                                1,296,535',
      'Intergovernmental revenue                                                 7,518,359                                         1,036,051',
      'Charges for services:',
      'Park and recreation fees                                                  1,131,651',
      'Other fees and charges                                                    2,286,029                                         46',
      'Fines and forfeitures                                                     1,543,311',
      'Miscellaneous revenue:',
      'Special assessments                                                                                         1,819,694       465,992',
      'Interest income                                                           71,472           3,381            577,317         44,640',
      'Unrealized net gain/(loss) in fair  value  of  investments                          1',
      'Contributions and Donations                                               735,503',
      'Other miscellaneous revenue                                               1,139,343        100,000                          460,441',
    ],
    // From `pdftotext -layout` on the same page: colon headings and root leaves
    // at depth 0, their children at depth 1.
    indents: new Map([
      ['revenues', 0], ['taxes', 0], ['property', 1], ['salesanduse', 1], ['utility', 1],
      ['realestateexcisetax', 1], ['lodging', 1], ['other', 1],
      ['licensesandpermits', 0], ['buildingpermits', 1], ['otherlicensesandpermits', 1],
      ['intergovernmentalrevenue', 0], ['chargesforservices', 0],
      ['parkandrecreationfees', 1], ['otherfeesandcharges', 1],
      ['finesandforfeitures', 0], ['miscellaneousrevenue', 0], ['specialassessments', 1],
      ['interestincome', 1], ['unrealizednetgainlossinfairvalueofinvestments', 1],
      ['contributionsanddonations', 1], ['othermiscellaneousrevenue', 1], ['totalrevenues', 0],
    ]),
  };

  it('reads an all-columns-empty row as a row of its own, not as a label fragment', () => {
    // THE PRODUCTION DEFECT. `Lodging` welded onto the next row and Kent
    // FY2011 shipped a Taxes line item called "Lodging Other" carrying
    // `Other`'s $1,130,391. The figure was right, the tie was $0, and the name
    // was fiction.
    const read = makeRowReader(FY2011.body, FY2011.total, FY2011.ncols, 'fixture');
    const roots = buildRevenue(FY2011.body, read, (v) => v, [], FY2011.indents);
    const taxes = roots.find((r) => r.label === 'Taxes');
    expect(taxes.children.map((c) => c.label)).toEqual(['Property', 'Sales and use', 'Utility', 'Other']);
    expect(taxes.children.at(-1).value).toBe(1_130_391);
  });

  it('still closes the group on a valued root leaf at heading depth', () => {
    const read = makeRowReader(FY2011.body, FY2011.total, FY2011.ncols, 'fixture');
    const roots = buildRevenue(FY2011.body, read, (v) => v, [], FY2011.indents);
    expect(roots.map((r) => r.label)).toEqual([
      'Taxes', 'Licenses and permits', 'Intergovernmental revenue',
      'Charges for services', 'Fines and forfeitures', 'Miscellaneous revenue',
    ]);
    // Every dollar the page prints in its General Fund column, and no other.
    const sum = roots.flatMap((r) => r.children).reduce((s, c) => s + c.value, 0);
    expect(sum).toBe(68_543_360);
  });

  // ── Kent FY2016 p.47 revenue: the colon-less heading. ────────────────────
  const FY2016 = {
    ncols: 4,
    total: 'TOTAL REVENUES                                                              95,753,339       13,943,352        2,150,390       506,817',
    body: [
      'Licenses and permits:',
      'Building permits                                                            2,892,483                 -                 -                 -',
      'Other licenses and permits                                                  3,377,042                 -                 -                 -',
      'Intergovernmental revenue',
      'Federal grants                                                              158,283                   -                 -                 -',
      'State grants                                                                6,033                     -                 -                 -',
      'State shared revenues                                                       7,551,034                 -                 -                 -',
      'Other governments                                                           356,993                   -                 -      506,817',
      'Charges for services:',
      'Park and recreation fees                                                    1,536,362                 -                 -                 -',
    ],
    indents: new Map([
      ['licensesandpermits', 0], ['buildingpermits', 1], ['otherlicensesandpermits', 1],
      ['intergovernmentalrevenue', 0], ['federalgrants', 1], ['stategrants', 1],
      ['statesharedrevenues', 1], ['othergovernments', 1],
      ['chargesforservices', 0], ['parkandrecreationfees', 1], ['totalrevenues', 0],
    ]),
  };

  it('opens a group on a heading the issuer printed WITHOUT a colon', () => {
    // Kent prints `Intergovernmental revenue:` with a colon FY2004-FY2015 and
    // drops the colon FY2016 onward while keeping the same four children and
    // the same indentation. Carried forward as a fragment it welded onto
    // `Federal grants` AND left the previous group open, so all four
    // intergovernmental lines would have landed under Licenses and permits.
    const read = makeRowReader(FY2016.body, FY2016.total, FY2016.ncols, 'fixture');
    const roots = buildRevenue(FY2016.body, read, (v) => v, [], FY2016.indents);
    expect(roots.map((r) => r.label)).toEqual([
      'Licenses and permits', 'Intergovernmental revenue', 'Charges for services',
    ]);
    expect(roots[1].children.map((c) => c.label)).toEqual([
      'Federal grants', 'State grants', 'State shared revenues', 'Other governments',
    ]);
    expect(roots[1].children.reduce((s, c) => s + c.value, 0)).toBe(8_072_343);
  });

  // ── Kent FY2022 p.50 revenue: the genuine wrap. ──────────────────────────
  const FY2022 = {
    ncols: 6,
    total: 'TOTAL REVENUES                           129,757,740                        24,371,961       720,252         3,366,933         35,486,947       193,703,833',
    body: [
      'Miscellaneous revenue:',
      'Interest income                          1,230,801                          416,309          160,674         (893,176)         729,546          1,644,154',
      'Unrealized net gain/(loss)',
      'in fair value of investments             (3,288,682)                        (886,645)                 -      59,953            (2,229,275)      (6,344,649)',
      'Rent/Leases income                       829,860                                     -                -               -        80,852           910,712',
    ],
    // `in fair value of investments` sits at depth 3 -- a depth no other row on
    // the page uses. NOTE what is absent: `-layout` wraps the label too, so the
    // COMPOSITE name has no entry at all. A wrapped row therefore has to nest by
    // the depth of the line that opened it (1), which is the transcribed truth
    // and not a convenience.
    indents: new Map([
      ['miscellaneousrevenue', 0], ['interestincome', 1],
      ['unrealizednetgainloss', 1], ['infairvalueofinvestments', 3],
      ['rentleasesincome', 1], ['totalrevenues', 0],
    ]),
  };

  it('welds a genuinely wrapped label onto the row that carries its figure', () => {
    // The opposite error to `Lodging Other`: here the two output lines ARE one
    // line item, and reading them apart would publish a leaf called "in fair
    // value of investments" and lose the name of what it measures.
    const read = makeRowReader(FY2022.body, FY2022.total, FY2022.ncols, 'fixture');
    const roots = buildRevenue(FY2022.body, read, (v) => v, [], FY2022.indents);
    expect(roots.map((r) => r.label)).toEqual(['Miscellaneous revenue']);
    expect(roots[0].children.map((c) => c.label)).toEqual([
      'Interest income', 'Unrealized net gain/(loss) in fair value of investments', 'Rent/Leases income',
    ]);
    expect(roots[0].children[1].value).toBe(-3_288_682);
  });

  // ── Kent FY2005 p.31 operating: an empty row above a root leaf. ──────────
  const FY2005OP = {
    ncols: 4,
    total: 'TOTAL EXPENDITURES                                 67,200,101      26,047             5,027,006       22,962,767',
    body: [
      'Current:',
      'General government                                 5,227,256       20,000',
      'Judicial                                           1,872,295',
      'Public safety                                      40,385,910',
      'Community development                               4,045,313      6,047',
      'Public works                                       4,270,925',
      'Leisure services                                   7,315,819',
      'Health and human services                          3,888,910',
      'Debt service:',
      'Principal                                                                             3,911,886',
      'Interest                                                                              1,115,120',
      'Issuance costs',
      'Capital outlay                                     193,673                                            22,962,767',
    ],
    indents: new Map([
      ['expenditures', 0], ['current', 0], ['generalgovernment', 1], ['judicial', 1],
      ['publicsafety', 1], ['communitydevelopment', 1], ['publicworks', 1],
      ['leisureservices', 1], ['healthandhumanservices', 1],
      ['debtservice', 0], ['principal', 1], ['interest', 1], ['issuancecosts', 1],
      ['capitaloutlay', 0], ['totalexpenditures', 0],
    ]),
    // The revenue section of the same page, which is where the column bands are
    // corroborated from -- this section has no complete data row of its own.
    corroborate: [
      'Interest income                                    575,909         120,921            1,511,868       504,739',
      'TOTAL REVENUES                                     67,395,835      11,244,013         5,085,487       13,154,048',
    ],
  };

  it('keeps Capital outlay a root peer when an empty row precedes it', () => {
    // THE PRODUCTION DEFECT, operating side. `Issuance costs` welded onto
    // `Capital outlay`, so FY2005 shipped a leaf named "Issuance costs Capital
    // outlay" -- and because the composite no longer STARTS with a GASB
    // character word it also stopped being a root peer and was filed inside
    // Debt service, putting $193,673 of capital spending in the debt subtotal.
    const read = makeRowReader(FY2005OP.body, FY2005OP.total, FY2005OP.ncols, 'fixture', FY2005OP.corroborate);
    const roots = buildOperating(FY2005OP.body, read, (v) => v, [], FY2005OP.indents);
    expect(roots.map((r) => r.label)).toEqual(['Current', 'Debt service', 'Capital outlay']);
    expect(roots.at(-1).children).toEqual([{ label: 'Capital outlay', value: 193_673 }]);
    // Debt service prints nothing in the General Fund column this year.
    expect(roots[1].children).toEqual([]);
  });

  it('refuses to classify a valueless row whose depth the rendering does not give', () => {
    // An ambiguous label is DROPPED from the indent map by design, so a nesting
    // can never be decided by a name that appears at two depths. The reader
    // must then refuse the row rather than fall back to welding it.
    const indents = new Map(FY2011.indents);
    indents.delete('lodging');
    const read = makeRowReader(FY2011.body, FY2011.total, FY2011.ncols, 'fixture');
    expect(() => buildRevenue(FY2011.body, read, (v) => v, [], indents))
      .toThrow(/Lodging/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// A SECTION MADE ENTIRELY OF INCOMPLETE ROWS
// ═══════════════════════════════════════════════════════════════════════════
// The bands that locate an empty cell must first reproduce the ordinal reading
// on a COMPLETE row, or they are only being checked against the Total row they
// were derived from. Kent FY2004-FY2011 print operating sections in which EVERY
// row is short, so that corroboration cannot come from inside the section --
// and refusing the year outright would discard eight readable years over a
// property of the section rather than of the page.
//
// `-table` reflows the WHOLE PAGE onto one grid, so the column geometry is a
// property of the page: the other section of the same statement is corroborating
// evidence of exactly the kind required. It is consulted ONLY when the section
// itself supplies none, so every page that could already corroborate locally is
// read bit-identically to before.
describe('table: bands may be corroborated from the other section of the same page', () => {
  const ncols = 4;
  const total = 'TOTAL EXPENDITURES                                                        65,027,406       2,829,792        2,407,453       1,205,184';
  const body = [
    'General government                                                        5,908,708        36,716',
    'Judicial                                                                  2,639,800',
    'Capital outlay                                                            139,804                                           1,205,184',
  ];
  const revenue = [
    'Interest income                                                           71,472           3,381            577,317         44,640',
    'TOTAL REVENUES                                                            68,543,360       6,122,639        2,397,011       2,007,170',
  ];

  it('refuses the section when nothing corroborates the bands', () => {
    expect(() => makeRowReader(body, total, ncols, 'fixture'))
      .toThrow(/no COMPLETE data row/);
  });

  it('reads the section once the page\'s other section corroborates them', () => {
    const read = makeRowReader(body, total, ncols, 'fixture', revenue);
    expect(read(body[0]).value).toBe(5_908_708);
    expect(read(body[2]).value).toBe(139_804);
  });

  it('still refuses when the corroborating row CONTRADICTS the ordinal reading', () => {
    // A page whose columns are not one grid must fail loudly rather than
    // borrow geometry from a section that disproves it.
    const scattered = ['Scattered                40        60          100         160'];
    expect(() => makeRowReader(body, total, ncols, 'fixture', scattered))
      .toThrow(/CONTRADICT/);
  });
});
