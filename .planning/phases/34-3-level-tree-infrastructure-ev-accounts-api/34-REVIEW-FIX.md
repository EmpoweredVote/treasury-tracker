---
phase: 34-3-level-tree-infrastructure-ev-accounts-api
fixed_at: 2026-06-08T13:15:00Z
review_path: C:/treasury-tracker/.planning/phases/34-3-level-tree-infrastructure-ev-accounts-api/34-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-06-08T13:15:00Z
**Source review:** C:/treasury-tracker/.planning/phases/34-3-level-tree-infrastructure-ev-accounts-api/34-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04)
- Fixed: 6
- Skipped: 0

Note: All commits were made in the EV-Accounts repo (C:/EV-Accounts) on the `master` branch. CR-01 and WR-03 were combined into a single atomic commit because both changes modify the same `afterAll` block.

## Fixed Issues

### CR-01: `pool` is never assigned when `beforeAll` throws, but `afterAll` calls `pool.end()` unconditionally

**Files modified:** `backend/test/treasury-3level.test.ts`
**Commit:** 2052945
**Applied fix:** Wrapped both the DELETE query and `pool.end()` in `if (pool)` guards so a beforeAll throw (missing DATABASE_URL) does not cause a secondary TypeError in afterAll that masks the original error.

---

### CR-02: `.env` parser silently embeds inline `#` comments into env var values

**Files modified:** `backend/test/treasury-3level.test.ts`
**Commit:** 88d0ce7
**Applied fix:** Added `.replace(/\s+#.*$/, '')` to extract `rawVal` before assigning to `process.env`, stripping inline `#` comments from .env values. The two-step `rawVal` + guard pattern matches the reviewer's suggested form exactly.

---

### WR-01: `buildNode` uses a non-null assertion on `nodeMap.get(id)` with no error context

**Files modified:** `backend/test/treasury-3level.test.ts`
**Commit:** 53eb65d
**Applied fix:** Replaced `nodeMap.get(id)!` with an explicit `if (!node) throw new Error(...)` guard that includes the missing node ID in the error message, making data-inconsistency failures diagnosable.

---

### WR-02: TREE-03 backward-compat assertions check only `tree[0]` — silently passes if other roots have depth-2 data

**Files modified:** `backend/test/treasury-3level.test.ts`
**Commit:** 264a260
**Applied fix:** Replaced the `root.subcategories![0].subcategories` undefined assertion in all three TREE-03 tests (Sacramento, Plano, Allen) with a `catRows.reduce()` maxDepth check that covers every category row in the budget, not just the first root's first child.

---

### WR-03: `afterAll` cleanup DELETE result is not checked — silent failure leaves FY=9999 sentinel in the database

**Files modified:** `backend/test/treasury-3level.test.ts`
**Commit:** 2052945 _(combined with CR-01)_
**Applied fix:** Captured the DELETE result as `res` and added `if (res.rowCount === 0) console.warn(...)` to surface silent cleanup failures. Integrated into the same atomic commit as CR-01 since both changes modify the `afterAll` block.

---

### WR-04: `SUPABASE_URL` has a hardcoded fallback to a specific live Supabase project URL

**Files modified:** `backend/test/treasury-3level.test.ts`
**Commit:** a6ac88e
**Applied fix:** Removed the `|| 'https://kxsdzaojfaibhuzmclfq.supabase.co'` fallback and added an explicit `if (!SUPABASE_URL) throw new Error(...)` guard, matching the safety posture already applied to `DATABASE_URL`. A developer with a misconfigured env now gets a clear error instead of unknowingly targeting production.

---

_Fixed: 2026-06-08T13:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
