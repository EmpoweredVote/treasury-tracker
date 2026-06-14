#!/usr/bin/env node
/**
 * Generic County Seed + Link Helper (Phase 52-03, PIPE-01)
 *
 * Seeds a county entity (entity_type='county') for ANY California county and
 * links its member cities via municipalities.county_id — one command, no
 * per-county code. Replaces the per-county scripts/seedLACountyLinks.js pattern.
 *
 * Membership is derived from the SCO ByTheNumbers `county` field (dataset
 * ju3w-4gxp), the SAME source the loader imports from, so the linked city set
 * matches what bulkLoadStateController.js loads for that county.
 *
 * Idempotent + collision-safe:
 *   - reuses an existing county entity (never duplicates it);
 *   - sets county_id only where it is NULL or already points at this county;
 *   - a city already linked to a DIFFERENT county is reported as skipped and is
 *     NOT repointed unless --force is passed.
 *   - linking never touches budget data (D-06): cities kept from other sources
 *     (Anaheim, Santa Ana, LA custom) still get attached to their county.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=... node scripts/seedCountyLinks.js --county "Orange"
 *   SUPABASE_SERVICE_KEY=... node scripts/seedCountyLinks.js --county "Ventura" --dry-run
 *   SUPABASE_SERVICE_KEY=... node scripts/seedCountyLinks.js --county "Orange" --state CA --force
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY env var'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXPENDITURES_DATASET = 'ju3w-4gxp'; // SCO ByTheNumbers expenditures (same source as the loader)
const SOCRATA_HOST = 'https://bythenumbers.sco.ca.gov';

/** Fetch the distinct set of city entity_names the SCO assigns to a county. */
async function fetchCountyCityNames(county) {
  const where = `county='${String(county).replace(/'/g, "''")}'`;
  const params = new URLSearchParams({
    $select: 'entity_name',
    $group: 'entity_name',
    $where: where,
    $limit: '5000',
  });
  const url = `${SOCRATA_HOST}/resource/${EXPENDITURES_DATASET}.json?${params}`;
  console.log(`  Fetching county membership: ${url.substring(0, 130)}...`);
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Socrata ${resp.status}: ${await resp.text()}`);
  const rows = await resp.json();
  // Distinct, trimmed, non-empty entity names.
  const names = [...new Set(rows.map(r => (r.entity_name || '').trim()).filter(Boolean))];
  names.sort();
  return names;
}

async function main() {
  const { values } = parseArgs({
    options: {
      county: { type: 'string', short: 'c' },
      state: { type: 'string', short: 's' },
      'dry-run': { type: 'boolean' },
      force: { type: 'boolean' },
    },
    strict: false,
  });

  const county = values.county;
  const state = (values.state || 'CA').toUpperCase();
  const dryRun = values['dry-run'] ?? false;
  const force = values.force ?? false;

  if (!county) {
    console.error('Usage: node scripts/seedCountyLinks.js --county "<Name>" [--state CA] [--dry-run] [--force]');
    process.exit(1);
  }

  const countyEntityName = `${county} County`;

  console.log('Generic County Seed + Link Helper');
  console.log('─'.repeat(55));
  console.log(`  County: ${county}  (entity: "${countyEntityName}")`);
  console.log(`  State:  ${state}`);
  if (dryRun) console.log('  [DRY RUN] No writes will be performed.');
  if (force) console.log('  [FORCE] Will repoint cities already linked to another county.');
  console.log('');

  // ── Step 1: Ensure the county entity exists (reuse if present) ───────────────
  console.log(`Step 1: County entity "${countyEntityName}" (${state}, entity_type=county)`);

  const { data: existingCounty, error: cErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name')
    .eq('state', state)
    .eq('entity_type', 'county')
    .ilike('name', countyEntityName)
    .maybeSingle();
  if (cErr) { console.error('  County lookup failed:', cErr.message); process.exit(1); }

  let countyId = existingCounty?.id ?? null;

  if (countyId) {
    console.log(`  Reusing existing county entity [${countyId}]`);
  } else if (dryRun) {
    console.log(`  [DRY RUN] Would create county entity "${countyEntityName}"`);
  } else {
    const { data: newId, error: insErr } = await supabase.rpc('treasury_ensure_municipality', {
      p_name: countyEntityName, p_state: state, p_entity_type: 'county', p_population: 0,
    });
    if (insErr) { console.error('  County create failed:', insErr.message); process.exit(1); }
    countyId = newId;
    console.log(`  Created county entity [${countyId}]`);
  }

  // ── Step 2: Derive member city set from the SCO county field ─────────────────
  console.log(`\nStep 2: Member cities from SCO county='${county}'`);
  const cityNames = await fetchCountyCityNames(county);
  if (cityNames.length === 0) {
    console.error(`  No cities found for county='${county}'. Check the county name matches the SCO 'county' field exactly.`);
    process.exit(1);
  }
  console.log(`  ${cityNames.length} entity names returned by SCO for this county.`);

  // ── Step 3: Classify + link existing municipalities ──────────────────────────
  console.log(`\nStep 3: Link cities (county_id → ${countyId ?? '<new county>'})`);

  const { data: munis, error: mErr } = await supabase
    .schema('treasury')
    .from('municipalities')
    .select('id, name, county_id, entity_type')
    .eq('state', state)
    .in('name', cityNames);
  if (mErr) { console.error('  Municipality lookup failed:', mErr.message); process.exit(1); }

  const existingByName = new Map((munis || []).map(m => [m.name.toLowerCase(), m]));

  const toLink = [];        // county_id IS NULL → set
  const alreadyLinked = []; // county_id already == this county
  const linkedElsewhere = [];// county_id points at a different county
  const notInDb = [];       // SCO city not yet a municipality (load it first)

  for (const name of cityNames) {
    const m = existingByName.get(name.toLowerCase());
    if (!m) { notInDb.push(name); continue; }
    if (m.entity_type === 'county') continue; // never link a county to itself
    if (m.county_id === countyId) { alreadyLinked.push(m); continue; }
    if (m.county_id == null) { toLink.push(m); continue; }
    // linked elsewhere
    if (force) { toLink.push(m); } else { linkedElsewhere.push(m); }
  }

  if (!dryRun && countyId) {
    for (const m of toLink) {
      const { error: uErr } = await supabase
        .schema('treasury')
        .from('municipalities')
        .update({ county_id: countyId })
        .eq('id', m.id);
      if (uErr) { console.error(`    Link failed for ${m.name}:`, uErr.message); process.exit(1); }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const verb = dryRun ? 'Would link' : 'Linked';
  console.log('');
  console.log(`  ${verb} (${toLink.length}): ${toLink.map(m => m.name).join(', ') || '(none)'}`);
  console.log(`  Already linked (${alreadyLinked.length}): ${alreadyLinked.map(m => m.name).join(', ') || '(none)'}`);
  console.log(`  Skipped — linked to another county (${linkedElsewhere.length}): ${linkedElsewhere.map(m => m.name).join(', ') || '(none)'}${linkedElsewhere.length && !force ? '  [use --force to repoint]' : ''}`);
  console.log(`  Not yet in DB — load budget first (${notInDb.length}): ${notInDb.join(', ') || '(none)'}`);

  console.log('\n' + '─'.repeat(55));
  console.log(dryRun ? 'Dry run complete — no writes performed.' : `Done. ${toLink.length} cities linked to ${countyEntityName}.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
