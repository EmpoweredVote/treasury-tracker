# Phase 96: Remaining States (SGFS-04) - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning
**Source:** Inline context capture (Chris decisions, 2026-06-28) + Phase-94 locked policy

<domain>
## Phase Boundary

Remediate the **remaining ~46 state General Fund nodes** (all 50 minus the four already on real actuals: MN, OH, VA via Phases 93/95, and Georgia via the Phase-94 pilot) by replacing their unsourced round-number **operating** estimates with **real NASBO State Expenditure Report actuals** (spending-by-function), using the Phase-94-locked `scripts/loadStateGF.mjs` loader.

**In scope:** NASBO **operating** (spending-by-function, 7 categories) for the ~46 remaining states, a **multi-year actual window** per state (the actual — not estimate — years in the current NASBO SER, typically ~2 FYs), each row sourced + basis-labelled + 0-NULL stamped, sums cross-checked to NASBO Table 1 GF.

**Out of scope (deferred):**
- **Revenue-by-source for the cohort** — NASBO has no per-state revenue; deferred to future per-state ACFR upgrades (the same "ACFR later" path OH/VA took). See the known-gap note in `<decisions>`.
- Per-state ACFR upgrades for high-traffic states (future).
- Cohort-wide source-chain audit + UAT — Phase 97 (SGFS-05).
- MN FY1997–2007 (Phase 95 deferral).
</domain>

<decisions>
## Implementation Decisions

### Mechanism + scope (Chris, 2026-06-28)
- **D-96-01:** **NASBO operating-only for the bulk cohort; revenue deferred.** Honor the Phase-94 lock ("NASBO now, ACFR-upgrades later"). Load NASBO spending-by-function for the ~46 remaining states; do NOT attempt per-state ACFR revenue in this phase. This reconciles SGFS-04's literal "revenue-by-source + spending-by-function" text with the locked hybrid — revenue-by-source is a documented deferral, not a silent drop.
- **D-96-02:** **Multi-year actual window per state** — load the ACTUAL years present in the current NASBO SER (estimate/proposed years excluded per P1). Typically ~2 actual FYs per state; research confirms the exact actual-year set in the latest SER edition. (Georgia pilot loaded a single FY2023; this phase widens to the available actual window.)
- **D-96-03 (KNOWN GAP — must be documented, not silent):** Under D-96-01, the cohort's existing **unsourced revenue estimate rows REMAIN** (Chris chose "defer revenue," not "delete revenue estimate rows"). Therefore SGFS-04 criterion 2 ("no unsourced estimate state GF rows remain") is met for **operating only**; cohort **revenue** estimate rows persist pending the future ACFR revenue upgrade. **Planner/researcher MUST surface:** are those unsourced revenue rows currently DISPLAYED in the app? If so, the ground rule "[[project_federal_tracker_ground_rules]] — never display unsourced data" requires they be hidden (or the node's revenue view suppressed) even though we are not deleting/replacing them this phase. Resolve this as part of the plan (hide vs leave), and record the residual revenue deferral in the phase SUMMARY/VERIFICATION.

### Node-removal policy
- **D-96-04:** NASBO SER covers all 50 states, so node removal for "no clean free source" is expected to be **moot** — every state should get a real NASBO operating row. If any state genuinely cannot be sourced (e.g., NASBO data unusable/blank for a state-year), document it explicitly rather than leaving an estimate (P5). Removal is the last resort, documented per the success criterion.

### Carried forward from Phase 94 (LOCKED — do not re-litigate)
- **D-96-05:** Mandatory per-node **basis label** (P3): NASBO nodes carry a budgetary-basis label, e.g. `data_source = "NASBO State Expenditure Report — General Fund (FY<y> actual, budgetary basis)"` (exact string = planner's call, but it MUST name NASBO + the basis). NASBO basis ≈ ACFR within ~2% (MN cross-check) so the label suffices to mix bases honestly.
- **D-96-06:** Source-stamp contract (P4): post-RPC targeted `UPDATE` sets `source_url` (the NASBO SER PDF/landing) + `source_date` + `data_source`; **never** `treasury_sync_city_budget`; never `budgets.data_source_id`; 0-NULL invariant; idempotent (P6).
- **D-96-07:** Actuals-only (P1) + no-fabrication (P5): load only NASBO ACTUAL columns; every state-year passes the dual checksum (row GF+Fed+Other+Bonds = Total; 7-function sum = Table 1 GF) before load — no estimate/proposed columns, no national-ratio fabrication.
- **D-96-08:** Negative-category render rule (P2): if any NASBO function is negative, clamp render area to 0, retain signed value in the label, carry the source total verbatim.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked policy + mechanism (Phase 94)
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-POLICY.md` — P1–P6 (actuals-only FY window, negative-category render, mandatory basis label, 0-NULL source-stamp, no-fabrication, idempotency + targeted write).
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-SPIKE.md` — the NASBO-now/ACFR-later hybrid decision + NASBO SER table layout + dual-checksum requirement + "NASBO operating-only, no per-state revenue" finding.

### The proven loader (the pattern to scale)
- `scripts/loadStateGF.mjs` — the NASBO operating loader: pure helpers offline-tested, proven on Georgia FY2023. 7 NASBO functions (Elementary & Secondary Education, Higher Education, Public Assistance, Medicaid, Corrections, Transportation, All Other). RPC `treasury_sync_budget_tree` + post-RPC source-stamp UPDATE. Phase 96 scales this across the ~46 states + widens to the multi-year actual window.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §SGFS-04 — note the "revenue-by-source" clause is deferred per D-96-01/03 (NASBO has no per-state revenue).
- `.planning/ROADMAP.md` §"Phase 96".

### Memory
- `project_state_node_unsourced_estimates` — the cohort inventory (50 nodes, FY2022–2026, ~10 rows each; 47 unsourced estimates; OH/VA had false-stamped estimates now fixed; MN/OH/VA/GA done) + the locked NASBO mechanism facts + NASBO SER table page map (p18 Table 1 GF total; p27/35/43/55/61/69/79 per-function).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/loadStateGF.mjs` — NASBO operating loader (Georgia-proven). The bulk run = drive it across the ~46 states for the actual-year window. Decide: one parameterized loader run per state/FY vs a cohort driver — planner's call.
- The Phase-94 NASBO parser/checksum helpers (in `loadStateGF.mjs`) — reuse the dual-checksum; do not re-invent.

### Established Patterns
- `treasury_sync_budget_tree` RPC keys on (municipality_id, fiscal_year, dataset_type) → upsert in place. Operating dataset_type. Post-RPC `UPDATE` sets provenance (RPC does not).
- State nodes already exist in `treasury.municipalities` (`entity_type='state'`); this phase replaces their operating budget rows.

### Watch-outs
- NASBO PDF figures need visual read + dual checksum — `pdftotext` misaligns on blank cells (Phase-94 finding). NOTE: Phase 95 found `pdftotext -table` reads multi-column statements cleanly — researcher should test whether `-table` also tames the NASBO SER tables before defaulting to visual/image read.
- The ~46-state list = all 50 minus MN, OH, VA, Georgia. Confirm none of the others are already real (memory notes NY/TX/some CA/MI/PA have non-round-but-unsourced numbers — they still need sourcing).
</code_context>

<specifics>
## Specific Ideas
- "No unsourced estimate operating row should remain for any state" is the operating-side bar for this phase; revenue is the acknowledged remainder.
- Georgia FY2023 (Phase 94) is the reference for a correct single-state NASBO load (total $29.266B, 6/7 functions tie NASBO within 0.03%, 0-NULL, idempotent) — match that quality at cohort scale.
</specifics>

<deferred>
## Deferred Ideas
- **Cohort revenue-by-source** — future per-state ACFR upgrades (NASBO has none). The residual unsourced revenue rows + their display handling are flagged in D-96-03.
- **Per-state ACFR operating upgrades** for high-traffic states (richer than NASBO's 7 functions) — future, like OH/VA.
- **Cohort-wide source-chain audit + UAT** — Phase 97 (SGFS-05).
</deferred>

---

*Phase: 96-remaining-states-sgfs-04*
*Context gathered: 2026-06-28 (inline, Chris decisions + Phase-94 lock)*
