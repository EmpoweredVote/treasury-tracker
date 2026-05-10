#!/usr/bin/env node
/**
 * LA County Employee Salaries Loader
 *
 * Fetches position-level payroll data from the LA County ArcGIS FeatureServer
 * and loads into Supabase as a Department → Position → Employee tree.
 * Replaces the previous flat-department-only import.
 *
 * Usage:
 *   node scripts/loadLACountySalaries.js --fy 2024
 *   node scripts/loadLACountySalaries.js --fy 2024 --fy 2023 --fy 2022 --fy 2021
 *   node scripts/loadLACountySalaries.js --fy 2024 --dry-run
 *   node scripts/loadLACountySalaries.js --fy 2024 --no-names
 *
 * Env vars:
 *   SUPABASE_URL         Supabase project URL
 *   SUPABASE_SERVICE_KEY Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ARCGIS_BASE = 'https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/LA_County_Employee_Salaries/FeatureServer/0';
const PAGE_SIZE = 2000;

// ── ArcGIS fetch helpers ────────────────────────────────────────────────────

async function fetchCount(year) {
  const url = `${ARCGIS_BASE}/query?f=json&where=${encodeURIComponent(`Year='${year}'`)}&returnCountOnly=true`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ArcGIS count ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);
  return data.count;
}

async function fetchPage(year, offset) {
  const params = new URLSearchParams({
    f: 'json',
    where: `Year='${year}'`,
    outFields: [
      'Department', 'Position_Title',
      'Base_Earnings', 'Overtime_Earnings', 'Other_Earnings',
      'Total_Earnings', 'Total_Benefits', 'Total_Compensation',
      'Employee_Last_Name', 'Employee_First_Name',
    ].join(','),
    resultRecordCount: String(PAGE_SIZE),
    resultOffset: String(offset),
    orderByFields: 'Department,Position_Title',
  });
  const url = `${ARCGIS_BASE}/query?${params}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ArcGIS fetch ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);
  return (data.features || []).map(f => f.attributes);
}

async function fetchAllForYear(year) {
  const total = await fetchCount(year);
  console.log(`  ${total.toLocaleString()} records for FY${year}`);
  if (total === 0) return [];

  const all = [];
  let offset = 0;
  while (offset < total) {
    const page = await fetchPage(year, offset);
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    process.stdout.write(`\r  Fetched ${all.length.toLocaleString()} / ${total.toLocaleString()}...`);
    if (page.length < PAGE_SIZE) break;
  }
  console.log(`\r  Fetched ${all.length.toLocaleString()} records total`);
  return all;
}

// ── Tree builder ────────────────────────────────────────────────────────────

function buildTree(rows, includeNames) {
  // Group by Department → Position_Title
  const depts = new Map();

  for (const r of rows) {
    const dept = (r.Department || 'UNKNOWN').trim();
    const pos  = (r.Position_Title || 'Unknown Position').trim();
    const comp = parseFloat(r.Total_Compensation) || 0;
    const base = parseFloat(r.Base_Earnings) || 0;
    const ot   = parseFloat(r.Overtime_Earnings) || 0;
    const oth  = parseFloat(r.Other_Earnings) || 0;
    const ben  = parseFloat(r.Total_Benefits) || 0;

    // Skip zero-comp records
    if (comp === 0) continue;

    if (!depts.has(dept)) depts.set(dept, new Map());
    const posMap = depts.get(dept);

    if (!posMap.has(pos)) posMap.set(pos, { total: 0, employees: [] });
    const posEntry = posMap.get(pos);

    posEntry.total += comp;

    if (includeNames) {
      const last  = (r.Employee_Last_Name || '').trim();
      const first = (r.Employee_First_Name || '').trim();
      const name  = last && first ? `${last}, ${first}` : last || first || 'Employee';
      posEntry.employees.push({ name, comp, base, ot, oth, ben });
    } else {
      posEntry.employees.push({ comp }); // count only
    }
  }

  // Convert to compact JSON tree (n/a/c/i format)
  let grandTotal = 0;
  const tree = [];

  for (const [deptName, posMap] of depts) {
    let deptTotal = 0;
    const children = [];

    for (const [posName, posEntry] of posMap) {
      const count = posEntry.employees.length;
      deptTotal += posEntry.total;

      const items = includeNames
        ? posEntry.employees
            .sort((a, b) => b.comp - a.comp)
            .map(e => ({
              d: e.name,
              a: e.comp,
              aa: e.comp,
              f: null,
              e: null,
            }))
        : [];

      const child = {
        n: `${posName} (${count})`,
        a: posEntry.total,
      };
      if (items.length > 0) child.i = items;

      children.push(child);
    }

    children.sort((a, b) => b.a - a.a);
    grandTotal += deptTotal;
    tree.push({ n: deptName, a: deptTotal, c: children });
  }

  tree.sort((a, b) => b.a - a.a);
  return { tree, total: grandTotal };
}

// ── Supabase sync ───────────────────────────────────────────────────────────

async function syncYear(municipalityId, year, rows, includeNames, dryRun) {
  console.log(`\n  Building tree (includeNames=${includeNames})...`);
  const { tree, total } = buildTree(rows, includeNames);

  const deptCount = tree.length;
  const posCount  = tree.reduce((s, d) => s + d.c.length, 0);
  const empCount  = rows.length;

  console.log(`  ${deptCount} departments, ${posCount} positions, ${empCount.toLocaleString()} employee records`);
  console.log(`  Total compensation: $${Math.round(total).toLocaleString()}`);

  if (dryRun) {
    console.log('  (dry run — skipping Supabase write)');
    console.log('  Top 5 departments:');
    for (const d of tree.slice(0, 5)) {
      console.log(`    ${d.n}: $${Math.round(d.a).toLocaleString()} (${d.c.length} positions)`);
    }
    return;
  }

  console.log('  Syncing to Supabase...');
  const { data, error } = await supabase.rpc('treasury_sync_city_budget', {
    p_municipality_id: municipalityId,
    p_fiscal_year: year,
    p_dataset_type: 'salaries',
    p_total: total,
    p_tree: tree,
    p_row_count: rows.length,
    p_data_source_name: 'LA County Open Data - Employee Salaries',
  });

  if (error) {
    console.error(`  RPC error: ${error.message}`);
    return;
  }

  console.log(`  Inserted ${data?.rows_inserted ?? '?'} rows`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      fy:        { type: 'string', short: 'y', multiple: true },
      'dry-run': { type: 'boolean' },
      'no-names':{ type: 'boolean' },
    },
    strict: false,
  });

  const fiscalYears  = values.fy ? values.fy.map(Number) : [2024];
  const dryRun       = values['dry-run'] ?? false;
  const includeNames = !(values['no-names'] ?? false);

  console.log('\nLA County Employee Salaries Loader');
  console.log(`  Fiscal years : ${fiscalYears.join(', ')}`);
  console.log(`  Include names: ${includeNames}`);
  console.log(`  Dry run      : ${dryRun}\n`);

  // Resolve municipality ID for LA County
  const { data: municipalityId, error: munErr } = await supabase.rpc('treasury_ensure_municipality', {
    p_name: 'Los Angeles County',
    p_state: 'CA',
    p_entity_type: 'county',
    p_population: 10014009,
  });
  if (munErr) { console.error('Municipality lookup failed:', munErr.message); process.exit(1); }
  console.log(`Municipality ID: ${municipalityId}`);

  for (const fy of fiscalYears) {
    console.log(`\nFY${fy}`);
    const rows = await fetchAllForYear(String(fy));
    if (rows.length === 0) {
      console.log('  No data — skipping');
      continue;
    }
    await syncYear(municipalityId, fy, rows, includeNames, dryRun);
  }

  console.log('\nDone.\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
