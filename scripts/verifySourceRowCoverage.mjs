#!/usr/bin/env node
/**
 * npm run verify:source-row-coverage
 *
 * ⚠⚠⚠ Does TT still hold every row its publisher published?
 *
 * Nothing asked this before, and it is how West Hollywood came to hold 143 of
 * 134,643 rows and LA City FY2025 226,909 of 749,295 — roughly $6.06B of
 * spending — with every total tying and every cron run logging `success`.
 * See scripts/lib/rowCoverage.mjs for why this is a registry and not a
 * threshold.
 *
 * ⚠ This gate TALKS TO THE PUBLISHERS. It is the only way to tell "we hold
 * what they have" from "we hold what we happened to keep", and a count query
 * is free on both Socrata hosts. An unreachable publisher is reported, never
 * silently treated as agreement.
 */
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

import { classifyCoverage, isClean } from './lib/rowCoverage.mjs';
import { SOCRATA_ROW_COVERAGE } from './data/socrataRowCoverage.mjs';

// ⚠ Lazy: importing this module must not require credentials, so the tests
// and the --help path work with nothing set.
let _db = null;
function db() {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and a service key are required');
  _db = createClient(url, key);
  return _db;
}

async function publishedCount(baseUrl, datasetId, where) {
  const p = new URLSearchParams({ $select: 'count(*)' });
  if (where) p.set('$where', where);
  try {
    const r = await fetch(`${baseUrl}/resource/${datasetId}.json?${p}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return parseInt(Object.values(d[0] || {})[0] ?? '', 10);
  } catch {
    return null;
  }
}

export async function observe() {
  const { data: sources, error } = await db().schema('treasury')
    .from('data_sources')
    .select('id, name, base_url, dataset_id, dataset_type, api_type, fiscal_years, column_mapping, municipality_id, is_enabled')
    .eq('api_type', 'socrata').eq('dataset_type', 'transactions').eq('is_enabled', true);
  if (error) throw new Error(`listing sources failed: ${error.message}`);

  const observations = [];
  for (const ds of sources) {
    const cm = ds.column_mapping || {};
    const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
    const fyCol = cm.fiscal_year_column || 'fiscal_year';
    for (const fy of ds.fiscal_years || []) {
      const where = skipFy ? '' : `${fyCol}='${fy}'`;

      // ⚠ The budget is resolved the way treasury_sync_transactions resolves
      // it — municipality_id + fiscal_year + dataset_type — NOT by
      // data_source, and never by budgets.data_source_id, which is a dangling
      // reference on these rows.
      const { data: budgets, error: bErr } = await db().schema('treasury')
        .from('budgets').select('id')
        .eq('municipality_id', ds.municipality_id)
        .eq('dataset_type', ds.dataset_type)
        .eq('fiscal_year', fy);
      if (bErr) throw new Error(`budget lookup failed for ${ds.name} FY${fy}: ${bErr.message}`);

      let stored = 0;
      for (const b of budgets || []) {
        const { count, error: cErr } = await db().schema('treasury')
          .from('transactions').select('id', { count: 'exact', head: true })
          .eq('budget_id', b.id);
        if (cErr) throw new Error(`counting ${ds.name} FY${fy} failed: ${cErr.message}`);
        stored += count ?? 0;
      }

      observations.push({
        source: ds.name,
        fiscalYear: fy,
        stored,
        published: await publishedCount(ds.base_url, ds.dataset_id, where),
      });
    }
  }
  return observations;
}

const n = (v) => Number(v).toLocaleString();

async function main() {
  const observations = await observe();
  const r = classifyCoverage(observations, SOCRATA_ROW_COVERAGE);

  const totalStored = observations.reduce((a, o) => a + Number(o.stored || 0), 0);
  console.log(`Socrata transaction budgets evaluated: ${observations.length}`);
  console.log(`Rows held: ${n(totalStored)}`);
  console.log(`Holding exactly what their publisher publishes: ${r.ok.length}`);

  // ⚠ A NOTICE, NOT A FAILURE. The publisher restated and TT kept up; only
  // the recorded baseline is stale. Failing here would turn LA City's weekly
  // append into a weekly red gate, and a gate that cries wolf is not a gate.
  if (r.baselineMoved.length) {
    console.log(`\nℹ️  Baseline moved on ${r.baselineMoved.length} budget(s) — TT matches the publisher, refresh scripts/data/socrataRowCoverage.mjs when convenient:`);
    for (const b of r.baselineMoved) {
      console.log(`  ${b.obs.source} FY${b.obs.fiscalYear}: ${n(b.baseline)} → ${n(b.now)}`);
    }
  }

  if (isClean(r)) {
    console.log('\n✅ Every registered budget holds exactly what its publisher publishes.');
    return 0;
  }

  console.error('\n❌ Row coverage is wrong.\n');
  if (r.duplicates.length) {
    console.error(`Duplicate registry keys (${r.duplicates.length}):`);
    for (const k of r.duplicates) console.error(`  ${k}`);
  }
  if (r.undeclared.length) {
    console.error(`\nUndeclared budgets (${r.undeclared.length}) — add them to scripts/data/socrataRowCoverage.mjs:`);
    for (const o of r.undeclared) {
      console.error(`  ${o.source} FY${o.fiscalYear}: stored ${n(o.stored)}, published ${o.published == null ? 'unreachable' : n(o.published)}`);
    }
  }
  if (r.shortfall.length) {
    console.error(`\n⚠⚠⚠ TT IS DROPPING ROWS (${r.shortfall.length}) — this is the defect this gate exists for:`);
    for (const d of r.shortfall) {
      console.error(`  ${d.obs.source} FY${d.obs.fiscalYear}: holds ${n(d.stored)} of ${n(d.published)} published — ${n(d.missing)} MISSING`);
    }
  }
  if (r.surplus.length) {
    console.error(`\n⚠⚠ TT HOLDS MORE THAN WAS PUBLISHED (${r.surplus.length}) — duplication, or the publisher replaced the dataset and re-minted every :id:`);
    for (const d of r.surplus) {
      console.error(`  ${d.obs.source} FY${d.obs.fiscalYear}: holds ${n(d.stored)} of ${n(d.published)} published — ${n(d.extra)} EXTRA`);
    }
  }
  if (r.unreachable.length) {
    console.error(`\nPublisher unreachable (${r.unreachable.length}) — NOT treated as agreement:`);
    for (const u of r.unreachable) console.error(`  ${u.obs.source} FY${u.obs.fiscalYear}`);
  }
  if (r.stale.length) {
    console.error(`\nStale registry entries (${r.stale.length}) — no such budget any more:`);
    for (const e of r.stale) console.error(`  ${e.source} FY${e.fiscalYear}`);
  }
  return 1;
}

// ⚠ `process.argv[1]` is undefined under `node -e`, and pathToFileURL throws
// on undefined — which turns "imported, not run" into a crash.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => process.exit(c)).catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  });
}
