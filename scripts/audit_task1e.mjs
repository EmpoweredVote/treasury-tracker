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
const {data: laCountyCities} = await s.from('municipalities').select('id,name').eq('county_id', LA_COUNTY_ID).eq('entity_type','city');
const lcCityIds = laCountyCities.map(m => m.id);
const CHUNK = 200;

// Phase 58 counted 3,891 rows - let me count ALL dataset types for LA County cities
let totalAllDatasets = 0;
let nullAllDatasets = 0;
let nullOpRevSal = 0;
for (let i = 0; i < lcCityIds.length; i += CHUNK) {
  const chunk = lcCityIds.slice(i, i+CHUNK);
  const {count: c1} = await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk);
  totalAllDatasets += (c1||0);
  const {count: c2} = await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).is('source_url',null);
  nullAllDatasets += (c2||0);
  const {count: c3} = await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).in('dataset_type',['operating','revenue','salaries']).is('source_url',null);
  nullOpRevSal += (c3||0);
}

console.log('LA County city ALL dataset rows total:', totalAllDatasets);
console.log('LA County city ALL dataset NULL source_url:', nullAllDatasets);
console.log('LA County city op+rev+salaries NULL source_url:', nullOpRevSal);
console.log('(Phase 58 reported 3,891 rows total / 37 NULL source_url -- those were ALL datasets including transactions)');

// The key audit condition is for the PHASE 58/59/60 cohort = operating+revenue+salaries
// SCO rows in the Phase 58/59/60 cohort specifically
// Let's get a clear breakdown

// Check if WeHo has op+rev NULL source_url rows (it shouldn't)
const {data: wehoMuni} = await s.from('municipalities').select('id').eq('name','West Hollywood').eq('state','CA').single();
if (wehoMuni) {
  const {count: wehoOpRevNull} = await s.from('budgets').select('*',{count:'exact',head:true})
    .eq('municipality_id', wehoMuni.id)
    .in('dataset_type',['operating','revenue'])
    .is('source_url',null);
  console.log('\nWest Hollywood op+rev NULL source_url:', wehoOpRevNull, '(expected 0 - WeHo Demand Register rows are transactions type)');

  const {count: wehoOpRevTotal} = await s.from('budgets').select('*',{count:'exact',head:true})
    .eq('municipality_id', wehoMuni.id)
    .in('dataset_type',['operating','revenue']);
  const {count: wehoSlashD} = await s.from('budgets').select('*',{count:'exact',head:true})
    .eq('municipality_id', wehoMuni.id)
    .in('dataset_type',['operating','revenue'])
    .like('source_url','%/d/%');
  console.log('West Hollywood op+rev total:', wehoOpRevTotal, '| /d/ source_url:', wehoSlashD);
}

// Final confirmed audit numbers for the v2.3 cohort (op+rev+salaries scope)
// D-04b: SCO rows with NULL source_url
// What makes a row "SCO-sourced"? -- the /d/ pattern in source_url OR bythenumbers/sco in data_source
// Since we confirmed 0 true gaps and all SCO rows carry /d/ source_url, the SCO-NULL count is 0

// Let me confirm: are there any CA city budget rows (op+rev+sal) where data_source contains
// "bythenumbers" or "sco" but source_url is NULL?
let scoNullRows = [];
for (let i = 0; i < lcCityIds.length; i += CHUNK) {
  const chunk = lcCityIds.slice(i, i+CHUNK);
  const {data: d} = await s.from('budgets')
    .select('municipality_id,data_source,dataset_type')
    .in('municipality_id',chunk)
    .in('dataset_type',['operating','revenue','salaries'])
    .is('source_url',null)
    .or('data_source.ilike.%bythenumbers%,data_source.ilike.%sco.ca%')
    .limit(100);
  scoNullRows = scoNullRows.concat(d||[]);
}
console.log('\nSCO-labeled rows with NULL source_url (D-04b, MUST be 0):', scoNullRows.length);

// Phase 59 cities same check
const phase59Names = ['Fresno','Riverside','San Jose','Oakland','Bakersfield','San Diego','Berkeley'];
const {data: p59Munis} = await s.from('municipalities').select('id,name').in('name',phase59Names).eq('state','CA');
const p59Ids = p59Munis.map(m => m.id);
let p59ScoNull = [];
for (let i = 0; i < p59Ids.length; i += CHUNK) {
  const chunk = p59Ids.slice(i, i+CHUNK);
  const {data: d} = await s.from('budgets')
    .select('municipality_id,data_source,dataset_type')
    .in('municipality_id',chunk)
    .in('dataset_type',['operating','revenue','salaries'])
    .is('source_url',null)
    .or('data_source.ilike.%bythenumbers%,data_source.ilike.%sco.ca%')
    .limit(100);
  p59ScoNull = p59ScoNull.concat(d||[]);
}
console.log('Phase 59 SCO-labeled rows with NULL source_url (D-04b, MUST be 0):', p59ScoNull.length);
