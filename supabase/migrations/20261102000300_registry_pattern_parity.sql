-- Per-axis digest of how many live families each mirrored pattern matches.
--
-- ⚠⚠⚠ REVIEW FOCUS #1. The gate's whole premise is that the pattern Postgres
-- matches with means the same thing the loader matched with. Postgres `~`
-- uses ARE, which takes (?:…), \d{4} and escaped parens verbatim — but "it
-- worked on four samples" is not proof. This lets scripts compare Postgres's
-- answer against JavaScript's across EVERY pattern and EVERY live family. A
-- pattern that silently fails to match in one engine is a green check over
-- unlabelled data, which is the exact failure the gate exists to prevent.
--
-- Proven equal 2026-11-02: 121 patterns, 5,929 families, all four digests
-- identical (accounting_basis 374, audit_grade 2,292, basis 4,359,
-- fund_scope 5,289 matches).
--
-- ⚠ `fam as materialized` is load-bearing. Without it the planner inlines the
-- distinct scan into a correlated subquery and the statement times out.

create or replace function treasury.registry_pattern_parity()
returns table (axis text, patterns bigint, matches bigint, digest text)
language sql
security definer
set search_path = treasury, public
as $$
  with fam as materialized (select distinct b.data_source from treasury.budgets b),
  c as (
    select p.axis, p.entry_id, count(f.data_source) as n
    from treasury.registered_source_families p
    left join fam f on f.data_source ~ p.pattern
    group by p.axis, p.entry_id
  )
  select c.axis,
         count(*)::bigint,
         sum(c.n)::bigint,
         md5(string_agg(c.axis || '|' || c.entry_id || '|' || c.n, E'\n' order by c.entry_id))
  from c group by c.axis order by c.axis;
$$;

-- ⛔ CREATE FUNCTION grants EXECUTE to PUBLIC. Swept by npm run verify:grants.
revoke all on function treasury.registry_pattern_parity() from public, anon;
grant execute on function treasury.registry_pattern_parity() to service_role;
