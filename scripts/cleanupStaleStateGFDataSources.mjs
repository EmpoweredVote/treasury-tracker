#!/usr/bin/env node
/**
 * Stale State GF data_sources cleanup — full cohort sweep (Phase 102)
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 99/100 (original): Deleted CA/TX/NY/FL v1.7 stale sources.
 * Phase 102 (extended):    Sweeps ALL state-related *-gf-* data_sources that now
 *   back ZERO live budgets rows — the full residue cohort left after NASBO + ACFR
 *   upgrades across all 50 state nodes.
 *
 * Two modes:
 *   --named   (default-legacy): target the original Phase 99/100 named allow-list only
 *             (CA/TX/NY/FL — 8 entries). Kept for backward compatibility / spot checks.
 *   --cohort  (Phase 102 mode): dynamically discover all state-related *-gf-* data_sources
 *             with 0 referencing budgets rows and delete them.
 *
 * SAFETY (T-99-03 / T-102-02-01):
 *   - Before deleting EACH data_source, assert it backs ZERO budgets rows
 *     (count budgets WHERE data_source_id = ds.id). If a target unexpectedly backs >0
 *     rows, REFUSE to delete it and process.exit(2) — never delete a data_source that
 *     has live budgets rows.
 *   - In --cohort mode, city-level *-gf-* entries are EXCLUDED (anaheim-, fresno-,
 *     longbeach-, riverside-, sanjose-, santa-ana-) — only state-related dataset_ids
 *     are swept.
 *   - NASBO data_sources (dataset_id contains 'nasbo') are ALWAYS excluded in cohort mode
 *     as an additional safety check (though they already back 0 rows; belt-and-suspenders).
 *   - Idempotent: a second run finds the rows already gone and reports 0 deleted, exit 0.
 *
 * DRY-RUN BY DEFAULT. Real deletes happen ONLY with --apply.
 *
 * Usage:
 *   node scripts/cleanupStaleStateGFDataSources.mjs                   # DRY-RUN named (legacy)
 *   node scripts/cleanupStaleStateGFDataSources.mjs --state CA        # restrict named to CA
 *   node scripts/cleanupStaleStateGFDataSources.mjs --apply           # APPLY named deletes
 *   node scripts/cleanupStaleStateGFDataSources.mjs --cohort          # DRY-RUN full cohort sweep
 *   node scripts/cleanupStaleStateGFDataSources.mjs --cohort --apply  # APPLY full cohort sweep
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try { const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n'); for (const line of lines) { const [k, ...v] = line.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
  }
}
loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Named (legacy) allow-list ─────────────────────────────────────────────────
// Original Phase 99/100 stale targets. Never include *-nasbo rows.
const STALE_TARGETS_NAMED = {
  CA: ['ca-lao-gf-operating', 'ca-dof-gf-revenue'],
  TX: ['tx-gf-operating', 'tx-gf-revenue'],
  NY: ['ny-gf-operating', 'ny-gf-revenue'],
  FL: ['fl-gf-operating', 'fl-gf-revenue'],
};

// ── City prefixes to exclude from cohort sweep ────────────────────────────────
const CITY_PREFIXES = [
  'anaheim-', 'fresno-', 'longbeach-', 'riverside-', 'sanjose-', 'santa-ana-',
];

function isCityDataset(datasetId) {
  return CITY_PREFIXES.some(prefix => datasetId.startsWith(prefix));
}

// Hard guard for named mode: refuse to ever operate on a NASBO data_source or
// a dataset_id not in the named stale allow-list.
function assertSafeNamedTarget(datasetId) {
  if (/nasbo/i.test(datasetId)) {
    console.error(`REFUSING: "${datasetId}" looks like a NASBO data_source — never delete.`); process.exit(2);
  }
  const all = Object.values(STALE_TARGETS_NAMED).flat();
  if (!all.includes(datasetId)) {
    console.error(`REFUSING: "${datasetId}" is not in the stale named allow-list.`); process.exit(2);
  }
}

async function runNamedMode(supabase, { stateFilter, dryRun }) {
  const states = stateFilter ? [stateFilter] : ['CA', 'TX', 'NY', 'FL'];
  for (const s of states) {
    if (!STALE_TARGETS_NAMED[s]) {
      console.error(`Unknown state "${s}" — expected CA, TX, NY or FL (named mode).`); process.exit(2);
    }
  }
  const targets = states.flatMap(s => STALE_TARGETS_NAMED[s].map(id => ({ state: s, datasetId: id })));

  console.log(`Stale State GF data_sources cleanup [NAMED MODE] ${dryRun ? '(DRY-RUN — no deletes)' : '(APPLY — will delete)'}\n`);
  console.log(`Targets (${targets.length}): ${targets.map(t => t.datasetId).join(', ')}\n`);

  let wouldDelete = 0, deleted = 0, alreadyGone = 0;
  for (const t of targets) {
    assertSafeNamedTarget(t.datasetId); // belt-and-suspenders before ANY DB touch

    const { data: ds, error: dsErr } = await supabase.schema('treasury')
      .from('data_sources').select('id,name,dataset_id,api_type').eq('dataset_id', t.datasetId).maybeSingle();
    if (dsErr) { console.error(`  [${t.datasetId}] query error: ${dsErr.message}`); process.exit(2); }

    if (!ds) { console.log(`  [${t.datasetId}] not present (already removed) — skip (idempotent).`); alreadyGone++; continue; }

    // 0-row assertion: count budgets referencing this data_source.
    const { count, error: cErr } = await supabase.schema('treasury')
      .from('budgets').select('id', { count: 'exact', head: true }).eq('data_source_id', ds.id);
    if (cErr) { console.error(`  [${t.datasetId}] budgets count error: ${cErr.message}`); process.exit(2); }
    const rowCount = count ?? 0;

    if (rowCount > 0) {
      console.error(`  [${t.datasetId}] backs ${rowCount} budgets row(s) — REFUSING to delete (T-99-03). Exiting.`);
      process.exit(2);
    }
    console.log(`  [${t.datasetId}] id=${ds.id} api_type=${ds.api_type} backs ${rowCount} budgets rows → 0-row assertion PASS`);

    if (dryRun) { console.log(`    WOULD DELETE (dry-run).`); wouldDelete++; continue; }

    const { error: delErr } = await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
    if (delErr) { console.error(`    delete failed: ${delErr.message}`); process.exit(2); }
    console.log(`    DELETED.`); deleted++;
  }

  console.log('');
  if (dryRun) console.log(`Dry-run summary: ${wouldDelete} would-delete, ${alreadyGone} already-gone, 0 deleted.`);
  else        console.log(`Apply summary: ${deleted} deleted, ${alreadyGone} already-gone.`);
  console.log('Done.');
}

async function runCohortMode(supabase, { dryRun }) {
  console.log(`Stale State GF data_sources cleanup [COHORT MODE] ${dryRun ? '(DRY-RUN — no deletes)' : '(APPLY — will delete)'}`);
  console.log(`Discovers all state-related *-gf-* data_sources with 0 referencing live budgets rows.\n`);

  // Step 1: load all *-gf-* data_sources
  const { data: allGfSources, error: srcErr } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id,name,dataset_id,api_type')
    .like('dataset_id', '%-gf-%')
    .order('dataset_id');
  if (srcErr) { console.error('FATAL: Cannot load data_sources:', srcErr.message); process.exit(2); }

  // Step 2: filter to state-related only (exclude city entries)
  const stateGfSources = allGfSources.filter(ds => !isCityDataset(ds.dataset_id));
  console.log(`Found ${allGfSources.length} total *-gf-* data_sources, ${stateGfSources.length} are state-related (${allGfSources.length - stateGfSources.length} city entries excluded).\n`);

  // Step 3: for each state-related source, assert 0-row AND delete if --apply
  let wouldDelete = 0, deleted = 0, alreadyGone = 0, refusedLiveRows = 0;
  const deletedIds = [];

  for (const ds of stateGfSources) {
    // Safety: NASBO data_sources never deleted (belt-and-suspenders; they have 0 live rows
    // since all budget rows use text-stamp, but we exclude them from the cohort sweep to
    // match the plan's intent — NASBO-untouched invariant (INV-7)).
    if (/nasbo/i.test(ds.dataset_id)) {
      console.log(`  [${ds.dataset_id}] NASBO source — excluded from cohort sweep (always preserved).`);
      continue;
    }

    // 0-row assertion: count budgets referencing this data_source.
    const { count, error: cErr } = await supabase.schema('treasury')
      .from('budgets').select('id', { count: 'exact', head: true }).eq('data_source_id', ds.id);
    if (cErr) { console.error(`  [${ds.dataset_id}] budgets count error: ${cErr.message}`); process.exit(2); }
    const rowCount = count ?? 0;

    if (rowCount > 0) {
      // This should never happen given all state rows use text-stamp (data_source_id=null)
      // but the guard is absolute — refuse and exit.
      console.error(`  [${ds.dataset_id}] backs ${rowCount} live budgets row(s) — REFUSING to delete (T-102-02-01). Exiting.`);
      process.exit(2);
    }

    console.log(`  [${ds.dataset_id}] api_type=${ds.api_type} backs 0 budgets rows → 0-row assertion PASS`);

    if (dryRun) {
      console.log(`    WOULD DELETE (dry-run).`);
      wouldDelete++;
      deletedIds.push(ds.dataset_id);
      continue;
    }

    const { error: delErr } = await supabase.schema('treasury').from('data_sources').delete().eq('id', ds.id);
    if (delErr) { console.error(`    delete failed: ${delErr.message}`); process.exit(2); }
    console.log(`    DELETED.`);
    deleted++;
    deletedIds.push(ds.dataset_id);
  }

  console.log('');
  if (dryRun) {
    console.log(`Cohort dry-run summary: ${wouldDelete} would-delete, ${alreadyGone} already-gone, 0 deleted.`);
    console.log(`Would-delete list: ${deletedIds.join(', ')}`);
  } else {
    console.log(`Cohort apply summary: ${deleted} deleted, ${alreadyGone} already-gone, ${refusedLiveRows} refused (live rows — should be 0).`);
    if (deletedIds.length > 0) {
      console.log(`Deleted: ${deletedIds.join(', ')}`);
    }
  }
  console.log('Done.');
}

async function main() {
  const { values: opts } = parseArgs({
    options: {
      apply:  { type: 'boolean', default: false },
      cohort: { type: 'boolean', default: false },
      state:  { type: 'string' },
    },
    strict: false,
  });
  const apply    = opts.apply === true;
  const cohort   = opts.cohort === true;
  const stateFilter = opts.state ? opts.state.toUpperCase() : null;
  const dryRun   = !apply;

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY — cannot query data_sources.'); process.exit(2); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (cohort) {
    await runCohortMode(supabase, { dryRun });
  } else {
    await runNamedMode(supabase, { stateFilter, dryRun });
  }
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
