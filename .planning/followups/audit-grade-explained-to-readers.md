# Follow-up — explain the audit-grade scale to readers

**Filed 2026-08-31, after Knight session 8 (PR #120).**
**Status: NOT STARTED. This is the highest-value unshipped piece of the grade work.**

## The problem in one line

TT now stores **five distinct audit grades** on 88,820 budget rows — and **a
reader cannot see any of them.**

The `audit_grade` column exists, is constrained, is populated, and is invisible.
Everything built across sessions 1–8 to grade honestly currently reaches nobody.

## What is actually stored today

| value | meaning | rows |
|---|---|---|
| `audited_gaap` | read from a report bearing an independent auditor's opinion, GAAP basis | ~28,300 classified |
| `audited_ocboa` | audited to the same standard, but on a NON-GAAP basis (modified cash / regulatory) | 8 — Brown County SD |
| `compiled_from_audited` | a state agency compiled it from audited statements | FL DFS |
| `self_reported_unaudited` | a state agency compiled entity self-reports, or disclaims audit | OH AOS, CA SCO, PA DCED, IN Gateway, MI F-65, GA RLGF, SC RFA |
| `unknown` | **nobody has looked** — never a guess | the majority |

## What the reader needs, and why plain wording matters

⚠⚠ **These terms are not self-explanatory, and two of them actively mislead a
layperson.** This is the substance of the task, not decoration.

* **`unknown` does not mean "bad" or "suspicious".** It means TT has not
  established the assurance level. It is an honesty marker, and if the UI renders
  it as a warning it will libel a lot of perfectly well-audited governments.
* **`self_reported_unaudited` does not mean "made up".** It is a statutory filing
  a finance officer signs, often drawn from audited books — it simply is not
  itself audited. Rendering it as "unverified" overstates the problem.
* **`audited_ocboa` does not mean "worse audit".** The assurance is EQUIVALENT to
  `audited_gaap` — an independent opinion under Government Auditing Standards.
  What differs is the MEASUREMENT BASIS, which makes the figures **not
  comparable** line-for-line with GAAP entities. ⭐ **Assurance and comparability
  are two different things and the UI must not collapse them into one ladder.**
* **`compiled_from_audited` sits between** audited and self-reported: the source
  figures were audited, but a state agency re-cut them.

## ⚠⚠ The gap the scale CANNOT currently express

**A QUALIFIED opinion is graded identically to a CLEAN one.**

An auditor's report has four possible opinions:

| opinion | plain meaning |
|---|---|
| unmodified ("clean") | presents fairly, in all material respects; no reservations |
| **qualified** | "**except for** this one thing", it presents fairly — one specific material issue, everything else fine |
| adverse | the statements as a whole do NOT present fairly |
| disclaimer | the auditor could not form an opinion at all |

**Qualified is much closer to clean than to adverse.** It arises either from a
SCOPE LIMITATION (the auditor could not obtain enough evidence about one item) or
a GAAP DEPARTURE (one item is accounted for incorrectly).

**Harrison County MS is TT's first case, and it is every loaded year (FY2016,
2017, 2021, 2022, 2023).** The cause is identical each time and is the milder
kind — a scope limitation: the County did not maintain an accurate aging of fines
receivable of the Circuit and Justice Courts ($8,230,286 at FY2016), so the
auditor could not satisfy themselves as to that balance.

⚠ Two things not to hand-wave: the auditor explicitly named "Governmental
Activities **and the General Fund**", which is the fund TT loads; and although
the concern is a RECEIVABLE (balance sheet) while TT loads the FLOW statement of
revenues and expenditures, fines revenue is not wholly unrelated to fines
receivable. Not alarming — genuinely not identical to clean.

⚠ FY2016 also carries an ADVERSE opinion, but on the discretely presented
component unit (the Mississippi Coast Coliseum Commission, omitted from the
reporting entity). It does **not** touch the General Fund.

**Decision still open (Chris):** a fifth grade value, an orthogonal
modified-opinion flag, or accept the loss. It was deliberately NOT resolved
unilaterally on top of adding `audited_ocboa` in the same session.

## Scope of the work

1. **ev-accounts passthrough** — `audit_grade` joins `fund_scope`, `basis`,
   `reporting_entity` and `derivation` in `metadata` (`src/types/budget.ts:180`),
   surfaced the same way. This is the mechanical half.
2. **Reader-facing copy** — a short, plain-language explanation of each value,
   reachable from wherever the badge appears. Write it for someone who has never
   heard the word "unmodified".
3. **Do not render it as a 1–5 star ladder.** `audited_ocboa` breaks a linear
   scale: same assurance, different comparability. Two dimensions, or plain
   labels with a tooltip.
4. **`unknown` must read as "not yet established", never as a red flag.**

## Related

* `.planning/KNIGHT-COMMUNITIES-SEEDING.md` §3 — the grade design and vocabulary
* `.planning/KNIGHT-COMMUNITIES-PROGRESS.md` — per-family evidence, incl. the
  Harrison County opinion table and the LFUCG ungraded years
* `scripts/lib/budgetAxes.mjs` — the vocabulary and its warnings

## ⛔ Explicitly DECLINED, not pending

**Recovering the four LFUCG FY2017–20 grades from its Google Drive archive.**
Decided 2026-08-31. It would move 8 rows from `unknown` to `audited_gaap` and
change no figure. Those filings genuinely contain no opinion on the financial
statements, so `unknown` is the CORRECT outcome rather than a defect. ⚠ Note the
archive is a free public share link — this is a value judgement, not a cost one.
