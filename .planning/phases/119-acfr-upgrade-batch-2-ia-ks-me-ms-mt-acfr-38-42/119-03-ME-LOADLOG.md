# 119-03 — Maine (ME) ACFR Load Log (ACFR-40)

**State node:** `53f26018-1d20-4f6a-9c0e-400bfb91199a`
**Loaders:** `scripts/processMEAcfr.js` (operating) + `scripts/processMERevenueAcfr.js` (revenue)
**Source:** Maine Office of the State Controller (OSC) Annual Comprehensive Financial Report (ACFR),
Governmental Funds Statement of Revenues, Expenditures and Changes in Fund Balances, **General**
column (1st of 6: General | Highway | Federal | Other Special Revenue | Other Governmental Funds |
Total Governmental). Units = thousands.

---

## Task 1 — Download, extract, generate, dry-run tie

- Downloaded FY2000–FY2025 (26 candidate years) from the derivable URL pattern
  `https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr{YYYY}.pdf`, with the
  **FY2020 exception** fetched from `acfr2020v2_0.pdf` (confirmed in `gen_state.py CONFIGS['ME']`
  SOURCES map). All 26 downloads returned HTTP 200 with `%PDF` magic bytes and sizes 1.08MB–7.35MB
  (well above the soft-404 threshold) — no soft-404s encountered.
- **June-30 FY-end confirmed on every single cover page** (not just the two recon bookends): each of
  the 26 PDFs' first 3 pages contain `FOR THE FISCAL YEAR ENDED JUNE 30, {YYYY}` (or the equivalent
  title-case form) matching its own claimed FY exactly. The pre-recon "non-June to watch" flag is
  fully resolved — no year needed a shift.
- Ran `pdftotext -table` + `extract_gf.py` on all 26 years. **FY2000 and FY2001 returned
  "statement not found"** — inspection confirmed these two years' Governmental Funds statement is
  titled "COMBINED STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCES" (the
  pre-GASB-34 combined-fund-type layout), not the modern "Statement of Revenues, Expenditures and
  Changes in Fund Balances — Governmental Funds" with a distinct General column that
  `extract_gf.py`'s `find_statement()` anchors on. This is the same SC/AL FY2002 pre-GASB-34
  boundary precedent seen elsewhere in the cohort. **OMITTED as an honest hole** — the recon itself
  only bookend-tied FY2002 and FY2025 directly, never FY2000/FY2001, so this does not contradict
  the recon's evidence, only its aspirational "26yr" framing.
- **All 24 remaining years (FY2002–FY2025) tied exactly ($0 diff) on BOTH the revenue and
  expenditure General column totals on the first extraction pass** — zero honest holes within the
  confirmed-tying window, zero rev_boundary sub-heading complications (ME's revenue lines carry no
  sub-heading, `sub=None` throughout every year).
- One real GAAP quirk (not an extraction defect): "Capital Outlay" prints under the "Debt service:"
  subsection heading on the expenditure side in every year that shows it — confirmed directly in the
  source PDF. `default_exp_name()`'s Debt-service disambiguation only renames Principal/Interest
  lines, so "Capital Outlay" passes through unchanged with no name collision.
- Assembled `_acfr-work/me/me_all.json` (gitignored) — 24 years, `revenues`/`expenditures` keys per
  year with `total` + filtered non-null `items`.
- Added `CONFIGS['ME']` to `_acfr-work/gen_state.py` (UNITS=1000, derivable SOURCES with the FY2020
  exception, head_note covering the scope note / URL pattern / June-30 confirmation / FY2000-2001
  honest hole / 6-column layout / Capital-Outlay-under-Debt-service quirk, neg_note covering the
  one FY2011 negative line).
- Ran `py -3 gen_state.py ME` → generated `scripts/processMEAcfr.js` + `scripts/processMERevenueAcfr.js`.
- **Dry-run confirmed:** both loaders print "validation: PASS" for all 24 in-window years, zero
  "sum ≠ total" errors. Bookends confirmed exactly: `processMERevenueAcfr.js --dry-run --fy 2025` →
  `6,194,288,000`; `--fy 2002` → `2,302,006,000`.
- **Negative-line scan (all 24 years, both revenue and expenditure):** only FY2011 revenue
  "Investment Income (Loss)" = −54 (thousands, immaterial) went negative. Every other year/line is
  positive. P2 clamp is the render path for FY2011; no year shows a negative GF Total.

## Task 2 — Live load

- Pre-load NASBO baseline confirmed via DB probe: ME had exactly 2 `budgets` rows (FY2023
  $4,304,000,000 / FY2024 $4,980,000,000, both `dataset_type='operating'`, NASBO text-stamped,
  `data_source_id=null`), 0 revenue rows, 0 `data_sources` rows — matches the plan's stated
  never-overwrite baseline exactly.
- Live-loaded `processMEAcfr.js --fy {YYYY}` then `processMERevenueAcfr.js --fy {YYYY}` for all 24
  years FY2002–FY2025 (48 total loader invocations). Every invocation printed
  `FY{YYYY} validation: PASS`, ran the `treasury_sync_budget_tree` RPC, stamped
  `source_url`/`source_date`/`data_source` (GAAP basis label), and self-cleaned its ephemeral
  `data_sources` row.
- Post-load DB verification: 48 total `budgets` rows on the ME node (24 operating + 24 revenue),
  **zero rows with a "NASBO" label remaining**, exactly one operating row per (ME, fy) for all 24
  years. FY2025 revenue = `6,194,288,000`; FY2002 revenue = `2,302,006,000` — both exact.
- **NASBO-replacement confirmed:** FY2023 operating went from NASBO $4,304,000,000 →
  ACFR GAAP $4,522,077,000 (same `(muni, fy, 'operating')` key, UPDATE-in-place, no duplicate).
  FY2024 operating went from NASBO $4,980,000,000 → ACFR GAAP $5,253,584,000.
- **Accept-relabel divergence recorded:** FY2025 ACFR GF Total revenues $6,194,288,000 vs FY2024
  NASBO GF $4,980,000,000 = **~1.244×** — matches the 117-recon's ~1.24× prediction exactly. Driver
  confirmed structural, not a load-time choice: Maine books essentially all Federal Grants &
  Reimbursements to a SEPARATE "Federal" major fund column ($5,972,037K FY2025), leaving only $27K
  of Federal inside the General column itself — the same mechanism as KS/KY in this cohort.

## Task 3 — Idempotency + 0-residue + Money-In + cohort-untouched verification

- **Idempotency re-run:** re-ran `processMEAcfr.js --fy 2025` and `processMERevenueAcfr.js --fy 2025`
  live a second time. Both printed `Loaded 0 rows for FY2025` — **0 net change**. Post-re-run DB
  probe confirmed the ME node's `data_sources` table is empty (`[]`) — **0 residue** (LOAD-01 holds).
- **Full DB verification (all 24 loaded FYs):**
  - 48 total `budgets` rows on ME (24 operating + 24 revenue), exactly one operating row per
    (ME, fy), all GAAP-basis-labelled ("Maine State ACFR — General Fund (FY{fy} actual, GAAP
    basis)" / "... General Fund Revenue (FY{fy} actual, GAAP basis)"), all with non-null
    `source_url`/`source_date`.
  - **Zero "NASBO" labels remain** on the ME node.
  - Honest-hole FYs (2000, 2001) are absent from the DB — confirmed no phantom rows exist for
    either year.
  - **Money In auto-enabled:** ME now has 24 `dataset_type='revenue'` rows (was 0 pre-load) — the
    "Money In" view and `?dataset=revenue` deep-link auto-enable with zero frontend work.
- **Cohort-untouched spot-check:**
  - AK (`b268c415…`, from Phase 118) — 40 `budgets` rows, unchanged.
  - KS (`bb3dcf05…`, from 119-02) — 14 `budgets` rows, unchanged.
  - Nebraska (`ccfb8751…`, an un-upgraded roster state) — still exactly 2 NASBO-labelled
    `operating` rows (FY2023 $5,154,000,000 / FY2024 $5,314,000,000), untouched.

---

## Load Disposition

| Item | Result |
|------|--------|
| FYs loaded | FY2002–FY2025 (24 years), operating + revenue, 48 total rows |
| FYs skipped (honest holes) | FY2000, FY2001 — pre-GASB-34 COMBINED statement format, no distinct General column in the modern-statement sense; `extract_gf.py` correctly reported "statement not found" rather than mis-transcribing a different statement shape |
| FY2020 exception | Fetched via `acfr2020v2_0.pdf` (not the derived `acfr2020.pdf`) — confirmed present and tied exactly (rev $3,847,642,000 / exp $3,871,148,000, both $0 diff) |
| June-30 FY-end | Confirmed on all 26 downloaded covers (including the 2 honest-hole years) — the pre-recon "non-June to watch" flag is fully resolved; no shift applied to any year |
| Bookend ties | FY2025 rev $6,194,288,000 / exp $5,681,088,000; FY2002 rev $2,302,006,000 / exp $2,604,696,000 — all exact $0 diff |
| Pre-load NASBO baseline | FY2023 $4,304,000,000 / FY2024 $4,980,000,000, `data_source_id=null`, 0 revenue rows, 0 `data_sources` rows |
| Loaded ACFR totals (same FYs) | FY2023 operating $4,522,077,000; FY2024 operating $5,253,584,000 |
| Accept-relabel note | ~1.244× (FY2025 ACFR $6.19B vs FY2024 NASBO $4.98B) — matches recon's ~1.24× prediction; driver = Federal Grants booked to ME's separate "Federal" major fund column, not the General column |
| NASBO-replacement confirmation | Both FY2023/FY2024 operating rows replaced in place at the same `(muni, fy, 'operating')` key — zero NASBO labels remain, exactly one operating row per (ME, fy) |
| Idempotency re-run result | `processMEAcfr.js --fy 2025` + `processMERevenueAcfr.js --fy 2025` re-run live → `Loaded 0 rows` both times, 0 net change |
| data_sources residue | 0 (empty table for the ME node, both before Task 2 cleanup completion and after the Task 3 idempotency re-run) |
| Money In | Auto-enabled — 24 `dataset_type='revenue'` rows now present (was 0) |
| Cohort untouched | AK (40 rows), KS (14 rows) unchanged; Nebraska (un-upgraded, 2 NASBO rows) unchanged |
