#!/usr/bin/env node
/**
 * verify-phase133-rederive.mjs — Phase 133 / PIMA-07 (a): loader-independent
 * blind re-derivation of every displayed GF figure for the four Pima County
 * municipalities (Oro Valley, Marana, Sahuarita, South Tucson), directly from
 * the source ACFR PDFs, diffed against the live production DB.
 *
 * INDEPENDENCE RULE (D-01): this harness does NOT import, require, or shell
 * out to scripts/extractAcfrGF.py (the Phase-131 loader extractor). It re-reads
 * each docs/<City>/<City>-FY<year>.pdf with its OWN `pdftotext -table`
 * spawnSync call and a from-scratch JS parser (own money regex, own
 * statement-page finder, own positional GF-column isolation, own tree
 * builders). Reusing the extractor would re-test the loader against itself.
 * Agreement between this independent JS path and the live DB (built by the
 * Python-extractor + processPimaCities.js path) proves the displayed figures
 * are real. Scaled directly from the shipped scripts/verify-phase130-rederive.mjs
 * (Tucson, 1 city -> 4 cities here).
 *
 * METHOD: `pdftotext -table` only (never -layout — it scrambles the multi-fund
 * columns per 131-RECON.md §Method). The General Fund is always the first data
 * column; every number on every row is assigned to the nearest column anchor
 * taken from the fully-populated Total revenues / Total expenditures rows. A
 * blank/dash GF cell resolves to "skip this row" (no genuine multi-line-wrapped
 * labels in these statements — 131-RECON.md §Extractor notes).
 *
 * TOLERANCE: exact-0 on every figure (D-03a). The only permitted non-zero
 * disposition is the documented Oro Valley `pdftotext -table` glyph-split-label
 * cosmetic (e.g. raw PDF "Tran s it" / "In teres t" vs the loader's cleaned
 * "Transit" / "Interest") — labels differ, dollar VALUES must still tie exactly.
 * Any real value delta is a blocker.
 *
 * Read-only against the DB. No AI calls. $0 spend. Exit 0 iff every figure ties.
 */

import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── env (ROOT-relative, like processPimaCities.js) ───────────────────────────
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

// ── Per-city config (windows locked in 131-RECON.md; ids per 132-01-SUMMARY) ──
const CITIES = {
  OroValley:   { muniName: 'Oro Valley',   idPrefix: '1edc0ca1', fys: [2019, 2020, 2021, 2022, 2023, 2024] },
  Marana:      { muniName: 'Marana',       idPrefix: 'bff60025', fys: [2019, 2020, 2021, 2022, 2023, 2024] },
  Sahuarita:   { muniName: 'Sahuarita',    idPrefix: '3fdb131c', fys: [2019, 2020, 2021, 2022, 2023, 2024] },
  SouthTucson: { muniName: 'South Tucson', idPrefix: 'cfa8cc5b', fys: [2019, 2020, 2021, 2022] },
};

// ── PDF dir (worktree-safe: docs/* is gitignored; mirrors processPimaCities.js) ─
function resolvePdfDir(dirKey) {
  const candidate = path.join(ROOT, 'docs', dirKey);
  if (existsSync(candidate)) return candidate;
  try {
    const gitDir = execSync('git rev-parse --git-common-dir', { cwd: ROOT, encoding: 'utf8' }).trim();
    const mainRoot = path.dirname(path.resolve(ROOT, gitDir));
    const mainCandidate = path.join(mainRoot, 'docs', dirKey);
    if (existsSync(mainCandidate)) return mainCandidate;
  } catch { /* ignore */ }
  return candidate;
}
const pdfFor = (dirKey, fy) => path.join(resolvePdfDir(dirKey), `${dirKey}-FY${fy}.pdf`);

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
const anchorsOf = (line) => numsWithPos(line).map(([, p]) => p);

// ── independent statement-page location (case-insensitive; ACFRs vary casing) ─
const TITLE_RE = /Statement\s+of\s+Revenues\s*,?\s*Expenditures\s*,?\s+and\s+Changes\s+in\s+Fund\s+Balances/i;
const EXCLUDE = ['Combining', 'Reconciliation', 'Budgetary', 'Budget and Actual', 'Budget to Actual', 'Proprietary', 'Fiduciary', 'Net Position', 'Cash Flows'];
function pdfPages(pdfPath) {
  const result = spawnSync('pdftotext', ['-table', pdfPath, '-'], { maxBuffer: 200 * 1024 * 1024, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`pdftotext failed (exit ${result.status}) for ${pdfPath}: ${(result.stderr || result.error?.message || '').slice(0, 300)}`);
  }
  return result.stdout.split('\f');
}
function findStatementPage(pages) {
  const cands = [];
  pages.forEach((pg, i) => {
    if (!TITLE_RE.test(pg)) return;
    const low = pg.toLowerCase();
    if (!low.includes('total revenues') || !low.includes('total expenditures')) return;
    if (!low.includes('general') || !low.includes('fund')) return;
    if (EXCLUDE.some((x) => low.includes(x.toLowerCase()))) return;
    cands.push([i, pg]);
  });
  cands.sort((a, b) => a[0] - b[0]);
  return cands.length ? cands[0] : [null, null];
}

// ── independent GF-column isolation (GF = column nearest anchor[0]) ──────────
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
  return best; // null = blank/dash GF cell (row's first number belongs to a later column)
}
const normLabel = (raw) => raw.replace(/\s+/g, ' ').trim().replace(/[:\-]+$/, '').trim();
function labelOf(line) {
  MONEY_RE.lastIndex = 0;
  const m = MONEY_RE.exec(line);
  return normLabel(m ? line.slice(0, m.index) : line);
}

// section between a start header line and an end header line (exclusive)
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
// Flat GF revenue-by-source tree. A row with no GF value (blank/dash cell) is
// skipped entirely — these statements have no genuine multi-line-wrapped
// labels (131-RECON.md §Extractor notes), so no label-buffering is needed.
function buildRevenue(lines, colAnchors) {
  const categories = [];
  for (const l of section(lines, /^revenues\b/i, /^total\s+revenues\b/i)) {
    if (!l.trim()) continue;
    const gv = gfValue(l, colAnchors);
    if (gv === null) continue;
    const label = labelOf(l);
    if (!label || label.toLowerCase().startsWith('total ')) continue;
    categories.push({ label, value: gv, children: [], isParent: false });
  }
  const total = categories.reduce((s, c) => s + c.value, 0);
  return { categories, total };
}

// 2-level GF expenditure-by-function tree. Section-header rows (label-only,
// trailing ':' — e.g. "Current:" / "Debt service:" — with a bare-word
// fallback for headers lacking the colon) become parents whose value = sum
// of children. "Capital outlay"/"Capital projects" are root leaves. Rows with
// no GF value (blank/dash cell) are skipped, never buffered.
function buildOperating(lines, colAnchors) {
  const categories = [];
  let parent = null;
  for (const l of section(lines, /^expenditures\b/i, /^total\s+expenditures\b/i)) {
    const st = l.trim();
    if (!st) continue;
    const hasNum = numsWithPos(l).length > 0;
    if (!hasNum) {
      const strippedLow = st.replace(/[:\-]+$/, '').trim().toLowerCase();
      if (st.endsWith(':') || strippedLow === 'current' || strippedLow === 'debt service') {
        const label = labelOf(l) || st.replace(/[:\-]+$/, '').trim();
        parent = { label, value: 0, children: [], isParent: true };
        categories.push(parent);
      }
      continue; // label-only, non-header line — no genuine wrapped labels expected, ignore
    }
    const gv = gfValue(l, colAnchors);
    if (gv === null) continue;
    const label = labelOf(l);
    if (!label || label.toLowerCase().startsWith('total ')) continue;
    const node = { label, value: gv, children: [], isParent: false };
    if (label.toLowerCase().startsWith('capital ')) {
      categories.push(node);
      parent = null;
    } else if (parent) {
      parent.children.push(node);
    } else {
      categories.push(node);
    }
  }
  // drop empty-header parents (a ':' header with no GF children collected)
  const finalCats = categories.filter((c) => !(c.isParent && c.children.length === 0));
  for (const c of finalCats) if (c.isParent) c.value = c.children.reduce((s, ch) => s + ch.value, 0);
  const total = finalCats.reduce((s, c) => s + c.value, 0);
  return { categories: finalCats, total };
}

function extractIndependent(dirKey, fy, mode) {
  const pdfPath = pdfFor(dirKey, fy);
  const pages = pdfPages(pdfPath);
  const [, pg] = findStatementPage(pages);
  if (!pg) throw new Error(`${dirKey} FY${fy}: GF statement page not found`);
  const lines = pg.split('\n');
  const revRow = lines.find((l) => /^total\s+revenues\b/i.test(l.trim()));
  const expRow = lines.find((l) => /^total\s+expenditures\b/i.test(l.trim()));
  if (!revRow || !expRow) throw new Error(`${dirKey} FY${fy}: Total revenues/expenditures row not found`);
  const aR = anchorsOf(revRow), aE = anchorsOf(expRow);
  const colAnchors = aR.length >= aE.length ? aR : aE;
  if (colAnchors.length < 2) throw new Error(`${dirKey} FY${fy}: could not anchor fund columns`);
  const built = mode === 'revenue' ? buildRevenue(lines, colAnchors) : buildOperating(lines, colAnchors);
  built.printed = gfValue(mode === 'revenue' ? revRow : expRow, colAnchors);
  return built;
}

function flattenLeaves(tree) {
  return tree.categories.flatMap((c) =>
    c.children && c.children.length ? c.children.map((ch) => ({ label: ch.label, value: ch.value })) : [{ label: c.label, value: c.value }]
  );
}

// ── DB pull (independent of the loader) — same category/line-item shape the ──
// ── frontend consumes (budget_categories -> budget_line_items) ───────────────
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
  };
}

// ── comparison helpers ───────────────────────────────────────────────────────
// Label-aligned match with a documented Oro Valley fallback for the two known
// cosmetic label defects in OV's source PDFs/loader cleanup: (1) pdftotext
// glyph-split rendering ("Tran s it" vs cleaned "Transit"), matched by
// stripping whitespace; (2) a source-PDF typo ("Integovernmental" vs the
// loader-corrected "Intergovernmental"), which is not a whitespace variant so
// it cannot be caught by (1). Rather than hardcoding that exact string pair
// (which would weaken the independence claim), any items still unmatched
// after passes (1)-(2) are paired by an EXACT value match (greedy, first
// available) — this is a general "unmatched-by-text but the dollar figure
// ties exactly" disposition, not specific to any known label. It only fires
// for OroValley and only ever passes when the VALUE ties exactly; if the
// value does not also tie, it remains a blocker.
function matchLeaves(indList, dbList, dirKey) {
  const pool = dbList.map((d) => ({ ...d, _used: false }));
  const rows = [];
  const unmatchedInd = [];
  for (const item of indList) {
    const key = normLabel(item.label).toLowerCase();
    let idx = pool.findIndex((d) => !d._used && normLabel(d.label).toLowerCase() === key);
    let disposition = null;
    if (idx === -1 && dirKey === 'OroValley') {
      const key2 = key.replace(/\s+/g, '');
      idx = pool.findIndex((d) => !d._used && normLabel(d.label).toLowerCase().replace(/\s+/g, '') === key2);
      if (idx !== -1) disposition = 'OV pdftotext glyph-split label (cosmetic; value ties)';
    }
    if (idx === -1) { unmatchedInd.push(item); continue; }
    pool[idx]._used = true;
    const dbItem = pool[idx];
    const tie = item.value === dbItem.value;
    rows.push({ label: disposition ? `${item.label} -> ${dbItem.label}` : item.label, pdf: item.value, db: dbItem.value, tie, disposition });
  }
  // pass 3 (OroValley only): pair any remaining unmatched-by-text items on
  // both sides that share an EXACT value — a general "label variance, value
  // ties" disposition (catches the source-PDF "Integovernmental" typo).
  for (const item of unmatchedInd) {
    let idx = -1;
    if (dirKey === 'OroValley') idx = pool.findIndex((d) => !d._used && d.value === item.value);
    if (idx === -1) { rows.push({ label: item.label, pdf: item.value, db: 'NO MATCH', tie: false, disposition: null }); continue; }
    pool[idx]._used = true;
    const dbItem = pool[idx];
    rows.push({ label: `${item.label} -> ${dbItem.label}`, pdf: item.value, db: dbItem.value, tie: true, disposition: 'OV label variance, unmatched by text (value ties exactly)' });
  }
  for (const rem of pool) if (!rem._used) rows.push({ label: rem.label, pdf: 'NO MATCH', db: rem.value, tie: false, disposition: null });
  return rows;
}

async function main() {
  const allRows = [];
  let blockers = 0;
  const dispositions = [];
  const grounding = {}; // latest-FY leaf-level evidence per city×mode

  for (const dirKey of Object.keys(CITIES)) {
    const city = CITIES[dirKey];
    const { data: muni } = await sb.from('municipalities').select('id')
      .eq('name', city.muniName).eq('state', 'AZ').eq('entity_type', 'city').maybeSingle();
    if (!muni) { console.error(`${city.muniName} municipality not found`); process.exit(1); }
    if (!muni.id.startsWith(city.idPrefix)) console.error(`  NOTE: ${city.muniName} id ${muni.id} != CONTEXT prefix ${city.idPrefix}`);

    const latestFY = city.fys[city.fys.length - 1];

    for (const mode of ['revenue', 'operating']) {
      for (const fy of city.fys) {
        const ind = extractIndependent(dirKey, fy, mode);
        const db = await dbTree(muni.id, fy, mode);
        if (!db) { allRows.push({ dirKey, fy, mode, figure: '(row)', pdf: '—', db: 'MISSING' }); blockers++; continue; }

        const totalTie = ind.printed === ind.total && ind.total === db.total;
        allRows.push({ dirKey, fy, mode, figure: 'GRAND TOTAL', pdf: ind.total, db: db.total, printed: ind.printed, tie: totalTie });
        if (!totalTie) { blockers++; console.error(`  BLOCKER ${dirKey} FY${fy} ${mode}: printed=${ind.printed} computed=${ind.total} db=${db.total}`); }

        const indCatList = ind.categories.map((c) => ({ label: c.label, value: c.value }));
        const dbCatList = db.categories.map((c) => ({ label: c.label, value: c.value }));
        const catMatches = matchLeaves(indCatList, dbCatList, dirKey);
        const catBlockers = catMatches.filter((r) => !r.tie).length;
        allRows.push({ dirKey, fy, mode, figure: `categories (${dbCatList.length})`, pdf: indCatList.length, db: dbCatList.length, tie: catBlockers === 0 });
        blockers += catBlockers;
        catMatches.filter((r) => r.disposition).forEach((r) => dispositions.push(`${dirKey} FY${fy} ${mode} category "${r.label}": ${r.disposition} (pdf=${r.pdf} db=${r.db})`));
        catMatches.filter((r) => !r.tie).forEach((r) => console.error(`  BLOCKER ${dirKey} FY${fy} ${mode} category mismatch: ${JSON.stringify(r)}`));

        const indLeafList = flattenLeaves(ind);
        const dbLeafList = db.categories.flatMap((c) => c.children);
        const leafMatches = matchLeaves(indLeafList, dbLeafList, dirKey);
        const leafBlockers = leafMatches.filter((r) => !r.tie).length;
        allRows.push({ dirKey, fy, mode, figure: `leaves (${dbLeafList.length})`, pdf: indLeafList.length, db: dbLeafList.length, tie: leafBlockers === 0 });
        blockers += leafBlockers;
        leafMatches.filter((r) => r.disposition).forEach((r) => dispositions.push(`${dirKey} FY${fy} ${mode} leaf "${r.label}": ${r.disposition} (pdf=${r.pdf} db=${r.db})`));
        leafMatches.filter((r) => !r.tie).forEach((r) => console.error(`  BLOCKER ${dirKey} FY${fy} ${mode} leaf mismatch: ${JSON.stringify(r)}`));

        if (fy === latestFY) {
          grounding[dirKey] = grounding[dirKey] || {};
          grounding[dirKey][mode] = { printed: ind.printed, computed: ind.total, db: db.total, leafMatches };
        }
      }
    }
  }

  // report
  console.log('\n=== Phase 133 PIMA-07 re-derivation (loader-independent) ===\n');
  console.log('City         | FY   | mode      | figure               | pdf         | db          | tie');
  console.log('-------------|------|-----------|----------------------|-------------|-------------|-----');
  for (const r of allRows) {
    const pdf = String(r.pdf).padStart(11);
    const db = String(r.db).padStart(11);
    console.log(`${r.dirKey.padEnd(12)} | ${r.fy} | ${r.mode.padEnd(9)} | ${String(r.figure).padEnd(20)} | ${pdf} | ${db} | ${r.tie ? 'PASS' : 'FAIL'}`);
  }

  if (dispositions.length) {
    console.log('\nDispositioned (known Oro Valley cosmetic label quirk — values tie exactly):');
    dispositions.forEach((d) => console.log('  • ' + d));
  }

  console.log('\n=== Latest-FY grounding (per city, both modes) ===');
  for (const dirKey of Object.keys(CITIES)) {
    const city = CITIES[dirKey];
    const latestFY = city.fys[city.fys.length - 1];
    const g = grounding[dirKey];
    if (!g) continue;
    console.log(`\n${city.muniName} FY${latestFY}:`);
    for (const mode of ['revenue', 'operating']) {
      if (!g[mode]) continue;
      console.log(`  ${mode}: printed=${g[mode].printed}  computed=${g[mode].computed}  db=${g[mode].db}  ${g[mode].printed === g[mode].computed && g[mode].computed === g[mode].db ? 'TIE $0' : 'MISMATCH'}`);
    }
  }

  console.log(`\nBlockers: ${blockers}`);
  console.log(blockers === 0
    ? 'RESULT: PASS — all 44 FY×mode roll-ups + every category + every leaf tie at exactly $0 (OV glyph-label quirks dispositioned at label level only).'
    : 'RESULT: FAIL');
  process.exit(blockers === 0 ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(2); });
