---
phase: 002-add-longview-tx-revenue
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/processRevenuePDF.js
autonomous: false

must_haves:
  truths:
    - "Longview, TX exists as a municipality row in treasury.municipalities"
    - "processRevenuePDF.js recognises 'longview' as a valid format value"
    - "Running `node scripts/processRevenuePDF.js --city Longview --dry-run` parses the Longview PDF without errors and prints a non-zero total revenue close to ~$94M (FY2023-24 actual) or the FY2025-26 proposed total"
    - "After live run, treasury.budgets contains revenue rows for Longview FY2026 grouped by department (Sales Tax, Property Tax, Police, Fire, etc.)"
    - "treasury.data_sources has a row named 'Longview Revenue FY2026' pointing at the Longview PDF URL"
  artifacts:
    - path: "scripts/processRevenuePDF.js"
      provides: "Longview parser branch + SOURCES entry + Longview added to municipality query"
      contains: "parseLongviewFormat"
    - path: "treasury.municipalities (DB row)"
      provides: "Longview, TX municipality with Gregg County metadata"
      contains: "name = 'Longview'"
    - path: "treasury.data_sources (DB row)"
      provides: "PDF data source entry for Longview FY2026"
      contains: "Longview Revenue FY2026"
    - path: "treasury.budgets (DB rows)"
      provides: "Loaded revenue line items for Longview FY2026"
  key_links:
    - from: "SOURCES array in processRevenuePDF.js"
      to: "parseLongviewFormat()"
      via: "format: 'longview' dispatched in parsePDF()"
      pattern: "format === 'longview'"
    - from: "main() munis query"
      to: "treasury.municipalities"
      via: ".in('name', [..., 'Longview'])"
      pattern: "'Longview'"
    - from: "parseLongviewFormat output rows"
      to: "treasury.budgets via treasury_sync_budget_tree RPC"
      via: "buildTree(rows) -> jsonTree -> RPC"
      pattern: "treasury_sync_budget_tree"
---

<objective>
Add Longview, TX as a new city in Treasury Tracker and load its FY2026 General Fund revenue data from the city's "Summary of Revenues by Departments - General" PDF using the existing pdftotext-based processRevenuePDF.js pipeline.

Purpose: Expand Treasury Tracker coverage to East Texas (Gregg County). Longview's PDF is digital (not scanned) and has a clean department-grouped revenue structure that fits the existing parser architecture — no AI/Haiku API needed.

Output:
- New municipality row for Longview in treasury.municipalities (idempotent insert)
- New 'longview' format parser branch added to scripts/processRevenuePDF.js
- Longview added to SOURCES array (FY2026, proposed budget column)
- Longview added to main()'s municipality query list
- Loaded FY2026 revenue rows in treasury.budgets via treasury_sync_budget_tree RPC
</objective>

<execution_context>
@C:\Users\Chris\.claude/get-shit-done/workflows/execute-plan.md
@C:\Users\Chris\.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@scripts/processRevenuePDF.js

Reference PDF URL: https://www.longviewtexas.gov/DocumentCenter/View/16182/Summary-of-Revenues-by-Dept-GF

Longview PDF format reference:
- Title block: "Summary of Revenues by Departments - General"
- 3 pages, digital PDF (pdftotext extracts clean text — no OCR needed)
- 4 numeric columns per data row:
    [0] 2023-24 Actual
    [1] 2024-25 Budget
    [2] 2024-25 Yr End Est
    [3] 2025-26 Proposed   <-- adopted budget for FY2026
- Section structure:
    Department number as section label (e.g. "0" for General/Tax revenues, "102" City Secretary,
    "200" Municipal Court, "210" Police, "224" Fire, "225" Code Compliance, "350" P&Z,
    "352" Building Inspection, "520" Recreation, "531" Library, "600" Environmental Health,
    "601" PIP, "604" Animal Services, "704" Information Services, "850/851" Interfund Transfers)
    Each section contains revenue line items with 5-digit account codes (e.g. 41004 Sales Tax,
    41000/41001/41002/410013 Property Tax variants, 41009-41016 Franchise variants, 42500-series, etc.)
    Each section ends with a "Total [Dept Name]" subtotal line — SKIP those for line-item capture.
- Total General Fund revenue FY2023-24 actual ≈ $94.4M; FY2025-26 proposed will be the load target.

DB conventions (from script):
- Municipality insert: idempotent — select by name first, insert only if missing.
- data_sources: no unique constraint on name — use upsertDataSource() pattern (already in script).
- RPC `treasury_sync_budget_tree` consumes `jsonTree` from buildTree(rows).
- Each row produced by parser: { department, category, approved_amount, actual_amount, fund: 'General Fund' }
    where approved_amount = 2025-26 Proposed (col [3]) and actual_amount = 2023-24 Actual (col [0]).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert Longview municipality row (idempotent)</name>
  <files>scripts/insertLongviewMunicipality.js (one-off ad-hoc script — may be deleted after run)</files>
  <action>
    Create a tiny ad-hoc Node script (or run inline via `node -e`) that:
    1. Connects to Supabase using SUPABASE_URL + SUPABASE_SERVICE_KEY env vars (same pattern as processRevenuePDF.js lines 33-37).
    2. Queries `treasury.municipalities` for `name = 'Longview'`.
    3. If found: print existing id and exit.
    4. If not found: insert with these fields (mirror schema fields used by other TX cities — inspect an existing row like McKinney first if uncertain):
         - name: 'Longview'
         - state: 'TX'
         - county: 'Gregg'
         - population: 83000     (approximate, ~83k)
         - region: 'East Texas'  (only if column exists; otherwise omit)
         - Any other required NOT NULL columns — match the McKinney/Allen/Frisco row shape.
    5. Print the resulting municipality id.

    IMPORTANT: Before writing the insert, run a quick SELECT against an existing TX city row (e.g. McKinney) to learn the exact column set so the insert satisfies NOT NULL constraints:
       `SELECT * FROM treasury.municipalities WHERE name = 'McKinney' LIMIT 1;`
    Either via Supabase JS client in the same script, or psql/Supabase SQL editor.

    Why a one-off script: this is a single DB row insert; cleaner than adding municipality bootstrap logic to processRevenuePDF.js.
  </action>
  <verify>
    Run: `node scripts/insertLongviewMunicipality.js`
    Expect: prints `Longview municipality id: <uuid>` on first run, prints `Already exists: <uuid>` on second run.
    Confirm in Supabase: `SELECT id, name, state, county FROM treasury.municipalities WHERE name = 'Longview';` returns one row.
  </verify>
  <done>treasury.municipalities contains exactly one row with name='Longview', state='TX', county='Gregg'.</done>
</task>

<task type="auto">
  <name>Task 2: Add parseLongviewFormat() + SOURCES entry + municipality query update</name>
  <files>scripts/processRevenuePDF.js</files>
  <action>
    Make three coordinated edits to `scripts/processRevenuePDF.js`:

    (A) Add Longview to the SOURCES array (around line 42-54), after the Frisco entry:

        { city: 'Longview', fy: 2026, url: 'https://www.longviewtexas.gov/DocumentCenter/View/16182/Summary-of-Revenues-by-Dept-GF', format: 'longview' },

    (B) Add a new `parseLongviewFormat(lines)` function modeled on parseAllenFormat() (since Longview also uses department-grouped revenue with subtotals). Place it just before parsePDF() (~line 615). Key parsing rules:

        Section header detection:
          - Locate the start of the revenue table by looking for the title text "Summary of Revenues by Departments" OR a header line containing both "Actual" and "Proposed".
          - Stop section when we hit "Total Revenue" / "Total General Fund Revenue" / end-of-document.

        Column detection:
          - 4 numeric columns. Use the same `extractLastNValues()` pattern as Allen/Frisco — take the LAST value as adopted (col[3] = 2025-26 Proposed) and the FIRST value as actual.
          - Since the existing helpers only expose last and second-to-last, we need actual = col[0] not col[2]. Implement a small variant:

              function extractFirstAndLastValues(line) {
                const all = [...line.matchAll(/\(?\$? ?\d{1,3}(?:,\d{3})+\s*\)?/g)].map(m => parseMoney(m[0]));
                const result = new Array(4).fill(null);
                if (all.length >= 1) result[3] = all[all.length - 1];   // 2025-26 Proposed (adopted)
                if (all.length >= 1) result[0] = all[0];                // 2023-24 Actual
                return result;
              }

            And set adoptedIdx=3, eoyIdx=0 (yes, reusing eoyIdx as the "actual_amount" slot — matches the flushPending pattern that pulls values[eoyIdx] into actual_amount).

        Department/category detection:
          - When a line trimmed-equals a digit-only string like "0", "102", "200", "210", "224", "225", "350", "352", "520", "531", "600", "601", "604", "704", "850", "851" — that's a department number. Lookup against this map and update currentDept:

              const DEPT_MAP = {
                '0':   'General Revenue',
                '102': 'City Secretary',
                '200': 'Municipal Court',
                '210': 'Police',
                '224': 'Fire',
                '225': 'Code Compliance',
                '350': 'Planning & Zoning',
                '352': 'Building Inspection',
                '520': 'Recreation',
                '531': 'Library',
                '600': 'Environmental Health',
                '601': 'PIP',
                '604': 'Animal Services',
                '704': 'Information Services',
                '850': 'Interfund Transfers',
                '851': 'Interfund Transfers',
              };

          - Line items: have a 5-digit account code at the start (e.g. `41004  Sales Tax  29,700,000 ...`). The label = everything between the account code and the first money value. Use getLabel() pattern but strip leading 5-digit account code.

              function getLongviewLabel(line) {
                // Strip leading whitespace + account code (4-6 digits) + whitespace, then take everything up to first money value
                const stripped = line.replace(/^\s*\d{4,6}\s+/, '');
                const m = /\$\s*\d|\(\s*\d|\d{1,3}(?:,\d{3})+|(?<![\d,])\d+(?!\d)/.exec(stripped);
                return stripped.slice(0, m ? m.index : stripped.length).trim();
              }

          - Skip lines:
              * Empty
              * Trim starts with "Total " (subtotal lines — we skip; buildTree() recomputes totals)
              * Header lines containing "Actual" / "Budget" / "Proposed" / "Yr End Est" with no money values
              * Page headers / footers ("Summary of Revenues", "Page X", "City of Longview", etc.)

        Adopted FY:
          - Look for "2025-26" or "2025-2026" in the first ~15 lines. If found, adoptedFY = 2026.
          - Fallback: null (main() falls back to src.fy = 2026).

        Row shape (in flushPending):
          rows.push({
            department:      pendingRow.dept,
            category:        pendingRow.cat,
            approved_amount: pendingRow.values[adoptedIdx],  // 2025-26 Proposed
            actual_amount:   pendingRow.values[eoyIdx],      // 2023-24 Actual (col [0])
            fund: 'General Fund',
          });

        Return { rows, fiscalYear: adoptedFY, colInfo: { colCount: 4, adoptedIdx: 3, eoyIdx: 0 } }.

    (C) Wire the parser into parsePDF() dispatch (~line 629):

        if (format === 'longview') return parseLongviewFormat(lines);
        if (format === 'allen')    return parseAllenFormat(lines);
        ...

    (D) Add 'Longview' to the municipalities query in main() (line 710):

        .in('name', ['McKinney', 'Allen', 'Frisco', 'Longview']);

    Code style: match existing parser conventions (2-space indent, no semicolons-omitted, JSDoc-style comments above the function).
  </action>
  <verify>
    Static check: `node --check scripts/processRevenuePDF.js` returns no syntax errors.
    Grep confirms all four edits landed:
      `grep -c "format: 'longview'" scripts/processRevenuePDF.js`     → 1
      `grep -c "parseLongviewFormat" scripts/processRevenuePDF.js`    → 2 (definition + dispatch)
      `grep -c "'Longview'" scripts/processRevenuePDF.js`             → 2+ (SOURCES + munis query)
  </verify>
  <done>Script parses without syntax errors and contains the SOURCES entry, the parser function, the dispatch branch, and the Longview entry in the municipalities query.</done>
</task>

<task type="auto">
  <name>Task 3: Dry-run parse verification</name>
  <files>(no file changes — verification only)</files>
  <action>
    Run the dry-run:
      `node scripts/processRevenuePDF.js --city Longview --dry-run`

    Expected console output (approximate):
      ── Longview FY2026 (longview) ──────────────────────────────────────
        Downloading... done
        Fiscal year loaded:  2026
        Columns detected:    4 (Adopted[3] EOY[0])
        Line items parsed:   25-50  (real number — verify nonzero, >15)
        Total revenue:       $90,000,000-$110,000,000  (sanity range — should be near ~$94M FY24 / ~$95-100M FY26)
          General Revenue: $... (N items)
          Interfund Transfers: $... (N items)
          Fire: $... (N items)
          Police: $... (N items)
          Municipal Court: $... (N items)
          ... (other departments)
        (dry-run — skipping DB)

    Sanity checks before proceeding to Task 4:
      - Total revenue must be within $80M-$120M range. If wildly off (e.g. $2M or $500M), the parser is mis-assigning columns or capturing the wrong rows — debug before live load.
      - Line items > 15. If 0 or only 1-2, the section detection or label extraction is broken.
      - Department breakdown must include at least: General Revenue, Police, Fire, Municipal Court (the big-ticket departments listed in the task context).
      - No JavaScript errors in console.

    If any issues: iterate on parseLongviewFormat() (Task 2 code) until dry-run output is sane. The dry-run is idempotent — re-run as needed.
  </action>
  <verify>Dry-run completes without errors, total revenue ∈ [$80M, $120M], line items ≥ 15, at least 5 departments shown.</verify>
  <done>Dry-run produces a plausible Longview revenue breakdown with reasonable totals.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human review of dry-run output before live load</name>
  <what-built>
    Dry-run parse of Longview FY2026 PDF showing department breakdown and total revenue.
  </what-built>
  <how-to-verify>
    1. Review the dry-run console output from Task 3.
    2. Confirm total revenue is in the right ballpark (~$90M-$110M for FY2026 proposed; ~$94M for FY24 actual).
    3. Spot-check at least 2-3 line items against the PDF (open the PDF, find e.g. Sales Tax / Property Tax / Fire revenue and check the dollar amounts).
    4. Verify department names look reasonable (no "undefined", no empty strings, no obviously wrong groupings).
    5. If satisfied: type "approved" to continue to live load.
       If issues: describe what's wrong and Claude will iterate on the parser.
  </how-to-verify>
  <resume-signal>Type "approved" to run live load, or describe parser issues to fix first.</resume-signal>
</task>

<task type="auto">
  <name>Task 5: Live load to Supabase</name>
  <files>(no file changes — DB load only)</files>
  <action>
    Run the live load:
      `node scripts/processRevenuePDF.js --city Longview`

    Expected behavior:
      - upsertDataSource() inserts a new row in treasury.data_sources named "Longview Revenue FY2026"
      - Existing budgets for that data_source_id + fiscal_year are deleted (none expected on first run)
      - treasury_sync_budget_tree RPC inserts the new rows
      - Console prints: `Loaded NN rows for FY2026`

    Post-load verification queries (run via Supabase SQL editor or psql):
      1. `SELECT id, name, base_url FROM treasury.data_sources WHERE name = 'Longview Revenue FY2026';`
         → exactly one row
      2. `SELECT COUNT(*) FROM treasury.budgets b
          JOIN treasury.data_sources ds ON b.data_source_id = ds.id
          JOIN treasury.municipalities m ON ds.municipality_id = m.id
          WHERE m.name = 'Longview' AND b.fiscal_year = 2026;`
         → > 15 rows
      3. `SELECT SUM(approved_amount) FROM treasury.budgets b
          JOIN treasury.data_sources ds ON b.data_source_id = ds.id
          JOIN treasury.municipalities m ON ds.municipality_id = m.id
          WHERE m.name = 'Longview' AND b.fiscal_year = 2026 AND b.dataset_type = 'revenue';`
         → in the $80M-$120M range

    If load fails (RPC error, etc.): log error, do NOT retry blindly — review the error and fix the underlying issue.
  </action>
  <verify>
    All three SQL queries above return expected results.
    UI smoke test (optional): visit treasurytracker.empowered.vote, navigate to Longview, confirm revenue page renders FY2026 data.
  </verify>
  <done>Longview FY2026 revenue is loaded in treasury.budgets, queryable, and totals match the dry-run output.</done>
</task>

</tasks>

<verification>
- Longview municipality row exists (Task 1)
- Script syntax valid + all four edits landed (Task 2)
- Dry-run produces sane output (Task 3 + Task 4 human check)
- Live load inserts >15 budget rows summing to $80M-$120M (Task 5)
- No regression to McKinney/Allen/Frisco parsers (re-run with `--city McKinney --dry-run` if any doubt; should match prior output)
</verification>

<success_criteria>
- Longview appears in treasury.municipalities (Gregg County, TX)
- A 'longview' format branch exists in scripts/processRevenuePDF.js
- SOURCES array contains the Longview FY2026 entry
- treasury.budgets contains Longview FY2026 revenue rows totaling ~$90M-$110M, grouped by department
- treasury.data_sources contains "Longview Revenue FY2026" pointing at the PDF URL
- Existing McKinney/Allen/Frisco loads still work (no regression)
</success_criteria>

<output>
After completion, create `.planning/quick/002-add-longview-tx-revenue/002-SUMMARY.md` documenting:
- Final SOURCES entry
- Final parser code size / shape (line count of parseLongviewFormat)
- Loaded row count + total revenue from the live load
- Any quirks discovered in the Longview PDF format (for future maintainers)
- Municipality id for Longview
</output>
