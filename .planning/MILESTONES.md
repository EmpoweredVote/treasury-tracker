# Milestones — Treasury Tracker / Empowered Vote Financials

---

## v1.4 Geographic Expansion (Shipped: 2026-05-22)

**Delivered:** First non-TX cities launched — Los Angeles, San Francisco, and San Diego operating + revenue budgets with per-capita display and enrichment, proving the generic Socrata + CSV pipelines scale to any US city.

**Phases completed:** 15–16 (8 plans total)

**Key accomplishments:**

- Los Angeles added as first non-TX city — operating budget FY2025 ($19.8B) and FY2026 ($21.4B) with 70 enriched categories and per-capita display
- San Francisco operating + revenue loaded (FY2025+FY2026, $15.9B each) via shared Socrata dataset with `where_extra` filter splitting spending/revenue types
- San Diego operating + revenue loaded (FY2025, $4.9B op/$5.5B rev) via new CSV pipeline handling fully double-quoted seshat.datasd.org format
- LA Revenue added ($10.2B FY2025+2026, Socrata `vvm4-a2zu`) — completing LA's financial picture
- `bulkLoadBudget.js` extended with `fiscal_year_type` and `where_extra` column_mapping keys — no breaking changes to existing TX city loads
- Enrichment for all 3 CA cities (SF: 53 rows, SD: 61 rows, LA: 70 rows); per-capita labeled "2024 Census estimate" for all

**Stats:** 2 phases, 8 plans; 1 day to ship (2026-05-22); 41 files changed, 6,003 insertions

**Archive:** [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

---

## v1.3 Revenue Completion & Per-Capita Context (Shipped: 2026-05-22)

**Delivered:** Closed all deferred v1.2 data work — Prosper + Celina revenue, Richardson operating budget, enrichment for 5 Collin County cities, and TX population data with per-capita spending display.

**Phases completed:** 11–14 (9 plans total)

**Key accomplishments:**

- Population schema + TX Census 2024 vintage estimates loaded for all 12 TX cities; per-capita ($/resident) visible in app labeled with source year
- Prosper TX revenue loaded via pdftotext targeting "STATEMENT OF REVENUES" (FY2023–2025, all governmental funds)
- Celina TX revenue loaded (FY2025, validated against $129.6M ACFR total)
- Richardson operating budget loaded (FY2025+FY2026) via 4-format XLSX dispatcher across document generations
- Category enrichment completed for Garland, Wylie, Sachse, Murphy, Princeton

**Stats:** 4 phases, 9 plans; 1 day to ship (2026-05-22)

---

## v1.2 Collin County Completion & Data Quality (Shipped: 2026-05-21)

**Delivered:** Fixed PDF department attribution, loaded revenue data for 4 TX cities, and added 5 new Collin County cities via pdftotext parsers.

**Phases completed:** 8–10 (9 plans total)

**Key accomplishments:**

- PDF pipeline fixed: max_tokens 2048→8192 + cross-page section heading context eliminates "Unknown" department dominance and exit code 2 truncation
- Revenue data loaded for Plano (7 FYs), McKinney (5 FYs), Frisco, and Allen — 412+ revenue rows now visible in app
- 5 new Collin County cities added: Garland ($192.5M), Wylie ($69.6M), Sachse ($31.2M), Murphy ($19.8M), Princeton ($36.9M)
- Confirmed ACFR PDF limitation for revenue extraction — documented pdftotext path for Prosper/Celina
- Princeton MA/TX municipality duplicate resolved; cost discipline maintained (skipped ~$20 API spend for 0.1% marginal improvement)

**Stats:** 3 phases, 9 plans; 18 days (2026-05-03 → 2026-05-21); 13/16 requirements shipped

**Tech debt carried forward:** Prosper/Celina revenue (pdftotext path needed), Richardson operating budget (cor.net HTTP block)

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Texas Municipal Financial Transparency (Shipped: 2026-05-02)

**Delivered:** Citizens can view operating budget and transaction data for Dallas, Plano, McKinney, Frisco, Allen, Prosper, and Celina.

**Phases completed:** 5–7 (9 plans total)

**Key accomplishments:**
- Generic Socrata SODA loader for Dallas operating + revenue budgets (FY2025, FY2026)
- Generic XLSX pipeline for Plano, McKinney, Frisco check registers + McKinney payroll
- Claude Haiku vision PDF pipeline for Allen, Prosper, Celina ACFR budget extraction

---

## v1.0 GiveButter Real-Time Donation Feedback (Shipped: 2026-04-22)

**Delivered:** Donate button on financials.empowered.vote with GiveButter webhook → Supabase → animated live counter on return.

**Phases completed:** 1–4 (9 plans total)

**Key accomplishments:**
- GiveButter webhook → Supabase Edge Function → Postgres RPC atomic donation write
- Animated counter + visibilitychange refetch on donor return
- loadEVFinances.js source-tagging + webhook row deduplication

---

## Pre-GSD History (shipped before planning system)

### SSO Auth Integration
Empowered Vote SSO integration with Alpha landing page. Full read access for Inform/unauthenticated users.

### EV Financials Brand & Logo System
BRAND_BAR_COLORS map, logo tile config, contrast text logic, nonprofit-specific icicle/summary behaviors, annual report download link.

### Enrichment & Municipality Fixes
Category enrichment system, NULL municipality_id fix, Cambridge enrichment.

---

*GSD planning system initialized: 2026-04-21*
*Last updated: 2026-05-23 after v1.4 milestone*
