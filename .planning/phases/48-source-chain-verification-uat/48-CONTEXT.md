# Phase 48 Context — Source-Chain Verification + UAT

**Created:** 2026-06-12 (inline planning). **Goal:** every federal claim in the app resolves to a working source link (automated audit, report committed), and Chris confirms the experience end-to-end. Requirements: VERIFY-01, VERIFY-02. This closes v2.0.

## The audit inventory (pinned from live SQL, 2026-06-12)

| # | Surface | Rows | URL field(s) | Domains |
|---|---------|------|--------------|---------|
| 1 | treasury.budgets (US, 3 datasets) | 3 | data_source_id → source_registry.url | fiscaldata.treasury.gov, whitehouse.gov, usaspending.gov |
| 2 | federal_annual_summary | 64 | source_url | whitehouse.gov (OMB) |
| 3 | federal_context_metrics | 73 | source_url | api.fiscaldata.treasury.gov, fiscal.treasury.gov, irs.gov, whitehouse.gov |
| 4 | category_enrichment (US-scoped) | 27 | source_url | gao.gov, usaspending.gov |
| 5 | program_details | 15 | enabling_bill_url (8), public_law_url (15), sponsor_url (8), cosponsors_url (6), details[].source_url (16) | congress.gov, bioguide.congress.gov, govinfo.gov |

Notes:
- `budget_line_items.source` = 'csv' (legacy ingestion-format field, NOT sourcing). Tree figures are sourced at the dataset level via the SourceChip (budgets → source_registry) — the audit verifies that chain plus `data_source_info` in the API response.
- Dedupe before fetching: 64 annual-summary rows share one OMB URL; expect ~40 unique URLs from ~230 claim rows.
- source_registry also holds 14 city/state rows — audit only the 5 federal keys (treasury-fiscal-data, omb-historical-tables, usaspending, congress-gov, govinfo); city URLs are out of scope (sourcing-backfill milestone).

## Per-domain fetch strategy (every gotcha already proven in 47)

| Domain | Strategy |
|--------|----------|
| whitehouse.gov, fiscal.treasury.gov, irs.gov, usaspending.gov, api.fiscaldata.treasury.gov | GET with browser User-Agent, follow redirects → expect 200 |
| govinfo.gov app pages | **Page status is meaningless (SPA returns 200 for ANY path).** Parse packageId/granuleId from the URL → verify via api.govinfo.gov package/granule summary (DATA_GOV_API_KEY) |
| congress.gov, bioguide.congress.gov, gao.gov | **403 bot-wall for curl/WebFetch.** Browser pass with local Playwright chromium (the 47-03 harness pattern: `C:/Users/Chris/AppData/Local/ms-playwright/chromium-1217`); a URL passes when the page renders expected content (bill title / member name / report title), not a block page. Anything still blocked → explicit human-check list with exact URLs |

## Verdict rules

- PASS: 200 (friendly), API-confirmed (govinfo), or content-confirmed (browser pass)
- HUMAN-CHECK: browser pass inconclusive (bot-wall even for Playwright) — listed with exact URL + what to look for
- FAIL: 404/410, govinfo API miss, or content mismatch → must be fixed (data correction) before UAT sign-off

## UAT scope (VERIFY-02, from ROADMAP success criteria)

Chris confirms in production: landing view (bands + deficit strip + FYTD strip), both lenses (function default, agency toggle), explainers with citations (drill any enriched category), origins sections (≥3 programs incl. one foundational boundary note), source chips clickable; no regression on a city (Plano), a county, and a state (CA) page. Plus the HUMAN-CHECK URL list from 48-01.

## Done means

48-AUDIT.md (committed report: per-surface counts, per-URL verdicts, failures fixed or dispositioned) + 48-VERIFICATION.md (VERIFY-01/02 PASS lines with evidence, Chris's confirmations quoted) → v2.0 ready for milestone audit/close.
