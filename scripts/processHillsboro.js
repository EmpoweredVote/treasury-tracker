#!/usr/bin/env node
/**
 * Hillsboro, OR Budget Loader - General Fund operating (expenditure-by-function)
 * + revenue (revenue-by-source), FY2021-FY2025, ACTUAL (ACFR GAAP basis).
 *
 * Consumes `scripts/extractHillsboro.py` (a thin wrapper over lib/acfrGF.py) and
 * loads exclusively through the source-safe `treasury_sync_budget_tree` RPC --
 * never the sibling non-source-safe city-budget sync RPC (see auto-memory
 * project_sync_city_budget_not_source_safe).
 *
 * Source: City of Hillsboro Annual Comprehensive Financial Report, GAAP actuals,
 *   General Fund column of the governmental-funds Statement of Revenues,
 *   Expenditures and Changes in Fund Balance(s). Whole dollars. Every year
 *   bookend-ties the GF column at exactly $0.
 *
 * Hillsboro INVERTS the usual expenditure layout: 'Debt service' is a valued
 * LEAF at root while 'Capital outlay:' is a PARENT with its own children. The
 * conventional configuration still ties at $0 -- it just files Debt service and
 * the capital detail under Current and overstates that subtotal. Resolved from
 * `pdftotext -layout` indentation; see scripts/extractHillsboro.py.
 *
 * SOURCE DISCOVERY: hillsboro-oregon.gov returns 403 to curl for GET and HEAD
 * regardless of headers (TLS fingerprinting). PDFs were fetched through a real
 * browser via scripts/fetchViaBrowser.mjs.
 *
 * SCOPE: GF-only, consistent with the other Oregon city loads.
 *
 * Tree mapping: the extractor emits a nested {n,a,c:[...]} tree; this loader
 * maps it to the RPC's {n,a,i:[{d,a,aa,f,e}]} shape -- a root child WITH a
 * nested `.c` array contributes its children as drill-down leaves; one without
 * becomes a single-item leaf.
 *
 * Provenance: data_sources rows are EPHEMERAL (WR-05/LOAD-01); every loaded row
 *   is stamped post-sync with source_url and source_date = the fiscal-year end.
 *
 * Idempotency: per-(municipality_id, fiscal_year, dataset_type) pre-load delete
 *   before every RPC call; the RPC also upserts on the same key.
 *
 * ENVIRONMENT NOTE (this machine): `python` on PATH resolves to the
 * non-functional Microsoft Store alias stub; the working launcher is `py -3`.
 *
 * Usage:
 *   node scripts/processHillsboro.js --dry-run            # operating dry-run, all FYs
 *   node scripts/processHillsboro.js --revenue --dry-run  # revenue dry-run, all FYs
 *   node scripts/processHillsboro.js                      # LIVE operating, all FYs
 *   node scripts/processHillsboro.js --revenue            # LIVE revenue, all FYs
 *
 * Requires: `pdftotext -table` (poppler) on PATH; Hillsboro seeded via
 *   scripts/seedWashingtonCountyOregonCities.js first.
 */

import { spawnSync, execSync } from 'node:child_process';
import { createClient }        from '@supabase/supabase-js';
import { parseArgs }           from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                    from 'node:path';
import { fileURLToPath }       from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── .env loader ───────────────────────────────────────────────────────────────
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(path.join(ROOT, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent -- ignore */ }
  }
}
loadEnv();

// ── Resolve PDF directory (worktree-safe) ────────────────────────────────────
// docs/Hillsboro/*.pdf is gitignored (docs/*); a worktree can't see it -- fall back
// to the main working tree's docs/Hillsboro/ via git-common-dir.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Hillsboro');
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Hillsboro');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* not a git repo -- ignore */ }
  return candidate;
}

// ── Discover PDFs by fiscal year from a controlled readdir ───────────────────
function discoverPdfsByFY(pdfDir) {
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^hillsboro-(\d{4})-acfr\.pdf$/i);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Fixed facts ────────────────────────────────────────────────────────────────
// Contiguous FY window; all source URLs verified HTTP 200 application/pdf.
const FYS = [2021, 2022, 2023, 2024, 2025];
const POPULATION = 110337; // Census PEP vintage 2024, matches the seeder
const SANITY_MAX = 2_000_000_000;

// Durable per-FY source PDF URLs, stamped onto every loaded budgets row
// (verified 2026-07-27).
const URLS = {
  2025: 'https://www.hillsboro-oregon.gov/home/showdocument?id=32248&t=639009654787414827',
  2024: 'https://www.hillsboro-oregon.gov/home/showpublisheddocument/31331/638699517637570000',
  2023: 'https://www.hillsboro-oregon.gov/home/showpublisheddocument/30121/638372968010970000',
  2022: 'https://www.hillsboro-oregon.gov/home/showpublisheddocument/29088/638060879017770000',
  2021: 'https://www.hillsboro-oregon.gov/home/showpublisheddocument/27594/637746586154900000',
};

// ── Run the Python extractor, return parsed JSON (or throw) ───────────────────
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractHillsboro.py');
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin
    ? ['-3', pyScript, pdfPath, '--mode', mode]
    : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `extractHillsboro.py failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
      `${(result.stderr || result.error?.message || '').slice(0, 500)}`
    );
  }
  return JSON.parse(result.stdout);
}

// ── Map the extractor tree to the RPC's {n,a,i:[...]} shape ──────────────────
function toBudgetTree(extractorTree, mode) {
  const rootChildren = extractorTree.c || [];
  let mapped;
  if (mode === 'revenue') {
    mapped = rootChildren.map(child => ({
      n: child.n,
      a: child.a,
      i: [{ d: child.n, a: child.a, aa: null, f: null, e: null }],
    }));
  } else {
    mapped = rootChildren.map(child => {
      if (Array.isArray(child.c) && child.c.length) {
        return {
          n: child.n,
          a: child.a,
          i: child.c.map(gc => ({ d: gc.n, a: gc.a, aa: null, f: null, e: null })),
        };
      }
      return {
        n: child.n,
        a: child.a,
        i: [{ d: child.n, a: child.a, aa: null, f: null, e: null }],
      };
    });
  }
  const total = mapped.reduce((s, n) => s + n.a, 0);
  const rowCount = mapped.reduce((s, n) => s + n.i.length, 0);
  return { tree: mapped, total, rowCount };
}

function dataSourceLabel(fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `City of Hillsboro ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

// ── Resolve Hillsboro's municipality_id; refuse to write if not found ─────────────
async function ensureMunicipality(supabase) {
  const { data, error } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name, population')
    .eq('name', 'Hillsboro')
    .eq('state', 'OR')
    .eq('entity_type', 'city')
    .maybeSingle();

  if (error) { console.error('  ERROR resolving Hillsboro municipality:', error.message); process.exit(2); }
  if (!data?.id) {
    console.error('  Hillsboro, OR (entity_type=city) municipality not found — run ' +
                  'scripts/seedWashingtonCountyOregonCities.js first');
    process.exit(2);
  }
  console.log(`  Municipality: Hillsboro, OR (${data.id})`);
  return data;
}

// ── Ephemeral data_sources lifecycle (WR-05/LOAD-01) ─────────────────────────
async function createEphemeralDataSource(supabase, muniId, datasetType) {
  const datasetId = datasetType === 'revenue' ? 'hillsboro-acfr-gf-revenue' : 'hillsboro-acfr-gf-operating';
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `Hillsboro General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: 'https://www.hillsboro-oregon.gov/our-city/departments/finance/financial-reports',
    fiscal_years: FYS,
    municipality_id: muniId,
  };
  await supabase.schema('treasury').from('data_sources').delete().eq('dataset_id', datasetId);
  const { data, error } = await supabase.schema('treasury').from('data_sources').insert(payload).select().single();
  if (error) { console.error('  data_source insert failed:', error.message); process.exit(2); }
  console.log(`  data_source created (ephemeral): ${data.id} [${datasetId}]`);
  return data;
}

async function deleteEphemeralDataSource(supabase, dsId) {
  const { error } = await supabase.schema('treasury').from('data_sources').delete().eq('id', dsId);
  if (error) console.error('  WARNING: ephemeral data_source cleanup failed:', error.message);
}

// ── Load one fiscal year, then source-stamp the resulting budgets row ────────
async function loadFiscalYear(supabase, muniId, dsId, fy, datasetType, tree, total, rowCount) {
  // Pre-load delete keyed on the columns that actually identify the target row.
  // NOTE: budgets.data_source_id FKs treasury.source_registry (not
  // treasury.data_sources) and treasury_sync_budget_tree never sets it, so a
  // dsId-keyed delete could never match a row (WR-01).
  const { error: delErr } = await supabase.schema('treasury').from('budgets')
    .delete().eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType);
  if (delErr) { console.error('    Pre-load delete failed:', delErr.message); return false; }

  const { data: rpc, error: rpcErr } = await supabase.rpc('treasury_sync_budget_tree', {
    p_data_source_id: dsId,
    p_fiscal_year:    fy,
    p_dataset_type:   datasetType,
    p_total:          total,
    p_tree:           tree,
    p_row_count:      rowCount,
    p_triggered_by:   'bulk_load',
  });
  if (rpcErr)     { console.error('    RPC error:', rpcErr.message); return false; }
  if (rpc?.error) { console.error('    RPC error (returned):', rpc.error); return false; }
  console.log(`    Inserted: ${rpc?.rows_inserted ?? '?'} line items (budget_id ${rpc?.budget_id})`);

  const { data: bud, error: budErr } = await supabase.schema('treasury').from('budgets')
    .select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType).maybeSingle();
  if (budErr || !bud?.id) {
    console.error('    Could not find budget row to stamp source:', budErr?.message ?? '(no row)');
    return false;
  }
  const { error: stampErr } = await supabase.schema('treasury').from('budgets').update({
    source_url:  URLS[fy],
    source_date: `${fy}-06-30`,
    data_source: dataSourceLabel(fy, datasetType),
  }).eq('id', bud.id);
  if (stampErr) { console.error('    Source stamp failed:', stampErr.message); return false; }
  console.log(`    Stamped source_url + source_date=${fy}-06-30`);
  return true;
}

// ── Process one mode across the requested FY window ──────────────────────────
async function processMode(supabase, muniId, dryRun, mode, targetFY, pdfsByFY) {
  const datasetType = mode === 'revenue' ? 'revenue' : 'operating';
  const years = targetFY ? [targetFY] : FYS;

  let ds = null;
  if (!dryRun) ds = await createEphemeralDataSource(supabase, muniId, datasetType);

  // The ephemeral data_sources row must be deleted however this loop ends --
  // including a per-FY abort. Internal hard-fails THROW rather than calling
  // process.exit(), so this finally block always runs; main()'s catch supplies
  // the non-zero exit code once cleanup has completed.
  try {
    for (const fy of years) {
      const pdfPath = pdfsByFY.get(fy);
      console.log(`\n── FY${fy} ${mode} ${'─'.repeat(40)}`);
      if (!pdfPath) throw new Error(`No PDF found for FY${fy} in docs/Hillsboro/ — aborting`);

      let extracted;
      try {
        extracted = extractPDF(pdfPath, mode);
      } catch (e) {
        throw new Error(`Extract failed: ${e.message}`);
      }

      if (extracted.fiscal_year !== fy) {
        throw new Error(`FY mismatch: ${path.basename(pdfPath)} reports fiscal_year ` +
          `${extracted.fiscal_year}, expected ${fy} — aborting`);
      }
      if (extracted.tie_delta !== 0) {
        throw new Error(`TIE FAILURE FY${fy} (${mode}): delta ${extracted.tie_delta} — aborting`);
      }

      const { tree, total, rowCount } = toBudgetTree(extracted.tree, mode);

      if (total !== extracted.computed_total) {
        throw new Error(`Mapped-tree total $${total.toLocaleString()} != extractor computed_total ` +
          `$${extracted.computed_total.toLocaleString()} — aborting`);
      }
      if (total > SANITY_MAX) {
        throw new Error(`SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds ceiling — aborting`);
      }

      console.log(`  Total: $${total.toLocaleString()}  (${tree.length} categories, ${rowCount} line items)`);
      console.log(`  Per-capita: $${(total / POPULATION).toFixed(2)}/resident`);
      if (extracted.zero_rows?.length) {
        console.log(`  $0 GF rows dropped: ${extracted.zero_rows.join(', ')}`);
      }
      for (const n of tree) {
        const suffix = n.i.length > 1 ? ` (${n.i.length} items: ${n.i.map(i => i.d).join(', ')})` : '';
        console.log(`    ${n.n}: $${n.a.toLocaleString()}${suffix}`);
      }

      if (dryRun) {
        console.log(`  [dry-run] fiscal_year=${fy} dataset_type=${datasetType} row_count=${rowCount} total=$${total.toLocaleString()}`);
        continue;
      }

      const ok = await loadFiscalYear(supabase, muniId, ds.id, fy, datasetType, tree, total, rowCount);
      if (!ok) throw new Error(`FY${fy} (${mode}) load failed — aborting`);
    }
  } finally {
    if (!dryRun && ds) {
      await deleteEphemeralDataSource(supabase, ds.id);
      console.log(`\ndata_source ${ds.id} deleted (ephemeral cleanup — 0 residue, WR-05/LOAD-01)`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { values: opts } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      revenue:   { type: 'boolean', default: false },
      fy:        { type: 'string' },
    },
    strict: false,
  });

  const dryRun   = opts['dry-run'];
  const mode     = opts.revenue ? 'revenue' : 'operating';
  const targetFY = opts.fy ? parseInt(opts.fy, 10) : null;

  if (targetFY && !FYS.includes(targetFY)) {
    console.error(`--fy ${targetFY} is outside the loaded window (${FYS.join(', ')})`);
    process.exit(1);
  }

  const pdfDir = resolvePdfDir();
  const pdfsByFY = discoverPdfsByFY(pdfDir);
  if (!pdfsByFY.size) {
    console.error(`No Hillsboro ACFR PDFs found in ${pdfDir}`);
    process.exit(1);
  }

  console.log(`Hillsboro Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
  console.log(`PDF dir: ${pdfDir}`);
  console.log(`PDFs discovered: ${pdfsByFY.size} (FY ${[...pdfsByFY.keys()].sort().join(', ')})`);

  let supabase = null, muniId = null;
  if (!dryRun) {
    if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const muni = await ensureMunicipality(supabase);
    muniId = muni.id;
  }

  await processMode(supabase, muniId, dryRun, mode, targetFY, pdfsByFY);

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
