#!/usr/bin/env node
/**
 * Seed data_source rows for Leonardtown, MD.
 * Idempotent — uses upsert by (municipality_id, dataset_type, dataset_id).
 *
 * Sources:
 *   FY2023 Operating: https://leonardtown.somd.com/pdf/Budget-FY2023.pdf (text PDF)
 *   FY2024 Operating: https://leonardtown.somd.com/pdf/BudgetFY2024.pdf (scanned PDF)
 *
 * Run this AFTER insertLeonardtownMunicipality.js.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: muni, error: muniErr } = await supabase.schema('treasury')
  .from('municipalities')
  .select('id')
  .eq('name', 'Leonardtown')
  .eq('state', 'MD')
  .single();

if (muniErr || !muni) {
  console.error('Leonardtown not found — run insertLeonardtownMunicipality.js first');
  process.exit(2);
}

const municipalityId = muni.id;
console.log('Municipality id:', municipalityId);

const sources = [
  {
    name:            'Leonardtown Operating Budget FY2023',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'fy2023',
    base_url:        'https://leonardtown.somd.com',
    fiscal_years:    [2023],
    municipality_id: municipalityId,
    column_mapping:  {
      url_path: '/pdf/Budget-FY2023.pdf',
      pdf_type: 'text',
    },
  },
  {
    name:            'Leonardtown Operating Budget FY2024',
    api_type:        'pdf_download',
    dataset_type:    'operating',
    dataset_id:      'fy2024',
    base_url:        'https://leonardtown.somd.com',
    fiscal_years:    [2024],
    municipality_id: municipalityId,
    column_mapping:  {
      url_path: '/pdf/BudgetFY2024.pdf',
      pdf_type: 'scanned',
    },
  },
];

for (const src of sources) {
  const { data: existing } = await supabase.schema('treasury')
    .from('data_sources')
    .select('id, name')
    .eq('municipality_id', municipalityId)
    .eq('dataset_type', src.dataset_type)
    .eq('dataset_id', src.dataset_id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.schema('treasury')
      .from('data_sources')
      .update({ name: src.name, base_url: src.base_url, fiscal_years: src.fiscal_years, column_mapping: src.column_mapping })
      .eq('id', existing.id);
    if (error) { console.error('Update failed for', src.name, error.message); process.exit(1); }
    console.log('Updated:', src.name, '(' + existing.id + ')');
  } else {
    const { data: inserted, error } = await supabase.schema('treasury')
      .from('data_sources')
      .insert(src)
      .select()
      .single();
    if (error) { console.error('Insert failed for', src.name, error.message); process.exit(1); }
    console.log('Inserted:', src.name, '(' + inserted.id + ')');
  }
}

console.log('\nDone. Data sources seeded for Leonardtown, MD.');
