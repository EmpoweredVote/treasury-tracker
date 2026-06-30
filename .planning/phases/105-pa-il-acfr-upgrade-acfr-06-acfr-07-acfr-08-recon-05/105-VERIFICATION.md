---
phase: 105-pa-il-acfr-upgrade
verified: 2026-06-30T20:15:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
resolved_gaps:
  - truth: "A negative GENERAL FUND category in any IL FY is clamped to 0 for render with the signed magnitude in the label; the parent total preserves the net (ACFR-08 / P2)"
    status: resolved
    resolved_in: "5eaa3a9 fix(105): add ACFR-08 P2 clamp to IL expenditure loader (gap closure)"
    reason: "processILAcfr.js buildTree now uses clampForRender + 'c.total !== 0' filter + '(net loss — shown at 0)' label, in lockstep with processPAAcfr.js. Re-confirmed: node --check passes; all 5 IL operating FYs (FY2021-2025) still dry-run validate PASS at 0 diff; rendered tree byte-identical for current all-positive data (zero DB impact). The ACFR-08 guarantee is now implemented on the IL expenditure path."
deferred:
  - truth: "Each state independently re-derived from its own ACFR (not loader self-report); full 50-node cohort source-chain audit clean (VER-03)"
    addressed_in: "Phase 106"
    evidence: "REQUIREMENTS.md: 'VER-03 | Phase 106 | Pending' — independent re-derivation + cohort audit explicitly scoped to Phase 106"
  - truth: "Live-app UAT (revenue-by-source + spending-by-function + basis label + source chip + Money In) with Chris sign-off (VER-04)"
    addressed_in: "Phase 106"
    evidence: "REQUIREMENTS.md: 'VER-04 | Phase 106 | Pending' — Chris UAT explicitly scoped to Phase 106"
---

# Phase 105: PA + IL ACFR Upgrade Verification Report

**Phase Goal:** Load PA + IL GF revenue-by-source + GAAP spending-by-function from their ACFRs, replacing their NASBO operating rows idempotently.
**Verified:** 2026-06-30T20:15:00Z
**Status:** passed (1 gap found during verification, closed in-phase — commit 5eaa3a9)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PA + IL state nodes show ACFR-sourced GF revenue-by-source + GAAP spending-by-function, each FY tying to ACFR GF column totals, GAAP-basis-labelled + per-year-stamped | VERIFIED | DB: PA 20 rows (10 op FY2016-25 + 10 rev FY2016-25), IL 10 rows (5 op + 5 rev FY2021-25). All labels confirmed "…ACFR — General Fund…GAAP basis". Bookends: PA FY2024 rev 91,293,027,000 / FY2023 rev 95,231,042,000 MATCH; IL FY2025 rev 78,342,927,000 / FY2023 rev 73,827,795,000 MATCH. All source_url SET. |
| 2 | NASBO operating rows replaced idempotently (never-overwrite); un-upgraded states unchanged; Money In auto-enables on PA/IL | VERIFIED | DB: PA 0 NASBO labels, IL 0 NASBO labels. Idempotency: live re-run "Loaded 0 rows" all FY PA operating. GA (un-upgraded NASBO) unchanged: 2 rows, NASBO labels intact. PA revenue row count: 10 (Money In enabled). IL revenue row count: 5 (Money In enabled). IL out-of-window rows (pre-FY2021): 0. |
| 3 | validate() refuses to write (exit 2) on any FY whose category sum does not tie to the printed General Fund total | VERIFIED | All four loaders: validate() calls process.exit(2) when Math.abs(catSum - total) > 10_000. Dry-runs confirm 10/10 PA FY PASS, 5/5 IL FY PASS, zero "sum ≠ total" lines. Independent arithmetic re-check of PA FY2016/2023/2024 exp + rev categories and IL FY2022 rev + FY2025 exp all tie at 0 diff. |
| 4 | PA: negative GENERAL FUND categories (any FY) clamped to 0 for render with signed label; IL revenue: same via clampForRender | VERIFIED | processPAAcfr.js + processPARevenueAcfr.js: clampForRender + '!== 0' filter + net-loss label wired (lines 210-223, 196-204). processILRevenueAcfr.js: clampForRender wired; IL FY2022 "Interest and other investment income" (−197,857K) confirmed in live budget_categories as amount=0, label="Interest and other investment income (net loss — shown at 0)", root total 73,204,339,000. No negative PA GF categories found across FY2016-2025. |
| 5 | IL expenditure loader clamps negative GF expenditure categories per ACFR-08 / P2 | VERIFIED (resolved in 5eaa3a9) | Gap closed during phase execution: processILAcfr.js buildTree now uses `clampForRender` + `c.total !== 0` filter + `(net loss — shown at 0)` label, identical to processPAAcfr.js. Re-confirmed `node --check` passes and all 5 IL operating FYs still dry-run validate PASS at 0 diff. Zero DB impact (current data all-positive → rendered tree byte-identical). The ACFR-08 guarantee is now implemented on the IL expenditure path. |
| 6 | PA + IL SOURCES are durable: PA FY2024/2025 use %20 URL; IL uses explicit audited-only per-year filenames (no Interim/unaudited) | VERIFIED | SOURCES[2024].url and SOURCES[2025].url confirmed to contain '%20acfr.pdf' in both PA loaders. IL SOURCES: all 5 entries use 'ACFR%20Final…' filenames; audited-only rule documented in header comments; grep of IL SOURCES URLs returns no "Interim" or "unaudited" in URLs. |

**Score:** 6/6 truths verified (Truth 5 gap closed in-phase — commit 5eaa3a9)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Independent re-derivation + 50-node cohort source-chain audit (VER-03) | Phase 106 | REQUIREMENTS.md Traceability: "VER-03 | Phase 106 | Pending" |
| 2 | Live-app UAT with Chris sign-off across PA/IL + deepened pilots (VER-04) | Phase 106 | REQUIREMENTS.md Traceability: "VER-04 | Phase 106 | Pending" |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/processPAAcfr.js` | PA GF spending-by-function loader (dataset_type='operating'), FY2016-2025 | VERIFIED | 279 lines; contains treasury_sync_budget_tree, clampForRender, p_dataset_type:'operating'; dataSource returns GAAP-basis label; SOURCES FY2024/25 use %20 |
| `scripts/processPARevenueAcfr.js` | PA GF revenue-by-source loader (dataset_type='revenue'), FY2016-2025 | VERIFIED | 257 lines; clampForRender + '(net loss — shown at 0)' path present; TX-trap scope note in header; p_dataset_type:'revenue'; bookend FY2024=91,293,027,000 / FY2023=95,231,042,000 confirmed in dry-run |
| `scripts/processILAcfr.js` | IL GF spending-by-function loader (dataset_type='operating'), FY2021-2025 | VERIFIED | 204 lines; treasury_sync_budget_tree + RPC wiring; clampForRender + '!== 0' filter + net-loss label added in 5eaa3a9 (WR-02 closed); 5/5 FY dry-run PASS at 0 diff |
| `scripts/processILRevenueAcfr.js` | IL GF revenue-by-source loader (dataset_type='revenue'), FY2021-2025 | VERIFIED | 209 lines; clampForRender + net-loss label; IL FY2022 P2 clamp confirmed live; SOURCES explicit audited-only; p_dataset_type:'revenue'; bookends confirmed |
| `.planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-PA-IL-LOADLOG.md` | Per-state load disposition, NASBO-replacement, accept-relabel, idempotency, cohort-untouched | VERIFIED | File exists with finalized "Load Disposition" section; per-state FY tables; NASBO-replacement confirmation; D-04 divergence record (PA ~2.19×, IL ~1.57× at FY2023); idempotency re-run results; cohort spot-check (CA/TX/NY/FL/GA/OH) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| processPAAcfr.js | treasury.budgets PA state node (operating) | treasury_sync_budget_tree RPC keyed (muni,fy,'operating') + source-stamp UPDATE | WIRED | DB confirms 10 operating rows FY2016-25, all GAAP-labelled, source_url SET |
| processPARevenueAcfr.js | treasury.budgets PA state node (revenue) | treasury_sync_budget_tree RPC keyed (muni,fy,'revenue') + source-stamp UPDATE | WIRED | DB confirms 10 revenue rows FY2016-25, bookend totals match |
| processILAcfr.js | treasury.budgets IL state node (operating) | treasury_sync_budget_tree RPC keyed (muni,fy,'operating') | WIRED | DB confirms 5 operating rows FY2021-25, GAAP-labelled, NASBO replaced |
| processILRevenueAcfr.js | treasury.budgets IL state node (revenue) | treasury_sync_budget_tree RPC keyed (muni,fy,'revenue') | WIRED | DB confirms 5 revenue rows FY2021-25, IL FY2022 P2 clamp in budget_categories |
| SOURCES FY2024/25 entries (PA) | pa.gov ACFRs | %20 literal-space URL special-case | WIRED | SOURCES[2024].url = '…june-30-2024%20acfr.pdf'; SOURCES[2025].url = '…june-30-2025%20acfr.pdf' in both PA loaders |
| SOURCES FY2021-25 entries (IL) | illinoiscomptroller.gov CAFR Final PDFs | Explicit per-year audited 'ACFR Final …' filenames (no Interim) | WIRED | SOURCES entries: ACFR%20Final%202021.pdf, ACFR%20Final%20FY%202022.pdf, ACFR%20Final%202023%20-%20Bookmarked.pdf, etc. — no Interim/unaudited in any URL |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| processPAAcfr.js → treasury.budgets | EXPENDITURES[fy] (hardcoded ACFR transcription) | PA ACFR PDFs (pdftotext -table), bookend-verified | Yes — all 10 FY categories sum to printed total at 0 diff; DB rows confirmed | FLOWING |
| processPARevenueAcfr.js → treasury.budgets | REVENUE[fy] (hardcoded ACFR transcription) | PA ACFR PDFs (pdftotext -table), bookend-verified | Yes — all 10 FY; FY2024 91,293,027,000 / FY2023 95,231,042,000 in DB | FLOWING |
| processILAcfr.js → treasury.budgets | EXPENDITURES[fy] (hardcoded ACFR transcription) | IL ACFR Final PDFs (audited-only), bookend-verified | Yes — all 5 FY; DB totals match (e.g. FY2025 75,456,922,000) | FLOWING |
| processILRevenueAcfr.js → treasury.budgets | REVENUE[fy] (hardcoded ACFR transcription) | IL ACFR Final PDFs (audited-only), bookend-verified | Yes — all 5 FY; FY2022 P2 clamp live in budget_categories; FY2025 78,342,927,000 in DB | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| PA operating dry-run: 10/10 FY PASS | `node scripts/processPAAcfr.js --dry-run` | 10 "validation: PASS", 0 "sum ≠ total" lines, Done. | PASS |
| PA revenue dry-run: FY2023/2024 bookend totals | `node scripts/processPARevenueAcfr.js --dry-run` | FY2023 TOTAL REVENUES 95,231,042,000 / FY2024 91,293,027,000 confirmed | PASS |
| IL operating dry-run: 5/5 FY PASS | `node scripts/processILAcfr.js --dry-run` | 5 "validation: PASS", Done. | PASS |
| IL revenue dry-run: FY2022 P2 clamp note + FY2025 bookend | `node scripts/processILRevenueAcfr.js --dry-run` | "[Note: Interest and other investment income true value: -197,857,000 (net loss — shown at 0)]" printed; FY2025 TOTAL 78,342,927,000 | PASS |
| PA operating idempotency live | import('./scripts/processPAAcfr.js') | "Loaded 0 rows" for all 10 FY — 0 net change | PASS |
| DB: PA bookend totals | Supabase query | PA FY2024 operating 89,446,895,000 MATCH; PA revenue rows: 10; IL revenue rows: 5 | PASS |
| DB: NASBO replaced + IL P2 clamp live | Supabase query | PA NASBO: 0 remaining; IL NASBO: 0 remaining; IL FY2022 budget_categories amount=0 with net-loss label | PASS |
| DB: cohort untouched | Supabase query | GA: 2 rows, NASBO labels intact; IL out-of-window (pre-FY2021): 0 rows | PASS |
| Independent arithmetic: PA FY2016/2023/2024 categories | node -e manual sum | All 0 diff vs EXPENDITURES/REVENUE totals | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ACFR-06 | 105-01, 105-03 | PA GF revenue-by-source + GAAP spending-by-function on PA state node | SATISFIED | DB: 10 op + 10 rev rows FY2016-25; GAAP-labelled; NASBO replaced; RECON-05 confirmed |
| ACFR-07 | 105-02, 105-03 | IL GF revenue-by-source + GAAP spending-by-function on IL state node | SATISFIED | DB: 5 op + 5 rev rows FY2021-25; GAAP-labelled; NASBO replaced; P2 clamp live for revenue |
| ACFR-08 | 105-01, 105-02, 105-03 | Negative GF categories render via P2 clamp (0 area + signed label + net root total) | VERIFIED | All four loaders now implement clampForRender + '!== 0' filter + net-loss label. IL expenditure path closed in 5eaa3a9. Live IL FY2022 revenue clamp confirmed in budget_categories. |
| RECON-05 | 105-01, 105-02, 105-03 | NASBO rows replaced idempotently; un-upgraded states unchanged; CA/TX/NY/FL undisturbed | SATISFIED | DB: 0 NASBO labels on PA/IL; GA unchanged; idempotency "Loaded 0 rows" confirmed |
| VER-03 | — (Phase 106) | Independent re-derivation + 50-node cohort audit | DEFERRED | Phase 106 per REQUIREMENTS.md Traceability |
| VER-04 | — (Phase 106) | Live-app UAT with Chris sign-off | DEFERRED | Phase 106 per REQUIREMENTS.md Traceability |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| scripts/processILAcfr.js | 144 | ~~`filter(c => c.total > 0)` — no clampForRender, no net-loss label~~ | RESOLVED (5eaa3a9) | Closed in-phase: now `clampForRender` + `!== 0` filter + net-loss label, in lockstep with processPAAcfr.js. 5/5 FY still dry-run PASS at 0 diff; zero DB impact. |
| scripts/processILRevenueAcfr.js | N/A | P2 root-vs-child-sum invariant: root carries net, children sum to gross+clampedMag (IL FY2022: Σchildren = 73,402,196K; root = 73,204,339K; off by 197,857K clamped amount) | WARNING (WR-01) | Icicle renderer must tolerate Σchildren > parent for clamped-negative FYs; no explicit assertion exists |
| All four loaders | 212/190/136/142 | validate() tolerance = ±10,000 thousands (±$10M) | WARNING (WR-03) | All data ties at 0 diff so no risk today; a transposed-digit error of up to $9.999M would pass silently |
| All four loaders | 230-231 | `--fy` accepts garbage input without validation; `strict: false` means `--dryrun` typo runs live | WARNING (WR-04) | Operator safety: a mistyped `--dry-run` flag performs a live write |
| scripts/processPARevenueAcfr.js | 34 | "Older FY TBD" in JSDoc comment | INFO | Refers to pre-FY2016 scope (outside this phase's loaded window); clamp explicitly noted as "wired for safety" in the same line — mitigation is in place, this is a scope documentation note not an unresolved task |
| All four loaders | 245-247 | data_sources upsert is check-then-act (non-atomic) | WARNING (WR-05) | Race/duplicate risk if loaders run concurrently; low probability in practice |

### Gaps Summary

**One gap was found during verification and closed in-phase (commit 5eaa3a9):** `processILAcfr.js` buildTree used `filter(c => c.total > 0)` — a negative IL General Fund expenditure category would have been silently dropped from the rendered icicle with no label, no zero-area node, and no console note, violating the ACFR-08 must_have. The fix adds `clampForRender` and switches to the `!== 0` filter with clamp + net-loss label, matching processPAAcfr.js exactly. IL expenditure data for FY2021-FY2025 has no negative categories, so no citizen-visible data was ever wrong and no DB reload was required; `node --check` passes and all 5 FYs still dry-run validate PASS at 0 diff.

**All phase deliverables are fully achieved:** PA + IL data is live, correct, GAAP-labelled, NASBO-replaced, idempotent, with Money In enabled, and all four loaders now implement the ACFR-08 P2 clamp.

**Non-blocking follow-ups for later attention (from code review, not gating this phase):** WR-01 (P2 clamp breaks the `parent.a == Σ child.a` invariant — renderer must tolerate Σchildren > parent on clamped-negative FYs), WR-03 (tighten validate() tolerance toward 0), WR-04 (`strict: false` arg parsing — a mistyped `--dry-run` performs a live write), WR-05 (non-atomic data_sources check-then-insert → prefer upsert).

---

_Verified: 2026-06-30T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
