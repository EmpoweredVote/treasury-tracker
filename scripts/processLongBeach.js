#!/usr/bin/env node
/**
 * Long Beach CA Budget Loader — General Fund operating + revenue
 *
 * Extracts General Fund expenditure and revenue category data from Long Beach
 * General Fund Summary PDFs using extractLongBeach.py (pdfplumber), groups rows
 * by fiscal year, builds a budget tree, and loads via treasury_sync_budget_tree RPC.
 *
 * Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01).
 * Example: FY 2024-25 → stored as integer 2025.
 *
 * PDF structure: fund-summary-gp PDFs contain the General Fund Group Summary page
 * with expenditure categories (Salaries, Materials, etc.) and revenue categories
 * (Property Taxes, Sales Tax, etc.). NOT a department-level breakdown.
 *
 * Amount scale: FULL DOLLARS (verified via dry-run; FY25 = ~$755M operating).
 *
 * Sanity band: $550M–$850M per FY (actual range FY22–FY26: $634M–$773M).
 * Original plan assumed $1.3B–$1.7B; actual fund summary PDFs show ~$600M–$800M
 * (the $1.5B figure in research was for all-funds, not General Fund alone).
 *
 * Port of Long Beach is excluded automatically — Port data lives in Enterprise/
 * Tidelands fund summary (fund-summary-ef), NOT in fund-summary-gp.
 *
 * Usage:
 *   node scripts/processLongBeach.js                    # load all PDFs
 *   node scripts/processLongBeach.js --dry-run          # parse and print, no DB writes
 *   node scripts/processLongBeach.js --revenue          # load revenue instead of operating
 *   node scripts/processLongBeach.js --pdf "docs/Long Beach/fy25-fund-summary-gp.pdf"
 *
 * Requires: Python 3 + pdfplumber (pre-installed, confirmed in RESEARCH.md)
 * Requires: Long Beach municipality seeded via seedLongBeachBakersfieldCA.js (Plan 01)
 *
 * Security (T-29-04): maxBuffer 8MB cap on execSync
 * Security (T-29-05): PDF path from controlled docs/Long Beach/ readdir; double-quoted
 * Security (T-29-06): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-29-07): GF band sanity check; halt on scale mismatch before any DB write
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

// ── GF band sanity (T-29-07) ──────────────────────────────────────────────────
// Long Beach General Fund: ~$550M–$850M per fiscal year (FY22–FY26 range: $634M–$773M).
// NOTE: The plan originally specified $1.3B–$1.7B based on research assumption that
// the all-funds total was the General Fund. Actual fund-summary-gp PDFs contain only
// the General Fund Group (~$600M–$800M). Band adjusted to match actual data.
// Long Beach FY runs Oct 1 – Sep 30; stored as ending year (D-01).
// Actual operating band for fund-summary-gp PDFs
const ACTUAL_BAND_MIN = 550_000_000;  // $550M
const ACTUAL_BAND_MAX = 850_000_000;  // $850M

// Revenue band: ~$550M–$800M (similar order of magnitude to expenditures)
const REV_BAND_MIN = 400_000_000;   // $400M
const REV_BAND_MAX = 850_000_000;   // $850M

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Long Beach/*.pdf live in the main working tree. Fall back to the
// main repo root via git rev-parse --git-common-dir when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Long Beach');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Long Beach');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-29-05): PDF path from controlled docs/Long Beach/ readdir, not user input.
// Security (T-29-04): maxBuffer 8MB cap.
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractLongBeach.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const modeArg = mode === 'revenue' ? ' --mode revenue' : '';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"${modeArg}`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Build operating/revenue budget tree from extracted rows ───────────────────
// Each category becomes a top-level node { n, a, i[] }.
function buildTree(rows) {
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
        f: 'General Fund',
        e: null,
      }],
    });
    total += amount;
  }

  // Sort by amount descending (largest categories first)
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Ensure Long Beach municipality exists; return its id ─────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Long Beach')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Long Beach, CA municipality not found — run seedLongBeachBakersfieldCA.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ────────────────────────────────
// Creates per-FY rows keyed on (municipality_id, api_type=pdf_download, dataset_id=fy{year}, dataset_type)
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const label = datasetType === 'revenue' ? 'General Fund Revenue Budget'
              : 'General Fund Operating Budget';
  const src = {
    name:            `Long Beach ${label} FY${fiscalYear}`,
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

    const { tree, total } = buildTree(fyRows);
    const rowCount = tree.length;

    const label = mode === 'revenue' ? 'Revenue' : 'GF Operating';
    console.log(`\n  FY${fy} ${label} — $${total.toLocaleString()} total (${rowCount} categories)`);

    // Print categories
    for (const n of tree.slice(0, 10)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (tree.length > 10) console.log(`    … +${tree.length - 10} more`);

    // Sanity check (T-29-07): actual band for fund-summary-gp PDFs
    const bandMin = mode === 'revenue' ? REV_BAND_MIN : ACTUAL_BAND_MIN;
    const bandMax = mode === 'revenue' ? REV_BAND_MAX : ACTUAL_BAND_MAX;

    if (total < bandMin || total > bandMax) {
      console.error(`\n  SCALE MISMATCH WARNING: FY${fy} ${mode} total $${total.toLocaleString()} is outside`);
      console.error(`  expected band $${bandMin.toLocaleString()}-$${bandMax.toLocaleString()}.`);
      console.error('  Possible causes: amounts in wrong units (thousands?), Port bleed, wrong section parsed.');
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

  const dryRun     = opts['dry-run'];
  const datasetType = opts.revenue ? 'revenue' : 'operating';

  // Discover PDFs from docs/Long Beach/ (worktree-safe)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Long Beach/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Long Beach GF Budget Loader${dryRun ? ' (dry-run)' : ''} [${datasetType}]`);
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
