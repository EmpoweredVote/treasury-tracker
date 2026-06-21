import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  money, isoYear, isoDate,
  parseGiveButter, parsePatreon, parseBenevity,
  giveButterDedup, buildDonationTree,
} from './loadEVDonations.js';

test('money parses $, commas, parens, negatives', () => {
  assert.equal(money('$10.00'), 10);
  assert.equal(money('$1,234.56'), 1234.56);
  assert.equal(money('(200)'), -200);
  assert.equal(money('-40.70'), -40.7);
  assert.equal(money('10.0000'), 10);
  assert.equal(money(''), 0);
});

test('isoYear / isoDate handle ISO and ISO-with-T', () => {
  assert.equal(isoYear('2026-06-20 21:35:12'), 2026);
  assert.equal(isoYear('2026-01-16T00:00:00Z'), 2026);
  assert.equal(isoYear(''), null);
  assert.equal(isoDate('2026-01-16T00:00:00Z'), '2026-01-16');
  assert.equal(isoDate('2026-06-20 21:35:12'), '2026-06-20');
});

test('isoYear handles YYYY-MM (Patreon Month)', () => {
  // Patreon Month is "2026-06" — isoYear matches YYYY-MM prefix
  assert.equal(isoYear('2026-06'), 2026);
});

test('parseGiveButter: gross/fee, filters status + refunds + FY, computes asOf', () => {
  const rows = [
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-06-20 10:00:00', Amount: '$10.00', Fee: '$0.61' },
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-01-05 10:00:00', Amount: '$50.00', Fee: '$1.80' },
    { 'Status Friendly': 'Failed',    'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-02-01 10:00:00', Amount: '$99.00', Fee: '$3.00' }, // not Succeeded
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '2026-03-01', 'Transaction Date (UTC)': '2026-02-15 10:00:00', Amount: '$25.00', Fee: '$1.00' }, // refunded
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2025-12-31 10:00:00', Amount: '$77.00', Fee: '$2.00' }, // prior FY (but counts for asOf horizon? it's < others)
  ];
  const r = parseGiveButter(rows, 2026);
  assert.equal(r.gross, 60);  // 10 + 50
  assert.equal(Number(r.fee.toFixed(2)), 2.41); // 0.61 + 1.80
  assert.equal(r.count, 2);
  assert.equal(r.asOf, '2026-06-20'); // max succeeded, non-refunded date
});

test('parsePatreon: sums monthly gross + abs(fees) for FY', () => {
  const rows = [
    { Month: '2025-12', 'Total gross revenue': '100.00', 'Total platform fee': '-11.00', 'Total payment fee': '-3.00' }, // prior FY
    { Month: '2026-01', 'Total gross revenue': '50.00',  'Total platform fee': '-5.50',  'Total payment fee': '-1.75' },
    { Month: '2026-02', 'Total gross revenue': '20.00',  'Total platform fee': '-2.20',  'Total payment fee': '-0.90' },
  ];
  const r = parsePatreon(rows, 2026);
  assert.equal(r.gross, 70); // 50 + 20
  assert.equal(Number(r.fee.toFixed(2)), 10.35); // 5.50+1.75+2.20+0.90
  assert.equal(r.count, 2);
});

test('parseBenevity: gross = donation + match, fee = 3 fee cols, FY by disbursement date', () => {
  const rows = [
    { 'Disbursement Date': '2026-01-16T00:00:00Z', 'Donation Date': '2025-12-10T00:00:00Z', 'Donation Amount': '10.0000', 'Match Amount': '0.0000', 'Cause Support Fee': '0.26', 'Merchant Fee': '0.00', 'Check Fee': '0.00' },
    { 'Disbursement Date': '2026-02-17T00:00:00Z', 'Donation Date': '2026-02-01T00:00:00Z', 'Donation Amount': '100.0000', 'Match Amount': '25.0000', 'Cause Support Fee': '2.00', 'Merchant Fee': '0.50', 'Check Fee': '0.00' },
    { 'Disbursement Date': '2025-12-16T00:00:00Z', 'Donation Date': '2025-11-01T00:00:00Z', 'Donation Amount': '999.0000', 'Match Amount': '0.0000', 'Cause Support Fee': '9.00', 'Merchant Fee': '0.00', 'Check Fee': '0.00' }, // disbursed prior FY
  ];
  const r = parseBenevity(rows, 2026, 'Disbursement Date');
  assert.equal(r.gross, 135); // 10 + (100+25)
  assert.equal(Number(r.fee.toFixed(2)), 2.76); // 0.26 + 2.00 + 0.50
  assert.equal(r.count, 2);
  // donor-intent basis would split the Dec-2025 gift out; confirm the basis switch changes the result
  const rDon = parseBenevity(rows, 2026, 'Donation Date');
  assert.equal(rDon.gross, 125); // only the 2026-02-01 donation
});

test('giveButterDedup: rows <= exportAsOf superseded, > exportAsOf are the live delta', () => {
  const webhook = [
    { date: '2026-04-22', actual_amount: 1 },
    { date: '2026-06-20', actual_amount: 10 },
    { date: '2026-06-25', actual_amount: 30 }, // after asOf → delta
  ];
  const { superseded, delta } = giveButterDedup(webhook, '2026-06-20');
  assert.equal(superseded.length, 2);
  assert.equal(delta.length, 1);
  assert.equal(delta[0].actual_amount, 30);
});

test('buildDonationTree: aggregates by source, Donations + Give Butter present, total correct', () => {
  const bySource = {
    'Give Butter': { gross: 703, fee: 26.89 },
    'Patreon':     { gross: 370, fee: 60.82 },
    'Benevity':    { gross: 1475, fee: 32.30 },
  };
  const carry = [{ parent: 'Interest', name: 'Bank Interest', amount: 0.51 }];
  const { categories, total } = buildDonationTree(bySource, carry);
  assert.equal(total, 2548.51);
  const donations = categories.find(c => c.name === 'Donations');
  assert.ok(donations, 'Donations parent exists (webhook depends on it)');
  assert.equal(donations.amount, 2548);
  const gb = donations.subcategories.find(s => s.name === 'Give Butter');
  assert.ok(gb, 'Give Butter leaf exists (webhook depends on it)');
  assert.equal(gb.amount, 703);
  const interest = categories.find(c => c.name === 'Interest');
  assert.equal(interest.subcategories[0].name, 'Bank Interest');
  assert.equal(interest.subcategories[0].amount, 0.51);
});

test('buildDonationTree: idempotent — same input twice yields identical totals', () => {
  const bySource = { 'Give Butter': { gross: 703, fee: 0 }, 'Patreon': { gross: 370, fee: 0 }, 'Benevity': { gross: 1475, fee: 0 } };
  const a = buildDonationTree(bySource, []);
  const b = buildDonationTree(bySource, []);
  assert.deepEqual(a, b);
  assert.equal(a.total, 2548);
});

test('buildDonationTree: zero-gross sources are dropped', () => {
  const { categories } = buildDonationTree({ 'Give Butter': { gross: 0, fee: 0 }, 'Patreon': { gross: 100, fee: 0 }, 'Benevity': { gross: 0, fee: 0 } }, []);
  const donations = categories.find(c => c.name === 'Donations');
  assert.equal(donations.subcategories.length, 1);
  assert.equal(donations.subcategories[0].name, 'Patreon');
});
