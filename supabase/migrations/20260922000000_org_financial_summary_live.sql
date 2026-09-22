-- =============================================================================
-- org_financial_summary_live: the reconciled figures PLUS donations that have
-- arrived since the last reconcile
-- =============================================================================
-- Created 2026-09-22. Motivated by a real donation: BJ Cantrell's $2 landed via
-- the Givebutter webhook at 05:42 UTC, moved the revenue tree from $6,138.40 to
-- $6,140.40 -- and left org_financial_summary.income_gross at $6,136, because
-- only reconcileEV.js writes that table.
--
-- A reader therefore saw an income tree and a "raised" figure $2 apart, and
-- which one they believed depended on which they looked at. That is the same
-- class of defect as the header-vs-tree divergence PR #201 fixed, one level up.
--
-- ⭐ AND IT IS AN IMPACT MISS, NOT ONLY A TRANSPARENCY ONE. If the page says a
-- figure and someone gives $2, that figure should move -- so the donor can think
-- "I did that". A number that sits still is a worse answer than a number that is
-- slightly behind.
--
-- ── ⚠⚠ WHAT DELIBERATELY DOES **NOT** MOVE ───────────────────────────────
-- `balance`, `runway_months` and `recon_variance` are BANK-sourced and stay
-- as-of `balance_as_of`. A Givebutter donation does not put money in the bank:
-- it sits with the platform until payout, minus fees. Measured on this very
-- row -- GiveButter platform net $1,871.78 vs matched bank deposits $1,193.45,
-- a $678.33 gap that IS the undeposited payouts. Incrementing "on hand" with an
-- undeposited donation would claim cash that is not there, which is exactly the
-- kind of unsourced figure this project exists not to publish.
--
-- So the live figure is RAISED, never ON HAND. The UI must keep those distinct.
--
-- ── ⚠⚠ THE GUARD: DERIVED, NEVER ACCUMULATED ─────────────────────────────
-- pending_gross is the SUM OF SURVIVING `givebutter_webhook` LINE ITEMS. It is
-- recomputed from rows on every read and stored nowhere.
--
-- That is what makes drift structurally impossible, and it works because
-- loadEVDonations ALREADY clears the tree on each refresh and re-inserts only
-- the webhook rows the export does not yet cover
-- (giveButterDedup(webhookRows, gb.asOf) keeps the delta, drops the superseded).
-- So every SURVIVING webhook row is, by construction, NOT in the reconciled
-- base:
--   * double-counting cannot happen -- a donation leaves the delta at the exact
--     moment an export brings it into the base. One rule, already in the code.
--   * regression cannot happen -- nothing is stored, so nothing goes stale.
--   * a replayed webhook cannot inflate it -- record_givebutter_donation is
--     already idempotent on external_id.
--
-- ⚠ A DATE GATE WAS TRIED FIRST AND IS WRONG. Gating on source_date would have
-- silently misreported: reconcileEV writes `source_date: s.balance_as_of` -- the
-- BANK date, not the donation-export cut. Deriving the cut from rows fails too,
-- because the csv line items are aggregates carrying NULL dates. Reusing the
-- loader's existing dedup sidesteps both.
--
-- ── ⚠⚠ security_invoker IS LOAD-BEARING ──────────────────────────────────
-- A normal view runs with its OWNER's privileges. Owned by postgres, it would
-- hand every row of org_financial_summary to anyone granted SELECT on the view
-- -- bypassing the RLS that currently denies anon (measured: anon sees 0 rows).
-- That is precisely the defect class this month has been spent closing, so the
-- view is created WITH (security_invoker = true) and the post-verify block below
-- asserts anon still sees nothing through it.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW treasury.org_financial_summary_live
WITH (security_invoker = true) AS
SELECT s.*,
       COALESCE(w.pending_gross, 0)::numeric AS pending_gross
  FROM treasury.org_financial_summary s
  LEFT JOIN LATERAL (
    SELECT sum(li.actual_amount) AS pending_gross
      FROM treasury.budgets b
      JOIN treasury.budget_categories c  ON c.budget_id = b.id
      JOIN treasury.budget_line_items li ON li.category_id = c.id
     WHERE b.municipality_id = s.municipality_id
       AND b.fiscal_year     = s.fiscal_year
       AND b.dataset_type    = 'revenue'
       AND li.source         = 'givebutter_webhook'
  ) w ON true;

COMMENT ON VIEW treasury.org_financial_summary_live IS
  'org_financial_summary plus pending_gross: donations received via the Givebutter webhook since the last reconcile. DERIVED from surviving webhook line items on every read, never accumulated, so it cannot drift or double-count. balance/runway/recon_variance are bank-sourced and deliberately unaffected -- pending_gross is RAISED, not ON HAND.';

-- The EV API (ev_api) serves this page; service_role for scripts. anon is NOT
-- granted: the base table already denies it and the endpoint is the only reader.
GRANT SELECT ON treasury.org_financial_summary_live TO ev_api, service_role;

-- =============================================================================
-- Post-verify gate
-- =============================================================================
DO $blk$
DECLARE
  bad         int := 0;
  v_muni      uuid;
  v_pending   numeric;
  v_gross     numeric;
  v_donations numeric;
  v_anon_rows bigint;
BEGIN
  SELECT id INTO v_muni FROM treasury.municipalities WHERE name = 'Empowered Vote';

  SELECT pending_gross, income_gross INTO v_pending, v_gross
    FROM treasury.org_financial_summary_live
   WHERE municipality_id = v_muni AND fiscal_year = 2026;

  IF v_pending IS NULL THEN
    bad := bad + 1; RAISE WARNING 'no live summary row for EV FY2026';
  END IF;

  -- ⚠⚠ THE CROSS-SURFACE INVARIANT. The two figures a reader can see must agree:
  -- the reconciled base plus what has arrived since MUST equal the revenue
  -- tree's Donations total. If these diverge, the page is telling two stories.
  SELECT c.amount INTO v_donations
    FROM treasury.budgets b
    JOIN treasury.budget_categories c ON c.budget_id = b.id
   WHERE b.municipality_id = v_muni AND b.fiscal_year = 2026
     AND b.dataset_type = 'revenue' AND c.parent_id IS NULL AND c.name = 'Donations';

  IF v_donations IS NULL THEN
    bad := bad + 1; RAISE WARNING 'no top-level Donations category on the EV FY2026 revenue budget';
  ELSIF (v_gross + v_pending) <> v_donations THEN
    bad := bad + 1;
    RAISE WARNING 'CROSS-SURFACE MISMATCH: income_gross % + pending % = % but the tree says %',
      v_gross, v_pending, v_gross + v_pending, v_donations;
  END IF;

  -- ⚠ security_invoker must actually hold: anon saw 0 rows on the base table and
  -- must still see 0 through the view.
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v_anon_rows FROM treasury.org_financial_summary_live;
  RESET ROLE;
  IF v_anon_rows <> 0 THEN
    bad := bad + 1;
    RAISE WARNING 'anon can read % row(s) through the view - security_invoker is not holding', v_anon_rows;
  END IF;

  IF NOT has_table_privilege('ev_api', 'treasury.org_financial_summary_live', 'SELECT') THEN
    bad := bad + 1; RAISE WARNING 'ev_api cannot read the view - the API would 500';
  END IF;

  IF bad > 0 THEN
    RAISE EXCEPTION 'org_financial_summary_live migration: % checks failed (see warnings)', bad;
  END IF;

  RAISE NOTICE 'OK - pending_gross = %, income_gross = %, tree Donations = % (agree); anon sees 0 rows',
    v_pending, v_gross, v_donations;
END $blk$;
