---
phase: 31-anaheim-santa-ana-ca-data-load
fixed_at: 2026-06-05T00:00:00Z
review_path: .planning/phases/31-anaheim-santa-ana-ca-data-load/31-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 31: Code Review Fix Report

**Fixed at:** 2026-06-05T00:00:00Z
**Source review:** .planning/phases/31-anaheim-santa-ana-ca-data-load/31-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Santa Ana page-scan does not stop after hitting "TOTAL GENERAL FUND" stop-marker

**Files modified:** `scripts/extractSantaAna.py`
**Commit:** c3ffb09
**Applied fix:** Added a `done = False` flag to both `extract_operating_from_pdf` and `extract_revenue_from_pdf`. Each stop-marker `break` now also sets `done = True`, and the outer `for page in pdf.pages` loop gains a `if done: break` guard at the top. This prevents the outer loop from continuing to later pages after the stop-marker is encountered, eliminating the risk of spurious row extraction from running headers, footers, or TOC entries on subsequent pages. Applied to all three stop-marker paths: "TOTAL GENERAL FUND USES" (operating), "TOTAL GENERAL FUND" master total (revenue match), and `TOTAL GENERAL FUND` startswith (revenue).

### WR-01: `upsertDataSource` silently discards DB errors in both processor scripts

**Files modified:** `scripts/processAnaheim.js`, `scripts/processSantaAna.js`
**Commit:** e64e5e1
**Applied fix:** In both processor scripts, the `upsertDataSource` function's update and insert calls now destructure `{ data, error }` instead of only `{ data }`. After each operation, an `if (error)` check logs the error message to stderr and returns `null`, surfacing the root cause when a DB failure occurs instead of silently returning `undefined`.

### WR-02: `file://` local path stored in `data_sources.base_url` persists machine-specific paths to the database

**Files modified:** `scripts/processAnaheim.js`, `scripts/processSantaAna.js`
**Commit:** f32fcb7
**Applied fix:** Replaced `'file://' + pdfAbsPath.replace(/\\/g, '/')` with the same canonical public budget portal URLs used by `seedAnaheimSantaAnaCA.js`: `'https://www.anaheim.net/271/Operating-Budget-CIP'` for Anaheim and `'https://www.santa-ana.org/budget/'` for Santa Ana. The per-FY processor rows now store the same portable, browser-accessible URL as the canonical seed rows.

### WR-03: `ensureMunicipality` Supabase error is silently swallowed, masking DB connectivity failures as "not found"

**Files modified:** `scripts/processAnaheim.js`, `scripts/processSantaAna.js`
**Commit:** a647b42
**Applied fix:** In both processor scripts, `ensureMunicipality` now destructures `{ data: existing, error }` from `maybeSingle()`. An `if (error)` guard was added before the not-found check, logging the DB error message and calling `process.exit(2)`. This ensures connectivity or credential failures produce a clear error message rather than a misleading "municipality not found — run seed script" message.

---

_Fixed: 2026-06-05T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
