#!/usr/bin/env node
/**
 * Name the row that moved, by diffing a RESTORED BACKUP against live.
 *
 *   node --env-file=.env scripts/frozenFigureBackupDiff.mjs \
 *     --url https://<restored-ref>.supabase.co --key <restored service key>
 *
 * ── ⚠⚠ WHY THIS EXISTS ─────────────────────────────────────────────────────
 *
 * The frozen-figure digest proves a figure moved and cannot say which — a hash
 * does not invert. Until 2026-09-17 nothing in TT kept per-row values or stamped
 * a write time, so three incidents (v2.35, v2.36, and the 2026-09-08→14 window)
 * each had to be solved by luck or left unsolved. treasury.frozen_figure_snapshot
 * and the budgets write-time trigger close that gap GOING FORWARD. This script is
 * how a drift from BEFORE those existed can still be named: restore a backup from
 * before the move and compare the two databases row by row.
 *
 * ⚠⚠ THE RESTORED SIDE MUST REPRODUCE THE BASELINE DIGEST, OR THE DIFF MEANS
 * NOTHING. This script computes both digests and says so loudly: if the restored
 * snapshot already carries the CURRENT digest, it is from after the move and a
 *2026-09-08→14 drift needs an earlier backup. If it carries the repo's
 * `figures_frozen`, it predates the move and every row it names is real.
 *
 * ⚠ Both sides are filtered by the REPO's exclusion files, never by each
 * database's own frozen_excluded_ids mirror. The mirrors are snapshots that
 * changed over time, and comparing two different exclusion sets would invent
 * differences that are only bookkeeping.
 *
 * Read-only. It writes nothing to either database.
 */

import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { fetchScopeRows } from './lib/scopeDb.mjs';
import { frozenIdDigest } from './lib/scopeVerify.mjs';

const BASELINE = 'scripts/data/scopeBaseline.json';

function excludedIdsFromRepo(baseline) {
  const ids = new Set();
  for (const file of baseline.excluded_ids_files) {
    for (const id of JSON.parse(readFileSync(file, 'utf8'))) ids.add(id);
  }
  return ids;
}

async function frozenSide(label, url, key, excluded) {
  const client = createClient(url, key);
  const rows = await fetchScopeRows(client);
  const frozen = rows.filter((r) => !excluded.has(r.id));
  const digest = frozenIdDigest(rows, [...excluded]);
  console.log(`  ${label.padEnd(9)} ${rows.length.toLocaleString()} rows, ${frozen.length.toLocaleString()} frozen, digest ${digest}`);
  return { rows: frozen, digest };
}

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      key: { type: 'string' },
      out: { type: 'string' },
    },
  });

  const liveUrl = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const liveKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const restoredUrl = values.url || process.env.RESTORE_SUPABASE_URL;
  const restoredKey = values.key || process.env.RESTORE_SUPABASE_SERVICE_KEY;

  if (!liveKey || !restoredUrl || !restoredKey) {
    console.error('Required: --url <restored project url> --key <restored service key>');
    console.error('Live credentials come from .env (node --env-file=.env ...).');
    process.exitCode = 1;
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const excluded = excludedIdsFromRepo(baseline);

  console.log('\nFrozen-figure backup diff');
  console.log(`  baseline  ${baseline.frozen_row_count.toLocaleString()} rows, digest ${baseline.figures_frozen}`);
  const restored = await frozenSide('restored', restoredUrl, restoredKey, excluded);
  const live = await frozenSide('live', liveUrl, liveKey, excluded);

  // ⚠ State the verdict on the restore BEFORE the diff, because a diff against
  // the wrong snapshot looks exactly like a diff against the right one.
  if (restored.digest === live.digest) {
    console.log('\n⚠⚠ The restored snapshot carries the SAME digest as live — it is from AFTER');
    console.log('   the move. Restore an earlier backup; this diff cannot see the change.');
  } else if (restored.digest === baseline.figures_frozen) {
    console.log('\n⭐ The restored snapshot reproduces the repo baseline exactly. It predates the');
    console.log('   move, so every row named below is a real, unexplained change.');
  } else {
    console.log('\n⚠ The restored snapshot matches NEITHER the baseline nor live. It sits');
    console.log('   between two movements — the rows below are real, but there may be more.');
  }

  const restoredById = new Map(restored.rows.map((r) => [r.id, r]));
  const liveById = new Map(live.rows.map((r) => [r.id, r]));

  const moved = [];
  for (const [id, r] of restoredById) {
    const l = liveById.get(id);
    if (!l) { moved.push({ kind: 'gone', id, before: r.total_budget, after: null, row: r }); continue; }
    // ⚠ Compared as TEXT, byte for byte — the digest hashes the text form, so a
    // numeric compare here could call two different digest inputs equal.
    if (String(r.total_budget) !== String(l.total_budget)) {
      moved.push({ kind: 'moved', id, before: r.total_budget, after: l.total_budget, row: l });
    }
  }
  for (const [id, l] of liveById) {
    if (!restoredById.has(id)) moved.push({ kind: 'new', id, before: null, after: l.total_budget, row: l });
  }

  console.log(`\n${moved.length} difference(s):\n`);
  for (const d of moved) {
    const r = d.row;
    console.log(`  ${d.kind.toUpperCase()}  FY${r.fiscal_year} ${r.dataset_type}  ${r.data_source ?? ''}`);
    console.log(`      ${d.before ?? '(absent)'}  ->  ${d.after ?? '(absent)'}`);
    console.log(`      ${d.id}  municipality ${r.municipality_id}`);
  }

  if (values.out) {
    writeFileSync(values.out, JSON.stringify(moved, null, 2));
    console.log(`\nWritten to ${values.out}`);
  }

  // ⭐ The payoff: a MOVED row's `before` is exactly what the figure-change
  // ledger needs, and recording it there makes the digest verify again with NO
  // rebase — the invariant keeps its whole history instead of being reset.
  if (moved.some((d) => d.kind === 'moved')) {
    console.log('\nEach MOVED row\'s "before" value is what scripts/data/figureChanges.json needs.');
    console.log('Recording them there makes the digest verify again WITHOUT rebasing the invariant.');
    console.log('⚠ Record a value only once you know what wrote it. An unexplained change is a');
    console.log('  finding, not a correction — the ledger is for authorised ones.');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
