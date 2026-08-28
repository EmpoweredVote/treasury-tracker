#!/usr/bin/env node
/**
 * Princeton TX FY2026 Operating Budget Loader (pdftotext-parser route)
 *
 * Extracts General Fund operating expenditures from Princeton's FY2025-2026
 * Adopted Budget PDF using pdftotext — no AI API calls, pure text parsing.
 *
 * PDF structure:
 *   "GENERAL FUND - EXPENDITURES" section (page 66) has a function-level
 *   expenditure table with 4 columns:
 *     Actual 2023-24 | Amended Budget 2024-25 | Projected 2024-25 | Adopted 2025-2026
 *
 *   5 function groups with "Total X" labeled summary rows:
 *     General Government | Parks and Recreation | Public Safety
 *     Public Service and Operations | Public Works
 *
 *   For General Government, Parks, and Public Safety the "Total X" label line
 *   has garbled non-$-prefixed numbers (pdftotext layout artifact); the real
 *   4-column $-prefixed totals appear on the immediately following non-blank line.
 *
 *   For Public Service and Operations and Public Works the "Total X" line has
 *   $-prefixed values directly.
 *
 *   GF total = $36,852,089 (confirmed from "Total Operating Expenditures" line).
 *
 * Usage:
 *   node scripts/processPrincetonBudget.js              # production (loads to DB)
 *   node scripts/processPrincetonBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processPrincetonBudget.js --verbose    # verbose parse logging
 *   node scripts/processPrincetonBudget.js --no-cache   # re-download PDF
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL    = 'https://princetontx.gov/DocumentCenter/View/6974/Adopted-Budget-2025-26';
const CACHE_PATH = 'C:/tmp/collin-budgets/princeton_fy2026.pdf';
const FISCAL_YEAR = 2026;
const DATA_SOURCE_NAME = 'Princeton Operating Budget FY2026';
const MUNICIPALITY_NAME = 'Princeton';

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── GF function groups extracted from "GENERAL FUND - EXPENDITURES" section ───
const GF_GROUPS = [
  'General Government',
  'Parks and Recreation',
  'Public Safety',
  'Public Service and Operations',
  'Public Works',
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

// ── Return {value, pos} of the rightmost $-prefixed value on a line, or null ──
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
  const deptData = new Map();
  let inSection = false;
  const remaining = new Set(GF_GROUPS);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Find "GENERAL FUND - EXPENDITURES" section header (appears once for the
    // expenditure table; the overview page uses "OVERVIEW OF GENERAL FUND EXPENDITURES")
    if (!inSection && /GENERAL FUND\s*-\s*EXPENDITURES/.test(line)) {
      inSection = true;
      if (verbose) console.error(`[section] L${i + 1}: GENERAL FUND - EXPENDITURES`);
      continue;
    }

    if (!inSection) continue;

    // Stop at "Total Operating Expenditures" (grand total row)
    if (/^\s*Total Operating Expenditures\b/.test(line)) {
      if (verbose) console.error(`[end] L${i + 1}: Total Operating Expenditures — stopping`);
      break;
    }

    // Match "Total <GroupName>" lines
    for (const group of remaining) {
      if (new RegExp(`^\\s*Total\\s+${group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(line)) {
        if (verbose) console.error(`[total-row] L${i + 1}: ${group}`);

        // Check if $ values are on the same line
        const info = lastDollarInfo(line);
        if (info !== null) {
          deptData.set(group, { adopted: info.value, actual: null });
          remaining.delete(group);
          if (verbose) console.error(`[captured] L${i + 1}: ${group} = $${info.value.toLocaleString()}`);
        } else {
          // Garbled line — look ahead up to 15 lines for first $-prefixed line
          for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
            const look = lines[j];
            const lookInfo = lastDollarInfo(look);
            if (lookInfo !== null) {
              deptData.set(group, { adopted: lookInfo.value, actual: null });
              remaining.delete(group);
              i = j;
              if (verbose) console.error(`[captured] L${j + 1}: ${group} = $${lookInfo.value.toLocaleString()} (lookahead)`);
              break;
            }
          }
        }
        break;
      }
    }

    if (remaining.size === 0) break;
  }

  for (const group of remaining) {
    console.warn(`WARNING: "${group}" — not found in GF-EXPENDITURES section`);
  }

  return deptData.size > 0 ? deptData : null;
}

// ── Build JSON tree for treasury_sync_budget_tree ─────────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  for (const group of GF_GROUPS) {
    const entry = deptData.get(group);
    if (!entry) continue;
    const { adopted } = entry;
    if (!adopted || adopted <= 0) continue;

    jsonTree.push({
      n: group,
      a: adopted,
      c: [{
        n: group,
        a: adopted,
        i: [{
          d:  group,
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
    .from('municipalities').select('id, name').ilike('name', MUNICIPALITY_NAME).eq('state', 'TX').single();
  if (muniErr || !muni) {
    console.error(`Could not find ${MUNICIPALITY_NAME} municipality:`, muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${muni.name} (${muni.id})\n`);

  // ── Parse PDF ─────────────────────────────────────────────────────────────
  const deptData = parsePDF(CACHE_PATH, verbose);
  if (!deptData || deptData.size === 0) {
    console.error('PDF parsing failed or no groups found');
    process.exit(2);
  }

  const { jsonTree, total } = buildTree(deptData);

  // ── Sanity check ($15M–$60M covers the ~$36.9M GF operating total) ───────
  if (total < 15_000_000 || total > 60_000_000) {
    console.error(`SANITY FAIL: total $${Math.round(total).toLocaleString()} outside expected $15M–$60M range`);
    if (!dryRun) process.exit(2);
  }

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log(`Groups parsed: ${deptData.size}`);
  console.log(`General Fund total: $${Math.round(total).toLocaleString()}\n`);
  console.log('Group                                  Adopted ($)');
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
