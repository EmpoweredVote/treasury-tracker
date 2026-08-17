# SCOPE-01 — Fund Scope Becomes Knowable

**Status:** spec, awaiting review
**Date:** 2026-08-16
**Origin:** CA-CITIES-01 Task 6 calibration (`docs/superpowers/plans/CA-CITIES-01-RECON.md`)
**Branch (proposed):** `feat/scope-01`

---

## 1. Goal

Establish, for every row in `treasury.budgets`, **which funds the figure covers** — and record
honestly where that is not yet known.

Treasury Tracker currently does not know the fund scope of most of its own rows. It displays
General Fund figures for some cities and all-funds figures for others, in the same charts, in the
same browse grids, at the same per-capita scale, with nothing distinguishing them. In seven
California cities the two scopes meet inside a single city's own history, producing drops of up to
75% that never happened.

**Success:** every row carries a fund scope or an explicit `unknown`; every source's
classification is verified against an independent document rather than asserted; and no
`unknown` row participates in a cross-entity comparison.

**This milestone changes no figure.** It does not remediate, derive, or reload anything. It
records what is true about rows that already exist, and stops the app making comparisons it
cannot justify. Remediation is SCOPE-02; the user-facing toggle is SCOPE-03.

---

## 2. The evidence this rests on

Measured 2026-08-16 during CA-CITIES-01 Task 6, which set out to reconcile Modesto's ACFR against
its State Controller rows and found the two were never describing the same quantity.

**The scopes reconcile exactly.** Modesto FY2024 operating:

| Component | Amount |
|---|---|
| ACFR General Fund | $191,311,703 |
| ACFR Total Governmental | $291,641,122 |
| SCO enterprise + internal service roots | $296,400,946 |
| Total Governmental + enterprise + ISF | **$588,042,068** |
| SCO reported total | **$588,042,068** |

To the dollar, from two independent sources. `treasury.budgets` for a CA city on SCO is
**all funds**; the ACFR figure is **General Fund**. Neither source is wrong.

**Seven cities already show the seam in production**, where an all-funds SCO series hands over to
a General-Fund city-document series mid-history:

| City | Last SCO | First own-source | Apparent change |
|---|---|---|---|
| Long Beach | $3.02B FY2024 | $755M FY2025 | −75.0% |
| Anaheim | $1.64B FY2024 | $491M FY2025 | −70.1% |
| Riverside | $971M FY2022 | $326M FY2023 | −66.4% |
| Santa Ana | $1.08B FY2022 | $404M FY2023 | −62.5% |
| Oakland | $2.05B FY2023 | $834M FY2024 | −59.4% |
| Fresno | $874M FY2019 | $485M FY2020 | −44.5% |
| Bakersfield | $726M FY2024 | $412M FY2025 | −43.2% |

Los Angeles (−4.8%), San Francisco (+0.7%) and San Diego (+0.8%) are clean — their own-source
loads are already all-funds.

**And it is not a California problem.** Cities whose stored tree carries fund-named root
categories, FY2023:

| State | Cities | Demonstrably all-funds | Source |
|---|---|---|---|
| CA | 482 | 431 | SCO |
| MN | 851 | 117 | MN OSA |
| OH | 251 | 92 | Ohio AOS |
| UT | 10 | 10 | Transparent Utah |
| OR | 10 | 1 | Portland |
| AZ · MA · VA · WA | 394 | 0 | various |

⚠ **Zero fund-named roots does NOT prove General Fund.** A source reporting all funds organised
purely by function would also show zero. That table establishes a *lower bound* on all-funds
sources and nothing else — which is precisely why classification must be verified per source
rather than inferred from this scan.

---

## 3. Locked decisions

| Decision | Choice | Why |
|---|---|---|
| **Breadth** | **Classify app-wide, remediate nothing** | Chris, 2026-08-16. Records the truth everywhere and stops silent mixing; CA repair is SCOPE-02 |
| **Scope levels** | `general_fund` · `total_governmental` · `all_funds` · `unknown` | Chris, 2026-08-16. Three real levels, not two — Total Governmental is the level two independent sources reconciled at, and All Funds is what makes enterprise money visible |
| **Unclassified rows** | **Displayed, marked, excluded from cross-entity comparison** | Chris, 2026-08-16. Honest without withholding sourced figures from a city's own residents over a labelling gap |
| **Classification unit** | **Per data source, not per row** | A source has one scope by construction. Per-row guessing is how a heuristic becomes a fact |
| **Verification** | **Each source reconciled against an independent document** | The Modesto method. A source is not classified because its category names look a certain way |
| **Derivation** | **None in this milestone** | Deriving Total Governmental for SCO cities is real and reconciled, but it creates figures the source never printed. That belongs in SCOPE-02 with its own marking |

---

## 4. Design

### 4.1 Schema

Add `fund_scope` to `treasury.budgets` as a text column with a check constraint, defaulting to
`'unknown'` — so a row created by a loader that has not been taught about scope is honestly
unknown rather than silently wrong.

The existing unique index is:

```
idx_budget_municipality_year_type
  ON (municipality_id, fiscal_year, dataset_type, period_label) NULLS NOT DISTINCT
```

`period_label` is already a variant dimension and is **NULL on all 79,927 rows**. Fund scope is a
second, orthogonal variant (period = plan vs actual; scope = which funds), so the index becomes:

```
  ON (municipality_id, fiscal_year, dataset_type, period_label, fund_scope) NULLS NOT DISTINCT
```

This is what will later let one city-year hold a General Fund row *and* a Total Governmental row
without either overwriting the other — the precondition for SCOPE-03's toggle. **No such row is
created in this milestone**; only the capacity for it.

### 4.2 The source→scope registry

Classification attaches to the **data source**, not the row. A registry module maps each distinct
`data_source` family to a scope plus the evidence that established it, and a one-shot migration
stamps `fund_scope` onto matching rows.

Every entry carries: the scope, the document reconciled against, and the figures that matched.
An entry with no evidence is not an entry — the source stays `unknown`.

Sources to classify, with what is known today:

| Source family | Expected | Evidence status |
|---|---|---|
| CA State Controller | `all_funds` | **Verified** — Modesto FY2024 reconciles to the dollar |
| CA city documents (Anaheim, Fresno, Long Beach, Bakersfield, Riverside, Santa Ana, Oakland) | `general_fund` | Strongly implied by title; needs one reconciliation each |
| LA City / SF / San Diego own-source | likely `all_funds` | Implied by a clean seam (−4.8%/+0.7%/+0.8%); needs confirming |
| WA SAO ACFR (8 entities) | `general_fund` | Loaders state GF; needs one reconciliation |
| Oregon city ACFRs, Tucson, Pima | `general_fund` | Same |
| State-level ACFR rows (all 50) | `general_fund` | Documented as GF actuals; needs one reconciliation |
| MN OSA · Ohio AOS · Transparent Utah · MA DLS · VA APA | **unknown** | Genuine recon required — do not guess |
| Federal, nonprofit | n/a | Excluded; fund scope is a municipal concept |

**Anything not positively established stays `unknown`.** That is the milestone working correctly,
not falling short.

### 4.3 Showing the scope, and the explainer

**Every row shows its scope, not only the unknown ones.** An earlier draft marked only
`unknown`, which would have left a classified General Fund figure and a classified All Funds
figure looking identical on screen — the app would know the difference and the reader still
would not. That is most of the original defect, surviving the fix.

So each figure carries a short scope label — General Fund · Total Governmental · All Funds ·
scope not established — sitting with the source, and the label opens **a plain-language
explainer of what the levels mean**. Chris, at review: the marker alone is not enough; the app
has to teach the distinction, because this is the moment a citizen learns it exists.

The explainer's job in THIS milestone is the vocabulary — what each level contains, why a city
has more than one true total, and why two honest figures for the same city can differ by half.
The deeper material — money moving between a city and its enterprises, and why that transfer is
worth watching — belongs with SCOPE-03, where the modes sit side by side and the movement can
actually be shown rather than described.

Copy is drafted in this milestone and reviewed by Chris before it ships. It is public-facing,
and it is the first thing many readers will ever have read about fund accounting.

### 4.3.1 Comparison exclusion

An `unknown`-scope row is displayed with its figure and source, marked as scope-not-established,
and held out of any surface that ranks or compares entities against each other (browse grids,
per-capita rankings, cross-city comparisons). Its own city's page still shows it — the figure is
real and sourced; what is missing is the basis for setting it beside another city's.

Rows of *known but different* scope must also not be silently compared. Comparison surfaces
operate within one scope.

### 4.4 ⚠ The double-count guard — a risk this milestone CREATES

Raised by Chris at review, and it is the sharpest objection to the §4.1 index change.

**Today double-counting is structurally impossible.** The unique index is
`(municipality_id, fiscal_year, dataset_type, period_label)` with `period_label` NULL on all
79,927 rows, so exactly one row exists per city-year-dataset. Any query, however careless, gets
one figure.

**Adding `fund_scope` to that index removes the protection.** Modesto FY2024 could legitimately
hold a $191,311,703 General Fund row *and* a $588,042,068 All Funds row. A read path that does not
filter by scope returns both, and anything that sums them produces $779,353,771 — a number
describing nothing, arrived at by counting the general fund twice.

This is not hypothetical after SCOPE-02, which exists precisely to create second-scope rows.

**Therefore, shipped in this milestone, before any multi-scope row can exist:**

1. **Every read path filters to exactly one scope.** No query returns mixed-scope rows for one
   entity without asking for them. A default scope is chosen per entity — the broadest scope
   that entity has — so existing behaviour is preserved for the single-scope rows that are all
   there is today.
2. **A summation guard.** Any aggregate over multiple rows asserts that its inputs share one
   `fund_scope`, and throws rather than returning a total spanning scopes. Loud, not silent:
   a wrong total that looks plausible is the failure mode this whole milestone exists to end.
3. **A duplicate-detection harness** reporting any (municipality, fiscal_year, dataset_type)
   holding more than one scope. Expected count after SCOPE-01: **zero.** It exists to be correct
   *now* so that it is trustworthy when SCOPE-02 deliberately starts adding second-scope rows —
   a guard first exercised on the data it is meant to police is a guard nobody has tested.

**Sequencing note.** The index change (§4.1) and these three guards ship together, in that order,
in the same milestone. Widening the uniqueness key without them would leave a window in which
double-counting is possible and nothing would notice.

---

## 5. Verification

1. **Classification coverage** — every row has a `fund_scope`; the count in each bucket is
   reported, `unknown` included, with no row uncounted.
2. **Evidence completeness** — every non-`unknown` source entry names a document and the figures
   that reconciled. Asserted mechanically: a registry entry without evidence fails the suite.
3. **No figure changed** — `total_budget`, category and line-item values are byte-identical
   before and after. This milestone touches one column.
4. **Comparison isolation** — no comparison surface returns rows of mixed or unknown scope.
   Mutation-tested: introduce a mixed pair and confirm the guard catches it.
5. **Seam detector** — a harness that flags any entity whose series changes scope between
   consecutive years. Looks along ONE entity's timeline for a false trend; it is not, and must not
   be mistaken for, a duplicate-row check (see 6). It must find exactly the seven known CA cities
   on first run; finding more is a result, finding fewer means it is broken.
6. **Double-count guard** (§4.4) — three parts, each verified separately:
   a. no read path returns mixed-scope rows for one entity unasked;
   b. the summation guard throws on inputs spanning scopes — **mutation-tested** by handing it a
      deliberately mixed pair and confirming it refuses rather than totalling;
   c. the duplicate-detection harness reports zero (municipality, fiscal_year, dataset_type)
      holding more than one scope, which is the correct answer for this milestone and the
      baseline SCOPE-02 will move off deliberately.
7. **Scope is visible** — every displayed figure carries a scope label, and the explainer resolves
   from it. Asserted rather than eyeballed: a figure rendered without a scope label fails.

---

## 6. Out of scope

- **SCOPE-02 — CA remediation.** Deriving Total Governmental for SCO cities (reconciled but
  *derived*, and to be marked as such), closing the seven seams, and supplying General Fund via
  the CA-CITIES-01 extractors.
- **SCOPE-03 — the toggle.** GF ⇄ Total Governmental ⇄ All Funds switching, the enterprise slice
  made visible, and the plain-language explanation of what moves between a city and its
  enterprises.
- **`period_label`.** The plan-vs-actual gap is a sibling defect, still unfixed, still NULL on
  every row. This milestone touches its index but not its meaning.
- **Non-municipal entities.** Federal and nonprofit rows are exempt.

---

## 7. Risks

**The name heuristic is validated on one city.** The enterprise/ISF split reconciled exactly for
Modesto. That is strong evidence for CA SCO, and no evidence at all for MN OSA, Ohio AOS or
Transparent Utah. The registry design contains this risk by construction: a source with no
reconciliation stays `unknown`, so the heuristic can never quietly become a classification.

**Classifying by `data_source` string assumes source families are cleanly named.** They may not
be — `data_source` is free text and has drifted across loaders. Task 1 must enumerate the distinct
values before the registry is designed around them.

**Excluding `unknown` rows from comparison will visibly shrink browse and ranking surfaces**, by
up to several hundred cities until classification catches up. That is the honest state of the
data, and it is a strong forcing function for SCOPE-02 — but it should not surprise anyone at UAT.

---

## 8. Review outcome — 2026-08-16

Reviewed by Chris. Two of his responses changed the design rather than confirming it.

1. **Shrinking comparison surfaces (§7) — acknowledged.** Ships as designed.

2. **Marking language → became an EXPLAINER, and widened §4.3.** Chris: "we need an explainer
   that teaches the differences between the different modes." A cold marker was not enough. This
   surfaced a real gap: the draft marked only `unknown` rows, so two classified rows of different
   scope would still have looked identical to a reader — most of the original defect surviving the
   fix. **Every row now shows its scope, and the label opens a plain-language explainer.**

3. **Seam detector → I was asked whether it prevents "doubling up", and it does not.** It looks
   along one entity's timeline for a scope change between consecutive years; it cannot see
   duplicate rows for a single year. The question exposed a hole: **this milestone's index change
   creates a double-counting risk that does not exist today**, because widening the uniqueness key
   permits two scopes for one city-year where exactly one row is possible now. §4.4 was written in
   response — a read-path scope filter, a summation guard that throws rather than totalling across
   scopes, and a duplicate-detection harness that must read zero here so it is trustworthy when
   SCOPE-02 starts adding second-scope rows on purpose.

**Still open, and deliberately not decided here:**

- **Should state-level rows be classified?** All 50 are General Fund by construction and never
  share a comparison with municipal rows, so it may be ceremony. Cheap either way; the plan can
  settle it.
- **Seam detector as a permanent CI gate?** Chris did not rule on this. Recommendation: yes,
  after the first clean run — it is the only thing that stops a future loader silently
  reintroducing a scope break, which is exactly how the seven happened.
