# Phase 51: Comparability Notes + Source-Chain Verification + UAT — Context

**Gathered:** 2026-06-13 (inline scoping questions — no separate discuss-phase)
**Status:** Ready for planning
**Requirements:** CTX-02

<domain>
## Phase Boundary

Close out the v2.1 Federal History milestone: give historical years honest, sourced
comparability context (function/agency definition drift + the FY1976 Transition Quarter),
prove every backfilled figure resolves to a working official OMB source with zero residue,
spot-check representative years against the published tables, and get Chris's UAT sign-off.

**In scope:** comparability-notes content (sourced) + UI; source-chain audit across all
backfilled years; durability fixes for fragile source URLs; representative-year spot checks; UAT.

**Explicitly NOT this phase:** new data loads; per-taxpayer pre-2005 backfill (deferred —
optional future, see Phase 50 STATE notes); any FY2025/FY2026 changes.
</domain>

<decisions>
## Implementation Decisions (scoping questions, 2026-06-13)

- **D-01 — Detailed per-area drift notes.** Enumerate the *significant, citizen-relevant*
  function/agency definition changes and agency reorganizations across the decades (not an
  exhaustive academic catalog), each tied to an official source (OMB Historical Tables section
  notes + agency-establishment public laws via GovInfo/Congress.gov — reuse the Phase 47
  program-origins sourcing pattern). Plus a sourced FY1976 Transition Quarter explanation.
  **Every claim sourced — no model-memory text** (v2.0 ground rule).
- **D-02 — Fix fragile source URLs now ("zero residue").** Repoint the ~22,941 per-year
  disclosure-metric `source_url`s from the version-specific `outlays_fy2027.xlsx` to the stable
  `…/supplemental-materials/` page (won't 404 on the next OMB edition), and the ~30 FY2025
  metrics on raw `api.fiscaldata.treasury.gov` JSON (+ the version-specific IRS `.xlsx`) to human
  fiscaldata/IRS pages. DB updates + loader patches so re-runs stay durable.

### Claude's Discretion
- Notes placement: a compact, expandable note rendered on historical-year views (drift) and on
  the TQ view (transition-quarter explanation) — exact component/placement is the planner's call.
- How the comparability content is stored (committed JSON data file + loader/static import) —
  mirror the federal-enrichment.json pattern (inline-authored, sourced, $0).
</decisions>

<canonical_refs>
## Canonical References

### Source-chain
- `scripts/auditFederalSources.mjs` — the audit harness (Phase 48). Note: it writes results to
  `.planning/phases/48-…/` which was archived → exits 1 on the write; fix the output path. It
  inventories budgets→registry + every URL-bearing federal row (incl. federal_context_metrics).
- `scripts/loadFederalFunctions.js` / `loadFederalAgencies.js` — write the disclosure metrics whose
  `source_url` currently = `outlays_fy2027.xlsx` (the versioned file to repoint to the stable page).
- `scripts/loadFederalMTS.js` / `loadFederalAgencies.js` (MTS path) — the FY2025 metrics on raw API URLs.

### Comparability content + UI
- `src/components/federal/FederalLanding.tsx` — the TQ view currently renders a neutral heading (Phase 50); the TQ explanation lands here.
- `src/components/federal/MethodologyPanel.tsx` — existing federal disclosure/notes surface (analog for the comparability notes component).
- Phase 47 program-origins (`program_details`, GovInfo/Congress.gov sourcing) — the established pattern for sourcing agency-establishment facts.

### Source URLs verified (Phase 50)
- Stable OMB pages: `…/supplemental-materials/`, `…/historical-tables/` (both 200, human). fiscaldata dataset pages (debt/MTS/interest) 200.
</canonical_refs>

<specifics>
## Source-chain findings to resolve (from the live DB, 2026-06-13)
- 22,941 metrics → `https://www.whitehouse.gov/wp-content/uploads/2026/04/outlays_fy2027.xlsx` (version-specific → repoint to supplemental-materials page).
- 30 FY2025 metrics → `api.fiscaldata.treasury.gov/.../mts_table_5?...` (raw JSON → human page).
- 1 metric → `…/25db-1-02-nr.xlsx` (version-specific IRS file → IRS historical page).
- Budget→registry links: clean (human OMB / fiscaldata pages). ✓

## Spot-check years (success criterion 3)
FY1976, FY1990, FY2008, FY2024 — confirm loaded totals match OMB Hist 1.1 published outlays/receipts.
</specifics>

<deferred>
- Per-taxpayer pre-2005 + FY2024 returns sourcing (optional future; SOI `05in01an.xls` 1913–2005 needs `xlrd` + cross-series caveat).
</deferred>

---
*Phase: 51-comparability-notes-source-chain-verification-uat · Context 2026-06-13*
