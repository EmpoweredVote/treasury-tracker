# Phase 37: MA Loader Hardening - Research

**Researched:** 2026-06-09
**Domain:** Node.js script hardening — checkpoint files, JSONB array append, rdreport discovery
**Confidence:** HIGH (all findings sourced directly from codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Human eyeball is sufficient to confirm the rdreport — run `--explore --report gf-expenditures`, read the output. No machine-readable verdict file needed.
- **D-02:** Plan 37-01 is a **discovery step**, not a rubber-stamp. If the rdreport is wrong, the plan finds the correct value via the HTML output and updates `REPORTS[]`.
- **D-03:** Checkpoint granularity: **per DOR code within each (report, FY) pair**.
- **D-04:** Checkpoint file: single persistent file at `scripts/output/ma_dls_progress.json`. Never auto-deleted — permanent load ledger.
- **D-05:** Resume behavior: **always-on, no flag required**. Skip silently if DOR code already logged for (report, FY). Print "Skipped N already loaded" at end of run.
- **D-06:** Fix location: JS-side in `loadToSupabase`. Read `existingDs.fiscal_years` (or default to `[]`), add `fiscalYear` only if not already present, UPDATE the row.
- **D-07:** Deduplication: JS-side `if (!existingFiscalYears.includes(fiscalYear))` before spreading. No `[2021, 2021]` on re-runs.
- **D-08:** INSERT path (first-time data_source creation) is already correct: `fiscal_years: [fiscalYear]`. No change needed there.

### Claude's Discretion

- Dry-run scope for SC-4: use existing `--load --file <json> --dry-run` against pre-existing JSON output files. No new `--limit` flag required.
- Checkpoint JSON structure: Claude chooses the exact format — must support efficient lookup of "did DOR code X complete for (report, FY)?"
- Progress file is in `scripts/output/` (same dir as scrape JSON output).

### Deferred Ideas (OUT OF SCOPE)

- WR-04 pattern: `SUPABASE_URL` hardcoded fallback at line 41 — deferred to Phase 38 code review.
- `--limit N` flag for capping bulk load to N cities — deferred to Phase 38.
- DOR code column in `treasury.municipalities` — no schema change needed for Phase 37.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-01 | `scrapeMaDLS.js --explore` confirms General Fund Expenditures rdreport/tableID before any operating data is loaded | The current rdreport `ScheduleA.GF.ExpendituresByFunctionMain` is **confirmed wrong** (error HTML already on disk at `scripts/output/explore_gf-expenditures.html`). The plan must find the correct value by re-running `--explore` with alternate rdreport candidates and reading live DLS output. |
| LOAD-02 | `scrapeMaDLS.js` has a progress checkpoint file keyed by DOR code so bulk load can resume from last successful city | `loadToSupabase` currently has no checkpoint logic. Must add: read `ma_dls_progress.json` at start, skip if `progress[key]` includes dorCode, append dorCode on success. |
| LOAD-03 | `scrapeMaDLS.js` appends to `fiscal_years` array on `data_source` when loading a second FY onto an existing record | The existing-row path (line ~572–604) only selects `id`, never reads or updates `fiscal_years`. Bug is confirmed. Fix: select `id, fiscal_years`, deduplicate, UPDATE on every existing row. |
</phase_requirements>

---

## Summary

Phase 37 hardens `scrapeMaDLS.js` across three independent code paths before the bulk 351-city load in Phase 38. All changes are confined to a single 748-line Node.js script. No frontend changes, no migrations, no AI API calls.

**LOAD-01 (rdreport discovery)** is the highest-stakes item: the `explore_gf-expenditures.html` file already on disk proves the current rdreport (`ScheduleA.GF.ExpendituresByFunctionMain`) returns a 404 error from the MA DLS server. The plan must re-run `--explore` with corrected rdreport candidates and update `REPORTS[]` before any scraping begins.

**LOAD-02 (checkpoint)** is a straightforward read/write around the existing `loadToSupabase` per-record loop. The file format chosen in CONTEXT.md (`{ "[report]:[fy]": ["dorCode1", "dorCode2", ...] }`) maps directly to an efficient `Set` lookup in JS.

**LOAD-03 (fiscal_years append)** is a two-line SQL query change plus a three-line JS array merge. The root bug is that the existing-row path only selects `id` — it must also fetch `fiscal_years` and UPDATE after building the new array.

**Primary recommendation:** Implement in task order LOAD-01 → LOAD-03 → LOAD-02, because LOAD-01 determines whether the loader produces correct data, and LOAD-02 wraps the same loop as LOAD-03 so combining their test is efficient.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| rdreport/tableID confirmation | Script (CLI) | Human review | The script runs `--explore` and writes HTML; the human reads the output and decides |
| Checkpoint read/write | Script (CLI) | Filesystem | Pure JS file I/O in `loadToSupabase`, no DB involvement |
| fiscal_years array append | Script (CLI) | Supabase (JSONB) | JS builds the new array; Supabase persists it via `.update()` |
| Dry-run validation | Script (CLI) | — | `--dry-run` flag already handled in `main()` for `--load` path |

---

## Standard Stack

### Core (No New Packages Required)

All three fixes use only packages already imported in `scrapeMaDLS.js`:

| Already Used | Purpose | Version |
|--------------|---------|---------|
| `node:fs` (built-in) | Read/write `ma_dls_progress.json` checkpoint | Node.js built-in |
| `@supabase/supabase-js` | `.select('id, fiscal_years')` and `.update({ fiscal_years: [...] })` | Already installed |
| `node:util` `parseArgs` | No arg changes needed | Node.js built-in |

**Installation:** None required — no new packages.

---

## Package Legitimacy Audit

No new packages are installed in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
User runs: node scrapeMaDLS.js --explore --report gf-expenditures
                |
                v
         [exploreReport()]
         GET https://dls-gw.dor.state.ma.us/reports/rdpage.aspx?rdreport=<candidate>
                |
         MA DLS Server returns HTML (table found) or Error page (rdreport wrong)
                |
         HTML saved → scripts/output/explore_gf-expenditures.html
         Console output: table IDs found, headers, year options
                |
         Human reads output → confirms or corrects REPORTS[gf-expenditures].rdreport
                |
                v
User runs: node scrapeMaDLS.js --load --file <json> [--dry-run]
                |
         [loadToSupabase()]
                |
         Read scripts/output/ma_dls_progress.json        ← NEW (LOAD-02)
                |
         For each record in JSON:
           Is dorCode in progress["report:fy"]?          ← NEW (LOAD-02)
           YES → skipped++; continue
           NO  → proceed with DB writes
                |
           Fetch existing data_source row
           SELECT id, fiscal_years                       ← CHANGED (LOAD-03; was SELECT id only)
                |
           Existing?
           YES → merge fiscal_years JS-side, UPDATE row  ← NEW (LOAD-03)
           NO  → INSERT with fiscal_years: [fiscalYear]  (unchanged)
                |
           Call treasury_sync_budget_tree RPC
                |
           Append dorCode to progress["report:fy"]       ← NEW (LOAD-02)
           Write progress file to disk
                |
         End of loop: print "Loaded N | Skipped M (already loaded: K)"
```

### Recommended Project Structure (No Changes)

```
scripts/
├── scrapeMaDLS.js        # The file being modified (all 3 fixes here)
└── output/
    ├── ma_dls_progress.json           # NEW — checkpoint ledger (never auto-deleted)
    ├── explore_gf-expenditures.html   # Already exists (shows wrong rdreport error)
    ├── ma_dls_revenue-by-source_2025.json  # Already exists — usable for dry-run SC-4
    └── ma_dls_special-revenue_2025_expenditures.json  # Already exists
```

### Pattern 1: Checkpoint File Read/Write

**What:** Load checkpoint JSON at start of `loadToSupabase`, skip already-loaded DOR codes, append on success, write after each successful city.

**When to use:** Every `loadToSupabase` call (always-on, no flag).

**Format chosen (Claude's discretion):** Keys are `"${report.name}:${fiscalYear}"` strings; values are arrays of DOR code strings. Array lookup via `Set` for O(1) after construction.

```javascript
// Source: CONTEXT.md §LOAD-02, D-04 + D-05 (implemented in scrapeMaDLS.js)

const PROGRESS_FILE = join(OUTPUT_DIR, 'ma_dls_progress.json');

function readProgress() {
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// Inside loadToSupabase(), before the records loop:
const progress = readProgress();
const progressKey = `${report.name}:${fiscalYear}`;
const alreadyLoaded = new Set(progress[progressKey] || []);
let checkpointSkipped = 0;

// Inside the per-record loop, first check:
if (alreadyLoaded.has(record.dorCode)) {
  checkpointSkipped++;
  continue;
}

// After successful treasury_sync_budget_tree call:
alreadyLoaded.add(record.dorCode);
progress[progressKey] = [...alreadyLoaded];
writeProgress(progress);
loaded++;

// After loop:
if (checkpointSkipped > 0) {
  console.log(`    Skipped ${checkpointSkipped} already loaded (checkpoint)`);
}
```

### Pattern 2: fiscal_years Array Append (LOAD-03)

**What:** Change `select('id')` to `select('id, fiscal_years')`, then merge JS-side and UPDATE before proceeding to the RPC call.

**When to use:** The existing-row branch in `loadToSupabase` (when `existingDs` is truthy).

```javascript
// Source: CONTEXT.md §LOAD-03, D-06 + D-07 (implemented in scrapeMaDLS.js)

// BEFORE (line ~572 in scrapeMaDLS.js):
const { data: existingDs } = await supabase
  .schema('treasury')
  .from('data_sources')
  .select('id')               // ← only fetches id
  .eq('municipality_id', municId)
  .eq('api_type', 'ma-dls')
  .eq('dataset_type', report.datasetType)
  .maybeSingle();

let dsId = existingDs?.id;

if (!dsId) {
  // INSERT path (unchanged — already sets fiscal_years: [fiscalYear])
}

// AFTER — also select fiscal_years, then update when row exists:
const { data: existingDs } = await supabase
  .schema('treasury')
  .from('data_sources')
  .select('id, fiscal_years')  // ← fetch fiscal_years too
  .eq('municipality_id', municId)
  .eq('api_type', 'ma-dls')
  .eq('dataset_type', report.datasetType)
  .maybeSingle();

let dsId = existingDs?.id;

if (!dsId) {
  // INSERT path unchanged
} else {
  // Append fiscalYear to existing array if not already present
  const existingFiscalYears = Array.isArray(existingDs.fiscal_years) ? existingDs.fiscal_years : [];
  if (!existingFiscalYears.includes(fiscalYear)) {
    const { error: fyErr } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update({ fiscal_years: [...existingFiscalYears, fiscalYear] })
      .eq('id', dsId);
    if (fyErr) console.log(`    ⚠️  ${record.municipality} fiscal_years update: ${fyErr.message}`);
  }
}
```

### Pattern 3: LOAD-01 — Finding the Correct rdreport

**What:** The current `gf-expenditures` rdreport (`ScheduleA.GF.ExpendituresByFunctionMain`) is confirmed wrong. The plan must discover the correct value.

**Evidence already on disk:** `scripts/output/explore_gf-expenditures.html` contains:
```
The Definition E:\wwwroot\gateway_test\_Definitions\_Reports\
ScheduleA.GF.ExpendituresByFunctionMain.lgx does not exist.
```

**Discovery method:** The MA DLS portal uses Logi Analytics (LogiXML) report framework. The `ScheduleA.Special_Rev_Funds.SpecialRevFunds` rdreport is confirmed working. The GF Expenditures report must be found by browsing the MA DLS Gateway portal and reading the `rdreport=` parameter from the URL.

**Known working pattern from codebase:**
- Special Revenue: `ScheduleA.Special_Rev_Funds.SpecialRevFunds` (confirmed working — 351 records scraped)
- Revenue by Source: `RevenueBySource.RBS.RevbySource2` (confirmed working — 351 records in JSON)
- GF Expenditures: `ScheduleA.GF.ExpendituresByFunctionMain` (confirmed WRONG — 404 error)

**How LOAD-01 plan task proceeds:**
1. Human navigates to `https://dls-gw.dor.state.ma.us/reports/rdpage.aspx` in browser
2. Finds "General Fund Expenditures by Function" report link, reads URL for rdreport= value
3. Updates `REPORTS[1].rdreport` and `REPORTS[1].tableID` in `scrapeMaDLS.js`
4. Runs `node scripts/scrapeMaDLS.js --explore --report gf-expenditures`
5. Console confirms: table ID found, headers visible, municipality count 351

**Candidate rdreport values to try (LOW confidence — training knowledge only):**

The Logi Analytics framework in MA DLS uses `.lgx` definition files. The special revenue report is `ScheduleA.Special_Rev_Funds.SpecialRevFunds`. GF expenditures likely follows a similar pattern. Possible candidates:
- `ScheduleA.GF.ExpendituresByFunction` (without "Main" suffix)
- `ScheduleA.GF.GFExpenditures`
- `ScheduleA.GeneralFund.ExpendituresByFunction`

These are `[ASSUMED]` — the definitive source is the live MA DLS portal URL bar.

### Anti-Patterns to Avoid

- **Writing the checkpoint file only at end of run:** A crash after 300 cities would lose all progress. Write after each successful city instead.
- **Using municipality name as checkpoint key:** Names can have encoding variations. DOR code (numeric string `"001"`–`"351"`) is stable — use it.
- **Updating fiscal_years AFTER the RPC call succeeds:** If the RPC fails, fiscal_years would be wrong. Pattern above: update fiscal_years first (non-fatal if it fails), then call RPC. Or: update fiscal_years and call RPC in sequence; either way the RPC result gates the checkpoint write.
- **Using `Array.from(Set)` sort on DOR codes:** DOR codes are strings like `"001"`, `"10"`, `"75"`. Numeric sort would misorder them. Preserve insertion order.
- **Deleting progress file on clean completion:** D-04 says never auto-delete. The file serves as the permanent load ledger for Phase 38.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONB array deduplication | Custom SQL merge function | JS `.includes()` + spread | D-07 locked this to JS-side; Supabase JSONB UPDATE with JS-built array is the correct pattern used in all other loaders |
| HTTP retry with backoff | Custom retry wrapper | Existing `DELAY_MS = 1500` + existing error handling | Rate-limit avoidance is already implemented; adding retries risks double-writes if the first request succeeded silently |
| Atomic checkpoint+RPC transaction | DB transaction wrapping checkpoint + RPC | File write after RPC success | Checkpoint is file-based by design (D-04); mixing it into a DB transaction adds complexity the design explicitly rejects |

**Key insight:** This phase is pure code hardening — the complexity is in the design decisions (already locked in CONTEXT.md), not in the implementation tools.

---

## Runtime State Inventory

> This is a hardening phase for an existing loader. No rename/refactor — not applicable.

Omitted per instructions (greenfield modifications, not rename/refactor).

---

## Common Pitfalls

### Pitfall 1: Writing progress file synchronously in the hot loop
**What goes wrong:** `writeFileSync` on every record in a 351-record loop adds ~1–2ms per write. At 351 cities × 5 FYs × 2 reports = 3510 writes. Negligible vs. `DELAY_MS = 1500` HTTP delay, so this is not a performance problem — but it's worth noting that `writeFileSync` is correct here (crash-safe) over async write.
**Why it happens:** Reflex to use async for everything.
**How to avoid:** Keep `writeFileSync` — it guarantees durability before moving to the next record.

### Pitfall 2: The progress key collision between report types
**What goes wrong:** If both `gf-expenditures:2025` and `revenue-by-source:2025` are loaded in the same run, and both happen to have DOR code `"001"` in the same array, a naive lookup would be correct — but if the key structure doesn't include the report name, a city loaded for one report would be skipped for the other.
**Why it happens:** Using `fy` alone as the checkpoint key.
**How to avoid:** Key format is `"${report.name}:${fiscalYear}"` — always includes the report name. Confirmed in CONTEXT.md D-04.

### Pitfall 3: existingDs.fiscal_years is null (not an array)
**What goes wrong:** `[...null]` throws `TypeError: null is not iterable`.
**Why it happens:** New data_sources rows correctly set `fiscal_years: [fiscalYear]`, but older rows loaded before this fix was applied may have `null` or a missing column.
**How to avoid:** `const existingFiscalYears = Array.isArray(existingDs.fiscal_years) ? existingDs.fiscal_years : [];` — pattern shown in Pattern 2 above.

### Pitfall 4: `--explore` succeeds but table is still wrong
**What goes wrong:** `exploreReport()` finds an `xt*` table in the HTML, prints "Table found!", but the table belongs to a different sub-report (e.g., a summary wrapper table, not the detail rows).
**Why it happens:** The MA DLS portal uses Logi Analytics which embeds multiple tables; the first matching `id="xt..."` may not be the data table.
**How to avoid:** The `exploreReport()` output includes headers and the first row. Confirm the headers match MA DLS GF category names (e.g., "General Government", "Public Safety", "Education", "Public Works"). If headers show totals only, the tableID is wrong.

### Pitfall 5: The existing `explore_gf-expenditures.html` is stale
**What goes wrong:** Planner or implementer reads the existing `explore_gf-expenditures.html` (the error page) and concludes no information is available.
**Why it happens:** The file was saved from a prior `--explore` run that proved the rdreport was wrong. It is not a source of the correct rdreport.
**How to avoid:** LOAD-01 plan task must run `--explore` again with the corrected rdreport, which will overwrite the file with the actual table data.

---

## Code Examples

### Dry-Run SC-4 Verification (Success Criterion 4)

Two options using cached files already on disk:

```bash
# Option A: Load against existing revenue-by-source JSON (351 records confirmed)
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run

# Option B: Load against existing special-revenue JSON (351 records confirmed)  
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2025_expenditures.json --dry-run

# Expected output (dry-run): prints report name, FY, record count, and sample records
# Sanity checks: non-zero totals, recognizable DLS category names, 351 records
```

Cached JSON already confirmed:
- `ma_dls_revenue-by-source_2025.json` — 351 records, dorCode "001" = Abington, Tax Levy: $42,906,155 ✓
- `ma_dls_special-revenue_2025_expenditures.json` — 351 records, dorCode "001" = Abington, Federal grants data ✓

Note: SC-4 says "3–5 sample MA cities" — `--dry-run` against a full 351-record file exceeds this and satisfies the criterion more thoroughly.

### Confirming the Checkpoint After a Test Run

```bash
# After running --load (not dry-run) against a JSON file:
node -e "const p = JSON.parse(require('fs').readFileSync('scripts/output/ma_dls_progress.json', 'utf8')); console.log(Object.keys(p)); console.log(Object.values(p).map(v => v.length));"
# Expected: ["revenue-by-source:2025"] [351]
```

### Verifying LOAD-03 Against the DB

After loading FY2022 then FY2023 for a test municipality:

```javascript
// Via Supabase MCP or psql:
SELECT fiscal_years FROM treasury.data_sources 
WHERE api_type = 'ma-dls' AND municipality_id = <id>;
// Expected: [2022, 2023]
// NOT: [2023] (overwrite bug) or [2022, 2022, 2023] (duplicate bug)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-run restart from city 1 | Checkpoint file — resume from last success | Phase 37 (this phase) | 351-city run can safely crash-recover |
| fiscal_years set to single FY on every load | Append-only with deduplication | Phase 37 (this phase) | Multi-year loads don't destroy prior FY records |
| Best-guess rdreport (unverified) | Confirmed rdreport via `--explore` | Phase 37 (this phase) | Guarantees correct data before 1755-query bulk load |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The correct GF Expenditures rdreport can be discovered by browsing the MA DLS portal URL bar | Code Examples / LOAD-01 | Low — this is how `revenue-by-source` was discovered (it uses a subreport redirect pattern). The portal is the authoritative source. |
| A2 | DOR codes are stable string values like `"001"` through `"351"` | Checkpoint pattern | Low — confirmed from two existing JSON files; dorCode is the first column in all MA DLS exports |
| A3 | `fiscal_years` column exists as a JSONB array in `treasury.data_sources` | LOAD-03 fix | Low — confirmed from multiple loaders reading it as an array and from the INSERT path in `scrapeMaDLS.js` itself |
| A4 | The `--dry-run` flag for `--load` does not call `loadToSupabase` at all (just prints) | SC-4 dry-run | Confirmed in code: `if (!values['dry-run']) { await loadToSupabase(...) } else { console.log('(dry run)'); }` — no DB writes in dry-run |

---

## Open Questions

1. **What is the correct rdreport for GF Expenditures?**
   - What we know: `ScheduleA.GF.ExpendituresByFunctionMain` is wrong (404 error). Revenue-by-source uses `RevenueBySource.RBS.RevbySource2` (a subreport pattern). Special revenue uses `ScheduleA.Special_Rev_Funds.SpecialRevFunds`.
   - What's unclear: The exact string for GF Expenditures. The portal may have renamed it or it may live under a different namespace.
   - Recommendation: Plan 37-01 is explicitly a discovery task — human browses `https://dls-gw.dor.state.ma.us` to find the GF Expenditures report link and reads the rdreport from the URL. This is the intended flow per CONTEXT.md D-02.

2. **Should `scripts/output/` be added to `.gitignore`?**
   - What we know: The discussion log says the progress file is "already gitignored" but `.gitignore` does NOT contain `scripts/output/`. The existing JSON and HTML files in `scripts/output/` are not tracked in git (they are untracked per git status, but that's because they're new, not because they're ignored).
   - What's unclear: Whether the 351-record JSON output files should be committed (they are large data files) or excluded.
   - Recommendation: The planner should add `scripts/output/` to `.gitignore` as part of Phase 37. This is low-risk cleanup consistent with the project's pattern of keeping data files out of git (see `/data/`, `EV/`, `cache/` in existing `.gitignore`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | scrapeMaDLS.js runtime | ✓ | (project standard) | — |
| `@supabase/supabase-js` | LOAD-03 UPDATE query | ✓ | Already in package.json | — |
| `exceljs` | Excel parsing (existing) | ✓ | Already in package.json | — |
| `SUPABASE_SERVICE_KEY` env var | Any --load run against DB | Required at runtime | Set in .env | Without it, --dry-run works; DB writes fail |
| MA DLS portal (network) | LOAD-01 --explore | Required at runtime | Live site | No fallback — must be online |
| `scripts/output/ma_dls_revenue-by-source_2025.json` | SC-4 dry-run | ✓ | 351 records on disk | Or use special-revenue JSON |

**Missing dependencies with no fallback:**
- MA DLS portal network access — required for LOAD-01. If the portal is down, the explore step must wait.

**Missing dependencies with fallback:**
- `SUPABASE_SERVICE_KEY` — SC-4 dry-run does not require it (dry-run path skips all DB calls).

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test suite detected for scripts/) |
| Config file | None |
| Quick run command | `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` |
| Full suite command | Same (only one meaningful automated check for this phase) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAD-01 | `--explore` finds correct GF Expenditures rdreport | manual | `node scripts/scrapeMaDLS.js --explore --report gf-expenditures` → human reads console | ✅ (script exists) |
| LOAD-02 | Interrupted run resumes from last success | manual | Run --load, kill mid-run, re-run, confirm "Skipped N already loaded" in output | ✅ Wave 0: none — manual test |
| LOAD-02 | No duplicate rows after resume | smoke | Query DB for duplicate budget tree rows after re-run | manual-only |
| LOAD-03 | Second FY appends, not overwrites | smoke | Load FY2022 JSON, load FY2023 JSON, query `fiscal_years` column | manual-only |
| SC-4 | Dry-run against 3–5 cities passes sanity checks | smoke | `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` | ✅ |

### Sampling Rate

- **Per task commit:** `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run`
- **Per wave merge:** Full manual test sequence per LOAD-02 and LOAD-03
- **Phase gate:** All 4 success criteria confirmed before `/gsd-verify-work`

### Wave 0 Gaps

- No automated test infrastructure gaps — this phase uses manual verification per established project pattern for loader scripts.

---

## Security Domain

> No new network endpoints, no auth changes, no user-facing input. Existing security posture unchanged.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | minimal | DOR codes validated via `/^\d+$/.test(dorCode)` already in `scrapeReport()` — checkpoint reads DOR codes only from that validated path |
| V6 Cryptography | no | — |

No new threat surface introduced. The progress file `ma_dls_progress.json` contains only DOR codes (public data — MA municipality identifiers). No secrets written to filesystem.

---

## Sources

### Primary (HIGH confidence — verified by direct code inspection)

- `C:\treasury-tracker\scripts\scrapeMaDLS.js` — Full 748-line source read; all three bug locations confirmed
- `C:\treasury-tracker\scripts\output\explore_gf-expenditures.html` — Error page confirming `ScheduleA.GF.ExpendituresByFunctionMain` is wrong
- `C:\treasury-tracker\scripts\output\ma_dls_revenue-by-source_2025.json` — 351 records confirmed; DOR code "001" = Abington format verified
- `C:\treasury-tracker\scripts\output\ma_dls_special-revenue_2025_expenditures.json` — 351 records confirmed; available for SC-4 dry-run
- `C:\treasury-tracker\.planning\phases\37-ma-loader-hardening\37-CONTEXT.md` — All decisions read verbatim
- `C:\treasury-tracker\.gitignore` — `scripts/output/` confirmed NOT in gitignore

### Secondary (MEDIUM confidence — project state documents)

- `C:\treasury-tracker\.planning\STATE.md` — MA DLS context, loader history
- `C:\treasury-tracker\.planning\REQUIREMENTS.md` — LOAD-01/02/03 exact acceptance criteria
- `C:\treasury-tracker\.planning\phases\37-ma-loader-hardening\37-DISCUSSION-LOG.md` — Decision alternatives considered

### Tertiary (LOW confidence — not needed, all findings are HIGH)

- None required — all research findings derive from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all tools already in use
- Architecture: HIGH — bugs located at exact line numbers via code inspection
- Pitfalls: HIGH — derived from reading the actual code and existing HTML outputs
- LOAD-01 rdreport candidates: LOW — the correct value requires live portal access

**Research date:** 2026-06-09
**Valid until:** Until Phase 38 begins (30-day window; no external dependencies except MA DLS portal availability)
