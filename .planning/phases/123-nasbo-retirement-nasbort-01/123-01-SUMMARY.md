---
phase: 123-nasbo-retirement-nasbort-01
plan: "123-01"
status: complete
completed: 2026-07-05
requirements: [NASBORT-01]
commits:
  - 77ddd37  # feat: guard + FALLBACK-ONLY relabel
  - fabb29b  # test: isAcfrOccupied unit test + stale GA sum fix
  - 30f63e9  # docs: 50/50 end-state doc + REQUIREMENTS updates
---

# Plan 123-01 Summary — NASBO Retirement (NASBORT-01)

## What was built

The NASBO operating loader `scripts/loadStateGF.mjs` is **demoted to fallback-only**
(retired, **not** deleted) now that all 50 states are on ACFR. Two mechanisms + a durable
end-state doc + REQUIREMENTS corrections.

### Task 1 — never-overwrite-ACFR guard + FALLBACK-ONLY relabel (commit 77ddd37)
- **Pure exported helper `isAcfrOccupied(existingDataSource)`** added near `dataSourceLabel`:
  - `null`/empty → `false` (node absent → NASBO may fill),
  - `/NASBO/i` → `false` (own fallback → idempotent refresh OK),
  - otherwise → `true` (ACFR/other source → protect, skip).
- **Guard in `loadStateFY`** (live mode only), placed AFTER municipality resolution and
  BEFORE the ephemeral `data_sources` insert: reads the existing operating row's
  `data_source` via `maybeSingle()`; if `isAcfrOccupied` is true, logs
  `SKIP <ST> FY<yr>: ACFR node present — NASBO retired to fallback-only` and `return false`
  → **no data_sources insert, no RPC, 0 residue** on skips. Dry-run path unchanged.
- **FALLBACK-ONLY relabel**: header docstring gets a `[FALLBACK-ONLY]` title + retirement
  intro (retired 2026-07-05, all 50 on ACFR, kept not deleted, points to the end-state doc);
  `main()` banner → `State GF Loader — NASBO (operating) [FALLBACK-ONLY]`.
- `node --check` exits 0; `grep FALLBACK-ONLY` → 5 hits; helper + SKIP line present.

### Task 2 — offline unit test for the guard (commit fabb29b)
- Added `isAcfrOccupied` to the import and a `test(...)` covering all three branches
  (absent/empty → false, NASBO-self → false, ACFR-occupied ×2 → true).
- **Deviation (in-scope):** a *pre-existing* test `GA categories ... sum is correct`
  asserted a stale `29_274_000_000`. Fix F-97-01 (Medicaid 3,398→3,390) changed the GA
  FY2023 sum to `29_266_000_000` (= `controlTotalGF`, and the `validateAgainstControl` test
  ties with 0 diff), but the assertion was never updated. Corrected it to `29_266_000_000`
  so the suite is green, as Task 2 acceptance requires.
- `node --test scripts/loadStateGF.test.mjs` → **15 tests, 15 pass, 0 fail**.

### Task 3 — read-only DB verification + 50/50 end-state doc (commit 30f63e9)
Read-only verification via `mcp__supabase-local__execute_sql` (no writes):

| Check | Result |
|-------|--------|
| Distinct states with ACFR operating | **50** |
| Live operating nodes with NASBO `data_source` | **2** — NV FY2024, KY FY2023 |
| NV FY2024 / KY FY2023 same-year ACFR operating? | **No** — NASBO row is the only operating row for each |
| MS (ACFR-41) ACFR operating | **Yes** — FY2003–2024 |
| MT (ACFR-42) ACFR operating | **Yes** — FY2015–2025 |

- Wrote **`docs/state-acfr-5050.md`**: the 50/50-ACFR end state, the two accepted honest
  NASBO fallbacks (NV FY2024 latest-year tail; KY FY2023 one-year ACFR hole) with reasons +
  natural-supersession path, the NASBORT-01 retire-to-fallback-only decision (kept, not
  deleted), and the verification results.
- **`.gitignore`**: re-included `docs/state-acfr-5050.md` (`docs/*` is ignored; durable
  source-of-record docs are re-included by the established `!docs/…` convention).
- **`.planning/REQUIREMENTS.md`**: NASBORT-01 → `[x]`; corrected ACFR-41 (MS) / ACFR-42 (MT)
  → `[x]` (completed Ph119, left unchecked); status-table rows → Complete.

## Criteria met
- NASBORT-01 satisfied: loader is fallback-only (pure unit-tested guard + relabel), not deleted.
- Criterion #2: no live node shows NASBO where same-year ACFR exists — only NV FY2024 + KY
  FY2023 remain, both ACFR-gap years.
- Unfiltered re-run overwrites 0 ACFR nodes (guard skips before any write) and is idempotent.
- 50/50-ACFR end state + two honest fallbacks + retirement documented.

## Key files
- created: `docs/state-acfr-5050.md`
- created: `.planning/phases/123-nasbo-retirement-nasbort-01/123-01-SUMMARY.md`
- modified: `scripts/loadStateGF.mjs`, `scripts/loadStateGF.test.mjs`, `.planning/REQUIREMENTS.md`, `.gitignore`

## Deviations
- Fixed a pre-existing stale test assertion (GA FY2023 sum 29,274→29,266) to satisfy the
  "all pre-existing tests green" acceptance — data was corrected by F-97-01; test lagged.
- Added a `.gitignore` re-include for the new doc (unavoidable: `docs/*` is ignored).

## Phase 124 hand-off
VER-10 (Chris live-app UAT) should confirm no state node displays NASBO where same-year
ACFR exists; the two fallbacks (NV FY2024, KY FY2023) are the only NASBO nodes and are the
accepted ACFR-gap years.

## Self-Check: PASSED
