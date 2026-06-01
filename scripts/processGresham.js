#!/usr/bin/env node
/**
 * Gresham OR Budget Loader — operating only
 *
 * Extracts department-level appropriation data from Gresham adopted budget PDFs
 * and loads them via the treasury_sync_budget_tree RPC.
 *
 * Usage:
 *   node scripts/processGresham.js --dry-run    # parse and print, no DB writes
 *   node scripts/processGresham.js              # live load all four PDFs
 *   node scripts/processGresham.js --pdf "docs/Gresham/fy2025-26.pdf"
 *
 * Requires: Python 3 + pdfplumber  (pip install pdfplumber)
 * Requires: Gresham municipality seeded via seedGreshamOregon.js
 *
 * Security (T-20-03): PDF path comes from controlled docs/Gresham/ readdir,
 * not user input; argument is quoted in execSync invocation.
 * Security (T-20-04): maxBuffer 8MB; extractor emits compact rows only.
 * Security (T-20-05): dry-run + amounts assert FY2026 total under $500M.
 */

import { execSync }        from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync, existsSync } from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Resolve PDF directory (worktree-safe) ────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Gresham/*.pdf live in the main working tree. Fall back to the
// main repo root (via git rev-parse --git-common-dir) when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Gresham');
  if (existsSync(candidate)) return candidate;

  // Try to find the main working tree via git
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    // gitDir is e.g. "C:/treasury-tracker/.git" — dirname is the main repo root
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Gresham');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* ignore — not in a git repo */ }

  return candidate; // return original path so readdirSync gives a clear error
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF URLs by fiscal year (Gresham: single PDF per FY, no vol1/vol2) ────────
// URLs confirmed live via curl HTTP 200 check 2026-05-31 (RESEARCH Data Source Details)
const PDF_URLS = {
  2026: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/fy-2025-26-adopted-budget.pdf',
  2025: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy24-25.pdf',
  2024: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/budget-documents/adopted-budget-fy-2023-24.pdf',
  2023: 'https://www.greshamoregon.gov/globalassets/city-departments/budget-and-finance/adopted-budget-for-fiscal-year-2022-23.pdf',
};

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractGresham.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Infer fiscal year from PDF filename ───────────────────────────────────────
// fy2025-26.pdf → 2026; fy2022-23.pdf → 2023
function inferFiscalYearFromFilename(filename) {
  const m = filename.match(/fy(\d{4})-(\d{2})/i);
  if (m) {
    const century = Math.floor(parseInt(m[1], 10) / 100) * 100;
    return century + parseInt(m[2], 10);
  }
  return null;
}

// ── Build operating budget tree from extracted department rows ─────────────────
// Each department becomes a top-level node { n, a, i[] }.
// Uses row.department (Gresham field) NOT row.bureau (Portland field).
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,    // 'department' field (Gresham) vs 'bureau' (Portland)
      a: amount,
      i: [{
        d: row.department,
        a: amount,
        aa: null,
        f: null,
        e: null,
      }],
    });
    total += amount;
  }

  // Sort by amount descending (largest departments first)
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Ensure Gresham municipality exists; return its id ─────────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Gresham')
    .eq('state', 'OR')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Gresham, OR municipality not found — run seedGreshamOregon.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ───────────────────────────────
async function upsertDataSource(muniId, fiscalYear) {
  const src = {
    name:            `Gresham Operating Budget FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      `fy${fiscalYear}`,
    base_url:        PDF_URLS[fiscalYear] ?? '',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
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

// ── Load one fiscal year into DB ──────────────────────────────────────────────
async function loadFiscalYear(muniId, fiscalYear, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

  // Clear existing rows for idempotency
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('data_source_id', ds.id).eq('fiscal_year', fiscalYear);
  if (delErr) {
    console.error('    Pre-load delete failed:', delErr.message);
    return false;
  }

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: ds.id,
    p_fiscal_year:    fiscalYear,
    p_dataset_type:   'operating',
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });

  if (rpcErr)         { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error)     { console.error('    RPC error (returned):', rpc.error); return false; }

  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} rows`);
  return true;
}

// ── Process one PDF ───────────────────────────────────────────────────────────
async function processPDF(pdfAbsPath, muniId, dryRun) {
  const filename = path.basename(pdfAbsPath);
  console.log(`\n  PDF: ${filename}`);

  let rows;
  try {
    rows = extractPDF(pdfAbsPath);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  if (!rows.length) {
    console.warn('  No department rows extracted — skipping');
    return;
  }

  // Group rows by fiscal year
  const fyMap = new Map();
  for (const row of rows) {
    const fy = row.fiscal_year;
    if (!fyMap.has(fy)) fyMap.set(fy, []);
    fyMap.get(fy).push(row);
  }

  // Fallback: if fiscal year is null, infer from filename
  if (fyMap.has(null) || fyMap.has(undefined)) {
    const inferred = inferFiscalYearFromFilename(filename);
    if (inferred) {
      const nullRows = fyMap.get(null) || fyMap.get(undefined);
      fyMap.delete(null);
      fyMap.delete(undefined);
      fyMap.set(inferred, nullRows);
      console.warn(`  WARNING: Fiscal year inferred from filename: ${inferred}`);
    }
  }

  for (const [fy, fyRows] of fyMap) {
    if (!fy) {
      console.error(`  ERROR: Could not determine fiscal year for ${filename} — skipping`);
      continue;
    }

    const { tree, total } = buildOperatingTree(fyRows);
    const rowCount = tree.length;

    console.log(`\n  FY${fy} Operating — $${total.toLocaleString()} total (${rowCount} departments)`);
    for (const n of tree.slice(0, 8)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (tree.length > 8) console.log(`    … +${tree.length - 8} more`);

    if (dryRun) {
      console.log(`  [dry-run] fiscal_year=${fy} row_count=${rowCount} total=$${total.toLocaleString()}`);
    } else if (muniId) {
      await loadFiscalYear(muniId, fy, tree, total, rowCount);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      pdf:       { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];

  // Discover PDFs from docs/Gresham/ (worktree-safe: falls back to main working tree)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));  // no volSuffix filter — all are operating
    if (!files.length) {
      console.error('No PDFs found in docs/Gresham/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Gresham Budget Loader${dryRun ? ' (dry-run)' : ''} [operating]`);
  console.log(`PDFs to process: ${pdfPaths.length}`);

  let muniId = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
  }

  for (const p of pdfPaths) {
    await processPDF(p, muniId, dryRun);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
