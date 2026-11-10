#!/usr/bin/env node
/**
 * npm run verify:source-urls
 *
 * ⚠⚠⚠ IS THE LINK UNDER THE CHART STILL A LINK?
 *
 * Every other gate in this repo reads MONEY or IDENTITY. The tie gate compares
 * components to a printed total; the per-capita guard divides by population;
 * the frozen invariant digests per-row totals; the scope sweep reads the
 * `data_source` string. NOT ONE OF THEM READS A URL — so a citation can be
 * wrong, dead, or pointing at a different document entirely, and every check
 * still passes.
 *
 * That is not hypothetical. In 2026-10 the Federal Audit Clearinghouse
 * answered its PDF endpoint with a 302 to a presigned S3 object carrying
 * `X-Amz-Expires=30` — THIRTY SECONDS — and `fetchAkBoroughs.mjs` recorded the
 * redirect target, following this repo's usual and usually-correct rule of
 * citing the URL that actually served the bytes. **227 Alaska rows shipped a
 * link that was dead before the load that wrote it had finished.** Every figure
 * on those pages was right. Every gate was green. The only broken thing was the
 * one claim the reader is asked to check for themselves.
 *
 * ── ⭐⭐ THE SAME BARGAIN AS THE OTHER PUBLISHER GATES ──────────────────────
 *
 * There is no stored copy to compare against here, and no baseline that could
 * be right while the web is wrong. A citation resolves today or it does not,
 * and only the host can say — which makes this the purest form of the rule the
 * rest of this fleet follows: **ask the publisher, never our own copy.** See
 * `verifyXlsxRowCoverage.mjs` and `lib/outOfPeriodPublisher.mjs`.
 *
 * ── WHAT IT ASKS, AND WHAT IT COSTS ────────────────────────────────────────
 *
 * 1,857 distinct URLs over 118 hosts cover 560,684 budgets (2026-11-09). It
 * asks each DISTINCT URL once — HEAD first, then a one-byte `Range` GET for the
 * many government servers that 405 on HEAD, then curl for the handful whose WAF
 * matches Node's TLS fingerprint. Requests to one host are serialised with a
 * courtesy pause; different hosts run in parallel. Nothing is downloaded.
 *
 * ── ⚠⚠ THE TWO THINGS THIS GATE REFUSES TO DO ──────────────────────────────
 *
 * 1. **Call an unanswered host a pass.** `unreachable` is a failure unless a
 *    human has declared it in `scripts/data/sourceUrlExceptions.mjs` with a
 *    reason. "We could not check" must never be recorded as "we checked".
 * 2. **Accept a 200 as proof.** A WAF block page, a login wall and a themed 404
 *    all arrive as `200 text/html`. When the URL itself promises a document —
 *    it ends `.pdf`, `.xlsx`, `.csv` — HTML is a FAILURE. A URL with no
 *    document extension promises nothing, so nothing is asserted about it.
 *
 * ── ⚠ WHAT IT CANNOT SEE ───────────────────────────────────────────────────
 *
 * That the document behind a live URL is the RIGHT document. A 200 and a
 * matching content-type prove the link resolves to something of the promised
 * kind; whether that PDF is the FY2023 ACFR it claims to be is a question only
 * a human reading it can settle. This gate closes "the link is dead", not "the
 * link is wrong". ⛔ Do not read a green run as saying the citations are
 * correct — only that they are LIVE.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  probeUrl,
  classifyCitations,
  citationsAreClean,
  judgeUncited,
  censusUncited,
  citationShape,
  BROWSER_HEADERS,
} from './lib/sourceUrlProbe.mjs';
import { SOURCE_URL_EXCEPTIONS } from './data/sourceUrlExceptions.mjs';
import { PUBLISHER_OUTAGES } from './data/publisherOutages.mjs';
import { UNCITED_BASELINE } from './data/sourceUrlCoverage.mjs';

/** Hosts asked in parallel. Requests to ONE host stay serial. */
const HOST_CONCURRENCY = 8;
/** Courtesy pause between two requests to the same host. */
const PER_HOST_PAUSE_MS = 150;

// ⚠ Lazy: importing this module must not require credentials, so --help works
// with nothing set. Same reason as verifyXlsxRowCoverage.mjs.
let _db = null;
function db() {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required');
  _db = createClient(url, key);
  return _db;
}

/**
 * curl, for the hosts that refuse Node outright.
 *
 * ⚠⚠ mckinneytexas.org answers `fetch()` with a flat 403 — and NOT for want of
 * headers: the identical User-Agent, Sec-Fetch trio, Referer and Accept all
 * still 403 while curl is let straight through, so it is the TLS/client
 * fingerprint being matched, not anything Node can set. `xlsxRows.downloadXLSX`
 * already falls back this way. Without it this gate would call McKinney's own
 * citation dead and be reporting on Node rather than on McKinney.
 */
function curlProbe(url) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tt-url-'));
  const sink = path.join(dir, 'body.bin');
  try {
    const args = ['-sS', '-L', '-r', '0-0', '--max-time', '25', '-o', sink, '-w', '%{http_code} %{content_type}'];
    for (const [k, v] of Object.entries(BROWSER_HEADERS)) args.push('-H', `${k}: ${v}`);
    args.push(url);
    const r = spawnSync('curl', args, { encoding: 'utf8' });
    if (r.error) throw new Error(`curl is not available: ${r.error.message}`);
    if (r.status !== 0) throw new Error(r.stderr?.trim() || `curl exit ${r.status}`);
    const [code, ...rest] = String(r.stdout).trim().split(/\s+/);
    return { status: Number(code), contentType: rest.join(' ') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Read a whole set-returning RPC, in pages, under an explicit TOTAL ORDER.
 *
 * ⚠⚠⚠ PostgREST CAPS A RESPONSE AT 1,000 ROWS AND SAYS NOTHING. Both censuses
 * here are over it — 1,857 distinct URLs, and ~1,060 distinct `data_source`
 * values with no URL at all — so a plain `.rpc()` returns a TRUNCATED answer
 * that looks complete. It did, on the first run of this gate: the uncited
 * census came back as 21,477 budgets across 63 families, with the whole
 * federal outlays family and every West Hollywood demand register simply
 * ABSENT. The true figures are 24,960 and 75. Nothing errored.
 *
 * ⚠ ORDER IS NOT OPTIONAL, AND IT MUST BE TOTAL. Without an ORDER BY, Postgres
 * may return page 2 in an order that overlaps page 1, so rows are silently
 * duplicated and others never appear — and the duplicate and the miss CANCEL,
 * so the row count stays exactly right while the row SET is wrong. Both
 * functions below GROUP BY the column they are ordered on, so that column is
 * unique within the result and the order is total.
 * ⭐ BATCHING IS NOT PAGING — see reference_paged_reads_need_total_order, where
 * this repo has now broken the same way seven times.
 *
 * ⚠⚠ WRITTEN OUT TWICE ON PURPOSE, NOT FACTORED INTO `rpcAll(fn, orderBy)`.
 * That helper was the first draft and `tests/pagedReadOrdering.test.mjs`
 * rejected it — correctly. The guard reads the source to check that every
 * paged read ends its ordering chain on a provably unique column, and a helper
 * taking the RPC name and the sort column as VARIABLES makes that
 * unverifiable: neither the guard nor a human reader can see which column is
 * being sorted on. The duplication is the point.
 */
const PAGE = 1000;

/** Every distinct citation, paged under a total order (`source_url` is the GROUP BY key). */
async function fetchSourceUrlCensus() {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().schema('treasury').rpc('source_url_census')
      .select('*')
      .order('source_url', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`source_url_census failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** Every uncited source, paged under a total order (`data_source` is the GROUP BY key). */
async function fetchUncitedCensus() {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().schema('treasury').rpc('uncited_budget_census')
      .select('*')
      .order('data_source', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`uncited_budget_census failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** Ask every URL, host by host, politely and in parallel across hosts. */
async function observeAll(rows, { onProgress } = {}) {
  const byHost = new Map();
  for (const row of rows) {
    const shape = citationShape(row.source_url);
    const host = shape.host || '(unparseable)';
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(row);
  }

  const hosts = [...byHost.keys()];
  const observations = [];
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < hosts.length) {
      const host = hosts[cursor++];
      for (const row of byHost.get(host)) {
        const probe = await probeUrl(row.source_url, { curlImpl: async (u) => curlProbe(u) });
        observations.push({ ...probe, ...row, url: row.source_url });
        done += 1;
        if (onProgress) onProgress(done, rows.length, host);
        await sleep(PER_HOST_PAUSE_MS);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(HOST_CONCURRENCY, hosts.length) }, worker));
  return { observations, hosts: hosts.length };
}

const n = (x) => Number(x).toLocaleString('en-US');
const where = (o) => `${o.sample_entity || o.sample_source || '?'}${o.sample_state ? `, ${o.sample_state}` : ''}`
  + `${o.sample_fiscal_year ? ` FY${o.sample_fiscal_year}` : ''}`;

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      census: { type: 'boolean', default: false },
      host: { type: 'string' },
      limit: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log('verify:source-urls [--host <substring>] [--limit <n>] [--census]');
    console.log('  --census  print the uncited-budget census as a pasteable baseline, ask nothing');
    console.log('  --host    probe only URLs whose host contains this substring');
    console.log('  --limit   probe only the first N distinct URLs (smoke run)');
    return 0;
  }

  // ── The budgets that cite NOTHING ────────────────────────────────────────
  const uncitedRows = await fetchUncitedCensus();
  const observedUncited = censusUncited(uncitedRows);

  if (values.census) {
    const entries = Object.entries(observedUncited.families).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    console.log('// paste into scripts/data/sourceUrlCoverage.mjs');
    console.log('families: {');
    for (const [f, c] of entries) console.log(`  ${JSON.stringify(f)}: ${c},`);
    console.log(`}, // total ${observedUncited.total}`);
    return 0;
  }

  // ── Every distinct citation ──────────────────────────────────────────────
  const census = await fetchSourceUrlCensus();

  let rows = census;
  // ⚠⚠ A FILTER MUST SCOPE THE EXPECTATION, NOT JUST THE OBSERVATION. #360
  // learned this the hard way: `--source` narrowed what was looked at but not
  // what was expected, and 21 untouched registry entries read as "stale" —
  // absence reported as deletion. So the exceptions list is narrowed by the
  // SAME predicate below.
  let declared = SOURCE_URL_EXCEPTIONS;
  // ⚠⚠ THE OUTAGE LIST IS SCOPED BY THE SAME PREDICATE, for the same reason.
  // An outage declaration whose host is not in the filtered set would otherwise
  // report as stale on every narrowed run — absence read as recovery, which is
  // the #360 defect wearing a different hat.
  let outages = PUBLISHER_OUTAGES;
  if (values.host) {
    const needle = values.host.toLowerCase();
    const hit = (u) => String(u).toLowerCase().includes(needle);
    rows = rows.filter((r) => hit(r.source_url));
    declared = declared.filter((d) => hit(d.url));
    outages = outages.filter((o) => hit(o.host));
  }
  if (values.limit) {
    const lim = Number(values.limit);
    rows = rows.slice(0, lim);
    const kept = new Set(rows.map((r) => r.source_url));
    declared = declared.filter((d) => kept.has(d.url));
    // ⚠⚠⚠ AND A --limit RUN MUST DECLARE NO OUTAGE AT ALL. The excusal rule is
    // "every citation on this host still fails"; a truncated run can only see
    // some of them, so it could excuse a host on a sample while a URL it never
    // asked about is serving fine. A smoke run must not be able to bless one.
    outages = [];
  }

  console.log(`asking ${n(rows.length)} distinct citation(s) covering ${n(rows.reduce((a, r) => a + Number(r.budgets), 0))} budget(s)…`);
  const started = Date.now();
  let lastPrint = 0;
  const { observations, hosts } = await observeAll(rows, {
    onProgress: (doneCount, total) => {
      if (Date.now() - lastPrint < 5000) return;
      lastPrint = Date.now();
      process.stdout.write(`  ${n(doneCount)}/${n(total)}\r`);
    },
  });
  console.log(`  asked ${n(observations.length)} URL(s) across ${n(hosts)} host(s) in ${Math.round((Date.now() - started) / 1000)}s`);

  const c = classifyCitations(observations, declared, outages);
  const u = judgeUncited(observedUncited, UNCITED_BASELINE);

  console.log(`\n✅ live: ${n(c.ok.length)}`);
  if (c.confirmed.length) console.log(`ℹ️  declared unreachable: ${n(c.confirmed.length)}`);

  let failed = false;

  // ── ⭐⭐ A PUBLISHER THAT IS DOWN, NOT A DOCUMENT THAT IS GONE ───────────
  //
  // A NOTICE, deliberately. These citations are believed CORRECT; what cannot
  // be done right now is confirm them. Reporting them as dead would demand a
  // repair that would damage the data — see scripts/data/publisherOutages.mjs.
  if (c.publisherDown.length) {
    const byHost = new Map();
    for (const r of c.publisherDown) {
      const h = r.outage.host;
      if (!byHost.has(h)) byHost.set(h, { outage: r.outage, rows: [], budgets: 0 });
      const g = byHost.get(h);
      g.rows.push(r);
      g.budgets += Number(r.budgets ?? 0);
    }
    console.log(`\nℹ️  PUBLISHER OFFLINE (${n(c.publisherDown.length)} citation(s)) — not treated as dead, and not treated as confirmed either:`);
    for (const [host, g] of byHost) {
      console.log(`  ${host} — down since ${g.outage.began}, ${n(g.rows.length)} citation(s) over ${n(g.budgets)} budget(s)`);
      console.log(`     observed ${g.outage.observedOn}; this declaration EXPIRES ${g.outage.recheckAfter}, after which this run fails`);
      console.log(`     “${g.outage.evidence.slice(0, 120)}…”`);
    }
    console.log('  ⚠ These links are dead FOR READERS while the outage lasts. The repair is the');
    console.log('    publisher coming back, not a new URL — there is no live file to check one against.');
  }
  if (c.expiredOutages.length) {
    failed = true;
    console.error(`\n⛔ OUTAGE DECLARATION EXPIRED (${c.expiredOutages.length}) — nobody has looked since:`);
    for (const o of c.expiredOutages) {
      console.error(`  ${o.host}: ${o.why_expired}. Re-probe a DATA path (never the homepage), then extend it or repair the URLs.`);
    }
  }
  if (c.staleOutages.length) {
    failed = true;
    console.error(`\n⛔ OUTAGE DECLARATION NO LONGER TRUE (${c.staleOutages.length}):`);
    for (const o of c.staleOutages) {
      console.error(`  ${o.host}: ${o.why_stale}`);
    }
  }

  if (c.uncitable.length) {
    failed = true;
    console.error(`\n⛔⛔ UNCITABLE (${c.uncitable.length}) — these cannot work for a reader, whatever we write about them:`);
    for (const r of c.uncitable) console.error(`  ${where(r)}\n     ${r.url}\n     ${r.detail}`);
  }
  if (c.dead.length) {
    failed = true;
    console.error(`\n⛔ DEAD (${c.dead.length}) — the publisher says this document is gone. Repair the URL; do not annotate it:`);
    for (const r of c.dead) console.error(`  ${where(r)} — ${r.detail}\n     ${r.url}`);
  }
  if (c.wrongType.length) {
    failed = true;
    console.error(`\n⛔ SERVED THE WRONG THING (${c.wrongType.length}) — a 200 is not proof:`);
    for (const r of c.wrongType) console.error(`  ${where(r)}\n     ${r.url}\n     ${r.detail}`);
  }
  if (c.unreachable.length) {
    failed = true;
    console.error(`\n⛔ COULD NOT BE ASKED (${c.unreachable.length}) — NOT treated as agreement:`);
    for (const r of c.unreachable) console.error(`  ${where(r)} — ${r.detail}\n     ${r.url}`);
    console.error('  If a host genuinely refuses automated clients, check it BY HAND and declare it');
    console.error('  in scripts/data/sourceUrlExceptions.mjs with the date you looked.');
  }
  if (c.stale.length) {
    failed = true;
    console.error(`\n⚠ STALE DECLARATIONS (${c.stale.length}) — the repo carries a sentence about the web that is no longer true. Delete them:`);
    for (const r of c.stale) console.error(`  ${r.url}\n     ${r.detail}`);
  }

  // ── The uncited ratchet ──────────────────────────────────────────────────
  console.log(`\nbudgets citing nothing at all: ${n(u.observedTotal)} across ${n(Object.keys(observedUncited.families).length)} families (baseline ${n(u.baselineTotal)})`);
  if (u.appeared.length) {
    failed = true;
    console.error(`\n⛔ A FAMILY THAT CITED SOMETHING NOW CITES NOTHING (${u.appeared.length}):`);
    for (const g of u.appeared) console.error(`  ${g.family}: ${n(g.count)} uncited budget(s), never seen before`);
  }
  if (u.grown.length) {
    failed = true;
    console.error(`\n⛔ UNCITED BUDGETS GREW (${u.grown.length}) — a load shipped rows with no source link:`);
    for (const g of u.grown) console.error(`  ${g.family}: ${n(g.count)}, was ${n(g.expected)}`);
  }
  if (u.paidDown.length) {
    console.log(`ℹ️  paid down (${u.paidDown.length}) — lower the baseline in scripts/data/sourceUrlCoverage.mjs:`);
    for (const g of u.paidDown) console.log(`  ${g.family}: ${n(g.count)}, baseline ${n(g.expected)}`);
  }

  if (failed) {
    console.error('\n❌ verify:source-urls FAILED.');
    console.error('   ⚠ A green run says the citations are LIVE, never that they are CORRECT —');
    console.error('     whether a live PDF is the document it claims to be needs a human.');
    return 1;
  }
  console.log('\n✅ every stored citation resolves, and no family lost its source link.');
  return 0;
}

// ⚠ `process.argv[1]` is undefined under `node -e`, and pathToFileURL throws on
// undefined — which turns "imported, not run" into a crash.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  });
}
