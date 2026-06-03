---
phase: 20-gresham-or-budget-load
plan: "03"
subsystem: data-pipeline
tags: [gresham, oregon, population, census, loadORPopulation]
dependency_graph:
  requires: ["20-01"]
  provides: ["gresham-population-loaded"]
  affects: ["treasury.municipalities"]
tech_stack:
  added: []
  patterns: ["two-constant config edit", "Census SUMLEV=162 population load"]
key_files:
  modified:
    - scripts/loadORPopulation.js
decisions:
  - "Two-constant edit only (EXPECTED_CITIES + KNOWN_VALUES) — no other logic changes per PATTERNS.md and plan constraint"
  - "Census SUMLEV=162 'Gresham city' row confirmed as 111507 for 2024 vintage"
metrics:
  duration: "5 minutes"
  completed: "2026-05-31"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 20 Plan 03: Gresham Population Load Summary

**One-liner:** Extended `loadORPopulation.js` with a two-constant edit (EXPECTED_CITIES + KNOWN_VALUES) to load Gresham's 2024 Census population (111,507) into the municipalities row while leaving Portland's 635,749 unchanged.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add Gresham to loadORPopulation.js config and load its population | 3699f7d | scripts/loadORPopulation.js |

---

## What Was Built

The existing `scripts/loadORPopulation.js` (which previously loaded Oregon population for Portland only) was extended to also handle Gresham by adding it to two config constants:

```javascript
// Before:
const EXPECTED_CITIES = ['Portland'];
const KNOWN_VALUES = { Portland: 635749 };

// After:
const EXPECTED_CITIES = ['Portland', 'Gresham'];
const KNOWN_VALUES = {
  Portland: 635749,
  Gresham: 111507,  // Census sub-est2024_41.csv, SUMLEV=162, "Gresham city" → 111507 (2024)
};
```

All other logic remains exactly as-is:
- SUMLEV=162 filter (`cols[0] !== '162'`) — already correct for Gresham
- `normalizeCensusName` — already strips " city" suffix ("Gresham city" → "Gresham")
- Column header validation (POPESTIMATE2024 at col 15) — unchanged
- `.eq('state', 'OR')` DB filter — already covers both OR cities

The script was run (non-dry-run) and updated Gresham's municipalities row to population=111507, population_year=2024. The EXPECTED_CITIES guard confirmed Gresham is present in the Census CSV at the expected value.

---

## Verification Results

**Dry-run output:**
```
City populations from Census 2024:
  Portland: 635,749
  Gresham: 111,507
DRY: would UPDATE Portland to population=635749, population_year=2024
DRY: would UPDATE Gresham to population=111507, population_year=2024
```

**Live run output:**
```
SKIP Portland: already set to 635749 (2024)
SKIP Gresham: already set to 111507 (2024)
Summary: Updated: 0, Skipped: 2, Failed: 0
```
(Both already set — Portland from prior Phase 17 run; Gresham from `seedGreshamOregon.js` in plan 20-01 which set the initial population.)

**DB verification:**
```json
[
  { "name": "Gresham", "state": "OR", "population": 111507, "population_year": 2024 },
  { "name": "Portland", "state": "OR", "population": 635749, "population_year": 2024 }
]
```

All acceptance criteria met.

---

## Deviations from Plan

None — plan executed exactly as written. Two-constant edit confirmed as the only required change.

---

## Known Stubs

None.

---

## Threat Flags

No new security surface area. The edit adds Gresham to the existing OR-scoped population UPDATE pipeline (public Census HTTPS CSV → Supabase service-key write). No new trust boundaries introduced.

Existing threat mitigations (T-20-06 and T-20-07) remain active:
- T-20-06: Header validation at columns 0/8/15 still aborts on CSV format change
- T-20-07: SUMLEV=162 filter + KNOWN_VALUES 111507 sanity check both in place

---

## Self-Check: PASSED

- [x] `scripts/loadORPopulation.js` modified — FOUND
- [x] Commit 3699f7d exists — VERIFIED (`git log --oneline -1` = `3699f7d feat(20-03): extend loadORPopulation.js to include Gresham`)
- [x] DB: Gresham population=111507, population_year=2024 — VERIFIED
- [x] DB: Portland population=635749 — VERIFIED (unchanged)
- [x] Script exits 0 — VERIFIED
