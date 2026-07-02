---
phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0
verified: 2026-07-02T23:10:00Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
---

# Phase 112: Recon — Roster Lock + Source Location + Overlap Resolution Verification Report

**Phase Goal:** The ~10-state tranche-3 roster is locked from a NASBO-ranked shortlist with every locked state's ACFR GF statement located, tie-confirmed, and trap-checked — and every prior-load overlap resolved on paper before any write.
**Verified:** 2026-07-02T23:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

This is a documentation-only recon phase (no code, no DB writes, no frontend). Verification consisted of:
1. Reading all three PLAN/SUMMARY pairs (112-01, 112-02, 112-03) and the three deliverable docs (112-RECON.md, 112-BATCH1-SOURCES.md, 112-BATCH2-SOURCES.md) in full.
2. Cross-checking the NASBO ranking figures in `112-RECON.md` Section 1 directly against `scripts/loadStateGF.mjs`'s `STATES` map (`controlTotalGF` values) — confirmed exact match for IN ($22,405M), AZ ($17,903M), AL ($13,511M) and consistent with all cited figures.
3. **Running a live, independent read-only SELECT probe** against the production Supabase database (`treasury.municipalities`, `treasury.budgets`, `treasury.data_sources`) to re-verify every claim in `112-RECON.md` Section 5 (Overlap Resolution) and Section 8 (19-nodes-untouched contract) — not trusting the SUMMARY's/RECON doc's self-reported probe results.
4. Grepping all three deliverable docs for debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) — zero found.
5. Running `git diff 3758d53..HEAD --stat` to confirm the phase touched only `.planning/` files (no loader code, no frontend, no schema).
6. Running `gsd-sdk query verify.artifacts` against each plan's frontmatter must-haves — all passed.

## Live DB Re-Verification (independent, not trusting SUMMARY/RECON claims)

An ephemeral read-only Node script (run from repo root for `node_modules` resolution, deleted immediately after — never committed) queried production Supabase directly:

| State | Node ID (doc claim) | Live DB match | Budgets rows | FYs | `data_source` label | `data_sources` table rows |
|-------|---------------------|----------------|--------------|-----|----------------------|----------------------------|
| Utah | `740cffee-3111-...` | ✅ MATCH | 2 | 2023, 2024 (operating only) | NASBO SER text-stamp | 0 |
| Indiana | `7eb77ada-b504-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Arizona | `866036ee-20b2-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Oregon | `7686da27-5d64-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Missouri | `21892bb7-1a1d-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Colorado | `89d2aff1-6980-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| South Carolina | `f0024b19-1b89-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Kentucky | `6d9dfe88-f908-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Alabama (substitute) | `bc953061-98de-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Louisiana | `b7e9e7cd-8b7e-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Oklahoma (deferred) | `54233a91-919d-...` | ✅ MATCH | 2 | 2023, 2024 | NASBO SER text-stamp | 0 |
| Utah non-state (municipal) rows | — | ✅ MATCH | 15 rows, distinct from state node | — | — | — |
| 19-ACFR sample (MN, MI) | `d4b4897d...`, `38c9f1ff...` | ✅ MATCH | — | — | — | — |

**Result: every claim in the RECON doc's overlap-resolution and untouched-nodes sections is independently reproducible against the live database.** No fabrication, no drift between doc and DB state. This also independently confirms **zero DB writes occurred** during the phase — the pre-recon NASBO-only state (2 rows/state, 0 `data_sources` residue) is exactly what is still in the database today.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 31 remaining NASBO states ranked by FY2024 GF size, full spot-check performed | ✓ VERIFIED | `112-RECON.md` Section 1, 31-row table, none of the 19 ACFR states present; IN/AZ/AL figures cross-checked byte-for-byte against `scripts/loadStateGF.mjs` `controlTotalGF` |
| 2 | ~10-state roster locked with documented substitutions | ✓ VERIFIED | `112-RECON.md` Section 3 Roster Lock Table: IN, AZ, OR, MO, CO, SC, KY, UT, AL, LA locked; OK→AL substitution reasoned (rank correction, not extraction failure) and bounded to one round (HI/NM/KS reviewed, not used) |
| 3 | Batch-1 (AZ/IN/CO/MO/KY) ACFR GF statement located: GENERAL FUND column, units, FY-end, durable URL pattern, clean window | ✓ VERIFIED | `112-BATCH1-SOURCES.md` Section 1 + 5 per-state detail blocks, all fields filled with real values (not placeholders) |
| 4 | Batch-1 bookend ties confirmed with actual dollar figures | ✓ VERIFIED | `112-BATCH1-SOURCES.md` Section 2 — all 5 states, both bookend years, $0 diff (KY OCR-quality caveat noted but tie still $0) |
| 5 | Batch-1 four risk facts pinned (units/negatives/column+statement/FY-end) | ✓ VERIFIED | `112-BATCH1-SOURCES.md` Section 3, filled for AZ/IN/CO/MO/KY, including CO's TABOR negative-line caution |
| 6 | Batch-1 recency floor (FY2023+FY2024) checked, AZ's Google-Drive URL flagged as load-phase decision (not a gap-log exclusion) | ✓ VERIFIED | `112-BATCH1-SOURCES.md` Section 5, AZ marked CONDITIONAL GREENLIGHT with explicit escalation, others GREENLIGHT |
| 7 | Batch-1 gap log + scope-vs-NASBO + loader-template mapping | ✓ VERIFIED | `112-BATCH1-SOURCES.md` Sections 4, 6, 7 all filled |
| 8 | Batch-2 (OR/SC/LA/OK/UT) same 7-section recon complete | ✓ VERIFIED | `112-BATCH2-SOURCES.md` all 7 sections + 5 detail blocks; bookend ties $0 diff (OR $1K rounding, documented as acceptable) |
| 9 | UT block locates state ACFR only, defers provenance check to 112-03 (RECON-10 scope discipline) | ✓ VERIFIED | `112-BATCH2-SOURCES.md` explicit scope note at top + UT detail block cross-reference; no DB probe in plans 112-01/02 (only Node source-code inspection of `loadStateGF.mjs`, confirmed by SUMMARY) |
| 10 | UT state-node provenance explicitly checked via read-only DB probe | ✓ VERIFIED (independently re-run) | `112-RECON.md` Section 5 + **live re-probe in this verification**: Utah state node = 2 rows, NASBO-only, 0 `data_sources` residue; 15 municipal rows confirmed distinct/untouched |
| 11 | Every roster state (+ substitution candidates) probed for pre-existing custom-source rows; in-place upgrade plan where needed | ✓ VERIFIED (independently re-run) | `112-RECON.md` Section 5 table of 11 states; **live re-probe confirms every ID and every row count exactly** — all clean NASBO-only, no in-place-upgrade plan needed anywhere in this tranche |
| 12 | ACFR-replaces-NASBO contract stated: replace per state-FY idempotently/never-overwriting; un-upgraded states stay on `loadStateGF.mjs`; 19 existing ACFR nodes undisturbed | ✓ VERIFIED | `112-RECON.md` Section 8 (Untouched-Nodes Contract + NASBO-Replace Rule); 19-node UUID table spot-checked live (MN, MI both resolve correctly, distinct from roster nodes) |
| 13 | Substitution round ran exactly once, documented with reason, failed/outgoing candidate lands in ACFRX-03, no second reach-down | ✓ VERIFIED | `112-RECON.md` Section 2 — OK out (rank correction) → AL in, full recon block for AL provided, HI/NM/KS explicitly reviewed-not-used |
| 14 | Final roster + 113/114 batch split locked with ACFR-2x ↔ state traceability mapping | ✓ VERIFIED | `112-RECON.md` Section 4 — Batch 1 = ACFR-21..25 (IN/AZ/OR/MO/CO), Batch 2 = ACFR-26..30 (SC/KY/UT/AL/LA), full reassignment table vs. the original proposed REQUIREMENTS.md order |
| 15 | 112-RECON.md consolidates both SOURCES docs into a decision-ready handoff mirroring 107-RECON.md, D-13 caveat stated, $0 spend / no DB writes confirmed | ✓ VERIFIED | `112-RECON.md` full document (391 lines), Success-Criteria Coverage checklist at bottom, D-13 caveat explicitly stated in Section 8 |
| 16 | No DB writes, no loader code, no frontend changes anywhere in the phase | ✓ VERIFIED | `git diff 3758d53..HEAD --stat` shows only `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, and the 6 new/modified phase-112 docs; live DB re-probe shows the pre-recon NASBO-only state is unchanged |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `112-RECON.md` | Consolidated decision-ready handoff: ranking, roster lock, batch split, substitution, overlap resolution, risk-fact table, gap-log rollup, untouched-nodes contract | ✓ VERIFIED | 391 lines, all 8 sections + Open Risks + Success-Criteria Coverage present, no placeholders, `gsd-sdk verify.artifacts` passed |
| `112-BATCH1-SOURCES.md` | Per-state ACFR source location for AZ/IN/CO/MO/KY (7 sections + 5 detail blocks) | ✓ VERIFIED | 252 lines, all sections filled with real figures, `gsd-sdk verify.artifacts` passed |
| `112-BATCH2-SOURCES.md` | Per-state ACFR source location for OR/SC/LA/OK/UT (7 sections + 5 detail blocks) | ✓ VERIFIED | 278 lines, all sections filled, UT overlap-scope note present, `gsd-sdk verify.artifacts` passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `112-BATCH1-SOURCES.md` / `112-BATCH2-SOURCES.md` per-state blocks | Phase 113/114 SOURCES-map + loader clone | durable per-year URL pattern + GF column index + units + template mapping | ✓ WIRED | Every locked state's block names a specific loader template (`processILAcfr.js`/`processPAAcfr.js` family) and documents the exact URL-enumeration strategy Phase 113/114 will need |
| `112-RECON.md` ranking table | plan 112-03 roster lock + substitution round | GF-size order of the remaining 31 states | ✓ WIRED | Section 2's substitution decision explicitly cites Section 1's ranking (AL rank 9 vs OK rank 14) |
| `112-RECON.md` locked roster + batch split | Phase 113 + Phase 114 loads | per-state window + template mapping + overlap-resolution plan | ✓ WIRED | Section 4 batch split + Section 3 roster table are both populated and internally consistent (same 10 states, same order) |
| `112-RECON.md` 19-nodes-untouched contract | the existing 19 ACFR nodes | read-only DB confirmation | ✓ WIRED | Section 8 lists all 19 node UUIDs; independently spot-checked live against the DB (MN, MI both resolve, distinct from roster) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RECON-09 | 112-01, 112-02, 112-03 | Rank 31 states, lock ~10-state roster, locate/tie-confirm/gap-log each locked state's ACFR GF statement | ✓ SATISFIED | `112-RECON.md` Sections 1-4, 6-7; REQUIREMENTS.md marked `[x]` and Traceability table shows "Complete" |
| RECON-10 | 112-02 (UT flag only), 112-03 (full resolution) | Resolve prior-load overlaps before any write; UT state-node provenance explicitly checked; NASBO-replace contract stated; 19 ACFR nodes undisturbed | ✓ SATISFIED | `112-RECON.md` Section 5 (independently re-verified live) + Section 8; REQUIREMENTS.md marked `[x]` |

No orphaned requirements — REQUIREMENTS.md's Traceability table maps only RECON-09 and RECON-10 to Phase 112, and both are accounted for by the plan frontmatter (`112-01-PLAN.md`: RECON-09; `112-02-PLAN.md`: RECON-09; `112-03-PLAN.md`: RECON-09, RECON-10).

### Anti-Patterns Found

None. Grepped all three deliverable docs for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented|not available` — zero matches. No scaffold placeholders remain (plan 112-01 scaffolded `112-RECON.md` Sections 2-7 as placeholders; plan 112-03 filled all of them — confirmed by reading the final document in full).

### Data Integrity Notes (informational, not gaps)

- **REQUIREMENTS.md's literal `ACFR-21..30: {state}` labels still show the pre-recon proposed mapping** (e.g., "ACFR-21: Arizona") while `112-RECON.md` Section 4 locks a corrected mapping (ACFR-21: Indiana, etc., differing on 8 of 10 slots due to the NASBO re-ranking + OK→AL substitution). This is explicitly flagged in both `112-RECON.md` (Section 4 note) and the 112-03 SUMMARY as a recommended REQUIREMENTS.md text-sync for Phase 113 kickoff, deliberately not made in this plan (out of its declared file scope of `112-RECON.md` only). Not a gap for Phase 112 — RECON-09/RECON-10 do not require editing REQUIREMENTS.md's ACFR-2x descriptions, and the locked mapping is unambiguous and authoritative in the RECON doc. Flagged here for whoever plans Phase 113 to pick up.
- Three load-phase decisions are carried forward (not resolved, correctly deferred per D-03/D-09): AZ's non-durable FY2024 Google Drive URL, UT's GF-alone-vs-GF+Income-Tax-Fund scope question, AL's GF-alone-vs-GF+Education-Trust-Fund scope question. These are explicitly documented as Phase 113/114 decisions in `112-RECON.md`'s Open Risks section, not silently dropped.

### Human Verification Required

None. This is a documentation-only, read-only recon phase. All claims are checkable against static text (the two SOURCES docs, the ranking source code) or a live read-only DB query, both of which were performed in this verification pass.

### Gaps Summary

No gaps found. All 16 derived truths verified, all 3 required artifacts pass existence + substance checks, all 4 key links are wired, both requirements (RECON-09, RECON-10) are satisfied, and the phase's own claims about zero DB writes / zero loader-code changes / zero frontend changes were independently confirmed via `git diff --stat` and a live database probe — not just accepted from the SUMMARY narrative.

---

*Verified: 2026-07-02T23:10:00Z*
*Verifier: Claude (gsd-verifier)*
