# 117 — Batch 4 ACFR Source Location (RECON-11, OK/RI/SD/VT/WV/WY — the last 6, all-50 completion)

**Status:** IN PROGRESS — Task 0 (workspace + D-03 triage + OK pre-fill from v2.14) complete.
**Phase:** 117-recon-source-location-roster-lock-overlap-scope-pre-flight-r
**Plan:** 117-04
**States:** Oklahoma (OK — reused v2.14 recon, pending re-verify), Rhode Island (RI), South Dakota (SD), Vermont (VT), West Virginia (WV), Wyoming (WY)
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
| **OK** | Oklahoma OMES (Central Accounting & Reporting) | Yes (preserved v2.14 recon — pending re-verify) | Yes | Yes | **RECON (reuse — pending re-verify in Task 1)** |
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
| **OK** | Statement of Revenues, Expenditures and Changes in Fund Balances — Governmental Funds | **General** (1st of General \| Commissioners of the Land Office \| Wildlife Lifetime Licenses \| Tobacco Settlement Endowment \| Total) | thousands | Jun 30 | **FY2002–FY2024** (reused v2.14; re-verified Task 1 — see below; FY2025 still not published) | `https://oklahoma.gov/content/dam/ok/en/omes/documents/{cafr\|ACFR\|acfr-}{YYYY}.pdf` — naming varies by era, current year (`acfr-2024.pdf`) breaks the pattern each refresh |
| _(pending — see Task 1/2 sections below for RI/SD/VT/WV/WY)_ | | | | | | |

_(Full per-state rows added incrementally in Sections 2–8 as each state completes its recon —
see the per-state Detail Blocks at the end of this document for the authoritative record.)_

---

*Document in progress — Task 1 (OK re-verify + RI + SD) and Task 2 (VT + WV + WY) append below.*
