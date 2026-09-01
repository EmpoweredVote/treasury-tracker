/**
 * Load the Michigan statewide F-65 sweep — every city and county, FY2010-FY2025.
 *
 * NO SHEBANG — tests import from this module.
 *
 * Usage:
 *   node scripts/loadMiStatewideF65.mjs --dir _acfr-work/mi-sweep/filings --dry-run
 *   node scripts/loadMiStatewideF65.mjs --dir _acfr-work/mi-sweep/filings --commit
 *
 * ── WHY THIS IS A SEPARATE LOADER ──────────────────────────────────────────
 *
 * The extraction — every rule about which column is General Fund, which rows are
 * leaves, which subtotals are removable financing — lives in
 * scripts/lib/michiganF65.mjs and is shared verbatim with the session-7a loader.
 * What differs is orchestration: a 364-unit roster, and a fiscal month that can
 * change mid-series. Rewriting loadMichiganF65.mjs to do both would put Detroit
 * and Wayne County's proven path at risk for no gain.
 *
 * ── ⚠⚠ THE FISCAL MONTH IS WRITTEN PER YEAR, NOT PER ENTITY ────────────────
 *
 * The 7a loader reads the month from each filing, checks it against ONE roster
 * constant, and then writes the CONSTANT. Its own comment says "read from the
 * filing"; the code writes `entity.fiscalYearStartMonth`. Those agree only
 * because the check throws otherwise — which is safe for two entities whose
 * calendars never move, and wrong here: FOUR units changed fiscal calendar
 * mid-series (Lake City at FY2020, Gladwin and Kent Counties at FY2020, Lapeer
 * County at FY2022).
 *
 * So this writes the month READ FROM THE FILING BEING LOADED, and uses the
 * roster's `monthsByYear` as the cross-check. A wrong fiscal month moves $0 and
 * passes every tie test — it is the defect this project has shipped more often
 * than any other.
 *
 * ── ⚠ WHAT IS ALREADY EXCLUDED BEFORE THIS RUNS ────────────────────────────
 *
 * 27 entity-years across 8 units where the F-65's self-reported month
 * CONTRADICTS the federal audit record. They are absent from
 * miStatewideEntities.mjs, so no filing exists for them. See
 * scripts/auditMiF65FiscalMonths.mjs, which measured 2,141 agreements against 27
 * conflicts and 3,634 uncovered — 98.8% where measurable, and never counting
 * "uncovered" as agreement.
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  buildFiling, filingChecks, dedupeFilingRows,
  SCOPES, CATEGORY_REVENUE, CATEGORY_EXPENDITURE,
} from './lib/michiganF65.mjs';
import {
  MI_STATEWIDE_ENTITIES, MI_STATEWIDE_LOAD_WINDOW, entityByKey,
} from './data/miStatewideEntities.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';
import { SOURCE_PREFIX, BASIS_VALUE, sourceNameFor, startMonthFromEnd } from './loadMichiganF65.mjs';

const MI_STATE = 'MI';

const DATASETS = Object.freeze([
  Object.freeze({ datasetType: 'revenue', category: CATEGORY_REVENUE }),
  Object.freeze({ datasetType: 'operating', category: CATEGORY_EXPENDITURE }),
]);

export function readFiling(path) {
  const filing = JSON.parse(readFileSync(path, 'utf8'));
  const entity = entityByKey(filing.entityKey);
  if (!entity) throw new Error(`Unknown entity key ${filing.entityKey} in ${path}`);
  if (filing.municode !== entity.municode) {
    throw new Error(`municode mismatch in ${path}: ${filing.municode} vs roster ${entity.municode}`);
  }

  // ⚠⚠ SIX of the 5,775 filings are emitted TWICE by the portal, every row
  // repeated. Deduplicate before anything measures them, or every leaf sum
  // doubles while the published subtotals stay right — which reads as the
  // Detroit FY2015 defect and is not. Throws if two copies disagree.
  const { rows: deduped, removed } = dedupeFilingRows(
    filing.rows, `${filing.entityKey} FY${filing.fiscalYear}`);
  if (removed > 0) filing.rows = deduped;

  const months = [...new Set(filing.rows.map((r) => r.fiscalendmonth)
    .filter((v) => v !== undefined && v !== null))];
  if (months.length !== 1) {
    throw new Error(`${filing.entityKey} FY${filing.fiscalYear}: expected one fiscalendmonth, `
      + `saw ${JSON.stringify(months)}`);
  }
  // ⚠⚠ AN EXCLUDED ENTITY-YEAR MUST NOT LOAD FROM A CACHED FILE. The fetcher
  // skips them, but a filing fetched BEFORE an exclusion was decided still sits
  // on disk — Marysville FY2016 is exactly that case. Without this the roster's
  // exclusions would silently stop being true of what actually loads.
  if (!entity.fiscalYears.includes(Number(filing.fiscalYear))) {
    throw new Error(`${filing.entityKey} FY${filing.fiscalYear} is EXCLUDED from the roster `
      + 'but a filing for it exists on disk. Delete the file or re-run the fetcher.');
  }

  const startMonth = startMonthFromEnd(months[0]);
  // ⚠ The roster records what this unit reported in THIS year, so a genuine
  // mid-series change agrees rather than throwing — while a filing that has
  // drifted from what the roster was built on still fails loudly.
  const expected = entity.monthsByYear?.[String(filing.fiscalYear)];
  if (expected !== undefined && startMonth !== expected) {
    throw new Error(`${filing.entityKey} FY${filing.fiscalYear}: filing says start month `
      + `${startMonth} but the roster recorded ${expected}`);
  }

  const built = {};
  const checks = [];
  for (const { datasetType, category } of DATASETS) {
    for (const scope of [SCOPES.general_fund, SCOPES.total_governmental]) {
      const context = `${entity.name} FY${filing.fiscalYear}`;
      const b = buildFiling(filing.rows, {
        category, scope, context, municode: entity.municode, fiscalYear: filing.fiscalYear,
      });
      built[`${datasetType}:${scope.id}`] = b;
      checks.push(...filingChecks({ category, scope, built: b, context }));
    }
  }
  return {
    entity, fiscalYear: filing.fiscalYear, sourceUrl: filing.sourceUrl, startMonth, built, checks,
  };
}

function toRpcTree(built) {
  return built.roots.map((r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map((k) => ({ n: k.n, a: k.a })) }
    : { n: r.n, a: r.a }));
}

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/mi-sweep/filings' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      commit: { type: 'boolean', default: false },
    },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    return 1;
  }

  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: MI_STATEWIDE_LOAD_WINDOW.last - MI_STATEWIDE_LOAD_WINDOW.first + 1 },
      (_, i) => MI_STATEWIDE_LOAD_WINDOW.first + i);

  // ⚠ Filter by FILENAME before parsing. Parsing first and filtering after reads
  // all 647 MB to load one year, and surfaces defects from years the run was not
  // asked about — which is confusing rather than wrong, and slow enough to matter.
  const yearSet = new Set(years);
  const files = readdirSync(values.dir)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => {
      const m = /^(.*)-(\d{4})\.json$/.exec(f);
      if (!m) return false;
      if (values.entity && m[1] !== values.entity) return false;
      if (!yearSet.has(Number(m[2]))) return false;
      // ⚠ Skip excluded entity-years quietly here; readFiling still THROWS if one
      // reaches it, so a roster exclusion cannot be lost by editing this filter.
      const ent = entityByKey(m[1]);
      return Boolean(ent && ent.fiscalYears.includes(Number(m[2])));
    })
    .sort();
  const filings = files.map((f) => readFiling(join(values.dir, f)));
  filings.sort((a, b) => a.entity.key.localeCompare(b.entity.key) || a.fiscalYear - b.fiscalYear);

  // ── Gates, before any write ───────────────────────────────────────────────
  let checks = 0; let bad = 0;
  const failures = [];
  const censusConflicts = [];
  for (const f of filings) {
    checks += f.checks.length;
    for (const c of f.checks.filter((x) => !x.ok)) {
      bad += 1;
      failures.push(`${f.entity.name} FY${f.fiscalYear}: ${c.label ?? JSON.stringify(c)}`);
    }
    // ⚠ censusGuard returns ok:true when it has NO evidence. Silence is not
    // confirmation, so an uncovered unit is simply not a conflict here.
    const guard = censusGuard(f.entity.censusName, MI_STATE, f.startMonth, Number(f.fiscalYear));
    if (guard.error) censusConflicts.push(guard.error);
  }

  const entityCount = new Set(filings.map((f) => f.entity.key)).size;
  console.log(`filings        : ${filings.length}  (${entityCount} entities)`);
  console.log(`rows to write  : ${filings.length * 4}`);
  console.log(`checks         : ${checks}   FAILED: ${bad}`);
  console.log(`census conflicts: ${censusConflicts.length}`);
  for (const e of censusConflicts.slice(0, 10)) console.log(`  ⚠ ${e}`);
  for (const e of failures.slice(0, 20)) console.log(`  ✗ ${e}`);

  if (filings.length === 0) {
    console.error('REFUSING: no filings matched. A load that loads nothing must fail.');
    return 1;
  }
  if (bad > 0 || censusConflicts.length > 0) {
    console.error('\nREFUSING TO WRITE: a gate failed. Nothing was written.');
    return 1;
  }
  if (values['dry-run']) {
    console.log('\n--dry-run: no writes performed.');
    return 0;
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); return 1; }
  const db = createClient(url, key);

  const entities = MI_STATEWIDE_ENTITIES.filter((e) => filings.some((f) => f.entity.key === e.key));
  const ids = new Map();
  // Counties first, so a city can point at a real parent id.
  const order = [...entities].sort((a, b) => (a.entityType === 'county' ? 0 : 1) - (b.entityType === 'county' ? 0 : 1));
  for (const ent of order) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: MI_STATE,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
  }
  console.log(`entities ensured: ${ids.size}`);

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0;
  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
    for (const { datasetType } of DATASETS) {
      for (const scope of [SCOPES.general_fund, SCOPES.total_governmental]) {
        const built = f.built[`${datasetType}:${scope.id}`];
        const { data, error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: f.fiscalYear,
          p_dataset_type: datasetType,
          p_total: built.operating,
          p_tree: toRpcTree(built),
          p_row_count: toRpcTree(built).length,
          p_data_source_name: sourceNameFor(datasetType, f.fiscalYear, scope),
          p_source_url: f.sourceUrl,
          p_source_date: sourceDate,
          // ⚠⚠ THE MONTH READ FROM THIS FILING, not a per-entity constant.
          p_fiscal_year_start_month: f.startMonth,
          p_fund_scope: scope.id,
          p_basis: BASIS_VALUE,
          p_derivation: scope.derivation,
        });
        // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
        // error. Counting attempts is not counting writes (session 4).
        if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear}): ${error.message}`);
        if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear}): ${data.error}`);
        if (data?.status !== 'success' || !data?.budget_id) {
          throw new Error(`RPC returned no success (${f.entity.name} FY${f.fiscalYear}): ${JSON.stringify(data)}`);
        }
        written += 1;
      }
    }
    if (written % 400 === 0) console.log(`  ... ${written} rows written`);
  }
  console.log(`\nwrote ${written} rows across ${ids.size} entities.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
}

export { main };
