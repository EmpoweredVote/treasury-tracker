# Phase 29: Long Beach + Bakersfield CA Data Load - Research

**Researched:** 2026-06-05
**Domain:** Municipal budget PDF/CSV extraction (California cities) — pdfplumber pipeline + Bakersfield CSV loader
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Long Beach FY convention — ending-year convention; "FY2025" = Oct 2024 – Sep 2025; integer `2025` stored in DB.
**D-02:** Non-standard FY period documented in seeder comment only; no DB schema change, no UI change.
**D-03:** Researcher checks SODA/CSV endpoint at `budget.bakersfieldcity.us` first; fall back to PDF only if broken/incomplete/lacks multi-year history.
**D-04:** If PDF extraction needed for Bakersfield, use pdfplumber. Consistent with all other CA city extractors.
**D-05:** Long Beach — target FY2022–2026 (4–5 years); researcher determines how many adopted budget PDFs have consistent structure.
**D-06:** Bakersfield — target FY2022–2026; researcher determines what's available with consistent PDF structure (or SODA).
**D-07:** Four plans: Plan 1 (seed both cities), Plan 2 (Long Beach extractor + processor), Plan 3 (Bakersfield extractor or SODA loader), Plan 4 (enrichment + spot-check).
**D-08:** Enrichment cost threshold: $0.10 combined (Long Beach + Bakersfield). Estimate before running.

### Claude's Discretion
- Exact number of FY years for each city: researcher determines based on available PDFs / SODA data with consistent format.
- Whether to use SODA vs PDF for Bakersfield: researcher verifies SODA endpoint quality and decides.
- Page-range extraction approach for Long Beach PDFs: researcher picks targeted vs full-document based on actual PDF layout.
- Exact data_source row names: planner determines; must match what processors look up via `treasury_list_source_ids`.

### Deferred Ideas (OUT OF SCOPE)
- County linking for Bakersfield (Kern County) — `county_id` stays NULL for Bakersfield.
- Pre-FY2022 historical data for Long Beach or Bakersfield.
- Port of Long Beach data — separate government entity, explicitly out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-04 | Long Beach CA operating + revenue budget loaded and visible in app. Fiscal year Oct–Sep; exclude Port of Long Beach (~$760M); exclude enterprise funds (Gas, Refuse, Water, Airport, Harbor). Target ~$1.5B General Fund, ~$3.6B all-funds. | PDF extractor confirmed (FY22–FY26 PDFs verified accessible); General Fund PDFs directly downloadable |
| DATA-07 | Bakersfield CA operating + revenue budget loaded and visible in app. Target ~$765M operating (multi-fund), ~$853M total including capital. | CSV endpoint confirmed for FY2019–2024 but lacks FY2025–2026; PDF path required for FY2025–2026 |
| ENRICH-01 | Long Beach and Bakersfield have AI-generated category enrichment. Run `enrichCategories.js --city ... --state CA --year YYYY`. Combined cost gate: $0.10. | `enrichCategories.js` fully reusable; no changes needed |
| POPUL-01 | Long Beach (~451K) and Bakersfield (~417K) seeded with 2024 Census population. Per-capita displays correctly. | Population values from Census sub-est2024_06.csv; same methodology as prior CA cities |
</phase_requirements>

---

## Summary

Phase 29 loads Long Beach and Bakersfield into the Treasury Tracker following the established CA city pipeline: Python pdfplumber extractor → Node.js processor → `treasury_sync_budget_tree` RPC. This phase follows the same pattern as Phase 28 (Oakland + San Jose), with the seeder and extractor/processor templates already proven.

**Long Beach** has a non-standard fiscal year (October 1 – September 30). Adopted budget PDFs are available from `longbeach.gov/finance` for FY22 through FY26 — all verified downloadable. The General Fund is organized in a dedicated "Fund Summary — General Fund Group" PDF section per fiscal year. The Port of Long Beach (~$760M) is a fully separate government entity and must be excluded at extraction time. Enterprise funds (Gas, Refuse, Water, Airport, Harbor) must be filtered. Target General Fund total: ~$1.5B.

**Bakersfield** has a simpler budget but a critical data gap: the `budget.bakersfieldcity.us` CSV endpoint covers only FY2019–2024 and is NOT a Socrata SODA API (it is a plain municipal CSV export). FY2025 and FY2026 data are NOT in the CSV. The SODA/CSV path (D-03) cannot meet the FY2022–2026 target depth for the two most recent years. The PDF path is required for FY2025 and FY2026; the CSV path can supplement FY2022–2024. However, the CSV scope is also problematic: the "GENERAL FUND" filter in the CSV yields only ~$287M for FY2024, not the expected ~$765M — because the $765M operating target spans multiple funds (General Fund + PUBSAF 1% Sales Tax + others). Decision: **use PDF extraction for Bakersfield** (pdfplumber), consistent with D-04. Adopted budget PDFs are available at `docs.bakersfieldcity.us` for FY2024-25 and FY2025-26 (verified accessible).

**Primary recommendation:** Both cities use the pdfplumber PDF path. No SODA endpoint. Write `extractLongBeach.py` and `extractBakersfield.py` modeled on `extractOakland.py` / `extractSanJose.py`. Write `processLongBeach.js` and `processBakersfield.js` modeled on `processOakland.js`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Long Beach PDF download | Developer task (manual) | — | PDFs are static files on longbeach.gov; no API |
| Bakersfield PDF download | Developer task (manual) | — | PDFs at docs.bakersfieldcity.us; static files |
| Budget extraction | Python (pdfplumber script) | — | Same pattern as Oakland/SanJose/Portland |
| Data loading | Node.js processor script | — | execSync Python → treasury_sync_budget_tree RPC |
| Municipality seeding | Node.js seeder script | — | upsertMunicipality() + data_source upserts |
| Enrichment | Node.js enrichCategories.js | — | Fully reusable; no changes needed |
| App display | Supabase + existing frontend | — | EntitySwitcher picks up new CA cities automatically |
| county_id for Long Beach | Seeder / DB | — | Long Beach is in LA_COUNTY_CITY_NAMES (Phase 25 linked) — county_id may already be set |
| county_id for Bakersfield | Deferred | — | Kern County not loaded; stays NULL per deferred scope |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfplumber | 0.11.9 (confirmed installed) | PDF text extraction | Proven across Portland/Gresham/Troutdale/Oakland/SanJose; already installed |
| @supabase/supabase-js | 2.101.1 (in repo) | DB client | Project standard |
| Node.js | v24.13.0 (confirmed) | Processor scripts | Project standard |
| Python 3 | 3.14.3 (confirmed) | Extractor scripts | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:child_process execSync | built-in | Run Python extractor from Node.js | Same pattern as processOakland.js |
| node:fs readdirSync, existsSync | built-in | PDF directory discovery | resolvePdfDir() pattern |
| node:util parseArgs | built-in | CLI --dry-run, --pdf flags | Same pattern as processOakland.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfplumber (PDF) | Bakersfield CSV endpoint | CSV covers only FY2019-2024; lacks FY2025-2026; multi-fund scope issue — CSV rejected |
| Separate extractor per FY | Single extractor with FY detection | Single extractor preferred; FY detected from PDF header or filename |
| Full-book PDF download | Section-specific PDF (Fund Summary only) | Section-specific preferred for Long Beach — fund summary PDFs are 400-550KB vs 16-29MB full book |

**Installation:** No new packages needed. `pdfplumber` already installed. All Node.js packages already in `package.json`.

---

## Package Legitimacy Audit

> This phase installs NO new packages. All dependencies are pre-installed:
> - `pdfplumber` (Python) — already installed at v0.11.9, used since Phase 17
> - `@supabase/supabase-js` — already in package.json at v2.101.1
> - All Node.js built-ins

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none

---

## D-03 Decision: Bakersfield SODA/CSV vs PDF

**Verdict: PDF extraction required. CSV path rejected.**

Evidence gathered from `budget.bakersfieldcity.us/api/operating_budget.csv`:

| Finding | Detail |
|---------|--------|
| Not Socrata | No SODA API structure; plain municipal CSV export |
| Fiscal years | Only 2019–2024; NO FY2025 or FY2026 data |
| General Fund scope | `fund = 'GENERAL FUND'` → ~$287M for FY2024; does NOT match target ~$765M |
| Multi-fund reality | $765M target spans GENERAL FUND + PUBSAF 1% SALES TAX + EQUIPMENT MANAGEMENT + REFUSE + others |
| Revenue CSV | Same limitation — FY2019-2024 only; ~$298M General Fund revenue for FY2024 |

The Bakersfield "operating total" of ~$765M is all-operating-funds, not just the General Fund. Even if the CSV covered FY2025-2026, building the correct fund-filter logic for the CSV would be as complex as parsing the PDF. Adopted budget PDFs at `docs.bakersfieldcity.us` are confirmed accessible for FY2024-25 and FY2025-26. PDF path is cleaner, consistent with D-04, and aligns with project patterns.

**Recommendation (discretion exercised per D-03):** Use pdfplumber PDF extraction for Bakersfield. No SODA loader. Use `extractOakland.py` as template.

---

## Architecture Patterns

### System Architecture Diagram

```
Long Beach PDFs                    Bakersfield PDFs
(docs/Long Beach/*.pdf)            (docs/Bakersfield/*.pdf)
  [FY22–FY26 GF fund summary]       [FY24-25, FY25-26 adopted budget]
        |                                    |
        v                                    v
extractLongBeach.py               extractBakersfield.py
  (pdfplumber; General Fund         (pdfplumber; all operating funds
   department rows; Oct-Sep FY)      dept rows; note: multi-fund scope)
        |                                    |
        | stdout JSON                        | stdout JSON
        v                                    v
processLongBeach.js               processBakersfield.js
  (execSync extractor)              (execSync extractor)
  (resolvePdfDir worktree-safe)     (resolvePdfDir worktree-safe)
  (sanity band: $1.3B-$1.7B)        (sanity band: $600M-$900M)
  (FY = ending year, Oct-Sep)       (FY = ending year)
        |                                    |
        +----------------+------------------+
                         |
                         v
            treasury_sync_budget_tree RPC
            (p_data_source_id, p_fiscal_year,
             p_dataset_type, p_total, p_tree,
             p_row_count, p_triggered_by)
                         |
                         v
              Supabase treasury schema
              (budgets + budget_categories)
                         |
                         v
              enrichCategories.js
              (--city "Long Beach" --state CA --year YYYY)
              (--city Bakersfield  --state CA --year YYYY)
              (combined cost gate: $0.10)
                         |
                         v
              App display (EntitySwitcher.tsx)
              Both cities appear under "California"
              automatically via state='CA' filter
```

### Recommended Project Structure
```
docs/
├── Long Beach/          # General Fund summary PDFs, one per FY
│   ├── fy22-fund-summary-gp.pdf
│   ├── fy23-fund-summary-gp.pdf
│   ├── fy24-fund-summary-gp.pdf
│   ├── fy25-fund-summary-gp.pdf
│   └── fy26-fund-summary-gp.pdf
└── Bakersfield/         # Adopted budget PDFs (full book or relevant sections)
    ├── fy2024-25-adopted-budget.pdf
    └── fy2025-26-adopted-budget.pdf

scripts/
├── seedLongBeachBakersfieldCA.js   # Plan 1: two-city seeder
├── extractLongBeach.py              # Plan 2: pdfplumber extractor
├── processLongBeach.js              # Plan 2: Node.js processor
├── extractBakersfield.py            # Plan 3: pdfplumber extractor
└── processBakersfield.js            # Plan 3: Node.js processor
```

### Pattern 1: Two-City Seeder (seedLongBeachBakersfieldCA.js)
**What:** Idempotent upsert of municipality rows + data_source rows for both cities, verified via treasury_list_source_ids RPC.
**When to use:** Plan 1 (must run before any processor).
**Example (from seedOaklandSanJoseCA.js):**
```javascript
// Source: scripts/seedOaklandSanJoseCA.js lines 65-68
const MUNICIPALITIES = [
  { name: 'Long Beach', state: 'CA', entity_type: 'city', population: 451000, population_year: 2024 },
  { name: 'Bakersfield', state: 'CA', entity_type: 'city', population: 417000, population_year: 2024 },
];
// Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01)
// county_id for Long Beach: seeder checks if already set by Phase 25 LA County linking
// county_id for Bakersfield: stays NULL (Kern County not loaded — deferred)
```

### Pattern 2: pdfplumber Extractor (extractLongBeach.py)
**What:** Scans Long Beach General Fund summary PDF; extracts department names + adopted amounts for two fiscal years (current + prior) from columnar table.
**When to use:** Plan 2. Adapt from extractOakland.py or extractSanJose.py.
**Key adaptation:** Long Beach GF summary is in the `35-fund-summary-gp` (FY24/FY25) or `33-fund-summary-gp` (FY26) PDF section. The FY is derived from the PDF filename (e.g., `fy25-fund-summary-gp.pdf` → FY2025). Amounts likely in full dollars (NOT thousands) — verify during dry-run.

### Pattern 3: Node.js Processor (processLongBeach.js)
**What:** Runs Python extractor via execSync, builds budget tree, loads via treasury_sync_budget_tree RPC. Includes resolvePdfDir() worktree-safe helper and sanity band check.
**When to use:** Plan 2. Adapt from processOakland.js.
**Key adaptation:**
```javascript
// Sanity band: Long Beach General Fund ~$1.3B-$1.7B per FY
// (Target: ~$1.5B General Fund per REQUIREMENTS.md DATA-04)
const GF_BAND_MIN = 1_300_000_000;   // $1.3B
const GF_BAND_MAX = 1_700_000_000;   // $1.7B

// FY stored as ending year (Oct-Sep, D-01)
// PDF filename fy25-fund-summary-gp.pdf → FY 2025 (stored as integer 2025)
```

### Pattern 4: Bakersfield Extractor (extractBakersfield.py)
**What:** Scans Bakersfield adopted budget PDF for department-level operating expenditure data. The Bakersfield adopted budget is a comprehensive multi-section document.
**When to use:** Plan 3. Adapt from extractOakland.py.
**Key adaptation:** The $765M operating target is ALL operating funds (General Fund ~$287M + PUBSAF 1% Sales Tax ~$130M + Equipment Management + Refuse + others). The extractor should either: (a) target the all-funds operating summary table, or (b) target a specific fund-level summary section that shows cross-fund departmental totals. Researcher must inspect the PDF during Plan 3 to determine the correct section. Use `--dry-run` to verify totals against ~$765M target.

### Pattern 5: Enrichment (no changes needed)
**What:** `enrichCategories.js` already handles arbitrary cities; idempotent via name_key upsert.
**When to use:** Plan 4. Run once per city after live-load succeeds.
**Example:**
```bash
# Source: CONTEXT.md canonical_refs section
node scripts/enrichCategories.js --city "Long Beach" --state CA --year 2025 --dry-run
node scripts/enrichCategories.js --city Bakersfield --state CA --year 2025 --dry-run
# If dry-run shows combined cost < $0.10, run without --dry-run
```

### Pattern 6: Long Beach county_id Handling
**What:** Long Beach is in the Phase 25 LA_COUNTY_CITY_NAMES list (confirmed in `seedLACountyLinks.js` line 63). If the municipality row already exists in DB, county_id may already be set to LA_COUNTY_ID.
**When to use:** Plan 1 seeder. Check: if `upsertMunicipality()` finds an existing row, log whether county_id is already set. If set, preserve it (update does not overwrite county_id — seeder upsert omits county_id field from payload so it won't be overwritten).
**Pitfall:** If Long Beach municipality row does NOT yet exist in DB (likely — no budget data loaded yet), Phase 25 LA County linking would not have created it. The seeder creates the row without county_id. county_id will be NULL until seedLACountyLinks.js is re-run or an update is done. **This is acceptable** per CONTEXT.md — county linking is already established in Phase 25; the seeder should set county_id = LA_COUNTY_ID directly for Long Beach.

### Anti-Patterns to Avoid
- **Port bleed:** Never let Port of Long Beach departments appear in extraction output. Port has ~$760M budget; if total exceeds ~$2.2B, Port data leaked in. Halt immediately.
- **Enterprise fund bleed (Long Beach):** Gas, Refuse, Water, Airport, Harbor enterprise funds must be excluded. These appear in Enterprise fund summary (`40-fund-summary-ef`), NOT the General Fund summary. Targeting GF-only PDFs (`35-fund-summary-gp`, `33-fund-summary-gp`) naturally excludes them.
- **Thousands scale error:** Fremont PDFs use amounts-in-thousands; Oakland/SanJose use full dollars. For Long Beach, verify during dry-run by comparing total to ~$1.5B expected. For Bakersfield, verify against ~$765M expected.
- **Wrong FY convention (Long Beach):** Storing October-year instead of ending-year. FY2025 = Oct 2024 – Sep 2025 → store as integer `2025`. If a PDF reads "FY 2024-25" or "FY 25", map to `2025`.
- **CSV-path for Bakersfield FY2025-2026:** The CSV only covers through FY2024. Do not attempt to use the CSV for recent years.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB sync | Custom INSERT/UPDATE logic | `treasury_sync_budget_tree` RPC | RPC handles dedup, delete+reinsert, row count tracking |
| Municipality upsert | Raw INSERT with conflict handling | `upsertMunicipality()` from seedOaklandSanJoseCA.js | Pattern handles SELECT → INSERT or UPDATE; preserves existing fields |
| Data source upsert | Raw INSERT | `upsertDataSourceByName()` from seedOaklandSanJoseCA.js | Pattern handles dedup by name |
| Data source lookup | Query by name directly | `treasury_list_source_ids` RPC | Canonical project pattern; verifies correct names |
| Enrichment | Custom AI enrichment | `enrichCategories.js --city ... --year ...` | Fully reusable; idempotent; cost-guarded |
| PDF path resolution | Hardcoded absolute paths | `resolvePdfDir()` worktree-safe helper from processOakland.js | Handles git worktrees where gitignored PDFs live in main tree |

---

## Long Beach PDF Download Reference

All URLs verified accessible (2026-06-05). Fund Summary PDFs contain the General Fund departmental breakdown (targeted extraction — preferred over full 16-29MB budget books).

| FY | Fund Summary (GF) URL | Size | Full Book URL |
|----|----------------------|------|---------------|
| FY22 | `.../fy-22-adopted-budget/34-fund-summary-gp_22a-v2-gs` | ~414KB | `.../full-book-print_updated-5-4-22` |
| FY23 | `.../fy-23-adopted-budget/34-fund-summary-gp_23a_v1` | ~414KB | `.../full-book-1-4-23-v2` (23MB) |
| FY24 | `.../fy-24-adopted-budget/35-fund-summary-gp` | ~414KB | (larger) |
| FY25 | `.../fy-25-adopted-budget/35-fund-summary-gp` | ~415KB | (larger) |
| FY26 | `.../fy-26-adopted-budget/33-fund-summary-gp` | ~558KB | `.../fy-26-adopted-book-12-05-25-final-3-...` (16MB) |

**Base domain:** `https://www.longbeach.gov/globalassets/finance/media-library/documents/city-budget-and-finances/budget/budget-documents/`

**Note:** Section number for fund summary changed between FY25 (section 35) and FY26 (section 33). The researcher should verify each PDF path before committing to the download plan. Use targeted section PDFs (Fund Summary GP) to avoid processing 16-29MB full books.

**Note on FY22 URL pattern:** FY22 uses suffix `34-fund-summary-gp_22a-v2-gs` (non-standard); FY23 uses `34-fund-summary-gp_23a_v1`; FY24/FY25 use plain `35-fund-summary-gp`; FY26 uses `33-fund-summary-gp`. Planner must use the verified per-FY filenames.

---

## Bakersfield PDF Download Reference

| FY | Document URL | Available |
|----|-------------|-----------|
| FY2024-25 | `https://docs.bakersfieldcity.us/WebLink/DocView.aspx?id=1957514&dbid=0&repo=CITYRECORDS` | Confirmed (WebLink viewer) |
| FY2025-26 | `https://docs.bakersfieldcity.us/WebLink/DocView.aspx?id=1957516&dbid=0&repo=CITYRECORDS` | Confirmed (WebLink viewer) |
| FY2021-22 (proposed) | `https://docs.bakersfieldcity.us/WebLink/DocView.aspx?id=1579159&dbid=0&repo=CITYRECORDS` | Found (proposed, not adopted) |

**Note:** The WebLink viewer pages are JavaScript-rendered; the implementer must download PDFs directly via the city's WebLink system. PDF direct download links may require navigating the WebLink UI. If FY2022-2023 adopted budget PDFs cannot be directly downloaded via WebLink, use the CSV for FY2022-2024 as a supplement or fall back to fewer FY years. The most important FYs are FY2024-25 and FY2025-26 (matching REQUIREMENTS.md target depth through FY2026).

**Bakersfield fund scope clarification:** The adopted budget's ~$765M operating total is ALL operating funds (not just General Fund). The extractor must target the all-funds operating summary or use a department-level cross-fund view. Expected departments: Police, Fire, Public Works, Recreation & Parks, Financial Services, Executive, Development Services, Legal, Human Resources, Technology, Visit Bakersfield, Non-Departmental. [ASSUMED based on CSV department column; verify against PDF during dry-run.]

---

## Long Beach county_id Integration

**Long Beach IS in the Phase 25 LA County linking list.** [VERIFIED: scripts/seedLACountyLinks.js line 63]

```javascript
// From seedLACountyLinks.js line 63:
'Lakewood', 'Lancaster', 'Lawndale', 'Lomita', 'Long Beach', 'Los Angeles',
```

**Implication for seeder:**
- If Long Beach municipality row does NOT exist yet (expected — no budget data loaded in prior phases for Long Beach), Phase 25 would not have set county_id.
- The seeder (Plan 1) should set `county_id = LA_COUNTY_ID` directly when creating the Long Beach municipality row.
- LA_COUNTY_ID = `'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1'` [VERIFIED: seedLACountyLinks.js line 36]
- If Long Beach row already exists (unlikely), check and set county_id if NULL.

---

## Common Pitfalls

### Pitfall 1: Long Beach Fund Summary Section Number Changes Between FYs
**What goes wrong:** The PDF section number for the General Fund summary changes between fiscal years (section 34 in FY22/FY23, section 35 in FY24/FY25, section 33 in FY26). Using the wrong section number returns HTTP 404.
**Why it happens:** Long Beach adds/removes budget sections each year, shifting section numbering.
**How to avoid:** Use the verified per-FY URLs listed in the PDF Download Reference table above. Do not assume consistent numbering across fiscal years.
**Warning signs:** HTTP 404 when downloading fund summary PDF.

### Pitfall 2: Port of Long Beach Data Bleed
**What goes wrong:** Port of Long Beach (~$760M) appears in some Long Beach PDF sections, inflating the General Fund total to ~$2.2B+.
**Why it happens:** Port data is in the Enterprise Fund summary, not the General Fund summary. If the extractor accidentally picks up Enterprise or Tidelands fund rows, Port data bleeds in.
**How to avoid:** Target ONLY the General Fund summary PDF (`fund-summary-gp`). Add a sanity band check in processLongBeach.js: halt if total > $1.7B.
**Warning signs:** Total exceeds $1.7B, or department names like "Harbor" or "Port" appear in output.

### Pitfall 3: Bakersfield All-Funds vs General Fund Confusion
**What goes wrong:** Using `fund = 'GENERAL FUND'` filter gives ~$287M (FY2024), not the target ~$765M.
**Why it happens:** Bakersfield's $765M operating total spans 8+ funds. The "General Fund" is only one of them.
**How to avoid:** Extract from the PDF's all-funds operating summary (departmental view across all funds), not from a fund-filtered view. Cross-check total against ~$765M target in dry-run.
**Warning signs:** Total much lower than $600M indicates fund-only extraction rather than all-funds.

### Pitfall 4: Long Beach FY Convention — Storing October-Year
**What goes wrong:** "FY 2024-25" is stored as 2024 (start year) instead of 2025 (end year).
**Why it happens:** Ambiguous label; Oct–Sep FY starts in the prior year.
**How to avoid:** Apply the ending-year convention (D-01): FY 2024-25 → integer 2025. Add a comment in seeder: `// Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01)`. Verify that the extractor emits `2025` not `2024` for the current fiscal year.
**Warning signs:** FY2024 appears in DB with a total that should be FY2025 (i.e., the October 2024 – September 2025 budget appears under 2024).

### Pitfall 5: Bakersfield PDF Download Difficulty (WebLink System)
**What goes wrong:** Bakersfield hosts PDFs in a WebLink document management system with JavaScript-rendered pages. Direct PDF URLs are not obvious; copy-pasting WebLink viewer URLs does not give the PDF.
**Why it happens:** WebLink uses an ASP.NET/JavaScript viewer, not a static file server.
**How to avoid:** Access the WebLink pages in a browser, use the "Download" button to get the direct PDF URL, and record that URL in the plan. Or download manually and store in `docs/Bakersfield/`.
**Warning signs:** WebFetch to the DocView URL returns a loading page with no content.

### Pitfall 6: Long Beach FY22 Extractor Format Differences
**What goes wrong:** FY22 and FY23 fund summary PDFs may have slightly different column layouts than FY24/FY25/FY26 (different section numbering suggests possible format changes).
**Why it happens:** Long Beach updates its budget document template periodically.
**How to avoid:** Dry-run each FY separately before live-loading. Verify extracted row count and total are reasonable (~15-25 departments, ~$1.4-1.6B). If FY22 format differs, implement a format variant in extractLongBeach.py.
**Warning signs:** Row count dramatically different between FY years, or totals way off target.

---

## Code Examples

Verified patterns from existing codebase:

### resolvePdfDir() — Worktree-Safe Helper
```javascript
// Source: scripts/processOakland.js lines 74-88
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Oakland');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Oakland');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}
// Adapt: replace 'Oakland' with 'Long Beach' or 'Bakersfield'
// Note: processSanJose.js checks both 'SanJose' and 'San Jose' variants
```

### treasury_sync_budget_tree RPC Call
```javascript
// Source: scripts/processOakland.js lines 203-215
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   datasetType,  // 'operating' or 'revenue'
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});
```

### upsertMunicipality with county_id for Long Beach
```javascript
// Adapted from seedOaklandSanJoseCA.js — Long Beach variant
// Long Beach IS in LA County 88-city list; set county_id directly
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';  // verified

const MUNICIPALITIES = [
  {
    name: 'Long Beach',
    state: 'CA',
    entity_type: 'city',
    population: 451000,
    population_year: 2024,
    county_id: LA_COUNTY_ID,  // set directly — Long Beach is an LA County city
    // Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01)
  },
  {
    name: 'Bakersfield',
    state: 'CA',
    entity_type: 'city',
    population: 417000,
    population_year: 2024,
    // county_id stays NULL — Kern County not loaded (deferred)
  },
];
```

### Enrichment (Plan 4) — Combined Cost Gate
```bash
# Source: CONTEXT.md D-08
# Estimate first:
node scripts/enrichCategories.js --city "Long Beach" --state CA --year 2025 --dry-run
node scripts/enrichCategories.js --city Bakersfield --state CA --year 2025 --dry-run
# Only proceed if combined cost estimate < $0.10
# If cost approaches $0.10, stop and ask user before proceeding
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socrata SODA for Bakersfield (assumed) | pdfplumber PDF extraction | Phase 29 research (D-03 evaluated) | CSV only covers FY2019-2024; multi-fund scope mismatch |
| Single global fund summary PDF | Per-year targeted section PDF | Phase 29 (Long Beach specific) | Avoids downloading 16-29MB full budget books |
| county_id set separately by seedLACountyLinks.js | county_id set in initial municipality upsert | Phase 25 pattern already exists for Oakland | Avoids a separate linking run for Long Beach |

**Note:** Long Beach adopted FY26 budget on September 9, 2025 (after researcher's knowledge cutoff). Budget is visible at `longbeach.gov` and fund summary PDFs are confirmed accessible. [VERIFIED: HTTP 200 check, 2026-06-05]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bakersfield FY2024-25 and FY2025-26 PDF content includes an all-funds operating summary table with department-level rows totaling ~$765M | Architecture Patterns (Pattern 4) | If PDF uses a different structure (e.g., fund-by-fund rather than department cross-fund), extractor design will need rethinking during Plan 3 |
| A2 | Long Beach General Fund department rows are extractable via text line parsing (not table extraction) from the fund summary PDF | Architecture Patterns (Pattern 2) | If PDF uses complex table layout that pdfplumber cannot parse as text, researcher may need `extract_tables()` instead of `extract_text()` |
| A3 | Long Beach General Fund summary PDFs (FY22-FY26) have consistent enough table structure that one extractor handles all years with minor variant handling | Common Pitfalls (Pitfall 6) | If FY22/FY23 format is substantially different, a second extractor variant or manual year-specific handling will be needed |
| A4 | Bakersfield department names in adopted budget PDF match categories expected (Police, Fire, Public Works, etc.) | Common Pitfalls (Pitfall 3) | If Bakersfield uses service-level grouping rather than department names, tree structure will differ from other CA cities |
| A5 | Long Beach amounts are in full dollars (not thousands) | Common Pitfalls | If amounts are in thousands, all totals will be off by 1000x; catch via sanity band check in dry-run |
| A6 | Long Beach municipality row does NOT yet exist in DB (no budget data for LB loaded in prior phases) | Long Beach county_id Integration | If row already exists (from some prior operation), upsert UPDATE must preserve county_id; the seeder must handle both cases |

---

## Open Questions

1. **Long Beach PDF text extraction quality**
   - What we know: Fund summary PDFs are ~400-550KB, suggesting structured content
   - What's unclear: Whether pdfplumber `extract_text()` produces clean tabular output or garbled column merging
   - Recommendation: Download FY25 fund summary PDF first, run `python3 -c "import pdfplumber; p = pdfplumber.open('...'); print(p.pages[0].extract_text())"` to inspect before writing extractor

2. **Bakersfield PDF all-funds operating summary location**
   - What we know: The $765M target is all operating funds; department names from CSV are 17 distinct departments
   - What's unclear: Whether the adopted budget PDF has a consolidated all-funds department summary table or only fund-by-fund sections
   - Recommendation: Download FY2024-25 adopted budget PDF and scan table of contents / search for "summary" or "all funds" or "department summary" sections

3. **Long Beach revenue budget extraction**
   - What we know: Requirements (DATA-04) specifies "operating + revenue budget"; "best-effort revenue" is the pattern for CA cities
   - What's unclear: Whether Long Beach fund summary GP PDF includes revenue rows or if a separate revenue PDF section is needed
   - Recommendation: The Budget Summaries PDF (`10-budget-summaries` / `09-budget-summaries`) likely contains both revenue and expenditure tables; inspect during Plan 2

4. **Bakersfield FY2022-2023 PDF accessibility**
   - What we know: FY2024-25 and FY2025-26 PDFs confirmed at docs.bakersfieldcity.us; FY2021-22 proposed (not adopted) found
   - What's unclear: Whether FY2022-23 and FY2023-24 adopted budget PDFs are accessible at docs.bakersfieldcity.us
   - Recommendation: If older PDFs cannot be found, use FY2024-25 and FY2025-26 only (2 FY years still meets the "available with consistent format" clause of D-06)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | pdfplumber extractors | ✓ | 3.14.3 | — |
| pdfplumber | PDF extraction | ✓ | 0.11.9 | — |
| Node.js | processor scripts | ✓ | v24.13.0 | — |
| @supabase/supabase-js | DB client | ✓ | 2.101.1 | — |
| SUPABASE_SERVICE_KEY | DB writes | ✓ (from .env) | — | — |
| Long Beach PDF access | Plan 2 | ✓ | HTTP 200 confirmed for FY22-FY26 | — |
| Bakersfield PDF access | Plan 3 | Partial | WebLink viewer confirmed; direct PDF URL requires WebLink navigation | Download manually |
| docs/Long Beach/ directory | Plan 2 | ✗ | Does not exist yet | Create in Plan 2 |
| docs/Bakersfield/ directory | Plan 3 | ✗ | Does not exist yet | Create in Plan 3 |

**Missing dependencies with no fallback:** None that block execution.

**Missing dependencies with fallback:**
- `docs/Long Beach/` — create during Plan 2 (download PDFs)
- `docs/Bakersfield/` — create during Plan 3 (download PDFs)
- Bakersfield FY2022-2023 PDFs — if inaccessible, use FY2024-25 + FY2025-26 only (still meets D-06 minimum)

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set in config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual dry-run validation (no automated test framework in project) |
| Config file | none |
| Quick run command | `node scripts/processLongBeach.js --dry-run` |
| Full suite command | `node scripts/processLongBeach.js --dry-run && node scripts/processBakersfield.js --dry-run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-04 (LB operating) | Long Beach GF operating totals ~$1.5B | smoke | `node scripts/processLongBeach.js --dry-run` | ❌ Wave 0 |
| DATA-04 (LB revenue) | Long Beach revenue rows present | smoke | `node scripts/processLongBeach.js --dry-run --revenue` | ❌ Wave 0 |
| DATA-07 (BF operating) | Bakersfield operating totals ~$765M | smoke | `node scripts/processBakersfield.js --dry-run` | ❌ Wave 0 |
| DATA-07 (BF revenue) | Bakersfield revenue rows present | smoke | `node scripts/processBakersfield.js --dry-run --revenue` | ❌ Wave 0 |
| ENRICH-01 | Enrichment cost < $0.10 combined | manual | `node scripts/enrichCategories.js --city "Long Beach" --state CA --year 2025 --dry-run` | ✅ exists |
| POPUL-01 | Population values in DB | manual | `node scripts/seedLongBeachBakersfieldCA.js` (check output) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/processLongBeach.js --dry-run` or `node scripts/processBakersfield.js --dry-run`
- **Per wave merge:** Both dry-runs green + DB row count verification
- **Phase gate:** Both cities visible in app with correct totals, per-capita, and enrichment before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/seedLongBeachBakersfieldCA.js` — Plan 1
- [ ] `scripts/extractLongBeach.py` — Plan 2
- [ ] `scripts/processLongBeach.js` — Plan 2
- [ ] `scripts/extractBakersfield.py` — Plan 3
- [ ] `scripts/processBakersfield.js` — Plan 3
- [ ] `docs/Long Beach/` directory + FY22-FY26 fund summary PDFs — Plan 2
- [ ] `docs/Bakersfield/` directory + FY2024-25/FY2025-26 adopted budget PDFs — Plan 3

---

## Security Domain

> `security_enforcement` not set to false — including security domain.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Service role key for scripts only |
| V3 Session Management | no | CLI scripts; no sessions |
| V4 Access Control | no | Service role key scoped to treasury schema |
| V5 Input Validation | yes | PDF paths from controlled `docs/` readdir (not user input); quoted in execSync |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for pdfplumber + execSync Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PDF path injection in execSync | Tampering | PDF paths from controlled `docs/CityName/` readdirSync, not user input; paths double-quoted in shell command (T-28-05 pattern) |
| Excessive memory from large PDFs | Denial of service | maxBuffer: 8 * 1024 * 1024 cap on execSync (T-28-04 pattern); use targeted section PDFs (400KB) not full books (16MB) |
| Wrong data scale loaded to DB | Tampering / integrity | Sanity band check before RPC call (T-28-07 pattern); halt and exit(3) if total outside band |
| Service key logged | Information disclosure | loadEnv() pattern; SUPABASE_SERVICE_KEY never logged (T-28-06 pattern) |

---

## Sources

### Primary (HIGH confidence)
- `scripts/seedOaklandSanJoseCA.js` — two-city seeder template, verified line-by-line
- `scripts/extractOakland.py` — primary extractor template, full read
- `scripts/processOakland.js` — primary processor template, full read
- `scripts/seedLACountyLinks.js` — Long Beach in LA_COUNTY_CITY_NAMES confirmed at line 63
- Long Beach budget pages — HTTP 200 confirmed for FY22-FY26 adopted budget pages; fund summary PDFs (400-558KB) verified accessible
- `budget.bakersfieldcity.us/api/operating_budget.csv` — full CSV parsed; FY2019-2024 coverage confirmed; General Fund scope mismatch documented

### Secondary (MEDIUM confidence)
- `https://www.longbeach.gov/press-releases/long-beach-city-council-adopts-fiscal-year-2026-budget/` — FY26 budget adoption confirmed ($3.7B total, Oct 2025–Sep 2026)
- `https://www.turnto23.com/news/in-your-neighborhood/bakersfield/city-council-passes-852-7m-budget` — FY2025-26 budget $852.7M total ($765.2M operating)
- `docs.bakersfieldcity.us/WebLink/DocView.aspx?id=1957514` — FY2024-25 adopted budget PDF confirmed accessible
- `docs.bakersfieldcity.us/WebLink/DocView.aspx?id=1957516` — FY2025-26 adopted budget PDF confirmed accessible

### Tertiary (LOW confidence)
- Bakersfield department names from CSV (assumed to match PDF structure) — tagged [ASSUMED]
- Long Beach amounts assumed in full dollars (not thousands) — tagged [ASSUMED]; verify in dry-run

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools pre-installed and confirmed
- Long Beach PDF availability: HIGH — all FY22-FY26 fund summary PDFs verified HTTP 200
- Bakersfield PDF path: MEDIUM — WebLink viewer confirmed; direct PDF download requires browser interaction
- Bakersfield extractor design: MEDIUM — CSV data confirms department structure; PDF layout [ASSUMED] consistent
- Architecture patterns: HIGH — directly from proven Phase 28 code
- Pitfalls: HIGH — grounded in actual code inspection and live data verification

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (Long Beach and Bakersfield publish budgets annually; FY27 adoption not until Sep 2026)
