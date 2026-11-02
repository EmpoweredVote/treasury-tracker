#!/usr/bin/env node
/**
 * Prove that a registry pattern means the same thing in JavaScript and in
 * Postgres, across every live source family.
 *
 * (Shebang is correct HERE — entry point with a main guard.)
 *
 * ⚠⚠⚠ WHY THIS IS THE MOST IMPORTANT CHECK IN THE GATE. The loaders match a
 * `data_source` against a JS RegExp; treasury_sync_city_budget matches the
 * same name against the mirrored pattern with `~`. If the two ever disagree,
 * the gate passes a family the loader thinks is unregistered — or refuses one
 * it thinks is fine — and either way a check goes green over data nobody
 * classified. That is the precise failure this whole piece of work exists to
 * prevent, so it must not be assumed from "ARE is a superset of ERE".
 *
 * Postgres ARE does take the patterns verbatim: (?:…), \d{4}, escaped parens
 * and the em dash all work, and only a JS `i` flag needs an inline (?i).
 * Proven 2026-11-02 — 121 patterns, 5,929 families, all four axis digests
 * identical. Re-run it whenever a registry entry is added or changed.
 *
 *   node --env-file=.env scripts/verifyRegistryPatternParity.mjs
 *
 * Exit 0 agree · 1 disagree · 2 INCONCLUSIVE (could not reach the database).
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mirrorRows } from './lib/registeredFamilies.mjs';

/**
 * The JS side, digested exactly as treasury.registry_pattern_parity() does:
 * `axis|entry_id|n` per row, ordered by entry_id, joined with newlines.
 *
 * ⚠ The regex is rebuilt FROM THE MIRRORED PATTERN STRING, not from the
 * original RegExp object. Comparing the original would prove the registries
 * agree with themselves; this proves the string the database actually holds
 * still means what the loader meant.
 */
export function digestByAxis(rows, familyNames) {
  const byAxis = new Map();
  for (const { axis, entry_id: entryId, pattern } of rows) {
    const ci = pattern.startsWith('(?i)');
    let re;
    try { re = new RegExp(ci ? pattern.slice(4) : pattern, ci ? 'i' : ''); } catch { re = null; }
    const n = re ? familyNames.filter((x) => re.test(x)).length : -1;
    if (!byAxis.has(axis)) byAxis.set(axis, []);
    byAxis.get(axis).push({ entryId, n });
  }
  const out = new Map();
  for (const [axis, list] of byAxis) {
    list.sort((a, b) => (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0));
    out.set(axis, {
      patterns: list.length,
      matches: list.reduce((s, r) => s + r.n, 0),
      digest: createHash('md5')
        .update(list.map((r) => `${axis}|${r.entryId}|${r.n}`).join('\n')).digest('hex'),
    });
  }
  return out;
}

async function distinctFamilies(client) {
  const seen = new Set();
  for (let from = 0; ; from += 1000) {
    // ⚠ A paged read needs a total order — broken five times in this repo.
    const { data, error } = await client.schema('treasury').from('budgets')
      .select('id,data_source').order('id').range(from, from + 999);
    if (error) throw new Error(`budgets read failed: ${error.message}`);
    for (const r of data) seen.add(r.data_source);
    if (data.length < 1000) break;
  }
  return [...seen];
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so no pattern was compared.');
    process.exitCode = 2;
    return;
  }
  const client = createClient(url, key);

  const { data: pg, error } = await client.schema('treasury').rpc('registry_pattern_parity');
  if (error) { console.error(`parity RPC failed: ${error.message}`); process.exitCode = 2; return; }

  const names = await distinctFamilies(client);
  const js = digestByAxis(mirrorRows(), names);

  console.log(`families ${names.length.toLocaleString()}   patterns ${mirrorRows().length}\n`);
  let bad = 0;
  for (const row of pg.sort((a, b) => (a.axis < b.axis ? -1 : 1))) {
    const mine = js.get(row.axis);
    const ok = mine && mine.digest === row.digest
      && mine.patterns === Number(row.patterns) && mine.matches === Number(row.matches);
    if (!ok) bad += 1;
    console.log(`${row.axis.padEnd(17)} patterns ${String(row.patterns).padStart(3)}  `
      + `matches ${String(row.matches).padStart(5)}  ${ok ? 'JS == PG ✅' : `JS != PG ❌  js=${mine?.digest} pg=${row.digest}`}`);
  }
  // An axis Postgres never reported is a disagreement too — it means the
  // mirror is missing rows the registries have.
  for (const axis of js.keys()) {
    if (!pg.some((r) => r.axis === axis)) { bad += 1; console.log(`${axis.padEnd(17)} MISSING FROM THE MIRROR ❌`); }
  }

  if (bad) {
    console.error(`\n❌ ${bad} axis/axes disagree. A pattern does not mean the same thing in both engines.`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✅ PARITY — every pattern matches the same families in Postgres and in JavaScript.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
