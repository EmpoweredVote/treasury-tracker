# Knight Communities Seeding — Design

**Date:** 2026-08-28
**Status:** Approved design, pending implementation plan
**Baseline:** `main` @ `e100b1c`, v2.32

---

## 1. Purpose and provenance

Load Treasury Tracker coverage for the **26 communities where the Knight brothers owned newspapers** — the set the John S. and James L. Knight Foundation organizes its community program around — plus **Nashville, TN**, which is added independently because EV Essentials seeded it recently and TT has no Tennessee locals at all.

**Provenance note, recorded deliberately and dated.** These cities are being moved up the roadmap on **2026-08-28**, *before* any contact with Knight Foundation has taken place. Every one of them was already destined for TT under the existing national-coverage goal; this changes their order, not whether they happen. The rationale is recorded here so the sequencing is documented at the time it was chosen rather than reconstructed afterward, and so a later conversation with Knight cannot be mistaken for its cause.

The roster was verified against Knight Foundation's own published list (`https://knightfoundation.org/our-communities/`) rather than assembled from recall. That check mattered: the working list this began from included **Boca Raton, FL** and **Savannah, GA** — neither is a Knight community — and omitted **Aberdeen, SD** and **Biloxi, MS**, which are. The likely cause is conflating the Knight brothers' pre-1974 papers with Knight Ridder's later and larger footprint; the *Boca Raton News* was a Knight Ridder paper but not a Knight brothers one. **The official 26 is what this spec locks.**

---

## 2. Scope

### 2.1 The 27 primary entities

Knight distinguishes **8 "resident communities"** (a program director lives there) from the other 18. That distinction is used here only as a sequencing signal, never as an acceptance-bar difference.

| # | Entity | State | Resident? | TT status today |
|---|---|---|---|---|
| 1 | Akron | OH | yes | **Loaded** — OH AOS, FY2016–2025, operating + revenue, `total_governmental` |
| 2 | Charlotte | NC | yes | Missing |
| 3 | Detroit | MI | yes | Missing |
| 4 | Macon-Bibb | GA | yes | Missing (consolidated) |
| 5 | Miami | FL | yes | Missing |
| 6 | Philadelphia | PA | yes | Missing (coterminous city-county) |
| 7 | San Jose | CA | yes | **Partial** — GF budget FY2021–25 + salaries; no CA SCO series |
| 8 | Saint Paul | MN | yes | **Loaded** — MN OSA, FY2012–2023 |
| 9 | Aberdeen | SD | | Missing — new state |
| 10 | Biloxi | MS | | Missing — new state |
| 11 | Boulder | CO | | Missing |
| 12 | Bradenton | FL | | Missing |
| 13 | Columbia | SC | | Missing |
| 14 | Columbus-Muscogee | GA | | Missing (consolidated) |
| 15 | Duluth | MN | | **Loaded** — MN OSA, FY2012–2023 |
| 16 | Fort Wayne | IN | | Missing |
| 17 | Gary | IN | | Missing |
| 18 | Grand Forks | ND | | Missing |
| 19 | Lexington-Fayette | KY | | Missing (consolidated) |
| 20 | Long Beach | CA | | **Loaded** — CA SCO FY2003–2024 + derived total-gov + GF FY2025/26 + salaries |
| 21 | Milledgeville | GA | | Missing |
| 22 | Myrtle Beach | SC | | Missing |
| 23 | Palm Beach County | FL | | Missing (is itself a county) |
| 24 | State College | PA | | Missing (borough) |
| 25 | Tallahassee | FL | | Missing |
| 26 | Wichita | KS | | Missing |
| 27 | Nashville-Davidson | TN | n/a | Missing (consolidated) — **not a Knight community**; added independently |

**4 loaded, 1 partial, 22 missing**, across **14 states**.

### 2.2 Counties

Each Knight city's parent county is in scope. This resolves to **16 new entities**, not 27:

- **Already loaded (5):** Summit OH, Ramsey MN, Saint Louis MN, Santa Clara CA, Los Angeles CA
- **Coterminous — one entity, not two (5):** Philadelphia, Macon-Bibb, Columbus-Muscogee, Lexington-Fayette, Nashville-Davidson
- **Already the primary entity (1):** Palm Beach County FL
- **New (16):** Mecklenburg NC, Wayne MI, Miami-Dade FL, Manatee FL, Leon FL, Brown SD, Harrison MS, Boulder CO, Richland SC, Horry SC, Allen IN, Lake IN, Grand Forks ND, Baldwin GA, Centre PA, Sedgwick KS

Where a state yields a bulk source, its counties usually arrive in the same workbook — this is exactly why Summit and Ramsey are already loaded. Counties are therefore near-free in BULK states and one extra extraction in ACFR states.

⚠ **Counties must not be assumed to share the city layout.** Per `project_ohio_aos_county_vs_city_layout`, Ohio county workbooks differ from city workbooks in header row, column offsets, and available functions. Verify the county layout independently in every state.

**Total entity target: 43** (27 primary + 16 counties).

### 2.3 Out of scope

- School districts, special districts, transit authorities
- Enterprise funds where the source separates them
- Salaries datasets, except where a bulk source already carries them (CA publicpay)
- Backfilling `audit_grade` across the ~87,000 pre-existing budget rows (see 3.6)
- Any UI grouping, label, or page presenting these as "the Knight communities"

The last exclusion is deliberate. The product should show 43 more governments, indistinguishable in treatment from every other government in TT. The Knight framing is a sequencing rationale recorded in this document; it is not a feature.

---

## 3. Sub-project A — the audit grade

### 3.1 Problem

The acceptance bar for this campaign is **"best available per city, graded honestly."** TT cannot express the second half of that today. Source grade lives only in free text: Madison reads "(unaudited MFR)" because a human typed it into the source name.

This campaign makes the gap acute. Three different grades will sit side by side in one set readers compare directly: Akron and Duluth are state compilations of **self-reports**; Charlotte and the Florida four may be compiled from **audited statements**; Milledgeville and Grand Forks will be read straight from **audited ACFRs**.

### 3.2 The grade cannot live on `data_sources`

Measured on the live DB, 2026-08-28:

- `treasury.budgets`: **87,880 rows**, of which **984 (1.1%)** carry a `data_source_id`
- The remaining 98.9% are surfaced by ev-accounts building `data_source_info` from the budget row's own `data_source` / `source_url` / `source_date` columns (documented at `src/App.tsx:1411`)
- `data_sources.audit_verdict` is unrelated — phase-36 tree-depth genuineness notes, present on **8 of 1,814** sources

A grade on the source registry would be invisible for almost everything TT displays.

### 3.3 Design

Add **`audit_grade`** to `treasury.budgets`. It joins the existing family of per-row provenance columns — `fund_scope` (SCOPE-01), `basis`, `reporting_entity`, `derivation` (SCOPE-04) — which already reach the UI through `metadata.fundScope` / `basis` / `reportingEntity` in `src/types/budget.ts:180`. This is a fifth member of a proven pattern, not a new mechanism.

Per-row is also the *correct* representation independent of the plumbing argument: grade is a property of the document a row came from, and it varies by year within a single source name. Madison is the existing proof — the same publisher's series is audited in some years and unaudited MFR in others.

**Vocabulary** (following `reference_audited_bulk_sources_and_fdta`):

| Value | Meaning | Expected Knight entities |
|---|---|---|
| `audited_gaap` | Read directly from an ACFR bearing an auditor's opinion | Milledgeville, Grand Forks, Boulder, Wichita, Aberdeen, Biloxi |
| `compiled_from_audited` | State agency compiled it from audited statements | ~~Charlotte (NC LGC)~~ **REFUTED — see below**; **FL four + 3 counties (DFS) — CONFIRMED 2026-08-29**, see the progress file |
| `self_reported_unaudited` | State agency compiled entity self-reports | Akron (OH AOS), Duluth and Saint Paul (MN OSA) |
| `unknown` | Not yet assessed | All ~87,000 pre-existing rows |

> ⚠⚠ **RECON RESULT, 2026-08-28 — the NC LGC row above was WRONG.** The NC
> Treasurer's own Data and Reports page describes the AFIR dataset as **"Data
> self-reported by counties and municipalities"**, and N.C.G.S. § 159-33.1 has
> the local unit *submit* the report; the LGC receives and compiles it. Bulk
> access is also partial — direct downloads stop at **2011**, and 2012+ sits
> behind `logos.nctreasurer.com` with no export (the Colorado DOLA shape).
>
> Charlotte and Mecklenburg were therefore loaded from **their own audited
> ACFRs** and landed at **`audited_gaap`** — a grade ABOVE the one this table
> predicted, from a source WORSE than the one it predicted. Risk **R2** fired
> exactly as written, and §4.2's recon gate is what caught it before a loader
> was built.
>
> ✅ **FL DFS WAS the other unverified claim in the same reference — session 3
> verified it, and it HOLDS.** DFS's own LOGERx manual states Department staff
> "reconciles the AFR to the provided audited financial statements" before a
> filing becomes *Verified by DFS*. Florida is genuinely `compiled_from_audited`
> for entities with an audit on file, and that branch is identifiable per entity
> per year from a public report. ⚠ The statute and the rule ALONE read like a
> self-report and would have produced the NC answer — the manual is what settles
> it. See the Florida section of the progress file.

### 3.4 The default must be honest

**`NOT NULL DEFAULT 'unknown'`.** *(Revised 2026-08-28 during implementation. This section originally said "nullable, no silent default"; the reasoning below is why it changed.)*

`unknown` means "nobody has looked," never a stand-in for a guess.

The rule that matters is not "never default" — it is **a default is safe exactly when it is true of every existing row.** The `derivation` migration (`20260821000000_scope_04_add_derivation.sql`) is the precedent: `DEFAULT 'published'` was safe because every pre-existing row genuinely was published. `DEFAULT 'unknown'` is safe for the same reason — nobody has assessed any of the 87,880 rows, so it is true of all of them.

This is the **inverse** of `project_fysm_column_default_one_defect`, where `NOT NULL DEFAULT 1` asserted a fiscal-year start month — a *claim* about each entity's calendar that nobody had verified, which then read as fact on ~18,700 rows. `unknown` asserts the **absence** of an assessment, which is the truth. The distinction is the whole reason one is safe and the other was not.

`NOT NULL` rather than nullable is also deliberate: two ways to spell "no grade" (NULL and `'unknown'`) is an ambiguity every consumer would have to resolve.

The stakes justify the care: a row wrongly stamped `audited_gaap` is a false public claim about a government's books. SCOPE-01 set the precedent for shipping honestly — it went out at 33.2% `unknown` rather than guessing, and that was right.

**Enforcement is structural, not by test.** Two CHECK constraints on `treasury.budgets`:

- `budgets_audit_grade_check` — the value is in the vocabulary
- `budgets_graded_rows_need_a_source_url` — a row with a non-`unknown` grade must carry a non-empty `source_url`; ungraded rows are exempt, because `unknown` makes no claim needing justification

The second was planned as a vitest guard and could not be: **this repo's test suite never touches the database** (zero tests call `createClient`; CI runs `npm test` without credentials). A CHECK constraint is strictly stronger anyway — it holds on every write path, including the sync RPCs and every future loader, and cannot be bypassed by a loader that forgets to stamp or by a verification script nobody runs.

### 3.5 Evidence is mandatory

A loader may stamp a non-`unknown` grade **only** when the source itself states its basis:

- `audited_gaap` — the ACFR carries an independent auditor's opinion covering the statement the figures were read from
- `compiled_from_audited` — the state agency documents that it compiles from audited statements
- `self_reported_unaudited` — the agency documents that it compiles entity self-reports, or explicitly disclaims audit

Inference from a publisher's reputation is not evidence. Where a source is mixed — Colorado DOLA's "audit **or** exemption" is the known case — the grade reflects the weaker branch unless the specific entity's filing can be identified.

**Where evidence is recorded.** Two places, both required for a non-`unknown` grade:

1. **On the row** — `source_url` must point at the document or dataset the grade was read from. This is machine-checkable and is what the guard test in 5.4 asserts.
2. **In the progress file** (section 6) — a one-line quotation or citation of the statement that establishes the grade: the auditor's opinion line, or the agency's own description of what it compiles. This is what a reviewer reads to check the judgment, and it is the part that cannot be reconstructed later from the database alone.

This mirrors SCOPE-01's mandatory-evidence rule and should reuse its shape.

### 3.6 Scope of the slice

Populate `audit_grade` for **the Knight 43 only**. Pre-existing rows stay `unknown` and are backfilled later as separate work. This keeps the slice thin while giving SRCSTD-01 a working spine to grow into rather than a design done in the abstract.

### 3.7 Cross-repo dependency

`treasuryService.ts` lives in **ev-accounts, not this repo**. The column, the loader stamping, and the tests are all TT-side; *displaying* the grade needs a passthrough change there, the same one `fund_scope` and `derivation` each required. If that repo is unavailable in a given session, data still lands correctly graded and the UI catches up afterward. **The column is not blocked on the API; only the display is.**

Two display surfaces exist and both are in this repo:

- `SourceChip` (`src/components/federal/SourceChip.tsx`), gated by `showsSourceChip()` — which as of 2026-08-23 covers `city`, `municipality`, `town`, `township`, `county`, `state`, so every Knight entity renders it
- The "Data sourced from [name](url)" line in `src/components/dashboard/PlainLanguageSummary.tsx`

`src/data/sourceChipTypes.ts` carries a warning worth heeding here: membership of that set is "a REAL DEFECT SURFACE, not a detail" — `city` was missing for months, every gate stayed green, and no city showed provenance, because a missing chip moves no dollar figure. **The same is true of a grade that never renders.** Since this repo can run no component tests, an enumerated test over the vocabulary is the only guard available, and 5.4 requires one.

### 3.8 Relationship to SRCSTD-01

`.planning/SRCSTD-01-SCOPING.md` (captured 2026-07-06) scopes SRCSTD-01 as two things: a `source_url` backfill for ~24,700 city rows concentrated in MA DLS and CA publicpay, and a policy call on AI-generated explainer text. **It does not mention audit grade** — that insight postdates it, arriving in `reference_audited_bulk_sources_and_fdta` on 2026-07-28, which concludes the grade "is the real content of SRCSTD-01 and it is bigger than the backfill it's currently scoped as."

Sub-project A is therefore a **thin vertical slice of what SRCSTD-01 should become**, not a competing effort:

- It adds the column and proves the vocabulary against 43 real entities spanning all three grades
- It does **not** do the `source_url` backfill, the explainer policy call, or the ~87,000-row grade backfill
- The SRCSTD-01 scoping brief should be updated to absorb the grade dimension once this slice lands and the vocabulary has survived contact with real sources

Sequencing this way is deliberate: designing the grade against 43 known sources is tractable, designing it against 1,814 in the abstract is not.

---

## 4. Sub-project B — the seeding campaign

### 4.1 The unit of work is a state

Twenty-two missing cities sit in 14 states, but they cluster: FL 4, GA 3, IN 2, PA 2, SC 2, and nine states with one each. Loading Miami by hand teaches nothing about Tallahassee; a Florida source yields both, plus Bradenton, Palm Beach County, their three counties, and every other Florida locality thereafter.

### 4.2 The recon gate

Each state gets a bounded recon answering one question:

> Is there a free, no-auth, machine-readable statewide source at icicle grade?

Outcome is **BULK** (build a loader; unlocks the state) or **ACFR** (one-off extraction for the Knight entities only). `reference_ohio_aos_financial_data` is the template for running this well — it records the granularity check, the direct file-URL pattern, and the sheet structure.

**Recon is time-capped per state.** `reference_colorado_dola_compendium` is the cautionary case: excellent data, but access is a stateful PrimeFaces/JSF app behind a terms gate, with ToS language discouraging automation. When recon hits a wall of that kind, the answer is ACFR-for-one-city and move on — not build a scraper. A state may be re-opened later as its own milestone; that is a different decision from this campaign.

### 4.3 Sequencing by leverage

`reference_audited_bulk_sources_and_fdta` already flags **NC LGC** and **FL DFS** as *audit-derived* bulk candidates — agencies compiling from audited statements rather than self-reports. Between them they cover Charlotte, Miami, Tallahassee, Bradenton, Palm Beach County and four counties, and they would land at `compiled_from_audited`, a grade above what OH and MN can offer. Highest coverage and highest grade in the same two moves, so they go first.

| Session | Work | Primary entities |
|---|---|---|
| 1 | Grade slice + San Jose SCO backfill + grade/calendar the 4 loaded | 5 |
| 2 | NC recon → Charlotte + Mecklenburg | 1 |
| 3 | FL recon → Miami, Tallahassee, Bradenton, Palm Beach County + counties | 4 |
| 4 | GA recon → Macon-Bibb, Columbus-Muscogee, Milledgeville + Baldwin | 3 |
| 5 | PA + IN → Philadelphia, State College, Fort Wayne, Gary + counties | 4 |
| 6 | SC + TN → Columbia, Myrtle Beach, Nashville-Davidson + counties | 3 |
| 7 | MI + CO + KS → Detroit, Boulder, Wichita + counties | 3 |
| 8 | Orphans → Aberdeen, Biloxi, Grand Forks, Lexington-Fayette + counties | 4 |

Approximately **8 sessions, plus or minus 2**, depending on how many states yield a bulk source. The table is a shape, not a commitment; recon outcomes reshuffle it.

### 4.4 Sessions end whole

Each session runs recon → load → oracle → grade → calendar → commit → PR → worklist update. **No state is left half-loaded across a session boundary.** `main` currently has the property that nothing is half-finished; this campaign must not be what breaks it.

### 4.5 Consolidated governments

Macon-Bibb, Columbus-Muscogee, Lexington-Fayette, Nashville-Davidson and Philadelphia are single governments performing both city and county functions. Each is **one entity**, with `entity_type` and `county_id` set to reflect that. Creating both a city and a county row for these would double-count them in any state or national rollup.

### 4.6 Fiscal calendars

**All 43 entities go through the FAC census.** The machinery exists — `buildFacFiscalYearCensus.mjs` and `censusGuard()` from PRs #101–103, covering 1998–2026 via the bulk CSV. These are 14 states, nearly all never censused. All 43 are far above FAC's $750k filing floor, so coverage should be complete.

Two rules carried from that arc:

- **Never carry a target month between states** (`project_fysm_column_default_one_defect`)
- **Resolve the month per row, not per entity** — entities change fiscal calendars mid-series (`project_ca_fiscal_calendar_audit` found two)

---

## 5. Verification and acceptance

### 5.1 Definition of done, per entity

1. Entity exists with correct `name`, `state`, `entity_type`, `population`, `county_id`
2. At least one dataset loaded (`operating` and/or `revenue`)
3. Every money column tied to an **independent oracle** (5.2)
4. `fund_scope` and `basis` set from the source, not inferred
5. `fiscal_year_start_month` verified per row against the FAC census
6. `audit_grade` stamped with recorded evidence, or honestly `unknown`
7. `source_url` and `source_date` present
8. Renders correctly in the UI, including drill-down where the source is not flat

### 5.2 The oracle rule

`project_austin_travis_onboarding` states it plainly: **a DB check that `total = Σ items` is tautological.** Every load needs a check external to the write path — the publisher's printed total, a portal aggregate, an independent `sum()` against the source API, or the ACFR statement total.

**Oracle every money column independently, not just the headline.** `project_dallas_zero_total_broken_rollup` found a broken rollup that a headline-only check passed.

### 5.3 Known traps to assert against

- **Units** — Austin files in thousands; Seattle and King County in thousands. A unit error ties at $0 while being 1000x wrong.
- **Sign inversion** — `project_adopted_budget_inversion_sweep` found this across 106 sources. Drive from the data, not the code pattern.
- **Label welding** — `project_bainbridge_kitsap_scoping`: a rendered margin rule welds onto a label and still ties at $0. Assert label surfaces.
- **Dash-zero rows** corrupting labels (Oregon).
- **`treasury_sync_city_budget` is not source-safe** — it never updates `data_source` and will overwrite or silently insert a duplicate (`project_sync_city_budget_not_source_safe`).
- **Paged reads must order by the PK last**, and a Supabase RPC caps at 1,000 rows over PostgREST (`reference_paged_reads_need_total_order`); use `scripts/lib/listAllSources.mjs`.

### 5.4 Tests

Tests go in `tests/`, **not** alongside scripts — `scripts/*.test.mjs` are outside the vitest globs and do not run (`reference_ci_and_io_test_timeouts`). TT can run no component tests; a `.test.tsx` will not execute (`reference_no_component_tests_vitest`).

At minimum:

- A guard asserting no row carries a non-`unknown` `audit_grade` without a recorded `source_url`
- Per-state loader tests following the `loadOhioAOS.test.mjs` / `loadMNOSA.test.mjs` shape
- A campaign-coverage test enumerating the 43 and reporting status, so drift across sessions is visible

### 5.5 UAT

Follow the TT UAT how-to in `project_nc_durham_asheville_onboarding`, and drive the browser per `project_local_ui_verify_workflow`. UAT at least the first BULK state and the first ACFR state; per-entity UAT thereafter is by judgment.

---

## 6. Cross-session worklist

This campaign spans roughly 8 sessions, so its state must survive context loss.

- **`.planning/KNIGHT-COMMUNITIES-PROGRESS.md`** — tracked in git, one row per entity: status, source, grade, grade evidence, oracle result, PR. Updated at the end of every session, in the same commit as the work. (`.planning/` is the repo's tracked convention for scoping and recon documents — `docs/*` is gitignored apart from an explicit re-include list, so nothing under `docs/superpowers/` would have been committed at all.)
- **A `project_knight_communities_seeding` auto-memory** — the durable hook, with a pointer to the progress file and the current state. Linked from `MEMORY.md` and from `project_pick_up_next`.

The progress file is authoritative; the memory is the index that finds it.

---

## 7. Risks and open questions

| # | Risk | Handling |
|---|---|---|
| R1 | Some states have no usable source; a city lands with one adopted-budget PDF and no actuals | Accepted under "best available, graded honestly." The grade column is what makes the unevenness honest rather than embarrassing. Aberdeen, Biloxi, Grand Forks are the likely cases. |
| R2 | NC LGC / FL DFS turn out not to be audit-derived, or not bulk-downloadable | Recon confirms before the grade is stamped. If they fail, those cities drop to ACFR and the grade drops accordingly — no assumption is written into the loader. |
| R3 | ev-accounts unavailable, so the grade never reaches the UI | Data still lands correctly; only display lags. Track as an explicit follow-up rather than blocking loads. |
| R4 | County workbook layouts differ from city layouts and are loaded on the city assumption | 2.2 — verify county layout independently per state. Ohio already burned this. |
| R5 | Recon ratholes on a gated source (the DOLA shape) | Hard time cap; fall back to ACFR for the one city. |
| R6 | Eight sessions of loads regress something already green | Every session ends with the full test suite (1,382 tests at baseline) and a PR, never a direct push to `main`. |
| R7 | Consolidated governments double-counted as both city and county | 4.5 — one entity, explicit `entity_type`. |

### Open questions

- ~~**Q1** — Does Indiana Gateway already back Bloomington and Monroe County?~~ **RESOLVED 2026-08-28.** `docs/indiana_gateway_reference.md` (generated 2026-03-27) already documents Gateway's statewide CSV exports covering all Indiana budget units — 284,944 rows in `detailedExpenditures_2025.csv`, 39,128 in `detailedrevenue_2025.csv`. Fort Wayne (Allen) and Gary (Lake) should be reachable from the same files, so **Indiana is presumptively BULK and session 5 gets cheaper.**
  ⚠ **But the basis differs.** Gateway is *adopted budget* data — "Budget form 4A: published & approved amounts", "Adopted revenue budgets by fund and revenue source" — not audited actuals. So Indiana rows land as `basis='adopted'`, not comparable to the OH/MN actuals series, and their `audit_grade` is `self_reported_unaudited` at best pending evidence. Confirm before loading; do not let the convenience of an existing recon paper over a basis mismatch.
- **Q2** — Should Nashville-Davidson be distinguished from the Knight 26 anywhere in the product? Current answer: no — 2.3 excludes any Knight-specific UI, so the question is moot unless that changes.

---

## 8. Constraints carried from project policy

- **Free public data only.** Stop and get approval before any AI/API spend that could exceed **$5** (`feedback_api_cost_threshold`). EV is all-volunteer.
- **Never push directly to `main`** — branch and open a PR (`feedback_prs_not_direct_pushes_to_main`).
- **DDL via `mcp__supabase-local__apply_migration`**, then verify (`feedback_supabase_migration_mcp`).
- **Always-sourced.** Every displayed figure carries a source chip; nothing unsourced ships (`project_federal_tracker_ground_rules`).
- Worktrees are unsafe in this repo — `.env` is gitignored (`project_acfr_recon_structure_unreliable`).

---

## 9. Next step

Invoke the writing-plans skill to produce the implementation plan for **session 1**: the `audit_grade` slice, the San Jose CA SCO backfill, and grading plus FAC calendar verification for the four already-loaded cities and their five already-loaded counties.
