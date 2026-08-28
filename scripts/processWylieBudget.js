#!/usr/bin/env node
/**
 * Wylie Operating Budget Loader (pdftotext-parser route)
 *
 * Extracts General Fund operating expenditures from Wylie's FY2025-2026
 * Adopted Budget PDF using pdftotext — no AI API calls, pure text parsing.
 *
 * PDF column layout (Summary of Revenues and Expenditures table):
 *   Actual 2023-2024 | Budget 2024-2025 | Projected 2024-2025 | Budget 2025-2026
 *
 * Mapping:
 *   adopted_amount = col[3]  (Budget 2025-2026, rightmost)
 *   actual_amount  = col[0]  (Actual 2023-2024, leftmost)
 *
 * Strategy:
 *   Parse the "Summary of General Fund Revenues & Expenditures" table which
 *   lists all GF departments with 4 columns. Department names appear indented
 *   on the left side. The table spans the "Expenditures:" section which has
 *   sections: General Government, Public Safety, Development Services,
 *   Community Services, Streets.
 *
 * Usage:
 *   node scripts/processWylieBudget.js              # production (loads to DB)
 *   node scripts/processWylieBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processWylieBudget.js --verbose    # verbose parse logging
 *   node scripts/processWylieBudget.js --no-cache   # re-download PDF
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://cms2.revize.com/revize/wylienew/Departments/Finance/Budget/FY%202026%20Final%20Budget.pdf';
const CACHE_PATH = 'C:/tmp/collin-budgets/wylie_fy2026.pdf';
const FISCAL_YEAR = 2026;
const DATA_SOURCE_NAME = 'Wylie Operating Budget FY2026';
const MUNICIPALITY_NAME = 'Wylie';

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Parse a money token (handles negatives in parens, $ prefix, commas) ──────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim().replace(/^-$/, '');
  if (!t) return null;
  const neg = t.startsWith('(') || t.startsWith('-');
  const n = parseFloat(t.replace(/[$()\s,\-]/g, ''));
  if (isNaN(n) || n === 0) return null;
  return neg ? -n : n;
}

// ── Extract all dollar values from a line ─────────────────────────────────────
// Returns array of numbers found in order (left to right).
function extractNumbers(line) {
  const numRe = /\(?(?:\$)?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?/g;
  const vals = [];
  let m;
  while ((m = numRe.exec(line)) !== null) {
    const v = parseMoney(m[0]);
    if (v !== null) vals.push(v);
  }
  return vals;
}

// ── Parse the PDF text ────────────────────────────────────────────────────────
function parsePDF(pdfPath, verbose) {
  let text;
  try {
    text = execSync(`pdftotext -layout "${pdfPath}" -`, {
      maxBuffer: 128 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (e) {
    console.error('pdftotext error:', e.message.slice(0, 300));
    return null;
  }

  const lines = text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);

  // Find the "Expenditures:" section in the GF Summary table.
  // The table header has "Actual" / "Budget" / "Projected" / "Budget" labels.
  // Department lines: "  Dept Name    nnnn  nnnn  nnnn  nnnn"
  // We stop at "Total Expenditures".

  // deptName -> { adopted, actual }
  const deptData = new Map();

  // Dept name patterns we know from the PDF
  // Some lines have no numbers (e.g. "Planning" alone — its values are on next line)
  const SKIP_LINES = new Set([
    'General Government',
    'Public Safety',
    'Development Services',
    'Community Services',
    'Revenues:',
    'Expenditures:',
    'Total Revenues',
    'Projected Amount Unspent for FY 2025',
    'Projected Amount Unspent for FY 2025',
  ]);

  // "Planning" in the PDF has no dollar values — it appears as a label only.
  // The planning budget is actually 0 or embedded in Building Inspection/Code Enforcement.
  // We skip it since the 3-number lines (Building Inspection, Code Enforcement) give
  // the actual per-dept values. The nameless 3rd line (195,627...) under Code Enforcement
  // is actually Planning values — we'll label it "Planning".

  let inExpenditures = false;
  let planningNextLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find start of Expenditures section in the GF Summary table.
    // "Expenditures:" appears with trailing whitespace but no inline numbers.
    if (/^Expenditures:\s*$/.test(line)) {
      // Make sure we pick the second occurrence — the one in the summary table
      // (not an earlier page). We do this by requiring line number > 2000.
      if (i > 2000) {
        inExpenditures = true;
        if (verbose) console.error(`[start] Line ${i}: Expenditures section begins`);
      }
      continue;
    }

    // Stop at "Total Expenditures" line that has dollar amounts (the GF total)
    if (inExpenditures && /^Total Expenditures\s+\$/.test(line)) {
      if (verbose) console.error(`[end] Line ${i}: Total Expenditures — stopping`);
      break;
    }

    if (!inExpenditures) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip section headers with no numbers
    if (SKIP_LINES.has(trimmed)) continue;

    const nums = extractNumbers(line);

    // Handle the "Planning" line which appears without numbers
    if (trimmed === 'Planning' && nums.length === 0) {
      planningNextLine = true;
      if (verbose) console.error(`[planning-next] Line ${i}: Planning label seen, next line has values`);
      continue;
    }

    // The unnamed row after Code Enforcement has 4 columns — it's Planning
    // (Planning has no label on the same line as its numbers)
    if (planningNextLine) {
      planningNextLine = false;
      // Skip — Building Inspection is on the next line AFTER "Planning" label
      // The real Planning data is the unnamed indented line further down
    }

    // Lines with no leading space that aren't dept lines (section headers)
    // e.g. "Public Safety", "Development Services", "Streets" (Streets HAS numbers)
    // "Streets" is a top-level dept line — allow it through
    if (/^[A-Za-z]/.test(line) && !/^Streets\s/.test(line)) {
      if (verbose) console.error(`[skip-header] Line ${i}: "${trimmed}"`);
      continue;
    }

    if (nums.length === 0) continue;

    // Handle "Emergency medical services" which has only 3 valid columns
    // (the FY2024 Actual was $370 — almost 0, so it appears as a 3-col line)
    // The FY2025 Budget = last number, FY2024 Budget = first number
    let adopted = nums.length >= 4 ? nums[3] : nums[nums.length - 1];
    let actual  = nums[0];

    // Unnamed line (Planning data): 4 numbers, starts with spaces
    // Dept lines: "  Police ...", "     City Council ...", "Streets ..."
    // Extract dept name from before the first multi-digit comma-separated number
    // Use a stricter pattern to avoid capturing small numbers like "370"
    const firstNumMatch = /\d{1,3}(?:,\d{3})+/.exec(line);
    let deptName = '';
    if (firstNumMatch) {
      deptName = line.slice(0, firstNumMatch.index).trim();
    }

    if (!deptName) {
      // Unnamed line = Planning values
      if (!deptData.has('Planning') && nums.length >= 3) {
        adopted = nums[nums.length - 1];
        actual  = nums[0];
        deptData.set('Planning', { adopted, actual });
        if (verbose) console.error(`[captured] Planning (unnamed line): adopted=$${adopted.toLocaleString()}`);
      }
      continue;
    }

    if (!deptName) continue;
    // Strip any trailing digits/spaces from name (e.g. "Emergency medical services 370")
    deptName = deptName.replace(/\s+\d+\s*$/, '').trim();
    if (!deptName) continue;
    if (SKIP_LINES.has(deptName)) continue;
    // Skip "Projected Amount Unspent" line
    if (/Projected Amount Unspent/i.test(deptName)) continue;

    if (verbose) console.error(`[captured] ${deptName}: adopted=$${adopted.toLocaleString()}, actual=$${actual.toLocaleString()}`);
    deptData.set(deptName, { adopted, actual });
  }

  return deptData;
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  for (const [deptName, { adopted, actual }] of deptData) {
    if (!adopted || adopted <= 0) continue;

    jsonTree.push({
      n: deptName,
      a: adopted,
      c: [{
        n: deptName,
        a: adopted,
        i: [{
          d:  deptName,
          // ⚠ aa -> approved_amount, a -> actual_amount in _treasury_insert_tree.
          // NOTE the trap: the NODE key `a` above is the rollup amount (correctly the
          // adopted figure), but the ITEM key `a` is actual_amount. Same letter, two
          // meanings. This emitted `a: adopted, aa: actual` and so filed the adopted
          // budget as an actual — "Budgeted $0 / Actual $X" (PRs #85, #91, #92).
          a:  actual ?? null,
          aa: adopted,
          f:  'General Fund',
          e:  null,
        }],
      }],
    });

    total += adopted;
  }

  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total };
}

// ── Upsert a data_source record ───────────────────────────────────────────────
async function upsertDataSource(supabase, muniId) {
  const src = {
    name:            DATA_SOURCE_NAME,
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'fy2026',
    base_url:        PDF_URL,
    fiscal_years:    [FISCAL_YEAR],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2026')
    .eq('dataset_type', 'operating')
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) throw new Error(`data_sources update failed: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) throw new Error(`data_sources insert failed: ${error.message}`);
  return data;
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
    .from('municipalities').select('id, name').ilike('name', MUNICIPALITY_NAME).single();
  if (muniErr || !muni) {
    console.error(`Could not find ${MUNICIPALITY_NAME} municipality:`, muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})\n`);

  // ── Parse PDF ─────────────────────────────────────────────────────────────
  const deptData = parsePDF(CACHE_PATH, verbose);
  if (!deptData || deptData.size === 0) {
    console.error('PDF parsing failed or no departments found');
    process.exit(2);
  }

  const { jsonTree, total } = buildTree(deptData);

  // ── Sanity check ──────────────────────────────────────────────────────────
  if (total < 50_000_000 || total > 150_000_000) {
    console.error(`SANITY FAIL: total $${Math.round(total).toLocaleString()} outside expected $50M–$150M range`);
    if (!dryRun) process.exit(2);
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log(`Departments parsed: ${deptData.size}`);
  console.log(`General Fund total: $${Math.round(total).toLocaleString()}\n`);
  console.log('Department                             Adopted ($)    Actual ($)');
  console.log('───────────────────────────────────────────────────────────────────');
  for (const node of jsonTree) {
    const { adopted, actual } = deptData.get(node.n);
    const adoptedStr = adopted ? Math.round(adopted).toLocaleString() : '—';
    const actualStr  = actual  ? Math.round(actual).toLocaleString()  : '—';
    console.log(`${node.n.padEnd(39)}${adoptedStr.padStart(14)}  ${actualStr.padStart(14)}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`${'TOTAL'.padEnd(39)}${Math.round(total).toLocaleString().padStart(14)}\n`);

  if (dryRun) {
    console.log('(dry-run — skipping DB writes)');
    return;
  }

  // ── Upsert data_source ────────────────────────────────────────────────────
  const ds = await upsertDataSource(supabase, muni.id);
  console.log(`data_source: ${ds.id}`);

  // ── Clear prior rows ──────────────────────────────────────────────────────
  const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FISCAL_YEAR);
  if (delErr1) throw new Error(`Delete failed: ${delErr1.message}`);

  // ── Call treasury_sync_budget_tree RPC ────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    FISCAL_YEAR,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           jsonTree,
    p_row_count:      deptData.size,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)           { throw new Error(`RPC error: ${rpcErr.message}`); }
  if (rpcResult?.error) { throw new Error(`RPC returned error: ${rpcResult.error}`); }

  const inserted = rpcResult?.rows_inserted ?? deptData.size;
  console.log(`Loaded ${inserted} rows for FY${FISCAL_YEAR} (total $${Math.round(total).toLocaleString()})`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
