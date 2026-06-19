#!/usr/bin/env node
/**
 * Utah Transparency Loader (v2.5 Phase 68 — UTSRC-02)
 *
 * Loads operating (EX) and revenue (RV) budgets for a single Utah entity from the
 * Utah State Auditor's "Transparent Utah" public BigQuery dataset and imports them
 * into Supabase. Mirrors scripts/bulkLoadStateController.js (the proven CA SCO
 * loader) almost exactly — the ONLY difference is the data-fetch layer: a
 * parameterized BigQuery query replaces the Socrata HTTP fetch. Everything else
 * (tree shape, treasury_sync_city_budget RPC, durable source attribution, the
 * never-overwrite guard, once-per-run source_date) is identical.
 *
 * Source: ut-sao-transparency-prod.transaction.transaction (CC BY 4.0).
 *   Columns: entity_name, entity_id, amount, fiscal_year, fund1-4, org1-10,
 *            cat1-7, program1-7, function1-7, type ('EX'|'RV'|'PY'), govt_lvl.
 *   type EX→operating, RV→revenue (PY→salaries deferred to Phase 71).
 *   Access is by-request from the State Auditor (see docs/utah-bigquery-access.md);
 *   queries run at $0 inside BigQuery's 1 TB/month free tier (column projection +
 *   entity/FY/type filters keep scanned bytes tiny).
 *
 * Tree shape (D-05/D-06): function/purpose-first, consistent with the Federal
 * function lens and the CA SCO category→subcategory→line tree. Top level =
 * --source-column (default function1; fallback cat1/org1 once 68-03 inspects the
 * live data); 2nd = cat1; items = org1. Compact JSON {n,a,c} parents / {n,a,i}
 * items — same as the analog. No reflexive deep icicle (ground rule 3).
 *
 * Phase-68 status: BUILD ONLY. The live BigQuery query + pilot dry-run happen in
 * Phase 68 plan 68-03 (gated on the access grant). The pure logic below is
 * unit-tested offline in scripts/loadUtahTransparency.test.mjs.
 *
 * Usage (once access is granted — 68-03):
 *   node scripts/loadUtahTransparency.js --entity "PROVO CITY" --fy 2022 --dry-run
 *   node scripts/loadUtahTransparency.js --entity "PROVO CITY" --fy 2022 --fy 2023
 *   node scripts/loadUtahTransparency.js --entity "PROVO CITY" --fy 2022 --source-column cat1
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Constants ───────────────────────────────────────────────────────────────
const BQ_TABLE = 'ut-sao-transparency-prod.transaction.transaction';
const BQ_PROJECT = process.env.GCP_PROJECT_ID || 'empowered-vote-486302';
/** The data_source label this loader writes (the collision key for never-overwrite). */
export const DATA_SOURCE_NAME = 'Transparent Utah';
/**
 * Per-entity source_url. The live table has NO entity_id column (confirmed 68-03,
 * 2026-06-19) — transparent.utah.gov keys its SPA by an internal id we cannot derive
 * from the dataset, so we link to the durable public portal page (never the BigQuery
 * table / an API endpoint). The portal's own entity picker reaches each entity's
 * revenue+expense overview. Refining to a per-entity deep link is a future nicety.
 */
const SOURCE_URL_BASE = 'https://transparent.utah.gov';
export function entitySourceUrl() {
  return SOURCE_URL_BASE;
}

// ── Pure helpers (exported for offline unit tests) ───────────────────────────

/** Parse "$1,234" / "(123)" / numbers → Number. Mirrors the analog's amt(). */
export function amt(v) {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

/** BigQuery `type` code → Treasury Tracker dataset_type. PY deferred to Phase 71. */
export function typeToDataset(type) {
  switch (type) {
    case 'EX': return 'operating';
    case 'RV': return 'revenue';
    case 'PY': return 'salaries';
    default: return null;
  }
}

/**
 * Never-overwrite decision (D, carry-forward). Returns 'skip' when an existing
 * (muni, fy, dataset) row was loaded from a DIFFERENT source than this run
 * (preserve it — never overwrite a richer custom-source load); 'refresh' when the
 * existing row is our own source (or unlabeled), i.e. safe to re-sync.
 */
export function neverOverwriteDecision(existingDataSource, runSourceName = DATA_SOURCE_NAME) {
  if (existingDataSource && existingDataSource !== runSourceName) return 'skip';
  return 'refresh';
}

/**
 * Build a function/purpose-first compact JSON tree from BigQuery rows.
 *   top  = row[topCol]  (default function1 — "what it's for")
 *   sub  = row[subCol]  (default cat1)
 *   item = row[itemCol] (default org1 — the line)
 * Shape: [{ n, a, c: [{ n, a, i: [{ d, a, aa }] }] }], children sorted desc,
 * zero-amount rows skipped, totals summed bottom-up (negatives/offsets retained).
 * Returns { tree, total }.
 */
export function buildTree(rows, opts = {}) {
  const topCol = opts.topCol || 'function1';
  const subCol = opts.subCol || 'cat1';
  const itemCol = opts.itemCol || 'org1';

  const grouped = new Map();
  for (const row of rows) {
    const a = amt(row.amount);
    if (a === 0) continue; // skip zero-value rows (negatives/offsets retained)
    const top = row[topCol] || 'Unknown';
    const sub = row[subCol] || 'General';
    if (!grouped.has(top)) grouped.set(top, new Map());
    const topNode = grouped.get(top);
    if (!topNode.has(sub)) topNode.set(sub, []);
    topNode.get(sub).push({ d: row[itemCol] || sub, a, aa: a });
  }

  let total = 0;
  const tree = [];
  for (const [topName, subs] of grouped) {
    let topTotal = 0;
    const children = [];
    for (const [subName, items] of subs) {
      const subTotal = items.reduce((s, i) => s + i.a, 0);
      topTotal += subTotal;
      children.push({ n: subName, a: subTotal, i: items });
    }
    children.sort((x, y) => y.a - x.a);
    total += topTotal;
    tree.push({ n: topName, a: topTotal, c: children });
  }
  tree.sort((x, y) => y.a - x.a);
  return { tree, total };
}

// ── BigQuery fetch (lazy import: module loads with no @google-cloud/bigquery / no ADC) ──

let _bq;
async function fetchFromBigQuery(entityName, fiscalYear, type, sourceColumn) {
  const { BigQuery } = await import('@google-cloud/bigquery');
  if (!_bq) _bq = new BigQuery({ projectId: BQ_PROJECT });
  // Transparent Utah is TRANSACTION-LEVEL (unlike CA's pre-aggregated Socrata feed),
  // so we AGGREGATE in SQL — SUM(amount) GROUP BY (top, sub) — to return a summarized
  // tree (one row per category pair) instead of millions of raw transactions.
  // top = --source-column (default org1, the populated dept/purpose column; function1
  // is ~70% NULL for cities, confirmed 68-03); sub = cat1 (expense object), or org1
  // when the caller picks cat1 as the top. fiscal_year is INT64 → pass a Number.
  const topCol = sourceColumn;
  const subCol = sourceColumn === 'cat1' ? 'org1' : 'cat1';
  const query =
    `SELECT COALESCE(${topCol}, 'Unknown') AS topcol, COALESCE(${subCol}, 'General') AS subcol, ` +
    `SUM(amount) AS amount ` +
    `FROM \`${BQ_TABLE}\` ` +
    `WHERE entity_name = @entity AND fiscal_year = @fy AND type = @type ` +
    `GROUP BY topcol, subcol`;
  const [rows] = await _bq.query({
    query,
    params: { entity: entityName, fy: Number(fiscalYear), type },
  });
  // Normalize aliased columns back to the buildTree contract (top→function1 key,
  // sub→cat1 key; itemCol 'org1' is absent so buildTree uses the sub label as leaf).
  return rows.map((r) => ({
    function1: r.topcol,
    cat1: r.subcol,
    amount: r.amount,
    fiscal_year: fiscalYear,
    type,
  }));
}

// ── DB helpers (mirror the analog; exercised live only in 68-03) ─────────────

/** Read-only: find an existing Utah municipality by name + state (null if new). */
async function findEntityMunicipality(name, state = 'UT') {
  const { data, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, population, population_year, county_id, entity_type')
    .eq('state', state)
    .eq('name', name)
    .limit(1);
  if (error) throw new Error(`Municipality lookup failed for ${name}: ${error.message}`);
  return (data && data[0]) || null;
}

/** Read-only: existing budget row for (muni, fy, dataset) IF from a different source. */
async function findConflictingBudget(municipalityId, fiscalYear, datasetType, sourceName) {
  const { data, error } = await supabase
    .schema('treasury')
    .from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType)
    .limit(1);
  if (error) throw new Error(`Budget lookup failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  return neverOverwriteDecision(existing.data_source, sourceName) === 'skip' ? existing : null;
}

async function importEntityData(municipalityName, state, rows, fiscalYear, datasetType, sourceColumn, fetchDate) {
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: municipalityName, p_state: state, p_entity_type: 'city', p_population: 0,
  });
  if (munErr) { console.error(`    Municipality error: ${munErr.message}`); return null; }

  const { tree, total } = buildTree(rows, { topCol: 'function1', subCol: 'cat1', itemCol: 'org1' });

  const { data: result, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year: fiscalYear,
    p_dataset_type: datasetType,
    p_total: total,
    p_tree: tree,
    p_row_count: rows.length,
    p_data_source_name: DATA_SOURCE_NAME,
    p_source_url: entitySourceUrl(),
    p_source_date: fetchDate,
  });
  if (error) { console.error(`    RPC error: ${error.message}`); return null; }
  return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      entity: { type: 'string' },
      fy: { type: 'string', short: 'y', multiple: true },
      type: { type: 'string', short: 't' },
      'source-date': { type: 'string' },
      'source-column': { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  const entityName = values.entity;
  if (!entityName) { console.error('--entity "<exact BQ entity_name>" is required'); process.exit(1); }
  const state = 'UT';
  const fiscalYears = values.fy ? values.fy.map(Number) : [2022];
  const bqTypes = values.type ? [values.type] : ['EX', 'RV'];
  const sourceColumn = values['source-column'] || 'org1';
  const dryRun = values['dry-run'] ?? false;
  const fetchDate = values['source-date'] || new Date().toISOString().slice(0, 10);

  console.log(`\n🏔️  Utah Transparency Loader (Transparent Utah / BigQuery)`);
  console.log(`   Entity: ${entityName}`);
  console.log(`   Fiscal Years: ${fiscalYears.join(', ')}`);
  console.log(`   Types: ${bqTypes.join(', ')} (${bqTypes.map(typeToDataset).join(', ')})`);
  console.log(`   Source column: ${sourceColumn}`);
  console.log(`   Source date: ${fetchDate}${values['source-date'] ? '' : ' (today)'}\n`);

  for (const type of bqTypes) {
    const datasetType = typeToDataset(type);
    if (!datasetType) { console.error(`Unknown type: ${type}`); continue; }
    if (type === 'PY') { console.warn('  PY (salaries) is out of scope for this loader (Phase 71) — skipping'); continue; }

    for (const fy of fiscalYears) {
      console.log(`\n📊 ${type}→${datasetType} FY ${fy} — ${entityName}`);
      const rows = await fetchFromBigQuery(entityName, fy, type, sourceColumn);
      if (!rows.length) { console.log('  No data found'); continue; }
      const { tree, total } = buildTree(rows, { topCol: 'function1', subCol: 'cat1', itemCol: 'org1' });
      console.log(`  ${rows.length.toLocaleString()} rows → ${tree.length} top-level categories, total $${total.toLocaleString()}`);

      if (dryRun) {
        console.log('  (dry run — no writes)');
        for (const node of tree.slice(0, 12)) {
          console.log(`    ${node.n}: $${node.a.toLocaleString()} (${node.c.length} subcats)`);
        }
        continue;
      }

      const existing = await findEntityMunicipality(entityName, state);
      if (existing) {
        const conflict = await findConflictingBudget(existing.id, fy, datasetType, DATA_SOURCE_NAME);
        if (conflict) {
          console.log(`  SKIP — existing ${conflict.data_source} data preserved (never-overwrite)`);
          continue;
        }
      }
      const result = await importEntityData(entityName, state, rows, fy, datasetType, sourceColumn, fetchDate);
      if (result) console.log(`  ✅ imported (${result.rows_inserted ?? '?'} items)`);
    }
  }

  console.log('\n🎉 Utah import complete!\n');
}

// Only run main() when invoked directly — importing for tests must not execute it.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
