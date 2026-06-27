---
phase: 89-mn-osa-source-loader-mnsrc-01-mnsrc-02
plan: 04
completed: 2026-06-27
requirements: [MNSRC-01, MNSRC-02]
status: complete
---

# 89-04 SUMMARY — De-risk dry-run proof gate

## What was done

Ran the milestone's prove-before-bulk gate as three zero-write `--dry-run`s and captured the
auditable record in `89-PROOF.md`. Pass criterion = parsed 3-level tree sum **ties exactly to the
entity row's own `Total Revenues` / `Total Expenditures`**.

| Proof | Entity | FY | Type | Basis | Revenue tie | Expenditure tie |
|---|---|---|---|---|---|---|
| D-06 headline | Minneapolis | 2023 | city | GAAP | $1,192,133,233 ✓ | $1,193,970,288 ✓ |
| D-07 basis path | Ada | 2023 | city | **Cash** | $2,281,736 ✓ | $2,966,174 ✓ |
| D-08 county path | Aitkin | 2021 | county | none (no GAAPInd) | $36,720,288 ✓ | $38,425,573 ✓ |

All ties drift = 0. County dry-run used `--entity-type county` and resolved the county source URL
(`county_21_-data.xlsx`) from the manifest. No D-03 guard tripped.

## Result
- The de-risk gate **PASSES** — the loader reproduces each entity's own totals across GAAP city,
  Cash-basis city, and county before any bulk load.
- `node --test scripts/loadMNOSA.test.mjs` → 11/11 (no regression; no loader/tree-map fix was needed).
- **Zero DB writes** in the entire phase.

## Files
- Created: `.planning/.../89-PROOF.md`, `.planning/.../89-04-SUMMARY.md`

## Self-Check: PASSED
- Three dry-runs tie exactly to row totals (D-06/D-07/D-08); `89-PROOF.md` records figures + basis +
  parent + source_url + pinned FY range + county divergences.
- Tests still pass; no DB writes.

## Phase 89 outcome
MNSRC-01 (loader + 3-level trees, proven on RCV city FY2023 ties) and MNSRC-02 (county URL pinned +
layout verified independently, GAAP/Cash basis from GAAPInd, per-FY manifest FY2012–2023, idempotent
never-overwrite guard, offline tests pass) are both satisfied. Bulk load proceeds in Phase 90.
