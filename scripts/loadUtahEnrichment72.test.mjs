// Phase 72 — offline tests for the Utah enrichment resolver + bleed-safety.
// No network: imports resolve* and the concept libraries only (the loader's DB main()
// runs only when executed as the entry script).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, resolveFund, resolveDept } from './loadUtahEnrichment72.mjs';
import { UTAH_FUND_CONCEPTS, UTAH_COUNTY_CONCEPTS, UTAH_FUND_ROUTES, UTAH_DEPT_EXTRA_ROUTES } from '../data/utahEnrichment72.mjs';
import { CONCEPTS } from '../data/caParityEnrichment61.mjs';

const UT_CITIES = ['layton', 'lehi', 'ogden', 'orem', 'provo', 'sandy', 'st. george', 'west jordan', 'west valley', 'salt lake'];

test('fund key routes to a Utah fund concept', () => {
  assert.equal(resolve('general fund', 'fund').row, UTAH_FUND_CONCEPTS.general_fund);
  assert.equal(resolve('sewer fund', 'fund').row, UTAH_FUND_CONCEPTS.sewer_fund);
  assert.equal(resolve('debt service fund', 'fund').row, UTAH_FUND_CONCEPTS.debt_service);
  assert.equal(resolve('police impact fee fund', 'fund').row, UTAH_FUND_CONCEPTS.police_impact_fee);
  assert.equal(resolve('redevelopment agency', 'fund').row, UTAH_FUND_CONCEPTS.redevelopment_agency);
  assert.equal(resolve('b&c road', 'fund').row, UTAH_FUND_CONCEPTS.bc_road);
});

test('water vs water-reclamation/sewer fund ordering is correct', () => {
  // 'water reclamation' must hit sewer_fund (wastewater), not water_fund.
  assert.equal(resolve('enterprise fund - water reclamation fund', 'fund').row, UTAH_FUND_CONCEPTS.sewer_fund);
  assert.equal(resolve('water fund', 'fund').row, UTAH_FUND_CONCEPTS.water_fund);
});

test('unknown fund key falls back to general_fund (always written)', () => {
  const r = resolve('some unrecognized holding pool', 'fund');
  assert.equal(r.row, UTAH_FUND_CONCEPTS.general_fund);
  assert.equal(r.via, 'fallback:general_fund');
  assert.equal(r.defer, false);
});

test('composite key routes the dept portion after the last pipe', () => {
  assert.equal(resolve('general fund|police', 'composite').row, CONCEPTS.police);
  assert.equal(resolve('general fund|human resources', 'composite').row, CONCEPTS.human_resources);
  assert.equal(resolve('ambulance fund|fire', 'composite').row, CONCEPTS.fire);
});

test('composite with an unrecognized dept gets general_dept and is WRITTEN (not deferred)', () => {
  const r = resolve('general fund|zzz special unit', 'composite');
  assert.equal(r.row, CONCEPTS.general_dept);
  assert.equal(r.defer, false);
});

test('county departments route to fresh county concepts (not CA mis-mappings)', () => {
  assert.equal(resolve('assessor', 'dept').row, UTAH_COUNTY_CONCEPTS.assessor);
  assert.equal(resolve('recorder', 'dept').row, UTAH_COUNTY_CONCEPTS.recorder);
  assert.equal(resolve('sheriff', 'dept').row, UTAH_COUNTY_CONCEPTS.sheriff);
  assert.equal(resolve('surveyor', 'dept').row, UTAH_COUNTY_CONCEPTS.surveyor);
  assert.equal(resolve('justice court', 'dept').row, UTAH_COUNTY_CONCEPTS.justice_court);
  assert.equal(resolve("children's justice center", 'dept').row, UTAH_COUNTY_CONCEPTS.childrens_justice_center);
  assert.equal(resolve('clerk/auditor', 'dept').row, UTAH_COUNTY_CONCEPTS.clerk_auditor);
});

test('overlapping city departments still reuse the CA concept library', () => {
  assert.equal(resolve('police', 'dept').row, CONCEPTS.police);
  assert.equal(resolve('public works', 'dept').row, CONCEPTS.public_works);
  assert.equal(resolve('finance', 'dept').row, CONCEPTS.finance);
  assert.equal(resolve('attorney', 'dept').row, CONCEPTS.city_attorney); // supplemental route
});

test('unknown salary dept hits general_dept and is DEFERRED (not written)', () => {
  const r = resolve('zzqx idiosyncratic taskforce alpha', 'dept');
  assert.equal(r.row, CONCEPTS.general_dept);
  assert.equal(r.via, 'fallback:general_dept');
  assert.equal(r.defer, true);
});

test('no concept text contains a dollar figure or a Utah city name (bleed-safe)', () => {
  const allText = JSON.stringify({ UTAH_FUND_CONCEPTS, UTAH_COUNTY_CONCEPTS });
  assert.ok(!/\$\s?\d/.test(allText), 'dollar figure leaked into concept text');
  const low = allText.toLowerCase();
  for (const c of UT_CITIES) assert.ok(!low.includes(c), `city name leaked: ${c}`);
});

test('every route conceptId exists in its library', () => {
  for (const [, id] of UTAH_FUND_ROUTES) assert.ok(UTAH_FUND_CONCEPTS[id], `missing fund concept ${id}`);
  for (const [, id] of UTAH_DEPT_EXTRA_ROUTES) assert.ok(UTAH_COUNTY_CONCEPTS[id], `missing county concept ${id}`);
});
