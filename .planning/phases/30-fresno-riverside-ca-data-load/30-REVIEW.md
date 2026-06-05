---
phase: 30-fresno-riverside-ca-data-load
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/seedFresnoRiversideCA.js
  - scripts/extractFresno.py
  - scripts/processFresno.js
  - scripts/extractRiverside.py
  - scripts/processRiverside.js
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed five scripts that seed, extract, and load Fresno and Riverside CA budget data. The Fresno pipeline (seeder + extractor + processor) is well-structured and follows established patterns faithfully. The Riverside pipeline has two blockers that will cause silent data loss in production: a regex character-class bug that drops up to three departments from every extract pass, and an unconditional zero-amount row emission that will write $0 DB rows whenever a GF line has fewer than five dollar columns.

---

## Critical Issues

### CR-01: Regex character class `[&A]` silently drops Riverside departments

**File:** `scripts/extractRiverside.py:185,189,191`

**Issue:** The department header regex uses `[&A]` as a character class — this matches either the single character `&` or the single character `A`. It does NOT match the literal string `& ` (ampersand-space) or the word `AND`. Department headers that contain `&` as a separator word (e.g., `"COMMUNITY & ECONOMIC DEVELOPMENT"`, `"HOUSING & HUMAN SERVICES"`, `"INNOVATION & TECHNOLOGY"`) will not match the pattern, so `current_dept` will remain whatever the previous department was. Budget rows for these three departments will be attributed to the wrong department, producing silently incorrect data.

```python
# WRONG — [&A] is a character class (& OR A), not the literal & or AND
r"|COMMUNITY [&A] ECONOMIC DEVELOPMENT"
r"|HOUSING [&A] HUMAN SERVICES"
r"|INNOVATION [&A] TECHNOLOGY"

# FIX — use a non-capturing group to match either separator form
r"|COMMUNITY (?:&|AND) ECONOMIC DEVELOPMENT"
r"|HOUSING (?:&|AND) HUMAN SERVICES"
r"|INNOVATION (?:&|AND) TECHNOLOGY"
```

---

### CR-02: Zero-amount rows unconditionally emitted for FY2 when GF line has < 5 columns

**File:** `scripts/extractRiverside.py:302,324-339`

**Issue:** When `extract_gf_amounts` returns fewer than 5 amounts (line 302 sets `amt2 = 0` as the fallback), the code still emits a row for `fy2` because the guard `if fy2:` only checks whether `fy2` is a non-zero year (always true for valid PDFs). This writes a `$0` budget row for the second fiscal year of the biennial period into the database. If a department's GF summary line has only 4 dollar columns (e.g., for a department that did not exist in the first year of the prior biennial), the zero value is incorrect — `amt2` should be treated as "not applicable" rather than `0`.

```python
# Line 302 — sets amt2=0 when there are not enough columns
amt2 = amounts[4] if len(amounts) >= 5 else 0

# Lines 324-339 — emits the $0 row unconditionally
if fy2:   # <-- always True for valid PDFs; does not guard against amt2==0
    key2 = (dept, fy2)
    if key2 not in seen:
        seen.add(key2)
        results.append({
            ...
            'adopted_amount': amt2,   # may be 0 due to missing column
            ...
        })

# FIX — skip emission when amt2 was defaulted to 0 due to insufficient columns
amt2 = amounts[4] if len(amounts) >= 5 else None

# Then guard emission:
if fy2 and amt2 is not None:
    key2 = (dept, fy2)
    if key2 not in seen:
        seen.add(key2)
        results.append({
            'department':     dept,
            'fund':           'General Fund',
            'adopted_amount': amt2,
            'fiscal_year':    fy2,
            'page_num':       page_num,
        })
```

---

## Warnings

### WR-01: `CITY MANAGER` (and similar bare role titles) fail to match department header regex

**File:** `scripts/extractRiverside.py:184`

**Issue:** The pattern `CITY (?:ATTORNEY|CLERK|COUNCIL|MANAGER)['''\s]` requires at least one character (apostrophe or whitespace) immediately after the role name. A page header that reads exactly `"CITY MANAGER"` (line ending there, with no `'S OFFICE` or trailing whitespace captured by pdfplumber) will not match, leaving `current_dept` stale. The `.*$` tail of the outer group does not rescue this because `['''\s]` is inside the alternation before `.*$`.

```python
# FIX — make the trailing character optional with `?`
r"CITY (?:ATTORNEY|CLERK|COUNCIL|MANAGER)['''\s]?"
```

---

### WR-02: Hard-coded `scan_start` heuristic can silently miss early departments

**File:** `scripts/extractRiverside.py:221`

**Issue:** `scan_start = max(0, total_pages // 2 - 75)` assumes department sections never appear in the first ~42% of the PDF. For a 585-page PDF this is ~218; for a 400-page PDF it's ~125. If a future Riverside budget PDF restructuring moves department sections earlier (e.g., a shorter introduction), any departments before `scan_start` will be silently skipped with no error or warning logged. This is particularly dangerous because the extractor returns partial results without indicating that pages were skipped.

**Fix:** Add a stderr log line reporting the scan window actually used, so dry-run output makes the skipped range visible:
```python
scan_start = max(0, total_pages // 2 - 75)
print(f'  Scanning pages {scan_start+1}-{total_pages} of {total_pages} '
      f'(skipping first {scan_start} pages by heuristic)', file=sys.stderr)
```
Longer term, detect the actual start of department sections dynamically instead of relying on the heuristic.

---

### WR-03: `upsertDataSource` in `processRiverside.js` uses a non-prefixed `dataset_id`

**File:** `scripts/processRiverside.js:164,175`

**Issue:** Per-FY data source rows for Riverside use `dataset_id = fy${fiscalYear}` (e.g., `fy2025`). The corresponding Fresno processor uses a city-prefixed form: `fresno-fy${fiscalYear}-${datasetType}`. While the SELECT guard also filters on `municipality_id`, making actual DB collision impossible, the bare `fy${year}` id is ambiguous if `municipality_id` is ever missing or if the row is inspected in isolation. Worse, it diverges from the Fresno pattern established in the same phase without justification.

**Fix:** Use a prefixed form consistent with Fresno:
```javascript
dataset_id: `riverside-fy${fiscalYear}-${datasetType}`,
// and in the SELECT:
.eq('dataset_id', `riverside-fy${fiscalYear}-${datasetType}`)
```

---

### WR-04: `detect_column_fys_from_header` requires exactly 4+ FY columns; pages with 3 Actual + 1 Adopted fall through to filename-derived FYs without a warning

**File:** `scripts/extractRiverside.py:93`

**Issue:** The function returns `(None, None)` if a page's header line has fewer than 4 FY patterns. Some budget summary pages (for departments added mid-biennial, or pages from supplemental sections) may have only 3 columns. The caller at line 289 silently falls back to filename-derived FYs in this case, which is correct behavior — but it never logs that the fallback was triggered, making it invisible in dry-run output.

**Fix:** Log the fallback when it occurs:
```python
else:
    # Use filename-derived FYs as fallback
    print(f'  [info] page {page_num}: column FY header not found or mismatched — '
          f'using filename FYs ({fy1_from_name}/{fy2_from_name})', file=sys.stderr)
    fy1, fy2 = fy1_from_name, fy2_from_name
```

---

### WR-05: Empty `catch {}` in `loadEnv()` swallows unexpected file read errors silently

**File:** `scripts/processFresno.js:66`, `scripts/processRiverside.js:59`, `scripts/seedFresnoRiversideCA.js:47`

**Issue:** The bare `catch {}` is intentional for the "file does not exist" case (ENOENT), but it also silently swallows permission errors, encoding errors, or parse corruption. If `.env` exists but is unreadable (e.g., a permissions problem introduced during deployment), the script continues without environment variables and later fails with the unhelpful `Missing SUPABASE_SERVICE_KEY` message rather than the actual cause.

**Fix:** Distinguish ENOENT from other errors:
```javascript
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.warn(`  loadEnv: unexpected error reading ${f}: ${e.message}`);
  }
}
```

---

## Info

### IN-01: Dead named import `dirname` in processor scripts

**File:** `scripts/processFresno.js:52`, `scripts/processRiverside.js:44`

**Issue:** Both files contain `import { resolve, dirname } from 'node:path'`, but `dirname` from the named import is never called. All usages go through `path.dirname(...)` (the default import). The named `dirname` binding is dead code.

**Fix:** Remove `dirname` from the destructured import:
```javascript
import { resolve }               from 'node:path';
```

---

### IN-02: Misleading stderr label for zero-amount GF rows in `extractFresno.py`

**File:** `scripts/extractFresno.py:236`

**Issue:** The log message `"Non-GF row excluded (zero/neg): {label}"` is emitted for rows inside the `in_gf_section = True` block. The rows ARE General Fund rows — they are being skipped because their adopted amount is zero or negative, not because they are non-GF. The misleading label could cause confusion during debugging.

**Fix:**
```python
print(f'  [skip] GF row skipped (zero/neg amount): {label} = {amount}', file=sys.stderr)
```

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
