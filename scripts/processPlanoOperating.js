#!/usr/bin/env node
/**
 * Plano Operating Budget Extractor
 *
 * Extracts General Fund operating budget data from Plano Program of Service PDFs
 * using pdftotext — no AI API calls, pure text parsing.
 *
 * Each PDF contains individual department pages with "Program Expenditures" tables:
 *   Actual FY-2 | Budget FY-1 | Estimate FY-1 | Budget FY (current) | % Change
 *
 * We load: approved_amount = Budget FY (column 4), fiscal_year = year of Budget column.
 * actual_amount is not set — actuals come from the transactions (check register) data.
 *
 * Only General Fund departments are extracted (header line ends with "GENERAL FUND").
 * Expense categories: Salaries & Wages, Operations & Maintenance, Reimbursements, Capital Outlay.
 *
 * Usage:
 *   node scripts/processPlanoOperating.js            # all PDFs
 *   node scripts/processPlanoOperating.js --fy 2025  # only the FY2025 PDF
 *   node scripts/processPlanoOperating.js --dry-run  # parse and print, no DB writes
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

// ── PDF map: fiscal year -> relative path ─────────────────────────────────────
const PDFS = {
  2019: 'docs/Plano/2018-19 Program of Service - Operating Budget (PDF).pdf',
  2020: 'docs/Plano/2019-20 Program of Service - Operating Budget (PDF).pdf',
  2022: 'docs/Plano/2021-22 Program of Service - Operating Budget (PDF).pdf',
  2023: 'docs/Plano/2022-23 Program of Service - Operating Budget (PDF).pdf',
  2024: 'docs/Plano/2023-24 Program of Service - Operating Budget (PDF).pdf',
  2025: 'docs/Plano/2024-25 Program of Service - Operating Budget (PDF).pdf',
  // 2026 PDF has the same label-value alignment issues as revenue — only 21 of ~78 depts parse correctly
  // 2026: 'docs/Plano/2025-26 Program of Service - Operating Budget (PDF).pdf',
};

// Expense category row labels on department pages.
// Reimbursements are internal cost-recovery and appear as negative values.
const EXPENSE_CATEGORIES = new Set([
  'Salaries & Wages',
  'Operations & Maintenance',
  'Reimbursements',
  'Capital Outlay',
]);

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

// ── Detect column layout from the "Program Expenditures" header line ──────────
// The year line is the "Program Expenditures" line itself:
//   "Program Expenditures    2022-23    2023-24    2023-24    2024-25    2024-25"
//    columns (0-indexed):       0          1          2          3(Budget) 4(%Chg)
//
// We take the first 4 year positions as data columns; index 3 = current Budget.
// The 5th year position (% Change column) is excluded.
function detectColumns(progExpLine) {
  const yearRe = /20\d\d-\d\d/g;
  const years = [];
  let m;
  while ((m = yearRe.exec(progExpLine)) !== null) {
    years.push({ str: m[0], pos: m.index });
  }

  if (years.length < 4) return null;

  // First 4 are the data columns; 5th+ is the % Change year label (ignored).
  const dataYears = years.slice(0, 4);
  const colPositions = dataYears.map(y => y.pos);

  // Fiscal year from the 4th column label: "2024-25" -> 2025
  const parts = dataYears[3].str.split('-');
  const fiscalYear = parseInt(parts[0].slice(0, 2), 10) * 100 + parseInt(parts[1], 10);

  return { colPositions, budgetColIdx: 3, fiscalYear };
}

// ── Extract per-column values from a data line ────────────────────────────────
function extractValues(line, colPositions) {
  const result = new Array(colPositions.length).fill(null);

  const zones = colPositions.map((lo, i) => ({
    lo: i === 0 ? lo - 2 : Math.round((colPositions[i - 1] + lo) / 2),
    hi: i + 1 < colPositions.length ? Math.round((lo + colPositions[i + 1]) / 2) : lo + 18,
  }));

  const numRe = /\(?\$?(?:\d{1,3}(?:,\d{3})+|\d+)\)?/g;
  let nm;
  while ((nm = numRe.exec(line)) !== null) {
    const pos = nm.index;
    for (let i = 0; i < colPositions.length; i++) {
      if (pos >= zones[i].lo && pos < zones[i].hi) {
        if (result[i] === null) result[i] = parseMoney(nm[0]);
        break;
      }
    }
  }
  return result;
}

// ── Parse all General Fund department sections from one PDF ───────────────────
function parsePDF(fullPath) {
  let text;
  try {
    text = execSync(`pdftotext -layout "${fullPath}" -`, {
      maxBuffer: 64 * 1024 * 1024,
      encoding: 'utf8',
    });
  } catch (e) {
    console.error('  pdftotext error:', e.message.slice(0, 200));
    return null;
  }

  const lines = text.split('\n');

  // deptName -> { items: { category -> amount }, fiscalYear }
  const deptData = new Map();
  let lastDeptName = null;
  let detectedFiscalYear = null;

  for (let i = 0; i < lines.length; i++) {
    // Detect department header: "DEPT NAME [4+ spaces] GENERAL FUND"
    // Must start with a capital letter and end with "GENERAL FUND" (not a page number).
    // TOC entries have a number at the end: "CITY COUNCIL     157"
    const headerMatch = lines[i].match(/^([A-Z][A-Z\s&\-\/\(\)]+?)\s{4,}GENERAL FUND\s*$/);
    if (headerMatch) {
      lastDeptName = headerMatch[1].trim();
      continue;
    }

    // Detect "Program Expenditures" line with year labels on the same line.
    // Skip the glossary reference ("6. Program Expenditures - Summary...") which has no years.
    if (!lines[i].includes('Program Expenditures')) continue;
    if (!/20\d\d-\d\d/.test(lines[i])) continue;
    if (!lastDeptName) continue;

    const colInfo = detectColumns(lines[i]);
    if (!colInfo) {
      console.warn(`  Could not detect columns for "${lastDeptName}" — skipping`);
      lastDeptName = null;
      continue;
    }

    if (!detectedFiscalYear) detectedFiscalYear = colInfo.fiscalYear;

    // Scan next ~18 lines for expense category rows.
    // Stop at TOTAL, Personnel Summary, or blank line after first non-blank match.
    const items = {};
    let foundAny = false;
    for (let j = i + 2; j < Math.min(i + 20, lines.length); j++) {
      const line = lines[j];
      const label = line.slice(0, colInfo.colPositions[0]).trim();

      if (/^TOTAL\b/i.test(label)) break;
      if (/^Personnel Summary/i.test(label)) break;

      if (!EXPENSE_CATEGORIES.has(label)) continue;

      const values = extractValues(line, colInfo.colPositions);
      const amount = values[colInfo.budgetColIdx] ?? 0;
      items[label] = (items[label] ?? 0) + amount;
      foundAny = true;
    }

    if (!foundAny) {
      lastDeptName = null;
      continue;
    }

    const deptTotal = Object.values(items).reduce((s, v) => s + v, 0);

    if (deptData.has(lastDeptName)) {
      // Aggregate if the same department appears across multiple pages.
      const existing = deptData.get(lastDeptName);
      for (const [cat, amt] of Object.entries(items)) {
        existing.items[cat] = (existing.items[cat] ?? 0) + amt;
      }
    } else {
      deptData.set(lastDeptName, { items, fiscalYear: colInfo.fiscalYear, total: deptTotal });
    }

    lastDeptName = null; // consume — reset after each Program Expenditures table
  }

  return { deptData, fiscalYear: detectedFiscalYear };
}

// ── Build the JSON tree for treasury_sync_budget_tree ─────────────────────────
function buildTree(deptData) {
  const jsonTree = [];
  let total = 0;

  for (const [deptName, { items }] of deptData) {
    const deptTotal = Object.values(items).reduce((s, v) => s + v, 0);
    if (deptTotal === 0) continue;

    const children = [];
    for (const [catName, amount] of Object.entries(items)) {
      if (amount === 0) continue;
      children.push({
        n: catName,
        a: amount,
        i: [{ d: catName, a: amount, aa: null, f: 'General Fund', e: null }],
      });
    }
    children.sort((a, b) => b.a - a.a);

    jsonTree.push({ n: deptName, a: deptTotal, c: children });
    total += deptTotal;
  }

  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total };
}

// ── Upsert a data_source record ───────────────────────────────────────────────
async function upsertDataSource(muniId, fiscalYear, relPath) {
  const src = {
    name:            `Plano Operating Budget FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      `fy${fiscalYear}`,
    base_url:        'file://' + path.resolve(ROOT, relPath).replace(/\\/g, '/'),
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', 'operating')
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
  const targetFY    = opts.fy ? parseInt(opts.fy, 10) : null;

  const { data: plano, error: muniErr } = await supabase.schema('treasury')
    .from('municipalities').select('id, name').ilike('name', 'Plano').single();
  if (muniErr || !plano) { console.error('Could not find Plano:', muniErr?.message); process.exit(2); }
  console.log(`Municipality: ${plano.name} (${plano.id})\n`);

  const fiscalYears = targetFY
    ? [targetFY]
    : Object.keys(PDFS).map(Number).sort();

  let totalDepts = 0;

  for (const fy of fiscalYears) {
    const relPath = PDFS[fy];
    if (!relPath) { console.warn(`No PDF configured for FY${fy}`); continue; }

    console.log(`── FY${fy} PDF ──────────────────────────────────────`);
    const parsed = parsePDF(path.join(ROOT, relPath));
    if (!parsed) { console.error('  Skipping (parse failed)\n'); continue; }

    const { deptData, fiscalYear } = parsed;
    const { jsonTree, total } = buildTree(deptData);

    console.log(`  Fiscal year detected: ${fiscalYear}`);
    console.log(`  Departments parsed:   ${deptData.size}`);
    console.log(`  General Fund total:   $${Math.round(total).toLocaleString()}`);
    for (const dept of jsonTree.slice(0, 8)) {
      console.log(`    ${dept.n}: $${Math.round(dept.a).toLocaleString()}`);
    }
    if (jsonTree.length > 8) console.log(`    ... and ${jsonTree.length - 8} more`);

    if (dryRun) { console.log('  (dry-run — skipping DB)\n'); continue; }
    if (!fiscalYear) { console.error('  No fiscal year detected — skipping\n'); continue; }

    // Use the detected fiscal year, not the PDF map key (they should match).
    const loadFY = fiscalYear;

    const ds = await upsertDataSource(plano.id, loadFY, relPath);
    if (!ds?.id) { console.error('  data_source upsert failed'); continue; }
    console.log(`  data_source: ${ds.id}`);

    // Delete existing budget rows linked to this data_source.
    // Also clear any old orphaned rows (data_source_id = null) for this municipality + year + type,
    // which were created by prior Haiku-based loads that failed to link data sources.
    const { error: delErr1 } = await supabase.schema('treasury').from('budgets')
      .delete().eq('data_source_id', ds.id).eq('fiscal_year', loadFY);
    const { error: delErr2 } = await supabase.schema('treasury').from('budgets')
      .delete()
      .eq('municipality_id', plano.id)
      .eq('fiscal_year', loadFY)
      .eq('dataset_type', 'operating')
      .is('data_source_id', null);
    if (delErr1 || delErr2) {
      console.error('  Clear failed:', delErr1?.message || delErr2?.message);
      continue;
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year:    loadFY,
      p_dataset_type:   'operating',
      p_total:          total,
      p_tree:           jsonTree,
      p_row_count:      deptData.size,
      p_triggered_by:   'bulk_load',
    });

    if (rpcErr)           { console.error('  RPC error:', rpcErr.message); continue; }
    if (rpcResult?.error) { console.error('  RPC error (returned):', rpcResult.error); continue; }

    const inserted = rpcResult?.rows_inserted ?? 0;
    console.log(`  Loaded ${inserted} rows for FY${loadFY}\n`);
    totalDepts += deptData.size;
  }

  console.log(`\nDone. Total departments processed: ${totalDepts}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
