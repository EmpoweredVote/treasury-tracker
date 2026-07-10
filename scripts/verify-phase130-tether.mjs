#!/usr/bin/env node
/**
 * verify-phase130-tether.mjs — Phase 130 / TUC-09 (D-09): pre-determine the
 * Essentials tethered-icon verdict for Tucson + Pima County by fetching the LIVE
 * coverage.json and running the same deterministic matcher the app ships.
 *
 * "Determine-then-confirm": this computes what the banner icon SHOULD do
 * (covered → GEOID(s), or null) so Chris's live UAT (Plan 130-03) is a
 * confirmation, not a guess — and a mismatch between prediction and live render
 * is itself a finding. It also distinguishes NOT-COVERED (fetch OK, no matching
 * record) from FETCH-FAILED (network/non-OK/malformed), which both degrade to
 * no-icon in the app and must not be conflated.
 *
 * The matcher logic is mirrored verbatim (behavior) from
 * src/utils/essentialsCoverage.ts — normalizePlace / stripLabel / the
 * city+county branch of matchEntityToCoverage / isValidCatalogShape. That module
 * is Vite/ESM browser code (import.meta.env), so it is ported here rather than
 * imported. Read-only, off-repo fetch only. No DB. No AI. $0 spend.
 */

const ESSENTIALS_URL = process.env.VITE_ESSENTIALS_URL || process.env.ESSENTIALS_URL || 'https://essentials.empowered.vote';

// ── ported verbatim from essentialsCoverage.ts ───────────────────────────────
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
  const b = body;
  if ('cities' in b && b.cities !== undefined && !Array.isArray(b.cities)) return false;
  if ('counties' in b && b.counties !== undefined && !Array.isArray(b.counties)) return false;
  if ('states' in b && b.states !== undefined && !Array.isArray(b.states)) return false;
  return true;
}
function matchEntityToCoverage(entity, catalog) {
  if (!catalog) return null;
  let records, tier;
  if (entity.entity_type === 'county') { records = catalog.counties; tier = 'county'; }
  else { records = catalog.cities; tier = 'city'; } // city/town/township/municipality
  if (!records) return null;
  const wantState = entity.state.toUpperCase();
  const wantName = normalizePlace(stripLabel(entity.name));
  const match = records.find(
    (r) => r.state.toUpperCase() === wantState && normalizePlace(stripLabel(r.label)) === wantName
  );
  if (!match) return null;
  return { tier, label: match.label, geoids: match.geoids, stateAbbrev: match.state, hasContext: match.hasContext };
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

async function fetchCatalog() {
  try {
    const res = await fetch(`${ESSENTIALS_URL}/coverage.json`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { status: 'fetch_failed', reason: `HTTP ${res.status}`, catalog: null };
    let body;
    try { body = await res.json(); } catch (e) { return { status: 'fetch_failed', reason: `bad JSON: ${e.message}`, catalog: null }; }
    if (!isValidCatalogShape(body)) return { status: 'fetch_failed', reason: 'catalog failed shape check', catalog: null };
    return { status: 'fetched_ok', reason: `HTTP ${res.status}`, catalog: body };
  } catch (e) {
    return { status: 'fetch_failed', reason: `network: ${e.message}`, catalog: null };
  }
}

function verdictFor(entity, fetchStatus, catalog) {
  if (fetchStatus !== 'fetched_ok') return { outcome: 'fetch_failed', record: null };
  const rec = matchEntityToCoverage(entity, catalog);
  return rec ? { outcome: 'covered', record: rec } : { outcome: 'not_covered', record: null };
}

async function main() {
  console.log(`\n=== Phase 130 TUC-09 tether pre-determination ===`);
  console.log(`Essentials origin: ${ESSENTIALS_URL}/coverage.json\n`);

  const { status, reason, catalog } = await fetchCatalog();
  console.log(`Fetch: ${status} (${reason})`);
  if (catalog) {
    console.log(`  catalog: generatedAt=${catalog.generatedAt || '(none)'} · ` +
      `cities=${(catalog.cities || []).length} counties=${(catalog.counties || []).length} ` +
      `states=${(catalog.states || []).length} federal=${catalog.federal ? 'yes' : 'no'}`);
    // is any AZ place present at all? (helps characterize a gap)
    const azCities = (catalog.cities || []).filter((c) => (c.state || '').toUpperCase() === 'AZ').map((c) => c.label);
    const azCounties = (catalog.counties || []).filter((c) => (c.state || '').toUpperCase() === 'AZ').map((c) => c.label);
    console.log(`  AZ cities in catalog: ${azCities.length ? azCities.join(', ') : '(none)'}`);
    console.log(`  AZ counties in catalog: ${azCounties.length ? azCounties.join(', ') : '(none)'}`);
  }

  const entities = [
    { key: 'Tucson', entity: { name: 'Tucson', state: 'AZ', entity_type: 'city' } },
    { key: 'Pima County', entity: { name: 'Pima County', state: 'AZ', entity_type: 'county' } },
  ];

  console.log('');
  const out = [];
  for (const { key, entity } of entities) {
    const v = verdictFor(entity, status, catalog);
    out.push({ key, ...v });
    if (v.outcome === 'covered') {
      console.log(`${key.padEnd(12)} → COVERED  · icon EXPECTED · geoids=${JSON.stringify(v.record.geoids)} label="${v.record.label}"`);
    } else if (v.outcome === 'not_covered') {
      console.log(`${key.padEnd(12)} → NOT COVERED · icon EXPECTED ABSENT (no matching ${entity.entity_type} record in coverage.json)`);
    } else {
      console.log(`${key.padEnd(12)} → FETCH FAILED · inconclusive (NOT a coverage gap — retry)`);
    }
  }

  console.log('\n--- verdict summary (machine-readable) ---');
  console.log(JSON.stringify({ fetch: status, entities: out.map((o) => ({ entity: o.key, outcome: o.outcome, geoids: o.record?.geoids ?? null })) }, null, 2));
  // Exit 0 for fetched_ok (covered OR not_covered are both valid, definitive
  // verdicts — a documented gap is not a failure). Exit 3 only on fetch_failed
  // (inconclusive — needs retry).
  return status === 'fetched_ok' ? 0 : 3;
}

// Set exitCode (not process.exit) and let the event loop drain, so we never call
// process.exit() while the undici keep-alive socket is mid-close (the Windows
// libuv `UV_HANDLE_CLOSING` assertion). An unref'd safety timer force-exits if the
// idle keep-alive socket keeps the process alive past 1s.
main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Fatal:', e); process.exitCode = 2; })
  .finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref(); });
