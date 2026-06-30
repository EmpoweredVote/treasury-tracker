#!/usr/bin/env node
/**
 * verify-phase106-rederive.mjs
 *
 * Loader-independent ACFR re-derivation harness for Phase 106 / VER-03.
 *
 * Purpose: Independently re-derive — from each state's own ACFR PDF, WITHOUT
 * importing any scripts/process*.js loader — the General-Fund printed totals for
 * the v2.12 risk-weighted sample, then diff against treasury.budgets live values.
 *
 * Scope — v2.12 surface (deepened CA/NY/FL via Phase 104; new PA + IL via Phase 105):
 *
 *   CA  — FY2008 (deepened bookend, oldest), FY2013 (random middle), FY2019 (newest deepened)
 *   NY  — FY2003 (deepened bookend, oldest; x millions), FY2009 (random middle), FY2014 (newest deepened)
 *   FL  — FY2021 (only deepened FY; negative-clamp year)
 *   PA  — FY2016 (oldest bookend), FY2025 (newest bookend)
 *   IL  — FY2021 (oldest bookend), FY2022 (negative-clamp year), FY2025 (newest bookend)
 *
 * Random-middle-year documentation (D-01 Claude's-discretion clause):
 *   CA FY2013: Chosen as the arithmetic middle of the 12-year deepened window (FY2008-FY2019).
 *              FY2013 falls at year 6/12 -- a clean mid-window selection.
 *   NY FY2009: Chosen as an early-middle year (year 7 of the 12-year FY2003-FY2014 window),
 *              also notable as the first recession-year revenue dip (exercises the loader's
 *              non-trivial revenue path where Total revenues = 40,228M vs FY2008 45,423M).
 *
 * Negative-clamp year notes:
 *   FL FY2021: "Investment earnings (losses)" = -398,287K. P2 clamp renders this 0 in
 *              the icicle, but the PRINTED root total (Total revenues = 46,989,188K) already
 *              nets the negative. The bar is the printed total matching DB total_budget.
 *   IL FY2022: "Interest and other investment income" = -197,857K. Same: root total
 *              (73,204,339K) nets the clamped-negative. DB total_budget should match.
 *
 * URL patterns sourced from 103-DEEPEN-SOURCES.md and 103-PA-IL-SOURCES.md INDEPENDENTLY.
 * These are NOT read from any process*.js loader -- D-02 blind re-extraction.
 *
 *   NY FY2003-FY2014: https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-{YYYY}.pdf
 *   CA FY2008-FY2019: https://www.sco.ca.gov/Files-ARD/CAFR/cafr{NN}web.pdf  (NN = 08..19)
 *     NOTE: CA FY2020+ uses /Files-ARD/ACFR/ (different path) -- NOT used here.
 *   FL FY2021:        https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-2021-state-of-florida-annual-comprehensive-financial-report.pdf
 *   PA FY2016-FY2023: https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport/june-30-{YYYY}-acfr.pdf
 *   PA FY2024-FY2025: same path but june-30-{YYYY}%20acfr.pdf (space, URL-encoded)
 *   IL per-year variant naming under https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR/:
 *     FY2021: ACFR Final 2021.pdf (no Bookmarked suffix)
 *     FY2022: ACFR Final FY 2022.pdf ("FY" prefix in filename -- unique!)
 *     FY2025: ACFR Final 2025 - Bookmarked.pdf
 *
 * Municipality IDs (from 105-PA-IL-LOADLOG.md; CA/NY/FL resolved at runtime by name):
 *   PA = d4a4aadc-f91e-45e4-852f-2cf21e177de5
 *   IL = ac8b3dee-b431-48d0-9f59-deea46c85948
 *
 * Units: NY x1,000,000 (millions); CA/FL/PA/IL x1,000 (thousands).
 *
 * D-03 TOLERANCE (CRITICAL -- stricter than Phase 102):
 *   Phase 102 allowed abs(delta) <= $10M as a rounding fallback.
 *   Phase 106 D-03 FORBIDS the band: PASS only on abs(delta) === 0 EXACTLY.
 *   A non-zero delta is FAIL and must be explained-or-fixed in Task 2 per D-05.
 *
 * T-106-01 CA SCO SOFT-404 GUARD: CA SCO returns HTTP 200 + HTML for missing files.
 *   Filter by Content-Type: application/pdf AND payload >= 1 MB (not by status code alone).
 *
 * No loader imports. No AI calls. $0 spend. pdftotext + DB read only.
 *
 * Exit 0 = all checks tie exactly (abs(delta) === 0)
 * Exit 2 = one or more checks FAIL (non-zero delta or parse/download error)
 *
 * Usage: node scripts/verify-phase106-rederive.mjs
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── Env loading ────────────────────────────────────────────────────────────────
// Search for .env.local / .env by walking up the directory tree from __dirname.
// This handles both: running from the main repo (../scripts/../.env) AND
// running from a git worktree where ../ is the worktree root, not the main repo.
function loadEnv() {
  const { existsSync: exists } = fs;
  // Candidates: immediate parent, then walk up to 5 levels
  const searchDirs = [];
  let dir = resolve(__dirname, '..');
  for (let i = 0; i < 6; i++) {
    searchDirs.push(dir);
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  let loaded = 0;
  for (const searchDir of searchDirs) {
    for (const fname of ['.env.local', '.env']) {
      const fpath = resolve(searchDir, fname);
      if (!exists(fpath)) continue;
      try {
        const lines = readFileSync(fpath, 'utf8').split('\n');
        for (const line of lines) {
          const [k, ...v] = line.split('=');
          if (k && v.length && !process.env[k.trim()]) {
            process.env[k.trim()] = v.join('=').trim();
          }
        }
        loaded++;
      } catch {}
    }
    // Stop once we've loaded at least one env file that has the required vars
    if (loaded > 0 && process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
      break;
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── DB helper (native https, no supabase client) ───────────────────────────────
function dbGet(path) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${SUPABASE_URL}${path}`);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Accept-Profile': 'treasury',
      'Accept': 'application/json',
    };

    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers,
      agent: false,
    }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── PDF download helper ────────────────────────────────────────────────────────
// Downloads a PDF from url to destPath.
// T-106-01 CA SCO SOFT-404 GUARD: Verifies Content-Type is application/pdf
// AND/OR payload >= 1 MB. CA SCO returns HTTP 200 + HTML for missing files
// -- a soft-404 must FAIL the check, never silently tie to 0.
function downloadPdf(url, destPath, opts) {
  const maxRedirects = (opts && opts.maxRedirects !== undefined) ? opts.maxRedirects : 5;
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;

    const req = requester({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TreasuryTracker-Verify/1.0)',
      },
      agent: false,
    }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers['location'];
        if (!loc) return reject(new Error(`Redirect with no Location from ${url}`));
        if (maxRedirects <= 0) return reject(new Error(`Too many redirects from ${url}`));
        res.resume();
        return downloadPdf(loc, destPath, { maxRedirects: maxRedirects - 1 }).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }

      const contentType = res.headers['content-type'] || '';
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        // T-106-01: Must be PDF content-type OR >= 1 MB (CA SCO soft-404 guard)
        const isPdfContentType = contentType.includes('application/pdf');
        const isLargeEnough = buf.length >= 1_000_000;
        if (!isPdfContentType && !isLargeEnough) {
          return reject(new Error(
            `T-106-01 SOFT-404 detected for ${url}: Content-Type="${contentType}", ` +
            `size=${buf.length} bytes. Not a valid PDF (expected application/pdf or >=1MB).`
          ));
        }
        fs.writeFileSync(destPath, buf);
        resolve(destPath);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── pdftotext extraction helper ────────────────────────────────────────────────
// Runs pdftotext -table -f {pageStart} -l {pageEnd} on pdfPath, returns text.
// GF column is always the FIRST numeric column per state's Governmental Funds
// Statement of Revenues, Expenditures and Changes in Fund Balances.
// NOT -layout (which misaligns columns per project standards).
function extractPages(pdfPath, pageStart, pageEnd) {
  try {
    const result = execFileSync('pdftotext', [
      '-table',
      '-f', String(pageStart),
      '-l', String(pageEnd),
      pdfPath,
      '-',
    ], { maxBuffer: 10 * 1024 * 1024 });
    return result.toString('utf8');
  } catch (e) {
    throw new Error(`pdftotext failed on ${pdfPath} pp.${pageStart}-${pageEnd}: ${e.message}`);
  }
}

// ── Number parsing from pdftotext -table output ────────────────────────────────
// Given a line of text, extract the first number token (GF column value).
// Strips commas; handles negative values in parens (e.g. "(398,287)").
function parseFirstNumber(text) {
  const tokens = text.trim().split(/\s{2,}/);
  // Skip the first token (label); look for first number-like token
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i].trim().replace(/,/g, '');
    const paren = t.match(/^\((\d+)\)$/);
    if (paren) return -parseInt(paren[1], 10);
    const plain = t.match(/^-?\d+$/);
    if (plain) return parseInt(t, 10);
  }
  return null;
}

function extractFirstNumberFromLine(line) {
  const bySplit = parseFirstNumber(line);
  if (bySplit !== null) return bySplit;
  // Fallback: regex scan for first numeric token
  const numRe = /\([\d,]+\)|[\d]{1,3}(?:,[\d]{3})+|[\d]+/g;
  const m = line.match(numRe);
  if (!m) return null;
  const raw = m[0].replace(/,/g, '');
  if (raw.startsWith('(') && raw.endsWith(')')) {
    return -parseInt(raw.slice(1, -1), 10);
  }
  return parseInt(raw, 10);
}

// ── GF statement parser ────────────────────────────────────────────────────────
// Finds "Total revenues" and "Total expenditures" in pdftotext -table output.
// Returns { revenues: number|null, expenditures: number|null }
// The first number on each matching line is the GF column value (D-02 blind re-key).
function parseGFTotals(text) {
  const lines = text.split('\n');
  let revenues = null;
  let expenditures = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // "Total revenues" line (plain -- must end with non-letter to avoid
    // matching "Total revenues and other sources" as the revenue line if plain comes first)
    if (revenues === null && lower.match(/^\s*total revenues[^a-z]/)) {
      revenues = extractFirstNumberFromLine(line);
    }
    // NY variant: "Total revenues and other financing sources"
    if (revenues === null && lower.match(/^\s*total revenues and other/)) {
      revenues = extractFirstNumberFromLine(line);
    }

    // "Total expenditures" line
    if (expenditures === null && lower.match(/^\s*total expenditures[^a-z]/)) {
      expenditures = extractFirstNumberFromLine(line);
    }
    // NY variant: "Total expenditures and other financing uses"
    if (expenditures === null && lower.match(/^\s*total expenditures and other/)) {
      expenditures = extractFirstNumberFromLine(line);
    }
  }

  return { revenues, expenditures };
}

// ── D-03 Tolerance (EXACT 0 only -- no $10M band) ─────────────────────────────
function verdict(delta) {
  if (Math.abs(delta) === 0) return 'PASS (exact delta=0)';
  return `FAIL (delta=${fmt(delta)} -- D-03 explain-or-fix required)`;
}

function fmt(n) {
  if (n === null || n === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtRaw(n) {
  if (n === null || n === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

// ── Target configuration -- v2.12 risk-weighted sample ────────────────────────
// ~18 FY-dataset ties across CA/NY/FL deepened (Phase 104) + PA/IL new (Phase 105).
//
// Municipality IDs for state entities with hardcoded IDs (from 105-PA-IL-LOADLOG.md):
const PA_MID = 'd4a4aadc-f91e-45e4-852f-2cf21e177de5';
const IL_MID = 'ac8b3dee-b431-48d0-9f59-deea46c85948';

// URL bases (from 103-DEEPEN-SOURCES.md + 103-PA-IL-SOURCES.md -- NOT from any loader)
const PA_BASE = 'https://www.pa.gov/content/dam/copapwp-pagov/en/budget/documents/publications-and-reports/annualfinancialreport';
const IL_BASE = 'https://illinoiscomptroller.gov/__media/sites/comptroller/assets/File/CAFR';

const TARGETS = [
  // ── California FY2008 -- deepened bookend (oldest deepened year) ──────────────
  // 104-DEEPEN-GAPLOG confirmed: rev=97,774,378K / exp=98,975,042K
  // CA SCO uses /Files-ARD/CAFR/ for FY2008-FY2019 (NOT /ACFR/ which is FY2020+)
  // Page range confirmed empirically: pp.50-55 contains GF statement in this CAFR edition.
  {
    state: 'CA', label: 'California FY2008',
    stateNameLookup: 'California',
    fiscalYear: 2008,
    url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr08web.pdf',
    pdfPageStart: 48, pdfPageEnd: 56,
    gfColLabel: 'General (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/ca', cacheFile: 'cafr08web.pdf',
    notes: 'Deepened bookend (oldest CA FY2008). URL: /Files-ARD/CAFR/ path (not /ACFR/).',
    caScO: true,
  },
  // ── California FY2013 -- random middle year ───────────────────────────────────
  // D-01 random-middle choice: arithmetic middle of FY2008-FY2019 window (year 6/12).
  // 104-DEEPEN-GAPLOG: rev=99,379,153K / exp=90,114,980K
  // Page range confirmed empirically: pp.55-60 contains GF statement.
  {
    state: 'CA', label: 'California FY2013',
    stateNameLookup: 'California',
    fiscalYear: 2013,
    url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr13web.pdf',
    pdfPageStart: 53, pdfPageEnd: 62,
    gfColLabel: 'General (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/ca', cacheFile: 'cafr13web.pdf',
    notes: 'Random middle (D-01): year 6/12 of FY2008-FY2019 window.',
    caScO: true,
  },
  // ── California FY2019 -- deepened bookend (newest deepened year) ──────────────
  // 104-DEEPEN-GAPLOG: rev=140,503,627K / exp=129,113,153K
  // Page range confirmed empirically: pp.60-65 contains GF statement.
  // The Phase 104 loader uses cafr19web.pdf (from /Files-ARD/CAFR/).
  {
    state: 'CA', label: 'California FY2019',
    stateNameLookup: 'California',
    fiscalYear: 2019,
    url: 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr19web.pdf',
    pdfPageStart: 58, pdfPageEnd: 67,
    gfColLabel: 'General (1st col, thousands)',
    units: 1_000,
    // Use main-repo cache (symlinked) -- file already downloaded as cafr19web.pdf
    cacheDir: '_acfr-tmp/ca', cacheFile: 'cafr19web.pdf',
    notes: 'Deepened bookend (newest deepened CA). CAFR path boundary.',
    caScO: true,
  },
  // ── New York FY2003 -- deepened bookend (oldest deepened year, millions) ───────
  // 103-DEEPEN-SOURCES + 104-DEEPEN-GAPLOG: rev=29,250M / exp=40,910M
  // Units = millions (x1,000,000). Page range confirmed: pp.35-40.
  // NY PDFs in main-repo _acfr-tmp/ny/ (symlinked).
  {
    state: 'NY', label: 'New York FY2003',
    stateNameLookup: 'New York',
    fiscalYear: 2003,
    url: 'https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-2003.pdf',
    pdfPageStart: 33, pdfPageEnd: 42,
    gfColLabel: 'General (1st col, MILLIONS)',
    units: 1_000_000,
    cacheDir: '_acfr-tmp/ny', cacheFile: 'ny-acfr-2003.pdf',
    notes: 'Deepened bookend (oldest NY FY2003). Units = millions (x1,000,000).',
    caScO: false,
  },
  // ── New York FY2009 -- random middle year (millions) ──────────────────────────
  // D-01 random-middle: year 7/12 of FY2003-FY2014 window; exercises recession revenue dip.
  // 104-DEEPEN-GAPLOG: rev=40,228M / exp=56,630M. Page range: pp.35-40.
  {
    state: 'NY', label: 'New York FY2009',
    stateNameLookup: 'New York',
    fiscalYear: 2009,
    url: 'https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-2009.pdf',
    pdfPageStart: 33, pdfPageEnd: 42,
    gfColLabel: 'General (1st col, MILLIONS)',
    units: 1_000_000,
    cacheDir: '_acfr-tmp/ny', cacheFile: 'ny-acfr-2009.pdf',
    notes: 'Random middle (D-01): year 7/12 of FY2003-FY2014; recession revenue dip from FY2008.',
    caScO: false,
  },
  // ── New York FY2014 -- deepened bookend (newest deepened year, millions) ───────
  // 104-DEEPEN-GAPLOG: rev=48,459M / exp=59,782M. Page range: pp.35-40.
  {
    state: 'NY', label: 'New York FY2014',
    stateNameLookup: 'New York',
    fiscalYear: 2014,
    url: 'https://www.osc.ny.gov/files/reports/finance/pdf/comprehensive-annual-financial-report-2014.pdf',
    pdfPageStart: 33, pdfPageEnd: 42,
    gfColLabel: 'General (1st col, MILLIONS)',
    units: 1_000_000,
    cacheDir: '_acfr-tmp/ny', cacheFile: 'ny-acfr-2014.pdf',
    notes: 'Deepened bookend (newest deepened NY FY2014 boundary).',
    caScO: false,
  },
  // ── Florida FY2021 -- only deepened FY; negative-clamp year ──────────────────
  // 104-DEEPEN-GAPLOG: rev=46,989,188K / exp=37,277,963K
  // "Investment earnings (losses)" = -398,287K. Root total nets the negative already.
  // Page range confirmed empirically: pp.35-40.
  {
    state: 'FL', label: 'Florida FY2021',
    stateNameLookup: 'Florida',
    fiscalYear: 2021,
    url: 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/fye-2021-state-of-florida-annual-comprehensive-financial-report.pdf',
    pdfPageStart: 33, pdfPageEnd: 42,
    gfColLabel: 'General Fund (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/fl', cacheFile: 'fl-acfr-2021.pdf',
    notes: 'Only deepened FL FY. NEGATIVE-CLAMP: Investment earnings (losses) = -398,287K. Root total $46,989,188K nets the negative.',
    caScO: false,
  },
  // ── Pennsylvania FY2016 -- oldest bookend ─────────────────────────────────────
  // 105-PA-IL-LOADLOG: rev=56,741,506K / exp=56,135,869K
  // URL: hyphen pattern (FY2016-FY2023)
  // Page range: FY2024 is at pp.55-60; FY2016 should be similar.
  {
    state: 'PA', label: 'Pennsylvania FY2016',
    stateNameLookup: null,
    municipalityId: PA_MID,
    fiscalYear: 2016,
    url: `${PA_BASE}/june-30-2016-acfr.pdf`,
    pdfPageStart: 48, pdfPageEnd: 62,
    gfColLabel: 'General Fund (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/pa', cacheFile: 'pa-2016.pdf',
    notes: 'PA oldest bookend. Hyphen URL pattern (FY2016-FY2023).',
    caScO: false,
  },
  // ── Pennsylvania FY2025 -- newest bookend ─────────────────────────────────────
  // 105-PA-IL-LOADLOG: rev=92,414,817K / exp=94,758,255K
  // URL: %20 (space) pattern (FY2024-FY2025)
  // Page range confirmed: pp.55-60 for FY2024; FY2025 similar.
  {
    state: 'PA', label: 'Pennsylvania FY2025',
    stateNameLookup: null,
    municipalityId: PA_MID,
    fiscalYear: 2025,
    url: `${PA_BASE}/june-30-2025%20acfr.pdf`,
    pdfPageStart: 48, pdfPageEnd: 62,
    gfColLabel: 'General Fund (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/pa', cacheFile: 'pa-2025.pdf',
    notes: 'PA newest bookend. Space URL pattern: june-30-2025%20acfr.pdf (FY2024-FY2025 special-case).',
    caScO: false,
  },
  // ── Illinois FY2021 -- oldest bookend ─────────────────────────────────────────
  // 105-PA-IL-LOADLOG: rev=63,136,008K / exp=59,523,406K
  // URL: ACFR Final 2021.pdf (no Bookmarked suffix). Page range confirmed: pp.40-48.
  // File already cached in _acfr-work/il/ (symlinked as _acfr-tmp/il/)
  {
    state: 'IL', label: 'Illinois FY2021',
    stateNameLookup: null,
    municipalityId: IL_MID,
    fiscalYear: 2021,
    url: `${IL_BASE}/ACFR%20Final%202021.pdf`,
    pdfPageStart: 38, pdfPageEnd: 50,
    gfColLabel: 'General Fund (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/il', cacheFile: 'il-2021.pdf',
    notes: 'IL oldest bookend. Filename: "ACFR Final 2021.pdf" (no Bookmarked suffix).',
    caScO: false,
  },
  // ── Illinois FY2022 -- negative-clamp year ────────────────────────────────────
  // 105-PA-IL-LOADLOG: rev=73,204,339K (clamp year) / exp=62,089,769K
  // "Interest and other investment income" = -197,857K. Root total nets negative.
  // URL: ACFR Final FY 2022.pdf ("FY" prefix). Page range confirmed: pp.40-48.
  {
    state: 'IL', label: 'Illinois FY2022',
    stateNameLookup: null,
    municipalityId: IL_MID,
    fiscalYear: 2022,
    url: `${IL_BASE}/ACFR%20Final%20FY%202022.pdf`,
    pdfPageStart: 38, pdfPageEnd: 50,
    gfColLabel: 'General Fund (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/il', cacheFile: 'il-2022.pdf',
    notes: 'IL NEGATIVE-CLAMP: "Interest and other investment income" = -197,857K. Root total $73,204,339K nets negative. Filename: "ACFR Final FY 2022.pdf".',
    caScO: false,
  },
  // ── Illinois FY2025 -- newest bookend ─────────────────────────────────────────
  // 105-PA-IL-LOADLOG: rev=78,342,927K / exp=75,456,922K
  // URL: ACFR Final 2025 - Bookmarked.pdf. Page range confirmed: pp.40-48.
  {
    state: 'IL', label: 'Illinois FY2025',
    stateNameLookup: null,
    municipalityId: IL_MID,
    fiscalYear: 2025,
    url: `${IL_BASE}/ACFR%20Final%202025%20-%20Bookmarked.pdf`,
    pdfPageStart: 38, pdfPageEnd: 50,
    gfColLabel: 'General Fund (1st col, thousands)',
    units: 1_000,
    cacheDir: '_acfr-tmp/il', cacheFile: 'il-2025.pdf',
    notes: 'IL newest bookend. Filename: "ACFR Final 2025 - Bookmarked.pdf".',
    caScO: false,
  },
];

// ── Formatting helpers ─────────────────────────────────────────────────────────
function padR(s, n) { return String(s ?? 'N/A').padEnd(n); }
function padL(s, n) { return String(s ?? 'N/A').padStart(n); }

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('');
console.log('Phase 106 -- Loader-Independent ACFR Re-Derivation Harness');
console.log('VER-03 (a): v2.12 risk-weighted sample -- CA/NY/FL deepened + PA/IL new states');
console.log('D-03 tolerance: PASS = abs(delta) === 0 EXACTLY (no $10M band)');
console.log('D-02 method: blind re-extract from source PDF, imports ZERO process*.js loaders');
console.log(`Sample: ${TARGETS.length} FY targets x 2 datasets = ${TARGETS.length * 2} checks`);
console.log('');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  const missing = [
    !SUPABASE_URL && 'SUPABASE_URL',
    !SUPABASE_KEY && 'SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
  ].filter(Boolean).join(', ');
  console.error(`ERROR: Missing env vars: ${missing}`);
  console.error('       Load .env.local or .env before running this script.');
  process.exit(1);
}

// ── Step 1: Resolve municipality IDs by state name ────────────────────────────
console.log('-- Step 1: Resolve state municipality IDs ─────────────────────────────────');
const stateNameMap = {};
const uniqueStateLookups = [...new Set(TARGETS.filter(t => t.stateNameLookup).map(t => t.stateNameLookup))];

for (const stateName of uniqueStateLookups) {
  try {
    const rows = await dbGet(
      `/rest/v1/municipalities?entity_type=eq.state&name=eq.${encodeURIComponent(stateName)}&select=id,name`
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`No state entity row for "${stateName}"`);
    }
    stateNameMap[stateName] = rows[0].id;
    console.log(`  ${stateName}: municipality_id = ${rows[0].id}`);
  } catch (e) {
    console.error(`  ERROR resolving ${stateName}: ${e.message}`);
    process.exit(1);
  }
}

// Inject resolved municipality IDs into targets
for (const t of TARGETS) {
  if (t.stateNameLookup && !t.municipalityId) {
    t.municipalityId = stateNameMap[t.stateNameLookup];
  }
}
console.log(`  Pennsylvania: municipality_id = ${PA_MID} (from 105-PA-IL-LOADLOG.md)`);
console.log(`  Illinois:     municipality_id = ${IL_MID} (from 105-PA-IL-LOADLOG.md)`);

// ── Step 2: Download PDFs + extract GF totals (blind re-derivation) ───────────
console.log('');
console.log('-- Step 2: Download PDFs + blind re-extract GF printed totals ─────────────');

const checks = [];

for (const target of TARGETS) {
  console.log('');
  console.log(`  ── ${target.label} ──`);
  if (target.notes) console.log(`     Note: ${target.notes}`);

  // Ensure cache dir
  const cacheDir = resolve(PROJECT_ROOT, target.cacheDir);
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  const pdfPath = resolve(cacheDir, target.cacheFile);

  // Download PDF if not cached
  if (existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`    Cached: ${target.cacheFile} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`    Downloading: ${target.url}`);
    try {
      await downloadPdf(target.url, pdfPath);
      const stats = fs.statSync(pdfPath);
      console.log(`    Downloaded: ${target.cacheFile} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    } catch (e) {
      console.error(`    ERROR downloading PDF: ${e.message}`);
      for (const dataset of ['revenue', 'operating']) {
        checks.push({
          label: target.label, dataset,
          acfrPrinted: null, acfrDollars: null, stored: null, delta: null,
          pass: false,
          verdictStr: `FAIL (PDF download error: ${e.message})`,
          notes: target.notes || '',
        });
      }
      continue;
    }
  }

  // pdftotext -table extraction (D-02 blind re-key -- NOT reading any loader map)
  let rawText;
  try {
    rawText = extractPages(pdfPath, target.pdfPageStart, target.pdfPageEnd);
    console.log(`    pdftotext -table pp.${target.pdfPageStart}-${target.pdfPageEnd}: ${rawText.length} chars`);
  } catch (e) {
    console.error(`    ERROR extracting PDF: ${e.message}`);
    for (const dataset of ['revenue', 'operating']) {
      checks.push({
        label: target.label, dataset,
        acfrPrinted: null, acfrDollars: null, stored: null, delta: null,
        pass: false,
        verdictStr: `FAIL (pdftotext error: ${e.message})`,
        notes: target.notes || '',
      });
    }
    continue;
  }

  // Parse GF printed totals from extracted text
  const { revenues: rawRevenues, expenditures: rawExpenditures } = parseGFTotals(rawText);
  console.log(`    GF column (${target.gfColLabel}):`);
  console.log(`      Total revenues (printed):     ${rawRevenues !== null ? fmtRaw(rawRevenues) : 'NOT FOUND'}`);
  console.log(`      Total expenditures (printed): ${rawExpenditures !== null ? fmtRaw(rawExpenditures) : 'NOT FOUND'}`);

  // Apply units multiplier
  const acfrRevenues     = rawRevenues     !== null ? rawRevenues     * target.units : null;
  const acfrExpenditures = rawExpenditures !== null ? rawExpenditures * target.units : null;

  if (acfrRevenues !== null)     console.log(`      → revenues in dollars:     ${fmt(acfrRevenues)}`);
  if (acfrExpenditures !== null) console.log(`      → expenditures in dollars: ${fmt(acfrExpenditures)}`);

  // Query treasury.budgets for each dataset type
  for (const { dataset, acfrDollars } of [
    { dataset: 'revenue',   acfrDollars: acfrRevenues },
    { dataset: 'operating', acfrDollars: acfrExpenditures },
  ]) {
    let stored = null;
    let notesStr = target.notes || '';

    try {
      const qpath = `/rest/v1/budgets?municipality_id=eq.${target.municipalityId}&fiscal_year=eq.${target.fiscalYear}&dataset_type=eq.${dataset}&select=total_budget`;
      const rows = await dbGet(qpath);
      if (!Array.isArray(rows) || rows.length === 0) {
        notesStr += ` | No DB row for ${target.state} FY${target.fiscalYear} ${dataset}`;
        console.log(`      ${dataset}: no DB row found`);
      } else {
        stored = rows[0].total_budget;
        console.log(`      ${dataset}: DB = ${fmt(stored)}`);
      }
    } catch (e) {
      notesStr += ` | DB error: ${e.message}`;
      console.error(`      ${dataset}: DB error: ${e.message}`);
    }

    let delta = null;
    let pass = false;
    let verdictStr = '';

    if (acfrDollars === null) {
      verdictStr = `FAIL (pdftotext: Total ${dataset === 'revenue' ? 'revenues' : 'expenditures'} not found in extracted pages)`;
      pass = false;
    } else if (stored === null) {
      verdictStr = `FAIL (no DB row for ${target.state} FY${target.fiscalYear} ${dataset})`;
      pass = false;
    } else {
      delta = acfrDollars - stored;
      verdictStr = verdict(delta);
      pass = Math.abs(delta) === 0;
    }

    console.log(`      ${dataset}: ${verdictStr}`);

    checks.push({
      label: target.label,
      dataset,
      acfrPrinted: dataset === 'revenue' ? rawRevenues : rawExpenditures,
      acfrDollars,
      stored,
      delta,
      pass,
      verdictStr,
      notes: notesStr,
    });
  }
}

// ── Step 3: Comparison table ──────────────────────────────────────────────────
console.log('');
console.log('-- Step 3: Comparison Table ────────────────────────────────────────────────');
console.log('');

const COL_LABEL   = 28;
const COL_DS      = 10;
const COL_PRINTED = 22;
const COL_STORED  = 22;
const COL_DELTA   = 16;

const header = [
  padR('State / FY', COL_LABEL),
  padR('Dataset', COL_DS),
  padL('ACFR Printed ($)', COL_PRINTED),
  padL('DB Stored ($)', COL_STORED),
  padL('Delta ($)', COL_DELTA),
  'Verdict',
].join('  ');

const separator = '-'.repeat(header.length + 10);
console.log(header);
console.log(separator);

let failures = 0;
for (const c of checks) {
  const row = [
    padR(c.label, COL_LABEL),
    padR(c.dataset, COL_DS),
    padL(c.acfrDollars !== null ? fmtRaw(c.acfrDollars) : 'N/A', COL_PRINTED),
    padL(c.stored !== null ? fmtRaw(c.stored) : 'N/A', COL_STORED),
    padL(c.delta !== null ? fmtRaw(c.delta) : 'N/A', COL_DELTA),
    c.verdictStr,
  ].join('  ');
  console.log(row);
  if (!c.pass) failures++;
}

console.log(separator);
console.log('');

const total = checks.length;
const passed = checks.filter(c => c.pass).length;
console.log(`  ${passed} / ${total} checks PASS (D-03: exact delta=0 required)`);
if (failures > 0) {
  console.log(`  ${failures} / ${total} checks FAIL`);
}

// ── Step 4: Failure detail ────────────────────────────────────────────────────
if (failures > 0) {
  console.log('');
  console.log('-- Failures (D-03 explain-or-fix required per 106-01 Task 2) ───────────────');
  for (const c of checks) {
    if (!c.pass) {
      console.log(`  FAIL: ${c.label} / ${c.dataset}`);
      console.log(`        ACFR printed: ${c.acfrDollars !== null ? fmt(c.acfrDollars) : 'N/A'}`);
      console.log(`        DB stored:    ${c.stored !== null ? fmt(c.stored) : 'N/A'}`);
      console.log(`        Delta:        ${c.delta !== null ? fmt(c.delta) : 'N/A'}`);
      console.log(`        Verdict:      ${c.verdictStr}`);
      if (c.notes) console.log(`        Notes:        ${c.notes}`);
    }
  }
}

// ── Sample reproducibility (D-01) ────────────────────────────────────────────
console.log('');
console.log('-- Sample Documentation (D-01 reproducibility) ─────────────────────────────');
console.log('  Random-middle-year choices (D-01 Claude discretion clause):');
console.log('    CA FY2013: arithmetic middle (year 6/12) of FY2008-FY2019 deepened window.');
console.log('    NY FY2009: year 7/12 of FY2003-FY2014 window; exercises recession revenue dip.');
console.log('  Negative-clamp years in v2.12 surface:');
console.log('    FL FY2021: Investment earnings (losses) = -398,287K. Root total $46,989,188K nets negative.');
console.log('    IL FY2022: Interest and other investment income = -197,857K. Root total $73,204,339K nets.');
console.log('  Note: No NY/CA negative-clamp years in FY2003-FY2014/FY2008-FY2019 windows');
console.log('        (per 104-DEEPEN-GAPLOG: all GF categories positive in those ranges).');

// ── Final verdict ─────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log(`PASS -- All ${total} Phase 106 re-derivation checks tie at exact delta=0`);
  console.log('VER-03 re-derivation half satisfied (loader-independent, blind source re-extraction)');
  process.exit(0);
} else {
  console.log(`FAIL -- ${failures} of ${total} checks have non-zero delta`);
  console.log('D-03: Each failure must be explained-or-fixed before sign-off (see Task 2)');
  process.exit(2);
}
