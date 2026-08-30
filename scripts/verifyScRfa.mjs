/**
 * Verify the loaded South Carolina rows against an INDEPENDENT second reader.
 *
 * NO SHEBANG — kept importable; tests/scRfa.test.mjs may import `compare`.
 *
 * Usage:
 *   python scripts/tools/scRfaSecondReader.py _acfr-work/sc/xls/ScLgfReport_2024.xls \
 *       --out _acfr-work/sc/second-reader.json
 *   node scripts/verifyScRfa.mjs --input _acfr-work/sc/second-reader.json
 *
 * The second reader parses the ORIGINAL BIFF8 .xls with xlrd and a different
 * parentage algorithm; this diffs its totals against what is actually in
 * `treasury.budgets`. Source file -> database, across two implementations and
 * across the .xls -> .xlsx conversion.
 *
 * ⚠ This is the check §5.2 asks for and the one `project_austin_travis_onboarding`
 * demands: a database check that `total = Σ items` is TAUTOLOGICAL. This one is
 * not — nothing here shares code with the loader.
 *
 * ⚠⚠ It still cannot prove SCOPE. Session 5: 11,283 of 11,283 fund checks passed
 * over a $735M scope error, and this session found Horry's Local Option Sales Tax
 * repeating byte-identically across FY2023 and FY2024 while every oracle tied.
 * Read the series as well as running the gate.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { SC_ENTITIES } from './data/scKnightEntities.mjs';
import { SOURCE_PREFIX } from './loadScRfa.mjs';

const TOLERANCE = 0.01;

/** Join the second reader's rows to the database's, by (sheet, fy, dataset). */
export function compare(expected, actual) {
  const byKey = new Map();
  for (const row of actual) byKey.set(`${row.name}|${row.fiscal_year}|${row.dataset_type}`, row);

  const results = [];
  for (const e of expected) {
    const entity = SC_ENTITIES.find((x) => x.sheet === e.sheet);
    if (!entity) throw new Error(`Second reader emitted an unknown sheet: ${e.sheet}`);
    for (const dataset of ['revenue', 'operating']) {
      const key = `${entity.name}|${e.fiscal_year}|${dataset}`;
      const db = byKey.get(key);
      const want = e[dataset];
      const got = db ? Number(db.total_budget) : null;
      const diff = got === null ? null : Math.round((got - want) * 100) / 100;
      results.push({
        key, want, got, diff,
        ok: got !== null && Math.abs(diff) <= TOLERANCE,
        missing: got === null,
      });
    }
  }
  return results;
}

export async function main() {
  const { values } = parseArgs({
    options: { input: { type: 'string', default: '_acfr-work/sc/second-reader.json' } },
  });
  const expected = JSON.parse(readFileSync(values.input, 'utf8'));
  if (!Array.isArray(expected) || expected.length === 0) {
    console.error('REFUSING: the second reader produced nothing to check.');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const db = createClient(url, key);

  // ⚠ Paged reads must order by the PK last (reference_paged_reads_need_total_order).
  const { data, error } = await db.schema('treasury').from('budgets')
    .select('fiscal_year, dataset_type, total_budget::text, municipalities!inner(name, state)')
    .like('data_source', `${SOURCE_PREFIX}%`)
    .order('fiscal_year', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(`Budget read failed: ${error.message}`);

  const actual = data.map((r) => ({
    name: r.municipalities.name,
    fiscal_year: r.fiscal_year,
    dataset_type: r.dataset_type,
    total_budget: r.total_budget,
  }));

  const results = compare(expected, actual);
  const bad = results.filter((r) => !r.ok);

  for (const r of bad) {
    console.log(`  MISMATCH ${r.key}: second reader ${r.want}, database ${r.got} (diff ${r.diff})`);
  }
  console.log(`\nSecond reader vs database: ${results.length - bad.length}/${results.length} exact.`);
  console.log(`Database rows carrying this source: ${actual.length}.`);

  // ⚠⚠ A gate that measured nothing must FAIL, not pass — Florida's zero-row
  // parse counted 0 checks and printed "Oracle green".
  if (results.length === 0) {
    console.error('REFUSING: zero comparisons ran.');
    process.exit(1);
  }
  if (bad.length > 0) { console.error(`REFUSING: ${bad.length} mismatch(es).`); process.exit(1); }
  console.log('✅ every loaded figure reproduces from the original .xls by an independent reader.');
  return results;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('verifyScRfa.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
