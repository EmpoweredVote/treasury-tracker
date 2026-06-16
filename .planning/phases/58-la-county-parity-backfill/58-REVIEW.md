---
phase: 58-la-county-parity-backfill
reviewed: 2026-06-16T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/data/cityBasisNotes.ts
  - src/App.tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-06-16
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (1 Warning, 2 Info — no Critical)

## Summary

Two files changed in phase 58-03 (basis-change disclosure note): `src/data/cityBasisNotes.ts` (new curated data module) and `src/App.tsx` (IIFE render block wiring). The implementation is sound in its core logic: the null-safety guard on `selectedEntity` is correct (the IIFE checks `selectedEntity ? ... : undefined` before accessing `.name`/`.state`, and the surrounding outer gate at line 897 narrows the render path further — `selectedEntity` is already guaranteed non-null by an early-return guard at line 687 before this JSX branch is ever reached). Key-construction matches the map schema exactly. The sourcing contract is met: both entries carry `source_name`, `source_url`, and `source_date`. The additive-gate pattern is structurally sound — county-directory pages are excluded by the `isCountyDirectoryOnly` guard, federal pages by the `entity_type === 'federal'` ternary, and all other non-keyed cities by absent map lookup returning `undefined` → `null`.

One substantive finding was identified: the `verifyComparabilitySources.mjs` URL-verification script is scoped only to `data/federal-comparability.json` and does not cover `src/data/cityBasisNotes.ts`. The single SCO ByTheNumbers URL used for both entries will never be machine-verified unless the script is extended. This is a maintainability/sourcing-pipeline gap rather than a runtime bug, but it is a meaningful deviation from the always-sourced ground rule's enforcement posture.

Two info-level observations round out the report.

---

## Warnings

### WR-01: `verifyComparabilitySources.mjs` does not cover `cityBasisNotes.ts` — sourcing pipeline gap

**File:** `scripts/verifyComparabilitySources.mjs:44` / `src/data/cityBasisNotes.ts:59,87`

**Issue:** The project's sourcing-verification script (`verifyComparabilitySources.mjs`) is hard-coded to read only `data/federal-comparability.json` (line 44: `const DATA_FILE = resolve(__dirname, '..', 'data', 'federal-comparability.json')`). The two `source_url` values in `cityBasisNotes.ts` (`https://bythenumbers.sco.ca.gov/d/ju3w-4gxp` — repeated for both Long Beach and West Hollywood entries) are therefore never machine-verified for availability. If the SCO ByTheNumbers URL is ever changed, retired, or goes down, the broken link will silently persist in the production disclosure note without any CI signal.

The always-sourced ground rule (T-58-03) is met at authoring time, but the verification script that enforces it is not extended to cover the new data module. This creates a two-class sourcing posture: federal sources are URL-verified; municipal disclosure sources are not.

**Fix:** Either (a) extend `verifyComparabilitySources.mjs` to also parse and verify URLs from `src/data/cityBasisNotes.ts`, or (b) create a lightweight sibling script `scripts/verifyCityBasisNotes.mjs` that reads the module, iterates entries, and HTTP-checks each `source_url`. Minimal addition:

```js
// scripts/verifyCityBasisNotes.mjs (new, ~30 lines)
// Reads src/data/cityBasisNotes.ts, extracts source_url values, and HTTP-GETs each.
// Exits non-zero on any 4xx/5xx or network error.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(__dirname, '../src/data/cityBasisNotes.ts'), 'utf8');
const urls = [...src.matchAll(/source_url:\s*'([^']+)'/g)].map(m => m[1]);
const unique = [...new Set(urls)];
let pass = true;
for (const url of unique) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const ok = res.ok || res.status === 405; // some hosts reject HEAD
    console.log(`${ok ? 'PASS' : 'FAIL'} [${res.status}] ${url}`);
    if (!ok) pass = false;
  } catch (e) {
    console.log(`FAIL [network] ${url}: ${e.message}`);
    pass = false;
  }
}
process.exit(pass ? 0 : 1);
```

---

## Info

### IN-01: Both entries share an identical `intro` string — duplicate literal

**File:** `src/data/cityBasisNotes.ts:44-46,71-73`

**Issue:** The `intro` field is copy-pasted verbatim for both `Long Beach|CA` and `West Hollywood|CA`:

```
'Budget figures for earlier years and recent years come from different reporting bases. ' +
'Totals are not directly comparable across that seam.'
```

This is not a bug — identical prose is intentional — but the literal is repeated twice in the source. If the wording needs to change in future, both occurrences must be updated in sync (easy to miss).

**Fix:** Extract to a named constant above the map:

```ts
const BASIS_CHANGE_INTRO =
  'Budget figures for earlier years and recent years come from different reporting bases. ' +
  'Totals are not directly comparable across that seam.';

export const cityBasisNotes: Record<string, CityBasisNote> = {
  'Long Beach|CA': { intro: BASIS_CHANGE_INTRO, entries: [...] },
  'West Hollywood|CA': { intro: BASIS_CHANGE_INTRO, entries: [...] },
};
```

### IN-02: IIFE pattern for conditional JSX — minor readability concern

**File:** `src/App.tsx:932-945`

**Issue:** The basis-note block uses an immediately-invoked function expression (IIFE) in JSX to perform the map lookup and return either the note or `null`. This is a functional pattern for conditional logic that needs an intermediate variable, and it works correctly. However, it increases nesting compared to a helper function or an alternative short-circuit pattern, and is slightly unusual in React codebases.

The outer `selectedEntity` null guard at line 897 (`navigationPath.length === 0 && !isCountyDirectoryOnly`) combined with the early-return guard at line 687 (`if (!selectedEntity) return ...`) means the ternary check inside the IIFE (`selectedEntity ? ... : undefined`) is technically redundant — `selectedEntity` is guaranteed non-null at this render site. The redundant guard is harmless and arguably defensive, but the unnecessary check inside the IIFE is a mild code smell.

**Fix (optional):** Either extract to a small helper function above `return` in App, or collapse to a simpler short-circuit now that `selectedEntity` is known non-null at this site:

```tsx
{/* Basis-change disclosure (D-08, Phase 58-03) */}
{cityBasisNotes[`${selectedEntity.name}|${selectedEntity.state}`] && (
  <div className="mb-6">
    <ComparabilityNote
      title="Note: budget history spans two reporting bases"
      intro={cityBasisNotes[`${selectedEntity.name}|${selectedEntity.state}`]!.intro}
      entries={cityBasisNotes[`${selectedEntity.name}|${selectedEntity.state}`]!.entries}
    />
  </div>
)}
```

Or with a local variable via early extraction (cleaner):

```tsx
{(() => {
  // selectedEntity is non-null here (early-return guard at line 687)
  const basisNote = cityBasisNotes[`${selectedEntity.name}|${selectedEntity.state}`];
  return basisNote ? (
    <div className="mb-6">
      <ComparabilityNote
        title="Note: budget history spans two reporting bases"
        intro={basisNote.intro}
        entries={basisNote.entries}
      />
    </div>
  ) : null;
})()}
```

The current implementation is already close to this second form — removing the redundant `selectedEntity ?` ternary is the only suggested improvement.

---

_Reviewed: 2026-06-16_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
