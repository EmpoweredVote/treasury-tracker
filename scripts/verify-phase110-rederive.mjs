#!/usr/bin/env node
/**
 * verify-phase110-rederive.mjs
 *
 * Loader-independent ACFR re-derivation harness for Phase 110 / VER-05 (a).
 *
 * Purpose: Independently re-derive — from each state's own ACFR PDF, WITHOUT
 * importing any scripts/process*.js loader OR the shared parser
 * scripts/maAcfrExtract.mjs — the General-Fund printed totals for the v2.13
 * tranche-2 sample (all 10 Batch-1 + Batch-2 states), then diff against
 * treasury.budgets live values.
 *
 * INDEPENDENCE RULE (blind method): this harness re-keys the GENERAL-FUND column
 * "Total revenues" / "Total expenditures" printed lines with its OWN minimal
 * extraction (auto-locates the Governmental Funds statement page, takes the
 * first numeric token on each total line = the GF 1st-column value). It does
 * NOT import extractGovFundGeneralColumn/…Positional — that parser IS the
 * loaders' extraction path; reusing it would re-test the loader against itself.
 *
 * Sample (VER-05: bookends + newest FY per state; both datasets unless rev-only):
 *   NJ  FY2020 + FY2025                      (units: FULL DOLLARS ×1 — 107-03 decision)
 *   MA  FY2003 + FY2016 (middle) + FY2025    (thousands; holes FY2001/02/04/05/14/21 not sampled)
 *   NC  FY2012 + FY2019 (middle) + FY2025    (thousands; post-colon-fix full window FY2012-2025)
 *   GA  FY2021 + FY2025                      (thousands)
 *   MD  FY2022 (ALSO the Batch-1 clamp year) + FY2025 (thousands)
 *   TN  FY2009 + FY2017 (middle) + FY2025    (thousands; tn.gov needs browser UA on re-fetch)
 *   CT  FY2002 + FY2025 + FY2013 (clamp, rev-only)  (thousands; FY2002 = pre-GASB-34 boundary)
 *   WI  FY2002 + FY2025 + FY2013 (clamp, rev-only)  (thousands)
 *   WA  FY2020 + FY2025 + FY2022 (clamp, rev-only)  (thousands; largest clamp −$216,940K)
 *   MI  FY2019 + FY2025                      (thousands; Sep-30 FY-end; all-caps headers;
 *                                             "(Note NN)" refs handled by our own stripper)
 *   = 23 both-dataset targets ×2 + 3 rev-only = 49 FY-dataset checks.
 *
 * Random-middle-year documentation (reproducibility):
 *   MA FY2016: mid-window year in the contiguous FY2015-FY2020 run (avoids the
 *              FY2014 hole); exercises the middle of the 19-year window.
 *   NC FY2019: arithmetic middle-ish (year 8/14) of FY2012-FY2025.
 *   TN FY2017: arithmetic middle (year 9/17) of FY2009-FY2025; token-order era.
 *
 * Clamp-year bar: for MD FY2022, CT FY2013, WI FY2013, WA FY2022 the bar is the
 * printed GF root/control total (which already nets the negative line) — matching
 * how the loader stored total_budget.
 *
 * TOLERANCE (exact-0, Phase 106 D-03 carried forward): PASS only on
 * abs(delta) === 0. The ONLY acceptable non-zero dispositions (handled in the
 * REDERIVATION log, not here) are the loadlogs' documented GAAP printed-vs-line-sum
 * rounding notes (MA FY2023/24, MD FY2022/25, MI FY2025 rev). Since the loaders
 * stored the PRINTED totals for the sampled bookends, all 49 checks are expected
 * to tie exactly.
 *
 * Source bytes: uses the load-time verified cache _acfr-work/{st}/{ST}{YYYY}.pdf
 * (each verified %PDF magic + size at load; Phase 106 cache-reuse precedent).
 * If a cache file is missing, re-fetches from the recorded canonical URL
 * (107-BATCH{1,2}-SOURCES.md + LOADLOG load-time corrections — NOT loader maps)
 * with the soft-404 guard (Content-Type application/pdf OR >= 1 MB).
 *
 * No loader imports. No AI calls. $0 spend. pdftotext + read-only DB access.
 * Exit 0 = all checks tie exactly; Exit 2 = one or more checks FAIL.
 *
 * Usage: node scripts/verify-phase110-rederive.mjs
 */

import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Env loading (walk up for .env.local/.env — same pattern as 106 harness) ────
function loadEnv() {
  const searchDirs = [];
  let dir = resolve(__dirname, '..');
  for (let i = 0; i < 6; i++) {
    searchDirs.push(dir);
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  for (const searchDir of searchDirs) {
    for (const fname of ['.env.local', '.env']) {
      const fpath = resolve(searchDir, fname);
      if (!existsSync(fpath)) continue;
      try {
        for (const line of readFileSync(fpath, 'utf8').split('\n')) {
          const [k, ...v] = line.split('=');
          if (k && v.length && !process.env[k.trim()]) {
            process.env[k.trim()] = v.join('=').trim();
          }
        }
      } catch {}
    }
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) break;
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── DB helper (native https, read-only) ────────────────────────────────────────
function dbGet(path) {
  return new Promise((resolvePromise, reject) => {
    const parsedUrl = new URL(`${SUPABASE_URL}${path}`);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Accept-Profile': 'treasury',
        'Accept': 'application/json',
      },
      agent: false,
    }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try { resolvePromise(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── PDF fetch fallback (soft-404 guard; browser UA for tn.gov) ─────────────────
function downloadPdf(url, destPath, opts) {
  const maxRedirects = opts?.maxRedirects ?? 5;
  return new Promise((resolvePromise, reject) => {
    const parsedUrl = new URL(url);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    // tn.gov resets plain-client connections — browser UA required (109-01 finding).
    const ua = parsedUrl.hostname.endsWith('tn.gov')
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
      : 'Mozilla/5.0 (compatible; TreasuryTracker-Verify/1.0)';
    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { 'User-Agent': ua },
      agent: false,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers['location'];
        if (!loc) return reject(new Error(`Redirect with no Location from ${url}`));
        if (maxRedirects <= 0) return reject(new Error(`Too many redirects from ${url}`));
        res.resume();
        return downloadPdf(loc, destPath, { maxRedirects: maxRedirects - 1 }).then(resolvePromise).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`)); }
      const contentType = res.headers['content-type'] || '';
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // T-110-01 soft-404 guard: PDF content-type OR >= 1 MB, plus %PDF magic.
        const okType = contentType.includes('application/pdf');
        const okSize = buf.length >= 1_000_000;
        const okMagic = buf.subarray(0, 5).toString('latin1') === '%PDF-';
        if (!okMagic || (!okType && !okSize)) {
          return reject(new Error(`T-110-01 SOFT-404 for ${url}: Content-Type="${contentType}", size=${buf.length}, magic=${okMagic}`));
        }
        writeFileSync(destPath, buf);
        resolvePromise(destPath);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Full-PDF pdftotext with page separators ────────────────────────────────────
function extractAllPages(pdfPath) {
  const result = execFileSync('pdftotext', ['-table', pdfPath, '-'], { maxBuffer: 200 * 1024 * 1024 });
  return result.toString('utf8').split('\f');
}

// ── Auto-locate the Governmental Funds statement page ──────────────────────────
// A candidate page: title contains "statement of revenues, expenditures" AND
// "changes in fund balance" — but NOT "combining" (nonmajor-fund combining
// statements), NOT "budget" (budgetary comparison schedules), NOT "expenses"
// in the title phrase (proprietary funds use Expenses). Totals may sit on the
// candidate page or its continuation, so parse page i then i..i+1.
function findStatementTotals(pages, label) {
  for (let i = 0; i < pages.length; i++) {
    // -table mode pads column gaps into the title line ("Changes    in Fund
    // Balances") — collapse whitespace before phrase checks.
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!p.includes('statement of revenues, expenditures')) continue;
    if (!p.includes('changes in fund balance')) continue;
    if (p.includes('combining')) continue;
    if (p.includes('budget')) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      const totals = parseGFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) {
        return { ...totals, page: i + 1 };
      }
    }
  }
  // Second pass: relax the two-phrase title requirement (older editions split
  // the title across lines with variable whitespace) — still exclude
  // combining/budget pages, still require a real Total revenues line.
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!/statement of revenues,? expenditures/.test(p)) continue;
    if (p.includes('combining') || p.includes('budget')) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      const totals = parseGFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) {
        return { ...totals, page: i + 1 };
      }
    }
  }
  return { revenues: null, expenditures: null, page: null };
}

// ── Number parsing (our own — NOT maAcfrExtract) ──────────────────────────────
// First numeric token on a total line = the GF 1st-column printed value.
// Strips "(Note NN)" cross-refs (MI) position-agnostically before scanning;
// handles parenthesized negatives and $ prefixes.
function extractFirstNumberFromLine(line) {
  const cleaned = line.replace(/\(Note\s+\d+\)/gi, ' ').replace(/\$/g, ' ');
  const numRe = /\([\d,]+\)|\d{1,3}(?:,\d{3})+|\d+/g;
  const m = cleaned.match(numRe);
  if (!m) return null;
  const raw = m[0].replace(/,/g, '');
  if (raw.startsWith('(')) return -parseInt(raw.slice(1, -1).replace(/,/g, ''), 10);
  return parseInt(raw, 10);
}

// Case-insensitive total-line matcher. The label must START the line (after
// whitespace) so "Excess of revenues..." style lines never match.
function parseGFTotals(text) {
  let revenues = null;
  let expenditures = null;
  for (const line of text.split('\n')) {
    const lower = line.toLowerCase();
    if (revenues === null && /^\s*total revenues(\s|$|[^a-z])/.test(lower) && !/other/.test(lower)) {
      revenues = extractFirstNumberFromLine(line);
    }
    if (revenues === null && /^\s*total revenues and other/.test(lower)) {
      revenues = extractFirstNumberFromLine(line);
    }
    if (expenditures === null && /^\s*total expenditures(\s|$|[^a-z])/.test(lower) && !/other/.test(lower)) {
      expenditures = extractFirstNumberFromLine(line);
    }
    if (expenditures === null && /^\s*total expenditures and other/.test(lower)) {
      expenditures = extractFirstNumberFromLine(line);
    }
  }
  return { revenues, expenditures };
}

function fmt(n) {
  if (n === null || n === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtRaw(n) {
  if (n === null || n === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}
function padR(s, n) { return String(s ?? 'N/A').padEnd(n); }
function padL(s, n) { return String(s ?? 'N/A').padStart(n); }

// ── Target configuration — v2.13 tranche-2 sample (26 targets, 49 checks) ──────
// cache: _acfr-work/{st}/{ST}{YYYY}.pdf (load-time verified bytes).
// url: canonical re-fetch source per 107-BATCH{1,2}-SOURCES.md + LOADLOG
//      load-time corrections (NJ /pdfs/ segment removed; MA acfr_fy-{YYYY} works
//      for the full window; NC/CT deep years enumerated from archive pages —
//      marked enumerate-only where recon recorded no stable per-year URL).
const T = (state, stateName, fy, cacheFile, url, units, opts = {}) => ({
  state, stateName, fy, cacheFile, url, units,
  revOnly: opts.revOnly || false,
  notes: opts.notes || '',
});

const TARGETS = [
  // ── New Jersey (FULL DOLLARS ×1 — the only non-thousands tranche state) ──────
  T('NJ', 'New Jersey', 2020, 'nj/NJ2020.pdf', 'https://www.nj.gov/treasury/omb/publications/20fr/NJFRFY2020Complete.pdf', 1,
    { notes: 'Oldest bookend. UNITS=1 (dollars). LOADLOG-corrected URL (no /pdfs/).' }),
  T('NJ', 'New Jersey', 2025, 'nj/NJ2025.pdf', 'https://www.nj.gov/treasury/omb/publications/25fr/NJFY2025Complete.pdf', 1,
    { notes: 'Newest bookend. FY2025 drops the FR infix.' }),

  // ── Massachusetts (post-colon-fix window FY2003-2025, holes 01/02/04/05/14/21) ─
  T('MA', 'Massachusetts', 2003, 'ma/MA2003.pdf', 'https://www.macomptroller.org/wp-content/uploads/acfr_fy-2003.pdf', 1000,
    { notes: 'Oldest loaded FY (recovered by the colon fix).' }),
  T('MA', 'Massachusetts', 2016, 'ma/MA2016.pdf', 'https://www.macomptroller.org/wp-content/uploads/acfr_fy-2016.pdf', 1000,
    { notes: 'Random middle (documented): mid-window in the contiguous FY2015-2020 run.' }),
  T('MA', 'Massachusetts', 2025, 'ma/MA2025.pdf', 'https://www.macomptroller.org/wp-content/uploads/acfr_fy-2025.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── North Carolina (post-colon-fix full window FY2012-2025, 0 holes) ─────────
  T('NC', 'North Carolina', 2012, 'nc/NC2012.pdf', null, 1000,
    { notes: 'Oldest loaded FY. URL enumerate-only (ncosc.gov archive June_30_2012_CAFR.pdf; dir prefix per archive page).' }),
  T('NC', 'North Carolina', 2019, 'nc/NC2019.pdf', null, 1000,
    { notes: 'Random middle (documented): year 8/14 of FY2012-2025. URL enumerate-only.' }),
  T('NC', 'North Carolina', 2025, 'nc/NC2025.pdf', 'https://www.ncosc.gov/sites/default/files/2025-11/ncacfr2025.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── Georgia ──────────────────────────────────────────────────────────────────
  T('GA', 'Georgia', 2021, 'ga/GA2021.pdf', 'https://sao.georgia.gov/document/document/fy-2021-acfr/download', 1000,
    { notes: 'Oldest bookend.' }),
  T('GA', 'Georgia', 2025, 'ga/GA2025.pdf', 'https://sao.georgia.gov/document/document/fy-2025-acfr/download', 1000,
    { notes: 'Newest bookend. FY2023 supersede (F-97-01) checked by cohort audit.' }),

  // ── Maryland (FY2022 = Batch-1 clamp year AND oldest bookend) ────────────────
  T('MD', 'Maryland', 2022, 'md/MD2022.pdf', 'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/ACFR2022.pdf', 1000,
    { notes: 'Oldest bookend + CLAMP year: "Interest and other investment income" -275,992K; printed root nets it. Uppercase ACFR filename (FY2022/23).' }),
  T('MD', 'Maryland', 2025, 'md/MD2025.pdf', 'https://www.marylandcomptroller.gov/content/dam/mdcomp/md/reports/financial/acfr2025.pdf', 1000,
    { notes: 'Newest bookend. Lowercase acfr filename (FY2024/25). Loadlog: rev printed-vs-line-sum -$1 GAAP rounding (stored = printed).' }),

  // ── Tennessee (tn.gov browser-UA on re-fetch) ────────────────────────────────
  T('TN', 'Tennessee', 2009, 'tn/TN2009.pdf', 'https://www.tn.gov/content/dam/tn/finance/acfr/archive/acfr_fy09.pdf', 1000,
    { notes: 'Oldest bookend. Blank-GF-cell era for line items; totals row fully populated.' }),
  T('TN', 'Tennessee', 2017, 'tn/TN2017.pdf', 'https://www.tn.gov/content/dam/tn/finance/acfr/archive/acfr_fy17.pdf', 1000,
    { notes: 'Random middle (documented): year 9/17 of FY2009-2025.' }),
  T('TN', 'Tennessee', 2025, 'tn/TN2025.pdf', 'https://www.tn.gov/content/dam/tn/finance/acfr/archive/ACFR%20-%20FY25.pdf', 1000,
    { notes: 'Newest bookend. Space-dash filename special case.' }),

  // ── Connecticut (FY2002 = pre-GASB-34 boundary; FY2013 clamp rev-only) ───────
  T('CT', 'Connecticut', 2002, 'ct/CT2002.pdf', 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY2002.pdf', 1000,
    { notes: 'Oldest loaded FY — first GASB-34 edition (deep-window boundary).' }),
  T('CT', 'Connecticut', 2013, 'ct/CT2013.pdf', null, 1000,
    { revOnly: true, notes: 'CLAMP year (rev-only): "Investment Earnings (Loss)" -2,100K; printed root 20,134,738K nets it. URL enumerate-only (_reportsSource JSON on osc.ct.gov/reports).' }),
  T('CT', 'Connecticut', 2025, 'ct/CT2025.pdf', 'https://osc.ct.gov/wp-content/uploads/2026/03/State-of-Connecticut-ACFR-2-27-26_Final.pdf', 1000,
    { notes: 'Newest bookend. 7-column layout (General is 1st).' }),

  // ── Wisconsin (FY2002 lowercase cafr filename; FY2013 clamp rev-only) ────────
  T('WI', 'Wisconsin', 2002, 'wi/WI2002.pdf', 'https://doa.wi.gov/DEBFCapitalFinance/2002/2002cafr.pdf', 1000,
    { notes: 'Oldest loaded FY. Lowercase cafr filename (load-time correction).' }),
  T('WI', 'Wisconsin', 2013, 'wi/WI2013.pdf', 'https://doa.wi.gov/DEBFCapitalFinance/2013/2013CAFR_Linked.pdf', 1000,
    { revOnly: true, notes: 'CLAMP year (rev-only): Interest Income -838K; printed root 23,786,216K nets it.' }),
  T('WI', 'Wisconsin', 2025, 'wi/WI2025.pdf', 'https://doa.wi.gov/budget/FY%202025%20ACFR%20Final.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── Washington (FY2022 clamp rev-only — the tranche\'s largest) ──────────────
  T('WA', 'Washington', 2020, 'wa/WA2020.pdf', 'https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2020/CAFR20.pdf', 1000,
    { notes: 'Oldest bookend. CAFR20 (not ACFR20) filename.' }),
  T('WA', 'Washington', 2022, 'wa/WA2022.pdf', 'https://ofm.wa.gov/wp-content/uploads/sites/default/files/public/accounting/report/CAFR/2022/ACFR22.pdf', 1000,
    { revOnly: true, notes: 'CLAMP year (rev-only): "Investment income (loss)" -216,940K (adverse bond market); printed root 53,683,370K nets it.' }),
  T('WA', 'Washington', 2025, 'wa/WA2025.pdf', 'https://ofm.wa.gov/wp-content/uploads/FY-2025-Annual-Comprehensive-Financial-Report.pdf', 1000,
    { notes: 'Newest bookend. Unique FY2025 filename.' }),

  // ── Michigan (Sep-30 FY-end; all-caps headers; "(Note NN)" refs) ─────────────
  T('MI', 'Michigan', 2019, 'mi/MI2019.pdf', 'https://www.michigan.gov/budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report/ACFR-FY2019.pdf', 1000,
    { notes: 'Oldest bookend. Fund-code column headers (GF = Fund 10, 1st).' }),
  T('MI', 'Michigan', 2025, 'mi/MI2025.pdf', 'https://www.michigan.gov/budget/-/media/Project/Websites/budget/Archive/Annual-Comprehensive-Financial-Report/FY-2025-ACFR.pdf', 1000,
    { notes: 'Newest bookend. Reversed FY-2025-ACFR filename. Loadlog: rev printed-vs-line-sum +1K GAAP rounding (stored = printed).' }),
];

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('');
console.log('Phase 110 -- Loader-Independent ACFR Re-Derivation Harness');
console.log('VER-05 (a): v2.13 tranche-2 sample -- NJ MA NC GA MD TN CT WI WA MI');
console.log('Tolerance: PASS = abs(delta) === 0 EXACTLY (Phase 106 D-03 carried forward)');
console.log('Method: blind re-extract from source PDF; imports ZERO loaders / ZERO maAcfrExtract');
const totalChecks = TARGETS.reduce((n, t) => n + (t.revOnly ? 1 : 2), 0);
console.log(`Sample: ${TARGETS.length} FY targets -> ${totalChecks} FY-dataset checks`);
console.log('');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL / SUPABASE_SERVICE_KEY env. Load .env.local or .env first.');
  process.exit(1);
}

// Step 1: resolve municipality IDs by entity name (runtime, no hardcoding).
console.log('-- Step 1: Resolve state municipality IDs ----------------------------------');
const stateNames = [...new Set(TARGETS.map(t => t.stateName))];
const midMap = {};
for (const name of stateNames) {
  const rows = await dbGet(`/rest/v1/municipalities?entity_type=eq.state&name=eq.${encodeURIComponent(name)}&select=id,name`);
  if (!Array.isArray(rows) || rows.length !== 1) {
    console.error(`  ERROR resolving ${name}: expected exactly 1 state row, got ${Array.isArray(rows) ? rows.length : 'error'}`);
    process.exit(1);
  }
  midMap[name] = rows[0].id;
  console.log(`  ${name}: ${rows[0].id}`);
}

// Step 2: per-target blind extraction + DB diff.
console.log('');
console.log('-- Step 2: Blind re-extract GF printed totals + diff vs treasury.budgets ---');
const checks = [];

for (const t of TARGETS) {
  console.log('');
  console.log(`  -- ${t.stateName} FY${t.fy} --`);
  if (t.notes) console.log(`     ${t.notes}`);

  const pdfPath = resolve(PROJECT_ROOT, '_acfr-work', t.cacheFile);
  const failBoth = (msg) => {
    for (const dataset of t.revOnly ? ['revenue'] : ['revenue', 'operating']) {
      checks.push({ label: `${t.state} FY${t.fy}`, dataset, acfrDollars: null, stored: null, delta: null, pass: false, verdictStr: `FAIL (${msg})`, notes: t.notes });
    }
  };

  // Source bytes: load-time verified cache, else canonical re-fetch.
  if (existsSync(pdfPath)) {
    const st = statSync(pdfPath);
    const head = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
    if (head !== '%PDF-' || st.size < 500_000) { failBoth(`cache file invalid (magic=${head}, size=${st.size})`); continue; }
    console.log(`    Cache: ${t.cacheFile} (${(st.size / 1024 / 1024).toFixed(1)} MB, %PDF ok)`);
  } else if (t.url) {
    console.log(`    Downloading: ${t.url}`);
    try {
      mkdirSync(dirname(pdfPath), { recursive: true });
      await downloadPdf(t.url, pdfPath);
      console.log(`    Downloaded: ${(statSync(pdfPath).size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) { failBoth(`download error: ${e.message}`); continue; }
  } else {
    failBoth('cache missing and URL is enumerate-only (re-enumerate from the state archive page)');
    continue;
  }

  // Blind extraction: auto-locate the Governmental Funds statement.
  let totals;
  try {
    const pages = extractAllPages(pdfPath);
    totals = findStatementTotals(pages, `${t.state}${t.fy}`);
  } catch (e) { failBoth(`pdftotext error: ${e.message}`); continue; }

  if (totals.page === null) { failBoth('Governmental Funds statement not auto-located'); continue; }
  console.log(`    Statement page ${totals.page}: Total revenues (printed, GF col) = ${fmtRaw(totals.revenues)}; Total expenditures = ${fmtRaw(totals.expenditures)}`);

  const acfrRev = totals.revenues !== null ? totals.revenues * t.units : null;
  const acfrExp = totals.expenditures !== null ? totals.expenditures * t.units : null;

  const datasetPairs = [{ dataset: 'revenue', acfrDollars: acfrRev }];
  if (!t.revOnly) datasetPairs.push({ dataset: 'operating', acfrDollars: acfrExp });

  for (const { dataset, acfrDollars } of datasetPairs) {
    let stored = null;
    try {
      const rows = await dbGet(`/rest/v1/budgets?municipality_id=eq.${midMap[t.stateName]}&fiscal_year=eq.${t.fy}&dataset_type=eq.${dataset}&select=total_budget`);
      if (Array.isArray(rows) && rows.length === 1) stored = rows[0].total_budget;
      else if (Array.isArray(rows) && rows.length > 1) throw new Error(`DUP: ${rows.length} rows`);
    } catch (e) {
      checks.push({ label: `${t.state} FY${t.fy}`, dataset, acfrDollars, stored: null, delta: null, pass: false, verdictStr: `FAIL (DB error: ${e.message})`, notes: t.notes });
      continue;
    }

    let delta = null, pass = false, verdictStr;
    if (acfrDollars === null) verdictStr = 'FAIL (printed total not found)';
    else if (stored === null) verdictStr = `FAIL (no DB row for ${t.state} FY${t.fy} ${dataset})`;
    else {
      delta = acfrDollars - stored;
      pass = Math.abs(delta) === 0;
      verdictStr = pass ? 'PASS (exact delta=0)' : `FAIL (delta=${fmt(delta)} -- explain-or-fix required)`;
    }
    console.log(`      ${dataset}: DB=${fmtRaw(stored)}  ${verdictStr}`);
    checks.push({ label: `${t.state} FY${t.fy}`, dataset, acfrDollars, stored, delta, pass, verdictStr, notes: t.notes });
  }
}

// Step 3: comparison table + verdict.
console.log('');
console.log('-- Step 3: Comparison Table -------------------------------------------------');
const header = [padR('State / FY', 14), padR('Dataset', 10), padL('ACFR Printed ($)', 20), padL('DB Stored ($)', 20), padL('Delta ($)', 14), 'Verdict'].join('  ');
console.log(header);
console.log('-'.repeat(header.length + 10));
let failures = 0;
for (const c of checks) {
  console.log([padR(c.label, 14), padR(c.dataset, 10), padL(c.acfrDollars !== null ? fmtRaw(c.acfrDollars) : 'N/A', 20), padL(c.stored !== null ? fmtRaw(c.stored) : 'N/A', 20), padL(c.delta !== null ? fmtRaw(c.delta) : 'N/A', 14), c.verdictStr].join('  '));
  if (!c.pass) failures++;
}
console.log('-'.repeat(header.length + 10));
console.log('');
console.log(`  ${checks.length - failures} / ${checks.length} checks PASS (exact delta=0 required)`);

console.log('');
console.log('-- Sample Documentation (reproducibility) -----------------------------------');
console.log('  Random middles: MA FY2016 (mid contiguous FY2015-2020 run), NC FY2019 (yr 8/14), TN FY2017 (yr 9/17).');
console.log('  Clamp years sampled: MD FY2022 (bookend, -275,992K), CT FY2013 (-2,100K), WI FY2013 (-838K), WA FY2022 (-216,940K).');
console.log('  Bar for clamp years = printed GF root total (nets the negative), matching stored total_budget.');

console.log('');
if (failures === 0) {
  console.log(`PASS -- All ${checks.length} Phase 110 re-derivation checks tie at exact delta=0`);
  process.exit(0);
} else {
  console.log(`FAIL -- ${failures} of ${checks.length} checks have non-zero delta or errors (explain-or-fix per 110-01 Task 2)`);
  process.exit(2);
}
