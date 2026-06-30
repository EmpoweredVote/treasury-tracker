# Phase 104: Deepen the 4 Pilots (DEEP-01, RECON-05, ACFR-08) - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the **CA / TX / NY / FL** ACFR windows *backward* as deep as the durable URLs located in Phase 103 allow, reusing the existing v2.11 loaders. The work is **data deepening, not new code**: add the older-FY keys to each loader's `SOURCES` map (recon's deliverable, already located + bookend-tie-confirmed) and transcribe each added FY's General-column block (**revenue-by-source + spend-by-function**) with its total-tie `validate()`. Each added FY must tie to its ACFR GF column total and be GAAP basis-labelled. **Idempotent never-overwrite** — existing v2.11 pilot rows, un-upgraded NASBO states, and PA/IL are untouched. Negative-category years render via the P2 clamp.

**Concrete per-pilot work (locked by Phase 103 recon):**
- **NY** — extend `processNYAcfr.js` + `processNYRevenueAcfr.js`: add FY2003–FY2014 (12 yrs) to the year array. `comprehensive-annual-financial-report-{YYYY}.pdf` naming (fy≤2021), **units = millions (×1,000 scaling already applies)**. Govtl-funds columns: General | Federal Special Revenue | Other Governmental | Eliminations | Total.
- **CA** — extend `processCA.js` + `processCARevenueAcfr.js` `SOURCES`: add FY2008–FY2019 (12 yrs) keys using **`/Files-ARD/CAFR/cafr{NN}web.pdf`** (a *different* directory from the `/Files-ARD/ACFR/` FY2020+ entries). Units = thousands. Columns: General | Federal | Transportation | Nonmajor Governmental | Total.
- **FL** — extend `processFLAcfr.js` + `processFLRevenueAcfr.js`: add FY2021 (1 yr) to the `[2022,2023,2024]` array (same `fye-{YYYY}-…` pattern). Units = thousands. **P2 clamp required** — FY2021 GF has a negative "Investment earnings (losses)" line (−$398,287K).
- **TX** — **no work.** Already contiguous FY2015–FY2024 in `processTX.js` / `processTXRevenueAcfr.js` (the RECON-04 "TX FY2016" target was closed during the v2.11 loads).

**Out of this phase:** PA/IL loads (Phase 105), states beyond PA/IL (future milestone), verification + independent re-derivation + UAT (Phase 106), any frontend work (the "Money In" view + `?dataset=revenue` deep-link are data-driven and already shipped in v2.11 — they need no changes here), the CA FY2002–FY2007 variant-naming extension (deferred — see Deferred Ideas).
</domain>

<decisions>
## Implementation Decisions

### CA Deepening Depth
- **D-01:** **Stop at the FY2008 clean-pattern floor.** Load CA FY2008–FY2019 (12 added years) on the single clean `cafr{NN}web.pdf` pattern only. FY2008's full-column sum was tied exactly in recon. The FY2002–FY2007 variant-naming years (`cafr06.pdf`, `2002_cafr02.pdf`…) are durably sourceable but require per-year URL enumeration and old-layout handling — **not pursued this phase** (deferred). Keeps NY + CA symmetric (12 yrs each) and the window high-confidence.

### Mid-Window Failure / Hole Policy
- **D-02:** **Skip + log the gap; holes are allowed.** Recon bookend-tie-confirmed only each window's *ends*; the ~22 in-between NY/CA years are extracted at load time. If an in-between FY fails to cleanly `pdftotext -table`-extract, fails its tie (see D-03), or its URL 404s, **drop only that FY and record it in a per-state gap/tie log** — keep loading the rest. The displayed window may therefore have a hole (e.g. NY …FY2007, [gap FY2008], FY2009…). This matches the v2.11 "as-deep-as-clean" / 98 D-08 mold; the per-node basis label + source chip keep a non-contiguous window honest. Maximizes retained history; never stop the whole window on one bad year.

### Per-FY Tie Standard
- **D-03:** **Exact tie required, else skip+log.** A year loads only if its transcribed line items sum **exactly** to the printed GF column total (the v2.11 16/16-exact standard). Any non-exact tie — rounding drift, restatement, a "rounding" line in the printed total — fails the FY, which is then skipped + logged per D-02. **No silent fudging / no tolerance.** Phase 106 re-derives independently from each ACFR to audit, so the load-time bar stays strict.

### Composition note
D-02 and D-03 share one disposition path: an added FY is accepted only on **(clean `-table` extract) AND (exact GF-column tie)**; failing either → skip + log, never fudge, never abort the window.

### Claude's Discretion
- **Exact `pdftotext` invocation per state/year** (page ranges, `-f/-l` bounds, light `-table` cleanup per Phase 98 D-07/D-08) — determined empirically at load, as in v2.11.
- **Plan structure / batching** (one plan per state vs. combined) is a planning decision; the three states are independent.
- **Negative-category detection across the deepened years** — recon flagged FL FY2021 explicitly; older NY/CA market-loss years may also carry negative investment-income lines. Apply the P2 clamp wherever a negative category appears (ACFR-08), not just FL FY2021.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 103 recon handoff — the input contract for this phase (START HERE)
- `.planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-DEEPEN-SOURCES.md` — **the pilot deepening source-of-truth.** Per-pilot deepened windows, added-FY counts, old-end bookend ties, per-year URL patterns, units, the deepening gap log, and per-pilot extraction-confidence + Phase-104 load notes (incl. CA's different `/Files-ARD/CAFR/` dir, FL FY2021 negative line, NY millions scaling).
- `.planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-RECON.md` §1 — consolidated handoff: the `SOURCES`-map extension plan per pilot + the idempotency rule + the open issue noting CA FY2002–07 as an optional-not-required further extension.
- `.planning/phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-CONTEXT.md` — recon decisions carried forward: D-01 durable-URL bound, D-02 durable-URL hard requirement, D-03 bookend (extract in-between at load).

### Milestone scope + requirements
- `.planning/ROADMAP.md` — v2.12 milestone block (goal, constraints, critical path 103 → (104 ∥ 105) → 106) + the **Phase 104** entry (goal + 3 success criteria). The fixed phase boundary.
- `.planning/REQUIREMENTS.md` — **DEEP-01** (deeper FY history on the 4 pilots, each added FY tying to its GF column total, GAAP-labelled, idempotent never-overwrite), **RECON-05** (ACFR replaces NASBO idempotently; un-upgraded states unchanged; existing pilot rows undisturbed by deepening), **ACFR-08** (negative categories render via the P2 clamp).

### Prior precedent — the loads this phase repeats
- `.planning/milestones/v2.11-phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-ACFR-SOURCES.md` — the original per-state located statements + the CA SCO **soft-404 caution** (HTTP 200 + HTML for missing files — filter by Content-Type/size, not status code) — directly relevant to the CA `cafr{NN}web.pdf` deepening.
- `.planning/followups/ca-acfr-reconciliation.md` — CA TLS/CDN quirks + browser-download fallback (state ACFRs were accessible via plain `curl` in 98, but the fallback exists).

### Loader files to extend (no new loader code)
- `scripts/processNYAcfr.js`, `scripts/processNYRevenueAcfr.js` — NY spend + revenue (×1,000 millions scaling).
- `scripts/processCA.js`, `scripts/processCARevenueAcfr.js` — CA spend + revenue (`SOURCES`-map + transcribed-block shape).
- `scripts/processFLAcfr.js`, `scripts/processFLRevenueAcfr.js` — FL spend + revenue (`[2022,2023,2024].map(...)` SOURCES array to extend with 2021).
- `scripts/loadStateGF.mjs` — NASBO fallback loader (un-upgraded states stay here; not touched by this phase — relevant only as the idempotency precedent).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v2.11 pilot loader family** (`process{CA,NY,FL}Acfr.js` + `*RevenueAcfr.js`): each has a `SOURCES` map (per-FY `{url, date}`) + transcribed per-FY `EXPENDITURES`/revenue blocks with a total-tie `validate()`, the P2 negative-category clamp, 0-NULL source stamping, and a never-overwrite guard. **Deepening = add the older-FY `SOURCES` keys (from recon) + transcribe the older-FY blocks. No new loader code.**

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven MN/OH/VA, re-confirmed Phases 97/98/103). `-layout` misaligns numbers — use `-table`.
- **Bookend recon → load-time extraction** (Phase 98 mold): recon tied the ends; the load phase extracts + ties each in-between year.
- **Exact total-tie per FY** (v2.11: 16/16 exact) is the accept bar — D-03 keeps it.
- **Per-node basis label + source chip** make a non-contiguous deepened window (D-02 holes) and divergent per-state FY ranges honest in the UI.
- **Idempotent never-overwrite** — re-run = 0 writes; ACFR rows replace NASBO per state-FY; existing rows untouched. The deepening adds only new older-FY keys.

### Integration Points
- The data-driven "Money In" view + `?dataset=revenue` deep-link (shipped v2.11) already surface revenue for the pilots — deeper FY revenue auto-appears on load. **No frontend work.**
- This phase's output feeds **Phase 106** (independent re-derivation from each ACFR, cohort source-chain audit, live UAT).

</code_context>

<specifics>
## Specific Ideas

- Target statement is specifically the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast figures.
- **FL FY2021** is the named P2-clamp case: negative "Investment earnings (losses)" −$398,287K → clamp to 0 with the signed magnitude in the label, parent total preserved (the OH FY2022 precedent).
- **CA's added years live in a different directory** (`/Files-ARD/CAFR/` not `/Files-ARD/ACFR/`) — the loader's `SOURCES` map carries explicit per-FY URLs, so the two directories coexist.
- Old-end bookend ties already confirmed by recon: NY FY2003 General Total revenues $29,250M; CA FY2008 $97,774,378K; FL FY2021 $46,989,188K.

</specifics>

<deferred>
## Deferred Ideas

- **CA FY2002–FY2007 variant-naming extension** (`cafr06.pdf`, `2002_cafr02.pdf`…, enumerable from `https://www.sco.ca.gov/ard_state_acfr.html`) — durably sourceable but requires per-year URL enumeration + old-layout handling. Explicitly *not required* this milestone (D-01). A candidate optional further CA extension for a future deepening pass.
- **FL pre-FY2021 history** — not durably sourceable within the D-01 effort budget at the `transparency-docs/cafr/` path (returns HTML, not PDF). Deferred (may exist behind a different DFS/archive path).
- **NY pre-FY2003** — predictable `comprehensive-annual-…` naming 404s at FY2002 and earlier; FY2003 is the durable old-end. No deeper extension exists.
- **PA + IL loads** (Phase 105) and **states beyond PA/IL** (future milestone) — out of this phase.

None of the above are scope creep into Phase 104 — discussion stayed within the pilot-deepening boundary.

</deferred>

---

*Phase: 104-deepen-the-4-pilots-deep-01-recon-05-acfr-08*
*Context gathered: 2026-06-30*
