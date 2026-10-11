#!/usr/bin/env node
/**
 * Post-load verification for the NY OSC city load.
 *
 * Usage: node --env-file=.env scripts/verifyNyOscCities.mjs
 *
 * ⚠⚠ THE `$0` TIE IS NOT ONE OF THESE CHECKS AND MUST NEVER BE ADDED AS ONE.
 * OSC publishes no total row, so TT's total is `Σ items` BY CONSTRUCTION — the
 * tie is true automatically and proves nothing. That is the Austin/Travis
 * finding and it applies in full force here.
 *
 * ⚠⚠ WHAT THESE CHECKS DO AND DO NOT ESTABLISH. They prove TT read OSC
 * faithfully. They do NOT test whether OSC is right. Only reconciliation
 * against the cities' own audited ACFRs does that, and it is a separate task.
 */
import { createClient } from '@supabase/supabase-js';

import {
  ARCHIVE_PATH, readYear, aggregateCityYear, SOURCE_PREFIX,
} from './lib/nyOsc.mjs';
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

const FROM = 1995;
const TO = 2021;
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];
const SCOPES = ['general_fund', 'total_governmental'];
const ORACLE_YEARS = [1998, 2005, 2012, 2013, 2021];

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
async function allNyOscBudgets() {
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

const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', 'NY_OSC');
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);
const idByCode = new Map(keyRows.map((k) => [k.source_entity_key, k.municipality_id]));
const codeById = new Map(keyRows.map((k) => [k.municipality_id, k.source_entity_key]));

const rows = await allNyOscBudgets();
console.log(`\nCHECK 0 — read ${rows.length} NY OSC budget rows `
  + `(${new Set(rows.map((r) => r.id)).size} distinct ids)\n`);

// ── CHECK 1 — completeness, and every absence explained ─────────────────────
// ⚠ The expected count is NOT 61 x 27 x 2 x 2 = 6,588. A city-year whose
// total_governmental could not be classified is absent BY DESIGN. This check
// therefore recomputes, from the archive, which cells should exist — and then
// requires the database to hold exactly those. An unexplained absence fails;
// so does a row that should not be there.
console.log('CHECK 1 — completeness, with every absence accounted for');
{
  const present = new Set(rows.map(
    (r) => `${codeById.get(r.municipality_id)}|${r.fiscal_year}|${r.dataset_type}|${r.fund_scope}`,
  ));
  const expected = new Set();
  const refused = [];

  for (const fy of ORACLE_YEARS) {
    const byCode = new Map();
    for (const r of readYear(ARCHIVE_PATH, fy)) {
      if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
      byCode.get(r.municipalCode).push(r);
    }
    for (const e of NY_CITY_ENTITIES) {
      const cityRows = byCode.get(e.municipalCode);
      if (!cityRows) continue;
      for (const { datasetType, section } of DATASETS) {
        for (const scope of SCOPES) {
          const agg = aggregateCityYear(cityRows, { section, scope });
          const k = `${e.municipalCode}|${fy}|${datasetType}|${scope}`;
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
  if (entities.size !== 61) fail(`${entities.size} entities carry rows, expected 61`);
  else ok('all 61 cities carry rows');

  const years = new Set(rows.map((r) => r.fiscal_year));
  const missingYears = [];
  for (let fy = FROM; fy <= TO; fy++) if (!years.has(fy)) missingYears.push(fy);
  if (missingYears.length) fail(`fiscal years absent entirely: ${missingYears.join(', ')}`);
  else ok(`all ${TO - FROM + 1} fiscal years FY${FROM}-FY${TO} present`);

  // General Fund has no refusals, so its count is exactly determined.
  const gf = rows.filter((r) => r.fund_scope === 'general_fund').length;
  const expectedGf = 61 * (TO - FROM + 1) * DATASETS.length;
  if (gf !== expectedGf) fail(`general_fund has ${gf} rows, expected ${expectedGf}`);
  else ok(`general_fund is complete: ${gf} = 61 cities x ${TO - FROM + 1} years x 2 datasets`);
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
// ⚠⚠ NOT "all cities share a month". That would assert conformity to a
// hardcode, which is the FYSM defect itself and not a test for it. What must
// hold is that each ENTITY is internally consistent across its own years; the
// distribution is REPORTED, never flattened.
console.log('\nCHECK 4 — fiscal start month is per entity and internally consistent');
{
  const months = new Map();
  for (const r of rows) {
    if (!months.has(r.municipality_id)) months.set(r.municipality_id, new Set());
    months.get(r.municipality_id).add(r.fiscal_year_start_month);
  }
  const inconsistent = [...months.entries()].filter(([, s]) => s.size > 1);
  const dist = {};
  for (const [, s] of months) for (const m of s) dist[m] = (dist[m] ?? 0) + 1;
  console.log(`      distribution across cities: ${JSON.stringify(dist)}`);
  if (Object.keys(dist).length < 2) {
    fail('every city reports the SAME fiscal start month — the archive shows five distinct '
      + 'year-ends, so a uniform result means the month was carried, not read');
  } else {
    ok(`${Object.keys(dist).length} distinct start months, read per entity`);
  }
  if (inconsistent.length) {
    fail(`${inconsistent.length} cities change fiscal start month mid-series`);
  } else {
    ok('no city changes its fiscal start month mid-series');
  }
  const illegal = rows.filter((r) => !(r.fiscal_year_start_month >= 1 && r.fiscal_year_start_month <= 12));
  if (illegal.length) fail(`${illegal.length} rows carry a month outside 1-12`);
  else ok('every month is in 1-12');
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
    for (const r of readYear(ARCHIVE_PATH, fy)) {
      if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
      byCode.get(r.municipalCode).push(r);
    }
    for (const r of rows.filter((x) => x.fiscal_year === fy)) {
      const cityRows = byCode.get(codeById.get(r.municipality_id));
      if (!cityRows) continue;
      const section = r.dataset_type === 'revenue' ? 'REVENUE' : 'EXPENDITURE';
      const agg = aggregateCityYear(cityRows, { section, scope: r.fund_scope });
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
console.log('⚠ Only reconciliation against the cities\' own audited ACFRs tests OSC itself.');
