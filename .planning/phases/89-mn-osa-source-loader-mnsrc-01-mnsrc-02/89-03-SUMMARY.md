---
phase: 89-mn-osa-source-loader-mnsrc-01-mnsrc-02
plan: 03
completed: 2026-06-27
requirements: [MNSRC-01, MNSRC-02]
status: complete
---

# 89-03 SUMMARY — Offline unit tests (scripts/loadMNOSA.test.mjs)

## What was built

`scripts/loadMNOSA.test.mjs` — `node:test` + `node:assert/strict`. Pure-helper tests always run;
data-backed tests assert hard against the gitignored `_mn-recon/` samples when present and **skip
gracefully** when absent (fresh-clone safe). 11 tests, all passing.

## Coverage

- **Pure helpers (always run):** `cellNum` formula-safety (number, `{result}`, rejects
  formula-without-result / richText / null, parses `$1,234`); `DATA_SOURCE_NAME` literal;
  `normalizeLabel` ties the D-08 variants (`Conservation ofNatural` == `of Natural`,
  `Ecenomic`→`Economic` alias, case-insensitive); `resolveSourceUrl` city-vs-county per FY (D-05).
- **City data-backed:** Minneapolis revenue tree sum === `Total Revenues` (self-consistency) +
  Intergovernmental is genuine 3-level (D-04); expenditure sum === `Total Expenditures` + current/
  capital leaves present (D-02); no `& Other`/`Total Current/Capital`/`Total Public Safety Capital
  Outlay` node (D-03/D-05); GAAP basis + Hennepin parent + finite population; Cash-basis cities
  (Ada, Adams) tie + report 'Cash' (D-07); D-03 double-count guard holds (Intergovernmental parent
  === sum of children).
- **County data-backed (D-08):** Aitkin + Anoka parse through the SAME builders and tie to row
  totals; absent GAAPInd → basis null, absent ParentEntityName → '' (handled gracefully).

## Result

```
ℹ tests 11
ℹ pass 11
ℹ fail 0
ℹ skipped 0
```

## Files
- Created: `scripts/loadMNOSA.test.mjs`, `.planning/.../89-03-SUMMARY.md`

## Self-Check: PASSED
- `node --test scripts/loadMNOSA.test.mjs` exits 0, 11/11 pass.
- Data-backed tests gated on `existsSync` (skip when samples absent — they did not fail with samples present).
- Asserts tree-sum self-consistency, 3-level shape (D-02/D-04), D-03 double-count guard, GAAPInd basis (D-07), county divergence (D-08).
- No loader changes, no DB writes.
