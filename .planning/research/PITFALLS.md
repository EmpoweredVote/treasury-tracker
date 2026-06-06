# Pitfalls Research: v1.7 California State Budget + Deep Icicles

**Domain:** Adding state-level entity + 3-level budget tree to existing financial transparency app
**Researched:** 2026-06-06
**Confidence:** HIGH for codebase-derived pitfalls; MEDIUM for CA state data source specifics

---

## Critical Pitfalls

### Pitfall 1: No Socrata API for CA State Budget

**What goes wrong:**
Assuming `bulkLoadBudget.js` can be reused for CA state (as it was for LA, SF, Dallas) — it cannot. There is no Socrata/SODA endpoint for the California state government budget.

**Why it happens:**
The `bulkLoadStateController.js` script and CA city pattern make it natural to expect a state-level Socrata endpoint. The CA State Controller Socrata datasets (`ju3w-4gxp`, `rrtv-rsj9`) are city/county-level aggregates, not the state's own budget.

**How to avoid:**
Confirm data source before writing any loader. Use one of two confirmed paths:
- **ebudget.ca.gov Enacted Budget Summary PDF** — pdfplumber extraction, same pattern as existing CA cities
- **LAO historical Excel pivot table** — openpyxl loader, covers FY1985–FY2026 by department

**Warning signs:**
Any plan that references `bulkLoadBudget.js` or a Socrata dataset ID for CA state budget is wrong.

**Phase to address:** Phase 32 (CA state seed + data source confirmation)

---

### Pitfall 2: All-Funds CA State Budget Inflates Total ~2.5×

**What goes wrong:**
Loading California all-funds spending (~$495B) instead of General Fund (~$212B) makes the state total unrepresentative — ~$280B is federal pass-through (Medi-Cal, Title I education) and restricted special funds.

**Why it happens:**
Same inflation problem that affected LA, Fresno, Riverside, and Long Beach at city scale — enterprise/restricted funds dwarf General Fund spending. At state scale the ratio is even more extreme.

**How to avoid:**
Load General Fund only (~$212B) for v1.7. This is consistent with the GF-only policy applied to all existing cities and is comparable apples-to-apples. All-funds can be added as a second dataset in a future phase.

**Warning signs:**
If the loaded CA state total exceeds $250B, the wrong fund scope was used.

**Phase to address:** Phase 33 (CA state budget load)

---

### Pitfall 3: The RPC Contract Is the Real 3-Level Blocker

**What goes wrong:**
Updating city loaders to emit 3-level trees before the `treasury_sync_budget_tree` RPC is updated to handle them. The unmodified RPC either errors out or silently discards the 3rd level.

**Why it happens:**
Loader scripts look simpler to change than the ev-accounts-api RPC, so developers start there. But the RPC is the data contract — loaders are consumers, not producers, of the schema.

**How to avoid:**
Strict build order: schema migration → RPC update → API endpoint update → loader changes. No loader should be modified to emit 3-level trees until the RPC can accept them.

**The current tree shape (confirmed from bulkLoadBudget.js):**
```json
[{ "n": "Category", "a": 1000000, "c": [
    { "n": "Subcategory", "a": 500000, "i": [
        { "d": "Line item", "a": 250000 }
    ]}
]}]
```

**The 3-level shape required:**
```json
[{ "n": "Category", "a": 1000000, "c": [
    { "n": "Subcategory", "a": 500000, "c": [
        { "n": "Department", "a": 250000, "i": [
            { "d": "Line item", "a": 125000 }
        ]}
    ]}
]}]
```

**Key invariant:** A node has either `c` (children) OR `i` (items), never both.

**Warning signs:**
Any plan that modifies a city loader to emit 3 levels before confirming the RPC change is complete.

**Phase to address:** Phase 34 (RPC + API 3-level extension)

---

### Pitfall 4: API Backward Compatibility Break

**What goes wrong:**
Updating the `/api/treasury/budgets/:id/categories` endpoint to always return 3 levels, which breaks all existing city pages that only have 2 levels of data in the DB.

**Why it happens:**
The API update is done alongside the RPC update without considering that all current data in `budget_line_items.department` is NULL (or a repeated subcategory name) — not a meaningful 3rd level.

**How to avoid:**
The updated API must detect `department IS NULL` and fall back to returning `lineItems` directly on the subcategory node (the current behavior). This conditional branch is what enables backward compatibility:

```
if department IS NOT NULL:
    wrap in sub-subcategory node
else:
    return lineItems directly on subcategory (legacy behavior)
```

**Warning signs:**
After the API update, any existing city page shows an empty or broken icicle.

**Phase to address:** Phase 34 (RPC + API 3-level extension) — must include backward-compat test.

---

### Pitfall 5: EntitySwitcher "California > States > California" Circular Nesting

**What goes wrong:**
The California state entity (entity_type: 'state', state: 'CA') falls into the existing "California" state group in the entity picker, creating circular nesting: "California → States (1) → California."

**Why it happens:**
`EntitySwitcher.tsx` groups by `m.state`, then by `m.entity_type`. A CA state entity has `m.state = 'CA'`, so it naturally falls under the "CALIFORNIA" header — alongside the CA cities.

**How to avoid:**
Pre-filter state entities before building the `byState` map. Render them in a separate top section labeled "State Governments" above all state groups.

```typescript
const stateEntities = municipalities.filter(m => m.entity_type === 'state');
const nonStateEntities = municipalities.filter(m => m.entity_type !== 'state');
// Build grouped map from nonStateEntities only
```

**Warning signs:**
After seeding the CA state entity, the entity picker shows "California" nested inside "CALIFORNIA."

**Phase to address:** Phase 32 (schema + entity_type extension includes EntitySwitcher fix)

---

### Pitfall 6: Retrofitting Cities Whose Source Data Has No Natural 3rd Level

**What goes wrong:**
Retrofitting all 30+ city loaders to emit 3 levels when most city source data (pdfplumber CA PDFs, Socrata TX cities) only has 2 meaningful levels: Department → Line Item. The "3rd level" would be a synthetic grouping (e.g., Personnel / Operations / Capital) not actually in the source data.

**Why it happens:**
The milestone goal says "retrofit all existing cities" — but this was scoped assuming city sources have 3 levels. Many don't. Forcing a synthetic 3rd level adds noise without adding information.

**How to avoid:**
Audit source data before committing to full retrofit. The realistic policy: retrofit only cities where the source data genuinely has a 3rd level of granularity. For most CA PDF cities, the data is `department → line item` (effectively already 2 levels). For Dallas Socrata or SF Socrata, the source may have program codes that provide a natural 3rd level.

**Warning signs:**
A city's 3rd-level nodes all have generic names like "Personnel", "Operations" — indicating synthesized grouping, not source data.

**Phase to address:** Phase 35 (retrofit pilot) — confirm viability before full retrofit

---

### Pitfall 7: Enrichment Prompt Mismatch for State-Level Categories

**What goes wrong:**
Running `enrichCategories.js` for CA state with the default prompt, which describes "what this city department does for residents." For state-level program areas (Health & Human Services, Education, Corrections), the city-framing is wrong and produces inaccurate or awkward descriptions.

**Why it happens:**
`enrichCategories.js` has a hardcoded prompt tuned for city/county departments. State program categories are policy-level, not operational-level.

**How to avoid:**
Add a `--entity-type state` flag (or `--prompt-type state`) to `enrichCategories.js` that switches the prompt to state-level framing: "What does this California state program fund and how does it benefit California residents?"

**Warning signs:**
Enrichment descriptions say "the department handles..." or "residents can contact..." for a category like "Health and Human Services" — city-level framing applied to a state program.

**Phase to address:** Phase 33 (CA state budget load + enrichment)

---

### Pitfall 8: `department` Column Current State Unknown

**What goes wrong:**
The RPC update writes to `budget_line_items.department` assuming it's currently NULL for all 2-level rows — but it might already be populated with subcategory names echoed from existing loaders.

**Why it happens:**
The ARCHITECTURE research inferred from script patterns; the actual column values in the DB were not confirmed with a live query.

**How to avoid:**
Before writing the RPC update, run:
```sql
SELECT category, subcategory, department, description
FROM treasury.budget_line_items LIMIT 20;
```
Confirm what `department` currently holds. If it's non-NULL, the backward-compat branch in the updated API must account for this.

**Phase to address:** Phase 34 (RPC + API update) — day 1 inspection step

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Retrofit cities with synthetic 3rd level | Fast "all cities have 3 levels" | Misleading data; confused users | Never |
| All-funds CA state vs GF only | More data | $250B+ inflation; destroys comparability | Never for v1.7 |
| Hard-coded depth=2 in API assembly | Simpler code | Future 4-level support requires rewrite | Never — use conditional grouping |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase |
|---------|-----------------|
| No CA state Socrata API | Phase 32 — confirm source before any loader work |
| All-funds inflation | Phase 33 — GF scope decision in data source config |
| RPC contract blocker | Phase 34 — RPC update before any loader changes |
| API backward compat break | Phase 34 — conditional department IS NULL branch |
| EntitySwitcher circular nesting | Phase 32 — EntitySwitcher fix in same phase as schema migration |
| Retrofit without source data audit | Phase 35 — pilot confirms viability before full Phase 36 |
| Enrichment prompt mismatch | Phase 33 — state-level prompt variant added to enrichCategories.js |
| department column current state | Phase 34 — day 1 DB inspection step |

---
*Pitfalls research for: v1.7 CA state budget + 3-level icicle hierarchy*
*Researched: 2026-06-06*
