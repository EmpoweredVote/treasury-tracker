import { describe, it, expect } from 'vitest';

import {
  FUND_GROUPS, GOVERNMENTAL_FUNDS, ORACLE_FUNDS,
  EXCLUDED_OBJECT_CODE, EXCLUDED_REVENUE_ACCOUNT_RE,
  cellNum, cellText, readHeaders, readDetailRows, readTotalsRows, readComplianceRows,
  mergeCompliance, assertParsed, accountCode, objectCodeOf,
  isTransferObject, isTransferRevenueAccount,
  buildExpenditureTree, buildRevenueTree, oracleTotalFor, hasAuditOnFile,
} from '../scripts/lib/floridaDfs.mjs';
import { sourceNameFor, SOURCE_PREFIX } from '../scripts/loadFloridaDFS.mjs';
import { FL_ENTITIES, entityByCode } from '../scripts/data/floridaKnightEntities.mjs';
import { AUDIT_GRADE_REGISTRY, gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';

/**
 * A minimal stand-in for an ExcelJS worksheet.
 *
 * ⚠ `getCell()` returns a CELL OBJECT with a `.value`, exactly as ExcelJS does,
 * because that distinction is what the first version of this loader got wrong:
 * an ExcelJS Cell carries a `result` property (undefined unless the cell holds a
 * formula), so `'result' in cell` is true for every cell and the value reads as
 * undefined. 30,189 real rows parsed to zero. A stub that returned bare values
 * would not have caught it, so this one does not.
 */
function sheet(rows) {
  const grid = [null, ...rows]; // 1-indexed
  return {
    rowCount: rows.length,
    getRow(n) {
      const r = grid[n] || [];
      return {
        getCell(c) { return { value: r[c - 1] ?? null, result: undefined }; },
        eachCell(opts, cb) {
          r.forEach((v, i) => {
            if (opts?.includeEmpty === false && (v === null || v === undefined || v === '')) return;
            cb({ value: v, result: undefined }, i + 1);
          });
        },
      };
    },
  };
}

const FUND_HEADERS = [
  'General', 'Special Revenue', 'Debt Service', 'Capital Projects', 'Permanent ',
  'Enterprise  ', 'Internal Service', 'Custodial', 'Pension', 'Trust',
  'Private Purpose', 'Component Units',
];

/** Rows shaped like the real EXPENDITUREDETAILREPORT. */
function expenditureSheet(dataRows) {
  return sheet([
    ['Expenditure Details for Fiscal Year 2023, as of ...'],
    [],
    ['Code', 'Name', 'Account', 'Object Code', ...FUND_HEADERS],
    ...dataRows,
  ]);
}
function revenueSheet(dataRows) {
  return sheet([
    ['Revenue Details for Fiscal Year 2023, as of ...'],
    [],
    ['Code', 'Name', 'Account', 'Dwelling Type', 'Fee Type', ...FUND_HEADERS],
    ...dataRows,
  ]);
}
/** [General, SpecialRevenue, DebtService, CapitalProjects, Permanent, Enterprise, ...] */
const funds = (general = 0, enterprise = 0, custodial = 0) =>
  [general, '', '', '', '', enterprise, '', custodial, '', '', '', ''];

describe('Florida DFS — cell coercion', () => {
  it('reads numbers, blanks and formula results', () => {
    expect(cellNum(116858)).toBe(116858);
    expect(cellNum('')).toBeNull();
    expect(cellNum(null)).toBeNull();
    expect(cellNum({ result: 42 })).toBe(42);
    expect(cellNum('1,234')).toBe(1234);
    expect(cellNum('not a number')).toBeNull();
  });

  it('trims text and never returns null', () => {
    expect(cellText('  Permanent ')).toBe('Permanent');
    expect(cellText(null)).toBe('');
    expect(cellText({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab');
  });
});

describe('Florida DFS — the workbook layout', () => {
  it('TRIMS fund headers, because three of them ship with trailing spaces', () => {
    // "Permanent ", "Enterprise  " and "Private Purpose " are published with
    // trailing whitespace. Matching the raw string finds nothing, every fund
    // reads as zero, and the result ties at $0 against nothing at all.
    const headers = readHeaders(expenditureSheet([]));
    expect(headers.get('Permanent')).toBeDefined();
    expect(headers.get('Enterprise')).toBeDefined();
    expect(headers.get('Permanent ')).toBeUndefined();
  });

  it('refuses a sheet that is missing a fund column rather than summing what is left', () => {
    const broken = sheet([
      ['title'], [], ['Code', 'Name', 'Account', 'Object Code', 'General', 'Special Revenue'],
      ['200239', 'Miami', '511.00 - Legislative', '10 - Personnel Services', 1, 2],
    ]);
    expect(() => readDetailRows(broken)).toThrow(/Expected 12 fund columns/);
  });

  it('treats a zero-row parse as broken, never as an empty year', () => {
    // The failure this pins actually happened: readDetailRows returned nothing,
    // the verifier reported all seven entities "not filed", counted zero checks
    // and printed "Oracle green". A gate that passes because it measured nothing
    // is the CA-county censusGuard() shape.
    expect(() => assertParsed([], 'EXPENDITUREDETAILREPORT FY2023')).toThrow(/parsed 0 data rows/);
    expect(() => assertParsed(null, 'x')).toThrow();
    expect(assertParsed([{ code: '1' }], 'x')).toHaveLength(1);
  });
});

describe('Florida DFS — fund groups', () => {
  it('loads the five governmental funds and nothing else', () => {
    expect(GOVERNMENTAL_FUNDS).toEqual(
      ['General', 'Special Revenue', 'Debt Service', 'Capital Projects', 'Permanent'],
    );
  });

  it('oracles against every fund EXCEPT the four fiduciary ones', () => {
    // Solved, not assumed: this is the only subset of the twelve columns that
    // reproduces DFS's own published TOTALREVEXPDEBT figures.
    expect(ORACLE_FUNDS).toHaveLength(8);
    for (const f of FUND_GROUPS.fiduciary) expect(ORACLE_FUNDS).not.toContain(f);
    for (const f of FUND_GROUPS.governmental) expect(ORACLE_FUNDS).toContain(f);
    for (const f of FUND_GROUPS.proprietary) expect(ORACLE_FUNDS).toContain(f);
    expect(ORACLE_FUNDS).toContain('Component Units');
  });

  it('never lets a governmental total include enterprise or fiduciary money', () => {
    const rows = readDetailRows(expenditureSheet([
      ['200239', 'Miami', '511.00 - Legislative', '10 - Personnel Services', ...funds(100, 900, 50)],
    ]));
    const { total } = buildExpenditureTree(rows, '200239');
    expect(total).toBe(100);
    // ...while the oracle sees the enterprise column but still not the fiduciary one.
    expect(oracleTotalFor(rows, '200239')).toBe(1000);
  });
});

describe('Florida DFS — object code 90 is a transfer, not an expenditure', () => {
  it('recognises the code regardless of the label', () => {
    expect(objectCodeOf('90 - Other Uses')).toBe('90');
    expect(isTransferObject('90 - Other Uses')).toBe(true);
    expect(isTransferObject('10 - Personnel Services')).toBe(false);
    expect(EXCLUDED_OBJECT_CODE).toBe('90');
  });

  it('excludes it from the tree and reports how much was excluded', () => {
    // The UAS Manual defines 90 as sub-objects 91-99, of which 91 is
    // "INTRAGOVERNMENTAL TRANSFERS", and defines expenditures as excluding
    // "operating and residual equity transfers to other funds". Including it
    // double-counts money spent once — the West Hollywood hazard.
    const rows = readDetailRows(expenditureSheet([
      ['200239', 'Miami', '511.00 - Legislative', '10 - Personnel Services', ...funds(100)],
      ['200239', 'Miami', '511.00 - Legislative', '90 - Other Uses', ...funds(500)],
    ]));
    const { tree, total, excludedTransfers } = buildExpenditureTree(rows, '200239');
    expect(total).toBe(100);
    expect(excludedTransfers).toBe(500);
    expect(JSON.stringify(tree)).not.toContain('Other Uses');
  });
});

describe('Florida DFS — 38x/39x are other sources, not revenue', () => {
  it('excludes the whole block, including DEBT PROCEEDS', () => {
    // 384.000 Debt Proceeds and 385.000 Proceeds From Refunding Bonds live here.
    // Counting borrowing as revenue is the Los Angeles FY2026 defect, in which
    // $4.77B of TRAN borrowing was published as spending.
    expect(isTransferRevenueAccount('384.000 - Debt Proceeds')).toBe(true);
    expect(isTransferRevenueAccount('385.000 - Proceeds From Refunding Bonds')).toBe(true);
    expect(isTransferRevenueAccount('381.000 - Inter-Fund Group Transfers In')).toBe(true);
    expect(isTransferRevenueAccount('392.000 - Extraordinary Items (Gain)')).toBe(true);
    // ...and does NOT reach genuine revenue.
    expect(isTransferRevenueAccount('311.000 - Ad Valorem Taxes')).toBe(false);
    expect(isTransferRevenueAccount('369.900 - Other Miscellaneous Revenues')).toBe(false);
    expect(isTransferRevenueAccount('348.000 - Charges For Services')).toBe(false);
  });

  it('is anchored to the account CODE, not to a word in the label', () => {
    // A label-based rule would be a standing bet on the publisher's wording —
    // the forbid-list mistake session 2 rejected on the Buncombe lesson.
    expect(EXCLUDED_REVENUE_ACCOUNT_RE.test(accountCode('311.000 - Transfers To Reserve'))).toBe(false);
    expect(accountCode('311.000 - Ad Valorem Taxes')).toBe('311.000');
    expect(accountCode('no code here')).toBe('');
  });

  it('excludes them from the tree and reports the amount', () => {
    const rows = readDetailRows(revenueSheet([
      ['200239', 'Miami', '311.000 - Ad Valorem Taxes', ' ', ' ', ...funds(1000)],
      ['200239', 'Miami', '384.000 - Debt Proceeds', ' ', ' ', ...funds(7000)],
    ]));
    const { tree, total, excludedTransfers } = buildRevenueTree(rows, '200239');
    expect(total).toBe(1000);
    expect(excludedTransfers).toBe(7000);
    expect(tree).toEqual([{ n: '311.000 - Ad Valorem Taxes', a: 1000 }]);
  });
});

describe('Florida DFS — tree shape', () => {
  it('nests object codes under their function, using the {n,a,c} dialect', () => {
    const rows = readDetailRows(expenditureSheet([
      ['200239', 'Miami', '512.00 - Executive', '10 - Personnel Services', ...funds(300)],
      ['200239', 'Miami', '512.00 - Executive', '30 - Operating Expenditures/Expenses', ...funds(700)],
    ]));
    const { tree, total } = buildExpenditureTree(rows, '200239');
    expect(total).toBe(1000);
    expect(tree).toHaveLength(1);
    expect(tree[0].n).toBe('512.00 - Executive');
    expect(tree[0].a).toBe(1000);
    expect(tree[0].c.map((c) => c.a)).toEqual([700, 300]); // descending
  });

  it('flattens a single-child function rather than nesting one node under itself', () => {
    const rows = readDetailRows(expenditureSheet([
      ['200239', 'Miami', '511.00 - Legislative', '10 - Personnel Services', ...funds(50)],
    ]));
    const { tree } = buildExpenditureTree(rows, '200239');
    expect(tree[0].c).toBeUndefined();
  });

  it('reads only the requested entity', () => {
    const rows = readDetailRows(expenditureSheet([
      ['200239', 'Miami', '511.00 - Legislative', '10 - Personnel Services', ...funds(100)],
      ['200240', 'Miami Beach', '511.00 - Legislative', '10 - Personnel Services', ...funds(999)],
    ]));
    expect(buildExpenditureTree(rows, '200239').total).toBe(100);
    expect(buildExpenditureTree(rows, '200240').total).toBe(999);
  });
});

describe('Florida DFS — the oracle report is keyed by TYPE and NAME, with no code', () => {
  it('keeps the County and the Town of Palm Beach apart', () => {
    // ⚠ Florida has both. A name-only join swaps a $3.9B county for a $90M town
    // and nothing about the resulting figure looks wrong.
    const ws = sheet([
      ['Total Revenue, Expenditure and Debt ...'], [],
      ['Unit Type', 'Unit Name', 'Governing Authority', 'Total Revenues', 'Total Expenditures', 'Total Debt'],
      ['County', 'Palm Beach', '', 4647080864, 3907170338, 1],
      ['City', 'Palm Beach', '', 90000000, 88000000, 2],
    ]);
    const totals = readTotalsRows(ws);
    expect(totals.get('County|Palm Beach').expenditures).toBe(3907170338);
    expect(totals.get('City|Palm Beach').expenditures).toBe(88000000);
  });
});

describe('Florida DFS — the audit branch', () => {
  const complianceSheet = (rows) => sheet([
    ['Compliant report for ...'], [],
    ['EntityId', 'Type', 'Name', 'FYE', 'AFR Received Date', 'Audit Received Date', 'Audit Completion Date'],
    ...rows,
  ]);

  it('reads an audit date as the audited branch', () => {
    const c = readComplianceRows(complianceSheet([
      ['200239', 'City', 'Miami', '9/30', '2024-05-06', '2024-04-15', '2024-03-29'],
    ]));
    expect(hasAuditOnFile(c, '200239')).toBe(true);
  });

  it('reads a filing with NO audit date as the DEW branch', () => {
    const c = readComplianceRows(complianceSheet([
      ['300123', 'Special District', 'Tiny CDD', '9/30', '2024-05-06', '', ''],
    ]));
    expect(hasAuditOnFile(c, '300123')).toBe(false);
  });

  it('returns null — NOT false — for an entity in neither report', () => {
    // "We have no record" is not "there was no audit". A null must leave the row
    // ungraded; treating it as false would assert the weaker branch on silence,
    // which is the failure censusGuard() makes in California.
    const c = readComplianceRows(complianceSheet([]));
    expect(hasAuditOnFile(c, '200239')).toBeNull();
  });

  it('UNIONS the compliant and non-compliant reports', () => {
    // ⚠ The compliant report lists only filers inside the nine-month deadline.
    // 571 late-but-audited entities were in the other report for FY2023 alone;
    // reading one would grade every one of them down.
    const onTime = readComplianceRows(complianceSheet([
      ['200239', 'City', 'Miami', '9/30', '2024-05-06', '2024-04-15', '2024-03-29'],
    ]));
    const late = readComplianceRows(complianceSheet([
      ['100002', 'County', 'Baker', '9/30', '2025-04-14', '2025-04-14', '2025-04-10'],
    ]));
    const merged = mergeCompliance(onTime, late);
    expect(hasAuditOnFile(merged, '200239')).toBe(true);
    expect(hasAuditOnFile(merged, '100002')).toBe(true);
    expect(merged.size).toBe(2);
  });
});

describe('Florida DFS — the source string carries the branch', () => {
  it('names the audited and DEW branches differently', () => {
    expect(sourceNameFor('operating', 2023, true))
      .toBe(`${SOURCE_PREFIX} — Expenditure by Function (FY2023 actual, audit-reconciled)`);
    expect(sourceNameFor('revenue', 2023, false))
      .toBe(`${SOURCE_PREFIX} — Revenue by Source (FY2023 actual, DEW-reconciled)`);
  });

  it('grades the audited branch and ONLY the audited branch', () => {
    // Florida is a mixed source. The DEW branch is a self-completed worksheet,
    // and §3.5's rule is that an entry is created when its evidence is — no such
    // row has been loaded, so it stays `unknown` rather than being guessed at.
    for (let fy = 2012; fy <= 2025; fy++) {
      for (const ds of ['operating', 'revenue']) {
        expect(gradeFor(sourceNameFor(ds, fy, true)).value).toBe(AUDIT_GRADE.COMPILED_FROM_AUDITED);
        expect(gradeFor(sourceNameFor(ds, fy, false)).value).toBe(AUDIT_GRADE.UNKNOWN);
      }
    }
  });

  it('is TT\'s first compiled_from_audited source', () => {
    const compiled = AUDIT_GRADE_REGISTRY.filter((e) => e.value === AUDIT_GRADE.COMPILED_FROM_AUDITED);
    expect(compiled.map((e) => e.id)).toEqual(['fl-dfs-afr-audited']);
  });

  it('anchors the pattern at both ends and pins the fiscal-year window', () => {
    // The `^CA State Controller` trap: a loose prefix claims rows no evidence
    // covers. FY2011 and FY2026 are outside the loaded window.
    const g = (s) => gradeFor(s).value;
    expect(g('Florida DFS Annual Financial Report')).toBe(AUDIT_GRADE.UNKNOWN);
    expect(g(`${SOURCE_PREFIX} — Expenditure by Function (FY2011 actual, audit-reconciled)`))
      .toBe(AUDIT_GRADE.UNKNOWN);
    expect(g(`${SOURCE_PREFIX} — Expenditure by Function (FY2026 actual, audit-reconciled)`))
      .toBe(AUDIT_GRADE.UNKNOWN);
    expect(g(`${SOURCE_PREFIX} — Salaries (FY2023 actual, audit-reconciled)`))
      .toBe(AUDIT_GRADE.UNKNOWN);
    expect(g(`Not the ${SOURCE_PREFIX} — Revenue by Source (FY2023 actual, audit-reconciled)`))
      .toBe(AUDIT_GRADE.UNKNOWN);
  });
});

describe('Florida DFS — the entity roster', () => {
  it('holds seven entities: three cities and four counties', () => {
    expect(FL_ENTITIES).toHaveLength(7);
    expect(FL_ENTITIES.filter((e) => e.entityType === 'city')).toHaveLength(3);
    expect(FL_ENTITIES.filter((e) => e.entityType === 'county')).toHaveLength(4);
  });

  it('orders counties before cities, because a city\'s county_id needs one to exist', () => {
    const firstCity = FL_ENTITIES.findIndex((e) => e.entityType === 'city');
    const lastCounty = FL_ENTITIES.map((e) => e.entityType).lastIndexOf('county');
    expect(lastCounty).toBeLessThan(firstCity);
  });

  it('gives Palm Beach County ONE row, not a city and a county', () => {
    // Spec §2.2 lists it under "already the primary entity". Two rows would
    // double-count it in every rollup.
    const pb = FL_ENTITIES.filter((e) => e.dbName.includes('Palm Beach'));
    expect(pb).toHaveLength(1);
    expect(pb[0].entityType).toBe('county');
  });

  it('is joined by CODE, and every code is unique', () => {
    const codes = FL_ENTITIES.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(entityByCode('100050').dbName).toBe('Palm Beach County');
    expect(entityByCode('200239').dbName).toBe('Miami');
    expect(entityByCode('200287')).toBeNull(); // the Town of Palm Beach is not in scope
  });

  it('records the FAC census name where it differs from TT\'s', () => {
    // ⚠ FAC spells Miami-Dade WITHOUT the hyphen. A name-exact guard misses it,
    // and censusGuard() then returns {ok:true} for an entity it never found —
    // the Saint Louis County shape from session 1.
    const md = entityByCode('100013');
    expect(md.dbName).toBe('Miami-Dade County');
    expect(md.censusName).toBe('Miami Dade County');
  });

  it('declares October for every entity, and never inherits North Carolina\'s July', () => {
    // project_fysm_column_default_one_defect is precisely the defect of carrying
    // a month across a state boundary. NC, loaded one session earlier, is 7.
    for (const e of FL_ENTITIES) expect(e.fiscalYearStartMonth).toBe(10);
  });

  it('carries a Census PEP population for every entity', () => {
    for (const e of FL_ENTITIES) {
      expect(e.population, e.dbName).toBeGreaterThan(0);
      expect(e.population, e.dbName).toBeLessThan(10_000_000);
    }
  });
});
