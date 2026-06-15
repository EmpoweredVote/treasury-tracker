# Phase 55: Statewide City Salaries Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 55-statewide-city-salaries-integration
**Areas discussed:** Names policy, Headline figure, Year coverage, Spike gate + fallback

---

## Names policy

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregated, no names | Position-level only (Dept → Position with count/total/avg); no individual rows or names. Matches publicpay + safety line. | ✓ |
| Names if source has them | Show individual names as leaf rows wherever provided (LA County style). | |
| Anonymized rows | Show individual rows labeled generically, no identity. | |

**User's choice:** Aggregated, no names.
**Notes:** publicpay.ca.gov omits names anyway; aligns with the v2.0 safety line. Position becomes the tree leaf. LA County's name-level display is left untouched (acceptable divergence).

---

## Headline figure

| Option | Description | Selected |
|--------|-------------|----------|
| Total Compensation | Wages + employer benefits; matches LA County `Total_Compensation`. | |
| Total Wages only | Cash pay only, excludes employer benefit contributions. | |
| Both, total comp headline | Tree sums on Total Compensation; position nodes carry wages/benefits split in metadata. | ✓ |

**User's choice:** Both, total comp headline.
**Notes:** Salaries tab reads identically to LA County, but drill-down preserves the wages-vs-benefits split (mirrors LA's avgBase/avgBenefits/avgOvertime metadata).

---

## Year coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Latest year only | Single most recent reported year per city. | |
| Last ~3–5 years | Recent trend window. | |
| Full available range | Every year the source provides (~2009–latest). | ✓ |

**User's choice:** Full available range.
**Notes:** Matches the FY2003–2024 operating/revenue depth. Heaviest load (per-employee rows × 34 cities) — loader must be multi-year capable; planner to batch sensibly.

---

## Spike gate + fallback

Two linked decisions.

### Fallback on missing/thin coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Load covered, document gaps | Load every covered city; skip + honestly document gaps; proceed without pausing. | ✓ |
| Pause for alternate source | Stop and bring a fallback-source decision (e.g. Transparent California). | |
| Abort if mostly missing | Halt entirely if coverage is not meaningful. | |

**User's choice:** Load covered, document gaps.

### Gate pass condition

| Option | Description | Selected |
|--------|-------------|----------|
| Access + shape + sample match | Source accessible + tree-shaped fields + a sampled OC city/year reconciles vs published figures. | ✓ |
| Access + shape only | Defer figure reconciliation to post-load verification. | |
| Coverage breadth too | Also enumerate all 34 OC cities' coverage before building. | |

**User's choice:** Access + shape + sample match.
**Notes:** Strongest gate that proves correctness before scaling, without requiring full 34-city enumeration up front (coverage discovered during load per the fallback decision).

---

## Claude's Discretion

- Source access mechanism (publicpay API vs per-entity CSV) — confirmed by spike.
- Department/position name normalization (cf. `processSalaries.js`).
- Loader CLI surface (`--city`/`--entity`, repeatable `--fy`, `--dry-run`).
- Source-attribution string for `p_data_source_name`.
- Zero-comp skip and multi-employer row handling.
- SAL-03/SC-4 verification probe specifics.

## Deferred Ideas

- Loading salaries for non-OC CA cities (loader supports it; only OC loaded this phase).
- Individual-name / per-employee detail for publicpay cities — against the safety line, not planned.
- Alternate compensation source (Transparent California) as fallback — not this phase.
