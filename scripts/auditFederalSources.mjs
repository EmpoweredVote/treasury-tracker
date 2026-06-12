#!/usr/bin/env node
/**
 * Federal Source-Chain Auditor (Phase 48, Plan 01)
 *
 * Walks every URL-bearing federal claim row (48-CONTEXT inventory) and gives
 * each unique URL a verdict:
 *   PASS        — 200 on a friendly domain, or record confirmed via api.govinfo.gov
 *   BROWSER     — bot-walled domain (congress.gov, bioguide.congress.gov, gao.gov);
 *                 handed to the Playwright pass with a content expectation
 *   FAIL        — 404/410, govinfo API miss, or repeated fetch failure
 *
 * govinfo app pages are NEVER judged by page status (the SPA returns 200 for
 * any path) — existence is checked against api.govinfo.gov package/granule
 * summaries instead.
 *
 * Also audits the dataset-level chain: all 3 US treasury.budgets rows must
 * join to a source_registry row, and the production API must carry
 * data_source_info for each (the SourceChip's data path).
 *
 * Usage: node scripts/auditFederalSources.mjs
 * Writes: .planning/phases/48-source-chain-verification-uat/48-audit-results.json
 * Requires SUPABASE_SERVICE_KEY + DATA_GOV_API_KEY in env (key never logged).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
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

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_KEY = process.env.DATA_GOV_API_KEY;
const US_ID = '0098c405-65e1-426f-8e5f-0fcbe2a900c0';
const PROD_API = 'https://ev-accounts-api.onrender.com/api/treasury';
const OUT = resolve(__dirname, '..', '.planning', 'phases', '48-source-chain-verification-uat', '48-audit-results.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const FEDERAL_REGISTRY_KEYS = ['treasury-fiscal-data', 'omb-historical-tables', 'usaspending', 'congress-gov', 'govinfo'];
const BROWSER_DOMAINS = ['www.congress.gov', 'bioguide.congress.gov', 'www.gao.gov'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Derive the Playwright content expectation for a bot-walled URL from its referencing rows. */
function browserExpect(url, refs) {
  if (url.includes('/help/coverage-dates')) return 'Coverage Dates';
  if (url.endsWith('/cosponsors')) return 'Cosponsor';
  if (url.includes('bioguide.congress.gov')) {
    const sponsor = refs.map((r) => r.sponsor).find(Boolean);
    const m = sponsor && sponsor.match(/^(?:Rep\.|Sen\.)\s+([^,]+),/);
    return m ? m[1] : 'Congress';
  }
  if (url.includes('www.congress.gov/bill/')) {
    const bill = refs.map((r) => r.expect_text).find(Boolean);
    return bill ?? 'Congress.gov';
  }
  if (url.includes('www.gao.gov')) return 'GAO';
  return null; // generic: any non-block render
}

async function fetchWithRetry(url, opts) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { ...opts, signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(t);
      if (res.status >= 500 && attempt === 1) { await sleep(2000); continue; }
      return res;
    } catch (e) {
      if (attempt === 2) return null;
      await sleep(2000);
    }
  }
  return null;
}

/** govinfo app/details URL → existence via api.govinfo.gov. */
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

async function main() {
  if (!API_KEY) { console.error('Missing DATA_GOV_API_KEY in env'); process.exit(1); }
  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const t = (name) => sb.schema('treasury').from(name);

  // ---- Inventory: url → [{surface, ref, ...expectation hints}] -------------
  const urlRefs = new Map();
  const add = (surface, url, ref, hints = {}) => {
    if (!url) return;
    if (!urlRefs.has(url)) urlRefs.set(url, []);
    urlRefs.get(url).push({ surface, ref, ...hints });
  };
  const counts = {};
  const bump = (surface, n = 1) => { counts[surface] = (counts[surface] ?? 0) + n; };

  // 1. source_registry (federal keys only)
  const { data: registry, error: regErr } = await t('source_registry').select('name, url').in('name', FEDERAL_REGISTRY_KEYS);
  if (regErr) throw new Error(`source_registry: ${regErr.message}`);
  if (registry.length !== FEDERAL_REGISTRY_KEYS.length) throw new Error(`expected ${FEDERAL_REGISTRY_KEYS.length} federal registry rows, got ${registry.length}`);
  for (const r of registry) { add('source_registry', r.url, r.name); bump('source_registry'); }

  // 2. budgets → registry chain (+ production data_source_info, checked below)
  const { data: budgets, error: bErr } = await t('budgets')
    .select('id, dataset_type, data_source_id').eq('municipality_id', US_ID);
  if (bErr) throw new Error(`budgets: ${bErr.message}`);
  const unlinked = budgets.filter((b) => !b.data_source_id);
  if (unlinked.length) throw new Error(`US budgets without data_source_id: ${unlinked.map((b) => b.dataset_type).join(', ')}`);
  bump('budgets_registry_chain', budgets.length);

  // 3. federal_annual_summary
  const { data: fas, error: fasErr } = await t('federal_annual_summary').select('fiscal_year, source_url');
  if (fasErr) throw new Error(`federal_annual_summary: ${fasErr.message}`);
  for (const r of fas) { add('federal_annual_summary', r.source_url, `FY${r.fiscal_year}`); bump('federal_annual_summary'); }

  // 4. federal_context_metrics
  const { data: fcm, error: fcmErr } = await t('federal_context_metrics').select('metric_key, source_url');
  if (fcmErr) throw new Error(`federal_context_metrics: ${fcmErr.message}`);
  for (const r of fcm) { add('federal_context_metrics', r.source_url, r.metric_key); bump('federal_context_metrics'); }

  // 5. category_enrichment (US-scoped)
  const { data: enr, error: enrErr } = await t('category_enrichment').select('name_key, source_url').eq('municipality_id', US_ID);
  if (enrErr) throw new Error(`category_enrichment: ${enrErr.message}`);
  for (const r of enr) { add('category_enrichment', r.source_url, r.name_key); bump('category_enrichment'); }

  // 6. program_details (4 URL columns + details jsonb)
  const { data: pd, error: pdErr } = await t('program_details')
    .select('name_key, enabling_bill, sponsor, enabling_bill_url, public_law_url, sponsor_url, cosponsors_url, details')
    .eq('municipality_id', US_ID);
  if (pdErr) throw new Error(`program_details: ${pdErr.message}`);
  for (const r of pd) {
    // distinctive fragment of the fetched title, for browser content-match
    const titleFrag = r.enabling_bill ? r.enabling_bill.split('): ')[1]?.slice(0, 40) : null;
    if (r.enabling_bill_url) { add('program_details.enabling_bill_url', r.enabling_bill_url, r.name_key, { expect_text: titleFrag }); bump('program_details.enabling_bill_url'); }
    if (r.public_law_url) { add('program_details.public_law_url', r.public_law_url, r.name_key); bump('program_details.public_law_url'); }
    if (r.sponsor_url) { add('program_details.sponsor_url', r.sponsor_url, r.name_key, { sponsor: r.sponsor }); bump('program_details.sponsor_url'); }
    if (r.cosponsors_url) { add('program_details.cosponsors_url', r.cosponsors_url, r.name_key); bump('program_details.cosponsors_url'); }
    for (const d of r.details ?? []) {
      if (d.source_url) {
        const frag = d.field === 'official_title' ? d.value.slice(0, 40) : (d.value ? d.value.slice(0, 30) : null);
        add('program_details.details[]', d.source_url, `${r.name_key} :: ${d.field}`, { expect_text: frag });
        bump('program_details.details[]');
      }
    }
  }

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Inventory: ${totalRows} claim rows → ${urlRefs.size} unique URLs`);
  for (const [s, n] of Object.entries(counts)) console.log(`  ${s}: ${n}`);

  // ---- Production data_source_info check (the SourceChip path) ------------
  const chainResults = [];
  for (const b of budgets) {
    const res = await fetchWithRetry(`${PROD_API}/budgets/${b.id}`, { headers: { 'User-Agent': UA } });
    const body = res && res.ok ? await res.json() : null;
    const ok = Boolean(body?.data_source_info?.source_url || body?.data_source_info?.url);
    chainResults.push({ dataset: b.dataset_type, budget_id: b.id, api_ok: Boolean(res?.ok), data_source_info: ok });
    console.log(`  budgets chain ${b.dataset_type}: API ${res?.status} data_source_info=${ok}`);
    await sleep(300);
  }

  // ---- URL verdicts --------------------------------------------------------
  const results = [];
  let i = 0;
  for (const [url, refs] of urlRefs) {
    i += 1;
    const host = new URL(url).host;
    let verdict; let note; let strategy;
    if (host === 'www.govinfo.gov' && url.includes('/app/details/')) {
      strategy = 'govinfo-api';
      ({ verdict, note } = await checkGovinfo(url));
    } else if (BROWSER_DOMAINS.includes(host)) {
      strategy = 'browser';
      verdict = 'BROWSER';
      note = `expect: ${browserExpect(url, refs) ?? '(renders, not a block page)'}`;
    } else {
      strategy = 'http-get';
      const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
      if (!res) { verdict = 'FAIL'; note = 'unreachable after retry'; }
      else if (res.ok) { verdict = 'PASS'; note = `HTTP ${res.status}`; }
      else { verdict = 'FAIL'; note = `HTTP ${res.status}`; }
    }
    results.push({ url, strategy, verdict, note, expect: strategy === 'browser' ? browserExpect(url, refs) : undefined, refs });
    console.log(`[${i}/${urlRefs.size}] ${verdict.padEnd(7)} ${url.slice(0, 90)}  (${note})`);
    await sleep(300);
  }

  const summary = {
    audited_at: new Date().toISOString(),
    claim_rows: totalRows,
    unique_urls: urlRefs.size,
    counts_by_surface: counts,
    budgets_registry_chain: chainResults,
    verdicts: {
      PASS: results.filter((r) => r.verdict === 'PASS').length,
      BROWSER: results.filter((r) => r.verdict === 'BROWSER').length,
      FAIL: results.filter((r) => r.verdict === 'FAIL').length,
    },
    results,
  };
  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`\nVerdicts: ${JSON.stringify(summary.verdicts)} — results written to 48-audit-results.json`);
  if (summary.verdicts.FAIL > 0) process.exitCode = 2;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
