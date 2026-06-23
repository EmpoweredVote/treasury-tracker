---
phase: 80-city-county-loads
plan: 02
subsystem: data-loaders
tags: [virginia, apa, supabase, bulk-load, idempotent, provenance]

requires:
  - phase: 80-city-county-loads (plan 01)
    provides: loadVAComparativeReportBatch.js + section-aware importLocality
provides:
  - 127 VA cities+counties loaded (operating+revenue) across FY2023-FY2024, fully sourced
  - Amended FY2024 report adopted as authoritative (recovers late-filer localities)
affects: [81-towns-linking, 82-enrichment, 83-verification]

tech-stack:
  added: []
  patterns:
    - "Amended-over-final source preference when the amended release fills coverage gaps"

key-files:
  modified:
    - scripts/vaApaDatasets.json

key-decisions:
  - "Adopted the AMENDED FY2024 report as the loaded source (recovers 14 late-filer localities the final omitted)"
  - "Loaded only localities with published data (127/133); 6 multi-year-overdue localities documented as a residual gap"

patterns-established:
  - "Live bulk load = batch driver per (FY) on main tree with .env service key, serial, idempotent"

requirements-completed: [VALOAD-01, VALOAD-02, VALOAD-04]

duration: ~40min
completed: 2026-06-22
---

# Phase 80 Plan 02: Live Bulk Load + Verification Summary

**127 of 133 Virginia cities + counties loaded (operating + revenue, FY2023 + FY2024-amended), every row sourced; idempotent re-run proven; 6 multi-year late-filers documented as a residual source gap.**

## Performance
- **Duration:** ~40 min (inline, no subagents — $0 Anthropic)
- **Completed:** 2026-06-22
- **Tasks:** 4 (acquire workbooks, dry-run pre-flight, live load, verify) + amended-report recovery pass
- **Files modified:** 1 (manifest provenance)

## Accomplishments
- **Live production load** of all cities+counties with published data:
  - **FY2024 (amended):** 124 localities × {operating, revenue}
  - **FY2023:** 117 localities × {operating, revenue}
  - **482 rows, 127 distinct municipalities**, 0 hard errors.
- **Amended-report recovery (Chris's probe request):** the `2024-amended` CKAN package was found to fill in 14 late-filer localities the `final` omitted (FY2024 110→124). Adopted as the authoritative FY2024 source; all 248 FY2024 rows now cite the amended dataset URL.
- **Verification (all in-phase gates pass):**
  - Sourcing (SC#1): 0 NULL/empty source_url; uniform `data_source='Virginia APA Comparative Report'`.
  - Spot-check (SC#4): Alexandria FY2024 op **$863,578,347** / rev **$874,230,660** (exact vs report); Fairfax County $6.67B; Accomack County (recovered) $141,487,870.
  - Per-capita (SC#2): population set per FY from Exhibit H (Alexandria 158,591; Fairfax County 1,139,398; Accomack 33,236).
  - Homonym integrity: Fairfax County ≠ Fairfax city; Richmond city ($1.6B) distinct from Richmond County.
  - Idempotency (SC#3 / VALOAD-04): FY2024 re-run left 454→ (then amended) row counts stable per source; no duplicate rows, no phantom municipalities. Absent localities (e.g. Accomack pre-amended) were never written as $0.

## Task Commits
1. **Live load + amended recovery + manifest provenance** — see plan commit below (data writes are live DB, not git; manifest is the git artifact).

## Files Created/Modified
- `scripts/vaApaDatasets.json` — FY2024 now points to the **amended** dataset (authoritative); final marked superseded; `_meta.note` records the 6-locality residual gap.
- Production `treasury.budgets` + `treasury.municipalities` — 482 budget rows / 127 VA city+county municipalities (live; not version-controlled).

## Decisions Made
- **Amended FY2024 over final** — the amended release adds 14 late-filer localities and changes no already-filed figures (verified Alexandria/Fairfax County identical). Better coverage + provenance.
- **Load what's published (127/133)** — honest, complete-as-possible from this source.

## Deviations from Plan
- Plan 80-02 anticipated ~133 localities/year; reality is 124 (FY2024-amended) / 117 (FY2023) because of late-filers. Added an **amended-report recovery pass** (per Chris's decision) that lifted coverage from 122→127. Both are data-driven, not scope changes.

## Issues Encountered
- **6 localities remain completely absent** across FY2023, FY2024-final, and FY2024-amended: cities **Colonial Heights, Emporia, Hopewell, Norton**; counties **Lee, Warren**. These are multi-year-overdue audits not yet processed by the APA. **Follow-up:** a future re-run of the batch loader (against a newer amended/FY2025 report) will pick them up idempotently — no code change needed. Recorded in `vaApaDatasets.json` `_meta.note`.

## Next Phase Readiness
- 127 VA cities+counties are live with sourced operating+revenue+per-capita for FY2023-FY2024.
- **Phase 81** (towns + Virginia state node + linking): the same batch driver covers towns via `--entity-type town` / section 2 (37 towns); the state node + linking is the new work.
- **Phase 83** (source-chain audit + UAT): 482 rows to audit, all `data_source='Virginia APA Comparative Report'`, 0 NULL source_url; expect the 6-locality gap to surface as documented-and-accepted.

---
*Phase: 80-city-county-loads*
*Completed: 2026-06-22*
