#!/usr/bin/env node
/**
 * Prosper Operating Budget Extractor — Multi-FY
 *
 * Extracts General Fund operating expenditures from Prosper ACFR PDFs
 * (FY2023, FY2024, FY2025) using pdftotext -raw — no AI/API calls.
 *
 * Targets the "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCE —
 * GENERAL FUND — BUDGET AND ACTUAL" section, EXPENDITURES subsection.
 *
 * === WHY -raw MODE ===
 *
 * The GF B&A statement spans two physical PDF pages side-by-side (ACFR pages 29-30):
 *   - Page 29: Original Budget | Final Budget | Actual Amounts (GAAP Basis)
 *   - Page 30: Adjustment | Actual Budget Basis | Variance
 *
 * pdftotext -layout FAILS for this PDF: it renders both pages together and the
 * right page bleeds its values into the left page column positions, producing
 * garbled labels and wrong values.
 *
 * pdftotext -raw reads words in document order, producing one line per ACFR row:
 *   "Administration 10,928,574 10,817,388 10,300,769"
 * This correctly isolates each department name and its three budget columns.
 *
 * === COLUMN MAPPING ===
 *
 * Raw token order per line: [label...] [original] [final] [actual]
 *   adopted_amount = original budget (token index 0 after label)
 *   actual_amount  = actual (token index 2 after label)
 *
 * Usage:
 *   node scripts/processProsperjBudget.js              # all three FYs
 *   node scripts/processProsperjBudget.js --fy 2025    # single FY
 *   node scripts/processProsperjBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processProsperjBudget.js --verbose    # log parse decisions to stderr
 *   node scripts/processProsperjBudget.js --no-cache   # re-download even if cached
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Per-FY configuration ───────────────────────────────────────────────────────
const PDF_URLS = {
  2025: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682',
  2024: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/574',
  2023: 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/489',
};

const CACHE_PATHS = {
  2025: 'C:/tmp/prosper_acfr_fy2025.pdf',
  2024: 'C:/tmp/prosper_acfr_fy2024.pdf',
  2023: 'C:/tmp/prosper_acfr_fy2023.pdf',
};

// Expected total expenditures (Original Budget) from ACFR GF B&A section.
// FY2025: from ACFR page 29 "Total expenditures" original budget column.
// FY2024: from ACFR "Total expenditures" = 49,027,952 (original budget).
// FY2023: from ACFR "Total expenditures" = 44,052,927 (original budget).
const EXPECTED_TOTALS = {
  2025: 53_010_770,
  2024: 49_027_952,
  2023: 44_052_927,
};

const TOLERANCE = 0.05; // 5% — tight because -raw gives clean values

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Population for per-capita check (2024 estimate — used for all three FYs for consistency)
const POPULATION = 44_503;

// ── parseMoney ─────────────────────────────────────────────────────────────────
// Handles: "12,010,754"  "(2,161,383)"  "-"  "$"  ""
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-' || t === '$') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── extractPdfText ─────────────────────────────────────────────────────────────
// Uses -raw mode to read words in document order — avoids column bleed.
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

// ── findBudgetSection ─────────────────────────────────────────────────────────
// Locates the GF Budget-and-Actual EXPENDITURES section.
//
// Strategy A (FY2024, FY2025): Find "STATEMENT OF REVENUES, EXPENDITURES..."
//   followed by "GENERAL FUND" and "BUDGET AND ACTUAL" within 15 lines.
//   Return that line index so parseExpenditureLines can scan forward for EXPENDITURES.
//
// Strategy B (FY2023): The GF B&A data appears BEFORE the section title in -raw
//   output (two-page spread: data page renders first, title page renders second).
//   Detect by finding the column header "Budget Budget GAAP Basis" which
//   immediately precedes the REVENUES / EXPENDITURES data.
//   Return the column-header line so parseExpenditureLines scans forward correctly.
//
// Returns the line index to start scanning from, or -1 if not found.
function findBudgetSection(lines, verbose) {
  // Strategy B (checked first): FY2023 — the GF B&A data appears BEFORE its section
  // title in -raw output. The column header "Budget Budget GAAP Basis" immediately
  // precedes the REVENUES section. Check for this pattern first.
  for (let i = 0; i < lines.length; i++) {
    if (!/^Budget Budget GAAP Basis/.test(lines[i].trim())) continue;
    // Confirm by looking for REVENUES section nearby
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      if (/^REVENUES\s*$/.test(lines[j].trim())) {
        if (verbose) console.error(`[section-found] GF B&A section at line ${i} (strategy B — FY2023 layout)`);
        return i;
      }
    }
  }

  // Strategy A: standard layout (FY2024, FY2025) — section title followed by data
  for (let i = 0; i < lines.length; i++) {
    if (!/STATEMENT OF REVENUES, EXPENDITURES/.test(lines[i])) continue;

    let foundGF = false;
    let foundBA = false;
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const t = lines[j].trim();
      if (/^GENERAL FUND\s*$/.test(t)) foundGF = true;
      if (/^BUDGET AND ACTUAL\s*$/.test(t)) foundBA = true;
      if (foundGF && foundBA) {
        if (verbose) console.error(`[section-found] GF B&A section at line ${i} (strategy A)`);
        return i;
      }
    }
  }

  return -1;
}

// ── parseExpenditureLines ─────────────────────────────────────────────────────
// Parses expenditure line items from the GF Budget-and-Actual EXPENDITURES section.
//
// In -raw mode, each line is: "Label words... original final actual"
// e.g. "Administration 10,928,574 10,817,388 10,300,769"
//      "Capital outlay - - 1,349,727"
//      "Interest and fiscal charges - - 30,515"
//
// Column mapping:
//   values[0] = Original Budget  → adopted_amount
//   values[2] = Actual            → actual_amount (GAAP basis)
//
// Stops at: "Total expenditures", "Excess", "OTHER FINANCING", or MAX_SCAN_LINES.
//
// Returns: { rows: [{label, adoptedAmount, actualAmount}], totalExpenditures }
function parseExpenditureLines(lines, sectionStart, verbose) {
  const rows = [];
  let inExpenditures = false;
  let totalExpenditures = null;
  const nLines = lines.length;

  for (let i = sectionStart; i < nLines && i < sectionStart + 200; i++) {
    const line = lines[i];
    const t = line.trim();

    if (!t) continue;

    // Enter expenditures subsection
    if (!inExpenditures) {
      if (/^EXPENDITURES\s*$/.test(t)) {
        inExpenditures = true;
        if (verbose) console.error(`[section-start] Line ${i}: EXPENDITURES section found`);
        continue;
      }
      continue;
    }

    // Stop at "Excess (deficiency)" or "OTHER FINANCING"
    if (/^Excess\b/i.test(t) || /^OTHER FINANCING/i.test(t)) {
      if (verbose) console.error(`[section-end] Line ${i}: "${t.slice(0, 60)}" — stopping`);
      break;
    }

    // Skip "Current:" and "Debt service:" sub-header lines
    if (/^Current:\s*$/.test(t) || /^Debt service:\s*$/.test(t)) {
      if (verbose) console.error(`[skip-header] Line ${i}: "${t}"`);
      continue;
    }

    // Capture "Total expenditures" for validation (do not add to rows)
    if (/^Total expenditures\b/i.test(t)) {
      const nums = extractNumbers(t);
      if (nums.length >= 1) {
        totalExpenditures = nums[0];
        if (verbose) console.error(`[total-line] Line ${i}: Total expenditures original=${nums[0]?.toLocaleString()} actual=${nums[2]?.toLocaleString()}`);
      }
      continue;
    }

    // Parse a labeled expenditure line
    // Format: "Label words... number number number [number]"
    // Extract label (leading text before first digit/dash-digit/paren-digit)
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

    // Extract numeric tokens after the label (dashes = 0)
    const afterLabel = t.slice(labelMatch[0].length);
    const tokens = afterLabel.trim().split(/\s+/);
    const values = tokens.map(tok => {
      if (tok === '-') return 0;
      return parseMoney(tok);
    }).filter(v => v !== null);

    if (values.length === 0) {
      if (verbose) console.error(`[skip-novalue] Line ${i}: "${rawLabel}" — no numeric values`);
      continue;
    }

    // Column mapping:
    //   values[0] = Original Budget  → adopted_amount
    //   values[1] = Final Budget
    //   values[2] = Actual (GAAP)    → actual_amount
    const adopted = values[0] ?? 0;
    const actual  = values.length >= 3 ? (values[2] ?? null) : (values[0] ?? null);

    if (verbose) {
      console.error(`[item] Line ${i}: "${rawLabel}" adopted=${adopted.toLocaleString()} actual=${actual?.toLocaleString() ?? 'null'} tokens=[${tokens.join(', ')}]`);
    }

    rows.push({ label: rawLabel, adoptedAmount: adopted, actualAmount: actual });
  }

  return { rows, totalExpenditures };
}

// ── extractNumbers ─────────────────────────────────────────────────────────────
// Returns array of numbers from a line (dashes = 0, parens = negative)
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

// ── buildTree ─────────────────────────────────────────────────────────────────
// Builds the JSON tree for treasury_sync_budget_tree RPC.
function buildTree(rows) {
  const fund = 'General Fund';
  const children = [];
  let total = 0;

  for (const row of rows) {
    const a  = Number(row.adoptedAmount) || 0;
    const aa = row.actualAmount != null ? Number(row.actualAmount) : null;
    // Include rows even if adopted=0 but actual>0 (e.g. Capital outlay, Interest)
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

// ── validateTotal ─────────────────────────────────────────────────────────────
function validateTotal(extracted, expected, fyLabel) {
  const diff = Math.abs(extracted - expected) / expected;
  const pct  = (diff * 100).toFixed(2);
  console.log(`Validation (${fyLabel}):`);
  console.log(`  Extracted (from line items): $${Math.round(extracted).toLocaleString()}`);
  console.log(`  Expected  (ACFR page total): $${Math.round(expected).toLocaleString()}`);
  console.log(`  Difference: ${pct}%  (tolerance: ${(TOLERANCE * 100).toFixed(0)}%)`);
  return diff <= TOLERANCE;
}

// ── processFY ────────────────────────────────────────────────────────────────
async function processFY(supabase, muniId, fiscalYear, opts) {
  const { dryRun, verbose, noCache } = opts;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Processing Prosper FY${fiscalYear} — Operating Budget`);
  console.log('─'.repeat(70));

  // ── Step 1: Resolve PDF path ──────────────────────────────────────────────
  const pdfPath = CACHE_PATHS[fiscalYear];
  const cacheExists = fs.existsSync(pdfPath);
  if (!cacheExists || noCache) {
    const url = PDF_URLS[fiscalYear];
    console.log(`Downloading FY${fiscalYear} PDF from ${url} ...`);
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/pdf,*/*' },
    });
    if (!resp.ok) {
      console.error(`Download failed: HTTP ${resp.status} ${resp.statusText}`);
      return { fy: fiscalYear, passed: false, total: 0, rowCount: 0 };
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const dir = path.dirname(pdfPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(pdfPath, buf);
    console.log(`Saved to ${pdfPath} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`Using cached PDF: ${pdfPath}`);
  }

  // ── Step 2: Extract PDF text ──────────────────────────────────────────────
  console.log('Extracting text with pdftotext -raw...');
  const lines = extractPdfText(pdfPath);
  if (!lines) {
    console.error(`pdftotext failed for FY${fiscalYear}`);
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0 };
  }
  console.log(`  Total lines: ${lines.length}`);

  // ── Step 3: Find GF Budget-and-Actual section ─────────────────────────────
  const sectionIdx = findBudgetSection(lines, verbose);
  if (sectionIdx < 0) {
    console.error(`Could not find GF B&A section for FY${fiscalYear} — PDF layout may differ`);
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0 };
  }
  console.log(`  Section found at line ${sectionIdx}`);

  // ── Step 4: Parse expenditure lines ──────────────────────────────────────
  console.log('Parsing expenditure lines...');
  const { rows, totalExpenditures } = parseExpenditureLines(lines, sectionIdx, verbose);

  if (rows.length === 0) {
    console.error(`No expenditure rows extracted for FY${fiscalYear} — check PDF section detection`);
    return { fy: fiscalYear, passed: false, total: 0, rowCount: 0 };
  }
  console.log(`  Expenditure line items parsed: ${rows.length}`);
  if (totalExpenditures !== null) {
    console.log(`  "Total expenditures" from ACFR: $${Math.round(totalExpenditures).toLocaleString()}`);
  }

  // ── Step 5: Build tree ────────────────────────────────────────────────────
  const { jsonTree, total } = buildTree(rows);

  // ── Step 6: Print summary table ───────────────────────────────────────────
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

  // ── Step 7: Per-capita sanity check ───────────────────────────────────────
  const perCapita = Math.round(total / POPULATION);
  console.log(`Per-capita check: $${Math.round(total).toLocaleString()} / ${POPULATION.toLocaleString()} = $${perCapita.toLocaleString()}/person`);

  const SANITY_MIN = 20_000_000;  // Prosper was smaller in FY2023
  const SANITY_MAX = 150_000_000;
  if (total < SANITY_MIN || total > SANITY_MAX) {
    console.error(`\nSANITY FAIL: Total $${Math.round(total).toLocaleString()} outside $20M–$150M range`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length };
  }
  console.log(`Sanity check: PASS ($${Math.round(total).toLocaleString()} in $20M–$150M range)\n`);

  // ── Step 8: Validate ──────────────────────────────────────────────────────
  const expectedForValidation = totalExpenditures ?? EXPECTED_TOTALS[fiscalYear];
  const valid = validateTotal(total, expectedForValidation, `Prosper FY${fiscalYear}`);
  if (!valid) {
    console.error(`\nVALIDATION FAILED — FY${fiscalYear} operating budget NOT loaded to DB.`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length };
  }
  console.log('\nVALIDATION PASSED');

  if (dryRun) {
    console.log('\n(dry-run — skipping DB writes)');
    return { fy: fiscalYear, passed: true, total, rowCount: rows.length, dsId: 'dry-run' };
  }

  // ── Step 9: Resolve data_source row (create if missing) ──────────────────
  const { data: existing, error: dsErr } = await supabase.schema('treasury').from('data_sources')
    .select('id, last_synced_at')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy' + fiscalYear)
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (dsErr) {
    console.error(`data_sources lookup error for FY${fiscalYear}: ${dsErr.message}`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length };
  }

  let dsId;
  if (existing?.id) {
    dsId = existing.id;
    // Update base_url in case it changed
    const { error: upErr } = await supabase.schema('treasury').from('data_sources')
      .update({ base_url: PDF_URLS[fiscalYear] })
      .eq('id', dsId);
    if (upErr) console.warn(`  WARNING: Could not update base_url: ${upErr.message}`);
    console.log(`\ndata_source: ${dsId} (existing)`);
  } else {
    // Create new data_source row for this FY
    const { data: created, error: createErr } = await supabase.schema('treasury').from('data_sources')
      .insert({
        municipality_id: muniId,
        api_type:        'pdf_download',
        dataset_id:      'fy' + fiscalYear,
        dataset_type:    'operating',
        fiscal_years:    [fiscalYear],
        base_url:        PDF_URLS[fiscalYear],
      })
      .select('id')
      .single();

    if (createErr || !created?.id) {
      console.error(`Failed to create data_source for FY${fiscalYear}: ${createErr?.message}`);
      return { fy: fiscalYear, passed: false, total, rowCount: rows.length };
    }
    dsId = created.id;
    console.log(`\ndata_source: ${dsId} (created)`);
  }

  // ── Step 10: Clear old rows (idempotency) ──────────────────────────────────
  const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muniId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);
  if (delErr1) {
    console.error(`Delete (orphaned rows) failed: ${delErr1.message}`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length };
  }

  const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('data_source_id', dsId)
    .eq('fiscal_year', fiscalYear);
  if (delErr2) {
    console.error(`Delete (by data_source_id) failed: ${delErr2.message}`);
    return { fy: fiscalYear, passed: false, total, rowCount: rows.length };
  }
  console.log('Cleared old rows');

  // ── Step 11: Call treasury_sync_budget_tree RPC ───────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           jsonTree,
    p_row_count:      rows.length,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)           { console.error(`RPC error for FY${fiscalYear}: ${rpcErr.message}`); return { fy: fiscalYear, passed: false, total, rowCount: rows.length }; }
  if (rpcResult?.error) { console.error(`RPC returned error for FY${fiscalYear}: ${rpcResult.error}`); return { fy: fiscalYear, passed: false, total, rowCount: rows.length }; }

  const inserted = rpcResult?.rows_inserted ?? rows.length;
  console.log(`Loaded ${inserted} rows for FY${fiscalYear} (total $${Math.round(total).toLocaleString()})`);

  // ── Step 12: Set last_synced_at ───────────────────────────────────────────
  const { error: syncErr } = await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', dsId);
  if (syncErr) {
    console.warn(`last_synced_at update error: ${syncErr.message}`);
  } else {
    console.log(`last_synced_at set for data_source ${dsId}`);
  }

  console.log(`Done. Prosper FY${fiscalYear} operating budget loaded successfully.`);
  console.log(`Total: $${Math.round(total).toLocaleString()} ($${perCapita.toLocaleString()}/person)`);

  return { fy: fiscalYear, passed: true, total, rowCount: inserted ?? rows.length, dsId };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run':  { type: 'boolean', default: false },
      'verbose':  { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
      'fy':       { type: 'string'  },
    },
    strict: false,
  });

  const dryRun  = opts['dry-run'];
  const verbose = opts['verbose'];
  const noCache = opts['no-cache'];
  const fyFilter = opts['fy'] ? parseInt(opts['fy'], 10) : null;

  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ───────────────────────────────────────────────────
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Prosper').single();
  if (muniErr || !muni) {
    console.error('Could not find Prosper municipality:', muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})`);

  const allFYs = [2023, 2024, 2025];
  const targetFYs = fyFilter ? [fyFilter] : allFYs;

  for (const fy of targetFYs) {
    if (!PDF_URLS[fy]) {
      console.error(`FY${fy} is not configured in this script`);
      process.exit(2);
    }
  }

  const results = [];
  for (const fy of targetFYs) {
    try {
      const result = await processFY(supabase, muni.id, fy, { dryRun, verbose, noCache });
      results.push(result);
    } catch (e) {
      console.error(`\nFatal error processing FY${fy}: ${e.message}`);
      results.push({ fy, passed: false, total: 0, rowCount: 0 });
    }
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`);
  console.log('SUMMARY — Prosper Operating Budget');
  console.log('═'.repeat(70));
  console.log(`${'FY'.padEnd(6)} ${'Status'.padEnd(8)} ${'Total'.padStart(16)} ${'Per-capita'.padStart(12)} ${'Rows'.padStart(6)}`);
  console.log('─'.repeat(70));
  for (const r of results) {
    const status    = r.passed ? 'PASS' : 'FAIL';
    const totalStr  = r.total  ? `$${Math.round(r.total).toLocaleString()}` : '—';
    const pcStr     = r.total  ? `$${Math.round(r.total / POPULATION).toLocaleString()}` : '—';
    console.log(`${String(r.fy).padEnd(6)} ${status.padEnd(8)} ${totalStr.padStart(16)} ${pcStr.padStart(12)} ${String(r.rowCount).padStart(6)}`);
  }
  console.log('─'.repeat(70));

  const allPassed = results.every(r => r.passed);
  const anyPassed = results.some(r => r.passed);
  if (allPassed) {
    console.log('\nAll fiscal years passed validation and loaded successfully.');
  } else if (anyPassed) {
    const failed = results.filter(r => !r.passed).map(r => `FY${r.fy}`).join(', ');
    console.log(`\nPartial success — ${failed} failed. See output above.`);
  } else {
    console.error('\nAll fiscal years failed. No data was written to the database.');
    process.exit(2);
  }

  if (dryRun) console.log('(dry-run mode — no data was written to the database)');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(2);
});
