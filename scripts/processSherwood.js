#!/usr/bin/env node
/**
 * Sherwood, OR Budget Loader - General Fund operating (expenditure-by-function)
 * + revenue (revenue-by-source), FY2021-FY2025, ACTUAL (ACFR GAAP basis).
 *
 * Consumes `scripts/extractSherwood.py` and loads exclusively through the
 * source-safe `treasury_sync_budget_tree` RPC -- never the sibling
 * non-source-safe city-budget sync RPC, which overwrites existing
 * (muni,fy,dataset) rows and keeps stale labels (see auto-memory
 * project_sync_city_budget_not_source_safe).
 *
 * Source: City of Sherwood Annual Comprehensive Financial Report, GAAP actuals,
 *   General Fund column of the governmental-funds Statement of Revenues,
 *   Expenditures and Changes in Fund Balances. Whole dollars. Every year
 *   bookend-ties the GF column at exactly $0.
 *
 * Sherwood groups spending as Current: (Administration, Community Development,
 * Public Safety, Community Services, Public Works) then Noncurrent (Capital
 * Outlay, Debt Service - Principal/Interest). That Capital-Outlay-under-
 * Noncurrent nesting was verified against `pdftotext -layout` indentation;
 * `-table` flattens indentation and Tualatin nests the same label differently.
 *
 * SCOPE: GF-only. Sherwood's GF carries five real operating functions -- a
 * richer expenditure tree than Bend's two.
 *
 * Tree mapping: the extractor emits a nested {n,a,c:[...]} tree; this loader
 * maps it to the RPC's {n,a,i:[{d,a,aa,f,e}]} shape:
 *   - revenue (flat): each root child -> {n, a, i:[{d:n, ...}]}.
 *   - operating (2-level): a root child WITH a nested `.c` array -> i[] = its
 *     children (the icicle drill-down leaves); a root child with NO `.c` ->
 *     a single-item leaf.
 *
 * Provenance: data_sources rows are EPHEMERAL -- one per dataset_type, created
 *   at the start of a live run and deleted at the end (WR-05/LOAD-01); budgets
 *   rows carry the durable text-stamp provenance. Every loaded row is stamped
 *   post-sync with source_url and source_date = the fiscal-year end
 *   (June 30, <FY>) -- no fabricated issue date.
 *
 * Idempotency: a per-(municipality_id, fiscal_year, dataset_type) pre-load
 *   delete runs before every RPC call; the RPC also upserts on the same key.
 *
 * Safety: args-array spawnSync (no shell); controlled docs/Sherwood/ readdir;
 *   the extractor's tie_delta==0 gate plus an independent mapped-total check;
 *   source-safe RPC only; per-FY sanity ceiling; ephemeral data_sources
 *   cleanup in a finally block.
 *
 * ENVIRONMENT NOTE (this machine): `python` on PATH resolves to the
 * non-functional Microsoft Store alias stub; the working launcher is `py -3`.
 *
 * Usage:
 *   node scripts/processSherwood.js --dry-run            # operating dry-run, all FYs
 *   node scripts/processSherwood.js --revenue --dry-run  # revenue dry-run, all FYs
 *   node scripts/processSherwood.js                      # LIVE operating, all FYs
 *   node scripts/processSherwood.js --revenue            # LIVE revenue, all FYs
 *   node scripts/processSherwood.js --fy 2025            # single FY
 *
 * Requires: `pdftotext -table` (poppler) on PATH; Sherwood seeded via
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
// docs/Sherwood/*.pdf is gitignored (docs/*); a worktree can't see it -- fall back
// to the main working tree's docs/Sherwood/ via git-common-dir.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Sherwood');
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Sherwood');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* not a git repo -- ignore */ }
  return candidate;
}

// ── Discover PDFs by fiscal year from a controlled readdir ───────────────────
function discoverPdfsByFY(pdfDir) {
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^sherwood-(\d{4})-acfr\.pdf$/i);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Fixed facts ────────────────────────────────────────────────────────────────
// FY2014-FY2025 with ONE deliberate hole at FY2019.
//
// Sherwood's financial-reports page links only FY2021-FY2025, which made the
// archive look 5 years deep. Its WordPress media endpoint
// (/wp-json/wp/v2/media?search=acfr) lists ACFRs back to FY2014 under a uniform
// filename pattern.
//
// FY2019 IS DELIBERATELY EXCLUDED: that year's PDF is a scan/OCR, not digital
// text. Its statement reads "Shenruood, Oregon", renders thousands separators as
// periods ("2.525.017"), and corrupts digits inside amounts ("2J69,082",
// "6ee'750", "2,310,e10"). The extractor's tie gate rejects it (revenue delta
// -14,558,532). The amounts are not recoverable without guessing, so the year is
// left out rather than loaded wrong. FY2014-FY2018 and FY2020 are all digital
// text, tie at $0, and carry the same five Current functions as later years.
const FYS = [2014, 2015, 2016, 2017, 2018, 2020, 2021, 2022, 2023, 2024, 2025];
const POPULATION = 20441; // Census PEP vintage 2024, matches the seeder
const SANITY_MAX = 2_000_000_000;

// Durable per-FY source PDF URLs, stamped onto every loaded budgets row
// (verified 2026-07-27).
// FY2021-FY2025 keep the opaque-id URLs the original load extracted from (still
// live); FY2014-FY2020 use the uniform media-library pattern. Both point at the
// same documents — the URLs differ only because the site stores two copies, and
// each row is stamped with the URL its figures actually came from.
const URLS = {
  2025: 'https://www.sherwoodoregon.gov/wp-content/uploads/2026/01/FY25-City-of-Sherwood-ACFR-Final-1.pdf',
  2024: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/09/FY24-City-of-Sherwood-Audit.pdf',
  2023: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/02/66976.pdf',
  2022: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/02/40881.pdf',
  2021: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/02/40886.pdf',
  2020: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/03/2020_city_of_sherwood_annual_comprehensive_financial_report_acfr_.pdf',
  2018: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/03/2018_city_of_sherwood_annual_comprehensive_financial_report_acfr_.pdf',
  2017: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/03/2017_city_of_sherwood_annual_comprehensive_financial_report_acfr_.pdf',
  2016: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/03/2016_city_of_sherwood_annual_comprehensive_financial_report_acfr_.pdf',
  2015: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/03/2015_city_of_sherwood_annual_comprehensive_financial_report_acfr_.pdf',
  2014: 'https://www.sherwoodoregon.gov/wp-content/uploads/2025/03/2014_city_of_sherwood_annual_comprehensive_financial_report_acfr_.pdf',
};

// ── Run the Python extractor, return parsed JSON (or throw) ───────────────────
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractSherwood.py');
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin
    ? ['-3', pyScript, pdfPath, '--mode', mode]
    : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `extractSherwood.py failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
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
  return `City of Sherwood ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

// ── Resolve Sherwood's municipality_id; refuse to write if not found ─────────────
async function ensureMunicipality(supabase) {
  const { data, error } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name, population')
    .eq('name', 'Sherwood')
    .eq('state', 'OR')
    .eq('entity_type', 'city')
    .maybeSingle();

  if (error) { console.error('  ERROR resolving Sherwood municipality:', error.message); process.exit(2); }
  if (!data?.id) {
    console.error('  Sherwood, OR (entity_type=city) municipality not found — run ' +
                  'scripts/seedWashingtonCountyOregonCities.js first');
    process.exit(2);
  }
  console.log(`  Municipality: Sherwood, OR (${data.id})`);
  return data;
}

// ── Ephemeral data_sources lifecycle (WR-05/LOAD-01) ─────────────────────────
async function createEphemeralDataSource(supabase, muniId, datasetType) {
  const datasetId = datasetType === 'revenue' ? 'sherwood-acfr-gf-revenue' : 'sherwood-acfr-gf-operating';
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `Sherwood General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: 'https://www.sherwoodoregon.gov/financial-reports/',
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
      if (!pdfPath) throw new Error(`No PDF found for FY${fy} in docs/Sherwood/ — aborting`);

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
    console.error(`No Sherwood ACFR PDFs found in ${pdfDir}`);
    process.exit(1);
  }

  console.log(`Sherwood Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
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
