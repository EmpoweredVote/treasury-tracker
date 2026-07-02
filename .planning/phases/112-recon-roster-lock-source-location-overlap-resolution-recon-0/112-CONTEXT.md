# Phase 112: Recon — Roster Lock + Source Location + Overlap Resolution (RECON-09, RECON-10) - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning
**Note:** Chris was away during the discussion window — the four new decisions below (D-01..D-04) were **auto-selected best-judgment defaults**, each grounded in the Chris-approved v2.14 REQUIREMENTS.md text and the Phase 107 precedent. Chris can override any of them before `/gsd-plan-phase 112` by editing this file or re-running `/gsd-discuss-phase 112`.

<domain>
## Phase Boundary

A **documentation-only recon phase** — no DB loads, no NASBO-row mutations, no frontend changes, $0 (`pdftotext` only, no AI). It is the input contract for Phases 113/114 and de-risks them before any write by delivering three things:

1. **Roster locked (RECON-09):** Rank the remaining 31 NASBO states by GF size from **NASBO 2025 SER**, then lock the ~10-state tranche-3 roster from the candidates **AZ, IN, CO, MO, KY, OR, SC, LA, OK, UT** — substitutions allowed per D-01 below (rank correction or non-extractable ACFR), each documented with its reason.
2. **Per-state ACFR sources located + tie-confirmed (RECON-09):** For each locked state, locate the ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* — GENERAL FUND column, units, FY-end, durable per-year URLs, cleanly `pdftotext -table`-extractable FY depth. **Bookend-tie-confirm** each window (oldest + latest FY), pin the four risk facts (D-08), and write a **per-state gap log** for years that don't cleanly extract or lack a durable URL.
3. **Prior-load overlaps resolved on paper (RECON-10):** Check the **UT state node's provenance** explicitly (v2.5 loaded Utah *municipal* data from Transparent Utah BigQuery — unaffected — but the state node itself must be provenance-checked); any locked state with a pre-existing custom-source node gets an **in-place upgrade plan** (MA v1.8-DLS / CA v1.7 precedent, no duplicate node); confirm each upgraded state's ACFR rows **replace** its NASBO operating rows per state-FY idempotently + never-overwriting; un-upgraded NASBO states stay on `scripts/loadStateGF.mjs`; the existing **19 ACFR nodes** are not disturbed. Overlaps are **flagged + planned**, not executed (execution is Phases 113/114).

**Out of this phase:** loading data into Supabase, mutating NASBO rows, frontend work (Money In + `?dataset=revenue` auto-enable on load), the upgrade loads themselves (Phases 113/114), the deepening pass (Phase 115 — MA/CT/NJ/WI holes + pre-GASB-34 extractor is a separate parallel phase; recon here covers the tranche only), and verification/UAT (Phase 116).

**Written as:** recon docs (the `112-RECON.md` + per-batch SOURCES + gap-log deliverable) — no DB writes.

</domain>

<decisions>
## Implementation Decisions

### Roster Lock & Substitution Policy
- **D-01 (Substitution allowed, bounded — supersedes v2.13 D-01 for this milestone) [auto-selected default]:** Per the Chris-approved RECON-09 text ("substitutions allowed for rank corrections or ACFRs that won't cleanly `pdftotext -table`-extract, deferring those to the final tranche"), a candidate that fails clean extraction or is rank-corrected by the NASBO 2025 SER re-ranking **may be substituted with the next-largest un-upgraded NASBO state**, keeping the tranche at ~10. This is a deliberate change from v2.13's no-backfill rule — the requirement text explicitly authorizes it. Bounds: **one substitution round only** (if a substitute also fails its recon check, the count floats down rather than a second reach-down), every substitution documented with its reason in the recon doc, and failed candidates land in ACFRX-03 (final tranche). Per-state effort stays inside the D-04 budget.

### Batch Split (Phases 113/114)
- **D-02 (Lock split by GF size after re-ranking — carry 107 D-03) [auto-selected default]:** Recon **locks** the 113/114 batch assignment largest-GF-first from the re-ranked roster — matching REQUIREMENTS.md's proposed mapping (Batch 1 / Phase 113 = ACFR-21..25 = AZ, IN, CO, MO, KY; Batch 2 / Phase 114 = ACFR-26..30 = OR, SC, LA, OK, UT). If re-ranking or substitution changes the roster, surviving states keep size-order assignment, batches rebalance around them (~5/~5), and the recon doc records the final ACFR-2x ↔ state mapping for the traceability table.

### Overlap Resolution Default (RECON-10)
- **D-03 (In-place upgrade is the default overlap plan) [auto-selected default]:** If the UT state node (or any roster state's node) carries pre-existing custom-source rows, the plan is an **in-place upgrade** per the MA v1.8-DLS / CA v1.7 precedent — no duplicate node, ACFR rows replace the prior state-node GF rows per state-FY, provenance + row inventory documented in the recon doc before any write. Utah's v2.5 *municipal* (city/county) Transparent-Utah data is explicitly out of scope and untouched. If recon finds something that doesn't fit the in-place mold (e.g. rows that aren't GF-operating/revenue), it flags it as a load-phase decision rather than inventing a new pattern.

### Recon Deliverable Shape
- **D-04 (Mirror the Phase 107 deliverable shape) [auto-selected default]:** `112-RECON.md` (roster lock + rankings + substitutions + overlap plans + risk-fact table) plus `112-BATCH1-SOURCES.md` / `112-BATCH2-SOURCES.md` (per-state located statement, per-FY durable-URL `SOURCES` maps, bookend tie confirmations, units/FY-end, gap log, loader-template match, GF-scope-vs-NASBO magnitude) — the exact input contract Phases 113/114 consume.

### Carried Forward From the v2.11/v2.12/v2.13 Recon Mold (established + locked — not re-discussed)
- **D-05 (Bookend tie-confirm):** Tie-confirm the OLDEST + LATEST FY of each state's window now (proves the ends + that older PDFs still `-table`-extract); record per-year URLs; let Phases 113/114 extract the in-between years as they load. (Phase 98 / 103 / 107 precedent.)
- **D-06 (Durable URL is a hard requirement):** A year reachable only via a non-durable source (Wayback snapshot, one-off archive link with no stable pattern) is **excluded and logged**, NOT loaded. A tie-confirmed total does not override durability.
- **D-07 (Recency floor — no regression):** Every state's clean ACFR window MUST cover the recent years its NASBO rows currently hold (**FY2023 + FY2024**) before recon recommends the NASBO replacement. If the ACFR can't cleanly reach those years, recon **flags it as a blocker/decision** for the load phase rather than silently stranding the latest data.
- **D-08 (Four risk facts pinned at bookend, per state):** (1) **Units** — thousands / millions / dollars (the NJ-dollars + NY ×1,000-millions traps); (2) **Negative-category years** — any negative GF line in the bookend years so the P2 clamp is anticipated; (3) **Exact GF column header + statement** — the Governmental Funds *Statement of Rev/Exp/Changes → General Fund column* (GAAP), NOT the government-wide Statement of Activities, NOT budgetary/forecast; (4) **FY-end month** — confirm each state's FY-end (the MI Sep-30 class) so FY labeling + source date are right.
- **D-09 (Scope divergence → flag + recommend accept-relabel):** If a state's ACFR GF column is materially broader/narrower than its NASBO GF (TX / PA / IL / MI precedent, 1.14×–3.56× seen in v2.13), recon **documents scope + magnitude vs NASBO** and **recommends accepting the ACFR GF-equivalent column** (relabel basis honestly, per-node source chip). The accept/relabel call is confirmed at load time (ACFR-31).
- **D-10 (Overlaps = flag + plan, not execute):** Recon documents each overlap plan; the load phases execute. No DB writes in this phase.
- **D-11 (Recon effort budget ~15–20 min/state):** Bounded per-state URL-spelunking cap. If no durable per-year URL surfaces within budget, log it in the gap log and move on.
- **D-12 (No minimum window depth beyond the recency floor):** A shallow clean window (e.g. FY2023–FY2025) makes a state roster-eligible. Deep history is not required for lock; a state is substituted/deferred ONLY if it can't cleanly `-table`-extract at all OR fails the recency floor.
- **D-13 (Structure/URL re-verify at load):** Per [[project_acfr_recon_structure_unreliable]] — trust recon *totals*, but Phases 113/114 re-verify statement structure + URLs at load time; the GF total-tie is the safety net. Recon should not over-promise structural detail.

### Claude's Discretion
- **Loader-template → per-state mapping** (which existing `process*Acfr.js` family fits each new state's GF-statement layout) is a recon *finding* — the milestone locks "clone the proven per-state template + swap the `SOURCES` map," so this is layout-matching, not architecture. Note: all 35 loaders now carry the Phase 111 ephemeral data_sources lifecycle — clones inherit it.
- **Exact `pdftotext` invocation per state/year** (page ranges, `-f/-l` bounds, light `-table` cleanup) is recon's to determine empirically.
- **Per-year URL pattern discovery** per state archive page, within the D-11 budget. Known access quirks: tn.gov needed a browser UA (v2.13); CA SCO soft-404s (HTTP 200 + HTML for missing files); browser-download fallback before treating 403s as blockers.
- **Plan/doc sectioning** within the D-04 deliverable shape.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements
- `.planning/ROADMAP.md` — the v2.14 milestone block (goal, constraints, critical path `111 → 112 → (113 ∥ 114 ∥ 115) → 116`) + the **Phase 112** entry (goal + 3 success criteria). Source of the fixed phase boundary. Also Phases 113/114 (the loads this recon feeds), 115 (deepening — NOT this phase's scope), 116 (verification).
- `.planning/REQUIREMENTS.md` — **RECON-09** (rank 31 NASBO states, lock ~10 roster with documented substitutions, locate + bookend-tie each GF statement, gap logs), **RECON-10** (overlap resolution — UT state-node provenance check, in-place upgrade plans, ACFR-replaces-NASBO idempotent never-overwrite, 19 existing ACFR nodes undisturbed), and the ACFR-21..32 per-state requirements the roster maps onto. Also the Out-of-Scope table.

### Prior recon precedent — the mold this phase repeats
- `.planning/milestones/v2.13-phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-CONTEXT.md` — **the direct precedent CONTEXT** (this phase's D-05..D-12 carry its decisions forward). **Start here.**
- `.planning/milestones/v2.13-phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-RECON.md` + `107-BATCH1-SOURCES.md` + `107-BATCH2-SOURCES.md` — the deliverable shape to mirror (per-state located statement, durable URL patterns, bookend ties, risk-fact table, gap logs, batch split).
- `.planning/milestones/v2.12-phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-RECON.md` + `103-PA-IL-SOURCES.md` — the v2.12 recon deliverable (deeper-history + PA/IL source location).
- `.planning/milestones/v2.11-phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-RECON.md` + `98-CONTEXT.md` — the ORIGINAL recon + the CA in-place-upgrade overlap precedent (the model for D-03). Also the CA SCO soft-404 caution.

### Loader templates (Phases 113/114 clone; recon picks the closest layout match per state)
- `scripts/processNJAcfr.js` + `scripts/processNJRevenueAcfr.js` (and the other v2.13 pairs: MA/NC/GA/MD/TN/CT/WI/WA/MI) — the freshest template generation, **post-Phase-111** ephemeral data_sources lifecycle included.
- `scripts/process{PA,IL,CA,TX,NY,FL,OH,VA}*.js` — earlier families, additional layout-match candidates; TX = the accept-relabel scope-divergence precedent.
- `scripts/loadStateGF.mjs` — the **NASBO fallback loader** (the rows being replaced). Stays in place for un-upgraded states.
- `scripts/maAcfrExtract.mjs` — token-order + positional extraction variants (v2.13 lesson; useful reference if a new state's `-table` output is messy).

### Phase 111 contract (inherited by every loader this milestone)
- `.planning/phases/111-loader-debt-atomic-data-sources-upsert-load-01/111-VERIFICATION.md` — the LOAD-01 fix recon's plans must assume: ephemeral data_sources lifecycle (create→use→delete), 0 residue, no manual re-clean.

### Access / TLS quirks
- `.planning/followups/ca-acfr-reconciliation.md` — CDN-blocked ACFR workaround precedent (browser-download fallback rather than treating 403/soft-404 as hard blockers). v2.13 addition: tn.gov required a browser User-Agent.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **v2.13 loader template family** (`process{NJ,MA,NC,GA,MD,TN,CT,WI,WA,MI}{,Revenue}Acfr.js`): the current clone target — per-FY `SOURCES` map (`{url, date}`), transcribed per-FY blocks, total-tie `validate()`, P2 clamp, never-overwrite guard, **Phase-111 ephemeral data_sources lifecycle**. Recon does NOT write loader code — it identifies which template fits each state.
- **`scripts/loadStateGF.mjs`**: NASBO operating-only loader — the idempotency/never-overwrite pattern Phases 113/114 preserve when ACFR replaces NASBO per state-FY.
- **NASBO 2025 SER** — the ranking source for RECON-09 (same document used at v2.10/v2.13 recon; GF size ordering).

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven across 19 states); `-layout` misaligns. `-table` + light cleanup is the standard read.
- **Bookend recon** (98/103/107): tie-confirm oldest + latest FY now; defer in-between extraction to the load phase.
- **In-place overlap upgrade** (98 CA-v1.7 → 107/108 MA v1.8-DLS): pre-existing custom-source state node upgraded in place, no duplicate node — the D-03 model for UT.
- **FY2002 = the pre-GASB-34 boundary** — windows stop there for this tranche; anything older is Phase 115's extractor territory, not a 112 gap-log failure.
- **Closeout mold** (102/106/110): recon → loads → independent re-derivation → 50-state cohort audit → Chris live UAT. Phase 112 is the recon front; Phase 116 is the back.

### Integration Points
- Recon's per-state `SOURCES`-map contract + loader-shape finding + locked roster + batch split (D-02) are the input contract for Phase 113 (Batch 1) and Phase 114 (Batch 2).
- Existing cohort = **19 ACFR nodes** (MN/OH/VA/CA/TX/NY/FL/PA/IL + NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI) + 31 NASBO states. Recon must confirm its plan leaves the 19 undisturbed and only touches roster states (RECON-10).
- The data-driven Money In view + `?dataset=revenue` deep-link auto-enable on load — no frontend work.

</code_context>

<specifics>
## Specific Ideas

- Candidate roster (largest-GF first, pending SER re-rank): **AZ, IN, CO, MO, KY, OR, SC, LA, OK, UT**. Proposed Batch 1 (Phase 113) = AZ/IN/CO/MO/KY; Batch 2 (Phase 114) = OR/SC/LA/OK/UT (D-02).
- Target statement per state = the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast (D-08.3).
- **Utah** is the named overlap-risk state: v2.5 loaded UT cities/counties from Transparent Utah BigQuery (municipal — unaffected), but the UT *state node's* provenance must be explicitly checked and its upgrade plan written (D-03; RECON-10). Watch for phantom-city-row / display-name quirks from the v2.5 era when inventorying.
- Cohort goes from **19 ACFR nodes → ~29** on completion of the tranche.

</specifics>

<deferred>
## Deferred Ideas

- **The final ~21 NASBO states** (`ACFRX-03`) — any candidate substituted out per D-01 lands here.
- **Phase 115 deepening scope** (MA/CT/NJ/WI holes + pre-GASB-34 extractor) — parallel phase, not part of this recon; pre-FY2002 years found during 112 spelunking should be noted in passing, not tie-confirmed here.
- **Deeper history on the other 15 ACFR nodes** — explicitly out of scope (milestone Out-of-Scope table).
- **Frontend / UI work** — out of scope this milestone (incl. the state-flag hero-banner cosmetic fix, still deferred).
- **SRCSTD-01 / VOTES-01** — future milestones.

### Reviewed Todos (not folded)
- **`2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction`** (frontend-routing, score 0.6) — same generic-keyword match Phase 107 reviewed and left un-folded. This phase is a no-DB-write, no-frontend recon doc; out of scope. Stays deferred for a future frontend/routing phase.

None of the above are scope creep into Phase 112 — the boundary held.

</deferred>

---

*Phase: 112-recon-roster-lock-source-location-overlap-resolution-recon-0*
*Context gathered: 2026-07-02*
