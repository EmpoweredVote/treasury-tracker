---
phase: 116-verification-source-chain-audit-uat-ver-07-ver-08
verified: 2026-07-03T20:15:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 116: Verification — Source-Chain Audit + UAT (VER-07, VER-08) Verification Report

**Phase Goal:** Every newly loaded state-FY (tranche 3 + deepening) is independently re-derived from its own ACFR, the full 50-state cohort audit stays clean with zero residue and no manual re-clean, and Chris signs off in the live app.
**Verified:** 2026-07-03T20:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Loader-independent blind re-derivation of every newly loaded state-FY (tranche 3 + deepening) ties at exact $0 against printed ACFR GF totals — not loader self-report | ✓ VERIFIED | Independently re-ran `node scripts/verify-phase116-rederive.mjs` in this session: exit 0, **75/75 checks PASS (exact delta=0), 0 BLOCKED, 0 FAIL** — output byte-for-byte matches `116-REDERIVATION.md`'s per-check table (all 41 FY targets × dataset, 10 tranche-3 states + 4 deepened states). Confirmed the harness imports zero `scripts/process*.js` and zero `maAcfrExtract.mjs`/`pre34Extract.mjs`/`njAcfrExtract.mjs` modules (grep of all `^import` lines shows only Node built-ins: fs, child_process, https, http, path, url); DB access is via raw REST calls to `/rest/v1/budgets` and `/rest/v1/municipalities`, not any shared client/parser module. |
| 2 | Full 50-state cohort source-chain audit clean: 0 NULL/fragile/residue/out-of-window/dup/orphan; every displayed row basis-labelled; un-upgraded NASBO states still pass; 0 `data_sources` residue with no manual re-clean (LOAD-01 proven end-to-end) | ✓ VERIFIED | Independently re-ran `node scripts/verify-phase116-cohort-audit.mjs` in this session: exit 0, **12 PASS, 0 FAIL (of 12 invariants)** over 901 live `treasury.budgets` rows (29 ACFR + 21 NASBO states) — matches `116-COHORT-AUDIT.md` exactly, including INV-2 (0 stale `*-gf-*` data_sources currently present, corroborating the LOAD-01 residue-free claim is still holding, not just true at the moment it was first recorded), INV-6 (858/858 ACFR-labelled, 1 documented KY FY2023 NASBO exception), INV-8 (pre-GASB-34 label distinctness on CT/WI/MA), INV-9/10 (AL/MI Sep-30), INV-11 (exact loaded-FY-set match), INV-12 (GA supersede). The LOAD-01 idempotency re-run itself (SC + CT FY2025, 0 net change, 0 residue with no manual re-clean) is documented with before/after evidence in `116-COHORT-AUDIT.md` — not independently re-executed here to avoid an unnecessary live write, but the current 0-residue state confirmed by this session's INV-2 re-run is consistent with that record holding. |
| 3 | Live-app UAT across a representative sample of upgraded states + deepened history years — Chris sign-off | ✓ VERIFIED | `116-UAT-CHECKLIST.md` frontmatter: `status: passed`, `signed_off_by: Chris Cantrell`, `signed_off_date: 2026-07-03`, `production-confirmed: "2026-07-03 HTTP 200 at treasurytracker.empowered.vote"`. All 11 anchors recorded ✅ PASS (Chris, 2026-07-03), covering: IN units-sanity, MO largest clamp, AZ FY2024 Drive-caveat + honest FY2025 absence, KY honest-hole (rev absent / op NASBO exception), AL Sep-30, CT FY1988 pre-34 + year-selector reach, CT FY2006 OCR-recovered GAAP, NJ FY2002 full-dollars, MA FY2001 pre-34 + 4-hole honesty, WI FY2000 pre-34, AK NASBO-control regression. Independently re-confirmed production is live: `curl -sI https://treasurytracker.empowered.vote` → HTTP 200 in this session. Per task instructions this human checkpoint was not re-executed (authoritative human sign-off, not re-litigated). |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/verify-phase116-rederive.mjs` | Loader-independent blind ACFR re-derivation harness | ✓ VERIFIED | Exists, runs, exits 0; 0 loader/parser imports (only Node built-ins + raw REST); reproduced 75/75 exact ties in this session |
| `.planning/phases/116-.../116-REDERIVATION.md` | Per-FY independent tie log, headline verdict | ✓ VERIFIED | 41 FY targets → 75 checks documented; matches this session's independent harness output exactly |
| `scripts/verify-phase116-cohort-audit.mjs` | Read-only 50-node cohort audit incl. pre-GASB-34 invariant | ✓ VERIFIED | Exists, read-only, exits 0; reproduced 12/12 PASS in this session |
| `.planning/phases/116-.../116-COHORT-AUDIT.md` | Per-invariant results, row counts, hole reconciliation, LOAD-01 evidence | ✓ VERIFIED | 12/12 invariants, 901-row cohort table, 11-row hole-reconciliation table, LOAD-01 before/after all present and internally consistent |
| `.planning/phases/116-.../116-UAT-CHECKLIST.md` | Live-app UAT script + Chris sign-off | ✓ VERIFIED | 11 anchors, all PASS, frontmatter signed off by Chris Cantrell 2026-07-03, production-confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `verify-phase116-rederive.mjs` | source ACFR/CAFR PDFs | `pdftotext -table` + independent OCR (CT FY2006), no loader/parser import | ✓ WIRED | Independence confirmed by import grep; all 41 targets resolved from `_acfr-work/` cache with `%PDF` magic re-check |
| `verify-phase116-rederive.mjs` | `treasury.budgets` | read-only REST GET, resolves `municipality_id` by name | ✓ WIRED | Confirmed via `/rest/v1/budgets` and `/rest/v1/municipalities` calls in source; independently re-run, values matched |
| `verify-phase116-cohort-audit.mjs` | `treasury.budgets` + `treasury.data_sources` | read-only Supabase client queries | ✓ WIRED | Independently re-run, 12/12 PASS reproduced, no writes performed by the audit script itself |
| representative loaders (SC, CT FY2025) | `treasury.budgets` | guarded `treasury_sync_budget_tree` re-run | ✓ WIRED (per documented evidence) | Not re-executed in this verification session (would be a live write); documented before/after in `116-COHORT-AUDIT.md` shows 0 net change + 0 residue; corroborated indirectly by this session's fresh INV-2 pass (0 residue currently) |
| `116-UAT-CHECKLIST.md` anchors | treasurytracker.empowered.vote deep-links | `?entity={slug}&year={fy}&dataset={revenue\|operating}` | ✓ WIRED | Production HTTP 200 independently reconfirmed; anchor results recorded by Chris in the live app |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| VER-07 | 116-01, 116-02 | Loader-independent blind re-derivation + 50-state cohort audit clean, incl. LOAD-01 residue proof | ✓ SATISFIED | REQUIREMENTS.md marked `[x]`, Traceability table `Complete`; independently re-run harnesses both confirm 75/75 and 12/12 |
| VER-08 | 116-03 | Live-app UAT with Chris sign-off | ✓ SATISFIED | REQUIREMENTS.md marked `[x]`, Traceability table `Complete`; `116-UAT-CHECKLIST.md` signed off |

No orphaned requirements found for Phase 116 (only VER-07/VER-08 map to this phase in REQUIREMENTS.md's traceability table).

**Note (informational, not a Phase 116 gap):** REQUIREMENTS.md's traceability table still lists `ACFR-26..30` and `ACFR-31` as "Pending" for Phase 114, even though Phase 114 has its own `114-VERIFICATION.md` recording completion. This staleness predates Phase 116 (confirmed via `git show 0ea50ac -- .planning/REQUIREMENTS.md`, which shows Phase 116's only edits were to the VER-07/VER-08 rows). Out of scope for this phase's verification; flagged for awareness only.

### Anti-Patterns Found

None. Grepped all phase-116 artifacts (`scripts/verify-phase116-rederive.mjs`, `scripts/verify-phase116-cohort-audit.mjs`, `116-REDERIVATION.md`, `116-COHORT-AUDIT.md`, `116-UAT-CHECKLIST.md`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|coming soon` — 0 matches.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Blind re-derivation harness ties 75/75 at exact $0 | `node scripts/verify-phase116-rederive.mjs` | exit=0, "75 / 75 checks PASS (exact delta=0 required); 0 BLOCKED; 0 FAIL" | ✓ PASS |
| Harness independence (no loader/parser import) | `grep -n "^import\|require(" scripts/verify-phase116-rederive.mjs` | Only Node built-ins (fs, child_process, https, http, path, url) | ✓ PASS |
| Cohort audit passes all invariants | `node scripts/verify-phase116-cohort-audit.mjs` | exit=0, "12 PASS, 0 FAIL (of 12 invariants)" | ✓ PASS |
| Production is live | `curl -sI https://treasurytracker.empowered.vote` | HTTP/1.1 200 OK | ✓ PASS |
| Commits for all 3 plans exist and match SUMMARY claims | `git show --stat <hash>` for 6147be5, 7d280c9, 9ba3760, 15f7efa, 399efee, e28bee5 | All commits exist with matching messages/content | ✓ PASS |

### Probe Execution

Not applicable — this phase's deliverable IS the verification harnesses (per `116-VALIDATION.md`: "This phase's deliverable IS validation — two hard-gated harnesses + human UAT"). Both harnesses were run directly per Step 7b above rather than via a separate `scripts/*/tests/probe-*.sh` convention; no such probe files exist for this phase.

### Human Verification Required

None. The one human checkpoint required by this phase (Task 2 of plan 116-03, VER-08 live-app UAT) was already executed with an authoritative recorded sign-off (`status: passed`, `signed_off_by: Chris Cantrell`, `signed_off_date: 2026-07-03`, all 11 anchors PASS). Per task instructions, this checkpoint is not re-run by the verifier.

### Gaps Summary

No gaps found. Both independent-verification harnesses (`verify-phase116-rederive.mjs` and `verify-phase116-cohort-audit.mjs`) were re-run fresh in this verification session — outside of and independent from the SUMMARY.md narratives — and reproduced the exact claimed results (75/75 exact-$0 ties; 12/12 invariants PASS) byte-for-byte against the documented logs. The re-derivation harness's independence from loader/parser code was confirmed by direct source inspection. The UAT sign-off is complete and authoritative. Production is confirmed live. All commits referenced in the SUMMARYs exist in git history with matching content. Requirements VER-07 and VER-08 are correctly marked complete in REQUIREMENTS.md, with no orphaned requirement IDs for this phase.

---

_Verified: 2026-07-03T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
