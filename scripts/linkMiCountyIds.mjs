/**
 * Link every Michigan city, village and township to its COUNTY.
 *
 * NO SHEBANG — tests import from this module.
 *
 * Usage:
 *   node scripts/linkMiCountyIds.mjs --dry-run
 *   node scripts/linkMiCountyIds.mjs --commit
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 *
 * `municipalities.county_id` drives the county breadcrumb and the county page's
 * own list of local governments. It is a live, populated feature elsewhere —
 * Minnesota has 852 of 858 cities linked, California 481 of 482, Ohio 253 of 253
 * — and Michigan had exactly ONE row set: Detroit, linked by hand in session 7a.
 *
 * ⚠⚠ ALL THREE TYPES OR NONE. Linking townships alone would make the county page
 * WORSE than leaving it empty: Allegan County would list its two dozen townships
 * while omitting its cities and villages, which is a page that looks complete and
 * is not. The unit of work is every sub-state entity in the state.
 *
 * ── ⚠⚠ THE COUNTY COMES FROM THE MUNICODE, WHICH IS THE PUBLISHER'S OWN ────
 *
 * `CCTTTT`'s `CC` is an alphabetical county index 01-83; Michigan's county FIPS
 * are the odd numbers 001-165, so `fips = 2 * CC - 1`. Verified on all 83
 * counties when the township sweep was built.
 *
 * ⚠⚠ 28 MICHIGAN PLACES STRADDLE A COUNTY LINE and `county_id` can hold only one.
 * Lansing lies in three counties, Fenton in three, and Traverse City, Holland,
 * Midland and Niles in two. Measured from Census SUMLEV 157 (place-part-within-
 * county); `PRIMGEO_FLAG` is 0 on all 645 of those rows, so it names no primary.
 *
 * The municode's county is used, and it is the right authority rather than the
 * convenient one: compared against the MAJORITY-POPULATION county of each
 * straddling place, it agrees in **25 of 27**. The two it does not are near-even
 * splits where the municode records the government's county of RECORD rather
 * than where more of its residents happen to live:
 *
 *   Mackinaw City  municode Cheboygan (278)  vs majority Emmet (562)
 *   Northville     municode Wayne (2,726)    vs majority Oakland (3,321)
 *
 * ⚠ TOWNSHIPS CANNOT STRADDLE. A township is a subdivision of exactly one county
 * by definition, so all 1,240 of them are unambiguous; the caveat above applies
 * only to cities and villages.
 *
 * ⚠ This writes `county_id` and NOTHING ELSE. No budget row is touched, so
 * `verify:frozen` must stay byte-identical either side — and it is checked.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import { MI_STATEWIDE_ENTITIES } from './data/miStatewideEntities.mjs';
import { countyFipsFromMunicode } from './buildMiStatewideEntities.mjs';

const STATE = 'MI';

/** The sub-state types this links. Counties are the target, never the source. */
export const LINKABLE = Object.freeze(['city', 'village', 'township']);

/**
 * Build `county FIPS -> county entity name` from the roster itself.
 *
 * ⚠ From the ROSTER rather than the Census file, so the name is exactly the one
 * TT stores. A county municode is `CC0000`.
 */
export function countyNameByFips(entities = MI_STATEWIDE_ENTITIES) {
  const out = new Map();
  for (const e of entities) {
    if (e.entityType !== 'county') continue;
    const fips = countyFipsFromMunicode(e.municode);
    if (!fips) throw new Error(`county ${e.municode} (${e.name}) has no derivable FIPS`);
    if (out.has(fips)) throw new Error(`two counties share FIPS ${fips}: ${out.get(fips)} and ${e.name}`);
    out.set(fips, e.name);
  }
  return out;
}

/**
 * Resolve each linkable entity to its county NAME.
 * @returns {{links: {name: string, county: string, municode: string}[], unresolved: object[]}}
 */
export function planLinks(entities = MI_STATEWIDE_ENTITIES) {
  const byFips = countyNameByFips(entities);
  const links = [];
  const unresolved = [];
  for (const e of entities) {
    if (!LINKABLE.includes(e.entityType)) continue;
    const fips = countyFipsFromMunicode(e.municode);
    const county = fips ? byFips.get(fips) : null;
    // ⚠ A unit whose county cannot be named is REPORTED, never linked to a
    // guess. Every Michigan county files an F-65, so this should be empty —
    // and if it ever is not, the roster changed underneath this.
    if (!county) { unresolved.push({ municode: e.municode, name: e.name, fips }); continue; }
    links.push({ name: e.name, entityType: e.entityType, county, municode: e.municode });
  }
  return { links, unresolved };
}

async function main() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, commit: { type: 'boolean', default: false } },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    return 1;
  }

  const { links, unresolved } = planLinks();
  const byType = new Map();
  for (const l of links) byType.set(l.entityType, (byType.get(l.entityType) ?? 0) + 1);
  console.log(`linkable entities : ${links.length}`);
  for (const t of LINKABLE) console.log(`  ${t.padEnd(10)}: ${byType.get(t) ?? 0}`);
  console.log(`counties referenced: ${new Set(links.map((l) => l.county)).size}`);
  console.log(`UNRESOLVED (not linked): ${unresolved.length}`);
  for (const u of unresolved.slice(0, 20)) console.log(`  ⚠ ${u.municode} ${u.name} (fips ${u.fips})`);

  if (unresolved.length) {
    console.error('\nREFUSING: every Michigan county files an F-65, so an unresolved unit means the '
      + 'roster changed. Investigate before linking.');
    return 1;
  }
  if (links.length === 0) {
    console.error('REFUSING: nothing to link.');
    return 1;
  }
  if (values['dry-run']) { console.log('\n--dry-run: no writes performed.'); return 0; }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); return 1; }
  const db = createClient(url, key, { db: { schema: 'treasury' } });

  // ── Resolve every county to its row id ONCE ───────────────────────────────
  const { data: counties, error: cErr } = await db.from('municipalities')
    .select('id, name').eq('state', STATE).eq('entity_type', 'county');
  if (cErr) throw new Error(`read counties: ${cErr.message}`);
  const countyId = new Map(counties.map((c) => [c.name, c.id]));
  const missing = [...new Set(links.map((l) => l.county))].filter((n) => !countyId.has(n));
  if (missing.length) {
    console.error(`REFUSING: ${missing.length} county row(s) not in the database: ${missing.slice(0, 5).join(', ')}`);
    return 1;
  }

  // ── Resolve every linkable entity to its row id ───────────────────────────
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('municipalities')
      .select('id, name, entity_type, county_id').eq('state', STATE)
      .in('entity_type', LINKABLE)
      // ⚠ Order by the PK last — a paged read without a total order can repeat
      // or skip rows (reference_paged_reads_need_total_order).
      .order('name').order('id').range(from, from + 999);
    if (error) throw new Error(`read municipalities: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const rowByKey = new Map(rows.map((r) => [`${r.entity_type}|${r.name}`, r]));

  let written = 0; let already = 0; let absent = 0;
  for (const l of links) {
    const row = rowByKey.get(`${l.entityType}|${l.name}`);
    if (!row) { absent += 1; continue; }
    const target = countyId.get(l.county);
    if (row.county_id === target) { already += 1; continue; }
    const { error } = await db.from('municipalities').update({ county_id: target }).eq('id', row.id);
    if (error) throw new Error(`update ${l.name}: ${error.message}`);
    written += 1;
    if (written % 250 === 0) console.log(`  ... ${written} linked`);
  }
  console.log(`\nlinked ${written}; already correct ${already}; not in the database ${absent}`);
  // ⚠ An entity in the roster with no row is not benign — it means the load and
  // the roster disagree — but it is not this script's job to fix, so it is loud.
  if (absent) console.log('⚠ Those roster entities have no municipality row. Investigate.');
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
}
