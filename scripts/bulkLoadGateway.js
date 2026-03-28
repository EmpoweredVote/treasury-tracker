#!/usr/bin/env node
/**
 * Indiana Gateway Bulk Loader for Treasury Tracker
 *
 * Downloads pipe-delimited financial data from Indiana Gateway and imports
 * into Supabase. One download contains ALL entities for the selected year,
 * so we filter locally for Monroe County entities.
 *
 * Available report types:
 *   - "Budget Data"                        → operating budgets
 *   - "Disbursements by Fund and Department" → expenditures (like checkbook)
 *   - "Disbursements by Fund"              → expenditures by fund only
 *   - "Detailed Receipts"                  → revenue
 *   - "Annual Financial Reports"           → comprehensive financial data
 *
 * Usage:
 *   node scripts/bulkLoadGateway.js --list                     # Show available report types
 *   node scripts/bulkLoadGateway.js --report "Budget Data" --year 2024
 *   node scripts/bulkLoadGateway.js --report "Detailed Receipts" --year 2024
 *   node scripts/bulkLoadGateway.js --report "Disbursements by Fund and Department" --year 2024
 *   node scripts/bulkLoadGateway.js --all --year 2024          # Download all report types
 *
 * Env vars:
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - Service role key
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GATEWAY_URL = 'https://gateway.ifionline.org/public/download.aspx';

// Monroe County entities we care about (filter from bulk download)
const MONROE_COUNTY_FILTERS = {
  // cnty_cd = 53 for Monroe County
  county_code: '53',
  // Map unit names to our municipality names in Supabase
  entity_map: {
    'BLOOMINGTON CITY': 'Bloomington',
    'BLOOMINGTON': 'Bloomington',
    'ELLETTSVILLE TOWN': 'Ellettsville',
    'ELLETTSVILLE': 'Ellettsville',
    'MONROE COUNTY': 'Monroe County',
    'MONROE': 'Monroe County',
    'BEAN BLOSSOM TOWNSHIP': 'Bean Blossom Township',
    'BEAN BLOSSOM': 'Bean Blossom Township',
    'BLOOMINGTON TOWNSHIP': 'Bloomington Township',
    'CLEAR CREEK TOWNSHIP': 'Clear Creek Township',
    'CLEAR CREEK': 'Clear Creek Township',
    'INDIAN CREEK TOWNSHIP': 'Indian Creek Township',
    'INDIAN CREEK': 'Indian Creek Township',
    'MONROE COUNTY COMMUNITY SCHOOL CORPORATION': 'Monroe County Community School Corp',
    'MONROE COUNTY COMMUNITY SCHOOL CORP': 'Monroe County Community School Corp',
    'MCCSC': 'Monroe County Community School Corp',
    'MONROE COUNTY PUBLIC LIBRARY': 'Monroe County Public Library',
  },
};

// RadComboBox1 = category, RadComboBox2 = specific report type within AFR
const REPORT_TYPES = [
  { name: 'Budget Data', combo1: 'Budget Data', combo2: null, datasetType: 'operating' },
  { name: 'Disbursements by Fund and Department', combo1: 'Annual Financial Reports', combo2: 'Disbursements by Fund and Department', datasetType: 'transactions' },
  { name: 'Disbursements by Fund', combo1: 'Annual Financial Reports', combo2: 'Disbursements by Fund', datasetType: 'transactions' },
  { name: 'Detailed Receipts', combo1: 'Annual Financial Reports', combo2: 'Detailed Receipts', datasetType: 'revenue' },
  { name: 'Capital Assets', combo1: 'Annual Financial Reports', combo2: 'Capital Assets', datasetType: 'operating' },
  { name: 'Cash and Investments', combo1: 'Annual Financial Reports', combo2: 'Cash and Investments', datasetType: 'operating' },
  { name: 'Debt', combo1: 'Annual Financial Reports', combo2: 'Debt', datasetType: 'operating' },
];

// ── ASP.NET ViewState dance ─────────────────────────────────────────────
function extractFormValue(html, fieldName) {
  const needle = `id="${fieldName}"`;
  const idx = html.indexOf(needle);
  if (idx === -1) return '';
  const rest = html.slice(idx);
  const valStart = rest.indexOf('value="');
  if (valStart === -1) return '';
  const afterVal = rest.slice(valStart + 7);
  const valEnd = afterVal.indexOf('"');
  if (valEnd === -1) return '';
  return afterVal.slice(0, valEnd);
}

async function downloadGatewayFile(combo1, combo2, year, unitType = 'All') {
  console.log(`\n📥 Downloading "${combo2 || combo1}" for ${year} (${unitType})...`);

  // Step 1: GET page to extract ViewState tokens
  const getResp = await fetch(GATEWAY_URL, {
    headers: { 'User-Agent': 'EmpoweredVote-Treasury/1.0' },
  });
  const pageHTML = await getResp.text();

  const viewState = extractFormValue(pageHTML, '__VIEWSTATE');
  const eventValidation = extractFormValue(pageHTML, '__EVENTVALIDATION');
  const viewStateGenerator = extractFormValue(pageHTML, '__VIEWSTATEGENERATOR');

  if (!viewState || !eventValidation) {
    throw new Error('Could not extract ASP.NET ViewState tokens');
  }

  // Step 2: POST with form fields
  const formData = new URLSearchParams();
  formData.set('__VIEWSTATE', viewState);
  formData.set('__EVENTVALIDATION', eventValidation);
  formData.set('__VIEWSTATEGENERATOR', viewStateGenerator);
  formData.set('ctl00$ContentPlaceHolder1$RadComboBox1', combo1);
  if (combo2) formData.set('ctl00$ContentPlaceHolder1$RadComboBox2', combo2);
  formData.set('ctl00$ContentPlaceHolder1$DropDownListUnitType', unitType);
  formData.set('ctl00$ContentPlaceHolder1$DropDownListYear', String(year));
  formData.set('ctl00$ContentPlaceHolder1$button_download1', 'Download');

  const postResp = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'EmpoweredVote-Treasury/1.0',
      Cookie: getResp.headers.get('set-cookie') || '',
    },
    body: formData.toString(),
    redirect: 'follow',
  });

  if (!postResp.ok) {
    throw new Error(`Gateway returned HTTP ${postResp.status}`);
  }

  const contentType = postResp.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Gateway returned HTML instead of data — form params may need updating');
  }

  const rawText = await postResp.text();
  console.log(`  Downloaded ${(rawText.length / 1024 / 1024).toFixed(1)} MB`);
  return rawText;
}

// ── Parse pipe-delimited data ───────────────────────────────────────────
function parsePipeDelimited(rawText) {
  const lines = rawText.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split('|').map(h => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('|');
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ── Filter for Monroe County entities ───────────────────────────────────
function filterMonroeCounty(rows) {
  // Try various column names for county code
  const cntyCol = ['cnty_cd', 'county_code', 'cnty_code'].find(c => rows[0]?.[c] !== undefined);
  const unitCol = ['unit_name', 'ent_name', 'name'].find(c => rows[0]?.[c] !== undefined);

  if (!cntyCol && !unitCol) {
    console.log('  ⚠️  Could not find county/unit columns. Headers:', Object.keys(rows[0] || {}).join(', '));
    return rows; // Return all and let caller deal with it
  }

  const filtered = rows.filter(row => {
    // Filter by county code if available
    if (cntyCol && row[cntyCol]) {
      return row[cntyCol] === MONROE_COUNTY_FILTERS.county_code;
    }
    // Or by entity name match
    if (unitCol) {
      const name = row[unitCol].toUpperCase();
      return Object.keys(MONROE_COUNTY_FILTERS.entity_map).some(k => name.includes(k));
    }
    return false;
  });

  return filtered;
}

// ── Resolve entity name to Supabase municipality ────────────────────────
function resolveEntityName(row) {
  const unitCol = ['unit_name', 'ent_name', 'name'].find(c => row[c] !== undefined);
  if (!unitCol) return null;
  const name = row[unitCol].toUpperCase().trim();

  for (const [pattern, municipalityName] of Object.entries(MONROE_COUNTY_FILTERS.entity_map)) {
    if (name.includes(pattern)) return municipalityName;
  }
  return null;
}

function amt(v) {
  if (v == null || v === '') return 0;
  return parseFloat(String(v).replace(/[,$]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
}

// ── Import: Budget Data ─────────────────────────────────────────────────
async function importBudgetData(rows, year) {
  // Group by entity
  const byEntity = new Map();
  for (const row of rows) {
    const entity = resolveEntityName(row);
    if (!entity) continue;
    if (!byEntity.has(entity)) byEntity.set(entity, []);
    byEntity.get(entity).push(row);
  }

  console.log(`  Found ${byEntity.size} Monroe County entities`);

  for (const [entityName, entityRows] of byEntity) {
    console.log(`\n  📊 ${entityName}: ${entityRows.length} budget rows`);

    // Show column names for debugging first time
    if (entityName === [...byEntity.keys()][0]) {
      console.log(`  Columns: ${Object.keys(entityRows[0]).slice(0, 15).join(', ')}...`);
    }

    // Build tree from hierarchy: fund_name -> department_name -> item
    const fundCol = ['unit_fund_name', 'fund_name', 'fund_description', 'fund'].find(c => entityRows[0][c] !== undefined);
    const deptCol = ['department_name', 'department', 'dept'].find(c => entityRows[0][c] !== undefined);
    const amtCol = ['amount', 'total budget estimate_adopted', 'total budget estimate_published', 'published_amount', 'adopted_amount', 'net_amount_to_be_raised'].find(c => entityRows[0][c] !== undefined);
    const descCol = ['item_description', 'description', 'disburse_name', 'category_name', 'fund_description'].find(c => entityRows[0][c] !== undefined);

    if (!amtCol) {
      console.log(`  ⚠️  No amount column found. Columns: ${Object.keys(entityRows[0]).join(', ')}`);
      continue;
    }

    console.log(`  Using columns: fund=${fundCol}, dept=${deptCol}, amount=${amtCol}, desc=${descCol}`);

    const total = entityRows.reduce((s, r) => s + amt(r[amtCol]), 0);
    console.log(`  Total: $${Math.round(total).toLocaleString()}`);

    // Build compact tree for RPC
    const tree = new Map();
    for (const row of entityRows) {
      const fund = row[fundCol] || 'General';
      const dept = deptCol ? (row[deptCol] || 'Unknown') : 'General';

      if (!tree.has(fund)) tree.set(fund, new Map());
      const fundNode = tree.get(fund);
      if (!fundNode.has(dept)) fundNode.set(dept, []);
      fundNode.get(dept).push({
        d: row[descCol] || dept,
        a: amt(row[amtCol]),
        aa: null, f: fund, e: null,
      });
    }

    // Convert to compact JSON tree
    const jsonTree = [];
    for (const [fundName, depts] of tree) {
      let fundTotal = 0;
      const children = [];
      for (const [deptName, items] of depts) {
        const deptTotal = items.reduce((s, i) => s + i.a, 0);
        fundTotal += deptTotal;
        children.push({ n: deptName, a: deptTotal, i: items });
      }
      children.sort((a, b) => b.a - a.a);
      jsonTree.push({ n: fundName, a: fundTotal, c: children });
    }
    jsonTree.sort((a, b) => b.a - a.a);

    // Get data source ID for this entity
    const { data: sources } = await supabase.rpc('treasury_list_source_ids');
    const ds = sources?.find(s => s.name.toLowerCase().includes(entityName.toLowerCase()));

    if (!ds) {
      console.log(`  ⚠️  No Gateway data source configured for ${entityName} (operating)`);
      continue;
    }

    const { data: result, error } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id,
      p_fiscal_year: year,
      p_dataset_type: 'operating',
      p_total: total,
      p_tree: jsonTree,
      p_row_count: entityRows.length,
      p_triggered_by: 'bulk_load',
    });

    if (error) {
      console.log(`  ❌ RPC error: ${error.message}`);
    } else {
      console.log(`  ✅ Inserted ${result.rows_inserted} line items, budget $${Math.round(total).toLocaleString()}`);
    }
  }
}

// ── Import: Detailed Receipts ───────────────────────────────────────────
async function importReceipts(rows, year) {
  const byEntity = new Map();
  for (const row of rows) {
    const entity = resolveEntityName(row);
    if (!entity) continue;
    if (!byEntity.has(entity)) byEntity.set(entity, []);
    byEntity.get(entity).push(row);
  }

  console.log(`  Found ${byEntity.size} Monroe County entities`);

  for (const [entityName, entityRows] of byEntity) {
    console.log(`\n  📊 ${entityName}: ${entityRows.length} receipt rows`);

    if (entityName === [...byEntity.keys()][0]) {
      console.log(`  Columns: ${Object.keys(entityRows[0]).slice(0, 15).join(', ')}...`);
    }

    const fundCol = ['unit_fund_name', 'fund_name', 'fund'].find(c => entityRows[0][c] !== undefined);
    const receiptCol = ['receipt_name', 'receipt_class_name', 'category_name'].find(c => entityRows[0][c] !== undefined);
    const amtCol = ['amount', 'receipt_amount'].find(c => entityRows[0][c] !== undefined);

    if (!amtCol) { console.log(`  ⚠️  No amount column found`); continue; }

    const total = entityRows.reduce((s, r) => s + amt(r[amtCol]), 0);
    console.log(`  Using: fund=${fundCol}, receipt=${receiptCol}, amount=${amtCol}. Total: $${Math.round(total).toLocaleString()}`);

    // Build tree: fund -> receipt_class -> items
    const tree = new Map();
    for (const row of entityRows) {
      const fund = row[fundCol] || 'General';
      const rcpt = row[receiptCol] || 'Other';
      if (!tree.has(fund)) tree.set(fund, new Map());
      if (!tree.get(fund).has(rcpt)) tree.get(fund).set(rcpt, []);
      tree.get(fund).get(rcpt).push({ d: row[receiptCol] || 'Receipt', a: amt(row[amtCol]), aa: null, f: fund, e: null });
    }

    const jsonTree = [];
    for (const [fundName, rcpts] of tree) {
      let fundTotal = 0; const children = [];
      for (const [rcptName, items] of rcpts) {
        const t = items.reduce((s, i) => s + i.a, 0); fundTotal += t;
        children.push({ n: rcptName, a: t, i: items });
      }
      children.sort((a, b) => b.a - a.a);
      jsonTree.push({ n: fundName, a: fundTotal, c: children });
    }
    jsonTree.sort((a, b) => b.a - a.a);

    // Find matching data source — look for a revenue one, or create if operating exists
    const { data: sources } = await supabase.rpc('treasury_list_source_ids');
    const ds = sources?.find(s => s.name.toLowerCase().includes(entityName.toLowerCase()));

    if (!ds) { console.log(`  ⚠️  No Gateway data source for ${entityName}`); continue; }

    const { data: result, error } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id, p_fiscal_year: year, p_dataset_type: 'revenue',
      p_total: total, p_tree: jsonTree, p_row_count: entityRows.length, p_triggered_by: 'bulk_load',
    });

    if (error) console.log(`  ❌ RPC error: ${error.message}`);
    else console.log(`  ✅ Revenue: ${result.rows_inserted} items, $${Math.round(total).toLocaleString()}`);
  }
}

// ── Import: Disbursements (deep hierarchy: fund → dept → class → item) ──
async function importDisbursements(rows, year) {
  const byEntity = new Map();
  for (const row of rows) {
    const entity = resolveEntityName(row);
    if (!entity) continue;
    if (!byEntity.has(entity)) byEntity.set(entity, []);
    byEntity.get(entity).push(row);
  }

  console.log(`  Found ${byEntity.size} Monroe County entities`);

  for (const [entityName, entityRows] of byEntity) {
    console.log(`\n  📊 ${entityName}: ${entityRows.length} disbursement rows`);

    if (entityName === [...byEntity.keys()][0]) {
      console.log(`  Columns: ${Object.keys(entityRows[0]).slice(0, 20).join(', ')}...`);
    }

    const fundCol = ['unit_fund_name', 'fund_name'].find(c => entityRows[0][c] !== undefined);
    const deptCol = ['department_name', 'department'].find(c => entityRows[0][c] !== undefined);
    const classCol = ['disburse_class_name'].find(c => entityRows[0][c] !== undefined);
    const disbCol = ['disburse_name', 'category_name'].find(c => entityRows[0][c] !== undefined);
    const amtCol = ['amount', 'disburse_amount'].find(c => entityRows[0][c] !== undefined);

    if (!amtCol) { console.log(`  ⚠️  No amount column found`); continue; }

    const total = entityRows.reduce((s, r) => s + amt(r[amtCol]), 0);
    console.log(`  Using: fund=${fundCol}, dept=${deptCol}, class=${classCol}, disb=${disbCol}, amount=${amtCol}`);
    console.log(`  Total: $${Math.round(total).toLocaleString()}`);

    // Build deep tree: fund → department → disburse_class → disburse_name (line items)
    // This creates 3 levels of categories + line items at the leaf
    const tree = new Map(); // fund → Map<dept, Map<class, items[]>>
    for (const row of entityRows) {
      const fund = row[fundCol] || 'General';
      const dept = deptCol ? (row[deptCol] || 'General') : 'General';
      const cls = classCol ? (row[classCol] || 'Other') : 'Other';
      const itemName = row[disbCol] || 'Disbursement';

      if (!tree.has(fund)) tree.set(fund, new Map());
      const fundNode = tree.get(fund);
      if (!fundNode.has(dept)) fundNode.set(dept, new Map());
      const deptNode = fundNode.get(dept);
      if (!deptNode.has(cls)) deptNode.set(cls, []);
      deptNode.get(cls).push({
        d: itemName, a: amt(row[amtCol]), aa: null, f: fund, e: cls,
      });
    }

    // Convert to JSON tree: fund → dept children → class children → line items
    const jsonTree = [];
    for (const [fundName, depts] of tree) {
      let fundTotal = 0;
      const deptChildren = [];

      for (const [deptName, classes] of depts) {
        let deptTotal = 0;
        const classChildren = [];

        for (const [className, items] of classes) {
          const classTotal = items.reduce((s, i) => s + i.a, 0);
          deptTotal += classTotal;
          classChildren.push({ n: className, a: classTotal, i: items });
        }

        classChildren.sort((a, b) => b.a - a.a);
        fundTotal += deptTotal;
        deptChildren.push({ n: deptName, a: deptTotal, c: classChildren });
      }

      deptChildren.sort((a, b) => b.a - a.a);
      jsonTree.push({ n: fundName, a: fundTotal, c: deptChildren });
    }
    jsonTree.sort((a, b) => b.a - a.a);

    const { data: sources } = await supabase.rpc('treasury_list_source_ids');
    const ds = sources?.find(s => s.name.toLowerCase().includes(entityName.toLowerCase()));
    if (!ds) { console.log(`  ⚠️  No Gateway data source for ${entityName}`); continue; }

    // Use operating type for disbursements (expenditure view)
    const { data: result, error } = await supabase.rpc('treasury_sync_budget_tree', {
      p_data_source_id: ds.id, p_fiscal_year: year, p_dataset_type: 'operating',
      p_total: total, p_tree: jsonTree, p_row_count: entityRows.length, p_triggered_by: 'bulk_load',
    });

    if (error) console.log(`  ❌ RPC error: ${error.message}`);
    else console.log(`  ✅ Disbursements: ${result.rows_inserted} items, $${Math.round(total).toLocaleString()}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const { values } = parseArgs({
    options: {
      report: { type: 'string', short: 'r' },
      year: { type: 'string', short: 'y' },
      all: { type: 'boolean', short: 'a' },
      list: { type: 'boolean', short: 'l' },
      'show-columns': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
    strict: false,
  });

  if (values.list) {
    console.log('\n📋 Available Gateway report types:\n');
    for (const rt of REPORT_TYPES) {
      console.log(`  "${rt.name}" → maps to dataset type: ${rt.datasetType}`);
    }
    console.log('\nYears: 2012-2025');
    return;
  }

  const year = parseInt(values.year) || 2024;
  const reports = values.all
    ? REPORT_TYPES.filter(r => ['Budget Data', 'Detailed Receipts', 'Disbursements by Fund and Department'].includes(r.name))
    : REPORT_TYPES.filter(r => r.name === values.report || r.name.toLowerCase().includes((values.report || '').toLowerCase()));

  if (reports.length === 0) {
    console.error('No report type specified. Use --report "..." or --all. Use --list to see options.');
    process.exit(1);
  }

  console.log(`\n🏛️  Indiana Gateway Bulk Loader`);
  console.log(`   Year: ${year}`);
  console.log(`   Reports: ${reports.map(r => r.name).join(', ')}`);
  console.log(`   Filtering for: Monroe County entities\n`);

  for (const report of reports) {
    try {
      const rawText = await downloadGatewayFile(report.combo1, report.combo2, year);
      const { headers, rows } = parsePipeDelimited(rawText);

      console.log(`  Parsed ${rows.length.toLocaleString()} total rows, ${headers.length} columns`);
      console.log(`  Columns: ${headers.slice(0, 15).join(', ')}${headers.length > 15 ? '...' : ''}`);

      // Filter for Monroe County
      const monroeRows = filterMonroeCounty(rows);
      console.log(`  Monroe County: ${monroeRows.length.toLocaleString()} rows`);

      if (values['show-columns']) {
        console.log('\n  All columns:', headers.join(' | '));
        if (monroeRows[0]) {
          console.log('\n  Sample row:');
          for (const [k, v] of Object.entries(monroeRows[0])) {
            if (v) console.log(`    ${k}: ${v}`);
          }
        }
        continue;
      }

      if (values['dry-run']) {
        console.log('  (dry run — skipping import)');
        continue;
      }

      // Import based on report type
      if (report.name === 'Budget Data') {
        await importBudgetData(monroeRows, year);
      } else if (report.name === 'Detailed Receipts') {
        await importReceipts(monroeRows, year);
      } else if (report.name.includes('Disbursements')) {
        await importDisbursements(monroeRows, year);
      } else {
        console.log(`  ⚠️  Import not implemented for "${report.name}" yet`);
      }
    } catch (err) {
      console.error(`  ❌ Error with "${report.name}": ${err.message}`);
    }
  }

  console.log('\n🎉 Gateway import complete!\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
