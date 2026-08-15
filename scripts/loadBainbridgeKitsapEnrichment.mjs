#!/usr/bin/env node
/**
 * Task 11 -- Bainbridge Island, WA + Kitsap County, WA category enrichment
 * loader (inline-authored, $0; NO paid API path).
 *
 * Bleed-safe category_enrichment for every depth-0 category loaded for both
 * entities. The worklist is derived LIVE from production -- each entity's
 * loaded `budgets` (operating + revenue) -> their depth-0 `budget_categories`
 * -> the distinct set of `link_key` (fallback: lowercased trimmed `name`) --
 * never a guessed label list, so coverage is provably 100% of what actually
 * loaded. Modelled on scripts/loadSeattleEnrichment.mjs.
 *
 * EVERY ROW IS SCOPED TO A municipality_id, never NULL. A NULL scope makes the
 * row universal and bleeds its text onto every other city in the app -- the
 * defect that once leaked Indiana and California text app-wide. Because these
 * rows are scoped, a plain upsert on (name_key, municipality_id) would be
 * correct; the delete-then-insert used here is the same discipline the Seattle
 * loader uses, so this write path never has to reason about which case it is
 * in, and it keeps the loader idempotent (a second run nets the same rows, no
 * growth).
 *
 * Guards, all BEFORE any write, all fatal:
 *   * coverage -- every live depth-0 key must have authored text, or abort;
 *   * vacuity -- 0 rows resolved for either entity aborts rather than
 *     reporting a cheerful success;
 *   * $-figure leak -- rows are reused across up to 18 fiscal years, so a
 *     hardcoded amount would go stale silently and read as current;
 *   * cross-locality leak -- a Bainbridge row must not name Kitsap County or
 *     any other WA municipality, and vice versa;
 *   * fund-scope caveat -- Task 11 requires the General-Fund-only limitation
 *     to be VISIBLE per entity, so every authored row is asserted to carry it
 *     rather than trusting the author to have remembered.
 *
 * Usage:
 *   node scripts/loadBainbridgeKitsapEnrichment.mjs          # dry-run, no writes
 *   node scripts/loadBainbridgeKitsapEnrichment.mjs --apply  # write both entities
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import {
  BAINBRIDGE_ENRICHMENT, BAINBRIDGE_EXPECTED_KEYS,
  KITSAP_ENRICHMENT, KITSAP_EXPECTED_KEYS,
} from '../data/bainbridgeKitsapEnrichment.mjs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent -- ignore */ }
}

const BAINBRIDGE_ID = '9e7b49a3-8a8c-48b8-897f-28d4bb161fb5';
const KITSAP_ID = 'c35da2c6-c8e6-4f50-85d8-60b02890d3e4';

const GENERATED_AT = process.env.TASK11_TS || new Date().toISOString();
const EVIDENCE =
  'Inline-authored plain-language description for a General Fund budget category of ' +
  'Bainbridge Island / Kitsap County, WA (Task 11, Bainbridge Island + Kitsap County ' +
  'onboarding). Every row is scoped to its entity\'s municipality_id -- never universal -- ' +
  'because the two entities share most category names but the fund-scope caveat differs. ' +
  'The fund-scope statements are read from the entities\' own WA State Auditor filings ' +
  '(Bainbridge FY2025 ARN 1040282; Kitsap FY2024 ARN 1038058), not asserted generally.';

/** The phrase every authored row must carry, so the GF-only limit cannot go missing. */
const CAVEAT_MARKER = 'These figures cover the General Fund only.';

async function writeEnrichment(supabase, muniId, rows, label) {
  if (!rows.length) throw new Error(`Refusing to write 0 enrichment rows for ${label}`);
  const { error: delErr } = await supabase
    .from('category_enrichment').delete().eq('municipality_id', muniId);
  if (delErr) throw new Error(`enrichment delete failed for ${label}: ${delErr.message}`);

  const payload = rows.map(r => ({ ...r, municipality_id: muniId }));
  if (payload.some(r => !r.municipality_id)) {
    throw new Error('An enrichment row has no municipality_id -- a NULL scope bleeds this copy onto every other city.');
  }
  const { error: insErr } = await supabase.from('category_enrichment').insert(payload);
  if (insErr) throw new Error(`enrichment insert failed for ${label}: ${insErr.message}`);
  console.log(`  Wrote ${payload.length} enrichment rows for ${label} (${muniId})`);
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

const textOf = (r) => `${r.plain_name} ${r.short_description} ${r.description}`;

/** Pure: rows whose authored text contains a `$<digit>` figure. */
export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(textOf(r)));
}

/** Pure: rows whose text names a disallowed locality (word-boundary, case-insensitive). */
export function findLocalityLeaks(rows, disallowedNames) {
  const names = [...new Set((disallowedNames || []).map(n => (n || '').toLowerCase().trim()))].filter(Boolean);
  const res = [];
  for (const r of rows) {
    const text = textOf(r).toLowerCase();
    for (const n of names) {
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (re.test(text)) { res.push({ name_key: r.name_key, leaked: n }); break; }
    }
  }
  return res;
}

/** Pure: rows missing the General-Fund-only caveat. */
export function findMissingCaveat(rows) {
  return rows.filter(r => !r.description.includes(CAVEAT_MARKER));
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
        .from('budget_categories').select('name,link_key').in('budget_id', slice).eq('depth', 0).range(from, from + 999);
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
  if (!liveKeys.length) throw new Error(`ABORT: 0 live depth-0 keys found for ${bids.length} ${label} budgets.`);
  const missing = liveKeys.filter(k => !map[k]);
  const stale = expectedKeys.filter(k => !liveKeys.includes(k));
  const rows = liveKeys.filter(k => map[k]).map(k => buildRow(k, map));
  return { muniId, label, bids, liveKeys, missing, stale, rows };
}

async function main() {
  const APPLY = process.argv.includes('--apply');
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or service key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY).');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  if (BAINBRIDGE_ID === KITSAP_ID) { console.error('ABORT: the two entities resolved to the same municipality_id.'); process.exit(1); }

  const biPlan = await buildEntityPlan(supabase, BAINBRIDGE_ID, 'Bainbridge Island', BAINBRIDGE_ENRICHMENT, BAINBRIDGE_EXPECTED_KEYS);
  const kcPlan = await buildEntityPlan(supabase, KITSAP_ID, 'Kitsap County', KITSAP_ENRICHMENT, KITSAP_EXPECTED_KEYS);

  // WA locality names for the cross-bleed guard. entity_type='state' is
  // excluded: "Washington" is stored as a municipalities row too, and factual
  // references to Washington state law are expected, not a locality bleed.
  const { data: waMunis, error: waErr } = await supabase
    .from('municipalities').select('name').eq('state', 'WA').in('entity_type', ['city', 'county']);
  if (waErr) { console.error('WA municipalities fetch error:', waErr.message); process.exit(1); }
  const allWaNames = (waMunis || []).map(m => m.name);
  const biDisallowed = allWaNames.filter(n => n.toLowerCase() !== 'bainbridge island');
  const kcDisallowed = allWaNames.filter(n => n.toLowerCase() !== 'kitsap county');

  const dollarLeaks = [...findDollarLeaks(biPlan.rows), ...findDollarLeaks(kcPlan.rows)];
  const biLocalityLeaks = findLocalityLeaks(biPlan.rows, biDisallowed);
  const kcLocalityLeaks = findLocalityLeaks(kcPlan.rows, kcDisallowed);
  const missingCaveat = [...findMissingCaveat(biPlan.rows), ...findMissingCaveat(kcPlan.rows)];

  console.log('=== Task 11 Bainbridge Island + Kitsap County enrichment build (live worklist) ===');
  for (const plan of [biPlan, kcPlan]) {
    console.log(`\n-- ${plan.label} (municipality_id ${plan.muniId}) --`);
    console.log(`  operating+revenue budgets: ${plan.bids.length}`);
    console.log(`  live depth-0 keys: ${plan.liveKeys.length}`);
    console.log(`  to author: ${plan.rows.length}`);
    console.log(`  stale map keys (authored but not live -- non-fatal): ${plan.stale.length}${plan.stale.length ? ' (' + plan.stale.join(', ') + ')' : ''}`);
    for (const key of plan.liveKeys) {
      if (plan.missing.includes(key)) { console.log(`    [MISSING] ${key}`); continue; }
      console.log(`    [ok] ${key} -> "${(plan.rows.find(r => r.name_key === key) || {}).plain_name}"`);
    }
  }

  console.log('\nGuards (every one must be 0):');
  console.log(`  Bainbridge Island uncovered live keys: ${biPlan.missing.length}${biPlan.missing.length ? ' — ' + biPlan.missing.join(', ') : ''}`);
  console.log(`  Kitsap County uncovered live keys:     ${kcPlan.missing.length}${kcPlan.missing.length ? ' — ' + kcPlan.missing.join(', ') : ''}`);
  console.log(`  $-figure leaks:                        ${dollarLeaks.length}${dollarLeaks.length ? ' — ' + dollarLeaks.map(r => r.name_key).join(', ') : ''}`);
  console.log(`  Bainbridge cross-locality leaks:       ${biLocalityLeaks.length}${biLocalityLeaks.length ? ' — ' + biLocalityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', ') : ''}`);
  console.log(`  Kitsap cross-locality leaks:           ${kcLocalityLeaks.length}${kcLocalityLeaks.length ? ' — ' + kcLocalityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', ') : ''}`);
  console.log(`  rows missing the GF-only caveat:       ${missingCaveat.length}${missingCaveat.length ? ' — ' + missingCaveat.map(r => r.name_key).join(', ') : ''}`);

  if (biPlan.missing.length || kcPlan.missing.length) {
    console.error('ABORT: a live depth-0 key has no authored enrichment -- that category would render bare in the app.');
    process.exit(1);
  }
  if (!biPlan.rows.length || !kcPlan.rows.length) { console.error('ABORT: 0 rows resolved for an entity -- refusing a vacuous success.'); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak in authored text -- it would go stale silently.'); process.exit(1); }
  if (biLocalityLeaks.length || kcLocalityLeaks.length) { console.error('ABORT: cross-locality leak in authored text.'); process.exit(1); }
  if (missingCaveat.length) { console.error('ABORT: a row omits the General-Fund-only limitation, which Task 11 requires to be visible.'); process.exit(1); }

  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to write.'); process.exit(0); }

  await writeEnrichment(supabase, BAINBRIDGE_ID, biPlan.rows, 'Bainbridge Island');
  await writeEnrichment(supabase, KITSAP_ID, kcPlan.rows, 'Kitsap County');

  console.log(`\nDone. Wrote ${biPlan.rows.length} Bainbridge Island + ${kcPlan.rows.length} Kitsap County category_enrichment row(s).`);
}

const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadBainbridgeKitsapEnrichment.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
