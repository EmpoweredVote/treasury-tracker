/**
 * ONE-OFF: write the created-ids files the three post-v2.30 milestones owed.
 *
 * NO SHEBANG — kept importable.
 *
 * The frozen invariant is computed as an exclusion, so every milestone that
 * INSERTS rows must register their ids. Three did not, leaving 154 rows inside
 * a digest built from 79,916:
 *
 *   NC onboarding      PR #58,  merged 2026-08-25   138
 *   SF widen FYs       PR #100, merged 2026-08-27     4
 *   WeHo wide format   PR #89,  merged 2026-08-27    12
 *
 * Membership is derived from provenance, then CHECKED against the arithmetic:
 * the three sets must sum to exactly the deficit the harness reports. They do.
 *
 * ⚠ One file per milestone, never a shared one. The single shared file went
 * un-updated across v2.27-v2.29 and that is what `excluded_ids_files` being a
 * LIST exists to prevent.
 *
 * Usage: node scripts/writeUnregisteredCreatedIds.mjs [--write]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';

const baseline = JSON.parse(readFileSync('scripts/data/scopeBaseline.json', 'utf8'));
const excluded = new Set(baseline.excluded_ids_files.flatMap((rel) => JSON.parse(readFileSync(rel, 'utf8'))));

const supabase = await getSupabase();
const rows = (await fetchScopeRows(supabase)).filter((r) => !excluded.has(r.id));

const ent = (r) => `${r.name ?? '(unknown)'}, ${r.state ?? ''}`;
const NC_ENTITIES = new Set(['Durham, NC', 'Durham County, NC', 'Asheville, NC', 'Buncombe County, NC']);

const milestones = [
  {
    file: 'scripts/data/v231NcCreatedIds.json',
    label: 'v2.31 NC onboarding (PR #58, 2026-08-25)',
    expect: 138,
    // Four entities that did not exist at the rebase, so EVERY row is post-freeze.
    match: (r) => NC_ENTITIES.has(ent(r)),
  },
  {
    file: 'scripts/data/sfWidenFiscalYearsCreatedIds.json',
    label: 'SF widen fiscal years (PR #100, 2026-08-27)',
    expect: 4,
    // An EXISTING entity that gained new YEARS. FY2025-26 already existed and are
    // frozen; only FY2027-28 are new.
    match: (r) => ent(r) === 'San Francisco, CA'
      && /^San Francisco (Operating|Revenue) Budget$/.test(r.data_source ?? '')
      && r.fiscal_year >= 2027,
  },
  {
    file: 'scripts/data/wehoWideFormatCreatedIds.json',
    label: 'WeHo wide-format year_columns (PR #89, 2026-08-27)',
    expect: 12,
    // An EXISTING entity that gained new SOURCES. Its SCO, publicpay, derived and
    // demand-register rows are older and stay frozen.
    match: (r) => ent(r) === 'West Hollywood, CA'
      && /^West Hollywood Budget (Revenue|Expenditure) Detail/.test(r.data_source ?? ''),
  },
];

const write = process.argv.includes('--write');
let total = 0;
let ok = true;

for (const m of milestones) {
  const ids = rows.filter(m.match).map((r) => r.id).sort();
  const good = ids.length === m.expect;
  ok = ok && good;
  total += ids.length;
  console.log(`${good ? '✅' : '✗ '} ${String(ids.length).padStart(4)}/${m.expect}  ${m.label}`);
  if (write && good) {
    writeFileSync(m.file, `${JSON.stringify(ids, null, 2)}\n`);
    console.log(`      wrote ${m.file}`);
  }
}

const deficit = rows.length - baseline.frozen_row_count;
console.log(`\ntotal ${total} vs deficit ${deficit}  ${total === deficit ? '✅ reconciles exactly' : '✗ DOES NOT RECONCILE'}`);
if (!ok || total !== deficit) {
  console.error('\nRefusing to treat this as complete — do not register a set that does not reconcile.');
  process.exit(1);
}
if (!write) console.log('\n(dry run — pass --write to emit the files)');
