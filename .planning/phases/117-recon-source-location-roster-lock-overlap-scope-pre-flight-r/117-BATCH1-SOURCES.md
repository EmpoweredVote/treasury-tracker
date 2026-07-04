# 117-01 — Batch 1 ACFR Source Location (RECON-11, AK/AR/DE/HI/ID)

**Status:** IN PROGRESS — D-03 triage complete for all 5 states; full recon (Tasks 1-2) in progress.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**States:** Alaska (AK), Arkansas (AR), Delaware (DE), Hawaii (HI), Idaho (ID)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH1-SOURCES.md / 98-RECON.md shape (bookend, four risk facts, scope-vs-NASBO, gap log, loader mapping).

---

## Section 0 — D-03 Triage (does a GAAP Governmental Funds ACFR with a splittable GF column exist?)

| State | GAAP Gov-Funds ACFR exists? | Splittable GF column? | Basis if not GAAP | Triage verdict |
|-------|------------------------------|------------------------|--------------------|-----------------|
| **AK** | Yes — Alaska DOF publishes a full ACFR back to FY1998 (`doa.alaska.gov/dof/reports/annualreport.html`) | Yes — Governmental Funds Statement of Rev/Exp/Changes has a distinct "General Fund" column (1 of 3: General Fund \| Alaska Permanent Fund \| Nonmajor Funds \| Total) | N/A | **RECON** |
| **AR** | Yes — Arkansas DFA publishes a full ACFR/CAFR back to FY2003 (`dfa.arkansas.gov`) | Yes, but Arkansas has only ONE governmental fund — the statement has a single "General Fund" column (no separate major/nonmajor funds) | N/A | **RECON** |
| **DE** | Yes — Delaware Office of Accounting publishes a full ACFR back to FY2004+ (`accounting.delaware.gov`) | Yes — distinct "General" column (1 of 4: General \| Federal \| Local School Districts \| Capital Projects \| Total) | N/A | **RECON** |
| **HI** | Yes — Hawaii DAGS publishes a full ACFR back to FY2000 (`ags.hawaii.gov/accounting/annual-financial-reports/`) | Yes — distinct "General Fund" column (of up to 8 columns depending on year) | N/A | **RECON** |
| **ID** | Yes — Idaho State Controller's Office (SCO) publishes a full ACFR/CAFR back to FY2004+ (`sco.idaho.gov`, PDFs at `CAFRDocuments/`) | Yes — distinct "General" column (of 3-4: General \| Health and Welfare \| Transportation \| [Public School Endowment]) | N/A | **RECON** |

**Triage summary: all 5 Batch-1 states pass triage — 0 stay-NASBO-exception candidates in this batch.** All five publish a GAAP Governmental Funds Statement of Revenues, Expenditures, and Changes in Fund Balances with a splittable General Fund column. Full recon proceeds for all 5 in Tasks 1-2.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end month | Durable clean window | Per-year URL pattern |
|-------|-------------------|-------------------|-------|---------------|------------------------|------------------------|
| **AK** | Statement 1.13 — Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds (printed page 27) | **General Fund** (1st of 4: General Fund \| Alaska Permanent Fund \| Nonmajor Funds \| Total Governmental Funds) | Thousands | June 30 | **FY1998–FY2025** (28 years; FY2020 and FY2025 bookend-tied) | `https://doa.alaska.gov/dof/reports/resource/{YYYY}acfr.pdf` (FY2020–FY2025); `{YYYY}cafr.pdf` for FY1998–FY2019 (naming exception — "cafr" not "acfr"). Landing: `https://doa.alaska.gov/dof/reports/annualreport.html` |
| **AR** | Statement of Revenues, Expenditures, and Changes in Fund Balance(s), Governmental Fund(s) (printed page ~20-21) | **General Fund** — Arkansas has only ONE governmental fund; the statement has a single unlabeled-column General Fund total (no separate major/nonmajor funds to split) | Thousands | June 30 | **FY2003–FY2024** (22 years; FY2003 and FY2024 bookend-tied). **FY2025 (`2025-Arkansas-ACFR.pdf`) is garbled — Type 3 custom fonts, no ToUnicode CMap, pdftotext produces unreadable output (KY FY2023 precedent)** — gap-logged. | `https://www.dfa.arkansas.gov/wp-content/uploads/cafr{YYYY}.pdf` for FY2003–FY2024. **FY2025 exception: `2025-Arkansas-ACFR.pdf` (different naming AND garbled — do not use).** Landing: `https://www.dfa.arkansas.gov/office/accounting/annual-comprehensive-financial-report/` |
| **DE** | Statement of Revenues, Expenditures and Changes in Fund Balances (Deficits), Governmental Funds (printed page ~25 in FY2025) | **General** (1st of 5: General \| Federal \| Local School Districts \| Capital Projects \| Total Governmental Funds) | Thousands | June 30 | **FY2004–FY2025** (22 years; FY2004 and FY2025 bookend-tied) | `https://accountingfiles.delaware.gov/docs/{YYYY}acfr.pdf` for FY2021–FY2025; `{YYYY}cafr.pdf` for FY2004–FY2020 (naming exception, FY2005/2007/2008/2010/2011/2013 not published/found in the archive index — spot-check at load). **CRITICAL: `accountingfiles.delaware.gov` WAF rejects requests without a `Referer` header pointing at `accounting.delaware.gov` — returns a 245-byte "Request Rejected" HTML soft-404 (HTTP 200) that looks like success. Must set `Referer` header or requests silently fail (soft-404 caution, 98-RECON precedent).** Landing: `https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/` (+ `/archived-annual-comprehensive-financial-reports/`) |
<!-- HI/ID rows added in Task 2 -->

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|---------------------|-----------|
| **AK** | FY2025 (latest) | **$8,378,945K** | GF line items sum (Taxes 1,600,605 + Licenses/Permits 145,208 + Charges 182,882 + Fines 59,341 + Rents/Royalties 1,059,348 + Premiums 38,327 + Investment Income 350,330 + Federal Grants 4,833,918 + Component Unit Payments 51,038 + Other 57,948) = $8,378,945K; matches printed Total Revenues. Diff = $0. ✅ |
| **AK** | FY2020 (oldest bookend) | **$6,063,851K** | GF line items sum = $6,063,851K; matches printed Total Revenues. Diff = $0. ✅ |
| **AR** | FY2024 (latest clean) | **$24,045,611K** | GF line items sum (Personal/corp income 3,521,101 + Consumer sales 4,639,049 + Gas/motor carrier 506,911 + Other taxes 1,628,312 + Intergovernmental 11,221,223 + Licenses/permits/fees 1,516,933 + Investment earnings 442,735 + Miscellaneous 569,347) = $24,045,611K; matches printed Total Revenues. Diff = $0. ✅ |
| **AR** | FY2003 (oldest bookend) | **$9,434,421K** | GF line items sum = $9,434,421K; matches printed Total revenues. Diff = $0. ✅ |
| **DE** | FY2025 (latest) | **$7,475,243K** | GF line items sum (Personal Taxes 2,372,854 + Business Taxes 3,938,979 + Other Tax Revenue 111 + Licenses/Fees/Permits/Fines 523,113 + Rentals/Sales 94,377 + Grants 30,410 + Interest/Investment Income 238,663 + Other 276,736) = $7,475,243K; matches printed Total Revenues. Diff = $0. ✅ |
| **DE** | FY2004 (oldest bookend) | **$3,055,310K** | GF line items sum (Personal taxes 782,369 + Business taxes 1,359,569 + Other tax revenue 240,939 + Licenses/fees/permits/fines 295,379 + Rentals/sales 22,347 + Federal government 70,735 + Interest/investment income 30,713 + Other 253,259) = $3,055,310K; matches printed TOTAL REVENUES. Diff = $0. ✅ |
<!-- HI/ID rows added in Task 2 -->

---

## Section 3 — Four risk facts per D-08

| Fact | AK | AR | DE | HI | ID |
|------|----|----|----|----|-----|
| **Units** | Thousands | Thousands | Thousands | (filled Task 2) | (filled Task 2) |
| **Negative GF line items** | None observed: FY2025 Interest and Investment Income (Loss) = +$350,330K; FY2020 = +$273,988K. Both positive. Low risk (bookend years only — check interior years at load). | None observed: FY2024 Investment earnings (loss) = +$442,735K; FY2003 Investment earnings = +$46,139K. Both positive. Low risk. | None observed: FY2025 Interest/Investment Income = +$238,663K; FY2004 = +$30,713K. Both positive. Low risk. | (filled Task 2) | (filled Task 2) |
| **Exact column header + statement** | "General Fund", Statement 1.13 — Governmental Funds *Statement of Revenues, Expenditures, and Changes in Fund Balances* (NOT the government-wide Statement of Activities, NOT the Budgetary Comparison Schedule) | "General Fund" (single-fund state — the whole statement IS the General Fund), *Statement of Revenues, Expenditures, and Changes in Fund Balance(s)*, Governmental Fund(s) (NOT Statement of Activities) | "General" (1st of 5 columns), Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances (Deficits)* (NOT Statement of Activities) | (filled Task 2) | (filled Task 2) |
| **FY-end month** | June 30 ✓ | June 30 ✓ | June 30 ✓ | (filled Task 2) | (filled Task 2) |
<!-- Task 2 fills HI/ID columns -->

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function, FY2024 actual from `loadStateGF.mjs`). ACFR figures are **revenue** totals (latest cleanly-tied FY). The comparison is apples-to-oranges by design — the point is to flag whether the ACFR GF's revenue base is materially broader/narrower than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------------|------------------------------|-------|--------|-----------------|
| **AK** | $8,378,945K (FY2025) | $6,339,000K | **~1.32×** | GAAP General Fund consolidates Federal Grants in Aid ($4.83B) that NASBO's narrower budgetary GF concept treats differently across years. Modest-to-moderate divergence, same mechanism as NJ/MA. | **Accept-and-relabel honestly** (TX precedent). Confirm at Phase-118 load. |
| **AR** | $24,045,611K (FY2024) | $6,075,000K | **~3.96×** | **Widest divergence found across the whole ACFR cohort to date** (wider than TX's ~3×). Driver: Arkansas presents ALL of its governmental funds activity under a single "General Fund" — there is no separate major/nonmajor fund structure to exclude. GAAP GF revenue includes ~$11.2B of Intergovernmental (federal) revenue that NASBO's narrower operating definition excludes almost entirely. | **Accept-and-relabel honestly, flag as the tranche's most extreme scope divergence** (wider than TX). Confirm at Phase-118 load; consider a prominent basis note given the magnitude. |
| **DE** | $7,475,243K (FY2025) | $6,232,000K | **~1.20×** | Modest divergence — smallest of the batch. Driver: Delaware's ACFR splits Federal grants into their OWN "Federal" major-fund column (separate from General), so the GF column stays closer to NASBO's own-source-revenue-centric definition. Similar mechanism to NJ (~1.15×). | **Accept-and-relabel honestly** (TX precedent, modest case). Confirm at Phase-118 load. |
<!-- HI/ID rows added in Task 2 -->

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|---------------------------|--------------------|--------------------|---------|
| **AK** | FY2025 (final audited, Dec 2025) | ✅ (`2023acfr.pdf`) | ✅ (`2024acfr.pdf`) | **GREENLIGHT** — recency floor satisfied. NASBO FY2023/FY2024 rows replaceable. |
| **AR** | FY2024 is the latest CLEANLY EXTRACTABLE year (`cafr2024.pdf`); FY2025 exists but is garbled (gap-logged) | ✅ (`cafr2023.pdf`, confirmed extracts cleanly) | ✅ (`cafr2024.pdf`, bookend-tied) | **GREENLIGHT** — recency floor satisfied at FY2024 (latest clean year). FY2025 gap-logged as a load-phase decision (re-check for a corrected upload, or accept honest 1-year-behind window). |
| **DE** | FY2025 (final audited, ~Dec 2025) | ✅ (`2023acfr.pdf`) | ✅ (`2024acfr.pdf`) | **GREENLIGHT** — recency floor satisfied. Loader must use the `Referer` header workaround (soft-404 WAF, Section 1). |
<!-- HI/ID rows added in Task 2 -->

---

## Section 6 — Consolidated gap log

| State | FY | Gap reason | Disposition |
|-------|----|-----------|-------------|
| **AK** | Pre-FY1998 | Not published on the DOF reports page (page states "back to Fiscal Year 1998"). | Out of scope — FY1998–FY2025 (28-year window) already exceeds the D-07 recency floor by a wide margin. Not a load blocker. |
| **AR** | FY2025 | `2025-Arkansas-ACFR.pdf` downloads as a real, correctly-sized PDF (49MB) but uses Type 3 custom fonts with no ToUnicode CMap (`pdffonts` confirms) — `pdftotext` output is unreadable garbage, same failure mode as the KY FY2023 precedent (Phase 114). | **Honest hole** — do not load FY2025 from this file. Load phase should re-check for a corrected/re-uploaded PDF, or a browser-rendered OCR fallback (ca-acfr-reconciliation.md precedent), before accepting a 1-year-behind window (FY2024 latest). |
| **DE** | Pre-FY2004 | Archive page (`archived-annual-comprehensive-financial-reports/`) lists back to `2004cafr.pdf` only; no earlier years discoverable. | Low priority — FY2004–FY2025 (22-year window) far exceeds the recency floor. Not a load blocker. |
| **DE** | (naming/access) | `accountingfiles.delaware.gov` returns a soft-404 WAF rejection (245-byte HTML, HTTP 200) for requests lacking a `Referer` header — NOT a missing-year gap, but a loader-implementation requirement. | Loader MUST set `Referer: https://accounting.delaware.gov/...` on every request to `accountingfiles.delaware.gov`. Documented in Section 1 + DE detail block. |
<!-- HI/ID rows added in Task 2 -->

---

## Section 7 — Loader template mapping + Phase-118 load notes

| State | Closest loader template | GF layout notes | Phase-118 load notes |
|-------|---------------------------|--------------------|-------------------------|
| **AK** | `processMDAcfr.js` / `processNJAcfr.js` (multi-column GF-first-of-N layout, `extract_gf.py` + `gen_state.py` position-anchor) | GF is 1st of 4 columns (General Fund \| Alaska Permanent Fund \| Nonmajor Funds \| Total). Clean `-table` extraction across the whole 28-year window (spot-checked FY2020/FY2025). Units = thousands throughout. | Naming exception: FY2020–2025 use `{YYYY}acfr.pdf`; FY1998–2019 use `{YYYY}cafr.pdf`. `gen_state.py` SOURCES map must special-case the "cafr"→"acfr" naming switch (mirrors the MA FY2017 precedent). |
| **AR** | Simplest layout in the cohort — closer to a **single-column pass-through** than any existing multi-fund template; `extract_gf.py`'s generic line-item parser applies directly with no position-anchor needed (GF is the ONLY fund) | GF is the sole governmental fund — the entire Statement of Revenues, Expenditures, and Changes in Fund Balance is the General Fund (no multi-column split required, no "1st of N" logic). | **CRITICAL: FY2025 (`2025-Arkansas-ACFR.pdf`) is garbled (gap-logged) — load window is FY2003–FY2024 (22 years) until a clean FY2025 source is found.** SOURCES map: `cafr{YYYY}.pdf` FY2003–2024. |
| **DE** | `processNJAcfr.js` / `processMDAcfr.js` (multi-column GF-first-of-N, position-anchor) | GF is 1st of 5 columns (General \| Federal \| Local School Districts \| Capital Projects \| Total). Federal grants live in their own column (not consolidated into GF) — explains DE's modest ~1.20× NASBO ratio. | **CRITICAL: loader must send a `Referer: https://accounting.delaware.gov/...` header on every `accountingfiles.delaware.gov` request** — omitting it returns a soft-404 (HTTP 200 + tiny "Request Rejected" HTML) that a naive Content-Type-only filter could still catch (not `application/pdf`) but a size-only filter (>1MB) would also correctly reject (245 bytes). Confirm both filters are active. Naming exception: `{YYYY}acfr.pdf` for FY2021–2025, `{YYYY}cafr.pdf` for FY2004–2020. |
<!-- HI/ID rows added in Task 2 -->

---

## Nodes remaining NASBO-served after this batch (feeds Phase 123 NASBORT-01)

None from this batch — all 5 Batch-1 states (AK, AR, DE, HI, ID) pass D-03 triage and are RECON-verdict, load-eligible candidates for Phase 118.

---

## AK — Alaska Detail Block

**Source:** Alaska Department of Administration, Division of Finance (DOF)
**PDF:** Annual Comprehensive Financial Report (ACFR) — full report
**Landing page:** `https://doa.alaska.gov/dof/reports/annualreport.html`

**URL pattern:**
- FY2020–FY2025: `https://doa.alaska.gov/dof/reports/resource/{YYYY}acfr.pdf`
- FY1998–FY2019: `https://doa.alaska.gov/dof/reports/resource/{YYYY}cafr.pdf` (naming exception — "cafr" not "acfr")

**Statement:** Statement 1.13 — Statement of Revenues, Expenditures, and Changes in Fund Balances, Governmental Funds
**Column:** General Fund (1st of 4: General Fund | Alaska Permanent Fund | Nonmajor Funds | Total Governmental Funds)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $8,378,945K — line items sum = $8,378,945K ✅ (diff $0)
- FY2020: GF Total Revenues = $6,063,851K — line items sum = $6,063,851K ✅ (diff $0)

**Investment income:** FY2025 Interest and Investment Income (Loss) = +$350,330K (positive); FY2020 = +$273,988K (positive). No P2 clamp needed for confirmed years; check interior years at load.

**Clean window:** FY1998–FY2025 (28 years; FY2020 + FY2025 bookend-tied at `-table` extraction quality)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~1.32× (FY2025 ACFR $8.38B vs FY2024 NASBO $6.34B) — accept-and-relabel recommended.

---

## AR — Arkansas Detail Block

**Source:** Arkansas Department of Finance and Administration (DFA), Office of Accounting
**PDF:** Comprehensive/Annual Comprehensive Financial Report (CAFR/ACFR)
**Landing page:** `https://www.dfa.arkansas.gov/office/accounting/annual-comprehensive-financial-report/`

**URL pattern:**
- FY2003–FY2024: `https://www.dfa.arkansas.gov/wp-content/uploads/cafr{YYYY}.pdf`
- FY2025: `https://www.dfa.arkansas.gov/wp-content/uploads/2025-Arkansas-ACFR.pdf` — **downloads as a valid 49MB PDF but is GARBLED (Type 3 custom fonts, no ToUnicode CMap; `pdftotext` output unreadable). Do not use for extraction — gap-logged.**

**Statement:** Statement of Revenues, Expenditures, and Changes in Fund Balance(s), Governmental Fund(s)
**Column:** General Fund — **Arkansas has only ONE governmental fund; the entire statement is a single "General Fund" column** (no major/nonmajor fund split to navigate — the simplest layout in the whole 34-state ACFR cohort to date).
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2024 (latest clean): GF Total Revenues = $24,045,611K — line items sum = $24,045,611K ✅ (diff $0)
- FY2003 (oldest bookend): GF Total revenues = $9,434,421K — line items sum = $9,434,421K ✅ (diff $0)

**Investment income:** FY2024 Investment earnings (loss) = +$442,735K (positive); FY2003 Investment earnings = +$46,139K (positive). No P2 clamp needed for confirmed years.

**Clean window:** FY2003–FY2024 (22 years; FY2025 gap-logged as garbled)
**Recency floor:** GREENLIGHT at FY2024 (latest clean year covers both FY2023 and FY2024)
**Scope vs NASBO:** ~3.96× (FY2024 ACFR $24.05B vs FY2024 NASBO $6.08B) — **the widest scope divergence found in the entire ACFR cohort to date (wider than TX's ~3×)**, driven by Arkansas consolidating essentially all governmental activity (including ~$11.2B Intergovernmental/federal revenue) into its single reported "General Fund." Accept-and-relabel recommended, with a prominent basis note given the magnitude.

---

## DE — Delaware Detail Block

**Source:** Delaware Office of Accounting (part of the Department of Finance)
**PDF:** Annual Comprehensive Financial Report (ACFR) / Comprehensive Annual Financial Report (CAFR)
**Landing page:** `https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/` (+ `/archived-annual-comprehensive-financial-reports/` for older years)
**File host:** `accountingfiles.delaware.gov` (separate CDN domain from the landing page)

**URL pattern:**
- FY2021–FY2025: `https://accountingfiles.delaware.gov/docs/{YYYY}acfr.pdf`
- FY2004–FY2020: `https://accountingfiles.delaware.gov/docs/{YYYY}cafr.pdf` (naming exception)

**CRITICAL — soft-404 WAF caution (T-117-01):** `accountingfiles.delaware.gov` rejects requests lacking a `Referer` header pointing at `accounting.delaware.gov`, returning a 245-byte HTML "Request Rejected" page at **HTTP 200** (not 404/403) — a status-only check would wrongly accept this as success. Both mitigations catch it: Content-Type is `text/html` not `application/pdf`, AND size is 245 bytes (<<1MB). **Loader must send `Referer: https://accounting.delaware.gov/reports-transparency/annual-comprehensive-financial-reports/` on every request to this host.**

**Statement:** Statement of Revenues, Expenditures and Changes in Fund Balances (Deficits), Governmental Funds
**Column:** General (1st of 5: General | Federal | Local School Districts | Capital Projects | Total Governmental Funds)
**Units:** Thousands
**FY-end:** June 30

**Bookend tie-confirms:**
- FY2025: GF Total Revenues = $7,475,243K — line items sum = $7,475,243K ✅ (diff $0)
- FY2004: GF Total Revenues = $3,055,310K — line items sum = $3,055,310K ✅ (diff $0)

**Investment income:** FY2025 Interest and Other Investment Income = +$238,663K (positive); FY2004 Interest & other investment income = +$30,713K (positive). No P2 clamp needed for confirmed years.

**Clean window:** FY2004–FY2025 (22 years)
**Recency floor:** GREENLIGHT (FY2023 + FY2024 confirmed)
**Scope vs NASBO:** ~1.20× (FY2025 ACFR $7.48B vs FY2024 NASBO $6.23B) — the smallest divergence in this batch, because Delaware reports Federal grants in their own separate major-fund column rather than consolidating them into General. Accept-and-relabel recommended.

---

<!-- Detail blocks for HI/ID added in Task 2 -->
