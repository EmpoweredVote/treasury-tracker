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
<!-- AK/AR/DE rows added in Task 1 -->
<!-- HI/ID rows added in Task 2 -->

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|---------------------|-----------|
<!-- AK/AR/DE rows added in Task 1 -->
<!-- HI/ID rows added in Task 2 -->

---

## Section 3 — Four risk facts per D-08

| Fact | AK | AR | DE | HI | ID |
|------|----|----|----|----|-----|
<!-- Task 1 fills AK/AR/DE columns -->
<!-- Task 2 fills HI/ID columns -->

---

## Section 4 — Scope vs NASBO (D-09 — TX-trap analysis)

Note: NASBO GF operating figures are **expenditure** totals (spending-by-function, FY2024 actual from `loadStateGF.mjs`). ACFR figures are **revenue** totals (latest cleanly-tied FY). The comparison is apples-to-oranges by design — the point is to flag whether the ACFR GF's revenue base is materially broader/narrower than NASBO's budgetary concept.

| State | ACFR GF Total revenues (latest FY) | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|--------------------------------------|------------------------------|-------|--------|-----------------|
<!-- AK/AR/DE rows added in Task 1 -->
<!-- HI/ID rows added in Task 2 -->

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|---------------------------|--------------------|--------------------|---------|
<!-- AK/AR/DE rows added in Task 1 -->
<!-- HI/ID rows added in Task 2 -->

---

## Section 6 — Consolidated gap log

| State | FY | Gap reason | Disposition |
|-------|----|-----------|-------------|
<!-- AK/AR/DE rows added in Task 1 -->
<!-- HI/ID rows added in Task 2 -->

---

## Section 7 — Loader template mapping + Phase-118 load notes

| State | Closest loader template | GF layout notes | Phase-118 load notes |
|-------|---------------------------|--------------------|-------------------------|
<!-- AK/AR/DE rows added in Task 1 -->
<!-- HI/ID rows added in Task 2 -->

---

## Nodes remaining NASBO-served after this batch (feeds Phase 123 NASBORT-01)

None from this batch — all 5 Batch-1 states (AK, AR, DE, HI, ID) pass D-03 triage and are RECON-verdict, load-eligible candidates for Phase 118.

---

<!-- Detail blocks added in Tasks 1-2 -->
