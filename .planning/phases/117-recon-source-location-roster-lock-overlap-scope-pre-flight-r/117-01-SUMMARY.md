---
phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
plan: "117-01"
subsystem: recon
tags: [pdftotext, acfr, gasb, state-general-fund, nasbo, gap-log]

# Dependency graph
requires:
  - phase: 116-verification-source-chain-audit-uat
    provides: v2.14 closeout (29 ACFR states + 21 NASBO, 901 rows, 0 anomalies) — the baseline this recon extends
provides:
  - "117-BATCH1-SOURCES.md — complete Batch-1 (AK/AR/DE/HI/ID) ACFR source location doc: D-03 triage, per-state source table, bookend tie-confirmations, four risk facts, scope-vs-NASBO, recency-floor verdicts, gap log, loader-template mapping, per-state detail blocks"
affects: [118-acfr-upgrade-batch-1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wayback Machine CDX API as a recon fallback when a state's live ACFR archive page is JS-rendered (Idaho) — enumerate historical filenames from a snapshot, then confirm each resolves live"
    - "Referer-header workaround for a WAF soft-404 (Delaware's accountingfiles.delaware.gov) — a 245-byte HTTP-200 HTML rejection page masquerading as success, caught by both Content-Type and size filters"
    - "Single-fund-state layout (Arkansas) — the entire ACFR statement IS the General Fund column, simpler than any existing multi-fund loader template"
    - "Mixed-units-within-one-state risk (Idaho) — whole dollars pre-transition, thousands post-transition; no existing precedent state required a per-year units override before this recon"

key-files:
  created:
    - .planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH1-SOURCES.md
  modified: []

key-decisions:
  - "All 5 Batch-1 states (AK, AR, DE, HI, ID) pass the D-03 triage as RECON-verdict — 0 stay-NASBO-exception candidates in this batch"
  - "Arkansas's GF-alone scope divergence (~3.96x NASBO) is the widest found in the entire ACFR cohort to date, driven by AR presenting all governmental-fund activity under a single General Fund with no major/nonmajor split — flagged for a load-time accept-relabel decision with a prominent basis note"
  - "Hawaii is the batch's one narrower-than-NASBO case (~0.95x), because its GAAP General Fund excludes the Med-Quest (Medicaid) Special Revenue Fund — a UT-style GF-alone-vs-composite decision deferred to Phase 118 load time"
  - "Arkansas FY2025 ACFR PDF is a real, correctly-sized file but uses Type-3 custom fonts with no ToUnicode CMap (same failure mode as the Phase-114 Kentucky FY2023 case) — gap-logged as an honest hole; FY2024 is the latest cleanly-extractable year and still satisfies the D-07 recency floor"
  - "Hawaii FY2000-2004 ACFRs are scanned image-only PDFs with zero embedded fonts (more severe than a missing-CMap case — no text layer exists at all) — gap-logged; FY2005-2025 (21yr) window is unaffected"
  - "Idaho's units are MIXED across its window (whole dollars confirmed FY2004, thousands confirmed FY2015) with the exact transition year unpinned within the D-04 effort budget — flagged as a mandatory per-year unit-verification step for the Phase-118 loader, since no existing precedent state required this"

requirements-completed: [RECON-11]

# Metrics
duration: ~100min
completed: 2026-07-04
---

# Phase 117 Plan 01: Batch 1 ACFR Source Location (AK/AR/DE/HI/ID) Summary

**Located, bookend-tied, and risk-fact-pinned the ACFR General Fund statement for all 5 Batch-1 states (AK/AR/DE/HI/ID) at exact $0 tie diffs — surfacing the cohort's widest-ever scope divergence (Arkansas ~3.96x NASBO, a true single-fund state) and one narrower case (Hawaii ~0.95x, Medicaid reported separately).**

## Performance

- **Duration:** ~100 min
- **Tasks:** 3
- **Files modified:** 1 (117-BATCH1-SOURCES.md, built incrementally across 3 commits)

## Accomplishments

- D-03 triage confirmed all 5 Batch-1 states publish a GAAP Governmental Funds ACFR with a splittable General Fund column — zero stay-NASBO-exception candidates in this batch
- Located each state's ACFR Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances, pinned the exact General Fund column header, durable per-year URL pattern (with every naming exception documented), and units
- Bookend-tie-confirmed 10 fiscal years (oldest + latest per state) at exact $0 diff between the ACFR's printed Total Revenues and an independent line-item sum
- Pinned all four D-08 risk facts per state (units, negative-category years, exact column+statement confirmation, FY-end month) — surfacing Idaho's mixed-units trap and Arkansas's single-fund layout as genuinely new risk classes for this cohort
- Compared ACFR GF scope vs NASBO GF magnitude for all 5 states and recommended a disposition for each (4 accept-relabel, 1 narrower GF-alone-vs-composite call)
- Confirmed the D-07 recency floor (FY2023 + FY2024 in a clean window) for all 5 states
- Mapped each state to its closest existing loader template and recorded Phase-118 load notes, including two genuinely new implementation requirements (Delaware's Referer-header WAF workaround, Idaho's per-year units-detection step)
- Gap-logged every non-extracting/non-durable FY with a reason: Arkansas FY2025 (garbled Type-3 fonts), Hawaii FY2000-2004 (scanned image-only PDFs, no text layer)
- Produced the explicit "nodes remaining NASBO-served" list required to feed Phase 123 (empty for this batch — all 5 states are load-eligible)

## Task Commits

1. **Task 0: Workspace + doc skeleton + D-03 triage for all five Batch-1 states** - `b1a5094` (docs)
2. **Task 1: Recon AK + AR + DE — locate, bookend-tie, pin risk facts** - `7fd0026` (docs)
3. **Task 2: Recon HI + ID — locate, bookend-tie, pin risk facts** - `49ca9a6` (docs)

_Note: this is a documentation-only recon plan — all three task commits are `docs(117-01): ...`, no code/DB changes._

## Files Created/Modified

- `.planning/phases/117-recon-source-location-roster-lock-overlap-scope-pre-flight-r/117-BATCH1-SOURCES.md` - Complete 8-section Batch-1 recon deliverable: D-03 triage, per-state source table, bookend tie-confirmations (10 FYs at exact $0 diff), four risk facts, scope-vs-NASBO, recency-floor verdicts, consolidated gap log, loader-template mapping, and 5 per-state detail blocks

## Decisions Made

- All 5 Batch-1 states triage to RECON (no stay-NASBO exceptions) — see key-decisions in frontmatter for the full list of load-time-deferred calls (AR accept-relabel with a prominent basis note given the ~3.96x magnitude; HI GF-alone-vs-composite; DE Referer-header requirement; ID per-year units verification)
- Arkansas's FY2025 PDF and Hawaii's FY2000-2004 PDFs are honest holes, not silently dropped — both gap-logged with a specific technical reason (garbled fonts vs. scanned images) and neither threatens the recency floor

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` blocks anticipated exactly this kind of research (D-03 triage, bookend ties, risk facts, gap log); no auto-fixes, blocking issues, or architectural questions arose. Two genuinely novel findings (Delaware's WAF soft-404 needing a Referer header, and Idaho's units transition) were anticipated by the plan's own threat model (T-117-01, T-117-03) and D-08 risk-fact discipline, and are documented as findings rather than deviations.

## Issues Encountered

- **Arkansas FY2025 PDF garbled:** Type-3 custom fonts with no ToUnicode CMap make `pdftotext` output unreadable. Resolved by falling back to FY2024 as the latest cleanly-extractable year (still satisfies D-07 recency floor) and gap-logging FY2025 per D-06/D-11 (no silent drop).
- **Delaware's file host returns a soft-404 disguised as HTTP 200:** `accountingfiles.delaware.gov` rejects requests without a `Referer` header, returning a 245-byte "Request Rejected" HTML page at HTTP 200. Resolved by adding the `Referer` header (documented as a Phase-118 loader requirement); confirmed both Content-Type and size filters independently catch this trap per the plan's T-117-01 mitigation.
- **Idaho's live ACFR archive page is JS-rendered:** the raw HTML no longer exposes static PDF links. Resolved via the Wayback Machine CDX API (a May-2026 snapshot) to enumerate historical per-year filenames, then confirmed each resolves live directly against `www.sco.idaho.gov` before recording it as durable.
- **Idaho's units are mixed within the window:** FY2004 is whole dollars, FY2015 is thousands, with the exact transition year not pinned within the ~15-20 min D-04 per-state budget. Documented as a mandatory per-year verification step for the Phase-118 loader rather than guessing a boundary year.
- **Hawaii's oldest PDFs are scanned images with zero embedded fonts:** more severe than a missing-ToUnicode-CMap case (no text layer exists at all). Gap-logged as unrecoverable without a full-document OCR pass, which is out of scope for this $0/no-AI recon.

## User Setup Required

None — no external service configuration required. Documentation-only, $0 spend (poppler `pdftotext` + free public ACFR PDFs only, no AI).

## Next Phase Readiness

- `117-BATCH1-SOURCES.md` is a complete input contract for Phase 118 (ACFR Upgrade — Batch 1: AK/AR/DE/HI/ID, ACFR-33..37): every state has a located statement, durable per-year URL pattern (with naming exceptions enumerated), bookend-tied GF totals, four risk facts, a scope-vs-NASBO recommendation, and a loader-template mapping.
- Three load-time decisions are explicitly deferred (not blockers, but must be resolved before/during Phase 118 load): (1) Arkansas's ~3.96x accept-relabel with a prominent basis note given its magnitude; (2) Hawaii's GF-alone-vs-Med-Quest-composite call; (3) Idaho's units-transition-year pinning (a quick FY2005-2014 spot-check, well within a normal load-phase budget).
- Two new loader-tooling requirements are flagged for whoever authors the Phase-118 loaders: Delaware needs a `Referer` header on every `accountingfiles.delaware.gov` request; Idaho needs a per-year units override in `gen_state.py`/`extract_gf.py` (no existing state required this before).
- No blockers to Phase 118. The "nodes remaining NASBO-served" list for this batch is empty (all 5 states are load-eligible), consistent with Phase 123's expectation that most of the final tail converts cleanly.

---
*Phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r*
*Completed: 2026-07-04*
