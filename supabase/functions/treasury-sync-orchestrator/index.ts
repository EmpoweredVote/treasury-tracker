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

const FREQ_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 28, quarterly: 84, manual: Infinity };

async function callSyncWorker(dsId: string, fy: number, triggeredBy: string, offset: number = 0): Promise<any> {
  // Use the db sync key for worker-to-worker auth
  const authKey = await getDbSyncKey() || SYNC_API_KEY;
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/treasury-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": authKey },
    body: JSON.stringify({ data_source_id: dsId, fiscal_year: fy, triggered_by: triggeredBy, offset }),
  });
  return await resp.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
  if (!(await checkAuth(req))) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { force = false, data_source_id = null, fiscal_year = null, triggered_by = "scheduler" } = body;

    // Get all enabled sources
    const { data: allSources, error: srcErr } = await supabase.rpc('treasury_list_source_ids');
    if (srcErr) return new Response(JSON.stringify({ error: srcErr.message }), { status: 500 });

    let sources = (allSources || []).filter((s: any) => s.api_type === 'socrata');
    if (data_source_id) sources = sources.filter((s: any) => s.id === data_source_id);

    const now = new Date();
    const due = sources.filter((ds: any) => {
      if (force || data_source_id) return true;
      if (ds.sync_frequency === 'manual') return false;
      if (!ds.last_synced_at) return true;
      const days = (now.getTime() - new Date(ds.last_synced_at).getTime()) / 86400000;
      return days >= (FREQ_DAYS[ds.sync_frequency] || 28);
    });

    if (due.length === 0) {
      return new Response(JSON.stringify({ message: "No sources due", checked: sources.length, due: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    // Get full config for each due source
    const results: any[] = [];
    for (const src of due) {
      const { data: ds } = await supabase.rpc('treasury_get_data_source_config', { p_data_source_id: src.id });
      if (!ds) { results.push({ data_source: src.name, status: 'error', error: 'Config not found' }); continue; }

      const years = fiscal_year ? [fiscal_year] : (ds.fiscal_years || [now.getFullYear()]).slice(-2);

      for (const fy of years) {
        console.log(`\n=== ${ds.name} FY${fy} (${ds.dataset_type}) ===`);

        if (ds.dataset_type === 'transactions') {
          // Auto-paginate: keep calling worker until has_more is false
          let offset = 0, totalF = 0, totalI = 0, batch = 0;
          const MAX_BATCHES = 50; // 50 * 20K = 1M safety limit
          while (batch < MAX_BATCHES) {
            batch++;
            console.log(`  Batch ${batch} offset=${offset}`);
            const r = await callSyncWorker(ds.id, fy, triggered_by, offset);
            const p = r?.results?.[0] || r;
            if (p.error && !p.rows_inserted) {
              results.push({ data_source: ds.name, fiscal_year: fy, status: 'error', error: p.error, rows_fetched: totalF, rows_inserted: totalI, batches: batch });
              break;
            }
            totalF += p.rows_fetched || 0; totalI += p.rows_inserted || 0;
            offset = p.offset_end || offset + 20000;
            console.log(`  +${p.rows_fetched || 0} fetched, +${p.rows_inserted || 0} inserted`);
            if (!p.has_more || p.status === 'success') {
              results.push({ data_source: ds.name, fiscal_year: fy, status: 'success', rows_fetched: totalF, rows_inserted: totalI, batches: batch });
              break;
            }
            if (batch >= MAX_BATCHES) {
              results.push({ data_source: ds.name, fiscal_year: fy, status: 'partial', rows_fetched: totalF, rows_inserted: totalI, batches: batch, resume_offset: offset });
            }
          }
        } else {
          // Single call for salary/budget/revenue
          const r = await callSyncWorker(ds.id, fy, triggered_by);
          const p = r?.results?.[0] || r;
          results.push({ data_source: ds.name, fiscal_year: fy, status: p.status || (p.error ? 'error' : 'success'),
            rows_fetched: p.rows_fetched || 0, rows_inserted: p.rows_inserted || 0, error: p.error || undefined });
        }
      }
    }

    return new Response(JSON.stringify({
      triggered_at: now.toISOString(), triggered_by, sources_checked: sources.length, sources_synced: due.length,
      total_rows_fetched: results.reduce((s, r) => s + (r.rows_fetched || 0), 0),
      total_rows_inserted: results.reduce((s, r) => s + (r.rows_inserted || 0), 0),
      results,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  } catch (e) { console.error("Orchestrator error:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
