# Phase 125 — Deferred / Out-of-Scope Items

## `npm run lint` fails on pre-existing, unrelated code (not introduced by this plan)

**Discovered during:** Task 125-04 verification.

**Finding:** `npm run lint` exits 1 with 13 errors + 2 warnings, entirely inside files
this plan did not touch or on lines this plan did not add:

- `src/App.tsx` lines 389, 457, 484, 524 (pre-existing `useEffect` bodies, not the
  lines added by 125-03), plus a pre-existing warning at line 699
  (`react-hooks/set-state-in-effect`, `react-hooks/exhaustive-deps`)
- `src/components/BudgetTree.tsx` line 118 (`react-hooks/exhaustive-deps` warning)
- `src/components/dashboard/BudgetSearch.tsx` line 75 (`react-hooks/set-state-in-effect`)
- `src/data/dataLoader.ts` lines 42, 63, 64, 120x2 (`@typescript-eslint/no-explicit-any`)

**Verification that this plan did not cause it:** `eslint-plugin-react-hooks` was
already pinned to `^7.0.1` (resolved `7.0.1`) in `package-lock.json` before this
plan's `npm install -D vitest`, confirmed unchanged by diffing the lockfile entry
before/after. `git diff` of `src/App.tsx` for this plan touches only three
locations (the `useEssentialsCoverage` import, the hook call at ~L172-176, and
the `data-essentials-coverage` attribute at ~L814) — none of which are the
flagged lines. Running `npx eslint` scoped to only the files this plan created
(`src/utils/essentialsCoverage.ts`, `src/utils/essentialsCoverage.test.ts`,
`vitest.config.ts`) returns zero errors/warnings.

**Root cause:** `eslint-plugin-react-hooks` v7's `recommended` config turns on a
new `react-hooks/set-state-in-effect` rule (error severity) that flags several
pre-existing `useEffect` bodies across the codebase that call `setState`
synchronously in the effect body — a long-standing, working pattern in this
codebase (see `wikiImage.ts`-style entity-change effects) that predates this
plan and predates (or was unaffected by) the react-hooks version already
pinned in the lockfile.

**Disposition:** Out of scope per the executor's scope-boundary rule (pre-existing
failures in unrelated files/lines are not auto-fixed). Not fixed in this plan.
Recorded here for a future cleanup phase; `npx tsc -b`, `npx vitest run`, and
`npm run build` all exit 0 for this plan's changes.
