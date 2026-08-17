# SCOPE-01 — Reconciliation Evidence

The document of record for fund-scope classification. Every registry entry in
`scripts/data/fundScopeRegistry.mjs` must trace to a section here.

---

## Task 1 — Source family enumeration

**Measured 2026-08-17** against `treasury.budgets` via `mcp__supabase-local__execute_sql`.

```sql
select count(*) total_rows, count(distinct data_source) distinct_sources,
       count(distinct municipality_id) entities,
       count(*) filter (where data_source is null) null_sources,
       count(*) filter (where btrim(coalesce(data_source,'')) = '') empty_sources
from treasury.budgets;
```

| Metric | Value |
|---|---|
| Rows | **79,927** |
| Entities | **2,454** |
| Distinct `data_source` strings | **3,824** |
| Null `data_source` | 0 |
| Empty/whitespace `data_source` | 0 |
| Fiscal year range | 1976 – 2026 |

Row and entity totals match the plan. **The distinct-string count does not**: the plan's
Task 1 table implies 3,821 across its six families and, more importantly, its *grouping* is
wrong in three places. Those corrections are the substance of this task.

### 1.1 How the plan's table differs from the measured data

| Plan's family | Plan | Measured | Verdict |
|---|---|---|---|
| CA State Controller | 30,942 / 5 strings | 30,942 / 5 strings | Row count right, **but it is not one family** — see §1.3 |
| MN OSA | 21,794 / 1 | 21,794 / 1 | ✅ exact |
| Ohio AOS | 6,616 / 1 | 6,616 / 1 | ✅ exact |
| Transparent Utah | 539 / 1 | 539 / 1 | ✅ exact |
| ACFR (per-document) | 1,750 / 1,738 | 1,784 / 1,772 | Close; the shortfall is Texas + King County, §1.5 |
| Other | 18,275 / 2,075 | — | **Dissolved.** 16,816 of it is MA DLS in four sub-families, §1.4 |

**The headline correction: MA is the third-largest bloc in the database — 16,816 rows across
1,388 strings and ~351 towns — and the plan filed all of it under "Other."** It also contains
the one sub-family whose scope has no legal value in this milestone's CHECK constraint.

### 1.2 The candidate partition

Patterns are **ordered**; each row is claimed by the first pattern that matches. Regexes are
POSIX (`~`, case-sensitive unless noted) as measured; the `.mjs` registry will carry the
JS-`RegExp` equivalents.

| # | Proposed entry id | Match pattern | Rows | Strings | Entities |
|---|---|---|---|---|---|
| 1 | `ca-sco-city-rev` | `^CA State Controller - Revenues$` | 10,446 | 1 | 479 |
| 2 | `ca-sco-city-exp` | `^CA State Controller - Expenditures$` | 10,438 | 1 | 479 |
| 3 | `ca-sco-county-rev` | `^CA State Controller - County Revenues$` | 1,188 | 1 | 54 |
| 4 | `ca-sco-county-exp` | `^CA State Controller - County Expenditures$` | 1,188 | 1 | 54 |
| 5 | `ca-publicpay` | `^CA State Controller — Government Compensation` | 7,682 | 1 | 482 |
| 6 | `mn-osa` | `^Minnesota Office of the State Auditor` | 21,794 | 1 | 945 |
| 7 | `oh-aos` | `^Ohio Auditor of State` | 6,616 | 1 | 341 |
| 8 | `va-apa` | `^Virginia APA Comparative Report$` | 608 | 1 | 161 |
| 9 | `ut-transparent` | `^Transparent Utah$` | 539 | 1 | 15 |
| 10 | `ma-gf-exp` | ` — MA General Fund Expenditures$` | 6,843 | 351 | 351 |
| 11 | `ma-gf-rev` | ` — MA General Fund Revenues$` | 6,663 | 351 | 351 |
| 12 | `ma-dls-gf-rev-by-source` | ` — MA DLS General Fund Revenue by Source$` | 1,750 | 350 | 350 |
| 13 | `ma-dls-sched-a-srf` | ` — MA DLS Schedule A — Special Revenue Funds$` | 1,560 | 336 | 336 |
| 14 | `wa-sao` | `WA State Auditor` | 286 | 286 | 8 |
| 15 | `state-acfr-gf` | ` State ACFR — General Fund` | 1,448 | 1,448 | 48 |
| 16 | `state-cafr-gf` | ` State CAFR — General Fund` | 34 | 34 | — |
| 17 | `local-acfr-gf` | `(ACFR\|CAFR) — General Fund` (after 15–16) | 260 | 260 | — |
| 18 | *(no entry)* | ACFR-ish, string does **not** say "— General Fund" | 42 | 30 | — |
| 19 | *(no entry)* | Residual one-offs | 542 | 369 | 51 |

**Partition proof.** 60,499 (rows 1–9) + 16,816 (10–13) + 286 (14) + 1,784 (15–18) + 542 (19)
= **79,927.** Zero rows unclaimed, zero rows double-claimed. Verified by an ordered `CASE`
over the full table producing no `UNBUCKETED` bucket.

These are the counts Task 5's dry-run must reproduce. **A pattern claiming more than the number
here is over-matching — fix the pattern, do not accept the count.**

### 1.3 ⚠ "CA State Controller" is two unrelated sources sharing a prefix

The plan's Task 2 example registry uses `match: /^CA State Controller/i → all_funds`, evidenced
by the Modesto FY2024 reconciliation. **That pattern is unsafe as written.** It claims all
30,942 rows, and 7,682 of them are a different source entirely:

| `data_source` | `dataset_type` | Rows |
|---|---|---|
| `CA State Controller - Revenues` | `revenue` | 10,446 |
| `CA State Controller - Expenditures` | `operating` | 10,438 |
| `CA State Controller - County Revenues` | `revenue` | 1,188 |
| `CA State Controller - County Expenditures` | `operating` | 1,188 |
| `CA State Controller — Government Compensation in California (publicpay.ca.gov)` | **`salaries`** | **7,682** |

The Modesto reconciliation was against the SCO **Cities Annual Report** (revenues and
expenditures). It says nothing about **publicpay.ca.gov**, which is a compensation dataset
published by the same office under a different program. Letting the prefix carry the
reconciliation across would put 7,682 rows and 482 entities into `all_funds` on evidence that
was never gathered for them — precisely the failure mode this milestone exists to prevent.

**Two incidental discriminators, neither of which should be relied on:** the four financial
strings use an ASCII hyphen (` - `) and publicpay uses an em dash (` — `); and publicpay is the
only one with `dataset_type = 'salaries'`. The registry uses **fully anchored per-string
patterns** (entries 1–5) instead, so the distinction does not rest on punctuation.

### 1.4 MA DLS is four sub-families, and one of them has no legal scope value

| Sub-family | Rows | Strings | What the source is |
|---|---|---|---|
| `X — MA General Fund Expenditures` | 6,843 | 351 | GF expenditures, FY2002–2025 |
| `X — MA General Fund Revenues` | 6,663 | 351 | GF revenues, FY2002–2025 |
| `X — MA DLS General Fund Revenue by Source` | 1,750 | 350 | GF revenue detail, 5 FYs |
| `X — MA DLS Schedule A — Special Revenue Funds` | **1,560** | 336 | **Special Revenue Funds** |

The first three self-describe as General Fund. Self-description is a hint, not evidence — Task 4
still owes one reconciliation, and it can cover all three at once only if the reconciliation
actually tests all three.

**The fourth was a genuine gap in the milestone's value set.** Special Revenue Funds are a
governmental fund *type* that is by definition **not** the General Fund, **not** the total of
governmental funds, and **not** all funds. None of `general_fund` / `total_governmental` /
`all_funds` described these 1,560 rows across 336 towns. `unknown` would have been structurally
honest but semantically false: we know exactly what this source covers — there was simply no
value for it.

> **DECISION — Chris, 2026-08-17: add a fifth value, `special_revenue`.**
> The CHECK constraint becomes
> `('general_fund','total_governmental','all_funds','special_revenue','unknown')`.
> Rationale: we know what these rows cover, so recording it is the honest answer, and widening
> the constraint now is free where doing it after 79,927 rows are stamped costs a migration plus
> a reclassification pass. Leaving it `unknown` would also have made the family permanently
> unresolvable — no future reconciliation could move it, because there would be no value to move
> it to.
>
> **`special_revenue` is held out of cross-entity comparison exactly as `unknown` is** (Task 10
> Step 4 covers both). It is a fund slice, not a city total, so it must never sit on a per-capita
> axis beside one. This makes the exclusion rule *two* values, not one — Task 10 must not be
> written as `!== 'unknown'`.

### 1.5 ACFR per-document rows

1,784 rows / 1,772 strings / 68 entities. Overwhelmingly the completed state-ACFR arc, in a very
regular grammar: `{Entity} State ACFR — General Fund[ Revenue] (FY#### actual, GAAP basis)`.

| Shape | Rows | Strings |
|---|---|---|
| `… State ACFR — General Fund…` | 1,448 | 1,448 |
| `… ACFR — General Fund…` (cities/counties: Tucson, Sherwood, Bend…) | 260 | 260 |
| `… State CAFR — General Fund…` (pre-GASB-34, FY2000–2002) | 34 | 34 |
| ACFR-ish but the string names no scope | 42 | 30 |

The `pre-GASB-34 combined statement basis` suffix on the CAFR rows is the FY2002 boundary
already recorded in project memory; it is a **separate entry** (16) from the GAAP ones so the two
bases can be evidenced separately.

**The 42 rows that name no scope** are the ones a "the string self-describes" shortcut would
silently miss, so they are listed rather than summarised:

* **Texas — 20 rows.** `Texas State ACFR — General Revenue Fund (FY2015–FY2024 …)` and the
  matching `… General Revenue Fund Revenue …`. Texas calls its principal operating fund the
  **General Revenue Fund**, so the pattern ` ACFR — General Fund` misses all 20. They fall to
  `unknown`, which is safe, but Texas needs its own evidenced entry in Task 4 rather than being
  quietly absorbed into the state pattern.
* **King County — 16 rows.** `King County ACFR General Fund Operating/Revenue (GAAP actuals)`,
  plus two `(via Internet Archive)` variants. No em dash, so entries 15–17 miss them.
* **TX cities — 5 rows.** `Allen ACFR FY2025`, `Celina ACFR FY2025`, `Prosper ACFR FY2023/24/25`.
* **LA City — 1 row.** `LA City Revenue (ACFR)`.

### 1.6 Residual — 542 rows / 369 strings / 51 entities

| Shape | Rows | Strings | Note |
|---|---|---|---|
| True residual (no pattern) | 208 | 177 | Heterogeneous one-offs; correctly `unknown` |
| Per-city adopted budget doc (`X Operating/Revenue Budget[ FY####]`) | 165 | 129 | Sacramento, Dallas, SF, Plano, Fremont, Leonardtown… |
| Salaries / transactions datasets | 59 | 26 | See §1.7 |
| Open-data portal (`bloomington-open-data`, `cambridge-open-data`, Socrata) | 45 | 3 | |
| Indiana Gateway per-unit (`X Budget & Disbursements`) | 35 | 5 | |
| `Gresham All Funds Requirements FY####` | 17 | 17 | Self-describes as all funds |
| Register / checkbook (`X Check Register FY####`, payroll, demand) | 13 | 13 | See §1.7 |

No pattern is proposed for any of these. They are `unknown` until someone reconciles them, and
at 0.7% of the table that is a proportionate place to stop.

### 1.7 A prior question: is `fund_scope` meaningful for non-fund datasets?

`fund_scope` is defined as "which funds this row's total covers." Two `dataset_type`s hold
figures that are not fund totals at all:

| `dataset_type` | Rows | Entities |
|---|---|---|
| `operating` | 35,984 | 2,454 |
| `revenue` | 35,955 | 2,443 |
| **`salaries`** | **7,886** | 500 |
| `federal_agency` | 51 | 1 |
| `transactions` | 28 | 4 |
| `all_funds_requirements` | 17 | 3 |
| **`salary`** (sic — a second spelling, 1 string) | **6** | 1 |

**7,892 rows are compensation data** — 7,682 of them the publicpay source in §1.3.

> **CHRIS, 2026-08-17:** *"Are we able to document public pay? Many of our Treasury Tracker
> cities showcase public pay as a portion of Outgoing spend."*

That reframes the question, because a payroll figure shown **as a share of a spending total** is a
cross-scope comparison whether or not we label it one. Two findings:

**1. The denominator is already the right scope for almost every city.** Of the 482 entities with
publicpay rows, **479 draw their `operating` rows from `CA State Controller - Expenditures`** —
the same all-funds source the Modesto reconciliation covers. So "payroll as a share of Outgoing"
is all-funds payroll over an all-funds total: consistent, and the reading is sound.

The exceptions are the cities that also carry a General-Fund-only budget document — **Fresno**
(`Fresno General Fund Operating Budget FY2020/21`), **Bakersfield**, **Fremont**, **Sacramento**,
**San Francisco**, **LA City**. For those city-years the share is all-funds payroll over a
GF-only total, which **overstates payroll's share of spending**. Several are already on the
CA-CITIES-01 seam list, so this is the same defect surfacing through a second surface rather than
a new one. Recorded here as input to SCOPE-02.

**2. Yes, it can be documented — structurally, not by a dollar tie.** `scripts/loadCASalaries.js`
pulls `gcc.sco.ca.gov/RawExport/{YEAR}_City.zip` and aggregates **every** row for the employer
across all departments and positions. An exact tie against an ACFR is not realistically
available: CA ACFRs rarely publish total wages for all funds by object, and the nearest audited
figure — the pension note's *covered payroll* — is definitionally narrower, so it would tie
approximately at best.

**The reconciliation that does work is a structural one.** If the Modesto publicpay export
contains enterprise departments (Water, Sewer, Utilities), that is direct positive evidence the
dataset spans enterprise funds and therefore **cannot** be `general_fund`. Combined with GCC's
published all-employees reporting requirement, that establishes `all_funds`. It is real evidence
about the population rather than an inference from the source's title — and per project memory
enterprise/ISF is ~50% of Modesto, so the departments will be there or their absence is itself
the finding.

**Recommendation for Task 4:** attempt that structural reconciliation and record the department
list as the evidence. If enterprise departments are absent, publicpay stays `unknown` and the
absence is written up. Either way the ~7,900 compensation rows in Task 5's tally are a deliberate
outcome, not a coverage miss.

Also noted for whoever owns data hygiene: **`salary` (6 rows) is a typo of `salaries`** and
`all_funds_requirements` is a `dataset_type` encoding a fund scope. Neither is SCOPE-01's to fix.

### 1.8 Where Task 4 evidence is still owed

Every family above is `unknown` until reconciled. Nine entries can be written once their
evidence exists; two need a decision first.

| Entries | Blocked on |
|---|---|
| **2 `ca-sco-city-exp`** | **DONE** — Modesto FY2024, carried forward from CA-CITIES-01. See §2.1 |
| 1 `ca-sco-city-rev` | Its own reconciliation. **The Modesto tie is expenditure-side only** — §2.1 |
| 3–4 CA SCO county | Their own reconciliation against a COUNTY. Modesto is a city; the SCO Counties Annual Report is a different report — §2.1 |
| 5 publicpay | The **structural** reconciliation in §1.7 — enterprise departments in the Modesto export |
| 6–9, 14–17 | One reconciliation each, per Task 4's five-step method |
| 10–12 MA GF | One reconciliation that actually tests all three shapes |
| 13 MA Schedule A SRF | Unblocked — `special_revenue`, per the decision in §1.4. Still owes its reconciliation |
| 18–19 | Nothing. They stay `unknown` by design. |

Texas (§1.5) needs its own entry keyed on `General Revenue Fund`; it must not be absorbed into
entry 15.

---

## Task 2 — the matcher, and the first entry

`scripts/lib/fundScope.mjs` + `scripts/data/fundScopeRegistry.mjs`, 19 tests in
`tests/fundScope.test.mjs`.

### 2.1 `ca-sco-city-exp` → `all_funds`

**The one entry the registry ships with.** Carried forward from CA-CITIES-01 Task 6, which
measured it while trying to do something else and found this instead.

* **Source string:** `CA State Controller - Expenditures` (exact, anchored)
* **Rows claimed:** 10,438 across 479 entities, FY2003–FY2024
* **Independent document:** City of Modesto FY2024 ACFR
* **Reconciliation:**

| Component | FY2024 |
|---|---|
| ACFR General Fund | $191,311,703 |
| ACFR Total Governmental | $291,641,122 |
| SCO enterprise + internal service funds | $296,400,946 |
| Governmental + enterprise + ISF | **$588,042,068** |
| **SCO's reported total** | **$588,042,068** |

Ties **to the dollar**, so the SCO expenditure figure is citywide all funds. Corroborated
structurally: SCO's Modesto FY2024 tree carries `Water Enterprise Fund`, `Sewer Enterprise Fund`,
`Solid Waste Enterprise Fund`, `Airport Enterprise Fund`, `Other Enterprise Fund` and
`Internal Service Fund` at root level — every one outside the General Fund. Full working:
`CA-CITIES-01-RECON.md`.

### 2.2 Why its three sibling SCO strings got no entry

The plan says one reconciliation per source and no batching. The Modesto tie is **an expenditure
reconciliation against a city**, so it evidences exactly one of the four financial SCO strings.
Extending it to the other three would be classification by momentum — the same mistake as §1.3,
one level finer.

| String | Rows | Why not yet |
|---|---|---|
| `CA State Controller - Revenues` | 10,446 | Revenue side of a different statement. Overwhelmingly likely to be all funds too, and that is **precisely why it needs its own tie** — a confident guess is still a guess. Modesto FY2024 revenues vs the ACFR is the obvious probe. |
| `CA State Controller - County Revenues` | 1,188 | SCO **Counties** Annual Report — a different report with its own fund structure. Needs a county probe. |
| `CA State Controller - County Expenditures` | 1,188 | As above. |

So 22,260 of the 30,942 "CA State Controller" rows stay `unknown` after Task 2. That is the
evidence rule doing its job, not a gap.
