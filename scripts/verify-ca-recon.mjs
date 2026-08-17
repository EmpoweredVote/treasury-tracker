/**
 * CA-CITIES-01 harness 4 of 4 — reconciliation completeness.
 *
 * The other three harnesses (re-derivation, source-chain audit, and the vitest
 * suite) all verify the rows that ARE in the database. None of them can see a
 * city-year that was never examined, because an unexamined year is
 * indistinguishable from one that passed. This harness asserts the two things
 * they structurally cannot:
 *
 *   1. NOTHING IS MISSING — every (city, fy, dataset) that has both an SCO row
 *      and an ACFR extraction appears in the recon record, ties included.
 *   2. NOTHING BYPASSED THE GATE — every loaded ACFR row has a recon entry that
 *      actually cleared it.
 *
 * ⚠ NO SHEBANG, even though this is a CLI. `tests/caRecon.test.mjs` imports
 * `auditReconCompleteness` from here, and a `#!` on any module a test imports
 * silently removes that file's tests on Windows — the bug that erased 14 tests
 * across v2.22 and v2.23 (fixed in 40aa706, guarded in tests/waSao.test.mjs).
 * Run it as `node scripts/verify-ca-recon.mjs`.
 *
 * Usage:
 *   node scripts/verify-ca-recon.mjs
 *   node scripts/verify-ca-recon.mjs --fixture tests/fixtures/ca-recon-mutation
 *
 * Spec: docs/superpowers/specs/2026-08-16-ca-cities-01-design.md §6 check 4
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const key = (o) => `${o.city}|${o.fy}|${o.dataset}`;
const bare = (o) => ({ city: o.city, fy: o.fy, dataset: o.dataset });

/**
 * @param {{city:string, fy:number, dataset:string}[]} overlaps  City-years having BOTH an SCO row and an ACFR extraction
 * @param {{city:string, fy:number, dataset:string, bucket:string, loadable:boolean, depthFlag?:boolean}[]} recon
 * @param {{city:string, fy:number, dataset:string}[]} loaded    City-years whose production row cites an ACFR
 * @returns {{ok:boolean, missing:object[], wronglyLoaded:object[], counts:object}}
 */
export function auditReconCompleteness(overlaps, recon, loaded) {
  const byKey = new Map(recon.map((r) => [key(r), r]));

  // (1) An overlap with no recon entry was never examined.
  const missing = overlaps.filter((o) => !byKey.has(key(o))).map(bare);

  // (2) A loaded row whose entry is absent, or present but not cleared, got in
  //     around the gate. Absent is the worse of the two and is caught here as
  //     well as in `missing`, because a row can be loaded for a city-year that
  //     never appeared in the overlap set at all.
  const wronglyLoaded = loaded
    .filter((l) => byKey.get(key(l))?.loadable !== true)
    .map(bare);

  const counts = { TIE: 0, EXPLAINED: 0, UNEXPLAINED: 0, depthFlagged: 0 };
  for (const r of recon) {
    if (r.bucket in counts) counts[r.bucket] += 1;
    if (r.depthFlag) counts.depthFlagged += 1;
  }

  return { ok: missing.length === 0 && wronglyLoaded.length === 0, missing, wronglyLoaded, counts };
}

/** Read {overlaps, recon, loaded} from a fixture directory. */
function readFixture(dir) {
  const load = (name) => {
    const p = path.join(dir, `${name}.json`);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : [];
  };
  return { overlaps: load('overlaps'), recon: load('recon'), loaded: load('loaded') };
}

/**
 * Build the three inputs from production. Deferred to Task 6, when real
 * extractions exist — until then there is nothing to compare and the fixture
 * path is the only meaningful mode.
 */
async function readProduction() {
  throw new Error(
    'Production mode lands in Task 6, once extractions exist. Use --fixture <dir> until then.'
  );
}

async function main() {
  const argv = process.argv.slice(2);
  const fixtureIdx = argv.indexOf('--fixture');
  const { overlaps, recon, loaded } =
    fixtureIdx >= 0 ? readFixture(argv[fixtureIdx + 1]) : await readProduction();

  const r = auditReconCompleteness(overlaps, recon, loaded);

  console.log(`overlaps: ${overlaps.length}  recon: ${recon.length}  loaded: ${loaded.length}`);
  console.log(
    `buckets: TIE ${r.counts.TIE} · EXPLAINED ${r.counts.EXPLAINED} · ` +
      `UNEXPLAINED ${r.counts.UNEXPLAINED} · depth-flagged ${r.counts.depthFlagged}`
  );

  if (r.missing.length) {
    console.error(`\n✗ ${r.missing.length} overlapping city-year(s) NEVER RECONCILED:`);
    for (const m of r.missing) console.error(`    ${m.city} FY${m.fy} ${m.dataset}`);
  }
  if (r.wronglyLoaded.length) {
    console.error(`\n✗ ${r.wronglyLoaded.length} loaded row(s) DID NOT CLEAR THE GATE:`);
    for (const w of r.wronglyLoaded) console.error(`    ${w.city} FY${w.fy} ${w.dataset}`);
  }

  if (!r.ok) {
    console.error('\nRECON INCOMPLETE');
    process.exit(1);
  }
  console.log('\n✓ recon complete: nothing missing, nothing loaded around the gate');
}

// Only run the CLI when executed directly, never when imported by a test.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  main();
}
