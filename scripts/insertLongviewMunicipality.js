#!/usr/bin/env node
/**
 * One-off script: insert Longview, TX into treasury.municipalities (idempotent).
 * Run once; may be deleted after confirmed.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(2); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: existing, error: selErr } = await supabase.schema('treasury')
  .from('municipalities')
  .select('id, name, state')
  .eq('name', 'Longview')
  .maybeSingle();

if (selErr) { console.error('Select error:', selErr.message); process.exit(1); }

if (existing) {
  console.log('Already exists: ' + existing.id + ' (' + existing.name + ', ' + existing.state + ')');
  process.exit(0);
}

const { data: inserted, error: insErr } = await supabase.schema('treasury')
  .from('municipalities')
  .insert({
    name:        'Longview',
    state:       'TX',
    entity_type: 'municipality',
    population:  83000,
  })
  .select()
  .single();

if (insErr) { console.error('Insert error:', insErr.message); process.exit(1); }
console.log('Longview municipality id: ' + inserted.id);
