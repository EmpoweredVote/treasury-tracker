# Phase 18 Research: Portland Historical Budget Data

**Researched:** 2026-05-31
**Domain:** Portland, OR historical adopted budget PDFs (FY2022–FY2024)
**Confidence:** HIGH — all PDFs downloaded and extractor run-tested against each year

---

## Summary

Portland publishes adopted budget Volume 1 PDFs back to at least FY2020-21 via stable
`portland.gov` URLs. The Appropriation Schedule (Table 2) structure — 6-column layout with
`Bureau Program Expenses`, `Interfund Contingency`, `Interfund Transfers`, `Cash Debt Service`,
`Total Appropriation` — is **identical** across FY2021-22, FY2022-23, FY2023-24, and the
already-loaded FY2024-25 and FY2025-26. The existing `extractPortland.py` extractor was run
against the FY2021-22, FY2022-23, and FY2023-24 PDFs with zero code changes required;
all three yielded correct bureau rows and accurate fiscal year detection.

**No extractor changes are needed.** Phase 18 is a pure download-and-run operation:
download the three historical PDFs into `docs/Portland/`, then run `processPortland.js`.

---

## Available Historical PDFs

All URLs verified live (HTTP 200, `Content-Type: application/pdf`) on 2026-05-31.

| Fiscal Year | Ending Year (DB) | PDF URL | File Size | Status |
|-------------|-----------------|---------|-----------|--------|
| FY 2023-24 | 2024 | `https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download` | 4.4 MB | [VERIFIED: HTTP 200] |
| FY 2022-23 | 2023 | `https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download` | 5.5 MB | [VERIFIED: HTTP 200] |
| FY 2021-22 | 2022 | `https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download` | 5.3 MB | [VERIFIED: HTTP 200] |
| FY 2020-21 | 2021 | `https://www.portland.gov/budget/2020-2021-budget/documents/fy-2020-21-adopted-budget-volume-1-portland-citywide-summaries/download` | 10.6 MB | [VERIFIED: HTTP 200] — see note below |

**FY 2021-22 URL quirk:** The URL slug uses `volume-i` (Roman numeral) rather than `volume-1`.
Both forms resolve to the same file (verified — canonical URL stays `volume-i`). The PDF
content and table structure are identical to all other years.

**FY 2020-21 note:** The PDF is 10.6 MB (roughly twice the size of other years), likely
because it was published before Portland switched to a more compressed PDF workflow. Structure
has not been verified by running the extractor (not in target scope), but the Appropriation
Schedule / Table 2 format is expected to be consistent based on the text references found in
ordinance records and the User's Guide matching the FY2021-22 pattern.

---

## Extractor Validation Results

The existing `extractPortland.py` was run unmodified against all three target PDFs.
Results were clean — no errors, no fiscal year detection failures.

| Year | Bureaus Extracted | Total Appropriation | FY Detected From | Notes |
|------|-------------------|--------------------|--------------------|-------|
| FY2022 (FY2021-22) | 29 | $5,615,189,663 | Page 124 header text | 1 skipped row (col count mismatch — cross-fund summary, correct behavior) |
| FY2023 (FY2022-23) | 30 | $6,396,377,222 | Page 110 header text | 1 skipped row (col count mismatch — correct behavior) |
| FY2024 (FY2023-24) | 29 | $6,965,364,362 | Page 101 header text | 1 zero-amount subtotal skipped (Office for Community Technology — correct) |
| FY2025 (FY2024-25) | 39 | $8,045,475,348 | Already loaded | Bureau count spike — charter reform transition year (see below) |
| FY2026 (FY2025-26) | 34 | $8,482,617,933 | Already loaded | Post-reform structure |

---

## Format Consistency Assessment

The Appropriation Schedule (Table 2) is **structurally identical** across all tested years:

- Page header text: `"Appropriation Schedule - FY YYYY-YY"` or `"Table 2 Appropriation Schedule - FY YYYY-YY"` — detected correctly by `detect_fiscal_year()`.
- Column layout: `[Bureau/Fund name, Bureau Program Expenses, Interfund Contingency, Interfund Transfers, Cash Debt Service, Total Appropriation]` — exactly 6 columns, 0-indexed.
- Bureau header rows: col[0] = bureau name, cols[1–5] = None — detected correctly by `is_bureau_header()`.
- Subtotal rows: col[0] ends with `"Subtotal"`, col[5] = Total Appropriation — detected correctly by `is_subtotal_row()`.
- Amounts: full dollars (not thousands) — consistent across all years.

**No format changes were detected across FY2021-22 through FY2025-26.**

### Portland Charter Reform — Bureau Count Spike in FY2025

Portland voters approved charter reform in November 2022 (Measure 26-228), transitioning
from a commission form of government to a strong-mayor/city-administrator model effective
January 2025. The restructuring consolidated ~26 bureaus into 5 departments. The
FY2024-25 budget (fiscal_year = 2025) straddles the transition and shows 39 bureau rows
because the budget was adopted before the new structure was in place. The FY2025-26 budget
(fiscal_year = 2026) reflects the post-reform structure with 34 rows.

This is a **content change, not a format change** — the Appropriation Schedule table
structure remains identical; only the set of bureau names changed. The extractor handles
this correctly without modification.

**Year-over-year bureau name continuity (FY2022–FY2024):** Bureau names are consistent.
The same ~29-30 bureaus appear in all three historical years. Bureau names changed beginning
FY2025 (e.g., "Office of Management & Finance" → split into "Office of the Chief Financial
Officer", "Bureau of Fleet & Facilities", etc.). The historical years FY2022–FY2024 use
the pre-reform naming and are internally consistent with each other.

---

## Recommended FY Depth

**Primary target: FY2022, FY2023, FY2024** (i.e., fiscal_year integers 2022, 2023, 2024).

These three years are:
- Confirmed downloadable via live URLs
- Confirmed extractable with zero code changes
- Internally consistent bureau naming (pre-charter-reform structure)
- Contiguous with the already-loaded FY2025 and FY2026 data

**FY2021 (FY2020-21): Optional.** The URL is live and the PDF is available. The structure is
expected to match based on ordinance references to the same Table 2 / Appropriation Schedule
format. However, the extractor has not been run against it, and the file is 10.6 MB (2x
normal). Include if 5-year historical depth is desired, but verify the extract before DB
load. The FY2022–FY2024 three-year window is the minimum useful depth for trend analysis.

**Earlier years (FY2020 and prior):** Not recommended. Portland's CMS URL patterns are
less stable before FY2020-21. Archive access would require navigating
`portland.gov/budget/archived-budgets` with no guaranteed URL pattern.

---

## Extractor Changes Required

**None.** The existing `extractPortland.py` handles all three target years without modification.

Specifically verified as working correctly:
- `detect_fiscal_year()` — correctly parses "FY 2021-22", "FY 2022-23", "FY 2023-24" header text
- `is_bureau_header()` — correctly identifies all-None-column rows as bureau headers
- `is_subtotal_row()` — correctly identifies rows ending with "Subtotal"
- `parse_money()` — correctly parses full-dollar amounts (no thousands adjustment needed)
- Section boundary detection — correctly enters and exits the Appropriation Schedule section
- The one "too short" skipped row per year is a cross-fund summary table row (not bureau data) — correctly skipped

The only addition needed is in `processPortland.js`: add the three new PDF URLs to the
`PDF_URLS` constant (keyed by fiscal_year integer) so `upsertDataSource()` can populate
`data_source.base_url` correctly.

---

## Implementation Approach

**Prerequisite:** Phase 17 must be complete (Portland municipality seeded, FY2025 and FY2026
loaded). This phase adds historical years to the existing municipality.

### Step 1 — Add PDF URLs to processPortland.js

In `processPortland.js`, update the `PDF_URLS` constant:

```javascript
const PDF_URLS = {
  2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download',
  2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-1-city-portland-city-summaries-and-bureau/download',
  2024: 'https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
  2023: 'https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
  2022: 'https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download',
};
```

### Step 2 — Download historical PDFs

```powershell
# From repo root — PowerShell
Invoke-WebRequest -Uri "https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download" -OutFile "docs/Portland/fy2023-24-vol1.pdf"
Invoke-WebRequest -Uri "https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download" -OutFile "docs/Portland/fy2022-23-vol1.pdf"
Invoke-WebRequest -Uri "https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download" -OutFile "docs/Portland/fy2021-22-vol1.pdf"
```

Or on Linux/macOS:
```bash
curl -L -o docs/Portland/fy2023-24-vol1.pdf "https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download"
curl -L -o docs/Portland/fy2022-23-vol1.pdf "https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download"
curl -L -o docs/Portland/fy2021-22-vol1.pdf "https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download"
```

### Step 3 — Dry-run verify each PDF

```bash
# Verify each extracts cleanly — check fiscal_year field and bureau count
python scripts/extractPortland.py docs/Portland/fy2023-24-vol1.pdf 2>&1 | head -30
python scripts/extractPortland.py docs/Portland/fy2022-23-vol1.pdf 2>&1 | head -30
python scripts/extractPortland.py docs/Portland/fy2021-22-vol1.pdf 2>&1 | head -30

# processPortland.js dry-run (all PDFs in docs/Portland/)
node scripts/processPortland.js --dry-run
```

Expected dry-run output:
- FY2022: 29 bureaus, ~$5.6B total
- FY2023: 30 bureaus, ~$6.4B total
- FY2024: 29 bureaus, ~$7.0B total

### Step 4 — Load to database

```bash
node scripts/processPortland.js
```

`processPortland.js` already handles all PDFs in `docs/Portland/` via `readdirSync`.
Adding the three new PDFs is sufficient — no loader code changes needed beyond the
`PDF_URLS` constant update in Step 1.

### Step 5 — Verify DB rows

```sql
SELECT fiscal_year, dataset_type, total_budget, row_count
FROM treasury.budgets
WHERE municipality_id = (
  SELECT id FROM treasury.municipalities WHERE name = 'Portland' AND state = 'OR'
)
ORDER BY fiscal_year;
```

Expected: rows for fiscal_year 2022, 2023, 2024 (operating) added to existing 2025, 2026 rows.

### Step 6 — Run enrichment for new years

```bash
node scripts/enrichCategories.js --city Portland --state OR --year 2024 --dry-run
node scripts/enrichCategories.js --city Portland --state OR --year 2024
node scripts/enrichCategories.js --city Portland --state OR --year 2023 --dry-run
node scripts/enrichCategories.js --city Portland --state OR --year 2023
node scripts/enrichCategories.js --city Portland --state OR --year 2022 --dry-run
node scripts/enrichCategories.js --city Portland --state OR --year 2022
```

**Enrichment cost estimate:** ~29 bureaus × 3 years = ~87 categories. At Claude Haiku
~$0.25/1M tokens, 87 × 1,000 tokens ≈ $0.02 total. Well under the $5 threshold —
no approval needed.

---

## Key Notes for Implementation

**processPortland.js fiscal_years array:** The `seedPortlandOregon.js` data_source row
currently declares `fiscal_years: [2025, 2026]`. After loading historical data, the
data_source rows for FY2022, FY2023, FY2024 will be created as separate rows (one per
fiscal year, one per dataset_type) by `upsertDataSource()` — this is the existing pattern.
No change to the seeder is needed.

**docs/Portland/ is gitignored:** The PDF files are gitignored (large binary files).
The download step is manual or scripted per the pattern from Phase 17. Confirm with
`git check-ignore docs/Portland/fy2023-24-vol1.pdf` before committing.

**Idempotency:** `processPortland.js` deletes existing budget rows before re-inserting
(via `budgets DELETE` before RPC call). Re-running is safe.

**Bureau name cross-year consistency:** Bureau names are stable across FY2022–FY2024.
The pre-reform set of ~29-30 bureaus maps cleanly to the post-reform FY2025 names at
the enrichment level (category names). Enrichment for historical years will create new
`category_enrichment` rows scoped to those fiscal years.

---

## Sources

### Primary (HIGH confidence — directly verified by tool)
- `extractPortland.py` run against FY2021-22 PDF: 29 bureaus, $5.615B — [VERIFIED: extractor output]
- `extractPortland.py` run against FY2022-23 PDF: 30 bureaus, $6.396B — [VERIFIED: extractor output]
- `extractPortland.py` run against FY2023-24 PDF: 29 bureaus, $6.965B — [VERIFIED: extractor output]
- FY2023-24 Vol 1 URL HTTP 200, 4.4 MB PDF — [VERIFIED: HEAD request]
- FY2022-23 Vol 1 URL HTTP 200, 5.5 MB PDF — [VERIFIED: HEAD request]
- FY2021-22 Vol 1 URL HTTP 200, 5.3 MB PDF — [VERIFIED: HEAD request]
- FY2020-21 Vol 1 URL HTTP 200, 10.6 MB PDF — [VERIFIED: HEAD request]
- FY2022-23 `/cbo/` path redirects to `/budget/` canonical path — [VERIFIED: HEAD request]

### Secondary (MEDIUM confidence)
- Portland charter reform (Measure 26-228, Nov 2022): KGW News, OPB — explains FY2025 bureau count spike
- `portland.gov/budget/2023-2024-budget/development/adopted` — page listing confirms 3 volumes, Vol 1 URL

### Tertiary (LOW confidence)
- FY2020-21 PDF table structure assumed consistent with FY2021-22 based on ordinance text references — [ASSUMED: not verified by running extractor]
