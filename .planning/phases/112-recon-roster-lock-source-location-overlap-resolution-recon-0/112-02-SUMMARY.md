---
phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
plan: "112-02"
subsystem: data
tags: [acfr, recon, oregon, south-carolina, louisiana, oklahoma, utah, nasbo, source-location]

# Dependency graph
requires:
  - phase: 111-loader-debt-atomic-data-sources-upsert-load-01
    provides: ephemeral data_sources lifecycle (create-use-delete, 0 residue) inherited by every process*Acfr.js clone
provides:
  - "112-BATCH2-SOURCES.md — per-state ACFR source location, bookend tie-confirmations, four risk facts, scope-vs-NASBO, recency-floor verdicts, gap log, and loader-template mapping for OR/SC/LA/OK/UT"
  - "UT state-node overlap-risk flag recorded (state ACFR located; provenance check deferred to plan 112-03/RECON-10)"
affects: [113-acfr-upgrade-batch-1, 114-acfr-upgrade-batch-2, 112-03-utah-overlap-recon]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wayback Machine CDX API (web.archive.org/cdx/search/cdx) used to discover live-site URL patterns and historical filename conventions when a state's landing page is JS-rendered or Cloudflare-protected (Utah) — read-only recon technique, no new runtime dependency"
    - "pdftotext -table General Fund column extraction + printed-total tie-confirm, same mold as v2.13 (98/103/107 precedent)"

key-files:
  created:
    - .planning/phases/112-recon-roster-lock-source-location-overlap-resolution-recon-0/112-BATCH2-SOURCES.md
  modified: []

key-decisions:
  - "LA's ACFR General Fund is ~99% federal Intergovernmental Revenue passthrough — state tax revenue is booked to a separate Bond Security & Redemption Fund column, not GF. Flagged prominently for Phase 114, not resolved here."
  - "UT is the only state in the tranche where ACFR GF (~$11.4B) is NARROWER than its NASBO GF (~$13.67B) — driven by Utah's constitutionally earmarked Income Tax Fund (2020 Amendment G) being a separate major fund in GAAP but apparently combined with GF in NASBO's survey figure. Flagged as a load-phase decision (GF alone vs GF+Income Tax combined), not resolved here."
  - "OR/UT both have narrow live-durable windows (OR: FY2022-2025; UT: FY2019-2025) because older ACFRs were removed from the current site (OR) or retired post-WordPress-migration (UT) — excluded per D-06 non-durable rule, but both satisfy the D-07 recency floor and are roster-eligible per D-12 (no minimum depth beyond the floor)"
  - "UT overlap-risk flag recorded per D-03/RECON-10: this plan located Utah's state ACFR only; the UT state-node provenance check and in-place-upgrade plan are explicitly deferred to plan 112-03 — no DB probe performed in this plan"

requirements-completed: [RECON-09]

# Metrics
duration: 35min
completed: 2026-07-02
---

# Phase 112 Plan 112-02: Batch-2 ACFR Source Location (OR/SC/LA/OK/UT) Summary

**Located, bookend-tied, and risk-profiled ACFR General Fund sources for all 5 Batch-2 tranche-3 candidates (Oregon, South Carolina, Louisiana, Oklahoma, Utah) via `pdftotext -table`; flagged Louisiana's unusual federal-passthrough-dominated GF and Utah's unique NASBO-narrower GF for Phase-114 load-time decisions; recorded Utah's overlap-risk flag for plan 112-03.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-02T20:50:00Z (approx.)
- **Completed:** 2026-07-02T21:25:00Z (approx.)
- **Tasks:** 3 completed
- **Files modified:** 1 (`112-BATCH2-SOURCES.md`, created and filled across 3 commits)

## Accomplishments

- All 5 Batch-2 states (OR, SC, LA, OK, UT) located: Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column, with durable per-year URL patterns
- Every state's oldest + latest reachable FY bookend-tied to the printed page total via `pdftotext -table` — all ties exact ($0 diff) except Oregon's FY2022 ($1K rounding, acceptable)
- Four risk facts (units, negative-category years, exact statement/column confirmation, FY-end month) pinned for all 5 states — all report in thousands, all FY-end June 30, no P2-clamp-triggering negative GF revenue lines in any bookend year
- Scope-vs-NASBO magnitude computed and accept-relabel recommended for all 5, with two notable structural findings surfaced: Louisiana's GF is ~99% federal passthrough (state taxes sit in a different fund), and Utah's GF is the only one in the tranche *narrower* than its NASBO figure (constitutionally earmarked Income Tax Fund)
- Recency floor (FY2023+FY2024) confirmed GREENLIGHT for all 5 states
- Consolidated gap log records every non-durable/non-derivable/oddly-named year across the 5 states
- UT's overlap-risk flag recorded per D-03/RECON-10 without probing the live database — state-node provenance check deferred to plan 112-03

## Task Commits

1. **Task 0: Set up the Batch-2 workspace + scaffold the SOURCES doc** - `3ef3aec` (docs)
2. **Task 1: Recon OR + SC + LA** - `ae7938a` (docs)
3. **Task 2: Recon OK + UT; UT overlap-risk flag** - `1c6f5e3` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `.planning/phases/112-recon-roster-lock-source-location-overlap-resolution-recon-0/112-BATCH2-SOURCES.md` - Per-state ACFR source location, bookend ties, risk facts, scope-vs-NASBO, recency-floor verdicts, gap log, loader-template mapping for OR/SC/LA/OK/UT (7 sections + 5 detail blocks, mirrors the 107-BATCH2-SOURCES.md shape)

Gitignored working files (not committed): `_acfr-work/{or,sc,la,ok,ut}/` — downloaded PDFs and `pdftotext -table` extractions used during recon, per the plan's environment notes (never commit PDFs).

## Decisions Made

- **Louisiana's General Fund composition:** LA's ACFR GF revenue is overwhelmingly ($22.48B of $22.78B, FY2025) federal Intergovernmental Revenue; the state's own-source tax revenue is booked to a separate "Bond Security and Redemption Fund" column instead. This is documented prominently rather than silently accepted — a naive "GF = state discretionary revenue" read would misrepresent Louisiana. The choice of GF-alone vs. a combined view is deferred to Phase 114.
- **Utah's General Fund composition:** Utah is the only Batch-1/Batch-2 state where ACFR GF (~$11.40B) undershoots its NASBO GF (~$13.67B) — Utah's constitutionally earmarked income tax revenue lives in a separate major fund (renamed "Income Tax Fund" in FY2025, was "Education" in FY2019, following the 2020 "Amendment G" constitutional change). Recon flags this rather than picking a resolution; Phase 114 decides whether to load GF alone or GF+Income Tax Fund combined.
- **D-06 durable-URL exclusions for OR and UT:** Both states have older ACFRs that are confirmed to have existed (Wayback CDX) but 404 live today. Rather than reach for a Wayback-only URL (violates D-06), these years are gap-logged and excluded — both states still satisfy the D-07 recency floor and remain roster-eligible per D-12 (no minimum window depth beyond the floor).
- **UT overlap-risk flag scope discipline:** This plan located Utah's state ACFR source only, per the plan's explicit `<threat_model>`-adjacent scope boundary. It read `scripts/loadStateGF.mjs` as static source code (confirming Utah currently has NASBO-sourced operating rows) but did NOT probe the live database — the state-node provenance check and in-place-upgrade plan are plan 112-03's job (RECON-10), as instructed.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria across Tasks 0-2 were met using only `pdftotext`, `curl`, and the Wayback CDX API (no AI/LLM calls, $0 spend, no DB writes, no loader code, no frontend changes).

## Issues Encountered

- **South Carolina's landing page URL had smart/curly hyphens** (`annual‐comprehensive‐financial‐reports‐acfrs` using U+2010) that broke a direct guess; resolved by discovering the canonical ASCII-hyphen URL via the Wayback CDX API index rather than a live site crawl.
- **Utah's dedicated ACFR-archive sub-page is Cloudflare-protected** against non-browser User-Agents (returns a "blocked" challenge page), consistent with the plan's tn.gov/CA-SCO access-quirk precedent. Worked around by using direct `wp-content/uploads/{filename}.pdf` links (discovered via Wayback CDX), which are reachable without a special UA — no browser-download fallback was needed.
- **Oklahoma's `pdftotext -table` output on Windows was misdiagnosed as UTF-16 by the `file` command** on first inspection (a false alarm — a `grep -na` binary-safe re-check confirmed the file was plain ASCII text throughout); resolved without any encoding conversion needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `112-BATCH2-SOURCES.md` is the complete input contract for Phase 114 (Batch 2 ACFR loads: OR/SC/LA/OK/UT) — every state has a located statement, durable per-year URL pattern (or an enumeration strategy where no single pattern exists), bookend-tied dollar figures, pinned risk facts, a scope-vs-NASBO recommendation, and a loader-template mapping (all 5 map to the `processILAcfr.js`/`processILRevenueAcfr.js` explicit-SOURCES-map family).
- Two load-phase decisions are explicitly flagged for Phase 114 to resolve (not blockers, just decisions): (1) Louisiana — GF-alone vs. GF+Bond Security & Redemption combined; (2) Utah — GF-alone vs. GF+Income Tax Fund combined.
- UT's overlap-risk flag hands off cleanly to plan 112-03 (RECON-10): this plan confirms Utah's state ACFR is located and that `loadStateGF.mjs` currently carries Utah on the standard NASBO path (from static source-code inspection), but the live state-node provenance check and any in-place-upgrade plan remain 112-03's responsibility.
- No blockers for Phase 114. No blockers for plan 112-03.

---
*Phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0*
*Completed: 2026-07-02*
