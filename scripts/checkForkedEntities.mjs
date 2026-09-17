#!/usr/bin/env node
/**
 * Fail if TT holds any city as two entities after a publisher rename.
 *
 *   npm run check:forks
 *   node --env-file=.env scripts/checkForkedEntities.mjs
 *
 * Exit 0 = no forked cities. Exit 1 = at least one, named.
 *
 * ── ⚠⚠ RUN THIS AFTER EVERY LOAD ───────────────────────────────────────────
 *
 * Loaders establish entity identity BY PUBLISHED NAME. When a publisher changes
 * the name it prints, the lookup misses, a SECOND entity is created, and every
 * year from that point lands on the new row — severing the city's history. It
 * has happened twice, both from the Minnesota Office of the State Auditor:
 *
 *   2026-09-14  Marine on Saint Croix / Marine On Saint Croix   "on" -> "On"
 *   2026-09-15  Birchwood            / Birchwood Village        a word added
 *
 * NOTHING FAILS WHEN IT HAPPENS. Both halves carry honest publisher data, every
 * total ties, and each half LOOKS COMPLETE. Neither incident was found by
 * looking — one surfaced through a duplicate geoid, the other while chasing an
 * unrelated one-row discrepancy. This script is the thing that looks.
 *
 * ⚠ It is a SEPARATE STEP rather than a call inside each loader, matching the
 * existing `npm run verify:frozen` convention. The check is global — it scans
 * the whole table — so one run after a load sees exactly what a per-loader call
 * would. The cost of that choice is honest and worth stating: NOTHING FORCES
 * YOU TO RUN IT. Run it, or a fork sits undetected until something else trips
 * over it.
 *
 * ⚠ The rule itself lives in treasury.detect_forked_entities() so this script,
 * scripts/detectForkedEntities.sql and any loader all check the same thing.
 * A pair adjudicated `distinct` in treasury.municipality_fork_reviews is
 * suppressed there, which is why a zero result keeps meaning something.
 */

import { createClient } from '@supabase/supabase-js';
import { assertNoNewForks } from './lib/ensureMunicipality.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run with: node --env-file=.env scripts/checkForkedEntities.mjs');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ⚠ process.exitCode, NOT process.exit(). Calling process.exit() here aborted
// with a libuv assertion on Windows — "!(handle->flags & UV_HANDLE_CLOSING)" —
// and returned 127 AFTER printing a successful result. A check that reports a
// pass while exiting non-zero is worse than no check: every caller reads it as
// a failure. Setting exitCode lets node close its handles and exit properly.
try {
  await assertNoNewForks(db);
  console.log('OK — no forked cities. Every published name resolves to one entity.');
  process.exitCode = 0;
} catch (err) {
  console.error(`\n${err.message}\n`);
  // ⚠ Only a fork listing has pairs to resolve. A transport failure means the
  // check never ran at all, and telling someone to "resolve each pair" there
  // sends them hunting for data problems that do not exist.
  if (!/failed to run/.test(err.message)) {
    console.error('To resolve each pair:');
    console.error('  same city  -> add a treasury.municipality_aliases row for the old spelling,');
    console.error('                then merge the entities (see 20260914000000 for the pattern:');
    console.error('                assert the four CASCADE children are empty BEFORE deleting).');
    console.error('  two govts  -> insert a treasury.municipality_fork_reviews row with');
    console.error("                status='distinct', and this stops reporting it.");
  }
  process.exitCode = 1;
}
