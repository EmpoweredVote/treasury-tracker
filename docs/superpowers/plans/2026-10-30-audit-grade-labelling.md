# Audit-Grade Labelling (piece 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No figure on a Treasury Tracker government page can be read, or screenshotted, without the grade and source that stand behind it — and every grade it shows is one Treasury Tracker can honestly support.

**Architecture:** Three layers, in order. (1) The vocabulary gains a sixth value, `not_applicable`, declared in the six places that must agree. (2) Two data writes correct grades that are wrong today: 6,795 derived California city rows inherit their parents' grade, and 7,932 salary and transaction rows stop claiming an unchecked audit. (3) The reader surface moves the existing chip out of the narrative block into a source bar under the entity name, and gives every chart its own citation line. All new logic lives in pure modules under `src/data/` so it is unit-testable; components stay thin, matching the existing `seriesSelection.ts` / `FundSeriesToggle.tsx` split.

**Tech Stack:** TypeScript + React + Tailwind (Vite), Vitest (`src/**/*.test.ts`), Node ESM loader scripts (`scripts/`, tested by Vitest under `tests/*.test.mjs`), Supabase Postgres (`treasury` schema), Playwright (`e2e/`).

**Spec:** `docs/superpowers/specs/2026-10-30-audit-grade-ui-design.md`

## Global Constraints

- **Branch, never push to `main`.** `git fetch origin && git switch -c feat/audit-grade-labelling origin/main`. One PR.
- **`auditGrade.test.ts` is a contract.** Extend it; never relax it. No alarm words on `unknown`; no "unverified"/"unreliable" on `self_reported_unaudited`; both halves of the OCBOA sentence; no `best|worst|highest|lowest|star|tier|rank|score` in any copy string; the explainer must say the grades are not a ranking and must not claim they distinguish clean from qualified opinions.
- **Colour may not encode grade.** Every graded value shares `VERIFIED_TONE`; `unknown` and `not_applicable` take the neutral grey. (`AUDIT_TONE` in `ScopeLabel.tsx`.)
- **Nonprofit pages stay exempt.** Every new surface carries the same `isNonprofit` / `entity_type !== 'nonprofit'` gate that `PlainLanguageSummary` and `FundSeriesToggle` already carry (#198).
- **Real data only.** Every figure through `src/data/dataLoader.ts`. If a request fails, report URL and status and stop. Never type a real-looking name, number, date or ID into a component.
- **A plain-text label is not a button.** The grade chip is a real `<button>` because it opens the explainer. The citation line, the scope word and the basis word are plain text, because they do not (AUSTIN-TRAVIS-01 UAT).
- **`npm run build`, not `npx tsc --noEmit`.** `tsc` has passed over a red build three times in this repo.
- **Writes go to production** (`kxsdzaojfaibhuzmclfq`). Source credentials only via `set -a; . ./.env; set +a`. Every write is preceded by a `--dry-run` whose counts are checked against this plan's stated numbers before it runs for real.
- **Frozen figure invariant: 62587 / `60098de6`.** Unchanged after every write in this plan. ⚠ A red invariant means **sync the mirror**, never `--set-baseline`.
- **`.gitignore` line 36 is `docs/*`.** Plans and specs need `git add -f` or they silently never commit.

## Review Focus

Five conditions the spec implies that no task's happy path exercises. Each has its test named in the task that owns the code.

1. **A row whose publisher is not recorded** — 16,997 rows have no `data_source_info` (D5). The source bar and citation line must say so in words rather than rendering an empty link or an empty segment. *Test: Task 8, `citationLine` with `publisher: null`.*
2. **A series whose entries disagree on grade** — measured zero today, so only a test will ever see it. Must over-disclose, never pick the stronger. *Test: Task 7, `listSeries` over two entries with different grades.*
3. **An API build that omits `audit_grade`** — absent must read `unknown`, never a grade. Already true in `dataLoader`; the new series and citation paths must not re-introduce a default. *Test: Task 7, `listSeries` over entries with no `audit_grade` field.*
4. **A nonprofit entity** — EV's own rows are `unknown/unknown/unknown` and the questions are inapplicable. No source bar, no citation line. *Test: Task 9, the gate assertion.*
5. **A drilled-in chart** — a reader three levels down screenshots a bar. The citation must render at every navigation depth, not only at the root. *Test: Task 9, e2e journey asserts the citation after a drill click.*

---

## File Structure

| file | responsibility | new? |
|---|---|---|
| `scripts/lib/budgetAxes.mjs` | loader-side vocabulary — `AUDIT_GRADE` gains `NOT_APPLICABLE` | modify |
| `supabase/migrations/20261030000000_audit_grade_not_applicable.sql` | widens both CHECK constraints | create |
| `src/data/auditGrade.ts` | reader-side vocabulary, copy, explainer, `weakestGrade` | modify |
| `src/components/ScopeLabel.tsx` | `AUDIT_TONE` gains the sixth key | modify |
| `scripts/data/auditGradeRegistry.mjs` | one new entry for the two derived **city** families | modify |
| `scripts/stampNotApplicableGrade.mjs` | the `dataset_type` stamp; pure `planNotApplicable` + a `main()` | create |
| `src/data/seriesSelection.ts` | `auditGrade` as a property of `AvailableSeries` | modify |
| `src/data/provenanceLine.ts` | builds the source-bar parts and the citation string | create |
| `src/components/SourceBar.tsx` | the bar under the entity name; wraps `ScopeLabel` + `FundSeriesToggle` | create |
| `src/components/BudgetVisualization.tsx` | renders the citation line it is handed | modify |
| `src/App.tsx` | wires the bar and passes the citation down | modify |

---

### Task 1: `not_applicable` in the loader vocabulary

**Files:**
- Modify: `scripts/lib/budgetAxes.mjs` (`AUDIT_GRADE`, ~line 55)
- Test: `tests/auditGrade.test.mjs`, `tests/auditGradeRegistry.test.mjs`

**Interfaces:**
- Produces: `AUDIT_GRADE.NOT_APPLICABLE === 'not_applicable'`; `AUDIT_GRADE_VALUES` becomes a six-element frozen array ending `['…', 'self_reported_unaudited', 'unknown', 'not_applicable']`.

⚠ **Position is last, and it is not a rung.** The existing test asserts the array order and calls it "strongest assurance first". `not_applicable` is not weaker than `unknown`; it is off that axis entirely. Appending it keeps every existing index stable and the comment must say why it sits there.

- [ ] **Step 1: Write the failing tests** in `tests/auditGrade.test.mjs`

```js
it('can express a record that is not a financial statement', () => {
  expect(AUDIT_GRADE.NOT_APPLICABLE).toBe('not_applicable');
  expect(AUDIT_GRADE_VALUES).toEqual([
    'audited_gaap', 'audited_ocboa', 'compiled_from_audited',
    'self_reported_unaudited', 'unknown', 'not_applicable',
  ]);
});

// ⚠ `not_applicable` answers "what kind of record is this", which the row's own
// dataset_type already says. The registry answers "what did the publisher do".
// An entry carrying this value would dress a row-shape fact as a publisher
// judgement and would have to be repeated for all 26 salary/transaction sources.
it('is never reachable from the registry', () => {
  for (const e of AUDIT_GRADE_REGISTRY) expect(e.value).not.toBe('not_applicable');
});
```

The second test imports `AUDIT_GRADE_REGISTRY` from `../scripts/data/auditGradeRegistry.mjs`; put it in `tests/auditGradeRegistry.test.mjs` if that import is cleaner there.

- [ ] **Step 2: Run them and watch both fail**

Run: `npx vitest run tests/auditGrade.test.mjs tests/auditGradeRegistry.test.mjs`
Expected: FAIL — `AUDIT_GRADE.NOT_APPLICABLE` is `undefined`, and the existing five-value order assertion fails.

- [ ] **Step 3: Add `NOT_APPLICABLE: 'not_applicable'` to `AUDIT_GRADE`**

Last key. Its docstring states: the record is a payroll roster or a payments register, not a financial statement; auditors opine on financial statements, so the question is inapplicable rather than unanswered (#198); it is stamped from `dataset_type`, never from the registry; and it is **not** a sixth rung on the assurance ladder.

- [ ] **Step 4: Update the existing five-value order assertion to six**

The old test's comment about "strongest assurance first" still applies to the first five; extend it rather than deleting it.

- [ ] **Step 5: Run the whole node suite**

Run: `npx vitest run tests/`
Expected: PASS.

- [ ] **Step 6: Confirm the API needs no change — against master, not a working copy**

The spec's §5.4 site 6 says ev-accounts passes `audit_grade` through as a free-form string, so a sixth value needs no API release. That was checked against `C:/EV-Accounts`, which `ev_accounts_archive_folder` warns **is not master**. Re-run it on master before relying on it:

```bash
gh api repos/EmpoweredVote/ev-accounts/search/code --help   # or clone/fetch master and grep
```
Expected: `audit_grade` appears only in `backend/src/lib/treasuryService.ts` (the per-series grouping key and `mapBudget`), its tests, and one index `INCLUDE` list — and in **none** of `coverageService.ts`, `coverageMapService.ts`, `coverageBivariate.ts`, `donorCoverage.ts`. ⚠ If master has an enum, a `CHECK`-mirroring list or a coverage aggregate the working copy does not, **stop**: the sixth value needs an ev-accounts PR first, and the D3 write would move a published number.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/budgetAxes.mjs tests/auditGrade.test.mjs tests/auditGradeRegistry.test.mjs
git commit -m "feat(axes): a payroll roster has no auditor — not_applicable"
```

---

### Task 2: Widen both CHECK constraints

**Files:**
- Create: `supabase/migrations/20261030000000_audit_grade_not_applicable.sql`

**Interfaces:**
- Consumes: the value string from Task 1.
- Produces: `treasury.budgets` accepts `not_applicable`, and accepts it with a null `source_url`.

⚠⚠ **Two constraints, one migration.** `budgets_graded_rows_need_a_source_url` (`20260828000100`) exempts only `unknown`, and **7,753 of the 7,932 target rows (97.7%) have no `source_url`**. Widening only `budgets_audit_grade_check` would be rejected on almost exactly the rows this exists for.

- [ ] **Step 1: Write the migration**

Follow `20260831000000_audit_grade_audited_ocboa.sql` exactly in shape: a WHY section stating what each existing value would have to lie about, a SAFETY section stating that widening a CHECK cannot invalidate a stored row, then the DDL. Both constraints are dropped and re-added:

```sql
ALTER TABLE treasury.budgets DROP CONSTRAINT budgets_audit_grade_check;
ALTER TABLE treasury.budgets ADD CONSTRAINT budgets_audit_grade_check
  CHECK (audit_grade IN ('audited_gaap','audited_ocboa','compiled_from_audited',
                         'self_reported_unaudited','unknown','not_applicable'));

ALTER TABLE treasury.budgets DROP CONSTRAINT budgets_graded_rows_need_a_source_url;
ALTER TABLE treasury.budgets ADD CONSTRAINT budgets_graded_rows_need_a_source_url
  CHECK (audit_grade IN ('unknown','not_applicable')
         OR (source_url IS NOT NULL AND source_url <> ''));
```

The second ALTER needs its own justification in the comment, quoting the original constraint's own words — it *"binds only rows that make a positive claim about assurance"* — and stating that `not_applicable` makes no such claim, that its justification is the row's own `dataset_type` rather than an outside document, and that the alternative (back-filling a `source_url` onto 7,753 payroll rows) would invent an evidence trail for a grade resting on no evidence.

- [ ] **Step 2: Apply it**

Use `mcp__supabase-local__apply_migration` with the file's contents.

- [ ] **Step 3: Verify both constraints by probing, not by reading**

Run two statements and check the outcome of each:
- `select audit_grade from treasury.budgets limit 1` after an attempted `update … set audit_grade='not_applicable'` on **one** salaries row with no `source_url` → succeeds. Roll it back to `unknown` immediately; Task 6 does the real write.
- The same update on **one** operating row with no `source_url` set to `'self_reported_unaudited'` → **fails** with `budgets_graded_rows_need_a_source_url`. That failure is the proof the second constraint still binds.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261030000000_audit_grade_not_applicable.sql
git commit -m "feat(db): not_applicable, and the source_url rule that had to move for it"
```

---

### Task 3: `not_applicable` in the reader vocabulary

**Files:**
- Modify: `src/data/auditGrade.ts`, `src/components/ScopeLabel.tsx`
- Test: `src/data/auditGrade.test.ts`

**Interfaces:**
- Consumes: the value string from Task 1.
- Produces: `AuditGrade` union gains `'not_applicable'`; `AUDIT_GRADE_VALUES` six entries in the same order as Task 1; `AUDIT_GRADE_COPY.not_applicable`; `isAudited('not_applicable') === false`; `AUDIT_TONE.not_applicable`.

- [ ] **Step 1: Write the failing tests** in `src/data/auditGrade.test.ts`

```ts
it('matches the CHECK constraint on treasury.budgets exactly', () => {
  const expected: AuditGrade[] = [
    'audited_gaap', 'audited_ocboa', 'compiled_from_audited',
    'self_reported_unaudited', 'unknown', 'not_applicable',
  ];
  expect([...AUDIT_GRADE_VALUES]).toEqual(expected);
});

it('is false for a record that is not a financial statement', () => {
  expect(isAudited('not_applicable')).toBe(false);
});

// ⚠ The two failures this value exists to prevent. It must not confess to a gap
// (that is `unknown`'s job and it would be false here), and it must not read as
// an accusation about the record.
it('says what the record IS, never what is missing from it', () => {
  const { label, short, long } = AUDIT_GRADE_COPY.not_applicable;
  for (const text of [label, short, long]) {
    expect(text).not.toMatch(/not (yet )?establish|have not checked|unverified|unaudited|missing|no audit\b/i);
  }
  expect(`${short} ${long}`).toMatch(/financial statement/i);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/data/auditGrade.test.ts`
Expected: FAIL — `'not_applicable'` is not assignable to `AuditGrade`; `AUDIT_GRADE_COPY.not_applicable` is undefined.

- [ ] **Step 3: Add the value, the copy and the tone**

In `src/data/auditGrade.ts`: extend the union and `AUDIT_GRADE_VALUES`, and add to `AUDIT_GRADE_COPY`:

```ts
not_applicable: {
  label: 'Not a financial statement',
  short: 'A record of payments rather than a financial statement, so an audit opinion does not apply.',
  long:
    'This record lists what a government paid — individual salaries, or individual payments — '
    + 'rather than summarising its finances for a year in a financial statement. An audit opinion '
    + 'covers financial statements, so for a record of this kind there is no auditor’s opinion to '
    + 'find and none is missing. Where the record came from is shown beside it, exactly as for any '
    + 'other figure.',
},
```

In `src/components/ScopeLabel.tsx`, add `not_applicable` to `AUDIT_TONE` with the **same neutral grey string** `unknown` uses. `AUDIT_TONE` is `Record<AuditGrade, string>`, so the build fails until it is there — that is the gate.

- [ ] **Step 4: Run the front-end suite and the build**

Run: `npm test` then `npm run build`
Expected: both PASS. ⚠ The build is the check, not `tsc`.

- [ ] **Step 5: Commit**

```bash
git add src/data/auditGrade.ts src/data/auditGrade.test.ts src/components/ScopeLabel.tsx
git commit -m "feat(ui): the sixth label — a payroll roster is not a financial statement"
```

---

### Task 4: D1 — the explainer sentence that is live and false

**Files:**
- Modify: `src/data/auditGrade.ts` (`AUDIT_GRADE_EXPLAINER.whyUnknownIsNotBad`, and the module docstring's row counts)
- Test: `src/data/auditGrade.test.ts`

**Interfaces:**
- Produces: nothing new. The exported shape is unchanged; only strings move.

The live sentence claims the "not established" note "is roughly two figures in every three" and that it is "the commonest note on this site". Both were true on 2026-08-31 at 88,820 rows. At 583,569 rows `unknown` is **6.6%** and the commonest note is "Government-reported" at **89.8%**.

- [ ] **Step 1: Write the failing test**

```ts
// ⚠ The previous wording rotted because it hard-coded a fraction. Do not replace
// one fraction with another: word it so it stays true as the corpus grows.
it('states no fraction or percentage that can rot', () => {
  const all = Object.values(AUDIT_GRADE_EXPLAINER).join(' ');
  expect(all).not.toMatch(/\b(one|two|three|four|five|half)\s+(in|of)\s+(every\s+)?(one|two|three|four|five|ten|\d+)\b/i);
  expect(all).not.toMatch(/\b\d+(\.\d+)?\s?%/);
});

it('does not claim which note is commonest', () => {
  const all = Object.values(AUDIT_GRADE_EXPLAINER).join(' ');
  expect(all).not.toMatch(/\bcommonest\b|\bmost common\b|\bmost often\b/i);
});
```

- [ ] **Step 2: Run and watch both fail**

Run: `npx vitest run src/data/auditGrade.test.ts`
Expected: FAIL on both — the live string contains "two figures in every three" and "The commonest note on this site".

- [ ] **Step 3: Rewrite `whyUnknownIsNotBad`**

```ts
whyUnknownIsNotBad:
  'Where a note says the audit status is not established, it means we have not looked yet — a '
  + 'statement about our coverage, not about the government. And where a note says a figure is '
  + 'government-reported, that is an official annual filing signed by a finance officer: a public '
  + 'record, not a rumour, and not the same thing as an audited one.',
```

- [ ] **Step 4: Update the stale counts in the module docstring**

`src/data/auditGrade.ts` lines ~17–23 give the 2026-08-31 distribution and call two values "99.4% of the database". Replace with the 2026-10-30 measurement, dated, and say the share did not worsen — the table grew 6.6× and New York (185k), Michigan (116k) and Pennsylvania (51k) are state agencies compiling self-reports, correctly graded:

```
audited_gaap             1,356 rows —  0.2%
audited_ocboa               28 rows —  0.005%
compiled_from_audited   19,590 rows —  3.4%
self_reported_unaudited 524,174 rows — 89.8%
unknown                 38,421 rows —  6.6%
total                  583,569 rows (measured 2026-10-30)
```

Do the same for the two stale "68% of the database" comments in `src/components/ScopeLabel.tsx` and the "60,368 of 88,820" comment in `src/data/auditGrade.test.ts`. These are comments, so no test pins them — they are the reason the sentence rotted unnoticed.

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: PASS, including `tells the reader the grades are not a ranking` over the rewritten string.

- [ ] **Step 6: Commit**

```bash
git add src/data/auditGrade.ts src/data/auditGrade.test.ts src/components/ScopeLabel.tsx
git commit -m "fix(ui): the explainer said two in three; it is one in fifteen"
```

---

### Task 5: D3 — register the two derived **city** families

**Files:**
- Modify: `scripts/data/auditGradeRegistry.mjs`
- Test: `tests/auditGradeRegistry.test.mjs`

**Interfaces:**
- Produces: registry entry `id: 'ca-sco-derived-total-governmental-city'`, `value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED`.

⚠⚠ **CORRECTION TO THE SPEC.** §4/D3 says to write this as a **branching** entry whose own `value` is `unknown`. **That cannot work, and the code says so.** `classifyAxis` (`scripts/lib/budgetAxes.mjs:168`) returns `{value: unknown, entryId: null}` for any entry whose `value` equals the unknown value, and `gradeFor` returns immediately on a null `entryId` (`auditGradeRegistry.mjs:1542`) — so the branch would never be consulted. The honest shape is the registry's own stated doctrine instead: **an entry is created when its evidence is.** The two city families get one plain entry; the two county families get **no entry at all** and stay `unknown` because their parents are themselves ungraded.

| data_source | rows | after this task |
|---|---:|---|
| `… (CA State Controller - Expenditures)` | 3,403 | `self_reported_unaudited` |
| `… (CA State Controller - Revenues)` | 3,392 | `self_reported_unaudited` |
| `… (CA State Controller - County Expenditures)` | 428 | **stays `unknown`** |
| `… (CA State Controller - County Revenues)` | 429 | **stays `unknown`** |

All 7,652 carry a `source_url`, so none is skipped by `planStamps`' source_url guard.

- [ ] **Step 1: Write the failing tests** in `tests/auditGradeRegistry.test.mjs`

```js
it('grades the derived CITY total-governmental families from their SCO parents', () => {
  for (const s of [
    'Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures)',
    'Treasury Tracker derived: Total Governmental (CA State Controller - Revenues)',
  ]) {
    expect(gradeFor(s)).toEqual({
      value: 'self_reported_unaudited',
      entryId: 'ca-sco-derived-total-governmental-city',
    });
  }
});

// ⚠⚠ The county SCO parents are themselves `unknown` (bucket C, awaiting a
// publisher recon). A derived row may never out-rank its inputs, so these must
// stay ungraded — mapping all four families to one value invents a claim.
it('leaves the derived COUNTY families ungraded', () => {
  for (const s of [
    'Treasury Tracker derived: Total Governmental (CA State Controller - County Expenditures)',
    'Treasury Tracker derived: Total Governmental (CA State Controller - County Revenues)',
  ]) {
    expect(gradeFor(s)).toEqual({ value: 'unknown', entryId: null });
  }
});

// The anchoring trap this file already pins for `^CA State Controller`.
it('does not claim the publisher rows it is derived from', () => {
  expect(gradeFor('Treasury Tracker derived: Total Governmental (CA State Controller - Expenditures) extra'))
    .toEqual({ value: 'unknown', entryId: null });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/auditGradeRegistry.test.mjs`
Expected: FAIL on the first test only — today all four return `{unknown, null}`.

- [ ] **Step 3: Add the entry**

Pattern anchored at **both** ends over exactly the two city labels — no `.*`, no unanchored prefix. `value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED`. The `evidence` object cites two things and must name both: the parent families' own entry and its `CA_SCO_EVIDENCE` (Government Code § 53891(a) — SCO receives and compiles, it does not audit), and the SCOPE-04 derivation that produced these rows from those parents. State in the entry's comment that inheritance is the only permitted direction and that the county families are deliberately absent.

- [ ] **Step 4: Run the node suite**

Run: `npx vitest run tests/`
Expected: PASS. ⚠ `branchingEntryIds` must not list the new entry — it has no `branch`.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/auditGradeRegistry.mjs tests/auditGradeRegistry.test.mjs
git commit -m "feat(axes): a derived row inherits its parents' grade, and only its parents'"
```

---

### Task 6: D3 and `not_applicable` — the two writes

**Files:**
- Create: `scripts/stampNotApplicableGrade.mjs`
- Test: `tests/stampNotApplicableGrade.test.mjs`

**Interfaces:**
- Consumes: Task 2's constraints, Task 5's registry entry.
- Produces: `export function planNotApplicable(rows: {id, dataset_type, audit_grade}[]): {id: string}[]` — returns the rows whose `dataset_type` is `salaries` or `transactions` and whose `audit_grade` is not already `not_applicable`.

⚠ **This cannot go through `stampAuditGrade.mjs`.** That script is registry-driven and skips every row without a `source_url` — which is 97.7% of these. The stamp is a `dataset_type` fact and gets its own script, per spec §5.4.

- [ ] **Step 1: Write the failing tests** for the pure function

```js
it('claims every salaries and transactions row', () => {
  expect(planNotApplicable([
    { id: 'a', dataset_type: 'salaries', audit_grade: 'unknown' },
    { id: 'b', dataset_type: 'transactions', audit_grade: 'unknown' },
  ])).toEqual([{ id: 'a' }, { id: 'b' }]);
});

// ⚠ A statement row must never acquire this value — it would deny that the
// audit question applies to a financial statement, which is the one place it
// always does.
it('never claims a statement row, whatever its grade', () => {
  expect(planNotApplicable([
    { id: 'c', dataset_type: 'operating', audit_grade: 'unknown' },
    { id: 'd', dataset_type: 'revenue', audit_grade: 'self_reported_unaudited' },
    { id: 'e', dataset_type: 'federal_agency', audit_grade: 'unknown' },
  ])).toEqual([]);
});

it('is idempotent', () => {
  expect(planNotApplicable([{ id: 'f', dataset_type: 'salaries', audit_grade: 'not_applicable' }]))
    .toEqual([]);
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/stampNotApplicableGrade.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `scripts/stampNotApplicableGrade.mjs`**

No shebang (a test imports it). `planNotApplicable` pure as specified. `main()` reads every budget row's `id, dataset_type, audit_grade` through `paginate` from `scripts/lib/listAllSources.mjs` with a **total order** (`.order('id')`) and asserts DISTINCT ids equal row count before planning — the paged-read defect this repo has shipped five times. Writes in chunks of 500 by explicit id list, exactly as `stampAuditGrade.mjs` does, never by re-deriving the predicate in SQL. `--dry-run` prints the count and writes nothing.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/stampNotApplicableGrade.test.mjs`
Expected: PASS.

- [ ] **Step 5: Dry-run both stamps and check the numbers against this plan**

```bash
set -a; . ./.env; set +a
node scripts/stampAuditGrade.mjs --dry-run
node scripts/stampNotApplicableGrade.mjs --dry-run
```
Expected, exactly: the first reports **6,795** rows changing under one entry id, `ca-sco-derived-total-governmental-city`. The second reports **7,932**. ⚠ If the first reports 7,652, the county families are being claimed — **stop and fix the pattern**, do not write.

- [ ] **Step 6: Write, then verify**

```bash
node scripts/stampAuditGrade.mjs
node scripts/stampNotApplicableGrade.mjs
node scripts/verifyAxisStamps.mjs --like "Treasury Tracker derived%"
```
Then confirm by query: the four derived families carry **two** distinct grades, not one; `0` rows of `dataset_type` in (`salaries`,`transactions`) remain `unknown`; no row of any other `dataset_type` carries `not_applicable`; both partition gates green; the frozen invariant still **62587 / `60098de6`**.

- [ ] **Step 7: Commit**

```bash
git add scripts/stampNotApplicableGrade.mjs tests/stampNotApplicableGrade.test.mjs
git commit -m "feat(data): 6,795 derived rows inherit a grade, 7,932 payroll rows stop confessing"
```

---

### Task 7: `audit_grade` as a property of a series

**Files:**
- Modify: `src/data/budgetSeries.ts` (`DatasetEntry`), `src/data/seriesSelection.ts`, `src/data/auditGrade.ts`
- Test: `src/data/seriesSelection.test.ts`, `src/data/auditGrade.test.ts`

**Interfaces:**
- Produces:
  - `src/data/auditGrade.ts` → `export function weakestGrade(grades: Iterable<AuditGrade>): AuditGrade`
  - `src/data/budgetSeries.ts` → `DatasetEntry` gains `audit_grade?: string | null`
  - `src/data/seriesSelection.ts` → `AvailableSeries` gains `auditGrade: AuditGrade`

⚠⚠ **`audit_grade` must never reach `seriesId()`.** `seriesId` stays `${fundScope}|${basis}`. `seriesSelection.ts` states the rule for `derivation` in its own words — "two epistemically-different labels would split one series into two pills" — and the same reasoning binds here. Follow `derivation`'s treatment exactly: folded across entries, held on the series, absent from its identity.

- [ ] **Step 1: Write the failing tests**

In `src/data/auditGrade.test.ts`:

```ts
// ⚠ INTERNAL over-disclosure, never a reader-facing rank. It exists so a series
// whose entries disagree states the weaker of them rather than the stronger.
// The "no value ranks itself" contract is about COPY; this is about which copy
// gets chosen.
it('takes the weaker grade when a series disagrees with itself', () => {
  expect(weakestGrade(['audited_gaap', 'self_reported_unaudited'])).toBe('self_reported_unaudited');
  expect(weakestGrade(['self_reported_unaudited', 'unknown'])).toBe('unknown');
  expect(weakestGrade(['audited_gaap'])).toBe('audited_gaap');
});

it('reads an empty series as unknown, never as a grade', () => {
  expect(weakestGrade([])).toBe('unknown');
});
```

In `src/data/seriesSelection.test.ts`:

```ts
it('carries the audit grade without splitting the series', () => {
  const series = listSeries([
    { fiscal_year: 2024, dataset_type: 'operating', fund_scope: 'all_funds', basis: 'actual', audit_grade: 'self_reported_unaudited' },
    { fiscal_year: 2024, dataset_type: 'revenue',   fund_scope: 'all_funds', basis: 'actual', audit_grade: 'audited_gaap' },
  ]);
  expect(series).toHaveLength(1);
  expect(series[0].id).toBe('all_funds|actual');
  expect(series[0].auditGrade).toBe('self_reported_unaudited');
});

// ⚠ An API build that predates the column omits it. Absent is `unknown`, never
// a grade — the same direction normalizeAuditGrade takes and the opposite of
// normalizeDerivation's.
it('reads a series with no grade at all as unknown', () => {
  const series = listSeries([
    { fiscal_year: 2024, dataset_type: 'operating', fund_scope: 'all_funds', basis: 'actual' },
  ]);
  expect(series[0].auditGrade).toBe('unknown');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/data/auditGrade.test.ts src/data/seriesSelection.test.ts`
Expected: FAIL — `weakestGrade` is not exported; `auditGrade` is not a property of `AvailableSeries`.

- [ ] **Step 3: Implement `weakestGrade` in `src/data/auditGrade.ts`**

A module-private `DISCLOSURE_ORDER: readonly AuditGrade[]`, strongest first, ending `'not_applicable', 'unknown'`. `weakestGrade` returns whichever member sits latest in that order, `'unknown'` for an empty input, and reads any unrecognised member through `normalizeAuditGrade` first. ⚠ Its docstring must say in one line that this array is an internal disclosure order and is never rendered, never exported, and never a ranking of assurance — `not_applicable` cannot occur in a series at all (`SERIES_DATASETS` is operating and revenue only) and is listed only to keep the function total.

- [ ] **Step 4: Add the field to `DatasetEntry` and fold it in `listSeries`**

`DatasetEntry.audit_grade?: string | null`, documented like `derivation` above it: optional because an older API build omits it, normalised through `normalizeAuditGrade`. In `listSeries`, accumulate each series' grades the way `derivation` is accumulated in the same loop, and resolve with `weakestGrade` when building the output object.

- [ ] **Step 5: Run the suite and the build**

Run: `npm test` then `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/auditGrade.ts src/data/auditGrade.test.ts src/data/budgetSeries.ts src/data/seriesSelection.ts src/data/seriesSelection.test.ts
git commit -m "feat(ui): a series carries its grade — as a property, never as its identity"
```

---

### Task 8: The provenance line

**Files:**
- Create: `src/data/provenanceLine.ts`, `src/data/provenanceLine.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ProvenanceParts {
  grade: AuditGrade;
  scope: FundScope;
  /** dataSourceInfo.displayName, or null when the API returned none. */
  publisher: string | null;
  /** The period token already on screen, e.g. "2025" or "1976-TQ". */
  period: string;
}
export function citationLine(p: ProvenanceParts): string;
```

- [ ] **Step 1: Write the failing tests**

```ts
it('reads as a printed figure’s source line', () => {
  expect(citationLine({
    grade: 'self_reported_unaudited', scope: 'all_funds',
    publisher: 'CA State Controller', period: '2025',
  })).toBe('Government-reported · All Funds · CA State Controller · FY2025');
});

// ⚠ 16,997 rows have no publisher recorded (spec D5). Saying so is the point:
// a silently missing segment is exactly the failure that defect describes.
it('says the source is not recorded rather than leaving a gap', () => {
  const line = citationLine({
    grade: 'unknown', scope: 'unknown', publisher: null, period: '2024',
  });
  expect(line).toContain('source not recorded');
  expect(line).not.toMatch(/··|·\s*$/);
});

it('names the period the page is showing, not the year it is not', () => {
  expect(citationLine({
    grade: 'audited_gaap', scope: 'general_fund', publisher: 'City ACFR', period: '1976-TQ',
  })).toContain('FY1976 Transition Quarter');
});
```

⚠ The third expectation must agree with how `src/utils/period.ts` already renders a transition-quarter token. Read `parsePeriod` and reuse its label rather than formatting a second one here; if its wording differs, the test takes **its** wording, not this plan's.

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run src/data/provenanceLine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `citationLine`**

Joins the non-empty segments with `' · '`: the grade's `AUDIT_GRADE_COPY[grade].label`, the scope's `FUND_SCOPE_COPY[scope].label`, the publisher (or the literal `source not recorded`), and the period rendered through the existing period helper. Pure — no React, no fetch, matching the stated reason `spanLabel` lives in `seriesSelection.ts`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/data/provenanceLine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/provenanceLine.ts src/data/provenanceLine.test.ts
git commit -m "feat(ui): a chart that is screenshotted alone is still sourced"
```

---

### Task 9: D2 — the source bar and the chart citation

**Files:**
- Create: `src/components/SourceBar.tsx`
- Modify: `src/components/BudgetVisualization.tsx`, `src/App.tsx` (the `FundSeriesToggle` block at ~1652, and the three `<BudgetVisualization>` sites at ~1826, ~1856, ~1911)
- Test: `e2e/journeys.spec.ts`

**Interfaces:**
- Consumes: `citationLine` (Task 8), `AvailableSeries.auditGrade` (Task 7), the existing `ScopeLabel`, `FundSeriesToggle`, and `budgetData.metadata.dataSourceInfo`.
- Produces: `SourceBar` props `{ scope, basis, accountingBasis, auditGrade, publisher, span, children }` — `children` is where `FundSeriesToggle` goes, so there is exactly one control, not two.

⚠ **Two different grades, and they are not interchangeable.** The **bar** sits with the switcher and describes the whole series, so it takes `AvailableSeries.auditGrade` (Task 7, over-disclosed across datasets). A **chart** shows one dataset in one year, so its citation takes `displayData.metadata.auditGrade` (already normalised in `dataLoader.ts`). Using the series grade on a chart would state the weaker of two datasets over a figure drawn from only one of them.

⚠⚠ **DO NOT BUILD A SECOND SWITCHER.** `FundSeriesToggle` (SCOPE-03) already renders the control Chris asked for and already handles the single-series case as plain text. `SourceBar` **wraps** it.

Layout, sticky-or-not, spacing and phone behaviour are the builder's call (spec §8). These are not:

- [ ] **Step 1: Build `SourceBar`**

Renders, in one row: the existing `ScopeLabel` (a real `<button>`, keeping its explainer), the publisher name, the year span via `spanLabel`, and `children`. Carries no colour of its own beyond the tokens `ScopeLabel` already uses — ⚠ an unknown Tailwind class is dropped **silently** in this repo (`ev-gray-050`, not `-50`; there is no `ev-blue` scale).

- [ ] **Step 2: Mount it in `App.tsx` under the entity name**

Replace the bare `<FundSeriesToggle …/>` block at ~1652 with `<SourceBar …><FundSeriesToggle …/></SourceBar>`, keeping the existing `entity_type !== 'nonprofit'` gate and the `yearClampNote` beneath it exactly where they are.

- [ ] **Step 3: Give `BudgetVisualization` a citation**

Add an optional `citation?: string` prop; when present, render it as **plain text** beneath the chart — small, muted, never a button, never a link. Pass it from all three call sites in `App.tsx` from `citationLine(...)`. Putting it inside the component rather than at each call site is what makes it survive the drill-down branches.

- [ ] **Step 4: Leave `PlainLanguageSummary` alone, and gate the new surfaces the same way**

Its two `ScopeLabel`s stay. The source bar states provenance once at the top; the summary keeps its own because it is the block that explains the figures in words.

⚠ **Review Focus 4 — the nonprofit gate.** EV's own rows are `unknown/unknown/unknown` and the questions are inapplicable, not unanswered (#198). `SourceBar` renders behind the existing `entity_type !== 'nonprofit'` gate, and the chart citation is passed as `undefined` for a nonprofit rather than being gated inside `BudgetVisualization` — the component already takes `isNonprofit` for its own reasons and must not grow a second meaning for it. Assert it: a nonprofit page shows no citation line.

- [ ] **Step 5: Add the e2e journey**

In `e2e/journeys.spec.ts`, using the existing `openPinnedCity(page)` helper — ⚠ no hard-coded city, state or fiscal year:

```ts
test('a figure read off a chart carries its source', async ({ page }) => {
  await openPinnedCity(page);
  const citation = page.getByText(/·.*·.*FY\d{4}/).first();
  await expect(citation).toBeVisible();
  // ⚠ Review Focus 5: a reader three levels down screenshots a bar. Drill one
  // level and assert it is STILL there — the three <BudgetVisualization> call
  // sites are separate branches and only one of them is the root.
  await page.getByRole('button', { name: /^[A-Z]/ }).first().click();
  await expect(page.getByText(/·.*·.*FY\d{4}/).first()).toBeVisible();
});
```

⚠ The drill click's locator above is a placeholder shape, not a decision: use whatever locator the surrounding journeys already use to click into a category, so this test breaks for the same reasons they do.

- [ ] **Step 6: Run everything**

Run: `npm test`, `npm run build`, `npm run e2e`
Expected: all PASS. Any existing journey this changes on purpose is updated in this same commit.

- [ ] **Step 7: Read the real page**

`npm run with:dev` — ⚠ **never start `vite` by hand**; nine orphaned processes once ate the machine. On a California city page confirm: the bar states government-reported · all funds · CA State Controller · the full span; switching to Total Governmental **no longer** says "audit status not established"; each chart carries its citation line; and the line still shows after drilling into a category.

- [ ] **Step 8: Commit and open the PR**

```bash
git add src/components/SourceBar.tsx src/components/BudgetVisualization.tsx src/App.tsx e2e/journeys.spec.ts
git commit -m "feat(ui): every figure travels with its provenance"
gh pr create --base main
```

The PR body lists the two data writes with their row counts, the migration, and the spec correction recorded in Task 5.

---

## Verification (whole branch)

- `npm test`, `npm run build`, `npm run e2e` all green.
- The four derived families carry **two** distinct grades; `0` salaries/transactions rows remain `unknown`; no other `dataset_type` carries `not_applicable`.
- `node scripts/verifyAxisStamps.mjs --like "Treasury Tracker derived%"` clean; both partition gates green.
- Frozen invariant **62587 / `60098de6`** unchanged.
- A graded row with no `source_url` is still rejected by the database — proven by attempting one.
- The LA City page read in a running app, per Task 9 Step 7.
