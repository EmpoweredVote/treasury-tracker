# State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-21)

**Core value:** Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes.
**Current focus:** Planning v1.3 — Prosper/Celina revenue, Richardson, enrichment, statewide expansion

## Current Position

Phase: N/A — defining requirements
Plan: None
Status: v1.3 started (2026-05-21); requirements and roadmap in progress
Last activity: 2026-05-21 — v1.3 milestone initialized

Progress: v1.3 ░░░░░░░░░░░░░░░░░░░░ 0% (phases not yet defined)

## Accumulated Context

### Key Technical Decisions Carried Forward

- `bulkLoadPDF.js`: max_tokens=8192; stop_reason guard; section_heading cross-page context; datasetType param in buildExtractionPrompt
- ACFR revenue extraction limitation confirmed for 2+ cities: Haiku vision extracts capital/balance sheet tables, not revenue statements; future revenue work for ACFR cities requires pdftotext + text-marker section targeting
- Future Prosper/Celina revenue path: pdftotext targeting "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES" section (see processRevenuePDF.js pattern)
- pdftotext-parser pattern: processLongviewBudget.js / processGarlandBudget.js as reference implementations
- Richardson TX: cor.net blocks HTTP; manually browse https://www.cor.net/departments/budget to get PDF URL; implement processRichardsonBudget.js following processGarlandBudget.js
- Cost gating rule: estimate API cost before running; stop and get approval if >$5; document skipped runs explicitly
- Sequential PDF runs for same city (share rate limit + disk cache); cache key = SHA-256 of full PDF buffer

### Deferred Work (v1.3 backlog)

| Item | ID | Next Step |
|------|----|-----------|
| Prosper revenue | REV-05 | pdftotext + STATEMENT OF REVENUES section targeting |
| Celina revenue | REV-06 | Same as Prosper |
| Richardson operating budget | COL-02 | Manual URL from cor.net browser; processRichardsonBudget.js |
| Category enrichment (new TX cities) | — | Separate enrichment pass after v1.2 data loads |

### Seeded Infrastructure (ready for v1.3)

- Prosper Revenue FY2023/FY2024/FY2025 data_source rows (last_synced_at=null)
- Celina Revenue FY2025 data_source row (id=0e2e54c5, last_synced_at=null)
- Richardson Operating Budget FY2025/FY2026 placeholder data_source rows (placeholder URLs)

## Session Continuity

Last session: 2026-05-21
Stopped at: v1.2 archived, tagged, and committed
Resume file: None — run `/gsd:plan-phase [N]` after roadmap is created
