#!/usr/bin/env node
/**
 * Report every scheduled gate's newest verdict.
 *
 *   npm run verify:watchdogs
 *
 * ⚠⚠⚠ WHY THE GATES RUN IN THE DATABASE AND NOT IN CI. Every check in
 * scripts/verify*.mjs needs database access, and the only credential that
 * reaches them is the service-role key, which bypasses RLS entirely.
 * .github/workflows/frozen-invariant-watch.yml records the decision not to put
 * one in GitHub Actions — it would partly undo PR #90, where the sync key moved
 * into Vault and the service-role fallback was deleted — and disables its own
 * schedule for exactly that reason. So the checks run on pg_cron inside the
 * database, where no credential travels and no rows cross the network, and this
 * command reads the verdicts back.
 *
 * Scheduled jobs (see supabase/migrations/*_scheduled_gate_watchdogs.sql):
 *
 *   transaction-tree-daily    03:12  run_transaction_tree_check()
 *   transaction-tree-assert   03:13  assert_last_transaction_tree_ok()
 *   zero-baseline-tie-daily   03:22  run_zero_baseline_tie_check()
 *   zero-baseline-tie-assert  03:23  assert_last_zero_baseline_tie_ok()
 *   frozen-invariant-weekly   Mon 06:23  (pre-existing)
 *   frozen-invariant-assert   Mon 06:33  assert_last_frozen_invariant_ok()
 *   anon-execute-sweep        Mon 02:47  (pre-existing, with its assert)
 *
 * The assert half is what makes a failure visible: its RAISE fails that pg_cron
 * job. This command is the human-readable view of the same verdicts.
 *
 * ⚠ This REPORTS what the schedule found; it does not re-measure. To measure
 * now, run the gate itself: verify:frozen, verify:totals, verify:txn-trees.
 */
import { createClient } from '@supabase/supabase-js';
import { judgeScheduledChecks } from './lib/scheduledChecks.mjs';

/** Every check that must have a verdict. One that vanishes is a failure. */
const EXPECTED = ['frozen-invariant', 'anon-execute-sweep', 'transaction-trees', 'zero-baseline-tie'];

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const { data, error } = await db.schema('treasury').rpc('scheduled_check_status');
if (error) {
  console.error(`scheduled_check_status failed: ${error.message}`);
  process.exitCode = 1;
} else {
  const rows = [...data].sort((a, b) => a.check_name.localeCompare(b.check_name));
  const { ok, faults } = judgeScheduledChecks(rows, EXPECTED);
  const faultFor = new Map(faults.map((f) => [f.check_name, f]));

  console.log('scheduled gate verdicts\n');
  for (const r of rows) {
    const age = Math.round((Date.now() - new Date(r.ran_at)) / 3_600_000);
    const f = faultFor.get(r.check_name);
    const mark = f ? (f.kind === 'stale' ? '⏳' : '❌') : '✅';
    console.log(`${mark} ${r.check_name.padEnd(20)} ${new Date(r.ran_at).toISOString().slice(0, 16).replace('T', ' ')}  (${age}h ago)`);
    if (f) console.log(`     ${f.detail}`);
  }
  for (const f of faults.filter((x) => x.kind === 'absent')) {
    console.log(`❌ ${f.check_name.padEnd(20)} ${f.detail}`);
  }

  if (!ok) {
    console.error(`\n❌ ${faults.length} scheduled check(s) are failing, stale, or have never run.`);
    console.error('   A stale verdict means the pg_cron job stopped; check cron.job_run_details.');
    process.exitCode = 1;
  } else {
    console.log(`\n✅ all ${rows.length} scheduled checks ran recently and passed.`);
  }
}
