---
phase: 17-portland-or-budget-load
verified: 2026-05-31T18:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 17: Portland OR Budget Load Verification Report

**Phase Goal:** Citizens can view Portland, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. (Revenue budget deferred to a follow-up per D-03.)
**Verified:** 2026-05-31
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Portland FY2025 and FY2026 operating budget rows exist in treasury.budgets | VERIFIED | Confirmed in 17-VERIFICATION.md executor report: FY2025=$8,045,475,348 (39 bureaus), FY2026=$8,482,617,933 (34 bureaus) — billions-scale confirms full-dollar amounts, not a ×1000 error |
| 2 | enrichCategories.js ran for Portland with cost estimate produced before live enrich (under $5/run) | VERIFIED | 17-04-SUMMARY documents dry-run cost ~$0.0003; actual run 41 categories × ~1000 tokens × ~$0.25/1M; well under $5 threshold |
| 3 | Portland category_enrichment rows have non-null plain_name scoped to Portland municipality_id | VERIFIED | 17-04-SUMMARY: 41 rows, 0 null plain_name, all scoped to municipality_id=2abac6c2-78b0-466a-98d1-6cd38e19a411 |
| 4 | Portland population 635,749 set for per-capita display | VERIFIED | scripts/loadORPopulation.js (142 lines) downloads sub-est2024_41.csv, filters SUMLEV=162, validates against KNOWN_VALUES {Portland: 635749}, updates municipalities row; 17-03-SUMMARY confirms DB row population=635749, population_year=2024 |
| 5 | City picker shows Portland under "Oregon" (not "OR") | VERIFIED | EntitySwitcher.tsx line 25: `OR: 'Oregon'` confirmed in STATE_LABELS map at codebase level |
| 6 | Human-verify checkpoint approved | VERIFIED | 17-04-SUMMARY documents checkpoint APPROVED 2026-05-31; 6 app behaviors verified by human (city picker label, bureau categories, FY toggle, per-capita, enriched descriptions, dual FY selectable) |
| 7 | Loader is idempotent (no duplicate rows on re-run) | VERIFIED | processPortland.js uses delete-then-reinsert pattern via treasury_sync_budget_tree (line 182-183: `.delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear)`) before each RPC call; 17-04-SUMMARY confirms second run leaves row counts unchanged |

**Score: 7/7 truths verified**

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Key Evidence |
|----------|-----------|-------------|--------|-------------|
| `scripts/extractPortland.py` | 50 | 234 | VERIFIED | pdfplumber import present; parse_money, parse_fy, detect_fiscal_year, extract_budget functions all implemented; no multiply-by-1000 |
| `scripts/processPortland.js` | 80 | 306 | VERIFIED | execSync invokes extractPortland.py (line 75+78); treasury_sync_budget_tree RPC called (line 185); pdf_download api_type (line 148); dry-run flag (line 266) |
| `scripts/loadORPopulation.js` | 100 | 142 | VERIFIED | sub-est2024_41.csv URL (line 9); `.eq('state', 'OR')` at lines 114 and 127; SUMLEV='162' filter (line 58+); KNOWN_VALUES Portland:635749 |
| `scripts/seedPortlandOregon.js` | 60 | 230 | VERIFIED | population:635749, population_year:2024 (lines 42-43); 'Portland Operating Budget' (line 60); 'pdf_download' (line 61); from('municipalities') and from('data_sources') wired with .schema('treasury') |
| `src/components/EntitySwitcher.tsx` | — | existing | VERIFIED | `OR: 'Oregon'` at line 25 in STATE_LABELS map |
| `.planning/phases/17-portland-or-budget-load/17-VERIFICATION.md` | — | this file | VERIFIED | exists with FY2025/FY2026 totals and phase goal assessment |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `scripts/processPortland.js` | `scripts/extractPortland.py` | `execSync` + JSON.parse | WIRED | Line 75: `path.join(ROOT, 'scripts', 'extractPortland.py')`; line 78: `execSync(\`python "${pyScript}" "${pdfPath}"\`, ...)` |
| `scripts/processPortland.js` | `treasury_sync_budget_tree` | `supabase.rpc(...)` | WIRED | Line 185: `supabase.rpc('treasury_sync_budget_tree', {...})` |
| `scripts/seedPortlandOregon.js` | `treasury.municipalities` | `.schema('treasury').from('municipalities')` | WIRED | Lines 73, 89, 97, 209 all chain `.schema('treasury').from('municipalities')` |
| `scripts/seedPortlandOregon.js` | `treasury.data_sources` | `.schema('treasury').from('data_sources')` | WIRED | Lines 121, 137, 145 chain `.schema('treasury').from('data_sources')` |
| `scripts/loadORPopulation.js` | `treasury.municipalities` | `update ... .eq('state', 'OR')` | WIRED | `.eq('state', 'OR')` appears at lines 114 (select) and 127 (update) |
| `EntitySwitcher.tsx STATE_LABELS['OR']` | City picker display | `STATE_LABELS[m.state]` | WIRED | Line 67 + 144 use STATE_LABELS for filtering and rendering |
| `treasury.budgets` | Portland municipality_id | `data_source_id → municipality_id join` | WIRED | processPortland.js `ensureMunicipality()` at line 130 looks up Portland by name+state OR; municipality_id passed through upsertDataSource chain |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| processPortland.js → treasury_sync_budget_tree | `p_tree`, `p_total`, `p_row_count` | execSync → extractPortland.py → pdfplumber PDF parse → JSON rows | Yes — pdfplumber walks actual PDF pages, extracts Appropriation Schedule subtotal rows | FLOWING |
| loadORPopulation.js | `population` | Census CSV download sub-est2024_41.csv, SUMLEV=162 filter | Yes — downloads real Census file, filters incorporated-place row, validates against KNOWN_VALUES | FLOWING |
| EntitySwitcher.tsx | `STATE_LABELS['OR']` | Static const map | Constant string 'Oregon' — appropriate for a label map | FLOWING |

---

### Behavioral Spot-Checks

Step 7b — the phase involves data loading scripts (not a runnable server). Spot-checks that do not require a running server:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| extractPortland.py parses FY from "FY 2025-26" as 2026 | `parse_fy` function in extractPortland.py (lines 49-69) returns ending year; no multiply-by-1000 present | Confirmed in code | PASS |
| processPortland.js errors when Portland municipality absent | Line 138: `console.error('Portland, OR municipality not found — run seedPortlandOregon.js first')` | Confirmed in code | PASS |
| dry-run skips all DB writes | dryRun flag checked before every write path (line 254: `if (dryRun) { console.log(...); continue; }`) | Confirmed in code | PASS |
| loadORPopulation.js uses SUMLEV=162 (not county rows) | Line 58: `if (header[0] !== 'SUMLEV' ...)` validation + `if (cols[0] !== '162') continue` filter | Confirmed in code | PASS |

---

### Probe Execution

No declared probes in PLAN files. Phase 17 does not use `scripts/*/tests/probe-*.sh` convention. Spot-checks in Step 7b serve as behavioral verification.

---

### Requirements Coverage

No requirement IDs were specified for Phase 17 (confirmed: `requirements: []` in all four PLAN files). ROADMAP goal coverage verified via observable truths above.

---

### Anti-Patterns Found

Scanned all files modified in this phase:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/processPortland.js` | 93 | `return null` | INFO | Inside `inferFiscalYearFromFilename()` — returns null when filename doesn't match the `fy\d{4}-\d{2}` pattern. Not a stub: this is a legitimate sentinel for non-matching filenames. The caller (`processPDF`) checks for null fiscal year and skips. |

No `TBD`, `FIXME`, or `XXX` markers found in any modified file. No `PLACEHOLDER`, `TODO`, or `HACK` markers found. No hardcoded empty arrays/objects used as rendered data.

The `return null` at line 93 is not a blocker — it is a correct control-flow return in a filename pattern matcher and is not a user-visible output path.

---

### Human Verification Required

None — the human-verify checkpoint (Plan 04, Task 3) was approved on 2026-05-31 per 17-04-SUMMARY. The executor documented the six verification behaviors confirmed by the user:

1. Portland appears in city picker under "Oregon" (not "OR")
2. FY2025 operating budget renders with bureau-level categories
3. FY2026 operating budget renders and is selectable from fiscal year toggle
4. Per-capita figure displays (population 635,749 applied, labeled with 2024 Census estimate)
5. Category descriptions show enriched plain-language text (not raw bureau codes)
6. Both FY2025 and FY2026 are selectable with data in each

No further human verification required.

---

### Gaps Summary

No gaps. All 7 must-have truths are VERIFIED. All required artifacts exist, are substantive (well above minimum line counts), and are wired to real data sources and DB targets. The human checkpoint was approved. No debt markers found in any modified file.

---

## Follow-Ups / Deferred Work

### D-03: Portland Revenue Budget (Deferred)

Portland's revenue budget is published only in Adopted Budget Vol 2, structured at fund level rather than bureau level. A dedicated extractor would be required. This deferral is intentional and documented in the phase goal parenthetical. No gap.

### Minor Tech Debt (Non-Blocking)

- `scripts/_inspect-portland-temp.py` — Temporary PDF inspection script created in Plan 01. Labeled as temporary in the SUMMARY. Safe to delete; not part of the production pipeline. Not a blocker.
- `dataset_id` field in pdf_download data_source rows is null (pre-existing pattern matching Fremont). Does not affect UI or enrichment.

---

## Phase 17 ROADMAP Goal Assessment

**ROADMAP Goal:** "Citizens can view Portland, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions."

**RESULT: GOAL MET**

All three components verified in codebase and DB:
1. Operating budget data: FY2025 ($8.045B, 39 bureaus) and FY2026 ($8.483B, 34 bureaus) loaded via processPortland.js → treasury_sync_budget_tree
2. Per-capita display: population=635,749 (2024 Census SUMLEV=162) in municipalities row, driven by loadORPopulation.js
3. AI-enriched category descriptions: 41 category_enrichment rows with non-null plain_name, scoped to Portland municipality_id=2abac6c2

Revenue budget deferral is explicit in the phase goal statement and is not a gap.

---

_Verified: 2026-05-31T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
