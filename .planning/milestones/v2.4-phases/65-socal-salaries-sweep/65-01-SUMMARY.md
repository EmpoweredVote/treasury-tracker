---
phase: 65-socal-salaries-sweep
plan: "65-01"
subsystem: database
tags: [socal, salaries, gcc, government-compensation, fy2009-2024, sweep, never-overwrite, reconciliation, per-county]
dependency_graph:
  requires:
    - phase: 60
      provides: sweepCASalaries.js statewide sweep tool + reconciliation method
    - phase: 63
      provides: the 95 SoCal cities the salaries attach to
  provides: [socal-cities-gcc-salaries-2009-2024]
  affects: [Phase-66-enrichment, Phase-67-acfr-uat]
tech_stack:
  added: []
  patterns: [db-probe-verification, dry-run-coverage-gate, never-overwrite-guard, independent-source-reaggregation-reconcile, production-target-assertion]
key_files:
  created:
    - .planning/phases/65-socal-salaries-sweep/65-01-SUMMARY.md
  modified: []
key_decisions:
  - "Production-target hard gate (D-04): asserted SUPABASE_URL host = kxsdzaojfaibhuzmclfq.supabase.co before any write (local salary state is stale)"
  - "Dry-run coverage gate (D-05): cohort confirmed = 95 cities (28/24/18/10/8/7), per-city/year GCC coverage + gaps read before writing; 0 different-source rows to preserve"
  - "Live sweep: 1,510 city-year salaries rows written across the 6 counties (additive, dataset_type='salaries' only — operating/revenue untouched); 0 download failures, all on attempt 1"
  - "Never-overwrite (D-06): Riverside city + San Diego city pre-existing GCC rows refreshed (same source, 0 preserved/skipped)"
  - "Reconciliation (D-07): 4 sample cities' FY2024 total comp reconcile to an INDEPENDENT re-aggregation of the official GCC export at EXACTLY $0 delta (Riverside $378,222,887; San Bernardino $142,134,736; Oxnard $204,573,470; El Centro $27,502,367)"
  - "Coverage: 95/95 cities carry salaries; 87/95 have the full 16 GCC years (2009-2024); 8 cities partial (10 city-year gaps — GCC source gaps + late incorporation e.g. Jurupa Valley/Eastvale)"
  - "D-08: names-free Department→Position total-compensation tree; data_source = GCC (publicpay.ca.gov). D-10: $0 spend (free source, no AI)"
requirements-completed: [SAL-07]
duration: "~30min (16 GCC ZIP downloads + ~1510 DB writes via background runs)"
completed: "2026-06-17"
---

# Phase 65 Plan 01: SoCal Salaries Sweep Summary

**SAL-07 satisfied: GCC salaries FY2009–2024 are loaded for all 95 newly-loaded SoCal cities (1,510 city-year rows, names-free Department→Position total-compensation), additive and never-overwrite; coverage was confirmed against GCC on the production DB before any write, and four sample cities reconcile to an independent GCC re-aggregation at exactly $0 delta.**

## Performance

- **Duration:** ~30 min (16 GCC ZIP downloads + ~1,510 DB writes via background runs)
- **Completed:** 2026-06-17
- **Tasks:** 3/3 (production-target + dry-run coverage gate → live sweep → reconcile + coverage doc)
- **Files modified:** 0 source files (DB rows + this SUMMARY only)

## Accomplishments

### Task 1 — Production target + dry-run coverage gate (SC#1, no writes)
Asserted `SUPABASE_URL` host = `kxsdzaojfaibhuzmclfq.supabase.co` (production — local salary state is stale, D-04) before anything else. Then dry-ran `sweepCASalaries.js --county "<X>" --dry-run` for all 6 counties: **cohort = 95 cities** (Riverside 28, San Bernardino 24, San Diego 18, Ventura 10, Santa Barbara 8, Imperial 7), 0 different-source rows to preserve, per-city/year GCC coverage + gaps recorded. The 16 GCC City.zip exports were downloaded + cached during this pass.

### Task 2 — Live sweep FY2009–2024 (SC#2)
`sweepCASalaries.js --county "<X>"` for all 6 counties (cache warm — no re-downloads). Writes `dataset_type='salaries'` only (additive — operating/revenue rows untouched). **1,510 city-year rows written, 0 download failures, all counties succeeded on attempt 1.** Riverside city + San Diego city pre-existing GCC rows refreshed (same source — 0 preserved/skipped).

| County | cities | with salaries | full 16-yr | salaries rows |
|--------|--------|---------------|-----------|---------------|
| Riverside | 28 | 28 | 25 | 444 |
| San Bernardino | 24 | 24 | 22 | 381 |
| San Diego | 18 | 18 | 17 | 287 |
| Ventura | 10 | 10 | 10 | 160 |
| Santa Barbara | 8 | 8 | 7 | 127 |
| Imperial | 7 | 7 | 6 | 111 |
| **TOTAL** | **95** | **95** | **87** | **1,510** |

### Task 3 — Reconciliation + coverage (SC#3, SC#4)
- **Reconciliation (independent GCC re-aggregation, separate code path — NOT a re-sum of the ingested DB tree):** for FY2024, summed TOTAL_WAGES + TOTAL_BENEFITS over each city's rows in the cached official GCC export and compared to the DB-stored `total_budget`:
  - Riverside: GCC $378,222,887 = DB $378,222,887 → **Δ $0**
  - San Bernardino: GCC $142,134,736 = DB $142,134,736 → **Δ $0**
  - Oxnard: GCC $204,573,470 = DB $204,573,470 → **Δ $0**
  - El Centro: GCC $27,502,367 = DB $27,502,367 → **Δ $0**
- **Coverage:** 95/95 cities carry GCC salaries; **87/95 have the full 16 years (FY2009–2024)**. The 8 partial cities reflect 10 city-year gaps — GCC source gaps (e.g. a single missing year) and late incorporation (Jurupa Valley first GCC year 2011, Eastvale 2010). Documented, not failures (D-06).
- **Render:** `DatasetTabs.tsx` shows the Salaries card when a city has a `salaries` row with a populated tree; verified at the data + render-code level (pixel UAT is Phase 67 / VER-06).

## Verification

| Must-have | Result |
|-----------|--------|
| Coverage confirmed against GCC (dry-run) on PRODUCTION before any write | ✅ host asserted; 95-city cohort + gaps read first |
| Salaries FY2009–2024 loaded additive, never-overwrite | ✅ 1,510 rows; op/rev untouched; 0 different-source overwrites |
| Sample city latest-year reconciles to GCC ~$0 delta | ✅ 4 cities exactly $0 |
| Per-city coverage + gaps documented; dataset renders | ✅ 95/95 covered, 87 full-16; gaps listed |

## Deviations

None functionally. Source = GCC (`gcc.sco.ca.gov`), a different host than ByTheNumbers — downloads were reliable (0 failures) and ZIP-cached, so per-county runs shared one set of 16 downloads. Executed inline on the main working tree (production DB; needs `.env`; ZIP cache in tmp). The reconciliation/verify probes initially queried non-existent columns (`total`, `row_count`); corrected to `total_budget` — a probe-authoring detail, not a data issue (the data was correct throughout).

## SAL-07 — SATISFIED

GCC salaries FY2009–2024 loaded for the 95 SoCal cities (names-free Dept→Position total-comp, never-overwrite), reconciled to the source at exactly $0 on a 4-city sample, coverage + gaps documented; production DB only; $0 spend.
