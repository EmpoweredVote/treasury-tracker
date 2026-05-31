#!/usr/bin/env node
/**
 * Portland OR Budget Loader — operating (Vol 1) and revenue (Vol 2)
 *
 * Operating mode (default): extracts bureau-level appropriation data from Vol 1
 * PDFs. Revenue mode (--revenue): extracts fund-level Resources Total from Vol 2.
 *
 * Usage:
 *   node scripts/processPortland.js              # operating, all vol1 PDFs
 *   node scripts/processPortland.js --revenue    # revenue, all vol2 PDFs
 *   node scripts/processPortland.js --dry-run    # parse and print, no DB writes
 *   node scripts/processPortland.js --pdf "docs/Portland/fy2025-26-vol1.pdf"
 *
 * Requires: Python 3 + pdfplumber  (pip install pdfplumber)
 * Requires: Portland municipality seeded via seedPortlandOregon.js
 *
 * Security (T-17-03): PDF path comes from controlled docs/Portland/ readdir,
 * not user input; argument is quoted in execSync invocation.
 * Security (T-17-04): maxBuffer 8MB; extractor emits compact rows only.
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
// like docs/Portland/*.pdf live in the main working tree. Fall back to the
// main repo root (two levels up from .git file in the worktree) when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Portland');
  if (existsSync(candidate)) return candidate;

  // Try to find the main working tree via git
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    // gitDir is e.g. "C:/treasury-tracker/.git" — dirname is the main repo root
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Portland');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* ignore — not in a git repo */ }

  return candidate; // return original path so readdirSync gives a clear error
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF URLs by mode and fiscal year ──────────────────────────────────────────
// URLs confirmed working 2026-05-31 (RESEARCH Pitfall 2: Portland CMS URLs unstable)
const PDF_URLS = {
  operating: {
    2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download',
    2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-1-city-portland-city-summaries-and-bureau/download',
    2024: 'https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
    2023: 'https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
    2022: 'https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download',
  },
  revenue: {
    2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-2-city-funds-and-capital-projects/download',
    2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-2-city-portland-city-funds-and-capital-projects/download',
    2024: 'https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-2-funds-and-capital-projects/download',
    2023: 'https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-2-funds-and-capital-projects/download',
    2022: 'https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-2-funds-and-capital-projects/download',
  },
};

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
function extractPDF(pdfPath, mode = 'operating') {
  const pyScript = path.join(ROOT, 'scripts', 'extractPortland.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}" --mode ${mode}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Infer fiscal year from PDF filename ───────────────────────────────────────
// fy2025-26-vol1.pdf → 2026; fy2024-25-vol1.pdf → 2025
function inferFiscalYearFromFilename(filename) {
  const m = filename.match(/fy(\d{4})-(\d{2})/i);
  if (m) {
    const century = Math.floor(parseInt(m[1], 10) / 100) * 100;
    return century + parseInt(m[2], 10);
  }
  return null;
}

// ── Build revenue tree from extracted fund rows (Vol 2) ──────────────────────
// Each fund becomes a top-level node. Funds with $0 Resources Total are excluded.
function buildRevenueTree(rows) {
  const nodes = rows
    .filter(r => r.resources_total > 0)
    .map(r => ({
      n: r.fund,
      a: r.resources_total,
      i: [{ d: r.fund, a: r.resources_total, aa: null, f: null, e: null }],
    }));
  nodes.sort((a, b) => b.a - a.a);
  const total = nodes.reduce((s, n) => s + n.a, 0);
  return { tree: nodes, total };
}

// ── Build operating budget tree from extracted rows ───────────────────────────
// Each bureau becomes a top-level node { n, a, i[] }.
// The single line item is the bureau itself (bureau-level granularity from this table).
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.bureau,
      a: amount,
      i: [{
        d: row.bureau,
        a: amount,
        aa: null,
        f: null,
        e: null,
      }],
    });
    total += amount;
  }

  // Sort by amount descending (largest bureaus first)
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Ensure Portland municipality exists; return its id ────────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Portland')
    .eq('state', 'OR')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Portland, OR municipality not found — run seedPortlandOregon.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ───────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType) {
  const urlMap = PDF_URLS[datasetType] ?? PDF_URLS.operating;
  const baseUrl = urlMap[fiscalYear];
  if (!baseUrl) {
    console.warn(`  WARNING: No PDF URL configured for FY${fiscalYear} ${datasetType} — base_url will be empty`);
  }

  const label = datasetType === 'revenue' ? 'Revenue Budget' : 'Operating Budget';
  const src = {
    name:            `Portland ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fy${fiscalYear}`,
    base_url:        baseUrl ?? '',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', datasetType)
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
async function loadFiscalYear(muniId, fiscalYear, datasetType, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear, datasetType);
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
    p_dataset_type:   datasetType,
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
async function processPDF(pdfAbsPath, muniId, dryRun, mode = 'operating') {
  const filename = path.basename(pdfAbsPath);
  console.log(`\n  PDF: ${filename}`);

  let rows;
  try {
    rows = extractPDF(pdfAbsPath, mode);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  if (!rows.length) {
    console.warn(`  No ${mode === 'revenue' ? 'fund' : 'bureau'} rows extracted — skipping`);
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

    const isRevenue = mode === 'revenue';
    const { tree, total } = isRevenue ? buildRevenueTree(fyRows) : buildOperatingTree(fyRows);
    const rowCount = tree.length;
    const unitLabel = isRevenue ? 'funds' : 'bureaus';
    const typeLabel = isRevenue ? 'Revenue' : 'Operating';
    const datasetType = isRevenue ? 'revenue' : 'operating';

    console.log(`\n  FY${fy} ${typeLabel} — $${total.toLocaleString()} total (${rowCount} ${unitLabel})`);
    for (const n of tree.slice(0, 8)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (tree.length > 8) console.log(`    … +${tree.length - 8} more`);

    if (dryRun) {
      console.log(`  [dry-run] fiscal_year=${fy} row_count=${rowCount} total=$${total.toLocaleString()}`);
    } else if (muniId) {
      await loadFiscalYear(muniId, fy, datasetType, tree, total, rowCount);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      revenue:   { type: 'boolean', default: false },
      pdf:       { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const mode = opts.revenue ? 'revenue' : 'operating';
  const volSuffix = mode === 'revenue' ? 'vol2' : 'vol1';

  // Discover PDFs from docs/Portland/ (worktree-safe: falls back to main working tree)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf') && f.toLowerCase().includes(volSuffix));
    if (!files.length) {
      console.error(`No ${volSuffix} PDFs found in docs/Portland/`);
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Portland Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
  console.log(`PDFs to process: ${pdfPaths.length}`);

  let muniId = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
  }

  for (const p of pdfPaths) {
    await processPDF(p, muniId, dryRun, mode);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
