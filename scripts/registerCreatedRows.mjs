/**
 * Register the rows a milestone just created, so the frozen invariant keeps
 * reconciling. RUN THIS AFTER ANY LOAD THAT INSERTS BUDGET ROWS.
 *
 * NO SHEBANG — kept importable.
 *
 * ⚠ WHY THIS EXISTS. Three of the four times the frozen invariant has broken, the
 * cause was the same: a milestone inserted rows and nobody wrote down their ids.
 * The rule was documented and still missed, because it was a three-step chore —
 * find the ids, write a JSON file, edit scopeBaseline.json — done days after the
 * load, by which time the deficit is a mystery.
 *
 * This makes it ONE command, run at the moment the rows are new and their
 * provenance is obvious. It is the cause-side fix; the in-database weekly check
 * (treasury.run_frozen_invariant_check) is only the safety net.
 *
 * Usage:
 *   node scripts/registerCreatedRows.mjs
 *       Report whether anything is unregistered, and what it is.
 *
 *   node scripts/registerCreatedRows.mjs --milestone nc-charlotte
 *   # --match is REPEATABLE; the UNION must equal the deficit exactly:
 *   node scripts/registerCreatedRows.mjs --milestone knight-s2 \
 *     --match "City of Charlotte ACFR" --match "Mecklenburg County ACFR"
 *       Write scripts/data/ncCharlotteCreatedIds.json with the unregistered ids,
 *       append it to excluded_ids_files, and re-verify.
 *
 * ⚠ It registers whatever is currently unaccounted for. Run it right after YOUR
 * load, not after someone else's — otherwise you file their rows under your name.
 * It always prints the breakdown by entity and source first so you can check that
 * what it is about to register is actually yours.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';

const BASELINE = 'scripts/data/scopeBaseline.json';

const camel = (s) => s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase());

async function main() {
  const milestone = process.argv.includes('--milestone')
    ? process.argv[process.argv.indexOf('--milestone') + 1]
    : null;

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const excluded = new Set((baseline.excluded_ids_files ?? [])
    .flatMap((f) => JSON.parse(readFileSync(f, 'utf8'))));

  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  const nonExcluded = rows.filter((r) => !excluded.has(r.id));
  const deficit = nonExcluded.length - baseline.frozen_row_count;

  console.log(`non-excluded ${nonExcluded.length}  frozen_row_count ${baseline.frozen_row_count}  deficit ${deficit}\n`);

  if (deficit === 0) {
    console.log('✅ nothing to register — every row is accounted for.');
    return;
  }
  if (deficit < 0) {
    console.error(`✗ ${-deficit} frozen row(s) have VANISHED. This tool cannot help: a delete is `
      + 'as serious as an edit. Investigate before doing anything else.');
    process.exit(1);
  }

  // ⚠ Show WHAT is about to be registered before registering it. Registering a
  // count without looking is how the wrong rows get filed under the wrong
  // milestone and the accounting stops meaning anything.
  console.log(`${deficit} row(s) are unregistered. Newest-looking candidates by entity and source:\n`);
  const groups = new Map();
  for (const r of nonExcluded) {
    const key = `${r.name ?? '(unknown)'}, ${r.state ?? ''} :: ${(r.data_source ?? '(null)').split('—')[0].trim()}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  // Cannot know which rows are new without the frozen id list, so surface the
  // smallest groups — a fresh load is usually a small, distinct set.
  const ranked = [...groups.entries()].sort((a, b) => a[1] - b[1]).slice(0, 15);
  for (const [k, n] of ranked) console.log(`  ${String(n).padStart(5)}  ${k}`);
  console.log('\n⚠ This tool cannot identify WHICH rows are new — the frozen id list was never');
  console.log('  committed (it would be a ~3MB artifact). Registering requires knowing what you');
  console.log('  just loaded. If the deficit does not match your load, STOP and investigate.\n');

  if (!milestone) {
    console.log('Pass --milestone <name> to register. Nothing written.');
    return;
  }

  console.error('✗ Refusing to guess. Registering by deficit alone would file arbitrary rows.');
  console.error('  Add a --match filter (entity or data_source substring) identifying YOUR rows,');
  console.error('  e.g. --milestone nc-charlotte --match "Charlotte, NC"');
  // ⚠ REPEATABLE. A milestone is not always one entity: the Knight campaign
  // loads Charlotte AND Mecklenburg County together, and its Florida session
  // loads four cities at once. With a single --match such a milestone cannot be
  // registered at all — no substring selects exactly those rows and nothing
  // else — and the only ways through would have been to register the entities
  // under separate milestone names (the SHARED-FILE bookkeeping that broke the
  // invariant across v2.27-v2.29) or to widen the match until it over-selected.
  //
  // The guard is UNCHANGED and is what matters: the UNION of the matches must
  // still equal the deficit exactly, and each match is reported separately so an
  // over-broad one is visible rather than hidden inside a total that happens to
  // add up.
  const matchArgs = process.argv.reduce(
    (acc, a, i) => (a === '--match' && process.argv[i + 1] ? [...acc, process.argv[i + 1]] : acc), [],
  );
  if (!matchArgs.length) process.exit(1);

  const key = (r) => `${r.name}, ${r.state} :: ${r.data_source}`;
  const seen = new Map();
  for (const m of matchArgs) {
    const hits = nonExcluded.filter((r) => key(r).includes(m));
    console.log(`\n--match "${m}" selects ${hits.length} row(s).`);
    for (const r of hits) seen.set(r.id, r);
  }
  const mine = [...seen.values()];
  const overlap = matchArgs.reduce((n, m) => n + nonExcluded.filter((r) => key(r).includes(m)).length, 0)
    - mine.length;
  if (overlap) console.log(`  (${overlap} row(s) matched more than one filter; counted once)`);
  console.log(`\nunion selects ${mine.length} row(s); deficit is ${deficit}.`);
  if (mine.length !== deficit) {
    console.error('✗ Those do not agree. Registering a set that does not reconcile is exactly the');
    console.error('  bookkeeping error this tool exists to prevent. Refusing to write.');
    process.exit(1);
  }

  const file = `scripts/data/${camel(milestone)}CreatedIds.json`;
  writeFileSync(file, `${JSON.stringify(mine.map((r) => r.id).sort(), null, 2)}\n`);
  baseline.excluded_ids_files = [...baseline.excluded_ids_files, file];
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`\n✅ wrote ${file} and registered it in ${BASELINE}`);
  console.log('   Next: node scripts/syncFrozenInvariantState.mjs --set-baseline');
  console.log('   (only after the JS harness passes — see reference_frozen_figure_invariant)');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('registerCreatedRows.mjs')) await main();
