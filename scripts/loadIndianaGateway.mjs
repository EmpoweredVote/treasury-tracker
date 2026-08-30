/**
 * Load Indiana Gateway Annual Financial Report actuals into TT.
 *
 * NO SHEBANG — kept importable; tests/paInLoad.test.mjs imports `sourceNameFor`.
 *
 * Usage:
 *   node scripts/loadIndianaGateway.mjs --dir _acfr-work/in --dry-run
 *   node scripts/loadIndianaGateway.mjs --dir _acfr-work/in --commit
 *   node scripts/loadIndianaGateway.mjs --dir _acfr-work/in --entity gary --fy 2023 --dry-run
 *
 * Input files, all fetched anonymously from
 * https://gateway.ifionline.org/public/download.aspx with year = "All":
 *
 *   rec_city_ALL.txt       Annual Financial Reports / Detailed Receipts     / City-Town
 *   rec_county_ALL.txt     Annual Financial Reports / Detailed Receipts     / County
 *   disfund_city_ALL.txt   Annual Financial Reports / Disbursements by Fund / City-Town
 *   disfund_county_ALL.txt Annual Financial Reports / Disbursements by Fund / County
 *   cash_city_ALL.txt      Annual Financial Reports / Cash and Investments  / City-Town
 *   cash_county_ALL.txt    Annual Financial Reports / Cash and Investments  / County
 *
 * ── ⚠⚠ THE ORACLE IS A DIFFERENT REPORT, NOT A SELF-TIE ─────────────────────
 *
 * The receipts and disbursements files publish no control total, so summing them
 * and comparing to themselves would be tautological — the Austin rule. Instead
 * every fund is checked against **Cash and Investments**, a SEPARATE Gateway
 * report carrying `r_bal` (receipts) and `d_bal` (disbursements) per fund, which
 * the unit files independently.
 *
 * ⚠ The oracle runs on the FULL governmental parse INCLUDING Settlement, then the
 * documented subset is loaded. Proving the read and choosing the scope are two
 * different jobs — session 3's rule, where DFS's headline deliberately did not
 * equal the loaded total. Never widen the tree to close a gap.
 *
 * ── AUDIT GRADE ─────────────────────────────────────────────────────────────
 *
 * `self_reported_unaudited`, in the publisher's own words. Gateway's explainer
 * "Learn more about … The Annual Financial Report (AFR)", rev. 11/3/2022:
 *
 *   "These reports, as submitted by the units, are made available via Gateway to
 *    the public soon after the deadline for submission (60 days after year end)
 *    or earlier. THESE REPORTS, HOWEVER, ARE UNAUDITED. The State Board of
 *    Accounts (SBOA) uses these Gateway submissions as part of their required
 *    auditing of these units."
 *
 * ⚠ SBOA is a real state auditor and it DOES audit these units — afterwards, on a
 * cycle. The published figures are the pre-audit submission. An audit existing
 * somewhere in the process is not the published figures being audit-derived;
 * that distinction is the whole of the NC / FL / GA arc.
 *
 * Basis is stated too: "Units are required to use a regulatory basis of
 * accounting which complies with the financial reporting provisions of a
 * government regulatory agency (in this case, SBOA)."
 */

import { createClient } from '@supabase/supabase-js';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  eachRow, makeAccumulator, toTree, assertParsed, need, money, pad,
  SETTLEMENT_FUND_CODE, GOVERNMENTAL_ENT_NAME, assertSettlementIsPassThrough,
} from './lib/inGateway.mjs';
import { IN_ENTITIES, PA_IN_LOAD_WINDOW } from './data/paInKnightEntities.mjs';

export const SOURCE_PREFIX = 'Indiana Gateway Annual Financial Report';
export const SOURCE_URL = 'https://gateway.ifionline.org/public/download.aspx';
export const FUND_SCOPE = 'total_governmental';
export const BASIS_VALUE = 'actual';
// ⚠ `published` or `derived` ONLY — budgets_derivation_check allows nothing else.
// Selecting a documented subset of published line items is still publishing them;
// nothing here is computed by TT.
export const DERIVATION = 'published';
const IN_STATE = 'IN';
const EPS = 1.0; // whole-dollar files; float slack only

export function sourceNameFor(datasetType, fiscalYear) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${SOURCE_PREFIX} — ${face} (FY${fiscalYear} actual, unaudited, excl. settlement funds)`;
}

/** Read the Cash and Investments oracle for one entity-year: fund -> {r, d}. */
export async function readCashOracle(path, entity, year) {
  const out = new Map();
  let seen = 0;
  await eachRow(path, (r, ix) => {
    if (String(r[need(ix, 'year')]).trim() !== String(year)) return;
    if (pad(r[need(ix, 'cnty_cd')], 2) !== entity.countyCode) return;
    if (pad(r[need(ix, 'unit_code')], 4) !== entity.unitCode) return;
    if (String(r[need(ix, 'ent_name')]).trim() !== GOVERNMENTAL_ENT_NAME) return;
    const fk = `${String(r[need(ix, 'fund_code')]).trim()}|${String(r[need(ix, 'unit_fund_number')] ?? '').trim()}`;
    const prev = out.get(fk) ?? { r: 0, d: 0 };
    prev.r += money(r[need(ix, 'r_bal')]);
    prev.d += money(r[need(ix, 'd_bal')]);
    out.set(fk, prev);
    seen++;
  });
  return { byFund: out, seen };
}

/**
 * Compare the FULL governmental parse against the Cash and Investments report,
 * fund by fund. Returns every check; the caller refuses on any failure.
 */
export function oracleChecks(parsedByFund, oracleByFund, which) {
  const checks = [];
  const keys = new Set([...parsedByFund.keys(), ...oracleByFund.keys()]);
  for (const k of keys) {
    const mine = parsedByFund.get(k) ?? 0;
    const theirs = (oracleByFund.get(k) ?? { r: 0, d: 0 })[which];
    // Funds with no activity on either side are not a check, they are silence.
    if (mine === 0 && theirs === 0) continue;
    checks.push({ fund: k, expected: theirs, actual: mine, diff: theirs - mine, ok: Math.abs(theirs - mine) <= EPS });
  }
  return checks;
}

/**
 * Collect every (entity, year) in ONE PASS PER FILE.
 *
 * ⚠ The naive shape — stream the file once per entity-year — costs 120 passes
 * over 50-127 MB files for a full run. These files are big enough that it
 * matters, so accumulators are indexed by `cnty_cd|unit_code|year` and each row
 * is dispatched to at most one of them.
 */
async function collectAll(dir, entities, years) {
  const groups = [
    { kind: 'revenue', county: false, file: 'rec_city_ALL.txt' },
    { kind: 'revenue', county: true, file: 'rec_county_ALL.txt' },
    { kind: 'operating', county: false, file: 'disfund_city_ALL.txt' },
    { kind: 'operating', county: true, file: 'disfund_county_ALL.txt' },
  ];
  const cashGroups = [
    { county: false, file: 'cash_city_ALL.txt' },
    { county: true, file: 'cash_county_ALL.txt' },
  ];
  const key = (cc, uc, y) => `${cc}|${uc}|${y}`;
  const acc = new Map();   // kind -> Map(key -> accumulator)
  const cash = new Map();  // key -> {byFund, seen}

  for (const g of groups) {
    const want = new Map();
    for (const e of entities) {
      if ((e.entityType === 'county') !== g.county) continue;
      for (const y of years) {
        want.set(key(e.countyCode, e.unitCode, y), makeAccumulator({ entity: e, year: y, kind: g.kind }));
      }
    }
    if (!want.size) continue;
    await eachRow(join(dir, g.file), (r, ix) => {
      const k = key(pad(r[need(ix, 'cnty_cd')], 2), pad(r[need(ix, 'unit_code')], 4),
        String(r[need(ix, 'year')]).trim());
      const a = want.get(k);
      if (a) a.consume(r, ix);
    });
    if (!acc.has(g.kind)) acc.set(g.kind, new Map());
    for (const [k, a] of want) acc.get(g.kind).set(k, a);
  }

  for (const g of cashGroups) {
    const want = new Set();
    for (const e of entities) {
      if ((e.entityType === 'county') !== g.county) continue;
      for (const y of years) want.add(key(e.countyCode, e.unitCode, y));
    }
    if (!want.size) continue;
    for (const k of want) cash.set(k, { byFund: new Map(), seen: 0 });
    await eachRow(join(dir, g.file), (r, ix) => {
      const k = key(pad(r[need(ix, 'cnty_cd')], 2), pad(r[need(ix, 'unit_code')], 4),
        String(r[need(ix, 'year')]).trim());
      const slot = cash.get(k);
      if (!slot) return;
      if (String(r[need(ix, 'ent_name')]).trim() !== GOVERNMENTAL_ENT_NAME) return;
      const fk = `${String(r[need(ix, 'fund_code')]).trim()}|${String(r[need(ix, 'unit_fund_number')] ?? '').trim()}`;
      const prev = slot.byFund.get(fk) ?? { r: 0, d: 0 };
      prev.r += money(r[need(ix, 'r_bal')]);
      prev.d += money(r[need(ix, 'd_bal')]);
      slot.byFund.set(fk, prev);
      slot.seen++;
    });
  }

  const out = [];
  const notFiled = [];
  for (const entity of entities) {
    for (const year of years) {
      const k = key(entity.countyCode, entity.unitCode, year);
      const rev0 = acc.get('revenue').get(k).result();
      const exp0 = acc.get('operating').get(k).result();

      // ⚠⚠ "NOT FILED" AND "PARSE BROKE" MUST NOT BE CONFLATED.
      // Gary genuinely did not file FY2015 — it is absent from BOTH the receipts
      // and the disbursements extracts while 2011-2014 and 2016-2024 are present.
      // That is a real gap in the source and is REPORTED, never silently skipped
      // and never counted as a pass. But a year missing from only ONE side is a
      // parse defect and must fail loudly: this is session 3's zero-row parse
      // that printed "Oracle green" from 0 checks.
      if (rev0.rows === 0 && exp0.rows === 0) {
        notFiled.push({ entity, year });
        continue;
      }
      const revRes = assertParsed(rev0, `${entity.name} FY${year} revenue`);
      const expRes = assertParsed(exp0, `${entity.name} FY${year} operating`);
      // ⚠ Corroborate the settlement identification: what a pass-through takes
      // in must go straight back out. Refuses rather than quietly removing money.
      assertSettlementIsPassThrough(revRes, expRes, `${entity.name} FY${year}`);
      const c = cash.get(k) ?? { byFund: new Map(), seen: 0 };
      out.push({
        entity, year, revenue: revRes, operating: expRes, cash: c,
        checks: {
          revenue: oracleChecks(revRes.byFund, c.byFund, 'r'),
          operating: oracleChecks(expRes.byFund, c.byFund, 'd'),
        },
      });
    }
  }
  if (notFiled.length) {
    console.log('NOT FILED in the source (reported, not silently skipped):');
    for (const { entity, year } of notFiled) console.log(`  - ${entity.name} FY${year}`);
    console.log('');
  }
  return out;
}

function report(f) {
  const { entity, year } = f;
  const bad = [...f.checks.revenue, ...f.checks.operating].filter((c) => !c.ok);
  const nChecks = f.checks.revenue.length + f.checks.operating.length;
  console.log(`  ${entity.name} FY${year}`);
  console.log(`    revenue   subset ${f.revenue.subsetTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    + `  (full ${f.revenue.fullTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    + `, settlement ${f.revenue.settlementTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`);
  console.log(`    operating subset ${f.operating.subsetTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    + `  (full ${f.operating.fullTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
    + `, settlement ${f.operating.settlementTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})`);
  for (const which of ['revenue', 'operating']) {
    const no = f[which].nonOperating;
    if (no && no.size) {
      const parts = [...no].sort((a, b) => b[1] - a[1])
        .map(([c, a]) => `${c} ${a.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`);
      console.log(`    ${which} excluded non-operating: ${parts.join(', ')}`);
    }
  }
  console.log(`    oracle vs Cash and Investments: ${nChecks - bad.length}/${nChecks} funds tie`);
  for (const c of bad.slice(0, 6)) {
    console.log(`      MISMATCH fund ${c.fund}: cash-report ${c.expected.toFixed(2)} vs parsed ${c.actual.toFixed(2)} (diff ${c.diff.toFixed(2)})`);
  }
  if (bad.length > 6) console.log(`      … and ${bad.length - 6} more`);
  return { nChecks, bad: bad.length };
}

export async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/in' },
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

  const entities = values.entity
    ? IN_ENTITIES.filter((e) => e.key === values.entity)
    : IN_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: PA_IN_LOAD_WINDOW.last - PA_IN_LOAD_WINDOW.first + 1 },
      (_, i) => PA_IN_LOAD_WINDOW.first + i);

  console.log(`Indiana Gateway — ${entities.length} entities x ${years.length} years`);
  console.log(`Settlement funds (Fund_code ${SETTLEMENT_FUND_CODE}) EXCLUDED; oracle runs on the full parse.\n`);

  const filings = await collectAll(values.dir, entities, years.map(String));
  let totalChecks = 0;
  let totalBad = 0;
  for (const f of filings) {
    const r = report(f);
    totalChecks += r.nChecks;
    totalBad += r.bad;
  }

  console.log(`\nOracle: ${totalChecks - totalBad}/${totalChecks} fund-level checks tie against Cash and Investments.`);
  // ⚠⚠ A gate that measured nothing must FAIL, not pass (session 3).
  if (totalChecks === 0) {
    console.error('REFUSING: zero oracle checks ran. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  if (totalBad > 0) {
    console.error(`REFUSING: ${totalBad} oracle mismatches.`);
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

  // Counties first — a city's county_id must exist before the city references it.
  const order = [...entities].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
  const ids = new Map();
  for (const ent of order) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name, p_state: IN_STATE,
      p_entity_type: ent.entityType, p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name} -> ${data}`);
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
    for (const datasetType of ['operating', 'revenue']) {
      const res = f[datasetType];
      const tree = toTree(res.tree);
      // Never-overwrite guard: treasury_sync_city_budget is NOT source-safe — it
      // never updates data_source, so it would overwrite another publisher's row
      // or silently insert a duplicate.
      const { data: existing, error: lookupErr } = await db
        .schema('treasury').from('budgets')
        .select('id, data_source')
        .eq('municipality_id', municipalityId)
        .eq('fiscal_year', Number(f.year))
        .eq('dataset_type', datasetType)
        .limit(1);
      if (lookupErr) throw new Error(`Budget lookup failed: ${lookupErr.message}`);
      if (existing?.[0] && !String(existing[0].data_source || '').startsWith(SOURCE_PREFIX)) {
        conflicts++;
        console.log(`  SKIP ${f.entity.name} FY${f.year} ${datasetType} — "${existing[0].data_source}" preserved`);
        continue;
      }
      const { data, error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: Number(f.year),
        p_dataset_type: datasetType,
        p_total: res.subsetTotal,
        p_tree: tree,
        p_row_count: tree.length,
        p_data_source_name: sourceNameFor(datasetType, Number(f.year)),
        p_source_url: SOURCE_URL,
        p_source_date: sourceDate,
        p_fiscal_year_start_month: f.entity.fiscalYearStartMonth,
        // ⚠⚠ LOAD-BEARING. The RPC keys on (municipality, fiscal_year,
        // dataset_type, fund_scope, basis). Omit them and both default to
        // 'unknown', so a re-run after the stampers matches nothing, takes the
        // INSERT branch, and silently duplicates every row.
        p_fund_scope: FUND_SCOPE,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      // ⚠⚠ THE RPC REPORTS FAILURE IN ITS RETURN PAYLOAD, NOT AS A POSTGREST
      // ERROR — it ends with EXCEPTION WHEN OTHERS THEN RETURN
      // jsonb_build_object('error', SQLERRM). Checking only `error` made the
      // Georgia loader print "Wrote 76 budget rows" having written NONE.
      // Counting attempts is not counting writes.
      if (error) throw new Error(`RPC transport error (${f.entity.name} FY${f.year} ${datasetType}): ${error.message}`);
      if (data?.error) throw new Error(`RPC refused (${f.entity.name} FY${f.year} ${datasetType}): ${data.error}`);
      if (data?.status !== 'success' || !data?.budget_id) {
        throw new Error(`RPC returned no success status (${f.entity.name} FY${f.year} ${datasetType}): ${JSON.stringify(data)}`);
      }
      written++;
      categories += tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
    }
  }
  console.log(`\nWrote ${written} budget rows over ${categories.toLocaleString()} categories `
    + `(${conflicts} skipped by the never-overwrite guard).`);
  if (written === 0 || categories === 0) {
    console.error('REFUSING: no rows were actually written. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  console.log('Now run:  npm run verify:frozen');
  console.log('     then npm run register:rows -- --milestone knight-s5-pa-in --match "Indiana Gateway Annual Financial Report"');
  return filings;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadIndianaGateway.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
