---
phase: 34-3-level-tree-infrastructure-ev-accounts-api
reviewed: 2026-06-08T11:50:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - C:/EV-Accounts/backend/test/treasury-3level.test.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-06-08T11:50:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `C:/EV-Accounts/backend/test/treasury-3level.test.ts` — the Phase 34 integration test proving 3-level tree support via `treasury_sync_budget_tree` RPC and the inline `buildTreeFromRows` tree builder. All 5 tests pass against the live database. However, there are two critical defects that can cause obscure failures under realistic error conditions (pool never assigned on missing env vars, inline `.env` comment stripping). Four warnings flag brittle assertions, silent cleanup failures, and a hardcoded production URL fallback.

---

## Critical Issues

### CR-01: `pool` is never assigned when `beforeAll` throws, but `afterAll` calls `pool.end()` unconditionally

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:113-131`

**Issue:** `beforeAll` (line 113) is synchronous and throws when `DATABASE_URL` is absent. When it throws, `pool` remains `undefined` at runtime (TypeScript types it as `pg.Pool` with no `| undefined`). `afterAll` then calls `await pool.end()` at line 130 unconditionally. This dereferences `undefined` and throws a secondary `TypeError: Cannot read properties of undefined (reading 'end')`. This secondary error masks the original "DATABASE_URL is not set" message in the test report and can cause the test runner to exit with a confusing stack trace pointing at `afterAll` rather than the actual root cause.

**Fix:**
```typescript
afterAll(async () => {
  if (testBudgetId && pool) {
    await pool.query('DELETE FROM treasury.budgets WHERE id = $1', [testBudgetId]);
  }
  if (pool) await pool.end();
});
```

---

### CR-02: `.env` parser silently embeds inline `#` comments into env var values

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:47-59`

**Issue:** The `loadEnv()` parser (line 53) splits on `=`, re-joins the value parts, and trims only leading/trailing whitespace. It does NOT strip inline `#` comments. The project's own `.env.example` uses inline comments on service key lines (e.g., `QUEST_SERVICE_KEY=your-quest-service-key           # source: "validation_quest_completion"`). If a developer copies `.env.example` as a starting point and the live `.env` retains those inline comments, critical env vars such as `SUPABASE_SERVICE_KEY` or `DATABASE_URL` will be set to `<actual-value> # comment`, causing Supabase authentication or `pg.Pool` connection to fail with a cryptic error ("Invalid API key", "SASL authentication failed") rather than the clear "env var not set" message that the guard at lines 118-119 is designed to produce.

**Fix:**
```typescript
// Replace line 53 with:
const rawVal = v.join('=').trim().replace(/\s+#.*$/, '');  // strip inline # comments
if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = rawVal;
```

---

## Warnings

### WR-01: `buildNode` uses a non-null assertion on `nodeMap.get(id)` with no error context

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:94`

**Issue:** `const node = nodeMap.get(id)!` silently asserts the node exists. If `childrenMap` references an `id` that is absent from `nodeMap` (FK violation, mid-query delete, or data inconsistency), this throws `TypeError: Cannot read properties of undefined (reading 'name')` with no indication of which node ID caused the failure. In a test diagnosing infrastructure integrity, this makes failures harder to diagnose.

**Fix:**
```typescript
function buildNode(id: string): TreeNode {
  const node = nodeMap.get(id);
  if (!node) throw new Error(`buildNode: id "${id}" not found in nodeMap — possible data inconsistency`);
  const childIds = childrenMap.get(id) ?? [];
  // ... rest unchanged
}
```

---

### WR-02: TREE-03 backward-compat assertions check only `tree[0]` — silently passes if other roots have depth-2 data

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:291-296`, `319-325`, `348-354`

**Issue:** All three TREE-03 tests assert `root.subcategories![0].subcategories` is undefined — where `root` is `tree[0]`, the first root category. If the budget has multiple root categories and any root other than the first contains depth-2 subcategories, the assertion passes silently even though the budget is not a true 2-level tree. The backward-compat proof is then incomplete.

**Fix:**
```typescript
// Assert the entire category set stays within depth 1
const maxDepth = catRows.reduce((m, r) => Math.max(m, r.depth), 0);
expect(maxDepth, 'No category should reach depth 2 in a 2-level city (backward compat)').toBeLessThanOrEqual(1);
```

---

### WR-03: `afterAll` cleanup DELETE result is not checked — silent failure leaves FY=9999 sentinel in the database

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:127-129`

**Issue:** `await pool.query('DELETE FROM treasury.budgets WHERE id = $1', [testBudgetId])` is awaited but its result is ignored. If the DELETE fails (permissions change, connection closed early, or FK constraint missing CASCADE), the sentinel FY=9999 row remains in the database. On the next test run, `treasury_sync_budget_tree` may encounter a unique-constraint or duplicate-row violation when re-inserting for the same `data_source_id` and FY=9999, causing TREE-01 to fail with a misleading application-level error.

**Fix:**
```typescript
if (testBudgetId) {
  const res = await pool.query('DELETE FROM treasury.budgets WHERE id = $1', [testBudgetId]);
  if (res.rowCount === 0) {
    console.warn(`[afterAll] FY=9999 test budget ${testBudgetId} was NOT deleted — manual cleanup required`);
  }
}
```

---

### WR-04: `SUPABASE_URL` has a hardcoded fallback to a specific live Supabase project URL

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:115`

**Issue:** `process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co'` — if `SUPABASE_URL` is absent from the env (e.g., misconfigured CI, different Supabase project), the test silently targets the hardcoded production project rather than failing with a clear missing-env error. This inverts the intended safety posture: a developer who omitted `SUPABASE_URL` from their `.env` would unknowingly run the test's INSERT/DELETE lifecycle against production. The embedded project reference also leaks internal infrastructure identifiers.

**Fix:**
```typescript
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is not set — check C:/EV-Accounts/backend/.env');
```

---

## Info

### IN-01: `approved_amount` cast with `Number()` loses precision for non-integer currency values

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:226`

**Issue:** `Number(li.approved_amount)` converts a PostgreSQL `numeric` column to a JavaScript IEEE-754 float. The specific test values (whole-number billions) are exact in float64. However, this pattern is unsafe for real budget line items with fractional dollar amounts (e.g., `$1,234,567.89`). If this inline tree-builder is ever copied forward into production service code, fractional amounts will be silently rounded. The `pg` driver returns `numeric` columns as strings by default, so the safe form is to keep the value as a string.

**Fix:** Keep `approved_amount` as a string in the test and assert the string value, or use a decimal-safe comparison:
```typescript
// pg returns numeric as string; cast only when needed for math
approved_amount: li.approved_amount as unknown as string,
```

---

### IN-02: `import pg from 'pg'` uses a default CJS import in an ESM package

**File:** `C:/EV-Accounts/backend/test/treasury-3level.test.ts:42`

**Issue:** The package is declared `"type": "module"` in `package.json`. `pg` v8 is a CommonJS module. The default import `import pg from 'pg'` works under vitest (which uses Vite's CJS/ESM interop), but would fail if the test file is executed directly with Node.js `--experimental-vm-modules` without the vitest transform layer. This is consistent with the existing test files in the `test/` directory, so it is not a new regression — flagged for awareness only.

**Fix:** No immediate action needed in the vitest context. If the test is ever executed directly by Node.js, change to named imports: `import { Pool } from 'pg'`.

---

_Reviewed: 2026-06-08T11:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
