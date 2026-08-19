#!/usr/bin/env node
/**
 * SCOPE-03 §3.1 — report every entity of the Longview shape.
 *
 * Logic lives in scripts/lib/seriesShape.mjs (pure); this file is IO + reporting.
 *
 * ⚠ Exits 0 and REPORTS rather than failing. The shape is a known, ruled-on
 * consequence, not a defect: the honest response to a new one is to look at it,
 * not to break a build. A harness that fails on an expected condition is one
 * nobody believes — the exact mistake verify-fund-scope.mjs made after SCOPE-02.
 *
 * Usage:
 *   node scripts/verify-series-shape.mjs
 *   node scripts/verify-series-shape.mjs --json
 */

import { parseArgs } from 'node:util';
import { getSupabase, fetchScopeRows } from './lib/scopeDb.mjs';
import { detectSplitSeriesEntities } from './lib/seriesShape.mjs';

/** Known and ruled on. A name here is expected; anything else wants a look. */
const KNOWN = ['Longview'];

async function main() {
  const { values } = parseArgs({ options: { json: { type: 'boolean', default: false } } });

  const supabase = await getSupabase();
  const rows = await fetchScopeRows(supabase);
  const found = detectSplitSeriesEntities(rows);

  if (values.json) {
    console.log(JSON.stringify({ found, known: KNOWN }, null, 2));
    return;
  }

  console.log(`\nSplit-series entities (SCOPE-03 §3.1): ${found.length}\n`);
  for (const e of found) {
    const flag = KNOWN.includes(e.name) ? '  ' : '⚠ ';
    console.log(`${flag}${e.name}, ${e.state}`);
    for (const [dataset, id] of Object.entries(e.datasets)) {
      console.log(`      ${dataset.padEnd(10)} ${id}`);
    }
  }

  const novel = found.filter((e) => !KNOWN.includes(e.name));
  if (novel.length > 0) {
    console.log(
      `\n⚠ ${novel.length} entity/entities beyond the known list. Each shows one tile `
      + 'where it showed two. Look at them, then either add them to KNOWN or load a '
      + 'source that gives both datasets the same series.\n');
  } else {
    console.log('\nNo entity beyond the known list.\n');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
