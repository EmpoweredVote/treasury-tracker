#!/usr/bin/env node
/**
 * Give every payment and payroll register the link a reader needs.
 *
 * (Shebang is correct HERE — entry point with a main guard.)
 *
 *   node scripts/citeNonStatementSources.mjs --dry-run    # plan + probe, write nothing
 *   node scripts/citeNonStatementSources.mjs              # write the ones that answered
 *
 * ⚠⚠ IT PROBES BEFORE IT WRITES, AND WRITES ONLY WHAT ANSWERED.
 *
 * A stored `source_url` is a promise to a reader that the link works. Writing
 * 33 addresses out of `data_sources` without asking would hand
 * `verify:source-urls` a fresh backlog and hand readers dead links — the exact
 * defect #370 was built to catch, manufactured by the repair for a different
 * one. So every distinct URL is probed first and only `ok` is written.
 *
 * ⚠ `unreachable` IS NOT WRITTEN EITHER, and that is deliberate but debatable.
 * #373 established that a host refusing an automated client is not a document
 * that is gone, and for an EXISTING citation that reasoning holds. This script
 * is choosing to CREATE a citation, which is a different act: there is no
 * reader relying on it yet, so the honest default is to leave the row linkless
 * and name it rather than publish an address nothing could confirm. Those rows
 * are printed in full so the next pass starts from a list, not a re-survey.
 *
 * ⚠ Writes a direct UPDATE by primary key. It does NOT go through
 * `treasury_sync_city_budget`, which keys on fund_scope+basis and is not
 * source-safe (see scripts/data/... and the sync-city-budget caller test).
 */
import { planCitations } from './lib/nonStatementCitations.mjs';
import { probeUrl, judgeProbe } from './lib/sourceUrlProbe.mjs';
import { curlProbe } from './lib/curlProbe.mjs';
import { paginate } from './lib/listAllSources.mjs';
import { NOT_APPLICABLE_DATASET_TYPES } from './stampNotApplicableGrade.mjs';

const PAGE_SIZE = 1000;

/** Pause between probes so a burst does not look like an attack to one host. */
const PER_PROBE_PAUSE_MS = 400;

async function getClient() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).');
    process.exitCode = 1;
    return null;
  }
  return createClient(url, key);
}

/** ⚠⚠ A paged read needs a total order — this repo has broken that five times. */
async function readRows(client) {
  const rows = await paginate(async (from, to) => {
    const { data, error } = await client.schema('treasury').from('budgets')
      .select('id, data_source, source_url, dataset_type, fiscal_year')
      .in('dataset_type', NOT_APPLICABLE_DATASET_TYPES)
      .order('id').range(from, to);
    if (error) throw new Error(`readRows: ${error.message}`);
    return data ?? [];
  }, PAGE_SIZE);
  const distinct = new Set(rows.map((r) => r.id)).size;
  if (distinct !== rows.length) {
    throw new Error(`PAGING DEFECT: ${rows.length} rows read, ${distinct} distinct ids`);
  }
  return rows;
}

async function readSources(client) {
  const { data, error } = await client.schema('treasury').from('data_sources')
    .select('name, api_type, base_url, dataset_id, dataset_type')
    .in('dataset_type', NOT_APPLICABLE_DATASET_TYPES);
  if (error) throw new Error(`readSources: ${error.message}`);
  return data ?? [];
}

const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const client = await getClient();
  if (!client) return;

  const rows = await readRows(client);
  const sources = await readSources(client);
  console.log(`${rows.length.toLocaleString()} salaries/transactions rows, `
    + `${sources.length} matching data_sources`);

  const plan = planCitations(rows, sources);
  console.log(`  already cited  ${plan.alreadyCited}`);
  console.log(`  to cite        ${plan.writes.length}`);
  console.log(`  unresolvable   ${plan.unresolvable.length}`);

  // ⚠ GROUPED BY FAMILY, NEVER ONE LINE PER ROW. The CA State Controller
  // compensation family alone is 7,682 rows; printing each would bury the
  // handful of distinct reasons under eight thousand identical lines, and an
  // unreadable report is one nobody reads.
  const byReason = new Map();
  for (const u of plan.unresolvable) {
    const key = `${u.data_source}\u0000${u.why}`;
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    const [name, why] = key.split('\u0000');
    console.log(`    ⚠ ${String(n).padStart(5)} row(s)  ${name}`);
    console.log(`              ${why}`);
  }
  if (plan.writes.length === 0) {
    console.log('\nnothing to do.');
    return;
  }

  // ⚠ Probe each DISTINCT url once. LA City Checkbook is one Socrata dataset
  // behind nine fiscal years, so nine rows share one address and asking nine
  // times would only be rude.
  const distinct = [...new Set(plan.writes.map((w) => w.url))];
  console.log(`\nprobing ${distinct.length} distinct URL(s) before writing anything…\n`);

  const verdicts = new Map();
  for (const url of distinct) {
    // ⚠⚠ THE CURL FALLBACK IS NOT OPTIONAL HERE. mckinneytexas.org answers
    // Node's `fetch()` with a flat 403 on its TLS fingerprint, not on anything
    // a header can change. Probing without it reported all nine McKinney
    // registers `unreachable` and would have left them linkless while their
    // citations were perfectly good — the gate reporting on Node, not McKinney.
    const probe = await probeUrl(url, { curlImpl: async (u) => curlProbe(u) });
    const { verdict, detail } = judgeProbe(probe);
    verdicts.set(url, verdict);
    const mark = verdict === 'ok' ? '✅' : '❌';
    console.log(`  ${mark} ${verdict.padEnd(11)} ${probe.status ?? '—'}  ${url.slice(0, 96)}`);
    if (verdict !== 'ok' && detail) console.log(`       ${String(detail).slice(0, 140)}`);
    await sleep(PER_PROBE_PAUSE_MS);
  }

  const writable = plan.writes.filter((w) => verdicts.get(w.url) === 'ok');
  const refused = plan.writes.filter((w) => verdicts.get(w.url) !== 'ok');

  console.log(`\n${writable.length} row(s) will be cited; ${refused.length} left linkless on purpose.`);
  for (const r of refused) {
    console.log(`  ⚠ ${r.data_source} — ${verdicts.get(r.url)}: ${r.url.slice(0, 90)}`);
  }

  if (dryRun) { console.log('\n--dry-run: no writes performed.'); return; }
  if (writable.length === 0) { console.log('\nnothing answered; nothing written.'); return; }

  let written = 0;
  for (const w of writable) {
    const { error } = await client.schema('treasury').from('budgets')
      .update({ source_url: w.url }).eq('id', w.id);
    if (error) throw new Error(`write ${w.id} (${w.data_source}): ${error.message}`);
    written += 1;
  }
  console.log(`\n✅ cited ${written} row(s).`);
}

// ⚠ `process.exitCode`, never `process.exit()` — it races a keep-alive socket
// and exits 127 after printing success.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('citeNonStatementSources.mjs')) {
  main().catch((e) => { console.error(`\n❌ ${e.message}`); process.exitCode = 1; });
}
