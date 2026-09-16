-- Detect cities TT holds as TWO entities because a publisher renamed them.
--
--   psql "$DATABASE_URL" -f scripts/detectForkedEntities.sql
--   (or paste into the Supabase SQL editor / run through the Supabase MCP)
--
-- Expect ZERO rows. Any row is a candidate fork to adjudicate by hand — this
-- finds candidates, it does not merge anything.
--
-- ── WHY THIS EXISTS ────────────────────────────────────────────────────────
--
-- The loaders match entities BY NAME. When a publisher changes the name it
-- prints, the match fails and a SECOND entity is created; every year from that
-- point forward lands on the new row and the city's history is severed. It has
-- happened twice, both from the Minnesota Office of the State Auditor:
--
--   2026-09-14  Marine on Saint Croix / Marine On Saint Croix   "on" -> "On"
--   2026-09-15  Birchwood            / Birchwood Village        a word added
--
-- ⚠⚠ NEITHER WAS FOUND BY LOOKING. Marine surfaced because both halves claimed
-- the same geoid and the backfill's uniqueness check refused it; Birchwood
-- surfaced while chasing an unrelated one-row discrepancy. Nothing fails when a
-- city forks: both halves carry honest data, every total ties, and EACH HALF
-- LOOKS COMPLETE. Only a reader who knows the missing years exist can tell.
--
-- ⚠ Making the match case-insensitive (#182) closes the Marine shape and NOT
-- the Birchwood shape: "on" -> "On" is a case change, "Birchwood" ->
-- "Birchwood Village" is a whole added word. The durable fix is matching on a
-- stable key rather than the published name. Until then, run this.
--
-- ── THE SIGNATURE ──────────────────────────────────────────────────────────
--
-- Both known forks shared all five, and a genuine pair of governments will not:
--
--   1. same state
--   2. ONE shared publisher — both halves carry the same single data_source
--   3. year ranges that DO NOT OVERLAP and sit adjacent (gap of 0 or 1)
--   4. related names after normalisation (accents folded, punctuation dropped,
--      leading/trailing designators stripped, or trigram-similar)
--   5. populations within 25% — different vintages of one small town, not two
--      different places
--
-- Plus two guards against the obvious false positives:
--
--   same entity_type    "Napa" (city) and "Napa County" (county) normalise to
--                       the same core once "County" is stripped. They are not a
--                       fork. Without this guard that pattern floods the output.
--   geoid agreement     two rows with DIFFERENT non-null geoids are two
--                       different governments, full stop.
--
-- ⚠ VALIDATED, NOT ASSUMED. Both known forks are already merged, so an empty
-- result proves nothing on its own. This query was checked by REBUILDING the
-- Birchwood fork inside a rolled-back transaction: it returned exactly that one
-- pair, gap 0, name similarity 1.00. An empty result is only meaningful because
-- the detector is known to fire.
--
-- ⚠ It cannot see a fork where the two halves' years OVERLAP (a re-load under a
-- new name rather than a clean handover), nor one whose names are unrelated
-- (a genuine renaming, e.g. a town incorporating under a new name).

with geo as (
  select m.id, m.name, m.state, m.entity_type, m.population, m.geoid,
         regexp_replace(lower(extensions.unaccent(m.name)), '[^a-z0-9]+', ' ', 'g') as n0
  from treasury.municipalities m
  where m.entity_type in ('state','county','township','city','town',
                          'village','borough','municipality')
),
core as (
  select g.*,
         btrim(regexp_replace(
           regexp_replace(btrim(g.n0),
             '\s+(city|town|township|village|borough|municipality|urban county|county)$', '', 'g'),
           '^(city|town|village|borough|township) of\s+', '', 'g')) as core_name
  from geo g
),
span as (
  select b.municipality_id as id,
         min(b.fiscal_year) as lo, max(b.fiscal_year) as hi,
         count(*) as rows_n,
         count(distinct b.data_source) as n_src,
         min(b.data_source) as src
  from treasury.budgets b
  group by b.municipality_id
)
select a.state,
       a.name as name_a, sa.lo || '-' || sa.hi as years_a, sa.rows_n as rows_a,
       a.population as pop_a, a.geoid as geoid_a,
       b.name as name_b, sb.lo || '-' || sb.hi as years_b, sb.rows_n as rows_b,
       b.population as pop_b, b.geoid as geoid_b,
       case when sa.hi < sb.lo then sb.lo - sa.hi - 1
            else sa.lo - sb.hi - 1 end as year_gap,
       round(extensions.similarity(a.core_name, b.core_name)::numeric, 2) as name_sim,
       left(sa.src, 60) as shared_source
from core a
join span sa on sa.id = a.id
join core b on b.state = a.state and b.id > a.id and b.entity_type = a.entity_type
join span sb on sb.id = b.id
where
  -- 2. one shared publisher
  sa.n_src = 1 and sb.n_src = 1 and sa.src = sb.src
  -- 3. non-overlapping and adjacent
  and (sa.hi < sb.lo or sb.hi < sa.lo)
  and (case when sa.hi < sb.lo then sb.lo - sa.hi - 1
            else sa.lo - sb.hi - 1 end) <= 1
  -- 4. related names
  and (a.core_name = b.core_name
       or b.n0 like a.n0 || ' %'
       or a.n0 like b.n0 || ' %'
       or extensions.similarity(a.core_name, b.core_name) >= 0.55)
  -- 5. populations within 25%
  and (a.population is null or b.population is null
       or a.population = 0 or b.population = 0
       or abs(a.population - b.population)::numeric
          / greatest(a.population, b.population) <= 0.25)
  -- guard: different non-null geoids means two different governments
  and (a.geoid is null or b.geoid is null or a.geoid = b.geoid)
order by name_sim desc, a.state, a.name;
