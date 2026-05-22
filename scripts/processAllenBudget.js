#!/usr/bin/env node
/**
 * Allen TX Operating Budget Extractor
 *
 * Extracts General Fund operating expenditures from Allen's FY2025
 * Annual Comprehensive Financial Report (ACFR) PDF using pdftotext.
 * No AI API calls — pure text parsing.
 *
 * PDF layout (document page 89 / PDF page 95):
 *   "General Fund Schedule of Revenues, Expenditures, and Changes in Fund
 *    Balance - Budget and Actual" (sentence case, not ALL CAPS)
 *
 *   The table has 4 columns: Original | Final | Actual | Variance (Positive)
 *
 *   IMPORTANT: pdftotext -layout mode is unreliable for this page because the
 *   PDF places labels and numeric values at slightly different Y-coordinates,
 *   causing pdftotext to interleave rows (labels are ~2 rows ahead of their
 *   corresponding values). The -layout output cannot be used for row-by-row
 *   parsing.
 *
 *   Instead, we use pdftotext WITHOUT -layout, which outputs columns
 *   sequentially. In non-layout mode, numbers appear in 4 groups:
 *     Group 1 = Original column values (top to bottom)
 *     Group 2 = Final column values (top to bottom)
 *     Group 3 = Actual column values (top to bottom) ← target
 *     Group 4 = Variance column values (top to bottom)
 *
 *   Function labels (sentence case from the ACFR):
 *     EXPENDITURES         (header — no value)
 *     Current              (header — no value)
 *       General government
 *       Public safety
 *       Public works
 *       Culture and recreation
 *       Community development
 *     Capital outlay
 *     Debt Service         (header — no value)
 *       Principal retirement
 *       Interest and fiscal charges
 *     TOTAL EXPENDITURES   (grand total)
 *
 *   The Actual column for the EXPENDITURES section has exactly 8 values,
 *   which map 1:1 to the 8 non-header rows listed above.
 *
 *   Confirmed actual values (FY2025):
 *     General government       =  28,595,817
 *     Public safety            =  67,907,556   (largest category)
 *     Public works             =   8,535,712
 *     Culture and recreation   =  27,322,867
 *     Community development    =   4,582,943
 *     Capital outlay           =   1,825,826
 *     Principal retirement     =     618,584
 *     Interest and fiscal      =      31,421
 *     TOTAL EXPENDITURES       = 139,420,726   (sum of above = 139,420,726 ✓)
 *
 * Sanity check: Total should be $130M–$160M for Allen (pop ~113,746).
 *
 * Usage:
 *   node scripts/processAllenBudget.js              # production (loads to DB)
 *   node scripts/processAllenBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processAllenBudget.js --verbose    # log parse decisions
 *   node scripts/processAllenBudget.js --no-cache   # re-download even if cache exists
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL = 'https://www.cityofallen.org/Documents/Departments/Finance/Financial%20Transparency/Other%20Documents/FY%202025%20Annual%20Comprehensive%20Financial%20Report.pdf';
const CACHE_PATH = 'C:/tmp/allen_acfr_fy2025.pdf';
const FISCAL_YEAR = 2025;
const DATA_SOURCE_NAME = 'Allen ACFR FY2025';
const MUNI_NAME = 'Allen';

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Function row definitions ──────────────────────────────────────────────────
// These are the 8 line items (non-header rows) in the Actual column,
// in order of appearance in the ACFR table.
const FUNCTION_LABELS = [
  'General Government',
  'Public Safety',
  'Public Works',
  'Culture and Recreation',
  'Community Development',
  'Capital Outlay',
  'Debt Service - Principal',
  'Debt Service - Interest',
];

// ── Parse money string ─────────────────────────────────────────────────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim().replace(/[\s$]/g, '');
  if (!t || t === '-') return null;
  const neg = t.startsWith('(') || t.startsWith('-');
  const n = parseFloat(t.replace(/[(),-]/g, ''));
  if (isNaN(n) || n === 0) return null;
  return neg ? -n : n;
}

// ── Parse the PDF text (non-layout mode) ──────────────────────────────────────
function parsePDF(pdfPath, verbose) {
  // Use pdftotext WITHOUT -layout: this outputs text in reading order (column by column)
  // which allows us to extract the sequential column groups.
  let text;
  try {
    text = execSync(`pdftotext "${pdfPath}" -`, {
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (e) {
    console.error('pdftotext error:', e.message.slice(0, 300));
    return null;
  }

  const lines = text.split('\n').map(l => l.replace(/^\x0c/, '').replace(/\r$/, '').trim());
  const nLines = lines.length;

  // ── Find General Fund Budget and Actual section ────────────────────────────
  // Look for the line that contains the section label names including function categories
  // In non-layout mode, labels are grouped: "EXPENDITURES Current General government
  // Public safety Public works Culture and recreation Community development Capital outlay
  // Debt Service Principal retirement Interest and fiscal charges"
  let labelLineIdx = -1;
  for (let i = 0; i < nLines; i++) {
    const line = lines[i];
    if (/EXPENDITURES/.test(line) && /General government/.test(line) && /Public safety/.test(line)) {
      // Verify this is in the General Fund Budget and Actual section
      // (not the Combining Statement or other fund) by checking nearby lines.
      // In non-layout mode the section header appears ~26 lines before the label block.
      // "General Fund Schedule" and "Budget and Actual" may be on different lines.
      const window = lines.slice(Math.max(0, i - 40), i).join('\n');
      const hasGFSchedule = /General Fund Schedule/i.test(window);
      const hasBudgetActual = /Budget and Actual/i.test(window);
      const inGFBudget = hasGFSchedule && hasBudgetActual;

      if (verbose) {
        console.error(`[labels-check] line ${i}: hasGF=${hasGFSchedule}, hasBudAct=${hasBudgetActual}`);
      }

      if (inGFBudget) {
        labelLineIdx = i;
        if (verbose) console.error(`[labels] Found EXPENDITURES label block at line ${i}: "${line.slice(0, 80)}"`);
        break;
      }
    }
  }

  if (labelLineIdx === -1) {
    console.error('Could not find EXPENDITURES label block in General Fund Budget and Actual section');
    return null;
  }

  // ── Find TOTAL EXPENDITURES line after label block ─────────────────────────
  let totalLineIdx = -1;
  for (let i = labelLineIdx + 1; i < Math.min(nLines, labelLineIdx + 3); i++) {
    if (/^TOTAL EXPENDITURES/.test(lines[i])) {
      totalLineIdx = i;
      if (verbose) console.error(`[total-label] TOTAL EXPENDITURES label at line ${i}`);
      break;
    }
  }

  // ── Collect the 4 column number groups ────────────────────────────────────
  // The columns appear in blocks after the label line(s).
  // Each block is a set of numbers separated by blank lines between groups.
  // We need the 3rd group (Actual column).
  //
  // Column structure in non-layout output:
  //   Group 1 (Original): numbers for each row in top-to-bottom order
  //   [blank line separating groups]
  //   Group 2 (Final): numbers for each row
  //   [blank line]
  //   Group 3 (Actual): numbers for each row  ← target
  //   [blank line]
  //   Group 4 (Variance): numbers for each row
  //
  // Total EXPENDITURES appears at the end of each group as a separate line.

  // Start collecting from just after the label block
  const startScan = (totalLineIdx !== -1) ? totalLineIdx + 1 : labelLineIdx + 2;

  // Find the block containing the 8 Actual values + TOTAL EXPENDITURES Actual
  // Strategy: look for a block of numbers where the total matches 139,420,726
  // Scan for groups separated by blank lines

  const numberPattern = /^[\d,]+$/;
  const moneyPattern = /^[\(\d][\d,]*\)?$/;

  // Collect ALL number-only lines after label block until we hit "Excess (deficiency)"
  let excessIdx = -1;
  for (let i = startScan; i < Math.min(nLines, startScan + 100); i++) {
    if (/Excess.*deficiency/.test(lines[i]) || /over.*under.*expenditures/.test(lines[i])) {
      excessIdx = i;
      break;
    }
  }
  if (verbose) console.error(`[excess] Excess/deficiency line at ${excessIdx}`);

  // Collect number blocks between start and excess line.
  // Each line may contain multiple space-separated numeric values.
  // Blocks are separated by blank lines.
  const scanEnd = excessIdx !== -1 ? excessIdx : startScan + 80;
  const numBlocks = [];
  let currentBlock = [];

  for (let i = startScan; i < scanEnd; i++) {
    const line = lines[i];
    if (line === '') {
      // Blank line = block separator
      if (currentBlock.length > 0) {
        numBlocks.push([...currentBlock]);
        currentBlock = [];
      }
      continue;
    }

    // Check if this line contains ONLY numbers, commas, spaces, parens, dollar signs
    // (i.e., it's a data line, not a label line)
    if (/^[\d\s$,.()\-]+$/.test(line)) {
      // Extract all numbers from this line
      const re = /\(?([\d,]+)\)?/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        const raw = m[0];
        const v = parseMoney(raw);
        if (v !== null && Math.abs(v) >= 1000) {
          currentBlock.push({ val: v, line });
        }
      }
    }
    // Skip text lines (they terminate the current block)
    else if (currentBlock.length > 0) {
      numBlocks.push([...currentBlock]);
      currentBlock = [];
    }
  }
  if (currentBlock.length > 0) numBlocks.push([...currentBlock]);

  if (verbose) {
    console.error(`[blocks] Found ${numBlocks.length} number blocks after EXPENDITURES label:`);
    numBlocks.forEach((block, i) => {
      const sum = block.reduce((s, {val}) => s + Math.abs(val), 0);
      console.error(`  Block ${i}: ${block.length} values, sum=$${Math.round(sum).toLocaleString()}`);
      block.slice(0, 5).forEach(({val, line}) => console.error(`    ${line} → ${val.toLocaleString()}`));
    });
  }

  // ── Find the Actual column block ──────────────────────────────────────────
  // The Actual block should have a total of 139,420,726.
  // It should have 8-9 values (8 line items + the TOTAL).
  let actualBlock = null;
  let actualTotal = null;

  for (const block of numBlocks) {
    // Check if any value in the block matches our known TOTAL EXPENDITURES actual
    const totalVal = block.find(({val}) => Math.round(Math.abs(val)) === 139420726);
    if (totalVal) {
      actualBlock = block;
      actualTotal = totalVal.val;
      if (verbose) console.error(`[actual-block] Found Actual column block with total $${actualTotal.toLocaleString()}`);
      break;
    }
  }

  if (!actualBlock) {
    // Fallback: try to find block where the sum of values equals ~139.4M
    for (const block of numBlocks) {
      const positiveVals = block.filter(({val}) => val > 0);
      if (positiveVals.length >= 2) {
        const sum = positiveVals.reduce((s, {val}) => s + val, 0);
        // If the largest value equals the sum (i.e., the last is the total)
        const sortedVals = positiveVals.sort((a, b) => b.val - a.val);
        if (Math.abs(sum - sortedVals[0].val * 2) < 1000) {
          // Approximately half the sum is the total (i.e., total ≈ sum of items)
        }
        // Check if max value is ~139M (the total)
        if (sortedVals[0].val >= 130_000_000 && sortedVals[0].val <= 160_000_000) {
          actualBlock = block;
          actualTotal = sortedVals[0].val;
          if (verbose) console.error(`[actual-block-fallback] Using block with max $${actualTotal.toLocaleString()}`);
          break;
        }
      }
    }
  }

  if (!actualBlock) {
    console.error('Could not identify the Actual column number block');
    return null;
  }

  // ── Extract the 8 function values from the Actual block ──────────────────
  // The block contains 8 line item values + TOTAL at the end (or TOTAL is separate).
  // Remove the TOTAL from the block to get just the line items.
  const itemValues = actualBlock
    .filter(({val}) => Math.round(Math.abs(val)) !== 139420726 && val > 0)
    .map(({val}) => val);

  if (verbose) {
    console.error(`[items] ${itemValues.length} item values after removing total:`);
    itemValues.forEach((v, i) => console.error(`  ${i}: $${Math.round(v).toLocaleString()}`));
  }

  if (itemValues.length !== FUNCTION_LABELS.length) {
    console.error(`Expected ${FUNCTION_LABELS.length} line items, got ${itemValues.length}`);
    if (itemValues.length < FUNCTION_LABELS.length) {
      // Pad with null — some items may have 0 actual
      while (itemValues.length < FUNCTION_LABELS.length) itemValues.push(0);
    }
  }

  // Map values to labels
  const items = new Map();
  for (let i = 0; i < Math.min(itemValues.length, FUNCTION_LABELS.length); i++) {
    if (itemValues[i] > 0) {
      items.set(FUNCTION_LABELS[i], itemValues[i]);
    }
  }

  return { items, total: actualTotal };
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
function buildTree(items, total) {
  const jsonTree = [];

  for (const [name, actual] of items) {
    jsonTree.push({
      n: name,
      a: actual,
      c: [{
        n: name,
        a: actual,
        i: [{
          d: name,
          a: actual,
          aa: actual,   // adopted = actual (using actuals from ACFR)
          f: 'General Fund',
          e: null,
        }],
      }],
    });
  }

  jsonTree.sort((a, b) => b.a - a.a);
  return jsonTree;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'verbose': { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const dryRun  = opts['dry-run'];
  const verbose = opts['verbose'];
  const noCache = opts['no-cache'];

  // ── Download or load PDF ──────────────────────────────────────────────────
  const cacheExists = fs.existsSync(CACHE_PATH);
  if (!cacheExists || noCache) {
    console.log(`Downloading PDF from ${PDF_URL} ...`);
    const resp = await fetch(PDF_URL);
    if (!resp.ok) {
      console.error(`Download failed: HTTP ${resp.status} ${resp.statusText}`);
      process.exit(2);
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, buf);
    console.log(`Saved to ${CACHE_PATH} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`Using cached PDF: ${CACHE_PATH}`);
  }

  // ── Supabase client ───────────────────────────────────────────────────────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ───────────────────────────────────────────────────
  const { data: muni, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name, population').ilike('name', MUNI_NAME).single();
  if (muniErr || !muni) {
    console.error(`Could not find ${MUNI_NAME} municipality:`, muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id}), population: ${muni.population?.toLocaleString()}\n`);

  // ── Parse PDF ─────────────────────────────────────────────────────────────
  console.log('Parsing PDF with pdftotext (non-layout sequential mode)...');
  const result = parsePDF(CACHE_PATH, verbose);
  if (!result) {
    console.error('PDF parsing failed');
    process.exit(2);
  }

  const { items, total } = result;

  // ── Sanity check ─────────────────────────────────────────────────────────
  // Allen General Fund actual FY2025 = $139.4M, budget = $149.9M adopted
  // Expected range: $100M–$175M
  const SANITY_MIN = 100_000_000;
  const SANITY_MAX = 175_000_000;
  if (total < SANITY_MIN || total > SANITY_MAX) {
    console.error(`SANITY FAIL: Total $${Math.round(total).toLocaleString()} is outside $100M–$175M expected range`);
    process.exit(2);
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  const jsonTree = buildTree(items, total);
  const itemsTotal = [...items.values()].reduce((a, b) => a + b, 0);
  const unallocated = total - itemsTotal;

  console.log(`Line items parsed: ${items.size}`);
  console.log(`TOTAL EXPENDITURES actual: $${Math.round(total).toLocaleString()}`);
  if (muni.population) {
    console.log(`Per capita: $${Math.round(total / muni.population).toLocaleString()}/person\n`);
  }

  console.log('Function                        Actual ($)');
  console.log('─────────────────────────────────────────────────');
  for (const node of jsonTree) {
    const v = items.get(node.n);
    console.log(`${node.n.padEnd(32)}${Math.round(v).toLocaleString().padStart(14)}`);
  }
  if (Math.abs(unallocated) > 1000) {
    console.log(`${'(Unallocated)'.padEnd(32)}${Math.round(unallocated).toLocaleString().padStart(14)}`);
  }
  console.log('─────────────────────────────────────────────────');
  console.log(`${'TOTAL'.padEnd(32)}${Math.round(total).toLocaleString().padStart(14)}\n`);
  console.log(`Sanity check: PASS ($${Math.round(total).toLocaleString()} in $100M–$175M range)\n`);

  if (dryRun) {
    console.log('(dry-run — skipping DB writes)');
    return;
  }

  // ── Lookup data_source ────────────────────────────────────────────────────
  const { data: ds } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muni.id)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2025')
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (!ds?.id) {
    console.error('data_source not found for Allen operating fy2025 — check DB');
    process.exit(2);
  }
  console.log(`data_source: ${ds.id}`);

  // ── Clear old Haiku data (data_source_id IS NULL = orphaned rows) ─────────
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', muni.id)
    .eq('fiscal_year', FISCAL_YEAR)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);
  if (delErr) throw new Error(`Delete (orphaned) failed: ${delErr.message}`);
  console.log('Cleared orphaned Haiku budget rows (data_source_id IS NULL)');

  // Also clear any rows linked to this data_source from a prior run
  const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('data_source_id', ds.id)
    .eq('fiscal_year', FISCAL_YEAR);
  if (delErr2) throw new Error(`Delete (by data_source_id) failed: ${delErr2.message}`);

  // ── Call treasury_sync_budget_tree RPC ────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year: FISCAL_YEAR,
    p_dataset_type: 'operating',
    p_total: total,
    p_tree: jsonTree,
    p_row_count: items.size,
    p_triggered_by: 'bulk_load',
  });

  if (rpcErr)           throw new Error(`RPC error: ${rpcErr.message}`);
  if (rpcResult?.error) throw new Error(`RPC returned error: ${rpcResult.error}`);

  const inserted = rpcResult?.rows_inserted ?? items.size;
  console.log(`Loaded ${inserted} rows for FY${FISCAL_YEAR} (total $${Math.round(total).toLocaleString()})`);

  // ── Update last_synced_at ─────────────────────────────────────────────────
  await supabase.schema('treasury').from('data_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', ds.id);
  console.log('Updated data_source last_synced_at');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
