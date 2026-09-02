/**
 * Florida statewide Annual Financial Report loader — all 479 filing cities and
 * counties, FY2012-FY2025.
 *
 * NO SHEBANG — kept importable; tests import `plannedRowsFor` and `entityYearPlan`.
 *
 * Usage:
 *   node scripts/loadFlStatewide.mjs --dry-run                 # parse + oracle, no writes
 *   node scripts/loadFlStatewide.mjs --year 2023 --dry-run
 *   node scripts/loadFlStatewide.mjs --year 2023               # ⚠ drive ONE YEAR AT A TIME
 *   node scripts/loadFlStatewide.mjs --code 200361 --dry-run
 *
 * The write path is scripts/loadFloridaDFS.mjs's, imported rather than copied:
 * the never-overwrite guard, the source-name builder, the fund-scope/basis axes
 * and the source URL all come from there, so the two loaders cannot drift into
 * writing the same family two different ways.
 *
 * ── ⚠ DRIVE PER YEAR, IN A RETRY LOOP ──────────────────────────────────────
 *
 * Michigan's sweep taught this: one run over every year loses everything when a
 * single request fails, and parsing every year at once will not fit in the heap.
 * Per-year also tells you WHICH year broke. The RPC upserts on
 * (entity, year, dataset, fund_scope, basis), so a re-run cannot duplicate.
 *
 * ── WHAT IS CHECKED BEFORE A SINGLE ROW IS WRITTEN ─────────────────────────
 *
 * Per entity-year, every time, with no way to skip:
 *
 *   1. PRESENCE   the entity actually appears in that year's detail report.
 *                 ⚠ FY2025 is partial — 182 cities against 404 for FY2024 — and
 *                 a partial year downloads as a perfectly well-formed workbook.
 *   2. ORACLE     the full parse (every account, every object code, over
 *                 ORACLE_FUNDS) must equal DFS's independently published
 *                 `TOTALREVEXPDEBT` figure TO THE CENT, for revenue AND
 *                 expenditure. The loaded tree is then a documented subset of a
 *                 parse proven correct — see loadFloridaDFS.mjs for why the
 *                 loaded total deliberately does NOT equal the DFS total.
 *   3. BRANCH     audit-reconciled / branch-unrecorded, from the compliance
 *                 reports, unioned. `absent` is refused outright.
 *   4. MONTH      the publisher's own FYE, cross-checked against the federal
 *                 audit record where it covers the entity-year. A CONFLICT
 *                 refuses the row; absence is recorded as unverified and never
 *                 described as agreement.
 *
 * ⚠ The registry already resolved 3 and 4 at generation time. They are re-run
 * here anyway, from the workbooks, because a loader that trusts a generated file
 * can write a figure no gate ever checked.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

import {
  readDetailRows, readTotalsRows, readComplianceRows, mergeCompliance, assertParsed,
  buildExpenditureTree, buildRevenueTree, oracleTotalFor, moneyEquals,
  GOVERNMENTAL_FUNDS, SHEET_NAME,
} from './lib/floridaDfs.mjs';
import {
  SOURCE_URL, FUND_SCOPE, BASIS_VALUE, DERIVATION,
  sourceNameForBranch, findConflictingBudget,
} from './loadFloridaDFS.mjs';
import { auditBranchFor, monthFromFye } from './buildFlStatewideRoster.mjs';
import { resolveGuard, facCandidatesFor } from './buildFlStatewideEntities.mjs';
import { FL_STATEWIDE_ENTITIES, FL_STATE, FL_STATEWIDE_LOAD_WINDOW } from './data/flStatewideEntities.mjs';
import { FL_ORACLE_DRIFT, declaredDriftFor } from './data/flOracleDrift.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'docs/fl-dfs');

/** Two datasets per entity-year: operating and revenue. */
export const DATASETS = ['operating', 'revenue'];

/** How many budget rows a clean full load would write. */
export function plannedRowsFor(entities = FL_STATEWIDE_ENTITIES) {
  return entities.reduce((s, e) => s + e.fiscalYears.length, 0) * DATASETS.length;
}

/**
 * Decide everything about one entity-year without touching the database.
 *
 * Exported so the pre-load survey can run EXACTLY the gates the loader runs.
 * ⚠⚠ Michigan's survey ran a different set and reported 99.75% clean while the
 * loader then failed 15 filings. A survey that runs different gates is not a
 * survey — so there is only one implementation, and both callers use it.
 *
 * @returns {{ok:boolean, reason?:string, month?:number, guard?:string, branch?:string,
 *             exp?:object, rev?:object}}
 */
export function entityYearPlan(ent, year, { expRows, revRows, totals, compliance }) {
  const filed = expRows.some((r) => r.code === ent.code) || revRows.some((r) => r.code === ent.code);
  if (!filed) return { ok: false, reason: 'not filed' };

  // ── 2. The oracle.
  const oracle = totals.get(`${ent.unitType}|${ent.unitName}`);
  if (!oracle || oracle.expenditures == null || oracle.revenues == null) {
    return {
      ok: false,
      reason: `no DFS total to oracle against (looked up "${ent.unitType}|${ent.unitName}") — `
        + 'refusing to write a figure nothing independent checked',
      fatal: true,
    };
  }
  const expOracle = oracleTotalFor(expRows, ent.code);
  const revOracle = oracleTotalFor(revRows, ent.code);
  // ⚠ Compared to the CENT, not with `!==` on binary floats — see `moneyEquals`.
  if (!moneyEquals(expOracle, oracle.expenditures) || !moneyEquals(revOracle, oracle.revenues)) {
    const dExp = Math.round((oracle.expenditures - expOracle) * 100) / 100;
    const dRev = Math.round((oracle.revenues - revOracle) * 100) / 100;
    const drift = `ORACLE DRIFT — expenditures parsed ${expOracle} vs DFS ${oracle.expenditures} `
      + `(DFS is ${dExp >= 0 ? '+' : ''}${dExp}); revenues parsed ${revOracle} vs DFS `
      + `${oracle.revenues} (DFS is ${dRev >= 0 ? '+' : ''}${dRev})`;

    // ⚠⚠ A DECLARED exclusion is skipped; an UNDECLARED one is still fatal. And a
    // declaration whose delta no longer matches is treated as undeclared, because
    // an exclusion that no longer describes the data excludes the wrong thing.
    const declared = declaredDriftFor(ent.code, year);
    if (declared && declared.expDelta === dExp && declared.revDelta === dRev) {
      return { ok: false, reason: drift, declaredDrift: declared };
    }
    if (declared) {
      return {
        ok: false,
        fatal: true,
        reason: `${drift}. ⚠ scripts/data/flOracleDrift.mjs declares this entity-year with `
          + `expDelta ${declared.expDelta} / revDelta ${declared.revDelta}, which no longer matches. `
          + 'A stale exclusion is worse than none — re-measure it.',
      };
    }
    return { ok: false, fatal: true, reason: drift };
  }

  // ── 3. The reconciliation branch.
  const branch = auditBranchFor(compliance, ent.code);
  if (branch === 'absent') {
    return {
      ok: false,
      fatal: true,
      reason: 'absent from BOTH compliance reports, so the reconciliation branch is unknown. '
        + '"No record" is not "no audit" — refusing to grade it.',
    };
  }

  // ── 4. The fiscal month: the publisher's, guarded by the federal audit record.
  const rec = compliance.get(ent.code);
  const month = monthFromFye(rec.fye);
  if (month == null) return { ok: false, fatal: true, reason: `unparseable FYE ${JSON.stringify(rec.fye)}` };
  const guard = resolveGuard(facCandidatesFor({ ...ent, displayName: ent.name }), month, year);
  if (guard.status === 'conflict') return { ok: false, fatal: true, reason: guard.why };

  const exp = buildExpenditureTree(expRows, ent.code, GOVERNMENTAL_FUNDS);
  const rev = buildRevenueTree(revRows, ent.code, GOVERNMENTAL_FUNDS);

  return { ok: true, month, guard: guard.status, branch, exp, rev, oracle };
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

async function sheetFor(report, year) {
  const file = path.join(CACHE, `${report}-${year}.xlsx`);
  if (!existsSync(file)) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb.getWorksheet(SHEET_NAME) || null;
}

/** Read one year's five workbooks into the shape `entityYearPlan` needs. */
export async function readYear(year) {
  const expWs = await sheetFor('EXPENDITUREDETAILREPORT', year);
  const revWs = await sheetFor('REVENUEDETAILREPORT', year);
  const totWs = await sheetFor('TOTALREVEXPDEBT', year);
  if (!expWs || !revWs || !totWs) return null;
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
  if (compliance.size === 0) throw new Error(`FY${year}: both compliance reports parsed 0 rows`);
  return { expRows, revRows, totals, compliance };
}

async function main() {
  const { values } = parseArgs({
    options: {
      year: { type: 'string' },
      code: { type: 'string' },
      'dry-run': { type: 'boolean' },
      'source-date': { type: 'string' },
      limit: { type: 'string' },
    },
  });

  const dryRun = values['dry-run'] || false;
  const sourceDate = values['source-date'] || new Date().toISOString().slice(0, 10);
  const { first, last } = FL_STATEWIDE_LOAD_WINDOW;
  const years = values.year
    ? [Number(values.year)]
    : Array.from({ length: last - first + 1 }, (_, i) => first + i);
  let entities = values.code
    ? FL_STATEWIDE_ENTITIES.filter((e) => e.code === values.code)
    : FL_STATEWIDE_ENTITIES;
  if (values.limit) entities = entities.slice(0, Number(values.limit));
  if (entities.length === 0) { console.error(`No entity with code ${values.code}`); process.exit(1); }

  const db = dryRun ? null : await getDb();

  console.log(`\nFlorida DFS statewide — ${entities.length} entities, FY${years[0]}-FY${years[years.length - 1]}`
    + `${dryRun ? '  [dry-run]' : ''}`);
  console.log(`  Source URL:  ${SOURCE_URL}`);
  console.log(`  Source date: ${sourceDate}`);
  console.log(`  Scope:       ${FUND_SCOPE} (${GOVERNMENTAL_FUNDS.join(' + ')})\n`);

  const stats = {
    written: 0, skippedConflict: 0, notFiled: 0, oracleChecks: 0,
    confirmed: 0, unverified: 0, unrecordedBranch: 0, merges: 0, driftSkipped: 0,
  };
  const fatals = [];
  const driftSeen = new Set();
  const yearsProcessed = new Set();
  const mergeNotes = [];
  const idCache = new Map();

  for (const year of years) {
    const book = await readYear(year);
    if (!book) { console.warn(`  FY${year}: cached workbooks missing — run scripts/fetchFloridaDFS.mjs first`); continue; }

    let done = 0;
    const yearStart = Date.now();
    for (const ent of entities) {
      if (!ent.fiscalYears.includes(year)) continue;
      const plan = entityYearPlan(ent, year, book);
      if (!plan.ok) {
        if (plan.fatal) { fatals.push(`FY${year} ${ent.name}: ${plan.reason}`); continue; }
        if (plan.declaredDrift) {
          stats.driftSkipped++;
          driftSeen.add(`${ent.code}|${year}`);
          console.log(`      SKIP ${ent.name} FY${year} — declared oracle drift `
            + `(DFS exceeds its own detail report by $${plan.declaredDrift.expDelta} exp / `
            + `$${plan.declaredDrift.revDelta} rev)`);
          continue;
        }
        stats.notFiled++;
        continue;
      }
      stats.oracleChecks++;
      if (plan.guard === 'confirmed') stats.confirmed++; else stats.unverified++;
      if (plan.branch === 'branch-unrecorded') stats.unrecordedBranch++;

      const merges = [...new Set([...plan.exp.merged, ...plan.rev.merged])];
      for (const m of merges) mergeNotes.push(`FY${year} ${ent.name}: ${m}`);
      stats.merges += merges.length;

      if (dryRun) { done++; continue; }

      let municipalityId = idCache.get(ent.name);
      if (!municipalityId) {
        const { data, error } = await db.rpc('treasury_ensure_municipality', {
          p_name: ent.name,
          p_state: FL_STATE,
          p_entity_type: ent.entityType,
          p_population: ent.population,
        });
        if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
        municipalityId = data;
        idCache.set(ent.name, municipalityId);
      }

      for (const [datasetType, built] of [['operating', plan.exp], ['revenue', plan.rev]]) {
        const conflict = await findConflictingBudget(db, municipalityId, year, datasetType);
        if (conflict) {
          stats.skippedConflict++;
          console.log(`      SKIP ${ent.name} FY${year} ${datasetType} — existing `
            + `"${conflict.data_source}" preserved (never-overwrite)`);
          continue;
        }
        const { error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: year,
          p_dataset_type: datasetType,
          p_total: built.total,
          p_tree: built.tree,
          p_row_count: built.tree.length,
          p_data_source_name: sourceNameForBranch(datasetType, year, plan.branch),
          p_source_url: SOURCE_URL,
          p_source_date: sourceDate,
          p_fiscal_year_start_month: plan.month,
          // ⚠⚠ LOAD-BEARING. The RPC's target key includes fund_scope and basis;
          // omitting them defaults both to 'unknown', so a re-run matches nothing
          // and INSERTS a duplicate of every row instead of updating it.
          p_fund_scope: FUND_SCOPE,
          p_basis: BASIS_VALUE,
          p_derivation: DERIVATION,
        });
        if (error) throw new Error(`RPC error (${ent.name} FY${year} ${datasetType}): ${error.message}`);
        stats.written++;
      }
      done++;
      if (done % 50 === 0) {
        const rate = done / ((Date.now() - yearStart) / 1000);
        console.log(`  FY${year}: ${done} entities  (${rate.toFixed(1)}/s, ${stats.written} rows)`);
      }
    }
    console.log(`  FY${year}: ${done} entities done`);
    yearsProcessed.add(year);
  }

  console.log(`\n  oracle ties $0:      ${stats.oracleChecks} entity-years`);
  console.log(`  rows written:        ${stats.written}`);
  console.log(`  skipped, conflict:   ${stats.skippedConflict}`);
  console.log(`  skipped, not filed:  ${stats.notFiled}`);
  console.log(`  fiscal month:        ${stats.confirmed} FAC-CONFIRMED, ${stats.unverified} unverified`);
  console.log(`  audit branch:        ${stats.unrecordedBranch} entity-years with NO audit date recorded`);
  console.log(`  label merges:        ${stats.merges}`);
  console.log(`  declared drift:      ${stats.driftSkipped} entity-years NOT loaded (publisher self-contradiction)`);

  // ⚠⚠ A declared exclusion that names nothing excludes nothing. Every entry
  // whose year was processed must actually have drifted.
  const stale = FL_ORACLE_DRIFT
    .filter((d) => yearsProcessed.has(d.fiscalYear)
      && (!values.code || values.code === d.code)
      && entities.some((e) => e.code === d.code))
    .filter((d) => !driftSeen.has(`${d.code}|${d.fiscalYear}`));
  if (stale.length) {
    console.error(`
  ⚠⚠ ${stale.length} DECLARED DRIFT ENTR(IES) DID NOT DRIFT — the exclusion is stale:`);
    for (const d of stale) console.error(`      FY${d.fiscalYear} ${d.name} (${d.code})`);
    process.exit(1);
  }
  if (mergeNotes.length) {
    console.log('    ⚠ two account codes stripped to one display label and were summed. The total is');
    console.log('      unmoved; the node count is not.');
    for (const n of mergeNotes.slice(0, 20)) console.log(`      ${n}`);
    if (mergeNotes.length > 20) console.log(`      ... and ${mergeNotes.length - 20} more`);
  }
  if (fatals.length) {
    console.error(`\n  ⚠⚠ ${fatals.length} ENTITY-YEAR(S) REFUSED:`);
    for (const f of fatals.slice(0, 40)) console.error(`      ${f}`);
    process.exit(1);
  }
  if (!dryRun && stats.written > 0) {
    console.log('\n  Next, while you still know what was loaded:');
    console.log('      npm run verify:frozen');
    console.log('      npm run register:rows -- --milestone fl-statewide --match "Florida DFS"');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
