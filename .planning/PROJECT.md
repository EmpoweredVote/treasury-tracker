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

### Active

- [ ] Dallas operating and revenue budget data loaded via Socrata SODA API
- [ ] Generic `bulkLoadBudget.js` for any Socrata city's operating/revenue budgets
- [ ] XLSX check register importer for Plano, McKinney, Frisco, Richardson, Sachse
- [ ] PDF → image → Claude Haiku vision pipeline for ACFR budget extraction
- [ ] Allen, Prosper, Celina budget data loaded via PDF pipeline

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

## Current Milestone: v1.1 Texas Municipal Financial Transparency

**Goal:** Load real financial data for Collin County, TX cities using three progressively harder ingestion pipelines — Socrata API, XLSX download, and PDF/Haiku vision extraction.

**Target features:**
- Dallas Socrata integration (operating + revenue budgets via SODA API)
- Generic `bulkLoadBudget.js` script reusable for any Socrata city
- XLSX pipeline for Plano, McKinney, Frisco, Richardson, Sachse check registers / budgets
- PDF → image → Claude Haiku vision pipeline for ACFR parsing
- Allen, Prosper, Celina loaded via PDF pipeline

---
*Last updated: 2026-05-01 — Milestone v1.1 Texas Municipal Financial Transparency started*
