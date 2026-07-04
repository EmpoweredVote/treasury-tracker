# Phase 117: Recon — Source Location + Roster Lock + Overlap/Scope Pre-flight (RECON-11) - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

> **Note on decision provenance:** The three phase-specific gray areas (D-01, D-02, D-03 below) were presented to Chris but the session was idle, so the **Recommended** option was locked by best judgment. Each recommended option is consistent with the established recon mold (D-04…D-12 carried forward) and the milestone's honesty-over-completeness ethic. Revisit at planning if Chris wants to change any.

<domain>
## Phase Boundary

A **documentation-only recon phase** — no DB loads, no NASBO-row mutations, no frontend changes, $0 (`pdftotext` only, no AI). It is the input contract that de-risks the parallel load/deepen phases (118 ∥ 119 ∥ 120 ∥ 121 ∥ 122) before any write, and it must leave the state ready for NASBO retirement (Phase 123). It delivers three things:

1. **Per-state ACFR sources located + tie-confirmed (RECON-11):** For each of the **21 remaining NASBO states** (AK, AR, DE, HI, ID, IA, KS, ME, MS, MT, NE, NV, NH, NM, ND, OK, RI, SD, VT, WV, WY), locate the ACFR Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* — **GENERAL FUND column**, units, fiscal-year-end month, durable per-year URLs, and cleanly `pdftotext -table`-extractable FY depth. **Bookend-tie-confirm** each window (oldest + latest FY) at exact $0, pin the four risk facts (D-08), and write a **per-state gap log** for years lacking a durable URL or clean extraction. **OK reuses its v2.14-preserved recon** (see canonical refs) — verify it still resolves, don't re-spelunk from scratch.

2. **Roster locked + overlaps/scope/FY-end flagged (RECON-11):** Lock the final roster; flag any state-node overlap (pre-existing custom-source node), GF-alone scope divergence (broader/narrower consolidated fund vs NASBO's GF definition), and non-June FY-end — each with the load-time decision noted. Because this is the **final tail** and there is no "next tranche" to defer to, a state that has no cleanly-extractable GAAP ACFR GF statement is handled per the fill policy (D-01), not silently dropped.

3. **DEEP-05 deeper-history URLs located + bookend-tied:** Locate + bookend-tie the deeper-history windows for the four existing ACFR nodes — **CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016** — as deep as durable URLs allow (D-02). Flag pre-GASB-34 years for `pre34Extract.mjs` at load.

**Out of this phase:** loading data into Supabase, mutating NASBO rows, the "Money In" revenue view (data-driven — auto-enables on load, no frontend work this milestone), the actual upgrade/deepen loads (Phases 118–122), the NASBO retirement itself (Phase 123), and verification/UAT (Phase 124). Recon recommends; the accept/relabel + greenlight calls land in the load phases.

**Written as:** a recon doc set (per-state / per-batch `SOURCES.md` + gap log + deepening-URL doc, following the Phase 98/103/107/112 shape) — no DB writes.
</domain>

<decisions>
## Implementation Decisions

### Fill Policy for the Final Tail + NASBO-Retirement Pre-flight (NEW — this milestone)
- **D-01 (Stay-NASBO exception; retire anyway — best judgment, Chris idle 2026-07-03):** Because this is the FINAL tail with no next tranche, a state that has **no cleanly-extractable GAAP Governmental-Funds ACFR GF statement** does **not** block the milestone. It **stays NASBO-served, documented as an honest exception** in the recon deliverable. NASBORT-01 (Phase 123) **still proceeds** — NASBO is demoted to fallback-only for all served nodes; any exception node keeps rendering NASBO under a clear, honest basis label. "All 50 on ACFR" is honestly restated as "all states that have a clean GAAP ACFR are on ACFR; the remainder stay on labelled NASBO fallback." **Per-state best-effort accept-relabel** (accepting a broader/budgetary basis via the D-09 precedent to pull a hard-case state onto real sourced data) remains a **load-time accept/relabel call that recon surfaces with magnitude + basis options** — recon flags, the load phase decides (consistent with D-10). Recon must produce an explicit **"which nodes remain NASBO-served after this milestone" list** to feed Phase 123.

### DEEP-05 Deepening Recon Scope (NEW — this milestone)
- **D-02 (Go as deep as durable URLs allow; bookend-tie each — best judgment, Chris idle 2026-07-03):** For CA/NY/FL/TX, locate + **bookend-tie** (oldest + latest of each deepening window) and go as far back as **durable URLs + clean `-table` extraction** allow. **No hard FY floor** (mirrors the v2.14 DEEP deepening pass and D-02's pilot precedent). The **recency floor (D-07) does NOT apply** — these are all pre-existing-window (older) years. **Pre-GASB-34 years are flagged for `pre34Extract.mjs`** at load (CA pre-FY2020 and TX FY2016 are post-GASB-34; NY going deep + FL may cross the FY2002 boundary — flag where it does). Same D-06 durable-URL discipline: a year reachable only via a non-durable source is excluded + logged, tie does not override durability.

### Small-State Risk Anticipation (NEW — this milestone)
- **D-03 (Add explicit "no-clean-GAAP-ACFR exists?" triage per state — best judgment, Chris idle 2026-07-03):** The 21 remaining are the **smallest-GF states**, with a higher chance some publish no GAAP ACFR at all, use biennial budgets, have non-June FY-ends, or don't split a clean "General Fund" column. Beyond the locked D-08 four-risk-facts, recon adds an explicit **per-state triage**: does a GAAP Governmental-Funds ACFR with a splittable GF column even exist? This surfaces stay-NASBO / accept-basis candidates **early** (before deep URL-spelunking) and **feeds the D-01 fill-policy decision + the Phase 123 NASBO-served list**.

### Carried Forward From the v2.11/v2.12/v2.13/v2.14 Recon Mold (established + locked — NOT re-discussed)
- **D-04 (Recon effort budget ~15–20 min/state):** Bounded per-state URL-spelunking cap. If no durable per-year URL surfaces within budget, log it in the gap log and move on. The aggregate is larger (21 states + 4 deepening targets ≈ 25 recon targets, the largest recon yet) only because there are more targets; the per-target discipline is unchanged. (v2.12 D-01 → v2.13 D-04.)
- **D-05 (Bookend tie-confirm):** Tie-confirm the OLDEST + LATEST FY of each window now (proves the ends + that older PDFs still `-table`-extract); record per-year URLs; let the load phases extract the in-between years. (v2.11 Phase 98 / v2.12 D-03.)
- **D-06 (Durable URL is a hard requirement):** A year reachable only via a non-durable source (Wayback snapshot, one-off archive link with no stable pattern) is **excluded and logged**, NOT loaded. A tie-confirmed total does not override durability. (v2.12 D-01/D-02.)
- **D-07 (Recency floor — no regression):** Every state's clean ACFR window MUST cover the recent years its NASBO rows currently hold (**FY2023 + FY2024**) before recon recommends the NASBO replacement, or recon **flags it as a blocker/decision** for the load phase rather than silently stranding the latest data. Applies to all 21 load candidates. (Does NOT apply to the D-02 deepening targets — those are pre-window.) (v2.12 D-06.)
- **D-08 (Four risk facts pinned at bookend, per state):** (1) **Units** — thousands / millions / dollars, so the loader scales correctly (NY ×1,000-millions trap); (2) **Negative-category years** — any negative GF line (investment-income losses) in the bookend years, so the P2 clamp is anticipated (OH FY2022 / CO TABOR precedent); (3) **Exact GF column header + statement** — confirm it's the Governmental Funds *Statement of Rev/Exp/Changes → General Fund column* (GAAP), NOT the government-wide Statement of Activities, NOT budgetary/forecast; (4) **FY-end month** — confirm each state's FY-end so FY labeling + source date are right (several small states are non-June — flag them). (v2.12 D-05.)
- **D-09 (Scope divergence → flag + recommend accept-relabel):** If a state's ACFR GF column is materially broader/narrower than its NASBO General Fund (UT ~0.83× / AL ~0.24× / LA ~1.90× / TX ~3× precedent), recon **documents the scope + magnitude vs NASBO** and **recommends accepting the ACFR GF-equivalent column as the node** (relabel basis honestly, per-node source chip). Never carve a broader consolidated fund down to NASBO's definition. The accept/relabel call is confirmed at load time. (v2.13 D-09 → ACFR-19.)
- **D-10 (Overlaps = flag + plan, not execute):** Any pre-existing custom-source state node among the 21 → recommend in-place upgrade (Phase 98 CA precedent, no duplicate node); identify + note. Recon documents the plan; the load phases execute it.
- **D-11 (Ship-what-survives on count, not on states):** Roster is drawn ONLY from the named 21. Recon does NOT reach outside the 21 to hold a count. A state that can't cleanly extract is handled per D-01 (stay-NASBO exception), not substituted. (v2.13 D-01 adapted for the final tail — there is no larger pool to reach into.)
- **D-12 (Batch split locked by roadmap — smallest-GF-first):** Recon confirms the roadmap's batch assignment (118 = AK/AR/DE/HI/ID; 119 = IA/KS/ME/MS/MT; 120 = NE/NV/NH/NM/ND; 121 = OK/RI/SD/VT/WV/WY; 122 = DEEP-05). If a state becomes a stay-NASBO exception (D-01), surviving states keep their assignment and batches rebalance around them. (v2.13 D-03.)

### Claude's Discretion
- **Loader-template → per-state mapping** (which existing `process*Acfr.js` family / the `extract_gf.py` + `gen_state.py` tooling best fits each new state's GF-statement layout) is a recon *finding* to derive from the actual ACFR layouts — the milestone already locks "clone the proven per-state loader template," so this is layout-matching, not an open architecture choice.
- **Exact `pdftotext` invocation per state/year** (page ranges, `-f/-l` bounds, light `-table` cleanup) is recon's to determine empirically per the Phase 98 D-07/D-08 cleanup levers.
- **Per-year URL pattern discovery** on each state's archive/ACFR page (the exact naming scheme) is recon's to find within the D-04 effort budget.
- **Recon doc file naming/structure** (per-batch `SOURCES.md` + gap log + a deepening-URL doc + the Phase-123-feeding NASBO-served list) — follow the Phase 98/103/107/112 shape.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope + requirements
- `.planning/ROADMAP.md` — the v2.15 milestone block (goal, standing constraints, critical path `117 → (118 ∥ 119 ∥ 120 ∥ 121 ∥ 122) → 123 → 124`) + the **Phase 117** entry (goal + 5 success criteria). Source of the fixed phase boundary. Also Phases 118–122 (the loads/deepen this recon feeds), 123 (NASBO retirement — recon's NASBO-served list feeds it), and 124 (verification).
- `.planning/REQUIREMENTS.md` — **RECON-11** (all 21 located + bookend-tied, roster lock, overlap/scope/FY-end flags, DEEP-05 URLs), the **milestone-wide standing constraints** (free PDFs / $0-$5 gate; GF column via `pdftotext -table` or `pre34Extract.mjs`; durably sourced + basis-labelled; $0 GF-total tie; GF-alone scope resolved honestly; P2 clamp; idempotent never-overwrite; 0 `data_sources` residue; inline exec; no frontend), **NASBORT-01** (retire NASBO to fallback-only — the end state recon must leave reachable), and the Out-of-Scope table.

### Prior recon precedent — the mold this phase repeats
- `.planning/milestones/v2.13-phases/107-recon-acfr-source-location-roster-lock-overlap-resolution-re/107-CONTEXT.md` — **the direct precedent CONTEXT** (bookend, durable-URL hard req, four risk facts, scope-divergence accept-relabel, recency floor, overlaps flag-not-execute). This phase's D-04…D-12 carry these forward. **Start here.**
- `.planning/milestones/v2.13-phases/107-.../107-RECON.md` + `107-BATCH1-SOURCES.md` + `107-BATCH2-SOURCES.md` — the actual recon deliverable shape to mirror (per-state located statement, durable URL pattern, bookend tie confirmations, gap log, GF-scope-vs-NASBO magnitude).
- **`.planning/phases/112-recon-roster-lock-source-location-overlap-resolution-recon-0/112-RECON.md` + `112-BATCH1-SOURCES.md` + `112-BATCH2-SOURCES.md` + `112-CONTEXT.md`** — the **most recent recon** (v2.14, preserved at git tag `v2.14`; not in the working tree — retrieve via `git show v2.14:<path>`). **Contains the preserved OK (Oklahoma) recon** (OK was locked then rank-corrected to Alabama, so its recon was done but not loaded — reuse it for ACFR-48). Verify OK's URLs still resolve before trusting them.
- `.planning/milestones/v2.12-phases/103-recon-deeper-history-urls-pa-il-acfr-source-location-recon-0/103-CONTEXT.md` + `103-RECON.md` — the **deeper-history recon precedent** for the DEEP-05 half (D-02).
- `.planning/milestones/v2.11-phases/98-recon-ca-overlap-4-state-acfr-source-location-recon-01-recon/98-RECON.md` + `98-CONTEXT.md` — the ORIGINAL recon + the CA in-place-upgrade overlap precedent; also the CA SCO **soft-404 caution** (HTTP 200 + HTML for missing files — filter by Content-Type/size).

### Loader templates + tooling (Phases 118–122 will clone; recon picks the closest layout match per state)
- `_acfr-work/extract_gf.py` + `_acfr-work/gen_state.py` (and `_acfr-work/gen_in.py`) — the **v2.14 per-state loader template** the milestone locks (clone + swap the source map + transcribe blocks). Per-state working dirs under `_acfr-work/<st>/` show the proven pattern for the 29 existing ACFR states.
- `scripts/loadStateGF.mjs` — the **NASBO fallback loader** (the rows being replaced, and the code Phase 123 demotes to fallback-only). Recon's plan shows how ACFR rows replace its operating rows per state-FY (idempotent never-overwrite) and which nodes stay NASBO-served.
- `scripts/pre34Extract.mjs` — the **pre-GASB-34 extractor** (v2.14 Phase 115) for years before the FY2002 GASB-34 boundary — the DEEP-05 (D-02) deepening pass flags where it's needed.
- `scripts/process{CA,TX,NY,FL,PA,IL,OH,VA,MN}*Acfr.js` families — additional layout-match references for states whose GF statement differs.

### Access / TLS quirks
- `.planning/followups/ca-acfr-reconciliation.md` — CDN-blocked CA *city* ACFRs + browser-download workaround. State ACFRs were far more accessible (plain `curl`); reach for the browser-download fallback rather than treating a 403/soft-404 as a hard blocker. (Memory: `tn.gov` needs a browser UA; MI is Sep-30 FY-end.)

No external ADRs/specs beyond the above — requirements are fully captured in `.planning/REQUIREMENTS.md` + the prior recon docs + the decisions in this file.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_acfr-work/extract_gf.py` + `gen_state.py`** — the milestone-locked per-state clone target (proven across the 29 existing ACFR states in `_acfr-work/<st>/`). Recon does NOT write loader code — it identifies which template/layout fits each state and pins the source map inputs (per-FY URL, units, page bounds).
- **`scripts/loadStateGF.mjs`** — NASBO operating-only loader; the idempotency/never-overwrite pattern the load phases must preserve when ACFR replaces NASBO per state-FY, and the code Phase 123 (NASBORT-01) demotes to fallback-only. Recon must leave an explicit list of which nodes it will still serve.
- **`scripts/pre34Extract.mjs`** — pre-GASB-34 extractor for the DEEP-05 deepening pass (D-02) where a window crosses the FY2002 boundary.

### Established Patterns
- **`pdftotext -table` reads ACFR GF columns cleanly** (proven MN/OH/VA/CA/TX/NY/FL/PA/IL + v2.13/v2.14 cohort). `-layout` misaligns; `-table` is the clean read + light-cleanup lever (Phase 98 D-07/D-08).
- **Bookend recon** (Phase 98/103/107/112): tie-confirm oldest + latest FY now, record per-year URLs, defer in-between extraction to the load phase.
- **Per-node basis label + source chip** make divergent per-state FY windows + mixed basis (GAAP vs NASBO budgetary vs pre-GASB-34) honest in the UI — why per-state independent windows are safe, why D-09 accept-relabel works, and why a stay-NASBO exception (D-01) can render honestly.
- **In-place overlap upgrade** (Phase 98 CA-v1.7 / v2.13 MA): a state with a pre-existing node gets it upgraded in place (no duplicate) — the model for any overlap among the 21 (D-10).
- **Closeout mold** (Phases 88/93/97/102/106/110/116): recon → independent blind re-derivation from the ACFR (not loader self-report) → 50-node cohort source-chain audit → live UAT. Phase 117 is the recon front; Phase 124 is the back.

### Integration Points
- Recon's per-state source-map contract + loader-shape finding + locked roster + batch confirmation (D-12) are the input contract for Phases 118–121 (loads) and 122 (deepen).
- Recon's **"nodes remaining NASBO-served" list** (D-01) is the input contract for Phase 123 (NASBORT-01).
- The data-driven "Money In" view + `?dataset=revenue` deep-link (shipped v2.11) auto-enable revenue once each state's data lands — **no frontend work**, so recon need not touch the frontend.
- Existing cohort = **29 ACFR nodes** + 21 NASBO states (901 rows, 0 anomalies at v2.14 close). Recon must confirm its plan leaves the 29 undisturbed and only touches the 21 roster states + the 4 DEEP-05 nodes (idempotent never-overwrite).
</code_context>

<specifics>
## Specific Ideas

- **The 21 remaining NASBO states** (smallest GFs; largest-first within each batch per the roadmap): Batch 1 (Ph118) = AK/AR/DE/HI/ID; Batch 2 (Ph119) = IA/KS/ME/MS/MT; Batch 3 (Ph120) = NE/NV/NH/NM/ND; Batch 4 (Ph121) = OK/RI/SD/VT/WV/WY (OK recon preserved from v2.14).
- **DEEP-05 deepening targets** (existing ACFR nodes): CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016 (Ph122).
- Target statement per state = the **Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances → General Fund column** (GAAP) — NOT the government-wide Statement of Activities, NOT budgetary/forecast (D-08.3).
- Cohort goes from **29 ACFR nodes → up to 50** on completion (minus any D-01 stay-NASBO exceptions, documented honestly).
- Known traps from memory: NY ×1,000-millions units; MI Sep-30 FY-end (watch other non-June small states); `tn.gov` needs a browser UA; FY2002 = pre-GASB-34 boundary.
</specifics>

<deferred>
## Deferred Ideas

- **Deleting the NASBO loader code** — explicitly out of scope. NASBORT-01 retires it to fallback-only (relabelled/guarded), keeping it available as a documented dormant fallback.
- **Flat-source icicle drill-down fix** (`project_flat_source_icicle_limitation`) — accepted limitation, not this milestone.
- **Backfilling the always-sourced federal standard** (source chips / official-record links) to city/state data (`SRCSTD-01`) — separate future milestone.
- **Votes/amendments exploration hub** (`VOTES-01`) — the eventual mission destination, future milestone.
- **Frontend / UI work** — out of scope; "Money In" + `?dataset=revenue` are data-driven and auto-enable on load.

None of the above are scope creep into Phase 117 — discussion stayed within the recon boundary.
</deferred>

---

*Phase: 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r*
*Context gathered: 2026-07-03*
