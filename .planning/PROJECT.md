# Treasury Tracker / Empowered Vote Financials

## What This Is

A public-facing financial transparency platform for cities and nonprofits, deployed at treasurytracker.empowered.vote. It translates raw budget and transaction data into plain-language summaries, visual breakdowns, and searchable spending categories — making government and nonprofit finances accessible to everyday citizens.

## Core Value

Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

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
- ✓ Prosper TX revenue data loaded via pdftotext (FY2023, FY2024, FY2025) — v1.3
- ✓ Celina TX revenue data loaded via pdftotext (FY2025) — v1.3
- ✓ Richardson TX operating budget loaded (FY2025, FY2026) via 4-format XLSX dispatcher — v1.3
- ✓ Category enrichment for Garland, Wylie, Sachse, Murphy, Princeton — v1.3
- ✓ Population data loaded for all 12 TX cities (2024 Census vintage); per-capita ($/resident) visible in app — v1.3
- ✓ Los Angeles operating budget (FY2025+2026, $19.8B/$21.4B) with enrichment and per-capita — v1.4
- ✓ San Francisco operating + revenue (FY2025+2026, $15.9B each) with enrichment and per-capita — v1.4
- ✓ San Diego operating + revenue (FY2025, $4.9B op/$5.5B rev) with enrichment and per-capita — v1.4
- ✓ LA revenue budget (FY2025+2026, $10.2B) added — v1.4
- ✓ `bulkLoadBudget.js` extended with `fiscal_year_type` + `where_extra` for integer FY columns and multi-type datasets — v1.4
- ✓ Portland OR operating + revenue (FY2022–FY2026, 635,749 population, 41 enrichment rows) — v1.5
- ✓ Gresham OR operating + revenue (FY2023–FY2026, 111,507 population, 33 enrichment rows) — v1.5
- ✓ Troutdale OR operating + revenue (FY2019–FY2026, 15,749 population, 26 enrichment rows) — v1.5, Phase 22
- ✓ LA County accurate operating + revenue data (FY2021–FY2024) from CA State Controller county datasets — v1.5, Phase 25
- ✓ Self-referential `county_id` FK on municipalities; 88 LA County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages — v1.5, Phase 25

## Current Milestone: v1.6 California City Expansion

**Goal:** Add 7 new California cities with full operating and revenue budget data, expanding CA coverage beyond the initial LA/SF/SD trio, and close two carry-forward items from v1.5.

**Target features:**
- Long Beach CA — operating + revenue
- San Jose CA — operating + revenue
- Sacramento CA — operating + revenue
- Oakland CA — operating + revenue
- Fresno CA — operating + revenue
- Riverside CA — operating + revenue
- Bakersfield CA — operating + revenue
- Longview TX revenue data (seeded, revenue missing)
- `EntitySwitcher.tsx` `STATE_LABELS` map fix (TX → Texas, CA → California, OR → Oregon)

### Active

- [ ] Long Beach CA operating + revenue budget data loaded
- [ ] San Jose CA operating + revenue budget data loaded
- [ ] Sacramento CA operating + revenue budget data loaded
- [ ] Oakland CA operating + revenue budget data loaded
- [ ] Fresno CA operating + revenue budget data loaded
- [ ] Riverside CA operating + revenue budget data loaded
- [ ] Bakersfield CA operating + revenue budget data loaded
- [ ] Longview TX revenue data loaded
- [ ] `EntitySwitcher.tsx` STATE_LABELS map fix shipped

### Out of Scope

- Real-time websocket subscriptions — redirect-driven flow is sufficient and simpler
- Patreon/Benevity real-time — webhook story is weaker; CSV import remains for those platforms
- Admin donation management UI — out of scope for this milestone
- Multi-year per-capita trends — single 2024 population vintage across FY2018–FY2026 creates false trends for fast-growing cities
- Enterprise fund audit across cities — complex scope analysis; deferred until cross-city comparison is in scope

## Context

- Stack: React + TypeScript frontend, Supabase (Postgres + Edge Functions), Vite, Tailwind, deployed on Render
- EV financial data loaded via `scripts/loadEVFinances.js` from CSV exports
- Donation platforms: GiveButter (primary, lowest fees), Patreon (recurring), Benevity (workplace giving)
- GiveButter supports webhooks and custom return URLs after donation completion
- The webhook fires before the redirect, so DB should be updated by the time user lands back
- Currently covers: 13 TX cities (Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton, Longview) + 3 CA cities (Los Angeles, San Francisco, San Diego) + 3 OR cities (Portland, Gresham, Troutdale) + LA County government
- county_id FK on municipalities; 88 LA County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages

## Constraints

- **Platform**: Supabase Edge Functions for webhook receiver — already in stack
- **Deduplication**: CSV re-imports must not double-count webhook-written transactions
- **Scope**: GiveButter only for real-time; other platforms remain manual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Redirect-driven (not websockets) | Simpler, no always-on subscription needed; webhook fires before redirect completes | ✓ Good |
| Supabase Edge Function as webhook receiver | Already in stack, no new infra | ✓ Good |
| GiveButter-only for v1 | Best webhook support; Patreon/Benevity less suitable | ✓ Good |
| Socrata SODA API for city budgets | Generic loader reusable for any Socrata city; no city-specific code | ✓ Good — proven across Dallas, LA, SF |
| pdftotext over Haiku vision for revenue sections | PDF structure too irregular for vision; pdftotext + regex targeting yields higher accuracy | ✓ Good |
| Path A population schema (add column to municipalities) | Zero frontend changes, one migration; multi-year history deferred to v2 | ✓ Good |
| 2024 Census vintage applied uniformly across all FYs | Single-year population; false trends would mislead for fast-growing cities | — Single vintage only |
| `where_extra` caller supplies leading AND | More flexible (allows OR, parentheses); matches column_mapping per-dataset contract | ✓ Good |
| `fiscal_year_type` defaults to 'string' | Backward-compatible; only 'integer' triggers unquoted WHERE branch | ✓ Good |
| SD FY2026 excluded (empty budget_cycle in source) | Source-driven gap; update fiscal_years when SD publishes FY2026 adopted data | — No code change needed |

## Shipped

- ✅ **v1.5 Oregon Expansion** — 2026-06-04 — Phases 17-25 (Portland/Gresham/Troutdale OR, all-funds consistency, LA data quality, LA County + county-city linking)
- ✅ **v1.4 Geographic Expansion** — 2026-05-22 — Phases 15-16 (LA, SF, SD, LA Revenue)
- ✅ **v1.3 Revenue Completion & Per-Capita Context** — 2026-05-22 — Phases 11-14
- ✅ **v1.2 Collin County Completion & Data Quality** — 2026-05-21 — Phases 8-10
- ✅ **v1.1 Texas Municipal Financial Transparency** — 2026-05-02 — Phases 5-7
- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — 2026-04-22 — Phases 1-4

---
*Last updated: 2026-06-03 — v1.6 California City Expansion started*
