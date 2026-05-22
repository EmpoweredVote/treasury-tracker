---
phase: 12-prosper-celina-revenue
verified: 2026-05-22T00:00:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 12: Prosper + Celina Revenue Verification Report

**Phase Goal:** Citizens can see revenue data for Prosper and Celina, extracted via pdftotext targeting the "STATEMENT OF REVENUES" section and validated against published ACFR totals before display is enabled.
**Verified:** 2026-05-22
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Prosper revenue visible for FY2023/2024/2025 with fund breakdowns | VERIFIED | DB: 3 revenue budget rows; FY2023=35 categories, FY2024=48, FY2025=47; `last_synced_at` set; `is_enabled=true` |
| 2 | Celina revenue visible for FY2025 with fund/source breakdowns | VERIFIED | DB: 1 revenue budget row; 14 categories (Ad valorem taxes, Sales tax, Permits, etc.); `last_synced_at` set; `is_enabled=true` |
| 3 | Prosper ACFR validation passed (within 20% tolerance) | VERIFIED | 12-01-SUMMARY.md: FY2023=0.1%, FY2024=11.6%, FY2025=1.1% — all pass |
| 4 | Celina ACFR validation passed (within 20% tolerance) | VERIFIED | 12-03-SUMMARY.md: 8.0% diff ($139.9M extracted vs $129.6M expected) — pass |
| 5 | Per-capita revenue figures visible in app for both cities | VERIFIED | PlainLanguageSummary.tsx line 262–266: `revenueTarget / population` renders when `population > 0 && revenueTarget > 0`; Prosper population=44,503, Celina population=51,661 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/processProsperjRevenuePDF.js` | Prosper ACFR PDF extractor | VERIFIED | 1,035 lines; targets `STATEMENT OF REVENUES, EXPENDITURES`; pendingRow pattern; overflow guard (>105% of REVENUES header); per-FY processing |
| `scripts/processCelinaRevenuePDF.js` | Celina ACFR PDF extractor | VERIFIED | 560 lines; targets `Statement of Revenues, Expenditures and Changes in Fund Balances`; character-position column detection; validation gate |
| `treasury.budgets` Prosper revenue rows | 3 rows (FY2023/24/25) | VERIFIED | FY2023=$83,186,603, FY2024=$101,863,293, FY2025=$108,416,768 — all within $80-110M range |
| `treasury.budgets` Celina revenue rows | 1 row (FY2025) | VERIFIED | FY2025=$139,947,357 (8.0% diff vs $129,568,278 expected) |
| `treasury.municipalities` population | Prosper and Celina > 0 | VERIFIED | Prosper=44,503, Celina=51,661 |
| `treasury.data_sources` last_synced_at | All 4 revenue sources set | VERIFIED | Prosper FY2023/24/25 set 2026-05-22T06:22:58-06:23:01Z; Celina FY2025 set 2026-05-22T03:12:09Z |
| `src/components/dashboard/PlainLanguageSummary.tsx` | Revenue per-capita display | VERIFIED | Lines 262–266: renders `{formatPerResident(revenueTarget / population)} per resident` when population > 0 and revenue > 0 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `processProsperjRevenuePDF.js` | `treasury.budgets` | `upsert_budget_with_categories` RPC | VERIFIED | Script calls RPC, sets `last_synced_at` inline after success |
| `processCelinaRevenuePDF.js` | `treasury.budgets` | `upsert_budget_with_categories` RPC + `last_synced_at` update | VERIFIED | Lines 492–555; both RPC call and sync timestamp confirmed |
| `PlainLanguageSummary.tsx` | population data | `population` prop (> 0 guard) | VERIFIED | `!isNonprofit && population > 0 && revenueTarget > 0` guards render at line 262 |
| `PlainLanguageSummary.tsx` | revenue total | `revenueData.metadata.totalBudget` → `revenueTarget` | VERIFIED | Line 99 extracts `revenueTarget`; used in per-capita render at line 264 |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| Prosper revenue FY2023–FY2025 in DB | SATISFIED | 3 budget rows + categories |
| Celina revenue FY2025 in DB | SATISFIED | 1 budget row + 13 line item categories |
| ACFR validation before load | SATISFIED | Both scripts enforce 20% tolerance gate; reject if exceeded |
| Per-capita revenue in UI | SATISFIED | PlainLanguageSummary shows $/resident when population data exists |
| `last_synced_at` set (enables display) | SATISFIED | All 4 data_sources have `last_synced_at` non-null and `is_enabled=true` |

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder patterns in any of the three key files. No stub returns. No empty handlers.

---

### Human Verification Required

The following were human-verified during phase execution per 12-02-SUMMARY.md and 12-03-SUMMARY.md:

1. **Prosper revenue display** — Human approved 2026-05-22: revenue visible for FY2023/2024/2025 with per-capita ($/resident) showing.
2. **Celina revenue display** — Human approved 2026-05-22: FY2025 revenue and per-capita ($/resident) visible.

These were verified live against the app at treasurytracker.empowered.vote and are documented in the phase summaries. No additional human verification needed for this verification pass.

---

## DB Evidence Summary

```
Prosper municipality_id: 35bbfa9d-63a5-4d08-8c4b-f609db54e9d9  population: 44,503
Celina  municipality_id: 7bb0a0e7-9be3-44bf-9676-b5af67de0d2a  population: 51,661

treasury.budgets — revenue rows:
  Prosper FY2023: $83,186,603   (in $80-110M range: YES)
  Prosper FY2024: $101,863,293  (in $80-110M range: YES)
  Prosper FY2025: $108,416,768  (exact match to expected $108,416,768: YES)
  Celina  FY2025: $139,947,357  (8.0% diff vs $129,568,278: PASS)

treasury.data_sources — revenue sources (all is_enabled=true, last_synced_at set):
  bd681a06  Prosper Revenue FY2023  last_synced: 2026-05-22T06:22:58Z  rows_synced: 86
  bd441b15  Prosper Revenue FY2024  last_synced: 2026-05-22T06:22:59Z  rows_synced: 100
  260206a2  Prosper Revenue FY2025  last_synced: 2026-05-22T06:23:01Z  rows_synced: 68
  0e2e54c5  Celina  Revenue FY2025  last_synced: 2026-05-22T03:12:09Z  rows_synced: 28
```

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
