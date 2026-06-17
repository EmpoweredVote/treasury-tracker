---
phase: 66-socal-enrichment-parity
plan: "66-01"
subsystem: data-enrichment
tags: [socal, category-enrichment, inline-zero-cost, universal, bleed-safe, salaries, ENR-03]
dependency_graph:
  requires:
    - phase: 61
      provides: CONCEPTS library + resolver + universal CA op/rev/salary enrichment baseline
    - phase: 63
      provides: the 95 SoCal cities whose categories are enriched
    - phase: 65
      provides: the SoCal salary departments (categories) being enriched
  provides: [socal-categories-enriched-to-parity]
  affects: [Phase-67-acfr-uat]
tech_stack:
  added: []
  patterns: [live-derived-worklist, concept-library-resolver, inline-zero-cost-enrichment, bleed-safe-universal-rows, idempotent-upsert]
key_files:
  created:
    - data/socalEnrichment66.mjs
    - scripts/loadSoCalEnrichment66.mjs
    - data/socal-enrichment-66.expanded.json
    - .planning/phases/66-socal-enrichment-parity/66-01-SUMMARY.md
  modified: []
key_decisions:
  - "Residual-only: Phase 61's universal rows already cover SoCal op/rev 100% (0 uncovered) and most salary depts; only the salaries residual needed authoring"
  - "All-years worklist (corrected): the latest-FY sample undercounted (27); the true uncovered >=2-city set across ALL years is 185 — department naming varies by year and the app renders every year"
  - "Authored 185 universal (municipality_id NULL) rows via the reused Phase 61 resolver: 157 keyword-route + 22 generic exact-override (SOCAL_EXACT) + 6 general_dept fallback; 0 $-leaks"
  - "Bleed-safe (D-02): every authored row is generic (no $ figures, no city names); universal rows render identical text for every city by construction → no cross-city bleed ([[project_enrichment_scoping_fix]])"
  - "Deferred: 3,489 single-city salary dept-name tail (Phase 61 precedent — self-explanatory, low value)"
  - "Live-derived worklist makes the loader self-contained + reproducible; idempotent upsert on (name_key, municipality_id); $0 (paid enrichCategories.js NOT run)"
requirements-completed: [ENR-03]
duration: "~1 session"
completed: "2026-06-17"
---

# Phase 66 Plan 01: SoCal Enrichment Parity — Summary

**ENR-03 satisfied: the parity-loaded SoCal categories are enriched to the OC/LA baseline — operating + revenue arrived already 100% covered by Phase 61's universal rows, and the 185 uncovered salary departments shared by ≥2 SoCal cities (across all years) were authored inline at $0 as bleed-safe universal rows. After authoring, 0 categories shared by ≥2 SoCal cities remain uncovered across operating, revenue, AND salaries.**

## Performance
- **Duration:** ~1 session | **Completed:** 2026-06-17 | **Tasks:** 3/3 | **Files modified:** 3 created (data + loader)

## Accomplishments

### Task 1 — Residual gap analysis
Read-only probe (production, schema treasury) over the 95 SoCal cities vs the full `category_enrichment` universal name_key set (paginated past the 1000-row cap). Found: **operating 0 uncovered, revenue 0 uncovered** (Phase 61's universal rows already cover the statewide SCO taxonomy), **salaries the only residual**. A first latest-FY-only sample showed 27 ≥2-city; widening to **all years** (department naming varies by year; the app renders every year) revealed the true residual: **185 uncovered ≥2-city salary departments + 3,489 single-city** (deferred).

### Task 2 — Author + upsert ($0, bleed-safe)
Built `data/socalEnrichment66.mjs` (SOCAL_EXACT overrides) + `scripts/loadSoCalEnrichment66.mjs` (derives the worklist LIVE from the DB, resolves via the reused Phase 61 `CONCEPTS`/`ROUTE_RULES`/`EXPLICIT_ROWS`). Resolution of the 185: **157 keyword-route + 22 generic exact-override + 6 general_dept fallback** (the 6 are ambiguous/position-level — "comm", "management", "executive assistant", "office specialist", "development service", "quality of life" — for which the generic "City Department" row is the honest, bleed-safe choice). **0 `$`-figure leaks.** Dry-run reviewed, then `--apply` idempotently upserted **185 universal rows** (municipality_id NULL) into `treasury.category_enrichment`. The paid `enrichCategories.js` (Anthropic) was NOT run — **$0**.

### Task 3 — Verify coverage + bleed-safety
- **Coverage (all years):** uncovered ≥2-city = **0** for operating, revenue, AND salaries. Universal enrichment name_keys grew 604 → **789** (+185).
- **Bleed-safety:** authored rows are generic with no `$`-figures (`water treatment`→"Water Utility", `fire operations`→"Fire & EMS", `patrol`→"Police", `human resources department`→"Human Resources"). Because the authored rows are universal (`municipality_id IS NULL`), they resolve to **identical** text for every city via the two-tier fallback join — there is no per-city text that could bleed across cities ([[project_enrichment_scoping_fix]] guards against the inverse — a city-specific record left NULL — which did not occur here).

## Verification

| Must-have | Result |
|-----------|--------|
| All SoCal op/rev/salaries categories have plain-language enrichment | ✅ op/rev 100% (Phase 61); salaries ≥2-city residual authored → 0 uncovered ≥2-city |
| Hybrid + bleed-safe (no city text in universal rows) | ✅ 185 generic universal rows, 0 $-leaks, identical-per-city by construction |
| Authored inline at ~$0 (no paid AI) | ✅ enrichCategories.js not run; CONCEPTS-resolver authoring |
| Single-city tail documented as deferred | ✅ 3,489 deferred (Phase 61 precedent) |

## Deviations
- **Worklist widened to all years (corrective):** the initial latest-FY sample found 27; verification exposed more, so the loader was refactored to derive the worklist **live across all years** → the true 185. This is why the loader queries the DB itself rather than a hardcoded list — self-contained + reproducible.
- **Committed data files force-added:** `data/` is gitignored (`/data/*`), so the authoring artifacts were `git add -f`'d, matching how Phase 61's `data/caParityEnrichment61*.mjs` are tracked.
- Executed inline on the main working tree (production DB; needs `.env`).

## ENR-03 — SATISFIED
SoCal categories are enriched to parity (op/rev already covered + 185 salary-dept universal rows authored), bleed-safe, inline at $0; single-city salary tail deferred. Verified: 0 uncovered ≥2-city across all three datasets.
