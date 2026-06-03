---
phase: 24-los-angeles-data-refresh
reviewed: 2026-06-03T19:26:22Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - scripts/seedLADataSources.js
  - src/components/dashboard/PlainLanguageSummary.tsx
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-06-03T19:26:22Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files were reviewed for phase 24 (Los Angeles Data Refresh): a one-shot seeder script (`seedLADataSources.js`) and an existing React component updated to handle new LA budget display scenarios (`PlainLanguageSummary.tsx`).

The seeder is straightforward and well-structured, with proper idempotent upsert logic and clear error handling. One inconsistency in error handling exists between the two upsert functions.

`PlainLanguageSummary.tsx` contains a **critical React Rules of Hooks violation**: hooks are called after a conditional `return null` on line 38. This violates a fundamental React rule and will cause runtime crashes when React detects the inconsistent hook call order. The violation exists in pre-phase code but is in scope as a changed file this phase.

---

## Critical Issues

### CR-01: React Rules of Hooks Violation — Hooks Called After Early Return

**File:** `src/components/dashboard/PlainLanguageSummary.tsx:38`

**Issue:** The component performs an early `return null` on line 38 (`if (!operatingData) return null;`), and then the following hooks are defined **after** that conditional return on lines 102–126:

- `useState(false)` — line 102
- `useRef<number | null>(null)` — line 103
- `useRef(true)` — line 105
- `useCallback(...)` — line 109
- `useAnimatedCounter(...)` — line 119 (itself calls `useState`, `useRef`, `useEffect` internally)
- `useEffect(...)` — line 122

React's Rules of Hooks require that hooks are **always called in the same order on every render**, and must **never be called conditionally** (including after an early return). When `operatingData` transitions from non-null to null (e.g., year change, loading state), the number of hooks called changes, causing React to throw:

> "Rendered fewer hooks than expected. This may be caused by an accidental early return statement."

This will also trigger if React StrictMode double-invokes the render with a null prop during development.

**Fix:** Move all hooks above the early return, then guard the return after all hooks have been called:

```tsx
const PlainLanguageSummary: React.FC<PlainLanguageSummaryProps> = ({
  entity,
  operatingData,
  revenueData,
  salariesTotal = null,
  fiscalYear,
  isPastYear = false,
  onCategoryClick,
  onYearClick,
  allFundsRequirementsData = null,
}) => {
  // ── Derive values (safe even when operatingData is null) ──────────────
  const budgetedTotal = allFundsRequirementsData?.metadata.totalBudget
    ?? operatingData?.metadata.totalBudget
    ?? 0;
  const actualTotal = (operatingData?.categories ?? []).reduce(
    (sum, c) => sum + (c.actualAmount ?? 0), 0
  );
  const hasActualData = actualTotal > 0;
  const showActual = isPastYear && hasActualData;
  const isCurrentYearWithActuals = !isPastYear && hasActualData;
  const revenueTarget = revenueData?.metadata.totalBudget ?? 0;

  // ── All hooks must be called unconditionally, before any return ───────
  const [revenueGlowing, setRevenueGlowing] = useState(false);
  const glowTimerRef = useRef<number | null>(null);
  const isFirstRevenueAnimRef = useRef(true);

  const handleRevenueSettled = useCallback(() => {
    if (isFirstRevenueAnimRef.current) {
      isFirstRevenueAnimRef.current = false;
      return;
    }
    setRevenueGlowing(true);
    if (glowTimerRef.current != null) window.clearTimeout(glowTimerRef.current);
    glowTimerRef.current = window.setTimeout(() => setRevenueGlowing(false), 2000);
  }, []);

  const animatedRevenue = useAnimatedCounter(revenueTarget, 600, handleRevenueSettled);

  useEffect(() => {
    return () => {
      if (glowTimerRef.current != null) window.clearTimeout(glowTimerRef.current);
    };
  }, []);

  // ── Guard: nothing to render without operating data ───────────────────
  if (!operatingData) return null;

  // ... rest of derivations and JSX unchanged ...
```

---

## Warnings

### WR-01: Silent No-Op on Update in `upsertDataSourceByName`

**File:** `scripts/seedLADataSources.js:182`

**Issue:** `upsertDataSourceByName` returns `data?.[0]` after an update or insert, where `data` comes directly from the Supabase `.select()` call. If the `.select()` returns an empty array (e.g., due to a RLS policy blocking the read-back, or a bug in the update predicate), `data?.[0]` is `undefined`. The caller at line 201 checks `if (!row)` and exits — but only after reaching `main()`. This is inconsistent with `upsertMunicipality`, which explicitly checks the returned row and calls `process.exit(1)` inside the function itself (lines 84-90), making the error location clear in the logs.

More importantly, on the update path (lines 160-166), if `error` is null but `data` is an empty array, the function logs "updated existing row X" (success message) and then returns `undefined`, silently masking that no row was actually returned. The caller's check catches this, but the logged success message will be misleading.

**Fix:** Add an explicit check inside `upsertDataSourceByName` after the write, mirroring `upsertMunicipality`:

```js
if (error) {
  console.error(`  ERROR writing "${src.name}": ${error.message}`);
  process.exit(1);
}

const row = data?.[0];
if (!row) {
  console.error(`  ERROR: no row returned for "${src.name}" after write`);
  process.exit(1);
}

return row;
```

Then remove the `if (!row)` guard in `main()` (line 201), since `upsertDataSourceByName` now guarantees a truthy return or exits.

---

### WR-02: `where_extra` Contains Raw SQL Stored in the Database

**File:** `scripts/seedLADataSources.js:108`

**Issue:** The `column_mapping.where_extra` value `"AND adopted_budget_amount > 0"` is a raw SQL fragment persisted into the `data_sources` table and later retrieved by the budget-loading ETL pipeline. If the downstream query builder (`bulkLoadBudget.js` or equivalent) appends this value to a Socrata API filter string via string interpolation without validation, the stored value becomes an injection point — a compromised database row or future seeder with a malicious `where_extra` value could alter query semantics.

This is not exploitable from the seeder itself (the value is hardcoded), but the pattern of storing raw SQL fragments in a user-accessible table is a latent risk: any future admin path that allows editing `column_mapping` without sanitization would expose query injection.

**Fix:** In the downstream ETL consumer, validate or allowlist `where_extra` before interpolation, or replace freeform SQL with a structured filter schema (e.g., `{ column: "adopted_budget_amount", op: ">", value: 0 }`). At minimum, add a comment in the seeder documenting that `where_extra` is trusted-only configuration and must never be sourced from user input.

---

## Info

### IN-01: `onCategoryClick` Called With Potentially `undefined` Category Name

**File:** `src/components/dashboard/PlainLanguageSummary.tsx:220,230,242,280`

**Issue:** Category button click handlers use optional chaining: `onCategoryClick?.(topCategories[0]?.name, 'operating')`. Since `topCategories[0]` is only rendered when `topCategories.length > 0` (guarded by the `topCategories[0] &&` / `topCategories[1] &&` checks), the element will always be present when the button renders — making the `?.name` optional chain produce `string`, not `string | undefined`. However, TypeScript infers the argument type as `string | undefined` due to the `?.` operator, which does not match the `onCategoryClick: (categoryName: string, ...) => void` signature. This is a type-correctness issue that suppresses a genuine type error at call sites.

**Fix:** Use direct property access instead of optional chaining at these call sites, since the surrounding conditionals already guarantee the element exists:

```tsx
// Instead of:
onClick={() => onCategoryClick?.(topCategories[0]?.name, 'operating')}
// Use:
onClick={() => onCategoryClick?.(topCategories[0].name, 'operating')}
```

---

_Reviewed: 2026-06-03T19:26:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
