# LA-02 — Fix LA City's severed history (SCOPING, no writes yet)

**Created:** 2026-08-20. **Predecessor:** `LA-01-SOCRATA-RECON-HANDOFF.md` (read its §10, not §9).
**Status:** SCOPED. No DB write, no loader run. **Branch:** create `feat/la-02` off `main`.

> **Headline: the ACFR load Chris approved is NOT needed and should not be built.**
> LA-01 §10.7 recommended it. That recommendation was made without checking whether the
> CA State Controller — the source that already supplies LA's FY2003–2020 — still
> publishes. **It does, through FY2024.** The fix is one already-trusted loader over
> four more years, not a new PDF pipeline. Scoping the ACFR load would have been
> ~2 orders of magnitude more work for a strictly worse result.

---

## 1. What LA's FY2021+ rows actually are

Both defects trace to one mislabel. `Socrata: https://data.lacity.org` is stamped on
**two unrelated datasets**:

| Rows | What they REALLY are | Evidence |
|---|---|---|
| **revenue FY2021–2024** | **CA State Controller ByTheNumbers** — the SAME source as FY2003–2020 | Totals are **dollar-identical to SCO in all 4 years** (see §2), and the stored categories are verbatim SCO taxonomy |
| **operating FY2021–2025** | **LA's own FMS appropriation ledger** | `hierarchy = ["Department_Name","SubDepartment_Name","Program_Name"]`; categories are `POLICE`, `TRANSPORTATION`, `NON-DEPARTMENTAL - …`, `TX REV ANTICIP NOTE PROC` |

This is why LA-01's reconciliation failed against every ACFR scope. It was reconciling a
**departmental appropriation ledger** to **audited fund statements**. §10.1–10.5 stand
untouched: the `all_funds` classification really was fitted, and really must not ship.
What changes is §10.6's guess and §10.7's remedy.

⚠ **The operating figures are not just differently-scoped, they are wrong as "Money Out."**
FY2023 includes **`TX REV ANTICIP NOTE PROC` = $1,322,635,748** — Tax Revenue Anticipation
Note *proceeds*. That is **borrowing, i.e. money IN**, sitting inside a total the product
labels money out. 7.3% of the FY2023 figure. Appropriation ledgers also double-count
reappropriations and interfund charges, which is the "unelimited interfund activity"
signature LA-01 §10.6 half-guessed.

## 2. The evidence — SCO vs what is stored

`entity_name='Los Angeles' and county='Los Angeles'`, datasets `ju3w-4gxp`
(Expenditures) / `rrtv-rsj9` (Revenues), summed over all categories.

**Revenue — SCO already IS the stored figure, to the dollar:**

| FY | SCO `rrtv-rsj9` | Stored (as "Socrata") | Δ |
|---|---|---|---|
| 2021 | 17,563,869,909 | 17,563,869,909 | **$0** |
| 2022 | 19,280,740,014 | 19,280,740,014 | **$0** |
| 2023 | 21,141,407,923 | 21,141,407,923 | **$0** |
| 2024 | 21,612,492,478 | 21,612,492,478 | **$0** |

Four dollar-exact matches cannot be coincidence. **No reload is needed on the revenue
side — only the label and the classification are wrong.**

**Expenditure — SCO exists and the stored figure is a different (wrong) thing:**

| FY | SCO `ju3w-4gxp` | Stored (LA FMS) | Stored is |
|---|---|---|---|
| 2021 | 17,310,021,336 | 16,169,677,524 | −$1.14B |
| 2022 | 18,439,009,336 | 17,447,658,557 | −$0.99B |
| 2023 | 19,535,449,964 | 18,162,091,478 | −$1.37B |
| 2024 | 21,517,484,103 | 19,974,332,525 | −$1.54B |

**The control that proves the loader reproduces SCO:** FY2020, already loaded from SCO,
is `16,988,602,989` in the DB and `16,988,602,989` from the API — and FY2017–2019 match
too. So the existing loader's sum-all-categories construction is exact, and the FY2021–24
numbers above are what it will write.

**Both series come out continuous, with no seam and no new source:**

* Money Out: 16.99B (FY20) → 17.31 → 18.44 → 19.54 → **21.52B** (FY24)
* Money In: 17.08B (FY20) → 17.56 → 19.28 → 21.14 → **21.61B** (FY24)

## 3. Plan

**Task 1 — Load SCO expenditures FY2021–2024.** Reuse `scripts/bulkLoadStateController.js`
(the loader that produced FY2003–2020). ⚠ Drive it **per `--fy` in a retry loop** — the SCO
API times out intermittently ([[project_sco_api_flaky_per_fy_retry]]). Overwrites 4
`operating` rows. Dry run first; verify each total against §2 before accepting.

**Task 2 — Correct the revenue label on FY2021–2024.** Figures are already right, so this
must **not** be a reload. ⚠ **Do NOT use `treasury_sync_city_budget`** — it overwrites
(muni,fy,dataset) and *keeps the stale source label*, which is the bug that created this
mess ([[project_sync_city_budget_not_source_safe.md]]). Relabel `data_source` →
`CA State Controller - Revenues` and backfill `source_url`/`source_date` to match the
FY2003–2020 rows.

**Task 3 — Classify.** `CA State Controller - Expenditures` / `- Revenues` are **already
evidenced** registry entries carrying `all_funds/actual`, so the 8 corrected rows classify
with no new evidence needed. ⚠ Run the stampers **AFTER** the loader — both write `unknown`
on a fresh row, so loading un-classifies ([[project_austin_travis_onboarding]]). Bump
`EXPECTED_ROWS` / `EXPECTED_BASIS_ROWS` / `EXPECTED_REPORTING_ENTITY_ROWS`.

**Task 4 — Backfill the remaining NULL citations** on whatever FY2021+ rows survive.

**Task 5 — Verify the seam.** `scripts/verify-scope-seams.mjs` + confirm the UI renders
one continuous FY2003–2024 series for both datasets, single series, no toggle needed.

## 4. What this does NOT fix — decisions for Chris

1. **FY2025 is stranded.** SCO's max is **FY2024** on both datasets, so FY2025 cannot be
   made continuous this way. It is currently the worst row in the table: operating from
   the LA FMS ledger ($25.06B, including TRAN proceeds) and revenue from the ACFR
   ($23.46B) — two different documents presented as one year. Options: withdraw FY2025
   until SCO publishes (my recommendation — a 2003–2024 continuous series is a clean
   product), or keep it visibly unclassified and out of the continuous series.
2. **FY2026** is an adopted budget in the actuals lane ($28.92B, operating only). Classify
   `basis: adopted` so it stops reading as actuals, or withdraw it.
3. **Do we keep the LA FMS operating data at all?** It has real value as a *departmental*
   view (it is the only LA source with department/program detail) — but it is not Money Out
   and must never be differenced against revenue. Park it, or surface it as a separate
   labelled dataset later.
4. ⚠ **This mislabel is probably not unique to LA.** The same loader wrote
   `Socrata: https://data.lacity.org` over SCO revenue data for one city; an audit of
   which other municipalities carry a portal label on SCO figures is worth its own task.

## 5. Guardrails

* 🛑 No write before a dry run; verify every total against §2 after.
* 🛑 Do not touch FY2025/FY2026 — §4 items 1–2 are Chris's calls.
* 🛑 `main` is branch-protected on `build`; PR only, never push to `main`.
* Gates: `npm test` (479), `npm run build`, NUL-byte lint.
