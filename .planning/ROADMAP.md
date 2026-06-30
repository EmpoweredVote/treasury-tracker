# Roadmap — Treasury Tracker / Empowered Vote Financials

## Milestones

- ✅ **v1.0 GiveButter Real-Time Donation Feedback** — Phases 1-4 (shipped 2026-04-22)
- ✅ **v1.1 Texas Municipal Financial Transparency** — Phases 5-7 (shipped 2026-05-02)
- ✅ **v1.2 Collin County Completion & Data Quality** — Phases 8-10 (shipped 2026-05-21)
- ✅ **v1.3 Revenue Completion & Per-Capita Context** — Phases 11-14 (shipped 2026-05-22)
- ✅ **v1.4 Geographic Expansion** — Phases 15-16 (shipped 2026-05-22)
- ✅ **v1.5 Oregon Expansion** — Phases 17-25 (shipped 2026-06-04)
- ✅ **v1.6 California City Expansion** — Phases 26-31 (shipped 2026-06-06)
- ✅ **v1.7 California State Budget + Deep Icicles** — Phases 32-36 (shipped 2026-06-09)
- ✅ **v1.8 Massachusetts All-Cities Financial Transparency** — Phases 37-39 (shipped 2026-06-10)
- ✅ **v1.9 MA County-City Linking** — Phases 40-42 (shipped 2026-06-11)
- ✅ **v2.0 Federal Treasury Tracker** — Phases 43-48 (shipped 2026-06-13)
- ✅ **v2.1 Federal History** — Phases 49-51 (shipped 2026-06-14)
- ✅ **v2.2 Orange County + Reusable SoCal Pipeline** — Phases 52-57 (shipped 2026-06-16)
- ✅ **v2.3 California Coverage Parity** — Phases 58-62 (shipped 2026-06-17)
- ✅ **v2.4 Southern California Expansion** — Phases 63-67 (shipped 2026-06-17)
- ✅ **v2.5 Utah Municipal Expansion** — Phases 68-73 (shipped 2026-06-20)
- ✅ **v2.6 EV Financial Transparency Refresh** — Phases 74-78 (shipped 2026-06-22; Phase 77 iceboxed)
- ✅ **v2.7 Virginia Local Government Expansion** — Phases 79-83 (shipped 2026-06-24)
- ✅ **v2.8 Ohio Local Government Expansion** — Phases 84-88 (shipped 2026-06-26)
- ✅ **v2.9 Minnesota Local Government Expansion** — Phases 89-93 (shipped 2026-06-28)
- ✅ **v2.10 State General Fund Sourcing** — Phases 94-97 (shipped 2026-06-29)
- ✅ **v2.11 State ACFR Revenue-by-Source Upgrades (Pilot)** — Phases 98-102 (shipped 2026-06-30)
- 🚧 **v2.12 State ACFR Long Tail** — Phases 103-106 (in progress)

---

## Phases

### v2.12 State ACFR Long Tail (Phases 103-106) — ACTIVE

**Milestone goal:** Extend the proven State-ACFR GAAP upgrade — deepen the four v2.11 pilot states' history (CA/TX/NY/FL) as far back as durable ACFR URLs allow, and bring **Pennsylvania + Illinois** (the two largest remaining NASBO states) onto full ACFR revenue-by-source + finer spending-by-function.

**Constraints:** Free public ACFR PDFs only ($0 / $5 AI gate); ACFR **GAAP** basis (audited actuals) — the General Fund column of the Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances*, read via `pdftotext -table`; every figure durably sourced + **basis-labelled**; P2 negative-category clamp; **idempotent never-overwrite** (ACFR replaces NASBO per state-FY; un-upgraded states stay on NASBO; existing pilot rows undisturbed by deepening); **executed inline**. No frontend work — the v2.11 data-driven "Money In" view + `?dataset=revenue` deep-link auto-enable revenue once PA/IL load. Reuse the v2.11 `process{CA,TX,NY,FL}*.js` loaders (deepening = add older per-year URLs to each `SOURCES` map) + new PA/IL loaders on the same pattern; `scripts/loadStateGF.mjs` stays the NASBO fallback.

**Critical path:** 103 → (104 ∥ 105) → 106. Phase 103 recon locates the deeper-history URLs + PA/IL sources before any load; 104 (deepen the 4 pilots) and 105 (PA+IL) are independent and can run in parallel after recon; 106 verifies + earns Chris's live sign-off (the Phase 98/102 mold).

#### Phase 103: Recon — Deeper-History URLs + PA/IL ACFR Source Location (RECON-04, RECON-05)
**Goal:** Before any load, locate the deeper-history ACFR URLs for each pilot below its current window AND locate the PA + IL ACFR Governmental Funds GF statements, so the deepening + new-state loads target the right years/columns with confirmed durable sources.
**Requirements:** RECON-04, RECON-05
**Success criteria:**
1. For each pilot (CA/TX/NY/FL), the deeper-history ACFR URLs below its current window (FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016) are probed; the cleanly `pdftotext -table`-extractable additional FY depth + durable per-year URLs are recorded, with a gap log for years that don't cleanly extract.
2. PA + IL ACFR GF statements located (GENERAL FUND column, units, durable per-year URLs, extractable FY depth), bookend tie-confirmed via `pdftotext -table`.
3. The loader-reuse + NASBO-replace plan is written per state (SOURCES-map extension for the 4 pilots; which loader/config shape fits PA + IL).

#### Phase 104: Deepen the 4 Pilots (DEEP-01, RECON-05, ACFR-08)
**Goal:** Extend the CA/TX/NY/FL ACFR windows backward as deep as durable URLs allow, reusing the existing loaders.
**Requirements:** DEEP-01, RECON-05, ACFR-08
**Success criteria:**
1. Each pilot's window is extended backward (FL pre-FY2022, CA pre-FY2020, NY pre-FY2015, TX FY2016) with each added FY tying to its ACFR GF column total, GAAP basis-labelled.
2. Idempotent never-overwrite — existing pilot rows, un-upgraded NASBO states, and PA/IL are untouched.
3. Any negative-category year in the added years renders via the P2 clamp.

#### Phase 105: PA + IL ACFR Upgrade (ACFR-06, ACFR-07, ACFR-08, RECON-05)
**Goal:** Load PA + IL GF revenue-by-source + GAAP spending-by-function from their ACFRs, replacing their NASBO operating rows idempotently.
**Requirements:** ACFR-06, ACFR-07, ACFR-08, RECON-05
**Success criteria:**
1. PA + IL state nodes show ACFR-sourced GF revenue-by-source + spending-by-function (GAAP basis-labelled), each FY tying to the ACFR GF column totals.
2. NASBO operating rows replaced idempotently (never-overwrite); un-upgraded states unchanged; Money In auto-enables on PA/IL.
3. Negative-category years render via the P2 clamp.
**Plans:** 3 plans (wave 1: 105-01 PA loaders ∥ 105-02 IL loaders; wave 2: 105-03 live-load + verify)
Plans:
- [ ] 105-01-PLAN.md — Build PA ACFR loaders (processPAAcfr.js + processPARevenueAcfr.js), extract FY2016–FY2025, dry-run tie-verify
- [ ] 105-02-PLAN.md — Build IL ACFR loaders (processILAcfr.js + processILRevenueAcfr.js, audited-only), extract FY2021–FY2025, dry-run tie-verify
- [ ] 105-03-PLAN.md — Live-load PA+IL (NASBO replaced in place), accept-relabel + P2 clamp + idempotency + Money-In + cohort-untouched DB verification

#### Phase 106: Verification + Source-Chain Audit + UAT (VER-03, VER-04)
**Goal:** Prove the deepened + new data is real, sourced, and residue-free across the whole cohort, then earn Chris's live sign-off.
**Requirements:** VER-03, VER-04
**Success criteria:**
1. Each deepened pilot + PA + IL reconciled **independently from its own ACFR** (re-derived totals, not loader self-report) within an explained tolerance.
2. Full 50-node cohort source-chain audit clean (0 NULL/fragile/residue/out-of-window/dup/orphan), every displayed row basis-labelled; un-upgraded NASBO states still pass.
3. Live-app UAT across PA + IL + the deepened pilot windows (revenue-by-source + spending-by-function + basis label + source chip + Money In) with Chris sign-off.

---

<details>
<summary>✅ v2.11 State ACFR Revenue-by-Source Upgrades (Phases 98-102) — SHIPPED 2026-06-30 (full detail in milestones/v2.11-ROADMAP.md)</summary>

### v2.11 State ACFR Revenue-by-Source Upgrades (Phases 98-102)

**Milestone goal:** Upgrade the four highest-traffic NASBO state General Fund nodes — CA, TX, NY, FL — from operating-only to full **State-ACFR GAAP** (revenue-by-source + finer spending-by-function), basis-labelled + durably sourced, replacing NASBO operating per state-FY idempotently. The deferred "ACFR-later" half of the v2.10 hybrid.

- ✅ Phase 98: Recon — CA overlap resolved (upgrade-in-place) + all 4 ACFRs located, `-table`-tie-confirmed (RECON-01/02/03)
- ✅ Phase 99: California + Texas ACFR upgrade — CA FY2020–25, TX FY2015–24; NASBO replaced; P2 clamp (ACFR-01/02/05)
- ✅ Phase 100: New York + Florida ACFR upgrade — NY FY2015–24 (×millions), FL FY2022–24; stale-data_sources cleanup extended (ACFR-03/04/05)
- ✅ Phase 101: Revenue View + URL Robustness — Money In auto-enables on the 4 nodes; shared resolveEffectiveDataset helper hardens ?dataset=revenue (REVUX-01/02)
- ✅ Phase 102: Verification + Source-Chain Audit + UAT — 16/16 independent ACFR re-derivation exact ties; 50-node cohort audit 7/7, genuine 0 residue; Chris UAT sign-off (VER-01/02)

</details>

<details>
<summary>✅ v2.10 State General Fund Sourcing (Phases 94-97) — SHIPPED 2026-06-29 (full detail in milestones/v2.10-ROADMAP.md)</summary>

### v2.10 State General Fund Sourcing (Phases 94-97)

**Milestone goal:** Replace the all-50-states unsourced "best guess" estimate state-node General Fund data with real, sourced actuals — MN/OH/VA on State **ACFR GAAP** (operating + revenue), the other 47 states on **NASBO 2025 SER** General Fund operating actuals (the Chris-locked hybrid: NASBO now, per-state ACFR upgrades later). Every displayed figure durably sourced + basis-labelled; nothing unsourced shown.

- ✅ Phase 94: Extractor + Policy (SGFS-01) — reusable loader `scripts/loadStateGF.mjs` + locked cross-cutting policy, proven on Georgia FY2023
- ✅ Phase 95: MN History + OH/VA Re-do (SGFS-02, SGFS-03) — MN extended FY2008–2025; OH/VA falsely-sourced rows replaced with real ACFR actuals
- ✅ Phase 96: Remaining States (SGFS-04) — 94 NASBO operating state-years (46 cohort + GA, FY2023+FY2024); 375 unsourced rows deleted
- ✅ Phase 97: Verification + UAT (SGFS-05) — 50-node cohort audit clean, "Representative 7" reconciled from source, F-97-01 (GA Medicaid) fixed, Chris UAT sign-off 21/21

</details>

<details>
<summary>✅ v2.9 Minnesota Local Government Expansion (Phases 89-93) — SHIPPED 2026-06-28 (full detail in milestones/v2.9-ROADMAP.md)</summary>

### v2.9 Minnesota Local Government Expansion (Phases 89-93)

**Milestone goal:** Bring every Minnesota city + county government onto Treasury Tracker at parity from the single uniform Minnesota Office of the State Auditor "City/County Finances Report" raw XLSX (`cired_YY_data.xlsx`, free, no auth) — two-level revenue-by-source + expenditure-by-function trees (real icicle drill-down), per-capita, every figure sourced to osa.state.mn.us. The 5 ranked-choice-voting cities (Minneapolis, St. Paul, St. Louis Park, Bloomington, Minnetonka) are the mission-aligned verification anchors.

**Constraints:** One uniform free source (osa.state.mn.us, no auth, $0); general-government scope (`Governmental Funds` sheet — enterprise funds deferred); GAAP/Cash basis per-entity via `GAAPInd`; no salaries this milestone (`Employee Data` sheet deferred); XLSX-era FY range (~2015–latest, exact range pinned in Phase 89); city→county linking from the built-in `ParentEntityName` column; RCV = selection rationale + verification anchor (no new RCV UI); every figure durably sourced.

**Critical path:** 89 → 90 → 91 → 92 → 93 (same mold as v2.5→v2.8).

#### Phase 89: MN OSA Source + Loader (MNSRC-01, MNSRC-02)
**Goal:** A reusable loader turns the MN OSA `Governmental Funds` sheet into sourced operating (expenditure-by-function) + revenue (revenue-by-source) two-level trees, for both cities and counties, with per-entity basis, per-FY manifests, and idempotency.
**Success criteria:**
1. Loader builds a 2-level revenue-by-source tree + 2-level expenditure-by-function tree with correct subtotal nodes, proven on a sample RCV city FY2023 (ties to the row's `Total Revenues` / `Total Expenditures`).
2. County file URL pinned; county layout independently verified (header row/columns/vocabulary — the Ohio county-layout lesson) and a county FY2023 sample ties to its row totals.
3. GAAP/Cash basis derived per-entity from `GAAPInd`; XLSX-era per-FY manifest enumerates ~2015–latest available.
4. Idempotent never-overwrite guard in place; offline unit tests pass.

#### Phase 90: City Loads (MNCITY-01, MNCITY-02)
**Goal:** Load all ~853 Minnesota cities operating + revenue across the FY range, sourced, per-capita, idempotent.
**Success criteria:**
1. All ~853 cities loaded operating + revenue across the XLSX-era FY range; every row carries source metadata.
2. Per-capita renders from the built-in `Population` column.
3. GAAP/Cash basis recorded per-entity; cross-FY source-gap residual documented (no phantom municipalities).
4. Idempotent re-run writes 0 rows.

#### Phase 91: County Loads + Data Model & Linking (MNCO-01, MNLINK-01)
**Goal:** Load all 87 county governments and establish the Minnesota state node + source-driven city→county linking.
**Success criteria:**
1. All 87 county governments loaded operating + revenue, per-capita, sourced.
2. Minnesota state node created; cities linked to parent county via the source `ParentEntityName` column (link residual, if any, documented).
3. US→Minnesota→county→city breadcrumb + Cities-in-County panel render in the live app (existing frontend, no rebuild).

#### Phase 92: Enrichment Parity (MNENR-01)
**Goal:** Author state-neutral, bleed-safe universal enrichment for the full MN vocabulary at $0.
**Success criteria:**
1. Explicit enrichment map covers 100% of the live MN city+county category vocabulary (loader aborts on any unmapped key — no silent fallback).
2. Written via delete-then-insert (NULLS-DISTINCT-safe); `$`-leak + locality-name bleed guards pass.
3. $0 API spend (inline-authored).

#### Phase 93: Verification + Source-Chain Audit + UAT (MNVER-01, MNVER-02)
**Goal:** Reconcile, audit, re-derive, and get Chris's live sign-off.
**Success criteria:**
1. An RCV anchor city + its parent county reconciled to published ACFRs on a basis-matched comparator (deltas explained).
2. Full-cohort source-chain audit clean (0 NULL/fragile/residue across all loaded rows); independent workbook re-derivation of ≥5 entities = 0 mismatches.
3. Two-level icicle drill-down confirmed rendering (the flat-source limitation that capped Ohio is resolved).
4. Live-app UAT across ≥1 RCV anchor city + a county + the Minnesota state node — Chris sign-off.

</details>

<details>
<summary>✅ v2.8 Ohio Local Government Expansion (Phases 84-88) — SHIPPED 2026-06-26 (full detail in milestones/v2.8-ROADMAP.md)</summary>

**Milestone goal:** Bring Ohio cities + county governments onto Treasury Tracker at parity from the single uniform Ohio Auditor of State "Summarized Annual Financial Reports" XLSX (Hinkle System, free, no auth) — general-government revenue by source + expenditure by function, per-capita, every figure sourced to ohioauditor.gov.

**Constraints:** One uniform free source (ohioauditor.gov, no auth, $0); general-government scope (`SOREACIFB_TotalGov` governmental funds — enterprise funds deferred); GAAP primary + CASH/MOD fallback (mixed basis per-entity); no salaries; FY2016–2025; every figure durably sourced.

**Result:** 253 cities + 88 counties loaded (FY2016–2025), linked, enriched, ACFR-reconciled, UAT signed off (Chris 2026-06-26). One accepted limitation: flat AOS source → no icicle drill-down.

- [x] Phase 84: Ohio AOS Source + Loader (OHSRC-01/02)
- [x] Phase 85: City Loads (OHCITY-01/02) — 253 cities, 4,880 rows
- [x] Phase 86: County Loads + Data Model & Linking (OHCO-01, OHLINK-01) — 88 counties; incl. county-layout gap-closure (86-04/86-05)
- [x] Phase 87: Enrichment Parity (OHENR-01) — 51 state-neutral keys
- [x] Phase 88: Verification + Source-Chain Audit + UAT (OHVER-01/02) — Chris sign-off 2026-06-26

</details>

<details>
<summary>✅ v2.7 Virginia Local Government Expansion (Phases 79-83) — SHIPPED 2026-06-24 (full detail in milestones/v2.7-ROADMAP.md)</summary>

**Milestone goal:** Bring every reporting Virginia locality (38 independent cities, 95 counties, ~37 towns) onto Treasury Tracker at parity from the single uniform APA Comparative Report XLSX — general-government revenue by source + expenditure by function→activity, per-capita, every figure sourced.

**Constraints:** One uniform free source (data.virginia.gov, no auth, $0); general-government scope (enterprise/Exhibit F deferred); no salaries (not in source); FY2023 + FY2024 (the XLSX-available range); every figure durably sourced.

**Critical path:** 79 → 80 → 81 → 82 → 83 (81.5 EV-financials insert ran out-of-scope before 82).

- [x] Phase 79: VA APA Source + Loader (VASRC-01/02) — completed 2026-06-22
- [x] Phase 80: City + County Loads (VALOAD-01/02/04) — 127/133 loaded
- [x] Phase 81: Towns + VA Data Model & Linking (VALOAD-03, VALINK-01)
- [x] Phase 81.5: EV Micro-Donation Transparency ⎇ INSERTED (EVMICRO-01/02/03) — out-of-milestone EV financials
- [x] Phase 82: Enrichment Parity (VAENR-01)
- [x] Phase 83: Verification + Source-Chain Audit + UAT (VAVER-01/02) — Chris sign-off 2026-06-23

</details>

<details>
<summary>✅ v2.6 EV Financial Transparency Refresh (Phases 74-78) — SHIPPED 2026-06-22 (Phase 77 iceboxed; full detail in milestones/v2.6-ROADMAP.md)</summary>

**Milestone goal:** Bring Empowered Vote's own financials on the tracker fully up to date by idempotently combining every income + bank source, and add a donor-facing transparency view with an actual "where the money goes" graphic.

**Constraints:** Idempotent CSV merge (no live-API integration this milestone); free / low-cost only (unfunded nonprofit, $5 AI gate); every displayed figure sourced; bank = authoritative for balance + expenses, platforms = income detail (never double-count a platform payout against its bank deposit). EV is all-volunteer ($0 staff comp).

**Critical path:** 74 → 75 → 76 → 77 → 78 (linear; 77 extends the 76 frontend surface).

### Phase 74: Donation Source Refresh (Idempotent Income Merge)

**Goal:** EV's donation totals reflect the latest data from GiveButter, Patreon, and Benevity, with every income row deduplicated — re-running any loader never double-counts against the live webhook-written rows.
**Depends on:** Nothing (builds on existing `scripts/loadEVFinances.js` + webhook dedup)
**Requirements:** EVDATA-01, EVDATA-02, EVDATA-03
**UI hint:** no

Success criteria:
1. Latest GiveButter export loads and merges with existing webhook rows; dedup by `external_id` leaves zero duplicate transactions.
2. Patreon recurring-donation CSV loads into the income model; re-importing the same file adds zero new rows (idempotent).
3. Benevity workplace-giving CSV loads into the income model; re-importing the same file adds zero new rows (idempotent).
4. The app's EV "Money In" figures reflect the combined, deduplicated total across all three platforms.

### Phase 75: Bank Truth + Reconciliation

**Goal:** Beneficial State Bank becomes the authoritative source for EV's cash balance and expenses, and combined figures reconcile so a platform donation and its net bank deposit are counted exactly once; off-platform entries can be recorded; platform fees are tracked (not lost).
**Depends on:** Phase 74 (income model must exist before reconciling platform income against bank deposits)
**Requirements:** EVDATA-04, EVDATA-05, EVDATA-06
**UI hint:** no

**Already done (pulled forward during Phase 74 session, 2026-06-20):** the bank EXPENSE side — `scripts/loadEVBank.js` loads every bank debit into the FY operating dataset (FY2026 = $1,745.65, source='bank'), idempotent + tested. EVDATA-04's expense half is satisfied; the balance half + EVDATA-05/06 remain.

Success criteria:
1. ~~Bank CSV debits load as expenses~~ (DONE in Phase 74 session) — PLUS: cash **balance** + **runway** surfaced (latest balance $1,706.77 as of 2026-06-17 already parsed by the loader).
2. Reconciliation rule prevents double-counting: a platform payout deposited in the bank is not added on top of the platform donations that produced it (gross donations vs. net deposits).
3. Off-platform / manual entries (checks, grants, in-kind) can be recorded and appear in the combined totals.
4. Re-running the bank loader is idempotent (no duplicate transactions). *(DONE)*
5. **Platform fees are tracked and visible** (Chris, 2026-06-20) — the ~$125/FY netted platform fees (GiveButter/Patreon/Benevity), captured by `loadEVDonations.js` (D-09) but currently dropped from display, must be surfaced as part of the gross→net story ("donors gave $X → $Y fees → $Z reached EV").

### Phase 76: Donor-Facing Transparency View

**Goal:** A visitor to EV's page can understand the organization's finances at a glance — income vs. expenses, an expense breakdown that surfaces the all-volunteer story, current balance + runway, and progress toward the fundraising goal.
**Depends on:** Phase 75 (needs the combined, reconciled income + expense + balance data)
**Requirements:** EVVIEW-01, EVVIEW-02, EVVIEW-03, EVVIEW-04
**UI hint:** yes

Success criteria:
1. The EV page shows income vs. expenses in plain language — where money came from (by source) and where it went.
2. The EV page shows an expense breakdown by category that makes the all-volunteer / $0-staff-comp reality obvious.
3. The EV page shows current funds on hand (balance) and runway at the current burn rate.
4. The EV page shows the active fundraising goal and a progress indicator toward it.

### Phase 77: "Where the Money Goes" Graphic 🧊 ICEBOXED (2026-06-22)

**Status:** DEFERRED — iceboxed by Chris on 2026-06-22 during `/gsd-discuss-phase 77`, before any context/plan was committed. Not deleted; revisit in a future milestone.
**Why deferred:** EV's expenses are ~6 *flat* categories with no hierarchy, so the existing tree-chart vocabulary (icicle/sunburst) is near-degenerate, and the Phase 76 transparency view already renders the expense breakdown by category (the auto-rendered operating-dataset chart + the PlainLanguageSummary top categories). The incremental donor value of a dedicated graphic didn't justify the work right now. The data plumbing it would have used already exists.
**If revived:** the gray areas surfaced were graphic *form* (stacked `SpendingBreakdownBar` vs. `PerDollarBreakdown` "for every $10…" vs. reuse icicle), placement, donor framing, and interactivity. See DISCUSSION-LOG note in this milestone's close.

**Goal (original):** A graphic shows donors how money actually spent so far this period breaks down by category, rendered in the tracker's existing visualization vocabulary.
**Requirements:** EVVIZ-01 (deferred with this phase)

### Phase 78: Reconciliation Audit + Live-App UAT

**Goal:** The refreshed figures and transparency view are verified — combined totals reconcile to the bank balance within an explained tolerance, every figure is sourced, and Chris signs off in the live app. *(The spend graphic is excluded — Phase 77 iceboxed 2026-06-22.)*
**Depends on:** Phases 74–76 *(was 74–77; Phase 77 iceboxed)*
**Requirements:** EVVER-01, EVVER-02
**UI hint:** no

Success criteria:
1. Combined displayed figures reconcile to the Beneficial State Bank balance within a documented, explained tolerance.
2. Every displayed figure carries a source (platform export, bank statement, or manual-entry record).
3. A live-app UAT covering the refreshed figures and the transparency view passes with Chris's sign-off. *(Spend graphic dropped — Phase 77 iceboxed.)*

</details>

---

<details>
<summary>✅ v1.0 GiveButter Real-Time Donation Feedback (Phases 1-4) — SHIPPED 2026-04-22</summary>

### Phase 1: Donate Button (COMPLETE)

**Goal:** Donate button visible on financials.empowered.vote, opens GiveButter campaign in new tab.
**Status:** Shipped (pre-GSD)

Plans:

- [x] Phase 1 complete (pre-GSD planning)

### Phase 2: Data Layer Audit (COMPLETE)

**Goal:** Confirm how the frontend reads financial data and define the exact atomic update contract for the webhook backend.
**Status:** Complete — 2026-04-21

Plans:

- [x] 02-01-PLAN.md — Audit pre-aggregation pattern + produce Phase 3 technical contract

### Phase 3: Webhook Backend (COMPLETE)

**Goal:** Build the GiveButter → Supabase Edge Function → Postgres RPC pipeline that atomically writes donation events and updates pre-aggregated budget totals.
**Status:** Complete — 2026-04-22

Plans:

- [x] 03-01-PLAN.md — Schema migration: add external_id + source columns + dedup index
- [x] 03-02-PLAN.md — Postgres RPC function: treasury.record_givebutter_donation
- [x] 03-03-PLAN.md — loadEVFinances.js: source tagging + webhook row preservation
- [x] 03-04-PLAN.md — Edge Function: create + deploy givebutter-webhook
- [x] 03-05-PLAN.md — Go-live: register webhook + $1 test + validate all three criteria

### Phase 4: Live Feedback UI (COMPLETE)

**Goal:** Add window focus listener and animated counter on financials.empowered.vote to re-fetch and display updated revenue when donor returns from GiveButter.
**Status:** Complete — 2026-04-22

Plans:

- [x] 04-01-PLAN.md — useAnimatedCounter hook + visibilitychange → silent revenue refetch in App.tsx
- [x] 04-02-PLAN.md — Wire animated count-up + green-glow settle into PlainLanguageSummary and DatasetTabs revenue displays

</details>

---

<details>
<summary>✅ v1.1 Texas Municipal Financial Transparency (Phases 5-7) — SHIPPED 2026-05-02</summary>

### Phase 5: Dallas Socrata Integration (COMPLETE — 2026-05-01)

**Goal:** Citizens can view Dallas operating and revenue budget data in the app, loaded via a generic Socrata SODA pipeline reusable for any future city.

Plans:

- [x] 05-01-PLAN.md — Idempotent seeder for Dallas operating + revenue `data_sources` rows
- [x] 05-02-PLAN.md — Generic Socrata budget loader (`bulkLoadBudget.js`) calling `treasury_sync_budget_tree`
- [x] 05-03-PLAN.md — Live load Dallas FY2025 + FY2026 operating + revenue, verify in app + idempotency

### Phase 6: XLSX Pipeline (COMPLETE — 2026-05-01)

**Goal:** Citizens can view check register and payroll data for Plano, McKinney, and Frisco, loaded via a generic XLSX download pipeline.

Plans:

- [x] 06-01-PLAN.md — Build generic bulkLoadXLSX.js (download, parse, SHA-256 dedup, treasury_sync_transactions RPC)
- [x] 06-02-PLAN.md — Investigate sources + idempotent seedXLSXDataSources.js for Plano, McKinney (transactions + payroll), Frisco
- [x] 06-03-PLAN.md — Live load all seeded sources, verify idempotency + force-reload, confirm data visible in app

### Phase 7: PDF/Haiku Vision Pipeline (COMPLETE — 2026-05-02)

**Goal:** Citizens can view budget data for Allen, Prosper, and Celina, extracted from ACFR PDFs using a Claude Haiku vision pipeline.

Plans:

- [x] 07-01-PLAN.md — PDF rendering foundation: install pdftoimg-js + @napi-rs/canvas, scaffold bulkLoadPDF.js
- [x] 07-02-PLAN.md — Haiku vision extraction + treasury_sync_budget_tree RPC integration
- [x] 07-03-PLAN.md — Seed Allen/Prosper/Celina data_sources, dry-run + live-load all three ACFRs

</details>

---

<details>
<summary>✅ v1.2 Collin County Completion & Data Quality (Phases 8-10) — SHIPPED 2026-05-21</summary>

Fixed PDF department attribution, loaded revenue for 4 TX cities, added 5 Collin County cities via pdftotext parsers. See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md).

- [x] Phase 8: Data Quality (3/3 plans) — completed 2026-05-04
- [x] Phase 9: Revenue Completion (3/3 plans) — completed 2026-05-04
- [x] Phase 10: Collin County Expansion (3/3 plans) — completed 2026-05-21

</details>

---

<details>
<summary>✅ v1.3 Revenue Completion & Per-Capita Context (Phases 11-14) — SHIPPED 2026-05-22</summary>

Closed all deferred v1.2 data work: Prosper + Celina revenue via pdftotext, Richardson operating budget, enrichment for 5 Collin County cities, TX population data with per-capita display. See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) (planned) or .planning/phases/11-14 for full execution history.

- [x] Phase 11: Population Schema, Census Data Load, and Per-Capita Display (3/3 plans) — completed 2026-05-21
- [x] Phase 12: Prosper and Celina Revenue via pdftotext (3/3 plans) — completed 2026-05-22
- [x] Phase 13: Richardson Operating Budget (1/1 plan) — completed 2026-05-22
- [x] Phase 14: Category Enrichment — 5 Collin County Cities (2/2 plans) — completed 2026-05-22

</details>

---

<details>
<summary>✅ v1.4 Geographic Expansion (Phases 15-16) — SHIPPED 2026-05-22</summary>

First non-TX cities launched: LA, SF, SD operating + revenue budgets with per-capita and enrichment. See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md).

- [x] Phase 15: Los Angeles Socrata Budget Load + Enrichment (3/3 plans) — completed 2026-05-22
- [x] Phase 16: California Cities Expansion (SF, SD, LA Revenue) (5/5 plans) — completed 2026-05-22

</details>

---

<details>
<summary>✅ v1.5 Oregon Expansion (Phases 17-25) — SHIPPED 2026-06-04</summary>

### Phase 17: Portland OR Budget Load (COMPLETE — 2026-05-31)

**Goal:** Citizens can view Portland, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. (Revenue budget deferred to a follow-up per D-03 — Portland publishes revenue only in PDF Vol 2 at fund level, more complex than the bureau-level operating tables.)

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 17-01-PLAN.md — Foundation: verify pdfplumber, download + inspect Vol 1 PDFs, seed Portland municipality + operating data_source, add OR:'Oregon' label

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 17-02-PLAN.md — extractPortland.py + processPortland.js PDF→treasury_sync_budget_tree pipeline (dry-run validated)
- [x] 17-03-PLAN.md — loadORPopulation.js: Census FIPS-41 population load (635,749)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 17-04-PLAN.md — Live load operating budget, enrich categories, human-verify in app, write 17-VERIFICATION.md

### Phase 18: Portland Historical Operating Budget (COMPLETE — 2026-05-31)

**Goal:** Portland operating budget data extended to FY2022–FY2024 so citizens can see historical spending trends.

**Status:** Complete — executed directly from 18-RESEARCH.md (no formal plan files; processPortland.js run unchanged against historical PDFs)

### Phase 19: Portland Revenue Budget (COMPLETE — 2026-05-31)

**Goal:** Portland revenue budget (Vol 2, fund-level) loaded for FY2022–FY2026 so citizens can see both spending and revenue sides.

**Status:** Complete — executed directly from 19-RESEARCH.md (extract_revenue() added to extractPortland.py; --revenue flag added to processPortland.js)

### Phase 20: Gresham OR Budget Load (COMPLETE — 2026-06-01)

**Goal:** Citizens can view Gresham, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. Gresham is the second-largest city in Multnomah County (~115,000 pop), completing the county's two major cities.

**Depends on:** Phase 17

**Plans:** 4/4 plans complete
Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Foundation: verify pdfplumber, create docs/Gresham/ + download 4 PDFs (FY2023–FY2026), inspect FY2023-24 All Funds structure, seed Gresham municipality (pop 111,507)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02-PLAN.md — extractGresham.py (text-line parser, NOT extract_tables) + processGresham.js → treasury_sync_budget_tree pipeline (dry-run validated, all 4 PDFs)
- [x] 20-03-PLAN.md — loadORPopulation.js: two-constant edit to add Gresham (Census 111,507)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-04-PLAN.md — Live load operating budget FY2023–FY2026, enrich categories, human-verify in app, write 20-VERIFICATION.md

### Phase 21: Gresham OR Revenue Load (COMPLETE — 2026-06-01)

**Goal:** Citizens can view Gresham, OR revenue (Money In) data alongside the existing operating budget. Revenue rows are extracted from the Resources section of the same 4 adopted budget PDFs (FY2023-FY2026) already used for phase 20.

**Depends on:** Phase 20

**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 21-01-PLAN.md — Add extract_revenue() + --mode to extractGresham.py and --revenue pipeline to processGresham.js; validate all 4 FYs via dry-run

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-02-PLAN.md — Live-load revenue FY2023-FY2026, DB-verify (no collision, no Beginning Balance), conditional enrichment, human-verify Money In tab, write 21-VERIFICATION.md

---

### Phase 22: Troutdale OR Budget Load

**Goal:** Citizens can view Troutdale, OR operating budget data in the app, with per-capita display and AI-enriched category descriptions. Troutdale (15,749 pop, Census 2024) is the third-largest incorporated city in Multnomah County. Revenue (Money In) is folded into this phase per D-01.

**Depends on:** Phase 20

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 22-01-PLAN.md — Download Troutdale PDFs, create extractTroutdale.py (General Fund operating + All Funds revenue), seed Troutdale municipality (pop 15,749)

**Wave 2** *(blocked on Wave 1)*

- [x] 22-02-PLAN.md — Create processTroutdale.js loader ($30M sanity cap, --revenue mode); dry-run all FYs and resolve D-02 FY depth

**Wave 3** *(blocked on Wave 2)*

- [x] 22-03-PLAN.md — Live-load operating + revenue, loadORPopulation.js Troutdale edit, conditional enrichment, human-verify, write 22-VERIFICATION.md

---

### Phase 23: OR All Funds Consistency — Requirements Extraction (Portland + Gresham + Troutdale)

**Goal:** Resolve the scope mismatch between the Budget tab (~$330M departmental operating) and Money In tab (~$512M All Funds Resources) for Oregon cities. Both sides of the financial picture should use the same "All Funds" scope so totals balance and citizens aren't misled by an apparent surplus that is actually an accounting artifact.

**Problem:** Money In already uses the All Funds Resources section (~10 categories, all funds combined). The Budget tab uses the departmental operating budget (a subset). Displaying them together implies the city brings in $512M and only spends $330M, which looks like a $180M windfall but is actually just mismatched scopes — the same $180M appears on the Requirements side of the same All Funds page.

**Approach:** Extract the Requirements column from the "Resources and Requirements — All Funds" page in each OR city's adopted budget PDF (the same page already used for revenue extraction). Store as `dataset_type='all_funds_requirements'`. Show as the primary Budget tab total, with the existing departmental operating breakdown as a drill-down detail. The frontend headline + gap-explanation label are data-driven (D-04) — any city/year with the data gets them; TX/CA unchanged.

**Scope:** Portland (Vol 1, FY2022–FY2026), Gresham (FY2023–FY2026), Troutdale (FY2019–FY2026, D-05 confirmed) — full end-to-end (D-01): data extraction + DB load + frontend display change.

**Depends on:** Phases 19, 21

**Plans:** 4/4 plans complete
Plans:
**Wave 1** *(three independent city pipelines, parallel)*

- [x] 23-01-PLAN.md — Gresham: extract_requirements() + processGresham.js --requirements; live-load FY2023–FY2026 (~$897M FY2026)
- [x] 23-02-PLAN.md — Portland: table-based multi-page extract_requirements() (Vol 1, D-07) + processPortland.js --requirements; live-load FY2022–FY2026
- [x] 23-03-PLAN.md — Troutdale: extract_requirements() (RESOURCES→REQUIREMENTS gate flip, D-05) + processTroutdale.js --requirements; live-load FY2019–FY2026 (~$81M FY2026)

**Wave 2** *(blocked on Wave 1 — needs all_funds_requirements rows in DB to verify)*

- [x] 23-04-PLAN.md — Frontend: dataset_type union + App.tsx detection/load/prop/operatingTotal override/tab-filter + PlainLanguageSummary headline override + gap-explanation label (D-02/D-03/D-04); human-verify all OR + TX/CA cities

---

### Phase 24: Los Angeles Data Refresh

**Goal:** Improve the quality, accuracy, and completeness of Los Angeles financial data. Fix the suspicious FY2025 revenue figure (~$44.6B — likely enterprise fund bleed), backfill real expenditure actuals for FY2021–2024 from the LA Controller dataset, add department-level category trees for FY2017–2020 (currently totals-only), repair orphaned data_source_id FK references, and improve plain-language section summaries using existing enrichment data — no new AI API calls.

**Depends on:** Phase 15

**Plans:** 4/4 plans complete
Plans:
**Wave 1** *(three independent fixes, no file overlap, fully parallel)*

- [x] 24-01-PLAN.md — Revenue accuracy: LA_REVENUE actual_amount_column → null; reload FY2025/FY2026 revenue (~$44.6B → ~$10.2B)
- [x] 24-02-PLAN.md — Operating fix: where_extra adopted>0 filter + fiscal_years 2017-2026; reload FY2017-2026 (enterprise-bleed fix + FY2021-24 actuals + FY2017-20 trees + orphaned FK repair)
- [x] 24-03-PLAN.md — Summaries UI: surface enrichment.description (2-3 sentences) in PlainLanguageSummary; zero AI spend, zero DB writes

---

### Phase 25: LA County Data Completion + County-City Linking (COMPLETE — 2026-06-02)

**Goal:** Citizens can view LA County government's full budget (Money In and Money Out) with accurate FY2021–2024 coverage from the CA State Controller county-specific datasets. The current "LA County" data in the DB was loaded from the city-aggregated datasets (not the county government's own budget) and is mislabeled — this phase re-loads from the correct county sources (uctr-c2j8 + emxv-k8xv), fixes population (currently 0), and repairs orphaned data_source_id FKs. Additionally, a `county_id` FK is added to the municipalities schema and populated for all LA County cities (plus San Diego, Sacramento, Berkeley, Fremont), enabling the first county-city relationship in the app — cities show a "Los Angeles County →" context link, and the county page shows which incorporated cities have budget data.

**Depends on:** Phase 24

**Key data facts:**

- LA County municipality: `f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1`, population = 0 (fix to 10,014,009, year 2020)
- County datasets uctr-c2j8 (operating) + emxv-k8xv (revenue) have data through FY2024 only — FY2025/FY2026 return 0 rows (D-02 resolved)
- FY2025 operating row (~$44.1B, wrong-sourced) disposition decided via checkpoint in 25-01
- Stale city-aggregate data_source rows: `c68cc1d2-...`, `1f2e2694-...` (deleted + replaced)
- All 88 LA County cities already in DB; only 3 new county rows needed (San Diego/Sacramento/Alameda — linking only)
- ev-accounts-api `/api/treasury/cities` must return county_id (verified before UI work — highest risk)

**Plans:** 3 plans (2 waves)
Plans:
**Wave 1** *(data + schema, no file overlap, parallel)*

- [x] 25-01-PLAN.md — Data re-load: clear stale operating/revenue + orphaned data_sources, reload FY2021-2024 from county datasets, fix population, resolve FY2025 operating disposition (decision checkpoint)
- [x] 25-02-PLAN.md — Schema + linking: add `county_id UUID REFERENCES treasury.municipalities(id)` via MCP migration; seed 3 county rows + link 88 LA cities and 4 other-CA cities; update Municipality type

**Wave 2** *(blocked on 25-02 county_id data + type)*

- [x] 25-03-PLAN.md — UI: verify ev-accounts-api returns county_id; county breadcrumb chip on city pages; CitiesInCountyPanel (Available now / Coming soon) on county pages

</details>

---

<details>
<summary>✅ v1.6 California City Expansion (Phases 26-31) — SHIPPED 2026-06-06</summary>

**Milestone goal:** Add 9 new California cities (Sacramento, Oakland, San Jose, Long Beach, Bakersfield, Fresno, Riverside, Anaheim, Santa Ana) with full operating and revenue budget data, and close two carry-forward items from v1.5.

### Phase 26: Sacramento CA Data Load (COMPLETE — 2026-06-04)

**Goal:** Sacramento is visible in the app with correct operating and revenue budget data, enrichment, and per-capita display
**Depends on:** Nothing (loadSacramentoCSV.js already written)
**Requirements:** DATA-01, ENRICH-01 (Sacramento), POPUL-01 (Sacramento)
**Success Criteria** (what must be TRUE):

  1. "Sacramento" appears in the city picker at treasurytracker.empowered.vote under "California"
  2. Operating budget tab shows a total in the ~$1.6B range for the latest available FY
  3. Revenue / Money In tab shows data with at least one fiscal year populated
  4. Per-capita ($/resident) displays correctly using ~536K population
  5. Category enrichment descriptions are visible (not empty) for top operating categories

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 26-01-PLAN.md — Seed Sacramento (population 536000 + data_sources + source_registry) and live-load operating + revenue FY2013–FY2026 via loadSacramentoCSV.js

**Wave 2** *(blocked on 26-01)*

- [x] 26-02-PLAN.md — Enrich Sacramento categories (enrichCategories.js per FY), app spot-check, write 26-VERIFICATION.md

**UI hint:** yes

### Phase 27: Carry-forwards — Longview TX Revenue + STATE_LABELS

**Goal:** Longview TX shows Money In data in the app and state group headers display full names everywhere in the city picker
**Depends on:** Nothing (independent carry-forwards)
**Requirements:** CARRY-01, CARRY-02
**Success Criteria** (what must be TRUE):

  1. Longview TX city page shows a Money In tab with revenue categories populated
  2. City picker state group headers display "California", "Texas", and "Oregon" (not abbreviations)
  3. Longview revenue categories have enrichment descriptions visible

**Plans:** 2/2 plans complete

Plans:
**Wave 1**

- [x] 27-01-PLAN.md — Fix 2 corrupted Longview revenue category names in DB (Police, Library); run enrichCategories.js --city Longview --state TX --year 2026 (CARRY-01 automation)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-02-PLAN.md — Human visual verification: Longview Money In tab + STATE_LABELS full names in city picker (CARRY-01 + CARRY-02 end-to-end)

### Phase 28: Oakland + San Jose CA Data Load

**Goal:** Oakland and San Jose are visible in the app with operating and revenue budget data, covering both fiscal years of Oakland's biennial budget and General-Fund-scoped data for San Jose
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-02, DATA-03, ENRICH-01 (Oakland + San Jose), POPUL-01 (Oakland + San Jose)
**Success Criteria** (what must be TRUE):

  1. "Oakland" and "San Jose" appear in the city picker under "California"
  2. Oakland operating budget shows data for at least 2 fiscal years (biennial); totals in the ~$2.1B/year range
  3. San Jose operating budget tab shows a total in the ~$1.7–1.9B General Fund range (enterprise funds filtered or documented)
  4. Both cities show Revenue / Money In tabs with at least one fiscal year populated
  5. Per-capita displays correctly for Oakland (~444K) and San Jose (~997K)
  6. Enrichment descriptions visible for top categories in both cities

**Plans:** 3/4 plans executed

Plans:
**Wave 1**

- [x] 28-01-PLAN.md — Seed Oakland + San Jose municipality rows (pop 444K / 997K) and the four GPF/General-Fund data_source rows; verify via treasury_list_source_ids

**Wave 2** *(blocked on 28-01; Oakland and San Jose run in parallel — no file overlap)*

- [x] 28-02-PLAN.md — Oakland: download biennial PDFs, extractOakland.py (per-page FY detection, GPF label D-06) + processOakland.js; dry-run + live-load operating (best-effort revenue D-05)
- [x] 28-03-PLAN.md — San Jose: download PDFs, extractSanJose.py (General Fund only, enterprise-fund filter D-03, large-PDF early exit) + processSanJose.js; dry-run + live-load operating + best-effort revenue

**Wave 3** *(blocked on 28-02 + 28-03 — needs loaded budget rows to enrich and verify)*

- [ ] 28-04-PLAN.md — Enrichment for both cities behind the $0.10 cost gate (D-07); app spot-check all 6 success criteria; write 28-VERIFICATION.md

**UI hint:** yes

### Phase 29: Long Beach + Bakersfield CA Data Load

**Goal:** Long Beach and Bakersfield are visible in the app with operating and revenue budget data; Port of Long Beach excluded, Long Beach non-standard FY documented
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-04, DATA-07, ENRICH-01 (Long Beach + Bakersfield), POPUL-01 (Long Beach + Bakersfield)
**Success Criteria** (what must be TRUE):

  1. "Long Beach" and "Bakersfield" appear in the city picker under "California"
  2. Long Beach operating budget total is in the ~$1.5B General Fund range (Port of LB excluded; Oct–Sep FY documented in seeder)
  3. Bakersfield operating budget total is in the ~$765M range
  4. Both cities show Revenue / Money In tabs with at least one fiscal year populated
  5. Per-capita displays correctly for Long Beach (~451K) and Bakersfield (~417K)
  6. Enrichment descriptions visible for top categories in both cities

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 29-01-PLAN.md — Seed Long Beach + Bakersfield municipality rows (pop 451K / 417K, Long Beach county_id=LA County) and four operating/revenue data_source rows; idempotency check

**Wave 2** *(blocked on 29-01; Long Beach and Bakersfield run in parallel — no file overlap)*

- [x] 29-02-PLAN.md — Long Beach: download GF fund-summary PDFs (FY22–FY26), extractLongBeach.py (ending-year FY, Port/Harbor exclusion) + processLongBeach.js ($1.3B–$1.7B sanity band); dry-run + live-load operating + best-effort revenue
- [x] 29-03-PLAN.md — Bakersfield: download adopted budget PDFs (FY2024-25, FY2025-26), extractBakersfield.py (all-operating-funds scope ~$765M, not GF-only ~$287M) + processBakersfield.js ($600M–$900M sanity band); dry-run + live-load operating + best-effort revenue

**Wave 3** *(blocked on 29-02 + 29-03 — needs loaded budget rows to enrich and verify)*

- [x] 29-04-PLAN.md — Enrichment for both cities behind the $0.10 combined cost gate (D-08); app spot-check all 6 success criteria; write 29-VERIFICATION.md

**UI hint:** yes

### Phase 30: Fresno + Riverside CA Data Load

**Goal:** Fresno and Riverside are visible in the app with operating and revenue budget data; Fresno enterprise funds filtered, Riverside biennial budget covers both fiscal years
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-05, DATA-06, ENRICH-01 (Fresno + Riverside), POPUL-01 (Fresno + Riverside)
**Success Criteria** (what must be TRUE):

  1. "Fresno" and "Riverside" appear in the city picker under "California"
  2. Fresno operating budget total reflects ~$483M General Fund (enterprise funds filtered; not the ~$2.0B all-funds figure)
  3. Riverside operating budget shows data for at least 2 fiscal years (biennial); totals in the ~$1.45B/year range (RPU utility filtered or documented)
  4. Both cities show Revenue / Money In tabs with at least one fiscal year populated
  5. Per-capita displays correctly for Fresno (~550K) and Riverside (~324K)
  6. Enrichment descriptions visible for top categories in both cities

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 30-01-PLAN.md — Seed Fresno (pop 550K) + Riverside (pop 324K) municipality rows and four canonical data_source rows; verify via treasury_list_source_ids

**Wave 2** *(blocked on 30-01)*

- [x] 30-02-PLAN.md — Fresno: download PDFs, extractFresno.py (single-year, General-Fund filter at extraction time) + processFresno.js ($383M–$583M sanity band); dry-run + live-load operating + best-effort revenue (D-09: Fresno first)

**Wave 3** *(blocked on 30-02 — Fresno baseline established first per D-09)*

- [x] 30-03-PLAN.md — Riverside: download biennial PDFs, extractRiverside.py (per-page FY detection, General-Fund filter, RPU excluded) + processRiverside.js ($1.1B–$1.8B sanity band); dry-run + live-load 2 biennial FYs + best-effort revenue

**Wave 4** *(blocked on 30-02 + 30-03 — needs loaded rows to enrich and verify)*

- [x] 30-04-PLAN.md — Enrichment for both cities behind the $0.10 combined cost gate (D-10); human-verify all 6 success criteria; write 30-VERIFICATION.md

**UI hint:** yes

### Phase 31: Anaheim + Santa Ana CA Data Load (COMPLETE — 2026-06-06)

**Goal:** Anaheim and Santa Ana are visible in the app with operating and revenue budget data; General Fund scoped, enterprise funds filtered where applicable
**Depends on:** Phase 26 (CA municipality seeding pattern confirmed)
**Requirements:** DATA-08, DATA-09, ENRICH-02 (Anaheim + Santa Ana), POPUL-02 (Anaheim + Santa Ana)

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 31-01-PLAN.md — Seed Anaheim + Santa Ana municipality rows (2024 population) + 4 canonical data_source rows; verify via treasury_list_source_ids

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 31-02-PLAN.md — Anaheim: download PDFs, write extractAnaheim.py + processAnaheim.js, dry-run + live-load GF operating

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 31-03-PLAN.md — Santa Ana: download PDFs, write extractSantaAna.py + processSantaAna.js, dry-run + live-load GF operating

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 31-04-PLAN.md — Enrichment for both cities ($0.10 gate) + human app spot-check of all 6 criteria + write 31-VERIFICATION.md

</details>

---

<details>
<summary>✅ v1.7 California State Budget + Deep Icicles (Phases 32-36) — SHIPPED 2026-06-09</summary>

**Milestone goal:** Add California as a state-level entity with its General Fund budget loaded (~$228B), and deepen the icicle chart from 2 to 3 levels — CA state as the pilot, then selectively retrofitting cities where source data has a genuine 3rd level.

#### Phase Summary

- [x] **Phase 32: State Entity Infrastructure** — Schema migration + TypeScript type + EntitySwitcher UI fixes
 (completed 2026-06-06)

- [x] **Phase 33: CA State Budget Data** — Seed CA state entity, load General Fund budget, enrich with state-level framing
 (completed 2026-06-07)

- [x] **Phase 34: 3-Level Tree Infrastructure (ev-accounts-api)** — RPC + API update to accept and serve 3-level trees, backward-compatible
 (completed 2026-06-08)

- [x] **Phase 35: CA State 3-Level Icicle Pilot** — Reload CA state as genuine 3-level tree; end-to-end validation
 (completed 2026-06-08)

- [x] **Phase 36: Selective City Retrofit** — Source data audit + retrofit 1-2 cities with genuine 3rd-level data (completed 2026-06-09)

</details>

---

### ✅ v1.8 Massachusetts All-Cities Financial Transparency (SHIPPED 2026-06-10)

**Milestone goal:** Load real budget data for all 351 Massachusetts municipalities using the MA DLS (Division of Local Services) reporting portal, making MA the first fully-covered state on Treasury Tracker.

#### Phase Summary

- [x] **Phase 37: MA Loader Hardening** — Confirm GF Expenditures rdreport/tableID, add progress checkpointing, fix fiscal_years append
 (completed 2026-06-10)

- [x] **Phase 38: MA City Budget Load** — Operating + revenue data for all 351 MA cities (FY2021–FY2025); city picker updated
 (completed 2026-06-10)

- [ ] **Phase 39: MA Population, State Budget, and Enrichment** — Population per-capita, MA state budget upgrade, universal category enrichment

---

## Phase Details

### Phase 32: State Entity Infrastructure

**Goal:** The database, TypeScript types, and entity picker are all ready to host a state-level entity — without breaking any existing city or county page.
**Depends on:** Nothing (first phase of v1.7)
**Requirements:** INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):

  1. `entity_type: 'state'` migration is applied — the CHECK constraint in `treasury.municipalities` now accepts 'state'
  2. TypeScript compiles cleanly with 'state' added to the `Municipality.entity_type` union in `src/types/budget.ts`
  3. Entity picker shows a "State Governments" section above all state/city groups — not nested inside the "CALIFORNIA" group
  4. All existing city and county pages render identically to before (no regression)

**Plans:** 4/4 plans complete

Plans:
**Wave 1** *(parallel — no file overlap)*

- [x] 32-01-PLAN.md — DB migration: ADD CONSTRAINT municipalities_entity_type_check (INFRA-01)
- [x] 32-02-PLAN.md — TypeScript: add 'state' to Municipality.entity_type union (INFRA-02)

**Wave 2** *(blocked on Wave 1 — requires updated Municipality type)*

- [x] 32-03-PLAN.md — EntitySwitcher UI: pre-filter state entities + STATE GOVERNMENTS section + displayName fix (INFRA-03)

**UI hint:** yes

### Phase 33: CA State Budget Data

**Goal:** California appears as a state entity in the app with its General Fund operating budget loaded, per-capita display working, and AI-enriched category descriptions using state-level framing.
**Depends on:** Phase 32
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04

**Note:** No Socrata API exists for the CA state budget. Use the LAO historical Excel file (openpyxl, FY1985-FY2026) as the primary source, or the ebudget.ca.gov Enacted Budget Summary PDF (pdfplumber) as fallback. Confirm column structure at phase start before writing the loader. General Fund only (~$228B enacted) — do NOT load all-funds (~$495B).

**Success Criteria** (what must be TRUE):

  1. "California" appears as a selectable entity in the entity picker under a "State Governments" section
  2. Clicking California opens a Money Out tab showing General Fund budget total in the ~$228B range for FY2025-26
  3. Per-capita display shows approximately $5,800 per resident (using ~39.5M population)
  4. Category enrichment descriptions use state-level policy framing (not city-department language)
  5. Year selector shows at least FY2024-25 and FY2025-26 as selectable years

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 33-01-PLAN.md — Seed CA state municipality + data_source row; download LAO Excel to docs/California/

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 33-02-PLAN.md — Create extractCA.py + processCA.js; dry-run + live load General Fund FY2022-2026

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 33-03-PLAN.md — Add state case to enrichCategories.js; run enrichment; human app spot-check; write 33-VERIFICATION.md

**UI hint:** yes

### Phase 34: 3-Level Tree Infrastructure (ev-accounts-api)

**Goal:** The `treasury_sync_budget_tree` RPC and the `/api/treasury/budgets/:id/categories` endpoint both support 3-level trees, while remaining fully backward-compatible with all 2-level city and county data already in the DB.
**Depends on:** Phase 32
**Requirements:** TREE-01, TREE-02, TREE-03

**Critical notes:**

- This phase is entirely in the **ev-accounts-api repo** (separate from this repo).
- **Research finding (34-RESEARCH.md, verified live 2026-06-08): the infrastructure already supports 3-level trees — no ev-accounts-api or treasury-tracker code changes are needed.** The `treasury_sync_budget_tree` RPC already accepts the `c -> c -> i` shape and creates depth-0/1/2 `budget_categories` rows; `getBudgetById` builds an N-level tree from `parent_id` (Bloomington IN already runs at depth 4 in production). Phase 34 is verification-only.
- Day-1 mandatory step: confirm `budget_categories` has depth-2+ rows and that `budget_line_items` has NO `category`/`subcategory`/`department` column (hierarchy lives in `budget_categories.parent_id`; the old ARCHITECTURE.md schema is superseded).
- Do NOT search for or edit a `.sql` file for `treasury_sync_budget_tree` — it is a live Postgres function with no source file in either repo. Verify behavior via live RPC calls.
- Backward compat is automatic and inherent in the recursive `parent_id` tree builder: 2-level data has no depth-2 rows, so the builder returns 2 levels. Spot-check still required to satisfy the success criteria.

**Success Criteria** (what must be TRUE):

  1. A test 3-level tree submitted to `treasury_sync_budget_tree` lands as depth-0/1/2 `budget_categories` rows (parent_id chain — not a `budget_line_items.department` column, which does not exist)
  2. The categories API returns a 3-level `BudgetCategory[]` for that test data — Level 3 nodes visible in the response
  3. Spot-check of at least 3 existing city pages (e.g., Portland, San Jose, Dallas) confirms they render identically to before — no regressions in the 2-level paths

**Plans:** 1/1 plans complete

Plans:
**Wave 1**

- [x] 34-01-PLAN.md — Verification: create treasury-3level.test.ts (TREE-01 3-level RPC submit + DB depth check, TREE-02 3-level API response, TREE-03 backward-compat for Portland/San Jose/Dallas, with cleanup); human spot-check 3 city pages; mark TREE-01/02/03 complete

### Phase 35: CA State 3-Level Icicle Pilot

**Goal:** The California state budget is reloaded as a genuine 3-level tree (Program Area → Department → Budget Category) and the icicle chart shows all 3 drill-down levels working end-to-end in the live app.
**Depends on:** Phases 33 AND 34 (both data and infrastructure must be complete)
**Requirements:** ICICLE-01, ICICLE-02, ICICLE-03

**Note:** No frontend changes are required — `BudgetIcicle.tsx` already renders arbitrary depth via `navigationPath`. This phase is a data reload using the loader from Phase 33 against the updated RPC from Phase 34.

**Success Criteria** (what must be TRUE):

  1. CA state icicle shows 3 clickable drill-down levels in the live app (Program Area → Department → Budget Category)
  2. Clicking to Level 3 opens the `LineItemsTable` with leaf-level line items (identical behavior to existing 2-level cities at their deepest level)
  3. Drill-down animation and layout look correct at all 3 levels — no visual layout breakage
  4. The CA state page looks and works as expected end-to-end (correct totals, correct year, correct per-capita, correct enrichment)

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 35-01-PLAN.md — Discovery: measure function-column distribution (A1) + test mixed c+i RPC node (A2); decide D-05 strategy

**Wave 2** *(blocked on 35-01 — D-05 strategy gates the builder)*

- [x] 35-02-PLAN.md — Code: extractCA.py emit function (D-03) + processCA.js buildNLevelTree (D-02/D-04/D-05) + SUPABASE_URL fix (D-12); dry-run all 5 FYs

**Wave 3** *(blocked on 35-02 — needs the updated loader)*

- [x] 35-03-PLAN.md — Live reload 5 FYs + DB depth verify (ICICLE-01); $5-gated depth-2 enrichment (D-09/D-10); human live-app spot-check (ICICLE-02/03); write 35-VERIFICATION.md

**UI hint:** yes

### Phase 36: Selective City Retrofit

**Goal:** At least 1 existing city with genuine 3rd-level source data is retrofitted to show a 3-level icicle, validating the retrofit pattern before any broader rollout decision.
**Depends on:** Phase 35 (infrastructure validated with CA state before touching any existing city)
**Requirements:** RETROFIT-01, RETROFIT-02, RETROFIT-03

**Critical note:** Begin with a source data audit of 2-3 candidate cities before writing any loader code. Only retrofit cities where the source PDF or dataset has a natural, extractable 3rd level — do not synthesize a 3rd level from 2-level data.

**Success Criteria** (what must be TRUE):

  1. Source data audit identifies at least 1 city (from the existing 30+ entities) with a genuine, extractable 3rd-level structure in its source data
  2. At least 1 retrofitted city shows a 3-level icicle drill-down in the live app after reload
  3. Retrofitted city's existing enrichment descriptions remain intact (no descriptions wiped or corrupted)
  4. Non-retrofitted cities continue to render correctly — no regression in any 2-level city or county page

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 36-01-PLAN.md — Audit framework doc + DB audit_verdict column + 3 pilot verdicts + RPC depth-change verification (RETROFIT-01)

**Wave 2** *(blocked on 36-01; Portland and Dallas run in parallel — no file overlap)*

- [x] 36-02-PLAN.md — Portland: extractPortland.py service_area map + processPortland.js 3-level builder + WR-04 fix; FY2026 dry-run (RETROFIT-02)
- [x] 36-03-PLAN.md — Dallas: bulkLoadBudget.js department_column 3-level path + column_mapping update + WR-04 fix; FY2026 dry-run + backward-compat check (RETROFIT-02)

**Wave 3** *(blocked on 36-02 + 36-03 — needs validated loaders)*

- [x] 36-04-PLAN.md — Live-load Portland + Dallas FY2026 3-level; enrichment preservation + new-node enrichment ($5 gate); human-verify icicle + no regression (RETROFIT-02, RETROFIT-03)

---

### Phase 37: MA Loader Hardening

**Goal:** The MA DLS loader is safe to run against all 351 cities — the correct rdreport/tableID for General Fund Expenditures is confirmed, the loader can resume a failed run without restarting from city 1, and loading a second fiscal year onto an existing data_source record appends to fiscal_years rather than overwriting.
**Depends on:** Nothing (prerequisite to any bulk load)
**Requirements:** LOAD-01, LOAD-02, LOAD-03
**Success Criteria** (what must be TRUE):

  1. Running `scrapeMaDLS.js --explore` against a sample city returns the rdreport and tableID for General Fund Expenditures — confirmed correct before any city data is written
  2. A deliberately interrupted bulk run resumes from the last successfully loaded city (not from city 1) when restarted — no duplicate rows written for cities already processed
  3. Loading FY2022 followed by FY2023 onto the same data_source row results in `fiscal_years: [2022, 2023]` — not `fiscal_years: [2023]` (overwrite) or a DB constraint error
  4. A dry-run against 3–5 sample MA cities completes without errors and produces budget tree JSON that passes sanity checks (non-zero totals, recognizable DLS category names)

**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 37-01-PLAN.md - LOAD-01: discover + confirm GF Expenditures rdreport/tableID via --explore; update REPORTS[] (human-decision checkpoint)

**Wave 2** *(blocked on 37-01 - same file)*

- [x] 37-02-PLAN.md - LOAD-02 checkpoint resume + LOAD-03 fiscal_years append-dedup in loadToSupabase; .gitignore scripts/output/; SC-4 dry-run

### Phase 38: MA City Budget Load

**Goal:** All 351 Massachusetts municipalities have operating and revenue budget data visible in the app for FY2021–FY2025, and Massachusetts appears as a selectable state in the city picker.
**Depends on:** Phase 37 (loader hardening must precede bulk load)
**Requirements:** MA-01, MA-02, MA-03
**Success Criteria** (what must be TRUE):

  1. "Massachusetts" appears as a group in the city picker and all 351 MA cities are listed and selectable
  2. Clicking any MA city opens a Money Out (operating) tab showing General Fund Expenditures totals for at least one fiscal year between FY2021–FY2025
  3. Clicking any MA city opens a Money In (revenue) tab showing Revenue by Source totals for at least one fiscal year between FY2021–FY2025
  4. The five fiscal years FY2021–FY2025 are each available in the year selector for a representative sample of MA cities (e.g., Boston, Worcester, Springfield)
  5. DB row count for MA operating budget entries exceeds 1,000 rows (351 cities × ~5 FYs × multiple categories), confirming full bulk load completed

**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 38-01-PLAN.md — Scrape MA DLS revenue-by-source + special-revenue expenditures for FY2021–FY2024 (8 JSON files) (MA-01, MA-02)

**Wave 2** *(blocked on 38-01 — needs the scraped JSON files)*

- [x] 38-02-PLAN.md — Load all 10 FY files via treasury_sync_budget_tree; live LOAD-02 resume confirm; verify DB counts + fiscal_years; human spot-check MASSACHUSETTS picker + Boston/Worcester/Springfield (MA-01, MA-02, MA-03)

**UI hint:** yes

### Phase 39: MA Population, State Budget, and Enrichment

**Goal:** Every MA city shows per-capita spending, the MA state government budget is upgraded from estimates to real DLS data, and all 14 universal MA DLS category names are enriched with plain-language descriptions shared across all 351 cities.
**Depends on:** Phase 38 (MA city data must be loaded before enrichment can target MA rows; per-capita display requires city rows to exist)
**Requirements:** MA-04, STATE-01, ENRICH-01
**Success Criteria** (what must be TRUE):

  1. Clicking any MA city page shows a per-capita ($/resident) figure alongside the budget total, derived from 2024 Census population data
  2. The MA state government entity in the app shows General Fund Expenditures data sourced from real MA DLS figures — not hardcoded estimates
  3. All 9 MA DLS operating category names (e.g., "General Government", "Public Safety", "Education") display plain-language enrichment descriptions on any MA city page
  4. All 5 MA DLS revenue category names (e.g., "Property Taxes", "State Aid") display plain-language enrichment descriptions on any MA city page
  5. Enrichment descriptions are identical across different MA cities for the same category name — confirming universal (not per-city) reuse

**Plans:** 4 plans (2 waves)
Plans:
**Wave 1** *(three independent workstreams, no file overlap, fully parallel)*

- [x] 39-01-PLAN.md — MA-04: create loadMAPopulation.js (Census FIPS-25, SUMLEV=061, dynamic 351-city DB list) + live-load population for all 351 MA municipalities
- [x] 39-02-PLAN.md — STATE-01: update processMA.js EXPENDITURES with real MA GF figures (enacted/actual) + reload MA state entity + commit loadMaGFExcel.js
- [x] 39-03-PLAN.md — ENRICH-01: enrich Boston 14 MA DLS categories + universalize (municipality_id=NULL) with Pitfall-5 duplicate guard

**Wave 2** *(blocked on 39-01 + 39-02 + 39-03 — needs all data loaded to verify in app)*

- [ ] 39-04-PLAN.md — Automated DB verification of all 3 workstreams + human app spot-check (per-capita, MA state real data, universal enrichment identical across cities)

**UI hint:** yes

---

### ✅ v1.9 MA County-City Linking (SHIPPED 2026-06-11)

**Milestone goal:** Seed 5 active MA county entities, link MA cities to their counties, load budget data for those county governments, and surface county breadcrumb + CitiesInCountyPanel for MA in the live app.

#### Phase Summary

- [x] **Phase 40: MA County Seeding + City Linking** — Seed 5 county rows (Barnstable, Bristol, Dukes, Norfolk, Plymouth), load 2024 Census population for each, link all MA cities in those counties via county_id FK. Unblocks breadcrumb chip and CitiesInCountyPanel automatically.
- [x] **Phase 41: MA County Budget Load** — Discover budget source format for each of the 5 active counties, download PDFs, extract and load operating budget data. Each county is independent; load in parallel where possible.
 (completed 2026-06-11)

- [x] **Phase 42: County Enrichment + Verification** — Enrich budget categories for all 5 counties (municipality_id-scoped, never universal). Human spot-check: county breadcrumbs on MA city pages, CitiesInCountyPanel on county pages, per-capita display, budget visualization.

### Phase 40: MA County Seeding + City Linking

**Goal:** 5 MA county entities exist in the DB with Census population and all MA cities in those counties are linked via county_id FK.
**Depends on:** Nothing (county_id column already exists; pattern proven from Phase 25)
**Requirements:** COUNTY-01, COUNTY-02, COUNTY-03, UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. 5 county rows exist in `treasury.municipalities` with entity_type='county', state='MA', and population > 0
  2. Running `SELECT COUNT(*) FROM treasury.municipalities WHERE state='MA' AND county_id IS NOT NULL` returns the expected city count for those 5 counties
  3. Spot-check: opening Boston, Taunton, and Plymouth city pages in the app shows the county breadcrumb chip (after county_id set — no frontend changes needed)
  4. County names use "County" suffix to avoid slug collision with same-named cities (e.g., "Barnstable County" not "Barnstable")
  5. No errors on cities in the 9 dissolved counties — county_id remains NULL for those cities

**Plans:** 1 plan (single wave)

- [x] 40-01-PLAN.md — `scripts/seedMACountyLinks.js`: INSERT 5 county rows with Census 2024 population; UPDATE county_id for all MA cities in those counties using Census Gazetteer GEOID mapping; dry-run + live run + DB verification

### Phase 41: MA County Budget Load

**Goal:** All 5 active MA county governments have operating budget data loaded and visible in the app.
**Depends on:** Phase 40 (county municipality_id UUIDs must exist before data_source rows can be created)
**Requirements:** DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):

  1. Each of the 5 county pages (Barnstable, Bristol, Dukes, Norfolk, Plymouth) shows a Money Out (operating budget) tab with at least one fiscal year of data
  2. Budget totals are plausible for each county: Barnstable ~$22–25M, Bristol ~$9–14M, Dukes ~$1–2M, Norfolk ~$14–18M, Plymouth ~$15–25M
  3. DB verification: `SELECT COUNT(*) FROM treasury.budgets b JOIN treasury.municipalities m ON m.id=b.municipality_id WHERE m.state='MA' AND m.entity_type='county'` returns at least 5 rows (one per county)
  4. No budget data from any MA county bleeds into the city-level queries
  5. Each county appears in the EntitySwitcher under "Massachusetts > Counties"

**Plans:** 2/2 plans complete

**Wave 1**

- [x] 41-01-PLAN.md — Discovery: Bristol PDF manual download (human-action checkpoint) + pdftotext inspection of all 5 counties; confirm extraction approach per county

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 41-02-PLAN.md — Write `scripts/extractMACounties.py` + `scripts/loadMACountyBudget.js`; dry-run all 5; live-load; DB verify counts + totals

**Cross-cutting constraints:**

- `api_type` must be `'pdf_download'` (not `'ma-dls'`) — county budgets are individual PDFs, not DLS portal data
- `loadEnv` must use inline comment stripping from `seedMACountyLinks.js` pattern (not `loadMAPopulation.js`) to avoid WR-03 bug

### Phase 42: County Enrichment + Verification

**Goal:** All 5 active MA county budget categories have plain-language descriptions, and the full county-city linking feature is human-verified in the live app.
**Depends on:** Phase 41 (budget rows must exist before enrichment can target county categories)
**Requirements:** ENRICH-01, COUNTY-03, UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. At least the top 3 budget categories for each active county have enrichment descriptions (municipality_id-scoped — never NULL/universal)
  2. A human confirms: opening any linked MA city page shows a county breadcrumb chip (e.g., "Bristol County →")
  3. A human confirms: clicking a county breadcrumb navigates to the county page, which shows the CitiesInCountyPanel listing cities in that county
  4. A human confirms: county page shows per-capita figure ($/resident) using the loaded Census county population
  5. A human confirms: no regression on any existing MA city page or other entity

**Plans:** 1 plan (enrichment + human gate)

- [x] 42-01-PLAN.md — Run enrichCategories.js for each of 5 counties (municipality_id-scoped, ~$0.01 total); human spot-check breadcrumb + CitiesInCountyPanel + per-capita; write 42-VERIFICATION.md

---

<details>
<summary>✅ v2.0 Federal Treasury Tracker (Phases 43-48) — SHIPPED 2026-06-13</summary>

_Full detail archived in `.planning/milestones/v2.0-ROADMAP.md`._

**Milestone goal:** Describe the US Federal Budget visually with maximum clarity and context for average citizens — always sourced, never editorialized. FY2025 actuals headline; Mandatory/Discretionary/Net Interest first split; function lens default with agency toggle; fetch-then-summarize explainers; Congress.gov-backed program origins pilot.

**Foundation:** Data recon complete 2026-06-12 (`.planning/v2.0-recon/RECON.md`) — all free sources verified live, headline figures pinned, IA decisions made with Chris. Ground rules in `v2.0-FEDERAL-BRIEF.md` and auto-memory.

#### Phase Summary

- [ ] **Phase 43: Federal Entity + Sourcing Infrastructure** — entity_type 'federal' (Phase 32 'state' pattern), sourcing columns on budget/enrichment rows, program_details table. *(Sonnet-delegable)*
- [ ] **Phase 44: Core Federal Data Load** — Loaders for MTS Table 9 (function lens, FY2025 + FY2026 FYTD), MTS Table 5 (agency lens), OMB Hist 1.1/8.1 (first split + history), debt/interest. Every row sourced. *(Sonnet-delegable)*
- [ ] **Phase 45: Federal Visualization** — Landing first-split bands + deficit strip, function-default/agency-toggle drill, source chips, comparative-scale aids. *(Design: stronger model; implement: Sonnet)*
- [ ] **Phase 46: Sourced Explainer Pipeline v2** — Fetch-then-summarize-with-citation enrichment for ~20 functions + top 10 agencies; DoD audit opacity flags. *(Standard: stronger model; run: Sonnet)*
- [ ] **Phase 47: Program Origins Pilot** — 15–20 major programs with Congress.gov/GovInfo-backed details sections. Requires Chris's free API keys. *(Sonnet fetches; stronger model sets editorial format)*
- [ ] **Phase 48: Source-Chain Verification + UAT** — Automated every-claim-resolves audit + Chris spot-check.

### Phase 43: Federal Entity + Sourcing Infrastructure

**Goal:** The DB, API, and frontend types accept a federal entity, and the sourcing schema exists for always-sourced data.
**Depends on:** Nothing (Phase 32 'state' pattern proven)
**Requirements:** INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):

  1. A municipality row with entity_type='federal' can be created and is served by ev-accounts-api without errors
  2. `source_name`, `source_url`, `source_date` columns exist on budget and enrichment rows (nullable for legacy city/state rows; populated on all federal rows)
  3. `program_details` table exists with per-claim source URL fields
  4. EntitySwitcher shows a "United States" federal entry (may be hidden behind a flag until Phase 45)
  5. No regression on existing city/county/state pages

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 43-01-PLAN.md — 4 DB migrations: 'federal' entity_type, source_url/source_date on budget tables, program_details table, federal source_registry seed
- [x] 43-02-PLAN.md — Frontend: 'federal' in Municipality union + EntitySwitcher FEDERAL GOVERNMENT section (Phase 32 state pattern, one tier higher)

**Wave 2** *(blocked on Wave 1)*

- [x] 43-03-PLAN.md — Backend audit + E2E simulation: prove getCities serves a data-bearing federal row and hides a data-less one; full temp-row cleanup; regression counts. Zero backend changes needed. ⚠️ Phase 44 finding: visibility gated on treasury.budgets metadata rows (fiscal_year_start_month=10 for federal)

### Phase 44: Core Federal Data Load

**Goal:** All headline federal data is loaded, sourced, and queryable: FY2025 actuals (both lenses), the first split, multi-decade context, and FY2026 FYTD.
**Depends on:** Phase 43
**Requirements:** DATA-01 through DATA-07
**Success Criteria** (what must be TRUE):

  1. FY2025 outlays by function sum to ~$7,011B against OMB Hist 1.1 (within rounding); receipts to ~$5,236B
  2. OMB 8.1 split rows exist for FY2015–FY2025 (mandatory/discretionary defense/discretionary nondefense/net interest)
  3. FY2026 FYTD figures current through the latest MTS month load successfully and re-running the loader is idempotent
  4. MTS Table 5 department-level outlays load with no double-counting (validated: departments sum ≈ total net outlays)
  5. Every loaded federal row has source_name, source_url, source_date populated — zero exceptions
  6. Debt to the Penny total and FYTD interest expense are loaded with source metadata

**Cross-cutting constraints:**

- `page[size]` must be URL-encoded in Fiscal Data API calls
- OMB xlsx downloads require a browser User-Agent
- USAspending obligations NEVER loaded as outlay figures
- Depth directive (Chris 2026-06-12): trees go deeper than 3 levels where sourced outlays support it; infrastructure verified N-level with no caps

**Plans:** 5 plans (3 waves)

**Wave 1**

- [x] 44-01-PLAN.md — Schema (federal_agency dataset_type, federal_annual_summary + federal_context_metrics tables) + seedUSFederal.js (Census-fetched population 340,110,988) + frontend dataset_type safety audit

**Wave 2** *(blocked on 44-01)*

- [x] 44-02-PLAN.md — OMB Hist 1.1 + 8.1 → federal_annual_summary (64 years 1962–2025, anchors exact; 8.1 is in BILLIONS — units read per file)
- [x] 44-03-PLAN.md — MTS: FY2025 receipts tree ($5,234.6B, 0.034% vs OMB) + 4 context metrics. ✅ CHECKPOINT: Chris chose GO 2026-06-12 — United States publicly visible

**Wave 3** *(blocked on Wave 2)*

- [x] 44-04-PLAN.md — Function lens DEEP path taken: 18 functions → 61 subfunctions → 1,613 accounts (PBDB sums EXACTLY to OMB 1.1); BudgetIcicle child-width normalization; reconciliation identity 0.0000%
- [x] 44-05-PLAN.md — Agency lens: 29 departments, 5 depth levels, identity 0.006% vs T5 Total Outlays; 44-VERIFICATION.md — all seven DATA requirements PASS

### Phase 45: Federal Visualization

**Goal:** A citizen landing on the United States page sees the proportional first split with deficit context and can drill either lens, every figure sourced.
**Depends on:** Phase 44
**Requirements:** VIZ-01 through VIZ-06
**Success Criteria** (what must be TRUE):

  1. Landing view: proportional Mandatory / Discretionary / Net Interest bands for FY2025 — not an icicle
  2. Deficit strip is always visible: receipts $5,236B vs outlays $7,011B, gap labeled, debt total shown
  3. Function lens drill is default; agency lens one toggle away; FY2026 "this year so far" strip present
  4. Every figure displays a source chip (dataset, fetch date, working link)
  5. Per-capita / per-taxpayer / % of total toggles work with formula disclosure
  6. The outlays-vs-budget-authority methodology note is visible in-app

**Plans:** 4 plans (4 waves)

**Wave 1**

- [x] 45-01-PLAN.md — Backend: /federal/context live on Render (~30s deploy); additive source fields via LATERAL join (fan-out defect prevented). ⚠️ push side-effect: 91 pre-existing local EV-Accounts commits published — flagged to Chris
- [x] 45-02-PLAN.md — FederalLanding live: DeficitStrip + FirstSplitBands + ThisYearStrip + SourceChip; PlainLanguageSummary suppressed for federal only

**Wave 3** *(blocked on 45-02)*

- [x] 45-03-PLAN.md — LensToggle + per-dataset chips + ScaleToggle ($ / per-person / per-taxpayer — IRS Data Book VERIFIED: 162,754,810 returns FY2025) + MethodologyPanel (disclosure figures computed live from metrics)

**Wave 4** *(blocked on Wave 3)*

- [x] 45-04-PLAN.md — Sweep 6/6 PASS; Chris UAT: PASS with notes (React #310 hooks crash found+fixed; scale-formula disclosure + context intro added same-day)

### Phase 46: Sourced Explainer Pipeline v2

**Goal:** Every budget function and top agency has a plain-language explainer generated ONLY from fetched authoritative text, with its citation stored and displayed.
**Depends on:** Phase 45 (needs UI surfaces); pipeline can start after Phase 44
**Requirements:** SRC-01 through SRC-04
**Success Criteria** (what must be TRUE):

  1. enrichFederal pipeline fetches authoritative source text (agency congressional justifications via USAspending URLs, OMB descriptions) BEFORE generating; generation prompt contains only fetched text
  2. ~20 function + top-10 agency explainers live, each with displayed citation
  3. DoD entries carry an opacity flag with the official GAO/OIG audit citation
  4. Cost re-estimated before the run and logged; under the $5 gate (recon estimate: <$0.50)

**Plans:** 3 plans (2 waves)

**Wave 1**

- [x] 46-01-PLAN.md — Sources contract: function definitions from GAO-05-734SP App. IV (A-11 + PBDB guide are code-lists only; GAO acquired via WebFetch-passes-bot-wall discovery); 9/10 agency missions fetched (1 documented skip)

**Wave 2** *(blocked on 46-01)*

- [x] 46-02-PLAN.md — 27 explainers authored INLINE ($0 API) into committed data/federal-enrichment.json + loadFederalEnrichment.js; claim-trace audit 3/3 traced; 2 untraceable draft claims removed pre-load; production API serves citations
- [x] 46-03-PLAN.md — DoD audit opacity: GAO's verbatim disclaimer statement from the FY2025 Financial Report (fiscal.treasury.gov — better source than all 4 planned candidates); metric value=2 (no inferred history) + MethodologyPanel audit section + 2 enrichment sentences; 46-VERIFICATION.md 4/4 PASS

### Phase 47: Program Origins Pilot

**Goal:** 15–20 major programs show a sourced "details" section: enabling bill, public law, sponsor, year, cosponsors — every claim linked to Congress.gov/GovInfo.
**Depends on:** Phase 43 (program_details table); Phase 46 editorial standard
**Requirements:** ORIG-01, ORIG-02, ORIG-03
**Success Criteria** (what must be TRUE):

  1. Congress.gov + GovInfo free API keys in .env (Chris human-action checkpoint)
  2. 15–20 programs (e.g., Social Security, Medicare, Medicaid, SNAP, Pell) have details rows with structured origin facts, every claim carrying a working official-record URL
  3. Zero model-memory claims: every fact traceable to a fetched API response
  4. Safety line holds: official acts only — no personal info beyond sponsorship records

**Plans:** 3/3 plans complete

**Wave 1**

- [x] 47-01-PLAN.md — Pilot selection: ~18 programs live-probed (Congress.gov bill detail for modern; GovInfo STATUTE for foundational), mapping discipline enforced (fetched-title rule; skip-with-rationale), exact name_keys from SQL → 47-PROGRAMS.md

**Wave 2** *(blocked on 47-01)*

- [x] 47-02-PLAN.md — data/federal-programs.json (identifiers ONLY — facts come from APIs at load time) + loadProgramOrigins.js (deterministic structured fetch, zero LLM, key never logged); foundational rows: NULL sponsor + boundary note — 15 rows live

**Wave 3** *(blocked on 47-02)*

- [x] 47-03-PLAN.md — Backend exposure (additive) + ProgramOrigins drill-view card (every value an official-record link) + 47-VERIFICATION.md — PASS, production-verified

### Phase 48: Source-Chain Verification + UAT

**Goal:** Every federal claim in the app resolves to a working source link, and Chris confirms the experience end-to-end.
**Depends on:** Phases 45–47
**Requirements:** VERIFY-01, VERIFY-02
**Success Criteria** (what must be TRUE):

  1. Automated audit script walks every federal figure/text row and confirms its source URL returns 200 (report committed)
  2. Chris confirms: landing view, both lenses, deficit strip, explainers with citations, origins sections
  3. Chris confirms: no regression on city/county/state pages
  4. 48-VERIFICATION.md filed

**Plans:** 2/2 plans complete — **Phase 48 done; v2.0 build scope complete**

**Wave 1**

- [x] 48-01-PLAN.md — scripts/auditFederalSources.mjs: walk all 5 claim surfaces (~230 rows, ~40 unique URLs), per-domain strategy (govinfo via api.govinfo.gov — page status meaningless; congress.gov/bioguide/gao via Playwright content-match; friendly domains GET+UA), FAILs fixed at the data layer → 48-AUDIT.md committed with the HUMAN-CHECK residue list — **61/61 PASS, residue EMPTY**

**Wave 2** *(blocked on 48-01; human checkpoint)*

- [x] 48-02-PLAN.md — Automated production pre-flight (9/9) + 48-UAT-CHECKLIST.md → Chris sign-off "Looks amazing!" + 2 polish enhancements shipped (US-first flag tile, b0da716) → 48-VERIFICATION.md (VERIFY-01/02 PASS) — **v2.0 build scope complete**

</details>

---

<details>
<summary>✅ v2.1 Federal History (Phases 49-51) — SHIPPED 2026-06-14</summary>

Milestone audit **PASSED 8/8** (HIST-01..04, NAV-01/02, CTX-01/02). Full detail below; archived to [milestones/v2.1-ROADMAP.md](milestones/v2.1-ROADMAP.md).

**Milestone goal:** Bring every available prior federal fiscal year (FY1976→FY2024) up to v2.0 detail — function lens, agency lens, and revenue-by-source — with a working YearSelector, every figure sourced.

**Why it's cheap:** the 64-year headline history already lives in `federal_annual_summary`; explainers (name-keyed) and program origins (law-keyed) are year-independent and carry over for free. The work is mechanical — iterate the Phase 44 OMB loader across prior years, recompute per-year disclosures, load revenue per year, wire the YearSelector.

**Hard constraint (Chris, 2026-06-13):** $0 API spend — no paid APIs, no AI/LLM enrichment calls. Claude loads the free OMB historical tables directly. v2.1 has no enrichment work.

**Sources (all free, from v2.0 recon):** OMB Historical Tables — Hist 3.2 (outlays by function), Hist 4.1 / 5.1 (outlays by agency), Hist 2.x (receipts by source). Browser User-Agent required; openpyxl parses cleanly. Each table is one workbook holding all years as columns.

#### Phase Summary

- [x] **Phase 49: Historical Federal Data Backfill (FY1976–FY2024)** ✅ Complete 2026-06-13 — function (PBD), agency (rebuilt from PBD, not MTS), revenue (5 Hist 2.1 buckets) for every year + TQ; 150 budgets / 135,056 line items; per-year disclosures; every row sourced; $0 spend. TQ via period_label migration.
- [x] **Phase 50: Federal YearSelector Wiring** ✅ Complete 2026-06-13 — citizen selects any backfilled year (incl. the Transition Quarter as a distinct period); function/agency/revenue + landing bands + deficit strip all update. Backend exposes period_label (EV-Accounts); deployed to prod. UAT approved.
- [x] **Phase 51: Comparability Notes + Source-Chain Verification + UAT** — definition-drift + FY1976 TQ notes, every-figure-resolves audit across years, Chris sign-off.
 (completed 2026-06-14)

### Phase 49: Historical Federal Data Backfill (FY1976–FY2024)

**Goal:** Function, agency, and revenue-by-source detail is loaded for every fiscal year FY1976–FY2024, every row sourced, each year carrying its own visual-vs-official disclosure — at $0 API spend.
**Depends on:** Nothing new (reuses Phase 44 loaders + schema; US entity `0098c405-65e1-426f-8e5f-0fcbe2a900c0`)
**Requirements:** HIST-01, HIST-02, HIST-03, HIST-04, CTX-01
**Success Criteria** (what must be TRUE):

  1. Function (Hist 3.2), agency (Hist 4.1/5.1), and receipts-by-source (Hist 2.x) trees are queryable for each fiscal year FY1976–FY2024 with no gaps
  2. Each year's loaded totals reconcile to the OMB published table values (within rounding)
  3. Every loaded line-item row populates source_name / source_url / source_date — zero exceptions
  4. Each year stores its own visual-vs-official reconciliation disclosure (per-year excluded-negatives) — recomputed per year, not copied from FY2025
  5. Zero API/LLM spend (loaded directly from free OMB tables); re-running loaders is idempotent

**Cross-cutting constraints:**

- OMB xlsx downloads require a browser User-Agent
- Function/agency definitions drift over decades — preserve the source label per year; comparability notes land in Phase 51
- FY1976 Transition Quarter (TQ) is a distinct period in OMB tables — handle explicitly, don't fold into a fiscal year
- All-actuals span (FY1976–FY2024 are final); no estimate-vs-actual handling needed below FY2025

### Phase 50: Federal YearSelector Wiring

**Goal:** A citizen can select any backfilled fiscal year in the federal view and every panel — function, agency, revenue, landing bands, deficit strip — updates to that year.
**Depends on:** Phase 49
**Requirements:** NAV-01, NAV-02
**Success Criteria** (what must be TRUE):

  1. The federal YearSelector lists all loaded years (FY1976–FY2025) and switching years updates the function, agency, and revenue views
  2. The landing Mandatory / Discretionary / Net Interest bands and the receipts-vs-outlays deficit strip reflect the selected year's figures
  3. The source chip on each figure updates to the selected year's source
  4. No regression to the FY2025 default federal view or to city/county/state entities

### Phase 51: Comparability Notes + Source-Chain Verification + UAT

**Goal:** Historical years carry honest comparability context, every backfilled figure ties to its official OMB source, and Chris signs off before milestone close.
**Depends on:** Phases 49–50
**Requirements:** CTX-02
**Success Criteria** (what must be TRUE):

  1. Comparability notes are visible in-app explaining function/agency definition drift across decades and the FY1976 Transition Quarter (TQ)
  2. Automated source-chain audit confirms every backfilled year's figures resolve to a working OMB source URL (PASS, zero residue)
  3. Spot-check of representative years (e.g., FY1976, FY1990, FY2008, FY2024) confirms totals match the OMB published tables
  4. Chris UAT sign-off on historical year navigation and data accuracy

</details>

---

<details>
<summary>✅ v2.2 Orange County + Reusable SoCal Pipeline (Phases 52-57) — SHIPPED 2026-06-16</summary>

Hardened the bulk loader into a documented one-command SoCal county pipeline; loaded all 34 Orange County cities (operating + revenue, FY2003–2024) + the OC county-government budget; added statewide per-city salaries; verified against published ACFRs with Chris UAT sign-off. Audit PASSED 16/16. See [milestones/v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) | [v2.2-REQUIREMENTS.md](milestones/v2.2-REQUIREMENTS.md) | [v2.2-MILESTONE-AUDIT.md](milestones/v2.2-MILESTONE-AUDIT.md).

- [x] Phase 52: SoCal Bulk Pipeline Hardening (4/4 plans) — completed 2026-06-14
- [x] Phase 53: Orange County Operating + Revenue Load (1/1 plan) — completed 2026-06-14
- [x] Phase 54: Orange County Entity, Linking + Enrichment (2/2 plans) — completed 2026-06-15
- [x] Phase 55: Statewide City Salaries Integration (3/3 plans) — completed 2026-06-15
- [x] Phase 56: Orange County Verification + UAT (3/3 plans) — completed 2026-06-15
- [x] Phase 57: Orange County County-Government Budget (2/2 plans) — completed 2026-06-16

</details>

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Donate Button | v1.0 | 1/1 | Complete | 2026-04-21 |
| 2. Data Layer Audit | v1.0 | 1/1 | Complete | 2026-04-21 |
| 3. Webhook Backend | v1.0 | 5/5 | Complete | 2026-04-22 |
| 4. Live Feedback UI | v1.0 | 2/2 | Complete | 2026-04-22 |
| 5. Dallas Socrata | v1.1 | 3/3 | Complete | 2026-05-01 |
| 6. XLSX Pipeline | v1.1 | 3/3 | Complete | 2026-05-01 |
| 7. PDF/Haiku Vision | v1.1 | 3/3 | Complete | 2026-05-02 |
| 8. Data Quality | v1.2 | 3/3 | Complete | 2026-05-04 |
| 9. Revenue Completion | v1.2 | 3/3 | Complete | 2026-05-04 |
| 10. Collin County Expansion | v1.2 | 3/3 | Complete | 2026-05-21 |
| 11. Population & Per-Capita | v1.3 | 3/3 | Complete | 2026-05-21 |
| 12. Prosper + Celina Revenue | v1.3 | 3/3 | Complete | 2026-05-22 |
| 13. Richardson Operating Budget | v1.3 | 1/1 | Complete | 2026-05-22 |
| 14. Category Enrichment (5 cities) | v1.3 | 2/2 | Complete | 2026-05-22 |
| 15. Los Angeles Socrata + Enrichment | v1.4 | 3/3 | Complete | 2026-05-22 |
| 16. California Cities Expansion | v1.4 | 5/5 | Complete | 2026-05-22 |
| 17. Portland OR Budget Load | v1.5 | 4/4 | Complete | 2026-05-31 |
| 18. Portland Historical Operating | v1.5 | — | Complete | 2026-05-31 |
| 19. Portland Revenue Budget | v1.5 | — | Complete | 2026-05-31 |
| 20. Gresham OR Budget Load | v1.5 | 4/4 | Complete | 2026-06-01 |
| 21. Gresham OR Revenue Load | v1.5 | 2/2 | Complete | 2026-06-01 |
| 22. Troutdale OR Budget Load | v1.5 | 3/3 | Complete | 2026-06-02 |
| 23. OR All Funds Consistency | v1.5 | 4/4 | Complete | 2026-06-03 |
| 24. Los Angeles Data Refresh | v1.5 | 4/4 | Complete | 2026-06-03 |
| 25. LA County Data Completion + County-City Linking | v1.5 | 3/3 | Complete | 2026-06-03 |
| 26. Sacramento CA Data Load | v1.6 | 2/2 | Complete | 2026-06-04 |
| 27. Carry-forwards (Longview + STATE_LABELS) | v1.6 | 2/2 | Complete | 2026-06-04 |
| 28. Oakland + San Jose CA Data Load | v1.6 | 4/4 | Complete | 2026-06-05 |
| 29. Long Beach + Bakersfield CA Data Load | v1.6 | 4/4 | Complete | 2026-06-05 |
| 30. Fresno + Riverside CA Data Load | v1.6 | 4/4 | Complete | 2026-06-05 |
| 31. Anaheim + Santa Ana CA Data Load | v1.6 | 4/4 | Complete | 2026-06-06 |
| 32. State Entity Infrastructure | v1.7 | 4/4 | Complete | 2026-06-07 |
| 33. CA State Budget Data | v1.7 | 3/3 | Complete | 2026-06-07 |
| 34. 3-Level Tree Infrastructure (ev-accounts-api) | v1.7 | 1/1 | Complete | 2026-06-08 |
| 35. CA State 3-Level Icicle Pilot | v1.7 | 3/3 | Complete | 2026-06-08 |
| 36. Selective City Retrofit | v1.7 | 4/4 | Complete | 2026-06-09 |
| 37. MA Loader Hardening | v1.8 | 2/2 | Complete   | 2026-06-10 |
| 38. MA City Budget Load | v1.8 | 2/2 | Complete   | 2026-06-10 |
| 39. MA Population, State Budget, and Enrichment | v1.8 | 4/4 | Complete | 2026-06-10 |
| 40. MA County Seeding + City Linking | v1.9 | 1/1 | Complete | 2026-06-11 |
| 41. MA County Budget Load | v1.9 | 2/2 | Complete   | 2026-06-11 |
| 42. County Enrichment + Verification | v1.9 | 1/1 | Complete | 2026-06-11 |
| 43. Federal Entity + Sourcing Infrastructure | v2.0 | 3/3 | Complete | 2026-06-12 |
| 44. Core Federal Data Load | v2.0 | 5/5 | Complete | 2026-06-12 |
| 45. Federal Visualization | v2.0 | 4/4 | Complete | 2026-06-12 |
| 46. Sourced Explainer Pipeline v2 | v2.0 | 3/3 | Complete | 2026-06-12 |
| 47. Program Origins Pilot | v2.0 | 3/3 | Complete | 2026-06-12 |
| 48. Source-Chain Verification + UAT | v2.0 | 2/2 | Complete | 2026-06-13 |
| 49. Historical Federal Data Backfill (FY1976–FY2024) | v2.1 | 5/5 | Complete | 2026-06-13 |
| 50. Federal YearSelector Wiring | v2.1 | 4/4 | Complete | 2026-06-13 |
| 51. Comparability Notes + Source-Chain Verification + UAT | v2.1 | 4/4 | Complete | 2026-06-14 |
| 52. SoCal Bulk Pipeline Hardening | v2.2 | 4/4 | Complete   | 2026-06-14 |
| 53. Orange County Operating + Revenue Load | v2.2 | 1/1 | Complete    | 2026-06-14 |
| 54. Orange County Entity, Linking + Enrichment | v2.2 | 2/2 | Complete    | 2026-06-15 |
| 55. Statewide City Salaries Integration | v2.2 | 3/3 | Complete    | 2026-06-15 |
| 56. Orange County Verification + UAT | v2.2 | 3/3 | Complete   | 2026-06-15 |
| 57. Orange County County-Government Budget | v2.2 | 2/2 | Complete    | 2026-06-16 |

---

*Roadmap created: 2026-04-21*
*Last updated: 2026-06-17 — v2.4 Southern California Expansion shipped (Phases 63-67); v2.5 Utah Municipal Expansion roadmapped (Phases 68-73, ACTIVE). Next: `/gsd-discuss-phase 68`.*
