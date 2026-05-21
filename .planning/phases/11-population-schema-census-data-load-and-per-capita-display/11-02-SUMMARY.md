---
phase: 11
plan: 02
subsystem: data-loading
tags: [census, population, supabase, typescript, ev-accounts]
requires: []
provides:
  - loadTXPopulation.js Census CSV loader (treasury-tracker)
  - population_year exposed in cities API (EV-Accounts)
affects:
  - "11-03: live DB execution of loadTXPopulation.js + API push"
  - "11-04: frontend per-capita display (consumes population_year)"
tech-stack:
  added: []
  patterns:
    - "Census CSV SUMLEV=162 filter + name normalization (strip city/town/village suffix)"
    - "Idempotent loader with --dry-run flag"
    - "CityRow pg-driver string types; TreasuryCity Number() coercion pattern"
key-files:
  created:
    - scripts/loadTXPopulation.js
  modified:
    - C:/EV-Accounts/backend/src/lib/treasuryService.ts
decisions:
  - "Dry-run exits at SUPABASE_KEY missing — acceptable for 11-02; 11-03 will execute with key"
  - "population_year typed as string|null in CityRow (pg driver returns INTEGER as string), Number()|null in TreasuryCity"
metrics:
  duration: "6 minutes"
  completed: "2026-05-21"
---

# Phase 11 Plan 02: Census TX Population Loader + EV-Accounts population_year API Exposure Summary

**One-liner:** Census TX population loader (loadTXPopulation.js) + EV-Accounts population_year API exposure via CityRow/TreasuryCity/mapCity/SQL edits

---

## Tasks Completed

| Task | Description | Repo | Commit |
|------|-------------|------|--------|
| 1 | Build loadTXPopulation.js | treasury-tracker | 2868e6a |
| 2 | Update EV-Accounts treasuryService.ts | EV-Accounts | 679fba3 |

---

## Task 1: loadTXPopulation.js

**File:** `C:/treasury-tracker/scripts/loadTXPopulation.js`
**Commit:** `2868e6a` (treasury-tracker)

### Dry-run output (successful parse, all 12 cities, all values match KNOWN_VALUES exactly — no warnings):

```
Using cached CSV.

City populations from Census 2024:
  Allen: 113,746
  Celina: 51,661
  Frisco: 235,208
  Garland: 250,431
  McKinney: 227,526
  Murphy: 21,109
  Plano: 293,286
  Princeton: 37,019
  Prosper: 44,503
  Richardson: 118,221
  Sachse: 33,008
  Wylie: 62,954

DRY RUN — no DB updates:
  DRY: would UPDATE Allen to population=113746, population_year=2024
  DRY: would UPDATE Celina to population=51661, population_year=2024
  DRY: would UPDATE Frisco to population=235208, population_year=2024
  DRY: would UPDATE Garland to population=250431, population_year=2024
  DRY: would UPDATE McKinney to population=227526, population_year=2024
  DRY: would UPDATE Murphy to population=21109, population_year=2024
  DRY: would UPDATE Plano to population=293286, population_year=2024
  DRY: would UPDATE Princeton to population=37019, population_year=2024
  DRY: would UPDATE Prosper to population=44503, population_year=2024
  DRY: would UPDATE Richardson to population=118221, population_year=2024
  DRY: would UPDATE Sachse to population=33008, population_year=2024
  DRY: would UPDATE Wylie to population=62954, population_year=2024
```

No sanity-check warnings. All 12 cities found with exact KNOWN_VALUES matches.

---

## Task 2: EV-Accounts treasuryService.ts

**File:** `C:/EV-Accounts/backend/src/lib/treasuryService.ts`
**Commit:** `679fba3` (EV-Accounts / master branch)

### population_year occurrences (grep count): 5

- `CityRow.population_year: string | null` (line ~121)
- `TreasuryCity.population_year: number | null` (line ~37)
- `mapCity() population_year: row.population_year !== null ? Number(row.population_year) : null` (line ~213)
- `getCities() SQL: m.population_year` (SELECT list)
- `getCityById() SQL: m.population_year` (SELECT list)

### Build result: exit 0, no TypeScript errors

```
> empowered-accounts-backend@0.1.0 build
> rm -rf dist && tsc
```

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Unpushed Commits (push happens in 11-03)

| Repo | Branch | Commit | Status |
|------|--------|--------|--------|
| treasury-tracker | main | 2868e6a | committed, NOT pushed |
| EV-Accounts | master | 679fba3 | committed, NOT pushed |
