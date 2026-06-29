# Phase 98: Recon — CA Overlap + 4-State ACFR Source Location (RECON-01, RECON-02) - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A **documentation-only recon phase** — no DB loads, no NASBO-row mutations, no frontend changes. It de-risks the v2.11 ACFR upgrade before any load by delivering three things:

1. **CA node situation resolved (RECON-01):** Document California's GF-node state — which CA node renders today, what data/source/basis it holds, and how it relates to the pre-existing **v1.7 CA-state-budget entity** — then produce a single recommended upgrade target. Also check **MA v1.8** for the same dual-node pattern and note the finding.
2. **4-state ACFR sources located + extraction proven (RECON-02):** For CA/TX/NY/FL, locate the published ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* (**General Fund column, GAAP basis, in thousands**), confirm `pdftotext -table` extraction, record the clean FY-depth + durable source URL per state (TLS/access quirks noted).
3. **Loader-reuse + NASBO-replace plan written (for Phases 99–100):** Which existing `process*Acfr.js` template fits each state's layout, and how the ACFR rows replace NASBO operating rows idempotently.

**Out of this phase:** loading data into Supabase, mutating NASBO rows, the "Money In" revenue view (Phase 101), and the final CA upgrade-target *decision* (recon recommends; Chris approves in/after Phase 99).
</domain>

<decisions>
## Implementation Decisions

### FY-Depth Policy
- **D-01:** **As-deep-as-clean.** Each state's upgrade targets every FY its ACFR cleanly extracts (MN-style — MN reached FY2008), not a fixed cap and not the NASBO window. Matches the roadmap's "as deep as each ACFR cleanly extracts."
- **D-02:** **No NASBO floor.** A state is *not* required to cover the FY2023+FY2024 it's replacing on NASBO. Recon takes whatever is clean — even if that's only older FYs or a single year. Recon **documents any divergence** between a state's clean ACFR window and the NASBO rows being replaced (so Phase 99–100 know if a state would temporarily lose the latest FY).
- **D-03:** **Per-state independent windows.** Each state goes as deep as its own ACFR allows (CA might reach further than FL); windows differ per node. The per-node basis label + source chip already make each node self-explaining, so divergent windows are acceptable.

### CA Node Resolution
- **D-04:** **Recon recommends, Chris decides.** Recon documents exactly what each CA node is (which renders today, data held, source, basis) and **produces ONE recommended upgrade target with the concrete reconcile/retire steps to reach it** — so Chris's call is a fast yes/approve (or pick the runner-up). The final upgrade-target decision is Chris's, made once the facts are on the table.
- **D-05:** **MA dual-node check.** Recon explicitly checks whether MA's v1.8 state-budget setup has the same dual-node overlap pattern as CA and **notes the finding** (cheap insurance against a future surprise), even though MA is not in this milestone's 4.

### Recon Thoroughness
- **D-06:** **Full-window pre-extract.** Recon `pdftotext`-extracts and sample-verifies **every clean FY** for all 4 states now (not just the latest-FY floor). This front-loads the extraction work into recon so Phases 99–100 become near-mechanical loads. Extraction only — **no DB writes** in this phase. Stays $0 (pdftotext is free; no AI spend).

### Clean-Extract Bar
- **D-07:** **Try light cleanup before dropping a FY.** When a FY's GF column misaligns/garbles under `pdftotext -table`, attempt cheap fixes first — column-coordinate tweaks, narrowing the page range, `-layout` vs `-table` — and only exclude the FY if it's still unclean. Every dropped FY is recorded in a **gap log** (state + FY + reason).
- **D-08:** **Total-ties + lines-mostly-clean keeps a FY.** Keep a FY if its GF column **total extracts and ties** and the line items are clean enough to categorize; a stray unreadable *minor* line is flagged but does **not** kill the FY. Matches how OH/VA/MN were handled — pragmatic, not penny-strict-per-line.

### Claude's Discretion
- Loader-template→state mapping (which of `processOHAcfr.js` / `processVAAcfr.js` / `processMN*.js` fits each state's GF statement layout) is a recon *finding* to derive from the actual ACFR layouts, not a pre-locked decision.
- Exact `pdftotext` invocation per state (page ranges, `-table` vs `-layout`, `-f/-l` bounds) is recon's to determine empirically.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements
- `.planning/ROADMAP.md` — v2.11 milestone block (goal, constraints, critical path) + the **Phase 98** entry (goal + 3 success criteria). Source of the fixed phase boundary.
- `.planning/REQUIREMENTS.md` — **RECON-01** (CA node doc + target), **RECON-02** (4-state ACFR location + extraction + URL + FY-depth), **RECON-03** (replace-not-augment, idempotent never-overwrite — owned by Phase 99 but recon's plan must enable it). Also the Out-of-Scope table (no >4 states, no budgetary basis, no paid sources).

### Loader templates to reuse (recon maps each state to one)
- `scripts/processOHAcfr.js` — Ohio ACFR spending-by-function template (P2 negative clamp + 0-NULL source stamp + never-overwrite).
- `scripts/processOHRevenueAcfr.js` — Ohio ACFR revenue-by-source template.
- `scripts/processVAAcfr.js` / `scripts/processVARevenueAcfr.js` — Virginia ACFR spend + revenue templates.
- `scripts/processMN.js` / `scripts/processMNRevenue.js` — Minnesota templates (the deepest-history precedent — MN went to FY2008).
- `scripts/loadStateGF.mjs` — the **NASBO fallback loader**; stays in place for un-upgraded states. Recon's plan must show how ACFR rows replace its operating rows per state-FY.

### Access / TLS quirks (RECON-02 "TLS quirks noted")
- `.planning/followups/ca-acfr-reconciliation.md` — documents that **CA government ACFRs are frequently CDN-blocked (Akamai/Cloudflare/HTTP 403/image-only) to CLI fetches**, with a browser-download workaround (download PDF locally → Read tool reads it). Relevant if a state ACFR won't fetch via `curl`. Also: roadmap notes `archives.obm.ohio.gov` needs `curl --insecure --tlsv1.2` (TLS-handshake quirk) — same class of issue to expect per state.

No external ADRs/specs beyond the above — requirements are fully captured in `.planning/REQUIREMENTS.md` + the decisions in this file.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ACFR loader family** (`processOHAcfr.js`, `processOHRevenueAcfr.js`, `processVAAcfr.js`, `processVARevenueAcfr.js`, `processMN.js`, `processMNRevenue.js`): proven revenue-by-source + spend-by-function extractors with the P2 negative-category clamp, 0-NULL source stamping, and never-overwrite guard already built in. One of these is the template per state — recon picks the closest layout match.
- **`scripts/loadStateGF.mjs`**: the NASBO operating-only loader (the rows being replaced). Has the idempotency/never-overwrite pattern Phase 99 must preserve when ACFR replaces NASBO per state-FY.

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven on MN/OH/VA, re-confirmed Phase 97). This is the extraction primitive recon exercises across the full window.
- **Per-node basis label + source chip** make divergent per-state FY windows and mixed basis (GAAP vs NASBO budgetary) honest in the UI — why D-03 (independent windows) is safe.
- **Closeout mold** (Phases 88/93/97): recon → independent re-derivation from the ACFR (not loader self-report) → cohort source-chain audit → live UAT. Phase 98 is the recon front of that mold.

### Integration Points
- Recon's loader-reuse plan is the input contract for Phase 99 (CA+TX) and Phase 100 (NY+FL). The extracted full-window text/tables produced here feed those loads directly.
- The CA upgrade-target recommendation feeds Chris's approval gate before/within Phase 99.
</code_context>

<specifics>
## Specific Ideas

- The four states, in milestone priority order: **CA, TX, NY, FL** (highest-traffic NASBO nodes).
- Target statement is specifically the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP, in thousands) — NOT the government-wide Statement of Activities and NOT budgetary/forecast figures.
- MN (FY2008) is the depth precedent that makes "as-deep-as-clean" concrete: don't assume a shallow window.
- Browser-download fallback for CDN-blocked ACFRs is an accepted, already-used workaround (see `ca-acfr-reconciliation.md`) — recon should reach for it rather than treating a 403 as a blocker.
</specifics>

<deferred>
## Deferred Ideas

- **MN history FY1997–FY2007** (`MNHIST-02`) and the **MN FY2008 $8.79M categorization gap** (`MNGAP-01`) — explicitly Future Requirements in `.planning/REQUIREMENTS.md`, out of scope for v2.11. The seed note floated folding them in; the milestone deliberately did not. Not part of Phase 98.
- **NASBO long-tail ACFR upgrades** (PA, IL, GA, NC, MI, NJ, WA, AZ, … — `ACFRX-01`/`ACFRX-02`) — the follow-up milestone after this 4-state pilot proves the path.
- **Actual CA upgrade-target decision + reconcile/retire execution** — recon recommends here; the decision and execution land in Phase 99 (gated on Chris's approval).

None of the above are scope creep into Phase 98 — discussion stayed within the recon boundary.
</deferred>

---

*Phase: 98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon*
*Context gathered: 2026-06-29*
