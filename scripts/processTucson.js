#!/usr/bin/env node
/**
 * Tucson, AZ Budget Loader — General Fund operating (expenditure-by-function)
 * + revenue (revenue-by-source), FY2015-FY2024, ACTUAL (ACFR GAAP basis).
 *
 * Phase 129-02 (TUC-05). Consumes `scripts/extractTucson.py` (Phase 128) and
 * loads exclusively through the source-safe `treasury_sync_budget_tree` RPC
 * -- never the sibling non-source-safe city-budget sync RPC, which overwrites
 * existing (muni,fy,dataset) rows and keeps stale labels (see auto-memory
 * project_sync_city_budget_not_source_safe).
 *
 * Source: City of Tucson Annual Comprehensive Financial Report (ACFR), GAAP
 *   actuals, General Fund column of the governmental-funds Statement of
 *   Revenues, Expenditures and Changes in Fund Balances. Whole dollars.
 *   Locked window FY2015-FY2024 (see 128-RECON.md) -- every year bookend-ties
 *   the GF column at exactly $0.
 *
 * Tree mapping (CONTEXT 129 D-08): the extractor emits a nested {n,a,c:[...]}
 * tree; this loader maps it to the RPC's {n,a,i:[{d,a,aa,f,e}]} shape:
 *   - revenue (flat): each root child -> {n, a, i:[{d:n, a, aa:null, f:null, e:null}]}.
 *   - operating (2-level): a root child WITH a nested `.c` array (Current,
 *     Debt service) -> {n, a, i: c.map(gc => ({d:gc.n, a:gc.a, aa:null,
 *     f:null, e:null}))} -- the i[] entries are the drill-down leaves the
 *     icicle expands into. A root child with NO `.c` (Capital outlay,
 *     Capital projects) -> {n, a, i:[{d:n, a, aa:null, f:null, e:null}]}
 *     (single-item leaf, same shape as revenue).
 *   This "multiple leaf items under one category" pattern is the established
 *   contract for a 2-level RPC tree (see scripts/processPortland.js
 *   buildOperatingTree, scripts/loadFederalAgencies.js `node.i = ...map(...)`)
 *   -- confirmed against the live `_treasury_insert_tree` helper's dual `c`
 *   (recurse into child budget_categories) / `i` (leaf budget_line_items)
 *   contract.
 *
 * Provenance (CONTEXT 129 D-06/D-07/D-09, `processAZAcfr.js` pattern):
 *   - data_sources rows are EPHEMERAL -- one row per dataset_type (operating |
 *     revenue), created fresh at the start of a live run, deleted at the end
 *     (WR-05/LOAD-01 -- budgets rows carry the durable text-stamp provenance,
 *     so a persistent data_sources row is unreferenceable residue).
 *   - Every loaded budgets row is stamped, post-sync, with a durable
 *     source_url (the per-FY tucsonaz.gov PDF pinned in 128-RECON.md) and
 *     source_date = the fiscal-year end (June 30, <FY> -- no fabricated issue
 *     date, per D-09).
 *
 * Idempotency (D-05): a per-(data_source_id, fiscal_year) pre-load delete
 * runs before every RPC call; the RPC itself also upserts on
 * (municipality_id, fiscal_year, dataset_type), so a second full run nets 0
 * row-count / total change.
 *
 * Security (T-129-02):
 *   (a) shell injection -- extractPDF() calls spawnSync with an ARGS ARRAY,
 *       never a shell string; PDF paths come from a controlled
 *       docs/Tucson/ readdir (discoverPdfsByFY), never from user input.
 *   (b) silent mis-parse -- the extractor's own tie_delta==0 gate (non-zero
 *       exit aborts the FY) PLUS an independent assertion here that the
 *       mapped-tree total equals the extractor's computed_total.
 *   (c) overwrite / stale rows on re-run -- source-safe
 *       treasury_sync_budget_tree only, with the pre-load delete above.
 *   (d) parse blow-up -- a per-FY sanity ceiling (SANITY_MAX, $2B) aborts the
 *       whole run rather than loading an implausible figure.
 *   (e) data_sources residue -- ephemeral create/delete lifecycle (WR-05).
 *
 * ENVIRONMENT NOTE (Rule 3 auto-fix, this machine): `python` on PATH resolves
 * to the non-functional Microsoft Store app-execution-alias stub; the
 * working Windows launcher is `py -3`. extractPDF() detects win32 and uses
 * `py -3` instead of the `python`/`python3` convention used by sibling city
 * loaders (processGresham.js et al.) -- this is a local PATH quirk, not a
 * project-wide convention change.
 *
 * Usage:
 *   node scripts/processTucson.js --dry-run                # operating dry-run, all FYs
 *   node scripts/processTucson.js --revenue --dry-run       # revenue dry-run, all FYs
 *   node scripts/processTucson.js                           # LIVE load operating, all FYs
 *   node scripts/processTucson.js --revenue                 # LIVE load revenue, all FYs
 *   node scripts/processTucson.js --fy 2024                 # single FY (flaky-connection retry loop)
 *   node scripts/processTucson.js --revenue --fy 2024
 *
 * Requires: `pdftotext -table` (poppler) on PATH; Tucson + Pima County seeded
 *   via scripts/seedTucsonArizona.js (Phase 129-01) first.
 */

import { spawnSync, execSync } from 'node:child_process';
import { createClient }        from '@supabase/supabase-js';
import { parseArgs }           from 'node:util';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                    from 'node:path';
import { fileURLToPath }       from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');

// ── .env loader (so a live run works with just `node scripts/processTucson.js`) ──
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

// ── Resolve PDF directory (worktree-safe, processGresham.js pattern) ──────────
// docs/Tucson/*.pdf is gitignored (docs/*); a worktree can't see it -- fall
// back to the main working tree's docs/Tucson/ via git-common-dir.
function resolvePdfDir() {
  const candidate = path.join(ROOT, 'docs', 'Tucson');
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', 'Tucson');
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* not a git repo -- ignore */ }
  return candidate;
}

// ── Discover PDFs by fiscal year from a controlled docs/Tucson/ readdir ──────
// Never construct a path by interpolating an untrusted string -- filenames
// come from the directory listing itself, matched against the known pattern.
function discoverPdfsByFY(pdfDir) {
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  for (const f of files) {
    const m = f.match(/^cot-(\d{4})-acfr\.pdf$/i);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Fixed facts ────────────────────────────────────────────────────────────────
const FYS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const POPULATION = 554013; // Census Vintage 2024, matches scripts/seedTucsonArizona.js
const SANITY_MAX = 2_000_000_000; // T-129-02(d): abort if a GF total is implausibly large

// Durable per-FY tucsonaz.gov PDF URLs (128-RECON.md, all HTTP 200 application/pdf,
// verified 2026-07-10) -- stamped onto every loaded budgets row as source_url.
const URLS = {
  2024: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/cot-2024-annual-comprehensive-financial-report.pdf',
  2023: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/city-of-tucson-fy-2023-annual-comprehensive-financial-report-final.pdf',
  2022: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/acfr-2021-2022.pdf',
  2021: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/city-services/business-services/documents/city_of_tucson_annual_comprehensive_financial_report_fy_2020-2021_0.pdf',
  2020: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2020.pdf',
  2019: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2019.pdf',
  2018: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2018.pdf',
  2017: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2016-2017-acfr.pdf',
  2016: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2015-2016-acfr.pdf',
  2015: 'https://www.tucsonaz.gov/files/sharedassets/public/v/1/bsd/documents/finance-documents/2014-2015-acfr.pdf',
};

// ── Run the Python extractor, return parsed JSON (or throw) ───────────────────
function extractPDF(pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', 'extractTucson.py');
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin
    ? ['-3', pyScript, pdfPath, '--mode', mode]
    : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `extractTucson.py failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
      `${(result.stderr || result.error?.message || '').slice(0, 500)}`
    );
  }
  return JSON.parse(result.stdout);
}

// ── Map the extractor's {n,a,c:[...]} tree to the RPC's {n,a,i:[...]} shape ───
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
        // Current / Debt service -- children become the drill-down leaves.
        return {
          n: child.n,
          a: child.a,
          i: child.c.map(gc => ({ d: gc.n, a: gc.a, aa: null, f: null, e: null })),
        };
      }
      // Capital outlay / Capital projects -- root-level leaf, single item.
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
  return `City of Tucson ACFR — General Fund ${kind} (FY${fy} actual, GAAP basis)`;
}

// ── Resolve Tucson's municipality_id; refuse to write if not found ────────────
async function ensureMunicipality(supabase) {
  const { data, error } = await supabase.schema('treasury')
    .from('municipalities')
    .select('id, name, population')
    .eq('name', 'Tucson')
    .eq('state', 'AZ')
    .eq('entity_type', 'city')
    .maybeSingle();

  if (error) { console.error('  ERROR resolving Tucson municipality:', error.message); process.exit(2); }
  if (!data?.id) {
    console.error('  Tucson, AZ (entity_type=city) municipality not found — run scripts/seedTucsonArizona.js first');
    process.exit(2);
  }
  console.log(`  Municipality: Tucson, AZ (${data.id})`);
  return data;
}

// ── Ephemeral data_sources lifecycle (WR-05/LOAD-01, processAZAcfr.js pattern) ─
async function createEphemeralDataSource(supabase, muniId, datasetType) {
  const datasetId = datasetType === 'revenue' ? 'tucson-acfr-gf-revenue' : 'tucson-acfr-gf-operating';
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  const payload = {
    name: `Tucson General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: 'https://www.tucsonaz.gov/Departments/Business-Services-Department/Accounting-and-Finance/Annual-Comprehensive-Financial-Reports',
    fiscal_years: FYS,
    municipality_id: muniId,
  };
  // Delete any prior row for this dataset_id first (ephemeral -- never accumulates).
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
  // Pre-load delete for idempotency (defense-in-depth ahead of the RPC's own
  // upsert). Keyed on (municipality_id, fiscal_year, dataset_type) -- the
  // columns that actually identify the target row. NOTE: budgets.data_source_id
  // FKs treasury.source_registry, not treasury.data_sources, and
  // treasury_sync_budget_tree never sets it (always NULL), so a dsId-keyed
  // delete could never match a row (WR-01).
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

  // Source stamp (D-07/D-09): durable source_url + honest fiscal-year-end source_date.
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

// ── Process one mode (operating | revenue) across the requested FY window ────
async function processMode(supabase, muniId, dryRun, mode, targetFY, pdfsByFY) {
  const datasetType = mode === 'revenue' ? 'revenue' : 'operating';
  const years = targetFY ? [targetFY] : FYS;

  let ds = null;
  if (!dryRun) ds = await createEphemeralDataSource(supabase, muniId, datasetType);

  for (const fy of years) {
    const pdfPath = pdfsByFY.get(fy);
    console.log(`\n── FY${fy} ${mode} ${'─'.repeat(40)}`);
    if (!pdfPath) {
      console.error(`  No PDF found for FY${fy} in docs/Tucson/ — aborting`);
      process.exit(2);
    }

    let extracted;
    try {
      extracted = extractPDF(pdfPath, mode);
    } catch (e) {
      console.error(`  Extract failed: ${e.message}`);
      process.exit(2); // fail loud -- never load partial/mis-parsed data (T-129-02b)
    }

    if (extracted.tie_delta !== 0) {
      // extractTucson.py already exits non-zero on a tie failure -- this
      // branch guards against any future change that stops doing that.
      console.error(`  TIE FAILURE FY${fy} (${mode}): delta ${extracted.tie_delta} — aborting`);
      process.exit(2);
    }

    const { tree, total, rowCount } = toBudgetTree(extracted.tree, mode);

    if (total !== extracted.computed_total) {
      console.error(`  Mapped-tree total $${total.toLocaleString()} != extractor computed_total ` +
        `$${extracted.computed_total.toLocaleString()} — aborting`);
      process.exit(2);
    }
    if (total > SANITY_MAX) {
      console.error(`  SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds $2B ceiling — aborting`);
      process.exit(2);
    }

    console.log(`  Total: $${total.toLocaleString()}  (${tree.length} categories, ${rowCount} line items)`);
    console.log(`  Per-capita: $${(total / POPULATION).toFixed(2)}/resident`);
    for (const n of tree) {
      const suffix = n.i.length > 1 ? ` (${n.i.length} items: ${n.i.map(i => i.d).join(', ')})` : '';
      console.log(`    ${n.n}: $${n.a.toLocaleString()}${suffix}`);
    }

    if (dryRun) {
      console.log(`  [dry-run] fiscal_year=${fy} dataset_type=${datasetType} row_count=${rowCount} total=$${total.toLocaleString()}`);
      continue;
    }

    const ok = await loadFiscalYear(supabase, muniId, ds.id, fy, datasetType, tree, total, rowCount);
    if (!ok) { console.error(`  FY${fy} (${mode}) load failed — aborting`); process.exit(2); }
  }

  if (!dryRun && ds) {
    await deleteEphemeralDataSource(supabase, ds.id);
    console.log(`\ndata_source ${ds.id} deleted (ephemeral cleanup — 0 residue, WR-05/LOAD-01)`);
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

  const pdfDir = resolvePdfDir();
  const pdfsByFY = discoverPdfsByFY(pdfDir);
  if (!pdfsByFY.size) {
    console.error(`No Tucson ACFR PDFs found in ${pdfDir}`);
    process.exit(1);
  }

  console.log(`Tucson Budget Loader${dryRun ? ' (dry-run)' : ''} [${mode}]`);
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
