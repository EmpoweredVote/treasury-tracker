/**
 * Load Pennsylvania DCED Municipal Statistics AFR filings into TT.
 *
 * NO SHEBANG — kept importable; tests/paInLoad.test.mjs imports `sourceNameFor`.
 *
 * Usage:
 *   node scripts/loadPaDced.mjs --dir _acfr-work/pa/xlsx --dry-run
 *   node scripts/loadPaDced.mjs --dir _acfr-work/pa/xlsx --commit
 *   node scripts/loadPaDced.mjs --dir ... --entity philadelphia --fy 2023 --dry-run
 *
 * ⚠ INPUT IS .xlsx, CONVERTED FROM DCED'S LEGACY BIFF8 .xls by
 *   python scripts/tools/xlsToXlsx.py _acfr-work/pa/xls _acfr-work/pa/xlsx --check
 * ExcelJS cannot open BIFF8 at all. Same fetch-stage conversion as Georgia.
 *
 * ── AUDIT GRADE — A THIRD ANSWER, AND IT SPLITS THESE TWO ENTITIES ──────────
 *
 * `self_reported_unaudited`, under §3.5's mixed-source rule.
 *
 * DCED-CLGS-30 is titled "Municipal Annual AUDIT and Financial Report" and is
 * filed BY AN AUDITOR for some classes of government and by the finance office
 * for others — Section IV: "Cities: Director of Accounts and Finance /
 * Boroughs: Elected Auditors, Independent Auditor, or Controller".
 *
 * ⚠⚠ SO OUR TWO MUNICIPALITIES ARE ON OPPOSITE BRANCHES, THE OPPOSITE WAY ROUND
 * FROM WHAT SIZE SUGGESTS: State College is a Borough, so an auditor signs its
 * filing; PHILADELPHIA IS A CITY, so its Director of Accounts and Finance
 * self-reports it.
 *
 * DCED's own verification is arithmetic, not evidentiary — "DCED verifies that
 * the ending cash/investments balance … agrees to the calculated balance taking
 * last year's ending … plus revenues minus expenditures" (Section III). It
 * reconciles the form to ITSELF. That is NOT what earned Florida its grade,
 * where DFS "reconciles the AFR to the provided audited financial statements".
 * **Pennsylvania is therefore not `compiled_from_audited`.**
 *
 * The auditor-type branch ("Elected Auditor" / "Appointed Auditor/CPA") is
 * captured in the online form but appears in NONE of the 71 statewide columns,
 * so — unlike Florida — the branch is not identifiable per entity per year.
 * §3.5: "the grade reflects the weaker branch unless the specific entity's
 * filing can be identified." Chris's call 2026-08-29: take the weaker branch now,
 * hunt for a per-entity auditor field later.
 *
 * ⚠ Basis is CASH, stated by the publisher: "BALANCE SHEET (CASH BASIS OF
 * ACCOUNTING ONLY)" (tip sheet) and "Cash Basis - Elected Auditors Only"
 * (Section III). Not GAAP, so `audited_gaap` was never available regardless.
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  readSheet, indexHeader, col, num, buildTree, checkRow, isApproved,
  MUNI_REVENUE_TREE, MUNI_EXPENDITURE_TREE, MUNI_FINANCING_COLUMNS,
  COUNTY_REVENUE_TREE, COUNTY_EXPENDITURE_TREE,
} from './lib/paDced.mjs';
import { PA_ENTITIES, PA_IN_LOAD_WINDOW, entityByDcedId } from './data/paInKnightEntities.mjs';

export const SOURCE_PREFIX = 'Pennsylvania DCED Municipal Annual Audit and Financial Report';
export const SOURCE_URL = 'https://apps.dced.pa.gov/munstats-public/ReportInformation2.aspx?report=StatewideMuniAfr';
export const SOURCE_URL_COUNTY = 'https://apps.dced.pa.gov/munstats-public/ReportInformation2.aspx?report=StatewideCountyAfr';
export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
const PA_STATE = 'PA';

/**
 * ⚠⚠ TWO DIFFERENT `fund_scope` VALUES IN ONE STATE, BOTH READ FROM THE SOURCE.
 * The municipal report folds enterprise activity into its totals and offers no
 * removable enterprise subtotal; the county report is explicitly governmental.
 * Recording them honestly beats forcing a comparability they do not have — the
 * WeHo precedent.
 */
export function fundScopeFor(entity) {
  return entity.source === 'PA_COUNTY' ? 'total_governmental' : 'all_funds';
}

export function sourceNameFor(datasetType, fiscalYear, entity) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  const scope = entity.source === 'PA_COUNTY' ? 'governmental funds' : 'all funds';
  return `${SOURCE_PREFIX} — ${face} (FY${fiscalYear} actual, cash basis, ${scope}, excl. financing sources)`;
}

/** Parse `StatewideMuniAfr_2023.xlsx` / `StatewideCountyAfr_2023.xlsx`. */
export function parseFilename(file) {
  const m = basename(file).match(/^(StatewideMuniAfr|StatewideCountyAfr)_(\d{4})\.xlsx$/i);
  if (!m) return null;
  return { report: m[1], fiscalYear: Number(m[2]) };
}

async function readOne(path, entities, years) {
  const meta = parseFilename(path);
  if (!meta || !years.includes(meta.fiscalYear)) return [];
  const isCounty = meta.report.toLowerCase().includes('county');
  const { header, rows } = await readSheet(path);
  const ix = indexHeader(header);
  const idCol = col(ix, isCounty ? 'MUNICIPALITY ID' : 'Municipality ID');
  const statusCol = col(ix, isCounty ? 'PENDING/APPROVED' : 'Pending/\nApproved');
  const totalRevCol = col(ix, isCounty ? 'Governmental Funds- Total Revenues' : 'Total Revenues');
  const totalExpCol = col(ix, isCounty ? 'Governmental Funds- Total Expenditures' : 'Total Expenditures');

  const out = [];
  for (const row of rows) {
    const id = String(row[idCol] ?? '').trim();
    if (!id) continue;
    const entity = entityByDcedId(id);
    // ⚠ Join on the publisher's ID. `NEW PHILADELPHIA BORO` (541023) and
    // `PHILADELPHIA  COUNTY` (510001, double space) both exist in this corpus.
    if (!entity || !entities.some((e) => e.key === entity.key)) continue;
    if ((entity.source === 'PA_COUNTY') !== isCounty) continue;

    // ⚠ Blank status means NOT FILED. Reported, never written as $0.
    if (!isApproved(row[statusCol])) {
      out.push({ entity, fiscalYear: meta.fiscalYear, notApproved: String(row[statusCol] ?? '').trim() || '(blank)' });
      continue;
    }

    const revSpec = isCounty ? COUNTY_REVENUE_TREE : MUNI_REVENUE_TREE;
    const expSpec = isCounty ? COUNTY_EXPENDITURE_TREE : MUNI_EXPENDITURE_TREE;
    const rev = buildTree(revSpec, row, ix);
    const exp = buildTree(expSpec, row, ix);

    // The county report already excludes financing sources; the municipal one
    // does not, so its published headline is reduced by exactly the one column.
    const finRev = isCounty ? 0 : num(row[col(ix, MUNI_FINANCING_COLUMNS.revenue)]);
    const finExp = isCounty ? 0 : num(row[col(ix, MUNI_FINANCING_COLUMNS.operating)]);
    const opRevTotal = num(row[totalRevCol]) - finRev;
    const opExpTotal = num(row[totalExpCol]) - finExp;

    out.push({
      entity, fiscalYear: meta.fiscalYear,
      revenue: rev, operating: exp,
      publishedRevenue: num(row[totalRevCol]), publishedExpenditure: num(row[totalExpCol]),
      financingRevenue: finRev, financingExpenditure: finExp,
      operatingRevenueTotal: opRevTotal, operatingExpenditureTotal: opExpTotal,
      checks: [
        ...checkRow({ tree: rev, publishedTotal: opRevTotal, label: 'revenue' }),
        ...checkRow({ tree: exp, publishedTotal: opExpTotal, label: 'operating' }),
      ],
    });
  }
  return out;
}

/** Nested `{n, a, c}` shape the RPC expects. */
function toRpcTree(built) {
  return built.roots.map((r) => (r.c && r.c.length
    ? { n: r.n, a: r.a, c: r.c.map((k) => ({ n: k.n, a: k.a })) }
    : { n: r.n, a: r.a }));
}

export async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/pa/xlsx' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      commit: { type: 'boolean', default: false },
    },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    process.exit(1);
  }
  const entities = values.entity ? PA_ENTITIES.filter((e) => e.key === values.entity) : PA_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: PA_IN_LOAD_WINDOW.last - PA_IN_LOAD_WINDOW.first + 1 },
      (_, i) => PA_IN_LOAD_WINDOW.first + i);

  const files = readdirSync(values.dir).filter((f) => f.endsWith('.xlsx')).sort();
  const filings = [];
  for (const f of files) filings.push(...await readOne(join(values.dir, f), entities, years));

  const notApproved = filings.filter((f) => f.notApproved);
  const good = filings.filter((f) => !f.notApproved);
  if (notApproved.length) {
    console.log('NOT APPROVED / NOT FILED in the source (reported, never written as $0):');
    for (const f of notApproved) console.log(`  - ${f.entity.name} FY${f.fiscalYear} status=${f.notApproved}`);
    console.log('');
  }

  let checks = 0;
  let bad = 0;
  for (const f of good.sort((a, b) => a.entity.key.localeCompare(b.entity.key) || a.fiscalYear - b.fiscalYear)) {
    const fails = f.checks.filter((c) => !c.ok);
    checks += f.checks.length;
    bad += fails.length;
    const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    console.log(`  ${f.entity.name} FY${f.fiscalYear}`);
    console.log(`    revenue   ${usd(f.operatingRevenueTotal)}  (published ${usd(f.publishedRevenue)}, financing ${usd(f.financingRevenue)})`);
    console.log(`    operating ${usd(f.operatingExpenditureTotal)}  (published ${usd(f.publishedExpenditure)}, financing ${usd(f.financingExpenditure)})`);
    for (const c of fails) {
      console.log(`      CHECK FAILED ${c.id} (${c.kind}): expected ${c.expected.toFixed(2)} got ${c.actual.toFixed(2)} diff ${c.diff.toFixed(2)}`);
    }
  }

  console.log(`\nIn-file checks: ${checks - bad}/${checks} pass across ${good.length} entity-years.`);
  // ⚠⚠ A gate that measured nothing must FAIL, not pass.
  if (checks === 0 || good.length === 0) {
    console.error('REFUSING: zero checks ran. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  if (bad > 0) {
    console.error(`REFUSING: ${bad} in-file check failures.`);
    process.exit(1);
  }
  if (!values.commit) {
    console.log('\nDry run — nothing written.');
    return good;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  const order = [...entities].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
  const ids = new Map();
  for (const ent of order) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: PA_STATE,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name} (${ent.entityType}) -> ${data}`);
  }
  for (const ent of entities) {
    if (!ent.parentCountyKey || !ids.has(ent.parentCountyKey)) continue;
    const { error } = await db.schema('treasury').from('municipalities')
      .update({ county_id: ids.get(ent.parentCountyKey) }).eq('id', ids.get(ent.key));
    if (error) throw new Error(`county_id error (${ent.name}): ${error.message}`);
  }

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0; let conflicts = 0; let categories = 0;
  for (const f of good) {
    const municipalityId = ids.get(f.entity.key);
    for (const [datasetType, built, total] of [
      ['operating', f.operating, f.operatingExpenditureTotal],
      ['revenue', f.revenue, f.operatingRevenueTotal],
    ]) {
      const tree = toRpcTree(built);
      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', f.fiscalYear)
        .eq('dataset_type', datasetType)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').startsWith(SOURCE_PREFIX)) {
        conflicts++;
        console.log(`  SKIP ${f.entity.name} FY${f.fiscalYear} ${datasetType} — "${existing[0].data_source}" preserved`);
        continue;
      }
      const { data, error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: f.fiscalYear,
        p_dataset_type: datasetType,
        p_total: total,
        p_tree: tree,
        p_row_count: tree.length,
        p_data_source_name: sourceNameFor(datasetType, f.fiscalYear, f.entity),
        p_source_url: f.entity.source === 'PA_COUNTY' ? SOURCE_URL_COUNTY : SOURCE_URL,
        p_source_date: sourceDate,
        // ⚠⚠ PER ENTITY. Philadelphia is month 7 where 611 of 643 PA entities in
        // the FAC census are month 1. Carrying one month across the state is
        // exactly project_fysm_column_default_one_defect.
        p_fiscal_year_start_month: f.entity.fiscalYearStartMonth,
        p_fund_scope: fundScopeFor(f.entity),
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
      // error. Counting attempts is not counting writes.
      if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success status (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${JSON.stringify(data)}`);
      }
      written++;
      categories += tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
    }
  }
  console.log(`\nWrote ${written} budget rows over ${categories.toLocaleString()} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  console.log('Now run:  npm run verify:frozen');
  console.log('     then npm run register:rows -- --milestone knight-s5-pa-in --match "Pennsylvania DCED"');
  return good;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadPaDced.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
