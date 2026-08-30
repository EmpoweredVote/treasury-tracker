/**
 * Load the South Carolina RFA Local Government Finance Report into TT.
 *
 * NO SHEBANG — kept importable; tests/scRfa.test.mjs imports `sourceNameFor`.
 *
 * Usage:
 *   node scripts/tools/xlsToXlsx.py _acfr-work/sc/xls _acfr-work/sc/xlsx --check
 *   node scripts/loadScRfa.mjs --file _acfr-work/sc/xlsx/ScLgfReport_2024.xlsx --dry-run
 *   node scripts/loadScRfa.mjs --file ... --commit
 *   node scripts/loadScRfa.mjs --file ... --entity richland-county --fy 2024 --dry-run
 *
 * ⚠ COUNTIES ONLY. The workbook publishes no individual municipality — its
 * "Cities only" block is every municipality in the county summed together. See
 * scripts/data/scKnightEntities.mjs. Columbia and Myrtle Beach come from their
 * own ACFRs and NOT from here; `scBulkEntities()` is what this loader iterates,
 * so a city cannot reach the write path by accident.
 *
 * ── SCOPE, ALL THREE DECISIONS READ FROM THE PUBLISHER ──────────────────────
 *
 * fund_scope   `unknown`, deliberately, and NOT `all_funds`.
 *              The submission form collects "(a) General Fund" and "(b)
 *              Enterprise Fund" on every section; the published report drops the
 *              Utility Sales Revenues block ("Revenue from water, sewer, and
 *              power utilities ... is not included in this report") but KEEPS
 *              form line 970, "Public Works (Utility Systems, Public Transit)",
 *              on the spending side. Revenues and expenditures are therefore on
 *              different scopes by construction, which is why RFA itself warns
 *              that "using the data in this report to impute a relationship
 *              between total revenues and expenditures ... is not recommended".
 *              `unknown` is TT's honest value for not-comparable — the WeHo
 *              precedent, where rows carry it on purpose. Calling this
 *              `all_funds` would assert a comparability the publisher denies.
 *
 * basis        `actual`. The form asks for "the most recently completed fiscal
 *              year" throughout, and is due 8.5 months after year end.
 *
 * derivation   `published`. Every figure is a printed cell; nothing is derived.
 *
 * ⚠ `reporting_entity` is left `unknown`. The form never says whether component
 * units are included, and Georgia's 76 rows were left the same way for the same
 * reason. Guessing here would be inventing evidence.
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import {
  readWorkbook, indexYears, readCountyInfo, reportedYears, sliceBlock, buildTree,
  checkTree, money, BLOCK, FINANCING_LEAF, NON_COUNTY_SHEETS,
} from './lib/scRfa.mjs';
import { SC_LOAD_WINDOW, scBulkEntities } from './data/scKnightEntities.mjs';

export const SOURCE_PREFIX = 'South Carolina RFA Local Government Finance Report';
export const SOURCE_URL = 'https://rfa.sc.gov/data-research/local-government/finance';
export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';
export const FUND_SCOPE = 'unknown';
const SC_STATE = 'SC';

/**
 * ⚠ CITE THE LANDING PAGE, NOT THE FILE URL. The bytes currently sit at
 * `/sites/default/files/2026-05/FY%202024%20Local%20Government%20Finance%20Report.xls`,
 * a path stamped with the month RFA last revised it — it moved once already and
 * will move again at the next revision. The Mecklenburg lesson: cite the durable
 * page a reader can actually navigate to.
 */
export function sourceNameFor(datasetType, fiscalYear) {
  return datasetType === 'operating'
    ? `${SOURCE_PREFIX} — Expenditure by Function (FY${fiscalYear} actual, county only)`
    : `${SOURCE_PREFIX} — Revenue by Source (FY${fiscalYear} actual, county only, excl. bond and lease proceeds)`;
}

/** Read every requested entity-year out of the workbook. */
export async function readFilings({ file, entities, years }) {
  const wb = await readWorkbook(file);
  const countyInfo = readCountyInfo(wb.sheets.get('County Info'));

  const sheetNames = [...wb.sheets.keys()].filter((n) => !NON_COUNTY_SHEETS.has(n));
  const filings = [];
  const refused = [];

  for (const entity of entities) {
    const rows = wb.sheets.get(entity.sheet);
    if (!rows) throw new Error(`Sheet ${entity.sheet} not in workbook (have ${sheetNames.length} county sheets)`);
    const { years: yearCols } = indexYears(rows, entity.sheet);
    const rep = reportedYears({
      years: yearCols, countyInfo, county: entity.countyInfoName, window: years,
    });

    // ⚠ Never written as $0, and never silently dropped either — reported.
    for (const fy of rep.starred) refused.push({ entity, fiscalYear: fy, why: 'year header starred (publisher non-reporting marker)' });
    for (const fy of rep.notSubmitted) {
      if (!rep.starred.includes(fy)) refused.push({ entity, fiscalYear: fy, why: 'County Info matrix says not submitted' });
    }

    const revB = sliceBlock(rows, BLOCK.COUNTY_REVENUE, entity.sheet);
    const expB = sliceBlock(rows, BLOCK.COUNTY_EXPENDITURE, entity.sheet);

    for (const fiscalYear of rep.reported) {
      const { col } = yearCols.get(fiscalYear);
      const revenue = buildTree({ body: revB.body, col, exclude: new Set([FINANCING_LEAF]) });
      const operating = buildTree({ body: expB.body, col });
      const publishedRevenue = money(revB.anchorRow[col]);
      const publishedExpenditure = money(expB.anchorRow[col]);
      const financing = Math.round(revenue.excluded.reduce((s, e) => s + e.a, 0) * 100) / 100;

      filings.push({
        entity,
        fiscalYear,
        revenue,
        operating,
        publishedRevenue,
        publishedExpenditure,
        financing,
        checks: [
          ...checkTree({
            tree: revenue.tree, publishedTotal: publishedRevenue,
            subsetTotal: revenue.total, excludedTotal: financing, label: 'revenue',
          }),
          ...checkTree({
            tree: operating.tree, publishedTotal: publishedExpenditure,
            subsetTotal: operating.total, label: 'operating',
          }),
        ],
      });
    }
  }
  return { filings, refused, wb };
}

/**
 * The statewide oracle: sum the County-only block across ALL 46 county sheets and
 * compare with RFA's own `State Summary` sheet.
 *
 * This is the check that is EXTERNAL to the write path (§5.2). It is a second,
 * independently published aggregation of the same cells, so a column off-by-one,
 * a mis-located block or a sheet mix-up moves the total and shows up here — none
 * of which the in-file parent=Σchildren identities can see.
 *
 * ⚠ It does NOT prove scope, and nothing does. Session 5: 11,283 of 11,283 fund
 * checks passed over a $735M scope error. Read the series for continuity too.
 */
export function statewideOracle(wb, years) {
  const ss = wb.sheets.get('State Summary');
  const ssYears = indexYears(ss, 'State Summary').years;
  const counties = [...wb.sheets.keys()].filter((n) => !NON_COUNTY_SHEETS.has(n));
  const results = [];

  for (const [anchor, label] of [[BLOCK.COUNTY_REVENUE, 'revenue'], [BLOCK.COUNTY_EXPENDITURE, 'operating']]) {
    const ssRow = sliceBlock(ss, anchor, 'State Summary').anchorRow;
    for (const fiscalYear of years) {
      if (!ssYears.has(fiscalYear)) continue;
      let sum = 0;
      let counted = 0;
      for (const c of counties) {
        const rows = wb.sheets.get(c);
        const y = indexYears(rows, c).years.get(fiscalYear);
        if (!y) continue;
        sum += money(sliceBlock(rows, anchor, c).anchorRow[y.col]);
        counted += 1;
      }
      sum = Math.round(sum * 100) / 100;
      const published = money(ssRow[ssYears.get(fiscalYear).col]);
      const diff = Math.round((sum - published) * 100) / 100;
      results.push({ label, fiscalYear, counted, sum, published, diff, ok: Math.abs(diff) <= 0.01 });
    }
  }
  return results;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', default: '_acfr-work/sc/xlsx/ScLgfReport_2024.xlsx' },
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

  const all = scBulkEntities();
  const entities = values.entity ? all.filter((e) => e.key === values.entity) : all;
  if (!entities.length) throw new Error(`No bulk entity matched ${values.entity}`);
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: SC_LOAD_WINDOW.last - SC_LOAD_WINDOW.first + 1 },
      (_, i) => SC_LOAD_WINDOW.first + i);

  const { filings, refused, wb } = await readFilings({ file: values.file, entities, years });

  if (refused.length) {
    console.log('NOT LOADED — the publisher marks these as not reported (never written as $0):');
    for (const r of refused) console.log(`  - ${r.entity.name} FY${r.fiscalYear}: ${r.why}`);
    console.log('');
  }

  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  let checks = 0;
  let bad = 0;
  for (const f of filings.sort((a, b) => a.entity.key.localeCompare(b.entity.key) || a.fiscalYear - b.fiscalYear)) {
    const fails = f.checks.filter((c) => !c.ok);
    checks += f.checks.length;
    bad += fails.length;
    console.log(`  ${f.entity.name} FY${f.fiscalYear}`);
    console.log(`    revenue   ${usd(f.revenue.total)}  (published ${usd(f.publishedRevenue)}, bonds & leases ${usd(f.financing)})`);
    console.log(`    operating ${usd(f.operating.total)}  (published ${usd(f.publishedExpenditure)})`);
    for (const c of fails) {
      console.log(`      CHECK FAILED ${c.id} (${c.kind}): expected ${c.expected} got ${c.actual} diff ${c.diff}`);
    }
  }

  console.log(`\nIn-file checks: ${checks - bad}/${checks} across ${filings.length} entity-years.`);

  console.log('\nStatewide oracle — Σ all 46 county sheets vs RFA\'s own State Summary:');
  const oracle = statewideOracle(wb, years);
  const oracleBad = oracle.filter((o) => !o.ok);
  for (const o of oracle) {
    if (!o.ok) console.log(`  FAIL ${o.label} FY${o.fiscalYear}: Σ${o.counted} = ${o.sum} vs ${o.published} (diff ${o.diff})`);
  }
  console.log(`  ${oracle.length - oracleBad.length}/${oracle.length} tie at $0 `
    + `(${oracle[0]?.counted ?? 0} county sheets × ${years.length} years × 2 money columns).`);

  // ⚠⚠ A gate that measured nothing must FAIL, not pass. Florida's zero-row parse
  // reported itself green because it counted 0 checks and printed "Oracle green".
  if (checks === 0 || filings.length === 0 || oracle.length === 0) {
    console.error('REFUSING: zero checks ran. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  if (bad > 0) { console.error(`REFUSING: ${bad} in-file check failures.`); process.exit(1); }
  if (oracleBad.length > 0) { console.error(`REFUSING: ${oracleBad.length} statewide oracle failures.`); process.exit(1); }

  if (!values.commit) {
    console.log('\nDry run — nothing written.');
    return filings;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  const ids = new Map();
  for (const ent of entities) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: SC_STATE,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name} (${ent.entityType}) -> ${data}`);
  }

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0;
  let conflicts = 0;
  let categories = 0;

  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
    for (const [datasetType, built] of [['operating', f.operating], ['revenue', f.revenue]]) {
      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', f.fiscalYear)
        .eq('dataset_type', datasetType)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').startsWith(SOURCE_PREFIX)) {
        conflicts += 1;
        console.log(`  SKIP ${f.entity.name} FY${f.fiscalYear} ${datasetType} — "${existing[0].data_source}" preserved`);
        continue;
      }

      const { data, error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: f.fiscalYear,
        p_dataset_type: datasetType,
        p_total: built.total,
        p_tree: built.tree,
        p_row_count: built.tree.length,
        p_data_source_name: sourceNameFor(datasetType, f.fiscalYear),
        p_source_url: SOURCE_URL,
        p_source_date: sourceDate,
        // Month 7, ACTIVELY confirmed per entity by the FAC census — not a default.
        p_fiscal_year_start_month: f.entity.fiscalYearStartMonth,
        p_fund_scope: FUND_SCOPE,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
      // error. Georgia printed "Wrote 76 budget rows" having written none.
      if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success status (${f.entity.name} FY${f.fiscalYear} ${datasetType}): ${JSON.stringify(data)}`);
      }
      written += 1;
      const countNodes = (nodes) => nodes.reduce((a, n) => a + 1 + (n.c ? countNodes(n.c) : 0), 0);
      categories += countNodes(built.tree);
    }
  }

  console.log(`\nWrote ${written} budget rows over ${categories.toLocaleString()} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  console.log('Now run:  npm run verify:frozen');
  console.log('     then npm run register:rows -- --milestone knight-s6a-sc --match "South Carolina RFA"');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadScRfa.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
