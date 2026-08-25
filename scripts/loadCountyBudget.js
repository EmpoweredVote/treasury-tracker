#!/usr/bin/env node
/**
 * Reusable County-Government Budget Loader (Phase 57, D-07)
 *
 * Loads operating + revenue budget data for a single California county-government
 * entity from the CA State Controller ByTheNumbers county datasets (Socrata),
 * and writes to Supabase via treasury_sync_city_budget.
 *
 * This generalizes the LA-County-specific loadLACountyOperating.js /
 * loadLACountyRevenue.js into one parameterized script. It is the runbook
 * Step 5 tool for socal-county-onboarding.md — any future county's own
 * budget loads with one command instead of a new one-off clone.
 *
 * Key conventions (from docs/socal-county-onboarding.md "Locked conventions"):
 *   - Source = SCO ByTheNumbers *county* datasets (uctr-c2j8 / emxv-k8xv),
 *     filtered entity_name='<county>' (no "County" suffix, matches SCO field).
 *   - source_url = durable /d/<dataset-id> ByTheNumbers *page* URL (never /resource/*.json).
 *   - source_date = run fetch date, computed ONCE per run.
 *   - Target entity = EXISTING county municipality (entity_type='county', ilike name);
 *     ERROR if not found — never ensure-create with a population (would clobber).
 *   - Population: per-year from SCO feed if present; else --population sourced fallback;
 *     backfill-only (never lower a non-zero population to 0).
 *   - Never-overwrite: any existing budget row from a DIFFERENT data_source is SKIPPED
 *     and logged — never overwritten.
 *   - Basis: SCO county totals are all-governmental-funds (Phase 56 finding).
 *
 * Usage:
 *   node scripts/loadCountyBudget.js --county "Orange" --fy 2024
 *   node scripts/loadCountyBudget.js --county "Orange" --entity "Orange County" --fy 2024
 *   node scripts/loadCountyBudget.js --county "Orange" --fy 2024 --source-date 2026-06-15
 *   node scripts/loadCountyBudget.js --county "Orange" --fy 2024 --dry-run
 *   node scripts/loadCountyBudget.js --county "Orange" --fy 2003 --fy 2004 --source-date 2026-06-15
 *   node scripts/loadCountyBudget.js --county "Orange" --type operating --fy 2024
 *
 * Args:
 *   --county        SCO entity_name filter (e.g. "Orange") — no "County" suffix
 *   --entity        DB municipality name override (default: "<county> County")
 *   --fy            Fiscal year to load (repeatable, e.g. --fy 2023 --fy 2024)
 *   --type          operating | revenue (default: both)
 *   --population    Sourced integer fallback population (used when SCO feed lacks
 *                   estimated_population); e.g. 3170000 from CA DOF E-series
 *   --source-date   ISO date for source_date field (default: today)
 *   --dry-run       Print fetched data + decisions; perform zero writes
 *
 * Env vars:
 *   SUPABASE_URL         Supabase project URL
 *   SUPABASE_SERVICE_KEY Service-role key (also checked as SUPABASE_SERVICE_ROLE_KEY)
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { monthForSource } from './lib/loaderFiscalCalendars.mjs';

// ── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Dataset definitions ──────────────────────────────────────────────────────

/**
 * SCO ByTheNumbers *county* datasets.
 * Distinct from the city datasets (ju3w-4gxp / rrtv-rsj9).
 */
const DATASETS = {
  operating: {
    id:      'uctr-c2j8',
    label:   'CA State Controller - County Expenditures',
    pageUrl: 'https://bythenumbers.sco.ca.gov/d/uctr-c2j8',
    type:    'operating',
  },
  revenue: {
    id:      'emxv-k8xv',
    label:   'CA State Controller - County Revenues',
    pageUrl: 'https://bythenumbers.sco.ca.gov/d/emxv-k8xv',
    type:    'revenue',
  },
};

const SOCRATA_BASE = 'https://bythenumbers.sco.ca.gov';
const PAGE_SIZE    = 5000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a dollar-amount field from the SCO feed.
 * Reused verbatim from loadLACountyOperating.js / loadLACountyRevenue.js.
 */
function parseAmt(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

/**
 * Build the compact {n,a,c}/{d,a,aa,f,e} tree the app expects.
 * Hierarchy: category → subcategory_1 → line items (subcategory_2 / line_description).
 * Reused verbatim from loadLACountyOperating.js / loadLACountyRevenue.js.
 */
function buildTree(rows) {
  const tree = new Map();
  let kept = 0, skipped = 0;

  for (const row of rows) {
    const amount = parseAmt(row.values);
    if (amount === 0) { skipped++; continue; }

    const cat  = (row.category      || 'Other').trim();
    const sub1 = (row.subcategory_1  || 'General').trim();
    const desc = (row.subcategory_2  || row.line_description || sub1).trim();

    if (!tree.has(cat)) tree.set(cat, new Map());
    const catMap = tree.get(cat);
    if (!catMap.has(sub1)) catMap.set(sub1, []);
    catMap.get(sub1).push({ d: desc, a: amount, aa: amount, f: null, e: null });
    kept++;
  }

  let total = 0;
  const jsonTree = [];

  for (const [catName, sub1Map] of tree) {
    let catTotal = 0;
    const children = [];

    for (const [sub1Name, items] of sub1Map) {
      const sub1Total = items.reduce((s, i) => s + i.a, 0);
      if (sub1Total === 0) continue;
      catTotal += sub1Total;
      children.push({ n: sub1Name, a: sub1Total, i: items });
    }

    if (catTotal === 0) continue;
    children.sort((a, b) => b.a - a.a);
    total += catTotal;
    jsonTree.push({ n: catName, a: catTotal, c: children });
  }

  jsonTree.sort((a, b) => b.a - a.a);
  return { jsonTree, total, kept, skipped };
}

// ── SCO fetch ────────────────────────────────────────────────────────────────

async function fetchAllForYear(datasetId, countyFilter, year) {
  // Escape single quotes in the county name (Socrata SoQL convention).
  const safeCounty = String(countyFilter).replace(/'/g, "''");
  const where = `entity_name='${safeCounty}' AND fiscal_year=${year}`;
  const params = new URLSearchParams({
    $where:  where,
    $limit:  String(PAGE_SIZE),
    $offset: '0',
    $order:  'category,subcategory_1,subcategory_2',
  });
  const url = `${SOCRATA_BASE}/resource/${datasetId}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  console.log(`    ${rows.length} rows fetched for FY${year}`);
  return rows;
}

// ── Entity lookup (existing county only — never ensure-create with population) ──

/**
 * Look up the existing county municipality by name and state.
 * Pattern: seedCountyLinks.js:92-99
 *
 * Exits with code 1 if not found — the entity MUST already exist (Phase 54 seed).
 * Does NOT call treasury_ensure_municipality with a non-zero population, which
 * would clobber an existing population value.
 */
async function resolveCountyEntity(entityName, state) {
  const { data, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, population, population_year')
    .eq('state', state)
    .eq('entity_type', 'county')
    .ilike('name', entityName)
    .maybeSingle();

  if (error) {
    console.error(`ERROR: County entity lookup failed: ${error.message}`);
    process.exit(1);
  }
  if (!data) {
    console.error(`ERROR: County entity "${entityName}" (entity_type=county, state=${state}) not found.`);
    console.error('       The county entity must be seeded before running this loader (see seedCountyLinks.js).');
    process.exit(1);
  }
  return data; // { id, name, population, population_year }
}

// ── Never-overwrite collision check ─────────────────────────────────────────

/**
 * Read-only: return the existing budget row for (muni, fy, dataset_type) IF it was
 * loaded from a DIFFERENT source than this run (a collision to preserve).
 * Returns null when there is no budget, or the existing budget is from THIS
 * loader's own source (safe to refresh).
 *
 * Mirrors bulkLoadStateController.js:findConflictingBudget (lines 87-101).
 */
async function findConflictingBudget(municipalityId, fiscalYear, datasetType, sourceName) {
  const { data, error } = await supabase
    .schema('treasury')
    .from('budgets')
    .select('id, data_source')
    .eq('municipality_id', municipalityId)
    .eq('fiscal_year', fiscalYear)
    .eq('dataset_type', datasetType)
    .limit(1);

  if (error) throw new Error(`Budget collision check failed: ${error.message}`);
  const existing = data && data[0];
  if (!existing) return null;
  // Same source — safe to refresh (idempotent upsert).
  if (existing.data_source && existing.data_source !== sourceName) return existing;
  return null;
}

// ── Population backfill ──────────────────────────────────────────────────────

/**
 * Backfill population on the county entity ONLY where it is currently null/0
 * (never lower a non-zero population).
 *
 * Mirrors bulkLoadStateController.js:112-120.
 */
async function backfillPopulation(municipalityId, population, populationYear) {
  if (!population || population <= 0) return;
  const { error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .update({ population, population_year: populationYear })
    .eq('id', municipalityId)
    .or('population.is.null,population.eq.0');
  if (error) {
    console.warn(`  WARN: Population backfill failed: ${error.message}`);
  }
}

// ── Per-type sync ────────────────────────────────────────────────────────────

async function syncYear(opts) {
  const { municipalityId, year, rows, ds, fetchDate, dryRun } = opts;
  const { jsonTree, total, kept, skipped } = buildTree(rows);

  const catCount = jsonTree.length;
  const subCount = jsonTree.reduce((s, c) => s + c.c.length, 0);
  console.log(`    ${catCount} categories, ${subCount} subcategories`);
  console.log(`    ${kept} line items kept, ${skipped} zero rows skipped`);
  console.log(`    Total (${ds.type}): $${Math.round(total).toLocaleString()} (all-governmental-funds basis)`);

  if (dryRun) {
    console.log('    (dry run — skipping write)');
    console.log('    Top-5 categories:');
    for (const c of jsonTree.slice(0, 5)) {
      console.log(`      ${c.n}: $${Math.round(c.a).toLocaleString()} (${c.c.length} subcategories)`);
    }
    return { total, skipped: false };
  }

  // Never-overwrite pre-pass: skip if existing row is from a different source.
  const conflict = await findConflictingBudget(municipalityId, year, ds.type, ds.label);
  if (conflict) {
    console.log(`    SKIP: existing ${ds.type} FY${year} row from source "${conflict.data_source}" — not overwriting`);
    return { total, skipped: true };
  }

  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id:  municipalityId,
    p_fiscal_year:      year,
    p_dataset_type:     ds.type,
    p_total:            total,
    p_tree:             jsonTree,
    p_row_count:        rows.length,
    p_data_source_name: ds.label,
    p_source_url:       ds.pageUrl,
    p_source_date:      fetchDate,
    // CA counties only (entity_type='county', per this script's locked
    // conventions). Cal. Gov. Code § 29001, the County Budget Act, defines the
    // budget year as July 1 through June 30 — month 7, now evidenced rather than
    // inherited from the RPC's old hardcode.
    p_fiscal_year_start_month: monthForSource(ds.label),
  });

  if (error) {
    console.error(`    RPC error: ${error.message}`);
    return { total, skipped: false };
  }
  console.log(`    Synced (${data?.rows_inserted ?? '?'} rows reported) — source_url=${ds.pageUrl} source_date=${fetchDate}`);
  return { total, skipped: false };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      county:         { type: 'string',  short: 'c' },
      entity:         { type: 'string' },
      fy:             { type: 'string',  short: 'y', multiple: true },
      type:           { type: 'string',  short: 't' },
      population:     { type: 'string' },
      'source-date':  { type: 'string' },
      'dry-run':      { type: 'boolean' },
    },
    strict: false,
  });

  // ── Arg validation ─────────────────────────────────────────────────────────
  if (!values.county) {
    console.log('');
    console.log('Usage: node scripts/loadCountyBudget.js --county "<Name>" [--entity "<DB Name>"]');
    console.log('         [--fy <year>] [--type operating|revenue] [--population <n>]');
    console.log('         [--source-date <YYYY-MM-DD>] [--dry-run]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/loadCountyBudget.js --county "Orange" --fy 2024 --dry-run');
    console.log('  node scripts/loadCountyBudget.js --county "Orange" --fy 2024 --source-date 2026-06-15');
    console.log('  node scripts/loadCountyBudget.js --county "Orange" --fy 2003 --fy 2004 --source-date 2026-06-15');
    console.log('  node scripts/loadCountyBudget.js --county "Los Angeles" --fy 2024');
    console.log('');
    process.exit(0);
  }

  const county     = values.county;
  const entityName = values.entity || `${county} County`;
  const state      = 'CA';
  const fiscalYears = values.fy ? values.fy.map(Number) : [];
  const typeFilter  = values.type || null;   // null = both
  const popFallback = values.population ? parseInt(values.population, 10) : null;
  const dryRun      = values['dry-run'] ?? false;
  // Fetch date computed ONCE per run (never inside the loop), overridable via --source-date.
  const fetchDate   = values['source-date'] || new Date().toISOString().slice(0, 10);

  if (fiscalYears.length === 0) {
    console.error('ERROR: --fy is required (e.g. --fy 2024). Use --dry-run to inspect without writing.');
    process.exit(1);
  }

  // Which dataset types to run
  const dsKeys = typeFilter ? [typeFilter] : ['operating', 'revenue'];
  for (const k of dsKeys) {
    if (!DATASETS[k]) {
      console.error(`ERROR: Unknown --type "${k}". Must be "operating" or "revenue".`);
      process.exit(1);
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log('County-Government Budget Loader (reusable — Phase 57 D-07)');
  console.log('  Generalizes loadLACountyOperating.js / loadLACountyRevenue.js');
  console.log('  Basis: all-governmental-funds (SCO county datasets)');
  console.log('─'.repeat(60));
  console.log(`  County (SCO filter): entity_name='${county}'`);
  console.log(`  Entity (DB name):    ${entityName}`);
  console.log(`  State:               ${state}`);
  console.log(`  Fiscal years:        ${fiscalYears.join(', ')}`);
  console.log(`  Dataset types:       ${dsKeys.join(', ')}`);
  console.log(`  Source date:         ${fetchDate}${values['source-date'] ? '' : ' (today)'}`);
  if (popFallback) console.log(`  Population fallback: ${popFallback.toLocaleString()} (--population arg)`);
  if (dryRun) console.log('  [DRY RUN] Zero writes will be performed.');
  console.log('');

  // ── Resolve entity ─────────────────────────────────────────────────────────
  console.log(`Resolving county entity "${entityName}" ...`);
  const entity = await resolveCountyEntity(entityName, state);
  console.log(`  Found: id=${entity.id} name="${entity.name}" pop=${entity.population ?? 'NULL'}`);

  if (entity.population && entity.population > 0) {
    console.log(`  Population decision: entity already has pop=${entity.population} — backfill-only (never lower).`);
  } else {
    console.log('  Population decision: entity population is 0/NULL — will backfill from feed or --population arg.');
  }
  console.log('');

  const municipalityId = entity.id;

  // ── Per fiscal year × dataset type ────────────────────────────────────────
  const results = [];

  for (const fy of fiscalYears) {
    for (const dsKey of dsKeys) {
      const ds = DATASETS[dsKey];
      console.log(`FY${fy} — ${ds.type} (${ds.id})`);

      const rows = await fetchAllForYear(ds.id, county, fy);

      if (rows.length === 0) {
        console.log(`    No data found for FY${fy} ${ds.type} — skipping (no error)`);
        console.log('');
        continue;
      }

      // ── Population from feed (per-year, if present) ──────────────────────
      // The SCO county feed MAY carry estimated_population per row (like the
      // city feed). Capture the max per year as the per-year denominator.
      const feedPops = rows
        .map(r => parseInt(r.estimated_population, 10))
        .filter(n => Number.isFinite(n) && n > 0);
      const feedPop = feedPops.length > 0 ? Math.max(...feedPops) : null;

      if (feedPop) {
        console.log(`    Population (from feed): ${feedPop.toLocaleString()} for FY${fy}`);
        if (!dryRun) {
          await backfillPopulation(municipalityId, feedPop, fy);
        }
      } else if (popFallback) {
        console.log(`    Population (--population fallback): ${popFallback.toLocaleString()} — feed lacked estimated_population`);
        if (!dryRun) {
          await backfillPopulation(municipalityId, popFallback, fy);
        }
      } else {
        console.log('    WARN: No population source found (feed lacks estimated_population AND --population not supplied).');
        console.log('          Per-capita will be 0 until population is set. Re-run with --population <sourced-figure>.');
      }

      // ── Sync ─────────────────────────────────────────────────────────────
      const result = await syncYear({ municipalityId, year: fy, rows, ds, fetchDate, dryRun });
      results.push({ fy, type: ds.type, total: result.total, skipped: result.skipped });
      console.log('');
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('─'.repeat(60));
  console.log(`Done. ${results.length} year/type combos processed.`);
  if (results.length > 0) {
    for (const r of results) {
      const status = r.skipped ? 'SKIPPED (conflict)' : dryRun ? 'dry-run' : 'written';
      console.log(`  FY${r.fy} ${r.type}: $${Math.round(r.total).toLocaleString()} — ${status}`);
    }
  }
  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
