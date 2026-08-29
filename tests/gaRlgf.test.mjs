import { describe, it, expect } from 'vitest';
import {
  parseCodeCell, parseLoad1, num, isErrorValue, hasNumber, aliasBareCodes,
  buildExpenditureTree, buildRevenueTree, checkSectionTotals, checkPartTotals,
  readLog1, monthFromEndText, scopedLookup, readPageValues,
  EXPENDITURE_SECTIONS, REVENUE_SECTIONS, OBJECT_COLUMNS,
} from '../scripts/lib/gaRlgf.mjs';
import { parseFilename, auditBranch, sourceNameFor, resolveMonth } from '../scripts/loadGeorgiaRLGF.mjs';
import { GA_KNIGHT_ENTITIES, entityByCicoid } from '../scripts/data/georgiaKnightEntities.mjs';

describe('parseCodeCell', () => {
  it('reads a plain UCOA code', () => {
    expect(parseCodeCell('31.1100')).toBe('31_1100');
    expect(parseCodeCell('34.1100 - Include 34.1110 - 34.1200 in Amount')).toBe('34_1100');
  });

  it('keeps the suffix that disambiguates a repeated code', () => {
    // 31.3900 labels three different taxes; only the suffix separates them.
    expect(parseCodeCell('31.3900C')).toBe('31_3900C');
    expect(parseCodeCell('31.4300A')).toBe('31_4300A');
  });

  it('⚠ prefers the FORMER code, because that is what LOAD1 keys on', () => {
    // Taking the leading (current) code orphans the line and its money:
    // 31_3900A exists in LOAD1, 31_3500 does not.
    expect(parseCodeCell('31.3500 - Formerly 31.3900A')).toBe('31_3900A');
    expect(parseCodeCell('31.4250 - Formerly 31.4200B')).toBe('31_4200B');
  });

  it('reads a bare expenditure function code, separators and all', () => {
    expect(parseCodeCell('3300')).toBe('3300');
    // The code column is NUMERIC on Pages 3-4 and renders with a thousands separator.
    expect(parseCodeCell('4,510')).toBe('4510');
    expect(parseCodeCell(4400)).toBe('4400');
  });

  it('returns null for the placeholder and for non-codes', () => {
    // Six Part II lines print this instead of a code.
    expect(parseCodeCell('33.XXXX')).toBeNull();
    expect(parseCodeCell('')).toBeNull();
    expect(parseCodeCell('Total Section 1A')).toBeNull();
  });
});

describe('Excel error cells', () => {
  it('recognises the error text the converter writes', () => {
    expect(isErrorValue('#REF!')).toBe(true);
    expect(isErrorValue('#DIV/0!')).toBe(true);
    expect(isErrorValue('#N/A')).toBe(true);
    expect(isErrorValue('anything else')).toBe(false);
  });

  it('⚠⚠ never treats the error CODE as data', () => {
    // In the raw .xls an error cell's value IS its code: #REF! is 23, #DIV/0! is
    // 7, #VALUE! is 15, #N/A is 42 — all small, plausible dollar amounts. The
    // converter must have turned them into text before this point.
    expect(isErrorValue(23)).toBe(false);
    expect(num(23)).toBe(23);
  });

  it('propagates loudly rather than passing as zero', () => {
    // A silent 0 would quietly shrink a total; NaN cannot hide.
    expect(num('#REF!')).toBeNaN();
    expect(num('')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num('1,234.50')).toBe(1234.5);
  });

  it('hasNumber distinguishes "present" from "present but broken"', () => {
    const scope = { good: 5, broken: '#REF!' };
    expect('broken' in scope).toBe(true); // the key exists...
    expect(hasNumber(scope, 'broken')).toBe(false); // ...but carries no value
    expect(hasNumber(scope, 'good')).toBe(true);
  });
});

describe('parseLoad1 block scoping', () => {
  const rows = [
    ['_E3'], ['CICOID', 'Fyear', '3200A'], ['3011011', 2023, 111],
    ['_E9'], ['CICOID', 'Fyear', '3200A'], ['3011011', 2023, 999],
  ];

  it('keeps blocks separate', () => {
    const { blocks } = parseLoad1(rows);
    expect(blocks._E3['3200A']).toBe(111);
    expect(blocks._E9['3200A']).toBe(999);
  });

  it('⚠⚠ scoping to a block is what stops Part X overwriting Part V', () => {
    // _E9 (Part X intergovernmental expenditures) reuses Part V function codes.
    // Flattening every block into one map let Part X win and read Macon-Bibb
    // FY2023 as $153.8M against the form's own $256.3M.
    const { blocks } = parseLoad1(rows);
    expect(scopedLookup(blocks, ['_E3'])['3200A']).toBe(111);
    expect(scopedLookup(blocks, ['_E9'])['3200A']).toBe(999);
  });
});

describe('aliasBareCodes', () => {
  it('maps a bare printed code onto the suffixed key LOAD1 uses', () => {
    // Beer & Wine prints as `31.4200`; LOAD1 keys it `31_4200A`. Without the
    // alias the line matches nothing and its money silently disappears.
    const values = { '31_4200': 458391.85 };
    aliasBareCodes(values, new Set(['31_4200A', '31_4200B']));
    expect(values['31_4200A']).toBe(458391.85);
  });

  it('leaves a bare code alone when it is itself a real key', () => {
    const values = { '34_1100': 10 };
    aliasBareCodes(values, new Set(['34_1100', '34_1100A']));
    expect(values['34_1100A']).toBeUndefined();
  });

  it('does not clobber an A row the page printed itself', () => {
    const values = { '31_4300': 1, '31_4300A': 2 };
    aliasBareCodes(values, new Set(['31_4300A']));
    expect(values['31_4300A']).toBe(2);
  });
});

describe('tree building and the oracle', () => {
  // One section, two functions, with the form's own subtotals.
  const blocks = {
    _E1: {
      '1100A': 100, '1100B': 10, '1100C': 0, '1100D': 0,
      '1300A': 200, '1300B': 0, '1300C': 5, '1300D': 0,
      TTL_5A_A: 300, TTL_5A_B: 10, TTL_5A_C: 5, TTL_5A_D: 0,
    },
  };
  const labels = { 1100: 'Administration Support - Legislative', 1300: 'Administration Support - Executive' };

  it('sums the four object columns into one function', () => {
    const tree = buildExpenditureTree(blocks, labels, {});
    const ga = tree.roots.find((r) => r.id === '5A');
    expect(ga.items.find((i) => i.code === '1100').amount).toBe(110);
    expect(ga.amount).toBe(315);
  });

  it('ties each root to the publisher\'s own printed subtotal', () => {
    const tree = buildExpenditureTree(blocks, labels, {});
    const check = checkSectionTotals(tree, blocks, EXPENDITURE_SECTIONS).find((c) => c.id === '5A');
    expect(check.ok).toBe(true);
    expect(check.expected).toBe(315);
  });

  it('prefers the printed form over the extract, and records the disagreement', () => {
    const anomalies = [];
    const tree = buildExpenditureTree(blocks, labels, { 1100: 999 }, anomalies);
    const ga = tree.roots.find((r) => r.id === '5A');
    expect(ga.items.find((i) => i.code === '1100').amount).toBe(999);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ code: '1100', form: 999, extract: 110 });
  });

  it('⚠ reports a section SKIPPED when its subtotal cell is an Excel error', () => {
    // Never a silent pass: an unrunnable oracle is louder than a passing one.
    const broken = { _E1: { ...blocks._E1, TTL_5A_A: '#REF!' } };
    const tree = buildExpenditureTree(broken, labels, {});
    const check = checkSectionTotals(tree, broken, EXPENDITURE_SECTIONS).find((c) => c.id === '5A');
    expect(check.skipped).toBe(true);
    expect(check.reason).toMatch(/error cell/);
  });

  it('treats an error line-item cell as absent so the form is used', () => {
    const broken = { _E1: { ...blocks._E1, '1100A': '#REF!' } };
    const anomalies = [];
    const tree = buildExpenditureTree(broken, labels, { 1100: 110 }, anomalies);
    expect(tree.roots.find((r) => r.id === '5A').items.find((i) => i.code === '1100').amount).toBe(110);
    expect(anomalies[0].kind).toBe('extract_cell_is_excel_error');
    expect(anomalies[0].extract).toBeNull();
  });
});

describe('checkPartTotals', () => {
  it('⚠ Own Source Revenues is Part I + Part III only, never the grand total', () => {
    // Treating TTL_OSR as total revenue would drop every entity's state and
    // federal money.
    const tree = { roots: [
      { id: '1A', amount: 100 }, { id: '1B', amount: 0 }, { id: '1C', amount: 0 }, { id: '1D', amount: 0 },
      { id: '2', amount: 50 }, { id: '3A', amount: 20 }, { id: '3B', amount: 0 },
    ] };
    const blocks = { _R1: { TTL_Part1: 100 }, _R3: { TTL_Part3: 20, TTL_OSR: 120 } };
    const checks = checkPartTotals(tree, blocks);
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(checks.find((c) => c.id === 'Own Source (I+III)').expected).toBe(120);
  });
});

describe('fiscal calendar', () => {
  it('converts a printed year END into a start month', () => {
    expect(monthFromEndText('June 30')).toBe(7);
    expect(monthFromEndText('December 31')).toBe(1);
    expect(monthFromEndText('September 30')).toBe(10);
  });

  it('⚠ refuses the unfilled placeholder rather than defaulting', () => {
    // Baldwin FY2020 prints the literal string "MONTH".
    expect(monthFromEndText('MONTH')).toBeNull();
    expect(monthFromEndText('')).toBeNull();
  });

  it('falls back to the registry when the form says nothing, and says so', () => {
    const baldwin = GA_KNIGHT_ENTITIES.find((e) => e.key === 'baldwin-county');
    const r = resolveMonth(baldwin, { fyEndMonth: null, fyEndMonthText: 'MONTH' });
    expect(r.month).toBe(1);
    expect(r.how).toMatch(/registry only/);
  });

  it('refuses when the form and the registry disagree', () => {
    const baldwin = GA_KNIGHT_ENTITIES.find((e) => e.key === 'baldwin-county');
    const r = resolveMonth(baldwin, { fyEndMonth: 7, fyEndMonthText: 'June 30' });
    expect(r.ok).toBe(false);
    expect(r.month).toBeNull();
  });

  it('⚠ Georgia is not a uniform-month state', () => {
    const months = new Set(GA_KNIGHT_ENTITIES.map((e) => e.fiscalYearStartMonth));
    expect(months).toEqual(new Set([1, 7]));
  });
});

describe('readLog1', () => {
  it('parses the audited flag case-insensitively', () => {
    expect(readLog1({ Audited: 'YES' }).audited).toBe(true);
    expect(readLog1({ Audited: 'Yes' }).audited).toBe(true);
    expect(readLog1({ Audited: 'NO' }).audited).toBe(false);
    expect(readLog1({ Audited: 'No' }).audited).toBe(false);
  });

  it('⚠⚠ never coerces a blank to "No"', () => {
    // Macon-Bibb FY2019/FY2020 and Baldwin FY2019 leave it unanswered. An early
    // label-scraping pass read one of these as NO by scanning the row.
    expect(readLog1({ Audited: 0 }).audited).toBeNull();
    expect(readLog1({ Audited: '' }).audited).toBeNull();
    expect(readLog1({}).audited).toBeNull();
  });
});

describe('loader identity and naming', () => {
  it('⚠ refuses a non-numeric fiscal year', () => {
    // DCA's own listing serves 2005001_YEAR_RLGF_Milledgeville.xls.
    expect(parseFilename('2005001_YEAR_RLGF_Milledgeville.xlsx')).toBeNull();
    expect(parseFilename('3011011_2023_RLGF_Macon-Bibb.xlsx')).toMatchObject({
      cicoid: '3011011', fiscalYear: 2023,
    });
  });

  it('records the audit branch in the source string, all three states', () => {
    expect(auditBranch(true)).toBe('preparer-certified audited');
    expect(auditBranch(false)).toBe('self-reported');
    expect(auditBranch(null)).toBe('audit status not stated');
    expect(sourceNameFor('operating', 2023, false))
      .toBe('Georgia DCA Report of Local Government Finances — Expenditure by Function (FY2023 actual, self-reported)');
  });

  it('⚠⚠ resolves entities by CICOID, never by name', () => {
    // The dropdown holds Macon County, Bibb City, Baldwin City and Macon City —
    // all different governments from the four loaded here.
    expect(entityByCicoid('3011011').name).toBe('Macon-Bibb County');
    expect(entityByCicoid('1005005').name).toBe('Baldwin County');
    expect(entityByCicoid('1096096')).toBeNull(); // Macon County is not in scope
  });

  it('types both consolidated governments as one entity each', () => {
    const consolidated = GA_KNIGHT_ENTITIES.filter((e) => e.cicoid.startsWith('3'));
    expect(consolidated).toHaveLength(2);
    for (const e of consolidated) expect(e.entityType).toBe('county');
  });

  it('⚠ does not claim census confirmation it does not have', () => {
    // Columbus-Muscogee has no FAC row at all; Macon-Bibb only pre-consolidation.
    expect(entityByCicoid('3106002').censusConfirms).toBe(false);
    expect(entityByCicoid('3011011').censusConfirms).toBe(false);
    expect(entityByCicoid('2005001').censusConfirms).toBe(true);
  });
});

describe('readPageValues', () => {
  it('⚠⚠ never folds the numeric UCOA code into the money', () => {
    // On Pages 3-4 the code column is numeric. Summing every number on the row
    // would add 3300 to the Sheriff's Office expenditure.
    const pages = { 'Page 3': [['Sheriff\'s Office', 3300, 26730246, 1168871, 3060494, 0]] };
    const { values } = readPageValues(pages);
    expect(values['3300']).toBe(26730246 + 1168871 + 3060494);
  });

  it('resets the section tracker at a Part boundary', () => {
    // Without the reset, Part IV enterprise lines are labelled as Part III
    // governmental revenue.
    const pages = { 'Page 2': [
      ['Part III -- SERVICE CHARGES'], ['Section B -- OTHER REVENUES'],
      ['Rents and Royalties', '', '', '', '', '38.1000', '', '', '', 2403817],
      ['Part IV -- REVENUES FROM PUBLIC UTILITY SYSTEMS'],
      ['Water Charges', '', '', '', '', '34.4210', '', 500, '', ''],
    ] };
    const { values } = readPageValues(pages);
    expect(values['38_1000']).toBe(2403817); // Part III column 9
    expect(values['34_4210']).toBe(500);     // Part IV column 7
  });
});
