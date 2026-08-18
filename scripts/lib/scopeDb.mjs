/**
 * SCOPE-01 harness database access — the only IO the three verify scripts do.
 *
 * NO SHEBANG — see scripts/lib/fundScope.mjs.
 *
 * Split out from scopeVerify.mjs so the detectors stay pure and unit-testable.
 * Read-only: nothing here writes.
 */

let _supabase = null;
export async function getSupabase() {
  if (_supabase) return _supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Missing SUPABASE_SERVICE_KEY (set it in .env).');
    process.exit(1);
  }
  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * Every budgets row with the fields the detectors need, plus the municipality's
 * name/state joined for readable output. Paged — the table is ~80k rows and
 * Supabase caps a single response.
 */
export async function fetchScopeRows(supabase) {
  const munis = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .schema('treasury').from('municipalities')
      .select('id, name, state, entity_type')
      // ⚠ ORDER BY THE PRIMARY KEY, ALWAYS, WHEN PAGING. See fetchScopeRows'
      // note below: this loop had NO ordering at all, which makes LIMIT/OFFSET
      // paging formally undefined. A municipality missed at a page boundary
      // silently becomes name '(unknown)' in every seam report.
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(`fetch municipalities: ${error.message}`);
    if (!data?.length) break;
    for (const m of data) munis.set(m.id, m);
    if (data.length < 1000) break;
  }

  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .schema('treasury').from('budgets')
      // total_budget is cast to text in-query: it is `numeric` in Postgres, and some
      // rows carry more significant digits (e.g. 43283121.249999955, a float sum
      // baked in upstream) than a JS float64 round-trips through PostgREST's JSON
      // encoding without loss. frozenIdDigest hashes this value byte-for-byte
      // against a SQL-computed digest, so a lossy fetch here silently breaks that
      // invariant. Every consumer already does Number(r.total_budget) before doing
      // math with it, so returning a string here changes nothing downstream.
      .select('id, municipality_id, fiscal_year, dataset_type, period_label, fund_scope, basis, reporting_entity, total_budget::text, data_source')
      // ⚠ `.order('id')` IS LOAD-BEARING, NOT COSMETIC.
      //
      // This read `.order('municipality_id').order('fiscal_year')`, which is NOT
      // A TOTAL ORDER: 79,840 of 79,939 rows tie on that key (every city-year has
      // at least an operating and a revenue row). LIMIT/OFFSET paging over a
      // non-total order is undefined — Postgres may break ties differently
      // between the query for page N and the query for page N+1, so a row can be
      // returned TWICE and another skipped entirely.
      //
      // The failure is silent and self-concealing: a duplicate and a miss cancel,
      // so `rows.length` stays exactly right while the row SET is wrong. It cost
      // an investigation on 2026-08-18, when verify-fund-scope.mjs reported
      // "FIGURE DIGEST MOVED" on an unchanged database — the tally was off by
      // exactly one in two buckets, the frozen row count was unchanged at 79,927,
      // and six re-runs plus a registry-vs-stored drift check (0 mismatches) all
      // came back clean. A moved figure digest is the loudest alarm this project
      // has, and it fired on a paging artefact.
      //
      // Sorting by the primary key last makes the order total, so paging is
      // deterministic by construction. Every paged read in this file does it.
      .order('municipality_id').order('fiscal_year').order('id')
      .range(from, from + 999);
    if (error) throw new Error(`fetch budgets: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) {
      const m = munis.get(r.municipality_id);
      rows.push({ ...r, name: m?.name ?? '(unknown)', state: m?.state ?? '', entity_type: m?.entity_type ?? '' });
    }
    if (data.length < 1000) break;
  }
  return rows;
}

/** Bucket tally straight from the table, so a harness never reports a predicted number. */
export function tally(rows) {
  const t = new Map();
  for (const r of rows) {
    if (!t.has(r.fund_scope)) t.set(r.fund_scope, { rows: 0, entities: new Set(), sources: new Set() });
    const g = t.get(r.fund_scope);
    g.rows += 1;
    g.entities.add(r.municipality_id);
    g.sources.add(r.data_source);
  }
  return [...t].map(([scope, g]) => ({
    scope, rows: g.rows, entities: g.entities.size, sources: g.sources.size,
  })).sort((a, b) => b.rows - a.rows);
}
