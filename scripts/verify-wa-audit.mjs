#!/usr/bin/env node
/**
 * verify-wa-audit.mjs — source-chain and integrity audit for every loaded WA
 * SAO entity. EIGHT checks, all of which must pass. (h) is listed out of
 * alphabetical order because it was added late; it is not optional and it is
 * not last in importance.
 *
 * The entity list, each entity's window, its exclusions, its per-capita band
 * and its expected rounding-residue count all come from
 * scripts/lib/waRoster.mjs — the same source the seeder, the loaders and the
 * other two harnesses read. This file used to carry its own copy of all of it,
 * which is how an audit ends up asserting a window the loader no longer uses.
 *
 *   (a) YEAR COVERAGE   — the loaded (fiscal_year, dataset_type) inventory equals
 *                         the declared window EXACTLY, per entity. A missing year
 *                         fails; so does a row for an EXCLUDED year. The
 *                         exclusions are asserted, not assumed, because every one
 *                         of them is a deliberate refusal to publish (image-only
 *                         scans, ciphered fonts, an unaudited year) and a row
 *                         quietly appearing for one of those would mean something
 *                         published a figure nobody adjudicated.
 *   (b) TIE INTEGRITY   — every row's stored total equals the sum of its own
 *                         categories, and every category with children equals the
 *                         sum of those children. Every registered
 *                         `source_rounding` acceptance is LISTED BY NAME with
 *                         its exact delta, so an exception is visible in the
 *                         output rather than implied by its absence, and the
 *                         COUNT is asserted per entity against the roster's
 *                         `expectedResidues`.
 *   (c) PROVENANCE      — every row's source_url is exactly reportFileUrl(ARN)
 *                         for its own fiscal year, source_date is <FY>-12-31,
 *                         data_source is the exact dataSourceLabel() string, and
 *                         each local PDF's sha256 matches a committed manifest.
 *   (d) UNITS           — per-capita is inside the entity's OWN re-derived band
 *                         for every row, with the actual value PRINTED per row
 *                         so drift is visible rather than merely absent. The
 *                         band is per entity because the corpus is mixed:
 *                         Bainbridge and Kitsap print whole dollars, Tacoma
 *                         prints in thousands, and one band wide enough for
 *                         both catches neither.
 *   (e) LABEL INTEGRITY — no leaf label is empty or purely numeric, and no leaf
 *                         label has another label of its own row as a prefix
 *                         (the dash-zero grafting signature).
 *   (h) PAGE IDENTITY   — for every loaded row, the governmental-funds statement
 *                         page is re-resolved from the PDF's own printed identity
 *                         and its General Fund column total is read directly off
 *                         the page, then matched to the DB. See below.
 *   (f) HIERARCHY       — every entity's county_id resolves to the parent county
 *                         the roster declares; exactly one WA row carries each
 *                         audited name; no duplicate of a different entity_type
 *                         exists.
 *   (g) ENRICHMENT      — every enrichment row for the audited entities carries
 *                         a non-NULL municipality_id.
 *
 * ── WHY (h) DOES NOT READ A STORED PAGE NUMBER ──────────────────────────────
 * Task 10 specifies (h) against "the row's stored statement_page". THERE IS NO
 * SUCH COLUMN. The extractors emit `statement_page` in their JSON, but
 * `treasury_sync_budget_tree` has nowhere to put it and `waSaoLoad.mjs` never
 * stamps it — the persisted provenance is source_url, source_date and
 * data_source only. Rather than assert a field that does not exist (which would
 * pass vacuously forever), (h) establishes the stronger property the field was
 * meant to stand in for: the number in the DB is the General Fund column of a
 * page that identifies ITSELF as the governmental-funds statement for that
 * fiscal year.
 *
 * It does that WITHOUT the extractor and WITHOUT the loader: an own
 * `pdftotext -table` pass, an own page-identity filter, an own read of the
 * page's `Total revenues` / `Total expenditures` row. The Task 9 requirement
 * that this "must not be satisfied by re-running the extractor and comparing to
 * itself" is met — no Python runs here and nothing on the load path is imported
 * except the ARN manifest and the label formatter, both of which are DATA.
 *
 * The page-identity regexes are the same set Task 9 arrived at, and are
 * duplicated here deliberately rather than imported: an audit that shared the
 * re-derivation harness's page-identity code would prove only that the two
 * agree with each other, which is the coupling this suite exists to avoid. If
 * the SAO's page shape ever changes, BOTH files must be updated — that is a
 * cost, and it is the cheaper of the two.
 *
 * That cost is real and has already been paid once: the three Tacoma
 * corrections (the `Govermental Funds` typo, the `General Governmental`
 * caption, and `amounts expressed in thousands`) had to be made in both files
 * independently, and this one carried the uncorrected versions for a commit.
 *
 * Ambiguity is fatal here for exactly the reason it is fatal in Task 9: nine of
 * ten silent wrong-page selections tied at $0 during Task 5, so "the true
 * statement sorts earliest" is not a tie-break this suite is allowed to use.
 *
 * ── EVERY COUNT IS SCOPED TO A municipality_id ──────────────────────────────
 * v2.21's scoping asserted app-wide that archive citation was a new provenance
 * class, and was wrong: New Hampshire already carried sixteen such rows. The
 * queries below take a municipality_id in every case, so an app-wide count is
 * not expressible here by accident.
 *
 * Read-only against the DB. Network is HEAD/ranged-GET only — nothing is
 * downloaded in full. No Python, no AI calls, $0 spend. Exit 0 iff all eight
 * checks pass.
 *
 * Usage:
 *   node scripts/verify-wa-audit.mjs
 *   node scripts/verify-wa-audit.mjs --only Tacoma
 *   node scripts/verify-wa-audit.mjs --offline     (skip the URL probes)
 *   node scripts/verify-wa-audit.mjs --record-sha  (write the manifest)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { reportFileUrl, SAO_HEADERS } from './lib/waSao.mjs';
import { dataSourceLabel } from './lib/waSaoLoad.mjs';
import { verifiableEntities } from './lib/waRoster.mjs';
import { BAINBRIDGE_ARNS, KITSAP_ARNS } from './fetchBainbridgeKitsap.mjs';
import { ARNS_BY_CITY } from './fetchWaCities.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── env ──────────────────────────────────────────────────────────────────────
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent — ignore */ }
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL) { console.error('Missing SUPABASE_URL — refusing to guess a production URL.'); process.exit(2); }
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

const OFFLINE = process.argv.includes('--offline');
const RECORD_SHA = process.argv.includes('--record-sha');

const DATASETS = ['operating', 'revenue'];
const SHA_MANIFEST = path.join(ROOT, 'scripts', 'data', 'wa-pdf-sha256.json');

// --only <Name> restricts the run to one entity so a city can be audited during
// a batch without re-reading the whole corpus. It narrows every expected count
// with it, so a filtered run can never be mistaken for a full one.
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg === -1 ? null : process.argv[onlyArg + 1];

// ARN manifests live with the fetcher that pinned them, and there are two:
// v2.22's Bainbridge/Kitsap fetcher and WA-CITIES-01's. Merged by entity name
// here so the audit takes an entity's ARNs from the roster key rather than from
// knowing which milestone onboarded it.
const ARNS_BY_ENTITY = {
  'Bainbridge Island': BAINBRIDGE_ARNS,
  'Kitsap County': KITSAP_ARNS,
  ...ARNS_BY_CITY,
};

// The entity list comes from scripts/lib/waRoster.mjs — the same source the
// seeder, every loader and the other two harnesses read. This file previously
// carried its own copy of each entity's window, exclusions, population and id;
// with eight WA entities that duplication is precisely how an audit comes to
// assert a window the loader no longer uses.
const ALL_ENTITIES = verifiableEntities().map((e) => ({
  key: e.name,
  id: e.expectId,
  entityType: e.entityType,
  countyName: e.countyName,
  population: e.population,
  perCapitaBand: e.perCapitaBand,
  dir: path.join(ROOT, ...e.pdfDir.split('/')),
  pdf: (fy) => `${e.pdfPrefix}-${fy}-acfr.pdf`,
  fys: e.fiscalYears,
  span: e.manifestSpan,
  excluded: e.excludedYears,
  expectedResidues: e.expectedResidues,
  arns: ARNS_BY_ENTITY[e.name] ?? {},
  roundingFiles: e.roundingFiles,
})).map((e) => ({ ...e, expectRows: e.fys.length * DATASETS.length }));

if (ONLY && !ALL_ENTITIES.some((e) => e.key === ONLY)) {
  console.error(`--only "${ONLY}" matches no verifiable entity. Known: ${ALL_ENTITIES.map((e) => e.key).join(', ')}`);
  process.exit(2);
}
const ENTITIES = ONLY ? ALL_ENTITIES.filter((e) => e.key === ONLY) : ALL_ENTITIES;

const EXPECTED_TOTAL_ROWS = ENTITIES.reduce((s, e) => s + e.expectRows, 0);

// ═══════════════════════════════════════════════════════════════════════════
// Registered source_rounding deltas, read as DATA out of the extractor files.
// Nothing is imported and no Python runs; comment lines are stripped first so
// the worked sums inside them can never be mistaken for entries. Convention:
// delta = computed - printed, so the PAGE PRINTS (dbTotal - delta).
// ═══════════════════════════════════════════════════════════════════════════
function loadRegisteredDeltas(files) {
  const deltas = new Map();
  const provenance = new Map();
  for (const f of files) {
    const src = readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
    const body = src.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    // Matches a multi-line dict OR a single-line empty one (`source_rounding={},`).
    // AN EMPTY REGISTRY IS LEGITIMATE and must not be conflated with a missing
    // one: Tacoma registers zero residues because it prints IN THOUSANDS, so its
    // components are already rounded to the thousand and sum exactly. The guard
    // that actually matters is still enforced — a file with no `source_rounding`
    // key at all throws, because that means the wrong file is being read or the
    // registry was deleted out from under the audit.
    const m = body.match(/source_rounding\s*=\s*\{([\s\S]*?)\}/);
    if (!m) throw new Error(`${f}: no source_rounding dict found — refusing to audit without the registrations`);
    const re = /\(\s*(\d{4})\s*,\s*'(operating|revenue)'\s*\)\s*:\s*(-?\d+)/g;
    let e;
    while ((e = re.exec(m[1])) !== null) {
      const k = `${e[1]}|${e[2]}`;
      if (deltas.has(k)) throw new Error(`registered delta ${k} appears in both ${provenance.get(k)} and ${f} — ambiguous registration`);
      deltas.set(k, Number(e[3]));
      provenance.set(k, f);
    }
  }
  return { deltas, provenance };
}

// ═══════════════════════════════════════════════════════════════════════════
// Own pdftotext pass + own page-identity filter. See the header for why this
// is duplicated from Task 9 rather than imported.
// ═══════════════════════════════════════════════════════════════════════════
const tableCache = new Map();
function tablePages(pdfPath) {
  if (tableCache.has(pdfPath)) return tableCache.get(pdfPath);
  if (!existsSync(pdfPath)) throw new Error(`PDF not on disk: ${pdfPath}`);
  const txt = execFileSync('pdftotext', ['-table', pdfPath, '-'],
    { maxBuffer: 512 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const pages = txt.split('\f');
  tableCache.set(pdfPath, pages);
  return pages;
}

const TITLE_RE = /statement\s+of\s+revenues?\s*,?\s*(and\s+)?expenditures/i;
const CHANGES_RE = /changes?\s+in\s+fund\s+balances?/i;
// `govern?mental` tolerates a SOURCE-DOCUMENT TYPO, not a parser convenience:
// Tacoma's FY2007 statement caption reads "Govermental Funds", missing the 'n'.
// Rejecting that page would silently drop a year that is otherwise perfectly
// readable, and "the scope line is misspelled" is not a reason to refuse a
// filing. The optional 'n' cannot match anything else meaningful.
const GOVFUNDS_RE = /govern?mental\s+funds/i;
const TOTAL_REV_RE = /^total\s+(operating\s+)?revenues?\b/i;
const TOTAL_EXP_RE = /^total\s+expenditures\b/i;
const REV_HEAD_RE = /^revenues?\b/i;
const EXCLUDE_RE = /\b(combining|budget|budgetary|proprietary|fiduciary|internal\s+service|agency\s+funds|net\s+position|reconciliation|cash\s+flows)\b/i;
const CONTINUATION_RE = /\bpage\s*([2-9]|\d\d+)\s*of\s*\d/i;
// The lookahead is `government\b`, NOT the shorter `govern`, and the difference
// is load-bearing. Its purpose is to stop the expenditure function "General
// Government" from being mistaken for a General Fund column caption. The
// original `(?!\s+govern)` also rejected "General Governmental" -- and Tacoma's
// FY2003 caption is exactly that, because its General Fund column header sits
// next to an "Other Governmental" one and flattens to
// "(0010) General Governmental Governmental Fund Funds Funds". That false
// negative dropped FY2003-FY2005 entirely. `\bgovernment\b` cannot match inside
// "governmental" (no word boundary before the "al"), so this still rejects
// "General Government" exactly as before.
const GF_CAPTION_RE = /\bgeneral\b(?!\s+government\b)/i;

function captionBlockEnd(lines) {
  const trimmed = lines.map((l) => l.trim());
  const i = trimmed.findIndex((t) => REV_HEAD_RE.test(t) && !/expenditures|statement/i.test(t));
  return i > 0 ? i + 1 : Math.min(lines.length, 25);
}

function findStatementPage(pages, label) {
  const cands = [];
  const rejected = [];
  pages.forEach((pg, i) => {
    const flat = pg.replace(/\s+/g, ' ');
    if (!TITLE_RE.test(flat)) return;
    if (!CHANGES_RE.test(flat)) return;
    const lines = pg.split('\n');
    const trimmed = lines.map((l) => l.trim());
    if (!trimmed.some((t) => TOTAL_REV_RE.test(t))) return;
    if (!trimmed.some((t) => TOTAL_EXP_RE.test(t))) return;
    const headFlat = lines.slice(0, captionBlockEnd(lines)).join(' ').replace(/\s+/g, ' ');
    if (!GOVFUNDS_RE.test(headFlat)) { rejected.push(`p${i + 1}: caption does not say "Governmental Funds"`); return; }
    const ex = headFlat.match(EXCLUDE_RE);
    if (ex) { rejected.push(`p${i + 1}: caption is a "${ex[0]}" page`); return; }
    if (CONTINUATION_RE.test(headFlat)) { rejected.push(`p${i + 1}: caption declares itself a continuation page`); return; }
    if (!GF_CAPTION_RE.test(headFlat)) { rejected.push(`p${i + 1}: caption carries no General Fund column`); return; }
    cands.push(i);
  });
  if (!cands.length) {
    throw new Error(`${label}: no governmental-funds statement page survived page identity` +
      (rejected.length ? ` (rejected: ${rejected.slice(0, 6).join('; ')})` : ''));
  }
  return { index: cands[0], text: pages[cands[0]], allCandidates: cands };
}

/** The page must say which year it is. Without this, document<->FY binding is
 *  by FILENAME alone. Kitsap's text layer collapses spaces, hence the second
 *  pattern. */
function assertPageYear(pageText, fy, label) {
  const flat = pageText.replace(/\s+/g, ' ');
  const period = flat.match(/year\s*ended\s*december\s*3\s*1\s*,?\s*(\d{4})/i);
  if (period) {
    if (Number(period[1]) !== fy) throw new Error(`${label}: page states "${period[0].trim()}" but the file is being read as FY${fy}`);
    return;
  }
  const p2 = flat.replace(/\s+/g, '').match(/YearEndedDecember31,?(\d{4})/i);
  if (p2) {
    if (Number(p2[1]) !== fy) throw new Error(`${label}: page states year ended December 31, ${p2[1]} but the file is being read as FY${fy}`);
    return;
  }
  throw new Error(`${label}: page carries no evidence it is FY${fy} — refusing to trust the filename alone`);
}

/**
 * ⚠ THE MOST DANGEROUS FUNCTION IN THIS FILE TO GET WRONG, for the same reason
 * it is in verify-wa-rederive.mjs: the tie gate is unit-invariant, so a missed
 * multiplier fails no arithmetic anywhere — it just makes every figure 1000x
 * wrong. Units are read off the page and never configured.
 *
 * The original pair of patterns matched Bainbridge and Kitsap (whole dollars,
 * so neither fires) and Seattle/King County ("(in thousands)"). Tacoma writes
 * "(amounts expressed in thousands)", which matched NEITHER, so this returned 1
 * on a page printing thousands. The broadened alternative is a bare
 * `in thousands`, deliberately: every phrasing of that caption means the same
 * thing, and no statement says it without meaning it. It also absorbs Tacoma
 * FY2003's genuine typo, "(amounts expresssed in thousands)" with three s's,
 * because the typo is in the word this pattern does not depend on.
 */
function unitsOf(pageText) {
  const flat = pageText.replace(/\s+/g, ' ');
  if (/\bin\s+millions\b/i.test(flat)) return 1_000_000;
  if (/\bin\s+thousands\b/i.test(flat)) return 1_000;
  return 1;
}

const MONEY_RE = /\(\s*\d[\d,]*\s*\)|\d[\d,]*/g;
/** Money cells of a row, left to right. Dash placeholders are NOT emitted —
 *  the Total row this is used on has every column filled, which is exactly why
 *  the Total row is the row (h) reads. */
function moneyCells(line) {
  const out = [];
  MONEY_RE.lastIndex = 0;
  let m;
  while ((m = MONEY_RE.exec(line)) !== null) {
    const raw = m[0];
    const digits = raw.replace(/[(),\s]/g, '');
    if (!/^\d+$/.test(digits)) continue;
    out.push(raw.trim().startsWith('(') ? -Number(digits) : Number(digits));
  }
  return out;
}

/**
 * The General Fund column total, read straight off the resolved page.
 *
 * GF is the LEFTMOST money column in every WA SAO governmental-funds statement
 * in this corpus, and the Total row carries every column, so the first money
 * cell of the Total row is the General Fund total. Everything read is printed
 * in the failure path, so a corpus that ever stops honouring that produces a
 * diagnostic rather than a wrong pass.
 */
function gfTotalOnPage(pageText, mode, label) {
  const want = mode === 'revenue' ? TOTAL_REV_RE : TOTAL_EXP_RE;
  const hits = pageText.split('\n').map((l) => l.trim()).filter((t) => want.test(t));
  if (!hits.length) throw new Error(`${label}: resolved page has no ${mode === 'revenue' ? 'Total revenues' : 'Total expenditures'} row`);
  if (hits.length > 1) throw new Error(`${label}: resolved page has ${hits.length} total rows for ${mode} — ambiguous: ${hits.map((h) => JSON.stringify(h)).join(' | ')}`);
  const cells = moneyCells(hits[0]);
  if (!cells.length) throw new Error(`${label}: total row carries no money cells — ${JSON.stringify(hits[0])}`);
  return { value: cells[0], cells, row: hits[0] };
}

// ═══════════════════════════════════════════════════════════════════════════
const results = [];
const record = (id, title, passed, detail) => { results.push({ id, title, passed, detail }); };

async function budgetRows(id) {
  const { data, error } = await sb.from('budgets')
    .select('id,fiscal_year,dataset_type,total_budget,source_url,source_date,data_source')
    .eq('municipality_id', id).order('fiscal_year').order('dataset_type');
  if (error) throw new Error(`budgets query failed: ${error.message}`);
  return data;
}

/** Categories + line items for one budget row, with the PostgREST 1000-row cap
 *  asserted rather than assumed — a silent truncation would make (b) and (e)
 *  under-scan and still report clean. */
async function treeOf(budgetId, label) {
  const { data: cats, error: ce } = await sb.from('budget_categories')
    .select('id,name,amount,sort_order').eq('budget_id', budgetId).order('sort_order');
  if (ce) throw new Error(`budget_categories query failed for ${label}: ${ce.message}`);
  const ids = cats.map((c) => c.id);
  if (!ids.length) return { cats: [], items: [] };
  const { data: items, error: ie } = await sb.from('budget_line_items')
    .select('id,category_id,description,actual_amount').in('category_id', ids);
  if (ie) throw new Error(`budget_line_items query failed for ${label}: ${ie.message}`);
  const { count, error: cErr } = await sb.from('budget_line_items')
    .select('*', { count: 'exact', head: true }).in('category_id', ids);
  if (cErr) throw new Error(`budget_line_items count failed for ${label}: ${cErr.message}`);
  if (items.length !== count) {
    throw new Error(`${label}: budget_line_items returned ${items.length} of ${count} rows (result-size cap) — the audit would have under-scanned`);
  }
  return { cats, items };
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function probeUrl(url) {
  const attempt = async (method, extra) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 60_000);
    try {
      const res = await fetch(url, { method, headers: { ...SAO_HEADERS, ...extra }, redirect: 'follow', signal: ac.signal });
      if (method === 'GET') { try { await res.arrayBuffer(); } catch { /* ignore */ } }
      let length = res.headers.get('content-length');
      const range = res.headers.get('content-range');
      if (range && /\/(\d+)$/.test(range)) length = range.match(/\/(\d+)$/)[1];
      return { status: res.status, type: (res.headers.get('content-type') || '').split(';')[0].trim(), length: length ? Number(length) : null };
    } finally { clearTimeout(timer); }
  };
  try {
    const head = await attempt('HEAD');
    if (head.status === 200 && head.length !== null) return head;
    const ranged = await attempt('GET', { Range: 'bytes=0-0' });
    if (ranged.status === 206 || ranged.status === 200) return { ...ranged, status: 200, via: 'ranged GET' };
    return head.status === 200 ? head : ranged;
  } catch (e) {
    return { status: null, type: null, length: null, error: e.message };
  }
}

async function main() {
  console.log(`=== WA SAO source-chain audit — ${ENTITIES.map((e) => e.key).join(', ')}${ONLY ? ' (--only)' : ''} ===`);
  console.log(`DB: ${SUPABASE_URL}`);
  console.log(`Expected rows: ${EXPECTED_TOTAL_ROWS} (${ENTITIES.map((e) => `${e.key} ${e.expectRows}`).join(', ')})\n`);

  const byEntity = {};
  const rounding = {};
  for (const e of ENTITIES) {
    byEntity[e.key] = await budgetRows(e.id);
    rounding[e.key] = loadRegisteredDeltas(e.roundingFiles);
  }

  // ── (a) year coverage, inclusions AND exclusions ──────────────────────────
  {
    const fail = [];
    for (const e of ENTITIES) {
      const rows = byEntity[e.key];
      if (rows.length !== e.expectRows) fail.push(`${e.key}: ${rows.length} rows, expected ${e.expectRows}`);
      const want = new Set(e.fys.flatMap((fy) => DATASETS.map((d) => `${fy}|${d}`)));
      const got = new Set(rows.map((r) => `${r.fiscal_year}|${r.dataset_type}`));
      for (const k of want) if (!got.has(k)) fail.push(`${e.key}: expected row ${k.replace('|', ' ')} is MISSING`);
      for (const k of got) if (!want.has(k)) fail.push(`${e.key}: UNEXPECTED row ${k.replace('|', ' ')} — outside the declared window`);

      // The exclusions are the point of this check, not a footnote: each one is
      // a deliberate refusal to publish, and a row appearing for one would mean
      // a figure nobody adjudicated got shipped.
      for (const [fy, why] of Object.entries(e.excluded)) {
        const present = rows.filter((r) => r.fiscal_year === Number(fy));
        if (present.length) {
          fail.push(`${e.key} FY${fy} is EXCLUDED (${why}) but ${present.length} row(s) exist — an unadjudicated figure was published`);
        }
      }
      const [lo, hi] = e.span;
      const spanYears = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const unaccounted = spanYears.filter((fy) => !e.fys.includes(fy) && !(fy in e.excluded));
      if (unaccounted.length) {
        fail.push(`${e.key}: FY ${unaccounted.join(', ')} are neither loaded nor declared excluded — the window has a silent hole`);
      }
      console.log(`  (a) ${e.key.padEnd(18)} ${e.fys.length} years x ${DATASETS.length} datasets = ${rows.length} rows; ` +
        `excluded ${Object.keys(e.excluded).map((y) => `FY${y}`).join(', ')} — all confirmed absent`);
    }
    const total = ENTITIES.reduce((s, e) => s + byEntity[e.key].length, 0);
    if (total !== EXPECTED_TOTAL_ROWS) fail.push(`total rows ${total}, expected ${EXPECTED_TOTAL_ROWS}`);
    record('a', 'the loaded year x dataset inventory equals the declared window exactly, and every excluded year has zero rows', fail.length === 0, fail);
  }

  // ── (b) tie integrity + the registered rounding acceptances, named ────────
  {
    const fail = [];
    let checkedRows = 0, checkedCats = 0;
    for (const e of ENTITIES) {
      for (const r of byEntity[e.key]) {
        const label = `${e.key} FY${r.fiscal_year} ${r.dataset_type}`;
        const { cats, items } = await treeOf(r.id, label);
        if (!cats.length) { fail.push(`${label}: no categories`); continue; }
        const byCat = new Map(cats.map((c) => [c.id, []]));
        for (const it of items) byCat.get(it.category_id)?.push(it);

        const catSum = cats.reduce((s, c) => s + Number(c.amount), 0);
        if (catSum !== Number(r.total_budget)) {
          fail.push(`${label}: total_budget ${r.total_budget} != sum of categories ${catSum} (delta ${Number(r.total_budget) - catSum})`);
        }
        for (const c of cats) {
          const kids = byCat.get(c.id);
          if (!kids.length) continue;   // flat leaf category — nothing to tie against
          const kidSum = kids.reduce((s, it) => s + Number(it.actual_amount), 0);
          if (kidSum !== Number(c.amount)) {
            fail.push(`${label} / "${c.name}": category amount ${c.amount} != sum of its ${kids.length} line items ${kidSum}`);
          }
          checkedCats++;
        }
        checkedRows++;
      }
    }
    // Name every acceptance. An exception that is only visible as the ABSENCE
    // of a failure is not visible at all.
    const named = [];
    for (const e of ENTITIES) {
      for (const [k, d] of [...rounding[e.key].deltas].sort()) {
        const [fy, mode] = k.split('|');
        named.push(`${e.key} FY${fy} ${mode}: delta ${d > 0 ? '+' : ''}${d} (registered in ${rounding[e.key].provenance.get(k)})`);
      }
    }
    console.log(`\n  (b) rows tied: ${checkedRows}; parent categories tied against their line items: ${checkedCats}`);
    console.log(`  (b) registered source_rounding acceptances: ${named.length}` +
      ` (${ENTITIES.map((e) => `${e.key} ${rounding[e.key].deltas.size}`).join(', ')})`);
    for (const n of named) console.log(`        • ${n}`);
    console.log('      NOTE: the LOADED total is always the component sum, never the page\'s printed');
    console.log(`      total, so all ${EXPECTED_TOTAL_ROWS} rows tie internally at $0 regardless of these acceptances.`);
    // Expected counts come from the roster, per entity, so a --only run asserts
    // the right number rather than the whole-corpus total. Tacoma's expected
    // count is a real ZERO, not an unfilled field: it prints in thousands, so
    // its components are already rounded to the thousand and sum exactly.
    const expectedResidues = ENTITIES.reduce((s, e) => s + (e.expectedResidues ?? -1), 0);
    for (const e of ENTITIES) {
      if (e.expectedResidues === undefined) {
        fail.push(`${e.key}: no expectedResidues declared in the roster — add one rather than letting an unasserted registry through`);
      }
    }
    if (named.length !== expectedResidues) {
      fail.push(`expected ${expectedResidues} registered source_rounding acceptances, found ${named.length}`);
    }
    record('b', `every row ties to its own categories and every parent category ties to its own line items; all ${expectedResidues} rounding acceptances named with exact deltas`, fail.length === 0, fail);
  }

  // ── (c) provenance: url == reportFileUrl(ARN), date, label, sha256 ────────
  {
    const fail = [];
    const shaNow = {};
    for (const e of ENTITIES) {
      for (const r of byEntity[e.key]) {
        const label = `${e.key} FY${r.fiscal_year} ${r.dataset_type}`;
        const arn = e.arns[r.fiscal_year];
        if (!arn) { fail.push(`${label}: no ARN in the manifest for this fiscal year`); continue; }
        const want = reportFileUrl(arn);
        if (r.source_url !== want) fail.push(`${label}: source_url is ${r.source_url || '(null)'}, expected ${want}`);
        const wantDate = `${r.fiscal_year}-12-31`;
        if (String(r.source_date ?? '').slice(0, 10) !== wantDate) {
          fail.push(`${label}: source_date ${r.source_date || '(null)'} != ${wantDate}`);
        }
        const wantLabel = dataSourceLabel(e.key, r.fiscal_year, r.dataset_type);
        if (r.data_source !== wantLabel) fail.push(`${label}: data_source is "${r.data_source || '(null)'}", expected "${wantLabel}"`);
      }
      // sha256 of each local PDF, one per loaded fiscal year.
      for (const fy of e.fys) {
        const file = path.join(e.dir, e.pdf(fy));
        if (!existsSync(file)) { fail.push(`${e.key} FY${fy}: local PDF missing at ${file}`); continue; }
        shaNow[`${e.key}|${fy}`] = { sha256: sha256(file), bytes: statSync(file).size };
      }
    }

    if (RECORD_SHA) {
      // Refused under --only: the manifest is whole-corpus, and rewriting it
      // from a single-entity run would silently DELETE every other entity's
      // pinned digest — turning the one artifact that pins document identity
      // into whatever the last filtered run happened to read.
      if (ONLY) {
        fail.push('--record-sha refused with --only: the manifest covers the whole corpus and a filtered ' +
          'rewrite would drop every other entity\'s pinned digest. Re-run --record-sha without --only.');
      } else {
        writeFileSync(SHA_MANIFEST, `${JSON.stringify(shaNow, null, 2)}\n`);
        console.log(`\n  (c) --record-sha: wrote ${Object.keys(shaNow).length} digests to ${path.relative(ROOT, SHA_MANIFEST)}`);
      }
    } else if (!existsSync(SHA_MANIFEST)) {
      fail.push(`sha256 manifest missing at ${path.relative(ROOT, SHA_MANIFEST)} — run once with --record-sha, review the diff, and commit it`);
    } else {
      const pinned = JSON.parse(readFileSync(SHA_MANIFEST, 'utf8'));
      // "the manifest pins something this run did not read" is only a finding
      // for the entities this run actually covers. Under --only every other
      // entity's pins are legitimately untouched.
      const inScope = (k) => ENTITIES.some((e) => k.startsWith(`${e.key}|`));
      for (const k of Object.keys(pinned)) {
        if (inScope(k) && !(k in shaNow)) fail.push(`sha256 manifest pins ${k} but no such local PDF was read`);
      }
      for (const [k, v] of Object.entries(shaNow)) {
        if (!(k in pinned)) { fail.push(`${k}: no pinned sha256 — the manifest and the loaded window disagree`); continue; }
        if (pinned[k].sha256 !== v.sha256) {
          fail.push(`${k}: sha256 ${v.sha256.slice(0, 16)}… != pinned ${pinned[k].sha256.slice(0, 16)}… — the local PDF is NOT the document that was audited`);
        }
      }
      console.log(`\n  (c) sha256 re-verified against the committed manifest: ${Object.keys(shaNow).length} PDFs`);
    }

    // The cited URL must still resolve, and must serve the document that was read.
    if (OFFLINE) {
      console.log('  (c) --offline: URL resolution NOT probed. This run does not verify the cited urls are live.');
    } else {
      for (const e of ENTITIES) {
        for (const fy of e.fys) {
          const url = reportFileUrl(e.arns[fy]);
          const probe = await probeUrl(url);
          const local = path.join(e.dir, e.pdf(fy));
          const localSize = existsSync(local) ? statSync(local).size : null;
          if (probe.status !== 200) fail.push(`${e.key} FY${fy}: ${url} → ${probe.status ?? 'network error'}${probe.error ? ` (${probe.error})` : ''}`);
          else if (probe.type !== 'application/pdf') fail.push(`${e.key} FY${fy}: content-type is "${probe.type}", not application/pdf`);
          // A served length is a LENGTH match, not a hash — say "length-matching",
          // never "byte-matching". The sha256 manifest above is what pins content.
          if (probe.length !== null && localSize !== null && probe.length !== localSize) {
            fail.push(`${e.key} FY${fy}: served ${probe.length} bytes but the local copy is ${localSize} bytes`);
          }
          console.log(`  (c) ${e.key.padEnd(18)} FY${fy}  ${String(probe.status ?? 'ERR').padStart(3)} ${String(probe.type || '-').padEnd(16)}` +
            `${probe.length === null ? '  (no length)' : `${String(probe.length).padStart(10)} B`}${probe.length !== null && probe.length === localSize ? '  == local pdf' : ''}`);
        }
      }
    }
    record('c', 'every row cites exactly reportFileUrl(ARN) for its own FY with source_date <FY>-12-31 and the exact data_source label; every local PDF matches its pinned sha256', fail.length === 0, fail);
  }

  // ── (d) units — per-capita, printed per row ───────────────────────────────
  // The band is PER ENTITY, from the roster. It was one shared [100, 10000]
  // constant while the corpus was two whole-dollar entities with similar fund
  // structures; that stops being defensible the moment the corpus is mixed.
  // Tacoma's band is [300, 3000] because Tacoma prints in thousands, and a
  // band wide enough for every entity is a band that catches nobody.
  {
    const fail = [];
    for (const e of ENTITIES) {
      const [lo, hi] = e.perCapitaBand;
      const vals = [];
      for (const r of byEntity[e.key]) {
        const pc = Number(r.total_budget) / e.population;
        vals.push({ fy: r.fiscal_year, ds: r.dataset_type, pc });
        if (pc < lo || pc > hi) {
          fail.push(`${e.key} FY${r.fiscal_year} ${r.dataset_type}: $${pc.toFixed(2)}/resident outside [${lo}, ${hi}] — a units error`);
        }
      }
      vals.sort((a, b) => a.pc - b.pc);
      console.log(`\n  (d) ${e.key} (pop ${e.population.toLocaleString()}, band [${lo}, ${hi}]): ` +
        `$${vals[0].pc.toFixed(2)}/resident ` +
        `(FY${vals[0].fy} ${vals[0].ds}) .. $${vals[vals.length - 1].pc.toFixed(2)} (FY${vals[vals.length - 1].fy} ${vals[vals.length - 1].ds})`);
      for (const v of vals) console.log(`        FY${v.fy} ${v.ds.padEnd(9)} $${v.pc.toFixed(2)}/resident`);
    }
    record('d', 'per-capita is inside each entity\'s own re-derived band on every row, with the actual value printed', fail.length === 0, fail);
  }

  // ── (e) label integrity ──────────────────────────────────────────────────
  {
    const fail = [];
    let scanned = 0;
    for (const e of ENTITIES) {
      for (const r of byEntity[e.key]) {
        const label = `${e.key} FY${r.fiscal_year} ${r.dataset_type}`;
        const { cats, items } = await treeOf(r.id, label);
        const byCat = new Map(cats.map((c) => [c.id, c.name]));
        const all = [
          ...cats.map((c) => ({ text: c.name, where: `category "${c.name}"` })),
          ...items.map((it) => ({ text: it.description, where: `"${byCat.get(it.category_id)}" / "${it.description}"` })),
        ];
        for (const a of all) {
          scanned++;
          const t = String(a.text ?? '').trim();
          if (!t) { fail.push(`${label}: EMPTY label at ${a.where}`); continue; }
          if (/^[\d.,$()\s-]+$/.test(t)) fail.push(`${label}: purely numeric label "${t}" at ${a.where}`);
          // PAGE-FURNITURE welded onto a label. Found live, not theorised:
          // Bainbridge FY2013 revenue shipped a category AND line item named
          // "______…___ Interest and Investment Revenue" — a rendered rule from
          // the PDF's left margin. The figure was correct and the row tied at
          // $0, so every arithmetic gate passed it through to production
          // display. This is the dash-zero lesson in another costume: a label
          // defect is invisible to a tie. Assert the label surface directly.
          if (/_{3,}/.test(t)) fail.push(`${label}: label carries a rendered rule (3+ underscores) — "${t}" at ${a.where}`);
          if (/Washington State Auditor/i.test(t)) fail.push(`${label}: label carries the SAO page-footer credit — "${t}" at ${a.where}`);
          if (/^[^A-Za-z(]/.test(t)) fail.push(`${label}: label starts with page furniture, not a letter — "${t}" at ${a.where}`);
        }
        // Dash-zero grafting welds one row's label onto the next. Its signature
        // is a leaf label that has ANOTHER label of the same row as a strict
        // prefix — "Public Safety" and "Public Safety Culture and Recreation".
        const texts = all.map((a) => String(a.text ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
        for (const a of texts) {
          for (const b of texts) {
            if (a === b || b.length <= a.length) continue;
            if (b.toLowerCase().startsWith(`${a.toLowerCase()} `)) {
              fail.push(`${label}: "${b}" has the sibling label "${a}" as a prefix — dash-zero grafting signature`);
            }
          }
        }
      }
    }
    console.log(`\n  (e) labels scanned: ${scanned}`);
    record('e', 'no label is empty or purely numeric, and no label carries a sibling label as a prefix (dash-zero grafting)', fail.length === 0, fail);
  }

  // ── (h) page identity — resolved from the document, not from a stored field ─
  {
    const fail = [];
    let unambiguous = 0, checked = 0;
    console.log('\n  (h) NOTE: there is no budgets.statement_page column. (h) asserts the stronger');
    console.log('      property it stood for — the DB figure is the General Fund column of a page');
    console.log('      that identifies itself as the governmental-funds statement for that FY.');
    for (const e of ENTITIES) {
      // Units are read off each page. They are not configured, and they are not
      // assumed constant across the corpus either — Bainbridge and Kitsap print
      // whole dollars while Tacoma prints in thousands. What IS asserted is that
      // one entity's own pages agree with each other: a single page declaring a
      // different scale from its siblings is a wrong page or a changed basis,
      // and the tie gate cannot see either.
      const unitsSeen = new Map();
      for (const fy of e.fys) {
        const file = path.join(e.dir, e.pdf(fy));
        let pages;
        try { pages = tablePages(file); }
        catch (err) { fail.push(`${e.key} FY${fy}: ${err.message}`); continue; }
        for (const ds of DATASETS) {
          const label = `${e.key} FY${fy} ${ds}`;
          checked++;
          try {
            const ind = findStatementPage(pages, label);
            assertPageYear(ind.text, fy, label);
            const units = unitsOf(ind.text);
            if (!unitsSeen.has(units)) unitsSeen.set(units, []);
            unitsSeen.get(units).push(label);
            if (ind.allCandidates.length !== 1) {
              // Fatal for the same reason as in Task 9: taking the first candidate
              // IS "the true statement sorts earliest", and 9 of 10 silent
              // wrong-page hits tied at $0.
              fail.push(`${label}: ${ind.allCandidates.length} candidate pages survived page identity ` +
                `(${ind.allCandidates.map((i) => `p${i + 1}`).join(', ')}) — page choice would rest on document order`);
            } else unambiguous++;

            const row = byEntity[e.key].find((r) => r.fiscal_year === fy && r.dataset_type === ds);
            if (!row) { fail.push(`${label}: no DB row to compare the page against`); continue; }
            const delta = rounding[e.key].deltas.get(`${fy}|${ds}`) ?? 0;
            const expectPrinted = Number(row.total_budget) - delta;   // delta = computed - printed
            const gf = gfTotalOnPage(ind.text, ds, label);
            // Scaled by the units the PAGE declares. The DB always holds whole
            // dollars, so an entity printing in thousands compares 1000x low
            // without this — and the comparison is the only place a units
            // mistake surfaces at all, the tie being unit-invariant.
            const printed = gf.value * units;
            if (printed !== expectPrinted) {
              fail.push(`${label}: page ${ind.index + 1} General Fund total prints ${gf.value}` +
                `${units === 1 ? '' : ` x${units} = ${printed}`}, but the DB holds ` +
                `${row.total_budget}${delta ? ` (registered delta ${delta}, so the page should print ${expectPrinted})` : ''}. ` +
                `Row read: ${JSON.stringify(gf.row)} → cells [${gf.cells.join(', ')}]`);
            }
            if (ds === 'operating') {
              console.log(`  (h) ${e.key.padEnd(18)} FY${fy}  p.${String(ind.index + 1).padStart(3)}  ` +
                `GF exp ${String(printed).padStart(11)}  x${String(units).padStart(4)}  ` +
                `${ind.allCandidates.length === 1 ? 'single candidate' : `${ind.allCandidates.length} CANDIDATES`}`);
            }
          } catch (err) {
            fail.push(`${label}: ${err.message}`);
          }
        }
      }
      if (unitsSeen.size > 1) {
        fail.push(`${e.key}: its own statement pages declare ${unitsSeen.size} different scales ` +
          `(${[...unitsSeen].map(([u, ls]) => `x${u} on ${ls.length} page(s), e.g. ${ls[0]}`).join('; ')}) — ` +
          `a page disagreeing with its siblings about scale is a wrong page or a changed basis`);
      } else if (unitsSeen.size === 1) {
        const [u] = [...unitsSeen.keys()];
        console.log(`  (h) ${e.key.padEnd(18)} every page declares the SAME scale: x${u} ` +
          `(${u === 1 ? 'whole dollars' : 'in thousands'}), read off the pages, never configured`);
      }
    }
    console.log(`  (h) rows whose statement page was resolved unambiguously: ${unambiguous}/${checked}`);
    record('h', 'every row\'s figure is the General Fund column total of a page that identifies itself as that FY\'s governmental-funds statement, with exactly one candidate page', fail.length === 0, fail);
  }

  // ── (f) hierarchy ────────────────────────────────────────────────────────
  {
    const fail = [];
    // Parent counties are fetched alongside the audited entities even though
    // they are not audited themselves: Tacoma's parent is Pierce County, a
    // NAV-ONLY node with no budget rows, so it is not in ENTITIES and the link
    // could not be checked without naming it here.
    const wantNames = [...new Set([
      ...ENTITIES.map((e) => e.key),
      ...ENTITIES.map((e) => e.countyName).filter(Boolean),
    ])];
    const { data: munis, error } = await sb.from('municipalities')
      .select('id,name,state,entity_type,county_id,population')
      .in('name', wantNames);
    if (error) throw new Error(`municipalities query failed: ${error.message}`);

    for (const e of ENTITIES) {
      const matches = munis.filter((m) => m.name === e.key);
      if (matches.length !== 1) {
        fail.push(`${e.key}: ${matches.length} rows named this, expected exactly 1 ` +
          `(${matches.map((m) => `${m.state}/${m.entity_type}`).join(', ') || 'none'})`);
        continue;
      }
      const m = matches[0];
      if (m.id !== e.id) fail.push(`${e.key}: id ${m.id} != the audited ${e.id}`);
      if (m.state !== 'WA') fail.push(`${e.key}: state is ${m.state}, expected WA`);
      if (m.entity_type !== e.entityType) fail.push(`${e.key}: entity_type is ${m.entity_type}, expected ${e.entityType}`);
      if (Number(m.population) !== e.population) fail.push(`${e.key}: population ${m.population} != the WA OFM figure ${e.population} used for the per-capita band`);
    }
    console.log('');
    for (const e of ENTITIES) {
      const m = munis.find((x) => x.name === e.key);
      if (!m) continue;   // already reported above
      if (!e.countyName) {
        if (m.county_id !== null) fail.push(`${e.key}.county_id is ${m.county_id}, expected null (a county has no parent county)`);
        console.log(`  (f) ${e.key} (${m.entity_type}, pop ${m.population}) → no parent county, as declared`);
        continue;
      }
      const parent = munis.find((x) => x.name === e.countyName && x.state === 'WA');
      if (!parent) {
        fail.push(`${e.key}: its declared parent "${e.countyName}" has no WA municipalities row`);
        continue;
      }
      if (m.county_id !== parent.id) {
        fail.push(`${e.key}.county_id is ${m.county_id || '(null)'}, expected ${e.countyName} ${parent.id}`);
      }
      console.log(`  (f) ${e.key} (${m.entity_type}, pop ${m.population}) → ${parent.name} (${parent.entity_type}, pop ${parent.population})`);
    }
    record('f', 'exactly one WA row carries each audited name, every entity\'s county_id resolves to its declared parent county, and every population is the WA OFM figure', fail.length === 0, fail);
  }

  // ── (g) enrichment scoping ───────────────────────────────────────────────
  {
    const fail = [];
    const ids = ENTITIES.map((e) => e.id);
    const { data, error } = await sb.from('category_enrichment')
      .select('id,name_key,municipality_id').in('municipality_id', ids);
    if (error) throw new Error(`category_enrichment query failed: ${error.message}`);
    for (const row of data) {
      if (!row.municipality_id) fail.push(`enrichment row ${row.id} (${row.name_key}) has a NULL municipality_id — it would bleed into every other entity`);
    }
    console.log(`\n  (g) enrichment rows scoped to the ${ENTITIES.length} audited entities: ${data.length}`);
    if (data.length === 0) {
      // Say this loudly. A vacuous pass that reads like a verified one is the
      // failure mode this suite exists to prevent.
      console.log(`      ⚠ ZERO enrichment rows exist for ${ENTITIES.length === 1 ? 'this entity' : 'any of these entities'} — the enrichment task has not run yet.`);
      console.log('      (g) therefore passes VACUOUSLY. It is not evidence that enrichment is correct;');
      console.log('      it is only evidence that nothing unscoped has been written. RE-RUN AFTER ENRICHMENT.');
    }
    record('g', 'every enrichment row for the audited entities carries a non-NULL municipality_id', fail.length === 0, fail);
  }

  // ── verdict ──────────────────────────────────────────────────────────────
  console.log('\n--- audit results ---');
  for (const r of results) {
    console.log(`  (${r.id}) ${r.passed ? 'PASS' : 'FAIL'} — ${r.title}`);
    if (!r.passed) for (const d of r.detail) console.log(`         • ${d}`);
  }
  const failed = results.filter((r) => !r.passed);
  console.log(`\n${failed.length === 0
    ? `RESULT: PASS — all ${results.length} checks pass across ${EXPECTED_TOTAL_ROWS} rows.`
    : `RESULT: FAIL — ${failed.length} of ${results.length} checks failed.`}`);
  if (failed.length === 0 && OFFLINE) console.log('NOTE: --offline was set, so (c) did not probe url resolution.');
  return failed.length === 0 ? 0 : 1;
}

// Set exitCode and let the event loop drain rather than calling process.exit():
// an abrupt exit races undici's keep-alive socket into a Windows libuv
// UV_HANDLE_CLOSING assertion.
main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Fatal:', e); process.exitCode = 2; })
  .finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref(); });
