#!/usr/bin/env node
/**
 * verify-phase116-rederive.mjs
 *
 * Loader-independent ACFR re-derivation harness for Phase 116 / VER-07 (a).
 *
 * Purpose: Independently re-derive — from each state's own ACFR/CAFR PDF, WITHOUT
 * importing any scripts/process*.js loader OR any shared parser module
 * (maAcfrExtract.mjs, pre34Extract.mjs, njAcfrExtract.mjs) — the General-Fund
 * printed totals for the v2.14 tranche-3 + deepening sample, then diff against
 * treasury.budgets live values.
 *
 * INDEPENDENCE RULE (blind method): this harness re-keys the GENERAL-FUND column
 * "Total revenues" / "Total expenditures" printed lines (modern GASB-34 statements)
 * or "Total Revenues" / "Total Expenditures" lines of the pre-GASB-34 "Combined
 * Statement of Revenues, Expenditures, and Changes in Fund Balances — All
 * Governmental Fund Types" (CT/WI/MA pre-34 years) with its OWN minimal
 * extraction (auto-locates the statement page, takes the first numeric token on
 * each total line = the GF 1st-column value). It does NOT import
 * extractGovFundGeneralColumn / extractMAGeneralFund / extractPre34GeneralFund —
 * those parsers ARE the loaders' extraction paths; reusing them would re-test the
 * loader against itself. CT FY2006 (scanned, no text layer) is independently
 * re-OCR'd from the source PDF at the loadlog-documented page (40), NOT read from
 * the loader's embedded CT2006_REVENUES/CT2006_EXPENDITURES static arrays.
 *
 * Sample (VER-07a; risk-weighted; each entry checks BOTH revenue and operating
 * unless marked revOnly; middle-year choices documented inline for
 * reproducibility):
 *
 *   Tranche-3 (Phase 113 Batch 1 / Phase 114 Batch 2):
 *     IN  FY2002 + FY2013 (middle, yr 12/24) + FY2025
 *     AZ  FY2002 + FY2024 (Drive-link caveat year — re-derived from the same
 *         Drive PDF the loadlog records)
 *     OR  FY2022 + FY2025                      (full recon-locked window)
 *     MO  FY2012 + FY2025 + ALL 6 clamp years (FY2013/2017/2018/2021/2022/2023,
 *         revOnly — the negative "Fair Value of Investments" line lives in the
 *         revenue section; printed-root bar nets it)
 *     CO  FY2023 + FY2025                      (both TABOR-clamped, printed-root bar)
 *     SC  FY2002 + FY2013 (middle, yr 12/24) + FY2025
 *     KY  FY2002 + FY2012 (middle, yr 11/24 — one year earlier than the IN/SC/
 *         AL/LA middle choice, deliberately clear of the FY2023 honest hole) +
 *         FY2025.  FY2023 is NOT sampled (documented broken-font hole, 114-02).
 *     UT  FY2019 + FY2025 + FY2022 (clamp, revOnly — Investment Income (Loss))
 *     AL  FY2002 + FY2013 (middle, yr 12/24) + FY2025  (Sep-30 FY-end;
 *         source_date {fy}-09-30 — does not affect the dollar tie)
 *     LA  FY2002 + FY2013 (middle, yr 12/24) + FY2025
 *
 *   Deepening (Phase 115):
 *     NJ  FY2002 (new archive-edge floor) + FY2010 (middle of the newly-recovered
 *         FY2002-2019 run)                     [UNITS=1 — full dollars]
 *     CT  FY1988 (archive floor, pre-34) + FY2001 (pre-34 boundary) + FY2006
 *         (OCR-recovered; GASB-34-era GAAP basis, NOT pre-34)
 *     WI  FY2000 (archive floor, pre-34) + FY2001 (pre-34)
 *     MA  FY2001 (pre-34, recovered) + FY2014 (recovered, GAAP basis)
 *
 * TOLERANCE (exact-0, carried from 106/110): PASS only on abs(delta) === 0. The
 * ONLY acceptable non-zero dispositions (handled in 116-REDERIVATION.md, not
 * here) are loadlog-documented printed-vs-line-sum rounding notes — WI FY2001
 * pre-34 expenditure -2K (115-02 loadlog) is the known candidate.
 *
 * Source bytes: uses the load-time verified cache _acfr-work/{st}/{ST}{YYYY}.pdf
 * (each verified %PDF magic + size at load time). If a cache file is missing,
 * re-fetches from the recorded canonical URL (per-state LOADLOG / loader SOURCES
 * URL string used only as a fetch address, never for extraction logic) with the
 * soft-404 guard (Content-Type application/pdf OR >= 500KB + %PDF magic).
 *
 * No loader imports. No AI calls. $0 spend. pdftotext (+ pdftoppm/tesseract for
 * the single CT FY2006 OCR check) + read-only DB access.
 * Exit 0 = all checks tie exactly (or the one documented WI rounding exception);
 * Exit 2 = one or more checks FAIL/unexplained.
 *
 * Usage: node scripts/verify-phase116-rederive.mjs
 */

import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Known-good absolute path for tesseract on this host (not on PATH; documented
// in the 115-02 loadlog as the exact invocation used for the CT FY2006 OCR
// recovery — reused here ONLY as a fetch-tool path, not as loader logic).
const TESSERACT_BIN = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';

// ── Env loading (walk up for .env.local/.env — same pattern as 110 harness) ────
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

// ── PDF fetch fallback (soft-404 guard; only used when the cache is missing) ───
function downloadPdf(url, destPath, opts) {
  const maxRedirects = opts?.maxRedirects ?? 5;
  return new Promise((resolvePromise, reject) => {
    const parsedUrl = new URL(url);
    const requester = parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest;
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
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
        // T-116-01 soft-404 guard: PDF content-type OR >= 500KB, plus %PDF magic.
        const okType = contentType.includes('application/pdf');
        const okSize = buf.length >= 500_000;
        const okMagic = buf.subarray(0, 5).toString('latin1') === '%PDF-';
        if (!okMagic || (!okType && !okSize)) {
          return reject(new Error(`T-116-01 SOFT-404 for ${url}: Content-Type="${contentType}", size=${buf.length}, magic=${okMagic}`));
        }
        writeFileSync(destPath, buf);
        resolvePromise(destPath);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Full-PDF pdftotext with page separators (our own call, every time) ─────────
function extractAllPages(pdfPath) {
  const result = execFileSync('pdftotext', ['-table', pdfPath, '-'], { maxBuffer: 200 * 1024 * 1024 });
  return result.toString('utf8').split('\f');
}

// ── Number parsing (our own — NOT any shared extractor) ────────────────────────
// First numeric token on a total line = the GF 1st-column printed value.
function extractFirstNumberFromLine(line) {
  const cleaned = line.replace(/\(Note\s+\d+\)/gi, ' ').replace(/\$/g, ' ');
  const numRe = /\([\d,]+\)|\d{1,3}(?:,\d{3})+|\d+/g;
  const m = cleaned.match(numRe);
  if (!m) return null;
  const raw = m[0].replace(/,/g, '');
  if (raw.startsWith('(')) return -parseInt(raw.slice(1, -1).replace(/,/g, ''), 10);
  return parseInt(raw, 10);
}

// Case-insensitive total-line matcher for MODERN (GASB-34) statements.
function parseModernGFTotals(text) {
  let revenues = null;
  let expenditures = null;
  for (const line of text.split('\n')) {
    // MA FY2014 documented single-character glyph substitution (115-03 loadlog:
    // "Total revenaes" for "Total revenues", u->a swap) -- normalize before match.
    const lower = line.toLowerCase().replace(/total revenaes/, 'total revenues');
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

// Auto-locate the modern Governmental Funds statement page.
// Title-anchor regex tolerant of missing inter-word spaces from PDF kerning
// defects (MA FY2014 prints "Statement ofRevenues,Expenditures" with no space
// after "of" and no space after the comma -- 115-03 loadlog documents multiple
// glyph/spacing corruptions specific to this PDF; \s* makes each space optional
// rather than assuming it's always present).
const MODERN_TITLE_RE = /statement\s*of\s*revenues\s*,?\s*expenditures/;
function findModernStatementTotals(pages) {
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!MODERN_TITLE_RE.test(p)) continue;
    if (!p.includes('changes in fund balance')) continue;
    if (p.includes('combining')) continue;
    if (p.includes('budget')) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      const totals = parseModernGFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) return { ...totals, page: i + 1 };
    }
  }
  // Relaxed second pass (older editions split the title across lines).
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!MODERN_TITLE_RE.test(p)) continue;
    if (p.includes('combining') || p.includes('budget')) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      const totals = parseModernGFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) return { ...totals, page: i + 1 };
    }
  }
  return { revenues: null, expenditures: null, page: null };
}

// ── Pre-GASB-34 "Combined Statement of Revenues, Expenditures, and Changes in
//    Fund Balances — All Governmental Fund Types" locator (CT/WI/MA pre-34). ───
// Anchors on both title phrases co-occurring on the SAME printed page (order-
// independent — MA prints the "All Governmental Fund Types" subtitle BEFORE the
// title, CT/WI print it after), excludes the "Budget and Actual" non-GAAP
// schedule and any combining statement. General Fund is the 1st numeric column
// on the "Total Revenues" / "Total Expenditures" row — identical extraction
// discipline to the modern statement (first numeric token after the label).
function parsePre34GFTotals(text) {
  let revenues = null;
  let expenditures = null;
  for (const line of text.split('\n')) {
    const lower = line.toLowerCase();
    if (revenues === null && /^\s*total revenues(\s|$|[^a-z])/.test(lower) && !/and other/.test(lower)) {
      revenues = extractFirstNumberFromLine(line);
    }
    if (expenditures === null && /^\s*total expenditures(\s|$|[^a-z])/.test(lower) && !/and other/.test(lower)) {
      expenditures = extractFirstNumberFromLine(line);
    }
  }
  return { revenues, expenditures };
}

function findPre34StatementTotals(pages) {
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ').replace(/,/g, '');
    const hasTitle = p.includes('combined statement of revenues expenditures');
    const hasAllGovFundTypes = p.includes('all governmental fund types');
    if (!hasTitle || !hasAllGovFundTypes) continue;
    if (p.includes('budget and actual')) continue; // non-GAAP budgetary schedule
    if (p.includes('combining')) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || ''), (pages[i - 1] || '') + '\n' + pages[i]]) {
      const totals = parsePre34GFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) return { ...totals, page: i + 1 };
    }
  }
  return { revenues: null, expenditures: null, page: null };
}

// ── CT FY2006 OCR path (scanned page, no text layer — independent re-OCR) ──────
// Location per 115-02 loadlog: statement lives at PDF page 40 of 164, bracketed
// via CT2005 (p.39/158) and CT2007 (p.41/165). We render page 40 fresh at
// 300dpi and OCR it ourselves — we do NOT read the loader's embedded
// CT2006_REVENUES/CT2006_EXPENDITURES static arrays.
function ocrCT2006(pdfPath) {
  const tmpDir = resolve(PROJECT_ROOT, '_acfr-work', 'ct', '116-ocr-tmp');
  mkdirSync(tmpDir, { recursive: true });
  const prefix = join(tmpDir, 'ct2006page');
  // Clean any stale renders from a prior run.
  for (const f of readdirSync(tmpDir)) { try { unlinkSync(join(tmpDir, f)); } catch {} }
  execFileSync('pdftoppm', ['-r', '300', '-png', '-f', '40', '-l', '40', pdfPath, prefix], { maxBuffer: 200 * 1024 * 1024 });
  const pngFile = readdirSync(tmpDir).find(f => f.endsWith('.png'));
  if (!pngFile) throw new Error('pdftoppm produced no PNG for CT2006 page 40');
  const pngPath = join(tmpDir, pngFile);
  const ocrText = execFileSync(TESSERACT_BIN, [pngPath, 'stdout', '--psm', '6'], { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
  // OCR output is not column-aligned like pdftotext -table; locate the "Total
  // Revenues" / "Total Expenditures" row and take the FIRST numeric token after
  // the label (General Fund is column 1), tolerant of OCR spacing noise.
  let revenues = null, expenditures = null;
  for (const rawLine of ocrText.split('\n')) {
    const line = rawLine.trim();
    const lower = line.toLowerCase();
    if (revenues === null && /^total\s+revenues\b/.test(lower)) {
      const rest = line.replace(/^total\s+revenues\b/i, '');
      revenues = extractFirstNumberFromLine(rest);
    }
    if (expenditures === null && /^total\s+expenditures\b/.test(lower)) {
      const rest = line.replace(/^total\s+expenditures\b/i, '');
      expenditures = extractFirstNumberFromLine(rest);
    }
  }
  return { revenues, expenditures, ocrText };
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

// ── Target configuration — v2.14 tranche-3 + deepening sample ──────────────────
// cache: _acfr-work/{st}/{ST}{YYYY}.pdf (load-time verified bytes, reused as-is).
// url: canonical re-fetch source (per-state LOADLOG / loader SOURCES URL string,
//      used ONLY as a fetch address if the cache is missing — never for
//      extraction logic). preGasb34/ocr select the extraction path.
const T = (state, stateName, fy, cacheFile, url, units, opts = {}) => ({
  state, stateName, fy, cacheFile, url, units,
  revOnly: opts.revOnly || false,
  preGasb34: opts.preGasb34 || false,
  ocr: opts.ocr || false,
  notes: opts.notes || '',
});

const TARGETS = [
  // ── Indiana (thousands; near-parity with NASBO, federal in a separate fund) ──
  T('IN', 'Indiana', 2002, 'in/IN2002.pdf', 'https://www.in.gov/comptroller/files/State_of_Indiana_2002_CAFR.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('IN', 'Indiana', 2013, 'in/IN2013.pdf', 'https://www.in.gov/comptroller/files/Entire_2013_CAFR.pdf', 1000,
    { notes: 'Random middle (documented): arithmetic middle, year 12/24 of FY2002-2025.' }),
  T('IN', 'Indiana', 2025, 'in/IN2025.pdf', 'https://www.in.gov/comptroller/files/Fiscal-2025-Annual-Comprehensive-Financial-Report.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── Arizona (thousands; FY2024 = Google-Drive caveat year) ───────────────────
  T('AZ', 'Arizona', 2002, 'az/AZ2002.pdf', 'https://gao.az.gov/sites/default/files/2022-05/02-CAFRall_0.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('AZ', 'Arizona', 2024, 'az/AZ2024.pdf', 'https://drive.google.com/uc?export=download&id=14FYCgTQPsu77pxLtz41E_Ba_0hCuMhwA', 1000,
    { notes: 'Newest bookend AND the Drive-link non-durability caveat year (113-02 loadlog) — re-derived from the SAME Drive URL the loader used. If the Drive link is dead and no cache exists, this check reports BLOCKED, not a silent skip.' }),

  // ── Oregon (thousands; full recon-locked window, smallest scope-divergence) ──
  T('OR', 'Oregon', 2022, 'or/OR2022.pdf', 'https://www.oregon.gov/das/Financial/Acctng/Documents/2022%20ACFR.pdf', 1000,
    { notes: 'Oldest bookend (window floor — pre-FY2022 is Wayback-only, D-06 exclusion).' }),
  T('OR', 'Oregon', 2025, 'or/OR2025.pdf', 'https://www.oregon.gov/das/Financial/Acctng/Documents/2025.ACFR.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── Missouri (thousands; 6 P2 clamp years, all on the revenue-side Fair
  //     Value of Investments line — revOnly, printed-root bar nets the negative) ─
  T('MO', 'Missouri', 2012, 'mo/MO2012.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302012.pdf', 1000,
    { notes: 'Oldest bookend (window floor per recon).' }),
  T('MO', 'Missouri', 2025, 'mo/MO2025.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2026-02/2025%20ACFR%20Final.pdf', 1000,
    { notes: 'Newest bookend.' }),
  T('MO', 'Missouri', 2013, 'mo/MO2013.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302013.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: Net Increase (Decrease) in Fair Value of Investments -11,518K; printed root nets it.' }),
  T('MO', 'Missouri', 2017, 'mo/MO2017.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-12/annual-comprehensive-financial-report-fy-end06302017.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: -3,250K (hand-verified wrapped-label fix per 113-04 loadlog); printed root nets it.' }),
  T('MO', 'Missouri', 2018, 'mo/MO2018.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302018.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: -2,981K; printed root nets it.' }),
  T('MO', 'Missouri', 2021, 'mo/MO2021.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2022-10/annual-comprehensive-financial-report-fy-end06302021.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: -7,566K (hand-verified wrapped-label fix per 113-04 loadlog); printed root nets it.' }),
  T('MO', 'Missouri', 2022, 'mo/MO2022.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2023-03/ACFR_2022_Final.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: -309,337K (largest MO clamp); printed root nets it.' }),
  T('MO', 'Missouri', 2023, 'mo/MO2023.pdf', 'https://acct.oa.mo.gov/sites/g/files/zuston241/files/2024-03/2023%20ACFR.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: -187,845K; printed root nets it.' }),

  // ── Colorado (thousands; both sampled years TABOR-clamped) ───────────────────
  T('CO', 'Colorado', 2023, 'co/CO2023.pdf', 'https://osc.colorado.gov/sites/osc/files/acfr23.pdf', 1000,
    { notes: 'Oldest bookend (window floor). TABOR refund netted into revenue lines per 113-05 loadlog (no standalone negative line this year, still printed-root bar).' }),
  T('CO', 'Colorado', 2025, 'co/CO2025.pdf', 'https://osc.colorado.gov/sites/osc/files/documents/FY2025%20ACFR_ADA_1.30.26.pdf', 1000,
    { notes: 'Newest bookend. TABOR CLAMP: standalone "TABOR Excess Revenue" = -129,536K; printed root nets it.' }),

  // ── South Carolina (thousands; GAAP-vs-budgetary consolidation driver) ───────
  T('SC', 'South Carolina', 2002, 'sc/SC2002.pdf', 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2000%20-%202009)/SC%20FY%202002%20CAFR.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('SC', 'South Carolina', 2013, 'sc/SC2013.pdf', 'https://cg.sc.gov/sites/cg/files/Documents/Publications%20and%20Reports/Annual%20Accountability%20Reports/State%20of%20South%20Carolina%202013%20CAFR.pdf', 1000,
    { notes: 'Random middle (documented): arithmetic middle, year 12/24 of FY2002-2025.' }),
  T('SC', 'South Carolina', 2025, 'sc/SC2025.pdf', 'https://cg.sc.gov/sites/cg/files/Documents/Financial%20Reports/Annual%20Comprehensive%20Financial%20Reports%20(ACFRs)/Annual%20Comprehensive%20Financial%20Reports%20(2010%20-%202019)/ACFR%20Current%20Year/039-191-ACFR-FY2025-BasicFinancialStatements.pdf', 1000,
    { notes: 'Newest bookend (part-file — the FY2025 ACFR is split into 9 parts; this statement lives in the BasicFinancialStatements part).' }),

  // ── Kentucky (thousands; FY2023 is a documented honest hole — NOT sampled) ───
  T('KY', 'Kentucky', 2002, 'ky/KY2002.pdf', 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2002%20CAFR.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('KY', 'Kentucky', 2012, 'ky/KY2012.pdf', 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2012%20CAFR.pdf', 1000,
    { notes: 'Random middle (documented): year 11/24 of FY2002-2025 — chosen one year earlier than the IN/SC/AL/LA middle (FY2013) to stay clear of the FY2023 honest hole (114-02: unreadable font, no ToUnicode CMap).' }),
  T('KY', 'Kentucky', 2025, 'ky/KY2025.pdf', 'https://finance.ky.gov/office-of-the-controller/office-of-statewide-accounting-services/financial-reporting-branch/ACFR/2025%20Commonwealth%20of%20Kentucky%20Annual%20Comprehensive%20Financial%20Report.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── Utah (thousands; GF-alone scope decision; FY2022 = Investment Income (Loss) clamp) ─
  T('UT', 'Utah', 2019, 'ut/UT2019.pdf', 'https://finance.utah.gov/wp-content/uploads/2019-ACFR.pdf', 1000,
    { notes: 'Oldest bookend (window floor — pre-FY2019 URLs 404 live, D-06).' }),
  T('UT', 'Utah', 2025, 'ut/UT2025.pdf', 'https://finance.utah.gov/wp-content/uploads/FY25-ACFR-FINAL-reduced-size.pdf', 1000,
    { notes: 'Newest bookend.' }),
  T('UT', 'Utah', 2022, 'ut/UT2022.pdf', 'https://finance.utah.gov/wp-content/uploads/2022-ACFR.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: Investment Income (Loss) = -4,304K; printed root nets it.' }),

  // ── Alabama (thousands; Sep-30 FY-end; GF-alone vs Education Trust Fund) ─────
  T('AL', 'Alabama', 2002, 'al/AL2002.pdf', 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/2002CAFR.pdf', 1000,
    { notes: 'Oldest bookend. Sep-30 FY-end (source_date {fy}-09-30) — does not affect the dollar tie.' }),
  T('AL', 'Alabama', 2013, 'al/AL2013.pdf', 'https://comptroller.alabama.gov/wp-content/uploads/2017/11/cafr.2013.ala_.pdf', 1000,
    { notes: 'Random middle (documented): arithmetic middle, year 12/24 of FY2002-2025.' }),
  T('AL', 'Alabama', 2025, 'al/AL2025.pdf', 'https://comptroller.alabama.gov/wp-content/uploads/2026/03/ACFR-2025.Alabama.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── Louisiana (thousands; GF ~99% federal Intergovernmental Revenues) ────────
  T('LA', 'Louisiana', 2002, 'la/LA2002.pdf', 'https://doa.la.gov/media/fthjchle/cafr02.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('LA', 'Louisiana', 2013, 'la/LA2013.pdf', 'https://doa.la.gov/media/smwlbb1f/cafr2013.pdf', 1000,
    { notes: 'Random middle (documented): arithmetic middle, year 12/24 of FY2002-2025.' }),
  T('LA', 'Louisiana', 2025, 'la/LA2025.pdf', 'https://doa.la.gov/media/lqvhnfhs/fy25-acfr-final.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ── New Jersey (FULL DOLLARS x1 — the only non-thousands tranche/deepening state) ─
  T('NJ', 'New Jersey', 2002, 'nj/NJ2002.pdf', 'https://www.nj.gov/treasury/omb/02fr/pdf/02FR.pdf', 1,
    { notes: 'New archive-edge floor recovered in Phase 115 (NJ adopted GASB-34 in FY2002 itself — no pre-34 boundary exists for NJ). UNITS=1 (dollars).' }),
  T('NJ', 'New Jersey', 2010, 'nj/NJ2010.pdf', 'https://www.nj.gov/treasury/omb/10fr/pdf/fullfr2010.pdf', 1,
    { notes: 'Random middle (documented): middle of the newly-recovered FY2002-2019 run.' }),

  // ── Connecticut (pre-34 FY1988 + FY2001; FY2006 OCR-recovered GAAP year) ─────
  T('CT', 'Connecticut', 1988, 'ct/CT1988.pdf', 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY1988.pdf', 1000,
    { preGasb34: true, notes: 'Archive floor (oldest CT pre-34 year, osc.ct.gov oldcafrpdfs collection begins here). Pre-GASB-34 Combined Statement basis.' }),
  T('CT', 'Connecticut', 2001, 'ct/CT2001.pdf', 'https://osc.ct.gov/reports/oldcafrpdfs/CT_CAFR_FY2001.pdf', 1000,
    { preGasb34: true, notes: 'Pre-GASB-34 boundary year (last pre-34 CT year; FY2002 is the first modern GASB-34 CT statement).' }),
  T('CT', 'Connecticut', 2006, 'ct/CT2006.pdf', 'https://osc.ct.gov/2006cafr/cafr2006.pdf', 1000,
    { ocr: true, notes: 'OCR-recovered (DEEP-03): scanned page, no text layer. Independently re-OCR\'d here at PDF page 40/164 (300dpi + tesseract --psm 6, per the 115-02 loadlog\'s documented page location) — NOT read from the loader\'s embedded CT2006_REVENUES/EXPENDITURES arrays. GASB-34-era GAAP basis (not pre-34).' }),

  // ── Wisconsin (pre-34 FY2000 + FY2001; FY2001 has the documented -2K rounding note) ─
  T('WI', 'Wisconsin', 2000, 'wi/WI2000.pdf', 'https://doa.wi.gov/DEBFCapitalFinance/2000/2000cafr.pdf', 1000,
    { preGasb34: true, notes: 'Archive floor (WI pre-FY2000 is the out-of-scope 4-section multi-file era).' }),
  T('WI', 'Wisconsin', 2001, 'wi/WI2001.pdf', 'https://doa.wi.gov/DEBFCapitalFinance/2001/2001cafr.pdf', 1000,
    { preGasb34: true, notes: 'Pre-GASB-34 boundary year. KNOWN documented-rounding candidate: 115-02 loadlog records expenditure diff -2K (printed-vs-line-sum GAAP rounding, within the loader\'s TOL=5) — NOT an extraction defect. This harness applies the exact-0 bar; Task 2 dispositions this one via the loadlog reference if it reproduces here.' }),

  // ── Massachusetts (pre-34 FY2001 recovered; FY2014 recovered GAAP year) ──────
  T('MA', 'Massachusetts', 2001, 'ma/MA2001.pdf', 'https://www.macomptroller.org/wp-content/uploads/acfr_fy-2001.pdf', 1000,
    { preGasb34: true, notes: 'Recovered in 115-03: pre-GASB-34 Combined Statement, with MA\'s subtitle printing BEFORE the title (opposite order from CT/WI) — this harness\'s pre-34 locator checks both orders.' }),
  T('MA', 'Massachusetts', 2014, 'ma/MA2014.pdf', 'https://www.macomptroller.org/wp-content/uploads/acfr_fy-2014.pdf', 1000,
    { notes: 'Recovered in 115-03 (font-glyph substitution defects fixed in the loader\'s extractor). GAAP basis, modern statement.' }),
];

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('');
console.log('Phase 116 -- Loader-Independent ACFR Re-Derivation Harness');
console.log('VER-07 (a): v2.14 tranche-3 + deepening sample -- IN AZ OR MO CO SC KY UT AL LA / NJ CT WI MA');
console.log('Tolerance: PASS = abs(delta) === 0 EXACTLY (Phase 106/110 D-03 carried forward)');
console.log('Method: blind re-extract from source PDF (or independent OCR for CT FY2006);');
console.log('        imports ZERO loaders / ZERO shared parser modules');
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
  console.log(`  -- ${t.stateName} FY${t.fy}${t.preGasb34 ? ' (pre-GASB-34)' : ''}${t.ocr ? ' (OCR)' : ''} --`);
  if (t.notes) console.log(`     ${t.notes}`);

  const pdfPath = resolve(PROJECT_ROOT, '_acfr-work', t.cacheFile);
  const failBoth = (msg, blocked = false) => {
    for (const dataset of t.revOnly ? ['revenue'] : ['revenue', 'operating']) {
      checks.push({ label: `${t.state} FY${t.fy}`, dataset, acfrDollars: null, stored: null, delta: null, pass: false, verdictStr: blocked ? `BLOCKED (${msg})` : `FAIL (${msg})`, notes: t.notes });
    }
  };

  // Source bytes: load-time verified cache, else canonical re-fetch.
  if (existsSync(pdfPath)) {
    const st = statSync(pdfPath);
    const head = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
    if (head !== '%PDF-' || st.size < 400_000) { failBoth(`cache file invalid (magic=${head}, size=${st.size})`); continue; }
    console.log(`    Cache: ${t.cacheFile} (${(st.size / 1024 / 1024).toFixed(1)} MB, %PDF ok)`);
  } else if (t.url) {
    console.log(`    Downloading: ${t.url}`);
    try {
      mkdirSync(dirname(pdfPath), { recursive: true });
      await downloadPdf(t.url, pdfPath);
      console.log(`    Downloaded: ${(statSync(pdfPath).size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      // AZ FY2024's Drive link is explicitly non-durable (113-02 caveat) — a
      // dead link here is a documented BLOCKED disposition, never a silent skip.
      failBoth(`download error: ${e.message}`, t.state === 'AZ' && t.fy === 2024);
      continue;
    }
  } else {
    failBoth('cache missing and no URL recorded');
    continue;
  }

  // Blind extraction: auto-locate the correct statement, or OCR for CT FY2006.
  let totals;
  try {
    if (t.ocr) {
      totals = ocrCT2006(pdfPath);
      console.log(`    OCR page 40/164 (300dpi, tesseract --psm 6): Total revenues (printed, GF col) = ${fmtRaw(totals.revenues)}; Total expenditures = ${fmtRaw(totals.expenditures)}`);
    } else {
      const pages = extractAllPages(pdfPath);
      totals = t.preGasb34 ? findPre34StatementTotals(pages) : findModernStatementTotals(pages);
      if (totals.page === null) { failBoth(t.preGasb34 ? 'pre-GASB-34 Combined Statement not auto-located' : 'Governmental Funds statement not auto-located'); continue; }
      console.log(`    Statement page ${totals.page}: Total revenues (printed, GF col) = ${fmtRaw(totals.revenues)}; Total expenditures = ${fmtRaw(totals.expenditures)}`);
    }
  } catch (e) { failBoth(`extraction error: ${e.message}`); continue; }

  if (totals.revenues === null && totals.expenditures === null) { failBoth('no totals extracted'); continue; }

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
const header = [padR('State / FY', 14), padR('Dataset', 10), padL('Re-derived ($)', 20), padL('DB Stored ($)', 20), padL('Delta ($)', 14), 'Verdict'].join('  ');
console.log(header);
console.log('-'.repeat(header.length + 10));
let failures = 0;
let blocked = 0;
for (const c of checks) {
  console.log([padR(c.label, 14), padR(c.dataset, 10), padL(c.acfrDollars !== null ? fmtRaw(c.acfrDollars) : 'N/A', 20), padL(c.stored !== null ? fmtRaw(c.stored) : 'N/A', 20), padL(c.delta !== null ? fmtRaw(c.delta) : 'N/A', 14), c.verdictStr].join('  '));
  if (c.verdictStr.startsWith('BLOCKED')) blocked++;
  else if (!c.pass) failures++;
}
console.log('-'.repeat(header.length + 10));
console.log('');
console.log(`  ${checks.length - failures - blocked} / ${checks.length} checks PASS (exact delta=0 required); ${blocked} BLOCKED; ${failures} FAIL`);

console.log('');
console.log('-- Sample Documentation (reproducibility) -----------------------------------');
console.log('  Random middles: IN/SC/AL/LA FY2013 (arithmetic middle, yr 12/24), KY FY2012 (yr 11/24,');
console.log('  deliberately one year clear of the FY2023 honest hole), NJ FY2010 (middle of the newly-');
console.log('  recovered FY2002-2019 run).');
console.log('  Clamp years sampled: MO FY2013/2017/2018/2021/2022/2023 (revOnly), CO FY2023+FY2025,');
console.log('  UT FY2022 (revOnly). Bar for clamp years = printed GF root total (nets the negative),');
console.log('  matching stored total_budget.');
console.log('  Known documented-rounding candidate: WI FY2001 pre-34 expenditure (115-02 loadlog: -2K,');
console.log('  within the loader\'s TOL=5) -- dispositioned in 116-REDERIVATION.md, not auto-passed here.');

console.log('');
if (failures === 0 && blocked === 0) {
  console.log(`PASS -- All ${checks.length} Phase 116 re-derivation checks tie at exact delta=0`);
  process.exit(0);
} else if (failures === 0 && blocked > 0) {
  console.log(`PASS-WITH-BLOCKED -- ${checks.length - blocked} checks tie exact; ${blocked} BLOCKED (documented, non-durable source) -- see 116-REDERIVATION.md`);
  process.exit(0);
} else {
  console.log(`FAIL -- ${failures} of ${checks.length} checks have non-zero delta or errors (explain-or-fix per 116-01 Task 2)`);
  process.exit(2);
}
