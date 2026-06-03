---
phase: 20-gresham-or-budget-load
plan: "02"
subsystem: data-pipeline
tags: [gresham, oregon, pdf, pdfplumber, python, extractor, loader, dry-run]
dependency_graph:
  requires:
    - 20-01 (docs/Gresham/*.pdf downloaded, Gresham municipality seeded)
  provides:
    - scripts/extractGresham.py (pdfplumber text-line extractor for Gresham PDFs)
    - scripts/processGresham.js (Node loader calling treasury_sync_budget_tree)
    - Dry-run validated per-FY totals for Plans 03/04 sanity-check
  affects:
    - Plan 03 (loadORPopulation.js): no blocker — processGresham.js ready
    - Plan 04 (live load + verification): pipeline validated; ready to run
tech_stack:
  added: []
  patterns:
    - pdfplumber text-line extraction (page.extract_text(), not extract_tables())
    - OCR split-number reconstruction: concatenate leading fragment with trailing token
    - TOC-page skip: continue past pages that mention All Funds without being the data page
    - processPortland.js adapter pattern for new city
key_files:
  created:
    - scripts/extractGresham.py
    - scripts/processGresham.js
  modified: []
decisions:
  - "Required 6 numeric tokens per row to filter footer/TOC lines (footer 'FY 2025/26 Adopted Budget Page 11' only has 1 numeric token)"
  - "OCR split-number fix: when second-to-last num token is 1-3 pure digits and last starts with digit, concatenate them before parse_money"
  - "Requirements section marker: normalize by stripping all whitespace before comparing (handles 'Requi rements' OCR artifact in FY2022-23)"
  - "break only fires after rows are collected — prevents early exit on TOC pages that mention 'Resources and Requirements'"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-31"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 20 Plan 02: Gresham OR Extraction + Loader Pipeline — Summary

**One-liner:** pdfplumber text-line extractor (extractGresham.py) and Node loader (processGresham.js) validated by dry-run across all four Gresham PDFs producing full-dollar operating budget trees for FY2023-FY2026, with OCR artifact handling for the FY2022-23 PDF.

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Write extractGresham.py (pdfplumber text-line operating extractor) | 6da7029 | Done |
| 2 | Write processGresham.js (Node loader) and dry-run validate all four PDFs | 9744654 | Done |

---

## Dry-Run Results (for Plan 04 sanity-check)

These totals were produced by `node scripts/processGresham.js --dry-run` against the four local PDFs:

| Fiscal Year | DB fiscal_year | Departments | Operating Total |
|-------------|---------------|-------------|-----------------|
| FY 2022-23 | 2023 | 13 | $269,306,991 |
| FY 2023-24 | 2024 | 13 | $275,500,631 |
| FY 2024-25 | 2025 | 15 | $306,839,832 |
| FY 2025-26 | 2026 | 15 | $330,652,078 |

All totals are under $500M (confirming Operating Total, not Total Requirements $897M — RESEARCH Pitfall 3). FY2024 matches the 20-01-SUMMARY inspection value ($275,500,631) exactly.

**Note:** FY2023 and FY2024 each have 13 departments rather than 15 — the FY2022-23 PDF has "Economic Development" as a $0 row (skipped by `adopted <= 0` check) and the FY2023-24 PDF also shows $0 for that row. Other departments were reorganized/renamed across fiscal years (Pitfall 4 — expected).

---

## Extractor: extractGresham.py

**Strategy:** `page.extract_text()` text-line parsing — NOT `extract_tables()` (returns empty on Gresham All Funds page per RESEARCH Pitfall 1).

**Page detection:** Finds page where text contains both `'Resources and Requirements'` and `'All Funds'`. Skips TOC pages (which also mention these keywords) by continuing past pages that yield no department rows.

**Fiscal year parsing:** `parse_fy_from_header()` finds all `\d{4}/(?:\d{4}|\d{2})(?!\d)` patterns in the first 8 lines, takes the LAST match (= Adopted column). Handles both `2025/26` (FY2025-26 PDF) and `2022/2023` (FY2022-23 PDF).

**Section gating:** Sets `in_requirements` flag when a line normalizes to `'Requirements'` (stripping all whitespace — handles `'Requi rements'` OCR artifact in FY2022-23).

**Token parsing:** Splits each line on whitespace; partitions into name tokens (text) and num tokens (match `^[\d,]+$` or `'-'`). Requires `len(num_tokens) >= 6` to filter footer/TOC lines.

**OCR split-number fix (Rule 1 — Bug):** FY2022-23 renders numbers like `61,494,586` as `6 1,494,586`. After whitespace-split, the leading fragment `'6'` becomes a separate token. Fix: when second-to-last num_token is 1-3 pure digits and last starts with a digit, concatenate them before `parse_money`.

**SKIP_ROWS exclusions:** Totals (`Operating Total`, `Non-Operating Total`, `Total Requirements`, `Total Resources`), non-operating (`Capital Improvement`, `Debt Service`, `Transfers`, `Contingency`, `Other Requirements`, `Unappropriated`), revenue/Resources rows (`Taxes`, `Licenses & Permits`, `Intergovernmental`, `Charges for Services`, `Utility License Fees`, `Miscellaneous Income`, `Internal Payments`, `Interfund Transfers`, `Internal Svc Chrg`, `Internal Service Charges`, `Financing Proceeds`, `Beginning Balance`).

**Amounts:** Full dollars — no multiply-by-1000. `parse_money` strips all of `[\$\(\)\s,]` via `re.sub`.

---

## Loader: processGresham.js

**Pattern:** Direct adaptation of `processPortland.js` with Gresham-specific differences documented in PATTERNS.md.

**Key adaptations:**
- `row.department` (not `row.bureau`) — Gresham extractor field name
- `docs/Gresham/` with `resolvePdfDir()` worktree helper (no vol1/vol2 filter)
- No `--revenue` flag; no `volSuffix` filter (single PDF per FY, operating only)
- `ensureMunicipality()` only called when NOT `--dry-run` (DB not touched in dry-run)
- `pdf_download` api_type; dataset_id `fy${fiscalYear}`; idempotent delete-then-load

**DB writes (non-dry-run):** `delete` existing budgets for data_source_id + fiscal_year → `treasury_sync_budget_tree` RPC with `p_dataset_type: 'operating'`.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Footer line "FY 2025/26 Adopted Budget Page 11" parsed as department**
- **Found during:** Task 1 verification (FY2026 showed 16 rows instead of 15; total $330,652,089 off by $11)
- **Issue:** The page footer line has only 1 numeric token (`11` = page number), but the token split produced `name_tokens=['FY', '2025/26', 'Adopted', 'Budget', 'Page']` and `num_tokens=['11']`. Amount was `parse_money('11') = 11`.
- **Fix:** Require `len(num_tokens) >= 6` — valid department rows always have 6 columns; footer lines have 1.
- **Files modified:** scripts/extractGresham.py
- **Commit:** 6da7029

**2. [Rule 1 - Bug] FY2023-24 TOC page triggered early break**
- **Found during:** Task 1 multi-PDF test (FY2023-24 returned 0 rows)
- **Issue:** Table of Contents page (page 4) contains text "14 Resources and Requirements - All Funds 70 ..." which matches both `'Resources and Requirements' in text` and `'All Funds' in text`. The `break` after processing this page prevented reaching the actual data page (page 21).
- **Fix:** Changed `break` to `if results: break` — only exits after finding real department data.
- **Files modified:** scripts/extractGresham.py
- **Commit:** 6da7029

**3. [Rule 1 - Bug] FY2022-23 "Requi rements" OCR artifact broke section gating**
- **Found during:** Task 1 multi-PDF test (FY2022-23 returned 0 rows)
- **Issue:** The Requirements section marker on page 16 of fy2022-23.pdf is rendered as `'Requi rements'` with an OCR space. The check `s == 'Requirements'` never matched.
- **Fix:** Changed to `re.sub(r'\s+', '', s) == 'Requirements'` — strips all spaces before comparison.
- **Files modified:** scripts/extractGresham.py
- **Commit:** 6da7029

**4. [Rule 1 - Bug] OCR split-number gives wrong adopted amount for FY2022-23**
- **Found during:** Task 1 multi-PDF test (FY2022-23 total was $59M instead of $269M)
- **Issue:** FY2022-23 PDF renders many numbers with OCR spaces (e.g., `61,494,586` → `6 1,494,586`). After whitespace-split, `num_tokens[-1]` was `'1,494,586'` giving $1.5M instead of $61.5M.
- **Fix:** When `num_tokens[-2]` is 1-3 pure digits and `num_tokens[-1]` starts with a digit, concatenate them before `parse_money`. This reconstructs `'6' + '1,494,586'` → `parse_money('61,494,586') = 61494586`.
- **Files modified:** scripts/extractGresham.py
- **Commit:** 6da7029

---

## Known Stubs

None. Both scripts are fully functional. processGresham.js is ready for a live DB load (Plan 04) — only `--dry-run` was used in this plan per the task spec.

---

## Threat Flags

No new security surface introduced. `execSync` path comes from controlled `docs/Gresham/` readdir, quoted in the shell invocation. maxBuffer 8MB matches Portland pattern (T-20-04 mitigated). Operating totals asserted < $500M via dry-run (T-20-05 mitigated).

---

## Self-Check: PASSED

- [x] scripts/extractGresham.py exists (170 lines, > 60 line minimum)
- [x] scripts/processGresham.js exists (304 lines, > 100 line minimum)
- [x] Commit 6da7029 exists in git log (extractGresham.py)
- [x] Commit 9744654 exists in git log (processGresham.js)
- [x] extractGresham.py contains "extract_text" and NOT "extract_tables" as executable code
- [x] extractGresham.py does NOT multiply by 1000
- [x] processGresham.js contains "treasury_sync_budget_tree", "pdf_download", "execSync", "extractGresham"
- [x] processGresham.js uses "row.department" not "row.bureau"
- [x] Dry-run FY2026 total = $330,652,078 (< $500M)
- [x] All four fiscal years produce valid output: 2023, 2024, 2025, 2026
