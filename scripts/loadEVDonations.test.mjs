import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  money, isoYear, isoDate,
  parseGiveButter, parsePatreon, parseBenevity,
  giveButterDedup, buildDonationTree,
  carryForwardManual, carryForwardInterest,
  giveButterRecurringDonors, patreonDistinctPatrons, median, computeRecurringAggregates,
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

// ── Phase 75: manual.csv + bank-interest carry-forward + source tagging ───────

test('buildDonationTree: source tag threads to lineItems; manual merges into Donations parent', () => {
  const bySource = { 'Give Butter': { gross: 700, fee: 0 }, 'Patreon': { gross: 0, fee: 0 }, 'Benevity': { gross: 0, fee: 0 } };
  const carry = [
    { parent: 'Donations', name: 'Check — Acme Grant', amount: 500, tag: 'manual' },
    { parent: 'Interest', name: 'Bank Interest', amount: 1.17, tag: 'bank' },
  ];
  const { categories } = buildDonationTree(bySource, carry);
  const donations = categories.find(c => c.name === 'Donations');
  // exactly ONE Donations parent (no duplicate); platform + manual merged
  assert.equal(categories.filter(c => c.name === 'Donations').length, 1);
  assert.equal(donations.amount, 1200);
  const gb = donations.subcategories.find(s => s.name === 'Give Butter');
  assert.equal(gb.lineItems[0].source, 'csv');         // platform → csv
  const manual = donations.subcategories.find(s => s.name === 'Check — Acme Grant');
  assert.equal(manual.lineItems[0].source, 'manual');  // manual → manual
  const interest = categories.find(c => c.name === 'Interest');
  assert.equal(interest.subcategories[0].lineItems[0].source, 'bank'); // interest → bank
});

test('carryForwardManual: parses manual.csv, FY-filters, tags manual (absent file → [])', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evman-'));
  assert.deepEqual(carryForwardManual(dir, 2026), []); // no file yet
  fs.writeFileSync(path.join(dir, 'manual.csv'),
    'date,source,amount,note\n' +
    '03/15/2026,Check — Acme Grant,500,Q1 grant\n' +
    '2026-04-01,Direct,25.50,cash gift\n' +
    '06/01/2025,Old,99,prior FY\n');
  const out = carryForwardManual(dir, 2026);
  assert.equal(out.length, 2);
  assert.ok(out.every(r => r.tag === 'manual' && r.parent === 'Donations'));
  const grant = out.find(r => r.name === 'Check — Acme Grant');
  assert.equal(grant.amount, 500);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── Phase 81.5: recurring-supporter aggregates ────────────────────────────────

test('giveButterRecurringDonors: dedupes by Contact ID, counts only Plan ID rows for FY', () => {
  const rows = [
    // Contact A — 2 charges in FY2026 (one plan)
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-06-01 10:00:00', 'Plan ID': 'P1', 'Frequency': 'monthly', 'Amount': '$10.00', 'Contact ID': 'A', 'Contact Email': 'a@test.com' },
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-05-01 10:00:00', 'Plan ID': 'P1', 'Frequency': 'monthly', 'Amount': '$10.00', 'Contact ID': 'A', 'Contact Email': 'a@test.com' },
    // Contact B — 1 recurring charge in FY2026
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-04-01 10:00:00', 'Plan ID': 'P2', 'Frequency': 'monthly', 'Amount': '$50.00', 'Contact ID': 'B', 'Contact Email': 'b@test.com' },
    // Contact C — one-time gift (no Plan ID) — should NOT count
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-03-01 10:00:00', 'Plan ID': '',  'Frequency': 'one-time', 'Amount': '$25.00', 'Contact ID': 'C', 'Contact Email': 'c@test.com' },
    // Contact A — prior FY — should NOT count
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2025-12-01 10:00:00', 'Plan ID': 'P1', 'Frequency': 'monthly', 'Amount': '$10.00', 'Contact ID': 'A', 'Contact Email': 'a@test.com' },
  ];
  const { count, typicalAmounts } = giveButterRecurringDonors(rows, 2026);
  assert.equal(count, 2, '2 distinct recurring donors');
  assert.equal(typicalAmounts.length, 2);
  // most recent for A is $10 (2026-06), most recent for B is $50 (2026-04)
  assert.ok(typicalAmounts.includes(10));
  assert.ok(typicalAmounts.includes(50));
});

test('giveButterRecurringDonors: fallback to Contact Email when Contact ID empty', () => {
  const rows = [
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-06-01 10:00:00', 'Plan ID': 'P1', 'Frequency': 'monthly', 'Amount': '$5.00', 'Contact ID': '', 'Contact Email': 'x@test.com' },
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-05-01 10:00:00', 'Plan ID': 'P1', 'Frequency': 'monthly', 'Amount': '$5.00', 'Contact ID': '', 'Contact Email': 'x@test.com' },
  ];
  const { count } = giveButterRecurringDonors(rows, 2026);
  assert.equal(count, 1, 'same email deduped to 1');
});

test('patreonDistinctPatrons: dedupes by Member user ID, counts only Payment events for FY', () => {
  const rows = [
    // Patron P1 — 2 payments in FY2026
    { Date: '2026-06-01 08:00:00', 'Event type': 'Payment', 'Member user ID': 'P1', 'Member charge amount': '5.00' },
    { Date: '2026-05-01 08:00:00', 'Event type': 'Payment', 'Member user ID': 'P1', 'Member charge amount': '5.00' },
    // Patron P2 — 1 payment in FY2026
    { Date: '2026-06-01 07:00:00', 'Event type': 'Payment', 'Member user ID': 'P2', 'Member charge amount': '50.00' },
    // Non-payment event — should NOT count
    { Date: '2026-05-01 07:00:00', 'Event type': 'Refund',  'Member user ID': 'P3', 'Member charge amount': '10.00' },
    // Prior FY — should NOT count
    { Date: '2025-12-01 08:00:00', 'Event type': 'Payment', 'Member user ID': 'P4', 'Member charge amount': '5.00' },
  ];
  const { count, typicalAmounts } = patreonDistinctPatrons(rows, 2026);
  assert.equal(count, 2, '2 distinct patrons with Payment events in FY2026');
  // most recent P1 = $5, most recent P2 = $50
  assert.ok(typicalAmounts.includes(5));
  assert.ok(typicalAmounts.includes(50));
});

test('median: returns correct middle value for odd-length array', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([10, 5, 20]), 10);
  assert.equal(median([]), 0);
});

test('median: averages two middle values for even-length array', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([10, 20]), 15);
});

test('computeRecurringAggregates: Benevity collapses to exactly 1', () => {
  // Even with many GB rows and Patreon rows, Benevity = 1 (hard rule)
  const gbRows = [
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-06-01 10:00:00', 'Plan ID': 'P1', 'Amount': '$10.00', 'Contact ID': 'A', 'Contact Email': '' },
  ];
  const patRows = [
    { Date: '2026-06-01 08:00:00', 'Event type': 'Payment', 'Member user ID': 'M1', 'Member charge amount': '5.00' },
  ];
  const result = computeRecurringAggregates(gbRows, patRows, 2026);
  // 1 GB + 1 Patreon + 1 Benevity = 3
  assert.equal(result.recurring_supporters, 3, 'Benevity always adds exactly 1');
});

test('computeRecurringAggregates: output contains zero PII keys', () => {
  const gbRows = [
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-05-01 10:00:00', 'Plan ID': 'P1', 'Amount': '$50.00', 'Contact ID': 'X1', 'Contact Email': 'no@pii.com' },
  ];
  const patRows = [
    { Date: '2026-05-01 08:00:00', 'Event type': 'Payment', 'Member user ID': 'M1', 'Member charge amount': '10.00' },
  ];
  const result = computeRecurringAggregates(gbRows, patRows, 2026);
  const piiKeys = ['name', 'email', 'address', 'first_name', 'last_name', 'phone', 'contact_id', 'member_id'];
  const resultKeys = Object.keys(result).map(k => k.toLowerCase());
  for (const pk of piiKeys) {
    assert.ok(!resultKeys.includes(pk), `No PII key "${pk}" in output`);
  }
  assert.equal(typeof result.recurring_supporters, 'number');
  assert.ok(Number.isFinite(result.typical_monthly), 'typical_monthly is a finite number');
  assert.ok(typeof result.buckets === 'object', 'buckets is an object');
  assert.equal(result.as_of_fy, 2026);
});

test('computeRecurringAggregates: typical_monthly is the median of GB+Patreon amounts (Benevity excluded)', () => {
  const gbRows = [
    // GB donor: $100 most recent
    { 'Status Friendly': 'Succeeded', 'Refund Date (UTC)': '', 'Transaction Date (UTC)': '2026-06-01 10:00:00', 'Plan ID': 'P1', 'Amount': '$100.00', 'Contact ID': 'G1', 'Contact Email': '' },
  ];
  const patRows = [
    // Patron 1: $5
    { Date: '2026-06-01 08:00:00', 'Event type': 'Payment', 'Member user ID': 'M1', 'Member charge amount': '5.00' },
    // Patron 2: $10
    { Date: '2026-06-01 07:00:00', 'Event type': 'Payment', 'Member user ID': 'M2', 'Member charge amount': '10.00' },
  ];
  // amounts = [100, 5, 10] → sorted [5, 10, 100] → median = 10
  const result = computeRecurringAggregates(gbRows, patRows, 2026);
  assert.equal(result.typical_monthly, 10);
});

// Live-export reconciliation gate — reads the actual FY2026 CSV exports.
// Numbers must match the production computation; if exports are re-exported
// and the counts change, update this test AND the SUMMARY accordingly.
const gbExportFile  = new URL('../data/ev-sources/givebutter_transactions-2026-06-21-1895409277.csv', import.meta.url).pathname.replace(/^\/([A-Z]:\/)/i, m => m.slice(1));
const patDetailExportFile = new URL('../data/ev-sources/patreon_creator-analytics-detailed-earnings.csv', import.meta.url).pathname.replace(/^\/([A-Z]:\/)/i, m => m.slice(1));

test('computeRecurringAggregates: FY2026 real export data — 9 supporters, median $10', () => {
  const { readCsvRows } = { readCsvRows: (f) => {
    const lines = fs.readFileSync(f, 'utf-8').split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const parseCSVLine = (line) => {
      const fields = []; let current = '', inQuotes = false;
      for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
        else current += ch;
      }
      fields.push(current.trim());
      return fields;
    };
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
      const fields = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = (fields[i] || '').replace(/^"|"$/g, '').trim(); });
      return row;
    });
  }};
  const gbRows  = readCsvRows(gbExportFile);
  const patRows = readCsvRows(patDetailExportFile);
  const result  = computeRecurringAggregates(gbRows, patRows, 2026);
  assert.equal(result.recurring_supporters, 9,  'FY2026: 3 GB + 5 Patreon + 1 Benevity = 9');
  assert.equal(result.typical_monthly,      10, 'FY2026: median of [5,5,5,10,10,50,50,100] = 10');
  assert.equal(result.as_of_fy, 2026);
  // Buckets: GB $10=b10to24, GB $50=gte50, GB $100=gte50
  //          Pat $5=b5to9, $5=b5to9, $5=b5to9, $10=b10to24, $50=gte50
  assert.equal(result.buckets.b5to9,   3, '3 donors giving $5-9/mo');
  assert.equal(result.buckets.b10to24, 2, '2 donors giving $10-24/mo');
  assert.equal(result.buckets.gte50,   3, '3 donors giving $50+/mo');
  assert.equal(result.buckets.lt5,     0);
  assert.equal(result.buckets.b25to49, 0);
});

test('carryForwardInterest: sums Credit Interest deposits from the bank export, tags bank, ignores payouts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evint-'));
  fs.writeFileSync(path.join(dir, 'beneficial_state_bank_export_test.csv'),
    'Date,Description,Amount,Balance\n' +
    '03/31/2026,Credit Interest,$0.21,$100\n' +
    '04/30/2026,Credit Interest,$0.30,$200\n' +
    '03/23/2026,External Deposit Givebutter,$810.00,$900\n' + // payout → ignored
    '06/05/2026,RENDER.COM,-$98.00,$800\n' +                   // debit → ignored
    '01/30/2025,Credit Interest,$0.04,$50\n');                 // prior FY → ignored
  const out = carryForwardInterest(dir, 2026);
  assert.equal(out.length, 1);
  assert.equal(out[0].parent, 'Interest');
  assert.equal(out[0].name, 'Bank Interest');
  assert.equal(out[0].tag, 'bank');
  assert.equal(out[0].amount, 0.51); // 0.21 + 0.30
  fs.rmSync(dir, { recursive: true, force: true });
});
