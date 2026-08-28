/**
 * Enumerate treasury.data_sources without being silently truncated.
 *
 * ── The defect this replaces ──
 *
 * `treasury_list_source_ids()` returns every enabled source — 1,811 rows today —
 * and PostgREST caps a response at db-max-rows = 1000. The function orders by
 * `priority DESC, name`, so the cut is ALPHABETICAL, currently landing at
 * "Norwood — MA DLS General Fund Revenue by Source". Everything after it is simply
 * absent from the result, with no error and no indication anything was dropped.
 *
 * The damage was not hypothetical:
 *
 *   * San Francisco, Sacramento, San Diego, Seattle, Portland, Oakland, Tacoma,
 *     Tucson and West Hollywood were never enumerated by the sync orchestrator, so
 *     cron never synced them — while their rows read `sync_status: idle` and
 *     `last_error: NULL`, a failure shaped exactly like health (PR #85).
 *   * scripts/loadSacramentoCSV.js exited with "run seedSacramentoCA.js first"
 *     against rows that already existed, because it could not see its own sources.
 *     scripts/loadSanDiegoCSV.js had no targets at all (PR #91).
 *   * ~23 seeder verification blocks report "MISSING" for a source they have just
 *     written, if its name sorts past the cut.
 *
 * PR #86 added `treasury_list_sources(p_api_type, p_dataset_types)` so callers that
 * want a NARROW set can filter server-side and receive something that fits. That is
 * the right tool when you know the filter. It does NOT help a caller that genuinely
 * wants all of them: unfiltered, it returns 1,811 rows and PostgREST truncates it
 * just the same. Those callers need paging, which is this module.
 *
 * ── Two things that make paging correct rather than merely plausible ──
 *
 * 1. A TOTAL ORDER, with the primary key last. Paging by `priority DESC, name`
 *    alone leaves ties unordered between requests, so a row can be returned twice
 *    or skipped entirely while the total count still looks right. `id` last makes
 *    the order total. (See reference_paged_reads_need_total_order.)
 * 2. NEVER page a table while it is being written. These are seeders and loaders;
 *    do not call this concurrently with a load of the same table.
 *
 * ── The filters are copied deliberately ──
 *
 * treasury_list_source_ids applies `is_enabled = true AND sync_status <> 'running'`.
 * Both are reproduced here so this is a drop-in replacement rather than a quiet
 * behaviour change — a caller that started seeing disabled sources would try to load
 * the ones PR #87 disabled for not being transaction feeds at all.
 *
 * ⚠ Note `sync_status <> 'running'` makes the result TIME-DEPENDENT: a source that
 * happens to be mid-sync drops out. That is inherited behaviour, not new, but it does
 * mean a seeder verifying its own row can still report MISSING if a cron sync happens
 * to be in flight against it. Verifying by an exact name lookup instead of filtering a
 * full listing would remove that last bit of coupling; left as a follow-up rather than
 * folded into a 28-file mechanical change.
 */

/** Columns treasury_list_source_ids returns, so callers see the same shape. */
const SOURCE_COLUMNS =
  'id, name, api_type, dataset_type, sync_frequency, last_synced_at, sync_status, fiscal_years';

const DEFAULT_PAGE_SIZE = 500;

/**
 * Page through a fetcher until it is exhausted.
 *
 * Pure and injectable so the paging logic can be tested without a database.
 *
 * @param {(from:number, to:number) => Promise<Array>} fetchPage inclusive range
 * @param {number} pageSize
 * @param {number} maxRows safety stop, so a fetcher that never shrinks cannot spin
 * @returns {Promise<Array>}
 */
export async function paginate(fetchPage, pageSize = DEFAULT_PAGE_SIZE, maxRows = 100000) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error(`paginate: pageSize must be a positive integer, got ${pageSize}`);
  }
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (!Array.isArray(page)) {
      throw new Error(`paginate: fetchPage must resolve to an array, got ${typeof page}`);
    }
    out.push(...page);
    // A short page means the end. A full page means there may be more.
    if (page.length < pageSize) break;
    if (out.length >= maxRows) {
      throw new Error(
        `paginate: refusing to continue past ${maxRows} rows — the fetcher never `
        + 'returned a short page, which usually means the range is being ignored.');
    }
  }
  return out;
}

/**
 * Every enabled, not-currently-syncing data source. Drop-in for
 * `supabase.rpc('treasury_list_source_ids')` — same columns, same filters, but
 * complete.
 *
 * @param {object} client a supabase-js client with service-role credentials
 * @param {object} [opts] { pageSize }
 * @returns {Promise<Array>}
 */
export async function listAllSources(client, opts = {}) {
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;

  const rows = await paginate(async (from, to) => {
    const { data, error } = await client
      .schema('treasury')
      .from('data_sources')
      .select(SOURCE_COLUMNS)
      .eq('is_enabled', true)
      .neq('sync_status', 'running')
      // ⚠ Total order: the RPC's sort first, then the primary key. Without `id`
      // the page boundaries are not deterministic and rows can repeat or vanish.
      .order('priority', { ascending: false })
      .order('name')
      .order('id')
      .range(from, to);
    if (error) throw new Error(`listAllSources: ${error.message}`);
    return data ?? [];
  }, pageSize);

  return rows;
}

/**
 * `{ data, error }`-shaped drop-in for `client.rpc('treasury_list_source_ids')`.
 *
 * Every call site already handles that shape, so swapping to this is a one-line
 * change per file and the surrounding error handling keeps working unchanged. The
 * only difference is that the answer is now complete.
 *
 * @param {object} client supabase-js client with service-role credentials
 * @param {object} [opts]
 * @returns {Promise<{data: Array|null, error: {message: string}|null}>}
 */
export async function listAllSourcesResult(client, opts = {}) {
  try {
    return { data: await listAllSources(client, opts), error: null };
  } catch (e) {
    return { data: null, error: { message: e?.message ?? String(e) } };
  }
}
