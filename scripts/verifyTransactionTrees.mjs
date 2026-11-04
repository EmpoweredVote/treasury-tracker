#!/usr/bin/env node
/**
 * Gate: an enrolled transaction-backed tree must agree with its transactions.
 *
 *   npm run verify:txn-trees
 *
 * ⚠⚠⚠ THE DEFECT THIS EXISTS FOR cannot be seen by any other gate in this
 * repo. McKinney's FY2024 tree summed to its headline, carried 94 distinct
 * labels and moved no frozen figure — while its second-largest root
 * ($79,113,310) was keyed `unknown` and the transactions beneath it carried a
 * NULL key. The live drill-down returned `null`. Every number agreed and the
 * page was broken.
 *
 * ⚠ HELD AT ZERO, with no baseline. Unlike the totals ratchet there is no debt
 * to carry here: the tree is DERIVED, so any disagreement is a bug that
 * `node scripts/rebuildTransactionTree.mjs` fixes in one command. A baseline
 * would only record how long we tolerated it.
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const COUNTERS = [
  ['unkeyed_txns', 'transaction(s) with NO link_key — the falsy-zero defect; see scripts/lib/publisherIds.mjs'],
  ['roots_without_key', 'root(s) with NO link_key — nothing can drill into them'],
  ['keys_without_root', 'transaction key(s) with no root — that money is in no category'],
  ['roots_without_txn', 'root(s) with no transactions — the drill-down returns nothing'],
  ['amount_drift', 'root(s) whose amount disagrees with the transactions beneath it'],
];

const { data, error } = await db.schema('treasury').rpc('transaction_tree_status');
if (error) {
  console.error(`transaction_tree_status failed: ${error.message}`);
  process.exitCode = 1;
} else if (!data.length) {
  // ⚠ An empty result is a FAILURE, not a pass. It means the enrolled-source
  // pattern in the SQL matches nothing — a gate that checks zero rows reports
  // success forever.
  console.error('❌ transaction_tree_status returned no rows. No enrolled source matched,');
  console.error('   so this gate is checking nothing. Fix the pattern in the migration.');
  process.exitCode = 1;
} else {
  console.log(`${data.length} enrolled budget(s) examined\n`);
  let bad = 0;
  for (const row of data) {
    const faults = COUNTERS.filter(([k]) => Number(row[k]) > 0);
    const mark = faults.length ? '❌' : '  ';
    console.log(`${mark} ${row.source}: ${row.txn_keys} transaction keys, ${row.root_keys} roots`);
    for (const [k, why] of faults) {
      console.log(`      ${row[k]} ${why}`);
      bad++;
    }
  }
  if (bad) {
    console.error('\n❌ a published tree disagrees with the transactions beneath it.');
    console.error('   Run:  node --env-file=.env scripts/rebuildTransactionTree.mjs --municipality McKinney');
    console.error('   Do NOT add a baseline — the tree is derived, so this is always fixable.');
    process.exitCode = 1;
  } else {
    console.log('\n✅ every enrolled tree matches its transactions, key for key and cent for cent.');
  }
}
