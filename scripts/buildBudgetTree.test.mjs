/**
 * TDD tests for buildBudgetTree() 3-level extension (RETROFIT-02)
 *
 * RED phase: tests fail because buildBudgetTree does NOT yet support
 * department_column or the 3-level path.
 *
 * Run with: npx vitest run scripts/buildBudgetTree.test.mjs
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';

// The function under test will be extracted to scripts/buildBudgetTree.mjs
// RED: This import will fail (file does not exist yet)
import { buildBudgetTree } from './buildBudgetTree.mjs';

// ── Test data helpers ──────────────────────────────────────────────────────

/** Minimal column_mapping for 2-level (no department_column) */
const CM_2LEVEL = {
  category_column: 'service',
  subcategory_column: 'objectgroup',
  approved_amount_column: 'adoptedamount',
};

/** Column mapping with department_column (3-level) */
const CM_3LEVEL = {
  department_column: 'appropriation',
  category_column: 'service',
  subcategory_column: 'objectgroup',
  approved_amount_column: 'adoptedamount',
};

/** Sample rows representing Dallas Operating data */
const ROWS_3LEVEL = [
  { appropriation: 'Police Department GF', service: 'Police Field Patrol',        objectgroup: 'Personnel Services',           adoptedamount: '500000' },
  { appropriation: 'Police Department GF', service: 'Police Field Patrol',        objectgroup: 'Contractual & Other Services', adoptedamount: '100000' },
  { appropriation: 'Police Department GF', service: 'Police Administration',      objectgroup: 'Personnel Services',           adoptedamount: '200000' },
  { appropriation: 'Dallas Fire Rescue GF', service: 'Fire Emergency Response',   objectgroup: 'Personnel Services',           adoptedamount: '400000' },
  { appropriation: 'Dallas Fire Rescue GF', service: 'Fire Emergency Response',   objectgroup: 'Equipment',                    adoptedamount: '50000'  },
  { appropriation: 'Library GF',            service: 'Library Services',          objectgroup: 'Personnel Services',           adoptedamount: '150000' },
  // NONE-service row (D-06) — should still be grouped under its dept
  { appropriation: 'Debt Service',          service: 'NONE',                      objectgroup: 'Debt Payment',                 adoptedamount: '300000' },
  // Zero-amount row — should be dropped
  { appropriation: 'Police Department GF', service: 'Police Field Patrol',        objectgroup: 'Empty Line',                   adoptedamount: '0'      },
  // Null department — fallback to 'Unknown'
  { appropriation: null,                    service: 'Miscellaneous',             objectgroup: 'Other',                        adoptedamount: '75000'  },
];

/** Same rows WITHOUT appropriation — used for backward-compat test via CM_2LEVEL */
const ROWS_2LEVEL = [
  { service: 'Personnel',    objectgroup: 'Salaries', adoptedamount: '300000' },
  { service: 'Personnel',    objectgroup: 'Benefits', adoptedamount: '100000' },
  { service: 'Contractual',  objectgroup: 'IT',       adoptedamount: '200000' },
  // Zero row — dropped
  { service: 'Contractual',  objectgroup: 'Empty',    adoptedamount: '0'      },
];

// ── Tests: 2-level backward-compat ────────────────────────────────────────

describe('buildBudgetTree — 2-level path (backward-compat)', () => {
  it('returns jsonTree, total, kept, droppedZero', () => {
    const result = buildBudgetTree(ROWS_2LEVEL, CM_2LEVEL);
    assert.ok('jsonTree' in result, 'must return jsonTree');
    assert.ok('total' in result, 'must return total');
    assert.ok('kept' in result, 'must return kept');
    assert.ok('droppedZero' in result, 'must return droppedZero');
  });

  it('drops zero-amount rows', () => {
    const { kept, droppedZero } = buildBudgetTree(ROWS_2LEVEL, CM_2LEVEL);
    assert.equal(droppedZero, 1, 'exactly 1 zero-amount row should be dropped');
    assert.equal(kept, 3, 'exactly 3 non-zero rows should be kept');
  });

  it('produces 2-level shape: category nodes with c:[subcategory] children', () => {
    const { jsonTree } = buildBudgetTree(ROWS_2LEVEL, CM_2LEVEL);
    assert.ok(Array.isArray(jsonTree), 'jsonTree must be array');
    const personnelNode = jsonTree.find(n => n.n === 'Personnel');
    assert.ok(personnelNode, 'Personnel category node must exist');
    assert.ok(Array.isArray(personnelNode.c), 'category node must have c array');
    assert.ok(!('i' in personnelNode), 'category node must NOT have i (no items at this level)');
    assert.equal(personnelNode.c.length, 2, 'Personnel must have 2 subcategory children (Salaries, Benefits)');
  });

  it('sorts nodes descending by amount at every level', () => {
    const { jsonTree } = buildBudgetTree(ROWS_2LEVEL, CM_2LEVEL);
    // Top level: Personnel ($400K) > Contractual ($200K)
    assert.ok(jsonTree[0].a >= jsonTree[1].a, 'top-level nodes must be sorted descending');
  });

  it('totals are correct', () => {
    const { total } = buildBudgetTree(ROWS_2LEVEL, CM_2LEVEL);
    assert.equal(total, 600000, 'total must be 600000 (300+100+200)');
  });
});

// ── Tests: 3-level path ───────────────────────────────────────────────────

describe('buildBudgetTree — 3-level path (department_column set)', () => {
  it('returns jsonTree with 3 levels: dept → category → subcategory', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    assert.ok(Array.isArray(jsonTree), 'jsonTree must be array');

    // Dept node should have c array of category children
    const policeNode = jsonTree.find(n => n.n === 'Police Department GF');
    assert.ok(policeNode, 'Police Department GF dept node must exist');
    assert.ok(Array.isArray(policeNode.c), 'dept node must have c array (category children)');
    assert.ok(!('i' in policeNode), 'dept node must NOT have i');

    // Category child should have c array of subcategory children
    const patrolNode = policeNode.c.find(n => n.n === 'Police Field Patrol');
    assert.ok(patrolNode, 'Police Field Patrol category node must exist');
    assert.ok(Array.isArray(patrolNode.c), 'category node must have c array (subcategory children)');

    // Subcategory child should have i array of line items
    const personnelSub = patrolNode.c.find(n => n.n === 'Personnel Services');
    assert.ok(personnelSub, 'Personnel Services subcategory must exist');
    assert.ok(Array.isArray(personnelSub.i), 'subcategory node must have i array');
    assert.ok(!('c' in personnelSub), 'subcategory node must NOT have c');
  });

  it('drops zero-amount rows in 3-level mode', () => {
    const { droppedZero, kept } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    assert.equal(droppedZero, 1, 'exactly 1 zero-amount row should be dropped');
    assert.equal(kept, 8, 'exactly 8 non-zero rows should be kept');
  });

  it('null/empty department falls back to "Unknown"', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    const unknownNode = jsonTree.find(n => n.n === 'Unknown');
    assert.ok(unknownNode, '"Unknown" dept node must exist for null-dept rows');
  });

  it('NONE-service row groups under its appropriation dept (D-06)', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    const debtNode = jsonTree.find(n => n.n === 'Debt Service');
    assert.ok(debtNode, 'Debt Service dept node must exist');
    // service='NONE' should be its child
    const noneChild = debtNode.c.find(n => n.n === 'NONE');
    assert.ok(noneChild, 'NONE service should group under Debt Service dept');
  });

  it('sorts nodes descending by amount at every level', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    // Top level: Police ($800K) > Fire ($450K) > Debt ($300K) > Library ($150K) > Unknown ($75K)
    for (let i = 0; i < jsonTree.length - 1; i++) {
      assert.ok(jsonTree[i].a >= jsonTree[i + 1].a,
        `dept nodes must be sorted descending (index ${i})`);
    }
    // Category level within Police
    const policeNode = jsonTree.find(n => n.n === 'Police Department GF');
    for (let i = 0; i < policeNode.c.length - 1; i++) {
      assert.ok(policeNode.c[i].a >= policeNode.c[i + 1].a,
        `category nodes within Police must be sorted descending (index ${i})`);
    }
  });

  it('totals reconcile across 3 levels', () => {
    const { jsonTree, total } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    // total should be sum of non-zero rows: 500+100+200+400+50+150+300+75 = 1775000
    assert.equal(total, 1775000, 'total must be 1775000');

    // dept totals sum to overall total
    const deptSum = jsonTree.reduce((s, n) => s + n.a, 0);
    assert.equal(deptSum, total, 'dept totals must sum to overall total');

    // Police: 500+100+200 = 800000
    const policeNode = jsonTree.find(n => n.n === 'Police Department GF');
    assert.equal(policeNode.a, 800000, 'Police dept total must be 800000');
  });

  it('dept node shape is { n, a, c } — no extra keys', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    const policeNode = jsonTree.find(n => n.n === 'Police Department GF');
    const keys = Object.keys(policeNode).sort();
    assert.deepEqual(keys, ['a', 'c', 'n'], 'dept node must have exactly n, a, c');
  });

  it('category node shape is { n, a, c } — no extra keys', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    const policeNode = jsonTree.find(n => n.n === 'Police Department GF');
    const patrolNode = policeNode.c.find(n => n.n === 'Police Field Patrol');
    const keys = Object.keys(patrolNode).sort();
    assert.deepEqual(keys, ['a', 'c', 'n'], 'category node must have exactly n, a, c');
  });

  it('subcategory node shape is { n, a, i } — no extra keys', () => {
    const { jsonTree } = buildBudgetTree(ROWS_3LEVEL, CM_3LEVEL);
    const policeNode = jsonTree.find(n => n.n === 'Police Department GF');
    const patrolNode = policeNode.c.find(n => n.n === 'Police Field Patrol');
    const personnelSub = patrolNode.c.find(n => n.n === 'Personnel Services');
    const keys = Object.keys(personnelSub).sort();
    assert.deepEqual(keys, ['a', 'i', 'n'], 'subcategory node must have exactly n, a, i');
  });
});

// ── Validation tests ───────────────────────────────────────────────────────

describe('buildBudgetTree — validation', () => {
  it('throws if category_column is missing', () => {
    assert.throws(
      () => buildBudgetTree([], { approved_amount_column: 'amount' }),
      /column_mapping must define category_column/
    );
  });

  it('throws if approved_amount_column is missing', () => {
    assert.throws(
      () => buildBudgetTree([], { category_column: 'cat' }),
      /column_mapping must define.*approved_amount_column/
    );
  });
});
