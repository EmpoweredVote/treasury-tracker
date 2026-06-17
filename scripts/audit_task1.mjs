import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
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
const CHUNK = 200;

// LA County cities
const {data: laCountyCities} = await s.from('municipalities').select('id,name').eq('county_id', LA_COUNTY_ID).eq('entity_type','city');
console.log('LA County cities (linked):', laCountyCities.length);
const lcCityIds = laCountyCities.map(m => m.id);

let lcOpTotal=0, lcRevTotal=0, lcOpSlashD=0, lcRevSlashD=0;
let lcOpNull=0, lcRevNull=0, lcOpTrueGap=0, lcRevTrueGap=0;

for (let i = 0; i < lcCityIds.length; i += CHUNK) {
  const chunk = lcCityIds.slice(i, i+CHUNK);
  lcOpTotal += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating')).count||0);
  lcRevTotal += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue')).count||0);
  lcOpNull += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating').is('source_url',null)).count||0);
  lcRevNull += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue').is('source_url',null)).count||0);
  lcOpSlashD += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating').like('source_url','%/d/%')).count||0);
  lcRevSlashD += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue').like('source_url','%/d/%')).count||0);
  lcOpTrueGap += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating').is('source_url',null).is('data_source',null)).count||0);
  lcRevTrueGap += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue').is('source_url',null).is('data_source',null)).count||0);
}

console.log('\n=== LA COUNTY CITIES (' + laCountyCities.length + ') BUDGET ROWS ===');
console.log('Operating: total', lcOpTotal, '| /d/ source_url', lcOpSlashD, '| NULL source_url', lcOpNull, '| true gap', lcOpTrueGap);
console.log('Revenue: total', lcRevTotal, '| /d/ source_url', lcRevSlashD, '| NULL source_url', lcRevNull, '| true gap', lcRevTrueGap);

// LA County gov entity budget rows
const {data: lcGovRows} = await s.from('budgets')
  .select('source_url,data_source,dataset_type,fiscal_year')
  .eq('municipality_id', LA_COUNTY_ID)
  .in('dataset_type',['operating','revenue'])
  .order('fiscal_year');
const lcGovSlashD = lcGovRows.filter(r => r.source_url && r.source_url.includes('/d/')).length;
const lcGovNull = lcGovRows.filter(r => !r.source_url).length;
console.log('\n=== LA COUNTY GOVERNMENT ENTITY (county budget) ===');
console.log('Total rows:', lcGovRows.length, '| /d/ source_url:', lcGovSlashD, '| NULL source_url:', lcGovNull);
if (lcGovRows.length > 0) {
  console.log('FY range:', lcGovRows[0].fiscal_year, '-', lcGovRows[lcGovRows.length-1].fiscal_year);
}

// Phase 59 thin cities
const phase59Names = ['Fresno','Riverside','San Jose','Oakland','Bakersfield','San Diego','Berkeley'];
const {data: p59Munis} = await s.from('municipalities').select('id,name').in('name',phase59Names).eq('state','CA');
const p59Ids = p59Munis.map(m => m.id);

let p59OpTotal=0, p59RevTotal=0, p59OpSlashD=0, p59RevSlashD=0;
let p59OpNull=0, p59RevNull=0, p59OpTrueGap=0, p59RevTrueGap=0;

for (let i = 0; i < p59Ids.length; i += CHUNK) {
  const chunk = p59Ids.slice(i, i+CHUNK);
  p59OpTotal += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating')).count||0);
  p59RevTotal += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue')).count||0);
  p59OpSlashD += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating').like('source_url','%/d/%')).count||0);
  p59RevSlashD += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue').like('source_url','%/d/%')).count||0);
  p59OpNull += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating').is('source_url',null)).count||0);
  p59RevNull += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue').is('source_url',null)).count||0);
  p59OpTrueGap += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','operating').is('source_url',null).is('data_source',null)).count||0);
  p59RevTrueGap += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','revenue').is('source_url',null).is('data_source',null)).count||0);
}

console.log('\n=== PHASE 59 THIN CITIES ===');
console.log('Cities:', p59Munis.map(m=>m.name).join(', '));
console.log('Operating:', p59OpTotal, '| /d/ source_url:', p59OpSlashD, '| NULL source_url:', p59OpNull, '| true gap:', p59OpTrueGap);
console.log('Revenue:', p59RevTotal, '| /d/ source_url:', p59RevSlashD, '| NULL source_url:', p59RevNull, '| true gap:', p59RevTrueGap);

// Phase 60 CA salaries - sampled per chunk
const {data: allCaMunis} = await s.from('municipalities').select('id').eq('state','CA');
const allCaIds = allCaMunis.map(m => m.id);

let salTotal=0, salGCC=0, salNullBoth=0, salWithUrl=0;
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  const {data: d} = await s.from('budgets').select('data_source,source_url').in('municipality_id',chunk).eq('dataset_type','salaries').limit(5000);
  for (const r of (d||[])) {
    salTotal++;
    if (r.source_url) salWithUrl++;
    if (r.data_source && r.data_source.includes('publicpay')) salGCC++;
    if (!r.source_url && (!r.data_source || !r.data_source.trim())) salNullBoth++;
  }
}

console.log('\n=== PHASE 60 CA SALARIES ===');
console.log('Total CA salary rows:', salTotal);
console.log('With publicpay data_source (GCC provenance):', salGCC);
console.log('With source_url:', salWithUrl);
console.log('NULL both (true gap - must be 0):', salNullBoth);

console.log('\n=== SUMMARY VERDICT ===');
const pass = lcOpTrueGap===0 && lcRevTrueGap===0 && p59OpTrueGap===0 && p59RevTrueGap===0 && salNullBoth===0;
console.log('All true gaps = 0:', pass ? 'PASS' : 'FAIL');
console.log('LA County city NULL source_url (expected: non-SCO custom rows LA/LB/WeHo only):', lcOpNull + lcRevNull);
