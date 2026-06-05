# Phase 29: Long Beach + Bakersfield CA Data Load - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 29-long-beach-bakersfield-ca-data-load
**Areas discussed:** Long Beach FY convention, Bakersfield extraction approach, FY depth, Plan structure

---

## Long Beach FY Convention

### FY label storage

| Option | Description | Selected |
|--------|-------------|----------|
| Ending year | FY2025 = Oct 2024–Sep 2025; integer 2025 in DB. Matches CA convention (Sacramento, Oakland, San Jose). | ✓ |
| Starting year | FY2025 = Oct 2025–Sep 2026; out of step with other CA cities. | |
| You decide | Researcher picks whichever matches PDF labeling and CA convention. | |

**User's choice:** Ending year  
**Notes:** Standard ending-year convention; consistent with all other CA cities in the milestone.

### Documenting non-standard FY period

| Option | Description | Selected |
|--------|-------------|----------|
| Note in seeder comment only | Code comment in seeder: `// Long Beach FY runs Oct 1 – Sep 30; stored as ending year`. No DB or UI change. | ✓ |
| Note in data_source name | Include "(FY Oct–Sep)" in the data_source row name. | |
| No note needed | Ending-year convention is enough; FY period is a data footnote. | |

**User's choice:** Note in seeder comment only  
**Notes:** Consistent with how Sacramento FY label normalization was handled.

---

## Bakersfield Extraction Approach

### SODA vs PDF

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher checks SODA first | If `budget.bakersfieldcity.us` works, use `bulkLoadBudget.js`; fall back to PDF if broken/incomplete. | ✓ |
| PDF-only, skip SODA | REQUIREMENTS says "No API calls" — go straight to pdfplumber/pdftotext. | |
| You decide | Researcher picks fastest reliable path. | |

**User's choice:** Researcher checks SODA first  
**Notes:** SODA path would eliminate the Python extractor entirely for Bakersfield — faster to implement. REQUIREMENTS.md note about "no API calls" refers to the Open Budget portal specifically; SODA is a different endpoint worth verifying.

### PDF tool (if needed)

| Option | Description | Selected |
|--------|-------------|----------|
| pdfplumber | Consistent with all CA cities in milestone (Fremont, Oakland, San Jose). Templates available. | ✓ |
| pdftotext | Simpler; used for TX cities. Better for text-heavy predictable layouts. | |

**User's choice:** pdfplumber  
**Notes:** Consistent choice; adapt `extractOakland.py` or `extractFremont.py` as template.

---

## FY Depth

### Long Beach FY depth

| Option | Description | Selected |
|--------|-------------|----------|
| FY2022–2026 (4–5 years) | Matches Oakland/Sacramento depth; gives historical context. | ✓ |
| FY2025–2026 only | Fastest; historical context deferred. | |
| Researcher decides | Researcher checks availability and consistent format. | |

**User's choice:** FY2022–2026  
**Notes:** Researcher loads as many years as have consistent PDF format back to at least FY2022.

### Bakersfield FY depth

| Option | Description | Selected |
|--------|-------------|----------|
| FY2022–2026 (4–5 years) | Same depth as Long Beach; consistent within the phase. | ✓ |
| FY2025–2026 only | Bakersfield is smallest city; minimal history acceptable. | |
| Researcher decides | Researcher determines what's available. | |

**User's choice:** FY2022–2026  
**Notes:** Same depth target for both cities; researcher determines actual available years.

---

## Plan Structure

### Number of plans

| Option | Description | Selected |
|--------|-------------|----------|
| 4 plans (same as Phase 28) | Seed both → Long Beach → Bakersfield → Enrich+verify. Parallel city work, same shape as Oakland+San Jose. | ✓ |
| 3 plans | Seed both → LB+BF combined data loads → Enrich+verify. Bakersfield is smaller; combining is reasonable. | |
| You decide | Planner picks based on extraction complexity. | |

**User's choice:** 4 plans  
**Notes:** Keeps the Phase 28 pattern; Bakersfield going to SODA makes Plan 3 potentially very short.

### Enrichment cost threshold

| Option | Description | Selected |
|--------|-------------|----------|
| $0.10 gate (same as Phase 28) | Estimate combined LB+BF enrichment before running; stop if approaching $0.10. | ✓ |
| Project-wide $5 threshold | LB+BF combined enrichment ≈ $0.02 total; $0.10 gate is effectively a no-op. | |

**User's choice:** $0.10 gate  
**Notes:** Consistent with Phase 28 practice; maintains the tight cost discipline pattern.

---

## Claude's Discretion

- Exact FY year count for each city: researcher determines based on available PDFs/SODA data with consistent format.
- Whether to use SODA vs PDF for Bakersfield: researcher verifies SODA endpoint quality.
- Page-range extraction approach for Long Beach: researcher picks based on actual PDF layout.
- Exact data_source row names: planner determines; must match processor lookups.

## Deferred Ideas

- Bakersfield county linking (Kern County not yet in DB) — future phase.
- Pre-FY2022 historical data for either city — out of milestone scope.
- Port of Long Beach data — explicitly out of scope (separate government entity).
