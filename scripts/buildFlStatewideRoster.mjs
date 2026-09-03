/**
 * Derive Florida's statewide AFR roster from the cached LOGERx workbooks.
 *
 * NO SHEBANG — kept importable; tests import `monthFromFye` and `auditBranchFor`.
 *
 * Usage:
 *   node scripts/buildFlStatewideRoster.mjs
 *   node scripts/buildFlStatewideRoster.mjs --out _acfr-work/fl-sweep/roster.json
 *
 * Stage 1 of two. This stage touches NO census data and NO database: it reads
 * only what Florida DFS published, and writes what Florida DFS says. Stage 2
 * (scripts/buildFlStatewideEntities.mjs) joins the Census and the federal audit
 * record onto it.
 *
 * ── WHAT THE PUBLISHER KEYS ON ──────────────────────────────────────────────
 *
 * ⚠⚠ `EntityId` (the LOGERx code) IS THE JOIN KEY, NEVER THE NAME. `1xxxxx`
 * counties, `2xxxxx` municipalities, `3xxxxx` special districts. Florida has
 * both a `County|Palm Beach` (100050) and a `City|Palm Beach` (200287, the Town
 * of Palm Beach); a name-based match swaps a $3.9B county for a $90M town.
 *
 * The compliance reports are the roster: they carry `EntityId` alongside `Type`
 * and `Name`, which is the only place the code and the oracle's (Unit Type, Unit
 * Name) key appear together — `TOTALREVEXPDEBT` carries no code at all.
 *
 * MEASURED over all 14 published years, not assumed:
 *   • 479 city/county codes; **NAME is stable across every year** for all 479,
 *     and so is TYPE. (Michigan's F-65 spelled Detroit two ways and emitted its
 *     municode as a number in 15 datasets and a string in the 16th; Florida does
 *     neither, so no zero-padding or alias layer is needed on the code.)
 *   • **No (Type|Name) pair holds two codes** — no Florida government files
 *     under two identities the way Michigan's do.
 *   • **Zero city/county entity-years filed detail while absent from BOTH
 *     compliance reports**, so the audit branch is knowable for every row.
 *
 * Those three are re-asserted here on every run rather than trusted, because
 * each one is a property of the published files and a future year can break it.
 *
 * ── ⚠ THE FISCAL MONTH IS PUBLISHED, PER ENTITY PER YEAR ────────────────────
 *
 * The compliance reports carry `FYE`. Across all 6,396 city/county entity-years
 * it is `9/30` without exception, so Florida's October fiscal year is READ from
 * the publisher rather than defaulted from a state-level generalisation — the
 * defect `project_fysm_column_default_one_defect` records eight PRs of.
 *
 * `monthFromFye` converts a fiscal-year END to a fiscal-year START month, which
 * is what `treasury.budgets.fiscal_year_start_month` holds.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

import {
  readDetailRows, readComplianceRows, mergeCompliance, readTotalsRows, assertParsed, SHEET_NAME,
} from './lib/floridaDfs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'docs/fl-dfs');
const DEFAULT_OUT = path.join(ROOT, '_acfr-work/fl-sweep/roster.json');

/** The published detail-report window. */
export const FL_FIRST_YEAR = 2012;
export const FL_LAST_YEAR = 2025;

/** LOGERx code prefix -> TT entity type. Special districts are out of scope. */
export function entityTypeForCode(code) {
  const c = String(code);
  if (c.startsWith('1')) return 'county';
  if (c.startsWith('2')) return 'city';
  return null;
}

/**
 * Fiscal-year END (`"9/30"`) -> fiscal-year START month (`10`).
 *
 * ⚠ A September 30 year-end means the year STARTED on October 1. Writing 9 here
 * would be the single most-shipped defect in this project's history, and it
 * moves $0 and passes every tie test.
 */
export function monthFromFye(fye) {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(String(fye ?? ''));
  if (!m) return null;
  const endMonth = Number(m[1]);
  if (!Number.isInteger(endMonth) || endMonth < 1 || endMonth > 12) return null;
  return (endMonth % 12) + 1;
}

/**
 * Which branch of DFS's reconciliation produced this filing?
 *
 * DFS staff reconcile the AFR against "the provided audited financial statements
 * OR Data Element Worksheet" before a filing becomes *Verified by DFS*.
 *
 * ⚠⚠ A BLANK AUDIT DATE IS NOT EVIDENCE OF A WORKSHEET. Only four city-years in
 * fourteen published years have both audit dates blank, and the federal audit
 * record proves the point for half of them:
 *
 *   Tampa FY2013        filed a federal Single Audit in EVERY year 1998-2025.
 *   Plantation FY2015   filed one in 1998, 2000-2015 and 2017-2025.
 *   Lake Alfred FY2015  filed in 2003, 2006-2007, 2022 — not 2015.
 *   Perry FY2020        filed in 2005, 2012, 2018, 2021, 2023-2024 — not 2020.
 *
 * So two of the four were DEMONSTRABLY AUDITED, and grading them down to the
 * worksheet branch would have been not merely unsupported but false. The other
 * two spend under the $750k federal threshold in those years, which is evidence
 * of nothing in either direction.
 *
 * The honest reading of a blank pair is "DFS's record does not say", so this
 * returns `branch-unrecorded` rather than asserting the weaker branch. That
 * string has no entry in `auditGradeRegistry`, so such a row grades `unknown` —
 * which is what "we do not know" should look like to a reader.
 *
 * ⚠ Measured from docs/fac/fac-local-fiscal-year-ends.csv, not from the FAC API,
 * which reaches back only to audit year 2016.
 *
 * `absent` is returned when the entity is in neither compliance report. It
 * happens for zero city/county entity-years today, and the loader refuses it
 * rather than guessing.
 *
 * @returns {'audit-reconciled'|'branch-unrecorded'|'absent'}
 */
export function auditBranchFor(compliance, code) {
  const rec = compliance.get(String(code));
  if (!rec) return 'absent';
  return (rec.auditReceived || rec.auditCompleted) ? 'audit-reconciled' : 'branch-unrecorded';
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

export async function buildRoster({ firstYear = FL_FIRST_YEAR, lastYear = FL_LAST_YEAR, log = console.log } = {}) {
  /** code -> {code, entityType, unitType, unitName, years: {[y]: {...}}} */
  const byCode = new Map();
  const yearSummary = [];
  const problems = [];

  for (let year = firstYear; year <= lastYear; year++) {
    const expWs = await sheetFor('EXPENDITUREDETAILREPORT', year);
    const revWs = await sheetFor('REVENUEDETAILREPORT', year);
    const totWs = await sheetFor('TOTALREVEXPDEBT', year);
    if (!expWs || !revWs) { log(`  FY${year}: detail workbooks absent from ${path.relative(ROOT, CACHE)} — skipped`); continue; }

    const expRows = assertParsed(readDetailRows(expWs), `EXPENDITUREDETAILREPORT FY${year}`);
    const revRows = assertParsed(readDetailRows(revWs), `REVENUEDETAILREPORT FY${year}`);
    const totals = totWs ? readTotalsRows(totWs) : new Map();
    if (totals.size === 0) problems.push(`FY${year}: TOTALREVEXPDEBT parsed 0 rows — the oracle would be empty`);

    const cWs = await sheetFor('PUBLICCOMPLIANTGOVS', year);
    const nWs = await sheetFor('PUBLICNONCOMPLIANTGOVS', year);
    // ⚠⚠ BOTH, UNIONED. The compliant report lists only on-time filers; a late
    // but fully audited government is in the other one, and it carries audit
    // dates just the same.
    const compliance = mergeCompliance(
      cWs ? readComplianceRows(cWs) : new Map(),
      nWs ? readComplianceRows(nWs) : new Map(),
    );

    const filed = new Set();
    for (const r of expRows) filed.add(r.code);
    for (const r of revRows) filed.add(r.code);

    let cities = 0; let counties = 0; let unrecorded = 0; let noOracle = 0;
    for (const code of filed) {
      const entityType = entityTypeForCode(code);
      if (!entityType) continue;                       // special districts: out of scope
      const rec = compliance.get(code);
      if (!rec) {
        problems.push(`FY${year} code ${code}: filed detail but is in NEITHER compliance report, so its `
          + 'reconciliation branch is unknowable. "No record" is not "no audit".');
        continue;
      }

      const month = monthFromFye(rec.fye);
      if (month == null) {
        problems.push(`FY${year} ${rec.type}|${rec.name}: unparseable FYE ${JSON.stringify(rec.fye)}`);
        continue;
      }
      const oracleKey = `${rec.type}|${rec.name}`;
      const hasOracle = totals.has(oracleKey);
      if (!hasOracle) noOracle++;

      let ent = byCode.get(code);
      if (!ent) {
        ent = {
          code,
          entityType,
          unitType: rec.type,
          unitName: rec.name,
          years: {},
        };
        byCode.set(code, ent);
      } else {
        // ⚠ Stability is asserted, not trusted — the DB keys on the name.
        if (ent.unitName !== rec.name) {
          problems.push(`code ${code}: LOGERx name changed — "${ent.unitName}" then "${rec.name}" in FY${year}. `
            + 'The display name is the database key; a drift creates a second municipality row.');
        }
        if (ent.unitType !== rec.type) {
          problems.push(`code ${code}: LOGERx type changed — "${ent.unitType}" then "${rec.type}" in FY${year}.`);
        }
      }

      const branch = auditBranchFor(compliance, code);
      ent.years[year] = { month, fye: rec.fye, branch, hasOracle };
      if (branch === 'branch-unrecorded') unrecorded++;
      if (entityType === 'city') cities++; else counties++;
    }
    yearSummary.push({ year, cities, counties, unrecorded, noOracle });
    log(`  FY${year}: ${cities} cities, ${counties} counties`
      + `${unrecorded ? `, ${unrecorded} audit-branch unrecorded` : ''}`
      + `${noOracle ? `, ⚠ ${noOracle} with no DFS total to oracle against` : ''}`);
  }

  // ── One government must not hold two codes.
  const seenKey = new Map();
  for (const ent of byCode.values()) {
    const k = `${ent.unitType}|${ent.unitName}`;
    if (seenKey.has(k)) {
      problems.push(`(Type|Name) "${k}" is held by TWO codes: ${seenKey.get(k)} and ${ent.code}. `
        + 'The oracle is keyed by (Unit Type, Unit Name), so it cannot tell them apart.');
    } else seenKey.set(k, ent.code);
  }

  const entities = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  return { entities, yearSummary, problems };
}

async function main() {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const out = values.out ? path.resolve(ROOT, values.out) : DEFAULT_OUT;

  console.log(`\nFlorida DFS statewide roster — FY${FL_FIRST_YEAR}-FY${FL_LAST_YEAR}`);
  console.log(`  Cache: ${path.relative(ROOT, CACHE)}\n`);

  const { entities, yearSummary, problems } = await buildRoster();

  const cities = entities.filter((e) => e.entityType === 'city');
  const counties = entities.filter((e) => e.entityType === 'county');
  const entityYears = entities.reduce((s, e) => s + Object.keys(e.years).length, 0);
  const unrecorded = entities.flatMap((e) => Object.entries(e.years)
    .filter(([, y]) => y.branch === 'branch-unrecorded')
    .map(([yr]) => `FY${yr} ${e.unitType}|${e.unitName}`));
  const months = new Set(entities.flatMap((e) => Object.values(e.years).map((y) => y.month)));

  console.log(`\n  entities:      ${entities.length}  (${cities.length} cities, ${counties.length} counties)`);
  console.log(`  entity-years:  ${entityYears}`);
  console.log(`  fiscal months published: ${[...months].sort((a, b) => a - b).join(', ')} `
    + `(${months.size === 1 ? 'unanimous — read from the publisher, not defaulted' : '⚠ NOT uniform'})`);
  console.log(`  audit branch:  ${entityYears - unrecorded.length} audit-reconciled, ${unrecorded.length} unrecorded`);
  for (const u of unrecorded) console.log(`      ⚠ ${u} — DFS records no audit date; branch NOT asserted`);

  if (problems.length) {
    console.log(`\n  ⚠⚠ ${problems.length} PROBLEM(S) — the roster is not clean:`);
    for (const p of problems) console.log(`      ${p}`);
  } else {
    console.log('\n  ✅ name stable per code, type stable per code, no code collisions, no compliance orphans.');
  }

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify({
    builtFrom: path.relative(ROOT, CACHE),
    window: { first: FL_FIRST_YEAR, last: FL_LAST_YEAR },
    yearSummary,
    problems,
    entities,
  }, null, 1)}\n`);
  console.log(`\n  wrote ${path.relative(ROOT, out)}`);
  if (problems.length) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
