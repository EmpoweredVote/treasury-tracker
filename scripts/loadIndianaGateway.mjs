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
 * report carrying `r_bal` (receipts) and `d_bal` (disbursements) per fund.
 *
 * ⚠⚠ CORRECTED 2026-09-08 — THIS COMMENT USED TO SAY THE UNIT FILES CASH AND
 * INVESTMENTS "INDEPENDENTLY". IT DOES NOT, AND THAT OVERSOLD THE ORACLE.
 * A unit submits ONE Annual Financial Report; Gateway publishes several REPORTS
 * over that one submission. Measured across all 1,275 county-years with cash
 * rows: sum(receipts) equals sum(`r_bal`) TO THE CENT in 887 of them, and every
 * one of the 388 that differ is explained to the cent by R901 Sale of
 * Investments — the exact amount the cash report nets out. Lake FY2018 differs
 * by $142,900,000.00 and its R901 is $142,900,000.00.
 *
 * So the oracle proves TT READ THE SUBMISSION CORRECTLY — a real and necessary
 * job, and it has caught real defects. It CANNOT corroborate that the
 * submission is true, because it is not a second source. Marion County is the
 * worked example: 179/179 funds tied in FY2023 while the filing carried ~3x the
 * county's own audited revenue in custodial pass-through. Necessary, not
 * sufficient — see scripts/data/inGatewayAnomalies.mjs.
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  eachRow, makeAccumulator, toTree, assertParsed, need, money, pad,
  SETTLEMENT_FUND_CODE, GOVERNMENTAL_ENT_NAME,
  makeSettlementSeriesIndex, assertSettlementSeriesIsPassThrough, settlementPerYearDrift,
} from './lib/inGateway.mjs';
import {
  IN_FIGURE_FLAGS, figureFlagsFor, assertFigureFlagStillHolds,
} from './data/inGatewayAnomalies.mjs';
import { IN_ENTITIES, PA_IN_LOAD_WINDOW } from './data/paInKnightEntities.mjs';
import { ROSTER_FILE } from './buildInStatewideRoster.mjs';

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
 * Walk every government's settlement series: REFUSE on the series, REPORT the
 * per-year drift.
 *
 * ⚠⚠ The per-year check was demoted, not deleted. 38 of 1,219 county-years
 * drift over 2% because property tax collected in December is settled in
 * January, and the pairs are equal and opposite across adjacent years. Those
 * years are printed so the timing difference stays VISIBLE — a check that
 * quietly stops reporting is the Michigan "22 recoverable filings" mistake.
 *
 * ⚠ `governments: 0` is reported as zero, never as a pass. Measured, 0 of 568
 * cities and towns report a settlement fund at all, so a city-only run audits
 * nothing and must not print a reassuring green line about it.
 */
export function auditSettlementSeries(series, { log = console.log } = {}) {
  const declaredResidues = [];
  const oneSidedGovts = [];
  let overYears = 0;
  let oneSidedYears = 0;

  for (const entry of series.values()) {
    const label = `${entry.name} settlement series`;
    const res = assertSettlementSeriesIsPassThrough(entry, label);
    if (res.residueDeclared) declaredResidues.push(entry.name);

    const years = settlementPerYearDrift(entry);
    const over = years.filter((y) => y.over);
    overYears += over.length;
    const lopsided = years.filter((y) => y.oneSided);
    oneSidedYears += lopsided.length;
    if (lopsided.length) oneSidedGovts.push(entry.name);

    if (over.length) {
      // ⚠ States the MEASUREMENT, not an explanation. Most of these are the
      // December/January settlement straddling the year end — proven by equal
      // and opposite pairs — but saying so on every row would assert a cause
      // that has only been verified for the pairs. #142's lesson: a confident
      // wrong label is worse than no label, because it looks like knowledge.
      log(`  ${entry.name}: settlement series ties to ${(res.drift * 100).toFixed(2)}%`
        + `${res.residueDeclared ? ' (declared residue)' : ''}, `
        + `but ${over.length} of ${years.length} year(s) drift over tolerance within it:`);
      for (const y of over) {
        log(`      FY${y.year} in ${y.r.toFixed(2)} out ${y.d.toFixed(2)} `
          + `delta ${y.delta >= 0 ? '+' : ''}${y.delta.toFixed(2)} (${(y.drift * 100).toFixed(1)}%)`
          + `${y.oneSided ? '   <-- ONE SIDE ONLY, not a timing difference' : ''}`);
      }
    }
  }

  log(`settlement pass-through audited across the SERIES for ${series.size} government(s)`
    + `: ${overYears} entity-year(s) drift over tolerance within an otherwise netting series`
    + `${declaredResidues.length ? `; declared residues: ${declaredResidues.join(', ')}` : ''}`);
  // ⚠⚠ Reported LAST and on its own, because this is the signal that found
  // Marion County's collapsed FY2024/FY2025 filing. A one-sided year means the
  // publisher booked a pass-through in one direction only; it is not the
  // December/January timing difference and must not be read as one.
  if (oneSidedYears) {
    log(`⚠⚠ ${oneSidedYears} entity-year(s) report settlement on ONE SIDE ONLY, across `
      + `${oneSidedGovts.length} government(s): ${oneSidedGovts.join(', ')}. `
      + 'Listed above. This is a filing shape, not a timing difference — check the '
      + "government's TOTAL receipts for that year before trusting the year.");
  }
  return { governments: series.size, overYears, oneSidedYears, declaredResidues };
}

/**
 * Announce every recorded anomaly flag that covers a filing being loaded, and
 * re-check that the flag still describes the data.
 *
 * ⚠⚠ THE MILLEDGEVILLE RULE, IN CODE. Nothing here withholds a figure — the
 * flagged filings load exactly as published. This exists so a reader can be
 * told WHY a figure looks inconsistent, not so TT can quietly decline to show
 * it. Suppressing an outlier would create a blind spot for legitimate fraud.
 *
 * ⚠ Its predecessor, `scripts/data/gaRlgfAnomalies.mjs`, is imported by NOTHING
 * — so the Milledgeville flag could never reach a reader and nothing noticed if
 * the data moved underneath it. This function is the fix for that shape: the
 * registry is read on every load, and a flag whose claim has gone stale REFUSES.
 */
export function auditFigureFlags(filings, { flags = IN_FIGURE_FLAGS, log = console.log } = {}) {
  let flagged = 0;
  for (const f of filings) {
    const hits = figureFlagsFor(f.entity.countyCode, f.entity.unitCode, f.year, { flags });
    for (const flag of hits) {
      flagged++;
      // ⚠⚠ Re-check BEFORE announcing, so a stale claim is never printed.
      assertFigureFlagStillHolds(flag, f.year, f, `${f.entity.name} FY${f.year}`);
      log(`⚠⚠ RECORDED ANOMALY FLAG "${flag.id}" covers ${f.entity.name} FY${f.year} `
        + '— LOADED AS PUBLISHED, not withheld, not corrected.');
      log(`     ${flag.what}`);
      log(`     revenue ${f.revenue.subsetTotal.toFixed(2)} / operating `
        + `${f.operating.subsetTotal.toFixed(2)} — see scripts/data/inGatewayAnomalies.mjs`);
    }
  }
  if (flagged) {
    log(`${flagged} filing(s) carry a recorded anomaly flag. Every one is loaded as published.`);
  }
  return { flagged };
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
  // ⚠⚠ Indexed for EVERY year in the extract, not just `years`. The sweep is
  // driven one --fy at a time (a 15-year run exhausts the heap), and a series
  // assertion that only saw the loaded year would be the per-year gate again.
  const settlement = makeSettlementSeriesIndex(entities);

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
      settlement.consume(r, ix, g.kind);
      const k = key(pad(r[need(ix, 'cnty_cd')], 2), pad(r[need(ix, 'unit_code')], 4),
        String(r[need(ix, 'year')]).trim());
      const a = want.get(k);
      if (a) a.consume(r, ix);
    });
    if (!acc.has(g.kind)) acc.set(g.kind, new Map());
    for (const [k, a] of want) acc.get(g.kind).set(k, a);
  }

  // ⚠ Refuses BEFORE anything is written, and before the oracle pass, so a bad
  // settlement identification cannot be masked by a green oracle. The oracle
  // proves the READ; this proves the SCOPE. They are different jobs.
  auditSettlementSeries(settlement.result());

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
      // ⚠⚠ The settlement identification is corroborated across the SERIES by
      // `auditSettlementSeries` above, NOT here per year. Greene County FY2024
      // is 2.4% apart within the year and nets out across the series; a per-year
      // assertion at this line refused 644-of-660 correct data.
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

/**
 * ── ⭐ SWAP THE ROSTER, NOT THE LOADER ──────────────────────────────────────
 *
 * `--statewide` substitutes all 660 governments for the four Knight entities and
 * changes NOTHING else. The write path below — the never-overwrite guard, the
 * explicit fund_scope/basis, the RPC-payload check, the oracle refusal — is the
 * code PR #113 proved and #149 regression-verified against a fresh fetch (78/78
 * rows, 11,283/11,283 fund checks). South Carolina's `--statewide` did the same
 * for 46 counties: one write path cannot drift from the one that was proven.
 *
 * ⚠ `population: 0` on every entry is deliberate and safe.
 * `treasury_ensure_municipality` is SELECT-then-INSERT-IF-NOT-FOUND with NO
 * UPDATE (read from the live function 2026-09-07), so this cannot overwrite the
 * real populations Fort Wayne, Gary, Bloomington, Allen County, Lake County or
 * Monroe County already carry. New entities land at 0 until the Census join is
 * done, which is a separate job: matching 568 Indiana places to
 * `sub-est2024_18.csv` has the type-word trap all over it (14 places named
 * "X City"), and a wrong population is worse than an absent one.
 *
 * ⚠ `fiscalYearStartMonth: 1` for all 660 — Indiana is a calendar-year state,
 * established from DLGF's own compilation and pinned by
 * `scripts/verifyCalendarYearLocals.mjs`, not inherited from a column default.
 */
export function statewideEntities() {
  const roster = JSON.parse(readFileSync(ROSTER_FILE, 'utf8'));
  const entities = roster.entities ?? [];
  if (!entities.length) throw new Error(`REFUSING: ${ROSTER_FILE} holds no entities`);

  const countyKeyByCode = new Map(
    entities.filter((e) => e.entityType === 'county').map((e) => [e.countyCode, e.key]));

  return entities.map((e) => {
    const parentCountyKey = e.entityType === 'county' ? null : countyKeyByCode.get(e.countyCode);
    // ⚠⚠ A city whose county is missing would be created with a NULL county_id
    // and vanish from its county's children panel — silently, since nothing
    // downstream asks. Measured: all 92 county codes resolve.
    if (e.entityType !== 'county' && !parentCountyKey) {
      throw new Error(`REFUSING: ${e.name} (${e.sboaId}) is in county ${e.countyCode}, `
        + 'which has no county entity in the roster');
    }
    return {
      key: e.key,
      name: e.name,
      state: IN_STATE,
      entityType: e.entityType,
      population: 0,
      parentCountyKey,
      countyCode: e.countyCode,
      unitCode: e.unitCode,
      fiscalYearStartMonth: 1,
      sboaId: e.sboaId,
      filedYears: e.years,
    };
  });
}

export async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/in' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      statewide: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      commit: { type: 'boolean', default: false },
    },
  });
  if (!values['dry-run'] && !values.commit) {
    console.error('Pass --dry-run or --commit.');
    process.exit(1);
  }

  const roster = values.statewide ? statewideEntities() : IN_ENTITIES;
  const entities = values.entity
    ? roster.filter((e) => e.key === values.entity || e.name === values.entity)
    : roster;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  // ⚠⚠ The statewide window is 2011-2025, not the Knight window (2015-2024).
  // `year="All"` really does return 2011 even though the year control's earliest
  // explicit option is 2012 — measured, see scripts/fetchIndianaGateway.mjs.
  const window = values.statewide ? { first: 2011, last: 2025 } : PA_IN_LOAD_WINDOW;
  const years = values.fy
    ? [Number(values.fy)]
    : Array.from({ length: window.last - window.first + 1 }, (_, i) => window.first + i);

  // ⚠⚠ DRIVE PER YEAR. 660 entities x 15 years is 9,900 accumulators per group and
  // four groups, over 443 MB of extracts — the shape that made the Michigan load
  // run out of heap. Per-year also tells you WHICH year broke.
  if (values.statewide && !values.fy && years.length > 1) {
    console.error(`REFUSING: --statewide over ${years.length} years at once builds `
      + `${(entities.length * years.length * 4).toLocaleString()} accumulators over 443 MB `
      + 'of extracts. Drive it per year under nohup:\n'
      + `    for y in $(seq ${window.first} ${window.last}); do \\\n`
      + `      node scripts/loadIndianaGateway.mjs --statewide --fy $y ${values.commit ? '--commit' : '--dry-run'}; \\\n`
      + '    done\n'
      + '  The RPC upserts, so re-running a year is idempotent.');
    process.exit(1);
  }

  // ⚠ Skip entity-years the roster says were never filed, so "not filed" is a
  // statement from the source rather than an empty parse to be explained later.
  const scoped = entities.filter((e) => !e.filedYears
    || years.some((y) => e.filedYears.includes(Number(y))));
  if (values.statewide) {
    const skipped = entities.length - scoped.length;
    console.log(`Indiana Gateway — ${scoped.length} of ${entities.length} governments filed `
      + `FY${years.join(', FY')} (${skipped} did not, per the roster)`);
  }

  console.log(`Indiana Gateway — ${scoped.length} entities x ${years.length} years`);
  console.log(`Settlement funds (Fund_code ${SETTLEMENT_FUND_CODE}) EXCLUDED; oracle runs on the full parse.\n`);

  const filings = await collectAll(values.dir, scoped, years.map(String));

  // ⚠⚠ READ THE ANOMALY REGISTER ON EVERY RUN. Its Georgia predecessor is
  // imported by nothing, so the Milledgeville flag could never reach anyone and
  // nothing noticed when the data moved. A flagged filing is announced here and
  // its recorded claim re-checked — and it still LOADS, exactly as published.
  auditFigureFlags(filings);

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
  const order = [...scoped].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
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
  for (const ent of scoped) {
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
