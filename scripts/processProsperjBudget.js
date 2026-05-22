#!/usr/bin/env node
/**
 * Prosper Operating Budget Extractor
 *
 * Extracts General Fund operating expenditures from Prosper's FY2025 ACFR PDF
 * using pdftotext -raw — no AI/API calls, pure text parsing.
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
 * garbled labels and wrong values (e.g., Administration picks up wrong dept values,
 * labels get assigned to wrong rows).
 *
 * pdftotext -raw reads words in document order, producing one line per ACFR row:
 *   "Administration 10,928,574 10,817,388 10,300,769"
 * This correctly isolates each department name and its three budget columns.
 *
 * === EXPECTED TOTAL (FY2025) ===
 *
 * Total expenditures (Original Budget): $53,010,770
 * Individual items: Administration, Police, Fire and EMS, Development services,
 *   Public works, Community services, Engineering, Capital outlay (orig=0),
 *   Principal, Interest and fiscal charges (orig=0)
 *
 * === COLUMN MAPPING ===
 *
 * Raw token order per line: [label...] [original] [final] [actual]
 *   adopted_amount = original budget (token index 0 after label)
 *   actual_amount  = actual (token index 2 after label)
 *
 * Usage:
 *   node scripts/processProsperjBudget.js              # production (loads to DB)
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

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682';
const CACHE_PATH = 'C:/tmp/prosper_acfr_fy2025.pdf';
const FISCAL_YEAR = 2025;

// Expected total expenditures (Original Budget) from ACFR page 29
const EXPECTED_TOTAL = 53_010_770;
const TOLERANCE = 0.05; // 5% — tight because -raw gives clean values

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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
// Locates "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN FUND BALANCE"
// followed by "GENERAL FUND" and "BUDGET AND ACTUAL" within the next 15 lines.
// Returns the line index of the section header, or -1 if not found.
function findBudgetSection(lines, verbose) {
  for (let i = 0; i < lines.length; i++) {
    if (!/STATEMENT OF REVENUES, EXPENDITURES/.test(lines[i])) continue;

    let foundGF = false;
    let foundBA = false;
    for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
      const t = lines[j].trim();
      if (/^GENERAL FUND\s*$/.test(t)) foundGF = true;
      if (/^BUDGET AND ACTUAL\s*$/.test(t)) foundBA = true;
      if (foundGF && foundBA) {
        if (verbose) console.error(`[section-found] GF B&A section at line ${i}`);
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
function validateTotal(extracted, expected) {
  const diff = Math.abs(extracted - expected) / expected;
  const pct  = (diff * 100).toFixed(2);
  console.log('Validation:');
  console.log(`  Extracted (from line items): $${Math.round(extracted).toLocaleString()}`);
  console.log(`  Expected  (ACFR page total): $${Math.round(expected).toLocaleString()}`);
  console.log(`  Difference: ${pct}%  (tolerance: ${(TOLERANCE * 100).toFixed(0)}%)`);
  return diff <= TOLERANCE;
}

// ── main ──────────────────────────────────────────────────────────────────────
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

  // ── Supabase client ────────────────────────────────────────────────────────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
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
  console.log(`Municipality: ${muni.name} (${muni.id})\n`);

  // ── Download or load PDF ──────────────────────────────────────────────────
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
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, buf);
    console.log(`Saved to ${CACHE_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`Using cached PDF: ${CACHE_PATH}`);
  }

  // ── Extract PDF text (using -raw mode to avoid column bleed) ─────────────
  console.log('Extracting text with pdftotext -raw...');
  const lines = extractPdfText(CACHE_PATH);
  if (!lines) {
    console.error('pdftotext failed');
    process.exit(2);
  }
  console.log(`  Total lines: ${lines.length}`);

  // ── Find GF Budget-and-Actual section ─────────────────────────────────────
  const sectionIdx = findBudgetSection(lines, verbose);
  if (sectionIdx < 0) {
    console.error('Could not find GF B&A section — PDF layout may have changed');
    process.exit(2);
  }
  console.log(`  Section found at line ${sectionIdx}`);

  // ── Parse expenditure lines ───────────────────────────────────────────────
  console.log('Parsing expenditure lines...');
  const { rows, totalExpenditures } = parseExpenditureLines(lines, sectionIdx, verbose);

  if (rows.length === 0) {
    console.error('No expenditure rows extracted — check PDF section detection');
    process.exit(2);
  }
  console.log(`  Expenditure line items parsed: ${rows.length}`);
  if (totalExpenditures !== null) {
    console.log(`  "Total expenditures" from ACFR: $${Math.round(totalExpenditures).toLocaleString()}`);
  }

  // ── Build tree ────────────────────────────────────────────────────────────
  const { jsonTree, total } = buildTree(rows);

  // ── Print summary table ───────────────────────────────────────────────────
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

  // ── Per-capita sanity check ───────────────────────────────────────────────
  const POPULATION = 44_503;
  const perCapita = Math.round(total / POPULATION);
  console.log(`Per-capita check: $${Math.round(total).toLocaleString()} / ${POPULATION.toLocaleString()} = $${perCapita.toLocaleString()}/person`);

  const SANITY_MIN = 30_000_000;
  const SANITY_MAX = 150_000_000;
  if (total < SANITY_MIN || total > SANITY_MAX) {
    console.error(`\nSANITY FAIL: Total $${Math.round(total).toLocaleString()} is outside $30M–$150M range`);
    process.exit(2);
  }
  console.log(`Sanity check: PASS ($${Math.round(total).toLocaleString()} in $30M–$150M range)\n`);

  // ── Validate against ACFR "Total expenditures" line ──────────────────────
  const expectedForValidation = totalExpenditures ?? EXPECTED_TOTAL;
  const valid = validateTotal(total, expectedForValidation);
  if (!valid) {
    console.error('\nVALIDATION FAILED — Prosper FY2025 operating budget NOT loaded to DB.');
    process.exit(2);
  }
  console.log('\nVALIDATION PASSED');

  if (dryRun) {
    console.log('\n(dry-run — skipping DB writes)');
    return;
  }

  // ── Look up existing data_source row ─────────────────────────────────────
  const { data: ds, error: dsErr } = await supabase.schema('treasury').from('data_sources')
    .select('id, last_synced_at')
    .eq('municipality_id', muni.id)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2025')
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (dsErr) {
    console.error('data_sources lookup error:', dsErr.message);
    process.exit(2);
  }
  if (!ds?.id) {
    console.error('No data_source row found for Prosper operating FY2025 — must be seeded first');
    process.exit(2);
  }
  console.log(`\ndata_source: ${ds.id} (last_synced_at: ${ds.last_synced_at || 'null'})`);

  // ── Clear old Haiku data (bad data from Phase 7, data_source_id = null) ──
  const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muni.id)
    .eq('fiscal_year', FISCAL_YEAR)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);
  if (delErr1) {
    console.error('Delete (orphaned Haiku rows) failed:', delErr1.message);
    process.exit(2);
  }
  console.log('Cleared old Haiku data (data_source_id = null)');

  // Also clear any rows already linked to this data_source (idempotency)
  const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('data_source_id', ds.id)
    .eq('fiscal_year', FISCAL_YEAR);
  if (delErr2) {
    console.error('Delete (by data_source_id) failed:', delErr2.message);
    process.exit(2);
  }

  // ── Call treasury_sync_budget_tree RPC ────────────────────────────────────
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

  // ── Set last_synced_at ────────────────────────────────────────────────────
  const { error: syncErr } = await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', ds.id);
  if (syncErr) {
    console.error('last_synced_at update error:', syncErr.message);
    // Non-fatal
  } else {
    console.log(`last_synced_at set for data_source ${ds.id}`);
  }

  console.log(`\nDone. Prosper FY${FISCAL_YEAR} operating budget loaded successfully.`);
  console.log(`Total: $${Math.round(total).toLocaleString()} ($${perCapita.toLocaleString()}/person)`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(2);
});
