import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SYNC_API_KEY = Deno.env.get("TREASURY_SYNC_API_KEY") || SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let dbSyncKey: string | null = null;
async function getDbSyncKey(): Promise<string> {
  if (!dbSyncKey) { const { data } = await supabase.rpc('treasury_get_sync_key'); dbSyncKey = data || ''; }
  return dbSyncKey;
}
async function checkAuth(req: Request): Promise<boolean> {
  const k = req.headers.get("x-api-key") || "";
  const b = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (k === SYNC_API_KEY || b === SYNC_API_KEY) return true;
  const dbKey = await getDbSyncKey();
  return (k === dbKey || b === dbKey) && dbKey !== '';
}

async function fetchPage(baseUrl: string, did: string, off: number, lim: number, f: Record<string, any>, ord?: string): Promise<any[]> {
  const p = new URLSearchParams();
  p.set("$limit", String(lim)); p.set("$offset", String(off));
  if (ord) p.set("$order", ord); if (f.$where) p.set("$where", f.$where);
  const r = await fetch(`${baseUrl}/resource/${did}.json?${p}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`Socrata ${r.status}`);
  return await r.json();
}
async function fetchAll(baseUrl: string, did: string, f: Record<string, any>, ord?: string): Promise<any[]> {
  let off = 0, all: any[] = [];
  while (true) { const pg = await fetchPage(baseUrl, did, off, 10000, f, ord); all = all.concat(pg); if (pg.length < 10000) break; off += 10000; }
  return all;
}
function amt(v: any): number {
  if (v == null || v === "") return 0; if (typeof v === "number") return v;
  return parseFloat(String(v).replace(/[,$]/g, "").replace(/\((.+)\)/, "-$1")) || 0;
}
/**
 * MIRROR of buildSocrataWhere() in scripts/lib/socrataFilter.mjs. Keep them in step —
 * tests/socrataFilter.test.mjs carries a copy of this function and asserts the two
 * agree case for case.
 *
 * ⚠⚠ This previously ignored `where_extra` and `fiscal_year_type`, both of which
 * scripts/bulkLoadBudget.js has supported for months. San Francisco's whole
 * configuration turns on `where_extra: "AND revenue_or_spending='Spending'"` —
 * dataset xdgd-c79v holds BOTH revenue and spending — so this function fetched
 * both directions at once and built a meaningless tree, making SF structurally
 * unsyncable by cron while the repo script loaded it fine. Los Angeles Operating
 * Budget ("AND adopted_budget_amount > 0") had the same exposure.
 *
 * Precedence: default_filters.$where, then the year predicate (unless
 * skip_fy_filter), then where_extra appended verbatim with its own leading AND.
 */
function buildFyFilter(cm: any, fy: number, defaultFilters: any): Record<string, any> {
  const filters = { ...(defaultFilters || {}) };
  const parts: string[] = [];
  if (filters.$where) parts.push(String(filters.$where).trim());

  const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
  if (!skipFy) {
    const fyCol = cm.fiscal_year_column || 'fiscal_year';
    const isDateField = typeof cm.note === 'string' && cm.note.includes('date field');
    if (isDateField) parts.push(`date_extract_y(${fyCol})=${fy}`);
    // Integer columns must NOT be quoted — e.g. LA Revenue vvm4-a2zu.
    else if (cm.fiscal_year_type === 'integer') parts.push(`${fyCol}=${fy}`);
    else parts.push(`${fyCol}='${fy}'`);
  }

  if (cm.where_extra) {
    // Supplied with its own leading AND; strip it if it is the only predicate.
    parts.push(parts.length === 0
      ? String(cm.where_extra).replace(/^\s*(AND|OR)\s+/i, '').trim()
      : String(cm.where_extra).trim());
  }

  if (parts.length === 0) { delete filters.$where; return filters; }
  filters.$where = parts.reduce((acc, p) =>
    !acc ? p : (/^\s*(AND|OR)\s+/i.test(p) ? `${acc} ${p}` : `${acc} AND ${p}`), '');
  return filters;
}

/**
 * A dataset with no fiscal-year dimension cannot be loaded for more than one year:
 * every year receives the same rows, and `amount_column` on those sources names a
 * single hard-coded year (e.g. `_2018_actuals`), so the same figures too.
 *
 * West Hollywood's FY15-18 budget sources are exactly this — skip_fy_filter with
 * amount_column '_2018_actuals' and fiscal_years [2015,2016,2017,2018] — so a sync
 * over the last two would file FY2018 actuals under FY2017 as well.
 */
function assertSingleYearWhenSkippingFyFilter(ds: any, years: number[]) {
  const cm = ds.column_mapping || {};
  const skipFy = cm.skip_fy_filter === true || cm.skip_fy_filter === 'true';
  if (!skipFy || years.length <= 1) return;
  throw new Error(
    `Refusing to sync ${ds.name}: skip_fy_filter is set (the dataset has no fiscal-year ` +
    `column) but ${years.length} fiscal years were requested (${years.join(', ')}). Every ` +
    `year would be written the same rows` +
    `${cm.amount_column ? `, all read from '${cm.amount_column}'` : ''}. ` +
    `Sync one explicit fiscal year at a time.`);
}

function buildSalaryTree(rows: any[], cm: any) {
  const hCols = cm.hierarchy_columns || ["department", "title"];
  const dm = new Map<string, Map<string, any[]>>();
  for (const r of rows) {
    const d = r[hCols[0]] || "Unknown", t = hCols.length > 1 ? (r[hCols[1]] || "Unknown") : "Staff";
    if (!dm.has(d)) dm.set(d, new Map()); const tm = dm.get(d)!;
    if (!tm.has(t)) tm.set(t, []);
    tm.get(t)!.push({ d: [r[cm.last_name_column], r[cm.first_name_column]].filter(Boolean).join(", ") || t, a: amt(r[cm.amount_column]),
      b: cm.base_pay_column ? amt(r[cm.base_pay_column]) : null, bf: cm.benefits_column ? amt(r[cm.benefits_column]) : null,
      o: cm.overtime_column ? amt(r[cm.overtime_column]) : null, x: cm.other_column ? amt(r[cm.other_column]) : null });
  }
  let total = 0; const tree: any[] = [];
  for (const [dn, tm] of dm) { let da = 0; const c: any[] = [];
    for (const [tn, items] of tm) { const ta = items.reduce((s: number, i: any) => s + i.a, 0); da += ta; c.push({ n: tn, a: ta, i: items }); }
    c.sort((a, b) => b.a - a.a); total += da; tree.push({ n: dn, a: da, c }); }
  tree.sort((a, b) => b.a - a.a); return { tree, total };
}
function buildBudgetTree(rows: any[], cm: any) {
  const hCols = cm.hierarchy_columns || ["department_name", "fund_name", "account_name"];
  const ac = cm.amount_column || "total_budget";
  type N = { a: number; ch: Map<string, N>; rs: any[] };
  const mk = (): N => ({ a: 0, ch: new Map(), rs: [] }); const root = mk();
  let droppedZero = 0;
  for (const r of rows) {
    // ⚠ Drop rows where BOTH the budget and the actual are zero — the same rule
    // scripts/buildBudgetTree.mjs applies. Without it an edge sync of San Francisco
    // would write 23,729 line items where the repo loader writes 7,174, the extra
    // 16,555 being $0 rows that render as real line items. Rows with a zero budget
    // but a non-zero actual are KEPT: Dallas has 125 such rows (blank appropriation,
    // budcurr 0, $880k of expbfy) and they are real spending.
    const approved = amt(r[ac]);
    const actual = cm.actual_amount_column ? amt(r[cm.actual_amount_column]) : 0;
    if (approved === 0 && actual === 0) { droppedZero++; continue; }
    let n = root;
    for (const c of hCols) { const k = r[c] || "Unknown"; if (!n.ch.has(k)) n.ch.set(k, mk()); n = n.ch.get(k)!; }
    n.a += approved; n.rs.push(r);
  }
  if (droppedZero) console.log(`  dropped ${droppedZero} all-zero row(s)`);
  function rc(n: N): number { if (n.ch.size === 0) return n.a; let t = 0; for (const [, c] of n.ch) t += rc(c); n.a = t; return t; } rc(root);
  function tj(n: N): any[] { const a: any[] = []; for (const [nm, ch] of n.ch) { const o: any = { n: nm, a: ch.a };
    // _treasury_insert_tree maps i.aa -> budget_line_items.approved_amount and
    // i.a -> budget_line_items.actual_amount. So when a source declares an explicit
    // actual_amount_column, `a` must read THAT, not the rollup amount_column —
    // otherwise actual_amount silently comes back equal to the budget, i.e. the row
    // claims the city spent its appropriation to the cent. Sources with no
    // actual_amount_column keep the previous fallback.
    // aa -> approved_amount, a -> actual_amount (see _treasury_insert_tree).
    //   approved := approved_amount_column ?? amount_column — for a budget dataset the
    //     rollup amount IS the approved figure, and without this fallback a source
    //     configured with only amount_column (LA Open Budget Appropriations) loses its
    //     money at the line-item level entirely: both columns NULL.
    //   actual   := actual_amount_column ?? NULL — never the budget. Falling back to the
    //     rollup amount made every row claim the city spent its appropriation to the
    //     cent, which is the bug PR #83 shipped and then had to undo for Dallas.
    if (ch.ch.size === 0 && ch.rs.length > 0) { o.i = ch.rs.map(r => ({ d: r[cm.description_column] || nm,
      a: cm.actual_amount_column ? amt(r[cm.actual_amount_column]) : null,
      aa: cm.approved_amount_column ? amt(r[cm.approved_amount_column]) : amt(r[ac]), f: cm.fund_column ? r[cm.fund_column] : null, e: cm.expense_type_column ? r[cm.expense_type_column] : null })); }
    else if (ch.ch.size > 0) o.c = tj(ch); a.push(o); } a.sort((x, y) => y.a - x.a); return a; }
  return { tree: tj(root), total: root.a };
}

/**
 * Record a failure that happened BEFORE one of the treasury_sync_* RPCs ran.
 *
 * Those RPCs are what write sync_logs, so until this existed every pre-RPC
 * failure — a Socrata 4xx, a timeout, the zero-total abort below, a bad
 * column_mapping — left NO trace at all: no sync_logs row, last_error NULL,
 * sync_status 'idle', last_synced_at unchanged. The source looked healthy and
 * merely old, which is how San Francisco sat on 2026-05-23 data for three
 * months without anything reporting a problem.
 *
 * Never allowed to throw: an error path that can itself fail turns a loud
 * failure back into a silent one.
 */
async function logFailure(dsId: string, fy: number | null, err: string, stage: string,
                          rowsFetched = 0, triggeredBy = 'manual', status = 'error') {
  try {
    const { error } = await supabase.rpc('treasury_log_sync_failure', {
      p_data_source_id: dsId, p_fiscal_year: fy, p_error: err, p_stage: stage,
      p_rows_fetched: rowsFetched, p_triggered_by: triggeredBy, p_status: status,
    });
    if (error) console.error(`could not record ${stage} failure: ${error.message}`);
  } catch (e) {
    console.error(`could not record ${stage} failure: ${e?.message}`);
  }
}

/**
 * Guard against silently persisting an all-zero budget.
 *
 * This function and scripts/buildBudgetTree.mjs read `column_mapping` with DIFFERENT
 * key names. This builder needs `hierarchy_columns` + `amount_column`; the repo script
 * needs `department_column`/`category_column`/`subcategory_column` + `approved_amount_column`.
 * When a source is configured in the *other* dialect, every hCols lookup misses and keys
 * to "Unknown", `amt(r[ac])` is 0 for every row, and this wrote a $0 budget under a
 * meaningless "Unknown > Unknown > Unknown" tree while reporting status:success.
 *
 * That is exactly what happened to Dallas (dataset e2fs-y4nb / rtn4-pmj9): the rows held
 * $4.3B of correct line items under a $0 total, and a weekly cron re-wrote the zeros
 * every Sunday. scripts/bulkLoadBudget.js already had this guard; this one did not.
 *
 * Throwing here happens BEFORE treasury_sync_budget_tree is called, so the RPC's
 * destructive category delete never runs and existing good data cannot be wiped.
 */
function assertNonZeroBudget(ds: any, fy: number, rowCount: number, total: number, tree: any[]) {
  if (total > 0) return;
  const cm = ds.column_mapping || {};
  const topNames = tree.slice(0, 3).map((t: any) => t.n).join(", ") || "(empty tree)";
  throw new Error(
    `Refusing to write a $0 budget for ${ds.name} FY${fy} (${ds.dataset_type}): ` +
    `fetched ${rowCount} rows but computed total is ${total}. Top-level categories: ${topNames}. ` +
    `This almost always means column_mapping is written in the wrong dialect — this function ` +
    `requires hierarchy_columns (got ${JSON.stringify(cm.hierarchy_columns ?? null)}) and ` +
    `amount_column (got ${JSON.stringify(cm.amount_column ?? null)}). No rows were written.`,
  );
}

function buildTxnBatch(rows: any[], cm: any) {
  const vs = new Set<string>();
  const ridCol = cm.source_row_id_column; // e.g. transaction_id for LA, demand for WeHo
  const txns = rows.map(r => { const vn = r[cm.vendor_column] || "Unknown"; vs.add(vn);
    return { a: amt(r[cm.amount_column]), d: r[cm.description_column] || null, dt: r[cm.date_column] || null,
      pm: r[cm.payment_method_column] || null, inv: r[cm.invoice_number_column] || null, f: r[cm.fund_column] || null,
      ec: r[cm.expense_category_column] || null, dept: r[cm.department_column] || null, prog: r[cm.program_column] || null, vn,
      lk: [r[cm.department_column], r[cm.fund_column], r[cm.expense_category_column]].filter(Boolean).join("|") || null,
      rid: ridCol ? (r[ridCol] || null) : null }; });
  return { vendors: [...vs].map(n => ({ n })), transactions: txns };
}

async function syncTxnPaginated(ds: any, fy: number, triggered_by: string, startOffset: number = 0) {
  const cm = ds.column_mapping;
  const filters = buildFyFilter(cm, fy, ds.default_filters);
  const PAGE = 5000, MAX_PAGES = 4;
  let totalFetched = 0, totalInserted = 0, totalSkipped = 0, offset = startOffset, pages = 0, hasMore = true;
  while (pages < MAX_PAGES && hasMore) {
    const rows = await fetchPage(ds.base_url, ds.dataset_id, offset, PAGE, filters, cm.date_column);
    totalFetched += rows.length;
    if (rows.length === 0) { hasMore = false; break; } if (rows.length < PAGE) hasMore = false;
    const { vendors, transactions } = buildTxnBatch(rows, cm);
    const { data, error } = await supabase.rpc('treasury_sync_transactions', {
      p_data_source_id: ds.id, p_fiscal_year: fy, p_vendors: vendors,
      p_transactions: transactions, p_row_count: rows.length, p_triggered_by: triggered_by });
    if (error) {
      await supabase.rpc('treasury_update_cursor', { p_id: ds.id, p_cursor: `${fy}:${offset}` });
      return { status: 'error', rows_fetched: totalFetched, rows_inserted: totalInserted, offset, error: error.message, has_more: true };
    }
    totalInserted += data?.rows_inserted || 0;
    totalSkipped += data?.rows_skipped || 0;
    offset += rows.length; pages++;
    console.log(`  Page ${pages}: +${data?.rows_inserted || 0} new, ${data?.rows_skipped || 0} skipped`);
  }
  const newCursor = hasMore ? `${fy}:${offset}` : null;
  await supabase.rpc('treasury_update_cursor', { p_id: ds.id, p_cursor: newCursor });
  return { status: hasMore ? 'partial' : 'success', rows_fetched: totalFetched, rows_inserted: totalInserted,
    rows_skipped: totalSkipped, offset_start: startOffset, offset_end: offset, has_more: hasMore, pages_processed: pages };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  if (!(await checkAuth(req))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  try {
    const { data_source_id, fiscal_year, triggered_by = "manual", offset = 0 } = await req.json();
    if (!data_source_id) return new Response(JSON.stringify({ error: "data_source_id required" }), { status: 400 });
    const { data: ds, error: dsErr } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: data_source_id });
    if (dsErr || !ds) {
      await logFailure(data_source_id, fiscal_year ?? null,
        `Config lookup failed: ${dsErr?.message || 'no config returned'}`, 'get_config', 0, triggered_by);
      return new Response(JSON.stringify({ error: `Config: ${dsErr?.message}` }), { status: 500 });
    }
    if (ds.api_type !== 'socrata') return new Response(JSON.stringify({ error: `Unsupported: ${ds.api_type}` }), { status: 400 });
    const years = fiscal_year ? [fiscal_year] : (ds.fiscal_years || [new Date().getFullYear()]);
    const cm = ds.column_mapping; const results: any[] = [];

    if (ds.dataset_type === 'operating' || ds.dataset_type === 'revenue') {
      try {
        assertSingleYearWhenSkippingFyFilter(ds, years);
      } catch (e) {
        await logFailure(data_source_id, null, e.message, 'skip_fy_multi_year', 0, triggered_by);
        return new Response(JSON.stringify({ data_source: ds.name, dataset_type: ds.dataset_type,
          fiscal_years: years, results: [{ status: 'error', error: e.message }] }, null, 2),
          { headers: { "Content-Type": "application/json" } });
      }
    }
    for (const fy of years) {
      console.log(`Syncing ${ds.name} FY${fy} (${ds.dataset_type})...`);
      const filters = buildFyFilter(cm, fy, ds.default_filters);
      let res: any;
      // Once an RPC is entered it writes its own sync_logs row (success or, via its
      // EXCEPTION block, error). Only failures BEFORE that point need logging here,
      // or every failure would be recorded twice.
      let rpcReached = false;
      try {
        if (ds.dataset_type === 'transactions') {
          // ⚠ A transactions source with no amount_column would write every row into
          // treasury.transactions with amount 0 — thousands of $0 rows that read as
          // spending. Bloomington Public Contracts (a contract register) and LA City
          // Vendor List (a vendor lookup) were both typed 'transactions' with no
          // amount column; see scripts/lib/sourceMappingChecks.mjs. Refuse, loudly,
          // before any write. Mirrors the zero-total budget guard below.
          if (!cm.amount_column) {
            throw new Error(
              `Refusing to sync ${ds.name} FY${fy} as transactions: column_mapping has no ` +
              `amount_column, so every row would be written with amount 0. If this is a ` +
              `contract register or a reference dataset, it is not a transactions feed.`);
          }
          res = await syncTxnPaginated(ds, fy, triggered_by, offset);
        } else {
          const rows = await fetchAll(ds.base_url, ds.dataset_id, filters);
          if (rows.length === 0) {
            // Zero rows for a fiscal year the source claims to cover is almost always
            // a fiscal_year_column / filter mistake. Record it as 'empty' — not an
            // error, but no longer invisible.
            await logFailure(data_source_id, fy,
              `Fetched 0 rows for FY${fy}. Filter: ${JSON.stringify(filters)}`,
              'fetch_empty', 0, triggered_by, 'empty');
            results.push({ fiscal_year: fy, rows_fetched: 0, status: 'empty' });
            continue;
          }
          if (ds.dataset_type === 'salaries') {
            const { tree, total } = buildSalaryTree(rows, cm);
            rpcReached = true;
            const { data, error } = await supabase.rpc('treasury_sync_salary_tree', { p_data_source_id: data_source_id, p_fiscal_year: fy, p_total: total, p_tree: tree, p_row_count: rows.length, p_triggered_by: triggered_by });
            if (error) throw new Error(error.message); res = data;
          } else if (ds.dataset_type === 'operating' || ds.dataset_type === 'revenue') {
            const { tree, total } = buildBudgetTree(rows, cm);
            assertNonZeroBudget(ds, fy, rows.length, total, tree);
            rpcReached = true;
            const { data, error } = await supabase.rpc('treasury_sync_budget_tree', { p_data_source_id: data_source_id, p_fiscal_year: fy, p_dataset_type: ds.dataset_type, p_total: total, p_tree: tree, p_row_count: rows.length, p_triggered_by: triggered_by });
            if (error) throw new Error(error.message); res = data;
          } else {
            res = { status: 'unsupported', error: `Unknown: ${ds.dataset_type}` };
            await logFailure(data_source_id, fy, `Unsupported dataset_type: ${ds.dataset_type}`,
              'unsupported_dataset_type', rows.length, triggered_by);
          }
        }
      } catch (e) {
        res = { status: 'error', error: e.message };
        // Reaching the RPC means it already logged; anything earlier would vanish.
        if (!rpcReached) {
          await logFailure(data_source_id, fy, e.message, 'pre_rpc', 0, triggered_by);
        }
      }
      results.push({ fiscal_year: fy, ...res });
    }
    return new Response(JSON.stringify({ data_source: ds.name, dataset_type: ds.dataset_type, fiscal_years: years, results,
      total_fetched: results.reduce((s, r) => s + (r.rows_fetched || 0), 0),
      total_inserted: results.reduce((s, r) => s + (r.rows_inserted || 0), 0) }, null, 2),
      { headers: { "Content-Type": "application/json" } });
  } catch (e) { console.error("Error:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
