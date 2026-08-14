#!/usr/bin/env node
/**
 * verify-seattle-rederive.mjs — Task 13 Step 1/2: loader-independent blind
 * re-derivation of every Seattle and King County General Fund figure that
 * Treasury Tracker displays, taken straight from the source ACFR PDFs and
 * diffed leaf-for-leaf and subtotal-for-subtotal against the live production DB.
 *
 * ── INDEPENDENCE RULE ───────────────────────────────────────────────────────
 * This harness does NOT import, require, exec or shell out to
 * scripts/extractSeattle.py, scripts/extractKingCounty.py or lib/acfrGF.py.
 * It re-reads each PDF with its OWN `pdftotext -table` call and a from-scratch
 * JS parser. If it reused the extractor, a bug in the extractor would verify
 * itself: both sides of the comparison would be wrong in the same direction and
 * the diff would still read $0. Agreement between this independent path and the
 * DB (which the Python path wrote) is what makes the displayed figures real.
 *
 * Every mechanism below is deliberately DIFFERENT from the Python's, so that a
 * shared blind spot has to survive two unlike implementations:
 *
 *   statement page   Python anchors on a schedule id (`B-4`). This scores every
 *                    page on structure instead: the title, both `Total` rows, a
 *                    General-Fund column caption, and an exclusion list — then
 *                    takes the first surviving page. "First" is measured, not
 *                    assumed to be harmless: the filter leaves EXACTLY ONE
 *                    candidate on all 25 documents (`candidates=` is printed per
 *                    combination), so tie-breaking never decides anything. If a
 *                    future document produces two, the count in the output says
 *                    so rather than the harness quietly preferring one.
 *   section bounds   Python scans FORWARD from a section header guarded by a
 *                    five-layer prefix test. This finds the `Total ...` row
 *                    first and scans BACKWARD to the nearest header, which makes
 *                    the "STATEMENT OF REVENUES, EXPENDITURES AND CHANGES IN
 *                    FUND BALANCES" title unmatchable by construction: the title
 *                    contains BOTH section words, so it is rejected by the
 *                    other-word test whichever section is being sought.
 *   GF column        NOT an axis of independence — SAY SO PLAINLY. This harness
 *                    started positional (column bands from the section's own
 *                    Total row, cell assigned by centre) and the DOCUMENTS
 *                    REFUTED IT: King County FY2018-FY2020 came up short by
 *                    exactly 12,109 on FY2018 revenue, because `pdftotext -table`
 *                    renders some General Fund values up to 30 columns right of
 *                    their own column while preserving cell ORDER. The printed
 *                    Total adjudicated and selected the ORDINAL reading — the
 *                    same strategy the Python uses. So this is a SHARED
 *                    assumption, not an unlike implementation, and the header
 *                    must not pretend otherwise. Both readings are still
 *                    computed and every row where they differ is reported (they
 *                    never yield two different non-null values on this corpus —
 *                    positional simply finds nothing). What actually protects
 *                    this axis is the PRINTED-vs-SUMMED reconciliation inside
 *                    the PDF, which is independent of the DB entirely.
 *   units            Python takes `units: 1000` from a config dict. This READS
 *                    "(In Thousands)" off the page and refuses to proceed if the
 *                    page does not say so, so the scale is evidence, not a
 *                    setting. The multiplier is applied in exactly ONE place
 *                    (`scaled()`), to leaf values only; subtotals and totals are
 *                    summed from already-scaled leaves and can never be scaled
 *                    a second time.
 *   grouping         Python takes explicit `parents` / `root_leaves` /
 *                    `revenue_group_members` name lists. This derives grouping
 *                    from two rules read off the statements themselves: GASB's
 *                    standard character classification (Current / Debt Service /
 *                    Capital Outlay) on the expenditure side, and "a revenue
 *                    line whose label ends in `taxes` belongs to the open Taxes
 *                    group" on the revenue side. Both are asserted by exact
 *                    label match against the DB, so a wrong rule fails loudly.
 *
 * ── TOLERANCE ───────────────────────────────────────────────────────────────
 * Exact $0 on every figure: grand total, every subtotal, every leaf, matched by
 * ORDERED LABEL as well as value. There is no dispositioned quirk and no
 * approximate mode. Anything that does not tie is a blocker.
 *
 * Read-only against the DB. No network. No AI calls. $0 spend.
 * Exit 0 iff every figure on every FY x mode ties at exactly $0.
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
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

/** Total budgets rows this load is expected to have produced (Seattle 34 + King
 *  County 16). Cross-checked against the declared windows below, so the two can
 *  never silently disagree. */
const EXPECTED_TOTAL_ROWS = 50;

// ── what is expected to be loaded ────────────────────────────────────────────
// Entity ids are asserted, not trusted: they are looked up by name/state/type
// and compared against the ids recorded when Task 9 seeded them.
const ENTITIES = [
  {
    key: 'Seattle',
    lookup: { name: 'Seattle', state: 'WA', entity_type: 'city' },
    expectId: '6e1e8ab5-c8dd-4a6b-bfd7-a31e57120493',
    dir: path.join(ROOT, 'docs', 'Seattle'),
    pdf: (fy) => `seattle-${fy}-acfr.pdf`,
    fys: Array.from({ length: 17 }, (_, i) => 2009 + i), // FY2009..FY2025
  },
  {
    key: 'King County',
    lookup: { name: 'King County', state: 'WA', entity_type: 'county' },
    expectId: '5d47592a-61d2-47ae-84ad-e869f1dd6208',
    dir: path.join(ROOT, 'docs', 'KingCounty'),
    pdf: (fy) => `kingcounty-${fy}-acfr.pdf`,
    fys: Array.from({ length: 8 }, (_, i) => 2018 + i), // FY2018..FY2025
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PDF text
// ═══════════════════════════════════════════════════════════════════════════
const pageCache = new Map();
function pagesOf(pdfPath) {
  if (pageCache.has(pdfPath)) return pageCache.get(pdfPath);
  if (!existsSync(pdfPath)) throw new Error(`PDF not on disk: ${pdfPath}`);
  const txt = execFileSync('pdftotext', ['-table', pdfPath, '-'],
    { maxBuffer: 512 * 1024 * 1024, encoding: 'utf8' });
  const pages = txt.split('\f');
  pageCache.set(pdfPath, pages);
  return pages;
}

// ═══════════════════════════════════════════════════════════════════════════
// Own tokenizer: money and stand-alone dash runs, with their right edges.
// A dash run only counts as a cell placeholder when it is flanked by
// whitespace, so a hyphen inside a label ("Low-Income", "Debt Service -
// Principal") can never be mistaken for a column.
// ═══════════════════════════════════════════════════════════════════════════
const TOKEN_RE = /\(\s*\d[\d,]*\s*\)|\d[\d,]*|(?<=^|\s)[-–—]+(?=\s|$)/g;
const DASH_ONLY = /^[-–—]+$/;

function tokensOf(line) {
  const out = [];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(line)) !== null) {
    const raw = m[0];
    const start = m.index;
    const end = m.index + raw.length; // right edge
    if (DASH_ONLY.test(raw)) { out.push({ kind: 'dash', value: 0, start, end, raw }); continue; }
    const neg = raw.trim().startsWith('(');
    const digits = raw.replace(/[(),\s]/g, '');
    if (!/^\d+$/.test(digits)) continue;
    out.push({ kind: 'money', value: neg ? -Number(digits) : Number(digits), start, end, raw });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Own statement-page finder: structural scoring, no schedule-id anchor.
// ═══════════════════════════════════════════════════════════════════════════
const TITLE_RE = /statement\s+of\s+revenues/i;
const CHANGES_RE = /changes?\s+in\s+fund\s+balances?/i;
const TOTAL_REV_RE = /^total\s+revenues\b/i;
const TOTAL_EXP_RE = /^total\s+expenditures\b/i;
// A General Fund COLUMN caption. The three vintages print it three ways:
// Seattle FY2020+ "General Fund", Seattle FY2009-2019 a bare "General" above the
// column, and King County stacks "GENERAL" / "FUND" on two separate lines. So
// the discriminator is the caption word itself, excluding the unrelated
// "GOVERNMENTAL FUNDS" / "General Government" text that appears on every page.
const GF_CAPTION_RE = /\bgeneral\b(?!\s+govern)/i;
// Continuation pages carry the identical title and both Total rows but no
// General Fund column; they label themselves explicitly.
const CONTINUATION_RE = /\(?\s*page\s+2\s+of\s+\d/i;
// Page-TYPE exclusions only. "Nonmajor" is deliberately absent: it is a
// legitimate column caption on King County's correct page (FY2018-FY2020 print
// a "NONMAJOR GOVERNMENTAL FUNDS" column), and a genuine nonmajor combining
// statement is already caught by "combining".
const EXCLUDE_RE = /\b(combining|budgetary|budget\s+(and|to)\s+actual|proprietary|fiduciary|net\s+position|reconciliation|internal\s+service|agency\s+funds)\b/i;

function findStatementPage(pages, label) {
  const cands = [];
  pages.forEach((pg, i) => {
    const lines = pg.split('\n');
    const trimmed = lines.map((l) => l.trim());
    if (!TITLE_RE.test(pg)) return;
    if (!CHANGES_RE.test(pg.replace(/\s+/g, ' '))) return;
    if (!trimmed.some((t) => TOTAL_REV_RE.test(t))) return;
    if (!trimmed.some((t) => TOTAL_EXP_RE.test(t))) return;
    // The caption block is, by definition, everything down to and INCLUDING the
    // first section header. Slicing a fixed number of lines instead would miss
    // King County, which stacks "GENERAL" / "FUND" well down a blank-line-padded
    // header; stopping one line short would miss Seattle FY2020+, which prints
    // the "General Fund" caption on the REVENUES line itself.
    const firstSection = trimmed.findIndex((t) => /^revenues\b/i.test(t) && !/expenditures|statement/i.test(t));
    const head = lines.slice(0, firstSection > 0 ? firstSection + 1 : 25).join('\n');
    if (!GF_CAPTION_RE.test(head)) return;
    if (CONTINUATION_RE.test(head)) return;
    if (EXCLUDE_RE.test(head)) return;
    cands.push(i);
  });
  if (!cands.length) throw new Error(`${label}: no General Fund statement page found`);
  return { index: cands[0], text: pages[cands[0]], allCandidates: cands };
}

// ═══════════════════════════════════════════════════════════════════════════
// Own units detection — read off the page, never configured.
// ═══════════════════════════════════════════════════════════════════════════
const THOUSANDS_RE = /\(\s*in\s+thousands\s*\)/i;
const MILLIONS_RE = /\(\s*in\s+millions\s*\)/i;
function unitsOf(pageText, label) {
  const flat = pageText.replace(/\s+/g, ' ');
  if (MILLIONS_RE.test(flat)) return 1_000_000;
  if (THOUSANDS_RE.test(flat)) return 1_000;
  throw new Error(`${label}: statement page does not declare its units — refusing to assume a scale`);
}

/**
 * Assert the statement page belongs to the fiscal year it is being attributed to.
 *
 * Without this the harness binds document to fiscal year purely by FILENAME
 * (`seattle-<fy>-acfr.pdf`), so a consistently mis-named local file would tie at
 * $0 against a DB loaded from the same mis-named file — both sides wrong in the
 * same direction. The statement page states its own period, so it can simply be
 * asked. Accepts either the period sentence ("For the Year Ended December 31,
 * 2024" — King County prints it uppercase and Seattle mixed case) or, for
 * vintages that put the year only in a column caption, a bare year caption.
 */
function assertPageYear(pageText, fy, label) {
  const flat = pageText.replace(/\s+/g, ' ');
  const period = flat.match(/year\s+ended\s+december\s*3\s*1\s*,?\s*(\d{4})/i);
  if (period) {
    if (Number(period[1]) !== fy) {
      throw new Error(`${label}: statement page states "year ended December 31, ${period[1]}" but this document is being read as FY${fy}`);
    }
    return `period sentence "${period[0].trim()}"`;
  }
  if (new RegExp(`(^|\\s)${fy}(\\s|$)`).test(flat)) return `bare ${fy} caption (no period sentence on the page)`;
  throw new Error(`${label}: statement page carries no evidence it is FY${fy} — refusing to trust the filename alone`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Own column model: BANDS derived from the section's own Total row, which is
// the one row where every fund column is populated.
//
// Neither edge of a number is a stable column key across these documents:
// Seattle LEFT-aligns its money columns (so "1" and "396,106" share a start but
// not an end) while King County RIGHT-aligns them (so they share an end but not
// a start). Keying on either edge alone silently drops short values — which is
// exactly how three Seattle years lost their $1k–$72k Capital Outlay and Debt
// Service leaves in the first run of this harness. So each column instead gets
// a BAND, bounded by the midpoints of the gaps to its neighbours on the Total
// row, and a token belongs to the column whose band contains its CENTRE. That
// is alignment-agnostic: it only assumes columns do not overlap.
// ═══════════════════════════════════════════════════════════════════════════
function bandsFrom(totalLine, label) {
  const toks = tokensOf(totalLine).filter((t) => t.kind === 'money').sort((a, b) => a.start - b.start);
  if (toks.length < 2) {
    throw new Error(`${label}: the Total row exposes ${toks.length} column(s); cannot establish a General Fund column`);
  }
  return toks.map((t, k) => ({
    // Column 0's left edge is mirrored from the column-0/column-1 pitch, which
    // puts it far right of any label text without hardcoding a margin.
    left: k === 0 ? toks[0].start - (toks[1].start - toks[0].start) / 2 : (toks[k - 1].end + toks[k].start) / 2,
    right: k === toks.length - 1 ? Infinity : (toks[k].end + toks[k + 1].start) / 2,
  }));
}

const centre = (t) => (t.start + t.end) / 2;

/**
 * Split a data line into its label and its General Fund cell.
 *
 * Anything whose centre falls left of column 0's band is label text, so prose
 * punctuation inside a label can never be read as a column.
 *
 * Returns { label, cell } where cell is null when the row carries no cell at
 * all (a group header or a wrapped label fragment), or { value } when it does —
 * a dash placeholder yielding 0.
 *
 * ⚠ Stated precisely, because an earlier version of this comment claimed a
 * branch that does not exist: under the ordinal reading a General Fund cell
 * that is genuinely BLANK — no value and no dash placeholder — is NOT read as
 * zero. The first cell on the row is taken, which in that case belongs to the
 * next fund column. That row shape does not occur in this corpus (the only
 * short row across all 50 combinations is an unlabelled all-dash line in
 * Seattle FY2019 operating, which is skipped for having no label), and if it
 * did the borrowed value would inflate the section sum and break the
 * PRINTED-vs-SUMMED reconciliation loudly. It is a disclosed limit, not a
 * handled case.
 */
function splitRow(line, bands) {
  const cells = tokensOf(line).filter((t) => centre(t) >= bands[0].left);
  if (!cells.length) return { label: normLabel(line), cell: null };
  const label = normLabel(line.slice(0, cells[0].start));

  // ORDINAL reading: the General Fund is the leftmost column, so it is the first
  // cell on the row — dash placeholders included, which is why the tokenizer
  // emits a dash run as a cell in its own right.
  const ordinal = cells[0];
  // POSITIONAL reading: the cell whose centre falls inside column 0's band.
  const positional = cells.find((t) => centre(t) < bands[0].right);

  // The two readings agree on every Seattle year and on King County FY2021+.
  // They diverge on King County FY2018-FY2020, where `pdftotext -table` places
  // some General Fund values up to 30 columns right of their own column while
  // preserving cell ORDER. The document's own printed Total adjudicates: only
  // the ordinal reading reconciles to it (see the divergence report per FY).
  // Divergences are counted and printed rather than silently resolved.
  const diverged = (positional ? positional.start : null) !== ordinal.start;
  return {
    label,
    cell: { value: ordinal.value, diverged, positionalValue: positional ? positional.value : null },
  };
}

// A bare four-digit number is a column-caption YEAR, not money: every monetary
// figure of 1,000 or more is comma-grouped in these statements, and anything
// smaller cannot be four digits. Used only to decide whether a line is a section
// header — Seattle FY2020+ prints "REVENUES ... General Fund ... 2024" on one line.
const isYearCaption = (t) => t.kind === 'money' && /^\d{4}$/.test(t.raw) && t.value >= 1900 && t.value <= 2100;

function isHeaderLine(line, bands) {
  const cells = tokensOf(line).filter((t) => centre(t) >= bands[0].left && !isYearCaption(t));
  return cells.length === 0;
}

// A trailing currency symbol belongs to the column, not the label: the money
// regex starts at the digits, so "Property Taxes    $   379,415" leaves the "$"
// on the label side of the split.
const normLabel = (s) => s.replace(/\s+/g, ' ').trim().replace(/[:$\s]+$/, '').trim();

// ═══════════════════════════════════════════════════════════════════════════
// Own section bounds: find the Total row, then scan BACKWARD to its header.
// The document title contains BOTH section words, so requiring the header to
// NOT contain the other section word makes the title unmatchable.
// ═══════════════════════════════════════════════════════════════════════════
function sectionOf(lines, mode, label) {
  const totalRe = mode === 'revenue' ? TOTAL_REV_RE : TOTAL_EXP_RE;
  const headRe = mode === 'revenue' ? /^revenues\b/i : /^expenditures\b/i;
  const otherWord = mode === 'revenue' ? /expenditures/i : /revenues/i;

  const totalIdx = lines.findIndex((l) => totalRe.test(l.trim()));
  if (totalIdx < 0) throw new Error(`${label}: no "Total ${mode === 'revenue' ? 'revenues' : 'expenditures'}" row`);
  const totalLine = lines[totalIdx];
  const bands = bandsFrom(totalLine, label);

  let headIdx = -1;
  for (let i = totalIdx - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!headRe.test(t)) continue;
    if (otherWord.test(t)) continue;   // the document title carries both words
    if (/statement/i.test(t)) continue;
    // A section header carries no money (a bare year caption aside). Without
    // this, Seattle FY2015's wrapped label — "Program Income, Interest, and
    // Miscellaneous" / "Revenues 38,041" — is mistaken for the REVENUES header
    // and the whole section is swallowed.
    if (!isHeaderLine(lines[i], bands)) continue;
    headIdx = i;
    break;
  }
  if (headIdx < 0) throw new Error(`${label}: found the Total row but no ${mode} section header above it`);
  return { body: lines.slice(headIdx + 1, totalIdx), totalLine, bands };
}

// ═══════════════════════════════════════════════════════════════════════════
// Own tree builders.
// ═══════════════════════════════════════════════════════════════════════════
// GASB's standard character classification for governmental-fund expenditures.
const CHARACTER_RE = /^(current|debt\s+service|capital\s+outlay)$/i;
const TAXES_HEADER_RE = /^taxes$/i;
const TAX_MEMBER_RE = /taxes$/i;

/**
 * A body line with no cell is one of exactly two things: a group header, or the
 * first half of a label that wrapped onto two lines (Seattle FY2015 splits
 * "Program Income, Interest, and Miscellaneous" / "Revenues"). The group
 * headers are a closed, documented set — GASB's character classification on the
 * expenditure side and "Taxes" on the revenue side — so anything else is a wrap
 * fragment and is carried forward onto the next row that does have a cell.
 */
function buildOperating(body, bands, scale) {
  const roots = [];
  let open = null;   // character-classification group currently accepting children
  let pending = '';  // carried-forward wrapped label fragment
  for (const line of body) {
    if (!line.trim()) continue;
    const { label, cell } = splitRow(line, bands);
    if (!label) continue;
    if (cell === null) {
      if (CHARACTER_RE.test(label)) { open = { label, children: [] }; roots.push(open); pending = ''; }
      else pending = normLabel(`${pending} ${label}`);
      continue;
    }
    const full = pending ? normLabel(`${pending} ${label}`) : label;
    pending = '';
    if (CHARACTER_RE.test(full)) { open = null; roots.push({ label: full, children: [{ label: full, value: scale(cell.value) }] }); continue; }
    const child = { label: full, value: scale(cell.value) };
    if (open) open.children.push(child);
    else roots.push({ label: full, children: [child] });
  }
  return roots;
}

function buildRevenue(body, bands, scale) {
  const roots = [];
  let taxes = null;
  let pending = '';
  for (const line of body) {
    if (!line.trim()) continue;
    const { label, cell } = splitRow(line, bands);
    if (!label) continue;
    if (cell === null) {
      if (TAXES_HEADER_RE.test(label)) { taxes = { label, children: [] }; roots.push(taxes); pending = ''; }
      else pending = normLabel(`${pending} ${label}`);
      continue;
    }
    const full = pending ? normLabel(`${pending} ${label}`) : label;
    pending = '';
    const child = { label: full, value: scale(cell.value) };
    if (taxes && TAX_MEMBER_RE.test(full)) { taxes.children.push(child); continue; }
    taxes = null;
    roots.push({ label: full, children: [child] });
  }
  return roots;
}

/** Drop zero leaves and then zero/empty roots, matching what the app stores. */
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

function rederive(entity, fy, mode) {
  const label = `${entity.key} FY${fy} ${mode}`;
  const pdfPath = path.join(entity.dir, entity.pdf(fy));
  const pages = pagesOf(pdfPath);
  const page = findStatementPage(pages, label);
  const yearEvidence = assertPageYear(page.text, fy, label);
  const units = unitsOf(page.text, label);
  const scale = (v) => v * units;                 // the ONLY place units are applied
  const lines = page.text.split('\n');
  const { body, totalLine, bands } = sectionOf(lines, mode, label);
  const built = mode === 'revenue'
    ? buildRevenue(body, bands, scale)
    : buildOperating(body, bands, scale);
  const { roots, droppedLeaves, droppedRoots } = prune(built);

  const printedCell = splitRow(totalLine, bands).cell;
  if (!printedCell) throw new Error(`${label}: the Total row has no General Fund cell`);

  // Rows where the ordinal and positional readings disagree — disclosed rather
  // than silently resolved, so a reader can see exactly which figures depend on
  // the ordinal reading and check them by hand against the PDF.
  const divergences = [];
  for (const line of body) {
    if (!line.trim()) continue;
    const { label: rl, cell } = splitRow(line, bands);
    if (cell && cell.diverged) {
      divergences.push(`${rl || '(unlabelled)'}: ordinal=${cell.value} positional=${cell.positionalValue === null ? '(no cell in band 0)' : cell.positionalValue}`);
    }
  }

  return {
    label, pdfPath, pageIndex: page.index, pageNumber: page.index + 1, units,
    yearEvidence, candidates: page.allCandidates.length,
    roots, divergences,
    computedTotal: roots.reduce((s, r) => s + r.amount, 0),
    printedTotal: scale(printedCell.value),
    leaves: roots.flatMap((r) => r.children.map((c) => ({ root: r.label, label: c.label, value: c.value }))),
    droppedLeaves, droppedRoots,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DB side
// ═══════════════════════════════════════════════════════════════════════════
async function dbTree(muniId, fy, mode) {
  const { data: b, error: be } = await sb.from('budgets')
    .select('id,total_budget').eq('municipality_id', muniId)
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
    roots: cats.map((c) => ({
      label: c.name,
      amount: Number(c.amount),
      children: byCat.get(c.id).map((it) => ({ label: it.description, value: Number(it.actual_amount) })),
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Comparison — ordered, label-aware, exact
// ═══════════════════════════════════════════════════════════════════════════
const key = (s) => normLabel(String(s)).toLowerCase();

function compare(ind, db) {
  const problems = [];
  if (db.total !== ind.computedTotal) {
    problems.push(`GRAND TOTAL: db=${db.total} pdf=${ind.computedTotal} delta=${db.total - ind.computedTotal}`);
  }
  if (ind.printedTotal !== ind.computedTotal) {
    problems.push(`PRINTED vs SUMMED (pdf-internal): printed=${ind.printedTotal} summed=${ind.computedTotal} delta=${ind.printedTotal - ind.computedTotal}`);
  }
  if (db.total !== ind.printedTotal) {
    problems.push(`GRAND TOTAL vs PRINTED: db=${db.total} printed=${ind.printedTotal} delta=${db.total - ind.printedTotal}`);
  }

  // subtotals, in order
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

  // Leaves are matched by (root, label) rather than by position: budget_categories
  // carries a sort_order and so is compared in order above, but budget_line_items
  // has no ordering column, so requiring a position match would be asserting
  // something the schema does not promise. Every leaf must still be present on
  // both sides exactly once and carry the identical value.
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
  for (const [k, y] of bm) {
    if (!am.has(k)) problems.push(`LEAF ONLY IN DB: "${y.root} / ${y.label}" = ${y.value}`);
  }
  return problems;
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('=== Seattle + King County independent re-derivation (loader-independent) ===');
  console.log(`DB: ${SUPABASE_URL}`);
  console.log('Extractor imports: NONE (own pdftotext pass + own JS parser)\n');

  let blockers = 0;
  let combos = 0;
  const rows = [];
  const evidence = {};
  const divergenceReport = [];

  for (const ent of ENTITIES) {
    const { data: muni, error } = await sb.from('municipalities').select('id,name,state,entity_type')
      .eq('name', ent.lookup.name).eq('state', ent.lookup.state)
      .eq('entity_type', ent.lookup.entity_type).maybeSingle();
    if (error) throw new Error(`municipality lookup failed: ${error.message}`);
    if (!muni) { console.error(`BLOCKER: ${ent.key} not found in treasury.municipalities`); blockers++; continue; }
    if (muni.id !== ent.expectId) {
      console.error(`BLOCKER: ${ent.key} id ${muni.id} != expected ${ent.expectId}`);
      blockers++;
    }
    console.log(`${ent.key}: ${muni.id} (${muni.entity_type}, ${muni.state}) — id matches Task 9 record`);

    for (const fy of ent.fys) {
      for (const mode of ['revenue', 'operating']) {
        combos++;
        let ind;
        try {
          ind = rederive(ent, fy, mode);
        } catch (e) {
          console.error(`  BLOCKER ${ent.key} FY${fy} ${mode}: re-derivation failed — ${e.message}`);
          rows.push({ ent: ent.key, fy, mode, pdf: 'ERROR', db: '—', delta: 'FAIL' });
          blockers++;
          continue;
        }
        const db = await dbTree(muni.id, fy, mode);
        if (!db) {
          console.error(`  BLOCKER ${ent.key} FY${fy} ${mode}: no row in treasury.budgets`);
          rows.push({ ent: ent.key, fy, mode, pdf: ind.computedTotal, db: 'MISSING', delta: 'FAIL' });
          blockers++;
          continue;
        }
        const problems = compare(ind, db);
        rows.push({
          ent: ent.key, fy, mode,
          pdf: ind.computedTotal, db: db.total,
          delta: problems.length ? 'MISMATCH' : 0,
          page: ind.pageNumber, units: ind.units,
          subtotals: ind.roots.length, leaves: ind.leaves.length,
          candidates: ind.candidates, yearEvidence: ind.yearEvidence,
        });
        if (problems.length) {
          blockers++;
          console.error(`\n  BLOCKER ${ind.label} (p.${ind.pageNumber}, units x${ind.units}):`);
          for (const p of problems) console.error(`    • ${p}`);
        }
        if (ind.divergences.length) {
          divergenceReport.push({ ent: ent.key, fy, mode, rows: ind.divergences });
        }
        if (fy === 2024) {
          evidence[`${ent.key} FY2024 ${mode}`] = { ind, db };
        }
      }
    }
  }

  // ── summary table ──────────────────────────────────────────────────────────
  console.log('\nentity       | FY   | mode      | page | units |      pdf ($) |       db ($) | sub | leaf | delta');
  console.log('-------------|------|-----------|------|-------|--------------|--------------|-----|------|------');
  for (const r of rows) {
    console.log(
      `${r.ent.padEnd(12)} | ${r.fy} | ${r.mode.padEnd(9)} | ${String(r.page ?? '—').padStart(4)} | ` +
      `${String(r.units ? 'x' + r.units : '—').padStart(5)} | ${String(r.pdf).padStart(12)} | ${String(r.db).padStart(12)} | ` +
      `${String(r.subtotals ?? '—').padStart(3)} | ${String(r.leaves ?? '—').padStart(4)} | ${r.delta}`);
  }

  // ── provenance of each parsed page ─────────────────────────────────────────
  {
    const done = rows.filter((r) => r.candidates !== undefined);
    const ambiguous = done.filter((r) => r.candidates !== 1);
    const byPeriod = done.filter((r) => /period sentence/.test(r.yearEvidence || '')).length;
    console.log(`\nStatement pages: ${done.length} located, ${done.length - ambiguous.length} with exactly ONE surviving candidate` +
      `${ambiguous.length ? `, ${ambiguous.length} AMBIGUOUS (tie-break decided the page — inspect these)` : ' (tie-breaking never decided anything)'}`);
    for (const r of ambiguous) console.log(`  AMBIGUOUS: ${r.ent} FY${r.fy} ${r.mode} — ${r.candidates} candidate pages`);
    console.log(`Fiscal year confirmed from the page itself on ${done.length}/${done.length}: ` +
      `${byPeriod} by its own "year ended December 31, <FY>" sentence, ${done.length - byPeriod} by a bare year caption. ` +
      'No document is trusted on its filename alone.');
  }

  // ── where the two column readings disagreed ────────────────────────────────
  console.log(`\nRows where the ORDINAL and POSITIONAL column readings disagree: ` +
    `${divergenceReport.reduce((s, d) => s + d.rows.length, 0)} across ${divergenceReport.length} FY x mode`);
  if (!divergenceReport.length) {
    console.log('  (none — both readings agree everywhere)');
  } else {
    console.log('  The ordinal reading is used. It is the one that reconciles to the');
    console.log("  document's own printed Total on every affected statement.");
    for (const d of divergenceReport) {
      console.log(`  ${d.ent} FY${d.fy} ${d.mode}:`);
      for (const r of d.rows) console.log(`      ${r}`);
    }
  }

  // ── FY2024 label-aligned leaf evidence ─────────────────────────────────────
  for (const [name, { ind, db }] of Object.entries(evidence)) {
    console.log(`\n${name} — leaf-level alignment (independent PDF read vs live DB):`);
    const bm = new Map(db.roots.flatMap((r) => r.children.map((c) => [`${key(r.label)} ␟ ${key(c.label)}`, c.value])));
    ind.leaves.forEach((x) => {
      const k = `${key(x.root)} ␟ ${key(x.label)}`;
      const y = bm.has(k) ? bm.get(k) : null;
      const ok = y !== null && x.value === y;
      console.log(`  ${ok ? 'OK ' : 'XX '} ${(x.root + ' / ' + x.label).padEnd(52)} pdf=${String(x.value).padStart(13)} db=${String(y === null ? '(no match)' : y).padStart(13)}`);
    });
    console.log(`  ${'—'.repeat(4)} subtotals:`);
    ind.roots.forEach((r, i) => {
      const y = db.roots[i];
      const ok = y && key(r.label) === key(y.label) && r.amount === y.amount;
      console.log(`  ${ok ? 'OK ' : 'XX '} ${r.label.padEnd(52)} pdf=${String(r.amount).padStart(13)} db=${String(y ? y.amount : '(none)').padStart(13)}`);
    });
    console.log(`  ${'—'.repeat(4)} zero rows the PDF carries and the DB correctly omits: ` +
      `${ind.droppedLeaves.length} leaf, ${ind.droppedRoots.length} group` +
      (ind.droppedRoots.length ? ` (${ind.droppedRoots.join(', ')})` : ''));
  }

  // COVERAGE ASSERTION. Without this, `blockers === 0` is satisfied VACUOUSLY:
  // narrowing ENTITIES[].fys to iterate faster and forgetting to restore it
  // yields "Combinations checked: 0 / Blockers: 0 / RESULT: PASS" — a green
  // harness that verified nothing, wearing a banner that claims all 50. The
  // expected count is derived from the same window the entities declare, so it
  // cannot drift from them, and it is asserted against the DB row count too.
  const expectedCombos = ENTITIES.reduce((s, e) => s + e.fys.length * 2, 0);
  if (expectedCombos !== EXPECTED_TOTAL_ROWS) {
    console.error(`  BLOCKER: the declared windows cover ${expectedCombos} combinations but ${EXPECTED_TOTAL_ROWS} rows are expected to be loaded`);
    blockers++;
  }
  if (combos !== expectedCombos) {
    console.error(`  BLOCKER: checked ${combos} combinations, expected ${expectedCombos} — this run did NOT cover the loaded window`);
    blockers++;
  }

  console.log(`\nCombinations checked: ${combos} (expected ${expectedCombos})`);
  console.log(`Blockers: ${blockers}`);
  console.log(blockers === 0
    ? `RESULT: PASS — all ${combos} FY x mode combinations tie at exactly $0 on every grand total, subtotal and leaf, against an independent read of the source PDFs.`
    : 'RESULT: FAIL — see blockers above.');
  return blockers === 0 ? 0 : 1;
}

// Set exitCode and let the loop drain rather than calling process.exit(): the
// Supabase client uses undici under the hood, so an abrupt exit can race a
// keep-alive socket into a Windows libuv UV_HANDLE_CLOSING assert. The unref'd
// timer is a backstop if an idle socket holds the process open.
main()
  .then((code) => { process.exitCode = code; })
  .catch((e) => { console.error('Fatal:', e); process.exitCode = 2; })
  .finally(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref(); });
