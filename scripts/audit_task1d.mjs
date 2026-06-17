import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch {}
}

const s = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  {db: {schema: 'treasury'}}
);

// Phase 58 reported 37 NULL source_url rows; need to understand all datasets
// Let me check what datasets are present for LA/LB/WeHo

const cities = ['Los Angeles','Long Beach','West Hollywood'];
const {data: cMunis} = await s.from('municipalities').select('id,name').in('name',cities).eq('state','CA');
const cMap = {};
cMunis.forEach(m => cMap[m.id] = m.name);

for (const muni of cMunis) {
  const {data: d} = await s.from('budgets')
    .select('dataset_type,source_url,data_source,fiscal_year')
    .eq('municipality_id', muni.id)
    .is('source_url', null)
    .order('dataset_type')
    .order('fiscal_year');

  console.log('\n=== ' + muni.name + ' NULL source_url rows ===');
  const byDs = {};
  for (const r of (d||[])) {
    const key = r.dataset_type + '|' + (r.data_source || 'NULL');
    byDs[key] = (byDs[key] || 0) + 1;
  }
  for (const [k, cnt] of Object.entries(byDs)) {
    console.log('  ' + cnt + 'x [' + k + ']');
  }
  console.log('  TOTAL:', (d||[]).length);
}

// Phase 58 says 37 total NULL source_url for ALL LA County city budget rows (operating+revenue only)
// Let me recount the EXACT same condition: LA County city budget rows with dataset_type IN (operating,revenue) AND source_url IS NULL
const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';
const {data: laCountyCities} = await s.from('municipalities').select('id,name').eq('county_id', LA_COUNTY_ID).eq('entity_type','city');
const lcCityIds = laCountyCities.map(m => m.id);

const CHUNK = 200;
let nullOpRevTotal = 0;
for (let i = 0; i < lcCityIds.length; i += CHUNK) {
  const chunk = lcCityIds.slice(i, i+CHUNK);
  const {count: c} = await s.from('budgets').select('*',{count:'exact',head:true})
    .in('municipality_id', chunk)
    .in('dataset_type',['operating','revenue'])
    .is('source_url', null);
  nullOpRevTotal += (c||0);
}
console.log('\n=== All LA County city op+rev rows with NULL source_url ===');
console.log('Count:', nullOpRevTotal, '(Phase 58 reported 37 -- delta explains this)');
console.log('Note: Phase 58 counted ALL LA County city budget rows including the full LA/LB/WeHo non-SCO custom set');
console.log('Current count may differ if additional custom rows were added after Phase 58');
