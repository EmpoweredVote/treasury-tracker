# Phase 101: Revenue View + URL Robustness - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning
**Source:** Derived inline from a direct read of the frontend (`src/App.tsx`, `src/components/datasets/DatasetTabs.tsx`, `src/data/dataLoader.ts`) + a live probe of the production API — no discuss-phase/research subagent needed (the codebase + API answered every gray area). Per the v2.11 milestone constraint, executed inline.

<domain>
## Phase Boundary

Make the "Money In" card render the real revenue-by-source view on the 4 upgraded ACFR nodes (CA/TX/NY/FL), and harden `?dataset=revenue` deep-link resolution so it behaves correctly on both upgraded and remaining operating-only nodes — with no regression to normal in-app navigation.

**In scope:** the React frontend in `src/` only — the `DatasetTabs` "Money In" enablement (REVUX-01, verification) and the mount-time URL `?dataset=` param resolution in `App.tsx` (REVUX-02, the code fix). Build/typecheck + live-app manual verification across one upgraded node and one operating-only node.

**Out of scope:** any data loading (done in 99/100); the ev-accounts-api backend (separate repo — confirmed it already serves revenue, no change needed); independent re-derivation + full-cohort source-chain audit + UAT (Phase 102); new visual design / icicle drill-down behavior for flat revenue trees ([[project_flat_source_icicle_limitation]] — accepted, not this phase); any non-revenue dataset behavior.
</domain>

<decisions>
## Implementation Decisions (from inline code + API investigation)

### REVUX-01 — Money In renders real revenue view (verification-first)
- **D-01:** The frontend does NOT compute dataset availability — it consumes `selectedEntity.available_datasets` from the API. `availableDatasetTypes` (`src/App.tsx:177`) = the distinct `dataset_type`s present for the selected year. `DatasetTabs` (`src/components/datasets/DatasetTabs.tsx:96`) disables a card iff its id is not in `availableDatasets`. There is **no** revenue-specific render gate, no entity_type gate, and no hardcoded "operating-only placeholder" string — the "disabled placeholder" in the success criterion is simply the disabled card state.
- **D-02:** **Live production API (`https://ev-accounts-api.onrender.com/api/treasury/cities`) already returns `revenue` in `available_datasets`** for all 4 nodes with the exact revenue years loaded in 99/100 (NY 2015–2024, FL 2022–2024, CA 2020–2025, TX 2015–2024). The API derives availability live from `treasury.budgets` → **no backend/redeploy needed**; the Money In card auto-enables. **REVUX-01 is therefore primarily verification** (confirm it renders on the 4 nodes + stays disabled on NASBO-only nodes). Apply a code change ONLY if a concrete rendering gap surfaces during verification (e.g. the flat 1-level ACFR revenue tree, or NY's billions-scale total, mis-renders) — document any such fix.
- **D-03:** State ACFR revenue trees are flat (depth-1 leaves, `i:[]`) — clicking a leaf will not drill down. This is the accepted v2.8 flat-source limitation ([[project_flat_source_icicle_limitation]]), NOT a phase-101 defect. Do not try to fix drill-down here.

### REVUX-02 — `?dataset=revenue` deep-link robustness (the real code fix)
- **D-04:** **Bug:** on the mount deep-link path (`src/App.tsx` ~line 223), `datasetParam` is set via `setActiveDataset(datasetParam)` after validating only against the static list `['operating','revenue','salaries']` — it is NOT checked against the entity's actual available datasets for the resolved year. The availability guard that exists in `handleEntityChange` (the `effectiveDataset` computation, `App.tsx:399-402`) does **not** run on the mount path (mount uses `setSelectedEntity` directly, not `handleEntityChange`). Result: `?dataset=revenue` on an operating-only node (the 46 NASBO states) sets `activeDataset='revenue'` while `availableDatasetTypes` excludes revenue → a disabled-but-active card with `revenueData=null` → empty/broken view.
- **D-05:** **Fix:** resolve the requested dataset against the entity's available `dataset_type`s for the resolved year; if the requested dataset is not available, fall back to `'operating'` (mirroring the existing `effectiveDataset` guard). Extract a small shared pure helper (e.g. `resolveEffectiveDataset(entity, year, requested)`) and use it in BOTH the mount deep-link path and `handleEntityChange` so the two paths cannot drift. Year resolution is unchanged (yearParam if valid, else newest operating year, else newest entity year).
- **D-06:** **No regression to normal navigation.** The shared helper must reproduce `handleEntityChange`'s current behavior exactly (it already does this inline). The `syncURL` write path and normal entity/year/dataset switching must be unchanged. Upgraded-node deep-links (`?dataset=revenue` on CA/TX/NY/FL, whose resolved year has revenue) must continue to land on the revenue view.
- **D-07:** Keep the static `['operating','revenue','salaries']` membership check as a first guard (reject garbage params like `?dataset=foo`), THEN apply the availability check. Both layers.

### Process
- **D-08:** No UI-SPEC — there is no new visual design; this is enabling an already-built view + a routing guard. (Skip the plan-phase UI gate.)
- **D-09:** Verify by building (`npm run build` / typecheck) and running the dev app against the production API (`VITE_API_URL` already points at ev-accounts-api), checking: (a) Money In enabled + revenue-by-source renders on an upgraded node (e.g. New York, FY2024 ≈ $93.9B); (b) Money In disabled on a NASBO-only node; (c) `?dataset=revenue` deep-link lands on revenue for an upgraded node and falls back to operating (no empty card) on an operating-only node; (d) normal nav unaffected.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before implementing.**

- `src/App.tsx` — mount deep-link handler (~L200-231, the REVUX-02 fix site), `availableDatasetTypes` memo (L177), `handleEntityChange` `effectiveDataset` guard (L385-410, the pattern to share), `syncURL` (L57), dataset/year load effects (L300-335, L355-382), `DatasetTabs` render (L986-992).
- `src/components/datasets/DatasetTabs.tsx` — the card disable logic (`isDisabled = !available.includes(id)`, L96); "Money In" = revenue card (L31-35).
- `src/data/dataLoader.ts` — API client; `loadBudgetData` + `listMunicipalities` fetch from `${VITE_API_URL}/api/treasury/*`; the frontend consumes `available_datasets` from `/treasury/cities` (does not compute it).
- `.planning/REQUIREMENTS.md` — REVUX-01, REVUX-02.
- `.planning/ROADMAP.md` — Phase 101 entry (2 success criteria).
- `.planning/phases/100-…/100-0{2,3}-SUMMARY.md` — the loaded revenue datasets (years/totals) the Money In card now surfaces.
</canonical_refs>

<code_context>
## Existing Code Insights
- The whole frontend is API-driven (`src/data/dataLoader.ts`); production reads `https://ev-accounts-api.onrender.com` ([[feedback_app_url]]). No data lives in the frontend.
- `availableDatasetTypes` is year-scoped (filters available_datasets to the selected fiscal year) — this is the same year-gating that surprised the "Employees" card UAT historically; the REVUX-02 fix must respect it (validate dataset against the *resolved year's* availability).
- `handleEntityChange` already has the correct availability-fallback logic; the mount path is the one place missing it.
</code_context>

<specifics>
## Specific Ideas
- Verification anchors: New York FY2024 Money In ≈ $93.9B revenue-by-source (Taxes — Personal income, Miscellaneous, etc.); Florida FY2022 revenue shows the two clamped negatives at $0 with "(net loss — shown at 0)" labels.
- Operating-only fallback anchor: pick any NASBO-only state node (e.g. a state NOT in CA/TX/NY/FL/MN/OH/VA) and confirm `?dataset=revenue` falls back to operating with no empty card.
</specifics>

<deferred>
## Deferred Ideas
- Flat-revenue-tree drill-down / enrichment-on-leaf-click ([[project_flat_source_icicle_limitation]]) — accepted limitation, not this phase.
- Full independent re-derivation + 50-node cohort source-chain audit + live UAT sign-off → Phase 102.
</deferred>

---

*Phase: 101-revenue-view-url-robustness*
*Context gathered: 2026-06-29 (inline code read + live API probe)*
