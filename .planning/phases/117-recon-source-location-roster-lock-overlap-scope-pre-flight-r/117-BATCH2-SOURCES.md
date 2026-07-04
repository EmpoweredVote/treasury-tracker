# 117 — Batch 2 ACFR Source Location (RECON-11, IA/KS/ME/MS/MT)

**Status:** IN PROGRESS — Section 0 (D-03 triage) complete for all 5 states. Sections 1-7 + per-state
detail blocks to be filled in as each state is reconned (Task 1: IA/KS/ME; Task 2: MS/MT).
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**States:** Iowa (IA), Kansas (KS), Maine (ME), Mississippi (MS), Montana (MT)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors `107-BATCH1-SOURCES.md` shape (NJ/MA/NC/GA/MD recon mold), with a new
Section 0 D-03 triage added per this phase's context (small-state risk anticipation).

---

## Section 0 — D-03 Triage (per-state: does a clean GAAP Governmental-Funds ACFR with a
splittable General Fund column even exist?)

| State | Publishing office | GAAP ACFR exists? | Governmental Funds statement w/ distinct GF column? | Verdict |
|-------|-------------------|--------------------|------------------------------------------------------|---------|
| **Iowa (IA)** | Dept. of Administrative Services (DAS), State Accounting Enterprise | Yes — full ACFR, archive FY1997–FY2025 | Yes — "Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds", **GENERAL FUND** first column | **RECON** |
| **Kansas (KS)** | Dept. of Administration, Office of Accounts and Reports | Yes — full ACFR, listed FY2019–FY2025 on current site | Yes — "Statement of Revenues, Expenditures, and Changes in Fund Balances - Governmental Funds", **General** first column (7-fund wide layout) | **RECON** |
| **Maine (ME)** | Office of the State Controller (OSC) | Yes — full ACFR, archive FY2000–FY2025 | Yes — "Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds", **General** first column | **RECON** |
| **Mississippi (MS)** | Dept. of Finance and Administration (DFA), Office of Financial Reporting | Yes — full ACFR (still branded CAFR in older years), archive FY1996–FY2024 | Yes — "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds", **General** first column (near-single-fund model) | **RECON** |
| **Montana (MT)** | Dept. of Administration, State Financial Services Division (SFSD) | Yes — full **annual** ACFR (state budgets biennially, but financial reporting is annual GAAP), archive FY2015–FY2025 confirmed | Yes — "Statement of Revenues, Expenditures, and Changes in Fund Balances — Governmental Funds", **GENERAL** first column | **RECON** |

**Verdict summary:** All 5 Batch-2 states PASS the D-03 triage — each publishes a GAAP ACFR with a
Governmental Funds *Statement of Revenues, Expenditures and Changes in Fund Balances* carrying a
distinct General Fund (or "General") column. **Zero STAY-NASBO-exception candidates in Batch 2** —
no D-01 fill-policy disposition needed for this batch; all 5 proceed to full recon (Tasks 1-2) and
are expected to load in Phase 119.

**MT annual-vs-biennial confirmation (plan-flagged risk):** Montana's budget is adopted biennially,
but its **GAAP financial reporting is annual** — the state publishes a distinct signed ACFR for every
single fiscal year (2015 through 2025 individually listed on `doa.mt.gov/SFSD/ACFR-PAFR`, each with
its own Statement of Revenues/Expenditures/Changes in Fund Balances — Governmental Funds). This is
NOT a biennial-budget schedule; no D-01/D-09 accept-relabel is needed for this reason. (Confirmed in
Task 2 detail block.)

**ME non-June FY-end flag (plan-flagged risk):** the phase plan flagged Maine as "one to watch" for a
non-June fiscal year end. **Empirically disproven** — both the FY2025 and FY2002 bookend ACFRs
confirm "For the Year Ended June 30, {YYYY}" / "Fiscal Year Ended June 30, {YYYY}". Maine's FY-end
is June 30, same as the other four Batch-2 states. Documented honestly in Section 3 (Task 1).

---

## Workspace confirmation (Task 0)

- `pdftotext -v` confirmed: `pdftotext version 4.00` (poppler present, no install needed).
- `_acfr-work/{ia,ks,me,ms,mt}/` created — confirmed gitignored (`.gitignore` lines 108/133 both
  match `_acfr-work/`). No PDFs committed to git.
- This file (`117-BATCH2-SOURCES.md`) scaffolded with the same 8-section skeleton as
  `107-BATCH1-SOURCES.md`: (0) D-03 triage — **new for this phase**, (1) per-state source table,
  (2) bookend tie-confirmations, (3) four risk facts (D-08), (4) scope vs NASBO (D-09),
  (5) recency-floor verdict (D-07), (6) consolidated gap log, (7) loader-template mapping +
  Phase-119 load notes, plus per-state detail blocks.

---

*(Sections 1-7 + per-state detail blocks below — filled in by Tasks 1 and 2)*
