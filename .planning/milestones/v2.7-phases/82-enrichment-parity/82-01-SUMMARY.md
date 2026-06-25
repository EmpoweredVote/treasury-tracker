---
phase: 82-enrichment-parity
plan: 01
status: complete
completed: 2026-06-23
requirements: [VAENR-01]
---

# Phase 82-01 Summary — Virginia Enrichment Parity

**Goal met:** The Virginia function/activity/source categories loaded in Phases 80–81 now carry standardized, bleed-safe, plain-language **universal** enrichment, authored **inline at $0** and rendering in the live app. VAENR-01 satisfied.

## What was built

| File | What it is |
|------|-----------|
| `data/vaEnrichment82.mjs` | Explicit `VA_ENRICHMENT` map keyed by exact `name_key` — one hand-authored row for all **73** live VA keys — plus `EXPECTED_KEYS`. Entity- AND state-neutral voice (matches `caParityEnrichment61` CONCEPTS); no locality names, no `$` figures. |
| `scripts/loadVAEnrichment82.mjs` | Live-worklist loader: derives distinct operating+revenue depth-0/1 `link_key`s for all `state='VA'` entities, resolves each via the map, **ABORTS on any unmapped live key** (100% coverage gate — no fallback). Runs a `$`-leak guard + a locality-name guard, then `--apply` does **delete-then-insert** of universal rows. Dry-run by default; `main()` entry-guarded. |
| `scripts/loadVAEnrichment82.test.mjs` | 9 offline `node:test` cases — 73-key coverage, synthetic-miss detection, `$`-leak=0, locality-leak=0 (+ planted-leak caught), interest disambiguation, miscellaneous fix. |
| `data/va-enrichment-82.expanded.json` | Committed audit trail (73 authored rows). |

## Design (why it differs from Phase 72 Utah)

Virginia's category vocabulary is **fixed and standardized statewide** by the APA Comparative Report, so it is a small closed set — exactly **73 keys** (verified live). That made an **explicit hand-authored map + 100% coverage gate** the right model, rather than Utah's heuristic router-with-fallback (which existed only for Utah's unbounded messy fund names). Coverage is guaranteed by assertion: the loader aborts if any live VA key has no map row.

- **Scope incl. state node (D-82-04):** all 73 keys including the 12 `virginia general fund budget/revenue` state-node keys (framed as Virginia state program areas / statewide taxes).
- **Shared-key policy (D-82-03 "improve + fix"):** 7 keys (`public safety`, `public works`, `education`, `community development`, `fines and forfeitures`, `revenue from use of money and property`, `miscellaneous`) are universal rows also read by CA/MA/UT/TX/OR. They were overwritten with improved state-neutral text — notably correcting the stale `miscellaneous` row from **"Information Technology" → "Miscellaneous Revenue"** (it was wrong for VA *and* MA's 351 entities).
- **Idempotency (D-82-06):** writes use **delete-then-insert** over the authored keys, not upsert — the `(name_key, municipality_id)` index is NULLS DISTINCT, so upsert would insert duplicate universal rows. Re-running `--apply` reproduces the same 73 rows, 0 duplicates.
- **Disambiguation (D-82-08):** `general property taxes|interest` (interest on delinquent tax) and `revenue from use of money and property|interest` (investment interest) carry distinct, parent-correct descriptions.

## App join (confirmed, read-only — no code changed)

This is a **data-only** phase. `src/data/dataLoader.ts` fetches the budget tree from the REST API, which joins `category_enrichment` by `name_key` (= `link_key`; depth-1 = `parent|child` composite), city-scoped row first then NULL universal. `src/App.tsx` reads `category.enrichment.{plainName,shortDescription,description}`. The `name_key`s written equal the live `link_key`s, so the universal rows join and render.

## Verification

- **Offline (Task 1–2):** `node --check` + `node --test` all green (9/9).
- **Dry-run (Task 3):** 162 VA entities / 618 budgets → 73 distinct live keys, 100% mapped (0 missing, 0 stale), `$`-leak=0, locality-leak=0, zero writes.
- **Apply (Task 4):** delete-then-insert wrote 73 universal rows. DB-verified: 73/73 coverage, **0 duplicate universal keys**, idempotent on re-run, `miscellaneous`="Miscellaneous Revenue", shared keys carry the new rows, both `interest` senses distinct.
- **Live-app UAT (Chris, 2026-06-23):** VA city + county + town render plain-language functions/activities; bleed-safe; CA + MA no-regression confirmed (`miscellaneous` reads as revenue). **Signed off — all pass.**

## Cost

$0 — no paid AI API path exists in the loader; authoring is fully inline/static (within the $5 gate; unfunded nonprofit).

## Notes / follow-ups

- Verification (ACFR reconciliation, full-cohort source-chain audit, broader live UAT) is **Phase 83** (VAVER-01/02), not this phase.
- The 7 shared-key overwrites improved CA/MA rendering too (state-neutral voice + miscellaneous fix); confirmed non-regressed in UAT.

## Self-Check: PASSED
