---
phase: 58
plan: "58-03"
subsystem: frontend/disclosure
tags: [basis-note, comparability, sourcing, honesty, long-beach, west-hollywood]
dependency_graph:
  requires: [58-01]
  provides: [basis-note-disclosure, D-08-implemented]
  affects: [src/App.tsx, src/data/cityBasisNotes.ts]
tech_stack:
  added: []
  patterns: [ComparabilityNote-reuse, additive-gate-pattern, curated-sourced-data-module]
key_files:
  created:
    - src/data/cityBasisNotes.ts
  modified:
    - src/App.tsx
decisions:
  - "Curated-entry gate (not data-driven): frontend has no per-year data_source; the map authored only for genuinely-mixed cities is sufficient and accurate"
  - "Render site: sibling of PlainLanguageSummary in the navigation-top-level block (not inside it), additive IIFE pattern"
  - "ComparabilityNote reused unchanged from federal Phase 51 pattern"
metrics:
  duration: "25min"
  completed: "2026-06-16"
  tasks_completed: 3
  files_changed: 2
---

# Phase 58 Plan 03: Per-city basis note (basis-change disclosure) Summary

**One-liner:** Sourced expandable basis-change note (ComparabilityNote + SourceChip) rendered for Long Beach and West Hollywood only, gated by a curated cityBasisNotes map keyed to the two D-04 mixed-basis cities; absent entry renders nothing, leaving all other city/county/federal pages unchanged.

## What Was Built

### Task 01 — Pattern confirmation + gate strategy

Confirmed the analog pattern and data-path before writing:

- **Render site:** `PlainLanguageSummary` area in App.tsx — the non-federal, top-level dashboard block (inside `navigationPath.length === 0 && !isCountyDirectoryOnly`). The basis note is a **sibling** of the `PlainLanguageSummary`/`FederalLanding` ternary, rendered after it.
- **Component reuse:** `ComparabilityNote` (Phase 51) + `SourceChip` — imported in App.tsx already; no new visual design needed.
- **Per-year basis gate:** Frontend does NOT have per-year `data_source` / basis. `BudgetData.metadata.dataSource` is a single string for the whole budget load. Decision: **curated-entry gate alone** — entries authored only for Long Beach and West Hollywood (the two D-04 layered cities), which makes the gate accurate by construction.
- **Key**: `"${entity.name}|${entity.state}"` — e.g. `"Long Beach|CA"`.

### Task 02 — `src/data/cityBasisNotes.ts` (new file)

Exports `cityBasisNotes: Record<string, CityBasisNote>` with entries ONLY for:

- **Long Beach|CA:** 1-entry note explaining that FY2003–2024 figures are SCO all-governmental-funds (General Fund + enterprise funds + debt service + all city funds) while FY2025–2026 are the city's published General Fund budget (core city services only). Source: CA State Controller ByTheNumbers Expenditures, https://bythenumbers.sco.ca.gov/d/ju3w-4gxp, fetched 2026-06-16.
- **West Hollywood|CA:** Analogous note — FY2003–2024 SCO all-governmental-funds vs FY2018–2026 Demand Register transaction data. Same source + date.

No entry for Los Angeles, Burbank, any pure-SCO city, any county, or any federal entity.

### Task 03 — App.tsx wire-up + build verification

- Added `import { cityBasisNotes } from './data/cityBasisNotes'` to App.tsx.
- Placed an IIFE lookup block after the `PlainLanguageSummary`/`FederalLanding` ternary (inside `navigationPath.length === 0 && !isCountyDirectoryOnly`):
  - Looks up `cityBasisNotes[\`${selectedEntity.name}|${selectedEntity.state}\`]`
  - If present: renders `<ComparabilityNote title="Note: budget history spans two reporting bases" intro={...} entries={[...]} />`
  - If absent: returns `null` — nothing renders
- `npm run build` passes: `tsc -b` + `vite build` complete with 0 type errors, 2320 modules transformed.

## Rendered Text (for Plan 58-04 reference)

**Title (collapsed):** "Note: budget history spans two reporting bases" (expandable panel, `+` indicator)

**Long Beach expanded content:**
- Intro: "Budget figures for earlier years and recent years come from different reporting bases. Totals are not directly comparable across that seam."
- Entry heading: "Years shown on different reporting bases"
- Entry text: "FY2003–2024 figures are drawn from the CA State Controller ByTheNumbers all-governmental-funds dataset — a comprehensive view that includes the General Fund, enterprise funds, debt service, and all other city funds. FY2025–2026 figures are from the city's published General Fund budget, which covers core city services only. Because the scope of funds differs, a year-over-year comparison across this boundary will reflect the basis change, not a real spending change."
- SourceChip: "CA State Controller — ByTheNumbers Expenditures ↗" → https://bythenumbers.sco.ca.gov/d/ju3w-4gxp

**West Hollywood expanded content:**
- Intro: same as Long Beach
- Entry heading: "Years shown on different reporting bases"
- Entry text: "FY2003–2024 figures are drawn from the CA State Controller ByTheNumbers all-governmental-funds dataset... FY2018–2026 figures are from the city's Demand Register transaction data, which reflects actual expenditure transactions rather than an adopted budget appropriation and covers the city's operating activity. Because the scope and methodology differ, a year-over-year comparison across this boundary will reflect the basis change, not a real spending change."
- SourceChip: same as Long Beach

## Verification Gate Status

| Check | Status | Detail |
|-------|--------|--------|
| Long Beach shows note | Expected PASS | Entry `Long Beach|CA` exists in map |
| West Hollywood shows note | Expected PASS | Entry `West Hollywood|CA` exists in map |
| Burbank shows NO note | Expected PASS | No entry in map |
| Los Angeles shows NO note | Expected PASS | No entry in map |
| County pages unchanged | PASS by construction | `isCountyDirectoryOnly` gate excludes county-directory pages; county budget pages excluded because no entry in map |
| Federal pages unchanged | PASS by construction | Federal uses FederalLanding block, not the PlainLanguageSummary block; also no entry in map |
| `npm run build` | PASS | 0 type errors, tsc -b + vite build |

Live-app visual verification (screenshots/UAT) is Plan 58-04.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 02 — cityBasisNotes data module | 584c165 | src/data/cityBasisNotes.ts (new, 92 lines) |
| 03 — App.tsx wire-up | ab77a33 | src/App.tsx (+22 lines) |

## Deviations from Plan

None — plan executed exactly as written.

Task 01 was an analysis task (no code output); the findings confirmed the plan's approach:
- render site = PlainLanguageSummary area ✓
- component = ComparabilityNote + SourceChip ✓
- gate = curated-entry only (no per-year basis available in frontend) ✓

## Threat Flag Compliance (T-58-03)

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unsourced prose | Every entry carries source_name + source_url + source_date; SourceChip renders on expand | MITIGATED |
| Note on wrong city | Map has exactly 2 entries (LB + WeHo); lookup by name|state; absent = null | MITIGATED |
| Regression on unaffected pages | Additive IIFE pattern; no entry = null returned; existing gate prevents county/federal | MITIGATED |

## Self-Check: PASSED

- `src/data/cityBasisNotes.ts` exists: confirmed (created, 92 lines)
- `src/App.tsx` modified: confirmed (import + IIFE block added)
- Commit 584c165 exists: confirmed (`git log` shows feat(58-03) commit)
- Commit ab77a33 exists: confirmed (`git log` shows feat(58-03) wire-up commit)
- `npm run build` passed: confirmed (tsc -b + vite build, 0 errors)
