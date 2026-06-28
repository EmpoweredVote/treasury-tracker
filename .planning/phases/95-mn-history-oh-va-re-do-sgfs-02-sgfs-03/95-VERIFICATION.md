---
status: passed
phase: 95-mn-history-oh-va-re-do-sgfs-02-sgfs-03
requirements: [SGFS-02, SGFS-03]
verified: 2026-06-28
method: inline (no subagents, per feedback_no_research_subagents) — goal-backward via live Supabase DB probes
---

# Phase 95 Verification — MN History + OH/VA Re-do (SGFS-02, SGFS-03)

**Goal:** Extend Minnesota back + replace the two falsely-sourced state nodes (Ohio, Virginia) with real State-ACFR GAAP actuals. **Verdict: PASS.**

Verification was performed goal-backward by probing the live `treasury.budgets` table directly (the source of truth) after each plan completed, not by trusting executor self-reports.

## Success Criteria (ROADMAP)

### 1. MN state node extended, sourced, FY2022 negative-revenue policy applied — PASS
- MN operating + revenue rows now span **FY2008–FY2025** (18 years each, 36 rows): 15 new FY2008–FY2022 rows added to the pre-existing FY2023–25. All 0-NULL (`source_url`/`source_date`/`data_source`).
- Each year's category sum ties to its published ACFR General Fund total within the $10M P-94 tolerance (0-diff reported on all 15 new years).
- **FY2022 negative-revenue (P2) applied:** Investment/Interest Income −$350,456,000 rendered at area 0, true signed value retained in the leaf label ("net loss — shown at 0"), root total = audited Total Revenues $31,743,414,000 verbatim (not recomputed from clamped leaves). DB confirms FY2022 revenue `total_budget` = 31,743,414,000.
- D-95-06 label fix: all 36 MN rows re-stamped with the mandated ", GAAP basis" suffix (commit c19d056), making MN consistent with OH/VA.

### 2. OH + VA estimate nodes replaced with real ACFR GAAP actuals; false stamps corrected — PASS
- **Ohio:** 12 rows FY2020–FY2025 (operating + revenue), all sourced to `archives.obm.ohio.gov` ACFR PDFs, GAAP-basis labels, 0-NULL. FY2024 ties exactly to the independently-confirmed checksums (TOTAL EXP $45,119,494K / TOTAL REV $45,752,716K). Window extended from the planned FY2022–25 to FY2020–25 per user decision (PDFs on hand). FY2022 OH revenue also had a negative Investment Income (−$570,453K) → P2 applied.
- **Virginia:** 8 rows FY2022–FY2025 (operating + revenue), all sourced to `doa.virginia.gov` section-G PDFs, GAAP-basis labels, 0-NULL. FY2022 negative investment income (−$498,365K) → P2 applied.
- **False stamps corrected:** the prior estimate rows (OH `lsc.ohio.gov/budget`, VA `dpb.virginia.gov/budget` with NULL source_date) are gone. The orphaned FY2026 estimate rows the RPC could not overwrite were deleted by the dedicated cleanup (Plan 05). Final probe: OH = 12 rows (FY2020–2025), VA = 8 rows (FY2022–2025), **0 FY2026 rows, 0 NULL stamps, 0 rows referencing lsc.ohio.gov / dpb.virginia.gov / 'estimated'** for either node.

## Requirements Traceability
- **SGFS-02** (MN extended FY2008–2022, GAAP actuals, sourced, FY2022 policy) → Plans 95-01, 95-02 → VERIFIED.
- **SGFS-03** (OH + VA falsely-sourced rows replaced with ACFR GAAP actuals, false stamps corrected) → Plans 95-03, 95-04, 95-05 → VERIFIED.

## Policy Conformance (Phase-94 P1–P6)
- P1 actuals-only window: only closed published-ACFR FYs loaded; no FY2026/future estimate survives.
- P2 negative-category render rule: applied to MN FY2022, OH FY2022, VA FY2022.
- P3 mandatory per-node GAAP basis label: all MN/OH/VA rows carry "… GAAP basis".
- P4 0-NULL source-stamp + targeted post-RPC UPDATE: every loaded row has non-NULL source_url/source_date/data_source; never `treasury_sync_city_budget`; never `budgets.data_source_id` (loaders pass `p_data_source_id` to the RPC only).
- P5 no fabrication: every year's figures tie to its published ACFR total (validate gate).
- P6 idempotency: re-runs reported 0 net row changes; cleanup second run deleted 0.

## Notes / Minor Deviations (non-blocking)
- Extraction: `pdftotext -table` extracted all states' GENERAL FUND columns cleanly (0-diff), so render-to-image was not needed despite being planned as the primary technique. FY2024 OH was cross-checked against a rendered image to validate the `-table` approach.
- `processOHAcfr.js` header carries a factual comment mentioning `lsc.ohio.gov` (describing what it supersedes). It is documentation only — no DB row references the old source. Left as-is.
- Ohio window extended to FY2020–FY2025 (6 years) vs the original FY2022–25 plan, after the full set of ACFR PDFs was downloaded; cleanup keep-window made per-state (OH 6yr / VA 4yr) accordingly.

**Deferred (out of scope, as planned):** MN FY1997–2007 (pre/early-GASB-34); the remaining ~46 state nodes (Phase 96 / SGFS-04); cohort-wide source-chain audit + UAT (Phase 97 / SGFS-05).
