# 112 — Batch 2 ACFR Source Location (RECON-09, RECON-10 — OR/SC/LA/OK/UT)

**Status:** IN PROGRESS — workspace scaffolded, per-state recon to follow (Tasks 1-2)
**Phase:** 112-recon-roster-lock-source-location-overlap-resolution-recon-0
**Plan:** 112-02
**States:** Oregon (OR), South Carolina (SC), Louisiana (LA), Oklahoma (OK), Utah (UT)
**Method:** `pdftotext -table` on official state ACFR PDFs via `curl`. $0 spend. No DB writes.
**Precedent:** Mirrors 107-BATCH2-SOURCES.md / 107-BATCH1-SOURCES.md shape (the v2.13 Batch-2 recon mold).

This is the Phase 114 (Batch 2 load) input contract. Documentation only — no DB writes, no NASBO
mutations, no loader code, no frontend changes.

**UT-specific scope note (D-03/RECON-10):** This document's UT block locates Utah's **state** ACFR
(Division of Finance) only. The UT *state-node* provenance check and in-place-upgrade overlap plan
are plan 112-03's scope (RECON-10). v2.5 Transparent-Utah **municipal** (city/county) BigQuery data
is explicitly out of scope and untouched by this document.

---

## Section 1 — Per-state source table

| State | Statement (page) | GF column header | Units | FY-end | Durable clean window | Per-year URL pattern |
|-------|-----------------|-----------------|-------|--------|---------------------|---------------------|
| **OR** | _pending Task 1_ | | | | | |
| **SC** | _pending Task 1_ | | | | | |
| **LA** | _pending Task 1_ | | | | | |
| **OK** | _pending Task 2_ | | | | | |
| **UT** | _pending Task 2_ | | | | | |

---

## Section 2 — Bookend tie-confirmations (General Fund column Total revenues)

| State | FY | GF Total revenues | Tie check |
|-------|----|------------------|-----------|
| _pending Tasks 1-2_ | | | |

---

## Section 3 — Four risk facts per D-08

| Fact | OR | SC | LA | OK | UT |
|------|----|----|----|----|-----|
| **Units** | | | | | |
| **Negative GF line items** | | | | | |
| **Exact column header + statement** | | | | | |
| **FY-end month** | | | | | |

---

## Section 4 — Scope vs NASBO (D-09)

| State | ACFR GF Total revenues | NASBO GF operating FY2024 | Ratio | Driver | Recommendation |
|-------|------------------------|---------------------------|-------|--------|----------------|
| _pending Tasks 1-2_ | | | | | |

---

## Section 5 — Recency-floor verdict per D-07

| State | Latest final-audited FY | FY2023 covered? | FY2024 covered? | Verdict |
|-------|------------------------|-----------------|-----------------|---------|
| _pending Tasks 1-2_ | | | | |

---

## Section 6 — Consolidated gap log

| State | FY / Period | Gap reason | Disposition |
|-------|----|-----------|-------------|
| _pending Tasks 1-2_ | | | |

---

## Section 7 — Loader template mapping + Phase-114 load notes

| State | Closest loader template | GF layout notes | Phase-114 load notes |
|-------|------------------------|----------------|----------------------|
| _pending Tasks 1-2_ | | | |

---

## Oregon (OR) — Detail Block

_pending Task 1_

---

## South Carolina (SC) — Detail Block

_pending Task 1_

---

## Louisiana (LA) — Detail Block

_pending Task 1_

---

## Oklahoma (OK) — Detail Block

_pending Task 2_

---

## Utah (UT) — Detail Block

_pending Task 2_
