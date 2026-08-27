/**
 * loadWICMREB.js — tie-gate and layout tests.
 *
 * The gate is the whole safety argument for this loader (MAD-02), so these tests
 * exist mainly to prove it FAILS when it should. A gate that cannot fail is
 * worthless; the Gresham retrofit (593792a) is the cautionary case.
 *
 * Run: npx vitest run scripts/loadWICMREB.test.mjs
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  assertTies, identities, REVENUE_LEAVES, EXPENDITURE_LEAVES,
  SOURCE_ROUNDING, sourceUrlForYear, SHEET_FOR_ENTITY, cellNum, cellText,
} from './loadWICMREB.js';

/** Madison CY2024, exactly as published. Every figure re-derived from the workbook. */
const MADISON_2024 = {
  'General Property Taxes': 286236816, 'Tax Increments': 42239787,
  'InLieu of Taxes': 1364313, 'Other Taxes': 23716443, 'Total Taxes': 353557359,
  'Special Assessments': 2775007,
  'Federal Aids': 141408557, 'State Shared Revenues': 22388195,
  'State Highway Aids': 13872371, 'All Other State Aids': 13170430,
  'Other Local Govt Aids': 7810061, 'Total Inter Government Revenues': 198649614,
  'Licenses and Permits': 11645899, 'Fines, Forfeits and Penalties': 6711034,
  'Public Charges for Services': 36908764, 'Intergovernmental Charges for Services': 1115825,
  'Interest Income': 32738598, 'Other Revenues': 5399130,
  'Total Miscellaneous Revenues': 38137728, 'Subtotal-General Revenues': 649501230,
  'Other Financing Sources': 350787463, 'Total Revenue and Other Financing Sources': 1000288693,
  'General Government': 53989841, 'Law Enforcement': 95590243, 'Fire': 73313270,
  'Ambulance': 0, 'Other Public Safety': 7703819,
  'Highway Maintainence and Administration': 31262234, 'Highway Construction': 26458682,
  'Road- Related Facilities': 13470961, 'Other Transportation': 115296578,
  'Solid Waste Collection and Disposal': 18302681, 'Other Sanitation': 100000,
  'Health and Human Services': 33911161, 'Culture and Education': 32816562,
  'Parks and Recreation': 37628222, 'Conservation and Development': 125681173,
  'All Other Expenditures': 0,
  'Sub-total Operation and Capital Expenditure': 665525427,
  'Debt Service - Principal Interest': 75198389, 'Debt Service - Fiscal Changes': 18068282,
  'Total Debt Service': 93266671, 'Sub-total Expenditure': 758792098,
  'Other Financing Uses': 252948525, 'Total Expenditures and Other Financing Uses': 1011740623,
};

const getter = (o) => (k) => (k in o ? o[k] : 0);
const CTX = { municipality: 'MADISON', fiscalYear: 2024 };

test('all nine identities hold for real published data', () => {
  assert.doesNotThrow(() => assertTies(getter(MADISON_2024), CTX));
  assert.equal(identities(getter(MADISON_2024)).length, 9);
  for (const [name, computed, printed] of identities(getter(MADISON_2024))) {
    assert.equal(computed, printed, `${name} should tie`);
  }
});

test('Total Miscellaneous Revenues covers ONLY Interest Income + Other Revenues', () => {
  // The layout trap. If the four direct-charge columns were wrongly folded in,
  // this sum would be 94,519,250 instead of the printed 38,137,728.
  const m = MADISON_2024;
  assert.equal(m['Interest Income'] + m['Other Revenues'], m['Total Miscellaneous Revenues']);
  const wrong = m['Interest Income'] + m['Other Revenues'] + m['Licenses and Permits']
    + m['Fines, Forfeits and Penalties'] + m['Public Charges for Services']
    + m['Intergovernmental Charges for Services'];
  assert.equal(wrong - m['Total Miscellaneous Revenues'], 56381522,
    'the misgrouping should be off by exactly the known +$56,381,522');
});

test('a corrupted component FAILS the gate', () => {
  for (const col of ['General Property Taxes', 'Federal Aids', 'Law Enforcement',
    'Debt Service - Principal Interest']) {
    const bad = { ...MADISON_2024, [col]: MADISON_2024[col] + 1000 };
    assert.throws(() => assertTies(getter(bad), CTX), /TIE FAILURE/,
      `corrupting ${col} must fail the gate`);
  }
});

test('a corrupted printed subtotal FAILS the gate', () => {
  const bad = { ...MADISON_2024, 'Subtotal-General Revenues': 649501231 };
  assert.throws(() => assertTies(getter(bad), CTX), /TIE FAILURE/);
});

test('the leading-digit truncation class of bug FAILS the gate', () => {
  // The Gresham failure mode: an 8-digit amount silently loses its first digit.
  const bad = { ...MADISON_2024, 'Conservation and Development': 25681173 };
  assert.throws(() => assertTies(getter(bad), CTX), /TIE FAILURE/);
});

test('a dropped leaf FAILS the gate', () => {
  const bad = { ...MADISON_2024, 'Other Transportation': 0 };
  assert.throws(() => assertTies(getter(bad), CTX), /TIE FAILURE/);
});

test('the failure message names every broken identity and its delta', () => {
  const bad = { ...MADISON_2024, 'General Property Taxes': MADISON_2024['General Property Taxes'] - 500 };
  try {
    assertTies(getter(bad), CTX);
    assert.fail('should have thrown');
  } catch (e) {
    assert.match(e.message, /MADISON CY2024/);
    assert.match(e.message, /Total Taxes/);
    assert.match(e.message, /-500/);
  }
});

test('SOURCE_ROUNDING accepts only an EXACT delta', () => {
  const bad = { ...MADISON_2024, 'Total Taxes': MADISON_2024['Total Taxes'] - 7,
    'Subtotal-General Revenues': MADISON_2024['Subtotal-General Revenues'] - 7 };
  // Unregistered: must fail.
  assert.throws(() => assertTies(getter(bad), CTX), /TIE FAILURE/);
  // Registered with the WRONG delta: must still fail.
  SOURCE_ROUNDING['Total Taxes|2024|MADISON'] = 6;
  assert.throws(() => assertTies(getter(bad), CTX), /TIE FAILURE/);
  // Registered with the exact delta: that one identity is accepted, and only it.
  // Docking 7 off both Total Taxes and Subtotal-General Revenues keeps the
  // Subtotal identity intact (Total Taxes feeds it) and pushes the break one
  // level up, to Total Revenue and Other Financing Sources — which must still fail.
  SOURCE_ROUNDING['Total Taxes|2024|MADISON'] = 7;
  try {
    assert.throws(() => assertTies(getter(bad), CTX), (e) => {
      assert.doesNotMatch(e.message, /"Total Taxes"/, 'Total Taxes should have been accepted');
      assert.match(e.message, /Total Revenue and Other Financing Sources/);
      return true;
    });
  } finally {
    delete SOURCE_ROUNDING['Total Taxes|2024|MADISON'];
  }
});

test('SOURCE_ROUNDING ships empty — no year currently needs it', () => {
  assert.deepEqual(SOURCE_ROUNDING, {},
    'all 86,472 checks passed at 2026-07-27; an entry appearing here needs justification');
});

test('trees exclude Other Financing Sources/Uses and every printed subtotal', () => {
  const banned = ['Other Financing Sources', 'Other Financing Uses',
    'Total Taxes', 'Total Inter Government Revenues', 'Total Miscellaneous Revenues',
    'Subtotal-General Revenues', 'Total Revenue and Other Financing Sources',
    'Sub-total Operation and Capital Expenditure', 'Total Debt Service',
    'Sub-total Expenditure', 'Total Expenditures and Other Financing Uses',
    'Total General Obligation Debt', 'Propriety Funds - Revenues', 'Propriety Funds - Expenses'];
  for (const b of banned) {
    assert.ok(!REVENUE_LEAVES.includes(b), `${b} must not be a revenue leaf`);
    assert.ok(!EXPENDITURE_LEAVES.includes(b), `${b} must not be an expenditure leaf`);
  }
  // 4 tax + Special Assessments + 5 intergovernmental + 4 direct-charge + 2 misc
  assert.equal(REVENUE_LEAVES.length, 16);
  // 16 activity functions + 2 debt-service lines
  assert.equal(EXPENDITURE_LEAVES.length, 18);
});

test('leaves sum to the totals the loader emits', () => {
  const g = getter(MADISON_2024);
  assert.equal(REVENUE_LEAVES.reduce((s, n) => s + g(n), 0), MADISON_2024['Subtotal-General Revenues']);
  assert.equal(EXPENDITURE_LEAVES.reduce((s, n) => s + g(n), 0), MADISON_2024['Sub-total Expenditure']);
});

test('source URL uses the upper-case XLSX form', () => {
  assert.equal(sourceUrlForYear(2024),
    'https://www.revenue.wi.gov/SLFReportscotvc/CMREB2024.xlsx');
});

test('every entity type maps to a sheet', () => {
  assert.deepEqual(Object.keys(SHEET_FOR_ENTITY).sort(), ['city', 'county', 'town', 'village']);
});

test('cell helpers tolerate formulas, strings and blanks', () => {
  assert.equal(cellNum({ value: 1234 }), 1234);
  assert.equal(cellNum({ value: { result: 99 } }), 99);
  assert.equal(cellNum({ value: '1,234' }), 1234);
  assert.ok(Number.isNaN(cellNum({ value: null })));
  assert.equal(cellText({ value: { richText: [{ text: 'Mad' }, { text: 'ison' }] } }), 'Madison');
  assert.equal(cellText({ value: '  Dane   County ' }), 'Dane County');
});
