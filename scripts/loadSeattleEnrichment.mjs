#!/usr/bin/env node
/**
 * Task 12 -- Seattle, WA + King County, WA category enrichment loader
 * (inline-authored, $0; NO paid API path).
 *
 * Bleed-safe category_enrichment for every depth-0 GF category loaded for
 * Seattle (operating FY2009-FY2025, revenue) and King County (operating +
 * revenue, FY2018-FY2025). The worklist is derived LIVE from production --
 * each entity's loaded `budgets` (operating + revenue) -> their
 * `budget_categories` at depth 0 -> the distinct set of `link_key` (fallback
 * lowercased trimmed `name`) -- not a guessed label list, so coverage is
 * provably 100% of what actually loaded. Modeled on
 * scripts/loadTucsonEnrichment.mjs, with one difference: EVERY row here is
 * scoped to a municipality_id (never NULL/universal), because Seattle and
 * King County share several economic-concept names (e.g. "taxes") and a
 * universal row would be indistinguishable in intent from an entity-specific
 * one -- scoping both means neither entity's copy can bleed onto any other
 * city, and the required per-entity fund-scope caveats + Seattle's FY2018
 * note stay exactly where they belong.
 *
 * Copy source: data/seattleEnrichment.mjs (SEATTLE_ENRICHMENT,
 * KING_COUNTY_ENRICHMENT).
 *
 * Write discipline: DELETE-THEN-INSERT per municipality_id, never upsert.
 * The (name_key, municipality_id) unique index is NULLS DISTINCT; that only
 * matters for NULL-scoped (universal) rows, but delete-then-insert is used
 * unconditionally here anyway, matching the brief's required code exactly,
 * so this loader's write path never has to reason about which case it is in.
 * Idempotent: a second --apply nets the same 12+12 rows (no growth).
 *
 * Guards before any write: a $-figure leak guard (all authored rows) and a
 * cross-locality leak guard (Seattle rows must not mention King County or any
 * other WA municipality; King County rows must not mention Seattle or any
 * other WA municipality).
 *
 * Usage:
 *   node scripts/loadSeattleEnrichment.mjs            # dry-run: derive worklist + assert coverage, NO DB write
 *   node scripts/loadSeattleEnrichment.mjs --apply    # write both entities' rows (delete-then-insert)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { getSeattleId, getKingCountyId } from './seedWashingtonSeattle.js';
import {
  SEATTLE_ENRICHMENT, SEATTLE_EXPECTED_KEYS,
  KING_COUNTY_ENRICHMENT, KING_COUNTY_EXPECTED_KEYS,
} from '../data/seattleEnrichment.mjs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* file absent -- ignore */ }
}

const GENERATED_AT = process.env.TASK12_TS || new Date().toISOString();
const EVIDENCE = 'Inline-authored plain-language description for a Seattle/King County, WA General Fund budget category (Task 12, Seattle + King County onboarding). Every row is scoped to its entity\'s municipality_id -- never universal -- because several category names are shared between the two entities but the fund-scope caveat and era-label notes are entity-specific.';

/**
 * The category_enrichment unique index is NULLS DISTINCT, so an upsert on
 * (name_key, municipality_id) does NOT match an existing row when
 * municipality_id is NULL -- it inserts a duplicate instead of updating.
 * Delete-then-insert is the only write that is correct for both scoped and
 * universal rows, so it is used unconditionally.
 */
async function writeEnrichment(supabase, muniId, rows) {
  if (!rows.length) throw new Error(`Refusing to write 0 enrichment rows for ${muniId}`);
  const { error: delErr } = await supabase
    .from('category_enrichment').delete().eq('municipality_id', muniId);
  if (delErr) throw new Error(`enrichment delete failed: ${delErr.message}`);

  const payload = rows.map(r => ({ ...r, municipality_id: muniId }));
  if (payload.some(r => !r.municipality_id)) {
    throw new Error('An enrichment row has no municipality_id -- a NULL scope bleeds this copy onto every other city.');
  }
  const { error: insErr } = await supabase
    .from('category_enrichment').insert(payload);
  if (insErr) throw new Error(`enrichment insert failed: ${insErr.message}`);
  console.log(`  Wrote ${payload.length} enrichment rows for ${muniId}`);
}

function buildRow(nameKey, map) {
  const c = map[nameKey];
  return {
    name_key: nameKey,
    plain_name: c.plain_name,
    short_description: c.short_description,
    description: c.description,
    tags: c.tags,
    source: 'ai',
    confidence: c.confidence,
    evidence_summary: EVIDENCE,
    generated_at: GENERATED_AT,
  };
}

/** Pure: rows whose authored text contains a `$<digit>` figure. */
export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(`${r.plain_name} ${r.short_description} ${r.description}`));
}

/** Pure: rows whose text mentions a disallowed locality name (word-boundary, case-insensitive). */
export function findLocalityLeaks(rows, disallowedNames) {
  const names = [...new Set((disallowedNames || []).map(n => (n || '').toLowerCase().trim()))].filter(Boolean);
  const res = [];
  for (const r of rows) {
    const text = `${r.plain_name} ${r.short_description} ${r.description}`.toLowerCase();
    for (const n of names) {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (re.test(text)) { res.push({ name_key: r.name_key, leaked: n }); break; }
    }
  }
  return res;
}

/** Live distinct depth-0 link_keys for a municipality's operating+revenue budgets. */
async function collectLiveKeys(supabase, muniId, label) {
  const { data: budgets, error: bErr } = await supabase
    .from('budgets').select('id,dataset_type').eq('municipality_id', muniId).in('dataset_type', ['operating', 'revenue']);
  if (bErr) throw new Error(`${label} budgets fetch error: ${bErr.message}`);
  const bids = (budgets || []).map(b => b.id);
  if (!bids.length) throw new Error(`No ${label} operating/revenue budgets found -- run the loader first.`);

  const keys = new Set();
  for (let i = 0; i < bids.length; i += 25) {
    const slice = bids.slice(i, i + 25);
    for (let from = 0; ; from += 1000) {
      const { data: cats, error } = await supabase
        .from('budget_categories').select('name,link_key').in('budget_id', slice).eq('depth', 0).order('id').range(from, from + 999);
      if (error) throw new Error(`${label} budget_categories fetch error: ${error.message}`);
      for (const c of (cats || [])) {
        const k = (c.link_key || (c.name || '').toLowerCase().trim());
        if (k) keys.add(k);
      }
      if (!cats || cats.length < 1000) break;
    }
  }
  return { bids, liveKeys: [...keys].sort() };
}

async function buildEntityPlan(supabase, muniId, label, map, expectedKeys) {
  const { bids, liveKeys } = await collectLiveKeys(supabase, muniId, label);
  if (!liveKeys.length) {
    throw new Error(`ABORT: 0 live depth-0 budget_categories keys found for ${bids.length} ${label} budgets.`);
  }
  const missing = liveKeys.filter(k => !map[k]);
  const stale = expectedKeys.filter(k => !liveKeys.includes(k)); // map keys no longer live (non-fatal)
  const rows = liveKeys.filter(k => map[k]).map(k => buildRow(k, map));
  return { muniId, label, bids, liveKeys, missing, stale, rows };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or service key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY).'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  const seattleId = await getSeattleId(supabase);
  const kingCountyId = await getKingCountyId(supabase);
  if (seattleId === kingCountyId) { console.error('ABORT: Seattle and King County resolved to the same municipality_id.'); process.exit(1); }

  const seattlePlan = await buildEntityPlan(supabase, seattleId, 'Seattle', SEATTLE_ENRICHMENT, SEATTLE_EXPECTED_KEYS);
  const kcPlan = await buildEntityPlan(supabase, kingCountyId, 'King County', KING_COUNTY_ENRICHMENT, KING_COUNTY_EXPECTED_KEYS);

  // WA locality names, for the cross-bleed guard (a Seattle row must not name
  // King County or any other WA municipality, and vice versa). Excludes
  // entity_type='state' -- "Washington" the state is stored as a
  // municipalities row too, and factual references to "Washington counties"/
  // "Washington state" are expected, not a locality bleed.
  const { data: waMunis, error: waErr } = await supabase.from('municipalities').select('name').eq('state', 'WA').in('entity_type', ['city', 'county']);
  if (waErr) { console.error('WA municipalities fetch error:', waErr.message); process.exit(1); }
  const allWaNames = (waMunis || []).map(m => m.name);
  const seattleDisallowed = allWaNames.filter(n => n.toLowerCase() !== 'seattle');
  const kcDisallowed = allWaNames.filter(n => n.toLowerCase() !== 'king county');

  const allDollarLeaks = [...findDollarLeaks(seattlePlan.rows), ...findDollarLeaks(kcPlan.rows)];
  const seattleLocalityLeaks = findLocalityLeaks(seattlePlan.rows, seattleDisallowed);
  const kcLocalityLeaks = findLocalityLeaks(kcPlan.rows, kcDisallowed);

  console.log('=== Task 12 Seattle + King County enrichment build (live worklist) ===');
  for (const plan of [seattlePlan, kcPlan]) {
    console.log(`\n-- ${plan.label} (municipality_id ${plan.muniId}) --`);
    console.log(`  operating+revenue budgets: ${plan.bids.length}`);
    console.log(`  live depth-0 keys: ${plan.liveKeys.length}`);
    console.log(`  to author: ${plan.rows.length}`);
    console.log(`  stale map keys (in map, not live -- non-fatal): ${plan.stale.length}${plan.stale.length ? ' (' + plan.stale.join(', ') + ')' : ''}`);
    for (const key of plan.liveKeys) {
      if (plan.missing.includes(key)) { console.log(`    [MISSING] ${key}`); continue; }
      console.log(`    [ok] ${key} -> "${(plan.rows.find(r => r.name_key === key) || {}).plain_name}"`);
    }
  }

  console.log('\nMISSING coverage (must be 0 for both entities):');
  console.log(`  Seattle: ${seattlePlan.missing.length}${seattlePlan.missing.length ? '\n    ' + seattlePlan.missing.join('\n    ') : ''}`);
  console.log(`  King County: ${kcPlan.missing.length}${kcPlan.missing.length ? '\n    ' + kcPlan.missing.join('\n    ') : ''}`);
  console.log(`$-leak rows (must be 0): ${allDollarLeaks.length}`, allDollarLeaks.map(r => r.name_key).join(', '));
  console.log(`Seattle cross-locality leaks (must be 0): ${seattleLocalityLeaks.length}`, seattleLocalityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));
  console.log(`King County cross-locality leaks (must be 0): ${kcLocalityLeaks.length}`, kcLocalityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));

  if (seattlePlan.missing.length || kcPlan.missing.length) {
    console.error('ABORT: one or more live depth-0 keys have no enrichment coverage and no map entry.');
    process.exit(1);
  }
  if (!seattlePlan.rows.length || !kcPlan.rows.length) {
    console.error('ABORT: 0 live keys resolved to author for at least one entity -- refusing a vacuous success.');
    process.exit(1);
  }
  if (allDollarLeaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
  if (seattleLocalityLeaks.length || kcLocalityLeaks.length) { console.error('ABORT: cross-locality leak detected in authored text'); process.exit(1); }

  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to write.'); process.exit(0); }

  await writeEnrichment(supabase, seattleId, seattlePlan.rows);
  await writeEnrichment(supabase, kingCountyId, kcPlan.rows);

  console.log(`\nDone. Wrote ${seattlePlan.rows.length} Seattle + ${kcPlan.rows.length} King County category_enrichment row(s).`);
}

const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadSeattleEnrichment.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
