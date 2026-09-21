/**
 * On-demand anon-EXECUTE sweep check: `npm run verify:grants`
 *
 * NO SHEBANG — kept importable (the shebang/CRLF guard covers any module a test
 * imports; see scripts/checkStagedNulBytes.mjs).
 *
 * The sweep itself runs in-database on pg_cron ('anon-execute-sweep-weekly') and
 * is read automatically by treasury-sync-orchestrator on every daily run. This
 * script is for asking on demand — after writing a migration that adds a
 * function, or when you want the current answer rather than last Monday's.
 *
 * `--run` re-runs the sweep first instead of reading the last verdict. Use it
 * after applying a migration; without it you are reading a stale answer by
 * definition.
 *
 * ⚠ A MISSING OR STALE VERDICT EXITS NON-ZERO. The rule lives in
 * scripts/lib/anonExecuteSweep.mjs and is shared with this script's tests: a
 * sweep that stopped running must not read as clean. That is not hypothetical —
 * the frozen-figure invariant failed three consecutive weeks (2026-09-07, -14,
 * -21) writing `ok = false` into a table nothing read.
 *
 * Exit codes:  0 pass   1 a new exposure (or a stale/missing verdict)   2 INCONCLUSIVE (could not check)
 *
 * ⚠ Set via process.exitCode, never process.exit(): on Windows the latter aborts
 * with a libuv assertion AFTER the message prints, so a legitimate failure reads
 * as a crash.
 */

import { surfaceVerdict, CYCLE_DAYS, STALE_CYCLES } from './lib/anonExecuteSweep.mjs';

async function main() {
  const rerun = process.argv.includes('--run');

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ⚠ A missing credential is INCONCLUSIVE, never a pass — the same rule
  // frozen-invariant-watch.yml applies when it cannot reach its source.
  if (!key) {
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so the sweep was not checked.');
    console.error('  set -a; . ./.env; set +a    (then re-run)');
    process.exitCode = 2;
    return;
  }

  const client = createClient(url, key);

  if (rerun) {
    const { error } = await client.rpc('treasury_run_anon_execute_sweep');
    if (error) {
      console.error(`INCONCLUSIVE: could not re-run the sweep: ${error.message}`);
      console.error('  Re-run it in SQL instead: select treasury.run_anon_execute_sweep();');
      process.exitCode = 2;
      return;
    }
  }

  const { data, error } = await client.rpc('treasury_anon_execute_status');
  if (error) {
    console.error(`INCONCLUSIVE: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const row = Array.isArray(data) ? data[0] : data;
  const verdict = surfaceVerdict(row ?? null, new Date());

  if (verdict.ok) {
    console.log(`PASS — ${row.live_count} accepted exposure(s), nothing new.`);
    console.log(`  last swept ${new Date(row.ran_at).toISOString()} (${verdict.ageDays.toFixed(1)}d ago, stale after ${CYCLE_DAYS * STALE_CYCLES}d)`);
    if (row.gone_count > 0) console.log(`  note: ${row.detail}`);
    return;
  }

  console.error('FAIL — the anon-EXECUTE sweep is not clean.\n');
  console.error(verdict.detail);
  process.exitCode = 1;
}

await main();
