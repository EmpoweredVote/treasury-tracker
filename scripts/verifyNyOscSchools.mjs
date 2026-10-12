#!/usr/bin/env node
/**
 * Post-load verification for the NY OSC school-district load.
 *
 * Usage: node --env-file=.env scripts/verifyNyOscSchools.mjs
 *
 * ⚠⚠ THE `$0` TIE IS NOT ONE OF THESE CHECKS AND MUST NEVER BE ADDED AS ONE.
 * OSC publishes no total row, so TT's total is `Σ items` BY CONSTRUCTION — the
 * tie is true automatically and proves nothing. That is the Austin/Travis
 * finding and it applies in full force here.
 *
 * ⚠⚠ WHAT THESE CHECKS DO AND DO NOT ESTABLISH. They prove TT read OSC
 * faithfully. They do NOT test whether OSC is right. Only reconciliation
 * against the districts' own audited ACFRs does that, and it is a separate
 * task — see §11.1 of the spec, and note FAC starts at audit year 2016, so
 * FY1995-FY2015 has no audit route at all.
 */
import { createClient } from '@supabase/supabase-js';

import {
  SCHOOL_ARCHIVE_PATH, readYear, aggregateCityYear, SCHOOL_SOURCE_PREFIX,
} from './lib/nyOsc.mjs';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from './data/nyOscSchoolFundPrefixes.mjs';
import { NY_SCHOOL_ENTITIES } from './data/nyOscSchoolEntities.mjs';

const FROM = 1995;
const TO = 2025;
const SOURCE_KEY = 'NY_OSC_SCHOOL';
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];
const SCOPES = ['general_fund', 'total_governmental'];
const ORACLE_YEARS = [1998, 2005, 2012, 2013, 2021, 2025];
const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
const fail = (m) => { console.error(`   ✗ ${m}`); failures++; };
const ok = (m) => console.log(`   ✓ ${m}`);

/**
 * ⚠ A paged read needs a TOTAL ORDER and a SERVER-SIDE filter, and the guard
 * is that DISTINCT ids equal the row count. This has been broken five times in
 * this repo. PostgREST also caps a single response at 1,000 rows regardless of
 * `.limit()`, so paging is not optional.
 */
async function allNyOscSchoolBudgets() {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .schema('treasury')
      .from('budgets')
      .select('id,municipality_id,fiscal_year,dataset_type,total_budget,fund_scope,basis,'
        + 'derivation,data_source,fiscal_year_start_month')
      .like('data_source', `${SCHOOL_SOURCE_PREFIX}%`)
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

const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', SOURCE_KEY);
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);
const codeById = new Map(keyRows.map((k) => [k.municipality_id, k.source_entity_key]));
const ROSTER_CODES = new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode));

const rows = await allNyOscSchoolBudgets();
console.log(`\nCHECK 0 — read ${rows.length} NY OSC school budget rows `
  + `(${new Set(rows.map((r) => r.id)).size} distinct ids)\n`);

// ── CHECK 1 — completeness, and every absence explained ─────────────────────
// ⚠ The expected count is NOT 719 x 31 x 2 x 2. A district-year whose
// total_governmental could not be classified is absent BY DESIGN, and the
// number of districts FILING varies year to year (711 in FY1995, 689 with
// revenue/expenditure sections in FY2021). This check therefore recomputes,
// from the archive, which cells should exist — and then requires the database
// to hold exactly those.
console.log('CHECK 1 — completeness, with every absence accounted for');
{
  const present = new Set(rows.map(
    (r) => `${codeById.get(r.municipality_id)}|${r.fiscal_year}|${r.dataset_type}|${r.fund_scope}`,
  ));
  const expected = new Set();
  const refused = [];

  for (const fy of ORACLE_YEARS) {
    const byCode = new Map();
    for (const r of readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')) {
      if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
      byCode.get(r.municipalCode).push(r);
    }
    for (const [code, districtRows] of byCode) {
      if (!ROSTER_CODES.has(code)) continue;
      for (const { datasetType, section } of DATASETS) {
        for (const scope of SCOPES) {
          const agg = aggregateCityYear(districtRows, { section, scope, ...SCHOOL });
          const k = `${code}|${fy}|${datasetType}|${scope}`;
          if (agg.scope === 'unknown') { refused.push([k, agg.unknownPrefixes.join(',')]); continue; }
          if (agg.tree.length === 0) continue;
          expected.add(k);
        }
      }
    }
  }

  const missing = [...expected].filter((k) => !present.has(k));
  if (missing.length) fail(`${missing.length} expected cells absent, e.g. ${missing.slice(0, 3)}`);
  else ok(`every cell the archive supports is present across FY${ORACLE_YEARS.join(', FY')}`);

  const wronglyPresent = refused.filter(([k]) => present.has(k));
  if (wronglyPresent.length) {
    fail(`${wronglyPresent.length} refused cells were written anyway — `
      + `an unclassifiable prefix must NEVER be summed: ${wronglyPresent.slice(0, 3).map(([k]) => k)}`);
  } else {
    ok(`all ${refused.length} refused cells in those years are absent, as designed`);
  }

  // Entity and year coverage over the whole load, not just the sampled years.
  const entities = new Set(rows.map((r) => r.municipality_id));
  if (entities.size !== ROSTER_CODES.size) {
    fail(`${entities.size} entities carry rows, expected ${ROSTER_CODES.size}`);
  } else {
    ok(`all ${ROSTER_CODES.size} districts carry rows`);
  }

  const years = new Set(rows.map((r) => r.fiscal_year));
  const missingYears = [];
  for (let fy = FROM; fy <= TO; fy++) if (!years.has(fy)) missingYears.push(fy);
  if (missingYears.length) fail(`fiscal years absent entirely: ${missingYears.join(', ')}`);
  else ok(`all ${TO - FROM + 1} fiscal years FY${FROM}-FY${TO} present`);

  // ⚠⚠ GENERAL FUND IS COUNTED PER YEAR, NOT AGAINST A CONSTANT. `A` is never
  // refused, so its count is exactly determined — but the number of districts
  // filing changes every year, so a single multiplication would be wrong. The
  // expectation is recomputed from each year's own file.
  let expectedGf = 0;
  const perYear = {};
  for (let fy = FROM; fy <= TO; fy++) {
    const byCode = new Map();
    for (const r of readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')) {
      if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
      byCode.get(r.municipalCode).push(r);
    }
    let n = 0;
    for (const [code, districtRows] of byCode) {
      if (!ROSTER_CODES.has(code)) continue;
      for (const { section } of DATASETS) {
        const agg = aggregateCityYear(districtRows, { section, scope: 'general_fund', ...SCHOOL });
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
    ok(`general_fund is complete: ${gf} rows, recomputed per year across `
      + `FY${FROM}-FY${TO} (not a constant)`);
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

// ── CHECK 4 — fiscal calendars ──────────────────────────────────────────────
// ⚠⚠ THIS IS THE OPPOSITE OF THE CITY CHECK AND THAT IS DELIBERATE.
// Cities span five year-ends, so a UNIFORM result there proves the month was
// carried rather than read. Every school district in the state ends June 30,
// so uniformity is the CORRECT answer here and the city check would fail a
// correct load.
//
// ⚠ The check is INVERTED, NOT DELETED. The lesson of the FYSM defect is that
// a month must be MEASURED — not that the measurement must come out varied.
// A district reporting anything but month 7 is a finding.
console.log('\nCHECK 4 — every district reports month 7, read not assumed');
{
  const months = new Map();
  for (const r of rows) {
    if (!months.has(r.municipality_id)) months.set(r.municipality_id, new Set());
    months.get(r.municipality_id).add(r.fiscal_year_start_month);
  }
  const dist = {};
  for (const [, s] of months) for (const m of s) dist[m] = (dist[m] ?? 0) + 1;
  console.log(`      distribution across districts: ${JSON.stringify(dist)}`);

  const wrongMonth = rows.filter((r) => r.fiscal_year_start_month !== 7);
  if (wrongMonth.length) {
    fail(`${wrongMonth.length} rows report a start month other than 7 — `
      + 'every NY district files to a June 30 year end');
  } else {
    ok('every row reports month 7');
  }

  const inconsistent = [...months.entries()].filter(([, s]) => s.size > 1);
  if (inconsistent.length) fail(`${inconsistent.length} districts change month mid-series`);
  else ok('no district changes its fiscal start month mid-series');

  // ⚠ Non-vacuity: the archive must actually be the thing that said 7.
  const fromArchive = new Set(readYear(SCHOOL_ARCHIVE_PATH, 2021, 'SchoolDistrict')
    .map((r) => r.fiscalYearStartMonth));
  if (!(fromArchive.size === 1 && fromArchive.has(7))) {
    fail(`the archive itself does not report a single month 7: ${[...fromArchive]}`);
  } else {
    ok('the archive independently reports month 7 and nothing else');
  }
}

// ── CHECK 5 — the only check that compares figures to anything ──────────────
// ⚠ Still not an oracle on OSC. This re-derives each stored total from the
// archive with an independent pass, so it catches a loader that mangled,
// mislabelled or truncated what OSC published. It cannot catch OSC being wrong.
console.log('\nCHECK 5 — every stored total re-derives from the archive');
{
  let checked = 0;
  let bad = 0;
  for (const fy of ORACLE_YEARS) {
    const byCode = new Map();
    for (const r of readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict')) {
      if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
      byCode.get(r.municipalCode).push(r);
    }
    for (const r of rows.filter((x) => x.fiscal_year === fy)) {
      const districtRows = byCode.get(codeById.get(r.municipality_id));
      if (!districtRows) continue;
      const section = r.dataset_type === 'revenue' ? 'REVENUE' : 'EXPENDITURE';
      const agg = aggregateCityYear(districtRows, {
        section,
        scope: r.fund_scope,
        ...SCHOOL,
      });
      checked++;
      if (Math.abs(agg.total - Number(r.total_budget)) > 0.005) {
        bad++;
        if (bad <= 3) {
          console.error(`      FY${fy} ${r.dataset_type} ${r.fund_scope}: `
            + `db ${r.total_budget} vs archive ${agg.total}`);
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
console.log('⚠ Only reconciliation against the districts\' own audited ACFRs tests OSC itself.');
