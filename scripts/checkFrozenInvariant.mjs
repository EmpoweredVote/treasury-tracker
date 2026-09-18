/**
 * Fast frozen-invariant check: `npm run verify:frozen`
 *
 * NO SHEBANG — kept importable.
 *
 * Asks the DATABASE for the answer (treasury.frozen_invariant_status), so one row
 * comes back instead of 87,880. That matters twice over: it is fast enough to run
 * after every load without thinking about it, and it removes the egress the old
 * harness paid on every single run.
 *
 * ⚠ It also CROSS-CHECKS the database against the repo. The SQL digest and the JS
 * digest are two independent implementations of the same rule; the mirror tables
 * can drift from scopeBaseline.json if a sync is skipped. Comparing the DB's
 * answer to the repo's expected values catches that drift instead of trusting
 * whichever one happens to be consulted.
 *
 * For the full multi-check harness (coverage, unclosed years, duplicates) use
 * scripts/verify-budget-axes.mjs, which is slower because it needs every row.
 *
 * Exit codes:  0 pass   1 the invariant moved   2 INCONCLUSIVE (could not check)
 *
 * ⚠ Set via process.exitCode, never process.exit(): on Windows the latter aborts
 * with a libuv assertion AFTER the message prints, so a legitimate failure reads
 * as a crash — the same lesson already recorded in scripts/checkForkedEntities.mjs.
 */

import { readFileSync } from 'node:fs';

const BASELINE = 'scripts/data/scopeBaseline.json';

/**
 * Say WHICH row moved — the question the digest cannot answer.
 *
 * ⚠⚠ A HASH CANNOT BE INVERTED. For three incidents (v2.35, v2.36 and the
 * 2026-09-08→14 window) this check proved a figure had moved and could not name
 * it; the third one's row is unrecoverable, because nothing kept the per-row
 * values and nothing stamped the write. treasury.frozen_figure_snapshot and the
 * budgets write-time trigger closed both gaps — this reads them.
 *
 * ⚠ An EMPTY result here is informative, not a failure of the tool: it means the
 * drift is OLDER than the last snapshot capture. Say so plainly rather than
 * printing nothing, or the next reader will think the localizer is broken.
 */
async function nameTheRows(client) {
  const { data, error } = await client.rpc('treasury_frozen_figure_drift');

  if (error) {
    console.error(`\n  (could not localize: ${error.message})`);
    return;
  }

  const { data: meta } = await client
    .schema('treasury').from('frozen_figure_snapshot_meta')
    .select('captured_at, row_count, digest').limit(1);
  const captured = meta?.[0];

  if (!data || data.length === 0) {
    console.error('\n  No row differs from the last snapshot capture'
      + (captured ? ` (${captured.captured_at}, ${captured.row_count} rows, digest ${captured.digest.slice(0, 8)}…)` : '')
      + ',');
    console.error('  so THE DRIFT PREDATES THAT CAPTURE. Nothing has moved since.');
    return;
  }

  console.error(`\n  ${data.length} row(s) differ from the snapshot captured ${captured?.captured_at ?? '(unknown)'}:\n`);
  for (const r of data.slice(0, 40)) {
    const where = `${r.entity ?? '(unknown entity)'}${r.state ? `, ${r.state}` : ''} FY${r.fiscal_year} ${r.dataset_type}`;
    console.error(`    ${r.kind.toUpperCase().replace(/_/g, ' ')}  ${where}`);
    console.error(`      ${r.snapshot_total ?? '(absent)'}  ->  ${r.current_total ?? '(absent)'}`);
    console.error(`      ${r.id}  ${r.data_source ?? ''}`);
    if (r.changed_at) console.error(`      written ${r.changed_at} (treasury.budget_total_changes)`);
  }
  if (data.length > 40) console.error(`    … and ${data.length - 40} more`);
  console.error('');
}

async function main() {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // ⚠ A check that cannot reach its source must NOT look like a clean pass.
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so the invariant was not checked.');
    process.exitCode = 2; return;
  }
  const client = createClient(url, key);

  const { data, error } = await client.schema('treasury').rpc('frozen_invariant_status');
  if (error) {
    console.error(`INCONCLUSIVE: ${error.message}`);
    process.exitCode = 2; return;
  }
  const status = Array.isArray(data) ? data[0] : data;
  const rows = Number(status.frozen_rows);

  console.log(`database : ${rows} rows  ${status.digest}`);
  console.log(`repo     : ${baseline.frozen_row_count} rows  ${baseline.figures_frozen}`);

  if (rows !== baseline.frozen_row_count) {
    const d = rows - baseline.frozen_row_count;
    console.error(`\n✗ ROWS NOT REGISTERED — ${Math.abs(d)} row(s) ${d > 0 ? 'unaccounted for' : 'VANISHED'}.`);
    if (d > 0) {
      console.error('  A load inserted rows without registering them. Fix it now, while you still');
      console.error('  know what you loaded:  npm run register:rows -- --milestone <name> --match "<entity>"');
      console.error('  This is NOT evidence that a figure moved.');
    } else {
      console.error('  A delete is exactly as serious as an edit. Investigate before anything else.');
    }
    await nameTheRows(client);
    process.exitCode = 1; return;
  }

  if (status.digest !== baseline.figures_frozen) {
    console.error('\n✗ FIGURE CHANGED — the count reconciles, so a surviving row\'s figure moved.');
    await nameTheRows(client);
    console.error('  If it was an authorised correction, record it in scripts/data/figureChanges.json');
    console.error('  with the value it replaced; the digest then keeps verifying and no rebase is needed.');
    console.error('  ⚠ Never regenerate figures_frozen to make this pass.');
    console.error('  If the mirror tables are simply stale: node scripts/syncFrozenInvariantState.mjs');
    process.exitCode = 1; return;
  }

  console.log('\n✅ frozen invariant holds — database and repo agree.');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('checkFrozenInvariant.mjs')) await main();
