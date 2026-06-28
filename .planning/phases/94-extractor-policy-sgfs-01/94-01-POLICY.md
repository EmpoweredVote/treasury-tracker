# 94-01 POLICY — Cross-Cutting Rules for the 50-State GF Rollout

**Phase:** 94 (SGFS-01) · **Date:** 2026-06-27 · **Status:** LOCKED — Phases 95/96/97 follow this.
**Source decision (94-01-SPIKE.md):** Hybrid — **NASBO now** (49 states), **MN kept as ACFR gold-standard**, ACFR upgrades for high-traffic states later. Mixed basis ACCEPTED, conditional on per-node basis labels (below).

These rules apply **uniformly to all ~50 state nodes**. A state-node row that cannot satisfy them is not loaded (no fabrication).

---

## P1 — FY depth / window
- **Actuals only. Never load NASBO's estimated column.** Each NASBO SER edition covers 3 fiscal years = 2 **actual** + 1 **estimated** (e.g. the 2024 SER = actual FY2022, actual FY2023, *estimated* FY2024). We load **only the actual columns**; the estimated year is excluded until a later edition restates it as actual.
- **Target window:** the **3 most recent ACTUAL fiscal years** available across NASBO editions for that state (pull older editions from the NASBO archive to backfill). Fewer years is acceptable if the source lacks them — never pad to hit a count.
- MN (ACFR outlier) keeps its existing FY2023–FY2025 actual window; not re-cut.

## P2 — Negative-category handling in the icicle  (LOCKED, concrete)
Icicle/sunburst areas cannot render a negative magnitude. A negative category (e.g. MN FY2022 GF investment losses; rare in NASBO, where tax sources stay positive) is handled by **clamp-to-zero-area + retain-true-signed-value + flag**, never by silent netting:
1. **Rendered area = `max(amount, 0)`** (a negative leaf draws as zero width — it does not crash or invert the layout).
2. **The true signed value is preserved** in the row/leaf data and shown in the label/tooltip, flagged (e.g. `Investment Earnings: −$1.2B (net loss — shown at 0)`).
3. **The node TOTAL stays the source's reported total** (which already nets the negative in). Do not recompute the parent as a sum of clamped leaves; carry the source total verbatim so the audited figure is never altered.
4. A footnote on the node states that one or more categories were net-negative and are shown at zero area with their real value in the label.
- Rationale: honest (real number always visible + reconciles to the audited total), and it renders.
- The loader exposes this as a pure helper (`clampForRender` / tree-builder) so it is applied identically for every state and both datasets.

## P3 — Node concept, display label, and BASIS label
- **Node concept (unchanged):** one `municipalities` row per state (`entity_type='state'`); an **operating** budget (spending-by-function) + a **revenue** budget (revenue-by-source) per FY. jsonTree = a root with depth-1 category children (1-level tree).
- **Root display labels (unchanged, uniform):**
  - operating: `"<State> General Fund Budget"`
  - revenue: `"<State> General Fund Revenue"`
- **BASIS label is MANDATORY per node (the core mitigation of mixed basis).** Because NASBO (budgetary GF) and MN (GAAP GF, ACFR) coexist, **every node's basis + source must be self-evident from its own row** — no node relies on a global assumption. Basis is carried in the `data_source` string (see P4) and the resolving `source_url`. Label templates:
  - **NASBO nodes:** `data_source = "NASBO State Expenditure Report — General Fund (FY<y> actual, budgetary basis)"` for operating; `"NASBO Fiscal Survey of States — General Fund Revenue (FY<y> actual, budgetary basis)"` for revenue.
  - **MN / ACFR nodes (existing + future upgrades):** `"State of Minnesota ACFR — General Fund (FY<y> actual)"` (GAAP basis) — already in place; the pattern for any ACFR upgrade is `"State of <State> ACFR — General Fund (FY<y> actual, GAAP basis)"`.
- **NASBO category taxonomy (uniform, the 7 functions):** Elementary & Secondary Education (K-12), Higher Education, Public Assistance, Medicaid, Corrections, Transportation, All Other. Use the source's own category names verbatim. A function with $0 GF is dropped from the tree (P5).
- **DATASET SCOPE per node-type (locked from the Task-4 build finding):** **NASBO nodes carry an OPERATING (spending-by-function) tree ONLY.** NASBO has no per-state revenue-by-source data (revenue-by-source is national-aggregate only), so **per-state GF revenue-by-source DEFERS to the ACFR upgrade** — a NASBO node legitimately has operating-only until upgraded. MN (ACFR) carries both operating + revenue. A NASBO node must NOT fabricate a revenue tree from national ratios or all-funds Census data.

## P4 — Source-stamp contract (0-NULL, no false provenance)
Every loaded budget row MUST carry all three, set by a **targeted post-write `UPDATE`** (the `treasury_sync_budget_tree` RPC does NOT set them; **never** use `treasury_sync_city_budget` — it is not source-safe, [[project_sync_city_budget_not_source_safe]]):
- `source_url` — a **resolving** URL to the exact NASBO edition PDF (or ACFR PDF) the figures came from.
- `source_date` — the source's publication/edition date or the fiscal-year-end the figures represent (ISO date).
- `data_source` — the basis-bearing label from P3 (NEVER an estimate label, NEVER a borrowed/false source).
- **0-NULL invariant:** after a load, every loaded row has non-NULL `source_url`, `source_date`, `data_source`. A row that would be NULL on any of these is not written.

## P5 — No-source handling (no fabrication)
- A state-year with no usable sourced figures is **skipped** — never estimated, never back-filled with round numbers.
- A state with **zero** sourceable years carries **no budget rows** (an empty node is honest; a fabricated one is not). The pre-existing unsourced-estimate rows for that state are removed/replaced, not retained.
- NASBO covers all 50 states + DC, so this is an edge case (a suppressed/blank cell in a given table-year), not the norm.

## P6 — Idempotency + write path
- Loader is **idempotent**: re-running for a loaded state-year makes no net change (find-or-update `data_sources`; RPC rebuilds the tree deterministically; source-stamp UPDATE is set-to-same).
- Write path = `treasury_sync_budget_tree` RPC (builds budget + depth-1 categories from jsonTree) **+ targeted source-stamp UPDATE**. Targeted writes only — never a full city re-sync.
- Pure helpers (tree-build, sum-validate, clamp, label) are unit-tested **offline** (no DB) so correctness is provable without touching production.

---

## Scope handed to later phases
- **Phase 95:** extend MN history + re-do OH/VA (currently false-sourced) under this policy.
- **Phase 96:** load the remaining states from NASBO; a robust NASBO-PDF auto-parser (vs verified per-state transcription) is a Phase-96 scaling concern.
- **Phase 97:** cohort verification + UAT (confirm 0-NULL source + basis labels across all nodes).
