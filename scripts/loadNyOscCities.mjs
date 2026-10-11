#!/usr/bin/env node
/**
 * Load the 61 non-NYC New York cities from OSC's archive.
 *
 * Spec: docs/superpowers/specs/2026-10-10-ny-cities-onboarding-design.md
 * Plan: docs/superpowers/plans/2026-10-10-ny-cities-onboarding.md, Task 10
 *
 * Usage:
 *   node --env-file=.env scripts/loadNyOscCities.mjs [--from 1995] [--to 2021] [--dry-run]
 *
 * ⚠⚠ `treasury_sync_city_budget` KEYS ON fund_scope + basis, NOT data_source.
 * This load writes TWO scopes per city-year-dataset, so omitting either
 * parameter makes a re-run DUPLICATE every row instead of updating it. Both
 * are passed on every call, unconditionally.
 *
 * ⚠⚠ The RPC reports failure in its RETURN PAYLOAD, not as a PostgREST error.
 * Counting attempts is not counting writes.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import {
  ARCHIVE_PATH, readYear, aggregateCityYear, sourceNameFor, SOURCE_URL, SOURCE_PREFIX,
} from './lib/nyOsc.mjs';
import { NY_CITY_ENTITIES } from './data/nyOscCityEntities.mjs';

/** The `source` value `seedNyCities.mjs` attaches each municipal code under. */
const SOURCE_KEY = 'NY_OSC';
const BASIS_VALUE = 'actual';
const DERIVATION = 'derived';
const SCOPES = ['general_fund', 'total_governmental'];
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '1995' },
    to: { type: 'string', default: '2021' },
    'dry-run': { type: 'boolean', default: false },
  },
});
const FROM = Number(values.from);
const TO = Number(values.to);
const DRY = values['dry-run'];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

// ── Entity lookup, keyed on OSC's municipal code ────────────────────────────
// ⚠ The publisher's key is NOT a column on `municipalities` — it lives in
// `treasury.municipality_source_keys (source, source_entity_key,
// municipality_id)`, which is what `treasury_ensure_municipality` writes
// through `attach_source_key`. Matching on the code rather than the display
// name is the whole point: a publisher rename must not fork the city.
const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', SOURCE_KEY);
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);

const idByCode = new Map(keyRows.map((k) => [k.source_entity_key, k.municipality_id]));

const unseeded = NY_CITY_ENTITIES.filter((e) => !idByCode.has(e.municipalCode));
if (unseeded.length) {
  console.error(`REFUSING: ${unseeded.length} cities are not seeded `
    + `(e.g. ${unseeded.slice(0, 3).map((e) => e.name).join(', ')}). `
    + 'Run `node --env-file=.env scripts/seedNyCities.mjs` first.');
  process.exit(1);
}

let written = 0;
let categories = 0;
let skippedMissing = 0;
let unknownScope = 0;
let conflicts = 0;
const unknownDetail = new Map();

for (let fy = FROM; fy <= TO; fy++) {
  const rows = readYear(ARCHIVE_PATH, fy);

  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
    byCode.get(r.municipalCode).push(r);
  }

  let wroteThisYear = 0;

  for (const entity of NY_CITY_ENTITIES) {
    const cityRows = byCode.get(entity.municipalCode);
    // ⚠ A city absent from this year's file is SKIPPED, never written short.
    // FY1995-2021 should never hit this; FY2022+ will, from filing lag.
    if (!cityRows || cityRows.length === 0) { skippedMissing++; continue; }

    const municipalityId = idByCode.get(entity.municipalCode);

    // ⚠ PER ENTITY, PER YEAR. Five distinct calendars among NY cities.
    const fysm = cityRows[0].fiscalYearStartMonth;

    for (const { datasetType, section } of DATASETS) {
      for (const scope of SCOPES) {
        const agg = aggregateCityYear(cityRows, { section, scope });

        if (agg.scope === 'unknown') {
          unknownScope++;
          const k = agg.unknownPrefixes.join(',');
          unknownDetail.set(k, (unknownDetail.get(k) ?? 0) + 1);
          continue;
        }
        if (agg.tree.length === 0) continue;

        // ⚠ NEVER OVERWRITE ANOTHER PUBLISHER. These 61 cities are new, so
        // this should never fire — but a guard that only runs when it is
        // already too late is not a guard.
        const { data: existing, error: lookupErr } = await db
          .schema('treasury')
          .from('budgets')
          .select('data_source')
          .eq('municipality_id', municipalityId)
          .eq('fiscal_year', fy)
          .eq('dataset_type', datasetType)
          .eq('fund_scope', scope)
          .eq('basis', BASIS_VALUE)
          .limit(1);
        if (lookupErr) throw new Error(`budget lookup failed: ${lookupErr.message}`);
        if (existing?.[0] && !String(existing[0].data_source || '').startsWith(SOURCE_PREFIX)) {
          conflicts++;
          console.log(`  SKIP ${entity.name} FY${fy} ${datasetType} ${scope} — `
            + `"${existing[0].data_source}" preserved`);
          continue;
        }

        if (DRY) { written++; wroteThisYear++; continue; }

        const { data, error } = await db.rpc('treasury_sync_city_budget', {
          p_municipality_id: municipalityId,
          p_fiscal_year: fy,
          p_dataset_type: datasetType,
          p_total: agg.total,
          p_tree: agg.tree,
          p_row_count: agg.tree.length,
          p_data_source_name: sourceNameFor(datasetType, fy, scope),
          p_source_url: SOURCE_URL,
          p_source_date: new Date().toISOString().slice(0, 10),
          p_fiscal_year_start_month: fysm,
          p_fund_scope: scope,   // ⚠ part of the RPC's key
          p_basis: BASIS_VALUE,  // ⚠ part of the RPC's key
          p_derivation: DERIVATION,
        });

        const where = `${entity.name} FY${fy} ${datasetType} ${scope}`;
        if (error) throw new Error(`RPC transport error (${where}): ${error.message}`);
        if (data?.error) throw new Error(`RPC refused (${where}): ${data.error}`);
        if (data?.status !== 'success' || !data?.budget_id) {
          throw new Error(`RPC returned no success (${where}): ${JSON.stringify(data)}`);
        }

        written++;
        wroteThisYear++;
        categories += agg.tree.reduce((a, r) => a + 1 + (r.c?.length || 0), 0);
      }
    }
  }
  console.log(`FY${fy}: ${wroteThisYear} rows${DRY ? ' (dry-run)' : ''}, ${written} so far`);
}

console.log(`\n${DRY ? '[dry-run] would write' : 'Wrote'} ${written} budget rows`
  + ` over ${categories.toLocaleString()} categories.`);
console.log(`  ${skippedMissing} city-years absent from their file`);
console.log(`  ${unknownScope} scopes left unknown (unclassifiable fund prefix)`);
for (const [k, n] of unknownDetail) console.log(`      [${k}] ${n} cells`);
console.log(`  ${conflicts} skipped by the never-overwrite guard`);

if (written === 0) {
  console.error('REFUSING: no rows were actually written.');
  process.exit(1);
}

if (!DRY) {
  console.log('\nNow run:  node --env-file=.env scripts/verifyNyOscCities.mjs');
  console.log('     then npm run verify:frozen');
  console.log('     then npm run check:forks');
  console.log('⚠ Then RE-MEASURE both EXPECTED_ROWS entries in '
    + 'scripts/data/fundScopeExpectations.mjs — do NOT paste the predictions.');
}
