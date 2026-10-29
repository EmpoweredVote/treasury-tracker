/**
 * NO SHEBANG — a test imports this module for its pure helpers, and the repo
 * forbids a shebang on anything a test imports (tests/waSao.test.mjs). It is
 * still run directly: `node scripts/<name>` needs no shebang on Windows.
 *
 * Creates Hawaii's four county governments in treasury.municipalities.
 *
 * Idempotent: re-running updates the existing rows rather than duplicating.
 * Hawaii previously held ONLY its state node (42 rows, FY2005-2025), so all
 * four of these are new and nothing here risks disturbing an existing row.
 *
 * ── ⭐ HAWAII'S WHOLE LOCAL LAYER IS THESE FOUR ───────────────────────────
 *
 * There are no incorporated municipalities in Hawaii at all — the state's only
 * SUMLEV 162 census row is `Urban Honolulu CDP`, a DESIGNATED (unincorporated)
 * place. Evidence and the full SUMLEV census: `scripts/lib/hiCountySources.mjs`.
 *
 * ⚠⚠ KALAWAO COUNTY IS DELIBERATELY ABSENT. Hawaii has FIVE county-equivalents
 * at SUMLEV 050; Kalawao (pop 81, the Kalaupapa settlement) is administered by
 * the STATE Department of Health, has no county government and files nothing.
 * Seeding it would MINT A GOVERNMENT THAT DOES NOT EXIST — the same error as
 * seeding one of Alaska's 11 census areas.
 *
 * ── ⚠⚠⚠ THREE `county`, ONE `city`, AND THE DIFFERENCE IS PRECEDENT ───────
 *
 * The City and County of Honolulu is a CONSOLIDATED city-county. Alaska's
 * census test — no SUMLEV 162 row ⇒ `county` — is an ALASKA rule encoding
 * Alaska's own split between a unified municipality and a borough, and
 * applying it here would type Honolulu `county`.
 *
 * TT's own precedent governs instead, re-verified live on 2026-10-29:
 *
 *     CA city San Francisco        county_id null   geoid 0667000
 *     PA city Philadelphia         county_id null   geoid 4260000
 *     TN city Nashville-Davidson   county_id null
 *
 * ⚠ `entity_type` is identity-load-bearing (`treasury_ensure_municipality`
 * keys on it), so a wrong value MINTS A SECOND GOVERNMENT rather than
 * mislabelling this one. The post-seed assertion below is what catches that.
 *
 * ⚠⚠ READ NOTE 1 BEFORE SEEDING — THE YAKUTAT LESSON. The Alaska pass nearly
 * typed the City and Borough of Yakutat `city` off its name, and was saved by
 * reading the issuer's own reporting-entity note. The name is not the
 * evidence. Confirmations recorded in the ledger for this load.
 *
 * `county_id` is null for all four: the three counties ARE county-equivalents
 * and Honolulu is its own, so none of them has a parent county.
 *
 * ── ⚠ HONOLULU CANNOT TAKE SAN FRANCISCO'S GEOID BASIS ────────────────────
 *
 * SF and Philadelphia carry `census-pep-162-exact` — a PLACE-level geoid. The
 * census prints no 162 row for Honolulu County; its only census geography IS
 * the county. So Honolulu's geoid is the county FIPS under a basis that says
 * so, rather than a place geoid that does not exist.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HI_COUNTIES, countyByKey } from './lib/hiCountySources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * US Census Bureau Population Estimates Program, Vintage 2024 — the same
 * program and vintage every other seeded entity uses.
 *   co-est2024-alldata.csv, SUMLEV=050, STNAME=Hawaii, POPESTIMATE2024.
 *
 * These feed the loader's per-capita plausibility guard — the ONLY check that
 * can catch a wrong `units` multiplier, since the tie gate is blind to it.
 * ⚠⚠ That matters more here than in Alaska: Honolulu's statement is printed
 * in THOUSANDS, so a missing units=1000 is a 1000x error that ties perfectly.
 */
const POPULATION_YEAR = 2024;

/**
 * ⚠⚠ ALL FOUR, HONOLULU INCLUDED, CARRY THE SUMLEV 050 BASIS.
 *
 * San Francisco and Philadelphia carry `census-pep-162-exact` — a PLACE-level
 * geoid. The census prints NO 162 row for Honolulu County; its only census
 * geography IS the county, so there is no place geoid to be exact against and
 * claiming one would be a fiction.
 *
 * A first draft invented `census-pep-050-consolidated` for it. The database
 * refused that (`municipalities_geoid_shape` is a CLOSED REGISTRY of bases,
 * each with a required digit length), and the refusal was right:
 * `census-pep-050-exact` is the more honest label anyway. It states where the
 * geoid came from and that it is exact, both of which are true. Honolulu's
 * consolidated-ness is already carried by `entity_type = 'city'` with
 * `county_id` NULL, which is where TT records it for San Francisco too.
 */
const COUNTY_BASIS = 'census-pep-050-exact';

/**
 * The municipalities row for one county key. Pure — no database — so the
 * typing decisions above are testable without a connection.
 */
export function seedPayloadFor(key) {
  const ent = countyByKey(key);
  if (!ent) {
    throw new Error(
      `'${key}' is not one of Hawaii's four county governments. `
      + 'Kalawao has no government and the Department of Water is a component unit; '
      + 'neither may be seeded.',
    );
  }
  return {
    name: ent.name,
    state: 'HI',
    entity_type: ent.entityType,
    county_id: null,
    population: ent.population,
    population_year: POPULATION_YEAR,
    geoid: ent.geoid,
    geoid_basis: COUNTY_BASIS,
  };
}

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* absent is fine */ }
  }
}

async function main() {
  loadEnv();
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  for (const ent of HI_COUNTIES) {
    const row = seedPayloadFor(ent.key);
    const { data: existing } = await db.from('municipalities')
      .select('id').eq('name', row.name).eq('state', 'HI').eq('entity_type', row.entity_type)
      .maybeSingle();
    const q = existing
      ? db.from('municipalities').update(row).eq('id', existing.id).select().single()
      : db.from('municipalities').insert(row).select().single();
    const { data, error } = await q;
    if (error) throw new Error(`${row.name}: ${error.message}`);
    console.log(`  ${existing ? 'Updated' : 'Created'} ${row.name} (${row.entity_type}) `
      + `${data.id} pop ${row.population.toLocaleString()} geoid ${row.geoid}`);
  }

  // ── Phantom-row guard ──────────────────────────────────────────────────────
  // Exactly one row per county, with the intended type. A duplicate here means
  // a prior run used a different entity_type and split the history.
  const names = HI_COUNTIES.map((c) => c.name);
  const { data: rows, error } = await db.from('municipalities')
    .select('id, name, entity_type, county_id, geoid').eq('state', 'HI').in('name', names);
  if (error) { console.error(error.message); process.exit(1); }
  if (rows.length !== HI_COUNTIES.length) {
    console.error(`Expected ${HI_COUNTIES.length} rows, found ${rows.length}:`, rows);
    process.exit(1);
  }
  for (const ent of HI_COUNTIES) {
    const got = rows.find((r) => r.name === ent.name);
    if (!got || got.entity_type !== ent.entityType || got.county_id !== null) {
      console.error(`${ent.name} is not a county-less ${ent.entityType}:`, got);
      process.exit(1);
    }
  }

  // ⚠⚠ Nothing here may disturb the HI STATE node, whose name differs from
  // `Hawaii County` by a single word.
  const { data: all } = await db.from('municipalities')
    .select('name, entity_type').eq('state', 'HI').order('name');
  console.log(`\n  Hawaii now holds ${all.length} entities:`);
  for (const r of all) console.log(`    ${r.name} / ${r.entity_type}`);
  const stateNode = all.filter((r) => r.entity_type === 'state');
  if (stateNode.length !== 1 || stateNode[0].name !== 'Hawaii') {
    console.error('The HI state node is not intact:', stateNode);
    process.exit(1);
  }
}

// ⚠ Only run when invoked directly, so the test can import `seedPayloadFor`.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
