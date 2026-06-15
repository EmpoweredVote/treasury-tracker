---
phase: 55-statewide-city-salaries-integration
fixed_at: 2026-06-15T00:00:00Z
review_path: .planning/phases/55-statewide-city-salaries-integration/55-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 55: Code Review Fix Report

**Fixed at:** 2026-06-15
**Source review:** .planning/phases/55-statewide-city-salaries-integration/55-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 7
- Fixed: 7
- Skipped: 0

Info findings (IN-01..IN-04) were out of scope (fix_scope = critical_warning) and were not addressed.

## Fixed Issues

### CR-01: `--city` fed to an "ensure" RPC that can create/write to the wrong municipality

**Files modified:** `scripts/loadCASalaries.js`
**Commit:** cf56e41
**Applied fix:** Replaced the `treasury_ensure_municipality` upsert RPC with a read-only
lookup against `treasury.municipalities` filtered by `state='CA'` + `entity_type='city'`
+ case-insensitive `ilike(name)` via `.maybeSingle()`. The loader now FAILS CLOSED — it
aborts with `process.exit(1)` and a clear message when no exact pre-existing match is found,
so a typo or wrong-state city can never silently create a phantom municipality and have GCC
payroll written into it. Existing-city behavior is preserved (resolves and echoes back the
matched name + id). No new migration/RPC created — a direct table read sufficed per guidance.
**Requires human verification:** This changes city-resolution semantics. Confirm that the
`.ilike('name', city)` exact (no-wildcard) match resolves all already-loaded OC cities
exactly as `treasury_ensure_municipality` did for the existing 544 verified rows before
running any forward loads.

### WR-01: Numeric pay fields parsed with `parseFloat` truncate on thousands separators

**Files modified:** `scripts/loadCASalaries.js`, `scripts/sweepOCSalaries.js`
**Commit:** cf56e41 (loader), 0ff8da2 (sweep)
**Applied fix:** Added an exported `parseMoney(raw)` helper in `loadCASalaries.js` that strips
`$`, commas, and whitespace before `Number()` parsing, warns on unparseable cells, and returns
0 for empty/invalid input. Replaced all six `parseFloat(...) || 0` money reads in BOTH
`buildTree` implementations (total wages, total benefits, regular, overtime, lump-sum, other).
The sweep imports `parseMoney` alongside `normalizeDeptLabel` to keep a single source of truth.

### WR-02: Cache-hit path skips ZIP integrity validation

**Files modified:** `scripts/sweepOCSalaries.js`
**Commit:** 0ff8da2
**Applied fix:** Hoisted the `length < 1000 || readUInt32LE(0) !== 0x04034b50` ZIP-signature
validation below BOTH the cache-hit and fresh-download branches, so a truncated/partial cached
file from a killed prior run is now rejected loudly. Also switched the cache write to an atomic
temp-file-plus-rename (`${cachePath}.tmp-${pid}` → rename) so a partial file can never become
a future cache hit.

### WR-03: ZIP extractor cannot handle streamed (data-descriptor) entries

**Files modified:** `scripts/loadCASalaries.js`, `scripts/sweepOCSalaries.js`
**Commit:** cf56e41 (loader), 0ff8da2 (sweep)
**Applied fix:** Both `extractCsvFromZipSync` implementations now read the general-purpose
bit-flag at `offset + 6` and throw a clear error if bit 3 (`0x08`) is set — i.e. a streamed
entry whose real comp/uncomp sizes live in a trailing data descriptor, not the local header.
This converts a silent mis-extraction (empty buffer → every city gapped) into a loud failure.
Did not implement the full central-directory walk (per review note "a full fix walks the
central directory"); fail-loud guard is sufficient and matches the suggested fix.

### WR-04: `--fy` / `--start-year` / `--end-year` accept non-numeric input

**Files modified:** `scripts/loadCASalaries.js`, `scripts/sweepOCSalaries.js`
**Commit:** cf56e41 (loader), 0ff8da2 (sweep)
**Applied fix:** Loader validates parsed `fiscalYears` with
`some(y => !Number.isInteger(y))` and aborts on bad input. Sweep validates
`Number.isInteger(startYear)` / `Number.isInteger(endYear)` and `startYear <= endYear`,
aborting before the empty-year-list silent no-op can occur.

### WR-05: Download/RPC failures swallowed with `continue`/`return`, masking partial writes

**Files modified:** `scripts/loadCASalaries.js`, `scripts/sweepOCSalaries.js`
**Commit:** cf56e41 (loader), 0ff8da2 (sweep)
**Applied fix:** Loader: `syncYear` now returns a boolean; `main` accumulates `hadFailures`
across fetch errors and RPC errors and calls `process.exit(1)` at the end with an
"INCOMPLETE" message. Genuine D-06 absences (zero rows for a year) are NOT counted as
failures. Sweep: `hadFailures` is set on download errors and sync RPC errors (but not on
genuine "not in GCC source" gaps), with a non-zero exit after the summary/results write.

### WR-06: `cities.length` / `cities.map` used without null-guarding the Supabase response

**Files modified:** `scripts/sweepOCSalaries.js`
**Commit:** 0ff8da2
**Applied fix:** Added `if (!cities || cities.length === 0)` guard after the `cityErr` check,
emitting a clear "No OC cities found for county_id ..." message and `process.exit(1)` instead
of an opaque `Cannot read properties of null` stack trace.

## Notes on commit granularity

The `gsd-sdk query commit --files scripts/loadCASalaries.js` call committed the full file diff,
which at that point already contained the staged edits for CR-01 plus the loader-side portions
of WR-01, WR-03, WR-04, and WR-05 (these were applied before committing). As a result the
loader's findings are folded into commit cf56e41 rather than one commit per finding, and the
sweep's findings are folded into commit 0ff8da2. All in-scope findings are fixed and verified;
the mapping above documents which commit carries each finding's change.

## Verification performed

- Tier 1: Re-read every modified section; fix text present, surrounding code intact.
- Tier 2: `node --check scripts/loadCASalaries.js` and `node --check scripts/sweepOCSalaries.js`
  both passed after all edits.
- Not run: live DB load / full data re-load (out of scope — the 544 OC rows are already
  verified correct and these fixes are forward-hardening only).

---

_Fixed: 2026-06-15_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
