/**
 * Reconcile the South Carolina statewide county load against the workbook that
 * drove it.
 *
 * NO SHEBANG — kept importable; tests import `expectedKeys` and `digestOf`.
 *
 * Usage:
 *   node scripts/verifyScStatewideLoad.mjs
 *
 * ── ⚠⚠ RECONCILE BY DIGEST, NOT BY COUNT ───────────────────────────────────
 *
 * A matching total proves nothing: two errors that cancel produce the same number
 * as no errors at all. This computes an md5 over every
 * `<name>|<fiscal_year>|<dataset_type>` the workbook says should exist and the
 * same digest over what the database holds, and requires them IDENTICAL.
 *
 * ── WHAT IT ASSERTS ────────────────────────────────────────────────────────
 *
 *   1. DIGEST     intended set == loaded set, member for member.
 *   2. NO EXTRAS  no duplicate entity-year-dataset — the shape a re-run would
 *                 take if the RPC's axis pair were omitted.
 *   3. REFUSALS   ⚠⚠ THE CHECK THAT MATTERS MOST HERE. Thirteen county-years are
 *                 refused because the publisher marks them not reported, by an
 *                 asterisk in the column header or an `N` in the `County Info`
 *                 matrix — two signals that CONTRADICT each other, neither a
 *                 superset of the other. Every one of them must be ABSENT from
 *                 the database. Writing a non-reporting year as $0 would render
 *                 a government that filed nothing as a government that collected
 *                 nothing, and before the 2023 edition RFA BACKFILLED such years
 *                 with the prior year's figures — so a $0 here would not even be
 *                 the publisher's own error, it would be ours.
 *   4. SCOPE      every row carries `unknown`, which is DELIBERATE. RFA drops
 *                 utility sales revenue while keeping utility spending, so the
 *                 two money columns are on different scopes by construction.
 *   5. MONTH      every row carries its entity's own federally confirmed month.
 *   6. GRADE      no SC row claims `compiled_from_audited`. South Carolina
 *                 explicitly REFUSES the audit — "We cannot accept financial
 *                 audits as submissions" — which is the cleanest evidence in the
 *                 campaign for `self_reported_unaudited`.
 *   7. NO TWINS   each county holds exactly ONE municipality row.
 *                 `treasury_ensure_municipality` keys on (name, state,
 *                 entity_type), so a drifted name creates a second government
 *                 rather than updating the first.
 *
 * ⚠ The paged read orders by the primary key LAST. An unordered `.range()` can
 * repeat and skip rows across pages while reporting the right TOTAL — it bit
 * three times in one day. See tests/pagedReadOrdering.test.mjs.
 */

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { SC_STATEWIDE_ENTITIES, SC_STATEWIDE_LOAD_WINDOW } from './data/scStatewideEntities.mjs';
import { readFilings, rosterFor, SOURCE_PREFIX, BASIS_VALUE, FUND_SCOPE } from './loadScRfa.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FILE = path.join(ROOT, '_acfr-work/sc/xlsx/ScLgfReport_2024.xlsx');
const SC_STATE = 'SC';
export const DATASETS = ['operating', 'revenue'];

/** md5 over a sorted key list — same input, same digest, anywhere. */
export function digestOf(keys) {
  return createHash('md5').update([...keys].sort().join('\n')).digest('hex');
}

/** `<name>|<fy>|<dataset>` for every filing the workbook says is loadable. */
export function expectedKeys(filings) {
  const keys = [];
  for (const f of filings) for (const d of DATASETS) keys.push(`${f.entity.name}|${f.fiscalYear}|${d}`);
  return keys.sort();
}

/** The same key shape for every entity-year the publisher marks NOT reported. */
export function refusedKeys(refused) {
  const keys = [];
  for (const r of refused) for (const d of DATASETS) keys.push(`${r.entity.name}|${r.fiscalYear}|${d}`);
  return keys.sort();
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

  const { entities, window } = rosterFor({ statewide: true });
  const years = Array.from({ length: window.last - window.first + 1 }, (_, i) => window.first + i);
  const { filings, refused } = await readFilings({ file: DEFAULT_FILE, entities, years });

  const munis = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.schema('treasury').from('municipalities')
      .select('id, name, entity_type').eq('state', SC_STATE).order('id').range(from, from + 999);
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

  // ⚠ Count DISTINCT ids, not rows. A paged read that repeats a page reports the
  // right total while holding the wrong set.
  const distinctIds = new Set(rows.map((r) => r.id)).size;

  const byName = new Map(SC_STATEWIDE_ENTITIES.map((e) => [e.name, e]));
  const problems = [];
  const loadedKeys = rows.map((r) => `${nameById.get(r.municipality_id)}|${r.fiscal_year}|${r.dataset_type}`);
  const expected = expectedKeys(filings);
  const refusedSet = new Set(refusedKeys(refused));

  console.log('\nSouth Carolina statewide county load — reconciliation');
  console.log(`  SC municipality rows: ${munis.length}`);
  console.log(`  SC RFA budget rows:   ${rows.length} (${distinctIds} distinct ids)`);
  console.log(`  workbook expects:     ${expected.length}`);
  console.log(`  publisher refused:    ${refusedSet.size} entity-year-datasets `
    + `(${refused.length} entity-years across ${new Set(refused.map((r) => r.entity.name)).size} counties)`);

  if (rows.length !== distinctIds) {
    problems.push(`PAGED READ REPEATED ROWS — ${rows.length} read but only ${distinctIds} distinct ids`);
  }

  const dbDigest = digestOf(loadedKeys);
  const wantDigest = digestOf(expected);
  console.log(`  digest (database):    ${dbDigest}`);
  console.log(`  digest (workbook):    ${wantDigest}`);
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

  // ⚠⚠ A non-reporting year must be ABSENT, never present as $0.
  const wronglyWritten = loadedKeys.filter((k) => refusedSet.has(k));
  for (const k of wronglyWritten) {
    problems.push(`⚠⚠ REFUSED YEAR WAS WRITTEN — ${k}. The publisher marks it not reported; `
      + 'a $0 here would render a government that filed nothing as one that collected nothing.');
  }

  let badMonth = 0; let badScope = 0; let badBasis = 0;
  const gradeCounts = new Map();
  for (const r of rows) {
    const ent = byName.get(nameById.get(r.municipality_id));
    if (!ent) { problems.push(`row for ${nameById.get(r.municipality_id)} is not in the registry`); continue; }
    if (r.fiscal_year_start_month !== ent.fiscalYearStartMonth) badMonth++;
    if (r.fund_scope !== FUND_SCOPE) badScope++;
    if (r.basis !== BASIS_VALUE) badBasis++;
    gradeCounts.set(r.audit_grade, (gradeCounts.get(r.audit_grade) || 0) + 1);
  }
  if (badMonth) problems.push(`${badMonth} row(s) carry a month that is not their entity's`);
  if (badScope) problems.push(`${badScope} row(s) do not carry fund_scope ${FUND_SCOPE}`);
  if (badBasis) problems.push(`${badBasis} row(s) do not carry basis ${BASIS_VALUE}`);

  console.log(`  audit grades:         ${[...gradeCounts].map(([g, c]) => `${g}=${c}`).join(', ')}`);

  // ⚠⚠ South Carolina must never claim Florida's grade — it REFUSES the audit.
  const overclaimed = rows.filter((r) => r.audit_grade === 'compiled_from_audited');
  if (overclaimed.length) {
    problems.push(`⚠⚠ ${overclaimed.length} SC row(s) claim compiled_from_audited. RFA's own form says `
      + '"We cannot accept financial audits as submissions" — that grade is Florida\'s, not South Carolina\'s.');
  }

  // ⚠⚠ One municipality row per county, or the sweep built a twin.
  for (const e of SC_STATEWIDE_ENTITIES) {
    const hits = munis.filter((m) => m.name === e.name && m.entity_type === e.entityType);
    if (hits.length !== 1) problems.push(`${e.name} has ${hits.length} municipality rows, expected 1`);
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
  console.log('\n  ✅ The loaded set IS the intended set — digests agree, member for member,');
  console.log('     and every publisher-refused county-year is absent rather than $0.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
}
