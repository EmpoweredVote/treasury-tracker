// Offline unit tests for the Ohio AOS loader (Phase 84 — OHSRC-01; Phase 86 — OHCO-01).
// Run: npx vitest run scripts/loadOhioAOS.test.mjs
//
// Asserts against the recon samples (gitignored — absent on fresh clone → tests SKIP):
//   _oh-recon/City_2024_GAAP_Summarized.XLSX   (Phase 84/85 city tests)
//   _oh-recon/City_2024_CASH_Summarized.XLSX   (Phase 85 CASH fallback test)
//   _oh-recon/County_2024_GAAP_Summarized.XLSX (Phase 86 county tests)
// Pure-helper tests always run regardless of sample availability.

import { test } from 'vitest';
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
  detectLayout,
} from './loadOhioAOS.js';
import { loadOhioAOSBatch } from './loadOhioAOSBatch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(__dirname, '..', '_oh-recon', 'City_2024_GAAP_Summarized.XLSX');
const HAVE_SAMPLE = existsSync(SAMPLE);
const CASH_SAMPLE = join(__dirname, '..', '_oh-recon', 'City_2024_CASH_Summarized.XLSX');
const HAVE_CASH_SAMPLE = existsSync(CASH_SAMPLE);
const COUNTY_GAAP_SAMPLE = join(__dirname, '..', '_oh-recon', 'County_2024_GAAP_Summarized.XLSX');
const HAVE_COUNTY_SAMPLE = existsSync(COUNTY_GAAP_SAMPLE);
const COUNTY_CASH_SAMPLE = join(__dirname, '..', '_oh-recon', 'County_2024_CASH_Summarized.XLSX');
const HAVE_COUNTY_CASH_SAMPLE = existsSync(COUNTY_CASH_SAMPLE);
const COUNTY_MOD_SAMPLE = join(__dirname, '..', '_oh-recon', 'County_2024_MOD_Summarized.XLSX');
const HAVE_COUNTY_MOD_SAMPLE = existsSync(COUNTY_MOD_SAMPLE);

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

// ── Phase 85 — batch dry-run tests ────────────────────────────────────────────

const BOTH_SAMPLES = HAVE_SAMPLE && HAVE_CASH_SAMPLE;

test(
  'FY2024 dry-run batch: processed ≥200, Columbus=GAAP, ≥1 CASH assignment, zero failures, zero writes',
  { skip: !BOTH_SAMPLES && 'recon samples absent (_oh-recon/City_2024_GAAP_Summarized.XLSX + _oh-recon/City_2024_CASH_Summarized.XLSX)' },
  async () => {
    const result = await loadOhioAOSBatch({
      fy: 2024,
      fileGaap: SAMPLE,
      fileCash: CASH_SAMPLE,
      dryRun: true,
    });

    // Processed count
    assert.ok(result.processed >= 200,
      `Expected ≥200 cities processed, got ${result.processed}`);

    // GAAP dominates (≥200 GAAP assignments)
    assert.ok(result.assigned.GAAP >= 200,
      `Expected ≥200 GAAP-assigned cities, got ${result.assigned.GAAP}`);

    // At least one CASH assignment (proves fallback path exercised)
    assert.ok((result.assigned.CASH || 0) >= 1,
      `Expected ≥1 CASH-assigned city (fallback path); got ${result.assigned.CASH}`);

    // Columbus is GAAP (D-02 GAAP wins over CASH for cities in both)
    const columbusResult = result.results.find((r) => r.cityName === 'Columbus');
    assert.ok(columbusResult, 'Columbus must be in the results');
    assert.equal(columbusResult.basis, 'GAAP',
      `Columbus must be assigned GAAP; got ${columbusResult.basis}`);

    // Zero failures (no parse errors)
    assert.equal(result.failures.length, 0,
      `Expected zero failures; got: ${JSON.stringify(result.failures)}`);

    // Zero writes (dry-run): verify no municipality IDs were returned (only dryRun summaries)
    const hasWrites = result.results.some((r) => r.municipalityId != null);
    assert.equal(hasWrites, false,
      'dry-run must not write to Supabase — no municipalityId should be present');

    // Residual is defined (array, may be empty for FY2024)
    assert.ok(Array.isArray(result.residual),
      'result.residual must be an array');
  }
);

// ── Phase 86 — county enumeration + county dry-run tests ─────────────────────

test(
  'enumerateCities on FY2024 GAAP county workbook returns ≥60 names including "Ashland County"',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample _oh-recon/County_2024_GAAP_Summarized.XLSX absent' },
  async () => {
    const countyWb = new ExcelJS.Workbook();
    await countyWb.xlsx.readFile(COUNTY_GAAP_SAMPLE);

    const names = enumerateCities(countyWb);
    assert.ok(Array.isArray(names), 'enumerateCities must return an array');
    assert.ok(names.length >= 60,
      `Expected ≥60 county names, got ${names.length}`);
    assert.ok(names.includes('Ashland County'),
      `"Ashland County" must be in the county roster; got: ${names.slice(0, 5).join(', ')}...`);

    // No empty entries
    const empties = names.filter((n) => !n || !n.trim());
    assert.equal(empties.length, 0, `Found ${empties.length} empty county names in roster`);

    // No duplicates
    const unique = new Set(names);
    assert.equal(unique.size, names.length,
      `Duplicate county names found: ${names.filter((n, i) => names.indexOf(n) !== i).join(', ')}`);
  }
);

test(
  'FY2024 county dry-run batch: ≥60 processed, Ashland County present, zero failures, zero writes',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample _oh-recon/County_2024_GAAP_Summarized.XLSX absent' },
  async () => {
    const result = await loadOhioAOSBatch({
      fy: 2024,
      entityType: 'county',
      fileGaap: COUNTY_GAAP_SAMPLE,
      dryRun: true,
    });

    // Processed ≥60 (GAAP has 63 counties in FY2024)
    assert.ok(result.processed >= 60,
      `Expected ≥60 counties processed, got ${result.processed}`);

    // GAAP counties assigned
    assert.ok(result.assigned.GAAP >= 60,
      `Expected ≥60 GAAP-assigned counties, got ${result.assigned.GAAP}`);

    // Ashland County is present in results
    const ashlandResult = result.results.find((r) => r.cityName === 'Ashland County');
    assert.ok(ashlandResult, '"Ashland County" must be in the county dry-run results');

    // Zero failures
    assert.equal(result.failures.length, 0,
      `Expected zero failures; got: ${JSON.stringify(result.failures)}`);

    // Zero writes (dry-run): no municipalityId on any result
    const hasWrites = result.results.some((r) => r.municipalityId != null);
    assert.equal(hasWrites, false,
      'dry-run must not write to Supabase — no municipalityId should be present');

    // Residual is defined (may be non-empty if some OI_Demographics-only counties exist)
    assert.ok(Array.isArray(result.residual),
      'result.residual must be an array');
  }
);

// ── Phase 86-04 — county-layout regression tests ─────────────────────────────

let countyGaapWb = null;
async function countyWorkbook() {
  if (countyGaapWb) return countyGaapWb;
  countyGaapWb = new ExcelJS.Workbook();
  await countyGaapWb.xlsx.readFile(COUNTY_GAAP_SAMPLE);
  return countyGaapWb;
}

test(
  'detectLayout(county GAAP wb, "county") returns headerRow=6, expTotalCol=32 (not city row 7 / col 35)',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample _oh-recon/County_2024_GAAP_Summarized.XLSX absent' },
  async () => {
    const wb = await countyWorkbook();
    const layout = detectLayout(wb, 'county');
    assert.equal(layout.headerRow, 6,
      `County GAAP headerRow must be 6 (not 7); got ${layout.headerRow}`);
    assert.equal(layout.dataStart, 7,
      `County GAAP dataStart must be 7; got ${layout.dataStart}`);
    assert.equal(layout.entityCol, 1,
      `County GAAP entityCol must be 1; got ${layout.entityCol}`);
    assert.equal(layout.revTotalCol, 16,
      `County GAAP revTotalCol must be 16; got ${layout.revTotalCol}`);
    assert.equal(layout.expTotalCol, 32,
      `County GAAP expTotalCol must be 32 (not city's 35); got ${layout.expTotalCol}`);
    // expFuncCols must stop at 31, not 34 (no Inception Of Lease / OFS columns)
    assert.equal(layout.expFuncCols[layout.expFuncCols.length - 1], 31,
      `County GAAP expFuncCols must end at col 31; got ${layout.expFuncCols[layout.expFuncCols.length - 1]}`);
  }
);

test(
  'detectLayout(county GAAP wb) with default city entityType still returns city layout',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample absent' },
  async () => {
    // This test guards against regression: the county workbook's SOREACIFB_TotalGov sheet
    // must NOT activate county layout when entityType defaults to city.
    // (In practice, city callers never pass county workbooks — this confirms the guard works.)
    const wb = await countyWorkbook();
    const layout = detectLayout(wb);  // default 'city'
    assert.equal(layout.headerRow, 7,
      `Default city layout must still use headerRow 7; got ${layout.headerRow}`);
    assert.equal(layout.expTotalCol, 35,
      `Default city layout must still use expTotalCol 35; got ${layout.expTotalCol}`);
  }
);

test(
  'enumerateCities(county GAAP wb, "county") includes "Allen County" (recovered) AND "Franklin County"',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample absent' },
  async () => {
    const wb = await countyWorkbook();
    const names = enumerateCities(wb, 'county');
    assert.ok(names.includes('Allen County'),
      '"Allen County" must be in county roster — Allen County was previously dropped by city-layout misread');
    assert.ok(names.includes('Franklin County'),
      '"Franklin County" must be in county roster');
    assert.ok(names.length >= 60,
      `Expected ≥60 county names; got ${names.length}`);
  }
);

test(
  'buildRevenueTree(county GAAP, "Franklin County", "county"): text labels, no numeric nodes, total matches col 16',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample absent' },
  async () => {
    const wb = await countyWorkbook();
    const { tree, total } = buildRevenueTree(wb, 'Franklin County', 'county');

    // No numeric node names (the exact regression: city layout read header as data row 7)
    const numericNodes = tree.filter((n) => /^-?[0-9]+(\.[0-9]+)?$/.test(n.n));
    assert.equal(numericNodes.length, 0,
      `County revenue tree must have no numeric node names (regression guard); numeric found: ${JSON.stringify(numericNodes.map((n) => n.n))}`);

    // "Property Taxes" must be present as a labeled source
    const propertyTaxes = tree.find((n) => /property\s*tax/i.test(n.n));
    assert.ok(propertyTaxes,
      '"Property Taxes" must be present as a labeled revenue source in county tree');

    // All amounts are finite
    const nonFinite = tree.filter((n) => !Number.isFinite(n.a));
    assert.equal(nonFinite.length, 0,
      `All county revenue amounts must be finite; non-finite: ${JSON.stringify(nonFinite)}`);

    // Total is a finite number
    assert.ok(typeof total === 'number' && Number.isFinite(total),
      `Franklin County revenue total must be a finite number; got ${total}`);

    // Total matches workbook col 16 = 1811422000 (verified 2026-06-25)
    const FRANKLIN_REV_COL16 = 1811422000;
    assert.equal(total, FRANKLIN_REV_COL16,
      `Franklin County revenue total must equal workbook col 16 (${FRANKLIN_REV_COL16}); got ${total}`);
  }
);

test(
  'buildExpenditureTree(county GAAP, "Franklin County", "county"): text labels, total matches col 32, no OFS nodes',
  { skip: !HAVE_COUNTY_SAMPLE && 'recon sample absent' },
  async () => {
    const wb = await countyWorkbook();
    const { tree, total } = buildExpenditureTree(wb, 'Franklin County', 'county');

    // No numeric node names
    const numericNodes = tree.filter((n) => /^-?[0-9]+(\.[0-9]+)?$/.test(n.n));
    assert.equal(numericNodes.length, 0,
      `County expenditure tree must have no numeric node names; numeric found: ${JSON.stringify(numericNodes.map((n) => n.n))}`);

    // No OFS / fund-balance / transfer nodes (D-04b — col 33+ excluded)
    const forbidden = tree.filter((n) =>
      /inception\s*of\s*lease|transfers?\s*in|excess\s*of\s*revenues|net\s*change|fund\s*balance|sale\s*of\s*capital/i.test(n.n)
    );
    assert.equal(forbidden.length, 0,
      `OFS/fund-balance columns must be excluded (D-04b); found: ${JSON.stringify(forbidden.map((n) => n.n))}`);

    // Total is finite
    assert.ok(typeof total === 'number' && Number.isFinite(total),
      `Franklin County expenditure total must be a finite number; got ${total}`);

    // Total matches workbook col 32 = 1913193000 (verified 2026-06-25)
    const FRANKLIN_EXP_COL32 = 1913193000;
    assert.equal(total, FRANKLIN_EXP_COL32,
      `Franklin County expenditure total must equal workbook col 32 (${FRANKLIN_EXP_COL32}); got ${total}`);
  }
);

test(
  'detectLayout(county CASH wb, "county") returns correct layout (entityCol=1, expTotalCol=32)',
  { skip: !HAVE_COUNTY_CASH_SAMPLE && 'recon sample _oh-recon/County_2024_CASH_Summarized.XLSX absent' },
  async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(COUNTY_CASH_SAMPLE);
    const layout = detectLayout(wb, 'county');
    assert.equal(layout.basis, 'CASH_OR_MOD', `County CASH basis must be CASH_OR_MOD; got ${layout.basis}`);
    assert.equal(layout.entityCol, 1,
      `County CASH entityCol must be 1 (not city CASH's 2); got ${layout.entityCol}`);
    assert.equal(layout.expTotalCol, 32,
      `County CASH expTotalCol must be 32 (not city CASH's 37); got ${layout.expTotalCol}`);
    const names = enumerateCities(wb, 'county');
    assert.ok(names.length > 0, 'County CASH workbook must have county names');
    const numericNames = names.filter((n) => /^-?[0-9]+$/.test(n));
    assert.equal(numericNames.length, 0,
      `County CASH enumerated names must be text, not numeric; numeric: ${JSON.stringify(numericNames)}`);
  }
);

test(
  'detectLayout(county MOD wb, "county") returns correct layout (entityCol=1, expTotalCol=32)',
  { skip: !HAVE_COUNTY_MOD_SAMPLE && 'recon sample _oh-recon/County_2024_MOD_Summarized.XLSX absent' },
  async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(COUNTY_MOD_SAMPLE);
    const layout = detectLayout(wb, 'county');
    assert.equal(layout.basis, 'CASH_OR_MOD', `County MOD basis must be CASH_OR_MOD; got ${layout.basis}`);
    assert.equal(layout.entityCol, 1,
      `County MOD entityCol must be 1; got ${layout.entityCol}`);
    assert.equal(layout.expTotalCol, 32,
      `County MOD expTotalCol must be 32; got ${layout.expTotalCol}`);
    const names = enumerateCities(wb, 'county');
    assert.ok(names.length > 0, 'County MOD workbook must have county names');
  }
);

test(
  'City no-regression: Columbus expenditure total unchanged by county layout changes (city layout still uses col 35)',
  { skip: !HAVE_SAMPLE && 'recon sample _oh-recon/City_2024_GAAP_Summarized.XLSX absent' },
  async () => {
    const { tree, total } = buildExpenditureTree(await workbook(), 'Columbus');  // default 'city'
    // Recon-verified: $2,477,440,000
    assert.ok(total > 2e9,
      `Columbus expenditure total must be > $2B (city layout unchanged); got ${total}`);
    // No numeric node names in city tree either
    const numericNodes = tree.filter((n) => /^-?[0-9]+$/.test(n.n));
    assert.equal(numericNodes.length, 0,
      `City expenditure tree must have no numeric node names; numeric: ${JSON.stringify(numericNodes.map((n) => n.n))}`);
  }
);
