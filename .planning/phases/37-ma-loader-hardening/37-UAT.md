---
status: complete
phase: 37-ma-loader-hardening
source:
  - .planning/phases/37-ma-loader-hardening/37-01-SUMMARY.md
  - .planning/phases/37-ma-loader-hardening/37-02-SUMMARY.md
started: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. gf-expenditures excluded from report list
expected: Running `node scripts/scrapeMaDLS.js --list` shows only special-revenue and revenue-by-source. gf-expenditures does not appear.
result: pass

### 2. Missing SUPABASE_URL exits loudly
expected: Running the script without SUPABASE_URL set prints "Missing SUPABASE_URL env var" and exits non-zero. No silent fallback to a hardcoded production URL.
result: pass

### 3. Dry-run load exits cleanly with valid sample data
expected: Running `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` prints "(dry run)", shows "351 records", displays a sample with recognizable MA city names and non-zero dollar amounts, and exits 0 with no errors.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
