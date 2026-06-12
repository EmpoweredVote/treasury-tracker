#!/usr/bin/env node
/**
 * Federal Enrichment Loader (Phase 46, Plan 02)
 *
 * Pure file→DB: upserts data/federal-enrichment.json into
 * treasury.category_enrichment, scoped to the United States entity.
 * No LLM, no network fetches — the JSON is the reviewable source of record,
 * authored inline under the closed-input rule (see the file's _meta).
 *
 * Usage: node scripts/loadFederalEnrichment.js [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore */ }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

const REQUIRED = ['name_key', 'plain_name', 'short_description', 'description', 'source', 'source_label', 'source_url', 'evidence_summary', 'confidence'];

async function main() {
  const file = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'federal-enrichment.json'), 'utf8'));
  const entries = file.entries ?? [];
  console.log(`federal-enrichment.json: ${entries.length} entries, ${file._skipped?.length ?? 0} documented skips`);

  // Validate before any write
  for (const e of entries) {
    for (const f of REQUIRED) {
      if (!e[f]) throw new Error(`Entry '${e.name_key ?? '?'}' missing required field: ${f}`);
    }
    if (e.confidence === 'low') throw new Error(`Entry '${e.name_key}' has 'low' confidence — never publish (46-CONTEXT standard)`);
    if (e.source !== 'hybrid') throw new Error(`Entry '${e.name_key}' source must be 'hybrid' (official text, condensed)`);
  }
  console.log('Validation: all entries complete, no low-confidence rows.');

  if (dryRun) {
    for (const e of entries) console.log(`  [dry-run] ${e.name_key} ← "${e.plain_name}" (${e.source_label})`);
    return;
  }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: muni, error: muniErr } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (muniErr || !muni) throw new Error('US federal entity not found');

  let loaded = 0;
  for (const e of entries) {
    const row = {
      name_key: e.name_key,
      municipality_id: muni.id, // NEVER universal (Phase 42 lesson)
      plain_name: e.plain_name,
      short_description: e.short_description,
      description: e.description,
      tags: e.tags ?? [],
      source: e.source,
      source_label: e.source_label,
      source_url: e.source_url,
      confidence: e.confidence,
      evidence_summary: e.evidence_summary,
      generated_at: new Date().toISOString(),
    };
    const { error } = await supabase.schema('treasury').from('category_enrichment')
      .upsert(row, { onConflict: 'name_key,municipality_id' });
    if (error) throw new Error(`Upsert '${e.name_key}': ${error.message}`);
    loaded += 1;
    console.log(`  ✓ ${e.name_key}`);
  }

  const { count } = await supabase.schema('treasury').from('category_enrichment')
    .select('id', { count: 'exact', head: true }).eq('municipality_id', muni.id);
  console.log(`Loaded ${loaded} entries. US-scoped enrichment rows in DB: ${count}.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
