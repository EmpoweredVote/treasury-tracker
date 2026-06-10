# Phase 38: MA City Budget Load — Research

**Researched:** 2026-06-10
**Domain:** MA DLS bulk data load — scraping 351 municipalities × 5 fiscal years × 2 reports
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MA-01 | General Fund Expenditures (operating) loaded for all 351 MA cities, FY2021–FY2025 | Special-revenue report (`ScheduleA.Special_Rev_Funds.SpecialRevFunds`) is the available operating proxy. GF Expenditures are excluded (LOAD-01 resolved by exclusion). Phase 38 delivers federal-grants data labeled `dataset_type: 'operating'`. |
| MA-02 | Revenue by Source loaded for all 351 MA cities, FY2021–FY2025 | `revenue-by-source` report (`RevenueBySource.RBS.RevbySource2`) is confirmed working. FY2025 JSON already on disk (351 records). FY2021–2024 need scraping. |
| MA-03 | All 351 MA cities visible in city picker under "Massachusetts" | `STATE_NAMES['MA'] = 'Massachusetts'` already exists in `src/utils/wikiImage.ts`. EntitySwitcher uses `HAVING COUNT(b.id) > 0` — cities appear automatically once budget rows exist. No frontend code change needed. |
</phase_requirements>

---

## Summary

Phase 38 is a bulk data load: run `scrapeMaDLS.js` to scrape and load two MA DLS reports for FY2021–FY2025 for all 351 MA municipalities. The loader is fully hardened (Phase 37 complete). All 351 municipality rows and 702 `data_source` rows (351 operating + 351 revenue) are already seeded in the DB with `fiscal_years: [2025]` from a prior Phase 37 live-test run. Zero `treasury.budgets` rows exist for any of these 351 cities — no data is visible in the app yet.

The work is mechanical: 8 scrape runs (FY2021–FY2024, both reports — FY2025 JSON already on disk), then 10 load runs (all 5 FYs × 2 reports). Each load run calls `treasury_sync_budget_tree` 351 times. The checkpoint resumes safely if any run fails.

**MA-03 (city picker) is zero-code:** `STATE_NAMES['MA'] = 'Massachusetts'` already exists. Cities appear in the picker automatically once their `treasury.budgets` rows exist.

**Primary recommendation:** Run scrape+load for FY2021–2024 (both reports), then load FY2025 (JSON already on disk). Verify DB row counts and spot-check 3 cities in the app.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scraping MA DLS portal | Data load script (Node.js CLI) | — | `scrapeMaDLS.js` already handles scrape + Excel export + HTML fallback |
| Writing budget data to DB | Data load script (treasury_sync_budget_tree RPC) | — | Same RPC used by all other loaders |
| City picker display | Frontend (EntitySwitcher.tsx) | ev-accounts-api | EntitySwitcher reads `available_datasets` from API; auto-populates once budgets exist |
| MA state label in city picker | Frontend (STATE_NAMES constant) | — | Already present; no change needed |
| Fiscal year accumulation | Data load script (data_sources.fiscal_years JSONB array) | — | LOAD-03 append-dedup already implemented |
| Checkpoint/resume | Data load script (ma_dls_progress.json) | — | LOAD-02 already implemented |

---

## Standard Stack

### Core — No new packages required

All tooling needed for Phase 38 already exists:

| Tool | Version | Purpose | Status |
|------|---------|---------|--------|
| `scripts/scrapeMaDLS.js` | Phase 37 hardened | Scrape + seed + load for all MA DLS reports | Ready to run |
| `exceljs` | already installed | Parse Excel exports from DLS portal | Already imported in scrapeMaDLS.js |
| `@supabase/supabase-js` | already installed | DB writes via treasury_sync_budget_tree RPC | Already imported |

**No new packages to install.** Phase 38 is a data operation, not a code build.

### Package Legitimacy Audit

No new packages are installed in this phase. Audit: N/A.

---

## Pre-Existing DB State — Critical for Planning

[VERIFIED: direct Supabase query 2026-06-10]

| Entity | Count | Status |
|--------|-------|--------|
| MA municipalities (`state='MA'`, `entity_type='city'`) | 351 | Seeded; no population data yet (Phase 39) |
| MA state entity (`entity_type='state'`) | 1 | Seeded with hardcoded budgets FY2021–2025 (STATE-01 deferred to Phase 39) |
| MA DLS `data_sources` (operating, `api_type='ma-dls'`) | 351 | Exist; `fiscal_years: [2025]`; no budgets linked |
| MA DLS `data_sources` (revenue, `api_type='ma-dls'`) | 351 | Exist; `fiscal_years: [2025]`; no budgets linked |
| `treasury.budgets` rows for any of the 351 MA cities | 0 | None — bulk load not yet run |
| MA cities visible in city picker | 1 (Cambridge only, from hardcoded legacy data) | Cambridge was pre-seeded independently before MA DLS work began |

**Consequence:** The 702 `data_source` rows already exist. The `--load` command will hit the `existingDs` branch (UPDATE path) for FY2025, appending FY year to `fiscal_years`. For FY2021–2024, the data_source row already exists too, so those are also UPDATE paths. No new INSERT of data_source rows is needed — all 351 cities already have their operating and revenue data_source rows.

---

## Architecture Patterns

### System Architecture Diagram

```
MA DLS Portal (dls-gw.dor.state.ma.us)
        |
        | HTTP (Excel export or HTML pagination)
        v
scripts/scrapeMaDLS.js --scrape --report X --fy Y
        |
        | writes to disk
        v
scripts/output/ma_dls_{report}_{fy}.json   (351 records)
        |
        | --load --file
        v
loadToSupabase()
   ├── readProgress()  [skip already-loaded DOR codes]
   ├── for each record:
   │    ├── lookup municipality_id from DB
   │    ├── find existing data_source row (UPDATE fiscal_years)
   │    ├── build budget tree (amountCols → {n, a, i})
   │    └── treasury_sync_budget_tree RPC
   └── writeProgress()  [checkpoint per success]
        |
        v
treasury.budgets + treasury.budget_categories
        |
        | via ev-accounts-api getCities() SQL join
        v
Municipality.available_datasets in frontend
        |
        v
EntitySwitcher.tsx  →  "MASSACHUSETTS" group appears
```

### Recommended Plan Structure

Two waves:

**Wave 1 — Scrape FY2021–2024** (8 scrape runs, can run sequentially; FY2025 already on disk):
```bash
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2021
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2022
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2023
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2024
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2021
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2022
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2023
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2024
```

**Wave 2 — Load all 10 FY JSON files** (blocked on Wave 1):
```bash
# Revenue-by-source (all 5 FYs)
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2021.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2022.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2023.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2024.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json

# Special-revenue (all 5 FYs)
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2021_expenditures.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2022_expenditures.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2023_expenditures.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2024_expenditures.json
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_special-revenue_2025_expenditures.json
```

**Important:** The `--scrape` command uses `--type Expenditures` by default for `special-revenue` (which has `supportsType: true`). The FY2025 file on disk is named `ma_dls_special-revenue_2025_expenditures.json`, confirming this is the correct amountType for the operating dataset. Do not omit `--type Expenditures` for `special-revenue` scrapes or the filename pattern changes.

### Anti-Patterns to Avoid

- **Running `--scrape` and `--load` in a single combined command for multi-FY runs:** The scraper supports `--scrape --all --fy` but only one FY at a time. There is no multi-FY loop in the CLI. Run each FY separately.
- **Deleting `ma_dls_progress.json` between runs:** The progress file is the crash-resume ledger. Never delete it until all 10 load runs are confirmed complete.
- **Re-seeding municipalities:** All 351 municipality rows exist. Running `--seed` again would be a no-op (idempotent) but wastes time.
- **Assuming data_sources need INSERT:** All 702 data_source rows exist. Every `--load` run will hit the UPDATE (fiscal_years append) path, not INSERT.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-FY loop | Custom loop script | Run 10 sequential CLI commands | scrapeMaDLS.js handles one FY per invocation — sequential is safest |
| City picker MA header | `STATE_LABELS` constant | `STATE_NAMES['MA']` already exists | Already returns "Massachusetts" for state 'MA' |
| Checkpoint/resume | New resume logic | `ma_dls_progress.json` already implemented | Phase 37 built this — do not re-implement |
| Row count verification | Manual count | SQL query against `treasury.budgets` | Direct count is the SC-5 verification |

---

## Common Pitfalls

### Pitfall 1: `--scrape --all` vs `--scrape --report X`
**What goes wrong:** `--scrape --all` passes all REPORTS[] to the scrape loop. With only 2 reports in REPORTS[], `--all` should work fine, but it does not support `--type Expenditures` filtering cleanly.
**Why it happens:** `special-revenue` has `supportsType: true`. The `--all` flag loops through REPORTS and passes the `amountType` argument — but `--all` may be used without `--type Expenditures`, causing the wrong filename pattern.
**How to avoid:** Prefer explicit `--report special-revenue` with `--type Expenditures` to get the deterministic filename pattern `ma_dls_special-revenue_{fy}_expenditures.json`.
**Warning signs:** A JSON output file named `ma_dls_special-revenue_2021.json` (no `_expenditures` suffix) was scraped without the type filter.

### Pitfall 2: Special-Revenue Is Federal Grants, Not General Fund
**What goes wrong:** SC-2 says "Money Out (operating) tab showing General Fund Expenditures." The special-revenue report contains Schedule A Part 3 (federal grant expenditures), NOT General Fund departmental spending.
**Why it happens:** GF Expenditures rdreport is undiscoverable without browser inspection (Phase 37 resolution). Special-revenue is the best available proxy labeled `dataset_type: 'operating'`.
**How to avoid:** Accept this as the Phase 38 scope. SC-2 will be satisfied for any city that received any federal grants. 59 cities had zero federal grants in FY2025 — they will have no operating data for FY2025 (but may have data for other years).
**Warning signs:** 59 cities will show only a Money In tab after Phase 38. This is expected, not a bug.

### Pitfall 3: Progress File Missing for FY2025 Load
**What goes wrong:** The FY2025 JSON files exist on disk and were loaded previously (creating the 702 data_source rows), but no `ma_dls_progress.json` file exists. Running the FY2025 load again will re-process all 351 cities.
**Why it happens:** The progress file is in `scripts/output/` which is `.gitignore`d. The prior load run that created the data_source rows did not persist the progress file to this session.
**How to avoid:** Re-running the FY2025 load is safe — the `treasury_sync_budget_tree` RPC is idempotent (it upserts budget data). The fiscal_years dedup guard prevents duplicate entries. This is expected behavior.
**Warning signs:** None — re-running is safe. The checkpoint file will be rebuilt during Wave 2.

### Pitfall 4: Data Source `fiscal_years` Array Mismatch
**What goes wrong:** After loading FY2021–2025, a data_source row should show `fiscal_years: [2021, 2022, 2023, 2024, 2025]`. If it shows `[2025]` only (or just the last loaded FY), LOAD-03 is not working.
**Why it happens:** Could only happen if the LOAD-03 dedup guard was broken or the SELECT missed `fiscal_years`.
**How to avoid:** After the full load, verify sample data_source rows with:
```sql
SELECT fiscal_years FROM treasury.data_sources
WHERE api_type = 'ma-dls' AND dataset_type = 'revenue'
ORDER BY created_at LIMIT 5;
```
Expected: `{2025,2024,2023,2022,2021}` (order may vary — insertion order).

### Pitfall 5: SC-5 Row Count Threshold
**What goes wrong:** SC-5 requires "DB row count for MA operating budget entries exceeds 1,000 rows." With `special-revenue` having 9 amount columns and 59 cities having all-zero data for some FYs, the actual budget_categories row count may be lower than expected.
**Why it happens:** Each non-zero column creates one budget_categories row per city-FY. With 292 non-zero cities × 5 FYs × ~8 categories avg = ~11,680 rows. Well above 1,000.
**How to avoid:** SC-5 threshold of 1,000 is very conservative. It will be met. Post-load verification:
```sql
SELECT COUNT(*) FROM treasury.budget_categories bc
JOIN treasury.budgets b ON b.id = bc.budget_id
JOIN treasury.municipalities m ON m.id = b.municipality_id
WHERE m.state = 'MA' AND b.dataset_type = 'operating';
```

---

## Code Examples

### FY2021–2024 Scrape Commands (Wave 1)
```bash
# Source: scripts/scrapeMaDLS.js --help / usage pattern
# Revenue-by-source (no --type needed — supportsType: false)
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2021
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2022
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2023
node scripts/scrapeMaDLS.js --scrape --report revenue-by-source --fy 2024

# Special-revenue (--type Expenditures required for deterministic filename)
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2021 --type Expenditures
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2022 --type Expenditures
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2023 --type Expenditures
node scripts/scrapeMaDLS.js --scrape --report special-revenue --fy 2024 --type Expenditures
```

### DB Row Count Verification (SC-5)
```javascript
// Source: verified pattern used in prior MA DLS testing (2026-06-10)
const { data: maMunis } = await supabase.schema('treasury').from('municipalities')
  .select('id').eq('state', 'MA');
// Then count budget_categories for those municipality IDs
```

### Post-Load Data Source Verification (LOAD-03)
```bash
# Check fiscal_years array for a sample city
node -e "
const {createClient} = require('@supabase/supabase-js');
// ... (use .env credentials)
"
```

Or via Supabase MCP:
```sql
SELECT name, fiscal_years
FROM treasury.data_sources
WHERE api_type = 'ma-dls' AND dataset_type = 'revenue'
ORDER BY created_at
LIMIT 5;
```

### Live LOAD-02 Resume Test (required — first time this runs in Phase 38)
```bash
# 1. Start a real load run
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json

# 2. Kill it with Ctrl+C after ~10-20 cities complete

# 3. Re-run — expect "Skipped N already loaded (checkpoint)"
node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json
```
Note: Phase 37 verified this code-structurally but never ran a live load. This is the first live confirmation.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| gf-expenditures as operating data | special-revenue as operating proxy | Phase 37 (2026-06-10) | GF Expenditures blocked; 59 cities will have no operating data for years where they received zero federal grants |
| data_source rows created on first load | data_source rows pre-exist for all 351 cities | Phase 37 test run (pre-Phase 38) | All `--load` runs will hit UPDATE path (not INSERT) for data_sources |

---

## Runtime State Inventory

> Phase 38 is a data load phase, not a rename/refactor. This section confirms pre-existing state that the load will interact with.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 702 MA DLS `data_sources` rows with `fiscal_years: [2025]` | No cleanup needed. `--load` will UPDATE (append) new FYs idempotently via LOAD-03 |
| Stored data | 0 MA DLS `treasury.budgets` rows for 351 cities | These will be created by `treasury_sync_budget_tree` RPC during Phase 38 load |
| Stored data | 28 Cambridge hardcoded budget rows (pre-MA-DLS legacy data) | Do not touch. Cambridge will gain additional budget rows from MA DLS load. |
| Stored data | 10 MA state entity hardcoded budget rows | Do not touch. STATE-01 is Phase 39 scope. |
| Live service config | `ma_dls_progress.json` does not exist | Will be created by first `--load` run. No prior run to resume from. |
| Secrets/env vars | `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in `.env` | Required by all `--load` runs. Export or use dotenv. |
| Build artifacts | None | — |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `scrapeMaDLS.js` | Yes | v24.13.0 | — |
| `exceljs` | Excel export parsing | Yes | installed | HTML scraping fallback built into scrapeMaDLS.js |
| MA DLS portal (`dls-gw.dor.state.ma.us`) | Scraping FY2021–2024 | Yes (confirmed in Phase 37) | — | None — must be reachable |
| Supabase DB | All `--load` runs | Yes | kxsdzaojfaibhuzmclfq | — |
| `SUPABASE_SERVICE_KEY` env var | All `--load` runs | Yes (in `.env`) | — | — |

**Missing dependencies with no fallback:** MA DLS portal network access. If the portal is unreachable, scraping FY2021–2024 is blocked. All FY2025 JSON is already on disk and can be loaded without network access.

---

## Validation Architecture

> `workflow.nyquist_validation` not set to false — validation section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured — this is a data load phase with no automated test suite |
| Config file | none |
| Quick run command | `node scripts/scrapeMaDLS.js --load --file scripts/output/ma_dls_revenue-by-source_2025.json --dry-run` |
| Full suite command | Post-load DB count query + human spot-check of 3 MA cities in app |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| MA-01 | 351 cities have operating budget data | DB count | `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND b.dataset_type='operating'` | Expected: 351 × 5 = 1,755 rows (minus all-zero cities across years) |
| MA-02 | 351 cities have revenue budget data | DB count | `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND b.dataset_type='revenue'` | Expected: 351 × 5 = 1,755 rows |
| MA-03 | Cities visible in city picker | Manual | Open app, expand city picker, verify "MASSACHUSETTS" group appears | Automatic once budgets exist |
| SC-5 | budget_categories count > 1,000 for MA operating | DB count | Query budget_categories joined to MA operating budgets | Expected: ~11,000+ rows |

### Wave 0 Gaps

None — no test infrastructure needed for a data load phase. All verification is post-load DB queries and human app spot-check.

---

## Security Domain

> Phase 38 makes no changes to authentication, session management, API endpoints, or input validation paths. All operations are:
> - Outbound HTTP GET/POST to a public government portal (no auth required)
> - Supabase writes via service-role key (bypasses RLS — same as all other loaders)
> - No new API endpoints, no new user-facing input surfaces

No ASVS categories apply to this phase. Security posture unchanged from Phase 37.

---

## MA-03: City Picker Analysis — Zero Frontend Code Required

[VERIFIED: read EntitySwitcher.tsx and STATE_NAMES source 2026-06-10]

The city picker (EntitySwitcher.tsx) uses this logic to show groups:

1. `STATE_NAMES['MA'] = 'Massachusetts'` — already exists in `src/utils/wikiImage.ts` line 22 [VERIFIED]
2. EntitySwitcher groups cities by `m.state` and renders `STATE_NAMES[state] || state` as the header [VERIFIED]
3. The `getCities()` SQL query uses `HAVING COUNT(b.id) > 0` — a city only appears once it has budget rows [VERIFIED: ev-accounts-api treasuryService.ts]
4. Once `treasury_sync_budget_tree` creates `treasury.budgets` rows for MA cities, those cities appear in `getCities()` automatically

**Conclusion:** MA-03 requires no code changes. "Massachusetts" will appear as a city group the moment any MA city has a budget row.

---

## Scope Clarification: MA-01 vs. Actual Operating Data

[VERIFIED: reviewed REQUIREMENTS.md LOAD-01 resolution, 37-01-SUMMARY.md, scrapeMaDLS.js REPORTS[]]

REQUIREMENTS.md MA-01 says: "General Fund Expenditures (operating) loaded for all 351 MA cities."

However, the General Fund Expenditures report was excluded from REPORTS[] in Phase 37. Phase 38's "operating" data is actually **Schedule A — Special Revenue Funds** (federal grants received by cities), labeled `dataset_type: 'operating'` in the loader.

This is the accepted scope per STATE.md: "Phase 38 scoped to 2 reports: special-revenue + revenue-by-source."

**Planning implication:** SC-2 ("any MA city opens a Money Out (operating) tab") will be satisfied only for cities that received non-zero federal grants in at least one of FY2021–FY2025. 59 cities had zero federal grants in FY2025 specifically. Across 5 years, the all-zero count may be lower. The planner should note this caveat in success criteria interpretation.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FY2021–2024 data is available on the MA DLS portal for both reports | Standard Stack | If portal doesn't have data before FY2022 for some report, those FY scrape runs return 0 records. Lower FY coverage but not a blocker — at least FY2025 loads. |
| A2 | Special-revenue report has non-zero data for most cities across FY2021–FY2024 (not just FY2025) | Common Pitfalls | If earlier years also have many zero-cities, the all-zero count across all 5 FYs may be higher. Some cities may never appear in the Money Out tab. |
| A3 | `treasury_sync_budget_tree` RPC is idempotent for repeated loads of the same city+FY+dataset_type | Architecture Patterns | If not idempotent, re-running FY2025 load creates duplicate budget rows. Based on prior behavior (all other states), RPC is designed for idempotent upsert. [ASSUMED] |

---

## Open Questions

1. **Should the plan include a WR-04 fix for `SUPABASE_URL` hardcoded fallback?**
   - What we know: Line 42 of scrapeMaDLS.js has `process.env.SUPABASE_URL` (no hardcoded fallback, unlike the WR-04 pattern in older loaders). The WR-04 pattern is already fixed.
   - What's unclear: The CONTEXT.md says "WR-04 pattern explicitly deferred to Phase 38." But the code shows it's already fixed (no hardcoded fallback).
   - Recommendation: Grep line 42 at plan time to confirm. If already fixed, skip. If not, add a 5-minute WR-04 fix task.

2. **How many all-zero cities across all 5 FYs?**
   - What we know: 59 cities had zero special-revenue in FY2025.
   - What's unclear: Whether earlier years have more or fewer zero-cities.
   - Recommendation: Plan should note that some cities may have no operating data; this is expected and not a bug.

---

## Sources

### Primary (HIGH confidence)
- `scripts/scrapeMaDLS.js` — direct code read, full file
- `.planning/phases/37-ma-loader-hardening/37-01-SUMMARY.md` — LOAD-01 resolution facts
- `.planning/phases/37-ma-loader-hardening/37-02-SUMMARY.md` — LOAD-02/LOAD-03 implementation details
- `.planning/phases/37-ma-loader-hardening/37-VERIFICATION.md` — verification status
- `src/components/EntitySwitcher.tsx` — city picker logic
- `src/utils/wikiImage.ts` — STATE_NAMES map
- C:/EV-Accounts/backend/src/lib/treasuryService.ts — getCities() SQL
- Supabase DB queries — all counts and structure verified live 2026-06-10
- `scripts/output/ma_dls_revenue-by-source_2025.json` — 351 records confirmed
- `scripts/output/ma_dls_special-revenue_2025_expenditures.json` — 351 records, 59 all-zero

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` §MA DLS Loader Context — accumulated context, cross-checked against source

---

## Metadata

**Confidence breakdown:**
- Loader behavior: HIGH — source code read directly, DB state verified live
- City picker behavior: HIGH — EntitySwitcher.tsx and ev-accounts-api SQL read directly
- FY2021–2024 data availability: ASSUMED — portal was accessible in Phase 37 for FY2025; earlier years assumed available based on DLS portal going back to FY2003 (per STATE.md)
- All-zero city count for earlier FYs: ASSUMED — only FY2025 verified

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable; MA DLS portal structure is not expected to change)
