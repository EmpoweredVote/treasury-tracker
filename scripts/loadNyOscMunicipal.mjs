#!/usr/bin/env node
/**
 * Load New York's towns, villages or counties from OSC's archives.
 *
 *   npm run ny:load-municipal -- --class County --from 1995 --to 2025
 *   npm run ny:load-municipal -- --class Town --from 2015 --to 2016   # chunked
 *
 * Spec: docs/superpowers/specs/2026-10-19-ny-towns-villages-counties-design.md
 *
 * ⚠⚠ `treasury_sync_city_budget` KEYS ON fund_scope + basis, NOT data_source.
 * Two scopes per entity-year-dataset, so omitting either parameter DUPLICATES
 * on a re-run.
 *
 * ⚠⚠ RUN IN THE FOREGROUND, IN ONE- OR TWO-YEAR CHUNKS. Measured on the
 * districts load: a fresh process per year is ~2x faster than one process
 * spanning the series (accumulation, not the database), and the long run gets
 * MEMORY-KILLED. A foreground command is not a background shell, so the memory
 * reaper does not target it. Re-running any year — even a partially written
 * one — refreshes it in place.
 *
 * ⚠ The never-overwrite guard is BATCHED: one read per fiscal year, not one
 * per row. At ~185,000 writes a per-row SELECT would be ~370,000 extra round
 * trips. A guard that only appears when it is needed is not a guard.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

import {
  readYear, aggregateCityYear, archiveFor, isFullFiscalPeriod,
  municipalSourceNameFor, MUNICIPAL_SOURCE_PREFIXES, MUNICIPAL_CLASSES,
  MUNICIPAL_FIRST_YEAR, MUNICIPAL_LAST_YEAR, SOURCE_URL, isForeignRow,
} from './lib/nyOsc.mjs';
import {
  NY_MUNICIPAL_FUND_PREFIXES, MUNICIPAL_GOVERNMENTAL_TYPES,
} from './data/nyOscMunicipalFundPrefixes.mjs';
import { NY_MUNICIPAL_ENTITIES } from './data/nyOscMunicipalEntities.mjs';

const BASIS_VALUE = 'actual';
const DERIVATION = 'derived';
const SCOPES = ['general_fund', 'total_governmental'];
const DATASETS = [
  { datasetType: 'operating', section: 'EXPENDITURE' },
  { datasetType: 'revenue', section: 'REVENUE' },
];
const REGISTRY = {
  registry: NY_MUNICIPAL_FUND_PREFIXES,
  governmentalTypes: MUNICIPAL_GOVERNMENTAL_TYPES,
};

const { values } = parseArgs({
  options: {
    class: { type: 'string' },
    from: { type: 'string', default: String(MUNICIPAL_FIRST_YEAR) },
    to: { type: 'string', default: String(MUNICIPAL_LAST_YEAR) },
    'dry-run': { type: 'boolean', default: false },
  },
});

const memberClass = values.class;
if (!MUNICIPAL_CLASSES.includes(memberClass)) {
  throw new Error(`--class must be one of ${MUNICIPAL_CLASSES.join(', ')}, got `
    + `${JSON.stringify(memberClass)}`);
}
const archive = archiveFor(memberClass);
const FROM = Number(values.from);
const TO = Number(values.to);
const DRY = values['dry-run'];

// ⚠ The window is validated here, not just by readYear. FY2026 is refused for
// every class (spec §3.1) and readYear would happily read it — the archive
// extent and the load window are different facts.
if (!Number.isInteger(FROM) || !Number.isInteger(TO) || FROM > TO
    || FROM < MUNICIPAL_FIRST_YEAR || TO > MUNICIPAL_LAST_YEAR) {
  throw new Error(`--from/--to must be integers inside FY${MUNICIPAL_FIRST_YEAR}-`
    + `FY${MUNICIPAL_LAST_YEAR}, got ${values.from}..${values.to}`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const roster = NY_MUNICIPAL_ENTITIES.filter((e) => e.memberClass === memberClass);

const { data: keyRows, error: keyErr } = await db
  .schema('treasury')
  .from('municipality_source_keys')
  .select('municipality_id,source_entity_key')
  .eq('source', archive.sourceKey);
if (keyErr) throw new Error(`source-key lookup failed: ${keyErr.message}`);
const idByCode = new Map(keyRows.map((k) => [k.source_entity_key, k.municipality_id]));

const unseeded = roster.map((e) => e.municipalCode).filter((c) => !idByCode.has(c));
if (unseeded.length) {
  console.error(`REFUSING: ${unseeded.length} ${memberClass} governments are not seeded. `
    + `Run \`npm run ny:seed-municipal -- --class ${memberClass}\` first.`);
  process.exit(1);
}

/**
 * ⚠ A paged read needs a TOTAL ORDER and a SERVER-SIDE filter, and PostgREST
 * caps a response at 1,000 rows regardless of `.limit()`. The guard is that
 * DISTINCT ids equal the row count. Broken five times in this repo.
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
let emptyTree = 0;
let conflicts = 0;
const unknownDetail = new Map();
const refusedPeriods = [];
const monthsSeen = new Map();

for (let fy = FROM; fy <= TO; fy++) {
  const rows = readYear(archive.path, fy, memberClass);
  const existing = DRY ? new Map() : await existingForYear(fy);

  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.municipalCode)) byCode.set(r.municipalCode, []);
    byCode.get(r.municipalCode).push(r);
  }

  let wroteThisYear = 0;

  for (const [code, entityRows] of byCode) {
    const municipalityId = idByCode.get(code);
    if (!municipalityId) { skippedMissing++; continue; }

    // ⚠⚠⚠ REFUSE AN ENTITY-YEAR THAT IS NOT ONE FULL TWELVE-MONTH FILING, AND
    // PASS EVERY ROW, NEVER THE FIRST. Three villages file a full year AND a
    // seven-month stub under the SAME CALENDAR_YEAR; the first row is the full
    // year, so a first-row check passes and the loop below then sums both into
    // one total — nineteen months published as a year, tying against itself.
    const period = isFullFiscalPeriod(entityRows);
    if (!period.ok) {
      refusedPeriods.push(
        `${entityRows[0].entityName} FY${fy}: ${period.why} `
        + `[${period.periods.map((p, i) => `${p} (${period.days[i]}d)`).join(' | ')}]`);
      continue;
    }

    // ⚠ Read per entity per year, never carried between entities — the FYSM
    // `NOT NULL DEFAULT 1` defect lied on ~18,700 rows. Towns and counties are
    // uniformly month 1 and villages are not; the value is MEASURED either way
    // and the distribution is reported below rather than asserted here.
    const fysm = entityRows[0].fiscalYearStartMonth;
    monthsSeen.set(fysm, (monthsSeen.get(fysm) ?? 0) + 1);

    for (const { datasetType, section } of DATASETS) {
      for (const scope of SCOPES) {
        const agg = aggregateCityYear(entityRows, { section, scope, ...REGISTRY });

        if (agg.scope === 'unknown') {
          unknownScope++;
          const k = agg.unknownPrefixes.join(',');
          unknownDetail.set(k, (unknownDetail.get(k) ?? 0) + 1);
          continue;
        }
        if (agg.tree.length === 0) { emptyTree++; continue; }

        const priorKey = `${municipalityId}|${datasetType}|${scope}`;
        if (isForeignRow(existing, priorKey, MUNICIPAL_SOURCE_PREFIXES[memberClass])) {
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
          p_data_source_name: municipalSourceNameFor(memberClass, datasetType, fy, scope),
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
  + ` for ${memberClass} FY${FROM}-FY${TO} over ${categories.toLocaleString()} categories.`);
console.log(`  ${skippedMissing} entity-years with no seeded entity`);
console.log(`  ${unknownScope} scopes left unknown (unclassifiable fund prefix)`);
for (const [k, n] of [...unknownDetail].sort()) console.log(`      [${k}] ${n} cells`);
console.log(`  ${emptyTree} cells with an empty tree (the section has no non-zero row)`);
console.log(`  ${conflicts} skipped by the never-overwrite guard`);
console.log(`  ${refusedPeriods.length} entity-years refused as non-annual filings`);
for (const p of refusedPeriods) console.log(`      ${p}`);
console.log(`  fiscal year start months: `
  + [...monthsSeen].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${m}×${n}`).join(' '));

if (written === 0) { console.error('REFUSING: no rows were actually written.'); process.exit(1); }

if (!DRY) {
  console.log(`\nNow run:  npm run ny:verify-municipal -- --class ${memberClass}`);
  console.log('     then npm run verify:frozen   (expect it RED until rows are registered)');
  console.log('     then npm run check:forks');
  console.log('⚠ RE-MEASURE EXPECTED_ROWS and EXPECTED_BASIS_ROWS — do NOT paste a prediction.');
}
