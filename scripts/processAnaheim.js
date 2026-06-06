#!/usr/bin/env node
/**
 * Anaheim CA Budget Loader — General Fund operating + revenue
 *
 * Extracts General Fund department-level appropriations from Anaheim Adopted Budget PDFs
 * using extractAnaheim.py (pdfplumber), groups rows by fiscal year, builds a budget tree,
 * and loads via treasury_sync_budget_tree RPC.
 *
 * Anaheim FY runs July 1 – June 30; stored as ending year.
 * Example: FY 2024-2025 → stored as integer 2025.
 *
 * PDF structure: "General Fund Expenditures by Function" page lists GF departments.
 * This page is GF-only — enterprise funds (Utilities, Convention/Sports, Golf) appear
 * only on the citywide "Expenditures by Fund" page and are NEVER produced by the extractor.
 * Revenue: "General Fund Revenues by Category" page has clean GF revenue by category.
 *
 * Amount scale: FULL DOLLARS (verified via dry-run; FY2024/25 GF = $490,937,159).
 *
 * Sanity band: $350M–$550M per FY
 * (FY2022/23: ~$432M, FY2023/24: ~$462M, FY2024/25: ~$491M, FY2025/26: ~$530M)
 *
 * Usage:
 *   node scripts/processAnaheim.js                    # load all PDFs
 *   node scripts/processAnaheim.js --dry-run          # parse and print, no DB writes
 *   node scripts/processAnaheim.js --pdf "docs/Anaheim/fy2025-adopted-budget.pdf"
 *   node scripts/processAnaheim.js --revenue          # load revenue
 *
 * Requires: Python 3 + pdfplumber (pre-installed, confirmed in RESEARCH.md)
 * Requires: Anaheim municipality seeded via seedAnaheimSantaAnaCA.js (Plan 01)
 *
 * Security (T-31-05): maxBuffer 8MB cap on execSync (Anaheim PDFs ~14-22MB; JSON output small)
 * Security (T-31-06): PDF path from controlled docs/Anaheim/ readdir; double-quoted
 * Security (T-31-07): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-31-03): GF band sanity check; halt on scale mismatch before any DB write
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

// ── GF band sanity (T-31-03) ──────────────────────────────────────────────────
// Anaheim General Fund adopted totals per fiscal year:
// FY2022/23: ~$432M, FY2023/24: ~$462M, FY2024/25: ~$491M, FY2025/26: ~$530M
// Band set to $350M–$550M to cover all years with margin.
const GF_BAND_MIN = 350_000_000;  // $350M floor
const GF_BAND_MAX = 550_000_000;  // $550M ceiling (FY2025/26 ~$530M)

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Anaheim/*.pdf live in the main working tree. Fall back to the
// main repo root via git rev-parse --git-common-dir when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Anaheim');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Anaheim');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-31-06): PDF path from controlled docs/Anaheim/ readdir, not user input.
// Security (T-31-05): maxBuffer 8MB cap (Anaheim PDFs ~14-22MB; JSON output is small).
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractAnaheim.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const modeArg = mode === 'revenue' ? ' --mode revenue' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${modeArg}`, {
    maxBuffer: 8 * 1024 * 1024,
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

// ── Ensure Anaheim municipality exists; return its id ────────────────────────
async function ensureMunicipality() {
  const { data: existing, error } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Anaheim')
    .eq('state', 'CA')
    .maybeSingle();

  if (error) {
    console.error(`  DB error querying municipality: ${error.message}`);
    process.exit(2);
  }
  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Anaheim, CA municipality not found — run seedAnaheimSantaAnaCA.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ────────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const label = datasetType === 'revenue' ? 'General Fund Revenue Budget'
              : 'General Fund Operating Budget';
  const src = {
    name:            `Anaheim ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `anaheim-fy${fiscalYear}-${datasetType}`,
    base_url:        'https://www.anaheim.net/271/Operating-Budget-CIP',
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `anaheim-fy${fiscalYear}-${datasetType}`)
    .eq('dataset_type', datasetType)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) {
      console.error(`  ERROR updating data_source "${src.name}": ${error.message}`);
      return null;
    }
    return data;
  }
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) {
    console.error(`  ERROR inserting data_source "${src.name}": ${error.message}`);
    return null;
  }
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

    // Sanity check (T-31-03): halt before any DB write if total outside expected band
    // Revenue totals are allowed to differ from operating band — only check operating
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

  // Discover PDFs from docs/Anaheim/ (worktree-safe)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Anaheim/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Anaheim GF Budget Loader${dryRun ? ' (dry-run)' : ''} [${datasetType}]`);
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
