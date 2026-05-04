# Phase 9: Revenue Completion - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify that revenue data for Plano, McKinney, Frisco, and Allen is correctly loaded and visible in the app. Then extract and load revenue data for Prosper and Celina from their ACFR PDFs using the existing Haiku vision pipeline. The phase is complete when all six cities have at least one fiscal year of revenue data visible in the app's revenue view.

</domain>

<decisions>
## Implementation Decisions

### Verification criteria (09-01: Plano, McKinney, Frisco, Allen)
- "Correct" means: revenue rows exist in DB and the revenue tab renders in the app with non-obviously-wrong totals — not a cross-reference against source documents
- Origin of revenue data for some cities (especially Allen and Frisco) is uncertain — 09-01 should start by tracing data_sources rows to establish how each city's revenue was loaded
- If data is missing or clearly wrong, fix it within 09-01 — the plan is not read-only

### Year coverage
- Plano (FY2018–2024 in scope): if any years are missing during verification, load the missing ones within 09-01
- McKinney (FY2021–2025 in scope): same approach — fill any gaps found during verification
- Prosper and Celina: start with the most recent fiscal year (FY2025); if extraction quality is high (exit 0 or clean exit 1), continue loading earlier years in the same plan

### Revenue category taxonomy
- Preserve each city's native ACFR labels — no normalization to a common taxonomy
- Extract at line-item granularity (every revenue row), consistent with operating budget extraction

### Low-confidence extraction handling
- Use the same pipeline behavior as operating budgets: load rows that pass confidence threshold, write flagged rows to the JSONL review log
- Exit codes remain: 0 = clean, 1 = loaded with some flags, 2 = hard failure
- Confidence threshold: same as existing pipeline (no stricter threshold for revenue pages)
- If a city's ACFR PDF doesn't have a clearly structured revenue section: skip revenue for that city this phase, log as not found, and move on — do not force a load

### Claude's Discretion
- Exact confidence threshold values (use existing pipeline defaults)
- Dry-run strategy and page selection for Prosper/Celina PDFs
- How to identify revenue sections within ACFR PDFs (prompt engineering for page classification)

</decisions>

<specifics>
## Specific Ideas

- API budget has been increased — Prosper and Celina should expand to multiple years if initial extraction is clean
- Plano and McKinney gap-filling (if needed) should happen within the verification plan, not a separate plan

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-revenue-completion*
*Context gathered: 2026-05-04*
