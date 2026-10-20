#!/usr/bin/env node
/**
 * Seed New York's towns, villages or counties.
 *
 *   npm run ny:seed-municipal -- --class County [--dry-run]
 *
 * Spec: docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md §8
 *
 * ⚠ Population is NOT in this source and is seeded 0.
 * `treasury_ensure_municipality` only applies p_population on INSERT, so a
 * re-run cannot clobber a population backfilled later.
 *
 * ⚠⚠ ONE CLASS PER RUN, BY NAME. The three classes are loaded in separate PRs
 * (counties, then villages, then towns) precisely so the chain is proven on 57
 * governments before it is run on 933. A seeder that did all three at once
 * would make that order unenforceable.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import { ensureMunicipality } from './lib/ensureMunicipality.mjs';
import { archiveFor, assertMunicipalRoster, MUNICIPAL_CLASSES } from './lib/nyOsc.mjs';
import { NY_MUNICIPAL_ENTITIES } from './data/nyOscMunicipalEntities.mjs';

const { values } = parseArgs({
  options: {
    class: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

const memberClass = values.class;
if (!MUNICIPAL_CLASSES.includes(memberClass)) {
  throw new Error(`--class must be one of ${MUNICIPAL_CLASSES.join(', ')}, got `
    + `${JSON.stringify(memberClass)}`);
}
const archive = archiveFor(memberClass);
const DRY = values['dry-run'];

const roster = NY_MUNICIPAL_ENTITIES.filter((e) => e.memberClass === memberClass);

// ⚠⚠ PRE-FLIGHT, BEFORE THE FIRST WRITE. The cities' seeder learned this the
// hard way: a guard inside the write loop lets a bad roster entry at position
// 40 create 39 municipalities before it refuses. assertMunicipalRoster proves
// the entity types agree, the codes are unique, and — the one that matters —
// that no two governments would be stored under the same display name.
if (roster.length === 0) {
  throw new Error(`REFUSING: the roster holds no ${memberClass} rows`);
}
assertMunicipalRoster(roster, memberClass);

// ⚠ An expectation that is re-derived from the thing it checks is a tautology.
// This one is pinned in tests/nyOscMunicipal.test.mjs against the archives.
const EXPECTED = { Town: 933, Village: 561, County: 57 };
if (roster.length !== EXPECTED[memberClass]) {
  throw new Error(`REFUSING: roster has ${roster.length} ${memberClass} rows, `
    + `expected ${EXPECTED[memberClass]}`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

if (DRY) {
  console.log(`[dry-run] roster is clean; would ensure ${roster.length} `
    + `${archive.entityType}s under source ${archive.sourceKey}`);
  process.exit(0);
}

let n = 0;
for (const e of roster) {
  await ensureMunicipality(db, {
    name: e.name,
    state: 'NY',
    entityType: archive.entityType,
    population: 0,
    source: archive.sourceKey,
    sourceEntityKey: e.municipalCode,
  });
  n++;
  if (n % 100 === 0) console.log(`  ${n}/${roster.length}`);
}

// ⚠ Count what the DATABASE holds, not what the loop iterated — a loop counter
// is a tautology over the roster length and verifies nothing. The publisher's
// key is NOT a column on `municipalities`; it lives in
// treasury.municipality_source_keys.
const { count, error } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id', { count: 'exact', head: true })
  .eq('source', archive.sourceKey);
if (error) throw new Error(`verification query failed: ${error.message}`);
if (count === null) throw new Error('verification query returned no count');

console.log(`database now holds ${count} source keys for ${archive.sourceKey}`);
if (count !== roster.length) {
  console.error(`REFUSING: expected ${roster.length}, found ${count}`);
  process.exit(1);
}
