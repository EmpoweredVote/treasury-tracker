#!/usr/bin/env node
/**
 * Assert that every row a registry CLAIMS actually CARRIES the value it claims.
 *
 * (Shebang is correct HERE — this is an entry-point script with a main guard.
 * It would NOT be correct in scripts/lib/, where it breaks the Vite transform
 * on a CRLF checkout; see tests/waSao.test.mjs. The logic lives in
 * scripts/lib/axisStamps.mjs so it can be unit-tested without a database.)
 *
 * ⚠⚠ READ scripts/lib/axisStamps.mjs FIRST for why this exists. In short: the
 * three partition gates count rows by `data_source` and never read the axis
 * column, so a delete-and-reinsert un-stamps its own rows and every gate in
 * the repo stays green over it.
 *
 * Usage:
 *   node scripts/verifyAxisStamps.mjs
 *   node scripts/verifyAxisStamps.mjs --like "WA State Auditor — Duvall%"
 */
import { pathToFileURL } from 'node:url';
import { AXES, unstampedRows, branchingEntryIds } from './lib/axisStamps.mjs';

const PAGE = 1000;

async function allRows(client, like) {
  // ⚠ PAGED READS NEED A TOTAL ORDER. Ordering by `id` alone is not enough on
  // a table this size if ids ever repeat across pages; the DISTINCT assertion
  // below is the guard, because this repo has broken paged reads four times.
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = client.schema('treasury').from('budgets')
      .select('id,data_source,basis,reporting_entity,audit_grade,accounting_basis,fund_scope')
      .order('id').range(from, from + PAGE - 1);
    if (like) q = q.like('data_source', like);
    const { data, error } = await q;
    if (error) throw new Error(`budgets query failed: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  const distinct = new Set(rows.map((r) => r.id)).size;
  if (distinct !== rows.length) {
    throw new Error(`paged read returned ${rows.length} rows but only ${distinct} distinct ids — ` +
      'the page window drifted; refusing to report on a set that is not what it says it is');
  }
  return rows;
}

async function main() {
  const likeIdx = process.argv.indexOf('--like');
  const like = likeIdx >= 0 ? process.argv[likeIdx + 1] : null;

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    // ⚠ A check that cannot reach its source must NOT look like a clean pass.
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so no stamp was checked.');
    process.exit(2);
  }
  const client = createClient(url, key);

  const rows = await allRows(client, like);
  console.log(`read ${rows.length.toLocaleString()} budget row(s)${like ? ` matching ${like}` : ''}\n`);

  let bad = 0;
  for (const axis of AXES) {
    const miss = unstampedRows(rows, axis.registry, axis.legal, axis.unknown, axis.column);
    const skipped = branchingEntryIds(axis.registry);
    const note = skipped.length ? `  (not spoken for: ${skipped.join(', ')} — per-row branch)` : '';
    if (!miss.length) {
      console.log(`  ✅ ${axis.column.padEnd(17)} every claimed row carries its entry's value${note}`);
      continue;
    }
    bad += miss.length;
    console.log(`  ✗ ${axis.column.padEnd(17)} ${miss.length} row(s) CLASSIFY but do not carry it${note}`);
    const byEntry = new Map();
    for (const m of miss) {
      const k = `${m.entryId}: expected ${m.expected}, found ${m.actual}`;
      byEntry.set(k, (byEntry.get(k) ?? 0) + 1);
    }
    for (const [k, n] of [...byEntry].sort((a, b) => b[1] - a[1])) {
      console.log(`        ${String(n).padStart(6)}  ${k}`);
    }
    for (const m of miss.slice(0, 5)) console.log(`        e.g. ${m.dataSource}`);
  }

  if (bad) {
    console.error(`\n✗ ${bad} row(s) are claimed by a registry and do not carry the claim.`);
    console.error('  Re-run the stampers. A LOAD IS NOT A STAMP: any delete-and-reinsert');
    console.error('  un-stamps its own rows, and no partition gate can see it.');
    process.exit(1);
  }
  console.log('\n✅ every row any registry claims carries exactly what it claims.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
