#!/usr/bin/env node
/**
 * Apply the generated geoid backfill migration.
 *
 *   node scripts/applyGeoidBackfill.mjs supabase/migrations/20260912000100_backfill_municipality_geoids.sql
 *
 * ⚠ It READS THE COMMITTED SQL FILE and applies exactly those tuples, rather
 * than recomputing them. The artifact in the repo is therefore provably what
 * reached the database — regenerate the file and the diff shows what changed,
 * instead of two derivations that have to be trusted to agree.
 *
 * The treasury schema is reachable through PostgREST only with the service
 * role; there is no anon path to these writes.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { classifyGeoidWrites } from './lib/geoid.mjs';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const dryRun = argv.includes('--dry-run');
const allowChanges = argv.includes('--allow-changes');
if (!file) {
  console.error('usage: node scripts/applyGeoidBackfill.mjs <migration.sql> [--dry-run] [--allow-changes]');
  process.exit(1);
}

const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('no SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY in the environment');
  process.exit(1);
}
const db = createClient(url, key);

// ('<uuid>'::uuid, '<geoid>', '<basis>')
const TUPLE = /^\s*\('([0-9a-f-]{36})'::uuid,\s*'(\d+)',\s*'([a-z0-9-]+)'\),?\s*$/i;

const rows = [];
for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
  const m = TUPLE.exec(line);
  if (m) rows.push({ id: m[1], geoid: m[2], basis: m[3] });
}
if (rows.length === 0) {
  console.error(`${file}: parsed 0 tuples — wrong file, or the generator's format changed`);
  process.exit(1);
}
// ⚠ The ids must be distinct or a later write silently overwrites an earlier
// one and the count still looks right.
const distinct = new Set(rows.map((r) => r.id));
if (distinct.size !== rows.length) {
  console.error(`${file}: ${rows.length} tuples but ${distinct.size} distinct ids`);
  process.exit(1);
}
console.log(`parsed ${rows.length} tuples from ${file}`);

// ── What would this actually do? ──────────────────────────────────────────
// ⚠⚠ The file is every resolution, not a list of changes, so most tuples
// restate what the table already holds. Read the current values and partition
// first: writing 10,000 no-ops to fill 2,000 nulls is slow, and it HIDES the
// one case that matters — a geoid moving to a different government.
const current = new Map();
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.schema('treasury').from('municipalities')
    .select('id, geoid, geoid_basis').order('id').range(from, from + 999);
  if (error) { console.error(`reading current geoids: ${error.message}`); process.exit(1); }
  for (const m of data) current.set(m.id, { geoid: m.geoid, basis: m.geoid_basis });
  if (data.length < 1000) break;
}
const plan = classifyGeoidWrites(rows, current);
console.log(`  fill (null -> value)   ${plan.fill.length}`);
console.log(`  basis-only correction  ${plan.basisOnly.length}`);
console.log(`  already correct        ${plan.same.length}`);
console.log(`  entity absent          ${plan.absent.length}`);
console.log(`  CHANGE of government   ${plan.change.length}`);
console.log(`  COLLISION (2 entities) ${plan.collision.length}`);
for (const c of plan.collision.slice(0, 20)) {
  console.log(`      ${c.id} wants ${c.geoid}${c.heldBy ? ` — already held by ${c.heldBy}` : ' — and so does another tuple'}`);
}
for (const c of plan.change.slice(0, 50)) {
  console.log(`      ${c.id}  ${c.from} -> ${c.to}`);
}

// ⚠⚠ A CHANGED GEOID IS A MATCHER DEFECT UNTIL PROVEN OTHERWISE — the shape
// Elizabeth/Elizabethtown and the two Franklins took, which no count, length
// or basis check can see. It is SKIPPED, not refused, and the run still exits
// non-zero so a partial pass is never read as a complete one.
//
// ⚠ Skipping rather than halting is deliberate: a fill is provably safe
// (null -> value) and blocking 2,279 of them over 13 suspicious tuples would
// leave real entities unmatched in Civic Spaces to protect nothing.
const toWrite = allowChanges ? [...plan.toWrite, ...plan.change] : plan.toWrite;
if (dryRun) {
  console.log(`\ndry run — ${toWrite.length} row(s) would be written, nothing was.`);
  process.exit(0);
}
if (toWrite.length === 0) {
  console.log('\nnothing to write — the database already matches the file.');
  process.exit(0);
}
rows.length = 0;
rows.push(...toWrite);
console.log(`\nwriting ${rows.length} row(s)`);

const CONCURRENCY = 16;
let done = 0; let failed = 0;
const errors = [];

async function worker(slice) {
  for (const r of slice) {
    const { error } = await db.schema('treasury').from('municipalities')
      .update({ geoid: r.geoid, geoid_basis: r.basis })
      .eq('id', r.id);
    if (error) { failed++; if (errors.length < 10) errors.push(`${r.id}: ${error.message}`); }
    done++;
    if (done % 1000 === 0) process.stderr.write(`  ${done}/${rows.length}\n`);
  }
}

const slices = Array.from({ length: CONCURRENCY }, (_, i) =>
  rows.filter((_, idx) => idx % CONCURRENCY === i));
await Promise.all(slices.map(worker));

console.log(`applied ${done - failed}/${rows.length}; ${failed} failed`);
for (const e of errors) console.error('  ' + e);

const skipped = (allowChanges ? 0 : plan.change.length) + plan.collision.length;
if (skipped) {
  console.error(`\n⚠ ${skipped} tuple(s) were SKIPPED and did NOT apply:`);
  if (!allowChanges && plan.change.length) {
    console.error(`   ${plan.change.length} would move an entity to a different geoid —`);
    console.error('   investigate, then re-run with --allow-changes if the new value is right.');
  }
  // ⚠⚠ NOT overridable. A change can be right; a collision cannot — two
  // entities cannot be one government, so the matcher is wrong about at least
  // one of them and writing either is a coin flip.
  if (plan.collision.length) {
    console.error(`   ${plan.collision.length} would give two entities the SAME geoid. There is no`);
    console.error('   flag for these: fix the matcher, do not force the write.');
  }
}
process.exit(failed > 0 || skipped > 0 ? 1 : 0);
