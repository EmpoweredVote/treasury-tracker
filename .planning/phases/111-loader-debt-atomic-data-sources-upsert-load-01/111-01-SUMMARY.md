---
phase: 111-loader-debt-atomic-data-sources-upsert-load-01
plan: 01
subsystem: database
tags: [supabase, data_sources, loaders, acfr, idempotency, wr-05]

requires:
  - phase: 110-verification-source-chain-audit-uat-ver-05-ver-06
    provides: "verify-phase110-cohort-audit.mjs (the INV-2 residue oracle) + the NJ FY2025 idempotency re-run precedent"
provides:
  - "Ephemeral data_sources lifecycle (delete stale by dataset_id → insert → RPC/stamp → delete by id) in all 34 process*Acfr.js loaders + loadStateGF.mjs"
  - "111-RESIDUE-PROOF.md — live before/after proof that a loader run leaves 0 residue with no manual re-clean"
affects: [112-recon, 113-acfr-batch-1, 114-acfr-batch-2, 115-deepening, 116-verification]

tech-stack:
  added: []
  patterns: ["data_sources row = transient RPC parameter vehicle, never persisted (WR-05/LOAD-01 contract comment at each insert site)"]

key-files:
  created:
    - .planning/phases/111-loader-debt-atomic-data-sources-upsert-load-01/111-RESIDUE-PROOF.md
  modified:
    - scripts/process*Acfr.js (all 34)
    - scripts/loadStateGF.mjs

key-decisions:
  - "The WR-05 fix is NOT upsert(onConflict): budgets.data_source_id FKs to source_registry, so a persistent data_sources row is unreferenceable by design — the clean state is 0 state-loader rows, achieved by an ephemeral create→use→delete lifecycle"
  - "Deletes scoped to exact .eq('dataset_id')/.eq('id') only; sync_logs loss on cascade accepted (transient bookkeeping — durable provenance is the text-stamped budgets columns)"
  - "Crashed-run rows self-heal via the start-of-run delete; process.exit(2) paths intentionally not wrapped"
  - "loadStateGF.mjs (NASBO fallback) included — same residue class via {abbr}-gf-operating-nasbo"

patterns-established:
  - "Ephemeral RPC parameter vehicle: any loader needing treasury_sync_budget_tree creates its data_sources row fresh and deletes it at end of run"

requirements-completed: [LOAD-01]

duration: 35min
completed: 2026-07-02
---

# Phase 111 Plan 01: Ephemeral data_sources Lifecycle Summary

**All 35 state loaders now clean up their own data_sources rows — the WR-05 residue class that required manual deletion at every milestone close (106: 10 rows, 110: 20 rows) is closed, proven by a live NJ FY2025 re-run bracketed by the cohort-audit probe with zero manual cleanup.**

## What was done

- **Task 1 (commit `f713d3d`):** Codemod (strict per-line matching, 34/34 transformed + reported-on-mismatch) replaced the check-then-insert `.maybeSingle()` data_sources block in every `process*Acfr.js` with delete-by-dataset_id → insert, removed the vestigial `last_synced_at` updates, and added the end-of-run delete-by-id — after the FY loop in the 16 NJ-style loaders (in-loop placement would have broken multi-FY runs), in place of the post-loop update in the 18 MI-style loaders. `loadStateGF.mjs` hand-edited the same way inside `loadStateFY`. Verified: `node --check` 35/35, 0 `maybeSingle` remaining, exactly one delete pair per file, NJ `--dry-run` output byte-equivalent, 0 budgets/RPC code lines in the diff.
- **Task 2 (commit `9c1c145`):** Live proof per 111-RESIDUE-PROOF.md — audit 10/10 exit 0 before AND after `processNJAcfr.js --fy 2025` + `processNJRevenueAcfr.js --fy 2025`, **no manual re-clean**, 0 state `*-gf-*` rows after, NJ 12 rows / totals / FY2025 tree checksums byte-identical, city rows untouched.

## Deviations from plan

None.

## Verification

All three roadmap success criteria PASS — see verdict table in 111-RESIDUE-PROOF.md. Audit oracle `verify-phase110-cohort-audit.mjs` unmodified (git-clean).
