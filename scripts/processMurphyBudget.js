#!/usr/bin/env node
/**
 * Murphy TX FY2025 Operating Budget Loader (pdftotext-parser route)
 *
 * Extracts General Fund operating expenditures from Murphy's FY2025 Adopted
 * Budget PDF using pdftotext — no AI API calls, pure text parsing.
 *
 * PDF structure:
 *   The per-department EXPENDITURES detail pages use a complex multi-column
 *   layout that pdftotext cannot reliably linearize; department totals are
 *   scattered or absent from the "Total Expense Objects:" label lines.
 *
 *   Instead, this parser uses the "FY 2024-2025 Combined Summary of Budget
 *   by Fund" table (pages 29-30) which has clean function-level GF totals:
 *     General Government | Community Development | Public Safety
 *     Public Works | Parks & Recreation | Solid Waste
 *
 *   These 6 function categories map cleanly to the "Current Expenditures"
 *   table GF column and match the city's own published GF total.
 *
 *   GF total = $20,008,004 (all current expenditures incl. capital/transfers).
 *   Operating total (6 categories) = ~$19.8M.
 *
 * Usage:
 *   node scripts/processMurphyBudget.js              # production (loads to DB)
 *   node scripts/processMurphyBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processMurphyBudget.js --verbose    # verbose parse logging
 *   node scripts/processMurphyBudget.js --no-cache   # re-download PDF
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://www.murphytx.org/DocumentCenter/View/9835/City-of-Murphy-Budget-Book-with-amendments-as-of-09162025';
const CACHE_PATH = 'C:/tmp/collin-budgets/murphy_fy2025.pdf';
const FISCAL_YEAR = 2025;
const DATA_SOURCE_NAME = 'Murphy Operating Budget FY2025';
const MUNICIPALITY_NAME = 'Murphy';

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── GF function categories to extract from the combined summary table ─────────
// Values in order of appearance; skip Capital Outlay, Debt Service, Non-Dept.
const GF_CATEGORIES = [
  'General Government',
  'Community Development',
  'Public Safety',
  'Public Works',
  'Parks & Recreation',
  'Solid Waste',
];

// ── Parse a money token (handles $ prefix, commas, parens for negatives) ──────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim().replace(/^-$/, '');
  if (!t) return null;
  const neg = t.startsWith('(') || t.startsWith('-');
  const n = parseFloat(t.replace(/[$()\s,\-]/g, ''));
  if (isNaN(n) || n === 0) return null;
  return neg ? -n : n;
}

// ── Extract the first $ or bare numeric value from a line ─────────────────────
// Handles both "$NNN,NNN" and bare "NNN,NNN" formats.
function firstPositiveValue(line) {
  // Try $ prefixed first
  const dollarRe = /\$\s*([\d,]+(?:\.\d+)?)/g;
  let m;
  while ((m = dollarRe.exec(line)) !== null) {
    const v = parseMoney(m[1]);
    if (v !== null && v > 0) return v;
  }
  // Try bare number (at least 6 chars to avoid picking up small numbers)
  const bareRe = /(?<!\d)([\d]{1,3}(?:,\d{3})+)/g;
  while ((m = bareRe.exec(line)) !== null) {
    const v = parseMoney(m[1]);
    if (v !== null && v > 0) return v;
  }
  return null;
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
  const deptData = new Map();
  let inCurrentExpenditures = false;
  const remaining = new Set(GF_CATEGORIES);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find "Current Expenditures" section header in the combined fund summary
    if (/^\s*Current Expenditures\s*$/.test(line)) {
      inCurrentExpenditures = true;
      if (verbose) console.error(`[section] L${i + 1}: Current Expenditures section`);
      continue;
    }

    // Stop at "Total Expenditures" line (end of current expenditures section)
    if (inCurrentExpenditures && /^\s*Total Expenditures/.test(line)) {
      if (verbose) console.error(`[end] L${i + 1}: Total Expenditures — stopping`);
      break;
    }

    if (!inCurrentExpenditures) continue;

    // Match each GF category name at the START of the line (with leading whitespace)
    for (const cat of remaining) {
      if (line.trim().startsWith(cat)) {
        const v = firstPositiveValue(line);
        if (v !== null) {
          deptData.set(cat, { adopted: v, actual: null });
          remaining.delete(cat);
          if (verbose) console.error(`[captured] L${i + 1}: ${cat} = $${v.toLocaleString()}`);
        } else if (verbose) {
          console.error(`[miss] L${i + 1}: ${cat} — no positive value on line: "${line.trim()}"`);
        }
        break;
      }
    }

    if (remaining.size === 0) break;
  }

  // Warn about any categories not found
  for (const cat of remaining) {
    console.warn(`WARNING: "${cat}" — not found in combined summary`);
  }

  return deptData.size > 0 ? deptData : null;
}

// ── Build JSON tree for treasury_sync_budget_tree ─────────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  // Preserve GF_CATEGORIES order
  for (const cat of GF_CATEGORIES) {
    const entry = deptData.get(cat);
    if (!entry) continue;
    const { adopted } = entry;
    if (!adopted || adopted <= 0) continue;

    jsonTree.push({
      n: cat,
      a: adopted,
      c: [{
        n: cat,
        a: adopted,
        i: [{
          d:  cat,
          // ⚠ aa -> approved_amount, a -> actual_amount in _treasury_insert_tree. The NODE
      // key `a` is the rollup (correctly the adopted figure); the ITEM key `a` is
      // actual_amount. Same letter, two meanings one line apart — the trap behind
      // PRs #85, #91, #92 and this one.
          a:  null,
          aa: adopted,
          f:  'General Fund',
          e:  null,
        }],
      }],
    });
    total += adopted;
  }

  return { jsonTree, total };
}

// ── Upsert a data_source record ───────────────────────────────────────────────
async function upsertDataSource(supabase, muniId) {
  const src = {
    name:            DATA_SOURCE_NAME,
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'fy2025',
    base_url:        PDF_URL,
    fiscal_years:    [FISCAL_YEAR],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy2025')
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
    console.error('PDF parsing failed or no categories found');
    process.exit(2);
  }

  const { jsonTree, total } = buildTree(deptData);

  // ── Sanity check ($15M–$25M covers the ~$19.7M GF operating total) ───────
  if (total < 15_000_000 || total > 25_000_000) {
    console.error(`SANITY FAIL: total $${Math.round(total).toLocaleString()} outside expected $15M–$25M range`);
    if (!dryRun) process.exit(2);
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log(`Categories parsed: ${deptData.size}`);
  console.log(`General Fund total: $${Math.round(total).toLocaleString()}\n`);
  console.log('Category                               Adopted ($)');
  console.log('─────────────────────────────────────────────────────');
  for (const node of jsonTree) {
    console.log(`${node.n.padEnd(39)}${Math.round(node.a).toLocaleString().padStart(14)}`);
  }
  console.log('─────────────────────────────────────────────────────');
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
