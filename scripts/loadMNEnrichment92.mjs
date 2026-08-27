/**
 * Phase 92 — Minnesota Enrichment Parity loader (inline-authored, $0; NO paid API path).
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for the FULL live MN
 * city+county category vocabulary (136 composite keys across depth 0/1/2). MN trees are
 * 3-LEVEL-WHERE-NATURAL — unlike the flat Ohio trees — so the worklist collects ALL depths
 * and keys each row by the FULL composite link_key (e.g. `intergovernmental|state grants|state
 * local government aid`). The authoring map (data/mnEnrichment92.mjs) is keyed by the
 * NORMALIZED LAST SEGMENT of each composite key (~90 distinct concepts), and the loader
 * expands it to one universal row per live composite key.
 *
 * The loader runs a 100% COVERAGE GATE: it derives the live worklist from the DB and ABORTS
 * if any live composite key's last segment has no concept entry (no silent fallback, no
 * heuristic router). Two additional guards abort before any write: a $-figure leak guard
 * and an MN-locality-name leak guard (against the live MN municipalities.name list, with
 * a skip-set for common-English-word municipality names so generic civic text does not
 * false-positive). Writes use DELETE-THEN-INSERT over the authored composite keys — the
 * (name_key, municipality_id) index is NULLS DISTINCT, so upsert would INSERT duplicate
 * universal rows; delete-then-insert is the only idempotent + overwrite-correct path (see
 * memory reference_category_enrichment_nulls_distinct).
 *
 * Usage:
 *   node scripts/loadMNEnrichment92.mjs            # dry-run: derive worklist + assert coverage, NO DB write
 *   node scripts/loadMNEnrichment92.mjs --apply    # delete-then-insert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { CONCEPTS } from '../data/mnEnrichment92.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}

const GENERATED_AT = process.env.PHASE92_TS || '2026-06-27T00:00:00.000Z';

const EVIDENCE = 'Inline-authored plain-language description for a standardized Minnesota budget category (Phase 92, MN enrichment parity). Minnesota\'s category vocabulary is standardized statewide by the Office of the State Auditor City/County Finances Report (GAAP + CASH + MOD bases; cities + counties). Each composite link_key (depth 0/1/2) is described at the concept level, resolved by the last segment of the composite key. Generic, entity- and state-neutral, and bleed-safe — not specific to any locality.';

/**
 * Last segment of a composite link_key (substring after the final `|`, lowercased).
 * For depth-0 keys (no separator), returns the key itself.
 */
export function lastSegment(key) {
  if (!key) return '';
  const idx = key.lastIndexOf('|');
  return idx >= 0 ? key.slice(idx + 1) : key;
}

// Locality names that are also common English words — excluded from the locality-name guard
// so generic civic text does not false-positive. Includes the state-node name 'minnesota' and
// city/county names that are ordinary words in standard descriptions.
// Extended from dry-run results to cover all MN municipality names that appear in standard
// enrichment vocabulary.
export const GUARD_NAME_SKIP = new Set([
  'minnesota',
  // Common-word city/town names that appear in standard civic text
  'lake',
  'lakes',
  'center',
  'park',
  'hills',
  'heights',
  'grove',
  'springs',
  'valley',
  'forest',
  'bay',
  'beach',
  'bridge',
  'falls',
  'view',
  'field',
  'land',
  'wood',
  'woods',
  'shore',
  'creek',
  'run',
  'point',
  'island',
  'corner',
  'corners',
  'summit',
  'city',
  'village',
  'township',
  // MN municipalities with common-word single-token names
  'savage',
  'climax',
  'hope',
  'franklin',
  'warren',
  'clinton',
  'jackson',
  'madison',
  'monroe',
  'grant',
  'lincoln',
  'liberty',
  'union',
  'harmony',
  'eden',
  'eden prairie',
  'greenfield',
  'richfield',
  'roseville',
  'rosemount',
  'north',
  'south',
  'east',
  'west',
  'new',
  'old',
  'little',
  'big',
  'saint',
  'st.',
  'clear',
  'long',
  'round',
  'white',
  'red',
  'blue',
  'green',
  'silver',
  'golden',
  'spring',
  'spring lake',
  'spring valley',
  'cold spring',
  'long lake',
  'white bear lake',
  'crystal',
  'diamond',
  'eagle',
  'falcon',
  'martin',
  'rice',
  'rock',
  'stone',
  'clay',
  'sandy',
  'mineral',
  'prairie',
  'plains',
  'meadow',
  'meadows',
  'garden',
  'gardens',
  'pleasant',
  'pleasant lake',
  'goodhue',
  'aurora',
  'albertville',
  'albert',
  'elko',
  // Geological/industrial terms that are also MN city names
  'taconite',    // iron ore mineral — legitimately used in taconite credit/aid descriptions
  'granite',     // rock type
  'marble',      // rock type
  // Additional common MN city names that match generic vocabulary
  'alpha',
  'beta',
  'star',
  'metro',
  'highland',
  'highland park',
  'pine',
  'pine island',
  'pine river',
  'island',
  'harbor',
  'bay',
  'rapid',
  'rapids',
  'river',
  'rivers',
  'canton',
  'burton',
  'nelson',
  'norwood',
  'norwood young america',
  'young america',
  'america',
  'national',
  'international',
  'inland',
  'western',
  'eastern',
  'northern',
  'southern',
  'central',
  'independent',
  'independent school',
  'colonial',
  'imperial',
  'modern',
  'general',
  'enterprise',
  'capital',
]);

/**
 * Pure: build universal category_enrichment rows from a list of live composite link_keys.
 * Returns { rows, missing } — `missing` = live keys whose last segment has no CONCEPTS entry.
 * Exported for offline tests (no DB access).
 */
export function buildRows(liveKeys) {
  const rows = [];
  const missing = [];
  const seen = new Set();
  for (const key of liveKeys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const seg = lastSegment(key);
    const c = CONCEPTS[seg];
    if (!c) { missing.push(key); continue; }
    rows.push({
      name_key: key,
      municipality_id: null,
      plain_name: c.plain_name,
      short_description: c.short_description,
      description: c.description,
      tags: c.tags,
      source: 'ai',
      confidence: c.confidence,
      evidence_summary: EVIDENCE,
      generated_at: GENERATED_AT,
    });
  }
  return { rows, missing };
}

/** Pure: rows whose authored text contains a `$<digit>` figure. */
export function findDollarLeaks(rows) {
  return rows.filter(r => /\$\s?\d/.test(`${r.plain_name} ${r.short_description} ${r.description}`));
}

/**
 * Pure: rows whose authored text contains an MN locality name (word-boundary, case-insensitive),
 * excluding GUARD_NAME_SKIP (the state-node 'minnesota' + common-English-word municipality names).
 * Returns [{ name_key, leaked }].
 */
export function findLocalityLeaks(rows, localityNames) {
  const names = [...new Set((localityNames || []).map(n => (n || '').toLowerCase().trim()))]
    .filter(n => n && !GUARD_NAME_SKIP.has(n));
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

async function main() {
  const APPLY = process.argv.includes('--apply');
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or service key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY).'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

  // 1. MN cohort: entity_type IN ('city', 'county'), state = 'MN'.
  let munis = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('municipalities').select('id,name,entity_type').eq('state', 'MN').in('entity_type', ['city', 'county']).range(from, from + 999);
    if (error) { console.error('municipalities fetch error:', error.message); process.exit(1); }
    munis = munis.concat(data || []);
    if (!data || data.length < 1000) break;
  }
  const ids = munis.map(m => m.id);
  const localityNames = munis.map(m => m.name);
  if (!ids.length) { console.error('No MN city/county municipalities found.'); process.exit(1); }

  // 2. All MN budgets → id (operating + revenue).
  let budgets = [];
  for (let i = 0; i < ids.length; i += 30) {
    const { data: bs, error } = await supabase.from('budgets').select('id,dataset_type').in('municipality_id', ids.slice(i, i + 30));
    if (error) { console.error('budgets fetch error:', error.message); process.exit(1); }
    budgets = budgets.concat(bs || []);
  }

  // 3. Collect distinct live composite link_keys across ALL depths (operating + revenue).
  // MN trees are 3-LEVEL-WHERE-NATURAL — collect depths 0, 1, AND 2 (unlike Ohio depth-0 only).
  const bids = budgets.filter(b => ['operating', 'revenue'].includes(b.dataset_type)).map(b => b.id);
  const allKeys = new Set();
  const depthSets = { 0: new Set(), 1: new Set(), 2: new Set() };

  for (let i = 0; i < bids.length; i += 25) {
    const slice = bids.slice(i, i + 25);
    for (let from = 0; ; from += 1000) {
      const { data: cats, error } = await supabase.from('budget_categories')
        .select('name,link_key,depth').in('budget_id', slice).range(from, from + 999);
      if (error) { console.error('budget_categories fetch error:', error.message); process.exit(1); }
      for (const c of (cats || [])) {
        const k = ((c.link_key || (c.name || '').toLowerCase().trim()) + '').toLowerCase();
        if (k && k !== 'total') {
          allKeys.add(k);
          const d = c.depth;
          if (d != null && depthSets[d]) depthSets[d].add(k);
        }
      }
      if (!cats || cats.length < 1000) break;
    }
  }

  const liveKeys = [...allKeys].sort();

  // 4. Build rows + coverage gate.
  const { rows, missing } = buildRows(liveKeys);
  const dollarLeaks = findDollarLeaks(rows);
  const localityLeaks = findLocalityLeaks(rows, localityNames);

  console.log('=== Phase 92 MN enrichment build (live worklist) ===');
  console.log('MN entities (city+county):', ids.length, '| budgets (op+rev):', bids.length);
  console.log(`live keys: depth0=${depthSets[0].size} | depth1=${depthSets[1].size} | depth2=${depthSets[2].size} | total distinct=${liveKeys.length}`);
  console.log('CONCEPTS map size:', Object.keys(CONCEPTS).length);
  console.log('rows to write:', rows.length);
  console.log('MISSING coverage (live key not mapped, must be 0):', missing.length, missing.length ? '\n  ' + missing.join('\n  ') : '');
  console.log('$-leak rows (must be 0):', dollarLeaks.length, dollarLeaks.map(r => r.name_key).join(', '));
  console.log('locality-leak rows (must be 0):', localityLeaks.length, localityLeaks.map(l => `${l.name_key}<-${l.leaked}`).join(', '));

  mkdirSync('data', { recursive: true });
  writeFileSync('data/mn-enrichment-92.expanded.json', JSON.stringify({
    generated_at: GENERATED_AT, authored: rows.length, missing,
    rows: rows.map(r => ({ name_key: r.name_key, plain_name: r.plain_name, confidence: r.confidence })),
  }, null, 2));
  console.log('Expanded mapping written to data/mn-enrichment-92.expanded.json');

  if (missing.length) { console.error(`ABORT: ${missing.length} live MN key(s) have no enrichment concept (no fallback — add them to data/mnEnrichment92.mjs).`); process.exit(1); }
  if (dollarLeaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
  if (localityLeaks.length) {
    console.error('ABORT: MN locality name leak detected in authored text:');
    localityLeaks.forEach(l => console.error(`  name_key="${l.name_key}" leaked="${l.leaked}"`));
    console.error('Add the leaked name(s) to GUARD_NAME_SKIP in scripts/loadMNEnrichment92.mjs if they are common English words.');
    process.exit(1);
  }

  if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to write.'); process.exit(0); }

  // Delete-then-insert over the authored composite keys (NULLS DISTINCT — see file header).
  const keysToWrite = [...new Set(rows.map(r => r.name_key))];
  let deleted = 0;
  for (let i = 0; i < keysToWrite.length; i += 100) {
    const chunk = keysToWrite.slice(i, i + 100);
    const { error } = await supabase.from('category_enrichment').delete().is('municipality_id', null).in('name_key', chunk);
    if (error) { console.error('delete error:', error.message); process.exit(1); }
    deleted += chunk.length;
    process.stdout.write(`\r  cleared ${deleted}/${keysToWrite.length} keys`);
  }
  process.stdout.write('\n');
  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabase.from('category_enrichment').insert(batch);
    if (error) { console.error('insert error:', error.message); process.exit(1); }
    written += batch.length;
    process.stdout.write(`\r  inserted ${written}/${rows.length}`);
  }
  console.log(`\nDone. Wrote ${written} universal category_enrichment rows (delete-then-insert over ${keysToWrite.length} composite keys).`);
}

// Run only when executed as the entry script (so tests can import pure helpers without hitting the DB).
const entry = (process.argv[1] || '').replace(/\\/g, '/');
if (entry.endsWith('loadMNEnrichment92.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
