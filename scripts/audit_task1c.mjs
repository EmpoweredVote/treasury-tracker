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

const LA_COUNTY_ID = 'f3db6f9f-2575-48e3-bf42-a1f9dd1ec6a1';

// Get LA County cities
const {data: laCountyCities} = await s.from('municipalities').select('id,name').eq('county_id', LA_COUNTY_ID).eq('entity_type','city');
const lcCityIds = laCountyCities.map(m => m.id);
const muniMap = {};
laCountyCities.forEach(m => muniMap[m.id] = m.name);

// Get the actual NULL source_url rows with city names for LA County cities
const CHUNK = 200;
let nullRows = [];
for (let i = 0; i < lcCityIds.length; i += CHUNK) {
  const chunk = lcCityIds.slice(i, i+CHUNK);
  const {data: d} = await s.from('budgets')
    .select('municipality_id,data_source,dataset_type,fiscal_year')
    .in('municipality_id', chunk)
    .in('dataset_type',['operating','revenue'])
    .is('source_url', null)
    .limit(200);
  nullRows = nullRows.concat(d||[]);
}

console.log('LA County city NULL source_url rows total:', nullRows.length);

const byCity = {};
for (const r of nullRows) {
  const city = muniMap[r.municipality_id] || r.municipality_id;
  if (!byCity[city]) byCity[city] = {count:0, data_sources: new Set()};
  byCity[city].count++;
  byCity[city].data_sources.add(r.data_source || 'NULL');
}

for (const [city, info] of Object.entries(byCity)) {
  console.log(city + ':', info.count, 'rows | data_source:', [...info.data_sources]);
}

// Phase 58 expected 37 total = LA (24) + LB (7) + WeHo (6). Let me also check LB and WeHo specifically.
const cities = ['Los Angeles','Long Beach','West Hollywood'];
const {data: customMunis} = await s.from('municipalities').select('id,name').in('name',cities).eq('state','CA');
const customIds = customMunis.map(m => m.id);
const customMap = {};
customMunis.forEach(m => customMap[m.id] = m.name);

let customNull = [];
for (const id of customIds) {
  const {data: d} = await s.from('budgets')
    .select('municipality_id,data_source,dataset_type,fiscal_year')
    .eq('municipality_id', id)
    .is('source_url', null)
    .in('dataset_type',['operating','revenue','salaries'])
    .limit(200);
  customNull = customNull.concat(d||[]);
}

console.log('\n=== LA/LB/WeHo NULL source_url rows (all datasets) ===');
const customByCity = {};
for (const r of customNull) {
  const city = customMap[r.municipality_id];
  if (!customByCity[city]) customByCity[city] = {total:0, by_ds: {}};
  customByCity[city].total++;
  const ds = r.data_source || 'NULL';
  customByCity[city].by_ds[ds] = (customByCity[city].by_ds[ds] || 0) + 1;
}

for (const [city, info] of Object.entries(customByCity)) {
  console.log(city + ': total=' + info.total);
  for (const [ds, cnt] of Object.entries(info.by_ds)) {
    console.log('  ' + cnt + 'x "' + ds + '"');
  }
}
