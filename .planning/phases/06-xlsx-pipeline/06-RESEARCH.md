# Phase 6: XLSX Pipeline - Research

**Researched:** 2026-05-01
**Domain:** Node.js XLSX parsing, HTTP file download, row hashing for deduplication, Supabase RPC integration
**Confidence:** HIGH (library APIs verified via official docs; city URLs verified via live fetch)

---

## Summary

Phase 6 builds `bulkLoadXLSX.js` — a generic XLSX download-and-load pipeline that mirrors `bulkLoadTransactions.js` and `bulkLoadBudget.js` in structure. The loader fetches an Excel file from a static URL stored in `data_sources`, parses it, hashes each row for deduplication, and calls `treasury_sync_transactions` for both `transactions` and `salaries` dataset types.

**Library decision: use ExcelJS 4.4.0 (not the `xlsx` / SheetJS npm package).** The `xlsx` package on npm is stuck at version 0.18.5, which carries two known vulnerabilities (Prototype Pollution, ReDoS — CVE-2023-30533). The fixed version (0.19.3+) exists only on SheetJS's private CDN, not on npm. ExcelJS 4.4.0 is the current latest on npm, actively maintained, no known security issues, and its `workbook.xlsx.load(buffer)` API is straightforward for this read-only use case.

Row deduplication uses Node's built-in `node:crypto` `createHash('sha256')` over a deterministic JSON serialization of all column values. The hash is stored as `source_row_id` on the transaction record. The RPC (`treasury_sync_transactions`) handles skip-on-conflict via this field. The `--force-reload` flag clears existing rows for a data_source before re-inserting.

The Plano check register is a dynamic web export (no static per-year XLSX URL confirmed). McKinney and Frisco provide direct per-year XLSX URLs in their archive pages. Plano's URL structure requires verification against the live site before the seeder plan runs.

**Primary recommendation:** Use `exceljs@4.4.0`, `workbook.xlsx.load(buffer)` from a `fetch()` `arrayBuffer()`, iterate with `worksheet.eachRow()`, normalize headers by trimming + lowercasing, hash all non-empty column values for `source_row_id`, batch 500 rows to `treasury_sync_transactions` RPC.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| exceljs | 4.4.0 | Parse XLSX from buffer | npm latest, no security CVEs, clean buffer API, actively maintained |
| node:crypto | built-in | SHA-256 row hash for deduplication | Zero dependency, deterministic, part of Node.js since v0.1 |
| node:util parseArgs | built-in | CLI flag parsing | Used by all prior loader scripts in this project |
| @supabase/supabase-js | ^2.100.1 | Supabase RPC calls | Already in package.json; same as existing loaders |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:https / native fetch | Node 24 built-in | HTTP download of XLSX files | Node 18+ has native fetch; project is on Node 24 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| exceljs | xlsx (SheetJS npm) | xlsx@0.18.5 has known CVEs (Prototype Pollution + ReDoS); fixed version not on npm; avoid |
| exceljs | xlsx from cdn.sheetjs.com tgz | Non-standard npm install from CDN URL; adds supply-chain risk; not worth it for read-only use case |
| SHA-256 | MD5 | MD5 is faster but has collision history; SHA-256 is standard and `createHash` overhead is negligible at row scale |
| JSON.stringify for hash input | custom delimited string | JSON.stringify is deterministic for plain objects; fine here since column values are primitives |

**Installation:**
```bash
npm install exceljs
```

---

## Architecture Patterns

### Recommended Project Structure

```
scripts/
├── bulkLoadXLSX.js          # New: generic XLSX download + parse + load
├── seedXLSXDataSources.js   # New: idempotent seeder for Plano/McKinney/Frisco data_sources rows
├── bulkLoadTransactions.js  # Existing: reference for RPC call pattern
├── seedDallasDataSources.js # Existing: reference for seeder pattern
└── ...
```

### Pattern 1: Mirror bulkLoadTransactions.js Structure

**What:** `bulkLoadXLSX.js` is structured identically to the existing Socrata loaders — env var setup, Supabase client, download helper, parse helper, buildBatch helper, syncSource function, main() with parseArgs.

**When to use:** Always — this keeps the codebase consistent and allows future maintainers to extend both pipelines using the same mental model.

**Key differences from Socrata loader:**
- Download: `fetch(ds.download_url)` then `arrayBuffer()` instead of paginated Socrata API calls
- Parse: `exceljs workbook.xlsx.load(buffer)` instead of `JSON.parse`
- Dedup: SHA-256 hash of all row values → `source_row_id` (instead of Socrata `source_row_id_column`)
- `fiscal_year` comes from `ds.fiscal_year` config row (not from a column in the data)
- Filter: `api_type = 'xlsx_download'` (instead of `'socrata'`)

**Example structure:**
```javascript
// Source: bulkLoadTransactions.js pattern, adapted for XLSX
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

async function downloadXLSX(url) {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    console.error(`Download failed: ${url} — HTTP ${resp.status}`);
    process.exit(1);
  }
  return Buffer.from(await resp.arrayBuffer());
}

async function parseXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  let headers = [];
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1); // ExcelJS row.values[0] is always null

    if (rowNumber === 1) {
      // Normalize headers: trim + lowercase
      headers = values.map(v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_'));
      return;
    }

    // Build row object
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? null;
    });
    rows.push(obj);
  });

  return { headers, rows };
}

function hashRow(obj) {
  // Deterministic hash of all column values for dedup
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  return createHash('sha256').update(canonical).digest('hex');
}
```

### Pattern 2: Idempotent data_sources Seeder

**What:** Seed script follows `seedDallasDataSources.js` pattern exactly — `select by name` then `insert or update`. One `data_sources` row per city + dataset + fiscal year.

**When to use:** `seedXLSXDataSources.js` — run once before first load to register all XLSX sources.

**data_sources row shape for XLSX:**
```javascript
{
  name: 'Plano Check Register FY2025',
  api_type: 'xlsx_download',
  dataset_type: 'transactions',
  download_url: 'https://checkregister.plano.gov/...',  // direct XLSX URL
  fiscal_year: 2025,                                     // NOT from XLSX column
  municipality_id: '<plano-uuid>',
  column_mapping: {
    date_column: 'check_date',
    amount_column: 'amount',
    vendor_column: 'payee',
    description_column: 'description',
    department_column: 'department',
    fund_column: 'fund',
    // ... city-specific field names
  }
}
```

**Important:** `treasury.data_sources` has NO unique constraint on `name` — only PK (id). Must use select-by-name → insert/update pattern, not plain upsert/insert.

### Pattern 3: Row Hash Deduplication

**What:** Compute SHA-256 over a canonical JSON of all column values. Pass as `rid` (source_row_id) to `treasury_sync_transactions` RPC. The RPC skips rows where that ID already exists.

**When to use:** Every row processed by the XLSX loader. No exceptions.

```javascript
// Source: node:crypto built-in — verified via nodejs.org/api/crypto.html
function hashRow(obj) {
  const sorted = Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
```

**Why sort keys:** JSON.stringify key order is insertion order. Normalizing key order makes the hash stable regardless of how ExcelJS yields column order across runs.

### Pattern 4: Error Threshold + Summary Line

**What:** Count parse errors. After all rows processed, if `errors / totalRows > 0.05`, exit non-zero. Print summary as last line regardless.

**Output format:**
```
Plano Check Register FY2025: 12,048 inserted | 0 skipped | 0 errors
```

### Pattern 5: --force-reload Flag

**What:** Before inserting, call a Supabase delete on `treasury.transactions` where `data_source_id = ds.id AND fiscal_year = ds.fiscal_year`. Then proceed with full insert (no skip-hash logic needed).

**When to use:** Only when `--force-reload` flag is passed.

### Anti-Patterns to Avoid

- **Hardcoded city logic:** No `if (ds.name.includes('Plano'))` branches. Column mapping drives everything.
- **Reading XLSX from disk:** Always re-download on each run (per CONTEXT decision). No local file cache.
- **Using xlsx npm package:** Known CVEs in 0.18.5; fixed version not available on npm.
- **Assuming fiscal_year from XLSX column:** `fiscal_year` comes from `ds.fiscal_year` config only. If missing, fail with clear error.
- **Silently ignoring blank rows:** Auto-skip blank rows (where all content columns are empty or null) but count them as skipped, not errors.
- **Header-duplicate detection:** A "header-duplicate row" is a row where a numeric field contains its column label as a string — skip it silently (these appear when XLSX files have repeated header rows mid-sheet).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX parsing | Custom binary parser | `exceljs` workbook.xlsx.load() | XLSX format is complex (ZIP + XML); edge cases in cell types, merged cells, date encoding |
| HTTP redirect following | Manual redirect logic | `fetch(url, { redirect: 'follow' })` | Native fetch handles 301/302/307 automatically |
| Row deduplication | DB-level post-insert check | SHA-256 hash as `source_row_id`, RPC handles conflict | Avoids second round-trip; consistent with existing Socrata dedup pattern |
| CLI argument parsing | Manual `process.argv` parsing | `node:util parseArgs` | Already used by all loader scripts in this project |

**Key insight:** XLSX files from government sites frequently have formatting quirks (merged header cells, trailing empty rows, mid-sheet header repetition). ExcelJS handles these more robustly than hand-rolled parsers.

---

## Common Pitfalls

### Pitfall 1: ExcelJS row.values is 1-indexed

**What goes wrong:** `row.values[0]` is always `null` in ExcelJS. If you map `row.values` directly without slicing, every column is off by one.

**Why it happens:** ExcelJS uses 1-based column indexing to match Excel's own convention.

**How to avoid:** Always use `row.values.slice(1)` to get the actual cell values.

**Warning signs:** First column of every row is `null`; last column of every row appears as `undefined`.

### Pitfall 2: xlsx npm package security vulnerability

**What goes wrong:** `npm install xlsx` installs 0.18.5 with known CVEs (Prototype Pollution + ReDoS). `npm audit` will flag HIGH severity.

**Why it happens:** SheetJS moved patched versions to their private CDN instead of publishing to npm.

**How to avoid:** Use `exceljs` instead. Do not use the `xlsx` package at all.

**Warning signs:** `npm audit` reports `GHSA-4r6h-8v6p-xvw6` or mentions "SheetJS prototype pollution".

### Pitfall 3: Missing fiscal_year in data_sources config

**What goes wrong:** Loader proceeds with `fiscal_year = undefined`, which creates bad DB records.

**Why it happens:** CONTEXT decision: `fiscal_year` must come from the config row, not inferred.

**How to avoid:** Validate `ds.fiscal_year` at the top of `syncSource()`. If falsy, print `Config error: data_sources row "${ds.name}" is missing fiscal_year` and `process.exit(1)`.

**Warning signs:** RPC receiving `null` or `undefined` for `p_fiscal_year`.

### Pitfall 4: Non-deterministic row hash

**What goes wrong:** Re-running the loader generates different hashes for the same row, causing duplicates even though hash-dedup is in place.

**Why it happens:** JavaScript object key order is insertion-order. If ExcelJS yields columns in a different order across runs (e.g., different ExcelJS versions or OS), `JSON.stringify(obj)` produces different strings.

**How to avoid:** Sort keys before stringifying: `JSON.stringify(obj, Object.keys(obj).sort())`. Verified approach: sort keys explicitly before building the canonical string.

**Warning signs:** Duplicate rows appearing after re-run despite `source_row_id` dedup logic.

### Pitfall 5: Plano check register has no static per-year XLSX URL

**What goes wrong:** The Plano check register portal (`checkregister.plano.gov`) generates Excel exports dynamically via form submission, not via a static URL. A static URL stored in `data_sources` may return an error or redirect to a UI page.

**Why it happens:** Plano's check register is an interactive web application (ECOP portal) that creates Excel exports on demand, filtered by date range.

**How to avoid:** Inspect the network traffic on `checkregister.plano.gov` to find the actual export endpoint, or verify if there is a static download URL (e.g., a fiscal-year-specific static file posted annually). This must be confirmed before writing the `seedXLSXDataSources.js` seeder. If no static URL exists, Plano may need a different approach (date-parameterized URL or manual export).

**Warning signs:** HTTP 200 response that returns HTML instead of binary XLSX content.

### Pitfall 6: McKinney FY26 is a text file, not XLSX

**What goes wrong:** McKinney's archive lists FY26 check register as a text document (not Excel). Attempting to parse it with ExcelJS will fail.

**Why it happens:** McKinney appears to publish FY26 in a different format while the year is in progress.

**How to avoid:** Only seed FY22–FY25 for McKinney in the initial load. Verify FY26 format before including it.

**Warning signs:** ExcelJS throws a parse error; file content-type is not `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

### Pitfall 7: Header-duplicate rows in multi-year XLSX files

**What goes wrong:** Some government XLSX files repeat the header row partway through the sheet (e.g., after every 1,000 rows). These rows will parse with a date field containing "Check Date" instead of a real date, causing amount parse errors.

**Why it happens:** Exported Excel files sometimes have repeated headers for printing readability.

**How to avoid:** After header extraction, detect rows where any numeric column contains its own column label (string match against `headers` array). Skip and count as auto-skipped, not errors.

---

## Code Examples

### Download XLSX from URL (Node 24, native fetch)

```javascript
// Source: verified via MDN fetch API + Node 24 native fetch
async function downloadXLSX(url) {
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) {
    console.error(`Download failed: ${url} — HTTP ${resp.status}`);
    process.exit(1);
  }
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('spreadsheet') && !contentType.includes('octet-stream') && !contentType.includes('excel')) {
    console.warn(`Warning: unexpected content-type "${contentType}" — may not be XLSX`);
  }
  return Buffer.from(await resp.arrayBuffer());
}
```

### Parse XLSX Buffer with ExcelJS

```javascript
// Source: ExcelJS README (github.com/exceljs/exceljs) + WebFetch verified
import ExcelJS from 'exceljs';

async function parseXLSX(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  let headers = [];
  const rows = [];
  let parseErrors = 0;

  worksheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1); // skip ExcelJS's null at index 0

    if (rowNumber === 1) {
      headers = values.map(v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '_'));
      return;
    }

    // Skip blank rows (all values null/empty)
    if (values.every(v => v == null || v === '')) return;

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? null;
    });

    // Skip header-duplicate rows
    if (headers.some((h, i) => String(obj[h]).toLowerCase() === h)) return;

    rows.push(obj);
  });

  return { headers, rows, parseErrors };
}
```

### SHA-256 Row Hash (Node built-in crypto)

```javascript
// Source: nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options
import { createHash } from 'node:crypto';

function hashRow(obj) {
  // Sort keys for deterministic output across runs
  const sorted = Object.keys(obj).sort().reduce((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {});
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}
```

### Build Transaction Batch for RPC (adapted from bulkLoadTransactions.js)

```javascript
// Source: scripts/bulkLoadTransactions.js (existing project pattern)
function buildBatch(rows, cm, fiscalYear) {
  const vendors = new Set();
  const txns = rows.map(r => {
    const vn = r[cm.vendor_column] || 'Unknown';
    vendors.add(vn);
    return {
      a: amt(r[cm.amount_column]),
      d: r[cm.description_column] || null,
      dt: r[cm.date_column] || null,
      pm: r[cm.payment_method_column] || null,
      inv: r[cm.invoice_number_column] || null,
      f: r[cm.fund_column] || null,
      ec: r[cm.expense_category_column] || null,
      dept: r[cm.department_column] || null,
      prog: r[cm.program_column] || null,
      vn,
      lk: [r[cm.department_column], r[cm.fund_column], r[cm.expense_category_column]]
            .filter(Boolean).join('|') || null,
      rid: hashRow(r),  // SHA-256 hash of all columns — dedup key
    };
  });
  return { vendors: [...vendors].map(n => ({ n })), transactions: txns };
}
```

### Idempotent data_sources Seeder Pattern

```javascript
// Source: scripts/seedDallasDataSources.js (existing project pattern)
async function upsertByName(src) {
  const { data: existing } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (existing?.id) {
    await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id);
  } else {
    await supabase.schema('treasury').from('data_sources')
      .insert(src);
  }
}
```

---

## City Source URLs (Verified)

### Plano Check Register

- Portal: `https://checkregister.plano.gov/`
- Export mechanism: Dynamic web export (no confirmed static per-year URL)
- **Action required:** Inspect actual export endpoint before seeder plan; may need to reverse-engineer the download URL from network traffic
- Dataset type: `transactions`

### McKinney Check Register (XLSX available FY22-FY25)

| Fiscal Year | URL |
|------------|-----|
| FY25 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2752` |
| FY24 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2669` |
| FY23 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2541` |
| FY22 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2456` |

Note: FY26 is listed as a text file — exclude from initial load.

### McKinney Payroll Register (XLSX available FY22-FY25)

| Fiscal Year | URL |
|------------|-----|
| FY25 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2753` |
| FY24 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2670` |
| FY23 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2542` |
| FY22 | `https://www.mckinneytexas.org/Archive.aspx?ADID=2457` |

Note: FY26 is listed as a text file — exclude from initial load.

### Frisco Check Register (XLSX available FY18-FY26)

| Fiscal Year | URL |
|------------|-----|
| FY26 | `https://www.friscotexas.gov/DocumentCenter/View/39851/City_of_Frisco_Check_Register_FY26_To_Date-XLSX` |
| FY25 | `https://www.friscotexas.gov/DocumentCenter/View/35341/Copy-of-City_of_Frisco_Check_Register_FY25_To_Date-XLSX` |
| FY24 | `https://www.friscotexas.gov/Archive.aspx?ADID=3787` |
| FY23 | `https://www.friscotexas.gov/Archive.aspx?ADID=3785` |
| FY22 | `https://www.friscotexas.gov/Archive.aspx?ADID=3783` |
| FY21 | `https://www.friscotexas.gov/Archive.aspx?ADID=3781` |
| FY20 | `https://www.friscotexas.gov/Archive.aspx?ADID=3779` |
| FY19 | `https://www.friscotexas.gov/Archive.aspx?ADID=3777` |
| FY18 | `https://www.friscotexas.gov/Archive.aspx?ADID=3775` |

Note: FY25 and FY26 have direct DocumentCenter URLs; FY18-FY24 use Archive.aspx redirect URLs. Both patterns follow HTTP redirects correctly via `fetch(..., { redirect: 'follow' })`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xlsx` (SheetJS) npm package | `exceljs` | 2023 (CVE-2023-30533 unfixed on npm) | Must switch to avoid npm audit failures |
| File-based XLSX reading | Buffer-based load via fetch() | ExcelJS 4.x | Enables pure HTTP pipeline without tmp files |
| Manual `process.argv` parsing | `node:util parseArgs` | Node 18+ | Already used in all existing loader scripts |

**Deprecated/outdated:**
- `xlsx@0.18.5` on npm: High/Medium CVEs unfixed; patched version not on npm; do not use.

---

## Open Questions

1. **Plano static download URL**
   - What we know: Portal exists at `checkregister.plano.gov`; it offers Excel export
   - What's unclear: Whether a static per-fiscal-year URL exists, or whether the export requires form submission
   - Recommendation: The seeder plan (06-02) must include a step to verify the actual download URL by inspecting network traffic on the portal. If no static URL is discoverable, Plano may be deferred or use a manual export workflow.

2. **McKinney/Frisco column names in XLSX files**
   - What we know: URLs confirmed; files exist
   - What's unclear: Exact column header names in each city's XLSX (needed for `column_mapping` in `data_sources`)
   - Recommendation: During the seeder plan (06-02), download one sample file per city and inspect column headers before writing the `column_mapping` JSON. This is expected work in that plan.

3. **Which RPC to use for `salaries` dataset type**
   - What we know: `treasury_sync_transactions` is used for `transactions` dataset type. There is no `treasury_sync_salaries` RPC in the current scripts.
   - What's unclear: Whether McKinney payroll data should go through `treasury_sync_transactions` (same RPC, different `dataset_type`) or requires a different RPC.
   - Recommendation: Use `treasury_sync_transactions` for both `transactions` and `salaries` dataset types in the XLSX loader (following the pattern from `bulkLoadTransactions.js` where `--all-types` includes salary sources). The `dataset_type` distinguishes them in the `data_sources` row. Verify against the Supabase schema before the loader plan (06-01).

4. **Municipality IDs for Plano, McKinney, Frisco**
   - What we know: Collin County municipalities were seeded via quick task 001
   - What's unclear: Exact UUIDs for Plano, McKinney, and Frisco in `treasury.municipalities`
   - Recommendation: The seeder plan (06-02) should query `treasury.municipalities` by name to retrieve these UUIDs rather than hardcoding them.

---

## Sources

### Primary (HIGH confidence)
- ExcelJS README via `https://raw.githubusercontent.com/exceljs/exceljs/master/README.md` — buffer load API, eachRow iteration, streaming
- Node.js Crypto docs via `https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options` — createHash SHA-256 API
- SheetJS official docs via `https://docs.sheetjs.com/docs/api/parse-options` — parse options, sheet_to_json API
- SheetJS network demo via `https://docs.sheetjs.com/docs/demos/net/network/` — fetch + arrayBuffer pattern
- `scripts/bulkLoadTransactions.js` (project codebase) — RPC call shape, buildBatch pattern, CLI structure
- `scripts/seedDallasDataSources.js` (project codebase) — idempotent seeder pattern

### Secondary (MEDIUM confidence)
- McKinney check register archive: `https://www.mckinneytexas.org/Archive.aspx?AMID=39` — FY22-FY25 XLSX URLs confirmed
- McKinney payroll register archive: `https://www.mckinneytexas.org/Archive.aspx?AMID=56` — FY22-FY25 XLSX URLs confirmed
- Frisco check register archive: `https://www.friscotexas.gov/Archive.aspx?AMID=188` — FY18-FY24 archive URLs confirmed
- Frisco check register page: `https://www.friscotexas.gov/1276/Check-Register` — FY25 and FY26 DocumentCenter URLs confirmed
- Snyk vulnerability database: `xlsx@0.18.5` HIGH vulnerability (Prototype Pollution) + MEDIUM (ReDoS) confirmed
- pkgpulse comparison: `https://www.pkgpulse.com/blog/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026` — performance comparison

### Tertiary (LOW confidence)
- Plano check register portal: `https://checkregister.plano.gov/` — static per-year XLSX URL not confirmed; dynamic export only observed

---

## Metadata

**Confidence breakdown:**
- Standard stack (ExcelJS choice): HIGH — security rationale verified via Snyk; API verified via official README
- City URLs (McKinney, Frisco): MEDIUM — fetched from live archive pages, URLs are Archive.aspx redirects that may change
- City URLs (Plano): LOW — no static per-year XLSX URL confirmed
- Architecture patterns: HIGH — directly mirrors existing project scripts
- Pitfalls: HIGH — ExcelJS 1-index and xlsx CVE verified; others derived from code analysis

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (city archive URLs may rotate when new fiscal years are posted)
