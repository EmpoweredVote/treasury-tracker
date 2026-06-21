# Phase 76: Donor-Facing Transparency View - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Render Empowered Vote's already-reconciled finances (produced by Phase 75's `treasury.org_financial_summary` record) on the EV page so a visitor understands the org's money at a glance:

1. **Income vs. expenses in plain language** — where money came from (by source) and where it went (EVVIEW-01), including the gross→net "cost of fundraising" story.
2. **An honest expense breakdown by category** (EVVIEW-02).
3. **Current funds on hand** (EVVIEW-03).
4. **The active fundraising goal + progress toward it** (EVVIEW-04).

This is the **frontend rendering layer** for data Phase 75 already computed and stored. It also necessarily includes the **cross-repo API exposure** of `org_financial_summary` through `ev-accounts-api` (the frontend reads all EV data via that API, not raw Postgres) — mechanical but required, with no data this phase shows otherwise.

**Not in scope:**
- The actual-spend **graphic** ("where the money goes" chart) — that is **Phase 77 (EVVIZ-01)**. Build the data plumbing + narrative here; do NOT build the chart.
- Runway **display** (see D-06 — intentionally dropped this phase; data remains in DB).
- Forward-looking allocation / "stretch goals" framing (deferred to v2 EVALLOC).
- In-kind / non-cash gifts (deferred, Phase 75 D-10).
- Live-API ingestion of the goal (deferred to v2 EVAUTO — the goal is a manual value this milestone).

</domain>

<decisions>
## Implementation Decisions

### Fundraising goal (EVVIEW-04)
- **D-01: The goal amount is a MANUAL value, stored as new fields on `treasury.org_financial_summary`.** Add `goal_amount` (numeric) + `goal_label` (text) columns, populated by the loader (`reconcileEV.js`) from a manual input (env var or small input file — planner's choice, keep it sourced/dated). No GiveButter API integration (that is deferred to EVAUTO). This keeps the goal traveling with the reconciled, sourced figures so the API serves goal + progress in one row.
- **D-02: Progress is measured against `income_net` (gross − fees) for the current fiscal year.** Matches "what actually reached EV" and stays consistent with the fee story (D-04). Not gross, not balance.
- **D-03: When net income reaches/passes the goal, cap the indicator at 100% and switch to a celebratory "Goal reached — thank you!" state.** Do not emphasize overage.

### Balance & burn pace (EVVIEW-03 — RE-SCOPED)
- **D-04 (balance): Show a "Funds on Hand" tile** — the bank-authoritative `balance` ($1,706.77) with the `balance_as_of` date in subtext. Placement is planner's discretion (recommendation: a tile in the existing `QuickFactsRow`).
- **D-05 (burn pace, replaces runway): Show an honest burn-PACE line, NOT a runway countdown.** A plain-language line in `PlainLanguageSummary` like "EV currently spends about $X/month, mostly on [top category]" using `monthly_burn`. Gives donors the pace + sense that every dollar matters, without a misleading deadline.
- **D-06 (EVVIEW-03 REQUIREMENT REFRAME): Runway display is intentionally DROPPED this phase.** Chris's reasoning: runway implies EV "shuts down at $0," which is false — EV is all-volunteer and wouldn't actually stop, so a countdown misrepresents reality. `runway_months` **remains computed and stored** in `org_financial_summary` (sourced, recoverable) — it is simply not surfaced. **Phase 78 verification of EVVIEW-03 must accept balance + burn-pace in place of the original "balance AND runway" wording.**

### Income / fee story (EVVIEW-01 + Phase 75 D-11)
- **D-07: Lead with a totals SENTENCE in `PlainLanguageSummary`** — Chris's verbatim framing: "Donors gave $X; after $Y in platform fees, $Z reached EV." Uses `income_gross` / `income_fees` / `income_net`.
- **D-08: Immediately follow the sentence with a compact 3-row per-source mini-list** in the same summary block — GiveButter / Patreon / Benevity, each showing gave → fee → net. Data: `income_by_source` `[{source,gross,fee,net}]` (every source already present). Sentence-led, detail present.
- **D-09: Fees are a reduction of income, NOT an operating expense** (carry-forward Phase 75 D-11/D-12). Never render fees as a bank debit / expense category — that would break bank-authoritative expense truth.

### Expense breakdown & volunteer framing (EVVIEW-02 — RE-SCOPED)
- **D-10 (EVVIEW-02 REQUIREMENT REFRAME): Deliver an HONEST expense breakdown by category with NEUTRAL framing — drop the "make the all-volunteer reality obvious" angle.** Chris does NOT want the all-volunteer / $0-staff status celebrated or branded. Reasons: (a) it's a current reality he hopes will change, not a long-term identity; (b) paying contributors would be tangible mission progress, NOT overhead — so any "$0 to staff = 100% to the mission" framing is wrong because it implies future salaries are waste. **Phase 78 verification of EVVIEW-02 should accept "honest expense breakdown by category," not "all-volunteer obvious."**
- **D-11: Keep the existing `$0 staff compensation` line NEUTRAL and FACTUAL** — a year-specific fact ("so far in {FY}, EV has paid $0 in staff compensation"), no celebratory spin, no "100% to mission / overhead" framing, no badge. The planner should review the current `PlainLanguageSummary` volunteer sentence ("All work is done by unpaid volunteers — …") and **soften any celebratory/identity framing** so it reads as a plain fact, not a brag.
- **D-12: No volunteer "badge" / highlighted stat.** Rejected celebratory treatment.

### Claude's Discretion (for the planner)
- **Page layout / composition** (EVVIEW-* — Chris said "you decide"): how the new pieces (Funds on Hand tile, goal-progress indicator, fee story sentence+mini-list, expense breakdown) compose. **Recommendation:** extend the existing `QuickFactsRow` (add Funds on Hand tile) + `PlainLanguageSummary` (burn-pace line, fee sentence + per-source mini-list) in place, and add the goal-progress indicator as a slim new element above the cards — lowest risk, consistent with the existing surface, and Phase 77's graphic can join later. Avoid a heavyweight new "Transparency panel" container unless it proves cleaner against the live layout.
- **Exact manual-goal input mechanism** (env var vs. small input file) — planner decides; keep it sourced/dated and idempotent like the rest of `reconcileEV.js`.
- **`ev-accounts-api` endpoint shape** for `org_financial_summary` — planner/research decides; mirror the `/treasury/federal/context` precedent (Phase 45). This is cross-repo (separate `ev-accounts-api` repo).
- **Burn-pace copy + which "top category" to name** — planner decides; default to the largest operating expense category.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 75 data layer (the data this phase renders)
- `.planning/phases/75-bank-truth-reconciliation/75-CONTEXT.md` — the full reconciliation model: balance/runway (D-01/02/03), gross→net fee waterfall (D-11/D-12), reconciliation variance (D-05), bank = expense authority, platforms = income detail. **This phase displays exactly what 75 produced.**
- `supabase/migrations/20260620000000_create_org_financial_summary.sql` — the `treasury.org_financial_summary` schema (one row per municipality+FY): `balance`, `balance_as_of`, `monthly_burn`, `runway_months`, `income_gross/fees/net`, `income_by_source` jsonb `[{source,gross,fee,net}]`, `recon_*`, sourcing columns. **Phase 76 adds `goal_amount` + `goal_label` here (D-01) via a new migration.**
- `scripts/reconcileEV.js` — produces/upserts the summary row (pure `runway`, `incomeGrossNet`, reconciliation helpers). **The manual goal value (D-01) is wired in here.**

### Existing EV frontend surface (extend these)
- `src/components/dashboard/QuickFactsRow.tsx` — nonprofit InsightCard row (Total Expenses, Total Income, Expense Categories). **Add "Funds on Hand" tile + goal data here (D-04).**
- `src/components/dashboard/PlainLanguageSummary.tsx` — nonprofit narrative (income/expense, `$0` staff line, top-3 expense categories, sourced footer). **Add burn-pace line (D-05), fee sentence + per-source mini-list (D-07/D-08); soften volunteer framing (D-11).**
- `src/components/dashboard/InsightCard.tsx` — the tile primitive reused for new tiles.
- `src/data/dataLoader.ts` — frontend API client (`API_BASE` → `ev-accounts-api`, `/treasury/...`). **New: fetch `org_financial_summary` via a new endpoint here; precedent is `/treasury/federal/context` (`getFederalContext`).**
- `src/App.tsx` — nonprofit branching (lines ~806, ~839, ~956+, `isNonprofit` props, current-year/`selectedYear` gating). **New transparency pieces wire in here for `entity_type === 'nonprofit'`.**
- `src/utils/brandColors.ts` — `BRAND_BAR_COLORS`, `getContrastText` (per auto-memory `EV Financials — Brand Color & Logo System`); EV source/fee colors already defined (Donations green, Platform Fees red, per-platform).

### Data model / API facts
- EV entity: `municipalities` row `name='Empowered Vote'`, `entity_type='nonprofit'`, `municipality_id = ee6f34f7-bd85-4387-8d71-4c2ed8cb8fdf`, slug `empowered-vote-ca`. App at **treasurytracker.empowered.vote** (auto-memory `feedback_app_url`).
- Frontend reads EV via the production **ev-accounts-api** (`ev-accounts-api.onrender.com`), NOT raw `treasury.*` — the `org_financial_summary` (incl. new goal fields) MUST be exposed through that API for this phase. This is a **separate repo** (see Phase 34/45 notes — cross-repo work).

No external ADRs/specs — requirements + decisions fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QuickFactsRow` + `InsightCard` — the nonprofit tile system; "Funds on Hand" is a direct new `InsightCard` (compact `$X.XX` formatting already handled via `isNonprofit`).
- `PlainLanguageSummary` — already renders nonprofit income/expense prose, the `$0` staff line, and a sourced footer; the fee sentence + per-source mini-list + burn-pace line slot into its existing `space-y-4` block.
- `useAnimatedCounter` — already used for revenue count-up; available for the goal-progress number/bar if desired.
- `getFederalContext` in `dataLoader.ts` (`/treasury/federal/context`) — the precedent pattern for a dedicated summary endpoint + typed response (`src/types/budget.ts` "Federal context" section).
- `brandColors.ts` palette (Donations green, Platform Fees red, per-platform brand colors) for consistent fee/source coloring.

### Established Patterns
- **Nonprofit branching** is `entity_type === 'nonprofit'` + current-year gating (`selectedYear === String(new Date().getFullYear())`) throughout `App.tsx` — new pieces follow the same gate.
- **Nonprofit money formatting** = exact 2-decimal dollars (not K/M/B rounding) — both `QuickFactsRow.formatCompact` and `PlainLanguageSummary.formatAmount` already branch on `isNonprofit`.
- **Always-sourced display** — every figure carries a source (Phase 75 summary row has `source_name/url/date`); the EVVER-02 verification (Phase 78) expects sources on the new figures too.
- **Idempotent loaders** — the goal value flows through `reconcileEV.js`'s existing upsert-by-(municipality,FY); re-running changes nothing.

### Integration Points
- **Cross-repo:** `ev-accounts-api` must gain a route returning `org_financial_summary` (incl. `goal_amount/goal_label`, `income_by_source`, `monthly_burn`, `balance`). Frontend `dataLoader.ts` gains the matching fetch + a TS type in `src/types/budget.ts`.
- **DB migration:** add `goal_amount` + `goal_label` to `treasury.org_financial_summary` (D-01) — new migration file under `supabase/migrations/`.
- **Phase 77 hand-off:** the expense-by-category breakdown data this phase surfaces is the same data Phase 77's graphic will visualize — keep the data access reusable, don't build the chart here.

</code_context>

<specifics>
## Specific Ideas

- **Fee framing Chris wants (verbatim):** "Donors gave $X → $Y platform fees → $Z reached EV" — the cost-of-fundraising story (D-07/D-08).
- **Runway philosophy (Chris, 2026-06-20):** "I'm not even sure I should share the runway. If I run out of money, would I really stop?" — runway-as-countdown misrepresents an all-volunteer org that wouldn't shut down at $0. → burn pace instead (D-05/D-06).
- **Volunteer-status philosophy (Chris, 2026-06-20):** "I'm more excited to pay groceries… let's not make 'we don't pay anyone' part of our brand identity… if someone is getting paid, that's also going to the development of EV in a very tangible way — it's not simply overhead." → drop celebratory all-volunteer framing; keep `$0` neutral & factual (D-10/D-11/D-12). **This refines auto-memory `Empowered Vote — All-Volunteer Organization` and the volunteer-sentence framing in `EV Financials — Brand Color & Logo System`: the $0 fact stays true, but it is NOT a celebrated identity.**

</specifics>

<deferred>
## Deferred Ideas

- **Runway display** — computed + stored, intentionally not surfaced this phase (D-06). Revisit only if framing changes.
- **GiveButter-sourced live goal** — manual value this milestone; live pull deferred to **v2 EVAUTO**.
- **Goal overage display** (showing >100%) — chose cap-at-100% (D-03); revisit if stretch-goal framing is wanted.
- **Per-source fee visual / waterfall chart** — chose a sentence + mini-list (D-07/D-08); a richer visual could come with the Phase 77 graphic vocabulary.
- **"Stretch goals" / forward allocation** ("what we unlock with more money") — Chris's Kickstarter-style north star; deferred to **v2 EVALLOC** (carried from Phase 75).
- **In-kind / non-cash gifts** (Framer, software grants) — deferred (Phase 75 D-10).
- **Future "contributors are paid as EV grows" framing** — Chris flagged this is the real direction; not surfaced now, but informs that the $0 line must read as a stage, not an identity.

None of the above is a Phase 76 blocker — all are intentional boundaries.

</deferred>

---

*Phase: 76-donor-facing-transparency-view*
*Context gathered: 2026-06-20*
