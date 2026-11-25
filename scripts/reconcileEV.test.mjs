import { test } from 'vitest';
import assert from 'node:assert/strict';
import { classifyDeposit, extractDeposits } from './lib/evBankDeposits.js';
import { monthlyBurn, runway, buildIncome, reconcile, buildSummaryRow } from './reconcileEV.js';

test('classifyDeposit maps the four descriptors + unmatched fallback (D-04)', () => {
  assert.deepEqual(classifyDeposit('External Deposit Givebutter  - Givebutter  ST-Q9'), { kind: 'platform', source: 'Give Butter' });
  assert.deepEqual(classifyDeposit('External Deposit Patreon  - Patreon  ST-P8'), { kind: 'platform', source: 'Patreon' });
  assert.deepEqual(classifyDeposit('External Deposit AMER ONLINE GIV1  - EDI PAYMNT  REF*TN*1'), { kind: 'platform', source: 'Benevity' });
  assert.deepEqual(classifyDeposit('Credit Interest'), { kind: 'interest', source: 'Bank Interest' });
  assert.deepEqual(classifyDeposit('Check Deposit Acme Grant'), { kind: 'unmatched', source: null });
});

test('extractDeposits returns only positive FY-matched rows', () => {
  const rows = [
    { Date: '03/02/2026', Description: 'External Deposit AMER ONLINE GIV1', Amount: '$204.65', Balance: '$1' },
    { Date: '06/05/2026', Description: 'RENDER.COM', Amount: '-$98.00', Balance: '$1' }, // debit → excluded
    { Date: '01/06/2025', Description: 'External Deposit Patreon', Amount: '$45.59', Balance: '$1' }, // prior FY → excluded
  ];
  const d = extractDeposits(rows, 2026);
  assert.equal(d.length, 1);
  assert.equal(d[0].amount, 204.65);
  assert.equal(d[0].iso, '2026-03-02');
});

test('monthlyBurn averages the last 3 COMPLETE months and excludes the in-progress month (D-01)', () => {
  const debits = [
    { date: '01/12/2026', amount: 104.60 },
    { date: '02/10/2026', amount: 208.94 },
    { date: '03/15/2026', amount: 276.69 },
    { date: '04/20/2026', amount: 397.92 },
    { date: '05/05/2026', amount: 358.21 },
    { date: '06/17/2026', amount: 399.29 }, // in-progress month (as-of 06-17) → MUST be excluded
  ];
  // as-of 2026-06-17 → complete months Mar+Apr+May = (276.69+397.92+358.21)/3
  const burn = monthlyBurn(debits, '2026-06-17', 3);
  assert.equal(burn, Math.round(((276.69 + 397.92 + 358.21) / 3) * 100) / 100);
  // June must not be in the average
  assert.ok(burn < 399.29);
});

test('runway = balance/burn (1dp); NULL when burn ~0 (no Infinity, D-03)', () => {
  assert.equal(runway(1706.77, 344.27), Math.round((1706.77 / 344.27) * 10) / 10);
  assert.equal(runway(1000, 0), null);
  assert.equal(runway(1000, 0.004), null); // rounds to 0
});

test('buildIncome: net = gross − fee per source; totals sum (D-11)', () => {
  const r = buildIncome({ 'Give Butter': { gross: 810, fee: 49 }, 'Patreon': { gross: 320, fee: 12.26 }, 'Benevity': { gross: 1437.39, fee: 0 } });
  const gb = r.income_by_source.find(s => s.source === 'Give Butter');
  assert.equal(gb.net, 761);
  assert.equal(r.income_gross, 2567.39);
  assert.equal(r.income_net, Math.round((761 + (320 - 12.26) + 1437.39) * 100) / 100);
  // zero-gross sources are dropped
  assert.equal(buildIncome({ 'Give Butter': { gross: 0, fee: 0 } }).income_by_source.length, 0);
});

test('reconcile: variance = platform_net − matched bank deposits; interest + unmatched separated (D-05/07)', () => {
  const income_by_source = [
    { source: 'Give Butter', gross: 810, fee: 0, net: 810 },
    { source: 'Patreon', gross: 320, fee: 12.26, net: 307.74 },
  ];
  const deposits = [
    { iso: '2026-03-23', desc: 'External Deposit Givebutter', amount: 810 },
    { iso: '2026-01-06', desc: 'External Deposit Patreon', amount: 45.59 },
    { iso: '2026-05-29', desc: 'Credit Interest', amount: 0.36 },
    { iso: '2026-04-10', desc: 'Check Deposit Grant', amount: 500 },
  ];
  const r = reconcile(income_by_source, deposits);
  const gb = r.recon_by_source.find(s => s.source === 'Give Butter');
  assert.equal(gb.bank_deposits, 810);
  assert.equal(gb.variance, 0);
  const pat = r.recon_by_source.find(s => s.source === 'Patreon');
  assert.equal(pat.bank_deposits, 45.59);
  assert.equal(pat.variance, Math.round((307.74 - 45.59) * 100) / 100);
  assert.equal(r.interest, 0.36);                 // interest separated, not income here
  assert.equal(r.unmatched_deposits.length, 1);   // the check → flagged
  assert.equal(r.unmatched_deposits[0].amount, 500);
});

// ── recon_explanation is PUBLIC copy, not an operator note ───────────────────
const SRC = [
  { source: 'Give Butter', gross: 1205, fee: 46.51, net: 1158.49 },
];

test('recon_explanation never tells a reader to refresh an export they cannot reach', () => {
  // It published "refresh that export if the gap is unexpected" to a public
  // transparency page for nine weeks. A reader has no export to refresh, and
  // for EV the gap is expected and permanent -- the Givebutter wallet is kept
  // funded on purpose, to stay eligible for donor-matching deals.
  const deposits = [{ iso: '2026-11-24', desc: 'External Deposit Givebutter', amount: 1706.83 }];
  const r = reconcile(SRC, deposits);
  assert.doesNotMatch(r.recon_explanation, /refresh/i);
  assert.doesNotMatch(r.recon_explanation, /export/i);
});

test('recon_explanation: bank ahead of platform net reads as money from outside this year', () => {
  // Negative variance = the bank received MORE than this year's donations net
  // out to, which is what happens when earlier donations are paid out now.
  const deposits = [{ iso: '2026-11-24', desc: 'External Deposit Givebutter', amount: 1706.83 }];
  const r = reconcile(SRC, deposits);
  assert.ok(r.recon_variance < 0, 'precondition: bank ahead');
  assert.match(r.recon_explanation, /Give Butter/);
  assert.match(r.recon_explanation, /\$548\.34/);
  assert.match(r.recon_explanation, /before this year|earlier/i);
});

test('recon_explanation: platform net ahead of bank reads as money not yet arrived', () => {
  // Positive variance = raised but still sitting on the platform.
  const deposits = [{ iso: '2026-11-24', desc: 'External Deposit Givebutter', amount: 900 }];
  const r = reconcile(SRC, deposits);
  assert.ok(r.recon_variance > 0, 'precondition: platform ahead');
  assert.match(r.recon_explanation, /\$258\.49/);
  assert.match(r.recon_explanation, /not .*reached the bank|still/i);
});

test('recon_explanation: a sub-dollar gap gets no driver sentence at all', () => {
  const deposits = [{ iso: '2026-11-24', desc: 'External Deposit Givebutter', amount: 1158.20 }];
  const r = reconcile(SRC, deposits);
  assert.doesNotMatch(r.recon_explanation, /Largest gap/);
});

// ── Reconciliation is operator working-out, not public copy ──────────────────
test('buildSummaryRow publishes no reconciliation narrative or variance', () => {
  // Chris, 2026-11-25: "I don't think that sentence breeds confidence ... it'd
  // make me wary to donate which is terrible." A variance is payout timing, not
  // a discrepancy, and a reader has no way to evaluate it. Publishing the bare
  // number without the sentence would be worse, so all three go.
  const s = {
    fiscal_year: 2026, balance: 2179.46, balance_as_of: '2026-11-24',
    monthly_burn: 573.66, burn_window_months: 3, runway_months: 3.8,
    income_gross: 5445, income_fees: 238.23, income_net: 5206.77,
    income_by_source: [{ source: 'Give Butter', gross: 1205, fee: 46.51, net: 1158.49 }],
    recon_variance: -545.59,
    recon_explanation: 'Platform net ... Largest gap is Give Butter ...',
    recon_by_source: [{ source: 'Give Butter', variance: -548.34, platform_net: 1158.49, bank_deposits: 1706.83 }],
    unmatched_deposits: [], goal_amount: null, goal_label: null,
  };
  const row = buildSummaryRow('muni-1', s);

  // Explicitly null, NOT omitted: an upsert that omits a column leaves the old
  // value live, so the sentence already published would simply stay there.
  assert.equal(row.recon_explanation, null);
  assert.equal(row.recon_variance, null);
  assert.equal(row.recon_by_source, null);
  assert.ok('recon_explanation' in row, 'must be sent as null to clear the stored value');

  const json = JSON.stringify(row);
  assert.doesNotMatch(json, /Largest gap/);
  assert.doesNotMatch(json, /bank_deposits/);
  assert.doesNotMatch(json, /548\.34|545\.59/);
});

test('buildSummaryRow still publishes unmatched deposits — the real anomaly signal', () => {
  // Silence must mean "everything matched". Money we cannot explain still surfaces.
  const s = {
    fiscal_year: 2026, balance: 100, balance_as_of: '2026-11-24',
    monthly_burn: 10, burn_window_months: 3, runway_months: 10,
    income_gross: 0, income_fees: 0, income_net: 0, income_by_source: [],
    recon_variance: 0, recon_explanation: 'x', recon_by_source: [],
    unmatched_deposits: [{ date: '2026-04-10', amount: 500, description: 'Check Deposit Grant' }],
    goal_amount: null, goal_label: null,
  };
  const row = buildSummaryRow('muni-1', s);
  assert.equal(row.unmatched_deposits.length, 1);
  assert.equal(row.unmatched_deposits[0].amount, 500);
});

test('buildSummaryRow keeps the figures the page actually shows', () => {
  const s = {
    fiscal_year: 2026, balance: 2179.46, balance_as_of: '2026-11-24',
    monthly_burn: 573.66, burn_window_months: 3, runway_months: 3.8,
    income_gross: 5445, income_fees: 238.23, income_net: 5206.77,
    income_by_source: [{ source: 'Patreon', gross: 595, fee: 98.77, net: 496.23 }],
    recon_variance: 0, recon_explanation: 'x', recon_by_source: [],
    unmatched_deposits: [], goal_amount: null, goal_label: null,
  };
  const row = buildSummaryRow('muni-1', s);
  assert.equal(row.balance, 2179.46);
  assert.equal(row.income_net, 5206.77);
  assert.equal(row.income_by_source[0].source, 'Patreon');
  assert.equal(row.municipality_id, 'muni-1');
  assert.equal(row.source_name, 'Beneficial State Bank + platform exports');
});
