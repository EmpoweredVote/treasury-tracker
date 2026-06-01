---
phase: 20-gresham-or-budget-load
plan: "01"
subsystem: data-pipeline
tags: [gresham, oregon, pdf, pdfplumber, municipality-seed, foundation]
dependency_graph:
  requires: []
  provides:
    - docs/Gresham/*.pdf (4 PDFs FY2022-23 through FY2025-26)
    - scripts/seedGreshamOregon.js (idempotent municipality seeder)
    - FY2023-24 All Funds page structure documented (unblocks Plan 02)
    - treasury.municipalities row for Gresham OR (id: 5d4675f1-c207-4d7b-a346-85a799da0d4d)
  affects:
    - Plan 02 (extractGresham.py): unblocked — FY2023-24 structure confirmed
    - Plan 03 (processGresham.js): unblocked — municipality row exists
tech_stack:
  added: []
  patterns:
    - pdfplumber text-line extraction (not extract_tables) for Gresham All Funds pages
    - seedPortlandOregon.js upsert pattern adapted for Gresham
key_files:
  created:
    - scripts/seedGreshamOregon.js
    - scripts/_inspect-gresham-temp.py
    - docs/Gresham/fy2025-26.pdf (gitignored — local only)
    - docs/Gresham/fy2024-25.pdf (gitignored — local only)
    - docs/Gresham/fy2023-24.pdf (gitignored — local only)
    - docs/Gresham/fy2022-23.pdf (gitignored — local only)
  modified: []
decisions:
  - "docs/ is gitignored by design; PDFs are local-only working files"
  - "treasury_list_source_ids RPC must be called via public-schema client (not init-option schema); fixed in seedGreshamOregon.js vs Portland analog"
  - "FY2023-24 PDF structure confirmed consistent with other Gresham FYs; Plan 02 can use identical extractor"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-31"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 20 Plan 01: Gresham OR Foundation — Summary

**One-liner:** Gresham municipality seeded (population 111507, year 2024) and four adopted budget PDFs downloaded; FY2023-24 All Funds page at pdfplumber page 21 confirmed clean with 14 departments and Operating Total $275,500,631.

---

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Verify toolchain, download four PDFs, inspect FY2023-24 | ba7d3f5 | Done |
| 2 | Write seedGreshamOregon.js, confirm EntitySwitcher | 573ff75 | Done |

---

## FY2023-24 PDF Structure Findings

**All Funds page location:** pdfplumber page 21 (PDF footer page 14)

**Page heading:** "Resources and Requirements - All Funds" (single dash, not em-dash)

**Column header line (line 2 of page text):**
```
2020/21 2021/22 2022/23 2023/24 2023/24 2023/24
```
Note: Uses 4+2 format (e.g., `2023/24`) — NOT the 4+4 format seen in FY2022-23 PDF (`2022/2023`). The `parse_fy_from_header` function in RESEARCH handles both formats correctly.

**Column 6 = Council Adopted** — the last number on each department/resource line.

**extract_tables() result:** Returns empty list (0 tables) — confirmed. Text-line parsing via `page.extract_text()` is required (same as all other Gresham PDFs).

**Department rows in Requirements section (14 departments):**

| Dept # | Department Name | FY2024 Adopted |
|--------|----------------|----------------|
| 1 | City Manager's Office | $3,339,343 |
| 2 | City Attorney's Office | $8,780,021 |
| 3 | Budget & Finance | $7,920,029 |
| 4 | Information Technology | $7,627,142 |
| 5 | Citywide Services | $47,211,694 |
| 6 | Police | $51,595,991 |
| 7 | Fire | $35,339,579 |
| 8 | Urban Renewal | $2,287,665 |
| 9 | Urban Design & Planning | $4,315,494 |
| 10 | Econ, Dev, & Housing Services | $30,890,217 |
| 11 | Economic Development | $0 (zero — will be skipped by parser) |
| 12 | Community Livability | $4,328,978 |
| 13 | Parks | $7,514,515 |
| 14 | Environmental Services | $64,349,963 |

**Note on department names:** FY2023-24 uses different names than FY2025-26 (expected per Pitfall 4):
- "City Manager's Office" (FY2024) vs "Office of Governance & Management" (FY2026)
- "Econ, Dev, & Housing Services" (FY2024) — different from FY2026's "Economic Development"
- "Economic Development" appears as a $0 row — parser will skip (adopted_amount <= 0)

**Operating Total FY2024 (Adopted column):** $275,500,631
- Sum of 13 non-zero departments = $275,500,631 (matches page's own "Operating Total" row)
- Well within expected range per RESEARCH (~$239M estimate was conservative)

**OCR artifacts:** NONE in FY2023-24. Text extraction is clean. Only FY2022-23 PDF has OCR artifacts (mid-word spaces in names, spaces within numbers).

---

## Confirmed PDF URLs (all HTTP 200)

| Fiscal Year | DB fiscal_year | File | Size |
|-------------|---------------|------|------|
| FY 2025-26 | 2026 | docs/Gresham/fy2025-26.pdf | 7,319,226 bytes |
| FY 2024-25 | 2025 | docs/Gresham/fy2024-25.pdf | 7,888,388 bytes |
| FY 2023-24 | 2024 | docs/Gresham/fy2023-24.pdf | 6,773,261 bytes |
| FY 2022-23 | 2023 | docs/Gresham/fy2022-23.pdf | 7,880,518 bytes |

All URLs confirmed from RESEARCH.md are valid. No 404s encountered. Files are in `docs/Gresham/` which is gitignored by design (comment in .gitignore: "large PDFs not for version control").

---

## Municipality Seeder

**File:** scripts/seedGreshamOregon.js
**Gresham municipality id:** 5d4675f1-c207-4d7b-a346-85a799da0d4d
**Population:** 111507 (Census sub-est2024_41.csv, SUMLEV=162, 2024 vintage)
**population_year:** 2024

Seeder is idempotent: two runs both exited 0, second run took the update branch.
Does NOT create data_source rows — those are owned by processGresham.js.

---

## EntitySwitcher.tsx

`OR: 'Oregon'` already present at line 25. **No change needed** (added in Phase 17).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed treasury_list_source_ids RPC schema routing**
- **Found during:** Task 2
- **Issue:** seedPortlandOregon.js analog also has this bug. When the Supabase client is initialized with `{ db: { schema: 'treasury' } }`, the `.rpc()` method routes the call to `treasury.treasury_list_source_ids` which doesn't exist. The function lives in the public schema.
- **Fix:** In seedGreshamOregon.js, the verification step creates a secondary Supabase client without the init-option schema and uses it specifically for the RPC call. The primary client (with treasury schema) is still used for all `.from()` calls.
- **Files modified:** scripts/seedGreshamOregon.js
- **Commit:** 573ff75 (included in Task 2 commit)

**2. [Rule 3 - Deviation] docs/ directory is gitignored**
- **Found during:** Task 1 commit
- **Issue:** The plan specifies creating docs/Gresham/ and committing the PDFs. However, `docs/` is intentionally gitignored ("large PDFs not for version control").
- **Fix:** PDFs are on local disk (confirmed working), inspection script committed. SUMMARY documents working URLs so PDFs can be re-downloaded. No code change needed.
- **Impact:** No functional impact. PDFs exist at docs/Gresham/ and are used by processGresham.js locally.

---

## Downstream Plan Enablement

- **Plan 02 (extractGresham.py):** FY2023-24 structure confirmed. Extractor can use identical logic to other FYs. Department names differ from FY2025-26 but parser handles any name. "Economic Development" row has $0 adopted in FY2024 — will be skipped by `adopted <= 0` check.
- **Plan 03 (processGresham.js + loadORPopulation.js):** Municipality row exists at id 5d4675f1-... — FK dependency satisfied.

---

## Self-Check: PASSED

- [x] scripts/seedGreshamOregon.js exists and is committed
- [x] scripts/_inspect-gresham-temp.py exists and is committed
- [x] docs/Gresham/ contains 4 valid PDFs (local disk, gitignored)
- [x] Gresham municipality row in DB (population=111507, population_year=2024)
- [x] Commits ba7d3f5 and 573ff75 exist in git log
- [x] SUMMARY documents FY2023-24 All Funds structure
- [x] SUMMARY confirms extract_tables() returns empty
- [x] SUMMARY records expected FY2024 Operating Total ($275,500,631)
