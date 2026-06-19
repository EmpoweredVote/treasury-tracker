/**
 * Offline unit tests for the pure logic exported from scripts/loadUtahTransparency.js
 * (v2.5 Phase 68 — UTSRC-02 build verification).
 *
 * Run with: node --test scripts/loadUtahTransparency.test.mjs
 *
 * These tests exercise the tree builder, amount parser, type→dataset mapper, and
 * never-overwrite decision against FIXTURE rows — NO BigQuery, NO Supabase, NO
 * network. The BigQuery client is dynamically imported only inside the live fetch
 * path, so importing this module never requires @google-cloud/bigquery or ADC.
 *
 * CRITICAL: set a dummy SUPABASE_SERVICE_KEY BEFORE the import so the loader's
 * top-level guard (`if (!SUPABASE_KEY) process.exit(1)`) does not kill the runner.
 */

process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || 'test-key-not-used';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  amt,
  typeToDataset,
  neverOverwriteDecision,
  buildTree,
  buildSalaryTree,
  SALARY_QUERY,
  DATA_SOURCE_NAME,
} from './loadUtahTransparency.js';

// ── amt — money/number parsing ────────────────────────────────────────────────

describe('amt — parses BigQuery numeric + string money safely', () => {
  it('numeric input passes through: 1234.56 → 1234.56', () => {
    assert.equal(amt(1234.56), 1234.56);
  });
  it('plain integer 150535676 → 150535676 (no truncation)', () => {
    assert.equal(amt(150535676), 150535676);
  });
  it('comma string "1,234.56" → 1234.56', () => {
    assert.equal(amt('1,234.56'), 1234.56);
  });
  it('dollar + comma "$1,000" → 1000', () => {
    assert.equal(amt('$1,000'), 1000);
  });
  it('parenthesized offset "(1,000)" → -1000', () => {
    assert.equal(amt('(1,000)'), -1000);
  });
  it('negative number -250 → -250', () => {
    assert.equal(amt(-250), -250);
  });
  it('empty / null / undefined → 0', () => {
    assert.equal(amt(''), 0);
    assert.equal(amt(null), 0);
    assert.equal(amt(undefined), 0);
  });
});

// ── typeToDataset — EX/RV mapping (PY deferred) ──────────────────────────────

describe('typeToDataset — BigQuery type code → dataset_type', () => {
  it('EX → operating', () => assert.equal(typeToDataset('EX'), 'operating'));
  it('RV → revenue', () => assert.equal(typeToDataset('RV'), 'revenue'));
  it('PY → salaries (mapped, but out of scope this phase)', () =>
    assert.equal(typeToDataset('PY'), 'salaries'));
  it('unknown → null', () => assert.equal(typeToDataset('ZZ'), null));
});

// ── neverOverwriteDecision — never overwrite a different source ───────────────

describe('neverOverwriteDecision — preserve different-source rows', () => {
  it('different source → "skip" (preserve existing)', () => {
    assert.equal(neverOverwriteDecision('Custom Provo Budget', DATA_SOURCE_NAME), 'skip');
  });
  it('same source (Transparent Utah) → "refresh"', () => {
    assert.equal(neverOverwriteDecision('Transparent Utah', DATA_SOURCE_NAME), 'refresh');
  });
  it('no existing row (null/empty source) → "refresh"', () => {
    assert.equal(neverOverwriteDecision(null, DATA_SOURCE_NAME), 'refresh');
    assert.equal(neverOverwriteDecision('', DATA_SOURCE_NAME), 'refresh');
  });
  it('defaults runSourceName to DATA_SOURCE_NAME', () => {
    assert.equal(neverOverwriteDecision('Transparent Utah'), 'refresh');
    assert.equal(neverOverwriteDecision('SCO ByTheNumbers'), 'skip');
  });
});

// ── buildTree — fund-first compact tree (D-69-01: fund1 → org1 → cat1) ────────

// Fixture rows shaped like the documented BQ schema (fund1/org1/cat1/amount).
const FIXTURE = [
  { fund1: 'General Fund', org1: 'Police',  cat1: 'Patrol',         amount: 1000 },
  { fund1: 'General Fund', org1: 'Police',  cat1: 'Investigations', amount: 500 },
  { fund1: 'General Fund', org1: 'Fire',    cat1: 'Suppression',    amount: 800 },
  { fund1: 'Water',        org1: 'Streets', cat1: 'Paving',         amount: 2000 },
  { fund1: 'Water',        org1: 'Streets', cat1: 'Refund',         amount: '(200)' }, // offset
  { fund1: 'Water',        org1: 'Streets', cat1: 'ZeroLine',       amount: 0 },        // skipped
  { fund1: null,           org1: null,      cat1: null,             amount: 50 },        // Unknown/General
];

describe('buildTree — totals, structure, sorting, edge cases', () => {
  const { tree, total } = buildTree(FIXTURE, { topCol: 'fund1', subCol: 'org1', itemCol: 'cat1' });

  it('grand total equals the sum of all non-zero rows (incl. the negative offset)', () => {
    // 1000 + 500 + 800 + 2000 - 200 + 50 = 4150  (the 0 row is skipped)
    assert.equal(total, 4150);
  });

  it('each top-level total equals the sum of its children', () => {
    for (const node of tree) {
      const childSum = node.c.reduce((s, c) => s + c.a, 0);
      assert.equal(node.a, childSum, `top "${node.n}" total != sum of children`);
    }
  });

  it('each subcategory total equals the sum of its items', () => {
    for (const node of tree) {
      for (const sub of node.c) {
        const itemSum = sub.i.reduce((s, i) => s + i.a, 0);
        assert.equal(sub.a, itemSum, `sub "${sub.n}" total != sum of items`);
      }
    }
  });

  it('top-level nodes are sorted by amount descending', () => {
    const amounts = tree.map((n) => n.a);
    const sorted = [...amounts].sort((x, y) => y - x);
    assert.deepEqual(amounts, sorted);
  });

  it('uses the compact {n,a,c}/{n,a,i} shape', () => {
    const top = tree[0];
    assert.ok('n' in top && 'a' in top && 'c' in top);
    const sub = top.c[0];
    assert.ok('n' in sub && 'a' in sub && 'i' in sub);
    const item = sub.i[0];
    assert.ok('d' in item && 'a' in item);
  });

  it('top nodes are funds (fund1), subs are departments (org1), leaves are objects (cat1)', () => {
    const gf = tree.find((n) => n.n === 'General Fund');
    assert.ok(gf, 'expected a "General Fund" top-level node (fund1)');
    const police = gf.c.find((c) => c.n === 'Police');
    assert.ok(police, 'expected a "Police" sub node (org1)');
    assert.ok(police.i.some((i) => i.d === 'Patrol'), 'expected a "Patrol" leaf (cat1)');
  });

  it('skips zero-amount rows but retains negative offsets', () => {
    const water = tree.find((n) => n.n === 'Water');
    const streets = water.c.find((c) => c.n === 'Streets');
    // Paving 2000 + Refund(-200) = 1800; ZeroLine excluded entirely
    assert.equal(streets.a, 1800);
    assert.ok(!streets.i.some((i) => i.d === 'ZeroLine'));
    assert.ok(streets.i.some((i) => i.d === 'Refund' && i.a === -200));
  });

  it('null fund1/org1 fall back to "Unknown"/"General"', () => {
    const unknown = tree.find((n) => n.n === 'Unknown');
    assert.ok(unknown, 'expected an "Unknown" top-level node');
    assert.equal(unknown.a, 50);
    assert.equal(unknown.c[0].n, 'General');
  });

  it('respects a configurable top column (top by org1 instead of fund1)', () => {
    const byOrg = buildTree(FIXTURE, { topCol: 'org1', subCol: 'fund1', itemCol: 'cat1' });
    // Top level now Police/Fire/Streets (+ "Unknown" for the null-org1 row) rather than funds
    const names = byOrg.tree.map((n) => n.n).sort();
    assert.deepEqual(names, ['Fire', 'Police', 'Streets', 'Unknown']);
    assert.equal(byOrg.total, 4150); // total is column-independent
  });
});

// ── PII-exclusion guard (D-71-01) ─────────────────────────────────────────────

/** The full list of PII column names that MUST NOT appear in the PY query or emitted tree. */
const PII_BLOCKLIST = [
  'vendor_name', 'dba_name', 'vendor_code', 'title', 'hourly_rate',
  'gender', 'account_number', 'contract_name', 'contract_number',
  'description', 'ref_id',
];

describe('PII-exclusion guard (D-71-01) — SALARY_QUERY and buildSalaryTree emit no PII', () => {
  it('SALARY_QUERY contains org1, cat1, SUM(amount), GROUP BY org1, cat1, and parameterized type', () => {
    assert.ok(SALARY_QUERY.includes('org1'), 'query must reference org1');
    assert.ok(SALARY_QUERY.includes('cat1'), 'query must reference cat1');
    assert.ok(SALARY_QUERY.toLowerCase().includes('sum(amount)'), 'query must aggregate with SUM(amount)');
    assert.ok(SALARY_QUERY.includes('GROUP BY org1, cat1'), 'query must GROUP BY org1, cat1');
    assert.ok(SALARY_QUERY.includes('type = @type'), 'query must use parameterized @type (never literal)');
  });

  it('SALARY_QUERY does NOT contain fund1', () => {
    assert.ok(!SALARY_QUERY.includes('fund1'), 'salary query must not reference fund1 (all-funds, D-71-03)');
  });

  for (const piiToken of PII_BLOCKLIST) {
    it(`SALARY_QUERY does NOT contain PII token: ${piiToken}`, () => {
      assert.ok(
        !SALARY_QUERY.includes(piiToken),
        `SALARY_QUERY must not reference PII column "${piiToken}" (D-71-01)`,
      );
    });
  }

  // Fixture rows that carry PII keys alongside the allowed columns — the tree must
  // suppress all PII and emit ONLY { n: org1-value, a: ..., c: [{ n: cat1-value, a: ... }] }.
  const PII_LADEN_FIXTURE = [
    {
      org1: 'Police - Patrol', cat1: 'Wages', amount: 65000,
      vendor_name: 'John Doe', dba_name: 'JD LLC', vendor_code: 'V123',
      title: 'Officer I', hourly_rate: 31.25, gender: 'M',
      account_number: 'AC-001', contract_name: 'PD Contract',
      contract_number: 'CN-007', description: 'Regular Pay',
      ref_id: 'REF-42',
    },
    {
      org1: 'Police - Patrol', cat1: 'Benefits', amount: 27000,
      vendor_name: 'Jane Smith', title: 'Officer I', hourly_rate: 31.25,
      gender: 'F', account_number: 'AC-002',
    },
    {
      org1: 'Fire - Administration', cat1: 'Wages', amount: 120000,
      vendor_name: 'Chief Burns', title: 'Fire Chief',
    },
  ];

  it('buildSalaryTree tree JSON contains none of the PII blocklist tokens', () => {
    const { tree } = buildSalaryTree(PII_LADEN_FIXTURE);
    const json = JSON.stringify(tree);
    for (const piiToken of PII_BLOCKLIST) {
      assert.ok(
        !json.includes(piiToken),
        `Serialized salary tree must not contain PII token "${piiToken}" (D-71-01)`,
      );
    }
  });

  it('buildSalaryTree tree JSON does not contain any fixture PII values (names/codes/rates)', () => {
    const { tree } = buildSalaryTree(PII_LADEN_FIXTURE);
    const json = JSON.stringify(tree);
    // Spot-check actual PII values from the fixture
    assert.ok(!json.includes('John Doe'), 'must not contain individual name');
    assert.ok(!json.includes('Jane Smith'), 'must not contain individual name');
    assert.ok(!json.includes('Chief Burns'), 'must not contain individual name');
    assert.ok(!json.includes('Officer I'), 'must not contain job title');
    assert.ok(!json.includes('31.25'), 'must not contain hourly rate');
    assert.ok(!json.includes('V123'), 'must not contain vendor code');
    assert.ok(!json.includes('REF-42'), 'must not contain ref_id');
  });
});

// ── buildSalaryTree shape (D-71-02) ──────────────────────────────────────────

const SALARY_FIXTURE = [
  // Dept A: 2 categories
  { org1: 'Police - Patrol',      cat1: 'Wages',    amount: 65125717 },
  { org1: 'Police - Patrol',      cat1: 'Benefits', amount: 27820236 },
  // Dept B: 2 categories
  { org1: 'Fire - Administration', cat1: 'Wages',    amount: 8000000 },
  { org1: 'Fire - Administration', cat1: 'Benefits', amount: 3000000 },
  // Zero-amount row — must be skipped
  { org1: 'Police - Patrol',      cat1: 'Wages',    amount: 0 },
];

describe('buildSalaryTree shape (D-71-02) — 2-level Department→comp-category tree', () => {
  const { tree, total } = buildSalaryTree(SALARY_FIXTURE);

  it('grand total equals sum of all non-zero amounts', () => {
    // 65125717 + 27820236 + 8000000 + 3000000 = 103945953
    assert.equal(total, 65125717 + 27820236 + 8000000 + 3000000);
  });

  it('top-level nodes have {n, a, c} keys', () => {
    for (const node of tree) {
      assert.ok('n' in node, 'top node must have n');
      assert.ok('a' in node, 'top node must have a');
      assert.ok('c' in node, 'top node must have c');
    }
  });

  it('children have {n, a} but NO i key (2-level — no 3rd item level)', () => {
    for (const node of tree) {
      for (const child of node.c) {
        assert.ok('n' in child, 'child must have n');
        assert.ok('a' in child, 'child must have a');
        assert.ok(!('i' in child), 'child must NOT have i key (not 3-level)');
      }
    }
  });

  it('each department total equals the sum of its category children', () => {
    for (const node of tree) {
      const childSum = node.c.reduce((s, c) => s + c.a, 0);
      assert.equal(node.a, childSum, `dept "${node.n}" total != sum of children`);
    }
  });

  it('top-level nodes are sorted descending by amount', () => {
    const amounts = tree.map((n) => n.a);
    const sorted = [...amounts].sort((x, y) => y - x);
    assert.deepEqual(amounts, sorted);
  });

  it('category children are sorted descending by amount', () => {
    for (const node of tree) {
      const amounts = node.c.map((c) => c.a);
      const sorted = [...amounts].sort((x, y) => y - x);
      assert.deepEqual(amounts, sorted, `children of "${node.n}" not sorted desc`);
    }
  });

  it('zero-amount rows are skipped', () => {
    // The zero row was for Police - Patrol / Wages — Wages total should be exactly 65125717, not 65125717+0
    const police = tree.find((n) => n.n === 'Police - Patrol');
    assert.ok(police, 'Police - Patrol node must exist');
    const wages = police.c.find((c) => c.n === 'Wages');
    assert.ok(wages, 'Wages child must exist');
    assert.equal(wages.a, 65125717, 'Wages total must be exactly 65125717 (zero row skipped)');
  });

  it('category names match the Wages/Benefits shape from the Provo FY2024 probe', () => {
    const police = tree.find((n) => n.n === 'Police - Patrol');
    const catNames = police.c.map((c) => c.n).sort();
    assert.deepEqual(catNames, ['Benefits', 'Wages']);
  });

  it('there are exactly 2 departments in the fixture', () => {
    assert.equal(tree.length, 2);
  });
});
