# Phase 109: ACFR Upgrade — Batch 2 (RECON-08, ACFR-14..18, ACFR-19, ACFR-20) - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the **five Batch-2 roster state nodes — TN, CT, WI, WA, MI** — from NASBO operating-only estimates to full **State-ACFR GAAP**: **revenue-by-source + finer spending-by-function** on each state node, ACFR-sourced, basis-labelled, replacing the NASBO operating rows idempotently. Each state loads via a per-state loader (`process{ST}Acfr.js` + `process{ST}RevenueAcfr.js`) that reuses the proven generalized GENERAL-FUND-column parser `scripts/maAcfrExtract.mjs` (`extractGovFundGeneralColumn`), gated by an exact per-FY total-tie, as deep as its window allows. Every added FY ties **exactly** to its printed ACFR GF-column total or is dropped+logged. GAAP basis-labelled, durably sourced; scope divergence relabelled honestly; negative-category years render via the P2 clamp.

**Structural twin of Phase 108 (Batch 1, executed 2026-07-01).** The full mold — exact-tie/skip+log, holes-allowed, P2 clamp, accept-and-relabel, one-plan-per-state, idempotent NASBO-replace, no frontend — carries forward verbatim from 108 and is NOT re-litigated here. The Batch-2-specific deltas are: deeper windows (TN 17yr; CT/WI deep enumerable history), MI's September-30 FY-end exception, and defaulting to the 108-proven generalized parser for all five.

**Locked upstream by Phase 107 recon (do not re-derive — see canonical refs):** the roster (all 5 IN), per-state source URLs + GF statement/column + units + FY-end, loader-template assignment, NASBO-replace rule, untouched-nodes contract, per-state scope ratios + P2/units/URL risk facts.

**Out of this phase:** Batch-1 states NJ/MA/NC/GA/MD (Phase 108 — done); verification / independent re-derivation / cohort audit / live UAT (Phase 110); any frontend work (the "Money In" view + `?dataset=revenue` deep-link are data-driven and already shipped — they auto-enable on load); un-upgraded NASBO states and the existing ACFR nodes (untouched per RECON-08 contract).
</domain>

<decisions>
## Implementation Decisions

### History Depth (per-state load window)
- **D-01: Full-attempt with drop+log holes — match Phase 108's D-01.** Attempt the fullest window per state and load every year that ties exactly, logging holes; deep windows may end up non-contiguous and that is acceptable (kept honest by the per-node basis label + source chip). Concretely:
  - **TN FY2009–FY2025 (17 yrs)** — all per-year URLs recon-confirmed durable on the tn.gov archive.
  - **CT** — verified FY2019–FY2025; **push into the deep enumerable history (FY1988+)** via the `_reportsSource` archive JSON, loading each year that extracts + ties.
  - **WI** — verified FY2019–FY2025; **push into the deep enumerable history (FY2000+)** via the doa.wi.gov archive, loading each year that extracts + ties.
  - **WA FY2020–FY2025 (6 yrs)** — the confirmed window (pre-FY2020 not verified downloadable; extend later if durable URLs surface).
  - **MI FY2019–FY2025 (7 yrs)** — the full available window (archive shows FY2019 as oldest listed).
- **D-01 honesty guard:** "Full window" means *attempt* every year; it does **not** mean forcing a bad tie. Any FY that fails its exact GF-column total-tie or fails to `pdftotext -table`-extract cleanly is **dropped + logged**, never fudged (see D-03/D-04). The deep CT/WI enumerable-but-unverified years self-limit by extraction success — no artificial floor. This maximizes historical depth (the 108 generalized parser makes the deep windows tractable, e.g. MA reached 19 yrs, NC 14 yrs after parser generalization).

### Extractor Approach
- **D-02: Reuse the generalized parser for all 5 Batch-2 states.** Default every state to `scripts/maAcfrExtract.mjs` `extractGovFundGeneralColumn` — GENERAL-FUND-column-only, exact per-FY tie. This directly avoids the recon-flagged **multi-column-sum trap** (critical for CT's 7-column and TN's 4-column statements — extract the GF column ONLY, never sum across columns) and makes the deep TN/CT/WI windows feasible. Per-state loaders supply the `SOURCES` map + tie targets; the parser core is shared. This is the 108 mold evolution (recovered bonus years for MA + NC), not a per-state hand-transcription clone. Hand-transcription is only a fallback if a state's layout defeats the parser (as MA's dept-level lines needed special handling in 108).

### MI September-30 FY-end (the tranche's one structural exception)
- **D-03: Dedicated `processMIAcfr.js` (+ `processMIRevenueAcfr.js`) with honest relabel.** MI's fiscal year is Oct 1–Sep 30 (all other tranche states are Jun 30). Build a MI-specific loader (or MI-configured clone that still uses the generalized parser core) that:
  1. Sets `fiscal_year_start_month = 10` (October).
  2. Stamps `source_date = {FY}-09-30`, NOT June 30.
  3. Aligns FY labels to NASBO's calendar-year designation: ACFR "FY2025" = Oct 2024–Sep 2025 = NASBO "FY2025" ✓.
  4. Identifies the GF column as **Fund 10** (MI's column headers are fund codes 10/20/30/70, not standard names — School Aid Fund [Fund 20] is a separate major fund, NOT the GF).
  - Prominently document + relabel the **~3.56× scope divergence** (MI GAAP GF ~$53.8B vs NASBO ~$15.1B) — the largest in the whole tranche, driven by ~$30.3B "From federal agencies" (Medicaid/ARP passthrough) inside the GAAP GF. TX-trap at its most pronounced.

### Load Mold (carried forward verbatim from Phase 108 — confirmed, not re-litigated)
- **D-04: Exact per-FY total-tie, else skip+log.** A year loads only if its extracted line items sum **exactly** to the printed GF-column total (v2.11/v2.12/108 standard). No tolerance, no fudging (documented $1–2K GAAP thousands-rounding tolerance only, as in 108). Phase 110 re-derives independently, so the load-time bar stays strict.
- **D-05: Mid-window holes allowed + logged.** In-between FYs are extracted at load; a failing FY is dropped and recorded in a per-state gap/tie log — keep loading the rest, never abort the whole window on one bad year.
- **D-06: P2 negative-category clamp wherever a negative category appears** (ACFR-20). Check every loaded FY; clamp the rendered value to 0, preserve the signed magnitude in the label, keep the parent total intact. **CT watch:** older fiscal-stress years (2009–2017) may carry negative investment-income lines; **WA watch:** column is labeled "Investment income (loss)" — negative possible in adverse-market years. MI has no standalone investment line (embedded in Miscellaneous) → no MI clamp risk.
- **D-07: Accept-and-relabel scope divergence honestly** (ACFR-19) for all 5 states (TX precedent). ACFR GAAP GF is broader than the NASBO GF concept (federal intergovernmental flows inside GAAP GF): TN ~1.51×, CT ~1.14× (smallest — closest to NASBO), WI ~1.74×, WA ~1.72×, MI ~3.56× (largest). Label each node's basis + scope honestly; surface to Chris at Phase 110 UAT.
- **D-08: One plan per state — 5 plans total** (`109-01`..`109-05`, ordering at planner's discretion). Each state is independent (own `municipality_id`, own loader clone), giving atomic, resumable checkpoints; the long full-depth transcription/extraction effort (esp. TN 17yr + deep CT/WI) stays resumable and a failed/held state doesn't block the others.
- **D-09: Idempotent NASBO-replace + never-overwrite.** ACFR operating rows replace NASBO per `(muni,fy,'operating')`; revenue is a pure insert (no NASBO revenue exists → enables "Money In" automatically); re-run writes 0 net new rows. The existing ACFR nodes + un-upgraded NASBO states stay untouched (RECON-08 — enforced by each loader resolving only its own state name).

### Claude's Discretion
- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l` bounds, `-table` cleanup) — determined empirically at load, as in 108.
- Ordering of the 5 per-state plans (109-01..05) and whether to author revenue + spend as one plan-step or two per state.
- Whether MI's dedicated loader is a fresh file or a thin MI-configured wrapper around the generalized parser core — as long as the D-03 Sep-30 semantics hold.
- **Load-time recon-correction is expected, not a deviation.** Phase 108 found recon URLs/structure unreliable (NJ spurious `/pdfs/`, NC recent-year URLs 404'd + re-enumerated from archive, MA was dept-level not "3-col simple"). Batch-2 has analogous flags: **WA FY2025 unique URL** (`FY-2025-Annual-Comprehensive-Financial-Report.pdf` — must special-case, not derive), **MI FY2025 reversed name** (`FY-2025-ACFR.pdf`), **TN FY2025** (`ACFR%20-%20FY25.pdf`) + mixed-case FY2009–2024 filenames, **CT `_reportsSource` JSON enumeration** (FY2022 has "revised" suffix), **WI path split** (`/budget/SCO/` vs `/budget/` vs `DEBFCapitalFinance/`). Re-verify structure + URLs at load; the exact-tie is the safety net. See [[project_acfr_recon_structure_unreliable]].

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 107 recon handoff — the input contract for this phase (START HERE)
- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-BATCH2-SOURCES.md` — **the per-year source detail for TN/CT/WI/WA/MI**: the per-state source table (GF statement/column/position, units, FY-end, durable clean window, per-year URL patterns), bookend tie-confirmations, the four risk facts per state, scope-vs-NASBO (TX-trap) analysis, recency-floor verdicts, consolidated gap log, loader-template mapping, per-state detail blocks, and the Phase-109 Pre-Load Checklist. **The source-of-truth for this phase.**
- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-RECON.md` — the consolidated recon: roster lock, NASBO-replace rule (RECON-08), untouched-nodes contract, recency-floor verdicts, Open Risks (scope-relabel magnitudes, P2-clamp anticipations, units, URL/naming variants).
- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-CONTEXT.md` — recon-phase decisions (roster criteria, batch-split) carried into this phase.

### Phase 108 (Batch 1) — the just-executed structural twin whose mold + surprises this phase repeats
- `.planning/phases/108-acfr-upgrade-batch-1-recon-08-acfr-09-13-acfr-19-acfr-20/108-CONTEXT.md` — the decision mold (D-01 depth, D-02 one-plan-per-state, D-03 exact-tie, D-04 holes, D-05 P2, D-06 relabel) carried forward here verbatim.
- `.planning/phases/108-acfr-upgrade-batch-1-recon-08-acfr-09-13-acfr-19-acfr-20/108-02-SUMMARY.md` (MA — **where the generalized parser was built**) + `108-03-SUMMARY.md` (NC — **first reuse of the shared parser**) + `108-01-SUMMARY.md` (NJ — units + URL-fix precedent). These document the parser-generalization mold evolution (D-02 here) and the load-time recon-correction pattern (D-09 here).

### Milestone scope + requirements
- `.planning/ROADMAP.md` — v2.13 milestone block (goal, constraints, critical path 107 → (108 ∥ 109) → 110) + the **Phase 109** entry (goal + 4 success criteria). The fixed phase boundary.
- `.planning/REQUIREMENTS.md` — **RECON-08** (untouched-nodes contract inherited), **ACFR-14..18** (per-state Batch-2 ACFR loads), **ACFR-19** (scope-divergence honest relabel), **ACFR-20** (P2 negative-category clamp).

### Loader / parser assets to reuse
- `scripts/maAcfrExtract.mjs` — **the generalized GENERAL-FUND-column parser** (`extractGovFundGeneralColumn`), proven on MA + NC in 108. The default extractor for all 5 Batch-2 states (D-02).
- `scripts/processILAcfr.js` + `scripts/processILRevenueAcfr.js` — recon-assigned template for **TN, CT, WI, MI** (multi-major-fund GF statement + explicit/enumerated per-year SOURCES map). `SOURCES` map + tie `validate()` + `clampForRender()` P2 clamp + never-overwrite upsert structure.
- `scripts/processPAAcfr.js` + `scripts/processPARevenueAcfr.js` — recon-assigned template for **WA** (multi-column GF layout with Higher-Ed major funds).
- `scripts/processNCAcfr.js` + `scripts/processNCRevenueAcfr.js` — 108's cleanest example of the shared-parser reuse pattern (GF-column-only from a multi-fund statement) — the closest structural analog for TN/CT/WI.
- `scripts/loadStateGF.mjs` — NASBO fallback loader. **Not modified this phase** — relevant only as the idempotency precedent and the fallback for the un-upgraded NASBO states.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/maAcfrExtract.mjs` generalized parser** (`extractGovFundGeneralColumn`): takes the GENERAL-FUND (1st numeric) column ONLY from a Governmental-Funds Statement of Rev/Exp/Changes, gated by an exact per-FY total-tie. Proven on MA (variable dept-level columns) + NC (4+ fund columns) in 108. **The default for all 5 Batch-2 states** — directly solves the recon-flagged multi-column-sum trap.
- **v2.12/108 loader family** (`process{ST}Acfr.js` + `*RevenueAcfr.js`): each carries a `SOURCES` map (per-FY `{url, date}`), the tie `validate()` (`process.exit(2)` on mismatch), the P2 clamp (`clampForRender = Math.max(amount,0)` with signed magnitude retained in label), 0-NULL source stamping, and a never-overwrite guard (`data_sources` upsert-by-`dataset_id`; `budgets` update-by-`(muni,fy,dataset_type)` key). **Each Batch-2 state = per-state loader wrapping the shared parser + its own SOURCES map + tie targets.**

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven MN/OH/VA, re-confirmed Phases 97/98/103/107/108). `-layout` misaligns numbers — use `-table`.
- **Bookend recon → load-time extraction:** recon tied each window's ends; the load phase extracts + exactly-ties each in-between year, dropping+logging failures.
- **Load-time recon-correction is the norm, not the exception** (108 lesson): recon URLs/structure need re-verification at load; the exact per-FY tie is the safety net that catches wrong URLs/columns. See [[project_acfr_recon_structure_unreliable]].
- **Idempotent never-overwrite:** ACFR operating rows replace NASBO per `(muni,fy,'operating')`; revenue is a pure insert (no NASBO revenue exists → enables "Money In" automatically); re-run writes 0 net new rows.
- **Per-node basis label + source chip** keep a non-contiguous deep window (D-05 holes) and divergent per-state FY ranges honest in the UI.

### Integration Points
- The data-driven **"Money In" view + `?dataset=revenue` deep-link** (shipped v2.11) surface revenue-by-source automatically once revenue rows exist per node — **no frontend work.**
- Each per-state loader is scoped to its own `municipality_id` / resolves only its own state name (roster node IDs / names in 107-RECON.md) — cannot write to the existing ACFR nodes or the un-upgraded NASBO states (RECON-08 contract enforced by the loaders themselves).
- This phase's output feeds **Phase 110** (loader-independent blind re-derivation from each ACFR, 50-node cohort source-chain audit, live UAT).

### Units / FY-end traps (Batch-2 specific — from recon)
- **All 5 Batch-2 states report in THOUSANDS** (multiply to dollars per the existing ACFR loader convention). No dollars-native state in Batch 2 (that was NJ in Batch 1).
- **TN/CT/WI/WA are June-30 FY-end; MI is September-30 FY-end** — the one exception (D-03).
- **URL/naming special-cases:** WA FY2025 unique name; MI FY2025 reversed name; TN FY2025 space+dash name + mixed-case FY2009–2024; CT enumerate from `_reportsSource` JSON (FY2022 "revised" suffix); WI path splits (`/budget/SCO/` vs `/budget/` vs `DEBFCapitalFinance/`).

</code_context>

<specifics>
## Specific Ideas

- Target statement is specifically the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast figures. Extract the GF column ONLY; **never sum across fund columns** (CT's 7-column statement is the highest-risk here). Recon confirmed the exact column position + neighbors per state in 107-BATCH2-SOURCES.md.
- Recon-confirmed bookend ties (the load must reproduce these exactly, thousands): TN FY2025 $35,473,625K / FY2019 $22,201,193K; CT FY2025 $26,074,183K / FY2019 $20,776,288K; WI FY2025 $38,655,598K / FY2019 $27,866,801K; WA FY2025 $55,775,958K / FY2020 $38,977,410K; MI FY2025 $53,788,610K (printed; line-sum $53,788,611K, $1 GAAP rounding) / FY2020 $39,920,656K.
- **MI is the named structural exception:** Sep-30 FY-end + ~3.56× scope divergence (~$30.3B federal-agency Medicaid/ARP passthrough inside the GAAP GF; School Aid Fund is a separate major fund excluded from the GF column). Column headers are fund codes — GF = Fund 10.
- **WA biennial caveat:** WA budgets on a 2-year biennium, but the ACFR publishes **annual GAAP** figures per FY ending Jun 30 (confirmed "For the Fiscal Year Ended June 30, 2025"). Loader treats FY-end = Jun 30 and loads per-year — do NOT mistake the biennial budget cycle for the annual GAAP filing.

</specifics>

<deferred>
## Deferred Ideas

- **Pre-clean-window / older-than-verified history** (per recon gap log): WA pre-FY2020 (not verified downloadable from the wp-content path; WA State Library link references older years), MI pre-FY2019 (not on current michigan.gov archive), TN pre-FY2009, CT pre-FY1988, WI pre-FY2000. The deep CT (FY1988+) and WI (FY2000+) enumerable histories ARE in-scope this phase per D-01 (attempt + drop/log); years that don't extract or don't tie become honest holes recoverable in a future deepening pass — not forced.
- **Batch-1 honest holes carried from 108** (MA FY2001/2002/2004/2005/2014/2021) — a future MA deepening pass, out of this phase.
- None of the above is scope creep into Phase 109 — discussion stayed within the Batch-2 five-state load boundary.

</deferred>

---

*Phase: 109-acfr-upgrade-batch-2-recon-08-acfr-14-18-acfr-19-acfr-20*
*Context gathered: 2026-07-01*
