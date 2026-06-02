---
phase: 23-or-all-funds-consistency-requirements-extraction-portland-gr
plan: "04"
subsystem: frontend
tags: [all-funds, budget-display, plain-language, dataset-types, OR-cities]
dependency_graph:
  requires: ["23-01", "23-02", "23-03"]
  provides: ["all_funds_requirements frontend display", "gap-explanation label", "headline override"]
  affects: ["src/types/budget.ts", "src/App.tsx", "src/components/dashboard/PlainLanguageSummary.tsx"]
tech_stack:
  added: []
  patterns: ["optional prop gating", "Promise.all fourth promise", "useMemo filter exclusion"]
key_files:
  created: []
  modified:
    - src/types/budget.ts
    - src/App.tsx
    - src/components/dashboard/PlainLanguageSummary.tsx
decisions:
  - "Gap-explanation label gated on allFundsRequirementsData.totalBudget > operatingData.totalBudget to prevent negative remainder display"
  - "all_funds_requirements filtered from availableDatasetTypes useMemo so it never renders as a selectable tab card (Pitfall 4)"
  - "operatingTotal prop to DatasetTabs prefers allFundsRequirementsData total when present so Money Out card shows all-funds figure"
metrics:
  duration: "~12 minutes"
  completed: "2026-06-02T03:36:37Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
---

# Phase 23 Plan 04: Frontend All Funds Requirements Display Summary

**One-liner:** All Funds Requirements headline override and gap-explanation label wired end-to-end for OR cities via data-driven allFundsRequirementsData prop — TX/CA cities unchanged.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend dataset_type union + wire App.tsx | 7e1ef8a | src/types/budget.ts, src/App.tsx |
| 2 | PlainLanguageSummary headline override + gap label | d7d3868 | src/components/dashboard/PlainLanguageSummary.tsx |
| 3 | Human-verify in app | — | checkpoint: awaiting human approval |

## What Was Built

### Task 1: src/types/budget.ts + src/App.tsx

Extended the `dataset_type` union in `available_datasets` to include `'all_funds_requirements'`. In App.tsx:

- Added `allFundsRequirementsData` state alongside `operatingBudgetData`/`revenueData`/`salariesData`
- Added `hasAllFundsRequirements` detection in the info-cards useEffect
- Added a fourth promise in the `Promise.all` block to load `all_funds_requirements` data when available
- Filtered `'all_funds_requirements'` out of `availableDatasetTypes` useMemo so it never appears as a selectable tab card
- Changed `DatasetTabs` `operatingTotal` prop to prefer `allFundsRequirementsData?.metadata.totalBudget` (falls back to `operatingBudgetData?.metadata.totalBudget` for TX/CA cities)
- Passed `allFundsRequirementsData={allFundsRequirementsData}` to `PlainLanguageSummary`

### Task 2: PlainLanguageSummary.tsx

- Added optional `allFundsRequirementsData?: BudgetData | null` to `PlainLanguageSummaryProps` interface
- Changed `budgetedTotal` to `allFundsRequirementsData?.metadata.totalBudget ?? operatingData.metadata.totalBudget` — headline shows all-funds total when present
- Added gap-explanation paragraph after the main budget sentence, gated on:
  - `allFundsRequirementsData` is non-null
  - `allFundsRequirementsData.metadata.totalBudget > operatingData.metadata.totalBudget`
  - Shows: all-funds total, departmental operating subset, and remainder; uses existing `formatAmount` helper (handles billion-scale for Portland ~$8.6B)

## Verification

- `npx tsc --noEmit` exits 0 after both tasks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The allFundsRequirementsData prop is wired to real DB data loaded by plans 23-01 through 23-03.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. The new prop is read-only data display.

## Self-Check

- [x] `src/types/budget.ts` exists and contains `'all_funds_requirements'` in union
- [x] `src/App.tsx` contains `allFundsRequirementsData`, `hasAllFundsRequirements`, fourth Promise.all entry, filter, operatingTotal override, and prop pass
- [x] `src/components/dashboard/PlainLanguageSummary.tsx` contains interface prop, destructured param, headline override, gap-explanation paragraph with correct guard and remainder calculation
- [x] Commits 7e1ef8a and d7d3868 exist in git log
- [x] `npx tsc --noEmit` exits 0

## Self-Check: PASSED
