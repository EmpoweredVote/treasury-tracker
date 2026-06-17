---
phase: 63-socal-county-cities-load-linking
plan: "63-02"
subsystem: database
tags: [socal, san-bernardino, sco, bythenumbers, city-load, county-link, fy2003-2024, never-overwrite, per-capita]
dependency_graph:
  requires:
    - phase: 58
      provides: hardened-bulk-loader + seedCountyLinks pipeline (county-name-parameterized)
  provides: [san-bernardino-county-cities-op-rev-history, san-bernardino-county-node, county-id-links]
  affects: [Phase-64-county-gov-budgets, Phase-65-salaries, Phase-66-enrichment, Phase-67-acfr-uat]
tech_stack:
  added: []
  patterns: [db-probe-verification, dry-run-gate, never-overwrite-guard, per-fy-retry-loop]
key_files:
  created:
    - .planning/phases/63-socal-county-cities-load-linking/63-02-SUMMARY.md
  modified: []
key_decisions:
  - "Dry-run gate (D-06): --dry-run reported 24 San Bernardino cities, 0 skipped — no custom-source conflicts"
  - "Live load: operating 526 + revenue 526 = 1052 rows; FY range 2003-2024; 24 cities"
  - "Source attribution (D-07): all 1052 rows carry the durable /d/ ByTheNumbers source_url + source_date 2026-06-17; NULL source_url = 0"
  - "Linking (D-04): San Bernardino County node created/reused (a91c968c-fee4-406b-83d0-2aaeb804d1cb); all 24 cities linked; 0 mislinked, 0 missing"
  - "Per-capita: all 24 linked cities have population > 0"
  - "SCO API flakiness: bythenumbers.sco.ca.gov intermittently connect-timed-out mid-run; completed via a per-FY shell retry loop driving the unchanged loader (orchestration only, zero new code per D-03). FY2005/FY2006 needed a second pass"
  - "D-08/D-09: production Treasury DB only, $0 spend (free SCO source, no AI)"
requirements-completed: [SOCAL-02]
duration: "~25min (SCO retries)"
completed: "2026-06-17"
---

# Phase 63 Plan 02: San Bernardino County Cities Load + Linking Summary

**SOCAL-02 satisfied: all 24 San Bernardino County cities the SCO feed reports have operating + revenue loaded for FY2003–2024 (1052 rows, every row durably /d/-sourced, per-year population), and all 24 are linked via county_id to the San Bernardino County node.**

## Performance

- **Duration:** ~25 min (extended by SCO API connect-timeout retries)
- **Completed:** 2026-06-17
- **Tasks:** 3/3 (dry-run enumerate → live load → seed/link + verify)
- **Files modified:** 0 source files (DB rows + this SUMMARY only)

## Accomplishments

### Task 1 — Dry-run enumerate (no writes)
`bulkLoadStateController.js --county "San Bernardino" --fy 2003…2024 --dry-run` reported a stable **24 cities**, **0 skipped** across every FY/dataset (early years 23, incorporation timeline). No custom-source conflicts. Cohort: Adelanto, Apple Valley, Barstow, Big Bear Lake, Chino, Chino Hills, Colton, Fontana, Grand Terrace, Hesperia, Highland, Loma Linda, Montclair, Needles, Ontario, Rancho Cucamonga, Redlands, Rialto, San Bernardino, Twentynine Palms, Upland, Victorville, Yucaipa, Yucca Valley.

### Task 2 — Live load operating + revenue FY2003–2024
The SCO ByTheNumbers API (`bythenumbers.sco.ca.gov`) was intermittently unreachable (`ConnectTimeoutError`, ~1/3 success rate), and the loader aborts on any single failed fetch. Rather than modify the loader (zero-new-code, D-03), the load was driven **per fiscal year inside a shell retry loop** — each year = 2 SCO fetches, retried up to 8× until clean. 20/22 years loaded on the first pass; FY2005 + FY2006 completed on a follow-up pass. Final: **operating 526 + revenue 526 rows**, 0 never-overwrite skips (no custom-source cities in this county).

### Task 3 — Seed/link county + verify
- `seedCountyLinks.js --county "San Bernardino"` reused the **San Bernardino County** node (`a91c968c-fee4-406b-83d0-2aaeb804d1cb`). **Linked all 24** cities; 0 already-linked, 0 linked-to-another-county, 0 not-yet-in-DB.
- Read-only production probe (schema `treasury`, service key):
  - San Bernardino-linked cities: **24**
  - operating rows: **526**, revenue rows: **526**, total **1052**
  - SCO-sourced (/d/): op **526**, rev **526**; **NULL source_url = 0**
  - FY range: **2003 – 2024**
  - cities with population > 0: **24 / 24**

## Verification

| Must-have | Result |
|-----------|--------|
| Op+rev loaded FY2003–2024 for every SCO SB city, durably sourced + per-year pop | ✅ 1052 rows, all /d/-sourced, all cities pop>0 |
| Never-overwrite preserved any custom-source city | ✅ N/A — 0 custom-source cities, 0 skips |
| All loaded cities linked via county_id to San Bernardino County | ✅ 24/24 linked to a91c968c… |
| Read-only verification, production DB only, $0 | ✅ probes read-only, prod DB, free SCO source, no AI |

## Deviations

- **SCO API instability → per-FY retry orchestration.** The upstream feed connect-timed-out repeatedly mid-run. Worked around by invoking the unchanged loader one fiscal year at a time inside a bash retry loop (orchestration only — no source-code change, files_modified stays []). This is a runbook-supported invocation form (per-FY `--fy` is documented). Adopt for the remaining counties while SCO is flaky.
- Executed **inline on the main working tree** (D-05; subagent dispatch hit a session limit earlier).

## SOCAL-02 — SATISFIED

San Bernardino County cities loaded (op+rev, FY2003–2024, SCO-sourced, per-year population) + linked to the county node; verified read-only against production; $0 spend.
