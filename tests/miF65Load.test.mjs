import { describe, it, expect } from 'vitest';

import {
  parseAmount, gridKey, rootLabel, buildFiling, filingChecks,
  SCOPES, CATEGORY_REVENUE, CATEGORY_EXPENDITURE,
  GROUP_GENERAL_FUND, GROUP_OTHER_GOVERNMENTAL, KNOWN_DUPLICATED_DETAIL,
} from '../scripts/lib/michiganF65.mjs';
import {
  sourceNameFor, startMonthFromEnd, SOURCE_PREFIX, BASIS_VALUE,
} from '../scripts/loadMichiganF65.mjs';
import {
  MI_ENTITIES, MI_LOAD_WINDOW, entityByMunicode, entityByKey,
} from '../scripts/data/miKnightEntities.mjs';
import { DATASETS, datasetFor, rowsUrl } from '../scripts/fetchMichiganF65.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';

const YEARS = Array.from(
  { length: MI_LOAD_WINDOW.last - MI_LOAD_WINDOW.first + 1 },
  (_, i) => MI_LOAD_WINDOW.first + i,
);

/** A minimal filing in the publisher's own long shape. */
function row(over = {}) {
  return {
    municode: '822050',
    lu_name: 'City of Detroit',
    fy: '2024',
    fiscalendmonth: '6',
    category: CATEGORY_REVENUE,
    group: GROUP_GENERAL_FUND,
    field_name: 'T1R8C2',
    notes: 'Number',
    account_number: '438',
    description: 'Income Tax',
    field_data: '100.00',
    ...over,
  };
}

describe('MI entity roster', () => {
  it('has exactly the two session-7a entities', () => {
    expect(MI_ENTITIES).toHaveLength(2);
    expect(MI_ENTITIES.map((e) => e.key).sort()).toEqual(['detroit', 'wayne-county']);
  });

  it('joins on municode, which is stable where lu_name is not', () => {
    expect(entityByMunicode('822050').key).toBe('detroit');
    expect(entityByMunicode('820000').key).toBe('wayne-county');
    expect(entityByMunicode('999999')).toBeNull();
  });

  // ⚠⚠ THE SAINT-LOUIS-COUNTY SHAPE, FIFTH OCCURRENCE. Michigan's FAC census
  // carries `Wayne` (the CITY of Wayne, month 7) beside `Wayne County` (month
  // 10). A bare `Wayne` lookup would confirm the WRONG month for the county
  // while moving $0 and passing every tie test.
  it('never uses a bare "Wayne" as a census name', () => {
    const wayne = entityByKey('wayne-county');
    expect(wayne.censusName).toBe('Wayne County');
    expect(wayne.censusName).not.toBe('Wayne');
    for (const e of MI_ENTITIES) expect(e.censusName.trim()).toBe(e.censusName);
  });

  // ⚠⚠ A city and its own parent county on DIFFERENT fiscal calendars. Michigan
  // counties split 72 January / 29 October in the FAC census and Wayne is in the
  // minority, so no state-wide default is safe.
  it('carries two different fiscal calendars, read per entity', () => {
    expect(entityByKey('detroit').fiscalYearStartMonth).toBe(7);
    expect(entityByKey('wayne-county').fiscalYearStartMonth).toBe(10);
  });

  // ⚠ `borough` once silently dropped a provenance chip. Every entity type here
  // must be renderable.
  it('uses entity types the source chip can render', () => {
    for (const e of MI_ENTITIES) expect(SOURCE_CHIP_ENTITY_TYPES).toContain(e.entityType);
  });

  it('covers FY2010-FY2025 with a dataset id for every year', () => {
    expect(YEARS).toHaveLength(16);
    for (const fy of YEARS) {
      expect(datasetFor('City', fy)).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
      expect(datasetFor('County', fy)).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    }
  });

  it('has no duplicate dataset ids across years or unit types', () => {
    const all = [...Object.values(DATASETS.City), ...Object.values(DATASETS.County)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('filters the API on municode, never on a name', () => {
    const url = rowsUrl('vk42-auzg', '822050');
    expect(url).toContain('municode');
    expect(url).not.toMatch(/lu_name/i);
  });
});

describe('parseAmount', () => {
  it('reads the ordinary bare numeric form', () => {
    expect(parseAmount('692923583.00')).toBe(692923583);
    expect(parseAmount('0.00')).toBe(0);
  });

  // ⚠⚠ DETROIT FY2020, AND ONLY DETROIT FY2020, publishes formatted currency in
  // 517 of its 537 rows. `Number(x) || 0` would load the whole filing as $0 and
  // EVERY internal check would still pass, because a sum of zeros ties a total
  // of zero. This is the single most important case in this file.
  it('reads the formatted currency Detroit FY2020 emits', () => {
    expect(parseAmount('$290,017,002.00')).toBe(290017002);
    expect(parseAmount('$281,441,264.00')).toBe(281441264);
  });

  // ⚠ Negatives are a LEADING minus in this corpus (290 observed), never
  // parentheses — checked empirically after Nashville's trailing-paren
  // inversion. Parenthesised negatives are still accepted defensively.
  it('reads negatives in both conventions', () => {
    expect(parseAmount('-42428588.00')).toBe(-42428588);
    expect(parseAmount('(1234.50)')).toBe(-1234.5);
  });

  it('returns null for a genuinely empty cell, never 0', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  // ⚠⚠ THROWS rather than coercing. A silent 0 is the dangerous failure.
  it('throws on anything it cannot parse', () => {
    for (const bad of ['Y', 'Checked/', 'n/a', '12.3.4', '$', '--5', '1 2']) {
      expect(() => parseAmount(bad, 'ctx')).toThrow(/Unparseable F-65 amount/);
    }
  });
});

describe('grid coordinates and labels', () => {
  it('parses T{table}R{row}C{column}', () => {
    expect(gridKey('T1R10C2')).toEqual({ table: 1, row: 10, column: 2 });
    expect(gridKey('nope')).toBeNull();
  });

  it('renders a readable root label without touching amounts', () => {
    expect(rootLabel('TOTAL TAX REVENUES')).toBe('Tax Revenues');
    expect(rootLabel('TOTAL CHARGES FOR SERVICES')).toBe('Charges for Services');
    expect(rootLabel('TOTAL HEALTH AND WELFARE')).toBe('Health and Welfare');
  });
});

describe('fiscal month is read from the filing', () => {
  // `fiscalendmonth` is the ENDING month: June (6) is a July (7) start.
  it('converts an ending month to a starting month', () => {
    expect(startMonthFromEnd(6)).toBe(7);
    expect(startMonthFromEnd(9)).toBe(10);
    expect(startMonthFromEnd(12)).toBe(1);
    expect(startMonthFromEnd(0)).toBeNull();
    expect(startMonthFromEnd(13)).toBeNull();
  });
});

describe('buildFiling', () => {
  const filing = [
    row({ field_name: 'T1R8C2', account_number: '438', description: 'Income Tax', field_data: '60' }),
    row({ field_name: 'T1R9C2', account_number: '401-449', description: 'Property Tax', field_data: '40' }),
    row({ field_name: 'T1R10C2', notes: 'Total', account_number: '', description: 'TOTAL TAX REVENUES', field_data: '100' }),
    row({ field_name: 'T1R65C2', account_number: '699', description: 'Transfers In', field_data: '25' }),
    row({ field_name: 'T1R66C2', notes: 'Total', account_number: '', description: 'TOTAL OTHER FINANCING SOURCES', field_data: '25' }),
    row({ field_name: 'T1R67C2', notes: 'Total', account_number: '', description: 'TOTAL REVENUES', field_data: '125' }),
  ];

  it('builds a two-level tree and reconciles to the published total', () => {
    const built = buildFiling(filing, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2024,
    });
    expect(built.operating).toBe(100);
    expect(built.financing).toBe(25);
    expect(built.published).toBe(125);
    expect(built.roots).toHaveLength(1);
    expect(built.roots[0]).toEqual({ n: 'Tax Revenues', a: 100, c: [{ n: 'Income Tax', a: 60 }, { n: 'Property Tax', a: 40 }] });
    expect(filingChecks({ category: CATEGORY_REVENUE, scope: SCOPES.general_fund, built, context: 't' }).every((c) => c.ok)).toBe(true);
  });

  // ⚠⚠ Financing is removed from BOTH faces. For total_governmental this is
  // arithmetic, not convention: a GF->special-revenue transfer is an expenditure
  // in column a and a revenue in column b, both inside the same scope.
  it('excludes financing roots from the operating tree', () => {
    const built = buildFiling(filing, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2024,
    });
    expect(built.roots.map((r) => r.n)).not.toContain('Other Financing Sources');
  });

  // ⚠⚠ THE BUDGET COLUMN LIVES IN THE SAME TABLE AS THE ACTUALS. Reading it
  // would mix appropriations into an actuals series — the v2.28 defect.
  it('never reads the General Fund Final Amended Budget group', () => {
    const withBudget = [
      ...filing,
      row({ group: 'General Fund Final Amended Budget', field_name: 'T1R8C1', description: 'Income Tax', field_data: '999999' }),
      row({ group: 'General Fund Final Amended Budget', field_name: 'T1R10C1', notes: 'Total', account_number: '', description: 'TOTAL TAX REVENUES', field_data: '999999' }),
    ];
    const built = buildFiling(withBudget, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2024,
    });
    expect(built.operating).toBe(100);
    for (const s of Object.values(SCOPES)) {
      expect(s.groups).not.toContain('General Fund Final Amended Budget');
    }
  });

  it('sums column a + column b for total_governmental', () => {
    const both = [
      ...filing,
      row({ group: GROUP_OTHER_GOVERNMENTAL, field_name: 'T1R8C3', description: 'Income Tax', field_data: '5' }),
      row({ group: GROUP_OTHER_GOVERNMENTAL, field_name: 'T1R10C3', notes: 'Total', account_number: '', description: 'TOTAL TAX REVENUES', field_data: '5' }),
      row({ group: GROUP_OTHER_GOVERNMENTAL, field_name: 'T1R67C3', notes: 'Total', account_number: '', description: 'TOTAL REVENUES', field_data: '5' }),
    ];
    const built = buildFiling(both, {
      category: CATEGORY_REVENUE, scope: SCOPES.total_governmental, municode: '822050', fiscalYear: 2024,
    });
    expect(built.operating).toBe(105);
    expect(built.published).toBe(130);
  });

  // ⚠⚠ PENNSYLVANIA'S CENTRE COUNTY DEFECT: a grand total can tie while a
  // subtotal misparents money. Every root is asserted against its OWN leaves.
  it('throws when a subtotal does not equal its own leaves', () => {
    const broken = [
      row({ field_name: 'T1R8C2', description: 'Income Tax', field_data: '60' }),
      row({ field_name: 'T1R10C2', notes: 'Total', account_number: '', description: 'TOTAL TAX REVENUES', field_data: '99' }),
    ];
    expect(() => buildFiling(broken, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2024,
    })).toThrow(/does not equal its own leaves/);
  });

  // ⚠⚠ `Summary - Number` rows have a BLANK account_number and are NOT
  // subtotals — they are fund balances. A "blank means subtotal" rule would file
  // Detroit FY2024's $1,197,106,602 opening balance as an expenditure category.
  it('ignores Summary - Number fund-balance rows', () => {
    const withBalances = [
      ...filing,
      row({ field_name: 'T1R74C2', notes: 'Summary - Number', account_number: '', description: 'Fund Balance Beginning', field_data: '1197106602' }),
    ];
    const built = buildFiling(withBalances, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2024,
    });
    expect(built.operating).toBe(100);
    expect(built.roots.map((r) => r.n)).not.toContain('Fund Balance Beginning');
  });
});

describe('declared publisher defects are an exact registry, never a tolerance', () => {
  it('declares exactly the three Detroit FY2015 duplications', () => {
    expect(KNOWN_DUPLICATED_DETAIL).toHaveLength(3);
    for (const d of KNOWN_DUPLICATED_DETAIL) {
      expect(d.municode).toBe('822050');
      expect(d.fiscalYear).toBe(2015);
      // Each is an exact doubling: one value written to two account lines.
      expect(d.leafTotal).toBe(d.published * 2);
    }
    expect(KNOWN_DUPLICATED_DETAIL.map((d) => d.root)).toEqual([
      'TOTAL CHARGES FOR SERVICES',
      'TOTAL HEALTH AND WELFARE',
      'TOTAL RECREATION AND CULTURE',
    ]);
  });

  it('keeps the verified subtotal and suppresses only the contradicted detail', () => {
    const rows = [
      row({ fy: '2015', field_name: 'T1R47C2', account_number: '626-637', description: 'All Other Services Rendered Charges', field_data: '86783156' }),
      row({ fy: '2015', field_name: 'T1R49C2', account_number: '638-642, 651, 653, 654', description: 'All Other Sales, Use, & Admission Fees', field_data: '86783156.00' }),
      row({ fy: '2015', field_name: 'T1R51C2', notes: 'Total', account_number: '', description: 'TOTAL CHARGES FOR SERVICES', field_data: '86783156' }),
      row({ fy: '2015', field_name: 'T1R67C2', notes: 'Total', account_number: '', description: 'TOTAL REVENUES', field_data: '86783156' }),
    ];
    const built = buildFiling(rows, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2015,
    });
    expect(built.operating).toBe(86783156);
    const root = built.roots.find((r) => r.n === 'Charges for Services');
    expect(root.a).toBe(86783156);
    expect(root.c).toBeUndefined();
    expect(built.suppressed).toContain('Revenue:Charges for Services');
  });

  // ⚠ The registry must not degrade into a tolerance: a mismatch that is not
  // declared EXACTLY still stops the load.
  it('still throws for an undeclared mismatch in the same entity-year', () => {
    const rows = [
      row({ fy: '2015', field_name: 'T1R8C2', description: 'Income Tax', field_data: '60' }),
      row({ fy: '2015', field_name: 'T1R10C2', notes: 'Total', account_number: '', description: 'TOTAL TAX REVENUES', field_data: '61' }),
    ];
    expect(() => buildFiling(rows, {
      category: CATEGORY_REVENUE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2015,
    })).toThrow(/does not equal its own leaves/);
  });
});

describe('source labels and the registries that read them', () => {
  it('puts the fund scope inside the label so the two series cannot collide', () => {
    const gf = sourceNameFor('revenue', 2024, SCOPES.general_fund);
    const tg = sourceNameFor('revenue', 2024, SCOPES.total_governmental);
    expect(gf).not.toBe(tg);
    expect(gf).toContain('general fund');
    expect(tg).toContain('governmental funds');
    expect(gf.startsWith(SOURCE_PREFIX)).toBe(true);
  });

  it('grades every label in the load window self_reported_unaudited', () => {
    for (const fy of YEARS) {
      for (const datasetType of ['revenue', 'operating']) {
        for (const scope of Object.values(SCOPES)) {
          const label = sourceNameFor(datasetType, fy, scope);
          const graded = gradeFor(label);
          expect(graded.value, label).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
          expect(graded.entryId).toBe('mi-treasury-f65');
        }
      }
    }
  });

  // ⚠ A year outside the declared window must NOT be silently graded — the
  // pattern is pinned to the years actually loaded.
  it('does not grade a year outside the declared window', () => {
    expect(gradeFor(sourceNameFor('revenue', 2026, SCOPES.general_fund)).value).toBe(AUDIT_GRADE.UNKNOWN);
    expect(gradeFor(sourceNameFor('revenue', 2009, SCOPES.general_fund)).value).toBe(AUDIT_GRADE.UNKNOWN);
  });

  it('records the derivation honestly: general fund published, governmental derived', () => {
    expect(SCOPES.general_fund.derivation).toBe('published');
    expect(SCOPES.total_governmental.derivation).toBe('derived');
    expect(BASIS_VALUE).toBe('actual');
  });

  it('reads only the two governmental groups, never enterprise or component units', () => {
    expect(SCOPES.general_fund.groups).toEqual([GROUP_GENERAL_FUND]);
    expect(SCOPES.total_governmental.groups).toEqual([GROUP_GENERAL_FUND, GROUP_OTHER_GOVERNMENTAL]);
    for (const s of Object.values(SCOPES)) {
      expect(s.groups).not.toContain('Enterprise Funds');
      expect(s.groups).not.toContain('Internal Service Funds');
      expect(s.groups).not.toContain('Component Units');
      // ⚠ The form's own `Total` is a+b+c+d, NOT this campaign's governmental scope.
      expect(s.groups).not.toContain('Total');
    }
  });
});

describe('expenditure side', () => {
  it('reads the Expenditure table with the same rules', () => {
    const rows = [
      row({ category: CATEGORY_EXPENDITURE, field_name: 'T2R3C2', account_number: '253', description: 'Treasurer', field_data: '10' }),
      row({ category: CATEGORY_EXPENDITURE, field_name: 'T2R11C2', notes: 'Total', account_number: '', description: 'TOTAL GENERAL GOVERNMENT', field_data: '10' }),
      row({ category: CATEGORY_EXPENDITURE, field_name: 'T2R70C2', account_number: '995', description: 'Transfers (Out)', field_data: '7' }),
      row({ category: CATEGORY_EXPENDITURE, field_name: 'T2R72C2', notes: 'Total', account_number: '', description: 'TOTAL OTHER FINANCING USES', field_data: '7' }),
      row({ category: CATEGORY_EXPENDITURE, field_name: 'T2R73C2', notes: 'Total', account_number: '', description: 'TOTAL EXPENDITURES', field_data: '17' }),
    ];
    const built = buildFiling(rows, {
      category: CATEGORY_EXPENDITURE, scope: SCOPES.general_fund, municode: '822050', fiscalYear: 2024,
    });
    expect(built.operating).toBe(10);
    expect(built.financing).toBe(7);
    expect(built.published).toBe(17);
  });
});
