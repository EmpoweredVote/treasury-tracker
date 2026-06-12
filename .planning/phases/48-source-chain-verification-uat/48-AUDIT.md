# 48-AUDIT — Federal Source-Chain Audit Report

**Audited:** 2026-06-12 | **Result: 61/61 unique URLs PASS — zero FAIL, zero HUMAN-CHECK residue**

Every URL-bearing federal claim row resolves to a working official record. The
bot-walled domains all verified by content match in a real browser, so the
human-check list planned for 48-02 is **empty** — Chris's UAT can focus purely on
the experience.

## Inventory audited (225 claim rows → 61 unique URLs)

| Surface | Claim rows | Verdict |
|---------|-----------:|---------|
| source_registry (5 federal keys) | 5 | all PASS |
| budgets → registry chain (3 US datasets) | 3 | all linked + production API carries data_source_info |
| federal_annual_summary | 64 | all PASS (1 unique OMB URL) |
| federal_context_metrics | 73 | all PASS |
| category_enrichment (US) | 27 | all PASS |
| program_details.enabling_bill_url | 8 | all PASS |
| program_details.public_law_url | 15 | all PASS |
| program_details.sponsor_url | 8 | all PASS |
| program_details.cosponsors_url | 6 | all PASS |
| program_details.details[].source_url | 16 | all PASS |

Full per-URL results (verdict, method, note, referencing rows): `48-audit-results.json`.

## Method (per-domain, from the 47 gotchas)

| Domain class | URLs | How verified |
|--------------|-----:|--------------|
| Friendly (whitehouse.gov, fiscal/fiscaldata.treasury.gov, irs.gov, usaspending.gov, govinfo.gov root) | 21 | GET with browser UA → HTTP 200 (incl. the OMB xlsx and IRS Data Book xlsx direct downloads, the FY2025 Financial Report PDF, and 3 live Fiscal Data API endpoints) |
| govinfo.gov/app/details pages | 14 | **Never by page status** (the SPA 200s any path) — packageId/granuleId parsed from each URL and confirmed via api.govinfo.gov package/granule summaries |
| congress.gov (12), gao.gov (1) | 13 | Playwright real-browser load + content match: each bill page matched its fetched title fragment, each cosponsors page matched "Cosponsor", coverage-dates page matched, GAO budget-functions glossary matched. (curl/WebFetch get 403 — the wall is client-based, not page-based.) Samples: `48-01-browser-sample-{1,2,3}.png` |
| bioguide.congress.gov | 7 | Playwright + case-insensitive surname match — pages render names uppercase ("RANGEL, Charles B."), which produced 6 false misses on the first (case-sensitive) pass; retried and all 7 matched. Every sponsor link lands on the right member's official bio |

Sequential fetches, 300ms+ courtesy delays, one retry on 5xx/timeout. DATA_GOV_API_KEY env-only, never logged or stored in the report.

## Fixes made during the audit

1. **Missing service_role grant on treasury.source_registry** — the table was
   created with anon/authenticated SELECT only, so service-role loaders/auditors
   could not read it. Fixed: migration `20260612180000_grant_service_role_source_registry`.
   (Infrastructure fix, not a data fix — no claim row was wrong.)

Zero data-layer FAILs: no URL needed re-pinning.

## Re-runnability

`node scripts/auditFederalSources.mjs` regenerates the machine verdicts
(idempotent: 35 PASS / 26 BROWSER / 0 FAIL on consecutive runs); the Playwright
content-match pass then upgrades the BROWSER set. Browser-pass harness pattern:
playwright-core (temp dir, not a project dep) + local chromium-1217.

## Hand-off to 48-02

- HUMAN-CHECK list: **empty.**
- UAT checklist still includes clicking a few source links from the UI (chips,
  origins links) — verifying the *rendered* chain, which this audit reaches only
  at the data layer.
