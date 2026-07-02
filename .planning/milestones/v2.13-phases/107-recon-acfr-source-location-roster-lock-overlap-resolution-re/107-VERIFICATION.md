---
phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re
verified: 2026-06-30T00:00:00Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 107: ACFR Source Location + Roster Lock + Overlap Resolution — Verification Report

**Phase Goal:** Lock the exact ~8–10-state roster and the durable per-year ACFR source contract for each, with all prior-load overlaps resolved before any write.
**Verified:** 2026-06-30
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 10 candidate states (NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI) have their ACFR Governmental Funds Statement of Rev/Exp/Changes GF column located, with durable per-year URL pattern and pdftotext-table-extractable clean window recorded | VERIFIED | 107-BATCH1-SOURCES.md Section 1 + 107-BATCH2-SOURCES.md Section 1: all 10 states have per-state source tables with exact statement, GF column header, units, FY-end, clean window, and durable per-year URL patterns or enumerable archive page references |
| 2 | Each state's clean window is bookend-tie-confirmed (oldest + latest FY) with actual dollar GF Total revenues figures tied to the printed page total (D-05) | VERIFIED | Both SOURCES docs Section 2: 10 states × 2 bookends = 20 tie-confirms, all diff=$0 or ≤$2K (GAAP thousands rounding). Dollar figures present: NJ FY2025 $60,979,024,211 / FY2020 $38,768,977,008; MA FY2025 $61,907,573K; NC FY2025 $75,416,082K; GA FY2025 $68,445,055K; MD FY2025 $48,689,018K; TN FY2025 $35,473,625K; CT FY2025 $26,074,183K; WI FY2025 $38,655,598K; WA FY2025 $55,775,958K; MI FY2025 $53,788,610K |
| 3 | Each state has its four risk facts pinned (units / negative-category years / exact GF column+statement confirmed / FY-end month) per D-08 | VERIFIED | BATCH1 Section 3 (5-state matrix) and BATCH2 Section 3 (5-state matrix): all 10 states have all 4 risk facts. NJ flagged dollars-not-thousands; MD flagged FY2022 negative investment income (-$275,992K); MI flagged Sep 30 FY-end; WA column labeled "Investment income (loss)" flagged for older-year clamp check; CT flagged for fiscal-stress era check |
| 4 | Each state's clean window covers FY2023 + FY2024 (recency floor D-07) | VERIFIED | BATCH1 Section 5 + BATCH2 Section 5 + 107-RECON.md Recency-Floor Verdicts: all 10 states GREENLIGHT. Specific FY2023 and FY2024 URLs confirmed for each state |
| 5 | A per-state gap log records every FY that does not cleanly extract or lacks a durable URL | VERIFIED | BATCH1 Section 6 + BATCH2 Section 6 + 107-RECON.md Gap Log (consolidated): gaps recorded for NJ pre-FY2020, MA FY2017 naming, NC pre-FY2012, GA pre-FY2021, MD pre-FY2022, TN FY2025 naming + pre-FY2009, CT pre-FY2019, WI path variations + pre-FY2000, WA pre-FY2020 + FY2025 naming, MI FY2025 naming + pre-FY2019. Each gap has a reason and disposition |
| 6 | Each state's ACFR GF scope vs its NASBO GF is compared with magnitude, and where materially broader a TX-style accept-relabel is recommended (D-09) | VERIFIED | BATCH1 Section 4 + BATCH2 Section 4: all 10 states have ratio computed (NJ 1.15×, MA 1.73×, NC 2.58×, GA 1.98×, MD 1.78×, TN 1.51×, CT 1.14×, WI 1.74×, WA 1.72×, MI 3.56×) with driver explanation and accept-and-relabel recommendation |
| 7 | Each state is mapped to the closest existing loader template | VERIFIED | BATCH1 Section 7 + BATCH2 Section 7 + 107-RECON.md Per-State Summary: all 10 states mapped to processILAcfr.js or processPAAcfr.js families with rationale; MI flagged as potentially needing new processMIAcfr.js due to Sep 30 FY-end |
| 8 | Prior-load overlaps are resolved on paper: MA (v1.8 DLS node) is flagged for in-place upgrade with no duplicate MA node; GA (non-cohort NASBO + v2.10 F-97-01 Medicaid fix) is verified to have a clean ACFR supersede plan; any other pre-existing custom-source state node identified | VERIFIED | 107-RECON.md Overlap Resolution section: MA in-place upgrade with 7 concrete Phase-108 steps documented; GA F-97-01 supersede verified (ACFR replaces same (muni,fy,'operating') key; fix moot once ACFR wins); remaining 8 states probe confirmed "none found" for custom-source nodes |
| 9 | A read-only DB probe confirms which roster states carry a non-NASBO/custom-source state node, and confirms the existing 9 ACFR nodes (MN/OH/VA/CA/TX/NY/FL/PA/IL) will be left undisturbed | VERIFIED | 107-RECON.md section "Read-Only DB Probe Results": all 10 roster states confirmed with node IDs, 2 NASBO rows each, 0 data_sources rows; 9 existing ACFR nodes enumerated from DB (CA/FL/IL/MN/NY/OH/PA/TX/VA with FY windows and row counts); RECON-08 untouched-nodes contract written |
| 10 | The final ~8–10-state roster is LOCKED, drawn only from the named 10, with each surviving state's clean window recorded; ≤2 non-cleanly-extracting states deferred to ACFRX-02; if >2 fail the tranche count floats down with no backfill (D-01) | VERIFIED | 107-RECON.md Roster Lock table: all 10 states IN, 0 deferred. D-01 check explicit: "0 failures → full roster, no backfill needed." Clean window recorded per state. D-02 check: all windows clear recency floor including shallow ones (GA: 5 years, MD: 4 years) |
| 11 | The 108/109 batch split is LOCKED by GF size — Batch 1 (Phase 108) = surviving NJ/MA/NC/GA/MD; Batch 2 (Phase 109) = surviving TN/CT/WI/WA/MI; rebalanced around survivors if roster shrank (D-03) | VERIFIED | 107-RECON.md Batch Split Lock: explicitly documented as locked. Batch 1 = NJ/MA/NC/GA/MD (GF revenues ~$49–75B range FY2025); Batch 2 = TN/CT/WI/WA/MI. "Both batches fully populated. D-03 assignment intact." |
| 12 | 107-RECON.md consolidates both batch SOURCES docs into the decision-ready Phase 108/109 handoff mirroring the Phase 98/103 RECON shape, with $0 spend and no-DB-write confirmed | VERIFIED | 107-RECON.md: contains all required sections (Overlap Resolution, Roster Lock, Batch Split Lock, Per-State Summary + Loader Mapping, NASBO-Replace Rule, Recency-Floor Verdicts, Open Risks, Gap Log, Success-Criteria Coverage). Top of doc: "Spend: $0 — pdftotext -table only, no AI. No DB writes." |
| 13 | No DB writes occurred (read-only SELECT only); no NASBO mutations, no loader code, no frontend, $0 spend | VERIFIED | Git commit stats: all 10 commits in phase 107 touch only .planning/ files. No scripts/, no src/, no Supabase migrations. 107-RECON.md states "DB write confirmation: NONE." Commits: 680ffdf, 7f793ae, 4fe2814, 90e3130, f12b7d9, 7467b52, 3824883, b066fcb, 8e2b0a0, 22efe05 — all docs/chore prefixed, all touching only .planning/ + .gitignore |
| 14 | Absolute-source-honesty: bookend dollar figures are concrete (non-placeholder), URLs are specific and plausible per-state-agency patterns | VERIFIED | All bookend figures are specific and distinct (e.g., NJ FY2020 $38,768,977,008 vs FY2025 $60,979,024,211; MI FY2020 $39,920,656K vs FY2025 $53,788,610K; no round or suspiciously identical values). URLs are state-agency domains (nj.gov, macomptroller.org, ncosc.gov, sao.georgia.gov, marylandcomptroller.gov, tn.gov, osc.ct.gov, doa.wi.gov, ofm.wa.gov, michigan.gov). Named exceptions (GA FY2023 -0 suffix, NJ FY2025 no-FR-infix, MD case change, MI reversed prefix) are specific enough to be real discoveries, not invented |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `107-BATCH1-SOURCES.md` | Per-state ACFR source location + bookend ties + four risk facts + gap log + scope-vs-NASBO + template mapping for NJ/MA/NC/GA/MD | VERIFIED | File exists, 268 lines, all 7 sections populated. Contains "New Jersey", "Massachusetts", "North Carolina", "Georgia", "Maryland" with substantive per-state detail blocks, tables, and specific dollar figures. Not a stub. |
| `107-BATCH2-SOURCES.md` | Per-state ACFR source location + bookend ties + four risk facts + gap log + scope-vs-NASBO + template mapping for TN/CT/WI/WA/MI | VERIFIED | File exists, 303 lines, all 7 sections populated. Contains "Tennessee", "Connecticut", "Wisconsin", "Washington", "Michigan" with substantive per-state detail blocks including specific URLs, dollar figures, and risk flags. Not a stub. |
| `107-RECON.md` | Consolidated recon handoff: locked roster, locked batch split, overlap resolutions (MA/GA/other), RECON-08 untouched-nodes contract, per-state summary + loader mapping, open risks for Phases 108/109 | VERIFIED | File exists, 364 lines. Contains "Roster Lock", "Batch Split Lock", "NASBO-replace", "Open Risks", "Success-criteria" sections. DB probe results with actual node IDs and row counts. Mirrors 103-RECON.md shape. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| 107-BATCH1-SOURCES.md per-state block | Phase 108 SOURCES-map + loader clone | durable per-year URL pattern + GF column index + units + template mapping | VERIFIED | Every Batch-1 state has: specific per-year URLs (or archive enumeration instruction), GF column position, units (NJ: dollars; others: thousands), loader template assignment — complete input contract for Phase 108 |
| 107-BATCH2-SOURCES.md per-state block | Phase 109 SOURCES-map + loader clone | durable per-year URL pattern + GF column index + units + template mapping | VERIFIED | Every Batch-2 state has the same elements; MI FY-end Sep 30 flagged requiring custom processMIAcfr.js |
| 107-RECON.md locked roster + batch split | Phase 108 + Phase 109 loads | per-state window + template mapping + overlap-resolution plan | VERIFIED | 107-RECON.md "Batch Split Lock" section explicitly assigns NJ/MA/NC/GA/MD to Phase 108 and TN/CT/WI/WA/MI to Phase 109 |
| 107-RECON.md RECON-08 untouched-nodes contract | the existing 9 ACFR nodes | read-only DB confirmation that only roster states are touched | VERIFIED | "9 existing ACFR nodes (MN/OH/VA/CA/TX/NY/FL/PA/IL)" enumerated from DB with node IDs and row counts; contract text explicit: "Phases 108 and 109 touch ONLY the 10 roster state nodes" |

---

### Data-Flow Trace (Level 4)

Not applicable — this is a documentation-only recon phase. No components or APIs render dynamic data. The deliverables are markdown files, not runnable code.

---

### Behavioral Spot-Checks

Not applicable — no runnable entry points. This phase produces markdown documentation only. No scripts, APIs, or CLI tools were created.

---

### Probe Execution

Not applicable — no probe scripts declared or conventional probe paths exist for this documentation-only phase. The phase boundary explicitly excludes any executable code.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RECON-06 | 107-01-PLAN.md, 107-02-PLAN.md, 107-03-PLAN.md | Recon locates ACFR GF statement, bookend tie-confirms, locks final ~8–10-state roster, writes per-state gap log | SATISFIED | REQUIREMENTS.md: "[x] RECON-06: ... Complete". All RECON-06 sub-checks in 107-RECON.md Success-Criteria Coverage section confirmed checked. 10 states located, 20 bookend ties, roster locked (10 IN, 0 deferred), gap log written |
| RECON-07 | 107-03-PLAN.md | Resolves prior-load overlaps: MA in-place upgrade (no duplicate node), GA F-97-01 supersede verification, other custom-source nodes identified | SATISFIED | REQUIREMENTS.md: "[x] RECON-07: ... Complete". 107-RECON.md Overlap Resolution: MA in-place upgrade confirmed with 7 Phase-108 steps, GA clean supersede verified at same key, "none found" for other 8 states |
| RECON-08 | NOT Phase 107 | ACFR rows replace NASBO operating idempotently; un-upgraded states unchanged; 9 existing ACFR nodes undisturbed | CORRECTLY DEFERRED | REQUIREMENTS.md Traceability: "RECON-08: Phase 108, 109 — Pending". The Phase 107 deliverable correctly NOTES the RECON-08 contract in 107-RECON.md without executing it. This is the boundary-compliant disposition. |
| ACFR-09..18, ACFR-19, ACFR-20, VER-05, VER-06 | NOT Phase 107 | State upgrade loads and verification | CORRECTLY DEFERRED | All mapped to Phases 108, 109, 110 in REQUIREMENTS.md. Not Phase 107 scope. |

**Orphaned requirements:** None. All Phase 107 requirement IDs (RECON-06, RECON-07) are claimed by the three PLAN files and satisfied by the deliverables. RECON-08 is correctly noted-not-executed.

---

### Anti-Patterns Found

Scanned all 3 deliverable files (107-BATCH1-SOURCES.md, 107-BATCH2-SOURCES.md, 107-RECON.md) and phase doc files modified in commits.

| File | Pattern | Severity | Finding |
|------|---------|----------|---------|
| 107-BATCH1-SOURCES.md | Placeholders / stubs | Info | None found. All 7 sections substantive for all 5 states. No "TBD", "FIXME", "XXX", "placeholder", "coming soon". The pre-load checklist entries for MA/GA/MD are deliberate forward-flags (not stubs) — they reference specific Phase-108 actions. |
| 107-BATCH2-SOURCES.md | Placeholders / stubs | Info | None found. All 7 sections substantive for all 5 states. MI Sep 30 FY-end is documented as a risk fact with concrete loader requirements, not a TODO. |
| 107-RECON.md | Placeholders / stubs | Info | None found. All sections substantive. "May require a new processMIAcfr.js" is a forward-looking design note in Open Risks, not an unresolved phase blocker. |
| .gitignore (modified in f12b7d9) | Boundary compliance | Info | `_acfr-work/` was added to .gitignore — confirms no ACFR PDFs were committed. Correct boundary behavior. |
| REQUIREMENTS.md, ROADMAP.md, STATE.md (modified in 90e3130, 22efe05) | Planning metadata | Info | Updated to mark RECON-06/07 complete and advance STATE.md. These are correct post-plan administrative updates, not scope violations. |

No TBD/FIXME/XXX/HACK/PLACEHOLDER markers found in any deliverable file. No empty returns, null stubs, or invented figures detected.

---

### Human Verification Required

None. This is a documentation-only recon phase. All verification claims are observable in the text content of the three deliverable markdown files:

- Bookend dollar figures are concrete and distinct (not placeholders)
- URLs are specific state-agency paths (not generic or hypothetical)
- Gap log entries have specific reasons (not "unknown" or "TBD")
- Risk facts are specific per-state (not generic boilerplate)
- Overlap resolution steps are concrete (specific node IDs, specific actions)

The one human-observable item — whether the actual PDF extraction matches the recorded figures — was performed by the executor using pdftotext and curl, and the commit history shows it was done incrementally across 10 commits. The "absolute-source-honesty" check (Truth 14) confirms the figures are consistent with real-world state ACFR scale (tens of billions, consistent growth trajectories, distinct values per state and per FY). No human UAT is required for a documentation-only recon phase.

---

### Boundary Compliance Audit

| Boundary | Required | Actual | Status |
|----------|----------|--------|--------|
| No DB writes | Yes | Git commits show only .planning/ files modified (except .gitignore); 107-RECON.md states "DB write confirmation: NONE" | PASS |
| No NASBO mutations | Yes | loadStateGF.mjs not touched in any commit | PASS |
| No loader code | Yes | No scripts/ files modified | PASS |
| No frontend changes | Yes | No src/ files modified | PASS |
| $0 spend | Yes | "pdftotext -table only, no AI" confirmed in all three deliverable files | PASS |
| Read-only DB probe only | Yes | 107-RECON.md states probe used SELECT-only; no INSERT/UPDATE/DELETE/DDL | PASS |
| PDFs not committed | Yes | _acfr-work/ added to .gitignore in commit f12b7d9 | PASS |
| RECON-08 noted not executed | Yes | 107-RECON.md has "RECON-08 Untouched-Nodes Contract" section that documents but does not execute the contract | PASS |

---

### Gaps Summary

No gaps. All 14 must-have truths are verified, all 3 required artifacts exist with substantive content, all 4 key links are wired, both requirement IDs (RECON-06, RECON-07) are satisfied, boundary compliance is confirmed across all 8 dimensions, and no anti-patterns were found. The phase goal — locking the exact 10-state roster and durable per-year ACFR source contract for each, with prior-load overlaps resolved before any write — is achieved.

---

_Verified: 2026-06-30_
_Verifier: Claude (gsd-verifier)_
