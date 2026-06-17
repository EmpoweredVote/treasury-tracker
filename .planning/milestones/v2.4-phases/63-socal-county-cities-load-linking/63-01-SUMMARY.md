---
phase: 63-socal-county-cities-load-linking
plan: "63-01"
subsystem: database
tags: [socal, riverside, sco, bythenumbers, city-load, county-link, fy2003-2024, never-overwrite, per-capita]
dependency_graph:
  requires:
    - phase: 58
      provides: hardened-bulk-loader + seedCountyLinks pipeline (county-name-parameterized)
  provides: [riverside-county-cities-op-rev-history, riverside-county-id-links]
  affects: [Phase-64-county-gov-budgets, Phase-65-salaries, Phase-66-enrichment, Phase-67-acfr-uat]
tech_stack:
  added: []
  patterns: [db-probe-verification, dry-run-gate, never-overwrite-guard]
key_files:
  created:
    - .planning/phases/63-socal-county-cities-load-linking/63-01-SUMMARY.md
  modified: []
key_decisions:
  - "Dry-run gate (D-06): --dry-run --list-cities first reported 28 Riverside cities, 0 skipped — cohort enumerated before any write"
  - "Live load: operating 587 + revenue 585 = 1172 rows across linked cities; FY range 2003-2026 (2025/2026 from Riverside's custom GF budget)"
  - "Never-overwrite (D-10): Riverside city's custom 'General Fund Operating Budget' FY2023 + FY2024 preserved (1 op skip each); custom rows untouched"
  - "Source attribution (D-07): all 1168 SCO rows carry the durable /d/ ByTheNumbers source_url + source_date 2026-06-17; NULL SCO source_url = 0 (the 4 NULL-url rows are the preserved custom Riverside rows)"
  - "Linking (D-04): 27 cities newly linked + Riverside already linked = 28 cities under existing Riverside County node e4906055-017e-4fde-af87-878760301c65; 0 mislinked, 0 missing-from-DB"
  - "Per-capita: all 28 linked cities have population > 0"
  - "D-08/D-09: production Treasury DB only, $0 spend (free SCO source, no AI)"
requirements-completed: [SOCAL-01]
duration: "~10min"
completed: "2026-06-17"
---

# Phase 63 Plan 01: Riverside County Cities Load + Linking Summary

**SOCAL-01 satisfied: every Riverside County city the SCO ByTheNumbers feed reports (28) has operating + revenue loaded for FY2003–2024 (durably /d/-sourced, per-year population), the never-overwrite guard preserved Riverside city's custom General Fund budget, and all 28 cities are linked via county_id to the existing Riverside County node.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-06-17
- **Tasks:** 3/3 (dry-run enumerate → live load → seed/link + verify)
- **Files modified:** 0 source files (DB rows + this SUMMARY only)

## Accomplishments

### Task 1 — Dry-run enumerate (no writes)
`bulkLoadStateController.js --county "Riverside" --fy 2003…2024 --dry-run --list-cities` reported a stable **28 cities**, **0 skipped** across every FY/dataset. Early years carry fewer cities (24 in FY2003) reflecting incorporation dates; reaches 28 by ~FY2012. Cohort (alphabetical): Banning, Beaumont, Blythe, Calimesa, Canyon Lake, Cathedral City, Coachella, Corona, Desert Hot Springs, Eastvale, Hemet, Indian Wells, Indio, Jurupa Valley, La Quinta, Lake Elsinore, Menifee, Moreno Valley, Murrieta, Norco, Palm Desert, Palm Springs, Perris, Rancho Mirage, Riverside, San Jacinto, Temecula, Wildomar.

### Task 2 — Live load operating + revenue FY2003–2024
`bulkLoadStateController.js --county "Riverside" --fy 2003…2024 --source-date 2026-06-17`. Operating + revenue both loaded by default. The **never-overwrite guard fired exactly as designed**: Riverside city's existing custom *General Fund Operating Budget* for FY2023 and FY2024 was **preserved** (1 operating skip each year), all other rows loaded. No errors.

### Task 3 — Seed/link county + verify
- `seedCountyLinks.js --county "Riverside"` reused the existing **Riverside County** node (`e4906055-017e-4fde-af87-878760301c65`). **Linked 27** new cities; **Riverside** already linked → **28 total**. 0 linked-to-another-county, 0 not-yet-in-DB.
- Read-only production probe (schema `treasury`, service key):
  - Riverside-linked cities: **28**
  - operating rows: **587**, revenue rows: **585**, total **1172**
  - SCO-sourced (/d/) rows: **1168**; **NULL SCO source_url = 0** (the 4 NULL-url rows are the preserved custom Riverside rows)
  - FY range: **2003 – 2026** (2025/2026 from Riverside's custom GF budget)
  - cities with population > 0: **28 / 28** (per-capita ready)

## Verification

| Must-have | Result |
|-----------|--------|
| Op+rev loaded FY2003–2024 for every SCO Riverside city, durably sourced + per-year pop (D-02, D-07) | ✅ 1172 rows, 1168 /d/-sourced, all cities pop>0 |
| Never-overwrite preserved custom-source city budget (D-10) | ✅ Riverside GF Operating FY2023/2024 preserved |
| All loaded cities linked via county_id to Riverside County node; breadcrumb/Cities-in-County render (D-04) | ✅ 28 cities linked to e4906055… |
| Read-only verification, production DB only, $0 (D-08, D-09) | ✅ probes read-only, prod DB, free SCO source, no AI |

## Deviations

None. Ran the runbook (Steps 1–2) with zero new code, exactly per the plan. Executed **inline on the main working tree** (not a worktree) because the loader requires the gitignored `.env` and writes to the shared production DB (D-05) — and because the first subagent dispatch hit a session limit, so the orchestrator completed the work inline to conserve tokens.

## SOCAL-01 — SATISFIED

Riverside County cities loaded (op+rev, FY2003–2024, SCO-sourced, per-year population) + linked to the county node; custom-source data preserved; verified read-only against production; $0 spend.
