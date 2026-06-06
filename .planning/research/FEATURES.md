# Feature Research: v1.7 California State Budget + Deep Icicles

**Domain:** Government financial transparency — state-level entity + 3-level budget visualization
**Researched:** 2026-06-06
**Confidence:** HIGH — derived from codebase + UX inspection

---

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| California state entity in entity picker | App covers CA cities + county; state is the obvious next scope | LOW | Schema migration + seeder + EntitySwitcher update |
| CA state budget (General Fund) Money Out | Core value: understand where money goes | MEDIUM | ebudget PDF or LAO Excel; pdfplumber pattern |
| Per-capita display for CA state | Already shown for every city/county; citizens expect it | LOW | ~$5,400/resident at $212B GF ÷ 39.5M population |
| Category enrichment for CA state programs | Already standard for all loaded entities | LOW | 10–15 program-level categories; prompt needs state-level framing |
| 3-level icicle drill-down for CA state | Pilot for deep icicles — natural fit for Program → Dept → Line | MEDIUM | RPC + API update; BudgetIcicle.tsx needs no change |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| State + cities in single picker | Citizen can compare city budget to state context | LOW | EntitySwitcher section promotion (~20 lines) |
| Consistent 3-level icicle across all entities | After retrofit, all 30+ entities have deeper drill-down | HIGH | Phased retrofit; must wait for infrastructure |
| Multi-year CA state data (FY2015–FY2026) | LAO Excel covers 40 years; no other tool shows trends | MEDIUM | LAO Excel loader — openpyxl pattern |

### Anti-Features (Scope Creep Risks)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| All-funds CA state budget | "Show everything" impulse | $495B all-funds vs $212B GF — federal pass-through inflates by $250B+, same problem as LA/Fresno enterprise funds at city scale | General Fund only for v1.7 |
| 4-level icicle | "Why stop at 3?" | Source data doesn't have 4 levels; would require synthetic grouping | 3 is the natural max for CA state data |
| Full retrofit of all 30+ cities in one phase | Feels like "finishing the job" | Most city sources have only 2 meaningful levels; forced 3rd level is synthetic and adds noise | Phased: infrastructure → CA state pilot → selective retrofits |
| Revenue budget for CA state in v1.7 | Completeness | Revenue source data (taxes, fees) is in a separate PDF/dataset — different extraction problem | Defer to v1.8 |

---

## Feature Dependencies

```
entity_type: 'state' schema migration
    └──required-by──> California state entity seeder
                          └──required-by──> CA state budget loader

RPC 3-level update (ev-accounts-api)
    └──required-by──> Any 3-level loader (CA state OR city retrofits)
                          └──required-by──> 3-level icicle display

API categories endpoint update (ev-accounts-api)
    └──required-by──> Frontend receiving 3-level BudgetCategory[]
    └──depends-on──> RPC 3-level update (data must be in DB first)

EntitySwitcher UI update
    └──depends-on──> entity_type: 'state' schema migration (type must exist)
    └──independent-of──> RPC/API updates
```

---

## UX: State Entity in Entity Picker

**Problem:** Adding "California" as a state entity while the app already groups by "California" cities creates circular nesting: "California > States > California."

**Solution:** Promote state entities to a separate top section **above** all state groups, labeled "State Governments." This is architecturally clean and UX-obvious — citizens distinguish "State of California" from "cities in California."

```
┌──────────────────────────────────────┐
│ Search 31 jurisdictions...            │
├──────────────────────────────────────┤
│ STATE GOVERNMENTS                     │  ← new pinned section
│   California                          │
├──────────────────────────────────────┤
│ CALIFORNIA                            │  ← existing
│   Counties (1) · Cities (12)          │
├──────────────────────────────────────┤
│ OREGON · TEXAS                        │
└──────────────────────────────────────┘
```

---

## UX: 3-Level Icicle Behavior

**Current:** Level 1 = program categories (e.g., "Public Safety"). Click → Level 2 = subcategories (e.g., "Police"). No further drill-down.

**With 3 levels:** Level 1 → Level 2 → Level 3 (e.g., "Personnel", "Operations", "Capital"). Level 3 nodes show line items in `LineItemsTable`. The icicle renders each ancestor level compressed to 32px; active level at 64px. This behavior is already in `BudgetIcicle.tsx` — the UI just needs the data.

**For CA state specifically:** The natural 3-level hierarchy from the budget PDF is:
- Level 1: Program Area (Health & Human Services, Education, Corrections, etc.)
- Level 2: Department (Dept of Health Care Services, CDE, CDCR, etc.)
- Level 3: Budget category (Personnel, Operating Expenses, Capital Outlay)

**Enrichment framing for state categories:** The `enrichCategories.js` prompt currently describes "what this city department does for residents." For CA state, the level-1 categories are policy programs, not departments. The prompt must use state-level framing: "what this state program funds" and "how it benefits California residents."

---

## MVP for v1.7

| Feature | Essential? | Why |
|---------|-----------|-----|
| CA state entity_type + schema | Yes | Gate for everything else |
| CA state GF operating budget loaded | Yes | The pilot |
| 3-level icicle for CA state | Yes | The point of the milestone |
| EntitySwitcher state section | Yes | UX without it is confusing |
| Enrichment for CA state | Yes | Standard for all entities |
| RPC + API backward compat (2-level cities unchanged) | Yes | Cannot break existing cities |
| Full retrofit of all cities | No | Phased post-infrastructure |
| CA state revenue budget | No | Separate data source; defer to v1.8 |
| Multi-year historical CA state data | Nice-to-have | LAO Excel makes it easy; include if time allows |

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| CA state entity + schema migration | HIGH | LOW | P1 |
| EntitySwitcher state section | HIGH | LOW | P1 |
| CA state GF operating budget | HIGH | MEDIUM | P1 |
| 3-level icicle (RPC + API update) | HIGH | MEDIUM | P1 |
| CA state enrichment | MEDIUM | LOW | P1 |
| Retrofit 1-2 pilot cities to 3 levels | MEDIUM | MEDIUM | P2 |
| Full city retrofit (all 30+) | MEDIUM | HIGH | P2 |
| CA state revenue budget | LOW | HIGH | P3 (v1.8) |
| Multi-year LAO Excel history | MEDIUM | MEDIUM | P2 |

---

## Sources

- Direct inspection: `BudgetIcicle.tsx`, `EntitySwitcher.tsx`, `src/types/budget.ts`, `App.tsx`
- Architecture research: confirmed column layout, RPC structure, backward-compat strategy
- Pitfalls research: confirmed all-funds inflation risk, enrichment prompt mismatch, retrofit scope explosion

---
*Feature research for: v1.7 CA state budget + 3-level icicle hierarchy*
*Researched: 2026-06-06*
