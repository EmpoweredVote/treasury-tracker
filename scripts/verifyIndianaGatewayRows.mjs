/**
 * Verify — never change — every stored Indiana Gateway AFR row against the
 * Gateway extracts on disk.
 *
 * NO SHEBANG — tests/indianaGatewayRows.test.mjs imports this module. See
 * scripts/fetchIndianaGateway.mjs for why a shebang breaks the vitest transform.
 *
 * Usage:
 *   node scripts/verifyIndianaGatewayRows.mjs --dir _acfr-work/in
 *   node scripts/verifyIndianaGatewayRows.mjs --dir _acfr-work/in --entity "Fort Wayne"
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 *
 * PR #113 loaded 78 rows for four entities from extracts fetched 2026-08-29/30.
 * Re-running the read against extracts fetched a WEEK LATER answers two
 * questions one gate cannot separate on its own:
 *
 *   - is the read reproducible?      (same code, different download)
 *   - did the publisher revise?      (same download date, different figures)
 *
 * If both hold, the four-entity result is a regression baseline the statewide
 * sweep can be measured against. Measured 2026-09-05: 78/78 totals and 78/78
 * trees identical, $43,959,619,168.82, 5,264 categories, and 11,283/11,283
 * fund-level oracle checks — the same check count PR #113 reported.
 *
 * ── ⚠⚠ WHY IT COMPARES TREES AND NOT JUST TOTALS ───────────────────────────
 *
 * A matching total with a different tree is still a change, and it is the
 * change a reader sees. This asserts, per row: the total, the category count,
 * the root NAMES, and their ORDER. The Michigan lesson in the other direction —
 * leaves at exactly 2.000x a subtotal are a whole-filing repeat, not duplicated
 * detail — is why the count matters as much as the sum.
 *
 * ── ⚠ IT REBUILDS THE TREE FROM THE LIBRARY, NOT FROM THE LOADER ───────────
 *
 * `collectAll` in loadIndianaGateway.mjs is not exported, and that is convenient
 * rather than annoying: rebuilding from inGateway.mjs's primitives makes this a
 * SECOND READER of the same files instead of the loader re-run against itself.
 * A verifier that calls the code under test only re-checks arithmetic.
 *
 * ── ⚠⚠ AND IT REFUSES A DIRECTORY IT CANNOT TRUST ──────────────────────────
 *
 * `_acfr-work/in` mixes vintages: on 2026-09-05 one file was 7 days older than
 * its neighbours, left from the #113 session, because each download overwrites
 * in place and a failed download leaves the previous copy under the right name.
 * So if fetchIndianaGateway.mjs left a manifest, every file this reads must
 * appear in it at the recorded size. A manifest marked incomplete is refused
 * outright.
 */

import { readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
  eachRow, makeAccumulator, toTree, need, pad,
} from './lib/inGateway.mjs';
import { IN_ENTITIES, PA_IN_LOAD_WINDOW } from './data/paInKnightEntities.mjs';
import { SOURCE_PREFIX } from './loadIndianaGateway.mjs';

export const EXTRACTS = [
  { kind: 'revenue', county: false, file: 'rec_city_ALL.txt' },
  { kind: 'revenue', county: true, file: 'rec_county_ALL.txt' },
  { kind: 'operating', county: false, file: 'disfund_city_ALL.txt' },
  { kind: 'operating', county: true, file: 'disfund_county_ALL.txt' },
];

/** Money agreement on whole-dollar files. Float slack only, never a tolerance. */
const EPS = 0.005;

/**
 * Check the download directory is ONE fetch, not a mix of vintages.
 * Returns a list of complaints; empty means trustworthy (or unmanifested).
 */
export async function checkManifest(dir, files) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'gateway-manifest.json'), 'utf8'));
  } catch {
    // ⚠ No manifest is a WARNING, not a pass: the #113-era files predate it.
    return { manifested: false, complaints: [] };
  }
  const complaints = [];
  if (manifest.complete === false) {
    complaints.push('the manifest says the fetch was INCOMPLETE — some file here is a leftover');
  }
  for (const f of files) {
    const rec = manifest.files?.[f];
    if (!rec) { complaints.push(`${f} is not in the manifest — it is a leftover from an earlier fetch`); continue; }
    const { size } = await stat(join(dir, f));
    if (size !== rec.size) complaints.push(`${f} is ${size} bytes but the manifest recorded ${rec.size}`);
  }
  return { manifested: true, complaints, fetchedAt: manifest.fetched_at };
}

/** Rebuild `{ 'Entity|year|kind': roots }` for the given entities and years. */
export async function rebuildTrees(dir, entities, years) {
  const key = (cc, uc, y) => `${cc}|${uc}|${y}`;
  const out = new Map();
  for (const g of EXTRACTS) {
    const want = new Map();
    for (const e of entities) {
      if ((e.entityType === 'county') !== g.county) continue;
      for (const y of years) {
        want.set(key(e.countyCode, e.unitCode, y),
          { e, y, a: makeAccumulator({ entity: e, year: y, kind: g.kind }) });
      }
    }
    if (!want.size) continue;
    await eachRow(join(dir, g.file), (r, ix) => {
      const k = key(pad(r[need(ix, 'cnty_cd')], 2), pad(r[need(ix, 'unit_code')], 4),
        String(r[need(ix, 'year')]).trim());
      const slot = want.get(k);
      if (slot) slot.a.consume(r, ix);
    });
    for (const slot of want.values()) {
      const res = slot.a.result();
      // ⚠ 0 rows means NOT FILED, which is a real gap in the source, not a
      // parse failure — it is reported by the caller, never asserted against.
      if (res.rows === 0) continue;
      out.set(`${slot.e.name}|${slot.y}|${g.kind}`, {
        roots: toTree(res.tree),
        subsetTotal: res.subsetTotal,
      });
    }
  }
  return out;
}

/** Compare one stored row against its rebuilt tree. Returns complaints. */
export function compareRow(stored, rebuilt) {
  const out = [];
  if (Math.abs(Number(stored.total) - rebuilt.subsetTotal) > EPS) {
    out.push(`total: stored ${Number(stored.total).toFixed(2)} vs rebuilt ${rebuilt.subsetTotal.toFixed(2)}`);
  }
  const cats = rebuilt.roots.reduce((n, r) => n + 1 + (r.c?.length ?? 0), 0);
  if (stored.cats !== cats) out.push(`categories: stored ${stored.cats} vs rebuilt ${cats}`);
  const mine = rebuilt.roots.map((r) => r.n);
  if (JSON.stringify(mine) !== JSON.stringify(stored.rootNames)) {
    out.push(`root names/order: stored ${JSON.stringify(stored.rootNames)} vs rebuilt ${JSON.stringify(mine)}`);
  }
  return out;
}

async function readStored(client, entities) {
  const T = client.schema('treasury');
  const names = entities.map((e) => e.name);
  const { data: munis, error: e0 } = await T.from('municipalities')
    .select('id,name').eq('state', 'IN').in('name', names);
  if (e0) throw new Error(e0.message);
  const byId = Object.fromEntries(munis.map((m) => [m.id, m.name]));

  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await T.from('budgets')
      .select('id,municipality_id,fiscal_year,dataset_type,total_budget')
      .in('municipality_id', munis.map((m) => m.id))
      .like('data_source', `${SOURCE_PREFIX}%`)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  // ⚠⚠ The guard for the defect this repo has hit four times.
  if (new Set(rows.map((r) => r.id)).size !== rows.length) {
    throw new Error(`PAGING DEFECT: ${rows.length} rows, ${new Set(rows.map((r) => r.id)).size} distinct ids`);
  }

  const out = new Map();
  for (const r of rows) {
    const { data: cats, error } = await T.from('budget_categories')
      .select('id,parent_id,name,amount').eq('budget_id', r.id).limit(5000);
    if (error) throw new Error(error.message);
    out.set(`${byId[r.municipality_id]}|${r.fiscal_year}|${r.dataset_type}`, {
      total: r.total_budget,
      cats: cats.length,
      rootNames: cats.filter((c) => !c.parent_id)
        .sort((a, b) => Number(b.amount) - Number(a.amount)).map((c) => c.name),
    });
  }
  return out;
}

export async function main() {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string', default: '_acfr-work/in' },
      entity: { type: 'string' },
    },
  });
  const entities = values.entity
    ? IN_ENTITIES.filter((e) => e.name === values.entity || e.key === values.entity)
    : IN_ENTITIES;
  if (!entities.length) throw new Error(`No entity matched ${values.entity}`);

  const mf = await checkManifest(values.dir, EXTRACTS.map((g) => g.file));
  if (mf.manifested) {
    console.log(`manifest: fetched ${mf.fetchedAt}`);
    if (mf.complaints.length) {
      for (const c of mf.complaints) console.error(`  ✗ ${c}`);
      console.error('\nREFUSING: the download directory is not one fetch. Re-run fetchIndianaGateway.mjs.');
      process.exit(1);
    }
    console.log('  ✅ every extract belongs to that fetch, at the recorded size');
  } else {
    console.log('⚠ no gateway-manifest.json — cannot prove these extracts are one fetch');
  }

  const years = [];
  for (let y = PA_IN_LOAD_WINDOW.first; y <= PA_IN_LOAD_WINDOW.last; y++) years.push(String(y));

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const keyEnv = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyEnv) {
    // ⚠ A check that cannot reach its source must NOT look like a clean pass.
    console.error('INCONCLUSIVE: no SUPABASE_SERVICE_KEY, so nothing was verified.');
    process.exit(2);
  }
  const stored = await readStored(createClient(url, keyEnv), entities);
  console.log(`\nstored rows      : ${stored.size}`);

  const rebuilt = await rebuildTrees(values.dir, entities, years);
  console.log(`rebuilt from disk: ${rebuilt.size}`);

  let checked = 0;
  let bad = 0;
  const notFiled = [];
  for (const [k, s] of [...stored].sort()) {
    const r = rebuilt.get(k);
    if (!r) {
      // A row exists that the extracts do not support. That is serious.
      console.error(`  ✗ ${k}: stored but the extracts carry NO rows for it`);
      bad++;
      continue;
    }
    const complaints = compareRow(s, r);
    checked++;
    if (complaints.length) {
      bad++;
      console.error(`  ✗ ${k}`);
      for (const c of complaints) console.error(`      ${c}`);
    }
  }
  for (const k of [...rebuilt.keys()].sort()) {
    if (!stored.has(k)) notFiled.push(k);
  }
  if (notFiled.length) {
    console.log(`\n${notFiled.length} entity-year(s) present in the extracts but NOT stored `
      + '(a load-window or coverage decision, reported not asserted):');
    for (const k of notFiled.slice(0, 20)) console.log(`  - ${k}`);
    if (notFiled.length > 20) console.log(`  … and ${notFiled.length - 20} more`);
  }

  // ⚠⚠ A GATE THAT CAN MEASURE NOTHING MUST FAIL, NOT PASS.
  if (checked === 0) {
    console.error('\nREFUSING: 0 rows were compared. Nothing was measured, so nothing is verified.');
    process.exit(1);
  }
  const total = [...stored.values()].reduce((a, s) => a + Number(s.total), 0);
  const cats = [...stored.values()].reduce((a, s) => a + s.cats, 0);
  console.log(`\ncompared         : ${checked}`);
  console.log(`disagreeing      : ${bad}`);
  console.log(`figures under it : $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} across ${cats} categories`);
  if (bad) {
    console.error('\n✗ the stored rows no longer reproduce from the extracts. Either the read '
      + 'changed or the publisher revised — find out which BEFORE loading anything else.');
    process.exit(1);
  }
  console.log('\n✅ every stored Indiana Gateway row reproduces from the extracts — '
    + 'total, category count, root names and order.');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('verifyIndianaGatewayRows.mjs')) await main();
