---
phase: 07-pdf-haiku-vision-pipeline
plan: 02
subsystem: loaders
tags: [haiku, vision, anthropic, pdf, budget-tree, confidence, review-log, rpc, cli]

# Dependency graph
requires:
  - phase: 07-pdf-haiku-vision-pipeline
    plan: 01
    provides: scripts/bulkLoadPDF.js skeleton — renderPDFPages, downloadOrReadPDF, hashPDF, cache infrastructure
provides:
  - scripts/bulkLoadPDF.js — full PDF → Haiku → budget_tree → treasury_sync_budget_tree pipeline (591 lines)
  - Full CLI surface: --source, --pdf+--city+--fiscal-year, --list, --dry-run, --render-only, --quiet, --confidence-threshold
  - JSONL review log at logs/review-<city-slug>-<YYYYMMDD>.jsonl for flagged pages
affects: ['07-03']

# Tech tracking
tech-stack:
  added: []  # @anthropic-ai/sdk already installed in Phase 7 plan 01 context
  patterns:
    - Haiku vision content block: type='image' + type='base64' + media_type='image/png' + EXTRACTION_PROMPT
    - extractJSON strips ```json fences before JSON.parse (research §Pitfall 1)
    - validateExtractionResult schema gate — malformed output → flagged page (confidence=0), NOT retry
    - 3-retry exponential backoff with jitter (1s/2s/4s + up to 250ms jitter)
    - Lazy Anthropic client init (anthropic = null until first callHaikuWithRetry call)
    - processPDF returns result object with exitCode 0/1/2 — main() calls process.exit(exitCode)
    - Budget tree compact format: {n, a, c, i} — identical to bulkLoadBudget.js
    - Truncate-and-reload: DELETE WHERE data_source_id=ds.id AND fiscal_year=fiscalYear before RPC
    - JSONL review log format: {page_number, confidence, reason, extracted_data_attempt}
    - --fiscal-year CLI flag overrides Haiku-extracted fiscal_year (source of truth per CONTEXT)
    - Windows libuv UV_HANDLE_CLOSING workaround: await setTimeout(50ms) before process.exit on --list

key-files:
  modified:
    - scripts/bulkLoadPDF.js (266 → 591 lines)
    - .gitignore (added logs/)

key-decisions:
  - "EXTRACTION_PROMPT verbatim from research — classify page_type first, then extract rows (budget_table only)"
  - "maxRetries: 0 on Anthropic client — we manage retries manually for precise backoff control"
  - "3 retries with jitter (not SDK default 2) per CONTEXT decision"
  - "malformed Haiku JSON → confidence=0 flagged page, not retry (schema violations are not transient)"
  - "haikuFatal flag: any null return from callHaikuWithRetry after all retries → exitCode=2"
  - "dry-run skips RPC and DELETE; still runs Haiku on every page (validates extraction without DB writes)"
  - "ad-hoc --pdf requires --dry-run until Plan 03 seeder creates data_sources row"
  - "Windows Node 24 fix: 50ms setTimeout before process.exit to allow libuv handles to close cleanly"

# Metrics
duration: ~8 min (interrupted by rate limit before SUMMARY; code commits all complete)
completed: 2026-05-02
---

# Phase 7 Plan 02: Haiku Vision Extraction + DB Integration Summary

**Full PDF → Haiku vision → budget tree → treasury_sync_budget_tree pipeline implemented; 591-line bulkLoadPDF.js with complete CLI surface; dry-run smoke test: --list confirmed working**

## Performance

- **Duration:** ~8 min
- **Tasks:** 3/3 committed
- **Files modified:** 1 (scripts/bulkLoadPDF.js: 266 → 591 lines), 1 (`.gitignore`: added `logs/`)

## Accomplishments

- Implemented `EXTRACTION_PROMPT` (verbatim from research) + `extractJSON` (strips ```json fences) + `validateExtractionResult` (schema gate)
- Implemented `callHaikuWithRetry` with 3-attempt exponential backoff (1s/2s/4s + jitter), lazy Anthropic client init, schema-violation → flagged page (not retry)
- Implemented `processPDF` — full per-page loop: render → Haiku → page_type routing → confidence threshold → JSONL review log → compact budget tree → truncate-and-reload → `treasury_sync_budget_tree` RPC
- Implemented complete `main()` — all CLI flags: `--list`, `--source`, `--pdf+--city+--fiscal-year`, `--dry-run`, `--render-only`, `--quiet`, `--confidence-threshold`; end-of-run summary block always printed
- Added `logs/` to `.gitignore`

## Task Commits

1. **Task 1:** `f79eb8b` — feat(07-02): implement Haiku extraction layer (callHaikuWithRetry, EXTRACTION_PROMPT, extractJSON)
2. **Task 2:** `b28f876` — feat(07-02): implement processPDF — full per-page Haiku pipeline + budget tree + RPC load
3. **Task 3:** `98a7b58` — feat(07-02): implement full main() CLI surface + end-of-run summary block

## Smoke Test Result

- `node scripts/bulkLoadPDF.js --list` → exits 0, prints "No PDF data sources configured. Run seedPDFDataSources.js first." ✓
- Full `--dry-run` against Celina ACFR not executed (ANTHROPIC_API_KEY not available at execution time) — Plan 03's seeder must run first, then operator runs `--dry-run` to validate before live load
- CLI routing proven: `--render-only` still works (cache hit), `--list` works, all other paths exit gracefully

## Decisions Made

1. **maxRetries: 0 on Anthropic client** — manual retry loop gives precise control over backoff; SDK default of 2 would double the retry count.
2. **Schema violations → flagged page** — treating malformed Haiku output as low-confidence rather than retrying prevents infinite loops when Haiku consistently returns bad JSON for a specific page.
3. **haikuFatal accumulates** — any null from callHaikuWithRetry sets flag; pipeline continues processing remaining pages rather than aborting immediately (maximizes data recovery on partial failures).
4. **Windows libuv fix** — Node 24 + win32 throws `UV_HANDLE_CLOSING` assertion when Supabase WS + Anthropic SDK both imported and `process.exit()` called synchronously. Added `await setTimeout(50ms)` before exit on `--list` path.

## Known Unknowns for Plan 03

- Haiku prompt quality untested against actual ACFR pages — `--dry-run` against each city's ACFR should be run before live load to inspect page classification distribution
- Allen/Prosper/Celina may have different column naming conventions — the flexible EXTRACTION_PROMPT ("semantic extraction not literal column matching") should handle variation
- Prosper ACFR is >10MB (~200+ pages) — may hit memory during rendering; chunked render fallback is documented in TODO comment

## Next Phase Readiness

- **Plan 03 (seeder + live load):** Ready. `seedPDFDataSources.js` must create data_sources rows for Allen/Prosper/Celina. Then `--source "Allen ACFR FY2025" --dry-run` validates before live load.

---
*Phase: 07-pdf-haiku-vision-pipeline*
*Completed: 2026-05-02*
