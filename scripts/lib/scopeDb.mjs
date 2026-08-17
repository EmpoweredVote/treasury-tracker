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
      .select('municipality_id, fiscal_year, dataset_type, period_label, fund_scope, total_budget, data_source')
      .order('municipality_id').order('fiscal_year')
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
