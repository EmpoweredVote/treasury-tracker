#!/usr/bin/env node
/**
 * Phase 61 — CA Parity Enrichment loader (inline-authored, $0; NO paid API path).
 *
 * Builds UNIVERSAL category_enrichment rows for the parity-loaded gap set:
 *   - ALL operating + revenue uncovered name_keys
 *   - ALL salaries department name_keys shared by >=2 cities
 * Resolution per name_key: EXPLICIT_ROWS (exact) -> keyword route to a CONCEPT -> general_dept fallback.
 * Dedup by name_key (enrichment join is keyed by name_key + municipality_id, NOT by dataset).
 *
 * Usage:
 *   node scripts/loadCAParityEnrichment61.mjs            # dry-run: print mapping + write expanded JSON, NO DB write
 *   node scripts/loadCAParityEnrichment61.mjs --apply    # upsert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { CONCEPTS } from '../data/caParityEnrichment61.mjs';
import { EXPLICIT_ROWS, ROUTE_RULES } from '../data/caParityEnrichment61_oprev.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}
const APPLY = process.argv.includes('--apply');
const GENERATED_AT = process.env.PHASE61_TS || '2026-06-16T00:00:00.000Z'; // fixed for determinism
const EXACT_OVERRIDE = { 'it': 'information_technology', 'cra': 'redevelopment', 'human': 'human_resources' };

function resolve(nameKey) {
  if (EXPLICIT_ROWS[nameKey]) return { row: EXPLICIT_ROWS[nameKey], via: 'explicit' };
  if (EXACT_OVERRIDE[nameKey]) return { row: CONCEPTS[EXACT_OVERRIDE[nameKey]], via: 'exact:' + EXACT_OVERRIDE[nameKey] };
  for (const [needle, concept] of ROUTE_RULES) {
    if (nameKey.includes(needle)) return { row: CONCEPTS[concept], via: 'route:' + concept + ' (~' + needle + ')' };
  }
  return { row: CONCEPTS.general_dept, via: 'fallback:general_dept' };
}

// Build the name_key universe from the worklist (op all + rev all + salaries>=2)
const wl = JSON.parse(readFileSync('scripts/output/_phase61-worklist.json', 'utf8'));
const universe = new Map(); // name_key -> {datasets:Set, cities:max}
const add = (arr, ds) => { for (const e of arr) { if (!universe.has(e.key)) universe.set(e.key, { datasets: new Set(), cities: 0 }); const u = universe.get(e.key); u.datasets.add(ds); u.cities = Math.max(u.cities, e.cities); } };
add(wl.operating, 'operating');
add(wl.revenue, 'revenue');
add(wl.salaries_ge2, 'salaries');

const rows = [];
const mappingLog = [];
const viaCounts = {};
for (const [nameKey, meta] of universe) {
  const { row, via } = resolve(nameKey);
  viaCounts[via.split(' ')[0].split(':')[0] === 'route' ? 'route' : via.split(':')[0]] = (viaCounts[via.split(':')[0]] || 0) + 1;
  rows.push({
    name_key: nameKey,
    municipality_id: null,
    plain_name: row.plain_name,
    short_description: row.short_description,
    description: row.description,
    tags: row.tags,
    source: 'ai',
    confidence: row.confidence,
    evidence_summary: 'Inline-authored plain-language description of a standard municipal budget category, generated from the category name and general civic-finance knowledge (Phase 61). Generic and bleed-safe — not specific to any city.',
    generated_at: GENERATED_AT,
  });
  mappingLog.push({ name_key: nameKey, cities: meta.cities, datasets: [...meta.datasets], plain_name: row.plain_name, via });
}

// Bleed-safety self-check: no $ figures, no digits-as-amounts in authored text
const leaks = rows.filter(r => /\$\s?\d/.test(r.description + r.plain_name + r.short_description));
const fallbacks = mappingLog.filter(m => m.via.startsWith('fallback'));

console.log('=== Phase 61 enrichment build ===');
console.log('distinct name_keys to author (universal):', rows.length);
console.log('resolution:', JSON.stringify(viaCounts));
console.log('fallback-to-general_dept count:', fallbacks.length);
console.log('$-leak rows (must be 0):', leaks.length);
console.log('\n-- high-frequency mapping spot-check (top 30 by cities) --');
for (const m of [...mappingLog].sort((a, b) => b.cities - a.cities).slice(0, 30)) {
  console.log(`  [${String(m.cities).padStart(3)}] ${m.name_key.padEnd(48).slice(0,48)} -> ${m.plain_name.padEnd(24)} (${m.via})`);
}
console.log('\n-- fallback (general_dept) name_keys --');
console.log(fallbacks.map(m => `${m.name_key} [${m.cities}]`).join(' | ') || '(none)');

writeFileSync('data/ca-parity-enrichment-61.expanded.json', JSON.stringify({ generated_at: GENERATED_AT, count: rows.length, deferred_single_city_salaries: wl.salaries_single_deferred_count, mapping: mappingLog }, null, 2));
console.log('\nExpanded rows + mapping written to data/ca-parity-enrichment-61.expanded.json');

if (leaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }

if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to upsert.'); process.exit(0); }

// ── Apply: upsert universal rows ──
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { db: { schema: 'treasury' } });
let written = 0;
for (let i = 0; i < rows.length; i += 200) {
  const batch = rows.slice(i, i + 200);
  const { error } = await supabase.from('category_enrichment').upsert(batch, { onConflict: 'name_key,municipality_id' });
  if (error) { console.error('upsert error:', error.message); process.exit(1); }
  written += batch.length;
  process.stdout.write(`\r  upserted ${written}/${rows.length}`);
}
console.log(`\nDone. Upserted ${written} universal category_enrichment rows.`);
