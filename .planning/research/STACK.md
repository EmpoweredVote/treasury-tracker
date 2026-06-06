# Stack Research: v1.7 California State Budget + Deep Icicles

**Domain:** Government financial transparency — CA state budget loading + 3-level icicle hierarchy
**Researched:** 2026-06-06
**Confidence:** HIGH — derived from codebase inspection + confirmed source availability

---

## Summary

No new npm or pip packages are needed for the 3-level tree change — it is a purely logic change to the Node.js RPC walk and the ev-accounts-api categories endpoint. The CA state budget has no Socrata API; the best sources are the CA ebudget.ca.gov PDF (pdfplumber, same pattern as existing CA cities) or the LAO historical Excel pivot table (openpyxl, already available). The `BudgetIcicle.tsx` frontend requires zero stack changes — it already renders arbitrary depth.

---

## CA State Budget Data Sources

| Source | Format | Loader | Confidence | Notes |
|--------|--------|--------|------------|-------|
| ebudget.ca.gov Enacted Budget Summary PDF | PDF | pdfplumber | MEDIUM | Well-structured table; must inspect for merged cells |
| LAO historical Excel pivot | XLSX | openpyxl / xlsx | HIGH | Multi-year FY1985–FY2026; department-level aggregates |
| Open FISCal (open.fiscal.ca.gov) | CKAN CSVs | Custom | LOW | 151 department CSVs per FY; not practical for totals |
| CA Open Data (data.ca.gov) | No Socrata endpoint | — | HIGH | Confirmed no SODA API for state budget |

**Recommendation:** Use LAO Excel for multi-year history (clean, machine-readable) + ebudget.ca.gov PDF for current-year program detail (pdfplumber — same pattern as existing CA cities). Do NOT attempt Open FISCal aggregation — engineering cost is disproportionate.

---

## Recommended Stack

### Core Technologies (already in use — no additions needed)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Node.js loader scripts | existing | Build 3-level JSON tree, call RPC | Logic change only |
| pdfplumber (Python) | existing | CA state budget PDF extraction | Same pattern as Anaheim, Santa Ana |
| openpyxl (Python) | existing | LAO Excel historical data | Same as Richardson XLSX loader |
| Supabase JS client | existing | Call `treasury_sync_budget_tree` RPC | RPC signature unchanged |
| React + BudgetIcicle.tsx | existing | Render N-level icicle | Zero changes needed |

### New Scripts (no new packages — new files only)

| Script | Purpose |
|--------|---------|
| `scripts/seedCaliforniaState.js` | Seeds municipality row (entity_type: 'state') + data_source rows |
| `scripts/loadCaliforniaState.js` | Builds 3-level tree, calls `treasury_sync_budget_tree` RPC |

### ev-accounts-api Changes (separate repo — no package additions)

| Change | Purpose |
|--------|---------|
| `treasury_sync_budget_tree` RPC update | Depth-adaptive walk: handles both 2-level (legacy) and 3-level trees |
| `/api/treasury/budgets/:id/categories` endpoint | GROUP BY (category, subcategory, department); 3rd level when department non-NULL |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| D3.js for icicle | BudgetIcicle.tsx already works with arbitrary depth | Existing component |
| Open FISCal CKAN aggregation | 151 CSVs × multiple FYs; massive engineering overhead | LAO Excel |
| Socrata `bulkLoadBudget.js` for CA state | No state-level Socrata endpoint exists | pdfplumber or XLSX |
| New `entity_type` DB column | Existing CHECK constraint modification is sufficient | ALTER TABLE migration |

---

## Required Schema Changes (no packages — pure SQL)

```sql
-- Migration: add 'state' to municipalities entity_type check constraint
ALTER TABLE treasury.municipalities
  DROP CONSTRAINT IF EXISTS municipalities_entity_type_check;
ALTER TABLE treasury.municipalities
  ADD CONSTRAINT municipalities_entity_type_check
  CHECK (entity_type IN ('city', 'county', 'township', 'nonprofit', 'state'));
```

No new columns needed in `budget_line_items` — the existing `department` column already provides the 3rd level slot.

---

## Sources

- Direct codebase inspection: `scripts/bulkLoadBudget.js`, `src/types/budget.ts`, `src/components/BudgetIcicle.tsx`
- Web research: confirmed no Socrata endpoint for CA state budget; ebudget.ca.gov and LAO sources verified
- Architecture research (ARCHITECTURE.md): confirmed `department` column availability + RPC contract

---
*Stack research for: v1.7 CA state budget + 3-level icicle hierarchy*
*Researched: 2026-06-06*
