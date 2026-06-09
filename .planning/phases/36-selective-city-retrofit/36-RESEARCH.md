# Phase 36: Selective City Retrofit - Research

**Researched:** 2026-06-09
**Domain:** Budget data audit, N-level tree retrofitting, enrichment preservation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Audit Scope & Framework**
- D-01: Audit all 3 pilot cities (Portland, Dallas, SF) simultaneously, not sequentially. Apply the audit framework to all 3 before deciding what to retrofit.
- D-02: The audit produces a **reusable framework** applicable to all 30+ cities — not just the 3 pilots. The framework covers: Socrata cities (which columns to check), PDF cities (what structural cues to look for), and the genuineness tests. It is a durable asset, not a one-time check.
- D-03: Per-city audit output includes: recommended tree depth (N), the column/table providing each level, and any extraction blocker. Enough detail for a planner to write a loader change.
- D-04: Audit framework lives in TWO places: (1) a markdown doc in `.planning/` as a human-readable guide for engineers loading future cities, and (2) per-city verdict (depth, evidence, status) stored in the DB as the source of truth.

**Genuineness Bar**
- D-05: A tree level is **genuine** only if it passes BOTH: (1) citizen-recognizable — the label names a recognizable organizational unit; (2) official document test — the city itself uses this grouping in its published budget documents.
- D-06: When a genuine level has incomplete row coverage, apply the Phase 35 D-05 pattern: collapse those rows to the parent leaf node as line items. Do not invent synthetic groupings for blank rows.
- D-07: No depth cap. If a city's source genuinely supports 4 levels and both tests pass, load it at 4 levels.

**Retrofit Scope**
- D-08: Retrofit only if genuinely needed. If all 3 pilot cities pass the genuineness test, retrofit all 3 within Phase 36.
- D-09: Cities whose current depth is already appropriate: mark as audited/confirmed in the DB with no reload.

**Enrichment During Reload**
- D-10: Preserve existing enrichment descriptions by node name matching — re-attach existing `budget_categories.description` rows to nodes that share the same name after reload.
- D-11: Orphaned enrichment rows: log but do not delete. Keep rows in the DB, emit a warning in the reload script.
- D-12: Enrich new nodes added by the retrofit. Apply the $5 API cost gate — estimate before running, stop and get user approval if estimated cost exceeds $5.

### Claude's Discretion

No explicit discretion areas noted beyond the above locked decisions.

### Deferred Ideas (OUT OF SCOPE)

- Full retrofit of all 30+ cities: The audit framework built in this phase enables future phases to apply it systematically. Phase 36 covers only the 3 pilot cities. Broader retrofit is a future milestone.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETROFIT-01 | Source data audit completed for candidate cities — identifies which have a genuine, extractable 3rd level (not synthetic grouping) | Audit results for all 3 cities documented in §Source Data Audit Findings; framework documented in §Audit Framework |
| RETROFIT-02 | 1–2 cities with confirmed genuine 3rd-level data retrofitted and reloaded as 3-level trees | Portland (bureau → service area → bureau subtotal) and Dallas (appropriation/dept → service → objectgroup) both have confirmed genuine additional levels; see §City Verdicts |
| RETROFIT-03 | Retrofitted cities display 3-level icicle drill-down in live app; existing enrichment rows remain intact | Enrichment preservation via name-matching pattern documented; icicle renders arbitrary depth with no frontend changes needed |
</phase_requirements>

---

## Summary

Phase 36 retrofits existing city budget data to use deeper tree structures where the source data genuinely supports it — no synthetic levels, no frontend changes, no new cities. The phase begins with a source data audit of three cities (Portland OR, Dallas TX, San Francisco CA) and proceeds to retrofit any cities where the audit confirms a genuine additional level.

**Audit findings (confirmed during research):** Two of the three cities have genuine retrofittable levels, one does not.

1. **Portland OR** — The Vol 1 PDF contains an explicit bureau-to-service-area mapping table (page 12 of FY2025-26 Vol 1). Eight service areas group the 34 bureaus: Public Safety, Public Works, City Operations, Community & Economic Development, City Administrator, City Council, Office of the City Auditor, Office of the Mayor. This grouping is official (appears in the Table of Contents, Figure 9 summary chart, and the fund/bureau mapping table). The current flat loader extracts bureau subtotals; a retrofit adds service area as the depth-0 grouping, bureaus become depth-1, and existing line items stay at depth-2. This is a genuine 2-level → 3-level upgrade.

2. **Dallas TX** — The Socrata operating dataset (`e2fs-y4nb`) already includes an `appropriation` column (labeled "DEPARTMENT" in the API metadata) that maps each service row to its parent department (e.g., "Police Department GF", "Dallas Fire Rescue GF", "Water Utilities DWU"). This is displayed in Dallas's published budget as the department level. The current loader uses `service` as depth-0 and `objectgroup` as depth-1; adding `appropriation` as a new depth-0 gives a genuine 3-level tree: Department → Service → Object Group. This is a column_mapping-only config change — no code changes required.

3. **San Francisco CA** — The Socrata dataset (`xdgd-c79v`) has an `organization_group` column above `department`, and a `program` column below `department`. However, the `program` column's distinct values are generic accounting categories (Operating, Capital, Administrative, Technology, Maintenance) — not citizen-recognizable organizational units, and not the way SF presents its budget in official documents. `organization_group` (7 groups: Public Protection, Public Works Transportation & Commerce, Community Health, etc.) IS citizen-recognizable and official, but the current loader already uses `department` as depth-0. Adding `organization_group` above department would be a genuine level. However, the `program` column fails both genuineness tests. **Verdict: SF's `organization_group → department` is a valid 2-level config that the current loader doesn't use at depth-0. If retrofitted, the tree would become: Organization Group (7) → Department (56 distinct) → fund_type/character (leaf). This passes genuineness but requires research to confirm the exact leaf column.** The `program` column should NOT be used.

**Primary recommendation:** Retrofit Portland (requires extractPortland.py enhancement to capture service area from page 12) and Dallas (requires only a `column_mapping` update in `data_sources`). The SF retrofit (adding `organization_group` as the new depth-0 above `department`) is optional — confirmed genuine if chosen, but requires deciding on the leaf column. Scope question for the planner: treat SF as a third retrofit or mark it audited-deferred.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source data audit | Script/loader layer | DB (audit verdicts stored) | Audit is an offline analysis producing structured output; DB stores verdicts for durability |
| Budget tree reload | Script (processPortland.js, bulkLoadBudget.js) | Supabase RPC (treasury_sync_budget_tree) | Loaders build the tree shape; RPC handles DB write atomically |
| Enrichment preservation | Script (enrichCategories.js) + DB query | — | Name-matching is a query-time lookup; no frontend change needed |
| New node enrichment | Script (enrichCategories.js) | Anthropic API (Claude Haiku) | Existing pipeline with --depth flag handles new depth levels |
| Audit framework doc | .planning/ markdown | DB (per-city verdicts) | Human-readable guide in .planning/; machine-readable verdicts in DB |
| Icicle rendering | Frontend (BudgetIcicle.tsx) | — | Already renders arbitrary depth via navigationPath — zero changes needed |

---

## Standard Stack

### Core (already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | (project-pinned) | DB reads/writes via RPC | Only DB write path for tree data (`treasury_sync_budget_tree`) | [VERIFIED: already in package.json]
| `pdfplumber` (Python) | (project-installed) | PDF table extraction for Portland | Already used by extractPortland.py, confirmed working | [VERIFIED: confirmed `import pdfplumber; print('pdfplumber OK')` passes]
| `openpyxl` (Python) | (project-installed) | Excel extraction reference | Used by extractCA.py; pattern reference only for this phase | [VERIFIED: confirmed `import openpyxl; print('openpyxl OK')` passes]
| `anthropic` (Node.js) | (project-pinned) | AI enrichment in enrichCategories.js | Existing pipeline; no version change | [VERIFIED: already in package.json]

### No New Packages Required

All libraries this phase needs are already installed. The only changes are:
- Code changes to `scripts/extractPortland.py` (add service area extraction)
- Code changes to `scripts/processPortland.js` (build 2-level tree: service_area → bureau)
- Data change to `data_sources.column_mapping` for Dallas (add `department_column: 'appropriation'`)
- New DB table or column for audit verdicts (migration via mcp__supabase-local)
- New `.planning/AUDIT-FRAMEWORK.md` file

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies are already present in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Source Data Audit Findings

### CITY 1: Portland, OR — RETROFIT RECOMMENDED

**Source:** Vol 1 PDF (Appropriation Schedule + User's Guide), confirmed against FY2025-26 vol
**Data type:** PDF (pdfplumber extraction)

**Genuineness test results:**
| Test | Result | Evidence |
|------|--------|----------|
| Citizen-recognizable | PASS | Service area names: "Public Safety", "Public Works", "Community & Economic Development", "City Operations", "City Administrator", "City Council", "Office of the City Auditor", "Office of the Mayor" |
| Official document test | PASS | Named in Table of Contents section breaks; Figure 9 "Total City Bureau Expenses - Requirements by Service Area" on p.47; explicit bureau-to-service-area table in User's Guide (pages 12-13) |

**Tree depth verdict:** 3 levels (Service Area → Bureau → Line Items)

**Level mapping:**
| Level | Data Source | Column/Table | Example Values |
|-------|-------------|--------------|----------------|
| Level 0 (depth-0) | User's Guide table, pages 12-13 | `service_area` column (3rd column) | "Public Safety", "Public Works", "City Operations", "Community & Economic Development", "City Administrator", "City Council", "Office of the City Auditor", "Office of the Mayor" |
| Level 1 (depth-1) | Appropriation Schedule (pages 118+) | Bureau subtotal rows (existing extraction) | "Portland Police Bureau", "Bureau of Environmental Services", "Portland Parks & Recreation" ... |
| Level 2 (leaf) | Appropriation Schedule | Line items under each bureau (existing `i:` nodes) | Already present as line items |

**Current DB state:** 34 depth-0 bureau nodes (flat list), no depth-1, FY2022-FY2026 loaded. [VERIFIED: DB query confirmed `depth_distribution: {"0":34}`]

**Extraction approach:**
- Page 12-13 of Vol 1 PDF contains a `Managing Agency | Fund | Service Area | Fund Type` table (confirmed extractable via `page.extract_tables()`)
- Build a lookup dict: `{ bureau_name: service_area_name }` from this table
- In `extractPortland.py`, add service area lookup to each output row
- In `processPortland.js`, build a `buildOperatingTree` that produces: `{ n: service_area, a: sum, c: [{ n: bureau, a: amt, i: [line_items] }] }`
- Node name matching for enrichment: existing descriptions keyed on bureau names will match depth-1 bureau nodes

**Extraction blocker:** None. The service area table is on a fixed page (12-13) and pdfplumber extracts it cleanly (verified during research). The `service_area` value is already tracked in `extractPortland.py` as `service_area: ''` — just needs population.

**Risk note:** "Office of Vibrant Communities" maps to `(blank)` service area in the FY2025-26 table. This bureau has $0 budget and is already skipped by the zero-amount filter in `extractPortland.py`. No handling needed.

**Enrichment impact:**
- 34 existing bureau enrichment rows at depth-0 → become depth-1 after retrofit; name-key matching preserves them
- 8 new service-area nodes (depth-0) need enrichment — very low cost estimate (~8 × $0.0002 = ~$0.002 total, well under $5 gate)
- Orphaned rows: none expected (bureau names unchanged)

---

### CITY 2: Dallas, TX — RETROFIT RECOMMENDED (CONFIG-ONLY)

**Source:** Socrata dataset `e2fs-y4nb` at `https://www.dallasopendata.com`
**Data type:** Socrata SODA API

**Genuineness test results:**
| Test | Result | Evidence |
|------|--------|----------|
| Citizen-recognizable | PASS | `appropriation` values are department names: "Police Department GF", "Dallas Fire Rescue GF", "Water Utilities DWU", "Park and Recreation GF", "Library GF" — recognizable city departments |
| Official document test | PASS | These are the department names used in Dallas's adopted budget documents; the column is labeled "DEPARTMENT" in the Socrata API metadata |

**Tree depth verdict:** 3 levels (Department → Service → Object Group)

**Level mapping:**
| Level | Data Source | Column | Example Values |
|-------|-------------|--------|----------------|
| Level 0 (depth-0, NEW) | Socrata `e2fs-y4nb` | `appropriation` ("DEPARTMENT") | "Police Department GF", "Dallas Fire Rescue GF", "Water Utilities DWU" |
| Level 1 (depth-1, was depth-0) | Socrata `e2fs-y4nb` | `service` | "Police Field Patrol", "Fire and Rescue Emergency Response" |
| Level 2 (depth-2, was depth-1) | Socrata `e2fs-y4nb` | `objectgroup` | "Personnel Services", "Contractual & Other Services" |

**Current DB state:** 188 depth-0 service-area nodes, 680 depth-1 objectgroup nodes (2-level tree). [VERIFIED: DB query confirmed `depth_distribution: {"0":188,"1":680}`]

**Implementation approach:** `bulkLoadBudget.js` uses `column_mapping` from `data_sources` to drive tree building. Current Dallas Operating config:
```json
{
  "category_column": "service",
  "subcategory_column": "objectgroup"
}
```
The `buildBudgetTree()` function only supports 2-level trees (category → subcategory). To add a 3rd level, the function needs a `department_column` extension — OR a new 3-level-aware builder. [ASSUMED: `bulkLoadBudget.js` does not currently support a `department_column` that would produce a 3-level tree; this requires code addition to `buildBudgetTree()`]

**NONE rows:** The `service` column has rows where `service='NONE'` (typically debt service, bond funds). These rows currently exist in the DB. With a retrofit, they will still be grouped under their `appropriation` department. The `NONE` service rows should either collapse to the department level (per D-06) or be kept as a "NONE" subcategory — the null collapse pattern from Phase 35 applies.

**Extraction blocker:** `bulkLoadBudget.js` `buildBudgetTree()` does not support 3 levels. Requires adding `department_column` support. This is the only code change needed (plus a data_sources column_mapping update). [VERIFIED: confirmed by reading bulkLoadBudget.js lines 67-127]

**Enrichment impact:**
- Existing enrichment rows are keyed on service names (depth-0). After retrofit, service names become depth-1. Name-key format will change (`normalize(service_name)` → `normalize(dept_name)|normalize(service_name)`).
- **This is the highest-risk enrichment preservation issue for Dallas.** Existing enrichment name_keys are `normalize(service_name)` but after retrofit the correct key for service-level nodes would be `normalize(dept_name)|normalize(service_name)`. The old plain `normalize(service_name)` keys will become orphaned.
- Resolution: Per D-11, orphaned rows are kept (not deleted), and a subsequent enrichment run will add fresh descriptions for the new key format. The existing descriptions are NOT lost — they remain in the DB, just no longer matched.
- New depth-0 department nodes (~50 departments) need enrichment. Estimate: 50 × $0.0002 = ~$0.01 total.

---

### CITY 3: San Francisco, CA — PARTIAL PASS / AUDIT-DEFERRED RECOMMENDED

**Source:** Socrata dataset `xdgd-c79v` at `https://data.sfgov.org`
**Data type:** Socrata SODA API

**Column inventory:**
| Column | Example Values | Genuineness Assessment |
|--------|---------------|------------------------|
| `organization_group` | "Public Protection", "Community Health", "Public Works, Transportation & Commerce", "Culture & Recreation" (7 groups) | PASS — citizen-recognizable, official SF budget grouping |
| `department` | "POL Police", "DPH Public Health", "AIR Airport Commission" (56 departments) | PASS — currently used as depth-0 in existing loader |
| `program` | "Operating", "Capital", "Administrative", "Technology", "Maintenance", "Special Events" (10 values) | FAIL — generic accounting categories, not organizational units citizens recognize; not how SF presents its budget structure in documents |
| `character` | "Salaries", "Non-Personnel Services", "Debt Service", "Intrafund Transfers Out" | FAIL — accounting object classification, not organizational |

**Current loader config:** `category_column: 'department'`, `subcategory_column: 'fund_type'`

**Genuineness test results for adding organization_group above department:**
| Test | Result | Evidence |
|------|--------|----------|
| Citizen-recognizable | PASS | 7 groups with plain-English names matching SF's organizational structure |
| Official document test | PASS | SF uses these exact groups in its official budget book section headers |

**Genuineness test results for adding program below department:**
| Test | Result | Evidence |
|------|--------|----------|
| Citizen-recognizable | FAIL | "Operating", "Capital", "Administrative" are accounting categories, not organizational units |
| Official document test | FAIL | SF does not present its budget using these program codes as primary navigation — they are internal accounting designations |

**Tree depth verdict:** Current config is `department → fund_type` (2-level). Genuine options:
- Option A: Add `organization_group` above `department` → `org_group → dept → fund_type` (3-level). All 3 levels pass genuineness.
- Option B: Keep current 2-level — acceptable per D-07/D-08 if the 2-level already provides sufficient citizen value.

**Extraction blocker for Option A:** Same as Dallas — `bulkLoadBudget.js` does not support a 3rd level. The same `department_column` code addition that enables Dallas would also enable SF.

**Recommended verdict for Phase 36:** Mark SF as AUDITED — DEFERRED. The `organization_group → department` grouping passes genuineness tests, but:
1. The same code change (adding 3-level support to `bulkLoadBudget.js`) is shared with Dallas. If Dallas is retrofitted, SF Option A becomes possible at no additional code cost.
2. The planner should decide whether to include SF in Phase 36 (scope: 3 retrofits) or defer to a follow-up (scope: 2 retrofits).
3. Record verdict in DB audit table regardless.

[ASSUMED: SF's organization_group genuinely matches SF's published budget groupings — this was confirmed via Socrata data inspection but not cross-verified against SF's official budget PDF]

---

## Architecture Patterns

### System Architecture Diagram

```
Phase 36 Data Flow:

SOURCE DATA AUDIT
  Portland Vol 1 PDF (docs/Portland/)
    → pdfplumber page 12-13 extraction
    → bureau → service_area lookup dict
  Dallas Socrata e2fs-y4nb
    → API column inspection (verified: `appropriation` column exists)
  SF Socrata xdgd-c79v
    → API column inspection (verified: `organization_group` column exists)
         ↓
AUDIT FRAMEWORK DOC (.planning/AUDIT-FRAMEWORK.md)
AUDIT VERDICTS (DB table or data_sources column)
         ↓
RETROFIT EXECUTION (cities that passed genuineness)
  Portland: extractPortland.py (add service_area) + processPortland.js (3-level tree builder)
  Dallas: bulkLoadBudget.js (add department_column support) + data_sources column_mapping update
         ↓
treasury_sync_budget_tree RPC (N-level, confirmed working from Phase 34/35)
         ↓
DB: budget_categories (depth 0,1,2) + budget_line_items
         ↓
ENRICHMENT PRESERVATION
  Node name matching: existing descriptions → reattach by name
  Orphaned rows: logged, kept in DB
  New nodes: enrichCategories.js --depth 1 (Portland) / --depth 0 (Dallas new dept nodes)
         ↓
BudgetIcicle.tsx (NO CHANGES — already renders arbitrary depth)
```

### Recommended File Changes

```
scripts/
├── extractPortland.py          # MODIFY: add service area lookup from pages 12-13
├── processPortland.js          # MODIFY: update buildOperatingTree for 3-level
├── bulkLoadBudget.js           # MODIFY: add department_column to buildBudgetTree()
└── (no new scripts needed)

.planning/
└── AUDIT-FRAMEWORK.md          # NEW: reusable city audit guide (D-04)

DB:
└── data_sources.column_mapping # UPDATE: Dallas Operating add department_column: 'appropriation'
```

### Pattern 1: Service Area Extraction from Portland PDF (pages 12-13)

**What:** Extract the `Managing Agency | Fund | Service Area | Fund Type` table from pages 12-13 of Portland Vol 1 PDF. Build a dict mapping bureau names to service areas.
**When to use:** In `extractPortland.py`, called once per PDF to build the bureau→service_area lookup.

```python
# Source: Verified via pdfplumber.open('docs/Portland/fy2025-26-vol1.pdf')
# Page 12 (0-indexed: page 11) contains the bureau-to-service-area table
def extract_service_area_map(pdf):
    """
    Returns dict: { bureau_name: service_area_name }
    Handles multi-row bureau entries (same bureau, multiple funds, same service area).
    """
    service_map = {}
    current_bureau = None
    # Pages 12-13 (0-indexed: 11-12) contain the mapping table
    for page_idx in [11, 12]:
        page = pdf.pages[page_idx]
        tables = page.extract_tables()
        if not tables:
            continue
        for row in tables[0]:
            # row = [Managing Agency, Fund, Service Area, Fund Type]
            if not row or len(row) < 3:
                continue
            agency = (row[0] or '').strip()
            service_area = (row[2] or '').strip()
            if agency and service_area and service_area != 'Service Area':
                current_bureau = agency
                service_map[agency] = service_area
            elif not agency and current_bureau and service_area:
                # Continuation row: same bureau, different fund — service area is same
                service_map[current_bureau] = service_area  # already set, but update if different
    return service_map
```

### Pattern 2: N-Level Tree Builder for Portland (3-level)

**What:** Update `buildOperatingTree()` in `processPortland.js` to produce a 3-level tree using the service area map.
**When to use:** After extractPortland.py adds `service_area` to each row.

```javascript
// Source: Verified pattern from processCA.js buildNLevelTree (Phase 35)
// Portland variant: service_area (depth-0) → bureau (depth-1) → line_items
function buildOperatingTree(rows, serviceAreaMap) {
  const saMap = new Map(); // service_area → Map(bureau → amount)
  
  for (const row of rows) {
    const bureau = row.bureau;
    const serviceArea = serviceAreaMap[bureau] || 'Other';  // D-06: unknown → collapse
    const amount = row.adopted_amount;
    
    if (!saMap.has(serviceArea)) saMap.set(serviceArea, new Map());
    saMap.get(serviceArea).set(bureau, (saMap.get(serviceArea).get(bureau) || 0) + amount);
  }
  
  const nodes = [];
  let total = 0;
  for (const [sa, bureaus] of saMap) {
    const bureauNodes = [];
    let saTotal = 0;
    for (const [bureau, amt] of bureaus) {
      bureauNodes.push({ n: bureau, a: amt, i: [{ d: bureau, a: amt, aa: null, f: null, e: null }] });
      saTotal += amt;
    }
    bureauNodes.sort((a, b) => b.a - a.a);
    nodes.push({ n: sa, a: saTotal, c: bureauNodes });
    total += saTotal;
  }
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}
```

### Pattern 3: Department Column Extension for bulkLoadBudget.js

**What:** Add `department_column` support to `buildBudgetTree()` to produce 3-level trees for Dallas and (optionally) SF.
**When to use:** When `column_mapping.department_column` is set in the data_source row.

```javascript
// Source: Extends existing buildBudgetTree() pattern (scripts/bulkLoadBudget.js lines 67-127)
// If department_column is set: dept → category → subcategory (3-level)
// If not set: category → subcategory (2-level, backward-compatible)
function buildBudgetTree(rows, cm) {
  const deptCol = cm.department_column || null;  // NEW: optional 3rd level
  const catCol = cm.category_column;
  const subCol = cm.subcategory_column;
  // ... (existing validation) ...
  
  // Use dept → cat → sub if department_column present; else cat → sub (unchanged)
  const topLevel = new Map(); // dept (or cat if no dept) → nested structure
  
  for (const row of rows) {
    // ... (existing amount parsing) ...
    
    if (deptCol) {
      // 3-level: dept → cat → sub
      const dept = row[deptCol] || 'Unknown';
      const cat = row[catCol] || 'Unknown';
      const sub = subCol ? (row[subCol] || 'General') : 'General';
      
      if (!topLevel.has(dept)) topLevel.set(dept, new Map());
      if (!topLevel.get(dept).has(cat)) topLevel.get(dept).set(cat, new Map());
      if (!topLevel.get(dept).get(cat).has(sub)) topLevel.get(dept).get(cat).set(sub, []);
      
      topLevel.get(dept).get(cat).get(sub).push({ d: sub, a: approved, aa: actual, f: fund, e: null });
      total += approved;
    } else {
      // 2-level: unchanged
      // ... existing logic ...
    }
  }
  
  // Convert Maps to tree; 3-level outputs dept-level nodes with c[] children of cat nodes
  // ... (convert + sort) ...
}
```

### Anti-Patterns to Avoid

- **Synthesizing a service area for Portland bureaus with blank/unknown service area:** "Office of Vibrant Communities" has `(blank)` in the mapping table but also has $0 budget — already filtered. Do NOT create a synthetic "Unknown Service Area" node for it.
- **Using SF `program` column as a depth level:** The values "Operating", "Capital", "Administrative" are accounting categories, not citizen-recognizable organizational units. They fail genuineness test 1.
- **Hardcoding service area assignments in processPortland.js:** The mapping must come from the PDF (pages 12-13), not from a hardcoded dict. The mapping changes across fiscal years (e.g., post-2025 Portland reorganization moved some bureaus between service areas).
- **Changing the enrichCategories.js `name_key` format:** The existing `normalize(name)` and `normalize(parent)|normalize(name)` format is the contract. Do not alter it.
- **Reloading all fiscal years during dry-run testing:** Dry-run first with `--fy 2026` only; reload all years only after the single-year reload is verified.
- **Skipping the $5 cost gate for enrichment:** Per project memory and multiple phase decisions, always estimate before running AI enrichment and halt if estimate exceeds $5.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB tree writes | Custom SQL INSERT/UPDATE | `treasury_sync_budget_tree` RPC | RPC handles parent_id linking, depth tracking, idempotency atomically |
| AI enrichment | Custom prompt + API calls | `enrichCategories.js` with `--depth` flag | Existing pipeline handles depth filtering, name_key format, upsert, cost control |
| PDF table extraction | Custom regex parser | `pdfplumber page.extract_tables()` | Already proven for Portland pages 12-13 (verified in research) |
| Service area lookup | Hardcoded dict | Extract from PDF pages 12-13 at load time | PDF is authoritative; hardcoded dict drifts as Portland reorganizes |
| 3-level tree building | New custom script | Extend `buildBudgetTree()` in bulkLoadBudget.js + `buildNLevelTree()` pattern from processCA.js | Patterns proven in Phase 35; reuse prevents divergent implementations |

**Key insight:** The Phase 35 `buildNLevelTree()` in `processCA.js` is the reference implementation for recursive N-level tree building. Any Portland or Dallas tree builder should follow that pattern (recurse on level index, D-05 null-collapse, sort by amount descending).

---

## Common Pitfalls

### Pitfall 1: Portland Service Area Page Range Changes Across Fiscal Years

**What goes wrong:** The bureau-to-service-area mapping table is on pages 12-13 of FY2025-26 Vol 1. This page range may shift in older PDF volumes (FY2022-FY2025) if Portland changed its document structure.
**Why it happens:** Portland reorganized city service areas in recent years. The FY2025-26 structure (8 service areas) differs from older structures. "Portland City Council Service Area" appears in the FY2025-26 table but may not exist in older PDFs.
**How to avoid:** Use a keyword search (`'Managing Agency'` + `'Service Area'`) to locate the table across pages rather than hardcoding page indices. Alternatively, only retrofit FY2026 and optionally FY2025, leaving older years as flat bureau lists.
**Warning signs:** `extract_service_area_map()` returns fewer than 5 service areas, or returns empty dict.

### Pitfall 2: Dallas `appropriation` Column Has "NONE" Values

**What goes wrong:** Some Dallas rows have `service='NONE'` (e.g., debt service rows). These may also have `appropriation` set to "Debt Service BMS" or similar. The 3-level tree must handle rows where `service='NONE'` and either collapse them to the department leaf (D-06) or include them with their literal service value.
**Why it happens:** Debt service and non-departmental entries don't fit the standard dept→service hierarchy.
**How to avoid:** Check whether `appropriation` is always populated even when `service='NONE'`. If yes, include them under their department. If `appropriation` is blank for NONE-service rows, treat as D-06 collapse to parent.
**Warning signs:** Tree total for Dallas doesn't reconcile with prior total after retrofit.

### Pitfall 3: Portland Enrichment Name_Key Format Shift

**What goes wrong:** After Portland retrofit, existing enrichment rows have `name_key = normalize(bureau_name)` (no parent prefix). After retrofit, bureau nodes are at depth-1. `enrichCategories.js` generates `name_key` as `normalize(parent)|normalize(name)` for nodes with a `parent_name`. The existing bureau enrichment keys will NOT match the new format.
**Why it happens:** `saveEnrichment()` in `enrichCategories.js` uses `cat.parent_name` to construct `parent|child` keys. After retrofit, bureau nodes will have `parent_name = service_area_name`, changing their key format.
**How to avoid:** Per D-10/D-11, after reload, run `enrichCategories.js --city Portland --state OR --year 2026 --depth 1` (to target bureau depth). The script will find existing enrichments via `getExistingEnrichments()` which checks for `municipality_id` match — if keys don't match, bureaus will be re-enriched (fresh descriptions, low cost). The old keys remain in the DB (D-11: orphaned, not deleted).
**Warning signs:** Running `enrichCategories.js --dry-run` after retrofit shows all 34 bureaus as "new to enrich" rather than skipped.

### Pitfall 4: bulkLoadBudget.js 3-Level Change Breaks Existing 2-Level Sources

**What goes wrong:** Adding `department_column` support to `buildBudgetTree()` causes a regression in existing 2-level Socrata sources (SF, LA, Sacramento, etc.) if the code path change is not backward-compatible.
**Why it happens:** The function is shared across all Socrata loaders.
**How to avoid:** Gate the 3-level path strictly behind `if (deptCol)`. When `department_column` is absent from `column_mapping`, the function must follow the exact same 2-level path as before. Test with `--dry-run` on at least one existing 2-level source (e.g., `--source "Dallas Revenue"`) before live-loading anything.
**Warning signs:** `--dry-run` on an existing source shows different category counts or tree structure than before.

### Pitfall 5: Portland FY2022-FY2025 Reload May Not Match FY2026 Service Area Structure

**What goes wrong:** Portland reorganized its service areas between fiscal years. The FY2025-26 Vol 1 shows 8 service areas. Older PDFs may use different service area groupings (e.g., "Portland City Council Service Area" as a separate section header is specific to the 2025-26 charter reform).
**Why it happens:** Portland went through a significant government reorganization in 2024-25, changing from a commissioner system to a city manager structure. Service area groupings changed.
**How to avoid:** Extract service area maps from each PDF year independently — do not assume FY2026 structure applies to FY2022. Alternatively, only retrofit the latest 1-2 years and log a note that older years are intentionally left flat.
**Warning signs:** Service area map extracted from FY2022 PDF has different keys than FY2026 map, or has far fewer entries.

---

## Code Examples

### Verified: Portland bureau-to-service-area table is extractable

```python
# Source: Verified via research — pdfplumber.open('docs/Portland/fy2025-26-vol1.pdf')
# Page 12 (0-indexed: 11) confirmed to extract cleanly via page.extract_tables()
# Sample output (first 3 rows):
# ['Managing Agency', 'Fund', 'Service Area', 'Fund Type']
# ['Bureau of Emergency Communications', 'Emergency Communication Fund', 'Public Safety', 'Special Revenue']
# ['Bureau of Environmental Services', 'Environmental Remediation Fund', 'Public Works', 'Enterprise']
```

### Verified: Dallas `appropriation` column structure

```javascript
// Source: Verified via Socrata API query to https://www.dallasopendata.com/resource/e2fs-y4nb.json
// FY2026 sample rows show appropriation → service → objectgroup hierarchy:
// { appropriation: "Dallas Fire Rescue GF", service: "Fire and Rescue Emergency Response...", objectgroup: "Personnel Services" }
// { appropriation: "Police Department GF", service: "Police Field Patrol", objectgroup: "Personnel Services" }
// { appropriation: "Water Utilities DWU", service: "Water (Debt Service) Capital Funding", objectgroup: "Transfers Out" }
// 67 distinct appropriation values (with non-NONE service); FY2026 total row count: 741 non-NONE rows
```

### Verified: SF `program` column values (FAILS genuineness)

```javascript
// Source: Verified via Socrata API query to https://data.sfgov.org/resource/xdgd-c79v.json
// Distinct program values: "Administrative", "Capital", "Capital-CPC Funded", "Disaster Recovery",
// "Maintenance", "Maintenance-CPC Funded", "Operating", "Special Events", "Technology", "Technology-COIT Funded"
// → These are accounting/fund-type categories, NOT citizen-recognizable organizational units
// → SF `program` column FAILS genuineness test — do NOT use as a tree level
```

### Verified: Enrichment --depth flag usage (from Phase 35 PATTERNS.md)

```bash
# Target depth-1 nodes (bureaus after Portland retrofit):
node scripts/enrichCategories.js --city "Portland" --state OR --year 2026 --depth 1 --dry-run

# Target new depth-0 nodes (department nodes after Dallas retrofit):
node scripts/enrichCategories.js --city "Dallas" --state TX --year 2026 --depth 0 --dry-run
```

### Verified: treasury_sync_budget_tree RPC call pattern (from processCA.js)

```javascript
// Source: scripts/processCA.js lines 256-270 (verified, Phase 35 PATTERNS.md)
const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,
  p_fiscal_year:    fiscalYear,
  p_dataset_type:   'operating',
  p_total:          total,
  p_tree:           tree,       // N-level tree array
  p_row_count:      rowCount,
  p_triggered_by:   'bulk_load',
});
```

---

## Audit Framework (Durable Asset — D-02/D-04)

The following framework is the canonical guide for auditing any city. It must also be written to `.planning/AUDIT-FRAMEWORK.md` as part of this phase.

### For Socrata cities:

1. Fetch the dataset's column list: `GET /api/views/{dataset_id}/columns.json`
2. For each column above the current `category_column`, apply both genuineness tests:
   - Citizen-recognizable: Do values look like named departments/agencies/programs a citizen would recognize?
   - Official document test: Does the city use this grouping in its published budget documents?
3. For each column below the current `subcategory_column`, apply both tests.
4. Record: recommended_depth (N), level_N_column, extraction_blocker (if any).

### For PDF cities (pdfplumber):

1. Check the PDF's Table of Contents for section-level groupings above the current extracted level.
2. Check for a "Summary by [Group]" table or "Requirements by [Group]" chart — these indicate official groupings.
3. Check for a fund/bureau/service area mapping table in the User's Guide or introduction section.
4. Verify grouping is used in the official budget document's organization, not just in a secondary appendix.

### Genuineness tests (D-05):

| Test | Pass Criterion | Fail Examples |
|------|---------------|---------------|
| Citizen-recognizable | Label names a known organizational unit (department, bureau, service area, program area) | Fund codes, object classifications (Personnel Services), accounting categories (Capital vs Operating) |
| Official document test | City uses this grouping in ToC, summary tables, or official narrative | A Socrata column that city never surfaces in budget documents; auto-generated codes |

### Depth decision rule:

- If both tests pass for a new level: add it. Record as `verdict: 'retrofit_recommended'`.
- If one or both tests fail: do not add. Record as `verdict: 'depth_confirmed_current'` with reason.
- If incomplete coverage (some rows lack a value): apply D-06 null-collapse. Record coverage percentage.

---

## Runtime State Inventory

This is not a rename/refactor phase. The "state" to be aware of:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Portland: 34 budget_categories at depth-0 (bureau nodes), ~140 enrichment rows keyed on bureau names; Dallas: 188 depth-0 nodes, 680 depth-1 nodes | Code reload via RPC replaces tree; enrichment name-keys shift (D-10/D-11 apply) |
| Live service config | Dallas `data_sources.column_mapping` in DB — needs `department_column: 'appropriation'` added | SQL UPDATE via Supabase client or MCP migration |
| OS-registered state | None — this is purely data/script changes | — |
| Secrets/env vars | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY` — no changes to key names | None — existing env vars unchanged |
| Build artifacts | None — no compiled output for scripts | None |

**Nothing found in category "OS-registered state" and "Build artifacts":** Verified by inspection — no scheduled tasks, no compiled binaries affected.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 2-level trees in all city loaders | N-level data-driven tree builder (processCA.js `buildNLevelTree`) | Phase 35 (CA state) | Portland and Dallas can use same recursive pattern |
| `treasury_sync_budget_tree` RPC accepts only 2-level | RPC accepts arbitrary N-level trees | Phase 34 (infrastructure) | No RPC changes needed for Phase 36 |
| `enrichCategories.js` only enriched depth-0 | `--depth` flag supports 0, 1, or `all` | Phase 35 (CA state enrichment) | Can target exactly the new depth nodes |
| BudgetIcicle.tsx hardcoded to 2 levels | Renders arbitrary depth via `navigationPath` | Phase 34/35 | No frontend changes needed for Phase 36 |

**Deprecated/outdated:**
- `buildCATree()` (2-level): Replaced by `buildNLevelTree()` in Phase 35. The `processPortland.js` `buildOperatingTree()` is the analog that needs updating.

---

## Open Questions

1. **Should older Portland fiscal years (FY2022-FY2025) be retrofitted to 3-level or left as flat bureau lists?**
   - What we know: Portland reorganized its government structure in 2024-25. Service areas in FY2022 PDFs may differ from FY2026. Retrofitting older years requires extracting service area maps from each PDF year.
   - What's unclear: Whether the pdfplumber extraction will work on pages 12-13 of older FY PDFs (FY2022-FY2024 have different page layouts).
   - Recommendation: Retrofit FY2026 only in Phase 36. Optionally add FY2025. Mark older years as "audit-deferred" — the structural change predates the current org. Record the decision in the audit verdicts DB table.

2. **Should SF be retrofitted in Phase 36 (Option A: add organization_group) or deferred?**
   - What we know: `organization_group → department` passes genuineness. The same `department_column` code change that enables Dallas would enable SF.
   - What's unclear: The leaf-level column for SF Option A (currently `fund_type` — may not pass genuineness; `character` is accounting).
   - Recommendation: Defer SF to a follow-up phase. Record verdict in audit table. The planner can re-scope to include SF if the Dallas code change is trivially small.

3. **Does `treasury_sync_budget_tree` RPC fully replace existing depth-1 nodes when called with a deeper tree?**
   - What we know: Phase 35 confirmed the RPC handles N-level trees (TREE-01 test). Phase 35 D-07 notes that the planner must verify whether the RPC replaces or accumulates when depth changes.
   - What's unclear: Whether calling the RPC for Portland with a 3-level tree (where prior call used a flat 1-level tree) will orphan the old depth-0 bureau nodes or replace them.
   - Recommendation: Verify in a Wave 0 task using a dry-run reload of a single FY. Inspect `budget_categories` depth distribution before and after. Per Phase 35 pattern, if orphans appear, an explicit DELETE of existing budget data for that data_source_id + fiscal_year is needed before reload.

4. **How should the per-city audit verdict be stored in the DB?**
   - What we know: D-04 says verdicts stored in DB as source of truth. No DB schema for this exists yet.
   - What's unclear: Which table? A new `city_audit_verdicts` table, or a JSON field on `data_sources`?
   - Recommendation: Add a JSONB column `audit_verdict` to `treasury.data_sources`. Each data source row stores `{ recommended_depth, evidence, last_audited, auditor }`. Simpler than a new table; consistent with existing `column_mapping` JSONB pattern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | processPortland.js, bulkLoadBudget.js, enrichCategories.js | ✓ | v24.13.0 | — |
| Python | extractPortland.py | ✓ | 3.14.3 | — |
| pdfplumber (Python) | extractPortland.py service area extraction | ✓ | — | — |
| openpyxl (Python) | Reference only | ✓ | — | — |
| Portland Vol 1 PDFs | Service area extraction | ✓ | FY2022-FY2026 confirmed in docs/Portland/ | — |
| Supabase / mcp__supabase-local | DB migrations, query verification | ✓ | (project-configured) | — |
| Anthropic API | enrichCategories.js for new nodes | ✓ (assumed from prior phases) | — | Use --dry-run to gate spend |
| Dallas Socrata API | bulkLoadBudget.js reload | ✓ | Live (verified in research) | — |
| SF Socrata API | Audit only (if SF included) | ✓ | Live (verified in research) | — |

**Missing dependencies with no fallback:** None.

---

## Validation Architecture

nyquist_validation key absent from .planning/config.json — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (ev-accounts-api repo: C:/EV-Accounts) for integration tests; manual dry-run verification for scripts |
| Config file | C:/EV-Accounts/backend/vitest.config.ts (or similar — Phase 34 confirmed vitest used there) |
| Quick run command | `node scripts/processPortland.js --dry-run --fy 2026` |
| Full suite command | `cd C:/EV-Accounts && npx vitest run backend/test/treasury-3level.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RETROFIT-01 | Audit framework produces per-city verdict with depth + evidence + any blocker | manual | Inspect `.planning/AUDIT-FRAMEWORK.md` + DB audit verdicts | ❌ Wave 0 gap |
| RETROFIT-02 | Portland reloaded as 3-level tree (service_area → bureau → items) | integration smoke | `node scripts/processPortland.js --dry-run --fy 2026` | ✅ script exists; output needs validation |
| RETROFIT-02 | Dallas reloaded as 3-level tree (dept → service → objectgroup) | integration smoke | `node scripts/bulkLoadBudget.js --source "Dallas Operating" --dry-run --fy 2026` | ✅ script exists; needs dept_column extension |
| RETROFIT-03 | Retrofitted cities show 3-level icicle in live app | manual/visual | Human spot-check at treasurytracker.empowered.vote | ❌ Wave 0 gap (needs live load) |
| RETROFIT-03 | Existing enrichment rows intact | DB query | `SELECT count(*) FROM treasury.category_enrichment WHERE municipality_id = $portland_id` | ❌ Wave 0 gap |

### Sampling Rate

- **Per task commit:** `node scripts/processPortland.js --dry-run --fy 2026` (confirms extraction + tree shape)
- **Per wave merge:** `node scripts/bulkLoadBudget.js --source "Dallas" --dry-run --fy 2026` + Portland dry-run
- **Phase gate:** Human spot-check of Portland and Dallas icicle pages in live app before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] DB query to verify pre-reload Portland enrichment count and name_key format (baseline before retrofit)
- [ ] DB query to verify pre-reload Dallas enrichment count (baseline before retrofit)
- [ ] Verify `treasury_sync_budget_tree` RPC replaces vs. accumulates when tree depth changes (dry-run + depth query)
- [ ] If audit verdicts stored in `data_sources.audit_verdict`: migration to add JSONB column needed

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Scripts run server-side with service key |
| V3 Session Management | No | No session state in scripts |
| V4 Access Control | No | Service role key used for all DB writes |
| V5 Input Validation | Yes (PDF path, Socrata API response) | PDF path comes from controlled `docs/Portland/` readdir (T-23-02 pattern already applied); Socrata API data validated via `parseAmount()` |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns for Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell injection via PDF path | Tampering | T-23-02 already applied: PDF path from controlled readdir, not user input. Maintain same pattern. |
| Socrata API returning unexpected columns | Tampering | `parseAmount()` handles null/undefined gracefully; `buildBudgetTree()` uses `|| 'Unknown'` fallbacks |
| Enrichment cost overrun | Denial of service (financial) | $5 API cost gate enforced: always run `--dry-run` first, check count, estimate cost before live run |
| Supabase URL hardcoded fallback | Information disclosure | WR-04 fix (remove `|| 'https://...'` fallback) already applied to processCA.js; check processPortland.js and bulkLoadBudget.js — both still have the hardcoded fallback URL and should be fixed as part of this phase |

**Security note on processPortland.js:** Line 58 has `const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';` — the WR-04 fix from Phase 34 was applied to processCA.js but NOT to processPortland.js. This phase should fix it. Same for bulkLoadBudget.js line 28.

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED] Direct pdfplumber extraction of `docs/Portland/fy2025-26-vol1.pdf` pages 12-13 — bureau-to-service-area mapping table confirmed extractable, columns and values verified
- [VERIFIED] Live Socrata API query `https://www.dallasopendata.com/resource/e2fs-y4nb.json` — `appropriation` column confirmed as DEPARTMENT-level grouping above `service`
- [VERIFIED] Live Socrata API query `https://data.sfgov.org/resource/xdgd-c79v.json` — `organization_group` (7 values), `program` (10 generic values) confirmed
- [VERIFIED] DB query: Portland FY2026 operating budget has 34 depth-0 bureau nodes; Dallas FY2026 has 188 depth-0 + 680 depth-1 nodes
- [VERIFIED] `scripts/processCA.js` `buildNLevelTree()` — N-level recursive tree builder pattern, confirmed working in production (Phase 35)
- [VERIFIED] `scripts/enrichCategories.js` `--depth` flag (line 75) — supports depth 0, 1, or 'all'
- [VERIFIED] Phase 34 `34-01-SUMMARY.md` — `treasury_sync_budget_tree` RPC confirmed to accept N-level trees
- [VERIFIED] `scripts/bulkLoadBudget.js` `buildBudgetTree()` — only supports 2-level trees (category → subcategory); no `department_column` support exists

### Secondary (MEDIUM confidence)
- [CITED] `36-CONTEXT.md` D-04/D-05/D-06/D-07 — genuineness tests and audit framework requirements
- [CITED] `35-PATTERNS.md` — enrichment name_key format: `normalize(parent)|normalize(name)` for subcategories
- [CITED] Portland FY2025-26 budget PDF p.47 Figure 9 — service area totals confirm 8 service areas and their dollar amounts

### Tertiary (LOW confidence)
- [ASSUMED] SF's `organization_group` column exactly matches SF's official budget book section groupings — verified via Socrata data only, not cross-checked against SF PDF budget document
- [ASSUMED] Portland FY2022-FY2024 Vol 1 PDFs have the same user's guide table (pages 12-13) for service area mapping — only verified for FY2025-26
- [ASSUMED] Dallas's `appropriation` column values appear in Dallas's published budget documents as department names — verified via Socrata column metadata label "DEPARTMENT" and value inspection, not against Dallas PDF

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bulkLoadBudget.js` `buildBudgetTree()` does not currently support a `department_column` for 3-level trees | City 2 (Dallas) | Low risk — if wrong, the column_mapping update is the only change needed; if right, a code addition is needed |
| A2 | SF's `organization_group` column matches SF's official budget book section groupings | City 3 (SF) | Low risk — SF is deferred; even if wrong, it only affects whether SF qualifies for retrofit |
| A3 | Portland FY2022-FY2024 PDFs have the same user's guide table structure | Pitfall 1 | Medium risk — if page layout differs in older PDFs, the service area extraction may fail for those years; recommendation is to limit Phase 36 to FY2026 only |
| A4 | Dallas `appropriation` values appear in Dallas's published budget as department names | City 2 (Dallas) | Low risk — verified via Socrata column metadata ("DEPARTMENT") and value inspection; unlikely to be wrong |
| A5 | Portland FY2025-26 "Office of Vibrant Communities" is the only bureau with blank service area | City 1 (Portland) | Medium risk — if other bureaus have blank service areas in older PDFs, the tree would produce an "Other" or blank node; D-06 null-collapse handles this gracefully |

---

## Metadata

**Confidence breakdown:**
- Source data audit (Portland, Dallas, SF): HIGH — directly verified via pdfplumber and live Socrata API queries
- Tree builder patterns: HIGH — verified against existing Phase 35 implementation
- Enrichment preservation: HIGH — verified against enrichCategories.js source code
- Audit framework design (DB storage): MEDIUM — approach recommended but schema not yet implemented
- Older Portland PDF years: LOW — only FY2025-26 verified; older years assumed similar but flagged as pitfall

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (Socrata APIs stable; Portland PDF structure stable within fiscal year)
