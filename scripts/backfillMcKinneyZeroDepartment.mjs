#!/usr/bin/env node
/**
 * Restore the department key the falsy-zero bug deleted.
 *
 *   node --env-file=.env scripts/backfillMcKinneyZeroDepartment.mjs --dry-run
 *   node --env-file=.env scripts/backfillMcKinneyZeroDepartment.mjs
 *
 * ⚠⚠⚠ WHAT WAS LOST. McKinney's check register publishes `Department` as an
 * INTEGER, and `r[col] || null` turns the integer 0 into null. Code 0 — the
 * `0000` account segment — reached the database with `department` and
 * `link_key` NULL on 16,241 transactions across FY2022-FY2025, and its root
 * was labelled `Unknown Department`. The live drill-down for that root returned
 * `null`: a $79.1M category in FY2024 alone that a reader could click and get
 * nothing from. Fixed for future loads in scripts/lib/publisherIds.mjs; this
 * repairs the rows already written.
 *
 * ── ⚠⚠ WHY A BACKFILL AND NOT A RELOAD ─────────────────────────────────────
 *
 * A `--force-reload` would re-derive the key from the publisher's file, which
 * is the more self-evidently correct route — but it deletes and rewrites all
 * 185,469 transactions to change one column on 8.8% of them. The targeted
 * claim is provable instead, so it is proved and then applied narrowly:
 *
 *   1. McKinney's `column_mapping` names ONLY `department_column`, so
 *      `link_key` is built from that one column. No other column can make it
 *      null.
 *   2. In all four published registers EVERY `Department` cell is a non-blank
 *      integer. The sole blank is the publisher's own `Total` row, which is
 *      not ingested.
 *   3. Therefore `link_key IS NULL` happens for exactly one reason: the value
 *      was the integer 0.
 *
 * The counts corroborate it. Register dept-0 rows against rows found here:
 *
 *      FY2022  4,480 / $60,229,906   vs   4,428 / $60,213,732
 *      FY2023  4,171 / $62,028,246   vs   4,143 / $62,026,519
 *      FY2024  3,883 / $79,135,060   vs   3,827 / $79,113,310
 *      FY2025  3,894 / $93,767,321   vs   3,894 / $93,750,753
 *
 * ⚠ The shortfall (28-56 rows a year) is the loader's SHA-256 full-row dedup
 * collapsing genuinely identical lines — the same effect that leaves TT's
 * FY2024 total $502,576 below McKinney's own `Total` row. It is NOT evidence
 * of a second cause for the null key, and this script asserts the measured
 * figures rather than trusting them.
 *
 * Moves no money: only `link_key` and `department` are written.
 */
import { createClient } from '@supabase/supabase-js';

/** Measured 2026-11-04 from the published registers and the database. */
const EXPECTED = {
  2022: { budget: '7fc55cea-f8ae-48bc-9a57-365b0186d8d5', rows: 4428, amount: 60213731.83 },
  2023: { budget: '8c6fd02b-2dc2-4089-b257-5e62feec259f', rows: 4143, amount: 62026519.36 },
  2024: { budget: '257d9eef-f6ac-4f1c-8e0c-b624d1bcc030', rows: 3827, amount: 79113309.51 },
  2025: { budget: '7088040b-501c-476c-9124-a140ef233e0b', rows: 3843, amount: 93750753.38 },
};

const CODE = '0';
const dryRun = process.argv.includes('--dry-run');

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

/** ⚠ Paged and ordered — a filtered read is not a paged read (PostgREST caps at 1,000). */
async function nullKeyRows(budgetId) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('transactions')
      .select('id, amount, department, link_key')
      .eq('budget_id', budgetId).is('link_key', null)
      .order('id').range(from, from + 999);
    if (error) throw new Error(`transactions read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function main() {
  console.log(`McKinney department code 0 — ${dryRun ? 'DRY RUN' : 'WRITING'}\n`);
  let totalRows = 0;

  for (const [fy, exp] of Object.entries(EXPECTED)) {
    const rows = await nullKeyRows(exp.budget);
    const amount = Math.round(rows.reduce((a, r) => a + Number(r.amount), 0) * 100) / 100;

    if (rows.length !== exp.rows || Math.abs(amount - exp.amount) > 0.01) {
      throw new Error(
        `FY${fy}: expected ${exp.rows} unkeyed rows totalling $${exp.amount.toLocaleString()}, ` +
        `found ${rows.length} totalling $${amount.toLocaleString()}. The data has moved since this ` +
        `was measured against the published register — re-verify before writing a key onto anything.`,
      );
    }

    // ⚠ A row that already carries a department contradicts the premise that
    // the only cause of a null key is the falsy zero. Refuse rather than guess.
    const withDept = rows.filter((r) => r.department !== null && r.department !== '');
    if (withDept.length) {
      throw new Error(
        `FY${fy}: ${withDept.length} unkeyed row(s) DO carry a department (first: ` +
        `${JSON.stringify(withDept[0].department)}). The null key has a second cause and this ` +
        `backfill's reasoning does not hold. Stop.`,
      );
    }

    console.log(`FY${fy}: ${rows.length} rows, $${amount.toLocaleString()} -> link_key "${CODE}"`);
    totalRows += rows.length;

    if (!dryRun) {
      for (let i = 0; i < rows.length; i += 500) {
        const ids = rows.slice(i, i + 500).map((r) => r.id);
        const { error } = await db.schema('treasury').from('transactions')
          .update({ link_key: CODE, department: CODE }).in('id', ids);
        if (error) throw new Error(`update failed: ${error.message}`);
        process.stdout.write(`\r  written ${Math.min(i + 500, rows.length)}/${rows.length}`);
      }
      process.stdout.write('\n');
    }
  }

  console.log(`\n${totalRows} transaction(s) ${dryRun ? 'would be' : ''} re-keyed.`);

  if (!dryRun) {
    let remaining = 0;
    for (const [fy, exp] of Object.entries(EXPECTED)) {
      const left = await nullKeyRows(exp.budget);
      remaining += left.length;
      console.log(`  FY${fy}: unkeyed transactions remaining ${left.length}`);
    }
    if (remaining) {
      console.error(`\n❌ ${remaining} transaction(s) still carry no key.`);
      process.exitCode = 1;
      return;
    }
    console.log('\n✅ every McKinney transaction now carries the publisher\'s department code.');
  }
}

await main();
