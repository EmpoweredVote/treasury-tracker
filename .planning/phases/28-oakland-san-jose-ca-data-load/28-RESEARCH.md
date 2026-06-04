# Phase 28: Oakland + San Jose CA Data Load - Research

**Researched:** 2026-06-04
**Domain:** PDF budget data extraction (pdfplumber), Node.js data loading, Supabase RPC
**Confidence:** HIGH (patterns confirmed from prior phases; PDF URLs verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Load deeper Oakland history — researcher determines which biennial PDFs are available and loads as many as have consistent structure. Prefer going back at least to FY2021 (3 biennials = 6 years).
- **D-02:** Single extractor pass yields both fiscal years from one biennial PDF (per-page FY detection). Matches Portland Vol 1 per-page FY detection pattern.
- **D-03:** San Jose: General Fund only (~$1.7–1.9B). Filter enterprise funds (Airport, Wastewater, Water) at extraction time.
- **D-04:** Researcher determines PDF page extraction approach and FY range for San Jose based on actual PDF structure.
- **D-05:** Best-effort revenue from the operating budget PDF. If clean revenue data is not present, defer and ship with operating-only rather than blocking.
- **D-06:** Oakland fund label is "General Purpose Fund" (GPF) — never "General Fund." Use this label in data_source names and tree node fund labels.
- **D-07:** Enrichment runs only if combined Oakland + San Jose estimated API cost is under $0.10. Estimate before running; stop and ask if approaching limit.
- **D-08:** Four plans: (1) Seed both cities, (2) Oakland extractor + processor, (3) San Jose extractor + processor, (4) Enrichment + verification.

### Claude's Discretion

- Exact FY range for Oakland: which biennial PDFs are available and have consistent format.
- Exact FY range for San Jose: what is available and which years use a consistent General Fund summary structure.
- PDF page extraction approach for San Jose: targeted page-range vs. full-document scan.

### Deferred Ideas (OUT OF SCOPE)

- County linking for Oakland (Alameda County) + San Jose (Santa Clara County)
- `loadCAPopulation.js` reusable Census downloader
- Older Oakland biennials (pre-FY2021) if format changed significantly

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-02 | Oakland CA operating + revenue budget loaded and visible in app. PDF extraction (pdfplumber). Fund name: "General Purpose Fund". Target totals: ~$2.1B/year operating. | PDF URLs confirmed for FY2023-25 and FY2024-25 midcycle. FY2021-23 book naming pattern identified. |
| DATA-03 | San Jose CA operating + revenue budget loaded and visible in app. 100+ fund structure; enterprise funds to be filtered. Target totals: ~$1.7–1.9B General Fund. | Annual PDFs available at sanjoseca.gov for FY2022-23 through FY2025-26. |
| ENRICH-01 | Oakland + San Jose have AI-generated category enrichment. Run via `enrichCategories.js`. Idempotent. | `enrichCategories.js` confirmed fully reusable; estimated ~$0.04 for two cities combined. |
| POPUL-01 | Oakland ~444K and San Jose ~997K seeded with 2024 population data. | Values from Census sub-est2024_06.csv confirmed in REQUIREMENTS.md. |

</phase_requirements>

---

## Summary

Phase 28 follows the established CA PDF data load pattern from Phases 17 (Portland), 19 (Gresham), and 23 (Fremont). The core pipeline is: download budget PDFs → run pdfplumber Python extractor → Node.js processor calls `treasury_sync_budget_tree` RPC. No new libraries are required; all tools are already installed.

Oakland publishes a biennial adopted budget as a single "Policy Budget" PDF on an AWS S3 bucket (`cao-94612.s3.us-west-2.amazonaws.com`). Three biennials covering FY2021–FY2027 are available. The FY2021-23 operating budget book naming convention differs from later years (no confirmed URL yet; researcher must locate), but FY2023-25 and FY2024-25 midcycle adopted PDFs are confirmed. The FY2025-27 adopted book has not yet appeared at the expected URL (budget was adopted June 2025; PDF may use a different filename). Each biennial PDF covers two fiscal years — the extractor must detect per-page FY labels.

San Jose publishes an annual "Adopted Operating Budget" PDF at sanjoseca.gov (one PDF per fiscal year). Confirmed: FY2022-23, FY2023-24, FY2024-25, and FY2025-26. San Jose's budget has 100+ funds; the extractor must filter to the General Fund only. The PDFs are large (400+ pages) so a targeted page-range approach is more reliable than full-document scan. The General Fund summary table appears near the front of the document and contains department-level breakdowns.

Both cities require new municipality rows (no pre-existing rows confirmed). Population values (Oakland 444K, San Jose 997K, both 2024) are embedded inline in the seeder per the established pattern. Enrichment via `enrichCategories.js` is fully reusable — expected token cost is well under $0.10 for two cities combined.

**Primary recommendation:** Follow the Portland biennial pattern exactly for Oakland's extractor. For San Jose, adapt the Fremont pattern (General Fund section detection + text-line parsing) with targeted page range to identify the General Fund summary.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Municipality + data_source seeding | API / Backend (scripts) | Database / Storage | Supabase upsert via Node.js; no frontend involvement |
| PDF → JSON extraction | API / Backend (Python scripts) | — | pdfplumber runs server-side; stdout JSON piped to Node.js |
| Budget tree building + DB load | API / Backend (Node.js scripts) | Database / Storage | `treasury_sync_budget_tree` RPC handles persistence |
| AI enrichment | API / Backend (scripts) | External (Claude API) | `enrichCategories.js` calls Anthropic API; hard cost gate |
| App visibility | Browser / Client | Frontend Server (SSR) | `EntitySwitcher.tsx` auto-includes cities with `state='CA'` once data exists |
| Per-capita display | Browser / Client | — | Computed from `population` on municipality row; no extra work |

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfplumber | 0.11.9 [VERIFIED: python import] | PDF text/table extraction in Python | Used for Portland, Gresham, Troutdale, Fremont — established project standard |
| @supabase/supabase-js | 2.107.0 [VERIFIED: npm registry] | DB client + RPC calls | Project-wide standard; `treasury_sync_budget_tree` RPC requires it |
| @anthropic-ai/sdk | ^0.80.0 [VERIFIED: package.json] | Claude API for enrichment | Required by existing `enrichCategories.js` |
| Node.js built-ins (`child_process`, `fs`, `path`, `util`) | — | Script orchestration | Existing pattern; no additional packages |

### No new packages required for this phase.

**Version verification:**
```bash
python -c "import pdfplumber; print(pdfplumber.__version__)"  # → 0.11.9 on this machine
npm view @supabase/supabase-js version  # → 2.107.0 on registry
```

---

## Package Legitimacy Audit

> No new packages are being installed in this phase. All libraries are pre-existing project dependencies. This section is not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
PDF download (manual, researcher places files in docs/Oakland/ and docs/SanJose/)
       |
       v
Python extractor (pdfplumber)
  extractOakland.py  ──► stdout JSON  ──┐
  extractSanJose.py  ──► stdout JSON  ──┘
       |
       v
Node.js processor
  processOakland.js  ──► execSync() ──► JSON parse ──► buildTree() ──► treasury_sync_budget_tree RPC
  processSanJose.js  ──► execSync() ──► JSON parse ──► buildTree() ──► treasury_sync_budget_tree RPC
       |
       v
Supabase: treasury.municipalities  (upserted by seeder)
          treasury.data_sources    (upserted by seeder + processor)
          treasury.budgets         (deleted + reinserted by RPC, idempotent)
          treasury.budget_categories (same)
       |
       v
enrichCategories.js --city Oakland --state CA --year YYYY
enrichCategories.js --city "San Jose" --state CA --year YYYY
       |
       v
treasury.category_enrichment  (upserted by name_key, idempotent)
       |
       v
App: EntitySwitcher.tsx auto-includes Oakland + San Jose under "California"
```

### Recommended Project Structure

```
scripts/
├── seedOaklandSanJoseCA.js     # or split: seedOaklandCA.js + seedSanJoseCA.js
├── extractOakland.py           # pdfplumber biennial extractor
├── processOakland.js           # orchestrator + DB loader
├── extractSanJose.py           # pdfplumber General Fund extractor
└── processSanJose.js           # orchestrator + DB loader
docs/
├── Oakland/
│   ├── fy2021-23-adopted-budget.pdf   # researcher downloads
│   ├── fy2023-25-adopted-budget.pdf
│   └── fy2024-25-midcycle-adopted-budget.pdf
└── SanJose/
    ├── fy2022-23-adopted-operating-budget.pdf
    ├── fy2023-24-adopted-operating-budget.pdf
    ├── fy2024-25-adopted-operating-budget.pdf
    └── fy2025-26-adopted-operating-budget.pdf
```

### Pattern 1: Oakland Biennial FY Detection (Portland-style)

**What:** One PDF covers two fiscal years. The extractor walks all pages, detects the FY label per page (e.g., "FY 2023-24" or "2023-24"), and groups rows by detected FY. Both FYs are emitted in a single pass.

**When to use:** Always for Oakland biennial PDFs (D-02 locked).

**Key adaptation from Portland:** Oakland uses "FY 2023-24" format with a 4-digit + 2-digit separator (same as Portland's "FY 2025-26"). The `parse_fy()` function from `extractPortland.py` should work directly. The section marker will differ from Portland's "Appropriation Schedule" — Oakland uses department-level summary pages. Researcher must identify the actual section marker from the PDF.

Oakland amounts: need to verify whether Oakland PDFs express amounts in full dollars or thousands. Fremont used thousands (requiring `toFullDollars()` conversion). Oakland budget totals ~$2.1B/year, so if numeric values in the PDF are in the range 1,000,000+ they are full dollars; if in the range 2,000–2,200 range per department they are in millions.

```python
# Source: extractPortland.py parse_fy() — reuse verbatim for Oakland
def parse_fy(token):
    m = re.search(r'FY\s+(\d{4})-(\d{2})', token)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None
```

### Pattern 2: San Jose General Fund Targeted Page Extraction (Fremont-style)

**What:** The full operating budget PDF has 400+ pages covering 100+ funds. Only extract pages that contain the General Fund department summary table. Identify a reliable page marker such as "General Fund" in the page header AND a "Total General Fund" row in the table.

**When to use:** Always for San Jose PDFs (D-03 and D-04 locked).

**Key approach:** San Jose's General Fund summary typically appears in the first 20–30 pages of the PDF (front matter with fund overview) and/or in a dedicated "General Fund" chapter. The structure resembles Fremont: one summary table per fund with revenue and expenditure rows by department/service area. The `page.extract_tables()` approach is preferred over text-line parsing for tabular data.

Filter criteria (apply at extraction time, not post-processing):
- Accept only pages where fund = "General Fund" (exact string)
- Exclude pages with fund names: "Airport Fund", "Wastewater Fund", "Water Fund", any enterprise fund name

```python
# Source: adapted from extractFremont.py extract_budget() pattern
# Key marker for San Jose General Fund page detection:
GENERAL_FUND_MARKERS = {'General Fund'}
EXCLUDED_FUNDS = {'Airport Fund', 'San José-Santa Clara Regional Wastewater Facility Fund',
                  'Water Fund', 'Environmental Services Fund'}

# On each page, check page header text for fund name before parsing tables
if detected_fund not in GENERAL_FUND_MARKERS or detected_fund in EXCLUDED_FUNDS:
    continue
```

### Pattern 3: Seeder Structure

**What:** One combined seeder `seedOaklandSanJoseCA.js` (or two separate seeders — planner decides) that: (1) upserts Oakland municipality, (2) upserts San Jose municipality, (3) upserts data_source rows for each city + each dataset_type, (4) verifies via `treasury_list_source_ids` RPC.

**Template:** `seedCaliforniaCities.js` → `upsertMunicipality()` pattern. Oakland and San Jose do NOT have pre-existing municipality rows. [ASSUMED — verify before running; Sacramento had a pre-existing row from Phase 25]

**Data_source names (exact, must match processor lookup):**

| City | Dataset Type | Suggested Name |
|------|-------------|----------------|
| Oakland | operating | `"Oakland General Purpose Fund Operating Budget FY{YYYY}"` per year, OR single row named `"Oakland Operating Budget"` with `fiscal_years` array |
| Oakland | revenue | `"Oakland General Purpose Fund Revenue Budget"` |
| San Jose | operating | `"San Jose General Fund Operating Budget"` |
| San Jose | revenue | `"San Jose General Fund Revenue Budget"` |

Note: The planner must decide whether Oakland data_source rows are per-FY (like Portland's `"Portland Operating Budget FY2026"`) or single rows with a `fiscal_years` array (like Sacramento's `"Sacramento Operating Budget"`). The latter is simpler for multi-year loads; the former gives clearer attribution. Either pattern works with `treasury_sync_budget_tree`.

### Pattern 4: processOakland.js Multi-Year Loop

**What:** The processor iterates over all PDFs in `docs/Oakland/`, calls the Python extractor, groups rows by fiscal_year, builds a tree per FY, and loads each via `treasury_sync_budget_tree`.

**Template:** `processPortland.js` main() loop — almost verbatim. Key differences:
- No `vol1`/`vol2` suffix filter (Oakland is a single PDF per biennium)
- `datasetType = 'operating'` for GPF expenditure; `datasetType = 'revenue'` if revenue section found
- `resolvePdfDir()` helper reused verbatim (worktree-safe)

### Anti-Patterns to Avoid

- **Calling Oakland's fund "General Fund":** Oakland's primary unrestricted fund is the "General Purpose Fund" (GPF). Using "General Fund" in any data_source name or tree node label is incorrect and inconsistent with Oakland's official terminology (D-06 locked).
- **Loading all San Jose funds:** The 100+ fund structure makes the all-funds total ~$5.3B, which is misleading. Only the General Fund (~$1.7–1.9B) should be loaded (D-03 locked).
- **Hard-coding FY year in extractor:** The extractor must detect FY from page text, not from the filename alone. Filename fallback is acceptable as a last resort but should warn.
- **Blocking on revenue if not available:** If the operating budget PDF does not contain a clean revenue/sources-of-funds section, mark it deferred and ship with operating-only (D-05 locked). Do not add an unverified revenue parser just to satisfy the success criterion.
- **Skipping the $0.10 cost gate:** Enrichment for Oakland + San Jose must estimate token count before calling Claude. Do not skip the estimate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text/table extraction | Custom PDF parser | `pdfplumber` (already installed) | Handles font encoding, layout, multi-column tables; battle-tested on Portland, Gresham, Fremont |
| DB upsert + budget tree sync | Custom INSERT/UPDATE queries | `treasury_sync_budget_tree` RPC | Handles delete-reinsert idempotency, category hierarchy, and row count tracking atomically |
| Municipality lookup | Manual SELECT + conditional | `upsertMunicipality()` from `seedCaliforniaCities.js` | Handles existing-row update vs. insert, clear error on failure |
| AI enrichment descriptions | New LLM pipeline | `enrichCategories.js` | Already handles concurrency, idempotency via name_key, cost estimation, dry-run mode |
| Dollars-to-thousands conversion | Custom math | `toFullDollars(thousands)` from `processFremont.js` | One-liner; must verify Oakland/SJ use thousands before applying |

**Key insight:** The entire extraction → load pipeline is established. Phase 28 is a data configuration and tuning problem, not a new infrastructure problem.

---

## Oakland Budget PDF Availability

[VERIFIED via WebSearch — confirmed URLs return titled documents from authoritative S3 bucket]

| Biennium | Covers | PDF URL | Status |
|----------|--------|---------|--------|
| FY2021-23 | FY2021-22 + FY2022-23 | Pattern: `cao-94612.s3.amazonaws.com/documents/FY21-23-Adopted-Budget-Book-FINAL*.pdf` — exact URL not confirmed by search; researcher must locate | [ASSUMED: exists; FY-21-23 CIP Book confirmed but operating book URL not found] |
| FY2023-25 | FY2023-24 + FY2024-25 | `https://cao-94612.s3.us-west-2.amazonaws.com/documents/FY23-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf` | [VERIFIED: confirmed by WebSearch title "FY 2023-25 ADOPTED POLICY BUDGET"] |
| FY2024-25 midcycle | FY2024-25 (amendment) | `https://cao-94612.s3.us-west-2.amazonaws.com/documents/FY24-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf` | [VERIFIED: confirmed by WebSearch title "FY 2024-25 ADOPTED POLICY BUDGET"] |
| FY2025-27 | FY2025-26 + FY2026-27 | Budget adopted ~June 2025; adopted book URL not yet indexed. Pattern would be `FY25-27-Adopted-Budget-Book-FINAL-Reduced-Size.pdf`. Proposed book confirmed at `FY25-27-Proposed-Budget-Book-FINAL-Revised-5.8.25-Reduce-Size.pdf` | [ASSUMED: researcher must check; may not yet be available or may require checking the oaklandca.gov budget page directly] |

**Oakland GPF totals (for validation):**
- FY2025-26 GPF expenditure: ~$791.3M (per SPUR report; note this is GPF only, not all-funds) [CITED: SPUR report / KQED news]
- FY2023-25 total all-funds: ~$4.26B biennial; GPF is ~38–39% of total (~$800M–$830M/year) [CITED: Oakland budget portal descriptions]
- Target per requirements: ~$2.1B/year operating (all-funds context; GPF ~$800M–$850M) [ASSUMED: the DATA-02 requirement says "~$2.1B/year" which likely refers to the all-funds operating total, not GPF alone — researcher must verify what total the extractor produces vs. the success criterion]

**CRITICAL CLARIFICATION NEEDED:** The DATA-02 requirement says "totals in the ~$2.1B/year range" but Oakland's GPF is ~$791M–$850M/year. The all-funds total is ~$2.1B. This phase loads GPF data only (D-06), so the extractor total will be ~$800M–$850M, not $2.1B. The success criterion in REQUIREMENTS.md may be referring to all-funds. Researcher/planner should clarify with user or check the CONTEXT.md success criteria (#2 says "totals in the ~$2.1B/year range"). Since D-06 says to use "General Purpose Fund" and load GPF data, the $2.1B figure likely means all-funds and the per-requirement total for GPF will be lower. [ASSUMED — needs confirmation from user]

---

## San Jose Budget PDF Availability

[VERIFIED via WebSearch — confirmed URLs from sanjoseca.gov official budget pages]

| Fiscal Year | PDF Page URL | Notes |
|-------------|-------------|-------|
| FY2022-23 | `https://www.sanjoseca.gov/...2022-2023-adopted-operating-budget` | [VERIFIED: page confirmed via WebSearch] |
| FY2023-24 | `https://www.sanjoseca.gov/...2023-2024-adopted-operating-budget` | [VERIFIED: page confirmed via WebSearch] |
| FY2024-25 | `https://www.sanjoseca.gov/...2024-2025-adopted-operating-budget` | [VERIFIED: page confirmed via WebSearch] |
| FY2025-26 | `https://www.sanjoseca.gov/...2025-2026-adopted-operating-budget` | [VERIFIED: page confirmed via WebSearch] |

Each page contains an "Entire Document (PDF)" download link. Direct PDF URLs are not publicly indexable (sanjoseca.gov returns 403 for direct URL access from automated tools), but the researcher can download the PDFs manually by visiting each page.

**San Jose General Fund totals (for validation):**
- Success criterion: ~$1.7–1.9B General Fund
- Enterprise funds: Airport (~$760M+), Wastewater, Water — exclude entirely
- FY2025-26 General Fund budget message identified at `sanjose.legistar.com` [CITED: sanjose.legistar.com via WebSearch]

---

## Common Pitfalls

### Pitfall 1: Oakland Budget Book URL for FY2021-23 Not Found
**What goes wrong:** The FY2021-23 adopted budget book may not be hosted at the same URL pattern as FY2023-25. The search found a CIP book (`FY-21-23-Adopted-CIP-Book-9.29.21.pdf`) but not the operating policy budget book.
**Why it happens:** Oakland hosted the FY2021-23 budget on a legacy URL scheme before migrating to the `Reduced-Size` pattern. The interactive OpenGov portal was the primary delivery mechanism for FY2021-23.
**How to avoid:** Check oaklandca.gov/Government/Finance-Budget/Budget/Fiscal-Year-2021-2023-Budget directly. If no PDF book is available, use the FY2023-25 biennium (2 FYs) + FY2024-25 midcycle (1 FY) to cover FY2023–FY2025.
**Warning signs:** If search/browse finds only interactive OpenGov links (stories.opengov.com) with no downloadable PDF book, fall back to FY2023-25 as the earliest available.

### Pitfall 2: Oakland Budget Total vs. GPF Total Mismatch
**What goes wrong:** The DATA-02 requirement says "~$2.1B/year range" but Oakland's General Purpose Fund is ~$800M–$850M/year. The all-funds total is ~$2.1B.
**Why it happens:** The success criterion may have been written from an all-funds perspective.
**How to avoid:** When the extractor produces a ~$800M total for the GPF, verify this is correct before panicking. If the requirement means all-funds, the extractor would need to capture all funds — but D-06 says load GPF only. Raise this discrepancy with the user before attempting to load all-funds data.
**Warning signs:** Extractor total is ~$800M but success criterion says $2.1B.

### Pitfall 3: San Jose PDF Is Very Large (400+ Pages)
**What goes wrong:** Running pdfplumber on all 400+ pages is slow and may time out or consume excessive memory.
**Why it happens:** San Jose includes 100+ fund budgets in one omnibus document. Each fund has multiple pages.
**How to avoid:** Implement targeted page detection: skip pages that do not contain "General Fund" in the first 50 characters of page text. Break early once past the General Fund section. Target: extract in < 30 seconds for a 400-page PDF.
**Warning signs:** Extraction taking > 2 minutes; out-of-memory errors.

### Pitfall 4: San Jose Fund Name Variations
**What goes wrong:** The General Fund may appear with slight variations ("City's General Fund", "General Fund Operations", etc.) depending on the PDF year.
**Why it happens:** San Jose budget document formatting changed across years.
**How to avoid:** Use a flexible match: any page containing "General Fund" as a fund label (not just in descriptive text) AND a "Total" row in the table. Check at least two PDF years (FY2023-24 and FY2024-25) during extraction development before committing to the filter logic.
**Warning signs:** Extractor returns 0 rows for a year; or total is wrong by a large margin.

### Pitfall 5: Oakland Amounts in Thousands
**What goes wrong:** If Oakland's budget PDF expresses values in thousands (common in CA budget documents), loading the raw parsed number gives totals 1000x too small.
**Why it happens:** Many CA city PDFs use "amounts in thousands of dollars" for readability.
**How to avoid:** During dry-run, check the raw parsed total. If it's in the range 800,000–850,000 (thousands) rather than $800M–$850M (full), apply `toFullDollars(thousands)` conversion from `processFremont.js`. Look for "(In Thousands)" or similar label in the PDF header.
**Warning signs:** Dry-run total ~$800K instead of ~$800M.

### Pitfall 6: FY2025-27 Oakland Adopted Budget Not Yet Available
**What goes wrong:** The Oakland FY2025-27 budget was adopted in June 2025. The adopted PDF book may not yet be indexed or may have a different filename.
**Why it happens:** Cities often publish the proposed book weeks before the adopted book. The errata/proposed book exists but the final adopted book URL was not found.
**How to avoid:** If the adopted FY2025-27 PDF is not yet available, use FY2023-25 + FY2024-25 midcycle (covering FY2023 through FY2025) as the primary data range. Do not use the proposed budget book — it may not reflect final appropriations.
**Warning signs:** Only finding "Proposed" PDF, not "Adopted" PDF for FY2025-27.

### Pitfall 7: Oakland Municipality Row Already Exists
**What goes wrong:** If Oakland was seeded in an earlier phase (e.g., as part of a CA city migration), the seeder insert will fail or create a duplicate.
**Why it happens:** Phase 25 (LA County links) or Phase 16 (SF/SD seeding) may have inadvertently created Oakland.
**How to avoid:** Use `upsertMunicipality()` (the pattern from `seedCaliforniaCities.js`) which does SELECT-first then INSERT-or-UPDATE. Never use raw INSERT without a prior lookup.
**Warning signs:** Supabase error "duplicate key" on municipality insert.

---

## Code Examples

### Seeder Pattern (from seedCaliforniaCities.js and seedSacramentoCA.js)

```javascript
// Source: scripts/seedCaliforniaCities.js upsertMunicipality()
async function upsertMunicipality(m) {
  const { data: existing } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id')
    .eq('name', m.name)
    .eq('state', m.state)
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabase.schema('treasury').from('municipalities')
      .update(m).eq('id', existing.id).select();
    return data[0].id;
  }
  const { data } = await supabase.schema('treasury').from('municipalities')
    .insert(m).select();
  return data[0].id;
}

// Oakland + San Jose municipality payloads
const MUNICIPALITIES = [
  { name: 'Oakland',   state: 'CA', entity_type: 'city', population: 444000, population_year: 2024 },
  { name: 'San Jose',  state: 'CA', entity_type: 'city', population: 997000, population_year: 2024 },
];
```

### Biennial FY Detection (from extractPortland.py — reuse for Oakland)

```python
# Source: scripts/extractPortland.py parse_fy() and detect_fiscal_year()
def parse_fy(token):
    """Oakland uses "FY 2023-24" format — same as Portland. Returns ending year."""
    m = re.search(r'FY\s+(\d{4})-(\d{2})', token)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None

def detect_fiscal_year(text):
    """Detect FY from page text. Adapt marker text for Oakland's actual section headings."""
    # Oakland section marker TBD from actual PDF inspection.
    # Fallback: search for any "FY YYYY-YY" pattern on the page.
    m = re.search(r'FY\s+(\d{4})-(\d{2})', text)
    if m:
        century = int(m.group(1)) // 100 * 100
        end_yy = int(m.group(2))
        return century + end_yy
    return None
```

### treasury_sync_budget_tree RPC call (from processPortland.js)

```javascript
// Source: scripts/processPortland.js loadFiscalYear()
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   datasetType,    // 'operating' | 'revenue'
  p_total:          total,
  p_tree:           tree,
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});
```

### Enrichment invocation

```bash
# Source: scripts/enrichCategories.js usage (from enrichCategories.js header comment)
node scripts/enrichCategories.js --city Oakland --state CA --year 2024
node scripts/enrichCategories.js --city "San Jose" --state CA --year 2025

# Always estimate first (dry-run):
node scripts/enrichCategories.js --city Oakland --state CA --year 2024 --dry-run
node scripts/enrichCategories.js --city "San Jose" --state CA --year 2025 --dry-run
# Proceed only if combined estimate < $0.10
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual DB inserts for each city | `upsertMunicipality()` + idempotent seeder script | Phase 16 | Safe to re-run; preserves existing FKs |
| Full-document PDF scan | Targeted section/page detection (Portland, Fremont patterns) | Phases 17–23 | Faster; avoids false positives from non-budget pages |
| Separate revenue extraction script | Best-effort revenue from the same PDF when available | Phase 23 (Fremont) | Fewer files; one extractor handles both datasets |
| Per-year data_source rows | `fiscal_years[]` array on one data_source row | Phase 26 (Sacramento) | Simpler seeder for cities with many years |

**Deprecated/outdated:**
- `bulkLoadBudget.js` Socrata approach: not applicable — Oakland and San Jose do not have accessible Socrata endpoints for these datasets. pdfplumber is the correct tool.
- `bulkLoadPDF.js` Claude Haiku vision pipeline: not applicable — D-00 in context specifies pdfplumber only. Zero AI cost for extraction.

---

## Runtime State Inventory

> Not a rename/refactor phase. Omit.

---

## Open Questions

1. **Oakland GPF total vs. $2.1B requirement discrepancy**
   - What we know: Oakland GPF is ~$800M–$850M/year; all-funds total is ~$2.1B/year
   - What's unclear: Does DATA-02 success criterion "~$2.1B/year range" mean GPF or all-funds?
   - Recommendation: Plan executor should verify Oakland PDF's GPF total in dry-run and compare. If GPF total is ~$800M–$850M, flag this to the user before proceeding. The user likely intended all-funds OR made a sizing error in the requirement. Do not attempt to load all funds without explicit user confirmation — D-06 locks GPF-only.

2. **Oakland FY2021-23 budget book URL**
   - What we know: The CIP book exists at `FY-21-23-Adopted-CIP-Book-9.29.21.pdf` (capital projects only). The operating policy budget book URL is not confirmed.
   - What's unclear: Is the FY2021-23 policy budget available as a downloadable PDF?
   - Recommendation: Researcher must visit `oaklandca.gov/Government/Finance-Budget/Budget/Fiscal-Year-2021-2023-Budget` and download any available "Policy Budget" PDF. If not available, fall back to FY2023-25 as the earliest biennium.

3. **Oakland FY2025-27 adopted book availability**
   - What we know: Budget adopted ~June 2025. Proposed book exists. Adopted book not yet found in search.
   - What's unclear: Has the adopted PDF book been published?
   - Recommendation: Check `cao-94612.s3.us-west-2.amazonaws.com/documents/FY25-27-Adopted-Budget-Book-FINAL-Reduced-Size.pdf` directly. If 404, skip FY2025-26 for now and include it in the deferred list.

4. **Oakland amounts: full dollars or thousands?**
   - What we know: Fremont PDFs use thousands; Portland uses full dollars.
   - What's unclear: Oakland budget PDF denomination.
   - Recommendation: During extractor development, check the page header/footer for "(In Thousands)" label or calibrate against a known total (Police department ~$300M in GPF). If raw parsed value is ~300 (not 300,000,000), amounts are in millions.

5. **San Jose "General Fund" exact label in PDF**
   - What we know: San Jose PDFs are large with 100+ funds; "General Fund" is the primary operating fund.
   - What's unclear: Whether the label in the PDF is exactly "General Fund" or a variant.
   - Recommendation: Download FY2024-25 PDF first and run a quick pdfplumber text scan on the first 30 pages to identify the exact fund name used. This drives the filter logic.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | pdfplumber extractor | ✓ | 3.14.3 | — |
| pdfplumber | PDF extraction | ✓ | 0.11.9 | — |
| Node.js | Processor scripts | ✓ | v24.13.0 | — |
| @supabase/supabase-js | DB access | ✓ | 2.107.0 | — |
| SUPABASE_SERVICE_KEY env var | DB writes | ✓ (confirmed in .env from prior phases) | — | — |
| docs/Oakland/ directory | PDF storage | ✗ (does not exist yet) | — | Create: `mkdir docs/Oakland` |
| docs/SanJose/ directory | PDF storage | ✗ (does not exist yet) | — | Create: `mkdir docs/SanJose` |
| Oakland budget PDFs | Extraction | ✗ (must download) | — | Download from cao-94612.s3 URLs above |
| San Jose budget PDFs | Extraction | ✗ (must download) | — | Download from sanjoseca.gov pages above |

**Missing dependencies with no fallback:**
- Oakland and San Jose PDFs (researcher/plan executor must download before Plan 2 and Plan 3 can run)

**Missing dependencies with fallback:**
- docs/Oakland/ and docs/SanJose/ directories (auto-created by seeder or processor scripts, or manually with mkdir)

---

## Validation Architecture

> workflow.nyquist_validation is absent from .planning/config.json — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual dry-run testing (no automated test framework detected in project) |
| Config file | none |
| Quick run command | `node scripts/processOakland.js --dry-run` |
| Full suite command | `node scripts/processOakland.js --dry-run && node scripts/processSanJose.js --dry-run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-02 | Oakland GPF operating + revenue loads with correct totals | smoke (dry-run) | `node scripts/processOakland.js --dry-run` | ❌ Wave 0 |
| DATA-03 | San Jose GF operating + revenue loads with correct totals | smoke (dry-run) | `node scripts/processSanJose.js --dry-run` | ❌ Wave 0 |
| ENRICH-01 | Enrichment rows created for both cities | smoke (dry-run) | `node scripts/enrichCategories.js --city Oakland --state CA --year 2024 --dry-run` | ✅ exists |
| POPUL-01 | Municipality rows have correct population values | smoke | `node scripts/seedOaklandSanJoseCA.js` (idempotent) + verify output | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Dry-run the relevant script for the task being committed
- **Per wave merge:** Full dry-run of all new scripts
- **Phase gate:** App spot-check at `treasurytracker.empowered.vote` — Oakland and San Jose visible under California, totals match expected ranges

### Wave 0 Gaps

- [ ] `scripts/seedOaklandSanJoseCA.js` — covers POPUL-01 and DATA-02/03 prerequisites
- [ ] `scripts/extractOakland.py` — covers DATA-02 extraction
- [ ] `scripts/processOakland.js` — covers DATA-02 DB load
- [ ] `scripts/extractSanJose.py` — covers DATA-03 extraction
- [ ] `scripts/processSanJose.js` — covers DATA-03 DB load
- [ ] `docs/Oakland/` directory — required by processOakland.js
- [ ] `docs/SanJose/` directory — required by processSanJose.js

---

## Security Domain

> security_enforcement not set in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Scripts run locally with service key |
| V3 Session Management | no | No web session in scripts |
| V4 Access Control | no | Service role key; scripts run locally |
| V5 Input Validation | yes | PDF path from controlled docs/ directory, not user input |
| V6 Cryptography | no | No cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via PDF path | Tampering | PDF path from controlled `readdirSync(docs/Oakland/)`, not user CLI input; quote path in execSync (established pattern from Portland T-17-03) |
| Excessive Claude API spend | Denial of resource | Hard $0.10 gate in enrichment — estimate before running (D-07 locked) |
| Supabase key exposure | Information disclosure | Key in `.env`/`.env.local` only; not logged; `.env` in `.gitignore` |
| Large PDF buffer overflow | Denial of service | `maxBuffer: 8 * 1024 * 1024` in execSync (established pattern from processPortland.js T-17-04) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Oakland and San Jose do not have pre-existing municipality rows in treasury.municipalities | Seeder patterns + Open Questions | Seeder will update (not error) if upsertMunicipality() is used correctly; low risk |
| A2 | Oakland FY2021-23 policy budget book is available as a downloadable PDF | Oakland Budget PDF Availability | Researcher may need to fall back to FY2023-25 as earliest biennium (see deferred items) |
| A3 | Oakland FY2025-27 adopted PDF is available at `FY25-27-Adopted-Budget-Book-FINAL-Reduced-Size.pdf` | Oakland Budget PDF Availability | May be 404; researcher must check; fallback: exclude FY2025-26/2026-27 from initial load |
| A4 | San Jose PDF direct download URLs can be obtained by visiting the sanjoseca.gov budget pages | San Jose Budget PDF Availability | sanjoseca.gov returned 403 for automated access; manual download by researcher is required |
| A5 | Oakland budget PDF amounts are in full dollars (not thousands) | Pitfall 5 / Code Examples | If in thousands, all loaded amounts will be 1000x too small; dry-run validation catches this |
| A6 | DATA-02 success criterion "$2.1B/year range" refers to all-funds, not GPF | Open Questions | If it means GPF, the expected total is ~$800M–$850M and this is a requirements inconsistency to resolve |
| A7 | San Jose "General Fund" label in PDF is the exact string "General Fund" | San Jose Fund Scope | May require regex match; researcher must inspect actual PDF text |
| A8 | Oakland amounts are full dollars not thousands | Oakland pitfalls | Could produce silent 1000x under/over reporting; verify during dry-run |
| A9 | The FY2025-27 Oakland budget uses the same PDF structure as FY2023-25 | Architecture Patterns | If format changed, extractor may need adjustment |

---

## Sources

### Primary (HIGH confidence)

- `scripts/extractPortland.py` — FY detection logic, `parse_fy()`, `detect_fiscal_year()`, multi-year biennial single-pass pattern
- `scripts/extractFremont.py` — General Fund section detection, text-line parsing, expenditure + revenue from same page
- `scripts/processPortland.js` — `resolvePdfDir()`, multi-PDF loop, `treasury_sync_budget_tree` RPC invocation
- `scripts/processFremont.js` — `toFullDollars()`, operating + revenue tree builder, multi-year column detection
- `scripts/seedCaliforniaCities.js` — `upsertMunicipality()` pattern, `upsertDataSourceByName()`
- `scripts/seedSacramentoCA.js` — single-city seeder pattern with verification via `treasury_list_source_ids`
- `.planning/REQUIREMENTS.md` — DATA-02, DATA-03, ENRICH-01, POPUL-01 definitions and target totals
- `.planning/phases/28-oakland-san-jose-ca-data-load/28-CONTEXT.md` — all locked decisions (D-01 through D-08)

### Secondary (MEDIUM confidence)

- WebSearch: Oakland FY2023-25 adopted budget book confirmed URL `cao-94612.s3.us-west-2.amazonaws.com/documents/FY23-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf` — confirmed by titled search result "FY 2023-25 ADOPTED POLICY BUDGET"
- WebSearch: Oakland FY2024-25 midcycle adopted book confirmed URL `cao-94612.s3.us-west-2.amazonaws.com/documents/FY24-25-Adopted-Budget-Book-FINAL-Reduced-Size.pdf` — confirmed by titled search result "FY 2024-25 ADOPTED POLICY BUDGET"
- WebSearch: San Jose adopted operating budget pages confirmed at sanjoseca.gov for FY2022-23 through FY2025-26
- WebSearch: Oakland GPF expenditure ~$791M in FY2025-26 (SPUR report, KQED news)
- WebSearch: Oakland all-funds total ~$2.1B/year (Oakland budget portal descriptions)

### Tertiary (LOW confidence — needs validation)

- Oakland FY2021-23 policy budget book URL — not confirmed by search; CIP book only found
- Oakland FY2025-27 adopted book availability — proposed book confirmed but adopted book not found
- San Jose exact PDF total for General Fund by fiscal year — not verified from actual PDF content

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages pre-installed and confirmed
- Architecture: HIGH — direct reuse of confirmed Portland/Fremont patterns
- PDF URLs (Oakland FY2023-25, FY2024-25): HIGH — confirmed by titled WebSearch results
- PDF URLs (Oakland FY2021-23, FY2025-27): LOW — not confirmed; researcher must verify
- San Jose PDF structure: MEDIUM — page structure confirmed by REQUIREMENTS.md notes; exact label not verified from actual PDF
- Pitfalls: HIGH — derived from directly analogous prior phase implementations

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (Oakland budget PDFs stable; San Jose PDFs stable once downloaded)
