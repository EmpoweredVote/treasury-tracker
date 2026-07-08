/**
 * Essentials live-fetch smoke check (Phase 127, T-127-01).
 *
 * Proves the SERVER half of the tether's live contract (D-127-04a): the
 * cross-origin Essentials coverage catalog is reachable, CORS-open, correctly
 * shaped, and still contains the Phase-127 UAT matrix anchor records. This is a
 * MANUAL / optional network check — it is deliberately NOT wired into `npm test`
 * or `npm build`, so the offline vitest suite stays deterministic. The BROWSER
 * half of the contract (CORS enforcement in-page, one-fetch/session cache,
 * graceful degrade, clean console) is proven live in Phase 127-02's UAT.
 *
 * The fetched body is untrusted remote data (T-125-01 / T-127-01): this script
 * only READS fields and compares them to expected literals — no eval, no dynamic
 * import, no URL/DOM construction, no shell interpolation of catalog values.
 *
 * Run: `npm run smoke:essentials`  (or `node scripts/essentials-live-smoke.mjs`)
 * Override origin: `VITE_ESSENTIALS_URL=https://staging.example node scripts/essentials-live-smoke.mjs`
 */

// Mirror ESSENTIALS_URL in src/utils/essentialsCoverage.ts.
const ESSENTIALS_URL =
  process.env.VITE_ESSENTIALS_URL || 'https://essentials.empowered.vote';

// The locked UAT matrix (127-01 / D-127-05, as corrected: Fresno CA is the
// uncovered city — Plano TX was falsified, it IS covered).
const UNCOVERED_CITY = { label: 'Fresno', state: 'CA' };

let failures = 0;
function check(name, ok, detail = '') {
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

/** Light shape check, mirroring isValidCatalogShape in essentialsCoverage.ts. */
function isValidCatalogShape(body) {
  if (!body || typeof body !== 'object') return false;
  if ('cities' in body && body.cities !== undefined && !Array.isArray(body.cities)) return false;
  if ('counties' in body && body.counties !== undefined && !Array.isArray(body.counties)) return false;
  if ('states' in body && body.states !== undefined && !Array.isArray(body.states)) return false;
  return true;
}

async function main() {
  const url = `${ESSENTIALS_URL}/coverage.json`;
  console.log(`Essentials live smoke check → ${url}\n`);

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    check('fetch coverage.json', false, `network error: ${err?.message ?? err}`);
    finish();
    return;
  }

  check('HTTP 200 (res.ok)', res.ok, `status ${res.status}`);

  const acao = res.headers.get('access-control-allow-origin');
  check("CORS 'access-control-allow-origin: *'", acao === '*', `got: ${acao ?? '(absent)'}`);

  let body;
  try {
    body = await res.json();
  } catch (err) {
    check('body is valid JSON', false, `${err?.message ?? err}`);
    finish();
    return;
  }

  const shaped = isValidCatalogShape(body);
  check('body passes catalog shape check', shaped);
  check('federal record present (object)', !!body?.federal && typeof body.federal === 'object');

  const cities = Array.isArray(body?.cities) ? body.cities : [];
  const counties = Array.isArray(body?.counties) ? body.counties : [];
  const states = Array.isArray(body?.states) ? body.states : [];

  // Anchor records the UAT matrix depends on.
  const longBeach = cities.find((c) => c.label === 'Long Beach' && c.state === 'CA');
  check('Long Beach/CA present with geoid 0643000', longBeach?.geoids?.[0] === '0643000',
    `geoids: ${JSON.stringify(longBeach?.geoids)}`);

  const bloomington = cities.find((c) => c.label === 'Bloomington' && c.state === 'IN');
  check('Bloomington/IN present with EMPTY geoids (geoid-less edge, D-127-01)',
    !!bloomington && Array.isArray(bloomington.geoids) && bloomington.geoids.length === 0,
    `geoids: ${JSON.stringify(bloomington?.geoids)}`);

  const laCounty = counties.find((c) => c.label === 'Los Angeles County' && c.state === 'CA');
  check('Los Angeles County/CA present with geoid 06037', laCounty?.geoids?.[0] === '06037');

  const saltLake = counties.find((c) => c.label === 'Salt Lake County' && c.state === 'UT');
  check('Salt Lake County/UT present with geoid 49035', saltLake?.geoids?.[0] === '49035');

  const ca = states.find((s) => s.abbrev && s.abbrev.toUpperCase() === 'CA');
  check('California/CA state record present', !!ca, `label: ${ca?.label ?? '(absent)'}`);

  const federalTarget = body?.federal?.target;
  check("federal.target starts with '/results?browse_federal_officials='",
    typeof federalTarget === 'string' && federalTarget.startsWith('/results?browse_federal_officials='),
    `target: ${federalTarget ?? '(absent)'}`);

  // Negative case: the locked uncovered city must be ABSENT from cities[].
  const uncoveredPresent = cities.some(
    (c) => c.label === UNCOVERED_CITY.label && c.state === UNCOVERED_CITY.state
  );
  check(`uncovered-city negative case ${UNCOVERED_CITY.label}/${UNCOVERED_CITY.state} is ABSENT`,
    !uncoveredPresent);

  console.log(`\ncatalog counts: cities ${cities.length}, counties ${counties.length}, states ${states.length}, federal ${body?.federal ? 'present' : 'absent'}`);
  finish();
}

function finish() {
  if (failures === 0) {
    console.log('\n✓ Essentials live smoke check PASSED — server contract intact.');
    process.exitCode = 0;
  } else {
    console.error(`\n✗ Essentials live smoke check FAILED — ${failures} check(s) failed.`);
    process.exitCode = 1;
  }
  // Do NOT call process.exit() — forcing exit mid-teardown races undici's
  // keep-alive socket close and trips a libuv assertion on Windows
  // (async.c: !(handle->flags & UV_HANDLE_CLOSING)). Setting exitCode and
  // letting the (unref'd) event loop drain exits cleanly with the right code.
}

main();
