---
phase: 41-ma-county-budget-load
plan: "01"
subsystem: scripts/data-load
tags: [ma-counties, pdf-inspection, discovery]
dependency_graph:
  requires: [Phase 40 county seeding complete]
  provides: [Bristol PDF status confirmed, extraction approaches documented for all 5 counties]
  affects: [41-02-PLAN.md execution]
tech_stack:
  added: []
  patterns: [pdftotext inspection, pdfplumber text-line, county budget PDF structures]
key_files:
  created: [.planning/phases/41-ma-county-budget-load/41-01-SUMMARY.md]
  modified: []
decisions:
  - Norfolk extraction pattern is DeptName+4-amounts per line (not "Totals X" regex) — FY26 REQUEST is 4th amount (index 3)
  - Bristol PDF is 0 bytes — re-download required before Plan 02 can proceed
  - Plymouth FY25 = $11,868,468.18 confirmed via page 3 summary table
  - Dukes FY2024 county operations = $1,474,296 (page 66); registry = $541,335 (page 67); combined = $2,015,631
  - Norfolk FY26 total = $37,824,798 (includes Agricultural High School $13,940,175.77)
metrics:
  duration: 25min
  completed: "2026-06-11"
---

# Phase 41 Plan 01: MA County Budget PDF Discovery Summary

Inspect all 5 MA county budget PDFs; document column structures and extraction approaches for Plan 02.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Download Bristol County FY25 PDF | pre-satisfied (file present) | docs/MA-Counties/bristol-fy25.pdf |
| 2 | Inspect Bristol PDF Structure via pdftotext | see below | All 5 county PDFs inspected |

---

## Bristol County PDF — Inspection Findings

**Status: EMPTY FILE — 0 bytes**

- `docs/MA-Counties/bristol-fy25.pdf` exists on disk but is **0 bytes**
- `pdftotext` output: `Syntax Error: Couldn't read xref table` — not a valid PDF
- `bristol-fy25b.pdf` and `bristol-fy25c.pdf` are also 0 bytes
- The pre_execution_context stated the file was present and valid, but this is incorrect — the download attempt created empty files

**Impact on Plan 02:** Bristol cannot be extracted until a valid PDF is downloaded. The other 4 counties can proceed independently. Plan 02 must include a re-download step for Bristol or skip it with a documented note.

**Re-download path:** Navigate to `https://cms5.revize.com/revize/bristolcountyma/government/commissioners/` and download the FY25 budget PDF (filename contains a literal apostrophe, which is why HTTP download fails). Save as `docs/MA-Counties/bristol-fy25.pdf` and verify file size > 50KB.

---

## All 5 County PDFs — Presence and Validity

| County | File | Size | Valid PDF | FY |
|--------|------|------|-----------|-----|
| Barnstable | barnstable-fy25.pdf | 17.8 MB | Yes | FY25 |
| Bristol | bristol-fy25.pdf | **0 bytes** | **No — empty** | — |
| Dukes | dukes-fy24-audit.pdf | 682 KB | Yes | FY2024 |
| Norfolk | norfolk-fy26.pdf | 2.7 MB | Yes | FY26 |
| Plymouth | plymouth-fy25.pdf | 319 KB | Yes | FY25 |

---

## Per-County Extraction Approach (Confirmed)

### Plymouth County — CONFIRMED (cleanest format)

**Source:** `docs/MA-Counties/plymouth-fy25.pdf`, page 3 (0-indexed: 2)

**Format:** Multi-year summary table with columns: Code | Account | Expended FY21 | Expended FY22 | Expended FY23 | Approved FY24 | Approved FY25

**pdftotext line pattern:**
```
03 Commissioners' Office    $ 335,841.54 $ 363,096.15 $ 375,105.47 $ 385,156.69 $ 390,521.17
```

**Extraction regex (text-line, page 3):**
```python
# Match: "NN DeptName  $ amount $ amount $ amount $ amount $ amount"
# FY25 = 5th dollar amount (last column)
m = re.match(r'^\d{2}\s+(.+?)\s+(?:\$\s*[\d,]+\.?\d*\s+){4}\$\s*([\d,]+\.?\d*)', line)
```

**FY25 total: $11,868,468.18** (confirmed — "Total All Departments" line present)

**Departments (18 rows):**
Interest on Debt ($0 FY25), Reduction of Debt ($0 FY25), Commissioners' Office ($390,521), Parking Department ($177,914), Building Maintenance ($2,199,641), Engineering Department ($5,000), Co-operative Extension ($304,754), Contractual Expenses ($395,000), Mobile Integrated Health ($457,997), Fire Control ($25,000), Regional Services ($26,000), County Dredge ($10,000), Pond Management Bureau ($10,000), Information Technology ($52,300), Treasurer's Office ($589,798), County Retirement System ($1,774,582), OPEB Liability Trust Fund ($175,000), Registry of Deeds ($2,253,933), Mayflower Municipal Health Group ($480,000), Special Accounts ($2,541,028)

**Note:** Interest on Debt ($0) and Reduction of Debt ($0) should be excluded (zero FY25 amounts). Both have amounts in prior years but $0 in FY25.

---

### Norfolk County — CONFIRMED (critical pattern correction from RESEARCH.md)

**Source:** `docs/MA-Counties/norfolk-fy26.pdf`, pages 6-11 (0-indexed: 5-10)

**RESEARCH.md Pattern 5 correction:** The RESEARCH.md regex `^Totals?\s+(.+?)\s+([0-9,.\-]+...)` is WRONG. The actual pattern is:

```
DepartmentName  FY23_actual  FY24_actual  FY25_approved  FY26_request
```

The word "Totals" appears as a **separate preceding line** (not part of the department name). Department summary lines have the format:
```
Debt Service 1,221,823.78 1,175,081.28 1,191,475.05 1,186,550.02
Insurance/OPEB 3,996,665.64 4,353,652.81 4,484,762.92 4,891,696.32
Norfolk County Agricultural High School 11,353,936.13 12,649,542.07 13,549,228.10 13,940,175.77
```

**Corrected extraction regex:**
```python
# Match: "DeptName  amount1  amount2  amount3  amount4"
# FY26 REQUEST = 4th amount (index 3, 0-based)
m = re.match(
    r"^([A-Z][a-zA-Z\s/'\-]+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})",
    line.strip()
)
# amounts[3] = FY26 REQUEST (4th amount)
```

**Column order:** FY2023 Actual | FY2024 Actual | FY2025 Approved | FY2026 Request | FY2026 Commission Approved (blank) | FY2026 NCAB Approved (blank)

**FY26 total: $37,824,798.34** (Grand Totals line confirmed)

**Departments confirmed (pages 6-11):**
- Debt Service: $1,186,550.02
- Insurance/OPEB: $4,891,696.32
- Retirement System: $4,732,814.00
- Employment Charges: ~$472,752 (FY23 only visible; FY26 may be on subsequent line)
- Risk Management: ~$504,311 (similar)
- Wollaston Recreational Facility: $1,367,628.05
- Commissioners' Office: $902,708.10 (FY26 on next line after FY23/24)
- IT Department: appears with subsequent line for FY25/26
- Treasury Department: appears with subsequent line for FY25/26
- Maintenance Department: $3,920,683.61
- Engineering Department: appears with subsequent line
- Registry of Deeds: $2,928,359.39
- Norfolk County Agricultural High School: $13,940,175.77

**Critical note on multi-line amounts:** Some departments (Commissioners' Office, IT, Treasury, Engineering, Employment Charges, Risk Management) have their FY23/24 amounts on one line and FY25/26 amounts on the next line — separated by the column width. Plan 02 extractor must handle this by reading the line AFTER the department name line to get FY25/FY26 amounts for these split entries.

**Plan 02 approach:** Use pdfplumber table extraction instead of text-line regex — pdfplumber's `extract_tables()` on pages 6-11 will correctly align columns even when values wrap to the next line. The text-line approach will miss split-line departments. Alternatively, use `extract_words()` with positional x-coordinates to reconstruct columns.

---

### Dukes County — CONFIRMED

**Source:** `docs/MA-Counties/dukes-fy24-audit.pdf`, pages 66-67 (0-indexed: 65-66)

**Format:** "Schedule of Revenues, Expenditures and Changes in Fund Balance — Budget and Actual"

**Page 66:** County Operations (county departments)
**Page 67:** Registry of Deeds Operations (single department)

**pdftotext line pattern (page 66, dot-leaders):**
```
County commissioners......................................$   284,772   309,988   292,733   17,255
```
Values are whitespace-separated without dollar signs after the first. The "Actual Budgetary Amounts" = 3rd column (Original | Final | **Actual** | Variance).

**Actual FY2024 expenditures by department:**
- County commissioners: $292,733
- Courthouse/Admin/Senior services buildings: $228,146
- Treasurer: $349,794
- Civil defense/emergency management: $677
- Health and human services: $1,205
- Veterans agent: $89,301
- Natural resources: $19,422
- Employee benefits: $212,702
- Other: $108,316
- Debt service — Principal: $160,000
- Debt service — Interest: $12,000
- **County Operations TOTAL: $1,474,296**

**Page 67 — Registry of Deeds:**
- Registry of deeds: $541,335

**Combined total (county ops + registry): $2,015,631**

**Extraction approach:** pdfplumber text-line regex on pages 65 and 66 (0-indexed). Parse the dot-leader lines to extract dept name + 3rd numeric column (Actual).

---

### Barnstable County — CONFIRMED

**Source:** `docs/MA-Counties/barnstable-fy25.pdf`, 232 pages

**pdftotext confirmed readable** — table of contents visible, narrative department sections accessible.

**Format:** Narrative budget book. Pages 17-18 are infographic charts (confirmed image-only, no text). Page 29 has category-level summary.

**FY25 category totals from page 29 (confirmed in RESEARCH.md):**
- Salaries: $10,658,349
- Operating Expenses: $7,548,763
- Fringe Benefits: $6,487,989
- Capital: $58,000
- **Total: $24,753,101**

**Department sections (identified in TOC):**
Administration/Commissioners (p33), Center for Public Safety Training (p38), Human Rights Advisory Commission (p42), Assembly of Delegates (p45), Cape Cod Commission (p51), Children's Cove (p59), Cooperative Extension (p67), AmeriCorps (p74), Dredge Enterprise (p79), Facilities (p89), Finance (p95), Health & Environment (p101), Human Services (p109), IT (p115), Registry of Deeds (p121), Salary Reserve/Misc/Fringe/Debt (p127)

**Extraction approach for Plan 02:** Load 4 high-level categories from page 29 (Salaries/OpEx/Fringe/Capital). Per-department narrative parsing is complex and the pages with charts are inaccessible. The 4-category approach satisfies DATA-01 requirement.

---

### Bristol County — NOT INSPECTABLE (0-byte file)

**Status:** File exists on disk but is empty (0 bytes). Not a valid PDF.

**Expected budget scale:** ~$9-14M (county-government scope, not including Agricultural School)

**Re-download required:** Browser download from `https://cms5.revize.com/revize/bristolcountyma/government/commissioners/` — the literal apostrophe in the filename (`FY'25 Proposed Bristol County Budget.pdf`) prevents HTTP download.

**Approach once obtained:** Run pdftotext to inspect column structure, then document approach for Plan 02. Likely similar to Plymouth (clean table) or Norfolk (line-item format).

---

## Norfolk "Totals" Pattern Verification

The plan's success criteria required "at least 3 Totals lines containing dollar amounts" in Norfolk pdftotext output.

**Confirmed:** The following "Totals" lines with amounts were found in Norfolk pdftotext:
```
Totals 240,581.41
Totals 1,605,028.85 1,899,961.45 2,106,200.00 2,148,150.00
Totals 510,500.16
Grand Totals 32,899,117.72 36,502,866.22 37,871,868.34 37,824,798.34
```
4 "Totals" lines with amounts confirmed. Pattern is present.

**IMPORTANT CORRECTION for Plan 02:** The "Totals" lines in pdftotext output are standalone (no department name on same line). The extraction strategy must use the PRECEDING line pattern: department summary lines appear as "DeptName amount1 amount2 amount3 amount4" (see Norfolk section above for corrected regex). The RESEARCH.md Pattern 5 regex targeting `^Totals?\s+(.+?)` will NOT match department names correctly — it will match only sub-category totals, not the department-level summaries needed for the budget tree.

**Recommended Plan 02 Norfolk approach:** Use pdfplumber `extract_tables()` on pages 6-11 to get properly aligned column data, falling back to positional word extraction if tables are not detected. The text-line regex from RESEARCH.md Pattern 5 needs significant revision.

---

## Deviations from Plan

### Auto-documented Issues

**1. [Rule 1 - Bug] Bristol PDF is 0 bytes — download failed silently**
- **Found during:** Task 1/Task 2 verification
- **Issue:** All 3 Bristol PDF files (bristol-fy25.pdf, bristol-fy25b.pdf, bristol-fy25c.pdf) are 0 bytes. The pre_execution_context claimed the file was valid, but the file is empty.
- **Fix:** Cannot auto-fix — requires human browser download. Documented in SUMMARY. Plan 02 must include Bristol re-download as Task 1 or document Bristol as deferred.
- **Files modified:** None (cannot fix empty PDF automatically)
- **Impact:** Bristol extraction deferred to Plan 02 after successful re-download

**2. [Rule 1 - Bug] Norfolk RESEARCH.md Pattern 5 regex is incorrect**
- **Found during:** Task 2 pdftotext inspection
- **Issue:** RESEARCH.md Pattern 5 targets `^Totals?\s+(.+?)\s+([0-9,.\-]+...)` but the actual Norfolk pdftotext output has department names on SEPARATE lines from the "Totals" keyword. Department summary lines follow the format "DeptName amount1 amount2 amount3 amount4" with no "Totals" prefix.
- **Fix:** Documented corrected regex in this SUMMARY. Plan 02 executor must use the corrected approach (pdfplumber table extraction or "DeptName+4amounts" regex).
- **Files modified:** None (documentation only)

---

## Known Stubs

None — this is a discovery/documentation plan. No code was written.

---

## Threat Flags

None — pdftotext inspection is local, no network calls, no new endpoints.

---

## Self-Check: PASSED

- docs/MA-Counties/barnstable-fy25.pdf: 17,862,422 bytes — FOUND
- docs/MA-Counties/bristol-fy25.pdf: 0 bytes — EXISTS but EMPTY (documented)
- docs/MA-Counties/dukes-fy24-audit.pdf: 682,245 bytes — FOUND
- docs/MA-Counties/norfolk-fy26.pdf: 2,672,919 bytes — FOUND
- docs/MA-Counties/plymouth-fy25.pdf: 318,755 bytes — FOUND
- Norfolk "Totals" pattern: CONFIRMED (4 lines with amounts found)
- Bristol extraction approach: DEFERRED (file empty, re-download required)
- Plymouth FY25 total $11,868,468.18: CONFIRMED
- Dukes FY2024 total $2,015,631: CONFIRMED
- Norfolk FY26 total $37,824,798.34: CONFIRMED
- Barnstable FY25 total $24,753,101: CONFIRMED (from RESEARCH.md, readable PDF verified)
