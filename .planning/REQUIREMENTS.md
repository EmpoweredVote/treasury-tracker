# Requirements — v2.0 Federal Treasury Tracker

## Milestone Goal

Describe the US Federal Budget visually with maximum clarity and context for average citizens — a tool for clarity that explains and is ALWAYS sourced. Ship the federal entity with FY2025 actuals, the Mandatory/Discretionary/Net Interest first split, two drill lenses (function default, agency toggle), a fetch-then-summarize sourced explainer pipeline, and a program-origins pilot backed by Congress.gov.

**Ground rules (Chris, 2026-06-12 — see v2.0-FEDERAL-BRIEF.md):** no paid APIs; never display unsourced data or text; no reflexive deep icicles; official public record only; opacity flagged with citations; LLM spend under the $5 approval gate.

**IA decisions (recon, 2026-06-12 — see v2.0-recon/RECON.md):**
- Headline year: FY2025 actuals (OMB); FY2026 FYTD as secondary "this year so far" strip (MTS)
- Landing: proportional Mandatory / Discretionary / Net Interest bands + permanent receipts-vs-outlays deficit strip
- Function lens is the default drill; agency lens behind a toggle
- Outlays consistently (MTS/OMB); USAspending obligations never used as headline figures

---

## v2.0 Requirements

### INFRA — Federal Entity + Sourcing Schema

- [ ] **INFRA-01**: `entity_type: 'federal'` supported end-to-end (DB constraint, ev-accounts-api, Municipality type, EntitySwitcher) following the Phase 32 'state' pattern
- [ ] **INFRA-02**: Sourcing columns (`source_name`, `source_url`, `source_date`) exist on budget and enrichment rows; federal rows REQUIRED to populate them
- [ ] **INFRA-03**: `program_details` table exists for Tier 2 origins data (enabling statute, public law number, sponsor, cosponsors, year), every claim carrying a source URL

### DATA — Core Federal Data Load

- [ ] **DATA-01**: FY2025 actual outlays by budget function loaded with source metadata, at maximum sourced depth (Chris 2026-06-12: more than 3-deep where data supports it; clarity is the goal). Primary: Function → Subfunction → Account via OMB Public Budget Database; verified fallback: Function → Subfunction (OMB 3.2/MTS T9). Depth never extends past sourced OUTLAYS (no obligations grafting)
- [ ] **DATA-02**: FY2025 actual receipts by source loaded from MTS Table 9/4 with source metadata
- [ ] **DATA-03**: Mandatory/Discretionary/Net Interest split loaded from OMB Historical Table 8.1 (multi-year, at minimum FY2015–FY2025)
- [ ] **DATA-04**: Receipts/outlays/deficit history loaded from OMB Historical Table 1.1 (multi-decade context)
- [ ] **DATA-05**: FY2026 FYTD outlays + receipts (monthly, current through latest MTS) loaded for the "this year so far" strip
- [ ] **DATA-06**: Agency-lens outlays loaded from MTS Table 5 as a Department → Bureau → Account tree (parent_id hierarchy walked correctly, "Total--" rows never double-counted)
- [ ] **DATA-07**: Debt total (Debt to the Penny) and interest expense context figures loaded with source metadata

### VIZ — Federal Visualization

- [ ] **VIZ-01**: Federal landing view shows proportional Mandatory / Discretionary / Net Interest bands (FY2025) — not an icicle
- [ ] **VIZ-02**: Permanent deficit context strip: receipts vs outlays with the gap labeled, plus debt total
- [ ] **VIZ-03**: Function-lens drill is the default; agency-lens available via toggle
- [ ] **VIZ-04**: Every displayed figure carries a source chip (dataset name, fetch date, link)
- [ ] **VIZ-05**: Comparative-scale aids: per-capita, per-taxpayer, % of total (arithmetic on sourced numbers only, formula disclosed)
- [ ] **VIZ-06**: The outlays-vs-budget-authority choice is documented visibly in-app

### SRC — Sourced Explainer Pipeline v2

- [ ] **SRC-01**: Fetch-then-summarize enrichment: explainer text generated ONLY from fetched authoritative text (agency budget justifications, official descriptions), citation stored and displayed
- [ ] **SRC-02**: Tier 1 explainers live for all ~20 budget functions and top 10 agencies
- [ ] **SRC-03**: Opacity handling: unauditable portions (DoD failed audits) flagged in UI with official GAO/OIG citation
- [ ] **SRC-04**: LLM cost re-estimated before each enrichment run; total under the $5 gate

### ORIG — Program Origins Pilot

- [x] **ORIG-01**: Congress.gov + GovInfo API keys obtained and stored in .env — single api.data.gov key (`DATA_GOV_API_KEY`) verified live against both APIs 2026-06-12
- [ ] **ORIG-02**: 15–20 major programs have Tier 2 details sections: enabling bill, public law number, sponsor, year, cosponsors — structured from Congress.gov/GovInfo, every claim linked
- [ ] **ORIG-03**: Details sections contain official-record facts only — no model-memory claims, no personal info beyond official sponsorship records

### VERIFY — Source-Chain Verification + UAT

- [ ] **VERIFY-01**: Automated source-chain audit: every federal figure and text claim resolves to a working source URL
- [ ] **VERIFY-02**: Human UAT: Chris spot-checks landing view, both lenses, deficit strip, explainers, origins sections, and confirms no regression on city/county/state pages

---

## Future Requirements

*Not in v2.0 scope — tracked for future milestones.*

- Votes/amendments exploration hub (the eventual mission destination)
- Backfill sourcing standard to cities/states (once proven federally)
- USAspending award-level drill-down (program activity / object class / recipients) — obligations-based; would need explicit labeling to avoid corrupting the outlays-canonical rule
- CBO program cost estimates as explainer source (blocked: cbo.gov bot-blocks non-browser clients — needs manual download workflow)
- Historical trend visualizations (multi-decade lines from OMB 1.1 data beyond the context strip)

---

## Out of Scope

- **Paid APIs or data sources** — everything free, per ground rule 1
- **Unsourced LLM text from model memory** — hard ban, per ground rule 3
- **Deep icicles by default** — visualization chosen per data shape, per ground rule 4
- **Anything beyond official public record** — no personal info, no addresses, no targeting, per ground rule 6
- **Editorializing** — never change the data; transparency about opacity instead
