# Phase 106: Verification + Source-Chain Audit + UAT (VER-03, VER-04) - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

The **verification capstone** of the v2.12 "State ACFR Long Tail" milestone. Prove that v2.12's added data — the **deepened CA / NY / FL history** (Phase 104) and the **new Pennsylvania + Illinois** State-ACFR GAAP nodes (Phase 105) — is real, independently sourced, residue-free across the whole 50-node cohort, and basis-labelled, then earn **Chris's live-app UAT sign-off**.

This phase follows the proven verification mold from **Phase 97 (v2.10)** and **Phase 102 (v2.11)**: independent re-derivation from source → 50-node cohort source-chain audit → live UAT. It is a **verification + audit + targeted-fix** phase — not a data-loading or frontend phase.

**In scope:**
- Independent re-derivation (re-extraction from each ACFR PDF, NOT loader self-report) of a risk-weighted sample of v2.12's added state-FY-datasets.
- Full 50-node cohort source-chain audit (0 NULL / fragile / residue / out-of-window / dup / orphan; every displayed row basis-labelled; un-upgraded NASBO states still pass).
- In-phase fixing of any data-correctness or source-chain defect found (F-97-01 precedent).
- Live-app UAT across the locked anchor set with Chris sign-off.

**Out of scope:**
- New data loading or window extension (that was Phases 104/105; CA FY2002–07 remains deferred).
- Any frontend/UI work (Money In + `?dataset=revenue` are data-driven, shipped in v2.11, untouched here).
- Cosmetic / code-quality polish (the 105 code-review WR-01/03/04/05 follow-ups) — logged, not gated.
- States beyond PA/IL (future milestone).
</domain>

<decisions>
## Implementation Decisions

### Re-derivation Coverage
- **D-01:** **Risk-weighted sample (~15–20 independent ties), not exhaustive.** Re-derive: both window bookends per deepened state (oldest + newest added FY for CA, NY, FL), **every negative-clamp year** (FL FY2021 + any NY/CA market-loss years + IL FY2022), PA + IL bookends, plus 1–2 random middle years per deepened state. This matches Phase 102's intent (16/16) scaled to v2.12's much larger added surface (CA +12, NY +12, FL +1, PA 20 rows, IL 10 rows) without re-doing all ~40+ added datasets. The load-time exact-tie `validate()` already covered every FY at load; this phase independently audits the failure-prone cases.

### Re-derivation Method (independence)
- **D-02:** **Blind re-extract from the source PDF.** For each sampled FY: re-run `pdftotext -table` on the source ACFR PDF and re-key the GENERAL FUND column line items **from scratch WITHOUT reading the loader's hardcoded data map**, then diff the independent total + line items against what is live in `treasury.budgets`. Compare only *after* extracting. This is the only method that catches a transposed-digit transcription error (the loader's own `validate()` checks the map against itself and cannot). It is the Phase 102 standard.

### Tolerance / "explained"
- **D-03:** **Exact 0-delta is the bar; explain-or-fix any delta — no silent tolerance band.** The data was loaded on exact tie (Phase 104 D-03, Phase 105), so a blind re-extract should reproduce it exactly. Any non-zero delta must be either (a) **explained** by a documented cause (a published restatement between ACFR editions, a printed "rounding" line, a units/scaling note) and recorded in the verification report, or (b) treated as a **defect to fix in-phase**. No fixed percentage/dollar tolerance band — a band can absorb a real transcription error (the 105 code-review WR-03 concern).

### UAT Anchor Set
- **D-04:** **Full representative anchor set (~8 anchors).** Chris tests live, each checking revenue-by-source + spending-by-function + basis label + source chip + Money In:
  - **PA** — a recent FY + a deep FY (FY2016 floor)
  - **IL** — a recent FY + **FY2022** (negative-clamp year)
  - **NY** — a deep floor year (~FY2003; exercises the ×millions scaling)
  - **CA** — **FY2008** (the clean-pattern floor / deepening boundary)
  - **FL** — **FY2021** (negative-clamp year)
  - **One un-upgraded NASBO control state** — confirm it still renders operating-only with the disabled Money In card (regression guard that the cohort wasn't disturbed)

### Discrepancy / Fix Policy
- **D-05:** **Fix data + source-chain defects in-phase; defer cosmetic.** Any data-correctness or source-chain defect (wrong number, NULL/fragile/stale source, residue, dup, orphan, missing basis label) is **fixed in-phase before sign-off** — the F-97-01 (GA Medicaid) and Phase-105 IL-clamp precedent. Genuinely cosmetic / non-blocking code-quality items (e.g., 105 code-review WR-01 root-vs-child-sum invariant note, WR-04 arg-parsing, WR-05 non-atomic upsert) are **logged for later, not gated**.

### Hole Verdict (logged 104 deepening gaps)
- **D-06:** **A logged hole is a PASS if recorded + honest in the UI.** Phase 104 D-02 permits skipped FYs (failed clean `-table` extract or failed exact tie) recorded in a per-state gap log. The audit accepts a hole as a PASS when: it is recorded in the 104 gap log **with a reason**, AND the live node renders the non-contiguous window **honestly** — per-FY rows, basis label + source chip make the gap self-evident, no interpolation, no implied continuity. The audit confirms the gap log matches what is actually missing in the DB. An honest, disclosed hole is not a defect; do NOT re-litigate gaps 104 judged unrecoverable.

### Claude's Discretion
- **Exact random-middle-year selection** within D-01 (which 1–2 mid-window FYs per state) — pick at verification time; document which were chosen so the sample is reproducible.
- **Exact `pdftotext` invocation** per state/year (page ranges, `-f/-l` bounds, light `-table` cleanup) — determined empirically, as in 104/98.
- **Audit query structure / SQL** for the 50-node cohort invariants — reuse/adapt the Phase 102 audit approach.
- **Plan structure / batching** (e.g., one plan for re-derivation, one for cohort audit, one for UAT prep vs. combined) — a planning decision.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements (the fixed phase boundary)
- `.planning/ROADMAP.md` — v2.12 milestone block + the **Phase 106** entry (goal + 3 success criteria). Critical path: 103 → (104 ∥ 105) → **106**.
- `.planning/REQUIREMENTS.md` — **VER-03** (each deepened pilot + PA + IL reconciled independently from its own ACFR, not loader self-report; full 50-node cohort source-chain audit stays clean; every displayed row basis-labelled; un-upgraded NASBO states still pass) and **VER-04** (live-app UAT across PA + IL + deepened pilot windows with Chris sign-off).

### What this phase must verify — the v2.12 loads (input contract)
- `.planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-PA-IL-LOADLOG.md` — **PA + IL load disposition of record:** per-(state, FY, dataset) rows loaded, NASBO-replacement confirmation, accept-and-relabel scope divergence (PA ~2.0×, IL ~1.5× NASBO GF), P2 clamp dispositions, idempotency result.
- `.planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-01-SUMMARY.md`, `105-02-SUMMARY.md`, `105-03-SUMMARY.md` — PA loaders / IL loaders / live-load results + bookend totals.
- `.planning/phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-VERIFICATION.md` — Phase 105's own verification (6/6, with the in-phase IL-clamp gap closure) — the starting state for the cohort audit.
- `.planning/phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-CONTEXT.md` — the deepened-pilot decisions (D-01 CA FY2008 floor, D-02 skip+log holes, D-03 exact tie) that 106 must honor when judging coverage + holes.
- Phase 104 SUMMARY + any per-state gap/tie log it produced — **the gap log D-06 checks against** (the deepened CA/NY/FL windows actually loaded, and which FYs were skipped + why).
- `.planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-DEEPEN-SOURCES.md` — per-pilot deepened windows, per-year URL patterns, units (NY ×millions, CA `/Files-ARD/CAFR/cafr{NN}web.pdf`), bookend ties — the source map for blind re-extraction (D-02).

### Loaders + source PDFs (re-extraction targets for D-02)
- `scripts/processPAAcfr.js`, `scripts/processPARevenueAcfr.js` — PA spend + revenue (FY2016–2025); each has a per-FY `SOURCES` map (url/date) for locating the source PDF.
- `scripts/processILAcfr.js`, `scripts/processILRevenueAcfr.js` — IL spend + revenue (FY2021–2025); audited-only "ACFR Final…" SOURCES.
- `scripts/processCA.js`, `scripts/processCARevenueAcfr.js`, `scripts/processNYAcfr.js`, `scripts/processNYRevenueAcfr.js`, `scripts/processFLAcfr.js`, `scripts/processFLRevenueAcfr.js` — deepened pilot loaders with the older-FY SOURCES keys added in 104.
- `scripts/loadStateGF.mjs` — NASBO fallback loader; the un-upgraded states the audit confirms are untouched.

### Prior verification precedent — the mold this phase repeats
- `.planning/milestones/v2.11-phases/102-verification-source-chain-audit-uat-ver-01-ver-02/102-VERIFICATION.md` — **the immediate precedent:** 16/16 independent ACFR re-derivation exact ties + 50-node cohort source-chain audit (7/7 invariants, genuine 0 residue, 145 stale `*-gf-*` data_sources deleted, 46 NASBO states untouched) + Chris UAT. Reuse its audit structure + the "Representative N" re-derivation method.
- Phase 97 verification (v2.10, `.planning/milestones/v2.10-phases/`) — the earlier cohort-audit + "Representative 7" precedent; caught + fixed F-97-01 in-phase (the D-05 precedent).

### Project memory (cross-cutting cautions)
- `pdftotext -table` reads ACFR GF columns cleanly (`-layout` misaligns) — the load + re-extract standard.
- CA SCO **soft-404 caution** (HTTP 200 + HTML for missing files — filter by Content-Type/size, not status code) — relevant if re-fetching CA deep-year PDFs.
- `treasury_sync_*` / data-load RPCs and the never-overwrite guard — the audit confirms idempotency (0-change re-run).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 102 cohort-audit approach** — the 50-node source-chain audit (NULL/fragile/residue/out-of-window/dup/orphan invariants + basis-label coverage) was already executed once in 102; reuse/adapt its SQL + report structure for the v2.12-augmented cohort.
- **`pdftotext -table` extraction** — same tool used to load; re-run independently (without the loader map) for blind re-extraction.
- **`mcp__supabase-local` execute_sql** — for in-DB audit queries (loaded rows, data_source labels, basis labels, NASBO untouched, idempotency).

### Established Patterns
- **Independent re-derivation, not self-report** (VER-03, Phase 102) — re-extract from source, then diff against DB.
- **Exact total-tie** (v2.11 16/16, Phase 104/105 exact-tie load) — D-03 keeps it as the audit bar.
- **In-phase fix of data/source defects** (F-97-01, 105 IL-clamp) — D-05.
- **Per-node basis label + source chip** make non-contiguous windows (D-06 holes) and divergent per-state FY ranges honest in the UI.

### Integration Points
- The data-driven Money In view + `?dataset=revenue` deep-link (shipped v2.11) surface PA/IL + deepened-pilot revenue automatically — UAT verifies they render, no code changes.
- This phase is the milestone closeout — passing it + Chris UAT completes v2.12 (`/gsd:complete-milestone` next).

</code_context>

<specifics>
## Specific Ideas

- Re-derivation target is specifically the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast figures. Same statement the loaders transcribed.
- The negative-clamp years are the highest-risk UAT + re-derivation cases: **FL FY2021** (Investment earnings/losses −$398,287K), **IL FY2022** (Interest and other investment income −$197,857K), and any NY/CA market-loss years surfaced during 104.
- "Within an explained tolerance" (VER-03 wording) is operationalized as D-03: exact, else documented-explanation-or-fix — it does NOT mean a numeric tolerance band.
</specifics>

<deferred>
## Deferred Ideas

- **CA FY2002–FY2007 variant-naming extension** — durably sourceable but requires per-year URL enumeration + old-layout handling; deferred at Phase 104 (D-01), remains deferred. Not part of 106's verification surface.
- **105 code-review non-blocking follow-ups** (logged here so they aren't lost, per D-05): WR-01 (P2 clamp breaks `parent.a == Σ child.a` — renderer should tolerate Σchildren > parent on clamped-negative FYs; consider an explicit assertion/doc), WR-03 (tighten loader `validate()` tolerance toward 0), WR-04 (`strict: false` arg parsing — a mistyped `--dry-run` performs a live write), WR-05 (non-atomic `data_sources` check-then-insert → prefer `.upsert(onConflict)`). Candidate for a future hardening pass, not this phase.
- **REQUIREMENTS.md traceability hygiene** — 4 REQ-IDs (ACFRX-01, ACFRX-02, VOTES-01, SRCSTD-01) appear in the body but not the Traceability table (surfaced by Phase 105 completion); reconcile during milestone closeout.

</deferred>

---

*Phase: 106-verification-source-chain-audit-uat-ver-03-ver-04*
*Context gathered: 2026-06-30*
