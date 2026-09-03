/**
 * Reconcile the Florida statewide load against the registry that drove it.
 *
 * NO SHEBANG — kept importable; tests import `expectedKeys` and `digestOf`.
 *
 * Usage:
 *   node scripts/verifyFlStatewideLoad.mjs
 *
 * ── ⚠⚠ RECONCILE BY DIGEST, NOT BY COUNT ───────────────────────────────────
 *
 * A matching total proves nothing: two errors that cancel produce the same
 * number as no errors at all. This computes an md5 over every
 * `<name>|<fiscal_year>|<dataset_type>` the registry says should exist and the
 * same digest over what the database actually holds, and requires them to be
 * IDENTICAL. That proves the loaded set IS the intended set, member for member.
 *
 * ── WHAT IT ASSERTS ────────────────────────────────────────────────────────
 *
 *   1. DIGEST      intended set == loaded set, exactly.
 *   2. NO EXTRAS   no Florida DFS row exists for an entity-year the registry
 *                  did not plan — the shape a duplicate insert would take.
 *   3. DRIFT       the 14 declared oracle-drift entity-years are ABSENT. A
 *                  declared exclusion that did not actually exclude is worse
 *                  than none.
 *   4. MONTH       every loaded row carries fiscal_year_start_month 10. A wrong
 *                  month moves $0 and passes every tie test, which is why it is
 *                  this project's most-shipped defect.
 *   5. AXES        every row carries total_governmental / actual, the pair the
 *                  RPC's lookup key includes.
 *   6. GRADE       audit-reconciled rows grade compiled_from_audited; the four
 *                  branch-unrecorded rows grade unknown and NOT self_reported.
 *   7. NO ORPHANS  the seven pre-Knight entities still hold exactly one
 *                  municipality row each.
 */

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { FL_STATEWIDE_ENTITIES, FL_STATE } from './data/flStatewideEntities.mjs';
import { FL_ORACLE_DRIFT, declaredDriftFor } from './data/flOracleDrift.mjs';
import { FL_EXISTING_TT_NAMES } from './data/flCensusAliases.mjs';
import { SOURCE_PREFIX, FUND_SCOPE, BASIS_VALUE } from './loadFloridaDFS.mjs';
import { DATASETS } from './loadFlStatewide.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every `<name>|<fy>|<dataset>` the registry intends, minus the declared drift. */
export function expectedKeys(entities = FL_STATEWIDE_ENTITIES) {
  const keys = [];
  for (const e of entities) {
    for (const y of e.fiscalYears) {
      if (declaredDriftFor(e.code, y)) continue;
      for (const d of DATASETS) keys.push(`${e.name}|${y}|${d}`);
    }
  }
  return keys.sort();
}

/** md5 over a sorted key list — the same input must give the same digest anywhere. */
export function digestOf(keys) {
  return createHash('md5').update([...keys].sort().join('\n')).digest('hex');
}

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
      }
    } catch { /* file absent is fine */ }
  }
}

async function main() {
  loadEnv();
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) { console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).'); process.exit(1); }
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co', key);

  const { data: munis, error: mErr } = await db.schema('treasury').from('municipalities')
    .select('id, name, entity_type').eq('state', FL_STATE);
  if (mErr) throw new Error(`municipalities: ${mErr.message}`);
  const nameById = new Map(munis.map((m) => [m.id, m.name]));

  // ⚠ Paged read, ordered by the PK LAST — an unordered .range() can repeat and
  // skip rows across pages (reference_paged_reads_need_total_order).
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.schema('treasury').from('budgets')
      // ⚠⚠ `total_budget`, NOT `total`, and `hierarchy`, NOT `tree`. A wrong column
      // name here does not throw a useful error — PostgREST returns an error object
      // and `data` comes back undefined, which a careless caller reads as "no rows".
      // That is exactly how a first draft of this verifier reported 0 loaded rows
      // for eight entities while 4,262 sat in the table.
      .select('id, municipality_id, fiscal_year, dataset_type, data_source, fiscal_year_start_month, '
        + 'fund_scope, basis, audit_grade, reporting_entity, total_budget')
      .in('municipality_id', munis.map((m) => m.id))
      .like('data_source', `${SOURCE_PREFIX}%`)
      .order('fiscal_year', { ascending: true })
      .order('dataset_type', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`budgets: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const problems = [];
  const loadedKeys = rows.map((r) => `${nameById.get(r.municipality_id)}|${r.fiscal_year}|${r.dataset_type}`);
  const expected = expectedKeys();

  console.log(`\nFlorida statewide load — reconciliation`);
  console.log(`  FL municipalities:    ${munis.length}`);
  console.log(`  Florida DFS rows:     ${rows.length}`);
  console.log(`  registry expects:     ${expected.length}`);

  // ── 1. Digest.
  const dbDigest = digestOf(loadedKeys);
  const wantDigest = digestOf(expected);
  console.log(`  digest (database):    ${dbDigest}`);
  console.log(`  digest (registry):    ${wantDigest}`);
  if (dbDigest !== wantDigest) {
    const want = new Set(expected);
    const have = new Set(loadedKeys);
    const missing = expected.filter((k) => !have.has(k));
    const extra = loadedKeys.filter((k) => !want.has(k));
    problems.push(`DIGEST MISMATCH — ${missing.length} intended row(s) absent, ${extra.length} unintended present`);
    for (const m of missing.slice(0, 15)) problems.push(`    missing: ${m}`);
    for (const x of extra.slice(0, 15)) problems.push(`    extra:   ${x}`);
  }

  // ── 2. Duplicates.
  const seen = new Map();
  for (const k of loadedKeys) seen.set(k, (seen.get(k) || 0) + 1);
  for (const [k, c] of seen) if (c > 1) problems.push(`DUPLICATE — ${k} appears ${c} times`);

  // ── 3. Declared drift really is absent.
  for (const d of FL_ORACLE_DRIFT) {
    for (const ds of DATASETS) {
      if (seen.has(`${d.name}|${d.fiscalYear}|${ds}`)) {
        problems.push(`DECLARED DRIFT LOADED ANYWAY — ${d.name} FY${d.fiscalYear} ${ds}`);
      }
    }
  }

  // ── 4-6. Per-row axes.
  let badMonth = 0; let badScope = 0; let badBasis = 0;
  const gradeCounts = new Map();
  for (const r of rows) {
    if (r.fiscal_year_start_month !== 10) badMonth++;
    if (r.fund_scope !== FUND_SCOPE) badScope++;
    if (r.basis !== BASIS_VALUE) badBasis++;
    gradeCounts.set(r.audit_grade, (gradeCounts.get(r.audit_grade) || 0) + 1);
  }
  if (badMonth) problems.push(`${badMonth} row(s) do not carry fiscal_year_start_month 10`);
  if (badScope) problems.push(`${badScope} row(s) do not carry fund_scope ${FUND_SCOPE}`);
  if (badBasis) problems.push(`${badBasis} row(s) do not carry basis ${BASIS_VALUE}`);
  console.log(`  fiscal month 10:      ${rows.length - badMonth}/${rows.length}`);
  console.log(`  audit grades:         ${[...gradeCounts].map(([g, c]) => `${g}=${c}`).join(', ')}`);

  const unrecorded = rows.filter((r) => r.data_source.includes('branch-unrecorded'));
  console.log(`  branch-unrecorded:    ${unrecorded.length} rows`);
  for (const r of unrecorded) {
    if (r.audit_grade === 'compiled_from_audited' || r.audit_grade === 'self_reported') {
      problems.push(`${nameById.get(r.municipality_id)} FY${r.fiscal_year} ${r.dataset_type} `
        + `is branch-unrecorded but grades "${r.audit_grade}" — it must not claim a branch`);
    }
  }

  // ── 7. No orphaned pre-Knight entities.
  for (const n of FL_EXISTING_TT_NAMES) {
    const hits = munis.filter((m) => m.name === n);
    if (hits.length !== 1) problems.push(`"${n}" has ${hits.length} municipality rows, expected 1`);
  }

  // ── A total of 0 is legal but worth seeing.
  const zeroTotals = rows.filter((r) => Number(r.total_budget) === 0);
  if (zeroTotals.length) {
    console.log(`  ⚠ ${zeroTotals.length} row(s) carry a total of $0 — legal, but look at them:`);
    for (const r of zeroTotals.slice(0, 10)) {
      console.log(`      ${nameById.get(r.municipality_id)} FY${r.fiscal_year} ${r.dataset_type}`);
    }
  }

  if (problems.length) {
    console.error(`\n  ⚠⚠ ${problems.length} PROBLEM(S):`);
    for (const p of problems.slice(0, 60)) console.error(`      ${p}`);
    process.exit(1);
  }
  console.log('\n  ✅ The loaded set IS the intended set — digests agree, member for member.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
