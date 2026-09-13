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
  STATE_FIPS, buildCountyIndex, buildPlaceIndex, buildMcdIndex,
  resolveState, resolveCounty, resolvePlace, resolveTownship,
} from './lib/geoid.mjs';

const CITY_TIER = new Set(['city', 'town', 'village', 'borough', 'municipality']);
const API = process.env.TT_API || 'https://ev-accounts-api.onrender.com/api/treasury/cities?datasets=summary';
const CACHE = 'cache';
const CO_EST = `${CACHE}/co-est2024-alldata.csv`;
// ⚠ The Census filename uses the UNPADDED state FIPS: sub-est2024_8.csv for
// Colorado, not sub-est2024_08.csv. Number() strips the pad.
const SUB_EST = (fips) => `${CACHE}/sub-est2024_${Number(fips)}.csv`;
const SUB_URL = (fips) =>
  `https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_${Number(fips)}.csv`;
const CO_URL =
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv';

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

const byState = new Map();
for (const m of entities) {
  if (onlyState && m.state !== onlyState) continue;
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
  let placeIdx = new Map(); let mcdIdx = new Map();
  const needsSub = rows.some((m) => CITY_TIER.has(m.entity_type) || m.entity_type === 'township');
  if (needsSub) {
    const p = await ensure(SUB_EST(stateFips), SUB_URL(stateFips));
    const subRows = readPepCsv(p);
    placeIdx = buildPlaceIndex(subRows);
    mcdIdx = buildMcdIndex(subRows);
  }

  const tally = { resolved: 0, missed: 0, ambiguous: 0, skipped: 0 };
  for (const m of rows) {
    let r;
    if (m.entity_type === 'state') r = resolveState(m.state);
    else if (m.entity_type === 'county') r = resolveCounty(countyIdx, stateFips, m.name);
    else if (m.entity_type === 'township') r = resolveTownship(mcdIdx, countyIdx, stateFips, m.name);
    else if (CITY_TIER.has(m.entity_type)) r = resolvePlace(placeIdx, m.name);
    else { tally.skipped++; totals.skipped++; continue; }

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

console.log(`\nTOTAL resolved ${totals.resolved}  missed ${totals.missed}  `
  + `ambiguous ${totals.ambiguous}  skipped ${totals.skipped}`);

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
