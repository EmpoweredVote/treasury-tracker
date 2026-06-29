#!/usr/bin/env node
/**
 * Stale State GF data_sources cleanup — CA + TX (Phase 99, D-04 / D-07 / RECON-03)
 * ──────────────────────────────────────────────────────────────────────────────
 * Deletes the legacy, non-NASBO, ZERO-budgets-row `data_sources` metadata rows that
 * the v1.7 CA loaders and the analogous TX rows left behind. They point at no budgets
 * rows and would mislead the upgraded (ACFR) cohort:
 *   CA: ca-lao-gf-operating, ca-dof-gf-revenue
 *   TX: tx-gf-operating,     tx-gf-revenue
 *
 * SAFETY (T-99-03):
 *   - Before deleting EACH data_source, assert it backs ZERO budgets rows
 *     (count budgets WHERE data_source_id = ds.id). If a target unexpectedly backs >0
 *     rows, REFUSE to delete it and process.exit(2) — never delete a data_source that
 *     has live budgets (protects the NASBO row + anything mislabeled).
 *   - The target dataset_id allow-list NEVER includes any `*-gf-operating-nasbo` row or
 *     any other state's rows.
 *   - Idempotent: a second run finds the rows already gone and reports 0 deleted, exit 0.
 *
 * DRY-RUN BY DEFAULT. Real deletes happen ONLY with --apply (run in 99-02/99-03, NOT here).
 *
 * Usage:
 *   node scripts/cleanupStaleStateGFDataSources.mjs            # DRY-RUN (default): list + assert, no deletes
 *   node scripts/cleanupStaleStateGFDataSources.mjs --state CA # restrict to CA targets
 *   node scripts/cleanupStaleStateGFDataSources.mjs --apply    # perform deletes (gated on 0-row assertion)
 *
 * Env (only needed for the live --apply / live --dry-run query): SUPABASE_URL,
 *   SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY).
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

// Allow-list of stale, non-NASBO, expected-zero-row dataset_ids ONLY. NEVER include a
// *-gf-operating-nasbo row or any other state. (D-04 / D-07)
const STALE_TARGETS = {
  CA: ['ca-lao-gf-operating', 'ca-dof-gf-revenue'],
  TX: ['tx-gf-operating', 'tx-gf-revenue'],
};

// Hard guard: refuse to ever operate on a NASBO data_source or a non-CA/TX dataset_id.
function assertSafeTarget(datasetId) {
  if (/nasbo/i.test(datasetId)) {
    console.error(`REFUSING: "${datasetId}" looks like a NASBO data_source — never delete.`); process.exit(2);
  }
  const all = [...STALE_TARGETS.CA, ...STALE_TARGETS.TX];
  if (!all.includes(datasetId)) {
    console.error(`REFUSING: "${datasetId}" is not in the stale allow-list.`); process.exit(2);
  }
}

async function main() {
  const { values: opts } = parseArgs({ options: { apply: { type: 'boolean', default: false }, state: { type: 'string' } }, strict: false });
  const apply = opts.apply === true;          // dry-run is the default (apply must be explicit)
  const stateFilter = opts.state ? opts.state.toUpperCase() : null;
  const dryRun = !apply;

  const states = stateFilter ? [stateFilter] : ['CA', 'TX'];
  for (const s of states) if (!STALE_TARGETS[s]) { console.error(`Unknown state "${s}" — expected CA or TX.`); process.exit(2); }
  const targets = states.flatMap(s => STALE_TARGETS[s].map(id => ({ state: s, datasetId: id })));

  console.log(`Stale State GF data_sources cleanup ${dryRun ? '(DRY-RUN — no deletes)' : '(APPLY — will delete)'}\n`);
  console.log(`Targets (${targets.length}): ${targets.map(t => t.datasetId).join(', ')}\n`);

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY — cannot query data_sources.'); process.exit(2); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let wouldDelete = 0, deleted = 0, alreadyGone = 0;
  for (const t of targets) {
    assertSafeTarget(t.datasetId); // belt-and-suspenders before ANY DB touch

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
main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
