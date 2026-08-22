# SCOPE-04 — derived Total Governmental, and the enterprise slice

**Date:** 2026-08-21 · **Status:** design, awaiting review · **Branch:** `feat/scope-04` (proposed)
**Predecessors:** SCOPE-01 (`v2.24`), SCOPE-02 (`v2.25`), SCOPE-03 (`v2.26`).
**Read first:** `docs/superpowers/plans/SCOPE-04-HANDOFF.md`, then
`SCOPE-04-PUBLIC-UTILITIES-RULING.md` and `SCOPE-04-NEGATIVES-RULING.md` (PR #36, merged).

---

## The goal, in one sentence

**A reader can see how much of a city's "budget" is the tax-funded government and how
much is its utilities** — because today the app shows one number and cannot show the
difference.

Modesto FY2024 is the whole milestone in five lines:

```
All Funds            588,042,068   published
Total Governmental   291,641,122   derived      <- new
  enterprise slice   296,400,946   = the difference
     Internal Service 122.1M · Water 89.0M · Sewer 53.6M
     Other 15.5M · Solid Waste 14.5M · Airport 1.7M
```

**50.4% of Modesto's "city budget" is not the tax-funded city.** It is the water utility,
the sewer system, solid waste, the airport, and internal service funds — ratepayer-funded
businesses the city happens to operate. A reader comparing that $588M against a
neighbour's General Fund is comparing unlike things, and the app currently gives them no
way to see it.

It also delivers what Chris called the point of the arc: *"the transfer between an
enterprise fund and the general fund is where money gets quietly reclassified, and a tool
that only ever shows one total cannot show that movement."*

## Scale, re-measured against the live database 2026-08-21

The 2026-08-19 probe reproduces exactly.

| | |
|---|---|
| era-B `all_funds` rows (FY2017+) | **8,528** |
| ⚠ of those, rows with **no root categories at all** | **12** (all `total_budget = 0`) |
| rows with a usable root level | 8,516 |
| **eligible — has ≥1 enterprise/ISF root** | **7,664** across **488 entities** |
| skipped — no enterprise root | 852 |
| flagged — negative enterprise amount | 44 |
| of those, caught by `derived_TG <= all_funds` | 6 |
| `derived_TG <= 0` | 0 |

⚠ **Every `all_funds` row in the database is California** — 8,528 era-B and 14,752 era-A
rows across 533 entities, and **zero rows in any other state**. SCOPE-04 is a California
computation not by choice but because CA is the only state where TT holds all-funds
**root-level** data. One consequence, recorded so it is not rediscovered: the **CO DOLA
compendium cannot validate any of this** — there is no entity overlap. Its contribution
would be a *published* Total Governmental for Colorado, which is a separate load.

## Three decisions taken before design

1. **A derived figure declares itself in a dedicated column**, not in prose and not by
   forking `fund_scope`.
2. **SCOPE-04 writes derived Total Governmental rows only.** The enterprise slice is the
   difference; its components already exist as root categories.
3. **A stratified ACFR sample is tied to the dollar before any write.**

---

## 1. Schema and write path

### The column

```sql
ALTER TABLE treasury.budgets
  ADD COLUMN derivation text NOT NULL DEFAULT 'published'
  CHECK (derivation IN ('published','derived'));
```

The default is what makes this safe: all 79,939 existing rows become `published` without
being rewritten, so `figures_frozen` cannot move.

`fund_scope` keeps exactly one meaning — the axis SCOPE-01 and SCOPE-02 fought to make
honest. This matters because `total_governmental` is **already populated with 28,410
published rows**:

| source | rows | entities |
|---|---|---|
| Minnesota Office of the State Auditor | 21,794 | 945 |
| Ohio Auditor of State | 6,616 | 341 |

Without the column, a reader comparing Minneapolis against Modesto would see one label
for two epistemically different things.

⚠ **`derivation` deliberately does NOT join the unique index.** The index stays
`(municipality_id, fiscal_year, dataset_type, period_label, fund_scope, basis)
NULLS NOT DISTINCT`, which already lets a derived TG row coexist with the city's
`all_funds/actual` row. One city-year-dataset must never hold both a published and a
derived figure at the same scope — if a state ever publishes TG for a city we also derive,
that is a conflict to adjudicate, not a row to duplicate.

`derivation` also does **not** join the series identity. `(fund_scope, basis)` still
identifies a series uniquely; `derivation` is a property of it.

### The RPC

Extend `treasury_sync_city_budget` rather than bypass it — it is what populates
`budget_categories`, and reimplementing tree insertion for derived rows would fork the one
write path proven against 79,939 rows.

It currently takes 11 arguments and gains a 12th, `p_derivation text DEFAULT 'published'`,
so every existing loader keeps working untouched.

⚠ **The SCOPE-02 lesson applies literally.** Changing the argument list *creates a new
function* rather than replacing the old one — that is how the 9-argument overload survived
`CREATE OR REPLACE` and had to be dropped explicitly. The migration must
`DROP FUNCTION` the 11-argument signature and **assert exactly one version is callable
afterwards**. Two live versions would let a caller silently write `published` by resolving
to the wrong one.

⚠ Also inherited: `treasury_sync_city_budget` **never updates `data_source`** and keys on
`fund_scope`+`basis`, so writing a new scope **inserts** rather than overwrites. For
SCOPE-04 that is the desired behaviour, but it must be asserted, not assumed.

---

## 2. The computation and eligibility

### The derivation

Per `(municipality_id, fiscal_year, dataset_type)` `all_funds` row:

```
derived_TG = Σ root categories NOT matching /(enterprise|internal service)/i
```

**Σ-governmental, never `all_funds − enterprise`.** The two are algebraically identical
here — the probe found 0 of 23,260 rows where roots fail to sum to the stored total — but
Σ-governmental is **immune to enterprise-side defects**. That immunity is what turns the
44 negative-enterprise rows from a correctness problem in the figure into a disclosure
problem on the slice.

### The enterprise vocabulary is closed

All 13 era-B enterprise/ISF root names match the regex, including both typos:

```
Internal Service Fund · Sewer · Water · Other · Solid Waste · Airport · Transit ·
Electric · Harbor and Port · Hospital · Gas          (all "… Enterprise Fund")
⚠ Hospital Enterprise Fund Fund   (duplicated word, 84 rows, 11 entities)
⚠ Gas  Enterprise Fund            (double space,     78 rows, 10 entities)
```

`Public Utilities` (36 rows) and `Public Utilities and Other Expenditures` (409 rows) are
**governmental**, ruled in PR #36 and proven to the dollar against two audited ACFRs
(Cerritos FY2017 `69,951,331`, Lakewood FY2017 `57,831,166`). ⚠ The SCO feed points the
wrong way on this and must not be used to re-derive the ruling: the rows are utility-named
(`CURR_EXP_WATER`) but `CURR_EXP_*` is the *governmental* schedule. **Tie the total; never
match function names.**

### ⚠ The negative match is the one real hazard

Classification is a **negative** match: everything not matching the regex is governmental.
An allowlist of governmental names would be fragile — there are 38 of them with
punctuation variants (`Intergovernmental – State` and `Intergovernmental - State` both
exist).

But a negative match means a future enterprise-like root under a **new name** —
"Wastewater Utility Fund", say — would be silently counted as governmental and **inflate
TG with no arithmetic gate able to see it**. That is exactly the era-A failure shape
SCOPE-02 warned about: a figure too high, sitting between two correct years on a chart.

**Mitigation:** the loader commits the current 51-name era-B root vocabulary and **refuses
to derive on any unrecognised root name.** A new label stops the run; it never silently
reclassifies.

### Eligibility rules

* **Era B only (FY2017+).** ⚠ Era A is never derived — only 9.6% of its rows carry
  enterprise roots and the proprietary activity is smeared into function roots (Modesto
  FY2016: solid waste inside `Health`, transit inside `Transportation`).
* **Must have ≥1 enterprise/ISF root.** The 852 rows without one are skipped
  deliberately: derived TG would equal All Funds, and writing it would assert a second
  scope that does not exist.
* ⚠ **The 12 rootless rows are ineligible and reported by name, never silently skipped.**
  Hollister FY2022, Humboldt County FY2020 + FY2021, Mendocino County FY2022, Novato
  FY2022, Woodland FY2023 — each × operating and revenue. All have `total_budget = 0` and
  zero categories: the SCO returned nothing and the loader wrote an empty row anyway.
  **This is a pre-existing defect, not a SCOPE-04 concern** — those 6 city-years render as
  $0 today. Recorded as a follow-up.

### The derived row

* `fund_scope='total_governmental'`, `basis` inherited, `derivation='derived'`
* `hierarchy` = the governmental roots **carried over verbatim** — no re-nesting, no
  re-labelling, no re-parenting. Anything else would invent structure.
* `source_url` and `source_date` keep pointing at the real source, so the evidence stays
  auditable and the URL still resolves.
* **`data_source` gets its own label**, for the reason in the next subsection:

```
Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)
Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)
Treasury Tracker derived: Total Governmental (CA State Controller - County Expenditures)
Treasury Tracker derived: Total Governmental (CA State Controller - County Revenues)
```

⚠ **A colon, never an em-dash.** The API serves `data_source` **double-encoded** for every
em-dash label — Austin's included — so an em-dash here would render as mojibake in the
source chip. That defect is pre-existing and lives in `C:\EV-Accounts`; this label simply
must not step on it.

⚠ Even with an honest `data_source`, the UI marker is still a hard dependency rather than a
follow-up, because prose in a chip is not a machine-checkable claim — the reason
`derivation` exists as a column at all.

### ⚠ The stampers would otherwise un-derive these rows

Found during spec self-review, not during design, and it would have been a live defect.

`scripts/data/fundScopeRegistry.mjs` matches `/^CA State Controller - Expenditures$/` —
**anchored** — and maps that source to `all_funds`. Had the derived rows inherited the
parent's `data_source`, the next `classifyFundScope.mjs` run would have matched them and
**overwritten `total_governmental` back to `all_funds`**, silently converting 7,664 derived
figures into duplicate all-funds rows.

The `EXPECTED_ROWS` gate in `classifyFundScope.mjs` would have caught it loudly —
*"claims N rows, MORE than the … recorded — OVER-MATCHING, fix the pattern"* — which is
the guard working exactly as designed. But relying on a gate to catch a design error is
not a design.

The distinct label fixes it at the source, and it is also what SCOPE-01's rule requires:
**classification is per SOURCE with mandatory evidence.** So SCOPE-04 adds evidenced
entries to **all three registries**, as CO-SPRINGS did with `co-local-acfr-gf`:

| registry | new entry | value |
|---|---|---|
| `fundScopeRegistry.mjs` | `ca-sco-derived-tg` | `total_governmental` |
| `basisRegistry.mjs` | `ca-sco-derived-tg` | `actual` |
| `reportingEntityRegistry.mjs` | **no entry needed** | stays `unknown` |

Measured, so these are facts rather than assumptions: all **7,664** eligible rows are
uniformly `basis='actual'` and `reporting_entity='unknown'`, drawn from exactly **4**
distinct `data_source` values (SCO Expenditures, Revenues, County Expenditures, County
Revenues) — which is why there are 4 derived labels above. `reporting_entity` stays
`unknown` because the parent's is unknown; claiming anything else would be a guess.

⚠ **Zero eligible rows carry a `period_label`**, so `NULLS NOT DISTINCT` on the unique
index is unambiguous here and no Transition-Quarter case exists to reason about.

⚠ **`EXPECTED_ROWS` must gain the new entry in the same commit**, or the gate fails with
*"claims N rows but has no EXPECTED_ROWS entry — add it to the recon doc first"*.
⚠ And both stampers **write `unknown` on a FRESH row**, so a re-run must not un-classify
the derived rows — assert this, do not assume it.

### Gates, asserted per row

| gate | catches |
|---|---|
| `derived_TG > 0` | rootless / empty rows |
| `derived_TG <= all_funds_total` | ⚠ only 6 of the 44 negatives — not sufficient alone |
| negative `Operating Expenses` child under an enterprise/ISF root | all 16 material lines |
| every root name recognised, else refuse | a new enterprise label |

⚠ **Roots-sum-to-total is TAUTOLOGICAL** for these rows —
`scripts/bulkLoadStateController.js:163,173` computes `total = Σ roots`. It is recorded as
an internal-consistency check and **never** counted as validation. Brisbane passes it
while being overstated 18%.

### Quarantine — scoped to where the error is proven

The **governmental** tie is the discriminator.

| entity | action | why |
|---|---|---|
| Brisbane FY2017 | suppress TG | does not reconcile under any classification; `total_budget` overstated `5,348,719`. Duplication is in the SCO feed, so this is a **disclosure** problem — do not hand-subtract, that invents a figure no government published |
| Turlock FY2021 | suppress TG | governmental off `986,494` |
| Scotts Valley FY2021 | suppress TG | governmental off `35,668` |
| **Cerritos FY2017** | ⚠ **PUBLISH TG** | its governmental total ties **exactly** (`69,951,331`), so its derived TG is audited-correct. Only the ISF root and the all-funds total are wrong. Suppressing it would hide a figure we have proven right |
| Trinidad FY2019 | suppress TG | probable; ⚠ verification has failed to reach Trinidad twice |
| Pleasanton FY2022, Placentia FY2021 | publish as-is | audited negatives |

⚠ **Do not lean on the exact-equality duplicate screen.** It fires on 3 budgets
population-wide, which looks reassuring — but Brisbane's largest duplicate (the Marina,
`3,506,424`, hidden in `Culture and Leisure`) never tripped it, because the two figures
*differ*. No structural screen works either: a proprietary-named function line
co-occurring with its enterprise fund is **normal** — Cerritos and Lakewood both do it and
both tie exactly.

---

## 3. Verification, before any write

### The oracle

Each city's own audited **"Total Expenditures / Total Revenues, Governmental Funds"** — a
figure a government printed, wholly independent of the SCO feed.

Reuse rather than rebuild: extend `scripts/acfrPrintedTotal.py` with a target-column
selector so it reads the *Total Governmental Funds* column instead of the General Fund
one. It uses pdfplumber glyph coordinates and shares no code or strategy with the
`pdftotext -table` path, which is what makes agreement meaningful.
`scripts/acfrContinuedTotal.py` handles statements split across pages.

### ⚠ The tie test has THREE outcomes, not two

**Ties / source error / diverges legitimately.** Placentia FY2021 misses by $51M purely
because it reported a pension-obligation-bond contribution as debt-service expenditure
where GAAP puts it below the line. Signature: a `Debt Service` child over ~25% of total;
26 rows database-wide. A naive "must tie" gate would quarantine a **correct** figure. The
harness classifies into three buckets and reports which.

### The sample: 16 city-years, deterministic ordering

Stratified across the dimensions the failure modes might track:

| dimension | bands |
|---|---|
| size | 4 bands by `total_budget` quartile |
| dataset | operating **and** revenue — today's two proven ties are operating-only |
| enterprise share | low / high — Brisbane-type duplication may track heavy enterprise |

Cerritos FY2017 and Lakewood FY2017 ride along as **controls**: if the extended reader
disagrees with figures PR #36 already proved, the reader is wrong, not the data.

⚠ **Budget for ~40% unreachable.** CA city sites 403 automated fetches even with full
browser headers (Palm Desert, Livermore, Trinidad, Rolling Hills Estates); archive.org
rate-limits at 429. 16 targets may yield ~10 assessable. **Unreachable is recorded as
unreachable and never folded into the pass count** — that discipline is the only reason the
earlier 6/6 was honest. ⚠ Use `pdftotext -raw`, never `-layout`, which scrambles column
order in these ACFRs and attaches numbers to the wrong labels. ⚠ Anaheim's ACFR is in
thousands.

### The stopping rule, declared now

> Write only if **≥10 assessable city-years**, and **every** non-tie is explained either as
> a documented source error (→ quarantine that row) or a documented legitimate divergence
> (→ publish, signature recorded). **A single unexplained miss stops the milestone** and
> re-opens scoping.

⚠ No post-hoc reclassification of a miss into "legitimate" without a document. Declaring
this before the sample runs is the guard against curve-fitting — the error that got the
LA-01 verdict retracted, and the reason El Paso County needed a coordinate reader rather
than whichever strategy happened to tie at $0.

⚠ The current base rate is **6/6 assessed, 0 fail**, but n=6 puts the 95% upper bound on
the failure rate near 50%. Six samples is not proof of rarity.

**Artifacts:** `scripts/verifyDerivedTG.mjs` and a recon document under
`docs/superpowers/plans/`. ⚠ `docs/*` is gitignored — force-add.

---

## 4. API and UI honesty

### API (`C:\EV-Accounts`, not this repo)

`derivation` is invisible until it is added to the explicit SELECT lists. It must reach
both the budgets endpoint and `available_datasets` on `/treasury/cities`.

⚠ That second one grows the payload PR #51 just optimised — accepted deliberately. The
series pill must be able to say "derived" **at first paint**; a pill that renders unmarked
until a budget row loads is the mislabel window this milestone exists to close. The cost is
one low-cardinality enum on entries that already exist, and that endpoint measures **204 KB
brotli** against 12.3 MB raw, so a repeated short enum compresses to nearly nothing.

### UI (this repo)

* Copy lives in `src/data/fundScopeVocabulary.ts` — the established single reviewable home.
* Per PR #38's rule the derived marker is an **inert label**: plain text, not a chip, and
  it keeps its words. Wherever the source chip renders, the marker renders with it.
* The enterprise slice becomes a labelled grouping over root categories that already
  exist, showing `All Funds − TG`.
* ⚠ **No component tests are possible** — `vitest.config.ts` is `environment: 'node'` and
  never collects `.test.tsx`; such a file silently does not run. Logic goes in pure
  modules (the `spendVerb.ts` precedent) and is verified in the running app.

---

## 5. Rollout order — the ordering IS the design

1. **Migration** — column + CHECK, RPC 12th parameter, explicit `DROP` of the 11-argument
   signature, assert exactly one callable version. **Zero rows written.**
2. **EV-Accounts** — `derivation` into the SELECT lists. Shared database, so no deploy
   race: land the column, then surface it. Every existing row reads `published`, which is
   true.
3. **UI** — marker, vocabulary, enterprise grouping. With zero derived rows it is inert.
4. **Verification** — the 16-city sample. The stopping rule governs.
5. **Registries** — the three `ca-sco-derived-tg` entries plus the `EXPECTED_ROWS` entry,
   committed **before** the write so the first stamper run after it is already correct.
6. **The write** — 7,664 rows, quarantine applied.
7. **Recon** — invariants below, plus the gate report, plus a stamper re-run proving the
   derived rows keep `total_governmental` rather than being reclassified.

⚠ **The UI deliberately ships before the data.** Writing first would open a window in which
7,664 derived figures render as published, and given this arc's history that window is the
whole risk.

---

## 6. Invariants

* **`figures_frozen` must stay `3bc12db8bb7dd04c1602befd68d78020e39d333df75705f6f94d3c1a939d82a2`.**
  Derived rows are new rows, so the digest cannot move.
* ⚠ **Record the created ids explicitly** as `scripts/data/scope04CreatedIds.json`.
  SCOPE-02 learned that `created_at` is NULL on 79,899 rows, so a timestamp-based
  exclusion would silently exempt 99.96% of the table and make the invariant vacuous.
  7,664 ids ≈ 280 KB, a tenth of the artifact SCOPE-02 rejected. **An unrecorded id fails
  the harness loudly.**
* `unknown` counts on all three existing axes must not move. The derived rows are
  classified at write time and confirmed by the new registry entries, so they never pass
  through `unknown`.
* Row count moves **79,939 → 87,603** (+7,664, minus any quarantined). This is the one
  headline number that legitimately changes, and it must match the created-id file exactly.
* ⚠ Read paged queries with the primary key ordered last — 79,840 of 79,939 rows tie on
  `(muni, fy)`, and a paged read without it duplicated one row and skipped another while
  the count stayed right.

---

## 7. What this milestone is NOT

* **Not era A.** 14,752 rows stay `all_funds` only.
* **Not an enterprise series.** No fifth `fund_scope` value; the slice is the difference.
* **Not the payload projection.** Trimming `available_datasets` to a per-entity projection
  is the real structural fix for `/treasury/cities`, lives in `C:\EV-Accounts`, and stays a
  follow-up.
* **Not a fix for the 12 rootless $0 rows.** Reported, not repaired.

---

## 8. Repo traps that will otherwise cost an hour

* ⚠ **`npm run build` is the gate, never `npx tsc --noEmit`** — the latter does not build
  project references. `erasableSyntaxOnly` also bans constructor parameter properties
  (TS1294), which `npm test` will not catch.
* ⚠ **`npm run lint` never exits 0.** It is a broken gate.
* ⚠ **`docs/*` is gitignored** — a new doc is invisible unless `git add -f`'d. `.planning/`
  is not gitignored.
* ⚠ **`main` is branch-protected on the `build` check** — always PR.
* ⚠ **A stacked PR is untested until it points at `main`**: `build-check.yml` triggers on
  `pull_request` with `branches: [main]`, and retargeting a base does not re-fire it.
* ⚠ **`python`/`python3`/`py` on PATH are Windows Store stubs.** Real Python is at
  `%LOCALAPPDATA%\Python\pythoncore-3.14-64`.
* ⚠ **`npm run dev` piped to `head` dies** when the pipe closes; redirect to a log file. A
  killed parent shell can leave an orphaned vite holding port 5173.
* ⚠ **`budget_categories` is FLAT and holds every tree level** — sum the ROOTS
  (`parent_id is null`), never all rows, or totals come out 2–3× too high.
* The pre-commit NUL guard needs `git config core.hooksPath .githooks` once per clone.

---

## 9. Open questions for review

1. **Copy for the derived marker.** Proposed direction: the series label carries
   "Total Governmental · actuals" and the honesty line reads as *computed by Treasury
   Tracker from published components*, with the source chip still naming the SCO. Exact
   wording belongs in `fundScopeVocabulary.ts` and wants Chris's eye.
2. **Whether the 16-city sample should be widened** if the first pass yields fewer than 10
   assessable city-years behind WAFs — sample more targets, or proceed on fewer with the
   shortfall recorded?
3. **Cerritos FY2017's all-funds total is understated by `890,525`.** Its TG publishes, but
   the *slice* for that city-year will be wrong by that amount. Disclose per-row, or
   suppress the slice display for it while publishing TG?
