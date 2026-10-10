/**
 * NO SHEBANG — a test imports this module, and the repo guard refuses a
 * `#!` on any module a test reaches: a shebang plus CRLF breaks the whole
 * Vite suite with an error naming no file. Run it with `node <path>`.
 *
 * New York City ACFR -> treasury.budgets. FY2002-FY2025, TWO fund scopes.
 *
 * ⚠⚠ DELIBERATELY NOT BUILT ON scripts/lib/acfrGfLoad.mjs. Two reasons, both
 * verified 2026-10-09:
 *
 *   1. That loader's pre-load delete and its `treasury_sync_budget_tree` call
 *      key on (municipality_id, fiscal_year, dataset_type) with NO fund_scope.
 *      NYC publishes TWO scopes for the same city-year, so the
 *      total_governmental pass would DELETE the general_fund row it had just
 *      written.
 *   2. Its `dataSourceLabel()` hardcodes the words "General Fund" into the
 *      provenance string, which would be false on half of these rows.
 *
 * The model here is scripts/loadInCountyAcfrs.mjs, which is scope-aware.
 *
 * READER: `pdftotext -table` via scripts/extractNYC.py, for BOTH scopes.
 * The General Fund reads column 0 on the default `positional` strategy; the
 * Total Governmental column reads `target_column='last'` on `ordinal`, because
 * `positional` cannot anchor the mostly-empty Adjustments/Eliminations column
 * and lands one column short. See that wrapper's header.
 *
 * Usage:
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs --dry-run
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs --fy 2024
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs --scope general_fund
 *   node --env-file=.env scripts/loadNYCAcfrs.mjs
 */
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolvePython } from './lib/pythonBin.mjs';
import { NYC_FYS, nycAcfrUrl } from './lib/nycAcfrSources.mjs';
import { NYC_ENTITY } from './seedNewYorkCity.mjs';

export const FUND_SCOPES = ['general_fund', 'total_governmental'];
export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
/** July 1 - June 30. ⚠ Never left to the column default, which has lied. */
export const FISCAL_YEAR_START_MONTH = 7;
export const FY_END_MONTH_DAY = '06-30';

const SCOPE_FACE = new Map([
  ['general_fund', 'General Fund'],
  ['total_governmental', 'Total Governmental Funds'],
]);

const SCOPE_FLAG = new Map([
  ['general_fund', 'general'],
  ['total_governmental', 'total'],
]);

/** The extractor CLI value for a fund scope. */
export function scopeFlag(fundScope) {
  const f = SCOPE_FLAG.get(fundScope);
  if (!f) throw new Error(`unknown fund scope: ${fundScope}`);
  return f;
}

/** Everything one scope's run may write, and nothing else. */
export function sourcePrefixFor(fundScope) {
  const face = SCOPE_FACE.get(fundScope);
  if (!face) throw new Error(`unknown fund scope: ${fundScope}`);
  return `New York City ACFR — ${face}`;
}

export function sourceNameFor(datasetType, fiscalYear, fundScope) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${sourcePrefixFor(fundScope)} ${face} (FY${fiscalYear} actual, GAAP basis)`;
}

/** The `{n,a,c}` shape the RPC expects, from the extractor's own tree.
 *  ⚠ `toRpcTree` is module-private in loadInCountyAcfrs.mjs, so this is a
 *  local copy rather than an import. */
function toRpcTree(tree) {
  const node = (r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map(node) }
    : { n: r.n, a: r.a });
  return (tree.c || []).map(node);
}

/** Extract one (fy, mode, scope), REFUSING to return anything that does not
 *  tie at exactly $0. */
export function extractOrRefuse(fy, mode, fundScope) {
  const r = spawnSync(resolvePython(), [
    'scripts/extractNYC.py', `docs/NYC/nyc-${fy}-acfr.pdf`,
    '--mode', mode, '--scope', scopeFlag(fundScope),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  if (r.status !== 0) {
    console.error(`  FY${fy} ${mode} ${fundScope}: extractor exit ${r.status}`);
    console.error((r.stderr || '').slice(0, 400));
    process.exit(2);
  }
  let d;
  try { d = JSON.parse(r.stdout); } catch {
    console.error(`  FY${fy} ${mode} ${fundScope}: unparseable extractor output`);
    process.exit(2);
  }
  // ⚠⚠ THE GATE. A non-zero delta means the read is wrong; refuse to write.
  if (d.tie_delta !== 0) {
    console.error(`  FY${fy} ${mode} ${fundScope}: TIE FAILED, delta ${d.tie_delta}. Refusing to write.`);
    process.exit(2);
  }
  // ⚠ The extractor reads the year from the filename, so this is not a
  // tautology only because `select_fiscal_year` makes it assert the PRINTED
  // caption too -- a book that does not print the requested year exits 3.
  if (d.fiscal_year !== fy) {
    console.error(`  FY${fy} ${mode} ${fundScope}: extractor reports FY${d.fiscal_year}. Refusing.`);
    process.exit(2);
  }
  return d;
}

/**
 * ⚠ The ONLY check that can catch a wrong `units`. A units error ties at $0
 * because every figure on the page scales together. NYC's population is
 * ~8.48M; FY2024 General Fund spending of $105.27B is ~$12,400/capita. A
 * factor-of-1000 error lands at $12.42 or $12.4M per capita -- both absurd.
 */
export function assertPerCapitaPlausible(fy, mode, fundScope, totalDollars, population) {
  const perCapita = totalDollars / population;
  if (perCapita < 500 || perCapita > 60_000) {
    console.error(`  FY${fy} ${mode} ${fundScope}: $${perCapita.toFixed(0)}/capita is outside `
      + 'the plausible band [500, 60000]. This is what a wrong `units` looks like. '
      + 'Refusing to write.');
    process.exit(2);
  }
  return perCapita;
}

async function main() {
  const arg = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
  const dryRun = process.argv.includes('--dry-run');
  const onlyFy = arg('--fy') ? Number(arg('--fy')) : null;
  const onlyScope = arg('--scope');

  const fys = onlyFy ? [onlyFy] : NYC_FYS;
  const scopes = onlyScope ? [onlyScope] : FUND_SCOPES;
  for (const s of scopes) scopeFlag(s);   // validate early

  let db = null;
  let municipalityId = null;
  if (!dryRun) {
    const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
    db = createClient(url, key);

    const { data, error } = await db.schema('treasury').from('municipalities')
      .select('id, population').eq('name', NYC_ENTITY.name).eq('state', 'NY').maybeSingle();
    if (error) { console.error(`Entity lookup failed: ${error.message}`); process.exit(1); }
    if (!data?.id) {
      console.error(`${NYC_ENTITY.name} is not seeded. Run scripts/seedNewYorkCity.mjs first.`);
      process.exit(1);
    }
    municipalityId = data.id;
    if (!data.population) {
      console.error(`${NYC_ENTITY.name} has no population — the per-capita units guard cannot run. Refusing.`);
      process.exit(1);
    }
  }
  const population = NYC_ENTITY.population;

  let written = 0;
  let conflicts = 0;
  let checked = 0;

  for (const fundScope of scopes) {
    for (const fy of fys) {
      for (const datasetType of ['revenue', 'operating']) {
        const d = extractOrRefuse(fy, datasetType, fundScope);
        checked += 1;
        const perCapita = assertPerCapitaPlausible(
          fy, datasetType, fundScope, d.printed_total, population);

        const label = sourceNameFor(datasetType, fy, fundScope);
        const tree = toRpcTree(d.tree);

        if (dryRun) {
          console.log(`  [dry-run] FY${fy} ${datasetType} ${fundScope}: `
            + `$${(d.printed_total / 1e9).toFixed(2)}B, ${tree.length} categories, `
            + `$${perCapita.toFixed(0)}/capita, tie $0`);
          continue;
        }

        // ⚠⚠ `.eq('fund_scope', fundScope)` IS LOAD-BEARING. NYC publishes TWO
        // scopes for the same (municipality, fiscal_year, dataset_type). Omit
        // it and the total_governmental pass finds the general_fund row,
        // decides a different publisher owns it, and either skips or
        // overwrites -- either way one of the two series is lost.
        const { data: existing, error: lookupErr } = await db
          .schema('treasury').from('budgets')
          .select('id, data_source')
          .eq('municipality_id', municipalityId)
          .eq('fiscal_year', fy)
          .eq('dataset_type', datasetType)
          .eq('fund_scope', fundScope)
          .limit(1);
        if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
        if (existing?.[0] && !String(existing[0].data_source || '').startsWith(sourcePrefixFor(fundScope))) {
          conflicts += 1;
          console.log(`  SKIP FY${fy} ${datasetType} ${fundScope} — "${existing[0].data_source}" preserved`);
          continue;
        }

        const { data: rpc, error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: fy,
          p_dataset_type: datasetType,
          p_total: d.tree.a,
          p_tree: tree,
          p_row_count: tree.length,
          p_data_source_name: label,
          // ⚠ The EXACT filing, not a landing page.
          p_source_url: nycAcfrUrl(fy),
          p_source_date: `${fy}-${FY_END_MONTH_DAY}`,
          p_fiscal_year_start_month: FISCAL_YEAR_START_MONTH,
          // ⚠⚠ LOAD-BEARING. The RPC keys on these; omit them and both default
          // to 'unknown', so a re-run matches nothing, takes the INSERT branch,
          // and silently duplicates every row.
          p_fund_scope: fundScope,
          p_basis: BASIS_VALUE,
          p_derivation: DERIVATION,
        });
        // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as an error.
        if (error) throw new Error(`RPC transport error (FY${fy} ${datasetType} ${fundScope}): ${error.message}`);
        if (rpc?.error) throw new Error(`RPC refused (FY${fy} ${datasetType} ${fundScope}): ${rpc.error}`);
        if (rpc?.status !== 'success' || !rpc?.budget_id) {
          throw new Error(`RPC returned no success (FY${fy} ${datasetType} ${fundScope}): ${JSON.stringify(rpc)}`);
        }
        written += 1;
        console.log(`  FY${fy} ${datasetType} ${fundScope}: ${tree.length} categories, `
          + `$${(d.printed_total / 1e9).toFixed(2)}B`);
      }
    }
  }

  console.log(`\n${checked} extractions, all tied at $0.`);
  if (dryRun) { console.log('[dry-run] no rows written.'); return; }
  console.log(`Wrote ${written} budget rows (${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadNYCAcfrs.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
