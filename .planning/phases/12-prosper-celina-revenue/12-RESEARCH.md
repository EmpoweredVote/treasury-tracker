# Phase 12: Prosper and Celina Revenue via pdftotext - Research

**Researched:** 2026-05-21
**Domain:** pdftotext revenue extraction from ACFR governmental funds statements
**Confidence:** HIGH (all findings from direct PDF inspection and codebase reading)

## Summary

Phase 12 extracts revenue data for Prosper (FY2023–FY2025) and Celina (FY2025) from ACFR PDFs using
pdftotext, targeting the "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES"
section. Both ACFRs were downloaded and their pdftotext output inspected directly. The extraction pattern
is well-understood from existing reference implementations.

**Critical structural finding:** Both Prosper and Celina ACFRs have two candidates for extraction:
(1) the all-funds governmental statement (multi-column, wide, split across two page-blocks in pdftotext)
and (2) fund-specific Budget-and-Actual statements (3 or 4 columns, clean layout). The Budget-and-Actual
statements — especially the General Fund one — are significantly easier to parse. However, the phase
requires governmental funds (General Fund, Special Revenue, Debt Service, Capital Projects), so the
all-funds statement is the right primary source; fund-specific statements serve as validation anchors.

The existing `processRevenuePDF.js` (McKinney/Allen/Frisco) and `processLongviewBudget.js` /
`processGarlandBudget.js` (expenditure parsers) are the direct reference implementations. The new scripts
follow processGarlandBudget.js structure with revenue-specific section detection from processRevenuePDF.js.

**Primary recommendation:** Parse the all-funds governmental statement for each FY, targeting revenue
lines only (stop before EXPENDITURES). Use "Total revenues" as the validation anchor. Hardcode expected
totals per city/FY from published ACFR figures. Continue on bad pages; skip label-only lines (no $0 fill).

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdftotext` (system) | 4.00 (poppler) | PDF text extraction | Already installed, confirmed working |
| `node:child_process` execSync | Node built-in | Run pdftotext subprocess | Established pattern in all 4 existing loaders |
| `@supabase/supabase-js` | ^2.100.1 | DB access, RPC calls | Already installed and used in all scripts |
| `node:util` parseArgs | Node built-in | CLI flag parsing | Established pattern (--dry-run, --verbose, --pdf) |
| `node:fs` | Node built-in | File I/O | All loaders use this |
| `node:path` | Node built-in | Path resolution | All loaders use this |

### No New Dependencies
No npm packages needed. This phase is pure pdftotext + regex, identical to processGarlandBudget.js.

### PDF Source URLs (verified accessible)
| City | FY | URL | Item ID | Size |
|------|----|-----|---------|------|
| Prosper | FY2025 | `https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682` | 682 | ~12 MB |
| Prosper | FY2024 | `https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/574` | 574 | ~10 MB |
| Prosper | FY2023 | `https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/489` | 489 | ~4 MB |
| Celina | FY2025 | `https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025` | — | ~8 MB |

All four URLs return HTTP 200 with `Content-Type: application/pdf`. Verified 2026-05-21.

**IMPORTANT:** The Prosper Revenue data_sources seeded in Phase 9 all point to the FY2025 ACFR URL
(Item/682) for ALL three fiscal years (FY2023, FY2024, FY2025). This is wrong — each FY needs its own
ACFR PDF. The planner must update the FY2023 and FY2024 data_source rows to point to Item/489 and
Item/574 respectively. The Celina data_source for FY2025 correctly points to the Celina ACFR URL.

**Installation:**
```bash
# No new npm installs needed
# pdftotext already confirmed: pdftotext version 4.00
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── processProsperjRevenuePDF.js    # Prosper extractor (FY2023–FY2025)
├── processCelinaRevenuePDF.js      # Celina extractor (FY2025)
```

Note: The file is named `processProsperjRevenuePDF.js` (with 'j') per CONTEXT.md locked decision.

### PDF Section Structure (Verified by Direct Inspection)

**Prosper FY2025 ACFR — pdftotext line structure:**
```
Line 1512: "             STATEMENT OF REVENUES, EXPENDITURES"
Line 1513: "AND CHANGES IN FUND BALANCES - GOVERNMENTAL FUNDS"
Line 1515: "             FOR THE YEAR ENDED SEPTEMBER 30, 2025"
...column header: General Fund | Impact Fees | Debt Service
Line 1521: "REVENUES                                    $ 23,102,540 $   -$   18,148,489"
... (revenue line items, ~14 lines)
Line 1535: "      Total revenues" (then continuation with Capital/Nonmajor/Total columns on next page-block)
...
Line 1543: "EXPENDITURES" (stop before here for revenue extraction)
```

**KEY STRUCTURAL ISSUE — Wide Table Split Across Page-Blocks:**
The all-funds governmental statement spans two pdftotext "page-blocks":
- Page-block A: General Fund | Impact Fees | Debt Service columns (left half)
- Page-block B: Capital Projects | Escrow | Nonmajor | Total Governmental (right half)

Labels appear ONLY in page-block A. Page-block B has numbers but no labels.
The "Total Governmental Funds" column appears in page-block B with no label on the same line.

**Recommendation:** Parse page-block A to get General Fund + Impact Fees + Debt Service revenue values.
Parse "Total revenues" line in page-block B to get the "Total Governmental Funds" revenue for validation.
The Total column in page-block B appears at the rightmost position on the unlabeled header line.

**Alternative simpler approach:** Parse the General Fund Budget-and-Actual statement instead for the
General Fund portion (cleaner 3-column layout), then parse individual fund schedules for other funds.
This avoids the wide-table splitting problem but requires identifying each fund's section separately.

**Recommended approach (simpler, lower risk):**
Target the General Fund Budget-and-Actual statement as the PRIMARY source for revenue line items.
Then add Special Revenue / Debt Service / Capital Projects from their respective Budget-and-Actual schedules.
This avoids the split-page alignment problem entirely.

The Prosper FY2025 General Fund Budget-and-Actual section anchor:
```
"STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCE"
"                               GENERAL FUND"
"                           BUDGET AND ACTUAL"
```

**Celina FY2025 ACFR — pdftotext line structure:**
```
Line 1507: "Statement of Revenues, Expenditures and Changes in Fund Balances"
Line 1508: "Governmental Funds"
Line 1509: "For the Year Ended September 30, 2025"
...column headers: General Fund | Debt Service | Street Construction | Parkland Fees | Bond Fund | Other | Total
```
Celina uses SENTENCE CASE headers (not ALL CAPS like Prosper), and a different set of funds.
Celina's "Other Governmental Funds" and "Total Governmental Funds" are in the same table.
The Celina table also splits across two pdftotext page-blocks.

Celina General Fund Budget-and-Actual anchor:
```
"Statement of Revenues, Expenditures, and Changes in Fund Balances"
"Budget and Actual - General Fund"
```

### Pattern 1: Section Anchor Detection
```javascript
// Prosper: detect the main governmental funds statement
function findGovtFundsSection(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/STATEMENT OF REVENUES, EXPENDITURES/.test(lines[i]) &&
        /GOVERNMENTAL FUNDS/.test(lines[i + 1] || '')) {
      // Check for year confirmation within next 5 lines
      for (let j = i; j < Math.min(i + 8, lines.length); j++) {
        if (/FOR THE YEAR ENDED SEPTEMBER 30/.test(lines[j])) return i;
      }
    }
  }
  return -1;
}

// Celina: sentence case variant
function findGovtFundsSectionCelina(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/Statement of Revenues, Expenditures and Changes in Fund Balances/.test(lines[i]) &&
        /Governmental Funds/.test(lines[i + 1] || '')) {
      return i;
    }
  }
  return -1;
}
```

### Pattern 2: Revenue-Only Extraction (Stop Before EXPENDITURES)
```javascript
// Stop parsing when we hit EXPENDITURES section
function isExpendituresStart(line) {
  const t = line.trim();
  return /^EXPENDITURES\b/.test(t) || /^Expenditures\b/.test(t);
}
```

### Pattern 3: General Fund Column Extraction from Multi-Fund Table
The first numeric column in the table is General Fund. Use position-based parsing.
```javascript
// pdftotext -layout places $ amounts at character positions
// General Fund values appear at roughly col 45-60 in Prosper
// Use the same midpoint-zone approach as processLongviewBudget.js / processRevenuePDF.js
```

### Pattern 4: parseMoney (identical to all existing loaders)
```javascript
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}
```

### Pattern 5: Validation Gate (new for Phase 12)
```javascript
const EXPECTED_TOTALS = {
  prosper: {
    2025: 108_416_768,  // "Total revenues" from FY2025 ACFR governmental funds statement
    2024: 68_234_893,   // TODO: read from FY2024 ACFR (planner must verify)
    2023: null,          // TODO: read from FY2023 ACFR (planner must verify)
  },
  celina: {
    2025: 129_568_278,  // "Total revenues" from FY2025 ACFR (line: "Total revenues 68,888,029 ... 129,568,278")
  },
};
const TOLERANCE = 0.20; // 20% hardcoded

function validateTotal(extracted, expected, cityFy) {
  if (!expected) {
    console.warn(`No expected total for ${cityFy} — skipping validation`);
    return true; // proceed without validation if expected unknown
  }
  const diff = Math.abs(extracted - expected) / expected;
  console.log(`Validation: extracted=$${extracted.toLocaleString()} expected=$${expected.toLocaleString()} diff=${(diff * 100).toFixed(1)}%`);
  return diff <= TOLERANCE;
}
```

**Note on expected totals:** The planner must look up "Total revenues" from the published ACFR for each
FY and hardcode those values. The FY2025 totals were read directly from pdftotext output:
- Prosper FY2025 Total Governmental Revenues: $108,416,768 (from right column, page-block B)
- Celina FY2025 Total Governmental Revenues: $129,568,278 (from "Total revenues" row)
The FY2023 and FY2024 Prosper totals must be extracted from the respective ACFR PDFs during plan execution.

### Pattern 6: last_synced_at Update (new for Phase 12)
After successful validation + load, update the data_source row:
```javascript
// Update last_synced_at on the data_source row
const { error: syncErr } = await supabase
  .schema('treasury')
  .from('data_sources')
  .update({ last_synced_at: new Date().toISOString() })
  .eq('id', ds.id);
if (syncErr) throw new Error(`last_synced_at update failed: ${syncErr.message}`);
console.log(`last_synced_at set for data_source ${ds.id}`);
```

### Pattern 7: CLI Flags (follow processGarlandBudget.js exactly)
```javascript
const { values: opts } = parseArgs({
  options: {
    'dry-run':  { type: 'boolean', default: false },
    'verbose':  { type: 'boolean', default: false },
    'no-cache': { type: 'boolean', default: false },
    'pdf':      { type: 'string' },          // override PDF path
  },
  strict: false,
});
```

### Recommended Project Structure for Script Flow
```
1. Download PDF (or use --pdf flag for local path)
2. pdftotext -layout <pdf> (execSync)
3. Find section anchor ("STATEMENT OF REVENUES, EXPENDITURES..." or "Statement of Revenues, Expenditures...")
4. Collect revenue lines (stop before EXPENDITURES)
5. Extract: label + General Fund value + other fund values (or just label + total)
6. Sum all revenue line items → extracted total
7. Compare extracted total to hardcoded expected total (±20%)
8. If validation fails: print comparison, exit without loading
9. If validation passes: upsert data_source, clear prior rows, call treasury_sync_budget_tree RPC, set last_synced_at
```

### Anti-Patterns to Avoid
- **Parsing the wide all-funds table directly:** The left-side labels and right-side Total column appear
  in separate pdftotext page-blocks with no linking mechanism. Use the General Fund Budget-and-Actual
  statement instead as the primary parse target — it has labels and values on the same lines.
- **Relying on the Prosper Revenue FY2023/FY2024 data_source URLs:** Those point to the FY2025 PDF.
  The loader scripts must accept a `--pdf` CLI argument and the plans must pass the correct per-FY PDF.
- **Downloading the PDF inside the script from the data_sources URL:** The data_source `base_url` is
  wrong for FY2023/FY2024. Always use `--pdf` to pass the correct file path.
- **Using `dataset_type = 'operating'` data_source:** The loader must find the revenue data_source
  (dataset_type = 'revenue') to avoid loading into the operating budget slot.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Money parsing | Custom parser | `parseMoney()` from any existing loader | Handles `(negatives)`, `$`, commas — edge cases already solved |
| Column position detection | Custom algorithm | Midpoint-zone approach from processLongviewBudget.js | Already handles pdftotext layout alignment |
| pdftotext invocation | Custom subprocess | `execSync('pdftotext -layout ...')` | Established pattern, handles maxBuffer |
| DB upsert | Custom SQL | Select-by-composite-key then insert/update | Avoid name-only lookups — data_sources has no unique constraint on name |
| Budget tree construction | Custom format | `buildTree()` from processRevenuePDF.js | JSON format is dictated by treasury_sync_budget_tree RPC |
| Tree/RPC call | Custom DB insert | `treasury_sync_budget_tree` RPC | All existing loaders use this; direct insert bypasses trigger logic |
| last_synced_at | Separate script | Inline update after successful RPC | CONTEXT.md: single script run, no separate validation command |

## Common Pitfalls

### Pitfall 1: Wide Table Split Across Page-Blocks
**What goes wrong:** The all-funds governmental statement spans two pdftotext output blocks. Page-block A
has labels + left 3 columns (General Fund, Impact Fees, Debt Service). Page-block B has right columns
(Capital Projects, Escrow, Nonmajor, Total) with NO labels. Parsing this as a single continuous block
fails because line numbers don't align between label lines and their corresponding values.
**Why it happens:** pdftotext -layout outputs a page separator (form-feed \x0c) between PDF pages.
The wide table spans two physical pages, so pdftotext emits two separate blocks.
**How to avoid:** Use the General Fund Budget-and-Actual statement instead, which fits on one or two
pages with full label alignment. Or: specifically target the "Total revenues" row in the all-funds table
for validation only, not for line-item extraction.
**Warning signs:** Revenue line items appear with `null` values or $0; extracted total wildly off.

### Pitfall 2: Prosper FY2023/FY2024 Data_Source URLs Point to Wrong PDF
**What goes wrong:** `seedPDFDataSources.js` seeds all three Prosper Revenue data_sources using
`PROSPER_ACFR_FY2025` URL (Item/682) for FY2023, FY2024, AND FY2025. Loading from these URLs for
FY2023 and FY2024 would extract FY2025 data into FY2023/FY2024 slots.
**Why it happens:** This was seeded in Phase 9 as placeholder infrastructure before the correct URLs
were known.
**How to avoid:** Each plan (12-01 Prosper) must update the FY2023 and FY2024 data_source rows to use
the correct URL (Item/489 for FY2023, Item/574 for FY2024) AND must pass the PDF via `--pdf` CLI arg.
The loader script accepts `--pdf <path>` and downloads from the correct URL.
**Warning signs:** FY2023/FY2024 revenue matches FY2025 figures exactly.

### Pitfall 3: Expenditure Dedup with Phase 7/9 Operating Data
**What goes wrong:** CONTEXT.md says to extract BOTH revenues AND expenditures. But Prosper and Celina
already have operating budget data loaded from their ACFR PDFs (Phase 7, via Haiku vision). Loading
expenditure data from the revenue statement would create duplicate expenditure rows under a different
data_source_id.
**Why it happens:** The "STATEMENT OF REVENUES, EXPENDITURES, AND CHANGES IN FUND BALANCES" contains
both sections. The phase wants both, but the operating data already exists.
**Resolution:** The CONTEXT.md says "planner must account for dedup." The recommended approach:
- Load ONLY revenues from this script (dataset_type='revenue' data_source)
- Skip the EXPENDITURES section entirely during parsing (stop at EXPENDITURES header)
- Document that expenditure data is already covered by the Phase 7 operating load
The 20% validation tolerance check is on the REVENUES total only.
**Warning signs:** Treasury shows duplicate expenditure data for Prosper/Celina.

### Pitfall 4: Section Header Case Mismatch Between Cities
**What goes wrong:** Prosper uses ALL CAPS section headers; Celina uses Sentence Case. A single regex
that requires `STATEMENT OF REVENUES, EXPENDITURES` will not find Celina's
`Statement of Revenues, Expenditures and Changes in Fund Balances`.
**Why it happens:** Different cities format their ACFR differently. No standardization exists.
**How to avoid:** Use case-insensitive regex for section detection, or separate detection logic per city
(which is already enforced by separate city-specific files).
**Warning signs:** Parser reports "Section not found" for Celina.

### Pitfall 5: "Total revenues" Label Before vs. After Values
**What goes wrong:** In Prosper FY2025, "Total revenues" appears as a label on a line where the values
ARE MISSING from the label-column (values appear in page-block B). The label line shows only the label.
**Why it happens:** The all-funds table's "Total revenues" row has its rightmost Total column in the
second page-block only. The label page-block shows the row label but blank for the Total column.
**How to avoid:** When looking for "Total revenues" for validation, scan BOTH page-blocks. The Total
Governmental column appears in the rightmost position of the second page-block.
**Better approach:** Hardcode the expected total. Use the "Total revenues" value as the comparison
target, not as a value extracted from parsing the PDF.

### Pitfall 6: Empty Label Lines in Prosper Budget-and-Actual Statement
**What goes wrong:** In the Prosper General Fund Budget-and-Actual statement, some revenue categories
appear with their label on one line and their budget/actual values BELOW on a labelless continuation line.
Example from FY2025 text:
```
"REVENUES                                        $ 23,332,018 $ 23,370,581 $ 23,102,540"
"Property taxes"   ← label only, no values
"Sales and use taxes                             12,903,535  12,308,897  11,879,599"  ← label+values
```
This is identical to the McKinney format problem already solved in `parseMcKinneyFormat()`.
**How to avoid:** Use the pendingRow pattern from parseMcKinneyFormat: emit a row when the label line
has both label and values; for label-only lines, set as currentLabel and wait for the next value line.

### Pitfall 7: Revenue Line Items with No Dollar Amount
**Claude's discretion decision:** Skip lines with a label but no dollar amount (do not substitute $0).
Revenue line items without a dollar amount typically represent structural label lines (fund names,
section headers) or items where pdftotext could not extract the value. $0 would be misleading.
Log a warning with the skipped label and page-approximate line number.

### Pitfall 8: Bad/Garbled pdftotext Pages
**Claude's discretion decision:** Continue on garbled pages. Log a warning with the line range and
raw snippet. The 20% tolerance check on the total is the guard — if too many pages fail to parse,
the total will be wrong and the validation will block the load.

### Pitfall 9: Per-FY Blocking Behavior for Prosper
**Claude's discretion decision:** Per-FY blocking — if FY2024 validation fails, do not load FY2024
data but continue to attempt FY2023. Each fiscal year is an independent extraction+validation+load cycle.
The script processes each FY independently (or takes a `--fy` flag to target one year). A failure in
one year does not prevent loading another year.

### Pitfall 10: Expected ACFR Total Sourcing
**Claude's discretion decision:** Hardcode expected totals per city/FY as constants in the script.
Do NOT use a CLI flag — the tolerance check requires a reliable published figure, and having it in
code makes it reviewable and reproducible. The developer reads the ACFR published table before coding
each FY's entry. If a FY's expected total is unknown (not yet read from ACFR), set to `null` and skip
validation for that FY with a console.warn — do not block the load.
Confirmed values from pdftotext inspection:
- Prosper FY2025 Total Governmental Revenues: $108,416,768
- Celina FY2025 Total Governmental Revenues: $129,568,278

## Code Examples

### Section Detection Pattern
```javascript
// Source: direct inspection of prosper_acfr_fy2025 pdftotext output
// Matches Prosper (ALL CAPS) variant. Celina uses sentence case.
function findRevenueSection(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Primary: look for ALL-CAPS governmental funds statement (Prosper)
    if (/STATEMENT OF REVENUES, EXPENDITURES/.test(line)) {
      // Confirm it's the GOVERNMENTAL FUNDS version (not fund-specific)
      const context = lines.slice(i, i + 5).join(' ');
      if (/GOVERNMENTAL FUNDS/.test(context) && /YEAR ENDED/.test(context)) {
        return i;
      }
    }
    // Sentence-case variant (Celina)
    if (/Statement of Revenues, Expenditures and Changes in Fund Balances/.test(line)) {
      if (/Governmental Funds/.test(lines[i + 1] || '')) return i;
    }
  }
  return -1;
}
```

### Revenue Extraction with Stop-at-Expenditures
```javascript
// Source: pdftotext output analysis of both ACFRs
function extractRevenueLines(lines, startIdx) {
  const rows = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    // Stop at EXPENDITURES section
    if (/^EXPENDITURES\b/i.test(t)) break;
    // Skip section headers, blanks, page markers
    if (!t || /^STATEMENT OF|^FOR THE YEAR|^REVENUES\s*$|^Page \d+|Governmental Funds$/i.test(t)) continue;
    // Skip "Total revenues" — use for validation only
    if (/^\s*Total revenues\b/i.test(line)) { /* capture separately for validation */ continue; }
    // Extract label + values
    const moneyRe = /\(?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\s*\)?/g;
    const amounts = [...line.matchAll(moneyRe)].map(m => parseMoney(m[0])).filter(v => v !== null);
    const labelMatch = /^(.+?)\s{2,}/.exec(line);
    const label = labelMatch ? labelMatch[1].trim() : t.replace(/\s+\d.*$/, '').trim();
    if (!label || amounts.length === 0) continue;
    rows.push({ label, amounts });
  }
  return rows;
}
```

### Data_Source Lookup Pattern (don't use name — use composite key)
```javascript
// Source: processRevenuePDF.js lines 676-690
const { data: existing } = await supabase.schema('treasury').from('data_sources')
  .select('id, last_synced_at')
  .eq('municipality_id', muniId)
  .eq('api_type', 'pdf_download')
  .eq('dataset_id', 'fy' + fiscalYear)
  .eq('dataset_type', 'revenue')
  .maybeSingle();
```

### Validation + Load Gate
```javascript
// Run validation before any DB write
const valid = validateTotal(extractedTotal, EXPECTED_TOTALS[city][fiscalYear], `${city} FY${fiscalYear}`);
if (!valid) {
  console.error(`VALIDATION FAILED — aborting load. Data NOT written to DB. last_synced_at NOT set.`);
  process.exit(2);
}

// Proceed with load only after validation passes
// ... upsert data_source, clear prior rows, call RPC, update last_synced_at
```

### Building the Revenue JSON Tree
```javascript
// Source: buildTree() from processRevenuePDF.js
// Revenue rows: { department, category, approved_amount, actual_amount, fund }
// For ACFR governmental funds: department = fund name, category = revenue line item label
// fund = "Governmental Funds" or specific fund name

function buildTree(rows) {
  const tree = new Map();
  let total = 0;
  for (const row of rows) {
    const approved = Number(row.approved_amount) || 0;
    if (approved === 0) continue;
    const dept = row.department || 'General Fund';
    const cat  = row.category   || 'Revenue';
    if (!tree.has(dept)) tree.set(dept, new Map());
    if (!tree.get(dept).has(cat)) tree.get(dept).set(cat, []);
    tree.get(dept).get(cat).push({ d: cat, a: approved, aa: row.actual_amount ?? null, f: row.fund, e: null });
    total += approved;
  }
  // ... (same construction as processRevenuePDF.js buildTree)
  return { jsonTree, total };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Haiku vision for ACFR revenue | pdftotext + section targeting | Phase 12 (now) | Eliminates $768M/$1.38B false totals from Phase 9 |
| All-funds table parsing | General Fund Budget-and-Actual as primary | This research | Avoids split-page alignment problem |
| Prosper FY23/FY24 from FY25 PDF | Three separate ACFR PDFs | This research | Correct per-FY data from matching ACFR |

**Deprecated:**
- `bulkLoadPDF.js` (Haiku vision) for Prosper/Celina revenue: confirmed failure in Phase 9 ($768M/$1.38B totals)
- Prosper Revenue FY2023/FY2024 data_source URLs pointing to Item/682: must be updated to Item/489/574

## Open Questions

1. **What are the expected "Total revenues" values for Prosper FY2023 and FY2024?**
   - What we know: FY2025 = $108,416,768 (verified from pdftotext). FY2024 and FY2023 ACFRs are
     downloaded and available at `C:/tmp/prosper_acfr_fy2024.pdf` and `C:/tmp/prosper_acfr_fy2023.pdf`.
   - What's unclear: The exact total revenue figures.
   - Recommendation: During 12-01 plan execution, run pdftotext on each PDF and read the "Total revenues"
     line from the governmental funds statement. Hardcode the values into the script.

2. **Does the all-funds governmental statement parse cleanly enough for fund-level breakdown, or is General Fund only acceptable?**
   - What we know: The General Fund Budget-and-Actual statement parses cleanly. The all-funds table has
     a split-page alignment problem.
   - What's unclear: Whether the phase requires per-fund breakdown or just revenue line items under General Fund.
   - Recommendation: Start with General Fund Budget-and-Actual. If the phase requires Debt Service and
     Special Revenue fund revenues, parse each fund's individual Budget-and-Actual schedule separately.
     Celina FY2025 has: General Fund ($68.9M revenues), Debt Service ($24.9M), Street Construction ($228K),
     Parkland Fees ($6.5M), Bond Fund ($3.6M), Other Governmental ($25.6M) — Total $129.6M.

3. **Should the `--pdf` flag allow downloading from a URL or only accept a local path?**
   - What we know: processGarlandBudget.js uses `CACHE_PATH` (local file) and fetches from `PDF_URL`.
   - Recommendation: Accept `--pdf <local_path>` for the path passed by the operator. Also support
     automatic download to a standard cache path if no `--pdf` is passed. This matches the
     processGarlandBudget.js pattern (fetch if not cached, use cache if present).

4. **How does `last_synced_at` affect app display?**
   - What we know: The CONTEXT.md says the script must set `last_synced_at`. The data_sources table
     has this column. The existing processRevenuePDF.js does NOT set it — it only calls the RPC.
   - What's unclear: Whether the app gates on `last_synced_at` being non-null to show revenue data.
   - Recommendation: Set `last_synced_at` after validation passes and RPC completes. If it turns out
     the app doesn't gate on this field, setting it is still correct practice per CONTEXT.md.

## Sources

### Primary (HIGH confidence)
- Direct pdftotext output inspection of `C:/tmp/prosper_acfr_fy2025.pdf` (downloaded 2026-05-21)
- Direct pdftotext output inspection of `C:/tmp/prosper_acfr_fy2024.pdf` (downloaded 2026-05-21)
- Direct pdftotext output inspection of `C:/tmp/celina_acfr_fy2025.pdf` (downloaded 2026-05-21)
- Direct codebase inspection: `scripts/processRevenuePDF.js` — parseMcKinneyFormat, buildTree, RPC call
- Direct codebase inspection: `scripts/processGarlandBudget.js` — script structure, CLI flags, upsert pattern
- Direct codebase inspection: `scripts/processLongviewBudget.js` — column detection, midpoint zones
- Direct codebase inspection: `scripts/seedPDFDataSources.js` — seeded data_source URLs (confirmed bug: FY23/24 point to FY25 PDF)
- Phase 9 SUMMARY files (`09-02-SUMMARY.md`, `09-03-SUMMARY.md`) — confirmed Haiku vision failure for Prosper/Celina revenue

### Secondary (MEDIUM confidence)
- `https://www.prospertx.gov/Archive.aspx?AMID=37` — archive index listing FY2023/FY2024/FY2025 ACFR document IDs (verified via WebFetch)
- HTTP HEAD checks on Item/489, Item/574, Item/682 — all return `Content-Type: application/pdf` (verified 2026-05-21)

### Tertiary (LOW confidence)
- WebSearch results for Prosper ACFR URLs — confirmed via HEAD requests, not via content inspection for FY2023

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified installed and working
- PDF URLs: HIGH — all four URLs verified 200 OK with application/pdf content-type; FY2024 and FY2025 PDF content inspected
- Section structure: HIGH — direct pdftotext inspection of FY2025 PDFs for both cities, FY2024 for Prosper
- Architecture patterns: HIGH — direct code inspection of 4 reference implementations
- Expected totals (Prosper FY2023/2024): LOW — not yet read from ACFR; must be done during plan execution
- Dedup guidance: HIGH — confirmed Phase 7 loaded operating data; clear recommendation to skip expenditures

**Research date:** 2026-05-21
**Valid until:** 2026-07-21 (PDF URLs are stable government archives; patterns are stable)
