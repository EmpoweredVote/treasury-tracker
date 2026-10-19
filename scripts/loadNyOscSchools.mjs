#!/usr/bin/env node
/**
 * Load the 719 NY school districts from OSC's archive.
 *
 * Spec: docs/superpowers/specs/2026-10-11-ny-school-districts-design.md
 *
 * ⚠⚠ `treasury_sync_city_budget` KEYS ON fund_scope + basis, NOT data_source.
 * Two scopes per district-year-dataset, so omitting either DUPLICATES on a
 * re-run.
 *
 * ⚠ The never-overwrite guard is BATCHED, not dropped: one read per fiscal
 * year instead of one per row. ~85,400 writes with a per-row SELECT would be
 * ~170,000 round trips and a multi-hour run. A guard that only appears when it
 * is needed is not a guard, and this is the largest load TT has run.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import {
  SCHOOL_ARCHIVE_PATH, readYear, aggregateCityYear, schoolSourceNameFor, SOURCE_URL,
  SCHOOL_SOURCE_PREFIX, isForeignRow,
} from './lib/nyOsc.mjs';
import {
  NY_SCHOOL_FUND_PREFIXES, SCHOOL_GOVERNMENTAL_TYPES,
} from './data/nyOscSchoolFundPrefixes.mjs';
import { NY_SCHOOL_ENTITIES } from './data/nyOscSchoolEntities.mjs';

const SOURCE_KEY = 'NY_OSC_SCHOOL';
const BASIS_VALUE = 'actual';
const DERIVATION = 'derived';
const SCOPES = ['general_fund', 'total_governmental'];
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];
const SCHOOL = { registry: NY_SCHOOL_FUND_PREFIXES, governmentalTypes: SCHOOL_GOVERNMENTAL_TYPES };

const { values } = parseArgs({
  options: {
    from: { type: 'string', default: '1995' },
    to: { type: 'string', default: '2025' },
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

const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', SOURCE_KEY);
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);
const idByCode = new Map(keyRows.map((k) => [k.source_entity_key, k.municipality_id]));

const unseeded = [...new Set(NY_SCHOOL_ENTITIES.map((e) => e.municipalCode))]
  .filter((c) => !idByCode.has(c));
if (unseeded.length) {
  console.error(`REFUSING: ${unseeded.length} districts are not seeded. `
    + 'Run `npm run ny:seed-schools` first.');
  process.exit(1);
}

/**
 * ⚠ A paged read needs a TOTAL ORDER and a SERVER-SIDE filter, and PostgREST
 * caps a response at 1,000 rows regardless of `.limit()`. The guard is that
 * DISTINCT ids equal the row count.
 */
async function existingForYear(fy) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .schema('treasury')
      .from('budgets')
      .select('id,municipality_id,dataset_type,fund_scope,data_source')
      .eq('fiscal_year', fy)
      .eq('basis', BASIS_VALUE)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`existing-row read failed (FY${fy}): ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  if (new Set(out.map((r) => r.id)).size !== out.length) {
    throw new Error(`FY${fy}: paged read returned duplicate ids — page order is not total`);
  }
  return new Map(out.map((r) =>
    [`${r.municipality_id}|${r.dataset_type}|${r.fund_scope}`, r.data_source]));
}

let written = 0;
let categories = 0;
let skippedMissing = 0;
let unknownScope = 0;
let conflicts = 0;
const unknownDetail = new Map();

for (let fy = FROM; fy <= TO; fy++) {
  const rows = readYear(SCHOOL_ARCHIVE_PATH, fy, 'SchoolDistrict');
  const existing = DRY ? new Map() : await existingForYear(fy);

  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
    byCode.get(r.municipalCode).push(r);
  }

  let wroteThisYear = 0;

  for (const [code, districtRows] of byCode) {
    const municipalityId = idByCode.get(code);
    if (!municipalityId) { skippedMissing++; continue; }

    // ⚠ Read per entity per year. Districts are uniformly month 7, but the
    // value is MEASURED — a district that is not 7 is a finding, not a default.
    const fysm = districtRows[0].fiscalYearStartMonth;

    for (const { datasetType, section } of DATASETS) {
      for (const scope of SCOPES) {
        const agg = aggregateCityYear(districtRows, { section, scope, ...SCHOOL });

        if (agg.scope === 'unknown') {
          unknownScope++;
          const k = agg.unknownPrefixes.join(',');
          unknownDetail.set(k, (unknownDetail.get(k) ?? 0) + 1);
          continue;
        }
        if (agg.tree.length === 0) continue;

        const priorKey = `${municipalityId}|${datasetType}|${scope}`;
        if (isForeignRow(existing, priorKey, SCHOOL_SOURCE_PREFIX)) {
          conflicts++;
          // ⚠ A preserved row may carry NULL/'' — say so rather than printing
          // `null`, because "unknown provenance" is the reason it was kept.
          const prior = existing.get(priorKey) || '(no data_source)';
          console.log(`  SKIP ${code} FY${fy} ${datasetType} ${scope} — "${prior}" preserved`);
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
          p_data_source_name: schoolSourceNameFor(datasetType, fy, scope),
          p_source_url: SOURCE_URL,
          p_source_date: new Date().toISOString().slice(0, 10),
          p_fiscal_year_start_month: fysm,
          p_fund_scope: scope,   // ⚠ part of the RPC's key
          p_basis: BASIS_VALUE,  // ⚠ part of the RPC's key
          p_derivation: DERIVATION,
        });

        const where = `${code} FY${fy} ${datasetType} ${scope}`;
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
console.log(`  ${skippedMissing} district-years with no seeded entity`);
console.log(`  ${unknownScope} scopes left unknown (unclassifiable fund prefix)`);
for (const [k, n] of unknownDetail) console.log(`      [${k}] ${n} cells`);
console.log(`  ${conflicts} skipped by the never-overwrite guard`);

if (written === 0) { console.error('REFUSING: no rows were actually written.'); process.exit(1); }

if (!DRY) {
  console.log('\nNow run:  npm run ny:verify-schools');
  console.log('     then npm run verify:frozen   (expect it RED until rows are registered)');
  console.log('     then npm run check:forks');
  console.log('⚠ RE-MEASURE EXPECTED_ROWS and EXPECTED_BASIS_ROWS — do NOT paste a prediction.');
}
