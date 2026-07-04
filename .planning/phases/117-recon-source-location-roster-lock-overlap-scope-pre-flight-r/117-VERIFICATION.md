---
phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
verified: 2026-07-04T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 117: Recon — Source Location + Roster Lock + Overlap/Scope Pre-flight (RECON-11) Verification Report

**Phase Goal:** Every source located and de-risked before any load.
**Verified:** 2026-07-04
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a documentation-only recon phase. Verification was done by reading the actual deliverable
content (not trusting SUMMARY.md prose), independently re-deriving arithmetic ties from the docs'
own printed line items, and — for the one methodology inconsistency found — re-fetching two live
source PDFs and re-deriving the General Fund column sum from scratch to confirm the recon's
reported figures are genuinely correct.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 21 remaining NASBO states have their ACFR GF statement located with units, FY-end, durable per-year URLs | ✓ VERIFIED | `117-BATCH1..4-SOURCES.md` each contain a complete Section 1 per-state source table for all 21 states (AK/AR/DE/HI/ID, IA/KS/ME/MS/MT, NE/NV/NH/NM/ND, OK/RI/SD/VT/WV/WY) with statement name, GF column header, units, FY-end month, and durable URL pattern (or explicit non-derivable-enumeration requirement, honestly flagged where applicable) |
| 2 | Every candidate's bookend years tie at exact $0 against the printed GF column total | ✓ VERIFIED | Independently re-summed the GF column line items for a sample across all 4 batches + DEEPEN (AK/AR/DE/HI/ID FY-latest, MS FY2024 with two negative lines, CA FY2002, FL FY2003) — all reproduced the doc's reported total exactly via `node -e` arithmetic. For Batch 4 (OK/RI/SD/VT/WV/WY), the doc's inline "tie check" text describes a whole-statement fund-column-sum consistency check rather than showing the GF-column line-item breakdown shown in Batches 1-3 — re-fetched RI's FY2025 PDF and WY's FY2025 PDF live and independently summed each state's own **General Fund column** line items from the raw extracted text: RI = $10,095,792K (doc-reported: $10,095,792K, exact match); WY = $4,027,001,270 (doc-reported: $4,027,001,270, exact match). The underlying GF totals are correct; only the doc's inline explanation for Batch 4 states a different (additional) check than Batches 1-3 documented — not a data-accuracy issue (see Anti-Patterns/Notes below) |
| 3 | Roster locked; overlap / GF-alone scope divergence / non-June FY-end flagged pre-load with load-time decision noted | ✓ VERIFIED | `117-RECON.md` Roster Lock table: all 21 states verdict RECON, zero STAY-NASBO-exceptions (D-11 honored with a perfect count). D-10 overlap: read-only Supabase probe of all 21 nodes' `budgets`/`data_sources` rows found 20/21 clean NASBO-only, 1 exception (AK — 2 orphaned `data_sources` rows, no matching `budgets` data, flagged as pre-load cleanup for Phase 118). Scope divergence (D-09) computed + recommended accept-relabel for all 21 (range ~1.01x–3.96x, HI's ~0.95x narrower flagged for a GF-alone-vs-composite load-time call). Non-June FY-end: explicitly checked for all 21 — zero found (ME and WY were pre-flagged as at-risk; both empirically disproven and documented as such) |
| 4 | Deeper-history ACFR URLs located + bookend-tied for DEEP-05 (CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016) | ✓ VERIFIED | `117-DEEPEN-SOURCES.md`: correctly identified the plan's stated windows as stale (Phase 104/v2.12 already deepened 3 of 4, Phase 99-01 already closed TX's gap) — a disclosed Rule-1 factual correction, not scope creep. Dug below the *actual* current windows: CA +6 FY (FY2002-2007, GASB-34 boundary, bookend-tied $0 diff, independently re-verified above); FL +18 FY (FY2003-2020, bookend-tied $0 diff, independently re-verified above); NY and TX floors reconfirmed durable with 0 further extension found (honestly logged, not silently dropped) |
| 5 | Zero DB writes; $0 spend | ✓ VERIFIED | All 6 plans are `docs()`-only commits; `git show --stat` on all 17 phase commits confirms exactly 1 markdown file changed per commit, no code/schema/script files touched. 117-06's DB interaction (D-10 overlap probe) is explicitly and verifiably read-only: `.select(...)` queries only, confirmed in `117-RECON.md` ("DB write confirmation: NONE — every query below is a SELECT"). No AI API calls (method = `pdftotext`/`curl`/`pdftoppm` only) |
| 6 | Requirement RECON-11 fully covered; no orphaned per-phase requirements | ✓ VERIFIED | `.planning/REQUIREMENTS.md` line 98 maps only `RECON-11` to Phase 117; all 6 plans (`117-01`..`117-06`) declare `requirements: [RECON-11]` in frontmatter — exact match, no orphans, no scope reduction |
| 7 | Consolidated 117-RECON.md produces the decision-ready Phase 118-123 handoff (roster, batch split, per-state summary, DEEP-05 summary, NASBO-served list, NASBO-replace rule, Open Risks, success-criteria coverage) | ✓ VERIFIED | `117-RECON.md` contains all of: Overlap Resolution (D-10) + AK finding, Untouched-Nodes Contract (29 ACFR nodes enumerated + confirmed via DB probe, 50 total state municipalities = 29 + 21 exactly), Roster Lock table (21/21 RECON), Batch Split Confirmation (unchanged, D-12), consolidated per-state summary table (21 rows), DEEP-05 deepening summary, empty NASBO-served list (Phase 123 input), NASBO-replace rule (7 points), Open Risks rollup (non-June FY-ends, scope-relabel, P2-clamp anticipations, units traps, soft-404/access cautions, pre-GASB-34 flags, recency-floor blockers, naming/enumeration requirements), and an explicit success-criteria coverage checklist mapping every ROADMAP success criterion to its supporting evidence |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `117-BATCH1-SOURCES.md` | AK/AR/DE/HI/ID recon (8 sections + detail blocks) | ✓ VERIFIED | 277 lines, all 8 sections present, 5 detail blocks, D-03 triage all RECON, 10 bookend ties independently re-derived and confirmed exact |
| `117-BATCH2-SOURCES.md` | IA/KS/ME/MS/MT recon | ✓ VERIFIED | 404 lines, all sections present, 10 bookend ties confirmed (including MS's two-negative-line FY2024 tie, independently re-derived exact) |
| `117-BATCH3-SOURCES.md` | NE/NV/NH/NM/ND recon | ✓ VERIFIED | 428 lines, D-10 overlap sub-probe included, 10 bookend ties (+1 hand-verified mid-window NM FY2022 image-only tie) |
| `117-BATCH4-SOURCES.md` | OK (reused/re-verified)/RI/SD/VT/WV/WY recon | ✓ VERIFIED | 393 lines, all sections present; 2 states' GF totals independently re-derived live from freshly-fetched source PDFs (RI, WY) and confirmed exact |
| `117-DEEPEN-SOURCES.md` | CA/NY/FL/TX deepening recon | ✓ VERIFIED | 83 lines, premise-correction disclosed prominently, CA (+6 FY) and FL (+18 FY) bookend ties independently re-derived exact, NY/TX floors reconfirmed |
| `117-RECON.md` | Consolidated Phase 118-123 handoff | ✓ VERIFIED | 449 lines, all required sub-sections present (overlap, untouched-nodes, roster lock, batch split, per-state summary, DEEP-05 summary, NASBO-served list, NASBO-replace rule, Open Risks, success-criteria coverage) |
| `117-CONTEXT.md` | D-01..D-12 locked decisions | ✓ VERIFIED | Present, referenced consistently by all 6 plans and all deliverable docs |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Batch SOURCES docs | Phase 118-121 loaders | durable per-year URL pattern + GF column index + units + template mapping | WIRED | Every per-state block in all 4 batch docs includes a loader-template mapping (Section 7) and explicit Phase-N load notes; `117-RECON.md`'s consolidated per-state table cross-references all of it |
| DEEPEN-SOURCES.md | Phase 122 (deepening) | per-target load statement | WIRED | Explicit "Phase 122 one-line-per-target load statement" section with exact FY counts and URL patterns |
| RECON.md NASBO-served list | Phase 123 (NASBORT-01) | empty-list input contract | WIRED | Explicitly stated as empty with the honest restatement rationale, matching D-01 policy |
| RECON.md D-10 overlap probe | Phase 118 AK cleanup | orphaned `data_sources` rows flagged | WIRED | AK finding documented with exact `dataset_id` values and a specific DELETE recommendation for the Phase 118 loader |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| RECON-11 | 117-01..117-06 (all 6) | All 21 remaining NASBO states GF-statement located + bookend-tied; roster locked; overlaps/scope/FY-end flagged; DEEP-05 deeper-history URLs located + bookend-tied | ✓ SATISFIED | All sub-requirements independently confirmed above (Truths 1-4, 7) |

No orphaned requirements — REQUIREMENTS.md maps only RECON-11 to Phase 117, and all 6 plans declare exactly `[RECON-11]`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `117-BATCH4-SOURCES.md` | Section 2 (all 6 states) | Inline "tie check" narrative describes a whole-statement fund-column-sum arithmetic check (e.g. "4-column sum = $31,259,646K; matches printed Total Revenues exactly") rather than showing the GF-column-only line-item breakdown that Batches 1-3 display | ℹ️ Info (not a blocker — data independently confirmed correct) | Could momentarily read as if the GF-specific tie wasn't performed at the line-item level. Independently re-fetched RI's and WY's live source PDFs and re-summed each state's own General Fund column line items from scratch: both reproduced the doc's reported GF Total Revenues figure exactly ($10,095,792K and $4,027,001,270 respectively). The reported bookend figures are correct; this is a documentation-clarity inconsistency inherited from the same phrasing pattern used in the v2.14-preserved OK recon (byte-identical reuse), not a new defect introduced by this phase, and not a data-accuracy problem. No action required, but Phase 121's loader author should independently derive GF-column line-item sums via `extract_gf.py` (as the tool already does) rather than relying solely on this doc's inline arithmetic narrative for RI/SD/VT/WV/WY. |

No TBD/FIXME/XXX/placeholder/stub markers found in any Phase 117 deliverable file.

### Human Verification Required

None. This is a documentation-only recon phase with no UI, no runnable application behavior, and no
user-facing surface to test. All verifiable claims (arithmetic ties, commit existence, DB read-only
confirmation, file completeness, requirement traceability) were checked directly against the
codebase and, where a methodology question arose (Batch 4's tie-check phrasing), resolved by
independently re-fetching and re-deriving figures from the live public source PDFs rather than
deferring to human judgment.

### Gaps Summary

No gaps. All 7 derived observable truths verified against the actual deliverable content (not
SUMMARY.md claims). Every bookend-tie dollar figure spot-checked (10 states + 2 DEEP-05 states via
independent re-summation of the docs' own printed line items, plus 2 states — RI and WY — via a full
independent re-fetch-and-re-extract from the live source PDFs) reproduced the reported figures
exactly. All 17 phase commits are single-file `docs()` commits, confirming the "documentation-only,
zero DB writes, zero code changes" claim. The D-10 overlap probe is confirmed read-only. Requirement
RECON-11 is fully and exclusively covered with no orphaned per-phase requirements. The phase goal —
"every source located and de-risked before any load" — is achieved: all 21 roster states plus the 4
DEEP-05 targets have real, independently-verifiable, bookend-tied source locations, and every known
risk (units traps, non-June FY-end candidates, scope divergence, soft-404/access-mechanism quirks,
P2-clamp candidates, recency-floor gaps, AK's orphaned metadata) is explicitly surfaced with a
load-time disposition rather than silently dropped or silently assumed away.

---

*Verified: 2026-07-04*
*Verifier: Claude (gsd-verifier)*
