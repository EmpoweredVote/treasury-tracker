// Offline unit tests for the VA APA Comparative Report loader (Phase 79 — VASRC-01).
// Run: node --test scripts/loadVAComparativeReport.test.mjs
//
// Asserts against the recon sample (_va-recon/fy2024-comparative-report.xlsx). That file is
// gitignored; when absent (fresh clone), the data-backed tests SKIP rather than fail, but the
// pure-helper tests always run.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import {
  cellNum,
  buildExpenditureTree,
  buildRevenueTree,
  localityPopulation,
  DATA_SOURCE_NAME,
} from './loadVAComparativeReport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(__dirname, '..', '_va-recon', 'fy2024-comparative-report.xlsx');
const HAVE_SAMPLE = existsSync(SAMPLE);

let wb = null;
async function workbook() {
  if (wb) return wb;
  wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SAMPLE);
  return wb;
}

const allAmountsFinite = (tree) =>
  tree.every((n) => typeof n.a === 'number' && Number.isFinite(n.a) && (!n.c || allAmountsFinite(n.c)));

// ── Pure helpers (always run) ────────────────────────────────────────────────
test('cellNum reads numbers and formula .result, rejects derived/text', () => {
  assert.equal(cellNum({ value: 863578347 }), 863578347);
  assert.equal(cellNum({ value: { result: 158591 } }), 158591);
  assert.ok(Number.isNaN(cellNum({ value: { formula: 'A1/B1' } }))); // no cached numeric result
  assert.ok(Number.isNaN(cellNum({ value: { richText: [{ text: 'Per Capita' }] } })));
  assert.ok(Number.isNaN(cellNum(null)));
});

test('DATA_SOURCE_NAME is the durable APA label', () => {
  assert.equal(DATA_SOURCE_NAME, 'Virginia APA Comparative Report');
});

// ── Data-backed tests (skip if the recon sample is absent) ───────────────────
test('Alexandria FY2024 expenditure total ties to the report', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const { tree, total } = buildExpenditureTree(await workbook(), 'Alexandria');
  assert.ok(Math.abs(total - 863578347) <= 1, `expenditure total ${total} != 863578347`);
  assert.ok(tree.length >= 8 && tree.length <= 9, `function count ${tree.length}`);
  assert.ok(allAmountsFinite(tree), 'all expenditure amounts finite');
  const publicSafety = tree.find((n) => /public safety/i.test(n.n));
  assert.ok(publicSafety && publicSafety.c && publicSafety.c.length >= 4, 'Public Safety has activity children');
});

test('Alexandria FY2024 revenue total ties + property-tax breakout', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const { tree, total } = buildRevenueTree(await workbook(), 'Alexandria');
  assert.ok(Math.abs(total - 874230660) <= 1, `revenue total ${total} != 874230660`);
  assert.ok(allAmountsFinite(tree), 'all revenue amounts finite');
  const gpt = tree.find((n) => /general property taxes/i.test(n.n));
  assert.ok(gpt && gpt.c && gpt.c.length >= 4, 'General Property Taxes expanded into sub-sources');
  // No single-child node equal to itself (collapse rule).
  assert.ok(!tree.some((n) => n.c && n.c.length === 1), 'no single-child top-level revenue node');
});

test('no derived per-capita/percent value leaks into a tree amount', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const exp = buildExpenditureTree(await workbook(), 'Alexandria');
  const amounts = [];
  const walk = (t) => t.forEach((n) => { amounts.push(n.a); if (n.c) walk(n.c); });
  walk(exp.tree);
  // 285.3854... is Alexandria's General Government Admin per-capita (Exhibit C col 4) — must NOT appear.
  assert.ok(!amounts.some((a) => Math.abs(a - 285.3854254024503) < 0.001), 'per-capita value leaked as amount');
  // All expenditure amounts are whole-dollar magnitudes (>= 1000), never small per-capita/percent figures.
  assert.ok(amounts.every((a) => Math.abs(a) >= 1000), 'no sub-$1000 derived figures as amounts');
});

test('population comes from Exhibit H July estimate', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  assert.equal(localityPopulation(w, 'Alexandria'), 158591);
  assert.equal(localityPopulation(w, 'Falls Church'), 15675);
});

test('Falls Church parses cleanly (loader generalizes beyond row 1)', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  const exp = buildExpenditureTree(w, 'Falls Church');
  const rev = buildRevenueTree(w, 'Falls Church');
  assert.ok(exp.total > 0 && rev.total > 0, 'non-zero totals');
  assert.ok(allAmountsFinite(exp.tree) && allAmountsFinite(rev.tree), 'all amounts finite');
});
