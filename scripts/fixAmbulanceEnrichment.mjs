#!/usr/bin/env node
/**
 * Repair the universal `ambulance` category enrichment (follow-up found during v2.20 Phase 136).
 *
 * THE BUG: the universal row for `ambulance` was fire-department text, apparently
 * copied from the `fire` entry and never re-written:
 *
 *   plain_name        "Fire & EMS"
 *   short_description "Firefighting, rescue, and emergency medical response."
 *   description       "Funds fire suppression, rescue, fire prevention/inspection,
 *                      and (in many cities) paramedic and emergency medical
 *                      services. Staffed by firefighters working from
 *                      neighborhood stations..."
 *
 * WHY IT MATTERS: 321 entities across CA, MN and WI carry an `ambulance` category,
 * and 315 of them ALSO carry a separate `fire` category. So for ~98% of consumers
 * the ambulance node was describing a different function — one already explained
 * by its own neighbouring node. A reader comparing Fire against Ambulance was
 * shown fire text twice.
 *
 * THE FIX:
 *   1. Replace the universal row with ambulance/EMS-specific, state-neutral text.
 *      It names the fire/EMS reporting split explicitly, because that split is the
 *      thing the old text obscured.
 *   2. Delete the Dane County scoped override written in Phase 136 (MAD-07). That
 *      override existed ONLY to route around the broken universal row; with the
 *      universal row correct it is redundant, and leaving it would mean Wisconsin
 *      silently stops receiving future improvements to the shared text.
 *
 * `source` becomes 'manual' (an existing value in this table) rather than 'ai':
 * this text is hand-authored, and labelling it 'ai' would misstate where it came
 * from. No source_url — it is a generic definition, not a rendering of one
 * document, and inventing a citation would be worse than having none.
 *
 * Usage:
 *   node scripts/fixAmbulanceEnrichment.mjs            # dry-run
 *   node scripts/fixAmbulanceEnrichment.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const f of ['.env.local', '.env']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const [k, ...v] = l.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* rely on the environment */ }
}

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

export const AMBULANCE_UNIVERSAL = {
  name_key: 'ambulance',
  municipality_id: null,
  plain_name: 'Ambulance & EMS',
  short_description: 'Ambulance and emergency medical services.',
  description: 'Ambulance and emergency medical response — paramedics and EMTs, medical transport, and the vehicles, equipment and dispatch behind them. Where a government reports ambulance separately from fire protection, this line covers the medical side only; one that delivers EMS through its fire department may report little or nothing here, with the cost appearing under fire instead.',
  tags: ['spending', 'public-safety', 'ems', 'ambulance'],
  source: 'manual',
  source_url: null,
  source_label: null,
  confidence: 'high',
  evidence_summary: 'Hand-authored replacement for a universal row that contained fire-department text (plain_name "Fire & EMS", "Staffed by firefighters"), apparently copied from the `fire` entry. 321 entities carry an `ambulance` category and 315 of those also carry a separate `fire` category, so the old text described the wrong function for ~98% of consumers. Corrected 2026-07-27 as a v2.20 follow-up.',
  generated_at: '2026-07-27T00:00:00.000Z',
};

async function main() {
  console.log(`Universal "ambulance" enrichment repair${APPLY ? '' : ' (dry-run)'}\n`);

  const { data: before, error } = await db.from('category_enrichment')
    .select('id, municipality_id, plain_name, description').eq('name_key', 'ambulance');
  if (error) { console.error(`  read failed: ${error.message}`); process.exit(1); }

  const universal = before.filter((r) => r.municipality_id === null);
  const scoped = before.filter((r) => r.municipality_id !== null);
  console.log(`  current: ${universal.length} universal, ${scoped.length} scoped row(s)`);
  for (const u of universal) console.log(`    universal now: "${u.plain_name}" — ${u.description.slice(0, 80)}...`);

  // Identify the Phase 136 WI override to retire (scoped to a WI entity).
  const { data: wiEntities } = await db.from('municipalities')
    .select('id, name').eq('state', 'WI').in('entity_type', ['city', 'county']);
  const wiIds = new Set((wiEntities ?? []).map((m) => m.id));
  const redundant = scoped.filter((r) => wiIds.has(r.municipality_id));
  const foreign = scoped.filter((r) => !wiIds.has(r.municipality_id));
  console.log(`  WI overrides to retire: ${redundant.length}`);
  console.log(`  non-WI scoped rows (left untouched): ${foreign.length}`);
  console.log(`\n  new universal text:\n    "${AMBULANCE_UNIVERSAL.plain_name}" — ${AMBULANCE_UNIVERSAL.short_description}`);

  if (!APPLY) { console.log('\n[dry-run] no writes. Re-run with --apply.'); return; }

  // Delete-then-insert: UNIQUE (name_key, municipality_id) treats NULL as DISTINCT,
  // so an upsert on a NULL municipality_id would duplicate rather than replace.
  const { error: dErr } = await db.from('category_enrichment')
    .delete().eq('name_key', 'ambulance').is('municipality_id', null);
  if (dErr) { console.error(`  universal delete failed: ${dErr.message}`); process.exit(1); }
  const { error: iErr } = await db.from('category_enrichment').insert(AMBULANCE_UNIVERSAL);
  if (iErr) { console.error(`  universal insert failed: ${iErr.message}`); process.exit(1); }
  console.log('\n  universal row replaced.');

  for (const r of redundant) {
    const { error: rErr } = await db.from('category_enrichment').delete().eq('id', r.id);
    if (rErr) { console.error(`  override delete failed: ${rErr.message}`); process.exit(1); }
  }
  console.log(`  retired ${redundant.length} redundant WI override(s).`);

  // Verify from the database.
  const { data: after } = await db.from('category_enrichment')
    .select('municipality_id, plain_name, source').eq('name_key', 'ambulance');
  const uni = after.filter((r) => r.municipality_id === null);
  console.log(`\n  verified: ${uni.length} universal row (expect 1), ${after.length - uni.length} scoped`);
  console.log(`  universal is now: "${uni[0]?.plain_name}" (source=${uni[0]?.source})`);
  if (uni.length !== 1) process.exitCode = 1;
  if (/fire|firefighter/i.test(uni[0]?.plain_name ?? '')) {
    console.error('  STILL fire text in plain_name');
    process.exitCode = 1;
  }

  // Coverage must still hold for the Phase 136 entities after retiring the override.
  for (const m of wiEntities ?? []) {
    const { data: cats } = await db.from('budget_categories')
      .select('name, budgets!inner(municipality_id)').eq('budgets.municipality_id', m.id);
    if (!(cats ?? []).some((c) => c.name.trim().toLowerCase() === 'ambulance')) continue;
    const covered = after.some((r) => r.municipality_id === null || r.municipality_id === m.id);
    console.log(`  ${m.name}: has an 'ambulance' category — covered=${covered}`);
    if (!covered) process.exitCode = 1;
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
