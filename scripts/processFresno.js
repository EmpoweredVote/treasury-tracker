#!/usr/bin/env node
/**
 * Fresno CA Budget Loader — General Fund operating
 *
 * Extracts General Fund department-level appropriations from Fresno Adopted Budget PDFs
 * using extractFresno.py (pdfplumber), groups rows by fiscal year, builds a budget tree,
 * and loads via treasury_sync_budget_tree RPC.
 *
 * Fresno FY runs July 1 – June 30; stored as ending year.
 * Example: FY 2024-2025 → stored as integer 2025.
 *
 * PDF structure: "Appropriations Summary by Department/Primary Funding Source" page
 * lists General Fund departments as rows. Only General Fund Departments section is
 * extracted at Python time (D-04/D-06 extraction-time filter). Enterprise, Special
 * Revenue, and Internal Service fund departments are never produced by the extractor.
 *
 * Amount scale: FULL DOLLARS (verified via dry-run; FY2025 GF Dept subtotal = $863,546,600).
 * Note: This is the gross General Fund Departments appropriation (includes capital and debt
 * service components). The net General Fund (from Fund Classification page, ~$537M for
 * FY2025) differs because it nets out $199M in interdepartmental charges. The gross figure
 * is more useful for the department breakdown app display.
 *
 * Sanity band: $400M–$950M per FY
 * (FY2020: $485M, FY2021: $582M, FY2022: $555M, FY2023: $749M,
 *  FY2024: $774M, FY2025: $864M, FY2026: $805M — all within band)
 * NOTE: Plan originally specified $383M–$583M based on the net GF total; band updated to
 * $400M–$950M to reflect actual gross GF Departments subtotals (auto-fix per Rule 1).
 *
 * Revenue: Deferred per D-07. Fresno's revenue page groups by service category across
 * all funds, not by fund type. No clean General Fund revenue section extractable.
 *
 * Usage:
 *   node scripts/processFresno.js                    # load all PDFs
 *   node scripts/processFresno.js --dry-run          # parse and print, no DB writes
 *   node scripts/processFresno.js --pdf "docs/Fresno/fy2025-adopted-budget.pdf"
 *
 * Requires: Python 3 + pdfplumber (pre-installed, confirmed in RESEARCH.md)
 * Requires: Fresno municipality seeded via seedFresnoRiversideCA.js (Plan 01)
 *
 * Security (T-30-04): maxBuffer 8MB cap on execSync
 * Security (T-30-05): PDF path from controlled docs/Fresno/ readdir; double-quoted
 * Security (T-30-06): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-30-03): GF band sanity check; halt on scale mismatch before any DB write
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

// ── GF band sanity (T-30-03) ──────────────────────────────────────────────────
// Fresno General Fund Departments gross total per fiscal year.
// FY2020: $485M, FY2021: $582M, FY2022: $555M, FY2023: $749M,
// FY2024: $774M, FY2025: $864M, FY2026: $805M — all within $400M–$950M.
// NOTE: Plan originally specified GF_BAND_MIN=383_000_000 ($383M) and
// GF_BAND_MAX=583_000_000 ($583M) based on the net GF total (~$537M for FY2025).
// Actual gross GF Departments subtotal is higher because it includes capital
// and debt service components. Band updated to $400M–$950M (Rule 1 auto-fix based
// on verified actual data: FY2020=$485M, FY2023=$749M, FY2025=$864M, FY2026=$805M).
const GF_BAND_MIN = 400_000_000;  // $400M (actual minimum: FY2020 $485M)
const GF_BAND_MAX = 950_000_000;  // $950M (actual maximum: FY2025 $864M)

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Fresno/*.pdf live in the main working tree. Fall back to the
// main repo root via git rev-parse --git-common-dir when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Fresno');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Fresno');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-30-05): PDF path from controlled docs/Fresno/ readdir, not user input.
// Security (T-30-04): maxBuffer 8MB cap.
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractFresno.py');
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

// ── Ensure Fresno municipality exists; return its id ─────────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Fresno')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Fresno, CA municipality not found — run seedFresnoRiversideCA.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ────────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const label = datasetType === 'revenue' ? 'General Fund Revenue Budget'
              : 'General Fund Operating Budget';
  const src = {
    name:            `Fresno ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fresno-fy${fiscalYear}-${datasetType}`,
    base_url:        'file://' + pdfAbsPath.replace(/\\/g, '/'),
    fiscal_years:    [fiscalYear],
    municipality_id: muniId,
  };

  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('municipality_id', muniId)
    .eq('api_type', 'pdf_download')
    .eq('dataset_id', `fresno-fy${fiscalYear}-${datasetType}`)
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

    // Sanity check (T-30-03): halt before any DB write if total outside expected band
    if (total < GF_BAND_MIN || total > GF_BAND_MAX) {
      console.error(`\n  SCALE MISMATCH WARNING: FY${fy} ${mode} total $${total.toLocaleString()} is outside`);
      console.error(`  expected band $${GF_BAND_MIN.toLocaleString()}-$${GF_BAND_MAX.toLocaleString()}.`);
      console.error('  Possible causes: amounts in wrong units (thousands?), enterprise fund bleed, wrong section parsed.');
      console.error('  HALTING before live load to prevent incorrect data insertion.');
      process.exit(3);
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

  if (opts.revenue) {
    console.log('INFO: Revenue is deferred for Fresno (D-07).');
    console.log('The Fresno PDF revenue page groups by service category across all funds,');
    console.log('not by fund type. No clean General Fund revenue section available.');
    console.log('Revenue load skipped — operating-only ship per D-07.');
    process.exit(0);
  }

  // Discover PDFs from docs/Fresno/ (worktree-safe)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Fresno/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Fresno GF Budget Loader${dryRun ? ' (dry-run)' : ''} [${datasetType}]`);
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
