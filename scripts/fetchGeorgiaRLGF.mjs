/**
 * Fetch Georgia DCA Report of Local Government Finances (RLGF) filings.
 *
 * NO SHEBANG — tests import `parseGovOptions` and `parseFileList`, and a `#!`
 * on any module a test imports breaks `npm test` on Windows (project_wa_cities_01).
 *
 * Usage:
 *   node scripts/fetchGeorgiaRLGF.mjs --kind county --enumerate-only
 *   node scripts/fetchGeorgiaRLGF.mjs --kind county --out _acfr-work/ga/sweep
 *   node scripts/fetchGeorgiaRLGF.mjs --cicoid 1005005 --out _acfr-work/ga/sweep
 *
 * ── ACCESS: FREE, NO KEY, NO TERMS GATE ─────────────────────────────────────
 *
 * `Default.aspx` is a stateful ASP.NET postback, which is the shape
 * `reference_colorado_dola_compendium` stands as a warning about — but here the
 * postback is only a NAVIGATOR. It returns plain `<a href>` links to STATIC
 * `.xls` files that need no session, no cookie and no terms acceptance. One
 * postback per government enumerates that government's true file list.
 *
 * ⚠⚠ A STATUS CODE IS NOT EVIDENCE A FILING EXISTS. DCA serves a ~1,245-byte
 * HTML 404 page for an absent year, and a RANGED request for that page returns
 * `206 Partial Content`. A status-code probe therefore reports every year of
 * every entity as present. The only honest probe is the FIRST FOUR BYTES:
 *   - a real filing is OLE2/BIFF8  -> `d0cf11e0`
 *   - DCA's error page            -> `3c21444f`  ("<!DO")
 * Both gates run here: the navigator says what exists, and the magic bytes
 * prove what arrived. Wave 2 confirmed the two routes agree exactly.
 *
 * ⚠ THE DROPDOWN IS THE ONLY SAFE SELECTOR, AND ONLY BY CICOID. Four options
 * are near-miss name collisions for real targets — `Macon County` is not
 * Macon-Bibb, `Bibb City` is in MUSCOGEE county, `Baldwin City` is unrelated to
 * Baldwin County. Select by CICOID, never by name.
 *
 * ⚠ DCA's own listing serves `2005001_YEAR_RLGF_Milledgeville.xls`, a literal
 * placeholder in the fiscal-year position. It is REFUSED here rather than
 * coerced, which would mint a filing under fiscal year NaN.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs } from 'node:util';

export const LISTING_URL = 'https://apps.dca.ga.gov/RLGF/Default.aspx';
export const FILE_HOST = 'https://apps.dca.ga.gov';
export const GOV_SELECT = 'ctl00$bodyContent$ddlGovs';

/**
 * The FY window this fetcher takes.
 *
 * ⚠⚠ FY2016 IS A HARD FLOOR, NOT A CONVENIENCE. The pre-2016 edition has NO
 * `LOAD1` sheet at all — it is the `Exportable Data` generation, a different key
 * vocabulary carrying 1,393 `#REF!` cells. Measured on the workbooks already
 * cached: 20 of 58 wave-1 files have no LOAD1. Extending backwards is a separate
 * extraction milestone, not a wider loop.
 */
export const GA_LOAD_WINDOW = Object.freeze({ first: 2016, last: 2025 });

/** CICOID's leading digit encodes the government's type. */
export const CICOID_KINDS = Object.freeze({ 1: 'county', 2: 'municipality', 3: 'consolidated' });

/** First four bytes, lowercase hex. */
export const OLE2_MAGIC = 'd0cf11e0';
export const DCA_ERROR_PAGE_MAGIC = '3c21444f';

const UA = 'Mozilla/5.0 (compatible; TreasuryTracker/1.0; +https://treasurytracker.empowered.vote)';

/** Decode the handful of entities ASP.NET emits in option text and hidden fields. */
function unescapeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

/** Pull one ASP.NET hidden field out of a page. */
export function hiddenField(html, name) {
  const m = html.match(new RegExp(`id="${name}"[^>]*value="([^"]*)"`));
  return m ? unescapeHtml(m[1]) : '';
}

/**
 * Parse the government dropdown into `{cicoid, name, kind}`.
 *
 * ⚠ The first option is the `-- Select a Local Government --` prompt and carries
 * an EMPTY value. Counting options is therefore one more than counting
 * governments; this drops it.
 */
export function parseGovOptions(html) {
  const block = html.match(/ddlGovs.*?<\/select>/s);
  if (!block) throw new Error('government dropdown not found — DCA changed the page');
  const out = [];
  for (const m of block[0].matchAll(/<option[^>]*value="([^"]*)"[^>]*>(.*?)<\/option>/gs)) {
    const cicoid = m[1].trim();
    if (!cicoid) continue;
    if (!/^\d{7}$/.test(cicoid)) throw new Error(`unexpected CICOID ${JSON.stringify(cicoid)}`);
    const kind = CICOID_KINDS[cicoid[0]];
    if (!kind) throw new Error(`unknown CICOID type digit in ${cicoid}`);
    out.push({ cicoid, name: unescapeHtml(m[2]).replace(/<[^>]+>/g, '').trim(), kind });
  }
  return out;
}

/**
 * Parse the `lblFileList` span into `{fiscalYear, href, filename}`.
 *
 * ⚠ REFUSES A NON-NUMERIC YEAR, reported as `refused` rather than dropped — a
 * silent drop and a refusal look identical in a count, and only one of them is
 * honest about DCA serving a placeholder.
 */
export function parseFileList(html) {
  const span = html.match(/id="ctl00_bodyContent_lblFileList">(.*?)<\/span>/s);
  const filings = [];
  const refused = [];
  if (!span) return { filings, refused, spanFound: false };
  for (const m of span[1].matchAll(/href="([^"]+\.xls)"/gi)) {
    const href = unescapeHtml(m[1]);
    const file = basename(href);
    const parts = file.match(/^(\d{7})_([^_]+)_RLGF_(.+)\.xls$/i);
    if (!parts || !/^\d{4}$/.test(parts[2])) { refused.push({ file, href, why: 'non-numeric fiscal year' }); continue; }
    filings.push({ cicoid: parts[1], fiscalYear: Number(parts[2]), label: parts[3], file, href });
  }
  return { filings, refused, spanFound: true };
}

/** GET the listing page and return its HTML plus the hidden fields a postback needs. */
export async function seedListing(fetchImpl = fetch) {
  const res = await fetchImpl(LISTING_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`listing page ${res.status}`);
  const html = await res.text();
  return {
    html,
    state: {
      viewState: hiddenField(html, '__VIEWSTATE'),
      viewStateGenerator: hiddenField(html, '__VIEWSTATEGENERATOR'),
      eventValidation: hiddenField(html, '__EVENTVALIDATION'),
    },
  };
}

/**
 * Drive one postback and return that government's true file list.
 *
 * The seed page's `__VIEWSTATE` is reused for every government: each postback is
 * "from the fresh page", which is exactly the state the server expects and makes
 * the navigator stateless rather than a chain that one failure corrupts.
 */
export async function enumerateGovernment(cicoid, state, fetchImpl = fetch) {
  const body = new URLSearchParams({
    __EVENTTARGET: GOV_SELECT,
    __EVENTARGUMENT: '',
    __VIEWSTATE: state.viewState,
    __VIEWSTATEGENERATOR: state.viewStateGenerator,
    __EVENTVALIDATION: state.eventValidation,
    [GOV_SELECT]: cicoid,
  });
  const res = await fetchImpl(LISTING_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: LISTING_URL,
    },
    body,
  });
  if (!res.ok) throw new Error(`postback ${cicoid}: ${res.status}`);
  const html = await res.text();
  const heading = html.match(/id="ctl00_bodyContent_lblCriteriaHeading">(.*?)<\/span>/s);
  const confirmed = heading ? unescapeHtml(heading[1]).replace(/<[^>]+>/g, '').trim() : '';
  // ⚠ The heading is the server echoing back WHICH government it selected. A
  // postback that silently fell back to the prompt returns an empty heading and
  // an empty list, which would otherwise read as "this government filed nothing".
  return { ...parseFileList(html), confirmed };
}

/** Download one filing, and prove by its BYTES that it is a workbook. */
export async function fetchFiling(filing, outDir, fetchImpl = fetch) {
  const dest = join(outDir, filing.file);
  if (existsSync(dest)) {
    const magic = readFileSync(dest).subarray(0, 4).toString('hex');
    if (magic === OLE2_MAGIC) return { ...filing, dest, bytes: null, cached: true };
  }
  const url = filing.href.startsWith('http') ? filing.href : FILE_HOST + filing.href;
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Referer: LISTING_URL } });
  const buf = Buffer.from(await res.arrayBuffer());
  const magic = buf.subarray(0, 4).toString('hex');
  if (magic !== OLE2_MAGIC) {
    const why = magic === DCA_ERROR_PAGE_MAGIC
      ? `DCA's HTML error page (${buf.length} bytes), served with HTTP ${res.status}`
      : `unexpected magic ${magic} (HTTP ${res.status}, ${buf.length} bytes)`;
    return { ...filing, dest: null, error: why };
  }
  writeFileSync(dest, buf);
  return { ...filing, dest, bytes: buf.length, cached: false };
}

/** Run `work` over `items` with at most `limit` in flight. */
async function pool(items, limit, work) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await work(items[i], i);
    }
  }));
  return out;
}

export async function main(argv = process.argv.slice(2), log = console.log) {
  const { values } = parseArgs({
    args: argv,
    options: {
      out: { type: 'string', default: '_acfr-work/ga/sweep' },
      kind: { type: 'string' },
      cicoid: { type: 'string', multiple: true },
      first: { type: 'string', default: String(GA_LOAD_WINDOW.first) },
      last: { type: 'string', default: String(GA_LOAD_WINDOW.last) },
      'enumerate-only': { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '4' },
    },
  });
  const first = Number(values.first);
  const last = Number(values.last);
  const conc = Number(values.concurrency);
  const outDir = values.out;
  const xlsDir = join(outDir, 'xls');
  mkdirSync(xlsDir, { recursive: true });

  log(`Seeding ${LISTING_URL}`);
  const { html, state } = await seedListing();
  const all = parseGovOptions(html);
  const counts = all.reduce((a, g) => ({ ...a, [g.kind]: (a[g.kind] ?? 0) + 1 }), {});
  log(`dropdown carries ${all.length} governments: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);

  let targets = all;
  if (values.cicoid?.length) {
    const want = new Set(values.cicoid);
    targets = all.filter((g) => want.has(g.cicoid));
    const missing = [...want].filter((c) => !targets.some((g) => g.cicoid === c));
    if (missing.length) throw new Error(`CICOID not in the dropdown: ${missing.join(', ')}`);
  } else if (values.kind) {
    targets = all.filter((g) => g.kind === values.kind);
    if (!targets.length) throw new Error(`no governments of kind ${JSON.stringify(values.kind)}`);
  }
  log(`target set: ${targets.length} governments, FY${first}-${last}\n`);

  // ── 1. ENUMERATE ──────────────────────────────────────────────────────────
  let done = 0;
  const enumerated = await pool(targets, conc, async (g) => {
    const r = await enumerateGovernment(g.cicoid, state);
    done++;
    if (done % 25 === 0 || done === targets.length) log(`  enumerated ${done}/${targets.length}`);
    return { ...g, ...r };
  });

  const problems = [];
  for (const g of enumerated) {
    if (!g.spanFound) problems.push(`${g.cicoid} ${g.name}: no file-list span in the response`);
    else if (!g.confirmed) problems.push(`${g.cicoid} ${g.name}: postback returned no selection heading`);
    else if (!g.filings.length) problems.push(`${g.cicoid} ${g.name}: DCA lists NO filings at all`);
  }
  const inWindow = enumerated.flatMap((g) => g.filings.filter((f) => f.fiscalYear >= first && f.fiscalYear <= last));
  const refused = enumerated.flatMap((g) => g.refused.map((r) => `${g.cicoid} ${g.name}: ${r.file} — ${r.why}`));

  log(`\nENUMERATION`);
  log(`  governments            : ${enumerated.length}`);
  log(`  filings listed (all FY): ${enumerated.reduce((a, g) => a + g.filings.length, 0)}`);
  log(`  filings in FY${first}-${last}  : ${inWindow.length}`);
  log(`  refused filenames      : ${refused.length}`);
  for (const r of refused) log(`     ${r}`);
  log(`  governments with issues: ${problems.length}`);
  for (const p of problems) log(`     ${p}`);

  const manifest = {
    fetchedAt: new Date().toISOString(),
    listingUrl: LISTING_URL,
    window: { first, last },
    dropdown: { total: all.length, counts },
    governments: enumerated.map((g) => ({
      cicoid: g.cicoid,
      name: g.name,
      kind: g.kind,
      confirmed: g.confirmed,
      years: g.filings.map((f) => f.fiscalYear).sort((a, b) => a - b),
      refused: g.refused,
    })),
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'enumeration.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`\n  -> ${join(outDir, 'enumeration.json')}`);

  if (values['enumerate-only']) return { enumerated, manifest };

  // ── 2. FETCH, PROVING EVERY FILE BY ITS BYTES ─────────────────────────────
  log(`\nFETCHING ${inWindow.length} filings into ${xlsDir}`);
  let got = 0;
  const results = await pool(inWindow, conc, async (f) => {
    const r = await fetchFiling(f, xlsDir);
    got++;
    if (got % 50 === 0 || got === inWindow.length) log(`  fetched ${got}/${inWindow.length}`);
    return r;
  });
  const failed = results.filter((r) => r.error);
  const cached = results.filter((r) => r.cached);
  const bytes = results.reduce((a, r) => a + (r.bytes ?? 0), 0);
  log(`\nFETCH`);
  log(`  downloaded : ${results.length - failed.length - cached.length}`);
  log(`  cached     : ${cached.length}`);
  log(`  FAILED     : ${failed.length}`);
  for (const f of failed) log(`     ${f.file}: ${f.error}`);
  log(`  bytes      : ${(bytes / 1e6).toFixed(1)} MB`);
  writeFileSync(join(outDir, 'fetch-report.json'),
    `${JSON.stringify({ fetchedAt: new Date().toISOString(), ok: results.length - failed.length, failed }, null, 2)}\n`);
  return { enumerated, manifest, results, failed };
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('fetchGeorgiaRLGF.mjs');
if (invokedDirectly) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
