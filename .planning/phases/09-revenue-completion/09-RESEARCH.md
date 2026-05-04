# Phase 9: Revenue Completion - Research

**Researched:** 2026-05-04
**Domain:** Revenue data verification, pdftotext-based revenue extraction, Haiku vision pipeline for ACFR revenue sections
**Confidence:** HIGH (all findings from direct codebase inspection)

## Summary

Phase 9 has two distinct workstreams: (1) verifying and gap-filling revenue for four cities already in the DB (Plano, McKinney, Frisco, Allen), and (2) extracting revenue from ACFR PDFs for two cities with no revenue data yet (Prosper, Celina). The phase is almost entirely pipeline execution rather than new code — the required scripts already exist and have been proven in production.

For 09-01 (verification), the critical first step is a DB query to establish ground truth: which cities have `dataset_type = 'revenue'` rows in `treasury.data_sources`, and which fiscal years are actually loaded in `treasury.budgets`. Revenue for McKinney/Allen/Frisco was loaded by `scripts/processRevenuePDF.js` (pdftotext-based, no AI). Revenue for Plano was loaded by `scripts/processPlanoRevenue.js` (also pdftotext-based). Neither script requires an API key. Both scripts are idempotent: they upsert data_sources and truncate-then-reload budgets rows.

For 09-02 and 09-03 (Prosper and Celina), the Haiku vision pipeline (`scripts/bulkLoadPDF.js`) is the correct tool. The ACFR PDFs for both cities are already seeded in `treasury.data_sources` as `dataset_type: 'operating'`. Revenue extraction requires creating new data_source rows with `dataset_type: 'revenue'` pointing to the same ACFR PDFs. The pipeline needs a revenue-aware Haiku prompt so it classifies revenue pages as `budget_table` rather than `other`.

**Primary recommendation:** Before writing any code, query the DB to trace which revenue data_source rows exist and which fiscal years are loaded. This determines whether 09-01 is read-only verification or requires gap-filling runs of existing scripts.

## Standard Stack

All tools are already installed. No new npm packages needed.

### Core (already in use)
| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `scripts/processPlanoRevenue.js` | current | Plano revenue from local PDFs | pdftotext-based, no AI, idempotent |
| `scripts/processRevenuePDF.js` | current | McKinney/Allen/Frisco revenue from budget PDFs | pdftotext-based, no AI, idempotent |
| `scripts/bulkLoadPDF.js` | current | Haiku vision pipeline for ACFR PDFs | Used for Prosper/Celina revenue |
| `scripts/seedPDFDataSources.js` | current | Create data_sources rows | ACFR URLs for Prosper/Celina already defined |
| `@supabase/supabase-js` | ^2.100.1 | DB access, `treasury_sync_budget_tree` RPC | Already installed |
| `pdftotext` (system) | poppler-utils | Text extraction from budget PDFs | Already installed on this machine |
| `pdftoimg-js` | 0.2.5 | PDF→PNG rendering for Haiku | Already installed |
| `@anthropic-ai/sdk` | 0.80.0 | Claude Haiku API calls | Already installed |

### Key constants (verified in codebase)
| Constant | Value | Where |
|----------|-------|-------|
| Haiku model | `claude-haiku-4-5-20251001` | `bulkLoadPDF.js:292` |
| max_tokens | 8192 | `bulkLoadPDF.js:293` |
| Default confidence threshold | 70 | `bulkLoadPDF.js:51` |
| RPC name | `treasury_sync_budget_tree` | all load scripts |
| p_triggered_by | `'bulk_load'` | all load scripts |

### ACFR URLs already in codebase
| City | URL constant | Location |
|------|-------------|----------|
| Prosper ACFR FY2025 | `https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682` | `seedPDFDataSources.js:42` |
| Celina ACFR FY2025 | `https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025` | `seedPDFDataSources.js:43` |

## Architecture Patterns

### Existing Revenue Load Pattern (McKinney/Allen/Frisco)

`processRevenuePDF.js` handles McKinney, Allen, and Frisco revenue from their operating budget PDFs using pdftotext. Each city has a distinct parser format:

- `'mckinney'` format — "STATEMENT OF GENERAL FUND REVENUES" — used for McKinney FY2021–FY2025
- `'frisco'` format — "GENERAL FUND SCHEDULE OF REVENUES" — used for Frisco FY2026
- `'allen'` format — "REVENUE - DETAIL" — used for Allen FY2026

The SOURCES array in `processRevenuePDF.js` defines all city/year/URL combinations. If a fiscal year is missing from the SOURCES array, that year will never load. Verify the SOURCES list covers all years in scope before concluding data is missing from the DB.

**Current SOURCES coverage:**
- McKinney: FY2021, FY2022, FY2023, FY2024, FY2025 (5 years — matches phase scope FY2021–2025)
- Allen: FY2026 only (single year via Allen budget PDF format)
- Frisco: FY2026 only (single year via Frisco budget PDF format)

### Existing Revenue Load Pattern (Plano)

`processPlanoRevenue.js` handles Plano revenue from local operating budget PDFs. PDFS map covers doc years 2019–2025 (FY2019–FY2025, with FY2021 absent). Each PDF contains the prior fiscal year's actuals alongside the current budget year. The script loads:
- `approved_amount` = Budget FY-1 column
- `actual_amount` = Re-Est FY-1 column
- `fiscal_year` = the budget year (e.g. "2023-24" → 2024)

**Current PDFS map coverage:**
- doc year 2019 → loads FY detected from PDF (likely FY2019)
- doc years 2020, 2022, 2023, 2024, 2025 → corresponding fiscal years
- FY2021 is absent (no 2020-21 PDF in the PDFS map and not on disk)
- FY2026 is commented out (scrambled label-value alignment)

**Phase scope is FY2018–FY2024.** The FY2018 revenue year would need to come from the 2018-19 budget PDF (doc year 2019). The `processPlanoRevenue.js` script likely extracts FY2019 budget data from that PDF, not FY2018 actuals. This means FY2018 may not be extractable from these PDFs without additional work. Treat as an open question to resolve during 09-01.

### Haiku Pipeline Pattern for Revenue (Prosper/Celina)

`bulkLoadPDF.js` passes `ds.dataset_type` to the `treasury_sync_budget_tree` RPC (`bulkLoadPDF.js:478`). This means:
- An operating budget data_source → loads as `operating`
- A revenue data_source → loads as `revenue`

The existing operating data_sources for Prosper (`'Prosper ACFR FY2025'`, `dataset_type: 'operating'`) and Celina (`'Celina ACFR FY2025'`, `dataset_type: 'operating'`) are the correct PDFs for revenue extraction — ACFR PDFs contain both operating budget and revenue tables. The approach is:
1. Seed new data_source rows: `'Prosper Revenue FY2025'` and `'Celina Revenue FY2025'` with `dataset_type: 'revenue'`, pointing to the same ACFR URLs
2. Run `bulkLoadPDF.js --source "Prosper Revenue FY2025" --fiscal-year 2025`

The pipeline will process all pages and classify each as `budget_table` or not. Revenue tables in ACFRs look structurally similar to expenditure tables (rows with amounts, categories), so Haiku should classify them as `budget_table`. The issue is that without prompt guidance, Haiku may extract revenue rows with `approved_amount`/`actual_amount` field names intact (which is correct — the RPC accepts these fields regardless of whether the data is revenue or expenditure).

### Revenue Prompt Engineering Pattern

The existing `EXTRACTION_PROMPT_BASE` is phrased for operating budgets ("budget_table", "department/fund/adopted/actual columns", section examples are "Public Safety", "Public Works"). For revenue extraction from ACFRs, the prompt should:

1. Signal to Haiku that this is a revenue context so it correctly identifies revenue tables as `budget_table`
2. Keep `approved_amount`/`actual_amount` field names (the RPC uses these regardless)
3. Mention revenue-specific column names: "budgeted revenue", "actual revenue", "receipts", "revenue sources"

The recommended approach is a revenue-specific prompt variant passed via a wrapper function in the seeder or a modified data_source `column_mapping` that the pipeline respects. The simplest approach: add a `--dataset-type revenue` CLI flag to `bulkLoadPDF.js` that selects a revenue-specific prompt, OR create separate logic that injects a revenue context line into the prompt (analogous to how `buildExtractionPrompt(sectionContext)` injects section context).

**Simpler alternative:** Because ACFRs process ALL pages and revenue tables are legitimately `budget_table` shaped, the existing prompt may work without modification — Haiku recognizes revenue tables as tabular financial data. Run a `--dry-run` first to validate before committing to prompt changes.

### Data Source Upsert Pattern

The select-by-composite-key then insert/update pattern is used in all revenue scripts:

```javascript
// From processRevenuePDF.js lines 676-690
const { data: existing } = await supabase.schema('treasury').from('data_sources')
  .select('id')
  .eq('municipality_id', muniId)
  .eq('api_type', 'pdf_download')
  .eq('dataset_id', 'fy' + fiscalYear)
  .eq('dataset_type', 'revenue')
  .maybeSingle();
if (existing?.id) {
  // update
} else {
  // insert
}
```

`treasury.data_sources` has no unique constraint on `name`. Always select by `(municipality_id, api_type, dataset_id, dataset_type)` composite, not by name.

### Truncate-and-Reload Pattern

All revenue load scripts (and `bulkLoadPDF.js`) use truncate-then-RPC:

```javascript
// Clear existing rows for this data_source + fiscal_year
await supabase.schema('treasury').from('budgets')
  .delete()
  .eq('data_source_id', ds.id)
  .eq('fiscal_year', fiscalYear);

// Load via RPC
await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year: fiscalYear,
  p_dataset_type: 'revenue',  // <-- critical for revenue
  p_total: total,
  p_tree: jsonTree,
  p_row_count: rows.length,
  p_triggered_by: 'bulk_load',
});
```

### Revenue Visibility in App

The app's revenue tab is controlled by `DatasetTabs.tsx`. The tab appears when `availableDatasets` includes `'revenue'`. This is populated in `App.tsx` from `entityDatasets` which comes from `treasury.data_sources` rows filtered by city. Revenue data becomes visible when:
1. A `data_sources` row with `dataset_type = 'revenue'` exists for the municipality
2. A `budgets` row with matching `dataset_type = 'revenue'` and `fiscal_year` exists
3. The app loads the city and that fiscal year

The `loadBudgetData` function in `dataLoader.ts` fetches `/api/treasury/cities/{id}/budgets?fiscal_year={year}`, then finds `budget.dataset_type === 'revenue'`. If no revenue budget exists for the selected year, the tab appears but shows nothing or errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| McKinney/Frisco/Allen revenue loading | Custom extractor | `processRevenuePDF.js` already exists | All three parsers (mckinney/frisco/allen format) already implemented and proven |
| Plano revenue loading | Custom extractor | `processPlanoRevenue.js` already exists | Section detection, column parsing, data_source upsert all implemented |
| Prosper/Celina ACFR page rendering | Custom render | `bulkLoadPDF.js --render-only` + cache | PDF cache in `cache/pdf-render/` by SHA-256; re-runs are instant |
| Revenue data_source seed | Manual DB insertion | Add to `seedPDFDataSources.js` pattern | Idempotent; consistent with existing pattern |
| ACFR page classification | Custom classifier | Haiku via `bulkLoadPDF.js` | Already handles all page types including table detection |

## Common Pitfalls

### Pitfall 1: Confusing Operating Data Sources with Revenue Data Sources
**What goes wrong:** The existing Prosper/Celina data_sources (`'Prosper ACFR FY2025'`, `dataset_type: 'operating'`) point to the correct ACFR PDFs. Running `bulkLoadPDF.js` against these will reload OPERATING budget rows, overwriting the clean operating budget data from Phase 8.
**Why it happens:** Same PDF, different extraction purpose.
**How to avoid:** Always create NEW data_source rows with `dataset_type: 'revenue'` for revenue extraction. Never reuse an operating data_source for revenue loading.
**Warning signs:** Check `ds.dataset_type` before running — if it says `'operating'`, stop.

### Pitfall 2: McKinney FY2025 May Show $0 if processRevenuePDF.js Was Never Run
**What goes wrong:** The app shows McKinney with operating data but no revenue tab (or empty revenue tab).
**Why it happens:** `processRevenuePDF.js` is a standalone script that must be explicitly invoked. There's no automatic connection from the operating budget pipeline to revenue.
**How to avoid:** During 09-01, query `treasury.data_sources WHERE dataset_type = 'revenue'` grouped by city to establish exactly what was loaded.
**Warning signs:** Revenue tab missing or empty in the app for a city.

### Pitfall 3: Plano FY2021 Gap is Structural
**What goes wrong:** FY2021 is absent from `processPlanoRevenue.js`'s PDFS map. If gap-filling is needed for FY2021, it cannot be done by re-running the script.
**Why it happens:** The 2020-21 Plano budget PDF is not in the `docs/Plano/` local folder (confirmed by `ls` — no 2020-21 file).
**How to avoid:** Don't attempt to load Plano FY2021 revenue without first locating the PDF. Phase scope is FY2018–2024; if FY2021 is genuinely absent, document it and proceed.
**Warning signs:** `No PDF configured for doc year 2021` in processPlanoRevenue.js output.

### Pitfall 4: Haiku Extracts Revenue as Operating Budget Rows
**What goes wrong:** Haiku extracts revenue table rows correctly but they end up in the DB as `dataset_type = 'operating'` instead of `'revenue'`.
**Why it happens:** `bulkLoadPDF.js` uses `ds.dataset_type || 'operating'` — if the data_source row has `dataset_type: 'operating'`, all rows load as operating regardless of what they represent.
**How to avoid:** Verify `ds.dataset_type` is `'revenue'` on the data_source row before running the pipeline. Use `--dry-run` to confirm the tree summary looks like revenue (smaller total than operating, fewer departments).
**Warning signs:** Revenue total roughly equals operating total; departments are "General Fund" rather than "Ad Valorem Tax", "Fees", etc.

### Pitfall 5: Revenue Prompt May Miss Revenue Tables If Haiku Classifies Them as 'other'
**What goes wrong:** Haiku classifies "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES" pages as `other` or `statistical` because the prompt focuses on operating budget vocabulary.
**Why it happens:** The existing EXTRACTION_PROMPT_BASE uses examples like "Public Safety", "Public Works" — operating department names. Haiku may not recognize combined revenue+expenditure pages as `budget_table`.
**How to avoid:** Run `--dry-run` first. If `budgetTablePages` is 0 or very low for a known revenue-heavy ACFR, the prompt needs a revenue context injection. The fix is a minor prompt addition, not a full rewrite.
**Warning signs:** Dry-run shows 0 rows extracted from a 150+ page ACFR.

### Pitfall 6: processRevenuePDF.js Allen Format Uses FY2026 Budget PDF
**What goes wrong:** Allen revenue data comes from the FY2026 ADOPTED budget PDF, not the ACFR. The script loads `approved_amount` = FY2026 budget, `actual_amount` = FY2024 actuals, and the data_source fiscal_year is recorded as FY2026.
**Why it happens:** Allen's ACFR wasn't used; the operating budget PDF happened to contain a revenue detail section.
**How to avoid:** During 09-01 verification, check that Allen revenue appears under FY2026 (not FY2025) in the DB and app. The phase's success criterion states "Allen revenue data (FY2026)" — this is correct.
**Warning signs:** Allen revenue shows under FY2025 or with wrong totals.

### Pitfall 7: Plano FY2018 May Not Be Extractable
**What goes wrong:** The 2018-19 budget PDF (doc year 2019) in `processPlanoRevenue.js` extracts FY2019 budget data, not FY2018 actuals. The `approved_amount` column is "Budget FY-1" and `actual_amount` is "Re-Est FY-1" — so the extracted fiscal year is the budget year (FY2019), not FY2018.
**Why it happens:** Each Plano PDF covers the prior year's actuals alongside the current budget year. FY2018 would need the 2017-18 budget PDF, which is not on disk.
**How to avoid:** During 09-01, accept that Plano FY2018 revenue may not be loadable. Phase scope is FY2018–2024; if FY2018 is absent and the PDF is unavailable, document and proceed. FY2019–FY2024 (6 years) is a reasonable scope.
**Warning signs:** Attempting to load FY2018 with no source PDF.

## Code Examples

### Query to Establish Revenue Data State (09-01 starting point)

```sql
-- Check which revenue data_sources exist
SELECT m.name, ds.name, ds.dataset_type, ds.fiscal_years, ds.id
FROM treasury.data_sources ds
JOIN treasury.municipalities m ON m.id = ds.municipality_id
WHERE ds.dataset_type = 'revenue'
  AND m.name IN ('Plano', 'McKinney', 'Frisco', 'Allen', 'Prosper', 'Celina')
ORDER BY m.name, ds.fiscal_years;

-- Check which budget rows exist for revenue
SELECT m.name, b.fiscal_year, b.dataset_type, b.total_budget, b.id
FROM treasury.budgets b
JOIN treasury.data_sources ds ON ds.id = b.data_source_id
JOIN treasury.municipalities m ON m.id = ds.municipality_id
WHERE b.dataset_type = 'revenue'
  AND m.name IN ('Plano', 'McKinney', 'Frisco', 'Allen', 'Prosper', 'Celina')
ORDER BY m.name, b.fiscal_year;
```

### Run McKinney Revenue Load (all years)

```bash
# Dry-run first
SUPABASE_SERVICE_KEY=... node scripts/processRevenuePDF.js --city McKinney --dry-run

# Live load one year
SUPABASE_SERVICE_KEY=... node scripts/processRevenuePDF.js --city McKinney --fy 2025

# All McKinney years (FY2021-2025)
SUPABASE_SERVICE_KEY=... node scripts/processRevenuePDF.js --city McKinney
```

### Run Plano Revenue Load

```bash
# Dry-run one year
SUPABASE_SERVICE_KEY=... node scripts/processPlanoRevenue.js --fy 2025 --dry-run

# Live load all configured years (FY2019, 2020, 2022, 2023, 2024, 2025)
SUPABASE_SERVICE_KEY=... node scripts/processPlanoRevenue.js
```

### Seed Revenue Data Source for Prosper/Celina (new data_source rows)

The existing `seedPDFDataSources.js` can be extended, or revenue data_source rows inserted directly. The composite key for uniqueness:

```javascript
// Pattern from processRevenuePDF.js for reference
const src = {
  name:            'Prosper Revenue FY2025',
  api_type:        'pdf_download',
  dataset_type:    'revenue',          // <-- KEY: must be 'revenue'
  dataset_id:      'fy2025',
  base_url:        'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682',
  fiscal_years:    [2025],
  municipality_id: prosperMuniId,
};
```

### Run Prosper Revenue Extraction via Haiku Pipeline

```bash
# Step 1: Seed the revenue data_source row (add to seedPDFDataSources.js or direct insert)
SUPABASE_SERVICE_KEY=... node scripts/seedPDFDataSources.js

# Step 2: Dry-run to validate extraction
SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
  node scripts/bulkLoadPDF.js --source "Prosper Revenue FY2025" --fiscal-year 2025 --dry-run

# Step 3: Live load (only if dry-run shows plausible revenue rows)
SUPABASE_SERVICE_KEY=... ANTHROPIC_API_KEY=... \
  node scripts/bulkLoadPDF.js --source "Prosper Revenue FY2025" --fiscal-year 2025
```

### Revenue-Context Prompt Addition (if needed for Prosper/Celina)

If the existing prompt fails to classify revenue pages as `budget_table`, add a revenue context line to `buildExtractionPrompt`:

```javascript
// In bulkLoadPDF.js — add revenue context when dataset is 'revenue'
function buildExtractionPrompt(sectionContext, datasetType) {
  let prompt = EXTRACTION_PROMPT_BASE;
  if (datasetType === 'revenue') {
    prompt = prompt.replace(
      'Extract ALL rows visible',
      'This PDF contains REVENUE data. Classify pages with revenue tables (tax collections, fees, intergovernmental, charges for services, etc.) as budget_table. Use "approved_amount" for budgeted revenue and "actual_amount" for actual receipts. Extract ALL rows visible'
    );
  }
  if (sectionContext) {
    prompt += '\n\nContext: Current ACFR section is "' + sectionContext + '". Apply as department for rows without an explicit department header.';
  }
  return prompt;
}
```

This is only needed if dry-run shows 0 rows. Try the existing prompt first.

## State of the Art

| Approach | Current State | Notes |
|----------|---------------|-------|
| Plano revenue | `processPlanoRevenue.js` — pdftotext, no AI | FY2019–FY2025 configured, FY2021 absent |
| McKinney revenue | `processRevenuePDF.js` — pdftotext, no AI | FY2021–2025 configured |
| Frisco revenue | `processRevenuePDF.js` — pdftotext, FY2026 | Single year from budget PDF |
| Allen revenue | `processRevenuePDF.js` — pdftotext, FY2026 | Single year from budget PDF |
| Prosper revenue | Not yet loaded | ACFR PDF seeded for operating only; needs revenue data_source + Haiku run |
| Celina revenue | Not yet loaded | ACFR PDF seeded for operating only; needs revenue data_source + Haiku run |

## Open Questions

1. **Which revenue rows are actually in the DB right now?**
   - What we know: `processRevenuePDF.js` and `processPlanoRevenue.js` exist and are proven; they may or may not have been run
   - What's unclear: Whether any revenue rows were loaded before this phase
   - Recommendation: 09-01 starts with the SQL queries above to establish ground truth before any pipeline runs

2. **Does the Haiku ACFR prompt correctly classify revenue pages as `budget_table`?**
   - What we know: The prompt uses operating budget vocabulary; revenue table pages are structurally similar
   - What's unclear: Whether Haiku will call "STATEMENT OF REVENUES" pages `budget_table` without explicit guidance
   - Recommendation: Always run `--dry-run` first for Prosper and Celina; if `budgetTablePages` is 0 or near-0, add the revenue context injection above

3. **Can Plano FY2018 be extracted?**
   - What we know: The 2018-19 PDF is on disk and in the PDFS map as doc year 2019; it loads FY2019 budget data
   - What's unclear: Whether FY2018 actuals are accessible from any local PDF
   - Recommendation: Accept FY2019–FY2024 as the realistic Plano revenue scope; only pursue FY2018 if the 2017-18 PDF is easily locatable

4. **Does Prosper/Celina ACFR have a clearly structured revenue section?**
   - What we know: Prosper ACFR URL is `https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682`; Celina is `https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025`; both were already rendered and loaded for operating budgets
   - What's unclear: Revenue section structure in these specific ACFRs
   - Recommendation: Check if PDFs are in the render cache (11 SHA-256 hashed dirs in `cache/pdf-render/`); if so, the render step is free. Dry-run to assess revenue page quality before spending on live load

5. **What is the municipality_id for Prosper and Celina in the DB?**
   - What we know: Both were loaded for operating budgets in Phase 8 — municipality_id must exist
   - What's unclear: The actual UUID values
   - Recommendation: Query `treasury.municipalities WHERE name IN ('Prosper', 'Celina')` at the start of 09-02/09-03

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `scripts/processRevenuePDF.js` — full source read, all formats verified
- Direct codebase inspection: `scripts/processPlanoRevenue.js` — full source read, PDFS map and fiscal year logic verified
- Direct codebase inspection: `scripts/bulkLoadPDF.js` — line 478 (`ds.dataset_type || 'operating'`), prompt at lines 185–213, model/max_tokens at lines 292–293
- Direct codebase inspection: `scripts/seedPDFDataSources.js` — ACFR URLs for Prosper and Celina at lines 42–43
- Direct codebase inspection: `src/data/dataLoader.ts` — how revenue data is fetched and filtered
- Direct codebase inspection: `src/components/datasets/DatasetTabs.tsx` — how revenue tab is rendered
- Phase 8 summaries: `08-02-SUMMARY.md`, `08-03-SUMMARY.md`, `08-VERIFICATION.md` — confirmed pipeline state and what was loaded

### Secondary (MEDIUM confidence)
- `docs/Plano/` filesystem listing — confirmed which PDF years are on disk (no 2020-21 PDF)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by reading all relevant scripts
- Architecture patterns: HIGH — direct code inspection of all data flow paths
- Pitfalls: HIGH — deduced from code logic and confirmed against known Phase 8 behavior
- Open questions: HIGH — these are genuine unknowns that require DB queries at runtime

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable codebase, no external API changes expected)
