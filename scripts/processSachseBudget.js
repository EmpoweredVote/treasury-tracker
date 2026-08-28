#!/usr/bin/env node
/**
 * Sachse TX FY2026 Operating Budget Loader (pdftotext-parser route)
 *
 * Extracts General Fund operating expenditures from Sachse's FY2025-2026
 * Adopted Budget PDF using pdftotext — no AI API calls, pure text parsing.
 *
 * PDF structure (per-dept section layout):
 *   Page 1 of each dept: narrative (mission, goals, performance)
 *     Header: "{DeptName}  ...  General Fund" (dept name + wide gap + "General Fund")
 *   Page 2 of each dept: EXPENDITURES 5-column table
 *     Columns: Actual 2021-22 | Actual 2022-23 | Actual 2023-24 | Budget 2024-25 | Budget 2025-26
 *     TOTAL row (all-caps) followed by grand total line with $ prefixes
 *   Page 3 of each dept: FTE schedule + 4-column secondary table
 *     Header: "{DeptName}  ...  General Fund" (appears again)
 *
 * Parsing strategy:
 *   1. Detect dept section start: line ending with "General Fund" where
 *      text before it (after trimming spaces) is a known dept name
 *   2. After detecting dept, find line matching /^\s*TOTAL\b/ (all-caps, 5-col table)
 *   3. First line after TOTAL with $NNN,NNN values = grand total row
 *   4. Last dollar value on that line = adopted Budget 2025-2026
 *
 * Usage:
 *   node scripts/processSachseBudget.js              # production (loads to DB)
 *   node scripts/processSachseBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processSachseBudget.js --verbose    # verbose parse logging
 *   node scripts/processSachseBudget.js --no-cache   # re-download PDF
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://www.cityofsachse.com/DocumentCenter/View/12467/FY2025-2026-Adopted-Budget';
const CACHE_PATH = 'C:/tmp/collin-budgets/sachse_fy2026.pdf';
const FISCAL_YEAR = 2026;
const DATA_SOURCE_NAME = 'Sachse Operating Budget FY2026';
const MUNICIPALITY_NAME = 'Sachse';

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── All 19 GF departments (confirmed from PDF analysis) ───────────────────────
const DEPT_NAMES = new Set([
  'Animal Services',
  'City Manager',
  'City Secretary',
  'Combined Services',
  'Development Services',
  'Engineering',
  'Facilities Maintenance',
  'Finance',
  'Fire-Rescue',
  'Human Resources',
  'Information Technology',
  'Library',
  'Municipal Court',
  'Neighborhood Services',
  'Parks',
  'Police',
  'Recreation',
  'Senior Activity Center',
  'Streets',
]);

// ── Parse a money token (handles $, commas, negatives in parens) ──────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim().replace(/^-$/, '');
  if (!t) return null;
  const neg = t.startsWith('(') || t.startsWith('-');
  const n = parseFloat(t.replace(/[$()\s,\-]/g, ''));
  if (isNaN(n) || n === 0) return null;
  return neg ? -n : n;
}

// ── Extract all $NNN,NNN dollar values from a line ────────────────────────────
function extractDollars(line) {
  const vals = [];
  const re = /\$\s*[\d,]+(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const v = parseMoney(m[0]);
    if (v !== null) vals.push(v);
  }
  return vals;
}

// ── Return {value, pos} of the rightmost $ value on a line, or null ───────────
function lastDollarInfo(line) {
  const re = /\$\s*[\d,]+(?:\.\d+)?/g;
  let last = null;
  let m;
  while ((m = re.exec(line)) !== null) {
    const v = parseMoney(m[0]);
    if (v !== null) last = { value: v, pos: m.index };
  }
  return last;
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

  const deptData    = new Map();
  const captured   = new Set();
  let currentDept  = null;
  let afterTotal   = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Detect dept section header ──────────────────────────────────────────
    // Line ends with "General Fund" and text before (after trimming) is a known dept name.
    // Each dept has this header on pages 1 AND 3 (narrative + FTE pages).
    if (/General Fund\s*$/.test(line)) {
      const candidate = line.trimEnd().replace(/\s{5,}General Fund\s*$/, '').trim();
      if (DEPT_NAMES.has(candidate) && !captured.has(candidate)) {
        currentDept = candidate;
        afterTotal  = false;
        if (verbose) console.error(`[section] L${i}: ${currentDept}`);
        continue;
      }
    }

    if (!currentDept) continue;

    // ── Detect EXPENDITURES TOTAL (all-caps, appears in 5-column table) ─────
    // Ignores mixed-case "Total" lines from secondary table (e.g. "Finance Total").
    // Also fires on FTE schedule TOTAL, but by then we've already captured and
    // cleared currentDept, so those firings are harmless.
    if (/^\s*TOTAL\b/.test(line)) {
      afterTotal = true;
      if (verbose) console.error(`[total] L${i}: TOTAL for ${currentDept}`);
      continue;
    }

    // ── Capture grand total (first $-prefixed line after TOTAL) ─────────────
    // Some depts split the grand total across 2 lines. The Budget 2025-26 column
    // (rightmost) sometimes wraps to the next line at a HIGHER character position.
    // Heuristic: if the next non-blank $-line has its last $ further right, use it.
    if (afterTotal) {
      const info = lastDollarInfo(line);
      if (info !== null) {
        let adopted      = info.value;
        const actual     = extractDollars(line)[0] ?? null; // Actual 2021-22 (leftmost)
        let lastDollarPos = info.pos;

        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const look = lines[j];
          if (!look.trim()) break; // blank line ends grand total block
          const next = lastDollarInfo(look);
          if (next === null) break; // non-blank non-$ line ends block
          if (next.pos > lastDollarPos) {
            adopted       = next.value;
            lastDollarPos = next.pos;
            i = j; // skip continuation line in outer loop
          }
        }

        deptData.set(currentDept, { adopted, actual });
        captured.add(currentDept);
        if (verbose) console.error(`[captured] L${i}: ${currentDept} adopted=$${adopted.toLocaleString()}`);
        currentDept = null;
        afterTotal  = false;
      }
    }
  }

  // ── Warn about any depts not found ────────────────────────────────────────
  for (const name of DEPT_NAMES) {
    if (!captured.has(name)) {
      console.warn(`WARNING: ${name} — not captured`);
    }
  }

  return deptData;
}

// ── Build JSON tree for treasury_sync_budget_tree ─────────────────────────────
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
  if (total < 28_000_000 || total > 35_000_000) {
    console.error(`SANITY FAIL: total $${Math.round(total).toLocaleString()} outside expected $28M–$35M range`);
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
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FISCAL_YEAR);
  if (delErr) throw new Error(`Delete failed: ${delErr.message}`);

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
