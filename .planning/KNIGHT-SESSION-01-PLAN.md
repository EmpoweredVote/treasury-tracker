# Knight Communities — Session 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `audit_grade` axis, grade the nine already-loaded Knight entities with recorded evidence, repair San Jose's missing CA SCO series, and verify every loaded Knight entity's fiscal calendar against the federal audit record.

**Architecture:** `audit_grade` is a **third axis** on `treasury.budgets`, joining `fund_scope` (SCOPE-01) and `basis` / `reporting_entity` (SCOPE-02). It reuses `classifyAxis()` in `scripts/lib/budgetAxes.mjs` unchanged — that function already enforces "an entry without evidence cannot classify" and already returns the unknown value on every failure path. No new classification machinery is written; only a vocabulary, a registry, a stamping script, and guards.

**Tech Stack:** Node ESM (`.mjs`), vitest, Supabase Postgres (schema `treasury`), `mcp__supabase-local__apply_migration` for DDL.

**Spec:** `.planning/KNIGHT-COMMUNITIES-SEEDING.md`

## Global Constraints

- **Free public data only.** Stop and get approval before any AI/API spend that could exceed **$5**.
- **Never push directly to `main`.** Branch and open a PR.
- **DDL via `mcp__supabase-local__apply_migration`**, then verify with `execute_sql`.
- **NO SHEBANG (`#!`) on any module a test imports** — it breaks `npm test` on Windows.
- **Tests live in `tests/`.** `vitest.config.ts` includes `src/**/*.test.ts`, `tests/**/*.test.mjs`, and `scripts/**/*.test.mjs`; CI runs `npm test`.
- **Never use `treasury_sync_city_budget`** — it is not source-safe; it never updates `data_source` and will overwrite or silently insert a duplicate.
- **An entry without evidence cannot classify.** No inference from a publisher's reputation.
- **Anchor every `data_source` match pattern.** `/^CA State Controller/` is a known bug: it also claims 7,682 publicpay compensation rows.

## Baseline facts (measured 2026-08-28, `main` @ `e100b1c`)

| Fact | Value |
|---|---|
| `treasury.budgets` rows | 87,880 |
| Rows with `data_source_id` | 984 (1.1%) |
| Distinct `data_source` strings | 3,772 |
| `scripts/data/scopeBaseline.json` `frozen_row_count` | 79,916 |
| San Jose rows from `CA State Controller - Expenditures` / `- Revenues` | **0** |
| Palo Alto rows from the same two sources (same county, same loader run) | 22 + 22, FY2003–2024 |

**The nine already-loaded Knight entities:**

| Entity | State | Type | `data_source` |
|---|---|---|---|
| Akron | OH | city | `Ohio Auditor of State Summarized Annual Financial Reports` |
| Summit County | OH | county | same |
| Duluth | MN | city | `Minnesota Office of the State Auditor City/County Finances Report` |
| Saint Paul | MN | city | same |
| Ramsey County | MN | county | same |
| Saint Louis County | MN | county | same |
| Long Beach | CA | city | `CA State Controller - Expenditures` / `- Revenues` (+ GF PDFs, publicpay) |
| Los Angeles County | CA | county | CA SCO |
| Santa Clara County | CA | county | CA SCO |

---

## Task 1: Add the `audit_grade` vocabulary

**Files:**
- Modify: `scripts/lib/budgetAxes.mjs` (append after `REPORTING_ENTITY_VALUES`, line ~35)
- Test: `tests/auditGrade.test.mjs` (create)

**Interfaces:**
- Consumes: `classifyAxis(dataSource, registry, legalValues, unknownValue)` and `validateAxisRegistry(registry, legalValues, unknownValue)`, both already exported from `scripts/lib/budgetAxes.mjs`
- Produces: `AUDIT_GRADE` (frozen object with keys `AUDITED_GAAP`, `COMPILED_FROM_AUDITED`, `SELF_REPORTED_UNAUDITED`, `UNKNOWN`) and `AUDIT_GRADE_VALUES` (frozen array), both from `scripts/lib/budgetAxes.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/auditGrade.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  AUDIT_GRADE,
  AUDIT_GRADE_VALUES,
  classifyAxis,
} from '../scripts/lib/budgetAxes.mjs';

describe('AUDIT_GRADE vocabulary', () => {
  it('has exactly the four spec values', () => {
    expect(AUDIT_GRADE_VALUES).toEqual([
      'audited_gaap',
      'compiled_from_audited',
      'self_reported_unaudited',
      'unknown',
    ]);
  });

  it('is frozen so a caller cannot widen it at runtime', () => {
    expect(Object.isFrozen(AUDIT_GRADE)).toBe(true);
    expect(Object.isFrozen(AUDIT_GRADE_VALUES)).toBe(true);
  });
});

describe('classifyAxis on the audit-grade axis', () => {
  const evidence = { document: 'doc', figures: 'figures' };

  it('returns unknown for a source no entry matches', () => {
    const registry = [
      { id: 'x', match: /^Nope$/, value: AUDIT_GRADE.AUDITED_GAAP, evidence },
    ];
    expect(classifyAxis('Something Else', registry, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual({ value: 'unknown', entryId: null });
  });

  it('refuses to classify an entry that has no evidence', () => {
    const registry = [
      { id: 'x', match: /^Src$/, value: AUDIT_GRADE.AUDITED_GAAP },
    ];
    expect(classifyAxis('Src', registry, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual({ value: 'unknown', entryId: null });
  });

  it('classifies when the entry matches and carries evidence', () => {
    const registry = [
      { id: 'x', match: /^Src$/, value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED, evidence },
    ];
    expect(classifyAxis('Src', registry, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual({ value: 'self_reported_unaudited', entryId: 'x' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/auditGrade.test.mjs`
Expected: FAIL — `AUDIT_GRADE` is not exported from `budgetAxes.mjs`.

- [ ] **Step 3: Add the vocabulary**

In `scripts/lib/budgetAxes.mjs`, immediately after the `REPORTING_ENTITY_VALUES` export:

```javascript
/**
 * How much assurance stands behind a figure.
 *
 * ⚠ The ladder is ordered weakest-assurance-last on purpose, and a source that
 * is MIXED takes the WEAKER branch. Colorado DOLA is the known case: it compiles
 * from "audit OR exemption", so it is self_reported_unaudited unless the specific
 * entity's filing can be identified as audited.
 *
 * ⚠ `unknown` means NOBODY HAS LOOKED. It is never a stand-in for a guess. A row
 * wrongly stamped `audited_gaap` is a false public claim about a government's books.
 */
export const AUDIT_GRADE = Object.freeze({
  /** Read directly from an ACFR bearing an independent auditor's opinion. */
  AUDITED_GAAP: 'audited_gaap',
  /** A state agency compiled it from audited statements. */
  COMPILED_FROM_AUDITED: 'compiled_from_audited',
  /** A state agency compiled entity self-reports, or disclaims audit. */
  SELF_REPORTED_UNAUDITED: 'self_reported_unaudited',
  /** Not yet assessed. */
  UNKNOWN: 'unknown',
});
export const AUDIT_GRADE_VALUES = Object.freeze(Object.values(AUDIT_GRADE));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/auditGrade.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS. Baseline is 1,382 tests; expect 1,387.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/budgetAxes.mjs tests/auditGrade.test.mjs
git commit -m "feat(srcstd): add the audit_grade axis vocabulary

A third axis alongside fund_scope and basis/reporting_entity, reusing
classifyAxis unchanged. unknown means nobody has looked, never a guess."
```

---

## Task 2: Establish the evidence for the three loaded source families

**Files:**
- Create: `.planning/KNIGHT-COMMUNITIES-PROGRESS.md`

**Interfaces:**
- Consumes: nothing
- Produces: verified evidence strings for the three `data_source` families in Task 3's registry. **A family that does not verify gets NO registry entry**, which leaves its rows `unknown` — that is a correct outcome, not a failure.

This task writes no code. Its deliverable is evidence a reviewer can check, because §3.5 of the spec requires the citation to live somewhere a database cannot hold.

- [ ] **Step 1: Determine the Ohio AOS grade**

Fetch `https://ohioauditor.gov/references/SummarizedAnnualFinancialReports` and the filing page `https://ohioauditor.gov/financialreporting/default.html`.

Establish: entities file their own annual financial data through the Hinkle System under ORC §117.38, and AOS summarizes those filings. Confirm whether AOS states these summaries are unaudited.

Expected grade: `self_reported_unaudited`. Record the exact sentence that establishes it.

- [ ] **Step 2: Determine the Minnesota OSA grade**

Fetch `https://www.osa.state.mn.us/reports-data-analysis/local-government/cities/`.

The `Governmental Funds` sheet carries a `GAAPInd` flag per city. Determine whether OSA compiles from audited statements (→ `compiled_from_audited`) or from reporting forms cities submit (→ `self_reported_unaudited`). **`GAAPInd` indicates basis of accounting, not audit status — do not read it as evidence of audit.**

Record the sentence. If OSA's own documentation does not settle it, the grade is `unknown` and MN gets no entry.

- [ ] **Step 3: Determine the CA SCO Cities Annual Report grade**

The SCO Cities Annual Report is compiled from reports cities file with the Controller under Government Code §53891.

Determine whether SCO states these are audited. Note `scripts/data/basisRegistry.mjs` entry `ca-sco-city-exp` already reconciles SCO figures against the Modesto FY2024 ACFR to the dollar — **that establishes the figures are closed-year actuals, not that they were audited by SCO.** Do not reuse it as audit evidence.

Expected grade: `self_reported_unaudited`. Record the sentence.

- [ ] **Step 4: Write the progress file**

Create `.planning/KNIGHT-COMMUNITIES-PROGRESS.md`:

```markdown
# Knight Communities — Progress

Authoritative per-entity status for the campaign in
`.planning/KNIGHT-COMMUNITIES-SEEDING.md`. Updated at the end of every
session, in the same commit as that session's work.

## Source-family audit-grade evidence

| Source family | Grade | Evidence (quoted) | Verified |
|---|---|---|---|
| Ohio Auditor of State Summarized Annual Financial Reports | | | 2026-08-28 |
| Minnesota OSA City/County Finances Report | | | 2026-08-28 |
| CA State Controller - Expenditures / - Revenues | | | 2026-08-28 |

## Entity status

| Entity | State | Type | Status | Source | Grade | Oracle | FY month | PR |
|---|---|---|---|---|---|---|---|---|
| Akron | OH | city | loaded | OH AOS | | | | |
| Summit County | OH | county | loaded | OH AOS | | | | |
| Duluth | MN | city | loaded | MN OSA | | | | |
| Saint Paul | MN | city | loaded | MN OSA | | | | |
| Ramsey County | MN | county | loaded | MN OSA | | | | |
| Saint Louis County | MN | county | loaded | MN OSA | | | | |
| Long Beach | CA | city | loaded | CA SCO | | | | |
| Los Angeles County | CA | county | loaded | CA SCO | | | | |
| Santa Clara County | CA | county | loaded | CA SCO | | | | |
| San Jose | CA | city | partial | CA SCO missing | | | | |
```

Fill the Grade and Evidence columns from steps 1–3. Leave a cell blank only where the evidence genuinely did not settle the question, and write `unknown` in its Grade cell.

- [ ] **Step 5: Commit**

```bash
git add .planning/KNIGHT-COMMUNITIES-PROGRESS.md
git commit -m "docs(knight): record audit-grade evidence for the three loaded source families"
```

---

## Task 3: The audit-grade registry

**Files:**
- Create: `scripts/data/auditGradeRegistry.mjs`
- Test: `tests/auditGradeRegistry.test.mjs` (create)

**Interfaces:**
- Consumes: `AUDIT_GRADE`, `AUDIT_GRADE_VALUES`, `classifyAxis`, `validateAxisRegistry` from `scripts/lib/budgetAxes.mjs`
- Produces: `AUDIT_GRADE_REGISTRY` (array of `{id, match, value, evidence:{document, figures}}`) and `gradeFor(dataSource)` returning `{value, entryId}`, both from `scripts/data/auditGradeRegistry.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/auditGradeRegistry.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { AUDIT_GRADE, AUDIT_GRADE_VALUES, validateAxisRegistry } from '../scripts/lib/budgetAxes.mjs';
import { AUDIT_GRADE_REGISTRY, gradeFor } from '../scripts/data/auditGradeRegistry.mjs';

describe('audit grade registry', () => {
  it('is structurally valid', () => {
    expect(validateAxisRegistry(AUDIT_GRADE_REGISTRY, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN))
      .toEqual([]);
  });

  it('every entry carries non-placeholder evidence', () => {
    for (const entry of AUDIT_GRADE_REGISTRY) {
      expect(entry.evidence.document.trim().length, entry.id).toBeGreaterThan(20);
      expect(entry.evidence.figures.trim().length, entry.id).toBeGreaterThan(20);
      expect(entry.evidence.document.toUpperCase(), entry.id).not.toContain('TODO');
      expect(entry.evidence.document.toUpperCase(), entry.id).not.toContain('TBD');
    }
  });

  it('has unique ids', () => {
    const ids = AUDIT_GRADE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ⚠ THE ANCHORING TRAP. /^CA State Controller/ also matches the publicpay
  // compensation source. SCOPE-01 lost a task to this; San Jose's row counts
  // hid behind it again during this campaign's own scoping.
  it('does NOT classify the publicpay compensation source', () => {
    const publicpay = 'CA State Controller — Government Compensation in California (publicpay.ca.gov)';
    expect(gradeFor(publicpay)).toEqual({ value: 'unknown', entryId: null });
  });

  it('returns unknown for an unregistered source', () => {
    expect(gradeFor('Some City Adopted Budget FY2026')).toEqual({ value: 'unknown', entryId: null });
  });

  it('returns unknown for null and empty input', () => {
    expect(gradeFor(null)).toEqual({ value: 'unknown', entryId: null });
    expect(gradeFor('')).toEqual({ value: 'unknown', entryId: null });
  });
});
```

Then add one `it` per family that Task 2 actually verified. For each verified family, assert the exact grade. Example, for Ohio if step 1 confirmed self-reported:

```javascript
it('grades the Ohio AOS summarized reports', () => {
  expect(gradeFor('Ohio Auditor of State Summarized Annual Financial Reports'))
    .toEqual({ value: 'self_reported_unaudited', entryId: 'oh-aos-summarized' });
});
```

**Do not write an assertion for a family Task 2 left unverified.** Instead assert it returns `unknown`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/auditGradeRegistry.test.mjs`
Expected: FAIL — module `scripts/data/auditGradeRegistry.mjs` not found.

- [ ] **Step 3: Write the registry**

Create `scripts/data/auditGradeRegistry.mjs`. Replace each `evidence` string with the text recorded in Task 2 — these are illustrative of shape, and the values must match what was actually verified:

```javascript
/**
 * Knight campaign — source→audit_grade registry.
 *
 * NO SHEBANG — see scripts/lib/budgetAxes.mjs.
 *
 * ⚠ MATCH PATTERNS ARE ANCHORED PER STRING. /^CA State Controller/ is a known
 * bug: it also claims the publicpay.ca.gov compensation rows, which no audit
 * evidence covers. Both SCO entries below are fully anchored for that reason.
 *
 * ⚠ An entry is created when its evidence is, never before. A family whose
 * audit status could not be established has NO entry here, and its rows stay
 * `unknown`. That is the correct outcome — classifyAxis enforces it.
 *
 * Spec: .planning/KNIGHT-COMMUNITIES-SEEDING.md §3.5
 * Evidence: .planning/KNIGHT-COMMUNITIES-PROGRESS.md
 */

import { AUDIT_GRADE, AUDIT_GRADE_VALUES, classifyAxis } from '../lib/budgetAxes.mjs';

/** @type {import('../lib/budgetAxes.mjs').AxisEntry[]} */
export const AUDIT_GRADE_REGISTRY = [
  {
    id: 'oh-aos-summarized',
    match: /^Ohio Auditor of State Summarized Annual Financial Reports$/,
    value: AUDIT_GRADE.SELF_REPORTED_UNAUDITED,
    evidence: {
      document: '<exact citation recorded in Task 2 step 1>',
      figures: '<the sentence establishing the grade, quoted>',
    },
  },
  // ... one entry per family VERIFIED in Task 2. Omit unverified families.
];

/**
 * Grade one `data_source` string.
 * @param {string|null|undefined} dataSource
 * @returns {{value: string, entryId: string|null}}
 */
export function gradeFor(dataSource) {
  return classifyAxis(dataSource, AUDIT_GRADE_REGISTRY, AUDIT_GRADE_VALUES, AUDIT_GRADE.UNKNOWN);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/auditGradeRegistry.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/auditGradeRegistry.mjs tests/auditGradeRegistry.test.mjs
git commit -m "feat(srcstd): audit-grade registry for the three loaded source families

Patterns fully anchored so publicpay compensation rows are not claimed."
```

---

## Task 4: The `audit_grade` column

**Files:**
- Create: `supabase/migrations/20260828000000_audit_grade_on_budgets.sql`
- Test: `tests/auditGradeColumn.test.mjs` (create)

**Interfaces:**
- Consumes: `AUDIT_GRADE_VALUES` from `scripts/lib/budgetAxes.mjs`
- Produces: `treasury.budgets.audit_grade`, `text NOT NULL DEFAULT 'unknown'`, constrained to the four vocabulary values

**⚠ Spec refinement, deliberate.** §3.4 of the spec says "nullable, no silent default." Implement `NOT NULL DEFAULT 'unknown'` instead, and update §3.4 to match. The reason is the `derivation` precedent in `20260821000000_scope_04_add_derivation.sql`: a default is safe exactly when it is **true of every existing row**. `DEFAULT 'published'` was safe there because every pre-existing row genuinely was published. `DEFAULT 'unknown'` is safe here for the same reason — nobody has assessed any of the 87,880 rows, so `unknown` is true of all of them. This is the opposite of the FYSM `NOT NULL DEFAULT 1` failure, where month 1 was a *claim* about each entity's fiscal calendar that nobody had checked. NOT NULL also removes the "is NULL the same as unknown?" ambiguity that two absent-values would create.

- [ ] **Step 1: Record the pre-migration invariant**

The repo already has the harness for this — it is what `scopeBaseline.json`'s `figures_frozen` hash exists to serve:

Run: `node scripts/verify-budget-axes.mjs`
Expected: PASS against the frozen baseline (`frozen_row_count` 79,916).

Also record the raw pair, via `mcp__supabase-local__execute_sql`:

```sql
select count(*) as rows, sum(total_budget) as sum_total from treasury.budgets;
```

⚠ `scopeBaseline.json` carries its own warning: **do NOT edit or regenerate it to make the harness pass.** `figures_frozen` must never change. If it moves during this session, something wrote a figure that should not have — stop and find out what.

- [ ] **Step 2: Apply the migration**

Use `mcp__supabase-local__apply_migration` with name `audit_grade_on_budgets` and this SQL:

```sql
-- Knight campaign / SRCSTD-01 slice — a figure must declare how much assurance
-- stands behind it.
--
-- WHY THIS COLUMN IS ON `budgets` AND NOT ON `data_sources`:
-- only 984 of 87,880 budget rows (1.1%) carry a data_source_id. The remaining
-- 98.9% are surfaced by ev-accounts assembling data_source_info from the budget
-- row's own data_source / source_url / source_date columns. A grade on the
-- source registry would be invisible for almost everything TT displays.
--
-- It is also correct on the merits: grade is a property of the document a row
-- came from, and it varies BY YEAR within one source name. Madison is the
-- existing proof — audited in some years, unaudited MFR in others.
--
-- WHY `NOT NULL DEFAULT 'unknown'` IS SAFE HERE:
-- a default is safe exactly when it is TRUE of every existing row. Nobody has
-- assessed any of the 87,880 rows, so `unknown` is true of all of them — the
-- same property that made derivation's DEFAULT 'published' safe.
--
-- ⚠ This is NOT the FYSM `NOT NULL DEFAULT 1` mistake. That default asserted a
-- fiscal-year start month — a CLAIM about each entity's calendar that nobody had
-- verified, which then read as fact on ~18,700 rows. `unknown` asserts the
-- absence of an assessment, which is the truth.
--
-- ⚠ NOT added to any index and NOT part of series identity. (fund_scope, basis)
-- still identifies a series; audit_grade is a property of a row's provenance.
ALTER TABLE treasury.budgets
  ADD COLUMN audit_grade text NOT NULL DEFAULT 'unknown';

ALTER TABLE treasury.budgets
  ADD CONSTRAINT budgets_audit_grade_check
  CHECK (audit_grade IN (
    'audited_gaap',
    'compiled_from_audited',
    'self_reported_unaudited',
    'unknown'
  ));
```

- [ ] **Step 3: Verify the column and that no figure moved**

Run via `execute_sql`:

```sql
select count(*) as rows,
       sum(total_budget) as sum_total,
       count(*) filter (where audit_grade = 'unknown') as unknown_rows
from treasury.budgets;
```

Expected: `rows` and `sum_total` identical to step 1; `unknown_rows` equals `rows`.

- [ ] **Step 4: Write the guard test**

Create `tests/auditGradeColumn.test.mjs`. This runs against the live DB the same way the other DB-touching tests in `tests/` do — follow the connection pattern in `tests/scopeVerify.test.mjs`.

```javascript
import { describe, it, expect } from 'vitest';
import { AUDIT_GRADE_VALUES } from '../scripts/lib/budgetAxes.mjs';
// Reuse whatever client helper tests/scopeVerify.test.mjs uses.
import { getSupabase } from '../scripts/lib/supabaseTestClient.mjs';

describe('audit_grade column invariants', () => {
  it('every value is in the vocabulary', async () => {
    const { data, error } = await getSupabase()
      .schema('treasury')
      .rpc('exec_sql', { q: 'select distinct audit_grade from treasury.budgets' });
    expect(error).toBeNull();
    for (const row of data) expect(AUDIT_GRADE_VALUES).toContain(row.audit_grade);
  });

  // ⚠ THE CORE HONESTY GUARD. A graded row must be traceable to the document
  // that justified the grade. Without this, a grade is an unfalsifiable claim
  // about a government's books.
  it('no graded row lacks a source_url', async () => {
    const { data, error } = await getSupabase()
      .schema('treasury')
      .rpc('exec_sql', {
        q: `select count(*)::int as n from treasury.budgets
            where audit_grade <> 'unknown' and (source_url is null or source_url = '')`,
      });
    expect(error).toBeNull();
    expect(data[0].n).toBe(0);
  });
});
```

If `tests/scopeVerify.test.mjs` reaches the DB by a different mechanism, use that mechanism verbatim rather than introducing `exec_sql`. **Read that file before writing this one.**

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/auditGradeColumn.test.mjs`
Expected: PASS. The second assertion passes trivially right now (every row is `unknown`) and becomes load-bearing in Task 5.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260828000000_audit_grade_on_budgets.sql tests/auditGradeColumn.test.mjs
git commit -m "feat(srcstd): add treasury.budgets.audit_grade

NOT NULL DEFAULT 'unknown' is safe because unknown is true of all 87,880
existing rows — the derivation precedent, not the FYSM mistake."
```

- [ ] **Step 7: Update the spec**

Edit `.planning/KNIGHT-COMMUNITIES-SEEDING.md` §3.4 to state `NOT NULL DEFAULT 'unknown'` and carry the reasoning above. Commit:

```bash
git add .planning/KNIGHT-COMMUNITIES-SEEDING.md
git commit -m "docs(knight): §3.4 — NOT NULL DEFAULT 'unknown', with the derivation precedent"
```

---

## Task 5: Stamp the grades on the nine loaded entities

**Files:**
- Create: `scripts/stampAuditGrade.mjs`
- Test: `tests/stampAuditGrade.test.mjs` (create)

**Interfaces:**
- Consumes: `gradeFor(dataSource)` from `scripts/data/auditGradeRegistry.mjs`
- Produces: `planStamps(rows)` from `scripts/stampAuditGrade.mjs`, taking `[{id, data_source, source_url}]` and returning `[{id, audit_grade, entryId}]` for rows whose grade would change and that have a `source_url`

- [ ] **Step 1: Write the failing test**

Create `tests/stampAuditGrade.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { planStamps } from '../scripts/stampAuditGrade.mjs';

describe('planStamps', () => {
  const OH = 'Ohio Auditor of State Summarized Annual Financial Reports';

  it('plans a stamp for a registered source with a source_url', () => {
    const out = planStamps([{ id: 'r1', data_source: OH, source_url: 'https://ohioauditor.gov/x.XLSX' }]);
    expect(out).toEqual([{ id: 'r1', audit_grade: 'self_reported_unaudited', entryId: 'oh-aos-summarized' }]);
  });

  // ⚠ Refusing to stamp is the SAFE direction. A grade with no retrievable
  // document behind it is exactly what the Task 4 guard forbids.
  it('refuses to stamp a row with no source_url', () => {
    expect(planStamps([{ id: 'r2', data_source: OH, source_url: null }])).toEqual([]);
    expect(planStamps([{ id: 'r3', data_source: OH, source_url: '' }])).toEqual([]);
  });

  it('skips unregistered sources', () => {
    expect(planStamps([{ id: 'r4', data_source: 'Nope FY2026', source_url: 'https://x' }])).toEqual([]);
  });

  it('is a pure function — it does not mutate its input', () => {
    const rows = [{ id: 'r5', data_source: OH, source_url: 'https://x' }];
    const snapshot = JSON.parse(JSON.stringify(rows));
    planStamps(rows);
    expect(rows).toEqual(snapshot);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/stampAuditGrade.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the script**

Create `scripts/stampAuditGrade.mjs`. **No shebang** — a test imports it.

```javascript
/**
 * Stamp `audit_grade` on budget rows whose data_source is in the registry.
 *
 * NO SHEBANG — a test imports this module.
 *
 * ⚠ Writes via a direct UPDATE on treasury.budgets by primary key. It does NOT
 * go through treasury_sync_city_budget, which is not source-safe: it never
 * updates data_source and will overwrite or silently insert a duplicate.
 *
 * ⚠ Refuses to stamp any row lacking a source_url. A grade whose justifying
 * document cannot be retrieved is an unfalsifiable claim about a government's
 * books, and tests/auditGradeColumn.test.mjs fails the build if one exists.
 *
 * Usage:
 *   node scripts/stampAuditGrade.mjs --dry-run
 *   node scripts/stampAuditGrade.mjs
 */

import { gradeFor } from './data/auditGradeRegistry.mjs';

/**
 * @param {{id: string, data_source: string|null, source_url: string|null}[]} rows
 * @returns {{id: string, audit_grade: string, entryId: string}[]}
 */
export function planStamps(rows) {
  const out = [];
  for (const row of rows) {
    if (!row.source_url || row.source_url.trim() === '') continue;
    const { value, entryId } = gradeFor(row.data_source);
    if (entryId === null) continue;
    out.push({ id: row.id, audit_grade: value, entryId });
  }
  return out;
}
```

Add the DB driver below the export: page all rows with `.range()` **ordered by the primary key last** (a Supabase RPC caps at 1,000 rows over PostgREST — see `reference_paged_reads_need_total_order` and `scripts/lib/listAllSources.mjs`), call `planStamps`, and under `--dry-run` print a per-`entryId` count without writing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/stampAuditGrade.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Dry-run against the live DB**

Run: `node scripts/stampAuditGrade.mjs --dry-run`

Read the per-`entryId` counts. Sanity-check against the nine entities: Akron and Summit County are ~40 OH AOS rows; the four MN entities ~80 MN OSA rows; Long Beach, LA County and Santa Clara County are the CA SCO rows.

**If any count is wildly larger than the nine entities imply, STOP.** A registry pattern is over-matching — that is the anchoring trap firing again. Fix the pattern before writing.

- [ ] **Step 6: Execute the stamp**

Run: `node scripts/stampAuditGrade.mjs`

- [ ] **Step 7: Verify, including that no dollar moved**

Run: `node scripts/verify-budget-axes.mjs`
Expected: PASS — `figures_frozen` unchanged.

Then via `execute_sql`:

```sql
select audit_grade, count(*) from treasury.budgets group by 1 order by 2 desc;
select count(*) as rows, sum(total_budget) as sum_total from treasury.budgets;
```

Expected: non-`unknown` grades appear; `rows` and `sum_total` match the Task 4 step 1 invariant exactly.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS. The Task 4 "no graded row lacks a source_url" guard is now load-bearing.

- [ ] **Step 9: Commit**

```bash
git add scripts/stampAuditGrade.mjs tests/stampAuditGrade.test.mjs
git commit -m "feat(srcstd): stamp audit_grade on the nine loaded Knight entities

Refuses to stamp any row without a source_url."
```

---

## Task 6: Repair San Jose's missing CA SCO series

**Files:**
- Test: `tests/sanJoseScoSeries.test.mjs` (create)
- Uses: `scripts/bulkLoadStateController.js` (existing, unmodified)

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: CA SCO expenditure and revenue rows for San Jose, FY2003–2024

**Context.** San Jose has **zero** rows from `CA State Controller - Expenditures` / `- Revenues`, while Palo Alto — same county, same loader run — has 22 of each covering FY2003–2024. San Jose is the only one of California's 538 cities missing the series. It was hidden during scoping because a `like 'CA State Controller%'` query counted its 16 publicpay compensation rows: **the anchoring trap, live.**

- [ ] **Step 1: Find out why San Jose was skipped**

Before loading anything, determine the cause. Check whether San Jose is absent from or misnamed in the roster the loader iterates, and whether the SCO API returns it under a different entity name.

Run: `node scripts/bulkLoadStateController.js --county "Santa Clara" --dry-run --list-cities`

**Record the cause in the progress file.** If the cause is a roster omission, other cities may be affected — check before moving on. Do not load San Jose without knowing why it was missing; a silent re-run repairs one symptom and leaves the class.

- [ ] **Step 2: Write the failing test**

Create `tests/sanJoseScoSeries.test.mjs`, asserting San Jose has 22 expenditure and 22 revenue SCO rows spanning FY2003–2024. Match the shape of `tests/caRoster.test.mjs`. **Use fully anchored `data_source` equality — `in ('CA State Controller - Expenditures','CA State Controller - Revenues')` — never a `like` prefix.**

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/sanJoseScoSeries.test.mjs`
Expected: FAIL — 0 rows found, 22 expected.

- [ ] **Step 4: Load, per fiscal year**

`bythenumbers.sco.ca.gov` times out intermittently, so drive one `--fy` at a time in a retry loop rather than one long run (`project_sco_api_flaky_per_fy_retry`):

```bash
for fy in $(seq 2003 2024); do
  node scripts/bulkLoadStateController.js --county "Santa Clara" --fy $fy
done
```

Confirm the loader's never-overwrite guard leaves the other 14 Santa Clara cities untouched.

- [ ] **Step 5: Oracle the load independently**

**A DB check that `total = Σ items` is tautological.** For at least three fiscal years, compare San Jose's loaded totals against an independent `sum()` issued directly to the SCO Socrata endpoint. **Oracle expenditures AND revenues separately** — a broken rollup can pass a headline-only check.

Record the three years and their tie results in the progress file.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/sanJoseScoSeries.test.mjs`
Expected: PASS.

- [ ] **Step 7: Confirm the other 14 Santa Clara cities did not move**

Run via `execute_sql`: re-run the per-city SCO row counts and confirm every other Santa Clara city still reports 22 + 22. **Prove the no-op is a no-op rather than reasoning that it is.**

- [ ] **Step 8: Stamp the new rows and commit**

```bash
node scripts/stampAuditGrade.mjs
npm test
git add tests/sanJoseScoSeries.test.mjs
git commit -m "fix(ca): load San Jose's missing CA SCO series, FY2003-2024

The only one of 538 CA cities without it. Hidden during scoping by a
like 'CA State Controller%' query that counted publicpay rows."
```

---

## Task 7: FAC fiscal-calendar verification for all ten entities

**Files:**
- Test: `tests/knightFiscalCalendars.test.mjs` (create)
- Uses: `scripts/lib/facFiscalYearCensus.mjs` (existing, unmodified)

**Interfaces:**
- Consumes: `censusGuard(entityName, stateCode, month, fiscalYear)` from `scripts/lib/facFiscalYearCensus.mjs`, returning `{ok:true}` or `{error}`
- Produces: a test pinning every loaded Knight entity's `fiscal_year_start_month` against the federal audit record

- [ ] **Step 1: Read the current months**

Run via `execute_sql`:

```sql
select m.name, m.state, b.fiscal_year, b.fiscal_year_start_month, count(*)
from treasury.budgets b join treasury.municipalities m on m.id = b.municipality_id
where (m.name, m.state) in (
  ('Akron','OH'), ('Summit County','OH'),
  ('Duluth','MN'), ('Saint Paul','MN'), ('Ramsey County','MN'), ('Saint Louis County','MN'),
  ('Long Beach','CA'), ('Los Angeles County','CA'), ('Santa Clara County','CA'), ('San Jose','CA')
)
group by 1,2,3,4 order by 1,3;
```

- [ ] **Step 2: Write the failing test**

Create `tests/knightFiscalCalendars.test.mjs`. For every (entity, fiscal_year, month) triple from step 1, assert `censusGuard(name, state, month, fiscalYear)` does not return an `error`.

**Resolve the month PER ROW, not per entity** — entities change fiscal calendars mid-series, and the CA audit found two that did.

**`{ok: true, unknown: ...}` is a pass, not a failure** — the census does not extrapolate, and silence is not disagreement. Assert only on `error`.

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/knightFiscalCalendars.test.mjs`

Two possible outcomes, both informative:

- **PASS** — every month is consistent with the entity's own federal audit filings. Record that in the progress file.
- **FAIL** — a month contradicts the federal record. **This is a real defect, not a test problem.** Do not relax the test. Correct the month per row, following the pattern in `20260825000000_sync_city_budget_fiscal_year_start_month.sql`, then re-run.

⚠ **Never carry a target month between states.** Ohio, Minnesota and California have different conventions, and Summit County is a county in a state whose cities may differ from its counties.

- [ ] **Step 4: Fix any contradictions found**

If step 3 failed, write a migration correcting only the contradicted rows. Verify `sum(total_budget)` is unchanged — this column moves no dollar, which is exactly why the defect can hide.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/knightFiscalCalendars.test.mjs
git commit -m "test(knight): pin the ten loaded entities' fiscal calendars to the FAC census"
```

---

## Task 8: Close the session

**Files:**
- Modify: `.planning/KNIGHT-COMMUNITIES-PROGRESS.md`
- Create: `C:\Users\Chris\.claude\projects\C--treasury-tracker\memory\project_knight_communities_seeding.md`
- Modify: `C:\Users\Chris\.claude\projects\C--treasury-tracker\memory\MEMORY.md`

- [ ] **Step 1: Fill in the progress file**

Complete every column for the ten entities: status, source, grade, oracle result, FY month, PR number. Add a "Session 1 outcomes" section recording the San Jose root cause from Task 6 step 1, the oracle tie results, and whether any fiscal calendar contradicted the federal record.

- [ ] **Step 2: Write the campaign memory**

Create `project_knight_communities_seeding.md` with frontmatter `type: project`, and a body pointing at `.planning/KNIGHT-COMMUNITIES-SEEDING.md` (design) and `.planning/KNIGHT-COMMUNITIES-PROGRESS.md` (authoritative status). Record the roster correction (Boca Raton and Savannah are Knight Ridder, not Knight brothers; Aberdeen SD and Biloxi MS are the real members), and the fact that `audit_grade` is a third axis reusing `classifyAxis`. Link `[[reference_audited_bulk_sources_and_fdta]]`, `[[project_fysm_column_default_one_defect]]`, `[[reference_federal_audit_clearinghouse]]`.

- [ ] **Step 3: Correct the stale test-glob memory**

`reference_ci_and_io_test_timeouts` states that `scripts/*.test.mjs` are outside the vitest globs. **This is no longer true** — `vitest.config.ts` includes `scripts/**/*.test.mjs`, and CI runs `npm test`. Update that memory so a future session does not relocate tests for a reason that has expired.

- [ ] **Step 4: Add both index lines to MEMORY.md**

- [ ] **Step 5: Open the PR**

```bash
git push -u origin docs/knight-communities-seeding
gh pr create --title "Knight communities session 1: audit_grade axis, San Jose SCO repair, FAC calendars" --body "<summary>"
```

⚠ `build-check.yml` fires on `pull_request` to `main` only. If this PR is stacked and its base changes, that is an `edited` event and will **not** trigger the check — close and reopen the PR to force it.

---

## Self-review

**Spec coverage.** §3.3 vocabulary → Task 1. §3.5 evidence → Tasks 2, 3, and the Task 4 guard. §3.2/§3.3 column → Task 4. §3.6 slice scope → Task 5 stamps only registered families, leaving ~87,000 rows `unknown`. §4.6 calendars → Task 7. §6 worklist → Tasks 2 and 8. San Jose (§2.1, §4.3 session 1) → Task 6.

**Not covered here, by design.** §3.7 the ev-accounts passthrough — that repo is not present, and the spec explicitly says the column is not blocked on it. Carry it as a follow-up in the progress file so the grade does not sit invisible, which is the exact failure `sourceChipTypes.ts` documents.

**Type consistency.** `gradeFor(dataSource) -> {value, entryId}` is defined in Task 3 and consumed in Task 5. `planStamps(rows) -> [{id, audit_grade, entryId}]` is defined and consumed in Task 5. `censusGuard(entityName, stateCode, month, fiscalYear) -> {ok}|{error}` matches the existing signature at `scripts/lib/facFiscalYearCensus.mjs:291`.

**Known unknown.** Task 4 step 4 tells the implementer to read `tests/scopeVerify.test.mjs` and copy its DB-access mechanism rather than assume the `exec_sql` RPC shown. That is deliberate — the illustrative code names a mechanism that may not exist, and the step says so explicitly rather than leaving it to be discovered.
