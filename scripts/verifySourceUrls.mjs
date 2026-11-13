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
 *
 * ── ⭐⭐⭐ AND FOR 937 BUDGETS IT WAS ASKING THE WRONG COLUMN ENTIRELY ──────
 *
 * Everything above reads `treasury.budgets.source_url`. That is the column TT
 * WRITES. It is not, for every budget, the column a reader is SHOWN.
 *
 * The API picks the source chip's href in two branches (`mapBudget`,
 * EV-Accounts `treasuryService.ts`), and the FIRST one does not look at
 * `source_url` at all: when a budget carries a `data_source_id`, the href comes
 * from `treasury.source_registry.url` and `treasury.data_sources.base_url`.
 * **937 budgets take that branch, over 20 distinct URLs, and not one of those
 * 20 had ever been asked by any gate in this repo.** One of them was a 404 —
 * West Hollywood's open-checkbook page, published to every reader of eight
 * demand registers for an unknown length of time.
 *
 * ⚠⚠ ASK WHAT THE API PUBLISHES, NOT WHAT THE CLIENT RENDERS. `data_source_info`
 * carries TWO URL fields and both reach the browser; which one the chip links to
 * is a single `||` in `src/App.tsx`. The first draft of `reader_link_census()`
 * resolved that ternary and asked only the winner — and reported West Hollywood
 * CLEAN, because `datasetUrl` wins for a city and `data.weho.org` answers 200
 * while the dead `url` rode along in the same JSON object. A gate whose coverage
 * depends on a component's ternary is not coverage.
 *
 * ⚠⚠ Worse than dead: 704 of those 937 ALREADY HOLD a precise `source_url` and
 * are shown a portal root instead — 696 CA State Controller budgets across 87
 * entities sent to `bythenumbers.sco.ca.gov` while TT holds the two exact
 * dataset pages it parsed. That is #380's landing-page defect one layer up, and
 * its repair is in ev-accounts, not here. This gate's job is that it can never
 * again be true that nobody is looking.
 *
 * So the run now asks THREE censuses, and they mean different things:
 *
 *   1. `source_url_census()`      — what TT stored.           Citation rules.
 *   2. `reader_link_census()`     — what the reader is shown. Citation rules.
 *   3. `source_endpoint_census()` — every `data_sources.base_url`.
 *                                   See scripts/lib/sourceEndpointJudge.mjs:
 *                                   a sync endpoint, a provenance note and a
 *                                   path on somebody's laptop are three
 *                                   different promises and get three verdicts.
 */
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  probeUrl,
  createHostPacer,
  judgeProbe,
  classifyCitations,
  citationsAreClean,
  judgeUncited,
  censusUncited,
  citationShape,
} from './lib/sourceUrlProbe.mjs';
import { curlProbe } from './lib/curlProbe.mjs';
import { askWaybackAvailability, askWaybackCdx } from './lib/waybackCitation.mjs';
import { judgeEndpoints, endpointsAreClean } from './lib/sourceEndpointJudge.mjs';
import { judgeDrift, pickDriftSample, sampleKey } from './lib/readerLinkDrift.mjs';
import {
  SCO_ENTITY_HOSTS, scoCorpus, scoBranch, judgeScoTie, scoTotalsUrl, isScoEntityUrl,
} from './lib/scoEntityCitation.mjs';
import { SOURCE_URL_EXCEPTIONS } from './data/sourceUrlExceptions.mjs';
import { PUBLISHER_OUTAGES } from './data/publisherOutages.mjs';
import { UNCITED_BASELINE } from './data/sourceUrlCoverage.mjs';
import { SOURCE_ENDPOINT_BASELINE } from './data/sourceEndpointBaseline.mjs';

/** Hosts asked in parallel. Requests to ONE host stay serial. */
const HOST_CONCURRENCY = 8;
/** Courtesy pause between two requests to the same host, before it objects. */
const PER_HOST_PAUSE_MS = 150;

/**
 * ⭐⭐ ONE PACER FOR THE WHOLE RUN, SHARED BY BOTH PASSES.
 *
 * The citations pass meets web.archive.org 27 times; the `base_url` pass meets
 * it again minutes later. A pacer per pass would throw away what the first one
 * learned and re-trip the limiter from a standing start — and on 2026-11-11
 * both passes did fail, 16 citations and 7 endpoints. See `createHostPacer`.
 */
const hostPacer = createHostPacer({ basePauseMs: PER_HOST_PAUSE_MS });

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

// ⚠ `curlProbe` moved to scripts/lib/curlProbe.mjs on 2026-11-12, when
// scripts/citeNonStatementSources.mjs became its second caller. One definition,
// so the two cannot drift. Behaviour unchanged.

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

/**
 * Every distinct citation, KEYSET-paged on `source_url` (unique in the result).
 *
 * ⚠⚠⚠ NOT `.range()` OVER `source_url_census()`. PostgREST re-runs the whole
 * function for every page, and that function scans all of `treasury.budgets`
 * twice and sorts it: 377 MB read from disk PER PAGE, 27 pages per run, 249 GB
 * in the 19 hours measured on 2026-11-13 — the largest Disk IO consumer on the
 * whole E.V Backend project (ev-cto decision 0038). `source_url_census_page`
 * reads only the URLs after `after_url`, from a covering index, so a full run
 * reads the index once. See 20261113120000_census_pages_read_only_their_slice.sql.
 *
 * ⚠ The function returns rows ordered by `source_url`, one per URL, so the last
 * row's URL is the next page's key — no row can be skipped or repeated. Page
 * size stays under PostgREST's 1,000-row cap.
 */
async function fetchSourceUrlCensus() {
  const out = [];
  let afterUrl = null;
  for (;;) {
    const { data, error } = await db().schema('treasury')
      .rpc('source_url_census_page', { after_url: afterUrl, page_size: PAGE });
    if (error) throw new Error(`source_url_census_page failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
    afterUrl = data[data.length - 1].source_url;
  }
}

/**
 * What a READER's chip resolves to, for the budgets whose href is NOT
 * `budgets.source_url`. Paged under the same total order for the same reason.
 *
 * ⚠ The RPC names its first column `source_url` even though it is not one —
 * so these rows drop straight into `observeAll()` and `classifyCitations()`
 * beside the stored citations. Same verdicts, same exceptions file, one ladder.
 * A reader cannot tell which column their broken link came out of, and neither
 * should the gate's bar for it.
 */
async function fetchReaderLinkCensus() {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().schema('treasury').rpc('reader_link_census')
      .select('*')
      .order('source_url', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`reader_link_census failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/**
 * ⭐ THE PUBLIC API, ASKED AS A READER WOULD ASK IT.
 *
 * No key, no service role — this is the same endpoint `npm run dev` proxies
 * to. The point is to see what is actually served, so reading it any other way
 * would defeat the exercise.
 */
const READER_API = process.env.TT_API_URL || 'https://accounts-api.empowered.vote';

const cityIndexByState = new Map();
const budgetsByCity = new Map();

async function apiJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Resolve `(entity, state)` to a municipality id through the API's own index. */
async function resolveCityId(entity, state) {
  if (!state) return null;
  if (!cityIndexByState.has(state)) {
    const rows = await apiJson(
      `${READER_API}/api/treasury/cities?state=${encodeURIComponent(state)}&fields=index&datasets=summary`,
    );
    const byName = new Map();
    for (const r of rows) if (r && r.name) byName.set(r.name.toLowerCase(), r.id);
    cityIndexByState.set(state, byName);
  }
  return cityIndexByState.get(state).get(String(entity).toLowerCase()) || null;
}

async function liveBudgetsFor(entity, state) {
  const id = await resolveCityId(entity, state);
  if (!id) return null;
  if (!budgetsByCity.has(id)) {
    budgetsByCity.set(id, await apiJson(`${READER_API}/api/treasury/cities/${id}/budgets`));
  }
  return budgetsByCity.get(id);
}

/** Every distinct `data_sources.base_url`, with what it is for. */
async function fetchSourceEndpointCensus() {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().schema('treasury').rpc('source_endpoint_census')
      .select('*')
      .order('source_url', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`source_endpoint_census failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}

/** Every uncited source, paged under a total order (`data_source` is the GROUP BY key). */
/**
 * ⭐ TIE EVERY SCO FIGURE TO THE PUBLISHER'S OWN.
 *
 * Replaces a liveness probe that could not fail. One request per
 * (corpus, branch, year) returns every entity's total for it, so 92 calls
 * cover 24,354 citations — asking the publisher 24,354 times for what it will
 * hand over in 92 would be rude as well as slow.
 */
async function fetchScoCitedBudgets() {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().schema('treasury').from('budgets')
      .select('id, fiscal_year, dataset_type, total_budget::text, source_url, municipality_id')
      .like('source_url', '%.bythenumbers.sco.ca.gov/#!%')
      .order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`sco budgets read failed: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  const munis = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db().schema('treasury').from('municipalities')
      .select('id, name, entity_type').eq('state', 'CA')
      .order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`municipalities read failed: ${error.message}`);
    munis.push(...data);
    if (data.length < PAGE) break;
  }
  const byId = new Map(munis.map((m) => [m.id, m]));
  return out.map((b) => {
    const m = byId.get(b.municipality_id);
    return {
      id: b.id,
      entityName: m ? m.name : null,
      entityType: m ? m.entity_type : null,
      fiscalYear: b.fiscal_year,
      datasetType: b.dataset_type,
      total: b.total_budget,
      source_url: b.source_url,
    };
  });
}

async function fetchScoTotals(keys) {
  const totals = new Map();
  let failed = 0;
  for (const key of keys) {
    const [corpus, branch, year] = key.split('|');
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt += 1) {
      try {
        const j = await apiJson(scoTotalsUrl(corpus, branch, year));
        for (const e of (j.entities || [])) totals.set(`${key}|${e.org1}`, Number(e.total));
        ok = true;
      } catch {
        await new Promise((r) => { setTimeout(r, 1200 * (attempt + 1)); });
      }
    }
    if (!ok) failed += 1;
  }
  return { totals, failed };
}

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

/**
 * Ask every URL, host by host, politely and in parallel across hosts.
 *
 * ⚠ `probeImpl`/`sleepImpl` exist so the pacing is testable without the
 * network. Nothing in the gate passes them.
 */
export async function observeAll(rows, {
  onProgress,
  probeImpl = (url) => probeUrl(url, {
    curlImpl: async (u) => curlProbe(u),
    cdxImpl: (capture) => askWaybackCdx(capture),
    waybackImpl: (capture) => askWaybackAvailability(capture),
  }),
  sleepImpl = sleep,
  pacer = hostPacer,
} = {}) {
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
        const probe = await probeImpl(row.source_url);
        observations.push({ ...probe, ...row, url: row.source_url });
        done += 1;
        if (onProgress) onProgress(done, rows.length, host);
        // ⚠⚠ THE PAUSE IS READ AFTER THE ANSWER, NOT BEFORE IT. What this URL
        // was told is the only warning the URLs behind it will ever get.
        pacer.record(host, probe);
        await sleepImpl(pacer.pauseFor(host));
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

  // ── Every distinct citation, plus every link a reader is actually shown ──
  //
  // ⚠⚠ THE UNION, NOT EITHER ONE. `source_url_census()` is what TT stored;
  // `reader_link_census()` is what the API hands the chip for the 937 budgets
  // whose `data_source_id` makes the API ignore `source_url`. A URL in only
  // one of them still has to resolve: a stored citation nobody is shown is
  // still a claim this repo makes, and a shown link we never stored is still
  // the thing a reader clicks.
  //
  // ⚠ Deduped by URL — the two censuses CAN name the same URL (a registry
  // href that is also somebody's stored citation), and asking a publisher the
  // same question twice in one run is rude, not rigorous.
  const census = await fetchSourceUrlCensus();
  const readerLinks = await fetchReaderLinkCensus();
  const storedUrls = new Set(census.map((r) => r.source_url));
  const readerOnly = readerLinks.filter((r) => !storedUrls.has(r.source_url));

  let rows = [...census, ...readerOnly];

  // ── ⛔⛔ A FAMILY WHOSE LIVENESS CANNOT MEAN ANYTHING ─────────────────────
  //
  // The CA State Controller's per-entity view is an Angular `#!` route, and a
  // fragment NEVER REACHES THE SERVER. Measured 2026-11-11: a real entity, a
  // fake entity and complete nonsense all return the same 236,927-byte shell.
  // So probing these would return 200 for every one of 24,354 citations
  // whether or not the entity exists — hours of runtime and ~24k requests to a
  // state government site, in exchange for a number that can only say "yes".
  //
  // ⭐ They are NOT unchecked. `scoTieCensus()` below asks the publisher's own
  // totals API — one call per (corpus, branch, year), 92 in all — and compares
  // every stored figure to theirs. A 200 says a server answered; a tie says
  // the number is the publisher's. That is the stronger claim, and unlike a
  // liveness probe on a fragment route, it can fail.
  const scoEntityRows = rows.filter((r) => SCO_ENTITY_HOSTS.some(
    (h) => typeof r.source_url === 'string' && r.source_url.includes(`://${h}/`)));
  rows = rows.filter((r) => !scoEntityRows.includes(r));

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

  // ⚠⚠ #360's rule again: a filter must scope the EXPECTATION, not just the
  // observation. `readerOnly` is reported on below, so a narrowed run must
  // narrow it by the SAME predicate — otherwise `--host bythenumbers` prints
  // a finding about hosts it deliberately never asked.
  //
  // ⚠ `readerLinksInScope` used to sit here too, feeding the landing-page
  // report. That report is gone (the defect it described shipped a fix in
  // ev-accounts#1372), and its successor — the live-API drift check — is
  // skipped outright on a narrowed run rather than scoped, because a sample
  // drawn from a filtered list reports on whatever survived the filter.
  const asked = new Set(rows.map((r) => r.source_url));
  const readerOnlyInScope = readerOnly.filter((r) => asked.has(r.source_url));

  console.log(`asking ${n(rows.length)} distinct citation(s) covering ${n(rows.reduce((a, r) => a + Number(r.budgets), 0))} budget(s)…`);
  if (readerOnlyInScope.length) {
    const unlinked = readerOnlyInScope.filter((r) => !r.is_chip_href).length;
    console.log(`  …${n(readerOnlyInScope.length)} of them reach a reader WITHOUT being stored in budgets.source_url`);
    // ⚠⚠ ASKED ANYWAY, AND THAT IS THE POINT. `data_source_info` carries TWO
    // URL fields and the API ships both to the browser on every budget; which
    // one the chip links to is one `||` in src/App.tsx. Asking only the winner
    // would make this gate's coverage depend on a component's ternary — and it
    // already hid a 404 once: West Hollywood's `url` is a dead open-checkbook
    // page sitting in the same JSON object as a live `datasetUrl`.
    if (unlinked) console.log(`     (${n(unlinked)} published in data_source_info but not currently linked)`);
  }
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
  // ⚠⚠ A CONFIRMATION IS NOT A FETCH, AND THE REPORT MAY NOT BLUR THEM.
  // The Archive's availability endpoint says the capture exists; it does not
  // serve the bytes, so nothing was checked about the document's TYPE. That is
  // a weaker pass than the other `ok`s on this line and it is stated as one.
  //
  // ⚠ The two oracles do NOT make the same claim, so they are never summed
  // into one number. CDX states the archived mimetype and the probe checks it;
  // the availability endpoint states no type at all.
  const viaCdx = c.ok.filter((o) => o.viaCdx);
  const viaAvailability = c.ok.filter((o) => o.viaWayback && !o.viaCdx);
  if (viaCdx.length) {
    console.log(`   of which ${n(viaCdx.length)} confirmed by the Internet Archive's CDX index,`
      + ' not fetched — the capture exists and its archived type matches what the URL promises');
  }
  if (viaAvailability.length) {
    console.log(`   of which ${n(viaAvailability.length)} confirmed by the Internet Archive's availability`
      + ' endpoint, not fetched — the capture exists; its content type was NOT checked');
  }
  if (c.confirmed.length) console.log(`ℹ️  declared unreachable: ${n(c.confirmed.length)}`);

  let failed = false;

  // ── ✅ "SHOWN A LANDING PAGE WHILE TT HOLDS THE DOCUMENT" IS GONE ────────
  //
  // That report printed, every run, "704 budgets … the repair is in
  // EmpoweredVote/ev-accounts: treasuryService.ts `mapBudget` must prefer
  // b.source_url over sr.url". ev-accounts#1372 made exactly that change and
  // deployed it, so the sentence became an instruction to redo merged work.
  //
  // ⛔ It is REMOVED rather than re-pointed. Under the deployed rule a
  // `source_url` becomes BOTH published fields, so "the reader is shown
  // something other than the source_url this budget holds" cannot happen —
  // 0 of 704, measured. A check that can only ever print zero is not
  // reassurance, it is furniture.
  //
  // ⚠⚠ WHAT REPLACES IT IS BELOW, AND IT IS A DIFFERENT KIND OF CHECK. The
  // census is a MODEL of another service, and a model cannot notice the
  // service changing — which is precisely how it sat stale for a day. So the
  // gate now asks the LIVE API what it actually publishes and fails when the
  // two disagree.
  //
  // ⚠ Skipped on a narrowed run for the same reason the base_url census is:
  // `--host` and `--limit` scope the observation, and a sample drawn from a
  // scoped list would report on whatever happened to survive the filter.
  if (!values.host && !values.limit) {
    const sample = pickDriftSample(readerLinks);
    const observed = new Map();
    let apiReachable = true;
    for (const s of sample) {
      const key = sampleKey(s);
      if (observed.has(key)) continue;
      try {
        const got = await liveBudgetsFor(s.sample_entity, s.sample_state);
        observed.set(key, got === null ? 'unreachable' : got);
      } catch {
        observed.set(key, 'unreachable');
        apiReachable = false;
      }
    }
    const drift = judgeDrift(sample, observed);
    if (drift.drifted.length) {
      failed = true;
      console.error(`\n⛔⛔ THE CENSUS AND THE LIVE API DISAGREE (${drift.drifted.length} of ${drift.checked}):`);
      for (const d of drift.drifted) {
        console.error(`  ${where(d)} — the census says this URL reaches a reader:`);
        console.error(`     census  ${d.source_url}`);
        console.error(`     API     ${d.published.join('\n             ')}`);
      }
      console.error('  ⛔ treasury.reader_link_census() models ev-accounts\' precedence. One of');
      console.error('     them has changed. Read backend/src/lib/treasuryCitation.ts on master,');
      console.error('     then bring the census into line with a new migration — do NOT edit the');
      console.error('     comment and leave the SQL.');
    } else if (drift.agreed) {
      console.log(`\n✅ census agrees with the live API on ${n(drift.agreed)} sampled budget(s)`);
    }
    if (drift.unresolved.length) {
      const why = apiReachable ? 'not matched in the API response' : 'the API could not be asked';
      console.log(`ℹ️  ${n(drift.unresolved.length)} sampled budget(s) ${why} — not treated as agreement`);
    }
  }

  // ── ⭐⭐ THE SCO FAMILY: TIED, NOT PINGED ────────────────────────────────
  //
  // Skipped on a narrowed run, like the other whole-fleet checks: a tie drawn
  // from a filtered list reports on whatever survived the filter.
  if (!values.host && !values.limit && scoEntityRows.length) {
    const cited = await fetchScoCitedBudgets();
    const shapeBad = cited.filter((r) => !isScoEntityUrl(r.source_url));
    if (shapeBad.length) {
      failed = true;
      console.error(`\n⛔ MALFORMED SCO ENTITY CITATION (${shapeBad.length}):`);
      for (const r of shapeBad.slice(0, 10)) console.error(`  ${r.entityName} FY${r.fiscalYear}: ${r.source_url}`);
    }
    const keys = new Set(cited
      .filter((r) => r.entityType)
      .map((r) => `${scoCorpus(r.entityType)}|${scoBranch(r.datasetType)}|${r.fiscalYear}`));
    const { totals, failed: pagesFailed } = await fetchScoTotals(keys);
    const tie = judgeScoTie(cited.filter((r) => r.entityType), totals);
    console.log(`\n✅ SCO figures tied to the publisher: ${n(tie.tie)} of ${n(tie.checked)} `
      + `(${n(keys.size)} API page(s), ${n(pagesFailed)} unreachable)`);
    if (tie.mismatch.length) {
      failed = true;
      console.error(`\n⛔⛔ TT AND THE PUBLISHER DISAGREE (${tie.mismatch.length}):`);
      for (const m of tie.mismatch.slice(0, 25)) {
        console.error(`  ${m.entityName} FY${m.fiscalYear} ${m.datasetType}: `
          + `TT ${Number(m.total).toLocaleString()} vs publisher ${m.publisher.toLocaleString()}`);
      }
      console.error('  ⛔ This is a FIGURE defect, not a citation one — the link is fine and the');
      console.error('     number behind it is not. Do not "repair" it by changing the URL.');
    }
    if (tie.absent.length) {
      console.log(`ℹ️  ${n(tie.absent.length)} entity-year(s) the publisher does not list — not treated as agreement`);
    }
  } else if (scoEntityRows.length) {
    console.log(`\nℹ️  ${n(scoEntityRows.length)} SCO per-entity citation(s) NOT probed — a `
      + '#! route cannot be liveness-checked; the figure-tie is skipped on a narrowed run.');
  }

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

  // ── ⭐ `treasury.data_sources.base_url` — the other unwatched column ──────
  //
  // ⚠ SKIPPED on a narrowed run. `--host` and `--limit` scope the citation
  // census; running the endpoint census anyway would ask about hosts the
  // operator deliberately excluded, and `--limit`'s whole promise is a quick
  // smoke test. #360's rule — a filter must scope the EXPECTATION, not just
  // the observation — so the cleanest scoping here is not to pretend.
  if (!values.host && !values.limit) {
    const endpointRows = await fetchSourceEndpointCensus();
    // ⚠ A laptop path cannot be asked, and asking would waste a request and
    // print a confusing `unreachable`. `judgeEndpoints` routes on
    // `is_local_path` before it looks at any verdict, so give it none.
    const askable = endpointRows.filter((r) => !r.is_local_path);
    console.log(`\nasking ${n(askable.length)} distinct data_sources.base_url(s)…`);
    // ⚠ Same ladder, same courtesy, same host-parallelism as the citations —
    // a base_url that needed curl to answer would otherwise read as dead here
    // and live there, from one run, about one publisher.
    const { observations: endpointObs } = await observeAll(askable);
    const observedEndpoints = endpointObs.map((o) => ({ ...o, verdict: judgeProbe(o).verdict }));
    const e = judgeEndpoints(
      [...observedEndpoints, ...endpointRows.filter((r) => r.is_local_path)],
      SOURCE_ENDPOINT_BASELINE,
    );

    console.log(`✅ endpoints live: ${n(e.ok.length)}`);
    if (e.provenanceDeclared.length) {
      console.log(`ℹ️  declared broken provenance: ${n(e.provenanceDeclared.length)} — see scripts/data/sourceEndpointBaseline.mjs`);
    }

    // ⚠⚠ REFUSED, NOT GONE — printed in full, never failed. #373's distinction,
    // which this path had never applied: a 403, a 429 or a refused socket is a
    // host declining to answer, not a publisher saying the document is gone.
    // It became load-bearing when #383 put eleven web.archive.org URLs in here
    // for documents whose publishers refuse every client we have; the Archive
    // declines a random fraction of connections, and a clean run was failing
    // over endpoints that answered 206 a minute later.
    if (e.provenanceUnreachable.length) {
      console.log(`\nℹ️  REFUSED, NOT GONE (${n(e.provenanceUnreachable.length)}) — a host declined to answer; it did not say the document is gone:`);
      for (const r of e.provenanceUnreachable) {
        console.log(`  ${where(r)} — ${r.detail || r.verdict} (${r.api_type})`);
        console.log(`     ${r.source_url}`);
      }
      console.log('  ⚠ Not a failure, and not agreement either. If one of these is actually');
      console.log('    gone, it will say 404 and fail the next run.');
    }

    // ⛔ A SYNC ENDPOINT IS THE ONLY ONE A JOB ACTUALLY CALLS. `treasury-sync`
    // refuses every api_type but socrata, so a dead one here is a cron that
    // fails on its next tick — and it may never be declared away.
    if (e.syncBroken.length) {
      failed = true;
      console.error(`\n⛔⛔ A SYNC ENDPOINT IS BROKEN (${e.syncBroken.length}) — treasury-sync calls this on a schedule:`);
      for (const r of e.syncBroken) {
        console.error(`  ${where(r)} — ${r.verdict}, ${n(r.enabled_rows)} enabled row(s)\n     ${r.source_url}`);
      }
    }
    if (e.provenanceBroken.length) {
      failed = true;
      console.error(`\n⛔ A PROVENANCE ENDPOINT BROKE AND IS NOT DECLARED (${e.provenanceBroken.length}):`);
      for (const r of e.provenanceBroken) {
        console.error(`  ${where(r)} — ${r.verdict} (${r.api_types})\n     ${r.source_url}`);
      }
      console.error('  Check it by hand. If the publisher moved, repair the row; if the document is');
      console.error('  simply gone, declare it in scripts/data/sourceEndpointBaseline.mjs with the date.');
    }
    if (e.stale.length) {
      failed = true;
      console.error(`\n⚠ STALE ENDPOINT DECLARATIONS (${e.stale.length}) — these recovered or were deleted. Remove the paragraph:`);
      for (const d of e.stale) console.error(`  ${d.url}`);
    }

    // ⚠⚠⚠ NOT a citation verdict. `citationShape()` would file these under
    // "uncitable" — correct silence for a URL that promises nothing, a lie
    // about a provenance record. See sourceEndpointJudge.mjs.
    if (e.localCount) {
      console.log(`\n⚠⚠⚠ RECORDED AS A PATH ON SOMEBODY'S LAPTOP (${n(e.localCount)}, baseline ${n(e.localBaseline)}):`);
      for (const r of e.localPaths.slice().sort((a, b) => a.source_url.localeCompare(b.source_url))) {
        console.log(`  ${where(r)}  ${r.source_url}`);
      }
      console.log('  These are not citations and never were — the provenance was never recorded.');
      console.log('  The repair is to find each document on the publisher and cite it.');
    }
    if (e.localGrew) {
      failed = true;
      console.error(`\n⛔ LAPTOP PATHS GREW: ${n(e.localCount)}, baseline ${n(e.localBaseline)}`);
      console.error('   A loader wrote a local filesystem path into the production database.');
    }
    if (e.localPaidDown) {
      console.log(`ℹ️  laptop paths paid down: ${n(e.localCount)}, baseline ${n(e.localBaseline)}`);
      console.log('   Lower `localPaths` in scripts/data/sourceEndpointBaseline.mjs.');
    }
    if (endpointsAreClean(e)) console.log('✅ no base_url regressed.');
  } else {
    console.log('\nℹ️  data_sources.base_url census SKIPPED — a narrowed run cannot scope it honestly.');
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
