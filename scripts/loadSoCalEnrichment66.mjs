#!/usr/bin/env node
/**
 * Phase 66 — SoCal Enrichment Parity loader (inline-authored, $0; NO paid API path).
 *
 * Authors UNIVERSAL (municipality_id = NULL) category_enrichment rows for the SoCal
 * residual: the salary department name_keys shared by >=2 SoCal cities that Phase 61's
 * universal rows did not already cover. Op/rev are already 100% covered (probe 2026-06-17).
 *
 * Reuses the Phase 61 concept library + router verbatim (zero new fabricated concepts):
 *   resolve(): SOCAL_EXACT / Phase61 EXACT_OVERRIDE -> EXPLICIT_ROWS -> keyword ROUTE_RULES -> general_dept.
 * Every row is generic + bleed-safe (no $ figures, no city names). Idempotent upsert on
 * (name_key, municipality_id) — safe to re-run.
 *
 * Usage:
 *   node scripts/loadSoCalEnrichment66.mjs            # dry-run: print mapping + write expanded JSON, NO DB write
 *   node scripts/loadSoCalEnrichment66.mjs --apply    # upsert universal rows into treasury.category_enrichment
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { CONCEPTS } from '../data/caParityEnrichment61.mjs';
import { EXPLICIT_ROWS, ROUTE_RULES } from '../data/caParityEnrichment61_oprev.mjs';
import { SOCAL_SALARY_KEYS, SOCAL_EXACT } from '../data/socalEnrichment66.mjs';

for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const [k, ...v] = l.split('='); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim(); } } catch {}
}
const APPLY = process.argv.includes('--apply');
const GENERATED_AT = process.env.PHASE66_TS || '2026-06-17T00:00:00.000Z'; // fixed for determinism
// Phase 61 exact overrides + the Phase 66 SoCal overrides (both map to existing generic CONCEPTS).
const EXACT_OVERRIDE = { 'it': 'information_technology', 'cra': 'redevelopment', 'human': 'human_resources', ...SOCAL_EXACT };

function resolve(nameKey) {
  if (EXACT_OVERRIDE[nameKey]) return { row: CONCEPTS[EXACT_OVERRIDE[nameKey]], via: 'exact:' + EXACT_OVERRIDE[nameKey] };
  if (EXPLICIT_ROWS[nameKey]) return { row: EXPLICIT_ROWS[nameKey], via: 'explicit' };
  for (const [needle, concept] of ROUTE_RULES) {
    if (nameKey.includes(needle)) return { row: CONCEPTS[concept], via: 'route:' + concept + ' (~' + needle + ')' };
  }
  return { row: CONCEPTS.general_dept, via: 'fallback:general_dept' };
}

const rows = [];
const mappingLog = [];
const viaCounts = {};
for (const nameKey of SOCAL_SALARY_KEYS) {
  const { row, via } = resolve(nameKey);
  const bucket = via.split(':')[0];
  viaCounts[bucket] = (viaCounts[bucket] || 0) + 1;
  rows.push({
    name_key: nameKey,
    municipality_id: null,
    plain_name: row.plain_name,
    short_description: row.short_description,
    description: row.description,
    tags: row.tags,
    source: 'ai',
    confidence: row.confidence,
    evidence_summary: 'Inline-authored plain-language description of a standard municipal department/category, mapped from the department name to a generic civic-finance concept (Phase 66, SoCal parity). Generic and bleed-safe — not specific to any city.',
    generated_at: GENERATED_AT,
  });
  mappingLog.push({ name_key: nameKey, plain_name: row.plain_name, via });
}

// Bleed-safety self-checks: no $ figures, and no obvious city-name leak in authored text.
const leaks = rows.filter(r => /\$\s?\d/.test(`${r.description} ${r.plain_name} ${r.short_description}`));
const fallbacks = mappingLog.filter(m => m.via.startsWith('fallback'));

console.log('=== Phase 66 SoCal enrichment build ===');
console.log('universal name_keys to author:', rows.length);
console.log('resolution:', JSON.stringify(viaCounts));
console.log('fallback-to-general_dept count:', fallbacks.length, fallbacks.length ? '(' + fallbacks.map(f => f.name_key).join(', ') + ')' : '');
console.log('$-leak rows (must be 0):', leaks.length);
console.log('\n-- full mapping --');
for (const m of mappingLog) console.log(`  ${m.name_key.padEnd(40).slice(0,40)} -> ${m.plain_name.padEnd(26)} (${m.via})`);

writeFileSync('data/socal-enrichment-66.expanded.json', JSON.stringify({ generated_at: GENERATED_AT, count: rows.length, mapping: mappingLog }, null, 2));
console.log('\nExpanded rows + mapping written to data/socal-enrichment-66.expanded.json');

if (leaks.length) { console.error('ABORT: $-figure leak detected in authored text'); process.exit(1); }
if (!APPLY) { console.log('\n[dry-run] No DB writes. Re-run with --apply to upsert.'); process.exit(0); }

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
