# Phase 107: Recon — ACFR Source Location + Roster Lock + Overlap Resolution (RECON-06, RECON-07) - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A **documentation-only recon phase** — no DB loads, no NASBO-row mutations, no frontend changes, $0 (`pdftotext` only, no AI). It is the input contract for Phases 108/109 and de-risks them before any write by delivering three things:

1. **Per-state ACFR sources located + tie-confirmed (RECON-06):** For each candidate state (roster below), locate the ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* — GENERAL FUND column, units, durable per-year URLs, cleanly `pdftotext -table`-extractable FY depth. **Bookend-tie-confirm** each window (oldest + latest FY), pin the four risk facts (D-05), and write a **per-state gap log** for years that don't cleanly extract or lack a durable URL.
2. **Roster locked (RECON-06):** Lock the final ~8–10-state list from the candidate roster **NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI** (largest-GF first). ≤2 that won't cleanly extract are substituted/deferred to ACFRX-02; if MORE than 2 fail, the tranche count floats down (D-01 — no backfill). Each surviving state's window is recorded.
3. **Prior-load overlaps resolved (RECON-07):** Flag **Massachusetts** (v1.8 DLS state-budget node) for **in-place upgrade** (no duplicate MA node — Phase 98 CA-v1.7 precedent). Verify **Georgia** (the one non-cohort NASBO state, carrying the v2.10 F-97-01 Medicaid fix) so the ACFR replace supersedes it cleanly. Identify any other pre-existing custom-source state node among the roster. Overlaps are **flagged + planned**, not executed (execution is Phases 108/109).

**Out of this phase:** loading data into Supabase, mutating NASBO rows, the "Money In" revenue view (data-driven, auto-enables on load — no frontend work this milestone), the actual upgrade loads (Phases 108/109), and verification/UAT (Phase 110). Recon recommends; the accept/relabel + greenlight calls land in the load phases.

**Written as:** a recon doc (the `107-*-SOURCES.md` / gap-log deliverable) — no DB writes.
</domain>

<decisions>
## Implementation Decisions

### Roster Lock & Fill Policy
- **D-01 (Ship what survives — no backfill):** The roster is drawn ONLY from the named 10 candidates (NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI). If ≤2 fail clean extraction they're deferred to ACFRX-02 (per the milestone). If **more than 2 fail**, recon locks the smaller surviving tranche (count floats down — 8→7→6…) and defers the rest to ACFRX-02. **Do NOT reach down to the 11th/12th-largest NASBO states to hold the count at 8–10** — no scope stretch, keep the tranche to the vetted largest-GF candidates. (Chris, 2026-07-01.)

### Minimum Window Depth
- **D-02 (Any window clearing the recency floor counts):** Beyond the D-06 recency floor (below), there is **no minimum FY-depth requirement**. A shallow clean window (e.g. FY2023–FY2025) makes a state "in the roster" — matches the pilots' no-hard-FY-floor rule. A state is deferred ONLY if it can't cleanly `-table`-extract at all OR fails the recency floor. Maximizes coverage; deep history is ACFRX-02's job. (Chris, 2026-07-01.)

### Batch Split (Phases 108/109)
- **D-03 (Lock split by GF size — roadmap's proposed order):** Recon **locks** the 108/109 batch assignment using the roadmap's largest-first split — **Batch 1 (Phase 108) = NJ, MA, NC, GA, MD**; **Batch 2 (Phase 109) = TN, CT, WI, WA, MI**. If the roster shrinks (states deferred per D-01), surviving states keep their size-order assignment and the batches rebalance around the survivors. Predictable, matches what's already written. (Chris, 2026-07-01.)

### Recon Effort Budget
- **D-04 (Keep ~15–20 min/state — reaffirm v2.12 D-01):** Same bounded per-state URL-spelunking cap (~15–20 min). If no durable per-year URL surfaces within budget, log it in the gap log and move on. The aggregate is larger only because there are more states; the per-state discipline is unchanged. (Chris, 2026-07-01.)

### Carried Forward From the v2.11/v2.12 Recon Mold (not re-discussed — established + locked)
- **D-05 (Bookend tie-confirm):** Tie-confirm the OLDEST + LATEST FY of each state's window now (proves the ends + that older PDFs still `-table`-extract); record per-year URLs; let Phases 108/109 extract the in-between years as they load. (v2.11 Phase 98 / v2.12 D-03.)
- **D-06 (Durable URL is a hard requirement):** A year reachable only via a non-durable source (Wayback snapshot, one-off archive link with no stable pattern) is **excluded and logged**, NOT loaded. A tie-confirmed total does not override durability. (v2.12 D-01/D-02.)
- **D-07 (Recency floor — no regression):** Every state's clean ACFR window MUST cover the recent years its NASBO rows currently hold (**FY2023 + FY2024**) before recon recommends the NASBO replacement. If the ACFR can't cleanly reach those recent years, recon **flags it as a blocker/decision** for the load phase rather than silently stranding the latest data. Applies to ALL 10 candidates (all are NASBO-replacements). (v2.12 D-06.)
- **D-08 (Four risk facts pinned at bookend, per state):** (1) **Units** — thousands / millions / dollars, so the loader scales correctly (NY ×1,000-millions trap); (2) **Negative-category years** — any negative GF line (investment-income losses) in the bookend years, so the P2 clamp is anticipated (OH FY2022 precedent); (3) **Exact GF column header + statement** — confirm it's the Governmental Funds *Statement of Rev/Exp/Changes → General Fund column* (GAAP), NOT the government-wide Statement of Activities, NOT budgetary/forecast; (4) **FY-end month** — confirm each state's FY-end so FY labeling + source date are right. (v2.12 D-05.)
- **D-09 (Scope divergence → flag + recommend accept-relabel):** If a state's ACFR GF column is materially broader/narrower than its NASBO General Fund (the TX "General Revenue Fund" ~3× precedent, also PA/IL), recon **documents the scope + magnitude vs NASBO** and **recommends accepting the ACFR GF-equivalent column as the node** (relabel basis honestly, per-node source chip). The accept/relabel call is confirmed at load time (Phases 108/109). (v2.12 D-04 → ACFR-19.)
- **D-10 (Overlaps = flag + plan, not execute):** MA (v1.8 DLS node) → recommend in-place upgrade (Phase 98 CA precedent, no duplicate node). GA → verify the ACFR replace supersedes the v2.10 F-97-01 Medicaid fix cleanly. Any other pre-existing custom-source node → identify + note. Recon documents the plan; the load phases execute it.

### Claude's Discretion
- **Loader-template → per-state mapping** (which of the existing `process{OH,VA,MN,CA,TX,NY,FL,PA,IL}Acfr.js` families best fits each new state's GF-statement layout) is a recon *finding* to derive from the actual ACFR layouts — the milestone already locks "clone the v2.12 `process{PA,IL}{,Revenue}Acfr.js` template + swap the `SOURCES` map," so this is layout-matching, not an open architecture choice.
- **Exact `pdftotext` invocation per state/year** (page ranges, `-f/-l` bounds, light `-table` cleanup) is recon's to determine empirically per the Phase 98 D-07/D-08 cleanup levers.
- **Per-year URL pattern discovery** on each state's archive/ACFR page (the exact naming scheme) is recon's to find within the D-04 effort budget.
- **Recon doc file naming/structure** (e.g. `107-ACFR-SOURCES.md` + gap log) — follow the Phase 98/103 shape.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements
- `.planning/ROADMAP.md` — the v2.13 milestone block (goal, constraints, critical path `107 → (108 ∥ 109) → 110`) + the **Phase 107** entry (goal + 4 success criteria). Source of the fixed phase boundary. Also Phases 108/109 (the loads this recon feeds) and 110 (verification).
- `.planning/REQUIREMENTS.md` — **RECON-06** (per-state ACFR location, bookend tie-confirmed, roster lock with ≤2 substitution, gap log), **RECON-07** (overlap resolution — MA in-place upgrade + any other custom-source node), and **RECON-08** (ACFR replaces NASBO idempotently, never-overwrite, un-upgraded states unchanged, the existing 9 ACFR nodes undisturbed — the contract Phases 108/109 inherit). Also the Out-of-Scope table (no states beyond the tranche, no budgetary basis, no paid sources, no frontend work, no deeper history on the existing 9).

### Prior recon precedent — the mold this phase repeats
- `.planning/milestones/v2.12-phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-CONTEXT.md` — **the direct precedent CONTEXT** (bookend, durable-URL hard req, four risk facts, scope-divergence accept-relabel, recency floor). This phase's D-05..D-10 carry these forward. **Start here.**
- `.planning/milestones/v2.12-phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-RECON.md` and `103-PA-IL-SOURCES.md` — the actual PA/IL recon deliverable shape to mirror (per-state located statement, durable URL pattern, bookend tie confirmations, gap log, GF-scope-vs-NASBO magnitude).
- `.planning/milestones/v2.11-phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-RECON.md` (a.k.a. `98-ACFR-SOURCES.md`) + `98-CONTEXT.md` — the ORIGINAL recon + the CA in-place-upgrade overlap precedent (the model for the MA v1.8-node resolution, RECON-07). Also the CA SCO **soft-404 caution** (HTTP 200 + HTML for missing files — filter by Content-Type/size).

### Loader templates to clone (Phases 108/109 will use; recon picks the closest layout match per state)
- `scripts/processPAAcfr.js` + `scripts/processPARevenueAcfr.js`, `scripts/processILAcfr.js` + `scripts/processILRevenueAcfr.js` — the **v2.12 per-state template** the milestone locks (clone + swap `SOURCES` map). Recon confirms which new states fit this shape directly.
- `scripts/process{CA,TX,NY,FL}Acfr.js` + `*RevenueAcfr.js` — v2.11 pilot family (same `SOURCES`-map + transcribed-block + P2 clamp + never-overwrite shape). TX = the accept-relabel scope-divergence precedent (D-09).
- `scripts/processOHAcfr.js` / `processVAAcfr.js` / `processMN*.js` — additional layout-match candidates for states whose GF statement differs.
- `scripts/loadStateGF.mjs` — the **NASBO fallback loader** (the rows being replaced). Stays in place for un-upgraded states; recon's plan shows how ACFR rows replace its operating rows per state-FY (idempotent never-overwrite).

### Access / TLS quirks
- `.planning/followups/ca-acfr-reconciliation.md` — CDN-blocked CA *city* ACFRs + browser-download workaround. State ACFRs were far more accessible in Phase 98 (plain `curl`) — reach for the browser-download fallback rather than treating a 403/soft-404 as a hard blocker.

No external ADRs/specs beyond the above — requirements are fully captured in `.planning/REQUIREMENTS.md` + the prior recon docs + the decisions in this file.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v2.12 PA/IL loader template** (`process{PA,IL}Acfr.js` + `*RevenueAcfr.js`): the milestone-locked clone target — per-FY `SOURCES` map (`{url, date}`), transcribed per-FY revenue/expenditure blocks, total-tie `validate()`, P2 negative-category clamp, 0-NULL source stamping, never-overwrite guard. Each new roster state = clone + swap `SOURCES` + transcribe its blocks. Recon does NOT write loader code — it identifies which template fits each state.
- **v2.11 pilot loader family** (`process{CA,TX,NY,FL}*.js`): the same shape, additional layout references; TX is the accept-relabel precedent.
- **`scripts/loadStateGF.mjs`**: NASBO operating-only loader — the idempotency/never-overwrite pattern Phases 108/109 must preserve when ACFR replaces NASBO per state-FY. Un-upgraded states stay on it.

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven MN/OH/VA, re-confirmed Phases 97/98/103). `-layout` misaligns (floats numbers to wrong rows) — `-table` is the clean read + the light-cleanup lever (Phase 98 D-07/D-08).
- **Bookend recon** (Phase 98/103): tie-confirm oldest + latest FY now, record per-year URLs, defer in-between extraction to the load phase.
- **Per-node basis label + source chip** make divergent per-state FY windows + mixed basis (GAAP vs NASBO budgetary) honest in the UI — why per-state independent windows are safe and why TX-style accept-relabel works (D-09).
- **In-place overlap upgrade** (Phase 98 CA-v1.7): a state that already has a node from an earlier source gets its node upgraded in place (no duplicate) — the model for MA's v1.8 DLS node (RECON-07/D-10).
- **Closeout mold** (Phases 88/93/97/102/106): recon → independent re-derivation from the ACFR (not loader self-report) → 50-node cohort source-chain audit → live UAT. Phase 107 is the recon front; Phase 110 is the back.

### Integration Points
- Recon's per-state `SOURCES`-map contract + loader-shape finding + locked roster + batch split (D-03) are the input contract for Phase 108 (Batch 1) and Phase 109 (Batch 2).
- The data-driven "Money In" view + `?dataset=revenue` deep-link (shipped v2.11) auto-enable revenue once each state's data lands — **no frontend work**, so recon need not touch the frontend.
- Existing cohort = **9 ACFR nodes** (MN/OH/VA/CA/TX/NY/FL/PA/IL) + 41 NASBO states. Recon must confirm its plan leaves these 9 undisturbed and only touches the roster states (RECON-08).
</code_context>

<specifics>
## Specific Ideas

- Candidate roster (largest-GF first): **NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI**. Batch 1 (Phase 108) = NJ/MA/NC/GA/MD; Batch 2 (Phase 109) = TN/CT/WI/WA/MI (D-03).
- Target statement per state = the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast (D-08.3).
- **Massachusetts** already has a v1.8 DLS (Division of Local Services) state-budget node — recon flags it for in-place upgrade, the Phase 98 CA precedent (no duplicate MA node) (D-10).
- **Georgia** is currently the one non-cohort NASBO state and carries the v2.10 F-97-01 Medicaid fix — recon verifies the ACFR replace supersedes it cleanly (D-10).
- Cohort goes from **9 ACFR nodes → ~19** on completion of the tranche.
</specifics>

<deferred>
## Deferred Ideas

- **States beyond the recon-locked tranche** (`ACFRX-02`) — the rest of the NASBO long tail (all 50 on ACFR, retiring NASBO to fallback-only). Any roster candidate that fails clean extraction (D-01) also lands here. After this tranche ~19 states are on ACFR; ~31 remain.
- **Deeper history on the existing 9 ACFR nodes** — explicitly out of scope; v2.13 is breadth (new states), not depth on already-upgraded ones.
- **Backfilling the always-sourced federal standard** (source chips / official-record links) to city/state data (`SRCSTD-01`) — future.
- **Votes/amendments exploration hub** (`VOTES-01`) — the eventual mission destination, future.
- **Frontend / UI work** — out of scope this milestone; "Money In" + `?dataset=revenue` are data-driven and auto-enable on load.

### Reviewed Todos (not folded)
- **`2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction`** (frontend-routing) — matched on generic keywords ("their", "phase", "requirements"), score 0.6. This phase is a no-DB-write, no-frontend recon doc, so the item is out of scope. Left un-folded for a future frontend/routing phase.

None of the above are scope creep into Phase 107 — discussion stayed within the recon boundary.
</deferred>

---

*Phase: 107-recon-acfr-source-location-roster-lock-overlap-resolution-re*
*Context gathered: 2026-07-01*
