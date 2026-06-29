# Phase 97: Verification + UAT (SGFS-05) - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** Inline discuss-phase (Chris decisions, 2026-06-29) + Phase 93/96 precedent

<domain>
## Phase Boundary

The **v2.10 State General Fund Sourcing milestone closeout.** Prove the whole
50-state General Fund node cohort is real + sourced, then get Chris's live
sign-off. Verification only — no new data loads. Mirrors the proven Phase 88
(OH) / Phase 93 (MN) / Phase 83 (VA) / Phase 73 (Utah) closeout shape, executed
**inline ($0, no research/roadmapper subagents** per [[feedback_no_research_subagents]]).

Three deliverables:
1. **Cohort-wide source-chain audit** — confirm 0 unsourced / round-number-estimate
   state GF rows across all 50 state nodes; every displayed row carries a resolving
   `source_url` + `source_date` + canonical `data_source` (with basis label); no
   fragile/orphan/residue rows; no out-of-window estimate rows.
2. **Spot-reconciliation** — independently re-derive a representative sample of states
   straight from the source documents (NASBO SER PDF for operating; ACFR for MN/OH/VA),
   **not** trusting loader self-report (the Phase 86 county near-miss lesson).
3. **Live-app UAT** — Chris drives treasurytracker.empowered.vote and signs off at a
   BLOCKING checkpoint; agent records pass/fail in `97-UAT-CHECKLIST.md`.

**Cohort going in (from Phases 94–96):**
- **47 states on real NASBO operating actuals** (46 cohort + Georgia) — 94 in-window
  operating rows, spending-by-function (7 categories), budgetary-basis labelled, 0-NULL.
- **MN / OH / VA on real ACFR** — operating **and** revenue, GAAP basis.
- Cohort revenue estimate rows + out-of-window operating estimates were **deleted** in
  Phase 96-07 (375 rows across 47 states) — revenue-by-source deferred to future per-state
  ACFR upgrades, NOT hidden. So **operating-only is the deliberate, honest state** for the
  47 NASBO states; nothing unsourced is displayed.

**Out of scope:** any new data load; cohort revenue-by-source (future ACFR upgrades);
per-state ACFR operating upgrades; MN FY1997–2007 (Phase 95 deferral); local-government
expansion. Milestone retrospective + archive → `/gsd-complete-milestone` after 97 closes.
</domain>

<decisions>
## Implementation Decisions

### Spot-reconciliation sample (D-97-01)
- **D-97-01 (sample = "Representative 7" — LOCKED, Chris 2026-06-29):** Independently
  re-derive a sample that hits every source path + every edge case once:
  - **MN, OH, VA** — the 3 real-ACFR states (re-derive from their ACFR governmental-funds
    statements; the proven recon path from Phases 88/93/95).
  - **Georgia** — the Phase-94 NASBO pilot (reference for a correct single-state NASBO load).
  - **1 multi-FY NASBO state** — exercise the multi-year actual window (D-96-02).
  - **1 negative-category NASBO state** — exercise the negative-category clamp rule (P2/D-96-08);
    planner/executor confirms the actual negative-function state from Phase 96 load logs
    (CO Transportation is a candidate per STATE.md, but confirm against `96-07-LOAD-LOG.md`).
  - **1 large random NASBO state** (e.g. CA or TX) — broad cohort confidence on a high-traffic node.
- **Re-derivation method (carried from D-93-06):** do NOT trust loader self-report. For each
  sample state, re-derive a handful of category amounts AND the dataset total straight from the
  source doc and compare to the stored DB values — catches label/column/row mismapping. Use the
  Phase-94 NASBO parser/checksum helpers in `scripts/loadStateGF.mjs` for the NASBO states.

### Live-app UAT walkthrough (D-97-02)
- **D-97-02 (UAT nodes = "MN + 1 NASBO + GA" — LOCKED, Chris 2026-06-29):** Chris drives:
  - **Minnesota** — confirms the 2-level icicle drill-down renders (operating + revenue), the
    MN differentiator ([[project_flat_source_icicle_limitation]]).
  - **One operating-only NASBO state** — confirms the operating-only view renders clean (see D-97-03).
  - **Georgia** — the NASBO pilot node.
  - **Per node, verify:** source chip resolves to a real citizen-openable doc; basis label is
    visible and honest (budgetary basis for NASBO vs GAAP for ACFR); per-capita renders;
    the node does not show any empty/broken/unsourced view.

### Operating-only revenue presentation (D-97-03)
- **D-97-03 (verify clean, fix if broken — LOCKED, Chris 2026-06-29):** With cohort revenue
  rows deleted, a NASBO state node is operating-only. The audit MUST confirm these nodes render
  with **no empty or broken revenue view** in the live app. **If the app shows a broken/empty
  revenue tab for operating-only nodes, suppress the revenue view in-phase** (small, reproducible,
  idempotent fix — see D-97-04). MN/OH/VA must still correctly show their real revenue. This is
  the [[project_federal_tracker_ground_rules]] "never display unsourced/empty data" guardrail
  applied to the post-deletion state.

### In-phase fix policy (D-97-04)
- **D-97-04 (small approved fixes allowed — LOCKED, Chris 2026-06-29):** Phase 97 is primarily a
  read-only audit, but if the audit surfaces a small defect (basis-label inconsistency, population=0,
  the D-97-03 revenue-view suppression, a state-node source-stamp gap), a **small, reproducible,
  idempotent fix is allowed** — each presented to Chris and approved at a checkpoint before applying,
  then re-verified. Mirrors Phase 93's one approved in-phase fix (D-93-05). Anything larger becomes a
  documented follow-up, not an in-phase scope expansion.

### Carried forward from Phase 93/96 (do not re-litigate)
- **D-97-05 (reconciliation tolerance):** documented + **explained** tolerance (~±2–5%), not
  penny-exact. NASBO budgetary basis ≈ ACFR GAAP within ~2% (MN cross-check, D-96-05); ACFR
  deltas attributable to known basis differences (all-governmental-funds vs GF-only, enterprise
  funds excluded, timing). Every delta must be explained, not just bounded (D-93-03).
- **D-97-06 (UAT format):** Chris drives the live app at treasurytracker.empowered.vote
  ([[feedback_app_url]]); agent records pass/fail + sign-off at a BLOCKING checkpoint; produce
  `97-UAT-CHECKLIST.md` (mirror 88-03 / 93-03). Inform-tier/unauthenticated read access is full
  ([[feedback_inform_tier_access]]).
- **D-97-07 (DB target):** production only (`kxsdzaojfaibhuzmclfq`); read-only via
  `mcp__supabase-local` ([[feedback_supabase_migration_mcp]]); use `total_budget`/`hierarchy`
  probe columns ([[reference_treasury_budgets_probe_columns]]). Any approved D-97-04 write is
  applied + re-verified; everything else read-only.

### Claude's Discretion
- Plan structure (how many plans / how the audit, recon, and UAT split across them — Phase 93
  used 3 plans).
- The exact negative-category and large-random NASBO states in the sample (confirm from
  `96-07-LOAD-LOG.md`).
- Exact basis-label strings and probe SQL.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §SGFS-05 — the cohort-wide audit + spot-reconciliation + UAT requirement.
- `.planning/ROADMAP.md` §"Phase 97: Verification + UAT (SGFS-05)" — goal + 2 success criteria.

### Locked policy + the loader (Phase 94/96)
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-POLICY.md` — P1–P6 (actuals-only, negative-category
  render, mandatory basis label, 0-NULL source-stamp, no-fabrication, idempotency + targeted write).
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-SPIKE.md` — NASBO-now/ACFR-later hybrid, NASBO SER
  table layout + page map, dual-checksum requirement.
- `scripts/loadStateGF.mjs` — the NASBO operating loader + its parser/dual-checksum helpers (reuse for
  NASBO re-derivation; do NOT re-invent).

### What was loaded / deleted going into 97 (the cohort the audit must confirm)
- `.planning/phases/96-remaining-states-sgfs-04/96-VERIFICATION.md` — operating PASS + revenue-deferral record.
- `.planning/phases/96-remaining-states-sgfs-04/96-07-LOAD-LOG.md` + `96-07-SUMMARY.md` — the 375-row deletion
  (234 revenue + 141 out-of-window operating) across 47 states; final probe counts (94 in-window, 47 states,
  0 NULL provenance); FY-end notes (AL/MI/TX/NY); the negative-category state.
- `.planning/phases/96-remaining-states-sgfs-04/96-CONTEXT.md` — D-96-01..08 (basis label, source-stamp
  contract, actuals-only, negative-category clamp).

### Precedent closeout (the shape to mirror)
- `.planning/phases/93-verification-source-chain-audit-uat-mnver-01-mnver-02/93-CONTEXT.md` + its
  `93-01`/`93-02`/`93-03` plans/summaries + `93-UAT-CHECKLIST.md` — the 3-plan recon/audit/UAT structure.
- `.planning/milestones/v2.8-phases/88-verification-source-chain-audit-uat/` (88-CONTEXT, 88-01-RECON,
  88-02-AUDIT, 88-UAT-CHECKLIST, 88-0{1,2,3}-SUMMARY).

### Memory
- [[project_state_node_unsourced_estimates]] — the 50-node inventory + locked NASBO mechanism + SER page map.
- [[feedback_no_research_subagents]] — execute inline, no research/roadmapper subagents.
- [[project_federal_tracker_ground_rules]] — never display unsourced/empty data (the D-97-03 guardrail).
- [[project_flat_source_icicle_limitation]] — MN icicle drill-down is the differentiator (UAT check).
- [[feedback_supabase_migration_mcp]], [[feedback_app_url]], [[feedback_inform_tier_access]],
  [[reference_treasury_budgets_probe_columns]].
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/loadStateGF.mjs` — NASBO parser + dual-checksum helpers for re-derivation of NASBO sample states.
- The Phase 96 cohort-cleanup/probe scripts (the 5 DB probes used in 96-07: 0 revenue, 0 out-of-window
  operating, 94 in-window, 47 states, 0 NULL provenance) — extend to a full 50-node cohort-wide audit probe.
- Phase 93/88 audit + UAT-checklist templates — copy the structure.

### Established Patterns
- State nodes live in `treasury.municipalities` (`entity_type='state'`); `treasury.budgets` metadata rows
  gate visibility; provenance on line-item rows via `source_url`/`source_date`/`data_source`.
- Source-chain audit = independent DB probes (NULL/fragile/residue/out-of-window) + re-derivation from
  source docs, never loader self-report.

### Watch-outs
- NASBO PDF figures need visual read + dual checksum; `pdftotext -table` reads multi-column statements
  cleanly (Phase 95 finding) — use it for ACFR; confirm for NASBO SER tables.
- The cohort is **mixed-basis by design** (NASBO budgetary vs ACFR GAAP) — the audit must confirm the
  per-node basis label renders so the mix is honest, not hidden.
</code_context>

<specifics>
## Specific Ideas
- "0 unsourced / round-estimate rows across all 50 state nodes" is the hard bar for criterion 1 —
  operating side fully delivered; cohort revenue is the acknowledged, documented deferral (not a gap).
- Georgia FY2023 (Phase 94: total $29.266B, 6/7 functions tie NASBO within 0.03%, 0-NULL, idempotent)
  is the reference for a correct NASBO node — match that quality at audit.
</specifics>

<deferred>
## Deferred Ideas
- **Cohort revenue-by-source** — future per-state ACFR upgrades (NASBO has no per-state revenue).
- **Per-state ACFR operating upgrades** for high-traffic states (richer than NASBO's 7 functions).
- **MN FY1997–2007** — Phase 95 deferral.
- Milestone retrospective + archive — `/gsd-complete-milestone` after Phase 97 signs off.

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 97-verification-uat-sgfs-05*
*Context gathered: 2026-06-29 (inline discuss-phase, Chris decisions + Phase 93/96 precedent)*
