---
phase: 30-fresno-riverside-ca-data-load
fixed_at: 2026-06-05T00:00:00Z
review_path: .planning/phases/30-fresno-riverside-ca-data-load/30-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-06-05
**Source review:** .planning/phases/30-fresno-riverside-ca-data-load/30-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 Critical, 5 Warning)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Regex character class `[&A]` silently drops Riverside departments

**Files modified:** `scripts/extractRiverside.py`
**Commit:** 1e556f0
**Applied fix:** Replaced all three `[&A]` character classes in `DEPT_HEADER_RE` with non-capturing groups `(?:&|AND)`. The three affected patterns (COMMUNITY, HOUSING, INNOVATION) now correctly match department headers using either `&` or `AND` as the separator word.

---

### CR-02: Zero-amount rows unconditionally emitted for FY2 when GF line has < 5 columns

**Files modified:** `scripts/extractRiverside.py`
**Commit:** 07c7bc1
**Applied fix:** Changed the `amt2` fallback from `0` to `None` when `len(amounts) < 5`. Changed the FY2 emission guard from `if fy2:` to `if fy2 and amt2 is not None:` so departments with fewer than 5 dollar columns do not emit a spurious $0 row for the second fiscal year. The `[row]` format string for `amt2` remains safe since it is only reached inside the guard.

---

### WR-01: `CITY MANAGER` (and similar bare role titles) fail to match department header regex

**Files modified:** `scripts/extractRiverside.py`
**Commit:** 6391b62
**Applied fix:** Added `?` quantifier to the trailing `['''\s]` character class in the `CITY (ATTORNEY|CLERK|COUNCIL|MANAGER)` pattern, making the apostrophe/whitespace character optional. A bare `CITY MANAGER` header now matches.

---

### WR-02: Hard-coded `scan_start` heuristic can silently miss early departments

**Files modified:** `scripts/extractRiverside.py`
**Commit:** 02dd2ea
**Applied fix:** Added a `print(...)` to stderr immediately after `scan_start` is computed, reporting the actual page range being scanned (e.g., "Scanning pages 219-537 of 537 (skipping first 218 pages by heuristic)"). This makes the heuristic's effect visible in every dry-run pass.

---

### WR-03: `upsertDataSource` in `processRiverside.js` uses a non-prefixed `dataset_id`

**Files modified:** `scripts/processRiverside.js`
**Commit:** 52a3ea9
**Applied fix:** Changed `dataset_id` from `` `fy${fiscalYear}` `` to `` `riverside-fy${fiscalYear}-${datasetType}` `` in both the insert payload and the SELECT guard. Now consistent with the Fresno pattern (`fresno-fy${fiscalYear}-${datasetType}`).

---

### WR-04: `detect_column_fys_from_header` fallback not logged

**Files modified:** `scripts/extractRiverside.py`
**Commit:** af1953d
**Applied fix:** Added `[info]` stderr log messages to both fallback paths: (1) column headers present but mismatched (reports the detected vs expected FYs), and (2) column headers not found at all. Both log which filename-derived FYs are being substituted.

---

### WR-05: Empty `catch {}` in `loadEnv()` swallows unexpected file read errors silently

**Files modified:** `scripts/processFresno.js`, `scripts/processRiverside.js`, `scripts/seedFresnoRiversideCA.js`
**Commit:** a20ebf3
**Applied fix:** Replaced bare `catch {}` with `catch (e) { if (e.code !== 'ENOENT') { console.warn(...) } }` in all three scripts. ENOENT (file not found) is still silently suppressed; all other errors (permission denied, encoding errors, parse corruption) now emit a warning with the filename and error message.

---

_Fixed: 2026-06-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
