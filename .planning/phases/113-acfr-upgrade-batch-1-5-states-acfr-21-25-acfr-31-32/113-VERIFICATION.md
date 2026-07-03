---
phase: 113-acfr-upgrade-batch-1
status: passed
verified: 2026-07-02
verifier: inline goal-backward verification (orchestrator; per no-subagent policy)
---

# Phase 113 Verification — ACFR Upgrade Batch 1 (IN/AZ/OR/MO/CO)

**Goal:** The first ~5 roster states are upgraded NASBO→ACFR GAAP — GF revenue-by-source + finer spending-by-function, as deep as durable URLs allow, NASBO operating replaced idempotently.

**Verdict: PASSED — 14/14 checks.** All verification ran against the live DB (`mcp__supabase-local__execute_sql`), not loader self-report.

## Success Criterion 1 — ACFR-sourced, basis-labelled, full window, every FY ties

| # | Check | Result |
|---|-------|--------|
| 1 | Indiana: 24 op + 24 rev rows, FY2002–FY2025, 0 non-GAAP labels, 0 unstamped | ✅ |
| 2 | Arizona: 23 op + 23 rev rows, FY2002–FY2024 (FY2025 unpublished), 0 non-GAAP labels, 0 unstamped | ✅ |
| 3 | Oregon: 4 op + 4 rev rows, FY2022–FY2025 (D-06 honest window; no pre-2022 rows), 0/0 | ✅ |
| 4 | Missouri: 14 op + 14 rev rows, FY2012–FY2025, 0/0 | ✅ |
| 5 | Colorado: 3 op + 3 rev rows, FY2023–FY2025 (D-12 shallow window), 0/0 | ✅ |
| 6 | Tie integrity: every loaded FY validated against its printed GF column total before write (IN 24/24 $0, AZ 23/23 $0 after 5 hand-verified positional fixes, OR 4/4 within printed-rounding ≤3K, MO 14/14 $0 after 2 hand-verified wrap fixes, CO 3/3 $0); DB bookends re-queried: IN 22,101,900,000/7,341,746,000 · AZ 44,045,434,000/11,655,423,000 · OR 17,291,987,000/15,711,953,000 · MO 32,756,386,000/18,068,155,000 · CO 26,271,588,000 — all recon-exact | ✅ |

## Success Criterion 2 — NASBO replaced in place; idempotent; 0 residue

| # | Check | Result |
|---|-------|--------|
| 7 | 0 rows with a NASBO label remain on any of the 5 nodes; exactly one operating row per (state, fy) — dup query 0 on all 5 | ✅ |
| 8 | Idempotency: representative-FY live re-run per state (IN/MO/CO/AZ+rev, OR FY2025) → UPDATE-in-place, 0 net change | ✅ |
| 9 | `data_sources` residue for ALL five dataset_id prefixes ('in/az/or/mo/co-acfr-%') = **0** after 3+ live runs per state — Phase 111 LOAD-01 ephemeral lifecycle held under real use, no manual re-clean | ✅ |

## Success Criterion 3 — Honest relabel (ACFR-31) + P2 clamp (ACFR-32)

| # | Check | Result |
|---|-------|--------|
| 10 | Scope divergence recorded per state against pre-load NASBO baselines: AZ ~2.46× (Intergovernmental $25.2B), MO ~2.25× (Contributions and Intergovernmental $18.8B), CO ~1.81× (Federal Grants and Contracts $9.7B), OR ~1.07×, IN ~0.99× (near parity — Medicaid separate fund). All mechanisms match recon's pinned drivers; GAAP basis label on all 136 rows | ✅ |
| 11 | P2 clamp exercised on live data: CO TABOR FY2024 −1,214,908K + FY2025 −129,536K (standalone form; FY2023 netted form verified absent), MO 6 negative fair-value years (max −309,337K), IN FY2022 −30,464K, AZ FY2013 −9,970K + FY2022 −16,230K. Stored-tree assertion (CO FY2024): TABOR child at $0 with signed-magnitude label, root = printed total | ✅ |

## Success Criterion 4 — Money In auto-enable

| # | Check | Result |
|---|-------|--------|
| 12 | All 5 nodes have ≥1 dataset_type='revenue' row (IN 24, AZ 23, OR 4, MO 14, CO 3) — Money In enables data-driven, no frontend change | ✅ |

## Cohort-Untouched Contract

| # | Check | Result |
|---|-------|--------|
| 13 | 24 states now carry ACFR labels = exactly the 19 prior + the 5 batch-1 states (full name-list diff); prior-node row-count spot-checks (CA 36, PA 20, NJ 12) unchanged | ✅ |
| 14 | Batch-2 roster states (SC/KY/UT/AL/LA) + deferred OK + sample NASBO state (KS): 0 non-NASBO rows — untouched | ✅ |

## Notes for Phase 115 (verification phase)

- AZ FY2024's `source_url` is the caveated Google Drive link (locked decision executed; caveat in both loaders + 113-02-AZ-LOADLOG). Re-check for a migrated durable URL at next AZ touch.
- gao.az.gov's open Drupal JSON:API (`/jsonapi/file/file`) is the reliable URL-resolution path — recorded in 113-02-AZ-LOADLOG.
- Hand-verified extraction fixes (AZ 5 tiny Transportation values, MO 2 wrapped fair-value lines) are documented per-LOADLOG with printed-row evidence — independent re-derivation should reproduce them.
