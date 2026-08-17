# SCOPE-01 closeout

**Branch:** `feat/scope-01` · **Date:** 2026-08-17 · **Status:** built and verified, awaiting UAT
sign-off. **Not tagged** — the v2.23 precedent is that nothing gets tagged before Chris signs off.

---

## The honest headline

**We could not classify a third of the app.**

26,523 of 79,927 rows — **33.2%, across 1,066 entities** — end this milestone marked
`scope not established`. That is the result, not a shortfall. Before SCOPE-01 every one of those
rows was displayed as though its scope were known and comparable; now the ones we have not verified
say so.

The second headline is that **the seam this milestone was built to expose is worse than the seven
cities we knew about.** The detector found 26, across 15 entities, including two that nobody had
listed and that carry **no disclosure anywhere in the app**:

| | Seam | Change |
|---|---|---|
| **Anaheim** | FY2024→25 operating | **−70.1%** |
| **Santa Ana** | FY2022→23 operating | **−62.5%** |
| **Nevada** (state) | FY2023→24 operating | **−57.5%** ($12.41bn → $5.27bn) |

Anaheim and Santa Ana are the 2nd and 4th largest seams in the database.

---

## What shipped

| | |
|---|---|
| `treasury.budgets.fund_scope` | `general_fund` · `total_governmental` · `all_funds` · `unknown`, CHECK-constrained, defaulting to `unknown` |
| Rows classified | **53,404 (66.8%)** from **8 evidenced registry entries** |
| Rows honestly `unknown` | **26,523 (33.2%)** across 1,066 entities and 2,084 source strings |
| Figures changed | **ZERO** — proven by digest, before and after |
| API | **LIVE in production** — merged (`112d4320`), pushed, deployed; live payload matches the DB exactly |
| UI | scope label + explainer, copy approved 2026-08-17 |

### The bucket tally

| `fund_scope` | Rows | % | Entities | Sources |
|---|---|---|---|---|
| `total_governmental` | 28,410 | 35.5% | 1,286 | 2 |
| **`unknown`** | **26,523** | **33.2%** | **1,066** | **2,084** |
| `all_funds` | 23,260 | 29.1% | 533 | 4 |
| `general_fund` | 1,734 | 2.2% | 54 | 1,734 |

**Six strings carry 51,670 rows; 2,084 strings carry the unclassified 26,523.** Coverage is cheap at
the head and expensive in the tail — which is why the tail is where `unknown` is the right answer
rather than a number to grind down.

⚠ **`general_fund` at 2.2% is not the end state.** MA DLS alone is 16,816 rows that are almost
certainly General Fund, blocked on one document. If MA lands, `general_fund` goes from 2.2% to
~23% and `unknown` drops to ~12%. The shape of this table is provisional.

---

## The eight classified sources, and what proves each

| Entry | Scope | Rows | Evidence |
|---|---|---|---|
| `ca-sco-city-exp` | `all_funds` | 10,438 | Modesto FY2024 ACFR. Governmental $291,641,122 + enterprise/ISF $296,400,946 = $588,042,068 = SCO's total **to the dollar** |
| `ca-sco-city-rev` | `all_funds` | 10,446 | Modesto FY2024 p.81. $322,089,879 + $321,804,947 = $643,894,826 **to the dollar** |
| `mn-osa` | `total_governmental` | 21,794 | Bloomington MN FY2022. Structural: enterprise on a separate sheet ($55.3M excluded), far above General Fund. ⚠ carries a reporting-entity residue, below |
| `oh-aos` | `total_governmental` | 6,616 | **The strongest evidence here.** The publisher prints General Fund and Total Governmental as *separate tabs of one file*; Columbus FY2024 stored = TotalGov exactly, 51.6% above the GF tab |
| `state-acfr-gf` | `general_fund` | 1,448 | Utah FY2024 **and** Connecticut FY2024, printed GF column, both sides, **exact** |
| `wa-sao` | `general_fund` | 286 | Spokane FY2019 **and** Tacoma FY2019, both sides, **exact**, in two different units |
| `ca-sco-county-exp` | `all_funds` | 1,188 | Stanislaus FY2024. $6 on $1.4bn — 0.0000% |
| `ca-sco-county-rev` | `all_funds` | 1,188 | ⚠ **The one entry without a dollar tie.** 0.547% residue, structural evidence, see below |

### The two entries a reviewer should look at hardest

**`ca-sco-county-rev`** is the only classification in the registry not backed by a dollar tie. It
rests on a 0.547% residue that decomposes across seven taxonomies with *mixed signs* (5 up, 3 down —
the signature of two schedules bucketing money differently, not of a missing fund), plus the
structural fact that the stored row contains $218.8M of enterprise and internal-service revenue as
root categories. The nearest rival scope is 29× further away. **A test asserts it stays the only
entry lacking a dollar tie.** What would overturn it: a second county probe whose residue is
concentrated in a fund-shaped line or one-directional in sign.

**`mn-osa`** is classified correctly on fund type but carries a **known reporting-entity residue**:
MN OSA consolidates HRA/EDA/TIF component units that city ACFRs present separately, running ~7%
high statewide and ~17–22% for TIF-heavy cities. Chris's decision was to classify now and model the
entity axis properly in SCOPE-02.

---

## What we could not classify, and why

| Family | Rows | Entities | Why it is `unknown` |
|---|---|---|---|
| **MA DLS** (4 sub-families) | **16,816** | 351 | **The single biggest gap.** Expenditures point clearly at General Fund (2.59% from the ACFR vs 20.35% from Total Governmental), but the DLS revenue report's `Transfers` column is an **all-governmental-funds** figure (+1.69% vs all-funds transfers, +414% vs GF transfers), making its published total a hybrid. The one probe available, Amherst, is a poor witness — regional school district. **Needs one ACFR from a town that runs its own schools;** Newton, Somerville and Arlington all returned HTTP 403 to scripted fetches. |
| CA publicpay | 7,682 | 482 | Compensation data, not a fund total. A structural probe is possible (enterprise departments in the GCC export prove all-funds coverage) but was not run. **479 of 482 of these cities pair it against the all-funds SCO total, so the "payroll as a share of spending" reading is sound today.** |
| VA APA | 608 | 161 | Revenue is Exhibit B *"Total **Local** Revenue"* and excludes intergovernmental aid — 59.6%–102.3% of expenditures depending on the locality. Not a scope problem: **incomplete, not unclassified.** The 304 revenue rows are hidden (`dataset_type = 'revenue_local_only'`). Expenditures also unresolved — Exhibit C includes Education, i.e. the school division. |
| Transparent Utah | 539 | 15 | Not probed. ⛔ **Must never be reconciled by querying BigQuery** — unpartitioned, every query full-scans, ~$132 surprise bill on 2026-06-19. The rows are already in Supabase; use a free SLC/Provo ACFR PDF. |
| Residual one-offs | 483 | 49 | 344 distinct strings, genuinely heterogeneous. Correctly `unknown`; 0.6% of the table is a proportionate place to stop. |
| City/county ACFR | 260 | 16 | Per-document strings needing per-document probes. |
| Other salaries/transactions | 59 | 7 | Not fund totals. |
| ACFR-ish, no scope in string | 42 | 6 | **Texas (20 rows) calls its principal fund the General *Revenue* Fund**, so the state pattern correctly misses it; King County (16) uses no em dash; plus 6 others. |
| State CAFR (pre-GASB-34) | 34 | 3 | FY2000–2002, a different statement on a different basis. Separate entry, separate evidence. |

---

## Every seam found — SCOPE-02's work queue

**26 seams, 15 entities.** Every one involves `unknown`; **zero are between two established
scopes**, so today's seam list is "classification incomplete", not "two known scopes in conflict".

### The seven required (acceptance test — a short count condemns the detector, not the data)

Long Beach −75.0% · Anaheim −70.1% · Riverside −66.4% · Santa Ana −62.5% · Oakland −59.4% ·
Fresno −44.5% · Bakersfield −43.2%. **All seven found, every drift ≤ 0.05 percentage points**
against figures CA-CITIES-01 measured independently.

### The nineteen the plan did not know about

| Entity | Seam | Change | Reading |
|---|---|---|---|
| **Nevada** (state) | FY2023→24 op | **−57.5%** | Largest unexamined seam, and a state node |
| **Long Beach** | FY2024→25 **rev** | **−77.5%** | *Worse than its −75.0% operating seam.* The seven were expenditure-side only |
| Anaheim / Bakersfield / Santa Ana | FY2024→25, FY2022→23 rev | −63.7% / −52.7% / −46.7% | Revenue twins of the known operating seams |
| **Kentucky** (state) | FY2022→23→24 | +19.9% then −6.5% | A one-year **notch**, not a handover — a different defect shape |
| CT / WI / MA (states) | FY2001→2002 | ±2–7% | **Benign** — the pre-GASB-34 boundary. Same GF concept, different basis |
| Los Angeles | FY2020→21 | −4.8% | As the plan predicted |
| **San Diego** rev / SF / San Diego op | FY2024→25 | **+16.6% / +0.7% / +0.8%** | Scope changes that go **up** or barely move |

⚠ **The queue splits in two, and conflating them wastes effort.** Large negative steps are genuine
scope breaks needing remediation. Small or positive steps mean the city's own-source figure is
probably all-funds too — those are **sources awaiting a registry entry**, not cliffs. Nobody should
be sent to "fix" San Francisco's 0.7%.

---

## Verification

| Harness | Result |
|---|---|
| `verify-fund-scope.mjs` | ✅ all checks — 8 entries evidenced, every row a legal value, both digests stable |
| `verify-scope-seams.mjs` | ✅ 7/7 required seams, 26 found |
| `verify-scope-duplicates.mjs --mutation-test` | ✅ reads zero live; fires on exactly the mutated city-year |
| `npm test` | ✅ **298 passed, 16 files** |
| `tsc --noEmit` + `vite build` | ✅ clean |

**No figure moved.** The `sha256(id | total_budget)` figure digest is unchanged at
`2d6b948f…946c`, and the row count, `sum(total_budget)`, category sums and line-item sums are all
identical to the pre-classification baseline.

> ⚠ The *composite* digest moved once, deliberately: it is keyed on `dataset_type`, and the VA
> revenue rows were relabelled. That is why the harness now carries **two** digests — one invariant,
> one change-detector. A digest keyed on a mutable label conflates "a figure moved" with "a label
> changed", and a harness that cries wolf gets ignored.

---

## What SCOPE-02 inherits

1. **A `reporting_entity` column** (`primary_government` / `incl_component_units` / `unknown`) —
   Chris's decision. State-collected forms consolidate component units city ACFRs present
   separately. **The comparison filter must then check BOTH columns.** Affects MN OSA, Ohio AOS,
   VA APA and MN counties ≈ 29,000 rows.
2. **The 26-seam queue**, split into real breaks vs classification gaps.
3. **MA**, 16,816 rows, blocked on one WAF-free ACFR.
4. **Three undisclosed seams** — Anaheim, Santa Ana, Los Angeles have no `cityBasisNotes` entry.
   Better: derive the disclosure from `fund_scope` and retire the hand-curated map, which drifts
   silently because nothing measures its completeness.
5. **VA Exhibit B1** — load intergovernmental aid so VA revenue becomes a whole-revenue figure,
   then reclassify and restore `dataset_type`.
6. **The index widening** and the read-path/summation guards, as originally planned.

---

## Open items before this can be called done

- [ ] **Chris's UAT sign-off.** Not tagged until then.
- [x] ~~Push EV-Accounts `master` so the API deploys.~~ **DONE — and it is LIVE in production,
      verified end-to-end 2026-08-17.** No push was actually needed: the merge had already reached
      `origin/master` (another session committed on top of it and pushed), and Render had deployed.
      Confirmed against the live API:
      - `GET /api/treasury/budgets/:id` returns `fund_scope`
      - `GET /api/treasury/cities` carries **79,927** `fund_scope` values — exactly one per row in
        the table
      - and the live distribution matches the database **exactly**: `total_governmental` 28,410 ·
        `unknown` 26,523 · `all_funds` 23,260 · `general_fund` 1,734.

      So the UI now renders real scopes rather than a uniform "scope not established", and UAT sees
      the intended end state.
- [ ] `.planning/STATE.md`, `ROADMAP.md`, `MILESTONES.md` on sign-off. **v2.21 and v2.23 both
      shipped without reaching `.planning/`; do not repeat that.**
