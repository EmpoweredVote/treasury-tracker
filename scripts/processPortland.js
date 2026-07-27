#!/usr/bin/env node
/**
 * Portland OR Budget Loader — operating (Vol 1), revenue (Vol 2), requirements (Vol 1)
 *
 * Operating mode (default): extracts bureau-level appropriation data from Vol 1
 * PDFs. Revenue mode (--revenue): extracts fund-level Resources Total from Vol 2.
 * Requirements mode (--requirements): extracts All Funds Requirements categories
 * from Vol 1 PDFs (same files as operating — D-07 confirmed Vol 1 location).
 *
 * Usage:
 *   node scripts/processPortland.js                    # operating, all vol1 PDFs
 *   node scripts/processPortland.js --revenue          # revenue, all vol2 PDFs
 *   node scripts/processPortland.js --requirements     # requirements, all vol1 PDFs
 *   node scripts/processPortland.js --dry-run          # parse and print, no DB writes
 *   node scripts/processPortland.js --pdf "docs/Portland/fy2025-26-vol1.pdf"
 *
 * Requires: Python 3 + pdfplumber  (pip install pdfplumber)
 * Requires: Portland municipality seeded via seedPortlandOregon.js
 *
 * Security (T-17-03, T-23-02): PDF path comes from controlled docs/Portland/ readdir,
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
// WR-04: No hardcoded SUPABASE_URL fallback — fail closed if env unset
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL'); process.exit(2); }
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── PDF URLs by mode and fiscal year ──────────────────────────────────────────
// URLs confirmed working 2026-05-31 (RESEARCH Pitfall 2: Portland CMS URLs unstable)
// requirements uses Vol 1 URLs (same as operating) — D-07 confirmed Vol 1 location.
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
  // requirements uses same Vol 1 files as operating (D-07 verified: All Funds page is in Vol 1)
  requirements: {
    2026: 'https://www.portland.gov/budget/documents/fy-2025-26-city-portland-adopted-budget-vol-1-city-summaries-and-bureau-budgets/download',
    2025: 'https://www.portland.gov/budget/2024-2025-budget/documents/fy-2024-25-volume-1-city-portland-city-summaries-and-bureau/download',
    2024: 'https://www.portland.gov/budget/2023-2024-budget/documents/fy-2023-24-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
    2023: 'https://www.portland.gov/budget/2022-2023-budget/documents/fy-2022-23-adopted-budget-volume-1-citywide-summaries-and-bureau/download',
    2022: 'https://www.portland.gov/budget/2021-2022-budget/documents/fy-2021-22-adopted-budget-volume-i-citywide-summaries-and-bureau/download',
  },
};

// ── Run Python extractor, return parsed JSON ──────────────────────────────────
// Security (T-23-02): --mode argument is a controlled string value from this
// script's parseArgs, not user input — no injection risk.
function extractPDF(pdfPath, mode = 'operating') {
  const pyScript = path.join(ROOT, 'scripts', 'extractPortland.py');
  // ENVIRONMENT NOTE: on Windows `python` resolves to the non-functional
  // Microsoft Store app-execution-alias stub (exit 9009), so this loader could
  // not run at all. `py -3` is the working launcher -- same workaround as
  // processTucson.js / processBend.js.
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py -3' : 'python3';
  const raw = execSync(`${pythonBin} "${pyScript}" "${pdfPath}" --mode "${mode}"`, {
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

// ── Build category tree from extracted revenue/requirements rows ─────────────
// Used for both 'revenue' (fund rows with resources_total) and 'requirements'
// (category rows with adopted_amount). Each row becomes a top-level node.
function buildCategoryTree(rows) {
  const nodes = rows
    .filter(r => (r.adopted_amount ?? r.resources_total ?? 0) > 0)
    .map(r => {
      const amount = r.adopted_amount ?? r.resources_total ?? 0;
      const label  = r.category ?? r.fund ?? 'Unknown';
      return {
        n: label,
        a: amount,
        i: [{ d: label, a: amount, aa: null, f: null, e: null }],
      };
    });
  nodes.sort((a, b) => b.a - a.a);
  const total = nodes.reduce((s, n) => s + n.a, 0);
  return { tree: nodes, total };
}

// ── Build 3-level operating budget tree from extracted rows ───────────────────
// Tree shape: service_area (depth-0) → bureau (depth-1) → line item (depth-2)
// Bureaus with no service_area (empty string) are NOT merged into a shared
// bucket — each becomes a standalone depth-0 leaf with a [D-06] warning.
// This matches processCA.js CR-01 collapse-and-log pattern.
function buildOperatingTree(rows) {
  // Group by service_area → bureau
  const saMap = new Map(); // saKey → { displayName, bureaus: Map(bureau → amount) }

  for (const row of rows) {
    const sa = row.service_area || '';  // '' means no service area mapping
    const bureau = row.bureau;
    const amount = row.adopted_amount;

    if (!sa) {
      // D-06: bureau with no service area — log and collapse to standalone depth-0 leaf
      console.warn(`  [D-06] Bureau with no service_area: "${bureau}" ($${amount.toLocaleString()}) — emitted as standalone depth-0 leaf`);
    }

    // Unique key prevents merging unmapped bureaus with each other
    const saKey = sa || `__no_sa__${bureau}`;
    if (!saMap.has(saKey)) saMap.set(saKey, { displayName: sa || bureau, bureaus: new Map() });
    const saEntry = saMap.get(saKey);
    saEntry.bureaus.set(bureau, (saEntry.bureaus.get(bureau) || 0) + amount);
  }

  const nodes = [];
  let total = 0;

  for (const [saKey, saEntry] of saMap) {
    const isUnmapped = saKey.startsWith('__no_sa__');
    let saTotal = 0;
    const bureauNodes = [];

    for (const [bureau, amt] of saEntry.bureaus) {
      bureauNodes.push({
        n: bureau,
        a: amt,
        i: [{ d: bureau, a: amt, aa: null, f: null, e: null }],
      });
      saTotal += amt;
    }
    bureauNodes.sort((a, b) => b.a - a.a);

    if (isUnmapped) {
      // D-06: standalone depth-0 leaf (single bureau, no SA grouping)
      nodes.push({ n: saEntry.displayName, a: saTotal, i: bureauNodes[0]?.i || [] });
    } else {
      // Normal: service area node with bureau children
      nodes.push({ n: saEntry.displayName, a: saTotal, c: bureauNodes });
    }
    total += saTotal;
  }

  // Sort by amount descending (largest service areas first)
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

  const label = datasetType === 'all_funds_requirements' ? 'All Funds Requirements'
              : datasetType === 'revenue'                ? 'Revenue Budget'
              : 'Operating Budget';
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
    const { data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select().single();
    if (error) { console.error('    data_source update error:', error.message); return null; }
    return data;
  }
  const { data, error } = await supabase.schema('treasury').from('data_sources')
    .insert(src).select().single();
  if (error) { console.error('    data_source insert error:', error.message); return null; }
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
  // Portland pins a different volume per dataset_type: Vol 1 backs operating and
  // all_funds_requirements, Vol 2 backs revenue.
  const stampUrl = PDF_URLS[
    datasetType === 'all_funds_requirements' ? 'requirements'
      : datasetType === 'revenue' ? 'revenue' : 'operating'
  ]?.[fiscalYear];
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

  let rows;
  try {
    rows = extractPDF(pdfAbsPath, mode);
  } catch (e) {
    console.error('  Extract failed:', e.message.slice(0, 200));
    return;
  }

  const isRevenue      = mode === 'revenue';
  const isRequirements = mode === 'requirements';
  const datasetType    = isRequirements ? 'all_funds_requirements'
                       : isRevenue      ? 'revenue'
                       : 'operating';
  const unitLabel      = isRevenue || isRequirements ? 'categories' : 'bureaus';
  const typeLabel      = isRevenue      ? 'Revenue'
                       : isRequirements ? 'All Funds Requirements'
                       : 'Operating';

  if (!rows.length) {
    console.warn(`  No ${unitLabel} rows extracted — skipping`);
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

    // Build tree: revenue and requirements use category-shaped builder;
    // operating uses bureau-shaped builder.
    // SANITY_MAX only applies to operating mode — requirements totals (~billions)
    // legitimately exceed any operating-mode cap (established pattern from Phase 21).
    const { tree, total } = (isRevenue || isRequirements)
      ? buildCategoryTree(fyRows)
      : buildOperatingTree(fyRows);
    const rowCount = tree.length;

    // For operating mode, print service area + bureau breakdown
    if (!isRevenue && !isRequirements) {
      const saCount = tree.filter(n => n.c).length;
      const bureauCount = tree.reduce((s, n) => s + (n.c ? n.c.length : 1), 0);
      console.log(`\n  FY${fy} ${typeLabel} — $${total.toLocaleString()} total (${saCount} service areas, ${bureauCount} bureaus)`);
    } else {
      console.log(`\n  FY${fy} ${typeLabel} — $${total.toLocaleString()} total (${rowCount} ${unitLabel})`);
    }
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
      'dry-run':     { type: 'boolean', default: false },
      revenue:       { type: 'boolean', default: false },
      requirements:  { type: 'boolean', default: false },
      pdf:           { type: 'string' },
    },
    strict: false,
  });

  const dryRun = opts['dry-run'];
  // Mode priority: requirements > revenue > operating
  const mode = opts.requirements ? 'requirements'
             : opts.revenue      ? 'revenue'
             : 'operating';
  // requirements uses vol1 (same as operating) — D-07: All Funds page is in Vol 1, not Vol 2
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
