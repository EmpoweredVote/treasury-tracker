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
 */

import { readFileSync } from 'node:fs';

const BASELINE = 'scripts/data/scopeBaseline.json';

async function main() {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // ⚠ A check that cannot reach its source must NOT look like a clean pass.
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so the invariant was not checked.');
    process.exit(2);
  }
  const client = createClient(url, key);

  const { data, error } = await client.schema('treasury').rpc('frozen_invariant_status');
  if (error) {
    console.error(`INCONCLUSIVE: ${error.message}`);
    process.exit(2);
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
    process.exit(1);
  }

  if (status.digest !== baseline.figures_frozen) {
    console.error('\n✗ FIGURE CHANGED — the count reconciles, so a surviving row\'s figure moved.');
    console.error('  If it was an authorised correction, record it in scripts/data/figureChanges.json');
    console.error('  with the value it replaced; the digest then keeps verifying and no rebase is needed.');
    console.error('  ⚠ Never regenerate figures_frozen to make this pass.');
    console.error('  If the mirror tables are simply stale: node scripts/syncFrozenInvariantState.mjs');
    process.exit(1);
  }

  console.log('\n✅ frozen invariant holds — database and repo agree.');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('checkFrozenInvariant.mjs')) await main();
