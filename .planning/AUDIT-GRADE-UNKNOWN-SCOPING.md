# Scoping — the 38,491 `audit_grade = 'unknown'` rows

**Date:** 2026-10-09
**Status:** scoping only. No work authorised, no recon done.
**Measured:** every figure below is from the live table on 2026-10-09, not estimated.

## Why this exists

`treasury.budgets.audit_grade` is what tells a reader whether the number in
front of them was audited. App-wide today:

| Grade | Rows | Share | Entities |
|---|---|---|---|
| `self_reported_unaudited` | 228,138 | 79.4% | 6,633 |
| `unknown` | 38,491 | 13.4% | 1,174 |
| `compiled_from_audited` | 19,590 | 6.8% | 799 |
| `audited_gaap` | 908 | 0.3% | 47 |
| `audited_ocboa` | 28 | 0.0% | 2 |

⚠⚠ **`unknown` is not one problem.** It is five, and only two of them are
cheap. The split below is the whole point of this document: a bulk relabel by
source family — the obvious move — would be wrong on 41% of these rows and a
category error on another 21%.

---

## The five buckets

| Bucket | Rows | Entities | Families | What it actually needs |
|---|---|---|---|---|
| **E. Massachusetts DLS** | 16,826 | 351 | 3 | ONE publisher recon |
| **A. Not a financial statement** | 7,938 | 502 | 27 | a decision, not a grade |
| **B. TT-derived** | 7,650 | 488 | 4 | inherit from inputs |
| **C. State aggregations** | 3,344 | 230 | 4 | per-publisher recon |
| **D. ACFR-sourced** | 1,971 | 74 | 149 | read the opinions — expensive |

### E. Massachusetts DLS — 16,826 rows, 351 entities, **3 families**

`… — MA General Fund Expenditures` (8,408), `… — MA General Fund Revenues`
(6,663), `… — MA DLS General Fund Revenue by Source` (1,755).

**The single largest win available, and the cheapest per row.** 44% of all
unknown rows resolve from **one publisher question**: what is the audit status
of the data the Massachusetts Division of Local Services publishes in its
Schedule A / Gateway returns? One recon, one registry entry, 16,826 rows.

⚠ Each of the 351 towns has its own `data_source` string, which is why this
looked like 1,686 unrelated families in a naive grouping. It is three shapes.

### A. Not a financial statement — 7,938 rows

`dataset_type` in `salaries` (7,904), `salary` (6), `transactions` (28);
7,682 of them CA SCO `publicpay.ca.gov` compensation data.

⚠⚠ **ASKING WHETHER A PAYROLL FILE WAS "AUDITED GAAP" IS A CATEGORY ERROR.**
`audit_grade` describes whether a *financial statement* carried an opinion. A
compensation roster is not a financial statement, so these rows are not
*unanswered* — the question is *inapplicable*. This is exactly the
`nonprofit_page_not_a_government` lesson (#198): an inapplicable question is
not an unanswered one, and gating on `unknown` rather than on applicability is
what produced a false coverage number there.

**Decision needed before any work:** either a distinct value
(`not_applicable`), or exclude non-statement `dataset_type`s from the coverage
denominator entirely. **Do not grade them.** Whichever is chosen, 21% of the
unknown pile stops being a gap and starts being a correctly-answered question.

### B. TT-derived — 7,650 rows, 4 families

`Treasury Tracker derived: Total Governmental (CA State Controller — …)`.

**We computed these.** They can carry no more assurance than their inputs, so
they inherit whatever bucket C settles on — and must be re-derived if it
changes. ⚠ Grading them independently would let a derived row out-rank the
figures it was derived from.

### C. State aggregations of local filings — 3,344 rows, 4 families

CA SCO county revenues/expenditures (2,376), Virginia APA Comparative Report
(608), Transparent Utah (~360).

Each needs the publisher's **own** statement of audit status, in writing, as
`oh-aos-summarized` and `ga-dca-rlgf` already have. ⚠ The honest answer is
probably `self_reported_unaudited`, but it is **not assumable**: Florida DFS
sits at `compiled_from_audited` on the strength of the publisher's own manual,
and Minnesota branches per entity class because a *statute* makes the audit
unconditional for counties. Three publishers, three different answers, all
evidenced. ⚠⚠ CA SCO is the `^CA State Controller` trap the registry already
warns about twice — anchor any entry at both ends.

### D. ACFR-sourced — 1,971 rows, 74 entities, 149 families

Mostly single-state ACFR families (e.g. `Alabama State ACFR — General Fund`,
24 rows each).

**The only bucket that can genuinely move UP to `audited_gaap`**, and the most
expensive: each family costs what NYC cost — read the opinion in every book in
the window, then register an entry anchored to exactly that window. ~82 rows
of benefit per family. ⚠ Worth doing per state, not in bulk.

---

## What this is NOT

⚠⚠ **This moves almost nothing up.** Buckets A, B, C and E end at
`self_reported_unaudited`, `compiled_from_audited`, or no grade at all. The
deliverable is **an honest label**, not a better one — TT stops saying "we
don't know" about 33,000 rows whose provenance it does in fact know.

⚠⚠ **No grade may be assigned without the publisher's own evidence**, in the
`{document, figures}` shape every existing entry carries. Bulk-assigning by
family name is how you get a confident number that is wrong, which is the
defect `audit_grade_reader_facing` (#122) already records: 99.4% of what a
reader sees is unknown or self-reported, and the spec's own row table was
wrong about it.

---

## Suggested order, cheapest-first

1. **A — the applicability decision** (7,938 rows). No recon. One schema/
   policy call plus a coverage-denominator change. Biggest honesty gain per
   hour; unblocks any accurate coverage figure.
2. **E — Massachusetts DLS** (16,826 rows). One publisher recon, one entry.
   By far the best rows-per-unit-of-work in the table.
3. **C — three publisher recons** (3,344 rows), then **B inherits** (7,650).
   B is free once C lands, but *only* if the derivation re-runs.
4. **D — per state, opportunistically** (1,971 rows). Real upgrades, real cost.

Steps 1–3 would take `unknown` from **38,491 to roughly 2,000**, with zero
rows claiming more assurance than their evidence supports.

## Open questions for Chris

- **A:** new `not_applicable` value, or exclude non-statement `dataset_type`s
  from the denominator? This changes the published coverage figure either way,
  so it is a product call, not a data one.
- **D:** worth doing at all at ~82 rows per family, or leave the state-ACFR
  tail at `unknown` until a state is onboarded for other reasons?
- Is there an existing Essentials/Civic Spaces consumer of `audit_grade` whose
  coverage number would move when these land? ⚠ A coverage figure measures a
  publisher, not a year — see `sc_city_acfr_route`.
