/**
 * Load Georgia DCA "Report of Local Government Finances" filings into TT.
 *
 * NO SHEBANG — a `#!` on a module any test imports breaks `npm test` on Windows
 * (scripts/lib/budgetAxes.mjs carries the full story).
 *
 * Usage:
 *   node scripts/loadGeorgiaRLGF.mjs --dir _acfr-work/ga/xlsx --dry-run
 *   node scripts/loadGeorgiaRLGF.mjs --dir _acfr-work/ga/xlsx --commit
 *   node scripts/loadGeorgiaRLGF.mjs --dir ... --entity macon-bibb --fy 2023 --dry-run
 *
 * ⚠ INPUT IS .xlsx, CONVERTED FROM DCA'S .xls. The published files are legacy
 * BIFF8, which ExcelJS cannot open at all. Run the fetch-stage converter first:
 *   python scripts/tools/xlsToXlsx.py <xls dir> <xlsx dir> --check
 *
 * ── WHAT IS LOADED, AND WHAT IS DELIBERATELY NOT ────────────────────────────
 *
 *   operating = Part V, government expenditures. 7 sections, 77 functions,
 *               each summed over its 4 object columns.
 *   revenue   = Parts I (taxes) + II (intergovernmental) + III (service charges
 *               and other). 7 sections.
 *
 * EXCLUDED, by the form's own scope statements — never widen the tree to close
 * a gap (the session-3 lesson):
 *   - Part IV  public utility / enterprise REVENUES
 *   - Part VI  public utility / enterprise SYSTEM EXPENSES
 *   - Part X   intergovernmental expenditures (would double-count transfers)
 *   - Parts VII-IX, XI-XIII: capital assets, personnel, debt, cash, equity —
 *     not revenue or expenditure flows.
 *
 * ── ⚠⚠ fund_scope IS `unknown`, ON PURPOSE ─────────────────────────────────
 *
 * Part V's own header reads: "Report Expenditures from ALL FUNDS EXCEPT:
 * Principal and Interest on Debt / Public Utility Systems, if reported in Part
 * VI / Inter-fund Transfers."
 *
 * Excluding enterprise makes this governmental rather than all-funds. But it
 * ALSO excludes debt service, which a true `total_governmental` figure
 * INCLUDES — for Macon-Bibb FY2023 that is roughly $15M of principal and
 * interest against $256M of reported expenditure, a ~5.5% systematic
 * understatement. Stamping `total_governmental` would assert a comparability
 * these rows do not have, which is precisely the "uniform is not correct" trap
 * from the fiscal-month arc: conforming to the vocabulary instead of describing
 * the source.
 *
 * `unknown` is the honest value and follows the WeHo precedent, where rows gross
 * of interfund transfers were deliberately left `unknown` rather than filed
 * beside figures they are not comparable to. Revisit if TT ever grows a scope
 * value for "governmental excluding debt service".
 */

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  parseLoad1, harvestLabels, readPageValues, aliasBareCodes,
  buildExpenditureTree, buildRevenueTree, checkSectionTotals, checkPartTotals,
  readLog1, EXPENDITURE_SECTIONS, REVENUE_SECTIONS, OBJECT_COLUMNS,
  PAGE_GEOMETRY, num,
} from './lib/gaRlgf.mjs';
import { GA_KNIGHT_ENTITIES, entityByCicoid, GA_LOAD_WINDOW } from './data/georgiaKnightEntities.mjs';

const SOURCE_PREFIX = 'Georgia DCA Report of Local Government Finances';
const SOURCE_URL = 'https://apps.dca.ga.gov/RLGF/Default.aspx';
const FUND_SCOPE = 'unknown';
const BASIS_VALUE = 'actual';
const DERIVATION = 'as_published';
const GA_STATE = 'GA';

/**
 * The audit branch, recorded in the data_source string.
 *
 * ⚠ All three branches grade `self_reported_unaudited` — Chris's call,
 * 2026-08-29. Georgia DCA performs NO reconciliation to audited statements
 * (unlike FL DFS), and CVIOG states the figures "may or may not be audited
 * amounts". The branch is recorded anyway so it stays visible and re-gradable
 * later WITHOUT a reload, which is the whole reason it is in the source string.
 */
export function auditBranch(audited) {
  if (audited === true) return 'preparer-certified audited';
  if (audited === false) return 'self-reported';
  return 'audit status not stated';
}

export function sourceNameFor(datasetType, fiscalYear, audited) {
  const face = datasetType === 'operating' ? 'Expenditure by Function' : 'Revenue by Source';
  return `${SOURCE_PREFIX} — ${face} (FY${fiscalYear} actual, ${auditBranch(audited)})`;
}

/** Read one worksheet into a zero-indexed grid. */
function gridOf(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) return null;
  const rows = [];
  ws.eachRow({ includeEmpty: true }, (row, i) => {
    const arr = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => { arr[c - 1] = cell.value; });
    rows[i - 1] = arr;
  });
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/**
 * Parse `{CICOID}_{FY}_RLGF_{Name}.xlsx`.
 *
 * ⚠ REFUSES A NON-NUMERIC YEAR. DCA's own listing serves
 * `2005001_YEAR_RLGF_Milledgeville.xls`, a literal placeholder. Coercing that
 * would mint a row under fiscal year NaN or 0.
 */
export function parseFilename(file) {
  const m = basename(file).match(/^(\d{7})_(\d{4})_RLGF_(.+)\.xlsx$/i);
  if (!m) return null;
  return { cicoid: m[1], fiscalYear: Number(m[2]), label: m[3] };
}

/** Nested `{n, a, c}` shape that `treasury_sync_city_budget` expects. */
function toTree(built) {
  return built.roots
    .filter((r) => r.items.length > 0 || r.amount !== 0)
    .map((r) => {
      const children = r.items
        .filter((i) => i.amount !== 0)
        .map((i) => ({ n: i.label, a: i.amount }));
      return children.length ? { n: r.label, a: r.amount, c: children } : { n: r.label, a: r.amount };
    });
}

/**
 * Resolve the fiscal-year start month, and say how.
 *
 * Two sources: the filing's OWN `FYEmonth` field, and the FAC census entry for
 * the entity. Never returns a month the two contradict, and never silently
 * defaults — `project_fysm_column_default_one_defect` is the story of a month
 * that defaulted rather than admitting ignorance.
 *
 * ⚠ Baldwin FY2020 prints the unfilled placeholder "MONTH", so the form yields
 * nothing and the registry value carries it. That is recorded, not hidden.
 */
export function resolveMonth(entity, meta) {
  const fromForm = meta.fyEndMonth;
  const declared = entity.fiscalYearStartMonth;
  if (fromForm && fromForm !== declared) {
    return { month: null, how: `CONFLICT form=${fromForm} registry=${declared}`, ok: false };
  }
  if (!fromForm) {
    return {
      month: declared,
      how: `registry only (form FYEmonth = ${JSON.stringify(meta.fyEndMonthText)})`,
      ok: true,
      confirmed: entity.censusConfirms,
    };
  }
  return {
    month: declared,
    how: entity.censusConfirms ? 'form + FAC census agree' : 'form only (census has no row)',
    ok: true,
    confirmed: entity.censusConfirms,
  };
}

/** Parse one workbook fully, running every oracle. */
export async function readFiling(path) {
  const meta0 = parseFilename(path);
  if (!meta0) return { skipped: 'filename', path };
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const load1 = gridOf(wb, 'LOAD1');
  // FY2009-2015 uses `Exportable Data` instead; a different key set, filed as a
  // follow-up. Reported as skipped, never counted as a pass.
  if (!load1) return { skipped: 'no LOAD1 (pre-FY2016 form)', ...meta0, path };

  const { blocks } = parseLoad1(load1);
  const pages = {};
  for (const n of Object.keys(PAGE_GEOMETRY)) {
    const g = gridOf(wb, n);
    if (g) pages[n] = g;
  }
  const { labels } = harvestLabels(pages);
  const { values: pageValues } = readPageValues(pages);
  aliasBareCodes(pageValues, new Set(Object.values(blocks).flatMap((b) => Object.keys(b))));

  const anomalies = [];
  const exp = buildExpenditureTree(blocks, labels, pageValues, anomalies);
  const rev = buildRevenueTree(blocks, labels, pages, pageValues, anomalies);
  const log1 = readLog1(blocks._LOG1 || {});

  const checks = [
    ...checkSectionTotals(exp, blocks, EXPENDITURE_SECTIONS).map((c) => ({ ...c, tag: 'EXP' })),
    ...checkSectionTotals(rev, blocks, REVENUE_SECTIONS).map((c) => ({ ...c, tag: 'REV' })),
    ...checkPartTotals(rev, blocks).map((c) => ({ ...c, tag: 'REV' })),
  ];
  const grandExpected = OBJECT_COLUMNS.reduce((a, o) => a + num((blocks._E6 || {})[`TTL_PART5_${o}`]), 0);
  checks.push({
    tag: 'EXP', id: 'Part V grand', expected: grandExpected, actual: exp.total,
    ok: Math.abs(grandExpected - exp.total) <= 0.005,
  });

  return { ...meta0, path, exp, rev, log1, checks, anomalies };
}

async function main() {
  const { values: argv } = parseArgs({
    options: {
      dir: { type: 'string' },
      entity: { type: 'string' },
      fy: { type: 'string' },
      commit: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });
  const dir = argv.dir || '_acfr-work/ga/xlsx';
  const commit = !!argv.commit && !argv['dry-run'];

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.xlsx')).sort();
  const wanted = new Set(
    argv.entity
      ? GA_KNIGHT_ENTITIES.filter((e) => e.key === argv.entity).map((e) => e.cicoid)
      : GA_KNIGHT_ENTITIES.map((e) => e.cicoid),
  );
  if (argv.entity && wanted.size === 0) {
    console.error(`Unknown --entity ${argv.entity}`);
    process.exit(2);
  }

  const filings = [];
  const skipped = [];
  for (const f of files) {
    const parsed = parseFilename(f);
    if (!parsed) { skipped.push(`${f}: unparseable filename`); continue; }
    if (!wanted.has(parsed.cicoid)) continue;
    if (argv.fy && parsed.fiscalYear !== Number(argv.fy)) continue;
    if (parsed.fiscalYear < GA_LOAD_WINDOW.firstFiscalYear
      || parsed.fiscalYear > GA_LOAD_WINDOW.lastFiscalYear) {
      skipped.push(`${f}: FY outside the ${GA_LOAD_WINDOW.firstFiscalYear}-${GA_LOAD_WINDOW.lastFiscalYear} window`);
      continue;
    }
    const filing = await readFiling(join(dir, f));
    if (filing.skipped) { skipped.push(`${f}: ${filing.skipped}`); continue; }
    filings.push(filing);
  }

  // ⚠⚠ A GATE THAT CAN MEASURE NOTHING MUST FAIL, NOT PASS. Session 3 shipped a
  // parse that produced zero rows, counted zero checks, and printed "Oracle
  // green". Refuse an empty run outright.
  if (filings.length === 0) {
    console.error('REFUSING: no filings parsed. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }

  let failed = 0;
  let checksRun = 0;
  const anomalies = [];
  console.log(`${'entity'.padEnd(20)} ${'FY'.padEnd(5)} ${'operating'.padStart(16)} ${'revenue'.padStart(18)} mo  audited  oracle`);
  for (const f of filings) {
    const ent = entityByCicoid(f.cicoid);
    const m = resolveMonth(ent, f.log1);
    const bad = f.checks.filter((c) => !c.ok && !c.skipped);
    const skippedChecks = f.checks.filter((c) => c.skipped);
    checksRun += f.checks.length - skippedChecks.length;
    if (bad.length || skippedChecks.length || !m.ok) failed++;
    for (const a of f.anomalies) anomalies.push({ entity: ent.key, fiscalYear: f.fiscalYear, ...a });
    console.log(
      `${ent.name.padEnd(20)} ${String(f.fiscalYear).padEnd(5)} `
      + `${f.exp.total.toLocaleString().padStart(16)} ${f.rev.total.toLocaleString().padStart(18)} `
      + `${String(m.month ?? '??').padEnd(3)} ${auditBranch(f.log1.audited).padEnd(28)} `
      + `${f.checks.length - bad.length - skippedChecks.length}/${f.checks.length}`,
    );
    for (const c of bad) {
      console.log(`      ✗ ${c.tag} ${c.id}: form ${Number(c.expected).toLocaleString()} vs tree ${Number(c.actual).toLocaleString()}`);
    }
    for (const c of skippedChecks) console.log(`      ? ${c.tag} ${c.id}: SKIPPED ${c.reason || ''}`);
    if (!m.ok) console.log(`      ✗ fiscal month: ${m.how}`);
  }

  console.log(`\n${filings.length} filings · ${checksRun} oracle checks run · ${failed} filing(s) with a failure`);
  if (skipped.length) {
    console.log(`\nSkipped (${skipped.length}) — reported, never silently dropped:`);
    for (const s of skipped) console.log(`   ${s}`);
  }
  if (anomalies.length) {
    console.log(`\n⚠ ANOMALIES — the publisher's extract disagrees with its own printed form (${anomalies.length}).`);
    console.log('  The printed form is loaded; these are recorded, not suppressed. See the Milledgeville Rule.');
    for (const a of anomalies) {
      // ⚠ `extract` is null when the publisher's cell is an Excel error — a
      // different fact from "the extract says zero", and the reason this prints
      // #REF! rather than a number.
      const extract = a.extract === null ? '#REF! (no value)' : a.extract.toLocaleString();
      console.log(`   ${a.entity} FY${a.fiscalYear} ${a.section} ${a.code} "${a.label}": form ${a.form.toLocaleString()} vs extract ${extract}`);
    }
  }

  if (failed) {
    console.error(`\nREFUSING TO WRITE: ${failed} filing(s) did not reconcile to the publisher's own printed subtotals.`);
    console.error('A tree that does not tie means the document was not read correctly — that is a read-fidelity');
    console.error('failure, NOT a judgement about whether the figures look right.');
    process.exit(1);
  }

  if (!commit) {
    console.log('\nDRY RUN — nothing written. Pass --commit to write.');
    return;
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  // Counties first: a city's county_id must exist before the city is created.
  const order = [...GA_KNIGHT_ENTITIES].sort((a, b) => (a.parentCountyKey ? 1 : 0) - (b.parentCountyKey ? 1 : 0));
  const ids = new Map();
  for (const ent of order) {
    const { data, error } = await db.rpc('treasury_ensure_municipality', {
      p_name: ent.name,
      p_state: GA_STATE,
      p_entity_type: ent.entityType,
      p_population: ent.population,
    });
    if (error) throw new Error(`Municipality error (${ent.name}): ${error.message}`);
    ids.set(ent.key, data);
    console.log(`  entity ${ent.name} -> ${data}`);
  }
  for (const ent of GA_KNIGHT_ENTITIES) {
    if (!ent.parentCountyKey) continue;
    const { error } = await db.schema('treasury').from('municipalities')
      .update({ county_id: ids.get(ent.parentCountyKey) }).eq('id', ids.get(ent.key));
    if (error) throw new Error(`county_id error (${ent.name}): ${error.message}`);
  }

  const sourceDate = new Date().toISOString().slice(0, 10);
  let written = 0;
  let conflicts = 0;
  for (const f of filings) {
    const ent = entityByCicoid(f.cicoid);
    const municipalityId = ids.get(ent.key);
    const m = resolveMonth(ent, f.log1);
    for (const [datasetType, built] of [['operating', f.exp], ['revenue', f.rev]]) {
      const tree = toTree(built);
      // Never-overwrite guard: `treasury_sync_city_budget` is NOT source-safe —
      // it never updates data_source, so it would overwrite another publisher's
      // row or silently insert a duplicate.
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
        console.log(`  SKIP ${ent.name} FY${f.fiscalYear} ${datasetType} — "${existing[0].data_source}" preserved`);
        continue;
      }
      const { error } = await db.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: f.fiscalYear,
        p_dataset_type: datasetType,
        p_total: built.total,
        p_tree: tree,
        p_row_count: tree.length,
        p_data_source_name: sourceNameFor(datasetType, f.fiscalYear, f.log1.audited),
        p_source_url: SOURCE_URL,
        p_source_date: sourceDate,
        p_fiscal_year_start_month: m.month,
        // ⚠⚠ LOAD-BEARING, not decoration. The RPC keys on (municipality,
        // fiscal_year, dataset_type, fund_scope, basis). Omit them and BOTH
        // default to 'unknown', so a re-run after the stampers have run matches
        // nothing and takes the INSERT branch — silently duplicating every row.
        p_fund_scope: FUND_SCOPE,
        p_basis: BASIS_VALUE,
        p_derivation: DERIVATION,
      });
      if (error) throw new Error(`RPC error (${ent.name} FY${f.fiscalYear} ${datasetType}): ${error.message}`);
      written++;
    }
  }
  console.log(`\nWrote ${written} budget rows (${conflicts} skipped by the never-overwrite guard).`);
  console.log('Now run:  npm run verify:frozen   then   npm run register:rows -- --milestone knight-s4-georgia ...');
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('loadGeorgiaRLGF.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
