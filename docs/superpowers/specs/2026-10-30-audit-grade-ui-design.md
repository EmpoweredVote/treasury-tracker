# Design — every figure travels with its provenance

**Date:** 2026-10-30
**Status:** design agreed with Chris in brainstorming. Not yet planned, not yet built.
**Supersedes nothing.** Extends `.planning/followups/audit-grade-explained-to-readers.md`
(shipped 2026-08-31), which built the vocabulary and the chip this document moves.

---

## 1. Intent, in Chris's words

> "We should only share the information with how we sourced it and our confidence
> in that source."

The triggering reader is **a journalist deciding whether they can cite a number.**
That is the test every decision here is measured against: not "is the label
present somewhere on the page", but "could someone quote this figure without
knowing what stands behind it".

The second rule, also his:

> "Everything stays visible, just labeled honestly — but we should only use
> un-audited when we can't find audited, or it is showing very useful information
> that we don't have an audited version for. In those instances, it should be
> noted/flagged."

So audited is the preferred source, unaudited is a documented fallback, and the
fallback announces itself. **Nothing is hidden and nothing is filtered away** —
that was explicitly rejected in favour of labelling.

### The preference order

Chris: *"the priority is 'Audited, Government-Reported, and then UnAudited'."*

Three tiers over the five stored values:

| tier | stored values | reader-facing label |
|---|---|---|
| **Audited** | `audited_gaap`, `audited_ocboa`, `compiled_from_audited` | "Independently audited", "Audited — other basis", "From audited reports" |
| **Government-Reported** | `self_reported_unaudited` | "Government-reported" |
| **UnAudited** | `unknown` | "Audit status not established" |

⚠⚠ **THIS ORDER IS A SOURCE-SELECTION RULE, NOT A READER-FACING RANKING.** It
governs which source TT *prefers to show* when more than one exists. It must not
become a quality ladder in the UI. `audited_ocboa` carries the **same** assurance
as `audited_gaap` on a different measurement basis — `src/data/auditGrade.ts`
says so at length and `src/data/auditGrade.test.ts` has a test
(`no value ranks itself against the others`) that fails on the words *best*,
*worst*, *highest*, *lowest*, *star*, *tier*, *rank* and *score*. Those tests are
the guardrail, not an obstacle; do not weaken them to express the priority.

---

## 2. Goals, non-goals, anti-goals

**Goals**

1. A figure cannot be read off this site without its provenance and audit grade
   being visible in the same eyeful — including a figure read off a chart.
2. Where TT holds two differently-measured figures for the same place and year,
   both are reachable, and the page says plainly that they measure different
   things.
3. The grade a reader sees is the most specific one TT can honestly support.
   "We haven't checked" must stop appearing on rows where we have.

**Non-goals**

* Hiding, filtering out or down-ranking low-assurance figures. Rejected by Chris.
* Raising any row's grade without the publisher's own evidence.
* Resolving the qualified-vs-clean opinion gap (Harrison County MS, 10 rows).
  Still deferred, still filed, still must not be papered over by copy.

**Anti-goals — ways this fails even if it ships**

* ⚠⚠ **A label on every number that nobody reads.** 89.8% of TT is
  `self_reported_unaudited`. A chip repeated five times down one page becomes
  furniture, and it fails *silently* — which is why option B was rejected.
* ⚠⚠ **Libelling governments at scale.** `unknown` describes **our** coverage,
  never the government. `self_reported_unaudited` is a statutory filing a named
  officer signs, not a guess. Both can smear thousands of governments if the copy
  drifts. `auditGrade.test.ts` pins this; keep it pinned.
* **Shortening the charts.** See §4.

---

## 3. What already exists — read before building anything

Most of the machinery is built. This is a move-and-correct job, not a from-scratch one.

| piece | where | state |
|---|---|---|
| vocabulary + copy + explainer | `src/data/auditGrade.ts` | ✅ shipped 2026-08-31, careful, well-tested |
| copy guardrails (15 tests) | `src/data/auditGrade.test.ts` | ✅ |
| the chip | `src/components/ScopeLabel.tsx` | ✅ renders, own disclosure state |
| API passthrough | ev-accounts `treasuryService.ts`, 10 sites | ✅ |
| `audit_grade` → `metadata.auditGrade` | `src/data/dataLoader.ts:466` | ✅ |
| DB column + CHECK constraint | `supabase/migrations/20260828000000_audit_grade_on_budgets.sql` | ✅ |

Verified live on 2026-10-30: LA City's FY2025 rows serve
`audit_grade: "self_reported_unaudited"` and the page renders "Government-reported".
**The pipeline works end to end.** What is wrong is placement, coverage and one
stale sentence.

### Measured distribution, 2026-10-30 (production `treasury.budgets`)

| grade | rows | share |
|---|---:|---:|
| `audited_gaap` | 1,356 | 0.2% |
| `audited_ocboa` | 28 | 0.005% |
| `compiled_from_audited` | 19,590 | 3.4% |
| `self_reported_unaudited` | 524,174 | **89.8%** |
| `unknown` | 38,421 | 6.6% |
| **total** | **583,569** | |

⚠ These differ wildly from the numbers written into `auditGrade.ts`'s docstring
and `.planning/followups/audit-grade-explained-to-readers.md`, which are from
2026-08-31 when the table held 88,820 rows. The share did not get worse — the
database grew 6.6× and honest grading kept up. New York (185k), Michigan (116k)
and Pennsylvania (51k) are all state agencies compiling self-reports, correctly
graded. **Update those docstrings as part of this work; they are now misleading
to the next person who reads them.**

---

## 4. The four defects

### D1 — the explainer is factually false on the live site

`AUDIT_GRADE_EXPLAINER.whyUnknownIsNotBad` tells readers the "not established"
note "is roughly two figures in every three." It was two in three on 2026-08-31.
**It is now 1 in 15.** The note a reader actually meets most often is
"Government-reported", at 89.8%.

Fix the sentence, and **do not replace one hard-coded fraction with another** —
it will rot again. Either derive it, or word it so it stays true as the corpus
grows. A test should fail if a bare fraction is reintroduced.

### D2 — the chip renders in exactly one place

`ScopeLabel` is used only in `src/components/dashboard/PlainLanguageSummary.tsx`
(lines 497 and 506), inside the narrative block, gated on
`!isNonprofit && (operatingData || revenueData)`. The charts, the tables and the
search results carry no provenance at all. A reader who scrolls past the summary
and quotes a number off a bar gets nothing. **This is the gap between what is
built and the principle in §1.**

### D3 — derived rows say "not established" when we know perfectly well

**7,652 rows, exactly four families**, all `derivation = 'derived'` and
`audit_grade = 'unknown'`:

```
Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)
Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)
Treasury Tracker derived: Total Governmental (CA State Controller - County Revenues)
Treasury Tracker derived: Total Governmental (CA State Controller - County Expenditures)
```

TT computed these from its own graded inputs. Telling a reader "we have not
checked" is **less** honest than the truth, not more. On the LA City page this is
live today: toggling from All Funds to Total Governmental changes the chip from
"Government-reported" to "Audit status not established", for figures derived from
the very rows labelled "Government-reported".

⚠ **Inheritance is not uniform across the four.** The two *city* families'
parents (`CA State Controller - Revenues` / `- Expenditures`) carry
`self_reported_unaudited`, so they inherit it now. The two *county* families'
parents are themselves still `unknown` — they are bucket C of the 2026-10-09
scoping, awaiting a publisher recon — so they correctly **stay** `unknown`.
A builder who maps all four to one value has introduced a false claim on the
county rows. **LA City is fixed by this; LA County is not.**

⚠⚠ **A derived row may never out-rank its inputs.** Inheritance is the only
permitted direction. This is the §3.5 rule from the Knight seeding spec.

**How to write it — use the registry, not a bespoke script.** Add one
**branching** entry to `scripts/data/auditGradeRegistry.mjs`, anchored at both
ends over the four `Treasury Tracker derived: Total Governmental (…)` labels,
whose `branch(context)` resolves the parent family and returns its grade. The
Minnesota OSA entry is the existing precedent for a branching entry and carries
the rules: a branch may only raise a grade **on evidence**, and it returns
`null` — falling back to the entry's own weaker `value` — when it cannot resolve.
Here the evidence is the parent row's own registered grade, which is the
strongest evidence shape available and does not require a new recon.

⚠ The entry's own `value` must therefore be `unknown`, so the two county
families keep saying "not established" until their publisher recon lands. Then
run `scripts/stampAuditGrade.mjs --dry-run` first and confirm it reports
**exactly 7,652 candidate rows landing on two distinct grades**. If it reports
one grade, the branch is not firing and the county rows are about to be given a
claim nothing supports.

### D4 — "UnAudited" is wrong on 41% of the rows it appears on

Chris confirmed UnAudited should mean *we haven't checked yet* — **and asked
whether that is accurate.** It is not, for two of the five buckets measured in
`.planning/AUDIT-GRADE-UNKNOWN-SCOPING.md` (2026-10-09):

| bucket | rows | is "we haven't checked" true? |
|---|---:|---|
| E. Massachusetts DLS | 16,826 | ✅ yes — one publisher recon |
| **A. salaries & transactions** | **7,938** | ❌ **no — the question is inapplicable** |
| **B. TT-derived** | **7,650** | ❌ **no — we know; see D3** |
| C. state aggregations | 3,344 | ✅ yes — three publisher recons |
| D. single-state ACFRs | 1,971 | ✅ yes — read the opinions, expensive |

**Bucket A is a category error**, the `nonprofit_page_not_a_government` lesson
(#198) in a new place: asking whether a payroll roster was "audited GAAP" is not
an unanswered question, it is an inapplicable one. 7,682 of those rows are CA SCO
`publicpay.ca.gov` compensation data.

⭐ **Bucket A does not currently reach a reader** — `ScopeLabel` renders only for
Money In and Money Out, never for `salaries` or `transactions`. So A distorts any
coverage figure TT publishes rather than lying on a page. **That changes once D2
moves the chip onto more surfaces**, which is why A must be settled *before* the
chip reaches a salary table, not after.

That scoping document ends with three open questions for Chris that were never
answered. They are reproduced in §8 and must be answered by the plan, not
guessed by the builder.

---

## 5. The design

### 5.1 One source at a time, chosen by a switcher — Chris picked this

Where TT holds two differently-measured figures for a place and year, the page
shows **one at a time**, with a control that switches the figure, the chart and
the year range **together**.

> Chris: *"C — have a switcher, don't shorten the charts."*

⭐⭐ **THE SWITCHER ALREADY EXISTS. DO NOT BUILD A SECOND ONE.**
`src/components/FundSeriesToggle.tsx` (SCOPE-03), driven by
`src/data/seriesSelection.ts`, already renders "the series the entity ACTUALLY
has" — a real choice for multi-series entities, a single non-interactive pill
for the rest, and a `computed by Treasury Tracker` marker on derived series. On
the LA City page today it offers All Funds and Total Governmental. **This work
extends that control; it does not add a parallel one.** A second switcher beside
it would be two controls answering overlapping questions, which is precisely the
confusion the source bar exists to remove.

⚠⚠ **`audit_grade` is a PROPERTY of a series, never part of its identity.**
`seriesId()` is `${fundScope}|${basis}` and `seriesSelection.ts` states outright
that `derivation` must not reach it, or "two epistemically-different labels would
split one series into two pills." The same reasoning binds `audit_grade`. Add it
to `AvailableSeries` beside `derivation`, and resolve a mixed series the way
`derivation` already does — **over-disclose: take the weaker grade if the entries
disagree.** That is also the "mixed source takes the weaker branch" rule that
already holds CA SCO and Pennsylvania down in `auditGradeRegistry.mjs`, so the
front end and the loader agree by construction.

✅ Measured 2026-10-30 before settling this: in a 1,000-row sample across 42
municipalities holding audited rows, **zero** `(muni, fy, dataset, scope, basis)`
series carried two different audit grades. One municipality carried two grades
across *different* series, which is the case the over-disclose rule handles. The
rule is a guard against a future collision, not a present cleanup.

⚠ **Piece 1 ships the labelling on a control that already has content.** The
specific audited-vs-government-reported *choice* has nothing to switch to for LA
until piece 2 extracts the ACFR. That is expected and is not a blocked build:
the toggle is live and populated with LA's two existing scope series meanwhile.

⚠⚠ **The constraint that decided it.** For Los Angeles the government-reported
all-funds series runs **FY2003–2025, 23 unbroken years**, and every chart on the
page is drawn from it. The audited ACFR exists at the Federal Audit Clearinghouse
only from **FY2016** and counts a *different set of funds*. Promoting the audited
figure to the headline, as the stated priority order would literally require,
**shortens every chart on the page by 13 years.** The switcher is how the
priority order and the time series stop fighting.

Consequences the builder must preserve:

* The reader never sees an audited label sitting above a government-reported chart.
  Switching is atomic across figure, chart, scope and year range.
* The default view is the one with the complete series — for LA, government-reported
  all-funds. The priority order does **not** mean "default to audited when a
  shorter audited series exists".
* The switcher must say what each option *is*, not just how assured it is:
  "All funds · government-reported" vs "General Fund · audited". The scope
  difference is the reason the numbers differ and it must not be hidden behind
  an assurance word.
* When only one source exists — the overwhelming majority of entities — there is
  no switcher, only the source bar.

### 5.2 Source bar at the top, citation line on every chart — Chris picked this

> Chris: *"C — ... yes, UnAudited means we haven't checked yet."*

* **A source bar** directly under the entity name: the grade chip (with its
  existing disclosure behaviour), the scope, the publisher, the year range, and
  the switcher when there is one. Stated loudly, once.
* **A quiet citation line** under each chart: grade · scope · publisher · year,
  in small type, the way a figure in a printed report carries its source. A
  screenshot of the chart alone is still sourced.

Rejected: a chip on every figure and every chart (option B). It is the literal
reading of the principle and it is the one that fails silently — the same chip
five times down a page stops being read.

⚠ The existing chip is a real `<button>` that opens the plain-language
explainer, and the explainer is the point. Keep that affordance in the source
bar. The per-chart citation line is **plain text, not a button** — matching the
existing treatment of `basis` and `accountingBasis` in `ScopeLabel`, and for the
reason recorded there in Chris's own words during AUSTIN-TRAVIS-01 UAT: a pill
that looks clickable and does nothing is a false affordance.

### 5.3 Vocabulary

Keep all five stored values and all five reader-facing labels. The three tiers
are a *grouping* for source selection and for the switcher's wording, not a
replacement vocabulary. Do not collapse `audited_gaap`, `audited_ocboa` and
`compiled_from_audited` into one label — they say genuinely different things and
the copy for each is already written and tested.

---

## 6. Constraints

1. **`auditGrade.test.ts` is a contract, not a suggestion.** No alarm words on
   `unknown`; no "unverified"/"unreliable" on `self_reported_unaudited`; both
   halves of the OCBOA sentence; no ranking words anywhere; the explainer must
   say the grades are not a ranking; the explainer must not claim the vocabulary
   distinguishes clean from qualified opinions. Extend these tests to cover new
   copy; do not relax them.
2. **Real data only** (`CLAUDE.md`). Every figure through `src/data/dataLoader.ts`.
   If a request fails, report URL and status and stop — never substitute invented
   data. Anything the API does not serve yet goes in `src/mocks/` with the
   prescribed header comment and is listed in the PR.
3. **`e2e/` journeys** must be updated in the same PR if this changes one. A
   journey that reads a figure off a page is exactly what a source bar can break.
   No current journey references LA or a hard-coded fiscal year.
4. **Colour may not encode grade.** All graded chips share one tone on purpose;
   `unknown` keeps neutral grey. Colour is a ranking whether or not you intend
   one. The words carry the distinction. (`AUDIT_TONE` in `ScopeLabel.tsx`.)
5. **Nonprofit pages stay exempt.** The `!isNonprofit` gate exists because for EV
   these are inapplicable questions, not unanswered ones (#198). Any new surface
   must carry the same gate.
6. **No grade may be assigned without the publisher's own evidence**, in the
   `{document, figures}` shape every `auditGradeRegistry.mjs` entry carries.
   D3 is inheritance from an already-evidenced parent, which is why it is in
   scope here; everything else in bucket C/D/E is not.

---

## 7. Sequence — three pieces, agreed order

Chris: *"that order works."*

**Piece 1 — this document.** The labelling work: D1, D2, D3, plus the bucket-A
decision from D4 because it must land before the chip reaches a salary surface.

**Piece 2 — Los Angeles and California.** Extract LA City's audited ACFR so the
switcher has something to switch to; then the FY2025 fleet load tracked in
**issue #313** (521 of 538 CA entities still at FY2024). Scoped separately;
multi-hour; needs its own approval.

**Piece 3 — the rest of the `unknown` cleanup.** Buckets C, D and E of the
2026-10-09 scoping — roughly 22,000 rows, each needing a publisher recon. Steps
1–3 there would take `unknown` from 38,421 to roughly 2,000.

---

## 8. Left to the builder — and what is NOT

**Settle these yourself:** component structure and file layout; whether the
source bar is sticky; exact typography and spacing within the existing token
system; where the citation line sits relative to a chart's own legend; how the
source bar behaves at phone width.

**Already settled, as the author's call — recorded so you can check them:**

* **Extend `FundSeriesToggle`, do not build a second switcher** (§5.1). Settled
  after finding SCOPE-03 already shipped the control Chris asked for.
* **`audit_grade` is a property of `AvailableSeries`, not part of `seriesId()`**,
  with an over-disclose rule on a mixed series (§5.1). Follows the explicit
  `derivation` precedent in `seriesSelection.ts`; verified against live data.
* **D3 is written as a branching registry entry, not a one-off script** (§4/D3).
  Follows the Minnesota OSA precedent.

None of these three changes *what* gets built, only how — but all three would
have been guessed differently by someone who had not read `seriesSelection.ts`.

**Do NOT settle these — they are Chris's, and the plan must put them to him:**

1. **Bucket A (7,938 rows): a new `not_applicable` grade value, or exclude
   non-statement `dataset_type`s from the coverage denominator?** Carried over
   unanswered from 2026-10-09. It changes TT's published coverage figure either
   way, so it is a product call. ⚠ It also gates whether a salary table may
   carry a chip at all.
2. **Bucket D (1,971 rows): worth reading opinions at ~82 rows per family, or
   leave the state-ACFR tail at `unknown` until a state is onboarded for other
   reasons?** Carried over unanswered from 2026-10-09.
3. **Is there an existing Essentials / Civic Spaces consumer of `audit_grade`
   whose published coverage number moves when D3 lands?** Carried over
   unanswered from 2026-10-09. ⚠ A coverage figure measures a publisher, not a
   year — see `sc_city_acfr_route`.

---

## 9. Verification

* `npm test` green, including the extended `auditGrade.test.ts`.
* `npm run build` green. ⚠ `npx tsc --noEmit` checks nothing here — it has passed
  while the build was red three times.
* `npm run e2e` green, with any journey this changes updated in the same PR.
* **Read the real LA City page in a running app** and confirm: the source bar
  states government-reported / all funds / CA State Controller / FY2003–2025;
  the Total Governmental view no longer says "not established"; each chart
  carries its citation line.
* After any D3 write: `node scripts/verifyAxisStamps.mjs --like "Treasury Tracker derived%"`,
  both partition gates green, and the frozen invariant unchanged at
  **62587 / `60098de6`**. ⚠ A red invariant after a write means **sync the
  mirror**, not `--set-baseline`.
* Confirm the four derived families landed on **two** different grades, not one.

---

## 10. Source material

* `.planning/followups/audit-grade-explained-to-readers.md` — what shipped 2026-08-31
* `.planning/AUDIT-GRADE-UNKNOWN-SCOPING.md` — the five buckets, measured 2026-10-09
* `.planning/KNIGHT-COMMUNITIES-SEEDING.md` §3.5 — the grade design and its rules
* `src/data/auditGrade.ts`, `src/components/ScopeLabel.tsx`
* `scripts/data/auditGradeRegistry.mjs`, `scripts/lib/budgetAxes.mjs`
* Issue #313 — the CA FY2025 fleet gap (piece 2)
* FAC route for piece 2: City of Los Angeles EIN `956000735`, FY2016–2025, every
  year `unmodified_opinion`; FY2025 is `2025-06-GSAFAC-0000409337`, fetched free
  and unauthenticated from `https://app.fac.gov/dissemination/report/pdf/<id>`.
  ⚠⚠ That EIN also carries `Port of Los Angeles` and `Los Angeles World
  Airports`. ⚠⚠ LA-01 proved the ACFR does **not** reconcile to the Controller's
  all-funds construction under any stable scope — it is a second series, never a
  correction of the first.
