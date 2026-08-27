-- Drop the `DEFAULT 1` on fiscal_year_start_month, on BOTH tables that carry it,
-- and make a missing month REFUSE instead of silently claiming January.
--
-- ── What this closes ────────────────────────────────────────────────────────
-- The fiscal-year-month arc removed a literal `7` from `treasury_sync_city_budget`
-- (PR #61). It did not remove the OTHER silent default, which lived in the schema:
--
--     treasury.budgets.fiscal_year_start_month       bigint NOT NULL DEFAULT 1
--     treasury.data_sources.fiscal_year_start_month  bigint NOT NULL DEFAULT 1
--
-- Four of the five sync RPCs (`treasury_sync_budget_tree`, `_salaries`,
-- `_salary_tree`, `_transactions`) copy the month off the `data_sources` row:
--
--     INSERT INTO treasury.budgets (..., fiscal_year_start_month, ...)
--     VALUES (..., v_ds.fiscal_year_start_month, ...)
--
-- so a loader that never set it on the source row got January, for free, silently,
-- with no error and no failing test — the column moves no dollar, so every tie
-- test still passed at $0. That is how 16,839 Massachusetts rows came to assert a
-- calendar fiscal year (PR #67), and how 4 of Long Beach's rows did (PR #68).
--
-- ── Why dropping the default is safe HERE ───────────────────────────────────
-- Checked before writing this, not assumed:
--
--   * All FIVE sync RPCs name `fiscal_year_start_month` explicitly in their
--     INSERT column lists. None of them relies on the default.
--   * Exactly four scripts insert into `treasury.budgets` directly —
--     loadEVBank.js, loadEVDonations.js, loadEVFinances.js and
--     la02RestoreBackup.mjs. The first three set the column; the fourth inserts a
--     whole archived row, and the archive was verified to carry
--     `fiscal_year_start_month` (value 7) on all 7 of its rows.
--   * NO view, materialised view or generated column depends on either column
--     (checked via pg_depend/pg_rewrite).
--   * `src/` never reads the column; it reaches the app through the API.
--   * Every stored value is already within 1–12: budgets holds {1,4,7,9,10},
--     data_sources holds {1,7,10}. So the CHECK below validates without a fight.
--
-- ⚠ WHAT THIS DELIBERATELY BREAKS. ~250 loader scripts create `data_sources` rows
-- without setting the month. They select-then-insert, so an EXISTING source row
-- keeps its value and re-running a loader for an entity we already hold is
-- unaffected. A BRAND-NEW (entity, source) pair now REFUSES until the loader
-- states the calendar — which is exactly the boundary PR #61 established for
-- `treasury_sync_city_budget`, applied to the other write path. Onboarding a new
-- source now requires establishing its fiscal calendar first. That is the point.
--
-- ⚠ NOT DECIDED HERE: whether "unknown" should become REPRESENTABLE by making
-- these columns nullable. That is a different change — it would trade a refusal
-- at the moment of the mistake for a NULL that fails later, and it would require
-- every reader to handle NULL. Both columns stay NOT NULL, so the failure lands
-- at the earliest possible point. See the memory note on SCOPE-01's honest
-- `unknown` for the argument on the other side.
--
-- Applied via mcp__supabase-local__apply_migration, which wraps the batch in its
-- own transaction — hence no explicit BEGIN/COMMIT here.
--
-- ⚠ The ledger row for this migration is stamped 20260826071826, not the filename's
-- 20260826000000. apply_migration assigns its own version; repo filenames never
-- match it. That is the house pattern — do not "fix" the ledger by hand.
--
-- ── Verified after applying ─────────────────────────────────────────────────
--   * Both defaults gone, both columns still NOT NULL.
--   * Row counts unchanged: budgets 87,864; data_sources 1,814. Month
--     distributions unchanged: budgets {1,4,7,9,10}, data_sources {1,7,10}.
--   * An INSERT omitting the column raises 23502 with the HINT below, and the
--     BEFORE trigger beats the other NOT NULL constraints on the same row — the
--     month guard fired ahead of data_sources.base_url, which proves ordering.
--   * An INSERT with month 13 raises 23514 on the range CHECK.
--   * A legitimate UPDATE re-asserting an existing value still passes.
--   * No probe row persisted (both probes errored, count verified 0).

-- ── 1. The defaults ────────────────────────────────────────────────────────
ALTER TABLE treasury.budgets
  ALTER COLUMN fiscal_year_start_month DROP DEFAULT;

ALTER TABLE treasury.data_sources
  ALTER COLUMN fiscal_year_start_month DROP DEFAULT;

-- ── 2. Constrain the domain ────────────────────────────────────────────────
-- A default of 1 was not the only way this column could hold a value nobody
-- established: nothing stopped a loader writing 0, 13, or a month it computed
-- off a fetch date. `bulkLoadStateController` validates 1-12 in JavaScript; the
-- database did not. Now it does, for every write path at once.
ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_fiscal_year_start_month_range
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

ALTER TABLE treasury.data_sources
  ADD CONSTRAINT data_sources_fiscal_year_start_month_range
  CHECK (fiscal_year_start_month BETWEEN 1 AND 12);

-- ── 3. Make the refusal ACTIONABLE ─────────────────────────────────────────
-- Without the default, an omitting INSERT already fails on NOT NULL — but with
-- the message "null value in column \"fiscal_year_start_month\" ... violates
-- not-null constraint", which tells the next person what broke and nothing about
-- what to do. A row-level BEFORE trigger fires ahead of constraint evaluation, so
-- it can replace that with instructions. It keeps SQLSTATE 23502 so anything
-- already catching a not-null violation behaves unchanged.
CREATE OR REPLACE FUNCTION treasury.require_fiscal_year_start_month()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fiscal_year_start_month IS NULL THEN
    RAISE EXCEPTION
      'fiscal_year_start_month is required on treasury.% and was not supplied', TG_TABLE_NAME
      USING ERRCODE = '23502',
            HINT = 'This column used to DEFAULT to 1, which silently asserted a '
              || 'January fiscal year for every loader that omitted it (16,839 MA '
              || 'rows, PR #67). The default is gone, so the month must be stated '
              || 'with evidence. For a data_sources row, set it there: the tree '
              || 'RPCs copy it onto budgets. For treasury_sync_city_budget, pass '
              || 'p_fiscal_year_start_month or let it inherit the unanimous month '
              || 'of the same (municipality_id, data_source) family. Establish the '
              || 'value from the entity''s own ACFR/budget or a statute, and record '
              || 'the authority in scripts/lib/loaderFiscalCalendars.mjs.';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION treasury.require_fiscal_year_start_month() IS
  'Turns a missing fiscal_year_start_month into an actionable refusal instead of '
  'a bare not-null violation. Fires BEFORE constraint evaluation on budgets and '
  'data_sources. See migration 20260826000000.';

CREATE TRIGGER budgets_require_fiscal_year_start_month
  BEFORE INSERT OR UPDATE OF fiscal_year_start_month ON treasury.budgets
  FOR EACH ROW EXECUTE FUNCTION treasury.require_fiscal_year_start_month();

CREATE TRIGGER data_sources_require_fiscal_year_start_month
  BEFORE INSERT OR UPDATE OF fiscal_year_start_month ON treasury.data_sources
  FOR EACH ROW EXECUTE FUNCTION treasury.require_fiscal_year_start_month();

COMMENT ON COLUMN treasury.budgets.fiscal_year_start_month IS
  'Month the fiscal year STARTS (1-12). June 30 year end -> 7, September 30 -> 10, '
  'December 31 -> 1. NO DEFAULT: must be stated with evidence. Moves no dollar, so '
  'no arithmetic tie test can catch a wrong value — see PRs #60-#68.';

COMMENT ON COLUMN treasury.data_sources.fiscal_year_start_month IS
  'Month the fiscal year STARTS (1-12) for rows created from this source. The tree '
  'family of sync RPCs copies this onto treasury.budgets, so a wrong value here '
  'propagates silently. NO DEFAULT: must be stated with evidence.';
