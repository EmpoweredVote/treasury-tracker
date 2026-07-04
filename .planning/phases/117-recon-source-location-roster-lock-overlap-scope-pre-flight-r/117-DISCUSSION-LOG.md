# Phase 117: Recon — Source Location + Roster Lock + Overlap/Scope Pre-flight (RECON-11) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**Areas discussed:** Fill policy for the final tail, DEEP-05 deepening recon scope, Small-state risk anticipation

> **Session note:** The three gray-area questions were presented, but Chris was idle (no response after 60s). The **Recommended** option in each was locked by best judgment, consistent with the established recon mold (D-04…D-12) and the milestone's honesty-over-completeness ethic. Any of these can be revisited at planning.

---

## Fill Policy for the Final Tail (D-01)

Context: This is the FINAL tail — milestone goal is "all 50 on ACFR" + retire NASBO — but the standing rule is "ship what survives, defer failures." There is no next tranche to defer to.

| Option | Description | Selected |
|--------|-------------|----------|
| Stay-NASBO exception, retire anyway | Failing state stays NASBO-served as an honest documented exception; NASBORT-01 still retires NASBO to fallback-only; "all 50" honestly restated. Per-state accept-relabel stays a load-time call. | ✓ |
| Best-effort accept broader/budgetary basis | Accept the best available basis (budgetary/broader fund) relabelled honestly so every state lands on real sourced data and NASBO fully retires. | |
| Recon flags, Chris decides per-state at load | Recon documents each failure with options and defers the stay-NASBO-vs-accept call to the load phase. | |

**User's choice:** Stay-NASBO exception, retire anyway (best-judgment default — Chris idle).
**Notes:** Recommended option. Matches honesty-over-completeness ethic and the "recon flags, load decides" separation — the per-state best-effort accept-relabel is preserved as a load-time call recon surfaces (D-10). Recon must produce an explicit "nodes remaining NASBO-served" list to feed Phase 123.

---

## DEEP-05 Deepening Recon Scope (D-02)

Context: Recon now also locates deeper-history URLs for CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016.

| Option | Description | Selected |
|--------|-------------|----------|
| Go as deep as durable URLs allow, bookend-tie each | No hard FY floor; bookend-tie each window; recency floor N/A; flag pre-GASB-34 years for pre34Extract.mjs. | ✓ |
| Target a specific FY floor per node | Fixed earliest-FY target per node so the load phase has a defined depth goal. | |
| Recency-adjacent only — just close named holes | Only locate URLs to contiguity, not maximum depth. | |

**User's choice:** Go as deep as durable URLs allow, bookend-tie each (best-judgment default — Chris idle).
**Notes:** Recommended option. Mirrors the v2.14 DEEP deepening pass and D-05/D-06 discipline.

---

## Small-State Risk Anticipation (D-03)

Context: The 21 remaining are the smallest-GF states — higher odds of no GAAP ACFR, biennial budgets, non-June FY-ends, or no splittable GF column.

| Option | Description | Selected |
|--------|-------------|----------|
| Add explicit 'no-clean-GAAP-ACFR' triage per state | Recon triages whether a GAAP Gov-Funds ACFR with a splittable GF column exists before URL-spelunking; surfaces stay-NASBO/accept-basis candidates early. | ✓ |
| Rely on locked D-08 + D-09, no new pre-flight | Four-risk-facts + scope-divergence flag already cover this; failures surface during bookend recon. | |

**User's choice:** Add explicit 'no-clean-GAAP-ACFR' triage per state (best-judgment default — Chris idle).
**Notes:** Recommended option. The triage feeds the D-01 fill policy + the Phase 123 NASBO-served list.

---

## Claude's Discretion

- Loader-template → per-state layout mapping (which `process*Acfr.js` family / `extract_gf.py`+`gen_state.py` fits each state).
- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l`, light `-table` cleanup).
- Per-year URL pattern discovery within the D-04 budget.
- Recon doc file naming/structure (per-batch SOURCES.md + gap log + deepening-URL doc + NASBO-served list).

## Deferred Ideas

- Deleting the NASBO loader code (retire-to-fallback-only, not delete).
- Flat-source icicle drill-down fix (accepted limitation).
- Federal always-sourced standard backfill to city/state (SRCSTD-01).
- Votes/amendments exploration hub (VOTES-01).
- Frontend / UI work (auto-enables on load).
