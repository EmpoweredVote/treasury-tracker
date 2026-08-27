/**
 * Sync health report — which data sources are failing, stale, or have never run.
 *
 * The gap this closes: before treasury_log_sync_failure existed (2026-08-27), a
 * sync that failed before reaching its RPC left no trace at all — no sync_logs
 * row, last_error NULL, sync_status 'idle'. San Francisco sat unsynced for three
 * months and every field a human would check said it was fine. The only tell was
 * last_synced_at being far older than the source's own declared frequency, and
 * nothing computed that comparison.
 *
 * This does. See scripts/lib/syncHealth.mjs for the rule; the short version is
 * that absence of an error is not health.
 *
 * ⚠ One query per source for its latest log (N+1). Fine for a filtered run
 * (--api-type socrata is 24 sources); a full run over all ~1,800 sources is slow.
 * Filter unless you actually need everything.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/verifySyncHealth.mjs
 *   node scripts/verifySyncHealth.mjs --api-type socrata
 *   node scripts/verifySyncHealth.mjs --unhealthy-only
 *   node scripts/verifySyncHealth.mjs --fail-on-unhealthy   # exit 1 for CI use
 */

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { classifySyncHealth, isUnhealthy, summarise } from './lib/syncHealth.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const { values } = parseArgs({
  options: {
    'api-type': { type: 'string' },
    'unhealthy-only': { type: 'boolean' },
    'fail-on-unhealthy': { type: 'boolean' },
    limit: { type: 'string' },
  },
  strict: false,
});

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ⚠ treasury_list_sources, NOT treasury_list_source_ids: the latter returns all
  // ~1,800 sources and PostgREST truncates the response at db-max-rows = 1000,
  // alphabetically. A health report built on a truncated list would confidently
  // report "all clear" for sources it never saw — which is the failure mode this
  // script exists to catch.
  const { data: sources, error } = await supabase.rpc('treasury_list_sources', {
    p_api_type: values['api-type'] || null,
    p_dataset_types: null,
  });
  if (error) { console.error('Failed to list sources:', error.message); process.exit(1); }
  if ((sources || []).length === 1000) {
    console.error('Refusing to report: listing returned exactly 1000 rows (PostgREST db-max-rows).');
    process.exit(1);
  }

  const now = new Date();
  const rows = [];
  for (const s of sources || []) {
    const { data: logs } = await supabase
      .schema('treasury')
      .from('sync_logs')
      .select('status, error_message, started_at')
      .eq('data_source_id', s.id)
      .order('started_at', { ascending: false })
      .limit(1);
    const health = classifySyncHealth(s, logs?.[0] || null, now);
    rows.push({ name: s.name, dataset_type: s.dataset_type, freq: s.sync_frequency, ...health });
  }

  rows.sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));
  const shown = values['unhealthy-only'] ? rows.filter((r) => isUnhealthy(r.verdict)) : rows;
  const limit = values.limit ? Number(values.limit) : shown.length;

  console.log(`\nSync health — ${rows.length} source(s)${values['api-type'] ? ` (api_type=${values['api-type']})` : ''}\n`);
  for (const r of shown.slice(0, limit)) {
    console.log(`  [${r.verdict.toUpperCase()}] ${r.name} (${r.dataset_type}, ${r.freq})`);
    if (r.verdict !== 'ok') console.log(`      ${r.reason}`);
  }

  const s = summarise(rows);
  console.log(`\n  ${JSON.stringify(s.byVerdict)}`);
  console.log(`  unhealthy: ${s.unhealthy} of ${s.total}\n`);

  if (values['fail-on-unhealthy'] && s.unhealthy > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
