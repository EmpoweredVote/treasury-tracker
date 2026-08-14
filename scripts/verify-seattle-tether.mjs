#!/usr/bin/env node
/**
 * verify-seattle-tether.mjs — Task 13 Step 5: pre-determine the Essentials
 * tethered-icon verdict for Seattle and King County by fetching the LIVE
 * coverage catalog and running the same deterministic matcher the app ships.
 *
 * "Determine-then-confirm": this computes what the banner icon SHOULD do
 * (covered → GEOID(s), or absent) so the live UAT is a confirmation rather than
 * a guess, and a mismatch between prediction and live render is itself a
 * finding. It distinguishes NOT COVERED (fetch fine, no matching record) from
 * FETCH FAILED (network/non-OK/malformed) — both degrade to no-icon in the app,
 * and conflating them would turn a transient outage into a phantom coverage gap.
 *
 * A coverage gap is a CROSS-REPO ESSENTIALS NOTE, not a Treasury Tracker change.
 * Madison hit exactly this and it was correctly recorded rather than worked
 * around; nothing here should be "fixed" on the TT side.
 *
 * The matcher is ported (behaviour-for-behaviour) from
 * src/utils/essentialsCoverage.ts — normalizePlace / stripLabel / the
 * city+county branch of matchEntityToCoverage / isValidCatalogShape. That module
 * is Vite/ESM browser code (it reads import.meta.env), so it is mirrored here
 * rather than imported.
 *
 * Read-only, off-repo fetch only. No DB. No AI. $0 spend.
 */

const ESSENTIALS_URL = process.env.VITE_ESSENTIALS_URL || process.env.ESSENTIALS_URL || 'https://essentials.empowered.vote';

// ── ported from src/utils/essentialsCoverage.ts ─────────────────────────────
function normalizePlace(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function stripLabel(s) {
  return s.replace(/,\s*[A-Za-z]{2}$/, '').replace(/\s+county$/i, '').trim();
}
function isValidCatalogShape(body) {
  if (!body || typeof body !== 'object') return false;
  if ('cities' in body && body.cities !== undefined && !Array.isArray(body.cities)) return false;
  if ('counties' in body && body.counties !== undefined && !Array.isArray(body.counties)) return false;
  if ('states' in body && body.states !== undefined && !Array.isArray(body.states)) return false;
  return true;
}
const CITY_TIER_TYPES = new Set(['city', 'town', 'township', 'municipality']);
function matchEntityToCoverage(entity, catalog) {
  if (!catalog) return null;
  let records, tier;
  if (entity.entity_type === 'county') { records = catalog.counties; tier = 'county'; }
  else if (CITY_TIER_TYPES.has(entity.entity_type)) { records = catalog.cities; tier = 'city'; }
  else return null;
  if (!records) return null;
  const wantState = entity.state.toUpperCase();
  const wantName = normalizePlace(stripLabel(entity.name));
  const match = records.find(
    (r) => r.state.toUpperCase() === wantState && normalizePlace(stripLabel(r.label)) === wantName
  );
  if (!match) return null;
  return { tier, label: match.label, geoids: match.geoids, stateAbbrev: match.state, hasContext: match.hasContext };
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchCatalog() {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 45_000);
    try {
      const res = await fetch(`${ESSENTIALS_URL}/coverage.json`, { headers: { 'User-Agent': UA }, signal: ac.signal });
      if (!res.ok) return { status: 'fetch_failed', reason: `HTTP ${res.status}`, catalog: null };
      let body;
      try { body = await res.json(); } catch (e) { return { status: 'fetch_failed', reason: `bad JSON: ${e.message}`, catalog: null }; }
      if (!isValidCatalogShape(body)) return { status: 'fetch_failed', reason: 'catalog failed shape check', catalog: null };
      return { status: 'fetched_ok', reason: `HTTP ${res.status}`, catalog: body };
    } finally { clearTimeout(timer); }
  } catch (e) {
    return { status: 'fetch_failed', reason: `network: ${e.message}`, catalog: null };
  }
}

async function main() {
  console.log('=== Seattle + King County Essentials tether pre-determination ===');
  console.log(`Essentials origin: ${ESSENTIALS_URL}/coverage.json\n`);

  const { status, reason, catalog } = await fetchCatalog();
  console.log(`Fetch: ${status} (${reason})`);
  if (catalog) {
    console.log(`  catalog: generatedAt=${catalog.generatedAt || '(none)'} · ` +
      `cities=${(catalog.cities || []).length} counties=${(catalog.counties || []).length} ` +
      `states=${(catalog.states || []).length} federal=${catalog.federal ? 'yes' : 'no'}`);
    const waCities = (catalog.cities || []).filter((c) => (c.state || '').toUpperCase() === 'WA').map((c) => c.label);
    const waCounties = (catalog.counties || []).filter((c) => (c.state || '').toUpperCase() === 'WA').map((c) => c.label);
    console.log(`  WA cities in catalog:   ${waCities.length ? waCities.join(', ') : '(none)'}`);
    console.log(`  WA counties in catalog: ${waCounties.length ? waCounties.join(', ') : '(none)'}`);
  }

  const entities = [
    { key: 'Seattle', entity: { name: 'Seattle', state: 'WA', entity_type: 'city' } },
    { key: 'King County', entity: { name: 'King County', state: 'WA', entity_type: 'county' } },
  ];

  console.log('');
  const out = [];
  for (const { key, entity } of entities) {
    const record = status === 'fetched_ok' ? matchEntityToCoverage(entity, catalog) : null;
    const outcome = status !== 'fetched_ok' ? 'fetch_failed' : record ? 'covered' : 'not_covered';
    out.push({ entity: key, outcome, geoids: record?.geoids ?? null });
    if (outcome === 'covered') {
      console.log(`${key.padEnd(12)} → COVERED · icon EXPECTED · geoids=${JSON.stringify(record.geoids)} label="${record.label}"`);
    } else if (outcome === 'not_covered') {
      console.log(`${key.padEnd(12)} → NOT COVERED · icon EXPECTED ABSENT (no matching ${entity.entity_type} record in coverage.json)`);
      console.log(`${''.padEnd(12)}   → cross-repo Essentials note, NOT a Treasury Tracker change.`);
    } else {
      console.log(`${key.padEnd(12)} → FETCH FAILED · inconclusive (NOT a coverage gap — retry)`);
    }
  }

  console.log('\n--- verdict summary (machine-readable) ---');
  console.log(JSON.stringify({ fetch: status, entities: out }, null, 2));

  // Exit 0 for a definitive verdict either way — a documented coverage gap is a
  // finding, not a failure. Exit 3 only when the fetch itself was inconclusive.
  return status === 'fetched_ok' ? 0 : 3;
}

// Set exitCode and let the loop drain rather than calling process.exit(): an
// abrupt exit races undici's keep-alive socket into a Windows libuv
// UV_HANDLE_CLOSING assertion.
main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Fatal:', e); process.exitCode = 2; })
  .finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref(); });
