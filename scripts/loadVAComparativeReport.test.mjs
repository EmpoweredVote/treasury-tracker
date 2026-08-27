// Offline unit tests for the VA APA Comparative Report loader (Phase 79 — VASRC-01).
// Run: npx vitest run scripts/loadVAComparativeReport.test.mjs
//
// Asserts against the recon sample (_va-recon/fy2024-comparative-report.xlsx). That file is
// gitignored; when absent (fresh clone), the data-backed tests SKIP rather than fail, but the
// pure-helper tests always run.

import { test } from 'vitest';
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
  findLocalityRowInSection,
  findHeaderRow,
  townPopulationFromExhibitA,
  DATA_SOURCE_NAME,
} from './loadVAComparativeReport.js';
import { enumerateRoster } from './loadVAComparativeReportBatch.js';

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

// ── Phase 80: roster segmentation + section-aware homonym safety ──────────────
test('enumerateRoster segments Exhibit C into 38 cities / 95 counties / 37 towns', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const r = enumerateRoster(await workbook());
  assert.equal(r.cities.length, 38, `cities ${r.cities.length}`);
  assert.equal(r.counties.length, 95, `counties ${r.counties.length}`);
  assert.equal(r.towns.length, 37, `towns ${r.towns.length}`);
  assert.equal(r.cities[0], 'Alexandria');
  // "Total"/"Grand Total" summary rows (numeric col-1) must NOT leak into the roster.
  assert.ok(!r.cities.includes('Total') && !r.counties.includes('Total') && !r.towns.includes('Grand Total'));
  // Homonyms appear in BOTH the cities and counties lists.
  for (const h of ['Fairfax', 'Richmond', 'Franklin', 'Roanoke']) {
    assert.ok(r.cities.includes(h) && r.counties.includes(h), `${h} in both city + county rosters`);
  }
});

test('homonym safety: county totals differ from same-named city (section-scoped lookup)', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  for (const name of ['Fairfax', 'Richmond']) {
    const city = buildExpenditureTree(w, name, 0).total;   // §0 = cities
    const county = buildExpenditureTree(w, name, 1).total;  // §1 = counties
    assert.ok(city > 0 && county > 0, `${name} both sections have data`);
    assert.notEqual(city, county, `${name} county total must differ from city total`);
  }
  // Population is likewise section-distinct.
  assert.notEqual(localityPopulation(w, 'Fairfax', 0), localityPopulation(w, 'Fairfax', 1));
});

test('section scoping: a town-only name resolves in §2 but not §0/§1', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  const ws = w.getWorksheet('Exhibit C');
  const hdr = findHeaderRow(ws);
  // "Abingdon" is the first town (§2) — present there, absent from cities (§0) and counties (§1).
  assert.ok(findLocalityRowInSection(ws, hdr, 'Abingdon', 2), 'Abingdon found in towns section');
  assert.throws(() => findLocalityRowInSection(ws, hdr, 'Abingdon', 0), /not found in section 0/);
  assert.throws(() => findLocalityRowInSection(ws, hdr, 'Abingdon', 1), /not found in section 1/);
});

test('absent locality (chronic late-filer) yields total 0, never NaN', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  // Accomack County ships with zero data + an uncached total formula in FY2023+FY2024.
  const exp = buildExpenditureTree(w, 'Accomack', 1);
  const rev = buildRevenueTree(w, 'Accomack', 1);
  assert.equal(exp.total, 0, 'absent expenditure total is 0');
  assert.equal(rev.total, 0, 'absent revenue total is 0');
  assert.ok(!Number.isNaN(exp.total) && !Number.isNaN(rev.total), 'never NaN');
});

test('backward-compat: section-less calls unchanged (Phase 79 global path)', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  assert.ok(Math.abs(buildExpenditureTree(w, 'Alexandria').total - 863578347) <= 1);
  assert.ok(Math.abs(buildRevenueTree(w, 'Alexandria').total - 874230660) <= 1);
  assert.equal(localityPopulation(w, 'Alexandria'), 158591);
});

// ── Phase 81: town segmentation, population fallback, bare-name safety ────────
test('enumerateRoster towns: 37 towns including Abingdon + Wytheville, no Total/Grand Total', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const r = enumerateRoster(await workbook());
  assert.equal(r.towns.length, 37, `towns ${r.towns.length}`);
  assert.ok(r.towns.includes('Abingdon'), 'includes Abingdon');
  assert.ok(r.towns.includes('Wytheville'), 'includes Wytheville');
  assert.ok(!r.towns.includes('Total'), 'excludes "Total"');
  assert.ok(!r.towns.includes('Grand Total'), 'excludes "Grand Total"');
});

test('town population fallback: Leesburg resolves from Exhibit A (finite > 0)', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  // Exhibit H has no town section — localityPopulation must fall back to Exhibit A.
  const pop = localityPopulation(w, 'Leesburg', 2);
  assert.ok(typeof pop === 'number' && Number.isFinite(pop) && pop > 0,
    `Leesburg population from Exhibit A is finite > 0, got ${pop}`);
  // Also verify directly via townPopulationFromExhibitA helper.
  const popDirect = townPopulationFromExhibitA(w, 'Leesburg', 2);
  assert.ok(typeof popDirect === 'number' && popDirect > 0,
    `townPopulationFromExhibitA Leesburg finite > 0, got ${popDirect}`);
});

test('cities + counties still get Exhibit H population (unchanged path)', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  // Alexandria (city §0) — must match Exhibit H expected value.
  assert.equal(localityPopulation(w, 'Alexandria', 0), 158591, 'Alexandria Exhibit H unchanged');
  // Falls Church (city §0).
  assert.equal(localityPopulation(w, 'Falls Church', 0), 15675, 'Falls Church Exhibit H unchanged');
  // Fairfax County (§1) — should resolve from Exhibit H (non-null).
  const fairfaxPop = localityPopulation(w, 'Fairfax', 1);
  assert.ok(typeof fairfaxPop === 'number' && fairfaxPop > 0, `Fairfax County pop ${fairfaxPop}`);
});

test('absent-from-both town returns null without throwing', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  const pop = localityPopulation(w, 'NonExistentTownXYZ', 2);
  assert.equal(pop, null, 'absent town returns null');
  const popDirect = townPopulationFromExhibitA(w, 'NonExistentTownXYZ', 2);
  assert.equal(popDirect, null, 'townPopulationFromExhibitA absent returns null');
});

test('bare-name safety: no town name equals any city name (zero collisions)', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const r = enumerateRoster(await workbook());
  const citySet = new Set(r.cities.map((n) => n.toLowerCase()));
  const collisions = r.towns.filter((t) => citySet.has(t.toLowerCase()));
  assert.equal(collisions.length, 0, `town/city bare-name collisions: ${collisions.join(', ')}`);
});

test('town/county overlap: Orange resolves distinct trees at §2 vs "Orange County" at §1', { skip: !HAVE_SAMPLE && 'recon sample absent' }, async () => {
  const w = await workbook();
  // Town of Orange is §2 (bare name "Orange"); county is stored as "Orange County" (display name)
  // but the XLSX match name is bare "Orange" in §1.
  const townExp = buildExpenditureTree(w, 'Orange', 2);
  const countyExp = buildExpenditureTree(w, 'Orange', 1);
  assert.ok(townExp.total > 0, `town Orange has expenditure data`);
  assert.ok(countyExp.total > 0, `Orange County has expenditure data`);
  assert.notEqual(townExp.total, countyExp.total, 'town and county totals are distinct (section-scoped)');
});
