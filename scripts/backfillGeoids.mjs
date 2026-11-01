#!/usr/bin/env node
/**
 * Backfill treasury.municipalities.geoid from Census PEP bulk files.
 *
 * $0 — free bulk CSVs, no API, no key.
 *
 *   node scripts/backfillGeoids.mjs --out supabase/migrations/20260912000100_backfill_municipality_geoids.sql
 *   node scripts/backfillGeoids.mjs --state MI --dry-run
 *
 * ── WHY THIS EMITS SQL RATHER THAN WRITING ─────────────────────────────────
 *
 * The derivation becomes a reviewable artifact instead of an opaque script
 * run: one `UPDATE ... FROM (VALUES ...)` statement a human can read, diff and
 * re-apply as a no-op. It also needs no service-role key, and this repo's
 * Supabase credentials have not been dependable.
 *
 * ── THE RULES IT ENFORCES (all of them live in scripts/lib/geoid.mjs) ───────
 *
 * Ambiguities and misses are NEVER written. Null is a correct answer; a wrong
 * geoid points a reader at another government's budget while looking
 * authoritative.
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { readPepCsv } from './lib/censusPep.mjs';
import {
  STATE_FIPS, buildCountyIndex, buildPlaceIndex, buildMcdIndex, buildMcdStateIndex, buildPlaceCountyIndex,
  resolveState, resolveCounty, resolvePlace, resolveTownship, resolveMcdByState, preferResolved,
  dropCollidingGeoids,
} from './lib/geoid.mjs';

const CITY_TIER = new Set(['city', 'town', 'village', 'borough', 'municipality']);
const API = process.env.TT_API || 'https://ev-accounts-api.onrender.com/api/treasury/cities?datasets=summary';
const CACHE = 'cache';
// ── ⚠⚠ TWO VINTAGES, AND THE NEWER ONE IS NOT SIMPLY BETTER ────────────────
//
// A vintage cannot name a government that did not exist when it was cut.
// reference_census_vintage_ladder solves that LOOKING BACKWARD — a dissolved
// government is typed from the newest vintage that still names it. BASE/FORWARD
// here is the forward half of the same fact: a government incorporated after
// the cut is named by the NEXT vintage, and by nothing before it. Mountain
// House incorporated 2024-07-01; V2024 carries boundaries as of 2024-01-01 and
// does not list it, so its geoid was correctly NULL. V2025, published
// 2026-05-14, carries it as place 49582 in county 077.
//
// ⚠⚠ SO WHY IS THE BASE NOT JUST MOVED TO V2025? Because it was MEASURED, and
// the newer vintage RESOLVES FEWER ENTITIES: writing the SQL on each and
// diffing gave +1 (Mountain House) and -4 against 10,412. Two of the four are
// not dissolutions at all — the Census RECLASSIFIED Penn Hills and Mt Lebanon
// from township MCDs to places (Penn Hills: MCD 59032 -> place 59040), so a
// straight bump drops a 41,059-person municipality to buy a 25,315-person one.
// Wheatland borough (PA) and Fort Johnson village (NY) also vanish; those two
// look like genuine dissolutions and are NOT yet confirmed.
//
// The forward vintage is therefore consulted ONLY after a clean miss, exactly
// like the New England MCD fallback below. Net effect, measured: +1, zero
// losses, zero CHANGED geoids. A geoid that changes is a defect to investigate,
// never an update to ship quietly.
const SERIES = (v) => `2020-${v}`; // ⚠ the directory segment is the SERIES, not the vintage
const BASE_VINTAGE = 2024;
const FORWARD_VINTAGE = 2025;
const CO_EST = `${CACHE}/co-est${BASE_VINTAGE}-alldata.csv`;
// ⚠ The Census filename uses the UNPADDED state FIPS: sub-est2024_8.csv for
// Colorado, not sub-est2024_08.csv. Number() strips the pad.
const SUB_EST = (fips, v = BASE_VINTAGE) => `${CACHE}/sub-est${v}_${Number(fips)}.csv`;
const SUB_URL = (fips, v = BASE_VINTAGE) =>
  `https://www2.census.gov/programs-surveys/popest/datasets/${SERIES(v)}/cities/totals/sub-est${v}_${Number(fips)}.csv`;
const CO_URL =
  `https://www2.census.gov/programs-surveys/popest/datasets/${SERIES(BASE_VINTAGE)}/counties/totals/co-est${BASE_VINTAGE}-alldata.csv`;

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1]; };
const onlyState = argOf('--state');
const outPath = argOf('--out');
const dryRun = args.includes('--dry-run');

async function ensure(path, url) {
  if (existsSync(path)) return path;
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  process.stderr.write(`fetching ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

// ── Entities ──────────────────────────────────────────────────────────────
const res = await fetch(API);
if (!res.ok) throw new Error(`entity list: ${res.status}`);
const entities = await res.json();

await ensure(CO_EST, CO_URL);
const coRows = readPepCsv(CO_EST);

// Entity types that carry no geoid at all. Filtered out HERE, before the
// state-FIPS lookup, so the federal row (state 'US') is reported as skipped
// rather than as an unknown state — it is neither a defect nor a miss.
const NON_GEOGRAPHIC = new Set([
  'federal', 'nonprofit', 'special_district', 'school_district',
  'conservancy', 'library',
]);

const byState = new Map();
let skippedNonGeographic = 0;
for (const m of entities) {
  if (onlyState && m.state !== onlyState) continue;
  if (NON_GEOGRAPHIC.has(m.entity_type)) { skippedNonGeographic++; continue; }
  if (!byState.has(m.state)) byState.set(m.state, []);
  byState.get(m.state).push(m);
}

const updates = [];
const problems = [];
const totals = { resolved: 0, skipped: 0, missed: 0, ambiguous: 0 };

for (const [abbrev, rows] of [...byState].sort()) {
  const stateFips = STATE_FIPS[abbrev];
  if (!stateFips) {
    problems.push([abbrev, '(state)', `unknown state abbrev ${abbrev}`]);
    continue;
  }

  const countyIdx = buildCountyIndex(coRows, stateFips);
  let placeIdx = new Map(); let mcdIdx = new Map(); let mcdStateIdx = new Map();
  let placeCountyIdx = new Map();
  const needsSub = rows.some((m) => CITY_TIER.has(m.entity_type) || m.entity_type === 'township');
  if (needsSub) {
    const p = await ensure(SUB_EST(stateFips), SUB_URL(stateFips));
    const subRows = readPepCsv(p);
    placeIdx = buildPlaceIndex(subRows);
    placeCountyIdx = buildPlaceCountyIndex(subRows);
    mcdIdx = buildMcdIndex(subRows);
    mcdStateIdx = buildMcdStateIndex(subRows);
  }

  // ⚠ The forward vintage is fetched ONLY if this state has a city-tier entity
  // the base vintage could not name — one extra file for California, none at
  // all for a state that resolves cleanly. Built once per state, not per miss.
  let forwardPlaceIdx = null;
  let forwardPlaceCountyIdx = null;
  const needsForward = needsSub && rows.some((m) => CITY_TIER.has(m.entity_type)
    && !resolvePlace(placeIdx, m.name, {
      placeCountyIndex: placeCountyIdx, countyIndex: countyIdx, entityType: m.entity_type,
    }).geoid);
  if (needsForward) {
    const fp = await ensure(SUB_EST(stateFips, FORWARD_VINTAGE), SUB_URL(stateFips, FORWARD_VINTAGE));
    const fRows = readPepCsv(fp);
    forwardPlaceIdx = buildPlaceIndex(fRows);
    forwardPlaceCountyIdx = buildPlaceCountyIndex(fRows);
  }

  const tally = { resolved: 0, missed: 0, ambiguous: 0, skipped: 0 };
  for (const m of rows) {
    let r;
    if (m.entity_type === 'state') r = resolveState(m.state);
    else if (m.entity_type === 'county') r = resolveCounty(countyIdx, stateFips, m.name);
    else if (m.entity_type === 'township') r = resolveTownship(mcdIdx, countyIdx, stateFips, m.name);
    else if (CITY_TIER.has(m.entity_type)) {
      r = resolvePlace(placeIdx, m.name, {
        placeCountyIndex: placeCountyIdx,
        countyIndex: countyIdx,
        // ⚠ The entity's own type picks which Census designator is tried
        // first. Without it a PA borough matched a same-named PA city.
        entityType: m.entity_type,
      });
      // ⚠ New England fallback. Massachusetts files 351 MCDs and only 58
      // places, so most MA towns have NO place FIPS to find — the tier is a
      // property of the state's Census structure, not of TT's entity_type.
      // Tried ONLY after a clean place miss: an AMBIGUOUS place result must
      // stay null rather than be rescued by a second, looser lookup.
      r = preferResolved(r, () => resolveMcdByState(mcdStateIdx, m.name));
      // ⚠ Forward vintage, same guard. A government incorporated after the
      // base vintage was cut is named by the NEXT one and by nothing earlier:
      // Mountain House (2024-07-01) is absent from V2024 and is place 49582 in
      // V2025. Tried LAST, so it can only ever turn a null into a geoid.
      r = preferResolved(r, forwardPlaceIdx && (() => resolvePlace(forwardPlaceIdx, m.name, {
        placeCountyIndex: forwardPlaceCountyIdx,
        countyIndex: countyIdx,
        entityType: m.entity_type,
      })));
    } else { tally.skipped++; totals.skipped++; continue; }

    if (r.geoid) {
      updates.push([m.id, r.geoid, r.basis]);
      tally.resolved++; totals.resolved++;
    } else {
      problems.push([abbrev, m.name, r.reason]);
      if (r.reason.startsWith('ambiguous')) { tally.ambiguous++; totals.ambiguous++; }
      else { tally.missed++; totals.missed++; }
    }
  }
  const attempted = tally.resolved + tally.missed + tally.ambiguous;
  const pct = attempted > 0 ? ((tally.resolved / attempted) * 100).toFixed(1) : 'n/a';
  console.log(
    `${abbrev.padEnd(3)} resolved ${String(tally.resolved).padStart(5)}  `
    + `missed ${String(tally.missed).padStart(4)}  ambiguous ${String(tally.ambiguous).padStart(4)}  `
    + `skipped ${String(tally.skipped).padStart(3)}  (${pct}%)`
  );
}

// ── ⚠⚠⚠ TWO ENTITIES CANNOT BE ONE GOVERNMENT ─────────────────────────────
// Every resolver above refuses to choose between two candidates for ONE name.
// This is the mirror image and nothing was checking it: two different entities
// resolving to the SAME geoid. Measured 2026-10-31 it was 514 of 10,413 — New
// York villages and the towns that contain them, which share a name, each pair
// handed one government. They reached the database before the post-hoc
// verifier caught them, and removing them is a 514-row repair.
const collisionCheck = dropCollidingGeoids(updates);
if (collisionCheck.collided.length) {
  const byGeoid = new Map();
  for (const [id, geoid] of collisionCheck.collided) {
    if (!byGeoid.has(geoid)) byGeoid.set(geoid, []);
    byGeoid.get(geoid).push(id);
  }
  console.error(`\n⚠⚠ ${collisionCheck.collided.length} resolution(s) across ${byGeoid.size} geoid(s)`
    + ' claim the same government as another entity — ALL of them dropped.');
  for (const [geoid, ids] of [...byGeoid].slice(0, 10)) {
    console.error(`     ${geoid}: ${ids.join(', ')}`);
  }
  totals.resolved -= collisionCheck.collided.length;
  totals.ambiguous += collisionCheck.collided.length;
  updates.length = 0;
  updates.push(...collisionCheck.kept);
}

console.log(`\nTOTAL resolved ${totals.resolved}  missed ${totals.missed}  `
  + `ambiguous ${totals.ambiguous}  skipped ${totals.skipped + skippedNonGeographic}`
  + ` (${skippedNonGeographic} non-geographic)`);

if (problems.length) {
  console.log(`\nunresolved (${problems.length}):`);
  for (const [st, name, why] of problems) console.log(`   ${st}  ${name}  — ${why}`);
}

// ⚠ An ambiguity is a DEFECT, not a rounding error: two real places competed
// and the matcher declined. Say so loudly so nobody ships a silent gap.
if (totals.ambiguous > 0) {
  console.error(`\n⚠ ${totals.ambiguous} ambiguous — review before applying.`);
}

if (dryRun || !outPath) {
  console.log('\n(dry run — no SQL written)');
  process.exit(0);
}

const values = updates
  .map(([id, geoid, basis]) => `  ('${id}'::uuid, '${geoid}', '${basis}')`)
  .join(',\n');

writeFileSync(outPath, `-- Generated by scripts/backfillGeoids.mjs — do not hand-edit.
-- ${updates.length} entities resolved; ${totals.missed} missed, ${totals.ambiguous} ambiguous,
-- ${totals.skipped} skipped as non-geographic. Unresolved rows are left NULL on purpose:
-- null is a correct answer, a wrong geoid is not.
-- Idempotent: re-applying sets the same values.

UPDATE treasury.municipalities AS m
SET geoid = v.geoid, geoid_basis = v.basis
FROM (VALUES
${values}
) AS v(id, geoid, basis)
WHERE m.id = v.id;
`, 'utf8');

console.log(`\nwrote ${updates.length} updates to ${outPath}`);
