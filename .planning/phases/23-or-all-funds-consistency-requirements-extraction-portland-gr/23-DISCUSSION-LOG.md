# Phase 23: OR All Funds Consistency — Requirements Extraction (Portland + Gresham) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 23-OR All Funds Consistency — Requirements Extraction (Portland + Gresham)
**Areas discussed:** UI scope, Troutdale inclusion, FY coverage depth, Portland page location

---

## UI scope

| Option | Description | Selected |
|--------|-------------|----------|
| Data pipeline only | Extract, load, verify all_funds_requirements rows. Frontend display is a separate phase. | |
| Full end-to-end | Extract + load + frontend changes in one phase. Completes the coherent story. | ✓ |
| You decide | Researcher and planner pick the right split based on complexity. | |

**User's choice:** Full end-to-end

---

| Option | Description | Selected |
|--------|-------------|----------|
| Replace top-line number | Budget tab headline switches from departmental (~$330M) to all_funds_requirements (~$512M). Icicle/department breakdown stays as-is but labeled 'Departmental detail.' | ✓ |
| Add a toggle or tab | Keep existing Budget view intact. Add 'All Funds' toggle or second tab. | |
| Just the number, no drill-down change | Show all_funds_requirements as top-line but keep icicle chart exactly as-is. | |

**User's choice:** Replace top-line number

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show a label explaining the gap | Display something like "Departmental breakdown shows $330M of the $512M All Funds total. The remaining $180M covers debt service, capital, and other non-departmental requirements." | ✓ |
| Just the total, no explanation | Show $512M as headline and icicle as breakdown. Trust citizens not to over-read. | |
| You decide | Let planner design the right framing. | |

**User's choice:** Show a label explaining the gap

---

| Option | Description | Selected |
|--------|-------------|----------|
| All OR cities with the data | UI change applies to any city with all_funds_requirements rows — data-driven, generic. | ✓ (with note) |
| Portland + Gresham only | Explicitly scope to two cities; Troutdale handled when data lands. | |

**User's choice:** "Honestly, going forward, it should apply to all cities. For now, it's just OR cities."
**Notes:** UI change must be data-driven (not hardcoded to OR). Any city/year with `all_funds_requirements` rows gets the updated headline automatically.

---

## Troutdale inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| Include Troutdale | Phase 23 researcher assesses Troutdale's PDFs and folds in if simple. | ✓ |
| Portland + Gresham only | Strict scope; Troutdale is a separate task. | |
| Researcher decides | Fold in if < 1 plan's worth of complexity, otherwise defer. | |

**User's choice:** Include Troutdale

---

## FY coverage depth

| Option | Description | Selected |
|--------|-------------|----------|
| Match all available operating FYs | Gresham: FY2023–2026. Portland: FY2022–2026. Troutdale: FY2019–2026. Year selector fully consistent. | ✓ |
| Most recent FY only | Load only latest adopted year per city. Older FYs show old mismatch. | |
| Match revenue FYs | Load same FYs already covered by revenue data. | |

**User's choice:** Match all available operating FYs

---

## Portland page location

| Option | Description | Selected |
|--------|-------------|----------|
| Vol 1 (same as operating) | All Funds summary in Vol 1. extractPortland.py gets extract_requirements() targeting Vol 1. | |
| Vol 2 (same as revenue) | All Funds summary in Vol 2. extract_requirements() targets same files as extract_revenue(). | |
| Researcher determines it | Researcher opens Portland PDF and identifies which volume has the All Funds page. | ✓ |

**User's choice:** Researcher determines it

---

## Claude's Discretion

- Portland All Funds page volume (Vol 1 vs Vol 2) — researcher to determine from PDF inspection
- Exact wording of the gap-explanation label — planner/implementer discretion based on available data fields

## Deferred Ideas

- All Funds Requirements enrichment for category descriptions — not in scope for Phase 23; researcher can recommend if categories are opaque to citizens
- TX and CA cities All Funds consistency — out of scope for Phase 23; future phase if pattern proves valuable
- Portland Vol 2 fund-level revenue (deferred in Phase 21) — still deferred; Phase 23 is Requirements extraction only
