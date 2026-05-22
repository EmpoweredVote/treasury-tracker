# Phase 12: Prosper and Celina Revenue via pdftotext - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract revenue data for Prosper (FY2023–FY2025) and Celina (FY2025) from ACFR PDFs using pdftotext, targeting the "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES" section. Validate extracted totals against published ACFR figures before enabling display. Phase ends when data is visible in the app and per-capita revenue is unlocked for both cities.

</domain>

<decisions>
## Implementation Decisions

### Validation workflow
- Hard block on failure — if totals fall outside 20% tolerance, do NOT load data and do NOT set `last_synced_at`; data stays absent from the app until extraction is fixed
- Extract → validate → load (or abort) in a single script run — not a separate validation command
- Tolerance hardcoded at 20% — not configurable via flag
- On pass: script sets `last_synced_at` automatically — no human gate after the numbers check out
- Output: print full comparison to console (extracted total, expected total, % difference) — human notes result in PLAN.md
- Re-running is idempotent — safe upsert, same result whether or not `last_synced_at` is already set
- How to source the expected ACFR total (hardcoded vs. flag) and per-FY blocking behavior for Prosper: Claude's discretion

### Extraction scope
- Governmental funds only — General Fund, Special Revenue, Debt Service, Capital Projects; skip enterprise/proprietary funds
- Extract BOTH revenues AND expenditures from the statement — note: planner must account for dedup with expenditure data already loaded from Phase 7/9 operating budgets
- Line-item detail — individual revenue sources within each fund (not fund subtotals only)
- Skip unparseable sections (e.g., trust funds, component units) — log a warning and continue; do not abort the run

### Failure & partial extraction
- Log level: page number + reason + raw pdftotext output snippet for any skipped page
- No minimum page-parse success rate — 20% tolerance check is the guard against bad extraction
- How to handle bad pdftotext pages (continue vs. abort) and missing dollar amounts (skip vs. $0): Claude's discretion

### Loader architecture
- City-specific files: `processProsperjRevenuePDF.js` for Prosper, `processCelinaRevenuePDF.js` for Celina — no shared generic file
- Each plan (12-01, 12-03) produces its own independent loader — Celina does not depend on Prosper code
- Follow the same file structure and CLI flags as existing pdftotext loaders (processLongviewBudget.js, processGarlandBudget.js) strictly — diverge only where the revenue statement column layout requires it
- PDF path passed as CLI argument — not via data_sources row

### Claude's Discretion
- Whether to continue or abort on garbled/empty pdftotext pages
- How to handle revenue line items with a label but no dollar amount (skip vs. $0)
- How the expected ACFR total is sourced for comparison (hardcoded per city/FY vs. CLI flag)
- Whether per-FY validation for Prosper blocks all three years or just the failing year

</decisions>

<specifics>
## Specific Ideas

- The revenue section to target is named exactly "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES" — this is the anchor string for pdftotext parsing
- Reference implementations: processLongviewBudget.js and processGarlandBudget.js — revenue loader should mirror their structure
- Seeded infrastructure already exists: Prosper Revenue FY2023/FY2024/FY2025 and Celina Revenue FY2025 data_source rows are in DB with `last_synced_at = null`
- Extraction quality for Prosper/Celina revenue is unknown until attempted — researcher should flag this as the primary risk

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-prosper-celina-revenue*
*Context gathered: 2026-05-21*
