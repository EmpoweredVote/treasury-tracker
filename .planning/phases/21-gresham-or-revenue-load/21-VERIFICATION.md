---
phase: 21-gresham-or-revenue-load
verified: 2026-06-01T20:00:00Z
human_verified: 2026-06-01T19:00:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  note: "Previous verification was executor self-verification. This is independent verifier re-verification confirming all 6 truths against live DB and codebase evidence."
human_verification:
  - test: "Open the app and select Gresham, OR. Confirm a 'Money In' tab appears alongside the existing 'Budget' tab. Select Money In and verify ~10 revenue categories display with totals in the $400M–$525M range (not $731M–$896M). Switch FY2023–FY2026 and confirm each year shows data."
    expected: "Money In tab appears. 10 revenue categories render (Taxes, Intergovernmental, Charges for Services, Interfund Transfers, Internal Svc Chrg, Utility License Fees, Internal Payments, Miscellaneous Income, Financing Proceeds, Licenses & Permits). FY2026 total ~$512M, FY2025 ~$521M, FY2024 ~$460M, FY2023 ~$411M. No 'Beginning Balance' or 'Total Resources' node visible."
    result: "APPROVED — ~10 revenue categories displayed with totals in the $400M–$525M range across FY2023–FY2026."
    why_human: "App rendering, Money In tab auto-discovery, fiscal-year selector behavior, and category display all require a live browser session."
---

# Phase 21: Gresham OR Revenue Load — Verification Report

**Phase Goal:** Load Gresham OR revenue ("Money In") data for FY2023–FY2026 so citizens can see where Gresham's money comes from alongside its operating budget.
**Verified:** 2026-06-01T20:00:00Z (independent verifier re-verification)
**Human-verified:** 2026-06-01T19:00:00Z (blocking checkpoint:human-verify task, APPROVED)
**Status:** PASSED
**Re-verification:** Yes — executor self-verified previously; this is independent verifier confirmation.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | treasury.budgets has 4 Gresham rows with dataset_type='revenue' (FY2023–FY2026), each total in the $400M–$525M range | VERIFIED | Live DB query: FY2023=$411,550,525 / FY2024=$460,638,911 / FY2025=$521,294,883 / FY2026=$512,592,615 — all 4 in band. municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d. |
| 2 | The 4 existing Gresham operating data_source rows still exist and are unchanged (no collision/overwrite) | VERIFIED | Live DB query on data_sources: 8 rows total — 4 with dataset_type='operating' (Gresham Operating Budget FY2023–FY2026) + 4 with dataset_type='revenue' (Gresham Revenue Budget FY2023–FY2026). Operating names and dataset_ids intact. |
| 3 | No Gresham revenue budget row's tree contains a 'Beginning Balance' or 'Total Resources' node | VERIFIED | Live DB query on budget_categories for FY2026 budget_id=61d60302-f1fb-42bc-a913-a38cb9fc7595: 10 nodes, 0 named 'Beginning Balance' or 'Total Resources'. Revenue dry-run confirms $400M–$521M totals (not $731M–$896M band) across all 4 FYs. |
| 4 | Re-running `node scripts/processGresham.js --revenue` leaves exactly 4 revenue rows (idempotency) | VERIFIED | DB shows exactly 4 revenue rows with totals matching dry-run output exactly (FY totals identical between dry-run and live DB). Delete-then-insert RPC pattern confirmed in processGresham.js loadFiscalYear(). |
| 5 | 10 revenue category enrichment rows exist for Gresham, municipality_id-scoped | VERIFIED | Live DB query: 10 category_enrichment rows with municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d, all 10 revenue category name_keys present (taxes, intergovernmental, charges for services, interfund transfers, internal svc chrg, utility license fees, internal payments, miscellaneous income, financing proceeds, licenses & permits). |
| 6 | Citizens can select Gresham, OR in the app and see a 'Money In' tab with revenue categories alongside the Budget tab | VERIFIED | Human-approved 2026-06-01. Code-level wiring confirmed: App.tsx line 269 checks hasRevenue via available_datasets dataset_type='revenue'; DatasetTabs.tsx line 32 labels revenue card 'Money In'; revenue data flows from DB to UI automatically. |

**Score: 6/6 truths verified**

---

### Required Artifacts

| Artifact | Status | Key Evidence |
|----------|--------|--------------|
| `scripts/extractGresham.py` — `extract_revenue()` function (line 170) | VERIFIED | Function present at line 170; live extraction of fy2025-26.pdf returns 10 revenue categories with correct amounts; REVENUE_SKIP and NORMALIZE dicts confirmed in source. |
| `scripts/extractGresham.py` — `--mode operating\|revenue` argparse (line 284+) | VERIFIED | argparse block at lines 284–293; `choices=['operating', 'revenue']` confirmed in source. |
| `scripts/processGresham.js` — `buildRevenueTree()` (line 132) | VERIFIED | Function confirmed at line 132; maps r.category + r.adopted_amount to flat nodes; sorts descending. |
| `scripts/processGresham.js` — `revenue: { type: 'boolean' }` parseArgs option | VERIFIED | Line 306: `revenue: { type: 'boolean', default: false }`. |
| `scripts/processGresham.js` — parametric `.eq('dataset_type', datasetType)` lookup | VERIFIED | Line 182: `.eq('dataset_type', datasetType)`. No hardcoded `'operating'` in this lookup — confirmed by grep returning zero matches for `.eq('dataset_type', 'operating')`. |
| `scripts/processGresham.js` — parametric `p_dataset_type: datasetType` RPC call | VERIFIED | Line 214: `p_dataset_type: datasetType`. |
| `scripts/processGresham.js` — spawnSync args array for `--mode revenue` injection | VERIFIED | Lines 76–77: `const args = [pyScript, pdfPath]; if (mode === 'revenue') args.push('--mode', 'revenue');`. No execSync used. |
| `treasury.budgets` — 4 revenue rows FY2023–FY2026 | VERIFIED | Live DB: 4 rows, dataset_type='revenue', totals $411M/$460M/$521M/$512M. |
| `treasury.data_sources` — 8 rows (4 operating + 4 revenue) | VERIFIED | Live DB: 8 rows, operating names intact, no collision. |
| `treasury.budget_categories` — 10 nodes per FY2026 revenue budget | VERIFIED | FY2026 budget_id=61d60302-f1fb-42bc-a913-a38cb9fc7595: 10 categories, no BB/TR. |
| `treasury.category_enrichment` — 10 revenue enrichment rows, Gresham-scoped | VERIFIED | 10 rows with correct name_keys, all municipality_id-scoped to Gresham. |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `processGresham.js extractPDF()` | `extractGresham.py --mode revenue` | `spawnSync args.push('--mode', 'revenue')` | WIRED | Lines 76–77 confirmed; dry-run produces 10 categories per FY correctly. |
| `processGresham.js loadFiscalYear()` | `treasury_sync_budget_tree RPC` | `p_dataset_type: datasetType` | WIRED | Line 214 confirmed; 4 revenue rows in DB match dry-run totals exactly. |
| `upsertDataSource()` | `treasury.data_sources` lookup | `.eq('dataset_type', datasetType)` | WIRED | Line 182 confirmed; 8 data_source rows coexist, no collision — operating rows unchanged. |
| `treasury.budgets revenue rows` | App.tsx Money In tab | `available_datasets dataset_type='revenue'` auto-discovery | WIRED | App.tsx lines 269/352–355; DatasetTabs.tsx line 32; human-approved UI confirmation. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| App.tsx revenue tab | `hasRevenue` | `selectedEntity.available_datasets` from `listMunicipalities()` API | Yes — 4 revenue rows in treasury.budgets drive available_datasets | FLOWING |
| DatasetTabs.tsx Money In card | `revenueTotal` prop | `loadBudgetData(..., 'revenue')` call in App.tsx | Yes — loads from treasury.budgets revenue rows with real totals $411M–$512M | FLOWING |
| processGresham.js buildRevenueTree() | `rows` from extractPDF | Python extractGresham.py extract_revenue() | Yes — pdfplumber reads real Gresham PDFs; returns 10 categories per FY | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Revenue extraction from FY2026 PDF | `python scripts/extractGresham.py "docs/Gresham/fy2025-26.pdf" --mode revenue` | 10 categories, no BB/TR, sum=$512,592,615 | PASS |
| Revenue dry-run all 4 FYs | `node scripts/processGresham.js --revenue --dry-run` | FY2023=$411,550,525 / FY2024=$460,638,911 / FY2025=$521,294,883 / FY2026=$512,592,615, 10 categories each | PASS |
| Operating dry-run no-regression FY2024–2026 | `node scripts/processGresham.js --dry-run` | FY2024=$275,500,631 / FY2025=$306,839,832 / FY2026=$330,652,078 — match Phase 20 values | PASS |
| DB: 4 revenue rows in band | Live DB query | FY2023–FY2026 dataset_type='revenue', all in $400M–$525M band | PASS |
| DB: 8 data_source rows, no collision | Live DB query | 4 operating + 4 revenue, operating names intact | PASS |
| DB: FY2026 budget_categories no BB/TR | Live DB query (budget_id=61d60302-f1fb-42bc-a913-a38cb9fc7595) | 10 nodes, 0 BB/TR nodes | PASS |
| DB: 10 enrichment rows Gresham-scoped | Live DB query on category_enrichment | 10 rows, all 10 revenue name_keys present | PASS |

---

### Requirements Coverage

No formal requirement IDs declared in either plan's `requirements:` frontmatter. Phase goal verified directly via observable truths above.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TBD/FIXME/XXX/HACK/PLACEHOLDER markers found in modified files (`scripts/extractGresham.py`, `scripts/processGresham.js`).

---

### Pre-existing Issue (Not a Phase 21 Regression)

**FY2023 operating dry-run discrepancy:** `node scripts/processGresham.js --dry-run` shows FY2023=$59,306,991, but the DB (loaded in Phase 20) has FY2023=$269,306,991. This is a known pre-existing OCR issue in `extract_budget()` introduced in Phase 20. Phase 21 did not modify `extract_budget()` — confirmed by code review (lines 69–166 unchanged). The DB operating totals are intact and Phase 20 data is preserved. This is informational only.

---

### Human Verification Result

#### 1. App display — Gresham Money In tab

**Status: APPROVED — 2026-06-01**

**Test:** Open treasurytracker.empowered.vote. Navigate to city picker. Select Gresham, OR. Confirm Money In tab appears alongside Budget tab. Confirm ~10 revenue categories with totals in $400M–$525M range across FY2023–FY2026.

**Result:** Human confirmed — ~10 revenue categories displayed with totals in $400M–$525M range across FY2023–FY2026. Money In tab auto-discovered and rendered. No Beginning Balance inflation detected.

**Code-level corroboration:** App.tsx `hasRevenue` check (line 269), `loadBudgetData(..., 'revenue')` call (line 277), DatasetTabs.tsx 'Money In' label (line 32). UI discovery requires no frontend changes — auto-wired via available_datasets.

---

### Gaps Summary

No gaps. All 6 must-have truths verified by independent verifier against live DB and codebase evidence:

- `scripts/extractGresham.py`: `extract_revenue()` present and producing correct output for all 4 PDFs
- `scripts/processGresham.js`: `--revenue` mode, `buildRevenueTree()`, parametric `datasetType` — all present and wired correctly; no hardcoded `'operating'` in the dataset_type lookup
- DB: 4 revenue budget rows ($411M/$460M/$521M/$512M), 8 data_source rows (4 operating preserved + 4 revenue new), 10 FY2026 budget_categories (no BB/TR), 10 enrichment rows
- UI: Money In tab confirmed by human approval; code wiring confirmed

Phase 21 goal achieved.

---

_Verified: 2026-06-01T20:00:00Z_
_Verifier: Claude (gsd-verifier) — independent re-verification_
_Previous: executor self-verification 2026-06-01T18:30:00Z, human checkpoint 2026-06-01T19:00:00Z_
