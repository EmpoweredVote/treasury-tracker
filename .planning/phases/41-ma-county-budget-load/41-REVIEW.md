---
phase: 41-ma-county-budget-load
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - scripts/extractMACounties.py
  - scripts/loadMACountyBudget.js
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 41: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Reviewed `scripts/extractMACounties.py` (per-county PDF extractor, 318 lines) and
`scripts/loadMACountyBudget.js` (Node.js loader, 255 lines). Both files follow the
`extractGresham.py` / `processGresham.js` pattern closely. Hardcoded totals for
Dukes, Barnstable, and Bristol were verified arithmetically (all correct). Security
posture is sound: `spawnSync` uses an args array (no shell injection), `api_type` is
hardcoded, and `ensureMunicipality` filters on `entity_type='county'`. No critical
bugs or security vulnerabilities were found.

Two warnings were identified in `extract_norfolk()`: dead code in the in-amounts OCR
merge branch and a latent name-tokenisation risk for department names ending in a
two-digit number. Two minor info items cover a redundant import and a docstring
page-range error.

---

## Warnings

### WR-01: Dead code in `extract_norfolk` in-amounts OCR merge branch

**File:** `scripts/extractMACounties.py:131-135`

**Issue:** The `if/else` block inside the `in_amts` branch (lines 131–135) has
identical bodies for both branches: `merged = t + next_t`. The intent from the
non-`in_amts` section (lines 116–120) was to produce `t + next_t.lstrip(',')` in
the `else` arm. Both branches of the in-amounts version currently produce the same
string, making the conditional a no-op.

For the comma-prefix case (e.g. `"7" + ",500.00"`), both paths happen to produce
the correct string `"7,500.00"`. For the non-comma case (e.g. `"1" + "3,940,175.77"`),
both paths also produce the correct string `"13,940,175.77"`. The logic works, but
the dead branch adds confusion and maintenance risk.

```python
# Current (lines 131-135) — both arms are identical:
if next_t.startswith(','):
    merged = t + next_t
else:
    merged = t + next_t   # <-- dead branch, identical to if-arm

# Fix — match the intent from the not-in_amts section (lines 116-120):
if next_t.startswith(','):
    merged = t + next_t          # "7" + ",500.00" -> "7,500.00"
else:
    merged = t + next_t.lstrip(',')  # "1" + "3,940,175.77" -> "13,940,175.77"
```

---

### WR-02: Latent tokenisation bug — department names ending in a two-digit number

**File:** `scripts/extractMACounties.py:110-122`

**Issue:** The not-`in_amts` name/amount boundary detector (lines 110–122) treats
any 1–2 digit token as the start of the amounts section when the following token
looks like a number or comma-prefix fragment. A department name like
`"District 12"` would cause `"12"` to be consumed as a merged OCR fragment rather
than a name token, truncating the department name to `"District"` and prepending
`"12"` onto the first amount value (e.g. `"12" + "1,186,550.02"` →
`"121,186,550.02"`).

Current Norfolk departments (as confirmed in 41-01-SUMMARY) do not end in two-digit
numbers, so this is not a live defect. However, the algorithm would silently produce
corrupt data if any new Norfolk department name ended with a 1–2 digit word.

**Fix:** Add a guard: only trigger the OCR-fragment path when `in_amts` is already
`True` or when a preceding full-dollar-amount token has already been seen. An
alternative is a lookahead that requires at least three amount-shaped tokens before
committing to `in_amts = True`.

```python
# Minimal guard: require at least one confirmed amount already seen before
# allowing OCR-fragment merging to set in_amts = True
elif re.match(r'^\d{1,2}$', t) and i_tok + 1 < len(tokens) and len(amt_toks) > 0:
    # Only merge OCR fragments once we are already collecting amounts
    ...
```

---

## Info

### IN-01: Unused `dirname` destructured import

**File:** `scripts/loadMACountyBudget.js:29`

**Issue:** `dirname` is destructured from `node:path` on line 29 but is never used
as a standalone identifier. `path.dirname` is used instead on line 31. The
destructured `dirname` is dead.

**Fix:** Remove `dirname` from the destructure, or consolidate both `node:path`
imports into one:

```javascript
// Before (lines 28-30):
import path              from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// After (consolidated, removing unused dirname):
import path              from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve }       from 'node:path';
```

---

### IN-02: Norfolk docstring page range does not match the code

**File:** `scripts/extractMACounties.py:68`

**Issue:** The `extract_norfolk` docstring states `"Pages 5-10 (index 4-9)"`, which
would correspond to `pdf.pages[4:10]` (6 pages). The actual code at line 84 iterates
`pdf.pages[4:11]` (indices 4–10, pages 5–11, 7 pages). The inline comment on
line 84 — `# pages 5-11 (0-indexed 4-10)` — is consistent with the code; only
the top-of-function docstring is wrong.

**Fix:** Update the docstring to match:

```python
# Before:
"""Pages 5-10 (index 4-9). Uses 'Totals <DeptName> <amounts...>' pattern.

# After:
"""Pages 5-11 (index 4-10). Uses 'Totals <DeptName> <amounts...>' pattern.
```

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
