#!/usr/bin/env node
/**
 * One-off script: insert Leonardtown, MD into treasury.municipalities (idempotent).
 * Run once; may be deleted after confirmed.
 *
 * Leonardtown is the county seat of St. Mary's County, MD.
 * Population 4,563 (2020 Census).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: existing, error: selErr } = await supabase.schema('treasury')
  .from('municipalities')
  .select('id, name, state')
  .eq('name', 'Leonardtown')
  .eq('state', 'MD')
  .maybeSingle();

if (selErr) { console.error('Select error:', selErr.message); process.exit(1); }

if (existing) {
  console.log('Already exists: ' + existing.id + ' (' + existing.name + ', ' + existing.state + ')');
  process.exit(0);
}

const { data: inserted, error: insErr } = await supabase.schema('treasury')
  .from('municipalities')
  .insert({
    name:            'Leonardtown',
    state:           'MD',
    entity_type:     'municipality',
    population:      4563,
    population_year: 2020,
  })
  .select()
  .single();

if (insErr) { console.error('Insert error:', insErr.message); process.exit(1); }
console.log('Leonardtown municipality id: ' + inserted.id);
