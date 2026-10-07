# Phase 2 — the `accounting_basis` axis, then Duvall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a measurement-basis axis to `treasury.budgets` that refuses a proven GAAP-vs-cash comparison, then publish Duvall, WA's cash-basis BARS General Fund rows behind it.

**Architecture:** `accounting_basis` is a fourth independent axis beside `fund_scope`, `basis` and `audit_grade`, following their exact pattern: a frozen vocabulary in `scripts/lib/budgetAxes.mjs`, an evidenced registry, a CHECK constraint that is the real enforcement, and a reader-facing copy table. The comparability rule blocks only a **proven** mismatch. Duvall then loads on the existing `acfrGF.py` pipeline via a per-entity config — no new extractor subsystem.

**Tech Stack:** Node 24 (ESM `.mjs`), Python 3.14 via `scripts/lib/pythonBin.mjs`, poppler, vitest, Supabase (DDL through `mcp__supabase-local__apply_migration`), TypeScript/React for the chip.

**Spec:** `docs/superpowers/specs/2026-10-06-redmond-duvall-accounting-basis-design.md` (§1.1 phasing, §3 Duvall, §4 the axis, §5 verification)

---

## Global Constraints

- **⛔ THE ORDERING IS A HARD DEPENDENCY, NOT A PREFERENCE.** The axis must exist and gate **before Duvall's first loaded row** (spec §1.1). Duvall is the first row set the axis exists to describe; loading it first publishes a cash-basis General Fund that `isComparableScope()` calls comparable to Redmond's GAAP one.
- **⛔ PHASE 2 MAY NOT CLOSE WITH THE AXIS SHIPPED AND DUVALL UNLOADED.** That leaves a gate guarding nothing — a vacuous check, which this repo has shipped before.
- **MCAG `0391`, a STRING.** Leading zeros are significant.
- **Duvall is NOT GAAP.** Unmodified opinion on the regulatory BARS basis, **adverse on U.S. GAAP**. `audit_grade = 'audited_ocboa'`, `accounting_basis = 'cash'`.
- **`basis` already means `actual|adopted|unknown`** (closed-year actual vs adopted budget). It is a different axis. Never overload it.
- **`accounting_basis` defaults to `'unknown'` and is stamped only from evidence.** Nothing is classified by absence. **No bulk `gaap` backfill.**
- **The comparability rule blocks only when both bases are KNOWN AND DIFFERENT.** `unknown` on either side preserves today's behaviour. The inverse rule would switch off comparison site-wide on day one, exactly as `audit_grade` is 68% `unknown`.
- **Colour is never the distinction.** Every graded value shares one tone on purpose; the WORDS carry it (`ScopeLabel.tsx:60-72`).
- **⚠ `bg-ev-gray-050`, not `-50`.** A bad Tailwind class is dropped silently.
- **Biennial PDFs are saved under BOTH years' filenames**, identical bytes (spec §3.4). The sha manifest will pin one digest under two names — correct, do not "fix" it.
- **NO SHEBANG on anything under `scripts/lib/` or `scripts/data/`**, and on nothing a test imports. A `#!` plus CRLF breaks the whole vitest suite with a `SyntaxError` naming no file.
- **`py`/`python` on PATH are Microsoft Store stubs.** Use `resolvePython()` from `scripts/lib/pythonBin.mjs`.
- **`docs/*` is gitignored** — force-add with `git add -f`.
- **Use `mcp__supabase-local__apply_migration` for DDL, then verify.**
- **After any load that inserts rows:** `npm run verify:frozen`, then `npm run register:rows -- --milestone duvall --match "..."`, then `node scripts/syncFrozenInvariantState.mjs`. Phase 1 shipped without this and left the invariant red.
- **Re-measure `LOCAL_ROWS_BY_ENTITY` and `BASELINE` in `scripts/lib/waFiscalCalendar.mjs` in the same commit as the load.** Phase 1 did not and `verifyWAFiscalYearStartMonth` failed on every run while `npm test` stayed green.
- **Branch and open a PR.** Never push to `main`. Branch: `feat/redmond-duvall-accounting-basis`.
- **Test command:** `npm test`. Single file: `npx vitest run tests/<file>`.

---

## Review Focus

Five failure modes the spec implies that no happy path exercises. Each has a test pinned to the task that owns the code.

1. **The comparability gate blocks everything.** `accounting_basis` starts 100% `unknown`; a rule phrased "comparable only if both known and equal" switches off cross-entity comparison site-wide. → Task 3, both directions asserted.
2. **Duvall's memo column is loaded as the General Fund.** `Total for All Funds (Memo Only)` is printed **first**, so a `target_column=0` default silently publishes all-funds money under a General Fund label, tying at $0. → Task 6, asserted against the shipped config and a transcribed page.
3. **BARS line codes parse as money.** `310 Taxes` makes `310` a value; every group heading becomes a ~$310 leaf and the tree comes back flat while the total is only slightly over — plausible enough to ship. → Task 6, `leading_account_code` asserted.
4. **A biennial PDF publishes FY2012's money under FY2013.** One file, two statements; taking the first candidate is the silent wrong-page failure that tied at $0 nine times out of ten in WA-CITIES-01. → Task 7, per-year selection asserted both ways.
5. **A cash-basis row is published under a GAAP label.** Bainbridge's budget-basis GF detail "must never be published under a GAAP label"; `audited_gaap` on Duvall would be a false public claim. → Task 8, asserted on the loaded rows.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261006000000_accounting_basis.sql` | **Create** — column + CHECK constraint |
| `scripts/lib/budgetAxes.mjs` | **Modify** — `ACCOUNTING_BASIS` vocabulary + values |
| `scripts/data/accountingBasisRegistry.mjs` | **Create** — evidenced source→basis entries |
| `scripts/lib/fundScope.mjs` | **Modify** — `isComparablePair()` |
| `src/data/accountingBasisVocabulary.ts` | **Create** — reader-facing copy + TS type |
| `src/components/ScopeLabel.tsx` | **Modify** — the chip |
| `scripts/stampAccountingBasis.mjs` | **Create** — the stamper |
| `scripts/fetchWaCities.mjs` | **Modify** — `DUVALL_ARNS`, biennial double-save |
| `scripts/extractDuvall.py` | **Create** — BARS `CityConfig` |
| `scripts/lib/acfrGF.py` | **Modify** — select a statement by printed year |
| `scripts/lib/waRoster.mjs` | **Modify** — Duvall entity |
| `scripts/lib/waFiscalCalendar.mjs` | **Modify** — re-measured baseline |
| `scripts/processDuvall.js` | **Create** — loader driver |
| `tests/accountingBasis.test.mjs`, `tests/accountingBasisColumn.test.mjs` | **Create** — vocabulary, registry, constraint parity |

---

### Task 1: The `accounting_basis` vocabulary

**Files:**
- Modify: `scripts/lib/budgetAxes.mjs`
- Test: `tests/budgetAxes.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `ACCOUNTING_BASIS` (frozen object), `ACCOUNTING_BASIS_VALUES` (frozen array of 4 strings)

- [ ] **Step 1: Write the failing test**

Add to `tests/budgetAxes.test.mjs`:

```javascript
import { ACCOUNTING_BASIS, ACCOUNTING_BASIS_VALUES } from '../scripts/lib/budgetAxes.mjs';

describe('ACCOUNTING_BASIS', () => {
  it('carries exactly the four grounded values', () => {
    // ⚠ Each is grounded in a document TT already holds or is loading — GAAP
    // (Redmond, Aberdeen SD), modified cash (Brown County SD), cash (Duvall).
    // No speculative values: an unused vocabulary value is a claim nobody can
    // falsify, and this axis exists to stop unfalsifiable claims.
    expect([...ACCOUNTING_BASIS_VALUES].sort())
      .toEqual(['cash', 'gaap', 'modified_cash', 'unknown']);
  });

  it('is a DIFFERENT axis from `basis`, which means actual-vs-adopted', () => {
    // budgets.basis is CHECK (basis IN ('actual','adopted','unknown')). If these
    // two vocabularies ever intersect, someone has conflated measurement with
    // closed-year-vs-budget and both meanings are destroyed.
    const overlap = ACCOUNTING_BASIS_VALUES.filter((v) => BASIS_VALUES.includes(v) && v !== 'unknown');
    expect(overlap).toEqual([]);
  });

  it('is orthogonal to audit_grade — assurance is not measurement', () => {
    // An unaudited cash-basis source must be describable. Deriving basis from
    // `audited_ocboa` would make it invisible.
    const overlap = ACCOUNTING_BASIS_VALUES.filter((v) => AUDIT_GRADE_VALUES.includes(v) && v !== 'unknown');
    expect(overlap).toEqual([]);
  });

  it('freezes the vocabulary', () => {
    expect(Object.isFrozen(ACCOUNTING_BASIS)).toBe(true);
    expect(Object.isFrozen(ACCOUNTING_BASIS_VALUES)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/budgetAxes.test.mjs`
Expected: FAIL — `ACCOUNTING_BASIS` is not exported.

- [ ] **Step 3: Add the vocabulary**

Add to `scripts/lib/budgetAxes.mjs`, after `AUDIT_GRADE_VALUES`:

```javascript
/**
 * HOW A FIGURE WAS MEASURED — the accounting basis of the statements it came
 * from. A FOURTH axis, independent of the other three.
 *
 * ⚠⚠ NOT `basis`. `treasury.budgets.basis` is CHECK (basis IN
 * ('actual','adopted','unknown')) and means "closed-year actual or adopted
 * budget". That is a different question and it already earns its keep;
 * overloading it would destroy both meanings.
 *
 * ⚠⚠ NOT `audit_grade` EITHER. That is ASSURANCE — how much independent
 * checking stands behind the figure. Measurement and assurance are
 * independent: Brown County SD is audited to Government Auditing Standards on
 * a modified cash basis, and an UNAUDITED cash-basis source must also be
 * describable. Deriving this axis from `audited_ocboa` would make that source
 * invisible, and would re-encode the confusion the OCBOA migration was written
 * to escape.
 *
 * Every value is grounded in a document TT holds. No speculative values: an
 * unused vocabulary value is a claim nobody can falsify.
 */
export const ACCOUNTING_BASIS = Object.freeze({
  /** U.S. GAAP. Redmond WA, Aberdeen SD, every ACFR-derived family. */
  GAAP: 'gaap',
  /** Modified cash. Brown County SD — statements titled `... - MODIFIED CASH BASIS`. */
  MODIFIED_CASH: 'modified_cash',
  /** Cash. Duvall WA — WA BARS regulatory basis, adverse opinion on U.S. GAAP. */
  CASH: 'cash',
  /** Nobody has looked. The default, and a correct outcome. */
  UNKNOWN: 'unknown',
});
export const ACCOUNTING_BASIS_VALUES = Object.freeze(Object.values(ACCOUNTING_BASIS));
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/budgetAxes.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/budgetAxes.mjs tests/budgetAxes.test.mjs
git commit -m "feat(axes): add the accounting_basis vocabulary"
```

---

### Task 2: The column, the constraint, and parity

**Files:**
- Create: `supabase/migrations/20261006000000_accounting_basis.sql`
- Create: `tests/accountingBasisColumn.test.mjs`

**Interfaces:**
- Consumes: `ACCOUNTING_BASIS_VALUES` from Task 1
- Produces: `treasury.budgets.accounting_basis text NOT NULL DEFAULT 'unknown'` with `budgets_accounting_basis_check`

- [ ] **Step 1: Write the failing parity test**

Create `tests/accountingBasisColumn.test.mjs`, modelled on `tests/auditGradeColumn.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { ACCOUNTING_BASIS_VALUES } from '../scripts/lib/budgetAxes.mjs';

const MIGRATIONS = 'supabase/migrations';

/**
 * ⚠ The vocabulary is asserted against the LAST migration that declares the
 * constraint, not the one that first added the column. Pinning the original
 * would fail for a correct schema once a value is added, and — worse — would
 * keep passing if a later migration DROPPED a value, because the original
 * still mentions it.
 */
const declaring = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .filter((f) => readFileSync(`${MIGRATIONS}/${f}`, 'utf8').includes('budgets_accounting_basis_check'))
  .sort();

describe('the accounting_basis column', () => {
  it('is declared by at least one migration', () => {
    expect(declaring.length).toBeGreaterThan(0);
  });

  it('defaults to unknown and is NOT NULL — nothing is classified by absence', () => {
    const sql = readFileSync(`${MIGRATIONS}/${declaring[0]}`, 'utf8');
    expect(sql).toMatch(/accounting_basis\s+text\s+NOT NULL\s+DEFAULT\s+'unknown'/i);
  });

  it('the CHECK in force covers EXACTLY the vocabulary', () => {
    const sql = readFileSync(`${MIGRATIONS}/${declaring[declaring.length - 1]}`, 'utf8');
    const m = /budgets_accounting_basis_check[\s\S]*?CHECK\s*\(\s*accounting_basis\s+IN\s*\(([^)]*)\)/i.exec(sql);
    expect(m, 'no CHECK constraint found in the declaring migration').not.toBeNull();
    const inSql = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(inSql).toEqual([...ACCOUNTING_BASIS_VALUES].sort());
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/accountingBasisColumn.test.mjs`
Expected: FAIL — no migration declares `budgets_accounting_basis_check`.

- [ ] **Step 3: Apply the migration**

Use `mcp__supabase-local__apply_migration` with name `accounting_basis` and this SQL, then save the same SQL to `supabase/migrations/20261006000000_accounting_basis.sql`:

```sql
-- Phase 2 — HOW a figure was measured, as its own axis.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
-- Duvall, WA reports on the cash-basis BARS regulatory framework. Its auditor
-- issues an UNMODIFIED opinion on that basis and an ADVERSE opinion on U.S.
-- GAAP, and states that government-wide statements "are not presented". Its
-- General Fund figure is real, audited, and NOT comparable to Redmond's.
--
-- Until now that distinction lived ONLY as text inside `budgets.data_source`
-- ('modified cash basis' vs 'GAAP basis'), matched by regex. That is the exact
-- pattern scripts/lib/fundScope.mjs forbids: "Read a loader's actual input
-- before believing what its source string calls itself." A `special_revenue`
-- scope was once added on the strength of a source string and later removed as
-- wrong.
--
-- ⚠⚠ `budgets.basis` CANNOT CARRY THIS. It is CHECK (basis IN
-- ('actual','adopted','unknown')) and means closed-year actual vs adopted
-- budget — a different axis that already earns its keep.
--
-- ⚠ ORTHOGONAL TO `audit_grade` ON PURPOSE. That is assurance; this is
-- measurement. An unaudited cash-basis source must be describable.
--
-- ── SAFETY ───────────────────────────────────────────────────────────────────
-- Additive only. Every existing row becomes 'unknown', which is the honest
-- value for a row nobody has adjudicated, and no existing value is read or
-- changed. Same failure direction as fund_scope, basis and audit_grade:
-- nothing is classified by absence.
ALTER TABLE treasury.budgets
  ADD COLUMN accounting_basis text NOT NULL DEFAULT 'unknown'
    CONSTRAINT budgets_accounting_basis_check
      CHECK (accounting_basis IN ('gaap','modified_cash','cash','unknown'));

COMMENT ON COLUMN treasury.budgets.accounting_basis IS
  'How the figure was measured: U.S. GAAP, modified cash, cash, or unknown. '
  'Stamped per source from evidence; unknown until proven. NOT budgets.basis '
  '(actual vs adopted) and NOT audit_grade (assurance, not measurement).';
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/accountingBasisColumn.test.mjs`
Expected: PASS, 3/3.

- [ ] **Step 5: Verify the constraint is live, not just declared**

```bash
node -e "
import('./scripts/lib/scopeDb.mjs').then(async () => {});
"
```
Then via `mcp__supabase-local__execute_sql`:
```sql
SELECT conname FROM pg_constraint WHERE conname = 'budgets_accounting_basis_check';
SELECT accounting_basis, count(*) FROM treasury.budgets GROUP BY 1;
```
Expected: the constraint exists; one row, `unknown`, equal to the table's total row count.

⚠ A migration self-test proves the SQL, not the path. Run the `SELECT` through the same client a script would use before believing it.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261006000000_accounting_basis.sql tests/accountingBasisColumn.test.mjs
git commit -m "feat(db): accounting_basis column, defaulting to unknown"
```

---

### Task 3: The comparability rule

**Files:**
- Modify: `scripts/lib/fundScope.mjs`
- Modify: `src/data/accountingBasisVocabulary.ts` (created here)
- Test: `tests/accountingBasis.test.mjs` (created here)

**Interfaces:**
- Consumes: `ACCOUNTING_BASIS_VALUES` from Task 1
- Produces: `isComparablePair(a, b)` → `boolean`, where `a`/`b` are `{scope, accountingBasis}`

- [ ] **Step 1: Write the failing test**

Create `tests/accountingBasis.test.mjs`:

```javascript
import { describe, it, expect } from 'vitest';
import { isComparablePair } from '../scripts/lib/fundScope.mjs';

const row = (scope, accountingBasis) => ({ scope, accountingBasis });

describe('isComparablePair', () => {
  it('REFUSES a proven mismatch — GAAP against cash', () => {
    // Duvall vs Redmond. This is the whole reason the axis exists.
    expect(isComparablePair(row('general_fund', 'gaap'), row('general_fund', 'cash'))).toBe(false);
  });

  it('REFUSES modified cash against GAAP — Brown County SD vs Aberdeen SD', () => {
    expect(isComparablePair(row('general_fund', 'modified_cash'), row('general_fund', 'gaap'))).toBe(false);
  });

  it('REFUSES cash against modified cash — they are different bases', () => {
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'modified_cash'))).toBe(false);
  });

  it('ALLOWS two figures on the same known basis', () => {
    expect(isComparablePair(row('general_fund', 'gaap'), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'cash'))).toBe(true);
  });

  // ⚠⚠ THE LOAD-BEARING CASE. The column starts 100% `unknown` and will stay
  // mostly unknown for a long time, exactly as audit_grade is 68% unknown. A
  // rule phrased "comparable only if both known and equal" would switch off
  // cross-entity comparison across nearly the whole site on the day it shipped.
  it('ALLOWS when either side is unknown — absence never blocks', () => {
    expect(isComparablePair(row('general_fund', 'unknown'), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'cash'), row('general_fund', 'unknown'))).toBe(true);
    expect(isComparablePair(row('general_fund', 'unknown'), row('general_fund', 'unknown'))).toBe(true);
  });

  it('ALLOWS when the basis is missing entirely — a caller that knows nothing', () => {
    expect(isComparablePair(row('general_fund', null), row('general_fund', 'gaap'))).toBe(true);
    expect(isComparablePair(row('general_fund', undefined), row('general_fund', 'cash'))).toBe(true);
  });

  it('still refuses on a non-comparable SCOPE, independently of basis', () => {
    // The two axes compose; neither excuses the other.
    expect(isComparablePair(row('unknown', 'gaap'), row('unknown', 'gaap'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/accountingBasis.test.mjs`
Expected: FAIL — `isComparablePair` is not exported.

- [ ] **Step 3: Implement**

Add to `scripts/lib/fundScope.mjs`:

```javascript
/**
 * May these two figures be drawn against each other?
 *
 * ⚠⚠ THE RULE IS "REFUSE ONLY WHEN BOTH ARE KNOWN AND DIFFERENT", and the
 * inverse is a trap worth naming. "Comparable only if both are known and
 * equal" is defensible in the abstract and catastrophic in practice: the
 * column starts at 100% `unknown` and will stay mostly unknown for a long
 * time — `audit_grade` is 68% unknown today — so that rule would switch off
 * cross-entity comparison across nearly the whole site the day it shipped.
 *
 * So the gate fires only on a PROVEN mismatch (Duvall vs Redmond; Brown County
 * SD vs Aberdeen SD) and is otherwise invisible. This is the same
 * failure-direction discipline the rest of this module uses, pointed at the
 * other error: never declare two figures comparable without evidence, and
 * never declare them INcomparable without evidence either.
 *
 * @param {{scope: string, accountingBasis?: string|null}} a
 * @param {{scope: string, accountingBasis?: string|null}} b
 */
export function isComparablePair(a, b) {
  if (!isComparableScope(a?.scope) || !isComparableScope(b?.scope)) return false;
  const x = a?.accountingBasis;
  const y = b?.accountingBasis;
  const known = (v) => typeof v === 'string' && v !== '' && v !== 'unknown';
  if (!known(x) || !known(y)) return true;   // absence never blocks
  return x === y;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/accountingBasis.test.mjs`
Expected: PASS, 7/7.

- [ ] **Step 5: Mutation-test the gate**

Temporarily change `if (!known(x) || !known(y)) return true;` to `return false;`.
Run: `npx vitest run tests/accountingBasis.test.mjs`
Expected: the two `unknown` tests FAIL. Revert.

Then temporarily change `return x === y;` to `return true;`.
Expected: the three refusal tests FAIL. Revert.

⚠ A gate that cannot be shown to fail is a gate that passes vacuously forever.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/fundScope.mjs tests/accountingBasis.test.mjs
git commit -m "feat(scope): refuse a proven GAAP-vs-cash comparison"
```

---

### Task 4: Reader-facing copy and the chip

**Files:**
- Create: `src/data/accountingBasisVocabulary.ts`
- Modify: `src/components/ScopeLabel.tsx`

**Interfaces:**
- Consumes: nothing at runtime
- Produces: `AccountingBasis` type, `ACCOUNTING_BASIS_COPY`, `normalizeAccountingBasis()`

- [ ] **Step 1: Write the failing test**

Create `src/data/accountingBasisVocabulary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS_COPY, normalizeAccountingBasis,
} from './accountingBasisVocabulary';

describe('accounting basis copy', () => {
  it('has copy for every value', () => {
    for (const v of ACCOUNTING_BASIS_VALUES) {
      expect(ACCOUNTING_BASIS_COPY[v].label, v).toBeTruthy();
      expect(ACCOUNTING_BASIS_COPY[v].short, v).toBeTruthy();
    }
  });

  it('never calls a non-GAAP basis worse — only different', () => {
    // ⚠ Duvall is AUDITED. The copy must not imply a defect; the figure is
    // real and attested, it is simply measured another way.
    for (const v of ['cash', 'modified_cash'] as const) {
      const text = `${ACCOUNTING_BASIS_COPY[v].label} ${ACCOUNTING_BASIS_COPY[v].short}`.toLowerCase();
      for (const bad of ['unreliable', 'lower quality', 'worse', 'inferior', 'unaudited']) {
        expect(text, `${v} copy must not say "${bad}"`).not.toContain(bad);
      }
    }
  });

  it('normalizes an unknown string to unknown rather than throwing', () => {
    expect(normalizeAccountingBasis('nonsense')).toBe('unknown');
    expect(normalizeAccountingBasis(null)).toBe('unknown');
    expect(normalizeAccountingBasis('cash')).toBe('cash');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/data/accountingBasisVocabulary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the vocabulary**

Create `src/data/accountingBasisVocabulary.ts`:

```typescript
/**
 * HOW a figure was measured, in the reader's words.
 *
 * ⚠⚠ A NON-GAAP BASIS IS NOT A DEFECT. Duvall, WA is audited under Government
 * Auditing Standards with an UNMODIFIED opinion on the regulatory basis; it
 * simply reports on a different basis from a city filing an ACFR. Copy here
 * must say DIFFERENT, never WORSE — the figure is real and attested.
 */
export type AccountingBasis = 'gaap' | 'modified_cash' | 'cash' | 'unknown';

export const ACCOUNTING_BASIS_VALUES: readonly AccountingBasis[] =
  ['gaap', 'modified_cash', 'cash', 'unknown'] as const;

export interface AccountingBasisCopy { label: string; short: string; }

export const ACCOUNTING_BASIS_COPY: Record<AccountingBasis, AccountingBasisCopy> = {
  gaap: {
    label: 'GAAP basis',
    short: 'Measured under U.S. generally accepted accounting principles.',
  },
  modified_cash: {
    label: 'Modified cash basis',
    short: 'Measured on a modified cash basis, which is not U.S. GAAP. '
      + 'Comparable to other modified-cash figures, not to GAAP ones.',
  },
  cash: {
    label: 'Cash basis',
    short: 'Measured on a cash basis, which is not U.S. GAAP. '
      + 'Comparable to other cash-basis figures, not to GAAP ones.',
  },
  unknown: {
    label: 'Basis not established',
    short: 'We have not yet confirmed how this figure was measured.',
  },
};

export function normalizeAccountingBasis(raw: unknown): AccountingBasis {
  return (ACCOUNTING_BASIS_VALUES as readonly string[]).includes(raw as string)
    ? (raw as AccountingBasis)
    : 'unknown';
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/data/accountingBasisVocabulary.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Add the chip to `ScopeLabel.tsx`**

Add an optional prop beside `basis`, rendered the same way (plain text, not a button):

```tsx
  /**
   * How the figure was MEASURED. Absent renders nothing rather than guessing,
   * like `basis` and `auditGrade`.
   *
   * ⚠ NO SEPARATE COLOUR. Every graded value in this component shares one tone
   * on purpose — colour is a ranking whether or not you intend it, and
   * `cash` is not a worse `gaap`, it is a different measurement. The WORDS
   * carry the distinction. ⚠ `bg-ev-gray-050`, not `-50`: a bad colour class
   * is dropped silently.
   */
  accountingBasis?: AccountingBasis | null;
```

and in the render, immediately after the existing `basis` chip:

```tsx
        {accountingBasis != null && accountingBasis !== 'unknown' && (
          <span
            title={ACCOUNTING_BASIS_COPY[normalizeAccountingBasis(accountingBasis)].short}
            className="text-ev-gray-600 dark:text-ev-gray-300"
          >
            {ACCOUNTING_BASIS_COPY[normalizeAccountingBasis(accountingBasis)].label}
          </span>
        )}
```

⚠ `unknown` renders NOTHING here, unlike `fund_scope`. The scope chip says "not established" because scope is 97% known and a gap is notable; this axis starts 100% unknown, and a chip on every row saying "basis not established" is noise, not information.

- [ ] **Step 6: Run the suite**

Run: `npm test`
Expected: all green. ⚠ This repo can run NO component tests — a `.test.tsx` will not execute — so the chip is verified by the vocabulary test plus a build.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/data/accountingBasisVocabulary.ts src/data/accountingBasisVocabulary.test.ts src/components/ScopeLabel.tsx
git commit -m "feat(ui): accounting-basis chip — different, never worse"
```

---

### Task 5: The registry and the stamper

**Files:**
- Create: `scripts/data/accountingBasisRegistry.mjs`
- Create: `scripts/stampAccountingBasis.mjs`
- Test: `tests/accountingBasis.test.mjs` (extended)

**Interfaces:**
- Consumes: `classifyAxis`, `validateAxisRegistry` from `scripts/lib/budgetAxes.mjs`; `ACCOUNTING_BASIS` from Task 1
- Produces: `ACCOUNTING_BASIS_REGISTRY` (array of `{id, match, value, evidence}`)

- [ ] **Step 1: Write the failing test**

Add to `tests/accountingBasis.test.mjs`:

```javascript
import { ACCOUNTING_BASIS_REGISTRY } from '../scripts/data/accountingBasisRegistry.mjs';
import { classifyAxis, validateAxisRegistry, ACCOUNTING_BASIS, ACCOUNTING_BASIS_VALUES } from '../scripts/lib/budgetAxes.mjs';

describe('ACCOUNTING_BASIS_REGISTRY', () => {
  it('is valid — every entry evidenced, every value legal', () => {
    const r = validateAxisRegistry(ACCOUNTING_BASIS_REGISTRY, ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS.UNKNOWN);
    expect(r.ok, JSON.stringify(r, null, 2)).toBe(true);
  });

  const cls = (src) => classifyAxis(src, ACCOUNTING_BASIS_REGISTRY, ACCOUNTING_BASIS_VALUES, ACCOUNTING_BASIS.UNKNOWN);

  it('stamps Redmond GAAP', () => {
    expect(cls('WA State Auditor — Redmond Annual Financial Report FY2024 (General Fund, Revenue by Source)').value)
      .toBe('gaap');
  });

  it('stamps Duvall CASH, not gaap', () => {
    expect(cls('WA State Auditor — Duvall Annual Financial Report FY2024 (General Fund, Revenue by Source)').value)
      .toBe('cash');
  });

  // ⚠⚠ THE TRAP. Redmond and Duvall are both `WA State Auditor — ...` and both
  // King County. A pattern anchored only on the publisher would stamp Duvall
  // GAAP — a false public claim about an adverse-opinion document.
  it('does NOT let the WA publisher pattern swallow Duvall', () => {
    const duvall = cls('WA State Auditor — Duvall Annual Financial Report FY2016 (General Fund, Expenditure by Function)');
    expect(duvall.value).not.toBe('gaap');
  });

  it('stamps Brown County SD modified_cash and Aberdeen SD gaap — twelve miles apart', () => {
    expect(cls('Brown County SD ACFR — General Fund Revenue by Source (FY2023 actual, modified cash basis)').value)
      .toBe('modified_cash');
    expect(cls('City of Aberdeen SD ACFR — General Fund Revenue by Source (FY2023 actual, GAAP basis)').value)
      .toBe('gaap');
  });

  it('leaves an unmatched source unknown rather than guessing', () => {
    expect(cls('Ohio AOS — something entirely else').value).toBe('unknown');
    expect(cls(null).value).toBe('unknown');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/accountingBasis.test.mjs`
Expected: FAIL — registry module not found.

- [ ] **Step 3: Write the registry**

Create `scripts/data/accountingBasisRegistry.mjs`. NO SHEBANG.

⚠ **Resolve the exact `data_source` strings for Brown County SD and Aberdeen SD by querying the live table first** — do not transcribe them from this plan:

```bash
node -e "
import('./scripts/lib/listAllSources.mjs').then(async (m) => {
  // print distinct data_source matching /Brown County|Aberdeen/ to get the exact strings
});
"
```

Each entry carries `{id, match, value, evidence: {document, figures}}`. Entries required:

- `wa-sao-duvall` → `cash`. Match must be anchored on Duvall specifically, and must be **listed before** any generic WA entry so it cannot be shadowed. Evidence: the FY2023 auditor's report, quoting *"the financial statements are prepared by the City using accounting practices prescribed by the BARS Manual, which is a basis of accounting other than GAAP"* and *"Adverse Opinion on U.S. GAAP"*.
- `wa-sao-gaap` → `gaap`, matching the WA SAO prefix for the ACFR-filing entities. ⚠ Must NOT match Duvall.
- `sd-brown-county` → `modified_cash`. Evidence: statements titled `... - MODIFIED CASH BASIS`; FAC `gaap_results = not_gaap`.
- `sd-aberdeen` → `gaap`.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/accountingBasis.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the stamper**

Create `scripts/stampAccountingBasis.mjs` (entry point, keeps its shebang), modelled on `scripts/stampAuditGrade.mjs`:

- `--dry-run` prints the tally and writes nothing.
- Sources absent from the registry are **LEFT ALONE, not defaulted**.
- Refuses to stamp any row lacking a `source_url`, as `stampAuditGrade.mjs` does — a basis claim whose justifying document cannot be retrieved is unfalsifiable.
- Prints per-entry counts.

- [ ] **Step 6: Dry-run, then stamp**

Run: `node scripts/stampAccountingBasis.mjs --dry-run`
Expected: Redmond 22 → `gaap`, Brown County SD and Aberdeen SD counts matching their loaded rows, Duvall 0 (not loaded yet), everything else untouched.

Run: `node scripts/stampAccountingBasis.mjs`
Expected: the same counts written.

- [ ] **Step 7: Verify no bulk default happened**

Via `mcp__supabase-local__execute_sql`:
```sql
SELECT accounting_basis, count(*) FROM treasury.budgets GROUP BY 1 ORDER BY 2 DESC;
```
Expected: `unknown` is still the overwhelming majority. ⚠ If `gaap` is ~280k, a bulk default was applied — that is the failure this axis exists to prevent. Revert and fix the registry.

- [ ] **Step 8: Commit**

```bash
git add scripts/data/accountingBasisRegistry.mjs scripts/stampAccountingBasis.mjs tests/accountingBasis.test.mjs
git commit -m "feat(axes): evidenced accounting-basis registry and stamper"
```

---

### Task 6: Duvall recon and the BARS extractor

**Files:**
- Create: `docs/superpowers/plans/DUVALL-RECON.md`
- Create: `scripts/extractDuvall.py`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `CityConfig`, `run_cli` from `scripts/lib/acfrGF.py`
- Produces: `scripts/extractDuvall.py` CLI, same contract as `extractRedmond.py`

⚠ Derive every config field from Duvall's own statements. Deriving it from the harness's conclusion makes the harness's later agreement vacuous.

- [ ] **Step 1: Probe the window under the floor rule**

For each candidate year, resolve the statement page and record whether it parses on ONE config. Walk back from FY2025 and stop where the statement's shape changes — the same rule that set Redmond's window at FY2011.

Known from spec §3.4: FY2016–FY2025 label the column `001 General Fund`; FY2010–FY2013 do not; FY2009 has one money token in the whole document. **Measure, do not assume.**

- [ ] **Step 2: Probe the statement's own geometry**

```bash
pdftotext -f <page> -l <page> -layout "docs/Duvall/duvall-2024-acfr.pdf" -
```

Record: the caption (`Fund Resources and Uses Arising from Cash Transactions`), the column order, the BARS line codes present, and the section headings (`Revenues`, `Expenditures`, `Total Revenues:`, `Total Expenditures:` — note the trailing colons).

⚠ **The `Total for All Funds (Memo Only)` column is printed FIRST.** Record the exact index of `001 General Fund` — this is Review Focus #2 and a `target_column=0` default would publish all-funds money under a General Fund label at a $0 tie.

- [ ] **Step 3: Write the failing selftests**

Add to `scripts/lib/acfrGF.selftest.py`, with lines transcribed VERBATIM from a real Duvall page (as `TestRedmondShape` does), asserting against the SHIPPED config:

```python
class TestShippedDuvallConfig(unittest.TestCase):
    def test_duvall_reads_the_BARS_line_codes_as_codes_not_money(self):
        # ⚠⚠ `310 Taxes` makes 310 a VALUE without this flag: every group
        # heading becomes a ~$310 leaf, no group opens, the tree comes back
        # flat, and the total is only slightly over — plausible enough to ship.
        # Added for Aberdeen SD, which prints the same chart of accounts.
        self.assertTrue(extractDuvall.CONFIG.leading_account_code)

    def test_duvall_does_NOT_target_the_memo_column(self):
        # ⚠⚠ `Total for All Funds (Memo Only)` is printed FIRST. target_column=0
        # would publish ALL-FUNDS money under a General Fund label, tying at $0.
        self.assertNotEqual(extractDuvall.CONFIG.target_column, 0)

    def test_duvall_units_is_whole_dollars(self):
        self.assertEqual(extractDuvall.CONFIG.units, 1)

    def test_duvall_fy_end_is_december_31(self):
        self.assertEqual(extractDuvall.CONFIG.fy_end, ('December', 31))


class TestDuvallShape(unittest.TestCase):
    def test_the_general_fund_column_is_read_not_the_memo_column(self):
        tree, total, _ = build_revenue(
            DUVALL_REV_LINES, anchors(DUVALL_REV_ANCHOR), extractDuvall.CONFIG)
        by_name = {c['n']: c['a'] for c in tree['c']}
        self.assertEqual(by_name['Taxes'], <the 001 General Fund figure read off the page>)

    def test_a_BARS_code_never_becomes_a_leaf(self):
        tree, _, _ = build_revenue(
            DUVALL_REV_LINES, anchors(DUVALL_REV_ANCHOR), extractDuvall.CONFIG)
        for c in tree['c']:
            self.assertNotRegex(c['n'], r'^\d{3}(\.\d+)?$')
            self.assertNotIn(c['a'], (310, 320, 330, 340, 350, 360))
```

- [ ] **Step 4: Run and watch them fail**

Run: `<python> scripts/lib/acfrGF.selftest.py`
Expected: FAIL — `extractDuvall` not importable. Add `import extractDuvall` to the imports at the top, **before** the `if __name__` block.

⚠ Append new test classes ABOVE `if __name__ == '__main__': unittest.main()`. Classes defined after it are never collected and report nothing — this happened in phase 1 and hid a real failure.

⚠ Clear `scripts/__pycache__/extractDuvall*.pyc` when mutation-testing; a stale `.pyc` kept a reverted mutation alive in phase 1.

- [ ] **Step 5: Write the extractor**

Create `scripts/extractDuvall.py`, docstring carrying the evidence for each field, with:

```python
CONFIG = CityConfig(
    city='Duvall, WA',
    parents=(),               # fill from Step 2 — read off the page
    root_leaves=(),           # fill from Step 2
    revenue_parents=(),
    revenue_group_members=(),
    column_strategy='',       # fill from Step 2
    target_column=0,          # ⚠ fill from Step 2 — NOT 0, the memo column is first
    leading_account_code=True,
    units=1,
    fy_end=('December', 31),
    statement_anchor='',      # fill from Step 2 — the BARS caption, not the GAAP one
    revenue_section_header='',   # fill from Step 2
    revenue_total_labels=(),     # fill from Step 2 — note the trailing colons
    source_rounding={},
)
```

- [ ] **Step 6: Run and watch them pass; record the recon**

Run: `<python> scripts/lib/acfrGF.selftest.py`
Expected: PASS, with the count up by the tests added.

Write `docs/superpowers/plans/DUVALL-RECON.md`, one section per decision, each citing the year and page it was read from.

- [ ] **Step 7: Commit**

```bash
git add scripts/extractDuvall.py scripts/lib/acfrGF.selftest.py
git add -f docs/superpowers/plans/DUVALL-RECON.md
git commit -m "feat(wa): Duvall BARS extractor, config derived from the statements"
```

---

### Task 7: Biennial PDFs — selecting a statement by printed year

**Files:**
- Modify: `scripts/lib/acfrGF.py`
- Modify: `scripts/fetchWaCities.mjs`
- Modify: `scripts/lib/acfrGF.selftest.py`

**Interfaces:**
- Consumes: `CityConfig` from Task 6
- Produces: `CityConfig.select_fiscal_year` (bool) — when true, the statement page is chosen by its own printed `For the Year Ended December 31, <FY>` matching the FY in the PDF filename

- [ ] **Step 1: Write the failing selftest**

```python
class TestBiennialStatementSelection(unittest.TestCase):
    """One PDF, two statements — the silent wrong-year trap.

    Duvall's five biennial reports each carry a full statement for BOTH covered
    years. Taking the first candidate publishes FY2012's money under FY2013 and
    ties at $0 while doing it — the same shape as the wrong-page hits that tied
    nine times in ten during WA-CITIES-01.
    """

    PAGES = [
        'City of Duvall\nFund Resources and Uses Arising from Cash Transactions\n'
        'For the Year Ended December 31, 2012\n...',
        'City of Duvall\nFund Resources and Uses Arising from Cash Transactions\n'
        'For the Year Ended December 31, 2013\n...',
    ]

    def test_it_selects_the_page_whose_PRINTED_year_matches(self):
        self.assertEqual(select_statement_for_fy(self.PAGES, 2012), 0)
        self.assertEqual(select_statement_for_fy(self.PAGES, 2013), 1)

    def test_it_REFUSES_when_the_requested_year_is_not_printed(self):
        # Silence is the dangerous outcome: returning page 0 here is exactly
        # the defect. A missing year must be loud.
        with self.assertRaises(ValueError):
            select_statement_for_fy(self.PAGES, 2014)

    def test_it_REFUSES_when_two_pages_claim_the_SAME_year(self):
        dupe = [self.PAGES[0], self.PAGES[0]]
        with self.assertRaises(ValueError):
            select_statement_for_fy(dupe, 2012)
```

- [ ] **Step 2: Run and watch it fail**

Run: `<python> scripts/lib/acfrGF.selftest.py`
Expected: FAIL — `select_statement_for_fy` undefined. Add it to the import list from `lib.acfrGF`.

- [ ] **Step 3: Implement in `scripts/lib/acfrGF.py`**

```python
_FY_PRINTED = re.compile(r'For the Year Ended\s+\w+\s+\d{1,2},\s*(\d{4})', re.I)


def select_statement_for_fy(pages, fiscal_year):
    """Pick the statement page whose OWN PRINTED year is `fiscal_year`.

    ⚠⚠ A biennial report carries two full statements. Taking candidate[0]
    publishes the earlier year's money under the later year's label and ties at
    $0 — indistinguishable from a correct load by every arithmetic gate.

    Refuses loudly on zero matches and on more than one, for the same reason
    `find_statement_page` treats an ambiguous page as fatal: silence here is
    the defect.
    """
    hits = [i for i, pg in enumerate(pages)
            if any(int(m.group(1)) == fiscal_year for m in _FY_PRINTED.finditer(pg))]
    if not hits:
        raise ValueError(
            'no statement page prints "For the Year Ended ... %d"; the requested '
            'fiscal year is not in this document' % fiscal_year)
    if len(hits) > 1:
        raise ValueError(
            '%d statement pages claim fiscal year %d; refusing to guess which is '
            'the governmental-funds statement' % (len(hits), fiscal_year))
    return hits[0]
```

- [ ] **Step 4: Run and watch it pass**

Run: `<python> scripts/lib/acfrGF.selftest.py`
Expected: PASS.

- [ ] **Step 5: Save biennial PDFs under both years**

In `scripts/fetchWaCities.mjs`, `DUVALL_ARNS` maps **each covered fiscal year** to its ARN — so a biennial ARN appears twice:

```javascript
/**
 * Duvall, MCAG 0391 — CASH-BASIS BARS, not GAAP.
 *
 * ⚠⚠ FIVE ARNs APPEAR TWICE. Duvall is audited BIENNIALLY, and each biennial
 * report carries a full statement for BOTH covered years, so the same document
 * is saved under both filenames. Identical bytes, two names — the sha manifest
 * will pin one digest under two paths, which is CORRECT and must not be
 * "fixed": they are the same document.
 *
 * Audit periods read from BeginAuditPeriod/EndAuditPeriod, never inferred:
 *   ARN 1009156 covers FY2010-FY2011   ARN 1018682 covers FY2014-FY2015
 *   ARN 1013701 covers FY2012-FY2013   ARN 1036127 covers FY2022-FY2023
 */
export const DUVALL_ARNS = { /* fill from the window Task 6 Step 1 establishes */ };
```

- [ ] **Step 6: Fetch and confirm the double-save**

Run: `node scripts/fetchWaCities.mjs Duvall`
Expected: one file per loaded fiscal year, with the biennial pairs byte-identical.

```bash
sha256sum docs/Duvall/duvall-2022-acfr.pdf docs/Duvall/duvall-2023-acfr.pdf
```
Expected: identical digests.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/acfrGF.py scripts/fetchWaCities.mjs scripts/lib/acfrGF.selftest.py
git add -f docs/Duvall/
git commit -m "feat(wa): select a statement by its printed year; Duvall ARNs"
```

---

### Task 8: Roster, load, and the OCBOA grading

**Files:**
- Modify: `scripts/lib/waRoster.mjs`
- Modify: `scripts/lib/waFiscalCalendar.mjs`
- Modify: `scripts/data/auditGradeRegistry.mjs`
- Create: `scripts/processDuvall.js`
- Test: `tests/waRoster.test.mjs`

- [ ] **Step 1: Write the failing roster tests**

```javascript
describe('Duvall', () => {
  it('carries Duvall with its measured window', () => {
    const d = getEntity('Duvall');
    expect(d.mcag).toBe('0391');
    expect(d.entityType).toBe('city');
    expect(d.countyName).toBe('King County');
    expect(d.fiscalYears.length).toBeGreaterThan(0);
  });

  it('declares a reason for every year in the manifest span that is not loaded', () => {
    const d = getEntity('Duvall');
    const [lo, hi] = d.manifestSpan;
    for (let fy = lo; fy <= hi; fy++) {
      const loaded = d.fiscalYears.includes(fy);
      const excluded = Object.prototype.hasOwnProperty.call(d.excludedYears, fy);
      expect(loaded !== excluded, `FY${fy} must be exactly one of loaded/excluded`).toBe(true);
    }
  });

  it('is in King County alongside Redmond, Bellevue and Kent', () => {
    expect(getEntity('Duvall').countyName).toBe(getEntity('Redmond').countyName);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx vitest run tests/waRoster.test.mjs`
Expected: FAIL — `getEntity('Duvall')` throws. Also update the roster-name list assertion to include `'Duvall'`.

- [ ] **Step 3: Add the roster entry**

Population: read from `ofm_april1_population_final.xlsx`, sheet `Population`, the **2025** column, `Filter=4`, and record the line number in `populationNote`. ⚠ Do not invent it; validate the read by reproducing a known entry (Redmond is line 171 / 82,380) before trusting it.

`perCapitaBand` stays `null` until Step 6 derives it from Duvall's own spread.

- [ ] **Step 4: Write the driver**

Create `scripts/processDuvall.js`, modelled on `scripts/processRedmond.js`, including both drift guards (missing ARN, and the stray-ARN check) and `parseTargetFY(argv)`.

⚠ The stray-ARN guard must tolerate an ARN appearing under two fiscal years — that is the biennial case and is expected. Assert instead that every pinned FY is a loaded FY.

- [ ] **Step 5: Add the OCBOA audit-grade registry entry**

Add to `scripts/data/auditGradeRegistry.mjs` an entry matching Duvall's `data_source`, value `audited_ocboa`, with evidence quoting the auditor's split opinion: unmodified on the BARS regulatory basis, **adverse on U.S. GAAP**.

⚠ `audited_gaap` here would be a false public claim about a document that explicitly denies GAAP. ⚠ The match must not reach Redmond.

- [ ] **Step 6: Dry-run and derive the band**

Run: `node scripts/processDuvall.js --dry-run`
Expected: every combination ties at exactly $0.

Derive `perCapitaBand` ≈ 0.5×min .. 2×max from the observed spread and `verifyPerCapitaBand` tighter. ⚠ Never inherit Redmond's — Duvall is ~8,000 people against Redmond's 82,380.

- [ ] **Step 7: Seed and load**

```bash
node scripts/seedWaCities.mjs Duvall
node scripts/processDuvall.js
```
Expected: one city row written, one King County; then N loaded, 0 failed.

- [ ] **Step 8: Stamp the axes and assert the OCBOA grading**

```bash
node scripts/stampBudgetAxes.mjs              # basis=actual
node scripts/classifyFundScope.mjs --only wa-sao   # fund_scope=general_fund
node scripts/stampAuditGrade.mjs              # audit_grade=audited_ocboa
node scripts/stampAccountingBasis.mjs         # accounting_basis=cash
```

⚠ Re-measure `wa-sao` in `scripts/data/fundScopeExpectations.mjs`, `EXPECTED_BASIS_ROWS` and `EXPECTED_REPORTING_ENTITY_ROWS` in `scripts/stampBudgetAxes.mjs` **in this same commit** — 308 + Duvall's rows. Phase 1 proved a stale expectation holds those gates closed for a month.

Then verify on the loaded rows (Review Focus #5):
```sql
SELECT DISTINCT fund_scope, basis, audit_grade, accounting_basis
FROM treasury.budgets WHERE municipality_id = '<duvall id>';
```
Expected exactly one row: `general_fund | actual | audited_ocboa | cash`.
⚠ `audited_gaap` or `gaap` here is a false public claim — stop and fix the registry.

- [ ] **Step 9: Register rows and re-measure the fiscal baseline**

```bash
npm run verify:frozen
npm run register:rows -- --milestone duvall --match "WA State Auditor — Duvall Annual Financial Report"
node scripts/syncFrozenInvariantState.mjs
npm run verify:frozen
```
Expected: deficit equals exactly Duvall's row count; then the invariant holds.

⚠ Run this **right after your own load**, not after someone else's: `registerCreatedRows` files whatever is currently unaccounted for, so a later run would file Duvall's ids under another milestone's name.

Update `BASELINE.localRows`, `BASELINE.localEntities` and `LOCAL_ROWS_BY_ENTITY` in `scripts/lib/waFiscalCalendar.mjs` (currently 358 / 11), and the pinned numbers in `tests/waFiscalCalendar.test.mjs`.

Run: `node scripts/verifyWAFiscalYearStartMonth.mjs`
Expected: VERIFY OK.

- [ ] **Step 10: Commit**

```bash
git add scripts/lib/waRoster.mjs scripts/lib/waFiscalCalendar.mjs scripts/processDuvall.js \
        scripts/data/auditGradeRegistry.mjs scripts/data/fundScopeExpectations.mjs \
        scripts/stampBudgetAxes.mjs scripts/data/duvallCreatedIds.json \
        scripts/data/scopeBaseline.json tests/waRoster.test.mjs tests/waFiscalCalendar.test.mjs
git commit -m "feat(wa): load Duvall — cash-basis BARS, audited_ocboa"
```

---

### Task 9: Verification and closeout

**Files:**
- Modify: `scripts/data/wa-pdf-sha256.json`
- Modify: `scripts/verify-wa-audit.mjs` (only if a check needs the biennial case)

- [ ] **Step 1: Blind re-derivation**

Run: `node scripts/verify-wa-rederive.mjs --only Duvall`
Expected: every combination re-derived at exactly $0, 0 blockers.

⚠ **The Kent lesson.** If the harness reader disagrees with the document, never assume the loaded data is fine because the reader is provably wrong. Fix the reader FIRST, then re-run — the extractor usually shares the defect, because both were written from the same misreading.

- [ ] **Step 2: Audit harness**

Run: `node scripts/verify-wa-audit.mjs --only Duvall`
Expected: all checks pass.

⚠ Check (g) passes VACUOUSLY with zero enrichment rows and says so itself. Report it as "N substantive", never fold it into a count of real passes.

- [ ] **Step 3: Mutation-test the biennial selection on real data**

Temporarily make `select_statement_for_fy` return `hits[0]` without the length check, point the FY2012 load at the FY2013 page, and confirm the re-derivation FAILS.
Expected: a loud failure. Revert.

⚠ This is the one gate standing between a correct extractor and publishing FY2012's money under FY2013.

- [ ] **Step 4: sha manifest**

Run: `node scripts/verify-wa-audit.mjs`
Expected: no mismatches among existing PDFs **before** recording.

Run: `node scripts/verify-wa-audit.mjs --record-sha`
Expected: the previous total plus Duvall's files. ⚠ The biennial pairs will carry identical digests under different paths — correct.

- [ ] **Step 5: Whole-corpus re-run**

```bash
node scripts/verify-wa-rederive.mjs
node scripts/verify-wa-audit.mjs
node scripts/classifyFundScope.mjs --dry-run
npm run verify:frozen
node scripts/verifyWAFiscalYearStartMonth.mjs
npm test
<python> scripts/lib/acfrGF.selftest.py
```
Expected: all green, totals up by Duvall's rows.

⚠ `npm run lint` never exits 0 in this repo — a known-broken gate, not a signal.

- [ ] **Step 6: Confirm the phase-2 completion gate**

Per spec §1.1, phase 2 is NOT complete until all four hold:
1. The axis exists with its CHECK constraint.
2. The four sources in §4.5 are stamped.
3. The comparability rule is mutation-tested.
4. **Duvall is loaded behind it.**

- [ ] **Step 7: Open the PR**

Body states: the axis and its gating rule; that Duvall is cash-basis BARS with an adverse GAAP opinion and carries `audited_ocboa` + `cash`; the biennial finding and how it is handled; and the phase-2 gate being met.

---

## Self-Review

**Spec coverage.** §1.1 ordering → Global Constraints + Task 9 Step 6. §3.1–3.3 Duvall documents/config/grading → Tasks 6, 8. §3.4 biennial → Task 7. §4.1–4.2 column → Task 2. §4.3 comparability → Task 3. §4.4 reader-facing → Task 4. §4.5 backfill → Task 5. §5 verification items 1–8 → Tasks 6, 8, 9.

**Deliberate unresolved values.** Four, each with a named authority and method, following the WA-CITIES-01 convention: the `CityConfig` fields marked `# fill from Step 2` (read from Duvall's statements), the window (floor rule, measured), the population (WA OFM 2025, line cited), and the per-capita bands (derived from the observed spread). The exact Brown County SD / Aberdeen SD `data_source` strings are resolved by query in Task 5 Step 3 rather than transcribed, because transcribing a source string from a plan is how the wrong one gets matched.

**Type consistency.** `ACCOUNTING_BASIS_VALUES` is a frozen array of four strings in Tasks 1, 2, 5. `isComparablePair(a, b)` takes `{scope, accountingBasis}` in Task 3 and is unused elsewhere. `AccountingBasis` (TS) and `ACCOUNTING_BASIS` (JS) carry the same four values, pinned by Task 2's parity test. `select_statement_for_fy(pages, fiscal_year) -> int` in Task 7.

**Review Focus coverage.** 1 → Task 3 Steps 1/5. 2 → Task 6 Step 3. 3 → Task 6 Step 3. 4 → Task 7 Steps 1/3 and Task 9 Step 3. 5 → Task 8 Step 8.
