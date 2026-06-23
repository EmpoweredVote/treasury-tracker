#!/usr/bin/env node
/**
 * Phase 82 — offline tests for the VA enrichment map + loader helpers.
 * Pure: imports VA_ENRICHMENT/EXPECTED_KEYS + buildRows/findDollarLeaks/findLocalityLeaks only.
 * No DB / network access (the loader's main() is entry-guarded).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VA_ENRICHMENT, EXPECTED_KEYS } from '../data/vaEnrichment82.mjs';
import { buildRows, findDollarLeaks, findLocalityLeaks } from './loadVAEnrichment82.mjs';

// The 73 live VA keys verified against production 2026-06-23. The map MUST cover every one.
const LIVE_KEYS = [
  // operating depth-0 (10)
  'community development', 'education', 'general government administration', 'health and human services',
  'judicial administration', 'non- departmental', 'parks, recreation, and cultural', 'public safety',
  'public works', 'virginia general fund budget',
  // operating depth-1 (28)
  'community development|cooperative extension program', 'community development|environmental management',
  'community development|planning and community development', 'general government administration|board of elections',
  'general government administration|general and financial administration', 'general government administration|legislative',
  'health and human services|behavioral health and developmental services', 'health and human services|health',
  'health and human services|income support benefits social services', "judicial administration|commonwealth's attorney",
  'judicial administration|courts', 'parks, recreation, and cultural|cultural enrichment',
  'parks, recreation, and cultural|parks and recreation', 'parks, recreation, and cultural|public libraries',
  'public safety|correction and detention', 'public safety|fire and rescue services', 'public safety|inspections',
  'public safety|law enforcement and traffic control', 'public safety|other protection',
  'public works|maintenance of general buildings and grounds',
  'public works|maintenance of highways, streets, bridges, and sidewalks', 'public works|sanitation and waste removal',
  'virginia general fund budget|education', 'virginia general fund budget|general government',
  'virginia general fund budget|health and human services', 'virginia general fund budget|natural resources and commerce',
  'virginia general fund budget|other programs', 'virginia general fund budget|public safety and corrections',
  // revenue depth-0 (8)
  'charges for services', 'fines and forfeitures', 'general property taxes', 'miscellaneous', 'other local taxes',
  'permits, privilege fees, and regulatory licenses', 'revenue from use of money and property', 'virginia general fund revenue',
  // revenue depth-1 (27)
  'general property taxes|interest', 'general property taxes|machinery and tools', "general property taxes|merchants' capital",
  'general property taxes|penalties', 'general property taxes|personal property - general',
  'general property taxes|personal property - mobile home', 'general property taxes|public service corporations',
  'general property taxes|real property', 'other local taxes|admission taxes', 'other local taxes|bank stock taxes',
  'other local taxes|business license taxes', 'other local taxes|coal, oil, and gas taxes',
  'other local taxes|consumer utility taxes', 'other local taxes|franchise license taxes',
  'other local taxes|hotel and motel room taxes', 'other local taxes|local sales and use taxes',
  'other local taxes|motor vehicle license taxes', 'other local taxes|other local taxes',
  'other local taxes|recordation and will taxes', 'other local taxes|restaurant food taxes',
  'other local taxes|tobacco taxes', 'revenue from use of money and property|interest',
  'revenue from use of money and property|rental and sale of property',
  'virginia general fund revenue|corporate income tax', 'virginia general fund revenue|individual income tax',
  'virginia general fund revenue|other taxes and fees', 'virginia general fund revenue|sales and use tax',
];

// A representative slice of the live VA municipalities.name list (incl. the state node + common-word towns).
const VA_NAMES = [
  'Virginia', 'Alexandria', 'Fairfax', 'Fairfax County', 'Roanoke', 'Roanoke County', 'Richmond', 'Norfolk',
  'Chesapeake', 'Harrisonburg', 'Falls Church', 'Virginia Beach', 'Franklin', 'Salem', 'Orange', 'Marion', 'Wise', 'Bedford',
];

test('LIVE_KEYS has exactly 73 keys', () => {
  assert.equal(LIVE_KEYS.length, 73);
});

test('VA_ENRICHMENT + EXPECTED_KEYS cover every live key (100% coverage, no fallback)', () => {
  assert.equal(EXPECTED_KEYS.length, 73);
  const { rows, missing } = buildRows(LIVE_KEYS);
  assert.equal(missing.length, 0, `unmapped live keys: ${missing.join(', ')}`);
  assert.equal(rows.length, 73);
  for (const k of LIVE_KEYS) assert.ok(VA_ENRICHMENT[k], `missing map entry: ${k}`);
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
  const { rows, missing } = buildRows([...LIVE_KEYS, 'some bogus unmapped fund']);
  assert.deepEqual(missing, ['some bogus unmapped fund']);
  assert.equal(rows.length, 73);
});

test('no $-figure anywhere in authored text', () => {
  const { rows } = buildRows(LIVE_KEYS);
  assert.equal(findDollarLeaks(rows).length, 0);
});

test('no VA locality name in authored text (state-node "Virginia" excluded)', () => {
  const { rows } = buildRows(LIVE_KEYS);
  const leaks = findLocalityLeaks(rows, VA_NAMES);
  assert.equal(leaks.length, 0, `leaks: ${leaks.map(l => `${l.name_key}<-${l.leaked}`).join(', ')}`);
});

test('locality-name guard DOES catch a planted leak', () => {
  const planted = [{ name_key: 'x', plain_name: 'Roanoke Police', short_description: 'in Roanoke', description: 'serves Roanoke residents' }];
  const leaks = findLocalityLeaks(planted, VA_NAMES);
  assert.equal(leaks.length, 1);
  assert.equal(leaks[0].leaked, 'roanoke');
});

test('the two "interest" composites carry distinct, parent-correct descriptions', () => {
  const taxInt = VA_ENRICHMENT['general property taxes|interest'];
  const invInt = VA_ENRICHMENT['revenue from use of money and property|interest'];
  assert.notEqual(taxInt.description, invInt.description);
  assert.match(taxInt.description, /delinquent|overdue|late/i);
  assert.match(invInt.description, /invest/i);
});

test('miscellaneous is a revenue catch-all, not "Information Technology"', () => {
  const misc = VA_ENRICHMENT['miscellaneous'];
  assert.notEqual(misc.plain_name, 'Information Technology');
  assert.match(misc.plain_name, /revenue/i);
});
