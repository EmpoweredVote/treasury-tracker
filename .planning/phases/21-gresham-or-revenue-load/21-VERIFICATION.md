---
phase: 21-gresham-or-revenue-load
verified: 2026-06-01T18:30:00Z
status: human_needed
score: 5/6 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Open the app and select Gresham, OR. Confirm a 'Money In' tab appears alongside the existing 'Budget' tab. Select Money In and verify ~10 revenue categories display with totals in the $400M–$525M range (not $731M–$896M). Switch FY2023–FY2026 and confirm each year shows data."
    expected: "Money In tab appears. 10 revenue categories render (Taxes, Intergovernmental, Charges for Services, Interfund Transfers, Internal Svc Chrg, Utility License Fees, Internal Payments, Miscellaneous Income, Financing Proceeds, Licenses & Permits). FY2026 total ~$512M, FY2025 ~$521M, FY2024 ~$460M, FY2023 ~$411M. No 'Beginning Balance' or 'Total Resources' node visible."
    why_human: "App rendering, Money In tab auto-discovery, fiscal-year selector behavior, and category display all require a live browser session."
---

# Phase 21: Gresham OR Revenue Load — Verification Report

**Phase Goal:** Load Gresham revenue (Money In) data for FY2023–FY2026 so citizens can view it alongside the operating budget in the app.
**Verified:** 2026-06-01T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification by executor

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | treasury.budgets has 4 Gresham rows with dataset_type='revenue' (FY2023–FY2026), each total in the $400M–$525M range | VERIFIED | Live DB query: FY2023=$411,550,525, FY2024=$460,638,911, FY2025=$521,294,883, FY2026=$512,592,615 — all 4 in band. municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d |
| 2 | The 4 existing Gresham operating data_source rows still exist and are unchanged after the revenue load (no collision/overwrite) | VERIFIED | Live DB query on data_sources: 8 rows total — 4 with dataset_type='operating' (Gresham Operating Budget FY2023–FY2026) + 4 with dataset_type='revenue' (Gresham Revenue Budget FY2023–FY2026). Operating names intact. |
| 3 | No Gresham revenue budget row's tree contains a 'Beginning Balance' or 'Total Resources' node | VERIFIED | Live DB query on treasury.budget_categories for FY2026 revenue budget_id=61d60302-f1fb-42bc-a913-a38cb9fc7595: 10 nodes, none named 'Beginning Balance' or 'Total Resources'. Verified for all FYs via dry-run (totals in $400M–$521M band, not $731M–$896M). |
| 4 | Re-running `node scripts/processGresham.js --revenue` leaves exactly 4 revenue rows (idempotency) | VERIFIED | Second live run executed; DB query after re-run still shows exactly 4 revenue rows with identical totals. Delete-then-insert RPC pattern confirmed working. |
| 5 | 10 revenue category enrichment rows exist for Gresham, municipality_id-scoped | VERIFIED | enrichCategories.js ran for FY2026 (--year 2026), 10 categories enriched, 0 failures. Plain-name descriptions generated (e.g., "Borrowed Money for Projects" for Financing Proceeds, "Money From Other Governments" for Intergovernmental). All scoped to municipality_id=5d4675f1-c207-4d7b-a346-85a799da0d4d. |
| 6 | Citizens can select Gresham, OR and see a 'Money In' tab with revenue categories alongside the Budget tab | HUMAN NEEDED | DB backend confirmed. App display (Money In tab auto-display, category rendering, fiscal-year selector) requires live browser verification. |

**Score: 5/6 truths verified (Truth 6 requires human confirmation)**

---

### Required Artifacts

| Artifact | Status | Key Evidence |
|----------|--------|--------------|
| `scripts/processGresham.js` — `--revenue` flag + `buildRevenueTree()` | VERIFIED | Live run confirmed; 4 FYs × 10 categories loaded. parametric `datasetType` prevents collision. |
| `scripts/extractGresham.py` — `extract_revenue()` + `--mode revenue` | VERIFIED | Dry-run: 4 PDFs produce 10 categories each, totals $411M–$521M |
| `treasury.budgets` — 4 revenue rows | VERIFIED | Live DB: FY2023–FY2026 with correct totals |
| `treasury.data_sources` — 4 revenue rows + 4 operating rows intact | VERIFIED | Live DB: 8 rows total, no collision |
| `treasury.budget_categories` — 10 nodes per FY revenue budget | VERIFIED | FY2026 query: 10 categories, no Beginning Balance/Total Resources |
| `treasury.category_enrichment` — revenue enrichment rows | VERIFIED | 10 rows enriched (FY2026 pass), all scoped to Gresham municipality_id |
| `.planning/phases/21-gresham-or-revenue-load/21-VERIFICATION.md` | VERIFIED (this file) | Contains dataset_type='revenue' evidence, 4 FY totals, DB query results |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `scripts/processGresham.js --revenue` | `scripts/extractGresham.py --mode revenue` | spawnSync args array | WIRED | Live run: Python extractor called with ['--mode', 'revenue']; 10 categories returned per PDF |
| `scripts/processGresham.js` | `treasury_sync_budget_tree RPC` | supabase.rpc(..., p_dataset_type='revenue') | WIRED | Live run: "Inserted: 10 rows" for each FY; DB confirms 4 revenue budget rows |
| `treasury.budgets revenue rows` | App.tsx Money In tab | available_datasets dataset_type='revenue' auto-discovery | PENDING HUMAN | DB backend confirmed; UI rendering requires browser verification |
| `upsertDataSource()` | dataset_type parametric lookup | .eq('dataset_type', datasetType) | WIRED | Live run: 8 data_source rows with correct type separation; no operating row overwritten |

---

### Revenue Totals (DB Verified)

| Fiscal Year | Revenue Total | Categories | In $400M–$525M Band |
|-------------|--------------|------------|---------------------|
| FY2023 | $411,550,525 | 10 | YES |
| FY2024 | $460,638,911 | 10 | YES |
| FY2025 | $521,294,883 | 10 | YES |
| FY2026 | $512,592,615 | 10 | YES |

**FY2026 revenue categories (DB-verified, sorted by amount):**

| Rank | Category | Amount | % of Total |
|------|----------|--------|------------|
| 1 | Intergovernmental | $121,615,000 | 23.7% |
| 2 | Interfund Transfers | $102,399,000 | 20.0% |
| 3 | Charges for Services | $95,753,000 | 18.7% |
| 4 | Taxes | $52,949,000 | 10.3% |
| 5 | Internal Svc Chrg | $40,595,515 | 7.9% |
| 6 | Utility License Fees | $27,726,000 | 5.4% |
| 7 | Internal Payments | $27,143,000 | 5.3% |
| 8 | Miscellaneous Income | $20,833,100 | 4.1% |
| 9 | Financing Proceeds | $19,078,000 | 3.7% |
| 10 | Licenses & Permits | $4,501,000 | 0.9% |

---

### Enrichment Decision

**Decision: RUN (executed live)**

Revenue category names are mostly plain English, but 4 categories benefit from enrichment for non-finance citizens:
- "Internal Svc Chrg" → "Internal Service Charges" (opaque abbreviation)
- "Financing Proceeds" → "Borrowed Money for Projects" (jargon)
- "Interfund Transfers" → "Money Moving Between City Funds" (accounting term)
- "Utility License Fees" → "Business License Revenue" (clarifies scope)

**Cost estimate:** 10 categories × ~$0.001/call = ~$0.01. Well under the $5 threshold.
**Result:** 10 categories enriched, 0 failures. All scoped to Gresham municipality_id.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live load succeeds for all 4 FYs | `node scripts/processGresham.js --revenue` | 4 PDFs processed, 10 rows inserted per FY | PASS |
| Revenue totals in expected band | DB query (treasury.budgets WHERE dataset_type='revenue') | FY2023–FY2026: $411M, $460M, $521M, $512M | PASS |
| 8 data_source rows (4 op + 4 rev) | DB query (treasury.data_sources WHERE municipality_id=...) | 8 rows; operating names intact | PASS |
| No Beginning Balance in FY2026 tree | DB query (treasury.budget_categories WHERE budget_id=61d60302...) | 10 categories, no BB or TR node | PASS |
| Idempotent re-run | Second `node scripts/processGresham.js --revenue` | Still exactly 4 revenue budget rows | PASS |
| Enrichment for 10 categories | `node scripts/enrichCategories.js --city Gresham --state OR --year 2026` | 10 enriched, 0 failed | PASS |
| Dry-run verification | `node scripts/processGresham.js --revenue --dry-run` | 4 FYs × 10 categories, totals match live DB | PASS |

---

### Human Verification Required

#### 1. App display — Gresham Money In tab

**Test:** Open the app at treasurytracker.empowered.vote (or `npm run dev`). Navigate to the city picker. Select Gresham, OR.

**Expected:**
1. Gresham appears in the picker listed under "Oregon", alongside Portland
2. A "Money In" tab appears next to the existing "Budget" tab
3. Select the Money In tab — ~10 revenue categories render (Taxes, Intergovernmental, Charges for Services, etc.)
4. Revenue total per fiscal year is in the $400M–$525M range (FY2026 ~$512M, FY2025 ~$521M, FY2024 ~$460M, FY2023 ~$411M)
5. No "Beginning Balance" or "Total Resources" row visible (those inflate to $731M–$896M)
6. Fiscal-year selector shows FY2023–FY2026 with revenue data for each year
7. Enriched descriptions appear where applicable (e.g., "Borrowed Money for Projects" for Financing Proceeds)

**Why human:** App rendering, Money In tab auto-discovery, and fiscal-year selector behavior all require a live browser session.

---

### Gaps Summary

No blocking gaps found. All backend deliverables verified:

- 4 Gresham PDFs on disk (from Phase 20) — no re-download needed
- scripts/extractGresham.py: extract_revenue() function verified for all 4 PDFs
- scripts/processGresham.js: --revenue mode, buildRevenueTree(), parametric dataset_type
- DB: 4 revenue budget rows (correct totals), 8 data_source rows (4 op preserved + 4 rev new)
- DB: 10 budget_categories per FY2026 revenue budget (no exclusion violations)
- DB: 10 enrichment rows for revenue categories

The single remaining item is human confirmation that the app UI correctly auto-discovers and renders the Money In tab.

---

_Verified: 2026-06-01T18:30:00Z_
_Verifier: Claude (gsd-executor)_
