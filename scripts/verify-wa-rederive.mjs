#!/usr/bin/env node
/**
 * verify-bainbridge-rederive.mjs — Task 9: loader-independent blind
 * re-derivation of every Bainbridge Island and Kitsap County General Fund
 * figure Treasury Tracker publishes, taken straight from the source WA SAO
 * PDFs and diffed leaf-for-leaf, subtotal-for-subtotal and total-for-total
 * against the live production DB.
 *
 * ── INDEPENDENCE RULE ───────────────────────────────────────────────────────
 * This file does NOT import, require, exec or shell out to
 *   scripts/lib/acfrGF.py, scripts/extractBainbridge.py,
 *   scripts/extractBainbridgeEarly.py, scripts/extractKitsap.py,
 *   scripts/lib/waSaoLoad.mjs
 * It re-reads each PDF with its OWN pdftotext calls and a from-scratch JS
 * parser. A harness that shares the extractor's code proves only that the
 * extractor agrees with itself: both sides of the comparison would be wrong in
 * the same direction and the diff would still read $0.
 *
 * The ONE thing this harness reads out of the extractor files is DATA, not
 * logic: the `source_rounding` dicts are parsed as TEXT with a regex (see
 * `loadRegisteredDeltas`) so the 33 registered document-rounding cases can be
 * asserted EXACTLY. No Python is executed and no Python logic is reused.
 *
 * ── TWO UNLIKE COLUMN READINGS, REQUIRED TO AGREE ───────────────────────────
 * v2.21 established that column alignment is issuer-dependent — Seattle
 * LEFT-aligns money, King County RIGHT-aligns it — so neither edge of a number
 * is a stable column key and keying on one silently DROPS 1-2 digit values.
 * This corpus is worse than that: it is internally inconsistent. Bainbridge
 * FY2004's General column right-aligns its 9-character values at col 223 and
 * its 7-character values at col 230, and Kitsap FY2008 scatters the same
 * column between col 44 and col 86 while the neighbouring County Roads column
 * starts at col 91 — i.e. the WITHIN-column spread is wider than the
 * BETWEEN-column gap.
 *
 * So the General Fund column is read twice, by two mechanisms that share no
 * input and no assumption, and the two readings must agree on EVERY row:
 *
 *   ORDINAL         `pdftotext -table`, then take the Nth cell counting back
 *                   from the RIGHT END of the row, where N is the column count
 *                   of that section's own Total row. Uses no coordinate at
 *                   all, so it cannot be fooled by alignment — and it is
 *                   immune to anything PREPENDED to a row, which is how it
 *                   independently shrugs off the SAO page-footer page number
 *                   that lands at column 0 of one data row per statement in
 *                   Bainbridge FY2004/2005/2007/2008 (the artifact the shared
 *                   library needed a dedicated
 *                   `_recover_label_past_leading_page_number` for).
 *
 *   CENTRE-IN-BAND  `pdftotext -lineprinter`, a DIFFERENT RENDERER MODE that
 *                   emits strict fixed-pitch/height output, i.e. TRUE physical
 *                   page geometry rather than `-table`'s reflowed grid.
 *                   Columns become bands bounded by the midpoints of the gaps
 *                   between the Total row's cells, and a token belongs to the
 *                   column whose band contains its CENTRE — alignment-agnostic
 *                   by construction. Characters arrive exploded
 *                   ("P r o p e r ty  t a x e s"), so they are re-assembled by
 *                   proximity before anything is read.
 *
 * FINDING, recorded because it is the reason for that renderer switch: a
 * centre-in-band reading of `-table` OUTPUT IS IMPOSSIBLE on this corpus. On
 * Kitsap FY2004-FY2016 `-table` renders the General Fund column in two
 * disjoint horizontal zones separated by a 20-column corridor while the gap to
 * the next fund's column is only 5 columns, so no coordinate rule — band,
 * cluster or whitespace corridor — can separate them. True page geometry can.
 * Both readings are compared row-by-row, label-by-label and value-by-value,
 * and ANY disagreement is a failure, not a preference.
 *
 * ── OTHER WAYS THIS READER DIFFERS FROM THE EXTRACTORS ──────────────────────
 *   statement page   The Python anchors on a per-city `statement_anchor`
 *                    regex supplied by config and takes the earliest
 *                    qualifying page. This scores every page STRUCTURALLY and
 *                    then asserts PAGE IDENTITY four independent ways (below).
 *                    Whitespace is normalised BEFORE the exclusion test, which
 *                    is precisely the defect Task 5 found in the library's
 *                    `_EXCLUDE`: its literal 'budget and actual' never matches
 *                    because `pdftotext` injects extra spaces, leaving
 *                    Budget-and-Actual schedules live candidates in Kitsap
 *                    FY2005-2014 and FY2021.
 *
 *   grouping         The Python takes explicit `parents` / `root_leaves` name
 *                    tuples, per city AND per era. This derives the tree from
 *                    ONE rule read off the statements themselves — GASB's
 *                    character classification (Current / Debt Service /
 *                    Capital Outlay): a row whose label is EXACTLY a character
 *                    word is a heading and opens a group; a row whose label
 *                    STARTS with a character word and carries a value closes
 *                    any open group and is a valued root leaf; anything else
 *                    is a child of the open group, or a root leaf if none is
 *                    open. That single rule reproduces all four distinct tree
 *                    shapes in this corpus with no per-era configuration.
 *                    Every label is then asserted by exact match against the
 *                    DB, so a wrong rule fails loudly.
 *
 *   units            The Python takes `units: 1` from a config dict. This
 *                    refuses to scale unless the page itself says "(in
 *                    thousands)" / "(in millions)", so the scale is evidence
 *                    rather than a setting — cross-checked by a per-capita
 *                    band, which (unlike the tie) is NOT unit-invariant.
 *
 * ── PAGE IDENTITY IS MANDATORY, FOR EVERY ROW ───────────────────────────────
 * Task 5 established the most serious finding of this milestone: THE $0 TIE
 * CANNOT DETECT WRONG-PAGE SELECTION. With Kitsap's `statement_anchor`
 * disabled, 10 of its 13 singular-titled years silently selected a different
 * fund's schedule and 9 of them STILL TIED AT $0 — FY2005 landed on County
 * Roads Budget-and-Actual ($29,279,443), FY2013 on the REET schedule
 * ($354,295). So every row here asserts, independently of any arithmetic:
 *   1. TITLE — the page's own caption is a Statement of Revenue(s),
 *      Expenditures and Changes in Fund Balance(s). Kitsap FY2004-FY2016
 *      title it "Statement of REVENUE" (SINGULAR); both spellings are handled.
 *   2. SCOPE — the caption says "Governmental Funds", and does NOT say
 *      budget / budgetary / combining / proprietary / fiduciary / internal
 *      service / agency funds, tested against WHITESPACE-NORMALISED text.
 *   3. COLUMN — the caption word "General" is centred over the SAME band, in
 *      true page geometry, that the values are read from. Not "the page
 *      mentions General somewhere": the caption has to sit over the column.
 *   4. MAGNITUDE — the re-derived total per resident falls inside a plausible
 *      band. Every silent wrong-page hit above lands far outside it
 *      (FY2005's County Roads = $101/resident, FY2013's REET = $1/resident).
 *   5. UNAMBIGUITY — EXACTLY ONE page survives the filters above.
 * A row that ties perfectly and fails any of these is a FAILURE.
 *
 * ── AMBIGUITY IS FATAL, NOT A WARNING — DO NOT DOWNGRADE THIS ───────────────
 * Assertion 5 is a BLOCKER, and that is deliberate. `findStatementPage` still
 * returns `cands[0]` when several pages survive, so one bad document produces a
 * full diagnostic instead of aborting the run — but `main()` counts every
 * ambiguous row as a blocker and the process exits non-zero.
 *
 * The reason is narrow and specific. Taking `cands[0]` IS the "the true
 * statement sorts earliest" assumption — the exact thin invariant Task 5
 * identified as the only thing protecting Kitsap in the shared library, and the
 * thing a future SAO reordering (basic statements after the individual-fund
 * schedules) would silently break. This harness's whole claim is that it does
 * NOT rely on that. If ambiguity were merely printed, a regressed document
 * would put the harness back on page ordering while it still exited 0 and still
 * printed a header saying it never does that — and the wrong-page failure mode
 * is the one this milestone proved TIES AT $0 AND LOOKS PERFECT (9 of 10 silent
 * wrong-page hits tied). A green run would then be evidence of nothing.
 *
 * It is currently 72/72 unambiguous, so this gate never fires on good data.
 * Kitsap's statement spans two pages and page 2 carries the identical title,
 * the identical "Governmental Funds" scope line and BOTH Total rows, so all 18
 * Kitsap years have two survivors before the last two filters run. MEASURED,
 * by disabling each filter in turn and re-running the whole corpus:
 *
 *   both filters on            0 ambiguous rows          exit 0
 *   CONTINUATION_RE off        0 ambiguous rows          exit 0
 *   GF_CAPTION_RE off          4 (FY2004 + FY2015 x2)    exit 1
 *   both off                   36 (all 18 Kitsap x2)     exit 1
 *
 * So `GF_CAPTION_RE` alone resolves all 18 years and `CONTINUATION_RE` alone
 * resolves 16 — FY2004 and FY2015 print no "Page 2 of N" on their second page.
 * `GF_CAPTION_RE` is therefore the load-bearing one on today's corpus;
 * `CONTINUATION_RE` is redundant here and is kept as the cheaper, more explicit
 * test that a future document is most likely to trip first. Do not read the
 * second row of that table as licence to delete it.
 *
 * The correct response to this gate firing is to TIGHTEN THE CANDIDATE FILTERS
 * until the document identifies its own statement page — never to relax the
 * gate, and never to add a tie-break rule.
 *
 * ── TOLERANCE ───────────────────────────────────────────────────────────────
 * Exact $0 on every grand total, subtotal and leaf, matched by label.
 * 33 of the 72 rows carry a REGISTERED `source_rounding` case: the source
 * document's own printed total disagrees with the sum of its own printed
 * components by $1 or $2, and the LOADED value is the component sum. For those
 * rows this harness (a) still requires the loaded total to tie at $0 against
 * the component sum, and (b) additionally requires
 * (component_sum - printed_total) to equal the registered delta EXACTLY. A
 * registration is never a tolerance: a case whose delta differs from its
 * registration FAILS.
 *
 * ── INDEPENDENT-DOCUMENT CROSS-CHECK ────────────────────────────────────────
 * Kitsap FY2020-FY2024 ONLY (5 of 18 Kitsap years = 10 of the 72 loaded rows)
 * are ALSO re-derived from the kitsap.gov copy — a physically different
 * document on a different host carrying the same statements. FY2017-FY2019 are
 * dropped years with no loaded rows; FY2016 and earlier are hosted on
 * kitsap.gov sectioned rather than as single PDFs. Bainbridge publishes no
 * second copy at all. A disagreement between the SAO copy and the kitsap.gov
 * copy is reported as a FINDING and is fatal — it is never reconciled by
 * preferring whichever agrees with the DB.
 *
 * Read-only against the DB. Network is used ONLY to fetch the five kitsap.gov
 * PDFs (cached on disk, so re-runs are offline; pass --offline to require the
 * cache). No AI calls. $0 spend.
 * Exit 0 iff every check passes.
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { verifiableEntities } from './lib/waRoster.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// --only <Name> restricts the run to one entity, so a single city can be
// re-checked during a batch without re-reading the whole corpus. It NARROWS
// the expected row count to match, so a filtered run can never look like a
// full one.
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg === -1 ? null : process.argv[onlyArg + 1];

// ── what is expected to be loaded ────────────────────────────────────────────
// The entity list comes from scripts/lib/waRoster.mjs, the single source of
// truth shared with the seeder, every loader and the other two harnesses.
// This file previously carried its own hardcoded copy; with eight WA entities
// that duplication is how a window drifts between the loader and its check.
//
// Windows and exclusions live in the roster with their evidence. Summary:
//   Bainbridge  FY2004-2025 less FY2006 (image scan), FY2009 (ciphered digits),
//               FY2010 (ciphered, money digits absent), FY2011 (CCITT scans)
//   Kitsap      FY2004-2024 less FY2017-2019 (digits absent), FY2025 (unaudited)
//   Tacoma      FY2003-2024 less FY2011/2018/2021 (no usable text layer),
//               FY2025 (only an opinion letter released)
//
// PER-CAPITA BANDS ARE THE ROSTER'S `verifyPerCapitaBand`, NOT its
// `perCapitaBand`. The loader's band is deliberately generous -- its job is to
// reject a 1000x units catastrophe. This harness needs a TIGHTER band because
// its job is different: catching a WRONG PAGE, whose per-capita lands far
// outside the entity's real spread while often sitting comfortably inside a
// units band. Every documented silent wrong-page hit from v2.22 is rejected by
// a wide margin:
//   Kitsap FY2005 County Roads Budget-and-Actual  $29,279,443 -> $101/resident
//   Kitsap FY2008 page 33                         $38,874,052 -> $135/resident
//   Kitsap FY2013 REET Budget-and-Actual             $354,295 -> $1.23/resident
//   Kitsap FY2014 page 43                            $304,600 -> $1.05/resident
// The largest is $135, well below Kitsap's $200 floor.
const ALL_ENTITIES = verifiableEntities().map((e) => ({
  key: e.name,
  lookup: { name: e.name, state: 'WA', entity_type: e.entityType },
  expectId: e.expectId,
  population: e.population,
  perCapitaBand: e.verifyPerCapitaBand,
  dir: path.join(ROOT, ...e.pdfDir.split('/')),
  pdf: (fy) => `${e.pdfPrefix}-${fy}-acfr.pdf`,
  fys: e.fiscalYears,
  roundingFiles: e.roundingFiles,
}));

if (ONLY && !ALL_ENTITIES.some((e) => e.key === ONLY)) {
  console.error(`--only "${ONLY}" matches no verifiable entity. Known: ${ALL_ENTITIES.map((e) => e.key).join(', ')}`);
  process.exit(2);
}
const ENTITIES = ONLY ? ALL_ENTITIES.filter((e) => e.key === ONLY) : ALL_ENTITIES;

/** Derived from the declared windows, never hardcoded: a narrowed window can
 *  then never produce a vacuously green run, and adding a city cannot leave a
 *  stale total behind. Cross-checked against the live row count in main(). */
const EXPECTED_TOTAL_ROWS = ENTITIES.reduce((s, e) => s + e.fys.length * 2, 0);

// The independent second copy. Different host, physically different documents.
const KITSAP_GOV_URLS = {
  2024: 'https://www.kitsap.gov/auditor/Documents/financial/2024_Kitsap_County_Annual%20Comprehensive_Financial_Report.pdf',
  2023: 'https://www.kitsap.gov/auditor/Documents/financial/2023_Kitsap_County_Annual_Comprehensive_Financial_Report.pdf',
  2022: 'https://www.kitsap.gov/auditor/Documents/financial/2022_Kitsap_County_ACFR.pdf',
  2021: 'https://www.kitsap.gov/auditor/Documents/financial/2021_Kitsap_County_ACFR_with_Bookmarks.pdf',
  2020: 'https://www.kitsap.gov/auditor/Documents/financial/2020_Kitsap_County_ACFR_with_Bookmarks.pdf',
};
const KITSAP_GOV_DIR = path.join(ROOT, 'docs', 'KitsapCountyGov');

// ═══════════════════════════════════════════════════════════════════════════
// Registered source_rounding deltas — read as DATA out of the extractor files.
//
// This parses the `.py` files as TEXT. Nothing is imported and no Python runs,
// so the isolation rule is intact: the harness borrows the REGISTRATION (which
// (fy, mode) pairs were adjudicated and to what exact delta) and none of the
// logic that produced it. Comment lines are stripped first, so the worked sums
// inside the comments can never be mistaken for entries.
// ═══════════════════════════════════════════════════════════════════════════
function loadRegisteredDeltas(files) {
  const deltas = new Map();       // "fy|mode" -> delta
  const provenance = new Map();   // "fy|mode" -> filename
  for (const f of files) {
    const src = readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
    const body = src.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
    // Matches a multi-line dict OR a single-line empty one (`source_rounding={},`).
    // AN EMPTY REGISTRY IS LEGITIMATE and must not be conflated with a missing
    // one. Tacoma registers zero residues because it prints IN THOUSANDS: its
    // components are already rounded to the thousand and sum exactly, so the
    // sub-dollar artifacts that produce residues cannot arise. The guard that
    // matters is still enforced -- a file with no `source_rounding` key at all
    // throws, because that means the harness is reading the wrong file or the
    // registry was deleted out from under it.
    const m = body.match(/source_rounding\s*=\s*\{([\s\S]*?)\}/);
    if (!m) throw new Error(`${f}: no source_rounding dict found — refusing to verify without the registrations`);
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
// PDF text — own pdftotext passes
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

const lpCache = new Map();
function linePrinterPage(pdfPath, pageNo) {
  const k = `${pdfPath}|${pageNo}`;
  if (lpCache.has(k)) return lpCache.get(k);
  const txt = execFileSync('pdftotext',
    ['-lineprinter', '-f', String(pageNo), '-l', String(pageNo), pdfPath, '-'],
    { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  lpCache.set(k, txt);
  return txt;
}

// ═══════════════════════════════════════════════════════════════════════════
// Own tokenizer for `-table` output. A dash run counts as a cell placeholder
// only when flanked by whitespace, so a hyphen inside a label ("Debt Service -
// Principal", "long-term", "COVID-19") is never mistaken for a column.
// Parenthesised runs are negative.
// ═══════════════════════════════════════════════════════════════════════════
const TOKEN_RE = /\(\s*\d[\d,]*\s*\)|\d[\d,]*|(?<=^|\s)[-–—]+(?=\s|$)/g;
const DASH_ONLY = /^[-–—]+$/;

function tokensOf(line) {
  const out = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const raw = m[0];
    if (DASH_ONLY.test(raw)) { out.push({ kind: 'dash', value: 0, start: m.index, end: m.index + raw.length, raw }); continue; }
    const neg = raw.trim().startsWith('(');
    const digits = raw.replace(/[(),\s]/g, '');
    if (!/^\d+$/.test(digits)) continue;
    out.push({ kind: 'money', value: neg ? -Number(digits) : Number(digits), start: m.index, end: m.index + raw.length, raw });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Own statement-page finder + page-identity assertions.
// ═══════════════════════════════════════════════════════════════════════════
// Kitsap FY2004-FY2016 print "Statement of REVENUE, Expenditures..." (singular).
const TITLE_RE = /statement\s+of\s+revenues?\s*,?\s*(and\s+)?expenditures/i;
const CHANGES_RE = /changes?\s+in\s+fund\s+balances?/i;
// `govern?mental` tolerates a SOURCE-DOCUMENT TYPO, not a parser convenience:
// Tacoma's FY2007 statement caption reads "Govermental Funds", missing the 'n'.
// Rejecting that page would have silently dropped a year that is otherwise
// perfectly readable, and "the scope line is misspelled" is not a reason to
// refuse a filing. The optional 'n' cannot match anything else meaningful.
const GOVFUNDS_RE = /govern?mental\s+funds/i;
const TOTAL_REV_RE = /^total\s+(operating\s+)?revenues?\b/i;
const TOTAL_EXP_RE = /^total\s+expenditures\b/i;
const REV_HEAD_RE = /^revenues?\b/i;
const EXP_HEAD_RE = /^expenditures\b/i;

// PAGE-TYPE exclusions, applied to WHITESPACE-NORMALISED caption text. The
// normalisation is the whole point: the shared library's literal
// 'budget and actual' test never fires because `pdftotext` renders the phrase
// as "- Budget and                   Actual", which is exactly why every
// individual-fund Budget-and-Actual schedule in Kitsap FY2005-2014 and FY2021
// is a live candidate over there. `\bbudget` also catches "Budgetary
// Comparison Schedule" and any Budget / Actual / Variance column caption.
const EXCLUDE_RE = /\b(combining|budget|budgetary|proprietary|fiduciary|internal\s+service|agency\s+funds|net\s+position|reconciliation|cash\s+flows)\b/i;
// Kitsap splits its statement across two pages. Page 2 carries the IDENTICAL
// title, the identical "Governmental Funds" scope line and BOTH Total rows —
// so without these two tests it is a live second candidate on all 18 Kitsap
// years and the selection would rest on "the true page happens to sort first",
// the exact thin invariant Task 5 warned about. Page 2 declares itself, and it
// carries no General Fund column caption. Both are checked.
const CONTINUATION_RE = /\bpage\s*([2-9]|\d\d+)\s*of\s*\d/i;
// The lookahead is `government\b`, NOT the shorter `govern`, and the difference
// is load-bearing. Its purpose is to stop the expenditure function "General
// Government" from being mistaken for a General Fund column caption. The
// original `(?!\s+govern)` also rejected "General Governmental" -- and Tacoma's
// FY2003 caption is exactly that, because its General Fund column header sits
// next to an "Other Governmental" one and flattens to
// "(0010) General Governmental Governmental Fund Funds Funds".
// That false negative dropped FY2003-FY2005 entirely.
//
// `\bgovernment\b` cannot match inside "governmental" (no word boundary before
// the "al"), so this still rejects "General Government" exactly as before while
// accepting a caption whose NEIGHBOURING column happens to be Governmental.
const GF_CAPTION_RE = /\bgeneral\b(?!\s+government\b)/i;

/** The caption block: everything down to and including the first section
 *  header line. Column captions live here, and so does every page-type word. */
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
  // `cands[0]` is returned so the rest of the run can still produce a full
  // diagnostic instead of aborting on the first ambiguous document — but a
  // count > 1 is made a BLOCKER in main(), never a warning. See the
  // "AMBIGUITY IS FATAL" note in the file header for why that is not
  // negotiable: taking cands[0] IS the page-ordering assumption this harness
  // claims never to rely on, and the wrong-page failure mode ties at $0.
  return { index: cands[0], text: pages[cands[0]], allCandidates: cands };
}

/** Assert the page belongs to the fiscal year the filename claims. Without
 *  this, document<->FY binding is by FILENAME alone, and a consistently
 *  mis-named local file would tie at $0 against a DB loaded from the same
 *  mis-named file. Kitsap's text layer collapses spaces
 *  ("FortheYearEndedDecember31,2024"), so the gaps are all optional. */
function assertPageYear(pageText, fy, label) {
  const flat = pageText.replace(/\s+/g, ' ');
  const period = flat.match(/year\s*ended\s*december\s*3\s*1\s*,?\s*(\d{4})/i);
  if (period) {
    if (Number(period[1]) !== fy) throw new Error(`${label}: page states "${period[0].trim()}" but the file is being read as FY${fy}`);
    return `period sentence "${period[0].trim()}"`;
  }
  const p2 = flat.replace(/\s+/g, '').match(/YearEndedDecember31,?(\d{4})/i);
  if (p2) {
    if (Number(p2[1]) !== fy) throw new Error(`${label}: page states year ended December 31, ${p2[1]} but the file is being read as FY${fy}`);
    return `period sentence (space-collapsed) "${p2[0]}"`;
  }
  throw new Error(`${label}: page carries no evidence it is FY${fy} — refusing to trust the filename alone`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Own units detection — read off the page, never configured.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * ⚠ THE MOST DANGEROUS FUNCTION IN THIS FILE TO GET WRONG.
 *
 * The tie gate is unit-invariant, so a missed multiplier does not fail
 * arithmetic anywhere -- it just makes every figure 1000x wrong. Only the
 * per-capita band catches it, and only if the band is tight enough.
 *
 * The original pair of patterns matched Bainbridge/Kitsap ("whole dollars", so
 * neither fires) and Seattle/King County ("(in thousands)"). Tacoma writes
 * "(amounts expressed in thousands)", which matched NEITHER, so this returned 1
 * and the harness read Tacoma's statements as whole dollars -- 1000x below the
 * database it was checking. It would have reported a disagreement rather than
 * passing wrongly, but the disagreement would have looked like a load defect
 * instead of a units-detection gap.
 *
 * The broadened alternative is a bare `in thousands`, deliberately: every
 * phrasing of that caption means the same thing, and no statement says it
 * without meaning it. It also absorbs Tacoma FY2003's genuine typo,
 * "(amounts expresssed in thousands)" with three s's, because the typo is in
 * the word this pattern does not depend on.
 */
function unitsOf(pageText) {
  const flat = pageText.replace(/\s+/g, ' ');
  if (/\bin\s+millions\b/i.test(flat)) return 1_000_000;
  if (/\bin\s+thousands\b/i.test(flat)) return 1_000;
  return 1;   // whole dollars — cross-checked by the per-capita band, which is NOT unit-invariant
}

// ═══════════════════════════════════════════════════════════════════════════
// READING 1 — ORDINAL, on `pdftotext -table`.
// The Nth cell counting back from the RIGHT END of the row, N = the column
// count of the section's own Total row. No coordinate is used anywhere.
// ═══════════════════════════════════════════════════════════════════════════
const normLabel = (s) => s.replace(/\s+/g, ' ').trim().replace(/[:$\s]+$/, '').trim();

/**
 * Label = the row text left of the chosen cell, minus THREE page decorations the
 * SAO's own binding glues onto data rows:
 *   • a leading page-footer PAGE NUMBER — a bare 1-4 digit run followed by a
 *     genuine 2+ space gap and then a letter. "911 Dispatch" and "4Culture"
 *     have no such gap and are untouched.
 *   • a RENDERED HORIZONTAL RULE drawn in the left margin, three or more
 *     underscores followed by a genuine 2+ space gap and then a letter.
 *     Confirmed on Bainbridge FY2013 revenue, where the "Interest and
 *     Investment Revenue" row carries a 49-underscore rule and shipped to the
 *     database under that name. The FIGURE was always right and the row tied at
 *     $0 — this is a LABEL corruption of the dash-zero class, invisible to every
 *     arithmetic gate, which is why it survived to production. A label that
 *     merely CONTAINS an underscore ("Fund_Balance") has no margin-anchored run
 *     and no column gap after it, so it is untouched.
 *   • the page-footer credit line "Washington State Auditor's Office", which
 *     `-table` flattens onto the front of whichever data row shares its
 *     physical output row.
 */
function cleanLabel(text) {
  let s = text.replace(/^\s*\d{1,4}(?=\s{2,}\S)/, ' ');
  s = s.replace(/^\s*_{3,}(?=\s{2,}[A-Za-z])/, ' ');
  s = normLabel(s);
  return s.replace(/^Washington State Auditor'?s Office\s*/i, '').trim();
}

/** A header/wrap row's label: the row with every money-ish token removed, so a
 *  stray dash printed on a heading line ("Debt service    -") cannot corrupt
 *  the heading's name. */
function headerLabel(line) {
  const toks = tokensOf(line);
  let s = line;
  for (let i = toks.length - 1; i >= 0; i--) s = s.slice(0, toks[i].start) + ' '.repeat(toks[i].end - toks[i].start) + s.slice(toks[i].end);
  return cleanLabel(s);
}

function readRowOrdinal(line, ncols) {
  const toks = tokensOf(line);
  if (toks.length < ncols) return { kind: 'header', label: headerLabel(line) };
  const tok = toks[toks.length - ncols];
  return { kind: 'cell', value: tok.value, label: cleanLabel(line.slice(0, tok.start)), at: tok.start };
}

// ═══════════════════════════════════════════════════════════════════════════
// READING 2 — CENTRE-IN-BAND, on `pdftotext -lineprinter` (TRUE geometry).
// `-lineprinter` emits strict fixed-pitch output, one output column per
// physical position, so a token's x-range is the real x-range on the page.
// Characters arrive exploded, so they are re-assembled by proximity first.
// ═══════════════════════════════════════════════════════════════════════════
const LP_MAX_CHAR_GAP = 5;   // widest gap inside one rendered word/number in this corpus

function lpGroups(line) {
  const g = [];
  let cur = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\f') continue;
    if (cur && i - cur.last <= LP_MAX_CHAR_GAP) { cur.text += ch; cur.last = i; }
    else { cur = { text: ch, start: i, last: i }; g.push(cur); }
  }
  return g.map((x) => ({ text: x.text, start: x.start, end: x.last + 1 }));
}

const LP_MONEY_RE = /^\(?\$?[\d][\d,]*\)?$/;

/**
 * Drop the LEFT-MARGIN PAGE DECORATION.
 *
 * The WA SAO stamps "Washington State Auditor's Office" ROTATED down the left
 * edge of every bound page, so `-lineprinter` — which renders true physical
 * position — puts ONE character of it at the far left of many data rows, plus
 * a rule-line underscore. Those fragments would otherwise glue onto the front
 * of the row's real label ("h" + "General government", "W_" + "Judicial",
 * "S" + "REVENUES"), which breaks both the label comparison and the section
 * header match. Only LEADING groups of at most two non-digit characters are
 * removed — every real label word in this corpus is longer than that, and a
 * money cell can never match, so no value and no real label word can be lost.
 */
const MARGIN_FRAGMENT_RE = /^[A-Za-z'_.,]{1,2}$/;
function stripLeftMarginDecoration(groups) {
  let i = 0;
  while (i < groups.length - 1 && MARGIN_FRAGMENT_RE.test(groups[i].text)) i++;
  return groups.slice(i);
}

function lpSplit(line) {
  const gs = lpGroups(line);
  const cells = [];
  const labelParts = [];
  for (const g of stripLeftMarginDecoration(gs)) {
    if (DASH_ONLY.test(g.text)) { cells.push({ value: 0, start: g.start, end: g.end, raw: g.text }); continue; }
    if (LP_MONEY_RE.test(g.text) && /\d/.test(g.text)) {
      const neg = g.text.startsWith('(');
      const digits = g.text.replace(/[($),]/g, '');
      if (/^\d+$/.test(digits)) { cells.push({ value: neg ? -Number(digits) : Number(digits), start: g.start, end: g.end, raw: g.text }); continue; }
    }
    labelParts.push(g.text);
  }
  return { cells, label: labelParts.join('') };
}

/** Bands bounded by the midpoints of the gaps between the Total row's cells;
 *  a token belongs to the column whose band contains its CENTRE. */
function lpBands(cells, label) {
  const t = [...cells].sort((a, b) => a.start - b.start);
  if (t.length < 2) throw new Error(`${label}: -lineprinter Total row exposes ${t.length} column(s)`);
  return t.map((c, k) => ({
    left: k === 0 ? t[0].start - (t[1].start - t[0].start) / 2 : (t[k - 1].end + t[k].start) / 2,
    right: k === t.length - 1 ? Infinity : (t[k].end + t[k + 1].start) / 2,
  }));
}

/** Comparison key for a label: alphanumerics only, lowercased, with the SAO
 *  page-footer credit removed. Makes `-table`'s "Interest and other charges"
 *  and `-lineprinter`'s "Interestandothercharges" the same string. */
const labelKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
  .replace(/^washingtonstateauditorsoffice/, '');

/**
 * Read a whole section (revenue or operating) off the -lineprinter rendering.
 * Returns the ORDERED sequence of valued rows plus the printed total, so it can
 * be compared element-for-element with the ordinal reading.
 */
function lpSection(pdfPath, pageNo, mode, label) {
  const lines = linePrinterPage(pdfPath, pageNo).split('\n');
  const split = lines.map(lpSplit);
  const isTotal = (k) => mode === 'revenue' ? /^total(operating)?revenues?$/.test(k) : /^totalexpenditures$/.test(k);
  const isHead = (k) => mode === 'revenue' ? /^revenues?$/.test(k) : /^expenditures$/.test(k);

  const totalIdx = split.findIndex((s) => isTotal(labelKey(s.label)) && s.cells.length);
  if (totalIdx < 0) throw new Error(`${label}: -lineprinter found no "Total ${mode === 'revenue' ? 'revenues' : 'expenditures'}" row`);
  const bands = lpBands(split[totalIdx].cells, label);
  const pick = (cells) => cells.filter((c) => (c.start + c.end) / 2 >= bands[0].left && (c.start + c.end) / 2 < bands[0].right);

  const totalPick = pick(split[totalIdx].cells);
  if (totalPick.length !== 1) throw new Error(`${label}: -lineprinter Total row has ${totalPick.length} cells in the General Fund band`);

  let headIdx = -1;
  for (let i = totalIdx - 1; i >= 0; i--) {
    if (isHead(labelKey(split[i].label)) && !pick(split[i].cells).length) { headIdx = i; break; }
  }
  if (headIdx < 0) throw new Error(`${label}: -lineprinter found the Total row but no ${mode} section header above it`);

  const rows = [];
  for (let i = headIdx + 1; i < totalIdx; i++) {
    const s = split[i];
    if (!s.label && !s.cells.length) continue;
    const p = pick(s.cells);
    if (p.length > 1) throw new Error(`${label}: -lineprinter row "${s.label}" has ${p.length} cells inside the General Fund band`);
    if (!p.length) continue;               // heading or a row with no GF cell
    // Same heading rule the ordinal side applies: a row whose label is EXACTLY
    // a GASB character word and whose value is zero is a HEADING, not a data
    // row — Kitsap FY2011/2012/2013 print a dash in the General Fund column on
    // their "Debt service" heading line, which the two renderers place
    // differently. Applying the identical rule on both sides keeps the two
    // sequences comparable without either side special-casing the other.
    if (/^(current|debtservice|capitaloutlay)$/.test(labelKey(s.label)) && p[0].value === 0) continue;
    rows.push({ label: s.label, value: p[0].value });
  }

  // PAGE IDENTITY 3 — the "General" caption must sit over this very band. The
  // caption block always ends at the FIRST section header (the revenue one),
  // whichever section is being read, so the operating pass cannot satisfy this
  // from text inside the revenue section.
  let captEnd = split.findIndex((s) => /^revenues?$/.test(labelKey(s.label)) && !pick(s.cells).length);
  if (captEnd < 0 || captEnd > headIdx) captEnd = headIdx;
  const capt = [];
  for (let i = 0; i < captEnd; i++) {
    for (const g of lpGroups(lines[i])) {
      const c = (g.start + g.end) / 2;
      if (c >= bands[0].left && c < bands[0].right) capt.push(g.text);
    }
  }
  const gfCaption = capt.join(' ');
  if (!/general/i.test(gfCaption)) {
    throw new Error(`${label}: no "General" caption sits over the column being read ` +
      `(true-geometry band ${bands[0].left.toFixed(1)}..${bands[0].right.toFixed(1)} is captioned "${gfCaption || '(nothing)'}")`);
  }

  return { rows, printed: totalPick[0].value, gfCaption, band: [bands[0].left, bands[0].right] };
}

// ═══════════════════════════════════════════════════════════════════════════
// Section bounds on the `-table` rendering: find the Total row, then scan
// BACKWARD to its own header. The document title contains BOTH section words,
// so requiring the header not to contain the other section word makes the
// title unmatchable by construction.
// ═══════════════════════════════════════════════════════════════════════════
function sectionOf(lines, mode, label) {
  const totalRe = mode === 'revenue' ? TOTAL_REV_RE : TOTAL_EXP_RE;
  const headRe = mode === 'revenue' ? REV_HEAD_RE : EXP_HEAD_RE;
  const otherWord = mode === 'revenue' ? /expenditures/i : /revenues?\b/i;

  const totalIdx = lines.findIndex((l) => totalRe.test(l.trim()));
  if (totalIdx < 0) throw new Error(`${label}: no "Total ${mode === 'revenue' ? 'revenues' : 'expenditures'}" row`);
  const ncols = tokensOf(lines[totalIdx]).length;
  if (ncols < 2) throw new Error(`${label}: the Total row exposes ${ncols} column(s); cannot establish a General Fund column`);

  let headIdx = -1;
  for (let i = totalIdx - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!headRe.test(t)) continue;
    if (otherWord.test(t)) continue;
    if (/statement/i.test(t)) continue;
    if (readRowOrdinal(lines[i], ncols).kind === 'cell') continue;   // a wrapped label, not a header
    headIdx = i;
    break;
  }
  if (headIdx < 0) throw new Error(`${label}: found the Total row but no ${mode} section header above it`);
  return { body: lines.slice(headIdx + 1, totalIdx), totalLine: lines[totalIdx], ncols };
}

// ═══════════════════════════════════════════════════════════════════════════
// Own tree builder — ONE rule, GASB's character classification.
// ═══════════════════════════════════════════════════════════════════════════
// `capital expenditures` is Tacoma's Era-B (FY2012-FY2017) spelling of the same
// root-level line every other entity calls `capital outlay`. Without it the
// reader left the `Debt service:` group open and nested Capital expenditures
// inside it -- amounts identical, structure wrong, which is exactly the class
// of defect a $0 tie cannot see.
//
// Settled from `pdftotext -layout`, which preserves the indentation `-table`
// flattens (FY2015 p.34): `Current:` and `Debt service:` both sit at 3 spaces
// with their children at 6, and `Capital expenditures` sits at 3 -- a root peer,
// not a child. The extractor already had it right via root_leaves; this brings
// the independent reader into agreement with the document rather than with the
// extractor.
const CHARACTER_EXACT = /^(current|debt\s+service|capital\s+outlay|capital\s+expenditures)$/i;
const CHARACTER_START = /^(current|debt\s+service|capital\s+outlay|capital\s+expenditures)\b/i;

function buildOperating(body, ncols, scale, rawRows) {
  const roots = [];
  let open = null;
  let pending = '';
  for (const line of body) {
    if (!line.trim()) continue;
    const r = readRowOrdinal(line, ncols);
    // A row whose label is EXACTLY a character word is a HEADING, whether or
    // not the renderer put a stray dash on it. (Kitsap FY2013 prints a dash in
    // the General Fund column on its "Debt service" heading row.) A heading
    // carrying a NON-ZERO value would be a real root leaf and is handled below.
    const asHeading = headerLabel(line);
    if (CHARACTER_EXACT.test(asHeading) && (r.kind === 'header' || r.value === 0)) {
      open = { label: asHeading, children: [] };
      roots.push(open);
      pending = '';
      continue;
    }
    if (r.kind === 'header') {
      if (r.label) pending = normLabel(`${pending} ${r.label}`);
      continue;
    }
    rawRows.push({ label: r.label, value: r.value });
    const full = pending ? normLabel(`${pending} ${r.label}`) : r.label;
    pending = '';
    if (!full) throw new Error(`row with a General Fund value but no label: "${line.trim().slice(0, 90)}"`);
    if (CHARACTER_START.test(full)) {
      open = null;
      roots.push({ label: full, children: [{ label: full, value: scale(r.value) }] });
      continue;
    }
    const child = { label: full, value: scale(r.value) };
    if (open) open.children.push(child);
    else roots.push({ label: full, children: [child] });
  }
  return roots;
}

/** Both issuers print a FLAT revenue side — no `Taxes:` parent row. Every
 *  valued row is its own root; a row with no cell is a wrapped label fragment
 *  carried onto the next valued row. If either issuer ever prints a revenue
 *  group header, the label comparison against the DB fails loudly. */
function buildRevenue(body, ncols, scale, rawRows) {
  const roots = [];
  let pending = '';
  for (const line of body) {
    if (!line.trim()) continue;
    const r = readRowOrdinal(line, ncols);
    if (r.kind === 'header') { if (r.label) pending = normLabel(`${pending} ${r.label}`); continue; }
    rawRows.push({ label: r.label, value: r.value });
    const full = pending ? normLabel(`${pending} ${r.label}`) : r.label;
    pending = '';
    if (!full) throw new Error(`row with a General Fund value but no label: "${line.trim().slice(0, 90)}"`);
    roots.push({ label: full, children: [{ label: full, value: scale(r.value) }] });
  }
  return roots;
}

/** Drop zero leaves and then empty roots — what the app stores. */
function prune(roots) {
  const kept = [];
  const droppedLeaves = [];
  const droppedRoots = [];
  for (const r of roots) {
    const children = r.children.filter((c) => {
      if (c.value === 0) { droppedLeaves.push(`${r.label} / ${c.label}`); return false; }
      return true;
    });
    if (!children.length) { droppedRoots.push(r.label); continue; }
    kept.push({ label: r.label, amount: children.reduce((s, c) => s + c.value, 0), children });
  }
  return { roots: kept, droppedLeaves, droppedRoots };
}

// ═══════════════════════════════════════════════════════════════════════════
function rederive(pdfPath, fy, mode, label, band, population) {
  const pages = tablePages(pdfPath);
  const page = findStatementPage(pages, label);
  const yearEvidence = assertPageYear(page.text, fy, label);
  const units = unitsOf(page.text);
  const scale = (v) => v * units;
  const lines = page.text.split('\n');
  const { body, totalLine, ncols } = sectionOf(lines, mode, label);

  const rawRows = [];
  const built = mode === 'revenue'
    ? buildRevenue(body, ncols, scale, rawRows)
    : buildOperating(body, ncols, scale, rawRows);
  const { roots, droppedLeaves, droppedRoots } = prune(built);

  const totalRow = readRowOrdinal(totalLine, ncols);
  if (totalRow.kind !== 'cell') throw new Error(`${label}: the Total row has no General Fund cell`);

  // ── the second, geometric reading, and the agreement requirement ──────────
  const lp = lpSection(pdfPath, page.index + 1, mode, label);
  const columnDisagreements = [];
  if (lp.rows.length !== rawRows.length) {
    columnDisagreements.push(`row count: ordinal(-table)=${rawRows.length} vs centre-in-band(-lineprinter)=${lp.rows.length}` +
      ` [ordinal: ${rawRows.map((r) => r.label).join(' | ')}] [geometric: ${lp.rows.map((r) => r.label).join(' | ')}]`);
  }
  for (let i = 0; i < Math.min(rawRows.length, lp.rows.length); i++) {
    const a = rawRows[i], b = lp.rows[i];
    if (labelKey(a.label) !== labelKey(b.label)) {
      columnDisagreements.push(`row ${i}: ordinal label "${a.label}" vs geometric label "${b.label}"`);
    }
    if (a.value !== b.value) {
      columnDisagreements.push(`row ${i} "${a.label}": ordinal(-table)=${a.value} vs centre-in-band(-lineprinter)=${b.value}`);
    }
  }
  if (totalRow.value !== lp.printed) {
    columnDisagreements.push(`printed total: ordinal(-table)=${totalRow.value} vs centre-in-band(-lineprinter)=${lp.printed}`);
  }

  const computedTotal = roots.reduce((s, r) => s + r.amount, 0);
  const printedTotal = scale(totalRow.value);
  const perCapita = computedTotal / population;
  const [lo, hi] = band;
  const identityProblems = [];
  if (perCapita < lo || perCapita > hi) {
    identityProblems.push(`PAGE IDENTITY (magnitude): $${perCapita.toFixed(2)}/resident is outside the plausible band [${lo}, ${hi}] — the signature of a wrong-page selection, which a $0 tie cannot detect`);
  }

  return {
    label, pdfPath, pageNumber: page.index + 1, units, yearEvidence,
    candidates: page.allCandidates.length, allCandidates: page.allCandidates.map((i) => i + 1),
    gfCaption: lp.gfCaption, gfBand: lp.band, ncols,
    roots, columnDisagreements, identityProblems, perCapita,
    computedTotal, printedTotal, rowsRead: rawRows.length,
    leaves: roots.flatMap((r) => r.children.map((c) => ({ root: r.label, label: c.label, value: c.value }))),
    droppedLeaves, droppedRoots,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DB side (read-only)
// ═══════════════════════════════════════════════════════════════════════════
async function dbTree(muniId, fy, mode) {
  const { data: b, error: be } = await sb.from('budgets')
    .select('id,total_budget,source_url,data_source').eq('municipality_id', muniId)
    .eq('fiscal_year', fy).eq('dataset_type', mode).maybeSingle();
  if (be) throw new Error(`budgets query failed: ${be.message}`);
  if (!b) return null;
  const { data: cats, error: ce } = await sb.from('budget_categories')
    .select('id,name,amount,sort_order').eq('budget_id', b.id).order('sort_order');
  if (ce) throw new Error(`budget_categories query failed: ${ce.message}`);
  const { data: items, error: ie } = await sb.from('budget_line_items')
    .select('id,category_id,description,actual_amount').in('category_id', cats.map((c) => c.id));
  if (ie) throw new Error(`budget_line_items query failed: ${ie.message}`);
  const byCat = new Map(cats.map((c) => [c.id, []]));
  for (const it of items) byCat.get(it.category_id).push(it);
  return {
    total: Number(b.total_budget),
    sourceUrl: b.source_url, dataSource: b.data_source,
    roots: cats.map((c) => ({
      label: c.name,
      amount: Number(c.amount),
      children: byCat.get(c.id).map((it) => ({ label: it.description, value: Number(it.actual_amount) })),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Comparison — exact, ordered, label-aware
// ═══════════════════════════════════════════════════════════════════════════
const key = (s) => normLabel(String(s)).toLowerCase();

function compare(ind, db, registeredDelta) {
  const problems = [...ind.identityProblems];
  for (const d of ind.columnDisagreements) problems.push(`COLUMN READING DISAGREEMENT — ${d}`);

  // 1. The loaded total must equal the COMPONENT SUM. Always $0, registered or not.
  if (db.total !== ind.computedTotal) {
    problems.push(`GRAND TOTAL vs COMPONENT SUM: db=${db.total} pdf=${ind.computedTotal} delta=${db.total - ind.computedTotal}`);
  }

  // 2. The document's own internal residue, adjudicated against its registration.
  const residue = ind.computedTotal - ind.printedTotal;   // computed - printed: source_rounding's own sign convention
  if (registeredDelta === undefined) {
    if (residue !== 0) {
      problems.push(`UNREGISTERED RESIDUE: component sum ${ind.computedTotal} != printed total ${ind.printedTotal} (delta ${residue > 0 ? '+' : ''}${residue}) and no source_rounding entry exists for this (fy, mode)`);
    }
  } else if (residue !== registeredDelta) {
    problems.push(`REGISTERED DELTA MISMATCH: registered ${registeredDelta > 0 ? '+' : ''}${registeredDelta}, observed ${residue > 0 ? '+' : ''}${residue} (component sum ${ind.computedTotal}, printed total ${ind.printedTotal}) — a registration is an EXACT delta, never a tolerance`);
  }

  // 3. The DB row must tie against its own line items.
  const dbLeafSum = db.roots.reduce((s, r) => s + r.children.reduce((x, c) => x + c.value, 0), 0);
  if (dbLeafSum !== db.total) problems.push(`DB SELF-CONSISTENCY: total_budget=${db.total} but its own line items sum to ${dbLeafSum}`);
  for (const r of db.roots) {
    const s = r.children.reduce((x, c) => x + c.value, 0);
    if (s !== r.amount) problems.push(`DB SELF-CONSISTENCY: category "${r.label}" amount=${r.amount} but its items sum to ${s}`);
  }
  if (!db.sourceUrl) problems.push('DB row carries no source_url');
  if (!db.dataSource) problems.push('DB row carries no data_source label');

  // 4. Subtotals, in order.
  const a = ind.roots, b = db.roots;
  if (a.length !== b.length) {
    problems.push(`SUBTOTAL COUNT: pdf=${a.length} [${a.map((r) => r.label).join(' | ')}] db=${b.length} [${b.map((r) => r.label).join(' | ')}]`);
  }
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (!x || !y) { problems.push(`SUBTOTAL[${i}]: pdf=${x ? x.label : '(none)'} db=${y ? y.label : '(none)'}`); continue; }
    if (key(x.label) !== key(y.label)) problems.push(`SUBTOTAL[${i}] LABEL: pdf="${x.label}" db="${y.label}"`);
    if (x.amount !== y.amount) problems.push(`SUBTOTAL[${i}] "${y.label}": pdf=${x.amount} db=${y.amount} delta=${y.amount - x.amount}`);
  }

  // 5. Leaves, matched by (root, label).
  const al = ind.leaves;
  const bl = db.roots.flatMap((r) => r.children.map((c) => ({ root: r.label, label: c.label, value: c.value })));
  const index = (arr, side) => {
    const m = new Map();
    for (const x of arr) {
      const k = `${key(x.root)} ␟ ${key(x.label)}`;
      if (m.has(k)) problems.push(`DUPLICATE LEAF on the ${side} side: "${x.root} / ${x.label}"`);
      m.set(k, x);
    }
    return m;
  };
  const am = index(al, 'pdf'), bm = index(bl, 'db');
  if (al.length !== bl.length) problems.push(`LEAF COUNT: pdf=${al.length} db=${bl.length}`);
  for (const [k, x] of am) {
    const y = bm.get(k);
    if (!y) { problems.push(`LEAF ONLY IN PDF: "${x.root} / ${x.label}" = ${x.value}`); continue; }
    if (x.value !== y.value) problems.push(`LEAF "${x.root} / ${x.label}": pdf=${x.value} db=${y.value} delta=${y.value - x.value}`);
  }
  for (const [k, y] of bm) if (!am.has(k)) problems.push(`LEAF ONLY IN DB: "${y.root} / ${y.label}" = ${y.value}`);
  return problems;
}

// ═══════════════════════════════════════════════════════════════════════════
// Independent-document cross-check (Kitsap FY2020-FY2024 only)
// ═══════════════════════════════════════════════════════════════════════════
async function fetchKitsapGov(fy) {
  mkdirSync(KITSAP_GOV_DIR, { recursive: true });
  const dest = path.join(KITSAP_GOV_DIR, `kitsapgov-${fy}-acfr.pdf`);
  if (existsSync(dest) && statSync(dest).size > 200_000) return { dest, cached: true };
  if (OFFLINE) throw new Error(`--offline and no cached copy at ${dest}`);
  const res = await fetch(KITSAP_GOV_URLS[fy], {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TreasuryTracker-verify/1.0' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`GET ${KITSAP_GOV_URLS[fy]} -> HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200_000 || buf.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error(`GET ${KITSAP_GOV_URLS[fy]} -> ${buf.length} bytes, not a PDF`);
  }
  writeFileSync(dest, buf);
  return { dest, cached: false };
}

function crossCompare(sao, gov) {
  const problems = [];
  if (sao.computedTotal !== gov.computedTotal) {
    problems.push(`COMPONENT SUM: sao=${sao.computedTotal} kitsap.gov=${gov.computedTotal} delta=${gov.computedTotal - sao.computedTotal}`);
  }
  if (sao.printedTotal !== gov.printedTotal) {
    problems.push(`PRINTED TOTAL: sao=${sao.printedTotal} kitsap.gov=${gov.printedTotal} delta=${gov.printedTotal - sao.printedTotal}`);
  }
  const sm = new Map(sao.leaves.map((x) => [`${key(x.root)} ␟ ${key(x.label)}`, x.value]));
  const gm = new Map(gov.leaves.map((x) => [`${key(x.root)} ␟ ${key(x.label)}`, x.value]));
  for (const [k, v] of sm) {
    if (!gm.has(k)) { problems.push(`LEAF ONLY IN THE SAO COPY: "${k}" = ${v}`); continue; }
    if (gm.get(k) !== v) problems.push(`LEAF "${k}": sao=${v} kitsap.gov=${gm.get(k)}`);
  }
  for (const [k, v] of gm) if (!sm.has(k)) problems.push(`LEAF ONLY IN THE KITSAP.GOV COPY: "${k}" = ${v}`);
  return problems;
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('=== WA SAO independent re-derivation (loader-independent) ===');
  console.log(`DB: ${SUPABASE_URL}  (READ-ONLY — this harness never writes)`);
  console.log('Extractor imports: NONE. Own `pdftotext -table` + `pdftotext -lineprinter` passes and own JS parser.');
  console.log('acfrGF.py / every extract*.py / waSaoLoad.mjs are NOT imported, required or executed.\n');

  let blockers = 0;
  let combos = 0;
  const rows = [];
  const disagreementReport = [];

  // ── registered deltas, read as data out of the extractor config text ──────
  const registered = new Map();
  for (const ent of ENTITIES) {
    const r = loadRegisteredDeltas(ent.roundingFiles);
    registered.set(ent.key, r);
    console.log(`${ent.key}: ${r.deltas.size} registered source_rounding case(s) parsed as TEXT from ${ent.roundingFiles.join(' + ')} (no import, no exec)`);
  }
  const totalRegistered = [...registered.values()].reduce((s, r) => s + r.deltas.size, 0);
  // Per-entity expected counts, so a filtered (--only) run checks the right
  // number instead of the whole-corpus total. This was hardcoded at 33 --
  // Bainbridge's 20 plus Kitsap's 13 -- which made every single-entity run a
  // guaranteed BLOCKER, and would have silently become wrong the moment any
  // entity's registry changed.
  //
  // Tacoma's expected count is ZERO, and that is a real value rather than a
  // "not yet filled in": it prints IN THOUSANDS, so its components are already
  // rounded to the thousand and sum exactly. Asserting the zero is the point --
  // it means a residue appearing there later is a finding, not a shrug.
  const EXPECTED_REGISTERED = { 'Bainbridge Island': 20, 'Kitsap County': 13, Tacoma: 0 };
  const expectedRegistered = ENTITIES.reduce((s, e) => s + (EXPECTED_REGISTERED[e.key] ?? -1), 0);
  const unknownEntities = ENTITIES.filter((e) => EXPECTED_REGISTERED[e.key] === undefined).map((e) => e.key);
  if (unknownEntities.length) {
    console.error(`  BLOCKER: no expected source_rounding count declared for ${unknownEntities.join(', ')} — ` +
      `add one rather than letting an unasserted registry through`);
    blockers += unknownEntities.length;
  }
  console.log(`Registered source_rounding cases across the checked entities: ${totalRegistered} (expected ${expectedRegistered})\n`);
  if (totalRegistered !== expectedRegistered) {
    console.error(`  BLOCKER: expected ${expectedRegistered} registered source_rounding cases, parsed ${totalRegistered}`);
    blockers++;
  }

  for (const ent of ENTITIES) {
    const { data: muni, error } = await sb.from('municipalities').select('id,name,state,entity_type,population')
      .eq('name', ent.lookup.name).eq('state', ent.lookup.state)
      .eq('entity_type', ent.lookup.entity_type).maybeSingle();
    if (error) throw new Error(`municipality lookup failed: ${error.message}`);
    if (!muni) { console.error(`BLOCKER: ${ent.key} not found in treasury.municipalities`); blockers++; continue; }
    if (muni.id !== ent.expectId) { console.error(`BLOCKER: ${ent.key} id ${muni.id} != expected ${ent.expectId}`); blockers++; }
    if (Number(muni.population) !== ent.population) {
      console.error(`BLOCKER: ${ent.key} DB population ${muni.population} != ${ent.population} used for the per-capita identity check`);
      blockers++;
    }
    console.log(`${ent.key}: ${muni.id} (${muni.entity_type}, ${muni.state}), population ${Number(muni.population).toLocaleString()}, per-capita band [${ent.perCapitaBand.join(', ')}]`);

    const { deltas } = registered.get(ent.key);
    for (const fy of ent.fys) {
      for (const mode of ['revenue', 'operating']) {
        combos++;
        const label = `${ent.key} FY${fy} ${mode}`;
        let ind;
        try {
          ind = rederive(path.join(ent.dir, ent.pdf(fy)), fy, mode, label, ent.perCapitaBand, ent.population);
        } catch (e) {
          console.error(`  BLOCKER ${label}: re-derivation failed — ${e.message}`);
          rows.push({ ent: ent.key, fy, mode, pdf: 'ERROR', db: '—', delta: 'FAIL' });
          blockers++;
          continue;
        }
        const db = await dbTree(muni.id, fy, mode);
        if (!db) {
          console.error(`  BLOCKER ${label}: no row in treasury.budgets`);
          rows.push({ ent: ent.key, fy, mode, pdf: ind.computedTotal, db: 'MISSING', delta: 'FAIL' });
          blockers++;
          continue;
        }
        const reg = deltas.get(`${fy}|${mode}`);
        const problems = compare(ind, db, reg);
        rows.push({
          ent: ent.key, fy, mode, page: ind.pageNumber, units: ind.units,
          pdf: ind.computedTotal, db: db.total,
          printed: ind.printedTotal, residue: ind.computedTotal - ind.printedTotal,
          registered: reg, perCapita: ind.perCapita,
          subtotals: ind.roots.length, leaves: ind.leaves.length,
          candidates: ind.candidates, yearEvidence: ind.yearEvidence, ind,
          delta: problems.length ? 'MISMATCH' : 0,
        });
        if (problems.length) {
          blockers++;
          console.error(`\n  BLOCKER ${label} (p.${ind.pageNumber}, units x${ind.units}, ${ind.ncols} columns):`);
          for (const p of problems) console.error(`    • ${p}`);
        }
        if (ind.columnDisagreements.length) disagreementReport.push({ label, rows: ind.columnDisagreements });
      }
    }
  }

  // ── summary table ──────────────────────────────────────────────────────────
  console.log('\nentity            | FY   | mode      | page |      pdf ($) |       db ($) |   printed ($) | residue | reg | $/res | sub | leaf | delta');
  console.log('------------------|------|-----------|------|--------------|--------------|---------------|---------|-----|-------|-----|------|------');
  for (const r of rows) {
    console.log(
      `${r.ent.padEnd(17)} | ${r.fy} | ${r.mode.padEnd(9)} | ${String(r.page ?? '—').padStart(4)} | ` +
      `${String(r.pdf).padStart(12)} | ${String(r.db).padStart(12)} | ${String(r.printed ?? '—').padStart(13)} | ` +
      `${String(r.residue === undefined ? '—' : (r.residue > 0 ? '+' : '') + r.residue).padStart(7)} | ` +
      `${String(r.registered === undefined ? '—' : (r.registered > 0 ? '+' : '') + r.registered).padStart(3)} | ` +
      `${String(r.perCapita ? r.perCapita.toFixed(0) : '—').padStart(5)} | ` +
      `${String(r.subtotals ?? '—').padStart(3)} | ${String(r.leaves ?? '—').padStart(4)} | ${r.delta}`);
  }

  // ── page identity ─────────────────────────────────────────────────────────
  {
    const done = rows.filter((r) => r.candidates !== undefined);
    const ambiguous = done.filter((r) => r.candidates !== 1);
    console.log(`\nPAGE IDENTITY — asserted independently on all ${done.length} re-derived rows:`);
    console.log(`  • governmental-funds statement caption, whitespace-normalised (not Budget-and-Actual, not budgetary,`);
    console.log(`    not combining/proprietary/fiduciary/internal-service, not a single-fund schedule): ${done.length}/${done.length}`);
    console.log(`  • "General" caption centred over the SAME true-geometry band the values were read from: ${done.length}/${done.length}`);
    console.log(`  • fiscal year confirmed from the page's own period sentence: ${done.length}/${done.length} (no document trusted on its filename)`);
    console.log(`  • per-capita magnitude inside the entity's plausible band: ${done.length}/${done.length}`);
    console.log(`  • exactly ONE surviving candidate page: ${done.length - ambiguous.length}/${done.length}` +
      (ambiguous.length ? ` — ${ambiguous.length} AMBIGUOUS (BLOCKER, see below)` : ' (tie-breaking never decided anything)'));
    // AMBIGUITY IS FATAL, NOT A WARNING. See the file header. Printing these
    // and still exiting 0 would leave the harness silently falling back to
    // "the true statement sorts earliest" — the one assumption it claims not
    // to make, and the one whose failure mode ties at $0 and looks perfect.
    for (const r of ambiguous) {
      console.error(`  BLOCKER PAGE IDENTITY (ambiguous): ${r.ent} FY${r.fy} ${r.mode} — ${r.candidates} candidate pages survived ` +
        `(${r.ind.allCandidates.join(', ')}); page ${r.page} was used, chosen by DOCUMENT ORDER. ` +
        `This harness does not accept a page chosen by sort order — tighten the candidate filters instead.`);
    }
    blockers += ambiguous.length;
    const sample = done.find((r) => r.ent === 'Kitsap County' && r.fy === 2013 && r.mode === 'operating') || done[0];
    if (sample) {
      console.log(`  sample — ${sample.ent} FY${sample.fy} ${sample.mode}: p.${sample.page}, GF band ` +
        `${sample.ind.gfBand[0].toFixed(1)}..${sample.ind.gfBand[1].toFixed(1)} captioned "${sample.ind.gfCaption}", ${sample.yearEvidence}`);
    }
  }

  // ── column-reading agreement ──────────────────────────────────────────────
  console.log(`\nCOLUMN READING — ORDINAL (\`-table\`, Nth cell from the right end) vs`);
  console.log(`CENTRE-IN-BAND (\`-lineprinter\` true page geometry, band from the section's own Total row):`);
  console.log(`  ${disagreementReport.reduce((s, d) => s + d.rows.length, 0)} disagreement(s) across ${disagreementReport.length} of ${rows.filter((r) => r.ind).length} FY x mode`);
  if (!disagreementReport.length) {
    console.log('  (none — the two unlike readings agree on every row, every label and every printed total.');
    console.log('   No published figure depends on which edge of a number is treated as the column key, which is');
    console.log('   the issuer-dependent alignment trap v2.21 found.)');
  } else {
    for (const d of disagreementReport) {
      console.log(`  ${d.label}:`);
      for (const r of d.rows) console.log(`      ${r}`);
    }
  }

  // ── registered-delta adjudication ─────────────────────────────────────────
  {
    const done = rows.filter((r) => r.ind);
    const withReg = done.filter((r) => r.registered !== undefined);
    const exact = withReg.filter((r) => r.residue === r.registered);
    const zeroTie = done.filter((r) => r.registered === undefined && r.residue === 0);
    console.log('\nSOURCE-ROUNDING ADJUDICATION:');
    console.log(`  ${zeroTie.length} row(s) tie at a bare $0 against the document's own printed total.`);
    console.log(`  ${withReg.length} row(s) carry a registered source_rounding case; ${exact.length} match their registered delta EXACTLY.`);
    console.log('  In every registered case the LOADED value is the COMPONENT SUM, never the printed total,');
    console.log('  and each still ties at $0 against its own line items.');
    for (const r of withReg.filter((x) => x.residue !== x.registered)) {
      console.log(`    MISMATCH: ${r.ent} FY${r.fy} ${r.mode} registered ${r.registered}, observed ${r.residue}`);
    }
  }

  // ── independent-document cross-check ──────────────────────────────────────
  // Kitsap-specific: kitsap.gov publishes a physically different copy of the
  // same statements. SKIPPED when Kitsap is not in this run, because the check
  // compares against SAO-side re-derivations that a filtered run never
  // computed. Without this guard `--only "Bainbridge Island"` reported ten
  // blockers that were purely an artifact of the filter -- Bainbridge itself
  // was 36/36 clean underneath them.
  const XCHECK_FYS = [2020, 2021, 2022, 2023, 2024];
  const xcheckApplies = ENTITIES.some((e) => e.key === 'Kitsap County');
  let xcheckYears = 0;
  const xcheckRows = [];
  if (!xcheckApplies) {
    console.log('\nINDEPENDENT-DOCUMENT CROSS-CHECK — SKIPPED: Kitsap County is not in this run');
    console.log('  (--only filter). No entity other than Kitsap has a second published copy.');
  } else {
  console.log('\nINDEPENDENT-DOCUMENT CROSS-CHECK — kitsap.gov copies (physically different documents');
  console.log('on a different host, carrying the same statements):');
  for (const fy of XCHECK_FYS) {
    let dest, cached;
    try {
      ({ dest, cached } = await fetchKitsapGov(fy));
    } catch (e) {
      console.error(`  BLOCKER kitsap.gov FY${fy}: ${e.message}`);
      blockers++;
      continue;
    }
    let ok = true;
    for (const mode of ['revenue', 'operating']) {
      const label = `Kitsap County FY${fy} ${mode} [kitsap.gov]`;
      const sao = rows.find((r) => r.ent === 'Kitsap County' && r.fy === fy && r.mode === mode);
      if (!sao || !sao.ind) { console.error(`  BLOCKER ${label}: no SAO-side re-derivation to compare against`); blockers++; ok = false; continue; }
      let gov;
      try {
        // Look Kitsap up by NAME. This was ENTITIES[1], a positional reference that
        // silently pointed at a different entity the moment the list came from a
        // roster that can be reordered or filtered with --only.
        const kc = ALL_ENTITIES.find((e) => e.key === 'Kitsap County');
        gov = rederive(dest, fy, mode, label, kc.perCapitaBand, kc.population);
      } catch (e) {
        console.error(`  BLOCKER ${label}: re-derivation failed — ${e.message}`);
        blockers++; ok = false; continue;
      }
      const problems = crossCompare(sao.ind, gov);
      xcheckRows.push({ fy, mode, sao: sao.ind.computedTotal, gov: gov.computedTotal, page: gov.pageNumber, ok: !problems.length });
      if (problems.length) {
        ok = false;
        blockers++;
        console.error(`\n  FINDING — the two copies DISAGREE for ${label}:`);
        for (const p of problems) console.error(`    • ${p}`);
        console.error('    Reported, not reconciled. Neither copy is preferred for agreeing with the DB.');
      }
    }
    if (ok) xcheckYears++;
    console.log(`  FY${fy}: ${path.basename(dest)} (${cached ? 'cached' : 'downloaded'}) — ${ok ? 'AGREES with the WA SAO copy on every leaf, subtotal and total' : 'DISAGREEMENT, see above'}`);
  }
  console.log(`\n  YEARS THAT RECEIVED THE INDEPENDENT-DOCUMENT CROSS-CHECK: ${xcheckYears} (Kitsap FY2020-FY2024)`);
  console.log(`  = ${xcheckYears * 2} of the ${EXPECTED_TOTAL_ROWS} checked rows. The other ${EXPECTED_TOTAL_ROWS - xcheckYears * 2} are verified against ONE document each,`);
  console.log(`  so "${EXPECTED_TOTAL_ROWS} rows verified" must NOT be read as "${EXPECTED_TOTAL_ROWS} rows independently sourced".`);
  console.log('  Out of scope, stated rather than silently skipped:');
  console.log('   • Kitsap FY2017-FY2019 — dropped years, no loaded rows to cross-check.');
  console.log('   • Kitsap FY2004-FY2016 — kitsap.gov hosts these SECTIONED, not as single PDFs.');
  console.log('   • Bainbridge Island FY2004-FY2025 — the city publishes no second copy; the WA SAO bound');
  console.log('     filing is the only document that exists for all 36 of its rows.');
  for (const x of xcheckRows) {
    console.log(`    FY${x.fy} ${x.mode.padEnd(9)} p.${String(x.page).padStart(3)}  sao=${String(x.sao).padStart(12)}  kitsap.gov=${String(x.gov).padStart(12)}  ${x.ok ? 'MATCH' : 'DISAGREE'}`);
  }
  }   // end of the Kitsap-only cross-check block

  // ── coverage assertion (a green run must not be vacuous) ───────────────────
  const expectedCombos = ENTITIES.reduce((s, e) => s + e.fys.length * 2, 0);
  if (expectedCombos !== EXPECTED_TOTAL_ROWS) {
    console.error(`  BLOCKER: the declared windows cover ${expectedCombos} combinations but ${EXPECTED_TOTAL_ROWS} rows are expected to be loaded`);
    blockers++;
  }
  if (combos !== expectedCombos) {
    console.error(`  BLOCKER: checked ${combos} combinations, expected ${expectedCombos} — this run did NOT cover the loaded window`);
    blockers++;
  }
  {
    const { count, error } = await sb.from('budgets')
      .select('id', { count: 'exact', head: true })
      .in('municipality_id', ENTITIES.map((e) => e.expectId));
    if (error) { console.error(`  BLOCKER: budgets row count query failed: ${error.message}`); blockers++; }
    else if (count !== EXPECTED_TOTAL_ROWS) {
      console.error(`  BLOCKER: treasury.budgets holds ${count} rows for the checked entities, expected ${EXPECTED_TOTAL_ROWS} — a row exists that this harness never checked`);
      blockers++;
    } else {
      console.log(`\nDB row count for the checked entities: ${count} — exactly the ${combos} combinations checked. No unchecked row exists.`);
    }
  }

  const clean = rows.filter((r) => r.delta === 0).length;
  console.log(`\nCombinations checked: ${combos} (expected ${expectedCombos})`);
  console.log(`Rows re-derived with zero disagreement: ${clean} / ${combos}`);
  console.log(`Blockers: ${blockers}`);
  console.log(blockers === 0
    ? `RESULT: PASS — all ${combos} FY x mode combinations re-derive at exactly $0 against their own line items from an\n` +
      `independent read of the source PDFs; all ${totalRegistered} registered source_rounding cases match their exact registered\n` +
      `delta; page identity holds on every row; the two unlike column readings agree everywhere; and Kitsap\n` +
      `FY2020-FY2024 additionally agree with a physically different copy of the same statements on a different host.`
    : 'RESULT: FAIL — see blockers above. A disagreement here is a FINDING about the loaded data, not a reason\n' +
      'to relax this harness.');
  return blockers === 0 ? 0 : 1;
}

// Set exitCode and let the loop drain rather than calling process.exit(): the
// Supabase client uses undici, so an abrupt exit can race a keep-alive socket
// into a Windows libuv UV_HANDLE_CLOSING assert.
main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Fatal:', e); process.exitCode = 2; })
  .finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref(); });
