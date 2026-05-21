# Milestones — Treasury Tracker / Empowered Vote Financials

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
*Last updated: 2026-05-21 after v1.2 milestone*
