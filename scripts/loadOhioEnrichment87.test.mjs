#!/usr/bin/env node
/**
 * Phase 87 — offline tests for the Ohio enrichment map + loader helpers.
 * Pure: imports OHIO_ENRICHMENT/EXPECTED_KEYS + buildRows/findDollarLeaks/findLocalityLeaks only.
 * No DB / network access (the loader's main() is entry-guarded).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OHIO_ENRICHMENT, EXPECTED_KEYS } from '../data/ohioEnrichment87.mjs';
import { buildRows, findDollarLeaks, findLocalityLeaks } from './loadOhioEnrichment87.mjs';

// The 51 live OH distinct keys verified by inspection of the vocabulary in 87-CONTEXT.md.
// (17 revenue + 35 operating = 52 named, minus 1 for the shared 'intergovernmental' key
// that appears in both revenue and operating trees but is ONE distinct name_key.)
const LIVE_KEYS = [
  // revenue depth-0 (16 — 'intergovernmental' listed under operating as it's shared)
  'charges for services',
  'contributions and donations',
  'fines and forfeitures',
  'income taxes',
  'interest',
  'intergovernmental revenues',
  'licenses and permits',
  'other receipts',
  'other revenues',
  'payment in lieu of taxes',
  'property taxes',
  'receipts in lieu of taxes',
  'rentals',
  'revenue in lieu of taxes',
  'sales taxes',
  'special assessments',
  // operating depth-0 (35, including the shared 'intergovernmental')
  'basic utility service',
  'bond issuance costs',
  'capital outlay',
  'community and economic development',
  'conservation and recreation',
  'debt service bond issuance costs',
  'debt service interest and fiscal charges',
  'debt service other',
  'debt service principal retirement',
  'fire',
  'general government',
  'general government judicial',
  'general government legislative and executive',
  'health',
  'human services',
  'intergovernmental',
  'intergovernmental expenditures',
  'interest and fiscal charges',
  'judicial',
  'legislative and executive',
  'leisure time activities',
  'other',
  'other disbursements',
  'other expenditures',
  'police',
  'principal retirement',
  'public health',
  'public safety',
  'public services',
  'public works',
  'security of persons and property',
  'security of persons and property fire',
  'security of persons and property other',
  'security of persons and property police',
  'transportation',
];

// A representative slice of the live OH municipalities.name list
// (incl. some skip-set words that should NOT fire the locality guard).
const OH_NAMES = [
  'Ohio',
  'Columbus',
  'Cleveland',
  'Cincinnati',
  'Toledo',
  'Akron',
  'Dayton',
  'Parma',
  'Canton',
  'Youngstown',
  'Lorain',
  'Hamilton',
  'Springfield',
  'Kettering',
  'Elyria',
  'Lakewood',
  'Cuyahoga Falls',
  'Dublin',
  'Mentor',
  'Findlay',
  'Marion',
  'Newark',
  'Franklin',
  'Lebanon',
  'Milford',
  'Independence',
];

test('LIVE_KEYS has exactly 51 keys', () => {
  assert.equal(LIVE_KEYS.length, 51);
});

test('OHIO_ENRICHMENT + EXPECTED_KEYS cover every live key (100% coverage, no fallback)', () => {
  assert.equal(EXPECTED_KEYS.length, 51);
  const { rows, missing } = buildRows(LIVE_KEYS);
  assert.equal(missing.length, 0, `unmapped live keys: ${missing.join(', ')}`);
  assert.equal(rows.length, 51);
  for (const k of LIVE_KEYS) assert.ok(OHIO_ENRICHMENT[k], `missing map entry: ${k}`);
});

test('every built row is a universal AI row with required fields', () => {
  const { rows } = buildRows(LIVE_KEYS);
  for (const r of rows) {
    assert.equal(r.municipality_id, null);
    assert.equal(r.source, 'ai');
    assert.ok(r.plain_name && r.short_description && r.description, `incomplete row: ${r.name_key}`);
    assert.ok(Array.isArray(r.tags) && r.tags.length >= 1);
  }
});

test('a synthetic unmapped key is reported missing (coverage gate fires)', () => {
  const { rows, missing } = buildRows([...LIVE_KEYS, '__fake_key__']);
  assert.deepEqual(missing, ['__fake_key__']);
  assert.equal(rows.length, 51);
});

test('no $-figure anywhere in authored text', () => {
  const { rows } = buildRows(LIVE_KEYS);
  assert.equal(findDollarLeaks(rows).length, 0);
});

test('no OH locality name in authored text (skip-set names excluded)', () => {
  const { rows } = buildRows(LIVE_KEYS);
  const leaks = findLocalityLeaks(rows, OH_NAMES);
  assert.equal(leaks.length, 0, `leaks: ${leaks.map(l => `${l.name_key}<-${l.leaked}`).join(', ')}`);
});

test('locality-name guard DOES catch a planted leak', () => {
  const planted = [{ name_key: 'x', plain_name: 'Columbus Police', short_description: 'in Columbus', description: 'serves Columbus residents' }];
  const leaks = findLocalityLeaks(planted, OH_NAMES);
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].leaked, 'columbus');
});

test('locality-name guard does NOT flag a skip-set word (Ohio/Marion)', () => {
  const planted = [{ name_key: 'x', plain_name: 'Ohio local government', short_description: 'Marion County services', description: 'local government in Ohio near Marion' }];
  const leaks = findLocalityLeaks(planted, OH_NAMES);
  assert.equal(leaks.length, 0, `should not flag skip-set names; got: ${leaks.map(l => `${l.name_key}<-${l.leaked}`).join(', ')}`);
});

test('dollar-leak guard catches a seeded row with a $-figure', () => {
  const seeded = [{ name_key: 'y', plain_name: 'Budget', short_description: 'Costs $5 million', description: 'A service that costs about $5 per resident' }];
  assert.equal(findDollarLeaks(seeded).length, 1);
});

test('synonym-cluster entries each have their own row', () => {
  // In-lieu taxes cluster
  for (const k of ['payment in lieu of taxes', 'receipts in lieu of taxes', 'revenue in lieu of taxes']) {
    assert.ok(OHIO_ENRICHMENT[k], `missing in-lieu tax key: ${k}`);
  }
  // Intergovernmental cluster
  for (const k of ['intergovernmental', 'intergovernmental revenues', 'intergovernmental expenditures']) {
    assert.ok(OHIO_ENRICHMENT[k], `missing intergovernmental key: ${k}`);
  }
  // Debt service cluster
  for (const k of ['principal retirement', 'debt service principal retirement', 'interest and fiscal charges',
                   'debt service interest and fiscal charges', 'bond issuance costs', 'debt service bond issuance costs', 'debt service other']) {
    assert.ok(OHIO_ENRICHMENT[k], `missing debt service key: ${k}`);
  }
  // Public safety cluster
  for (const k of ['police', 'fire', 'security of persons and property', 'security of persons and property fire',
                   'security of persons and property other', 'security of persons and property police', 'public safety']) {
    assert.ok(OHIO_ENRICHMENT[k], `missing public safety key: ${k}`);
  }
});
