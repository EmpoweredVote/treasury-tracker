# Milestones — Treasury Tracker / Empowered Vote Financials

## v2.17 Tucson, AZ City Onboarding (Shipped: 2026-07-11)

**Phases completed:** 3 phases (128-130), 8 plans. Requirements TUC-01..09 all complete.

**Delivered:** The City of Tucson, AZ onboarded at city parity — General Fund revenue-by-source + 2-level expenditure-by-function from its own ACFR (GAAP), FY2015-FY2024, per-capita, enriched, every figure durably sourced — under a new Pima County navigation node beneath Arizona, with the v2.16 Essentials tether confirmed live. Free ACFR PDFs only, $0 AI spend, executed inline (no subagents).

**Key accomplishments:**

- **Recon + extractor (Phase 128):** Enumerated + pinned durable per-FY tucsonaz.gov URLs for the FY2015-FY2024 clean-extract window; built `scripts/extractTucson.py` (`--mode operating|revenue`, stdlib-only, positional GF-column isolation via `pdftotext -table`, fail-loud `tie_delta` gate) — 20/20 dry-runs sum to the printed GF total at exactly $0.
- **Data model + load (Phase 129):** Idempotent seeder creates Tucson (AZ, pop 554,013) + Pima County nav node (pop 1,080,149) linked via `county_id`, both pinned to live Census Vintage-2024 estimates; `scripts/processTucson.js` loads 20 `budgets` rows via the source-safe `treasury_sync_budget_tree` RPC — all durably sourced, 0 `data_sources` residue, idempotent.
- **Enrichment (Phase 129):** `loadTucsonEnrichment.mjs` derives the worklist live from `budget_categories` — 15/15 keys covered (generic universal + Tucson-scoped), delete-then-insert NULLS-DISTINCT-safe, 0 `$`/locality bleed.
- **Verification (Phase 130, TUC-07):** A from-scratch, loader-independent re-derivation harness re-extracts every displayed figure directly from the 10 PDFs and ties the live DB — all 20 FY×mode roll-ups + every category subtotal + every leaf at exactly $0; source-chain audit clean (20/20 correct-per-FY reachable URLs, 0 residue, no stale labels, Census-pinned population).
- **Tether (Phase 130, TUC-09):** Live `coverage.json` probe pre-determined both Tucson (GEOID 0477000) + Pima County (04019) as COVERED; icon confirmed live on both banners — no cross-repo gap.
- **Live UAT (Phase 130, TUC-08):** Chris signed off 15/15 scenarios at treasurytracker.empowered.vote (icicle 2-level drill, Money In/Out, per-capita, source chips, breadcrumb + Cities-in-County, AZ regression, year switcher/era labels, FY21/22 merged-label quirk, FY2025-absence empty state).

**Known deferred items at close:** 5 pre-existing/benign open artifacts acknowledged (see STATE.md Deferred Items) — 3 stale v1.x-era quick-tasks, 1 frontend-routing todo, and the 130 UAT checklist (passed). None are v2.17 work.

---

## v2.16 Tethered Icons & Smart Banner (Shipped: 2026-07-08)

**Phases completed:** 3 phases, 4 plans, 9 tasks

**Key accomplishments:**

- Fetch-once/cache/never-throw Essentials coverage loader + tier-aligned, state-scoped, loose-matching resolver (`essentialsCoverage.ts`), proven by a 14-assertion fixture-backed vitest suite and wired into `App.tsx` as a real `data-essentials-coverage` DOM seam for Phase 126.
- Bottom-right hero-banner icon row deep-linking the current entity into Essentials via a fixed-order product registry (essentials live, compass/readrank reserved), built with @floating-ui/react tooltips and URL/URLSearchParams-only href construction.
- Proved the Essentials tether is context-sensitive end-to-end (icon iff a real per-location link exists) and passed Chris's live-app UAT across every entity tier — the v2.16 capstone, zero defects.

---

## v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement (Shipped: 2026-07-06)

**Phases completed:** 8 phases (117–124), 34 plans
**Git range:** `067e338..655b77d` — 127 commits, 246 files, +34,346 / −10,739 lines (2026-07-03 → 2026-07-06)

**Delivered:** The State-ACFR arc is complete — **all 50 states now carry State-ACFR GAAP General-Fund data** (revenue-by-source + finer spending-by-function). The last 21 NASBO states (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/OK/RI/SD/VT/WV/WY) were upgraded NASBO→ACFR across four parallel load batches (Phases 118–121), every loaded state-FY tying $0 to its printed GF total — including scanned/raster-image years (NM FY2022, OK FY2019, SD) hand-transcribed via independent OCR. Existing nodes deepened (**CA +6→FY2002** at the GASB-34 boundary, **FL +18→FY2003–2020**; NY/TX floors reconfirmed). **NASBO retired to fallback-only** (guarded via `isAcfrOccupied`) — no live node shows NASBO where ACFR exists; only two honest fallback rows remain (NV FY2024, KY FY2023 — genuine ACFR gaps). Free ACFR PDFs only, $0 AI spend, executed inline.

**Key accomplishments:**

- **Phases 118–121 (ACFR-33..53):** All 21 remaining NASBO states upgraded to full State-ACFR GAAP — cohort 29 → **50/50 ACFR states**. Every state-FY ties $0 to its printed GF column total; scanned/raster years OCR'd independently and tied exact; scope divergences (AR single-fund, etc.) relabelled honestly.
- **Phase 117 (RECON-11):** All 21 states located, bookend-tied at $0, roster locked with load-time flags — **zero STAY-NASBO exceptions**, so the NASBO-served list came out empty and every state landed on ACFR (verified 7/7, $0 DB writes).
- **Phase 122 (DEEP-05):** Existing ACFR nodes deepened — CA back to FY2002 (GASB-34 boundary), FL to FY2003–2020; NY/TX floors reconfirmed 0 recoverable; FL FY2000–02 documented repair-pending.
- **Phase 123 (NASBORT-01):** NASBO path demoted to guarded fallback-only; 50/50-ACFR end state documented; no data regression on any of the 50 ACFR nodes.
- **Phase 124 (VER-09, VER-10):** Verified end-to-end — **149/151 loader-independent blind re-derivations at exact $0** (2 explained rounding), a **14/14-invariant 50-node / 1,560-row cohort audit** (50/50-ACFR, NASBORT-01, LOAD-01 clean, 0 residue no manual re-clean), and **Chris live-app UAT 12/12 all-pass**.
- **Also shipped this cycle (outside the milestone):** a search-first landing page (removed the "Available communities" browse grid) and hero banners re-sourced from the shared Empowered Vote asset bucket with attribution.

**Known deferred items at close:** 1 (todo `2026-06-30-authenticated-deeplink-redirect-to-home-jurisdiction`, frontend-routing — see STATE.md Deferred Items). The three Longview-TX / Collin-County quick tasks flagged by the close audit are verified-complete (audit filename-detection quirk, not real gaps).

---

## v2.14 State ACFR Long Tail — Tranche 3 + Deepening (Shipped: 2026-07-03)

**Phases completed:** 6 phases (111–116), 20 plans
**Git range:** `ad21f17..8159ab6` — 112 commits, 142 files, +20,813 lines (2026-07-02 → 2026-07-03)

**Delivered:** Three moves, all landed. **(1)** Retired the WR-05 loader debt — the `process*Acfr.js` `data_sources` write became an ephemeral lifecycle across all 35 state loaders, so a full run (including an idempotent re-run) leaves **0 residue with no manual re-clean** — closing the residue class that required hand-deletion at every prior close (106: 10 rows, 110: 20 rows). **(2)** Grew the State-ACFR GAAP cohort **19 → 29 states** — Batch 1 (IN/AZ/OR/MO/CO) + Batch 2 (SC/KY/UT/AL/LA) upgraded NASBO→full ACFR GF revenue-by-source + finer spending-by-function, most back to FY2002 (24 years), every year tying its printed GF column total. **(3)** Recovered the v2.13 history holes via a new pre-GASB-34 extractor — CT to a 38-year contiguous series (FY1988–2025), WI to 26 years, NJ contiguous FY2002–2025, MA 2/6 holes recovered + 4 documented unrecoverable — all with honest pre-GASB-34 basis labels. Cohort now **29 ACFR + 21 NASBO = 901 state rows, 0 anomalies**. Free ACFR PDFs only, $0 AI spend, executed inline.

**Key accomplishments:**

- **Phase 111 (loader debt / LOAD-01):** All 35 state loaders now clean up their own `data_sources` rows (ephemeral lifecycle) — the WR-05 residue class that required manual deletion at every milestone close is closed, proven by a live NJ FY2025 re-run bracketed by the cohort-audit probe with **zero manual cleanup**.
- **Phase 112 (recon / RECON-09/10):** Ranked the remaining 31 NASBO states by FY2024 GF size (0 transcription drift), located + bookend-tied the ACFR GF statement for all 10 candidates at exact $0 diffs, and locked the final tranche-3 roster (IN/AZ/OR/MO/CO ∥ SC/KY/UT/AL/LA) with one bounded rank-correction substitution (Oklahoma out → Alabama in); overlaps resolved on paper (UT state node probed clean, 19 existing ACFR nodes undisturbed), $0 DB writes.
- **Phase 113 (Batch 1 / ACFR-21..25):** **IN (FY2002–2025, 24yr), AZ (FY2002–2024, 23yr), OR (FY2022–2025), MO (FY2012–2025, 14yr), CO (FY2023–2025)** live on full State-ACFR GAAP, every year tying $0; CO exercised the tranche's primary live P2 clamp (TABOR years); AZ FY2024 Drive-link durability caveat documented.
- **Phase 114 (Batch 2 / ACFR-26..30):** **SC (24yr), KY (23yr, FY2023 honest hole), UT (FY2019–2025), AL (24yr), LA (24yr)** upgraded NASBO→ACFR GAAP, all tying $0; the three narrower/broader-than-NASBO scope divergences resolved honestly at load time as GF-alone decisions — UT (~0.83× income-tax earmark), AL (~0.24× constitutional dual-budget), LA (~1.90×, ~99% federal Intergovernmental Revenues).
- **Phase 115 (deepening / DEEP-02/03/04):** Built a reusable pre-GASB-34 extractor (`pre34Extract.mjs`) — deepened **CT to a 38-year contiguous series (FY1988–2025)** and **WI to 26 years (FY2000–2025)** (CT FY2006 recovered via free OCR), extended **NJ to contiguous FY2002–2025**, and recovered **MA FY2001 + FY2014** (deepening MA to 21 years) with the other 4 MA holes rigorously documented as unrecoverable.
- **Phase 116 (verification / VER-07/08):** **75/75 loader-independent blind re-derivation checks tie at exact $0** across all 14 states; new 12-invariant read-only cohort audit confirms the 29-ACFR/21-NASBO cohort (901 rows) fully sourced/windowed/deduplicated/basis-labelled (incl. a pre-GASB-34 label distinctness check) and proves **LOAD-01 end-to-end (0 manual re-clean, a series first)**; **Chris live-app UAT 11/11 all-pass (2026-07-03)**.

**Known deferred items at close: 5** (see STATE.md Deferred Items) — 3 pre-existing Longview-TX quick-task stubs (orphaned, acknowledged at every close since v2.0), the v2.12 authenticated-deep-link-redirect todo, and the (passed) Phase 116 UAT artifact. Tech debt carried (all advisory, none affect correctness): WR-04..07 loader error-path robustness (never manifested — 0 residue everywhere this milestone); AL "Charges"→"Changes" category-label drift (FY2018+, unverified against source, ties unaffected); UT trailing-space category name; NJ phantom-comment referencing a non-existent guard function. See v2.14-MILESTONE-AUDIT.md.

---

## v2.13 State ACFR Long Tail — Tranche 2 (Shipped: 2026-07-02)

**Phases completed:** 4 phases (107–110), 16 plans
**Git range:** `70f6e67..81c56c4` — 47 commits, 134 files, +10,853 lines (2026-06-30 → 2026-07-02)

**Delivered:** Doubled the State-ACFR cohort — brought the next **10 largest-General-Fund NASBO states (NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI)** onto full ACFR GAAP GF revenue-by-source + spending-by-function, each as deep as durable ACFR URLs allow, NASBO operating replaced in place idempotently. Cohort now **19 ACFR states (444 rows) + 31 NASBO = 506 state rows, 0 anomalies**. Free PDFs only, $0 AI spend.

**Key accomplishments:**

- **Phase 107 (recon):** all 10 candidate states locked IN — 0 substitutions/deferrals; per-state GF statement located, bookend tie-confirmed, durable per-year URLs + gap logs written; the NJ dollars-unit trap, MI Sep-30 FY-end, MA in-place-upgrade path (v1.8 DLS node, no duplicate), and GA F-97-01 supersede all caught before any write.
- **Phase 108 (Batch 1):** **NJ, MA (in-place), NC, GA (F-97-01 superseded cleanly at $59.9B), MD** upgraded NASBO→ACFR GAAP; MD FY2022 P2 clamp on −$275,992K investment loss with parent total intact; verified retroactively 4/4 success criteria + dedicated 7/7 UAT incl. live idempotency re-run ("Loaded 0 rows", DB-asserted 0 net change).
- **Phase 109 (Batch 2):** **TN 17yr, CT 23yr, WI 24yr, WA 6yr, MI 7yr = 77 state-FYs** loaded with 6 live P2 clamps; scope divergence (1.14× CT to 3.56× MI) accepted + relabelled honestly; shared parser evolved additively (108-era extraction paths untouched).
- **Phase 110 (verification):** **49/49 loader-independent blind re-derivation checks tie at exactly $0** (bookends + newest FY + clamp years, zero loader imports); 50-state cohort source-chain audit **10/10 invariants** clean; WR-05 residue re-cleaned (20 rows).
- **Chris live-app UAT 11/11 all-pass (2026-07-01)** — revenue-by-source, spending-by-function, basis labels, source chips, Money In auto-enabled across the upgraded states; plus the 108-closure UAT 7/7 (2026-07-02).

**Known deferred items at close: 5** (see STATE.md Deferred Items) — 3 pre-existing Longview-TX quick-task stubs, the v2.12 authenticated-deep-link-redirect todo, and the (passed) Phase 110 UAT artifact. Tech debt carried: WR-05 loader data_sources residue (recurs every loader run until upsert is atomic); recoverable history holes (MA FY2001/02/04/05/14/21, CT FY2006 OCR, NJ pre-2020, CT/WI pre-GASB-34); state-node hero banners default to Wikipedia flag images (cosmetic, fix paths diagnosed in 108-UAT.md).

---

## v2.12 State ACFR Long Tail (Shipped: 2026-07-01)

**Phases completed:** 4 phases (103–106), 13 plans

**Delivered:** Extended the proven State-ACFR GAAP upgrade in two directions — deepened the four v2.11 pilots' (CA/TX/NY/FL) ACFR history backward, and brought **Pennsylvania + Illinois** (the two largest remaining NASBO states) onto full ACFR GF revenue-by-source + finer spending-by-function — all independently re-derived, cohort-clean, basis-labelled, and signed off live by Chris. Free PDFs only, `$0`/no paid AI.

**Key accomplishments:**

- **Phase 103 (recon):** located durable deeper-history ACFR URLs for CA/NY/FL/TX and the **PA + IL** ACFR Governmental-Funds *Statement of Rev/Exp* (GF column, units, per-year URLs), each bookend tie-confirmed, with per-state gap logs — the input contract for the loads.
- **Phase 104 (deepen 4 pilots):** extended **CA** (FY2008–2025, +12 yrs via `/Files-ARD/CAFR/cafr{NN}web.pdf`, FY2008 bookend $97,774,378,000), **NY** (FY2003–2014, +12 yrs, ×millions scaling), and **FL** (+FY2021); every added FY ties exactly to its GF column total; P2 clamp fires on FL FY2021's −$398,287K investment loss with root total preserved.
- **Phase 105 (PA + IL — headline):** brought **Pennsylvania** (FY2016–2025) and **Illinois** (FY2021–2025) onto full State-ACFR GAAP revenue-by-source + spending-by-function; NASBO operating replaced in place idempotently (RECON-05); scope divergence accepted + relabelled honestly (PA ~2.0×, IL ~1.5× NASBO GF); P2 clamp on IL FY2022; "Money In" auto-enabled on both nodes.
- **Phase 106 (verification + UAT):** **24/24 loader-independent blind ACFR re-derivations at exact $0 delta**; 50-node cohort source-chain audit **7/7 invariants** over 276 rows (all basis-labelled, 41 NASBO states untouched, idempotent, D-06 holes recorded + honest); **Chris live-app UAT sign-off (8/8 anchors)**.
- **In-milestone UI fix (surfaced during UAT):** reordered the data-viz palette so adjacent categories contrast, and added `hoistSingleRoot` to drop the redundant single-root "…General Fund Budget · 100%" layer — deployed to production. Also corrected malformed UAT deep-links to the canonical `?entity=&year=` format.

**Known deferred items at close: 5** (see STATE.md Deferred Items) — 3 pre-existing Longview-TX quick-tasks, 1 authenticated-deep-link-redirect follow-up todo, and the (passed) Phase 106 UAT artifact.

---

## v2.11 State ACFR Revenue-by-Source Upgrades (Shipped: 2026-06-30)

**Phases completed:** 5 phases (98–102), 13 plans

**Delivered:** Upgraded the four highest-traffic state nodes (CA, TX, NY, FL) from NASBO operating-only estimates to real **State-ACFR GAAP** General-Fund data — revenue-by-source + finer spending-by-function — basis-labelled, durably sourced, independently verified, then signed off live by Chris.

**Key accomplishments:**

- **Phase 98 (recon):** de-risked the CA v1.7 overlap and located all 4 state ACFRs (durable per-year URLs, GF column, units, windows, tie-confirmed bookends) before any load.
- **Phase 99 (CA + TX):** loaded CA FY2020–25 + TX FY2015–24 GF revenue + spending from their ACFRs via `pdftotext -table`, replacing NASBO operating idempotently; proved the per-state upgrade path. TX GR-Fund ~3× scale accepted + relabelled honestly.
- **Phase 100 (NY + FL):** reused the loader pair for NY FY2015–24 (×millions scaling) + FL FY2022–24; extended the stale-`data_sources` cleanup; P2 negative-category clamp fired on NY/FL.
- **Phase 101 (frontend):** pure `resolveEffectiveDataset` helper + App.tsx hardening so the "Money In" revenue-by-source view auto-enables on the 4 nodes and `?dataset=revenue` deep-links validate against availability (fall back to operating on NASBO-only nodes), no regression.
- **Phase 102 (verification + UAT):** loader-independent re-derivation of GF printed totals for the 8 newest+bookend ACFR statements — **16/16 exact ties** ($0 delta); 50-node cohort source-chain audit **7/7 invariants** with genuine **0 residue** (145 stale `*-gf-*` data_sources deleted, 0-row guarded; 46 NASBO states untouched); **Chris signed off the live-app UAT.**

**Cost/safety:** free ACFR PDFs only, `$0`/no-AI extraction; ACFR replaces NASBO per state-FY idempotently; every displayed figure basis-labelled + sourced.

---

## v2.10 State General Fund Sourcing (Shipped: 2026-06-29)

**Phases completed:** 4 phases (94–97), 16 plans

**Delivered:** Replaced the all-50-states unsourced "best guess" estimate state-node General Fund data with real, sourced actuals on the Chris-locked **hybrid** model: **MN/OH/VA** on State **ACFR GAAP** (operating + revenue), the other **47 states** (46 cohort + Georgia) on **NASBO 2025 SER** General Fund operating actuals (FY2023+FY2024). Every displayed figure is durably sourced + basis-labelled (GAAP vs budgetary); 375 unsourced estimate rows deleted (revenue-by-source deferred to future per-state ACFR upgrades — nothing unsourced displayed). Reusable loader `scripts/loadStateGF.mjs` + locked cross-cutting policy (`94-01-POLICY.md`) proven on Georgia FY2023; MN extended FY2008–2025; OH/VA falsely-sourced rows replaced. Phase 97 verified the whole 50-node cohort real+sourced+residue-free (0 unsourced/null/out-of-window/dup/orphan/garbage), reconciled the "Representative 7" independently from source documents, caught + fixed **F-97-01** (GA FY2023 Medicaid: stale 2024-SER value → 2025 SER, children now sum to parent), and earned **Chris's live UAT sign-off (21/21, 2026-06-29)**. Negative-investment-income years (MN/OH/VA FY2022) handled honestly (clamped to 0 with explanatory labels, parent totals preserved). Executed inline ($0 — no research/planner/executor subagents).

**Archive:** [v2.10-ROADMAP.md](milestones/v2.10-ROADMAP.md) | [v2.10-REQUIREMENTS.md](milestones/v2.10-REQUIREMENTS.md)

**Deferred at close (documented, not silent):** cohort revenue-by-source (NASBO has none per-state → future per-state ACFR upgrades); per-state ACFR operating upgrades for high-traffic states; MN FY1997–2007 history + the MN FY2008 operating $8.79M categorization gap (0.055%); minor `?dataset=revenue` URL robustness on operating-only nodes; 3 stale Longview TX quick-task dirs (unrelated, orphaned).

---

## v2.9 Minnesota Local Government Expansion (Shipped: 2026-06-28)

**Phases completed:** 5 phases (89–93), 13 plans

**Delivered:** Every Minnesota city + county government brought onto Treasury Tracker at parity from the single uniform MN Office of the State Auditor "City/County Finances Report" raw XLSX (osa.state.mn.us, free, no auth) — two-level revenue-by-source + expenditure-by-function trees with real icicle drill-down (resolving the Ohio flat-source limitation), per-capita, every figure sourced. **858 cities (20,414 rows) + 87 counties (1,380 rows) + a Minnesota state node + 136 universal enrichment rows.** Cities linked to parent county via the built-in `ParentEntityName`; GAAP/Cash basis per-entity via `GAAPInd`; standardized bleed-safe enrichment inline at $0; reconciled against published ACFRs (Hennepin exact, Minneapolis explained), full-cohort source-chain audit clean, independent workbook re-derivation exact, Chris live UAT all-pass (2026-06-27). **Also caught + fixed:** the MN state node's unsourced "best guess" General Fund data was replaced with real State-of-MN ACFR GAAP actuals (FY2023–2025) — which surfaced a cohort-wide problem now chartered as v2.10.

**Archive:** [v2.9-ROADMAP.md](milestones/v2.9-ROADMAP.md) | [v2.9-REQUIREMENTS.md](milestones/v2.9-REQUIREMENTS.md)

**Deferred at close:** salaries (`Employee Data`), enterprise funds, pre-2015 history, townships (MNSAL/MNENT/MNHIST/MNTWN-01); MN state-node history FY2021/2022+ (→ v2.10).

## v2.8 Ohio Local Government Expansion (Shipped: 2026-06-26)

**Phases completed:** 5 phases (84–88)

**Delivered:** Ohio cities + county governments brought onto Treasury Tracker at parity from the uniform Ohio Auditor of State Summarized Annual Financial Reports XLSX (ohioauditor.gov, free, no auth) — general-government revenue-by-source + expenditure-by-function, per-capita, every figure sourced. 253 cities (4,880 rows) + 88 counties (1,736 rows), linked + enriched + ACFR-reconciled, Chris UAT sign-off 2026-06-26. Accepted limitation: flat AOS source → no icicle drill-down.

**Archive:** [v2.8-ROADMAP.md](milestones/v2.8-ROADMAP.md) | [v2.8-REQUIREMENTS.md](milestones/v2.8-REQUIREMENTS.md)

## v2.7 Virginia Local Government Expansion (Shipped: 2026-06-24)

**Phases completed:** 6 phases (79–83, incl. inserted out-of-scope EV Phase 81.5), 10 plans, 24 tasks

**Delivered:** Every reporting Virginia locality brought onto Treasury Tracker at parity from the single uniform APA Comparative Report XLSX (data.virginia.gov, free, no auth) — general-government revenue by source + expenditure by function→activity (2-level tree), per-capita, every figure sourced. 162 entities / 618 budget rows across FY2023 + FY2024-amended; independent cities render standalone, counties as their own nodes, towns linked to their parent county under a new Virginia state navigation node; standardized bleed-safe plain-language enrichment for the full VA vocabulary; reconciled against published ACFRs and signed off by Chris in the live app. $0 spend (one reusable loader; inline-authored enrichment).

**Key accomplishments:**

- **VA APA source + loader (Phase 79)** — built `scripts/loadVAComparativeReport.js` (exceljs): function→activity expenditure tree (Exhibit C + C1–C8) + revenue-by-source (Exhibit B/B2) + per-FY population (Exhibit H), every figure attributed to data.virginia.gov; proven on Alexandria FY2024 ($863,578,347 exp / $874,230,660 rev, exact); 7/7 offline tests; available XLSX FY range determined (FY2023 + FY2024) (VASRC-01/02).
- **City + county loads (Phase 80)** — section-aware + homonym-safe batch driver loaded 127 of 133 cities + counties (op + rev, FY2023 + FY2024-amended), every row sourced, idempotent; 6 multi-year late-filers documented as a residual source gap (VALOAD-01/02/04).
- **Towns + VA data model & linking (Phase 81)** — all 37 reporting towns batch-loaded (Exhibit A population fallback); a sourced 37-entry town→county map (Census 2020) + idempotent seeder establishing the Virginia state node and linking 33 towns to their parent county; four surgical frontend edits make VA selectable with county/city/town navigation (VALOAD-03, VALINK-01).
- **EV Micro-Donation Transparency (Phase 81.5 — inserted, out-of-milestone EV financials)** — honest recurring-supporter stat (9 supporters, median $10/mo, reconciled to FY2026 exports, zero PII) + a locked "free for everyone" headline + a soft recurring-donate invite on the EV nonprofit view; deployed (EVMICRO-01/02/03).
- **Enrichment parity (Phase 82)** — 73 standardized, bleed-safe, state-neutral universal `category_enrichment` rows authored inline at $0 via an explicit map + 100% coverage gate (delete-then-insert, NULLS-DISTINCT-safe); corrected a stale shared `miscellaneous`→"Information Technology" universal that was wrong for VA and MA (VAENR-01).
- **Verification + source-chain audit + UAT (Phase 83)** — Alexandria + Fairfax County reconciled to published FY2024 ACFRs within an explained ~±5% basis tolerance (Fairfax function taxonomy ties, Education $2,653.1M); full-cohort source-chain audit clean (618 rows: 0 NULL/fragile/residue after stamping 10 Virginia state-node rows with the DPB source) + enrichment re-confirmed clean; live-app UAT across a city + county + town signed off by Chris (VAVER-01/02).

**Known deferred items at close:** 6 acknowledged (see STATE.md Deferred Items — none are v2.7 blockers): 3 UAT entries (resolved / signed-off), 3 unrelated pre-v2.0 Longview-TX quick-task stubs. **v2.7 follow-ups (documented, not fixed):** 6 localities + 3 towns absent from all published XLSX years (multi-year-overdue audits) + Covington/Alleghany null population — picked up idempotently on a future re-run.

**Archive:** [v2.7-ROADMAP.md](milestones/v2.7-ROADMAP.md) | [v2.7-REQUIREMENTS.md](milestones/v2.7-REQUIREMENTS.md)

---

## v2.6 EV Financial Transparency Refresh (Shipped: 2026-06-22)

**Phases completed:** 4 phases (74–78; Phase 77 iceboxed), 8 plans

**Delivered:** Empowered Vote's own organizational financials brought fully up to date and made donor-facing — income from every platform (GiveButter, Patreon, Benevity) + bank interest + manual entries merged idempotently with no double-counting, the Beneficial State Bank established as authoritative balance/expense truth, a gross→net "cost of fundraising" story, an honest neutral expense breakdown, funds-on-hand + burn pace, and a fundraising-goal scaffold — every figure sourced and reconciled to the bank within an explained tolerance, signed off by Chris in the live app. The actual "where the money goes" graphic (EVVIZ-01) was deliberately iceboxed. $0 spend (CSV merge, no new AI runs).

**Key accomplishments:**

- **Donation source refresh (Phase 74)** — FY2026 income refreshed from platform exports (GiveButter $703 / Patreon $370 / Benevity $1,475 + $0.51 interest = $2,548.51, up from $1,256.51), merged idempotently and dedup'd (export baseline + webhook delta), aggregate-only with no donor PII; `scripts/loadEVDonations.js` + tests; fixed a Benevity cross-year double-count (EVDATA-01/02/03).
- **Bank truth + reconciliation (Phase 75)** — Beneficial State Bank made authoritative for balance ($1,706.77) and expenses ($1,745.65: AI & Research, Infra & Hosting, Design, Domains, Bank Fees); platform income reconciled against net bank payout deposits with a stored explained variance (−$132.39, never double-counted); manual/off-platform path; platform fees tracked as an income reduction ($125.32, the cost-of-fundraising story); new `treasury.org_financial_summary` table; 24/24 tests (EVDATA-04/05/06).
- **Donor-facing transparency view (Phase 76)** — rendered the reconciled figures on EV's page: gross→net fee sentence + per-source mini-list, honest neutral expense breakdown, a Funds-on-Hand header chip, a burn-pace line (runway intentionally dropped as misleading for an all-volunteer org), and a data-driven goal-progress scaffold; cross-repo `org-financial-summary` API wired into `dataLoader.ts`; Chris live UAT pass (EVVIEW-01/02/03/04).
- **"Where the Money Goes" graphic (Phase 77) — ICEBOXED** — deferred deliberately: EV's ~6 flat expense categories make the existing tree-chart vocabulary near-degenerate, and the Phase 76 view already renders the breakdown by category; revisit in a future milestone (EVVIZ-01 deferred).
- **Reconciliation audit + live-app UAT (Phase 78)** — audited FY2026 figures against production Supabase: bank balance authoritative, platform income reconciles within the explained −$132.39 tolerance, every displayed figure carries a source, and the revenue total ties to the penny ($2,548 donations + $1.17 bank interest = $2,549.17); Chris approved the live-app UAT (EVVER-01/02).

**Known deferred items at close:** 4 acknowledged (see STATE.md Deferred Items — none are v2.6 blockers): Phase 77 / EVVIZ-01 graphic (deliberate icebox); 3 unrelated Longview-TX / city-data quick-task stubs. The fundraising **goal amount** is intentionally left unset (tile hidden; infra + the "Midterms Support" label are committed and ready to switch on).

**Archive:** [v2.6-ROADMAP.md](milestones/v2.6-ROADMAP.md) | [v2.6-REQUIREMENTS.md](milestones/v2.6-REQUIREMENTS.md)

---

## v2.5 Utah Municipal Expansion (Shipped: 2026-06-20)

**Phases completed:** 7 phases (68–73, incl. inserted 71.1), 14 plans, 27 tasks

**Delivered:** 10 Utah cities + their 5 county governments brought onto Treasury Tracker at full California parity — operating + revenue budgets (all-funds FY2014–2025), employee compensation, category enrichment, and city→county linking — every figure durably sourced to the Utah State Auditor's Transparent Utah dataset, verified against published ACFRs and signed off by Chris in the live app. New tooling = one BigQuery loader. ~$0 spend (after a same-day cost incident was caught and fixed).

**Key accomplishments:**

- **Utah BigQuery source + loader (Phase 68)** — established free BQ-sandbox access to the Transparent Utah table `ut-sao-transparency-prod.transaction.transaction`, mapped all 15 entity_name strings, and built `scripts/loadUtahTransparency.js` (mirrors `bulkLoadStateController.js` — same tree shape, RPC, never-overwrite guard; 23 offline unit tests) (UTSRC-01/02).
- **City budgets (Phase 69)** — all 10 cities loaded operating + revenue FY2014–2025 (all-funds `fund1→org1→cat1` tree), Census-2024 per-capita; SLC + Provo reconciled (Provo penny-exact vs the independent baseline) (UCITY-01/02).
- **County budgets + linking (Phase 70)** — 5 county governments (Salt Lake, Utah, Davis, Weber, Washington) loaded op/rev + linked their cities via `county_id`; recovered a phantom-county-row incident with an `--entity-type` fix; 8 cities renamed to display names (dropped "City" except SLC/WVC) (UCO-01/02).
- **City salaries (Phase 71)** — names-free PY→salaries path; 10 cities loaded FY2014–2025 (120 rows), Provo reconciled at −$0.22 rounding delta, PII-exclusion guard test (USAL-01).
- **Cost-fix rollup ETL (Phase 71.1)** — replaced the per-`(entity,FY,type)` live-query pattern (which ran ~21 TiB / ~$132 on 2026-06-19) with one cost-gated `--rollup` GROUP BY scan loading all 15 entities × FY2014–2025 × EX/RV/PY into Supabase for ~$0.29, idempotently (UETL-01).
- **Enrichment parity (Phase 72)** — 3,536 standardized, bleed-safe universal `category_enrichment` rows authored inline at $0 (33 Utah fund concepts + county-gov set); fixed a NULLS-DISTINCT duplicate-insert incident with delete-then-insert (UENR-01).
- **Verification + audit + UAT (Phase 73)** — Provo + **Salt Lake County** (first UT county-gov ACFR cross-read) reconciled within explainable all-funds tolerance; full-cohort source-chain + bleed audit CLEAN (op 180 + rev 180 + salaries 179: 0 NULL/fragile/residue, 0 PII across 179 salary trees, enrichment 4,476 universal / 0 dups / 0 city-name leaks); 22-item live-app UAT across 4 entities, all PASS, Chris signed off (UVER-01/02).

**Known deferred items at close:** 5 acknowledged (see STATE.md Deferred Items — none are v2.5 blockers): Phase 73 UAT-checklist flag (false positive; UAT passed), Phase 71 verification `human_needed` flag (stale; covered by Phase 73 UAT), 3 unrelated Longview-TX quick tasks. **v2.5 follow-ups (Phase 73, documented not fixed):** 4 pre-existing non-P72 `$`-leak universal enrichment rows (bleed cleanup); Salt Lake County FY2025 salaries (fills on next FY2025-complete rollup refresh).

**Archive:** [v2.5-ROADMAP.md](milestones/v2.5-ROADMAP.md) | [v2.5-REQUIREMENTS.md](milestones/v2.5-REQUIREMENTS.md)

---

## v2.4 Southern California Expansion (Shipped: 2026-06-17)

**Phases completed:** 5 phases (63–67)

**Delivered:** The 6 remaining Southern California counties brought onto the tracker via the hardened v2.2/v2.3 pipeline with zero new data-loading tooling — completing California's major-population coverage. ~95 cities loaded + county-linked (operating + revenue FY2003–2024 from SCO ByTheNumbers, per-year population, never-overwrite guard); 8 county governments loaded with their own op/rev budgets (the 6 SoCal counties + Alameda + Sacramento, no longer directory-only); statewide GCC salaries swept for all 95 new cities (FY2009–2024); enrichment brought to parity inline at $0. Every figure carries a durable source row.

**Key accomplishments:**

- **SoCal county cities load + linking (Phase 63)** — Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial counties' cities loaded operating + revenue FY2003–2024, auto-created with per-year SCO populations, linked via `county_id` (US→California→county→city breadcrumb + Cities-in-County panel); cities already loaded from a richer custom source (e.g. San Diego city) preserved by the never-overwrite guard (SOCAL-01..06).
- **SoCal county-government budgets (Phase 64)** — `loadCountyBudget.js` loaded op/rev FY2003–2024 for the 6 SoCal counties plus the 2 previously directory-only counties (Alameda, Sacramento); all 8 county pages now render icicle/summary + per-capita (CGB-01).
- **SoCal salaries sweep (Phase 65)** — CA Government Compensation FY2009–2024 loaded for all 95 new SoCal cities via `loadCASalaries.js`, sample reconciled to the source at $0 delta (SAL-07).
- **SoCal enrichment parity (Phase 66)** — 185 universal bleed-safe `category_enrichment` rows authored inline at $0 (ENR-03); single-city salary department-name long tail re-deferred.
- **Verification + audit + UAT (Phase 67)** — Ventura County reconciled to its published ACFR on a documented all-funds basis; full-cohort source-chain durability audit (5,968 budget rows — 0 fragile URLs, 0 residue); 20-item live-app UAT across 4 entities, all PASS, Chris signed off (VER-05, VER-06).

**Known deferred items at close:** Broader per-entity independent ACFR cross-read for the SoCal sample (only Ventura fully reconciled; several ACFR PDFs were blocked/non-extractable) — VER-05 follow-up. Plus the carried v2.3 follow-ups FUP-01..03 (Glendale/Burbank ACFR, Employees-card year-gating UX, single-city salary department-name canonicalization long tail).

**Archive:** [v2.4-ROADMAP.md](milestones/v2.4-ROADMAP.md) | [v2.4-REQUIREMENTS.md](milestones/v2.4-REQUIREMENTS.md)

---

## v2.3 California Coverage Parity (Shipped: 2026-06-17)

**Phases completed:** 5 phases (58–62), 15 plans, 41 tasks

**Delivered:** Every already-loaded non-OC California city and county brought up to the Orange County standard — FY2003 budget-history depth, statewide salaries (2009–2024), and standardized enrichment — by re-running the hardened v2.2 SoCal pipeline with no new tooling. The 12 named custom-source cities (LA, SF, etc.) kept their richer custom budgets untouched via a never-overwrite guard. Every backfilled figure carries a durable ByTheNumbers source row; reconciled against published ACFRs and signed off by Chris in the live app.

**Key accomplishments:**

- **LA County parity backfill (Phase 58)** — operating + revenue back to FY2003 for the 88 LA County cities (86/88 reach FY2003; 2 SCO source gaps) + the LA County government entity (44 op/rev rows FY2003–2024), all SCO-sourced with per-year population; 3 custom cities untouched; basis note renders for Long Beach + West Hollywood only.
- **Remaining CA cities history + linking (Phase 59)** — layered SCO all-governmental-funds FY2003 history beneath 7 thin custom-source cities (custom rows preserved), created the 4 missing linking-only county nodes, linked the 5 county-bound cities, kept San Francisco as a clean single combined city-county node, and removed the budget-less Test artifact.
- **Statewide CA salaries sweep (Phase 60)** — CA Government Compensation salaries FY2009–2024 loaded for all 98 non-OC CA cities in 16 download-once passes (0 gaps, 0 failures, 2.5M source records), Los Angeles's curated payroll preserved by the guard; 3 sampled cities reconcile to the official GCC export at $0 delta.
- **Enrichment parity (Phase 61)** — 528 universal `category_enrichment` rows authored inline at $0 (op/rev 100% coverage, salary departments shared by ≥2 cities), bleed-safe; the 5,226 single-city salary department-name long tail deferred to v2.4.
- **Verification + audit + UAT (Phase 62)** — ACFR reconciliation for 5 sample entities (3 fully reconciled with explained basis residuals; Glendale + Burbank documented as CDN-access follow-ups); full-cohort source-chain audit PASS (SCO-NULL `source_url`=0, 0 fragile URLs, 0 residue across 25,568 rows); 24-item live-app UAT across 4 CA entities — all PASS, Chris signed off (signoff-all-pass).

**Milestone audit:** No separate `/gsd:audit-milestone` run — Phase 62 was a dedicated end-to-end verification phase that satisfied VER-03 + VER-04 (4/4 success criteria, see `62-VERIFICATION.md`), covering ACFR reconciliation, source-chain durability, and live-app UAT sign-off.

**v2.4 follow-ups (documented, not fixed — verification-only phase, D-08):** Glendale + Burbank ACFR reconciliation via manual browser download (CDN blocks CLI fetch); the "Employees" salaries-card year-gating UX (card hidden for years outside the salaries range — consider showing whenever salaries exist for any year + prompting a year switch); the 5,226 single-city salary department-name canonicalization long tail.

**Known deferred items at close:** 4 non-blocking items acknowledged (re-deferred) — Phase 62's `62-03-UAT-CHECKLIST.md` flagged only because the file exists (0 pending scenarios; UAT signed off all-pass) + the 3 orphaned pre-v2.0 quick-tasks carried since the v2.0/v2.1 closes (`001-create-treasury-tracker-entries`, `002-add-longview-tx-revenue`, `003-longview-operating-budget` — files missing, unrelated to CA parity). See STATE.md Deferred Items.

**Archive:** [v2.3-ROADMAP.md](milestones/v2.3-ROADMAP.md) | [v2.3-REQUIREMENTS.md](milestones/v2.3-REQUIREMENTS.md)

---

## v2.2 Orange County + Reusable SoCal Pipeline (Shipped: 2026-06-16)

**Phases completed:** 6 phases, 15 plans, 31 tasks

**Delivered:** All 34 Orange County cities loaded onto the tracker (operating + revenue, FY2003–2024) from the CA State Controller's uniform open data, plus the OC county-government's own budget — and the bulk loader hardened into a documented, one-command pipeline any remaining SoCal county can reuse. Net-new: statewide per-city salaries from CA Government Compensation. Every figure carries a durable source row; all verified against published ACFRs with Chris UAT sign-off.

**Key accomplishments:**

- **SoCal bulk pipeline hardened + generalized (Phase 52)** — `bulkLoadStateController.js` loads any CA county with durable `source_url`/`source_date`, persists feed population, and refuses to overwrite cities loaded from another source; `seedCountyLinks.js` seeds + links any county in one command; `docs/socal-county-onboarding.md` documents the full load→seed→link→enrich→verify sequence, proven to generalize via a zero-write Ventura County dry-run.
- **All 34 OC cities loaded (Phase 53)** — operating + revenue FY2003–2024 from ByTheNumbers; 32 net-new cities auto-created with per-year SCO populations (per-capita renders on first load); Anaheim & Santa Ana untouched.
- **OC entity, linking + enrichment (Phase 54)** — Orange County entity seeded, all 34 cities linked via `county_id` (US → California → Orange County → city breadcrumb + Cities-in-County panel), standardized category enrichment authored inline at $0, bleed-safe and consistent with the LA County baseline.
- **Statewide city-salaries integration (Phase 55, net-new)** — reusable `loadCASalaries.js` builds a names-free Department→Position Total Compensation tree from the CA State Controller GCC export; all 34 OC cities loaded 2009–2024 (544 rows, 0 gaps); Irvine 2024 reconciles to the published $190,426,283 at $0 delta.
- **Verification + UAT (Phase 56)** — `verify-phase56.mjs` 7/7 PASS (exit 0); OC totals independently reconciled against published ACFRs on a basis-matched all-funds basis (Laguna Woods to the dollar); a UAT-discovered breadcrumb defect root-caused and fixed in-phase (API + frontend), then Chris signed off all 5 navigation surfaces.
- **OC county-government budget (Phase 57)** — reusable `loadCountyBudget.js` (the runbook's Step 5 tool) loaded OC's operating + revenue FY2003–2024 (44 rows, ~$2.6B–$6.4B/yr) onto the county entity with per-year population and durable `/d/<id>` attribution; FY2024 op total $6.42B exact match; OC county page now renders icicle/summary + per-capita (no longer directory-only); `verify-phase57.mjs` exits 0.

**Milestone audit:** PASSED — 16/16 requirements satisfied (PIPE-01..04, OC-01..05, SAL-01..03, VER-01/02, OCB-01/02), 6/6 phases verified, 0 broken flows, 0 cross-phase gaps. SOCAL-01..06 (6 more SoCal counties) explicitly deferred to a future milestone; the hardened pipeline generalizes to support them. See `milestones/v2.2-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 4 non-blocking items acknowledged (re-deferred) — Phase 57's `57-HUMAN-UAT.md` flagged only because the file exists (status `passed`, 0 pending scenarios; UAT signed off) + the 3 orphaned pre-v2.0 quick-tasks carried from the v2.0/v2.1 closes (missing files). See STATE.md Deferred Items.

**Archive:** [v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) | [v2.2-REQUIREMENTS.md](milestones/v2.2-REQUIREMENTS.md) | [v2.2-MILESTONE-AUDIT.md](milestones/v2.2-MILESTONE-AUDIT.md)

---

## v2.1 Federal History (Shipped: 2026-06-14)

**Phases completed:** 3 phases, 13 plans

**Delivered:** Every available prior federal fiscal year (FY1976→FY2024) brought up to v2.0 detail — function lens, agency lens, and revenue-by-source per year — selectable through the federal YearSelector, with honest comparability context and every figure sourced, at **$0 API spend**.

**Key accomplishments:**

- **Historical federal backfill (Phase 49)** — function (OMB Hist 3.2), agency (Hist 4.1/5.1), and receipts (Hist 2.x) detail loaded for FY1976–FY2024 plus the FY1976 Transition Quarter, every row carrying source_name/url/date and each year recomputing its own visual-vs-official disclosure; loaders parameterized across years (free OMB tables only, no LLM).
- **Federal YearSelector wiring (Phase 50)** — FY1976–FY2025 + the Transition Quarter all selectable; function/agency/revenue trees, landing bands, and the deficit strip switch per period via a centralized `parsePeriod`/`buildPeriodTokens` model; per-year per-capita/per-taxpayer denominators (FRED population + IRS returns) with honest gaps disclosed.
- **Source-chain durability + comparability + UAT (Phase 51)** — repointed every metric source_url off version-specific xlsx / raw-API URLs to durable human pages (audit **FAIL 0**, 0 fragile URLs); authored sourced comparability content (TQ + function drift + 5 Cabinet reorganizations, each verified against its GovInfo public-law record); rendered the notes in-app with source chips; Chris UAT sign-off on prod.

**Milestone audit:** PASSED — 8/8 requirements satisfied (HIST-01..04, NAV-01/02, CTX-01/02), cross-phase integration + E2E flow verified, all phases Nyquist-compliant. See `milestones/v2.1-MILESTONE-AUDIT.md`.

**Known deferred items at close:** 3 orphaned pre-v2.0 quick-tasks (`001-create-treasury-tracker-entries`, `002-add-longview-tx-revenue`, `003-longview-operating-budget`) — files missing, already acknowledged at the v2.0 close; not v2.1 scope. See STATE.md Deferred Items.

---

## v2.0 Federal Treasury Tracker (Shipped: 2026-06-13)

**Phases completed:** 6 phases, 20 plans

**Delivered:** The US Federal Government live at treasurytracker.empowered.vote — FY2025 budget visualized with maximum clarity and context, every figure and text claim sourced to an official record, never editorialized.

**Key accomplishments:**

- **Federal entity + always-sourced schema (Phase 43)** — `entity_type='federal'` end-to-end on the Phase 32 state pattern; `source_name/url/date` columns on budget + enrichment rows; `program_details` table for Tier 2 origins. No regression on city/county/state.
- **All headline federal data, sourced (Phase 44)** — FY2025 actuals both lenses (function: 18→61→1,613 nodes summing exactly to OMB Hist 1.1; agency: 29 departments, identity 0.006% vs MTS T5), OMB 8.1 split (FY2015–25), 64-year history, FY2026 FYTD, debt $39.2T — every row carries source metadata.
- **Federal visualization (Phase 45)** — proportional Mandatory/Discretionary/Net Interest landing bands + permanent receipts-vs-outlays deficit strip, function-default/agency-toggle drill, a source chip on every figure, per-capita/per-taxpayer/%-of-total scales with disclosed formulas.
- **Sourced explainer pipeline v2 (Phase 46)** — 27 Tier-1 explainers authored from fetched authoritative text only, citations stored + displayed, at **$0 API cost**; DoD failed-audit opacity flagged with GAO's verbatim disclaimer.
- **Program origins pilot (Phase 47)** — 15 major programs show enabling bill / public law / sponsor / year / cosponsors structured from Congress.gov + GovInfo, every claim linked, **zero LLM** (deterministic fetch); foundational pre-1973 programs show an honest sponsor-boundary note.
- **Source-chain verification + UAT (Phase 48)** — automated audit of 225 claim rows / 61 unique URLs → **61/61 PASS, zero residue** (govinfo via API, congress.gov via real-browser content match); Chris UAT sign-off "Looks amazing!"; US tracker pinned first on the landing grid with an American-flag tile.

**Known deferred items at close:** 5 stale/orphaned artifacts acknowledged and deferred (3 unrelated "longview" quick-tasks with missing files; 2 empty uat/verification-gap entries matching the pre-existing Phase 07/14/22/25 `human_needed` tech debt). None are v2.0 blockers — all 6 phases have complete VERIFICATION files. See STATE.md Deferred Items.

---

## v1.9 MA County-City Linking (Shipped: 2026-06-11)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Seeded 5 active MA county entities (Barnstable, Bristol, Dukes, Norfolk, Plymouth) with Census 2024 population, linked all MA cities in those counties via county_id FK, loaded each county's operating budget from individual PDFs, and enriched all 68 county budget categories (municipality_id-scoped). County breadcrumbs and CitiesInCountyPanel activated with zero frontend changes. UAT 27/27 passed.

**Phases completed:** 40–42 (3 phases, 4 plans)

**Archive:** [v1.9-REQUIREMENTS.md](milestones/v1.9-REQUIREMENTS.md)

---

## v1.8 Massachusetts All-Cities Financial Transparency (Shipped: 2026-06-10)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Loaded real budget data for all 351 Massachusetts municipalities from the MA DLS reporting portal (special-revenue + revenue-by-source report types, FY2021–FY2025), making MA the first fully-covered state. Loaded MA populations (Census 2024), upgraded MA state government from hardcoded estimates to real DLS data, and applied universal enrichment for the 14 shared DLS category names. GF Expenditures report type deferred (re-add path in 37-01-SUMMARY.md).

**Phases completed:** 37–39 (3 phases, 8 plans)

---

## v1.7 California State Budget + Deep Icicles (Shipped: 2026-06-09)

*Entry backfilled 2026-06-12 at v2.0 rollover.*

**Delivered:** Introduced `entity_type: 'state'` infrastructure, loaded the California state budget, built 3-level tree support in ev-accounts-api, shipped the CA state 3-level icicle pilot, and selectively retrofitted deep icicles to qualifying cities.

**Phases completed:** 32–36 (5 phases, 15 plans)

---

## v1.6 California City Expansion (Shipped: 2026-06-06)

**Delivered:** Added 9 new California cities — Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana — with operating + revenue budgets, enrichment, and per-capita display. Closed two v1.5 carry-forwards (Longview TX revenue enrichment, STATE_LABELS full names).

**Phases completed:** 26–31 (6 phases, 20 plans)

**Key accomplishments:**

- Sacramento loaded via existing loadSacramentoCSV.js pipeline — FY2013–FY2026 operating + revenue (14 FYs each), 536K population, 20 enrichment rows; Phase 26 fastest in milestone
- Longview TX revenue enrichment completed (2 corrupted category names fixed, 36 rows added); STATE_LABELS full names verified in live app — carry-forwards closed in under 1 day
- Oakland (GPF biennial, $807M–$834M/yr, FY2024–2025) and San Jose (General Fund, $1.69B–$1.82B, FY2021–2025) loaded via pdfplumber — 50 enrichment rows, all 6 criteria PASS
- Long Beach ($634M–$773M GF, FY2022–2026, Port excluded) and Bakersfield (GF ~$412-427M; scope corrected from all-funds during verification) loaded; Bakersfield scope fix discovered and applied inline during enrichment phase
- Fresno (GF ~$483M, enterprise funds excluded) and Riverside (biennial, GF ~$1.45B/yr, RPU excluded) loaded — 30 enrichment rows, revenue deferred for both (no extractable GF revenue section in PDFs)
- Anaheim (GF $491M–$530M, utility enterprise filtered) and Santa Ana (GF $404M–$424M) loaded — 51 enrichment rows; all 6 criteria PASS in live app

**Stats:** 6 phases, 20 plans; 3 days (2026-06-04 → 2026-06-06); ~143 commits

**Known deferred at close:**

- Oakland revenue (OpenGov embedded chart format — not extractable via pdfplumber)
- Fresno + Riverside revenue (no extractable GF revenue section in PDFs)
- San Jose FY2016–2020 (older PDF format)

**Archive:** [v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) | [v1.6-REQUIREMENTS.md](milestones/v1.6-REQUIREMENTS.md)

---

## v1.5 Oregon Expansion (Shipped: 2026-06-04)

**Phases completed:** 9 phases, 24 plans, 36 tasks

**Key accomplishments:**

- Portland municipality seeded (id 2abac6c2, pop 635,749), two Adopted Budget PDFs downloaded, pdfplumber confirmed, Appropriation Schedule table structure documented for Plan 02 extractor, and Oregon added to city picker
- pdfplumber Python extractor and Node.js loader pipeline built and dry-run validated against both Portland Adopted Budget Vol 1 PDFs; FY2025 yields 39 bureaus totaling $8.045B and FY2026 yields 34 bureaus totaling $8.483B in full-dollar amounts
- Portland, OR operating budget live-loaded for FY2025 (39 bureaus, $8.045B) and FY2026 (34 bureaus, $8.483B), categories AI-enriched (41 rows scoped to Portland), human-verify checkpoint approved, and 17-VERIFICATION.md filed — Phase 17 ROADMAP goal confirmed met
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- Revenue extraction pipeline for Gresham: extract_revenue() + --mode argparse in extractGresham.py; buildRevenueTree() + parametric dataset_type plumbing in processGresham.js; dry-run validates 4 FYs x 10 revenue categories ($411M-$521M)
- Gresham revenue FY2023–FY2026 live-loaded ($411M/$460M/$521M/$512M), 10 categories enriched, no operating collision, Money In tab human-verified in app
- pdfplumber extractor for Troutdale's General Fund (17 depts, $21.1M) and All Funds revenue (10 cats, $33.7M) with all 8 adopted-budget PDFs downloaded and municipality seeded at population 15749
- processTroutdale.js created and validated — all 8 fiscal years (FY2019-FY2026) parse cleanly in operating and revenue dry-runs; D-02 resolved with full FY include-list for Plan 03
- Troutdale, OR live-loaded FY2019–FY2026 operating ($21.1M) + revenue ($33.7M), population 15749 for per-capita display (~$1,342/person), and 26 enrichment rows — all verified by human in the app.
- extract_requirements() added to extractGresham.py with REQUIREMENTS_CATEGORIES whitelist; processGresham.js --requirements mode loads FY2023-FY2026 all_funds_requirements rows into treasury.budgets via treasury_sync_budget_tree RPC
- table-based extract_requirements() from Vol 1 All Funds page with multi-page continuation and reconciliation fallback, loading Portland all_funds_requirements for FY2022-FY2026 ($5.9B-$8.6B)
- Troutdale all_funds_requirements extracted from All Funds Combined PDF pages and loaded to DB for FY2019-FY2026 (8 years, 7 categories, FY2026 total $81.18M) via section-gate flip of extract_revenue()
- One-liner:
- LA FY2025 revenue corrected from $44.6B to $10.2B by nulling actual_amount_column in seedCaliforniaCities.js LA_REVENUE() and reloading both fiscal years via bulkLoadBudget.js
- LA Operating Budget seeder updated with enterprise-fund exclusion filter and fiscal_years expanded to FY2017-FY2026; all 10 years reloaded with clean approved totals and department-level category trees
- Guarded enrichment.description paragraph added to PlainLanguageSummary, surfacing 2-3 sentence context for the top operating category using zero new AI calls
- Fixed General Fund-only WHERE filter to load all-funds LA budget; FY2025 Money Out tile now shows $19.86B across all 10 fiscal years

---

---

## v1.4 Geographic Expansion (Shipped: 2026-05-22)

**Delivered:** First non-TX cities launched — Los Angeles, San Francisco, and San Diego operating + revenue budgets with per-capita display and enrichment, proving the generic Socrata + CSV pipelines scale to any US city.

**Phases completed:** 15–16 (8 plans total)

**Key accomplishments:**

- Los Angeles added as first non-TX city — operating budget FY2025 ($19.8B) and FY2026 ($21.4B) with 70 enriched categories and per-capita display
- San Francisco operating + revenue loaded (FY2025+FY2026, $15.9B each) via shared Socrata dataset with `where_extra` filter splitting spending/revenue types
- San Diego operating + revenue loaded (FY2025, $4.9B op/$5.5B rev) via new CSV pipeline handling fully double-quoted seshat.datasd.org format
- LA Revenue added ($10.2B FY2025+2026, Socrata `vvm4-a2zu`) — completing LA's financial picture
- `bulkLoadBudget.js` extended with `fiscal_year_type` and `where_extra` column_mapping keys — no breaking changes to existing TX city loads
- Enrichment for all 3 CA cities (SF: 53 rows, SD: 61 rows, LA: 70 rows); per-capita labeled "2024 Census estimate" for all

**Stats:** 2 phases, 8 plans; 1 day to ship (2026-05-22); 41 files changed, 6,003 insertions

**Archive:** [v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) | [v1.4-REQUIREMENTS.md](milestones/v1.4-REQUIREMENTS.md)

---

## v1.3 Revenue Completion & Per-Capita Context (Shipped: 2026-05-22)

**Delivered:** Closed all deferred v1.2 data work — Prosper + Celina revenue, Richardson operating budget, enrichment for 5 Collin County cities, and TX population data with per-capita spending display.

**Phases completed:** 11–14 (9 plans total)

**Key accomplishments:**

- Population schema + TX Census 2024 vintage estimates loaded for all 12 TX cities; per-capita ($/resident) visible in app labeled with source year
- Prosper TX revenue loaded via pdftotext targeting "STATEMENT OF REVENUES" (FY2023–2025, all governmental funds)
- Celina TX revenue loaded (FY2025, validated against $129.6M ACFR total)
- Richardson operating budget loaded (FY2025+FY2026) via 4-format XLSX dispatcher across document generations
- Category enrichment completed for Garland, Wylie, Sachse, Murphy, Princeton

**Stats:** 4 phases, 9 plans; 1 day to ship (2026-05-22)

---

## v1.2 Collin County Completion & Data Quality (Shipped: 2026-05-21)

**Delivered:** Fixed PDF department attribution, loaded revenue data for 4 TX cities, and added 5 new Collin County cities via pdftotext parsers.

**Phases completed:** 8–10 (9 plans total)

**Key accomplishments:**

- PDF pipeline fixed: max_tokens 2048→8192 + cross-page section heading context eliminates "Unknown" department dominance and exit code 2 truncation
- Revenue data loaded for Plano (7 FYs), McKinney (5 FYs), Frisco, and Allen — 412+ revenue rows now visible in app
- 5 new Collin County cities added: Garland ($192.5M), Wylie ($69.6M), Sachse ($31.2M), Murphy ($19.8M), Princeton ($36.9M)
- Confirmed ACFR PDF limitation for revenue extraction — documented pdftotext path for Prosper/Celina
- Princeton MA/TX municipality duplicate resolved; cost discipline maintained (skipped ~$20 API spend for 0.1% marginal improvement)

**Stats:** 3 phases, 9 plans; 18 days (2026-05-03 → 2026-05-21); 13/16 requirements shipped

**Tech debt carried forward:** Prosper/Celina revenue (pdftotext path needed), Richardson operating budget (cor.net HTTP block)

**Archive:** [v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) | [v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md)

---

## v1.1 Texas Municipal Financial Transparency (Shipped: 2026-05-02)

**Delivered:** Citizens can view operating budget and transaction data for Dallas, Plano, McKinney, Frisco, Allen, Prosper, and Celina.

**Phases completed:** 5–7 (9 plans total)

**Key accomplishments:**

- Generic Socrata SODA loader for Dallas operating + revenue budgets (FY2025, FY2026)
- Generic XLSX pipeline for Plano, McKinney, Frisco check registers + McKinney payroll
- Claude Haiku vision PDF pipeline for Allen, Prosper, Celina ACFR budget extraction

---

## v1.0 GiveButter Real-Time Donation Feedback (Shipped: 2026-04-22)

**Delivered:** Donate button on financials.empowered.vote with GiveButter webhook → Supabase → animated live counter on return.

**Phases completed:** 1–4 (9 plans total)

**Key accomplishments:**

- GiveButter webhook → Supabase Edge Function → Postgres RPC atomic donation write
- Animated counter + visibilitychange refetch on donor return
- loadEVFinances.js source-tagging + webhook row deduplication

---

## Pre-GSD History (shipped before planning system)

### SSO Auth Integration

Empowered Vote SSO integration with Alpha landing page. Full read access for Inform/unauthenticated users.

### EV Financials Brand & Logo System

BRAND_BAR_COLORS map, logo tile config, contrast text logic, nonprofit-specific icicle/summary behaviors, annual report download link.

### Enrichment & Municipality Fixes

Category enrichment system, NULL municipality_id fix, Cambridge enrichment.

---

*GSD planning system initialized: 2026-04-21*
*Last updated: 2026-06-06 after v1.6 milestone*
