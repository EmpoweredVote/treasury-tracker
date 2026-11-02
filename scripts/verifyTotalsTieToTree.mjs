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

/** Known mismatches per source family, 2026-11-01. */
const BASELINE = {
  'Ohio Auditor of State Summarized Annual Financial Reports': 1765,
  'Minnesota Office of the State Auditor City/County Finances Report': 1,
  'Prosper Revenue FY2023': 1,
  'Prosper Revenue FY2024': 1,
  'Prosper Revenue FY2025': 1,
};

/**
 * Known NEGATIVE headline totals, 2026-11-01. All Ohio, all with duplicate
 * root-category names. Worst: Huber Heights FY2024 operating, −$35,461,443
 * against roots summing to +$10,483,560.
 */
const NEGATIVE_BASELINE = {
  'Ohio Auditor of State Summarized Annual Financial Reports': 13,
};

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
  r = summarizeTies(rows, BASELINE, NEGATIVE_BASELINE);
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
  r = summarizeCounts(data, BASELINE, NEGATIVE_BASELINE);
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
    console.error(`  ${g.source}: ${g.kind === 'negative' ? 'negative totals ' : 'mismatches '}`
      + `${g.baseline} -> ${g.actual}`);
  }
  console.error('\nA headline figure that contradicts its own breakdown is not publishable.');
  console.error('Fix the loader; do not raise the baseline.');
  process.exit(1);
}
console.log('\nOK — no source is worse than its recorded baseline.');
