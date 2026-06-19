#!/usr/bin/env node
/**
 * Utah Transparency Loader (v2.5 Phases 68–69 — UTSRC-02 / UCITY-01/02)
 *
 * Loads operating (EX) and revenue (RV) budgets for a single Utah entity from the
 * Utah State Auditor's "Transparent Utah" public BigQuery dataset and imports them
 * into Supabase. Mirrors scripts/bulkLoadStateController.js (the proven CA SCO
 * loader) almost exactly — the ONLY difference is the data-fetch layer: a
 * parameterized BigQuery query replaces the Socrata HTTP fetch. Everything else
 * (treasury_sync_city_budget RPC, durable source attribution, the never-overwrite
 * guard, once-per-run source_date) is identical.
 *
 * Source: ut-sao-transparency-prod.transaction.transaction (CC BY 4.0).
 *   Columns: entity_name, amount, fiscal_year, fund1-4, org1-10, cat1-7,
 *            program1-7, function1-7, type ('EX'|'RV'|'PY'), govt_lvl.
 *   type EX→operating, RV→revenue (PY→salaries deferred to Phase 71).
 *   Access is by-request from the State Auditor (see docs/utah-bigquery-access.md);
 *   queries run at $0 inside BigQuery's 1 TB/month free tier (column projection +
 *   entity/FY/type filters keep scanned bytes tiny).
 *
 * Tree shape (D-69-01): three levels — top = fund1 (the fund: General Fund, Power,
 * Water, Airport, Debt Service…), 2nd = org1 (department), items = cat1 (expense
 * object). fund1 is legible, citizen-meaningful, and naturally separates enterprise
 * utilities from the governmental General Fund. function1 is ~70% NULL for cities
 * (confirmed 68-03) so it is NOT used. Compact JSON {n,a,c} parents / {n,a,i} items —
 * same as the analog. ≤3 levels (ground rule 3).
 *
 * Usage:
 *   node scripts/loadUtahTransparency.js --entity "Salt Lake City" --fy 2025 --dry-run
 *   node scripts/loadUtahTransparency.js --entity "Salt Lake City" --fy 2024 --fy 2025
 *   node scripts/loadUtahTransparency.js --entity "Provo City" --fy 2024 --type EX
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
/** The fund-based tree shape (D-69-01): top=fund1, sub=org1, item=cat1. */
const TREE_OPTS = { topCol: 'fund1', subCol: 'org1', itemCol: 'cat1' };
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

/**
 * Utah's Transparent Utah entity_name carries a legal "City" suffix on every
 * municipality (Provo City, Orem City, Ogden City…). Only Salt Lake City and
 * West Valley City use "City" in their common/display name; the other 8 display
 * without it. We query BigQuery by the raw entity_name (the source key) but
 * store/look up the municipality row under its DISPLAY name, so the app shows
 * "Provo", not "Provo City" (Phase 70 — matches the entity-mapping doc's intent).
 * Counties + anything not in the map pass through unchanged.
 */
const UT_DISPLAY_NAME = {
  'Layton City': 'Layton',
  'Lehi City': 'Lehi',
  'Ogden City': 'Ogden',
  'Orem City': 'Orem',
  'Provo City': 'Provo',
  'Sandy City': 'Sandy',
  'St. George City': 'St. George',
  'West Jordan City': 'West Jordan',
  // Salt Lake City and West Valley City intentionally keep their names.
};
export function toDisplayName(entityName) {
  return UT_DISPLAY_NAME[entityName] || entityName;
}

// ── Salary query (exported for PII-exclusion unit test — D-71-01) ─────────────

/**
 * The names-free PY aggregate query. Projects ONLY org1, cat1, SUM(amount) —
 * no PII column (vendor_name, dba_name, vendor_code, title, hourly_rate, gender,
 * account_number, contract_name, contract_number, description, ref_id) is ever
 * projected, grouped, or referenced. All-funds (no fund1 filter). Parameterized
 * @entity / @fy / @type (D-71-01, D-71-03).
 */
export const SALARY_QUERY =
  `SELECT COALESCE(org1,'General') AS org1, COALESCE(cat1,'General') AS cat1, SUM(amount) AS amount ` +
  `FROM \`${BQ_TABLE}\` ` +
  `WHERE entity_name = @entity AND fiscal_year = @fy AND type = @type ` +
  `GROUP BY org1, cat1`;

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
 * Build a fund-first compact JSON tree from BigQuery rows (D-69-01).
 *   top  = row[topCol]  (default fund1 — the fund)
 *   sub  = row[subCol]  (default org1  — the department)
 *   item = row[itemCol] (default cat1  — the expense object)
 * Shape: [{ n, a, c: [{ n, a, i: [{ d, a, aa }] }] }], children sorted desc,
 * zero-amount rows skipped, totals summed bottom-up (negatives/offsets retained).
 * topCol/subCol/itemCol stay configurable so the same builder serves other lenses.
 * Returns { tree, total }.
 */
export function buildTree(rows, opts = {}) {
  const topCol = opts.topCol || 'fund1';
  const subCol = opts.subCol || 'org1';
  const itemCol = opts.itemCol || 'cat1';

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

/**
 * Build a 2-level Department→Wages/Benefits salary tree from PY BigQuery rows (D-71-02).
 *   top  = row.org1 (full department string — NOT split on " - ")
 *   leaf = row.cat1 (Wages / Benefits)
 * Shape: [{ n: dept, a: deptTotal, c: [{ n: cat, a: catTotal }, ...] }]
 * Children sorted desc, zero-amount rows skipped, totals summed bottom-up.
 * NO `i` array, NO `m` metadata (aggregate only — D-71-01 names-free guarantee).
 * Returns { tree, total }.
 */
export function buildSalaryTree(rows) {
  const depts = new Map(); // dept → Map<cat, total>

  for (const row of rows) {
    const a = amt(row.amount);
    if (a === 0) continue; // skip zero-value rows (negatives/offsets retained)
    const dept = row.org1 || 'General';
    const cat = row.cat1 || 'General';
    if (!depts.has(dept)) depts.set(dept, new Map());
    const catMap = depts.get(dept);
    catMap.set(cat, (catMap.get(cat) || 0) + a);
  }

  let total = 0;
  const tree = [];
  for (const [deptName, catMap] of depts) {
    let deptTotal = 0;
    const children = [];
    for (const [catName, catTotal] of catMap) {
      deptTotal += catTotal;
      children.push({ n: catName, a: catTotal });
    }
    children.sort((x, y) => y.a - x.a);
    total += deptTotal;
    tree.push({ n: deptName, a: deptTotal, c: children });
  }
  tree.sort((x, y) => y.a - x.a);
  return { tree, total };
}

// ── BigQuery fetch (lazy import: module loads with no @google-cloud/bigquery / no ADC) ──

let _bq;
async function fetchFromBigQuery(entityName, fiscalYear, type) {
  const { BigQuery } = await import('@google-cloud/bigquery');
  if (!_bq) _bq = new BigQuery({ projectId: BQ_PROJECT });

  if (type === 'PY') {
    // PY (salaries) — names-free aggregate (D-71-01). Projects ONLY org1, cat1, SUM(amount);
    // no fund1, no PII column. All-funds basis (no fund1 filter, D-71-03).
    const [rows] = await _bq.query({
      query: SALARY_QUERY,
      params: { entity: entityName, fy: Number(fiscalYear), type: 'PY' },
    });
    return rows.map((r) => ({
      org1: r.org1,
      cat1: r.cat1,
      amount: r.amount,
      fiscal_year: fiscalYear,
      type,
    }));
  }

  // EX / RV — fund-first 3-level tree (D-69-01). Transparent Utah is TRANSACTION-LEVEL
  // (unlike CA's pre-aggregated Socrata feed), so we AGGREGATE in SQL —
  // SUM(amount) GROUP BY (fund1, org1, cat1) — to return a summarized 3-level tree
  // (one row per fund/dept/object triple) instead of millions of raw transactions.
  // fund1 = fund (General Fund, Power, Water, Airport, Debt Service…),
  // org1 = department, cat1 = expense object (D-69-01). function1 is ~70% NULL for
  // cities (confirmed 68-03) so it is NOT used. fiscal_year is INT64 → Number.
  const query =
    `SELECT COALESCE(fund1, 'Unknown') AS fund1, COALESCE(org1, 'General') AS org1, ` +
    `COALESCE(cat1, 'General') AS cat1, SUM(amount) AS amount ` +
    `FROM \`${BQ_TABLE}\` ` +
    `WHERE entity_name = @entity AND fiscal_year = @fy AND type = @type ` +
    `GROUP BY fund1, org1, cat1`;
  const [rows] = await _bq.query({
    query,
    params: { entity: entityName, fy: Number(fiscalYear), type },
  });
  return rows.map((r) => ({
    fund1: r.fund1,
    org1: r.org1,
    cat1: r.cat1,
    amount: r.amount,
    fiscal_year: fiscalYear,
    type,
  }));
}

// ── DB helpers (mirror the analog) ───────────────────────────────────────────

/** Read-only: find an existing Utah municipality by name + state + entity_type (null if new). */
async function findEntityMunicipality(name, state = 'UT', entityType = 'city') {
  const { data, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, population, population_year, county_id, entity_type')
    .eq('state', state)
    .eq('name', name)
    .eq('entity_type', entityType)
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

async function importEntityData(municipalityName, state, rows, fiscalYear, datasetType, fetchDate, entityType = 'city') {
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: municipalityName, p_state: state, p_entity_type: entityType, p_population: 0,
  });
  if (munErr) { console.error(`    Municipality error: ${munErr.message}`); return null; }

  // Branch on dataset type: salaries → 2-level buildSalaryTree (D-71-02); EX/RV → 3-level buildTree (D-69-01).
  const { tree, total } = datasetType === 'salaries' ? buildSalaryTree(rows) : buildTree(rows, TREE_OPTS);

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
      'entity-type': { type: 'string' },
      fy: { type: 'string', short: 'y', multiple: true },
      type: { type: 'string', short: 't' },
      'source-date': { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  const entityName = values.entity;
  if (!entityName) { console.error('--entity "<exact BQ entity_name>" is required'); process.exit(1); }
  const entityType = (values['entity-type'] || 'city').toLowerCase();
  if (entityType !== 'city' && entityType !== 'county') {
    console.error(`--entity-type must be 'city' or 'county' (got '${entityType}')`); process.exit(1);
  }
  const state = 'UT';
  const fiscalYears = values.fy ? values.fy.map(Number) : [2022];
  const bqTypes = values.type ? [values.type] : ['EX', 'RV'];
  const dryRun = values['dry-run'] ?? false;
  const fetchDate = values['source-date'] || new Date().toISOString().slice(0, 10);

  const isPY = bqTypes.length === 1 && bqTypes[0] === 'PY';
  console.log(`\n🏔️  Utah Transparency Loader (Transparent Utah / BigQuery)`);
  console.log(`   Entity: ${entityName} (type: ${entityType})`);
  console.log(`   Fiscal Years: ${fiscalYears.join(', ')}`);
  console.log(`   Types: ${bqTypes.join(', ')} (${bqTypes.map(typeToDataset).join(', ')})`);
  if (isPY) {
    console.log(`   Tree: org1 → cat1 (Wages/Benefits, all-funds)`);
  } else {
    console.log(`   Tree: fund1 → org1 → cat1 (all-funds)`);
  }
  console.log(`   Source date: ${fetchDate}${values['source-date'] ? '' : ' (today)'}\n`);

  for (const type of bqTypes) {
    const datasetType = typeToDataset(type);
    if (!datasetType) { console.error(`Unknown type: ${type}`); continue; }
    // PY (salaries) is now fully supported — no skip.

    for (const fy of fiscalYears) {
      console.log(`\n📊 ${type}→${datasetType} FY ${fy} — ${entityName}`);
      const rows = await fetchFromBigQuery(entityName, fy, type);
      if (!rows.length) { console.log('  No data found'); continue; }
      const { tree, total } = datasetType === 'salaries' ? buildSalaryTree(rows) : buildTree(rows, TREE_OPTS);
      if (datasetType === 'salaries') {
        console.log(`  ${rows.length.toLocaleString()} rows → ${tree.length} departments, total $${total.toLocaleString()}`);
      } else {
        console.log(`  ${rows.length.toLocaleString()} rows → ${tree.length} funds, total $${total.toLocaleString()}`);
      }

      if (dryRun) {
        console.log('  (dry run — no writes)');
        for (const node of tree.slice(0, 12)) {
          const childLabel = datasetType === 'salaries' ? 'categories' : 'depts';
          console.log(`    ${node.n}: $${node.a.toLocaleString()} (${node.c.length} ${childLabel})`);
        }
        continue;
      }

      const muniName = toDisplayName(entityName);
      const existing = await findEntityMunicipality(muniName, state, entityType);
      if (existing) {
        const conflict = await findConflictingBudget(existing.id, fy, datasetType, DATA_SOURCE_NAME);
        if (conflict) {
          console.log(`  SKIP — existing ${conflict.data_source} data preserved (never-overwrite)`);
          continue;
        }
      }
      const result = await importEntityData(muniName, state, rows, fy, datasetType, fetchDate, entityType);
      if (result) console.log(`  ✅ imported (${result.rows_inserted ?? '?'} items)`);
    }
  }

  console.log('\n🎉 Utah import complete!\n');
}

// Only run main() when invoked directly — importing for tests must not execute it.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
