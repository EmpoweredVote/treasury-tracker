# 117 — Batch 4 ACFR Source Location (RECON-11, OK/RI/SD/VT/WV/WY — the last 6, all-50 completion)

**Status:** IN PROGRESS — Task 0 (D-03 triage) + Task 1 (OK re-verify + RI + SD) complete. Task 2 (VT/WV/WY) pending.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**Plan:** 117-04
**States:** Oklahoma (OK — reused v2.14 recon, re-verified), Rhode Island (RI), South Dakota (SD), Vermont (VT), West Virginia (WV), Wyoming (WY)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 112-BATCH2-SOURCES.md shape (the v2.13/v2.14 recon mold).

This is the Phase 121 (Batch 4 load, ACFR-48..53) input contract — the final Batch-4 recon
completing all 50 states. Documentation only — no DB writes, no NASBO mutations, no loader
code, no frontend changes.

**Workspace:** `_acfr-work/{ok,ri,sd,vt,wv,wy}/` (gitignored, `.gitignore` lines 108/133). `pdftotext`
confirmed available (`pdftotext version 4.00`, poppler).

---

## Section 0 — D-03 Triage (does a GAAP ACFR with a splittable GENERAL FUND column exist?)

| State | Publisher | GAAP ACFR exists? | Annual (not biennial-only)? | Splittable GF column? | Verdict |
|-------|-----------|-------------------|------------------------------|------------------------|---------|
| **OK** | Oklahoma OMES (Central Accounting & Reporting) | Yes (preserved v2.14 recon, re-verified Task 1) | Yes | Yes | **RECON — re-verified, no rot** |
| **RI** | RI Office of Accounts and Control (`controller.admin.ri.gov`) | Yes — confirmed live | Yes | Yes (4-column governmental funds statement) | **RECON** |
| **SD** | SD Bureau of Finance and Management (`bfm.sd.gov/ACFR`) | Yes — confirmed live, full archive to FY1998 | Yes | Yes (multi-column governmental funds statement) | **RECON** |
| **VT** | VT Dept. of Finance & Management (`finance.vermont.gov`) | Yes — confirmed live | Yes | Yes (multi-column governmental funds statement) | **RECON** |
| **WV** | WV Dept. of Finance (`finance.wv.gov`) | Yes — confirmed live | Yes | Yes (multi-column governmental funds statement) | **RECON** |
| **WY** | WY State Auditor's Office (`sao.wyo.gov/publications`) | Yes — confirmed live, full archive to FY1980 | **Yes (annual ACFR; the biennial cycle is the LEGISLATIVE APPROPRIATION/budget bill, NOT the audited ACFR)** — corrected assumption, see note below | Yes (multi-column governmental funds statement) | **RECON** |

**WY note (corrects the plan's anticipated risk):** Wyoming's biennial *budget/appropriation*
process does not mean it lacks an annual *audited* ACFR. `sao.wyo.gov/publications` hosts a
continuous annual CAFR/ACFR archive from FY1980 through FY2025 (52 years), each with a standard
GASB governmental-funds Statement of Revenues, Expenditures, and Changes in Fund Balances and a
distinct "General Fund" column. WY is **not** a stay-NASBO candidate — it RECONs cleanly.

**Outcome:** All 6 Batch-4 states pass D-03 triage. **Zero stay-NASBO-exception candidates in
this batch** — the Phase 123 "nodes remaining NASBO-served" list contributed by Batch 4 is
**empty**.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **OK** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total) | thousands | Jun 30 | **FY2002–FY2024** (re-verified, no rot; FY2025 still not published as of 2026-07-04) | `https://oklahoma.gov/content/dam/ok/en/omes/documents/{cafr\|ACFR\|acfr-}{YYYY}.pdf` — naming varies by era, current year (`acfr-2024.pdf`) breaks the pattern each refresh. Landing: `https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html` |
| **RI** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Intermodal Surface Transportation \| Rhode Island Capital Plan \| Other Governmental Funds \| Total) | thousands | Jun 30 | **FY2006–FY2025** (20 years, both bookends tie-confirmed; older years 1998-2016 also listed but not tie-confirmed within D-04 budget) | Opaque per-year filenames under a date-stamped Drupal path — no single derivable pattern, enumerate from the financial-reports page: FY2025=`.../2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf`, FY2024=`.../2025-03/2024%20State%20of%20Rhode%20Island%20ACFR%206.30.24%20-%20Final.pdf`, FY2023=`.../2024-02/ACFR%206-30-2023.pdf`. Landing: `https://controller.admin.ri.gov/financial-reporting-and-accounting/financial-reports` |
| **SD** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Transportation \| Social Services Federal \| COVID-19 Federal \| Dakota Cement Trust \| Education Enhancement Trust \| Nonmajor \| Total) | thousands | Jun 30 | **FY2002–FY2025** (24 years, both bookends tie-confirmed; full archive live back to FY1998) | **Cleanly derivable**: `https://bfm.sd.gov/acfr/SD_ACFR_{YYYY}.PDF` (FY2021–FY2025) / `SD_CAFR_{YYYY}.PDF` (FY1998–FY2020) — naming variant is a fixed era boundary, not a per-year lookup. Landing: `https://bfm.sd.gov/ACFR/` |
| **VT** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Transportation Fund \| Education Fund \| Special Fund \| Federal Revenue Fund \| Global Commitment Fund \| Non-major Governmental Funds \| Total) | **dollars** (not thousands) | Jun 30 | pending Task 2 | pending Task 2 |
| **WV** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Transportation \| Tobacco Settlement Finance Authority \| State Road \| Other Governmental Funds \| Total) | thousands | Jun 30 | pending Task 2 | pending Task 2 |
| **WY** | Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds | **General Fund** (1st of General Fund \| Foundation Program Fund \| Common School Land Fund \| Permanent Mineral Trust Fund \| Nonmajor Governmental Funds \| Total) | **dollars** (not thousands) | Jun 30 | pending Task 2 | pending Task 2 |

**Note (site access):** `finance.vermont.gov` returns HTTP 403 to a non-browser `curl` User-Agent
— a browser UA (`Mozilla/5.0 ... Chrome/122.0.0.0`) resolves cleanly. No such block encountered
on the OK/RI/SD/WV/WY sites.

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| **OK** | FY2024 (latest, re-verified) | **$30,604,464K** | 4-column sum = $31,259,646K; matches printed Total Revenues exactly. Diff = $0. ✅ (byte-identical to v2.14 preserved recon) |
| **OK** | FY2002 (oldest, re-verified) | **$9,568,595K** | 5-column sum = $9,609,878K; matches printed Total Revenues exactly. Diff = $0. ✅ (byte-identical to v2.14 preserved recon) |
| **RI** | FY2025 (latest) | **$10,095,792K** | 5-column sum (General + Intermodal Surface Transportation + RI Capital Plan + Other Governmental Funds) = $11,394,132K; matches printed Total revenues exactly. Diff = $0. ✅ |
| **RI** | FY2006 (oldest sampled) | **$4,585,920K** | 5-column sum = $5,218,477K; matches printed Total revenues exactly. Diff = $0. ✅ |
| **SD** | FY2025 (latest) | **$2,423,413K** | 7-column sum (General Fund + Transportation + Social Services Federal + COVID-19 Federal + Dakota Cement Trust + Education Enhancement Trust + Nonmajor) = $6,937,344K; matches printed Total Revenue exactly. Diff = $0. ✅ |
| **SD** | FY2002 (oldest sampled) | **$697,589K** | 5-column sum = $2,191,006K; matches printed Total Revenue exactly. Diff = $0. ✅ |

_(VT/WV/WY bookend ties added in Task 2.)_

---

## Section 3 — Four risk facts per D-08

| Fact | OK | RI | SD |
|------|----|----|-----|
| **Units** | thousands | thousands | thousands |
| **Negative GF line items** | None observed in FY2024 or FY2002 GF column. Interest and Investment Revenue = +$459,743K (FY2024), +$96,796K (FY2002). Low risk (Commissioners of the Land Office nonmajor column had a negative Interest line in FY2002, but that's not the GF column). | None observed in FY2025 or FY2006 GF column. Income from investments = +$47,546K (FY2025), +$2,000K (FY2006). Low risk. | None observed in FY2025 or FY2002 GF column. Use of Money and Property = +$127,799K (FY2025), +$23,060K (FY2002). Low risk. |
| **Exact column header + statement** | "General", *Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities, NOT budgetary) | "General", *Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds* (NOT Statement of Activities) | "General Fund", *STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES — GOVERNMENTAL FUNDS* (NOT Statement of Activities, NOT budgetary) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ |

_(VT/WV/WY four-risk-facts columns added in Task 2.)_

---

## Section 4 — Scope vs NASBO (D-09)

Note: NASBO GF operating figures (`scripts/loadStateGF.mjs`) are **expenditure** totals
(spending-by-function). ACFR figures are **revenue** totals. The comparison flags whether the
ACFR GF's revenue base is materially broader/narrower than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------|---------------------------|-------|--------|----------------|
| **OK** | $30,604,464K (FY2024) | $9,139,000,000 | **~3.35×** | Unchanged from v2.14 preserved recon — OK's GAAP General Fund consolidates nearly all state general-purpose taxes AND the full Federal Revenue line ($13.78B) into a single fund, whereas NASBO's narrower budgetary concept excludes most earmarked/dedicated-revolving-fund and federal-passthrough activity. | **Accept-and-relabel honestly** (TX/MI precedent). Confirm at Phase-121 load. |
| **RI** | $10,095,792K (FY2025) | $5,236,000,000 | **~1.93×** | RI's GAAP General Fund consolidates a large Federal grants line ($4.55B of $10.1B GF total, ~45%) that NASBO's narrower budgetary concept excludes. Similar mechanism to MD/GA (~1.8-2.0×). | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-121 load. |
| **SD** | $2,423,413K (FY2025) | $2,362,000,000 | **~1.03×** | Near-parity — the smallest divergence recorded across the whole v2.15 milestone so far. SD's "Administering Programs" federal-passthrough revenue ($748.5M) is booked to the Transportation/Federal columns, not the GF column, keeping the GF column close to NASBO's budgetary concept. | **Accept-and-relabel honestly** (TX precedent), but the divergence is minimal — confirm at Phase-121 load. |

_(VT/WV/WY scope-vs-NASBO rows added in Task 2.)_

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| **OK** | FY2024 (final audited; FY2025 not yet published as of 2026-07-04, re-checked — unchanged from v2.14) | ✅ (`ACFR2023.pdf` confirmed live in v2.14; landing page still lists it) | ✅ (`acfr-2024.pdf` re-verified live today, `application/pdf`, byte-identical GF total to v2.14) | **GREENLIGHT** — recency floor satisfied, no regression since v2.14. |
| **RI** | FY2025 (final audited, ACFR published 2026-06) | ✅ (`ACFR 6-30-2023.pdf` listed on financial-reports page) | ✅ (`2024 State of Rhode Island ACFR 6.30.24 - Final.pdf` listed) | **GREENLIGHT** — recency floor satisfied. |
| **SD** | FY2025 (final audited) | ✅ (`SD_ACFR_2023.PDF` listed) | ✅ (`SD_ACFR_2024.PDF` listed) | **GREENLIGHT** — recency floor satisfied. |

_(VT/WV/WY recency-floor rows added in Task 2.)_

---

## Section 6 — Consolidated gap log

| State | FY / Period | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **OK** | FY2025 | Not yet published by OMES as of 2026-07-04 (re-checked, unchanged from the v2.14 recon date of 2026-07-02 — landing page's newest entry is still FY2024). | Not a gap — does not block the recency floor (FY2023+FY2024 already satisfied). Re-check at Phase-121 load in case FY2025 has since posted. |
| **RI** | Pre-FY2006 | Files exist under `/sites/g/files/xkgbur621/files/2025-01/{YYYY}.pdf` for 2006-2016 and CAFR filenames for 2017-2020, all discoverable on the financial-reports page, but not individually tie-confirmed within the D-04 budget (bookend = oldest+latest only per D-05). | Not tie-confirmed here, logged for Phase-121 load-time verification. FY2006–FY2025 (20-year window) already exceeds most other Batch states' depth. |
| **RI** | Naming variants | No single derivable URL pattern — every year (and even every "CAFR" vs "ACFR" naming era) requires its own explicit URL from the financial-reports page, and files live under a date-stamped Drupal directory. | SOURCES map must enumerate all years explicitly (NC/GA precedent), not a derivable pattern. Re-verify each URL still resolves at Phase-121 load (Drupal directories are stable once published). |
| **SD** | Pre-FY2002 | `SD_CAFR_{YYYY}.PDF` exists back to 1998 on the same landing page, but not tie-confirmed within the D-04 budget. | Not tie-confirmed here, logged for Phase-121 load-time consideration if a deeper window is desired. FY2002–FY2025 (24-year window) already matches the deepest Batch-2/3 states. |

_(VT/WV/WY gap-log rows added in Task 2.)_

---

## Section 7 — Loader template mapping + Phase-121 load notes

| State | Closest loader template | GF layout notes | Phase-121 load notes |
|-------|------------------------|----------------|----------------------|
| **OK** | `extract_gf.py` + `gen_state.py` (v2.14 generic tooling) | GF is 1st column of 4 (General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total). Units = thousands, standard `UNITS = 1_000` scaling. | Straightforward reuse of the v2.14-preserved SOURCES map; no fy_end override needed (June 30). Current-year filename (`acfr-2024.pdf`) breaks the derivable pattern each refresh — special-case at load. |
| **RI** | `extract_gf.py` + `gen_state.py`, explicit per-year SOURCES map (NC/GA precedent — opaque filenames) | GF is 1st column of 4 (General \| Intermodal Surface Transportation \| Rhode Island Capital Plan \| Other Governmental Funds \| Total). Units = thousands. | Must enumerate all years' explicit URLs from the financial-reports page (no derivable pattern). Naming/casing/spacing varies by year ("ACFR 6-30-2022 .pdf" has a trailing space before ".pdf" — verify literal filename at load). |
| **SD** | `extract_gf.py` + `gen_state.py` — **cleanest derivable pattern in Batch 4** | GF is 1st column of 7 (General Fund \| Transportation \| Social Services Federal \| COVID-19 Federal \| Dakota Cement Trust \| Education Enhancement Trust \| Nonmajor \| Total). Units = thousands. | Simple `SD_ACFR_{YYYY}.PDF` (2021+) / `SD_CAFR_{YYYY}.PDF` (pre-2021) pattern — closest to a "one config line" load of any Batch-4 state. |
| **VT** | pending Task 2 | pending Task 2 | pending Task 2 |
| **WV** | pending Task 2 | pending Task 2 | pending Task 2 |
| **WY** | pending Task 2 | pending Task 2 | pending Task 2 |

---

## Oklahoma (OK) — Detail Block (v2.14-preserved recon, re-verified 2026-07-04)

**Source:** State of Oklahoma Office of Management and Enterprise Services (OMES), Central
Accounting and Reporting division
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing/archive page:** `https://oklahoma.gov/omes/divisions/central-accounting-reporting/financial-reporting/acfr-archives.html`

**Re-verification method (T-117-04 mitigation):** re-fetched the FY2024 and FY2002 PDFs live
today (2026-07-04) rather than trusting the v2.14 doc blind; confirmed `Content-Type:
application/pdf` on both, re-ran `pdftotext -table`, and re-derived both bookend ties from the
raw text — **every figure is byte-identical to the v2.14-preserved recon.** No rot found.

**URL pattern (live, confirmed `application/pdf`; mostly-derivable):**
- FY2024 (current, breaks the pattern): `https://oklahoma.gov/content/dam/ok/en/omes/documents/acfr-2024.pdf`
- FY2023: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2023.pdf`
- FY2022: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2022.pdf`
- FY2021: `https://oklahoma.gov/content/dam/ok/en/omes/documents/ACFR2021.pdf`
- FY2000–FY2020: `https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr{YYYY}.pdf` (e.g. FY2002 bookend = `cafr2002.pdf`)
- FY2025: **re-checked 2026-07-04 — still not published** (landing page's newest entry remains FY2024, matching the v2.14 recon date; this does not block the recency floor)

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 4: General | Commissioners of the Land Office | Wildlife Lifetime Licenses | Tobacco Settlement Endowment | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms (re-derived from freshly-fetched PDFs, 2026-07-04):**
- FY2024: GF Total Revenues = $30,604,464K — 4-column sum = $31,259,646K matches printed Total Revenues exactly ✅ (diff $0)
- FY2002: GF Total Revenues = $9,568,595K — 5-column sum (FY2002 also had a small Nonmajor Capital Projects column) = $9,609,878K matches printed Total Revenues exactly ✅ (diff $0)

**Investment income:** GF column "Interest and Investment Revenue" FY2024 = +$459,743K (positive); FY2002 = +$96,796K (positive). No P2 clamp needed for the GF column, re-confirmed.

**Scope vs NASBO (~3.35×, unchanged):** OK ACFR GF revenue ($30.60B, FY2024) vs NASBO GF operating ($9.14B, FY2024) — the largest divergence of the 6 Batch-4 states. OK's GAAP General Fund consolidates nearly all state general-purpose taxes and the full Federal Revenue line ($13.78B) into a single fund. **Accept-and-relabel honestly, document prominently** (unchanged recommendation).

**Clean window:** FY2002–FY2024 (22 years, both bookends re-tie-confirmed to $0 diff, 2026-07-04).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 re-confirmed live-durable, no regression since v2.14; FY2025 still not published, which does not block the floor).

---

## Rhode Island (RI) — Detail Block

**Source:** State of Rhode Island Office of Accounts and Control (Dept. of Administration)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://controller.admin.ri.gov/financial-reporting-and-accounting/financial-reports`

**URL pattern (opaque per-year filenames under a date-stamped Drupal directory; no single
derivable pattern — must enumerate from the landing page each refresh):**
- FY2025: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf`
- FY2024: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-03/2024%20State%20of%20Rhode%20Island%20ACFR%206.30.24%20-%20Final.pdf`
- FY2023: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2024-02/ACFR%206-30-2023.pdf`
- FY2022: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2023-01/ACFR%206-30-2022%20.pdf` *(note the literal trailing `%20` before `.pdf` in the filename — verify exact string at load)*
- FY2021: `https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2022-04/ACFR%206-30-2021.pdf`
- FY2020–FY2017 (CAFR naming): `.../2022-04/CAFR%2006-30-{YYYY}.pdf`
- FY2006–FY2016: `.../2025-01/{YYYY}.pdf` (bare year filenames)

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General (1st of 4: General | Intermodal Surface Transportation | Rhode Island Capital Plan | Other Governmental Funds | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total revenues = $10,095,792K — 4-column sum (General + Intermodal Surface Transportation + RI Capital Plan + Other Governmental Funds) = $11,394,132K matches printed Total revenues exactly ✅ (diff $0)
- FY2006: GF Total revenues = $4,585,920K — 4-column sum = $5,218,477K matches printed Total revenues exactly ✅ (diff $0)

**Investment income:** GF column "Income (loss) from investments" FY2025 = +$47,546K (positive); FY2006 "Income from investments" = +$2,000K (positive). No P2 clamp needed for either confirmed bookend year — note the column header itself includes "(loss)" possibility, so check intervening years at load.

**Scope vs NASBO (~1.93×):** RI ACFR GF revenue ($10.10B, FY2025) vs NASBO GF operating ($5.24B, FY2024). Driver: Federal grants booked to the GF column ($4.55B of $10.1B, ~45%) — a similar mechanism to MD/GA/MA in prior batches. **Accept-and-relabel honestly** (TX precedent).

**Clean window:** FY2006–FY2025 (20 years, both bookends tie-confirmed to $0 diff; older years FY1998–2016 discoverable but not individually verified within the D-04 budget).
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed present on the financial-reports page).

---

## South Dakota (SD) — Detail Block

**Source:** State of South Dakota Bureau of Finance and Management (BFM)
**PDF:** Annual Comprehensive Financial Report (ACFR) — formerly CAFR
**Landing page:** `https://bfm.sd.gov/ACFR/`

**URL pattern (live, confirmed `application/pdf`; cleanly derivable — the best of Batch 4):**
- FY2021–FY2025: `https://bfm.sd.gov/acfr/SD_ACFR_{YYYY}.PDF`
- FY1998–FY2020: `https://bfm.sd.gov/acfr/SD_CAFR_{YYYY}.PDF`
- Naming-era boundary (2021, "ACFR" vs "CAFR" terminology change) is fixed and known, not a per-year lookup.

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds
**Column:** General Fund (1st of 7: General Fund | Transportation | Social Services Federal | COVID-19 Federal | Dakota Cement Trust | Education Enhancement Trust | Nonmajor | Total)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenue = $2,423,413K — 7-column sum = $6,937,344K matches printed Total Revenue exactly ✅ (diff $0)
- FY2002: GF Total Revenue = $697,589K — 5-column sum (FY2002 had 5 columns: General Fund | Transportation | Social Services Federal | Dakota Cement Trust | Nonmajor) = $2,191,006K matches printed Total Revenue exactly ✅ (diff $0)

**Investment income:** GF column "Use of Money and Property" FY2025 = +$127,799K (positive); FY2002 = +$23,060K (positive). No P2 clamp needed for either confirmed bookend year.

**Scope vs NASBO (~1.03×, near-parity):** SD ACFR GF revenue ($2.42B, FY2025) vs NASBO GF operating ($2.36B, FY2024) — the smallest divergence recorded in the entire v2.15 milestone to date (closer than OR's ~1.07× or VT's projected near-parity). SD's federal-passthrough revenue ("Administering Programs", $748.5M) routes through the Transportation/Social Services Federal/COVID-19 Federal columns, not the GF column, keeping GF close to NASBO's budgetary concept. **Accept-and-relabel honestly** (TX precedent), though the divergence is minimal.

**Clean window:** FY2002–FY2025 (24 years, both bookends tie-confirmed to $0 diff; full archive live back to FY1998).
**Recency floor:** GREENLIGHT (FY2023 `SD_ACFR_2023.PDF` + FY2024 `SD_ACFR_2024.PDF` both confirmed present on the landing page).

---

*(Vermont, West Virginia, and Wyoming Detail Blocks — plus their Section 1/2/3/4/5/6/7 rows — are appended in Task 2.)*
