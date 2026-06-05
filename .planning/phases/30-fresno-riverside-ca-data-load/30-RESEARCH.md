# Phase 30: Fresno + Riverside CA Data Load - Research

**Researched:** 2026-06-05
**Domain:** CA city PDF budget extraction — pdfplumber Python extractors, Node.js processors, Supabase RPC loading
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Target FY2020–2026 for Fresno (6–7 years). Researcher determines available PDFs with consistent structure; stop at FY2022 if format changes significantly before FY2022.
- **D-02:** Riverside — go as deep as consistent structure allows, preferring ~3 biennials (~6 FYs). Researcher determines available PDFs.
- **D-03:** Single extractor pass yields both fiscal years from one Riverside biennial PDF (same Oakland per-page FY detection pattern). No separate per-year passes required.
- **D-04:** Fresno — General Fund only (strict). Filter to rows explicitly labeled "General Fund" at extraction time. Target total ~$483M. Exclude all enterprise/proprietary funds.
- **D-05:** Riverside — General Fund only (strict). Filter to General Fund rows at extraction time. Excludes RPU (electric utility), Water, Sewer, and all other enterprise/proprietary funds. Target total ~$1.45B/year.
- **D-06:** Filtering happens at extraction time (in Python extractor). Do not produce enterprise rows at all. Same as San Jose in Phase 28.
- **D-07:** Best-effort revenue from operating budget PDF — same as Phase 28 D-05. If operating budget PDF contains a clear revenue / sources-of-funds section, extract and load it. If not cleanly available, note as deferred. Do NOT search for standalone revenue documents unless operating PDF yields nothing.
- **D-08:** Four plans: Plan 1 (seed both cities), Plan 2 (Fresno extractor + processor), Plan 3 (Riverside biennial extractor + processor), Plan 4 (enrichment + spot-check + verify).
- **D-09:** Fresno runs first (Plan 2 before Plan 3).
- **D-10:** Enrichment cost gate is $0.10 combined (Fresno + Riverside). Estimate before running; stop and ask if expected cost approaches $0.10.

### Claude's Discretion

- Exact number of FY years for each city: researcher determines based on available PDFs with consistent format.
- PDF page extraction approach for Fresno: researcher determines targeted vs. full-document scan based on actual PDF layout.
- Number of biennials for Riverside: researcher determines how many PDFs are available with compatible structure.
- Exact data_source row names: planner determines; must match what processors look up via `treasury_list_source_ids`.
- Whether to use `toFullDollars()` helper: researcher verifies if PDF amounts are in thousands (as with Fremont/San Jose) or full dollars.

### Deferred Ideas (OUT OF SCOPE)

- County linking for Fresno (Fresno County) + Riverside (Riverside County) — `county_id` stays NULL for both cities.
- Pre-FY2020 historical data for Fresno.
- Older Riverside biennials if format changed significantly before target depth.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-05 | Fresno CA operating + revenue budget loaded and visible in app; enterprise funds (~$899M) excluded; General Fund target ~$483M | pdfplumber extractor (extractLongBeach.py pattern), fund filter at extraction time, `treasury_sync_budget_tree` RPC |
| DATA-06 | Riverside CA operating + revenue budget loaded and visible in app; biennial budget (2 FYs per PDF); RPU + enterprise funds excluded; ~$1.45B/year | pdfplumber extractor (extractOakland.py biennial pattern), per-page FY detection, `treasury_sync_budget_tree` RPC |
| ENRICH-01 (Fresno + Riverside) | AI-generated category enrichment for both cities; operating and revenue categories described in plain language | `enrichCategories.js` — no changes needed; `--city Fresno --state CA --year YYYY` and `--city Riverside --state CA --year YYYY` |
| POPUL-01 (Fresno + Riverside) | Both cities seeded with 2024 population; per-capita displays correctly | Fresno ~550K, Riverside ~324K from Census `sub-est2024_06.csv`; `population_year = 2024`; `upsertMunicipality()` pattern |
</phase_requirements>

---

## Summary

Phase 30 loads Fresno and Riverside into the Treasury Tracker app, extending the v1.6 California city expansion. Both cities require custom pdfplumber Python extractors — there are no open data portals with machine-readable budget data. The two cities differ in one critical structural respect: Fresno publishes single-year annual adopted budget PDFs (same pattern as Long Beach), while Riverside publishes biennial budgets where one PDF covers two fiscal years (same pattern as Oakland). All prior work for both these patterns is already in the codebase; this phase adapts rather than invents.

The fund-filtering requirement is the most important correctness constraint. Fresno's enterprise/proprietary funds (~$899M) exceed the General Fund (~$483M), so a bug that bleeds enterprise rows into the output would nearly double the reported total. The filter must be applied at Python extraction time (not post-hoc in the processor). For Riverside, RPU (Riverside Public Utilities, a full municipal electric utility) is the largest enterprise fund and is similarly excluded at extraction time.

Revenue data for both cities follows the best-effort strategy from D-07: extract from the operating budget PDF if a clear revenue section exists; defer if not. This prevents revenue ambiguity from blocking the phase.

**Primary recommendation:** Adapt `extractLongBeach.py` for Fresno (single-year, General Fund filter by label), adapt `extractOakland.py` for Riverside (biennial, per-page FY detection, General Fund filter by label), and adapt `seedLongBeachBakersfieldCA.js` + `processOakland.js`/`processLongBeach.js` for the Node.js processor layer. The seeder and processor patterns are fully established and require mechanical adaptation only.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Municipality seeding (rows + population) | Database / Storage | — | `treasury.municipalities` insert via Supabase JS client |
| Data source row creation | Database / Storage | — | `treasury.data_sources` upsert by name; processor lookup relies on canonical names |
| PDF budget extraction (Fresno) | Backend script | — | Python pdfplumber reads local PDF files; outputs JSON to stdout |
| PDF budget extraction (Riverside biennial) | Backend script | — | Python pdfplumber; per-page FY detection yields rows for both FYs |
| Budget tree loading | Database / Storage | — | `treasury_sync_budget_tree` RPC via Node.js processor; deletes+reinserts per FY |
| Fund filtering (enterprise exclusion) | Backend script (Python) | — | Extraction-time filter; not in processor. Established pattern from D-06 |
| AI enrichment | Backend script | Database / Storage | `enrichCategories.js` → Claude API → `treasury.category_enrichment` upsert |
| Per-capita display | Frontend (existing) | — | No new frontend work; app reads `population` from `treasury.municipalities` automatically |
| City picker appearance | Frontend (existing) | — | `EntitySwitcher.tsx` picks up any `state = 'CA'` municipality with budget data automatically |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdfplumber (Python) | confirmed OK [VERIFIED: local env] | PDF text extraction | Already in use for all CA PDF cities; `import pdfplumber` works in Python 3.14 |
| @supabase/supabase-js | 2.101.1 [VERIFIED: npm list] | DB client for seeders and processors | Project standard; all scripts use this |
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
| pdfplumber | PyMuPDF (fitz), pdftotext | pdfplumber is already installed and proven for these CA PDFs; no reason to switch |
| extractOakland.py pattern for Riverside | New bespoke extractor | Oakland's biennial per-page FY detection is exactly what Riverside needs; adapt, don't reinvent |

**Installation:** No new packages required. All dependencies already installed. [VERIFIED: local env]

---

## Package Legitimacy Audit

No new packages are being installed in this phase. All dependencies are already present in the project environment. [VERIFIED: local env — `pdfplumber` imports OK; `@supabase/supabase-js@2.101.1` confirmed via `npm list`]

---

## Architecture Patterns

### System Architecture Diagram

```
PDF files (docs/Fresno/*.pdf, docs/Riverside/*.pdf)
        |
        v
Python extractor (extractFresno.py / extractRiverside.py)
  - pdfplumber reads pages
  - Fund filter: keep "General Fund" rows only (extraction-time)
  - Fresno: single-year, FY from filename
  - Riverside: biennial, per-page FY detection (Oakland pattern)
  - Revenue section: best-effort from same PDF (D-07)
  - Output: JSON array to stdout
        |
        v (execSync in Node.js processor)
Node.js processor (processFresno.js / processRiverside.js)
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
  - Reads unenriched categories for Fresno/Riverside from DB
  - Calls Claude API with budget context
  - Upserts treasury.category_enrichment via name_key (idempotent)
```

### Recommended Project Structure
```
scripts/
├── seedFresnoRiversideCA.js     # Plan 1: both cities (two-city seeder, LongBeach pattern)
├── extractFresno.py             # Plan 2: pdfplumber extractor (LongBeach single-year pattern)
├── processFresno.js             # Plan 2: Node.js processor
├── extractRiverside.py          # Plan 3: pdfplumber extractor (Oakland biennial pattern)
└── processRiverside.js          # Plan 3: Node.js processor
docs/
├── Fresno/                      # Plan 2: downloaded adopted budget PDFs
└── Riverside/                   # Plan 3: downloaded biennial budget PDFs
```

### Pattern 1: Two-City Seeder (from seedLongBeachBakersfieldCA.js)
**What:** Single script upserts two municipality rows + four data_source rows, then verifies via `treasury_list_source_ids` RPC.
**When to use:** Any time two cities are seeded in the same plan step.
**Example:**
```javascript
// Source: scripts/seedLongBeachBakersfieldCA.js (verified in codebase)
const MUNICIPALITIES = [
  { name: 'Fresno',    state: 'CA', entity_type: 'city', population: 550000, population_year: 2024 },
  { name: 'Riverside', state: 'CA', entity_type: 'city', population: 324000, population_year: 2024 },
  // county_id stays NULL for both — Fresno County and Riverside County not loaded (deferred)
];
```

### Pattern 2: Extraction-Time Fund Filter (from extractOakland.py and extractLongBeach.py)
**What:** Python extractor only emits rows for the target fund. Enterprise/proprietary fund rows are never produced — not filtered in the Node.js processor.
**When to use:** Every CA city with multiple fund types.
**Example:**
```python
# Source: scripts/extractOakland.py (verified in codebase)
# For Fresno: only emit rows where fund label matches "General Fund"
# For Riverside: only emit rows where fund label matches "General Fund"
# (RPU / Water / Sewer rows get no `results.append()` call)
if 'General Fund' in line and not any(enterprise in line for enterprise in
   ['Utilities', 'RPU', 'Water', 'Sewer', 'Airport', 'Refuse']):
    results.append({...})
```

### Pattern 3: Biennial Per-Page FY Detection (from extractOakland.py)
**What:** Each page in the biennial PDF is scanned for its FY column headers. Rows from that page get `fiscal_year` set to the detected year. Single pass yields rows for both FY N and FY N+1.
**When to use:** Riverside (and Oakland). The same PDF has side-by-side columns for two fiscal years.
**Key functions from extractOakland.py:**
```python
# Source: scripts/extractOakland.py (verified in codebase)
def detect_biennial_fys(pdf_path):  # from filename: fy2023-25 → (2024, 2025)
def detect_fy_from_header(text):    # from table header text: "FY23-24 Biennial" → 2024
# Results include rows with fiscal_year=2024 AND fiscal_year=2025
```

### Pattern 4: Processor Sanity Band Check
**What:** Every processor checks the total against an expected dollar range. If total falls outside the band, the script halts with a descriptive error before writing any DB rows.
**When to use:** Every processor — mandatory before live run.
**Example:**
```javascript
// Source: scripts/processOakland.js and processLongBeach.js (verified in codebase)
const GF_BAND_MIN = 400_000_000;  // Fresno: ~$383M–$583M (±100M around $483M)
const GF_BAND_MAX = 583_000_000;
if (total < GF_BAND_MIN || total > GF_BAND_MAX) {
  console.error('SCALE MISMATCH — halting before DB write');
  process.exit(3);
}
```

### Pattern 5: resolvePdfDir() Worktree-Safe Helper
**What:** When running in a git worktree, `docs/` directories are in the main working tree root, not the worktree root. `resolvePdfDir()` falls back to the main repo root via `git rev-parse --git-common-dir`.
**When to use:** Every processor. Copy verbatim from `processOakland.js`.
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

- **Post-hoc enterprise fund filtering in the processor:** Never strip fund types in Node.js — the Python extractor must be the filter gate. A processor that "cleans up" rows after the fact is fragile and creates audit risk.
- **Hard-coding FY from processor flags:** Fresno FY comes from the PDF filename (same as Long Beach). Riverside biennial FY comes from per-page header detection. Do not pass `--year` CLI flags to the processor.
- **All-funds total as sanity baseline:** Fresno's all-funds total is ~$2.0B; General Fund only is ~$483M. Using the all-funds figure as the sanity ceiling would allow enterprise bleed to pass undetected.
- **Confusing Riverside City with Riverside County:** These are separate government entities. The extractor and seeder work on the City of Riverside budget only.
- **Skipping dry-run before live load:** Every processor must be verified with `--dry-run` first to confirm row counts and totals match expectations before any DB writes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent municipality upsert | Custom insert logic | `upsertMunicipality()` from seedLongBeachBakersfieldCA.js | SELECT-then-INSERT-or-UPDATE; preserves id/created_at |
| Idempotent data_source upsert | Custom insert logic | `upsertDataSourceByName()` from seedLongBeachBakersfieldCA.js | Upsert by name; exact same pattern as all CA seeders |
| Budget tree DB load | Direct table insert | `treasury_sync_budget_tree` RPC | RPC handles delete+reinsert atomically; correct idempotency |
| Data source lookup by name | Direct table query | `treasury_list_source_ids` RPC | Standard lookup path; validates names exist after seeding |
| Enrichment | Custom Claude prompting | `enrichCategories.js` | Already handles cost tracking, dry-run, name_key idempotency |
| PDF text extraction | Custom PDF parser | pdfplumber | Handles multi-column tables, whitespace normalization; already proven for all CA cities |

**Key insight:** This phase is entirely mechanical adaptation of established patterns. No new DB schema, no new RPC, no new npm packages. The only creative work is understanding the Fresno and Riverside PDF layouts and mapping their table structure to the existing extractor patterns.

---

## Common Pitfalls

### Pitfall 1: Enterprise Fund Bleed (Critical)
**What goes wrong:** Extractor emits rows labeled "Sewer Fund", "Electric Fund (RPU)", or other enterprise funds, inflating the total from ~$483M to ~$2.0B (Fresno) or ~$1.45B to much higher (Riverside).
**Why it happens:** PDF tables present all funds on adjacent rows; a too-broad regex or missing fund filter captures non-General Fund rows.
**How to avoid:** At extraction time, only append rows where the fund label explicitly matches "General Fund". Log any row skipped due to fund filter mismatch to stderr.
**Warning signs:** Dry-run total is 3–4× the expected value. Sanity band check will catch this and halt.

### Pitfall 2: Riverside Biennial — Duplicate FY Rows
**What goes wrong:** The Oakland biennial pattern emits rows for both FY N and FY N+1 from a single PDF. If the same PDF is processed twice (e.g., once per FY manually), every row is duplicated.
**Why it happens:** Operator confusion about single-pass vs. two-pass approach.
**How to avoid:** D-03 mandates single-pass. Processor groups rows by `fiscal_year` and calls `treasury_sync_budget_tree` once per distinct FY. RPC is idempotent (delete+reinsert), so re-running is safe but redundant.
**Warning signs:** Row counts are exactly double expected; totals appear doubled in the app.

### Pitfall 3: toFullDollars() Assumption
**What goes wrong:** Fresno or Riverside PDFs express amounts in thousands (like Fremont), but the extractor passes raw values to the processor, which skips the `× 1000` conversion. Or vice versa — PDFs use full dollars (like Oakland/Long Beach) but the processor multiplies, inflating all values by 1000.
**Why it happens:** PDF formatting is city-specific; Oakland and Long Beach use full dollars but Fremont uses thousands.
**How to avoid:** During extractor development, verify the scale by spot-checking one known department total against the published PDF. If a single department shows $483 instead of $483,000,000, amounts are in thousands.
**Warning signs:** Sanity band check catches gross scale errors; dry-run total is exactly 1000× or 1/1000× expected.

### Pitfall 4: Revenue Section Not Present in Operating PDF
**What goes wrong:** D-07 is best-effort — if the Fresno or Riverside operating budget PDF does not have a clean revenue / sources-of-funds section, the extractor may either return empty results or grab the wrong data.
**Why it happens:** CA city PDFs vary; not all include revenue summaries in the same document.
**How to avoid:** Revenue extraction failure is not a blocker. If dry-run revenue mode returns 0 rows or clearly wrong totals, mark revenue as deferred and ship operating-only per D-07.
**Warning signs:** Revenue dry-run shows 0 rows or totals that are negative/implausible.

### Pitfall 5: data_source Name Mismatch
**What goes wrong:** Seeder creates `'Fresno General Fund Operating Budget'` but processor looks up `'Fresno GF Operating Budget'`. `treasury_list_source_ids` returns the seeder's name; processor cannot find it.
**Why it happens:** Naming decided in two places (seeder constant and processor lookup string) must match exactly.
**How to avoid:** Define canonical names as constants in the seeder; processor imports or hard-codes the same string. Seeder verification step (Step D) catches mismatches before processor runs.
**Warning signs:** Processor exits with "data_source not found" or similar error.

### Pitfall 6: Riverside City vs. Riverside County Confusion
**What goes wrong:** Seeder or extractor targets Riverside County budget documents instead of City of Riverside.
**Why it happens:** "Riverside" is ambiguous — both city and county government exist.
**How to avoid:** Municipality row: `{ name: 'Riverside', state: 'CA', entity_type: 'city' }`. PDF source is city of Riverside official budget site. Never use Riverside County documents.
**Warning signs:** Population value is ~2.4M (county) instead of ~324K (city); budget total is in the billions rather than ~$1.45B.

---

## Code Examples

### Seeder Template (adapt from seedLongBeachBakersfieldCA.js)
```javascript
// Source: scripts/seedLongBeachBakersfieldCA.js (verified in codebase)
const MUNICIPALITIES = [
  { name: 'Fresno',    state: 'CA', entity_type: 'city', population: 550000, population_year: 2024 },
  { name: 'Riverside', state: 'CA', entity_type: 'city', population: 324000, population_year: 2024 },
  // county_id stays NULL — Fresno County / Riverside County not loaded in DB (deferred)
];
const DATA_SOURCES = (fresnoId, riversideId) => [
  { name: 'Fresno General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'fresno-gf-operating', municipality_id: fresnoId },
  { name: 'Fresno General Fund Revenue Budget',   api_type: 'pdf_download', dataset_type: 'revenue',   dataset_id: 'fresno-gf-revenue',   municipality_id: fresnoId },
  { name: 'Riverside General Fund Operating Budget', api_type: 'pdf_download', dataset_type: 'operating', dataset_id: 'riverside-gf-operating', municipality_id: riversideId },
  { name: 'Riverside General Fund Revenue Budget',   api_type: 'pdf_download', dataset_type: 'revenue',   dataset_id: 'riverside-gf-revenue',   municipality_id: riversideId },
];
```

### Extractor Fund Filter (Fresno — single-year pattern)
```python
# Source: adapted from scripts/extractLongBeach.py (verified in codebase)
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
    print(f'  [skip] Non-GF row excluded: {fund_label_on_this_row} — {label}', file=sys.stderr)
```

### Processor Sanity Band (Fresno)
```javascript
// Source: adapted from scripts/processOakland.js (verified in codebase)
// Fresno General Fund: ~$383M–$583M (±$100M around $483M target)
const GF_BAND_MIN = 383_000_000;
const GF_BAND_MAX = 583_000_000;
// Riverside General Fund: ~$1.1B–$1.8B per FY (±25% around $1.45B target)
const RIVERSIDE_BAND_MIN = 1_100_000_000;
const RIVERSIDE_BAND_MAX = 1_800_000_000;
```

### Enrichment Commands
```bash
# Source: scripts/enrichCategories.js --help (verified in codebase)
# Plan 4 — after both cities are loaded
node scripts/enrichCategories.js --city Fresno --state CA --year 2025 --dry-run
node scripts/enrichCategories.js --city Riverside --state CA --year 2025 --dry-run
# Estimate cost from dry-run before running live
# Combined gate: $0.10 — ask if approaching limit
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Post-hoc fund filtering in processor | Extraction-time filter in Python extractor | Phase 28 (D-06) | Cleaner separation; enterprise rows never enter the pipeline |
| Per-year processor invocation for biennial PDFs | Single-pass biennial extraction with per-page FY detection | Phase 28 (Oakland) | One run yields both FYs; no manual year flags needed |
| Manual PDF page range hard-coding | `find_fund_summary_page()` dynamic section detection | Phase 28 (Oakland) | Works across PDF versions with varying page numbers |
| No worktree support | `resolvePdfDir()` with git fallback | Phase 28 (Oakland) | Scripts work in both main tree and git worktrees |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Fresno PDF amounts are in full dollars (not thousands). | Pitfall 3 / Standard Stack | If amounts are in thousands, all totals will be 1000× too small; sanity band check will catch this |
| A2 | Riverside PDF amounts are in full dollars (not thousands). | Pitfall 3 / Standard Stack | Same as A1 — sanity band will catch; `toFullDollars()` can be added if needed |
| A3 | Fresno adopted budget PDFs are available for FY2020–FY2026 with consistent structure. | User Constraints D-01 | If only FY2022–2026 have consistent structure, that is still an acceptable depth (D-01 allows stopping at FY2022) |
| A4 | Riverside biennial PDFs are available for at least 3 biennials (~FY2020–2026). | User Constraints D-02 | If older biennials have incompatible format, depth will be shallower; this is explicitly acceptable per deferred section |
| A5 | Riverside biennial PDF table structure is similar enough to Oakland that extractOakland.py is the right template (per-page FY detection in column headers). | Architecture Patterns | If Riverside uses a fundamentally different layout (e.g., separate sections per FY rather than side-by-side columns), the extractor approach will need adaptation |
| A6 | Fresno and Riverside operating budget PDFs contain a revenue / sources-of-funds section extractable by the same extractor (best-effort). | D-07 / Pitfall 4 | If revenue section is absent or unclean, revenue load is deferred per D-07 — not a blocker |
| A7 | Neither Fresno nor Riverside municipality rows currently exist in treasury.municipalities. | Code Context section of CONTEXT.md | If rows already exist (e.g., from a failed prior attempt), `upsertMunicipality()` handles it idempotently |

---

## Open Questions

1. **Fresno PDF table structure: department-level or category-level?**
   - What we know: Fresno publishes an adopted budget PDF. Long Beach PDFs provided category-level expenditure summaries. Oakland PDFs provided department-level summaries. Fresno's structure is unknown until the PDF is examined.
   - What's unclear: Whether the General Fund section presents rows by department (like Oakland) or by expenditure category (like Long Beach). This determines which extractor pattern fits more closely.
   - Recommendation: Implementer downloads the FY2025 adopted budget PDF first, opens it, and identifies the General Fund summary table structure before writing extraction logic.

2. **Riverside PDF table structure and FY column layout**
   - What we know: Riverside is a biennial budget; Oakland's biennial uses side-by-side "FY23-24 Biennial / FY24-25 Biennial" columns in a Fund Summary table.
   - What's unclear: Whether Riverside uses the same side-by-side column layout, or whether each FY is in a separate section/page.
   - Recommendation: Implementer downloads the most recent biennial PDF and checks the fund summary layout before adapting `extractOakland.py`.

3. **Amount scale: full dollars or thousands?**
   - What we know: Oakland and Long Beach use full dollars. Fremont uses thousands. The `toFullDollars()` helper exists in `processFremont.js` for the thousands case.
   - What's unclear: Whether Fresno/Riverside PDFs express amounts in thousands.
   - Recommendation: During extractor development, spot-check one department: if Police shows `$483` instead of `$483,000,000`, the PDF uses thousands. Add `toFullDollars()` accordingly.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | pdfplumber extractors | ✓ | 3.14.3 | — |
| pdfplumber | PDF extraction | ✓ | (confirmed via import) | — |
| Node.js | processors, seeders | ✓ | 24.13.0 | — |
| @supabase/supabase-js | all DB scripts | ✓ | 2.101.1 | — |
| SUPABASE_SERVICE_KEY env var | all DB scripts | ✓ (inferred from .env) | — | Error: script exits with clear message |
| docs/Fresno/ directory | Plan 2 PDF extractor | ✗ | — | Create directory; download PDFs from Fresno city site |
| docs/Riverside/ directory | Plan 3 PDF extractor | ✗ | — | Create directory; download PDFs from Riverside city site |

**Missing dependencies with no fallback:** None — all code dependencies are present.

**Missing dependencies with fallback:**
- `docs/Fresno/` — must be created and PDFs downloaded before Plan 2 can run.
- `docs/Riverside/` — must be created and PDFs downloaded before Plan 3 can run.

---

## Validation Architecture

> `workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None formal — manual dry-run verification + sanity band checks |
| Config file | n/a |
| Quick run command | `node scripts/processFresno.js --dry-run` |
| Full suite command | `node scripts/processFresno.js --dry-run && node scripts/processRiverside.js --dry-run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-05 | Fresno GF operating total ~$483M, 1+ FYs | smoke (dry-run) | `node scripts/processFresno.js --dry-run` | ❌ Wave 0 |
| DATA-05 | Fresno revenue rows extracted | smoke (dry-run) | `node scripts/processFresno.js --dry-run --revenue` | ❌ Wave 0 |
| DATA-06 | Riverside GF operating ~$1.45B/yr, 2+ FYs from biennial | smoke (dry-run) | `node scripts/processRiverside.js --dry-run` | ❌ Wave 0 |
| DATA-06 | Riverside revenue rows extracted | smoke (dry-run) | `node scripts/processRiverside.js --dry-run --revenue` | ❌ Wave 0 |
| ENRICH-01 | Enrichment categories generated for both cities | smoke (dry-run) | `node scripts/enrichCategories.js --city Fresno --state CA --year 2025 --dry-run` | ✅ exists |
| POPUL-01 | Population values correct in DB | manual spot-check | Query `treasury.municipalities` for Fresno + Riverside population | ✅ via RPC |

### Sampling Rate
- **Per task commit:** `node scripts/processFresno.js --dry-run` (or `processRiverside.js --dry-run`)
- **Per wave merge:** Both dry-runs passing; DB spot-check via Supabase dashboard or `treasury_list_source_ids` RPC
- **Phase gate:** All 6 success criteria verified (city picker visible, correct totals, revenue tabs, per-capita, enrichment)

### Wave 0 Gaps
- [ ] `scripts/extractFresno.py` — covers DATA-05; created in Plan 2
- [ ] `scripts/processFresno.js` — covers DATA-05; created in Plan 2
- [ ] `scripts/extractRiverside.py` — covers DATA-06; created in Plan 3
- [ ] `scripts/processRiverside.js` — covers DATA-06; created in Plan 3
- [ ] `scripts/seedFresnoRiversideCA.js` — covers POPUL-01; created in Plan 1
- [ ] `docs/Fresno/` directory + PDFs — must be created before Plan 2
- [ ] `docs/Riverside/` directory + PDFs — must be created before Plan 3

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
| Command injection via PDF path | Tampering | PDF paths from `readdirSync(pdfDir)` — controlled directory, not user input; double-quoted in execSync shell string. Established pattern from processOakland.js (T-28-05) |
| Secret key logging | Information Disclosure | SUPABASE_SERVICE_KEY loaded via `loadEnv()`, never `console.log()`'d. Established pattern in all processors |
| Runaway API cost (enrichment) | Denial of Service | $0.10 combined gate (D-10); `--dry-run` required before live enrichment run |
| Oversized PDF buffer | Denial of Service | `maxBuffer: 8 * 1024 * 1024` cap on execSync — established pattern (T-28-04) |

---

## Sources

### Primary (HIGH confidence)
- `scripts/seedLongBeachBakersfieldCA.js` — canonical two-city seeder template; read in full
- `scripts/extractOakland.py` — canonical biennial extractor; read in full; Riverside template
- `scripts/extractLongBeach.py` — canonical single-year extractor; read in full; Fresno template
- `scripts/processOakland.js` — canonical processor with resolvePdfDir() + sanity band; read in full
- `scripts/processLongBeach.js` — single-year processor reference; read in full
- `scripts/processFremont.js` — toFullDollars() helper reference; read lines 58–61
- `.planning/phases/30-fresno-riverside-ca-data-load/30-CONTEXT.md` — all locked decisions (D-01 through D-10)
- `.planning/REQUIREMENTS.md` — DATA-05, DATA-06, ENRICH-01, POPUL-01 success criteria
- `.planning/STATE.md` — accumulated CA PDF extraction context, seeded cities list

### Secondary (MEDIUM confidence)
- Python 3.14.3 + pdfplumber availability: verified via `python --version` and `python -c "import pdfplumber"` [VERIFIED: local env]
- Node.js 24.13.0 + @supabase/supabase-js@2.101.1: verified via `node --version` and `npm list` [VERIFIED: local env]

### Tertiary (LOW confidence)
- Fresno and Riverside PDF structure (table layout, amount scale, fund label strings): not yet verified — PDFs have not been downloaded. All claims about expected patterns are [ASSUMED] based on training knowledge and analogy to Oakland/Long Beach.
- Fresno General Fund target ~$483M and Riverside ~$1.45B/year: sourced from REQUIREMENTS.md (DATA-05, DATA-06) which came from prior research [ASSUMED as baselines; actual PDF values confirm or refute].

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified locally, exact versions confirmed
- Architecture: HIGH — patterns directly verified in existing codebase scripts
- Pitfalls: HIGH — inferred from concrete code patterns and prior phase learnings documented in CONTEXT.md/STATE.md
- PDF structure for Fresno/Riverside: LOW — PDFs not yet downloaded; must be verified during implementation

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (stable stack; PDF structure unknown until download)
