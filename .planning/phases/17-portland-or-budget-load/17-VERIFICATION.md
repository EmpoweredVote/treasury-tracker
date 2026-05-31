---
phase: 17-portland-or-budget-load
verified: 2026-05-31T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 17: Portland OR Budget Load Verification Report

**Phase Goal:** Citizens can view Portland, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. (Revenue budget deferred per D-03 — Portland publishes revenue only in PDF Vol 2 at fund level, requiring a separate pipeline.)

**Verified:** 2026-05-31
**Status:** passed
**Re-verification:** No

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Portland FY2025 and FY2026 operating budget rows exist in treasury.budgets | VERIFIED | FY2025 total=$8,045,475,348; FY2026 total=$8,482,617,933; both billions-scale (not thousands error) |
| 2 | enrichCategories.js ran for Portland with cost estimate produced before live enrich (under $5/run) | VERIFIED | Dry-run estimated ~$0.0003/run (41 categories × ~1000 tokens × $0.25/1M tokens); cost well under $5 threshold |
| 3 | Portland category_enrichment rows have non-null plain_name, scoped to Portland municipality_id | VERIFIED | 41 enrichment rows, 0 null plain_name, all scoped to municipality_id=2abac6c2-78b0-466a-98d1-6cd38e19a411 |
| 4 | Portland population 635,749 set for per-capita display | VERIFIED | municipalities row: population=635749, population_year=2024 |
| 5 | City picker shows Portland under "Oregon" (not "OR") | VERIFIED | OR: 'Oregon' added to STATE_LABELS in EntitySwitcher.tsx (commit f9ce827) |
| 6 | Human-verify checkpoint approved | VERIFIED | Checkpoint approved by user on 2026-05-31 — Portland renders in app with FY2025+FY2026, per-capita, and enriched descriptions |

**Score: 6/6 truths verified**

---

### Required Artifacts: treasury.budgets

| City | Type | FY | Total Budget | Pass |
|------|------|----|-------------|------|
| Portland | operating | 2025 | $8,045,475,348 | PASS |
| Portland | operating | 2026 | $8,482,617,933 | PASS |

Both totals match the dry-run figures from Plan 02 exactly — confirming the live load wrote correct full-dollar amounts (no thousands-vs-dollars error).

**Bureau counts:**
- FY2025: 39 bureaus (FY 2024-25 Adopted Budget Vol 1)
- FY2026: 34 bureaus (FY 2025-26 Adopted Budget Vol 1)

The 5-bureau difference reflects Portland's bureau consolidation between fiscal years (confirmed by inspecting both PDFs — not a data error).

### Notable Bureau Amounts (FY2026 spot-check)

| Bureau | Total Appropriation |
|--------|---------------------|
| Water Bureau | $2,071,512,063 |
| Bureau of Environmental Services | $1,425,353,758 |
| Bureau of Planning & Sustainability | $838,539,246 |
| Portland Bureau of Transportation | $617,257,226 |
| Portland Parks & Recreation | $541,225,747 |
| Portland Police Bureau | $316,692,335 |

### Required Artifacts: treasury.category_enrichment

| City | Municipality ID | Rows | Null plain_name | Null municipality_id |
|------|----------------|------|-----------------|---------------------|
| Portland | 2abac6c2-78b0-466a-98d1-6cd38e19a411 | 41 | 0 | 0 |

No NULL municipality_id rows (enrichment scoping bug not triggered — see project memory enrichment-scoping fix). All 41 rows correctly scoped to Portland's municipality_id.

### Required Artifacts: treasury.municipalities

| City | State | Population | Population Year |
|------|-------|-----------|----------------|
| Portland | OR | 635,749 | 2024 |

Source: US Census Bureau FIPS-41 Oregon subcounty estimate file (sub-est2024_41.csv), SUMLEV=162 filter, loaded by scripts/loadORPopulation.js.

### Required Artifacts: treasury.data_sources

| City | Type | api_type | fiscal_years | Source |
|------|------|----------|-------------|--------|
| Portland | operating | pdf_download | [2025, 2026] | portland.gov Adopted Budget Vol 1 |

Data source upserted per fiscal year by processPortland.js (one data_source row per FY, per the loader pattern).

---

### Working PDF URLs

Both PDFs downloaded successfully to docs/Portland/ (gitignored — local only):

| Fiscal Year | PDF Name | URL | Size | Status |
|-------------|----------|-----|------|--------|
| FY 2025-26 (fiscal_year=2026) | FY 2025-26 City of Portland Adopted Budget Vol 1 | https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download | 6.39 MB | HTTP 200, %PDF verified |
| FY 2024-25 (fiscal_year=2025) | FY 2024-25 City of Portland Adopted Budget Vol 1 | https://www.portland.gov/sites/default/files/2024/fy-2024-25-city-of-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets.pdf | 5.07 MB | HTTP 200, %PDF verified |

Note: The FY2025-26 URL was corrected from RESEARCH (CMS path changed); the corrected URL was found by fetching the adopted budget page directly. Documented as Rule 1 deviation in 17-01-SUMMARY.md.

---

### Enrichment Cost

| Metric | Value |
|--------|-------|
| Categories enriched | 41 |
| Tokens per call (estimated) | ~1,000 |
| Model rate | ~$0.25/1M tokens (Haiku pricing per RESEARCH) |
| Estimated cost | ~$0.0003 per run |
| $5 threshold breached? | No (estimated cost << $5) |
| Actual API calls | 41 (one per category name_key) |
| Enrichment idempotent? | Yes — name_key upsert scoped to municipality_id |

The dry-run count and cost estimate were produced before the live enrichment run per T-17-07 mitigation (and per feedback_api_cost_threshold rule). Cost was well under $5; no human approval of cost was needed.

---

### Extraction Method

| Component | Method | Source Pages |
|-----------|--------|-------------|
| extractPortland.py | pdfplumber extract_tables(), "Appropriation Schedule" page keyword detection | Pages 118-122 (FY2025-26); equivalent pages in FY2024-25 PDF |
| processPortland.js | execSync(python3 extractPortland.py), buildOperatingTree, treasury_sync_budget_tree RPC | — |
| Subtotal detection | row[0].endswith('Subtotal') AND col[5] (Total Appropriation) numeric | — |
| Amount format | Full dollars, comma-separated (no thousands multiplier) | — |

---

## Human Verification

Completed and approved by user on 2026-05-31 (documented in 17-04 plan Task 3 checkpoint approval).

Items verified by human:
- Portland appears in city picker under "Oregon" (not abbreviated "OR")
- FY2025 operating budget renders with bureau-level categories
- FY2026 operating budget renders and is selectable from fiscal year toggle
- Per-capita figure displays (population 635,749 applied, labeled with 2024 Census estimate)
- Category descriptions show enriched plain-language text (not raw bureau codes)
- Both FY2025 and FY2026 are selectable with data in each

---

## Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| budget_categories.link_key | category_enrichment.name_key per municipality_id | WIRED | 41 Portland enrichment rows; name_key dedup on Portland municipality_id |
| budgets.municipality_id | municipalities.id (2abac6c2) | WIRED | Portland FY2025+FY2026 budgets reference correct municipality UUID |
| municipalities.population | per-capita display | WIRED | 635749 / 2024 drives per-capita calculation in app |
| STATE_LABELS['OR'] | 'Oregon' in city picker | WIRED | EntitySwitcher.tsx commit f9ce827 |

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Portland FY2025 operating budget loaded | SATISFIED | 39 bureaus, $8,045,475,348 total |
| Portland FY2026 operating budget loaded | SATISFIED | 34 bureaus, $8,482,617,933 total |
| Category enrichment scoped to Portland municipality_id | SATISFIED | 41 rows, 0 null municipality_id |
| Per-capita display with 2024 Census population | SATISFIED | population=635749, population_year=2024 |
| City picker shows Oregon (not OR) | SATISFIED | STATE_LABELS OR: 'Oregon' |
| Loader idempotent | SATISFIED | Second run confirms unchanged row counts |

---

## Anti-Patterns Found

None. No source files introduced anti-patterns. extractPortland.py and processPortland.js follow established project patterns (pdfplumber extract_tables, treasury_sync_budget_tree RPC, full-dollar amounts, ending-year fiscal_year convention).

---

## Follow-Ups / Deferred Work

### D-03: Portland Revenue Budget (Deferred)

Portland's revenue budget is published only in Adopted Budget Vol 2, structured at the fund level rather than the bureau level used by Vol 1. This requires a separate extraction pipeline and is out of scope for Phase 17.

**Reason deferred:** Vol 2 PDF (fund-level revenue) is structurally different from Vol 1 (bureau-level operating). A dedicated extractor for fund-level revenue tables would be needed. Phase 17 goal is met without revenue data (operating budget is the primary public interest dataset).

**Future work:** A follow-on phase (Phase 18 or later) could add `processPortlandRevenue.js` targeting Vol 2 fund tables.

### Tech Debt Notes

- `scripts/_inspect-portland-temp.py` — Temporary PDF inspection script created in Plan 01 for structure discovery. Safe to delete; not used in production pipeline.
- Portland data source row uses `dataset_id` field set to null (pdf_download sources have no external dataset ID). Pre-existing pattern (same as Fremont); does not affect UI or enrichment.
- FY2025 bureau count (39) differs from FY2026 (34): this is correct and reflects Portland's bureau consolidation. No downstream fix needed, but the extractor's bureau count will naturally vary by fiscal year.

---

## Phase 17 ROADMAP Goal Assessment

**ROADMAP Goal:** "Citizens can view Portland, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions."

**RESULT: GOAL MET**

All three components are live:
1. Operating budget data: FY2025 ($8.045B, 39 bureaus) and FY2026 ($8.483B, 34 bureaus) in treasury.budgets
2. Per-capita display: population=635,749 (2024 Census) applied to Portland municipality row
3. AI-enriched category descriptions: 41 category_enrichment rows with plain_name, scoped to Portland

The parenthetical note — "Revenue budget deferred to a follow-up per D-03" — is documented and the deferral is intentional. The goal statement explicitly scopes to operating budget data.

---

_Verified: 2026-05-31_
_Verifier: Claude (gsd-executor, Phase 17 Plan 04)_
