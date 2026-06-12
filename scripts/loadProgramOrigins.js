#!/usr/bin/env node
/**
 * Program Origins Loader (Phase 47, Plan 02)
 *
 * Deterministic structured fetch → treasury.program_details. Reads the curated
 * identifier list in data/federal-programs.json (identifiers + display labels
 * ONLY), fetches each program's record live from Congress.gov / GovInfo, and
 * stores the fields verbatim with per-claim public URLs. No LLM anywhere:
 * every stored value is either copied from an API response or a deterministic
 * URL template around response identifiers.
 *
 * Tier handling:
 *  - modern:        Congress.gov v3 bill detail — full field set
 *  - foundational:  GovInfo STATUTE granule — title/citation/date; sponsor
 *                   fields NULL + boundary note (no pre-1973 sponsor data)
 *
 * URL notes (verified 2026-06-12):
 *  - govinfo.gov app pages return 200 for ANY path — existence is verified via
 *    the api.govinfo.gov package/granule endpoints, never by page status.
 *  - The PLAW collection starts at the 104th Congress (1995); older public
 *    laws use their pinned Statutes-at-Large granule (law_record).
 *  - congress.gov bot-blocks non-browser clients; bill/cosponsor page URLs are
 *    canonical templates around API-confirmed identifiers. sponsor_url uses
 *    the Bioguide permalink (identifier-only; member-page slugs are not
 *    derivable from the API).
 *
 * Usage: node scripts/loadProgramOrigins.js [--dry-run]
 * Requires DATA_GOV_API_KEY in env (never logged; stored URLs are public pages).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
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

const { values: opts } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = opts['dry-run'];

const CONGRESS_API = 'https://api.congress.gov/v3';
const GOVINFO_API = 'https://api.govinfo.gov';
const COVERAGE_DOC = 'https://www.congress.gov/help/coverage-dates';
const SPONSOR_BOUNDARY_NOTE = "Sponsor records predate the Congress.gov API's structured coverage (93rd Congress, 1973).";

const BILL_SLUG = { hr: 'house-bill', s: 'senate-bill' };
const BILL_DISPLAY = { hr: 'H.R.', s: 'S.' };

// T-47-03 guard: the curated file may hold identifiers/labels only
const ALLOWED_KEYS = new Set(['name_key', 'program_name', 'tier', 'congress', 'bill_type', 'bill_number', 'govinfo_package_id', 'govinfo_granule_id', 'law_record', 'additional_claims']);
const ALLOWED_CLAIM_KEYS = new Set(['field', 'tier', 'congress', 'bill_type', 'bill_number', 'govinfo_package_id', 'govinfo_granule_id']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`); // never echo the URL — it carries the api_key
  return res.json();
}

async function fetchGranuleSummary(packageId, granuleId) {
  const s = await getJson(`${GOVINFO_API}/packages/${packageId}/granules/${granuleId}/summary?api_key=${API_KEY}`, `govinfo ${granuleId}`);
  if (!s.title || !s.detailsLink) throw new Error(`govinfo ${granuleId}: summary missing title/detailsLink`);
  return s;
}

/** Public-law record for a modern bill: PLAW package if it exists (104th+), else the pinned
 *  Statutes-at-Large granule. Returns {url, year} — year is the record's enactment date. */
async function resolveLawRecord(p, lawNumber) {
  const [cong, num] = lawNumber.split('-');
  const pkg = `PLAW-${cong}publ${num}`;
  const res = await fetch(`${GOVINFO_API}/packages/${pkg}/summary?api_key=${API_KEY}`);
  if (res.ok) {
    const s = await res.json();
    return { url: `https://www.govinfo.gov/app/details/${pkg}`, year: s.dateIssued ? Number(s.dateIssued.slice(0, 4)) : null };
  }
  await sleep(300);
  if (p.law_record) {
    const s = await fetchGranuleSummary(p.law_record.govinfo_package_id, p.law_record.govinfo_granule_id);
    const cite = s.identifier?.publicLawCitation;
    if (cite && cite.replace(/^Public Law\s+/, '') !== lawNumber) {
      throw new Error(`${p.name_key}: law_record citation '${cite}' does not match Congress.gov law ${lawNumber}`);
    }
    return { url: s.detailsLink, year: s.granuleDate ? Number(s.granuleDate.slice(0, 4)) : null };
  }
  throw new Error(`${p.name_key}: P.L. ${lawNumber} has no PLAW package and no pinned law_record`);
}

async function fetchModern(p) {
  const { bill } = await getJson(`${CONGRESS_API}/bill/${p.congress}/${p.bill_type}/${p.bill_number}?api_key=${API_KEY}`, `congress.gov ${p.congress}/${p.bill_type}/${p.bill_number}`);
  if (!bill?.title) throw new Error(`${p.name_key}: bill response missing title`);
  const billPage = `https://www.congress.gov/bill/${p.congress}th-congress/${BILL_SLUG[p.bill_type]}/${p.bill_number}`;
  const row = {
    enabling_bill: `${BILL_DISPLAY[p.bill_type]} ${p.bill_number} (${p.congress}th Congress): ${bill.title}`,
    enabling_bill_url: billPage,
    public_law: null,
    public_law_url: null,
    enacted_year: null,
    sponsor: null,
    sponsor_url: null,
    cosponsors_count: null,
    cosponsors_url: null,
    details: null,
    source_api: 'congress.gov',
  };
  const law = (bill.laws ?? [])[0];
  if (law?.number) {
    row.public_law = `P.L. ${law.number}`;
    await sleep(300);
    const rec = await resolveLawRecord(p, law.number);
    row.public_law_url = rec.url;
    row.enacted_year = rec.year;
  }
  if (row.enacted_year == null && bill.latestAction?.text?.includes('Public Law') && bill.latestAction.actionDate) {
    row.enacted_year = Number(bill.latestAction.actionDate.slice(0, 4));
  }
  const sp = (bill.sponsors ?? [])[0];
  if (sp?.fullName && sp?.bioguideId) {
    row.sponsor = sp.fullName;
    row.sponsor_url = `https://bioguide.congress.gov/search/bio/${sp.bioguideId}`;
  }
  if (typeof bill.cosponsors?.count === 'number') {
    row.cosponsors_count = bill.cosponsors.count;
    row.cosponsors_url = `${billPage}/cosponsors`;
  }
  return row;
}

async function fetchFoundational(p) {
  const s = await fetchGranuleSummary(p.govinfo_package_id, p.govinfo_granule_id);
  const cite = s.identifier?.publicLawCitation;
  return {
    enabling_bill: null,
    enabling_bill_url: null,
    public_law: cite ?? null,
    public_law_url: cite ? s.detailsLink : null,
    enacted_year: s.granuleDate ? Number(s.granuleDate.slice(0, 4)) : null,
    sponsor: null,
    sponsor_url: null,
    cosponsors_count: null,
    cosponsors_url: null,
    details: [
      { field: 'official_title', value: s.title, source_url: s.detailsLink },
      { field: 'sponsor_note', value: SPONSOR_BOUNDARY_NOTE, source_url: COVERAGE_DOC },
    ],
    source_api: 'govinfo',
  };
}

/** additional_claims → fetched {field, value, source_url} entries for details jsonb */
async function fetchClaim(c) {
  if (c.tier === 'modern') {
    const { bill } = await getJson(`${CONGRESS_API}/bill/${c.congress}/${c.bill_type}/${c.bill_number}?api_key=${API_KEY}`, `congress.gov claim ${c.congress}/${c.bill_type}/${c.bill_number}`);
    if (!bill?.title) throw new Error(`claim '${c.field}': bill response missing title`);
    const law = (bill.laws ?? [])[0];
    return {
      field: c.field,
      value: law?.number ? `${bill.title} — P.L. ${law.number}` : bill.title,
      source_url: `https://www.congress.gov/bill/${c.congress}th-congress/${BILL_SLUG[c.bill_type]}/${c.bill_number}`,
    };
  }
  const s = await fetchGranuleSummary(c.govinfo_package_id, c.govinfo_granule_id);
  const cite = s.identifier?.publicLawCitation;
  return {
    field: c.field,
    value: cite ? `${s.title} — ${cite}` : s.title,
    source_url: s.detailsLink,
  };
}

function validateCurated(file) {
  const programs = file.programs ?? [];
  if (!programs.length) throw new Error('federal-programs.json: no programs');
  const seen = new Set();
  for (const p of programs) {
    for (const k of Object.keys(p)) {
      if (!ALLOWED_KEYS.has(k)) throw new Error(`'${p.name_key ?? '?'}': unexpected key '${k}' — identifiers/labels only (T-47-03)`);
    }
    if (!p.name_key || !p.program_name || !p.tier) throw new Error(`'${p.name_key ?? '?'}': missing name_key/program_name/tier`);
    if (seen.has(p.name_key)) throw new Error(`duplicate name_key '${p.name_key}' (UNIQUE one-program-per-node)`);
    seen.add(p.name_key);
    if (p.tier === 'modern' && !(p.congress && p.bill_type && p.bill_number)) throw new Error(`'${p.name_key}': modern entry missing bill identifiers`);
    if (p.tier === 'foundational' && !(p.govinfo_package_id && p.govinfo_granule_id)) throw new Error(`'${p.name_key}': foundational entry missing govinfo identifiers`);
    for (const c of p.additional_claims ?? []) {
      for (const k of Object.keys(c)) {
        if (!ALLOWED_CLAIM_KEYS.has(k)) throw new Error(`'${p.name_key}' claim: unexpected key '${k}'`);
      }
      if (!c.field || !c.tier) throw new Error(`'${p.name_key}' claim: missing field/tier`);
    }
  }
  return programs;
}

async function main() {
  if (!API_KEY) { console.error('Missing DATA_GOV_API_KEY in env'); process.exit(1); }

  const file = JSON.parse(readFileSync(resolve(__dirname, '..', 'data', 'federal-programs.json'), 'utf8'));
  const programs = validateCurated(file);
  console.log(`federal-programs.json: ${programs.length} programs, ${file._skipped?.length ?? 0} documented skips/folds`);

  const rows = [];
  for (const p of programs) {
    const fetched = p.tier === 'modern' ? await fetchModern(p) : await fetchFoundational(p);
    for (const c of p.additional_claims ?? []) {
      await sleep(300);
      fetched.details = [...(fetched.details ?? []), await fetchClaim(c)];
    }
    rows.push({ name_key: p.name_key, program_name: p.program_name, ...fetched });
    console.log(`  ✓ fetched ${p.name_key} [${fetched.source_api}]`);
    await sleep(300);
  }

  if (dryRun) {
    console.log('\n[dry-run] full row set:');
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: muni, error: muniErr } = await supabase.schema('treasury').from('municipalities')
    .select('id').eq('name', 'United States').eq('entity_type', 'federal').single();
  if (muniErr || !muni) throw new Error('US federal entity not found');

  let loaded = 0;
  for (const r of rows) {
    const { error } = await supabase.schema('treasury').from('program_details')
      .upsert({ ...r, municipality_id: muni.id, fetched_at: new Date().toISOString() }, { onConflict: 'municipality_id,name_key' });
    if (error) throw new Error(`Upsert '${r.name_key}': ${error.message}`);
    loaded += 1;
    console.log(`  ✓ upserted ${r.name_key}`);
  }

  const { count } = await supabase.schema('treasury').from('program_details')
    .select('id', { count: 'exact', head: true }).eq('municipality_id', muni.id);
  console.log(`Loaded ${loaded} programs. US-scoped program_details rows in DB: ${count}.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
