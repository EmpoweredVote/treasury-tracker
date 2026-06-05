# Phase 30: Fresno + Riverside CA Data Load - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 30-fresno-riverside-ca-data-load
**Areas discussed:** Riverside FY depth, Fresno FY depth, Fund filter scope (Fresno), Fund filter scope (Riverside), Revenue data strategy, Plan order

---

## Riverside FY Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Same as Oakland — go deep | Researcher determines available biennial PDFs, prefers ~3 biennials (~6 FYs) | ✓ |
| Just the most recent biennial | Load only current biennial (2 FYs) | |
| 2 biennials (4 FYs) minimum | Middle ground between depth and effort | |

**User's choice:** Same as Oakland — go deep (Recommended)
**Notes:** Follow the established Oakland approach — researcher determines availability and loads as many compatible biennials as possible.

---

## Fresno FY Depth

| Option | Description | Selected |
|--------|-------------|----------|
| FY2022–2026 (4–5 years) | Same target as Long Beach and Bakersfield in Phase 29 | |
| FY2020–2026 (6–7 years) | Deeper history; researcher determines format compatibility | ✓ |
| Most recent 2–3 years only | Faster, lower risk | |

**User's choice:** FY2020–2026 (6–7 years)
**Notes:** User wants more depth for Fresno than the Phase 29 default. Researcher stops earlier if format changes significantly.

---

## Fund Filter Scope — Fresno

| Option | Description | Selected |
|--------|-------------|----------|
| General Fund only — strict | Filter to rows labeled "General Fund"; ~$483M target; same as San Jose | ✓ |
| GF + special revenue funds | Include General Fund plus special revenue funds; would exceed ~$483M | |
| Researcher determines fund scope | Researcher identifies fund groupings and recommends filter | |

**User's choice:** General Fund only — strict (Recommended)
**Notes:** Clear match to the ~$483M success criteria. Enterprise funds (~$899M) are significant but excluded entirely.

---

## Fund Filter Scope — Riverside

| Option | Description | Selected |
|--------|-------------|----------|
| General Fund only — strict | Filter to General Fund rows; excludes RPU, Water, Sewer, all enterprise funds; ~$1.45B/year target | ✓ |
| General Fund + specific exclusions | Include all funds except explicitly named enterprise funds | |
| Researcher determines fund scope | Researcher identifies Riverside fund structure | |

**User's choice:** General Fund only — strict (Recommended)
**Notes:** RPU electric utility is the key enterprise fund to exclude, but General Fund only filter cleanly handles all enterprise/proprietary funds in one rule.

---

## Revenue Data Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Best-effort from operating PDF | Extract if cleanly present; defer if not; same as Phase 28 D-05 | ✓ |
| Dedicated hunt for revenue docs | Researcher actively searches for standalone revenue documents first | |

**User's choice:** Best-effort from operating PDF (Recommended)
**Notes:** Consistent with established Phase 28 approach. Don't block the phase on revenue if operating PDF doesn't have a clean revenue section.

---

## Plan Order

| Option | Description | Selected |
|--------|-------------|----------|
| Fresno first | Single-year format establishes pattern; Riverside's biennial complexity in Plan 3 | ✓ |
| Riverside first | Tackle harder city first; if Riverside works, Fresno is straightforward | |

**User's choice:** Fresno first (Recommended)
**Notes:** Simpler pattern first is the established approach from Phase 28/29.

---

## Claude's Discretion

- Exact FY range for each city: researcher determines based on available PDFs with consistent format
- PDF page extraction approach for Fresno: targeted vs. full-document based on actual PDF layout
- Number of biennials for Riverside: researcher determines how many are available with compatible structure
- Exact data_source row names: planner determines; must match `treasury_list_source_ids` lookups
- Whether amounts are in thousands (`toFullDollars()` needed): researcher verifies from actual PDFs

## Deferred Ideas

- County linking for Fresno (Fresno County) and Riverside (Riverside County) — future phase; neither county government loaded in DB
- Pre-FY2020 historical data for Fresno — deferred if format incompatible
- Older Riverside biennials beyond the depth target — deferred if format incompatible
