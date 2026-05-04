#!/usr/bin/env node
/**
 * PDF Data Sources Seeder
 *
 * Creates (or updates) treasury.data_sources rows for ACFR/budget PDF datasets:
 *   - Allen ACFR FY2025
 *   - Prosper ACFR FY2025
 *   - Celina ACFR FY2025
 *   - Plano Operating Budget FY2025 (local file — docs/Plano/)
 *
 * Idempotent: safe to re-run. Looks up existing rows by name and updates
 * them in-place; inserts only when the row does not exist yet.
 *
 * Fails fast (exit 1) if any municipality is missing from
 * treasury.municipalities — does NOT auto-create municipalities.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedPDFDataSources.js
 *
 * Schema notes:
 *   - Download URLs / local paths are stored in base_url
 *   - Fiscal year stored as fiscal_years: [YYYY] (single-element array)
 *   - api_type = 'pdf_download'
 *   - dataset_type = 'operating'
 *   - dataset_id = 'fy2025'
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY env var');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── URL constants ─────────────────────────────────────────────────────────────
const ALLEN_ACFR_FY2025  = 'https://www.cityofallen.org/Documents/Departments/Finance/Financial%20Transparency/Other%20Documents/FY%202025%20Annual%20Comprehensive%20Financial%20Report.pdf';
const PROSPER_ACFR_FY2025 = 'https://www.prospertx.gov/ArchiveCenter/ViewFile/Item/682';
const CELINA_ACFR_FY2025  = 'https://www.celina-tx.gov/DocumentCenter/View/15082/City-of-Celina-Texas---FINAL-ACFR-FY2025';
const FRISCO_BUDGET_FY2026 = 'https://www.friscotexas.gov/DocumentCenter/View/39479/Budget-Fiscal-Year-26-PDF';
// Plano: local files (manual exports from plano.gov budget page)
const PLANO_BUDGET_FY2019 = 'file://C:/treasury-tracker/docs/Plano/2018-19 Program of Service - Operating Budget (PDF).pdf';
const PLANO_BUDGET_FY2020 = 'file://C:/treasury-tracker/docs/Plano/2019-20 Program of Service - Operating Budget (PDF).pdf';
const PLANO_BUDGET_FY2022 = 'file://C:/treasury-tracker/docs/Plano/2021-22 Program of Service - Operating Budget (PDF).pdf';
const PLANO_BUDGET_FY2023 = 'file://C:/treasury-tracker/docs/Plano/2022-23 Program of Service - Operating Budget (PDF).pdf';
const PLANO_BUDGET_FY2024 = 'file://C:/treasury-tracker/docs/Plano/2023-24 Program of Service - Operating Budget (PDF).pdf';
const PLANO_BUDGET_FY2025 = 'file://C:/treasury-tracker/docs/Plano/2024-25 Program of Service - Operating Budget (PDF).pdf';
const PLANO_BUDGET_FY2026 = 'file://C:/treasury-tracker/docs/Plano/2025-26 Program of Service - Operating Budget (PDF).pdf';

// ── Column mapping (same for all three — Haiku output field names) ─────────────
const acfrCm = {
  department_column: 'department',
  category_column: 'category',
  approved_amount_column: 'approved_amount',
  actual_amount_column: 'actual_amount',
  fiscal_year_column: 'fiscal_year',
  fund_column: 'fund',
};

// ── Build sources array (resolves municipality IDs at runtime) ────────────────
async function buildSources() {
  const { data: munis, error } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .in('name', ['Allen', 'Prosper', 'Celina', 'Plano', 'Frisco']);

  if (error) {
    console.error('Failed to fetch municipalities:', error.message);
    process.exit(1);
  }

  const muniId = name => {
    const m = munis.find(x => x.name === name);
    if (!m) {
      console.error('Municipality not found in treasury.municipalities: ' + name);
      console.error('Seeder does not auto-create municipalities. Add it first.');
      process.exit(1);
    }
    return m.id;
  };

  return [
    {
      name: 'Allen ACFR FY2025',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2025',
      base_url: ALLEN_ACFR_FY2025,
      fiscal_years: [2025],
      municipality_id: muniId('Allen'),
      column_mapping: acfrCm,
    },
    {
      name: 'Prosper ACFR FY2025',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2025',
      base_url: PROSPER_ACFR_FY2025,
      fiscal_years: [2025],
      municipality_id: muniId('Prosper'),
      column_mapping: acfrCm,
    },
    // Prosper revenue data_sources — same ACFR PDF, dataset_type='revenue'
    {
      name: 'Prosper Revenue FY2025',
      api_type: 'pdf_download',
      dataset_type: 'revenue',
      dataset_id: 'fy2025',
      base_url: PROSPER_ACFR_FY2025,
      fiscal_years: [2025],
      municipality_id: muniId('Prosper'),
      column_mapping: acfrCm,
    },
    {
      name: 'Prosper Revenue FY2024',
      api_type: 'pdf_download',
      dataset_type: 'revenue',
      dataset_id: 'fy2024',
      base_url: PROSPER_ACFR_FY2025,
      fiscal_years: [2024],
      municipality_id: muniId('Prosper'),
      column_mapping: acfrCm,
    },
    {
      name: 'Prosper Revenue FY2023',
      api_type: 'pdf_download',
      dataset_type: 'revenue',
      dataset_id: 'fy2023',
      base_url: PROSPER_ACFR_FY2025,
      fiscal_years: [2023],
      municipality_id: muniId('Prosper'),
      column_mapping: acfrCm,
    },
    {
      name: 'Celina ACFR FY2025',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2025',
      base_url: CELINA_ACFR_FY2025,
      fiscal_years: [2025],
      municipality_id: muniId('Celina'),
      column_mapping: acfrCm,
    },
    {
      name: 'Frisco Operating Budget FY2026',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2026',
      base_url: FRISCO_BUDGET_FY2026,
      fiscal_years: [2026],
      municipality_id: muniId('Frisco'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2019',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2019',
      base_url: PLANO_BUDGET_FY2019,
      fiscal_years: [2019],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2020',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2020',
      base_url: PLANO_BUDGET_FY2020,
      fiscal_years: [2020],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2022',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2022',
      base_url: PLANO_BUDGET_FY2022,
      fiscal_years: [2022],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2023',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2023',
      base_url: PLANO_BUDGET_FY2023,
      fiscal_years: [2023],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2024',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2024',
      base_url: PLANO_BUDGET_FY2024,
      fiscal_years: [2024],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2025',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2025',
      base_url: PLANO_BUDGET_FY2025,
      fiscal_years: [2025],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
    {
      name: 'Plano Operating Budget FY2026',
      api_type: 'pdf_download',
      dataset_type: 'operating',
      dataset_id: 'fy2026',
      base_url: PLANO_BUDGET_FY2026,
      fiscal_years: [2026],
      municipality_id: muniId('Plano'),
      column_mapping: acfrCm,
    },
  ];
}

// ── Idempotent upsert: select by name → insert or update ─────────────────────
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding PDF data_sources rows...\n');

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
    console.log(`  dataset_id:   ${row.dataset_id}`);
    console.log(`  fiscal_years: ${JSON.stringify(row.fiscal_years)}`);
    console.log(`  base_url:     ${row.base_url}`);
    console.log('');
  }

  // ── Verify via treasury_list_source_ids RPC ───────────────────────────────
  console.log('Verifying via treasury_list_source_ids RPC...');
  const { data: listing, error: listErr } = await supabase.rpc('treasury_list_source_ids');
  if (listErr) {
    console.error(`  ERROR calling treasury_list_source_ids: ${listErr.message}`);
    process.exit(1);
  }

  const pdfRows = (listing || []).filter(r => r.api_type === 'pdf_download');
  console.log(`  Verification: treasury_list_source_ids returns ${pdfRows.length} pdf_download row(s).`);
  for (const r of pdfRows) {
    const fy = Array.isArray(r.fiscal_years) ? r.fiscal_years[0] : r.fiscal_years;
    console.log(`  - ${r.name} (${r.dataset_type}, FY${fy})`);
  }

  if (pdfRows.length < SOURCES.length) {
    console.error(`  ERROR: expected at least ${SOURCES.length} pdf_download rows, got ${pdfRows.length}`);
    process.exit(1);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
