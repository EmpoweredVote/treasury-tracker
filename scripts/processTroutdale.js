#!/usr/bin/env node
/**
 * Troutdale OR Budget Loader — operating and revenue modes
 *
 * Extracts department-level (operating) or category-level (revenue) budget data
 * from Troutdale adopted budget PDFs and loads them via the treasury_sync_budget_tree RPC.
 *
 * Usage:
 *   node scripts/processTroutdale.js --dry-run           # parse and print, no DB writes
 *   node scripts/processTroutdale.js                     # live load all PDFs (operating)
 *   node scripts/processTroutdale.js --revenue --dry-run # revenue dry-run
 *   node scripts/processTroutdale.js --revenue           # live load revenue
 *   node scripts/processTroutdale.js --pdf "docs/Troutdale/fy2025-26.pdf"
 *
 * Requires: Python 3 + pdfplumber  (pip install pdfplumber)
 * Requires: Troutdale municipality seeded via seedTroutdaleOregon.js
 *
 * Security (T-22-01): PDF path comes from controlled docs/Troutdale/ readdir,
 * not user input; spawnSync with args array (no shell injection).
 * Security (T-22-03): maxBuffer 8MB; extractor emits compact rows only.
 * Security (T-22-04): amounts assert FY2026 operating total under $30M (gated on operating mode).
 * Security (T-22-02): upsertDataSource filters on dataset_type param to avoid collision.
 */

import { execSync, spawnSync } from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync, existsSync } from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Resolve PDF directory (worktree-safe) ────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Troutdale/*.pdf live in the main working tree. Fall back to the
// main repo root (via git rev-parse --git-common-dir) when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Troutdale');
  if (existsSync(candidate)) return candidate;

  // Try to find the main working tree via git
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    // gitDir is e.g. "C:/treasury-tracker/.git" — dirname is the main repo root
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Troutdale');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* ignore — not in a git repo */ }

  return candidate; // return original path so readdirSync gives a clear error
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF URLs by fiscal year (Troutdale: media IDs from troutdaleoregon.gov) ──
// URLs confirmed live via HTTP check (RESEARCH Data Source Details)
const PDF_URLS = {
  2026: 'https://www.troutdaleoregon.gov/media/31436',
  2025: 'https://www.troutdaleoregon.gov/media/26636',
  2024: 'https://www.troutdaleoregon.gov/media/15016',
  2023: 'https://www.troutdaleoregon.gov/media/15021',
  2022: 'https://www.troutdaleoregon.gov/media/15026',
  2021: 'https://www.troutdaleoregon.gov/media/15031',
  2020: 'https://www.troutdaleoregon.gov/media/15036',
  2019: 'https://www.troutdaleoregon.gov/media/15041',
};

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
function extractPDF(pdfPath, mode = 'operating') {
  const pyScript = path.join(ROOT, 'scripts', 'extractTroutdale.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const args = [pyScript, pdfPath];
  if (mode === 'revenue') args.push('--mode', 'revenue');
  const result = spawnSync(pythonBin, args, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`extractTroutdale.py failed (exit ${result.status}): ${result.stderr}`);
  }
  return JSON.parse(result.stdout);
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

// Troutdale FY2026 operating is ~$21.1M; $30M cap catches subtotal double-counting regressions.
// Revenue mode is intentionally exempt (T-22-04): all-funds resources legitimately exceed this cap.
const SANITY_MAX = { 2026: 30_000_000 };

// ── Build operating budget tree from extracted department rows ─────────────────
// Each department becomes a top-level node { n, a, i[] }.
// Uses row.department (Troutdale field) NOT row.bureau (Portland field).
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,    // 'department' field (Troutdale) vs 'bureau' (Portland)
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

// ── Build revenue budget tree from extracted category rows ────────────────────
// Each revenue category becomes a top-level node { n, a, i[] }.
// Uses row.category and row.adopted_amount (Troutdale revenue fields).
function buildRevenueTree(rows) {
  const nodes = rows
    .filter(r => r.adopted_amount > 0)
    .map(r => ({
      n: r.category,
      a: r.adopted_amount,
      i: [{ d: r.category, a: r.adopted_amount, aa: null, f: null, e: null }],
    }));
  nodes.sort((a, b) => b.a - a.a);
  const total = nodes.reduce((s, n) => s + n.a, 0);
  return { tree: nodes, total };
}

// ── Ensure Troutdale municipality exists; return its id ───────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Troutdale')
    .eq('state', 'OR')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Troutdale, OR municipality not found — run seedTroutdaleOregon.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ───────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType) {
  const label = datasetType === 'revenue' ? 'Revenue Budget' : 'Operating Budget';
  const src = {
    name:            `Troutdale ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fy${fiscalYear}`,
    base_url:        PDF_URLS[fiscalYear] ?? '',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing, error: selectErr } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fy${fiscalYear}`)
    .eq('dataset_type', datasetType)
    .maybeSingle();

  if (selectErr) {
    console.error('  data_source lookup error:', selectErr.message);
    return null;  // caller at line 206 handles null ds
  }

  if (existing?.id) {
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) console.error('  data_source update error:', error.message);
    return data;
  }
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) console.error('  data_source insert error:', error.message);
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

  const isRevenue   = mode === 'revenue';
  const unitLabel   = isRevenue ? 'categories' : 'departments';
  const typeLabel   = isRevenue ? 'Revenue' : 'Operating';
  const datasetType = isRevenue ? 'revenue' : 'operating';

  let rows;
  try {
    rows = extractPDF(pdfAbsPath, mode);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  if (!rows.length) {
    console.warn(`  No ${isRevenue ? 'category' : 'department'} rows extracted — skipping`);
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
      const nullRows = [...(fyMap.get(null) ?? []), ...(fyMap.get(undefined) ?? [])];
      fyMap.delete(null);
      fyMap.delete(undefined);
      if (nullRows.length > 0) fyMap.set(inferred, nullRows);
      console.warn(`  WARNING: Fiscal year inferred from filename: ${inferred}`);
    }
  }

  for (const [fy, fyRows] of fyMap) {
    if (!fy) {
      console.error(`  ERROR: Could not determine fiscal year for ${filename} — skipping`);
      continue;
    }

    const { tree, total } = isRevenue ? buildRevenueTree(fyRows) : buildOperatingTree(fyRows);
    const rowCount = tree.length;

    // Sanity check: only applies to operating mode (revenue total legitimately
    // exceeds the operating cap — T-22-04 threat accepted for revenue mode)
    if (mode === 'operating' && SANITY_MAX[fy] && total > SANITY_MAX[fy]) {
      console.error(`  SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds $30M cap — aborting`);
      return;
    }

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
  const mode   = opts.revenue ? 'revenue' : 'operating';

  // Discover PDFs from docs/Troutdale/ (worktree-safe: falls back to main working tree)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));  // no volSuffix filter — all are operating
    if (!files.length) {
      console.error('No PDFs found in docs/Troutdale/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Troutdale Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
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
