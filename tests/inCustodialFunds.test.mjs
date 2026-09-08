import { describe, it, expect } from 'vitest';

import {
  makeCustodialFundIndex, custodialFundKey, headerIndex, splitLine, makeAccumulator,
  GOVERNMENTAL_ENT_NAME, PAYROLL_CLEARING_RECEIPT_CODE, PAYROLL_CLEARING_DOMINANCE,
} from '../scripts/lib/inGateway.mjs';

/**
 * ── ⚠⚠ WHY PAYROLL CLEARING IS EXCLUDED BY FUND, NOT BY CODE ────────────────
 *
 * Chris, 2026-09-08, chose a narrower own-funds scope for Indiana counties. A
 * TRUE own-funds scope is NOT derivable from this source — measured, the most
 * principled available rule still leaves Marion County at 1.87x its own audited
 * revenue while wrongly deleting real county money (financial institution tax,
 * overweight vehicle fines, surtax, sewage collections), and 76% of the $3.76B
 * sitting in the R913 catch-all is unclassifiable either way. So the counties go
 * to their own audited ACFRs for that, and THIS is the one clean narrowing the
 * Gateway extract does support.
 *
 * ⚠ NOT BY CODE, though the repo's usual rule is "match the code, never the
 * name". Two measurements forced the fund-level shape:
 *
 *   1. D702 "Payment of Taxes and Other Payroll Withholdings" is NOT confined to
 *      clearing funds — 11% of it (counties) sits in operating funds, where it
 *      is REAL employer payroll tax. Excluding the code would delete ~$85M of
 *      genuine spending statewide.
 *   2. Excluding R909 receipts alone would be ASYMMETRIC: revenue would fall by
 *      $967.7M (counties FY2023) with no matching disbursement exclusion, and TT
 *      would invent a surplus. Every other exclusion here is a PAIR (R910/D704,
 *      R901/D900).
 *
 * A fund-level rule is symmetric by construction. Measured asymmetry of what it
 * removes: 0.15% for counties, 0.33% for cities — it takes matched money out.
 *
 * ⚠⚠ AND IT MUST BE DOMINANCE, NOT PRESENCE. General funds carry small R909
 * amounts (a county "General Fund" at 1.4%, a city "GENERAL FUND" at 2.9%), so
 * "the fund touches R909" would DELETE GENERAL FUNDS. The population is cleanly
 * bimodal — 565 county funds are >=95% R909 and only 34 sit in the 50-95% band —
 * so the threshold separates two distinct populations rather than splitting one.
 * Sensitivity measured: county receipts removed move only ~9% across a 50%-99%
 * threshold sweep.
 */
describe('Indiana custodial payroll-clearing funds', () => {
  const HEADER = 'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id'
    + '|afr_unit_type|unit_name|ent_id|ent_name|Fund_code|unit_fund_number|fund_name'
    + '|receipt_class_code|Receipt_Class_Name|Receipt_Code|section|other_item_flag'
    + '|receipt_name|Unit_account_number|Unit_account_name|amount|';
  const ix = headerIndex(HEADER);

  const row = ({ year = '2023', cc = '49', uc = '0000', fund = '105100',
    fundName = 'Payroll Clearing', code = 'R909', ent = GOVERNMENTAL_ENT_NAME,
    amount }) => splitLine(
    [year, cc, 'MARION', 'County', uc, '9999', 'County', 'MARION COUNTY', '1', ent,
      fund, '0000', fundName, '900', 'Other Receipts', code, '0', 'False',
      'Payroll Fund and Clearing Account Receipts', '1', 'x', String(amount), ''].join('|'));

  const entities = [{ countyCode: '49', unitCode: '0000', name: 'Marion County' }];

  it('flags a fund whose receipts are entirely payroll clearing', () => {
    const idx = makeCustodialFundIndex(entities);
    idx.consume(row({ amount: 101_875_285.53 }), ix);
    expect(idx.result().has(custodialFundKey('49', '0000', 'Payroll Clearing'))).toBe(true);
  });

  // ⚠⚠ THE ONE THAT MATTERS. A general fund carrying a little R909 must survive.
  it('does NOT flag a general fund that carries a small payroll-clearing amount', () => {
    const idx = makeCustodialFundIndex(entities);
    idx.consume(row({ fund: '101000', fundName: 'General Fund', code: 'R909', amount: 781_637 }), ix);
    idx.consume(row({ fund: '101000', fundName: 'General Fund', code: 'R101', amount: 55_049_630 }), ix);
    expect(idx.result().has(custodialFundKey('49', '0000', 'General Fund'))).toBe(false);
  });

  it('applies the dominance threshold, not mere presence', () => {
    const below = makeCustodialFundIndex(entities);
    below.consume(row({ fundName: 'Mixed Fund', code: 'R909', amount: 94 }), ix);
    below.consume(row({ fundName: 'Mixed Fund', code: 'R101', amount: 6 }), ix);
    expect(below.result().has(custodialFundKey('49', '0000', 'Mixed Fund'))).toBe(false);

    const above = makeCustodialFundIndex(entities);
    above.consume(row({ fundName: 'Mostly Clearing', code: 'R909', amount: 96 }), ix);
    above.consume(row({ fundName: 'Mostly Clearing', code: 'R101', amount: 4 }), ix);
    expect(above.result().has(custodialFundKey('49', '0000', 'Mostly Clearing'))).toBe(true);
  });

  // ⚠⚠ SERIES, NOT YEAR — the settlement lesson again. If a fund could flip
  // classification year to year, TT would manufacture the very discontinuity
  // this whole investigation started from.
  it('classifies over the whole series, not one year at a time', () => {
    const idx = makeCustodialFundIndex(entities);
    // A clearing fund that happens to book one odd non-R909 receipt in one year
    // must still be a clearing fund across the series.
    idx.consume(row({ year: '2022', code: 'R909', amount: 100_000_000 }), ix);
    idx.consume(row({ year: '2023', code: 'R101', amount: 1_000_000 }), ix);
    idx.consume(row({ year: '2024', code: 'R909', amount: 100_000_000 }), ix);
    expect(idx.result().has(custodialFundKey('49', '0000', 'Payroll Clearing'))).toBe(true);
  });

  // ⚠ Keyed on the fund NAME, because `Fund_code` is not stable across years —
  // the $735M Lake County lesson. Marion's payroll fund is 105100 through FY2023
  // and 990001 from FY2024.
  it('follows a renumbered clearing fund by name', () => {
    const idx = makeCustodialFundIndex(entities);
    idx.consume(row({ year: '2023', fund: '105100', fundName: 'Payroll Fund', amount: 5 }), ix);
    idx.consume(row({ year: '2024', fund: '990001', fundName: 'Payroll Fund', amount: 5 }), ix);
    const keys = [...idx.result()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(custodialFundKey('49', '0000', 'Payroll Fund'));
  });

  it('ignores enterprise rows and out-of-scope governments', () => {
    const idx = makeCustodialFundIndex(entities);
    idx.consume(row({ ent: 'WATER UTILITY', amount: 9_000_000 }), ix);
    idx.consume(row({ cc: '45', amount: 9_000_000 }), ix);
    expect(idx.result().size).toBe(0);
  });

  it('exposes the code and threshold it was measured with', () => {
    expect(PAYROLL_CLEARING_RECEIPT_CODE).toBe('R909');
    expect(PAYROLL_CLEARING_DOMINANCE).toBe(0.95);
  });

  it('is case- and whitespace-insensitive on the fund name', () => {
    expect(custodialFundKey('49', '0000', '  PAYROLL Clearing '))
      .toBe(custodialFundKey('49', '0000', 'payroll clearing'));
  });
});

/**
 * ── THE ACCUMULATOR MUST EXCLUDE THEM FROM THE SUBSET, NOT FROM THE ORACLE ──
 *
 * ⚠⚠ `byFund` is the ORACLE's number and must keep the FULL governmental parse,
 * exactly as it does for settlement. Proving the READ and choosing the SCOPE are
 * two different jobs — narrow the oracle to match the subset and it stops being
 * able to catch a misread.
 */
describe('Indiana accumulator with payroll clearing excluded', () => {
  const HEADER2 = 'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id'
    + '|afr_unit_type|unit_name|ent_id|ent_name|Fund_code|unit_fund_number|fund_name'
    + '|receipt_class_code|Receipt_Class_Name|Receipt_Code|section|other_item_flag'
    + '|receipt_name|Unit_account_number|Unit_account_name|amount|';
  const ix2 = headerIndex(HEADER2);
  const mkRow = ({ fund, fundName, code, name, amount }) => splitLine(
    ['2023', '49', 'MARION', 'County', '0000', '9999', 'County', 'MARION COUNTY', '1',
      GOVERNMENTAL_ENT_NAME, fund, '0000', fundName, '900', 'Taxes and Intergovernmental',
      code, '0', 'False', name, '1', 'x', String(amount), ''].join('|'));
  const entity = { countyCode: '49', unitCode: '0000', name: 'Marion County' };

  it('keeps clearing money out of the loaded subset but inside the oracle parse', () => {
    const acc = makeAccumulator({
      entity, year: 2023, kind: 'revenue',
      custodialFunds: new Set([custodialFundKey('49', '0000', 'Payroll Clearing')]),
    });
    acc.consume(mkRow({ fund: '105100', fundName: 'Payroll Clearing', code: 'R909',
      name: 'Payroll Fund and Clearing Account Receipts', amount: 101_875_285.53 }), ix2);
    acc.consume(mkRow({ fund: '101000', fundName: 'General Fund', code: 'R101',
      name: 'General Property Taxes', amount: 266_918_809.15 }), ix2);
    const res = acc.result();

    expect(res.subsetTotal).toBeCloseTo(266_918_809.15, 2);
    expect(res.custodialTotal).toBeCloseTo(101_875_285.53, 2);
    // full parse and oracle keep everything
    expect(res.fullTotal).toBeCloseTo(368_794_094.68, 2);
    expect(res.byFund.get('105100|0000')).toBeCloseTo(101_875_285.53, 2);
    // and the tree a reader sees carries only the general fund's money
    expect([...res.tree.keys()]).toEqual(['Taxes and Intergovernmental']);
    expect(res.tree.get('Taxes and Intergovernmental').get('General Property Taxes'))
      .toBeCloseTo(266_918_809.15, 2);
  });

  it('changes nothing when no fund is classified custodial', () => {
    const acc = makeAccumulator({ entity, year: 2023, kind: 'revenue', custodialFunds: new Set() });
    acc.consume(mkRow({ fund: '105100', fundName: 'Payroll Clearing', code: 'R909',
      name: 'Payroll Fund and Clearing Account Receipts', amount: 500 }), ix2);
    const res = acc.result();
    expect(res.subsetTotal).toBe(500);
    expect(res.custodialTotal).toBe(0);
  });

  it('excludes the fund on the DISBURSEMENT side too, so the sides stay comparable', () => {
    const acc = makeAccumulator({
      entity, year: 2023, kind: 'operating',
      custodialFunds: new Set([custodialFundKey('49', '0000', 'Payroll Clearing')]),
    });
    // the disbursement header names differ; reuse the receipt header shape for
    // the columns the accumulator reads, with a disburse code column present.
    const DHEADER = 'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id'
      + '|afr_unit_type|unit_name|ent_id|ent_name|Fund_code|unit_fund_number|fund_name'
      + '|disburse_class_code|class_name|disburse_code|section|disburse_name|amount|';
    const dix = headerIndex(DHEADER);
    const drow = (fundName, code, name, amount) => splitLine(
      ['2023', '49', 'MARION', 'County', '0000', '9999', 'County', 'MARION COUNTY', '1',
        GOVERNMENTAL_ENT_NAME, '105100', '0000', fundName, '700', 'Other Disbursements',
        code, '0', name, String(amount), ''].join('|'));
    acc.consume(drow('Payroll Clearing', 'D702', 'Payment of Taxes and Other Payroll Withholdings',
      101_564_084.55), dix);
    const res = acc.result();
    expect(res.subsetTotal).toBe(0);
    expect(res.custodialTotal).toBeCloseTo(101_564_084.55, 2);
  });
});

/**
 * ── ⚠⚠ ONE YEAR OF MISCODING MUST NOT RECLASSIFY A FUND ─────────────────────
 *
 * The first version of this rule measured R909 as a share of the fund's
 * receipts SUMMED OVER THE SERIES, and it MISSED THE MOST IMPORTANT CASE.
 * Marion County's "payroll clearing" fund is 92.24% R909 across its series —
 * just under the threshold — because FY2020's $275,260,415.64 was coded R913
 * (the catch-all) instead of R909. So the rule excluded Marion's small "gross
 * county payroll" fund (100% R909, $318M) and KEPT the fund whose FY2019 figure
 * is $1,988,575,425.58.
 *
 * ⚠⚠ THE FIX IS NOT A LOOSER THRESHOLD. Dropping 95% to 90% would admit this one
 * case and quietly move every future one — the same reasoning that refused to
 * widen the settlement tolerance for Parke County. The fix is a classifier that
 * describes the fund's CHARACTER: in most of the years it reports, is this fund
 * essentially nothing but payroll clearing? A dollar-weighted series share lets
 * a single large miscoded year dominate; a per-year majority does not.
 */
describe('Indiana custodial classification is robust to one bad year', () => {
  const HEADER3 = 'year|cnty_cd|cnty_description|budget_unit_type|unit_code|sboa_id'
    + '|afr_unit_type|unit_name|ent_id|ent_name|Fund_code|unit_fund_number|fund_name'
    + '|receipt_class_code|Receipt_Class_Name|Receipt_Code|section|other_item_flag'
    + '|receipt_name|Unit_account_number|Unit_account_name|amount|';
  const ix3 = headerIndex(HEADER3);
  const r = (year, code, amount, fundName = 'Payroll Clearing') => splitLine(
    [year, '49', 'MARION', 'County', '0000', '9999', 'County', 'MARION COUNTY', '1',
      GOVERNMENTAL_ENT_NAME, '105100', '0000', fundName, '900', 'Other Receipts', code,
      '0', 'False', 'x', '1', 'x', String(amount), ''].join('|'));
  const entities = [{ countyCode: '49', unitCode: '0000', name: 'Marion County' }];

  // Marion's real shape: R909 in every year except FY2020, which is R913 and big.
  it('still classifies a clearing fund whose one big year is miscoded', () => {
    const idx = makeCustodialFundIndex(entities);
    for (const y of ['2016', '2017', '2018', '2021', '2022', '2023']) {
      idx.consume(r(y, 'R909', 180_000_000), ix3);
    }
    idx.consume(r('2019', 'R909', 1_988_575_425.58), ix3);
    idx.consume(r('2020', 'R913', 275_260_415.64), ix3);   // the miscoded year
    expect(idx.result().has(custodialFundKey('49', '0000', 'Payroll Clearing'))).toBe(true);
  });

  // ⚠ And the protection must survive: a general fund with a little R909 every
  // year is still a general fund, however many years it reports.
  it('still refuses to classify a general fund', () => {
    const idx = makeCustodialFundIndex(entities);
    for (const y of ['2019', '2020', '2021', '2022', '2023']) {
      idx.consume(r(y, 'R909', 781_637, 'General Fund'), ix3);
      idx.consume(r(y, 'R101', 55_049_630, 'General Fund'), ix3);
    }
    expect(idx.result().has(custodialFundKey('49', '0000', 'General Fund'))).toBe(false);
  });

  // A fund that is only sometimes clearing is not a clearing fund.
  it('requires a majority of years, not a single one', () => {
    const idx = makeCustodialFundIndex(entities);
    idx.consume(r('2019', 'R909', 1_000_000, 'Occasional'), ix3);
    for (const y of ['2020', '2021', '2022']) {
      idx.consume(r(y, 'R101', 1_000_000, 'Occasional'), ix3);
    }
    expect(idx.result().has(custodialFundKey('49', '0000', 'Occasional'))).toBe(false);
  });
});
