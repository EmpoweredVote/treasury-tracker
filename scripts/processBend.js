#!/usr/bin/env node
/**
 * Bend, OR Budget Loader — General Fund operating (expenditure-by-function)
 * + revenue (revenue-by-source), FY2006-FY2025 (gaps FY2007, FY2015), ACTUAL
 * (ACFR GAAP basis).
 *
 * Consumes `scripts/extractBend.py` and loads exclusively through the
 * source-safe `treasury_sync_budget_tree` RPC -- never the sibling
 * non-source-safe city-budget sync RPC, which overwrites existing
 * (muni,fy,dataset) rows and keeps stale labels (see auto-memory
 * project_sync_city_budget_not_source_safe).
 *
 * Source: City of Bend Annual Comprehensive Financial Report, GAAP actuals,
 *   General Fund column of the governmental-funds Statement of Revenues,
 *   Expenditures and Changes in Fund Balances (Deficits). Whole dollars.
 *   Every year bookend-ties the GF column at exactly $0.
 *
 * WHY GAAP ACTUALS AND NOT THE BUDGETARY SCHEDULE
 * -----------------------------------------------
 * Bend budgets on a TWO-YEAR BIENNIUM. Its `Schedule of Revenues, Expenditures
 * and Changes in Fund Balance - Budget and Actual` carries per-FY actual columns
 * but only biennium-level Original/Final budget columns, which cannot be split
 * into per-FY budget rows without fabricating a number. TT stores rows per
 * (muni, fy, dataset), so this loader deliberately loads ACTUALS ONLY, taken
 * from the GAAP primary statement -- the same basis as every other TT city.
 *
 * Cross-check (recon, OREGON-CITIES-RECON.md): the GAAP GF expenditure totals
 * reconcile to the budgetary schedule's per-FY actual columns within a normal
 * basis adjustment -- FY2025 $47,192,049 GAAP vs $47,173,445 budget basis
 * (delta $18,604); FY2024 $42,328,742 vs $42,252,353 (delta $76,389). The
 * narrower `Schedule of Expenditures by Appropriation Levels` is a third,
 * legal-appropriation scope and is intentionally NOT used.
 *
 * SCOPE: GF-only. Bend's Fire/EMS, Streets & Operations and SDC funds sit
 * OUTSIDE the General Fund, so GF expenditure is dominated by Public safety
 * (~87% in FY2025) and understates total city spending. This is a deliberate,
 * per-instruction scope choice, not a parse artifact.
 *
 * Tree mapping: the extractor emits a nested {n,a,c:[...]} tree; this loader
 * maps it to the RPC's {n,a,i:[{d,a,aa,f,e}]} shape:
 *   - revenue (flat): each root child -> {n, a, i:[{d:n, ...}]}.
 *   - operating (2-level): a root child WITH a nested `.c` array (Current,
 *     Debt service) -> i[] = its children (the icicle drill-down leaves);
 *     a root child with NO `.c` (Capital outlay) -> single-item leaf.
 *
 * Provenance: data_sources rows are EPHEMERAL -- one per dataset_type, created
 *   at the start of a live run and deleted at the end (WR-05/LOAD-01); budgets
 *   rows carry the durable text-stamp provenance. Every loaded row is stamped
 *   post-sync with source_url (the per-FY bendoregon.gov PDF) and source_date =
 *   the fiscal-year end (June 30, <FY>) -- no fabricated issue date.
 *
 * Idempotency: a per-(municipality_id, fiscal_year, dataset_type) pre-load
 *   delete runs before every RPC call; the RPC also upserts on the same key, so
 *   a second full run nets 0 row-count / total change.
 *
 * Safety:
 *   (a) shell injection -- extractPDF() uses spawnSync with an ARGS ARRAY, and
 *       PDF paths come from a controlled docs/Bend/ readdir, never user input.
 *   (b) silent mis-parse -- the extractor's tie_delta==0 gate (non-zero exit
 *       aborts the FY) PLUS an independent check that the mapped-tree total
 *       equals the extractor's computed_total.
 *   (c) overwrite / stale rows -- source-safe RPC only, plus the pre-load delete.
 *   (d) parse blow-up -- a per-FY sanity ceiling (SANITY_MAX) aborts the run.
 *   (e) data_sources residue -- ephemeral create/delete in a finally block.
 *
 * ENVIRONMENT NOTE (this machine): `python` on PATH resolves to the
 * non-functional Microsoft Store alias stub; the working launcher is `py -3`.
 *
 * Usage:
 *   node scripts/processBend.js --dry-run            # operating dry-run, all FYs
 *   node scripts/processBend.js --revenue --dry-run  # revenue dry-run, all FYs
 *   node scripts/processBend.js                      # LIVE operating, all FYs
 *   node scripts/processBend.js --revenue            # LIVE revenue, all FYs
 *   node scripts/processBend.js --fy 2025            # single FY
 *
 * Requires: `pdftotext -table` (poppler) on PATH; Bend seeded via
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
// docs/Bend/*.pdf is gitignored (docs/*); a worktree can't see it -- fall back
// to the main working tree's docs/Bend/ via git-common-dir.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Bend');
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Bend');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* not a git repo -- ignore */ }
  return candidate;
}

// ── Discover PDFs by fiscal year from a controlled readdir ───────────────────
function discoverPdfsByFY(pdfDir) {
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^bend-(\d{4})-acfr\.pdf$/i);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Fixed facts ────────────────────────────────────────────────────────────────
// FY2006-FY2025 window (18 years; FY2007 and FY2015 are genuine gaps).
//
// Bend's finance page links ONLY the current year, which made the archive look
// far thinner than it is — an initial pass loaded just FY2022-FY2025 because
// those were the only other URLs a web search surfaced. Bend runs WordPress, and
// its REST media endpoint exposes the whole library:
//
//   /wp-json/wp/v2/media?search=<term>&per_page=100&_fields=source_url,title
//
// searched for "acfr", "cafr", "financial-report" and "annual". That lists
// annual financial reports back to FY2005.
//
// TWO GAPS, both genuine and documented:
//   FY2015 — Bend published NO 2014-2015 annual financial report. Searching the
//            media library for "2014-2015" returns SDC/BURA/CDBG documents only.
//   FY2007 — the FY2006-07 PDF is a pure scan: all 192 pages have no text layer
//            at all. FY2005 is the same (177/177 pages empty), which is why the
//            window starts at FY2006 rather than FY2005.
// Everything else back to FY2006 extracts and ties.
const FYS = [2006, 2008, 2009, 2010, 2011, 2012, 2013, 2014,
             2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const POPULATION = 106926; // Census PEP vintage 2024, matches the seeder
const SANITY_MAX = 2_000_000_000;

// Durable per-FY bendoregon.gov PDF URLs (all HTTP 200 application/pdf,
// verified 2026-07-27). NOTE: bendoregon.gov sits behind Cloudflare and returns
// 403 to a bare UA -- a browser header set including Sec-Fetch-* and
// Upgrade-Insecure-Requests is required to re-download these.
const URLS = {
  2025: 'https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-ACFR-FY20242025.pdf',
  2024: 'https://bendoregon.gov/wp-content/uploads/2025/12/2023-2024-Annual-Financial-Report-with-Links.pdf',
  2023: 'https://bendoregon.gov/wp-content/uploads/2025/12/CityofBend-ACFR-FY2022-2023-for-Web_Updated.pdf',
  2022: 'https://bendoregon.gov/wp-content/uploads/2025/12/CityofBend-ACFR-FY2021-2022.pdf',
  2021: 'https://bendoregon.gov/wp-content/uploads/2025/12/CityOfBendOregonFY20202021.pdf',
  2020: 'https://bendoregon.gov/wp-content/uploads/2025/12/CityOfBendOregonFY20192020.pdf',
  2019: 'https://bendoregon.gov/wp-content/uploads/2025/12/City-Of-Bend-Oregon-FY2018-2019-CAFR-FINAL-ORIGINAL.pdf',
  2018: 'https://bendoregon.gov/wp-content/uploads/2025/12/FY17-18-CAFR-COB-FINAL.pdf',
  2017: 'https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-CAFR-2016-2017.pdf',
  2016: 'https://bendoregon.gov/wp-content/uploads/2025/12/20152016CAFR.pdf',
  2014: 'https://bendoregon.gov/wp-content/uploads/2025/12/2013-2014-CAFR.pdf',
  2013: 'https://bendoregon.gov/wp-content/uploads/2025/12/CAFR-12_13-as-of-121613-Final-with-dividers-tabs.pdf',
  2012: 'https://bendoregon.gov/wp-content/uploads/2025/12/FY-2011-12-City-of-Bend-CAFR-122112.pdf',
  2011: 'https://bendoregon.gov/wp-content/uploads/2025/12/City-of-Bend-FY10-11-CAFR-12-20-11.pdf',
  2010: 'https://bendoregon.gov/wp-content/uploads/2025/12/FY2009_10_City_of_Bend_Oregon_CAFR.pdf',
  2009: 'https://bendoregon.gov/wp-content/uploads/2025/12/FY2008_09_City_of_Bend_CAFR.pdf',
  2008: 'https://bendoregon.gov/wp-content/uploads/2025/12/City_of_Bend_07_08_CAFR_for_Web.pdf',
  2006: 'https://bendoregon.gov/wp-content/uploads/2025/12/FY-2006-CAFR-for-web.pdf',
};

// ── Run the Python extractor, return parsed JSON (or throw) ───────────────────
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractBend.py');
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin
    ? ['-3', pyScript, pdfPath, '--mode', mode]
    : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `extractBend.py failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
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
  return `City of Bend ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

// ── Resolve Bend's municipality_id; refuse to write if not found ─────────────
async function ensureMunicipality(supabase) {
  const { data, error } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name, population')
    .eq('name', 'Bend')
    .eq('state', 'OR')
    .eq('entity_type', 'city')
    .maybeSingle();

  if (error) { console.error('  ERROR resolving Bend municipality:', error.message); process.exit(2); }
  if (!data?.id) {
    console.error('  Bend, OR (entity_type=city) municipality not found — run ' +
                  'scripts/seedWashingtonCountyOregonCities.js first');
    process.exit(2);
  }
  console.log(`  Municipality: Bend, OR (${data.id})`);
  return data;
}

// ── Ephemeral data_sources lifecycle (WR-05/LOAD-01) ─────────────────────────
async function createEphemeralDataSource(supabase, muniId, datasetType) {
  const datasetId = datasetType === 'revenue' ? 'bend-acfr-gf-revenue' : 'bend-acfr-gf-operating';
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `Bend General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: 'https://www.bendoregon.gov/government/departments/finance/financial-reports',
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
      if (!pdfPath) throw new Error(`No PDF found for FY${fy} in docs/Bend/ — aborting`);

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
      // A non-zero delta is fatal UNLESS it exactly matches a source-rounding
      // case pre-registered in extractBend.py (a handful of Bend statements whose
      // printed total disagrees with the sum of their own printed components by
      // $1). The extractor only sets source_rounding_accepted on an exact match,
      // so this cannot widen into a general tolerance.
      if (extracted.tie_delta !== 0 && extracted.source_rounding_accepted !== extracted.tie_delta) {
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
    console.error(`No Bend ACFR PDFs found in ${pdfDir}`);
    process.exit(1);
  }

  console.log(`Bend Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
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
