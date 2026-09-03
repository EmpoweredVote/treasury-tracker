/**
 * Reconcile the Pennsylvania statewide load against the registry that drove it.
 *
 * NO SHEBANG — kept importable; tests import `expectedKeys` and `digestOf`.
 *
 * Usage:
 *   node scripts/verifyPaStatewideLoad.mjs
 *
 * ── ⚠⚠ RECONCILE BY DIGEST, NOT BY COUNT ───────────────────────────────────
 *
 * A matching total proves nothing: two errors that cancel produce the same
 * number as no errors at all. This computes an md5 over every
 * `<name>|<fiscal_year>|<dataset_type>` the registry says should exist and the
 * same digest over what the database holds, and requires them IDENTICAL.
 *
 * ── WHAT IT ASSERTS ────────────────────────────────────────────────────────
 *
 *   1. DIGEST      intended set == loaded set, member for member.
 *   2. NO EXTRAS   no duplicate entity-year-dataset, the shape a re-run would
 *                  take if the RPC's axis pair were omitted.
 *   3. SCOPE       ⚠ TWO VALUES, PER REPORT: municipal rows carry `all_funds`
 *                  and county rows `total_governmental`, because DCED's
 *                  municipal report folds enterprise activity into its totals
 *                  and its county report does not. Checked per entity, not
 *                  per state.
 *   4. MONTH       every row carries the entity's own month — 1 everywhere
 *                  except Philadelphia, which is 7.
 *   5. GRADE       no PA row claims `compiled_from_audited`. DCED reconciles the
 *                  form to ITSELF ("the ending cash balance agrees to the
 *                  calculated balance"), never to an audited statement, which is
 *                  exactly what earned Florida its higher grade and Pennsylvania
 *                  not.
 *   6. NO ORPHANS  the three pre-sweep entities still hold one row each.
 *
 * ⚠ The paged read orders by the primary key LAST. An unordered `.range()` can
 * repeat and skip rows across pages, and it reports the right TOTAL while doing
 * it — see tests/pagedReadOrdering.test.mjs.
 */

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PA_STATEWIDE_ENTITIES, PA_STATE } from './data/paStatewideEntities.mjs';
import { PA_EXISTING_TT_NAMES } from './data/paNameRules.mjs';
import { SOURCE_PREFIX, BASIS_VALUE, fundScopeFor } from './loadPaDced.mjs';
import { DATASETS } from './loadPaStatewide.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every `<name>|<fy>|<dataset>` the registry intends. */
export function expectedKeys(entities = PA_STATEWIDE_ENTITIES) {
  const keys = [];
  for (const e of entities) {
    for (const y of e.fiscalYears) for (const d of DATASETS) keys.push(`${e.name}|${y}|${d}`);
  }
  return keys.sort();
}

/** md5 over a sorted key list — same input, same digest, anywhere. */
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

  // ⚠ Paged — PA holds 2,620 municipality rows, past the 1,000 PostgREST cap.
  const munis = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('municipalities')
      .select('id, name, entity_type').eq('state', PA_STATE).order('id').range(from, from + 999);
    if (error) throw new Error(`municipalities: ${error.message}`);
    munis.push(...data);
    if (data.length < 1000) break;
  }
  const nameById = new Map(munis.map((m) => [m.id, m.name]));

  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('budgets')
      // ⚠⚠ `total_budget`, NOT `total`. A wrong column name makes PostgREST
      // return an error object and `data` undefined, which reads as "no rows".
      .select('id, municipality_id, fiscal_year, dataset_type, data_source, '
        + 'fiscal_year_start_month, fund_scope, basis, audit_grade, total_budget')
      .like('data_source', `${SOURCE_PREFIX}%`)
      .order('fiscal_year').order('dataset_type').order('id')
      .range(from, from + 999);
    if (error) throw new Error(`budgets: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const byName = new Map(PA_STATEWIDE_ENTITIES.map((e) => [e.name, e]));
  const problems = [];
  const loadedKeys = rows.map((r) => `${nameById.get(r.municipality_id)}|${r.fiscal_year}|${r.dataset_type}`);
  const expected = expectedKeys();

  console.log('\nPennsylvania statewide load — reconciliation');
  console.log(`  PA municipalities:    ${munis.length}`);
  console.log(`  PA DCED rows:         ${rows.length}`);
  console.log(`  registry expects:     ${expected.length}`);

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

  const seen = new Map();
  for (const k of loadedKeys) seen.set(k, (seen.get(k) || 0) + 1);
  for (const [k, c] of seen) if (c > 1) problems.push(`DUPLICATE — ${k} appears ${c} times`);

  let badMonth = 0; let badScope = 0; let badBasis = 0;
  const gradeCounts = new Map();
  const scopeCounts = new Map();
  for (const r of rows) {
    const ent = byName.get(nameById.get(r.municipality_id));
    if (!ent) { problems.push(`row for ${nameById.get(r.municipality_id)} is not in the registry`); continue; }
    if (r.fiscal_year_start_month !== ent.fiscalYearStartMonth) badMonth++;
    // ⚠ Per ENTITY: the two DCED reports have two different scopes.
    if (r.fund_scope !== fundScopeFor(ent)) badScope++;
    if (r.basis !== BASIS_VALUE) badBasis++;
    gradeCounts.set(r.audit_grade, (gradeCounts.get(r.audit_grade) || 0) + 1);
    scopeCounts.set(r.fund_scope, (scopeCounts.get(r.fund_scope) || 0) + 1);
  }
  if (badMonth) problems.push(`${badMonth} row(s) carry a month that is not their entity's`);
  if (badScope) problems.push(`${badScope} row(s) carry the wrong fund_scope for their report`);
  if (badBasis) problems.push(`${badBasis} row(s) do not carry basis ${BASIS_VALUE}`);

  console.log(`  fund scopes:          ${[...scopeCounts].map(([s, c]) => `${s}=${c}`).join(', ')}`);
  console.log(`  audit grades:         ${[...gradeCounts].map(([g, c]) => `${g}=${c}`).join(', ')}`);
  const phila = rows.filter((r) => nameById.get(r.municipality_id) === 'Philadelphia');
  console.log(`  Philadelphia rows:    ${phila.length}, months `
    + `${[...new Set(phila.map((r) => r.fiscal_year_start_month))].join('/')}`);

  // ⚠⚠ Pennsylvania must never claim Florida's grade.
  const overclaimed = rows.filter((r) => r.audit_grade === 'compiled_from_audited');
  if (overclaimed.length) {
    problems.push(`⚠⚠ ${overclaimed.length} PA row(s) claim compiled_from_audited. DCED reconciles the `
      + 'form to ITSELF, never to an audited statement — that grade is Florida\'s, not Pennsylvania\'s.');
  }

  for (const n of PA_EXISTING_TT_NAMES) {
    const hits = munis.filter((m) => m.name === n);
    if (hits.length !== 1) problems.push(`${JSON.stringify(n)} has ${hits.length} municipality rows, expected 1`);
  }

  const zero = rows.filter((r) => Number(r.total_budget) === 0);
  if (zero.length) {
    console.log(`  ⚠ ${zero.length} row(s) carry a total of $0 — legal, but look at them:`);
    for (const r of zero.slice(0, 10)) {
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
