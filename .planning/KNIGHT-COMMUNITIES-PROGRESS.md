# Knight Communities — Progress

Authoritative per-entity status for the campaign designed in
`.planning/KNIGHT-COMMUNITIES-SEEDING.md`. Updated at the end of every session,
in the same commit as that session's work.

**Roster:** Knight Foundation's official 26 communities + Nashville, TN = 27
primary entities, plus 16 parent counties = **43 entities**.

---

## Source-family audit-grade evidence

Per spec §3.5, a non-`unknown` grade requires evidence recorded here **and** a
`source_url` on the row. A family that does not verify gets no registry entry and
its rows stay `unknown`.

### Ohio Auditor of State Summarized Annual Financial Reports → `self_reported_unaudited`

**Verified 2026-08-28** by direct fetch of
`https://ohioauditor.gov/references/SummarizedAnnualFinancialReports`.

Verbatim, from the publisher's own download page:

> "Download **UNAUDITED** annual financial report information by filing year, or
> browse summarized data by entity type and accounting basis. Data is presented by
> entity type, filing year, and basis of accounting in accordance with Ohio
> Revised Code § 117.38"

Reinforced by: "To request a copy of an unaudited Hinkle System filing, email
HinkleSystem@ohioauditor.gov".

The publisher states the audit status in its own words, in capitals, on the page
the files are downloaded from. This is the strongest evidence of the three.

### CA State Controller — Cities Annual Report → `self_reported_unaudited`

**Verified 2026-08-28** from California Government Code § 53891(a), verbatim:

> "The officer of each local agency who has charge of the financial records shall
> furnish to the Controller a report of all the financial transactions of the
> local agency during the preceding fiscal year."

> "The report shall contain underlying data from audited financial statements
> prepared in accordance with generally accepted accounting principles, **if this
> data is available**."

⚠ **This is a genuinely mixed source and the grade is a judgment call, recorded
here so it can be challenged.** The statute directs agencies to draw on audited
statements, which puts SCO above a bare self-report — but two facts keep it out
of `compiled_from_audited`:

1. The audited-data requirement is **conditional** ("if this data is available"),
   so an unknown share of rows is not audit-derived and nothing in the dataset
   distinguishes them.
2. The report is **furnished by the agency's own finance officer**. SCO receives
   and compiles it; it does not audit it.

Per the vocabulary's own rule, a mixed source takes the **weaker** branch.

⚠ Do **not** reuse `scripts/data/basisRegistry.mjs` entry `ca-sco-city-exp` as
audit evidence. Its Modesto FY2024 reconciliation establishes that the figures are
closed-year *actuals*, which is a statement about basis, not about assurance.

### Minnesota OSA City/County Finances Report → `unknown` (NO REGISTRY ENTRY)

**Could not be verified 2026-08-28.** Three publisher pages checked:

- `https://www.osa.state.mn.us/reports-data-analysis/local-government/cities/`
- `https://www.osa.state.mn.us/reports-data-analysis/reports/local-government-finances-report/`
- `https://www.auditor.state.mn.us/reports-data-analysis/reports/local-government-finances-report/`

None states what the Finances Report is compiled **from**, nor its audit status.
The only related sentence is a general description of the office:

> "In addition to performing audits, the State Auditor's Office reviews the
> financial statements, audits, management letters, and financial reporting forms
> of all local governments under the Office's purview."

That describes what OSA reviews, not what populates this dataset.

**What is known but is NOT sufficient:** cities submit a Local Government
Financial Reporting Form through SAFES, and separately file a GAAP audit. Because
OSA receives both, "compiled from the self-reported form" is *likely* but not
stated. Guessing `self_reported_unaudited` here would be inference from plausibility
— exactly what spec §3.5 forbids.

⚠ `GAAPInd` in the raw data indicates **basis of accounting**, not audit status.
Do not read it as evidence of audit.

**Consequence:** Duluth, Saint Paul, Ramsey County and Saint Louis County stay
`unknown` — 4 of this session's 9 entities. **Resolving this is a live follow-up:**
the likely route is the methodology or notes section inside a `cired_*` report PDF,
or a direct question to OSA.

---

## Entity status

Legend — Status: `loaded` · `partial` · `pending`. Grade: as stamped on the rows.
FY month: the stored `fiscal_year_start_month` and whether the FAC census confirms it.

| Entity | State | Type | Status | Source | Grade | FY month | Session |
|---|---|---|---|---|---|---|---|
| Akron | OH | city | loaded | OH AOS | `self_reported_unaudited` | 1 · **FAC confirmed** | 1 |
| Summit County | OH | county | loaded | OH AOS | `self_reported_unaudited` | 1 · **FAC confirmed** | 1 |
| Long Beach | CA | city | loaded | CA SCO cities | `self_reported_unaudited` | 10 · **FAC confirmed** | 1 |
| Duluth | MN | city | loaded | MN OSA | `unknown` — source unverified | 1 · **FAC confirmed** | 1 |
| Saint Paul | MN | city | loaded | MN OSA | `unknown` — source unverified | 1 · **FAC confirmed** | 1 |
| Ramsey County | MN | county | loaded | MN OSA | `unknown` — source unverified | 1 · **FAC confirmed** | 1 |
| Saint Louis County | MN | county | loaded | MN OSA | `unknown` — source unverified | 1 · census name miss | 1 |
| Los Angeles County | CA | county | loaded | CA SCO **counties** | `unknown` — family unverified | 7 · no CA county census | 1 |
| Santa Clara County | CA | county | loaded | CA SCO **counties** | `unknown` — family unverified | 7 · no CA county census | 1 |
| San Jose | CA | city | **partial** | GF budget + publicpay | `unknown` | 7 · **FAC confirmed** | 1 |

The 33 remaining entities are `pending` and are listed in spec §2.

⚠ **No oracle column this session — nothing was loaded.** Session 1 built the
grade axis and verified what already existed; the first oracle runs land in
session 2 (NC).

---

## Session 1 outcomes (2026-08-28)

**Shipped:** the `audit_grade` axis, end to end.

- `AUDIT_GRADE` vocabulary in `scripts/lib/budgetAxes.mjs`, reusing the existing
  `classifyAxis()` unchanged — the grade is a **third axis** alongside
  `fund_scope` and `basis`/`reporting_entity`, not new machinery.
- `scripts/data/auditGradeRegistry.mjs` — three entries, patterns anchored at both ends.
- Two CHECK constraints on `treasury.budgets`. The second,
  `budgets_graded_rows_need_a_source_url`, replaced a planned vitest guard that
  **turned out to be impossible**: this repo's test suite never touches the
  database (zero tests call `createClient`; CI runs `npm test` with no
  credentials). A constraint is strictly stronger — it holds on every write path
  and cannot be missed by a loader that forgets or a harness nobody runs.
- **27,520 rows across 820 entities** stamped `self_reported_unaudited`.
  TT went from 0% to **31.3%** graded. `sum_total` identical to the digit
  before and after; 0 graded rows lack a `source_url`.
- Test suite 1,382 → **1,427**, all passing.

**Scope decision, 2026-08-28:** the stamp was widened from the Knight 43 to every
row of a verified source family. `unknown` means "nobody has looked" — leaving
Columbus, OH ungraded after establishing that Ohio AOS is unaudited would make
the column lie by omission. Spec §3.6 should be read as *scoped by verified
source family*, not by entity.

**Not done, deliberately:**

- **San Jose's CA SCO series was NOT loaded.** It is not a defect. The exclusion
  is a recorded decision — `bulkLoadStateController.js:246` says "flagship
  custom-source cities (e.g. San Jose, Fresno, Bakersfield)… **(Chris decision:
  the 12 named custom cities get salaries+enrichment only, no SCO backfill.)**",
  implemented in `loadQuickWinCounties.sh` as `Santa Clara|San Jose`. Confirmed
  2026-08-28 to leave it alone.
  ⚠ **Worth revisiting separately:** the exclusion exists because "the
  never-overwrite guard alone can't protect the empty years," but SCOPE-02
  narrowed the collision check, and `fund_scope`/`basis`/`derivation` now keep
  the series distinct. **Long Beach already carries all three series at once**
  without harm. The policy may have outlived its reason — for all 12 cities, not
  just San Jose.
- **MN OSA left `unknown`** — see the evidence section above.
- **CA SCO *county* series left `unknown`.** The counties use a distinct family
  (`CA State Controller - County Expenditures` / `- County Revenues`, 2,376 rows)
  and Gov Code § 53891 does not cleanly settle it: subsection (b) excepts
  "cities, counties, and school districts" from the Controller's *accounting
  procedures*, which implies counties are local agencies but does not establish
  the (a) reporting duty for them. SCO publishes a separate Counties Annual
  Report with its own methodology. **Cheap follow-up: read that report's front
  matter.** Would grade LA County and Santa Clara County.

**Follow-ups opened:**

1. ⚠ The jammed frozen-figure invariant (below) — highest priority.
2. ⚠ The FAC census is blind to **all 54 CA counties** (below).
3. MN OSA audit status — 4 Knight entities blocked on it.
4. CA SCO counties audit status — 2 Knight entities blocked on it.
5. The `--exclude-city` policy for 12 CA cities, possibly obsolete.
6. **What grade should a TT-derived row carry?** SCOPE-04 rows
   (`Treasury Tracker derived: Total Governmental (…)`, 857 CA county rows and
   more) have `derivation='derived'` and are currently `unknown`. Arguably they
   should inherit their parent source's grade. Not decided — out of session scope.
7. ev-accounts passthrough so the grade reaches the UI (spec §3.7). Until then
   the column is correct but invisible — the precise failure `sourceChipTypes.ts`
   documents, where `city` was missing from the chip set for months with every
   gate green.

---

## Known issues found during this campaign

### ⚠ HIGH — the frozen-figure invariant is jammed, and has been for some time

**Found 2026-08-28, before this session made any database write.**
`node scripts/verify-budget-axes.mjs` fails its final check:

```
✗ FROZEN FIGURE DIGEST MOVED — a row that existed at v2.24 changed or vanished
    expected 4cce9d6a8dfe9ac235dfd488f1903243892c7ebc4ac41b17dbd9022bfb068b9a
    got      c6e08b16db81224f487a85509230769e9b14e46b44b128deaee7ee45cd2056a5
```

Its other checks pass. **This is bookkeeping drift, not known corruption:**

| | rows |
|---|---|
| Live rows | 87,880 |
| Excluded (`scope02` 12 + `postV224` 148 + `scope04` 7,650) | 7,810 |
| Non-excluded, i.e. what gets hashed | **80,070** |
| `frozen_row_count` the hash was built from | **79,916** |
| **Unaccounted** | **154** |

154 rows created since v2.24 are in no exclusion file, so they are inside the
hash. **It therefore cannot match, whether or not any original figure changed** —
the harness can no longer distinguish "new rows leaked in" from "a figure moved."
This is the exact failure its own code comment records for v2.27–v2.29, recurring.

⚠ **The 154 cannot be localized from the database.** `created_at` is populated on
**19 of 87,880 rows**, newest timestamp 2026-03-24 — the RPC write path does not
set it. And the baseline stores only a count and a hash, never the ID set. So
drift here is detectable but not attributable.

⚠ **Do NOT regenerate `figures_frozen`.** The file forbids it, and doing so would
destroy the only evidence of what the 154 are.

Nothing runs this harness automatically — `npm test` is green and does not include
it — so it could have been failing for weeks unnoticed. Needs its own session.

### Flaky guard test — `tests/listAllSources.test.mjs`

### ⚠ HIGH — the FAC census is blind to every California county

**Found 2026-08-28** while verifying the loaded entities' fiscal calendars.

`docs/fac/fac-local-fiscal-year-ends.csv` holds **549 CA rows, every one typed
`municipality`, and zero CA `county` rows** — against 3,489 county rows
nationally (MN alone has 93). The CA slice was built city-scoped, consistent with
PR #101's stated scope of "all 427 CA cities."

**Consequence:** `censusGuard()` returns `{ok: true}` when it cannot find an
entity — silence is not disagreement — so it passes **all 54 CA counties in TT**
without checking anything. Their `fiscal_year_start_month` values (all month 7)
have never been independently verified. That is the same class of unverified
assumption as the FYSM defect, and it fails silently because the column moves no
dollar.

`tests/knightFiscalCalendars.test.mjs` now pins the gap so it cannot go silent.

**Second, smaller gap:** `Saint Louis County, MN` cannot be matched by name. FAC
holds it as both `St Louis County` (1998-2004, 2021-2022) and `St. Louis County`
(2005-2020, 2023-2025); TT stores `Saint Louis County`. FAC's month is 1, which
is what TT stores — so this is a normalisation miss, not a discrepancy. A
"Saint"/"St." normalisation in `censusMonthFor` would close it.

⚠ **This matters for the campaign:** 16 counties are in scope across 14 states.
Wherever a state's census slice is city-only, county verification is vacuous.
**Check per state before trusting a county's month.**

### Flaky guard test — `tests/listAllSources.test.mjs`

Observed 2026-08-28: "has no live capped-RPC call anywhere in scripts/" failed
once in a full `npm test` run, then passed in isolation (13/13) and on an
immediate re-run (1,387/1,387).

**Mechanism:** the describe block calls `readdirSync('scripts')` once, then each
`it` calls `readFileSync` per path. Anything that creates or removes a file in
`scripts/` between those two moments makes the read throw.

Not caused by the Knight work. Recorded rather than fixed, because a guard that
intermittently fails erodes the exact signal it exists to provide, and the fix
(tolerating a vanished file) could equally mask a real problem. **Worth a
deliberate decision.**
