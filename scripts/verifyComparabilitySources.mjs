#!/usr/bin/env node
/**
 * Comparability Sources Verifier (Phase 51, Plan 02)
 *
 * Reads data/federal-comparability.json and asserts the sourcing contract:
 *   1. Every entry (transition_quarter, function_classification, each
 *      agency_reorganizations[]) carries non-empty source_name / source_url /
 *      source_date.
 *   2. Every source_url resolves:
 *        - govinfo /app/details/ URLs are checked against api.govinfo.gov
 *          (the SPA returns 200 for any path, so page status is meaningless —
 *          existence is confirmed via the package/granule summary), mirroring
 *          scripts/auditFederalSources.mjs.
 *        - any other URL is checked with an HTTP GET (200 = PASS).
 *
 * Exits 0 only when every entry is fully sourced and every URL resolves.
 *
 * Usage: node scripts/verifyComparabilitySources.mjs
 * Requires DATA_GOV_API_KEY in env for the govinfo-API checks (key never logged).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    try {
      const lines = readFileSync(resolve(__dirname, '..', f), 'utf8').split('\n');
      for (const line of lines) {
        const [k, ...v] = line.split('=');
        const rawVal = v.join('=').trim();
        const val = rawVal.replace(/\s+#.*$/, '');
        if (k && val && !process.env[k.trim()]) process.env[k.trim()] = val;
      }
    } catch { /* ignore */ }
  }
}
loadEnv();

const API_KEY = process.env.DATA_GOV_API_KEY;
const DATA_FILE = resolve(__dirname, '..', 'data', 'federal-comparability.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(t);
      if (res.status >= 500 && attempt === 1) { await sleep(2000); continue; }
      return res;
    } catch {
      if (attempt === 2) return null;
      await sleep(2000);
    }
  }
  return null;
}

/** govinfo app/details URL → existence via api.govinfo.gov (page status is meaningless for the SPA). */
async function checkGovinfo(url) {
  const m = url.match(/\/app\/details\/([^/]+)(?:\/([^/?#]+))?/);
  if (!m) return { verdict: 'FAIL', note: 'unparseable govinfo app URL' };
  const [, pkg, granule] = m;
  const api = granule
    ? `https://api.govinfo.gov/packages/${pkg}/granules/${granule}/summary?api_key=${API_KEY}`
    : `https://api.govinfo.gov/packages/${pkg}/summary?api_key=${API_KEY}`;
  const res = await fetchWithRetry(api);
  if (!res) return { verdict: 'FAIL', note: 'govinfo API unreachable after retry' };
  if (res.ok) return { verdict: 'PASS', note: `record confirmed via api.govinfo.gov (${granule ?? pkg})` };
  return { verdict: 'FAIL', note: `govinfo API HTTP ${res.status} — record does not exist` };
}

async function checkUrl(url) {
  const host = new URL(url).host;
  if (host === 'www.govinfo.gov' && url.includes('/app/details/')) {
    return { strategy: 'govinfo-api', ...(await checkGovinfo(url)) };
  }
  const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
  if (!res) return { strategy: 'http-get', verdict: 'FAIL', note: 'unreachable after retry' };
  if (res.ok) return { strategy: 'http-get', verdict: 'PASS', note: `HTTP ${res.status}` };
  return { strategy: 'http-get', verdict: 'FAIL', note: `HTTP ${res.status}` };
}

/** Flatten the content file into [{ key, source_name, source_url, source_date }] entries. */
function collectEntries(data) {
  const entries = [];
  for (const key of ['transition_quarter', 'function_classification']) {
    if (data[key]) entries.push({ key, ...data[key] });
  }
  (data.agency_reorganizations ?? []).forEach((r, i) => {
    entries.push({ key: `agency_reorganizations[${i}] ${r.agency ?? '?'}`, ...r });
  });
  return entries;
}

async function main() {
  if (!API_KEY) { console.error('Missing DATA_GOV_API_KEY in env (needed for govinfo-API checks)'); process.exit(1); }

  let data;
  try {
    data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error(`Cannot read/parse ${DATA_FILE}: ${e.message}`);
    process.exit(1);
  }

  const entries = collectEntries(data);
  if (entries.length === 0) { console.error('No content entries found in federal-comparability.json'); process.exit(1); }

  const fieldFailures = [];
  for (const e of entries) {
    const missing = ['source_name', 'source_url', 'source_date'].filter((f) => !e[f] || String(e[f]).trim() === '');
    if (missing.length) fieldFailures.push({ key: e.key, missing });
  }

  console.log(`Checking ${entries.length} comparability entries from data/federal-comparability.json\n`);

  // Field completeness gate first (cheap, deterministic).
  if (fieldFailures.length) {
    for (const f of fieldFailures) console.log(`  MISSING-FIELDS  ${f.key} → ${f.missing.join(', ')}`);
    console.error(`\n${fieldFailures.length} entr(ies) missing required source fields — failing.`);
    process.exit(2);
  }

  // URL resolution — dedupe so each unique URL is hit once.
  const byUrl = new Map();
  for (const e of entries) {
    if (!byUrl.has(e.source_url)) byUrl.set(e.source_url, []);
    byUrl.get(e.source_url).push(e.key);
  }

  let i = 0;
  let failed = 0;
  for (const [url, keys] of byUrl) {
    i += 1;
    const r = await checkUrl(url);
    if (r.verdict !== 'PASS') failed += 1;
    console.log(`[${i}/${byUrl.size}] ${r.verdict.padEnd(5)} ${url}  (${r.note})`);
    console.log(`        ↳ ${keys.join(', ')}`);
    await sleep(300);
  }

  console.log(`\nEntries: ${entries.length} · Unique URLs: ${byUrl.size} · Failures: ${failed}`);
  if (failed > 0) {
    console.error('Source verification FAILED — one or more source_urls do not resolve.');
    process.exit(2);
  }
  console.log('All comparability sources verified — every entry fully sourced and every URL resolves. ✓');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
