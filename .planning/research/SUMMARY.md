# Research Summary: v1.6 California City Expansion
**Synthesized:** 2026-06-03
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Critical Revision: Most Cities Are NOT on Socrata

The Architecture research initially assumed all 7 cities would use `bulkLoadBudget.js` (Socrata). The Stack research overturns this:

| City | Portal Type | Loader |
|------|------------|--------|
| Sacramento | ArcGIS Online — `loadSacramentoCSV.js` **already exists** | CSV (done) |
| Oakland | Socrata (data.oaklandca.gov) — dataset ID TBD | `bulkLoadBudget.js` |
| San Jose | Socrata (data.sanjoseca.gov) — dataset ID TBD | `bulkLoadBudget.js` |
| Long Beach | **OpenDataSoft** (NOT Socrata) — budget is PDF | pdfplumber / `bulkLoadPDF.js` |
| Fresno | No open data portal — PDF-only | pdfplumber / `bulkLoadPDF.js` |
| Riverside | Custom city portal — PDF-only | pdfplumber / `bulkLoadPDF.js` |
| Bakersfield | Open Budget portal — SODA endpoint **unconfirmed** | Investigate first |

**Implication for phasing:** Cities cannot be grouped by size alone — they must be grouped by loader type. Socrata cities (Oakland, San Jose) are fast-path; PDF cities (Long Beach, Fresno, Riverside) require pdfplumber extractors.

---

## Revised Phase Decomposition (Phases 26–30)

| Phase | Content | Loader | Complexity |
|-------|---------|--------|------------|
| 26 | Sacramento CA | `loadSacramentoCSV.js` (already written) | Low — script exists, seed + run |
| 27 | Longview TX revenue + STATE_LABELS spot-check | pdftotext (existing pattern) | Low — carry-forwards |
| 28 | Oakland + San Jose CA | Socrata `bulkLoadBudget.js` | Medium — confirm dataset IDs |
| 29 | Long Beach + Bakersfield CA | PDF (pdfplumber) + investigate Bakersfield | High — need custom extractors |
| 30 | Fresno + Riverside CA | PDF (pdfplumber) | High — biennial for Riverside |

**Starting phase number:** 26 (v1.5 ended at Phase 25)

---

## City Data Profiles at a Glance

| City | Population | Op. Budget | Revenue | FY Calendar | Key Complexity |
|------|-----------|------------|---------|-------------|----------------|
| Sacramento | ~536K | ~$1.6B | In PDF | Jul–Jun | Slash FY labels (FY2024/25 → 2025) |
| Oakland | ~444K | ~$2.1B/yr | In PDF | Jul–Jun | Biennial budget; "General Purpose Fund" not "General Fund" |
| San Jose | ~997K | ~$5.3B | OpenGov | Jul–Jun | 100+ funds; 400+ page PDFs; airport/wastewater enterprise |
| Long Beach | ~451K | ~$3.6B | In PDF | **Oct–Sep** | Non-standard FY; Port of LB is separate entity (~$760M) |
| Fresno | ~550K | ~$2.0B | In PDF | Jul–Jun | Enterprise funds (~$899M) exceed General Fund (~$483M) |
| Riverside | ~324K | ~$1.45B/yr | In PDF | Jul–Jun | Biennial budget; municipal electric utility (RPU) |
| Bakersfield | ~417K | ~$853M | OpenBudget | Jul–Jun | Smallest; portal type unconfirmed |

---

## Top Pitfalls (Priority Order)

### 1. Socrata Not Available for Most Cities (Blocking)
Most cities require PDF extraction, not `bulkLoadBudget.js`. Confirm data access method **before** writing any load script for each phase.

### 2. Biennial Budgets — Oakland and Riverside (Blocking)
One PDF covers two fiscal years. Must run two separate extraction passes per city, targeting each year's column explicitly. Plan ~2x effort for these cities.

### 3. Enterprise Fund Inflation — Long Beach, Fresno, Riverside (Blocking)
Enterprise spending exceeds or nearly equals General Fund in some cities. Apply `where_extra` fund-type filter (same pattern as LA). Validate filtered totals against known General Fund figures.

### 4. Port of Long Beach Must Be Excluded (Blocking)
The Port of Long Beach (~$760M) is a separate legal entity — NOT part of the city budget. Extracting from any "all resources" summary risks including it. Load only from longbeach.gov/finance city budget documents.

### 5. Oakland "General Purpose Fund" Terminology (Minor)
Oakland uses "General Purpose Fund" (GPF), not "General Fund." Any fund filter using "General Fund" will miss Oakland's data. Use "General Purpose Fund" or "GPF" in seeder and where_extra.

### 6. Long Beach Non-Standard FY (Minor)
"FY2025" for Long Beach = Oct 2024–Sep 2025 (not Jul 2024–Jun 2025 like every other city). Document in seeder; do not remap year integers.

### 7. Sacramento Slash-Format Labels (Minor)
"FY2024/25" must be normalized to integer `2025` (ending year convention). Add regex to handle both `YYYY/YY` and `YYYY-YY` patterns.

---

## Key Discoveries

**STATE_LABELS fix already implemented.** `EntitySwitcher.tsx` lines 21–26 already contain `CA: 'California'`, `TX: 'Texas'`, `OR: 'Oregon'`. Phase 27 just needs a live app spot-check — no code change required.

**Longview TX revenue needs a new script.** `processLongviewBudget.js` handles operating only. A new `processLongviewRevenue.js` (pdftotext, same PDF already cached at `C:/tmp/longview_budget_fy2526.pdf`) is needed.

**loadSacramentoCSV.js already exists.** Phase 26 is just seeding + running the existing script. Fastest win in the milestone.

**Bakersfield portal needs investigation.** `budget.bakersfieldcity.us` may expose a SODA-compatible endpoint (`GET /api/views/`). Check before defaulting to PDF.

---

## Carry-forwards from v1.5

| Item | Status | Action in v1.6 |
|------|--------|----------------|
| STATE_LABELS fix (EntitySwitcher.tsx) | **Already coded** | Phase 27: verify live app shows "Texas" / "California" / "Oregon" |
| Longview TX revenue | Not loaded | Phase 27: write `processLongviewRevenue.js`, seed data_source, load |

---

## Enrichment Cost Estimate

~315 enrichment calls across 7 cities (7 × ~45 categories avg):
- At ~$0.0002/call = **~$0.06 total**
- Well under the $5 per-run threshold
- Can run all cities in a single milestone without cost concern

---

## Population Data Source

Use `sub-est2024_06.csv` (California sub-county estimates, SUMLEV=162) — same Census Bureau methodology as TX cities (`sub-est2024_48.csv`) and OR cities.

---

## Build Order Summary

1. **Phase 26 — Sacramento CA**: Seed municipality + data_sources → run `loadSacramentoCSV.js` → enrich
2. **Phase 27 — Longview TX revenue + STATE_LABELS**: Spot-check EntitySwitcher live, write + run Longview revenue script
3. **Phase 28 — Oakland + San Jose**: Confirm Socrata dataset IDs → seed → `bulkLoadBudget.js` → enrich
4. **Phase 29 — Long Beach + Bakersfield**: Investigate Bakersfield portal → pdfplumber extractors → seed → load → enrich
5. **Phase 30 — Fresno + Riverside**: pdfplumber extractors (biennial handling for Riverside) → seed → load → enrich
