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

---

## Task 3 — the column, and the pre-classification baseline

Migration `supabase/migrations/20260817000000_scope_01_add_fund_scope_to_budgets.sql`,
applied 2026-08-17 via `mcp__supabase-local__apply_migration`.

### 3.1 Verification

| Check | Expected | Observed |
|---|---|---|
| Bucket tally after the ALTER | one row, `unknown`, 79,927 | ✅ `unknown` 79,927 |
| Unique index unchanged | `(municipality_id, fiscal_year, dataset_type, period_label) NULLS NOT DISTINCT`, **without** `fund_scope` | ✅ byte-identical to the pre-migration definition |
| EV-Accounts API still serves | rows returned | ✅ `/api/treasury/cities` 200 (6.0 MB); `/api/treasury/budgets/:id` 200 |
| `fund_scope` visible to the API | **no** — explicit column lists | ✅ absent from the `/budgets/:id` payload |

That last line is the Task 9 premise confirmed by measurement rather than assumed: the column is
inert to EV-Accounts until that repo edits its SELECTs, so there is no deployment ordering to
coordinate.

### 3.2 The CHECK constraint was mutation-tested, not just declared

A `DO` block attempted both directions against a real row and rolled everything back by raising:

* `fund_scope = 'enterprise'` → **rejected** with `check_violation`;
* `fund_scope = 'special_revenue'` → **accepted**, confirming the fifth value is live;
* post-test tally re-read as `unknown` 79,927, so nothing persisted.

A constraint whose rejecting branch has never fired is a constraint nobody has tested.

### 3.3 Baseline digest — the no-figure-moved proof (Task 8 Step 1)

Captured **before** the ALTER and re-read **after** it. Task 8 Step 2 compares against these
after classification.

```sql
select encode(sha256(convert_to(string_agg(
    municipality_id::text||'|'||fiscal_year||'|'||dataset_type||'|'||
    coalesce(period_label,'~')||'|'||coalesce(total_budget::text,'~'),
    E'\n' order by municipality_id, fiscal_year, dataset_type, coalesce(period_label,'~')
),'UTF8')),'hex') from treasury.budgets;
```

| Quantity | Value |
|---|---|
| **budgets digest** | `dd0e38c3929962b327d422248bdae674d7d4f7fa0897dc5349bf2aaab2cce9eb` |
| budgets rows | 79,927 |
| `sum(total_budget)` | 428,747,469,605,648.9717892247930625 |
| `budget_categories` rows | 2,996,331 |
| `sum(categories.amount)` | 1,075,508,399,196,974.2350521496230479146743508120132 |
| `sum(categories.actual_amount)` | 127,677,364,661.84000676594967362632455676794 |
| `budget_line_items` rows | 2,316,190 |
| `sum(line_items.approved_amount)` | 6,514,021,616,896.127803851694196372522501469174039 |
| `sum(line_items.actual_amount)` | 390,470,591,587,787.130002875594196372522501469174039 |

**The digest is identical before and after the migration**, so adding the column moved nothing.

Incidental confirmation that the Task 2 evidence matches the stored data: Modesto FY2024
`operating` holds `total_budget = 588042068` with `data_source = 'CA State Controller -
Expenditures'` — the same $588,042,068 the ACFR reconciliation lands on.

---

## Task 4 — per-source reconciliation

One reconciliation per source, against an independent document, committed one at a time.
Sources that come out `unknown` are recorded here too — a mismatch is a finding, not a failure.

### 4.1 `ca-sco-city-rev` → `all_funds`

* **Source string:** `CA State Controller - Revenues` (exact, anchored)
* **Rows claimed:** 10,446 across 479 entities, FY2003–FY2024
* **Probe:** City of Modesto FY2024
* **Independent document:** `docs/Modesto/modesto-fy2024.pdf` p.81, governmental-funds Statement
  of Revenues, Expenditures and Changes in Fund Balances. Read with `pdftotext -table`
  (`-layout` misaligns this document — see the header of `scripts/extractModesto.py`).

| Component | FY2024 |
|---|---|
| ACFR General Fund revenue | $225,256,710 |
| ACFR **Total Governmental** revenue | $322,089,879 |
| SCO enterprise + ISF revenue | $321,804,947 |
| Governmental + enterprise + ISF | **$643,894,826** |
| **SCO's reported total** | **$643,894,826** |

**Ties to the dollar.** The SCO enterprise + ISF figure is the sum of the six root-level fund
categories stored against the SCO revenue row: Internal Service $117,449,007 + Water $92,984,900
+ Sewer $74,992,280 + Solid Waste $17,525,194 + Other $16,688,643 + Airport $2,164,923.

**Two independent confirmations that the right column was read**, since a tie can be produced by
reading the wrong column and getting lucky:

1. The statement's five governmental columns sum internally to the same $322,089,879
   (225,256,710 + 26,243,630 + 10,520,886 + 32,689,325 + 27,379,328).
2. ACFR General Fund revenue alone is $225,256,710 — 35% of the SCO figure — so the SCO revenue
   row is definitively **not** General Fund.

**Verdict: `all_funds`.** Same shape and the same direction as the expenditure tie in §2.1,
established separately rather than inherited from it.

### 4.2 `ca-sco-county-exp` → `all_funds`

* **Source string:** `CA State Controller - County Expenditures` (exact, anchored)
* **Rows claimed:** 1,188 across 54 CA counties, FY2003–FY2024
* **Probe:** County of Stanislaus FY2024 — chosen because it is Modesto's own county, so a
  structural difference between the SCO Cities and Counties reports shows up against a document
  from the same region and the same fiscal calendar.
* **Independent document:** `docs/StanislausCounty/stanislaus-county-fy2024.pdf` p.23, fetched
  from `stancounty.com/auditor/pdf/cafr2024.pdf`. ⚠ This PDF is an OCR'd scan (Acrobat Paper
  Capture); the statement tables read cleanly under `pdftotext -table`, and every column total
  was re-derived from its own components rather than trusted, precisely because it is OCR.

| Component | FY2024 |
|---|---|
| ACFR General Fund expenditures | $391,233,183 |
| ACFR **Total Governmental** expenditures | $1,194,047,359 |
| SCO enterprise + ISF | $207,325,063 |
| Governmental + enterprise + ISF | **$1,401,372,422** |
| **SCO's reported total** | **$1,401,372,428** |

**A $6 difference on $1.4 billion — 0.0000%.** Treated as a tie. $6 is far below any plausible
scope effect and is consistent with a single OCR digit or a rounding artifact in one component.

**The county report has the same structure as the cities report.** SCO's Stanislaus row carries
`Internal Service Fund`, `Hospital Enterprise Fund Fund`, `Solid Waste Enterprise Fund` and
`Other Enterprise Fund` as root-level categories — $207,325,063 of funds that cannot appear in a
General Fund figure. This was checked before the document was fetched, and it is what made
Stanislaus worth fetching.

**Candidate scopes ranked**, so the tie is shown to be unambiguous rather than merely close:

| Candidate | Value | Off by |
|---|---|---|
| **all_funds** | $1,401,372,422 | **0.0000%** |
| total_governmental | $1,194,047,359 | 14.79% |
| general_fund | $391,233,183 | 72.08% |

Verified internally: the ACFR's six governmental columns sum to $1,194,047,359
(391,233,183 + 0 + 182,156,933 + 317,132,663 + 1,648,627 + 301,875,953), and the SCO row's ten
root categories sum to $1,401,372,428 exactly.

**Verdict: `all_funds`.**

Incidental data-hygiene note, not SCOPE-01's to fix: the SCO county loader produces
`Hospital Enterprise Fund Fund` with a duplicated suffix.

### 4.3 `ca-sco-county-rev` → `all_funds` — the one classification without a dollar tie

**Flagged as the weakest entry in the registry.** Everything else here ties to the dollar or to
within $6. This one does not, so the argument is set out in full and a test asserts it remains
the only such entry.

* **Source string:** `CA State Controller - County Revenues` (exact, anchored)
* **Rows claimed:** 1,188 across 54 CA counties, FY2003–FY2024
* **Probe and document:** the same County of Stanislaus FY2024 ACFR p.23 as §4.2

| Component | FY2024 |
|---|---|
| ACFR General Fund revenue | $470,677,648 |
| ACFR **Total Governmental** revenue | $1,201,293,821 |
| SCO enterprise + ISF revenue | $218,811,429 |
| Governmental + enterprise + ISF | $1,420,105,250 |
| **SCO's reported total** | **$1,427,912,802** |
| **Residue** | **$7,807,552 — 0.547%** |

#### Why this is still `all_funds` and not `unknown`

**1. It is decisive between the candidates, not merely close to one.**

| Candidate | Value | Off by |
|---|---|---|
| **all_funds** | $1,420,105,250 | **0.547%** |
| total_governmental | $1,201,293,821 | 15.87% |
| general_fund | $470,677,648 | 67.04% |

The nearest rival is 29× further away. There is no reading of this data on which the SCO county
revenue row is a General Fund figure.

**2. The residue is a taxonomy difference, decomposed to the line — not an absent fund.**

| Line | SCO | ACFR | Delta |
|---|---|---|---|
| Intergovernmental | $729,460,059 | $720,600,178 | +8,859,881 |
| Special Benefit Assessments | $4,364,511 | — | +4,364,511 |
| Taxes | $246,278,242 | $244,944,676 | +1,333,566 |
| Fines, forfeitures, penalties | $7,753,437 | $7,420,968 | +332,469 |
| Revenue from use of money/property | $45,146,817 | $45,041,461 | +105,356 |
| Licenses, permits, franchises | $10,208,324 | $10,226,246 | −17,922 |
| Miscellaneous | $16,954,710 | $20,121,243 | −3,166,533 |
| Charges for services | $148,935,273 | $152,939,049 | −4,003,776 |
| **Net** | | | **+7,807,552** |

**The signs are mixed — five SCO-higher, three SCO-lower.** A missing fund subtracts in one
direction only and lands in one place; this is money being sorted into different buckets by two
reporting schedules. The single largest item, Special Benefit Assessments at $4.36M (56% of the
residue), has **no counterpart line in the ACFR at all** — the ACFR folds it elsewhere, so the
SCO schedule simply has a category the ACFR does not.

**3. Structural evidence, independent of the arithmetic entirely.** The stored SCO county revenue
row carries `Internal Service Fund` $153,803,323, `Hospital Enterprise Fund` $40,685,163,
`Solid Waste Enterprise Fund` $18,055,105 and `Other Enterprise Fund` $6,267,838 as **root-level
categories**. $218.8M of enterprise and internal service revenue is *inside the row we are
classifying*. A General Fund figure cannot contain enterprise funds. This alone rules out
`general_fund` and `total_governmental` without reference to any total.

**4. Leaving it `unknown` would manufacture the defect this milestone exists to remove.** Its
expenditure twin (§4.2) is `all_funds` on a $6 tie. Classifying one side of the same report and
not the other would drop county revenue out of every comparison surface while county spending
stayed in — an asymmetry with no basis in the data.

#### What would overturn this

A second county probe whose residue is **concentrated in a single fund-shaped line** rather than
spread across taxonomies, or whose sign pattern is one-directional. That would suggest a fund is
genuinely absent from the SCO county revenue figure and this entry should be withdrawn to
`unknown`. **A second probe is the natural first task if SCOPE-02 wants to harden this.**

**Verdict: `all_funds`, on structural evidence plus an explained 0.547% residue.** Recorded as the
registry's weakest link rather than presented as equivalent to the dollar ties.

### 4.4 🛑 MA — the "Schedule A — Special Revenue Funds" label is WRONG, and it invalidates §1.4

**This section retracts the premise on which the fifth CHECK value was approved.** No MA registry
entry is written yet; what follows is a finding.

#### The finding

`X — MA DLS Schedule A — Special Revenue Funds` (1,560 rows, 336 towns) does **not** contain
Special Revenue Funds. It contains **General Fund expenditures**. Four independent confirmations:

**1. There is no Special Revenue Funds source file.** `docs/MA/` holds exactly two report
families, both covering FY2002–FY2025 continuously:

```
GenFundExpenditures2002.xlsx … GenFundExpenditures2025.xlsx   (24 files)
GenFundRevenues2002.xlsx     … GenFundRevenues2025.xlsx       (24 files)
```

Every one of the 16,816 MA rows came from one of those two **General Fund** reports. The document
the label names was never loaded.

**2. The figures are byte-identical to the General Fund expenditure file.**
`GenFundExpenditures2023.xlsx`, whose columns are `DOR Code | Municipality | Fiscal Year | General
Government | Public Safety | Education | Public Works | Human Services | Culture and Recreation |
Fixed Costs | Intergov Assessments | Other Expenditures | Debt Service | Total Expenditures`:

| Town | `Total Expenditures` in the GF file | Stored under the "Special Revenue Funds" label |
|---|---|---|
| Arlington | $191,585,207 | $191,585,207 |
| Amherst | $82,129,575 | $82,129,575 |
| Newton | $482,585,813 | $482,585,813 |
| Somerville | $294,455,806 | $294,455,806 |

The revenue side matches `GenFundRevenues2023.xlsx` `Total Revenues` just as exactly (Arlington
$203,016,856, Amherst $104,580,158, Newton $500,766,364, Somerville $327,899,203).

**3. The stored category tree is the General Fund expenditure taxonomy.** Arlington's FY2023
"Special Revenue Funds" row carries Education, Fixed Costs, Debt Service, Public Safety, Public
Works, General Government, Culture and Recreation, Intergov Assessments, Human Services — the
same nine categories as its own FY2019 and FY2020 rows labelled `MA General Fund Expenditures`.
No revolving funds, no grants, no CPA.

**4. The series is continuous across the label change, and the label split is arbitrary.**
Arlington operating: FY2020 $166.8M (GF label) → FY2021 $170.6M → FY2023 $191.6M → FY2025 $214.3M
(SRF label). Smooth. A genuine switch to special-revenue-only reporting would collapse the series.
And the two labels are applied to *the same fiscal years* across different towns:

| FY | Towns labelled `MA General Fund Expenditures` | Towns labelled `Schedule A — Special Revenue Funds` |
|---|---|---|
| 2021 | 45 | 306 |
| 2022 | 28 | 323 |
| 2023 | 30 | 321 |
| 2024 | 26 | 325 |
| 2025 | 51 | 300 |

No data model assigns special-revenue-fund reporting to a fluctuating 26–51 towns a year. It is a
loader labelling artifact — the source string was named after the DLS *form* (Schedule A is the
form containing the General Fund section **and** other sections) with a section name appended that
does not describe what was extracted.

#### Consequence: `special_revenue` has no user

§1.4 reported these 1,560 rows as Special Revenue Funds and that finding is **withdrawn**. It was
derived from the source label — precisely the "self-description is a hint, not evidence" trap this
plan warns about, applied by this document to itself. The fifth CHECK value was approved on that
basis and currently classifies nothing.

The column and constraint are harmless as they stand (the value is simply unused), so nothing has
been reverted unilaterally. **Chris's call.**

#### The scope probe itself — Amherst FY2023, and it is not clean

Independent document: `docs/Amherst/amherst-fy2023.pdf` (Town of Amherst audited FY2023 financial
statements, governmental-funds statement p.19), fetched from amherstmarec.org.

| Comparison | Value | DLS off by |
|---|---|---|
| **DLS `GenFundExpenditures` total** | **$82,129,575** | |
| vs ACFR **General Fund** expenditures | $84,315,185 | **−2.59%** |
| vs ACFR Total Governmental expenditures | $103,111,657 | −20.35% |
| **DLS `GenFundRevenues` total** | **$104,580,158** | |
| vs ACFR General Fund revenues | $91,848,420 | +13.86% |
| vs ACFR Total Governmental revenues | $110,746,169 | −5.57% |
| DLS total **excluding** its Transfers column ($87,237,531) vs ACFR GF revenues | $91,848,420 | −5.02% |
| …vs ACFR Total Governmental revenues | $110,746,169 | −21.23% |

**Expenditures point clearly at `general_fund`** — 2.59% away, with Total Governmental 20.35%
away. The residual is consistent with MA's statutory/UMAS basis differing from GAAP, which is
expected and well documented.

**Revenues do not resolve.** The DLS revenue report carries a `Transfers` column, and that column
is **not a General Fund figure**:

| | Value | DLS Transfers off by |
|---|---|---|
| DLS `Transfers` | $17,342,627 | |
| ACFR **General Fund** transfers in | $3,373,920 | **+414.02%** |
| ACFR **all governmental funds** transfers in | $17,053,625 | **+1.69%** |

So DLS's published revenue total is a **hybrid** — General-Fund-shaped revenue lines plus an
all-governmental-funds transfers figure. As published it sits 5.57% from Total Governmental and
13.86% from General Fund; stripped of transfers it sits 5.02% from General Fund and 21.23% from
Total Governmental.

#### Verdict: MA stays `unknown` pending a second probe

Expenditures are probably `general_fund`, and revenues are probably `general_fund` plus a
contaminating transfers column. But "probably" on **one town** is not what this milestone accepts,
and Amherst is a poor sole witness — it belongs to a regional school district, which distorts
intergovernmental and transfer flows relative to a town that runs its own schools.

**What the second probe needs:** a town that operates its own school department, so the
intergovernmental and transfer lines are ordinary. Newton or Somerville would serve; both were
already confirmed against the DLS files above, and both municipal sites returned HTTP 403 to
scripted fetches (the same WAF that blocked Arlington), so their ACFRs need another route.

16,816 rows — 21% of the database — turn on this. It is the largest single block of `unknown` and
the most valuable remaining reconciliation.

#### Resolution — `special_revenue` dropped

**DECISION — Chris, 2026-08-17: drop the value.** Migration
`supabase/migrations/20260817000100_scope_01_drop_special_revenue_value.sql`.

* Verified zero rows held it (`unknown` 79,927) **before** narrowing the constraint, so the
  migration could not fail on existing data.
* Re-verified afterwards that `special_revenue` is now rejected with `check_violation`, by the
  same rolled-back `DO` block used in §3.2.
* `SCOPE` in `scripts/lib/fundScope.mjs` is back to four values, and a test asserts
  `SCOPE.SPECIAL_REVENUE` is `undefined` — a re-add has to be deliberate and has to arrive with a
  source that genuinely needs it.
* `NON_COMPARABLE_SCOPES` is now `['unknown']` but stays a **list** behind `isComparableScope()`
  rather than collapsing to an inline `!== 'unknown'`. The set has changed once already this
  milestone, and SCOPE-02's category-level `fund_type` brings genuine fund slices.

The MA rows themselves are unaffected: they were `unknown` throughout and remain so pending the
second probe.

### 4.5 `state-acfr-gf` → `general_fund`

* **Match pattern:** ` State ACFR — General Fund` (leading space; the state name precedes it)
* **Rows claimed:** **1,448**, exactly the count Task 1 recorded, across **46 state nodes**. Every
  claimed row carries `GAAP basis`; every one is `entity_type = 'state'`.
* **Probed TWICE.** This is the largest remaining family and the strings are machine-generated by
  46 separate loader scripts, so one witness was not enough.

#### Utah FY2024 — the cohort's flagged-complication state

`docs/Utah/utah-state-fy2024-acfr.pdf` p.43, *State of Utah — Statement of Revenues, Expenditures
and Changes in Fund Balances — Governmental Funds — (expressed in thousands)*. Columns:
**General Fund** | Income Tax | Transportation | Transportation Investment | Trust Lands | Nonmajor
Governmental | Total Governmental.

| | Printed General Fund (000s) | Stored | Total Governmental (000s) | GF as % of total gov |
|---|---|---|---|---|
| Total Revenues | 11,209,884 | $11,209,884,000 | 23,669,654 | 47.4% |
| Total Expenditures | 12,493,247 | $12,493,247,000 | 22,596,317 | 55.3% |

**Both sides tie exactly.** Utah was chosen on purpose: `scripts/processUTAcfr.js` records it as
the one state in its tranche where the ACFR figure *undershoots* NASBO, because Utah's income-tax
revenue is constitutionally earmarked (Art. XIII, broadened by 2020's Amendment G) into a separate
major fund — the `Income Tax` column at 8,095,776 — which the printed General Fund column
excludes. If the loaders were quietly building composites rather than reading the printed column,
Utah is where it would show. It does not.

#### Connecticut FY2024 — an ordinary state

`docs/Connecticut/ct-state-fy2024-acfr.pdf` p.36, *State of Connecticut — STATEMENT OF REVENUES,
EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS*. Columns: **General** | Debt
Service | Transportation | Restricted Grants & Accounts | Grant & Loan Programs | Other Programs |
Total Governmental.

| | Printed General column (000s) | Stored | Total Governmental (000s) | GF as % of total gov |
|---|---|---|---|---|
| Total Revenues | 25,084,660 | $25,084,660,000 | 38,395,042 | 65.3% |
| Total Expenditures | 23,588,666 | $23,588,666,000 | 39,662,421 | 59.5% |

**Both sides tie exactly.** In both documents the General Fund is the first numeric column, which
is what `docs/state-acfr-5050.md` and the per-state loaders describe as the cohort-wide mold.

#### Why the pattern is safe

Three near-miss strings sit one word away and are **not** claimed, each asserted by test:

| String | Rows | Why excluded |
|---|---|---|
| `Texas State ACFR — General Revenue Fund …` | 20 | Texas's principal operating fund is the General **Revenue** Fund. Needs its own probe (§1.5). |
| `… State CAFR — General Fund …` | 34 | Pre-GASB-34 combined-statement basis — a different statement, FY2000–2002. Separate entry, separate evidence. |
| `City of Tucson ACFR — General Fund …` | 260 (family) | City/county documents, not state. Separate entry. |

**Verdict: `general_fund`, tied to the dollar on two independent states, both sides.** The
strongest-evidenced entry in the registry after the Modesto pair.

### 4.6 `wa-sao` → `general_fund`

* **Match pattern:** `^WA State Auditor — `
* **Rows claimed:** **286**, exactly the count Task 1 recorded, across **8 entities** — Spokane,
  Everett, Tacoma, Vancouver, Kitsap County, Kent, Bainbridge Island, Bellevue. All 286 strings end
  in `(General Fund, Expenditure by Function)` or `(General Fund, Revenue by Source)`; zero are any
  other shape.

#### ⚠ A note on what "independent document" means here

`scripts/lib/waSao.mjs` fetches these filings from `portal.sao.wa.gov/ReportSearch`, and the PDFs
in `docs/Spokane/` and `docs/Tacoma/` **are those filings**. There is no second reporter of the
same quantity — in Washington the SAO annual financial report *is* the city's ACFR. So this
reconciliation is not "two publishers agree"; it is **independent of the loader**, and the question
it answers is *which column of the statement the stored figure equals*. That is the question which
decides scope, and it is the same method §4.5 used for the state ACFRs.

Where the CA SCO ties in §2.1/§4.1 were genuinely cross-reporter, these are column-identification
ties. Both are valid evidence; they are different in kind and are labelled so rather than blurred.

#### Spokane FY2019 — whole dollars, fiscal year ending December 31

`docs/Spokane/spokane-2019-acfr.pdf`, *Statement of Revenues, Expenditures, and Changes in Fund
Balance — Governmental Funds*. Columns: **General Fund** | Library Capital | 2018 UTGO Bond |
Other Governmental | Total.

| | Printed General Fund | Stored | Total Governmental | GF as % of total gov |
|---|---|---|---|---|
| Total Revenues | 225,490,050 | $225,490,050 | 339,439,583 | 66.4% |
| Total Expenditures | 181,995,259 | $181,995,259 | 342,378,490 | 53.2% |

**Both sides tie exactly.** The columns sum exactly
(225,490,050 + 5,966,857 + 107,982,676 = 339,439,583; 181,995,259 + 3,075,260 + 157,307,971 =
342,378,490), so the Total Governmental figures are confirmed rather than assumed. **Independently
corroborated a second way inside the same document**: the budgetary comparison schedule's ACTUAL
column reads the same two figures against original and final budget columns.

#### Tacoma FY2019 — thousands

`docs/Tacoma/tacoma-2019-acfr.pdf`, same statement. Columns: **General Fund #0010** |
Trans & Engineering Fund #1060 | Other Governmental Funds | **Total Governmental Funds**.

| | Printed GF #0010 (000s) | Stored | Total Governmental (000s) | GF as % of total gov |
|---|---|---|---|---|
| Total Revenues | 210,733 | $210,733,000 | 341,682 | 61.7% |
| Total Expenditures | 227,841 | $227,841,000 | 376,377 | 60.5% |

**Both sides tie exactly**, and the columns sum exactly.

#### Why two probes, and why these two

The two documents print in **different units** — Spokane in whole dollars, Tacoma in thousands.
A tie on both therefore also confirms the loader normalised units per document rather than
assuming a single scale, which is the defect class recorded in
`project_seattle_king_county_scoping` ("amounts IN THOUSANDS, tie is unit-invariant" — a tie gate
alone cannot catch a wrong unit, because it compares a computed sum against a printed total read
through the same multiplier). Spokane also runs a calendar fiscal year, unlike the June-30 entities
probed elsewhere in this document.

**Verdict: `general_fund`, tied exactly on two entities, both sides, in two different units.**

### 4.7 🛑 MN OSA — the fund types are knowable, the REPORTING ENTITY is wider. A model question.

**21,794 rows / 945 entities — the largest single family.** No entry written yet; this is a finding
plus a question the milestone's value set cannot answer on its own.

* **Probe:** City of Bloomington, MN, FY2022 (`GAAPInd = -1` = GAAP basis, per
  `scripts/mnCityBasis.json`, so a GAAP ACFR is the right comparator).
* **Independent document:** `docs/BloomingtonMN/bloomington-mn-fy2022-acfr.pdf`, the city's own
  audited ACFR, governmental-funds statement (free download from bloomingtonmn.gov).
* **Source workbook, downloaded free:** `docs/MN/cired_22_data.xlsx` (the exact `source_url`
  already recorded on the stored rows).

#### The stored figures are faithful to the source

Read directly from the workbook, Bloomington row 78 of the `Governmental Funds` sheet:

| Stored | Column | Value |
|---|---|---|
| `revenue` $148,267,637 | col 74 `Total Revenues` | 148,267,637 ✅ |
| `operating` $155,969,565 | col 144 `Total Expenditures` | 155,969,565 ✅ |

Exactly what `scripts/loadMNOSA.js` documents (and it correctly avoids col 81
`Total Revenues & Other Sources` = 211,077,612 and col 149 `Total Expenditures & Other Uses` =
189,352,385). **No mislabelling here** — unlike MA §4.4, the loader and the source agree.

#### But the figures do NOT tie to the city's own ACFR

Bloomington FY2022 ACFR governmental-funds statement (columns verified to sum exactly:
83,191,676 + 886,499 + 8,339,226 + 8,165,634 + 12,269,297 + 8,974,105 = 121,826,437):

| Candidate | Value | MN OSA off by |
|---|---|---|
| ACFR **General Fund** revenue | $83,191,676 | **+78.2%** |
| ACFR **Total Governmental** revenue | $121,826,437 | **+21.7%** |
| ACFR Total Governmental + OSA enterprise ($55,331,114) | $177,157,551 | −16.3% |
| ACFR **General Fund** expenditures | $83,672,911 | +86.4% |
| ACFR **Total Governmental** expenditures | $133,719,576 | **+16.6%** |

MN OSA sits **between** total governmental and all funds — above one, below the other. On the
arithmetic alone, nothing matches.

#### What the gap actually is — reporting entity, not fund type

Two things are established structurally, independent of any total:

**1. Enterprise funds are EXCLUDED.** They live on a separate `Enterprise Funds` sheet — for
Bloomington, 7 enterprises with $55,331,114 of operating revenue (Water and Sewer $33,011,125,
Solid Waste $9,452,134, Storm Water $7,191,477, Recreation Facilities $3,960,132, Police
Contractual $1,141,589, Assisted Rental $335,388, Property Management $239,269). None of it
appears in the $148,267,637: the governmental revenue tree has no water/sewer line and
`Total Charges for Services` is only $7,189,968. `Transfers From Enterprise Funds` ($832,334)
appears only in the *& Other Sources* total, not in `Total Revenues`. **So this is not `all_funds`.**

**2. It is far more than the General Fund.** The row carries `Total Capital Outaly1` $30,579,352,
`Street & Highway Construction` $17,844,362, `Tax Increments` $16,887,344, `Housing & Urban
Redevelopment` $12,153,560, `Economic Development` $13,839,313 + $3,382,343 capital.
**So this is not `general_fund`.**

**3. The gap is the city's HRA / EDA / TIF activity.** Those are component units which Bloomington's
ACFR presents outside the primary government's governmental funds, and which MN OSA consolidates
into the city. Bloomington's HRA+EDA expenditures alone are $29,375,216 against an expenditure gap
of $22,249,989.

**And it is systematic, not a Bloomington quirk** — measured across all 852 cities in the workbook:

| | Cities | Share |
|---|---|---|
| nonzero `Tax Increments` | 324 | 38.0% |
| nonzero `Housing & Urban Redevelopment` | 273 | 32.0% |
| nonzero `Economic Development` | 452 | 53.1% |
| **nonzero any of the three** | **514** | **60.3%** |

Statewide: TIF is 2.91% of `Total Revenues` ($200,823,303 of $6,912,397,832) and HRA+EDA is 7.04%
of `Total Expenditures` ($545,100,069 of $7,742,506,146). **The magnitude varies enormously by
city** — ~7% statewide but ~17–22% for Bloomington, which is TIF-heavy. So a second probe will not
produce a tie either; the divergence is structural and city-specific in size.

#### The model question this raises

`fund_scope` asks *which funds does this total cover?* For MN OSA the answer is clear and
defensible: **all governmental funds, excluding enterprise** — i.e. `total_governmental`.

But MN OSA's **reporting entity** is wider than a city ACFR's primary government. That is a
**fourth dimension** the milestone does not model — not which *funds*, but which *entities*. And it
bites precisely where SCOPE-01 is meant to help: an MN OSA `total_governmental` figure compared
against an ACFR-derived `total_governmental` figure carries a systematic upward bias, ~7% on
average and ~20% for TIF-heavy cities.

**This is not MN-specific.** Every state-collected reporting form is likely to consolidate the same
way, which puts the same question on Ohio AOS (6,616 rows), VA APA (608) and MN counties. Deciding
it once, here, sets the rule for ~29,000 rows.

The options, for Chris:

| | Effect |
|---|---|
| **(a) Classify `total_governmental`, record the caveat** | 21,794 rows become comparable. Honest about fund types, silent in the data about a ~7–20% entity-boundary bias. Same shape as §4.3's county-revenue call, but with a much larger residue. |
| **(b) Leave `unknown`** | Strictly faithful to "no tie, no classification". Keeps the largest family out of every comparison surface, and discards a fund-type fact we have positively established. |
| **(c) Classify, and add a `reporting_entity` column in SCOPE-02** | Models the real distinction rather than forcing it into `fund_scope`. Most correct, most work, and SCOPE-02 already owns the category-level `fund_type` column so it is the natural home. |

**Held at `unknown` pending that decision.** Distinct from §4.4 (MA), where the *fund composition
itself* was ambiguous — a hybrid of GF revenue lines and all-governmental transfers. Here the fund
composition is unambiguous; only the entity set is wider.

#### Resolution — classify now, model the entity axis in SCOPE-02

**DECISION — Chris, 2026-08-17: option (c).** Stamp `total_governmental` now, and make the
reporting-entity boundary an explicit SCOPE-02 deliverable rather than a buried caveat.

`mn-osa` → `total_governmental`, 21,794 rows across 945 entities. Justified on the axis
`fund_scope` actually asks about — which funds — where the answer is established structurally and
is not in doubt. The entity-boundary residue is recorded in full in the entry's own `evidence`
string, so anyone reading the registry sees it without opening this document.

**This sets the rule for every state-collected reporting form.** Ohio AOS (6,616 rows), VA APA
(608) and MN counties get the same treatment when they are probed: classify on fund type, record
the entity boundary. ~29,000 rows total.

##### ⇒ SCOPE-02 REQUIREMENT (new, arising here)

Add a **`reporting_entity`** column on `treasury.budgets`, distinct from `fund_scope`:

```sql
reporting_entity in ('primary_government', 'incl_component_units', 'unknown')
```

| Source | `fund_scope` | `reporting_entity` |
|---|---|---|
| MN OSA | `total_governmental` | `incl_component_units` |
| Ohio AOS / VA APA (expected) | TBD by probe | `incl_component_units` |
| City/state ACFR extracts | `general_fund` | `primary_government` |
| CA SCO | `all_funds` | TBD |

**The comparison filter must then check BOTH columns**, not `fund_scope` alone — two figures are
only comparable when their fund scope *and* their reporting entity agree. `isComparableScope()` in
`scripts/lib/fundScope.mjs` is deliberately a list-based predicate rather than an inline
`!== 'unknown'` precisely so this second dimension can be threaded through one place.

Without it, an MN OSA city ranks ~7% high against an ACFR-sourced city on a per-capita axis, and
~20% high if it is TIF-heavy. That is a smaller error than the 50–75% General-Fund-vs-all-funds
seam SCOPE-01 exists to fix, but it is the same *kind* of error, and it is now measured rather
than suspected.

### 4.8 `oh-aos` → `total_governmental` — the strongest evidence in the registry

* **Match pattern:** `^Ohio Auditor of State`
* **Rows claimed:** **6,616** across **341 entities**, one distinct string — exactly Task 1's count.
* **Document:** the source workbook itself, `docs/OhioAOS/City_2024_GAAP_Summarized.XLSX`,
  downloaded free from the exact `source_url` stored on the rows.

**Why this is the strongest discriminator anywhere in this document:** the same publisher prints
the General Fund and the Total Governmental Funds figures as **separate tabs of one file**. Which
one TT loaded is therefore a *fact*, not an inference from a label or a residue. Each tab
self-describes in its own row-2 banner:

| Tab | Banner |
|---|---|
| `SOREACIFB_General` | "Summary of Unaudited Data from the Statement of Revenues, Expenditures and Changes in Fund Balances - Governmental Funds - **General Fund**" |
| `SOREACIFB_TotalGov` | "… - Governmental Funds - **Total Governmental Funds**" |

**City of Columbus FY2024** (row 57 of both tabs):

| | General Fund | **Total Governmental** | Stored |
|---|---|---|---|
| Revenue | $1,429,123,000 | **$2,166,549,000** | $2,166,549,000 ✅ |
| Expenditures | $1,168,730,000 | **$2,477,440,000** | $2,477,440,000 ✅ |

The stored figures are TotalGov col 16 and col 35 exactly — and 51.6% / 112.0% above the General
Fund figures, so there is no chance of confusing the two.

**Enterprise is excluded**, in separate `SOREACINP_*` tabs: Columbus Water $268,151,000 + Sewer
$361,624,000 + Electric $93,535,000 + Landfill $0 = **$723,310,000**, none of it inside the
$2,166,549,000. So not `all_funds`. This matches the locked v2.8 scope decision recorded in
`reference_ohio_aos_financial_data` ("general-government only … enterprise funds deferred to
OHENT-01").

**Two caveats recorded on the entry itself:**

1. The banner says **"Unaudited Data"** — Ohio AOS is unaudited Hinkle-system actuals. That is a
   data-quality caveat, not a scope one, and it does not affect this classification.
2. **Reporting entity: expected `primary_government`, UNCONFIRMED.** Each tab restates the
   entity's *own* governmental-funds statement, rather than re-aggregating from a state chart of
   accounts the way MN OSA does (§4.7), so Ohio is expected NOT to carry MN's component-unit
   inflation. It could not be confirmed: `columbus.gov` returned HTTP 403 to a scripted ACFR
   fetch. SCOPE-02 settles it when it adds `reporting_entity`.

**Verdict: `total_governmental`.**

---

### 4.9 🛑 VA APA — the revenue rows are not a fund-scope quantity at all

**608 rows / 161 entities. Both datasets stay `unknown`**, and the revenue side raises a defect
that no `fund_scope` value can express or fix.

#### The finding: VA revenue EXCLUDES intergovernmental aid, by design

`scripts/loadVAComparativeReport.js` states it outright — the revenue total is Exhibit B
**"Total *Local* Revenue"**, and:

> *"(Intergovernmental aid — Exhibit B1 — is intentionally excluded this phase: it is not local
> revenue, the report headlines 'Total Local Revenue', and including it would imply a false surplus
> vs. the expenditure side. Revisit for an all-sources view.)"*

So this is a **deliberate, documented** loader decision, not a bug. But its consequence is that the
stored VA `revenue` rows are a **revenue-source subset** — a horizontal slice — where `fund_scope`
describes a **vertical** one. No value in `('general_fund','total_governmental','all_funds')` is
true of "local revenue only", and `unknown` is the only honest option.

#### The measurement, which shows how large the effect is

Stored revenue as a share of stored expenditures, FY2024, largest localities first:

| Locality | Revenue | Expenditures | Revenue as % of expenditures |
|---|---|---|---|
| Fairfax County | $5,646,769,177 | $6,674,467,930 | 84.6% |
| **Loudoun County** | $2,736,875,183 | $2,674,301,639 | **102.3%** |
| Prince William County | $1,759,650,000 | $2,502,694,000 | 70.3% |
| Virginia Beach | $1,524,028,455 | $2,081,891,529 | 73.2% |
| Arlington County | $1,524,817,469 | $1,616,194,792 | 94.3% |
| **Richmond** | $964,019,504 | $1,606,950,956 | **60.0%** |
| Chesterfield County | $1,022,922,894 | $1,576,399,339 | 64.9% |
| Henrico County | $1,012,932,091 | $1,481,898,187 | 68.4% |
| **Newport News** | $606,584,138 | $1,017,452,620 | **59.6%** |
| Alexandria | $874,230,660 | $863,578,347 | 101.2% |

**The 59.6%–102.3% spread is the signature of the missing aid**, not noise: locally-funded
jurisdictions with large tax bases (Loudoun 102.3%, Alexandria 101.2%, Arlington 94.3%) approach
break-even, while aid-dependent ones (Newport News 59.6%, Richmond 60.0%) sit ~40% short. In
Virginia the gap is dominated by state education aid.

#### Why this matters beyond scope labelling

The loader's stated rationale — that including aid "would imply a false surplus" — inverts in
practice: **excluding it manufactures an apparent 40% deficit** for the localities most dependent
on aid. And unlike a scope mismatch, a label cannot fix this. The VA "Money In" view is showing an
incomplete revenue picture, and closing it requires *loading Exhibit B1*, which is a data fix.

⇒ **Follow-up for SCOPE-02 or its own milestone: load VA Exhibit B1 (intergovernmental aid) so the
VA revenue rows become a whole-revenue figure.** Until then the VA revenue rows should arguably be
held out of comparison for a reason *other* than unknown scope — they are incomplete, not
unclassified. Recorded here so the distinction is not lost.

#### The expenditure side is also unresolved

Exhibit C "Total Expenditures" carries **Education** as one of its nine functions, which in
Virginia means the locality's school division — a component unit that VA ACFRs present outside the
primary government's governmental funds. So VA APA expenditures likely have *both* an unresolved
fund scope and MN-style component-unit consolidation (§4.7). Settling it needs the APA workbook
plus a locality ACFR, neither of which was fetched this pass.

**Verdict: both VA datasets stay `unknown`**, with the revenue exclusion recorded as a
completeness defect rather than a scope one. At 608 rows (0.8% of the table) this is a
proportionate place to stop; the finding is worth more than the classification would be.

---

## Task 5 — classified, and the partition proved clean

`scripts/classifyFundScope.mjs`. Ran `--dry-run`, checked the gate, then wrote.

### 5.1 The partition gate

The script asserts, **before writing anything**, that every registry pattern claims exactly the row
count Task 1 measured (§1.2), that claimed + unknown equals the table total, and that no string is
claimed by two entries. Result:

```
registry: 8 entries, all evidenced ✅
read 3824 distinct data_source strings over 79,927 rows

  ✅ mn-osa               total_governmental    21794 rows (expected 21794)     1 strings
  ✅ ca-sco-city-rev      all_funds             10446 rows (expected 10446)     1 strings
  ✅ ca-sco-city-exp      all_funds             10438 rows (expected 10438)     1 strings
  ✅ oh-aos               total_governmental     6616 rows (expected 6616)      1 strings
  ✅ state-acfr-gf        general_fund           1448 rows (expected 1448)   1448 strings
  ✅ ca-sco-county-exp    all_funds              1188 rows (expected 1188)      1 strings
  ✅ ca-sco-county-rev    all_funds              1188 rows (expected 1188)      1 strings
  ✅ wa-sao               general_fund            286 rows (expected 286)     286 strings
     unknown                                    26523 rows                  2084 strings
  claimed 53,404 + unknown 26,523 = 79,927 / 79,927

✅ partition gate: every entry claims exactly what Task 1 measured,
   nothing double-claimed, nothing lost
```

Every entry landed on its expected count exactly — no over-matching, no pattern too narrow. The
gate refuses to write on any mismatch; `--force` exists only for a deliberate registry change and
prints what it overrides. The expected counts live in `EXPECTED_ROWS` in the script with a comment
forbidding the obvious cheat of editing a number to make the gate pass.

**Overlap check:** zero strings matched more than one entry. `classify()` takes the first match, so
an overlap would not double-count — but it would mean one entry silently shadowing another, and
there are none.

### 5.2 The bucket tally — a headline result of the milestone

Verified independently in SQL after the write, not taken from the script's own prediction:

| `fund_scope` | Rows | % of table | Entities | Distinct sources |
|---|---|---|---|---|
| `total_governmental` | 28,410 | 35.5% | 1,286 | 2 |
| **`unknown`** | **26,523** | **33.2%** | **1,066** | **2,084** |
| `all_funds` | 23,260 | 29.1% | 533 | 4 |
| `general_fund` | 1,734 | 2.2% | 54 | 1,734 |

**53,404 rows classified (66.8%) from 8 evidenced entries. 26,523 rows (33.2%) remain honestly
`unknown` across 1,066 entities and 2,084 distinct source strings.**

The shape of that table is itself the finding: **six strings carry 51,670 rows** (the two
state-collected forms plus the four CA SCO strings), while 2,084 strings carry the unclassified
26,523. Coverage is cheap at the head and expensive in the tail, which is why the tail is where
`unknown` is the right answer rather than a target to grind down.

Note also how little sits at `general_fund` — 2.2%, 54 entities. That is not the end state: MA DLS
alone is 16,816 rows almost certainly `general_fund`, blocked on a second probe (§4.4). The tally
will look materially different once MA lands, and the UAT headline should say so rather than
present 2.2% as a conclusion.

### 5.3 No figure moved

Re-ran the Task 3 baseline (§3.3) after classification:

| Check | Result |
|---|---|
| `budgets` sha256 over (municipality_id, fiscal_year, dataset_type, period_label, total_budget) | `dd0e38c3…cce9eb` — **identical** ✅ |
| `sum(total_budget)` | 428,747,469,605,648.9717892247930625 — identical ✅ |
| `budget_categories` rows / `sum(amount)` | 2,996,331 / identical ✅ |
| `budget_line_items` rows / `sum(approved_amount)` / `sum(actual_amount)` | 2,316,190 / identical / identical ✅ |

One column written, nothing else touched. The classifier is idempotent and `--reset` returns every
row to `unknown`, so the whole of Task 5 is reversible.

### 5.4 VA APA revenue rows hidden

**DECISION — Chris, 2026-08-17: hide them.** Migration
`supabase/migrations/20260817000200_hide_va_apa_revenue_rows.sql`.

**Mechanism: `dataset_type` relabelled `revenue` → `revenue_local_only`** on the 304 rows, which is
simultaneously the hide and a truer label. Not a delete, and not a suppression column.

Why not the alternatives:

| Option | Why not |
|---|---|
| Delete the rows | Loses 304 budget rows and 7,440 category rows for a problem that is fixable by loading one more exhibit. |
| A `display_suppressed` column | **Would not have worked.** EV-Accounts serves treasury reads with explicit column lists, so a new column is invisible to the app; and `/treasury/cities` builds `available_datasets` from `(fiscal_year, dataset_type, period_label)` with no source information, so the frontend could not filter on source and would have kept offering a "Money In" tab that then failed to load. |

Why the relabel is safe and sufficient:

* `src/App.tsx` matches dataset types by explicit **allow-list** — `hasRevenue = entityDatasets.some(d => d.dataset_type === 'revenue')`, and likewise for `operating` / `salaries` / `all_funds_requirements`. An unrecognised type is simply never offered, so the tab disappears and nothing errors.
* `dataset_type` has **no CHECK constraint** (verified against `pg_constraint` — only `fund_scope` has one), and no row already held the new value, so the unique index `(municipality_id, fiscal_year, dataset_type, period_label)` cannot collide.
* Every figure and all 7,440 category rows are preserved.
* Reversible with one statement, recorded at the bottom of the migration file.

Verified after applying:

| Check | Result |
|---|---|
| Rows now `revenue_local_only` | **304** ✅ |
| Rows still `revenue` under this source | **0** ✅ |
| VA `operating` rows untouched | 304 ✅ |
| Category rows intact | 7,440 ✅ |
| **id-keyed figure digest** `sha256(id\|total_budget)` | `3bc12db8…82a2` — **unchanged** ✅ |
| Table rows / `sum(total_budget)` | 79,927 / 428,747,469,605,648.97… unchanged ✅ |
| Task 5 partition gate re-run | still passes: claimed 53,404 + unknown 26,523 ✅ |

#### ⚠ The Task 8 full digest changed, deliberately

The §3.3 digest is keyed on `(municipality_id, fiscal_year, dataset_type, period_label,
total_budget)`, and `dataset_type` is part of that key. Relabelling therefore moved it:

| | Digest |
|---|---|
| pre-relabel (§3.3 baseline) | `dd0e38c3929962b327d422248bdae674d7d4f7fa0897dc5349bf2aaab2cce9eb` |
| **post-relabel — Task 8 compares against THIS** | `dad8f366c28a794d60ee54d6c3aad50c1777a4fa80955772ab59408efbcc26a9` |

**No figure moved**, which is what the id-keyed digest proves independently of any relabel. The
milestone's "changes no figure" invariant holds; only a type label changed, by decision. Task 8
must cite this migration rather than report a failure.

**Lesson for the harness:** a digest keyed on a mutable label conflates "a figure moved" with "a
label changed". `scripts/verify-fund-scope.mjs` should carry **both** digests — the id-keyed one as
the figure invariant, and the composite one as a change-detector that is allowed to move when a
migration says so.

#### Still outstanding: the real fix

Load VA **Exhibit B1** (intergovernmental aid) so these rows become a whole-revenue figure, then
scope-classify them properly and restore `dataset_type = 'revenue'`. Until then VA localities show
spending with no Money In view, which is honest — better than a revenue figure missing up to 40%
of the revenue.
