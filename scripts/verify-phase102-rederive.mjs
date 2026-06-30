#!/usr/bin/env node
/**
 * verify-phase102-rederive.mjs
 *
 * Loader-independent ACFR re-derivation harness for Phase 102 / VER-01.
 *
 * For each of the 4 upgraded states (CA/TX/NY/FL), this script independently
 * re-derives — from the state's own ACFR PDF, with a code path that does NOT
 * import any scripts/process*.js loader — the General-Fund printed totals for:
 *   - The newest displayed fiscal year (latest ACFR in the state's window)
 *   - The oldest window-bookend fiscal year (oldest confirmed FY)
 *
 * Extraction: pdftotext -table (NOT -layout) on the GF Statement of Revenues,
 * Expenditures and Changes in Fund Balances. The "Total revenues" and
 * "Total expenditures" lines in the GF column are the printed ACFR control totals.
 *
 * Comparison: Multiplied by the state's unit multiplier (NY ×1,000,000;
 * CA/TX/FL ×1,000), then diffed against treasury.budgets for that
 * (municipality_id, fiscal_year, dataset_type). PASS if abs(delta) === 0 (exact)
 * or abs(delta) <= 10_000_000 ($10M rounding fallback). FAIL otherwise.
 *
 * No loader imports. No AI calls. $0 spend. pdftotext + DB read only.
 *
 * Exit 0 = all checks tie within tolerance
 * Exit 2 = one or more checks FAIL beyond $10M band
 *
 * Usage: node scripts/verify-phase102-rederive.mjs
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join('=').trim();
        }
      }
    } catch {}
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── DB helper (native https, no supabase client) ───────────────────────────────
function dbGet(path, { head = false } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${SUPABASE_URL}${path}`);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const method = head ? 'HEAD' : 'GET';
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept-Profile': 'treasury',
    };
    if (head) {
      headers['Prefer'] = 'count=exact';
    } else {
      headers['Accept'] = 'application/json';
    }

    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers,
      agent: false,
    }, (res) => {
      if (head) {
        res.resume();
        const cr = res.headers['content-range'] || '';
        const n = parseInt(cr.split('/')[1] ?? '', 10);
        resolve(isNaN(n) ? -1 : n);
      } else {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        });
      }
    });
    req.on('error', reject);
    req.end();
  });
}

// ── PDF download helper ────────────────────────────────────────────────────────
// Downloads a PDF from url to destPath. Verifies Content-Type is application/pdf
// or that the body is at least 1 MB (soft-404 guard for CA SCO server which
// returns HTTP 200 with an HTML body for missing files).
function downloadPdf(url, destPath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TreasuryTracker-Verify/1.0)',
      },
      agent: false,
    }, (res) => {
      // Follow redirects (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers['location'];
        if (!loc) return reject(new Error(`Redirect with no Location from ${url}`));
        res.resume();
        return downloadPdf(loc, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }

      const contentType = res.headers['content-type'] || '';
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // Soft-404 guard: must be PDF content-type OR at least 1 MB
        const isPdfContentType = contentType.includes('application/pdf');
        const isLargeEnough = buf.length >= 1_000_000;
        if (!isPdfContentType && !isLargeEnough) {
          return reject(new Error(
            `Soft-404 detected for ${url}: Content-Type="${contentType}", size=${buf.length} bytes. ` +
            `Not a PDF (expected application/pdf or >=1MB body).`
          ));
        }
        fs.writeFileSync(destPath, buf);
        resolve(destPath);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── pdftotext extraction helper ────────────────────────────────────────────────
// Runs pdftotext -table -f {pageStart} -l {pageEnd} on pdfPath, returns text.
// The GF column is always the FIRST numeric column in each state's ACFR.
function extractPages(pdfPath, pageStart, pageEnd) {
  try {
    const result = execFileSync('pdftotext', [
      '-table',
      '-f', String(pageStart),
      '-l', String(pageEnd),
      pdfPath,
      '-',
    ], { maxBuffer: 10 * 1024 * 1024 });
    return result.toString('utf8');
  } catch (e) {
    throw new Error(`pdftotext failed on ${pdfPath} pp.${pageStart}-${pageEnd}: ${e.message}`);
  }
}

// ── Number parsing from pdftotext -table output ───────────────────────────────
// Given a line of text from pdftotext -table output, extract the first
// number token (strips commas, handles negative values in parens).
// Returns null if no numeric token found.
function parseFirstNumber(text) {
  // Remove leading label text, then find first number-looking token
  // pdftotext -table separates columns with spaces; numbers may have commas
  // and optionally be wrapped in parentheses (negative). We want the first
  // column-value token which is the GF (General Fund) column.
  const tokens = text.trim().split(/\s{2,}/);
  // Skip the first token (label); look for first number-like token
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i].trim().replace(/,/g, '');
    // Handle parenthetical negatives like (1,234,567)
    const paren = t.match(/^\((\d+)\)$/);
    if (paren) return -parseInt(paren[1], 10);
    const plain = t.match(/^-?\d+$/);
    if (plain) return parseInt(t, 10);
  }
  return null;
}

// More robust: scan the whole line for the FIRST standalone number
// (sequence of digits optionally with commas, optionally in parens).
// This handles cases where pdftotext does not use double-space column delimiters.
function extractFirstNumberFromLine(line) {
  // Remove label portion — everything before first number-looking run
  // Try splitting by 2+ spaces first (proper table column separation)
  const bySplit = parseFirstNumber(line);
  if (bySplit !== null) return bySplit;

  // Fallback: regex scan
  const numRe = /\([\d,]+\)|[\d]{1,3}(?:,[\d]{3})+|[\d]+/g;
  const m = line.match(numRe);
  if (!m) return null;
  const raw = m[0].replace(/,/g, '');
  if (raw.startsWith('(') && raw.endsWith(')')) {
    return -parseInt(raw.slice(1, -1), 10);
  }
  return parseInt(raw, 10);
}

// ── GF statement parser ────────────────────────────────────────────────────────
// Parses extracted pdftotext -table text to find:
//   - "Total revenues" (or "Total Revenues") line → first numeric value (GF column)
//   - "Total expenditures" (or "Total Expenditures") line → first numeric value
// Returns { revenues: number|null, expenditures: number|null }
function parseGFTotals(text) {
  const lines = text.split('\n');
  let revenues = null;
  let expenditures = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Match "Total revenues" — the line may use dot leaders (....) or spaces after the label.
    // We allow: end-of-word boundary = any non-letter character (space, dot, newline) or EOL.
    // Avoid matching "Total revenues and other sources" as a mis-parse — that's a separate check.
    if (revenues === null && lower.match(/^\s*total revenues[^a-z]/)) {
      revenues = extractFirstNumberFromLine(line);
    }
    // Also match "Total revenues and other financing sources" (NY has this variant)
    // but prefer the plain "Total revenues" match if we already got it
    if (revenues === null && lower.match(/^\s*total revenues and other/)) {
      revenues = extractFirstNumberFromLine(line);
    }

    // Match "Total expenditures" — same dot-leader tolerance
    if (expenditures === null && lower.match(/^\s*total expenditures[^a-z]/)) {
      expenditures = extractFirstNumberFromLine(line);
    }
    // Also match "Total expenditures and other financing uses" (NY variant)
    if (expenditures === null && lower.match(/^\s*total expenditures and other/)) {
      expenditures = extractFirstNumberFromLine(line);
    }
  }

  return { revenues, expenditures };
}

// ── 8-target config ───────────────────────────────────────────────────────────
// Each target:
//   state         — state abbreviation
//   label         — display label
//   municipalityId — treasury.municipalities id (TX = null, looked up by name)
//   txLookupName  — name to look up (TX only)
//   fiscalYear    — fiscal year
//   url           — durable PDF URL
//   pdfPageStart  — first PDF page of the GF statement (pdftotext 1-based)
//   pdfPageEnd    — last PDF page of the GF statement
//   gfColLabel    — GF column label (informational)
//   units         — multiplier to convert printed number → dollars
//   cacheDir      — _acfr-tmp/ subdirectory
//   cacheFile     — filename for the cached PDF

const TARGETS = [
  // CA FY2025 — newest displayed FY
  {
    state: 'CA', label: 'California FY2025', municipalityId: 'e1007bf5-bac9-4b1c-878e-f6834885f850',
    fiscalYear: 2025,
    url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr25web.pdf',
    pdfPageStart: 64, pdfPageEnd: 65,
    gfColLabel: 'General (1st col)',
    units: 1_000,
    cacheDir: '_acfr-tmp/ca', cacheFile: 'ca-acfr-2025.pdf',
  },
  // CA FY2020 — oldest window bookend
  {
    state: 'CA', label: 'California FY2020', municipalityId: 'e1007bf5-bac9-4b1c-878e-f6834885f850',
    fiscalYear: 2020,
    url: 'https://www.sco.ca.gov/Files-ARD/ACFR/acfr20web.pdf',
    pdfPageStart: 66, pdfPageEnd: 67,
    gfColLabel: 'General (1st col)',
    units: 1_000,
    cacheDir: '_acfr-tmp/ca', cacheFile: 'ca-acfr-2020.pdf',
  },
  // TX FY2024 — newest displayed FY
  {
    state: 'TX', label: 'Texas FY2024', municipalityId: null, txLookupName: 'Texas',
    fiscalYear: 2024,
    url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2024/96-471.pdf',
    pdfPageStart: 52, pdfPageEnd: 53,
    gfColLabel: 'General Revenue Fund (1st col)',
    units: 1_000,
    cacheDir: '_acfr-tmp/tx', cacheFile: 'tx-acfr-2024.pdf',
  },
  // TX FY2015 — oldest window bookend
  {
    state: 'TX', label: 'Texas FY2015', municipalityId: null, txLookupName: 'Texas',
    fiscalYear: 2015,
    url: 'https://comptroller.texas.gov/transparency/reports/comprehensive-annual-financial/2015/96-471.pdf',
    pdfPageStart: 48, pdfPageEnd: 49,
    gfColLabel: 'General Revenue Fund (1st col)',
    units: 1_000,
    cacheDir: '_acfr-tmp/tx', cacheFile: 'tx-acfr-2015.pdf',
  },
  // NY FY2024 — newest displayed FY (millions!)
  {
    state: 'NY', label: 'New York FY2024', municipalityId: '1a7f871c-7f2e-4786-9c55-5ab3409716f4',
    fiscalYear: 2024,
    url: 'https://www.osc.ny.gov/files/reports/finance/pdf/annual-comprehensive-financial-report-2024.pdf',
    pdfPageStart: 44, pdfPageEnd: 45,
    gfColLabel: 'General (1st col, MILLIONS)',
    units: 1_000_000,
    cacheDir: '_acfr-tmp/ny', cacheFile: 'ny-acfr-2024.pdf',
  },
  // NY FY2015 — oldest window bookend (millions!)
  {
    state: 'NY', label: 'New York FY2015', municipalityId: '1a7f871c-7f2e-4786-9c55-5ab3409716f4',
    fiscalYear: 2015,
    url: 'https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-2015.pdf',
    pdfPageStart: 37, pdfPageEnd: 38,
    gfColLabel: 'General (1st col, MILLIONS)',
    units: 1_000_000,
    cacheDir: '_acfr-tmp/ny', cacheFile: 'ny-acfr-2015.pdf',
  },
  // FL FY2024 — newest displayed FY
  {
    state: 'FL', label: 'Florida FY2024', municipalityId: 'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a',
    fiscalYear: 2024,
    url: 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-2024-state-of-florida-annual-comprehensive-financial-report.pdf',
    pdfPageStart: 36, pdfPageEnd: 37,
    gfColLabel: 'General Fund (1st col)',
    units: 1_000,
    cacheDir: '_acfr-tmp/fl', cacheFile: 'fl-acfr-2024.pdf',
  },
  // FL FY2022 — oldest window bookend
  {
    state: 'FL', label: 'Florida FY2022', municipalityId: 'adb19ea0-de7c-4cd5-9445-cbf2108a8a1a',
    fiscalYear: 2022,
    url: 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-2022-state-of-florida-annual-comprehensive-financial-report.pdf',
    pdfPageStart: 38, pdfPageEnd: 39,
    gfColLabel: 'General Fund (1st col)',
    units: 1_000,
    cacheDir: '_acfr-tmp/fl', cacheFile: 'fl-acfr-2022.pdf',
  },
];

// ── Tolerance check ───────────────────────────────────────────────────────────
const EXACT_THRESHOLD = 0;
const ROUNDING_BAND   = 10_000_000; // $10M

function verdict(delta) {
  const abs = Math.abs(delta);
  if (abs === EXACT_THRESHOLD) return 'PASS (exact)';
  if (abs <= ROUNDING_BAND)    return `PASS (Δ=${fmt(delta)} within $10M band)`;
  return `FAIL (Δ=${fmt(delta)} exceeds $10M band)`;
}

function fmt(n) {
  if (n === null || n === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtRaw(n) {
  if (n === null || n === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('');
console.log('Phase 102 — Loader-Independent ACFR Re-Derivation Harness');
console.log('VER-01: CA/TX/NY/FL newest + bookend FYs re-derived from ACFR PDFs');
console.log('');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
  ].filter(Boolean).join(', ');
  console.error(`ERROR: Missing env vars: ${missing}`);
  console.error('       Load .env.local or .env before running this script.');
  process.exit(1);
}

// ── Step 1: Look up TX municipality_id by name ────────────────────────────────
console.log('── Step 1: Resolve TX municipality_id ──────────────────────────────────────');
let txMunicipalityId = null;
try {
  const rows = await dbGet(
    `/rest/v1/municipalities?entity_type=eq.state&name=eq.Texas&select=id,name`
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No row returned for Texas state entity');
  }
  txMunicipalityId = rows[0].id;
  console.log(`  Texas municipality_id = ${txMunicipalityId}`);
} catch (e) {
  console.error(`  ERROR resolving TX municipality_id: ${e.message}`);
  process.exit(1);
}

// Inject TX municipality_id into targets
for (const t of TARGETS) {
  if (t.state === 'TX' && t.municipalityId === null) {
    t.municipalityId = txMunicipalityId;
  }
}

// ── Step 2: Process each target ───────────────────────────────────────────────
console.log('');
console.log('── Step 2: Extract + query each target ─────────────────────────────────────');

const checks = []; // Will hold { label, dataset, acfrPrinted, stored, delta, pass, verdictStr, notes }

for (const target of TARGETS) {
  console.log('');
  console.log(`  Processing: ${target.label}`);

  // Ensure cache dir exists
  const cacheDir = resolve(PROJECT_ROOT, target.cacheDir);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const pdfPath = resolve(cacheDir, target.cacheFile);

  // Ensure PDF is present
  if (existsSync(pdfPath)) {
    console.log(`    PDF cached: ${target.cacheFile}`);
  } else {
    console.log(`    Downloading: ${target.url}`);
    try {
      await downloadPdf(target.url, pdfPath);
      const stats = fs.statSync(pdfPath);
      console.log(`    Downloaded: ${target.cacheFile} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (e) {
      console.error(`    ERROR downloading PDF: ${e.message}`);
      for (const dataset of ['revenue', 'operating']) {
        checks.push({
          label: target.label,
          dataset,
          acfrPrinted: null,
          stored: null,
          delta: null,
          pass: false,
          verdictStr: `FAIL (PDF download error: ${e.message})`,
          notes: '',
        });
      }
      continue;
    }
  }

  // Run FRESH pdftotext -table extraction
  let rawText;
  try {
    rawText = extractPages(pdfPath, target.pdfPageStart, target.pdfPageEnd);
    console.log(`    pdftotext -table pp.${target.pdfPageStart}-${target.pdfPageEnd}: ${rawText.length} chars`);
  } catch (e) {
    console.error(`    ERROR extracting PDF: ${e.message}`);
    for (const dataset of ['revenue', 'operating']) {
      checks.push({
        label: target.label,
        dataset,
        acfrPrinted: null,
        stored: null,
        delta: null,
        pass: false,
        verdictStr: `FAIL (pdftotext error: ${e.message})`,
        notes: '',
      });
    }
    continue;
  }

  // Parse GF printed totals
  const { revenues: rawRevenues, expenditures: rawExpenditures } = parseGFTotals(rawText);
  console.log(`    Parsed GF column (${target.gfColLabel}):`);
  console.log(`      Total revenues (printed):     ${rawRevenues !== null ? fmtRaw(rawRevenues) : 'NOT FOUND'}`);
  console.log(`      Total expenditures (printed): ${rawExpenditures !== null ? fmtRaw(rawExpenditures) : 'NOT FOUND'}`);

  // Apply units to get dollars
  const acfrRevenues     = rawRevenues     !== null ? rawRevenues     * target.units : null;
  const acfrExpenditures = rawExpenditures !== null ? rawExpenditures * target.units : null;

  // Query treasury.budgets for stored totals
  for (const { dataset, acfrDollars } of [
    { dataset: 'revenue',   acfrDollars: acfrRevenues },
    { dataset: 'operating', acfrDollars: acfrExpenditures },
  ]) {
    let stored = null;
    let notes = '';

    try {
      const path = `/rest/v1/budgets?municipality_id=eq.${target.municipalityId}&fiscal_year=eq.${target.fiscalYear}&dataset_type=eq.${dataset}&select=total_budget`;
      const rows = await dbGet(path);
      if (!Array.isArray(rows) || rows.length === 0) {
        notes = 'No row found in treasury.budgets';
        console.log(`      ${dataset}: no DB row found`);
      } else {
        stored = rows[0].total_budget;
        console.log(`      ${dataset}: stored = ${fmt(stored)}`);
      }
    } catch (e) {
      notes = `DB query error: ${e.message}`;
      console.error(`      ${dataset}: DB error: ${e.message}`);
    }

    let delta = null;
    let pass = false;
    let verdictStr = '';

    if (acfrDollars === null) {
      verdictStr = 'FAIL (pdftotext parse: Total revenues/expenditures not found)';
      pass = false;
    } else if (stored === null) {
      verdictStr = `FAIL (no DB row: ${notes || 'no row found'})`;
      pass = false;
    } else {
      delta = acfrDollars - stored;
      verdictStr = verdict(delta);
      pass = verdictStr.startsWith('PASS');
    }

    checks.push({
      label: target.label,
      dataset,
      acfrPrinted: rawRevenues !== null || rawExpenditures !== null
        ? (dataset === 'revenue' ? rawRevenues : rawExpenditures)
        : null,
      acfrDollars,
      stored,
      delta,
      pass,
      verdictStr,
      notes,
    });
  }
}

// ── Step 3: Print comparison table ───────────────────────────────────────────
console.log('');
console.log('── Comparison Table ─────────────────────────────────────────────────────────');
console.log('');

const COL_LABEL   = 26;
const COL_DS      = 10;
const COL_PRINTED = 20;
const COL_STORED  = 20;
const COL_DELTA   = 16;
const COL_VERDICT = 42;

function padR(s, n) { return String(s ?? 'N/A').padEnd(n); }
function padL(s, n) { return String(s ?? 'N/A').padStart(n); }

const header = [
  padR('State / FY', COL_LABEL),
  padR('Dataset', COL_DS),
  padL('ACFR Printed ($)', COL_PRINTED),
  padL('Stored ($)', COL_STORED),
  padL('Delta ($)', COL_DELTA),
  'Verdict',
].join('  ');

const separator = '-'.repeat(header.length);
console.log(header);
console.log(separator);

let failures = 0;
for (const c of checks) {
  const row = [
    padR(c.label, COL_LABEL),
    padR(c.dataset, COL_DS),
    padL(c.acfrDollars !== null ? fmtRaw(c.acfrDollars) : 'N/A', COL_PRINTED),
    padL(c.stored !== null ? fmtRaw(c.stored) : 'N/A', COL_STORED),
    padL(c.delta !== null ? fmtRaw(c.delta) : 'N/A', COL_DELTA),
    c.verdictStr,
  ].join('  ');
  console.log(row);
  if (!c.pass) failures++;
}

console.log(separator);
console.log('');

const total = checks.length;
const passed = checks.filter(c => c.pass).length;
console.log(`  ${passed} / ${total} checks PASS`);
if (failures > 0) {
  console.log(`  ${failures} / ${total} checks FAIL`);
}

// ── Step 4: Summarize failures (routed for 102-02) ───────────────────────────
if (failures > 0) {
  console.log('');
  console.log('── Failures (routed for 102-02 or escalation) ──────────────────────────────');
  for (const c of checks) {
    if (!c.pass) {
      console.log(`  FAIL: ${c.label} / ${c.dataset}`);
      console.log(`        ACFR printed: ${c.acfrDollars !== null ? fmt(c.acfrDollars) : 'N/A'}`);
      console.log(`        Stored:       ${c.stored !== null ? fmt(c.stored) : 'N/A'}`);
      console.log(`        Delta:        ${c.delta !== null ? fmt(c.delta) : 'N/A'}`);
      console.log(`        Verdict:      ${c.verdictStr}`);
      if (c.notes) console.log(`        Notes:        ${c.notes}`);
    }
  }
}

console.log('');
if (failures === 0) {
  console.log('PASS — All Phase 102 re-derivation checks tie within tolerance (VER-01 reconciliation half satisfied)');
  process.exit(0);
} else {
  console.log(`FAIL — ${failures} of ${total} re-derivation checks failed beyond $10M band`);
  process.exit(2);
}
