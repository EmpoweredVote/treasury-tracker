/**
 * Offline unit tests for scripts/loadStateGF.mjs pure helpers.
 * No DB / no network. Run: node --test scripts/loadStateGF.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampForRender, categoryLabel, buildCategoryLeaf, buildOperatingTree,
  validateAgainstControl, dataSourceLabel, sourceDate, isAcfrOccupied, __STATES,
} from './loadStateGF.mjs';

test('clampForRender clamps negatives to 0, leaves non-negatives (P2)', () => {
  assert.equal(clampForRender(-5_000), 0);
  assert.equal(clampForRender(0), 0);
  assert.equal(clampForRender(1_200_000_000), 1_200_000_000);
});

test('categoryLabel flags negatives with their true value, leaves positives clean (P2)', () => {
  assert.equal(categoryLabel('Investment Earnings', -1_200_000_000), 'Investment Earnings (net −$1.20B — shown at 0)');
  assert.equal(categoryLabel('Medicaid', 3_398_000_000), 'Medicaid');
});

test('buildCategoryLeaf: negative leaf renders at 0 area but keeps signed value in label (P2)', () => {
  const leaf = buildCategoryLeaf({ name: 'Investment Earnings', total: -2_000_000_000 });
  assert.equal(leaf.a, 0);
  assert.match(leaf.n, /net −\$2\.00B/);
  assert.deepEqual(leaf.i, []);
});

test('buildOperatingTree: root label, sorted desc, drops zeros, total = source control (P2/P3/P5)', () => {
  const entry = {
    controlTotalGF: 100_000_000_000,
    categories: [
      { name: 'Big', total: 60_000_000_000 },
      { name: 'Small', total: 40_000_000_000 },
      { name: 'Zero', total: 0 },
    ],
  };
  const { jsonTree, total, rowCount } = buildOperatingTree('Georgia', entry);
  assert.equal(jsonTree[0].n, 'Georgia General Fund Budget');
  assert.equal(total, 100_000_000_000);                 // carries source control, not leaf sum
  assert.equal(rowCount, 2);                            // zero dropped
  assert.deepEqual(jsonTree[0].c.map(c => c.n), ['Big', 'Small']); // sorted desc
});

test('buildOperatingTree retains a negative category (shown at 0, not dropped) (P2)', () => {
  const entry = {
    controlTotalGF: 50_000_000_000,
    categories: [
      { name: 'Taxes', total: 51_000_000_000 },
      { name: 'Investment Earnings', total: -1_000_000_000 },
    ],
  };
  const { jsonTree, rowCount } = buildOperatingTree('Test', entry);
  assert.equal(rowCount, 2);                            // negative retained
  const neg = jsonTree[0].c.find(c => c.n.includes('Investment'));
  assert.equal(neg.a, 0);
  assert.match(neg.n, /net −/);
});

test('validateAgainstControl: GA real data ties within tolerance', () => {
  const v = validateAgainstControl(__STATES.GA.operating[2023]);
  assert.equal(v.ok, true);
  assert.ok(v.diff / v.control < 0.005, `diff ${v.diff} should be <0.5% of ${v.control}`);
});

test('validateAgainstControl: a mismatched control fails the cross-check', () => {
  const bad = { controlTotalGF: 10_000_000_000, categories: [{ name: 'A', total: 8_000_000_000 }] };
  assert.equal(validateAgainstControl(bad).ok, false);
});

test('GA categories are all checksum-positive-or-zero and sum is correct', () => {
  const cats = __STATES.GA.operating[2023].categories;
  const sum = cats.reduce((s, c) => s + c.total, 0);
  assert.equal(sum, 29_266_000_000);                    // 7-function sum after F-97-01 (Medicaid 3,398→3,390); ties controlTotalGF
  for (const c of cats) assert.ok(c.total >= 0, `${c.name} non-negative`);
});

test('dataSourceLabel carries the basis label + FY (P3)', () => {
  const l = dataSourceLabel(2023);
  assert.match(l, /budgetary basis/);
  assert.match(l, /FY2023 actual/);
  assert.match(l, /NASBO State Expenditure Report/);
});

test('sourceDate uses the state fiscal-year end (P4)', () => {
  assert.equal(sourceDate('GA', 2023), '2023-06-30');
  assert.equal(sourceDate('ZZ', 2023), '2023-06-30');   // default 06-30
});

test('isAcfrOccupied never-overwrite-ACFR guard: absent → false, NASBO-self → false, ACFR/other → true (NASBORT-01)', () => {
  // Absent node → NASBO fallback may fill it.
  assert.equal(isAcfrOccupied(null), false);
  assert.equal(isAcfrOccupied(''), false);
  // Node is itself NASBO → allow idempotent refresh of the two remaining fallback nodes.
  assert.equal(isAcfrOccupied('NASBO State Expenditure Report — General Fund (FY2024 actual, budgetary basis)'), false);
  // ACFR source occupies the node → protect it, never overwrite.
  assert.equal(isAcfrOccupied('Nevada State ACFR — General Fund (FY2023 actual, GAAP basis)'), true);
  assert.equal(isAcfrOccupied('Kentucky State ACFR — General Fund (FY2024 actual, GAAP basis)'), true);
});

// ── Alabama cohort-state tests (6-function 2025 SER taxonomy) ─────────────────────────
// Figures extracted from 2025 NASBO SER via pdftotext -table; dual-checksum verified.
// Alabama is NOT in STATES yet (added in Plan 03); entries are built inline here.

const AL_FY2023 = {
  confidence: 'actual',
  controlTotalGF: 13_764_000_000,  // Table 1 GF FY2023 (2025 SER)
  categories: [
    { name: 'Elementary & Secondary Education', total: 6_300_000_000 },
    { name: 'Higher Education',                  total: 3_037_000_000 },
    { name: 'Medicaid',                          total:   813_000_000 },
    { name: 'Corrections',                       total:   759_000_000 },
    { name: 'Transportation',                    total:             0 },
    { name: 'All Other',                         total: 2_855_000_000 },
  ],
};

const AL_FY2024 = {
  confidence: 'actual',
  controlTotalGF: 13_511_000_000,  // Table 1 GF FY2024 (2025 SER)
  categories: [
    { name: 'Elementary & Secondary Education', total: 6_389_000_000 },
    { name: 'Higher Education',                  total: 2_629_000_000 },
    { name: 'Medicaid',                          total:   855_000_000 },
    { name: 'Corrections',                       total:   846_000_000 },
    { name: 'Transportation',                    total:             0 },
    { name: 'All Other',                         total: 2_792_000_000 },
  ],
};

test('validateAgainstControl: Alabama FY2023 ties to Table 1 GF with 0 diff (2025 SER, 6-function)', () => {
  const v = validateAgainstControl(AL_FY2023);
  assert.equal(v.ok, true, `ok should be true; diff=${v.diff}, control=${v.control}`);
  assert.ok(v.diff / v.control < 0.005, `diff ${v.diff} should be <0.5% of ${v.control}`);
  assert.equal(v.diff, 0, `expect 0-diff checksum; got ${v.diff}`);
});

test('validateAgainstControl: Alabama FY2024 ties to Table 1 GF with 0 diff (2025 SER, 6-function)', () => {
  const v = validateAgainstControl(AL_FY2024);
  assert.equal(v.ok, true, `ok should be true; diff=${v.diff}, control=${v.control}`);
  assert.ok(v.diff / v.control < 0.005, `diff ${v.diff} should be <0.5% of ${v.control}`);
  assert.equal(v.diff, 0, `expect 0-diff checksum; got ${v.diff}`);
});

test('sourceDate: Alabama fiscal year ends Sep 30 — non-June-30 (P4, FY_END_MMDD)', () => {
  assert.equal(sourceDate('AL', 2024), '2024-09-30');
  assert.equal(sourceDate('AL', 2023), '2023-09-30');
});

test('Alabama 6-function taxonomy has no Public Assistance line (2025 SER structure)', () => {
  const hasPA = (entry) => entry.categories.some(c => c.name === 'Public Assistance');
  assert.equal(hasPA(AL_FY2023), false, 'FY2023 must not have a Public Assistance category');
  assert.equal(hasPA(AL_FY2024), false, 'FY2024 must not have a Public Assistance category');
  assert.equal(AL_FY2023.categories.length, 6, 'FY2023 should have exactly 6 categories');
  assert.equal(AL_FY2024.categories.length, 6, 'FY2024 should have exactly 6 categories');
});
