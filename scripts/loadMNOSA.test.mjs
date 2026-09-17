// Offline unit tests for the MN OSA loader (Phase 89 — MNSRC-01/02).
// Run: npx vitest run scripts/loadMNOSA.test.mjs
//
// Asserts against the recon samples (gitignored — absent on fresh clone → data-backed tests SKIP):
//   _mn-recon/cired_23_data.xlsx   (city FY2023 — Minneapolis GAAP + Ada/Adams Cash-basis)
//   _mn-recon/county_21_data.xlsx  (county FY2021 — county layout, no GAAPInd/ParentEntityName)
// Pure-helper tests always run regardless of sample availability.

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ExcelJS from 'exceljs';
import {
  cellNum,
  normalizeLabel,
  buildRevenueTree,
  buildExpenditureTree,
  entityPopulation,
  entityCounty,
  entityBasis,
  resolveSourceUrl,
  enumerateEntities,
  entityGovId,
  enumerateEntityKeys,
  importEntity,
  DATA_SOURCE_NAME,
} from './loadMNOSA.js';
import { loadMNOSABatch } from './loadMNOSABatch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CITY_SAMPLE = join(__dirname, '..', '_mn-recon', 'cired_23_data.xlsx');
const HAVE_CITY = existsSync(CITY_SAMPLE);
const COUNTY_SAMPLE = join(__dirname, '..', '_mn-recon', 'county_21_data.xlsx');
const HAVE_COUNTY = existsSync(COUNTY_SAMPLE);

let _cityWb = null;
async function cityWb() {
  if (_cityWb) return _cityWb;
  _cityWb = new ExcelJS.Workbook();
  await _cityWb.xlsx.readFile(CITY_SAMPLE);
  return _cityWb;
}
let _countyWb = null;
async function countyWb() {
  if (_countyWb) return _countyWb;
  _countyWb = new ExcelJS.Workbook();
  await _countyWb.xlsx.readFile(COUNTY_SAMPLE);
  return _countyWb;
}

const sumTop = (tree) => tree.reduce((s, n) => s + n.a, 0);
/** Recursively collect every node name in a tree (any depth). */
function allNames(tree, acc = []) {
  for (const n of tree) { acc.push(n.n); if (n.c) allNames(n.c, acc); }
  return acc;
}
/** A node is a leaf when it has no non-empty children. */
const isLeaf = (n) => !n.c || n.c.length === 0;

// ── Pure helpers (always run) ────────────────────────────────────────────────
test('cellNum reads numbers and formula .result, rejects derived/text', () => {
  assert.equal(cellNum({ value: 476724343 }), 476724343);
  assert.equal(cellNum({ value: { result: 913985 } }), 913985);
  assert.ok(Number.isNaN(cellNum({ value: { formula: 'A1+B1' } }))); // no cached numeric result
  assert.ok(Number.isNaN(cellNum({ value: { richText: [{ text: 'Total' }] } })));
  assert.ok(Number.isNaN(cellNum(null)));
  assert.equal(cellNum({ value: '$1,234' }), 1234);
});

test('DATA_SOURCE_NAME is the durable MN label', () => {
  assert.equal(DATA_SOURCE_NAME, 'Minnesota Office of the State Auditor City/County Finances Report');
});

test('normalizeLabel ties city/county spacing+typo variants (D-08)', () => {
  // space removal: county "Conservation ofNatural" == city "Conservation of Natural"
  assert.equal(
    normalizeLabel('Conservation ofNatural Resources Current Expend'),
    normalizeLabel('Conservation of Natural Resources Current Expend')
  );
  // alias: city "Ecenomic" typo maps to canonical "Economic"
  assert.equal(
    normalizeLabel('Ecenomic Development Capital Outlay'),
    normalizeLabel('Economic Development Capital Outlay')
  );
  // case-insensitive: "Library current" == "Library Current"
  assert.equal(normalizeLabel('Library current Expenditures'), normalizeLabel('Library Current Expenditures'));
});

test('resolveSourceUrl reads city vs county url per FY from the manifest (D-05)', () => {
  assert.match(resolveSourceUrl(2023, 'city'), /cired_23_data\.xlsx$/);
  assert.match(resolveSourceUrl(2021, 'county'), /county_21_-data\.xlsx$/);
  assert.equal(resolveSourceUrl(2023, 'county'), null); // no county data for FY2023
  assert.equal(resolveSourceUrl(1999, 'city'), null);   // out of range
});

// ── City data-backed tests (skip if the recon sample is absent) ───────────────
test('Minneapolis FY2023 revenue tree ties to Total Revenues + is 3-level (D-04)', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  const { tree, total } = buildRevenueTree(wb, 'Minneapolis', 'city');
  // self-consistency: tree sum === row Total Revenues
  assert.ok(Math.abs(sumTop(tree) - total) < 1, `tree sum ${sumTop(tree)} must equal Total Revenues ${total}`);
  assert.ok(total > 1e9, 'Minneapolis revenue is ~$1.2B');
  // Intergovernmental is a 3-level group: group -> sub-group (with children) -> leaves
  const ig = tree.find((n) => n.n === 'Intergovernmental');
  assert.ok(ig && ig.c && ig.c.length > 0, 'Intergovernmental present with children (D-04)');
  const fed = ig.c.find((n) => n.n === 'Federal Grants');
  assert.ok(fed && fed.c && fed.c.length > 0, 'Federal Grants sub-group has grant-type leaves (3-level)');
  // every amount finite
  assert.ok(allNames(tree).length > 0);
  const finite = (t) => t.every((n) => Number.isFinite(n.a) && (isLeaf(n) || finite(n.c)));
  assert.ok(finite(tree), 'every node amount is a finite number');
  // no excluded financing / validation-only labels appear as nodes (D-03/D-05)
  const names = allNames(tree);
  for (const bad of ['Total Revenues & Other Sources', 'BondsIssued', 'Transfers From Enterprise Funds']) {
    assert.ok(!names.includes(bad), `${bad} must not be a tree node`);
  }
});

test('Minneapolis FY2023 expenditure tree ties to Total Expenditures + has current/capital leaves (D-02)', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  const { tree, total } = buildExpenditureTree(wb, 'Minneapolis', 'city');
  assert.ok(Math.abs(sumTop(tree) - total) < 1, `tree sum ${sumTop(tree)} must equal Total Expenditures ${total}`);
  // at least one function has nested current/capital leaves (D-02)
  const hasCurrentCapital = tree.some((fn) => fn.c && fn.c.some((sub) =>
    (sub.c && sub.c.some((leaf) => leaf.n === 'Current' || leaf.n === 'Capital')) || sub.n === 'Current' || sub.n === 'Capital'));
  assert.ok(hasCurrentCapital, 'at least one function exposes Current/Capital leaves (D-02)');
  // no cross-function rollup or excluded financing node (D-03/D-05)
  const names = allNames(tree);
  for (const bad of ['Total Current Expenditures', 'Total Capital Outlay', 'Total Public Safety Capital Outlay',
    'Total Expenditures & Other Uses', 'Other Financing Uses']) {
    assert.ok(!names.includes(bad), `${bad} must not be a tree node (D-03/D-05)`);
  }
});

test('Minneapolis identity: GAAP basis, Hennepin parent, finite population', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  assert.equal(entityBasis(wb, 'Minneapolis', 'city'), 'GAAP');
  assert.equal(entityCounty(wb, 'Minneapolis', 'city'), 'Hennepin');
  assert.ok(Number.isFinite(entityPopulation(wb, 'Minneapolis', 'city')));
});

test('Cash-basis cities (D-07) parse + tie + report Cash basis', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  for (const city of ['Ada', 'Adams']) {
    assert.equal(entityBasis(wb, city, 'city'), 'Cash', `${city} is Cash basis`);
    const r = buildRevenueTree(wb, city, 'city');
    const e = buildExpenditureTree(wb, city, 'city');
    assert.ok(Math.abs(sumTop(r.tree) - r.total) < 1, `${city} revenue ties`);
    assert.ok(Math.abs(sumTop(e.tree) - e.total) < 1, `${city} expenditure ties`);
  }
});

test('D-03 double-count guard holds on real Minneapolis data (subtotal groups tie)', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  // buildRevenueTree throws if any subtotal_label group's children don't tie to the workbook subtotal.
  assert.doesNotThrow(() => buildRevenueTree(wb, 'Minneapolis', 'city'));
  // Intergovernmental parent .a equals the sum of its sub-group children (no double-count).
  const { tree } = buildRevenueTree(wb, 'Minneapolis', 'city');
  const ig = tree.find((n) => n.n === 'Intergovernmental');
  assert.ok(Math.abs(ig.a - sumTop(ig.c)) < 1, 'Intergovernmental parent === sum of children (no double-count)');
});

// ── County data-backed tests (skip if the recon sample is absent) — D-08 ──────
test('County FY2021 parses through the SAME builders + ties (D-08)', { skip: !HAVE_COUNTY }, async () => {
  const wb = await countyWb();
  for (const county of ['Aitkin', 'Anoka']) {
    const r = buildRevenueTree(wb, county, 'county');
    const e = buildExpenditureTree(wb, county, 'county');
    assert.ok(Math.abs(sumTop(r.tree) - r.total) < 1, `${county} revenue ties to Total Revenues`);
    assert.ok(Math.abs(sumTop(e.tree) - e.total) < 1, `${county} expenditure ties to Total Expenditures`);
    assert.ok(r.total > 0 && e.total > 0, `${county} has non-zero totals`);
  }
});

test('County files have no GAAPInd / no ParentEntityName — handled gracefully (D-08)', { skip: !HAVE_COUNTY }, async () => {
  const wb = await countyWb();
  assert.equal(entityBasis(wb, 'Aitkin', 'county'), null, 'no GAAPInd column → basis null');
  assert.equal(entityCounty(wb, 'Aitkin', 'county'), '', 'no ParentEntityName column → empty parent');
  assert.ok(Number.isFinite(entityPopulation(wb, 'Aitkin', 'county')), 'county population still read');
});

// ── Phase 90: roster enumeration + batch driver ──────────────────────────────
test('enumerateEntities returns the full city roster (no empties/dups, incl. Minneapolis)', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  const names = enumerateEntities(wb, 'city');
  assert.ok(names.length >= 800, `expected >=800 cities, got ${names.length}`);
  assert.ok(names.includes('Minneapolis'), 'roster includes Minneapolis');
  assert.ok(names.includes('Saint Paul'), 'roster includes Saint Paul (source spelling)');
  assert.equal(names.filter((n) => !n).length, 0, 'no empty entity names');
  assert.equal(names.length, new Set(names).size, 'no duplicate entity names');
});

test('enumerateEntities is layout-agnostic — works on the county sheet too (D-08)', { skip: !HAVE_COUNTY }, async () => {
  const wb = await countyWb();
  const names = enumerateEntities(wb, 'county');
  assert.ok(names.length > 0 && names.includes('Aitkin'), 'county roster includes Aitkin');
});

// ⚠ Explicit timeout: this walks an 851-city workbook, so its duration tracks
// disk contention, not the code under test. vitest's 5s default fails it under
// load; node --test (this file's previous runner) had no default at all, which
// is why the need was invisible until the file was actually wired into the suite.
test('loadMNOSABatch FY2023 dry-run processes the full roster, zero writes, GAAP+Cash both present', { skip: !HAVE_CITY, timeout: 120_000 }, async () => {
  const res = await loadMNOSABatch({ fy: 2023, file: CITY_SAMPLE, dryRun: true });
  assert.ok(res.processed >= 800, `processed ${res.processed} cities`);
  assert.equal(res.failures.length, 0, 'zero per-city failures');
  assert.ok(res.basis.GAAP >= 1 && res.basis.Cash >= 1, 'per-row GAAPInd path exercised across the roster (both GAAP and Cash present)');
  const mpls = res.results.find((r) => r.entityName === 'Minneapolis');
  assert.ok(mpls && mpls.basis === 'GAAP', 'Minneapolis assigned GAAP');
  assert.ok(Math.abs(mpls.revenueTotal - 1192133233) < 1, 'Minneapolis revenue matches the Phase 89 proof');
});

// ── Phase 91: county batch + municipalityName override ────────────────────────
test('importEntity municipalityName overrides the DB display name (county canonical naming, D-02)', { skip: !HAVE_COUNTY }, async () => {
  const wb = await countyWb();
  // dry-run importEntity returns summary without touching Supabase
  const { importEntity } = await import('./loadMNOSA.js');
  const s = await importEntity(null, wb, { entityName: 'Aitkin', municipalityName: 'Aitkin County', fiscalYear: 2021, entityType: 'county', dryRun: true });
  assert.equal(s.entityName, 'Aitkin County', 'summary display name uses the municipalityName override');
  assert.ok(s.revenueTotal > 0 && s.operatingTotal > 0, 'tree totals still resolve via the bare workbook lookup name');
  assert.equal(s.basis, null, 'county has no GAAPInd → basis null');
});

test('loadMNOSABatch --entity-type county dry-run: ~87 counties, "<Name> County" names, no GAAPInd, zero writes', { skip: !HAVE_COUNTY }, async () => {
  const res = await loadMNOSABatch({ fy: 2021, entityType: 'county', file: COUNTY_SAMPLE, dryRun: true });
  assert.equal(res.entityType, 'county');
  assert.ok(res.processed >= 80, `processed ${res.processed} counties`);
  assert.equal(res.failures.length, 0, 'zero per-county failures');
  assert.equal(res.basis.GAAP + res.basis.Cash, 0, 'counties have no GAAPInd (all unknown)');
  const aitkin = res.results.find((r) => r.entityName === 'Aitkin County');
  assert.ok(aitkin, 'county DB name is "Aitkin County" (municipalityName applied)');
  assert.ok(Math.abs(aitkin.revenueTotal - 36720288) < 1, 'Aitkin County revenue ties to the Phase 89 figure');
});

// ── Approach C: identity by the publisher's own id (GovEntityID) ──────────────
//
// ⚠⚠ THE DEFECT THESE GUARD AGAINST IS SILENT. MN OSA re-spelled two cities and
// each time a SECOND entity was created, the history was severed at that year,
// and every total still tied. Nothing failed. These tests assert the id the
// prevention rests on is actually read — from the real published workbooks.

const FY20_SAMPLE = join(__dirname, '..', '_mn-recon', 'cired_20_data.xlsx');
const FY22_SAMPLE = join(__dirname, '..', '_mn-recon', 'cired_22_data.xlsx');
const HAVE_RENAME_PAIR = existsSync(FY20_SAMPLE) && existsSync(FY22_SAMPLE);

test('entityGovId reads the publisher id from the city layout', { skip: !HAVE_CITY }, async () => {
  const wb = await cityWb();
  const id = entityGovId(wb, 'Minneapolis', 'city');
  assert.ok(id, 'Minneapolis carries a GovEntityID');
  // ⚠ A STRING, never a number: it is an identifier, and the column is text in
  // some files and numeric in others. Arithmetic on it is always a bug.
  assert.equal(typeof id, 'string');
});

test('entityGovId returns null on the county layout — approach C is city-only here', { skip: !HAVE_COUNTY }, async () => {
  const wb = await countyWb();
  // MEASURED: county workbooks print no GovEntityID at all (county_20_data.xlsx
  // starts at `Entity Name`). Absence must be null, not a throw — counties fall
  // through to name identity exactly as before.
  assert.equal(entityGovId(wb, 'Aitkin', 'county'), null);
});

test('⭐ the id survives the rename that forked Birchwood', { skip: !HAVE_RENAME_PAIR, timeout: 60_000 }, async () => {
  const wb20 = new ExcelJS.Workbook();
  await wb20.xlsx.readFile(FY20_SAMPLE);
  const wb22 = new ExcelJS.Workbook();
  await wb22.xlsx.readFile(FY22_SAMPLE);

  //   FY2020  "Birchwood"          -> 168
  //   FY2022  "Birchwood Village"  -> 168      the name changed, the id did not
  const before = entityGovId(wb20, 'Birchwood', 'city');
  const after = entityGovId(wb22, 'Birchwood Village', 'city');
  assert.equal(before, '168');
  assert.equal(after, before, 'the whole mechanism rests on this equality');
});

test('enumerateEntityKeys returns one row per published id, and nothing for counties', { skip: !HAVE_CITY, timeout: 60_000 }, async () => {
  const wb = await cityWb();
  const pairs = enumerateEntityKeys(wb, 'city');
  assert.ok(pairs.length > 800, `roster has ${pairs.length} entities with an id`);
  assert.equal(new Set(pairs.map((p) => p.govEntityId)).size, pairs.length, 'ids are distinct');
  assert.ok(pairs.every((p) => p.name && p.govEntityId), 'every pair carries both halves');

  // ⚠ Unlike enumerateEntities(), this is NOT filtered to cities that filed
  // financials: a city that filed nothing still has an identity worth keying.
  assert.ok(pairs.length >= enumerateEntities(wb, 'city').length);

  if (HAVE_COUNTY) assert.deepEqual(enumerateEntityKeys(await countyWb(), 'county'), []);
});

test('importEntity hands the publisher id to the lookup — and null where there is none', { skip: !HAVE_CITY }, async () => {
  const calls = [];
  // Minimal stand-in: records the ensure call, then reports "no existing budget"
  // and swallows the two writes.
  const stub = {
    rpc: async (fn, args) => {
      calls.push({ fn, args });
      return { data: fn === 'treasury_ensure_municipality' ? 'stub-municipality-id' : { ok: true }, error: null };
    },
    schema: () => ({
      from: () => ({
        select: () => ({ eq: function () { return this; }, limit: async () => ({ data: [], error: null }) }),
      }),
    }),
  };

  const wb = await cityWb();
  await importEntity(stub, wb, { entityName: 'Minneapolis', fiscalYear: 2023, entityType: 'city' });
  const ensure = calls.find((c) => c.fn === 'treasury_ensure_municipality');
  assert.ok(ensure, 'importEntity resolves identity through the one door');
  assert.equal(ensure.args.p_source, DATA_SOURCE_NAME, 'the key is scoped by the same source stamped on the rows');
  assert.ok(ensure.args.p_source_entity_key, 'the GovEntityID reaches the RPC');
  assert.equal(typeof ensure.args.p_source_entity_key, 'string');

  if (HAVE_COUNTY) {
    const countyCalls = [];
    const countyStub = { ...stub, rpc: async (fn, args) => { countyCalls.push({ fn, args }); return { data: 'stub-id', error: null }; } };
    await importEntity(countyStub, await countyWb(), {
      entityName: 'Aitkin', municipalityName: 'Aitkin County', fiscalYear: 2021, entityType: 'county',
    });
    const c = countyCalls.find((x) => x.fn === 'treasury_ensure_municipality');
    // No id in the county layout → both halves null, i.e. today's name lookup.
    assert.equal(c.args.p_source, null);
    assert.equal(c.args.p_source_entity_key, null);
  }
});
