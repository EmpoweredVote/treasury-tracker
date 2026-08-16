#!/usr/bin/env node
/**
 * Task 12 -- WA-CITIES-01 category enrichment loader for Tacoma, Spokane,
 * Vancouver, Bellevue, Kent and Everett (inline-authored, $0; NO paid API path).
 *
 * The worklist is derived LIVE FROM PRODUCTION -- each city's loaded `budgets`
 * (operating + revenue) -> their depth-0 `budget_categories` -> the distinct set
 * of `link_key` (fallback: lowercased trimmed `name`) -- never a guessed label
 * list, so coverage is provably 100% of what actually loaded rather than 100% of
 * what someone remembered to write down.
 *
 * That is not a formality. Deriving this worklist is what surfaced Bellevue's two
 * letter-spaced labels (`Premi ums /contri buti ons`, `Tra ns porta ti on`), which
 * had passed the tie gate, the per-capita band and the re-derivation. They were
 * repaired before this loader was written, so a garbled key never receives copy.
 *
 * EVERY ROW IS SCOPED TO A municipality_id, never NULL. A NULL scope makes the row
 * universal and bleeds its text onto every other city in the app -- the defect
 * that once leaked Indiana and California text app-wide. These six cities share
 * almost every category NAME while their fund-scope caveats differ, so scoping is
 * doing real work here. delete-then-insert per city keeps the write path
 * idempotent and means it never has to reason about the NULLS DISTINCT index.
 *
 * Guards, all BEFORE any write, all fatal:
 *   * coverage      -- every live depth-0 key must have authored text, or abort;
 *   * vacuity       -- 0 rows resolved for ANY city aborts rather than reporting
 *                      a cheerful success;
 *   * $-figure leak -- rows are reused across up to 20 fiscal years, so a
 *                      hardcoded amount would go stale silently and read as
 *                      current;
 *   * cross-locality leak -- a Tacoma row must not name another WA municipality;
 *   * fund-scope caveat -- the General-Fund-only limitation must be VISIBLE on
 *                      every row, asserted rather than trusted to the author;
 *   * era-variant divergence -- two keys of one city that map to the same concept
 *                      must carry IDENTICAL copy, so a reader comparing two
 *                      fiscal years never sees one source described two ways.
 *
 * Usage:
 *   node scripts/loadWaCitiesEnrichment.mjs          # dry-run, no writes
 *   node scripts/loadWaCitiesEnrichment.mjs --apply  # write all six cities
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { getEntity } from './lib/waRoster.mjs';
import {
  TACOMA_ENRICHMENT, TACOMA_EXPECTED_KEYS,
  SPOKANE_ENRICHMENT, SPOKANE_EXPECTED_KEYS,
  VANCOUVER_ENRICHMENT, VANCOUVER_EXPECTED_KEYS,
  BELLEVUE_ENRICHMENT, BELLEVUE_EXPECTED_KEYS,
  KENT_ENRICHMENT, KENT_EXPECTED_KEYS,
  EVERETT_ENRICHMENT, EVERETT_EXPECTED_KEYS,
  CAVEAT_MARKER,
} from '../data/waCitiesEnrichment.mjs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent -- ignore */ }
}

// Ids come from the roster's pinned `expectId`, the same value the loaders and
// all three harnesses assert against, so this file cannot drift to a different
// municipality than the one whose rows it describes.
const CITIES = [
  { name: 'Tacoma', map: TACOMA_ENRICHMENT, expected: TACOMA_EXPECTED_KEYS },
  { name: 'Spokane', map: SPOKANE_ENRICHMENT, expected: SPOKANE_EXPECTED_KEYS },
  { name: 'Vancouver', map: VANCOUVER_ENRICHMENT, expected: VANCOUVER_EXPECTED_KEYS },
  { name: 'Bellevue', map: BELLEVUE_ENRICHMENT, expected: BELLEVUE_EXPECTED_KEYS },
  { name: 'Kent', map: KENT_ENRICHMENT, expected: KENT_EXPECTED_KEYS },
  { name: 'Everett', map: EVERETT_ENRICHMENT, expected: EVERETT_EXPECTED_KEYS },
].map((c) => ({ ...c, id: getEntity(c.name).expectId }));

const GENERATED_AT = process.env.TASK12_TS || new Date().toISOString();
const EVIDENCE =
  'Inline-authored plain-language description for a General Fund budget category of a '
  + 'WA-CITIES-01 city (Task 12: Tacoma, Spokane, Vancouver, Bellevue, Kent, Everett). '
  + 'Every row is scoped to its city\'s municipality_id -- never universal -- because the '
  + 'six cities share almost every category name while their fund-scope caveats differ. '
  + 'Each caveat names that city\'s OWN governmental funds and enterprise funds, read out '
  + 'of that city\'s own WA State Auditor filing (Tacoma FY2024 ARN 1038208; Spokane '
  + 'FY2024 ARN 1038150; Vancouver FY2023 ARN 1035588; Bellevue FY2023 ARN 1035619; Kent '
  + 'FY2024 ARN 1038659; Everett FY2024 ARN 1038217), not asserted generally.';

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
  return rows.filter((r) => /\$\s?\d/.test(textOf(r)));
}

/** Pure: rows whose text names a disallowed locality (word-boundary, case-insensitive). */
export function findLocalityLeaks(rows, disallowedNames) {
  const names = [...new Set((disallowedNames || []).map((n) => (n || '').toLowerCase().trim()))].filter(Boolean);
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
  return rows.filter((r) => !r.description.includes(CAVEAT_MARKER));
}

/**
 * Pure: era-label variants of one line that DISAGREE with each other.
 *
 * When a line renames itself partway through a window, every variant needs a row
 * so every year renders something -- and the copy has to match, or a reader
 * comparing two fiscal years sees one source described two different ways. Rows
 * sharing a plain_name are variants of the same line, so their bodies must be
 * identical.
 */
export function findVariantDivergence(rows) {
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.plain_name)) byName.set(r.plain_name, []);
    byName.get(r.plain_name).push(r);
  }
  const bad = [];
  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const first = group[0];
    for (const r of group.slice(1)) {
      if (r.short_description !== first.short_description || r.description !== first.description) {
        bad.push(`${name}: "${first.name_key}" and "${r.name_key}" carry different copy`);
      }
    }
  }
  return bad;
}

/** Live distinct depth-0 keys for a municipality's operating+revenue budgets. */
async function collectLiveKeys(supabase, muniId, label) {
  const { data: budgets, error: bErr } = await supabase
    .from('budgets').select('id').eq('municipality_id', muniId).in('dataset_type', ['operating', 'revenue']);
  if (bErr) throw new Error(`${label} budgets fetch error: ${bErr.message}`);
  const bids = (budgets || []).map((b) => b.id);
  if (!bids.length) throw new Error(`No ${label} operating/revenue budgets found -- run the budget loader first.`);

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

async function writeEnrichment(supabase, muniId, rows, label) {
  if (!rows.length) throw new Error(`Refusing to write 0 enrichment rows for ${label}`);
  const { error: delErr } = await supabase
    .from('category_enrichment').delete().eq('municipality_id', muniId);
  if (delErr) throw new Error(`enrichment delete failed for ${label}: ${delErr.message}`);

  const payload = rows.map((r) => ({ ...r, municipality_id: muniId }));
  if (payload.some((r) => !r.municipality_id)) {
    throw new Error('An enrichment row has no municipality_id -- a NULL scope bleeds this copy onto every other city.');
  }
  const { error: insErr } = await supabase.from('category_enrichment').insert(payload);
  if (insErr) throw new Error(`enrichment insert failed for ${label}: ${insErr.message}`);
  console.log(`  Wrote ${payload.length} enrichment rows for ${label} (${muniId})`);
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

  const ids = CITIES.map((c) => c.id);
  if (ids.some((i) => !i)) {
    console.error('ABORT: a city has no pinned expectId in the roster -- refusing to guess a municipality_id.');
    process.exit(1);
  }
  if (new Set(ids).size !== ids.length) {
    console.error('ABORT: two cities resolved to the same municipality_id.');
    process.exit(1);
  }

  // The NULL-scoped baseline, captured live. A NULL-scoped row is treated as a
  // universal default, so this number moving means this run bled onto every other
  // city in the app. Printed before and after, never inferred.
  const { count: nullBefore, error: nbErr } = await supabase
    .from('category_enrichment').select('*', { count: 'exact', head: true }).is('municipality_id', null);
  if (nbErr) { console.error('NULL-scope baseline query failed:', nbErr.message); process.exit(1); }

  const plans = [];
  for (const c of CITIES) {
    const { bids, liveKeys } = await collectLiveKeys(supabase, c.id, c.name);
    if (!liveKeys.length) throw new Error(`ABORT: 0 live depth-0 keys for ${bids.length} ${c.name} budgets.`);
    plans.push({
      ...c, bids, liveKeys,
      missing: liveKeys.filter((k) => !c.map[k]),
      stale: c.expected.filter((k) => !liveKeys.includes(k)),
      rows: liveKeys.filter((k) => c.map[k]).map((k) => buildRow(k, c.map)),
    });
  }

  // WA locality names for the cross-bleed guard. entity_type='state' is excluded:
  // "Washington" is stored as a municipalities row too, and factual references to
  // Washington state law are expected, not a locality bleed.
  const { data: waMunis, error: waErr } = await supabase
    .from('municipalities').select('name').eq('state', 'WA').in('entity_type', ['city', 'county']);
  if (waErr) { console.error('WA municipalities fetch error:', waErr.message); process.exit(1); }
  const allWaNames = (waMunis || []).map((m) => m.name);

  console.log('=== Task 12 WA-CITIES-01 enrichment build (live worklist) ===');
  console.log(`NULL-scoped baseline before: ${nullBefore}`);
  let uncovered = 0, vacuous = 0;
  const dollarLeaks = [], localityLeaks = [], missingCaveat = [], variantDivergence = [];
  for (const p of plans) {
    const disallowed = allWaNames.filter((n) => n.toLowerCase() !== p.name.toLowerCase());
    dollarLeaks.push(...findDollarLeaks(p.rows).map((r) => `${p.name}/${r.name_key}`));
    localityLeaks.push(...findLocalityLeaks(p.rows, disallowed).map((l) => `${p.name}/${l.name_key}<-${l.leaked}`));
    missingCaveat.push(...findMissingCaveat(p.rows).map((r) => `${p.name}/${r.name_key}`));
    variantDivergence.push(...findVariantDivergence(p.rows).map((m) => `${p.name}: ${m}`));
    uncovered += p.missing.length;
    if (!p.rows.length) vacuous++;

    console.log(`\n-- ${p.name} (${p.id}) --`);
    console.log(`  operating+revenue budgets: ${p.bids.length}`);
    console.log(`  live depth-0 keys: ${p.liveKeys.length}   to author: ${p.rows.length}`);
    console.log(`  stale map keys (authored but not live -- non-fatal): ${p.stale.length}` +
      `${p.stale.length ? ' (' + p.stale.join(', ') + ')' : ''}`);
    for (const key of p.liveKeys) {
      if (p.missing.includes(key)) { console.log(`    [MISSING] ${key}`); continue; }
      console.log(`    [ok] ${key} -> "${p.rows.find((r) => r.name_key === key).plain_name}"`);
    }
  }

  console.log('\nGuards (every one must be 0):');
  console.log(`  uncovered live keys:              ${uncovered}` +
    `${uncovered ? ' — ' + plans.flatMap((p) => p.missing.map((k) => `${p.name}/${k}`)).join(', ') : ''}`);
  console.log(`  cities resolving to 0 rows:       ${vacuous}`);
  console.log(`  $-figure leaks:                   ${dollarLeaks.length}${dollarLeaks.length ? ' — ' + dollarLeaks.join(', ') : ''}`);
  console.log(`  cross-locality leaks:             ${localityLeaks.length}${localityLeaks.length ? ' — ' + localityLeaks.join(', ') : ''}`);
  console.log(`  rows missing the GF-only caveat:  ${missingCaveat.length}${missingCaveat.length ? ' — ' + missingCaveat.join(', ') : ''}`);
  console.log(`  era-variant copy divergence:      ${variantDivergence.length}${variantDivergence.length ? '\n      • ' + variantDivergence.join('\n      • ') : ''}`);

  if (uncovered) { console.error('ABORT: a live depth-0 key has no authored enrichment -- that category would render bare in the app.'); process.exit(1); }
  if (vacuous) { console.error('ABORT: 0 rows resolved for a city -- refusing a vacuous success.'); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak in authored text -- it would go stale silently.'); process.exit(1); }
  if (localityLeaks.length) { console.error('ABORT: cross-locality leak in authored text.'); process.exit(1); }
  if (missingCaveat.length) { console.error('ABORT: a row omits the General-Fund-only limitation, which Task 12 requires to be visible.'); process.exit(1); }
  if (variantDivergence.length) { console.error('ABORT: era variants of one line carry different copy.'); process.exit(1); }

  const total = plans.reduce((s, p) => s + p.rows.length, 0);
  if (!APPLY) {
    console.log(`\n[dry-run] No DB writes. ${total} row(s) across ${plans.length} cities would be written.`);
    console.log('Re-run with --apply to write.');
    process.exit(0);
  }

  for (const p of plans) await writeEnrichment(supabase, p.id, p.rows, p.name);

  const { count: nullAfter, error: naErr } = await supabase
    .from('category_enrichment').select('*', { count: 'exact', head: true }).is('municipality_id', null);
  if (naErr) { console.error('NULL-scope re-check failed:', naErr.message); process.exit(1); }
  console.log(`\nNULL-scoped count before: ${nullBefore}  after: ${nullAfter}`);
  if (nullAfter !== nullBefore) {
    console.error('ABORT: the NULL-scoped enrichment count MOVED. A NULL-scoped row is universal and bleeds ' +
      'onto every other city in the app -- investigate before trusting this run.');
    process.exit(1);
  }
  console.log(`Done. Wrote ${total} category_enrichment row(s) across ${plans.length} cities, all scoped.`);
}

const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadWaCitiesEnrichment.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
