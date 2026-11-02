-- RLS on treasury.registered_source_families — public on purpose.
--
-- ⚠⚠ CAUGHT BY tests/exposedTableRls.test.mjs, not by me. The table was
-- created in a PostgREST-exposed schema with RLS off, which means the
-- schema-wide default SELECT grant hands every row to `anon`. Six treasury
-- tables landed that way in 2026-09 and nobody noticed until the next weekly
-- linter read; that guard exists so the NEXT one fails its PR instead, and it
-- did its job here.
--
-- ⚠ My earlier reasoning — "anon SELECT is consistent with treasury.budgets"
-- — was about GRANTS and did not answer the RLS question. Both have to be
-- right. Being readable is the intent; being readable because nobody switched
-- RLS on is an accident that happens to match the intent.
--
-- These rows are regex patterns over PUBLISHED data_source names. Nothing
-- here is more sensitive than treasury.budgets, which is already anon
-- readable, so the policy is permissive for reads and silent for writes —
-- only service_role holds INSERT/UPDATE/DELETE (20261102000200), and RLS
-- without a write policy denies everyone else by default.

alter table treasury.registered_source_families enable row level security;

drop policy if exists registered_source_families_read
  on treasury.registered_source_families;

create policy registered_source_families_read
  on treasury.registered_source_families
  for select
  to anon, authenticated
  using (true);

-- ⚠ The authoritative LIVE check: the static guard reads migration TEXT, so
-- it cannot see whether this actually took effect in the target database.
do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'treasury'
      and c.relname = 'registered_source_families'
      and c.relrowsecurity
  ) then
    raise exception 'RLS is NOT enabled on treasury.registered_source_families';
  end if;
end $$;
