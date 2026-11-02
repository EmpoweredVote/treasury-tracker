#!/usr/bin/env node
/**
 * Push the four axis registries' match patterns into
 * treasury.registered_source_families, so the database can ask the same
 * question the loaders ask.
 *
 * (Shebang is correct HERE — this is an entry point with a main guard. It
 * would NOT be correct in scripts/lib/, where it breaks the Vite transform on
 * a CRLF checkout.)
 *
 *   node scripts/syncRegisteredFamilies.mjs           write the mirror
 *   node scripts/syncRegisteredFamilies.mjs --check   write nothing, exit 1 on drift
 *
 * ⚠⚠ RUN THIS AFTER ADDING A REGISTRY ENTRY. A stale mirror makes the gate
 * refuse a family that IS registered, and a refusal that is wrong is how a
 * gate gets disabled. The refusal message says so, and --check belongs in any
 * pre-push routine that touches scripts/data/*Registry.mjs.
 *
 * ⚠ A check that cannot reach its source must NOT look like a clean pass:
 * no service key exits 2 (INCONCLUSIVE), never 0.
 */
import { pathToFileURL } from 'node:url';
import { mirrorRows } from './lib/registeredFamilies.mjs';
import { diffMirror, mirrorIsClean } from './lib/mirrorDiff.mjs';

const TABLE = 'registered_source_families';

/**
 * ⚠ NOT PAGED, DELIBERATELY. This table holds one row per registry entry —
 * 121 today, a few hundred at the outside — so paging it would be machinery
 * for nothing. It would also force an ordering chain ending on a column this
 * table does not have: its primary key is the composite (axis, entry_id), and
 * tests/pagedReadOrdering.test.mjs rightly requires `.order('id')` last. That
 * guard has caught two real silent-duplicate bugs; widening it to accommodate
 * one small table would be the wrong trade.
 *
 * ⚠⚠ A read with no paging CAN still truncate — PostgREST caps rows — and a
 * short read here is worse than a crash: the sync would see entries missing
 * from the mirror and happily re-insert them, or `--check` would report drift
 * that is not there. So the row count is asserted against an exact count.
 */
async function readMirror(client) {
  const { data, error, count } = await client.schema('treasury').from(TABLE)
    .select('axis,entry_id,pattern', { count: 'exact' })
    .order('axis').order('entry_id');
  if (error) throw new Error(`read ${TABLE} failed: ${error.message}`);
  if (typeof count === 'number' && data.length !== count) {
    throw new Error(
      `read ${TABLE} returned ${data.length} of ${count} rows — truncated. `
      + 'Do not trust this diff; raise the PostgREST row cap or page with a total order.',
    );
  }
  return data;
}

export async function syncRegisteredFamilies(client, { check = false } = {}) {
  const wanted = mirrorRows();
  const actual = await readMirror(client);
  const diff = diffMirror(wanted, actual);

  if (mirrorIsClean(diff)) return { ...diff, wrote: 0, clean: true };
  if (check) return { ...diff, wrote: 0, clean: false };

  const upserts = [...diff.insert, ...diff.update]
    .map((r) => ({ axis: r.axis, entry_id: r.entry_id, pattern: r.pattern, synced_at: new Date().toISOString() }));
  if (upserts.length) {
    const { error } = await client.schema('treasury').from(TABLE)
      .upsert(upserts, { onConflict: 'axis,entry_id' });
    if (error) throw new Error(`upsert failed: ${error.message}`);
  }
  for (const r of diff.remove) {
    const { error } = await client.schema('treasury').from(TABLE)
      .delete().eq('axis', r.axis).eq('entry_id', r.entry_id);
    if (error) throw new Error(`delete ${r.axis}/${r.entry_id} failed: ${error.message}`);
  }
  return { ...diff, wrote: upserts.length + diff.remove.length, clean: false };
}

async function main() {
  const check = process.argv.includes('--check');
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so the mirror was not read.');
    process.exitCode = 2;
    return;
  }
  const client = createClient(url, key);
  const r = await syncRegisteredFamilies(client, { check });

  console.log(`registries: ${mirrorRows().length} entries`);
  console.log(`  unchanged ${r.same}   insert ${r.insert.length}   update ${r.update.length}   remove ${r.remove.length}`);
  for (const row of [...r.insert, ...r.update, ...r.remove].slice(0, 10)) {
    console.log(`    ${row.axis}/${row.entry_id}`);
  }

  if (r.clean) { console.log('\n✅ mirror matches the registries.'); return; }
  if (check) {
    console.error('\n❌ MIRROR IS STALE. Run: node scripts/syncRegisteredFamilies.mjs');
    // ⚠ process.exitCode, NOT process.exit(). Exiting abruptly while
    // supabase-js still holds an open socket trips a libuv assertion on
    // Windows and the process reports 127 instead of 1 — a gate CI cannot
    // act on. Set the code and let the loop drain.
    process.exitCode = 1;
    return;
  }
  console.log(`\n✅ wrote ${r.wrote} change(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
