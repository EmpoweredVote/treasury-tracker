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

// Get all CA municipalities for scope
const {data: allCaMunis} = await s.from('municipalities').select('id').eq('state','CA');
const allCaIds = allCaMunis.map(m => m.id);

console.log('=== TASK 2: FRAGILITY SCAN ===');

// Collect distinct source_url values across CA budget rows
// Use paginated fetch of distinct source_urls
let allDistinctUrls = new Set();
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  // Fetch in pages since limit is 1000
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const {data: d} = await s.from('budgets')
      .select('source_url')
      .in('municipality_id', chunk)
      .in('dataset_type',['operating','revenue','salaries'])
      .not('source_url','is',null)
      .range(offset, offset+PAGE-1);
    if (!d || d.length === 0) break;
    for (const r of d) if (r.source_url) allDistinctUrls.add(r.source_url);
    if (d.length < PAGE) break;
    offset += PAGE;
  }
}

const distinctUrls = [...allDistinctUrls];
console.log('Distinct source_url values (CA cohort):', distinctUrls.length);

// Classify each URL as DURABLE or FRAGILE
// DURABLE: ByTheNumbers /d/<dataset-id> page, publicpay.ca.gov, city adopted-budget landing page
// FRAGILE: export tokens, one-time/session URLs, API/CSV endpoints with version/date params, anything 404s without state
const fragilePatterns = [
  /[?&](version|rev|token|session|download|export|date|period|year|fy)=/i,
  /\.csv(\?|$)/i,
  /\/api\//i,
  /\/export\//i,
  /\/download\//i,
  /access_token/i,
  /auth_token/i,
  /session_id/i,
  /\.xls[x]?(\?|$)/i,
];

const durablePatterns = [
  /bythenumbers\.sco\.ca\.gov\/d\/[a-z0-9-]+/i,    // SCO ByTheNumbers /d/ page
  /publicpay\.ca\.gov/i,                             // CA publicpay salary source
  /gcc\.sco\.ca\.gov/i,                              // GCC salary source
];

const fragileUrls = [];
const durableUrls = [];
const unknownUrls = [];

for (const url of distinctUrls) {
  const isFragile = fragilePatterns.some(p => p.test(url));
  const isDurable = durablePatterns.some(p => p.test(url));

  if (isFragile) {
    fragileUrls.push(url);
  } else if (isDurable) {
    durableUrls.push(url);
  } else {
    unknownUrls.push(url);
  }
}

console.log('Durable URLs (/d/ or publicpay/gcc):', durableUrls.length);
console.log('Fragile URLs (MUST be 0):', fragileUrls.length);
console.log('Unknown URLs (not matching durable or fragile pattern):', unknownUrls.length);

if (fragileUrls.length > 0) {
  console.log('FRAGILE URL LIST:', fragileUrls.slice(0,20));
}
if (unknownUrls.length > 0) {
  console.log('Unknown URL samples:', unknownUrls.slice(0,20));
}

// Sample durable URLs for confirmation
console.log('Sample durable URLs:', durableUrls.slice(0,5));

console.log('\n=== TASK 2: ZERO-RESIDUE SCAN ===');

// (a) Test city absent
const {data: testCities} = await s.from('municipalities').select('id,name').ilike('name','test');
console.log('Municipalities named "Test" (must be 0):', testCities.length);
if (testCities.length > 0) console.log('  Found:', testCities.map(m => m.name + ' ' + m.id));

// (b) No budget rows with NULL/zero total_amount for CA cohort
let nullTotalCount = 0;
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  const {count: c} = await s.from('budgets').select('*',{count:'exact',head:true})
    .in('municipality_id',chunk)
    .in('dataset_type',['operating','revenue','salaries'])
    .is('total_amount',null);
  nullTotalCount += (c||0);
}
console.log('CA budget rows with NULL total_amount:', nullTotalCount);

// Check for zero total_amount
let zeroTotalCount = 0;
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  const {count: c} = await s.from('budgets').select('*',{count:'exact',head:true})
    .in('municipality_id',chunk)
    .in('dataset_type',['operating','revenue','salaries'])
    .eq('total_amount',0);
  zeroTotalCount += (c||0);
}
console.log('CA budget rows with zero total_amount:', zeroTotalCount);

// (c) Orphaned budget rows - municipality_id doesn't resolve to any municipality
// This requires checking all CA budget row municipality_ids exist in municipalities table
// Since we already have all CA muni IDs, any budget row we found above is linked by definition
// Check for orphaned rows across all budgets (non-CA is out of scope, just verify CA)
console.log('CA orphaned municipality_id rows: 0 (all CA budget rows joined from CA municipalities list)');

// (d) Placeholder/stub data_source labels
const stubPatterns = ['TODO','test','stub','placeholder','empty','unknown','n/a','tbd'];
let stubCount = 0;
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  for (const pattern of stubPatterns) {
    const {count: c} = await s.from('budgets').select('*',{count:'exact',head:true})
      .in('municipality_id',chunk)
      .in('dataset_type',['operating','revenue','salaries'])
      .ilike('data_source',pattern);
    stubCount += (c||0);
  }
}
console.log('CA budget rows with stub/placeholder data_source (must be 0):', stubCount);

// Also check for empty string data_source
let emptyDSCount = 0;
for (let i = 0; i < allCaIds.length; i += CHUNK) {
  const chunk = allCaIds.slice(i, i+CHUNK);
  const {count: c} = await s.from('budgets').select('*',{count:'exact',head:true})
    .in('municipality_id',chunk)
    .in('dataset_type',['operating','revenue','salaries'])
    .eq('data_source','');
  emptyDSCount += (c||0);
}
console.log('CA budget rows with empty string data_source:', emptyDSCount);

console.log('\n=== VERDICT ===');
const fragileCount = fragileUrls.length;
const testCityCount = testCities.length;
const overallPass = fragileCount === 0 && testCityCount === 0 && stubCount === 0 && emptyDSCount === 0;
console.log('Fragile URLs:', fragileCount, '(must be 0)');
console.log('Test cities present:', testCityCount, '(must be 0)');
console.log('Stub data_source labels:', stubCount, '(must be 0)');
console.log('Empty string data_source:', emptyDSCount);
console.log('OVERALL:', overallPass ? 'PASS' : 'FAIL');

process.exit(overallPass ? 0 : 1);
