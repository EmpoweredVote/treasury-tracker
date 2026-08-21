# LA-02 — CLOSEOUT: LA City's severed history is repaired

**Executed 2026-08-20.** Branch `feat/la-02`. Predecessor: `LA-02-SCOPING.md`,
`LA-01-SOCRATA-RECON-HANDOFF.md` (§10 + §11).
**Writes were made to PRODUCTION** (`kxsdzaojfaibhuzmclfq`), backed up first (§5).

---

## 1. Result

| | Before | After |
|---|---|---|
| Money Out (`operating`) | FY2003–2020 SCO `all_funds/actual` + FY2021–2025 FMS ledger `unknown` + FY2026 adopted `unknown` | **FY2003–2024 `all_funds/actual`, one source, 22 consecutive years** |
| Money In (`revenue`) | FY2003–2020 SCO `all_funds/actual` + FY2021–2024 mislabelled `unknown` + FY2025 ACFR `unknown` | **FY2003–2024 `all_funds/actual`, one source, 22 consecutive years** |
| Money-in/out rows with NULL `source_url` | 11 | **0** |
| LA scope seams reported by `verify-scope-seams.mjs` | 2 (FY2020→21, FY2024→26) | **0 — LA no longer appears in the report** |
| `unknown` money-in/out rows | 11 | **0** |

Every row is `all_funds / actual / unknown` from `CA State Controller - Expenditures`
/ `- Revenues` — byte-identical provenance to FY2003–2020, which is *why* the series
is continuous rather than merely adjacent.

## 2. What was loaded, and the verification

`scripts/bulkLoadStateController.js --city "Los Angeles" --fy <y> --source-date 2026-08-20`,
run once per year (the SCO API times out intermittently). Every total was checked
against `LA-02-SCOPING.md` §2, which was measured independently from the API before
any write:

| FY | operating (loaded) | revenue (loaded) |
|---|---|---|
| 2021 | 17,310,021,336 ✓ | 17,563,869,909 ✓ |
| 2022 | 18,439,009,336 ✓ | 19,280,740,014 ✓ |
| 2023 | 19,535,449,964 ✓ | 21,141,407,923 ✓ |
| 2024 | 21,517,484,103 ✓ | 21,612,492,478 ✓ |

**The mislabel proved itself during the load.** The loader fetched revenue from SCO
and produced a figure *dollar-identical* to what was already stored under the
`Socrata` label, in all four years — for a moment both rows coexisted carrying the
same total from different labels. That is independent re-derivation, not inference.

Continuity, with no seam: Money Out 16.99B (FY20) → 17.31 → 18.44 → 19.54 → **21.52B**;
Money In 17.08B (FY20) → 17.56 → 19.28 → 21.14 → **21.61B**.

## 3. Withdrawals

**FY2025 (Chris's call).** SCO's max is FY2024, so FY2025 cannot be made continuous.
It was the worst year in the table — `operating` from the FMS ledger ($25.06B) paired
with `revenue` from the ACFR ($23.46B): two unrelated documents presented as one
year's in-vs-out. Both rows withdrawn. ⚠ Its revenue row also carried
`fiscal_year_start_month = 1`, wrong for LA (7 everywhere else) — a defect that would
have survived a label-only fix.

**FY2026 (Chris's call).** Withdrawn rather than classified, because it is **the same
FMS appropriation ledger** as the FY2021–25 rows removed above — `hierarchy =
["department_name","fund_name","account_name"]`, top categories `NON-DEPARTMENTAL -
APPROPRIATIONS TO SPECIAL PURPOSE FUND` / `POLICE` / `PENSION`, cents in the total.
Classifying it would have asserted a scope it does not have. It contains **$4.77B of
Tax Revenue Anticipation Note activity counted alongside itself** — proceeds
$1,602,848,467 (borrowing, i.e. money *in*), debt $1,583,220,112, note $1,383,220,112,
payments $200,000,000 — **16.5% of the $28.92B "expenditure" total**. Keeping it while
deleting five other years of the same ledger would have been incoherent.

## 4. The §4.4 audit — the mislabel was LA-only

`scripts/la02AuditMislabel.mjs`. Two passes:

* **Generic portal/ingestion labels, every state: 0 remain.** LA's were the only ones.
* **Every CA city money-in/out row with a non-SCO label inside SCO's coverage
  (FY2003–2024): 56 rows across 7 cities** (Fremont, Fresno, Oakland, Riverside,
  Sacramento, San Jose, Santa Ana) compared to the SCO API total for that entity+year.
  **Zero dollar-exact matches. Zero even within 0.5%.** All 56 sit 4%–72% away — the
  expected General-Fund-adopted-budget vs citywide-all-funds-actuals seam.

So the defect does not generalise. ⚠ Scope of that assurance: SCO is CA-only, so this
audit cannot speak to other states, and it compares **totals** — a mislabel whose
figure also differs would not be caught. The empty 0.5% bucket means nothing borderline
exists in CA.

## 5. Backups (writes were destructive; nothing is irrecoverable)

`scripts/la02BackupRows.mjs` exported full trees BEFORE any write:

* `_acfr-work/la-city/backup/la-rows-before-la02.json` — 10 rows, 5,554 categories,
  10,627 line items (FY2021–2025 operating+revenue).
* `_acfr-work/la-city/backup/la-rows-fy2026-before-withdrawal.json` — 1 row,
  4,340 categories, 3,670 line items.

Delete counts matched the backups exactly (10,627 / 5,554 / 10 and 3,670 / 4,340 / 1).
⚠ `_acfr-work/` is gitignored, so these live only on this machine.

## 6. Gates

* `ca-sco-city-exp` / `ca-sco-city-rev` bumped **10448 → 10452** in BOTH
  `classifyFundScope.mjs` and `stampBudgetAxes.mjs` (the two have drifted apart before).
  Live table verified at 10452/10452 — exactly +4/+4, nothing else moved.
* `classifyFundScope.mjs --dry-run` — partition gate ✅, 80,012/80,012.
* `stampBudgetAxes.mjs --dry-run` — partition gate ✅ on both axes.
* `verify-scope-seams.mjs` — 21 seams (was 22), the 4 SCOPE-02 seams still closed, **LA
  absent**.
* `npm test` 479/479, `npm run build` clean, NUL-byte lint 13/13.

## 7. Still open

1. **FY2025+ returns only when SCO publishes it** (currently max FY2024). At that point
   the fix is one loader run per year — no new decision. **Watched automatically in the
   cloud:** `.github/workflows/sco-fiscal-year-watch.yml` runs
   `scripts/checkScoNewFiscalYear.mjs` monthly (1st, 16:07 UTC) on a GitHub runner, plus
   `workflow_dispatch` with a `baseline` input for manual runs. On a hit it **opens an
   issue**, or comments on the existing open one so monthly re-checks do not pile up
   duplicates. Exit codes: 0 nothing new / 10 newer year available / **2 INCONCLUSIVE,
   which FAILS the job on purpose** — a check that cannot reach its source must not read
   as a clean pass, and a red scheduled run emails the cron owner.
   ⚠ **Bump the workflow's `baseline` after a load**, or it re-reports the same year forever.
   ✅ Verified end-to-end 2026-08-21 by dispatching all three paths: nothing-new (success),
   a hit via `baseline=2023` (opened issue #44 carrying the correct FY2024 figures), and
   the dedupe branch (a second run commented on #44 rather than opening #45). Issue #44
   was a test fixture and is closed.
   ⚠ **A Claude cloud routine CANNOT do this job**, and one should not be created for it:
   that sandbox's egress proxy blocks `bythenumbers.sco.ca.gov` (`EGRESS_BLOCKED` on both
   `curl` and `WebFetch`) and **the allowlist cannot be extended** — `/root/.ccr/` holds
   only certs, its sole endpoint `__agentproxy/status` is read-only, and the 403 comes
   back at CONNECT from the *upstream* proxy outside the sandbox. Two disabled routines
   remain in the account as a record; delete them at claude.ai/code/routines if unwanted.
   ⚠ A local Windows scheduled task was built first and then **deliberately removed** —
   two detectors would mean two baselines to bump, the same drift trap as the row-count
   gates in §6. The machine-local wrapper `_acfr-work/la-city/sco-fy-watch.cmd` is left
   on disk in case a laptop-side fallback is ever wanted.
2. **`salaries` (18 rows) and `transactions` (2 rows) remain `unknown` with NULL
   `source_url`.** Different dataset types, systemic across all years and not specific
   to LA; deliberately untouched here.
3. **The FMS departmental ledger is now absent from the product.** It was the only LA
   source with department/program detail and has real value as a *departmental* view —
   but it is not Money Out. Backups in §5 if it is ever wanted back under an honest label.
4. ⚠ **Copy bug, pre-existing and now more visible:** the narrative reads
   "Los Angeles's **budgeted** $21.5 billion" directly above an **Actuals** chip.
   The template says "budgeted" for every entity regardless of basis, so this is
   wrong on every actuals node, not just LA. Not fixed here (it is a template-wide
   copy change, not an LA data issue).
5. **`reporting_entity` is `unknown`** on all 44 rows — same as FY2003–2020, so no
   regression, but the axis is still unevidenced for SCO.

## 8. End-to-end verification (not just the DB)

**Production API** (`ev-accounts-api.onrender.com/api/treasury/cities`): LA's
`available_datasets` serves `operating` + `revenue` as `all_funds` / `actual` for
**every year FY2003–FY2024**, with no `unknown` money-in/out entry and no FY2025/FY2026
operating or revenue at all.

**UI** (dev server against the production API, `?entity=los-angeles-ca`, screenshot
captured). The LA page now renders:

* series label **"All Funds · actuals · FY2003–24"** with *"One published set of
  figures, shown here with what it covers"* — i.e. the SINGLE-series state. The
  toggle is gone because there is nothing left to toggle between. This is the
  product-visible fix: before, a reader saw FY2003–2020 *or* FY2021–2026, never a
  continuous LA.
* **Money Out $21.5B / Money In $21.6B**, matching SCO FY2024 to the figures loaded
  in §2 (21,517,484,103 / 21,612,492,478).
* *"Data sourced from CA State Controller - Expenditures and CA State Controller -
  Revenues"* — correct provenance, now actually shown (the source chip only began
  rendering for cities in PR #38).
* both scope/basis chips read **All Funds / Actuals** rather than unknown.
* default year is now **FY2024** — previously FY2026, which was the adopted-budget row.
