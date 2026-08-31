# Follow-up — explain the audit-grade scale to readers

**Filed 2026-08-31, after Knight session 8 (PR #120).**
**Status: SHIPPED 2026-08-31 — `src/data/auditGrade.ts` + the ScopeLabel chip in
Treasury Tracker, `audit_grade` passthrough in ev-accounts. The qualified-opinion
gap below remains OPEN and is the only unshipped part.**

## The problem in one line

TT stores **five distinct audit grades** on 88,820 budget rows — and until
2026-08-31 **a reader could see none of them.**

The `audit_grade` column existed, was constrained, was populated, and was
invisible. Everything built across sessions 1–8 to grade honestly reached nobody.

## What is actually stored today

⚠⚠ **CORRECTED 2026-08-31.** The first draft of this table put "~28,300
classified" against `audited_gaap`. That was the count of ALL classified rows,
mis-attributed to one value. Measured against the database:

| value | meaning | rows | entities | share |
|---|---|---:|---:|---:|
| `audited_gaap` | read from a report bearing an independent auditor's opinion, GAAP basis | 342 | 15 | 0.4% |
| `audited_ocboa` | audited to the same standard, but on a NON-GAAP basis (modified cash / regulatory) | 8 | 1 | 0.01% |
| `compiled_from_audited` | a state agency compiled it from audited statements (FL DFS) | 190 | 7 | 0.2% |
| `self_reported_unaudited` | a state agency compiled entity self-reports, or disclaims audit (OH AOS, CA SCO, PA DCED, IN Gateway, MI F-65, GA RLGF, SC RFA) | 27,912 | 835 | **31.4%** |
| `unknown` | **nobody has looked** — never a guess | 60,368 | 2,122 | **68.0%** |

⭐ **This is why the wording is the whole task and the rendering is not.** The two
values the next section warns will mislead a layperson are **99.4% of what a
reader will ever see**. Making `audited_gaap` look good affects 0.4% of rows;
wording the other two so they do not libel 2,957 governments is the job.

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

**Decision still open (Chris):** a sixth grade value, an orthogonal
modified-opinion flag, or accept the loss. It was deliberately NOT resolved
unilaterally on top of adding `audited_ocboa` in the same session.

⭐ **DEFERRED, 2026-08-31 (Chris).** The reader-facing work shipped without it, on
these grounds: the invisibility gap affected 88,820 rows and every reader, while
this one affects **10 rows on one entity** (Harrison County MS FY2016/17/21/22/23
× operating + revenue); and because opinion is ORTHOGONAL to grade, adding it
later is an addition rather than a rework. `auditGrade.test.ts` forbids the
explainer copy from claiming a precision the vocabulary does not have — it may not
use the words "clean opinion" or "unmodified opinion" — so the shipped copy does
not paper over this gap.

## Scope of the work — DONE except where noted

⭐ **What shipped 2026-08-31:**
* `src/data/auditGrade.ts` — type, `normalizeAuditGrade()` (absent -> `unknown`,
  the OPPOSITE default from `normalizeDerivation()`), `isAudited()` (TRUE for both
  audited values), `AUDIT_GRADE_COPY`, `AUDIT_GRADE_EXPLAINER`.
* `auditGrade.test.ts` — 15 tests. The load-bearing ones pin the copy against
  drift: no alarm word on `unknown`, no "unverified" on `self_reported_unaudited`,
  both halves of the OCBOA sentence, no ranking words anywhere.
* `ScopeLabel.tsx` — a second chip beside the fund-scope one, with its own
  disclosure state. ⚠ **All graded values share ONE colour**; `unknown` keeps the
  existing neutral grey. Colour is a ranking whether or not you intend it, so the
  WORDS carry the distinction. Verified in the running app by reading
  `getComputedStyle` off the rendered chip.
* ev-accounts: `audit_grade` at all ten sites in `treasuryService.ts`, plus a NEW
  `tests/integration/treasury-budgets.test.ts` — the budget payload had NO
  contract test at all, on the very route that feeds the reader's figure.

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
