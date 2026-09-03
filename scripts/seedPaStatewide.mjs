/**
 * Create every Pennsylvania municipality and county whose DCED filing is
 * approved — 2,619 governments — in `treasury.municipalities`.
 *
 * NO SHEBANG — tests/paStatewide.test.mjs imports `TYPE_MIGRATIONS` from here to
 * prove the State College migration is declared, and a `#!` on any module a test
 * imports breaks `npm test` on Windows. tests/waSao.test.mjs caught this one
 * before it shipped, which is the fourth time that guard has earned its place.
 *
 * Usage:
 *   node scripts/seedPaStatewide.mjs --dry-run
 *   node scripts/seedPaStatewide.mjs
 *
 * Mirrors scripts/seedFlStatewide.mjs. Three things are specific to PA.
 *
 * ── ⚠⚠ 1. STATE COLLEGE IS MIGRATED IN PLACE, NOT RE-CREATED ───────────────
 *
 * `State College` already exists typed **`municipality`** — the legacy
 * Plano-era Texas value — with budget rows attached from Knight session 5. The
 * statewide registry types it `borough`, like Pennsylvania's other 948.
 *
 * Because this seeder (and `treasury_ensure_municipality`) keys on
 * (name, state, entity_type) — ALL THREE — a plain upsert would not find the
 * existing row and would INSERT A SECOND `State College`, orphaning its budget
 * rows behind a name that now appears twice.
 *
 * So the type change is done as an explicit, declared migration: find the row by
 * (name, state) alone, UPDATE its `entity_type`, and assert exactly one
 * `State College` row survives. `entity_type` lives on `municipalities`, not on
 * `budgets`, so no budget row is touched and $0 moves.
 *
 * ── ⚠ 2. `borough` IS A NEW ENTITY TYPE ────────────────────────────────────
 *
 * 949 of these governments are boroughs. The value is added to every
 * `CITY_TIER_TYPES` set in the same PR; without that, coverage matching silently
 * stops finding them — the defect Michigan's #131 found for its 1,240
 * townships, which could never match anything.
 *
 * ── ⚠ 3. PHILADELPHIA HAS NO COUNTY ROW TO POINT AT ────────────────────────
 *
 * Philadelphia is a consolidated city-county: `PHILADELPHIA CITY` (510012) IS
 * the county government, and the DCED county row (510001) is an empty
 * placeholder that never files. Its `county_id` is null with a stated reason,
 * exactly as Jacksonville's is for Duval County.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PA_STATEWIDE_ENTITIES, PA_STATE } from './data/paStatewideEntities.mjs';
import { PA_EXISTING_TT_NAMES } from './data/paNameRules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ⚠ Rows whose `entity_type` must be CHANGED rather than matched.
 * Declared so the migration is visible in review, not a side effect.
 */
export const TYPE_MIGRATIONS = Object.freeze([
  { name: 'State College', from: 'municipality', to: 'borough' },
]);

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}


/**
 * Read every row of a table, paged.
 *
 * ⚠⚠ PostgREST caps an unqualified select at 1,000 ROWS. The first version of
 * this seeder verified its work with a single unpaged select over a state that
 * now holds 2,620 rows, so 1,620 governments it had just inserted correctly came
 * back as "0 rows, expected 1" and the seed reported failure on a clean load.
 *
 * ⚠ The order ends on the PRIMARY KEY, which is what makes `.range()` paging
 * deterministic — see tests/pagedReadOrdering.test.mjs.
 */
async function readAllRows(db, state) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from('municipalities')
      .select('id, name, entity_type, population, county_id')
      .eq('state', state)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`read municipalities: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export async function seed({ dryRun = false } = {}) {
  loadEnv();
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).'); process.exit(1); }
  const db = key
    ? createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key,
      { db: { schema: 'treasury' } })
    : null;

  const counties = PA_STATEWIDE_ENTITIES.filter((e) => e.entityType === 'county');
  const munis = PA_STATEWIDE_ENTITIES.filter((e) => e.entityType !== 'county');
  const byType = new Map();
  for (const e of PA_STATEWIDE_ENTITIES) byType.set(e.entityType, (byType.get(e.entityType) || 0) + 1);

  console.log(`\nSeeding Pennsylvania statewide — ${PA_STATEWIDE_ENTITIES.length} governments`
    + `${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  ${[...byType].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${c} ${t}`).join(', ')}\n`);

  let existing = [];
  if (db) existing = await readAllRows(db, PA_STATE);
  console.log(`  already in the table: ${existing.length} PA row(s) — `
    + `${existing.map((m) => `${m.name} (${m.entity_type})`).join(', ') || 'none'}\n`);

  // ── The declared type migrations, BEFORE anything keys on entity_type.
  for (const mig of TYPE_MIGRATIONS) {
    const hits = existing.filter((m) => m.name === mig.name);
    if (hits.length === 0) {
      console.log(`  migration: ${mig.name} not present — nothing to migrate`);
      continue;
    }
    if (hits.length > 1) {
      throw new Error(`${hits.length} rows named ${JSON.stringify(mig.name)} in ${PA_STATE} — `
        + 'refusing to guess which is canonical. This is the Utah phantom-row shape.');
    }
    const row = hits[0];
    if (row.entity_type === mig.to) { console.log(`  migration: ${mig.name} already ${mig.to}`); continue; }
    if (row.entity_type !== mig.from) {
      throw new Error(`${mig.name} is typed ${JSON.stringify(row.entity_type)}, not the declared `
        + `${JSON.stringify(mig.from)}. The migration's premise is wrong — re-check before editing.`);
    }
    console.log(`  migration: ${mig.name} ${mig.from} -> ${mig.to}`
      + `${dryRun ? '  [dry-run]' : ''}`);
    if (!dryRun) {
      const { error } = await db.from('municipalities').update({ entity_type: mig.to }).eq('id', row.id);
      if (error) throw new Error(`migrate ${mig.name}: ${error.message}`);
    }
    // ⚠ Applied to the in-memory row EVEN ON A DRY RUN. Otherwise the dry run
    // still keys State College as `municipality`, fails to match the registry's
    // `borough`, and reports an INSERT where the real run does an UPDATE. A
    // preview that predicts a different action than the run is worse than none.
    row.entity_type = mig.to;
  }

  const byKey = new Map();
  for (const m of existing) {
    const k = `${m.name}|${m.entity_type}`;
    if (byKey.has(k)) throw new Error(`more than one row for (${k}, ${PA_STATE})`);
    byKey.set(k, m);
  }

  const idByName = new Map();
  let inserted = 0; let updated = 0; let unchanged = 0;

  async function upsert(ent, countyId) {
    const row = {
      name: ent.name,
      state: PA_STATE,
      entity_type: ent.entityType,
      population: ent.population,
      county_id: countyId,
    };
    const prior = byKey.get(`${ent.name}|${ent.entityType}`);
    if (prior) {
      if (prior.population === ent.population && (prior.county_id || null) === (countyId || null)) {
        unchanged++; return prior.id;
      }
      if (!dryRun) {
        const { error } = await db.from('municipalities').update(row).eq('id', prior.id);
        if (error) throw new Error(`update ${ent.name}: ${error.message}`);
      }
      updated++; return prior.id;
    }
    if (dryRun) { inserted++; return `dry-${ent.dcedId}`; }
    const { data, error } = await db.from('municipalities').insert(row).select('id').single();
    if (error) throw new Error(`insert ${ent.name}: ${error.message}`);
    inserted++; return data.id;
  }

  // ⚠ Counties FIRST — a municipality's county_id cannot point at a row that does not exist yet.
  for (const ent of counties) idByName.set(ent.name, await upsert(ent, null));
  console.log(`  counties done: ${counties.length}`);

  let done = 0;
  for (const ent of munis) {
    let countyId = null;
    if (ent.countyDbName) {
      countyId = idByName.get(ent.countyDbName) || null;
      if (!countyId) {
        throw new Error(`${ent.name} names parent county ${JSON.stringify(ent.countyDbName)}, which is `
          + 'not among the filing counties. A municipality may not point at a county row that does not exist.');
      }
    }
    idByName.set(ent.name, await upsert(ent, countyId));
    if (++done % 500 === 0) console.log(`  municipalities: ${done}/${munis.length}`);
  }

  console.log(`  inserted ${inserted}, updated ${updated}, unchanged ${unchanged}`);
  if (dryRun) { console.log('\n  [dry-run] nothing written.'); return; }

  // ── Post-seed assertions.
  const all = await readAllRows(db, PA_STATE);

  const problems = [];
  for (const ent of PA_STATEWIDE_ENTITIES) {
    const hits = all.filter((m) => m.name === ent.name && m.entity_type === ent.entityType);
    if (hits.length !== 1) { problems.push(`${ent.name} (${ent.entityType}): ${hits.length} rows, expected 1`); continue; }
    const m = hits[0];
    if (m.population !== ent.population) {
      problems.push(`${ent.name}: population ${m.population} != DCED ${ent.population}`);
    }
    const wantCounty = ent.countyDbName ? idByName.get(ent.countyDbName) : null;
    if ((m.county_id || null) !== (wantCounty || null)) {
      problems.push(`${ent.name}: county_id ${m.county_id} != ${wantCounty}`);
    }
  }

  // ⚠ The three pre-existing rows must not have been duplicated by the sweep.
  for (const n of PA_EXISTING_TT_NAMES) {
    const hits = all.filter((m) => m.name === n);
    if (hits.length !== 1) {
      problems.push(`⚠⚠ ${JSON.stringify(n)} existed before this seed and now has ${hits.length} rows`);
    }
  }
  // ⚠ And the migration must have actually happened.
  for (const mig of TYPE_MIGRATIONS) {
    const hits = all.filter((m) => m.name === mig.name);
    if (hits.length === 1 && hits[0].entity_type !== mig.to) {
      problems.push(`${mig.name} is still typed ${hits[0].entity_type}, not ${mig.to}`);
    }
  }

  const dupNames = new Map();
  for (const m of all) dupNames.set(m.name, (dupNames.get(m.name) || 0) + 1);
  for (const [n, c] of dupNames) if (c > 1) problems.push(`${JSON.stringify(n)} has ${c} rows in PA`);

  const states = all.filter((m) => m.entity_type === 'state');
  if (states.length !== 1 || states[0].name !== 'Pennsylvania') {
    problems.push(`expected exactly one PA state node, found ${states.length}`);
  }
  if (all.some((m) => m.name === 'Philadelphia County')) {
    problems.push('a "Philadelphia County" row exists — Philadelphia is a consolidated city-county '
      + 'and the DCED county row never files. That row names a government that does not exist.');
  }

  const nowByType = new Map();
  for (const m of all) nowByType.set(m.entity_type, (nowByType.get(m.entity_type) || 0) + 1);
  console.log(`\n  PA rows now: ${all.length} — `
    + `${[...nowByType].sort((a, b) => b[1] - a[1]).map(([t, c]) => `${c} ${t}`).join(', ')}`);

  if (problems.length) {
    console.error(`\nSEED VERIFICATION FAILED — ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('\n  ✅ All seed assertions passed.');
}

if (process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1]
  || process.argv[1].endsWith('seedPaStatewide.mjs'))) {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean' } } });
  seed({ dryRun: values['dry-run'] || false })
    .catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
