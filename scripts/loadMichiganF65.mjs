/**
 * Load Michigan Form F-65 (Annual Local Unit Fiscal Report) filings into TT.
 *
 * NO SHEBANG — kept importable; tests/miF65Load.test.mjs imports `sourceNameFor`.
 *
 * Usage:
 *   node scripts/loadMichiganF65.mjs --dir _acfr-work/mi --dry-run
 *   node scripts/loadMichiganF65.mjs --dir _acfr-work/mi --commit
 *   node scripts/loadMichiganF65.mjs --dir _acfr-work/mi --entity detroit --fy 2024 --dry-run
 *
 * ── AUDIT GRADE — A SIXTH DISTINCT ANSWER IN SIX STATES ─────────────────────
 *
 * `self_reported_unaudited`, under §3.5's mixed-source rule.
 *
 * Michigan gives the STRONGEST "use the audited numbers" instruction this
 * campaign has seen, and still does not earn a higher grade, because nobody
 * checks. Verbatim from the publisher's own Form F-65 instructions:
 *
 *   "If you are required to have an audit for the 2015-2016 fiscal year, please
 *    use the audited numbers."
 *   "Report the final adjusted balances of all revenues received and
 *    expenditures made by fund type ... in accordance with the official state
 *    Uniform Chart of Accounts and your annual financial audit report. Take
 *    information directly from your audit report where possible."
 *   "Report the final adjusted balances of assets, liabilities, and fund
 *    equities in accordance with your unit's audited financial statements (or
 *    year-end trial balance if your unit is not subject to an audit
 *    requirement)."
 *
 * But the same document disclaims the form's standing, and names the fallback:
 *
 *   "The Form F-65 does not satisfy other statutory requirements for audited
 *    financial statements required by Public Act 2 of 1968 or the Single Audit
 *    Act Amendments of 1996."
 *   "If you are not being audited for the current year, you still are required
 *    to file. Prepare Form F-65 based on your year-end trial balance."
 *
 * This is the CALIFORNIA SCO shape stated more explicitly: audited data is
 * directed CONDITIONALLY ("if you are required to have an audit"), the filer is
 * the local unit itself, and the fallback is an unaudited trial balance. Per the
 * vocabulary's own rule, a mixed source takes the weaker branch.
 *
 * ⚠⚠ AND CRUCIALLY THERE IS NO RECONCILIATION STEP — which is precisely what
 * earned Florida its `compiled_from_audited`, where DFS staff "reconciles the
 * AFR to the provided audited financial statements". Michigan's own Audit Manual
 * for Local Units of Government mentions the F-65 EXACTLY ONCE, and only to cite
 * the filing requirement (MCL 141.424). Treasury collects the form; it does not
 * check it against the audit.
 *
 * ⚠ Like Pennsylvania, the grade UNDERSTATES what TT knows for THESE two
 * entities: Detroit and Wayne County are far above every audit threshold and
 * both file Single Audits every year, so their "required to have an audit"
 * branch is certainly true. But the branch is not identifiable from the
 * published data for units generally — the F-65 carries no audited flag —
 * so §3.5's weaker branch applies. Second case where the grade understates.
 *
 * ── FUND SCOPE — TWO SERIES PER ENTITY, CHRIS'S CALL 2026-08-30 ─────────────
 *
 * `general_fund` is column a, read directly. `total_governmental` is column a +
 * column b, and the F-65 instructions enumerate column b as exactly the
 * remaining governmental fund types (special revenue, debt service, capital
 * projects, permanent). The form publishes no governmental subtotal of its own,
 * so that row is `derivation='derived'`.
 *
 * ⚠⚠ THE TWO SERIES MUST CARRY DIFFERENT `data_source` STRINGS. SCOPE-04's
 * lesson: a derived row that inherits its parent's label gets its scope
 * overwritten by the next `classifyFundScope` run. The scope is in the label.
 * ⚠ `treasury_sync_city_budget` keys on fund_scope + basis (NOT data_source),
 * so the two series coexist for one entity-year rather than colliding — which is
 * the same keying that made project_sync_city_budget_not_source_safe dangerous
 * when scope was omitted. Here it is passed explicitly, always.
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  buildFiling, filingChecks, SCOPES, CATEGORY_REVENUE, CATEGORY_EXPENDITURE,
} from './lib/michiganF65.mjs';
import { MI_ENTITIES, MI_LOAD_WINDOW, entityByKey } from './data/miKnightEntities.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';

export const SOURCE_PREFIX = 'Michigan Treasury Form F-65 Annual Local Unit Fiscal Report';
export const BASIS_VALUE = 'actual';
const MI_STATE = 'MI';

/** `revenue` -> the F-65's Revenue table; `operating` -> its Expenditure table. */
const DATASETS = Object.freeze([
  Object.freeze({ datasetType: 'revenue', category: CATEGORY_REVENUE, face: 'Revenue by Source' }),
  Object.freeze({ datasetType: 'operating', category: CATEGORY_EXPENDITURE, face: 'Expenditure by Function' }),
]);

export function sourceNameFor(datasetType, fiscalYear, scope) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${SOURCE_PREFIX} — ${face} (FY${fiscalYear} actual, ${scope.label}, excl. financing sources and uses)`;
}

/**
 * ⚠ The fiscal month is READ from the filing, then checked against the roster.
 * `fiscalendmonth` is the ENDING month, so a June end (6) is a July start (7).
 */
export function startMonthFromEnd(endMonth) {
  const m = Number(endMonth);
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return (m % 12) + 1;
}

export function readFiling(path) {
  const filing = JSON.parse(readFileSync(path, 'utf8'));
  const entity = entityByKey(filing.entityKey);
  if (!entity) throw new Error(`Unknown entity key ${filing.entityKey} in ${path}`);
  if (filing.municode !== entity.municode) {
    throw new Error(`municode mismatch in ${path}: ${filing.municode} vs roster ${entity.municode}`);
  }

  // ⚠⚠ RESOLVE THE MONTH PER FILING, never once per state. Michigan's counties
  // split 72 January / 29 October in the FAC census, and Wayne is in the
  // minority — a state-wide default would be wrong by nine months while moving
  // $0 and passing every tie test.
  const months = [...new Set(filing.rows.map((r) => r.fiscalendmonth).filter((v) => v !== undefined && v !== null))];
  if (months.length !== 1) {
    throw new Error(`${filing.entityKey} FY${filing.fiscalYear}: expected one fiscalendmonth, saw ${JSON.stringify(months)}`);
  }
  const readMonth = startMonthFromEnd(months[0]);
  if (readMonth !== entity.fiscalYearStartMonth) {
    throw new Error(`${filing.entityKey} FY${filing.fiscalYear}: filing says start month ${readMonth} `
      + `(fiscalendmonth ${months[0]}) but the roster declares ${entity.fiscalYearStartMonth}`);
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
  return { entity, fiscalYear: filing.fiscalYear, sourceUrl: filing.sourceUrl, built, checks };
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
      dir: { type: 'string', default: '_acfr-work/mi' },
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
  const entities = values.entity ? MI_ENTITIES.filter((e) => e.key === values.entity) : MI_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: MI_LOAD_WINDOW.last - MI_LOAD_WINDOW.first + 1 },
      (_, i) => MI_LOAD_WINDOW.first + i);

  const files = readdirSync(values.dir).filter((f) => f.endsWith('.json')).sort();
  const filings = [];
  for (const f of files) {
    const filing = readFiling(join(values.dir, f));
    if (!entities.some((e) => e.key === filing.entity.key)) continue;
    if (!years.includes(Number(filing.fiscalYear))) continue;
    filings.push(filing);
  }
  filings.sort((a, b) => a.entity.key.localeCompare(b.entity.key) || a.fiscalYear - b.fiscalYear);

  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  let checks = 0;
  let bad = 0;
  const censusNotes = [];
  const suppressedNotes = [];

  for (const f of filings) {
    const fails = f.checks.filter((c) => !c.ok);
    checks += f.checks.length;
    bad += fails.length;
    const gfRev = f.built[`revenue:${SCOPES.general_fund.id}`];
    const tgRev = f.built[`revenue:${SCOPES.total_governmental.id}`];
    const gfExp = f.built[`operating:${SCOPES.general_fund.id}`];
    const tgExp = f.built[`operating:${SCOPES.total_governmental.id}`];
    console.log(`  ${f.entity.name} FY${f.fiscalYear}  (month ${f.entity.fiscalYearStartMonth})`);
    console.log(`    general fund        rev ${usd(gfRev.operating)}   exp ${usd(gfExp.operating)}`
      + `   [financing removed: ${usd(gfRev.financing)} / ${usd(gfExp.financing)}]`);
    console.log(`    governmental funds  rev ${usd(tgRev.operating)}   exp ${usd(tgExp.operating)}`
      + `   [financing removed: ${usd(tgRev.financing)} / ${usd(tgExp.financing)}]`);
    for (const c of fails) {
      console.log(`      CHECK FAILED ${c.id} (${c.kind}): expected ${c.expected.toFixed(2)} got ${c.actual.toFixed(2)} diff ${c.diff.toFixed(2)}`);
    }
    for (const key of Object.keys(f.built)) {
      for (const s of f.built[key].suppressed ?? []) {
        suppressedNotes.push(`${f.entity.name} FY${f.fiscalYear} ${key} — ${s}`);
      }
    }

    // ⚠ censusGuard returns {ok:true} when it has NO evidence. Silence is not
    // confirmation, so an uncovered year is reported as uncovered, never as
    // confirmed — the Florida rule.
    const guard = censusGuard(f.entity.censusName, MI_STATE, f.entity.fiscalYearStartMonth, Number(f.fiscalYear));
    if (guard.error) {
      console.error(`      CENSUS CONTRADICTION: ${guard.error}`);
      bad += 1;
      checks += 1;
    } else if (guard.unknown) {
      censusNotes.push(`${f.entity.name} FY${f.fiscalYear}: UNCOVERED — ${guard.unknown}`);
    } else {
      checks += 1;
    }
  }

  if (suppressedNotes.length) {
    console.log('\nDETAIL SUPPRESSED (declared publisher defect; the verified subtotal is still loaded):');
    for (const s of [...new Set(suppressedNotes)]) console.log(`  - ${s}`);
  }
  if (censusNotes.length) {
    console.log(`\nFAC census UNCOVERED for ${censusNotes.length} entity-years (reported, never counted as confirmed):`);
    for (const n of censusNotes.slice(0, 4)) console.log(`  - ${n}`);
    if (censusNotes.length > 4) console.log(`  ... and ${censusNotes.length - 4} more`);
  }

  console.log(`\nIn-file checks: ${checks - bad}/${checks} pass across ${filings.length} entity-years.`);
  // ⚠⚠ A gate that measured nothing must FAIL, not pass.
  if (checks === 0 || filings.length === 0) {
    console.error('REFUSING: zero checks ran. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  if (bad > 0) {
    console.error(`REFUSING: ${bad} check failures.`);
    process.exit(1);
  }
  if (!values.commit) {
    console.log('\nDry run — nothing written.');
    return filings;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  // Parent counties first, so a child can point at a real id.
  const order = [...entities].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
  const ids = new Map();
  for (const ent of order) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: MI_STATE,
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
  for (const f of filings) {
    const municipalityId = ids.get(f.entity.key);
    for (const { datasetType } of DATASETS) {
      for (const scope of [SCOPES.general_fund, SCOPES.total_governmental]) {
        const built = f.built[`${datasetType}:${scope.id}`];
        const tree = toRpcTree(built);
        const dataSourceName = sourceNameFor(datasetType, f.fiscalYear, scope);

        // Never-overwrite guard, scoped to this entity-year-type-SCOPE.
        const { data: existing, error: lookupErr } = await db
          .schema('treasury').from('budgets')
          .select('id, data_source')
          .eq('municipality_id', municipalityId)
          .eq('fiscal_year', f.fiscalYear)
          .eq('dataset_type', datasetType)
          .eq('fund_scope', scope.id)
          .limit(1);
        if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
        if (existing?.[0] && !String(existing[0].data_source || '').startsWith(SOURCE_PREFIX)) {
          conflicts += 1;
          console.log(`  SKIP ${f.entity.name} FY${f.fiscalYear} ${datasetType}/${scope.id} — "${existing[0].data_source}" preserved`);
          continue;
        }

        const { data, error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: f.fiscalYear,
          p_dataset_type: datasetType,
          p_total: built.operating,
          p_tree: tree,
          p_row_count: tree.length,
          p_data_source_name: dataSourceName,
          p_source_url: f.sourceUrl,
          p_source_date: sourceDate,
          // ⚠⚠ PER ENTITY, READ FROM THE FILING. Detroit is 7, Wayne County is 10.
          p_fiscal_year_start_month: f.entity.fiscalYearStartMonth,
          p_fund_scope: scope.id,
          p_basis: BASIS_VALUE,
          p_derivation: scope.derivation,
        });
        // ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST
        // error. Counting attempts is not counting writes (session 4).
        if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.fiscalYear} ${datasetType}/${scope.id}): ${error.message}`);
        if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.fiscalYear} ${datasetType}/${scope.id}): ${data.error}`);
        if (data?.status !== 'success' || !data?.budget_id) {
          throw new Error(`RPC returned no success status (${f.entity.name} FY${f.fiscalYear} ${datasetType}/${scope.id}): ${JSON.stringify(data)}`);
        }
        written += 1;
        categories += tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
      }
    }
  }
  console.log(`\nWrote ${written} budget rows over ${categories.toLocaleString()} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written.');
    process.exit(1);
  }
  console.log('Now run:  npm run verify:frozen');
  console.log('     then npm run register:rows -- --milestone knight-s7a-mi --match "Michigan Treasury Form F-65"');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadMichiganF65.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
