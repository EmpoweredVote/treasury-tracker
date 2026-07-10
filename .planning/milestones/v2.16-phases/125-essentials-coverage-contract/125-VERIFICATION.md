---
phase: 125-essentials-coverage-contract
verified: 2026-07-08T07:05:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 125: Essentials Coverage Contract Verification Report

**Phase Goal:** Give Treasury Tracker the ability to learn Essentials' coverage and
resolve the banner's current entity to an Essentials coverage record (COV-02, COV-03,
COV-04 consumer half), proven by a fixture-backed vitest suite and wired into
`App.tsx` as an invisible-but-real DOM seam for Phase 126.

**Verified:** 2026-07-08
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `fetchCoverage` fetches once per session, caches, never throws, returns null on failure/!ok/bad-shape | ✓ VERIFIED | `src/utils/essentialsCoverage.ts:95-118` — module-level `let coveragePromise` assigned inside `fetchCoverage`, guarded by `if (coveragePromise) return coveragePromise`; `try/catch → null`; `!res.ok → null`; `isValidCatalogShape` gate. Unit tests (`essentialsCoverage.test.ts:98-115`) simulate a rejected fetch and a `{ok:false}` response — both resolve to `null`. `npx vitest run` → 14/14 pass. |
| 2 | `matchEntityToCoverage` is tier-aligned (federal/state/county/city + null for other types) | ✓ VERIFIED | `essentialsCoverage.ts:158-204` — explicit `entity_type === 'federal'` branch, `'state'` branch (abbrev match), county/city branch via `CITY_TIER_TYPES` set, `else return null` catches nonprofit/special_district/etc. Test: nonprofit entity → null (`test.ts:87-90`), passes. |
| 3 | Loose matching ports Essentials `normalizePlace` (saint/punctuation) + strips trailing "County"/", XX"; both Washington County OR (41067) and UT (49053) resolve to their own state, no cross-collision | ✓ VERIFIED | `normalizePlace` (line 124-131) contains `replace(/\bsaint\b/g` and `replace(/\./g` exactly as required. `stripLabel` (136-141) strips `, XX` and trailing ` county`. Fixture (`__fixtures__/coverage.sample.json`) contains both label forms; tests at `test.ts:51-66` assert OR→`['41067']` and UT→`['49053']`, with an explicit `expect(m?.geoids).not.toEqual(['41067'])` cross-collision guard. St. Mary's County punctuation case also passes (`test.ts:43-49`). |
| 4 | Federal entity resolves to the federal record's `browse_federal_officials` target (COV-04 consumer half) | ✓ VERIFIED | `test.ts:78-85` asserts `target === '/results?browse_federal_officials=1&browse_label=United+States'`; fixture matches. Independently re-verified live: `curl https://essentials.empowered.vote/coverage.json` returns this exact string in production (see Behavioral Spot-Checks below) — the plan's fixture is not fictional, it mirrors the real producer output. |
| 5 | App.tsx exposes a real `data-essentials-coverage="covered\|none"` seam, value consumed, no icon/link/img rendered | ✓ VERIFIED | `App.tsx:814` — `data-essentials-coverage={essentialsCoverage ? 'covered' : 'none'}` on the hero banner root div (line 808). `essentialsCoverage` declared at line 177 via `useEssentialsCoverage(selectedEntity)` and consumed only in this attribute — `npx tsc -b` exits 0 (no unused-local error). `git show 82902b3` confirms the entire App.tsx diff is 3 additions (import, hook call, attribute) — no `<a>`, `<img>`, or icon added. |
| 6 | Verification gates: tsc, vitest, build all exit 0; lint deviation is legitimate (new files contribute zero errors, App.tsx's 3-line diff didn't touch any flagged lines) | ✓ VERIFIED (with documented, confirmed-legitimate deviation) | See Behavioral Spot-Checks and Anti-Patterns below — independently re-run, not trusted from SUMMARY. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/essentialsCoverage.ts` | fetch/cache/matcher/hook, all exports present | ✓ VERIFIED | Exports `fetchCoverage`, `matchEntityToCoverage`, `normalizePlace`, `useEssentialsCoverage`, `ESSENTIALS_URL`, `CoverageCatalog`/`CoverageRecord` types — all confirmed by direct read. No `dangerouslySetInnerHTML` (grep exit 1 = not found). No URL string built from catalog fields inside this file. |
| `src/utils/essentialsCoverage.test.ts` | fixture-backed suite, 14 assertions | ✓ VERIFIED | 14 test cases across 3 `describe` blocks; all pass under `npx vitest run`. |
| `src/utils/__fixtures__/coverage.sample.json` | agreed contract shape, both county-label forms, federal target | ✓ VERIFIED | Present, matches D-02c shape; contains Long Beach, Bloomington, LA County, St. Mary's County, both Washington County forms, CA/TX states, federal record. |
| `vitest.config.ts` | node env, `src/**/*.test.ts` include | ✓ VERIFIED | Matches exactly. |
| `.env.example` | `VITE_ESSENTIALS_URL` documented | ✓ VERIFIED | `VITE_ESSENTIALS_URL=https://essentials.empowered.vote` present. |
| `src/App.tsx` | seam wired, no icon | ✓ VERIFIED | See truth #5 above. |
| `package.json` | `"test": "vitest run"` script | ✓ VERIFIED | Present at line 11. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `App.tsx` | `essentialsCoverage.ts` | `import { useEssentialsCoverage } from './utils/essentialsCoverage'` + call at L177 | ✓ WIRED | Confirmed via grep + `git show 82902b3`. |
| `useEssentialsCoverage` | `fetchCoverage` + `matchEntityToCoverage` | effect calls `fetchCoverage().then(cat => setRecord(matchEntityToCoverage(entity, cat)))` | ✓ WIRED | `essentialsCoverage.ts:223-226`. |
| `essentialsCoverage.ts` (TT) | Essentials production `coverage.json` | `fetch(\`${ESSENTIALS_URL}/coverage.json\`)` | ✓ WIRED (live) | Independently re-curled during this verification (not trusting SUMMARY): `https://essentials.empowered.vote/coverage.json` → 200, `access-control-allow-origin: *`, body has `cities:136, counties:16, states:50, federal:{...}` — the federal target string is byte-identical to the fixture/test expectation. |

### Behavioral Spot-Checks (independently re-run, not trusted from SUMMARY)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck | `npx tsc -b` | exit 0, no output | ✓ PASS |
| Test suite | `npx vitest run` | `Test Files 1 passed (1)`, `Tests 14 passed (14)` | ✓ PASS |
| Production build | `npm run build` | `tsc -b && vite build` → exit 0, dist emitted | ✓ PASS |
| Lint (whole repo) | `npm run lint` | exit 1 — `15 problems (13 errors, 2 warnings)` | ✗ FAILS (see deviation analysis below) |
| Live coverage.json fetch | `curl -i -H "Origin: https://financials.empowered.vote" https://essentials.empowered.vote/coverage.json` | 200 OK, `access-control-allow-origin: *`, valid JSON with all 5 keys | ✓ PASS |
| Live federal record content | curl body parsed | `{"label":"United States","target":"/results?browse_federal_officials=1&browse_label=United+States"}` — matches fixture exactly | ✓ PASS |

### Lint Deviation Analysis (independently verified, not trusted from SUMMARY)

The plan's acceptance criterion for task 125-04 required `npm run lint` to exit 0; it exits 1.
The executor documented this as a pre-existing, unrelated failure. This was independently
re-verified rather than trusted:

1. **Full lint output captured** (not just the SUMMARY's partial line list): 13 errors + 2
   warnings across `.claude/workflows/state-budgets-all-50.js` (1 parsing error),
   `src/App.tsx` (6 `react-hooks/set-state-in-effect` errors at lines 171, 376, 389, 457,
   484, 524 + 1 `react-hooks/exhaustive-deps` warning at 699), `src/components/BudgetTree.tsx`
   (1 warning), `src/components/dashboard/BudgetSearch.tsx` (1 error), `src/data/dataLoader.ts`
   (5 `no-explicit-any` errors). **Note:** the SUMMARY's deviation note under-enumerated this
   list (it named only 389/457/484/524/699 in App.tsx and omitted lines 171, 376, and the
   `.claude/workflows` parsing error entirely) — but its aggregate count ("13 errors + 2
   warnings") was correct.
2. **Diff isolation:** `git show 82902b3 -- src/App.tsx` shows the plan's entire App.tsx diff
   is 3 additions (an import line, a hook-call + comment block, one JSX attribute) — none of
   the 6 flagged App.tsx lines are touched by this plan.
3. **Regression check:** checked out the pre-phase commit (`059d154`, immediately before
   `4e4ccc9` which starts this plan's work) and re-ran `npm run lint` on that tree — it
   produces the **identical** `15 problems (13 errors, 2 warnings)` result. This proves the
   lint state is byte-for-byte unchanged by this plan, not merely "probably pre-existing."
4. **New-files-only scope check:** `eslint-plugin-react-hooks` is pinned to `7.0.1` in
   `package-lock.json` both before and after this plan's `npm install -D vitest`.

**Verdict on this deviation: legitimate.** The lint failure is 100% pre-existing,
unrelated to this plan's scope, and independently reproduced on the pre-phase commit.
This is a **PASS-WITH-DEVIATION**, not a gap — the deviation is accepted as documented
(a repo-wide lint debt that predates and is untouched by this phase). No override entry
is required since the deviation is a whole-repo command failure unrelated to the
must-haves, and the plan's own files (`essentialsCoverage.ts`, `essentialsCoverage.test.ts`,
`vitest.config.ts`) contribute zero lint errors of their own — confirmed by the diff
isolation and file-scoped nature of every flagged line.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| COV-01 | 125 (Essentials-side, cross-repo) | Essentials publishes coverage.json + CORS | ✓ SATISFIED | REQUIREMENTS.md marked `[x]`; independently re-curled live in this verification session — 200/CORS/valid shape. |
| COV-02 | 125 | TT fetch/cache/never-throw | ✓ SATISFIED | Truth #1 above. |
| COV-03 | 125 | Tier-aligned, loose, state-scoped matching | ✓ SATISFIED | Truths #2, #3 above. |
| COV-04 | 125 | Federal national-officials route + catalog record + TT consumer resolution | ✓ SATISFIED | Truth #4 above; both producer (curl) and consumer (test) sides confirmed. |

No orphaned requirements found for this phase in REQUIREMENTS.md (TETH-01/TETH-03/VER-01
correctly remain mapped to Phases 126/127, not this phase).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/utils/essentialsCoverage.ts` | 230 | `eslint-disable-next-line react-hooks/exhaustive-deps` | ℹ️ Info | Intentional — effect is keyed on `entity?.id` only, standard pattern already used in `wikiImage.ts`-style effects. Not a blocker. |

No TBD/FIXME/XXX markers, no placeholder returns, no hardcoded-empty stubs found in any
of the 3 new source files.

### Human Verification Required

None. All truths in this phase are programmatically verifiable (pure functions + a
fixture + a real, independently-curled live endpoint). Full end-to-end live-browser UAT
(actual `fetch()` from a running TT app in a browser against the deployed catalog) is
explicitly Phase 127's job (VER-01) per the plan's scope_note — not a gap in this phase.

### Gaps Summary

None. All 6 must-haves verified against the actual codebase (not SUMMARY claims):
fetch/cache/never-throw behavior read and unit-tested; matcher tier-alignment and
state-scoped disambiguation read and unit-tested including the two real county-label
forms; the federal consumer path tested against a fixture that was independently
confirmed byte-identical to the live production catalog; the App.tsx seam confirmed via
direct diff inspection to be exactly 3 lines with no icon/link added; tsc/vitest/build
independently re-run and green; the one lint deviation independently reproduced against
the pre-phase commit and confirmed byte-for-byte unrelated to this plan's scope.

---

*Verified: 2026-07-08*
*Verifier: Claude (gsd-verifier)*
