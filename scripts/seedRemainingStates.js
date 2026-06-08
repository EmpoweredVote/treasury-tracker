#!/usr/bin/env node
/**
 * Bulk State Seeder — 39 remaining states (all except CA, TX, NY, FL, PA, IL, OH, GA, NC, MI)
 *
 * Idempotent: SELECT by name+state before INSERT or UPDATE.
 * Creates municipality rows (entity_type='state') and placeholder data_source rows for
 * both 'operating' and 'revenue' datasets. Process scripts fill in actual data.
 *
 * Usage:
 *   node scripts/seedRemainingStates.js
 *   node scripts/seedRemainingStates.js --dry-run   # print what would be upserted, no DB writes
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs }    from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['../.env.local', '../.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch {}
  }
}
loadEnv();

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } }, strict: false });
const dryRun = opts['dry-run'];

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY && !dryRun) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const supabase = dryRun ? null : createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State definitions ─────────────────────────────────────────────────────────
// pop: 2020 Census. fy_end: fiscal year end. budget_url: official budget office.
const STATES = [
  { name: 'New Jersey',     abbr: 'NJ', pop: 9288994,  fy_end: 'June 30',      budget_url: 'https://www.nj.gov/treasury/omb/' },
  { name: 'Virginia',       abbr: 'VA', pop: 8631393,  fy_end: 'June 30',      budget_url: 'https://www.finance.virginia.gov/budget/' },
  { name: 'Washington',     abbr: 'WA', pop: 7705281,  fy_end: 'June 30',      budget_url: 'https://ofm.wa.gov/budget-fiscal/state-budget' },
  { name: 'Arizona',        abbr: 'AZ', pop: 7151502,  fy_end: 'June 30',      budget_url: 'https://azospb.gov/' },
  { name: 'Massachusetts',  abbr: 'MA', pop: 7029917,  fy_end: 'June 30',      budget_url: 'https://www.mass.gov/orgs/executive-office-for-administration-and-finance' },
  { name: 'Tennessee',      abbr: 'TN', pop: 6910840,  fy_end: 'June 30',      budget_url: 'https://www.tn.gov/finance/budget.html' },
  { name: 'Indiana',        abbr: 'IN', pop: 6785528,  fy_end: 'June 30',      budget_url: 'https://www.in.gov/sba/' },
  { name: 'Missouri',       abbr: 'MO', pop: 6154913,  fy_end: 'June 30',      budget_url: 'https://oa.mo.gov/budget' },
  { name: 'Maryland',       abbr: 'MD', pop: 6177224,  fy_end: 'June 30',      budget_url: 'https://dbm.maryland.gov/' },
  { name: 'Wisconsin',      abbr: 'WI', pop: 5893718,  fy_end: 'June 30',      budget_url: 'https://www.doa.wi.gov/Pages/StateFinances/Budget.aspx' },
  { name: 'Colorado',       abbr: 'CO', pop: 5773714,  fy_end: 'June 30',      budget_url: 'https://leg.colorado.gov/appropriations' },
  { name: 'Minnesota',      abbr: 'MN', pop: 5706494,  fy_end: 'June 30',      budget_url: 'https://www.mn.gov/mmb/' },
  { name: 'South Carolina', abbr: 'SC', pop: 5118425,  fy_end: 'June 30',      budget_url: 'https://www.budget.sc.gov/' },
  { name: 'Alabama',        abbr: 'AL', pop: 5024279,  fy_end: 'September 30', budget_url: 'https://budget.alabama.gov/' },
  { name: 'Louisiana',      abbr: 'LA', pop: 4657757,  fy_end: 'June 30',      budget_url: 'https://www.doa.la.gov/Pages/opb/' },
  { name: 'Kentucky',       abbr: 'KY', pop: 4505836,  fy_end: 'June 30',      budget_url: 'https://osbd.ky.gov/' },
  { name: 'Oregon',         abbr: 'OR', pop: 4237256,  fy_end: 'June 30',      budget_url: 'https://www.oregon.gov/das/budget/' },
  { name: 'Oklahoma',       abbr: 'OK', pop: 3959353,  fy_end: 'June 30',      budget_url: 'https://oklahoma.gov/omes/divisions/budget-and-policy.html' },
  { name: 'Connecticut',    abbr: 'CT', pop: 3605944,  fy_end: 'June 30',      budget_url: 'https://portal.ct.gov/OPM' },
  { name: 'Utah',           abbr: 'UT', pop: 3271616,  fy_end: 'June 30',      budget_url: 'https://gopb.utah.gov/' },
  { name: 'Iowa',           abbr: 'IA', pop: 3190369,  fy_end: 'June 30',      budget_url: 'https://dom.iowa.gov/state-budget' },
  { name: 'Nevada',         abbr: 'NV', pop: 3104614,  fy_end: 'June 30',      budget_url: 'https://budget.nv.gov/' },
  { name: 'Arkansas',       abbr: 'AR', pop: 3011524,  fy_end: 'June 30',      budget_url: 'https://www.dfa.arkansas.gov/' },
  { name: 'Mississippi',    abbr: 'MS', pop: 2961279,  fy_end: 'June 30',      budget_url: 'https://www.mmb.ms.gov/' },
  { name: 'Kansas',         abbr: 'KS', pop: 2937880,  fy_end: 'June 30',      budget_url: 'https://budget.ks.gov/' },
  { name: 'New Mexico',     abbr: 'NM', pop: 2117522,  fy_end: 'June 30',      budget_url: 'https://nmdfa.state.nm.us/' },
  { name: 'Nebraska',       abbr: 'NE', pop: 1961504,  fy_end: 'June 30',      budget_url: 'https://budget.nebraska.gov/' },
  { name: 'Idaho',          abbr: 'ID', pop: 1839106,  fy_end: 'June 30',      budget_url: 'https://dfm.idaho.gov/' },
  { name: 'West Virginia',  abbr: 'WV', pop: 1793716,  fy_end: 'June 30',      budget_url: 'https://budget.wv.gov/' },
  { name: 'Hawaii',         abbr: 'HI', pop: 1455271,  fy_end: 'June 30',      budget_url: 'https://budget.hawaii.gov/' },
  { name: 'New Hampshire',  abbr: 'NH', pop: 1377529,  fy_end: 'June 30',      budget_url: 'https://www.nh.gov/omb/' },
  { name: 'Maine',          abbr: 'ME', pop: 1362359,  fy_end: 'June 30',      budget_url: 'https://www.maine.gov/budget/' },
  { name: 'Rhode Island',   abbr: 'RI', pop: 1097379,  fy_end: 'June 30',      budget_url: 'https://www.omb.ri.gov/' },
  { name: 'Montana',        abbr: 'MT', pop: 1084225,  fy_end: 'June 30',      budget_url: 'https://budget.mt.gov/' },
  { name: 'Delaware',       abbr: 'DE', pop: 989948,   fy_end: 'June 30',      budget_url: 'https://budget.delaware.gov/' },
  { name: 'South Dakota',   abbr: 'SD', pop: 886667,   fy_end: 'June 30',      budget_url: 'https://bfm.sd.gov/' },
  { name: 'North Dakota',   abbr: 'ND', pop: 779094,   fy_end: 'June 30',      budget_url: 'https://www.nd.gov/omb/' },
  { name: 'Alaska',         abbr: 'AK', pop: 733391,   fy_end: 'June 30',      budget_url: 'https://www.omb.alaska.gov/' },
  { name: 'Vermont',        abbr: 'VT', pop: 643077,   fy_end: 'June 30',      budget_url: 'https://finance.vermont.gov/budget' },
  { name: 'Wyoming',        abbr: 'WY', pop: 576851,   fy_end: 'June 30',      budget_url: 'https://ai.wyo.gov/divisions/budget' },
]

// ── DB helpers ────────────────────────────────────────────────────────────────
async function upsertMunicipality(m) {
  const { data: existing } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', m.name).eq('state', m.state).maybeSingle();

  let data, error;
  if (existing?.id) {
    ({ data, error } = await supabase.schema('treasury').from('municipalities')
      .update(m).eq('id', existing.id).select());
    if (!error) console.log(`  updated municipality ${existing.id}`);
  } else {
    ({ data, error } = await supabase.schema('treasury').from('municipalities')
      .insert(m).select());
    if (!error) console.log(`  inserted municipality`);
  }
  if (error) { console.error(`  ERROR: ${error.message}`); process.exit(1); }
  return data[0].id;
}

async function upsertDataSource(src) {
  const { data: existing } = await supabase.schema('treasury').from('data_sources')
    .select('id').eq('name', src.name).maybeSingle();

  let data, error;
  if (existing?.id) {
    ({ data, error } = await supabase.schema('treasury').from('data_sources')
      .update(src).eq('id', existing.id).select());
    if (!error) console.log(`  updated source: ${src.name}`);
  } else {
    ({ data, error } = await supabase.schema('treasury').from('data_sources')
      .insert(src).select());
    if (!error) console.log(`  inserted source: ${src.name}`);
  }
  if (error) { console.error(`  ERROR: ${error.message}`); process.exit(1); }
  return data[0];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding ${STATES.length} remaining states${dryRun ? ' (dry-run)' : ''}...\n`);

  for (const s of STATES) {
    const lc = s.abbr.toLowerCase();
    console.log(`── ${s.name} (${s.abbr}) ────────────────────────────────────`);

    if (dryRun) {
      console.log(`  Would upsert: ${s.name}, ${s.abbr}, pop=${s.pop}, entity_type=state`);
      console.log(`  Would upsert: ${s.name} General Fund Operating Budget`);
      console.log(`  Would upsert: ${s.name} General Fund Revenue`);
      continue;
    }

    const muniId = await upsertMunicipality({
      name:            s.name,
      state:           s.abbr,
      entity_type:     'state',
      population:      s.pop,
      population_year: 2024,
    });

    for (const [dataset_type, dataset_id, label] of [
      ['operating', `${lc}-gf-operating`, `${s.name} General Fund Operating Budget`],
      ['revenue',   `${lc}-gf-revenue`,   `${s.name} General Fund Revenue`],
    ]) {
      await upsertDataSource({
        name:            label,
        api_type:        'pdf_download',   // process scripts update this when loaded
        dataset_type,
        dataset_id,
        base_url:        s.budget_url,
        fiscal_years:    [2022, 2023, 2024, 2025, 2026],
        municipality_id: muniId,
      });
    }

    console.log(`  Done: ${s.name}\n`);
  }

  if (!dryRun) console.log('All states seeded successfully.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(2); });
