# Phase 31: Anaheim + Santa Ana CA Data Load - Research

**Researched:** 2026-06-05
**Domain:** CA city PDF budget extraction — pdfplumber Python extractors, Node.js processors, Supabase RPC loading
**Confidence:** HIGH (stack + patterns); MEDIUM (PDF structure and amounts — not yet downloaded)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-08 | Anaheim CA operating + revenue budget loaded and visible in app; General Fund ~$491M (FY2024-25); enterprise funds (Public Utilities, Convention/Sports, golf) filtered | pdfplumber extractor (extractLongBeach.py / extractFresno.py pattern), fund filter at extraction time, `treasury_sync_budget_tree` RPC |
| DATA-09 | Santa Ana CA operating + revenue budget loaded and visible in app; General Fund ~$407M (FY2024-25); enterprise funds (Water, Sewer, Refuse, Parking) filtered | pdfplumber extractor, fund filter at extraction time, `treasury_sync_budget_tree` RPC |
| ENRICH-02 (Anaheim + Santa Ana) | AI-generated category enrichment for both cities; operating and revenue categories described in plain language | `enrichCategories.js` — no changes needed; `--city Anaheim --state CA --year YYYY` and `--city "Santa Ana" --state CA --year YYYY` |
| POPUL-02 (Anaheim + Santa Ana) | Both cities seeded with 2024 population data; per-capita displays correctly | Anaheim ~344,521, Santa Ana ~312,534 from Census 2024 annual estimates; `population_year = 2024`; `upsertMunicipality()` pattern |
</phase_requirements>

---

## Summary

Phase 31 loads Anaheim and Santa Ana into the Treasury Tracker app, extending the CA city series into Orange County. Both cities are in Orange County (not LA County), which means `county_id` stays NULL — Orange County has not been loaded into the project. Both cities require custom pdfplumber Python extractors from their adopted budget PDFs; neither has a usable machine-readable API for multi-year operating budget data.

**Anaheim** publishes comprehensive adopted budget PDFs at `anaheim.net` via an Archive Center system (`Archive.aspx?ADID=NNN`). Archives are confirmed available for FY2020-21 through FY2025-26. The budget is structured as an all-funds document covering the General Fund (~$491M in FY2024-25) and enterprise funds (Anaheim Public Utilities, Convention/Sports & Entertainment, golf courses, ARTIC). Enterprise funds collectively make up the largest portion of the ~$2.3B all-funds total. Anaheim has an ArcGIS open data portal with "Adopted Budget" datasets but only confirmed through FY2021-22 — PDF path is required for FY2022-23 onward. Fiscal year is July–June.

**Santa Ana** publishes adopted budget PDFs hosted on Google Cloud Storage (`storage.googleapis.com/proudcity/santaanaca/...`). Archives confirmed for FY2020-21 through FY2025-26, with direct storage URLs. Santa Ana's General Fund is ~$407M in FY2024-25 ($406.7M confirmed), and all-funds is ~$734M. Enterprise funds include Water, Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, and Federal Clean Water Protection (confirmed from ACFR). Fiscal year is July–June.

Both cities' PDFs are comprehensive all-funds documents. Filtering must happen at extraction time (Python extractor), following the established pattern from Phase 28 (D-06), Phase 30. Revenue data follows the best-effort strategy from Phase 28 D-05 and Phase 30 D-07 — extract from the operating budget PDF if a clean revenue/sources section exists; defer if not.

**Primary recommendation:** Adapt `extractFresno.py` for Anaheim (single-year PDF, General Fund filter by label) and adapt for Santa Ana similarly. Adapt `seedFresnoRiversideCA.js` for the two-city seeder. Node.js processor pair adapted from `processFresno.js` / `processRiverside.js`. No new packages, no new schema, no new RPC. Entirely mechanical adaptation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Municipality seeding (rows + population) | Database / Storage | — | `treasury.municipalities` upsert via Supabase JS client; `upsertMunicipality()` pattern |
| Data source row creation | Database / Storage | — | `treasury.data_sources` upsert by name; `upsertDataSourceByName()` pattern |
| PDF budget extraction (Anaheim) | Backend script (Python) | — | pdfplumber reads local PDF files; single-year pattern (same as Fresno) |
| PDF budget extraction (Santa Ana) | Backend script (Python) | — | pdfplumber reads local PDF files; single-year pattern |
| Fund filtering (enterprise exclusion) | Backend script (Python) | — | Extraction-time filter; never in Node.js processor. Established pattern D-06 |
| Budget tree loading | Database / Storage | — | `treasury_sync_budget_tree` RPC via Node.js processor; idempotent |
| AI enrichment | Backend script | Database / Storage | `enrichCategories.js` → Claude API → `treasury.category_enrichment` upsert |
| Per-capita display | Frontend (existing) | — | App reads `population` from `treasury.municipalities` automatically |
| City picker appearance | Frontend (existing) | — | `EntitySwitcher.tsx` picks up any `state = 'CA'` municipality with budget data automatically |
| county_id for Anaheim | Deferred | — | Orange County not loaded; stays NULL |
| county_id for Santa Ana | Deferred | — | Orange County not loaded; stays NULL |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfplumber (Python) | confirmed OK [VERIFIED: local env] | PDF text extraction | Already in use for all CA PDF cities; `import pdfplumber` works in Python 3.14 |
| @supabase/supabase-js | 2.101.1 [VERIFIED: npm list in Phase 30] | DB client for seeders and processors | Project standard; all scripts use this |
| Python 3 | 3.14.3 [VERIFIED: local env] | Runtime for extractors | Pre-installed and confirmed |
| Node.js | 24.13.0 [VERIFIED: local env] | Runtime for processors and seeders | Pre-installed and confirmed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | (existing in enrichCategories.js) | Claude API for enrichment | Only in enrichCategories.js — already wired; no new dependency |
| node:child_process execSync | built-in | Run Python extractor from Node.js | Every processor uses this pattern |
| node:path / node:fs | built-in | File resolution, PDF discovery | Standard in every processor |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfplumber PDF path for Anaheim | Anaheim ArcGIS open data portal | ArcGIS portal only confirmed through FY2021-22; no FY2022-23 onward datasets found [ASSUMED]. PDF path is required for current years. |
| pdfplumber PDF path for Anaheim | Anaheim Socrata/OpenGov portal | `anaheimca.budget.socrata.com` is a visualization tool, not a machine-readable API suitable for extraction. |
| pdfplumber PDF path for Santa Ana | Santa Ana OpenBook tool | OpenBook is a UI dashboard, not a downloadable dataset. No machine-readable API found. |

**Installation:** No new packages required. All dependencies already installed. [VERIFIED: local env — pdfplumber imports OK; @supabase/supabase-js@2.101.1 confirmed via npm list in Phase 30]

---

## Package Legitimacy Audit

No new packages are being installed in this phase. All dependencies are already present in the project environment. [VERIFIED: local env — pdfplumber confirmed working, @supabase/supabase-js@2.101.1 already in package.json]

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages)
**Packages flagged as suspicious [SUS]:** none

---

## City-Specific Budget Intelligence

### Anaheim Budget Profile

| Item | Value | Source |
|------|-------|--------|
| Fiscal year | July 1 – June 30 | [VERIFIED: anaheim.net news releases] |
| FY label convention | "FY2024/25" → integer `2025` (ending year) | [ASSUMED: consistent with all other CA cities in project] |
| FY2024-25 General Fund | ~$491M | [VERIFIED: anaheim.net/CivicAlerts.aspx?AID=2941] |
| FY2024-25 all-funds total | ~$2.3B | [VERIFIED: anaheim.net/CivicAlerts.aspx?AID=2941] |
| FY2024-25 enterprise funds | ~$923M | [VERIFIED: anaheim.net/CivicAlerts.aspx?AID=2941] |
| FY2023-24 General Fund | ~$462M | [VERIFIED: anaheim.net search results] |
| FY2022-23 General Fund | ~$409M | [VERIFIED: anaheim.net FY22-23 Budget In Brief] |
| FY2022-23 all-funds total | ~$2.0B | [VERIFIED: anaheim.net news release] |
| FY2025-26 General Fund | ~$527M | [VERIFIED: anaheim.net/CivicAlerts.aspx?AID=3107] |
| Enterprise funds to filter | Anaheim Public Utilities (water+electric), Convention/Sports & Entertainment (Convention Center, Honda Center, Angel Stadium, Grove, ARTIC), golf courses | [VERIFIED: anaheim.net news releases] |
| General Fund name | "General Fund" | [ASSUMED: consistent label; verify in actual PDF] |
| Amount scale | Full dollars [ASSUMED] | Verify in dry-run: if Police shows $491K vs $491M, amounts are in thousands |
| PDF archive system | Archive.aspx?ADID=NNN pattern | [VERIFIED: anaheim.net/271/Operating-Budget-CIP archive page] |

**Anaheim PDF Archive URLs (confirmed accessible):**

| FY | Archive URL | General Fund |
|----|------------|--------------|
| FY2025-26 | `https://www.anaheim.net/Archive.aspx?ADID=964` | ~$527M |
| FY2024-25 | `https://www.anaheim.net/Archive.aspx?ADID=926` | ~$491M |
| FY2023-24 | `https://www.anaheim.net/Archive.aspx?ADID=907` | ~$462M |
| FY2022-23 | `https://www.anaheim.net/Archive.aspx?ADID=876` | ~$409M |
| FY2021-22 | `https://www.anaheim.net/Archive.aspx?ADID=843` | [ASSUMED: ~$380–400M range] |
| FY2020-21 | `https://www.anaheim.net/Archive.aspx?ADID=821` | [ASSUMED: ~$360–390M range] |

**Note:** Archive.aspx pages serve the full adopted budget PDF (which is all-funds, not GF-only). The `Archive.aspx?ADID=873` URL verified as a direct PDF download (9.2MB for FY2022-23). The implementer should navigate each ADID URL in a browser to get the actual PDF download link, or download directly from the Archive URL. The full budget PDF will need fund filtering in the extractor.

**Anaheim budget structure (from news releases and Budget In Brief documents):**
- Section covering General Fund departments: Police, Fire, Community Services (parks, libraries, recreation), Public Works, Community & Economic Development, Planning, Finance, City Manager, City Attorney, City Clerk, Non-Departmental
- Enterprise Fund sections: Anaheim Public Utilities (water + electric), Convention/Sports & Entertainment, Golf
- Capital Improvement Program: separate section
- All-funds document: extractor must filter to General Fund rows only

### Santa Ana Budget Profile

| Item | Value | Source |
|------|-------|--------|
| Fiscal year | July 1 – June 30 | [VERIFIED: santa-ana.org budget approval news releases] |
| FY label convention | "FY2024-25" → integer `2025` (ending year) | [ASSUMED: consistent with all other CA cities in project] |
| FY2025-26 General Fund | ~$424M | [VERIFIED: santa-ana.org/city-council-approves-2025-26-budget] |
| FY2025-26 all-funds total | ~$778M | [VERIFIED: santa-ana.org/city-council-approves-2025-26-budget] |
| FY2024-25 General Fund | ~$407M ($406.7M) | [VERIFIED: santa-ana.org/santa-ana-city-council-unanimously-approves-2024-25-budget] |
| FY2024-25 all-funds total | ~$734M | [VERIFIED: santa-ana.org/santa-ana-city-council-unanimously-approves-2024-25-budget] |
| FY2023-24 General Fund | ~$413M | [VERIFIED: newsantaana.com — $764M all-funds, $413M GF] |
| FY2023-24 all-funds total | ~$764M | [VERIFIED: newsantaana.com] |
| FY2022-23 General Fund | ~$404M ($403.5M) | [VERIFIED: santa-ana.org/adopted-2022-2023-santa-ana-budget] |
| FY2022-23 all-funds total | ~$760M | [VERIFIED: santa-ana.org/adopted-2022-2023-santa-ana-budget] |
| Enterprise funds to filter | Water, Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean Water Protection | [VERIFIED: Santa Ana ACFR at storage.googleapis.com/proudcity/santaanaca/2025/12/bbfc3fec-fy-25-acfr.pdf] |
| General Fund name | "General Fund" | [ASSUMED: standard label; verify in actual PDF] |
| Amount scale | Full dollars [ASSUMED] | Verify in dry-run; spot-check one department |
| PDF hosting | Google Cloud Storage (storage.googleapis.com/proudcity/santaanaca/) | [VERIFIED: santa-ana.org budget archive pages — all PDFs link to GCS] |

**Santa Ana PDF Direct Download URLs (confirmed):**

| FY | PDF URL | GF Total |
|----|---------|----------|
| FY2025-26 | `https://storage.googleapis.com/proudcity/santaanaca/2025/07/FY25-26-Budget-Book-Draft_V26_Compressed.pdf` | ~$424M |
| FY2024-25 | `https://storage.googleapis.com/proudcity/santaanaca/2024/08/07-30-Budget-Book-Draft_V6_Hyperlinked_Compressed.pdf` | ~$407M |
| FY2023-24 | `https://storage.googleapis.com/proudcity/santaanaca/uploads/2023/08/FY-2023-24-Adopted-Budget-Book-June-20th-2023-V13-compressed.pdf` | ~$413M |
| FY2022-23 | `https://storage.googleapis.com/proudcity/santaanaca/uploads/2022/07/FY-22-23-Budget-Detail-Adopted-FINAL-WEB-v2.pdf` | ~$404M |
| FY2021-22 | Via santa-ana.org/fy-21-22-budget-documents/ (indirect URL) | [ASSUMED] |
| FY2020-21 | Via santa-ana.org/fy-2020-21-budget/ (indirect URL) | [ASSUMED] |

**Note:** Santa Ana's PDF naming is inconsistent (V6, V13, V26, etc.) — each year has a unique filename. The FY2021-22 and FY2020-21 direct GCS URLs are not confirmed; access via the archive pages. PDF sizes are large (~19-20MB per document based on FY2024-25 search result description), suggesting comprehensive all-funds budget books.

**Santa Ana budget structure (from city news releases and ACFR):**
- General Fund departments: Police, Fire, Public Works, Parks & Recreation, Library, Community Development, Finance, City Manager, City Attorney, City Clerk, Non-Departmental, Homeless Services
- Measure X sales tax funds 21% of General Fund
- Enterprise Funds: Water, Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean Water Protection
- Capital Improvement Program: separate section (~$46–58M)

---

## Population Data

| City | 2024 Census Estimate | Source | Notes |
|------|---------------------|--------|-------|
| Anaheim | 344,521 | [VERIFIED: U.S. Census Bureau Annual Estimates, April 1 2020 – July 1 2024, released May 2025 via california-demographics.com] | Requirements.md says ~348K — actual Census 2024 estimate is 344,521 |
| Santa Ana | 312,534 | [VERIFIED: U.S. Census Bureau Annual Estimates, April 1 2020 – July 1 2024, released May 2025 via california-demographics.com] | Requirements.md says ~335K — actual Census 2024 estimate is 312,534; city population has declined from 2015 peak of ~335K |

**Population note:** Both cities are in Orange County, which uses SUMLEV=162 (sub-county place estimates) in `sub-est2024_06.csv` — the same Census file used for all prior CA cities. [VERIFIED: REQUIREMENTS.md; same methodology as Sacramento, Oakland, San Jose, Long Beach, Fresno, Riverside, Bakersfield]

**Discrepancy from requirements:** REQUIREMENTS.md specified ~348K for Anaheim and ~335K for Santa Ana. The actual 2024 Census annual estimates are 344,521 and 312,534 respectively. Use the actual Census file values when seeding (the seeder should use round numbers close to the CSV value — e.g., 344000 and 312000 or the exact value from the CSV). This is the same methodology used for all prior cities.

---

## Architecture Patterns

### System Architecture Diagram

```
PDF files (docs/Anaheim/*.pdf, docs/Santa Ana/*.pdf)
  [Anaheim: Archive.aspx?ADID=NNN → full adopted budget PDF]
  [Santa Ana: storage.googleapis.com/proudcity/santaanaca/... → budget book PDF]
        |
        v
Python extractor (extractAnaheim.py / extractSantaAna.py)
  - pdfplumber reads pages
  - Fund filter: keep "General Fund" rows only (extraction-time)
  - Both: single-year, FY from filename or PDF header
  - Revenue section: best-effort from same PDF (Phase 28 D-05 / Phase 30 D-07 pattern)
  - Output: JSON array to stdout
        |
        v (execSync in Node.js processor)
Node.js processor (processAnaheim.js / processSantaAna.js)
  - Parse JSON from Python stdout
  - Group rows by fiscal_year
  - buildTree() → {tree, total}
  - Sanity band check (halt if total outside expected range)
  - [dry-run] print only / [live] →
        |
        v
Supabase RPC: treasury_sync_budget_tree
  - p_data_source_id, p_fiscal_year, p_dataset_type, p_total, p_tree, p_row_count, p_triggered_by
  - Deletes + reinserts budget_items for that (data_source_id, fiscal_year) pair (idempotent)
        |
        v
treasury.budget_items rows visible in app
        |
        v
enrichCategories.js (Plan 4)
  - Reads unenriched categories for Anaheim/Santa Ana from DB
  - Calls Claude API with budget context
  - Upserts treasury.category_enrichment via name_key (idempotent)
```

### Recommended Project Structure

```
scripts/
├── seedAnaheimSantaAnaCA.js    # Plan 1: two-city seeder
├── extractAnaheim.py           # Plan 2: pdfplumber extractor (Fresno pattern)
├── processAnaheim.js           # Plan 2: Node.js processor
├── extractSantaAna.py          # Plan 3: pdfplumber extractor (Fresno pattern)
└── processSantaAna.js          # Plan 3: Node.js processor
docs/
├── Anaheim/                    # Plan 2: downloaded adopted budget PDFs
└── Santa Ana/                  # Plan 3: downloaded adopted budget PDFs
```

### Pattern 1: Two-City Seeder (adapt from seedFresnoRiversideCA.js)

**What:** Single script upserts two municipality rows + four data_source rows, then verifies via `treasury_list_source_ids` RPC.
**When to use:** Plan 1 — must run before any processor.
**Example:**
```javascript
// Source: scripts/seedFresnoRiversideCA.js (verified in codebase)
const MUNICIPALITIES = [
  {
    name:            'Anaheim',
    state:           'CA',
    entity_type:     'city',
    population:      344000,  // Census 2024 annual estimate ~344,521; confirm from sub-est2024_06.csv
    population_year: 2024,
    // county_id stays NULL — Orange County not loaded (deferred)
  },
  {
    name:            'Santa Ana',
    state:           'CA',
    entity_type:     'city',
    population:      312000,  // Census 2024 annual estimate ~312,534; confirm from sub-est2024_06.csv
    population_year: 2024,
    // county_id stays NULL — Orange County not loaded (deferred)
  },
];
```

### Pattern 2: Extraction-Time Fund Filter

**What:** Python extractor only emits rows for the target fund ("General Fund"). Enterprise rows are never produced.
**When to use:** Both extractors — mandatory.
**Example:**
```python
# Source: adapted from scripts/extractFresno.py and extractLongBeach.py (verified in codebase)
# In the page parsing loop — only emit General Fund rows:
if fund_label_on_this_row == 'General Fund':
    results.append({
        'department':     label,
        'fund':           'General Fund',
        'adopted_amount': amount,
        'fiscal_year':    fiscal_year,
        'page_num':       page_num,
    })
else:
    print(f'  [skip] Non-GF row: {fund_label_on_this_row} — {label}', file=sys.stderr)
```

### Pattern 3: Processor Sanity Band Check

**What:** Every processor checks the total against an expected dollar range. Halts with exit code 3 before any DB write if total is outside the band.
**When to use:** Every processor — mandatory.
**Example (adapted for Anaheim and Santa Ana):**
```javascript
// Source: adapted from scripts/processFresno.js (verified in codebase)
// Anaheim General Fund: ~$380M–$550M (covers FY2020–FY2026 range with margin)
const ANAHEIM_BAND_MIN = 380_000_000;
const ANAHEIM_BAND_MAX = 550_000_000;
// Santa Ana General Fund: ~$350M–$450M (covers FY2020–FY2026 range with margin)
const SANTA_ANA_BAND_MIN = 350_000_000;
const SANTA_ANA_BAND_MAX = 450_000_000;
```

### Pattern 4: resolvePdfDir() Worktree-Safe Helper

**What:** Falls back to main working tree root via `git rev-parse --git-common-dir` when in a git worktree.
**When to use:** Every processor. Copy verbatim from `processOakland.js` / `processFresno.js`.
```javascript
// Source: scripts/processOakland.js (verified in codebase)
function resolvePdfDir(city) {
  const candidate = path.join(ROOT, 'docs', city);
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    return path.join(mainRoot, 'docs', city);
  } catch (_) {}
  return candidate;
}
```

### Anti-Patterns to Avoid

- **Enterprise fund bleed (critical):** Anaheim enterprise funds total ~$923M; including them would inflate General Fund from ~$491M to ~$1.4B+. Santa Ana enterprise funds inflate similarly (~$327M non-GF). The sanity band check will catch this, but the filter must be in the extractor.
- **Post-hoc fund filtering in processor:** Never strip fund types in Node.js — the Python extractor is the filter gate. Established pattern from Phase 28 (D-06).
- **Hard-coding FY as a script argument:** FY should come from the PDF filename or PDF header text, not from `--year` CLI flag passed to the extractor. Established pattern from processLongBeach.js / processFresno.js.
- **Skipping dry-run before live load:** Every processor must be verified with `--dry-run` first.
- **Confusing Anaheim's ArcGIS portal with a data source:** The ArcGIS "My City Budget" portal only has data through FY2021-22. Do not attempt to use it for FY2022-23 onward.
- **Using Santa Ana's "Proposed" budget PDFs instead of "Adopted":** Each FY has both proposed and adopted versions. Use only the Adopted budget book. Santa Ana's adopted PDFs are typically published 1-2 months after the June adoption date (e.g., FY2024-25 adopted on June 18, 2024; adopted PDF published August 2024).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent municipality upsert | Custom insert logic | `upsertMunicipality()` from seedFresnoRiversideCA.js | SELECT-then-INSERT-or-UPDATE; preserves id/created_at |
| Idempotent data_source upsert | Custom insert logic | `upsertDataSourceByName()` from seedFresnoRiversideCA.js | Upsert by name; exact same pattern as all CA seeders |
| Budget tree DB load | Direct table insert | `treasury_sync_budget_tree` RPC | RPC handles delete+reinsert atomically; correct idempotency |
| Data source lookup by name | Direct table query | `treasury_list_source_ids` RPC | Standard lookup path; validates names exist after seeding |
| Enrichment | Custom Claude prompting | `enrichCategories.js` | Already handles cost tracking, dry-run, name_key idempotency |
| PDF text extraction | Custom PDF parser | pdfplumber | Proven for all CA cities; handles multi-column tables |

**Key insight:** This phase is entirely mechanical adaptation of patterns established in Phases 28, 29, and 30. No new DB schema, no new RPC, no new npm packages. The only creative work is understanding the Anaheim and Santa Ana PDF layouts and mapping their fund/department table structure to the existing extractor patterns.

---

## Common Pitfalls

### Pitfall 1: Enterprise Fund Bleed (Critical for Both Cities)

**What goes wrong:** Extractor emits enterprise fund rows alongside General Fund rows. For Anaheim, this inflates the total from ~$491M to ~$2.3B. For Santa Ana, from ~$407M to ~$734M.
**Why it happens:** Both cities' adopted budget PDFs are all-funds documents. A too-broad regex or missing fund filter captures non-General Fund rows.
**How to avoid:** At extraction time, only append rows where the fund label explicitly matches "General Fund". Log every skipped row to stderr. Run `--dry-run` and verify total is within sanity band before live load.
**Warning signs:** Dry-run total is 2–5× the expected General Fund value. Sanity band check will catch this and halt with exit code 3.

### Pitfall 2: Amount Scale Error

**What goes wrong:** PDF amounts are in thousands (e.g., "491,000" means $491M), but extractor passes raw values, making General Fund appear as $491,000 not $491,000,000. Or vice versa.
**Why it happens:** Some CA city PDFs (Fremont) use thousands; most (Oakland, Long Beach, Fresno) use full dollars. Anaheim and Santa Ana scale is [ASSUMED] full dollars.
**How to avoid:** In dry-run, spot-check one known department. If Police budget shows ~$200 instead of ~$200,000,000, amounts are in thousands — add `× 1000` conversion (see `toFullDollars()` in processFremont.js).
**Warning signs:** Dry-run total is exactly 1000× or 1/1000× the expected value; sanity band check catches gross scale errors.

### Pitfall 3: Santa Ana PDF Naming Inconsistency

**What goes wrong:** Santa Ana PDF filenames include version numbers (V6, V13, V26) and are not predictable from the fiscal year alone. Using a wrong URL returns a 404 or the wrong year's document.
**Why it happens:** Santa Ana uses Google Cloud Storage with city-supplied filenames that vary per upload revision.
**How to avoid:** Use the specific confirmed URLs in the PDF Download Reference table in this document. For FY2021-22 and FY2020-21, navigate the archive pages at `santa-ana.org/budget-archive` to find the actual GCS URLs.
**Warning signs:** Extracted data shows wrong fiscal year or document date in the PDF header.

### Pitfall 4: Anaheim Archive.aspx Pages Serve Full PDF

**What goes wrong:** Operator tries to use the `Archive.aspx?ADID=NNN` URL directly as a pdfplumber input path instead of downloading the actual PDF first. Or operator confuses the Budget In Brief (DocumentCenter) PDFs — which are summary documents — with the full adopted budget PDF.
**Why it happens:** Anaheim has two types of budget PDFs: the Budget In Brief (~400KB summary) and the full Adopted Budget (~9MB+). Only the full adopted budget has department-level detail.
**How to avoid:** Download PDFs from the `Archive.aspx?ADID=NNN` URLs (which serve the full adopted budget). Do NOT use the Budget In Brief PDFs (DocumentCenter/View/NNNNN) — those are summaries without department-level line items.
**Warning signs:** Extractor returns only 2-3 rows from a summary table, or row count is much lower than expected (e.g., < 5 rows vs. expected ~15-25 departments).

### Pitfall 5: Population Values Differ from REQUIREMENTS.md

**What goes wrong:** Seeder hard-codes 348,000 (Anaheim) and 335,000 (Santa Ana) from REQUIREMENTS.md, but the Census sub-est2024_06.csv has 344,521 and 312,534. The hard-coded values will be wrong in the DB.
**Why it happens:** REQUIREMENTS.md used approximate values written before the Census 2024 estimates were confirmed.
**How to avoid:** Use the Census `sub-est2024_06.csv` file directly (same file used for all prior CA cities) to confirm exact values. Seed the round number closest to the CSV value (344,000 or 344,521 for Anaheim; 312,000 or 312,534 for Santa Ana).
**Warning signs:** Per-capita display is off by ~1-2% from what a citizen would expect based on Census data.

### Pitfall 6: data_source Name Mismatch

**What goes wrong:** Seeder creates `'Anaheim General Fund Operating Budget'` but processor looks up `'Anaheim GF Operating Budget'`. `treasury_list_source_ids` returns the seeder's name; processor cannot find it.
**Why it happens:** Names defined in two places (seeder constant and processor lookup string) must match character-for-character.
**How to avoid:** Define canonical names as JS constants in the seeder. Processor hard-codes the same string. Seeder verification step (via treasury_list_source_ids) catches mismatches before processor runs.
**Warning signs:** Processor exits with "data_source not found" or RPC returns null for the source ID.

### Pitfall 7: Orange County county_id (Non-Issue — But Must Be Explicit)

**What goes wrong:** Developer attempts to link Anaheim or Santa Ana to a county_id, looks for "Orange County" in the DB, and finds none — then adds Orange County municipality row incorrectly.
**Why it happens:** Prior phases linked Long Beach to LA County (Phase 29); developer assumes same pattern applies.
**How to avoid:** Orange County has NOT been loaded into the project. Both Anaheim and Santa Ana `county_id` stay NULL. Do not insert Orange County municipality row. This is a deferred item.
**Warning signs:** Seeder errors trying to find OrangeCountyID, or an Orange County row appears in treasury.municipalities without budget data.

---

## Code Examples

### Seeder Template (adapt from seedFresnoRiversideCA.js)

```javascript
// Source: scripts/seedFresnoRiversideCA.js (verified in codebase)
const MUNICIPALITIES = [
  {
    name:            'Anaheim',
    state:           'CA',
    entity_type:     'city',
    population:      344000,  // Confirm exact value from sub-est2024_06.csv
    population_year: 2024,
    // county_id stays NULL — Orange County not loaded (deferred)
  },
  {
    name:            'Santa Ana',
    state:           'CA',
    entity_type:     'city',
    population:      312000,  // Confirm exact value from sub-est2024_06.csv
    population_year: 2024,
    // county_id stays NULL — Orange County not loaded (deferred)
  },
];

const DATA_SOURCES = (anaheimId, santaAnaId) => [
  {
    name:            'Anaheim General Fund Operating Budget',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'anaheim-gf-operating',
    base_url:        'https://www.anaheim.net/271/Operating-Budget-CIP',
    municipality_id: anaheimId,
  },
  {
    name:            'Anaheim General Fund Revenue Budget',
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'anaheim-gf-revenue',
    base_url:        'https://www.anaheim.net/271/Operating-Budget-CIP',
    municipality_id: anaheimId,
  },
  {
    name:            'Santa Ana General Fund Operating Budget',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'santa-ana-gf-operating',
    base_url:        'https://www.santa-ana.org/budget/',
    municipality_id: santaAnaId,
  },
  {
    name:            'Santa Ana General Fund Revenue Budget',
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'santa-ana-gf-revenue',
    base_url:        'https://www.santa-ana.org/budget/',
    municipality_id: santaAnaId,
  },
];
```

### Sanity Band Constants

```javascript
// Source: adapted from scripts/processFresno.js (verified in codebase)
// Anaheim General Fund covers FY2020-26: ranges from ~$360M to ~$530M
// Band set wide to handle older years; narrower check in dry-run output
const ANAHEIM_GF_BAND_MIN = 350_000_000;  // ~$350M floor (pre-FY2022 may be lower)
const ANAHEIM_GF_BAND_MAX = 550_000_000;  // ~$550M ceiling (FY2025-26 $527M)
// Santa Ana General Fund covers FY2020-26: ranges from ~$370M to ~$425M
const SANTA_ANA_GF_BAND_MIN = 350_000_000;
const SANTA_ANA_GF_BAND_MAX = 450_000_000;
```

### Enrichment Commands

```bash
# Source: scripts/enrichCategories.js --help (verified in codebase)
# Plan 4 — after both cities are loaded
node scripts/enrichCategories.js --city Anaheim --state CA --year 2025 --dry-run
node scripts/enrichCategories.js --city "Santa Ana" --state CA --year 2025 --dry-run
# Estimate cost from dry-run before running live
# City name with space must be quoted: "Santa Ana"
# Combined gate: $0.10 — ask if approaching limit
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Post-hoc fund filtering in processor | Extraction-time filter in Python extractor | Phase 28 (D-06) | Cleaner separation; enterprise rows never enter the pipeline |
| Per-year processor invocation | Single-pass extraction with FY from filename/header | Phase 28 onward | One extractor handles all available PDFs; no manual year flags |
| Manual PDF page range hard-coding | Dynamic section detection or full-document scan with filter | Phase 28 | Works across PDF versions with varying page numbers |
| No worktree support | `resolvePdfDir()` with git fallback | Phase 28 (Oakland) | Scripts work in both main tree and git worktrees |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Anaheim adopted budget PDFs are available for FY2020-21 through FY2025-26 with consistent structure. | Standard Stack | If older PDFs (FY2020-21, FY2021-22) have substantially different structure, depth may be shallower (FY2022-23 minimum still meets requirements) |
| A2 | Anaheim PDF amounts are in full dollars (not thousands). | Pitfall 2 | If amounts are in thousands, all totals will be 1000× too small; sanity band check will catch this |
| A3 | Anaheim's General Fund label in the PDF is "General Fund" (not a variant like "General Purpose Fund"). | Pitfall 1 | If label is different (e.g., "General Fund Group"), the fund filter regex must be updated; Oakland uses "General Purpose Fund" — Anaheim is different but exact label must be verified |
| A4 | Santa Ana adopted budget PDFs for FY2020-21 and FY2021-22 are accessible via the budget archive pages at santa-ana.org. | PDF Download Reference | If older PDFs are removed or not publicly accessible, depth is reduced to FY2022-23 minimum |
| A5 | Santa Ana PDF amounts are in full dollars (not thousands). | Pitfall 2 | Same as A2 — sanity band catches; toFullDollars() can be added if needed |
| A6 | Santa Ana's General Fund label in the PDF is "General Fund". | Pitfall 1 | Enterprise funds (Water, Sewer, etc.) should be clearly labeled differently; exact label must be verified in PDF |
| A7 | Neither Anaheim nor Santa Ana municipality rows currently exist in treasury.municipalities. | Seeder Pattern | If rows already exist (from a failed prior attempt), `upsertMunicipality()` handles it idempotently |
| A8 | Anaheim operating budget PDF contains a revenue/sources-of-funds section extractable by the same extractor (best-effort). | Architecture Patterns | If revenue section is absent or unclean, revenue load is deferred — not a blocker |
| A9 | Santa Ana operating budget PDF contains a revenue/sources-of-funds section extractable by the same extractor (best-effort). | Architecture Patterns | Same as A8 |
| A10 | The Anaheim ArcGIS open data portal "Adopted Budget" datasets do not extend beyond FY2021-22. | Standard Stack / Alternatives Considered | If newer FY datasets exist (FY2022-23+), they would be an alternative path; PDF path is still correct regardless |
| A11 | Census sub-est2024_06.csv contains Anaheim (SUMLEV=162, Orange County) with value ~344,521 and Santa Ana with ~312,534. | Population Data | Confirmed via Census QuickFacts (344,521 for Anaheim; 312,534 for Santa Ana from annual estimates); sub-est2024_06.csv should match |

---

## Open Questions

1. **Anaheim PDF General Fund section structure**
   - What we know: Anaheim budget is all-funds; General Fund ~$491M for FY2024-25; departments include Police, Fire, Community Services, Public Works, etc.
   - What's unclear: Whether the PDF presents the General Fund as a dedicated section with a clear fund header on each row, or as a mixed-fund table where "General Fund" is a column value. The exact string used to label the General Fund in the PDF is unknown until the PDF is downloaded.
   - Recommendation: Implementer downloads FY2024-25 PDF from `Archive.aspx?ADID=926`, inspects first 10 pages with pdfplumber, identifies the General Fund section header pattern before writing extraction logic.

2. **Santa Ana PDF General Fund section structure**
   - What we know: Santa Ana budget is all-funds; General Fund ~$407M for FY2024-25; enterprise funds (Water, Sewer, etc.) are distinct.
   - What's unclear: Same as Anaheim — the exact PDF table structure (department rows with fund column? Or separate fund sections?). The FY2024-25 PDF is 19-20MB suggesting a comprehensive document.
   - Recommendation: Implementer downloads FY2024-25 PDF from confirmed GCS URL, inspects with pdfplumber before writing extractor.

3. **Revenue section availability in both cities' PDFs**
   - What we know: Best-effort revenue extraction is the project pattern (Phase 28 D-05 / Phase 30 D-07). Both cities' PDFs are comprehensive "budget books" that likely include revenue summaries.
   - What's unclear: Whether the revenue section is cleanly extractable from the same document, or requires a separate revenue document.
   - Recommendation: During extractor development, check for a "Revenue" or "Sources of Funds" section. If clean, include in the extractor. If not, mark revenue as deferred per the best-effort pattern.

4. **FY depth: How many years have consistent PDF structure?**
   - What we know: Anaheim archive goes back to FY2012-13; Santa Ana goes back to FY2020-21. Both are confirmed accessible.
   - What's unclear: Whether FY2020-21 and FY2021-22 PDFs have the same table structure as recent years, or require a format variant.
   - Recommendation: Target FY2022-23 through FY2025-26 (4 years) as primary depth, with FY2020-21 and FY2021-22 as stretch if format is consistent. This matches prior phase depth conventions.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | pdfplumber extractors | ✓ | 3.14.3 | — |
| pdfplumber | PDF extraction | ✓ | (confirmed via import in Phase 30) | — |
| Node.js | processors, seeders | ✓ | 24.13.0 | — |
| @supabase/supabase-js | all DB scripts | ✓ | 2.101.1 | — |
| SUPABASE_SERVICE_KEY env var | all DB scripts | ✓ (inferred from .env) | — | Error: script exits with clear message |
| docs/Anaheim/ directory | Plan 2 PDF extractor | ✗ | — | Create directory; download PDFs from anaheim.net archive |
| docs/Santa Ana/ directory | Plan 3 PDF extractor | ✗ | — | Create directory; download PDFs from santa-ana.org / GCS |

**Missing dependencies with no fallback:** None — all code dependencies are present.

**Missing dependencies with fallback:**
- `docs/Anaheim/` — must be created and PDFs downloaded before Plan 2 can run.
- `docs/Santa Ana/` — must be created and PDFs downloaded before Plan 3 can run.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None formal — manual dry-run verification + sanity band checks |
| Config file | n/a |
| Quick run command | `node scripts/processAnaheim.js --dry-run` |
| Full suite command | `node scripts/processAnaheim.js --dry-run && node scripts/processSantaAna.js --dry-run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-08 | Anaheim GF operating total ~$380–550M, 1+ FYs | smoke (dry-run) | `node scripts/processAnaheim.js --dry-run` | ❌ Wave 0 |
| DATA-08 | Anaheim revenue rows extracted | smoke (dry-run) | `node scripts/processAnaheim.js --dry-run --revenue` | ❌ Wave 0 |
| DATA-09 | Santa Ana GF operating total ~$350–450M, 1+ FYs | smoke (dry-run) | `node scripts/processSantaAna.js --dry-run` | ❌ Wave 0 |
| DATA-09 | Santa Ana revenue rows extracted | smoke (dry-run) | `node scripts/processSantaAna.js --dry-run --revenue` | ❌ Wave 0 |
| ENRICH-02 | Enrichment categories generated for both cities | smoke (dry-run) | `node scripts/enrichCategories.js --city Anaheim --state CA --year 2025 --dry-run` | ✅ exists |
| POPUL-02 | Population values correct in DB | manual spot-check | Query `treasury.municipalities` for Anaheim + Santa Ana population | ✅ via RPC |

### Sampling Rate

- **Per task commit:** `node scripts/processAnaheim.js --dry-run` (or `processSantaAna.js --dry-run`)
- **Per wave merge:** Both dry-runs passing; DB spot-check via `treasury_list_source_ids` RPC
- **Phase gate:** All 6 success criteria verified (city picker visible, correct totals, revenue tabs, per-capita, enrichment) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/seedAnaheimSantaAnaCA.js` — Plan 1; covers POPUL-02
- [ ] `scripts/extractAnaheim.py` — Plan 2; covers DATA-08
- [ ] `scripts/processAnaheim.js` — Plan 2; covers DATA-08
- [ ] `scripts/extractSantaAna.py` — Plan 3; covers DATA-09
- [ ] `scripts/processSantaAna.js` — Plan 3; covers DATA-09
- [ ] `docs/Anaheim/` directory + PDFs (FY2022-23 through FY2025-26) — Plan 2 prerequisite
- [ ] `docs/Santa Ana/` directory + PDFs (FY2022-23 through FY2025-26) — Plan 3 prerequisite

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | PDF paths from controlled `docs/` readdir (not user input); double-quoted in execSync |
| V6 Cryptography | no | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via PDF path | Tampering | PDF paths from `readdirSync(pdfDir)` — controlled directory, not user input; paths double-quoted in execSync shell string (T-28-05 pattern) |
| Excessive memory from large PDFs | Denial of service | `maxBuffer: 8 * 1024 * 1024` cap on execSync (T-28-04 pattern); Santa Ana PDFs are ~19-20MB — consider whether full-document extraction vs. targeted extraction is needed |
| Wrong data scale loaded to DB | Tampering / integrity | Sanity band check before RPC call (T-28-07 pattern); halt and exit(3) if total outside band |
| Secret key logging | Information disclosure | `loadEnv()` pattern; SUPABASE_SERVICE_KEY never logged. Established in all processors. |
| Runaway API cost (enrichment) | Denial of Service | $0.10 combined gate; `--dry-run` required before live enrichment run |

**Large PDF note:** Santa Ana's budget PDFs are ~19-20MB. The `maxBuffer: 8 * 1024 * 1024` (8MB) cap used in prior processors may be insufficient if the Python extractor outputs a large JSON payload to stdout. If stdout exceeds 8MB, consider increasing to `16 * 1024 * 1024` or streaming the output to a temp file. The extractor itself (pdfplumber reading the PDF) runs in Python and is unaffected by the Node.js maxBuffer setting.

---

## Sources

### Primary (HIGH confidence)

- `scripts/seedFresnoRiversideCA.js` — canonical two-city seeder template; read in full [VERIFIED: codebase]
- `scripts/extractFresno.py` — primary single-year extractor template; referenced [VERIFIED: codebase]
- `scripts/processFresno.js` — primary processor template; referenced [VERIFIED: codebase]
- `scripts/processOakland.js` — resolvePdfDir() + sanity band patterns [VERIFIED: codebase]
- `anaheim.net/CivicAlerts.aspx?AID=2941` — Anaheim FY2024-25 budget totals confirmed
- `anaheim.net/CivicAlerts.aspx?AID=3107` — Anaheim FY2025-26 budget totals confirmed
- `anaheim.net/m/newsflash/home/detail/2472` — Anaheim FY2022-23 budget totals confirmed
- `santa-ana.org/santa-ana-city-council-unanimously-approves-2024-25-budget/` — Santa Ana FY2024-25 totals confirmed
- `santa-ana.org/city-council-approves-2025-26-budget/` — Santa Ana FY2025-26 totals confirmed
- `santa-ana.org/adopted-2022-2023-santa-ana-budget-expands-city-services/` — Santa Ana FY2022-23 totals confirmed
- `santa-ana.org/budget-archive` + individual archive pages — Santa Ana PDF URLs for FY2020-21 through FY2024-25 confirmed
- `anaheim.net/271/Operating-Budget-CIP` (archive page) — Anaheim PDF archive ADID numbers confirmed (FY2020-21 through FY2025-26)
- Santa Ana ACFR (fy-25-acfr.pdf via GCS) — enterprise fund names confirmed: Water, Sewer, Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean Water Protection
- Census annual estimates (May 2025 release): Anaheim 344,521; Santa Ana 312,534 — [VERIFIED: california-demographics.com citing Census Bureau]
- `.planning/REQUIREMENTS.md` — DATA-08, DATA-09, ENRICH-02, POPUL-02 success criteria
- `.planning/STATE.md` — accumulated CA PDF extraction context, seeded cities list

### Secondary (MEDIUM confidence)

- `newsantaana.com` — Santa Ana FY2023-24 totals ($764M all-funds, $413M GF) — [MEDIUM: community news site, consistent with trend]
- `anaheim.net` search results for FY2023-24 ($2.1B, $462M GF) — [MEDIUM: consistent with trend]
- Anaheim ArcGIS open data portal — FY2021-22 appears to be the most recent year available (FY2022-23+ not found via search); [MEDIUM: search-confirmed absence, not authoritative negative]

### Tertiary (LOW confidence)

- Anaheim PDF General Fund section structure (table layout, fund label strings, amount scale): not yet verified — PDFs have not been downloaded [ASSUMED]
- Santa Ana PDF General Fund section structure: same [ASSUMED]
- Revenue section availability in both PDFs: [ASSUMED] present based on "Budget Book" designation; best-effort per Phase 28 D-05 / Phase 30 D-07

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified locally in Phase 30; same stack
- Architecture: HIGH — patterns directly verified in existing codebase scripts
- City-specific budget totals (FY2022-23 through FY2025-26): HIGH — from official city news releases and verified URLs
- PDF archive URL availability: HIGH — archive pages confirmed accessible for Anaheim (ADID=821–964); Santa Ana GCS URLs for FY2022-23 through FY2025-26 confirmed
- PDF structure (table layout, fund labels, amount scale): LOW — PDFs not yet downloaded; must be verified during implementation
- Population values: HIGH — from official Census Bureau 2024 annual estimates (May 2025 release)
- Enterprise fund names: HIGH (Anaheim) — from official news releases; HIGH (Santa Ana) — from ACFR

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable stack; PDF structure unknown until download)
