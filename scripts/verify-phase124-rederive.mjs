#!/usr/bin/env node
/**
 * verify-phase124-rederive.mjs
 *
 * Loader-independent ACFR re-derivation harness for Phase 124 / VER-09 (a).
 *
 * Purpose: Independently re-derive -- from each state's own ACFR/CAFR PDF, WITHOUT
 * importing any scripts/process*Acfr.js loader OR any shared extraction module
 * (_acfr-work/extract_gf.py, gen_state.py, build_state.py, ia_extract.py,
 * maAcfrExtract.mjs, pre34Extract.mjs, njAcfrExtract.mjs) -- the General-Fund
 * printed totals for the v2.15 final-tail 21-state sample + the FULL 24-state-FY
 * CA/FL deepening set, then diff against treasury.budgets live values.
 *
 * INDEPENDENCE RULE (blind method): this harness re-keys the GENERAL FUND column
 * "Total revenues" / "Total expenditures" printed lines (modern GASB-34
 * statements) with its OWN minimal extraction (auto-locates the statement page,
 * takes the first numeric token on each total line = the GF 1st-column value).
 * It does NOT import or shell out to extract_gf.py / gen_state.py / build_state.py
 * / ia_extract.py -- those ARE the loaders' extraction path; reusing them would
 * re-test the loader against itself. The 4 image/scan years (NM FY2022, OK
 * FY2019, SD FY2007, SD FY2010) are independently re-rendered (pdftoppm) + re-OCR'd
 * (tesseract) fresh from the source PDF at this harness's own page-scan pass --
 * NOT read from any loader-embedded static array (nm_all.json / ok_all.json /
 * sd_all.json).
 *
 * Sample (VER-09a; risk-weighted for the 21 new states -- bookends + newest FY +
 * every documented transcription-risk/clamp year; EXHAUSTIVE for the 24 CA/FL
 * deepening state-FYs). Middle-year / clamp-year / scan-year choices documented
 * inline in the TARGETS list below for reproducibility.
 *
 *   Batch-1 (Phase 118): AK FY2006+FY2015+FY2025; AR FY2003+FY2024 (single-fund);
 *     DE FY2004+FY2006+FY2025; HI FY2005+FY2025; ID FY2004(mixed-unit)+FY2025.
 *   Batch-2 (Phase 119): IA FY2002+FY2009+FY2025 (NET REVENUES tie);
 *     KS FY2019+FY2025+FY2021(revOnly clamp); ME FY2002+FY2025;
 *     MS FY2003+FY2024(dual-negative clamp); MT FY2015+FY2025.
 *   Batch-3 (Phase 120): NE FY2020+FY2025+FY2022(revOnly clamp);
 *     NV FY2019+FY2023+FY2022(revOnly clamp, UNITS=1); NH FY2017+FY2024 (Wayback);
 *     NM FY2019+FY2024+FY2022(hand-transcribed/OCR image page);
 *     ND FY2021+FY2025+FY2022(revOnly clamp, UNITS=1).
 *   Batch-4 (Phase 121): OK FY2002+FY2024+FY2019(hand-transcribed/OCR image page);
 *     RI FY2006+FY2025; SD FY2002+FY2025+FY2007+FY2010(both OCR whole-doc-scan);
 *     VT FY2015+FY2025 (UNITS=1); WV FY2020+FY2025;
 *     WY FY2005+FY2025+FY2013(revOnly clamp, UNITS=1).
 *   Deepening (Phase 122) -- EXHAUSTIVE, both datasets, all 24 state-FYs:
 *     CA FY2002..FY2007 (6); FL FY2003..FY2020 (18).
 *
 * TOLERANCE (exact-0, carried from 106/110/116): PASS only on abs(delta) === 0.
 * The ONLY acceptable non-zero disposition is the ID FY2004 mixed-unit
 * printed-vs-stored rounding note (118-05 loadlog: ~$22 / ~$29 rounding from the
 * whole-dollar-to-thousands normalization) -- handled in 124-REDERIVATION.md, not
 * auto-passed here.
 *
 * Source bytes: uses the load-time verified cache _acfr-work/{st}/{FILE} if
 * present, else re-fetches from the canonical URL (per-state loader SOURCES
 * string, used ONLY as a fetch address -- never for extraction logic) with the
 * soft-404 guard (Content-Type application/pdf OR >= 400KB + %PDF magic).
 *
 * No loader imports. No AI calls. $0 spend. pdftotext (+ pdftoppm/tesseract for
 * the 4 OCR checks) + read-only DB access.
 * Exit 0 = all checks tie exactly (or documented rounding note handled in the
 * disposition log); Exit 2 = one or more checks FAIL/unexplained.
 *
 * Usage: node scripts/verify-phase124-rederive.mjs
 */

import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Known-good absolute path for tesseract on this host (not on PATH; same
// invocation the 116 harness used for its CT FY2006 OCR recovery -- reused here
// ONLY as a fetch/render tool path, not as loader logic).
const TESSERACT_BIN = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';

// ── Env loading (walk up for .env.local/.env) ──────────────────────────────────
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
// T-124-01: filter by Content-Type application/pdf OR size, PLUS %PDF magic --
// a soft-404 HTML page must FAIL, never silently tie to 0.
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
        const okType = contentType.includes('application/pdf');
        const okSize = buf.length >= 400_000;
        const okMagic = buf.subarray(0, 5).toString('latin1') === '%PDF-';
        if (!okMagic || (!okType && !okSize)) {
          return reject(new Error(`T-124-01 SOFT-404 for ${url}: Content-Type="${contentType}", size=${buf.length}, magic=${okMagic}`));
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

// ── Number parsing (our own -- NOT any shared extractor) ───────────────────────
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
// NOTE: matches "total revenue(s)"/"total expenditure(s)" -- the trailing "s" is
// optional (safe superset per the 121-03 SD-loadlog precedent: SD's printed
// statement uses the SINGULAR "Total Revenue" row label, no other cohort state
// uses singular, so widening the match is a no-op everywhere else).
function parseModernGFTotals(text) {
  let revenues = null;
  let expenditures = null;
  for (const line of text.split('\n')) {
    const lower = line.toLowerCase();
    if (revenues === null && /^\s*total revenues?(\s|$|[^a-z])/.test(lower) && !/other/.test(lower)) {
      revenues = extractFirstNumberFromLine(line);
    }
    if (revenues === null && /^\s*total revenues? and other/.test(lower)) {
      revenues = extractFirstNumberFromLine(line);
    }
    if (expenditures === null && /^\s*total expenditures?(\s|$|[^a-z])/.test(lower) && !/other/.test(lower)) {
      expenditures = extractFirstNumberFromLine(line);
    }
    if (expenditures === null && /^\s*total expenditures? and other/.test(lower)) {
      expenditures = extractFirstNumberFromLine(line);
    }
  }
  return { revenues, expenditures };
}

// Auto-locate the modern Governmental Funds statement page. Exclusion refined
// vs the 116-template: checks for "budgetary comparison"/"budget and actual"
// (a real Budget-vs-Actual non-GAAP schedule) rather than the bare substring
// "budget" -- WY's real GAAP statement has a "Budget Reserve Fund" COLUMN name
// that would false-positive-exclude on the bare-substring check.
const MODERN_TITLE_RE = /statement\s*of\s*revenues\s*,?\s*expenditures/;
function isBudgetSchedulePage(p) {
  return p.includes('budgetary comparison') || p.includes('budget and actual') || p.includes('budget to actual');
}
function findModernStatementTotals(pages) {
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!MODERN_TITLE_RE.test(p)) continue;
    if (!p.includes('changes in fund balance')) continue;
    if (p.includes('combining')) continue;
    if (isBudgetSchedulePage(p)) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      const totals = parseModernGFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) return { ...totals, page: i + 1 };
    }
  }
  // Relaxed second pass (older editions split the title across lines).
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!MODERN_TITLE_RE.test(p)) continue;
    if (p.includes('combining') || isBudgetSchedulePage(p)) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      const totals = parseModernGFTotals(span);
      if (totals.revenues !== null && totals.expenditures !== null) return { ...totals, page: i + 1 };
    }
  }
  return { revenues: null, expenditures: null, page: null };
}

// ── IA NET-REVENUES tie (no literal "Total revenues" line exists in IA's
//    statement -- it prints GROSS REVENUES / Less Revenue Refunds / NET REVENUES;
//    re-key the literal "NET REVENUES" printed row directly, which already IS the
//    GROSS-minus-refunds arithmetic baked into the printed statement itself). ────
function findIAStatementTotals(pages) {
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i].toLowerCase().replace(/\s+/g, ' ');
    if (!MODERN_TITLE_RE.test(p)) continue;
    if (!p.includes('changes in fund balance')) continue;
    if (p.includes('combining')) continue;
    if (isBudgetSchedulePage(p)) continue;
    for (const span of [pages[i], pages[i] + '\n' + (pages[i + 1] || '')]) {
      let revenues = null, expenditures = null;
      for (const line of span.split('\n')) {
        const lower = line.toLowerCase();
        if (revenues === null && /^\s*net revenues(\s|$|[^a-z])/.test(lower)) {
          revenues = extractFirstNumberFromLine(line);
        }
        if (expenditures === null && /^\s*total expenditures(\s|$|[^a-z])/.test(lower) && !/and other/.test(lower)) {
          expenditures = extractFirstNumberFromLine(line);
        }
      }
      if (revenues !== null && expenditures !== null) return { revenues, expenditures, page: i + 1 };
    }
  }
  return { revenues: null, expenditures: null, page: null };
}

// ── OCR path (image/scan years -- NM FY2022, OK FY2019, SD FY2007/FY2010) ──────
// Independently re-renders the source PDF's candidate page window at 300dpi and
// OCRs each page fresh with tesseract -- NEVER reads the loader's embedded
// nm_all.json / ok_all.json / sd_all.json static arrays. Page-window hints come
// from each state's LOADLOG (a location fact, not an extracted value) -- same
// precedent as the 116 harness's CT FY2006 "PDF page 40 of 164" hint.
function ocrFindTotals(pdfPath, pages, opts = {}) {
  const tmpDir = resolve(PROJECT_ROOT, '_acfr-work', '124-ocr-tmp');
  mkdirSync(tmpDir, { recursive: true });
  for (const f of readdirSync(tmpDir)) { try { unlinkSync(join(tmpDir, f)); } catch {} }
  const prefix = join(tmpDir, 'pg');
  const first = Math.min(...pages), last = Math.max(...pages);
  execFileSync('pdftoppm', ['-r', '300', '-png', '-f', String(first), '-l', String(last), pdfPath, prefix], { maxBuffer: 200 * 1024 * 1024 });
  let revenues = null, expenditures = null, revPage = null, expPage = null;
  const revLabelRe = opts.singular ? /^total revenue\b(?!s)/ : /^total revenues?\b/;
  const expLabelRe = /^total expenditures?\b/;
  const files = readdirSync(tmpDir).filter(f => f.endsWith('.png')).sort();
  for (const f of files) {
    const pngPath = join(tmpDir, f);
    const ocrText = execFileSync(TESSERACT_BIN, [pngPath, 'stdout', '--psm', '6'], { maxBuffer: 50 * 1024 * 1024 }).toString('utf8');
    for (const rawLine of ocrText.split('\n')) {
      const line = rawLine.trim();
      const lower = line.toLowerCase();
      if (revenues === null && revLabelRe.test(lower)) {
        const rest = line.replace(/^total revenues?\b/i, '');
        const n = extractFirstNumberFromLine(rest);
        if (n !== null) { revenues = n; revPage = f; }
      }
      if (expenditures === null && expLabelRe.test(lower)) {
        const rest = line.replace(/^total expenditures?\b/i, '');
        const n = extractFirstNumberFromLine(rest);
        if (n !== null) { expenditures = n; expPage = f; }
      }
    }
  }
  return { revenues, expenditures, revPage, expPage };
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

// ── Target configuration -- v2.15 final-tail 21-state sample + CA/FL deepening ─
// cache: _acfr-work/{path} (existing load-time verified bytes if present, else
// fresh fetch from `url`, which is the loader's own SOURCES string reused ONLY
// as a fetch address -- never for extraction logic, per the 116 precedent).
const T = (state, stateName, fy, cacheFile, url, units, opts = {}) => ({
  state, stateName, fy, cacheFile, url, units,
  revOnly: opts.revOnly || false,
  ia: opts.ia || false,
  ocr: opts.ocr || null, // { pages: [...], singular?: bool }
  unitsOverride: opts.unitsOverride, // e.g. ID FY2004 (printed whole dollars, not thousands)
  notes: opts.notes || '',
});

const TARGETS = [
  // ══════════════════════ Batch-1 (Phase 118) ══════════════════════════════════
  T('AK', 'Alaska', 2006, 'ak/AK2006.pdf', 'https://doa.alaska.gov/dof/reports/resource/06cafr.pdf', 1000,
    { notes: 'Oldest bookend of the loaded window (FY2006-FY2025).' }),
  T('AK', 'Alaska', 2015, 'ak/AK2015.pdf', 'https://doa.alaska.gov/dof/reports/resource/2015cafr.pdf', 1000,
    { notes: 'Middle year (documented): arithmetic middle of FY2006-2025.' }),
  T('AK', 'Alaska', 2025, 'ak/AK2025.pdf', 'https://doa.alaska.gov/dof/reports/resource/2025acfr.pdf', 1000,
    { notes: 'Newest bookend.' }),

  T('AR', 'Arkansas', 2003, 'ar/AR2003.pdf', 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2003.pdf', 1000,
    { notes: 'Oldest bookend. SINGLE-FUND state (statement-level Total revenues/expenditures IS the GF) -- widest scope divergence in cohort (~3.96x NASBO).' }),
  T('AR', 'Arkansas', 2024, 'ar/AR2024.pdf', 'https://www.dfa.arkansas.gov/wp-content/uploads/cafr2024.pdf', 1000,
    { notes: 'Newest bookend (FY2025 is a documented honest hole -- garbled font -- NOT sampled).' }),

  T('DE', 'Delaware', 2004, 'de/DE2004.pdf', 'https://accountingfiles.delaware.gov/docs/2004cafr.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('DE', 'Delaware', 2006, 'de/DE2006.pdf', 'https://accountingfiles.delaware.gov/docs/2006cafr.pdf', 1000,
    { notes: 'First year after the documented FY2005 404 hole.' }),
  T('DE', 'Delaware', 2025, 'de/DE2025.pdf', 'https://accountingfiles.delaware.gov/docs/2025acfr.pdf', 1000,
    { notes: 'Newest bookend.' }),

  T('HI', 'Hawaii', 2005, 'hi/HI2005.pdf', 'https://ags.hawaii.gov/wp-content/uploads/2012/09/acfr2005.pdf', 1000,
    { notes: 'Oldest bookend (floor -- FY2000-2004 are image-only holes). GF-ALONE scope decision (~0.95x NASBO, narrower) flagged for Chris UAT.' }),
  T('HI', 'Hawaii', 2025, 'hi/HI2025.pdf', 'https://ags.hawaii.gov/wp-content/uploads/2026/02/acfr2025.pdf', 1000,
    { notes: 'Newest bookend.' }),

  T('ID', 'Idaho', 2004, 'id/ID2004.pdf', 'https://www.sco.idaho.gov/CAFRDocuments/2004%20Comprehensive%20Annual%20Financial%20Report.pdf', 1,
    { unitsOverride: 1, notes: 'HIGH transcription risk: the ONLY mixed-unit year -- printed in WHOLE DOLLARS (2,314,491,978) while FY2005+ print in thousands. Re-extracted here directly as whole dollars (units=1, no x1000) and compared as-is to the stored (already-normalized-to-thousands) value. 118-05 loadlog documents a ~$22/~$29 printed-vs-stored rounding diff from the /1000 normalization at load time -- expect a small non-zero delta here, dispositioned in 124-REDERIVATION.md as the known candidate.' }),
  T('ID', 'Idaho', 2025, 'id/ID2025.pdf', 'https://www.sco.idaho.gov/CAFRDocuments/2025%20Annual%20Comprehensive%20Financial%20Report.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ══════════════════════ Batch-2 (Phase 119) ══════════════════════════════════
  T('IA', 'Iowa', 2002, 'ia/IA2002.pdf', 'https://publications.iowa.gov/5514/2/FY02_CAFR.pdf', 1000,
    { ia: true, notes: 'Oldest bookend. NET-REVENUES tie: IA prints GROSS REVENUES / Less Revenue Refunds / NET REVENUES -- re-key the literal "NET REVENUES" printed row (no literal "Total revenues" line exists).' }),
  T('IA', 'Iowa', 2009, 'ia/IA2009.pdf', 'https://publications.iowa.gov/10536/1/FY09_cafr.pdf', 1000,
    { ia: true, notes: 'First year after the documented FY2008 honest hole (RC4-encrypted PDF, zero extractable text).' }),
  T('IA', 'Iowa', 2025, 'ia/IA2025.pdf', 'https://publications.iowa.gov/54805/1/ACFR%20FY2025%20-%20Protected%2012.22.2025.pdf', 1000,
    { ia: true, notes: 'Newest bookend.' }),

  T('KS', 'Kansas', 2019, 'ks/KS2019.pdf', 'https://www.admin.ks.gov/browse/files/2bd8990b55c94ceaa02fb136b6a2b111/download', 1000,
    { notes: 'Oldest bookend (window floor).' }),
  T('KS', 'Kansas', 2025, 'ks/KS2025.pdf', 'https://www.admin.ks.gov/browse/files/d2d39a0deef8464faaba21b8f4e69a24/download', 1000,
    { notes: 'Newest bookend.' }),
  T('KS', 'Kansas', 2021, 'ks/KS2021.pdf', 'https://www.admin.ks.gov/browse/files/7d8b648a351d481eaebd75655a44ea07/download', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: "Investment earnings" -$3,712K; printed root nets it.' }),

  T('ME', 'Maine', 2002, 'me/ME2002.pdf', 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2002.pdf', 1000,
    { notes: 'Oldest bookend (floor -- FY2000/2001 are pre-GASB-34 holes; NON-JUNE FY-end does not affect the $ tie).' }),
  T('ME', 'Maine', 2025, 'me/ME2025.pdf', 'https://www.maine.gov/osc/sites/maine.gov.osc/files/inline-files/acfr2025.pdf', 1000,
    { notes: 'Newest bookend.' }),

  T('MS', 'Mississippi', 2003, 'ms/MS2003.pdf', 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/2003-cafr.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('MS', 'Mississippi', 2024, 'ms/MS2024.pdf', 'https://www.dfa.ms.gov/sites/default/files/Financial%20Reporting%20Home/Publications/ACFR/FY24%20%20ACFR%20Final.pdf', 1000,
    { notes: 'Newest bookend. DUAL-NEGATIVE P2 CLAMP year (Investment income + Rentals); printed root bar $22,709,403K nets both. FY2025 confirmed absent (not sampled).' }),

  T('MT', 'Montana', 2015, 'mt/MT2015.pdf', 'https://doa.mt.gov/_docs/sfsd/sab/Documents/2015.pdf', 1000,
    { notes: 'Oldest bookend (window floor).' }),
  T('MT', 'Montana', 2025, 'mt/MT2025.pdf', 'https://doa.mt.gov/_docs/sfsd/sab/Montana-ACFR-2025-sig-on-file1.pdf', 1000,
    { notes: 'Newest bookend.' }),

  // ══════════════════════ Batch-3 (Phase 120) ══════════════════════════════════
  T('NE', 'Nebraska', 2020, 'ne/ne_2020.pdf', 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2020.pdf', 1000,
    { notes: 'Oldest bookend (window floor).' }),
  T('NE', 'Nebraska', 2025, 'ne/ne_2025.pdf', 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2025.pdf', 1000,
    { notes: 'Newest bookend.' }),
  T('NE', 'Nebraska', 2022, 'ne/ne_2022.pdf', 'https://das.nebraska.gov/accounting/docs/NE_DAS_Accounting-Annual_Reports_Annual_Comprehensive_Financial_Report_ACFR_2022.pdf', 1000,
    { revOnly: true, notes: 'P2 CLAMP year: "Investment Income" -$191,405K (plus a smaller FY2020 "Other Taxes" -$193K clamp, not separately sampled); printed root nets it.' }),

  T('NV', 'Nevada', 2019, 'nv/nv_2019.pdf', 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/CAFR_Web_2019.pdf', 1,
    { notes: 'Oldest bookend. UNITS=1 FULL DOLLARS -- HIGH unit-scale risk (the NV units trap).' }),
  T('NV', 'Nevada', 2023, 'nv/nv_2023.pdf', 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2023-acfr-report.pdf', 1,
    { notes: 'Newest bookend of the ACFR window (FY2024 is the retained NASBO fallback -- NOT re-derived here).' }),
  T('NV', 'Nevada', 2022, 'nv/nv_2022.pdf', 'https://www.controller.nv.gov/siteassets/content/financialrpts/acfr/2022_ACFR_Report.pdf', 1,
    { revOnly: true, notes: 'P2 CLAMP year: "Interest and investment income (loss)" -$141,921,982; printed root nets it.' }),

  T('NH', 'New Hampshire', 2017, 'nh/NH2017.pdf', 'https://web.archive.org/web/20220121120159if_/https://das.nh.gov/accounting/FY%2017/FY_2017_Comprehensive_Annual_Financial_Report.pdf', 1000,
    { notes: 'Oldest bookend. Wayback-mirror source_url per 120-03 loadlog (das.nh.gov Akamai-blocks direct automated fetch).' }),
  T('NH', 'New Hampshire', 2024, 'nh/NH2024.pdf', 'https://web.archive.org/web/20250530085208if_/https://www.das.nh.gov/accounting/FY%2024/FY_2024_Annual_Comprehensive_Financial_Report.pdf', 1000,
    { notes: 'Newest bookend. Wayback-mirror source_url.' }),

  T('NM', 'New Mexico', 2019, 'nm/nm_2019.pdf', 'https://www.nmdfa.state.nm.us/wp-content/uploads/2021/01/Final-Version-State-of-New-Mexico-CAFR-2019-Audit-05-07-20.pdf', 1000,
    { notes: 'Oldest loaded year (window floor -- FY2020/FY2021 are honest gaps, not sampled).' }),
  T('NM', 'New Mexico', 2024, 'nm/nm_2024.pdf', 'https://www.nmdfa.state.nm.us/wp-content/uploads/2025/04/FINAL-341a-State-of-New-Mexico-FY24-ACFR.pdf', 1000,
    { notes: 'Newest bookend.' }),
  T('NM', 'New Mexico', 2022, 'nm/nm_2022.pdf', 'https://www.nmdfa.state.nm.us/wp-content/uploads/2023/07/Agency-341-A-SoNM-FY22-ACFR-Final.pdf', 1000,
    { ocr: { pages: [48, 49] }, notes: 'HIGH transcription risk: the Governmental Funds statement (printed pp.36-37) renders as a RASTER IMAGE with zero pdftotext content -- independently re-rendered (pdftoppm 300dpi) + re-OCR\'d (tesseract) at PDF pages 48-49 (location hint from the 120-04 loadlog), NOT read from the loader\'s embedded nm_all.json.' }),

  T('ND', 'North Dakota', 2021, 'nd/ND2021.pdf', 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2021-acfr-nd.pdf', 1,
    { notes: 'Oldest bookend. UNITS=1 FULL DOLLARS -- HIGH unit-scale risk (the ND units trap).' }),
  T('ND', 'North Dakota', 2025, 'nd/ND2025.pdf', 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2025-acfr.pdf', 1,
    { notes: 'Newest bookend.' }),
  T('ND', 'North Dakota', 2022, 'nd/ND2022.pdf', 'https://www.omb.nd.gov/sites/www/files/documents/financial-transparency/cafr/2022-acfr.pdf', 1,
    { revOnly: true, notes: 'P2 CLAMP year: "Interest and Investment Income (Loss)" -$897,827,062 (full dollars); printed root nets it.' }),

  // ══════════════════════ Batch-4 (Phase 121) ══════════════════════════════════
  T('OK', 'Oklahoma', 2002, 'ok/OK2002.pdf', 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2002.pdf', 1000,
    { notes: 'Oldest bookend.' }),
  T('OK', 'Oklahoma', 2024, 'ok/OK2024.pdf', 'https://oklahoma.gov/content/dam/ok/en/omes/documents/acfr-2024.pdf', 1000,
    { notes: 'Newest bookend (widest scope divergence in Batch 4, ~3.35x NASBO -- Federal Grants consolidated into GENERAL).' }),
  T('OK', 'Oklahoma', 2019, 'ok/OK2019.pdf', 'https://oklahoma.gov/content/dam/ok/en/omes/documents/cafr2019.pdf', 1000,
    { ocr: { pages: [56] }, notes: 'HIGH transcription risk: the Governmental Funds statement (PDF page 56) is a single embedded JPEG image, zero text layer -- independently re-rendered (pdftoppm 300dpi) + re-OCR\'d (tesseract) at PDF page 56 (location hint from the 121-01 loadlog), NOT read from the loader\'s embedded ok_all.json.' }),

  T('RI', 'Rhode Island', 2006, 'ri/RI2006.pdf', 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2025-01/2006.pdf', 1000,
    { notes: 'Oldest bookend (window floor, FY2006-FY2025).' }),
  T('RI', 'Rhode Island', 2025, 'ri/RI2025.pdf', 'https://controller.admin.ri.gov/sites/g/files/xkgbur621/files/2026-06/State%20of%20Rhode%20Island%20ACFR%20FY2025%20-%20FINAL.pdf', 1000,
    { notes: 'Newest bookend.' }),

  T('SD', 'South Dakota', 2002, 'sd/SD2002.pdf', 'https://bfm.sd.gov/acfr/SD_CAFR_2002.PDF', 1000,
    { notes: 'Oldest bookend (auto-extracted; SD uses SINGULAR "Total Revenue"/"Revenue:" labels, matched by the widened singular-or-plural regex).' }),
  T('SD', 'South Dakota', 2025, 'sd/SD2025.pdf', 'https://bfm.sd.gov/acfr/SD_ACFR_2025.PDF', 1000,
    { notes: 'Newest bookend.' }),
  T('SD', 'South Dakota', 2007, 'sd/SD2007.pdf', 'https://bfm.sd.gov/acfr/SD_CAFR_2007.PDF', 1000,
    { ocr: { pages: [44, 45, 46, 47, 48, 49, 50], singular: true }, notes: 'HIGH transcription risk: one of 9 (FY2003-2011 excl. FY2002) WHOLE-DOCUMENT-SCANNED years, zero usable pdftotext output anywhere in the document -- independently re-rendered (pdftoppm 300dpi) + re-OCR\'d (tesseract) across PDF pages 44-50 (location hint from the SD statement-page range used by the 121-03 loadlog), NOT read from the loader\'s embedded sd_all.json.' }),
  T('SD', 'South Dakota', 2010, 'sd/SD2010.pdf', 'https://bfm.sd.gov/acfr/SD_CAFR_2010.PDF', 1000,
    { ocr: { pages: [44, 45, 46, 47, 48, 49, 50], singular: true }, notes: 'Second sampled whole-document-scanned year (of the same 9-year run) -- independently re-rendered + re-OCR\'d across PDF pages 44-50, same method as FY2007.' }),

  T('VT', 'Vermont', 2015, 'vt/VT2015.pdf', 'https://finance.vermont.gov/sites/finance/files/documents/Rpts_Pubs/CAFR/FIN-2015_CAFR_FINAL.pdf', 1,
    { notes: 'Oldest bookend (window floor). UNITS=1 FULL DOLLARS -- HIGH unit-scale risk (the VT units trap).' }),
  T('VT', 'Vermont', 2025, 'vt/VT2025.pdf', 'https://finance.vermont.gov/sites/finance/files/documents/VERMONT_2025_ACFR_FINAL.pdf', 1,
    { notes: 'Newest bookend.' }),

  T('WV', 'West Virginia', 2020, 'wv/WV2020.pdf', 'https://finance.wv.gov/media/10646/download?inline', 1000,
    { notes: 'Oldest bookend (window floor, FY2020-FY2025).' }),
  T('WV', 'West Virginia', 2025, 'wv/WV2025.pdf', 'https://finance.wv.gov/media/37441/download?inline', 1000,
    { notes: 'Newest bookend.' }),

  T('WY', 'Wyoming', 2005, 'wy/WY2005.pdf', 'https://sao.wyo.gov/wp-content/uploads/2020/01/2005-CAFR.pdf', 1,
    { notes: 'Oldest bookend. UNITS=1 FULL DOLLARS -- HIGH unit-scale risk (the WY units trap). NOTE: WY\'s real GAAP statement has a "Budget Reserve Fund" COLUMN -- this harness\'s budget-schedule exclusion is refined (matches "budgetary comparison", not the bare substring "budget") specifically so this page is not falsely excluded.' }),
  T('WY', 'Wyoming', 2025, 'wy/WY2025.pdf', 'https://sao.wyo.gov/wp-content/uploads/2026/01/2025-ACFR-12.22.25.pdf', 1,
    { notes: 'Newest bookend.' }),
  T('WY', 'Wyoming', 2013, 'wy/WY2013.pdf', 'https://sao.wyo.gov/wp-content/uploads/2020/01/2013-CAFR.pdf', 1,
    { revOnly: true, notes: 'Interior clamp year sample (one of several WY Fair-Market-Value/Sale-of-Assets clamp years).' }),

  // ══════════════════════ Deepening (Phase 122) -- EXHAUSTIVE ═══════════════════
  T('CA', 'California', 2002, 'ca/CA2002.pdf', 'https://www.sco.ca.gov/Files-ARD/CAFR/2002_cafr02.pdf', 1000,
    { notes: 'Deepening bookend (GASB-34 first year for CA -- modern layout, NOT pre-GASB-34). Expected: rev $63,942,875,000.' }),
  T('CA', 'California', 2003, 'ca/CA2003.pdf', 'https://www.sco.ca.gov/Files-ARD/CAFR/2003_cafr03.pdf', 1000, {}),
  T('CA', 'California', 2004, 'ca/CA2004.pdf', 'https://www.sco.ca.gov/Files-ARD/CAFR/2004_cafr04.pdf', 1000, {}),
  T('CA', 'California', 2005, 'ca/CA2005.pdf', 'https://www.sco.ca.gov/Files-ARD/CAFR/2005_cafr05.pdf', 1000, {}),
  T('CA', 'California', 2006, 'ca/CA2006.pdf', 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr06.pdf', 1000, {}),
  T('CA', 'California', 2007, 'ca/CA2007.pdf', 'https://www.sco.ca.gov/Files-ARD/CAFR/cafr07.pdf', 1000,
    { notes: 'Deepening bookend. Expected: rev $96,309,497,000.' }),

  T('FL', 'Florida', 2003, 'fl/FL2003.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2003.pdf', 1000,
    { notes: 'Deepening bookend. Expected: rev $19,857,818,000.' }),
  T('FL', 'Florida', 2004, 'fl/FL2004.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2004.pdf', 1000,
    { notes: 'P2 CLAMP year: "Investment earnings" -$78,773K; printed root nets it.' }),
  T('FL', 'Florida', 2005, 'fl/FL2005.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2005.pdf', 1000, {}),
  T('FL', 'Florida', 2006, 'fl/FL2006.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2006.pdf', 1000, {}),
  T('FL', 'Florida', 2007, 'fl/FL2007.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2007.pdf', 1000, {}),
  T('FL', 'Florida', 2008, 'fl/FL2008.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2008.pdf', 1000, {}),
  T('FL', 'Florida', 2009, 'fl/FL2009.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2009.pdf', 1000,
    { notes: 'P2 CLAMP year: "Investment earnings" -$374,931K; printed root nets it.' }),
  T('FL', 'Florida', 2010, 'fl/FL2010.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2010.pdf', 1000, {}),
  T('FL', 'Florida', 2011, 'fl/FL2011.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2011.pdf', 1000, {}),
  T('FL', 'Florida', 2012, 'fl/FL2012.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2012.pdf', 1000, {}),
  T('FL', 'Florida', 2013, 'fl/FL2013.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/2013cafr.pdf', 1000,
    { notes: 'Filename convention flip: {YYYY}cafr.pdf (FY2013-2017).' }),
  T('FL', 'Florida', 2014, 'fl/FL2014.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/2014cafr.pdf', 1000, {}),
  T('FL', 'Florida', 2015, 'fl/FL2015.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/2015cafr.pdf', 1000, {}),
  T('FL', 'Florida', 2016, 'fl/FL2016.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/2016cafr.pdf', 1000, {}),
  T('FL', 'Florida', 2017, 'fl/FL2017.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/2017cafr.pdf', 1000, {}),
  T('FL', 'Florida', 2018, 'fl/FL2018.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2018.pdf', 1000,
    { notes: 'Filename convention flips back: cafr{YYYY}.pdf (FY2018-2019).' }),
  T('FL', 'Florida', 2019, 'fl/FL2019.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/cafr2019.pdf', 1000, {}),
  T('FL', 'Florida', 2020, 'fl/FL2020.pdf', 'https://www.myfloridacfo.com/docs-sf/default-source/transparency-docs/cafr/2020cafr.pdf', 1000,
    { notes: 'Deepening bookend. Expected: rev $40,534,343,000. FY2000-2002 are a repair-pending honest hole (damaged PDF xref), NOT sampled.' }),
];

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('');
console.log('Phase 124 -- Loader-Independent ACFR Re-Derivation Harness');
console.log('VER-09 (a): v2.15 final-tail 21-state sample + FULL CA/FL deepening (24 state-FYs)');
console.log('Tolerance: PASS = abs(delta) === 0 EXACTLY (Phase 106/110/116 D-03 carried forward)');
console.log('Method: blind re-extract from source PDF (or independent OCR for the 4 image/scan years);');
console.log('        imports ZERO loaders / ZERO shared parser modules / ZERO extract_gf.py shell-outs');
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
  console.log(`  -- ${t.stateName} FY${t.fy}${t.ocr ? ' (OCR)' : ''}${t.ia ? ' (NET-REVENUES tie)' : ''} --`);
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
    if (head !== '%PDF-' || st.size < 300_000) { failBoth(`cache file invalid (magic=${head}, size=${st.size})`); continue; }
    console.log(`    Cache: ${t.cacheFile} (${(st.size / 1024 / 1024).toFixed(1)} MB, %PDF ok)`);
  } else if (t.url) {
    console.log(`    Downloading: ${t.url}`);
    try {
      mkdirSync(dirname(pdfPath), { recursive: true });
      await downloadPdf(t.url, pdfPath);
      console.log(`    Downloaded: ${(statSync(pdfPath).size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      failBoth(`download error: ${e.message}`);
      continue;
    }
  } else {
    failBoth('cache missing and no URL recorded');
    continue;
  }

  // Blind extraction: OCR (image/scan years), IA NET-REVENUES tie, or the
  // standard modern-statement locator.
  let totals;
  try {
    if (t.ocr) {
      totals = ocrFindTotals(pdfPath, t.ocr.pages, { singular: t.ocr.singular });
      console.log(`    OCR pages ${t.ocr.pages[0]}-${t.ocr.pages[t.ocr.pages.length - 1]} (300dpi, tesseract --psm 6): Total revenue(s) (printed, GF col) = ${fmtRaw(totals.revenues)} [${totals.revPage || 'n/a'}]; Total expenditures = ${fmtRaw(totals.expenditures)} [${totals.expPage || 'n/a'}]`);
    } else {
      const pages = extractAllPages(pdfPath);
      totals = t.ia ? findIAStatementTotals(pages) : findModernStatementTotals(pages);
      if (totals.page === null) { failBoth('Governmental Funds statement not auto-located'); continue; }
      console.log(`    Statement page ${totals.page}: ${t.ia ? 'NET REVENUES' : 'Total revenues'} (printed, GF col) = ${fmtRaw(totals.revenues)}; Total expenditures = ${fmtRaw(totals.expenditures)}`);
    }
  } catch (e) { failBoth(`extraction error: ${e.message}`); continue; }

  if (totals.revenues === null && totals.expenditures === null) { failBoth('no totals extracted'); continue; }

  const effUnits = t.unitsOverride !== undefined ? t.unitsOverride : t.units;
  const acfrRev = totals.revenues !== null ? totals.revenues * effUnits : null;
  const acfrExp = totals.expenditures !== null ? totals.expenditures * effUnits : null;

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
console.log('  Middle years: AK FY2015 (arithmetic middle of FY2006-2025).');
console.log('  Clamp years sampled (revOnly): KS FY2021, NE FY2022, NV FY2022, ND FY2022, WY FY2013.');
console.log('  Bar for clamp years = printed GF root/control total (nets the negative), matching stored total_budget.');
console.log('  OCR-independent years (image/scan, re-rendered + re-OCR\'d fresh, NOT loader-embedded arrays):');
console.log('    NM FY2022 (pp.48-49), OK FY2019 (p.56), SD FY2007 + FY2010 (pp.44-50 scan).');
console.log('  Known documented-rounding candidate: ID FY2004 mixed-unit normalization (118-05 loadlog:');
console.log('    ~$22/~$29 printed-vs-stored rounding from the whole-dollar/1000 normalization at load time)');
console.log('    -- dispositioned in 124-REDERIVATION.md, not auto-passed here.');

console.log('');
if (failures === 0 && blocked === 0) {
  console.log(`PASS -- All ${checks.length} Phase 124 re-derivation checks tie at exact delta=0`);
  process.exit(0);
} else if (failures <= 2 && blocked === 0) {
  console.log(`REVIEW -- ${checks.length - failures} checks tie exact; ${failures} non-zero delta(s) -- explain-or-fix required, see 124-REDERIVATION.md (ID FY2004 rounding is the known candidate)`);
  process.exit(2);
} else {
  console.log(`FAIL -- ${failures} of ${checks.length} checks have non-zero delta or errors (explain-or-fix per 124-01 Task 2); ${blocked} BLOCKED`);
  process.exit(2);
}
