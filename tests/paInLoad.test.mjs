import { describe, it, expect } from 'vitest';

import {
  isSettlementFund, assertSettlementIsPassThrough, splitLine, headerIndex, need,
  money, pad, toTree, assertParsed,
  SETTLEMENT_FUND_CODE, GOVERNMENTAL_ENT_NAME,
  NON_OPERATING_RECEIPT_CODES, NON_OPERATING_DISBURSE_CODES,
  INVESTMENT_RECEIPT_CODES, INVESTMENT_DISBURSE_CODES,
} from '../scripts/lib/inGateway.mjs';
import {
  normHeader, indexHeader, col, num, prettyLabel, isApproved, buildTree, checkRow,
  MUNI_REVENUE_TREE, MUNI_EXPENDITURE_TREE, MUNI_FINANCING_COLUMNS,
  COUNTY_REVENUE_TREE, COUNTY_EXPENDITURE_TREE,
} from '../scripts/lib/paDced.mjs';
import {
  sourceNameFor as inSourceName, SOURCE_PREFIX as IN_PREFIX,
  FUND_SCOPE as IN_FUND_SCOPE, BASIS_VALUE as IN_BASIS, DERIVATION as IN_DERIVATION,
  oracleChecks,
} from '../scripts/loadIndianaGateway.mjs';
import {
  sourceNameFor as paSourceName, fundScopeFor, parseFilename,
  SOURCE_PREFIX as PA_PREFIX,
} from '../scripts/loadPaDced.mjs';
import {
  PA_IN_KNIGHT_ENTITIES, PA_ENTITIES, IN_ENTITIES, PA_IN_LOAD_WINDOW,
  entityByDcedId, entityByGatewayUnit,
} from '../scripts/data/paInKnightEntities.mjs';
import { gradeFor } from '../scripts/data/auditGradeRegistry.mjs';
import { AUDIT_GRADE } from '../scripts/lib/budgetAxes.mjs';
import { SOURCE_CHIP_ENTITY_TYPES } from '../src/data/sourceChipTypes.ts';

const YEARS = Array.from(
  { length: PA_IN_LOAD_WINDOW.last - PA_IN_LOAD_WINDOW.first + 1 },
  (_, i) => PA_IN_LOAD_WINDOW.first + i,
);

describe('PA/IN Knight entity registry', () => {
  it('has the seven session-5 entities', () => {
    expect(PA_IN_KNIGHT_ENTITIES).toHaveLength(7);
    expect(PA_ENTITIES).toHaveLength(3);
    expect(IN_ENTITIES).toHaveLength(4);
  });

  // ⚠ `borough` is NOT in SOURCE_CHIP_ENTITY_TYPES. Typing State College by its
  // legal class would silently drop its provenance chip — the exact defect
  // src/data/sourceChipTypes.ts was written to record. This test is the only
  // guard available, because the repo can run no component tests.
  it('types every entity so the source chip renders', () => {
    for (const e of PA_IN_KNIGHT_ENTITIES) {
      expect(SOURCE_CHIP_ENTITY_TYPES.has(e.entityType), `${e.name} is ${e.entityType}`).toBe(true);
    }
  });

  it('never types a PA borough as `borough`', () => {
    const sc = PA_ENTITIES.find((e) => e.key === 'state-college');
    expect(sc.entityType).toBe('municipality');
    expect(SOURCE_CHIP_ENTITY_TYPES.has('borough')).toBe(false);
  });

  // ⚠⚠ Philadelphia is coterminous with its county, so it is ONE entity, and it
  // is `city` — matching TT's pre-existing San Francisco precedent and DCED's
  // own filing, NOT session 4's Georgia typing. See the registry header.
  it('makes Philadelphia one `city` entity with no parent county', () => {
    const p = PA_ENTITIES.find((e) => e.key === 'philadelphia');
    expect(p.entityType).toBe('city');
    expect(p.parentCountyKey).toBeNull();
    expect(p.coterminousCounty).toBe('Philadelphia County');
    expect(PA_IN_KNIGHT_ENTITIES.some((e) => e.name === 'Philadelphia County')).toBe(false);
  });

  it('gives every entity a unique publisher key', () => {
    const dced = PA_ENTITIES.map((e) => e.dcedId);
    expect(new Set(dced).size).toBe(dced.length);
    const gw = IN_ENTITIES.map((e) => `${e.countyCode}|${e.unitCode}`);
    expect(new Set(gw).size).toBe(gw.length);
  });

  // ⚠ `unit_code` is unique only WITHIN a county — Gary is 0101 in county 45 and
  // a different government is 0101 in county 02. The key is the pair.
  it('resolves Indiana entities on the (county, unit) pair, not unit alone', () => {
    expect(entityByGatewayUnit('45', '0101').name).toBe('Gary');
    expect(entityByGatewayUnit('02', '0100').name).toBe('Fort Wayne');
    expect(entityByGatewayUnit('02', '0101')).toBeUndefined();
    expect(entityByGatewayUnit('45', '0100')).toBeUndefined();
  });

  it('resolves PA entities by DCED id and not by name', () => {
    expect(entityByDcedId('510012').name).toBe('Philadelphia');
    expect(entityByDcedId('140933').name).toBe('State College');
    // NEW PHILADELPHIA BORO and the empty PHILADELPHIA  COUNTY placeholder.
    expect(entityByDcedId('541023')).toBeUndefined();
    expect(entityByDcedId('510001')).toBeUndefined();
  });

  // ⚠⚠ 611 of 643 PA rows in the FAC census are month 1 and Philadelphia is one
  // of thirteen that are not. Never carry a month across a state.
  it('keeps Philadelphia on a July fiscal year while the rest of PA is January', () => {
    const by = Object.fromEntries(PA_IN_KNIGHT_ENTITIES.map((e) => [e.key, e.fiscalYearStartMonth]));
    expect(by.philadelphia).toBe(7);
    expect(by['state-college']).toBe(1);
    expect(by['centre-county']).toBe(1);
    for (const e of IN_ENTITIES) expect(e.fiscalYearStartMonth).toBe(1);
  });

  it('declares census gaps rather than implying full coverage', () => {
    const allen = IN_ENTITIES.find((e) => e.key === 'allen-county-in');
    expect(allen.censusGaps).toContain(2015);
    const lake = IN_ENTITIES.find((e) => e.key === 'lake-county-in');
    expect(lake.censusGaps).toContain(2019);
  });
});

describe('audit grade — every loaded source string must classify', () => {
  it('grades Indiana self_reported_unaudited across the window', () => {
    for (const y of YEARS) {
      for (const d of ['operating', 'revenue']) {
        expect(gradeFor(inSourceName(d, y)).value).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
      }
    }
  });

  it('grades Pennsylvania self_reported_unaudited for both scopes', () => {
    for (const y of YEARS) {
      for (const d of ['operating', 'revenue']) {
        for (const e of PA_ENTITIES) {
          expect(gradeFor(paSourceName(d, y, e)).value).toBe(AUDIT_GRADE.SELF_REPORTED_UNAUDITED);
        }
      }
    }
  });

  // ⚠ A graded row must carry a source_url — the CHECK constraint enforces it in
  // the DB, and this pins the loader side.
  it('names the publisher in every source string', () => {
    expect(inSourceName('revenue', 2020).startsWith(IN_PREFIX)).toBe(true);
    const p = PA_ENTITIES[0];
    expect(paSourceName('revenue', 2020, p).startsWith(PA_PREFIX)).toBe(true);
  });

  it('uses axis values the constraints allow', () => {
    expect(IN_FUND_SCOPE).toBe('total_governmental');
    expect(IN_BASIS).toBe('actual');
    expect(['published', 'derived']).toContain(IN_DERIVATION);
  });

  // ⚠⚠ Two fund scopes in one state, both READ from the source: the municipal
  // report folds enterprise into its totals, the county report does not.
  it('scopes PA municipalities all_funds and PA counties total_governmental', () => {
    const by = Object.fromEntries(PA_ENTITIES.map((e) => [e.key, fundScopeFor(e)]));
    expect(by.philadelphia).toBe('all_funds');
    expect(by['state-college']).toBe('all_funds');
    expect(by['centre-county']).toBe('total_governmental');
  });
});

describe('Indiana settlement funds', () => {
  it('matches the usual Gateway code', () => {
    expect(isSettlementFund(SETTLEMENT_FUND_CODE, 'Settlement')).toBe(true);
    expect(isSettlementFund('106000', 'anything at all')).toBe(true);
  });

  // ⚠⚠ Lake spells it `Settlement`, Allen spells it `TAX SETTLEMENT`. A
  // name-only rule keyed on one drops one county and keeps the other.
  it('matches both spellings regardless of case', () => {
    expect(isSettlementFund('999999', 'Settlement')).toBe(true);
    expect(isSettlementFund('999999', 'TAX SETTLEMENT')).toBe(true);
    expect(isSettlementFund('999999', '  tax settlement  ')).toBe(true);
  });

  // ⚠⚠ Gateway renumbered Lake County's settlement fund from 106000 to 900334 in
  // FY2022 alone. A code-only rule missed $735,638,546 while 11,283 of 11,283
  // oracle checks still passed — the oracle proves the READ, not the SCOPE.
  it('still matches when Gateway renumbers the fund (Lake FY2022 -> 900334)', () => {
    expect(isSettlementFund('900334', 'Settlement')).toBe(true);
  });

  // ⚠ These are real revenue and must NOT be excluded. Every distractor is a
  // LONGER name, which is why an exact match is safe and a substring is not.
  it('does not match settlements that are ordinary revenue', () => {
    for (const n of [
      'Health Dept Tobacco Settlement',
      "Commissioners' Monsanto Class Action Settlement",
      "The Assessor''s Settlement Fund",
      'Excess Monies - Settlement 2001',
    ]) {
      expect(isSettlementFund('900001', n), n).toBe(false);
    }
  });

  it('refuses when an excluded settlement fund is not a pass-through', () => {
    const ok = () => assertSettlementIsPassThrough(
      { settlementTotal: 799_271_207.07 }, { settlementTotal: 799_270_607.06 }, 'Lake FY2023',
    );
    expect(ok().ok).toBe(true);
    expect(() => assertSettlementIsPassThrough(
      { settlementTotal: 800_000_000 }, { settlementTotal: 100_000_000 }, 'bogus',
    )).toThrow(/pass-through/);
  });

  it('is a no-op for entities with no settlement fund', () => {
    expect(assertSettlementIsPassThrough({ settlementTotal: 0 }, { settlementTotal: 0 }, 'city').ok).toBe(true);
  });
});

describe('Indiana non-operating codes', () => {
  it('covers transfers, interfund loans, borrowings and investments', () => {
    for (const c of ['R901', 'R903', 'R904', 'R910', 'R911', 'R912']) {
      expect(NON_OPERATING_RECEIPT_CODES.has(c), c).toBe(true);
    }
    for (const c of ['D704', 'D705', 'D706', 'D900']) {
      expect(NON_OPERATING_DISBURSE_CODES.has(c), c).toBe(true);
    }
  });

  // ⚠ Only investment codes are netted by Gateway's Cash and Investments report,
  // so only those may be removed before the oracle compares. Removing transfers
  // too would make the oracle agree with itself.
  it('nets only investment codes for the oracle', () => {
    expect([...INVESTMENT_RECEIPT_CODES]).toEqual(['R901']);
    expect([...INVESTMENT_DISBURSE_CODES]).toEqual(['D900']);
    expect(INVESTMENT_DISBURSE_CODES.has('D704')).toBe(false);
  });

  it('keeps ordinary receipt classes out of the exclusion set', () => {
    for (const c of ['R101', 'R913', 'R503', 'D703']) {
      expect(NON_OPERATING_RECEIPT_CODES.has(c) || NON_OPERATING_DISBURSE_CODES.has(c), c).toBe(false);
    }
  });
});

describe('Gateway parsing primitives', () => {
  it('drops the trailing empty field from a trailing pipe', () => {
    expect(splitLine('a|b|c|')).toEqual(['a', 'b', 'c']);
    expect(splitLine('a|b|c')).toEqual(['a', 'b', 'c']);
  });

  // ⚠ Three of Gateway's AFR reports use three different column orders, and one
  // uses lowercase `fund_code` where another uses `Fund_code`.
  it('resolves columns by name, case-insensitively', () => {
    const ix = headerIndex('year|cnty_description|cnty_cd|Fund_code|amount|');
    expect(need(ix, 'cnty_cd')).toBe(2);
    expect(need(ix, 'fund_code')).toBe(3);
    expect(() => need(ix, 'nope')).toThrow(/Column not found/);
  });

  it('refuses a non-numeric amount rather than reading it as zero', () => {
    expect(money('1234.56')).toBe(1234.56);
    expect(money('')).toBe(0);
    expect(() => money('#REF!')).toThrow(/Non-numeric/);
  });

  it('pads publisher codes to their fixed widths', () => {
    expect(pad('2', 2)).toBe('02');
    expect(pad('100', 4)).toBe('0100');
  });

  // ⚠⚠ Session 3's loader parsed 30,189 rows to nothing and printed "Oracle
  // green" from zero checks. A gate that can measure nothing must fail.
  it('refuses a parse that measured nothing', () => {
    expect(() => assertParsed({ rows: 0, fullTotal: 0 }, 'x')).toThrow(/0 rows/);
    expect(() => assertParsed({ rows: 12, fullTotal: 0 }, 'x')).toThrow(/\$0/);
    expect(assertParsed({ rows: 12, fullTotal: 5 }, 'x').rows).toBe(12);
  });

  it('builds a two-level tree and drops empty branches', () => {
    const m = new Map([
      ['Taxes', new Map([['Property', 100], ['Sales', 50]])],
      ['Empty', new Map([['Nothing', 0]])],
      ['Single', new Map([['One', 7]])],
    ]);
    const t = toTree(m);
    expect(t.map((r) => r.n)).toEqual(['Taxes', 'Single']);
    expect(t[0]).toEqual({ n: 'Taxes', a: 150, c: [{ n: 'Property', a: 100 }, { n: 'Sales', a: 50 }] });
    expect(t[1]).toEqual({ n: 'Single', a: 7 });
  });

  it('reports an oracle disagreement rather than swallowing it', () => {
    const mine = new Map([['a|1', 100], ['b|2', 50]]);
    const theirs = new Map([['a|1', { r: 100, d: 0 }], ['b|2', { r: 40, d: 0 }]]);
    const checks = oracleChecks(mine, theirs, 'r');
    expect(checks).toHaveLength(2);
    expect(checks.find((c) => c.fund === 'a|1').ok).toBe(true);
    expect(checks.find((c) => c.fund === 'b|2').ok).toBe(false);
  });

  it('does not count a fund that is silent on both sides as a check', () => {
    expect(oracleChecks(new Map([['z|9', 0]]), new Map([['z|9', { r: 0, d: 0 }]]), 'r')).toHaveLength(0);
  });

  it('names the governmental bucket exactly, as a whitelist', () => {
    expect(GOVERNMENTAL_ENT_NAME).toBe('Governmental Activities');
  });
});

describe('DCED header normalisation', () => {
  // ⚠ DCED's own typos and inconsistent spacing. The mapping must match the file
  // as published; "fixing" the typos would stop it matching.
  it('collapses the inconsistent space around the publisher separator', () => {
    expect(normHeader('Governmental Funds- General Government- Administrative'))
      .toBe(normHeader('Governmental Funds-General Government-Administrative'));
    expect(normHeader('Governmental Funds-Corrections')).toBe('governmental funds-corrections');
  });

  it('survives the non-UTF8 bytes in two published headers', () => {
    expect(normHeader('Proprietary� Funds- Charges for Service'))
      .toBe('proprietary funds-charges for service');
  });

  it('refuses duplicate columns instead of silently taking one', () => {
    expect(() => indexHeader(['Total Revenues', 'Total Revenues'])).toThrow(/Duplicate/);
  });

  it('throws on a missing column rather than reading it as zero', () => {
    const ix = indexHeader(['Total Revenues']);
    expect(col(ix, 'Total Revenues')).toBe(0);
    expect(() => col(ix, 'Nope')).toThrow(/Column not found/);
  });

  it('strips publisher suffixes for display', () => {
    expect(prettyLabel('Real Estate Tax Revenues')).toBe('Real Estate Tax');
    expect(prettyLabel('Governmental Funds- Hotel Taxes')).toBe('Hotel Taxes');
    expect(prettyLabel('Police Expenditures')).toBe('Police');
  });

  // ⚠ Blank status means NOT FILED. NEW PHILADELPHIA BORO carries blank
  // revenue, expenditure and status for 2023; Centre County FY2016 is 'P'.
  it('treats only an explicit A as approved', () => {
    expect(isApproved('A')).toBe(true);
    expect(isApproved(' a ')).toBe(true);
    expect(isApproved('P')).toBe(false);
    expect(isApproved('')).toBe(false);
    expect(isApproved(undefined)).toBe(false);
  });

  it('parses the statewide filenames and rejects anything else', () => {
    expect(parseFilename('StatewideMuniAfr_2023.xlsx')).toEqual({ report: 'StatewideMuniAfr', fiscalYear: 2023 });
    expect(parseFilename('StatewideCountyAfr_2015.xlsx').fiscalYear).toBe(2015);
    expect(parseFilename('StatewideMuniAfr_YEAR.xlsx')).toBeNull();
  });
});

describe('DCED tree specs', () => {
  // ⚠⚠ Financing sources are excluded so PA municipalities match PA counties and
  // TT's Florida rows. They are removed by naming the column, not by arithmetic.
  it('keeps financing columns out of the municipal trees', () => {
    const revCols = MUNI_REVENUE_TREE.flatMap((n) => n.children);
    const expCols = MUNI_EXPENDITURE_TREE.flatMap((n) => n.children);
    expect(revCols).not.toContain(MUNI_FINANCING_COLUMNS.revenue);
    expect(expCols).not.toContain(MUNI_FINANCING_COLUMNS.operating);
    expect(MUNI_FINANCING_COLUMNS.revenue).toBe('Other Financing Sources Revenues');
    expect(MUNI_FINANCING_COLUMNS.operating).toBe('Other Financing Uses Expenditures');
  });

  // ⚠⚠ `Total Miscellaneous Revenues` is NOT the sum of the columns above it —
  // Charges for Service is a SIBLING. Reading positionally misparents $13.3M for
  // Centre County while the grand total still ties.
  it('treats county Charges for Service as a sibling of Miscellaneous', () => {
    const charges = COUNTY_REVENUE_TREE.find((n) => n.label === 'Charges for Service');
    const misc = COUNTY_REVENUE_TREE.find((n) => n.label === 'Miscellaneous Revenues');
    expect(charges).toBeTruthy();
    expect(charges.subtotal).toBeUndefined();
    expect(misc.children).not.toContain('Governmental Funds- Charges for Service');
    expect(misc.children).toHaveLength(4);
  });

  it('keeps the publisher typo in the county tax mapping', () => {
    const taxes = COUNTY_REVENUE_TREE.find((n) => n.label === 'Taxes');
    expect(taxes.children).toContain('Governmental Funds- Real Eastate Taxes');
  });

  it('reads no proprietary, internal service or fiduciary column', () => {
    const all = [...COUNTY_REVENUE_TREE, ...COUNTY_EXPENDITURE_TREE].flatMap((n) => [n.subtotal, ...n.children]);
    for (const c of all.filter(Boolean)) {
      expect(/Proprietary|Internal|Fiduciary/i.test(c), c).toBe(false);
    }
  });
});

describe('DCED tree building', () => {
  const spec = [
    { label: 'Taxes', subtotal: 'Total Taxes', children: ['Real Estate', 'Earned Income'] },
    { label: 'Other', children: ['Misc'] },
  ];
  const header = ['Total Taxes', 'Real Estate', 'Earned Income', 'Misc'];
  const ix = indexHeader(header);

  it('uses the published subtotal as the parent and reports the detail gap', () => {
    const t = buildTree(spec, [100, 60, 40, 5], ix);
    expect(t.total).toBe(105);
    expect(t.checks[0]).toMatchObject({ id: 'Taxes', expected: 100, actual: 100, diff: 0 });
  });

  // ⚠ 139 of 2,395 approved 2023 municipal rows have a tax subtotal that does not
  // equal its own detail. Neither loaded entity is affected, but it must surface.
  it('surfaces a subtotal that disagrees with its detail', () => {
    const t = buildTree(spec, [120, 60, 40, 5], ix);
    expect(t.checks[0].diff).toBe(20);
    const checks = checkRow({ tree: t, publishedTotal: 125, label: 'revenue' });
    expect(checks.find((c) => c.kind === 'subtotal').ok).toBe(false);
  });

  it('drops zero branches without inventing anything', () => {
    const t = buildTree(spec, [0, 0, 0, 0], ix);
    expect(t.roots).toHaveLength(0);
    expect(t.total).toBe(0);
  });

  it('fails the total check when the tree does not reach the published total', () => {
    const t = buildTree(spec, [100, 60, 40, 5], ix);
    const checks = checkRow({ tree: t, publishedTotal: 999, label: 'revenue' });
    expect(checks.find((c) => c.kind === 'total').ok).toBe(false);
  });

  it('reads blanks and text as zero without throwing', () => {
    expect(num('')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num('1,234')).toBe(1234);
  });
});
