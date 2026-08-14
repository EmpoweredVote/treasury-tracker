#!/usr/bin/env node
/**
 * verify-seattle-audit.mjs — Task 13 Step 3/4: source-chain and integrity audit
 * for the Seattle + King County load. Six checks, all of which must pass.
 *
 *   (a) every loaded row has a non-null, correct-per-FY source_url that resolves
 *       200 application/pdf — and whose byte length matches the local PDF the
 *       independent re-derivation actually read, which is what closes the loop
 *       between "the figures are right" and "they came from the cited document";
 *   (b) source_date is exactly <FY>-12-31 on every row (both entities have a
 *       December 31 fiscal year end);
 *   (c) zero residue in treasury.data_sources matching seattle-% or kingcounty-%
 *       (the loaders create an ephemeral row and must delete it);
 *   (d) no category or line-item label contains a "--" dash run, and none begins
 *       with a glued parent name such as "Taxes " — the two label-corruption
 *       classes this build actually hit and fixed;
 *   (e) the units landed: Seattle FY2024 operating is exactly 2,390,575,000 and
 *       King County FY2024 operating exactly 1,137,458,000, read from the DB.
 *       This is the check the tie gate structurally cannot perform, because a
 *       symmetric scale error ties at $0 on both sides;
 *   (f) exactly TWO KING COUNTY rows cite web.archive.org, both FY2018.
 *
 *       ⚠ Check (f) is SCOPED TO KING COUNTY'S municipality_id, deliberately.
 *       It was originally specified as "exactly two rows in the entire budgets
 *       table", on the claim that no existing row cited an archive. That claim
 *       was false and the check would have failed: New Hampshire (state) already
 *       carries 16 archive-cited rows, FY2017-FY2024, predating this work
 *       entirely. So this asserts the King-County-scoped count of 2, and
 *       separately asserts the New Hampshire baseline is untouched at 16 — which
 *       together state the useful invariant: this load added exactly two
 *       archive-cited rows and disturbed no others.
 *
 * ⚠ HEADER TRAP: web.archive.org answers 498 to the desktop-Chrome User-Agent
 * that seattle.gov and cdn.kingcounty.gov REQUIRE. Headers are therefore chosen
 * per host; a single shared header set cannot satisfy both.
 *
 * Read-only against the DB. Network is HEAD/ranged-GET only — nothing is
 * downloaded in full. No AI calls. $0 spend. Exit 0 iff all six checks pass.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent */ }
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL — refusing to guess a production URL.'); process.exit(2); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

const SEATTLE_ID = '6e1e8ab5-c8dd-4a6b-bfd7-a31e57120493';
const KING_COUNTY_ID = '5d47592a-61d2-47ae-84ad-e869f1dd6208';
const NEW_HAMPSHIRE_ID = 'c54f6dbd-3f2a-453e-b0b9-259e377aef67';
const NEW_HAMPSHIRE_ARCHIVE_ROWS = 16; // pre-existing, FY2017-FY2024, not ours

const ENTITIES = [
  { key: 'Seattle', id: SEATTLE_ID, dir: path.join(ROOT, 'docs', 'Seattle'), pdf: (fy) => `seattle-${fy}-acfr.pdf`, expectRows: 34 },
  { key: 'King County', id: KING_COUNTY_ID, dir: path.join(ROOT, 'docs', 'KingCounty'), pdf: (fy) => `kingcounty-${fy}-acfr.pdf`, expectRows: 16 },
];

// ── per-host headers (see HEADER TRAP above) ────────────────────────────────
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const ISSUER_HEADERS = {
  'User-Agent': CHROME_UA,
  Accept: 'application/pdf,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
};
function headersFor(url) {
  // web.archive.org rejects the Chrome UA with HTTP 498; issuer hosts require it.
  return new URL(url).hostname.endsWith('web.archive.org') ? {} : ISSUER_HEADERS;
}

async function probeUrl(url) {
  const headers = headersFor(url);
  const attempt = async (method, extra) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60_000);
    try {
      const res = await fetch(url, { method, headers: { ...headers, ...extra }, redirect: 'follow', signal: ac.signal });
      // Drain a ranged body so the socket is released cleanly.
      if (method === 'GET') { try { await res.arrayBuffer(); } catch { /* ignore */ } }
      let length = res.headers.get('content-length');
      const range = res.headers.get('content-range');
      if (range && /\/(\d+)$/.test(range)) length = range.match(/\/(\d+)$/)[1];
      return { ok: true, status: res.status, type: (res.headers.get('content-type') || '').split(';')[0].trim(), length: length ? Number(length) : null };
    } finally { clearTimeout(timer); }
  };
  try {
    const head = await attempt('HEAD');
    if (head.status === 200 && head.length !== null) return head;
    // Some CDNs and the Wayback Machine answer HEAD poorly; a 1-byte ranged GET
    // reports the full size in Content-Range without downloading the document.
    const ranged = await attempt('GET', { Range: 'bytes=0-0' });
    if (ranged.status === 206 || ranged.status === 200) return { ...ranged, status: 200, via: 'ranged GET' };
    return head.status === 200 ? head : ranged;
  } catch (e) {
    return { ok: false, status: null, type: null, length: null, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
const results = [];
const record = (id, title, passed, detail) => { results.push({ id, title, passed, detail }); };

async function rowsFor(id) {
  const { data, error } = await sb.from('budgets')
    .select('fiscal_year,dataset_type,total_budget,source_url,source_date,data_source')
    .eq('municipality_id', id).order('fiscal_year').order('dataset_type');
  if (error) throw new Error(`budgets query failed: ${error.message}`);
  return data;
}

async function main() {
  console.log('=== Seattle + King County source-chain audit ===');
  console.log(`DB: ${SUPABASE_URL}\n`);

  const byEntity = {};
  for (const e of ENTITIES) byEntity[e.key] = await rowsFor(e.id);

  // ── (a) source_url present, correct per FY, resolves 200 application/pdf ───
  {
    const fail = [];
    const notes = [];
    for (const e of ENTITIES) {
      const rows = byEntity[e.key];
      if (rows.length !== e.expectRows) fail.push(`${e.key}: ${rows.length} rows, expected ${e.expectRows}`);

      const byFy = new Map();
      for (const r of rows) {
        if (!r.source_url) { fail.push(`${e.key} FY${r.fiscal_year} ${r.dataset_type}: source_url is NULL`); continue; }
        if (!String(r.fiscal_year).match(/^\d{4}$/)) continue;
        if (!r.source_url.includes(String(r.fiscal_year))) {
          fail.push(`${e.key} FY${r.fiscal_year} ${r.dataset_type}: source_url does not carry its fiscal year — ${r.source_url}`);
        }
        if (byFy.has(r.fiscal_year) && byFy.get(r.fiscal_year) !== r.source_url) {
          fail.push(`${e.key} FY${r.fiscal_year}: the two datasets cite DIFFERENT urls`);
        }
        byFy.set(r.fiscal_year, r.source_url);
      }
      // one document per FY, never shared between FYs
      const seen = new Map();
      for (const [fy, u] of byFy) {
        if (seen.has(u)) fail.push(`${e.key}: FY${fy} and FY${seen.get(u)} cite the SAME url — ${u}`);
        seen.set(u, fy);
      }

      for (const [fy, url] of [...byFy].sort((x, y) => x[0] - y[0])) {
        const probe = await probeUrl(url);
        const local = path.join(e.dir, e.pdf(fy));
        const localSize = existsSync(local) ? statSync(local).size : null;
        const okStatus = probe.status === 200;
        const okType = probe.type === 'application/pdf';
        if (!okStatus) fail.push(`${e.key} FY${fy}: ${url} → ${probe.status ?? 'network error'}${probe.error ? ` (${probe.error})` : ''}`);
        else if (!okType) fail.push(`${e.key} FY${fy}: content-type is "${probe.type}", not application/pdf — ${url}`);
        if (localSize === null) fail.push(`${e.key} FY${fy}: local PDF missing at ${local}`);
        else if (probe.length === null) notes.push(`${e.key} FY${fy}: server reported no length; byte-identity not checked`);
        else if (probe.length !== localSize) {
          fail.push(`${e.key} FY${fy}: served ${probe.length} bytes but the re-derivation read a ${localSize}-byte local copy — the cited url is NOT the document that was parsed`);
        }
        const size = probe.length === null ? '(no length)' : `${probe.length} B`;
        console.log(`  (a) ${e.key.padEnd(12)} FY${fy}  ${String(probe.status ?? 'ERR').padStart(3)} ${String(probe.type || '-').padEnd(15)} ${size.padStart(12)}` +
          `${probe.length !== null && probe.length === localSize ? '  == local pdf' : ''}${probe.via ? `  [${probe.via}]` : ''}`);
      }
    }
    for (const n of notes) console.log(`      note: ${n}`);
    record('a', 'every row has a non-null, correct-per-FY source_url resolving 200 application/pdf, byte-matching the parsed local copy', fail.length === 0, fail);
  }

  // ── (b) source_date = <FY>-12-31 ──────────────────────────────────────────
  {
    const fail = [];
    for (const e of ENTITIES) {
      for (const r of byEntity[e.key]) {
        const want = `${r.fiscal_year}-12-31`;
        const got = String(r.source_date ?? '').slice(0, 10);
        if (got !== want) fail.push(`${e.key} FY${r.fiscal_year} ${r.dataset_type}: source_date ${got || '(null)'} != ${want}`);
      }
    }
    record('b', 'source_date is <FY>-12-31 on every row', fail.length === 0, fail);
  }

  // ── (c) no data_sources residue ───────────────────────────────────────────
  {
    const { data, error } = await sb.from('data_sources').select('id,dataset_id')
      .or('dataset_id.like.seattle-%,dataset_id.like.kingcounty-%');
    if (error) throw new Error(`data_sources query failed: ${error.message}`);
    record('c', 'zero data_sources residue matching seattle-% or kingcounty-%', data.length === 0,
      data.map((d) => `residual dataset_id ${d.dataset_id}`));
  }

  // ── (d) no corrupted labels ───────────────────────────────────────────────
  {
    const fail = [];
    // "Taxes ", "Current ", "Capital Outlay ", "Debt Service " followed by more
    // text is the glued-parent signature: the group name welded onto its child.
    const GLUED = /^(taxes|current|capital\s+outlay|debt\s+service)\s+\S/i;
    const DASHRUN = /--/;
    let scanned = 0;
    for (const e of ENTITIES) {
      const { data: budgets } = await sb.from('budgets').select('id,fiscal_year,dataset_type').eq('municipality_id', e.id);
      const { data: cats } = await sb.from('budget_categories').select('id,budget_id,name').in('budget_id', budgets.map((b) => b.id));
      const { data: items } = await sb.from('budget_line_items').select('category_id,description').in('category_id', cats.map((c) => c.id));
      const bmeta = new Map(budgets.map((b) => [b.id, `FY${b.fiscal_year} ${b.dataset_type}`]));
      const cmeta = new Map(cats.map((c) => [c.id, `${bmeta.get(c.budget_id)} / ${c.name}`]));
      for (const c of cats) {
        scanned++;
        if (DASHRUN.test(c.name)) fail.push(`${e.key} ${bmeta.get(c.budget_id)}: category label contains "--" — "${c.name}"`);
        if (GLUED.test(c.name)) fail.push(`${e.key} ${bmeta.get(c.budget_id)}: category label looks glued — "${c.name}"`);
      }
      for (const it of items) {
        scanned++;
        if (DASHRUN.test(it.description)) fail.push(`${e.key} ${cmeta.get(it.category_id)}: line-item label contains "--" — "${it.description}"`);
        if (GLUED.test(it.description)) fail.push(`${e.key} ${cmeta.get(it.category_id)}: line-item label looks glued — "${it.description}"`);
      }
    }
    console.log(`\n  (d) labels scanned: ${scanned}`);
    record('d', 'no label contains a "--" dash run or a glued parent prefix', fail.length === 0, fail);
  }

  // ── (e) the units landed ──────────────────────────────────────────────────
  {
    const fail = [];
    const want = [
      { key: 'Seattle', id: SEATTLE_ID, fy: 2024, ds: 'operating', expect: 2390575000 },
      { key: 'King County', id: KING_COUNTY_ID, fy: 2024, ds: 'operating', expect: 1137458000 },
    ];
    for (const w of want) {
      const { data } = await sb.from('budgets').select('total_budget')
        .eq('municipality_id', w.id).eq('fiscal_year', w.fy).eq('dataset_type', w.ds).maybeSingle();
      const got = data ? Number(data.total_budget) : null;
      console.log(`  (e) ${w.key.padEnd(12)} FY${w.fy} ${w.ds}: ${got} (expected ${w.expect})`);
      if (got !== w.expect) fail.push(`${w.key} FY${w.fy} ${w.ds}: ${got} != ${w.expect}`);
    }
    record('e', 'units landed — FY2024 operating totals are exactly the dollar figures, not thousands', fail.length === 0, fail);
  }

  // ── (f) archive citations, SCOPED TO KING COUNTY ──────────────────────────
  {
    const fail = [];
    const kcArchive = byEntity['King County'].filter((r) => (r.source_url || '').includes('web.archive.org'));
    if (kcArchive.length !== 2) fail.push(`King County cites web.archive.org on ${kcArchive.length} rows, expected exactly 2`);
    for (const r of kcArchive) {
      if (r.fiscal_year !== 2018) fail.push(`King County archive citation on FY${r.fiscal_year} ${r.dataset_type}, expected FY2018 only`);
      if (!(r.data_source || '').includes('(via Internet Archive)')) {
        fail.push(`King County FY${r.fiscal_year} ${r.dataset_type} cites an archive but its data_source label does not say so`);
      }
    }
    const seaArchive = byEntity.Seattle.filter((r) => (r.source_url || '').includes('web.archive.org'));
    if (seaArchive.length !== 0) fail.push(`Seattle cites web.archive.org on ${seaArchive.length} rows, expected 0`);

    // The pre-existing New Hampshire baseline must be undisturbed.
    const { data: nh, error: nhErr } = await sb.from('budgets').select('fiscal_year,dataset_type')
      .eq('municipality_id', NEW_HAMPSHIRE_ID).like('source_url', '%web.archive.org%');
    if (nhErr) throw new Error(`New Hampshire query failed: ${nhErr.message}`);
    if (nh.length !== NEW_HAMPSHIRE_ARCHIVE_ROWS) {
      fail.push(`New Hampshire's pre-existing archive-cited rows changed: ${nh.length}, expected ${NEW_HAMPSHIRE_ARCHIVE_ROWS}`);
    }
    const { count: appWide } = await sb.from('budgets').select('*', { count: 'exact', head: true })
      .like('source_url', '%web.archive.org%');

    console.log(`\n  (f) King County archive-cited rows: ${kcArchive.length} (${kcArchive.map((r) => `FY${r.fiscal_year} ${r.dataset_type}`).join(', ')})`);
    console.log(`  (f) Seattle archive-cited rows:     ${seaArchive.length}`);
    console.log(`  (f) New Hampshire (pre-existing):   ${nh.length} — expected ${NEW_HAMPSHIRE_ARCHIVE_ROWS}, untouched by this load`);
    console.log(`  (f) application-wide total:         ${appWide} — this is NOT expected to be 2; the original`);
    console.log('      "exactly two rows in the entire budgets table" wording was false and is superseded.');
    record('f', 'exactly two KING COUNTY rows cite web.archive.org, both FY2018, with New Hampshire\'s 16 pre-existing rows untouched', fail.length === 0, fail);
  }

  // ── verdict ───────────────────────────────────────────────────────────────
  console.log('\n--- audit results ---');
  for (const r of results) {
    console.log(`  (${r.id}) ${r.passed ? 'PASS' : 'FAIL'} — ${r.title}`);
    if (!r.passed) for (const d of r.detail) console.log(`         • ${d}`);
  }
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0 ? 'RESULT: PASS — all six checks pass.' : `RESULT: FAIL — ${failed.length} of ${results.length} checks failed.`}`);
  return failed.length === 0 ? 0 : 1;
}

// Set exitCode and let the event loop drain rather than calling process.exit():
// an abrupt exit races undici's keep-alive socket into a Windows libuv
// UV_HANDLE_CLOSING assertion. The unref'd timer is a backstop if an idle
// keep-alive socket holds the process open.
main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Fatal:', e); process.exitCode = 2; })
  .finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref(); });
