# Audit Framework — City Budget Tree Depth

**Phase 36 durable asset (D-02/D-04)**
**Applicable to all 30+ cities loaded in Treasury Tracker**
**Machine-readable source of truth:** `treasury.data_sources.audit_verdict` JSONB column (added by Phase 36 migration `20260609120000_add_audit_verdict_to_data_sources.sql`)

---

## Purpose

This document provides a reusable step-by-step guide for engineers auditing any city's
source data to determine the optimal budget tree depth for display. It covers Socrata
API cities (column inspection), PDF-based cities (structural cue inspection), and the
genuineness tests that must pass before any level is added.

Per D-04: the audit lives in two places — this markdown as the human-readable guide, and
`treasury.data_sources.audit_verdict` as the machine-readable per-city verdict.

Per D-07: there is no depth cap. If a city's source genuinely supports 4 levels and both
genuineness tests pass, load it at 4 levels. The goal is accuracy, not uniformity.

---

## For Socrata Cities

1. **Fetch the dataset column list:**
   `GET https://{host}/api/views/{dataset_id}/columns.json`
   This returns an array of column objects with `fieldName`, `name` (human label),
   and sample data. Note every column above and below the current `category_column`
   in the dataset.

2. **For each column above the current `category_column`,** apply both genuineness
   tests (see §Genuineness tests below):
   - Does the column contain named organizational units a citizen would recognize?
   - Does the city surface this grouping in its published budget documents?

3. **For each column below the current `subcategory_column`,** apply the same two tests.

4. **Record the verdict:**
   - `recommended_depth`: integer (e.g. 3 for a 3-level tree)
   - `level_N_column`: the Socrata column name providing each level
   - `extraction_blocker`: any column that fails genuineness (with reason), or `null` if none

---

## For PDF Cities (pdfplumber)

1. **Check the PDF's Table of Contents** for section-level groupings above the current
   extracted level. Section headers that appear in the ToC indicate official groupings.

2. **Look for "Summary by [Group]" tables or "Requirements by [Group]" charts.** These
   summary tables indicate that the city officially uses that grouping in its budget
   narrative. Examples: "Total City Bureau Expenses by Service Area" (Portland) or
   "Summary by Department" (common in many cities).

3. **Look for a fund/bureau/service area mapping table** in the User's Guide or
   introduction section of the budget document. A dedicated mapping table is strong
   evidence of an official organizational hierarchy.

4. **Verify the grouping is used in the official budget organization** — not just in a
   secondary appendix or technical supplement. Groupings must appear in the main body
   of the budget document (ToC, summary section, narrative introduction) to pass the
   official document test.

---

## Genuineness Tests (D-05)

A tree level is **genuine** only if it passes BOTH tests:

| Test | Pass Criterion | Fail Examples |
|------|----------------|---------------|
| **Citizen-recognizable** | Label names a known organizational unit: a department, bureau, service area, program area, or agency. Citizens navigating the budget can immediately understand what the group represents. | Fund codes (`GF`, `0001`), object classifications (`Personnel Services`, `Non-Personnel`), accounting categories (`Capital`, `Operating`, `Administrative`), internal accounting designations |
| **Official document test** | The city itself uses this grouping in its published budget documents — Table of Contents, summary tables, organizational narrative, or official budget book section headers. It is not merely a technical column in a dataset the city never surfaces publicly. | A Socrata column that the city never mentions in budget documents; auto-generated accounting codes; program codes that are internal IT designations only |

Both tests must pass. Failing one test is sufficient to reject the level.

---

## Depth Decision Rule

Apply the genuineness tests to each candidate level, then record the verdict:

- **Both tests pass** → add the level. Record `status: 'retrofit_recommended'`.
- **One or both tests fail** → do not add. Record `status: 'depth_confirmed_current'` with
  reason explaining which test failed and why.
- **Both tests pass but incomplete row coverage** (some rows lack a value at the new level) →
  apply the D-06 null-collapse pattern: collapse rows with no value to the parent node as
  line items. Do not invent synthetic groupings for blank rows. Record coverage percentage
  in the evidence field.
- **Level genuinely supported but leaf column unclear** → record `status: 'audit_deferred'`
  with the specific blocker noted in the evidence field.

The `audit_verdict` JSONB must be written to `treasury.data_sources` for every audited city,
including cities where the verdict is depth_confirmed_current or audit_deferred. Per D-09,
do NOT skip the verdict for cities that do not need a retrofit — record explicitly.

---

## Phase 36 Verdicts

These verdicts were established during the Phase 36 source data audit (2026-06-09) for the
3 pilot cities. They are the machine-readable source of truth in `treasury.data_sources.audit_verdict`.

### Portland, OR — retrofit_recommended (D-05 both pass)

| Field | Value |
|-------|-------|
| **Status** | `retrofit_recommended` |
| **Recommended depth** | 3 (Service Area → Bureau → Line Items) |
| **Current depth** | 1 (flat bureau list) |
| **Evidence** | Vol 1 PDF (FY2025-26) pages 12-13 contain an explicit `Managing Agency \| Fund \| Service Area \| Fund Type` mapping table. 8 service areas group the 34 bureaus: Public Safety, Public Works, City Operations, Community & Economic Development, City Administrator, City Council, Office of the City Auditor, Office of the Mayor. Named in Table of Contents section breaks and Figure 9 "Total City Bureau Expenses - Requirements by Service Area" (p.47). |
| **Citizen-recognizable test** | PASS — "Public Safety", "Public Works" are immediately recognizable to any citizen |
| **Official document test** | PASS — Service area groupings appear in ToC, Figure 9 summary, and dedicated bureau-to-service-area mapping table in User's Guide |
| **Extraction blocker** | None. The `service_area` field placeholder already exists in `extractPortland.py` output; pages 12-13 extract cleanly via `pdfplumber`. |
| **Level mapping** | depth-0: service_area (from pages 12-13 table); depth-1: bureau (existing extraction); depth-2: line items (existing) |
| **Wave 2 plan** | 36-02 |

### Dallas, TX — retrofit_recommended (D-05 both pass)

| Field | Value |
|-------|-------|
| **Status** | `retrofit_recommended` |
| **Recommended depth** | 3 (Department → Service → Object Group) |
| **Current depth** | 2 (service → objectgroup) |
| **Evidence** | Socrata dataset `e2fs-y4nb` at `www.dallasopendata.com` contains an `appropriation` column labeled "DEPARTMENT" in API metadata. Values are department names: "Police Department GF", "Dallas Fire Rescue GF", "Water Utilities DWU", "Park and Recreation GF", "Library GF". 67 distinct appropriation values confirmed via live API query. |
| **Citizen-recognizable test** | PASS — "Police Department GF", "Dallas Fire Rescue GF" are named city departments citizens recognize |
| **Official document test** | PASS — column labeled "DEPARTMENT" in Socrata API metadata; values correspond to Dallas's adopted budget department structure |
| **Extraction blocker** | `bulkLoadBudget.js` `buildBudgetTree()` does not yet support a `department_column` for 3-level trees; requires code addition (shared with any other Socrata city that gains a 3rd level). This is NOT a data blocker — the Socrata column exists and is clean. |
| **Level mapping** | depth-0: `appropriation` (new); depth-1: `service` (was depth-0); depth-2: `objectgroup` (was depth-1) |
| **Note on NONE rows** | Some rows have `service='NONE'` (debt service). These are grouped under their `appropriation` department per D-06. |
| **Wave 2 plan** | 36-03 |

### San Francisco, CA — audit_deferred (D-09)

| Field | Value |
|-------|-------|
| **Status** | `audit_deferred` |
| **Recommended depth** | audit_deferred — see details |
| **Current depth** | 2 (department → fund_type) |
| **Evidence** | Socrata dataset `xdgd-c79v` at `data.sfgov.org`. Two candidate columns above/below `department`: (1) `organization_group` (7 groups: Public Protection, Community Health, Public Works Transportation & Commerce, Culture & Recreation, etc.) passes both genuineness tests; (2) `program` column FAILS both tests (see below). |
| **organization_group genuineness** | PASS — 7 groups match SF's official budget book section headers; citizen-recognizable organizational names |
| **program column assessment** | FAIL BOTH TESTS. Distinct values: "Operating", "Capital", "Administrative", "Technology", "Maintenance", "Special Events" — these are accounting/fund-type categories, NOT organizational units citizens recognize. SF does not present its budget using these program codes as primary navigation. **DO NOT use the `program` column as a tree level.** |
| **Why deferred** | Adding `organization_group` above `department` requires the same `department_column` code addition as Dallas. The correct leaf column below `department` (currently `fund_type`) needs confirmation that it passes genuineness for a 3-level `org_group → dept → leaf` structure. Deferring rather than guessing the leaf. |
| **Decision reference** | D-09: cities whose current depth is already appropriate are marked as audited/confirmed. SF's current 2-level `department → fund_type` is appropriate until the leaf column question is resolved. |
| **Future action** | If Dallas's `department_column` code addition is committed (Plan 36-03), SF Option A (`organization_group → department → fund_type`) can be retrofitted at no additional code cost. Requires verifying `fund_type` passes genuineness. |

---

## Common Pitfalls

### Pitfall 1: Portland Service Area Page Range Changes Across Fiscal Years

Portland reorganized its government structure in 2024-25. The FY2025-26 structure (8 service areas)
differs from older structures. Use a keyword search (`'Managing Agency'` + `'Service Area'`) to
locate the table across pages rather than hardcoding page indices. If the map returns fewer than
5 service areas, the table was not found — investigate the specific fiscal year's PDF layout.

### Pitfall 2: SF `program` Column — Do Not Use

As documented above, SF's `program` column values are accounting categories, not organizational
units. They fail both genuineness tests. **Never add `program` as a tree level for San Francisco.**

### Pitfall 3: Enrichment Name_Key Format After Depth Change

After a retrofit, enrichment `name_key` values for nodes that moved depth will change format
(plain `normalize(name)` for root nodes vs. `normalize(parent)|normalize(name)` for depth-1+).
Per D-10/D-11: existing enrichment rows with old name_key format become orphaned — they are kept
in the DB (not deleted) and logged as warnings. A subsequent `enrichCategories.js` run will
enrich the new nodes with the new key format.

---

## Quick Reference — Verdict Schema

```json
{
  "recommended_depth": 3,
  "evidence": "Brief description of the source data supporting this depth",
  "last_audited": "2026-06-09",
  "auditor": "phase-36-audit",
  "status": "retrofit_recommended"
}
```

`status` values:
- `retrofit_recommended` — source genuinely supports deeper tree; reload needed
- `depth_confirmed_current` — current depth is correct; no reload needed
- `audit_deferred` — genuine level exists but a specific blocker prevents completing the verdict

---

*Created: 2026-06-09 as part of Phase 36 selective city retrofit*
*Maintained by: whichever agent runs the next city audit*
