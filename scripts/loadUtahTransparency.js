/**
 * Utah Transparency Loader (v2.5 Phases 68–71.1 — UTSRC-02 / UCITY-01/02 / UETL-01)
 *
 * Loads operating (EX), revenue (RV), and salaries (PY) budgets for Utah entities
 * from the Utah State Auditor's "Transparent Utah" public BigQuery dataset and imports
 * them into Supabase.
 *
 * TWO modes:
 *
 * 1. Per-entity mode (original, --entity required):
 *    Loads a single entity × one or more FYs × one or more types. The cost guardrail
 *    caps each query at 2 GiB (intentionally blocks raw-table scans after the
 *    2026-06-19 cost incident — 622 queries, ~21 TiB, ~$132 in one day). Use only for
 *    one-off probes or single-FY refreshes with LOADER_MAX_GIB set deliberately.
 *
 * 2. Rollup mode (--rollup, Phase 71.1 — UETL-01):
 *    ONE BigQuery scan pulls all 15 mapped entities × FY2014–2025 × EX/RV/PY in a
 *    single parameterized GROUP BY query (~47 GiB total, ~$0.29). Rows are grouped in
 *    memory and written via the existing importEntityData RPC. BigQuery becomes a
 *    periodic source refreshed manually — never queried live per entity.
 *    --rollup (no --confirm) → free dry-run only: prints estimated GiB + $ + quota-fit
 *    --rollup --confirm      → real scan (cap ~64 GiB) + idempotent upsert to Supabase
 *
 * Source: ut-sao-transparency-prod.transaction.transaction (CC BY 4.0).
 *   Columns: entity_name, amount, fiscal_year, fund1-4, org1-10, cat1-7,
 *            program1-7, function1-7, type ('EX'|'RV'|'PY'), govt_lvl.
 *   Access is by-request from the State Auditor (see docs/utah-bigquery-access.md);
 *   queries run at $0 inside BigQuery's 1 TB/month free tier.
 *
 * Tree shape (D-69-01): three levels — top = fund1, 2nd = org1, items = cat1.
 * PY tree (D-71-02): two levels — top = org1 (dept), leaves = cat1 (Wages/Benefits).
 *
 * Usage:
 *   node scripts/loadUtahTransparency.js --entity "Salt Lake City" --fy 2025 --dry-run
 *   node scripts/loadUtahTransparency.js --entity "Salt Lake City" --fy 2024 --fy 2025
 *   node scripts/loadUtahTransparency.js --entity "Provo City" --fy 2024 --type EX
 *   node scripts/loadUtahTransparency.js --rollup                (free dry-run preview)
 *   node scripts/loadUtahTransparency.js --rollup --confirm      (real scan + Supabase write)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { utahMonthFor } from './lib/loaderFiscalCalendars.mjs';
import { fileURLToPath } from 'node:url';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
// ⚠ Do NOT hard-exit at import time. This module is imported by its unit tests,
// which run in CI with no Supabase key — a top-level process.exit(1) takes the
// whole vitest worker down with "process.exit unexpectedly called with 1". The
// CLI entry point at the bottom enforces the key instead, so running the loader
// for real still fails fast and loud.
const supabase = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ── Constants ───────────────────────────────────────────────────────────────
const BQ_TABLE = 'ut-sao-transparency-prod.transaction.transaction';
const BQ_PROJECT = process.env.GCP_PROJECT_ID || 'empowered-vote-486302';
// ── BigQuery cost guardrail (added after the 2026-06-19 full-table-scan incident) ──
// The source table is NOT partitioned/clustered, so every query scans the FULL ~35–47 GiB
// of the referenced columns regardless of the WHERE filter. Per-(entity,FY,type) live
// querying ran up ~21 TiB / ~$132 in one day. The 2 GiB default intentionally blocks the
// raw-table scans; set LOADER_MAX_GIB (e.g. 64) only for a deliberate one-off.
// The --rollup path uses ROLLUP_MAX_BYTES_BILLED (~64 GiB) for its one intentional scan.
const MAX_BILLED_GIB = Number(process.env.LOADER_MAX_GIB) || 2;
const MAX_BYTES_BILLED = String(MAX_BILLED_GIB * 2 ** 30);
// ── Rollup ETL cap (Phase 71.1 — UETL-01) ─────────────────────────────────
// The single rollup scan covers ~47 GiB; the cap is set to ~64 GiB to allow headroom.
// Decoupled from LOADER_MAX_GIB (CR-01): the runbook tells operators to set
// LOADER_MAX_GIB for a deliberate per-entity one-off, and that override must NOT
// silently raise the rollup ceiling too. Override the rollup cap only via the
// dedicated ROLLUP_LOADER_MAX_GIB env var.
const ROLLUP_MAX_GIB = Number(process.env.ROLLUP_LOADER_MAX_GIB) || 64;
const ROLLUP_MAX_BYTES_BILLED = String(ROLLUP_MAX_GIB * 2 ** 30);
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

// ── Rollup ETL (Phase 71.1 — UETL-01) ────────────────────────────────────────

/**
 * The 15 exact entity_name values from docs/utah-entity-mapping.md.
 * Match EXACTLY (never LIKE) — decoys exist (North/South Ogden City, Washington
 * Terrace City, Davis School District, George Washington Academy, etc.).
 * Exported so tests and main() share one source of truth.
 *
 * govt_lvl mapping (for treasury_ensure_municipality entity_type param):
 *   Cities  → 'city'   (Layton City, Lehi City, Ogden City, Orem City, Provo City,
 *                        Salt Lake City, Sandy City, St. George City,
 *                        West Jordan City, West Valley City)
 *   Counties → 'county' (Salt Lake County, Utah County, Davis County,
 *                         Weber County, Washington County)
 */
export const ROLLUP_ENTITY_MAP = [
  // Cities (govt_lvl='City')
  { entityName: 'Layton City',        entityType: 'city' },
  { entityName: 'Lehi City',          entityType: 'city' },
  { entityName: 'Ogden City',         entityType: 'city' },
  { entityName: 'Orem City',          entityType: 'city' },
  { entityName: 'Provo City',         entityType: 'city' },
  { entityName: 'Salt Lake City',     entityType: 'city' },
  { entityName: 'Sandy City',         entityType: 'city' },
  { entityName: 'St. George City',    entityType: 'city' },
  { entityName: 'West Jordan City',   entityType: 'city' },
  { entityName: 'West Valley City',   entityType: 'city' },
  // Counties (govt_lvl='County')
  { entityName: 'Salt Lake County',   entityType: 'county' },
  { entityName: 'Utah County',        entityType: 'county' },
  { entityName: 'Davis County',       entityType: 'county' },
  { entityName: 'Weber County',       entityType: 'county' },
  { entityName: 'Washington County',  entityType: 'county' },
];

/**
 * The single rollup GROUP BY query (Phase 71.1 — UETL-01).
 *
 * ONE scan covers all 15 mapped entities × FY2014–2025 × EX/RV/PY.
 * The source table is unpartitioned, so the WHERE does NOT prune bytes scanned
 * (~47 GiB either way) — this is COST-NEUTRAL but keeps the in-memory result set
 * small (only our entities' aggregated rows, not every Utah entity).
 *
 * Projects ONLY the 6 non-PII columns + SUM(amount):
 *   entity_name, fiscal_year, type, fund1, org1, cat1.
 * No PII column (vendor_name, dba_name, vendor_code, title, hourly_rate, gender,
 * account_number, contract_name, contract_number, description, ref_id) is ever
 * projected. Parameterized via @entities (UNNEST) — never string-interpolated.
 *
 * Exported for offline PII-exclusion test (D-71-01).
 */
export const ROLLUP_QUERY =
  `SELECT entity_name, fiscal_year, type, ` +
  `COALESCE(fund1,'Unknown') AS fund1, COALESCE(org1,'General') AS org1, ` +
  `COALESCE(cat1,'General') AS cat1, SUM(amount) AS amount ` +
  `FROM \`${BQ_TABLE}\` ` +
  `WHERE entity_name IN UNNEST(@entities) ` +
  `AND fiscal_year BETWEEN 2014 AND 2025 ` +
  `AND type IN ('EX','RV','PY') ` +
  `GROUP BY entity_name, fiscal_year, type, fund1, org1, cat1`;

/**
 * Group a flat array of rollup rows by (entity_name, fiscal_year, type) and
 * build the correct tree for each group (D-71.1 grouping spec).
 *
 * PY groups: drop fund1, re-sum by (org1, cat1), then buildSalaryTree → 2-level
 *   {n,a,c:[{n,a}]} (D-71-02). fund1 is not meaningful for salaries (all-funds).
 * EX/RV groups: buildTree(rows, TREE_OPTS) → 3-level fund1→org1→cat1 (D-69-01).
 *
 * FY2026+ rows and non-mapped entities are filtered out defensively (the query
 * WHERE should exclude them, but we guard again in memory).
 *
 * @param {Array<{entity_name:string, fiscal_year:number, type:string, fund1:string,
 *                org1:string, cat1:string, amount:number}>} rows
 * @returns {Array<{entityName:string, fiscalYear:number, type:string,
 *                  datasetType:string, tree:Array, total:number,
 *                  entityType:string}>}
 */
export function groupRollupRows(rows) {
  // Build a lookup set of the 15 exact mapped entity names
  const mappedEntityTypes = new Map(ROLLUP_ENTITY_MAP.map((e) => [e.entityName, e.entityType]));

  // First pass: group rows by (entity_name, fiscal_year, type)
  const groups = new Map();
  for (const row of rows) {
    // Defensive exclusions (query WHERE should already handle these)
    if (!mappedEntityTypes.has(row.entity_name)) continue;
    if (Number(row.fiscal_year) > 2025) continue;

    const key = `${row.entity_name}|${row.fiscal_year}|${row.type}`;
    if (!groups.has(key)) {
      groups.set(key, {
        entityName: row.entity_name,
        fiscalYear: Number(row.fiscal_year),
        type: row.type,
        rows: [],
      });
    }
    groups.get(key).rows.push(row);
  }

  // Second pass: build tree per group
  const result = [];
  for (const [, group] of groups) {
    const datasetType = typeToDataset(group.type);
    if (!datasetType) continue; // unknown type — skip

    let tree, total;
    if (group.type === 'PY') {
      // PY: drop fund1, re-sum by (org1, cat1) across all funds, then 2-level tree
      const collapsed = new Map(); // `${org1}|${cat1}` → running total
      for (const row of group.rows) {
        const a = amt(row.amount);
        if (a === 0) continue;
        const k = `${row.org1 || 'General'}|${row.cat1 || 'General'}`;
        collapsed.set(k, (collapsed.get(k) || 0) + a);
      }
      const collapsedRows = [];
      for (const [k, a] of collapsed) {
        const [org1, cat1] = k.split('|');
        collapsedRows.push({ org1, cat1, amount: a });
      }
      ({ tree, total } = buildSalaryTree(collapsedRows));
    } else {
      // EX / RV: 3-level fund1→org1→cat1 tree
      ({ tree, total } = buildTree(group.rows, TREE_OPTS));
    }

    result.push({
      entityName: group.entityName,
      fiscalYear: group.fiscalYear,
      type: group.type,
      datasetType,
      tree,
      total,
      entityType: mappedEntityTypes.get(group.entityName),
    });
  }

  return result;
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
/**
 * Lazily initialise the BigQuery client (avoids importing @google-cloud/bigquery
 * at module load time — keeps offline unit tests working without ADC).
 */
async function initBQ() {
  if (!_bq) {
    const { BigQuery } = await import('@google-cloud/bigquery');
    _bq = new BigQuery({ projectId: BQ_PROJECT });
  }
  return _bq;
}

/**
 * Run a BigQuery query with the cost guardrail applied (maximumBytesBilled). If the job
 * exceeds the cap, BigQuery fails it server-side WITHOUT scanning/billing — we translate
 * that into an actionable message pointing at the Phase 71.1 rollup ETL.
 * @param {object} opts - Query options (query, params, etc.)
 * @param {string} [maxBytesBilled] - Override the default per-entity 2 GiB cap.
 */
async function runGuardedQuery(opts, maxBytesBilled = MAX_BYTES_BILLED) {
  const bq = await initBQ();
  try {
    return await bq.query({ ...opts, maximumBytesBilled: maxBytesBilled });
  } catch (err) {
    if (/bytes billed|maximum bytes/i.test(err && err.message)) {
      const capGib = Number(maxBytesBilled) / 2 ** 30;
      throw new Error(
        `BigQuery cost guard tripped: this query would bill more than ${capGib.toFixed(0)} GiB. ` +
        `The Utah source table is unpartitioned, so per-entity live queries full-scan it ` +
        `(~35–47 GiB each) — disabled by default after the 2026-06-19 cost incident. Use the ` +
        `Phase 71.1 rollup ETL (--rollup --confirm), or set LOADER_MAX_GIB=<n> for a deliberate one-off. ` +
        `Original: ${err.message}`
      );
    }
    throw err;
  }
}

/**
 * Run the rollup query as a BigQuery dry-run (dryRun: true).
 * Dry-run jobs are FREE — they bill 0 bytes and are exempt from the
 * QueryUsagePerDay quota. Returns { bytes, gib, estimatedUSD, fitsUnderQuota }.
 *
 * The quota check is against 1 TiB/day (= 2**40 bytes), matching the GCP
 * project-level QueryUsagePerDay quota that intentionally caps bulk scans.
 */
async function rollupDryRun(entityNames) {
  const bq = await initBQ();
  const [job] = await bq.createQueryJob({
    query: ROLLUP_QUERY,
    params: { entities: entityNames },
    types: { entities: ['STRING'] },
    dryRun: true,
  });
  const bytes = Number(job.metadata.statistics.totalBytesProcessed);
  const gib = bytes / 2 ** 30;
  const estimatedUSD = (bytes / 2 ** 40) * 6.25;
  const fitsUnderQuota = bytes <= 2 ** 40; // 1 TiB/day quota
  return { bytes, gib, estimatedUSD, fitsUnderQuota };
}
async function fetchFromBigQuery(entityName, fiscalYear, type) {
  await initBQ();

  if (type === 'PY') {
    // PY (salaries) — names-free aggregate (D-71-01). Projects ONLY org1, cat1, SUM(amount);
    // no fund1, no PII column. All-funds basis (no fund1 filter, D-71-03).
    const [rows] = await runGuardedQuery({
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
  const [rows] = await runGuardedQuery({
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
    // ⚠ Utah splits by ENTITY TYPE inside this one source: counties run the
    // calendar year (Utah Code § 17-36-3.5) while municipalities run July–June
    // (§ 10-6-105). A constant here would be wrong for one of them.
    p_fiscal_year_start_month: utahMonthFor({ entity_type: entityType }),
  });
  if (error) { console.error(`    RPC error: ${error.message}`); return null; }
  return result;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      // Per-entity mode options
      entity:         { type: 'string' },
      'entity-type':  { type: 'string' },
      fy:             { type: 'string', short: 'y', multiple: true },
      type:           { type: 'string', short: 't' },
      'dry-run':      { type: 'boolean' },
      // Rollup mode options (Phase 71.1 — UETL-01)
      rollup:         { type: 'boolean' },
      confirm:        { type: 'boolean' },
      // Shared
      'source-date':  { type: 'string' },
    },
    strict: false,
  });

  const isRollup = values.rollup ?? false;
  const fetchDate = values['source-date'] || new Date().toISOString().slice(0, 10);
  const state = 'UT';

  // ── ROLLUP MODE (Phase 71.1 — UETL-01) ─────────────────────────────────────
  if (isRollup) {
    const isConfirm = values.confirm ?? false;
    const entityNames = ROLLUP_ENTITY_MAP.map((e) => e.entityName);

    console.log('\nUtah Transparency Loader — ROLLUP MODE (Phase 71.1 / UETL-01)');
    console.log(`  Entities: ${entityNames.length} mapped entities (FY2014-2025 x EX/RV/PY)`);
    console.log(`  Source date: ${fetchDate}${values['source-date'] ? '' : ' (today)'}`);
    console.log(`  Rollup cap: ${ROLLUP_MAX_GIB} GiB`);
    if (!isConfirm) {
      console.log('  Mode: DRY-RUN PREVIEW (no --confirm — no writes, no billing)');
    } else {
      console.log('  Mode: LIVE CONFIRM (will scan BigQuery and write to Supabase)');
    }
    console.log('');

    // Step 1: Always run the free dry-run first (bills 0 bytes, quota-exempt).
    console.log('Running BigQuery dry-run (free, bills 0 bytes)...');
    let dryRunResult;
    try {
      dryRunResult = await rollupDryRun(entityNames);
    } catch (err) {
      console.error(`Dry-run failed: ${err.message}`);
      if (/quota/i.test(err.message)) {
        console.error('Note: Dry-run jobs are normally quota-exempt. If this is a quota error,');
        console.error('the project quota may be more restrictive than expected.');
      }
      process.exit(1);
    }
    const { gib, estimatedUSD, fitsUnderQuota } = dryRunResult;
    console.log('');
    console.log('--- ROLLUP COST PREVIEW ---');
    console.log(`  Estimated bytes scanned: ${gib.toFixed(2)} GiB`);
    console.log(`  Estimated cost:          $${estimatedUSD.toFixed(4)} (at $6.25/TiB)`);
    console.log(`  1 TiB/day quota:         ${fitsUnderQuota ? 'FITS (under 1 TiB)' : 'EXCEEDS — quota reset required'}`);
    console.log(`  Rollup cap:              ${ROLLUP_MAX_GIB} GiB (${gib <= ROLLUP_MAX_GIB ? 'OK' : 'WOULD TRIP CAP'})`);
    console.log('---------------------------');
    console.log('');

    if (!isConfirm) {
      console.log('No --confirm flag — preview only. Zero writes performed.');
      console.log('');
      console.log('When the 1 TiB/day quota has reset (next calendar day UTC), run:');
      console.log('  node scripts/loadUtahTransparency.js --rollup --confirm');
      console.log('');
      return;
    }

    if (!fitsUnderQuota) {
      console.error('ERROR: The rollup scan exceeds the 1 TiB/day quota. Do NOT raise the quota.');
      console.error('Wait for the quota to reset (next calendar day UTC) and try again.');
      process.exit(1);
    }

    // WR-04: the 1 TiB/day quota ceiling is ~16x the rollup cap, so a scan that
    // "fits the quota" can still exceed the cap. Gate the billed scan on the cap
    // too — otherwise the real scan would be rejected by maximumBytesBilled after
    // --confirm. Abort here with a clear message instead of letting the job fail.
    if (gib > ROLLUP_MAX_GIB) {
      console.error(`ERROR: Estimated scan ${gib.toFixed(2)} GiB exceeds the rollup cap (${ROLLUP_MAX_GIB} GiB).`);
      console.error('Aborting before any billed scan. Investigate the scope; do NOT raise the cap to work around this.');
      process.exit(1);
    }

    // Step 2: Real scan via runGuardedQuery with the rollup cap.
    console.log('Running real BigQuery scan (ROLLUP_MAX_BYTES_BILLED = ' + ROLLUP_MAX_GIB + ' GiB)...');
    let allRows;
    try {
      const [rows] = await runGuardedQuery(
        {
          query: ROLLUP_QUERY,
          params: { entities: entityNames },
          types: { entities: ['STRING'] },
        },
        ROLLUP_MAX_BYTES_BILLED,
      );
      allRows = rows;
    } catch (err) {
      console.error(`BigQuery scan failed: ${err.message}`);
      process.exit(1);
    }
    console.log(`Scan complete. ${allRows.length.toLocaleString()} aggregate rows returned.`);
    console.log('');

    // Step 3: Group rows and build trees in memory.
    const groups = groupRollupRows(allRows);
    console.log(`Grouped into ${groups.length} (entity, FY, type) combinations.`);
    console.log('');

    // Step 4: Per-group import via importEntityData.
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    let coverageGaps = 0;

    for (const group of groups) {
      const displayName = toDisplayName(group.entityName);
      const label = `${displayName} FY${group.fiscalYear} ${group.type}→${group.datasetType}`;

      // Check for different-source conflict before writing
      const existing = await findEntityMunicipality(displayName, state, group.entityType);
      if (existing) {
        const conflict = await findConflictingBudget(existing.id, group.fiscalYear, group.datasetType, DATA_SOURCE_NAME);
        if (conflict) {
          console.log(`  SKIP ${label} — existing ${conflict.data_source} data preserved (never-overwrite)`);
          skipped++;
          continue;
        }
      }

      if (group.total === 0) {
        console.log(`  COVERAGE GAP ${label} — zero total (no rows after grouping)`);
        coverageGaps++;
        continue;
      }

      // Pass pre-built tree + total directly via a rollup-aware call to importEntityData.
      // importEntityData builds the tree internally, but for rollup we've already built it.
      // Use the RPC directly to pass our pre-built tree.
      const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
        p_name: displayName, p_state: state, p_entity_type: group.entityType, p_population: 0,
      });
      if (munErr) {
        console.error(`  ERROR ${label} — municipality: ${munErr.message}`);
        errors++;
        continue;
      }

      const { data: result, error: rpcErr } = await supabase.rpc('treasury_sync_city_budget', {
        p_municipality_id: municipalityId,
        p_fiscal_year: group.fiscalYear,
        p_dataset_type: group.datasetType,
        p_total: group.total,
        p_tree: group.tree,
        p_row_count: allRows.filter(
          (r) => r.entity_name === group.entityName &&
                 Number(r.fiscal_year) === group.fiscalYear &&
                 r.type === group.type
        ).length,
        p_data_source_name: DATA_SOURCE_NAME,
        p_source_url: entitySourceUrl(),
        p_source_date: fetchDate,
        // Same split as the other call site: county -> 1, municipality -> 7.
        p_fiscal_year_start_month: utahMonthFor({ entity_type: group.entityType }),
      });
      if (rpcErr) {
        console.error(`  ERROR ${label} — RPC: ${rpcErr.message}`);
        errors++;
        continue;
      }

      console.log(`  OK ${label} — total $${group.total.toLocaleString()} (${result?.rows_inserted ?? '?'} items)`);
      imported++;
    }

    console.log('');
    console.log('--- ROLLUP COMPLETE ---');
    console.log(`  Imported:      ${imported}`);
    console.log(`  Skipped:       ${skipped} (different-source rows preserved — never-overwrite)`);
    console.log(`  Coverage gaps: ${coverageGaps} (zero-total groups — prior rows left in place)`);
    console.log(`  Errors:        ${errors}`);
    console.log('----------------------');
    console.log('');
    console.log('Utah rollup import complete!');
    console.log('');
    return;
  }

  // ── PER-ENTITY MODE (original) ──────────────────────────────────────────────
  const entityName = values.entity;
  if (!entityName) {
    console.error('--entity "<exact BQ entity_name>" is required (or use --rollup for the bulk ETL)');
    process.exit(1);
  }
  const entityType = (values['entity-type'] || 'city').toLowerCase();
  if (entityType !== 'city' && entityType !== 'county') {
    console.error(`--entity-type must be 'city' or 'county' (got '${entityType}')`); process.exit(1);
  }
  const fiscalYears = values.fy ? values.fy.map(Number) : [2022];
  const bqTypes = values.type ? [values.type] : ['EX', 'RV'];
  const dryRun = values['dry-run'] ?? false;

  const isPY = bqTypes.length === 1 && bqTypes[0] === 'PY';
  console.log(`\nUtah Transparency Loader (Transparent Utah / BigQuery)`);
  console.log(`   Entity: ${entityName} (type: ${entityType})`);
  console.log(`   Fiscal Years: ${fiscalYears.join(', ')}`);
  console.log(`   Types: ${bqTypes.join(', ')} (${bqTypes.map(typeToDataset).join(', ')})`);
  if (isPY) {
    console.log(`   Tree: org1 -> cat1 (Wages/Benefits, all-funds)`);
  } else {
    console.log(`   Tree: fund1 -> org1 -> cat1 (all-funds)`);
  }
  console.log(`   Source date: ${fetchDate}${values['source-date'] ? '' : ' (today)'}\n`);

  for (const type of bqTypes) {
    const datasetType = typeToDataset(type);
    if (!datasetType) { console.error(`Unknown type: ${type}`); continue; }
    // PY (salaries) is now fully supported — no skip.

    for (const fy of fiscalYears) {
      console.log(`\n${type}->${datasetType} FY ${fy} -- ${entityName}`);
      const rows = await fetchFromBigQuery(entityName, fy, type);
      if (!rows.length) { console.log('  No data found'); continue; }
      const { tree, total } = datasetType === 'salaries' ? buildSalaryTree(rows) : buildTree(rows, TREE_OPTS);
      if (datasetType === 'salaries') {
        console.log(`  ${rows.length.toLocaleString()} rows -> ${tree.length} departments, total $${total.toLocaleString()}`);
      } else {
        console.log(`  ${rows.length.toLocaleString()} rows -> ${tree.length} funds, total $${total.toLocaleString()}`);
      }

      if (dryRun) {
        console.log('  (dry run -- no writes)');
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
          console.log(`  SKIP -- existing ${conflict.data_source} data preserved (never-overwrite)`);
          continue;
        }
      }
      const result = await importEntityData(muniName, state, rows, fy, datasetType, fetchDate, entityType);
      if (result) console.log(`  imported (${result.rows_inserted ?? '?'} items)`);
    }
  }

  console.log('\nUtah import complete!\n');
}

// Only run main() when invoked directly — importing for tests must not execute it.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain && !SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
if (isMain) main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
