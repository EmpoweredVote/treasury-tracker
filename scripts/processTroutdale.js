#!/usr/bin/env node
/**
 * Troutdale OR Budget Loader — operating, revenue, and requirements modes
 *
 * Extracts department-level (operating), category-level (revenue), or
 * all-funds expenditure category (requirements) budget data from Troutdale
 * adopted budget PDFs and loads them via the treasury_sync_budget_tree RPC.
 *
 * Usage:
 *   node scripts/processTroutdale.js --dry-run                # parse and print, no DB writes
 *   node scripts/processTroutdale.js                          # live load all PDFs (operating)
 *   node scripts/processTroutdale.js --revenue --dry-run      # revenue dry-run
 *   node scripts/processTroutdale.js --revenue                # live load revenue
 *   node scripts/processTroutdale.js --requirements --dry-run # all-funds requirements dry-run
 *   node scripts/processTroutdale.js --requirements           # live load all-funds requirements
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
  // ENVIRONMENT NOTE: on Windows `python` resolves to the non-functional
  // Microsoft Store app-execution-alias stub (exit 9009), so this loader could
  // not run at all. `py -3` is the working launcher -- same workaround as
  // processTucson.js / processBend.js.
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin ? ['-3', pyScript, pdfPath] : [pyScript, pdfPath];
  if (mode === 'revenue') args.push('--mode', 'revenue');
  if (mode === 'requirements') args.push('--mode', 'requirements');
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
  const { data: existing, error: selectErr } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('name', 'Troutdale')
    .eq('state', 'OR')
    .maybeSingle();

  if (selectErr) {
    console.error('  ERROR querying municipalities:', selectErr.message);
    process.exit(2);
  }

  if (existing?.id) {
    console.log(`  Municipality: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  console.error('  Troutdale, OR municipality not found — run seedTroutdaleOregon.js first');
  process.exit(2);
}

// ── Upsert a per-fiscal-year data_source record ───────────────────────────────
async function upsertDataSource(muniId, fiscalYear, datasetType) {
  const label = datasetType === 'revenue'                ? 'Revenue Budget'
              : datasetType === 'all_funds_requirements' ? 'All Funds Requirements'
              : 'Operating Budget';
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
// Abort an overwrite that would materially change an existing total.
//
// WHY: extractGresham.py currently drops the LEADING DIGIT of every 8-digit
// amount in Gresham's FY2023 PDF (e.g. Police $45,708,476 -> $5,708,476),
// understating that year's operating total by exactly $210,000,000. The figures
// already in the database are the correct ones. Nothing surfaced this, because
// the loaders happily overwrite a good row with a bad one and report success.
//
// These loaders had also been unrunnable on Windows for some time (they invoked
// the Microsoft Store `python` stub), so the regression sat dormant. Now that
// they run again, an unguarded re-run would silently corrupt good data.
//
// Any drift beyond TOTAL_DRIFT_TOLERANCE aborts that fiscal year unless
// --allow-total-change is passed. Legitimate restatements do happen; they should
// be an explicit decision, not a side effect.
const TOTAL_DRIFT_TOLERANCE = 0.001; // 0.1%
const ALLOW_TOTAL_CHANGE = process.argv.includes('--allow-total-change');

async function assertNoSilentTotalChange(muniId, fiscalYear, datasetType, newTotal) {
  const { data: existing, error } = await supabase.schema('treasury').from('budgets')
    .select('total_budget').eq('municipality_id', muniId).eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType).maybeSingle();
  if (error || !existing) return true;               // nothing to protect
  const prev = Number(existing.total_budget);
  if (!prev) return true;
  const drift = Math.abs(newTotal - prev) / prev;
  if (drift <= TOTAL_DRIFT_TOLERANCE) return true;
  const pct = (drift * 100).toFixed(2);
  if (ALLOW_TOTAL_CHANGE) {
    console.warn(`    WARNING: FY${fiscalYear} ${datasetType} total changes ` +
      `$${prev.toLocaleString()} -> $${newTotal.toLocaleString()} (${pct}%) ` +
      `-- proceeding because --allow-total-change was passed`);
    return true;
  }
  console.error(`    ABORT FY${fiscalYear} ${datasetType}: extracted total ` +
    `$${newTotal.toLocaleString()} differs from the stored ` +
    `$${prev.toLocaleString()} by ${pct}%.`);
  console.error(`           Refusing to overwrite. Investigate the extractor first; ` +
    `re-run with --allow-total-change only if the new figure is genuinely correct.`);
  return false;
}

async function loadFiscalYear(muniId, fiscalYear, datasetType, tree, total, rowCount) {
  if (!(await assertNoSilentTotalChange(muniId, fiscalYear, datasetType, total))) return false;
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

  // ── Durable provenance stamp ────────────────────────────────────────────────
  // This loader pinned its per-FY source URLs in PDF_URLS but historically never
  // persisted them, leaving every row it wrote with source_url IS NULL --
  // 51 Oregon rows across this loader and its two siblings, repaired by
  // scripts/backfillOregonBudgetProvenance.mjs. Stamp on the way out so the gap
  // cannot reopen. source_date is the FISCAL-YEAR END (the period the row
  // describes), never an invented publication or adoption date.
  const stampUrl = PDF_URLS[fiscalYear];
  if (!stampUrl) {
    console.error(`    WARNING: no PDF_URLS entry for FY${fiscalYear} -- row left unsourced`);
  } else {
    const { data: bud, error: budErr } = await supabase.schema('treasury').from('budgets')
      .select('id').eq('municipality_id', muniId).eq('fiscal_year', fiscalYear)
      .eq('dataset_type', datasetType).maybeSingle();
    if (budErr || !bud?.id) {
      console.error('    Could not find budget row to stamp source:', budErr?.message ?? '(no row)');
    } else {
      const { error: stampErr } = await supabase.schema('treasury').from('budgets')
        .update({ source_url: stampUrl, source_date: `${fiscalYear}-06-30` })
        .eq('id', bud.id);
      if (stampErr) console.error('    Source stamp failed:', stampErr.message);
      else console.log(`    Stamped source_url + source_date=${fiscalYear}-06-30`);
    }
  }
  return true;
}

// ── Process one PDF ───────────────────────────────────────────────────────────
async function processPDF(pdfAbsPath, muniId, dryRun, mode = 'operating') {
  const filename = path.basename(pdfAbsPath);
  console.log(`\n  PDF: ${filename}`);

  const isRevenue      = mode === 'revenue';
  const isRequirements = mode === 'requirements';
  const unitLabel   = isRevenue || isRequirements ? 'categories' : 'departments';
  const typeLabel   = isRevenue ? 'Revenue' : isRequirements ? 'All Funds Requirements' : 'Operating';
  const datasetType = mode === 'requirements' ? 'all_funds_requirements'
                    : mode === 'revenue'      ? 'revenue'
                    : 'operating';

  let rows;
  try {
    rows = extractPDF(pdfAbsPath, mode);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  if (!rows.length) {
    console.warn(`  No ${isRevenue || isRequirements ? 'category' : 'department'} rows extracted — skipping`);
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

    const { tree, total } = (isRevenue || isRequirements) ? buildRevenueTree(fyRows) : buildOperatingTree(fyRows);
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
      'dry-run':    { type: 'boolean', default: false },
      revenue:      { type: 'boolean', default: false },
      requirements: { type: 'boolean', default: false },
      pdf:          { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  const mode   = opts.requirements ? 'requirements'
               : opts.revenue      ? 'revenue'
               : 'operating';

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
