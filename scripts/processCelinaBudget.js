#!/usr/bin/env node
/**
 * Celina FY2025 Operating Expenditure Extractor
 *
 * Extracts General Fund expenditures from Celina's FY2025 ACFR PDF using
 * pdftotext — no AI API calls, pure text parsing.
 *
 * Source section:
 *   "Statement of Revenues, Expenditures, and Changes in Fund Balances
 *    Budget and Actual - General Fund"
 *   (page 25 in the FY2025 ACFR, sentence-case headers)
 *
 * PDF layout note:
 *   pdftotext -layout produces a garbled two-column output for this page.
 *   pdftotext -raw correctly reads the rows in order:
 *     [label]  [original_budget]  [final_budget]  [actual]  [variance]
 *
 *   Column mapping:
 *     adopted_amount = original_budget (col 1)
 *     actual_amount  = actual (col 3)
 *
 * Expected totals (from ACFR page 25):
 *   Total expenditures (original): $52,155,745
 *   Total expenditures (actual):   $50,972,223
 *
 * Sanity check: ~$50-60M for a city of ~51,000 people (~$1,000/person)
 *
 * Usage:
 *   node scripts/processCelinaBudget.js              # production (loads to DB)
 *   node scripts/processCelinaBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processCelinaBudget.js --verbose    # log parse decisions
 *   node scripts/processCelinaBudget.js --no-cache   # re-download even if cache exists
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025';
const CACHE_PATH = 'C:/tmp/celina_acfr_fy2025.pdf';
const FISCAL_YEAR = 2025;

// Expected total expenditures (Original Budget) for validation
const EXPECTED_TOTAL = 52_155_745;
const TOLERANCE = 0.05; // 5% — tight because we know exact values from raw mode

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Parse money token ─────────────────────────────────────────────────────────
// Handles: "12,010,754"  "(2,161,383)"  "-"  ""
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── Extract PDF text via pdftotext -raw ───────────────────────────────────────
// -raw mode reads words in order; correctly handles the two-column B&A page
function extractPdfText(pdfPath) {
  try {
    const text = execSync(`pdftotext -raw "${pdfPath}" -`, {
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf8',
    });
    // Strip form-feed chars that prefix new pages
    return text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);
  } catch (e) {
    console.error('pdftotext error:', e.message.slice(0, 300));
    return null;
  }
}

// ── Find the Budget and Actual - General Fund section ─────────────────────────
// Returns the line index of "Budget and Actual - General Fund", or -1 if not found.
function findBudgetActualSection(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/Budget and Actual - General Fund/.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

// ── Parse expenditure line items ──────────────────────────────────────────────
//
// Strategy (using -raw mode output):
//   After "Budget and Actual - General Fund", scan for the "Expenditures" header.
//   Parse each labeled line: [label] [original] [final] [actual] [variance]
//   Where tokens are space-separated on each line (some have 4 values, some 2).
//
//   Column positions (0-based after stripping label):
//     col[0] = Original Budget  → adopted_amount
//     col[2] = Actual           → actual_amount
//
//   Some rows have dashes ("-") meaning $0 — treat as 0, not null.
//
//   Stop parsing at "Total expenditures" (captures the section total for validation),
//   then continue to "Excess" or "Other Financing" which signals section end.
//
// Returns { rows: [{label, adoptedAmount, actualAmount}], total: number }
// where total is the value from the "Total expenditures" line itself.
function parseExpenditureLines(lines, sectionStart, verbose) {
  const rows = [];
  let inExpenditures = false;
  let totalExpenditures = null;
  const nLines = lines.length;

  for (let i = sectionStart; i < nLines; i++) {
    const line = lines[i];
    const t = line.trim();

    // Skip blank lines
    if (!t) continue;

    // Enter expenditures subsection
    if (!inExpenditures) {
      if (/^Expenditures\s*$/.test(t)) {
        inExpenditures = true;
        if (verbose) console.error(`[section-start] Line ${i}: Expenditures section found`);
        continue;
      }
      continue;
    }

    // Stop at "Excess (deficiency) of revenues" or "Other Financing" — end of expenditure block
    if (/^Excess\b/i.test(t) || /^Other Financing/i.test(t)) {
      if (verbose) console.error(`[section-end] Line ${i}: "${t.slice(0, 60)}" — stopping parse`);
      break;
    }

    // Skip "Current:" and "Debt service:" sub-header lines (no numbers)
    if (/^Current:\s*$/.test(t) || /^Debt service:\s*$/.test(t)) {
      if (verbose) console.error(`[skip-header] Line ${i}: "${t}"`);
      continue;
    }

    // Capture "Total expenditures" for validation
    if (/^Total expenditures\b/i.test(t)) {
      // Extract numbers from this line
      const nums = extractNumbers(t);
      if (nums.length >= 1) {
        // Format: "Total expenditures 52,155,745 55,408,021 50,972,223 4,716,774"
        totalExpenditures = nums[0]; // Original budget
        if (verbose) console.error(`[total-line] Line ${i}: "Total expenditures" original=${nums[0]?.toLocaleString()} actual=${nums[2]?.toLocaleString()}`);
      }
      // Do not add to rows — this is the validation anchor
      continue;
    }

    // Parse a labeled expenditure line
    // In -raw mode, format is: "Label words... number number number number"
    // e.g. "Administration 12,010,754 13,043,414 12,214,665 828,749"
    // Some have only 2 numbers (e.g. debt service items where adopted = 0)
    // Some have "-" for zero values e.g. "Capital outlay - - 916,595 (916,595)"

    // Extract the label (leading text before first digit or dash-space)
    const labelMatch = /^([A-Za-z][A-Za-z\s,&()\/\-]*?)(?=\s+[\d\-\(])/.exec(t);
    if (!labelMatch) {
      if (verbose) console.error(`[skip-nolabel] Line ${i}: "${t.slice(0, 60)}"`);
      continue;
    }

    const rawLabel = labelMatch[1].trim();
    if (!rawLabel || rawLabel.length < 2) {
      if (verbose) console.error(`[skip-short-label] Line ${i}: "${t.slice(0, 60)}"`);
      continue;
    }

    // Extract all numeric tokens after the label (including dashes as zero)
    const afterLabel = t.slice(labelMatch[0].length);
    const tokens = afterLabel.trim().split(/\s+/);

    // Parse each token: number, dash (=0), or paren-negative
    const values = tokens.map(tok => {
      if (tok === '-') return 0;
      return parseMoney(tok);
    }).filter(v => v !== null);

    if (values.length === 0) {
      if (verbose) console.error(`[skip-novalue] Line ${i}: "${rawLabel}" — no numeric values found`);
      continue;
    }

    // Column layout:
    //   values[0] = Original Budget  → adopted_amount
    //   values[1] = Final Budget
    //   values[2] = Actual            → actual_amount
    //   values[3] = Variance with Final Budget
    //
    // Some rows (e.g. "Capital outlay - - 916,595 (916,595)") have dashes at start
    // so values may be: [0, 0, 916595, -916595]
    // We always use values[0] for adopted and values[2] for actual.
    // If fewer than 3 values: use values[0] as both adopted and actual.
    const adopted = values[0] ?? 0;
    const actual  = values.length >= 3 ? (values[2] ?? null) : (values[0] ?? null);

    if (verbose) {
      console.error(`[item] Line ${i}: "${rawLabel}" adopted=${adopted.toLocaleString()} actual=${actual?.toLocaleString() ?? 'null'} tokens=[${tokens.join(', ')}]`);
    }

    rows.push({ label: rawLabel, adoptedAmount: adopted, actualAmount: actual });
  }

  return { rows, totalExpenditures };
}

// ── Extract numeric tokens from a line ────────────────────────────────────────
// Returns array of numbers (dashes = 0, parens = negative)
function extractNumbers(line) {
  const results = [];
  const re = /(\()?([\d,]+)\)?/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const v = parseMoney(m[0]);
    if (v !== null) results.push(v);
  }
  return results;
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
// Format: [{n, a, c: [{n, a, i: [{d, a, aa, f, e}]}]}]
function buildTree(rows) {
  const fund = 'General Fund';

  const children = [];
  let total = 0;

  for (const row of rows) {
    const a  = Number(row.adoptedAmount) || 0;
    const aa = row.actualAmount != null ? Number(row.actualAmount) : null;
    // Include rows even if adopted=0 but actual>0 (e.g. Capital outlay)
    if (a === 0 && (aa === null || aa === 0)) continue;

    children.push({
      n: row.label,
      a: a,
      i: [{
        d: row.label,
        a: a,
        aa: aa,
        f: fund,
        e: null,
      }],
    });
    total += a;
  }

  children.sort((a, b) => b.a - a.a);

  const jsonTree = [{
    n: 'General Fund Expenditures',
    a: total,
    c: children,
  }];

  return { jsonTree, total };
}

// ── Validate extracted total against expected ─────────────────────────────────
function validateTotal(extracted, expected) {
  const diff = Math.abs(extracted - expected) / expected;
  const pct  = (diff * 100).toFixed(2);
  console.log(`Validation:`);
  console.log(`  Extracted (from line items): $${Math.round(extracted).toLocaleString()}`);
  console.log(`  Expected  (ACFR page total): $${Math.round(expected).toLocaleString()}`);
  console.log(`  Difference: ${pct}%  (tolerance: ${(TOLERANCE * 100).toFixed(0)}%)`);
  return diff <= TOLERANCE;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run':  { type: 'boolean', default: false },
      'verbose':  { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const dryRun  = opts['dry-run'];
  const verbose = opts['verbose'];
  const noCache = opts['no-cache'];

  // ── Supabase client ──────────────────────────────────────────────────────────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ──────────────────────────────────────────────────────
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Celina').single();
  if (muniErr || !muni) {
    console.error('Could not find Celina municipality:', muniErr?.message);
    process.exit(2);
  }
  const muniId = muni.id;
  console.log(`Municipality: ${muni.name} (${muniId})\n`);

  // ── Download or use cached PDF ────────────────────────────────────────────────
  const cacheExists = fs.existsSync(CACHE_PATH);
  if (!cacheExists || noCache) {
    console.log(`Downloading PDF from ${PDF_URL} ...`);
    const resp = await fetch(PDF_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf,*/*' },
    });
    if (!resp.ok) {
      console.error(`Download failed: HTTP ${resp.status} ${resp.statusText}`);
      process.exit(2);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const cacheDir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, buf);
    console.log(`Saved to ${CACHE_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`Using cached PDF: ${CACHE_PATH}`);
  }

  // ── Extract PDF text (using -raw mode for correct column order) ───────────────
  console.log('Extracting text with pdftotext -raw...');
  const lines = extractPdfText(CACHE_PATH);
  if (!lines) {
    console.error('pdftotext failed');
    process.exit(2);
  }
  console.log(`  Total lines: ${lines.length}`);

  // ── Find Budget and Actual section ────────────────────────────────────────────
  const sectionIdx = findBudgetActualSection(lines);
  if (sectionIdx < 0) {
    console.error('ERROR: Could not find "Budget and Actual - General Fund" section');
    process.exit(2);
  }
  console.log(`  Section found at line ${sectionIdx}: "${lines[sectionIdx].trim()}"`);

  // ── Parse expenditure lines ───────────────────────────────────────────────────
  console.log('Parsing expenditure lines...');
  const { rows, totalExpenditures } = parseExpenditureLines(lines, sectionIdx, verbose);

  if (rows.length === 0) {
    console.error('ERROR: No expenditure rows parsed from section');
    process.exit(2);
  }
  console.log(`  Expenditure line items parsed: ${rows.length}`);
  if (totalExpenditures !== null) {
    console.log(`  "Total expenditures" from ACFR: $${Math.round(totalExpenditures).toLocaleString()}`);
  }

  // ── Build tree and compute total ──────────────────────────────────────────────
  const { jsonTree, total } = buildTree(rows);

  // ── Print expenditure line items ──────────────────────────────────────────────
  console.log('\nExpenditure Line Items:');
  console.log('─'.repeat(80));
  console.log(`${'Label'.padEnd(40)} ${'Adopted ($)'.padStart(16)}  ${'Actual ($)'.padStart(16)}`);
  console.log('─'.repeat(80));
  for (const row of rows) {
    const adoptedStr = row.adoptedAmount != null ? Math.round(row.adoptedAmount).toLocaleString() : '—';
    const actualStr  = row.actualAmount  != null ? Math.round(row.actualAmount).toLocaleString()  : '—';
    console.log(`${row.label.padEnd(40)} ${adoptedStr.padStart(16)}  ${actualStr.padStart(16)}`);
  }
  console.log('─'.repeat(80));
  console.log(`${'TOTAL (sum of items)'.padEnd(40)} ${Math.round(total).toLocaleString().padStart(16)}\n`);

  // ── Sanity check on per-capita ────────────────────────────────────────────────
  const POPULATION = 51_661;
  const perCapita = Math.round(total / POPULATION);
  console.log(`Per-capita check: $${Math.round(total).toLocaleString()} / ${POPULATION.toLocaleString()} = $${perCapita.toLocaleString()}/person`);
  const SANITY_MIN = 30_000_000;
  const SANITY_MAX = 150_000_000;
  if (total < SANITY_MIN || total > SANITY_MAX) {
    console.error(`SANITY FAIL: Total $${Math.round(total).toLocaleString()} is outside $30M–$150M range for a city of ~51k people`);
    console.error('Check parse logic or section detection. DB will NOT be updated.');
    process.exit(2);
  }
  console.log(`Sanity check: PASS ($${Math.round(total).toLocaleString()} in $30M–$150M range)\n`);

  // ── Validate total against ACFR total expenditures line ──────────────────────
  // Use the "Total expenditures" line from the ACFR as our expected value
  const expectedForValidation = totalExpenditures ?? EXPECTED_TOTAL;
  const valid = validateTotal(total, expectedForValidation);
  if (!valid) {
    console.error('\nVALIDATION FAILED — Celina FY2025 operating budget NOT loaded to DB.');
    console.error('Extracted total is outside tolerance. Check parse logic.');
    process.exit(2);
  }
  console.log('\nVALIDATION PASSED');

  if (dryRun) {
    console.log('\n(dry-run — skipping DB writes)');
    return;
  }

  // ── Data source lookup (existing row — do NOT create new row) ─────────────────
  const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources')
    .select('id, last_synced_at')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2025')
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (dsErr) {
    console.error('data_sources lookup error:', dsErr.message);
    process.exit(2);
  }
  if (!ds) {
    console.error('ERROR: No data_source row found for Celina FY2025 operating (composite key lookup failed).');
    console.error('Expected: municipality_id=' + muniId + ', api_type=pdf_download, dataset_id=fy2025, dataset_type=operating');
    process.exit(2);
  }
  console.log(`\ndata_source: ${ds.id} (last_synced_at: ${ds.last_synced_at || 'null'})`);

  // ── Clear old Haiku data (data_source_id = null) ──────────────────────────────
  const { error: delNullErr } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muniId)
    .eq('fiscal_year', FISCAL_YEAR)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);
  if (delNullErr) {
    console.error('Delete old null-source rows failed:', delNullErr.message);
    process.exit(2);
  }
  console.log('Cleared old Haiku data (data_source_id = null)');

  // ── Clear any prior rows linked to this data_source ───────────────────────────
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('data_source_id', ds.id)
    .eq('fiscal_year', FISCAL_YEAR);
  if (delErr) {
    console.error('Delete prior linked rows failed:', delErr.message);
    process.exit(2);
  }

  // ── Call treasury_sync_budget_tree RPC ────────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    FISCAL_YEAR,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           jsonTree,
    p_row_count:      rows.length,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)           { console.error('RPC error:', rpcErr.message); process.exit(2); }
  if (rpcResult?.error) { console.error('RPC returned error:', rpcResult.error); process.exit(2); }

  const inserted = rpcResult?.rows_inserted ?? rows.length;
  console.log(`Loaded ${inserted} rows for FY${FISCAL_YEAR} (total $${Math.round(total).toLocaleString()})`);

  // ── Set last_synced_at ─────────────────────────────────────────────────────────
  const { error: syncErr } = await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', ds.id);
  if (syncErr) {
    console.error('last_synced_at update error:', syncErr.message);
    // Non-fatal
  } else {
    console.log(`last_synced_at set for data_source ${ds.id}`);
  }

  console.log(`\nDone. Celina FY${FISCAL_YEAR} operating budget loaded successfully.`);
  console.log(`Total: $${Math.round(total).toLocaleString()} ($${perCapita.toLocaleString()}/person)`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
