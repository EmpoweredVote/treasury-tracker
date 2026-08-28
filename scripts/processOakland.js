#!/usr/bin/env node
/**
 * Oakland CA Budget Loader — General Purpose Fund (GPF) operating budget
 *
 * Extracts department-level GPF expenditure data from Oakland biennial Adopted
 * Policy Budget PDFs using extractOakland.py (pdfplumber), groups rows by
 * fiscal year, builds a budget tree, and loads via treasury_sync_budget_tree RPC.
 *
 * Oakland amount scale: PDFs express amounts in FULL DOLLARS (not thousands).
 * No toFullDollars() conversion required.
 *
 * Biennial PDF coverage:
 *   fy2023-25-adopted-budget.pdf → FY2024 + FY2025
 *   fy2024-25-midcycle-adopted-budget.pdf → FY2025 (midcycle amendment)
 *
 * Data source: "Oakland General Purpose Fund Operating Budget" (created by seeder
 * in Plan 01, looked up via scripts/lib/listAllSources.mjs).
 *
 * Usage:
 *   node scripts/processOakland.js                    # load all PDFs
 *   node scripts/processOakland.js --dry-run          # parse and print, no DB writes
 *   node scripts/processOakland.js --pdf "docs/Oakland/fy2023-25-adopted-budget.pdf"
 *
 * Requires: Python 3 + pdfplumber (pre-installed, confirmed in RESEARCH.md)
 * Requires: Oakland municipality seeded via seedOaklandSanJoseCA.js (Plan 01)
 *
 * Security (T-28-04): maxBuffer 8MB cap on execSync (large biennial PDFs)
 * Security (T-28-05): PDF path from controlled docs/Oakland/ readdir; double-quoted
 * Security (T-28-06): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-28-07): GPF band sanity check ~$700M-$900M; halt on scale mismatch
 */

import { execSync }              from 'node:child_process';
import { createClient }          from '@supabase/supabase-js';
import { parseArgs }             from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                      from 'node:path';
import { fileURLToPath }         from 'node:url';
import { resolve, dirname }      from 'node:path';

import { listAllSourcesResult } from './lib/listAllSources.mjs';
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

// ── GPF band sanity (T-28-07) ─────────────────────────────────────────────────
// Oakland General Purpose Fund: ~$700M-$900M per fiscal year.
// If total falls outside this band, halt with a scale-mismatch warning.
const GPF_BAND_MIN = 700_000_000;   // $700M
const GPF_BAND_MAX = 900_000_000;   // $900M

// ── Resolve PDF directory (worktree-safe) ─────────────────────────────────────
// In a git worktree, ROOT resolves to the worktree root, but gitignored files
// like docs/Oakland/*.pdf live in the main working tree. Fall back to the
// main repo root via git rev-parse --git-common-dir when needed.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Oakland');
  if (existsSync(candidate)) return candidate;

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Oakland');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch (_) { /* not in git repo or no main worktree */ }

  return candidate;
}

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-28-05): PDF path from controlled docs/Oakland/ readdir, not user input.
// Security (T-28-04): maxBuffer 8MB cap.
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractOakland.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// ── Build operating budget tree from extracted rows ───────────────────────────
// Each department becomes a top-level node { n, a, i[] }.
// The fund field is set to 'General Purpose Fund' (D-06 invariant).
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
        f: 'General Purpose Fund',
        e: null,
      }],
    });
    total += amount;
  }

  // Sort by amount descending (largest departments first)
  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Ensure Oakland municipality exists; return its id ────────────────────────
async function ensureMunicipality() {
  const { data: existing } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Oakland')
    .eq('state', 'CA')
    .maybeSingle();

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Oakland, CA municipality not found — run seedOaklandSanJoseCA.js first');
  process.exit(2);
}

// ── Look up the canonical data_source row by name ────────────────────────────
// The seeder (Plan 01) created "Oakland General Purpose Fund Operating Budget".
// Matches by name from the paged source listing.
async function resolveDataSourceByName(name) {
  const { data: listing, error } = await listAllSourcesResult(supabase);
  if (error) {
    console.error('  ERROR listing sources:', error.message);
    return null;
  }
  const hit = (listing || []).find(r => r.name === name);
  return hit || null;
}

// ── Upsert a per-fiscal-year data_source record ────────────────────────────────
// Creates per-FY rows keyed on (municipality_id, api_type=pdf_download, dataset_id=fy{year}, dataset_type)
// This matches the processPortland.js pattern.
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfPath) {
  const label = datasetType === 'revenue' ? 'General Purpose Fund Revenue Budget'
              : 'General Purpose Fund Operating Budget';
  const src = {
    name:            `Oakland ${label} FY${fiscalYear}`,
    api_type:        'pdf_download',
    dataset_type:    datasetType,
    dataset_id:      `fy${fiscalYear}`,
    base_url:        'file://' + pdfPath.replace(/\\/g, '/'),
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
async function processPDF(pdfAbsPath, muniId, dryRun) {
  const filename = path.basename(pdfAbsPath);
  console.log(`\n  PDF: ${filename}`);

  let rows;
  try {
    rows = extractPDF(pdfAbsPath);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 300));
    return;
  }

  if (!rows.length) {
    console.warn('  No GPF rows extracted — skipping');
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

    const { tree, total } = buildOperatingTree(fyRows);
    const rowCount = tree.length;

    console.log(`\n  FY${fy} GPF Operating — $${total.toLocaleString()} total (${rowCount} departments)`);

    // Print top departments
    for (const n of tree.slice(0, 8)) {
      console.log(`    ${n.n}: $${n.a.toLocaleString()}`);
    }
    if (tree.length > 8) console.log(`    … +${tree.length - 8} more`);

    // Sanity check (T-28-07): GPF band $700M-$900M
    if (total < GPF_BAND_MIN || total > GPF_BAND_MAX) {
      console.error(`\n  SCALE MISMATCH WARNING: FY${fy} GPF total $${total.toLocaleString()} is outside`);
      console.error(`  expected band $${GPF_BAND_MIN.toLocaleString()}-$${GPF_BAND_MAX.toLocaleString()}.`);
      console.error('  Possible causes: amounts in wrong units, all-funds bleed, or wrong section parsed.');
      console.error('  HALTING before live load to prevent incorrect data insertion.');
      process.exit(3);
    }

    if (dryRun) {
      console.log(`  [dry-run] fiscal_year=${fy} row_count=${rowCount} total=$${total.toLocaleString()}`);
    } else if (muniId) {
      await loadFiscalYear(muniId, pdfAbsPath, fy, 'operating', tree, total, rowCount);
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

  // Discover PDFs from docs/Oakland/ (worktree-safe)
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    const files = readdirSync(pdfDir)
      .filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      console.error('No PDFs found in docs/Oakland/');
      process.exit(1);
    }
    files.sort();  // Process alphabetically: biennial before midcycle
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`Oakland GPF Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`PDFs to process: ${pdfPaths.length}`);
  for (const p of pdfPaths) console.log(`  - ${path.basename(p)}`);

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
