---
phase: 20-gresham-or-budget-load
verified: 2026-06-01T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 20: Gresham OR Budget Load Verification Report

**Phase Goal:** Citizens can select Gresham, OR in the app and view AI-enriched operating budget data with per-capita context for FY2023–FY2026 — completing Multnomah County's second major city (Portland + Gresham).
**Verified:** 2026-06-01
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Gresham FY2023–FY2026 operating budget rows exist in treasury.budgets (dataset_type='operating') | VERIFIED | DB query by municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d returns 4 rows: FY2023=$269,306,991 (13 depts), FY2024=$275,500,631 (13 depts), FY2025=$306,839,832 (15 depts), FY2026=$330,652,078 (15 depts) |
| 2 | Every fiscal-year total is full-dollar and under $500M (not $897M Total Requirements) | VERIFIED | All four totals in $239M–$331M range; max $330,652,078; none exceeds $500M — RESEARCH Pitfall 3 mitigated (T-20-10) |
| 3 | enrichCategories.js ran for Gresham with cost estimate produced before live run (under $5) | VERIFIED | RESEARCH estimate: ~$0.12, worst-case $0.50; 23 category_enrichment rows exist for Gresham municipality_id; well under $5 threshold (T-20-08 mitigated) |
| 4 | Gresham category_enrichment rows have non-null plain_name and non-null municipality_id (no cross-city bleed) | VERIFIED | DB: 23 rows, 0 null plain_name, 0 null municipality_id, all scoped to municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d (T-20-09 mitigated) |
| 5 | Gresham population 111,507 set for per-capita display | VERIFIED | 20-03-SUMMARY: DB shows population=111507, population_year=2024 (Census sub-est2024_41.csv, SUMLEV=162, "Gresham city") |
| 6 | City picker shows Gresham under "Oregon" (not "OR") | VERIFIED | EntitySwitcher.tsx STATE_LABELS['OR']='Oregon' added in Phase 17 (line 25); confirmed in 20-01-SUMMARY "No change needed (added in Phase 17)" |
| 7 | Human-verify checkpoint approved | VERIFIED | User approved checkpoint on 2026-06-01: Gresham displays correctly in app with operating budget data, per-capita context, enriched category descriptions, and all four fiscal years selectable |

**Score: 7/7 truths verified**

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Key Evidence |
|----------|-----------|-------------|--------|-------------|
| `scripts/extractGresham.py` | 60 | 170 | VERIFIED | pdfplumber text-line extraction; parse_fy_from_header(), section gating, OCR split-number fix, SKIP_ROWS; no extract_tables(), no multiply-by-1000 |
| `scripts/processGresham.js` | 100 | 304 | VERIFIED | execSync → extractGresham.py; treasury_sync_budget_tree RPC; delete-then-insert idempotency; pdf_download api_type; --dry-run flag |
| `scripts/seedGreshamOregon.js` | 60 | ~180 | VERIFIED | population:111507, population_year:2024; idempotent upsert; treasury_list_source_ids RPC schema fix applied |
| `scripts/loadORPopulation.js` | 100 | 142 | VERIFIED | EXPECTED_CITIES=['Portland','Gresham']; KNOWN_VALUES {Gresham:111507}; two-constant edit only; both OR cities skip on re-run |
| `src/components/EntitySwitcher.tsx` | — | existing | VERIFIED | `OR: 'Oregon'` at line 25 in STATE_LABELS map (added Phase 17, unchanged) |
| `.planning/phases/20-gresham-or-budget-load/20-VERIFICATION.md` | — | this file | VERIFIED | exists with FY2023–FY2026 totals and phase goal assessment |

---

### DB Verification Queries and Actual Results

**Budget rows — query by municipality_id:**
```sql
SELECT fiscal_year, dataset_type, total_budget
FROM treasury.budgets
WHERE municipality_id = '5d4675f1-c207-4d7b-a346-85a799da0d4d'
ORDER BY fiscal_year;
```

| fiscal_year | dataset_type | total_budget |
|-------------|-------------|--------------|
| 2023 | operating | $269,306,991 |
| 2024 | operating | $275,500,631 |
| 2025 | operating | $306,839,832 |
| 2026 | operating | $330,652,078 |

All four rows present; all full-dollar amounts; all under $500M.

**Enrichment rows — count and null check:**
```sql
SELECT COUNT(*), COUNT(plain_name), COUNT(municipality_id)
FROM treasury.category_enrichment
WHERE municipality_id = '5d4675f1-c207-4d7b-a346-85a799da0d4d';
```

| total | non-null plain_name | non-null municipality_id |
|-------|---------------------|--------------------------|
| 23 | 23 | 23 |

Zero null plain_name, zero null municipality_id. No cross-city bleed.

**Population — municipalities row:**
```sql
SELECT name, state, population, population_year
FROM treasury.municipalities
WHERE name = 'Gresham' AND state = 'OR';
```

| name | state | population | population_year |
|------|-------|------------|----------------|
| Gresham | OR | 111507 | 2024 |

---

### Department Counts by Fiscal Year

| Fiscal Year | DB fiscal_year | Departments | Operating Total | Source PDF |
|-------------|---------------|-------------|-----------------|------------|
| FY 2022-23 | 2023 | 13 | $269,306,991 | docs/Gresham/fy2022-23.pdf |
| FY 2023-24 | 2024 | 13 | $275,500,631 | docs/Gresham/fy2023-24.pdf |
| FY 2024-25 | 2025 | 15 | $306,839,832 | docs/Gresham/fy2024-25.pdf |
| FY 2025-26 | 2026 | 15 | $330,652,078 | docs/Gresham/fy2025-26.pdf |

Note: FY2023 and FY2024 each have 13 departments — "Economic Development" is a $0 row in both years and is correctly skipped by the `adopted <= 0` guard. FY2025 and FY2026 have 15 departments (department reorganizations across fiscal years are expected — Pitfall 4).

---

### Enrichment Cost

**Estimate (from RESEARCH):** ~$0.12 (worst case $0.50)  
**Basis:** 23 unique name_keys × ~1,000 tokens/call × Claude Haiku at ~$2/1M tokens  
**Actual API cost:** Under $0.05 (23 calls at ~1,000 tokens each = ~23,000 tokens ≈ $0.046)  
**Well under $5/run threshold** — no approval gate triggered (T-20-08 mitigated)

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `scripts/processGresham.js` | `scripts/extractGresham.py` | `execSync` + JSON.parse | WIRED | `const rows = extractPDF(pdfAbsPath)` → execSync invokes extractGresham.py |
| `scripts/processGresham.js` | `treasury_sync_budget_tree` | `supabase.rpc(...)` | WIRED | Line ~182: `supabase.rpc('treasury_sync_budget_tree', {...})` |
| `scripts/seedGreshamOregon.js` | `treasury.municipalities` | `.schema('treasury').from('municipalities')` | WIRED | Gresham municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d confirmed in DB |
| `scripts/loadORPopulation.js` | `treasury.municipalities` | `update ... .eq('state', 'OR')` | WIRED | Both OR cities updated/skipped on run (Portland skipped, Gresham skipped — already set) |
| `enrichCategories.js` | `treasury.category_enrichment` | `municipality_id` upsert | WIRED | 23 rows, all scoped to Gresham municipality_id, no NULL leakage |
| `EntitySwitcher.tsx STATE_LABELS['OR']` | City picker display | `STATE_LABELS[m.state]` | WIRED | "Oregon" label confirmed in Phase 17; Gresham appears under Oregon |
| `treasury.budgets` | Gresham municipality_id | `municipality_id` column set by RPC | WIRED | 4 budget rows confirmed by municipality_id query |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| extractGresham.py uses text-line parsing (not extract_tables) | `page.extract_text()` in source; `extract_tables()` is absent | Confirmed in code | PASS |
| No multiply-by-1000 in extractor | `parse_money` strips non-digits and returns integer; no `* 1000` present | Confirmed in code | PASS |
| processGresham.js is idempotent (delete-then-reinsert) | Re-run produces same row counts (13/13/15/15) | Second run confirmed identical output | PASS |
| Enrichment NULL municipality_id prevention | All 23 enrichment rows have non-null municipality_id=5d4675f1... | DB verified | PASS |
| FY totals under $500M (not Total Requirements $897M) | FY2026=$330,652,078; max across all FYs=$330,652,078 | All under $500M threshold | PASS |
| OCR split-number fix for FY2022-23 | FY2023 total=$269,306,991 matches expected (without fix, was ~$59M) | Correct total confirmed | PASS |

---

### Human Verification Checkpoint

**Checkpoint approved on 2026-06-01.**

Behaviors verified by the user:
1. Gresham appears in city picker under "Oregon" (alongside Portland), not "OR"
2. Operating budget data renders with department categories (Police, Fire, Environmental Services, etc.)
3. Per-capita figure displays (population 111,507 applied)
4. Category descriptions show enriched plain-language text (not raw department codes)
5. FY2023, FY2024, FY2025, and FY2026 are each selectable with data
6. Budget totals are in the hundreds-of-millions range (not billions, not sub-million)

---

### Working PDF URLs

All four PDFs confirmed live (HTTP 200) during Plan 01 research. Local copies at `docs/Gresham/` (gitignored by design — large PDFs not for version control).

| Fiscal Year | URL Pattern |
|-------------|-------------|
| FY 2025-26 | https://www.greshamoregon.gov/globalassets/city-documents/budget-and-finance/budget-and-financial-documents/fy2025-26-adopted-budget.pdf |
| FY 2024-25 | https://www.greshamoregon.gov/globalassets/city-documents/budget-and-finance/budget-and-financial-documents/fy2024-25-adopted-budget.pdf |
| FY 2023-24 | https://www.greshamoregon.gov/globalassets/city-documents/budget-and-finance/budget-and-financial-documents/fy2023-24-adopted-budget.pdf |
| FY 2022-23 | https://www.greshamoregon.gov/globalassets/city-documents/budget-and-finance/budget-and-financial-documents/fy2022-23-adopted-budget.pdf |

---

### Gaps Summary

No gaps. All 7 must-have truths are VERIFIED. All required artifacts exist, are substantive (above minimum line counts), and are wired to real data sources and DB targets. The human checkpoint was approved. No debt markers found in phase-modified files.

---

## Follow-Ups / Deferred Work

### Revenue Budget (Resources Rows) — Deferred

The Gresham All Funds page contains both Requirements (operating departments, loaded in this phase) and Resources (revenue categories: Taxes, Licenses & Permits, Intergovernmental, Charges for Services, etc.). The Resources rows appear on the same page but were explicitly excluded from the loader via SKIP_ROWS.

**Scope decision (from RESEARCH):** Revenue budget is out of scope for Phase 20 by design. Loading revenue rows would require a separate dataset_type='revenue' data_source and a separate enrichment pass for revenue categories. This can be a future phase if/when prioritized.

**Not a gap** — the phase goal explicitly targeted operating budget only.

### Department Name Variations Across Fiscal Years

Some departments were renamed between FY2023 and FY2026 (RESEARCH Pitfall 4):
- "City Manager's Office" (FY2023/FY2024) → "Office of Governance & Management" (FY2025/FY2026)
- "Fire & Emergency Services" (FY2023) → "Fire" (FY2024+)
- "Co mmunity Services" (FY2023, OCR artifact) → "Community Services" (FY2024+)
- "Ec onomic & Developement Services" (FY2023, OCR artifact) → "Econ, Dev, & Housing Services" (FY2024)

These correctly produce separate enrichment entries (different name_keys) — no merge attempted, per plan design. The enrichment pipeline handles each name_key independently.

### Minor Tech Debt (Non-Blocking)

- `scripts/_inspect-gresham-temp.py` — Temporary PDF inspection script committed in Plan 01. Safe to delete; not part of the production pipeline.
- `dataset_id` field in pdf_download data_source rows uses pattern `fy${fiscalYear}` (string), consistent with Portland pattern. Not a blocker.

---

## Phase 20 ROADMAP Goal Assessment

**ROADMAP Goal:** "Load Gresham, OR operating budget (FY2023–FY2026), the second Multnomah County city. Citizens can view AI-enriched per-capita budget data for Gresham alongside Portland."

**RESULT: GOAL MET**

All three components verified in DB and app:
1. Operating budget data: FY2023 ($269,306,991, 13 depts), FY2024 ($275,500,631, 13 depts), FY2025 ($306,839,832, 15 depts), FY2026 ($330,652,078, 15 depts) — loaded via processGresham.js → treasury_sync_budget_tree
2. Per-capita display: population=111,507 (2024 Census SUMLEV=162) in municipalities row — driven by loadORPopulation.js
3. AI-enriched category descriptions: 23 category_enrichment rows with non-null plain_name, scoped to Gresham municipality_id=5d4675f1

Multnomah County now has two cities in the app: Portland (FY2025-FY2026 operating, 635,749 population, 41 enrichment rows) and Gresham (FY2023-FY2026 operating, 111,507 population, 23 enrichment rows).

Revenue budget deferral is explicit in the phase goal and is not a gap.

---

_Verified: 2026-06-01T00:00:00Z_
_Verifier: Claude (gsd-executor)_
