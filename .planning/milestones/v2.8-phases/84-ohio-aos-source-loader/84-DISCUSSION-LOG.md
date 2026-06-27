# Phase 84: Ohio AOS Source + Loader - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-24
**Phase:** 84-ohio-aos-source-loader
**Areas discussed:** Revenue total basis, Money-Out total scope, De-risk proof scope, Tree depth + extra lines

---

## Revenue total basis

| Option | Description | Selected |
|--------|-------------|----------|
| Include Intergovernmental | Total = all 12 SOREACIFB sources (= statement "Total Revenues", incl. state/federal aid); intergovernmental as a labeled node. Keeps Money In/Out on the same basis; reconciles to SOA_Gov; avoids false-deficit optics. | ✓ |
| Local-only (exclude aid) | Mirror the VA decision — strip Intergovernmental. For Ohio makes revenue < full expenditure total (false-deficit optics) + diverges from statement line. | |
| You decide | Lock the recommended. | |

**User's choice:** Include Intergovernmental
**Notes:** Intentionally INVERTS the VA D-02 local-only decision — the basis differs (Ohio expenditures are the full statement total, funded partly by intergovernmental aid). Intergovernmental rendered as one transparent labeled source node.

---

## Money-Out total scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full Total Expenditures | = SOREACIFB statement "Total Expenditures": ~18 functions incl. Capital Outlay + debt service. Matches the published line → cleanest reconciliation; consistent with CA/Utah/VA all-funds basis. Capital + debt as labeled nodes. | ✓ |
| Operating functions only | Exclude Capital Outlay + debt service → closer to a pure operating budget, but total no longer equals any published statement line. | |
| You decide | Lock the recommended. | |

**User's choice:** Full Total Expenditures
**Notes:** Capital Outlay + debt service (Principal Retirement, Interest/Fiscal Charges, Bond Issuance) surface as their own labeled function nodes.

---

## De-risk proof scope

| Option | Description | Selected |
|--------|-------------|----------|
| Columbus GAAP + a CASH/MOD city | Prove Columbus FY2024 GAAP AND parse one CASH/MOD-basis city. De-risks the NEW fallback path (basis tag + smaller workbook shape) before the Phase 85 bulk. | ✓ (via "You decide") |
| Columbus GAAP only | Tightest de-risk; defer CASH/MOD validation to Phase 85. | |
| You decide | Lock the recommended. | |

**User's choice:** You decide → locked the recommended (Columbus GAAP + one CASH/MOD city)
**Notes:** Planner picks a concrete CASH- or MOD-basis city from the smaller workbooks.

---

## Tree depth + extra lines

| Option | Description | Selected |
|--------|-------------|----------|
| Flat 1-level, drop OFS/OFU + balances | Revenue = 12 source leaves; expenditure = ~18 function leaves (columns ARE the leaves, no VA-style sub-activities). Exclude Other Financing Sources/Uses + fund-balance lines. | ✓ |
| Include OFS/OFU as nodes | Surface transfers / debt proceeds / fund-balance change as labeled nodes. More complete but muddies the story + risks double-counting. | |
| You decide | Lock the recommended. | |

**User's choice:** Flat 1-level, drop OFS/OFU + balances
**Notes:** Transform is column→node (simpler than CA/Utah/VA nested feeds).

---

## Claude's Discretion

- Exact `SOREACIFB_TotalGov` column-index map (raw-$ only; ignore exceljs `[object Object]` formula cells)
- Source attribution (per-FY+basis direct file URL; `data_source` = "Ohio Auditor of State Summarized Annual Financial Reports")
- `ohioAosDatasets.json` per-FY+basis manifest
- Per-year `OI_Demographics` population (no single fixed vintage)
- City-name → `municipalities` matching; CLI flag shape (mirror VA/Utah loaders)
- Live verification that the GAAP workbook URL still resolves + fresh Columbus pull at research/plan time
- FY range determination (recon: 2016–2025 .XLSX)

## Deferred Ideas

- Enterprise funds (`SONP_*`/`SOREACINP_*`) — v2 (OHENT-01)
- Townships/villages/libraries/schools — v2 (OHTWN-01)
- OhioCheckbook transaction-level spending — possible later enrichment layer
- Pre-2016 history (older .XLS / summarized PDFs) — out of scope; document the XLSX floor
