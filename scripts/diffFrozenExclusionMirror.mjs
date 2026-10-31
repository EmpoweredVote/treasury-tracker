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
 * ⚠⚠ THE VERDICT IS THE UNION OF THE FILES, NOT A FILE-BY-FILE COMPARISON.
 * The mirror stores each id ONCE under one source_file, while a repo id may be
 * listed in two files — `liveSyncExcludedIds.json` is a SCOPE file that overlaps
 * the milestone PROVENANCE files by design. Comparing per file therefore reports
 * differences no sync can clear: 81 of them on 2026-10-31, which cost a SECOND
 * investigation after this script was written to prevent the first. The per-file
 * breakdown is still printed, because it is how you find which file to fix, but
 * it now says which of its differences are attribution rather than absence.
 *
 * Usage:
 *   node scripts/diffFrozenExclusionMirror.mjs
 *   node scripts/diffFrozenExclusionMirror.mjs --ids   # print the drifting ids
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { compareExclusionSources, compareExclusionUnions } from './lib/frozenMirrorDrift.mjs';

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

// ⚠⚠ THE VERDICT IS THE UNION, NEVER THE PER-FILE BREAKDOWN. Every consumer
// unions these files into a Set before computing anything, and the mirror
// stores each id once under one source_file while a repo id may be listed in
// two files. Comparing file by file therefore reports differences that no sync
// can clear — 81 of them on 2026-10-31, which cost a second investigation
// after this script was written to prevent the first.
const union = compareExclusionUnions(baseline, mirrorByFile, readFile);

/** One line per file. `liveIds` is omitted when nothing is actionable. */
function reportFiles(liveIds) {
  for (const d of drift) {
    const where = d.missingFile ? '  ⚠ FILE ABSENT FROM THIS CHECKOUT'
      : d.unlisted ? '  ⚠ NOT LISTED IN scopeBaseline.excluded_ids_files' : '';
    const attributed = (d.attributedElsewhere ?? []).length;
    const note = attributed === 0 ? ''
      : attributed === d.onlyRepo.length && d.onlyDb.length === 0
        ? '  (all filed under another source_file — not missing)'
        : `  (${attributed} filed under another source_file)`;
    const live = liveIds
      ? `  (${[...d.onlyRepo, ...d.onlyDb].filter((id) => liveIds.has(id)).length} of them live)`
      : '';
    console.log(`✗ ${d.file}`);
    console.log(`    only-in-repo ${d.onlyRepo.length}  only-in-db ${d.onlyDb.length}`
      + `${live}${note}${where}`);
    if (showIds) {
      for (const [side, ids] of [['only-in-db', d.onlyDb], ['only-in-repo', d.onlyRepo]]) {
        for (const id of ids) {
          const state = liveIds ? (liveIds.has(id) ? '  LIVE' : '  stale') : '';
          console.log(`      ${side} ${id}${state}`);
        }
      }
    }
  }
}

if (union.onlyRepo.length === 0 && union.onlyDb.length === 0) {
  if (drift.length === 0) {
    console.log('✅ the repo files and the database mirror agree exactly.');
    process.exit(0);
  }
  // ⭐ ATTRIBUTION ONLY. The two lists hold the same ids; they disagree about
  // which file each id came from, because `liveSyncExcludedIds.json` is a SCOPE
  // file that overlaps the milestone PROVENANCE files BY DESIGN and the mirror
  // dedupes. Nothing here can move a deficit, so the live-row fetch — 580k ids
  // over the wire — is skipped rather than spent proving that.
  reportFiles(null);
  const shared = drift.reduce((n, d) => n + (d.attributedElsewhere ?? []).length, 0);
  console.log(`\n✅ the repo files and the database mirror hold the SAME SET of ids.`);
  console.log(`${shared} id(s) are listed in two repo files and filed in the mirror under`);
  console.log('one of them. That overlap is by design — liveSyncExcludedIds.json states');
  console.log('its whole scope and the milestone files state their own provenance — and');
  console.log('every consumer unions them, so it changes no arithmetic. Nothing to fix.');
  process.exit(0);
}

const liveIds = new Set((await pageAll('budgets', 'id')).map((r) => r.id));
reportFiles(liveIds);

// ⚠⚠ THE HEADLINE IS THE LIVE COUNT. A drifting id that no longer matches a
// budget row cannot move any invariant — it is bookkeeping litter, real and
// worth cleaning, but reporting it alongside the live count sends the next
// reader hunting for rows that are not there. On 2026-10-31 the raw drift was
// 85 ids and only FOUR of them could move the deficit.
const differing = [...union.onlyRepo, ...union.onlyDb];
const live = differing.filter((id) => liveIds.has(id)).length;
console.log(`\n${live} LIVE id(s) differ between the two SETS — they match a budget row.`);
console.log(`${differing.length - live} stale id(s) differ — they match no budget row at all.`);

// ⚠⚠ DIFFERING IS NOT THE SAME AS RAISING THE DEFICIT, and the first draft of
// this script conflated them — its headline called every live difference "the
// number that moves the deficit" and that is false. Only ids the DATABASE
// excludes and the REPO does not raise what registerCreatedRows computes.
const blocking = union.onlyDb.filter((id) => liveIds.has(id)).length;
console.log(`${blocking} of them RAISE THE DEFICIT — live, excluded in the database,`
  + ' absent from every repo file.');

if (blocking > 0) {
  console.log('\nA file absent from this checkout usually means its PR is not merged yet.');
  console.log('Check: gh pr list --state open   — and register from a branch that has it,');
  console.log('or merge that PR first. Do NOT re-baseline to make the number agree.');
}

process.exit(blocking > 0 ? 1 : 0);
