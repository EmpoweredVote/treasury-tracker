# Plan 49-03 Summary — Agency-lens backfill loader (from OMB PBD)

**Status:** Complete (build + dry-run verified; real writes deferred to 49-05)
**Commit:** `feat(49-03): agency-lens backfill from OMB Public Budget Database`
**Requirements:** HIST-02, HIST-04, CTX-01

## What changed
- `scripts/loadFederalAgencies.js` — added a `--source omb` path (`loadFromOMB`) that downloads the OMB Public Budget Database (same file as the function lens), extracts the target year column, and rebuilds a Department→Bureau→Account tree via `buildAgencyTree` (group by `agency`→`bureau`→`account`, sum amounts; positive accounts → nodes, negatives → offsetting line items, net≤0 bureaus/departments excluded + disclosed). The entire existing MTS FY2025 path (`loadFromMTS`, `buildForest`) is preserved verbatim and remains the default (`--source mts`).

## Key decisions & deviations
- **The biggest research finding realized:** the agency lens for history does NOT use MTS Table 5 (API history starts FY2015) or OMB Hist 4.1 (flat). It reuses the PBD account rows the function lens already loads, regrouped by agency hierarchy. One free file, full account depth, every year.
- **Hist 4.1 Tier-1 fallback intentionally NOT implemented** — same rationale as 49-02: PBD account data reconciles to the OMB anchor by construction (the agency net equals the function net for every year, since it's the same rows). Tier-2 (load-anyway + `visual_vs_official_agency_*`) is the safety net.
- Historical data_source name = `…(OMB Public Budget Database)`, distinguishing it from the FY2025 `…(MTS Table 5)` source — Phase 51 will note the FY2024→FY2025 source change.
- `p_period_label` passed only for the TQ (FY years stay 7-arg / migration-independent).

## Verification (dry-run, $0)
| Period | Depts | Bureaus | Account nodes | Net | Anchor delta |
|--------|-------|---------|---------------|-----|--------------|
| FY2024 | 121 | 318 | 1245 | $6,735.3B | 0.0000% |
| FY1976 | 99 | 254 | 626 | $371.8B | 0.0001% |
| TQ | 95 | 248 | 599 | $106.8B disp. | self-anchored |

FY2024/FY1976 agency net == function net (same anchor), confirming internal consistency.
Top departments are historically plausible (FY2024 HHS $1,902B / SSA $1,520B / Treasury $1,382B incl. interest; FY1976 DoD $88.5B / SSA $79.0B).
