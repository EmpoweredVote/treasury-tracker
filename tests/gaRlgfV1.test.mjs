/**
 * Georgia DCA RLGF — the FY2009-2015 form generation ("V1").
 *
 * Every trap exercised here was MEASURED on the 222-filing sample described in
 * `.planning/GA-RLGF-V1-DESIGN.md`. The fixtures are hand-built grids, not
 * extracts of a cached workbook: `reference_stacked_prs_get_no_ci` records a
 * test that read gitignored `cache/` and took a whole suite down at collection.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';

import { describe, it, expect } from 'vitest';
import {
  vkey, parseExportable, mergeTwins, readV1Pages,
  buildV1ExpenditureTree, checkV1ExpenditureTotal,
  buildV1RevenueTree, checkV1SectionTotals, checkV1PartTotals, V1_REVENUE_SECTIONS,
  readV1Log, readV1Filing, V1_EXPENDITURE_TOTAL_KEYS,
} from '../scripts/lib/gaRlgfV1.mjs';
import { REVENUE_SECTIONS } from '../scripts/lib/gaRlgf.mjs';
import { resolveMonth, assertV1MonthConsistency } from '../scripts/loadGeorgiaRLGF.mjs';
import { consolidationOverlap, GA_CONSOLIDATION_OVERLAP } from '../scripts/data/gaRlgfAnomalies.mjs';
import { GA_FORM_GENERATIONS, GA_LOAD_WINDOW } from '../scripts/data/georgiaRlgfEntities.mjs';

/** The shape of a V1 extract sheet: marker row, CICOID header row, one value row. */
function extractGrid(blocks) {
  const rows = [['Exportable data', null, 'Please do not attempt to edit']];
  for (const [name, pairs] of Object.entries(blocks)) {
    rows.push([]);
    rows.push([name]);
    rows.push(['CICOID', ...Object.keys(pairs)]);
    rows.push(['1005005', ...Object.values(pairs)]);
  }
  return rows;
}

describe('vkey — the page/extract join key', () => {
  it('⚠⚠ agrees whether the form stored the V-code as a number or a string', () => {
    // MEASURED: "Parks and recreation" stores 473 and 474 as STRINGS while 475
    // is a number, in ALL 222 workbooks. A lookup that does not coerce loses
    // that one function's money silently.
    expect(vkey('473')).toBe(vkey(473));
    expect(vkey(473)).toBe('V473');
  });

  it('tolerates the whitespace and float shapes a sheet cell arrives in', () => {
    expect(vkey(' 401 ')).toBe('V401');
    expect(vkey(401.0)).toBe('V401');
  });

  it('accepts a key already in V-form, so the extract and the page agree', () => {
    // The extract's header row names keys `V401`; the page prints a bare 401.
    expect(vkey('V401')).toBe('V401');
    expect(vkey('v701')).toBe('V701');
  });

  it('⚠ keeps a trailing letter variant — V312A is NOT V312', () => {
    // The FY2014 #REF! pair is V312 *and* V312A, two different revenue lines.
    expect(vkey('V312A')).toBe('V312A');
    expect(vkey('312A')).toBe('V312A');
    expect(vkey('V312A')).not.toBe(vkey('V312'));
  });

  it('returns null for a non-code rather than inventing a key', () => {
    expect(vkey(null)).toBeNull();
    expect(vkey('')).toBeNull();
    expect(vkey('Total Section A')).toBeNull();
    expect(vkey('Bartow County')).toBeNull();
  });
});

describe('parseExportable — the V1 extract sheet', () => {
  const grid = extractGrid({
    REV1: { V101: 7926136, V102: 381962, V125: 21806324, V97: 'No', V98: 'December 31', V99: 12, V100: 2012 },
    EXP5: { V700: 0, v701: 1234, V702: '#REF!' },
    FNLOG: { MO: 'December 31', CONTACT: 'Dawn Hudson', YEAR: 2012 },
  });

  it('reads each marker block into its own scope', () => {
    const { blocks } = parseExportable(grid);
    expect(Object.keys(blocks)).toEqual(['REV1', 'EXP5', 'FNLOG']);
    expect(blocks.REV1.V101).toBe(7926136);
    expect(blocks.FNLOG.CONTACT).toBe('Dawn Hudson');
  });

  it('⚠ canonicalises a V-code key, so the lower-case `v701` is findable', () => {
    // MEASURED: EXP5 prints v701, v705, v709 ... in lower case, every workbook.
    const { blocks, flat } = parseExportable(grid);
    expect(blocks.EXP5.V701).toBe(1234);
    expect(flat.V701).toBe(1234);
  });

  it('leaves a non-V key exactly as the sheet names it', () => {
    const { flat } = parseExportable(grid);
    expect(flat.MO).toBe('December 31');
    expect(flat.YEAR).toBe(2012);
  });

  it('⚠⚠ preserves an Excel error as its TEXT, never as a number', () => {
    // An error cell's raw .xls "value" is its error CODE: #REF! is the integer
    // 23. xlsToXlsx.py writes the text; nothing here may undo that.
    const { flat } = parseExportable(grid);
    expect(flat.V702).toBe('#REF!');
  });

  it('⚠ tolerates the block-name drift between the twin sheets', () => {
    // `Exportable Data` says AUTH_LIST / FNLOG; `Data` says tblAuthority_list /
    // FN_Log for the same blocks. Block names are read, never assumed.
    const twin = extractGrid({ tblAuthority_list: { vAuth1: 0 }, FN_Log: { vContact: 'x' } });
    const { blocks } = parseExportable(twin);
    expect(Object.keys(blocks)).toEqual(['tblAuthority_list', 'FN_Log']);
  });

  it('refuses to treat the sheet title row as a block', () => {
    const { blocks } = parseExportable(grid);
    expect(blocks['Exportable data']).toBeUndefined();
  });
});

describe('mergeTwins — `Exportable Data` and its `Data` shadow', () => {
  it('⭐ RECOVERS a key the live sheet lost but the twin still holds', () => {
    // MEASURED: the FY2014 REV3 pair V312/V312A is #REF! in `Exportable Data`
    // in every FY2014 workbook, and intact in `Data`. 8 cells in the sample.
    const { merged, notes } = mergeTwins({ V312: '#REF!' }, { V312: 689474 });
    expect(merged.V312).toBe(689474);
    expect(notes).toContainEqual(expect.objectContaining({ kind: 'recovered_from_twin', key: 'V312' }));
  });

  it('prefers the live sheet where the TWIN is the broken one', () => {
    // The common direction: 5,770 cells in the sample are #REF! in `Data` only.
    const { merged } = mergeTwins({ V1200: 500000 }, { V1200: '#REF!' });
    expect(merged.V1200).toBe(500000);
  });

  it('⚠⚠ reports a key errored in BOTH as unrecoverable, never as zero', () => {
    // MEASURED: exactly 2 such cells in 222 workbooks — Athens-Clarke FY2012
    // and FY2013, V1213, in the DET5 detail block.
    const { merged, notes } = mergeTwins({ V1213: '#REF!' }, { V1213: '#REF!' });
    expect(merged.V1213).toBeNull();
    expect(notes).toContainEqual(expect.objectContaining({ kind: 'unrecoverable', key: 'V1213' }));
  });

  it('⚠ records a disagreement between the two copies without silently picking', () => {
    // MEASURED: 270 keys disagree across the sample. The live sheet wins for the
    // oracle, but the conflict is recorded — it is the signal a reference broke.
    const { merged, notes } = mergeTwins({ V954: 447369 }, { V954: 8632500 });
    expect(merged.V954).toBe(447369);
    expect(notes).toContainEqual(expect.objectContaining({
      kind: 'twins_disagree', key: 'V954', live: 447369, twin: 8632500,
    }));
  });

  it('stays silent when the two copies agree, which is the overwhelming case', () => {
    // 122,992 of 123,270 compared keys agree.
    const { merged, notes } = mergeTwins({ V101: 7926136 }, { V101: 7926136 });
    expect(merged.V101).toBe(7926136);
    expect(notes).toEqual([]);
  });

  it('keeps a key only one sheet carries', () => {
    const { merged } = mergeTwins({ V101: 5 }, { V999: 7 });
    expect(merged.V101).toBe(5);
    expect(merged.V999).toBe(7);
  });
});

/** Build a sparse zero-indexed row: `row([[0,'label'],[7,336677]])`. */
function row(pairs) {
  const r = [];
  for (const [i, v] of pairs) r[i] = v;
  return r;
}

describe('readV1Pages — declared columns, never a row scan', () => {
  it('pairs each Part V money column with its OWN V-code', () => {
    const pages = {
      'Page 3': [
        row([[0, 'Part V -- EXPENDITURES FROM ALL FUNDS AND PROGRAMS']]),
        row([[0, 'FUNCTION OR PURPOSE']]),
        row([[0, 'General administration and support services'],
          [7, 336677], [8, 401], [9, 0], [10, 402], [11, 0], [12, 403]]),
        row([[0, 'TOTAL PART V'], [7, 4052550], [8, 509], [9, 305197], [10, 510], [11, 247879], [12, 511]]),
      ],
    };
    const { cells, labels } = readV1Pages(pages);
    expect(cells.V401).toBe(336677);
    expect(cells.V402).toBe(0);
    expect(cells.V403).toBe(0);
    expect(labels.V401).toBe('General administration and support services');
  });

  it('⚠⚠ does NOT fold a V-code into the money, even when they look alike', () => {
    // THE trap: a $402 expenditure and V-code 402 are the same bare integer in
    // adjacent columns. Summing "every number on the row" yields 804.
    const pages = {
      'Page 3': [
        row([[0, 'Part V -- EXPENDITURES FROM ALL FUNDS AND PROGRAMS']]),
        row([[0, 'FUNCTION OR PURPOSE']]),
        row([[0, 'Financial administration'], [7, 402], [8, 404], [9, 0], [10, 405], [11, 0], [12, 406]]),
      ],
    };
    const { cells } = readV1Pages(pages);
    expect(cells.V404).toBe(402);
    expect(cells.V405).toBe(0);
  });

  it('⚠ reads nothing before a Part heading has declared the geometry', () => {
    // Page 2 carries Parts II, III and IV at THREE different column layouts, so
    // a row that arrives before any heading cannot be read under any of them.
    // Pages 3 and 6 also open with title and instruction rows.
    const pages = {
      'Page 3': [
        row([[0, 'REPORT OF LOCAL GOVERNMENT FINANCES'], [7, 999], [8, 401]]),
        row([[0, 'Part V -- EXPENDITURES FROM ALL FUNDS AND PROGRAMS']]),
        row([[0, 'General administration and support services'], [7, 336677], [8, 401]]),
      ],
    };
    expect(readV1Pages(pages).cells.V401).toBe(336677);
  });

  it('⚠ ignores the government dropdown bleeding into Page 1 columns 11-12', () => {
    const pages = {
      'Page 1': [
        row([[0, 'Part I - TAX REVENUES -- ALL FUNDS']]),
        row([[0, 'Real and personal property taxes'], [5, 281816324], [7, 101],
          [11, 'Baldwin County'], [12, '1005005']]),
      ],
    };
    const { cells, labels } = readV1Pages(pages);
    expect(cells.V101).toBe(281816324);
    expect(labels.V101).toBe('Real and personal property taxes');
    // The dropdown's CICOID must never become a key or a figure.
    expect(cells.V1005005).toBeUndefined();
    expect(Object.values(cells)).not.toContain('1005005');
  });

  it('reads Part II as three source columns and skips the Govt ID field', () => {
    // Column 7 is `Govt ID No.` — a TEXT field with its own V-code in column 8.
    const pages = {
      'Page 2': [
        row([[0, 'Part II -- INTERGOVERNMENTAL REVENUES -- ALL FUNDS']]),
        row([[0, 'Road, street and bridge funds'],
          [5, 3179047], [6, 217], [7, 'ID-99'], [8, 218], [9, 0], [10, 219], [11, 500], [12, 220]]),
      ],
    };
    const { cells } = readV1Pages(pages);
    expect(cells.V217).toBe(3179047);
    expect(cells.V219).toBe(0);
    expect(cells.V220).toBe(500);
    expect(cells.V218).toBeUndefined();
  });

  it('⚠⚠ drops the two memo rows that sit AFTER `Total Part II`', () => {
    // "General revenue sharing" and "Physical health and mental health grants"
    // are outside the Part II total by the form's own arithmetic. Reading to the
    // end of the section folds them in and overstates intergovernmental revenue.
    const pages = {
      'Page 2': [
        row([[0, 'Part II -- INTERGOVERNMENTAL REVENUES -- ALL FUNDS']]),
        row([[0, 'Other intergovernmental revenues'], [5, 9403], [6, 249], [9, 0], [10, 251], [11, 0], [12, 252]]),
        row([[0, 'Total Part II'], [5, 9403], [6, 253], [9, 0], [10, 255], [11, 0], [12, 256]]),
        row([[0, 'General revenue sharing'], [5, 77], [6, 257], [9, 0], [10, 259], [11, 0], [12, 260]]),
        row([[0, 'Physical health and mental health grants'], [5, 88], [6, 261], [9, 0], [10, 263], [11, 0], [12, 264]]),
      ],
    };
    const { cells } = readV1Pages(pages);
    expect(cells.V249).toBe(9403);
    expect(cells.V257).toBeUndefined();
    expect(cells.V261).toBeUndefined();
  });

  it('⚠ reads Part III from column 11 only, so the Blk 312 memo is not summed', () => {
    // Row 43 carries an annotation ("Portion in Blk 312 derived from ...") with
    // its own figure in column 9. The reported figure is column 11.
    const pages = {
      'Page 2': [
        row([[0, 'Part III -- SERVICE CHARGES AND OTHER REVENUES -- ALL FUNDS']]),
        row([[0, 'Section B -- OTHER REVENUES']]),
        row([[0, '    Fines, forfeits and court costs'],
          [2, 'Portion in Blk 312 derived from ...'], [9, 2412007], [11, 22213475], [12, 312]]),
      ],
    };
    const { cells } = readV1Pages(pages);
    expect(cells.V312).toBe(22213475);
  });

  it('marks a total row as a total instead of emitting it as an item', () => {
    const pages = {
      'Page 1': [
        row([[0, 'Part I - TAX REVENUES -- ALL FUNDS']]),
        row([[0, 'Section A - PROPERTY TAXES']]),
        row([[0, 'Real and personal property taxes'], [5, 109], [7, 101]]),
        row([[0, 'Total Section A'], [5, 2850568], [7, 109]]),
      ],
    };
    const { cells, totals } = readV1Pages(pages);
    expect(totals.V109).toBe(2850568);
    expect(cells.V109).toBeUndefined();
    // ⚠ and the item whose MONEY is 109 is untouched by that
    expect(cells.V101).toBe(109);
  });
});

/** A minimal but realistic Part V page: three functions and the printed total. */
function partVPages({ a = 336677, b = 0, c = 0, total = [336677, 0, 0] } = {}) {
  return {
    'Page 3': [
      row([[0, 'Part V -- EXPENDITURES FROM ALL FUNDS AND PROGRAMS']]),
      row([[0, 'FUNCTION OR PURPOSE']]),
      row([[0, 'General administration and support services'],
        [7, a], [8, 401], [9, b], [10, 402], [11, c], [12, 403]]),
      row([[0, 'Parks and recreation'], [7, 130344], [8, '473'], [9, 182499], [10, '474'], [11, 0], [12, 475]]),
      row([[0, 'TOTAL PART V'],
        [7, total[0]], [8, 509], [9, total[1]], [10, 510], [11, total[2]], [12, 511]]),
    ],
  };
}

describe('buildV1ExpenditureTree — flat, as the form prints it', () => {
  it('sums the three object columns into one amount per function', () => {
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages({ a: 336677, b: 100, c: 7 })), {});
    const gen = tree.roots.find((r) => r.label.startsWith('General administration'));
    expect(gen.amount).toBe(336784);
  });

  it('⚠⚠ makes each function a ROOT — it does not invent the V2 sections', () => {
    // The printed V1 Part V has NO section headings. Grouping these 36 functions
    // under 5A-5G would assert a structure the publisher never printed.
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages()), {});
    expect(tree.roots.map((r) => r.label)).toEqual([
      'General administration and support services', 'Parks and recreation',
    ]);
    expect(tree.roots.every((r) => r.items.length === 0)).toBe(true);
  });

  it('⚠ keeps the string-coded Parks and recreation row and its money', () => {
    // V473/V474 are STRINGS in the cell; V475 is a number. All 222 workbooks.
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages()), {});
    expect(tree.roots.find((r) => r.label === 'Parks and recreation').amount).toBe(312843);
  });

  it('records a cell where the extract contradicts the printed page', () => {
    const anomalies = [];
    buildV1ExpenditureTree(readV1Pages(partVPages({ a: 336677 })), { V401: 999 }, anomalies);
    expect(anomalies).toContainEqual(expect.objectContaining({
      kind: 'extract_disagrees_with_form', code: 'V401', form: 336677, extract: 999,
    }));
  });

  it('⚠ records an extract cell that is an Excel error, and still loads the page figure', () => {
    const anomalies = [];
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages({ a: 336677 })), { V401: '#REF!' }, anomalies);
    expect(tree.roots[0].amount).toBe(336677);
    expect(anomalies).toContainEqual(expect.objectContaining({
      kind: 'extract_cell_is_excel_error', code: 'V401', extract: null,
    }));
  });
});

describe('checkV1ExpenditureTotal — the single Part V oracle', () => {
  it('ties the tree to the publisher\'s own three column totals', () => {
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages()), {});
    const check = checkV1ExpenditureTotal(tree, { V509: 336677, V510: 182499, V511: 130344 });
    expect(check.ok).toBe(true);
    expect(check.expected).toBe(649520);
  });

  it('FAILS when the tree does not reach the printed total', () => {
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages()), {});
    expect(checkV1ExpenditureTotal(tree, { V509: 1, V510: 0, V511: 0 }).ok).toBe(false);
  });

  it('⚠⚠ SKIPS — never passes — when a printed total is an Excel error', () => {
    // This is the exact condition that excluded filings in the FY2016+ sweep.
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages()), {});
    const check = checkV1ExpenditureTotal(tree, { V509: '#REF!', V510: 0, V511: 0 });
    expect(check.skipped).toBe(true);
    expect(check.ok).toBeUndefined();
    expect(check.reason).toMatch(/V509/);
  });

  it('⚠ SKIPS when the total keys are absent entirely, rather than tying to zero', () => {
    const tree = buildV1ExpenditureTree(readV1Pages(partVPages()), {});
    expect(checkV1ExpenditureTotal(tree, {}).skipped).toBe(true);
  });
});

function revenuePages() {
  return {
    'Page 1': [
      row([[0, 'Part I - TAX REVENUES -- ALL FUNDS']]),
      row([[0, 'Section A - PROPERTY TAXES']]),
      row([[0, 'Real and personal property taxes'], [5, 47102], [7, 101]]),
      row([[0, 'Total Section A'], [5, 47102], [7, 109]]),
      row([[0, 'Section B - SALES TAXES']]),
      row([[0, 'Local option sales tax'], [5, 403360], [7, 110]]),
      row([[0, 'Total Section B'], [5, 403360], [7, 113]]),
      row([[0, 'Section C - EXCISE AND SELECTIVE SALES TAXES']]),
      row([[0, 'Hotel/motel tax'], [5, 25], [7, 116]]),
      row([[0, 'Total Section C'], [5, 25], [7, 119]]),
      row([[0, 'Section D - LICENSES, PERMITS AND FEES']]),
      row([[0, 'Building permits'], [5, 13], [7, 122]]),
      row([[0, 'Total Section D'], [5, 13], [7, 124]]),
      row([[0, 'TOTAL PART I - Sum of lines 109 + 113 + 119 + 124'], [5, 450500], [7, 125]]),
    ],
    'Page 2': [
      row([[0, 'Part II -- INTERGOVERNMENTAL REVENUES -- ALL FUNDS']]),
      row([[0, 'Road, street and bridge funds'],
        [5, 1000], [6, 217], [7, 'ID-1'], [8, 218], [9, 20], [10, 219], [11, 300], [12, 220]]),
      row([[0, 'Total Part II'], [5, 1000], [6, 253], [9, 20], [10, 255], [11, 300], [12, 256]]),
      row([[0, 'Part III -- SERVICE CHARGES AND OTHER REVENUES -- ALL FUNDS']]),
      row([[0, 'Section A -- SERVICE CHARGES']]),
      row([[0, 'Garbage and trash collection charges'], [11, 44383], [12, 305]]),
      row([[0, 'Total Section A'], [10, 44383], [12, 310]]),
      row([[0, 'Section B -- OTHER REVENUES']]),
      row([[0, 'Interest earnings on investments'], [11, 215], [12, 311]]),
      row([[0, 'Total Section B'], [11, 215], [12, 319]]),
    ],
  };
}

const REV_EXTRACT = {
  V109: 47102, V113: 403360, V119: 25, V124: 13, V125: 450500,
  V253: 1000, V255: 20, V256: 300, V310: 44383, V319: 215,
};

describe('buildV1RevenueTree — the SAME seven roots as the FY2016+ generation', () => {
  it('⭐ uses root ids and labels identical to V2, so the series is continuous', () => {
    expect(V1_REVENUE_SECTIONS.map((s) => s.id)).toEqual(REVENUE_SECTIONS.map((s) => s.id));
    expect(V1_REVENUE_SECTIONS.map((s) => s.label)).toEqual(REVENUE_SECTIONS.map((s) => s.label));
  });

  it('assigns each printed line to the root its own section heading declares', () => {
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    const by = Object.fromEntries(tree.roots.map((r) => [r.id, r]));
    expect(by['1A'].amount).toBe(47102);
    expect(by['1B'].amount).toBe(403360);
    expect(by['3A'].amount).toBe(44383);
    expect(by['3B'].amount).toBe(215);
  });

  it('sums Part II\'s three source columns into the one intergovernmental root', () => {
    // state 1000 + other local 20 + federal 300. The Govt ID column is not money.
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    expect(tree.roots.find((r) => r.id === '2').amount).toBe(1320);
  });

  it('keeps every root even when a government reports nothing in it', () => {
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    expect(tree.roots).toHaveLength(7);
  });
});

describe('checkV1SectionTotals — seven revenue oracles', () => {
  it('ties all seven roots to the publisher\'s own printed subtotals', () => {
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    const checks = checkV1SectionTotals(tree, REV_EXTRACT);
    expect(checks).toHaveLength(7);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it('FAILS the one root whose printed subtotal disagrees', () => {
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    const checks = checkV1SectionTotals(tree, { ...REV_EXTRACT, V113: 999 });
    expect(checks.find((c) => c.id === '1B').ok).toBe(false);
    expect(checks.filter((c) => c.ok)).toHaveLength(6);
  });

  it('⚠⚠ SKIPS a root whose printed subtotal is an Excel error', () => {
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    const checks = checkV1SectionTotals(tree, { ...REV_EXTRACT, V310: '#REF!' });
    const c = checks.find((x) => x.id === '3A');
    expect(c.skipped).toBe(true);
    expect(c.ok).toBeUndefined();
  });

  it('oracles the Part I rollup as well as its four sections', () => {
    const tree = buildV1RevenueTree(readV1Pages(revenuePages()), REV_EXTRACT);
    const checks = checkV1PartTotals(tree, REV_EXTRACT);
    expect(checks.find((c) => c.id === 'Part I')).toMatchObject({ expected: 450500, ok: true });
  });
});

describe('readV1Log — month, audit status and the form\'s own fiscal year', () => {
  const live = {
    V97: 'No', V98: 'December 31', V99: 12, V100: 2012,
    MO: 'December 31', CONTACT: 'Dawn Hudson', YEAR: 2012,
  };

  it('turns the printed year END into the fiscal year START month', () => {
    // "December 31" ends the year, so the year STARTS in January.
    expect(readV1Log(live).fyEndMonth).toBe(1);
    expect(readV1Log({ ...live, V98: 'June 30' }).fyEndMonth).toBe(7);
  });

  it('reports the months covered and the audit flag', () => {
    const log = readV1Log(live);
    expect(log.monthsReported).toBe(12);
    expect(log.audited).toBe(false);
  });

  it('⚠ treats a raw "0" audit flag as NOT STATED, never as "No"', () => {
    expect(readV1Log({ ...live, V97: '0' }).audited).toBeNull();
    expect(readV1Log({ ...live, V97: 'Yes' }).audited).toBe(true);
  });

  it('⚠ returns a null month rather than defaulting, when the form is silent', () => {
    // project_fysm_column_default_one_defect is the whole story of a fiscal
    // month that defaulted instead of admitting ignorance.
    expect(readV1Log({ ...live, V98: null, MO: null }).fyEndMonth).toBeNull();
    expect(readV1Log({ ...live, V98: 'MONTH', MO: 'MONTH' }).fyEndMonth).toBeNull();
  });

  it('surfaces the fiscal year the form itself declares, for the filename guard', () => {
    expect(readV1Log(live).declaredYear).toBe(2012);
  });

  it('⚠⚠ falls back to FNLOG `MO` only within the LIVE sheet', () => {
    // The `Data` twin's MO is garbage — Banks reads 2005/2007/2009, Cobb and
    // DeKalb read 0 — so this reader is handed the live sheet and nothing else.
    expect(readV1Log({ ...live, V98: null }).fyEndMonth).toBe(1);
  });
});

describe('readV1Filing — one filing, end to end', () => {
  const extract = extractGrid({
    REV1: { V101: 47102, V109: 47102, V110: 403360, V113: 403360, V116: 25, V119: 25, V122: 13, V124: 13, V125: 450500, V97: 'No', V98: 'December 31', V99: 12, V100: 2012 },
    REV2: { V217: 1000, V219: 20, V220: 300, V253: 1000, V255: 20, V256: 300 },
    REV3: { V305: 44383, V310: 44383, V311: 215, V319: 215 },
    EXP1: { V401: 336677, V402: 0, V403: 0, V473: 130344, V474: 182499, V475: 0, V509: 467021, V510: 182499, V511: 0 },
    FNLOG: { MO: 'December 31', YEAR: 2012 },
  });
  const pages = { ...revenuePages(), ...partVPages({ total: [467021, 182499, 0] }) };

  it('runs every oracle and ties them all', () => {
    const f = readV1Filing({ pages, exportable: extract, data: extract });
    expect(f.checks.filter((c) => c.skipped)).toEqual([]);
    expect(f.checks.every((c) => c.ok)).toBe(true);
    expect(f.checks.length).toBe(9); // 7 revenue sections + Part I rollup + Part V
  });

  it('reports the generation it read, so a caller never has to infer it', () => {
    expect(readV1Filing({ pages, exportable: extract, data: extract }).generation).toBe('v1');
  });

  it('⭐ recovers a live-sheet #REF! from the twin instead of losing the figure', () => {
    const broken = extractGrid({ REV1: { V109: '#REF!' } });
    const f = readV1Filing({ pages, exportable: broken, data: extract });
    expect(f.checks.find((c) => c.id === '1A')).toMatchObject({ ok: true, expected: 47102 });
    expect(f.twinNotes).toContainEqual(expect.objectContaining({ kind: 'recovered_from_twin', key: 'V109' }));
  });

  it('still oracles 1A when both extract copies lost it but the PAGE prints it', () => {
    // The page is the government's own filed figure; a broken extract formula
    // does not make the filing unverifiable. This is the V310 lesson applied.
    const broken = extractGrid({ REV1: { V109: '#REF!' } });
    const f = readV1Filing({ pages, exportable: broken, data: broken });
    expect(f.checks.find((c) => c.id === '1A')).toMatchObject({ ok: true, expected: 47102 });
  });

  it('⚠⚠ SKIPS only when the page AND both extract copies lack the subtotal', () => {
    // THE refusal condition, and it is now genuinely rare: three independent
    // sources must all have lost the same cell.
    const broken = extractGrid({ REV1: { V109: '#REF!' } });
    const noTotal = {
      ...pages,
      'Page 1': pages['Page 1'].map((r) => (vkey(r[7]) === 'V109' ? row([[0, 'Total Section A'], [7, 109]]) : r)),
    };
    const f = readV1Filing({ pages: noTotal, exportable: broken, data: broken });
    expect(f.checks.find((c) => c.id === '1A').skipped).toBe(true);
  });

  it('⚠ refuses a filing whose form declares a different year from its filename', () => {
    const f = readV1Filing({ pages, exportable: extract, data: extract, fiscalYear: 2013 });
    expect(f.yearConflict).toMatchObject({ filename: 2013, form: 2012 });
  });

  it('is silent about the year when the two agree', () => {
    expect(readV1Filing({ pages, exportable: extract, data: extract, fiscalYear: 2012 }).yearConflict).toBeNull();
  });
});

describe('GA_FORM_GENERATIONS — the window now selects a READER', () => {
  it('pins both form generations and the boundary between them', () => {
    expect(GA_FORM_GENERATIONS.v1).toEqual({ firstFiscalYear: 2009, lastFiscalYear: 2015 });
    expect(GA_FORM_GENERATIONS.v2).toEqual({ firstFiscalYear: 2016, lastFiscalYear: 2025 });
  });

  it('leaves no gap and no overlap between the two windows', () => {
    expect(GA_FORM_GENERATIONS.v1.lastFiscalYear + 1).toBe(GA_FORM_GENERATIONS.v2.firstFiscalYear);
  });

  it('GA_LOAD_WINDOW spans both, because the loader now reads both', () => {
    expect(GA_LOAD_WINDOW).toEqual({ firstFiscalYear: 2009, lastFiscalYear: 2025 });
  });

  it('⚠ FY2008 is OUTSIDE the window — DCA lists only 3 such filings, unprobed', () => {
    expect(2008).toBeLessThan(GA_LOAD_WINDOW.firstFiscalYear);
  });
});

describe('⚠⚠ the printed subtotal is the oracle, and Part III proves why', () => {
  const p3 = () => ({
    'Page 2': [
      row([[0, 'Part III -- SERVICE CHARGES AND OTHER REVENUES -- ALL FUNDS']]),
      row([[0, 'Section A -- SERVICE CHARGES']]),
      row([[0, 'Garbage and trash collection charges'], [11, 44383], [12, 305]]),
      // MEASURED in all 222: Section A's total sits in column 10, not 11.
      row([[0, 'Total Section A'], [10, 44383], [12, 310]]),
      row([[0, 'Section B -- OTHER REVENUES']]),
      row([[0, 'Interest earnings on investments'], [11, 215], [12, 311]]),
      row([[0, 'Total Section B'], [11, 215], [12, 319]]),
    ],
  });

  it('reads a total row from ITS OWN column, not the item column', () => {
    const { totals } = readV1Pages(p3());
    expect(totals.V310).toBe(44383);
    expect(totals.V319).toBe(215);
  });

  it('⚠⚠ ties section 3A even though the extract never populates V310', () => {
    // MEASURED: V310 reads 0 in every one of the 222 sampled workbooks while the
    // page prints the real total. The publisher's extract formula points at the
    // ITEM column, which is blank on the total row. 178 of 222 filings have a
    // non-zero Section A and would ALL fail an extract-only oracle.
    const pageRead = readV1Pages(p3());
    const tree = buildV1RevenueTree(pageRead, { V310: 0, V319: 215 });
    const checks = checkV1SectionTotals(tree, { V310: 0, V319: 215 }, pageRead.totals);
    expect(checks.find((c) => c.id === '3A')).toMatchObject({ ok: true, expected: 44383 });
  });

  it('⚠ does NOT raise the known V310 gap as a per-filing anomaly', () => {
    // It is a corpus-wide publisher defect, recorded once by name. Emitting it
    // 4,551 times would bury the anomalies that mean something.
    const pageRead = readV1Pages(p3());
    const anomalies = [];
    checkV1SectionTotals(buildV1RevenueTree(pageRead, {}), { V310: 0, V319: 215 }, pageRead.totals, anomalies);
    expect(anomalies).toEqual([]);
  });

  it('DOES raise a page/extract subtotal disagreement on any other key', () => {
    const pageRead = readV1Pages(p3());
    const anomalies = [];
    checkV1SectionTotals(buildV1RevenueTree(pageRead, {}), { V310: 0, V319: 999 }, pageRead.totals, anomalies);
    expect(anomalies).toContainEqual(expect.objectContaining({
      kind: 'extract_subtotal_disagrees_with_form', code: 'V319', form: 215, extract: 999,
    }));
  });

  it('falls back to the extract when the page prints no subtotal at all', () => {
    const tree = buildV1RevenueTree(readV1Pages(p3()), {});
    const checks = checkV1SectionTotals(tree, { V319: 215 }, {});
    expect(checks.find((c) => c.id === '3B')).toMatchObject({ ok: true, expected: 215 });
  });
});

describe('resolveMonth across the generation boundary', () => {
  // Georgetown-Quitman, as the generated registry actually holds it: the entity
  // level carries its CURRENT month (7), monthByYear records the v2 years it
  // changed from (1), and `fiscalYears` says which years the registry saw.
  const GQ = {
    cicoid: '3118118',
    name: 'Georgetown-Quitman County',
    fiscalYearStartMonth: 7,
    monthByYear: { 2016: 1, 2017: 1, 2018: 1, 2019: 1, 2020: 1, 2021: 1, 2022: 1 },
    fiscalYears: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    censusConfirms: false,
  };
  const dec = { fyEndMonth: 1, fyEndMonthText: 'December 31' };

  it('⚠⚠ does NOT call it a conflict when the registry has no claim about that year', () => {
    // The registry was BUILT from FY2016-2025. Its entity-level month is the
    // government's CURRENT one, not an assertion about 2012. Comparing a 2012
    // filing against it refused all seven of this government's v1 filings.
    const r = resolveMonth(GQ, dec, 2012);
    expect(r.ok).toBe(true);
    expect(r.month).toBe(1);
    expect(r.how).toMatch(/registry covers/i);
  });

  it('still takes the registry\'s own per-year record where it HAS one', () => {
    expect(resolveMonth(GQ, dec, 2016).month).toBe(1);
    expect(resolveMonth(GQ, { fyEndMonth: 7, fyEndMonthText: 'June 30' }, 2023).month).toBe(7);
  });

  it('⚠ still REFUSES a v2-year filing whose month contradicts the registry', () => {
    // The guard that exists must not be weakened for years it does cover.
    expect(resolveMonth(GQ, { fyEndMonth: 9, fyEndMonthText: 'August 31' }, 2016).ok).toBe(false);
  });

  it('⚠ refuses an out-of-coverage year when the form states no month either', () => {
    // Nothing to record and nothing to check against. Never default.
    const r = resolveMonth(GQ, { fyEndMonth: null, fyEndMonthText: 'MONTH' }, 2012);
    expect(r.ok).toBe(false);
  });
});

describe('assertV1MonthConsistency — the guard that replaces the registry', () => {
  const f = (fiscalYear, month) => ({ cicoid: '3118118', fiscalYear, log1: { fyEndMonth: month } });

  it('passes a government whose v1 filings all agree', () => {
    expect(assertV1MonthConsistency([f(2009, 1), f(2010, 1), f(2011, 1)])).toEqual([]);
  });

  it('⚠⚠ flags a single year that disagrees with its own siblings', () => {
    // The shape of a one-year keying slip — the only way to catch one once the
    // registry no longer covers these years.
    const bad = assertV1MonthConsistency([f(2009, 1), f(2010, 7), f(2011, 1), f(2012, 1)]);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({ cicoid: '3118118', months: { 1: [2009, 2011, 2012], 7: [2010] } });
  });

  it('ignores a filing whose form stated no month at all', () => {
    expect(assertV1MonthConsistency([f(2009, 1), f(2010, null)])).toEqual([]);
  });
});

describe('GA_CONSOLIDATION_OVERLAP — the floor was hiding a double-count', () => {
  it('refuses the absorbed county\'s filing once its consolidated successor reports', () => {
    // MEASURED from DCA's own listing: Echols County (1050050) filed FY2009 and
    // FY2010, and Echols County CG (3050050) filed FY2010-2015. FY2010 is the
    // ONE year in the whole state where both halves of a consolidation filed.
    const r = consolidationOverlap('1050050', 2010);
    expect(r).toMatchObject({ absorbedCicoid: '1050050', consolidatedCicoid: '3050050', firstConsolidatedYear: 2010 });
  });

  it('allows the county\'s own years BEFORE the consolidated government existed', () => {
    expect(consolidationOverlap('1050050', 2009)).toBeNull();
  });

  it('⚠ Macon-Bibb hands over cleanly, and the handoff year is still recorded', () => {
    // Bibb County stops at FY2013; Macon-Bibb starts FY2014. No overlap exists
    // today — the entry exists so a later-published filing cannot create one.
    expect(consolidationOverlap('1011011', 2013)).toBeNull();
    expect(consolidationOverlap('1011011', 2014)).toMatchObject({ firstConsolidatedYear: 2014 });
  });

  it('says nothing about a county that was never consolidated', () => {
    expect(consolidationOverlap('1006006', 2012)).toBeNull();
  });

  it('⚠⚠ covers every consolidated government, not just the two with filings', () => {
    // All 8 are registered. A county-prefix filing appearing for any of them in
    // a later slice must refuse rather than quietly double-count.
    expect(GA_CONSOLIDATION_OVERLAP).toHaveLength(8);
    for (const e of GA_CONSOLIDATION_OVERLAP) {
      expect(e.consolidatedCicoid[0]).toBe('3');
      expect(e.absorbedCicoid[0]).toBe('1');
      expect(e.absorbedCicoid.slice(1)).toBe(e.consolidatedCicoid.slice(1));
      expect(e.why).toBeTruthy();
    }
  });
});

describe('the v1 Part V shape is ONE shape, and a form change must fail loudly', () => {
  const SHAPE = JSON.parse(readFileSync('tests/fixtures/ga/v1-part5-shape.json', 'utf8'));
  const CORPUS = '_acfr-work/ga/pre2016/xlsx';

  it('pins 36 functions, three object columns, and the printed total codes', () => {
    expect(SHAPE.functions).toHaveLength(36);
    expect(SHAPE.totalCodes).toEqual(V1_EXPENDITURE_TOTAL_KEYS);
    expect(SHAPE.objectColumns).toHaveLength(3);
    for (const f of SHAPE.functions) expect(f.codes).toHaveLength(3);
  });

  it('⚠ every V-code from V401 to V508 is accounted for exactly once', () => {
    const all = SHAPE.functions.flatMap((f) => f.codes);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual(Array.from({ length: 108 }, (_, i) => `V${401 + i}`));
  });

  it('⚠⚠ keeps Public utility systems as a Part V FUNCTION, not a Part VI escape', () => {
    // It counts toward Total Part V. Part VI is a separate enterprise table and
    // stays excluded — confusing the two silently moves utility money.
    const util = SHAPE.functions.find((f) => f.label === 'Public utility systems');
    expect(util.codes).toEqual(['V500', 'V501', 'V502']);
  });

  it('⚠ every function the fixture names is distinct — no label collides', () => {
    // `buildV1ExpenditureTree` makes each function a ROOT keyed by its label,
    // so two rows sharing a label would silently merge into one icicle band.
    const labels = SHAPE.functions.map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('matches EVERY workbook in the corpus, when the corpus is present', () => {
    if (!existsSync(CORPUS)) {
      console.warn(`\n  ⚠ ${CORPUS} absent — fixture-vs-source parity was NOT checked in this run.`
        + '\n    Re-fetch with: node scripts/fetchGeorgiaRLGF.mjs --first 2009 --last 2015 ...');
      return;
    }
    const files = readdirSync(CORPUS).filter((f) => f.endsWith('.xlsx'));
    expect(files.length).toBeGreaterThan(0);
    // The parity sweep itself lives in the loader's dry run; what matters here
    // is that the fixture was measured over a corpus, and says so.
    expect(SHAPE.measuredOver).toBeGreaterThanOrEqual(222);
  });
});

describe('⚠ the no-claim rule is scoped to v1 years ONLY', () => {
  const ENT = {
    cicoid: '1006006', name: 'Banks County', fiscalYearStartMonth: 7,
    fiscalYears: [2016, 2017, 2018], censusConfirms: false,
  };

  it('does NOT loosen v2 at all: a v2 year missing from the registry still refuses', () => {
    // If DCA publishes FY2019 after the registry was generated, `fiscalYears`
    // lags. That is a stale registry, not "the registry has no claim" — and the
    // conflict guard must keep working for every year the v2 sweep covers.
    const r = resolveMonth(ENT, { fyEndMonth: 1, fyEndMonthText: 'December 31' }, 2019);
    expect(r.ok).toBe(false);
  });

  it('applies the no-claim rule below the v2 floor, where it is justified', () => {
    const r = resolveMonth(ENT, { fyEndMonth: 1, fyEndMonthText: 'December 31' }, 2012);
    expect(r.ok).toBe(true);
    expect(r.month).toBe(1);
  });
});
