#!/usr/bin/env node
/**
 * Florida DFS — the independent oracle (Knight campaign, session 3, spec §5.2).
 *
 * ⚠ THE POINT OF THIS SCRIPT IS THAT IT IS NOT TAUTOLOGICAL.
 *
 * `project_austin_travis_onboarding` states the rule plainly: a check that
 * `total = Σ items` proves nothing, because both sides come from the same parse.
 * The oracle here is a figure DFS computes and publishes SEPARATELY — the
 * `TOTALREVEXPDEBT` system report's `Total Revenues` and `Total Expenditures`
 * per entity — compared against a sum this repo computes from the DETAIL
 * reports. Two different DFS reports, one of them ours to re-derive.
 *
 * ── WHAT TIES, AND WHAT DELIBERATELY DOES NOT ───────────────────────────────
 *
 * The oracle is run over the FULL parse: every account, every object code,
 * summed over `ORACLE_FUNDS` (all twelve fund columns except the four fiduciary
 * ones — the subset solved for in scripts/lib/floridaDfs.mjs). That must tie to
 * the cent, and it proves every figure was read out of the right cell.
 *
 * The tree TT actually LOADS is a documented subset of that verified parse:
 * governmental funds only, and without the interfund/other-sources accounts the
 * publisher itself says are not expenditures or revenues. Those exclusions are
 * reported here as explicit figures so the gap between the oracle and the loaded
 * total is a number on the page rather than an unexplained difference.
 *
 * ⚠ Do NOT "fix" a gap by widening the tree back to the oracle's scope. The gap
 * is the interfund transfers, and closing it would double-count them.
 *
 * Usage:
 *   node scripts/verifyFloridaDFS.mjs                    # the 7 session-3 entities, all years
 *   node scripts/verifyFloridaDFS.mjs --year 2023
 *   node scripts/verifyFloridaDFS.mjs --code 200239 --verbose
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';

import {
  readDetailRows, readTotalsRows, readComplianceRows, mergeCompliance, assertParsed,
  buildExpenditureTree, buildRevenueTree, oracleTotalFor, hasAuditOnFile,
  GOVERNMENTAL_FUNDS, SHEET_NAME,
} from './lib/floridaDfs.mjs';
import { FL_ENTITIES, FL_FIRST_YEAR, FL_LAST_YEAR } from './data/floridaKnightEntities.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'docs/fl-dfs');

const wbCache = new Map();
async function sheet(report, year) {
  const key = `${report}-${year}`;
  if (wbCache.has(key)) return wbCache.get(key);
  const file = join(CACHE, `${key}.xlsx`);
  if (!existsSync(file)) { wbCache.set(key, null); return null; }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(SHEET_NAME);
  wbCache.set(key, ws || null);
  return ws || null;
}

const money = (n) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'));

async function main() {
  const { values } = parseArgs({
    options: {
      year: { type: 'string' }, code: { type: 'string' }, verbose: { type: 'boolean' },
    },
  });

  const years = values.year
    ? [Number(values.year)]
    : Array.from({ length: FL_LAST_YEAR - FL_FIRST_YEAR + 1 }, (_, i) => FL_FIRST_YEAR + i);
  const entities = values.code ? FL_ENTITIES.filter((e) => e.code === values.code) : FL_ENTITIES;
  if (entities.length === 0) { console.error(`No entity with code ${values.code}`); process.exit(1); }

  let checks = 0, failures = 0, missing = 0;
  const rows = [];

  for (const year of years) {
    const expWs = await sheet('EXPENDITUREDETAILREPORT', year);
    const revWs = await sheet('REVENUEDETAILREPORT', year);
    const totWs = await sheet('TOTALREVEXPDEBT', year);
    if (!expWs || !revWs || !totWs) {
      console.warn(`  FY${year}: cached workbooks missing — run scripts/fetchFloridaDFS.mjs`);
      continue;
    }
    const expRows = assertParsed(readDetailRows(expWs), `EXPENDITUREDETAILREPORT FY${year}`);
    const revRows = assertParsed(readDetailRows(revWs), `REVENUEDETAILREPORT FY${year}`);
    const totals = readTotalsRows(totWs);
    if (totals.size === 0) throw new Error(`TOTALREVEXPDEBT FY${year}: parsed 0 rows — the oracle is empty`);

    const cWs = await sheet('PUBLICCOMPLIANTGOVS', year);
    const nWs = await sheet('PUBLICNONCOMPLIANTGOVS', year);
    const compliance = mergeCompliance(
      cWs ? readComplianceRows(cWs) : new Map(),
      nWs ? readComplianceRows(nWs) : new Map(),
    );

    for (const ent of entities) {
      const present = expRows.some((r) => r.code === ent.code) || revRows.some((r) => r.code === ent.code);
      if (!present) {
        // ⚠ NOT a failure. FY2025 is genuinely incomplete: 1,281 entities filed
        // against 1,918 for FY2024, and a partial year downloads as a
        // well-formed workbook. Absence is reported, never inferred over.
        missing++;
        rows.push({ year, ent, status: 'not filed' });
        continue;
      }

      const oracle = totals.get(`${ent.unitType}|${ent.unitName}`);
      const expOracle = oracleTotalFor(expRows, ent.code);
      const revOracle = oracleTotalFor(revRows, ent.code);

      const exp = buildExpenditureTree(expRows, ent.code, GOVERNMENTAL_FUNDS);
      const rev = buildRevenueTree(revRows, ent.code, GOVERNMENTAL_FUNDS);

      const expDrift = oracle?.expenditures == null ? null : expOracle - oracle.expenditures;
      const revDrift = oracle?.revenues == null ? null : revOracle - oracle.revenues;
      const ok = expDrift === 0 && revDrift === 0;
      checks++;
      if (!ok) failures++;

      rows.push({
        year, ent, status: ok ? 'tie $0' : 'DRIFT',
        expDrift, revDrift,
        expOracle, revOracle,
        dfsExp: oracle?.expenditures ?? null, dfsRev: oracle?.revenues ?? null,
        expLoaded: exp.total, revLoaded: rev.total,
        expExcluded: exp.excludedTransfers, revExcluded: rev.excludedTransfers,
        functions: exp.tree.length, sources: rev.tree.length,
        audit: hasAuditOnFile(compliance, ent.code),
      });
    }
  }

  console.log('\nFlorida DFS — oracle: our parse of the DETAIL reports vs DFS TOTALREVEXPDEBT\n');
  const hdr = `${'FY'.padEnd(5)}${'entity'.padEnd(20)}${'status'.padEnd(10)}` +
    `${'exp drift'.padStart(12)}${'rev drift'.padStart(12)}  ${'audit'.padStart(6)}`;
  console.log(hdr); console.log('-'.repeat(hdr.length));
  for (const r of rows) {
    const a = r.audit === true ? 'yes' : r.audit === false ? 'DEW' : '—';
    const ed = r.expDrift == null ? '—' : r.expDrift.toLocaleString('en-US');
    const rd = r.revDrift == null ? '—' : r.revDrift.toLocaleString('en-US');
    console.log(`${String(r.year).padEnd(5)}${r.ent.label.slice(0, 19).padEnd(20)}${r.status.padEnd(10)}` +
      `${(r.status === 'not filed' ? '—' : ed).padStart(12)}${(r.status === 'not filed' ? '—' : rd).padStart(12)}  ${a.padStart(6)}`);
  }

  if (values.verbose) {
    console.log('\nPer-entity detail (loaded scope = governmental funds, transfers excluded)\n');
    for (const r of rows.filter((x) => x.status !== 'not filed')) {
      console.log(`FY${r.year} ${r.ent.label}`);
      console.log(`   DFS total expenditures   ${money(r.dfsExp)}   our full parse ${money(r.expOracle)}`);
      console.log(`   DFS total revenues       ${money(r.dfsRev)}   our full parse ${money(r.revOracle)}`);
      console.log(`   LOADED operating (gov)   ${money(r.expLoaded)}  (${r.functions} functions; ` +
        `${money(r.expExcluded)} of object-90 transfers excluded)`);
      console.log(`   LOADED revenue   (gov)   ${money(r.revLoaded)}  (${r.sources} sources; ` +
        `${money(r.revExcluded)} of 38x/39x other sources excluded)`);
    }
  }

  console.log(`\n${checks} entity-years checked · ${failures} drifting · ${missing} not filed`);
  if (failures > 0) {
    console.error('\nORACLE FAILED — the detail parse does not reproduce DFS\'s published totals.');
    process.exit(1);
  }
  // ⚠ ZERO CHECKS IS A FAILURE, NOT A PASS. An earlier revision of this script
  // parsed every workbook into nothing, reported all seven entities as "not
  // filed", and then printed "Oracle green" — a gate passing because it measured
  // nothing. Never let that read as success again.
  if (checks === 0) {
    console.error('\nORACLE VACUOUS — 0 entity-years were checked. Nothing was verified.');
    process.exit(1);
  }
  console.log('Oracle green: every checked entity-year reproduces DFS\'s own totals to the cent.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
