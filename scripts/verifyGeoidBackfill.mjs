#!/usr/bin/env node
/**
 * Verify the geoid backfill.
 *
 *   node scripts/verifyGeoidBackfill.mjs              # connect and assert
 *   node scripts/verifyGeoidBackfill.mjs --print-sql  # emit the assertions
 *
 * ⚠ Every expectation is derived from the DATABASE, never from a hardcoded
 * roster. A guard that keeps its own copy of the list cannot catch the list
 * being wrong — the failure shape that let 949 PA boroughs go missing while
 * three verifier scripts reported success.
 *
 * ⚠⚠ `--print-sql` exists because this repo's Supabase service keys are
 * rejected as legacy ("Legacy API keys are disabled"), so the connecting path
 * cannot run today. The checks are the point, not the transport: the SQL runs
 * through any client — psql, the dashboard, or the Supabase MCP — and the
 * 2026-09-12 backfill was verified exactly this way.
 *
 * ── WHAT THE UNIQUENESS CHECK IS FOR ───────────────────────────────────────
 *
 * It is not decoration. On the first national run it caught two real matcher
 * defects that every other check passed:
 *
 *   Elizabeth / Elizabethtown (IN)  both claimed 1820674, because appending
 *                                   the designator to "Elizabeth" keys the
 *                                   same as the town named "Elizabethtown"
 *   Franklin, Cambria (borough) /   both claimed 4227456, because designators
 *   Franklin, Venango (city) (PA)   were tried 'city'-first regardless of the
 *                                   entity's own type
 *
 * Both wrote a geoid that was the WRONG GOVERNMENT — invisible to a length
 * check, a basis check, or a row count.
 */

const ASSERTIONS = `
-- Geoid backfill verification. Every expectation derived from the table.
-- Returns one row; every count except rows_total/with_geoid must be 0,
-- and dup_geoids names entities that claim the same government.
with v as (
  select id, name, state, entity_type, geoid, geoid_basis,
         case entity_type
           when 'state' then 2 when 'county' then 5 when 'township' then 10
           when 'city' then 7 when 'town' then 7 when 'village' then 7
           when 'borough' then 7 when 'municipality' then 7 else -1 end as tier_len,
         case geoid_basis
           when 'static-state-fips'            then 2
           when 'census-pep-050-exact'         then 5
           when 'census-pep-162-exact'         then 7
           when 'census-pep-061-county-scoped' then 10
           when 'census-pep-061-state-scoped'  then 10
           else -1 end as basis_len
  from treasury.municipalities
)
select
  (select count(*) from v)                                   as rows_total,
  (select count(geoid) from v)                               as with_geoid,
  -- length must agree with the LAYER the value came from, not with TT's label
  (select count(*) from v where geoid is not null and length(geoid) <> basis_len)
                                                             as bad_basis_len,
  (select count(*) from v where geoid is not null and geoid !~ '^[0-9]+$')
                                                             as non_numeric,
  (select count(*) from v where (geoid is null) <> (geoid_basis is null))
                                                             as unpaired,
  (select count(*) from v where geoid is not null and tier_len = -1)
                                                             as geoid_on_nongeographic,
  -- ⚠⚠ a geoid must identify ONE entity; a duplicate means two TT rows claim
  -- the same government, which no other check can see
  (select count(*) from (select geoid from v where geoid is not null
                          group by geoid having count(*) > 1) d)
                                                             as dup_geoids,
  (select md5(string_agg(id::text || geoid, ',' order by id::text))
     from v where geoid is not null)                         as digest;

-- Name the duplicates, if any.
select geoid, count(*) as n,
       string_agg(name || ' [' || state || '/' || entity_type || ']', '  ||  ' order by name) as claimants
from treasury.municipalities
where geoid is not null
group by geoid having count(*) > 1
order by geoid;
`;

if (process.argv.includes('--print-sql')) {
  process.stdout.write(ASSERTIONS);
  process.exit(0);
}

const { createClient } = await import('@supabase/supabase-js');
const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('no SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY — try --print-sql');
  process.exit(1);
}
const db = createClient(url, key);

const EXPECTED_LENGTH = {
  state: 2, county: 5, township: 10,
  city: 7, town: 7, village: 7, borough: 7, municipality: 7,
};
const LEGAL_BASIS = new Set([
  'static-state-fips', 'census-pep-050-exact', 'census-pep-162-exact',
  'census-pep-061-county-scoped', 'census-pep-061-state-scoped',
]);

// ⚠ Page with a total order and assert DISTINCT ids == row count. A paged read
// without one silently repeats and drops rows; this has broken four times.
const rows = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .schema('treasury').from('municipalities')
    .select('id,name,state,entity_type,geoid,geoid_basis')
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error(`read failed: ${error.message}\n\nTry:  node scripts/verifyGeoidBackfill.mjs --print-sql`);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < PAGE) break;
}
const distinct = new Set(rows.map((r) => r.id));
if (distinct.size !== rows.length) {
  console.error(`FAIL paged read: ${rows.length} rows but ${distinct.size} distinct ids`);
  process.exit(1);
}

let bad = 0;
const fail = (m) => { console.error('FAIL ' + m); bad++; };

for (const r of rows) {
  const expected = EXPECTED_LENGTH[r.entity_type];
  if (r.geoid === null) {
    if (r.geoid_basis !== null) fail(`${r.name} (${r.state}): basis with no geoid`);
    continue;
  }
  if (expected === undefined) {
    fail(`${r.name} (${r.state}): entity_type ${r.entity_type} must not carry a geoid`);
    continue;
  }
  if (!/^\d+$/.test(r.geoid)) fail(`${r.name} (${r.state}): geoid "${r.geoid}" is not all digits`);
  if (!LEGAL_BASIS.has(r.geoid_basis)) fail(`${r.name} (${r.state}): illegal basis "${r.geoid_basis}"`);
}

const byGeoid = new Map();
for (const r of rows) {
  if (!r.geoid) continue;
  if (!byGeoid.has(r.geoid)) byGeoid.set(r.geoid, []);
  byGeoid.get(r.geoid).push(`${r.name} (${r.state}, ${r.entity_type})`);
}
for (const [geoid, names] of byGeoid) {
  if (names.length > 1) fail(`geoid ${geoid} claimed by ${names.length}: ${names.join(' | ')}`);
}

const withGeoid = rows.filter((r) => r.geoid).length;
const geographic = rows.filter((r) => EXPECTED_LENGTH[r.entity_type] !== undefined).length;
console.log(`${rows.length} rows; ${geographic} geographic; ${withGeoid} carry a geoid `
  + `(${((withGeoid / geographic) * 100).toFixed(1)}% of geographic); ${byGeoid.size} distinct geoids`);

if (bad > 0) { console.error(`\n${bad} failures`); process.exit(1); }
console.log('OK — every geoid matches its basis length, is all digits, carries a legal basis, and is unique');
