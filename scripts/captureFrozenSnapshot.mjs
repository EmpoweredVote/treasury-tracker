#!/usr/bin/env node
/**
 * Capture the per-row snapshot the frozen-figure check localizes against.
 *
 *   npm run frozen:snapshot -- --note "after the FY2026 Dallas correction"
 *
 * ── ⚠⚠ THIS IS A LOCALIZER, NEVER A BASELINE ──────────────────────────────
 *
 * `figures_frozen` in scripts/data/scopeBaseline.json is the invariant, and it
 * must never be rewritten to make a check pass. This snapshot answers a
 * different question — WHICH row differs from the last capture — and capturing
 * it changes no figure and no invariant.
 *
 * ⚠ CAPTURING IS DELIBERATE, AND NEVER AUTOMATIC. A check that refreshed its own
 * expectation would agree with any corruption, so nothing calls this on its own:
 * run it after an authorised correction, or once a drift has been explained and
 * recorded. Between captures, `npm run verify:frozen` names every row that moved.
 *
 * ⚠ It prints the digest at capture time. If that digest is not the repo
 * baseline, you are capturing a state that is ALREADY drifted — which is
 * sometimes right (it stops the next incident inheriting this one's fog) but
 * must be a decision, not an accident. The script says so and asks for --force.
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BASELINE = 'scripts/data/scopeBaseline.json';

const { values } = parseArgs({
  options: {
    note:  { type: 'string' },
    force: { type: 'boolean' },
  },
});

// ⚠ process.exitCode, NOT process.exit(). Calling process.exit() from a script
// like this aborts with a libuv assertion on Windows — "!(handle->flags &
// UV_HANDLE_CLOSING)" — AFTER the message has printed, so a clean refusal looks
// like a crash. Same lesson as scripts/checkForkedEntities.mjs.
async function main() {
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY. Run with: npm run frozen:snapshot');
    process.exitCode = 1; return;
  }
  const db = createClient(url, key);

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

  const { data: status, error: statusErr } = await db.schema('treasury').rpc('frozen_invariant_status');
  if (statusErr) {
    console.error(`Could not read the invariant: ${statusErr.message}`);
    process.exitCode = 2; return;
  }
  const s = Array.isArray(status) ? status[0] : status;

  console.log(`database : ${s.frozen_rows} rows  ${s.digest}`);
  console.log(`repo     : ${baseline.frozen_row_count} rows  ${baseline.figures_frozen}`);

  if (s.digest !== baseline.figures_frozen && !values.force) {
    console.error('\n⚠⚠ The database does NOT match the repo invariant right now.');
    console.error('   Capturing here records a state that has already drifted. That is sometimes');
    console.error('   the right call — it stops the NEXT incident inheriting this one\'s fog — but');
    console.error('   it is a decision. Re-run with --force and a --note saying why.');
    console.error('   ⚠ It does NOT make verify:frozen pass, and must never be done for that reason.');
    process.exitCode = 1; return;
  }

  // ⚠ The public wrapper, not the treasury one: PostgREST only reaches `public`.
  const { data, error } = await db.rpc('capture_frozen_snapshot', {
    p_note: values.note ?? null,
  });
  if (error) {
    console.error(`Capture failed: ${error.message}`);
    process.exitCode = 1; return;
  }
  const captured = Array.isArray(data) ? data[0] : data;
  console.log(`\n✅ captured ${Number(captured.row_count).toLocaleString()} rows at ${captured.digest}`);
  console.log('   From here, verify:frozen NAMES any row that moves.');
}

await main();
