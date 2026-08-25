#!/usr/bin/env node
/**
 * LA County Operating Expenditures Loader
 *
 * Fetches LA County government expenditures from the CA State Controller
 * county expenditures dataset (uctr-c2j8) and loads into Supabase.
 * Fixes broken FY2021 ($39.7M) and FY2022 ($124M) entries which were
 * partial loads from the ArcGIS Open Expenditures service.
 *
 * Usage:
 *   node scripts/loadLACountyOperating.js --fy 2021 --fy 2022
 *   node scripts/loadLACountyOperating.js --fy 2021 --fy 2022 --fy 2023 --fy 2024
 *   node scripts/loadLACountyOperating.js --fy 2021 --dry-run
 *
 * Env vars:
 *   SUPABASE_URL         Supabase project URL
 *   SUPABASE_SERVICE_KEY Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { monthForSource } from './lib/loaderFiscalCalendars.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SOCRATA_BASE = 'https://bythenumbers.sco.ca.gov';
const DATASET_ID   = 'uctr-c2j8';   // CA State Controller — County Expenditures
const PAGE_SIZE    = 5000;

// ── Fetch ───────────────────────────────────────────────────────────────────

async function fetchAllForYear(year) {
  const where = `entity_name='Los Angeles' AND fiscal_year=${year}`;
  const params = new URLSearchParams({
    $where: where,
    $limit: String(PAGE_SIZE),
    $offset: '0',
    $order: 'category,subcategory_1,subcategory_2',
  });
  const url = `${SOCRATA_BASE}/resource/${DATASET_ID}.json?${params}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  console.log(`  ${rows.length} rows fetched for FY${year}`);
  return rows;
}

// ── Tree builder ────────────────────────────────────────────────────────────

function parseAmt(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

function buildTree(rows) {
  // Hierarchy: category → subcategory_1 → line items (subcategory_2)
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

// ── Supabase sync ───────────────────────────────────────────────────────────

async function syncYear(municipalityId, year, rows, dryRun) {
  const { jsonTree, total, kept, skipped } = buildTree(rows);

  const catCount = jsonTree.length;
  const subCount = jsonTree.reduce((s, c) => s + c.c.length, 0);
  console.log(`  ${catCount} categories, ${subCount} subcategories`);
  console.log(`  ${kept} line items kept, ${skipped} zero rows skipped`);
  console.log(`  Total expenditures: $${Math.round(total).toLocaleString()}`);

  if (dryRun) {
    console.log('  (dry run — skipping Supabase write)');
    console.log('  Top categories:');
    for (const c of jsonTree.slice(0, 5)) {
      console.log(`    ${c.n}: $${Math.round(c.a).toLocaleString()} (${c.c.length} subcategories)`);
    }
    return;
  }

  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id:  municipalityId,
    p_fiscal_year:      year,
    p_dataset_type:     'operating',
    p_total:            total,
    p_tree:             jsonTree,
    p_row_count:        rows.length,
    p_data_source_name: 'CA State Controller - County Expenditures',
    // Cal. Gov. Code § 29001 (County Budget Act): the budget year is July 1
    // through June 30. Month 7 — evidenced, no longer a coincidence of the
    // RPC's hardcode.
    p_fiscal_year_start_month: monthForSource('CA State Controller - County Expenditures'),
  });

  if (error) { console.error(`  RPC error: ${error.message}`); return; }
  console.log(`  Synced (${data?.rows_inserted ?? '?'} rows reported)`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      fy:        { type: 'string', short: 'y', multiple: true },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  const fiscalYears = values.fy ? values.fy.map(Number) : [2022, 2021];
  const dryRun      = values['dry-run'] ?? false;

  console.log('\nLA County Operating Expenditures Loader (CA State Controller — County dataset)');
  console.log(`  Fiscal years: ${fiscalYears.join(', ')}`);
  console.log(`  Dry run     : ${dryRun}\n`);

  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: 'Los Angeles County', p_state: 'CA',
    p_entity_type: 'county', p_population: 10014009,
  });
  if (munErr) { console.error('Municipality error:', munErr.message); process.exit(1); }
  console.log(`Municipality ID: ${municipalityId}\n`);

  for (const fy of fiscalYears) {
    console.log(`FY${fy}`);
    const rows = await fetchAllForYear(fy);
    if (rows.length === 0) { console.log('  No data\n'); continue; }
    await syncYear(municipalityId, fy, rows, dryRun);
    console.log('');
  }

  console.log('Done.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
