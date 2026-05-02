# Phase 7: PDF/Haiku Vision Pipeline - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract budget data from ACFR PDFs for Allen, Prosper, and Celina using a Claude Haiku vision pipeline. Pipeline runs as a Node.js CLI, renders PDF pages to PNG, sends each to Haiku for classification and extraction, loads validated budget rows to the treasury schema, and flags low-confidence pages for human review. Displaying these cities in the app and building any review UI are outside this phase.

</domain>

<decisions>
## Implementation Decisions

### Extraction scope
- Process ALL pages of each PDF — no operator-specified page ranges
- Haiku classifies each page as `budget_table`, `narrative`, `chart`, `cover`, etc.
- Only pages classified as `budget_table` are loaded — all fund types included (not just General Fund); `department` + `category` fields disambiguate
- Non-budget pages (narrative, cover, chart, etc.) are skipped silently — no log entry, no mention in output

### Confidence & review log
- Haiku self-rates confidence 0–100 as part of its JSON output; default threshold: 70
- Threshold is configurable via `--confidence-threshold` flag
- Pages below threshold are fully excluded from DB load — no uncertain data in the app
- Review log location: file system only, `logs/review-CITY-DATE.jsonl`
- Review log entry format (one per flagged page): `{ page_number, confidence, reason, extracted_data_attempt }`
  - `reason` = Haiku's brief explanation (e.g., "table had merged cells", "amounts in thousands not specified")
  - `extracted_data_attempt` = what Haiku tried to extract, even if uncertain

### Re-run / idempotency
- Truncate-and-reload on re-run: existing budget rows for `(municipality_id, fiscal_year)` are deleted, then fresh data loads
- After reviewing flagged pages, operator re-runs the full PDF — no partial page re-run tooling needed
- `--pdf` flag accepts both local file path and URL (detected by `http` prefix — download if URL, read file if path)
- Rendered PNGs are cached between runs, keyed by PDF hash — re-runs skip re-rendering for unchanged PDFs

### Pipeline operator experience
- Default: per-page progress output — one line per page: `Page 12/180 — budget_table — 94% confidence — 8 rows extracted`
- `--quiet` flag suppresses per-page output; prints summary only
- End-of-run summary always prints: pages processed, rows loaded, pages flagged, review log path (if any)
- Tiered exit codes: `0` = all pages loaded clean, `1` = completed with flagged pages (review log written), `2` = fatal failure
- Haiku API failure: retry 3× with backoff, then exit `2` with a clear message
- `--dry-run` mode: processes pages and logs extraction output but does not write to the database — useful for tuning prompts against a new city's ACFR before committing data

### Claude's Discretion
- Exact retry backoff timing and jitter
- PNG cache directory structure and eviction policy
- Haiku prompt engineering for ACFR table extraction and `page_type` classification
- Schema for the `extracted_data_attempt` field in the review log (flat JSON vs nested)

</decisions>

<specifics>
## Specific Ideas

- "Clean data or no data — never uncertain data in the app" — this is the guiding principle for confidence handling
- `--dry-run` is explicitly valuable for new city onboarding: tune the prompt, inspect output, then commit

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-pdf-haiku-vision-pipeline*
*Context gathered: 2026-05-01*
