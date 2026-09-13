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

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/applyGeoidBackfill.mjs <migration.sql>');
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
process.exit(failed > 0 ? 1 : 0);
