#!/usr/bin/env node
/**
 * Name the drift between the frozen-exclusion REPO FILES and the DATABASE
 * MIRROR (`treasury.frozen_excluded_ids`).
 *
 * (Shebang is correct HERE — an entry-point script. The logic lives in
 * scripts/lib/frozenMirrorDrift.mjs so it can be unit-tested without a
 * database.)
 *
 * ⚠⚠ RUN THIS WHENEVER `verify:frozen` AND `registerCreatedRows` DISAGREE.
 * They read two different exclusion lists that are supposed to be one list, so
 * when the lists drift the two tools report different deficits and
 * `registerCreatedRows` refuses to write — with a message that reads as "your
 * load is wrong" even when it is not.
 *
 * On 2026-10-31 the difference was four rows belonging to an UNMERGED pull
 * request whose data had already been loaded to production: the rows were live
 * and in the mirror, and their bookkeeping files existed only on that PR's
 * branch. Production running ahead of `main` by an unmerged load is normal
 * here, which is why this needs a name rather than an investigation each time.
 *
 * Usage:
 *   node scripts/diffFrozenExclusionMirror.mjs
 *   node scripts/diffFrozenExclusionMirror.mjs --ids   # print the drifting ids
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { compareExclusionSources, splitLiveAndStale } from './lib/frozenMirrorDrift.mjs';

const BASELINE = 'scripts/data/scopeBaseline.json';
const PAGE = 1000;

const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).'); process.exit(1); }
const db = createClient(url, key);
const showIds = process.argv.includes('--ids');

/** ⚠ Paged with a total order; this repo has broken paged reads five times. */
async function pageAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.schema('treasury').from(table)
      .select(select).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const distinct = new Set(rows.map((r) => r.id)).size;
  if (distinct !== rows.length) {
    throw new Error(`PAGING DEFECT on ${table}: ${rows.length} rows, ${distinct} distinct ids`);
  }
  return rows;
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

const mirrorByFile = new Map();
for (const r of await pageAll('frozen_excluded_ids', 'id, source_file')) {
  if (!mirrorByFile.has(r.source_file)) mirrorByFile.set(r.source_file, new Set());
  mirrorByFile.get(r.source_file).add(r.id);
}

const readFile = (f) => {
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; }
};

const drift = compareExclusionSources(baseline, mirrorByFile, readFile);

if (drift.length === 0) {
  console.log('✅ the repo files and the database mirror agree exactly.');
  process.exit(0);
}

const liveIds = new Set((await pageAll('budgets', 'id')).map((r) => r.id));
const { live, stale } = splitLiveAndStale(drift, liveIds);

for (const d of drift) {
  const where = d.missingFile ? '  ⚠ FILE ABSENT FROM THIS CHECKOUT'
    : d.unlisted ? '  ⚠ NOT LISTED IN scopeBaseline.excluded_ids_files' : '';
  const liveOnly = [...d.onlyRepo, ...d.onlyDb].filter((id) => liveIds.has(id)).length;
  console.log(`✗ ${d.file}`);
  console.log(`    only-in-repo ${d.onlyRepo.length}  only-in-db ${d.onlyDb.length}`
    + `  (${liveOnly} of them live)${where}`);
  if (showIds) {
    for (const [side, ids] of [['only-in-db', d.onlyDb], ['only-in-repo', d.onlyRepo]]) {
      for (const id of ids) console.log(`      ${side} ${id}${liveIds.has(id) ? '  LIVE' : '  stale'}`);
    }
  }
}

// ⚠⚠ THE HEADLINE IS THE LIVE COUNT. A drifting id that no longer matches a
// budget row cannot move any invariant — it is bookkeeping litter, real and
// worth cleaning, but reporting it alongside the live count sends the next
// reader hunting for rows that are not there. On 2026-10-31 the raw drift was
// 85 ids and only FOUR of them could move the deficit.
console.log(`\n${live} LIVE id(s) differ — this is the number that moves the deficit.`);
console.log(`${stale} stale id(s) differ — bookkeeping litter; they match no budget row.`);

if (live > 0) {
  console.log('\nA file absent from this checkout usually means its PR is not merged yet.');
  console.log('Check: gh pr list --state open   — and register from a branch that has it,');
  console.log('or merge that PR first. Do NOT re-baseline to make the number agree.');
}

process.exit(live > 0 ? 1 : 0);
