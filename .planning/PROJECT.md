# Treasury Tracker / Empowered Vote Financials

## What This Is

A public-facing financial transparency platform for cities and nonprofits, deployed at financials.empowered.vote. It translates raw budget and transaction data into plain-language summaries, visual breakdowns, and searchable spending categories — making government and nonprofit finances accessible to everyday citizens.

## Core Value

Any citizen can open financials.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## Requirements

### Validated

- ✓ Budget visualization with icicle bars, category breakdowns, and spending percentages
- ✓ Plain-language narrative summaries (current year "is spending", past year "spent", current year with actuals "As of {month}, has spent")
- ✓ Year selector with FY switching
- ✓ Nonprofit vs. municipality display modes
- ✓ EV SSO auth integration with Inform/Alpha landing page
- ✓ Brand color system with logo tiles and contrast text logic
- ✓ Category enrichment with short descriptions
- ✓ Line item vendor descriptions (Read.AI, MindMeister, Figma, etc.)
- ✓ Annual Report PDF download (FY 2025, shown beside year selector)
- ✓ Linked transactions panel
- ✓ Budget search
- ✓ Dallas operating and revenue budget data loaded via Socrata SODA API — v1.1
- ✓ Generic `bulkLoadBudget.js` for any Socrata city's operating/revenue budgets — v1.1
- ✓ XLSX check register importer for Plano, McKinney, Frisco — v1.1
- ✓ PDF → Claude Haiku vision pipeline for ACFR budget extraction — v1.1
- ✓ Allen, Prosper, Celina budget data loaded via PDF pipeline — v1.1
- ✓ PDF pipeline "Unknown" department attribution fixed (max_tokens + cross-page section context) — v1.2
- ✓ Revenue data visible for Plano (FY2018–2024), McKinney (FY2021–2025), Frisco (FY2026), Allen (FY2026) — v1.2
- ✓ Garland, Wylie, Sachse, Murphy, Princeton operating budgets loaded via pdftotext parsers — v1.2

### Active

- [ ] Prosper revenue data loaded — pdftotext targeting "STATEMENT OF REVENUES" section needed (ACFR Haiku vision produces inflated totals)
- [ ] Celina revenue data loaded — same pdftotext approach as Prosper
- [ ] Richardson operating budget loaded — cor.net blocks HTTP; manual browser URL sourcing required, then processRichardsonBudget.js following processGarlandBudget.js pattern
- [ ] Category enrichment for all newly loaded TX cities (v1.2 loads data; enrichment is a separate pass)
- [ ] Population data for TX municipalities

### Out of Scope

- Real-time websocket subscriptions — redirect-driven flow is sufficient and simpler
- Patreon/Benevity real-time — webhook story is weaker; CSV import remains for those platforms
- Admin donation management UI — out of scope for this milestone

## Context

- Stack: React + TypeScript frontend, Supabase (Postgres + Edge Functions), Vite, Tailwind, deployed on Render
- EV financial data loaded via `scripts/loadEVFinances.js` from CSV exports
- Donation platforms: GiveButter (primary, lowest fees), Patreon (recurring), Benevity (workplace giving)
- GiveButter supports webhooks and custom return URLs after donation completion
- The webhook fires before the redirect, so DB should be updated by the time user lands back

## Constraints

- **Platform**: Supabase Edge Functions for webhook receiver — already in stack
- **Deduplication**: CSV re-imports must not double-count webhook-written transactions
- **Scope**: GiveButter only for real-time; other platforms remain manual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Redirect-driven (not websockets) | Simpler, no always-on subscription needed; webhook fires before redirect completes | — Pending |
| Supabase Edge Function as webhook receiver | Already in stack, no new infra | — Pending |
| GiveButter-only for v1 | Best webhook support; Patreon/Benevity less suitable | — Pending |

## Shipped: v1.2 Collin County Completion & Data Quality (2026-05-21)

13/16 requirements shipped. 5 new Collin County cities added. Revenue data loaded for 4 TX cities. PDF pipeline attribution fixed. Prosper/Celina revenue and Richardson operating budget deferred to v1.3.

## Current Milestone: v1.3 Revenue Completion & Per-Capita Context

**Goal:** Close out all deferred v1.2 data work and add population-based per-capita spending display so citizens can compare cities of different sizes.

**Target features:**
- Prosper revenue loaded via pdftotext targeting STATEMENT OF REVENUES section
- Celina revenue loaded via same pdftotext approach
- Richardson operating budget via manual URL sourcing + processRichardsonBudget.js
- Category enrichment for Garland, Wylie, Sachse, Murphy, Princeton
- TX city population data loaded; per-capita spending displayed in app

---
*Last updated: 2026-05-21 — v1.3 started*
