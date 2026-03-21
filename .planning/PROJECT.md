# Treasury Tracker

## What This Is

Treasury Tracker is a citizen-facing, interactive budget visualization tool for Bloomington, Indiana. It transforms dense municipal financial data (PDFs, spreadsheets) into explorable, educational visualizations — letting any resident "follow their tax dollars" without needing accounting expertise. No authentication required; built for public access.

## Core Value

A citizen can load the app and within seconds understand the top-level budget breakdown, then drill down to any department or line item — making public finance genuinely accessible.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Interactive horizontal bar chart with proportional budget segments — v1.0
- ✓ Drill-down navigation through budget hierarchy (up to 5 levels) with breadcrumbs — v1.0
- ✓ Three dataset tabs: Operating Budget, Revenue, Salaries — v1.0
- ✓ Multi-year data support (2021–2025) with year selector — v1.0
- ✓ Linked transactions panel for operating budget (top vendors, recent transactions) — v1.0
- ✓ Search/filter within current level — v1.0
- ✓ Per-resident cost display on info cards — v1.0
- ✓ Multiple viz modes available: bar, icicle, sunburst, tree — v1.0
- ✓ Hero section with city image and budget summary — v1.0

## Current Milestone: v1.1 Multi-City Platform

**Goal:** Transform Treasury Tracker from a Bloomington-only app into a reusable multi-city platform, with Los Angeles as the first second city.

**Target features:**
- City picker landing page with per-city routing (/bloomington, /los-angeles)
- Per-city config schema (name, hero image, available datasets, metadata)
- Data file namespacing by city slug
- Generalized processing scripts (parameterized by city)
- LA data sourced, processed, and live
- New-city onboarding documentation

### Active

<!-- Current scope. Building toward these. -->

- [ ] Multi-city routing with city picker landing page
- [ ] Per-city config schema and data namespacing
- [ ] Generalized data processing pipeline (parameterized by city)
- [ ] Los Angeles tracker live with at least one dataset
- [ ] New-city onboarding documentation

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Authentication / user accounts — Inform Pillar is intentionally public, no login
- Real-time data feeds — Data is processed offline and deployed statically
- State/Federal data — City-level only for now; tabs exist but are placeholders

## Context

- **Part of the Inform Pillar** — one-directional, educational, anonymous access; fits within a broader civic engagement platform ("EV" — likely EngageVoting or similar)
- **Bloomington, Indiana specific** — hardcoded city; data processed via Node scripts (`scripts/`) from raw CSV/PDF sources into JSON
- **Config-driven** — `budgetConfig.json` and `treasuryConfig.json` define categories, colors, and mappings
- **Deploys to Netlify** — static SPA with public data files in `/public/data/`
- **Design system** — uses `@chrisandrewsedu/ev-ui` for site header; custom CSS (no Tailwind in main app)

## Constraints

- **Tech stack**: React 19 + TypeScript + Vite; D3 v7, Recharts v3 for visualization
- **Data format**: All data is static JSON in `public/data/`; no backend or database
- **Performance**: Large JSON files (transactions data especially) — client-side filtering must be fast
- **Design system**: Must use `@chrisandrewsedu/ev-ui` SiteHeader component; custom CSS vars for theming
- **Civic tone**: Non-partisan, educational; avoid sensationalism or political framing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Static JSON over live API | Simplicity, offline resilience, no backend cost | ✓ Good |
| Horizontal bars as default viz | Most intuitive for proportional comparisons | ✓ Good |
| No authentication | Inform Pillar is public; friction kills civic engagement | ✓ Good |
| Multiple viz modes (bar/icicle/sunburst/tree) | Let users choose their mental model | — Pending (usage unknown) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 — GSD initialized on existing codebase, bootstrapped as v1.0*
