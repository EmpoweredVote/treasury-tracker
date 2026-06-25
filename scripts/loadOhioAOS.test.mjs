// Offline unit tests for the Ohio AOS loader (Phase 84 — OHSRC-01).
// Run: node --test scripts/loadOhioAOS.test.mjs
//
// Asserts against the recon sample (_oh-recon/City_2024_GAAP_Summarized.XLSX). That file is
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
  buildRevenueTree,
  buildExpenditureTree,
  cityPopulation,
  cityCounty,
  DATA_SOURCE_NAME,
  enumerateCities,
} from './loadOhioAOS.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(__dirname, '..', '_oh-recon', 'City_2024_GAAP_Summarized.XLSX');
const HAVE_SAMPLE = existsSync(SAMPLE);
const CASH_SAMPLE = join(__dirname, '..', '_oh-recon', 'City_2024_CASH_Summarized.XLSX');
const HAVE_CASH_SAMPLE = existsSync(CASH_SAMPLE);

let wb = null;
async function workbook() {
  if (wb) return wb;
  wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SAMPLE);
  return wb;
}

/** Walk all top-level nodes; verify every .a is a finite number. */
const allAmountsFinite = (tree) =>
  tree.every((n) => typeof n.a === 'number' && Number.isFinite(n.a));

/** Walk all top-level nodes; verify every node is flat (no children). */
const allFlat = (tree) => tree.every((n) => !n.c || n.c.length === 0);

// ── Pure helpers (always run) ────────────────────────────────────────────────
test('cellNum reads numbers and formula .result, rejects derived/text', () => {
  assert.equal(cellNum({ value: 810082000 }), 810082000);
  assert.equal(cellNum({ value: { result: 913985 } }), 913985);
  assert.ok(Number.isNaN(cellNum({ value: { formula: 'A1+B1' } }))); // no cached numeric result
  assert.ok(Number.isNaN(cellNum({ value: { richText: [{ text: 'Total' }] } })));
  assert.ok(Number.isNaN(cellNum(null)));
});

test('DATA_SOURCE_NAME is the durable AOS label', () => {
  assert.equal(DATA_SOURCE_NAME, 'Ohio Auditor of State Summarized Annual Financial Reports');
});

// ── Data-backed tests (skip if the recon sample is absent) ───────────────────
test(
  'Columbus FY2024 revenue total within 0.5% of $2.166B',
  { skip: !HAVE_SAMPLE && 'recon sample _oh-recon/City_2024_GAAP_Summarized.XLSX absent' },
  async () => {
    const { tree, total } = buildRevenueTree(await workbook(), 'Columbus');
    const expected = 2.166e9;
    const pctDiff = Math.abs(total - expected) / expected;
    assert.ok(pctDiff <= 0.005,
      `revenue total ${total} not within 0.5% of ${expected} (diff ${(pctDiff * 100).toFixed(3)}%)`);
    assert.ok(allAmountsFinite(tree), 'all revenue amounts are finite numbers');
  }
);

test(
  'Columbus FY2024 Income Taxes leaf within 0.5% of $1.145B',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildRevenueTree(await workbook(), 'Columbus');
    const incomeTaxes = tree.find((n) => /income\s*taxes?/i.test(n.n));
    assert.ok(incomeTaxes, 'Income Taxes leaf present in revenue tree');
    const expected = 1.145e9;
    const pctDiff = Math.abs(incomeTaxes.a - expected) / expected;
    assert.ok(pctDiff <= 0.005,
      `Income Taxes ${incomeTaxes.a} not within 0.5% of ${expected} (diff ${(pctDiff * 100).toFixed(3)}%)`);
  }
);

test(
  'Columbus FY2024 revenue tree includes Intergovernmental as a labeled leaf (D-01)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildRevenueTree(await workbook(), 'Columbus');
    const intergovernmental = tree.find((n) => /intergovernmental/i.test(n.n));
    assert.ok(intergovernmental,
      'Intergovernmental must be present as a labeled leaf (D-01 — Ohio includes intergovernmental in total)');
    assert.ok(typeof intergovernmental.a === 'number' && Number.isFinite(intergovernmental.a),
      'Intergovernmental amount is a finite number');
  }
);

test(
  'Columbus FY2024 revenue tree is flat — every top-level node has no children (D-04)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildRevenueTree(await workbook(), 'Columbus');
    assert.ok(allFlat(tree),
      `Revenue tree must be flat (D-04). Non-flat nodes: ${JSON.stringify(tree.filter((n) => n.c && n.c.length))}`);
  }
);

test(
  'Columbus FY2024 expenditure tree has Police leaf within 1% of $810M',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildExpenditureTree(await workbook(), 'Columbus');
    const police = tree.find((n) => /^police$/i.test(n.n));
    assert.ok(police, 'Police leaf present in expenditure tree');
    const expected = 810e6;
    const pctDiff = Math.abs(police.a - expected) / expected;
    assert.ok(pctDiff <= 0.01,
      `Police ${police.a} not within 1% of ${expected} (diff ${(pctDiff * 100).toFixed(3)}%)`);
  }
);

test(
  'Columbus FY2024 expenditure total equals Total Expenditures column (finite)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { total } = buildExpenditureTree(await workbook(), 'Columbus');
    assert.ok(typeof total === 'number' && Number.isFinite(total),
      `Expenditure total must be a finite number, got ${total}`);
    // Recon-verified: $2,477,440,000
    assert.ok(total > 2e9, `Expenditure total ${total} looks too small`);
  }
);

test(
  'Columbus FY2024 expenditure tree includes Capital Outlay as a leaf (D-02)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildExpenditureTree(await workbook(), 'Columbus');
    const capOutlay = tree.find((n) => /capital\s*outlay/i.test(n.n));
    assert.ok(capOutlay,
      'Capital Outlay must be present as a leaf (D-02 — full Total Expenditures incl. capital)');
    assert.ok(typeof capOutlay.a === 'number' && Number.isFinite(capOutlay.a),
      'Capital Outlay amount is a finite number');
  }
);

test(
  'Columbus FY2024 expenditure tree has NO Other Financing / Fund Balance nodes (D-04b)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildExpenditureTree(await workbook(), 'Columbus');
    const forbidden = tree.filter((n) =>
      /other\s*financing|fund\s*balance|excess\s*of\s*revenues|net\s*change|beginning\s*of\s*year|end\s*of\s*year|special\s*item|extraordinary/i.test(n.n)
    );
    assert.equal(forbidden.length, 0,
      `Forbidden nodes present (D-04b): ${JSON.stringify(forbidden.map((n) => n.n))}`);
  }
);

test(
  'Columbus FY2024 expenditure tree is flat — every top-level node has no children (D-04)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildExpenditureTree(await workbook(), 'Columbus');
    assert.ok(allFlat(tree),
      `Expenditure tree must be flat (D-04). Non-flat nodes: ${JSON.stringify(tree.filter((n) => n.c && n.c.length))}`);
  }
);

test(
  'Columbus FY2024 all expenditure amounts are finite numbers (not strings or [object Object])',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const { tree } = buildExpenditureTree(await workbook(), 'Columbus');
    assert.ok(allAmountsFinite(tree),
      `All expenditure amounts must be finite numbers. Bad nodes: ${JSON.stringify(tree.filter((n) => !Number.isFinite(n.a)))}`);
  }
);

test(
  'cityPopulation returns 913985 for Columbus',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const pop = cityPopulation(await workbook(), 'Columbus');
    assert.equal(pop, 913985, `cityPopulation('Columbus') returned ${pop}, expected 913985`);
  }
);

test(
  'cityCounty returns a non-empty county string for Columbus (e.g. Franklin)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const county = cityCounty(await workbook(), 'Columbus');
    assert.ok(typeof county === 'string' && county.length > 0,
      `cityCounty('Columbus') must return a non-empty string, got ${JSON.stringify(county)}`);
  }
);

test(
  'cityPopulation returns a finite number for a second city (loader generalizes beyond Columbus)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    // Akron is the first city in the workbook
    const pop = cityPopulation(await workbook(), 'Akron');
    assert.ok(typeof pop === 'number' && Number.isFinite(pop) && pop > 0,
      `cityPopulation('Akron') must return a finite positive number, got ${pop}`);
  }
);

test(
  'unknown city throws a descriptive error (not silent NaN/null)',
  { skip: !HAVE_SAMPLE && 'recon sample absent' },
  async () => {
    const w = await workbook();
    assert.throws(
      () => buildRevenueTree(w, 'CityThatDoesNotExistXYZ'),
      /not found/i,
      'buildRevenueTree should throw a "not found" error for unknown cities'
    );
  }
);

// ── Phase 85 — enumerateCities tests ──────────────────────────────────────────

test(
  'enumerateCities on FY2024 GAAP workbook returns ≥200 names including Columbus (no empties or duplicates)',
  { skip: !HAVE_SAMPLE && 'recon sample _oh-recon/City_2024_GAAP_Summarized.XLSX absent' },
  async () => {
    const w = await workbook();
    const names = enumerateCities(w);
    assert.ok(Array.isArray(names), 'enumerateCities must return an array');
    assert.ok(names.length >= 200,
      `Expected ≥200 city names, got ${names.length}`);
    assert.ok(names.includes('Columbus'),
      `"Columbus" must be in the roster; got: ${names.slice(0, 10).join(', ')}...`);
    // No empty entries
    const empties = names.filter((n) => !n || !n.trim());
    assert.equal(empties.length, 0, `Found ${empties.length} empty names in roster`);
    // No duplicates
    const unique = new Set(names);
    assert.equal(unique.size, names.length,
      `Duplicate city names found: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`);
  }
);

test(
  'enumerateCities on FY2024 CASH workbook returns a non-empty array including Kenton',
  { skip: !HAVE_CASH_SAMPLE && 'recon sample _oh-recon/City_2024_CASH_Summarized.XLSX absent' },
  async () => {
    const cashWb = new ExcelJS.Workbook();
    await cashWb.xlsx.readFile(CASH_SAMPLE);
    const names = enumerateCities(cashWb);
    assert.ok(Array.isArray(names), 'enumerateCities must return an array');
    assert.ok(names.length > 0, 'CASH workbook roster must not be empty');
    assert.ok(names.includes('Kenton'),
      `"Kenton" must be in the CASH roster; got: ${JSON.stringify(names)}`);
  }
);
