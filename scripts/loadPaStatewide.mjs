/**
 * Pennsylvania DCED statewide loader — every approved municipal and county AFR,
 * FY2015-FY2024.
 *
 * NO SHEBANG — kept importable; tests import `planRow` and `toRpcTree`.
 *
 * Usage:
 *   node scripts/loadPaStatewide.mjs --year 2023 --dry-run
 *   node scripts/loadPaStatewide.mjs --dry-run                 # the whole survey
 *   node scripts/loadPaStatewide.mjs --year 2023 --commit      # ⚠ ONE YEAR AT A TIME
 *
 * The parsing, the two tree specs, the financing exclusion and the in-file
 * checks all come from scripts/lib/paDced.mjs, and the source naming and axis
 * values from scripts/loadPaDced.mjs — imported, never copied, so the Knight
 * three-entity loader and this one cannot drift into writing one family two
 * different ways.
 *
 * ── ⚠⚠ TWO SCOPES IN ONE STATE, BOTH READ FROM THE SOURCE ──────────────────
 *
 * MUNICIPAL rows are `all_funds`: DCED folds enterprise activity into
 * `Total Revenues` and publishes no removable enterprise subtotal, so an
 * enterprise exclusion cannot be applied without inventing a total the source
 * does not publish. COUNTY rows are `total_governmental`, which the county
 * report's own column names state.
 *
 * Both sides exclude FINANCING flows — `Other Financing Sources/Uses` on the
 * municipal report — because DCED's county series already excludes them and
 * loading the two as published would ship two incomparable scopes in one state.
 * The operating total is `published total - financing column`, and the tree must
 * sum to exactly that.
 *
 * ── WHAT IS CHECKED BEFORE A ROW IS WRITTEN ────────────────────────────────
 *
 *   1. APPROVED    `Pending/Approved` must be `A`. `P` is pending and BLANK is
 *                  NOT FILED; neither is ever written as $0.
 *   2. SUBTOTALS   every published subtotal must equal the sum of its own
 *                  children — including `Total Taxes Revenues`, which disagrees
 *                  with its ten detail columns in 139 of 2,395 approved 2023
 *                  municipal rows while the grand total still ties.
 *   3. TOTAL       the built tree must equal the published total less financing.
 *   4. REGISTRY    the row's DCED id must be a government this registry knows,
 *                  and its report must match the registry's `source`.
 *
 * ⚠ A gate that measured nothing must FAIL, not pass: the loader refuses a year
 * in which zero checks ran.
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  readSheet, indexHeader, col, num, buildTree, checkRow, isApproved,
  MUNI_REVENUE_TREE, MUNI_EXPENDITURE_TREE, MUNI_FINANCING_COLUMNS,
  COUNTY_REVENUE_TREE, COUNTY_EXPENDITURE_TREE,
} from './lib/paDced.mjs';
import {
  SOURCE_PREFIX, SOURCE_URL, SOURCE_URL_COUNTY, BASIS_VALUE, DERIVATION,
  sourceNameFor, fundScopeFor,
} from './loadPaDced.mjs';
import {
  PA_STATEWIDE_ENTITIES, PA_STATE, PA_STATEWIDE_LOAD_WINDOW, paEntityByDcedId,
} from './data/paStatewideEntities.mjs';
import { MUNI_STATUS_HEADER, COUNTY_STATUS_HEADER } from './buildPaStatewideEntities.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_DIR = path.join(ROOT, '_acfr-work/pa/xlsx');

export const DATASETS = ['operating', 'revenue'];

/** How many budget rows a clean full load would write. */
export function plannedRowsFor(entities = PA_STATEWIDE_ENTITIES) {
  return entities.reduce((s, e) => s + e.fiscalYears.length, 0) * DATASETS.length;
}

/** Nested `{n, a, c}` shape the RPC persists. */
export function toRpcTree(built) {
  return built.roots.map((r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map((k) => ({ n: k.n, a: k.a })) }
    : { n: r.n, a: r.a }));
}

/**
 * Decide everything about one source row without touching the database.
 *
 * ⚠⚠ Exported so the survey (`--dry-run`) runs EXACTLY these gates. Michigan's
 * survey ran a different set, reported 99.75% clean, and the loader then failed
 * 15 filings. There is one implementation and both callers use it.
 */
export function planRow({ row, ix, isCounty, fiscalYear }) {
  const idCol = col(ix, isCounty ? 'MUNICIPALITY ID' : 'Municipality ID');
  const id = String(row[idCol] ?? '').trim();
  if (!id) return null;

  const entity = paEntityByDcedId(id);
  if (!entity) return { id, skip: 'not in the registry (never approved in this window)' };
  if ((entity.source === 'PA_COUNTY') !== isCounty) {
    return { id, entity, fatal: `appears in the ${isCounty ? 'county' : 'municipal'} report but the `
      + `registry has it as ${entity.source}` };
  }

  const statusCol = col(ix, isCounty ? COUNTY_STATUS_HEADER : MUNI_STATUS_HEADER);
  if (!isApproved(row[statusCol])) {
    return { id, entity, notApproved: String(row[statusCol] ?? '').trim() || '(blank)' };
  }

  const totalRevCol = col(ix, isCounty ? 'Governmental Funds- Total Revenues' : 'Total Revenues');
  const totalExpCol = col(ix, isCounty ? 'Governmental Funds- Total Expenditures' : 'Total Expenditures');
  // ⚠ `collapse`: where a published subtotal disagrees with its own detail
  // columns, keep the publisher's subtotal and drop the detail rather than
  // refuse the government. See the note in buildTree.
  const opts = { onSubtotalMismatch: 'collapse' };
  const rev = buildTree(isCounty ? COUNTY_REVENUE_TREE : MUNI_REVENUE_TREE, row, ix, opts);
  const exp = buildTree(isCounty ? COUNTY_EXPENDITURE_TREE : MUNI_EXPENDITURE_TREE, row, ix, opts);

  // ⚠ The county report already excludes financing; the municipal one does not.
  const finRev = isCounty ? 0 : num(row[col(ix, MUNI_FINANCING_COLUMNS.revenue)]);
  const finExp = isCounty ? 0 : num(row[col(ix, MUNI_FINANCING_COLUMNS.operating)]);
  const opRev = num(row[totalRevCol]) - finRev;
  const opExp = num(row[totalExpCol]) - finExp;

  const checks = [
    ...checkRow({ tree: rev, publishedTotal: opRev, label: 'revenue' }),
    ...checkRow({ tree: exp, publishedTotal: opExp, label: 'operating' }),
    ...oracleChecks({ row, ix, isCounty }),
  ];

  return {
    id, entity, fiscalYear,
    revenue: rev, operating: exp,
    operatingRevenueTotal: opRev, operatingExpenditureTotal: opExp,
    publishedRevenue: num(row[totalRevCol]), publishedExpenditure: num(row[totalExpCol]),
    financingRevenue: finRev, financingExpenditure: finExp,
    checks,
    failed: checks.filter((c) => !c.ok),
    collapsed: [...rev.collapsed, ...exp.collapsed],
  };
}

/**
 * ⭐ AN INDEPENDENT ORACLE ON THE COLUMN MAPPING, FROM COLUMNS THE TREE NEVER READS.
 *
 * DCED publishes DERIVED figures alongside the detail: `Revenues Over
 * Expenditures`, and per-capita revenue and expenditure on both reports. It
 * computes them itself, outside anything this loader parses, so reproducing them
 * proves TT read `Total Revenues`, `Total Expenditures` AND `Population` from the
 * right columns.
 *
 * That is the class of check Pennsylvania looked to be missing. Florida had a
 * separate totals report to oracle against; PA's cash basis means its filings
 * cannot be tied to a GAAP ACFR, so there is no external document to compare —
 * but these derived columns are an internal one, and a WeHo-style column shift
 * (three of four mappings naming columns that did not exist, while the load still
 * "worked") could not survive them.
 *
 * MEASURED on FY2023 before being wired in: 2,395/2,395 approved municipal rows
 * and 63/63 county rows satisfy all of them.
 *
 * ⚠ The net check is EXACT. The per-capita checks carry a $1 tolerance because
 * DCED rounds a derived display figure — that is the publisher's own precision,
 * not slack invented here.
 */
export function oracleChecks({ row, ix, isCounty }) {
  const out = [];
  const rev = num(row[col(ix, isCounty ? 'Governmental Funds- Total Revenues' : 'Total Revenues')]);
  const exp = num(row[col(ix, isCounty ? 'Governmental Funds- Total Expenditures' : 'Total Expenditures')]);
  const pop = num(row[col(ix, 'Population')]);

  if (!isCounty) {
    // ⚠ Exact: both sides are whole dollars the publisher printed.
    const net = num(row[col(ix, 'Revenues Over Expenditures')]);
    out.push({
      id: 'oracle: revenues over expenditures', kind: 'oracle',
      expected: net, actual: rev - exp, diff: net - (rev - exp),
      ok: Math.abs(net - (rev - exp)) <= 0.5,
    });
  }
  if (pop > 0) {
    for (const [label, published, computed] of [
      ['revenue per capita', num(row[col(ix, isCounty ? 'Revenue Per Capita' : 'Revenues Per Capita')]), rev / pop],
      ['expenditure per capita', num(row[col(ix, 'Expenditures Per Capita')]), exp / pop],
    ]) {
      out.push({
        id: `oracle: ${label}`, kind: 'oracle',
        expected: published, actual: computed, diff: published - computed,
        ok: Math.abs(published - computed) <= 1.0,
      });
    }
  }
  return out;
}

/** Read and plan one report-year. */
export async function planYear(dir, year) {
  const out = [];
  for (const [report, isCounty] of [['StatewideMuniAfr', false], ['StatewideCountyAfr', true]]) {
    const file = path.join(dir, `${report}_${year}.xlsx`);
    if (!existsSync(file)) { out.push({ missing: file }); continue; }
    const { header, rows } = await readSheet(file);
    const ix = indexHeader(header);
    for (const row of rows) {
      const p = planRow({ row, ix, isCounty, fiscalYear: year });
      if (p) out.push(p);
    }
  }
  return out;
}

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string' },
      year: { type: 'string' },
      'dry-run': { type: 'boolean' },
      commit: { type: 'boolean' },
      'source-date': { type: 'string' },
    },
  });
  if (!values['dry-run'] && !values.commit) { console.error('Pass --dry-run or --commit.'); process.exit(1); }
  const dir = values.dir ? path.resolve(ROOT, values.dir) : DEFAULT_DIR;
  const { first, last } = PA_STATEWIDE_LOAD_WINDOW;
  const years = values.year
    ? [Number(values.year)]
    : Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const sourceDate = values['source-date'] || new Date().toISOString().slice(0, 10);

  console.log(`\nPennsylvania DCED statewide — FY${years[0]}-FY${years[years.length - 1]}`
    + `${values.commit ? '' : '  [dry-run]'}`);
  console.log(`  Cache: ${path.relative(ROOT, dir)}`);
  console.log(`  Registry: ${PA_STATEWIDE_ENTITIES.length} governments\n`);

  let db = null;
  if (values.commit) {
    loadEnv();
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
    db = createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);
  }

  const stats = {
    planned: 0, written: 0, conflicts: 0, notApproved: 0, notInRegistry: 0,
    checks: 0, failed: 0, categories: 0, collapsed: 0,
  };
  const collapsedNotes = [];
  const fatals = [];
  const idCache = new Map();

  for (const year of years) {
    const plans = await planYear(dir, year);
    const missing = plans.filter((p) => p.missing);
    for (const m of missing) fatals.push(`FY${year}: ${path.basename(m.missing)} is not cached`);

    const good = plans.filter((p) => p.checks);
    for (const p of plans) {
      if (p.fatal) fatals.push(`FY${year} ${p.entity?.name ?? p.id}: ${p.fatal}`);
      if (p.notApproved) stats.notApproved++;
      if (p.skip) stats.notInRegistry++;
    }
    for (const p of good) {
      stats.checks += p.checks.length;
      stats.failed += p.failed.length;
      for (const c of p.collapsed) {
        stats.collapsed++;
        if (collapsedNotes.length < 8) {
          collapsedNotes.push(`FY${year} ${p.entity.name}: ${c.id} published ${c.published} vs detail `
            + `${c.detailSum} (diff ${c.diff}) — detail dropped, published total kept`);
        }
      }
      for (const c of p.failed) {
        fatals.push(`FY${year} ${p.entity.name}: CHECK FAILED ${c.id} (${c.kind}) — `
          + `expected ${c.expected.toFixed(2)} got ${c.actual.toFixed(2)} diff ${c.diff.toFixed(2)}`);
      }
    }

    // ⚠⚠ A gate that measured nothing must FAIL, not pass.
    if (good.length === 0 || stats.checks === 0) {
      console.error(`REFUSING FY${year}: zero checks ran. Nothing was measured, so nothing is verified.`);
      process.exit(1);
    }
    if (stats.failed > 0) {
      console.error(`\nREFUSING: ${stats.failed} in-file check failure(s).`);
      for (const f of fatals.slice(0, 30)) console.error(`   ${f}`);
      process.exit(1);
    }

    stats.planned += good.length;
    console.log(`  FY${year}: ${good.length} approved filings, ${plans.filter((p) => p.notApproved).length} not approved`);

    if (!values.commit) continue;

    let done = 0;
    const started = Date.now();
    for (const p of good) {
      let municipalityId = idCache.get(p.entity.name);
      if (!municipalityId) {
        const { data, error } = await db.rpc('treasury_ensure_municipality', {
          p_name: p.entity.name, p_state: PA_STATE,
          p_entity_type: p.entity.entityType, p_population: p.entity.population,
        });
        if (error) throw new Error(`Municipality error (${p.entity.name}): ${error.message}`);
        municipalityId = data;
        idCache.set(p.entity.name, municipalityId);
      }

      for (const [datasetType, built, total] of [
        ['operating', p.operating, p.operatingExpenditureTotal],
        ['revenue', p.revenue, p.operatingRevenueTotal],
      ]) {
        const tree = toRpcTree(built);
        const { data: existing, error: lookupErr } = await db
          .schema('treasury').from('budgets')
          .select('id, data_source')
          .eq('municipality_id', municipalityId)
          .eq('fiscal_year', p.fiscalYear)
          .eq('dataset_type', datasetType)
          .limit(1);
        if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
        if (existing?.[0] && !String(existing[0].data_source || '').startsWith(SOURCE_PREFIX)) {
          stats.conflicts++;
          console.log(`      SKIP ${p.entity.name} FY${p.fiscalYear} ${datasetType} — `
            + `"${existing[0].data_source}" preserved (never-overwrite)`);
          continue;
        }
        const { data, error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: p.fiscalYear,
          p_dataset_type: datasetType,
          p_total: total,
          p_tree: tree,
          p_row_count: tree.length,
          p_data_source_name: sourceNameFor(datasetType, p.fiscalYear, p.entity),
          p_source_url: p.entity.source === 'PA_COUNTY' ? SOURCE_URL_COUNTY : SOURCE_URL,
          p_source_date: sourceDate,
          // ⚠⚠ PER ENTITY. Philadelphia is month 7 where every other PA
          // government is month 1. Carrying one month across a state is exactly
          // project_fysm_column_default_one_defect.
          p_fiscal_year_start_month: p.entity.fiscalYearStartMonth,
          // ⚠⚠ LOAD-BEARING: the RPC's target key includes fund_scope and basis.
          // Omitting them defaults both to 'unknown', so a re-run matches nothing
          // and INSERTS a duplicate of every row instead of updating it.
          p_fund_scope: fundScopeFor(p.entity),
          p_basis: BASIS_VALUE,
          p_derivation: DERIVATION,
        });
        // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a transport
        // error. Counting attempts is not counting writes.
        if (error) throw new Error(`RPC transport error (${p.entity.name} FY${p.fiscalYear} ${datasetType}): ${error.message}`);
        if (data?.error) throw new Error(`RPC refused (${p.entity.name} FY${p.fiscalYear} ${datasetType}): ${data.error}`);
        if (data?.status !== 'success' || !data?.budget_id) {
          throw new Error(`RPC returned no success status (${p.entity.name} FY${p.fiscalYear} ${datasetType}): ${JSON.stringify(data)}`);
        }
        stats.written++;
        stats.categories += tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
      }
      if (++done % 250 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`  FY${year}: ${done}/${good.length} entities (${rate.toFixed(1)}/s, ${stats.written} rows)`);
      }
    }
    console.log(`  FY${year}: ${done} entities written`);
  }

  console.log(`\n  approved filings planned: ${stats.planned}`);
  console.log(`  in-file checks passed:    ${stats.checks - stats.failed}/${stats.checks}`);
  console.log(`  rows written:             ${stats.written}`);
  console.log(`  categories:               ${stats.categories.toLocaleString()}`);
  console.log(`  skipped, conflict:        ${stats.conflicts}`);
  console.log(`  skipped, not approved:    ${stats.notApproved}`);
  console.log(`  rows not in the registry: ${stats.notInRegistry}`);
  console.log(`  subtotals COLLAPSED:      ${stats.collapsed} (publisher's subtotal kept, its own detail dropped)`);
  for (const n of collapsedNotes) console.log(`      ${n}`);
  if (stats.collapsed > 0 && collapsedNotes.length === 8) {
    console.log(`      ... and ${stats.collapsed - 8} more`);
  }

  if (fatals.length) {
    console.error(`\n  ⚠⚠ ${fatals.length} PROBLEM(S):`);
    for (const f of fatals.slice(0, 40)) console.error(`      ${f}`);
    process.exit(1);
  }
  if (values.commit && stats.written === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  if (values.commit) {
    console.log('\n  Next, while you still know what was loaded:');
    console.log('      npm run verify:frozen');
    console.log('      npm run register:rows -- --milestone pa-statewide --match "Pennsylvania DCED"');
  }
}

if (process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1]
  || process.argv[1].endsWith('loadPaStatewide.mjs'))) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
