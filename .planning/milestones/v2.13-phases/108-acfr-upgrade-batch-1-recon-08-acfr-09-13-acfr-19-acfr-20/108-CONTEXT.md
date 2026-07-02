# Phase 108: ACFR Upgrade — Batch 1 (RECON-08, ACFR-09..13, ACFR-19, ACFR-20) - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the **five Batch-1 roster state nodes — NJ, MA, NC, GA, MD** — from NASBO operating-only estimates to full **State-ACFR GAAP**: **revenue-by-source + finer spending-by-function** on each state node, ACFR-sourced, basis-labelled, replacing the NASBO operating rows idempotently. Each state loads via a new per-state loader cloned from the recon-assigned template (`process{ST}Acfr.js` + `process{ST}RevenueAcfr.js`), transcribing each FY's General-Fund-column block (rev-by-source + spend-by-function) with a total-tie `validate()`, as deep as its recon-confirmed clean window allows. Every added FY ties **exactly** to its printed ACFR GF column total or is skipped+logged. GAAP basis-labelled, durably sourced; scope divergence relabelled honestly; negative-category years render via the P2 clamp.

**Locked upstream by Phase 107 recon (do not re-derive — see canonical refs):** the roster (all 5 IN), per-state source URLs + GF statement/column + units + FY-end, loader-template assignment, MA in-place-upgrade + GA F-97-01 supersede resolutions, NASBO-replace rule, untouched-nodes contract, per-state scope ratios + P2/units/URL risk facts.

**Out of this phase:** Batch-2 states TN/CT/WI/WA/MI (Phase 109); verification / independent re-derivation / cohort audit / live UAT (Phase 110); any frontend work (the "Money In" view + `?dataset=revenue` deep-link are data-driven and already shipped — they auto-enable on load, no changes needed); un-upgraded NASBO states and the 9 existing ACFR nodes (untouched per RECON-08 contract); the deeper-history extensions explicitly deferred below.
</domain>

<decisions>
## Implementation Decisions

### History Depth (per-state load window)
- **D-01: Load each Batch-1 state to its FULL recon-confirmed clean window.** No effort-cap this phase. Concretely: **MA FY2001–FY2025 (25 yrs)**, **NC FY2012–FY2025 (14 yrs)**, **NJ FY2020–FY2025 (6 yrs)**, **GA FY2021–FY2025 (5 yrs)**, **MD FY2022–FY2025 (4 yrs)**. This matches the ROADMAP "each as deep as its ACFR cleanly extracts" default and maximizes historical depth (the CA FY2008 / NY FY2003 deep-history precedent). Chris chose full depth over the Phase-104-style ~10-yr cap, accepting the larger hand-transcription effort (each FY is a manually-transcribed rev+spend block per the loader mold).
- **D-01 honesty guard:** "Full window" means *attempt* every year in the clean window; it does **not** mean forcing a bad tie. Any in-between FY that fails its exact GF-column total-tie or fails to `pdftotext -table`-extract cleanly is **dropped + logged**, never fudged (see D-03 / D-04). A deep window may therefore end up non-contiguous — that is acceptable and kept honest by the per-node basis label + source chip.

### Plan Structure
- **D-02: One plan per state — 5 plans total** (`108-01` NJ … `108-05` MD, ordering at planner's discretion). Each state is independent (own `municipality_id`, own loader clone), so per-state plans give atomic checkpoints: a failed/held state does not block the others, and the long full-depth transcription effort (esp. MA 25 yrs) stays resumable. Preferred over a single combined plan given the uneven depth.

### Load Mold (carried forward from the Phase 104/105 v2.11/v2.12 mold — confirmed, not re-litigated)
- **D-03: Exact per-FY total-tie, else skip+log.** A year loads only if its transcribed line items sum **exactly** to the printed GF column total (the v2.11/v2.12 exact-tie standard, 24/24 in Phase 106). No tolerance, no fudging. Phase 110 re-derives independently, so the load-time bar stays strict.
- **D-04: Mid-window holes allowed + logged.** Recon bookend-tie-confirmed only each window's ends; in-between years are extracted at load. A failing in-between FY is dropped and recorded in a per-state gap/tie log — keep loading the rest; never abort the whole window on one bad year.
- **D-05: P2 negative-category clamp wherever a negative category appears** (ACFR-20), not just the recon-flagged **MD FY2022** (negative investment income). Check every loaded FY; clamp the rendered value to 0, preserve the signed magnitude in the label, keep the parent total intact (OH FY2022 / FL FY2021 precedent).
- **D-06: Accept-and-relabel scope divergence honestly** (ACFR-19) for all 5 states (TX precedent). ACFR GAAP GF is broader than the NASBO GF concept (federal intergovernmental flows inside GAAP GF): NJ ~1.15×, MA ~1.73×, NC ~2.58×, GA ~1.98×, MD ~1.78× NASBO. Label each node's basis + scope honestly; surface to Chris at Phase 110 UAT.
- **D-07: MA = in-place upgrade of the existing state node** (`fd6b008f`) — no duplicate node, no new municipality row, no stale-metadata cleanup (Phase 107 probe confirmed zero `data_sources` rows). Add ACFR revenue rows (pure insert) + replace NASBO operating rows for ACFR-covered FYs; create fresh `ma-acfr-operating` / `ma-acfr-revenue` data_source metadata rows.
- **D-08: GA F-97-01 Medicaid fix is superseded, not preserved.** The ACFR GAAP operating actuals replace the (F-97-01-corrected) NASBO FY2023 operating row at the same `(muni_id, fy, 'operating')` key. Loader author confirms the supersede leaves no orphan NASBO row competing with the ACFR row.

### Claude's Discretion
- Exact `pdftotext` invocation per state/year (page ranges, `-f/-l` bounds, light `-table` cleanup) — determined empirically at load, as in v2.11/v2.12.
- Ordering of the 5 per-state plans (108-01..05) and whether to author revenue + spend as one plan-step or two per state.
- Whether MA/MD/WA-family states truly need the PA template vs. NJ/NC/GA on the IL template — recon assigned templates, but the planner may adjust if the loader shape fits better the other way. (MI's Sep-30 exception is Batch 2, not this phase.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 107 recon handoff — the input contract for this phase (START HERE)
- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-RECON.md` — **the consolidated source-of-truth.** Roster lock (all 5 Batch-1 states IN + clean windows), per-state summary + loader mapping table (GF statement/column, units, FY-end, latest/old-end ties, scope ratio, template), NASBO-replace rule (RECON-08), MA in-place-upgrade + GA F-97-01 supersede plans (RECON-07), untouched-nodes contract, recency-floor verdicts, and the Open Risks section (scope-relabel magnitudes, P2-clamp anticipations, units traps, URL/naming variants, gap log).
- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-BATCH1-SOURCES.md` — **the per-year source detail for NJ/MA/NC/GA/MD**: durable per-year ACFR URLs (incl. the naming variants — NJ FY2025 infix, MA FY2017 no-hyphen, NC/GA enumerated archive URLs, MD FY2024 case change), bookend tie figures, exact GF column identification.
- `.planning/phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-CONTEXT.md` — recon-phase decisions (roster criteria D-01/D-02, batch-split D-03) carried into this phase.

### Milestone scope + requirements
- `.planning/ROADMAP.md` — v2.13 milestone block (goal, constraints, critical path 107 → (108 ∥ 109) → 110) + the **Phase 108** entry (goal + 4 success criteria). The fixed phase boundary.
- `.planning/REQUIREMENTS.md` — **RECON-08** (untouched-nodes contract inherited), **ACFR-09..13** (per-state Batch-1 ACFR loads), **ACFR-19** (scope-divergence honest relabel), **ACFR-20** (P2 negative-category clamp).

### Loader templates to clone (per recon assignment)
- `scripts/processILAcfr.js` + `scripts/processILRevenueAcfr.js` — template for **NJ, NC, GA** (multi-major-fund GF statement + explicit-SOURCES-map / enumerated-URL states).
- `scripts/processPAAcfr.js` + `scripts/processPARevenueAcfr.js` — template for **MA, MD** (more-regular GF-first layout / partially-derivable URL pattern). Structure: `SOURCES` map (per-FY `{url, date}`), hand-transcribed `EXPENDITURES` (+ revenue) blocks, total-tie `validate()`, `clampForRender()` P2 clamp, never-overwrite `data_sources` upsert + `budgets` update-by-key.
- `scripts/loadStateGF.mjs` — NASBO fallback loader. **Not modified this phase** — relevant only as the idempotency precedent and the fallback for the ~31 un-upgraded NASBO states.

### Prior precedent — the loads this phase repeats
- `.planning/milestones/v2.12-phases/104-deepen-the-4-pilots-deep-01-recon-05-acfr-08/104-CONTEXT.md` — the depth (D-01), hole (D-02), and exact-tie (D-03) decision mold this phase carries forward.
- `.planning/milestones/v2.12-phases/105-pa-il-acfr-upgrade-acfr-06-acfr-07-acfr-08-recon-05/105-PA-IL-LOADLOG.md` + `105-VERIFICATION.md` — the PA/IL new-state ACFR upgrade this batch structurally repeats (scope-relabel, NASBO-replace, P2 clamp in practice).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v2.12 loader family** (`process{PA,IL}Acfr.js` + `*RevenueAcfr.js`): each carries a `SOURCES` map (per-FY `{url, date}`), hand-transcribed per-FY `EXPENDITURES`/revenue blocks with a total-tie `validate()` (`process.exit(2)` on mismatch), the P2 clamp (`clampForRender = Math.max(amount,0)` with signed magnitude retained in the label), 0-NULL source stamping, and a never-overwrite guard (`data_sources` upsert-by-`dataset_id`; `budgets` update-by-`(muni,fy,dataset_type)` key). **Each Batch-1 state = clone the assigned template + swap the `SOURCES` map + transcribe that state's per-FY blocks.**

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven MN/OH/VA, re-confirmed Phases 97/98/103/107). `-layout` misaligns numbers — use `-table`.
- **Bookend recon → load-time extraction** (Phase 98 mold): recon tied each window's ends; the load phase extracts + exactly-ties each in-between year, dropping+logging failures.
- **Idempotent never-overwrite:** ACFR operating rows replace NASBO per `(muni,fy,'operating')`; revenue is a pure insert (no NASBO revenue exists → enables "Money In" automatically); re-run writes 0 net new rows.
- **Per-node basis label + source chip** keep a non-contiguous deep window (D-04 holes) and divergent per-state FY ranges honest in the UI.
- **`data_source_id = null` text-stamp provenance (policy P4)** is the roster states' current NASBO pattern — the ACFR loads add real `data_sources` metadata rows (`api_type='pdf_download'`).

### Integration Points
- The data-driven **"Money In" view + `?dataset=revenue` deep-link** (shipped v2.11) surface revenue-by-source automatically once revenue rows exist per node — **no frontend work.**
- Each per-state loader is scoped to its own `municipality_id` (roster node IDs enumerated in 107-RECON.md) — cannot write to the 9 existing ACFR nodes or the un-upgraded NASBO states (RECON-08 contract enforced by the loaders themselves).
- This phase's output feeds **Phase 110** (loader-independent blind re-derivation from each ACFR, 50-node cohort source-chain audit, live UAT).

### Units / FY-end traps (Batch-1 specific — from recon Open Risks)
- **NJ reports in DOLLARS, not thousands** — the only Batch-1 (and whole-tranche) state with this. Do **not** apply the ×1,000 scaling the other states need; match the schema convention of existing ACFR states (which store thousands-scale). Critical.
- MA/NC/GA/MD report in **thousands** (multiply to dollars per the existing ACFR loader convention). All 5 Batch-1 states are **June 30** FY-end (the Sep-30 MI exception is Batch 2).

</code_context>

<specifics>
## Specific Ideas

- Target statement is specifically the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast figures. The GF column is the 1st fund column in each state's statement (recon confirmed the exact column position + neighbors per state in 107-RECON.md / 107-BATCH1-SOURCES.md).
- Recon-confirmed bookend ties (the load must reproduce these exactly): NJ FY2025 $60,979,024,211 / FY2020 $38,768,977,008 (dollars); MA FY2025 $61,907,573K / FY2015 $35,029,512K; NC FY2025 $75,416,082K / FY2020 $44,930,429K; GA FY2025 $68,445,055K / FY2021 $55,378,103K; MD FY2025 $48,689,018K / FY2022 $50,540,136K.
- **MD FY2022** is the named P2-clamp case (negative investment income line, confirmed −$275,992K).
- URL enumeration (not pattern-derivation) required for **NC** (each year unique from the ncosc.gov archive) and **GA** (opaque Drupal slugs, FY2023 uses `-0` suffix); special-case FYs for **NJ FY2025** (drops "FR" infix), **MA FY2017** (no-hyphen `acfr_fy2017.pdf`), **MD FY2024+** (lowercase `acfr{YYYY}.pdf` vs uppercase earlier).

</specifics>

<deferred>
## Deferred Ideas

- **Pre-clean-window history for Batch-1 states** (per recon gap log): NJ pre-FY2020, NC pre-FY2012, GA pre-FY2021, MD pre-FY2022 — durability not verified / archive doesn't list them. Not pursued this phase; a candidate for a future deepening pass if durable URLs surface. (MA FY2001–2025 is already the full clean window per D-01 — no MA pre-window gap.)
- **Batch-2 states (TN/CT/WI/WA/MI)** — Phase 109, explicitly out of this phase.
- None of the above is scope creep into Phase 108 — discussion stayed within the Batch-1 five-state load boundary.

</deferred>

---

*Phase: 108-acfr-upgrade-batch-1-recon-08-acfr-09-13-acfr-19-acfr-20*
*Context gathered: 2026-07-01*
