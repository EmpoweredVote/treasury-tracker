---
phase: 29-long-beach-bakersfield-ca-data-load
plan: "04"
subsystem: database
tags: [enrichment, ai-categories, california, long-beach, bakersfield, verification]

# Dependency graph
requires:
  - phase: 29-02
    provides: Long Beach operating + revenue budget rows in DB (FY2022-2026)
  - phase: 29-03
    provides: Bakersfield operating + revenue budget rows in DB (FY2025-2026)
provides:
  - AI enrichment descriptions for Long Beach budget categories (FY2025-2026; 20 unique name_keys)
  - AI enrichment descriptions for Bakersfield budget categories (FY2025-2026; 25 unique name_keys)
  - Bakersfield operating scope corrected to General Fund only (~$412-427M) — matched to revenue GF scope
  - 29-VERIFICATION.md — all 6 Phase 29 ROADMAP success criteria confirmed in-app
affects: [app-display, enrichment-coverage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Analytical cost estimation: DB category count query + name_key deduplication + pricing model — avoids incurring API cost during cost-gate dry-run"
    - "enrichCategories.js idempotency: name_key upsert prevents re-enriching already-covered categories across FY re-runs"

key-files:
  created:
    - .planning/phases/29-long-beach-bakersfield-ca-data-load/29-VERIFICATION.md
  modified:
    - scripts/extractBakersfield.py
    - scripts/processBakersfield.js

key-decisions:
  - "Analytical cost estimation instead of --dry-run: --dry-run calls the Claude API for real (only skips DB write), so a true cost estimate was computed analytically from DB category counts + token pricing"
  - "Bakersfield operating scope narrowed from all-funds (~$762M) to General Fund only (~$412-427M) at user request — revenue was already GF-scoped (~$368-372M); this aligns Money Out/Money In for a valid comparison"
  - "5 additional Bakersfield GF categories enriched after scope fix (Transfers Out, Economic and Community Development, Non-Departmental, Contingencies, Non Departmental Activity)"

patterns-established:
  - "Pattern: cost gate via analytical estimation — query DB for unique name_keys, multiply by per-call token estimate, sum across cities/FYs"
  - "Pattern: scope parity check — before phase completion, verify operating and revenue use the same fund scope (GF vs all-funds mismatch is a correctness issue)"

requirements-completed: [ENRICH-01, POPUL-01, DATA-04, DATA-07]

# Metrics
duration: 45min
completed: 2026-06-05
---

# Phase 29 Plan 04: Enrichment + Verification Summary

**44 AI category descriptions written for Long Beach and Bakersfield (combined $0.0666, under $0.10 gate), Bakersfield operating narrowed to General Fund scope, and all 6 Phase 29 ROADMAP success criteria confirmed in-app**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-05T18:30:00Z
- **Completed:** 2026-06-05T19:15:00Z
- **Tasks:** 4 (2 auto, 1 decision checkpoint, 1 human-verify checkpoint)
- **Files modified:** 3 (VERIFICATION.md created; extractBakersfield.py + processBakersfield.js modified for GF scope fix)

## Accomplishments

- Computed enrichment cost analytically at $0.0666 combined (45 unique name_keys across Long Beach + Bakersfield) — under the $0.10 D-08 gate; user approved live run
- Ran live enrichment: 44 categories enriched across LB FY2025 (20), BF FY2025 (17), BF FY2026 (7); LB FY2026 was 0 new (all names identical to FY2025, already covered by upsert)
- Applied inline scope fix: Bakersfield operating narrowed from "All Operating Funds" (~$762M) to "General Fund only" (~$412-427M) to match the GF-scoped revenue data; 5 additional GF-specific categories enriched after fix
- User verified all 6 Phase 29 success criteria in the live app — all PASSED

## Task Commits

Each task was committed atomically:

1. **Task 1: Enrichment cost estimate (dry-run)** — analytical estimate recorded in VERIFICATION.md (no code commit — documentation only; part of plan metadata commit)
2. **Task 2: Cost gate decision** — user approved (checkpoint resolved → proceed)
3. **Task 3: Live enrichment** — 44 enrichment rows written to DB; idempotency confirmed
4. **Inline fix: Bakersfield GF scope** — `073a24f` (fix: narrow extractBakersfield.py to General Fund operating scope); `262e2e3` (fix: update processBakersfield.js sanity band for GF-only scope)
5. **Task 4: App spot-check** — all 6 criteria verified by user; VERIFICATION.md updated

## Files Created/Modified

- `.planning/phases/29-long-beach-bakersfield-ca-data-load/29-VERIFICATION.md` — Phase verification record: cost estimate, live enrichment results, Bakersfield scope-fix record, Task 4 human approval of all 6 criteria
- `scripts/extractBakersfield.py` — Narrowed operating extraction target from "All Funds" to "Resources and Appropriations — General Fund" page; updated department list and extraction boundaries
- `scripts/processBakersfield.js` — Updated OP_BAND_MIN/MAX sanity band from $600M-$900M to $300M-$550M to match GF-only operating range

## Decisions Made

1. **Analytical cost estimation** — The `--dry-run` flag in `enrichCategories.js` calls the Claude API for real (it only skips the DB write). Running dry-runs would incur actual API cost, defeating the purpose of the cost gate. Used analytical estimation instead: queried DB for exact category counts, deduped by name_key, applied claude-haiku-4-5-20251001 pricing (~$0.00148 per call). Combined estimate: $0.0666 for 45 unique name_keys.

2. **Bakersfield General Fund scope fix** — During app verification setup, the mismatch between all-funds operating (~$762M) and GF revenue (~$368-372M) was identified. The operating/revenue ratio was ~1.96x — clearly mismatched. Narrowed operating to GF-only (~$412-427M), giving a plausible 1.12-1.15x ratio consistent with modest deficit covered by beginning balance. This is the correct scope for a "Money In vs Money Out" comparison.

3. **5 additional GF-specific enrichments** — After the scope fix loaded new GF category names (Transfers Out, Economic and Community Development, Non-Departmental, Contingencies, Non Departmental Activity), these were enriched immediately. "Transfers Out" deduplicated across FY2025/FY2026 (same name_key), so only 5 new API calls were made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bakersfield operating scope mismatch (all-funds vs GF revenue)**
- **Found during:** Plan 04 (pre-verification scope review)
- **Issue:** Plan 03 loaded Bakersfield operating from "Operating Budget - All Funds" section (~$762M) but revenue was loaded from the General Fund section (~$368-372M). The operating/revenue ratio was ~1.96x — clearly mismatched scope. The app would show Money Out nearly double Money In, which is misleading.
- **Fix:** Narrowed `extractBakersfield.py` to target the "Resources and Appropriations — General Fund" appropriations block (~$412M FY2025, ~$427M FY2026). Updated `processBakersfield.js` sanity band from $600M-$900M to $300M-$550M. Re-ran live load for both FYs.
- **Files modified:** `scripts/extractBakersfield.py`, `scripts/processBakersfield.js`
- **Commits:** `073a24f` (extractBakersfield.py GF scope), `262e2e3` (processBakersfield.js sanity band)

---

**Total deviations:** 1 auto-fixed (Rule 1 — data correctness)
**Impact on plan:** Fix was essential for a valid Money Out / Money In comparison. Bakersfield operating per-capita corrected from ~$1,735 (misleading all-funds) to ~$988-1,024 (GF-scoped, comparable to GF revenue). No scope creep — all work directly related to the plan's correctness goal.

## Issues Encountered

- **`--dry-run` cost estimation impractical** — The enrichCategories.js `--dry-run` flag was designed to preview what would be enriched, but it still calls the AI API (only skips the DB write). A true pre-run cost estimate required analytical computation from DB queries. This is documented as a pattern for future enrichment phases.
- **"Wafer Resources" OCR artifact** — FY2024-25 Bakersfield PDF has "Wafer Resources" (OCR artifact for "Water Resources"). After the GF scope fix, this department is no longer in the loaded operating data (it was in the all-funds section, not the GF section), so the issue resolved itself.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 29 is complete. Both Long Beach and Bakersfield are fully loaded with operating + revenue data, enriched categories, and per-capita display working correctly in the app.
- Long Beach: FY2022-FY2026 operating ($634M-$773M GF) + revenue ($600M-$748M GF); 20 enriched categories
- Bakersfield: FY2025-FY2026 operating ($412M-$427M GF) + revenue ($368M-$372M GF); 25 enriched categories
- All 6 Phase 29 ROADMAP success criteria confirmed in production

## Known Stubs

None — all data is sourced from official PDFs and live DB; all enrichment descriptions are AI-generated (non-empty).

## Threat Flags

No new threat surface introduced. All threat mitigations from plan applied:
- T-29-08: Combined enrichment cost $0.0666 < $0.10 gate (D-08); user approved before live run ✓
- T-29-06: loadEnv pattern used; API keys never logged ✓
- T-29-SC: No new packages installed ✓

## Self-Check

- [x] `29-VERIFICATION.md` created with all 4 sections (cost estimate, live enrichment, scope fix, Task 4 approval)
- [x] Task 4 section shows all 6 criteria as PASS with "Overall result: APPROVED"
- [x] Commits `073a24f` and `262e2e3` exist for Bakersfield scope fix
- [x] 44 enrichment rows written to DB (Long Beach 20 + Bakersfield 24, with LB FY2026 = 0 new via idempotency)
- [x] Combined enrichment cost $0.0666 under $0.10 gate

## Self-Check: PASSED

---
*Phase: 29-long-beach-bakersfield-ca-data-load*
*Completed: 2026-06-05*
