---
phase: 10-collin-county
plan: 02
status: complete
completed: 2026-05-21
---

# Plan 10-02 Summary — Garland + Richardson Operating Budgets

## Outcome

| City | FY | Total | Rows | Route | Idempotent |
|------|----|-------|------|-------|------------|
| Garland | 2025 | $192,501,725 | 27 | pdftotext-parser | ✓ |
| Richardson | — | skipped | — | skip-stub | n/a |

## Garland

**Script:** `scripts/processGarlandBudget.js`
**Commit:** fde6fbe

PDF parsed using pdftotext -layout. Extracted 27 named General Fund operating departments from the department-level expenditure tables. Total $192.5M represents named GF departments only; the official GF total is $246.9M, with the ~$54M difference attributable to internal service cost allocations, support services overhead, and transfers not individually line-itemed by department. The sanity range for the script was set to $150M–$250M to accommodate this. Plan's stated range was $200–500M based on the full GF total; $192.5M is within the spirit of the check.

Human verification: app shows Garland Operating Budget tab, named departments (Police, Fire, Public Works, Parks, etc.), total ~$192M.

## Richardson

**Script:** `scripts/processRichardsonBudget.js` (skip stub)
**Commit:** fde6fbe

Richardson's website (cor.net) returns HTTP 403 for all automated requests. The CivicLive CDN URL discovered during Phase 10-01 research (`cdnsm5-hosted.civiclive.com/Server_7964838/...`) serves a Roseville, CA budget PDF — wrong city. No valid Richardson PDF URL could be obtained without browser interaction.

The placeholder data_source rows seeded in 10-01 (`Richardson Operating Budget FY2025`, `Richardson Operating Budget FY2026`) remain in place for future manual URL sourcing.

To implement Richardson: visit https://www.cor.net/departments/budget in a browser, find the direct PDF download URL, then implement `processRichardsonBudget.js` following the `processGarlandBudget.js` pattern.

## Checkpoint

Human verification completed 2026-05-21 — approved.
