-- THE GATE COVERS BOTH WRITE PATHS. It previously covered the minority one.
--
-- ── ⚠⚠⚠ THE CORRECTION THIS MIGRATION EXISTS FOR ───────────────────────────
--
-- The design document states: "The RPC is the only real chokepoint. Every
-- loader must go through it to write." That is FALSE, and nobody measured it
-- — the claim was reached by counting call sites of ONE function and calling
-- it the chokepoint. Measured 2026-11-02:
--
--     treasury_sync_budget_tree   262 files   <- the MAJORITY path, ungated
--     treasury_sync_city_budget    65 files   <- where the gate was put
--
-- `treasury_sync_budget_tree` does its own INSERT INTO treasury.budgets, and
-- the ungated path carried the design's OWN motivating incidents:
--   scripts/processHIAcfr.js        Hawaii, which "shipped exactly this way twice"
--   scripts/scrapeMaDLS.js          the MA family — 15,071 of the 24,947 linkless rows
--   scripts/lib/acfrGfLoad.mjs      the shared ACFR loader behind TX/CO/AK/SC/IN/MS/ND/SD/KY
--
-- A gate on one path would not have stopped either incident it was argued
-- from. Found by code review, not by me.
--
-- ── WHAT CHANGES ───────────────────────────────────────────────────────────
--
-- 1. treasury.family_refusal_reason() holds the rule ONCE. Two copies of a
--    rule is how the two paths drifted apart in the first place.
-- 2. treasury_sync_budget_tree gains the registry check.
-- 3. treasury_sync_city_budget's source_url rule is fixed (see below).
--
-- ── ⚠⚠ WHY THE TREE PATH GETS THE REGISTRY HALF BUT NOT THE LINK HALF ──────
--
-- That function has no p_source_url and never writes one: its callers follow
-- an INSERT-THEN-STAMP pattern, writing the row and then UPDATEing
-- source_url, source_date and the four axes afterwards
-- (scripts/lib/acfrGfLoad.mjs:688-694). Refusing at insert time for a missing
-- link would reject rows that acquire one milliseconds later — a false
-- refusal, which the design names as the thing that gets a gate disabled.
-- The ratchet (npm run verify:provenance) counts linkless rows from either
-- path, so the debt is still held flat. ⭐ Gating on v_ds.name is sound
-- because the ephemeral data_sources row and the label the loader stamps both
-- come from the same dataSourceLabel() call.
--
-- ⚠ RAISE, not RETURN, on the tree path. That function keeps sync_logs and
-- data_sources bookkeeping, and its own p_basis guard raises for exactly this
-- reason: "Returning an error object here would skip the EXCEPTION block,
-- leaving the sync_logs row stuck at 'running' and data_sources reading idle
-- with last_error NULL - the invisible-failure shape PR #86 existed to
-- remove." The check sits beside that guard, before the destructive delete.

-- ── The rule, in one place ─────────────────────────────────────────────────
create or replace function treasury.family_refusal_reason(p_data_source text)
returns text
language plpgsql
stable
security definer
set search_path = treasury, public
as $$
DECLARE
  v_name text := btrim(coalesce(p_data_source, ''));
  v_unmatched text;
BEGIN
  IF v_name = '' THEN
    RETURN 'refusing to write a row with a blank (empty) data_source. Nothing was written.';
  END IF;

  -- Grandfathered: a family already in the table may keep being written. The
  -- goal is that a loader cannot write a family NO registry matches; draining
  -- the backlog belongs to the ratchet. Only 1,966 of 5,929 families match
  -- all three active axes, so refusing the rest would block the very re-runs
  -- that fix bad data.
  IF EXISTS (SELECT 1 FROM treasury.budgets WHERE data_source = v_name) THEN
    RETURN NULL;
  END IF;

  -- Three axes, not four: accounting_basis has five entries and is `unknown`
  -- on 99.94% of rows, so requiring it would refuse every loader in the repo.
  SELECT string_agg(a.axis, ', ' ORDER BY a.axis) INTO v_unmatched
  FROM unnest(ARRAY['audit_grade', 'fund_scope', 'basis']) AS a(axis)
  WHERE NOT EXISTS (
    SELECT 1 FROM treasury.registered_source_families r
    WHERE r.axis = a.axis AND v_name ~ r.pattern
  );

  IF v_unmatched IS NULL THEN RETURN NULL; END IF;

  RETURN format(
    'unregistered source family: %s (unmatched: %s). Nothing was written. '
    || 'This family has never been classified, so its rows would publish with no '
    || 'provenance label and no gate would notice. Add an entry to each unmatched '
    || 'axis registry under scripts/data/, then run scripts/syncRegisteredFamilies.mjs. '
    || 'If you believe it IS registered, your mirror is stale — '
    || 'scripts/syncRegisteredFamilies.mjs --check will say so.',
    v_name, v_unmatched);
END;
$$;

revoke all on function treasury.family_refusal_reason(text) from public, anon;
grant execute on function treasury.family_refusal_reason(text) to service_role;

-- ── ⚠⚠ THE INDEX THE GATE LEANS ON ────────────────────────────────────────
-- The previous migration asserted in a comment that data_source was indexed
-- and the per-write EXISTS was therefore cheap. It IS indexed live — but no
-- migration in this repo creates it, so a database rebuilt from migrations
-- would seq-scan 585,631 rows on every single write. A comment is not a
-- schema.
create index if not exists idx_budgets_data_source_gate
  on treasury.budgets (data_source);