---
phase: 55-statewide-city-salaries-integration
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - scripts/loadCASalaries.js
  - scripts/sweepOCSalaries.js
  - src/App.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 55: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 55 adds two batch loader scripts (`loadCASalaries.js`, `sweepOCSalaries.js`) that
download GCC payroll ZIPs over `curl` via `execSync`, parse a multi-MB CSV, and write a
Department → Position salary tree to a production Supabase DB using a service-role key. The
`src/App.tsx` change is a single benign copy-string edit (no behavioral change) — nothing to
flag there.

The scripts are well-documented and the duplicated CSV/ZIP/tree logic between the two files
is acknowledged. The most serious issue is a **data-integrity hazard**: the single-city loader
calls `treasury_ensure_municipality`, an "ensure/upsert"-named RPC, on free-form `--city`
input. A typo or wrong-state city silently creates a new municipality and writes payroll into
it — exactly the failure mode the inline comment claims to prevent ("resolve, do NOT create
new"). Several robustness gaps follow: numeric fields parsed with `parseFloat` corrupt on
thousands-separated values, the sweep's ZIP cache bypasses integrity validation on cache-hit,
and the ZIP extractor cannot handle streamed (data-descriptor) entries.

## Critical Issues

### CR-01: `--city` is fed to an "ensure" RPC that can create/write to the wrong municipality

**File:** `scripts/loadCASalaries.js:448-462`
**Issue:** The inline comment states "OC cities already exist (Phase 53/54) — resolve, do NOT
create new", but the code calls `supabase.rpc('treasury_ensure_municipality', { p_name: city,
p_state: 'CA', p_entity_type: 'city' })`. An RPC named `ensure_*` is by convention an upsert:
if `--city "Irvne"` (typo), `--city "Costa mesa "` with odd casing, or any city name not
matching an existing row is passed, `ensure_municipality` will almost certainly **create a new
municipality row** and return its id, after which the loader writes real GCC payroll into that
phantom entity in the production DB. The comment's intent ("resolve only") is not enforced by
the code. Because the script's whole purpose is bulk writes to production via a service-role
key, a silent wrong-target write is a data-integrity / data-pollution risk, not a cosmetic one.
There is no echo-back confirmation that the resolved `municipalityId` corresponds to the
expected city name before writing.

**Fix:** Resolve, do not ensure. Use a read-only lookup and fail closed when the city is not an
exact pre-existing match. For example:

```js
const { data: muni, error: munErr } = await supabase
  .schema('treasury')
  .from('municipalities')
  .select('id,name')
  .eq('state', 'CA')
  .eq('entity_type', 'city')
  .ilike('name', city)        // exact-ish, case-insensitive
  .maybeSingle();

if (munErr) { console.error('Municipality lookup failed:', munErr.message); process.exit(1); }
if (!muni) {
  console.error(`Municipality "${city}" (CA) not found. Will NOT create. Aborting.`);
  process.exit(1);
}
console.log(`Resolved "${city}" → ${muni.name} (${muni.id})`);
const municipalityId = muni.id;
```

If `treasury_ensure_municipality` must be kept, add a guard that confirms the returned id maps
to a municipality whose `name` equals the input (and abort otherwise), so a typo can never
create or target a new row.

## Warnings

### WR-01: Numeric pay fields parsed with `parseFloat` silently truncate on thousands separators

**File:** `scripts/loadCASalaries.js:306-317`, `scripts/sweepOCSalaries.js:185-192`
**Issue:** Wage/benefit values are read as `parseFloat(row[COL_TOTAL_WAGES]) || 0`. If the GCC
CSV ever quotes a numeric field with a thousands separator (e.g. the cell `"1,234.56"`), the
CSV parser correctly preserves it as the string `1,234.56` (the comma is inside quotes), but
`parseFloat("1,234.56")` returns `1` — silently discarding the rest. The result is a payroll
total understated by orders of magnitude, with no error raised. Even if the current export uses
unformatted numbers, the loader is described as "statewide / multi-year" and will run against
16 years of data where formatting can drift.

**Fix:** Strip non-numeric separators before parsing, and surface unparseable cells:

```js
function parseMoney(raw) {
  if (raw == null || raw === '') return 0;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) { console.warn(`  Non-numeric money cell: ${JSON.stringify(raw)}`); return 0; }
  return n;
}
```
Use `parseMoney(row[COL_TOTAL_WAGES])` etc. in both `buildTree` implementations.

### WR-02: Cache-hit path skips the ZIP integrity validation the download path performs

**File:** `scripts/sweepOCSalaries.js:134-154`
**Issue:** On the download branch, the buffer is validated (`zipBuf.length < 1000 ||
zipBuf.readUInt32LE(0) !== 0x04034b50` ⇒ throw) and only then written to cache. But the
comment for the cache branch says the file may come "from a prior interrupted run." If a
previous run was killed mid-`fs.writeFileSync`, the cached file can be truncated/partial. The
cache-hit branch (lines 135-137) reads it and passes it straight to `extractCsvFromZipSync`
**without** the length/signature check, so a corrupt cached ZIP either throws deep in the
extractor or silently yields an incomplete CSV — marking real cities as "gaps." The validation
must apply to both sources of `zipBuf`.

**Fix:** Hoist the validation below both branches so it runs on cache hits too:

```js
let zipBuf;
if (fs.existsSync(cachePath)) {
  console.log(`  [cache hit] ${cachePath}`);
  zipBuf = fs.readFileSync(cachePath);
} else {
  /* ...download... */
  fs.writeFileSync(cachePath, zipBuf);
}
if (zipBuf.length < 1000 || zipBuf.readUInt32LE(0) !== 0x04034b50) {
  throw new Error(`Cached/downloaded ZIP for ${year} is not a valid ZIP (${zipBuf.length} bytes)`);
}
```
Ideally write to a temp path and rename atomically so partial files never become cache hits.

### WR-03: ZIP extractor cannot handle streamed (data-descriptor) entries — reads compSize=0

**File:** `scripts/loadCASalaries.js:177-210`, `scripts/sweepOCSalaries.js:99-121`
**Issue:** The extractor reads `compSize` from the local file header (offset+18). When a ZIP is
written in streaming mode, general-purpose bit-flag 3 is set and the compressed/uncompressed
sizes in the local header are `0`; the real sizes live in a trailing data descriptor. In that
case `compressedData = zipBuffer.slice(dataStart, dataStart + 0)` is empty, and `inflateRawSync`
on an empty buffer throws (or, for stored entries, yields an empty CSV that is parsed as "no
data" → every city silently gapped). The general-purpose flag at offset+6 is never inspected.
The spike confirmed today's GCC ZIPs are not streamed, but this is a hard failure mode for a
16-year sweep if any annual archive differs.

**Fix:** Detect the streaming flag and fail loudly rather than silently mis-extracting:

```js
const gpFlag = zipBuffer.readUInt16LE(offset + 6);
if (gpFlag & 0x08) {
  throw new Error(`ZIP entry ${fileName} uses a data descriptor (streamed); compSize is in the trailing descriptor and is unsupported by this extractor.`);
}
```
(A full fix walks the central directory for authoritative sizes.)

### WR-04: `--fy` / `--start-year` / `--end-year` accept non-numeric input with no validation

**File:** `scripts/loadCASalaries.js:439`, `scripts/sweepOCSalaries.js:275-277`
**Issue:** `values.fy.map(Number)` and `Number(values['start-year'])` produce `NaN` for any
non-numeric arg (e.g. `--fy 2O24` with a letter O). In the loader, `NaN` flows into the URL as
`.../RawExport/NaN_City.zip`, fails the non-ZIP check, and is reported as a generic "Fetch
error" — confusing but non-destructive. In the sweep, `years = GCC_YEARS.filter(y => y >=
startYear && y <= endYear)` with a `NaN` bound silently yields an **empty year list**, so the
sweep "completes" having done nothing and reports every city as a gap. Both should reject bad
input up front.

**Fix:** Validate after parsing:

```js
const fiscalYears = (values.fy ? values.fy.map(Number) : [2024]);
if (fiscalYears.some(y => !Number.isInteger(y))) {
  console.error('--fy must be integer year(s), e.g. --fy 2024'); process.exit(1);
}
// sweep:
if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
  console.error('Invalid --start-year/--end-year range'); process.exit(1);
}
```

### WR-05: Download/RPC failures are swallowed with `continue`/`return`, masking partial-write outcomes

**File:** `scripts/loadCASalaries.js:410-415, 468-473`; `scripts/sweepOCSalaries.js:253-256`
**Issue:** A fetch failure (`catch … continue`) and an RPC error (`console.error … return`) are
logged but the process still exits `0`. For a script that writes to production across 16 years
× 34 cities, a transient curl/RPC failure on a subset of cities produces a **partially loaded
database with a success exit code** — CI/automation or the operator has no signal that the load
was incomplete beyond scrolling logs. The sweep does track gaps, but the loader does not
distinguish "city genuinely absent for that year (D-06)" from "RPC errored," and neither sets a
non-zero exit on any failure.

**Fix:** Accumulate an error/failed-write counter and `process.exit(1)` at the end if any
non-D-06 failure occurred, so the load is observably incomplete:

```js
let hadFailures = false;
// on fetch error / RPC error: hadFailures = true;
// end of main():
if (hadFailures) { console.error('\nCompleted with failures — DB load is INCOMPLETE.'); process.exit(1); }
```

### WR-06: `cities.length` / `cities.map` used without null-guarding the Supabase response

**File:** `scripts/sweepOCSalaries.js:294-295`
**Issue:** After the OC-cities query, the code checks `cityErr` but then immediately does
`cities.length` and `cities.map(...)`. If the query returns no error but `data` is `null`
(possible on some PostgREST/schema edge cases) the script throws `Cannot read properties of
null (reading 'length')` with an opaque stack trace instead of a clear "no OC cities found"
message. Same applies to the assumption that `cities` is non-empty.

**Fix:**
```js
if (cityErr) { console.error('Failed to fetch OC cities:', cityErr.message); process.exit(1); }
if (!cities || cities.length === 0) { console.error(`No OC cities found for county_id ${OC_COUNTY_ID}`); process.exit(1); }
```

## Info

### IN-01: ZIP cache (multi-MB per year) is written to tmp and never cleaned up

**File:** `scripts/sweepOCSalaries.js:298-300, 391-393`
**Issue:** The sweep caches up to 16 annual ZIPs (each multiple MB) plus `sweep-results.json`
into `os.tmpdir()/gcc-salary-cache` and never removes them. Over repeated runs these accumulate.
`sweep-results.json` is also co-located with the cached ZIPs, mixing output with cache.
**Fix:** Add an optional `--no-cache`/cleanup step, or write results to the phase/output dir
rather than the cache dir; document that the cache must be cleared between source-data updates
(otherwise a stale cached ZIP serves outdated payroll).

### IN-02: Substantial code duplication between the two scripts beyond `normalizeDeptLabel`

**File:** `scripts/sweepOCSalaries.js:64-228` vs `scripts/loadCASalaries.js:122-375`
**Issue:** `parseCSVLine`, `parseCSV`, `extractCsvFromZipSync`, the column-index constants, and
`buildTree` are copy-pasted into the sweep. Only `normalizeDeptLabel` is shared via import. Any
fix to the CSV/ZIP/tree logic (see WR-01, WR-03) must now be applied twice and can drift.
**Fix:** Export the shared helpers from `loadCASalaries.js` (as was done for `normalizeDeptLabel`)
and import them into the sweep, keeping one source of truth.

### IN-03: `normalizeDeptLabel` acronym rule mis-cases legitimate 2–4 char words

**File:** `scripts/loadCASalaries.js:116`
**Issue:** `if (/^[A-Z0-9]{2,4}$/.test(tok)) return tok;` preserves any already-uppercase 2–4
char token as an acronym. A self-reported all-caps ordinary word like `FIRE`, `PARK`, or `CITY`
(4 chars, uppercase) is treated as an acronym and left uppercase rather than Title-cased to
`Fire`/`Park`/`City`. This is a display-only inconsistency, not data corruption, and is arguably
acceptable under the conservative no-fabrication rule, but worth noting since it produces mixed
casing in the department tree.
**Fix:** If desired, restrict acronym preservation to a curated allow-list (IT, HR, GIS, PD, FD)
rather than a blanket uppercase-length heuristic.

### IN-04: `treasury_sync_city_budget` receives an unrounded float `p_total`

**File:** `scripts/loadCASalaries.js:400-408`; `scripts/sweepOCSalaries.js:243-251`
**Issue:** Both scripts pass the raw float `total` as `p_total` while logging
`Math.round(total)`. Position `a` values are also unrounded floats summed from `parseFloat`.
Floating-point summation of thousands of records can leave sub-cent fractional totals stored in
the DB that won't match the rounded figures shown to users.
**Fix:** Round monetary totals (`Math.round(total)`) before sending to the RPC for
consistency with displayed values, or confirm the RPC/column rounds on write.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
