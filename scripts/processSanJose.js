#!/usr/bin/env node
/**
 * San Jose General Fund Budget Loader
 *
 * Extracts General Fund operating and best-effort revenue data from San Jose
 * Adopted Operating Budget PDFs using pdfplumber (Python, zero AI cost).
 * Enterprise funds (Airport, Wastewater, Water) are excluded at extraction time (D-03).
 *
 * PDF format: one PDF per fiscal year, 400+ pages, amounts in thousands of dollars.
 * The General Fund summary page contains Adopted / Est Actual / Proposed columns.
 *
 * Revenue handling (D-05): loads revenue if revenue_items.length > 0; otherwise
 * logs "revenue deferred per D-05" — does NOT fail.
 *
 * Usage:
 *   node scripts/processSanJose.js              # all PDFs in docs/SanJose/
 *   node scripts/processSanJose.js --dry-run    # parse and print, no DB writes
 *   node scripts/processSanJose.js --pdf "docs/SanJose/fy2024-25-adopted-operating-budget.pdf"
 *
 * Requires: Python 3 + pdfplumber (already installed)
 * Requires: San Jose PDFs in docs/SanJose/ (download manually from sanjoseca.gov)
 * Requires: SUPABASE_SERVICE_KEY env var (read from .env / .env.local)
 *
 * Security (T-28-04): maxBuffer 8MB cap on execSync
 * Security (T-28-05): PDF path from controlled docs/SanJose/ readdir, quoted in execSync
 * Security (T-28-06): SUPABASE_SERVICE_KEY read via loadEnv(); never logged
 * Security (T-28-08): dry-run sanity band ~$1.6B-$2.0B halts on enterprise bleed (~$5.3B)
 */

import { execSync }        from 'node:child_process';
import { createClient }    from '@supabase/supabase-js';
import { parseArgs }       from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';
import { resolve, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ── Env loading (from seedSacramentoCA.js lines 41-52) ───────────────────────
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

// ── Supabase (from processFremont.js lines 37-40) ────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Resolve PDF directory (worktree-safe, from processPortland.js) ───────────
// Checks both 'SanJose' (no space) and 'San Jose' (with space) variants.
function resolvePdfDir() {
  for (const dirName of ['SanJose', 'San Jose']) {
    const candidate = path.join(ROOT, 'docs', dirName);
    if (existsSync(candidate)) return candidate;
  }

  try {
    const gitDir = execSync('git rev-parse --git-common-dir', {
      cwd: ROOT, encoding: 'utf8'
    }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    for (const dirName of ['SanJose', 'San Jose']) {
      const mainCandidate = path.join(mainRoot, 'docs', dirName);
      if (existsSync(mainCandidate)) return mainCandidate;
    }
  } catch (_) { /* not in git */ }

  return path.join(ROOT, 'docs', 'SanJose');
}

// ── Tax revenue line item names — grouped under "Taxes" parent ───────────────
const TAX_ITEMS = new Set([
  'Property Tax', 'Sales Tax', 'Business Tax', 'Hotel/Motel Tax',
  'Hotel Tax', 'Utility Tax', 'Transfer Tax', 'Real Property Transfer Tax',
  'Transient Occupancy Tax', 'Documentary Transfer Tax', 'Measure P',
  'Local Revenue Measure', 'Telephone User Tax', 'Utility User Tax',
]);

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-28-04): maxBuffer 8MB — pdfplumber stdout stays small with early-exit
// Security (T-28-05): PDF path from controlled docs/SanJose/ readdir, quoted in cmd
function extractPDF(pdfPath) {
  const pyScript = path.join(ROOT, 'scripts', 'extractSanJose.py');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}"`, {
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return JSON.parse(raw);
}

// San Jose PDF amounts are in FULL DOLLARS (confirmed from FY2024-25 inspection).
// City Attorney = $19,031,941 full dollars; total GF uses = $2.13B full dollars.
const AMOUNTS_IN_THOUSANDS = false;

function toFullDollars(thousands) {
  return AMOUNTS_IN_THOUSANDS ? Math.round(thousands * 1000) : thousands;
}

// ── Build tree for operating (expenditure) data ───────────────────────────────
// (from processFremont.js lines 64-82, adapted for San Jose)
function buildOperatingTree(expenditureItems, approvedIdx, actualIdx) {
  const nodes = [];
  let total = 0;

  for (const item of expenditureItems) {
    const approved = toFullDollars(item.amounts[approvedIdx]);
    const actual   = actualIdx !== null ? toFullDollars(item.amounts[actualIdx]) : null;

    nodes.push({
      n: item.name,
      a: approved,
      // ⚠ a -> actual_amount, aa -> approved_amount. The NODE `a` above is the rollup.
      i: [{ d: item.name, a: actual, aa: approved, f: 'General Fund', e: null }],
    });
    total += approved;
  }

  nodes.sort((a, b) => b.a - a.a);
  return { tree: nodes, total };
}

// ── Build tree for revenue data (taxes grouped under one parent) ──────────────
// (from processFremont.js lines 85-115)
function buildRevenueTree(revenueItems, approvedIdx, actualIdx) {
  const taxItems    = [];
  let   taxTotal    = 0;
  const nonTaxItems = [];
  let   nonTaxTotal = 0;

  for (const item of revenueItems) {
    const approved = toFullDollars(item.amounts[approvedIdx]);
    const actual   = actualIdx !== null ? toFullDollars(item.amounts[actualIdx]) : null;
    // ⚠ a -> actual_amount, aa -> approved_amount.
    const lineItem = { d: item.name, a: actual, aa: approved, f: 'General Fund', e: null };

    if (TAX_ITEMS.has(item.name)) {
      taxItems.push(lineItem);
      taxTotal += approved;
    } else {
      nonTaxItems.push(lineItem);
      nonTaxTotal += approved;
    }
  }

  const tree = [];
  if (taxItems.length) tree.push({ n: 'Taxes', a: taxTotal, i: taxItems });
  if (nonTaxItems.length) tree.push({ n: 'Non-Tax Revenue', a: nonTaxTotal, i: nonTaxItems });

  return { tree, total: taxTotal + nonTaxTotal };
}

// ── Ensure San Jose municipality exists; return its id ───────────────────────
async function ensureMunicipality() {
  const { data: existing, error } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'San Jose')
    .eq('state', 'CA')
    .maybeSingle();

  if (error) {
    console.error('  Error looking up San Jose municipality:', error.message);
    process.exit(2);
  }

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  ERROR: San Jose municipality row not found — run seedOaklandSanJoseCA.js first');
  process.exit(2);
}

// ── Upsert a data_source record for one (FY, dataset_type) ───────────────────
// (from processFremont.js lines 152-180)
async function upsertDataSource(muniId, fiscalYear, datasetType, pdfAbsPath) {
  const src = {
    name:            `San Jose General Fund ${datasetType === 'operating' ? 'Operating' : 'Revenue'} Budget FY${fiscalYear}`,
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

// ── Load one (fiscal year, dataset type) via RPC ─────────────────────────────
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

// ── Per-FY sanity check (T-28-08) ────────────────────────────────────────────
// General Fund target: ~$1.7–1.9B (NOT ~$5.3B all-funds)
// If total is near $5B → enterprise bleed (filter failed) → HALT before live load
// If total is near $1.7M → thousands not converted → HALT
function sanityCheckTotal(fy, total) {
  const LOW_THOUSANDS = 1_600_000;    // $1.6M — amounts-in-thousands not converted
  const LOW_NORMAL    = 1_600_000_000; // $1.6B — lower bound of GF range
  const HIGH_NORMAL   = 2_000_000_000; // $2.0B — upper bound of GF range
  const ENTERPRISE_BLEED = 3_000_000_000; // $3B+ — enterprise funds leaking in

  if (total < LOW_THOUSANDS) {
    console.error(`\n  HALT (FY${fy}): operating total $${total.toLocaleString()} is suspiciously low.`);
    console.error(`  Expected ~$1.7B-$1.9B for San Jose General Fund.`);
    console.error(`  Do not live-load — investigate extractor output.`);
    return false;
  }
  if (total < LOW_NORMAL) {
    // Might be amounts-in-thousands not converted (raw total ~$1.7M instead of $1.7B)
    if (AMOUNTS_IN_THOUSANDS && total < 2_000_000) {
      console.error(`\n  HALT (FY${fy}): total $${total.toLocaleString()} suggests amounts-in-thousands`);
      console.error(`  conversion is NOT being applied, or AMOUNTS_IN_THOUSANDS flag is wrong.`);
      console.error(`  Set AMOUNTS_IN_THOUSANDS = false if PDF uses full dollar amounts.`);
      return false;
    }
    console.warn(`  WARNING (FY${fy}): total $${total.toLocaleString()} is below $1.6B expected range.`);
    return true; // warn but allow — may be a smaller year
  }
  if (total > ENTERPRISE_BLEED) {
    console.error(`\n  HALT (FY${fy}): operating total $${total.toLocaleString()} looks like all-funds`);
    console.error(`  Enterprise bleed detected — enterprise-fund filter may have failed (D-03).`);
    console.error(`  San Jose General Fund should be ~$1.7-1.9B, NOT ~$5.3B.`);
    console.error(`  Do not live-load — fix extractSanJose.py EXCLUDED_FUNDS before proceeding.`);
    return false;
  }
  if (total > HIGH_NORMAL) {
    console.warn(`  WARNING (FY${fy}): total $${total.toLocaleString()} slightly above $2.0B expected range.`);
    console.warn(`  This may be OK for a higher-spending year — verify before live-loading.`);
  }
  return true;
}

// ── Process one PDF ───────────────────────────────────────────────────────────
async function processPDF(pdfAbsPath, muniId, dryRun) {
  console.log(`\n  PDF: ${path.basename(pdfAbsPath)}`);

  let pages;
  try {
    pages = extractPDF(pdfAbsPath);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  if (!pages.length) {
    console.warn('  No General Fund Summary table found — skipping');
    return;
  }

  for (const page of pages) {
    const { col_types: colTypes, fiscal_years: fiscalYears, revenue_items, expenditure_items } = page;
    console.log(`  Page ${page.page_num}: columns [${colTypes.join(', ')}] → FY [${fiscalYears.join(', ')}]`);

    // ── Group columns by fiscal year ──────────────────────────────────────────
    // Rules (from processFremont.js lines 240-253):
    //   adopted/proposed → approvedIdx (first one wins per FY)
    //   actual           → actualIdx
    //   revised          → ignored
    const fyMap = new Map(); // fy → { approvedIdx, actualIdx }
    for (let i = 0; i < colTypes.length; i++) {
      const fy = fiscalYears[i];
      if (!fyMap.has(fy)) fyMap.set(fy, { approvedIdx: null, actualIdx: null });
      const entry = fyMap.get(fy);
      if ((colTypes[i] === 'adopted' || colTypes[i] === 'proposed') && entry.approvedIdx === null) {
        entry.approvedIdx = i;
      } else if (colTypes[i] === 'actual') {
        entry.actualIdx = i;
      }
      // 'revised' intentionally skipped
    }

    for (const [fy, { approvedIdx, actualIdx }] of fyMap) {
      if (approvedIdx === null) continue;

      // ── Operating ────────────────────────────────────────────────────────────
      const { tree: opTree, total: opTotal } = buildOperatingTree(expenditure_items, approvedIdx, actualIdx);

      console.log(`\n  FY${fy} Operating — $${opTotal.toLocaleString()} total`);
      for (const n of opTree.slice(0, 6)) {
        console.log(`    ${n.n}: $${Math.abs(n.a).toLocaleString()}${n.a < 0 ? ' (savings offset)' : ''}`);
      }
      if (opTree.length > 6) console.log(`    … +${opTree.length - 6} more`);

      // Sanity check (T-28-08): halt if total is outside expected GF range
      const sanityOk = sanityCheckTotal(fy, opTotal);
      if (!sanityOk) {
        console.error('\n  Halting — fix the issue above before live-loading.');
        process.exit(1);
      }

      if (dryRun) {
        console.log(`  [dry-run] FY${fy} operating: row_count=${expenditure_items.length} total=$${opTotal.toLocaleString()}`);
      } else if (muniId) {
        await loadFiscalYear(muniId, pdfAbsPath, fy, 'operating', opTree, opTotal, expenditure_items.length);
      }

      // ── Revenue (best-effort per D-05) ───────────────────────────────────────
      if (revenue_items.length > 0) {
        const { tree: revTree, total: revTotal } = buildRevenueTree(revenue_items, approvedIdx, actualIdx);

        console.log(`\n  FY${fy} Revenue — $${revTotal.toLocaleString()} total`);
        for (const group of revTree) {
          console.log(`    ${group.n}: $${group.a.toLocaleString()} (${group.i.length} items)`);
          for (const li of group.i) {
            console.log(`      ${li.d}: $${li.a.toLocaleString()}`);
          }
        }

        if (dryRun) {
          console.log(`  [dry-run] FY${fy} revenue: row_count=${revenue_items.length} total=$${revTotal.toLocaleString()}`);
        } else if (muniId) {
          await loadFiscalYear(muniId, pdfAbsPath, fy, 'revenue', revTree, revTotal, revenue_items.length);
        }
      } else {
        // D-05: no revenue items found — defer rather than fail
        console.log(`  FY${fy} Revenue — no revenue items found in this page (revenue deferred per D-05)`);
      }
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
  const pdfDir = resolvePdfDir();
  let pdfPaths;

  if (opts.pdf) {
    pdfPaths = [path.resolve(ROOT, opts.pdf)];
  } else {
    let files;
    try {
      files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    } catch (e) {
      console.error(`No PDFs directory found at ${pdfDir}`);
      console.error('Download San Jose Adopted Operating Budget PDFs from sanjoseca.gov into docs/SanJose/');
      console.error('Expected filenames: fy2022-23-adopted-operating-budget.pdf through fy2025-26-adopted-operating-budget.pdf');
      process.exit(1);
    }
    if (!files.length) {
      console.error(`No PDFs found in ${pdfDir}`);
      console.error('Download San Jose Adopted Operating Budget PDFs from sanjoseca.gov into docs/SanJose/');
      process.exit(1);
    }
    files.sort();
    pdfPaths = files.map(f => path.join(pdfDir, f));
  }

  console.log(`San Jose Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`PDFs to process: ${pdfPaths.length}`);
  console.log(`PDF dir: ${pdfDir}`);

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
