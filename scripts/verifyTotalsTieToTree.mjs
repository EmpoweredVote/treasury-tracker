#!/usr/bin/env node
/**
 * Gate: a budget's headline total must equal the sum of its root categories.
 *
 *   node scripts/verifyTotalsTieToTree.mjs --print-sql      # emit the measurement
 *   node scripts/verifyTotalsTieToTree.mjs --check rows.json # apply the ratchet
 *
 * ⚠⚠ WHY IT IS SPLIT IN TWO. The measurement is a join-aggregate over 585,587
 * budgets and their categories, which PostgREST cannot express and which is
 * far too slow to page row by row (deriveTotalGovernmental takes 37s for
 * 9,602). So the database does the aggregate and hands back ONLY the failing
 * rows — about 1,780 — and the JS decides what they mean. The SQL filter is
 * deliberately WIDER than the rule in scripts/lib/totalsTie.mjs so that the
 * rule stays the single authority: SQL narrows, JS judges.
 *
 * Same shape as verifyGeoidBackfill.mjs, and for the same reason.
 *
 * ── ⚠ THE BASELINES ARE A DEBT, NOT A TARGET ───────────────────────────────
 *
 * Measured 2026-11-01. They exist so the gate can ship against a known-broken
 * fleet without being a red light nobody can turn green. Lower them whenever
 * the run reports an improvement; never raise one to quiet a failure.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { summarizeTies, summarizeCounts } from './lib/totalsTie.mjs';

/** Known mismatches per source family, 2026-11-01; Ohio paid down 2026-11-03. */
const BASELINE = {
  // ✅ OHIO IS ZERO. Diagnosed and reloaded 2026-11-03.
  //
  // ⚠⚠ AND THE COMMENT THAT STOOD HERE WAS WRONG ON BOTH COUNTS. It called the
  // cohort "UNDIAGNOSED" and said "a reload will not fix it". A reload is
  // precisely what fixed it: every one of the 1,763 carried a DUPLICATE ROOT
  // from the publisher's verbatim repeated column, the repair had already
  // shipped in #315 (`scripts/lib/ohioTree.mjs`), and nobody had ever re-run
  // the loader. The fix sat in the repo, correct and unused, for weeks.
  //
  // ⚠ It also claimed the Ohio memory's "1,778 rows need a RELOAD" heading
  // conflated two defects. It did not. 1,763 revenue + 13 operating = 1,776,
  // and #327 had already repaired 2 of the original 1,778. The heading was
  // right; the correction was the error.
  'Minnesota Office of the State Auditor City/County Finances Report': 1,
  'Prosper Revenue FY2023': 1,
  'Prosper Revenue FY2024': 1,
  'Prosper Revenue FY2025': 1,
};

/**
 * Known trees that repeat a root LABEL, 2026-11-03.
 *
 * ⚠⚠ ANY FAMILY NOT LISTED HERE IS HELD AT ZERO, which is the whole point. A
 * duplicate label can tie its total perfectly — Ohio's 13 `Other` rows did, for
 * as long as this gate has existed — so no other counter here can see it. An
 * absent family failing means the first duplicate to appear breaks the build
 * instead of waiting years to be noticed.
 *
 * ⚠ THE SIX BELOW WERE FOUND BY THIS COUNTER THE FIRST TIME IT RAN, and they
 * are NOT the Ohio defect. They are recorded as debt so Ohio's repair could
 * land without a red light nobody can turn green — not a target, not forgiven:
 *
 *   McKinney Check Register — the breakdown repeats `Fleet & Vehicles` SIX
 *     times and `Parks & Recreation` six times, each copy a DIFFERENT amount.
 *     Every one ties, so no gate has ever reported it.
 *
 *     ⚠⚠⚠ DIAGNOSED 2026-11-03 AND IT IS NOT A LABELLING BUG. Each duplicate
 *     carries a DISTINCT `link_key` — McKinney's own department code — so the
 *     tree is keyed correctly and no money is wrong. The DISPLAY NAMES are the
 *     defect: McKinney publishes a bare 4-digit code and NO department name
 *     anywhere (checked the check register, the payroll register and the
 *     column_mapping), so every friendly label in TT is UNSOURCED, and a
 *     material share of them is WRONG. Measured against McKinney's own budget
 *     book and corroborated by the publisher's own vendor lines:
 *         2119 is IT (MICROSOFT RENEWAL, PC LEASE) — TT says `Risk Management`
 *         4306 is Parks Maint. (LANDSCAPING MAINT) — TT says `Development
 *              Reimbursements`
 *     Deduplicating these labels would make an invention look more precise.
 *     DO NOT "fix" this by appending the code. See the Ohio memory.
 *
 * ✅ San Jose was the other one, and it is CLOSED — a department name wrapped
 * onto two PDF lines and the extractor kept only the half carrying the
 * amounts. Repaired in scripts/extractSanJose.py and reloaded FY2022-FY2025.
 */
const DUPLICATE_BASELINE = {
  'McKinney Check Register FY2022': 1,
  'McKinney Check Register FY2023': 1,
  'McKinney Check Register FY2024': 1,
  'McKinney Check Register FY2025': 1,
};

/**
 * Known NEGATIVE headline totals.
 *
 * ✅ Ohio's 13 went to zero in #327, when the city MOD rows were reloaded from
 * the workbooks: the worst, Huber Heights FY2024 operating, read −$35,461,443
 * against roots summing to +$10,483,560 and now reads +$88,732,831.
 */
const NEGATIVE_BASELINE = {};

// ⚠ `split_part(data_source, ' —', 1)` is an EM DASH, matching how every
// loader labels a source: "<publisher> — <dataset> (<FY>, <basis>)".
const SQL = `
-- Budgets whose stored total may not tie to their own root categories.
-- Returns only candidates; scripts/lib/totalsTie.mjs makes the call.
with roots as (
  select budget_id, sum(amount) as root_sum, count(*) as n_roots,
         count(distinct name) as distinct_root_names
  from treasury.budget_categories
  where parent_id is null
  group by budget_id
)
select split_part(b.data_source, ' —', 1)        as source,
       b.total_budget::numeric                   as total,
       coalesce(r.root_sum, 0)::numeric          as "rootSum",
       coalesce(r.n_roots, 0)                    as "nRoots",
       coalesce(r.distinct_root_names, 0)        as "distinctRootNames"
from treasury.budgets b
left join roots r on r.budget_id = b.id
where b.total_budget < 0
   or coalesce(r.n_roots, 0) = 0
   or abs(b.total_budget - coalesce(r.root_sum, 0)) > 1
order by 1, 2;
`;

const argv = process.argv.slice(2);
if (argv.includes('--print-sql')) {
  process.stdout.write(SQL);
  process.exit(0);
}

let r;
let examined;
if (argv.includes('--check')) {
  // Offline path: the SQL above, saved as JSON. The JS rule judges each row.
  const file = argv[argv.indexOf('--check') + 1];
  if (!file) {
    console.error('usage: verifyTotalsTieToTree.mjs [--print-sql | --check <rows.json>]');
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  r = summarizeTies(rows, BASELINE, NEGATIVE_BASELINE, DUPLICATE_BASELINE);
  examined = `${rows.length} candidate row(s) examined`;
} else {
  // ⚠ Default path: the database aggregates, exactly as verify:frozen does.
  // treasury.totals_tie_status() is read-only and moves no figure.
  const db = createClient(
    process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co',
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
  const { data, error } = await db.schema('treasury').rpc('totals_tie_status');
  if (error) {
    console.error(`totals_tie_status failed: ${error.message}`);
    console.error('\nTry:  node scripts/verifyTotalsTieToTree.mjs --print-sql');
    process.exit(1);
  }
  r = summarizeCounts(data, BASELINE, NEGATIVE_BASELINE, DUPLICATE_BASELINE);
  examined = `${data.length} source(s) with at least one candidate row`;
}

console.log(`${examined}\n`);
console.log(`mismatched totals: ${r.total}`);
for (const [source, n] of Object.entries(r.bySource).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${source}   (baseline ${BASELINE[source] ?? 0})`);
}
const negTotal = Object.values(r.negatives).reduce((a, b) => a + b, 0);
console.log(`\nNEGATIVE totals: ${negTotal}`);
for (const [source, n] of Object.entries(r.negatives)) {
  console.log(`  ${String(n).padStart(5)}  ${source}   (baseline ${NEGATIVE_BASELINE[source] ?? 0})`);
}
// ⚠⚠ Reported on its OWN line, because none of the numbers above can imply it:
// a tree that repeats a label can tie its total to the dollar.
const dupTotal = Object.values(r.duplicates).reduce((a, b) => a + b, 0);
console.log(`\nDUPLICATE root labels: ${dupTotal}`);
for (const [source, n] of Object.entries(r.duplicates)) {
  console.log(`  ${String(n).padStart(5)}  ${source}   (baseline ${DUPLICATE_BASELINE[source] ?? 0})`);
}

const rootlessTotal = Object.values(r.rootless).reduce((a, b) => a + b, 0);
console.log(`\nrootless (no tree at all, reported not gated): ${rootlessTotal}`);
for (const [source, n] of Object.entries(r.rootless)) console.log(`  ${String(n).padStart(5)}  ${source}`);

// ⚠ An improvement is NEWS, not a pass to ignore: the baseline is a debt and
// should be paid down in the same commit that earns it.
if (r.improvements.length) {
  console.log('\n⭐ improved — lower these baselines in this commit:');
  for (const i of r.improvements) console.log(`  ${i.source}: ${i.baseline} -> ${i.actual}`);
}

if (!r.ok) {
  console.error('\n❌ REGRESSION — a total stopped tying to its own tree:');
  for (const g of r.regressions) {
    const label = { negative: 'negative totals ', duplicate: 'duplicate root labels ' }[g.kind]
      ?? 'mismatches ';
    console.error(`  ${g.source}: ${label}${g.baseline} -> ${g.actual}`);
  }
  console.error('\nA headline figure that contradicts its own breakdown is not publishable.');
  console.error('Neither is a breakdown that shows the reader one label twice.');
  console.error('Fix the loader; do not raise the baseline.');
  // ⚠⚠ `process.exit(1)` HERE ABORTED THE PROCESS INSTEAD OF FAILING IT. With
  // the supabase client's keep-alive socket still open, Node on Windows trips
  // `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` and the run ends
  // with code **127**, which reads as "command not found" — a gate whose
  // failure looks like a broken invocation is a gate people route around.
  // Setting exitCode lets the process close its handles and exit 1.
  process.exitCode = 1;
}
console.log('\nOK — no source is worse than its recorded baseline.');
