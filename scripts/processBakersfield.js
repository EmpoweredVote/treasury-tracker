#!/usr/bin/env node
/**
 * Bakersfield CA Budget Loader — All Operating Funds
 *
 * Extracts department-level operating budget data from Bakersfield Adopted Budget
 * PDFs using extractBakersfield.py (pdfplumber), groups rows by fiscal year,
 * builds a budget tree, and loads via treasury_sync_budget_tree RPC.
 *
 * Amount scale: PDFs express amounts in FULL DOLLARS (not thousands).
 * No scale conversion required.
 *
 * PDF coverage:
 *   fy2024-25-adopted-budget.pdf → FY2025 ($724.5M all-funds operating)
 *   fy2025-26-adopted-budget.pdf → FY2026 ($762.6M all-funds operating)
 *
 * Usage:
 *   node scripts/processBakersfield.js                     # load all PDFs
 *   node scripts/processBakersfield.js --dry-run           # parse and print, no DB writes
 *   node scripts/processBakersfield.js --pdf "docs/Bakersfield/fy2025-26-adopted-budget.pdf"
 *   node scripts/processBakersfield.js --revenue           # load revenue data
 *   node scripts/processBakersfield.js --dry-run --revenue # dry-run revenue
 *
 * Requires: Python 3 + pdfplumber (pre-installed, confirmed in RESEARCH.md)
 * Requires: Bakersfield municipality seeded via seedLongBeachBakersfieldCA.js (Plan 01)
 *
 * Security (T-29-04): maxBuffer 8MB cap on execSync
 * Security (T-29-05): PDF path from controlled docs/Bakersfield/ readdir; double-quoted
 * Security (T-29-06): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-29-07): sanity band $600M-$900M; halt on scale mismatch before DB write
 */

import { execSync }              from 'node:child_process';
import { createClient }          from '@supabase/supabase-js';
import { parseArgs }             from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                      from 'node:path';
import { fileURLToPath }         from 'node:url';
import { resolve, dirname }      from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── Env loading ───────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Operating band sanity (T-29-07) ───────────────────────────────────────────
// Bakersfield ALL operating funds: ~$600M-$900M per fiscal year
// Target: ~$765M operating per REQUIREMENTS.md DATA-07
// FY2025: $724.5M (confirmed), FY2026: $762.6M (confirmed)
// If total falls outside this band, halt before any DB write
const OP_BAND_MIN = 600_000_000;   // $600M
const OP_BAND_MAX = 900_000_000;   // $900M

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Bakersfield/*.pdf live in the main working tree. Fall back to the
// main repo root via git rev-parse --git-common-dir when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Bakersfield');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Bakersfield');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-29-05): PDF path from controlled docs/Bakersfield/ readdir, not user input.
// Security (T-29-04): maxBuffer 8MB cap.
function extractPDF(pdfPath, revenue = false) {
  const pyScript = path.join(ROOT, 'scripts', 'extractBakersfield.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const revenueFlag = revenue ? ' --revenue' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${revenueFlag}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Build operating budget tree from extracted rows ───────────────────────────
// Each department becomes a top-level node { n, a, i[] }.
// Fund field: 'All Operating Funds' (all-funds scope, not GF-only)
function buildOperatingTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,
      a: amount,
      i: [{
        d: row.department,
        a: amount,
        aa: null,
        f: 'All Operating Funds',
        e: null,
      }],
    });
    total += amount;
  }

  // Sort by amount descending (largest departments first)
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Build revenue tree from extracted rows ────────────────────────────────────
function buildRevenueTree(rows) {
  const nodes = [];
  let total = 0;

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,
      a: amount,
      i: [{
        d: row.department,
        a: amount,
        aa: null,
        f: 'General Fund Revenue',
        e: null,
      }],
    });
    total += amount;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Ensure Bakersfield municipality exists; return its id ────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Bakersfield')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Bakersfield, CA municipality not found — run seedLongBeachBakersfieldCA.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ────────────────────────────────
// Creates per-FY rows keyed on (municipality_id, api_type=pdf_download, dataset_id=fy{year}, dataset_type)
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const label = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const src = {
    name:            `Bakersfield ${label} Budget FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fy${fiscalYear}`,
    base_url:        'file://' + pdfAbsPath.replace(/\\/g, '/'),
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
async function loadFiscalYear(muniId, pdfAbsPath, fiscalYear, datasetType, tree, total, rowCount) {
  const ds = await upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath);
  if (!ds?.id) { console.error('    data_source upsert failed'); return false; }
  console.log(`    data_source: ${ds.id}`);

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
async function processPDF(pdfAbsPath, muniId, dryRun, loadRevenue) {
  const filename = path.basename(pdfAbsPath);
  console.log(`\n  PDF: ${filename}`);

  // ── Operating budget ──────────────────────────────────────────────────────
  let rows;
  try {
    rows = extractPDF(pdfAbsPath, false);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 300));
    return;
  }

  if (!rows.length) {
    console.warn('  No operating rows extracted — skipping');
    return;
  }

  // Group rows by fiscal year (should be one FY per PDF for Bakersfield)
  const fyMap = new Map();
  for (const row of rows) {
    const fy = row.fiscal_year;
    if (!fyMap.has(fy)) fyMap.set(fy, []);
    fyMap.get(fy).push(row);
  }

  for (const [fy, fyRows] of fyMap) {
    if (!fy) {
      console.error(`  ERROR: Could not determine fiscal year for ${filename} — skipping`);
      continue;
    }

    const { tree, total } = buildOperatingTree(fyRows);
    const rowCount = tree.length;

    console.log(`\n  FY${fy} All-Funds Operating — $${total.toLocaleString()} total (${rowCount} departments)`);

    // Print top departments
    for (const n of tree.slice(0, 8)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (tree.length > 8) console.log(`    … +${tree.length - 8} more`);

    // Sanity check (T-29-07): operating band $600M-$900M
    // Target ~$765M (all-funds); ~$287M GF-only is WRONG — halt if too low
    if (total < OP_BAND_MIN || total > OP_BAND_MAX) {
      console.error(`\n  SCALE MISMATCH WARNING: FY${fy} operating total $${total.toLocaleString()} is outside`);
      console.error(`  expected band $${OP_BAND_MIN.toLocaleString()}-$${OP_BAND_MAX.toLocaleString()}.`);
      console.error('  Possible causes: General-Fund-only extraction yielding ~$287M, wrong units,');
      console.error('  or wrong section parsed. HALTING before live load to prevent bad data.');
      process.exit(3);
    }

    if (dryRun) {
      console.log(`  [dry-run] fiscal_year=${fy} row_count=${rowCount} total=$${total.toLocaleString()}`);
    } else if (muniId) {
      await loadFiscalYear(muniId, pdfAbsPath, fy, 'operating', tree, total, rowCount);
    }
  }

  // ── Revenue (best-effort) ─────────────────────────────────────────────────
  if (!loadRevenue) return;

  let revRows;
  try {
    revRows = extractPDF(pdfAbsPath, true);
  } catch (e) {
    console.error('  Revenue extract failed:', e.message.slice(0, 300));
    return;
  }

  if (!revRows.length) {
    console.warn('  No revenue rows extracted — skipping revenue load');
    return;
  }

  const revFyMap = new Map();
  for (const row of revRows) {
    const fy = row.fiscal_year;
    if (!revFyMap.has(fy)) revFyMap.set(fy, []);
    revFyMap.get(fy).push(row);
  }

  for (const [fy, fyRevRows] of revFyMap) {
    if (!fy) continue;

    const { tree: revTree, total: revTotal } = buildRevenueTree(fyRevRows);
    const revRowCount = revTree.length;

    console.log(`\n  FY${fy} GF Revenue — $${revTotal.toLocaleString()} total (${revRowCount} categories)`);
    for (const n of revTree.slice(0, 5)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }

    if (dryRun) {
      console.log(`  [dry-run] revenue fiscal_year=${fy} row_count=${revRowCount} total=$${revTotal.toLocaleString()}`);
    } else if (muniId) {
      await loadFiscalYear(muniId, pdfAbsPath, fy, 'revenue', revTree, revTotal, revRowCount);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      pdf:       { type: 'string' },
      revenue:   { type: 'boolean', default: false },
    },
    strict: false,
  });

  const dryRun    = opts['dry-run'];
  const loadRev   = opts['revenue'];

  // Discover PDFs from docs/Bakersfield/ (worktree-safe)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Bakersfield/');
      process.exit(1);
    }
    files.sort();  // Process alphabetically: fy2024-25 before fy2025-26
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Bakersfield All-Funds Budget Loader${dryRun ? ' (dry-run)' : ''}${loadRev ? ' +revenue' : ''}`);
  console.log(`PDFs to process: ${pdfPaths.length}`);
  for (const p of pdfPaths) console.log(`  - ${path.basename(p)}`);

  let muniId = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
  }

  for (const p of pdfPaths) {
    await processPDF(p, muniId, dryRun, loadRev);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
