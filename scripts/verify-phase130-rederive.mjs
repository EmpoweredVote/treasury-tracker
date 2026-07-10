#!/usr/bin/env node
/**
 * verify-phase130-rederive.mjs — Phase 130 / TUC-07 (a): loader-independent
 * blind re-derivation of every displayed Tucson GF figure, directly from the
 * source ACFR PDFs, diffed against the live production DB.
 *
 * INDEPENDENCE RULE (D-02): this harness does NOT import, require, or shell out
 * to scripts/extractTucson.py (the Phase-128 loader extractor). It re-reads each
 * docs/Tucson/cot-<FY>-acfr.pdf with its OWN `pdftotext -table` call and a
 * from-scratch JS parser (own money regex, own statement-page finder, own
 * positional GF-column isolation, own section/tree builders). Reusing the
 * extractor would re-test the loader against itself. Agreement between this
 * independent JS path and the live DB (built by the Python path) proves the
 * displayed figures are real.
 *
 * METHOD: `pdftotext -table` only (never -layout — it scrambles the multi-fund
 * columns per TUCSON-SCOPING §0). The General Fund is column 0; every number on
 * every row is assigned to the nearest column anchor taken from the fully-
 * populated Total revenues / Total expenditures rows; a blank GF cell => 0.
 *
 * TOLERANCE: exact-0 on every figure. The only permitted non-zero disposition is
 * the documented FY2021/FY2022 revenue merged-LABEL cosmetic (129 deferred-items):
 * labels differ, dollar VALUES do not — so it must still tie at the total AND the
 * non-zero leaf-value multiset must still match. Any real value delta is a blocker.
 *
 * Read-only against the DB. No AI calls. $0 spend. Exit 0 iff every figure ties.
 */

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── env (ROOT-relative, like processTucson.js) ───────────────────────────────
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
      const [k, ...v] = line.split('=');
      if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
    }
  } catch { /* absent — ignore */ }
}
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kxsdzaojfaibhuzmclfq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL or service key'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: 'treasury' } });

const FYS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// ── PDF dir (worktree-safe: docs/* is gitignored) ────────────────────────────
function resolvePdfDir() {
  const c = path.join(ROOT, 'docs', 'Tucson');
  if (existsSync(c)) return c;
  return c;
}
const PDF_DIR = resolvePdfDir();
const pdfFor = (fy) => path.join(PDF_DIR, `cot-${fy}-acfr.pdf`);

// ── independent money parsing ────────────────────────────────────────────────
const MONEY_RE = /\(\d[\d,]*\)|\$?\s*\d[\d,]*/g;
function parseMoney(tok) {
  let t = tok.replace(/\$/g, '').replace(/\s/g, '').trim();
  if (!t || t === '-') return null;
  const neg = t.startsWith('(');
  t = t.replace(/[()]/g, '').replace(/,/g, '');
  if (!/^\d+$/.test(t)) return null;
  return neg ? -parseInt(t, 10) : parseInt(t, 10);
}
function numsWithPos(line) {
  const out = [];
  MONEY_RE.lastIndex = 0;
  let m;
  while ((m = MONEY_RE.exec(line))) {
    const v = parseMoney(m[0]);
    if (v !== null) out.push([v, m.index + m[0].length]);
  }
  return out;
}

// ── independent statement-page location ──────────────────────────────────────
const TITLE_RE = /Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances/i;
const EXCLUDE = ['Combining', 'Reconciliation', 'Budgetary', 'Budget and Actual', 'Proprietary', 'Fiduciary', 'Net Position'];
function pdfPages(pdfPath) {
  return execFileSync('pdftotext', ['-table', pdfPath, '-'], { maxBuffer: 200 * 1024 * 1024, encoding: 'utf8' }).split('\f');
}
function findStatementPage(pages) {
  const cands = [];
  pages.forEach((pg, i) => {
    if (!TITLE_RE.test(pg)) return;
    if (!pg.includes('Total revenues') || !pg.includes('Total expenditures')) return;
    if (!pg.includes('General') || !pg.includes('Fund')) return;
    if (EXCLUDE.some((x) => pg.includes(x))) return;
    cands.push([i, pg]);
  });
  cands.sort((a, b) => a[0] - b[0]);
  return cands.length ? cands[0] : [null, null];
}

// ── independent GF-column isolation ──────────────────────────────────────────
const anchorsOf = (line) => numsWithPos(line).map(([, p]) => p);
function gfValue(line, colAnchors) {
  let best = null, bestD = null;
  for (const [v, p] of numsWithPos(line)) {
    let col = 0, cd = Infinity;
    for (let k = 0; k < colAnchors.length; k++) {
      const d = Math.abs(p - colAnchors[k]);
      if (d < cd) { cd = d; col = k; }
    }
    if (col === 0) {
      const d = Math.abs(p - colAnchors[0]);
      if (bestD === null || d < bestD) { best = v; bestD = d; }
    }
  }
  return best;
}
const normLabel = (raw) => raw.replace(/\s+/g, ' ').trim().replace(/[:\-]+$/, '').trim();
function labelOf(line) {
  MONEY_RE.lastIndex = 0;
  const m = MONEY_RE.exec(line);
  return normLabel(m ? line.slice(0, m.index) : line);
}

// section between a start header and an end header (exclusive)
function* section(lines, startRe, endRe) {
  let on = false;
  for (const l of lines) {
    const st = l.trim();
    if (!on && startRe.test(st)) { on = true; continue; }
    if (on && endRe.test(st)) return;
    if (on) yield l;
  }
}

// ── independent tree builders ────────────────────────────────────────────────
function buildRevenue(lines, colAnchors) {
  const leaves = [];
  let pending = '';
  for (const l of section(lines, /^Revenues\b/i, /^Total\s+revenues\b/i)) {
    if (!l.trim()) continue;
    const gv = gfValue(l, colAnchors);
    const lbl = labelOf(l);
    if (gv === null) {
      if (lbl && numsWithPos(l).length === 0) pending = (pending + ' ' + lbl).trim();
      continue;
    }
    const full = pending ? normLabel(pending + ' ' + lbl) : lbl;
    pending = '';
    if (full) leaves.push({ label: full, value: gv });
  }
  const total = leaves.reduce((s, c) => s + c.value, 0);
  return { categories: leaves.map((c) => ({ label: c.label, value: c.value })), leaves, total };
}

function buildOperating(lines, colAnchors) {
  const categories = []; // {label, value, children:[{label,value}]}
  let parent = null;
  let pending = '';
  for (const l of section(lines, /^Expenditures\b/i, /^Total\s+expenditures\b/i)) {
    const st = l.trim();
    if (!st) continue;
    const lbl = labelOf(l);
    const low = lbl.toLowerCase();
    const hasNum = numsWithPos(l).length > 0;
    if (!hasNum && (low === 'current' || low === 'debt service')) {
      parent = { label: lbl || normLabel(st), value: 0, children: [] };
      categories.push(parent);
      pending = '';
      continue;
    }
    const gv = gfValue(l, colAnchors);
    if (gv === null) {
      if (lbl && !hasNum) pending = (pending + ' ' + lbl).trim();
      continue;
    }
    const full = pending ? normLabel(pending + ' ' + lbl) : lbl;
    pending = '';
    if (!full) continue;
    const node = { label: full, value: gv };
    if (full.toLowerCase().startsWith('capital ')) { categories.push(node); parent = null; }
    else if (parent) parent.children.push(node);
    else categories.push(node);
  }
  for (const c of categories) if (c.children) c.value = c.children.reduce((s, ch) => s + ch.value, 0);
  const leaves = [];
  for (const c of categories) {
    if (c.children && c.children.length) leaves.push(...c.children);
    else leaves.push({ label: c.label, value: c.value });
  }
  const total = categories.reduce((s, c) => s + c.value, 0);
  return { categories, leaves, total };
}

function printedTotal(lines, colAnchors, mode) {
  const key = mode === 'revenue' ? 'total revenues' : 'total expenditures';
  const row = lines.find((l) => l.trim().toLowerCase().startsWith(key));
  return row ? gfValue(row, colAnchors) : null;
}

function extractIndependent(fy, mode) {
  const pages = pdfPages(pdfFor(fy));
  const [, pg] = findStatementPage(pages);
  if (!pg) throw new Error(`FY${fy}: GF statement page not found`);
  const lines = pg.split('\n');
  const revRow = lines.find((l) => l.trim().toLowerCase().startsWith('total revenues'));
  const expRow = lines.find((l) => l.trim().toLowerCase().startsWith('total expenditures'));
  const aR = revRow ? anchorsOf(revRow) : [];
  const aE = expRow ? anchorsOf(expRow) : [];
  const colAnchors = aR.length >= aE.length ? aR : aE;
  if (colAnchors.length < 2) throw new Error(`FY${fy}: could not anchor fund columns`);
  const built = mode === 'revenue' ? buildRevenue(lines, colAnchors) : buildOperating(lines, colAnchors);
  built.printed = printedTotal(lines, colAnchors, mode);
  return built;
}

// ── DB pull (independent of the loader) ──────────────────────────────────────
async function dbTree(muniId, fy, mode) {
  const dataset = mode === 'revenue' ? 'revenue' : 'operating';
  const { data: b } = await sb.from('budgets').select('id,total_budget')
    .eq('municipality_id', muniId).eq('fiscal_year', fy).eq('dataset_type', dataset).maybeSingle();
  if (!b) return null;
  const { data: cats } = await sb.from('budget_categories').select('id,name,amount,sort_order')
    .eq('budget_id', b.id).order('sort_order');
  const catIds = cats.map((c) => c.id);
  const { data: items } = await sb.from('budget_line_items').select('category_id,description,actual_amount')
    .in('category_id', catIds);
  const byCat = new Map(catIds.map((id) => [id, []]));
  for (const it of items) byCat.get(it.category_id).push({ label: it.description, value: Number(it.actual_amount) });
  return {
    total: Number(b.total_budget),
    categories: cats.map((c) => ({ label: c.name, value: Number(c.amount), children: byCat.get(c.id) || [] })),
    leaves: cats.flatMap((c) => byCat.get(c.id) || []),
  };
}

// ── comparison helpers ───────────────────────────────────────────────────────
const sortedVals = (arr) => arr.map((x) => x.value).filter((v) => v !== 0).sort((a, b) => a - b);
const eqMultiset = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function main() {
  const { data: muni } = await sb.from('municipalities').select('id')
    .eq('name', 'Tucson').eq('state', 'AZ').eq('entity_type', 'city').maybeSingle();
  if (!muni) { console.error('Tucson municipality not found'); process.exit(1); }
  if (!muni.id.startsWith('e97d7a75')) console.error(`  NOTE: Tucson id ${muni.id} != CONTEXT prefix e97d7a75`);

  const rows = [];
  let blockers = 0;
  const dispositions = [];
  const groundingLeaves = {}; // FY2024 label-aligned evidence

  for (const mode of ['revenue', 'operating']) {
    for (const fy of FYS) {
      const ind = extractIndependent(fy, mode);
      const db = await dbTree(muni.id, fy, mode);
      if (fy === 2024 && db) {
        // label-aligned leaf evidence for the grounding year (D-03)
        const dbByLabel = new Map(db.leaves.map((l) => [normLabel(l.label).toLowerCase(), l.value]));
        groundingLeaves[mode] = ind.leaves.map((l) => ({
          label: l.label,
          pdf: l.value,
          db: dbByLabel.has(normLabel(l.label).toLowerCase()) ? dbByLabel.get(normLabel(l.label).toLowerCase()) : '(no label match)',
        }));
      }
      if (!db) { rows.push({ fy, mode, figure: '(row)', pdf: '—', db: 'MISSING', delta: 'FAIL' }); blockers++; continue; }

      // 1) grand total: db.total == independent printed == independent computed
      const totalTie = db.total === ind.printed && db.total === ind.total;
      rows.push({ fy, mode, figure: 'GRAND TOTAL', pdf: ind.total, db: db.total, delta: db.total - ind.total, printed: ind.printed });
      if (!totalTie) blockers++;

      // 2) category subtotals — value multiset (non-zero)
      const catTie = eqMultiset(sortedVals(ind.categories), sortedVals(db.categories));
      rows.push({ fy, mode, figure: `categories (${db.categories.length})`, pdf: sortedVals(ind.categories).length, db: sortedVals(db.categories).length, delta: catTie ? 0 : 'MISMATCH' });

      // 3) leaf values — value multiset (non-zero)
      const indLeaves = sortedVals(ind.leaves);
      const dbLeaves = sortedVals(db.leaves);
      const leafTie = eqMultiset(indLeaves, dbLeaves);
      rows.push({ fy, mode, figure: `leaves (${db.leaves.length})`, pdf: indLeaves.length, db: dbLeaves.length, delta: leafTie ? 0 : 'MISMATCH' });

      const cleanAll = totalTie && catTie && leafTie;
      if (!cleanAll) {
        // permitted disposition: FY2021/FY2022 revenue merged-label cosmetic —
        // labels differ but total ties AND non-zero value multisets match.
        const isQuirkFY = mode === 'revenue' && (fy === 2021 || fy === 2022);
        if (isQuirkFY && totalTie && leafTie && catTie) {
          dispositions.push(`FY${fy} ${mode}: cosmetic label merge only (values + total tie) — dispositioned`);
        } else {
          blockers++;
          console.error(`  BLOCKER FY${fy} ${mode}: totalTie=${totalTie} catTie=${catTie} leafTie=${leafTie}`);
          console.error(`    ind total=${ind.total} printed=${ind.printed} db=${db.total}`);
          if (!leafTie) { console.error(`    ind leaves=${JSON.stringify(indLeaves)}`); console.error(`    db  leaves=${JSON.stringify(dbLeaves)}`); }
        }
      }
    }
  }

  // report
  console.log('\n=== Phase 130 TUC-07 re-derivation (loader-independent) ===\n');
  console.log('FY   | mode      | figure            | pdf         | db          | delta');
  console.log('-----|-----------|-------------------|-------------|-------------|------');
  for (const r of rows) {
    const pdf = String(r.pdf).padStart(11);
    const db = String(r.db).padStart(11);
    console.log(`${r.fy} | ${r.mode.padEnd(9)} | ${String(r.figure).padEnd(17)} | ${pdf} | ${db} | ${r.delta}`);
  }
  if (dispositions.length) { console.log('\nDispositioned (known cosmetic quirk):'); dispositions.forEach((d) => console.log('  • ' + d)); }

  // FY2024 grounding leaf-level alignment (label + value), D-03 evidence
  for (const mode of ['operating', 'revenue']) {
    if (!groundingLeaves[mode]) continue;
    console.log(`\nFY2024 ${mode} — leaf-level alignment (PDF-independent vs DB):`);
    for (const g of groundingLeaves[mode]) {
      const mark = g.pdf === g.db ? '✓' : '✗';
      console.log(`  ${mark} ${String(g.label).padEnd(42)} pdf=${String(g.pdf).padStart(12)} db=${String(g.db).padStart(12)}`);
    }
  }

  console.log(`\nBlockers: ${blockers}`);
  console.log(blockers === 0 ? 'RESULT: PASS — all 20 FY×mode roll-ups + every leaf tie at exactly $0.' : 'RESULT: FAIL');
  process.exit(blockers === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
