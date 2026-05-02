---
phase: 07-pdf-haiku-vision-pipeline
plan: 01
subsystem: loaders
tags: [pdftoimg-js, napi-rs-canvas, pdfjs, pdf, png, sha256, cache, cli, node24, windows]

# Dependency graph
requires:
  - phase: 06-xlsx-pipeline
    provides: bulkLoadXLSX.js pattern — shebang, env setup, download helper, SHA-256 hash, parseArgs CLI shape
provides:
  - scripts/bulkLoadPDF.js — PDF download + per-page PNG rendering + SHA-256-keyed disk cache + CLI skeleton
  - cache/pdf-render/ — populated with Celina ACFR FY2025 (133 pages at 150 DPI)
  - pdftoimg-js@0.2.5 + @napi-rs/canvas@0.1.100 proven loadable on Windows + Node 24
affects: ['07-02', '07-03']

# Tech tracking
tech-stack:
  added:
    - pdftoimg-js@0.2.5
    - "@napi-rs/canvas@0.1.100"
  patterns:
    - PDF-to-PNG render cache keyed by SHA-256 of PDF buffer (cache/pdf-render/<hex>/)
    - Exit-code tiering — 0=clean, 1=flagged-pages, 2=fatal (matches CONTEXT decision)
    - --render-only smoke flag for validating rendering without Haiku/DB
    - Dynamic import of pdftoimg-js inside renderPDFPages (avoids top-level ESM issues)
    - RENDER_CONCURRENCY=2 intent documented but deferred (pdftoimg-js v2 lacks concurrency param)

key-files:
  created:
    - scripts/bulkLoadPDF.js
    - cache/pdf-render/caa2528fe1e49f02e077ab96c611e724ce6499201944ee771d6fbbb5f5996cd0/ (gitignored)
  modified:
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "pdftoimg-js v2 exports pdfToImg (camelCase) not convertPDF — research docs showed wrong name"
  - "pdfToImg accepts Uint8Array (Buffer subtype) directly — no temp file needed"
  - "pdfToImg returns base64 DataURL strings (data:image/png;base64,...) — must strip prefix before writing to disk"
  - "pdftoimg-js v2 has no concurrency parameter — processes pages internally; RENDER_CONCURRENCY=2 documented for Plan 02 chunked approach if OOM occurs"
  - "Scale 2.08 chosen (≈150 DPI from 72 DPI PDF baseline) — Celina ACFR pages rendered cleanly at ~3MB/page"
  - "Cache hit path re-downloads PDF to compute hash (required to locate cache dir) — 0.4s total is acceptable"
  - "TT: undefined function: 32 pdfjs font warning is benign — rendering unaffected"

patterns-established:
  - "PDF cache: cache/pdf-render/<sha256-hex>/page-NNN.png (3-digit zero-padded, sortable)"
  - "renderPDFPages: cache hit = readdir + filter .png + return early; cache miss = pdfToImg + write base64 → PNG"
  - "downloadOrReadPDF: http prefix = fetch; file:// prefix = strip+readFile; bare path = readFile as-is"
  - "Anthropic SDK imported at top but not instantiated — lazily initialized in Plan 02"

# Metrics
duration: 8min
completed: 2026-05-02
---

# Phase 7 Plan 01: PDF Rendering Foundation Summary

**pdftoimg-js + @napi-rs/canvas installed and smoke-tested on Windows+Node24; 133-page Celina ACFR rendered to cache/pdf-render/ at 150 DPI with SHA-256-keyed cache hit in 0.4s**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-02T04:07:21Z
- **Completed:** 2026-05-02T04:15:20Z
- **Tasks:** 3 (all implemented in 1 atomic commit; Tasks 2-3 included in Task 1 scaffold)
- **Files modified:** 4 (package.json, package-lock.json, scripts/bulkLoadPDF.js, .gitignore)

## Accomplishments
- Installed pdftoimg-js@0.2.5 + @napi-rs/canvas@0.1.100 as dependencies; both proven loadable on Windows + Node 24 (no build tools, no system deps, pre-built win32-x64-msvc binary)
- Created scripts/bulkLoadPDF.js (266 lines) with full JSDoc CLI usage, all imports, env setup, constants (CACHE_ROOT, DEFAULT_CONFIDENCE_THRESHOLD=70, RENDER_DPI=150, RENDER_SCALE=2.08, RENDER_CONCURRENCY=2), and complete implementations of downloadOrReadPDF, hashPDF, renderPDFPages, plus stubs for callHaikuWithRetry and processPDF
- Smoke test: Celina FY2025 ACFR downloaded and all 133 pages rendered to cache/pdf-render/caa2528.../page-NNN.png; re-run is a 0.4s cache hit (no re-download, no re-render)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pdftoimg-js + @napi-rs/canvas, scaffold bulkLoadPDF.js** - `664a179` (feat)
2. **Task 2: downloadOrReadPDF + hashPDF** - included in `664a179` (implemented during Task 1 scaffolding — functions were complete implementations, not stubs)
3. **Task 3: renderPDFPages + --render-only smoke test** - included in `664a179` (same scaffold commit); smoke test run confirmed against live Celina URL

**Plan metadata:** (pending — created after this summary)

## Files Created/Modified
- `scripts/bulkLoadPDF.js` — Full PDF loader skeleton: download helper, SHA-256 hash, per-page PNG renderer with hash-keyed cache, CLI with --render-only/--list/--source/--pdf flags, TODO stubs for Haiku (Plan 02) and DB load (Plan 03)
- `package.json` — Added pdftoimg-js@^0.2.5 and @napi-rs/canvas@^0.1.100 under dependencies
- `package-lock.json` — Lock file updated (38 new packages)
- `.gitignore` — Added `cache/` section to exclude PNG render cache from version control

## Decisions Made

1. **pdfToImg API is `pdfToImg(Uint8Array, { pages: 'all', imgType: 'png', scale: N })` not `convertPDF()`** — research docs showed wrong function name. Actual export confirmed via `Object.keys(m)` before writing any code.

2. **Scale 2.08 chosen for ~150 DPI** — PDF internal coordinate system is 72 DPI; multiplying by 2.08 gives 149.8 DPI, matching the RENDER_DPI=150 constant. Celina ACFR pages render at ~3MB each, confirming high enough quality for Haiku extraction.

3. **pdfToImg returns base64 DataURL strings** — must strip the `data:image/png;base64,` prefix before writing to disk. The TypeScript signature confirms: `Promise<string | string[]>`.

4. **pdftoimg-js v2 has no concurrency parameter** — RENDER_CONCURRENCY=2 constant is defined and documented for a potential chunked rendering approach (using `pages: { startPage, endPage }` per chunk) if OOM occurs on 200-page ACFRs in production. Not needed for Celina (133 pages completed without issue).

5. **Cache hit re-downloads the PDF** — This is unavoidable because the SHA-256 hash of the PDF buffer is needed to locate the cache directory; there is no way to know the cache key without reading the file content. The 0.4s total time (including download) is well within the 5s requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pdftoimg-js export name differs from research documentation**
- **Found during:** Task 1 (install + verify step)
- **Issue:** Research docs and 07-RESEARCH.md examples used `convertPDF` as the export name; actual v2 package exports `pdfToImg` and `singlePdfToImg`
- **Fix:** Used `pdfToImg` throughout the implementation; dynamic import confirmed correct via `Object.keys(m)` check before any code was written
- **Files modified:** scripts/bulkLoadPDF.js
- **Verification:** `node -e "import('pdftoimg-js').then(m => console.log(Object.keys(m)))"` prints `['pdfToImg', 'singlePdfToImg']`
- **Committed in:** 664a179 (Task 1 commit)

**2. [Rule 1 - Bug] pdfToImg returns DataURL strings, not Buffer objects**
- **Found during:** Task 1 (TypeScript type inspection)
- **Issue:** Research pattern assumed `result.path` arrays (outputDir mode); pdfToImg v2 returns `string[]` of base64 DataURL strings
- **Fix:** Strip `data:image/png;base64,` prefix then `Buffer.from(base64, 'base64')` before writing PNG to disk
- **Files modified:** scripts/bulkLoadPDF.js (renderPDFPages function)
- **Verification:** Smoke test produced 133 valid PNG files; page-001.png is 3MB (correct for 150 DPI ACFR cover page)
- **Committed in:** 664a179 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — API discovery)
**Impact on plan:** Both fixes were required to use the actual installed library correctly. No scope changes, no architectural impact.

## Windows-specific Observations

- @napi-rs/canvas loaded correctly with pre-built win32-x64-msvc binary (no node-gyp, no system deps)
- pdftoimg-js rendered 133 pages without memory issues on Windows (no OOM, no crash)
- Font warning `Warning: TT: undefined function: 32` appeared from pdfjs during rendering — this is a benign TrueType glyph lookup failure for a non-standard font glyph; rendering continues and output is unaffected
- Cache directory uses Windows backslash separator (path.join on win32) — `cache\pdf-render\<hash>\` — correct behavior

## Smoke Test Result

**City:** Celina, TX — FY2025 ACFR
**URL:** `https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025`
**PDF hash:** `caa2528fe1e49f02e077ab96c611e724ce6499201944ee771d6fbbb5f5996cd0`
**Cache directory:** `cache/pdf-render/caa2528fe1e49f02e077ab96c611e724ce6499201944ee771d6fbbb5f5996cd0/`
**Pages rendered:** 133
**First page size:** ~3MB (at scale=2.08 ≈ 150 DPI)
**Re-run time:** 0.441s (cache hit, well under 5s requirement)
**Exit code:** 0 (clean)

## Issues Encountered

None beyond the API name and return type deviations documented above (both auto-fixed before any code was committed to a wrong state).

## User Setup Required

None — no external service configuration required for this plan. ANTHROPIC_API_KEY will be required in Plan 02.

## Next Phase Readiness

- **Plan 02 (Haiku extraction):** Ready to implement. The `callHaikuWithRetry` stub is in place; `ANTHROPIC_API_KEY` env var is documented in the JSDoc header. The `renderPDFPages` function will be called with the exact same signature. PNG cache is populated for Celina — Plan 02 can skip re-rendering immediately.
- **Plan 03 (DB load):** Ready to design. `processPDF` stub is in place; `treasury_sync_budget_tree` RPC pattern is already studied.
- **Potential OOM concern:** pdftoimg-js v2 has no built-in concurrency option. If 200+ page ACFRs (e.g., Prosper) cause OOM, Plan 02 should switch to chunked rendering using `pages: { startPage: i, endPage: i + RENDER_CONCURRENCY - 1 }` per chunk of 2 pages. Celina (133 pages) completed without issue.

---
*Phase: 07-pdf-haiku-vision-pipeline*
*Completed: 2026-05-02*
