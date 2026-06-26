# Treasury Tracker / Empowered Vote Financials

## What This Is

A public-facing financial transparency platform for governments and nonprofits — cities, counties, states, and now the **US federal government** — deployed at treasurytracker.empowered.vote. It translates raw budget and transaction data into plain-language summaries, visual breakdowns, and searchable spending categories — making public finances accessible to everyday citizens. Federal data adds an always-sourced standard: every figure and explainer carries a link to its official record, and program-origin facts come structured from Congress.gov/GovInfo with zero model-memory claims.

## Core Value

Any citizen can open treasurytracker.empowered.vote and immediately understand where money comes from and where it goes — without needing a finance background.

## Current State

**Shipped v2.8 Ohio Local Government Expansion (2026-06-26).** Ohio cities + county governments brought onto Treasury Tracker at parity from the single uniform Ohio Auditor of State "Summarized Annual Financial Reports" XLSX (Hinkle System, ohioauditor.gov, free, no auth): **253 cities + 88 counties** loaded operating + revenue across FY2016–2025 (~6,616 budget rows), general-government revenue by source + expenditure by function, per-capita from `OI_Demographics`, every figure sourced. GAAP primary with CASH/MOD fallback (mixed basis per-entity); 253/253 cities linked to their parent county via the source `County` column under a new Ohio state navigation node; 51 state-neutral bleed-safe universal enrichment rows inline at $0. Phase 88 verified: Columbus + Franklin County reconciled (stored = the loaded `SOREACIFB` tab at $0 delta; `SOA_Gov` full-accrual cross-check deltas explained), a clean full-cohort source-chain audit (0 NULL/fragile/residue after two approved fixes), independent workbook re-derivation of 5 entities (0 mismatches), and a live-app UAT with Chris's sign-off. One accepted limitation: Ohio's flat AOS source yields no icicle drill-down (data correct; UX follow-up deferred). A mid-milestone county-workbook layout defect was caught by the independent re-derivation and fixed via gap-closure. $0 spend.

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

**Coverage now:** US federal + CA/MA state budgets, **253 Ohio cities + 88 Ohio counties** (op/rev FY2016–2025, enrichment, county-linked, under an Ohio state node), **162 Virginia entities** (independent cities + counties + towns, op/rev FY2023–2024, enrichment, county-linked, under a VA state node), 351 MA cities, all California cities across OC + LA + the 6 SoCal counties + their county governments, **10 Utah cities + 5 Utah county governments** (op/rev FY2014–2025, compensation, enrichment, county-linked), 12 named CA cities, 14 TX cities, 3 OR cities — every figure durably sourced.

<details>
<summary>Previous: v2.4 Southern California Expansion (shipped 2026-06-17)</summary>

All 6 remaining SoCal counties added via the hardened v2.2/v2.3 pipeline with zero new data-loading tooling: 95 cities loaded + county-linked (op/rev FY2003–2024), 8 county governments, statewide GCC salaries (FY2009–2024, $0-delta reconciled), 185 universal bleed-safe enrichment rows. Phase 67 verified: Ventura County ACFR reconciliation, source-chain audit (5,968 rows, 0 fragile/residue), 20-item UAT with Chris's sign-off. $0 spend.
</details>

<details>
<summary>Previous: v2.3 California Coverage Parity (shipped 2026-06-17)</summary>

Brought every already-loaded non-OC California city and county to the Orange County standard (FY2003 history, statewide salaries, standardized enrichment) via the hardened v2.2 pipeline. Phase 62 verified end-to-end: ACFR reconciliation, source-chain audit (0 NULL/fragile/residue across 25,568 rows), 24-item UAT with Chris's sign-off. SoCal expansion deferred to v2.4.
</details>

## Next Milestone: TBD

v2.8 Ohio shipped 2026-06-26. The next milestone is not yet defined — run `/gsd-new-milestone` to gather goals, research, requirements, and a roadmap. Candidate directions (from the backlog + carried-forward follow-ups below): broader Ohio entity coverage (townships/villages/libraries/schools — OHTWN-01) or enterprise funds (OHENT-01); another state expansion on the proven uniform-source + batch-driver mold; or a UI pass (incl. the deferred flat-source icicle leaf-click fix).

**Carried-forward follow-ups (candidates for a later milestone or backlog sweep):**
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

### Future (deferred milestone candidates)

- [ ] Votes/amendments exploration hub (the eventual mission destination)
- [ ] Backfill the always-sourced standard to city/state data (now proven federally)

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

## Shipped

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
*Last updated: 2026-06-24 — v2.8 Ohio Local Government Expansion STARTED. Bringing Ohio cities + county governments onto the tracker at parity from the single uniform Ohio Auditor of State Summarized Annual Financial Reports XLSX (Hinkle System, free, no auth): general-government revenue-by-source + expenditure-by-function (column→tree, flatter than CA/Utah), per-capita from OI_Demographics, city→county linking + Ohio state node, GAAP + CASH/MOD-fallback coverage, standardized bleed-safe enrichment inline at $0; verified via SOA_Gov/ACFR reconciliation + source-chain audit + Chris UAT. No salaries / enterprise funds deferred. Phases continue from 84, $0 spend target. (v2.7 Virginia SHIPPED + archived 2026-06-24.)*

<details>
<summary>Previous footer — v2.6 EV Financial Transparency Refresh SHIPPED (2026-06-22)</summary>

*Last updated: 2026-06-22 — v2.6 EV Financial Transparency Refresh SHIPPED. Empowered Vote's own organizational financials refreshed idempotently across GiveButter/Patreon/Benevity + bank + manual (no double-count); Beneficial State Bank authoritative for balance + expenses; platform income reconciled to net deposits within an explained tolerance; donor-facing transparency view; Phase 78 audit + Chris live UAT sign-off; every figure sourced, $0 spend. The "where the money goes" graphic (EVVIZ-01 / Phase 77) deliberately iceboxed.*

</details>
