#!/usr/bin/env node
/**
 * Post-load verification for one class of the NY OSC town/village/county load.
 *
 *   npm run ny:verify-municipal -- --class County
 *
 * ⚠⚠ THE `$0` TIE IS NOT ONE OF THESE CHECKS AND MUST NEVER BE ADDED AS ONE.
 * OSC publishes no total row anywhere in this source, so TT's total is
 * `Σ items` BY CONSTRUCTION — the tie is true automatically and proves nothing.
 * That is the Austin/Travis finding and it applies in full force here.
 *
 * ⚠⚠ WHAT THESE CHECKS DO AND DO NOT ESTABLISH. They prove TT read OSC
 * faithfully. They do NOT test whether OSC is right. Only reconciliation
 * against these governments' own audited ACFRs does that — see §11.1 of the
 * spec. The 57 counties are the natural candidate and it has not been done.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import {
  readYear, aggregateCityYear, archiveFor, isFullFiscalPeriod,
  MUNICIPAL_SOURCE_PREFIXES, MUNICIPAL_CLASSES,
  MUNICIPAL_FIRST_YEAR, MUNICIPAL_LAST_YEAR,
} from './lib/nyOsc.mjs';
import {
  NY_MUNICIPAL_FUND_PREFIXES, MUNICIPAL_GOVERNMENTAL_TYPES,
} from './data/nyOscMunicipalFundPrefixes.mjs';
import { NY_MUNICIPAL_ENTITIES } from './data/nyOscMunicipalEntities.mjs';

const { values } = parseArgs({ options: { class: { type: 'string' } } });
const memberClass = values.class;
if (!MUNICIPAL_CLASSES.includes(memberClass)) {
  throw new Error(`--class must be one of ${MUNICIPAL_CLASSES.join(', ')}`);
}
const archive = archiveFor(memberClass);
const SOURCE_PREFIX = MUNICIPAL_SOURCE_PREFIXES[memberClass];

const FROM = MUNICIPAL_FIRST_YEAR;
const TO = MUNICIPAL_LAST_YEAR;
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];
const SCOPES = ['general_fund', 'total_governmental'];

/**
 * ⚠ The sampled years CROSS THE ERA BOUNDARY on purpose: two from the
 * 1995-2012 schema, the 2012/2013 join itself, and three from the modern one.
 * A sample confined to one era cannot see a parser that reads only that era.
 */
const ORACLE_YEARS = [1998, 2005, 2012, 2013, 2021, 2025];

const REGISTRY = {
  registry: NY_MUNICIPAL_FUND_PREFIXES,
  governmentalTypes: MUNICIPAL_GOVERNMENTAL_TYPES,
};

/**
 * ⚠⚠ THE CALENDAR EXPECTATION IS PER CLASS, AND THE TWO SHAPES ARE OPPOSITE.
 *
 * The cities' CHECK 4 asserts the month set is NOT uniform — five year-ends
 * across 61 cities, so uniformity there proves the month was carried rather
 * than read. Towns and counties ARE uniform (January, measured over 4.5M
 * lines), so the city check would FAIL a correct load of either. The districts
 * load met this and INVERTED the check rather than deleting it; same here.
 *
 * ⚠ The lesson of the FYSM `NOT NULL DEFAULT 1` defect is that a month must be
 * MEASURED — not that the measurement must come out varied.
 */
const CALENDAR = {
  Town: { uniform: 1, why: 'every New York town files to a December 31 year end' },
  County: { uniform: 1, why: 'every New York county files to a December 31 year end' },
  Village: {
    uniform: null,
    why: 'villages do NOT share one calendar — Village Law §4-400 sets a June 1 start, '
       + 'and the archive also shows March, January, August, July, December and April',
  },
};

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const fail = (m) => { console.error(`   ✗ ${m}`); failures++; };
const ok = (m) => console.log(`   ✓ ${m}`);

/**
 * ⚠ A paged read needs a TOTAL ORDER and a SERVER-SIDE filter, and the guard
 * is that DISTINCT ids equal the row count. Broken five times in this repo.
 * PostgREST caps a response at 1,000 rows regardless of `.limit()`.
 */
async function allRows() {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .schema('treasury')
      .from('budgets')
      .select('id,municipality_id,fiscal_year,dataset_type,total_budget,fund_scope,basis,'
        + 'derivation,data_source,fiscal_year_start_month')
      .like('data_source', `${SOURCE_PREFIX}%`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`paged read failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  if (new Set(out.map((r) => r.id)).size !== out.length) {
    throw new Error('paged read returned duplicate ids — the page order is not total');
  }
  return out;
}

/** One year's rows, grouped by municipal code. */
function yearByCode(fy) {
  const byCode = new Map();
  for (const r of readYear(archive.path, fy, memberClass)) {
    if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
    byCode.get(r.municipalCode).push(r);
  }
  return byCode;
}

const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', archive.sourceKey);
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);
const codeById = new Map(keyRows.map((k) => [k.municipality_id, k.source_entity_key]));
const ROSTER_CODES = new Set(
  NY_MUNICIPAL_ENTITIES.filter((e) => e.memberClass === memberClass).map((e) => e.municipalCode));

const rows = await allRows();
console.log(`\nCHECK 0 — read ${rows.length} ${memberClass} budget rows `
  + `(${new Set(rows.map((r) => r.id)).size} distinct ids)\n`);
if (rows.length === 0) {
  console.error('REFUSING: no rows carry this source prefix — nothing to verify.');
  process.exit(1);
}

// ── CHECK 1 — completeness, and every absence explained ─────────────────────
// ⚠ The expectation is NOT entities × years × 2 × 2. An entity-year whose
// total_governmental could not be classified is absent BY DESIGN, the number
// of governments FILING changes every year, and four village-years are refused
// outright as non-annual filings. This recomputes from the archive which cells
// SHOULD exist, then requires the database to hold exactly those.
console.log('CHECK 1 — completeness, with every absence accounted for');
{
  const present = new Set(rows.map(
    (r) => `${codeById.get(r.municipality_id)}|${r.fiscal_year}|${r.dataset_type}|${r.fund_scope}`));
  const expected = new Set();
  const refusedScope = [];
  const refusedPeriod = new Set();

  for (const fy of ORACLE_YEARS) {
    for (const [code, entityRows] of yearByCode(fy)) {
      if (!ROSTER_CODES.has(code)) continue;
      if (!isFullFiscalPeriod(entityRows).ok) {
        for (const { datasetType } of DATASETS) {
          for (const scope of SCOPES) refusedPeriod.add(`${code}|${fy}|${datasetType}|${scope}`);
        }
        continue;
      }
      for (const { datasetType, section } of DATASETS) {
        for (const scope of SCOPES) {
          const agg = aggregateCityYear(entityRows, { section, scope, ...REGISTRY });
          const k = `${code}|${fy}|${datasetType}|${scope}`;
          if (agg.scope === 'unknown') { refusedScope.push(k); continue; }
          if (agg.tree.length === 0) continue;
          expected.add(k);
        }
      }
    }
  }

  const missing = [...expected].filter((k) => !present.has(k));
  if (missing.length) fail(`${missing.length} expected cells absent, e.g. ${missing.slice(0, 3)}`);
  else ok(`every cell the archive supports is present across FY${ORACLE_YEARS.join(', FY')}`);

  const wronglyPresent = refusedScope.filter((k) => present.has(k));
  if (wronglyPresent.length) {
    fail(`${wronglyPresent.length} cells with an unclassifiable prefix were written anyway — `
      + `they must NEVER be summed: ${wronglyPresent.slice(0, 3)}`);
  } else {
    ok(`all ${refusedScope.length} unclassifiable-prefix cells in those years are absent, by design`);
  }

  const stubsPresent = [...refusedPeriod].filter((k) => present.has(k));
  if (stubsPresent.length) {
    fail(`${stubsPresent.length} NON-ANNUAL filings were written: ${stubsPresent.slice(0, 4)}`);
  } else {
    ok(`all ${refusedPeriod.size} non-annual cells in those years are absent, by design`);
  }

  const entities = new Set(rows.map((r) => r.municipality_id));
  if (entities.size !== ROSTER_CODES.size) {
    fail(`${entities.size} entities carry rows, expected ${ROSTER_CODES.size}`);
  } else {
    ok(`all ${ROSTER_CODES.size} ${archive.entityType}s carry rows`);
  }

  const years = new Set(rows.map((r) => r.fiscal_year));
  const missingYears = [];
  for (let fy = FROM; fy <= TO; fy++) if (!years.has(fy)) missingYears.push(fy);
  if (missingYears.length) fail(`fiscal years absent entirely: ${missingYears.join(', ')}`);
  else ok(`all ${TO - FROM + 1} fiscal years FY${FROM}-FY${TO} present`);

  const outside = [...years].filter((y) => y < FROM || y > TO);
  if (outside.length) fail(`rows exist outside the load window: FY${outside.join(', FY')}`);
  else ok(`no rows outside FY${FROM}-FY${TO} (FY2026 is refused by design)`);

  // ⚠⚠ GENERAL FUND IS COUNTED PER YEAR, NOT AGAINST A CONSTANT. `A` is never
  // refused for an unclassifiable prefix, so its count is exactly determined —
  // but the number of governments filing changes every year, so a single
  // multiplication would be wrong. Recomputed from each year's own file.
  let expectedGf = 0;
  const perYear = {};
  for (let fy = FROM; fy <= TO; fy++) {
    let n = 0;
    for (const [code, entityRows] of yearByCode(fy)) {
      if (!ROSTER_CODES.has(code)) continue;
      if (!isFullFiscalPeriod(entityRows).ok) continue;
      for (const { section } of DATASETS) {
        const agg = aggregateCityYear(entityRows, { section, scope: 'general_fund', ...REGISTRY });
        if (agg.tree.length > 0) n++;
      }
    }
    perYear[fy] = n;
    expectedGf += n;
  }
  const gf = rows.filter((r) => r.fund_scope === 'general_fund').length;
  if (gf !== expectedGf) {
    fail(`general_fund has ${gf} rows, expected ${expectedGf} summed per year`);
    console.error(`      per-year expectation: ${JSON.stringify(perYear)}`);
  } else {
    ok(`general_fund is complete: ${gf} rows, recomputed per year across FY${FROM}-FY${TO}`);
  }
}

// ── CHECK 2 — axis stamping ─────────────────────────────────────────────────
console.log('\nCHECK 2 — every row carries the axes the registries claim');
{
  const badBasis = rows.filter((r) => r.basis !== 'actual');
  const badScope = rows.filter((r) => !SCOPES.includes(r.fund_scope));
  const badDeriv = rows.filter((r) => r.derivation !== 'derived');
  if (badBasis.length) fail(`${badBasis.length} rows are not basis=actual`);
  else ok('every row is basis=actual');
  if (badScope.length) fail(`${badScope.length} rows carry an illegal fund_scope`);
  else ok('every row carries general_fund or total_governmental');
  // ⚠ `derived`, not `published`: OSC publishes no total, so every total here
  // is one TT computed.
  if (badDeriv.length) fail(`${badDeriv.length} rows are not derivation=derived`);
  else ok('every row is derivation=derived');

  // ⚠⚠ THE SOURCE NAME MUST NOT BE CLAIMABLE BY ANOTHER NY FAMILY. The city
  // pattern is `^New York OSC Annual Financial Report —`; this one carries the
  // class word. A row landing under the wrong family would lose fund_scope,
  // basis AND audit_grade to `unknown` at once, or worse, silently inherit
  // another class's evidence.
  const strayed = rows.filter((r) => !String(r.data_source).startsWith(`${SOURCE_PREFIX} — `));
  if (strayed.length) fail(`${strayed.length} rows do not carry "${SOURCE_PREFIX} — "`);
  else ok(`every row carries the ${memberClass}-specific source family`);
}

// ── CHECK 3 — general_fund never exceeds total_governmental ─────────────────
console.log('\nCHECK 3 — general_fund <= total_governmental, wherever both exist');
{
  const byCell = new Map();
  for (const r of rows) {
    const k = `${r.municipality_id}|${r.fiscal_year}|${r.dataset_type}`;
    if (!byCell.has(k)) byCell.set(k, {});
    byCell.get(k)[r.fund_scope] = Number(r.total_budget);
  }
  let bad = 0;
  let compared = 0;
  for (const [k, v] of byCell) {
    if (v.general_fund === undefined || v.total_governmental === undefined) continue;
    compared++;
    if (v.general_fund > v.total_governmental + 0.5) {
      bad++;
      if (bad <= 3) console.error(`      ${k}: GF ${v.general_fund} > TG ${v.total_governmental}`);
    }
  }
  if (bad) fail(`${bad} of ${compared} cells where General Fund exceeds Total Governmental`);
  else ok(`${compared} cells compared, none inverted`);
}

// ── CHECK 4 — fiscal calendars, per class ───────────────────────────────────
console.log(`\nCHECK 4 — fiscal calendars (${memberClass}: ${CALENDAR[memberClass].why})`);
{
  const months = new Map();
  for (const r of rows) {
    if (!months.has(r.municipality_id)) months.set(r.municipality_id, new Set());
    months.get(r.municipality_id).add(r.fiscal_year_start_month);
  }
  const dist = {};
  for (const r of rows) dist[r.fiscal_year_start_month] = (dist[r.fiscal_year_start_month] ?? 0) + 1;
  console.log(`      distribution across rows: ${JSON.stringify(dist)}`);

  const expectUniform = CALENDAR[memberClass].uniform;
  const archiveMonths = new Set(readYear(archive.path, 2021, memberClass)
    .map((r) => r.fiscalYearStartMonth));

  if (expectUniform === null) {
    // Villages: a uniform result would mean the month was carried, not read.
    if (Object.keys(dist).length < 2) {
      fail('every village reports the same start month — a uniform result here means the '
        + 'month was carried rather than read per entity');
    } else {
      ok(`${Object.keys(dist).length} distinct start months, read per entity per year`);
    }
    if (archiveMonths.size < 2) {
      fail(`the archive itself reports a single month in FY2021: ${[...archiveMonths]}`);
    } else {
      ok(`the archive independently reports ${archiveMonths.size} months in FY2021`);
    }
  } else {
    const wrong = rows.filter((r) => r.fiscal_year_start_month !== expectUniform);
    if (wrong.length) {
      fail(`${wrong.length} rows report a start month other than ${expectUniform}`);
    } else {
      ok(`every row reports month ${expectUniform}`);
    }
    // ⚠ Non-vacuity: the ARCHIVE must be the thing that said so.
    if (!(archiveMonths.size === 1 && archiveMonths.has(expectUniform))) {
      fail(`the archive itself does not report a single month ${expectUniform}: `
        + `${[...archiveMonths]}`);
    } else {
      ok(`the archive independently reports month ${expectUniform} and nothing else`);
    }
  }

  const inconsistent = [...months.entries()].filter(([, s]) => s.size > 1);
  if (inconsistent.length) {
    // ⚠ For villages this is NOT automatically a failure — three of them
    // genuinely changed calendar, and the stub year they changed in is refused.
    // It is a failure only if an entity changes month without a refused year.
    console.log(`      ${inconsistent.length} entities change start month mid-series`);
    if (memberClass !== 'Village') {
      fail(`${inconsistent.length} ${archive.entityType}s change month mid-series`);
    } else {
      ok(`${inconsistent.length} villages changed calendar — each transition year is refused`);
    }
  } else {
    ok('no entity changes its fiscal start month mid-series');
  }
}

// ── CHECK 5 — the only check that compares figures to anything ──────────────
// ⚠ Still not an oracle on OSC. This re-derives each stored total from the
// archive in an independent pass, so it catches a loader that mangled,
// mislabelled or truncated what OSC published. It cannot catch OSC being wrong.
console.log('\nCHECK 5 — every stored total re-derives from the archive');
{
  let checked = 0;
  let bad = 0;
  for (const fy of ORACLE_YEARS) {
    const byCode = yearByCode(fy);
    for (const r of rows.filter((x) => x.fiscal_year === fy)) {
      const entityRows = byCode.get(codeById.get(r.municipality_id));
      if (!entityRows) continue;
      const section = r.dataset_type === 'revenue' ? 'REVENUE' : 'EXPENDITURE';
      const agg = aggregateCityYear(entityRows, { section, scope: r.fund_scope, ...REGISTRY });
      checked++;
      if (Math.abs(agg.total - Number(r.total_budget)) > 0.005) {
        bad++;
        if (bad <= 3) {
          console.error(`      FY${fy} ${codeById.get(r.municipality_id)} ${r.dataset_type} `
            + `${r.fund_scope}: db ${r.total_budget} vs archive ${agg.total}`);
        }
      }
    }
  }
  if (checked === 0) fail('re-derived nothing — the comparison never ran');
  else if (bad) fail(`${bad} of ${checked} stored totals do not re-derive`);
  else ok(`${checked} stored totals re-derive to the cent`);
}

console.log('');
if (failures) {
  console.error(`${failures} check(s) FAILED\n`);
  process.exit(1);
}
console.log('All checks passed.');
console.log('⚠ These establish that TT read OSC faithfully — NOT that OSC is right.');
console.log('⚠ Only reconciliation against these governments\' own audited ACFRs tests OSC.');
