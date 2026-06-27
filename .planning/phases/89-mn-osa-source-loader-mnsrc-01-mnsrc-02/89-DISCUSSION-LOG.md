# Phase 89: MN OSA Source + Loader - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 89-mn-osa-source-loader-mnsrc-01-mnsrc-02
**Areas discussed:** Tree depth & shape, Revenue/expenditure totals, De-risk proof target, County de-risk scope

---

## Tree depth & shape

| Option | Description | Selected |
|--------|-------------|----------|
| 2-level | group→sub-source / function→sub-function; even depth | |
| 3-level where natural | deeper where columns nest (Intergov→Federal/State→type; Public Safety→Police→current/capital); uneven depth | ✓ |
| Flat 1-level (Ohio-style) | only top-level groups; no drill-down | |

**User's choice:** 3-level where natural
**Notes:** Wants the deeper detail the MN source supports — the drill-down that beats Ohio's flat source.

### (follow-up) Current-expend vs capital-outlay at the deepest level

| Option | Description | Selected |
|--------|-------------|----------|
| Split as leaves | keep current vs capital as deepest leaves where both exist | ✓ |
| Sum into one leaf | combine into a single sub-function total; shallower | |
| You decide | split where material, sum where negligible | |

**User's choice:** Split as leaves
**Notes:** Consistent with 3-level — surfaces operating-vs-investment, most granular honest view.

---

## Revenue/expenditure totals

### Intergovernmental inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Include it | count state LGA + federal/county aid as a labeled group (Ohio D-01) | ✓ |
| Exclude it (VA-style) | local-sources-only revenue (VA D-02) | |

**User's choice:** Include it
**Notes:** MN expenditure total is all-governmental-funds (funded partly by aid); excluding intergovernmental would imply a false deficit. Same basis logic as Ohio.

### Which total line

| Option | Description | Selected |
|--------|-------------|----------|
| Core totals | `Total Revenues`/`Total Expenditures` — exclude bonds/transfers/other financing (Ohio D-04b) | ✓ |
| Grand totals | `& Other Sources/Uses` — include financing; double-count risk | |

**User's choice:** Core totals
**Notes:** Bonds/transfers aren't income/spending in the citizen sense; cleanest ACFR basis for Phase 93.

---

## De-risk proof target

### Headline proof city

| Option | Description | Selected |
|--------|-------------|----------|
| Minneapolis, latest FY | biggest city, longest RCV jurisdiction | ✓ |
| St. Paul, latest FY | second RCV anchor (Ramsey) | |
| You decide | pick at plan time (still an RCV anchor) | |

**User's choice:** Minneapolis, latest confirmed FY
**Notes:** Tree sums tie to the row's own Total Revenues/Total Expenditures; exact latest FY (FY2023 confirmed; FY2024 if published) pinned in this phase.

### Also prove a Cash-basis entity?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Cash-basis city too | prove the `GAAPInd` flag path before Phase 90 bulk | ✓ |
| No — GAAP Minneapolis enough | defer Cash quirks to bulk | |

**User's choice:** Yes — prove a Cash-basis city too
**Notes:** Mirrors Ohio's CASH/MOD pre-bulk de-risk.

---

## County de-risk scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pin URL + dry-run one county | verify county layout vs city now; bulk in 91 | ✓ |
| City-only; defer all county to 91 | faster now; risks repeating Ohio | |
| Build + bulk-load counties in 89 | scope creep (bulk is Phase 91) | |

**User's choice:** Pin URL + dry-run one county
**Notes:** Directly forecloses Ohio's late-caught county-layout defect (caught only in Phase 88 re-derivation last milestone).

---

## Claude's Discretion

- Exact column-index map for the `Governmental Funds` sheet (raw-$ only, skip `[object Object]` formula cells).
- Single-workbook `GAAPInd` basis tagging (no cross-workbook fallback).
- Source attribution (`cired_<YY>_data.xlsx` URL via slug enumeration), `mnOsaDatasets.json` manifest, per-year `Population`, entity-name matching, CLI flags.

## Deferred Ideas

- Enterprise funds (`Enterprise Funds` sheet → MNENT-01).
- Employee/compensation data (`Employee Data` sheet → MNSAL-01).
- Pre-2015 CSV/ZIP history (MNHIST-01).
- Townships + special districts (MNTWN-01).
