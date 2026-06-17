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
const CHUNK = 200;

// Phase 60 CA salaries - use count queries not data fetches
const {data: allCaMunis} = await s.from('municipalities').select('id').eq('state','CA');
const allCaIds = allCaMunis.map(m => m.id);

let salTotal=0, salGCC=0, salNullBoth=0, salWithUrl=0;
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  salTotal += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','salaries')).count||0);
  salGCC += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','salaries').ilike('data_source','%publicpay%')).count||0);
  salWithUrl += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','salaries').not('source_url','is',null)).count||0);
  salNullBoth += ((await s.from('budgets').select('*',{count:'exact',head:true}).in('municipality_id',chunk).eq('dataset_type','salaries').is('source_url',null).is('data_source',null)).count||0);
}

console.log('=== PHASE 60 CA SALARIES (count-based, full) ===');
console.log('Total CA salary rows:', salTotal);
console.log('With publicpay data_source (GCC provenance):', salGCC);
console.log('With source_url:', salWithUrl);
console.log('NULL both (true gap - must be 0):', salNullBoth);

// Also check distinct data_source values for a sample
const {data: salSample} = await s.from('budgets')
  .select('data_source')
  .eq('dataset_type','salaries')
  .in('municipality_id', allCaIds.slice(0, 100))
  .limit(500);
const distinctDS = [...new Set((salSample||[]).map(r => r.data_source))];
console.log('Distinct data_source values (sample):', distinctDS);

// Non-publicpay CA salary rows
const salOtherGCC = salTotal - salGCC - salNullBoth;
const {count: salOtherWithDS} = await s.from('budgets').select('*',{count:'exact',head:true})
  .in('municipality_id', allCaIds.slice(0, CHUNK))
  .eq('dataset_type','salaries')
  .not('data_source','is',null)
  .not('data_source','ilike','%publicpay%');
console.log('Non-publicpay data_source salary rows (sample chunk):', salOtherWithDS);

console.log('\nCA salary NULL source_url count:', salTotal - salWithUrl);
console.log('Of those, NULL data_source (true gap - must be 0):', salNullBoth);
console.log('Of those, have data_source (non-SCO custom label):', (salTotal - salWithUrl) - salNullBoth);
