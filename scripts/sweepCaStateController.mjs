#!/usr/bin/env node
/**
 * Drive the CA State Controller loaders across the whole fleet, resumably.
 *
 * (Shebang is correct HERE — an entry-point script. Every decision lives in
 * scripts/lib/caSweepPlan.mjs so it can be unit-tested without running a load.)
 *
 * ⚠⚠ WHY THIS EXISTS, rather than a shell loop. The fleet is 112 loader
 * invocations — 55 counties of cities plus 57 county governments — and
 * `bulkLoadStateController.js` calls `process.exit(1)` on a fiscal-year
 * contradiction, which today abandons a whole county. 88 cities of Los
 * Angeles should not be lost to one city's bad month. The feed also
 * intermittently connect-times-out (~1/3 success observed 2026-06-17) and the
 * loaders have no fetch retry.
 *
 * ⚠⚠ SEQUENTIAL AND IN THE FOREGROUND, deliberately. Four concurrent
 * background loaders were ALL killed by the memory reaper during the New York
 * load, costing about an hour and leaving four part-written years.
 *
 * ⚠⚠ THE CHECKPOINT IS NOT THE TRUTH. It records what this driver observed.
 * After the sweep, count the rows in the DATABASE — a loader has reported
 * exit 0 having done half its work before.
 *
 * Usage:
 *   node scripts/sweepCaStateController.mjs --fy 2025 --dry-run
 *   node scripts/sweepCaStateController.mjs --fy 2025
 *   node scripts/sweepCaStateController.mjs --fy 2025 --only city
 *   node scripts/sweepCaStateController.mjs --fy 2025 --retry-parked
 *
 *   --fy             REQUIRED. The fiscal year to load.
 *   --dry-run        Pass --dry-run to every loader. Writes nothing, and the
 *                    checkpoint is not written either.
 *   --only           'city' or 'county'. Default: both.
 *   --max-attempts   Retries per unit for TRANSPORT failures only. Default 4.
 *   --checkpoint     Path. Default cache/sweep-ca-<fy>.json (cache/ is gitignored).
 *   --retry-parked   Clear parked units and try them again, after fixing the
 *                    cause. Parked units are never retried automatically.
 *   --plan-only      Print the work list and stop. Runs no loader, touches
 *                    nothing. The cheap way to see what a sweep would do.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import {
  buildWorkList, mergeCheckpoint, pendingUnits, classifyRun, isRetryable, summarize,
} from './lib/caSweepPlan.mjs';

const CITY_EXPENDITURES = 'ju3w-4gxp';
const COUNTY_EXPENDITURES = 'emxv-k8xv';

const { values } = parseArgs({
  options: {
    fy: { type: 'string' },
    'dry-run': { type: 'boolean' },
    only: { type: 'string' },
    'max-attempts': { type: 'string' },
    checkpoint: { type: 'string' },
    'retry-parked': { type: 'boolean' },
    'plan-only': { type: 'boolean' },
  },
  strict: false,
});

const fy = Number(values.fy);
if (!Number.isInteger(fy)) {
  console.error('--fy is required, e.g. --fy 2025');
  process.exit(1);
}
const dryRun = values['dry-run'] ?? false;
const only = values.only ?? null;
if (only && !['city', 'county'].includes(only)) {
  console.error("--only takes 'city' or 'county'");
  process.exit(1);
}
const maxAttempts = Number(values['max-attempts'] ?? 4);
const checkpointPath = values.checkpoint ?? `cache/sweep-ca-${fy}.json`;

/**
 * Ask the feed itself what entities exist for this year.
 *
 * ⚠ NEVER a hardcoded county list. 55 counties hold cities today and the set
 * changes: Mountain House incorporated 2024-07-01 and appears for the first
 * time in FY2025, taking California from 482 cities to 483.
 */
async function distinct(datasetId, column) {
  const params = new URLSearchParams({
    $select: column, $where: `fiscal_year='${fy}'`, $group: column, $limit: '2000',
  });
  const url = `https://bythenumbers.sco.ca.gov/resource/${datasetId}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`discovery failed: API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return (await resp.json()).map((r) => r[column]).filter(Boolean);
}

/** Run one loader to completion, capturing everything it printed. */
function runLoader(unit) {
  const args = unit.kind === 'city'
    ? ['scripts/bulkLoadStateController.js', '--county', unit.key, '--fy', String(fy)]
    : ['scripts/loadCountyBudget.js', '--county', unit.key, '--fy', String(fy)];
  if (dryRun) args.push('--dry-run');

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { env: process.env });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
    child.on('error', (err) => resolve({ code: 1, output: `spawn failed: ${err.message}` }));
  });
}

function todoCount(us) { return pendingUnits(us).length; }

function saveCheckpoint(units) {
  if (dryRun) return;
  const byId = {};
  for (const u of units) byId[u.id] = { status: u.status, attempts: u.attempts, note: u.note };
  mkdirSync(dirname(checkpointPath), { recursive: true });
  writeFileSync(checkpointPath, `${JSON.stringify({ fy, savedAt: new Date().toISOString(), units: byId }, null, 2)}\n`);
}

const [cityCounties, countyEntities] = await Promise.all([
  only === 'county' ? Promise.resolve([]) : distinct(CITY_EXPENDITURES, 'county'),
  only === 'city' ? Promise.resolve([]) : distinct(COUNTY_EXPENDITURES, 'entity_name'),
]);

const prior = existsSync(checkpointPath) ? JSON.parse(readFileSync(checkpointPath, 'utf8')) : null;
if (prior && values['retry-parked']) {
  for (const entry of Object.values(prior.units ?? {})) {
    if (entry.status === 'parked') { entry.status = 'retry'; entry.attempts = 0; }
  }
}
const units = mergeCheckpoint(buildWorkList({ cityCounties, countyEntities, fy }), prior);

console.log(`\nCA State Controller fleet sweep — FY${fy}${dryRun ? '  (DRY RUN, writes nothing)' : ''}`);
console.log(`  ${cityCounties.length} city counties · ${countyEntities.length} county governments`
  + `  =  ${units.length} units`);
console.log(`  checkpoint: ${checkpointPath}${prior ? ' (resuming)' : ''}`);
const resumed = summarize(units);
if (prior) console.log(`  already done ${resumed.done}, parked ${resumed.parked}, to do ${resumed.pending + resumed.retry}`);
console.log('');

if (values['plan-only']) {
  for (const u of units) console.log(`  ${u.status.padEnd(8)} ${u.kind.padEnd(6)} ${u.key}`);
  console.log(`
${todoCount(units)} unit(s) would run. Nothing was touched.`);
  process.exit(0);
}

let n = 0;
const todo = pendingUnits(units).length;
for (const unit of units) {
  if (!['pending', 'retry'].includes(unit.status)) continue;

  // ⚠ One line per unit, always. Silence for an hour reads as a hang, and
  // that has been said three times now.
  n += 1;
  while (true) {
    const started = Date.now();
    const attempt = unit.attempts + 1;
    const tag = attempt > 1 ? ` (attempt ${attempt})` : '';
    process.stdout.write(`[${String(n).padStart(3)}/${todo}] ${unit.kind.padEnd(6)} ${unit.key}${tag} … `);
    const result = await runLoader(unit);
    const verdict = classifyRun({ kind: unit.kind, ...result });
    unit.attempts += 1;
    unit.status = verdict.status;
    unit.note = verdict.note;
    const secs = ((Date.now() - started) / 1000).toFixed(1);

    if (verdict.status === 'done') { console.log(`done in ${secs}s`); break; }
    if (isRetryable(unit, maxAttempts)) {
      console.log(`${verdict.note} — retrying (${secs}s)`);
      continue;
    }
    // Out of retries, or never retryable in the first place.
    unit.status = 'parked';
    console.log(`PARKED after ${unit.attempts} attempt(s): ${unit.note}`);
    break;
  }
  saveCheckpoint(units);
}

const final = summarize(units);
console.log(`\n${final.done} done · ${final.parked} parked · ${final.total} units total`);

if (final.parked > 0) {
  console.log('\nParked units need a person. Each one, with why:\n');
  for (const u of units) if (u.status === 'parked') console.log(`  ${u.kind} ${u.key}: ${u.note}`);
  console.log('\nFix the cause, then re-run with --retry-parked. A parked unit is never');
  console.log('retried automatically — retrying a fiscal-month contradiction burns the');
  console.log('same wall clock forever and ends with the identical message.');
}

// ⚠⚠ THE CHECKPOINT IS NOT EVIDENCE. Count the rows in the database.
console.log('\nNext, and do not skip it — the checkpoint records what this driver SAW:');
console.log(`  node scripts/verifyAxisStamps.mjs --like "CA State Controller%"`);
console.log(`  node scripts/registerCreatedRows.mjs --milestone ca-sco-fy${fy} \\`);
console.log(`      --match "CA State Controller" --fy ${fy}`);
console.log('  node scripts/syncFrozenInvariantState.mjs');
console.log('  npm run verify:frozen\n');

process.exit(final.parked > 0 ? 1 : 0);
