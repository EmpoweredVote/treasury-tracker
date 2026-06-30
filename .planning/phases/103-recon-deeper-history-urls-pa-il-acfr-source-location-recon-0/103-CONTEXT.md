# Phase 103: Recon — Deeper-History URLs + PA/IL ACFR Source Location (RECON-04, RECON-05) - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A **documentation-only recon phase** — no DB loads, no NASBO-row mutations, no frontend changes, $0 (`pdftotext` only, no AI). It de-risks Phases 104–105 before any load by delivering three things:

1. **Deeper-history pilot URLs located (RECON-04a):** For each v2.11 pilot, locate the durable per-year ACFR URLs *below* its current window — **FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016** (TX FY2016 is a within-window file-id gap, not a below-window extension). For each, record the cleanly `pdftotext -table`-extractable additional FY depth + durable per-year URL, **bookend-tie-confirmed**, with a per-state gap log for years that don't cleanly extract or lack a durable URL.
2. **PA + IL ACFR sources located (RECON-04b):** Locate the **Pennsylvania** + **Illinois** ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* — GENERAL FUND column, units, durable per-year URLs, `-table`-extractable FY depth — each **bookend-tie-confirmed**, with the four risk facts pinned (units, negative categories, exact column header/statement, FY-end month) and the GF-scope-vs-NASBO magnitude documented.
3. **Loader-reuse + NASBO-replace plan written (RECON-05, for Phases 104–105):** The per-pilot `SOURCES`-map extension plan (which older-FY URLs feed each existing `process{CA,TX,NY,FL}*.js` loader), and which loader/config shape fits PA + IL on the v2.11 pattern. Recon's plan must show how ACFR rows replace NASBO operating rows per state-FY (idempotent never-overwrite).

**Out of this phase:** loading data into Supabase, mutating NASBO rows, the "Money In" revenue view (data-driven, auto-enables on load — no frontend work this milestone), the actual deepening loads (Phase 104), the PA/IL loads (Phase 105), and verification/UAT (Phase 106). Recon recommends; the accept/relabel + greenlight calls land in the load phases.
</domain>

<decisions>
## Implementation Decisions

### Deepening Stop-Rule (pilots)
- **D-01:** **Durable-URL bound, bounded effort.** Push the SCO / myfloridacfo / OSC archive pages to find a durable, citable per-year URL as deep as one exists, but **cap the spelunking at a fixed effort budget per state** (~15–20 min). If no durable URL surfaces within that budget, record it in the gap log and stop. **No hard FY floor** — matches the roadmap's "as deep as durable URLs allow" without an open-ended dig.
- **D-02:** **Durable URL is a hard requirement.** A deeper year reachable *only* via a non-durable source (Wayback Machine snapshot, one-off archive-page link with no stable pattern) is **excluded and logged** as "located but not durably sourceable" — NOT loaded. Keeps every displayed figure durably re-sourceable (the always-sourced standard). A tie-confirmed total does not override the durability requirement.

### Recon Thoroughness
- **D-03:** **Bookend (the v2.11 mold).** Tie-confirm the **OLDEST + LATEST** FY of each deepened/new window now — proves the window's ends and that older PDFs still `-table`-extract — record the per-year URLs, and let **Phases 104/105 extract the in-between years as they load**. Exactly what worked in Phase 98. Applies to both the pilot deepening and PA/IL.

### PA/IL GF-Scope Policy (the TX trap)
- **D-04:** **Flag + recommend accept-and-relabel.** If PA or IL's ACFR GF column is materially broader/narrower than its NASBO General Fund (TX's "General Revenue Fund" was ~3×), recon **documents the scope + magnitude vs NASBO** and **recommends accepting the ACFR GF-equivalent column as the node** (relabel basis honestly, per-node source chip — the TX precedent). Recon recommends; the accept/relabel call is confirmed at load time (Phase 105).
- **D-05:** **Pin the four risk facts at the bookend for PA + IL** (the things that bit prior states):
  1. **Units** — thousands / millions / dollars per state, so the loader scales correctly (NY's ×1,000 millions trap).
  2. **Negative-category years** — any negative GF line items (e.g. investment-income losses) in the bookend years, so the P2 clamp is anticipated (OH FY2022 precedent).
  3. **Exact GF column header + statement** — record the exact column label and confirm it's the Governmental Funds *Statement of Rev/Exp/Changes*, **not** the government-wide Statement of Activities.
  4. **FY-end month** — confirm each state's FY-end (PA = Jun 30, IL = Jun 30) so FY labeling + source date are right.

### PA/IL FY Floor
- **D-06:** **Confirm the recent window before greenlighting the NASBO replacement.** Unlike the pilots (whose latest FY is already on ACFR), replacing PA/IL's NASBO rows could strand their latest data. Recon must verify each new state's clean ACFR window **includes the recent years its NASBO rows currently cover (FY2023 + FY2024)** before recommending the replacement. If the ACFR can't cleanly reach the recent years, recon **flags it as a blocker/decision** for Phase 105 rather than silently stranding the latest data — guards against a recency regression. (Note this differs deliberately from the pilots' no-floor rule in D-01.)

### Claude's Discretion
- **Loader-template → PA/IL mapping** (which of `processOHAcfr.js` / `processVAAcfr.js` / `processMN*.js` / the v2.11 `process{CA,TX,NY,FL}Acfr.js` family best fits each new state's GF-statement layout) is a recon *finding* to derive from the actual ACFR layouts — the milestone already locks "new PA/IL loaders on the same pattern," so this is layout-matching, not an open architecture choice.
- **Exact `pdftotext` invocation per state/year** (page ranges, `-f/-l` bounds, light `-table` cleanup per D-07/D-08 from Phase 98) is recon's to determine empirically.
- **Per-year URL pattern discovery** on the archive pages (the exact naming scheme for older FL/CA years, TX FY2016's alternate file-id) is recon's to find within the D-01 effort budget.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements
- `.planning/ROADMAP.md` — the v2.12 milestone block (goal, constraints, critical path) + the **Phase 103** entry (goal + 3 success criteria). Source of the fixed phase boundary. Also Phases 104/105 (the loads this recon feeds) and 106 (verification).
- `.planning/REQUIREMENTS.md` — **RECON-04** (deeper-history pilot URLs + PA/IL ACFR location, bookend tie-confirmed, gap log) and **RECON-05** (ACFR replaces NASBO idempotently, never-overwrite, un-upgraded states unchanged, existing pilot rows undisturbed). Also the Out-of-Scope table (no states beyond PA/IL, no budgetary basis, no paid sources, no frontend work).

### Prior recon precedent — the mold this phase repeats
- `.planning/milestones/v2.11-phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-ACFR-SOURCES.md` — **the direct precedent.** Per-state located statements, durable URL patterns, latest-FY tie confirmations, the gap log (CA ≤2019 / FL ≤2021 need archive-page navigation; TX FY2016 = `96-471.pdf` 404; NY likely extends below FY2015), the soft-404 caution (CA SCO returns HTTP 200 + HTML for missing files — filter by Content-Type/size), and the bookend approach. **Start here.**
- `.planning/milestones/v2.11-phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-CONTEXT.md` — the locked recon patterns being carried forward (D-07 light-cleanup-before-drop, D-08 total-ties-keeps-FY, as-deep-as-clean, browser-download fallback).

### Loader templates to reuse / extend
- `scripts/processFLAcfr.js`, `scripts/processFLRevenueAcfr.js` — FL spend + revenue. Deepening = add older-FY URLs to the `SOURCES` map (currently `[2022,2023,2024].map(...)` over `FL_BASE/fye-{fy}-…pdf`) + add transcribed per-FY `EXPENDITURES`/revenue blocks.
- `scripts/processCA.js`, `scripts/processCARevenueAcfr.js` — CA spend + revenue (same `SOURCES`-map + transcribed-block shape).
- `scripts/processNYAcfr.js`, `scripts/processNYRevenueAcfr.js` — NY spend + revenue (×1,000 millions scaling).
- `scripts/processTX*` family — TX spend + revenue (General Revenue Fund, accept-relabel precedent).
- `scripts/processOHAcfr.js` / `scripts/processOHRevenueAcfr.js`, `scripts/processVAAcfr.js` / `scripts/processVARevenueAcfr.js`, `scripts/processMN.js` / `scripts/processMNRevenue.js` — candidate templates for the new PA/IL loaders (recon picks the closest layout match per D-04/Claude's discretion).
- `scripts/loadStateGF.mjs` — the **NASBO fallback loader** (the rows being replaced for PA/IL). Stays in place for un-upgraded states; recon's plan shows how ACFR rows replace its operating rows per state-FY.

### Access / TLS quirks
- `.planning/followups/ca-acfr-reconciliation.md` — documents CDN-blocked CA *city* ACFRs + the browser-download workaround. State ACFRs were far more accessible in Phase 98 (plain `curl`, no block) — but reach for the browser-download fallback rather than treating a 403/soft-404 as a hard blocker. **CA SCO soft-404 caution applies** (filter by Content-Type, not HTTP status).

No external ADRs/specs beyond the above — requirements are fully captured in `.planning/REQUIREMENTS.md` + `98-ACFR-SOURCES.md` + the decisions in this file.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v2.11 pilot loader family** (`process{CA,TX,NY,FL}Acfr.js` + `*RevenueAcfr.js`): each has a `SOURCES` map (per-FY `{url, date}`) and transcribed per-FY `EXPENDITURES`/revenue blocks with a total-tie `validate()`, the P2 negative-category clamp, 0-NULL source stamping, and never-overwrite guard. **Deepening = extend the `SOURCES` map with older-FY URLs (recon's deliverable) + add the transcribed older-FY blocks (Phase 104).** No new loader code for the pilots.
- **ACFR loader templates** (`processOHAcfr.js`, `processVAAcfr.js`, `processMN*.js`): proven revenue-by-source + spend-by-function extractors — candidate molds for the new PA/IL loaders (Phase 105).
- **`scripts/loadStateGF.mjs`**: NASBO operating-only loader; the idempotency/never-overwrite pattern Phase 105 must preserve when ACFR replaces NASBO per state-FY.

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven MN/OH/VA, re-confirmed Phases 97/98). `-layout` misaligns (floats numbers to wrong rows) — `-table` is the clean read and the D-07 cleanup lever.
- **Bookend recon** (Phase 98): tie-confirm oldest + latest FY now, record per-year URLs, defer in-between extraction to the load phase.
- **Per-node basis label + source chip** make divergent per-state FY windows and mixed basis (GAAP vs NASBO budgetary) honest in the UI — why per-state independent windows are safe and why TX-style accept-relabel works.
- **Closeout mold** (Phases 88/93/97/102): recon → independent re-derivation from the ACFR (not loader self-report) → cohort source-chain audit → live UAT. Phase 103 is the recon front of that mold; Phase 106 is the back.

### Integration Points
- Recon's `SOURCES`-extension plan (pilots) + PA/IL loader-shape finding are the input contract for Phase 104 (deepen pilots) and Phase 105 (PA+IL).
- The data-driven "Money In" view + `?dataset=revenue` deep-link (shipped v2.11) auto-enable revenue once PA/IL data lands — **no frontend work**, so recon need not touch the frontend.
</code_context>

<specifics>
## Specific Ideas

- The deepening targets, per the gap log in `98-ACFR-SOURCES.md`: **FL pre-FY2022** (durable naming starts FY2022 — older needs the myfloridacfo FL-ACFR archive page), **CA pre-FY2020** (`acfr{NN}web.pdf` soft-404s for FY≤2019 — deeper history behind the SCO ARD archive page), **NY pre-FY2015** (predictable `comprehensive-annual-financial-report-{YYYY}.pdf` naming — likely extends cleanly), **TX FY2016** (within-window gap — `96-471.pdf` 404'd that year; locate FY2016's alternate file-id on the same archive page).
- Target statement is specifically the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast figures.
- PA + IL are the two largest remaining NASBO states (per the milestone). Both have a June 30 FY-end (to confirm at bookend per D-05).
- TX is the named scope-mismatch precedent: its ACFR "General Revenue Fund" was ~3× the NASBO GF and was accepted + relabelled honestly — the template for any PA/IL scope surprise (D-04).
</specifics>

<deferred>
## Deferred Ideas

- **States beyond PA/IL** (GA, NC, MI, NJ, WA, AZ, MA, TN, … — `ACFRX-01`/`ACFRX-02`) — the rest of the NASBO long tail is a future milestone, not v2.12. All 46 at once remains infeasible per the v2.10 bespoke-extractor finding.
- **MN history FY1997–FY2007** (`MNHIST-02`) + the **MN FY2008 $8.79M categorization gap** (`MNGAP-01`) — Future Requirements, out of scope.
- **Backfilling the always-sourced federal standard** (source chips / official-record links) to city/state data (`SRCSTD-01`) — future.
- **Frontend / UI work** — explicitly out of scope this milestone; "Money In" + `?dataset=revenue` are data-driven and auto-enable on load.

None of the above are scope creep into Phase 103 — discussion stayed within the recon boundary.
</deferred>

---

*Phase: 103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0*
*Context gathered: 2026-06-29*
