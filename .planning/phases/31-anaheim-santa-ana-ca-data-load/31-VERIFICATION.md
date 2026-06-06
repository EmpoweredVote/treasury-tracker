---
phase: 31-anaheim-santa-ana-ca-data-load
verified: 2026-06-06T04:00:00Z
status: passed
score: 6/6 success criteria verified
overrides_applied: 0
re_verification: null
gaps: []
deferred:
  - truth: "Anaheim revenue rows loaded"
    addressed_in: "Completed — not deferred"
    evidence: "31-02-SUMMARY confirms FY2025 revenue 12 rows ($649,457,438) and FY2026 revenue 12 rows ($644,677,022) loaded via processAnaheim.js; DATA-08 satisfied"
  - truth: "Santa Ana revenue rows loaded"
    addressed_in: "Completed — not deferred"
    evidence: "31-03-SUMMARY confirms FY2023–FY2026 revenue (9–10 rows per FY, $392M–$413M per FY) loaded via processSantaAna.js; DATA-09 satisfied"
human_verification:
  - test: "Open treasurytracker.empowered.vote and confirm both Anaheim and Santa Ana appear in the city picker under California"
    expected: "Both cities listed under California in the city picker"
    why_human: "App display cannot be verified by code inspection — requires browser access to the live app"
    outcome: "APPROVED — Plan 04 Task 2 human spot-check confirmed on 2026-06-06: all 6 criteria passed"
  - test: "Select Anaheim CA in the app and confirm operating budget total reflects GF scope (~$491M for FY2025, NOT ~$2.3B all-funds)"
    expected: "Anaheim operating total ~$491M–$530M (GF only); enterprise utility funds NOT blended in"
    why_human: "Rendered totals in the app UI require visual confirmation"
    outcome: "APPROVED — human spot-check confirmed Anaheim GF scope correct"
  - test: "Select Santa Ana CA in the app and confirm at least one fiscal year of GF operating data (~$407M for FY2025)"
    expected: "Santa Ana shows GF operating data for FY2023–FY2026 (~$403M–$424M per FY)"
    why_human: "Year selector and rendered totals require browser confirmation"
    outcome: "APPROVED — human spot-check confirmed Santa Ana GF data visible"
  - test: "Confirm Revenue / Money In tabs are populated for both cities"
    expected: "Anaheim: FY2025 ($649M) and FY2026 ($644M); Santa Ana: FY2023–FY2026 ($392M–$413M per FY)"
    why_human: "Revenue tab rendering requires visual verification in the app"
    outcome: "APPROVED — human spot-check confirmed revenue tabs populated for both cities"
  - test: "Confirm per-capita ($/resident) displays for both cities"
    expected: "Anaheim per-capita based on ~348K population; Santa Ana per-capita based on ~335K population"
    why_human: "Per-capita display requires visual verification in the app"
    outcome: "APPROVED — human spot-check confirmed per-capita visible for both cities"
  - test: "Confirm enrichment descriptions are visible for top operating categories in both cities"
    expected: "Categories like Police, Fire, Parks show plain-language descriptions, not empty/null"
    why_human: "Enrichment text rendering requires browser verification"
    outcome: "APPROVED — human spot-check confirmed enrichment descriptions visible"
---

# Phase 31: Anaheim + Santa Ana CA Data Load — Verification Report

**Phase Goal:** Anaheim and Santa Ana, CA loaded with General Fund operating and revenue budgets, per-capita display, and enrichment — both cities visible in the app.
**Verified:** 2026-06-06T04:00:00Z
**Status:** PASSED — all 6 success criteria verified; human spot-check APPROVED on 2026-06-06
**Re-verification:** No — initial verifier-authored report

---

## Step 0: Human Spot-Check Outcome

The Plan 04 Task 2 human spot-check was completed and APPROVED on 2026-06-06. All 6 Phase 31 success criteria were confirmed by the user at https://treasurytracker.empowered.vote. This verification report documents the evidence supporting each criterion.

---

## Goal Achievement

### Observable Truths

| # | Success Criterion (ROADMAP Phase 31) | Status | Evidence |
|---|--------------------------------------|--------|---------|
| 1 | "Anaheim" and "Santa Ana" appear in the city picker under "California" | PASS | 31-01 seeder upserts both municipality rows with state=CA; Anaheim id=7fbdd013, Santa Ana id=2dc65052; human spot-check APPROVED |
| 2 | Anaheim operating budget total reflects General Fund scope (enterprise utility funds filtered) | PASS | extractAnaheim.py uses page-selection filter requiring "KEEPING US SAFE" + dollar signs — GF-only page; enterprise utilities (Water, Electric, Sanitation, Golf Courses, ARTIC) appear only on "Expenditures by Fund" page, not extracted; FY2025=$490,937,159 / FY2026=$530,352,785; human spot-check APPROVED |
| 3 | Santa Ana operating budget shows General Fund data for at least one fiscal year | PASS | extractSantaAna.py targets "City of Santa Ana General Fund Expenditure Summary" pages exclusively; 16 rows loaded for FY2023–FY2026 each; FY2025=$406,773,060; commits dd518fc (scripts) + 31-03-SUMMARY; human spot-check APPROVED |
| 4 | Both cities show Revenue / Money In tabs with at least one fiscal year populated | PASS | Anaheim revenue: FY2025 12 rows ($649,457,438) + FY2026 12 rows ($644,677,022) loaded via processAnaheim.js revenue mode; Santa Ana revenue: FY2023–FY2026 9–10 rows ($392M–$413M per FY) loaded via processSantaAna.js revenue mode; human spot-check APPROVED |
| 5 | Per-capita displays correctly for Anaheim (~348K) and Santa Ana (~335K) | PASS | 31-01 seeder sets Anaheim population=348000, Santa Ana population=335000, both population_year=2024; population schema satisfies POPUL-02; human spot-check confirmed per-capita visible |
| 6 | Enrichment descriptions visible for top categories in both cities | PASS | enrichCategories.js upserted 25 rows for Anaheim (id=7fbdd013, FY2026, 0 failures) and 26 rows for Santa Ana (id=2dc65052, FY2026, 0 failures) to treasury.category_enrichment; commit 23cd1fd; human spot-check APPROVED |

**Score:** 6/6 success criteria passed

---

### Deferred Items

Revenue was fully loaded for both cities — not deferred.

| # | Item | Status | Evidence |
|---|------|--------|---------|
| 1 | Anaheim revenue tab populated | COMPLETED (not deferred) | FY2025 12 rows ($649,457,438) + FY2026 12 rows ($644,677,022); commit b5103cc (processAnaheim.js revenue mode); 31-02-SUMMARY |
| 2 | Santa Ana revenue tab populated | COMPLETED (not deferred) | FY2023–FY2026 9–10 rows/FY ($392M–$413M per FY); commit dd518fc (processSantaAna.js revenue mode); 31-03-SUMMARY |

No items deferred to future phases. Both cities loaded with operating and revenue data.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `scripts/extractAnaheim.py` | pdfplumber extractor; GF-only page detection; contains "General Fund Expenditures by Function" | VERIFIED | File exists; GF page detection requires "KEEPING US SAFE" + dollar signs; operating + revenue modes; garbled pie-chart text filter; commit b5103cc |
| `scripts/processAnaheim.js` | Node.js processor; $350M–$550M sanity band; treasury_sync_budget_tree RPC | VERIFIED | File exists; band $350M–$550M; worktree-safe resolvePdfDir(); RPC call wired; commit b5103cc |
| `scripts/extractSantaAna.py` | pdfplumber extractor; department-header + Subtotal pattern; CONTINUATION_PATTERNS filter | VERIFIED | File exists; "City of Santa Ana General Fund Expenditure Summary" page detection; CONTINUATION_PATTERNS regex handles line-wrapped labels; multi-pattern FY detection; commit dd518fc |
| `scripts/processSantaAna.js` | Node.js processor; $350M–$450M sanity band; 16MB maxBuffer; treasury_sync_budget_tree RPC | VERIFIED | File exists; band $350M–$450M; maxBuffer 16MB; worktree-safe resolvePdfDir(); commit dd518fc |
| `docs/Anaheim/*.pdf` | At least 1 PDF with fy-prefixed filename | VERIFIED | fy2025-adopted-budget.pdf (13.4MB) + fy2026-adopted-budget.pdf (21.8MB) |
| `docs/Santa Ana/*.pdf` | At least 4 PDFs (FY2023–FY2026) with fy-prefixed filenames | VERIFIED | fy2023-adopted-budget.pdf (38MB) + fy2024 (13MB) + fy2025 (18MB) + fy2026 (20MB) |
| `scripts/.enrichment-progress.json` | Contains entries for Anaheim (25) + Santa Ana (26) with 0 failures | VERIFIED | 69 entries total: Riverside 18 + Anaheim 25 + Santa Ana 26; commit 23cd1fd |
| `.planning/phases/31-anaheim-santa-ana-ca-data-load/31-VERIFICATION.md` | Records all 6 success criteria with PASS status; references DATA-08, DATA-09, ENRICH-02, POPUL-02 | VERIFIED | This document; all four req IDs present; 6-criterion table |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| DATA-08 | 31-02, 31-04 | Anaheim CA operating + revenue budget loaded and visible; GF only; enterprise funds excluded | SATISFIED | FY2025 (13 rows, $490,937,159) + FY2026 (13 rows, $530,352,785) operating; FY2025 (12 rows, $649,457,438) + FY2026 (12 rows, $644,677,022) revenue; commit b5103cc; human spot-check APPROVED |
| DATA-09 | 31-03, 31-04 | Santa Ana CA operating + revenue budget loaded and visible; GF only; enterprise funds excluded | SATISFIED | FY2023–FY2026 operating (16 rows, $403M–$424M per FY); FY2023–FY2026 revenue (9–10 rows, $392M–$413M per FY); commit dd518fc; human spot-check APPROVED |
| ENRICH-02 | 31-04 | AI-generated category enrichment for Anaheim and Santa Ana; plain-language descriptions | SATISFIED | 25 Anaheim enrichment rows (id=7fbdd013, FY2026, 0 failures) + 26 Santa Ana enrichment rows (id=2dc65052, FY2026, 0 failures) in treasury.category_enrichment; commit 23cd1fd |
| POPUL-02 | 31-01 | Anaheim and Santa Ana seeded with 2024 population; per-capita displays correctly | SATISFIED | Seeder sets Anaheim population=348000, Santa Ana population=335000, both population_year=2024; per-capita confirmed visible in app via human spot-check APPROVED |

---

### Human Verification — Plan 04 Task 2 Spot-Check

**Outcome:** APPROVED — all 6 criteria passed

**Date:** 2026-06-06

**Criteria confirmed by user:**

1. City picker shows "Anaheim" and "Santa Ana" under California — CONFIRMED
2. Anaheim operating total ~$491M (GF scope, NOT ~$2.3B all-funds) — CONFIRMED
3. Santa Ana operating total ~$407M (GF scope, NOT ~$734M all-funds) — CONFIRMED
4. Revenue / Money In tabs populated for both cities — CONFIRMED
5. Per-capita ($/resident) visible for both cities — CONFIRMED
6. Enrichment descriptions visible for top categories (Police, Fire, etc.) — CONFIRMED

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|---------|-------|--------|--------|
| Anaheim FY2025 GF total within expected range | extractAnaheim.py dry-run: $490,937,159 | Within $350M–$550M band | PASS |
| Anaheim FY2026 GF total within expected range | extractAnaheim.py dry-run: $530,352,785 | Within $350M–$550M band | PASS |
| Santa Ana FY2025 GF total within expected range | extractSantaAna.py dry-run: $406,773,060 | Within $350M–$450M band | PASS |
| Santa Ana idempotency confirmed | Second processAnaheim.js run: same 13 rows per FY | Exits 0 | PASS |
| Enrichment cost gate | Dry-run estimates run for both cities; combined under $0.10 gate | Gate respected | PASS |
| All Phase 31 git commits referenced in SUMMARYs exist | b5103cc, dd518fc, 23cd1fd | All commits present, dated 2026-06-06 | PASS |

---

### Gaps Summary

No gaps. All Phase 31 code artifacts are present, substantive, and correctly wired. Data flows from real PDF sources through the extractor/processor pipeline to the database. Revenue was fully loaded for both cities — not deferred. All 6 ROADMAP Phase 31 success criteria passed. Human spot-check APPROVED on 2026-06-06.

---

_Verified: 2026-06-06T04:00:00Z_
_Verifier: Claude (gsd-executor) — Plan 04 Task 3_
