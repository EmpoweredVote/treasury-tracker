#!/usr/bin/env node
/**
 * Santa Ana CA Budget Loader — General Fund operating + revenue
 *
 * Extracts General Fund department-level appropriations from Santa Ana Adopted Budget PDFs
 * using extractSantaAna.py (pdfplumber), groups rows by fiscal year, builds a budget tree,
 * and loads via treasury_sync_budget_tree RPC.
 *
 * Santa Ana FY runs July 1 – June 30; stored as ending year.
 * Example: FY 2024-2025 → stored as integer 2025.
 *
 * PDF structure: "City of Santa Ana General Fund Expenditure Summary" pages list GF
 * departments with subtotals. These pages are GF-only — enterprise funds (Water, Sewer,
 * Refuse Collections, Sanitation, Parking, Transportation Center, Federal Clean Water
 * Protection) appear only on separate fund pages and are NEVER produced by the extractor.
 * Revenue: "City of Santa Ana General Fund Revenue Summary" pages have clean GF revenue.
 *
 * Amount scale: FULL DOLLARS (verified via dry-run; FY2024/25 GF = $406,773,060).
 *
 * Sanity band: $350M–$450M per FY (operating)
 * (FY2022/23: ~$404M, FY2023/24: ~$414M, FY2024/25: ~$407M, FY2025/26: ~$424M)
 *
 * Usage:
 *   node scripts/processSantaAna.js                    # load all PDFs (operating)
 *   node scripts/processSantaAna.js --dry-run          # parse and print, no DB writes
 *   node scripts/processSantaAna.js --pdf "docs/Santa Ana/fy2025-adopted-budget.pdf"
 *   node scripts/processSantaAna.js --revenue          # load revenue mode
 *
 * Requires: Python 3 + pdfplumber (pre-installed, confirmed in RESEARCH.md)
 * Requires: Santa Ana municipality seeded via seedAnaheimSantaAnaCA.js (Plan 01)
 *
 * Security (T-31-10): maxBuffer raised to 16MB (Santa Ana PDFs ~18-38MB; JSON output larger)
 * Security (T-31-11): PDF path from controlled docs/Santa Ana/ readdir; double-quoted
 * Security (T-31-13): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-31-08): GF band sanity check; halt on scale mismatch before any DB write
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
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`  loadEnv: unexpected error reading ${f}: ${e.message}`);
      }
    }
  }
}
loadEnv();

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── GF band sanity (T-31-08) ──────────────────────────────────────────────────
// Santa Ana General Fund adopted totals per fiscal year:
// FY2022/23: ~$404M, FY2023/24: ~$414M, FY2024/25: ~$407M, FY2025/26: ~$424M
// Band set to $350M–$450M to cover all years with margin.
const GF_BAND_MIN = 350_000_000;  // $350M floor
const GF_BAND_MAX = 450_000_000;  // $450M ceiling (FY2025/26 ~$424M)

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Santa Ana/*.pdf live in the main working tree. Fall back to the
// main repo root via git rev-parse --git-common-dir when needed.
// The city name is 'Santa Ana' (with space) — must match directory name exactly.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Santa Ana');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Santa Ana');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-31-11): PDF path from controlled docs/Santa Ana/ readdir, not user input.
// Security (T-31-10): maxBuffer raised to 16MB (Santa Ana PDFs ~18-38MB; JSON output larger).
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractSantaAna.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const modeArg = mode === 'revenue' ? ' --mode revenue' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${modeArg}`, {
    maxBuffer: 16 * 1024 * 1024,  // 16MB — raised from 8MB: Santa Ana PDFs ~18-38MB
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Build operating budget tree from extracted rows ───────────────────────────
// Each department becomes a top-level node { n, a, i[] }.
function buildTree(rows, datasetType) {
  const nodes = [];
  let total = 0;
  const fundLabel = datasetType === 'revenue' ? 'General Fund Revenue' : 'General Fund';

  for (const row of rows) {
    const amount = row.adopted_amount;
    nodes.push({
      n: row.department,
      a: amount,
      i: [{
        d: row.department,
        a: amount,
        aa: null,
        f: fundLabel,
        e: null,
      }],
    });
    total += amount;
  }

  // Sort by amount descending (largest departments first)
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Ensure Santa Ana municipality exists; return its id ──────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Santa Ana')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Santa Ana, CA municipality not found — run seedAnaheimSantaAnaCA.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ────────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const label = datasetType === 'revenue' ? 'General Fund Revenue Budget'
              : 'General Fund Operating Budget';
  const src = {
    name:            `Santa Ana ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `santa-ana-fy${fiscalYear}-${datasetType}`,
    base_url:        'file://' + pdfAbsPath.replace(/\\/g, '/'),
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `santa-ana-fy${fiscalYear}-${datasetType}`)
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
async function processPDF(pdfAbsPath, muniId, dryRun, datasetType) {
  const filename = path.basename(pdfAbsPath);
  const mode = datasetType === 'revenue' ? 'revenue' : 'operating';
  console.log(`\n  PDF: ${filename} [${mode}]`);

  let rows;
  try {
    rows = extractPDF(pdfAbsPath, mode);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 300));
    return;
  }

  if (!rows.length) {
    console.warn(`  No rows extracted for mode=${mode} — skipping`);
    return;
  }

  // Group rows by fiscal year
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

    const { tree, total } = buildTree(fyRows, datasetType);
    const rowCount = tree.length;

    const label = mode === 'revenue' ? 'Revenue' : 'GF Operating';
    console.log(`\n  FY${fy} ${label} — $${total.toLocaleString()} total (${rowCount} departments)`);

    // Print departments
    for (const n of tree.slice(0, 10)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (tree.length > 10) console.log(`    … +${tree.length - 10} more`);

    // Sanity check (T-31-08): halt before any DB write if total outside expected band
    // Revenue totals are not checked against operating band
    if (mode === 'operating') {
      if (total < GF_BAND_MIN || total > GF_BAND_MAX) {
        console.error(`\n  SCALE MISMATCH WARNING: FY${fy} ${mode} total $${total.toLocaleString()} is outside`);
        console.error(`  expected band $${GF_BAND_MIN.toLocaleString()}-$${GF_BAND_MAX.toLocaleString()}.`);
        console.error('  Possible causes: amounts in wrong units (thousands?), enterprise fund bleed, wrong section parsed.');
        console.error('  HALTING before live load to prevent incorrect data insertion.');
        process.exit(3);
      }
    }

    if (dryRun) {
      console.log(`  [dry-run] fiscal_year=${fy} row_count=${rowCount} total=$${total.toLocaleString()}`);
    } else if (muniId) {
      await loadFiscalYear(muniId, pdfAbsPath, fy, datasetType, tree, total, rowCount);
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

  const dryRun      = opts['dry-run'];
  const datasetType = opts.revenue ? 'revenue' : 'operating';

  // Discover PDFs from docs/Santa Ana/ (worktree-safe)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Santa Ana/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Santa Ana GF Budget Loader${dryRun ? ' (dry-run)' : ''} [${datasetType}]`);
  console.log(`PDFs to process: ${pdfPaths.length}`);
  for (const p of pdfPaths) console.log(`  - ${path.basename(p)}`);

  let muniId = null;
  if (!dryRun) {
    muniId = await ensureMunicipality();
  }

  for (const p of pdfPaths) {
    await processPDF(p, muniId, dryRun, datasetType);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
