#!/usr/bin/env node
/**
 * XLSX Data Sources Seeder
 *
 * Creates (or updates) treasury.data_sources rows for all XLSX-based city
 * check register and payroll datasets. One row per (city, dataset, fiscal year).
 *
 * Idempotent: safe to re-run. Looks up existing rows by name and updates
 * them in-place; inserts only when the row does not exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedXLSXDataSources.js
 *
 * Schema notes:
 *   - Download URLs are stored in base_url (treasury.data_sources schema)
 *   - Fiscal year stored as fiscal_years: [YYYY] (single-element array)
 *   - bulkLoadXLSX.js normalizes these via fiscalYear/downloadUrl locals
 *
 * Cities:
 *   McKinney check register FY22-FY25 (operating)
 *   McKinney payroll register FY22-FY25 (salaries)
 *   Frisco check register FY18-FY26 (operating)
 *   Plano check register FY25 placeholder (transactions, manual export)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── URL maps (compact) ───────────────────────────────────────────────────────
const MCK_CHECK_URLS = {
  2025: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2752',
  2024: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2669',
  2023: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2541',
  2022: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2456',
};
const MCK_PAYROLL_URLS = {
  2025: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2753',
  2024: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2670',
  2023: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2542',
  2022: 'https://www.mckinneytexas.org/Archive.aspx?ADID=2457',
};
const FRISCO_CHECK_URLS = {
  2026: 'https://www.friscotexas.gov/DocumentCenter/View/39851/City_of_Frisco_Check_Register_FY26_To_Date-XLSX',
  2025: 'https://www.friscotexas.gov/DocumentCenter/View/35341/Copy-of-City_of_Frisco_Check_Register_FY25_To_Date-XLSX',
  2024: 'https://www.friscotexas.gov/Archive.aspx?ADID=3787',
  2023: 'https://www.friscotexas.gov/Archive.aspx?ADID=3785',
  2022: 'https://www.friscotexas.gov/Archive.aspx?ADID=3783',
  2021: 'https://www.friscotexas.gov/Archive.aspx?ADID=3781',
  2020: 'https://www.friscotexas.gov/Archive.aspx?ADID=3779',
  2019: 'https://www.friscotexas.gov/Archive.aspx?ADID=3777',
  2018: 'https://www.friscotexas.gov/Archive.aspx?ADID=3775',
};

// ── Column mappings ──────────────────────────────────────────────────────────
// McKinney check register: vendor name is in description_1 (not vendor_number)
const mckCheckCm = {
  date_column: 'payment_date',
  amount_column: 'net_amount',
  vendor_column: 'description_1',
  description_column: 'description_2',
  department_column: 'department',
  invoice_number_column: 'payment_number',
};

// McKinney payroll: employee names are redacted; employee_number used as vendor
const mckPayrollCm = {
  date_column: 'check_date',
  amount_column: 'current_gross_amount',
  vendor_column: 'employee_number',
  description_column: 'actual_position_title',
};

// Frisco: headers are at row 5 (rows 1-4 are title/blank rows)
const friscoCheckCm = {
  header_row: 5,
  date_column: 'check_date',
  amount_column: 'amount',
  vendor_column: 'vendor_name',
  description_column: 'description',
};

// ── Build sources array (resolves municipality IDs at runtime) ───────────────
async function buildSources() {
  const { data: munis, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .in('name', ['Plano', 'McKinney', 'Frisco']);

  if (error) {
    console.error('Failed to fetch municipalities:', error.message);
    process.exit(1);
  }

  const muniId = name => {
    const m = munis.find(x => x.name === name);
    if (!m) {
      console.error('Municipality not found: ' + name);
      process.exit(1);
    }
    return m.id;
  };

  const sources = [];

  // McKinney check register FY22-FY25
  for (const [fy, url] of Object.entries(MCK_CHECK_URLS)) {
    sources.push({
      name: `McKinney Check Register FY${fy}`,
      api_type: 'xlsx_download',
      dataset_type: 'operating',
      dataset_id: `fy${fy}`,    // required to satisfy unique(muni, api_type, dataset_id, dataset_type)
      base_url: url,             // download URL stored in base_url per schema
      fiscal_years: [parseInt(fy)], // single-element array per schema
      municipality_id: muniId('McKinney'),
      column_mapping: mckCheckCm,
    });
  }

  // McKinney payroll register FY22-FY25
  for (const [fy, url] of Object.entries(MCK_PAYROLL_URLS)) {
    sources.push({
      name: `McKinney Payroll Register FY${fy}`,
      api_type: 'xlsx_download',
      dataset_type: 'salaries',
      dataset_id: `fy${fy}`,
      base_url: url,
      fiscal_years: [parseInt(fy)],
      municipality_id: muniId('McKinney'),
      column_mapping: mckPayrollCm,
    });
  }

  // Frisco check register FY18-FY26
  for (const [fy, url] of Object.entries(FRISCO_CHECK_URLS)) {
    sources.push({
      name: `Frisco Check Register FY${fy}`,
      api_type: 'xlsx_download',
      dataset_type: 'operating',
      dataset_id: `fy${fy}`,
      base_url: url,
      fiscal_years: [parseInt(fy)],
      municipality_id: muniId('Frisco'),
      column_mapping: friscoCheckCm,
    });
  }

  const planoCm = {
    date_column: 'checkdate',
    amount_column: 'amount',
    vendor_column: 'payeename',
    description_column: 'description',
    department_column: 'costcentername',
    fund_column: 'fundname',
    payment_method_column: 'documenttype',
  };

  // Plano check register FY2020–FY2023 — CSV exports from checkregister.plano.gov
  for (const [fy, file] of [
    [2020, 'PlanoFinancialReport 2020.csv'],
    [2021, 'PlanoFinancialReport 2021.csv'],
    [2022, 'PlanoFinancialReport 2022.csv'],
    [2023, 'PlanoFinancialReport 2023.csv'],
  ]) {
    sources.push({
      name: `Plano Check Register FY${fy}`,
      api_type: 'xlsx_download',
      dataset_type: 'transactions',
      dataset_id: `fy${fy}`,
      base_url: `file://C:/Transparent Motivations/Data Drop/Plano, TX/${file}`,
      fiscal_years: [fy],
      municipality_id: muniId('Plano'),
      column_mapping: planoCm,
    });
  }

  // Plano check register FY2024 — CSV export (Oct 2023–Sep 2024)
  sources.push({
    name: 'Plano Check Register FY2024',
    api_type: 'xlsx_download',
    dataset_type: 'transactions',
    dataset_id: 'fy2024',
    base_url: 'file://C:/Transparent Motivations/Data Drop/Plano, TX/PlanoFinancialReport.csv',
    fiscal_years: [2024],
    municipality_id: muniId('Plano'),
    column_mapping: planoCm,
  });

  // Plano check register FY2025 — CSV export (Oct 2024–Sep 2025)
  sources.push({
    name: 'Plano Check Register FY2025',
    api_type: 'xlsx_download',
    dataset_type: 'transactions',
    dataset_id: 'fy2025',
    base_url: 'file://C:/Transparent Motivations/Data Drop/Plano, TX/PlanoFinancialReport_till05032026.csv',
    fiscal_years: [2025],
    municipality_id: muniId('Plano'),
    column_mapping: planoCm,
  });

  return sources;
}

// ── Idempotent upsert: select by name → insert or update ────────────────────
async function upsertByName(src) {
  const { data: existing, error: selectErr } = await supabase
    .schema('treasury')
    .from('data_sources')
    .select('id')
    .eq('name', src.name)
    .maybeSingle();

  if (selectErr) {
    console.error(`  ERROR selecting "${src.name}": ${selectErr.message}`);
    process.exit(1);
  }

  let data, error;

  if (existing?.id) {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .update(src)
      .eq('id', existing.id)
      .select());
    if (!error) console.log(`  (updated existing row ${existing.id})`);
  } else {
    ({ data, error } = await supabase
      .schema('treasury')
      .from('data_sources')
      .insert(src)
      .select());
    if (!error) console.log(`  (inserted new row)`);
  }

  if (error) {
    console.error(`  ERROR writing "${src.name}": ${error.message}`);
    process.exit(1);
  }

  return data?.[0];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding XLSX data_sources rows...\n');

  const SOURCES = await buildSources();

  for (const src of SOURCES) {
    console.log(`Upserting: ${src.name}`);
    const row = await upsertByName(src);
    if (!row) {
      console.error(`  ERROR: no row returned for "${src.name}"`);
      process.exit(1);
    }
    console.log(`  id:           ${row.id}`);
    console.log(`  api_type:     ${row.api_type}`);
    console.log(`  dataset_type: ${row.dataset_type}`);
    console.log(`  fiscal_years: ${JSON.stringify(row.fiscal_years)}`);
    console.log(`  base_url:     ${row.base_url}`);
    console.log('');
  }

  // ── Verify via treasury_list_source_ids RPC ──────────────────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) {
    console.error(`  ERROR calling treasury_list_source_ids: ${listErr.message}`);
    process.exit(1);
  }

  const xlsxRows = (listing || []).filter(r => r.api_type === 'xlsx_download');
  if (xlsxRows.length < SOURCES.length) {
    console.error(`  ERROR: expected at least ${SOURCES.length} xlsx_download rows, got ${xlsxRows.length}`);
    process.exit(1);
  }

  console.log(`  Verification: treasury_list_source_ids returns ${xlsxRows.length} xlsx_download rows.`);
  for (const r of xlsxRows) {
    const fy = Array.isArray(r.fiscal_years) ? r.fiscal_years[0] : r.fiscal_years;
    console.log(`  - ${r.name} (${r.dataset_type}, FY${fy})`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
