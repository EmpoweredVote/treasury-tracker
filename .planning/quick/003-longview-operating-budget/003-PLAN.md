---
phase: quick-003
plan: 003
type: execute
wave: 1
depends_on: [002-add-longview-tx-revenue]
files_modified:
  - scripts/processLongviewBudget.js
autonomous: false   # dry-run review checkpoint before DB write

must_haves:
  truths:
    - "Running `node scripts/processLongviewBudget.js --dry-run` prints a department list with a General Fund total between $40M and $80M"
    - "At least 15 General Fund departments are parsed"
    - "Police and Fire departments each have a 2025-26 budget between $5M and $8M"
    - "Enterprise/utility funds (water, wastewater, sanitation) and internal service funds (risk, health, fleet) are excluded from the total"
    - "Running without --dry-run creates a data_source row and upserts budget rows via treasury_sync_budget_tree"
    - "After load, `treasury.budgets` contains operating rows for Longview FY2026 with both adopted_amount and actual_amount populated"
  artifacts:
    - path: "scripts/processLongviewBudget.js"
      provides: "Longview operating budget extractor (pdftotext-based)"
      min_lines: 250
  key_links:
    - from: "scripts/processLongviewBudget.js"
      to: "treasury.data_sources"
      via: "upsertDataSource() — api_type='pdf_download', dataset_type='operating', dataset_id='fy2026'"
      pattern: "api_type.*pdf_download"
    - from: "scripts/processLongviewBudget.js"
      to: "treasury_sync_budget_tree RPC"
      via: "supabase.rpc('treasury_sync_budget_tree', { p_data_source_id, p_fiscal_year: 2026, p_dataset_type: 'operating', p_total, p_tree, p_row_count, p_triggered_by: 'bulk_load' })"
      pattern: "treasury_sync_budget_tree"
    - from: "scripts/processLongviewBudget.js"
      to: "treasury.municipalities (Longview row)"
      via: "supabase.schema('treasury').from('municipalities').ilike('name', 'Longview').single()"
      pattern: "ilike.*Longview"
---

<objective>
Create `scripts/processLongviewBudget.js` that extracts General Fund operating expenditures from Longview's FY2025-26 Master Budget PDF and loads them into `treasury.budgets` via the `treasury_sync_budget_tree` RPC. Pure pdftotext parsing — no AI APIs, no per-call cost.

Purpose: Longview now has FY2026 revenue loaded (quick task 002). This task closes the spending side so Longview shows complete operating data (revenue + expenditures) in the Treasury Tracker UI.

Output: One new script that, on production run, creates a `data_sources` row plus ~15-20 budget rows for Longview, fiscal_year 2026, dataset_type 'operating', with adopted_amount = 2025-26 BUDGET column and actual_amount = 2023-24 ACTUAL column.
</objective>

<execution_context>
@C:/Users/Chris/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/treasury-tracker/.planning/quick/002-add-longview-tx-revenue/002-SUMMARY.md
@C:/treasury-tracker/scripts/processPlanoOperating.js

PDF cached at: C:/tmp/longview_budget_fy2526.pdf
PDF source URL: https://www.longviewtexas.gov/DocumentCenter/View/17978/Master-Budget-FY-25-26-

PDF column layout (department total-expenditure lines):
  2023-24 ACTUAL | 2024-25 ADJ BUDGET | 2024-25 YR-END EST | 2025-26 BUDGET

Mapping:
  adopted_amount = col[3]  (2025-26 BUDGET, rightmost)
  actual_amount  = col[0]  (2023-24 ACTUAL, leftmost)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build the script — parsing + tree-building (no DB writes yet)</name>
  <files>scripts/processLongviewBudget.js</files>
  <action>
Create `scripts/processLongviewBudget.js` following the structure of `scripts/processPlanoOperating.js`. Key differences from Plano:

1. **PDF acquisition** — Add a download step at the top of `main()`:
   - Cache path: `C:/tmp/longview_budget_fy2526.pdf` (configurable via `CACHE_PATH` constant)
   - If cache file exists, skip download; otherwise fetch from `https://www.longviewtexas.gov/DocumentCenter/View/17978/Master-Budget-FY-25-26-` using node `fetch()` and write via `fs.writeFileSync`
   - On 4xx/5xx, log error and exit 2

2. **Department header detection** — Longview headers are ALL-CAPS lines that begin a section. Detect them with this rule:
   - Line matches `/^([A-Z][A-Z\s&\-\/\(\)]+?)\s{2,}20\d\d-\d\d/` (dept name followed by year labels on same line)
   - OR line is pure ALL-CAPS (`/^[A-Z][A-Z\s&\-\/\(\),\.]+$/` with length >= 8), AND the next 1-3 lines contain "ACTUAL" / "ADJ BUDGET" / "BUDGET" labels
   - Trim, normalize whitespace, store as `currentDept`

3. **Included-department whitelist** — Maintain a `Set` of normalized General Fund department names to keep. Build from the task description:
   ```js
   const INCLUDED = new Set([
     'CITY COUNCIL & CITY MANAGER',
     'CITY SECRETARY',
     'CITY ATTORNEY',
     'FINANCE',
     'BEAUTIFICATION',
     'FACILITY SERVICES',
     'INFORMATION SERVICES',
     'PUBLIC SAFETY',                  // Police
     'PUBLIC SAFETY COMMUNICATIONS',
     'MUNICIPAL COURT',
     'FIRE SUPPRESION',                // intentional misspelling — matches PDF
     'PUBLIC WELFARE',
     'HEALTH DEPARTMENT',
     'PARTNERS IN PREVENTION',
     'ANIMAL SERVICES',
     'DEVELOPMENT SERVICES',
     'PLANNING AND ZONING',
     'BUILDING INSPECTIONS',
     'CULTURE AND RECREATION',
     'PARKS',
     'RECREATION',
     'COMMUNITY SERVICE ADMIN',
     'LIBRARY',
     'PUBLIC WORKS',
     'SCADA',
     'TRAFFIC',
     'STREET DEPARTMENT',
   ]);

   const EXCLUDED = new Set([
     'UTILITY SERVICES', 'WATER SUPPLY', 'WATER DISTRIBUTION',
     'WATER PURIFICATION', 'WASTEWATER COLLECTIONS', 'WASTEWATER TREATMENT',
     'SANITATION', 'INTERNAL SERVICE FUNDS', 'RISK FUND', 'HEALTH FUND',
     'FLEET SERVICES', 'SPECIAL REVENUES', 'GRANTS',
   ]);
   ```
   When parsing, if `currentDept` matches an EXCLUDED entry, skip that section. If it doesn't match INCLUDED, also skip (log to stderr in --verbose mode for diagnosis).

4. **Total Expenditure line detection + column assignment** — Inside each included department section:
   - Scan forward until you hit a line matching `/Total Expenditures?\s+/i`
   - Capture the character position (`totalLabelEnd`) where the label ends — values come after
   - Collect ALL number tokens (`/\(?\$?(?:\d{1,3}(?:,\d{3})+|\d+)\)?/g`) from this line AND subsequent lines until: (a) blank line, (b) next ALL-CAPS header detected, or (c) 6 lines have been scanned, whichever comes first
   - For each number token, compute its character position. Use **midpoint zone assignment** based on the 4 column positions detected from the nearest preceding year-label line (look back up to ~50 lines for `/20\d\d-\d\d/` matches; reuse `detectColumns()` pattern from Plano script)
   - For each of the 4 columns, take the **last value assigned** (handles continuation lines where later lines override earlier ones)
   - Result: `[actual_2324, adj_2425, yrEnd_2425, budget_2526]`

5. **Build budget tree** — Single category per department (no sub-categories — Longview's PDF doesn't break out salaries/operations cleanly enough). Tree shape:
   ```js
   jsonTree.push({
     n: deptName,
     a: budget_2526,
     c: [{
       n: deptName,
       a: budget_2526,
       i: [{
         d: deptName,
         a: budget_2526,        // adopted
         aa: actual_2324,       // actual
         f: 'General Fund',
         e: null,
       }],
     }],
   });
   ```
   Note: `a` (amount) and `aa` (actual amount) — match the field names used by `treasury_sync_budget_tree`. Verify against the Plano script's tree shape; if Plano uses different keys, mirror Plano's keys.

6. **Argument parsing** — Use `parseArgs` like Plano. Options:
   - `--dry-run` (boolean, default false) — parse and print, no DB writes, no download retry
   - `--verbose` (boolean, default false) — log skipped departments and per-line parse decisions
   - `--no-cache` (boolean, default false) — re-download even if cache exists

7. **`main()` flow** (parsing-only portion for this task):
   - Parse args
   - Download or load cached PDF
   - Run `pdftotext -layout` via `execSync` (same as Plano)
   - Walk lines, detect dept headers, parse Total Expenditure rows
   - Build tree, compute grand total
   - Print summary table: dept name, adopted, actual, count
   - **Do NOT write to DB in this task** — leave Task 2's hook (`if (dryRun) return;` then `// TODO: Task 2 — upsert + RPC`)

Constraints:
- No new npm dependencies (only `@supabase/supabase-js`, `node:util`, `node:child_process`, `node:fs`, `node:path`, `node:url`)
- ESM (`import` syntax), match Plano script's style
- Comments at the top explain Longview-specific PDF quirks (multi-line totals, misspelling of "SUPPRESION")
  </action>
  <verify>
Run: `node scripts/processLongviewBudget.js --dry-run`

Expected output (approximate):
- "Municipality: Longview (<uuid>)"
- "Departments parsed: 18-25"
- "General Fund total: $45,000,000 – $75,000,000"
- Top departments shown include "PUBLIC SAFETY" (~$6M-$7M) and "FIRE SUPPRESION" (~$6M)
- No utility/water/wastewater/sanitation departments appear in output
- Exit code 0
  </verify>
  <done>
- File `scripts/processLongviewBudget.js` exists and runs without throwing
- `--dry-run` produces a department table with grand total in $40M-$80M range
- At least 15 departments listed
- Police (PUBLIC SAFETY) and Fire (FIRE SUPPRESION) each $5M-$8M
- No utility/internal-service-fund departments in output
- `--verbose` flag works and logs skipped headers
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Dry-run review</name>
  <what-built>
Longview operating budget extractor — parsing-only mode. Run `--dry-run` to see the department list, grand total, and column assignments before any DB writes.
  </what-built>
  <how-to-verify>
1. Run: `node scripts/processLongviewBudget.js --dry-run`
2. Confirm the General Fund total is reasonable (~$40M-$80M for an 83k-pop city)
3. Confirm Police (~$5-8M) and Fire (~$5-8M) appear with realistic numbers
4. Confirm no utility/water/sanitation/internal-service departments leaked in
5. Spot-check 2-3 department adopted_amounts against the PDF source (open `C:/tmp/longview_budget_fy2526.pdf` and search for the department name; verify the rightmost number on the "Total Expenditure" line matches)

If totals look wrong:
- Run with `--verbose` to see which headers were skipped vs included
- Check if a department whitelist entry needs adjustment
- Check if column-position detection picked the wrong year-labels line

Report findings — if approved, proceed to Task 3. If not, iterate on Task 1.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Add DB write path (data_source upsert + RPC sync)</name>
  <files>scripts/processLongviewBudget.js</files>
  <action>
Replace the `// TODO: Task 2 — upsert + RPC` stub with the production write path, mirroring `processPlanoOperating.js`:

1. **`upsertDataSource(muniId)`** — identical pattern to Plano's helper:
   ```js
   const src = {
     name:            'Longview Operating Budget FY2026',
     api_type:        'pdf_download',
     dataset_type:    'operating',
     dataset_id:      'fy2026',
     base_url:        'https://www.longviewtexas.gov/DocumentCenter/View/17978/Master-Budget-FY-25-26-',
     fiscal_years:    [2026],
     municipality_id: muniId,
   };
   ```
   Look up existing row via `.eq('municipality_id', muniId).eq('api_type', 'pdf_download').eq('dataset_id', 'fy2026').eq('dataset_type', 'operating').maybeSingle()`. Update if exists, insert otherwise.

2. **Clear prior rows** — before the RPC call:
   ```js
   await supabase.schema('treasury').from('budgets')
     .delete().eq('data_source_id', ds.id).eq('fiscal_year', 2026);
   await supabase.schema('treasury').from('budgets')
     .delete()
     .eq('municipality_id', longview.id)
     .eq('fiscal_year', 2026)
     .eq('dataset_type', 'operating')
     .is('data_source_id', null);
   ```

3. **Call RPC**:
   ```js
   const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
     p_data_source_id: ds.id,
     p_fiscal_year:    2026,
     p_dataset_type:   'operating',
     p_total:          total,
     p_tree:           jsonTree,
     p_row_count:      deptData.size,
     p_triggered_by:   'bulk_load',
   });
   ```
   Handle errors the same way Plano does (check both `rpcErr` and `rpcResult.error`).

4. **Municipality lookup** — at top of main():
   ```js
   const { data: longview, error: muniErr } = await supabase.schema('treasury')
     .from('municipalities').select('id, name').ilike('name', 'Longview').single();
   ```

5. **Final log line**: `Loaded ${inserted} rows for FY2026 (total $${total.toLocaleString()})`

Do NOT modify the parsing logic from Task 1 — it was validated in Task 2.
  </action>
  <verify>
Run production load: `node scripts/processLongviewBudget.js`

Expected:
- "Municipality: Longview (<uuid>)"
- "data_source: <uuid>" logged
- "Loaded N rows for FY2026 (total $XX,XXX,XXX)" where N >= 15
- Exit code 0

Then verify in DB:
```sql
SELECT COUNT(*), SUM(adopted_amount), SUM(actual_amount)
FROM treasury.budgets
WHERE municipality_id = (SELECT id FROM treasury.municipalities WHERE name = 'Longview')
  AND fiscal_year = 2026
  AND dataset_type = 'operating';
```
Expected: count >= 15, sum(adopted) between $40M-$80M, sum(actual) similar order of magnitude.

Spot-check via the Treasury Tracker UI: navigate to Longview's operating budget page and confirm departments render with FY2026 numbers.
  </verify>
  <done>
- `treasury.data_sources` has a row for Longview with `api_type='pdf_download'`, `dataset_type='operating'`, `dataset_id='fy2026'`
- `treasury.budgets` has 15+ rows for Longview FY2026 operating
- Sum of `adopted_amount` is between $40M and $80M
- `actual_amount` is populated (non-null) for all rows
- Treasury Tracker UI renders Longview operating budget with department breakdown
- Script is idempotent — re-running produces the same row count (clear + reload works)
  </done>
</task>

</tasks>

<verification>
Final acceptance:
1. `node scripts/processLongviewBudget.js --dry-run` succeeds with sane totals (Task 2 checkpoint)
2. `node scripts/processLongviewBudget.js` (production) loads rows into `treasury.budgets`
3. Re-running the production command is idempotent (same final row count)
4. Treasury Tracker UI shows Longview operating budget for FY2026

Smoke test commands:
```bash
node scripts/processLongviewBudget.js --dry-run
node scripts/processLongviewBudget.js --dry-run --verbose 2>&1 | head -80
node scripts/processLongviewBudget.js                   # production
```
</verification>

<success_criteria>
- New file `scripts/processLongviewBudget.js` exists
- General Fund total parsed is $40M-$80M
- 15+ departments loaded
- Police and Fire each $5M-$8M
- No utility/internal-service-fund leakage
- `data_sources` row created with correct identifiers
- `budgets` rows have both `adopted_amount` (2025-26) and `actual_amount` (2023-24) populated
- Script is idempotent
- No new npm dependencies
- No AI API calls (pure pdftotext parsing)
</success_criteria>

<output>
After completion, create `.planning/quick/003-longview-operating-budget/003-SUMMARY.md` recording:
- Final department count
- General Fund total loaded
- Top 5 departments by adopted amount
- Any departments that required special handling (continuation lines, header normalization)
- Total time / line count of the script
</output>
