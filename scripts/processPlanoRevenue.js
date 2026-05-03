#!/usr/bin/env node
/**
 * Plano Revenue Extractor
 *
 * Extracts General Fund revenue data from Plano operating budget PDFs using
 * pdftotext — no AI API calls, pure text parsing.
 *
 * Each PDF contains a "GENERAL FUND REVENUE BY SOURCE" table with columns:
 *   Actual FY-2 | Actual FY-1 | Budget FY-1 | Re-Est FY-1 | Budget FY (current, skip)
 *
 * We load: approved_amount = Budget FY-1, actual_amount = Re-Est FY-1,
 *          fiscal_year = the year of the Budget column (e.g. "2023-24" -> 2024)
 *
 * Usage:
 *   node scripts/processPlanoRevenue.js            # all PDFs
 *   node scripts/processPlanoRevenue.js --fy 2025  # only the FY2025 PDF
 *   node scripts/processPlanoRevenue.js --dry-run  # parse and print, no DB writes
 */

import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF map: document year -> relative path ───────────────────────────────────
const PDFS = {
  2019: 'docs/Plano/2018-19 Program of Service - Operating Budget (PDF).pdf',
  2020: 'docs/Plano/2019-20 Program of Service - Operating Budget (PDF).pdf',
  2022: 'docs/Plano/2021-22 Program of Service - Operating Budget (PDF).pdf',
  2023: 'docs/Plano/2022-23 Program of Service - Operating Budget (PDF).pdf',
  2024: 'docs/Plano/2023-24 Program of Service - Operating Budget (PDF).pdf',
  2025: 'docs/Plano/2024-25 Program of Service - Operating Budget (PDF).pdf',
  // 2026 PDF has scrambled label-value alignment throughout — skip until manually corrected
  // 2026: 'docs/Plano/2025-26 Program of Service - Operating Budget (PDF).pdf',
};

// ── Section markers ───────────────────────────────────────────────────────────
const SECTION_START = 'GENERAL FUND REVENUE BY SOURCE';
const SECTION_END   = 'GENERAL FUND EXPENDITURES BY DIVISION';

// Category-level headers that appear without data values on their own row.
const CATEGORY_HEADERS = new Set([
  'Taxes', 'Ad Valorem Taxes:', 'Franchise Fees',
  'Fines & Forfeits', 'Miscellaneous Revenue',
  'Licenses and Permits', 'Licenses & Permits',
  'Fees & Service Charges', 'Charges for Services',
  'Intergovernmental Revenue', 'Intragovernmental Transfers',
]);

// In pdftotext -layout mode some category header rows visually overlap with
// their first sub-item so pdftotext places the sub-item values on the header
// line. When we see these labels WITH data we reclassify the row correctly.
const MERGED_FIRST_ITEM = {
  'Fines & Forfeits':          'Municipal Court',
  'Miscellaneous Revenue':     'Interest Income',
  'Licenses and Permits':      'Food Handlers Permits',
  'Licenses & Permits':        'Food Handlers Permits',
  'Fees & Service Charges':    'Animal Pound & Adoption Fee',
  'Charges for Services':      'Animal Pound & Adoption Fee',
  'Intergovernmental Revenue': 'School Resource Officers',
};

// ── Parse a single money token ────────────────────────────────────────────────
function parseMoney(raw) {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  const neg = t.startsWith('(');
  const n = parseFloat(t.replace(/[$()\s,]/g, ''));
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

// ── Detect column layout from the first ~15 lines of a section ───────────────
function detectColumns(headerLines) {
  let typeLine = null;
  let yearLine = null;
  for (const line of headerLines) {
    if (!typeLine && /\bActual\b/.test(line) && /\bBudget\b/.test(line)) typeLine = line;
    // Require at least 2 year patterns — the single "2024-25" current-year line only has one
    if (!yearLine) {
      const yMatches = line.match(/20\d\d-\d\d/g);
      if (yMatches && yMatches.length >= 2) yearLine = line;
    }
    if (typeLine && yearLine) break;
  }
  if (!yearLine) return null;

  // Collect year positions in the left data area only (< 85 chars).
  // The current-year Budget column appears far right on a separate line — exclude it.
  const yearRe = /20\d\d-\d\d/g;
  const leftYears = [];
  let m;
  while ((m = yearRe.exec(yearLine)) !== null) {
    if (m.index < 85) leftYears.push({ str: m[0], pos: m.index });
  }
  if (!leftYears.length) return null;

  const colPositions = leftYears.map(y => y.pos);

  // Assign a type (Actual / Budget / Re-Est) to each column by proximity
  const TYPE_WORDS = ['Re-Est', 'Budget', 'Actual'];
  const colTypes = colPositions.map(pos => {
    if (!typeLine) return 'Actual';
    let best = 'Actual', bestDist = Infinity;
    for (const word of TYPE_WORDS) {
      const re = new RegExp('\\b' + word + '\\b', 'g');
      let wm;
      while ((wm = re.exec(typeLine)) !== null) {
        const d = Math.abs(wm.index - pos);
        if (d < bestDist) { bestDist = d; best = word; }
      }
    }
    return best;
  });

  const budgetColIdx = colTypes.indexOf('Budget');
  let reEstColIdx    = colTypes.indexOf('Re-Est');
  // If Re-Est precedes Budget (unusual), fall back to column after Budget
  if (reEstColIdx <= budgetColIdx && budgetColIdx + 1 < colTypes.length) {
    reEstColIdx = budgetColIdx + 1;
  }

  // Derive fiscal year: "2023-24" -> 2024
  let fiscalYear = null;
  if (budgetColIdx >= 0) {
    const parts = leftYears[budgetColIdx].str.split('-');
    fiscalYear = parseInt(parts[0].slice(0, 2), 10) * 100 + parseInt(parts[1], 10);
  }

  return { colPositions, colTypes, budgetColIdx, reEstColIdx, fiscalYear, colCount: leftYears.length };
}

// ── Extract per-column values from a data line ────────────────────────────────
function extractValues(line, colInfo) {
  const { colPositions } = colInfo;
  const dataStart = colPositions[0];
  const dataEnd   = colPositions[colPositions.length - 1] + 22;
  const result    = new Array(colPositions.length).fill(null);

  // Use midpoints between column positions as zone boundaries so that values
  // landing 1-2 chars left of their header position are still assigned correctly.
  const zones = colPositions.map((lo, i) => ({
    lo: i === 0 ? lo - 2 : Math.round((colPositions[i - 1] + lo) / 2),
    hi: i + 1 < colPositions.length ? Math.round((lo + colPositions[i + 1]) / 2) : lo + 22,
  }));

  // Match money tokens: $NNN,NNN  (NNN,NNN)  NNN,NNN  bare integers
  const numRe = /\(?\$?(?:\d{1,3}(?:,\d{3})+|\d+)\)?/g;
  let nm;
  while ((nm = numRe.exec(line)) !== null) {
    const pos = nm.index;
    if (pos < dataStart || pos >= dataEnd) continue;
    for (let i = 0; i < colPositions.length; i++) {
      if (pos >= zones[i].lo && pos < zones[i].hi) {
        if (result[i] === null) result[i] = parseMoney(nm[0]);
        break;
      }
    }
  }
  return result;
}

// ── Parse the revenue section from one PDF ────────────────────────────────────
function parsePDF(fullPath) {
  let text;
  try {
    text = execSync('pdftotext -layout "' + fullPath + '" -', {
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (e) {
    console.error('  pdftotext error:', e.message.slice(0, 200));
    return null;
  }

  const lines = text.split('\n');

  // Find the REAL section start (not the TOC reference — the real one has
  // year-pattern header lines within the next 12 lines).
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(SECTION_START)) continue;
    let hasYears = false;
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
      if (/20\d\d-\d\d/.test(lines[j])) { hasYears = true; break; }
    }
    if (hasYears) { sectionStart = i; break; }
  }
  if (sectionStart === -1) { console.error('  Section not found'); return null; }

  // Collect section lines, stopping at SECTION_END
  const sectionLines = [];
  for (let i = sectionStart; i < lines.length && sectionLines.length < 350; i++) {
    if (i > sectionStart + 5 && lines[i].includes(SECTION_END)) break;
    sectionLines.push(lines[i]);
  }

  const colInfo = detectColumns(sectionLines.slice(0, 15));
  if (!colInfo || colInfo.budgetColIdx < 0) {
    console.error('  Could not detect column structure');
    return null;
  }

  let currentDept = 'General Fund Revenue';
  const rows = [];

  for (const line of sectionLines) {
    const t = line.trim();
    if (!t) continue;

    // Skip header / metadata lines
    if (t === SECTION_START) continue;
    if (/\bActual\b|\bBudget\b|\bVariance\b|\bRe-Est\b/.test(t) && !/[$\d(]/.test(t)) continue;
    if (/Bud to Bud|Est to Bud/.test(t)) continue;
    if (/^20\d\d-\d\d$/.test(t)) continue;
    if (/Program of Service|City of Plano/.test(t)) continue;
    if (/^Page \d+$/.test(t)) continue;
    // In some PDF years SOURCE OF INCOME merges with the first data row (Ad Valorem Current).
    // Treat it as such when it carries values; otherwise skip the header form.
    if (/^SOURCE OF INCOME/.test(t)) {
      const vals = extractValues(line, colInfo);
      const budgetVal = vals[colInfo.budgetColIdx];
      if (budgetVal !== null && budgetVal !== 0) {
        const actual = colInfo.reEstColIdx >= 0 ? (vals[colInfo.reEstColIdx] ?? null) : null;
        currentDept = 'Ad Valorem Taxes';
        rows.push({ department: 'Ad Valorem Taxes', category: 'Current', approved_amount: budgetVal, actual_amount: actual, fund: 'General Fund' });
      }
      continue;
    }
    if (t.startsWith('*')) continue;
    // Stop at the grand revenue total — everything below is internal fund transfers
    if (/^TOTAL REVENUE\b|^TOTAL GENERAL FUND\b/i.test(t)) break;
    if (/^TOTAL\b|^SUBTOTAL\b/i.test(t)) continue;

    const values = extractValues(line, colInfo);
    const label  = line.slice(0, colInfo.colPositions[0]).trim();
    if (!label) continue;

    // Category headers always update currentDept first.
    // Some headers visually merge with their first sub-item in layout mode
    // (MERGED_FIRST_ITEM) — those get a real data row if the Budget column has a value.
    // All others are pure headers and we skip creating a row (any values present
    // are column-5 bleed-in from the current-year budget, not real col1-4 data).
    // Normalize label for header matching — strip trailing dash/colon variants
    const normalizedLabel = label.replace(/\s*[-–:]\s*$/, '').trim();
    if (CATEGORY_HEADERS.has(label) || CATEGORY_HEADERS.has(normalizedLabel)) {
      currentDept = normalizedLabel;
      const mergedItem = MERGED_FIRST_ITEM[label] || MERGED_FIRST_ITEM[normalizedLabel];
      if (mergedItem) {
        const budgetVal = values[colInfo.budgetColIdx];
        if (budgetVal !== null) {
          const actual = colInfo.reEstColIdx >= 0 ? (values[colInfo.reEstColIdx] ?? null) : null;
          if (!(budgetVal === 0 && (actual === null || actual === 0))) {
            rows.push({ department: currentDept, category: mergedItem, approved_amount: budgetVal, actual_amount: actual, fund: 'General Fund' });
          }
        }
      }
      continue;
    }

    const hasData = values.some(v => v !== null);
    if (!hasData) continue;

    const approved = values[colInfo.budgetColIdx] ?? null;
    const actual   = colInfo.reEstColIdx >= 0 ? (values[colInfo.reEstColIdx] ?? null) : null;

    if (approved === null && actual === null) continue;
    if (approved === 0 && actual === 0) continue;

    rows.push({ department: currentDept, category: label.replace(/\*$/, '').trim(), approved_amount: approved, actual_amount: actual, fund: 'General Fund' });
  }

  return { rows, fiscalYear: colInfo.fiscalYear, colInfo };
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
function buildTree(rows) {
  const tree = new Map();
  let total  = 0;
  for (const row of rows) {
    const approved = Number(row.approved_amount) || 0;
    const actual   = row.actual_amount != null ? Number(row.actual_amount) : null;
    if (approved === 0 && (actual === null || actual === 0)) continue;
    const dept = row.department || 'Unknown';
    const cat  = row.category   || 'General';
    if (!tree.has(dept)) tree.set(dept, new Map());
    if (!tree.get(dept).has(cat)) tree.get(dept).set(cat, []);
    tree.get(dept).get(cat).push({ d: cat, a: approved, aa: actual, f: row.fund || null, e: null });
    total += approved;
  }
  const jsonTree = [];
  for (const [deptName, cats] of tree) {
    let deptTotal = 0;
    const children = [];
    for (const [catName, items] of cats) {
      const catTotal = items.reduce((s, i) => s + i.a, 0);
      deptTotal += catTotal;
      children.push({ n: catName, a: catTotal, i: items });
    }
    children.sort((a, b) => b.a - a.a);
    jsonTree.push({ n: deptName, a: deptTotal, c: children });
  }
  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total };
}

// ── Upsert a revenue data_source record ───────────────────────────────────────
async function upsertDataSource(muniId, fiscalYear, relPath) {
  const src = {
    name:            'Plano Revenue FY' + fiscalYear,
    api_type:        'pdf_download',
    dataset_type:    'revenue',
    dataset_id:      'fy' + fiscalYear,
    base_url:        'file://' + path.resolve(ROOT, relPath).replace(/\\/g, '/'),
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', 'fy' + fiscalYear)
    .eq('dataset_type', 'revenue')
    .maybeSingle();

  if (existing?.id) {
    const { data } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    return data;
  }
  const { data } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  return data;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      fy:        { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: false,
  });

  const dryRun      = opts['dry-run'];
  const targetDocFY = opts.fy ? parseInt(opts.fy, 10) : null;

  const { data: plano, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Plano').single();
  if (muniErr || !plano) { console.error('Could not find Plano:', muniErr?.message); process.exit(2); }
  console.log('Municipality: ' + plano.name + ' (' + plano.id + ')\n');

  const docYears = targetDocFY
    ? [targetDocFY]
    : Object.keys(PDFS).map(Number).sort();

  let totalRows = 0;

  for (const docYear of docYears) {
    const relPath = PDFS[docYear];
    if (!relPath) { console.warn('No PDF configured for doc year ' + docYear); continue; }

    console.log('── FY' + docYear + ' PDF ──────────────────────────────────────');
    const parsed = parsePDF(path.join(ROOT, relPath));
    if (!parsed) { console.error('  Skipping (parse failed)\n'); continue; }

    const { rows, fiscalYear, colInfo } = parsed;
    const { jsonTree, total } = buildTree(rows);

    console.log('  Fiscal year loaded:  ' + fiscalYear);
    console.log('  Columns detected:    ' + colInfo.colCount + ' (Budget[' + colInfo.budgetColIdx + '] Re-Est[' + colInfo.reEstColIdx + '])');
    console.log('  Line items parsed:   ' + rows.length);
    console.log('  Total revenue:       $' + Math.round(total).toLocaleString());
    for (const dept of jsonTree) {
      console.log('    ' + dept.n + ': $' + Math.round(dept.a).toLocaleString() + ' (' + dept.c.length + ' items)');
    }

    if (dryRun) { console.log('  (dry-run — skipping DB)\n'); continue; }
    if (!fiscalYear) { console.error('  No fiscal year detected — skipping\n'); continue; }

    const ds = await upsertDataSource(plano.id, fiscalYear, relPath);
    if (!ds?.id) { console.error('  data_source upsert failed'); continue; }
    console.log('  data_source: ' + ds.id);

    const { error: delErr } = await supabase.schema('treasury').from('budgets')
      .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
    if (delErr) { console.error('  Clear failed:', delErr.message); continue; }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    fiscalYear,
      p_dataset_type:   'revenue',
      p_total:          total,
      p_tree:           jsonTree,
      p_row_count:      rows.length,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr)           { console.error('  RPC error:', rpcErr.message); continue; }
    if (rpcResult?.error) { console.error('  RPC error (returned):', rpcResult.error); continue; }

    const inserted = rpcResult?.rows_inserted ?? 0;
    console.log('  Loaded ' + inserted + ' rows for FY' + fiscalYear + '\n');
    totalRows += inserted;
  }

  console.log('\nDone. Total rows loaded: ' + totalRows);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
