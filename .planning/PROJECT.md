# Treasury Tracker / Empowered Vote Financials

## What This Is

A public-facing financial transparency platform for governments and nonprofits — cities, counties, states, and now the **US federal government** — deployed at treasurytracker.empowered.vote. It translates raw budget and transaction data into plain-language summaries, visual breakdowns, and searchable spending categories — making public finances accessible to everyday citizens. Federal data adds an always-sourced standard: every figure and explainer carries a link to its official record, and program-origin facts come structured from Congress.gov/GovInfo with zero model-memory claims.

## Core Value

Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## Current Milestone: v2.18 Pima County Municipalities — TT Budget Parity

**Goal:** Bring Oro Valley, Marana, Sahuarita, and South Tucson onto Treasury Tracker at city parity — General Fund revenue-by-source + expenditure-by-function from each Town/City ACFR (GAAP), per-capita, enriched, every figure durably sourced — all under the **existing Pima County navigation node** (already live from v2.17), matching the Essentials v22.0 "Tucson & Arizona" deep-seeds for these same municipalities so the cross-product tether resolves both ways.

**Target features:**
- Recon + extractor readiness for all four (durable per-year ACFR URLs, `pdftotext -table` GF-column $0 bookend-tie, locked clean-extract window per city)
- Resolve South Tucson source availability (~5,600 pop) — full City ACFR vs AZ Auditor General AFR; may require a source exception or defer
- Seed each municipality + link to Pima County node; source-safe load of GF operating + revenue per city (never-overwrite, per-capita, Money In auto-enables)
- Bleed-safe 100% category enrichment per city
- Blind re-derivation + source-chain audit + Chris live UAT; Essentials tether confirmed on each new banner

**Started:** 2026-07-16. Reuses the proven v2.17 Tucson playbook (`seedTucsonArizona.js` → `extractTucson.py` → `processTucson.js`, source-safe `treasury_sync_budget_tree`).

**Standing context (carries across milestones):** Free public sources only ($0 / $5 AI gate — Empowered Vote is an unfunded nonprofit); every figure durably sourced (`source_url` + `source_date`); source-safe `treasury_sync_budget_tree` never-overwrite; executed inline (no subagents per token/machine-strain policy); milestone closeout = loader-independent re-derivation → source-chain audit → Chris live UAT.

**Deferred candidates (after v2.18):**
- **PIMA-BUDGET-01** — Pima County's own government budget (upgrade its nav node to a full entity).
- **SRCSTD-01** — sourced-standard backfill to city/state data (brief: `.planning/SRCSTD-01-SCOPING.md`).
- **VOTES-01** — votes/amendments hub.
- **TUC-SAL-01** — Tucson employee compensation (needs a Tucson-specific comp source; deferred from v2.17).

## Current State

**v2.17 Tucson, AZ City Onboarding — SHIPPED 2026-07-11.** The City of Tucson, AZ is onboarded at city parity — General Fund revenue-by-source (Money In) + a 2-level expenditure-by-function tree (Current→5 functions, Capital outlay, Capital projects, Debt service→Principal/Interest/Fiscal agent fees) from its own ACFR (GAAP actuals), FY2015–FY2024, per-capita (pop 554,013), bleed-safe enriched, every figure durably sourced — all beneath a new **Pima County** navigation node under Arizona (US→Arizona→Pima County→Tucson breadcrumb + Cities-in-County panel; Pima's own budget deferred, nav-only). Built on the proven one-off city pipeline (`seedTucsonArizona.js` → `extractTucson.py` → `processTucson.js`, source-safe RPC). Phase 128 recon + extractor (20/20 dry-runs tie $0); Phase 129 loaded 20 `budgets` rows (all tie $0, 0 `data_sources` residue, idempotent) + 15/15 bleed-safe enrichment; Phase 130 verified — a from-scratch, loader-independent re-derivation ties **all 20 FY×mode roll-ups + every category subtotal + every leaf at exactly $0**, source-chain audit clean (20/20 correct-per-FY reachable URLs, 0 residue, no stale labels, Census-pinned population), the v2.16 Essentials tether pre-determined + confirmed **COVERED** on both the Tucson (GEOID 0477000) and Pima County (04019) banners, and **Chris live-app UAT 15/15 all-pass**. Free ACFR PDFs only, $0 AI spend, executed inline. **v2.18 Pima County Municipalities — TT Budget Parity — VERIFIED, ready to ship (Phases 131–133 all complete, 2026-07-17).** Oro Valley, Marana, Sahuarita, South Tucson onboarded at TT parity under the existing Pima County node (matching the Essentials v22.0 deep-seeds): 44 `budgets` rows (22 city-FYs × operating/revenue) from each town's own ACFR (GAAP actuals) — Oro Valley/Marana/Sahuarita FY2019–2024, South Tucson FY2019–2022 — Census-pinned populations (48,855 / 62,380 / 37,448 / 4,535), bleed-safe enriched, every figure durably sourced. Phase 131 recon + generalized ACFR extractor; Phase 132 seed+load+enrich (44/44 tie $0, 100% enrichment); Phase 133 verified — a from-scratch loader-independent re-derivation ties **all 44 FY×mode roll-ups + every category + every leaf at exactly $0**, source-chain audit clean (a–e PASS, 0 residue, no stale labels), loader source-safety invariants confirmed + idempotent smoke-run clean, the v2.16 Essentials tether pre-determined + confirmed **COVERED** on all four banners (GEOIDs 0451600 / 0444270 / 0462140 / 0468850), and **Chris live-app UAT 34/34 all-pass**. PIMA-07/08/09 all complete. Free ACFR PDFs only, $0 AI spend, executed via wave-based subagents. Code review flagged 2 Critical + 1 Warning latent-robustness findings in the verification *harnesses* (not the data; conclusions independently corroborated by the human UAT) — logged in `133-REVIEW.md`. **Next: `/gsd-complete-milestone` to archive v2.18, then next candidates VOTES-01 / SRCSTD-01.**

<details>
<summary>Previous: v2.16 Tethered Icons & Smart Banner — SHIPPED 2026-07-08</summary>

**v2.16 Tethered Icons & Smart Banner — SHIPPED 2026-07-08.** TT's hero banner now carries a context-sensitive, cross-product "tethered feature-icon" row — the reciprocal of Essentials' Phase 187. The banner's current entity (city/county/state/federal) deep-links into Essentials via a bottom-right navy chip with an accessible `@floating-ui` tooltip, rendered **only when a real per-location Essentials link exists** (icon-iff-covered). Phase 125 built the live coverage contract (`essentialsCoverage.ts` — fetch-once/cache/never-throw loader + tier-aligned, state-scoped matcher against Essentials' published `coverage.json`, CORS `*`); Phase 126 built the visible gate (`featureIcons.ts` pure product registry `[essentials, compass, readrank]` — essentials live, Compass/Read&Rank reserved non-rendering — + `buildEssentialsHref` URL/URLSearchParams-only with a same-origin guard, + `FeatureIconRow.tsx`); Phase 127 proved it context-sensitive end-to-end and passed Chris's live-app UAT. The **federal "United States" entity SHOWS the icon** (a headline reversal of the original "no federal target"), linking to Essentials' new national-officials browse route. Uncovered cities (e.g. Fresno CA) and covered-but-geoid-less places (Bloomington IN) correctly show no icon. Verified: fixture-backed vitest (22/22) + a live-catalog headless matrix (7/7, real resolver × live `coverage.json` × real DB entities) + an offline-safe live-fetch smoke script (`npm run smoke:essentials`) + Chris's VER-01 sign-off — 0 defects. Frontend-only, free, $0 AI spend, executed inline. **No active milestone — next candidates: VOTES-01 (votes/amendments hub); SRCSTD-01 (sourced-standard backfill to city/state data). Run `/gsd-new-milestone`.**

</details>

<details>
<summary>Previous: v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement — SHIPPED 2026-07-06</summary>

**v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement — SHIPPED 2026-07-06.** The State-ACFR arc is complete: **all 50 states now carry State-ACFR GAAP General-Fund data** (revenue-by-source + finer spending-by-function). The last 21 NASBO states (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/OK/RI/SD/VT/WV/WY) were upgraded NASBO→ACFR across four parallel load batches (Phases 118–121), every loaded state-FY tying $0 to its printed GF total — including scanned/raster-image years (NM FY2022, OK FY2019, SD) hand-transcribed via independent OCR. Existing ACFR nodes deepened (Phase 122: **CA +6→FY2002** at the GASB-34 boundary, **FL +18→FY2003–2020**; NY/TX floors reconfirmed; FL FY2000–02 repair-pending). **NASBO retired to fallback-only** (Phase 123, guarded via `isAcfrOccupied`) — no live node shows NASBO where ACFR exists; only two honest NASBO fallback rows remain (NV FY2024, KY FY2023 — genuine ACFR gaps). Verified end-to-end (Phase 124): **149/151 loader-independent blind re-derivations at exact $0** (2 explained rounding), a **14/14-invariant 50-node / 1,560-row cohort audit** (50/50-ACFR, NASBORT-01, LOAD-01 clean, 0 residue no manual re-clean), and **Chris live-app UAT 12/12 all-pass**. Also shipped this cycle (outside the milestone): a search-first landing page (removed the "Available communities" browse grid) and hero banners re-sourced from the shared org asset bucket. Free ACFR PDFs only, $0 AI spend, executed inline. **No active milestone — next candidates: VOTES-01 (votes/amendments hub); SRCSTD-01 (sourced-standard backfill to city/state data). Run `/gsd-new-milestone`.**

</details>

<details>
<summary>Previous: v2.15 recon snapshot (Phase 117, 2026-07-04)</summary>

**v2.15 Phase 117 (Recon) complete 2026-07-04** — all 21 remaining NASBO states (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/OK/RI/SD/VT/WV/WY) reconned: every state passed D-03 triage as RECON-verdict with its ACFR GF statement located, durable per-year URLs pinned, clean `pdftotext -table` window established, and bookend years tied at exact $0 — **zero STAY-NASBO exceptions, so all 50 states land on ACFR and the Phase 123 NASBO-served list is empty**. DEEP-05 deepening located + bookend-tied deeper URLs (CA back to FY2002/GASB-34 boundary +6yr, FL +18yr FY2003–2020, NY/TX floors reconfirmed). Roster locked; AK flagged with 2 orphaned `data_sources` rows for a WR-05-class cleanup at Ph118; VT/WY need `UNITS=1`, DE a `Referer` header, ID mixed units, NH a Wayback/browser fetch — all noted pre-load. Verified 7/7. Zero DB writes, $0 spend, docs-only. Consolidated handoff in `117-RECON.md`.

</details>

<details>
<summary>Previous: v2.14 State ACFR Long Tail — Tranche 3 + Deepening (shipped 2026-07-03)</summary>

**v2.14 State ACFR Long Tail — Tranche 3 + Deepening — SHIPPED 2026-07-03.** Three moves landed. **(1) WR-05 loader debt retired** — all 35 `process*Acfr.js` state loaders now clean up their own `data_sources` rows (ephemeral lifecycle), so a full run incl. an idempotent re-run leaves **0 residue with no manual re-clean** — closing the residue class that required hand-deletion at every prior close (106: 10, 110: 20 rows). **(2) Cohort grew 19 → 29 ACFR states** — Batch 1 (**IN/AZ/OR/MO/CO**, ACFR-21..25) + Batch 2 (**SC/KY/UT/AL/LA**, ACFR-26..30) upgraded NASBO→full ACFR GAAP GF revenue-by-source + finer spending-by-function, most back to FY2002 (24yr), every year tying its printed GF total; GF-alone scope decisions resolved honestly (UT ~0.83×, AL ~0.24×, LA ~1.90×); CO TABOR P2 clamps live. **(3) History holes recovered** — new `pre34Extract.mjs` pre-GASB-34 extractor deepened **CT to 38yr contiguous (FY1988–2025, FY2006 via free OCR)**, WI to 26yr, NJ contiguous FY2002–2025, MA 2/6 holes recovered + 4 documented unrecoverable — all with honest pre-GASB-34 basis labels. Cohort now **29 ACFR + 21 NASBO = 901 rows, 0 anomalies**. Verified end-to-end: **75/75 loader-independent blind re-derivations at exact $0**, 12-invariant cohort audit, **LOAD-01 proven end-to-end (0 manual re-clean — a series first)**, and **Chris live-app UAT 11/11 all-pass**. Milestone audit PASSED 20/20. Free ACFR PDFs only, $0 AI spend, executed inline. **No active milestone — next candidates: ACFRX-03 (final ~21 NASBO states → ACFR); VOTES-01; SRCSTD-01.** Run `/gsd-new-milestone`.

</details>

<details>
<summary>Previous: v2.14 recon snapshot (Phase 112, 2026-07-02)</summary>

**v2.14 Phase 112 recon complete (2026-07-02).** Tranche-3 roster LOCKED from the NASBO 2025 SER re-ranking (0 transcription drift): Batch 1 = IN, AZ, OR, MO, CO; Batch 2 = SC, KY, UT, AL, LA. One D-01 substitution: Oklahoma out (rank 14/31) → Alabama in (rank 9). All 11 reconned states bookend-tie-confirmed at exact $0 diffs; overlaps resolved on paper (UT state node clean NASBO-only, 19 existing ACFR nodes undisturbed), zero DB writes, $0 spend. Verification 16/16.

</details>

<details>
<summary>Previous: v2.13 State ACFR Long Tail — Tranche 2 (shipped 2026-07-02)</summary>

**Shipped v2.13 State ACFR Long Tail — Tranche 2 (2026-07-02).** Doubled the State-ACFR cohort: the next **10 largest-General-Fund NASBO states — NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI —** brought onto full **State-ACFR GAAP** GF revenue-by-source + finer spending-by-function, each as deep as durable ACFR URLs allow (TN 17yr, CT 23yr, WI 24yr back to FY2002; NJ dollars-unit trap and MI Sep-30 FY-end handled per recon). Recon locked all 10 candidates with **0 substitutions**; MA upgraded **in place** over its v1.8 DLS node (no duplicate); GA's v2.10 F-97-01 Medicaid fix superseded cleanly by ACFR actuals. NASBO operating replaced idempotently; 6 live P2 clamps (plus MD FY2022's −$275,992K); scope divergence 1.14×–3.56× accepted + relabelled honestly. Cohort now **19 ACFR states (444 rows) + 31 NASBO = 506 state rows, 0 anomalies**. Phase 110 verified end-to-end: **49/49 loader-independent blind re-derivation checks at exact $0 delta**, 50-state cohort source-chain audit **10/10 invariants**, and **Chris live-app UAT 11/11 all-pass** (plus a 7/7 Phase-108 closure UAT incl. a live idempotency re-run). Free ACFR PDFs only, $0 spend, executed inline. The remaining ~31 NASBO states are ACFRX-02 (future tranche).

</details>

<details>
<summary>Previous: v2.12 State ACFR Long Tail (shipped 2026-07-01)</summary>

**Shipped v2.12 State ACFR Long Tail (2026-07-01).** Extended the proven State-ACFR GAAP upgrade in two directions. **Deepened** the four v2.11 pilots' history — **CA** FY2008–2025 (+12 yrs), **NY** FY2003–2024 (+12 yrs, ×millions), **FL** +FY2021 (TX already contiguous) — every added FY tying exactly to its ACFR GF column total. **Added Pennsylvania (FY2016–2025) + Illinois (FY2021–2025)** — the two largest remaining NASBO states — onto full ACFR GF **revenue-by-source** + finer **spending-by-function** via four new loaders (`processPA/IL{,Revenue}Acfr.js`), NASBO operating replaced in place idempotently, scope divergence accepted + relabelled honestly (PA ~2.0×, IL ~1.5× NASBO GF), P2 clamp on IL FY2022 / FL FY2021, "Money In" auto-enabled on both nodes. Phase 106 verified end-to-end: **24/24 loader-independent blind ACFR re-derivations at exact $0 delta**, a **50-node cohort source-chain audit (7/7 invariants over 276 rows, 41 NASBO states untouched, idempotent, Phase-104 deepening holes recorded + honest)**, and **Chris's live-app UAT sign-off (8/8 anchors)**. A UAT-surfaced data-viz improvement — distinct adjacent-category colors + dropping the redundant single-root "…General Fund Budget · 100%" layer (`hoistSingleRoot`) — shipped to production (Netlify). Free ACFR PDFs only, $0 / no paid AI, executed inline. Next long-tail tranche (more NASBO→ACFR states) is ACFRX-01/02, deferred.

</details>

<details>
<summary>Previous: v2.11 State ACFR Revenue-by-Source Upgrades (shipped 2026-06-30)</summary>

**Shipped v2.11 State ACFR Revenue-by-Source Upgrades (2026-06-30).** Upgraded the four highest-traffic state General Fund nodes — **CA, TX, NY, FL** — from NASBO operating-only estimates to real **State-ACFR GAAP** data: **revenue-by-source** + finer **spending-by-function**, basis-labelled + durably sourced, replacing each state's NASBO operating rows idempotently (un-upgraded states stay on NASBO). Windows as deep as each ACFR cleanly extracts: CA FY2020–25, TX FY2015–24, NY FY2015–24 (×millions scaling), FL FY2022–24. The disabled "Money In" card now renders a real revenue-by-source view on the 4 nodes (auto-enabled by API-served `available_datasets`), and `?dataset=revenue` deep-links validate against availability via a shared `resolveEffectiveDataset` helper (fall back to operating on NASBO-only nodes). Phase 102 verified it end-to-end: **16/16 loader-independent ACFR re-derivation ties (exact, $0 delta)**, a **50-node cohort source-chain audit (7/7 invariants, genuine 0 residue — 145 stale `*-gf-*` data_sources deleted, 46 NASBO states untouched)**, and **Chris's live-app UAT sign-off**. TX's General-Revenue Fund (~3× the NASBO GF) is accepted + relabelled honestly; P2 negative-category clamp fires on CA/NY/FL. Executed inline, free PDFs only, $0 spend. Deeper history (esp. FL's 3-yr window) deferred to a "State ACFR Long Tail" follow-up.

</details>

<details>
<summary>Previous: v2.10 State General Fund Sourcing (shipped 2026-06-29)</summary>

**Shipped v2.10 State General Fund Sourcing (2026-06-29).** Replaced the all-50-states unsourced "best guess" estimate state-node General Fund data with real, sourced actuals on a Chris-locked **hybrid** model: **MN/OH/VA** on State **ACFR GAAP** (operating + revenue), the other **47 states** (46 cohort + Georgia) on **NASBO 2025 SER** General Fund operating actuals (FY2023+FY2024). Every state-node figure is now durably sourced + basis-labelled (GAAP vs budgetary); 375 unsourced estimate rows deleted (revenue-by-source deferred to future per-state ACFR upgrades — nothing unsourced displayed). Reusable loader `scripts/loadStateGF.mjs` + locked cross-cutting policy proven on Georgia FY2023; MN extended FY2008–2025; OH/VA falsely-sourced rows replaced. Phase 97 verified the whole 50-node cohort real+sourced+residue-free, reconciled the "Representative 7" independently from source documents, caught + fixed F-97-01 (GA FY2023 Medicaid stale 2024-SER value → 2025 SER, children now sum to parent), and earned Chris's live UAT sign-off (21/21). Operating-only NASBO nodes render a disabled "Money In" card (no broken revenue view); negative-investment-income years handled honestly. Executed inline, $0 spend.

</details>

<details>
<summary>Previous: v2.9 Minnesota Local Government Expansion (shipped 2026-06-28)</summary>

**Shipped v2.9 Minnesota Local Government Expansion (2026-06-28).** Every Minnesota city + county government brought onto Treasury Tracker at parity from the single uniform MN Office of the State Auditor "City/County Finances Report" raw XLSX (osa.state.mn.us, free, no auth): two-level revenue-by-source + expenditure-by-function trees with real icicle drill-down, per-capita, every figure sourced — **858 cities (20,414 rows) + 87 counties (1,380 rows) + a Minnesota state node + 136 universal enrichment rows.** City→county linking via `ParentEntityName`; GAAP/Cash basis per-entity via `GAAPInd`; bleed-safe enrichment inline at $0. Phase 93 verified: ACFR reconciliation (Hennepin exact, Minneapolis explained), clean full-cohort source-chain audit, independent workbook re-derivation, Chris live UAT all-pass. Also caught + fixed the MN state node's unsourced GF data (→ real ACFR actuals FY2023–2025), which surfaced the cohort-wide problem chartered as v2.10.

</details>

<details>
<summary>Previous: v2.8 Ohio Local Government Expansion (shipped 2026-06-26)</summary>

**Shipped v2.8 Ohio Local Government Expansion (2026-06-26).** Ohio cities + county governments brought onto Treasury Tracker at parity from the single uniform Ohio Auditor of State "Summarized Annual Financial Reports" XLSX (Hinkle System, ohioauditor.gov, free, no auth): **253 cities + 88 counties** loaded operating + revenue across FY2016–2025 (~6,616 budget rows), general-government revenue by source + expenditure by function, per-capita from `OI_Demographics`, every figure sourced. GAAP primary with CASH/MOD fallback (mixed basis per-entity); 253/253 cities linked to their parent county via the source `County` column under a new Ohio state navigation node; 51 state-neutral bleed-safe universal enrichment rows inline at $0. Phase 88 verified: Columbus + Franklin County reconciled, a clean full-cohort source-chain audit, independent workbook re-derivation of 5 entities, and a live-app UAT with Chris's sign-off. One accepted limitation: Ohio's flat AOS source yields no icicle drill-down. $0 spend.

</details>

<details>
<summary>Previous: v2.7 Virginia Local Government Expansion (shipped 2026-06-24)</summary>

**Shipped v2.7 Virginia Local Government Expansion (2026-06-24).** Every reporting Virginia locality — independent cities, counties, and towns (162 entities, 618 budget rows) — brought onto Treasury Tracker at parity from the single uniform APA Comparative Report XLSX (data.virginia.gov, free, no auth): general-government revenue by source + expenditure by function→activity (2-level tree), per-capita, every figure sourced, across FY2023 + FY2024-amended. Independent cities render standalone, counties as their own nodes, towns linked to their parent county under a new Virginia state navigation node; standardized bleed-safe plain-language enrichment for the full VA vocabulary (73 universal rows, inline at $0). Phase 83 verified: Alexandria + Fairfax County reconciled to published FY2024 ACFRs within an explained ~±5% basis tolerance, a clean full-cohort source-chain audit (618 rows, 0 NULL/fragile/residue), and a live-app UAT across a city + county + town with Chris's sign-off. $0 spend (one reusable loader; inline-authored enrichment). The inserted out-of-scope Phase 81.5 also shipped an honest EV recurring-supporter micro-donation callout.

</details>

<details>
<summary>Previous: v2.6 EV Financial Transparency Refresh (shipped 2026-06-22)</summary>

**Shipped v2.6 EV Financial Transparency Refresh (2026-06-22).** Empowered Vote's own organizational financials brought fully up to date and made donor-facing. Income from every platform (GiveButter, Patreon, Benevity) + bank interest + manual entries is merged idempotently with no double-counting; the Beneficial State Bank is the authoritative balance/expense truth ($1,706.77 balance, $1,745.65 FY2026 expenses); platform income reconciles to net bank deposits within a stored, explained variance (−$132.39, never double-counted) and platform fees are tracked as an income reduction ($125.32 — the cost-of-fundraising story). EV's page now renders a gross→net fee sentence + per-source mini-list, an honest neutral expense breakdown, a Funds-on-Hand chip, a burn-pace line (runway intentionally dropped), and a data-driven fundraising-goal scaffold (amount left unset for now). Phase 78 audited every figure against production and Chris signed off the live-app UAT. The actual "where the money goes" graphic (EVVIZ-01 / Phase 77) was deliberately iceboxed. $0 spend (idempotent CSV merge, no new AI runs).

</details>

<details>
<summary>Previous: v2.5 Utah Municipal Expansion (shipped 2026-06-20)</summary>

**Shipped v2.5 Utah Municipal Expansion (2026-06-20).** 10 Utah cities + their 5 county governments brought onto the tracker at full California parity via one new BigQuery loader against the Utah State Auditor's Transparent Utah dataset: all 15 entities loaded operating + revenue (all-funds FY2014–2025, `fund1→org1→cat1` tree), Census-2024 per-capita, city→county linking; employee compensation for the 10 cities (names-free); 3,536 bleed-safe universal enrichment rows inline at $0; every figure durably sourced to `transparent.utah.gov`. Phase 73 verified: Provo + Salt Lake County (first UT county-gov ACFR cross-read) reconciled within explainable all-funds tolerance, a full-cohort source-chain + bleed audit (539 budget/salary rows — 0 NULL/fragile/residue, 0 PII), and a 22-item live-app UAT with Chris's sign-off (all pass). ~$0 total spend (after a same-day BigQuery cost incident was caught and fixed with a single-scan rollup ETL).

</details>

**Coverage now:** US federal + **all 50 state General Fund nodes sourced (29 on full State-ACFR GAAP revenue-by-source + spending-by-function, 21 on NASBO 2025 SER operating; 901 rows, 0 anomalies)**, **253 Ohio cities + 88 Ohio counties** (op/rev FY2016–2025, enrichment, county-linked, under an Ohio state node), **162 Virginia entities** (independent cities + counties + towns, op/rev FY2023–2024, enrichment, county-linked, under a VA state node), 351 MA cities, all California cities across OC + LA + the 6 SoCal counties + their county governments, **10 Utah cities + 5 Utah county governments** (op/rev FY2014–2025, compensation, enrichment, county-linked), 12 named CA cities, 14 TX cities, 3 OR cities — every figure durably sourced.

<details>
<summary>Previous: v2.4 Southern California Expansion (shipped 2026-06-17)</summary>

All 6 remaining SoCal counties added via the hardened v2.2/v2.3 pipeline with zero new data-loading tooling: 95 cities loaded + county-linked (op/rev FY2003–2024), 8 county governments, statewide GCC salaries (FY2009–2024, $0-delta reconciled), 185 universal bleed-safe enrichment rows. Phase 67 verified: Ventura County ACFR reconciliation, source-chain audit (5,968 rows, 0 fragile/residue), 20-item UAT with Chris's sign-off. $0 spend.
</details>

<details>
<summary>Previous: v2.3 California Coverage Parity (shipped 2026-06-17)</summary>

Brought every already-loaded non-OC California city and county to the Orange County standard (FY2003 history, statewide salaries, standardized enrichment) via the hardened v2.2 pipeline. Phase 62 verified end-to-end: ACFR reconciliation, source-chain audit (0 NULL/fragile/residue across 25,568 rows), 24-item UAT with Chris's sign-off. SoCal expansion deferred to v2.4.
</details>

## Milestones — Shipped Scope

_**Active: v2.17 Tucson, AZ City Onboarding** (started 2026-07-10, Phases 128–130). See Current Milestone above + `.planning/REQUIREMENTS.md` / `.planning/ROADMAP.md`. v2.16 shipped 2026-07-08. Deferred candidates: VOTES-01 (votes/amendments hub); SRCSTD-01 (sourced-standard backfill to city/state data)._

<details>
<summary>Shipped v2.16 scope (Phases 125–127) — Tethered Icons & Smart Banner</summary>

**Goal:** Add a context-sensitive, cross-product "tethered feature-icon" row to Treasury Tracker's hero banner — the reciprocal of Essentials' Phase 187 — that deep-links the banner's current entity into other Empowered Vote products, starting with the Essentials yellow magnifying glass (bottom-right), rendered only when Essentials actually covers that location.

**Target features:**
- **Tethered feature-icon row** on TT's hero banner (`App.tsx` hero `div`), bottom-right, as **circular semi-transparent chips**, visually cohesive with Essentials' `SectionBanner` treatment — accessible **hover + keyboard-focus tooltip**, `aria-label`, never obscuring the title, no dead/greyed/placeholder icons.
- **Generic product registry** with a fixed reserved order `[essentials, compass, readrank]` — each product declares a per-location resolver returning a link-or-null. **Only Essentials is wired live** this milestone; Compass and Read & Rank are reserved **non-rendering** slots that plug in with zero layout change once they gain a per-location contract.
- **Live Essentials coverage gate** — fetch Essentials' coverage catalog at runtime and match the current TT entity by **name + state** to obtain its Census GEOID(s); no coverage → no icon. Reciprocal to Essentials calling TT's `/treasury/cities`.
- **Essentials deep-link contract:** city/county → `/results?browse_government_list=<geoid>&browse_state=<abbr>&browse_label=<label>`; state → `/results?browse_state_officials=<abbr>&browse_label=<label>`; federal → no Essentials target today (no icon rendered).
- **Cross-repo prerequisite:** publish the Essentials `coverage.js` catalog (`COVERAGE_STATES` / `COVERAGE_COUNTIES` / `COVERAGE_BROWSE_STATES`, each with GEOID + state + `hasContext`) as a public, fetchable resource (a public endpoint or hosted `coverage.json`) — the reciprocal of TT's `/treasury/cities`.

**Key context (standing):**
- **"Smart Banner" = the context-sensitive tether logic only** — no banner-image changes this milestone (per-image attribution / low-res state-flag fixes stay deferred).
- **Frontend-only on the TT side** — no TT DB/schema changes. TT's banner today is a plain `div` (`App.tsx`), not a `SectionBanner`; the icon row must fit `h-48`, bottom-right, clear of the bottom-left title and the top-right Wikimedia credit.
- **Visual cohesion with Essentials chips:** ~36px circular chip, `rgba(13,17,23,0.55)` bg + `blur(2px)`, ~20px icon, 8px gap, `@floating-ui` tooltip on hover+focus. Icons sourced from `C:\ev-landing\ev-landing-main\icons\` (`essentials-symbol-{light,dark}.svg`, `compass-symbol-*`, `readrank-symbol-*`), copied into TT `public/`.
- **EV constraints:** free only, $5 AI gate (no AI needed here); TT stays light+dark (unlike Essentials' dark-only banner) — pick the icon light/dark variant per active theme.

</details>

<details>
<summary>Shipped v2.15 scope (Phases 117–124) — State-ACFR arc complete (all 50 states on ACFR GAAP; NASBO retired to fallback-only)</summary>

**Goal:** Upgrade the last 21 NASBO states to full State-ACFR GAAP — bringing **all 50 states onto ACFR** — bundle the recorded deepening holes on the existing ACFR nodes, and formally retire NASBO to a fallback-only role.

**Target work:**
- **Upgrade all 21 remaining NASBO states** → State-ACFR GAAP GF revenue-by-source + finer spending-by-function, each as deep as durable ACFR URLs allow: **AK, AR, DE, HI, ID, IA, KS, ME, MS, MT, NE, NV, NH, NM, ND, OK, RI, SD, VT, WV, WY** (OK's recon already done in v2.14 — recon preserved). These are the smallest-GF states; same proven per-state loader template (`extract_gf.py` + `gen_state.py`).
- **Deepening on existing ACFR nodes** — recover the recorded pre-window holes: CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016 (reuse `pre34Extract.mjs` where pre-GASB-34).
- **Retire NASBO to fallback-only** — demote/relabel the `loadStateGF.mjs` NASBO path once all 50 are ACFR; document the 50/50-ACFR end state; existing 29 ACFR nodes untouched.
- **Verification** — loader-independent blind re-derivation → 50-state cohort audit (0 residue, no manual re-clean, proving LOAD-01 holds cohort-wide) → Chris live UAT (Phase 102/106/110/116 mold).

**Key context (standing):** Free ACFR PDFs only ($0 / $5 AI gate); GENERAL FUND column of the Governmental Funds Statement via `pdftotext -table`; every figure durably sourced + basis-labelled (incl. honest pre-GASB-34 labels); P2 negative-category clamp; idempotent never-overwrite (29 existing ACFR nodes untouched); executed inline (no subagents); clone the proven per-state loader template; no frontend work (Money In + `?dataset=revenue` auto-enable). GF-alone scope divergences resolved + relabelled honestly at load time (UT/AL/LA precedent). Flat-revenue-tree no-drill-down stays an accepted limitation (`project_flat_source_icicle_limitation`).

</details>

**Carried-forward follow-ups (candidates for a later milestone or backlog sweep):**
- **v2.14 tech debt (all advisory, none affect correctness — see v2.14-MILESTONE-AUDIT.md):** WR-04..07 loader error-path robustness (`process.exit(2)` inside `try` bypasses `finally` residue cleanup; never manifested — 0 residue everywhere this milestone); AL "Charges"→"Changes" category-label drift (FY2018+, unverified against source PDF, ties unaffected — worth a source spot-check); UT trailing-space category name (cosmetic); NJ phantom-comment referencing a non-existent `isolateNJStatement()` guard (guard logic lives only in the loadlog).
- **v2.13 (Phases 108/110):** ~~WR-05 data_sources residue~~ **FIXED in v2.14 Phase 111 (LOAD-01, proven end-to-end)**; state-node hero banners default to Wikipedia's lead image = low-res state flag (cosmetic; fix paths in 108-UAT.md — `municipalities.hero_image_url` or CITY_WIKI_OVERRIDES); authenticated deep-link redirect UX (v2.12 todo, still open).
- **v2.9 (Phase 93):** MN state-node history FY2021/2022 + deeper deferred into THIS milestone (SGFS-02); MN salaries/enterprise/townships/pre-2015 deferred (MNSAL/MNENT/MNHIST/MNTWN-01).
- **v2.8 (Phase 88):** flat AOS source → no icicle drill-down (deferred UX fix = surface enrichment on leaf click; see auto-memory `project_flat_source_icicle_limitation`); the 10 state-node General Fund rows' `source_url` points at `lsc.ohio.gov/budget/` (canonical, but a TLS cert-chain quirk — swap if it warns in-browser); the county "Charges For Services" duplicate-column display quirk (`total_budget` authoritative); v2 deferred OHTWN-01 (townships/villages/libraries/schools) + OHENT-01 (enterprise funds).
- **v2.7 (Phases 80/83):** 6 localities + 3 towns absent from all published VA XLSX years (multi-year-overdue audits) + Covington/Alleghany null population — picked up idempotently on a future re-run; enterprise funds (Exhibit F) deferred from VA scope.
- **v2.5 (Phase 73):** 4 pre-existing non-P72 `$`-leak universal enrichment rows (bleed-safety cleanup); Salt Lake County FY2025 salaries (fills on next FY2025-complete rollup refresh).
- **v2.4:** broader per-entity independent ACFR cross-read for the SoCal sample (only Ventura fully reconciled; several ACFR PDFs blocked/non-extractable).
- **v2.3 FUP-01..03:** Glendale + Burbank ACFR reconciliation (CDN-blocked CLI fetch), the "Employees" salaries-card year-gating UX, the single-city salary department-name canonicalization long tail (~3,489 names).

## Requirements

### Validated

- ✓ Budget visualization with icicle bars, category breakdowns, and spending percentages
- ✓ Plain-language narrative summaries (current year "is spending", past year "spent", current year with actuals "As of {month}, has spent")
- ✓ Year selector with FY switching
- ✓ Nonprofit vs. municipality display modes
- ✓ EV SSO auth integration with Inform/Alpha landing page
- ✓ Brand color system with logo tiles and contrast text logic
- ✓ Category enrichment with short descriptions
- ✓ Line item vendor descriptions (Read.AI, MindMeister, Figma, etc.)
- ✓ Annual Report PDF download (FY 2025, shown beside year selector)
- ✓ Linked transactions panel
- ✓ Budget search
- ✓ Dallas operating and revenue budget data loaded via Socrata SODA API — v1.1
- ✓ Generic `bulkLoadBudget.js` for any Socrata city's operating/revenue budgets — v1.1
- ✓ XLSX check register importer for Plano, McKinney, Frisco — v1.1
- ✓ PDF → Claude Haiku vision pipeline for ACFR budget extraction — v1.1
- ✓ Allen, Prosper, Celina budget data loaded via PDF pipeline — v1.1
- ✓ PDF pipeline "Unknown" department attribution fixed (max_tokens + cross-page section context) — v1.2
- ✓ Revenue data visible for Plano (FY2018–2024), McKinney (FY2021–2025), Frisco (FY2026), Allen (FY2026) — v1.2
- ✓ Garland, Wylie, Sachse, Murphy, Princeton operating budgets loaded via pdftotext parsers — v1.2
- ✓ Prosper TX revenue data loaded via pdftotext (FY2023, FY2024, FY2025) — v1.3
- ✓ Celina TX revenue data loaded via pdftotext (FY2025) — v1.3
- ✓ Richardson TX operating budget loaded (FY2025, FY2026) via 4-format XLSX dispatcher — v1.3
- ✓ Category enrichment for Garland, Wylie, Sachse, Murphy, Princeton — v1.3
- ✓ Population data loaded for all 12 TX cities (2024 Census vintage); per-capita ($/resident) visible in app — v1.3
- ✓ Los Angeles operating budget (FY2025+2026, $19.8B/$21.4B) with enrichment and per-capita — v1.4
- ✓ San Francisco operating + revenue (FY2025+2026, $15.9B each) with enrichment and per-capita — v1.4
- ✓ San Diego operating + revenue (FY2025, $4.9B op/$5.5B rev) with enrichment and per-capita — v1.4
- ✓ LA revenue budget (FY2025+2026, $10.2B) added — v1.4
- ✓ `bulkLoadBudget.js` extended with `fiscal_year_type` + `where_extra` for integer FY columns and multi-type datasets — v1.4
- ✓ Portland OR operating + revenue (FY2022–FY2026, 635,749 population, 41 enrichment rows) — v1.5
- ✓ Gresham OR operating + revenue (FY2023–FY2026, 111,507 population, 33 enrichment rows) — v1.5
- ✓ Troutdale OR operating + revenue (FY2019–FY2026, 15,749 population, 26 enrichment rows) — v1.5, Phase 22
- ✓ LA County accurate operating + revenue data (FY2021–FY2024) from CA State Controller county datasets — v1.5, Phase 25
- ✓ Self-referential `county_id` FK on municipalities; 88 LA County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages — v1.5, Phase 25
- ✓ Sacramento CA operating + revenue (FY2013–FY2026, 536K population, enriched) — v1.6, Phase 26
- ✓ Longview TX revenue enrichment fixed (2 corrupted names repaired, 36 enrichment rows added) — v1.6, Phase 27
- ✓ City picker STATE_LABELS verified: "California", "Texas", "Oregon" full names confirmed in live app — v1.6, Phase 27
- ✓ Oakland CA operating (FY2024–FY2025, GPF $807M–$834M/yr, 444K population, 26 enrichment rows) — v1.6, Phase 28
- ✓ San Jose CA operating (FY2021–FY2025, GF $1.69B–$1.82B, 997K population, 24 enrichment rows) — v1.6, Phase 28
- ✓ Long Beach CA operating + revenue (FY2022–FY2026, GF $634M–$773M, 451K population, 20 enrichment rows) — v1.6, Phase 29
- ✓ Bakersfield CA operating + revenue (FY2025–FY2026, GF $412M–$427M, 417K population, 25 enrichment rows) — v1.6, Phase 29
- ✓ Fresno CA operating (FY2020–FY2026, GF ~$483M, 550K population, 12 enrichment rows; revenue deferred) — v1.6, Phase 30
- ✓ Riverside CA operating (FY2023–FY2026 biennial, GF ~$1.45B/yr, 324K population, 18 enrichment rows; revenue deferred) — v1.6, Phase 30
- ✓ Anaheim CA operating + revenue (FY2025–FY2026, GF $491M–$530M, 344K population, 25 enrichment rows) — v1.6, Phase 31
- ✓ Santa Ana CA operating + revenue (FY2023–FY2026, GF $404M–$424M, 312K population, 26 enrichment rows) — v1.6, Phase 31
- ✓ 5 MA county operating budgets loaded via PDF extraction: Barnstable $24.75M FY25, Bristol $34.39M FY25, Dukes $2.02M FY24, Norfolk $37.82M FY26, Plymouth $11.87M FY25 — county pages show Money Out tab with per-capita — v1.9, Phase 41
- ✓ Federal entity (`entity_type='federal'`) + always-sourced schema (source_name/url/date columns, program_details table) — v2.0, Phase 43
- ✓ US FY2025 budget loaded both lenses (function 18→61→1,613 nodes = OMB Hist 1.1 exactly; agency 29 depts vs MTS T5), OMB 8.1 split, 64-yr history, FY2026 FYTD, debt $39.2T — every row sourced — v2.0, Phase 44
- ✓ Federal landing: proportional Mandatory/Discretionary/Net-Interest bands + deficit strip; function-default/agency-toggle drill; source chip on every figure; per-capita/per-taxpayer/%-of-total scales — v2.0, Phase 45
- ✓ 27 Tier-1 sourced explainers (fetched-text-only, citations displayed, $0 API); DoD failed-audit opacity flagged with GAO disclaimer — v2.0, Phase 46
- ✓ 15-program origins pilot — enabling bill/public law/sponsor/year/cosponsors from Congress.gov+GovInfo, every claim linked, zero LLM; foundational sponsor-boundary notes — v2.0, Phase 47
- ✓ Source-chain audit (225 rows / 61 URLs, 61/61 PASS) + Chris UAT sign-off; US pinned first on landing with flag tile — v2.0, Phase 48
- ✓ Federal history backfill FY1976–FY2024 — function/agency/revenue per year + per-year visual-vs-official disclosures, every row sourced (free OMB tables, $0) — v2.1, Phase 49
- ✓ Federal YearSelector wiring — FY1976–FY2025 + the FY1976 Transition Quarter selectable; bands/strip/lens trees switch per period — v2.1, Phase 50
- ✓ Source-chain durability (zero residue, audit FAIL 0) + sourced comparability notes (function/agency definition drift + the FY1976 Transition Quarter) rendered in-app with source chips; v2.1 UAT sign-off — v2.1, Phase 51
- ✓ SoCal bulk pipeline hardened + generalized (PIPE-01..04): `bulkLoadStateController.js` county-parameterized for any CA county with durable `source_url`/`source_date`, feed-population backfill, and a never-overwrite guard; `seedCountyLinks.js` one-command county seed + city linking; `docs/socal-county-onboarding.md` runbook (load→seed→link→enrich→verify), proven to generalize via a zero-write Ventura County dry-run — v2.2, Phase 52
- ✓ All 34 Orange County cities loaded (OC-01/02): operating + revenue FY2003–2024 from SCO ByTheNumbers; 32 net-new cities auto-created with per-year SCO populations; Anaheim & Santa Ana kept as-is (link-only) — v2.2, Phase 53
- ✓ Orange County entity + linking + enrichment (OC-03/04/05): OC entity seeded, all 34 cities linked via `county_id` (US→California→Orange County→city breadcrumb + Cities-in-County panel), standardized category enrichment authored inline at $0, bleed-safe and consistent with the LA County baseline — v2.2, Phase 54
- ✓ Statewide CA city-salaries integration (SAL-01/02/03): reusable city-parameterized loader `scripts/loadCASalaries.js` reading the CA State Controller GCC raw export (names-free Dept→Position Total Compensation tree, D-03 wages/benefits split); all 34 OC cities loaded for 2009–2024 (544 rows, 0 gaps); Irvine 2024 reconciles to published figure at $0 delta; conservative department-label normalization (ambiguous codes left as-reported, no fabrication) — v2.2, Phase 55
- ✓ Orange County verification + UAT (VER-01/02): `verify-phase56.mjs` 7/7 PASS; OC totals reconciled against published ACFRs on a basis-matched all-funds basis (Laguna Woods to the dollar); a UAT-discovered breadcrumb defect root-caused + fixed in-phase (API + frontend), then Chris signed off all 5 navigation surfaces — v2.2, Phase 56
- ✓ Orange County's own county-government operating + revenue budget (OCB-01/02): reusable `scripts/loadCountyBudget.js` (the runbook Step 5 tool, parameterized for any CA county) loaded 44 rows (22 op + 22 rev, FY2003–2024) onto the OC county entity from SCO ByTheNumbers county datasets (uctr-c2j8/emxv-k8xv, all-governmental-funds basis), per-year population (3.15M), durable `/d/<id>` source attribution; 34 OC city rows untouched (never-overwrite); FY2024 op total $6.42B exact match; OC county page renders icicle/summary + per-capita (no longer directory-only); county SourceChip live since the EV-Accounts `treasuryService.ts` deploy (2026-06-16) — v2.2, Phase 57
- ✓ FY2003 operating + revenue backfill for the 88 LA County cities (86/88 reach FY2003; Calabasas/Sierra Madre are SCO source gaps) + LA County government, all SCO-sourced with per-year population, never overwriting the custom-source cities (HIST-01, LAC-01) — v2.3, Phase 58
- ✓ Remaining non-OC CA cities backfilled to FY2003 + the 7 unlinked CA cities linked via `county_id` (4 new linking-only county nodes, SF as a clean combined city-county node, Test artifact removed) (HIST-02, ENR-02) — v2.3, Phase 59
- ✓ Statewide CA salary sweep: CA Government Compensation FY2009–2024 loaded for all 98 non-OC CA cities (0 gaps, LA's curated payroll preserved by the guard); 3 sampled cities reconcile to the GCC export at $0 delta (SAL-04/05/06) — v2.3, Phase 60
- ✓ Standardized, bleed-safe enrichment for all parity-loaded categories — 528 universal `category_enrichment` rows authored inline at $0 (op/rev 100%, salary depts shared ≥2 cities); 5,226 single-city salary dept-name long tail deferred to v2.4 (ENR-01) — v2.3, Phase 61
- ✓ Parity verification: basis-matched ACFR reconciliation (3/5 entities fully reconciled, Glendale/Burbank CDN-access follow-ups), full-cohort source-chain audit (0 NULL/fragile/residue across 25,568 rows), 24-item live-app UAT — all PASS, Chris signed off (VER-03, VER-04) — v2.3, Phase 62
- ✓ All 6 remaining SoCal counties' cities loaded + linked (~95 cities, op+rev FY2003–2024, SCO-sourced, per-year pop, never-overwrite): Riverside, San Bernardino, San Diego, Ventura, Santa Barbara, Imperial (SOCAL-01..06) — v2.4, Phase 63
- ✓ County-government budgets for the 6 SoCal counties + Alameda + Sacramento (op+rev FY2003–2024, no longer directory-only) (CGB-01) — v2.4, Phase 64
- ✓ Statewide GCC salaries FY2009–2024 for all 95 new SoCal cities, sample reconciled at $0 delta (SAL-07) — v2.4, Phase 65
- ✓ Standardized, bleed-safe enrichment for all newly-loaded SoCal categories — 185 universal rows authored inline at $0 (ENR-03) — v2.4, Phase 66
- ✓ SoCal verification: Ventura County ACFR reconciliation (all-funds basis), full-cohort source-chain audit (5,968 budget rows, 0 fragile URLs / 0 residue), 20-item live-app UAT — all PASS, Chris signed off (VER-05, VER-06) — v2.4, Phase 67
- ✓ 10 Utah cities + 5 county governments loaded at full CA parity — op/rev (all-funds FY2014–2025) via a new Transparent Utah BigQuery loader, Census-2024 per-capita, city→county linking, names-free compensation, 3,536 bleed-safe enrichment rows; cost-gated single-scan rollup ETL after a BigQuery cost incident (UTSRC/UCITY/UCO/USAL/UENR/UETL) — v2.5, Phases 68–72
- ✓ Utah verification: Provo + Salt Lake County (first UT county-gov) ACFR reconciliation (all-funds basis), full-cohort source-chain + bleed audit (539 rows, 0 NULL/fragile/residue, 0 PII across 179 salary trees), 22-item live-app UAT — all PASS, Chris signed off (UVER-01, UVER-02) — v2.5, Phase 73
- ✓ EV income refreshed idempotently from GiveButter/Patreon/Benevity exports + webhook-delta dedup, aggregate-only/no PII (FY2026 $2,548.51); `loadEVDonations.js` + tests (EVDATA-01/02/03) — v2.6, Phase 74
- ✓ Beneficial State Bank authoritative for balance ($1,706.77) + expenses ($1,745.65); platform income reconciled to net bank deposits with stored explained variance (−$132.39, no double-count); manual/off-platform path; platform fees tracked as income reduction ($125.32); `org_financial_summary` table; 24/24 tests (EVDATA-04/05/06) — v2.6, Phase 75
- ✓ Donor-facing transparency view: gross→net fee sentence + per-source mini-list, honest neutral expense breakdown, Funds-on-Hand chip, burn-pace line (runway dropped), data-driven goal-progress scaffold; cross-repo org-financial-summary API wired; Chris live UAT pass (EVVIEW-01/02/03/04) — v2.6, Phase 76
- ✓ Reconciliation audit + live-app UAT: FY2026 figures reconcile to the bank within the explained −$132.39 tolerance, every figure sourced, revenue ties to the penny ($2,548 + $1.17 interest); Chris signed off the live app (EVVER-01/02) — v2.6, Phase 78
- 🧊 EV "where the money goes" graphic (EVVIZ-01) — deliberately iceboxed v2.6 (flat 6-category data → dedicated tree-chart low-value; transparency view already shows the breakdown); revisit in a future milestone — Phase 77
- ✓ VA APA comparative-report XLSX loader: function→activity expenditure tree (Exhibit C/C1–C8) + revenue-by-source (Exhibit B/B2) + Exhibit H population, every figure sourced to data.virginia.gov; 7/7 tests (VASRC-01/02) — v2.7, Phase 79
- ✓ 127/133 VA cities + counties loaded (op/rev FY2023 + FY2024-amended), section-aware + homonym-safe + idempotent; 6 late-filers documented (VALOAD-01/02/04) — v2.7, Phase 80
- ✓ All 37 VA towns loaded + VA data model: standalone independent cities, county nodes, towns linked to parent county under a new Virginia state node; sourced town→county map + idempotent seeder; frontend navigation (VALOAD-03, VALINK-01) — v2.7, Phase 81
- ✓ EV micro-donation transparency callout (inserted, out-of-scope EV financials): honest recurring-supporter stat (9 supporters, median $10/mo, reconciled, zero PII) + locked headline + soft invite (EVMICRO-01/02/03) — v2.7, Phase 81.5
- ✓ 73 standardized, bleed-safe, state-neutral universal VA enrichment rows authored inline at $0 (explicit map + 100% coverage gate, delete-then-insert); corrected the stale shared `miscellaneous`→"Information Technology" universal (VAENR-01) — v2.7, Phase 82
- ✓ VA verification: Alexandria + Fairfax County ACFR reconciliation (~±5% explained basis tolerance), full-cohort source-chain audit (618 rows, 0 NULL/fragile/residue), live-app UAT (city + county + town) with Chris sign-off (VAVER-01/02) — v2.7, Phase 83
- ✓ Ohio AOS Summarized Annual Financial Reports loader + batch driver (column→flat-tree map of `SOREACIFB`/`SORDACIFB`, GAAP→CASH→MOD per-entity fallback, entity-type-aware city+county, per-FY+basis manifests, never-overwrite guard) — sourced to ohioauditor.gov (OHSRC-01/02) — v2.8, Phase 84
- ✓ 253 Ohio cities loaded op/rev FY2016–2025 (~4,880 rows), per-capita, CASH/MOD backfill, committed source-gap residual, idempotent (OHCITY-01/02) — v2.8, Phase 85
- ✓ 88 Ohio counties loaded op/rev FY2016–2025; Ohio state node; 253/253 city→county links via the source County column; breadcrumb + Cities-in-County panel (OHCO-01, OHLINK-01) — v2.8, Phase 86 (incl. county-layout gap-closure)
- ✓ 51 state-neutral bleed-safe universal Ohio enrichment rows inline at $0 (explicit map + 100% coverage gate + delete-then-insert NULLS-DISTINCT-safe) (OHENR-01) — v2.8, Phase 87
- ✓ Ohio verification: Columbus + Franklin County ACFR/`SOA_Gov` recon (stored = loaded tab $0 delta), full-cohort 0-NULL source-chain audit + independent 5-entity re-derivation (0 mismatches), live-app UAT with Chris sign-off (OHVER-01/02) — v2.8, Phase 88
- ✓ MN OSA loader + all 858 MN cities + 87 counties (op/rev FY2015–2024, 2-level trees, per-capita, city→county linking, enrichment); MN state node fixed to real ACFR actuals; ACFR recon + source-chain audit + Chris UAT (MNSRC/MNCITY/MNCO/MNLINK/MNENR/MNVER) — v2.9, Phases 89–93
- ✓ State GF extractor + locked cross-cutting policy (`scripts/loadStateGF.mjs` + `94-01-POLICY.md`), hybrid NASBO-now/ACFR-later, proven on Georgia FY2023 (SGFS-01) — v2.10, Phase 94
- ✓ MN state history extended FY2008–2025; OH + VA falsely-sourced state nodes replaced with real State-ACFR GAAP actuals (op+rev), FY2022 negative-investment P2 applied (SGFS-02/03) — v2.10, Phase 95
- ✓ Remaining 46 states + Georgia loaded on NASBO 2025 SER GF operating actuals (94 state-years, dual-checksum-validated, 0-NULL, correct non-June FY-ends); 375 unsourced rows deleted (SGFS-04) — v2.10, Phase 96
- ✓ Cohort-wide source-chain audit of all 50 state nodes (clean), "Representative 7" reconciled independently from source docs, F-97-01 fixed (GA Medicaid), Chris live UAT sign-off 21/21 (SGFS-05) — v2.10, Phase 97
- ✓ Recon: CA v1.7 overlap resolved (upgrade-in-place, no duplicate node) + all 4 state ACFRs located with `pdftotext -table`-confirmed GF column/units/windows/durable URLs + loader-reuse plan (RECON-01/02/03) — v2.11, Phase 98
- ✓ CA + TX upgraded to ACFR GAAP nodes: CA FY2020–25, TX FY2015–24 GF revenue-by-source + spending-by-function, NASBO operating replaced idempotently, P2 clamp; TX GR-Fund ~3× scale relabelled honestly (ACFR-01/02/05) — v2.11, Phase 99
- ✓ NY + FL upgraded: NY FY2015–24 (×1,000,000 millions scaling), FL FY2022–24; stale-`data_sources` cleanup extended; P2 clamp fired (ACFR-03/04/05) — v2.11, Phase 100
- ✓ "Money In" revenue-by-source view auto-enabled on CA/TX/NY/FL; shared pure `resolveEffectiveDataset` helper hardens `?dataset=revenue` deep-links (validate against availability, fall back to operating on NASBO-only nodes), no regression (REVUX-01/02) — v2.11, Phase 101
- ✓ Verification: 16/16 loader-independent ACFR re-derivation exact ties; 50-node cohort source-chain audit 7/7 (genuine 0 residue, 145 stale `*-gf-*` data_sources deleted, 46 NASBO untouched); Chris live-app UAT sign-off (VER-01/02) — v2.11, Phase 102
- ✓ Pilot-history deepening (CA FY2008–2025 +12yr, NY FY2003–2024 +12yr ×millions, FL +FY2021) + **PA FY2016–2025 & IL FY2021–2025** onto full ACFR GAAP rev+spend; 24/24 blind re-derivation exact + cohort 7/7 + Chris UAT 8/8; in-milestone data-viz fix (distinct colors + `hoistSingleRoot`) deployed (RECON-04/05, DEEP-01, ACFR-06/07/08, VER-03/04) — v2.12, Phases 103–106
- ✓ Recon locked all 10 tranche-2 states (0 substitutions): GF statement + bookend ties + durable per-year URLs + gap logs; MA in-place-upgrade path, GA F-97-01 supersede, NJ dollars-unit + MI Sep-30 FY-end traps caught pre-load (RECON-06/07) — v2.13, Phase 107
- ✓ **NJ, MA (in-place over v1.8 DLS), NC, GA, MD** upgraded NASBO→ACFR GAAP GF revenue-by-source + spending-by-function; MD FY2022 P2 clamp; retroactive verification 4/4 + dedicated UAT 7/7 incl. live idempotency re-run (RECON-08, ACFR-09..13, ACFR-19/20) — v2.13, Phase 108
- ✓ **TN 17yr, CT 23yr, WI 24yr, WA 6yr, MI 7yr** (77 state-FYs) loaded with 6 live P2 clamps; scope divergence 1.14×–3.56× relabelled honestly; shared parser evolved additively (RECON-08, ACFR-14..18, ACFR-19/20) — v2.13, Phase 109
- ✓ Verification: 49/49 loader-independent blind re-derivation checks at exact $0; 50-state cohort audit 10/10 invariants (506 rows, 31 NASBO untouched); Chris live-app UAT 11/11 all-pass (VER-05/06) — v2.13, Phase 110
- ✓ **WR-05 loader debt retired (LOAD-01):** ephemeral `data_sources` lifecycle across all 35 `process*Acfr.js` loaders — full run incl. idempotent re-run leaves 0 residue with no manual re-clean; proven by live NJ re-run + cohort probe (verified 3/3) — v2.14, Phase 111
- ✓ Recon: 31 NASBO states ranked by FY2024 GF (0 drift); tranche-3 roster locked (IN/AZ/OR/MO/CO ∥ SC/KY/UT/AL/LA) with 1 rank-correction sub (OK→AL); all bookend-tied at $0; overlaps resolved on paper, $0 DB writes (RECON-09/10) — v2.14, Phase 112
- ✓ **Batch 1 — IN/AZ/OR/MO/CO** upgraded NASBO→full ACFR GAAP GF rev-by-source + spend-by-function (68 state-years, most FY2002-back); CO TABOR P2 clamps; AZ FY2024 Drive-link caveat (ACFR-21..25, 31/32) — v2.14, Phase 113
- ✓ **Batch 2 — SC/KY/UT/AL/LA** upgraded NASBO→full ACFR GAAP; GF-alone scope decisions resolved honestly (UT ~0.83×, AL ~0.24× dual-budget, LA ~1.90× ~99% federal-passthrough); KY FY2023 honest hole (ACFR-26..30, 31/32) — v2.14, Phase 114
- ✓ **Pre-GASB-34 extractor** (`pre34Extract.mjs`) + history-hole recovery: CT 38yr contiguous (FY1988–2025, FY2006 via free OCR), WI 26yr, NJ contiguous FY2002–2025, MA 2/6 recovered + 4 documented unrecoverable; honest pre-GASB-34 basis labels (DEEP-02/03/04) — v2.14, Phase 115
- ✓ Verification: 75/75 loader-independent blind re-derivation at exact $0; 12-invariant cohort audit (901 rows, 29 ACFR + 21 NASBO); LOAD-01 proven end-to-end (0 manual re-clean); Chris live-app UAT 11/11 all-pass (VER-07/08) — v2.14, Phase 116
- ✓ Essentials coverage contract: `essentialsCoverage.ts` fetch-once/cache/never-throw loader + tier-aligned, state-scoped, loose matcher against Essentials' published `coverage.json` (CORS `*`) + national-officials federal browse route; `data-essentials-coverage` seam; 14-assertion vitest (COV-01/02/03/04) — v2.16, Phase 125
- ✓ Tethered feature-icon row: pure product registry `[essentials, compass, readrank]` (essentials live, Compass/Read&Rank reserved non-rendering) + `buildEssentialsHref` (URL/URLSearchParams-only, same-origin guard, geoid-less→null) + `@floating-ui` navy chip/tooltip bottom-right above the credit, always `-light` symbol both themes (ICON-01/02/03/04, TETH-01/02) — v2.16, Phase 126
- ✓ Context-sensitivity + live UAT: icon-iff-real-link proven end-to-end (covered city/county/state + federal SHOW correct destination; uncovered Fresno CA + geoid-less Bloomington IN show none); 7/7 headless matrix (real resolver × live catalog × real DB entities) + `npm run smoke:essentials` + Chris VER-01 sign-off, 0 defects (TETH-03, VER-01) — v2.16, Phase 127
- ✓ **Tucson, AZ onboarded at city parity** — recon + `extractTucson.py` (`pdftotext -table` GF-column extractor, fail-loud tie gate), 20/20 dry-runs $0 (TUC-01/02) — v2.17, Phase 128
- ✓ Tucson GF loaded FY2015–FY2024 (20 `budgets` rows via source-safe RPC, all tie $0, durably sourced, 0 residue) + Pima County nav node (Census Vintage-2024 pop) + `county_id` link + 15/15 bleed-safe enrichment (TUC-03/04/05/06) — v2.17, Phase 129
- ✓ Verification + live UAT: loader-independent re-derivation ties all 20 FY×mode + every leaf at $0; source-chain audit clean (a–e); Essentials tether confirmed COVERED on Tucson (GEOID 0477000) + Pima County (04019); Chris live-app UAT 15/15 (TUC-07/08/09) — v2.17, Phase 130

### Active — none

_v2.16 shipped 2026-07-08. No active milestone. Next candidates in "Future" below; run `/gsd-new-milestone` to charter the next one._

### Future (deferred milestone candidates)

- [ ] Wire Compass / Read & Rank tether icons once each exposes a per-location deep-link contract (reserved slots ship this milestone)
- [ ] Reciprocal population/stats slot on the TT banner (Essentials Phase 188 analog)
- [ ] Banner-imagery improvements — per-image Wikimedia attribution, fix low-res state-flag banners (deferred out of "Smart Banner" scope)
- [ ] Votes/amendments exploration hub (VOTES-01 — the eventual mission destination)
- [ ] Backfill the always-sourced standard to city/state data (SRCSTD-01 — now proven federally)

### Out of Scope (federal)

- **Paid APIs / data sources** — everything free (ground rule 1)
- **Unsourced LLM text from model memory** — hard ban (ground rule 3)
- **Deep icicles by default** — visualization chosen per data shape (ground rule 4)
- **Anything beyond official public record** — no personal info, no targeting (ground rule 6)
- **USAspending obligations as headline figures** — outlays canonical; obligations drill-down only, explicitly labeled

## Context

- Stack: React + TypeScript frontend, Supabase (Postgres + Edge Functions), Vite, Tailwind, deployed on Render
- EV financial data loaded via `scripts/loadEVFinances.js` from CSV exports
- Donation platforms: GiveButter (primary, lowest fees), Patreon (recurring), Benevity (workplace giving)
- GiveButter supports webhooks and custom return URLs after donation completion
- The webhook fires before the redirect, so DB should be updated by the time user lands back
- Currently covers: 14 TX cities (Dallas, Plano, McKinney, Frisco, Allen, Prosper, Celina, Richardson, Garland, Wylie, Sachse, Murphy, Princeton, Longview) + 12 named CA cities (Los Angeles, San Francisco, San Diego, Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana) + all 34 Orange County cities + all 88 LA County cities (operating + revenue FY2003–2024 where SCO provides it, statewide CA salaries FY2009–2024) + LA County + Orange County (county-government budget FY2003–2024) + 3 OR cities (Portland, Gresham, Troutdale) + 351 MA cities + Massachusetts (state) + the US federal government. As of v2.3, every non-OC CA city/county is at the OC parity standard.
- county_id FK on municipalities; 88 LA County cities + 34 Orange County cities linked; county breadcrumb chip on city pages; CitiesInCountyPanel on county pages
- SoCal county pipeline is one command per county: `bulkLoadStateController.js --county` (operating + revenue, durable source attribution, never-overwrite, feed population) → `seedCountyLinks.js` (entity + linking) → enrich → verify; runbook at `docs/socal-county-onboarding.md`; `loadCASalaries.js` (statewide city salaries) + `loadCountyBudget.js` (county-government budget) reusable for any CA county
- MA: 351 cities with FY2002–2025 General Fund data (24 years), per-capita, universal enrichment (14 categories), real MA state budget
- **Federal:** United States entity (id `0098c405-65e1-426f-8e5f-0fcbe2a900c0`) live with FY2025 actuals (function + agency lenses), 64-yr OMB history, FY2026 FYTD strip, $39.2T debt; 27 sourced explainers + 15 program-origin records; always-sourced standard (source chips, official-record links). Backend in the separate **ev-accounts** repo (Render); data via `scripts/load*Federal*.js` + `loadProgramOrigins.js` using free APIs (Treasury Fiscal Data, OMB, MTS, Congress.gov/GovInfo via `DATA_GOV_API_KEY`)
- Federal data sources bot-wall caveats: congress.gov/bioguide/gao 403 non-browser clients (browser-verify); govinfo SPA returns 200 for any path (verify via api.govinfo.gov); CBO blocks entirely (manual download)

## Constraints

- **Platform**: Supabase Edge Functions for webhook receiver — already in stack
- **Deduplication**: CSV re-imports must not double-count webhook-written transactions
- **Scope**: GiveButter only for real-time; other platforms remain manual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Redirect-driven (not websockets) | Simpler, no always-on subscription needed; webhook fires before redirect completes | ✓ Good |
| Supabase Edge Function as webhook receiver | Already in stack, no new infra | ✓ Good |
| GiveButter-only for v1 | Best webhook support; Patreon/Benevity less suitable | ✓ Good |
| Socrata SODA API for city budgets | Generic loader reusable for any Socrata city; no city-specific code | ✓ Good — proven across Dallas, LA, SF |
| pdftotext over Haiku vision for revenue sections | PDF structure too irregular for vision; pdftotext + regex targeting yields higher accuracy | ✓ Good |
| Path A population schema (add column to municipalities) | Zero frontend changes, one migration; multi-year history deferred to v2 | ✓ Good |
| 2024 Census vintage applied uniformly across all FYs | Single-year population; false trends would mislead for fast-growing cities | — Single vintage only |
| `where_extra` caller supplies leading AND | More flexible (allows OR, parentheses); matches column_mapping per-dataset contract | ✓ Good |
| `fiscal_year_type` defaults to 'string' | Backward-compatible; only 'integer' triggers unquoted WHERE branch | ✓ Good |
| SD FY2026 excluded (empty budget_cycle in source) | Source-driven gap; update fiscal_years when SD publishes FY2026 adopted data | — No code change needed |
| Bristol + Norfolk county budgets larger than ROADMAP estimates | ROADMAP estimated Bristol ~$9-14M and Norfolk ~$14-18M; both include Agricultural Schools — Bristol $34.4M, Norfolk $37.8M | ✓ Accurate data wins |
| Bristol/Dukes extracted via hardcoded values | Bristol PDF is scanned (no text layer); Dukes dot-leaders prevented reliable OCR parsing; hardcoded from verified sources | ✓ Good — accuracy over automation |
| Recon before roadmap for v2.0 | Pulled live samples from every federal source before writing phases — caught CBO/GAO bot-walls and the obligations-vs-outlays trap up front | ✓ Good — zero source surprises mid-build |
| FY2025 actuals as federal headline; FY2026 FYTD as a strip | Complete/final/sourced; partial-year proportions mislead | ✓ Good |
| Function lens default, agency behind toggle | "What it's for" is the citizen question; ~20 clean categories vs 800-row agency tree | ✓ Good |
| MTS/OMB outlays canonical; USAspending obligations drill-only | $3.3T gap; mixing would corrupt headline figures | ✓ Good |
| Explainers + origins authored/fetched, never from model memory | Always-sourced ground rule; inline authorship hit $0 API; origins need no LLM at all (pure structured fetch) | ✓ Good — $0 spend, fully auditable |
| govinfo existence via API, congress.gov via real browser | govinfo SPA 200s any path; congress.gov 403s non-browser clients — status checks alone would give false PASS/FAIL | ✓ Good — audit caught both |
| Never-overwrite guard in the SoCal pipeline | A county load must not clobber cities already loaded from a richer custom source (Anaheim, Santa Ana) | ✓ Good — link-only preserved their custom data |
| County budgets on all-governmental-funds basis (SCO ByTheNumbers) | Uniform, sourced, comparable across counties; document the basis + ACFR variance rather than chase General-Fund-only | ✓ Good — FY2024 OC op $6.42B exact; LA precedent reused |
| Per-year SCO populations for OC cities (not a single hardcoded vintage) | SCO county feed carries per-year estimated_population — more accurate denominators than the LA single-year hardcode | ✓ Good |
| Names-free Dept→Position salaries tree from GCC | Compensation totals only (no individuals) honors the public-record-only safety line; curl w/ browser UA bypasses the Node fetch Cloudflare TLS block | ✓ Good — Irvine 2024 $0 delta, zero new deps |
| Bank = balance/expense truth, platforms = income detail (v2.6) | A platform payout deposited in the bank must not be double-counted on top of the donations that produced it; deposits arrive net of fees | ✓ Good — stored explained variance −$132.39, no double-count |
| Platform fees modeled as income reduction, never an expense (v2.6) | Fees are cost-of-fundraising (gross→net story), not a bank debit; counting them as expense would break bank-authoritative expense truth | ✓ Good — $125.32 surfaced in the fee sentence |
| Burn pace instead of a runway countdown (v2.6) | Runway implies EV "shuts down at $0," false for an all-volunteer org; a countdown misrepresents reality | ✓ Good — honest pace without a misleading deadline |
| $0-staff line kept neutral, not celebrated (v2.6) | All-volunteer is a current stage, not an identity; paying contributors would be mission progress, not overhead | ✓ Good — honest framing, no badge |
| Icebox the "where the money goes" graphic (EVVIZ-01) | EV's ~6 flat expense categories make the tree-chart vocabulary near-degenerate; the transparency view already shows the breakdown | — Deferred to a future milestone |
| Fundraising goal as a manual, committed data file (v2.6) | `data/ev-goal.json` keeps the goal traveling with sourced figures via reconcileEV; live GiveButter pull deferred to EVAUTO | ✓ Good — amount left unset, infra ready |
| One uniform free source for all VA localities (APA Comparative Report XLSX) (v2.7) | data.virginia.gov publishes every locality in one report — no per-locality scraping; cities/counties/towns share the same parser | ✓ Good — 162 entities from one loader |
| VA revenue = local sources only (intergovernmental Exhibit B-1 excluded) (v2.7) | Including state/federal aid would imply a false surplus vs the local-government expenditure total; APA "Total Local Revenue" is the honest comparator | ✓ Good — clean ACFR reconciliation basis |
| Explicit hand-authored enrichment map + 100% coverage gate for VA (v2.7) | VA's vocabulary is fixed/tiny (73 keys) — an explicit map is more accurate than Utah's heuristic router; loader aborts on any unmapped live key (no silent fallback) | ✓ Good — 73/73 covered, bleed-safe |
| Allow one sourced data fix in the VA verification phase (v2.7) | The 10 VA state-node rows had NULL source_url; stamping them with the DPB source (vs Phase 73's strict read-only) reached literal 0-NULL for SC#2 | ✓ Good — Chris-approved, single scoped write |
| State GF source = hybrid NASBO-now / ACFR-later (v2.10) | NASBO SER is the only uniform, all-50, GF-basis, free, multi-year source for breadth now; per-state ACFR upgrades add revenue + richer functions later. MN kept as ACFR gold-standard | ✓ Good — 50 nodes sourced; Census ASSGF disqualified (all-funds) |
| Mixed basis accepted only with a mandatory per-node basis label (v2.10) | NASBO budgetary ≈ ACFR GAAP within ~2% (MN cross-check); a visible per-node basis label makes the mix honest rather than hidden | ✓ Good — 0 rows missing a basis label cohort-wide |
| NASBO nodes are operating-only; cohort revenue-by-source deferred, not faked (v2.10) | NASBO has no per-state revenue-by-source; deleting the unsourced revenue rows (vs fabricating) keeps the ground rule — nothing unsourced displayed | ✓ Good — operating-only nodes show a disabled "Money In" card |
| Negative GF investment-income clamped to 0 with explanatory label (P2, v2.10) | A negative slice can't render in an icicle; clamping to 0 while keeping the signed magnitude in the label + the true parent total is honest | ✓ Good — MN/OH/VA FY2022 handled, parent totals preserved |
| One Chris-approved in-phase fix in v2.10 verification (F-97-01) | GA FY2023 Medicaid was a stale 2024-SER value ($3,398M) stamped to the 2025 SER ($3,390M), so children exceeded parent by $8M; a single-cell corrected to match the stamped source | ✓ Good — children=parent, idempotent |
| Upgrade the 4 state nodes in place (no duplicate entity) (v2.11) | CA had a v1.7 state-budget overlap risk; recon confirmed a single node per state, upgraded in place — avoids a double/conflicting California node | ✓ Good — recon de-risked before any load |
| TX General-Revenue Fund accepted as the GAAP GF-equivalent + relabelled (v2.11) | TX's GR Fund is ~3× the NASBO GF ($161B vs $50B) because it's a broader consolidated operating fund; carving it down would be fabrication — relabel honestly instead | ✓ Good — node total jumps visibly but is correct + sourced |
| Independent re-derivation must not trust the loader (v2.11) | VER-01 requires reconciliation "from the ACFR, not loader self-report"; a separate `pdftotext` harness re-reads each printed total fresh | ✓ Good — 16/16 exact ($0 delta) |
| Delete the full stale `*-gf-*` data_sources family incl. nasbo metadata (D-05, v2.11) | State budgets use text-stamp provenance (`data_source_id=null`); every state `*-gf-*` data_sources row backs 0 rows and is decorative — source chips render from the text stamp, so deleting them is display-safe and gives genuine 0 residue | ✓ Good — 145 deleted, 0-row guarded, Chris-approved mid-run correction |
| Full 10-state roster kept, 0 substitutions (v2.13) | Recon's per-state bookend-tie + risk-fact pass (units, FY-end, URL durability) proved every candidate extractable — no need to burn the ≤2-substitution allowance | ✓ Good — all 10 loaded; recon depth pays for itself |
| Per-state unit/FY-end traps resolved at recon, not load time (v2.13) | NJ prints dollars (only state needing no ×1,000); MI's Sep-30 FY-end needs custom handling; catching these pre-load prevents silent magnitude errors | ✓ Good — 0 magnitude defects across 121+ state-FYs |
| Scope divergence accepted + relabelled up to 3.56× (MI) (v2.13) | Same TX/PA/IL precedent: carving a broader consolidated GF down to NASBO's definition would be fabrication; honest relabel keeps totals correct + sourced | ✓ Good — 5 relabels verified in UAT incl. MI 3.5×, GA 2× |
| Retroactive VERIFICATION.md accepted for Phase 108 (v2.13) | The evidence (LOADLOG DB assertions + Phase 110's independent re-derivation + live UAT) already existed on disk; re-executing the phase would add nothing | ✓ Good — audit gap closed in one day, 18/18; process lesson: run the verifier before phase close |
| Recoverable history holes logged, not chased (v2.13) | MA/CT/NJ/WI older years need OCR or a pre-GASB-34 extractor — out of tranche scope; honest absence beats delaying 10 states for 6 files | ✓ Good — holes documented + encoded in cohort-audit INV-8 |
| Icon rendered only when a real per-location link exists — geoid-less-covered shows no icon (v2.16, D-127-01) | A covered place with no Census GEOID (Bloomington IN) has no valid city deep-link; a broken/coarse link is worse than no icon; no label-only fallback added | ✓ Good — honest gate, distinct from uncovered; UAT-confirmed correct |
| Federal entity SHOWS the Essentials icon (v2.16, headline reversal) | Chris chose to add Essentials' national-officials browse route this milestone, giving "United States" a real target — reverses the original "no federal icon" assumption | ✓ Good — live-verified, the milestone's headline behavior |
| Every tether href via URL/URLSearchParams + same-origin guard on the untrusted catalog target (v2.16, T-126-01) | The coverage catalog is remote data TT doesn't control; string-concatenated hrefs or an unguarded federal target could escape the Essentials origin | ✓ Good — hostile-absolute + protocol-relative both return null, vitest-proven |
| UAT verified headless against live data, not just fixtures (v2.16) | Running the real resolver modules against the live `coverage.json` + real DB entity records proves icon-or-absence + exact hrefs deterministically — stronger than fixtures, catches producer drift | ✓ Good — 7/7 exact; also caught the falsified Plano-uncovered candidate (→ Fresno CA) |

## Shipped

- ✅ **v2.16 Tethered Icons & Smart Banner** — 2026-07-08 — Phases 125-127 (context-sensitive cross-product tether-icon row on the TT hero banner, reciprocal of Essentials' Phase 187: live coverage contract `essentialsCoverage.ts` + pure product registry/gate `featureIcons.ts` + `@floating-ui` chip row, icon-iff-real-link; federal SHOWS the icon (headline reversal); Fresno CA uncovered + Bloomington IN geoid-less correctly show none; verified 22/22 vitest + 7/7 live-catalog headless matrix + `smoke:essentials` + Chris VER-01 sign-off, 0 defects; frontend-only, $0 spend)
- ✅ **v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement** — 2026-07-06 — Phases 117-124 (last 21 NASBO states upgraded to State-ACFR GAAP → all 50 states on ACFR; existing nodes deepened CA→FY2002 / FL→FY2003; NASBO retired to guarded fallback-only; 149/151 blind re-derivation exact $0 + 14/14 cohort invariants over 1,560 rows + Chris UAT 12/12; free PDFs, $0 spend)
- ✅ **v2.14 State ACFR Long Tail — Tranche 3 + Deepening** — 2026-07-03 — Phases 111-116 (WR-05 loader debt retired via LOAD-01; cohort 19→29 ACFR states; pre-GASB-34 extractor recovered CT/WI/NJ/MA history holes; 75/75 blind re-derivation exact $0 + 12-invariant cohort audit + Chris UAT 11/11; milestone audit 20/20; $0 spend)

- ✅ **v2.13 State ACFR Long Tail — Tranche 2** — 2026-07-02 — Phases 107-110 (10 states — NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI — upgraded NASBO→State-ACFR GAAP GF revenue-by-source + spending-by-function, 0 substitutions; MA in-place over v1.8 DLS, GA F-97-01 superseded; cohort 9→19 ACFR states, 506 state rows, 0 anomalies; 49/49 blind re-derivation exact $0 + cohort audit 10/10 + Chris UAT 11/11 (+108-closure 7/7); free PDFs, $0 spend)
- ✅ **v2.12 State ACFR Long Tail** — 2026-07-01 — Phases 103-106 (CA/NY/FL ACFR history deepened +25 state-FYs; PA FY2016–2025 + IL FY2021–2025 onto full ACFR GAAP rev+spend, NASBO replaced idempotently; 24/24 blind re-derivation exact + 50-node cohort audit 7/7 + Chris UAT 8/8; UAT-surfaced data-viz fix deployed; $0 spend)
- ✅ **v2.11 State ACFR Revenue-by-Source Upgrades** — 2026-06-30 — Phases 98-102 (CA/TX/NY/FL upgraded from NASBO operating-only to State-ACFR GAAP revenue-by-source + finer spending-by-function — CA FY2020–25, TX FY2015–24, NY FY2015–24 ×millions, FL FY2022–24 — replacing NASBO idempotently; "Money In" revenue view auto-enabled + `?dataset=revenue` deep-link hardened via shared `resolveEffectiveDataset`; 16/16 independent ACFR re-derivation exact ties + 50-node cohort audit 7/7 with genuine 0 residue (145 stale data_sources deleted) + Chris live UAT sign-off; TX GR-Fund ~3× relabelled honestly, P2 clamp on CA/NY/FL; executed inline, free PDFs, $0 spend; FL/long-tail deepening deferred)
- ✅ **v2.10 State General Fund Sourcing** — 2026-06-29 — Phases 94-97 (all 50 state GF nodes on real sourced actuals: MN/OH/VA State-ACFR GAAP op+rev, the other 47 on NASBO 2025 SER operating; 375 unsourced estimate rows deleted; reusable loader + locked policy proven on Georgia; F-97-01 GA Medicaid fixed; cohort source-chain audit clean + "Representative 7" reconciled from source + Chris UAT 21/21; revenue-by-source deferred to future per-state ACFR upgrades; executed inline, $0 spend)
- ✅ **v2.9 Minnesota Local Government Expansion** — 2026-06-28 — Phases 89-93 (858 MN cities + 87 counties at parity from the MN OSA City/County Finances XLSX: op/rev 2-level trees, per-capita, city→county linking, MN state node + enrichment; ACFR recon + source-chain audit + independent re-derivation + Chris UAT; surfaced the state-node sourcing problem chartered as v2.10; $0 spend)
- ✅ **v2.8 Ohio Local Government Expansion** — 2026-06-26 — Phases 84-88 (253 Ohio cities + 88 counties from the Ohio AOS Summarized Annual Financial Reports XLSX: op/rev FY2016–2025, per-capita, county-linked under an Ohio state node, enrichment; Columbus + Franklin County recon + source-chain audit + Chris UAT; flat-source no-drill-down accepted; $0 spend)
- ✅ **v2.7 Virginia Local Government Expansion** — 2026-06-24 — Phases 79-83 (162 VA entities — independent cities + counties + towns — at parity from the single uniform APA Comparative Report XLSX: op/rev FY2023–2024, function→activity tree, per-capita, VA state node + town→county linking, 73 bleed-safe enrichment rows inline at $0; Alexandria + Fairfax County ACFR reconciliation + full-cohort source-chain audit (618 rows, 0 NULL/fragile/residue) + Chris live UAT; every figure sourced, $0 spend. Inserted out-of-scope Phase 81.5 shipped the EV recurring-supporter micro-donation callout.)
- ✅ **v2.6 EV Financial Transparency Refresh** — 2026-06-22 — Phases 74-78 (Phase 77 iceboxed) — EV's own org financials refreshed idempotently across GiveButter/Patreon/Benevity + bank + manual (no double-count); Beneficial State Bank authoritative for balance ($1,706.77) + expenses ($1,745.65); platform income reconciled to net deposits within explained −$132.39 tolerance; donor-facing transparency view (gross→net fee story, honest expense breakdown, funds-on-hand, burn pace, goal scaffold); Phase 78 audit + Chris live UAT sign-off; "where the money goes" graphic deliberately iceboxed; every figure sourced, $0 spend
- ✅ **v2.5 Utah Municipal Expansion** — 2026-06-20 — Phases 68-73 (10 Utah cities + 5 county governments at full CA parity via one BigQuery loader; op/rev FY2014–2025, names-free compensation, 3,536 enrichment rows, city→county linking; Provo + Salt Lake County ACFR reconciliation + full-cohort audit + 22-item Chris UAT; cost-gated rollup ETL after a BigQuery cost incident; every figure sourced, ~$0 spend)
- ✅ **v2.4 Southern California Expansion** — 2026-06-17 — Phases 63-67 (all 6 remaining SoCal counties: ~95 cities loaded + county-linked op/rev FY2003–2024, 8 county governments loaded incl. Alameda + Sacramento, statewide GCC salaries FY2009–2024 for all new cities, enrichment to parity inline at $0; Ventura ACFR reconciliation + full-cohort source-chain audit (5,968 rows, 0 fragile/0 residue) + 20-item Chris UAT sign-off; every figure durably sourced, $0 spend)
- ✅ **v2.3 California Coverage Parity** — 2026-06-17 — Phases 58-62 (88 LA County cities + LA County gov backfilled to FY2003; remaining non-OC CA cities history + county-linking; statewide CA salaries FY2009–2024 for 98 cities; standardized enrichment; ACFR reconciliation + full-cohort source-chain audit + Chris UAT sign-off; every figure durably sourced, $0 spend)
- ✅ **v2.2 Orange County + Reusable SoCal Pipeline** — 2026-06-16 — Phases 52-57 (hardened one-command SoCal county pipeline + runbook; all 34 OC cities operating + revenue FY2003–2024; OC entity + linking + enrichment; statewide city salaries 2009–2024; ACFR verification + UAT; OC county-government budget FY2003–2024; every figure sourced; milestone audit passed 16/16)
- ✅ **v2.1 Federal History** — 2026-06-14 — Phases 49-51 (FY1976–FY2024 function/agency/revenue per year + per-year disclosures, federal YearSelector incl. the FY1976 Transition Quarter, sourced comparability notes + definition-drift, source-chain durability audit FAIL 0; $0 API spend; milestone audit passed 8/8)
- ✅ **v2.0 Federal Treasury Tracker** — 2026-06-13 — Phases 43-48 (US federal entity, FY2025 both lenses, first-split bands + deficit strip, 27 sourced explainers, 15-program origins pilot, source-chain audit 61/61 + UAT)
- ✅ **v1.9 MA County-City Linking** — 2026-06-11 — Phases 40-42 (14 MA counties seeded, 351 cities linked, 5 county budgets, county enrichment)
- ✅ **v1.8 Massachusetts All-Cities Financial Transparency** — 2026-06-10 — Phases 37-39 (MA DLS loader, 351 MA cities FY2002–2025, MA state budget, per-capita, universal enrichment)
- ✅ **v1.7 California State Budget + Deep Icicles** — 2026-06-09 — Phases 32-36 (CA state entity, CA state budget, 3-level icicle infrastructure, Portland/Dallas retrofit)
- ✅ **v1.6 California City Expansion** — 2026-06-06 — Phases 26-31 (Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana CA; Longview TX revenue; STATE_LABELS)
- ✅ **v1.5 Oregon Expansion** — 2026-06-04 — Phases 17-25 (Portland/Gresham/Troutdale OR, all-funds consistency, LA data quality, LA County + county-city linking)
- ✅ **v1.4 Geographic Expansion** — 2026-05-22 — Phases 15-16 (LA, SF, SD, LA Revenue)
- ✅ **v1.3 Revenue Completion & Per-Capita Context** — 2026-05-22 — Phases 11-14
- ✅ **v1.2 Collin County Completion & Data Quality** — 2026-05-21 — Phases 8-10
- ✅ **v1.1 Texas Municipal Financial Transparency** — 2026-05-02 — Phases 5-7
- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — 2026-04-22 — Phases 1-4

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-17 — v2.18 Pima County Municipalities VERIFIED (Phase 133 complete, last phase of the milestone). Oro Valley, Marana, Sahuarita, South Tucson onboarded at TT parity under the existing Pima County node from each town's own ACFR (GAAP): 44 `budgets` rows (OV/Marana/Sahuarita FY2019–2024, South Tucson FY2019–2022), Census-pinned populations (48,855 / 62,380 / 37,448 / 4,535), bleed-safe enriched, every figure durably sourced. Phase 131 recon + generalized extractor; Phase 132 seed+load+enrich (44/44 $0, 100% enrichment); Phase 133 verified — loader-independent re-derivation ties all 44 FY×mode + every leaf at exactly $0, source-chain audit clean (a–e, 0 residue, no stale labels), loader source-safety invariants confirmed + idempotent smoke-run clean, Essentials tether confirmed COVERED on all four banners (GEOIDs 0451600 / 0444270 / 0462140 / 0468850), Chris live UAT 34/34 all-pass. PIMA-07/08/09 all complete. Code review logged 2 Critical + 1 Warning latent-robustness findings in the verification harnesses (not the data; conclusions independently corroborated by the human UAT) → `133-REVIEW.md`. Free ACFR PDFs only, $0 AI spend, executed via wave-based subagents. Next: `/gsd-complete-milestone` to archive v2.18 (candidates after: VOTES-01, SRCSTD-01).*

*Last updated: 2026-07-11 after v2.17 milestone — v2.17 Tucson, AZ City Onboarding SHIPPED + archived. The City of Tucson, AZ is live at city parity: General Fund revenue-by-source + a 2-level expenditure-by-function tree from its own ACFR (GAAP actuals), FY2015–FY2024, per-capita (pop 554,013), bleed-safe enriched, every figure durably sourced — under a new **Pima County** navigation node beneath Arizona (US→Arizona→Pima County→Tucson + Cities-in-County; Pima's own budget deferred, nav-only). Built on the one-off city pipeline (`seedTucsonArizona.js` → `extractTucson.py` → `processTucson.js`, source-safe RPC). Phase 128 recon + extractor (20/20 dry-runs $0); Phase 129 loaded 20 `budgets` rows (all tie $0, 0 residue, idempotent) + 15/15 bleed-safe enrichment; Phase 130 verified — loader-independent re-derivation ties all 20 FY×mode + every leaf at exactly $0, source-chain audit clean (a–e), Essentials tether confirmed COVERED on Tucson (GEOID 0477000) + Pima County (04019), Chris live UAT 15/15. Free ACFR PDFs only, $0 AI spend, executed inline. No active milestone. Next: `/gsd-new-milestone` (candidates: SRCSTD-01 sourced-standard city/state backfill; VOTES-01 votes/amendments hub; TUC-SAL-01 Tucson salaries). (v2.16 Tethered Icons & Smart Banner SHIPPED + archived 2026-07-08.)*

<details>
<summary>Previous footer — v2.17 STARTED (2026-07-10)</summary>

*Last updated: 2026-07-10 — **v2.17 Tucson, AZ City Onboarding STARTED** (Phases 128–130, continues from 127). Bringing the City of Tucson, AZ onto the tracker at city parity from its own ACFR (GAAP): General Fund revenue-by-source (10 sources) + a 2-level expenditure-by-function tree, as deep as the published ACFRs cleanly extract & tie, under a new **Pima County** navigation node beneath Arizona (US→Arizona→Pima County→Tucson, Cities-in-County panel). Per-capita (~542k pop 2024), "Money In" auto-enabled, bleed-safe enrichment, every figure durably sourced; the v2.16 Essentials tether icon verified on Tucson's banner. FY2024 ACFR layout probe = best-case (`pdftotext -table`, GF rev $773.5M / exp $648.7M both tie $0). Free PDFs only, $0/$5 AI gate, GF basis, source-safe never-overwrite, cloned one-off-city pipeline, executed inline; closeout = independent re-derivation → source-chain audit → Chris live UAT. Scoping + probe in `.planning/TUCSON-SCOPING.md`. Deferred: Pima County's own budget, all-funds view, Tucson salaries, OpenGov adopted-budget layer, other AZ cities. (v2.16 Tethered Icons & Smart Banner SHIPPED + archived 2026-07-08.)*

</details>

<details>
<summary>Previous footer — v2.16 SHIPPED (2026-07-08)</summary>

*Last updated: 2026-07-08 after v2.16 milestone — v2.16 Tethered Icons & Smart Banner SHIPPED + archived. TT's hero banner now carries a context-sensitive cross-product tether-icon row (reciprocal of Essentials' Phase 187): Phase 125 the live coverage contract (`essentialsCoverage.ts`, fetch-once/cache/never-throw + tier-aligned state-scoped matcher against Essentials' `coverage.json` w/ CORS `*` + national-officials federal route), Phase 126 the visible gate (`featureIcons.ts` registry + `buildEssentialsHref` URL/URLSearchParams-only same-origin guard + `@floating-ui` navy chip row), Phase 127 the end-to-end context-sensitivity proof + Chris live UAT. Icon-iff-real-link: covered city/county/state + federal SHOW the correct Essentials destination (federal SHOWING is the headline reversal); uncovered Fresno CA + geoid-less Bloomington IN correctly show none. Verified 22/22 vitest + 7/7 live-catalog headless matrix (real resolver × live catalog × real DB entities) + `npm run smoke:essentials` + Chris VER-01 sign-off, 0 defects. Frontend-only, free, $0 AI spend, executed inline. No active milestone. Next: `/gsd-new-milestone` (candidates: VOTES-01 votes/amendments hub; SRCSTD-01 sourced-standard city/state backfill). (v2.15 SHIPPED + archived 2026-07-06.)*

</details>

<details>
<summary>Previous footer — v2.15 STARTED (2026-07-03)</summary>

*Last updated: 2026-07-03 — v2.15 State ACFR Long Tail — Final Tail + NASBO Retirement STARTED. Finish the long tail: upgrade the last **21 NASBO states** (AK/AR/DE/HI/ID/IA/KS/ME/MS/MT/NE/NV/NH/NM/ND/OK/RI/SD/VT/WV/WY — OK recon preserved from v2.14) to full State-ACFR GAAP GF revenue-by-source + finer spending-by-function → **all 50 states on ACFR**; bundle the recorded deepening holes on existing ACFR nodes (CA pre-FY2020, NY pre-FY2015, FL pre-FY2022, TX FY2016); and formally **retire NASBO to fallback-only**. Free ACFR PDFs only ($0/$5 AI gate), GAAP + basis-labelled (incl. honest pre-GASB-34 labels), P2 clamp, idempotent never-overwrite (29 existing ACFR nodes untouched), executed inline; clone the proven per-state loader template (`extract_gf.py` + `gen_state.py`) + reuse `pre34Extract.mjs`; no frontend work (Money In + `?dataset=revenue` auto-enable). Closeout = independent blind re-derivation → 50-state cohort audit (0 residue, no manual re-clean) → Chris live UAT. Phases continue from 117. (v2.14 SHIPPED + archived 2026-07-03.)*

</details>

<details>
<summary>Previous footer — v2.14 SHIPPED (2026-07-03)</summary>

*Last updated: 2026-07-03 after v2.14 milestone — v2.14 State ACFR Long Tail — Tranche 3 + Deepening SHIPPED + archived. Three moves landed: (1) WR-05 loader debt retired (LOAD-01 — ephemeral data_sources lifecycle across all 35 loaders, 0 residue no manual re-clean, proven end-to-end); (2) cohort grew 19 → 29 ACFR states — Batch 1 (IN/AZ/OR/MO/CO) + Batch 2 (SC/KY/UT/AL/LA) upgraded NASBO→full ACFR GAAP GF revenue-by-source + finer spending-by-function, most back to FY2002, GF-alone scope decisions honest (UT/AL/LA); (3) history holes recovered via a new pre-GASB-34 extractor — CT 38yr contiguous (FY1988–2025, FY2006 OCR), WI 26yr, NJ contiguous FY2002–2025, MA 2/6 recovered + 4 documented unrecoverable. Cohort now 29 ACFR + 21 NASBO = 901 rows, 0 anomalies. Verified: 75/75 loader-independent blind re-derivation exact $0; 12-invariant cohort audit; Chris live UAT 11/11 all-pass; milestone audit PASSED 20/20. Free PDFs only, $0 AI spend, executed inline. No active milestone. Next: `/gsd-new-milestone` (leading candidate: ACFRX-03 — final ~21 NASBO states → ACFR).*

</details>

<details>
<summary>Previous footer — v2.14 STARTED (2026-07-02)</summary>

*Last updated: 2026-07-02 — v2.14 State ACFR Long Tail — Tranche 3 + Deepening STARTED. WR-05 atomic data_sources upsert fix lands first (residue-free loads); then recon locks the next ~10 largest-GF NASBO states (candidates AZ/IN/CO/MO/LA/KY/SC/AL/OR/OK) and upgrades each NASBO→State-ACFR GAAP GF revenue-by-source + finer spending-by-function as deep as durable URLs allow; plus the full v2.13 recoverable-holes deepening pass (MA FY2001/02/04/05/14/21, CT FY2006 OCR, NJ pre-FY2020, CT/WI pre-GASB-34 — new pre-GASB-34 extractor + basis label). Cohort 19 ACFR nodes → ~29. Free PDFs only, $0/$5 AI gate, GAAP + basis-labelled, idempotent never-overwrite, executed inline; closeout = independent blind re-derivation → 50-state cohort audit → Chris live UAT. Phases continue from 111. (v2.13 SHIPPED + archived 2026-07-02.)*

</details>

<details>
<summary>Previous footer — v2.13 SHIPPED (2026-07-02)</summary>

*Last updated: 2026-07-02 after v2.13 milestone — v2.13 State ACFR Long Tail — Tranche 2 SHIPPED + archived. All 10 candidate states (NJ, MA, NC, GA, MD, TN, CT, WI, WA, MI) upgraded NASBO→State-ACFR GAAP GF revenue-by-source + spending-by-function, 0 substitutions; cohort 9 → 19 ACFR states (444 rows) + 31 NASBO = 506 state rows, 0 anomalies. Verified: 49/49 loader-independent blind re-derivation exact $0; cohort audit 10/10 invariants; Chris live UAT 11/11 all-pass (+ Phase-108 closure UAT 7/7 on 2026-07-02, closing the retroactive-verification audit gap — 18/18 requirements). Tech debt carried: WR-05 data_sources residue, recoverable history holes (MA/CT/NJ/WI older years), state-flag hero banners (cosmetic). No active milestone. Next: `/gsd-new-milestone` (leading candidate: ACFRX-02 tranche 3 / deepening pass).*

</details>

<details>
<summary>Previous footer — v2.13 STARTED (2026-07-01)</summary>

*Last updated: 2026-07-01 — v2.13 State ACFR Long Tail — Tranche 2 STARTED. Continue the proven State-ACFR GAAP upgrade: bring the next ~8–10 largest-GF NASBO states (candidate roster NJ/MA/NC/GA/MD/TN/CT/WI/WA/MI — recon locks the exact list) onto full ACFR revenue-by-source + finer spending-by-function, each as deep as durable ACFR URLs allow, replacing NASBO operating idempotently (un-upgraded states stay on NASBO). Cohort 9 ACFR nodes → ~19. No frontend work (Money In + deep-link data-driven → auto-enable once loaded). Free PDFs only, $0/$5 AI gate, GAAP + basis-labelled, idempotent never-overwrite, executed inline; reuse the v2.12 process{PA,IL}*.js loaders as the per-state template. Recon must resolve the MA v1.8 DLS-budget overlap in place (Phase 98 CA-v1.7 precedent). Phases 107 (recon) → 108/109 (load two batches) → 110 (verify+UAT). Closeout = independent ACFR re-derivation → 50-node cohort audit → Chris live UAT. Next: `/gsd-plan-phase 107`. (v2.12 SHIPPED + archived 2026-07-01.)*

</details>

<details>
<summary>Previous footer — v2.12 STARTED (2026-06-30)</summary>

*Last updated: 2026-06-30 — v2.12 State ACFR Long Tail STARTED. Deepen all 4 v2.11 pilot states' ACFR history backward (FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016, as deep as durable URLs allow) + bring Pennsylvania + Illinois (the 2 largest remaining NASBO states) onto full ACFR GAAP revenue-by-source + finer spending-by-function, replacing NASBO operating idempotently. No frontend work (Money In + deep-link are data-driven → PA/IL auto-enable revenue once loaded). Free PDFs only, $0/$5 AI gate, GAAP + basis-labelled, idempotent never-overwrite, executed inline; reuse the v2.11 process{CA,TX,NY,FL}*.js loaders (deepening = add older URLs to SOURCES maps) + new PA/IL loaders on the same pattern. Phases 103 (recon) → 104 (deepen 4) → 105 (PA+IL) → 106 (verify+UAT). Worktree isolation restored. **v2.12 SHIPPED + archived 2026-07-01** — PA FY2016–2025 + IL FY2021–2025 onto full ACFR GAAP + CA/NY/FL history deepened; Phase 106 verified 24/24 independent blind re-derivation (exact $0) + 50-node cohort audit 7/7 + Chris live UAT 8/8; UAT-surfaced UI fix (distinct category colors + dropped redundant single-root layer) deployed to production. Next long-tail tranche = ACFRX-01/02 (deferred). Next: `/gsd:new-milestone`. (v2.11 SHIPPED + archived 2026-06-30, Chris UAT sign-off.)*

</details>

<details>
<summary>Previous footer — v2.11 SHIPPED (2026-06-30)</summary>

*Last updated: 2026-06-30 — v2.11 State ACFR Revenue-by-Source Upgrades SHIPPED + archived (Phases 98-102). The four highest-traffic state GF nodes (CA, TX, NY, FL) upgraded from NASBO operating-only estimates to real State-ACFR GAAP revenue-by-source + finer spending-by-function (CA FY2020–25, TX FY2015–24, NY FY2015–24 ×millions, FL FY2022–24), NASBO operating replaced idempotently, un-upgraded states still on NASBO. "Money In" revenue view auto-enabled on the 4 nodes; `?dataset=revenue` deep-links hardened via a shared resolveEffectiveDataset helper. Verified: 16/16 loader-independent ACFR re-derivation exact ties; 50-node cohort source-chain audit 7/7 with genuine 0 residue (145 stale `*-gf-*` data_sources deleted, 46 NASBO states untouched); Chris live-app UAT sign-off. TX GR-Fund ~3× relabelled honestly; P2 clamp on CA/NY/FL. Executed inline, free PDFs only, $0 spend. Deeper history (esp. FL's 3-yr window) + scaling to the rest of the long tail deferred to a "State ACFR Long Tail" follow-up. Next: `/gsd:new-milestone`. (v2.10 State General Fund Sourcing SHIPPED + archived 2026-06-29.)*

</details>

<details>
<summary>Previous footer — v2.11 STARTED (2026-06-29)</summary>

*Last updated: 2026-06-29 — v2.11 State ACFR Revenue-by-Source Upgrades (Pilot) STARTED. Upgrading the four highest-traffic NASBO state GF nodes (CA, TX, NY, FL) from operating-only to full State-ACFR GAAP nodes: adding revenue-by-source + finer spending-by-function, as deep as each ACFR cleanly extracts, the disabled "Money In" card becoming a real revenue view. Delivers the deferred "ACFR-later" half of the v2.10 hybrid; a follow-up milestone scales to the rest. Reuses the proven processOH/VA/MN-Acfr loaders (rev-by-source + spend-by-function + P2 clamp + 0-NULL source stamp + never-overwrite); NASBO stays the fallback for un-upgraded states. CA's v1.7 CA-state-budget overlap recon'd first. Plus the minor `?dataset=revenue` URL-robustness fix. Free sources only, $0/$5 AI gate, GAAP + basis-labelled, executed inline (no subagents), closeout = independent ACFR re-derivation → cohort source-chain audit → Chris live UAT (Phase 88/93/97 mold). Phases continue from 98. (v2.10 State General Fund Sourcing SHIPPED + archived 2026-06-29, Chris UAT 21/21.)*

</details>

<details>
<summary>Previous footer — v2.9 Minnesota Local Government Expansion STARTED (2026-06-27)</summary>

*Last updated: 2026-06-27 — v2.9 Minnesota Local Government Expansion STARTED. Bringing every Minnesota city + county government onto the tracker at parity from the single uniform MN Office of the State Auditor "City/County Finances Report" raw XLSX (`cired_YY_data.xlsx`, free, no auth): two-level revenue-by-source + expenditure-by-function trees (real icicle drill-down — resolves the Ohio flat-source limitation), per-capita from the built-in Population column, GAAP/Cash basis via GAAPInd, city→county linking from the built-in ParentEntityName column + a new Minnesota state node, standardized bleed-safe enrichment inline at $0; the 5 ranked-choice-voting cities (Minneapolis, St. Paul, St. Louis Park, Bloomington, Minnetonka) are the mission-aligned verification anchors (RCV = selection rationale + anchor, no new UI). Verified via ACFR reconciliation + source-chain audit + independent re-derivation + Chris UAT. Townships/special districts, enterprise funds, and bonus Employee/compensation data deferred. Phases continue from 89, $0 spend target. (v2.8 Ohio SHIPPED + archived 2026-06-26.) — SHIPPED + archived 2026-06-28 (Chris UAT all-pass 2026-06-27). Surfaced a cohort-wide issue: the all-50-states seed loaded unsourced "best guess" estimate state-node General Fund data (MN fixed with State-ACFR GAAP actuals FY2023–2025) → next milestone **v2.10 State General Fund Sourcing**.*

</details>

<details>
<summary>Previous footer — v2.8 Ohio Local Government Expansion SHIPPED (2026-06-26)</summary>

*Last updated: 2026-06-24 — v2.8 Ohio Local Government Expansion STARTED. Bringing Ohio cities + county governments onto the tracker at parity from the single uniform Ohio Auditor of State Summarized Annual Financial Reports XLSX (Hinkle System, free, no auth): general-government revenue-by-source + expenditure-by-function (column→tree, flatter than CA/Utah), per-capita from OI_Demographics, city→county linking + Ohio state node, GAAP + CASH/MOD-fallback coverage, standardized bleed-safe enrichment inline at $0; verified via SOA_Gov/ACFR reconciliation + source-chain audit + Chris UAT. No salaries / enterprise funds deferred. Phases continue from 84, $0 spend target. (v2.7 Virginia SHIPPED + archived 2026-06-24.) — SHIPPED 2026-06-26.*

</details>
