/**
 * Shared WA State Auditor GF budget-loader core.
 *
 * Ports the proven scripts/processSeattle.js shape (itself the model for
 * scripts/processKingCounty.js) into a single parameterised module so that
 * Bainbridge Island and Kitsap County do not become a third and fourth
 * ~460-line near-duplicate. scripts/processSeattle.js and
 * scripts/processKingCounty.js are shipped, verified, and left UNTOUCHED --
 * this is a NEW file; there is zero regression risk to either entity.
 *
 * Every Seattle-specific constant (POPULATION, FYS, SANITY_MAX, the
 * SEATTLE_URLS lookup, the seattle-acfr-gf-* dataset ids, docs/Seattle,
 * extractSeattle.py, the ^seattle-(\d{4})-acfr\.pdf$ filename regex) becomes
 * a field on the entity descriptor passed to loadEntity(). See the
 * `EntityDescriptor` typedef below for the full field list.
 *
 * DELIBERATE DEVIATION FROM THE SEATTLE/KING COUNTY MODEL
 * --------------------------------------------------------
 * processSeattle.js / processKingCounty.js are single-mode CLI scripts: one
 * invocation processes ONE dataset_type (--revenue or the operating
 * default) across a FY window, and a per-FY hard failure THROWS out of the
 * loop, aborting every remaining FY in that run (main()'s top-level .catch
 * turns it into process.exit(2)).
 *
 * loadEntity() instead processes BOTH dataset types (operating + revenue)
 * for the requested FY window in a single call and returns an aggregate
 * `{ loaded, failed }` count. A per-FY failure is caught LOCALLY inside the
 * loop, logged loudly, and counted as `failed` -- it does NOT abort the
 * remaining years, so one bad year in an 18-20 year batch does not prevent
 * every other year from loading and does not prevent a complete diagnostic
 * list from being produced in one run.
 *
 * BUT: under this descriptor's own design every FY in `fiscalYears` is
 * expected to succeed -- known-bad years (Bainbridge FY2006/FY2009, Kitsap
 * FY2017-2019) are excluded from `fiscalYears` upstream by the caller and
 * never enter the loop. So `failed > 0` is ALWAYS a real error, never an
 * expected outcome, and a caller that only checks "did the promise resolve"
 * must not be able to mistake a partial, silently-incomplete load for a
 * clean one. loadEntity() therefore THROWS after both dataset types finish
 * if `failed > 0`, UNLESS the descriptor explicitly opts in with
 * `allowPartial: true`. The per-FY catch buys diagnostics; this final gate
 * is what makes that catch safe rather than a silent-data-loss trap (a
 * per-FY failure in loadFiscalYear happens AFTER that FY's previously
 * published row has already been deleted by the pre-load delete, so
 * swallowing the failure would leave the row silently GONE with nothing
 * republished in its place).
 *
 * Every individual guard ported from the reference (FY-vs-filename
 * cross-check, tie_delta==0 gate, mapped-total == computed_total, sanity
 * ceiling, per-capita plausibility band, and the source_url validation added
 * in this round) still THROWS internally and still prevents that one row
 * from ever reaching the RPC -- only the *loop-level* control flow differs
 * from the reference, and the final aggregate throw restores the
 * reference's "an operator cannot miss this" guarantee at the loadEntity()
 * level instead of the per-FY level. Systemic setup failures (no PDFs
 * discovered at all, municipality not found, missing Supabase key in a live
 * run, an invalid sourceUrlFor for an ephemeral data_source's base_url) are
 * NOT per-FY-recoverable and still throw immediately, same as the
 * reference.
 *
 * The ephemeral `data_sources` create/delete (WR-05/LOAD-01) stays in a
 * try/finally per dataset_type exactly as in the reference, and internal
 * hard-fails still THROW rather than calling process.exit(), so the finally
 * always runs and never leaves a stray row behind.
 *
 * Write path: treasury_sync_budget_tree ONLY -- never
 * treasury_sync_city_budget, which overwrites existing (muni, fy, dataset)
 * rows and keeps a stale data_source label (see auto-memory
 * project_sync_city_budget_not_source_safe).
 *
 * This module does not read argv and does not call process.exit(). It is a
 * library: the caller (Task 8's per-entity script) parses its own CLI flags
 * and builds the descriptor.
 */

import { spawnSync, execSync } from 'node:child_process';
import { createClient }        from '@supabase/supabase-js';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import path                    from 'node:path';
import { fileURLToPath }       from 'node:url';
// ⚠ REQUIRED SINCE THE COLUMN DEFAULT WAS DROPPED. `treasury.data_sources`
// .fiscal_year_start_month used to be NOT NULL DEFAULT 1, and the ephemeral row
// created below never set it — so it silently inherited January, which happens to
// be right for Washington. The default is gone, so that insert now REFUSES and
// the month has to be stated. RCW citations live in the library.
import { monthForWAEntity }    from './waFiscalCalendar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..', '..'); // scripts/lib -> scripts -> repo root

/**
 * @typedef {Object} EntityDescriptor
 * @property {string} entityName        - 'Bainbridge Island' | 'Kitsap County'. Used for
 *                                         the municipalities lookup (name + state='WA'),
 *                                         the data_sources row name, and dataSourceLabel().
 * @property {(fy: number) => string} extractorFor
 *                                       - Selects which extractor script (a scripts/*.py
 *                                         filename) to run for a given fiscal year. NOT a
 *                                         fixed string: Bainbridge alone needs two
 *                                         extractors (extractBainbridge.py for
 *                                         FY2010-2025, extractBainbridgeEarly.py for
 *                                         FY2004/2005/2007/2008). Build one with
 *                                         makeExtractorSelector() below.
 * @property {string} pdfDir            - Repo-relative PDF directory, e.g.
 *                                         'docs/BainbridgeIsland'. Forward- or
 *                                         back-slash both accepted.
 * @property {string} pdfPrefix         - e.g. 'bainbridge' | 'kitsap'. The filename regex
 *                                         is built as
 *                                         new RegExp('^' + pdfPrefix + '-(\\d{4})-acfr\\.pdf$', 'i').
 * @property {number[]} fiscalYears     - The full loaded FY window for this entity.
 * @property {number} population        - WA OFM population used for the per-capita guard
 *                                         AND for dry-run per-capita display.
 * @property {[number, number]} perCapitaBand
 *                                       - [lo, hi] plausible GF-total-per-resident band.
 *                                         Re-derive per entity -- do NOT reuse Seattle's
 *                                         [500, 25000]; see checkPerCapita().
 * @property {string} datasetIdPrefix   - e.g. 'bainbridge-sao-gf'. Ephemeral data_sources
 *                                         dataset_id = `${datasetIdPrefix}-${datasetType}`.
 * @property {(fy: number) => string} sourceUrlFor
 *                                       - Resolves the per-FY source PDF URL actually
 *                                         fetched (never retyped).
 * @property {number} sanityMax         - Per-FY total ceiling; a total above this aborts
 *                                         that FY.
 * @property {boolean} dryRun           - No DB writes; still runs extraction + all guards.
 * @property {number|null} targetFY     - Restrict to a single FY, or null for the whole
 *                                         fiscalYears window.
 * @property {boolean} [allowPartial]   - Default false/absent. loadEntity() THROWS if
 *                                         any FY/dataset failed unless this is exactly
 *                                         `true` -- see the module header. Not set by
 *                                         either real entity's descriptor; exists only
 *                                         so a caller can deliberately opt into an
 *                                         incomplete-load result instead of an aborted
 *                                         run (e.g. exploratory / partial reruns).
 */

// ── .env loader (ported verbatim from processSeattle.js) ────────────────────
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
// docs/<Entity>/*.pdf is gitignored (docs/*); a worktree can't see it -- fall
// back to the main working tree's docs/<Entity>/ via git-common-dir.
export function resolvePdfDir(pdfDir) {
  const parts = pdfDir.split(/[\\/]+/).filter(Boolean);
  const candidate = path.join(ROOT, ...parts);
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, ...parts);
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* not a git repo -- ignore */ }
  return candidate;
}

// ── Filename regex, built from pdfPrefix (task-7-brief.md Step 2.3) ─────────
export function buildFilenameRegex(pdfPrefix) {
  return new RegExp('^' + pdfPrefix + '-(\\d{4})-acfr\\.pdf$', 'i');
}

// ── Discover PDFs by fiscal year from a controlled readdir ───────────────────
export function discoverPdfsByFY(pdfDir, pdfPrefix) {
  const re = buildFilenameRegex(pdfPrefix);
  const files = readdirSync(pdfDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const map = new Map();
  for (const f of files) {
    const m = f.match(re);
    if (m) map.set(parseInt(m[1], 10), path.join(pdfDir, f));
  }
  return map;
}

// ── Extractor selection by fiscal year ───────────────────────────────────────
// A single fixed `extractorScript` string does not survive contact with
// Bainbridge, which needs a different extractor for FY2004/2005/2007/2008
// (extractBainbridgeEarly.py) than for FY2010-2025 (extractBainbridge.py).
// makeExtractorSelector builds a `(fy) => scriptName` function: `overrides`
// maps specific fiscal years to a non-default script; every other year gets
// `defaultScript`. Kitsap uses this with no overrides at all (one extractor
// for its whole FY2004-2024 window).
export function makeExtractorSelector(defaultScript, overrides = {}) {
  return (fy) => Object.prototype.hasOwnProperty.call(overrides, fy) ? overrides[fy] : defaultScript;
}

// ── Supabase ──────────────────────────────────────────────────────────────────
function supabaseUrl() {
  return process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
}
function supabaseKey() {
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// ── Run the Python extractor, return parsed JSON (or throw) ───────────────────
function extractPDF(scriptName, pdfPath, mode) {
  const pyScript = path.join(ROOT, 'scripts', scriptName);
  const isWin = process.platform === 'win32';
  const pythonBin = isWin ? 'py' : 'python3';
  const args = isWin
    ? ['-3', pyScript, pdfPath, '--mode', mode]
    : [pyScript, pdfPath, '--mode', mode];
  const result = spawnSync(pythonBin, args, { maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      `${scriptName} failed (exit ${result.status}) for ${pdfPath} [--mode ${mode}]: ` +
      `${(result.stderr || result.error?.message || '').slice(0, 500)}`
    );
  }
  return JSON.parse(result.stdout);
}

// ── Map the extractor tree to the RPC's {n,a,i:[...]} shape ──────────────────
// Identical rule to processSeattle.js / processKingCounty.js: a root child
// WITH a nested, non-empty `.c` array maps to {n, a, i:[...children]}; a
// root child with NO `.c` maps to a single-item leaf. Both Bainbridge (Current
// is the only parent; Debt Service - Principal/Interest and Capital Outlay
// are valued root leaves) and Kitsap (Current + Debt Service are parents,
// Capital Outlay is a valued root leaf) are handled by this one rule without
// special-casing which root child has which shape.
export function toBudgetTree(extractorTree) {
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

// ── data_source label (task-7-brief.md Step 2.4) ─────────────────────────────
export function dataSourceLabel(entityName, fy, datasetType) {
  const kind = datasetType === 'revenue' ? 'Revenue by Source' : 'Expenditure by Function';
  return `WA State Auditor — ${entityName} Annual Financial Report FY${fy} (General Fund, ${kind})`;
}

// ── Per-capita plausibility guard ────────────────────────────────────────────
// The tie gate is unit-invariant: it reads $0 whether or not a x1000
// multiplier was (wrongly) applied, or (as here) wrongly OMITTED -- Bainbridge
// and Kitsap print WHOLE DOLLARS (units=1), the opposite of Seattle/King
// County's thousands. Per-capita is the cheapest oracle that is NOT
// unit-invariant. The band is a descriptor field, re-derived per entity --
// Seattle's [500, 25000] would REJECT a correct Kitsap load (~$444-486/resident
// because most county services run through enterprise/special-revenue funds
// outside the General Fund). See task-7-brief.md for the worked numbers.
export function checkPerCapita(total, population, band, fy, datasetType) {
  const [lo, hi] = band;
  const perCapita = total / population;
  if (perCapita < lo || perCapita > hi) {
    throw new Error(
      `FY${fy} ${datasetType}: $${perCapita.toFixed(2)}/resident is outside the ` +
      `plausible band [${lo}, ${hi}]. Total=$${total.toLocaleString()}, pop=${population}. ` +
      `This is almost certainly a units error -- check the extractor's units setting.`);
  }
  return perCapita;
}

// ── Resolve + validate a per-FY source URL, or throw ────────────────────────
// C-1/I-1 fix: `descriptor.sourceUrlFor(fy)` returning a falsy value must
// never silently result in a published row with no source_url (or an
// ephemeral data_source with a fabricated base_url) -- this app's
// always-sourced invariant is the whole point. Every call site resolves the
// URL through here BEFORE touching any row, so a bad descriptor can never
// cause a delete-then-publish-with-no-source sequence.
export function requireSourceUrl(sourceUrlFor, fy, context) {
  const url = sourceUrlFor(fy);
  if (!url) {
    throw new Error(`${context}: sourceUrlFor(${fy}) returned a falsy value -- refusing to write a row with no source_url`);
  }
  return url;
}

// ── Resolve the entity's municipality_id; refuse to write if not found ──────
// Looks the entity up by name + state='WA' rather than a hard-coded id
// (task-7-brief.md Step 2.5). Warns -- does not fail -- if the DB population
// differs from the descriptor's, so a real refresh is visible rather than
// silently masked or fatal.
async function ensureMunicipality(treasuryClient, entityName, population) {
  const { data, error } = await treasuryClient
    .from('municipalities')
    .select('id, name, population')
    .eq('name', entityName)
    .eq('state', 'WA')
    .single();
  if (error || !data) {
    throw new Error(`ensureMunicipality: could not resolve ${entityName}, WA: ${error?.message ?? '(no row)'}`);
  }
  console.log(`  Municipality: ${entityName}, WA (${data.id}), DB population ${Number(data.population).toLocaleString()} (guard uses descriptor population ${population.toLocaleString()})`);
  if (Number(data.population) !== population) {
    console.error(`  WARNING: DB population (${data.population}) != descriptor population (${population}) -- update the descriptor if this is a real refresh.`);
  }
  return data;
}

// ── Ephemeral data_sources lifecycle (WR-05/LOAD-01) ─────────────────────────
async function createEphemeralDataSource(treasuryClient, muniId, datasetType, descriptor) {
  const datasetId = `${descriptor.datasetIdPrefix}-${datasetType}`;
  const kind = datasetType === 'revenue' ? 'Revenue' : 'Operating';
  // I-1 fix: no silent fallback to a generic SAO origin. If the descriptor's
  // sourceUrlFor can't produce a valid URL even for its own first fiscal
  // year, that is a descriptor misconfiguration -- a systemic setup failure,
  // not a per-FY content issue -- and this throws all the way out of
  // loadEntity() rather than publishing an ephemeral data_source with a
  // fabricated base_url.
  const firstFy = descriptor.fiscalYears[0];
  const sampleUrl = requireSourceUrl(descriptor.sourceUrlFor, firstFy, `createEphemeralDataSource base_url (${datasetType})`);
  let baseUrl;
  try {
    baseUrl = new URL(sampleUrl).origin;
  } catch (e) {
    throw new Error(`createEphemeralDataSource base_url (${datasetType}): sourceUrlFor(${firstFy}) returned an invalid URL "${sampleUrl}": ${e.message}`);
  }
  // ⚠ The month is REQUIRED here since the column default was dropped, and
  // `treasury_sync_budget_tree` copies it off this row onto every budgets row it
  // creates — so an omission here is what silently stamped a fiscal calendar
  // nobody had established. It is resolved from the municipality's own
  // `entity_type` as recorded in the database rather than from the descriptor,
  // because that is the fact the statute keys on (RCW 1.16.030 distinguishes
  // school districts from all other taxing districts), and a descriptor can drift
  // from it. `monthForWAEntity` THROWS on an unestablished type.
  const { data: muni, error: muniErr } = await treasuryClient
    .from('municipalities').select('name, state, entity_type').eq('id', muniId).single();
  if (muniErr || !muni) {
    throw new Error(`createEphemeralDataSource: could not resolve municipality ${muniId}: `
      + `${muniErr?.message ?? '(no row)'}`);
  }
  const fiscalYearStartMonth = monthForWAEntity(muni);

  const payload = {
    name: `${descriptor.entityName} General Fund ${kind} Budget`,
    api_type: 'pdf_download',
    dataset_type: datasetType,
    dataset_id: datasetId,
    base_url: baseUrl,
    fiscal_years: descriptor.fiscalYears,
    municipality_id: muniId,
    fiscal_year_start_month: fiscalYearStartMonth,
  };
  await treasuryClient.from('data_sources').delete().eq('dataset_id', datasetId);
  const { data, error } = await treasuryClient.from('data_sources').insert(payload).select().single();
  if (error) throw new Error(`data_source insert failed: ${error.message}`);
  console.log(`  data_source created (ephemeral): ${data.id} [${datasetId}]`);
  return data;
}

async function deleteEphemeralDataSource(treasuryClient, dsId) {
  const { error } = await treasuryClient.from('data_sources').delete().eq('id', dsId);
  if (error) console.error('  WARNING: ephemeral data_source cleanup failed:', error.message);
}

// ── Load one fiscal year, then source-stamp the resulting budgets row ────────
async function loadFiscalYear(treasuryClient, publicClient, muniId, dsId, fy, datasetType, tree, total, rowCount, descriptor) {
  // C-1/I-1 fix: resolve + validate the source URL BEFORE touching any row.
  // Doing this ahead of the pre-load delete means a bad sourceUrlFor(fy) can
  // never cause the previously-published row to be deleted and then left
  // unstamped (or restamped with a NULL source_url, which PostgREST would
  // otherwise accept silently -- JSON.stringify simply drops an `undefined`
  // key, leaving the column NULL while this function still logged success).
  let sourceUrl;
  try {
    sourceUrl = requireSourceUrl(descriptor.sourceUrlFor, fy, `FY${fy} (${datasetType})`);
  } catch (e) {
    console.error('    Source URL resolution failed:', e.message);
    return false;
  }

  // Pre-load delete keyed on the columns that actually identify the target
  // row. NOTE: budgets.data_source_id FKs treasury.source_registry (not
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
    source_url:  sourceUrl,
    source_date: `${fy}-12-31`,
    data_source: dataSourceLabel(descriptor.entityName, fy, datasetType),
  }).eq('id', bud.id);
  if (stampErr) { console.error('    Source stamp failed:', stampErr.message); return false; }
  console.log(`    Stamped source_url + source_date=${fy}-12-31`);
  return true;
}

// ── Process one dataset_type across the requested FY window ──────────────────
// Per-FY failures are caught HERE, logged, and counted -- they do not abort
// the remaining years in this dataset_type (see module header). The ephemeral
// data_sources row is still created/deleted in a try/finally around the
// whole loop, so a per-FY failure (or a thrown systemic one) never leaves a
// stray row behind.
async function processDatasetType(treasuryClient, publicClient, muniId, dryRun, datasetType, years, pdfsByFY, descriptor) {
  const { entityName, extractorFor, sanityMax, perCapitaBand, population } = descriptor;
  let loaded = 0, failed = 0;
  const failedYears = [];

  let ds = null;
  if (!dryRun) ds = await createEphemeralDataSource(treasuryClient, muniId, datasetType, descriptor);

  try {
    for (const fy of years) {
      console.log(`\n── FY${fy} ${datasetType} (${entityName}) ${'─'.repeat(20)}`);
      try {
        const pdfPath = pdfsByFY.get(fy);
        if (!pdfPath) throw new Error(`No PDF found for FY${fy} — aborting this year`);

        const scriptName = extractorFor(fy);
        let extracted;
        try {
          extracted = extractPDF(scriptName, pdfPath, datasetType);
        } catch (e) {
          throw new Error(`Extract failed: ${e.message}`);
        }

        // Fiscal-year cross-check: the extractor's reported fiscal_year must
        // match the year encoded in the PDF's own filename. Rows key on
        // (municipality_id, fiscal_year, dataset_type), so a wrong year would
        // silently overwrite a DIFFERENT year's row (the defect originally
        // found live on King County's FY2024 ACFR). NOT optional.
        if (extracted.fiscal_year !== fy) {
          throw new Error(`FY mismatch: ${path.basename(pdfPath)} reports fiscal_year ` +
            `${extracted.fiscal_year}, expected ${fy}`);
        }
        // A non-zero delta is fatal UNLESS it exactly matches a
        // source-rounding case pre-registered in the extractor's shared
        // config; the extractor only sets source_rounding_accepted on an
        // exact match, so this cannot widen into a general tolerance.
        if (extracted.tie_delta !== 0 && extracted.source_rounding_accepted !== extracted.tie_delta) {
          throw new Error(`TIE FAILURE FY${fy} (${datasetType}): delta ${extracted.tie_delta}`);
        }

        const { tree, total, rowCount } = toBudgetTree(extracted.tree);

        if (total !== extracted.computed_total) {
          throw new Error(`Mapped-tree total $${total.toLocaleString()} != extractor computed_total ` +
            `$${extracted.computed_total.toLocaleString()}`);
        }
        if (total > sanityMax) {
          throw new Error(`SANITY FAIL FY${fy}: total $${total.toLocaleString()} exceeds ceiling $${sanityMax.toLocaleString()}`);
        }

        const perCapita = checkPerCapita(total, population, perCapitaBand, fy, datasetType);

        console.log(`  Total: $${total.toLocaleString()}  (${tree.length} categories, ${rowCount} line items)`);
        console.log(`  Per-capita: $${perCapita.toFixed(2)}/resident`);
        if (extracted.zero_rows?.length) {
          console.log(`  $0 GF rows dropped: ${extracted.zero_rows.join(', ')}`);
        }
        for (const n of tree) {
          const suffix = n.i.length > 1 ? ` (${n.i.length} items: ${n.i.map(i => i.d).join(', ')})` : '';
          console.log(`    ${n.n}: $${n.a.toLocaleString()}${suffix}`);
        }

        if (dryRun) {
          console.log(`  [dry-run] fiscal_year=${fy} dataset_type=${datasetType} row_count=${rowCount} total=$${total.toLocaleString()}`);
          loaded++;
          continue;
        }

        const ok = await loadFiscalYear(treasuryClient, publicClient, muniId, ds.id, fy, datasetType, tree, total, rowCount, descriptor);
        if (!ok) throw new Error(`FY${fy} (${datasetType}) load failed`);
        loaded++;
      } catch (e) {
        console.error(`  FAILED FY${fy} ${datasetType}: ${e.message}`);
        failed++;
        failedYears.push(`FY${fy} ${datasetType}`);
      }
    }
  } finally {
    if (!dryRun && ds) {
      await deleteEphemeralDataSource(treasuryClient, ds.id);
      console.log(`data_source ${ds.id} deleted (ephemeral cleanup — 0 residue, WR-05/LOAD-01)`);
    }
  }

  return { loaded, failed, failedYears };
}

// ── Public entry point ────────────────────────────────────────────────────────
/**
 * Load one WA SAO entity's General Fund operating + revenue budgets across
 * its full fiscal-year window (or a single --fy).
 *
 * Rejects (throws) if any FY/dataset_type failed, UNLESS
 * `descriptor.allowPartial === true` -- see the module header for why a
 * per-FY catch alone would be unsafe on the write path. Resolves normally
 * with `{ loaded, failed: 0 }` on a fully clean run, or with `{ loaded,
 * failed }` (failed > 0) only when `allowPartial` was explicitly set.
 *
 * @param {EntityDescriptor} descriptor
 * @returns {Promise<{ loaded: number, failed: number }>}
 */
export async function loadEntity(descriptor) {
  const { entityName, pdfDir, pdfPrefix, fiscalYears, population, dryRun, targetFY } = descriptor;

  if (targetFY && !fiscalYears.includes(targetFY)) {
    throw new Error(`--fy ${targetFY} is outside ${entityName}'s loaded window (${fiscalYears.join(', ')})`);
  }

  const resolvedPdfDir = resolvePdfDir(pdfDir);
  const pdfsByFY = discoverPdfsByFY(resolvedPdfDir, pdfPrefix);
  if (!pdfsByFY.size) {
    throw new Error(`No ${entityName} ACFR PDFs found in ${resolvedPdfDir}`);
  }

  console.log(`${entityName} Budget Loader${dryRun ? ' (dry-run)' : ''}`);
  console.log(`PDF dir: ${resolvedPdfDir}`);
  console.log(`PDFs discovered: ${pdfsByFY.size} (FY ${[...pdfsByFY.keys()].sort().join(', ')})`);

  let treasuryClient = null, publicClient = null, muniId = null;
  if (!dryRun) {
    const key = supabaseKey();
    if (!key) throw new Error('Missing SUPABASE_SERVICE_KEY');
    // getSeattleId/getKingCountyId expect a client already scoped to the
    // `treasury` schema; an unscoped client would silently query the wrong
    // schema. The RPC lives in the public schema, so a second, default-schema
    // client is used for it, mirroring processSeattle.js's own
    // treasuryClient/publicClient split.
    treasuryClient = createClient(supabaseUrl(), key, { db: { schema: 'treasury' } });
    publicClient   = createClient(supabaseUrl(), key);
    const muni = await ensureMunicipality(treasuryClient, entityName, population);
    muniId = muni.id;
  }

  const years = targetFY ? [targetFY] : fiscalYears;

  let loaded = 0, failed = 0;
  const failedYears = [];
  for (const datasetType of ['operating', 'revenue']) {
    const result = await processDatasetType(treasuryClient, publicClient, muniId, dryRun, datasetType, years, pdfsByFY, descriptor);
    loaded += result.loaded;
    failed += result.failed;
    failedYears.push(...result.failedYears);
  }

  console.log(`\n${entityName} done. loaded=${loaded} failed=${failed}`);

  // C-1 fix: under this descriptor's own design, every FY in `fiscalYears`
  // is expected to succeed -- known-bad years (Bainbridge FY2006/FY2009,
  // Kitsap FY2017-2019) are excluded from the descriptor's fiscalYears
  // upstream and never enter this loop. So `failed > 0` is ALWAYS a real
  // error, never an expected outcome. Per-FY catching (see processDatasetType)
  // exists only to keep a bad year from sinking an otherwise-clean batch and
  // to produce a complete diagnostic list in one run -- it must NOT let the
  // caller mistake a partial, silently-incomplete load for a clean one.
  // loadEntity therefore rejects by default whenever any year failed. The
  // only way to get `{ loaded, failed }` back with failed > 0 is to opt in
  // explicitly via descriptor.allowPartial === true.
  if (failed > 0 && descriptor.allowPartial !== true) {
    throw new Error(
      `${entityName}: ${failed} fiscal-year/dataset load(s) failed and ` +
      `descriptor.allowPartial was not set -- refusing to resolve normally on ` +
      `a partial load. Failed: ${failedYears.join(', ')}. Pass ` +
      `descriptor.allowPartial = true to opt into a partial-load result.`);
  }

  return { loaded, failed };
}
