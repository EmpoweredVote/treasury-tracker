# Phase 94 — Extractor + Policy — Context

**Phase goal:** Decide the sourcing mechanism for the 50-state General Fund rollout, lock the cross-cutting policy, build the loader/extractor for the chosen source, and prove it end-to-end on ≥1 state beyond MN. Delivers SGFS-01.
**Requirements:** SGFS-01. **Depends on:** v2.9 Phase 93 discovery + the MN template (`scripts/processMN.js`). **UI:** no.

Planned inline ($0, no subagents per [[feedback_no_research_subagents]]).

## The decision this phase makes (Chris, 2026-06-28: "spike a uniform source first")
The milestone was framed around per-state ACFR General Fund extraction (matching MN). But that = 50 unique ~200-page PDFs with different layouts (laborious). Chris chose to **spike a uniform multi-state source first** and only fall back to per-state ACFR if no uniform source is good enough. So the source mechanism is an **output of this phase's spike**, gated by a Chris checkpoint — not pre-locked.

**Candidates to evaluate:**
- **NASBO State Expenditure Report** — General Fund spending by category (omnibus areas), all 50 states, free, annual. Closest to the current "General Fund" node concept. Revenue side: NASBO Fiscal Survey / state revenue tables.
- **US Census Annual Survey of State Government Finances (ASSGF)** — all states, standardized revenue + expenditure categories, free, machine-readable (CSV/API), annual. But it's Census "all-funds-by-category", NOT the budgetary General Fund (basis mismatch with MN's ACFR-GF).
- **Per-state ACFR General Fund (fallback)** — the MN-proven approach; most granular + most consistent with MN, but 50 unique PDFs.

## Implementation Decisions (to confirm/produce in this phase)
- **D-94-01 (spike-first — LOCKED, Chris):** Task 1 evaluates the candidates on: 50-state coverage, basis (is it General Fund?), category granularity (can it build a 1-level by-source + by-function tree?), free + machine-readable, multi-year depth, and **consistency with MN** (the gold-standard ACFR node). Produces a recommendation + a **decision checkpoint** for Chris to lock the source.
- **D-94-02 (MN consistency — open, decide at checkpoint):** if a uniform source is chosen, decide whether to RE-DO MN under the uniform source (consistency across all 50) or keep MN as an ACFR outlier (gold-standard, but mixed basis). Mixed-basis across state nodes is the same trap flagged in v2.9 — lean toward one uniform basis for all 50, with MN re-done to match, UNLESS ACFR is chosen as the source.
- **D-94-03 (policy to lock, Task 2):** FY depth per state (target window — match what the chosen source covers uniformly); **negative-revenue-year handling in the icicle** (e.g. MN FY2022 investment losses — clamp-with-footnote vs net-into-other vs flag); node concept + label under the chosen source ("General Fund" vs the source's term); basis label.
- **D-94-04 (build + prove, Task 3):** build the loader/extractor for the chosen source (generalize `processMN.js` if ACFR; a new uniform-source loader if NASBO/Census), source-stamp every row, idempotent; prove end-to-end on ≥1 NEW state (not MN) — load + spot-verify against the source.
- **D-94-05 (sourcing honesty bar):** whatever source is chosen, every state row must carry a real, resolving source_url + source_date + accurate data_source label; no round-number estimates, no false provenance ([[project_state_node_unsourced_estimates]], ground rule "no unsourced data").

## Out of scope (Phase 94)
- Loading all 50 states (Phase 96) and re-doing OH/VA + extending MN history (Phase 95) — Phase 94 builds + proves the tooling on one state.
- Verification/UAT (Phase 97).

## Anchors
- MN template: `scripts/processMN.js` / `scripts/processMNRevenue.js` (per-FY SOURCES map + post-RPC source stamp); the v2.9 Phase 93 state-node work.
- Discovery: 50 state GF nodes inventoried (47 unsourced estimates, OH+VA falsely-sourced, MN real) — see [[project_state_node_unsourced_estimates]] + 93-VERIFICATION.md.
- RPC: `treasury_sync_budget_tree` builds budget + categories from a jsonTree; does NOT set source_url/date (needs post-RPC UPDATE). `treasury_sync_city_budget` is NOT source-safe ([[project_sync_city_budget_not_source_safe]]).
- Memory: [[project_state_node_unsourced_estimates]], [[project_federal_tracker_ground_rules]], [[feedback_supabase_migration_mcp]], [[reference_treasury_budgets_probe_columns]].
