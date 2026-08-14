#!/usr/bin/env node
/**
 * Seattle, WA Budget Loader — General Fund operating (expenditure-by-function)
 * + revenue (revenue-by-source), FY2009-FY2025 (all 17 years present, no
 * gaps), ACTUAL (ACFR GAAP basis).
 *
 * Structural model: scripts/processBend.js. Consumes
 * scripts/extractSeattle.py and loads exclusively through the source-safe
 * `treasury_sync_budget_tree` RPC -- never the sibling non-source-safe
 * city-budget sync RPC, which overwrites existing (muni,fy,dataset) rows and
 * keeps stale labels (see auto-memory project_sync_city_budget_not_source_safe).
 *
 * Source: City of Seattle Annual Comprehensive Financial Report, GAAP
 *   actuals, General Fund column of the governmental-funds Statement of
 *   Revenues, Expenditures and Changes in Fund Balances (schedule B-4).
 *   Every year bookend-ties the GF column at exactly $0 (verified
 *   independently for all 34 FY x mode extractions prior to this loader).
 *
 * DIFFERENCES FROM THE BEND MODEL (see task-10-brief.md)
 * -------------------------------------------------------
 * 1. Seattle closes on the CALENDAR year, not a June 30 fiscal year --
 *    source_date is `${fy}-12-31`, not `${fy}-06-30`.
 * 2. source_url comes from SEATTLE_URLS (scripts/fetchSeattleKingCounty.mjs),
 *    the same URL the fetcher actually downloaded -- never retyped.
 * 3. Amounts are already scaled to dollars by extractSeattle.py
 *    (CityConfig.units=1000) -- this loader does NOT multiply again.
 * 4. Tree mapping: Seattle's REVENUE tree exercises BOTH shapes the
 *    extractor can emit -- a `Taxes` parent with five children (2024-era)
 *    plus flat siblings, in the SAME tree. Bend's revenue tree was always
 *    flat, so Bend's loader special-cased "revenue = always a single-item
 *    leaf" per root child. That special case is WRONG for Seattle and is
 *    removed here: one mapping function is used for both modes, exactly
 *    Bend's own operating-side rule -- a root child WITH a nested `.c`
 *    array maps to `{n, a, i:[...children]}`; a root child with NO `.c`
 *    maps to a single-item leaf.
 * 5. Ephemeral data_sources dataset_ids: seattle-acfr-gf-revenue /
 *    seattle-acfr-gf-operating.
 * 6. Fiscal-year cross-check (not in the Bend model, added here): the
 *    extractor's reported fiscal_year is asserted equal to the year encoded
 *    in the PDF's own filename, and the FY is aborted loudly on mismatch.
 *    This guards against a real, previously-fixed defect in this project:
 *    King County's FY2024 ACFR once parsed as 2023 because the
 *    whole-document fallback latched onto a GFOA-award paragraph citing the
 *    prior year, while the tie still read $0 (see lib/acfrGF.py parse_fy
 *    docstring). Rows key on (municipality_id, fiscal_year, dataset_type),
 *    so a wrong year would silently overwrite a DIFFERENT year's row.
 * 7. Unit-plausibility guard: the tie gate is unit-invariant (reads $0
 *    whether or not the x1000 multiplier was applied), so per-capita
 *    spend/resident is the cheapest oracle that is NOT. Added to
 *    loadFiscalYear before the RPC call.
 * 8. getSeattleId (scripts/seedWashingtonSeattle.js) is imported rather than
 *    hardcoding Seattle's municipality_id. It expects a supabase client
 *    ALREADY scoped to the `treasury` schema
 *    (`createClient(url, key, { db: { schema: 'treasury' } })`) -- an
 *    unscoped client would silently query the wrong schema. A second,
 *    default-schema (public) client is used for the
 *    `treasury_sync_budget_tree` RPC call, mirroring
 *    seedWashingtonSeattle.js's own supabase/publicClient split.
 *
 * Tree mapping: the extractor emits a nested {n,a,c:[...]} tree; this loader
 * maps it to the RPC's {n,a,i:[{d,a,aa,f,e}]} shape:
 *   - a root child WITH a nested `.c` array (e.g. Taxes 2024+, Current,
 *     Debt service) -> i[] = its children (the icicle drill-down leaves).
 *   - a root child with NO `.c` (e.g. flat revenue sources, Capital outlay)
 *     -> single-item leaf.
 *
 * Provenance: data_sources rows are EPHEMERAL -- one per dataset_type,
 *   created at the start of a live run and deleted at the end (WR-05/LOAD-01);
 *   budgets rows carry the durable text-stamp provenance. Every loaded row is
 *   stamped post-sync with source_url (the per-FY seattle.gov PDF) and
 *   source_date = the fiscal-year end (December 31, <FY>) -- no fabricated
 *   issue date.
 *
 * Idempotency: a per-(municipality_id, fiscal_year, dataset_type) pre-load
 *   delete runs before every RPC call; the RPC also upserts on the same key,
 *   so a second full run nets 0 row-count / total change.
 *
 * Safety:
 *   (a) shell injection -- extractPDF() uses spawnSync with an ARGS ARRAY,
 *       and PDF paths come from a controlled docs/Seattle/ readdir, never
 *       user input.
 *   (b) silent mis-parse -- the extractor's tie_delta==0 gate (non-zero exit
 *       aborts the FY) PLUS an independent check that the mapped-tree total
 *       equals the extractor's computed_total, PLUS the FY-vs-filename
 *       cross-check (difference #6 above).
 *   (c) overwrite / stale rows -- source-safe RPC only, plus the pre-load
 *       delete keyed on (municipality_id, fiscal_year, dataset_type) -- NOT
 *       on data_source_id, which FKs treasury.source_registry (a different
 *       table) and could never match.
 *   (d) parse blow-up -- a per-FY sanity ceiling (SANITY_MAX) aborts the run.
 *   (e) units error -- the per-capita plausibility guard (difference #7).
 *   (f) data_sources residue -- ephemeral create/delete in a finally block;
 *       per-FY hard failures THROW (never process.exit) so the finally always
 *       runs.
 *
 * ENVIRONMENT NOTE (this machine): `python` on PATH resolves to the
 * non-functional Microsoft Store alias stub; the working launcher is `py -3`.
 *
 * Usage:
 *   node scripts/processSeattle.js --dry-run            # operating dry-run, all FYs
 *   node scripts/processSeattle.js --revenue --dry-run  # revenue dry-run, all FYs
 *   node scripts/processSeattle.js                      # LIVE operating, all FYs
 *   node scripts/processSeattle.js --revenue             # LIVE revenue, all FYs
 *   node scripts/processSeattle.js --fy 2024             # single FY
 *
 * Requires: `pdftotext -table` (poppler) on PATH; Seattle seeded via
 *   scripts/seedWashingtonSeattle.js first.
 */

import { spawnSync, execSync } from 'node:child_process';
import { createClient }        from '@supabase/supabase-js';
import { parseArgs }           from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                    from 'node:path';
import { fileURLToPath }       from 'node:url';

import { getSeattleId }     from './seedWashingtonSeattle.js';
import { SEATTLE_URLS }     from './fetchSeattleKingCounty.mjs';

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
// docs/Seattle/*.pdf is gitignored (docs/*); a worktree can't see it -- fall
// back to the main working tree's docs/Seattle/ via git-common-dir.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Seattle');
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Seattle');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* not a git repo -- ignore */ }
  return candidate;
}

// ── Discover PDFs by fiscal year from a controlled readdir ───────────────────
function discoverPdfsByFY(pdfDir) {
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^seattle-(\d{4})-acfr\.pdf$/i);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Fixed facts ────────────────────────────────────────────────────────────────
// FY2009-FY2025 window (17 years, no gaps -- all 17 PDFs extract and tie $0).
const FYS = [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017,
             2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const SANITY_MAX = 10_000_000_000; // Seattle GF totals run in the low billions.
// Census PEP vintage 2024 (see scripts/seedWashingtonSeattle.js); used for the
// per-capita plausibility guard and dry-run display alike, so dry-run does
// not need a live DB connection to show a meaningful per-capita figure.
const POPULATION = 780995;

// ── Run the Python extractor, return parsed JSON (or throw) ───────────────────
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractSeattle.py');
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin
    ? ['-3', pyScript, pdfPath, '--mode', mode]
    : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `extractSeattle.py failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
      `${(result.stderr || result.error?.message || '').slice(0, 500)}`
    );
  }
  return JSON.parse(result.stdout);
}

// ── Map the extractor tree to the RPC's {n,a,i:[...]} shape ──────────────────
// Unified across both modes (unlike Bend, which special-cased revenue as
// always-flat): Seattle's revenue tree has BOTH a grouped root child (Taxes,
// 2024+) and flat siblings, exactly the shape Bend only ever saw on the
// operating side. A root child WITH a nested, non-empty `.c` array maps to
// {n, a, i:[...children]}; a root child with NO `.c` maps to a single-item
// leaf.
function toBudgetTree(extractorTree) {
  const rootChildren = extractorTree.c || [];
  const mapped = rootChildren.map(child => {
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
  const total = mapped.reduce((s, n) => s + n.a, 0);
  const rowCount = mapped.reduce((s, n) => s + n.i.length, 0);
  return { tree: mapped, total, rowCount };
}

function dataSourceLabel(fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `City of Seattle ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

// ── Resolve Seattle's municipality_id; refuse to write if not found ─────────
// Population is NOT read from this row -- it is the fixed POPULATION
// constant above (Census PEP vintage 2024, matching seedWashingtonSeattle.js),
// mirroring processBend.js's own hardcoded-constant-matching-the-seeder
// pattern. This call still logs the DB's own population value so a drift
// between the two is visible rather than silently masked.
async function ensureMunicipality(treasuryClient) {
  const id = await getSeattleId(treasuryClient);
  const { data, error } = await treasuryClient
    .from('municipalities')
    .select('id, name, population')
    .eq('id', id)
    .single();
  if (error || !data) {
    console.error('  ERROR resolving Seattle municipality:', error?.message ?? '(no row)');
    process.exit(2);
  }
  console.log(`  Municipality: Seattle, WA (${data.id}), DB population ${Number(data.population).toLocaleString()} (guard uses fixed constant ${POPULATION.toLocaleString()})`);
  if (Number(data.population) !== POPULATION) {
    console.error(`  WARNING: DB population (${data.population}) != POPULATION constant (${POPULATION}) -- update the constant if this is a real refresh.`);
  }
  return data;
}

// ── Ephemeral data_sources lifecycle (WR-05/LOAD-01) ─────────────────────────
async function createEphemeralDataSource(treasuryClient, muniId, datasetType) {
  const datasetId = datasetType === 'revenue' ? 'seattle-acfr-gf-revenue' : 'seattle-acfr-gf-operating';
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `Seattle General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: 'https://www.seattle.gov/documents/Departments/CityFinance/FinancialServices/CAFR',
    fiscal_years: FYS,
    municipality_id: muniId,
  };
  await treasuryClient.from('data_sources').delete().eq('dataset_id', datasetId);
  const { data, error } = await treasuryClient.from('data_sources').insert(payload).select().single();
  if (error) { console.error('  data_source insert failed:', error.message); process.exit(2); }
  console.log(`  data_source created (ephemeral): ${data.id} [${datasetId}]`);
  return data;
}

async function deleteEphemeralDataSource(treasuryClient, dsId) {
  const { error } = await treasuryClient.from('data_sources').delete().eq('id', dsId);
  if (error) console.error('  WARNING: ephemeral data_source cleanup failed:', error.message);
}

// ── Load one fiscal year, then source-stamp the resulting budgets row ────────
async function loadFiscalYear(treasuryClient, publicClient, muniId, dsId, fy, datasetType, tree, total, rowCount, population) {
  // The tie gate is unit-invariant: it reads $0 whether or not the thousands
  // multiplier was applied. Per-capita is the cheapest oracle that is NOT.
  // Seattle GF spend is ~$2.4B over ~780k residents ~= $3,065/resident; a missing
  // x1000 lands at ~$3.07 and a doubled one at ~$3.07M. Anything outside this
  // band is a unit error, not an unusual budget year.
  const perCapita = total / population;
  if (perCapita < 500 || perCapita > 25000) {
    throw new Error(
      `FY${fy} ${datasetType}: $${perCapita.toFixed(2)}/resident is outside the ` +
      `plausible band [500, 25000]. Total=$${total.toLocaleString()}, pop=${population}. ` +
      `This is almost certainly a units error -- check CityConfig.units.`);
  }

  // Pre-load delete keyed on the columns that actually identify the target row.
  // NOTE: budgets.data_source_id FKs treasury.source_registry (not
  // treasury.data_sources) and treasury_sync_budget_tree never sets it, so a
  // dsId-keyed delete could never match a row (WR-01).
  const { error: delErr } = await treasuryClient.from('budgets')
    .delete().eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType);
  if (delErr) { console.error('    Pre-load delete failed:', delErr.message); return false; }

  const { data: rpc, error: rpcErr } = await publicClient.rpc('treasury_sync_budget_tree', {
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

  const { data: bud, error: budErr } = await treasuryClient.from('budgets')
    .select('id').eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', datasetType).maybeSingle();
  if (budErr || !bud?.id) {
    console.error('    Could not find budget row to stamp source:', budErr?.message ?? '(no row)');
    return false;
  }
  const { error: stampErr } = await treasuryClient.from('budgets').update({
    source_url:  SEATTLE_URLS[fy],
    source_date: `${fy}-12-31`,
    data_source: dataSourceLabel(fy, datasetType),
  }).eq('id', bud.id);
  if (stampErr) { console.error('    Source stamp failed:', stampErr.message); return false; }
  console.log(`    Stamped source_url + source_date=${fy}-12-31`);
  return true;
}

// ── Process one mode across the requested FY window ──────────────────────────
async function processMode(treasuryClient, publicClient, muniId, population, dryRun, mode, targetFY, pdfsByFY) {
  const datasetType = mode === 'revenue' ? 'revenue' : 'operating';
  const years = targetFY ? [targetFY] : FYS;

  let ds = null;
  if (!dryRun) ds = await createEphemeralDataSource(treasuryClient, muniId, datasetType);

  // The ephemeral data_sources row must be deleted however this loop ends --
  // including a per-FY abort. Internal hard-fails THROW rather than calling
  // process.exit(), so this finally block always runs; main()'s catch supplies
  // the non-zero exit code once cleanup has completed.
  try {
    for (const fy of years) {
      const pdfPath = pdfsByFY.get(fy);
      console.log(`\n── FY${fy} ${mode} ${'─'.repeat(40)}`);
      if (!pdfPath) throw new Error(`No PDF found for FY${fy} in docs/Seattle/ — aborting`);

      let extracted;
      try {
        extracted = extractPDF(pdfPath, mode);
      } catch (e) {
        throw new Error(`Extract failed: ${e.message}`);
      }

      // Fiscal-year cross-check: the extractor's reported fiscal_year must
      // match the year encoded in the PDF's own filename. Rows key on
      // (municipality_id, fiscal_year, dataset_type), so a wrong year would
      // silently overwrite a DIFFERENT year's row -- exactly the defect once
      // found live on King County's FY2024 ACFR (see module header, diff #6).
      if (extracted.fiscal_year !== fy) {
        throw new Error(`FY mismatch: ${path.basename(pdfPath)} reports fiscal_year ` +
          `${extracted.fiscal_year}, expected ${fy} — aborting`);
      }
      // A non-zero delta is fatal UNLESS it exactly matches a source-rounding
      // case pre-registered in extractSeattle.py's shared config. The
      // extractor only sets source_rounding_accepted on an exact match, so
      // this cannot widen into a general tolerance.
      if (extracted.tie_delta !== 0 && extracted.source_rounding_accepted !== extracted.tie_delta) {
        throw new Error(`TIE FAILURE FY${fy} (${mode}): delta ${extracted.tie_delta} — aborting`);
      }

      const { tree, total, rowCount } = toBudgetTree(extracted.tree);

      if (total !== extracted.computed_total) {
        throw new Error(`Mapped-tree total $${total.toLocaleString()} != extractor computed_total ` +
          `$${extracted.computed_total.toLocaleString()} — aborting`);
      }
      if (total > SANITY_MAX) {
        throw new Error(`SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds ceiling — aborting`);
      }

      console.log(`  Total: $${total.toLocaleString()}  (${tree.length} categories, ${rowCount} line items)`);
      console.log(`  Per-capita: $${(total / population).toFixed(2)}/resident`);
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

      const ok = await loadFiscalYear(treasuryClient, publicClient, muniId, ds.id, fy, datasetType, tree, total, rowCount, population);
      if (!ok) throw new Error(`FY${fy} (${mode}) load failed — aborting`);
    }
  } finally {
    if (!dryRun && ds) {
      await deleteEphemeralDataSource(treasuryClient, ds.id);
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
    console.error(`No Seattle ACFR PDFs found in ${pdfDir}`);
    process.exit(1);
  }

  console.log(`Seattle Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
  console.log(`PDF dir: ${pdfDir}`);
  console.log(`PDFs discovered: ${pdfsByFY.size} (FY ${[...pdfsByFY.keys()].sort().join(', ')})`);

  let treasuryClient = null, publicClient = null, muniId = null;
  const population = POPULATION; // fixed constant; see note above ensureMunicipality
  if (!dryRun) {
    if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
    // getSeattleId expects a client already scoped to the `treasury` schema
    // (see seedWashingtonSeattle.js); an unscoped client would silently query
    // the wrong schema. The RPC lives in the public schema, so a second,
    // default-schema client is used for it, mirroring
    // seedWashingtonSeattle.js's own supabase/publicClient split.
    treasuryClient = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });
    publicClient   = createClient(SUPABASE_URL, SUPABASE_KEY);
    const muni = await ensureMunicipality(treasuryClient);
    muniId = muni.id;
  }

  await processMode(treasuryClient, publicClient, muniId, population, dryRun, mode, targetFY, pdfsByFY);

  console.log('\nDone.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
