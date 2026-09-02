/**
 * Florida DFS LOGERx Annual Financial Report loader (Knight campaign, session 3).
 *
 * NO SHEBANG — kept importable. tests/floridaDfs.test.mjs imports `sourceNameFor`
 * from here to prove the audit branch reaches the grade registry, and a `#!` on
 * any module a test imports breaks `npm test` on Windows. The guard in
 * tests/waSao.test.mjs caught this one before it shipped, which is the third
 * time that guard has earned its place.
 *
 * Loads the seven session-3 entities — Miami, Tallahassee, Bradenton, and the
 * counties Miami-Dade, Leon, Manatee and Palm Beach (itself a Knight community)
 * — from the cached public LOGERx system reports. Florida's first locals in TT.
 *
 * Mirrors scripts/loadOhioAOS.js for the write path: the never-overwrite guard,
 * `treasury_ensure_municipality` + `treasury_sync_city_budget`, and per-entity
 * fiscal months. It differs in three ways that matter.
 *
 * ── 1. THE SCOPE IS A DOCUMENTED SUBSET OF AN ORACLED PARSE ─────────────────
 *
 * `fund_scope = 'total_governmental'`: General + Special Revenue + Debt Service
 * + Capital Projects + Permanent. Not inferred — the source publishes the funds
 * as SEPARATE COLUMNS, so which ones TT summed is a fact.
 *
 * Two things the publisher itself calls non-revenue and non-expenditure are
 * excluded (see scripts/lib/floridaDfs.mjs for the verbatim UAS Manual text):
 * expenditure object code 90 "Other Uses" (interfund transfers) and revenue
 * accounts 38x/39x "Other Sources" (interfund transfers, plus 384 Debt Proceeds
 * and 385 Proceeds From Refunding Bonds — the Los Angeles TRAN shape).
 *
 * ⚠ DFS's own published total INCLUDES both, so the loaded total deliberately
 * does NOT equal it. The oracle is run over the FULL parse instead; see
 * scripts/verifyFloridaDFS.mjs. Never widen the tree to close that gap.
 *
 * ── 2. `audit_grade` IS DECIDED PER ENTITY PER YEAR ─────────────────────────
 *
 * DFS staff "reconciles the AFR to the provided audited financial statements OR
 * Data Element Worksheet" before a filing becomes *Verified by DFS*. The first
 * branch is `compiled_from_audited`; the second is a self-completed worksheet.
 * Which branch applied is public per filing — the compliance reports carry
 * `Audit Received Date` and `Audit Completion Date`.
 *
 * The branch is written into `data_source` so the grade registry can classify it
 * without re-reading a workbook, the same way session 2 encoded Charlotte's FY
 * window into its source string.
 *
 * ⚠ A DEW-branch entity-year IS NOT LOADED by default. All 95 loadable
 * entity-years for these seven are audit-reconciled, so nothing is lost here —
 * but a future statewide sweep will hit thousands of DEW filings, and that is a
 * decision to make deliberately rather than a row to write quietly at a lower
 * grade. `--allow-dew` exists so the choice is explicit and visible in the shell
 * history.
 *
 * ── 3. THE FISCAL MONTH IS CONFIRMED PER ROW, NOT PER STATE ─────────────────
 *
 * Florida is an October state (FYE 9/30 for all 262 cities and 49 counties in
 * the FY2023 compliance report) and North Carolina, loaded one session earlier,
 * is July. `project_fysm_column_default_one_defect` is exactly the defect of
 * carrying a month across a state boundary, so every row goes through
 * `censusGuard()` against the entity's own federally filed audit period.
 *
 * ⚠ `censusGuard()` returns `{ok:true}` when it cannot find the entity — silence
 * is not agreement. This loader therefore reports CONFIRMED and UNVERIFIED
 * separately and refuses to describe the second as the first. Miami-Dade is
 * spelled "Miami Dade County" in the census and is covered only for 2023-2025;
 * Palm Beach County is absent 2021-2024; Bradenton is absent 2014/2015/2017.
 *
 * Usage:
 *   node scripts/loadFloridaDFS.mjs --dry-run
 *   node scripts/loadFloridaDFS.mjs --code 200239 --year 2023 --dry-run
 *   node scripts/loadFloridaDFS.mjs
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

import {
  readDetailRows, readTotalsRows, readComplianceRows, mergeCompliance, assertParsed,
  buildExpenditureTree, buildRevenueTree, oracleTotalFor, hasAuditOnFile,
  GOVERNMENTAL_FUNDS, SHEET_NAME,
} from './lib/floridaDfs.mjs';
import {
  FL_ENTITIES, FL_STATE, FL_FIRST_YEAR, FL_LAST_YEAR,
} from './data/floridaKnightEntities.mjs';
import { censusGuard } from './lib/facFiscalYearCensus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'docs/fl-dfs');

/**
 * The `data_source` family prefix. Every row this loader writes starts with it,
 * and the never-overwrite guard tests the PREFIX rather than a constant, because
 * the full string carries the fiscal year and the reconciliation branch.
 */
export const SOURCE_PREFIX = 'Florida DFS Annual Financial Report';

/** The durable first-party citation — see scripts/fetchFloridaDFS.mjs. */
export const SOURCE_URL = 'https://logerx.myfloridacfo.gov/LogerX/PublicReportsMenu';

export const DATASET_LABEL = {
  operating: 'Expenditure by Function',
  revenue: 'Revenue by Source',
};

/**
 * The axis values every row of this family carries.
 *
 * ⚠ They are passed to the RPC at write time, not left to a stamper, because the
 * RPC's target lookup key INCLUDES fund_scope and basis — see the note at the
 * call site. They must stay in step with the registry entries
 * (`fl-dfs-afr` in fundScopeRegistry / basisRegistry), which
 * tests/floridaDfs.test.mjs asserts.
 */
export const FUND_SCOPE = 'total_governmental';
export const BASIS_VALUE = 'actual';
export const DERIVATION = 'published';

/**
 * Build the `data_source` string for one row.
 *
 * ⚠ THE BRANCH IS PART OF THE NAME, NOT A COMMENT. `audit_grade` for this family
 * is not a property of the publisher, it is a property of the individual filing,
 * and the registry classifies on `data_source` alone. Encoding it here is what
 * lets a DEW-reconciled row be graded differently from an audit-reconciled one
 * without the grader needing to re-open a workbook.
 */
export function sourceNameFor(datasetType, fiscalYear, auditReconciled) {
  return sourceNameForBranch(datasetType, fiscalYear, auditReconciled ? 'audit-reconciled' : 'DEW-reconciled');
}

/**
 * The three reconciliation branches a Florida filing can carry.
 *
 * ⚠⚠ `branch-unrecorded` IS NOT `DEW-reconciled`, AND CONFLATING THEM ASSERTS A
 * FACT THE RECORD DOES NOT CONTAIN.
 *
 * `hasAuditOnFile` returns false for an entity that IS listed in a compliance
 * report but whose `Audit Received Date` and `Audit Completion Date` are both
 * blank. That is "DFS's record does not say", not "a Data Element Worksheet was
 * used" — and the difference is not academic: across all fourteen published
 * years exactly four city-years have a blank pair, and one of them is **Tampa
 * FY2013**, Florida's third-largest city, which was certainly audited.
 *
 * Neither `branch-unrecorded` nor `DEW-reconciled` has an entry in
 * `auditGradeRegistry`, so both grade `unknown` — which is what "we do not know"
 * should look like to a reader. The label exists so the row says *why* it is
 * unknown rather than claiming the weaker branch happened.
 */
export const SOURCE_BRANCHES = Object.freeze(['audit-reconciled', 'DEW-reconciled', 'branch-unrecorded']);

export function sourceNameForBranch(datasetType, fiscalYear, branch) {
  const label = DATASET_LABEL[datasetType];
  if (!label) throw new Error(`unknown dataset type ${datasetType}`);
  if (!SOURCE_BRANCHES.includes(branch)) {
    throw new Error(`unknown reconciliation branch ${JSON.stringify(branch)} — `
      + `expected one of ${SOURCE_BRANCHES.join(', ')}`);
  }
  return `${SOURCE_PREFIX} — ${label} (FY${fiscalYear} actual, ${branch})`;
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

let _db = null;
async function getDb() {
  if (_db) return _db;
  loadEnv();
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env). Use --dry-run for a no-write parse.');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  _db = createClient(url, key);
  return _db;
}

const wbCache = new Map();
async function sheetFor(report, year) {
  const key = `${report}-${year}`;
  if (wbCache.has(key)) return wbCache.get(key);
  const file = path.join(CACHE, `${key}.xlsx`);
  if (!existsSync(file)) { wbCache.set(key, null); return null; }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(SHEET_NAME) || null;
  wbCache.set(key, ws);
  return ws;
}

/**
 * Read-only never-overwrite guard.
 *
 * `treasury_sync_city_budget` is NOT source-safe (auto-memory
 * project_sync_city_budget_not_source_safe): it never updates `data_source`, so
 * it will either overwrite another publisher's row or silently insert a
 * duplicate. Nothing is written when a DIFFERENT family already owns the slot.
 */
export async function findConflictingBudget(db, municipalityId, fiscalYear, datasetType) {
  const { data, error } = await db
    .schema('treasury').from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType)
    .limit(1);
  if (error) throw new Error(`Budget lookup failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  const owned = typeof existing.data_source === 'string' && existing.data_source.startsWith(SOURCE_PREFIX);
  return owned ? null : existing;
}

/**
 * Resolve the fiscal-year start month for one entity-year, and say how it was
 * resolved. Never returns a month the census contradicts.
 */
export function resolveMonth(ent, fiscalYear) {
  const guard = censusGuard(ent.censusName, FL_STATE, ent.fiscalYearStartMonth, fiscalYear);
  if (guard.error) return { error: guard.error };
  // guard.month is set only when the census actively AGREED.
  if (guard.month) return { month: guard.month, confirmed: true };
  return { month: ent.fiscalYearStartMonth, confirmed: false, why: guard.unknown };
}

async function main() {
  const { values } = parseArgs({
    options: {
      code: { type: 'string' },
      year: { type: 'string' },
      'dry-run': { type: 'boolean' },
      'allow-dew': { type: 'boolean' },
      'source-date': { type: 'string' },
    },
  });

  const dryRun = values['dry-run'] || false;
  const sourceDate = values['source-date'] || new Date().toISOString().slice(0, 10);
  const years = values.year
    ? [Number(values.year)]
    : Array.from({ length: FL_LAST_YEAR - FL_FIRST_YEAR + 1 }, (_, i) => FL_FIRST_YEAR + i);
  const entities = values.code ? FL_ENTITIES.filter((e) => e.code === values.code) : FL_ENTITIES;
  if (entities.length === 0) { console.error(`No entity with code ${values.code}`); process.exit(1); }

  const db = dryRun ? null : await getDb();
  const municipalityIds = new Map();

  const stats = {
    written: 0, skippedConflict: 0, notFiled: 0, dewSkipped: 0,
    confirmed: 0, unverified: 0, oracleChecks: 0,
  };
  const unverifiedNotes = [];
  const mergeNotes = [];

  console.log(`\nFlorida DFS Annual Financial Report — ${entities.length} entities, `
    + `FY${years[0]}-FY${years[years.length - 1]}${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  Source URL:  ${SOURCE_URL}`);
  console.log(`  Source date: ${sourceDate}`);
  console.log(`  Scope:       total_governmental (${GOVERNMENTAL_FUNDS.join(' + ')})\n`);

  for (const year of years) {
    const expWs = await sheetFor('EXPENDITUREDETAILREPORT', year);
    const revWs = await sheetFor('REVENUEDETAILREPORT', year);
    const totWs = await sheetFor('TOTALREVEXPDEBT', year);
    if (!expWs || !revWs || !totWs) {
      console.warn(`  FY${year}: cached workbooks missing — run scripts/fetchFloridaDFS.mjs first`);
      continue;
    }
    const expRows = assertParsed(readDetailRows(expWs), `EXPENDITUREDETAILREPORT FY${year}`);
    const revRows = assertParsed(readDetailRows(revWs), `REVENUEDETAILREPORT FY${year}`);
    const totals = readTotalsRows(totWs);
    if (totals.size === 0) throw new Error(`TOTALREVEXPDEBT FY${year}: parsed 0 rows — the oracle is empty`);

    const cWs = await sheetFor('PUBLICCOMPLIANTGOVS', year);
    const nWs = await sheetFor('PUBLICNONCOMPLIANTGOVS', year);
    const compliance = mergeCompliance(
      cWs ? readComplianceRows(cWs) : new Map(),
      nWs ? readComplianceRows(nWs) : new Map(),
    );

    for (const ent of entities) {
      const filed = expRows.some((r) => r.code === ent.code) || revRows.some((r) => r.code === ent.code);
      if (!filed) {
        stats.notFiled++;
        console.log(`  FY${year} ${ent.label.padEnd(19)} not filed — skipped`);
        continue;
      }

      // ── The oracle, re-run at load time. A load must not be able to write a
      //    figure the verifier never checked, so this is not delegated to a
      //    script somebody might forget to run.
      const oracle = totals.get(`${ent.unitType}|${ent.unitName}`);
      const expOracle = oracleTotalFor(expRows, ent.code);
      const revOracle = oracleTotalFor(revRows, ent.code);
      if (!oracle || oracle.expenditures == null || oracle.revenues == null) {
        throw new Error(`FY${year} ${ent.label}: no DFS total to oracle against `
          + `(looked up "${ent.unitType}|${ent.unitName}")`);
      }
      if (expOracle !== oracle.expenditures || revOracle !== oracle.revenues) {
        throw new Error(`FY${year} ${ent.label}: ORACLE DRIFT — parsed expenditures ${expOracle} vs `
          + `DFS ${oracle.expenditures}; parsed revenues ${revOracle} vs DFS ${oracle.revenues}`);
      }
      stats.oracleChecks++;

      // ── The audit branch.
      const audited = hasAuditOnFile(compliance, ent.code);
      if (audited === null) {
        throw new Error(`FY${year} ${ent.label}: absent from BOTH compliance reports, so the `
          + 'reconciliation branch is unknown. "No record" is not "no audit" — refusing to grade it.');
      }
      if (!audited && !values['allow-dew']) {
        stats.dewSkipped++;
        console.log(`  FY${year} ${ent.label.padEnd(19)} DEW-reconciled (no audit on file) — skipped; `
          + 'pass --allow-dew to load it at the weaker grade');
        continue;
      }

      // ── The fiscal month.
      const m = resolveMonth(ent, year);
      if (m.error) throw new Error(`FY${year} ${ent.label}: ${m.error}`);
      if (m.confirmed) stats.confirmed++;
      else { stats.unverified++; unverifiedNotes.push(`FY${year} ${ent.label}: ${m.why}`); }

      const exp = buildExpenditureTree(expRows, ent.code, GOVERNMENTAL_FUNDS);
      const rev = buildRevenueTree(revRows, ent.code, GOVERNMENTAL_FUNDS);

      // ⚠ A label merge must never be silent. Two source codes can strip to one
      // display label (seven such pairs exist statewide); the amounts sum, which
      // cannot move a total, but the reader deserves to know two codes became one
      // node. None of these seven entities triggers it — the statewide sweep will.
      const merges = [...new Set([...exp.merged, ...rev.merged])];
      for (const m of merges) mergeNotes.push(`FY${year} ${ent.label}: ${m}`);

      const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');
      console.log(`  FY${year} ${ent.label.padEnd(19)} oracle $0 · month ${m.month}`
        + `${m.confirmed ? ' CONFIRMED' : ' unverified'} · operating ${fmt(exp.total)} (${exp.tree.length}) `
        + `· revenue ${fmt(rev.total)} (${rev.tree.length})`);

      if (dryRun) continue;

      let municipalityId = municipalityIds.get(ent.dbName);
      if (!municipalityId) {
        const { data, error } = await db.rpc('treasury_ensure_municipality', {
          p_name: ent.dbName,
          p_state: FL_STATE,
          p_entity_type: ent.entityType,
          p_population: ent.population,
        });
        if (error) throw new Error(`Municipality error (${ent.dbName}): ${error.message}`);
        municipalityId = data;
        municipalityIds.set(ent.dbName, municipalityId);
      }

      for (const [datasetType, built] of [['operating', exp], ['revenue', rev]]) {
        const conflict = await findConflictingBudget(db, municipalityId, year, datasetType);
        if (conflict) {
          stats.skippedConflict++;
          console.log(`      SKIP ${datasetType} — existing "${conflict.data_source}" preserved (never-overwrite)`);
          continue;
        }
        const { error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: year,
          p_dataset_type: datasetType,
          p_total: built.total,
          p_tree: built.tree,
          p_row_count: built.tree.length,
          p_data_source_name: sourceNameFor(datasetType, year, audited),
          p_source_url: SOURCE_URL,
          p_source_date: sourceDate,
          p_fiscal_year_start_month: m.month,
          // ⚠⚠ THESE TWO ARE LOAD-BEARING, NOT DECORATION. The RPC's target
          // lookup key is (municipality, fiscal_year, dataset_type, fund_scope,
          // basis). Omitting them defaults BOTH to 'unknown', so once the axis
          // stampers have run, a re-run matches NOTHING and the RPC takes its
          // INSERT branch — silently creating a duplicate of every row instead
          // of updating it. The first Florida load omitted them and the relabel
          // re-run would have inserted 190 phantom rows.
          //
          // Passing them also means a row is born correctly classified instead
          // of being 'unknown' until a stamper catches up; the stampers then
          // confirm rather than repair.
          p_fund_scope: FUND_SCOPE,
          p_basis: BASIS_VALUE,
          p_derivation: DERIVATION,
        });
        if (error) throw new Error(`RPC error (${ent.label} FY${year} ${datasetType}): ${error.message}`);
        stats.written++;
      }
    }
  }

  console.log(`\n  oracle ties $0:      ${stats.oracleChecks} entity-years`);
  console.log(`  rows written:        ${stats.written}`);
  console.log(`  skipped, conflict:   ${stats.skippedConflict}`);
  console.log(`  skipped, not filed:  ${stats.notFiled}`);
  console.log(`  skipped, DEW branch: ${stats.dewSkipped}`);
  console.log(`  fiscal month:        ${stats.confirmed} census-CONFIRMED, ${stats.unverified} unverified`);
  if (unverifiedNotes.length) {
    console.log('\n  ⚠ UNVERIFIED fiscal months — the census has no evidence for these, which is NOT');
    console.log('    the same as agreement. The month written is the entity\'s declared October.');
    for (const n of unverifiedNotes) console.log(`      ${n}`);
  }
  if (mergeNotes.length) {
    console.log(`
  ⚠ ${mergeNotes.length} label MERGE(S) — two account codes stripped to one`);
    console.log('    display label and were summed. The total is unmoved; the node count is not.');
    for (const n of mergeNotes) console.log(`      ${n}`);
  } else {
    console.log('  label merges:       none (no two account codes share a display label here)');
  }
  if (!dryRun && stats.written > 0) {
    console.log('\n  Next, while you still know what was loaded:');
    console.log('      npm run verify:frozen');
    console.log('      npm run register:rows -- --milestone knight-s3-florida --match "Florida DFS"');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
