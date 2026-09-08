import { describe, it, expect } from 'vitest';

import {
  isSettlementFund, splitLine, headerIndex, need,
  money, pad, toTree, assertParsed,
  assertSettlementSeriesIsPassThrough, settlementPerYearDrift,
  makeSettlementSeriesIndex, SETTLEMENT_SERIES_RESIDUES,
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
  oracleChecks, auditSettlementSeries,
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

  // ⚠ Every entity must render its provenance chip — the exact defect
  // src/data/sourceChipTypes.ts was written to record. This test is the only
  // guard available, because the repo can run no component tests.
  it('types every entity so the source chip renders', () => {
    for (const e of PA_IN_KNIGHT_ENTITIES) {
      expect(SOURCE_CHIP_ENTITY_TYPES.has(e.entityType), `${e.name} is ${e.entityType}`).toBe(true);
    }
  });

  /**
   * ⚠⚠ REPLACES `never types a PA borough as borough`, 2026-09-07.
   *
   * That test pinned a WORKAROUND — State College was typed `municipality`
   * because `borough` was missing from SOURCE_CHIP_ENTITY_TYPES. Three things
   * made it wrong to keep:
   *
   *   1. `borough` is now in the chip set, so the reason is gone.
   *   2. The #133 statewide sweep made `borough` real and seeded 949 of them.
   *      State College is `borough` IN THE DATABASE and all 20 of its rows come
   *      from that family — so the old assertion described a row that does not
   *      exist. It read this registry constant, never the database, which is why
   *      it stayed green.
   *   3. `treasury_ensure_municipality` keys on (name, state, ENTITY_TYPE), so a
   *      re-run of loadPaDced.mjs with `municipality` would have created a SECOND
   *      State College and written to it.
   */
  it('types State College by its legal class, matching the row that exists', () => {
    const sc = PA_ENTITIES.find((e) => e.key === 'state-college');
    expect(sc.entityType).toBe('borough');
    expect(sc.dcedName).toBe('STATE COLLEGE BORO');
    // The chip must cover it, or point 1 above has regressed.
    expect(SOURCE_CHIP_ENTITY_TYPES.has('borough')).toBe(true);
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

  // ⚠⚠ `all_funds`, corrected 2026-09-08. Gateway's AFR covers EVERY fund in the
  // treasury, including custodial money a county collects and remits for other
  // taxing units — and under GASB a custodial fund is NOT a governmental fund.
  // The old `total_governmental` label claimed a scope these figures never had:
  // Marion County FY2023 loaded 3.3x the county's own audited governmental-funds
  // revenue while carrying that label. See scripts/data/inGatewayAnomalies.mjs.
  it('uses axis values the constraints allow', () => {
    expect(IN_FUND_SCOPE).toBe('all_funds');
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

/**
 * ── ⚠⚠ THE PASS-THROUGH IDENTITY HOLDS ACROSS THE SERIES, NOT WITHIN A YEAR ──
 *
 * Measured 2026-09-08 over the whole 2011-2025 extract
 * (`scripts/inSettlementSeriesProbe.py`, keyed on (cnty_cd, unit_code) and
 * covering CITY-TOWN as well as COUNTY):
 *
 *   county-years reporting a settlement fund   1,219
 *   over the 2% tolerance PER YEAR                38
 *   counties reporting settlement                 92
 *   over the 2% tolerance PER SERIES                1   (Parke, 2.57%)
 *   city/town-years reporting settlement            0
 *
 * The 38 are a December-collect / January-settle TIMING difference, and the
 * pairs are equal and opposite across adjacent years: Scott FY2023 +9,193,538.46
 * against FY2024 -9,193,538.46, exactly offsetting. A per-year gate cannot see
 * that, which is the $735M `Fund_code` lesson again — read the SERIES.
 */
describe('Indiana settlement funds — the series-level pass-through gate', () => {
  it('accepts a series whose settlement receipts and disbursements tie', () => {
    const res = assertSettlementSeriesIsPassThrough(
      { countyCode: '45', unitCode: '0000', r: 799_271_207.07, d: 799_270_607.06 },
      'Lake County 2011-2025');
    expect(res.ok).toBe(true);
    expect(res.drift).toBeLessThan(0.0001);
  });

  // The whole job of this gate is to catch a MISIDENTIFIED fund — real revenue
  // wrongly excluded as a pass-through. Moving it per-year -> series must not
  // cost that.
  it('refuses a series that is not a pass-through and has no declared residue', () => {
    expect(() => assertSettlementSeriesIsPassThrough(
      { countyCode: '99', unitCode: '0000', r: 800_000_000, d: 100_000_000 },
      'bogus County 2011-2025')).toThrow(/pass-through/);
  });

  // ⚠⚠ NOT the fix: widening the tolerance. 2% -> 3% admits Parke and silences
  // every future case. An exact declared residue admits exactly one government
  // for exactly one measured reason.
  it('accepts Parke County against its exact declared residue', () => {
    const res = assertSettlementSeriesIsPassThrough(
      { countyCode: '61', unitCode: '0000', r: 203_327_806.75, d: 198_105_852.94 },
      'PARKE COUNTY 2012-2025');
    expect(res.ok).toBe(true);
    expect(res.residueDeclared).toBe(true);
  });

  // A declared residue is a measurement, not a permanent exemption. If Parke
  // settles the money in FY2026 the figure moves, and the loader must say so
  // rather than wave the new number through on the strength of the old one.
  it('refuses when a declared residue no longer matches what was measured', () => {
    expect(() => assertSettlementSeriesIsPassThrough(
      { countyCode: '61', unitCode: '0000', r: 203_327_806.75, d: 150_000_000 },
      'PARKE COUNTY 2012-2025')).toThrow(/declared residue/);
  });

  it('is a no-op for a government with no settlement fund at all', () => {
    const res = assertSettlementSeriesIsPassThrough(
      { countyCode: '53', unitCode: '0361', r: 0, d: 0 }, 'BLOOMINGTON CIVIL CITY');
    expect(res.ok).toBe(true);
    expect(res.drift).toBe(0);
  });

  // ⚠ Parke's residue is corroborated by a DIFFERENT Gateway report: its FY2025
  // settlement fund closes at cash_bal $5,247,151.79, which is the residue. That
  // is why it is declared rather than tolerated.
  it('declares Parke as the only residue, as an exact dollar figure', () => {
    expect(SETTLEMENT_SERIES_RESIDUES.size).toBe(1);
    const parke = SETTLEMENT_SERIES_RESIDUES.get('61|0000');
    expect(parke.residue).toBe(-5_221_953.81);
    expect(parke.why).toMatch(/cash/i);
  });
});

/**
 * ── THE PER-YEAR DRIFT IS A REPORT, NOT A GATE ──────────────────────────────
 *
 * Demoting the per-year check must not mean deleting it. 38 county-years drift,
 * and a reader deserves to see which — silently dropping the signal is how the
 * "22 recoverable filings" precedent went wrong the first time.
 */
describe('Indiana settlement funds — the per-year drift report', () => {
  it('reports every year over tolerance without throwing', () => {
    const rows = settlementPerYearDrift({
      byYear: new Map([
        ['2023', { r: 20_000_000, d: 10_806_461.54 }],
        ['2024', { r: 10_806_461.54, d: 20_000_000 }],
        ['2025', { r: 5_000_000, d: 5_000_000 }],
      ]),
    });
    expect(rows.filter((x) => x.over).map((x) => x.year)).toEqual(['2023', '2024']);
    expect(rows.find((x) => x.year === '2025').over).toBe(false);
  });

  it('shows the offsetting pairs that prove a timing difference', () => {
    const rows = settlementPerYearDrift({
      byYear: new Map([
        ['2023', { r: 20_000_000, d: 10_806_461.54 }],
        ['2024', { r: 10_806_461.54, d: 20_000_000 }],
      ]),
    });
    const [a, b] = rows;
    expect(a.delta + b.delta).toBeCloseTo(0, 2);
  });
});

/**
 * ── ⚠⚠ THE SERIES MUST BE READ EVEN WHEN ONE YEAR IS LOADED ─────────────────
 *
 * The loader REFUSES a 15-year run: 39,600 accumulators over 443 MB exhausts the
 * heap, so the statewide sweep is driven per `--fy`. A series assertion that
 * only saw the loaded year would be the per-year gate again under a new name.
 *
 * So the settlement series is accumulated for EVERY year in the extract, on the
 * same single pass, holding two numbers per government-year rather than a whole
 * accumulator.
 */
describe('Indiana settlement series index', () => {
  const REC_HEADER = 'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id'
    + '|afr_unit_type|unit_name|ent_id|ent_name|Fund_code|unit_fund_number|fund_name'
    + '|receipt_class_code|Receipt_Class_Name|Receipt_Code|section|other_item_flag'
    + '|receipt_name|Unit_account_number|Unit_account_name|amount|';
  const ix = headerIndex(REC_HEADER);

  /** One Detailed Receipts row, by column NAME — never by position. */
  const row = ({ year, cc = '61', uc = '0000', name = 'PARKE COUNTY', fund = '106000',
    fundName = 'Settlement', ent = GOVERNMENTAL_ENT_NAME, amount }) => splitLine(
    [year, cc, 'PARKE', 'County', uc, '9999', 'County', name, '1', ent, fund, '0000',
      fundName, '01', 'Taxes', 'R101', 'A', 'N', 'General Property Taxes', '1', 'x',
      String(amount), ''].join('|'));

  const entities = [{ countyCode: '61', unitCode: '0000', name: 'Parke County' }];

  it('sums settlement across every year, not just the one being loaded', () => {
    const idx = makeSettlementSeriesIndex(entities);
    idx.consume(row({ year: '2024', amount: 17_085_334.00 }), ix, 'revenue');
    idx.consume(row({ year: '2025', amount: 18_071_815.85 }), ix, 'revenue');
    const entry = idx.result().get('61|0000');
    expect(entry.r).toBeCloseTo(35_157_149.85, 2);
    expect([...entry.byYear.keys()]).toEqual(['2024', '2025']);
  });

  it('keeps receipts and disbursements on their own sides', () => {
    const idx = makeSettlementSeriesIndex(entities);
    idx.consume(row({ year: '2025', amount: 18_071_815.85 }), ix, 'revenue');
    idx.consume(row({ year: '2025', amount: 12_824_664.03 }), ix, 'operating');
    const entry = idx.result().get('61|0000');
    expect(entry.byYear.get('2025')).toEqual({ r: 18_071_815.85, d: 12_824_664.03 });
  });

  // ⚠ Non-settlement funds are the money we LOAD. If they leaked into the series
  // the gate would be measuring ordinary revenue against ordinary spending.
  it('ignores funds that are not settlement funds', () => {
    const idx = makeSettlementSeriesIndex(entities);
    idx.consume(row({ year: '2025', fund: '100000', fundName: 'General', amount: 9_000_000 }),
      ix, 'revenue');
    expect(idx.result().get('61|0000')).toBeUndefined();
  });

  // ⚠ Exact whitelist on `ent_name` — a utility's settlement is not the county's.
  it('ignores enterprise rows', () => {
    const idx = makeSettlementSeriesIndex(entities);
    idx.consume(row({ year: '2025', ent: 'WATER UTILITY', amount: 5_000_000 }), ix, 'revenue');
    expect(idx.result().get('61|0000')).toBeUndefined();
  });

  it('ignores governments that are not in scope', () => {
    const idx = makeSettlementSeriesIndex(entities);
    idx.consume(row({ year: '2025', cc: '45', name: 'LAKE COUNTY', amount: 799_271_207 }),
      ix, 'revenue');
    expect(idx.result().size).toBe(0);
  });

  // ⚠⚠ Gateway renumbered Lake's settlement fund to 900334 for FY2022 alone. The
  // series must follow the FUND, not the code, or it compares 14 years of
  // receipts against 15 of disbursements.
  it('follows a renumbered settlement fund into the same series', () => {
    const idx = makeSettlementSeriesIndex([{ countyCode: '45', unitCode: '0000', name: 'Lake' }]);
    idx.consume(row({ year: '2021', cc: '45', fund: '106000', amount: 733_654_569 }), ix, 'revenue');
    idx.consume(row({ year: '2022', cc: '45', fund: '900334', amount: 735_638_546 }), ix, 'revenue');
    const entry = idx.result().get('45|0000');
    expect(entry.r).toBeCloseTo(1_469_293_115, 2);
  });
});

/**
 * ── THE LOADER'S SETTLEMENT AUDIT ───────────────────────────────────────────
 *
 * One place that walks every government's settlement series, refuses on the
 * series and REPORTS the per-year drift. The report is the part that must not
 * be lost: 38 county-years drift over 2%, and the Michigan "22 recoverable
 * filings" precedent is that a demoted check has to stay visible.
 */
describe('Indiana loader settlement audit', () => {
  const entry = (countyCode, name, years) => ({
    countyCode, unitCode: '0000', name,
    r: [...years.values()].reduce((s, y) => s + y.r, 0),
    d: [...years.values()].reduce((s, y) => s + y.d, 0),
    byYear: years,
  });

  it('passes a county whose years drift but whose series nets out', () => {
    const lines = [];
    const series = new Map([['91|0000', entry('91', 'SCOTT COUNTY', new Map([
      ['2023', { r: 20_000_000, d: 10_806_461.54 }],
      ['2024', { r: 10_806_461.54, d: 20_000_000 }],
    ]))]]);
    const summary = auditSettlementSeries(series, { log: (m) => lines.push(m) });
    expect(summary.governments).toBe(1);
    expect(summary.overYears).toBe(2);
    // ⚠ The drifting years must be NAMED, not just counted.
    expect(lines.join('\n')).toMatch(/2023/);
    expect(lines.join('\n')).toMatch(/2024/);
  });

  it('refuses the load and names the government when a series does not net out', () => {
    const series = new Map([['99|0000', entry('99', 'BOGUS COUNTY', new Map([
      ['2024', { r: 800_000_000, d: 100_000_000 }],
    ]))]]);
    expect(() => auditSettlementSeries(series, { log: () => {} }))
      .toThrow(/BOGUS COUNTY/);
  });

  it('counts a declared residue separately from a clean tie', () => {
    const series = new Map([
      ['61|0000', entry('61', 'PARKE COUNTY', new Map([
        ['2025', { r: 203_327_806.75, d: 198_105_852.94 }],
      ]))],
      ['45|0000', entry('45', 'LAKE COUNTY', new Map([
        ['2023', { r: 799_271_207.07, d: 799_270_607.06 }],
      ]))],
    ]);
    const summary = auditSettlementSeries(series, { log: () => {} });
    expect(summary.governments).toBe(2);
    expect(summary.declaredResidues).toEqual(['PARKE COUNTY']);
  });

  // ⚠⚠ Silence is not a pass. 0 of 568 cities and towns report a settlement
  // fund, so a city-only run audits nothing — and must say so rather than print
  // a reassuring green line.
  it('reports zero governments rather than a pass when nothing reports settlement', () => {
    const summary = auditSettlementSeries(new Map(), { log: () => {} });
    expect(summary.governments).toBe(0);
  });
});

/**
 * ── ⚠⚠ A ONE-SIDED YEAR IS NOT A TIMING DIFFERENCE ──────────────────────────
 *
 * The timing story — property tax collected in December, settled in January —
 * is proven by EQUAL AND OPPOSITE pairs in adjacent years. A year with money on
 * only ONE side is a different animal, and conflating the two hid a big finding:
 *
 *   Marion County FY2024   settlement in $0.00   out $71,482,508.88
 *
 * Marion's settlement fund ran $1.05-1.85 BILLION every year 2011-2023. Its
 * FY2024 and FY2025 filings carry a $71.5M fragment and $2.09M respectively, and
 * its NET receipts fall from $1,558,918,179.86 (FY2023) to $607,214,107.07
 * (FY2024) — a 61% collapse that persists into FY2025, with ~$950M of
 * NON-settlement receipts missing too. The money did not move to a city unit:
 * Indianapolis is consolidated and files AS the county, and Marion's other
 * municipalities are flat.
 *
 * The series gate passes Marion, correctly — the pass-through identity does hold
 * across the series. So the one-sided years must be reported SEPARATELY, or the
 * only signal of a collapsed filing reads as routine December/January drift.
 */
describe('Indiana settlement funds — one-sided years are flagged apart', () => {
  it('marks a year with money on only one side', () => {
    const rows = settlementPerYearDrift({
      byYear: new Map([['2024', { r: 0, d: 71_482_508.88 }]]),
    });
    expect(rows[0].oneSided).toBe(true);
  });

  // ⚠ Scott's offsetting pair drifts 100%-ish in neither direction — both sides
  // carry money, so it is drift, not a one-sided filing. Do not conflate them.
  it('does not mark an offsetting pair as one-sided', () => {
    const rows = settlementPerYearDrift({
      byYear: new Map([
        ['2023', { r: 20_000_000, d: 10_806_461.54 }],
        ['2024', { r: 10_806_461.54, d: 20_000_000 }],
      ]),
    });
    expect(rows.every((x) => x.oneSided === false)).toBe(true);
  });

  it('does not mark a year that is empty on both sides', () => {
    const rows = settlementPerYearDrift({ byYear: new Map([['2024', { r: 0, d: 0 }]]) });
    expect(rows[0].oneSided).toBe(false);
  });

  it('counts and names one-sided years in the audit, apart from the drift', () => {
    const lines = [];
    const series = new Map([['49|0000', {
      countyCode: '49', unitCode: '0000', name: 'MARION COUNTY',
      r: 71_482_508.88, d: 71_482_508.88,
      byYear: new Map([
        ['2023', { r: 71_482_508.88, d: 0 }],
        ['2024', { r: 0, d: 71_482_508.88 }],
      ]),
    }]]);
    const summary = auditSettlementSeries(series, { log: (m) => lines.push(m) });
    expect(summary.oneSidedYears).toBe(2);
    expect(lines.join('\n')).toMatch(/ONE SIDE ONLY/);
  });
});
