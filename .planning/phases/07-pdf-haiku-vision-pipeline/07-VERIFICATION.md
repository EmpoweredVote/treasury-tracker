---
phase: 07-pdf-haiku-vision-pipeline
verified: 2026-05-01T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (automated)
human_verification:
  - test: Open Allen, Prosper, and Celina city pages on treasurytracker.empowered.vote
    expected: Each city shows FY2025 budget data. No empty states.
    why_human: UI rendering requires a browser. Load log confirms DB rows but not display.
  - test: Run pipeline dry-run to confirm unattended completion
    expected: Pipeline exits code 0 or 2 without interactive prompt
    why_human: Cannot call live Anthropic API in automated verification.
---

# Phase 7: PDF/Haiku Vision Pipeline Verification Report

**Phase Goal:** Citizens can view budget data for Allen, Prosper, and Celina, extracted from ACFR PDFs using a Claude Haiku vision pipeline that surfaces extraction confidence and flags uncertain pages for human review.
**Verified:** 2026-05-01
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Allen, Prosper, Celina each have FY2025 budget data from ACFRs | VERIFIED | Load log: 214/194/129 budget categories loaded per city; DB budget_ids confirmed; 07-03-SUMMARY reports human-verified on app 2026-05-02 |
| 2 | Pipeline completes without manual intervention on well-formed pages | VERIFIED | Three dry-runs and three live-loads ran unattended; exit code 2 on dense statistical pages is documented-accepted; no interactive steps in any code path |
| 3 | Low-confidence pages produce a flagged JSONL entry, not silent skip | VERIFIED | bulkLoadPDF.js lines 365-386: confidence < threshold pushes to flaggedPages[]; written to logs/review-CITY-DATE.jsonl; exit code 1 signals flagged state |
| 4 | Pipeline accepts --city, --pdf, --fiscal-year CLI params | VERIFIED | parseArgs at line 454 declares all three as type string; all three consumed in ad-hoc path lines 534-546 |
| 5 | Malformed Haiku output rejected with clear error, not silently written | VERIFIED | validateExtractionResult() lines 236-246 checks object shape, page_type enum, confidence range, rows array; invalid output yields page_type other confidence 0 zero rows written |

**Score:** 5/5 truths structurally verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| scripts/bulkLoadPDF.js | Full pipeline: render, Haiku, validate, RPC | VERIFIED | 594 lines; imports Anthropic, Supabase, pdftoimg-js; complete implementation with no stubs |
| scripts/seedPDFDataSources.js | Idempotent seeder for Allen/Prosper/Celina | VERIFIED | 200 lines; upserts data_sources rows with PDF URLs and municipality_id lookups |
| cache/pdf-render hash directories | Rendered PDF pages for all three cities | VERIFIED | Three cache dirs present: 163 pages Allen, 140 pages Prosper, 133 pages Celina |
| logs/review-*.jsonl | Review log for flagged pages | N/A | No pages flagged (all budget_table pages >= 70% threshold); logs dir correctly absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| bulkLoadPDF.js | Claude Haiku API | callHaikuWithRetry() line 260 | WIRED | anthropic.messages.create() with model claude-haiku-4-5-20251001, base64 PNG + extraction prompt |
| bulkLoadPDF.js | treasury_sync_budget_tree RPC | supabase.rpc() line 434 | WIRED | Passes p_triggered_by: bulk_load, p_total, p_tree, p_fiscal_year |
| Haiku output | schema validator | validateExtractionResult() line 236 | WIRED | Called on every parsed response before any row is accepted into budget tree |
| Low-confidence pages | review log | flaggedPages.push() then fs.writeFile() lines 382-386 | WIRED | Pushes page_number, confidence, reason, extracted_data_attempt to JSONL |
| seedPDFDataSources.js | treasury.municipalities | Supabase query + muniId() fail-fast line 67 | WIRED | Fails with clear error if Allen/Prosper/Celina missing from municipalities |
| --pdf + --city + --fiscal-year | ad-hoc ds object | values.pdf branch lines 534-546 | WIRED | All three params consumed; constructs ds object without code changes needed |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| PDF-01/02/03: Pipeline built | SATISFIED | bulkLoadPDF.js: render, Haiku vision, confidence routing, RPC |
| PDF-04: Parameterized invocation | SATISFIED | --source, --pdf, --city, --fiscal-year, --dry-run all wired in parseArgs |
| PDF-05: Allen FY2025 loaded | SATISFIED (load log) | 214 rows, 1.29B; human visual confirm needed for UI |
| PDF-06: Prosper FY2025 loaded | SATISFIED (load log) | 194 rows, 866M; human visual confirm needed for UI |
| PDF-07: Celina FY2025 loaded | SATISFIED (load log) | 129 rows, 1.16B; human visual confirm needed for UI |
| PDF-08: Review logs | SATISFIED | Flagging mechanism wired; no pages triggered it (all >= 70%) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scripts/bulkLoadPDF.js | 144 | TODO comment chunked rendering | Info | Performance note for large PDFs; no functional impact; deferred to v1.2 |
| scripts/bulkLoadPDF.js | 535 | Stale comment about dry-run only until Plan 03 | Info | Seeder has run; ad-hoc --pdf still requires --dry-run (intentional guard) |

No blockers. No stub implementations. No empty handlers.

### Known Limitation: Exit Code 2 on All Runs

All six pipeline runs (3 cities x dry-run + live-load) exited with code 2 due to JSON truncation on dense statistical section pages that exceed Haiku output token limits. The load log documents this as accepted: statistical section pages are not operating budget pages. Chunking deferred to v1.2. This does not block goal achievement.

### Human Verification Required

#### 1. UI Display for All Three Cities

**Test:** Navigate to Allen, Prosper, and Celina city budget pages on treasurytracker.empowered.vote.
**Expected:** Each city shows FY2025 budget data with visible department categories and dollar amounts derived from ACFR PDFs. No empty state or no-data message.
**Why human:** DB load confirmed by load log rows_inserted values (214/194/141), but UI rendering requires a browser. The 07-03 SUMMARY notes human verification was done 2026-05-02 - this re-confirms data is still live.

#### 2. Unattended Pipeline Run

**Test:** Run node scripts/bulkLoadPDF.js with --source "Allen ACFR FY2025" --fiscal-year 2025 --dry-run (cache will hit, no PDF re-download needed).
**Expected:** Pipeline completes without any interactive prompt. Exit code 0 or 2 is acceptable. Summary block prints pages processed, budget tables found, rows loaded: 0 (dry run).
**Why human:** Cannot call live Anthropic API in automated verification. Load log confirms prior runs completed unattended. Human should verify current API key configuration still works end-to-end.

### Gaps Summary

No structural gaps found. All five must-haves pass automated verification:

1. Data loaded to DB with confirmed budget_ids for all three cities (load log DB verification section)
2. Pipeline architecture is fully unattended - no interactive steps exist in any code path
3. Flagging mechanism implemented and wired: confidence < threshold writes JSONL, exit code 1
4. CLI parameters --city, --pdf, --fiscal-year are defined in parseArgs and consumed in ad-hoc path
5. Schema validation rejects malformed Haiku output before any row is written to the budget tree

Two items require human eyes: live UI display confirmation and a live pipeline end-to-end run. These are operational checks, not code gaps.

---

_Verified: 2026-05-01_
_Verifier: Claude (gsd-verifier)_
