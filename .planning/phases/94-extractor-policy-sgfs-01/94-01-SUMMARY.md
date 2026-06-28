---
phase: 94-extractor-policy-sgfs-01
plan: 01
subsystem: database
tags: [nasbo, state-general-fund, etl, loader, sourcing, icicle, supabase-rpc]

requires:
  - phase: 93-verification-source-chain-audit-uat-mnver-01-mnver-02
    provides: MN ACFR state-node template (processMN.js) + the 50-state unsourced-estimate discovery
provides:
  - Locked 50-state GF sourcing decision (hybrid NASBO-now / ACFR-later; MN kept as ACFR gold-standard)
  - Locked cross-cutting policy (FY-depth, negative-category render rule, per-node basis label, source-stamp contract, no-fabrication)
  - Reusable NASBO state GF loader (scripts/loadStateGF.mjs) with offline-tested pure helpers
  - Georgia FY2023 GF operating proven end-to-end (real, sourced, 0-estimate, idempotent)
affects: [phase-95-mn-history-oh-va-redo, phase-96-remaining-states, phase-97-cohort-verification-uat]

tech-stack:
  added: []
  patterns:
    - "NASBO SER per-state GF extraction = visual read + dual checksum (row GF+Fed+Other+Bonds=Total; 7-function GF sum=Table 1 GF)"
    - "Per-node basis label as the mixed-basis mitigation (data_source carries 'budgetary basis' vs 'GAAP')"
    - "Negative-category icicle rule: clamp render area to 0, retain signed value in label, carry source total"

key-files:
  created:
    - .planning/phases/94-extractor-policy-sgfs-01/94-01-SPIKE.md
    - .planning/phases/94-extractor-policy-sgfs-01/94-01-POLICY.md
    - scripts/loadStateGF.mjs
    - scripts/loadStateGF.test.mjs
  modified: []

key-decisions:
  - "Source = hybrid: NASBO now (all 50 breadth), ACFR upgrades for high-traffic states later (Chris, 2026-06-27)"
  - "Keep Minnesota as the ACFR gold-standard outlier; do NOT re-do MN under NASBO (Chris)"
  - "Census ASSGF disqualified — all-funds basis, cannot back a 'General Fund' node"
  - "Mixed basis accepted ONLY because every node self-declares basis + resolving source (per-node basis label)"
  - "NASBO nodes are operating-only; per-state revenue-by-source defers to ACFR (NASBO has no per-state revenue-by-source)"

patterns-established:
  - "Loader proves on 1 state then scales by adding verified per-state entries; Phase 96 builds the bulk parser with the same checksums"
  - "0-NULL source invariant enforced by targeted post-RPC UPDATE (source_url+source_date+data_source); never treasury_sync_city_budget"

requirements-completed: [SGFS-01]

duration: ~115min
completed: 2026-06-27
---

# Phase 94: State GF Extractor + Policy — Summary

**Chose NASBO as the uniform 50-state General Fund source (hybrid with ACFR-later, MN kept as ACFR gold-standard), locked the cross-cutting policy, built a reusable source-stamping loader, and proved it on Georgia FY2023 — real, sourced, 0-estimate, idempotent.**

## Performance
- **Duration:** ~115 min
- **Tasks:** 4 of 4 (incl. 1 blocking Chris checkpoint)
- **Files created:** 4 (2 planning docs, loader, test)

## Accomplishments
- **Sourcing decided on evidence:** evaluated NASBO SER + Fiscal Survey, Census ASSGF, and per-state ACFR across 6 criteria. Census disqualified (all-funds, not GF). NASBO is the only uniform GF-basis, all-50, free, multi-year, build-once/load-many source.
- **Chris locked (BLOCKING checkpoint):** hybrid (NASBO now, ACFR later) + keep MN as ACFR gold-standard. Mixed basis accepted *conditionally* on a mandatory per-node basis label.
- **Policy locked for all 50 states:** actuals-only FY window; negative-category render rule (clamp area→0, keep signed value in label, carry source total); node label + basis label; 0-NULL source-stamp contract; no-fabrication rule; idempotency + targeted write.
- **Loader built + proven:** `scripts/loadStateGF.mjs` builds the GF operating (spending-by-function) tree, source-stamps every row, is idempotent, with pure helpers unit-tested offline (10/10). Georgia FY2023 loaded to production: 6 functions + total **$29.266B** tie to NASBO Table 1 GF within **0.03%**, source fields 0-NULL, re-run = no change.

## Task Commits
1. **Task 1+2: Sourcing spike + locked decision** — `3e40520` (spike)
2. **Task 3: Cross-cutting policy** — `64d36c5` (policy)
3. **Task 4: NASBO loader + Georgia proof** — `223fb40` (feat)

## Files Created/Modified
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-SPIKE.md` — sourcing evaluation matrix + locked decision + build-time findings
- `.planning/phases/94-extractor-policy-sgfs-01/94-01-POLICY.md` — locked cross-cutting rules (P1–P6) for Phases 95/96
- `scripts/loadStateGF.mjs` — reusable NASBO state GF operating loader (pure helpers + DB load + source-stamp)
- `scripts/loadStateGF.test.mjs` — 10 offline unit tests for the pure helpers

## Key Findings (recorded in SPIKE/POLICY)
1. **NASBO basis ≈ ACFR (~2%, not 3×).** NASBO MN GF FY2023 $27.24B vs MN ACFR $26.65B → per-node basis label is a sufficient honesty mitigation.
2. **NASBO has no per-state revenue-by-source** (national-aggregate only). Revenue-by-source defers to the ACFR upgrade; NASBO nodes are **operating-only**.
3. **NASBO PDF text extraction misaligns** (blank cells collapse columns). Figures must be read visually and checksum-validated; Phase 96's bulk parser must enforce the same checksums.

## Deviations from Plan
**[Source-reality — revenue scope]** Found during Task 4. The plan asked the loader to build operating + revenue trees from the chosen source. NASBO publishes no per-state revenue-by-source, so the loader builds the **operating** tree and revenue-by-source is deferred to the ACFR upgrade (consistent with the locked hybrid). Documented in SPIKE finding #2 and POLICY P3. Not a new decision — it follows directly from Chris's hybrid lock.

**Total deviations:** 1 (scope clarification driven by source reality; no architectural change). **Impact:** none to SGFS-01 — operating GF is sourced + proven; revenue path is explicitly assigned to the ACFR upgrade.

## Self-Check: PASSED
- `node --test scripts/loadStateGF.test.mjs` → 10 pass / 0 fail
- Georgia FY2023 operating: total_budget 29,266,000,000; 6 function categories; source_url + source_date + data_source all non-NULL (`zero_null_source_ok=true`); leaf sum 29,274,000,000 ties Table 1 GF (0.03%)
- Idempotent re-run: 7 categories / total 29,266,000,000 unchanged
- Artifacts exist: 94-01-SPIKE.md, 94-01-POLICY.md (`contains` NASBO/negative ✓), scripts/loadStateGF.mjs (`contains` source_url ✓)
