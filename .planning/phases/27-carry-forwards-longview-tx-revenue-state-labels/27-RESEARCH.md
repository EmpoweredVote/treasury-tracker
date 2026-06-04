# Phase 27: Carry-forwards — Longview TX Revenue + STATE_LABELS — Research

**Researched:** 2026-06-04
**Domain:** Data seeding / DB state verification / UI verification
**Confidence:** HIGH

---

## Summary

Phase 27 has two requirements (CARRY-01 and CARRY-02) that were deferred from v1.5. Both are in a more complete state than the REQUIREMENTS.md description implies — the heavy lifting was already done in a prior session.

**CARRY-01 (Longview revenue):** The revenue data is already loaded in the database. `processRevenuePDF.js` ran on 2026-05-21 and loaded 15 department-level revenue categories for FY2026 totaling $87.6M. Two category names have embedded garbage characters from the PDF parser (`"Police    0  0%"`, `"Library   0  0%"`) that need to be fixed. Enrichment has never been run for Longview (0 rows in `category_enrichment` for this municipality). This phase needs to: (1) fix the two corrupted names in DB, and (2) run `enrichCategories.js --city Longview --state TX --year 2026`.

**CARRY-02 (STATE_LABELS):** The code is already correct. `EntitySwitcher.tsx` at HEAD contains all four full state names: `IN: 'Indiana', CA: 'California', TX: 'Texas', OR: 'Oregon'`. These were added across multiple phases (d5042e0 added IN+CA, f843b78 added TX, 7f99cf8 added OR). The current HEAD commit (911289a from 2026-06-04) includes all four. CARRY-02 is a live-app verification task — if the site at `treasurytracker.empowered.vote` shows full names, this task is done; if abbreviations still appear, a build/deploy investigation is needed.

**Primary recommendation:** Write a single plan with two focused tasks: (1) DB name fix + enrichment for Longview revenue (autonomous), and (2) live app visual check for STATE_LABELS (human UAT). No new script required for CARRY-01 — only a direct DB update and an enrichment run.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CARRY-01 | Longview TX revenue budget loaded | Revenue data already in DB ($87.6M, 15 categories). Fix 2 corrupted names. Run enrichment. |
| CARRY-02 | STATE_LABELS verified live in app | Code correct at HEAD. Pure verification task — check live site and confirm full state names display. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DB category name fix | Database / Storage | — | Direct SQL UPDATE on `treasury.budget_categories` via Supabase MCP |
| Enrichment run | API / Backend (script) | Database | `enrichCategories.js` calls Claude API then writes to `category_enrichment` table |
| STATE_LABELS display | Browser / Client | — | `EntitySwitcher.tsx` renders `STATE_LABELS[state] || state` — pure React, no server component |
| Build/deploy verification | CDN / Static | — | Vite build deployed to `treasurytracker.empowered.vote`; Render for API |

---

## Standard Stack

### Core (already in use — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | (existing) | DB access in scripts | Project standard |
| `@anthropic-ai/sdk` | (existing) | Claude API for enrichment | Used by `enrichCategories.js` |
| `pdftotext` (CLI) | (existing) | PDF extraction | Used by `processRevenuePDF.js` |

**No new packages required for this phase.** [VERIFIED: codebase grep]

---

## Package Legitimacy Audit

> No new packages are installed in this phase. Audit section not applicable.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## CARRY-01: Longview Revenue — Detailed Findings

### What Is Already in the Database [VERIFIED: Supabase query]

| Item | Value |
|------|-------|
| Municipality ID | `75c90200-418f-4e52-aede-5e221b9e50ad` |
| Revenue data_source ID | `a5e68164-6a93-4bef-81bb-4d17b5a538c7` |
| data_source name | `'Longview Revenue FY2026'` |
| dataset_type | `revenue` |
| fiscal_year | `2026` |
| total_budget | `$87,625,346` |
| budget.id | `ef2b343d-32e7-491a-a460-bd4ad2ee2591` |
| budget_categories count | 29 (15 depth-0 + 14 depth-1) |
| last_synced_at | `2026-05-21T03:53:46Z` |
| Source PDF URL | `https://www.longviewtexas.gov/DocumentCenter/View/16182/Summary-of-Revenues-by-Dept-GF` |
| Source PDF type | Separate 3-page "Summary of Revenues by Departments - General" (NOT the master budget PDF) |

### Revenue Categories (depth-0 top-level) [VERIFIED: Supabase query]

| Category | Amount |
|----------|--------|
| General Revenue | $69,962,325 |
| Information Services | $7,990,792 |
| Police | $5,200,000 |
| City Secretary | $2,536,050 |
| Animal Services | $784,406 |
| Municipal Court | $526,867 |
| Library | $249,200 |
| Building Inspection | $135,000 |
| Fire | $132,000 |
| Planning & Zoning | $41,000 |
| Environmental Health | $35,000 |
| Recreation | $20,706 |
| PIP | $8,000 |
| Code Compliance | $4,000 |

### Corrupted Category Names [VERIFIED: Supabase query]

Two depth-1 category names contain embedded percentage/numeric garbage from the PDF parser:

| Budget Category ID | Corrupted Name (raw) | Should Be |
|--------------------|---------------------|-----------|
| `83caa984-0126-4c66-b703-28b89f858b9c` | `"Police                                                                                     0        0%"` (102 chars) | `"Police"` |
| `9e264964-4907-4fde-be5e-01e0a9b2bc59` | `"Library                                                                            0     0%"` (91 chars) | `"Library"` |

**Fix required:** UPDATE both rows to trim the names before running enrichment. The `name_key` derivation in `enrichCategories.js` uses `normalize(cat.name)` (lowercase+trim), so the enrichment run will use these long corrupted keys unless the DB names are fixed first.

**Fix method:** Direct SQL UPDATE via `mcp__supabase-local__execute_sql`:
```sql
UPDATE treasury.budget_categories
SET name = 'Police'
WHERE id = '83caa984-0126-4c66-b703-28b89f858b9c';

UPDATE treasury.budget_categories
SET name = 'Library'
WHERE id = '9e264964-4907-4fde-be5e-01e0a9b2bc59';
```

### Requirements.md Naming Discrepancy [ASSUMED]

REQUIREMENTS.md says: seed `'Longview Revenue Budget FY2026'` data_source row. The DB already has `'Longview Revenue FY2026'`. This is a cosmetic difference — the data is loaded and the `dataset_type: 'revenue'` is correct. The planner should NOT re-seed or reload the data. The existing name is acceptable.

### Enrichment Task [VERIFIED: Supabase query — 0 rows exist]

```bash
node scripts/enrichCategories.js --city Longview --state TX --year 2026
```

- Operates on depth-0 categories (default `--depth 0`)
- 15 categories to enrich — all unenriched (0 existing enrichment rows for Longview)
- Estimated cost: ~$0.015 (15 × ~$0.001/call using claude-haiku-4-5) — well under $5 threshold [ASSUMED: based on Sacramento enrichment pattern from STATE.md ~$0.06 for 7 cities]
- Idempotent via `name_key, municipality_id` upsert — safe to re-run
- Revenue categories use ALL_CAPS naming pattern → `detectFormat()` in enrichCategories.js will return `'gateway'` format (not `'cafr'`) — correct behavior
- No `--year` flag is strictly required since the YEAR default is `2025`, but `--year 2026` ensures the query matches FY2026 budgets

### The REQUIREMENTS.md vs Reality: What CARRY-01 Actually Means

REQUIREMENTS.md describes CARRY-01 as "write processLongviewRevenue.js (pdftotext from cached PDF)". That work was completed in a prior session via `processRevenuePDF.js` (which already had a `parseLongviewFormat` function and a Longview entry in SOURCES). The data is loaded. This phase's CARRY-01 work is:

1. Fix 2 corrupted DB category names (SQL UPDATE)
2. Run enrichment

No new script to write. [VERIFIED: codebase + Supabase]

---

## CARRY-02: STATE_LABELS — Detailed Findings

### Code State [VERIFIED: src/components/EntitySwitcher.tsx at HEAD]

`EntitySwitcher.tsx` lines 21–26 contain:

```typescript
const STATE_LABELS: Record<string, string> = {
  IN: 'Indiana',
  CA: 'California',
  TX: 'Texas',
  OR: 'Oregon',
};
```

The render logic at line 144:
```tsx
{STATE_LABELS[state] || state}
```

This correctly falls back to the raw abbreviation for any state not in the map. All four states currently in the DB (IN, CA, TX, OR) are covered.

### Commit History [VERIFIED: git log]

| Commit | What Was Added |
|--------|----------------|
| `d5042e0` | `IN: 'Indiana'`, `CA: 'California'` (original EntitySwitcher creation with state labels) |
| `f843b78` | `TX: 'Texas'` (fix commit after TX cities were added) |
| `7f99cf8` (Phase 17) | `OR: 'Oregon'` (when Portland was seeded) |

The most recent EntitySwitcher commit is `7c93faa` (Phase 17 IN-02 sort fix — no STATE_LABELS change). Last production-relevant change was `7f99cf8` (Phase 17).

### Deployment Platform [VERIFIED: .env.production]

- API: `https://ev-accounts-api.onrender.com`
- Frontend: `treasurytracker.empowered.vote`
- Build: Vite (`tsc -b && vite build`)
- No `vercel.json` found — deployment likely via Git push trigger (manual or CI)

### What CARRY-02 Actually Means

CARRY-02 is a pure **human verification** task. The code is correct. If the live site shows full names → mark complete. If abbreviations appear → the build may be stale (a new `npm run build` + deploy trigger may be needed, but no code change).

**Risk:** The site at `treasurytracker.empowered.vote` is a React SPA — automated fetch returns minimal HTML before JS hydrates. A human must open the site in a browser and interact with the city picker. [ASSUMED: deployment is manual or CI-triggered by push — specific deploy mechanism not confirmed]

---

## Architecture Patterns

### Revenue Data Load Pattern (existing)

The existing pattern in `processRevenuePDF.js` shows the standard structure for a `revenue` dataset_type load:

```
parseLongviewFormat(lines)
  → { rows[], fiscalYear, colInfo }
buildTree(rows)
  → { jsonTree, total }
upsertDataSource(muniId, city, FY, url)
  → data_source record
supabase.rpc('treasury_sync_budget_tree', {
  p_dataset_type: 'revenue',
  p_tree: jsonTree,
  ...
})
```

The `jsonTree` format for revenue entries:
```javascript
{
  n: departmentName,     // depth-0 node
  a: deptTotal,
  c: [{
    n: categoryName,     // depth-1 node
    a: catTotal,
    i: [{
      d: catName,
      a: approved_amount,
      aa: actual_amount,
      f: 'General Fund',
      e: null
    }]
  }]
}
```

### Enrichment Command Pattern (existing)

```bash
node scripts/enrichCategories.js --city "Longview" --state TX --year 2026
```

The `--year` flag sets the `YEAR` constant used in `getBudgetCategories()` to match the correct FY row. The `--city` and `--state` flags resolve the municipality via `.ilike('name', city).eq('state', state)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DB category name fix | Custom migration script | Direct SQL via MCP | 2 rows — no migration file needed |
| Revenue enrichment | New enrichment pipeline | `enrichCategories.js` | Already handles all TX cities with ALL_CAPS categories |
| STATE_LABELS verification | Automated headless browser | Human spot-check | React SPA, JS-rendered — WebFetch cannot see the rendered UI |

---

## Common Pitfalls

### Pitfall 1: Re-loading Revenue Data That Already Exists
**What goes wrong:** Running `processRevenuePDF.js --city Longview` after the data is already in DB causes unnecessary re-load, wasting time and potentially creating duplicate DB rows if the clear step uses the wrong conditions.
**Why it happens:** REQUIREMENTS.md describes the task as if it hasn't been done.
**How to avoid:** The plan must NOT re-run the PDF extractor. The data is loaded (verified 2026-05-21, $87.6M, 29 categories). Only the DB name fix and enrichment are needed.
**Warning signs:** If a plan task says "run processRevenuePDF.js", that is wrong.

### Pitfall 2: Running Enrichment Before Fixing Category Names
**What goes wrong:** If enrichment runs before the 2 corrupted names are fixed, enrichment rows will be stored with a corrupted `name_key` (e.g. `"police                                                                                     0        0%"`). These keys will never match clean category names, so the enrichment will appear to exist but won't display.
**Why it happens:** `enrichCategories.js` uses `normalize(cat.name)` as the `name_key` without prior sanitization.
**How to avoid:** The plan must fix DB names FIRST, then run enrichment.
**Warning signs:** If enrichment runs and you see odd long name_keys in `category_enrichment`, the order was wrong.

### Pitfall 3: Enrichment Year Mismatch
**What goes wrong:** `enrichCategories.js` defaults to `--year 2025`. Running without `--year 2026` returns 0 categories (no budget rows for Longview in FY2025) and the script reports "Nothing new to enrich."
**Why it happens:** Default YEAR constant in enrichCategories.js is 2025.
**How to avoid:** Always pass `--year 2026` when enriching Longview.
**Warning signs:** "Nothing new to enrich" output when you haven't enriched yet.

### Pitfall 4: Confusing the Source PDF
**What goes wrong:** Thinking the revenue data came from `C:/tmp/longview_budget_fy2526.pdf` (the 340-page master budget). It did not. The revenue was loaded from a separate 3-page "Summary of Revenues by Departments - General" PDF at a different URL.
**Why it happens:** REQUIREMENTS.md says "pdftotext from cached PDF at C:/tmp/longview_budget_fy2526.pdf" — but that work was done differently than described, using a separate dedicated revenue summary document.
**How to avoid:** The master budget PDF's revenue section ("TOTAL REVENUES BY FUND" on pages 72-73) is graphical/image — pdftotext produces no usable text from it. The separate revenue summary PDF was the correct approach.

### Pitfall 5: Treating CARRY-02 as a Code Change
**What goes wrong:** Writing code changes to EntitySwitcher.tsx when the STATE_LABELS map is already complete.
**Why it happens:** REQUIREMENTS.md's "If abbreviations still appear" conditional is read as "there might be a code issue."
**How to avoid:** Check the live app first. If full names appear → complete. Only investigate deploy state if abbreviations appear. No code change is needed.

---

## Runtime State Inventory

> This phase is primarily a verification + enrichment run, not a rename/refactor. Runtime state check for CARRY-01 only.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Longview revenue budget loaded in `treasury.budgets` + `treasury.budget_categories` (29 rows, 2 with corrupted names) | SQL UPDATE 2 category names before enrichment |
| Stored data (enrichment) | `treasury.category_enrichment` has 0 rows for Longview municipality_id | Run enrichCategories.js after name fix |
| Live service config | n8n: not applicable | None |
| OS-registered state | None | None |
| Secrets/env vars | ANTHROPIC_API_KEY required for enrichment | Confirm present in .env before running |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pdftotext | (processRevenuePDF.js if re-run needed) | [ASSUMED: yes, used in Phase 26] | — | — |
| node | enrichCategories.js | [ASSUMED: yes] | — | — |
| ANTHROPIC_API_KEY | enrichCategories.js | [ASSUMED: in .env] | — | Must add to .env if missing |
| SUPABASE_SERVICE_KEY | DB operations | [ASSUMED: in .env] | — | Required |
| Supabase MCP | DB name fix | [ASSUMED: available] | — | Fall back to Supabase dashboard SQL |

**Missing dependencies with no fallback:** None confirmed missing.
**Note:** ANTHROPIC_API_KEY should be verified present in `.env` before the enrichment task runs.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to false — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (no vitest/jest config found) |
| Config file | none |
| Quick run command | manual verification via DB query |
| Full suite command | n/a |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARRY-01 | Longview revenue categories have no corrupted names | manual-only | `SELECT name FROM treasury.budget_categories WHERE budget_id = 'ef2b343d...' AND name != trim(name)` | N/A |
| CARRY-01 | Longview revenue enrichment rows exist | manual-only | `SELECT count(*) FROM treasury.category_enrichment WHERE municipality_id = '75c90200...'` | N/A |
| CARRY-01 | Money In tab shows Longview revenue in app | manual-only | Open treasurytracker.empowered.vote → Longview → Money In | N/A |
| CARRY-02 | City picker state headers show full names | manual-only | Open treasurytracker.empowered.vote → city picker | N/A |

> This phase has no automated test suite. All validation is DB queries + human visual checks.

---

## Security Domain

> No auth, session, or user-facing data changes. No new API endpoints. Enrichment writes to internal `category_enrichment` table (service-role key). No ASVS categories apply.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `processRevenuePDF.js` was already run and the revenue data in DB is correct (not corrupt/incomplete) | CARRY-01 Findings | If data is wrong, a re-load via processRevenuePDF.js is needed before enrichment |
| A2 | Enrichment cost ~$0.015 for 15 Longview categories | Standard Stack | Actual cost may differ; still well under $5 threshold |
| A3 | Deployment to treasurytracker.empowered.vote is triggered by git push or CI | CARRY-02 | If manual deploy is needed and hasn't been done, STATE_LABELS fix may not be live even though code is correct |
| A4 | ANTHROPIC_API_KEY is present in .env | Environment | Enrichment will fail immediately without it; easy to verify before running |
| A5 | The data_source name `'Longview Revenue FY2026'` (DB) vs `'Longview Revenue Budget FY2026'` (REQUIREMENTS.md) is acceptable | CARRY-01 | If the app uses the data_source name as display text, it may show a slightly different label — but the data is correct |

---

## Open Questions

1. **Is the live site showing full state names or abbreviations?**
   - What we know: Code at HEAD is correct with all 4 STATE_LABELS entries
   - What's unclear: Whether the latest build has been deployed to treasurytracker.empowered.vote (the WebFetch returned only a shell page due to JS rendering)
   - Recommendation: Human must open the site in a browser as the very first CARRY-02 task step

2. **Are the corrupted Police/Library category names causing display issues in the app now?**
   - What we know: Names contain trailing garbage but the depth-0 node names are clean; the app likely displays depth-0 names for category headers
   - What's unclear: Whether depth-1 names are rendered anywhere in the UI
   - Recommendation: Fix the names regardless — enrichment won't work correctly without it

---

## Sources

### Primary (HIGH confidence)
- `scripts/processRevenuePDF.js` — parseLongviewFormat function and SOURCES entry for Longview — confirms revenue data source and loading mechanism
- `scripts/processLongviewBudget.js` — confirms PDF layout details, municipality lookup pattern, and RPC call structure
- `src/components/EntitySwitcher.tsx` (HEAD) — confirms STATE_LABELS map is complete with all 4 states
- Supabase DB query (live) — confirms revenue data_source, budget, 29 categories, 0 enrichment rows

### Secondary (MEDIUM confidence)
- git log history — confirms STATE_LABELS progression across phases 17 and prior

### Tertiary (LOW confidence)
- treasurytracker.empowered.vote WebFetch — returned only shell HTML (SPA not JS-rendered); cannot confirm live STATE_LABELS display

---

## Metadata

**Confidence breakdown:**
- CARRY-01 DB state: HIGH — verified via live Supabase query
- CARRY-01 corrupted names: HIGH — verified via live Supabase query with exact character counts
- CARRY-01 enrichment: HIGH — 0 rows confirmed via live query; command pattern confirmed from codebase
- CARRY-02 code state: HIGH — read EntitySwitcher.tsx at HEAD; verified git log
- CARRY-02 live site: LOW — cannot confirm from automated fetch; requires human browser check

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable — DB state and code are deterministic)
