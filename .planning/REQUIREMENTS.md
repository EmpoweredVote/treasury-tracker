# Requirements: v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement

**Defined:** 2026-07-03
**Core Value:** Any citizen can open treasurytracker.empowered.vote and trust that every figure shown is real and sourced — no "best guess" data wearing a real-looking label.

## Milestone Scope

Finish the State-ACFR long tail: upgrade the **last 21 NASBO states** to full State-ACFR GAAP General-Fund data (revenue-by-source + finer spending-by-function), bringing **all 50 states onto ACFR**; bundle the recorded deepening holes on the existing ACFR nodes; and **formally retire NASBO to fallback-only**. Continuation of the v2.11–v2.14 State-ACFR arc, using the identical proven per-state loader template.

**The 21 remaining NASBO states** (smallest General Funds; OK's recon preserved from v2.14): AK, AR, DE, HI, ID, IA, KS, ME, MS, MT, NE, NV, NH, NM, ND, OK, RI, SD, VT, WV, WY.

## Milestone-wide constraints (standing acceptance criteria for every load/deepen requirement)

These apply to **every** ACFR-nn / DEEP-05 requirement below — an implementation is not "done" unless it satisfies all of them:

- **Free ACFR PDFs only** — $0 spend; $5 AI-spend gate (estimate before any AI run). No paid APIs/data.
- **GENERAL FUND column** of the Governmental Funds Statement, extracted via `pdftotext -table` (or `pre34Extract.mjs` for pre-GASB-34 years).
- **Every displayed figure durably sourced + basis-labelled** (GAAP vs budgetary; honest pre-GASB-34/CAFR-era labels where applicable).
- **Every loaded year ties exactly** ($0 delta) to its printed GF column total; honest holes documented, never faked or estimated.
- **GF-alone scope divergences resolved + relabelled honestly at load time** (UT/AL/LA precedent) — never carve a broader consolidated fund down to NASBO's definition.
- **P2 negative-category clamp** on negative GF categories (clamp slice to 0, keep signed magnitude in the label, preserve the true parent total).
- **Idempotent, never-overwrite** — NASBO operating replaced in place per state-FY; the 29 existing ACFR nodes and any un-upgraded state left untouched; a re-run is a no-op.
- **0 `data_sources` residue with no manual re-clean** (LOAD-01 must hold cohort-wide — the ephemeral lifecycle from v2.14 Phase 111).
- **Executed inline** (no research/roadmapper/loader subagents); clone the proven per-state loader template (`extract_gf.py` + `gen_state.py`).
- **No frontend work** — "Money In" revenue-by-source view + `?dataset=revenue` deep-links auto-enable once a node has revenue data.

## v1 Requirements (v2.15)

### Recon

- [ ] **RECON-11**: All 21 remaining NASBO states have their ACFR Governmental-Funds GF statement located with confirmed units, fiscal-year-end, and durable per-year source URLs, bookend-tie-confirmed at exact $0; roster locked; any state-node overlaps / scope-divergences / non-June FY-ends flagged pre-load. Recon also locates the deeper-history ACFR URLs for the DEEP-05 targets (CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016).

### ACFR Upgrades — Batch 1

- [x] **ACFR-33**: Alaska (AK) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function, as deep as durable URLs allow
- [x] **ACFR-34**: Arkansas (AR) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-35**: Delaware (DE) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-36**: Hawaii (HI) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-37**: Idaho (ID) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function

### ACFR Upgrades — Batch 2

- [x] **ACFR-38**: Iowa (IA) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-39**: Kansas (KS) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-40**: Maine (ME) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [ ] **ACFR-41**: Mississippi (MS) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [ ] **ACFR-42**: Montana (MT) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function

### ACFR Upgrades — Batch 3

- [x] **ACFR-43**: Nebraska (NE) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-44**: Nevada (NV) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-45**: New Hampshire (NH) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-46**: New Mexico (NM) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-47**: North Dakota (ND) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function

### ACFR Upgrades — Batch 4

- [x] **ACFR-48**: Oklahoma (OK) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function (recon preserved from v2.14)
- [x] **ACFR-49**: Rhode Island (RI) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-50**: South Dakota (SD) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-51**: Vermont (VT) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-52**: West Virginia (WV) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function
- [x] **ACFR-53**: Wyoming (WY) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function

### Deepening (existing ACFR nodes)

- [x] **DEEP-05**: The recorded pre-window holes on existing ACFR nodes are recovered as deep as durable URLs allow — CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016 — every added year tying exactly to its printed GF total, honest basis labels (reuse `pre34Extract.mjs` where pre-GASB-34), remaining unrecoverable years documented honestly *(Phase 122: CA +6→FY2002, FL +18→FY2003; NY/TX floors reconfirmed 0 recoverable; FL FY2000–02 repair-pending. Per-state VER-09/VER-10 audit deferred to Phase 124.)*

### NASBO Retirement

- [ ] **NASBORT-01**: With all 50 states on ACFR, the `loadStateGF.mjs` NASBO path is demoted to fallback-only (relabelled / guarded so it no longer serves any live node), and the 50/50-ACFR end state is documented; no live state node still displays NASBO where ACFR now exists

### Verification

- [ ] **VER-09**: Loader-independent blind re-derivation of every newly-loaded and newly-deepened state-FY ties at exact $0; a 50-state cohort source-chain audit confirms all rows sourced / windowed / deduplicated / basis-labelled with 0 `data_sources` residue and no manual re-clean (LOAD-01 holds cohort-wide); all 50 nodes confirmed on ACFR
- [ ] **VER-10**: Chris live-app UAT sign-off across a representative sample of the newly-upgraded ACFR states + a deepened node, confirming real sourced revenue-by-source + spending-by-function render correctly and no node still shows NASBO where ACFR now exists

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Votes/amendments exploration hub (VOTES-01) | The eventual mission destination — its own future milestone |
| Sourced-standard backfill to city/state data (SRCSTD-01) | Separate milestone; proven federally, not part of the state-ACFR arc |
| Frontend/data-viz changes | Money In + `?dataset=revenue` are data-driven and auto-enable; no UI work needed |
| Paid APIs / paid AI | Ground rule — free ACFR PDFs only, $0 / $5 gate |
| Deleting the NASBO loader code | Retire to fallback-only (NASBORT-01), not delete — keep it available as a documented fallback |
| Flat-source icicle drill-down fix | Accepted limitation (`project_flat_source_icicle_limitation`); not this milestone |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RECON-11 | Phase 117 | Pending |
| ACFR-33 | Phase 118 | Loaded (Ph124 verify) |
| ACFR-34 | Phase 118 | Loaded (Ph124 verify) |
| ACFR-35 | Phase 118 | Loaded (Ph124 verify) |
| ACFR-36 | Phase 118 | Loaded (Ph124 verify) |
| ACFR-37 | Phase 118 | Loaded (Ph124 verify) |
| ACFR-38 | Phase 119 | Complete |
| ACFR-39 | Phase 119 | Complete |
| ACFR-40 | Phase 119 | Complete |
| ACFR-41 | Phase 119 | Pending |
| ACFR-42 | Phase 119 | Pending |
| ACFR-43 | Phase 120 | Complete |
| ACFR-44 | Phase 120 | Complete |
| ACFR-45 | Phase 120 | Complete |
| ACFR-46 | Phase 120 | Complete |
| ACFR-47 | Phase 120 | Complete |
| ACFR-48 | Phase 121 | Complete |
| ACFR-49 | Phase 121 | Complete |
| ACFR-50 | Phase 121 | Complete |
| ACFR-51 | Phase 121 | Complete |
| ACFR-52 | Phase 121 | Complete |
| ACFR-53 | Phase 121 | Complete |
| DEEP-05 | Phase 122 | Complete |
| NASBORT-01 | Phase 123 | Pending |
| VER-09 | Phase 124 | Pending |
| VER-10 | Phase 124 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-03*
*Last updated: 2026-07-03 after initial definition*
