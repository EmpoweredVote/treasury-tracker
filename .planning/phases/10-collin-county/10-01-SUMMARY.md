---
phase: 10-collin-county
plan: 01
subsystem: database
tags: [supabase, pdftotext, data_sources, pdf]

requires:
  - phase: 07-pdf-haiku
    provides: bulkLoadPDF.js pipeline and data_sources schema conventions
  - phase: 08-data-quality
    provides: seedPDFDataSources.js idempotency pattern

provides:
  - 12 treasury.data_sources rows for 6 Collin County cities (FY2025 + FY2026 each)
  - Per-city pdftotext dry-run results and routing decisions
  - 10-01-DRYRUN-NOTES.md consumed by Plans 10-02 and 10-03

affects: [10-02, 10-03]

tech-stack:
  added: []
  patterns: [pdftotext dry-run before load, upsertByName idempotency, seeder additive-only changes]

key-files:
  created: [.planning/phases/10-collin-county/10-01-DRYRUN-NOTES.md]
  modified: [scripts/seedPDFDataSources.js]

key-decisions:
  - "Garland: use FY2025 (FY2026 at /22610/ is 211KB summary brochure — confirmed)"
  - "Richardson: skip — CivicLive Server_7964838 is Roseville CA, not Richardson TX; placeholder URLs seeded"
  - "Wylie: pdftotext-parser (not image-heavy despite 'for Web' label — text extracts cleanly)"
  - "All 5 loadable cities routed to pdftotext-parser (Garland/Wylie/Sachse/Murphy/Princeton)"

patterns-established:
  - "Richardson TX cor.net blocks direct HTTP fetch — must source PDF URL manually from browser"

duration: 40min
completed: 2026-05-21
---

# Phase 10-01: Seed & Dry-Run Summary

**12 data_sources rows seeded for 6 Collin County cities; 5 of 6 routed to pdftotext-parser; Richardson skipped due to wrong CDN URL (served Roseville CA PDF)**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-05-21
- **Tasks:** 2 tasks + 1 deviation fix
- **Files modified:** 2

## Accomplishments

- 12 `treasury.data_sources` rows seeded (6 cities × FY2025 + FY2026) — all idempotent
- pdftotext dry-run completed for 5 of 6 cities (Richardson skipped — see deviations)
- Routing decisions documented in `10-01-DRYRUN-NOTES.md` — Plans 10-02 and 10-03 can execute without re-doing sourcing or dry-run work
- GF totals confirmed: Garland $246.9M, Wylie ~$80M, Sachse $31.2M, Murphy $19.7M, Princeton $36.9M — all within sanity ranges

## Task Commits

1. **Task 1: Seed 12 data_sources rows** — `cc96f0e` (feat)
2. **Task 2: Dry-run notes** — `f835b26` (docs)
3. **Deviation: Fix Richardson URL** — `b0a89ed` (fix)

## Routing Decisions

| City | FY | Decision | GF Total | Sanity | Plan |
|------|----|----------|----------|--------|------|
| Garland | 2025 | pdftotext-parser | $246.9M | PASS | 10-02 |
| Richardson | 2026 | skip (URL error) | N/A | FAIL | — |
| Wylie | 2026 | pdftotext-parser | ~$80M | PASS | 10-03 |
| Sachse | 2026 | pdftotext-parser | $31.2M | PASS | 10-03 |
| Murphy | 2025 | pdftotext-parser | ~$19.7M | PASS | 10-03 |
| Princeton | 2026 | pdftotext-parser | $36.9M | PASS | 10-03 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Auto-fix bug] Richardson CivicLive CDN serves Roseville CA PDF**
- **Found during:** Task 2 (dry-run pdftotext inspection)
- **Issue:** Research phase URL for Richardson TX used CivicLive CDN `Server_7964838` which hosts Roseville, California budget documents. Both FY2025 and FY2026 downloads contained "City of Roseville, California" in header.
- **Fix:** Updated `seedPDFDataSources.js` constants with placeholder `cor.net/departments/budget/...` URLs and re-ran seeder to update the DB rows. Documented skip decision and manual-source action in dry-run notes.
- **Files modified:** `scripts/seedPDFDataSources.js`
- **Committed in:** `b0a89ed`

---

**Total deviations:** 1 auto-fixed (URL mismatch discovered during dry-run)
**Impact:** Richardson skipped; 5 of 6 cities still loadable. Phase 10 success criteria permit documented skips.

## Issues Encountered

- Richardson TX `cor.net` website blocks all automated HTTP requests (HTTP 403). Correct PDF URL must be obtained by manually visiting https://www.cor.net/departments/budget in a browser. This is a manual action required before Richardson can be loaded (a quick task after Phase 10, or added to 10-02 notes as blocked).

## Next Phase Readiness

Plans 10-02 and 10-03 can proceed:
- 10-02: Load Garland (pdftotext-parser) + note Richardson as blocked
- 10-03: Load Wylie, Sachse, Murphy, Princeton (all pdftotext-parser)
- All PDFs cached in `C:/tmp/collin-budgets/` — no re-download needed
- Routing decisions documented; parsers to be written per city following `processLongviewBudget.js` pattern

---
*Phase: 10-collin-county*
*Completed: 2026-05-21*
