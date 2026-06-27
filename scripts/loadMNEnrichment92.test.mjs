#!/usr/bin/env node
/**
 * Phase 92 — offline tests for the MN enrichment map + loader helpers.
 * Pure: imports CONCEPTS/EXPECTED_CONCEPTS + buildRows/findDollarLeaks/findLocalityLeaks/lastSegment only.
 * No DB / network access (the loader's main() is entry-guarded).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS, EXPECTED_CONCEPTS } from '../data/mnEnrichment92.mjs';
import { buildRows, findDollarLeaks, findLocalityLeaks, lastSegment, GUARD_NAME_SKIP } from './loadMNEnrichment92.mjs';

// The 136 live MN distinct composite keys verified by DB extraction (2026-06-27).
// Depth 0 = 25 keys, Depth 1 = 72 keys, Depth 2 = 39 keys.
const LIVE_KEYS = [
  // depth-0 (25)
  'airport',
  'all other revenue',
  'cemetery',
  'charges for services',
  'conservation of natural resources',
  'debt service',
  'economic development',
  'education',
  'fines and forfeits',
  'general government',
  'health',
  'housing & urban redevelopment',
  'human services',
  'interest earnings',
  'intergovernmental',
  'library',
  'licenses and permits',
  'other & unallocated',
  'park & recreation',
  'public safety',
  'sanitation',
  'special assessments',
  'streets & highways',
  'taxes',
  'transit',
  // depth-1 (72)
  'airport|capital',
  'airport|current',
  'cemetery|capital',
  'cemetery|current',
  'charges for services|airport fees',
  'charges for services|all other service charges',
  'charges for services|cemetery fees',
  'charges for services|edahrasvccharge',
  'charges for services|general government fees',
  'charges for services|library fees',
  'charges for services|other public safety fees',
  'charges for services|park and recreation fees',
  'charges for services|police and fire contracts',
  'charges for services|sanitation fees',
  'charges for services|street and highway fees',
  'charges for services|transit fees',
  'conservation of natural resources|capital',
  'conservation of natural resources|current',
  'debt service|bond principal payments',
  'debt service|interest payments & fiscal charges',
  'debt service|other long-term debt principal payments',
  'economic development|capital',
  'economic development|current',
  'fines and forfeits|adminfines',
  'fines and forfeits|fines and forfeits',
  'general government|capital',
  'general government|current',
  'health|capital',
  'health|current',
  'housing & urban redevelopment|capital',
  'housing & urban redevelopment|current',
  'human services|all other human services current expenditures',
  'human services|human service income maintenance',
  'human services|human services capital outlay',
  'human services|human services social services',
  'intergovernmental|county/local grants',
  'intergovernmental|federal grants',
  'intergovernmental|state grants',
  'library|capital',
  'library|current',
  'other & unallocated|all other capital outlay',
  'other & unallocated|all other current expend',
  'other & unallocated|capital outlay for enterprise funds',
  'other & unallocated|unallocated insurance costs',
  'other & unallocated|unallocated pension costs',
  'park & recreation|capital',
  'park & recreation|current',
  'public safety|all other public safety',
  'public safety|ambulance',
  'public safety|corrections',
  'public safety|fire',
  'public safety|police/sheriff',
  'sanitation|all other sanitation current expend',
  'sanitation|refuse collection and disposal current expend',
  'sanitation|sanitation capital outlay',
  'streets & highways|all other street & highway capital outlay',
  'streets & highways|snow and ice removal',
  'streets & highways|street & highway administration',
  'streets & highways|street & highway construction',
  'streets & highways|street & highway engineering',
  'streets & highways|street & highway maintenance',
  'streets & highways|street lighting',
  'taxes|franchisefees',
  'taxes|gamblingtax',
  'taxes|graveltax',
  'taxes|hotelmoteltax',
  'taxes|propertytaxes',
  'taxes|salestax',
  'taxes|tax increments',
  'taxes|wheelagetax',
  'transit|capital',
  'transit|current',
  // depth-2 (39)
  'general government|current|administration and finance current expend',
  'general government|current|all other general government current expend',
  'general government|current|governing board current expend',
  'intergovernmental|county/local grants|all other county grants',
  'intergovernmental|county/local grants|all other local grants',
  'intergovernmental|county/local grants|county highway grants',
  'intergovernmental|county/local grants|local irrrb grants',
  'intergovernmental|federal grants|all other federal grants',
  'intergovernmental|federal grants|fedcoronavirusrelieffunds',
  'intergovernmental|federal grants|federal cdbg grants',
  'intergovernmental|federal grants|federal education grants',
  'intergovernmental|federal grants|federal emergency management aid',
  'intergovernmental|federal grants|federal human services grants',
  'intergovernmental|federal grants|federal transportation grants',
  'intergovernmental|state grants|all other state grants',
  'intergovernmental|state grants|state county program aid',
  'intergovernmental|state grants|state disparity reduction aid',
  'intergovernmental|state grants|state education grants',
  'intergovernmental|state grants|state human service grants',
  'intergovernmental|state grants|state local government aid',
  'intergovernmental|state grants|state manufactured home homestead credit',
  'intergovernmental|state grants|state market value credit ag',
  'intergovernmental|state grants|state market value credit real',
  'intergovernmental|state grants|state pera aid',
  'intergovernmental|state grants|state police aid',
  'intergovernmental|state grants|state taconite aids',
  'intergovernmental|state grants|state taconite homestead credit',
  'intergovernmental|state grants|state transportation grants',
  'intergovernmental|state grants|statetownaid',
  'public safety|all other public safety|capital',
  'public safety|all other public safety|current',
  'public safety|ambulance|capital',
  'public safety|ambulance|current',
  'public safety|corrections|capital',
  'public safety|corrections|current',
  'public safety|fire|capital',
  'public safety|fire|current',
  'public safety|police/sheriff|capital',
  'public safety|police/sheriff|current',
];

// Representative slice of MN municipality names (incl. names that should NOT fire the guard).
const MN_NAMES = [
  'Minnesota',
  'Minneapolis',
  'Saint Paul',
  'Rochester',
  'Duluth',
  'Bloomington',
  'Brooklyn Park',
  'Plymouth',
  'St. Cloud',
  'Woodbury',
  'Maple Grove',
  'Lakeville',
  'Burnsville',
  'Apple Valley',
  'Edina',
  'Eagan',
  'Coon Rapids',
  'Champlin',
  'Brooklyn Center',
  'Anoka',
  'Fridley',
  'Richfield',
  'Minnetonka',
  'Savage',
  'Blaine',
  'Shakopee',
  'Maplewood',
  'Moorhead',
  'Mankato',
  'Cottage Grove',
  // county names
  'Hennepin County',
  'Ramsey County',
  'Dakota County',
  'Anoka County',
  'Washington County',
];

test('LIVE_KEYS has exactly 136 keys', () => {
  assert.equal(LIVE_KEYS.length, 136, `expected 136, got ${LIVE_KEYS.length}`);
});

test('CONCEPTS covers all 136 live keys (100% coverage, no fallback)', () => {
  const { rows, missing } = buildRows(LIVE_KEYS);
  assert.equal(missing.length, 0, `unmapped live keys: ${missing.join(', ')}`);
  assert.equal(rows.length, 136);
});

test('every built row is a universal AI row with required fields', () => {
  const { rows } = buildRows(LIVE_KEYS);
  for (const r of rows) {
    assert.equal(r.municipality_id, null, `municipality_id should be null: ${r.name_key}`);
    assert.equal(r.source, 'ai', `source should be ai: ${r.name_key}`);
    assert.ok(r.plain_name && r.plain_name.length > 0, `missing plain_name: ${r.name_key}`);
    assert.ok(r.short_description && r.short_description.length > 0, `missing short_description: ${r.name_key}`);
    assert.ok(r.description && r.description.length > 0, `missing description: ${r.name_key}`);
    assert.ok(Array.isArray(r.tags) && r.tags.length >= 1, `missing tags: ${r.name_key}`);
    assert.equal(r.name_key, r.name_key, 'name_key is the full composite');
  }
});

test('name_key of each row equals the full composite live key (not just the last segment)', () => {
  const { rows } = buildRows(LIVE_KEYS);
  const keySet = new Set(LIVE_KEYS);
  for (const r of rows) {
    assert.ok(keySet.has(r.name_key), `row name_key "${r.name_key}" is not a live key`);
  }
});

test('a composite depth-1 key resolves correctly (taxes|propertytaxes -> last seg = propertytaxes)', () => {
  assert.equal(lastSegment('taxes|propertytaxes'), 'propertytaxes');
  const { rows, missing } = buildRows(['taxes|propertytaxes']);
  assert.equal(missing.length, 0);
  assert.equal(rows[0].name_key, 'taxes|propertytaxes');
  assert.ok(rows[0].plain_name.toLowerCase().includes('property'));
});

test('a composite depth-2 key resolves correctly (intergovernmental|state grants|state local government aid)', () => {
  const key = 'intergovernmental|state grants|state local government aid';
  assert.equal(lastSegment(key), 'state local government aid');
  const { rows, missing } = buildRows([key]);
  assert.equal(missing.length, 0);
  assert.equal(rows[0].name_key, key);
});

test('a synthetic unmapped last-segment is reported missing (coverage gate fires)', () => {
  const fakeKey = 'taxes|__nope__key__';
  const { rows, missing } = buildRows([...LIVE_KEYS, fakeKey]);
  assert.ok(missing.includes(fakeKey), `expected "${fakeKey}" in missing`);
  assert.equal(rows.length, 136); // real keys still build
});

test('no $-figure anywhere in authored text', () => {
  const { rows } = buildRows(LIVE_KEYS);
  const leaks = findDollarLeaks(rows);
  assert.equal(leaks.length, 0, `$-leaks: ${leaks.map(r => r.name_key).join(', ')}`);
});

test('no MN locality name in authored text (skip-set names excluded)', () => {
  const { rows } = buildRows(LIVE_KEYS);
  const leaks = findLocalityLeaks(rows, MN_NAMES);
  assert.equal(leaks.length, 0, `locality leaks: ${leaks.map(l => `${l.name_key}<-${l.leaked}`).join(', ')}`);
});

test('locality-name guard DOES catch a planted MN city name', () => {
  // Minneapolis is a real MN city, not in skip-set
  const planted = [{ name_key: 'x', plain_name: 'Minneapolis Police', short_description: 'serves Minneapolis', description: 'local police in Minneapolis' }];
  const leaks = findLocalityLeaks(planted, MN_NAMES);
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].leaked, 'minneapolis');
});

test('locality-name guard does NOT flag "minnesota" (it is in skip-set)', () => {
  const planted = [{ name_key: 'x', plain_name: 'Local Government Aid', short_description: 'aid to local governments', description: 'Aid distributed to local governments throughout the state' }];
  // Even if 'minnesota' were in the names list, it should be skipped
  const leaks = findLocalityLeaks(planted, ['Minnesota']);
  assert.equal(leaks.length, 0, `"minnesota" should be in skip-set; got: ${leaks.map(l => l.leaked).join(', ')}`);
});

test('dollar-leak guard catches a seeded row with a $-figure', () => {
  const seeded = [{ name_key: 'test', plain_name: 'Budget', short_description: 'Costs $5 million', description: 'A service that costs about $5 per resident' }];
  assert.equal(findDollarLeaks(seeded).length, 1);
});

test('EXPECTED_CONCEPTS lists all concept keys (matches CONCEPTS object)', () => {
  assert.deepEqual(EXPECTED_CONCEPTS.sort(), Object.keys(CONCEPTS).sort());
  assert.ok(EXPECTED_CONCEPTS.length >= 85, `expected >= 85 concepts, got ${EXPECTED_CONCEPTS.length}`);
});

test('depth-0 keys each map to their full key as the last-segment concept', () => {
  const depth0 = LIVE_KEYS.slice(0, 25); // first 25 are depth-0
  for (const k of depth0) {
    assert.ok(!k.includes('|'), `expected depth-0 key without separator: ${k}`);
    assert.equal(lastSegment(k), k);
    assert.ok(CONCEPTS[k], `missing concept for depth-0 key: ${k}`);
  }
});

test('current and capital concepts exist (generic operating-vs-investment)', () => {
  assert.ok(CONCEPTS['current'], 'missing concept: current');
  assert.ok(CONCEPTS['capital'], 'missing concept: capital');
  assert.ok(CONCEPTS['current'].description.toLowerCase().includes('operat'), '"current" description should mention operating');
  assert.ok(CONCEPTS['capital'].description.toLowerCase().includes('capital'), '"capital" description should mention capital');
});

test('state local government aid concept exists and is generic (not MN-specific)', () => {
  const c = CONCEPTS['state local government aid'];
  assert.ok(c, 'missing state local government aid concept');
  assert.ok(!/minnesota/i.test(c.description), 'description should not mention Minnesota');
  assert.ok(!/\$\d/.test(c.description), 'description should not contain $ figures');
});
