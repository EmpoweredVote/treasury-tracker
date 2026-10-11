import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';

import {
  normLabel, parseCsv, buildNyTree, fiscalYearStartMonth, aggregateCityYear,
  sourceNameFor, readYear, ARCHIVE_PATH, assertRosterHasNoNyc,
} from '../scripts/lib/nyOsc.mjs';
import { checkPartition } from '../scripts/lib/fundScope.mjs';

const archiveIt = existsSync(ARCHIVE_PATH) ? it : it.skip;

/**
 * Regression tests for the whole-branch review of Tasks 1-9.
 * Each one reproduces a specific finding and failed before its fix.
 */

describe('C-1: the ampersand split at LEVEL_2', () => {
  it('collapses "&" and "and" to one label', () => {
    // MEASURED: revenue LEVEL_2_CATEGORY carries "Interest & Penalties"
    // ($454,591,690.59, FY1995-2012) and "Interest and Penalties"
    // ($375,895,416.71, FY2013-2026). Case normalisation alone leaves them
    // distinct, so every one of the 61 cities grew TWO parallel revenue
    // sub-branches at the era boundary -- at an exact $0 tie, because the
    // rename moves no money. The exact defect normLabel exists to prevent,
    // surviving one level below where the original code looked.
    expect(normLabel('Interest & Penalties')).toBe(normLabel('Interest and Penalties'));
    expect(normLabel('INTEREST & PENALTIES')).toBe('Interest and Penalties');
  });

  it('does not weld the ampersand onto its neighbours', () => {
    expect(normLabel('Equip & Cap Outlay')).toBe('Equip and Cap Outlay');
    expect(normLabel('A&B')).toBe('A and B');
  });
});

describe('M-15: normLabel must not misquote the publisher', () => {
  it('preserves a capital after a hyphen', () => {
    // OSC publishes "Other Non-Property Taxes". TT was publishing
    // "Other Non-property Taxes" -- a reader-facing misquote, and the test
    // that claimed to check "Title Case, matching the modern era as published"
    // only ever exercised two clean two-word labels.
    expect(normLabel('Other Non-Property Taxes')).toBe('Other Non-Property Taxes');
    expect(normLabel('OTHER NON-PROPERTY TAXES')).toBe('Other Non-Property Taxes');
  });

  it('capitalises a word that starts with a non-letter', () => {
    expect(normLabel('(STATE) AID')).toBe('(State) Aid');
  });
});

describe('I-5: the row total must equal the tree it describes', () => {
  it('derives total from the tree so the two cannot drift', () => {
    // Accumulating row-by-row and reducing per-branch give different doubles
    // for decimal cents: 46685826.47 vs 46685826.470000006. Task 10 writes
    // `total` as the row total and `tree` as the hierarchy, so a reader
    // comparing the header figure to the icicle rollup sees the difference.
    // MEASURED drift: these six values, interleaved across two level-1
    // buckets, summed row-by-row give 709.3499999999999 and summed
    // branch-by-branch give 709.35. Row order and grouped order are different
    // summation orders, so for decimal cents they are different doubles.
    const row = (l1, obj, amt) => ({
      LEVEL_1_CATEGORY: l1, LEVEL_2_CATEGORY: 'S', OBJECT_OF_EXPENDITURE: obj, AMOUNT: amt,
    });
    const vals = [0.01, 47.29, 94.58, 141.87, 189.16, 236.45];
    const { tree, total } = buildNyTree(
      vals.map((v, k) => row(k % 2 ? 'A' : 'B', `o${k}`, String(v))),
    );
    expect(total).toBe(tree.reduce((s, n) => s + n.a, 0));
    for (const n of tree) expect(n.a).toBe(n.c.reduce((s, k) => s + k.a, 0));
  });
});

describe('I-6: duplicate leaves', () => {
  it('merges items sharing a level-1/level-2/object key', () => {
    // Albany FY2021 general-fund expenditure had 49 distinct keys, 21 of them
    // duplicated -- "Employee Benefits / Unclassified Employee Benefits /
    // Employee Benefits" appeared 31 times. A reader saw 31 identical sibling
    // leaves with identical names and no way to tell them apart.
    const row = (obj, amt) => ({
      LEVEL_1_CATEGORY: 'Employee Benefits', LEVEL_2_CATEGORY: 'Unclassified',
      OBJECT_OF_EXPENDITURE: obj, AMOUNT: amt,
    });
    const { tree, total } = buildNyTree([row('Employee Benefits', '10'),
      row('Employee Benefits', '25'), row('Employee Benefits', '5')]);
    expect(tree[0].c[0].i).toEqual([{ d: 'Employee Benefits', a: 40 }]);
    expect(total).toBe(40);
  });

  archiveIt('emits no duplicate leaf key anywhere in a real city-year', () => {
    const rows = readYear(ARCHIVE_PATH, 2021).filter((r) => r.entityName === 'City of Albany');
    const { tree } = aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'general_fund' });
    for (const n1 of tree) {
      for (const n2 of n1.c) {
        const ds = n2.i.map((x) => x.d);
        expect(new Set(ds).size, `${n1.n} / ${n2.n}`).toBe(ds.length);
      }
    }
  });
});

describe('I-7: date formats are asserted, not sliced blind', () => {
  it('refuses a non-ISO PERIOD_START instead of inventing a month', () => {
    // "1/1/2024" sliced at [5,7] yields 2 -- February. "20240101" yields 10 --
    // October. Both are in 1..12 so the old range check passed them. Given the
    // FYSM `NOT NULL DEFAULT 1` history, an in-range-but-wrong month is the
    // worst available failure.
    expect(() => fiscalYearStartMonth({ PERIOD_START: '1/1/2024' })).toThrow(/unrecognised/i);
    expect(() => fiscalYearStartMonth({ PERIOD_START: '20240101' })).toThrow(/unrecognised/i);
  });

  it('refuses a non-MM/DD FISCAL_YEAR_END', () => {
    expect(() => fiscalYearStartMonth({ FISCAL_YEAR_END: '2010-12-31' })).toThrow(/unrecognised/i);
  });

  it('still reads the formats the archive actually uses', () => {
    expect(fiscalYearStartMonth({ PERIOD_START: '2023-07-01' })).toBe(7);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '12/31' })).toBe(1);
    expect(fiscalYearStartMonth({ FISCAL_YEAR_END: '06/30' })).toBe(7);
  });
});

describe('I-8: aggregateCityYear validates its arguments', () => {
  const rows = [{ fundPrefix: 'A', section: 'EXPENDITURE', LEVEL_1_CATEGORY: 'G',
    LEVEL_2_CATEGORY: 'S', OBJECT_OF_EXPENDITURE: 'O', AMOUNT: '5' }];

  it('refuses an unknown scope rather than relabelling it total_governmental', () => {
    // A typo'd scope used to fall through to the governmental branch and then
    // be LABELLED total_governmental regardless of what the caller asked for.
    expect(() => aggregateCityYear(rows, { section: 'EXPENDITURE', scope: 'generalFund' }))
      .toThrow(/unknown fund scope/i);
  });

  it('refuses an unknown section rather than returning a silent $0', () => {
    // A typo'd section returned {tree:[], total:0} -- indistinguishable from a
    // genuinely missing city-year, which the loader skips.
    expect(() => aggregateCityYear(rows, { section: 'expenditure', scope: 'general_fund' }))
      .toThrow(/unknown section/i);
  });

  it('still returns an empty result for a genuinely empty row set', () => {
    expect(aggregateCityYear([], { section: 'REVENUE', scope: 'general_fund' }))
      .toMatchObject({ total: 0, tree: [] });
  });
});

describe('I-9: sourceNameFor refuses rather than mislabels', () => {
  it('refuses an unknown dataset type instead of defaulting to Expenditures', () => {
    // `datasetType === 'revenue' ? 'Revenues' : 'Expenditures'` turned
    // sourceNameFor('Revenue', ...) into an EXPENDITURES label on revenue data,
    // with a matching registry entry and a clean `actual` basis stamp.
    expect(() => sourceNameFor('Revenue', 2021, 'general_fund')).toThrow(/unknown dataset type/i);
    expect(() => sourceNameFor('', 2021, 'general_fund')).toThrow(/unknown dataset type/i);
  });

  it('refuses a fiscal year that is not an integer in range', () => {
    // "FYNaN" matches none of the three registry patterns, so the row would be
    // written with fund_scope, basis AND audit_grade all silently `unknown`.
    expect(() => sourceNameFor('revenue', NaN, 'general_fund')).toThrow(/fiscal year/i);
    expect(() => sourceNameFor('revenue', 1066, 'general_fund')).toThrow(/fiscal year/i);
  });

  it('still builds the names the registries match', () => {
    expect(sourceNameFor('operating', 2021, 'general_fund'))
      .toBe('New York OSC Annual Financial Report — Expenditures, General Fund (FY2021 actual, self-reported)');
  });
});

describe('I-2: parseCsv fails loudly instead of swallowing rows', () => {
  it('throws on an unterminated quote instead of dropping the rest of the file', () => {
    // A single stray quote put the parser into quote mode for the remainder of
    // the file; everything after collapsed into one giant single-field row,
    // which `rows.filter(r => r.length > 1)` then deleted too. readYear
    // returned a short row set with NO error, and Task 10 would have written a
    // truncated year that ties perfectly against itself.
    expect(() => parseCsv('a,b\n"oops,2\n3,4\n')).toThrow(/unterminated quote/i);
  });

  it('keeps a legitimate single-field row', () => {
    expect(parseCsv('a\n1\n2\n')).toEqual([['a'], ['1'], ['2']]);
  });

  it('still handles the real-world shapes', () => {
    expect(parseCsv('a,b\n"x,y",2\n')).toEqual([['a', 'b'], ['x,y', '2']]);
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(parseCsv('a,b\n"he said ""hi""",2\n')).toEqual([['a', 'b'], ['he said "hi"', '2']]);
    expect(parseCsv('a,b\n"line\nbreak",2\n')).toEqual([['a', 'b'], ['line\nbreak', '2']]);
  });
});

describe('I-3: readYear validates the columns it depends on', () => {
  archiveIt('reads the real archive unchanged', () => {
    expect(readYear(ARCHIVE_PATH, 2021).length).toBeGreaterThan(10000);
  });

  archiveIt('names the archive range when a year is absent', () => {
    // The old failure surfaced a raw Python KeyError traceback.
    expect(() => readYear(ARCHIVE_PATH, 2027)).toThrow(/2027.*FY1995.*FY2026|FY1995.*FY2026/s);
  });
});

describe('I-10: an expectation of 0 means "registered, not yet loaded"', () => {
  it('does not report a registered-but-unloaded entry as a partition problem', () => {
    // Two EXPECTED_ROWS entries at 0 made checkPartition push a problem for
    // EVERY run, so `node scripts/classifyFundScope.mjs` exited 1 for every
    // other family too. A gate that cannot run is measuring nothing.
    const res = checkPartition(
      { byEntry: new Map([['loaded-entry', { rows: 5 }]]), unknownRows: 0, overlaps: [] },
      5,
      { expected: { 'loaded-entry': 5, 'ny-osc-city-general-fund': 0 } },
    );
    expect(res.problems.filter((p) => p.includes('ny-osc-city-general-fund'))).toEqual([]);
  });

  it('STILL reports a non-zero expectation that matched nothing', () => {
    const res = checkPartition(
      { byEntry: new Map([['loaded-entry', { rows: 5 }]]), unknownRows: 0, overlaps: [] },
      5,
      { expected: { 'loaded-entry': 5, 'some-other-entry': 198 } },
    );
    expect(res.problems.some((p) => p.includes('some-other-entry'))).toBe(true);
  });
});

describe('M-12: the NYC guard runs before any write', () => {
  it('refuses a roster containing New York City', () => {
    // The guard used to live INSIDE the write loop, so a "New York" entry at
    // roster position 40 would have written 39 municipalities before firing.
    expect(() => assertRosterHasNoNyc([
      { municipalCode: '010201000000', name: 'Albany' },
      { municipalCode: '650000000000', name: 'New York' },
    ])).toThrow(/New York/);
  });

  it('refuses a roster with a duplicate municipal code', () => {
    // The code is the source_entity_key. Two cities sharing one would collapse
    // into a single municipality and silently merge their money.
    expect(() => assertRosterHasNoNyc([
      { municipalCode: '010201000000', name: 'Albany' },
      { municipalCode: '010201000000', name: 'Buffalo' },
    ])).toThrow(/duplicate municipal code/i);
  });

  it('passes a clean roster', () => {
    expect(() => assertRosterHasNoNyc([
      { municipalCode: '010201000000', name: 'Albany' },
      { municipalCode: '140203000000', name: 'Buffalo' },
    ])).not.toThrow();
  });
});

describe('M-19 / I-4: the measured facts the evidence strings rest on', () => {
  archiveIt('confirms the archive carries NO N-suffixed budgetary codes at all', () => {
    // basisRegistry credited the REVENUE/EXPENDITURE section filter with
    // excluding the estimated `N` codes. Measured: there are none in the
    // dataset, in any section. The outcome is right, the mechanism was wrong,
    // and that would mislead anyone later confirming the `actual` basis claim.
    for (const fy of [1995, 2005, 2012, 2013, 2021]) {
      const n = readYear(ARCHIVE_PATH, fy).filter((r) => /N$/.test(r.accountCode || ''));
      expect(n, `FY${fy}`).toHaveLength(0);
    }
  });

  archiveIt('pins where blank AMOUNT rows occur, so a change is visible', () => {
    // 7,068 revenue/expenditure rows FY2000-2012 carry a blank AMOUNT, and
    // NONE do outside that window. parseAmount('') is 0 and buildNyTree drops
    // zeros, so they contribute nothing -- which is almost certainly right for
    // a nil line, but it is an assumption, and this test is where it is
    // recorded rather than assumed.
    const blanks = (fy) => readYear(ARCHIVE_PATH, fy)
      .filter((r) => String(r.AMOUNT ?? '').trim() === '').length;
    expect(blanks(1995), 'FY1995 predates the blanks').toBe(0);
    expect(blanks(2005), 'FY2005 is inside the blank window').toBeGreaterThan(0);
    expect(blanks(2013), 'FY2013+ reports explicit zeros instead').toBe(0);
    expect(blanks(2021), 'FY2013+ reports explicit zeros instead').toBe(0);
  });
});
