---
phase: 31-anaheim-santa-ana-ca-data-load
plan: 02
subsystem: database
tags: [supabase, nodejs, python, pdfplumber, anaheim, california, budget-extraction, general-fund]

# Dependency graph
requires:
  - phase: 31-01
    provides: Anaheim municipality row and 4 canonical data_source rows
provides:
  - scripts/extractAnaheim.py — pdfplumber extractor for Anaheim adopted budget PDFs
  - scripts/processAnaheim.js — Node.js processor; $350M-$550M sanity band; treasury_sync_budget_tree loader
  - Anaheim GF operating budget loaded for FY2025 (13 rows, $490,937,159) and FY2026 (13 rows, $530,352,785)
  - Anaheim GF revenue loaded for FY2025 (12 rows, $649,457,438) and FY2026 (12 rows, $644,677,022)
  - docs/Anaheim/ containing fy2025-adopted-budget.pdf and fy2026-adopted-budget.pdf
affects:
  - 31-04 (enrichCategories.js can now run for Anaheim: city=Anaheim, state=CA, year=2025/2026)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "extractAnaheim.py: pdfplumber; GF-only page detection with KEEPING US SAFE + dollar signs; 4th column = Adopted"
    - "Garbled pie-chart text filter: re.search(r'(.)\1{2,}', label) catches triple-encoded PDF artifact"
    - "processAnaheim.js: resolvePdfDir() worktree-safe git-common-dir fallback; sanity band exit(3)"

key-files:
  created:
    - scripts/extractAnaheim.py
    - scripts/processAnaheim.js
  modified: []

key-decisions:
  - "Anaheim GF Expenditures by Function page is EXCLUSIVELY GF — no enterprise row filter needed at row level; fund filter is at page-selection level"
  - "Revenue extracted from 'General Fund Revenues by Category' page (clean GF-only source) — not deferred"
  - "GF operating total is gross department total (from 'Expenditures by Function' page); matches expected ~$491M FY2025"
  - "Revenue total is Total General Fund Sources (including transfers from other funds, $649M FY2025); not net revenues ($491M)"
  - "Band adjusted to $350M-$550M (plan spec); FY2026=$530M approaches ceiling but stays within band"

patterns-established:
  - "GF page detection: require KEEPING US SAFE + dollar signs + General Fund Expenditures by Function — prevents matching TOC pages"

requirements-completed: [DATA-08]

# Metrics
duration: 16min
completed: 2026-06-06
---

# Phase 31 Plan 02: Anaheim CA Budget Extraction Summary

**Anaheim General Fund operating loaded for FY2025 ($490,937,159 / 13 departments) and FY2026 ($530,352,785 / 13 departments); revenue loaded for FY2025 ($649,457,438 / 12 categories) and FY2026 ($644,677,022 / 12 categories); both confirmed idempotent via second run**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-06T02:07:13Z
- **Completed:** 2026-06-06T02:23:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Downloaded Anaheim adopted budget PDFs: fy2025-adopted-budget.pdf (13.4MB) and fy2026-adopted-budget.pdf (21.8MB) to docs/Anaheim/
- Inspected PDF structure: identified "General Fund Expenditures by Function" as GF-only page with 4-column format (Actual | Adopted | Amended | Adopted); identified "General Fund Revenues by Category" as clean GF revenue page
- Wrote `scripts/extractAnaheim.py` adapting extractFresno.py with Anaheim-specific page detection
- Wrote `scripts/processAnaheim.js` adapting processFresno.js with $350M-$550M sanity band
- Dry-run: FY2025=$490,937,159 (13 dept), FY2026=$530,352,785 (13 dept) — both within band
- Live-load: FY2025=13 rows inserted, FY2026=13 rows inserted — exits 0
- Idempotency confirmed: second run produced same 13 rows for each FY
- Revenue loaded: FY2025=12 rows ($649,457,438), FY2026=12 rows ($644,677,022)
- DATA-08 satisfied: Anaheim GF operating + revenue loaded and visible in app

## Task Commits

1. **Task 1: Download Anaheim PDFs + inspect General Fund section structure** — DB/files only (PDFs gitignored, no script commit)
2. **Task 2: Write extractAnaheim.py + processAnaheim.js; dry-run confirms GF totals within band** — `b5103cc` (feat)
3. **Task 3: Live-load Anaheim GF operating + revenue** — DB-only (no file changes; load output captured in run log)

## Task 1: Structural Facts Documented

The four structural facts required for the extractor (per plan acceptance criteria):

1. **General Fund section label**: `"General Fund Expenditures by Function"` — dedicated GF-only page with `KEEPING US SAFE` section header and dollar signs; distinct from the TOC page which references the same string without amounts
2. **Enterprise stop boundary**: Not needed — the GF Expenditures by Function page is exclusively GF. Enterprise funds (Water Utility, Electric Utility, Sanitation, Golf Courses, Convention/Sports & Entertainment, ARTIC Management) appear only on the "Expenditures by Fund" citywide page. No fund filter required at row extraction level; fund filter operates at page-selection level (D-06).
3. **Adopted-amount column position**: 4th numeric column (`int_matches[3]`). Page format: `Department | FY N-2 Actual | FY N-1 Adopted | FY N-1 Amended | FY N Adopted`
4. **Amount scale**: FULL DOLLARS (Police FY2024/25 = $195,307,626 = ~$195M → GF total $490,937,159 ≈ $491M matches RESEARCH.md)

Revenue section: `"General Fund Revenues by Category"` page — clean GF-only revenue with `TAX REVENUES` and `OTHER REVENUES` sections. Total General Fund Sources (including transfers from other funds) used as revenue total.

## Files Created/Modified

- `scripts/extractAnaheim.py` — pdfplumber extractor; GF-only by page selection; operating + revenue modes
- `scripts/processAnaheim.js` — Node.js processor; $350M-$550M band; worktree-safe resolvePdfDir(); treasury_sync_budget_tree RPC

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TOC page false positive on page identification**
- **Found during:** Task 2 initial test
- **Issue:** extractAnaheim.py matched the table of contents page (page 5) which contains "General Fund Expenditures by Function" as a section entry alongside page numbers but no budget data. Produced rows like `{"department": "General Fund Expenditures by Category", "adopted_amount": 55}` (page numbers extracted as amounts).
- **Fix:** Added additional page guards: `'$' not in text` and `'KEEPING US SAFE' not in text` — the real budget page has dollar signs and ALL-CAPS section headers, the TOC page does not.
- **Files modified:** scripts/extractAnaheim.py
- **Commit:** b5103cc (included in Task 2 commit)

**2. [Rule 1 - Bug] Triple-encoded PDF artifact text in pie chart section**
- **Found during:** Task 2 initial test (revenue mode and operating mode)
- **Issue:** Pie chart legend text was triple-encoded in the PDF (e.g., `PPPrrrooopppeeerrrtttyyy TTTaaaxxxeeesss::::`) and extracted as garbled rows. The original garbled filter used `r'(.)\1{3,}'` (char + 4 repetitions = 5 total), but triple-encoding produces runs of 3 identical chars, requiring `{2,}` (char + 2 repetitions = 3 total).
- **Fix:** Changed regex to `r'(.)\1{2,}'` to catch triple-char repetitions.
- **Files modified:** scripts/extractAnaheim.py
- **Commit:** b5103cc (included in Task 2 commit)

**3. [Rule 1 - Bug] Trailing '$' in department/category labels**
- **Found during:** Task 2 initial test
- **Issue:** Column alignment in the PDF caused `$` characters to appear at the end of some department names (e.g., "Police $", "Fees, Permits & Other Charges $"). The `$` was being included in the label before the number extraction stripped it.
- **Fix:** Added `label.rstrip('$').strip()` after label extraction for both operating and revenue rows.
- **Files modified:** scripts/extractAnaheim.py
- **Commit:** b5103cc (included in Task 2 commit)

## Live Load Output (First Run)

```
Anaheim GF Budget Loader [operating]
PDFs to process: 2
  Municipality: Anaheim (7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5)

  PDF: fy2025-adopted-budget.pdf [operating]
  FY2025 GF Operating — $490,937,159 total (13 departments)
    data_source: b1ce5a4f-b8c5-4d6d-8e53-d0db8914ad31
    Inserted: 13 rows

  PDF: fy2026-adopted-budget.pdf [operating]
  FY2026 GF Operating — $530,352,785 total (13 departments)
    data_source: 0c454224-92e7-4b06-a11d-578756501711
    Inserted: 13 rows

Done.
```

**Idempotency (second run):** Same data_source IDs, same 13 rows each — exits 0.

## Revenue Load Output

```
Anaheim GF Budget Loader [revenue]
PDFs to process: 2
  Municipality: Anaheim (7fbdd013-69c9-41fb-a87d-c9ca7b3cdeb5)

  PDF: fy2025-adopted-budget.pdf [revenue]
  FY2025 Revenue — $649,457,438 total (12 categories)
    data_source: 519aa134-5b59-4940-a045-ea11791dbf66
    Inserted: 12 rows

  PDF: fy2026-adopted-budget.pdf [revenue]
  FY2026 Revenue — $644,677,022 total (12 categories)
    data_source: 4d6bcc59-18be-4861-a4fa-289e0eaacfa2
    Inserted: 12 rows

Done.
```

## Known Stubs

None — data is fully wired from PDF through extractor to DB.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced. PDF extraction follows established D-06 pattern. All mitigations from threat model applied:
- T-31-03: Enterprise fund bleed — mitigated by page-selection filter (GF-only page)
- T-31-04: Amount scale — verified full dollars; GF total $490,937,159 confirms correct scale
- T-31-05: execSync buffer — 8MB cap; Anaheim JSON output is small (~3KB vs 22MB PDF)
- T-31-06: Command injection — PDF paths from controlled readdir; double-quoted
- T-31-07: SUPABASE_KEY logging — loadEnv() pattern; key never logged

## Self-Check: PASSED

- scripts/extractAnaheim.py: FOUND
- scripts/processAnaheim.js: FOUND
- .planning/phases/31-anaheim-santa-ana-ca-data-load/31-02-SUMMARY.md: FOUND
- Commit b5103cc (Task 2): FOUND
- Commit 8aad602 (SUMMARY): FOUND
- JS syntax check: PASSED
- Python AST check: PASSED

---
*Phase: 31-anaheim-santa-ana-ca-data-load*
*Completed: 2026-06-06*
