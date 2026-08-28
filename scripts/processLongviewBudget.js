#!/usr/bin/env node
/**
 * Longview Operating Budget Extractor
 *
 * Extracts General Fund operating expenditures from Longview's FY2025-26
 * Master Budget PDF using pdftotext — no AI API calls, pure text parsing.
 *
 * PDF column layout (department total-expenditure lines):
 *   2023-24 ACTUAL | 2024-25 ADJ BUDGET | 2024-25 YR-END EST | 2025-26 BUDGET
 *
 * Mapping:
 *   adopted_amount = col[3]  (2025-26 BUDGET, rightmost)
 *   actual_amount  = col[0]  (2023-24 ACTUAL, leftmost)
 *
 * PDF quirks:
 *   - "FIRE SUPPRESION" is the intentional spelling in the PDF (missing second 'S').
 *   - Several departments have empty "Total Expenditures" label lines — the actual
 *     totals appear on the NEXT numeric line (e.g. STREET DEPARTMENT, DEVELOPMENT
 *     SERVICES, BUILDING INSPECTIONS, ANIMAL SERVICES, TRAFFIC).
 *   - Some Total Expenditure rows have only 3 values (missing rightmost budget
 *     column) — the 2025-26 budget value appears on a subsequent continuation line.
 *   - "PUBLIC SAFETY" appears as an "Expenditures by Function" summary (not a dept).
 *     The individual police budget is under "POLICE OPERATIONS".
 *   - "HEALTH DEPARTMENT" wraps values across multiple lines.
 *   - "PARTNERS IN PREVENTION" has no Total Expenditures line — use last 4-col row.
 *
 * Usage:
 *   node scripts/processLongviewBudget.js              # production (loads to DB)
 *   node scripts/processLongviewBudget.js --dry-run    # parse and print, no DB write
 *   node scripts/processLongviewBudget.js --verbose    # log skipped headers + parse decisions
 *   node scripts/processLongviewBudget.js --no-cache   # re-download even if cache exists
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Config ─────────────────────────────────────────────────────────────────────
const PDF_URL   = 'https://www.longviewtexas.gov/DocumentCenter/View/17978/Master-Budget-FY-25-26-';
const CACHE_PATH = 'C:/tmp/longview_budget_fy2526.pdf';
const FISCAL_YEAR = 2026;

// ── Supabase ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Department whitelist / excludelist ────────────────────────────────────────
// Only General Fund operating departments. Utility/internal-service/grant funds excluded.
const INCLUDED = new Set([
  'CITY COUNCIL & CITY MANAGER',
  'CITY SECRETARY',
  'CITY ATTORNEY',
  'FINANCE',
  'BEAUTIFICATION',
  'HUMAN RESOURCES',
  'PURCHASING',
  'MEDIA',
  'INFORMATION SYSTEMS',
  'POLICE OPERATIONS',
  'PUBLIC SAFETY COMMUNICATIONS',
  'MUNICIPAL COURT',
  'FIRE SUPPRESION',       // intentional misspelling — matches PDF
  'PUBLIC WELFARE',
  'HEALTH DEPARTMENT',
  'PARTNERS IN PREVENTION',
  'ANIMAL SERVICES',
  'DEVELOPMENT SERVICES',
  'PLANNING AND ZONING',
  'BUILDING INSPECTIONS',
  // CULTURE AND RECREATION excluded — it's a summary; children are included separately
  'PARKS',
  'RECREATION',
  'COMMUNITY SERVICE ADMIN',
  'LIBRARY',
  // PUBLIC WORKS excluded — it's a summary that includes Streets/Traffic/SCADA/Utilities
  'SCADA',
  'TRAFFIC',
  'STREET DEPARTMENT',
]);

// These are explicitly excluded (utility/enterprise/internal service/grants)
const EXCLUDED = new Set([
  'UTILITY SERVICES',
  'WATER SUPPLY',
  'WATER DISTRIBUTION',
  'WATER PURIFICATION',
  'WASTEWATER COLLECTIONS',
  'WASTEWATER TREATMENT',
  'SANITATION',
  'INTERNAL SERVICE FUNDS',
  'RISK FUND',
  'HEALTH FUND',
  'FLEET SERVICES',
  'REPLACEMENT',
  'SPECIAL REVENUES',
  'PUBLIC SAFETY GRANTS',
  'PUBLIC SAFETY',                 // summary-by-function header — not a dept
  'CULTURE AND RECREATION GRANTS',
  'GENERAL GOVERNMENT',
  'PUBLIC WORKS SPECIAL REVENUE',
  'INTERFUND',
  'NONDEPARTMENTAL',
  'PUBLIC WELFARE GRANTS',
  'DEVELOPMENTAL SERVICES',        // alternate spelling, same as DEVELOPMENT SERVICES
  'PLANT AUTOMATION TECHNOLOGY',
  'PUBLIC WORKS ENGINEERING',
  'PUBLIC WORKS &',
]);

// ── Parse a money token (handles negatives in parens) ─────────────────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── Detect 4 column start-positions from a dept header line ───────────────────
// Header format: "DEPT NAME    2023-24    2024-25    2024-25    2025-26"
// Returns array of 4 character positions (start of each year label).
function detectColumnPositions(line) {
  const yearRe = /20\d\d-\d\d/g;
  const matches = [];
  let m;
  while ((m = yearRe.exec(line)) !== null) {
    matches.push(m.index);
  }
  // Need exactly 4 year columns; some summary lines have extra or fewer
  if (matches.length < 4) return null;
  return matches.slice(0, 4);
}

// ── Extract a value at a specific column from a line ──────────────────────────
// Looks for a number token whose start position falls in the "zone" for that column.
// Zone boundaries are midpoints between adjacent columns.
function extractValueAtColumn(line, colPositions, colIdx) {
  const nCols = colPositions.length;

  // Zone: from midpoint with previous column to midpoint with next column
  const lo = colIdx === 0
    ? 0
    : Math.round((colPositions[colIdx - 1] + colPositions[colIdx]) / 2);
  const hi = colIdx === nCols - 1
    ? line.length + 30  // generous right edge for rightmost column
    : Math.round((colPositions[colIdx] + colPositions[colIdx + 1]) / 2);

  const numRe = /\(?\$?(?:\d{1,3}(?:,\d{3})+|\d+)\)?/g;
  let nm;
  let lastVal = null;
  while ((nm = numRe.exec(line)) !== null) {
    const pos = nm.index;
    if (pos >= lo && pos < hi) {
      const v = parseMoney(nm[0]);
      if (v !== null) lastVal = v;  // take last match in zone (handles multi-line continuations)
    }
  }
  return lastVal;
}

// ── Extract all 4 column values from a single line ───────────────────────────
function extractAllColumns(line, colPositions) {
  return colPositions.map((_, idx) => extractValueAtColumn(line, colPositions, idx));
}

// ── Check if a line is a department-section end marker ────────────────────────
function isSectionEnd(line) {
  // Next dept header, page markers, or blank-line clusters
  return /^Page \d+ of \d+/.test(line.trim())
      || /^Expenditures by Function/.test(line.trim())
      || /^Authorized Positions/.test(line.trim());
}

// ── Parse the PDF text and extract included department data ───────────────────
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

  // Strip form-feed characters (pdftotext inserts one per page).
  // They appear as the first char of a line, so we strip them to keep the
  // column positions intact (each removed \x0c shifts col positions by 1 — acceptable
  // because form feeds only ever appear at position 0 of a line).
  const lines = text.split('\n').map(l => l.startsWith('\x0c') ? l.slice(1) : l);
  const nLines = lines.length;

  // deptName -> { adopted, actual }
  const deptData = new Map();

  // Dept header pattern: starts at col 0, ALL-CAPS, followed by 2+ spaces, then a year
  const deptHeaderRe = /^([A-Z][A-Z\s&\-\/\(\),\.]+?)\s{2,}(20\d\d-\d\d)/;

  for (let i = 0; i < nLines; i++) {
    const line = lines[i];
    const hm = deptHeaderRe.exec(line);
    if (!hm) continue;

    const rawName = hm[1].trim();

    if (EXCLUDED.has(rawName)) {
      if (verbose) console.error(`[skip-excluded] Line ${i}: ${rawName}`);
      continue;
    }

    if (!INCLUDED.has(rawName)) {
      if (verbose) console.error(`[skip-unknown]  Line ${i}: ${rawName}`);
      continue;
    }

    // Already have this dept?  (PDF has some depts repeated in summary + detail sections)
    if (deptData.has(rawName)) {
      if (verbose) console.error(`[skip-dup]      Line ${i}: ${rawName} (already captured)`);
      continue;
    }

    const colPositions = detectColumnPositions(line);
    if (!colPositions) {
      if (verbose) console.error(`[skip-nocol]    Line ${i}: ${rawName} (could not detect 4 columns)`);
      continue;
    }

    if (verbose) console.error(`[dept]          Line ${i}: ${rawName} — cols at ${colPositions}`);

    // ── Scan forward for the Total Expenditure(s) row (up to 60 lines) ─────────
    let adopted = null;
    let actual  = null;
    let found   = false;

    const SCAN_LIMIT = Math.min(i + 80, nLines);

    for (let j = i + 1; j < SCAN_LIMIT; j++) {
      const sl = lines[j];

      // Stop if we hit the next dept header (at col 0, different dept)
      const sm = deptHeaderRe.exec(sl);
      if (sm && sm[1].trim() !== rawName) break;

      const isTotalLine = /Total Expenditures?/i.test(sl);

      if (isTotalLine) {
        // Try to extract values from this line
        const vals = extractAllColumns(sl, colPositions);
        if (verbose) console.error(`  [total-line] L${j}: vals=${JSON.stringify(vals)} — "${sl.trim()}"`);

        // Seed from the labeled line
        if (vals[0] !== null) actual  = vals[0];
        if (vals[3] !== null) adopted = vals[3];

        // ALWAYS scan continuation lines: last non-null value per column wins.
        // Many depts have Total Expenditures showing only a sub-component; the real
        // grand total appears on the unlabeled lines that follow.
        for (let k = j + 1; k < Math.min(j + 8, SCAN_LIMIT); k++) {
          const nl = lines[k];
          if (!nl.trim()) continue;                        // skip blanks
          if (isSectionEnd(nl)) break;
          if (/Total Expenditures?/i.test(nl)) break;     // don't bleed into next section
          const nm2 = deptHeaderRe.exec(nl);
          if (nm2 && nm2[1].trim() !== rawName) break;    // next dept header

          const nv0 = extractValueAtColumn(nl, colPositions, 0);
          const nv3 = extractValueAtColumn(nl, colPositions, 3);
          if (verbose) console.error(`  [total-cont] L${k}: col0=${nv0} col3=${nv3} — "${nl.trim()}"`);
          if (nv0 !== null) actual  = nv0;
          if (nv3 !== null) adopted = nv3;
        }

        found = true;
        break;
      }
    }

    // ── Fallback: no Total Expenditures label found — track last value per column ─
    if (!found) {
      if (verbose) console.error(`  [no-total]   Scanning for last-value-per-col in ${rawName}`);

      // Track per-column: last non-null value wins (handles values split across lines)
      const lastPerCol = [null, null, null, null];
      for (let j = i + 1; j < SCAN_LIMIT; j++) {
        const sl = lines[j];
        const sm = deptHeaderRe.exec(sl);
        if (sm && sm[1].trim() !== rawName) break;
        if (isSectionEnd(sl)) break;

        const vals = extractAllColumns(sl, colPositions);
        for (let c = 0; c < 4; c++) {
          if (vals[c] !== null) lastPerCol[c] = vals[c];
        }
      }

      actual  = lastPerCol[0];
      adopted = lastPerCol[3];
      if (verbose) console.error(`  [fallback]   actual=${actual}, adopted=${adopted}`);
      if (actual !== null || adopted !== null) found = true;
    }

    if (!found || (adopted === null && actual === null)) {
      if (verbose) console.error(`  [no-data]    ${rawName} — skipping (no values found)`);
      continue;
    }

    // Default nulls to 0 for display, but keep null semantics for DB
    deptData.set(rawName, {
      adopted: adopted ?? 0,
      actual:  actual  ?? null,
    });

    if (verbose) {
      console.error(`  [captured]   ${rawName}: adopted=$${(adopted ?? 0).toLocaleString()}, actual=${actual !== null ? '$' + actual.toLocaleString() : 'null'}`);
    }
  }

  return deptData;
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  for (const [deptName, { adopted, actual }] of deptData) {
    if (adopted === 0 && actual === null) continue;

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
          a:  actual,       // -> actual_amount (2023-24 ACTUAL)
          aa: adopted,      // -> approved_amount (the adopted budget)
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
    name:            'Longview Operating Budget FY2026',
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

  // ── Supabase client (needed even in dry-run to look up municipality) ──────
  if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_KEY env var');
    process.exit(2);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── Municipality lookup ───────────────────────────────────────────────────
  const { data: longview, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Longview').single();
  if (muniErr || !longview) {
    console.error('Could not find Longview municipality:', muniErr?.message);
    process.exit(2);
  }
  console.log(`Municipality: ${longview.name} (${longview.id})\n`);

  // ── Parse PDF ─────────────────────────────────────────────────────────────
  const deptData = parsePDF(CACHE_PATH, verbose);
  if (!deptData) {
    console.error('PDF parsing failed');
    process.exit(2);
  }

  const { jsonTree, total } = buildTree(deptData);

  // ── Summary table ─────────────────────────────────────────────────────────
  console.log(`Departments parsed: ${deptData.size}`);
  console.log(`General Fund total: $${Math.round(total).toLocaleString()}\n`);
  console.log('Department                        Adopted ($)    Actual ($)');
  console.log('─────────────────────────────────────────────────────────────');
  for (const node of jsonTree) {
    const { adopted, actual } = deptData.get(node.n);
    const adoptedStr = adopted ? adopted.toLocaleString() : '—';
    const actualStr  = actual  ? actual.toLocaleString()  : '—';
    console.log(`${node.n.padEnd(34)}${adoptedStr.padStart(14)}  ${actualStr.padStart(14)}`);
  }
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`${'TOTAL'.padEnd(34)}${Math.round(total).toLocaleString().padStart(14)}\n`);

  if (dryRun) {
    console.log('(dry-run — skipping DB writes)');
    return;
  }

  // ── Upsert data_source ────────────────────────────────────────────────────
  const ds = await upsertDataSource(supabase, longview.id);
  console.log(`data_source: ${ds.id}`);

  // ── Clear prior rows ──────────────────────────────────────────────────────
  const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', FISCAL_YEAR);
  const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
    .delete()
    .eq('municipality_id', longview.id)
    .eq('fiscal_year', FISCAL_YEAR)
    .eq('dataset_type', 'operating')
    .is('data_source_id', null);
  if (delErr1) throw new Error(`Delete (by data_source_id) failed: ${delErr1.message}`);
  if (delErr2) throw new Error(`Delete (orphaned) failed: ${delErr2.message}`);

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
