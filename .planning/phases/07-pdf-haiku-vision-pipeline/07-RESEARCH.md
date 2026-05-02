# Phase 7: PDF/Haiku Vision Pipeline - Research

**Researched:** 2026-05-01
**Domain:** PDF-to-PNG rendering (Node.js, Windows), Claude Haiku vision API, ACFR PDF structure, treasury_sync_budget_tree RPC
**Confidence:** HIGH for API patterns and RPC (verified from codebase + official docs); MEDIUM for PDF rendering library (multiple sources agree; not yet runtime-verified on this machine)

---

## Summary

Phase 7 builds a Node.js CLI (`bulkLoadPDF.js`) that renders each page of an ACFR PDF to PNG, sends each page image to Claude Haiku vision API for classification and budget data extraction, and loads validated rows to `treasury.budgets` via the same `treasury_sync_budget_tree` RPC used in Phases 5 and 6.

The `@anthropic-ai/sdk` v0.80.0 is already installed in the project and supports the vision API with base64 PNG images. The exact model ID for Claude Haiku is `claude-haiku-4-5-20251001` (confirmed from official Anthropic model docs). The vision API takes a standard `messages.create()` call with content blocks containing `{type:"image", source:{type:"base64", media_type:"image/png", data: base64str}}`.

For PDF rendering on Windows without system dependencies (no Ghostscript, no GraphicsMagick), use `pdftoimg-js` with `@napi-rs/canvas`. This stack uses Mozilla's PDF.js under the hood, ships pre-built Windows binaries, requires no compilation, and handles ACFR PDFs of 100–200+ pages. An alternative is `pdf-img-convert` (pure JS, pdfjs-based, no canvas peer dep required) — however it's less actively maintained (last published 2 years ago). Use `pdftoimg-js` as primary.

All three ACFR PDFs are confirmed publicly available with direct download URLs. Allen FY2025 is ~8MB; Celina FY2025 is ~6.7MB; Prosper FY2025 exceeds 10MB (large ACFR typical for fast-growing Texas municipalities). ACFRs are typically 100–250 pages. Budget comparison tables appear in the supplementary information section (toward the back), not every page.

The `treasury_sync_budget_tree` RPC signature is identical to Phase 5 — no changes needed. The budget tree JSON format (`n`, `a`, `c`, `i` compact keys) is the same. The pipeline maps Haiku's extracted `{department, category, approved_amount, actual_amount, fiscal_year}` fields to the compact tree format.

**Primary recommendation:** `pdftoimg-js` + `@napi-rs/canvas` for PDF rendering; `claude-haiku-4-5-20251001` for vision; `treasury_sync_budget_tree` for DB load. Build `bulkLoadPDF.js` following the `bulkLoadBudget.js` structure with a per-page processing loop replacing the Socrata fetch loop.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.80.0 (already installed) | Haiku vision API calls | Already in package.json; official Anthropic SDK |
| `pdftoimg-js` | latest (~1.x) | PDF page → PNG buffer | Pure-JS via pdfjs-dist, Node 18+, Windows-compatible |
| `@napi-rs/canvas` | latest (0.1.x) | Canvas backend for pdftoimg-js | Pre-built Windows binaries, no Ghostscript, no node-gyp |
| `node:crypto` | built-in | SHA-256 PDF hash for cache key | Same pattern as bulkLoadXLSX.js |
| `node:fs`, `node:util` | built-in | File I/O, CLI parseArgs | Same pattern as all other loaders |
| `@supabase/supabase-js` | ^2.100.1 (already installed) | treasury_sync_budget_tree RPC | Same as all prior loaders |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `fetch` | Node 24 built-in | Download PDF from URL | Same as bulkLoadXLSX.js download helper |
| `node:fs/promises` | built-in | PNG cache read/write | Async file operations for rendered PNGs |
| `node:path` | built-in | Cache directory paths | Platform-safe path construction |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdftoimg-js` + `@napi-rs/canvas` | `pdf-img-convert` | pdf-img-convert is pure JS (no peer deps) but last published 2 years ago and based on older pdfjs-dist; pdftoimg-js is actively maintained with modern pdfjs-dist 5.x |
| `pdftoimg-js` + `@napi-rs/canvas` | `pdf2pic` + Ghostscript | pdf2pic requires Ghostscript + GraphicsMagick system installs on Windows — eliminates portability; not acceptable |
| `pdftoimg-js` + `@napi-rs/canvas` | `pdftoppm` (system binary) | Requires system poppler install — same portability problem |
| Base64 PNG in API call | Files API upload | Files API is useful for repeated use of same image; for per-page one-shot processing, base64 inline is simpler and matches the existing codebase pattern |
| Per-page API calls | Batch API | Batch API has async result retrieval complexity; per-page sequential calls are simpler and provide real-time progress output as required |

**Installation:**
```bash
npm install pdftoimg-js @napi-rs/canvas
```

---

## Architecture Patterns

### Recommended Project Structure

```
scripts/
├── bulkLoadPDF.js           # NEW — PDF/Haiku vision pipeline CLI
├── seedPDFDataSources.js    # NEW — idempotent seeder for Allen/Prosper/Celina data_sources rows
├── bulkLoadBudget.js        # Existing — reference for RPC call pattern + data_sources
├── bulkLoadXLSX.js          # Existing — reference for file download + cache pattern
└── ...

logs/
└── review-CITY-DATE.jsonl   # Written by pipeline for flagged pages (confidence < threshold)

cache/
└── pdf-render/
    └── {pdf-sha256}/        # Cached PNGs keyed by PDF hash
        ├── page-001.png
        ├── page-002.png
        └── ...
```

### Pattern 1: Per-Page Processing Loop (replaces Socrata fetch loop)

**What:** Instead of paginating a Socrata API, the PDF pipeline renders each PDF page to PNG, sends it to Haiku, processes the JSON response, and accumulates budget rows.

**When to use:** Always — this is the core pipeline structure.

**Example:**
```javascript
// Source: pattern from bulkLoadBudget.js adapted for PDF pages

async function processPDF(ds, opts = {}) {
  // 1. Obtain PDF buffer (URL or local file)
  const pdfBuffer = await downloadOrReadPDF(ds.base_url);  // http prefix = download, else fs.readFile

  // 2. Compute SHA-256 for PNG cache key
  const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex');
  const cacheDir = path.join('cache', 'pdf-render', pdfHash);

  // 3. Render pages to PNG (skip if cached)
  const pageFiles = await renderPDFPages(pdfBuffer, pdfHash, cacheDir);
  const totalPages = pageFiles.length;

  // 4. Process each page
  const budgetRows = [];
  const flaggedPages = [];

  for (let i = 0; i < pageFiles.length; i++) {
    const pageNum = i + 1;
    const pngBuffer = await fs.readFile(pageFiles[i]);
    const base64 = pngBuffer.toString('base64');

    const result = await callHaikuWithRetry(base64, pageNum, opts);

    if (result.page_type !== 'budget_table') {
      // Non-budget pages: silently skip, no log entry
      if (!opts.quiet) {
        process.stdout.write(`\rPage ${pageNum}/${totalPages} — ${result.page_type} — skipped`);
        process.stdout.write('\n');
      }
      continue;
    }

    if (result.confidence < (opts.confidenceThreshold ?? 70)) {
      // Below threshold: log to review file, exclude from DB
      flaggedPages.push({
        page_number: pageNum,
        confidence: result.confidence,
        reason: result.reason,
        extracted_data_attempt: result.rows,
      });
      if (!opts.quiet) {
        process.stdout.write(`\rPage ${pageNum}/${totalPages} — budget_table — ${result.confidence}% confidence — FLAGGED\n`);
      }
      continue;
    }

    budgetRows.push(...result.rows);
    if (!opts.quiet) {
      process.stdout.write(`\rPage ${pageNum}/${totalPages} — budget_table — ${result.confidence}% confidence — ${result.rows.length} rows extracted\n`);
    }
  }

  return { budgetRows, flaggedPages, totalPages };
}
```

### Pattern 2: Haiku Vision API Call

**What:** Send a PNG page as base64 to Haiku with a structured extraction prompt. Parse JSON from the response.

**When to use:** Per-page call in the processing loop.

**Example:**
```javascript
// Source: @anthropic-ai/sdk v0.80.0 + official Anthropic vision docs
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,  // SDK default is 2; override to get required 3 retries
});

async function callHaiku(base64PNG, pageNum) {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: base64PNG,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const text = response.content[0].text;
  // Parse JSON from response — wrap in try/catch, return low-confidence result on parse failure
  return JSON.parse(text);
}
```

### Pattern 3: PNG Cache (keyed by PDF hash)

**What:** SHA-256 hash of the PDF buffer is used as a cache directory name. If the directory exists and contains the expected number of PNG files, skip re-rendering.

**Why:** ACFR PDFs are 100–250 pages. Rendering takes time. Re-runs for the same PDF should be fast.

**Example:**
```javascript
// Source: pattern from bulkLoadXLSX.js hash approach
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { convertPDF } from 'pdftoimg-js';

async function renderPDFPages(pdfBuffer, pdfHash, cacheDir) {
  if (existsSync(cacheDir)) {
    const files = (await readdir(cacheDir)).filter(f => f.endsWith('.png')).sort();
    if (files.length > 0) {
      console.log(`  Using cached PNGs (${files.length} pages) from ${cacheDir}`);
      return files.map(f => path.join(cacheDir, f));
    }
  }

  mkdirSync(cacheDir, { recursive: true });
  console.log('  Rendering PDF pages to PNG...');

  const result = await convertPDF(pdfBuffer, {
    format: 'png',
    outputDir: cacheDir,
    dpi: 150,        // Sufficient for text readability; 72 DPI is too low for budget tables
  });

  return result.map(r => r.path).sort();
}
```

### Pattern 4: Truncate-and-Reload Idempotency

**What:** Delete existing budget rows for `(municipality_id, fiscal_year)` before loading. Identical to Phase 5 — the `treasury_sync_budget_tree` RPC handles this atomically.

**When to use:** Always on a non-dry-run execution.

**Implementation:** Pass the correct `p_data_source_id` and `p_fiscal_year` — the RPC clears and rebuilds the budget tree for that combination.

### Pattern 5: Review Log Format

**What:** JSONL file at `logs/review-CITY-DATE.jsonl`. One entry per flagged page.

**Format:**
```jsonl
{"page_number":42,"confidence":45,"reason":"Table columns partially cut off; amounts in right margin unclear","extracted_data_attempt":[{"department":"Public Safety","category":"Police","approved_amount":18500000,"actual_amount":null,"fiscal_year":2025}]}
{"page_number":87,"confidence":62,"reason":"Low contrast scan; department column illegible in rows 3-7","extracted_data_attempt":[]}
```

**Key:** `extracted_data_attempt` is always an array (flat list of row objects) — even if empty, even if confidence is low. This lets the operator see what Haiku tried.

### Pattern 6: data_sources Row for PDF Pipeline

**What:** A new `api_type` value of `'pdf_download'` for the PDF pipeline. Follows the same schema as prior loaders.

**Column mapping for PDF source:**
```json
{
  "department_column": "department",
  "category_column": "category",
  "approved_amount_column": "approved_amount",
  "actual_amount_column": "actual_amount",
  "fiscal_year_column": "fiscal_year"
}
```

These are the field names Haiku is prompted to return in its JSON output — they map directly to the budget tree builder.

### Anti-Patterns to Avoid

- **Sending multiple pages per API call:** Each page must be a separate API call. Sending multiple images in one call gives Haiku too much to classify and produces confused output. One call = one page.
- **Using `pdf2pic` or system binaries:** They require Ghostscript/GraphicsMagick on Windows. The project must run without system-level install steps.
- **Hardcoding fiscal year from PDF content alone:** The `--fiscal-year` CLI flag is the authoritative source; Haiku may extract a year from the PDF content but the operator's flag overrides.
- **Blocking on 429 rate limit without retry:** The SDK's built-in retry handles 429s, but the 3-retry override (vs SDK default of 2) is required per the CONTEXT decisions.
- **Writing uncertain data to DB:** Pages below confidence threshold must be fully excluded. Never partially-load flagged rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF → PNG rendering | Custom pdfjs-dist canvas loop | `pdftoimg-js` | pdftoimg-js wraps the canvas/pdfjs complexity; handles encoding, output format, and concurrency |
| API retry with backoff | Custom retry loop with `setTimeout` | `@anthropic-ai/sdk` `maxRetries` option | SDK handles 429 + 500 retries with exponential backoff automatically |
| Budget tree → DB upsert | Manual DELETE + INSERT | `treasury_sync_budget_tree` RPC | Already deployed; atomically clears and rebuilds; same as Phase 5 |
| JSON extraction from Haiku response | Regex parsing of text | Structured JSON prompt + `JSON.parse()` | Haiku reliably outputs JSON when explicitly prompted; regex is fragile for table data |
| File hash for cache key | Custom filename scheme | `createHash('sha256').update(buffer).digest('hex')` | Same pattern as bulkLoadXLSX.js; collision-resistant; deterministic |

**Key insight:** The complex parts (PDF rendering, API retries, budget loading) all have existing solutions that are already proven in this codebase or the Anthropic SDK. The unique work is the Haiku prompt and the page-classification logic.

---

## Common Pitfalls

### Pitfall 1: Haiku Returns JSON Wrapped in Markdown Code Blocks

**What goes wrong:** Haiku often wraps JSON output in triple-backtick markdown code fences (` ```json ... ``` `). A naive `JSON.parse(response)` throws a SyntaxError.

**Why it happens:** Language models default to markdown formatting in responses. Even when instructed to return only JSON, they sometimes add code fences.

**How to avoid:** Strip markdown code fences before parsing:
```javascript
function extractJSON(text) {
  // Remove markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(cleaned);
}
```

**Warning signs:** `SyntaxError: Unexpected token` at parse time on what looks like valid JSON.

### Pitfall 2: pdftoimg-js Requires @napi-rs/canvas as a Peer Dependency

**What goes wrong:** `npm install pdftoimg-js` alone throws `Error: Cannot find module '@napi-rs/canvas'` at runtime.

**Why it happens:** `pdftoimg-js` uses canvas for rendering but lists it as a peer dependency (not a direct dependency) to allow users to choose between `@napi-rs/canvas` and `canvas`.

**How to avoid:** Always install both: `npm install pdftoimg-js @napi-rs/canvas`

**Warning signs:** Import error at runtime mentioning `@napi-rs/canvas` not found.

### Pitfall 3: PDF Rendering at 72 DPI Produces Unreadable Budget Table Text

**What goes wrong:** Budget tables in ACFRs have small text. At 72 DPI (the default for some renderers), numbers and column headers become blurry or pixelated. Haiku misses rows or reads amounts incorrectly.

**Why it happens:** ACFR PDFs are designed for print (300 DPI), not screen. Low-resolution rendering loses fine detail in tables.

**How to avoid:** Render at 150–200 DPI. This produces images where budget table numbers are clearly legible without creating excessively large files that slow API calls.

**Cost implication:** Images rendered at 150 DPI (typically 1200×1600px for letter page) get downsampled to Haiku's 1568px long-edge cap before tokenization. Cost is capped at ~1568 tokens per image regardless of render size above that threshold.

**Warning signs:** Haiku confidence scores are systematically low (< 60%) across all budget table pages of the same PDF.

### Pitfall 4: ACFR Has ~200 Pages But Only ~20-40 Are Budget Tables

**What goes wrong:** Operator expects the pipeline to extract hundreds of rows but only a few dozen are produced. Thinking the pipeline broke.

**Why it happens:** ACFRs consist primarily of narrative text, auditor reports, statistical tables, and organizational information. Budget comparison tables (the target) typically appear in the supplementary information section — often pages 80–150 of a 200-page document. Many pages are legitimately `narrative`, `cover`, `chart`, or `table_of_contents` type.

**How to avoid:** Normal behavior — document in summary output. The `--dry-run` mode is especially useful for inspecting page classifications before committing to a full load.

**Warning signs (actual problem):** Zero `budget_table` pages classified. This indicates a prompt issue or wrong PDF (e.g., uploaded the budget document instead of the ACFR, or a small-city ACFR with a different structure).

### Pitfall 5: ACFR Budget Tables Vary Significantly Across Cities

**What goes wrong:** The extraction prompt designed for Allen's ACFR fails on Celina's ACFR because the table layout, column headers, and fund labeling differ.

**Why it happens:** GFOA provides guidance but not a rigid template. Each city's ACFR has different formatting conventions. Allen may label columns "Original Budget / Final Budget / Actual" while Celina uses "Adopted / Amended / Actual". Department names and fund names also differ.

**How to avoid:** Design the Haiku prompt to be flexible — ask for semantic extraction ("the department being charged", "the adopted or approved budget amount") rather than literal column name matching. Test each city's ACFR with `--dry-run` before committing. The `--dry-run` workflow (inspect output, adjust prompt, re-run) is explicitly designed for this.

**Warning signs:** Consistent 0 rows extracted from `budget_table`-classified pages, or `approved_amount` is always null.

### Pitfall 6: Large ACFR PDFs Can Cause Memory Issues During Rendering

**What goes wrong:** `pdftoimg-js` tries to render all 200 pages simultaneously (default concurrency), consuming several GB of RAM and crashing the Node process.

**Why it happens:** Default concurrency may be too high for 200-page documents at 150 DPI.

**How to avoid:** Set `concurrency: 2` or `concurrency: 3` in the `pdftoimg-js` options. This processes 2-3 pages at a time, keeping memory usage bounded. The cache means this slow rendering only happens once per PDF.

**Warning signs:** Node.js OOM error during rendering step.

### Pitfall 7: Anthropic SDK Retry on Fatal Errors

**What goes wrong:** Script enters infinite retry loop on a malformed request (400 error), burning API quota.

**Why it happens:** The SDK retries 429 and 5xx errors but NOT 4xx errors (other than 408 and 409). However, if the prompt or base64 data is invalid in some way, the error must be caught and re-thrown as a fatal failure, not retried.

**How to avoid:** Wrap `anthropic.messages.create()` in a try/catch. Distinguish between `Anthropic.RateLimitError` / `Anthropic.InternalServerError` (SDK handles with retry) and other errors (fatal — exit 2 after clear message).

**Warning signs:** High API spend with no rows extracted.

---

## Code Examples

### Vision API Call Pattern (Node.js SDK)

```javascript
// Source: Official Anthropic TypeScript SDK docs + vision API docs
// https://platform.claude.com/docs/en/build-with-claude/vision
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,  // Override default of 2 to match CONTEXT decision
});

const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 2048,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64PNGString,  // Buffer.from(pngBytes).toString('base64')
          },
        },
        {
          type: 'text',
          text: EXTRACTION_PROMPT,
        },
      ],
    },
  ],
});

const rawText = response.content[0].text;
```

### Recommended Haiku Extraction Prompt

```javascript
// Claude's Discretion: prompt engineering for ACFR table extraction
const EXTRACTION_PROMPT = `Analyze this page from a government Annual Comprehensive Financial Report (ACFR).

First, classify this page as one of: budget_table, narrative, chart, cover, table_of_contents, notes, statistical, other.

If the page type is "budget_table", extract all budget line items you can see.
Return ONLY valid JSON with this exact structure:
{
  "page_type": "budget_table",
  "confidence": 85,
  "reason": "Clear budget comparison table with department/fund/adopted/actual columns",
  "rows": [
    {
      "department": "Public Safety",
      "category": "Police Department",
      "approved_amount": 18500000,
      "actual_amount": 17832000,
      "fiscal_year": 2025,
      "fund": "General Fund"
    }
  ]
}

If the page is NOT a budget_table, return:
{
  "page_type": "narrative",
  "confidence": 95,
  "reason": "Text-only page with no tabular budget data",
  "rows": []
}

Rules:
- confidence: 0-100, your certainty that the extracted data is accurate
- approved_amount and actual_amount: numeric dollars only (no $ or commas), null if not visible
- fiscal_year: 4-digit year from the table or document header, null if unclear
- fund: fund name if labeled (e.g. "General Fund"), null if not shown
- Extract ALL rows visible — do not summarize or aggregate
- Return ONLY the JSON object, no other text`;
```

### Budget Tree Builder for PDF Data

```javascript
// Source: pattern from bulkLoadBudget.js buildBudgetTree() function
// Adapted to accept Haiku extracted rows instead of Socrata API rows

function buildBudgetTree(rows) {
  const tree = new Map();
  let total = 0;
  let kept = 0;
  let droppedZero = 0;

  for (const row of rows) {
    const approved = row.approved_amount ?? 0;
    const actual = row.actual_amount ?? null;

    if (approved === 0 && (actual === null || actual === 0)) {
      droppedZero++;
      continue;
    }

    // department = category node; category = subcategory node
    const cat = row.department || 'Unknown';
    const sub = row.category || 'General';

    if (!tree.has(cat)) tree.set(cat, new Map());
    if (!tree.get(cat).has(sub)) tree.get(cat).set(sub, []);

    tree.get(cat).get(sub).push({
      d: sub,
      a: approved,
      aa: actual,
      f: row.fund || null,
      e: null,
    });

    total += approved;
    kept++;
  }

  // Convert Maps to compact JSON tree (same format as bulkLoadBudget.js)
  const jsonTree = [];
  for (const [catName, subs] of tree) {
    let catTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.a, 0);
      catTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);

  return { jsonTree, total, kept, droppedZero };
}
```

### treasury_sync_budget_tree RPC Call

```javascript
// Source: confirmed from bulkLoadBudget.js line 172-180
// IDENTICAL to Phase 5 — no changes needed

const { data, error } = await supabase.rpc('treasury_sync_budget_tree', {
  p_data_source_id: ds.id,       // UUID from data_sources row
  p_fiscal_year: fiscalYear,     // integer, e.g. 2025
  p_dataset_type: ds.dataset_type, // 'operating' for ACFR budget data
  p_total: total,                // sum of all approved_amount values
  p_tree: jsonTree,              // compact nested JSON tree
  p_row_count: allRows.length,   // total raw rows processed
  p_triggered_by: 'bulk_load',  // audit label
});

if (error) throw new Error(error.message);
console.log(`  inserted ${data?.rows_inserted || 0} line items`);
```

### CLI Structure (mirrors bulkLoadBudget.js)

```javascript
// Source: pattern from bulkLoadBudget.js main() function
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    city:                 { type: 'string' },           // e.g. "Allen"
    pdf:                  { type: 'string' },           // local path or URL
    'fiscal-year':        { type: 'string' },           // e.g. "2025"
    'confidence-threshold': { type: 'string' },         // default: 70
    'dry-run':            { type: 'boolean' },          // process but don't write DB
    quiet:                { type: 'boolean' },          // suppress per-page output
  },
  strict: false,
});
```

### Exit Code Pattern

```javascript
// Source: CONTEXT decision — tiered exit codes

// Exit 0: all pages loaded clean
// Exit 1: completed with flagged pages (review log written)
// Exit 2: fatal failure (API error after retries, DB error, PDF unreadable)

async function main() {
  try {
    const { budgetRows, flaggedPages, totalPages } = await processPDF(ds, opts);

    if (!opts.dryRun) {
      await loadToDatabase(ds, budgetRows, fiscalYear);
    }

    // Always print end-of-run summary
    console.log('\n--- Summary ---');
    console.log(`  Pages processed:  ${totalPages}`);
    console.log(`  Rows loaded:      ${budgetRows.length}`);
    console.log(`  Pages flagged:    ${flaggedPages.length}`);

    if (flaggedPages.length > 0) {
      const logPath = writeReviewLog(flaggedPages, values.city, fiscalYear);
      console.log(`  Review log:       ${logPath}`);
      process.exit(1);  // Completed with flagged pages
    }

    process.exit(0);  // All clean
  } catch (err) {
    console.error('Fatal:', err.message);
    process.exit(2);  // Fatal failure
  }
}
```

---

## ACFR PDF Sources (Verified)

All three cities confirmed available. All Texas cities use fiscal year ending September 30.

| City | ACFR URL | File Size | Notes |
|------|----------|-----------|-------|
| Allen | `https://www.cityofallen.org/Documents/Departments/Finance/Financial%20Transparency/Other%20Documents/FY%202025%20Annual%20Comprehensive%20Financial%20Report.pdf` | ~8MB | Redirects to cms3.revize.com; follows HTTP redirect automatically |
| Prosper | `https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682` | >10MB | Direct download URL confirmed |
| Celina | `https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025` | ~6.7MB | Confirmed valid PDF |

All three are FY2025 (fiscal year ended September 30, 2025, published in early 2026). The `--fiscal-year 2025` flag is the correct value for all three.

**Historical ACFRs are also available** (Celina has back to 2010, Allen has 2022 and 2023 confirmed). Multiple fiscal years can be loaded by re-running the pipeline with a different `--pdf` URL and `--fiscal-year`.

---

## GFOA ACFR Budget Table Structure

Based on research into Texas city ACFR standards:

**Location in document:** Budget comparison tables appear in the "Required Supplementary Information" section near the back of the ACFR (typically pages 80–180 of a 200-page document). The introductory and financial statement sections come first.

**Typical table types Haiku will encounter:**
- `Schedule of Revenues, Expenditures, and Changes in Fund Balance — Budget and Actual` (main target)
- Departmental budget summaries by fund
- Program/activity summaries

**Typical column structure:**
```
| Department/Program | Fund | Original Budget | Final Budget | Actual | Variance |
```
Or for smaller cities:
```
| Department | Adopted Budget | Actual | Variance from Budget |
```

**Variation by city:**
- Column headers vary: "Original"/"Adopted"/"Approved" for the budget column; "Final"/"Amended" for adjusted budget
- Allen, Prosper, and Celina are GFOA Certificate of Achievement recipients, meaning they follow GFOA best practices but still have their own formatting conventions
- Haiku should extract `approved_amount` from the "Original/Adopted/Approved" column, `actual_amount` from the "Actual" column
- Fund names may be abbreviated (e.g., "GF" for General Fund)

**Non-budget table types in ACFRs (Haiku should classify and skip):**
- Management Discussion & Analysis (narrative pages)
- Auditor's Report (formatted letter)
- Basic Financial Statements (different structure than budget comparison)
- Notes to Financial Statements (text-heavy)
- Statistical Section tables (multi-year trend data, not budget vs actual)

---

## Haiku Vision API Costs

For planning purposes:

| Scenario | Pages | Cost/page | Total |
|----------|-------|-----------|-------|
| 200-page ACFR at 150 DPI | 200 | ~$0.002 | ~$0.40 |
| All 3 cities (3 PDFs) | ~600 | ~$0.002 | ~$1.20 |
| Re-run after review (PNGs cached) | ~600 | ~$0.002 | ~$1.20 |

- Input cost: 1568 tokens/image × $1/MTok = $0.00157/page
- Output cost: ~200 tokens response × $5/MTok = $0.001/page
- **Total per page: ~$0.0025** | Per 200-page ACFR: **~$0.50**

All three cities together for one run: under $2. Multiple test runs under $10 total. Cost is not a concern for this use case.

---

## data_sources Schema for PDF Pipeline

The new `api_type` value is `'pdf_download'`. The seeder follows the exact same pattern as `seedXLSXDataSources.js`:

```javascript
// New data_sources row for PDF pipeline
{
  name: 'Allen ACFR FY2025',
  api_type: 'pdf_download',
  dataset_type: 'operating',
  dataset_id: 'fy2025',
  base_url: 'https://www.cityofallen.org/Documents/...',  // ACFR PDF URL
  fiscal_years: [2025],
  municipality_id: allenMuniId,  // looked up from treasury.municipalities
  column_mapping: {
    department_column: 'department',
    category_column: 'category',
    approved_amount_column: 'approved_amount',
    actual_amount_column: 'actual_amount',
    fiscal_year_column: 'fiscal_year',
  },
}
```

The `column_mapping` fields are the property names Haiku is prompted to return — they match the budget tree builder input.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf2pic` + Ghostscript | `pdftoimg-js` + `@napi-rs/canvas` | 2023–2024 | No system installs required; works on Windows CI/CD |
| Manual PDF table parsing | Claude Haiku vision extraction | 2024 | Classification + extraction in one API call; no custom parser per city |
| CAFR (Comprehensive Annual Financial Report) | ACFR (Annual Comprehensive Financial Report) | ~2021 | Same document, renamed by GASB; both terms appear in older PDFs |

**Note on canvas packages:** The older `canvas` npm package (Automattic/node-canvas) requires system libraries (Cairo, Pango) on Windows via build tools. `@napi-rs/canvas` distributes pre-built platform binaries and is the modern replacement for Node.js canvas on Windows without build dependencies.

---

## Open Questions

1. **Does pdftoimg-js work cleanly on Windows with Node 24?**
   - What we know: pdftoimg-js requires Node 18+; @napi-rs/canvas has a pre-built win32-x64-msvc binary; multiple sources confirm it avoids native compilation
   - What's unclear: Whether there are any Node 24-specific issues or arm64 vs x64 concerns on this specific machine
   - Recommendation: Include a `verify-pdf-rendering` task as the first plan task that does a 3-page test render of a small PDF to confirm the stack works before building the full pipeline

2. **What is the exact municipality_id for Allen, Prosper, and Celina in the live database?**
   - What we know: IDs for Dallas and McKinney were looked up dynamically in earlier phases
   - What's unclear: Whether these three cities already have rows in `treasury.municipalities` (they may not if they haven't been loaded before)
   - Recommendation: The seeder script should `upsert` municipalities first (or query and fail-fast with a clear message if missing) before creating `data_sources` rows. The first plan task should include checking/creating municipality rows.

3. **Does treasury_sync_budget_tree set `hierarchy` on the budget record?**
   - What we know: From Phase 5 research — the RPC does not appear to accept a `hierarchy` parameter; `bulkLoadGateway.js` doesn't pass one
   - What's unclear: Whether the PDF-loaded budgets will show an empty hierarchy in the app UI
   - Recommendation: Same recommendation as Phase 5: cosmetic issue only if it occurs; investigate after first successful load

4. **How many budget table pages does a typical North Texas small city ACFR have?**
   - What we know: General ACFR structure places budget comparison tables in supplementary section; total pages typically 150–250
   - What's unclear: Whether Allen/Prosper/Celina use multi-page budget tables or single summary pages
   - Recommendation: Use `--dry-run` on all three ACFRs first. The dry run will show the page-type distribution without loading to DB.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `C:/treasury-tracker/scripts/bulkLoadBudget.js` — treasury_sync_budget_tree RPC signature, budget tree JSON format, CLI pattern
- `C:/treasury-tracker/scripts/bulkLoadXLSX.js` — SHA-256 cache key pattern, file download helper, dry-run pattern
- `C:/treasury-tracker/scripts/seedXLSXDataSources.js` — data_sources seeder pattern with municipality lookup
- `C:/treasury-tracker/package.json` — @anthropic-ai/sdk v0.80.0 already installed; no pdf library installed yet
- `C:/treasury-tracker/.planning/phases/05-dallas-socrata-integration/05-RESEARCH.md` — treasury_sync_budget_tree parameters confirmed

### Primary (HIGH confidence — official documentation)

- `https://platform.claude.com/docs/en/build-with-claude/vision` — Vision API: base64 image format, content block structure, image size limits (1568px max on Haiku), cost table
- `https://platform.claude.com/docs/en/api/sdks/typescript` — SDK maxRetries option (default 2; configurable), messages.create() API, error types
- `https://platform.claude.com/docs/en/docs/about-claude/models/overview` — claude-haiku-4-5-20251001 confirmed as current Haiku model ID; $1/MTok input, $5/MTok output; 200k context window; vision supported

### Secondary (MEDIUM confidence — official sources)

- `https://www.celina-tx.gov/881/Financial-Reports` — Celina FY2025 ACFR at `/DocumentCenter/View/15082/...` (confirmed valid PDF, 6.7MB)
- `https://www.cityofallen.org/budget` — Allen FY2025 ACFR at `Documents/Departments/Finance/...FY 2025 Annual Comprehensive Financial Report.pdf` (confirmed valid PDF, 8MB, redirects to cms3.revize.com)
- `https://www.prospertx.gov/195/Financial-Transparency` — Prosper FY2025 ACFR at `ArchiveCenter/ViewFile/Item/682` (confirmed download attempt >10MB)
- `https://github.com/iqbal-rashed/pdftoimg-js` — pdftoimg-js: Node 18+, requires @napi-rs/canvas, pdfjs-dist based, DPI/format/concurrency options
- `https://www.npmjs.com/package/@napi-rs/canvas` — pre-built Windows binaries, no node-gyp, no system deps, win32-x64-msvc package available

### Tertiary (LOW confidence — WebSearch, not independently verified)

- pdf-img-convert as alternative: last published 2 years ago; still works per multiple community reports but not verified against Node 24 on Windows in this research session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @anthropic-ai/sdk confirmed installed; pdftoimg-js/napi-rs confirmed from official npm/GitHub sources
- PDF rendering on Windows: MEDIUM — pre-built binary confirmed available; not runtime-tested on this machine
- Architecture: HIGH — patterns directly derived from existing working scripts in codebase
- Haiku model ID: HIGH — confirmed from official Anthropic models overview page
- ACFR PDF URLs: MEDIUM/HIGH — Allen and Celina confirmed as valid PDFs via WebFetch; Prosper confirmed large download
- Pitfalls: MEDIUM — JSON wrapping in markdown, DPI sensitivity are confirmed patterns; ACFR structure variation is GFOA-documented
- RPC signature: HIGH — read directly from bulkLoadBudget.js which is live and working

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (ACFR URLs may change if cities post newer reports; Haiku model ID stable; SDK API stable)
