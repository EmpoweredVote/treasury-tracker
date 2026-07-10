---
phase: 130-verification-live-uat
requirement: TUC-07
kind: blind-re-derivation + source-chain-audit + D-05-confirmation
date: 2026-07-10
method: loader-independent (from-scratch JS parser, `pdftotext -table`, live-DB diff, exact-$0 tolerance)
ai_spend: "$0 (no AI calls)"
result: PASS
coverage: 20/20 FY×mode roll-ups + every category subtotal + every displayed leaf
---

# Phase 130 — TUC-07 Machine Verification Log

**Result: PASS.** Every displayed Tucson General Fund figure — all 20 FY×mode roll-ups,
every category subtotal, and every displayed leaf across FY2015–FY2024 — was
independently re-derived directly from the source ACFR PDFs and ties the live
production DB at **exactly $0**. The full source-chain audit (D-04 a–e) is clean, and
the Phase-129 D-05 loader-hardening (CR-01/WR-01) is confirmed in place with a
residue-free idempotent re-run.

## Method (D-01, D-02, D-03, D-03a)

- **Harness:** `scripts/verify-phase130-rederive.mjs` — a from-scratch JS re-derivation.
  It does **not** import, require, or shell out to `scripts/extractTucson.py` (the
  Phase-128 loader extractor) or any shared module. It has its own money regex,
  statement-page finder, positional GF-column isolation, and section/tree builders.
- **Source read:** its own `pdftotext -table` call per PDF (never `-layout`, which
  scrambles the multi-fund columns). General Fund = column 0 by nearest-anchor from the
  fully-populated `Total revenues` / `Total expenditures` rows; a blank GF cell → 0.
- **Diff target:** the **live production DB** (`treasury.budgets` / `budget_categories`
  / `budget_line_items`), pulled independently — not `128-RECON.md`'s printed numbers
  and not the extractor. RECON was used only to map each `cot-<FY>-acfr.pdf` to its FY.
- **Tolerance:** exact-0 on every figure (`abs(delta) === 0`). Agreement between this
  independent JS path and the DB (built by the Python path) proves the displayed figures
  are real.

## Coverage (D-01, D-03) — all 20 FY×mode tie at $0

| Mode | FYs | Roll-up delta | Category-subtotal deltas | Leaf-value deltas |
|------|-----|---------------|--------------------------|-------------------|
| revenue   | 2015–2024 (10) | all $0 | all $0 | all $0 |
| operating | 2015–2024 (10) | all $0 | all $0 | all $0 |

Grand totals reproduced independently include FY2024 revenue **$773,493,270** and
FY2024 expenditure **$648,657,363** (excess **$124,835,907**) — matching the CONTEXT
grounding figures and the live DB.

### FY2024 leaf-level alignment (grounding year, label + value exact)

**Operating (expenditure by function):**

| Category | Leaf | PDF (independent) | DB | Δ |
|----------|------|-------------------|----|----|
| Current ($559,483,332) | Public safety and justice services | 296,810,861 | 296,810,861 | 0 |
| Current | Support services | 118,799,735 | 118,799,735 | 0 |
| Current | Community enrichment and development | 70,448,394 | 70,448,394 | 0 |
| Current | General government | 39,933,107 | 39,933,107 | 0 |
| Current | Elected and official | 33,491,235 | 33,491,235 | 0 |
| Capital outlay | Capital outlay | 23,231,173 | 23,231,173 | 0 |
| Capital projects | Capital projects | 6,071,102 | 6,071,102 | 0 |
| Debt service ($59,871,756) | Principal | 41,325,395 | 41,325,395 | 0 |
| Debt service | Interest | 18,522,806 | 18,522,806 | 0 |
| Debt service | Fiscal agent fees | 23,555 | 23,555 | 0 |

**Revenue (revenue by source):** Taxes 405,003,757 · Other agencies 243,252,208 ·
Charges for services 59,426,218 · Licenses and permits 35,693,685 · Use of money and
property 15,022,260 · Miscellaneous 6,445,615 · Fines and forfeitures 5,364,166 ·
Federal grants and contributions 2,628,271 · Contributions from outside sources 657,090
— every leaf ties the DB at $0.

### FY2021 / FY2022 merged-label quirk (only permitted disposition)

The documented cosmetic quirk (129 `deferred-items.md`) is a *label* merge, not a value
error. In this independent re-derivation the FY2021 (8) and FY2022 (7) revenue leaf
**value** multisets matched the DB exactly and the roll-ups tied at $0 — so no value
disposition was even required. The label cosmetics are confirmed unchanged and are
covered visually in the UAT (Plan 130-03, scenario h).

## Source-chain audit (D-04) — clean (a–e)

`scripts/verify-phase130-audit.mjs` (read-only DB + per-URL reachability), all PASS:

| Check | Result |
|-------|--------|
| **(a)** 20 `budgets` rows, all `source_url` + `source_date` non-null | PASS — 20/20, 0 nulls |
| **(b·1)** each row's `source_url` == correct-per-FY 128-RECON URL | PASS — all 20 point at their FY ACFR |
| **(b·2)** each distinct `source_url` resolves to a reachable PDF | PASS — FY2015–2024 all HTTP 200 `application/pdf` (2.5–56 MB) |
| **(c)** 0 orphan `data_sources` residue (`dataset_id ILIKE 'tucson%'`) | PASS — residue = 0 |
| **(d)** all `data_source` labels match expected per-FY/per-mode shape | PASS — all 20 match, no stale labels |
| **(e)** Tucson + Pima carry population>0 + `population_year`=2024 | PASS — Tucson 554,013/2024; Pima 1,080,149/2024; `Tucson.county_id == Pima.id` |

Note on (e): `treasury.municipalities` has no dedicated provenance column; `population_year = 2024`
is the Census Vintage-2024 marker and the pinned source lives in `scripts/seedTucsonArizona.js`.

## D-05 — loader-hardening confirmed + idempotent smoke-check

**Already applied in Phase 129's review-fix cycle** (129-REVIEW-FIX.md: CR-01 commit
55f359a, WR-01 commit 30aa388) — this phase **confirms**, it did not re-apply.

- **CR-01 (present):** `processMode()` wraps the per-FY loop in `try { … } finally {
  deleteEphemeralDataSource(…) }` (scripts/processTucson.js:313, 360) and every per-FY
  hard-fail inside the loop `throw`s rather than calling `process.exit()`, so the
  ephemeral row is always cleaned up. (`process.exit` remains only in the pre-loop setup
  functions `ensureMunicipality`/`createEphemeralDataSource`, which is correct.)
- **WR-01 (present):** the `loadFiscalYear` pre-load delete is keyed on
  `(municipality_id, fiscal_year, dataset_type)` (scripts/processTucson.js:267), not the
  dead `data_source_id`.
- `node --check scripts/processTucson.js` → OK.
- **Idempotent smoke re-run** (both modes, existing FY2015–FY2024 window only, no new
  FYs): completed cleanly, all 20 totals identical, and each mode logged
  `data_source … deleted (ephemeral cleanup — 0 residue, WR-05/LOAD-01)`.
- **Post-smoke re-verification:** the source-chain audit and the full re-derivation were
  re-run immediately after the smoke load — both PASS (0 residue, 20/20 tie at $0),
  proving the re-run netted 0 change.

## Reproduce

```bash
node scripts/verify-phase130-rederive.mjs   # exit 0 = all figures tie at $0
node scripts/verify-phase130-audit.mjs      # exit 0 = source chain clean (a–e)
```

Both are read-only against the DB (the audit additionally HEAD/GETs the 10 source URLs).
$0 AI spend. No new data, no new FYs, no schema/RPC/frontend change.
